window.addEventListener("load", function() { tabExtension.init(); }, false);
var kb,sf,qs;
var tabulator = Components.classes["@dig.csail.mit.edu/tabulator;1"].getService(Components.interfaces.nsISupports).wrappedJSObject;
if(!tabulator.kb) {
  kb = new RDFIndexedFormula()  // This uses indexing and smushing
  sf = new SourceFetcher(kb)    // This handles resource retrieval
  qs = new QuerySource()        // This stores all user-generated queries
  kb.register('dc', "http://purl.org/dc/elements/1.1/")
  kb.register('rdf', "http://www.w3.org/1999/02/22-rdf-syntax-ns#")
  kb.register('rdfs', "http://www.w3.org/2000/01/rdf-schema#")
  kb.register('owl', "http://www.w3.org/2002/07/owl#")
  tabulator.kb=kb;
  tabulator.qs=qs;
  tabulator.sf=sf;
  tabulator.registerView(tableView);
} else {
  kb = tabulator.kb;
  sf = tabulator.sf;
  qs = tabulator.qs;
}
  

internals = []
internals['http://dig.csail.mit.edu/2005/ajar/ajaw/ont#request'] = 1;
internals['http://dig.csail.mit.edu/2005/ajar/ajaw/ont#requestedBy'] = 1;
internals['http://dig.csail.mit.edu/2005/ajar/ajaw/ont#source'] = 1;
internals['http://dig.csail.mit.edu/2005/ajar/ajaw/ont#session'] = 1;
internals['http://www.w3.org/2006/link#uri'] = 1;
internals['http://www.w3.org/2000/01/rdf-schema#seeAlso'] = 1;

// Special knowledge of properties
tabont = Namespace("http://dig.csail.mit.edu/2005/ajar/ajaw#")
foaf = Namespace("http://xmlns.com/foaf/0.1/")
rdf = Namespace("http://www.w3.org/1999/02/22-rdf-syntax-ns#")
RDFS = Namespace("http://www.w3.org/2000/01/rdf-schema#")
OWL = Namespace("http://www.w3.org/2002/07/owl#")
dc = Namespace("http://purl.org/dc/elements/1.1/")
rss = Namespace("http://purl.org/rss/1.0/")
xsd = Namespace("http://www.w3.org/TR/2004/REC-xmlschema-2-20041028/#dt-")
contact = Namespace("http://www.w3.org/2000/10/swap/pim/contact#")
mo = Namespace("http://purl.org/ontology/mo/")

var views = {
    properties                          : [],
    defaults                                : [],
    classes                                 : []
}; //views

Icon = {}
Icon.src= []
Icon.tooltips= []

var iconPrefix = 'chrome://tabulator/content/';
Icon.src.icon_unrequested = iconPrefix+'icons/16dot-blue.gif';
Icon.src.icon_fetched = iconPrefix+'icons/16dot-green.gif';
Icon.src.icon_failed = iconPrefix+'icons/16dot-red.gif';
Icon.src.icon_requested = iconPrefix+'icons/16dot-yellow.gif'
Icon.src.icon_expand = iconPrefix+'icons/tbl-expand-trans.png';
Icon.src.icon_collapse = iconPrefix+'icons/tbl-collapse.png';
Icon.src.icon_remove_node = iconPrefix+'icons/tbl-x-small.png'
Icon.src.icon_shrink = iconPrefix+'icons/tbl-shrink.png';
Icon.src.icon_optoff = iconPrefix+'icons/optional_off.PNG';
Icon.src.icon_opton = iconPrefix+'icons/optional_on.PNG';

