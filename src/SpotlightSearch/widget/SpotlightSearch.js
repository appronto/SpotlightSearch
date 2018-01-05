/*global logger*/
/*
    SpotlightSearch
    ========================

    @file      : SpotlightSearch.js
    @version   : 1.0.0
    @author    : JvdGraaf
    @date      : Fri, 05 Jan 2018 07:55:53 GMT
    @copyright : Appronto
    @license   : Apache2

    Documentation
    ========================
    Describe your widget here.
*/

// Required module list. Remove unnecessary modules, you can always get them back from the boilerplate.
define([
    "dojo/_base/declare",
    "mxui/widget/_WidgetBase",
    "dijit/_TemplatedMixin",

    "mxui/dom",
    "dojo/dom",
    "dojo/dom-prop",
    "dojo/dom-geometry",
    "dojo/dom-class",
    "dojo/dom-style",
    "dojo/dom-construct",
    "dojo/_base/array",
    "dojo/_base/lang",
    "dojo/text",
    "dojo/html",
    "dojo/keys",
    "dojo/_base/event",
    "dojo/text!SpotlightSearch/widget/template/SpotlightSearch.html"
], function (declare, _WidgetBase, _TemplatedMixin, dom, dojoDom, dojoProp, dojoGeometry, dojoClass, dojoStyle, dojoConstruct, dojoArray, dojoLang, dojoText, dojoHtml, dojoKeys, dojoEvent, widgetTemplate) {
    "use strict";

    // Declare widget's prototype.
    return declare("SpotlightSearch.widget.SpotlightSearch", [ _WidgetBase, _TemplatedMixin ], {
        // _TemplatedMixin will create our dom node using this HTML template.
        templateString: widgetTemplate,

        // DOM elements
        inputBox: null,

        // Parameters configured in the Modeler.
        mfToExecute: "",
        progressBar: "",
        progressMsg: "",
        inputValue: "",
        async: "",
        waitAvailable: true,
        waitString: "",

        // Internal variables. Non-primitives created in the prototype are shared between all widget instances.
        _contextObj: null,
		_tableList: null,
        _handles: [],

        // dojo.declare.constructor is called to construct the widget instance. Implement to initialize non-primitive properties.
        constructor: function() {
            logger.debug(this.id + ".constructor ");
        },

        // dijit._WidgetBase.postCreate is called after constructing the widget. Implement to do extra setup work.
        postCreate: function() {
            console.log(this.id + ".postCreate ");
            this.connect(this.inputBox, "onkeyup", dojoLang.hitch(this, this.onEnterClick));
            this.connect(this.inputboxbutton, "onclick", dojoLang.hitch(this, this.onButtonClick));
            this.connect(this.searchFormNode, "submit", dojoLang.hitch(this, this.onSubmit));
			if(this.tableEntity || this.searchEntity) {
				this.connect(this.inputBox, "onkeypress", dojoLang.hitch(this, this.onKeyPress));
            }
			if(this.placeHolderTxt){
				this.inputBox.placeholder = this.placeHolderTxt;
            }
        },

        // mxui.widget._WidgetBase.update is called when context is changed or initialized. Implement to re-render and / or fetch data.
        update: function(obj, callback) {
            console.log(this.id + ".update " + obj.getGuid());
            this._contextObj = obj;
            this._resetSubscriptions();
            //this._updateRendering();
			
			if(this.tableEntity && this.titleAttr) {
				var constraint = this.tableConstraint;	
				if(this.tableConstraint.indexOf('[%CurrentObject%]') >= 0 && this._contextObj) {
					constraint = this.tableConstraint.replace(/\[%CurrentObject%\]/gi, this._contextObj.getGuid());
                }
				var xpath = '//' + this.tableEntity + constraint;
				mx.data.get({
					xpath : xpath,
					sort: [[this.titleAttr, "asc"]],
					callback : dojoLang.hitch(this, this._prepareList)
				}, this);
			}
			
            callback();
        },
        
        _updateRendering: function () {
            var text = null;
            if(this._contextObj){
                text = this._contextObj.get(this.inputValue);
                this.inputBox.value = text;
            }
            if(!text) {
                this._clearSearch();
            }
        },
		
        // Prepare the selection list of all indexed entities
		_prepareList: function(objs){
			logger.debug(this.id + ".preparelist");
			this._tableList = [];
			this.spotlightselectionlist.innerHTML = "";
			for (var j = 0; j < objs.length; j++) {
				var obj = objs[j];
				var params = {
						id: obj.getGuid(),
						name: obj.get(this.titleAttr),
						text:  " " + this.optionstext + " " + obj.get(this.titleAttr)
					};	
				this._tableList.push(params);
			}
			this._buildTextList();
		},
		
        // Built the selection list of all indexed entities
		_buildTextList: function(){
            if(this._tableList){
                this.spotlightselectionlist.innerHTML = "";
                for (var j = 0; j < this._tableList.length; j++) {
                    var item = this._tableList[j];
                    var li = dojoConstruct.create("li", {
                        'class': "selectionlistitem mx-listview-item",
                        'innerHTML': "<div><b>" + this.inputBox.value + "</b>" + item.text+"</div>"
                    });
                    this.connect(li, "click", dojoLang.hitch(this, this._selectionItemClick, item.id));
                    this.spotlightselectionlist.appendChild(li);
                }
            }
		},
		
        // Clicked on an selection item (indexed entity)
		_selectionItemClick: function(itemId){
			console.log(this.id + "._selectionItemClick " + itemId);
            if(this.selectionRef){
                //this.neweventref.split('/')[0]
                this._contextObj.addReference(this.selectionRef.split('/')[0], itemId);
                this._contextObj.set(this.inputValue, this.inputBox.value);
                this._clearSearch();   
		 		if (this.mfToExecute !== "") {  
			 		this.executeMicroflow(this.mfToExecute, this.async, this.progressBar, this._contextObj.getGuid());
            	}
            }
		},
        
        // Remove all search content
        _clearSearch: function(){
            this.inputBox.value = "";
            this.onKeyPress("");
            this.waitAvailable = true;
        },
        
        // Start of triggering the direct search function on the lucene DB
        _directSearch: function(){
            if(this.waitAvailable && this.searchMF && this.searchAttr && this.searchOpenMF && this.waitString !== this.inputBox.value){
                logger.debug(this.id + "._directSearch start wait for " + this.inputBox.value);
                this.waitAvailable = false;
                this.waitString = this.inputBox.value; // Avoid searching for the same text earlier
                setTimeout(dojoLang.hitch(this, this._startDirectSearch), this.waitTime);
            }
        },
        // Execute the direct search MF
        _startDirectSearch: function(){
            if(this.inputBox.value){
                this._contextObj.set(this.inputValue, this.inputBox.value);
                this.executeMicroflow(this.searchMF, false, false, this._contextObj.getGuid(), dojoLang.hitch(this, this._buildFirstResults));
            }
        },
        // Built the found item in the searchlist
        _buildFirstResults: function(objs){
            console.log(this.id + "._buildFirstResults " + objs.length);
            this.spotlightsearchlist.innerHTML = "";
            if(objs.length > 0)
            {
                this._setStyleText(this.spotlightsearchdiv, "display:block;");
                for (var j = 0; j < objs.length; j++) {
                    var item = objs[j];
                    var inner = "";
                    if(this.searchIcon)
                        inner = "<div><span class=\"glyphicon glyphicon-"+item.get(this.searchIcon)+"\"></span>"+item.get(this.searchAttr)+"</div>";
                    else
                        inner = "<div>"+item.get(this.searchAttr)+"</div>";

                    var li = dojoConstruct.create("li", {
                        'class': "selectionlistitem mx-listview-item",
                        'innerHTML': inner
                    });
                    this.connect(li, "click", dojoLang.hitch(this, this._selectionDirectSearchClick, item.getGuid()));
                    this.spotlightsearchlist.appendChild(li);
                }
            }
            this.waitAvailable = true;
        },
        // Item of the search is triggered.
        _selectionDirectSearchClick: function(itemId){
            logger.debug(this.id + "._selectionDirectSearchClick " + itemId);
            this._clearSearch();
            this.executeMicroflow(this.searchOpenMF, false, false, itemId);
        },

        // mxui.widget._WidgetBase.uninitialize is called when the widget is destroyed. Implement to do special tear-down work.
        uninitialize: function() {
          logger.debug(this.id + ".uninitialize ");
            // Clean up listeners, helper objects, etc. There is no need to remove listeners added with this.connect / this.subscribe / this.own.
        },
        ////////////////////////////////////////////////////////////////////////////////////////////
        onEnterClick: function(event) {
            if (event.keyCode == dojoKeys.ENTER) {
                logger.debug(this.id + ".onEnterClick enter triggered");
                this._contextObj.set(this.inputValue, this.inputBox.value);
                if(this.clearSearchInput){
                    this._clearSearch(); 
                }
                event.preventDefault();
		 		if (this.mfToExecute) {  
			 		this.executeMicroflow(this.mfToExecute, this.async, this.progressBar, this._contextObj.getGuid());
            	}
         	} else if(this.tableEntity){
                logger.debug(this.id + ".onEnterClick other key triggered");
				this.onKeyPress(event);
			}
     	},
        onButtonClick: function(event){
            if(this.inputBox.value){
                this._contextObj.set(this.inputValue, this.inputBox.value);
		 		if (this.mfToExecute !== "") {  
			 		this.executeMicroflow(this.mfToExecute, this.async, this.progressBar, this._contextObj.getGuid());
            	}
                if(this.clearSearchInput){
                    this._clearSearch(); 
                }
            }
        },
        onSubmit: function(e) {
            e.preventDefault();
            return false;
        },
		onKeyPress: function(event) {
            logger.debug(this.id + ".onKeyPress");
			if(this.inputBox.value && this.inputBox.value !== "") {
				this._setStyleText(this.spotlightlist, "display:block; min-width:"+this.searchFormNode.offsetWidth+"px;");
                this._buildTextList();
                this._directSearch();
			} else {
				this._setStyleText(this.spotlightlist, "display:none; min-width:"+this.searchFormNode.offsetWidth+"px;");
                this._setStyleText(this.spotlightsearchdiv, "display:none;");
                this.waitAvailable = true;
			}
		},
		////////////////////////////////////////////////////////////////////////////////////////////
		_setStyleText: function(posElem, content){
            if( typeof( posElem.style.cssText ) != 'undefined' ) {
                posElem.style.cssText = content;
            } else {
                posElem.setAttribute("style",content);
            }
        },
        ////////////////////////////////////////////////////////////////////////////////////////////
	 	executeMicroflow : function (mf, async, showProgress, guid, cb) {
            if (mf && this._contextObj) {
                console.log(this.id + ".executeMicroflow: " + mf);
                if (showProgress) {
                var isModal = true; var pid = mx.ui.showProgress(this.progressMsg, isModal);
                    }
                mx.data.action({
                    async : async,
                    params: {
                        actionname  : mf,
                        applyto     : "selection",
                        guids       : [guid],
                        
                    },
                    origin: this.mxform,
                    callback: function (objs) {
                        if (showProgress) {
                            mx.ui.hideProgress(pid);
                        }
                        if(cb) {
                            cb(objs);
                        }
                    },
                    error: function () {
                        logger.error(this.id + ".triggerMicroFlow: XAS error executing microflow");
                        if (showProgress) {   
                        mx.ui.hideProgress(pid);
                        }
                    }
                });
            }
        },
        // Reset subscriptions.
        _resetSubscriptions: function () {
            var _objectHandle = null,
                _attrHandle = null;

            // Release handles on previous object, if any.
            if (this._handles) {
                this._handles.forEach(function (handle, i) {
                    mx.data.unsubscribe(handle);
                });
                this._handles = [];
            }

            // When a mendix object exists create subscribtions. 
            if (this._contextObj) {
                _objectHandle = this.subscribe({
                    guid: this._contextObj.getGuid(),
                    callback: dojoLang.hitch(this, function (guid) {
                        this._updateRendering();
                    })
                });

                _attrHandle = this.subscribe({
                    guid: this._contextObj.getGuid(),
                    attr: this.inputValue,
                    callback: dojoLang.hitch(this, function (guid, attr, attrValue) {
                        this._updateRendering();
                    })
                });

                this._handles = [_objectHandle, _attrHandle];
            }
        }
    });
});

require(["SpotlightSearch/widget/SpotlightSearch"]);
