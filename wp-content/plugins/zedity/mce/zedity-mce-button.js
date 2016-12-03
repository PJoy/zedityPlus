(function() {
	tinymce.create('tinymce.plugins.Zedity', {
		init: function(ed,url){
			var t = this;
			t.premium = ed.getLang('zedity.premium')=='yes';
			t.url = url;
			t.ed = ed;
			t.bind = tinyMCE.dom.Event.bind ? 'bind' : 'add';

			ed.addButton('zedity', {
				title: 'Zedity Editor',
				cmd: 'startZedity',
				// NOTE: at the moment, the deploy scripts renames zedity-logo-premium.png into zedity-logo.png
				image: url + '/zedity-logo.png?' + this.getInfo().version
			});
			ed.addCommand('startZedity', function(){
				t._openZedity();
			});

			ed.onPreInit.add(function(){
				//be sure iframes and styles are allowed
				ed.schema.addValidElements('iframe[*],style[*]');
				//set zedity wrapper size when in visual editor (to show full overlay)
				ed.parser.addNodeFilter('div', function(nodes){
					for (var i=nodes.length-1; i>=0; --i) {
						if (!nodes[i].attributes.map.class || nodes[i].attributes.map.class.indexOf('zedity-iframe-wrapper')==-1) continue;
						if (!nodes[i].attributes.map['data-origw'] || !nodes[i].attributes.map['data-origh']) continue;
						nodes[i].attr({
							style: 'width:'+nodes[i].attributes.map['data-origw']+'px;height:'+nodes[i].attributes.map['data-origh']+'px'
						});
					}
				});
				//set zedity wrapper real css on save
				ed.serializer.addNodeFilter('div', function(nodes,name,args){
					for (var i=nodes.length-1; i>=0; --i) {
						if (!nodes[i].attributes.map.class || nodes[i].attributes.map.class.indexOf('zedity-iframe-wrapper')==-1) continue;
						if (!nodes[i].attributes.map['data-origw'] || !nodes[i].attributes.map['data-origh']) continue;
						nodes[i].attr({
							'data-mce-style': 'max-width:'+nodes[i].attributes.map['data-origw']+'px;max-height:'+nodes[i].attributes.map['data-origh']+'px'
						});
					}
				});
				//restore onclick on boxes with link
				ed.serializer.addNodeFilter('div', function(nodes,name,args){
					for (var i=nodes.length-1; i>=0; --i) {
						if (nodes[i].attributes.map['data-href'] && nodes[i].attributes.map['class'] && nodes[i].attributes.map['class'].indexOf('zedity-box')>-1) {
							nodes[i].attr({
								onclick: "window.open('"+nodes[i].attributes.map['data-href']+"','"+(nodes[i].attributes.map['data-target']||'_top')+"');"
							});
						}
					}
				});
			});

			//manage overlay
			ed.onInit.add(function(ed){
				//change node on click over zedity content (fixes iframe selection on Firefox)
				ed.dom.events[t.bind](ed.getBody(), 'mousedown', function(e){
					var element = t._getZedityElement(e.target);
					if (element) {
						ed.selection.select(element);
						ed.nodeChanged();
					}
				});
				//show overlay when caret goes inside zedity content
				ed.onNodeChange.add(function(ed,cm,n){
					if ((n.id=='mce_noneditablecaret') || (n.id=='zedity_content_overlay')) {
						ed.selection.select(t._zedityContent);
						return;
					}
					//keep track of node to avoid IE loop
					if (n==t.p_node) return;
					t.p_node = n;
					
					var element = t._getZedityElement(n);
					if (element) {
						t._showOverlay(element);
					} else {
						t._hideOverlay();
					}
				});
				//block enter key when overlay is open
				ed.onKeyDown.addToTop(function(ed,e){
					if (e.keyCode==13) {
						var n = tinymce.DOM.get('zedity_content_overlay');
						if (n) ed.dom.events.cancel(e);
					} else if (e.keyCode==46 || e.keyCode==8) {
						if (ed.selection.isCollapsed()) {
							var n = ed.selection.getNode();
							if (n.nodeName!='P') return;
							if (n.getAttribute('class') && n.getAttribute('class').indexOf('zedity')>-1) {
								ed.dom.events.cancel(e);
								return;
							}
							var nc = n.textContent;
							var empty = (nc.replace(/^\s+|\s+$/g, '') === '');
							if (empty) {
								tinymce.DOM.remove(n);
								ed.dom.events.cancel(e);
							}
						}
					}
				});
			});
		},
		createControl: function(n,cm){
			return null;
		},

		_openZedity: function(){
			this.ed.plugins.wordpress._hideButtons();
			var att_param = '';
			if (this._zedityContent) {
				//select content
				this.ed.selection.select(this._zedityContent.firstChild);
				//get post id if it is iframe
				var n = this._zedityContent;
				do {
					if (n.tagName=='IFRAME' && n.attributes.getNamedItem('data-id')) break;
				} while (n = n.firstChild);
				att_param = (n && n.attributes && n.attributes.getNamedItem('data-id')) ? '&att='+n.attributes.getNamedItem('data-id').value : '';
			}
			var url = 'admin-ajax.php?action=zedity_editor&post_id='+window.post_id+att_param;
			zedityLightbox.open(url);
			this.open = true;
		},

		_closeZedity: function(){
			var t = this;
			t.open = false;
			setTimeout(function(){
				try {
					t.ed.execCommand('mceFocus',false);
				} catch (e) {}
				if (!t._zedityContent) t._zedityContent = t._getZedityElement(t.ed.selection.getNode());
				t._showOverlay(t._zedityContent,true);
			},100);
		},

		_openTemplates: function(){
			//select content
			this.ed.plugins.wordpress._hideButtons();
			this.ed.selection.select(this._zedityContent.firstChild);
			tb_show(this.ed.getLang('zedity.copy_content_title'), 'admin-ajax.php?action=zedity_template&TB_iframe=true');
		},
		
		_getZedityElement: function(n){
			var s = ' '+(n.className||'')+' ';
			if ((s.indexOf(' zedity-editor ')>-1) || (s.indexOf(' zedity-wrapper ')>-1) || (s.indexOf(' zedity-iframe-wrapper ')>-1)) var node=n;
			return this.ed.dom.getParent(n,'div.zedity-wrapper') || this.ed.dom.getParent(n,'div.zedity-editor') || this.ed.dom.getParent(n,'div.zedity-iframe-wrapper') || node;
		},

		//-------------------------------------------------------------------------------
		//Manage overlay

		_showOverlay: function(n,forced){
			if (!n) return;
			if (this.open) return;
			if (this._zedityContent==n && !forced) return;
			
			var ed = this.ed;
			var overlay = ed.dom.get('zedity_content_overlay');
			if (!overlay) overlay = this._createOverlay();

			ed.plugins.wordpress._hideButtons();
			var rect = ed.dom.getRect(n);
			ed.dom.setStyles(overlay, {
				top: rect.y,
				left: rect.x,
				width: Math.max(rect.w,110),
				height: Math.max(rect.h,40)
			});
			
			if (!this.premium) {
				//free plugin: don't allow editing premium content, show message
				var pc = ed.dom.hasClass(n,'zedity-premium') ? [n] : ed.dom.select('.zedity-premium',n);
				ed.dom.setStyles(ed.dom.select('.zedity_button'), {display: (pc.length ? 'none' : 'inline')});
				ed.dom.setStyles('zedity_premium_msg', {display: (pc.length ? 'block' : 'none')});
				ed.controlManager.setDisabled('zedity',!!pc.length);
			}
			
			this._zedityContent = n;
			ed.selection.select(n);
		},
		
		_hideOverlay: function(){
			var overlay = this.ed.dom.get('zedity_content_overlay');
			if (overlay) this.ed.dom.remove(overlay);
			this._zedityContent = null;
			this.ed.controlManager.setDisabled('zedity',false);
			return;
		},
		
		_createOverlay: function(){
			var t = this;
			var ed = this.ed;
			if (tinymce.DOM.get('zedity_content_overlay')) return;
			
			var overlay = ed.dom.create('div',{
				id: 'zedity_content_overlay',
				'data-mce-bogus': 'all',
				contenteditable: false
			});
			ed.getBody().appendChild(overlay);

			//Edit button
			var zEditButton = ed.dom.create('img',{
				src: t.url+'/zedity-logo.png?' + this.getInfo().version,
				id: 'zedity_button_edit',
				class: 'zedity_button',
				width: '24',
				height: '24',
				title: ed.getLang('zedity.edit_content'),
				'data-mce-bogus': 'all',
				contenteditable: false
			});
			tinymce.dom.Event[t.bind](zEditButton, 'mousedown', function(e){
				t._openZedity();
				ed.dom.events.cancel(e);
			});
			overlay.appendChild(zEditButton);
			
			//Copy button
			var zCopyButton = ed.dom.create('img',{
				src: t.url+'/editcopy.png?' + this.getInfo().version,
				id: 'zedity_button_copy',
				class: 'zedity_button',
				width: '24',
				height: '24',
				title: ed.getLang('zedity.copy_content'),
				'data-mce-bogus': 'all',
				contenteditable: false
			});
			tinymce.dom.Event[t.bind](zCopyButton, 'mousedown', function(e){
				t._openTemplates();
				ed.dom.events.cancel(e);
			});
			overlay.appendChild(zCopyButton);

			//Delete button
			var zDelButton = ed.dom.create('img',{
				src: t.url+'/delete.png',
				id: 'zedity_button_del',
				class: 'zedity_button',
				width: '24',
				height: '24',
				title: ed.getLang('zedity.delete_content'),
				'data-mce-bogus': 'all',
				contenteditable: false
			});
			tinymce.dom.Event[t.bind](zDelButton, 'mousedown', function(e){
				var n = t._zedityContent;
				//if is the inner content, get the outer wrapper
				if (tinymce.DOM.hasClass(n,'zedity-iframe-wrapper') || tinymce.DOM.hasClass(n,'zedity-editor')) {
					n = ed.dom.getParent(n,'div.zedity-wrapper');
				}
				t._hideOverlay();
				ed.selection.select(n);
				try {
					ed.execCommand('mceStartTyping','');
				} catch (e) {}
				tinymce.DOM.remove(ed.selection.getNode());
				try {
					ed.execCommand('mceEndTyping','');
				} catch (e) {}
				ed.dom.events.cancel(e);
			});
			overlay.appendChild(zDelButton);
			
			if (!t.premium) {
				//free plugin: add premium warning message
				var zPremium = ed.dom.create('div',{
					id: 'zedity_premium_msg',
					'data-mce-bogus': 'all',
					contenteditable: false
				},ed.getLang('zedity.need_premium'));
				overlay.appendChild(zPremium);
			}
			return overlay;
		},
		
		getInfo: function(){
			return {
				longname: 'Zedity Editor',
				author: 'Pridea Company',
				authorurl: 'https://zedity.com',
				infourl: 'https://zedity.com/blog',
				version: '4.3'
			};
		}
	});

	// Register plugin
	tinymce.PluginManager.add('zedity', tinymce.plugins.Zedity);
})();