Icon.tooltips[Icon.src.icon_remove_node]='Remove this.'
Icon.tooltips[Icon.src.icon_expand]='View details.'
Icon.tooltips[Icon.src.icon_collapse] = 'Hide details.'
Icon.tooltips[Icon.src.icon_collapse] = 'Hide list.'
Icon.tooltips[Icon.src.icon_rows] = 'Make a table of data like this'
Icon.tooltips[Icon.src.icon_unrequested] = 'Fetch this resource.'
Icon.tooltips[Icon.src.icon_fetched] = 'This was fetched successfully.'
Icon.tooltips[Icon.src.icon_failed] = 'Failed to load. Click to retry.'
Icon.tooltips[Icon.src.icon_requested] = 'Being fetched. Please wait...'
Icon.tooltips[Icon.src.icon_visit] = 'View the HTML content of this page within tabulator.'
Icon.tooltips[Icon.src.icon_retract] = 'Remove this source and all its data from tabulator.'
Icon.tooltips[Icon.src.icon_refresh] = 'Refresh this source and reload its triples.'

Icon.OutlinerIcon= function (src, width, alt, tooltip, filter)
{
	this.src=src;
	this.alt=alt;
	this.width=width;
	this.tooltip=tooltip;
	this.filter=filter;
       //filter: RDFStatement,('subj'|'pred'|'obj')->boolean, inverse->boolean (whether the statement is an inverse).
       //Filter on whether to show this icon for a term; optional property.
       //If filter is not passed, this icon will never AUTOMATICALLY be shown.
       //You can show it with termWidget.addIcon
	return this;
}

Icon.termWidgets = {}
Icon.termWidgets.optOn = new Icon.OutlinerIcon(Icon.src.icon_opton,20,'opt on','Make this branch of your query mandatory.');
Icon.termWidgets.optOff = new Icon.OutlinerIcon(Icon.src.icon_optoff,20,'opt off','Make this branch of your query optional.');

LanguagePreference = "en"
labelPriority = []
labelPriority[foaf('name').uri] = 10
labelPriority[dc('title').uri] = 8
labelPriority[rss('title').uri] = 6   // = dc:title?
labelPriority[contact('fullName').uri] = 4
labelPriority['http://www.w3.org/2001/04/roadmap/org#name'] = 4
labelPriority[foaf('nick').uri] = 3
labelPriority[RDFS('label').uri] = 2


kb.predicateCallback = AJAR_handleNewTerm;
kb.typeCallback = AJAR_handleNewTerm;

//Heavily modified from http://developer.mozilla.org/en/docs/Code_snippets:On_page_load
var tabExtension = {
  init: function() {
    var appcontent = document.getElementById("appcontent");   // browser
    if(appcontent) {
      var catman = Components.classes["@mozilla.org/categorymanager;1"]
                           .getService(Components.interfaces.nsICategoryManager);
      catman.deleteCategoryEntry("Gecko-Content-Viewers","application/rdf+xml",false);
      var tabulator = Components.classes["@dig.csail.mit.edu/tabulator;1"].getService(Components.interfaces.nsISupports).wrappedJSObject;
      gBrowser.addEventListener('load',function(e) {
        var doc = e.originalTarget;
        var divs = doc.getElementsByTagName('div');
        for(var i=0;i<divs.length;i++) {
          if(divs[i].className.search("TabulatorOutline")!=-1) {
            //Inject an outline here!!
            var uri = divs[i].getAttribute('id');
            var table = doc.createElement('table');
            table.setAttribute('id','outline');
            divs[i].appendChild(table);
            var outline = new Outline(doc);
            outline.GotoSubject(kb.sym(uri),true);
            var queryButton = doc.createElement('input');
            queryButton.setAttribute('type','button');
            queryButton.setAttribute('value','Find All');
            divs[i].appendChild(queryButton);
            queryButton.addEventListener('click',outline.viewAndSaveQuery,false);
          }
        }
      },true);
    }
  }
}

function OutlineLoader(target,uri) {
  onLoadEvent = function(e) {
    var doc = e.originalTarget;
    //The following might be shaky: if there are loading bugs, check this first    
    var outline = new Outline(e.originalTarget);
    outline.GotoSubject(kb.sym(uri),true);
    var queryButton = doc.createElement('input');
    queryButton.setAttribute('type','button');
    queryButton.setAttribute('value','Find All');
    doc.body.appendChild(queryButton);
    queryButton.addEventListener('click',outline.viewAndSaveQuery,false);
    //TODO: Figure out the BROWSER from the event.
    target.removeEventListener("load",onLoadEvent , true);
  }
  return onLoadEvent;
}    

  function AJARImage(src, alt, tt) {
    if (!tt && Icon.tooltips[src]) tt = Icon.tooltips[src]
    //var sp = document.createElement('span')
    var image = content.document.createElement('img')
    image.setAttribute('src', src)
    if (typeof alt != 'undefined') image.setAttribute('alt', alt)
    if (typeof tt != 'undefined') image.setAttribute('title',tt)
    return image
  }

termWidget={}

termWidget.construct = function ()
{
	td = document.createElement('TD')
	td.setAttribute('class','iconTD')
	td.setAttribute('notSelectable','true')
	td.style.width = '0px';
	return td
}

termWidget.addIcon = function (td, icon)
{
	var img = AJARImage(icon.src,icon.alt,icon.tooltip)
	var iconTD = td.childNodes[1];
	var width = iconTD.style.width;
	width = parseInt(width);
	width = width + icon.width;
	iconTD.style.width = width+'px';
	iconTD.appendChild(img);
}

termWidget.removeIcon = function (td, icon){
  var iconTD = td.childNodes[1];
  var width = iconTD.style.width;
  width = parseInt(width);
  width = width - icon.width;
  iconTD.style.width = width+'px';
  for (var x = 0; x<iconTD.childNodes.length; x++){
    var elt = iconTD.childNodes[x];
    var eltSrc = elt.src;
    var baseURI = content.document.location.href.split('?')[0]; // ignore first '?' and everything after it
    var relativeIconSrc = Util.uri.join(icon.src,baseURI);
    if (eltSrc == relativeIconSrc) {
      iconTD.removeChild(elt);
    }
  }
}

termWidget.replaceIcon = function (td, oldIcon, newIcon)
{
	termWidget.removeIcon (td, oldIcon)
	termWidget.addIcon (td, newIcon)
}


function emptyNode(node) {
  var nodes = node.childNodes, len = nodes.length, i
  for (i=len-1; i>=0; i--)
    node.removeChild(nodes[i])
  return node
}

function AJAR_handleNewTerm(kb, p, requestedBy) {
    //tdebug("entering AJAR_handleNewTerm w/ kb, p=" + p + ", requestedBy=" + requestedBy);
    if (p.termType != 'symbol') return;
    var docuri = Util.uri.docpart(p.uri);
    var fixuri;
    if (p.uri.indexOf('#') < 0) { // No hash

	// @@ major hack for dbpedia Categories, which spred indefinitely
	if (string_startswith(p.uri, 'http://dbpedia.org/resource/Category:')) return;  

/*
        if (string_startswith(p.uri, 'http://xmlns.com/foaf/0.1/')) {
            fixuri = "http://dig.csail.mit.edu/2005/ajar/ajaw/test/foaf"
	    // should give HTTP 303 to ontology -- now is :-)
        } else
*/
	if (string_startswith(p.uri, 'http://purl.org/dc/elements/1.1/')
		   || string_startswith(p.uri, 'http://purl.org/dc/terms/')) {
            fixuri = "http://dublincore.org/2005/06/13/dcq";
	    //dc fetched multiple times
        } else if (string_startswith(p.uri, 'http://xmlns.com/wot/0.1/')) {
            fixuri = "http://xmlns.com/wot/0.1/index.rdf";
        } else if (string_startswith(p.uri, 'http://web.resource.org/cc/')) {
//            twarn("creative commons links to html instead of rdf. doesn't seem to content-negotiate.");
            fixuri = "http://web.resource.org/cc/schema.rdf";
        }
    }
    if (fixuri) {
	docuri = fixuri
    }
    if (sf.getState(kb.sym(docuri)) != 'unrequested') return;
    
    if (fixuri) {   // only give warning once: else happens too often
        twarn("Assuming server still broken, faking redirect of <" + p.uri +
	    "> to <" + docuri + ">")	
    }
    sf.requestURI(docuri, requestedBy);
} //AJAR_handleNewTerm

function string_startswith(str, pref) { // missing library routines
    return (str.slice(0, pref.length) == pref);
}