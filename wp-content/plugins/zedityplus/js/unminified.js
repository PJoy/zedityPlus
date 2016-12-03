/***
 Copyright (C) 2013-2015 Pridea Company - http://pridea.it

 This file is part of the Zedity library, available at http://zedity.com/

 The library is distributed under the terms of the Zedity free License, which is
 available at http://zedity.com/license/free/, and WITHOUT ANY WARRANTY; without
 even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
 ***/

var Zedity=Zedity|| {}

    ;
(function($) {
        Zedity=function(options) {
            this.$container=null;
            this.$this=null;
            this._options=$.extend( {
                    container: '#Editor,#editor', language: window.ZedityLang||'en', width: 800, height: 550, minWidth: 150, minHeight: 150, maxWidth: 3000, maxHeight: 10000, maxTotalBoxes: undefined, content: '', undoSteps: 5, resizable: true, userResizable: true, snapBoxes: false, snapPage: false, snapGrid: false, onchange: null, onselect: null, onerror: null
                }
                , options);
            Zedity.i18n.set(this._options.language, true);
            for(var i=Zedity.requires.length-1;
                i>=0;
                --i) {
                if(Zedity.core.supports.hasOwnProperty(Zedity.requires[i])&&!Zedity.core.supports[Zedity.requires[i]]())throw new Error(Zedity.t('Browser does not support required feature "%s".', Zedity.requires[i]))
            }
            this.$container=$(this._options.container);
            if(this.$container.length==0)throw new Error(Zedity.t('Could not initialize %s. Container not found.', 'Zedity'));
            this.$container.data('zedity-editor', this);
            this.boxes.editor=this;
            Zedity.editors.push(this);
            this.editor=this;
            this._data= {
                internal: 0, locked: 0, lockmessage: []
            }
            ;
            this.menu= {
                _data: {}
                , add:function() {}
                , refresh:function() {}
            }
            ;
            if(!Zedity.Page)throw new Error(Zedity.t('%s needs %s.', 'Zedity', 'Zedity.Page'));
            this.page=new Zedity.Page( {
                    editor: this, width: this._options.width, height: this._options.height, minWidth: this._options.minWidth, minHeight: this._options.minHeight, maxWidth: this._options.maxWidth, maxHeight: this._options.maxHeight, content: this._options.content
                }
            );
            this.menu=new Zedity.Ribbon($.extend( {
                    editor: this
                }
                , this._options.ribbon));
            this.contextMenu=new Zedity.ContextMenu( {
                    editor: this
                }
            );
            this.$container.append($('<div/>', {
                    'class': 'zedity-lock'
                }
            ));
            this.init();
            this._changed();
            this.step=0;
            Zedity.core.keys._bind();
            Zedity.core.shortcuts.add('ctrl+z meta+z', this, function(event) {
                    this.undo()
                }
                , true);
            Zedity.core.shortcuts.add('ctrl+y meta+y', this, function(event) {
                    this.redo()
                }
                , true);
            this.$this.on('click.zedity touchend.zedity', '.zedity-empty .zedity-button', function() {
                    var box=$(this).closest('.zedity-box').box();
                    if(!box)return;
                    if(box.editor.responsive&&box.editor.responsive.current&&box.editor.responsive.current!=box._data.ownerlayout)return false;
                    box.insert()
                }
            )
        }
        ;
        $.extend(Zedity.prototype, {
                _changed:function() {
                    if(this._data.internal)return this;
                    clearTimeout(this._data.changedEventTimer);
                    if(!this._data.undoing&&!this._data.savingundo) {
                        var self=this;
                        this._data.changedEventTimer=setTimeout(function() {
                                if(self.menu)self.menu.refresh();
                                self.page._saveUndo();
                                if(typeof(self._options.onchange)=='function')self._options.onchange.call(self)
                            }
                            , 400)
                    }
                    return this
                }
                , element:function() {
                    this.$this=this.$container.find('.zedity-editor');
                    return this.$this
                }
                , options:function(options) {
                    this._options=$.extend(this._options, options);
                    return this._options
                }
                , _error:function(error) {
                    if(this._data.internal>0)return;
                    error=$.extend( {
                            code: 0, type: 'ERROR', message: 'Zedity error.'
                        }
                        , error);
                    if(window.console)window.console.log(error);
                    if(typeof(this._options.onerror)=='function') {
                        this._options.onerror.call(this, error)
                    }
                    else {
                        if(error.type=='ERROR')alert(error.message)
                    }
                }
                , _getSnap:function() {
                    var snap=[];
                    if(this._options.snapPage)snap.push('.zedity-editor');
                    if(this._options.snapBoxes)snap.push('.zedity-box:not(.zedity-background)');
                    return snap.join(',')
                }
                , boxes: {
                    $selected:null, _boxes:[], _getFromId:function(id) {
                        for(var i=this._boxes.length-1;
                            i>=0;
                            --i) {
                            if(this._boxes[i].id==id||'#'+this._boxes[i].id==id) {
                                return this._boxes[i]
                            }
                        }
                    }
                    , _select:function(box) {
                        if(box!=null&&box.$this.hasClass('zedity-selected')) {
                            if(box.asBackground())this._select(null);
                            return box
                        }
                        var multiselect=Zedity.core.keys.state.ctrl||Zedity.core.keys.state.meta;
                        this.editor.$this.children('.zedity-box').each(function(idx, elem) {
                                var $elem=$(this);
                                $elem.box().stop();
                                if(!multiselect)$elem.removeClass('zedity-selected');
                                if($elem.data('ui-resizable'))$elem.resizable('destroy');
                                if($elem.data('ui-rotatable'))$elem.rotatable('destroy')
                            }
                        );
                        this.editor.boxes.$selected=!box||multiselect?null:box.$this;
                        if(box) {
                            box.$this.addClass('zedity-selected');
                            if(!box.asBackground()) {
                                box._initDrag()
                            }
                            else {
                                if(multiselect)box.$this.removeClass('zedity-selected')
                            }
                        }
                        if(this.editor.menu)this.editor.menu.refresh();
                        if(multiselect) {
                            if(typeof(this.editor._options.onselect)=='function')this.editor._options.onselect.call(this, null);
                            return box
                        }
                        if(box&&!box.$this.hasClass('zedity-background')) {
                            box.$this.resizable($.extend( {
                                    handles:'se', reposition:true, minWidth:box._sizeLimits().minWidth, maxWidth:box._sizeLimits().maxWidth, minHeight:box._sizeLimits().minHeight, maxHeight:box._sizeLimits().maxHeight, start:function(e, ui) {}
                                    , stop:function(e, ui) {
                                        var editor=$(this).editor();
                                        editor.boxes.selected().reposition()._resize();
                                        editor._changed();
                                        editor.boxes.refreshSelected()
                                    }
                                    , resize:function() {}
                                }
                                , box.rotation()==0? {
                                    snapTolerance: 12, snap: this.editor._getSnap(), snapToGrid: this.editor.grid&&this.editor.grid.show()
                                }
                                    : {}
                            ));
                            if(box.can('rotation')) {
                                box.$this.rotatable( {
                                        snaps:[0, 45, 90, 135, 180, 225, 270, 315, 360], snapTolerance:3, start:function() {}
                                        , stop:function(event, ui) {
                                            var editor=$(this).editor();
                                            editor.boxes.selected();
                                            editor._changed();
                                            editor.boxes.refreshSelected()
                                        }
                                    }
                                )
                            }
                        }
                        if(typeof(this.editor._options.onselect)=='function')this.editor._options.onselect.call(this, box);
                        return box
                    }
                    , refreshSelected:function() {
                        var sel=this.selected();
                        if(!sel)return null;
                        this._select(null);
                        sel.select();
                        return sel
                    }
                    , get:function(idx) {
                        var uidx=Zedity.core.store.get('zedUnIndex');
                        var ids=Zedity.core.store.get('zedUnRef'+uidx);
                        var list=[];
                        if(ids) {
                            ids=ids.split(' ');
                            for(var i=ids.length-1;
                                i>=0;
                                --i) {
                                list.push(this._getFromId(ids[i]))
                            }
                        }
                        if(idx==null) {
                            return list
                        }
                        else if(typeof idx=='string'||idx instanceof String) {
                            if(Zedity.Box.types.indexOf(idx)>-1) {
                                var sub=[];
                                for(var i=list.length-1;
                                    i>=0;
                                    --i) {
                                    if(list[i].type==idx) {
                                        sub.push(list[i])
                                    }
                                }
                                return sub
                            }
                            else {
                                for(var i=list.length-1;
                                    i>=0;
                                    --i) {
                                    if(list[i].id==idx||'#'+list[i].id==idx) {
                                        return list[i]
                                    }
                                }
                                return null
                            }
                        }
                        else {
                            return list[(idx+list.length)%list.length]
                        }
                    }
                    , count:function() {
                        var uidx=Zedity.core.store.get('zedUnIndex');
                        var ids=Zedity.core.store.get('zedUnRef'+uidx);
                        ids=ids.split(' ');
                        return ids.length+1
                    }
                    , selected:function() {
                        var $sel=this.editor.$this.children('.zedity-selected');
                        if($sel.length==0)$sel=this.$selected;
                        if(!$sel||$sel.length!=1)return null;
                        return this._getFromId($sel.attr('id'))
                    }
                    , add:function(type, options) {
                        if(Zedity.Box.types.indexOf(type)==-1) {
                            this.editor._error( {
                                    message: Zedity.t('Box type "%s" doesn\'t exist.', type)
                                }
                            );
                            return null
                        }
                        try {
                            var box=new Zedity.Box[type]($.extend( {
                                    editor: this.editor
                                }
                                , options))
                        }
                        catch(e) {
                            this.editor._error( {
                                    message: Zedity.t('Error during box creation: %s.', e.message)
                                }
                            );
                            return null
                        }
                        this._boxes.push(box);
                        box.reposition(true).select();
                        Zedity.core._call(box, 'arrange', 'front');
                        if(!options||(options.id==null&&options.element==null))this.editor._changed();
                        return box
                    }
                    , background:function() {
                        var boxes=this.get();
                        for(var i=boxes.length-1;
                            i>=0;
                            --i) {
                            if(boxes[i].$this.hasClass('zedity-background')) {
                                return boxes[i]
                            }
                        }
                        return null
                    }
                }
                , undo:function() {
                    this.page._undo();
                    return this
                }
                , redo:function() {
                    this.page._redo();
                    return this
                }
                , save:function(callback, options) {
                    options=$.extend( {
                            removeEmpty: true, formatHtml: false, finalize: true
                        }
                        , options);
                    this.lock('<p>'+Zedity.t('Saving content.')+'<br/>'+Zedity.t('Please wait...')+'</p>');
                    if(this.$this.attr('data-href')) {
                        this.$this.attr('onclick', 'window.open(\''+this.$this.attr('data-href')+'\',\''+(this.$this.attr('data-target')||'_top')+'\');');
                        this.$this.css('cursor', 'pointer')
                    }
                    this.boxes._select(null);
                    var saveq=$( {}
                    );
                    this._data.saveq=saveq;
                    var list=this.boxes.get();
                    $.each(list, function(idx, box) {
                            saveq.queue('save', function(next) {
                                    box._save(function() {
                                            next()
                                        }
                                        , options)
                                }
                            )
                        }
                    );
                    saveq.queue('save', $.proxy(function(next) {
                            var content=this.page._getPage(options.removeEmpty);
                            Zedity.core.patterns.add('data-zedcssbuffer', 'style');
                            content=Zedity.core.patterns.substitute(content);
                            this.page._setPage(content);
                            this.page._saveUndo();
                            this.unlock();
                            if(options.formatHtml)content=Zedity.utils.formatHtml(content);
                            if(typeof(callback)=='function')callback.call(this, content);
                            this._data.saveq=null;
                            next()
                        }
                        , this));
                    setTimeout(function() {
                            saveq.dequeue('save')
                        }
                        , 10);
                    return this
                }
                , _setLockMessage:function(message) {
                    if(message==null)message=this._data.lockmessage.pop();
                    if(message) {
                        message='<div class="zedity-message">'+message+'</div>'
                    }
                    this.$container.find('.zedity-lock').css('width', this.$container.outerWidth()).html(message||'');
                    return this
                }
                , lock:function(message) {
                    if(this._data.locked>0) {
                        this._data.lockmessage.push(this.$container.find('.zedity-lock .zedity-message').html())
                    }
                    this._data.locked++;
                    $('body').trigger('click.zedity');
                    $('.zedity-dialog > .ui-dialog-content').dialog('close');
                    this._setLockMessage(message||'');
                    this.$container.addClass('zedity-locked').find('.zedity-lock').show().focus();
                    return this
                }
                , unlock:function() {
                    if(--this._data.locked>0) {
                        this._setLockMessage();
                        return
                    }
                    this._data.locked=0;
                    this.$container.removeClass('zedity-locked').find('.zedity-lock').hide();
                    return this
                }
                , init:function() {
                    this.$this=this.element();
                    var self=this;
                    this.$this.on('mousedown.zedity', function(event) {
                            var $this=$(this);
                            var editor=$this.editor();
                            if(!$(event.target).is(editor.$this))return;
                            editor.boxes._select(null)
                        }
                    );
                    $(document).off('mousedown.zedity').on('mousedown.zedity', function(event) {
                            if($(event.target).closest('.zedity-contextmenu').length>0)return;
                            if(self.contextMenu)self.contextMenu.close();
                            if($(event.target).closest('.zedity-box.zedity-editing,.zedity-box.zedity-playing').length>0)return;
                            if($(event.target).closest('.zedity-ribbon,.zedity-tutorial-overlay').length>0)return;
                            if($(event.target).closest('.zedity-dialog,.ui-widget-overlay,.zedity-tooltip,.ui-tooltip,.zedity-ddmenu').length>0)return;
                            self.$this.find('.zedity-box.zedity-editing,.zedity-box.zedity-playing').each(function() {
                                    $(this).box().stop()
                                }
                            )
                        }
                    );
                    return this
                }
            }
        );
        Zedity.requires=['storage', 'css'];
        Zedity.editors=[]
    }

)(jQuery);
(function($) {
        $.fn=$.fn|| {}
        ;
        $.fn.editor=function() {
            return $(this).closest('.zedity-editor-container').data('zedity-editor')
        }
        ;
        $.fn.box=function() {
            var $box=$(this).closest('.zedity-editor .zedity-box');
            if($box.length==0)return null;
            return $box.editor().boxes._getFromId($box.attr('id'))
        }
        ;
        $.fn.zdata=function(key, value) {
            var $this=$(this);
            var data=$this.attr('data-zed');
            if(value===undefined) {
                if(!data)return null;
                if(key==null) {
                    return JSON.parse(data)
                }
                else {
                    data=JSON.parse(data);
                    return data[key]
                }
            }
            else {
                data=JSON.parse(data||'{}');
                var ret=data[key];
                if(value===null) {
                    delete data[key]
                }
                else {
                    data[key]=value
                }
                $this.attr('data-zed', JSON.stringify(data));
                return ret
            }
        }
        ;
        $.widget('ui.menuZedity', $.ui.menu, {
                delay:10, position: {
                    my: 'left top', at: 'left bottom'
                }
                , subposition: {
                    my: 'left top', at: 'right top'
                }
                , _open:function(submenu) {
                    var position=this.active.parents('.ui-menubar').length==0?this.position: this.subposition;
                    position=$.extend( {
                            of: this.active
                        }
                        , position);
                    clearTimeout(this.timer);
                    this.element.find('.ui-menu').not(submenu.parents('.ui-menu')).hide().attr('aria-hidden', 'true');
                    submenu.show().removeAttr('aria-hidden').attr('aria-expanded', 'true').position(position)
                }
                , _setOption:function(key, value) {
                    this[key]=value
                }
            }
        )
    }

)(jQuery);
var Zedity=Zedity|| {}

    ;
(function($) {
        Zedity.i18n= {
            language:null, languages: {}
            , set:function(lang, clear) {
                this.language=lang;
                if(clear) {
                    for(var i in this.languages) {
                        if(i!=lang)delete(this.languages[i])
                    }
                }
            }
            , translate:function(str, replacements) {
                if(this.languages[this.language]&&this.languages[this.language][str]) {
                    str=this.languages[this.language][str]
                }
                var i=1;
                var args=arguments;
                return str.replace(/%s/g, function(m) {
                        return m[2]||args[i++]
                    }
                )
            }
            , add:function(language, definition, force) {
                if(force||!this.language||this.language==language) {
                    this.languages[language]=definition
                }
            }
        }
        ;
        Zedity.t=function() {
            return Zedity.i18n.translate.apply(Zedity.i18n, arguments)
        }
    }

)(jQuery);
var Zedity=Zedity|| {}

    ;
Zedity.version='2.1.0';
Zedity.core=Zedity.core|| {}

;
(function($) {
        Zedity.core.genId=function(prefix) {
            prefix=prefix||'';
            var id;
            var i=0;
            do {
                id=prefix+'_'+Math.floor(Math.random()*1000000000).toString(36)+(new Date()).getUTCMilliseconds().toString(36);
                if(++i>=1000000)throw Error(Zedity.t('Error in generating unique id.'))
            }
            while($('#'+id).length>0);
            return id
        }
        ;
        Zedity.core._call=function(object, method, args) {
            if(!object||!method||!(method in object))throw new Error(Zedity.t('Improper internal call.'));
            object.editor._data.internal++;
            var ret=object[method].apply(object, [].splice.call(arguments, 2));
            object.editor._data.internal--;
            return ret
        }
        ;
        Zedity.core._later=function(context, func, delay) {
            return setTimeout($.proxy(func, context), delay||0)
        }
        ;
        Zedity.core.supports= {
            canvas:function() {
                return!!document.createElement('canvas').getContext
            }
            , fileapi:function() {
                return(typeof(FileReader)!='undefined')
            }
            , storage:function() {
                try {
                    return(('localStorage'in window)&&(window['localStorage']!==null))
                }
                catch(e) {
                    return false
                }
            }
            , historystate:function() {
                return('pushState'in window.history)
            }
            , xhr2:function() {
                return('XMLHttpRequest'in window)&&('upload'in(new XMLHttpRequest()))
            }
            , selection:function() {
                return('getSelection'in window)
            }
            , gradient:function() {
                var css="background-image:linear-gradient(left,rgba(255,255,255,1) 0%,rgba(0,0,0,1) 100%);background-image:-o-linear-gradient(left,rgba(255,255,255,1) 0%,rgba(0,0,0,1) 100%);background-image:-ms-linear-gradient(left,rgba(255,255,255,1) 0%,rgba(0,0,0,1) 100%);background-image:-moz-linear-gradient(left,rgba(255,255,255,1) 0%,rgba(0,0,0,1) 100%);background-image:-webkit-linear-gradient(left,rgba(255,255,255,1) 0%,rgba(0,0,0,1) 100%);";
                var element=$('<div/>');
                try {
                    element.attr('style', css)
                }
                catch(e) {}
                return element[0].style.backgroundImage.indexOf('linear-gradient')>-1
            }
            , touch:function() {
                return'ontouchend'in document
            }
            , css:function(detailed) {
                var style=document.documentElement.style;
                var tests= {
                        opacity: ((style.opacity!==undefined)||(style.filter!==undefined)||false), transform: ((style.transform!==undefined)||(style.MozTransform!==undefined)||(style.webkitTransform!==undefined)||(style.msTransform!==undefined)||(style.oTransform!==undefined)||(style.OTransform!==undefined)||false), borderRadius: ((style.borderRadius!==undefined)||(style.MozBorderRadius!==undefined)||(style.webkitBorderRadius!==undefined)||(style.oBorderRadius!==undefined)||(style.OBorderRadius!==undefined)||false), boxShadow: ((style.boxShadow!==undefined)||(style.MozBoxShadow!==undefined)||(style.webkitBoxShadow!==undefined)||(style.oBoxShadow!==undefined)||(style.OBoxShadow!==undefined)||false), backgroundSize: ((style.backgroundSize!==undefined)||(style.MozBackgroundSize!==undefined)||(style.webkitBackgroundSize!==undefined)||(style.oBackgroundSize!==undefined)||(style.OBackgroundSize!==undefined)||false), minimum: false, all: false
                    }
                    ;
                tests.minimum=(tests.opacity&&tests.transform&&tests.backgroundSize);
                tests.all=(tests.opacity&&tests.transform&&tests.borderRadius&&tests.boxShadow&&tests.backgroundSize);
                return(detailed?tests:tests.all)
            }
            , minimum:function() {
                return(this.canvas()&&this.storage()&&this.css(true).minimum)
            }
        }
        ;
        Zedity.core.keys= {
            state: {}
            , _getKey:function(keyCode) {
                var key;
                if(Zedity.core.keys._keyCodes.hasOwnProperty(keyCode)) {
                    key=Zedity.core.keys._keyCodes[keyCode]
                }
                else if((keyCode>=48&&keyCode<=57)||(keyCode>=65&&keyCode<=90)) {
                    key=String.fromCharCode(keyCode).toLowerCase()
                }
                return key
            }
            , _bind:function() {
                function swapKV(input) {
                    var output= {
                            112: 'f1', 113: 'f2', 114: 'f3', 115: 'f4', 116: 'f5', 117: 'f6', 118: 'f7', 119: 'f8', 120: 'f9', 121: 'f10', 122: 'f11', 123: 'f12'
                        }
                        ;
                    for(var key in input) {
                        if(input.hasOwnProperty(key)) {
                            output[input[key]]=key.toString().replace('_', '').toLowerCase()
                        }
                    }
                    return output
                }
                ;
                Zedity.core.keys._keyCodes=swapKV($.ui.keyCode);
                $(document).off('keydown.zedity').on('keydown.zedity', function(event) {
                        var key=Zedity.core.keys._getKey(event.keyCode||event.which);
                        if(key)Zedity.core.keys.state[key]=true;
                        Zedity.core.keys.state['ctrl']=event.ctrlKey;
                        Zedity.core.keys.state['alt']=event.altKey;
                        Zedity.core.keys.state['shift']=event.shiftKey;
                        Zedity.core.keys.state['meta']=event.metaKey;
                        return!Zedity.core.shortcuts.test(event)
                    }
                ).off('keyup.zedity').on('keyup.zedity', function(event) {
                        var key=Zedity.core.keys._getKey(event.keyCode||event.which);
                        if(key)Zedity.core.keys.state[key]=false;
                        Zedity.core.keys.state['ctrl']=event.ctrlKey;
                        Zedity.core.keys.state['alt']=event.altKey;
                        Zedity.core.keys.state['shift']=event.shiftKey;
                        Zedity.core.keys.state['meta']=event.metaKey
                    }
                )
            }
            , _unbind:function() {
                $(document).off('keydown.zedity').off('keyup.zedity')
            }
        }
        ;
        Zedity.core.shortcuts= {
            _shortcuts:[], _checkKeys:function(keys) {
                keys=keys.split(/[\+\-]/);
                for(var i=keys.length-1;
                    i>=0;
                    --i) {
                    if(!Zedity.core.keys.state[keys[i]])return false
                }
                for(i in Zedity.core.keys.state) {
                    if(Zedity.core.keys.state.hasOwnProperty(i)&&keys.indexOf(i)==-1&&Zedity.core.keys.state[i]) {
                        return false
                    }
                }
                return true
            }
            , test:function(event) {
                var handled=false;
                for(var i=this._shortcuts.length-1;
                    i>=0;
                    --i) {
                    if(this._checkKeys(this._shortcuts[i].keys)) {
                        if(this._shortcuts[i].disableoninput) {
                            var $elem=$(event.target);
                            if($elem.is('input')||$elem.is('textarea')||$elem.attr('contenteditable'))return
                        }
                        var ret=this._shortcuts[i].action.call(this._shortcuts[i].target, event);
                        if(!handled&&ret)handled=true
                    }
                }
                return handled
            }
            , add:function(shortcut, target, action, disableoninput) {
                var shortcuts=shortcut.split(' ');
                for(var i=shortcuts.length-1;
                    i>=0;
                    --i) {
                    this._shortcuts.push( {
                            keys: shortcuts[i], target: target, action: action, disableoninput: disableoninput
                        }
                    )
                }
            }
        }
        ;
        Zedity.core.store= {
            storage:sessionStorage, get:function(key, storage) {
                try {
                    return(storage||this.storage).getItem(key)
                }
                catch(e) {
                    return undefined
                }
            }
            , set:function(key, value, storage) {
                try {
                    (storage||this.storage).setItem(key, value)
                }
                catch(e) {}
            }
            , del:function(key, storage) {
                try {
                    (storage||this.storage).removeItem(key)
                }
                catch(e) {}
            }
            , clear:function(key, storage) {
                try {
                    (storage||this.storage).clear()
                }
                catch(e) {}
            }
            , length:function(storage) {
                try {
                    return(storage||this.storage).length
                }
                catch(e) {
                    return 0
                }
            }
            , key:function(num, storage) {
                try {
                    return(storage||this.storage).key(num)
                }
                catch(e) {
                    return null
                }
            }
            , delprefix:function(prefix, storage) {
                var all=this.getprefix(prefix, storage);
                for(var i=all.length-1;
                    i>=0;
                    --i) {
                    this.del(all[i])
                }
            }
            , getprefix:function(prefix, storage) {
                var all=[];
                try {
                    prefix=prefix||'';
                    for(var i=this.length(storage)-1;
                        i>=0;
                        --i) {
                        var key=this.key(i, storage);
                        if(key.substr(0, prefix.length)==prefix) {
                            all.push(key)
                        }
                    }
                }
                catch(e) {}
                return all
            }
            , push:function(key) {
                try {
                    localStorage.setItem(key, sessionStorage.getItem(key))
                }
                catch(e) {}
            }
            , pop:function(key) {
                try {
                    var value=localStorage.getItem(key);
                    if(value)sessionStorage.setItem(key, value);
                    localStorage.removeItem(key)
                }
                catch(e) {}
            }
        }
        ;
        Zedity.core.gc= {
            name:'zedGc', getData:function(name) {
                return JSON.parse(Zedity.core.store.get(name||this.name)||'{}')
            }
            , setData:function(data, name) {
                Zedity.core.store.set(name||this.name, JSON.stringify(data))
            }
            , flushData:function(name) {
                Zedity.core.store.del(name||this.name)
            }
            , addReference:function(ref, name) {
                var data=this.getData(name);
                if(typeof ref==='string')ref=$.trim(ref).split(' ');
                if($.isArray(ref)) {
                    for(var i=ref.length-1;
                        i>=0;
                        --i) {
                        if(ref[i]!='') {
                            if(data[ref[i]]) {
                                data[ref[i]]++
                            }
                            else {
                                data[ref[i]]=1
                            }
                        }
                    }
                    this.setData(data, name)
                }
            }
            , removeReference:function(ref, name) {
                var data=this.getData(name);
                if(typeof ref==='string')ref=ref.split(' ');
                if($.isArray(ref)) {
                    for(var i=ref.length-1;
                        i>=0;
                        --i) {
                        if(ref[i]!='') {
                            if(!data[ref[i]])data[ref[i]]=0;
                            if(data[ref[i]]>0)data[ref[i]]--
                        }
                    }
                    this.setData(data, name)
                }
            }
            , deleteReference:function(ref, name) {
                var data=this.getData(name);
                if(typeof ref==='string')ref=ref.split(' ');
                if($.isArray(ref)) {
                    for(var i=ref.length-1;
                        i>=0;
                        --i) {
                        if(data.hasOwnProperty(ref[i]))delete data[ref[i]]
                    }
                    this.setData(data, name)
                }
            }
            , getReferenced:function(name) {
                var data=this.getData(name);
                var list=[];
                for(var i in data) {
                    if(data[i]>0)list.push(i)
                }
                return list
            }
            , getNonReferenced:function(name) {
                var data=this.getData(name);
                var list=[];
                for(var i in data) {
                    if(data[i]<=0)list.push(i)
                }
                return list
            }
        }
        ;
        Zedity.core.selection= {
            _paragraphs:'p,h1,h2,h3,h4,h5,h6,pre,div', _elements:'b,i,u,strong,em,a,sub,sup', _savedRange:undefined, _getRange:function() {
                try {
                    return window.getSelection().getRangeAt(0)
                }
                catch(e) {
                    return undefined
                }
            }
            , save:function() {
                this._savedRange=this._getRange();
                return this._savedRange
            }
            , restore:function(range) {
                range=range||this._savedRange;
                if(!range)return;
                var sel=window.getSelection();
                sel.removeAllRanges();
                sel.addRange(range);
                return range
            }
            , unselect:function() {
                if(document.selection) {
                    document.selection.empty()
                }
                else {
                    window.getSelection().removeAllRanges()
                }
            }
            , selected:function() {
                return!window.getSelection().isCollapsed
            }
            , expand:function(onlyifcollapsed) {
                if(onlyifcollapsed&&this.selected())return;
                try {
                    this.selectElement(this.getElement())
                }
                catch(e) {}
            }
            , selectText:function(element) {
                var selection=window.getSelection();
                var range=document.createRange();
                range.selectNodeContents(element);
                selection.removeAllRanges();
                selection.addRange(range)
            }
            , selectElement:function(element) {
                var selection=window.getSelection();
                var range=document.createRange();
                range.selectNode(element);
                selection.removeAllRanges();
                selection.addRange(range)
            }
            , selectElements:function(elements) {
                var selection=window.getSelection();
                var range=document.createRange();
                range.setStartBefore(elements.get(0));
                range.setEndAfter(elements.get(elements.length-1));
                selection.removeAllRanges();
                selection.addRange(range)
            }
            , insertTextAtCursor:function(text) {
                var range=this._getRange();
                range.deleteContents();
                range.insertNode(document.createTextNode(text))
            }
            , insertHtmlAtCursor:function(html) {
                var el=document.createElement('div');
                el.innerHTML=html;
                var frag=document.createDocumentFragment();
                var node;
                while(node=el.firstChild) {
                    frag.appendChild(node)
                }
                var range=this._getRange();
                range.deleteContents();
                range.insertNode(frag)
            }
            , insertElementAtCursor:function(element) {
                var range=this._getRange();
                range.insertNode(element)
            }
            , setCursorPosition:function(element, pos) {
                var sel=window.getSelection();
                sel.collapse(element.firstChild, pos)
            }
            , isNodeInSelection:function(node) {
                var range=this._getRange();
                if(range.intersectsNode) {
                    return range.intersectsNode(node)
                }
                else {
                    var nodeRange=node.ownerDocument.createRange();
                    try {
                        nodeRange.selectNode(node)
                    }
                    catch(e) {
                        nodeRange.selectNodeContents(node)
                    }
                    return range.compareBoundaryPoints(Range.END_TO_START, nodeRange)==-1&&range.compareBoundaryPoints(Range.START_TO_END, nodeRange)==1
                }
            }
            , getElement:function() {
                var range=this._getRange();
                if(!range)return null;
                try {
                    if(range.parentElement) {
                        return range.parentElement()
                    }
                    else if(range.commonAncestorContainer) {
                        var container=range.commonAncestorContainer;
                        return container.nodeType===3?container.parentNode: container
                    }
                    else {
                        return null
                    }
                }
                catch(e) {
                    return null
                }
            }
            , getElements:function() {
                var range=this._getRange();
                if(!range)return[];
                var containerElement=range.commonAncestorContainer;
                if(containerElement.nodeType!=1)containerElement=containerElement.parentNode;
                var treeWalker=window.document.createTreeWalker(containerElement, NodeFilter.SHOW_ELEMENT, $.proxy(function(node) {
                        return this.isNodeInSelection(node)?NodeFilter.FILTER_ACCEPT: NodeFilter.FILTER_REJECT
                    }
                    , this), false);
                var list=[treeWalker.currentNode];
                while(treeWalker.nextNode()) {
                    list.push(treeWalker.currentNode)
                }
                return list
            }
            , findElements:function(selector) {
                var list=this.getElements();
                var ret=[];
                $(list).each(function() {
                        if($(this).is(selector))ret.push(this)
                    }
                );
                return ret
            }
            , getParagraph:function() {
                var elem=this.getElement();
                if(!elem)return null;
                var $elem=$(elem);
                $elem=$elem.closest(this._paragraphs);
                if($elem.length==0)return null;
                if($elem.is('.zedity-content')) {
                    $elem=$elem.children(this._paragraphs).first()
                }
                if($elem.is('.zedity-box')||$elem.find('.zedity-box,.zedity-content').length>0)return null;
                return $elem.get(0)
            }
            , getParagraphs:function() {
                var elems=this.getElements();
                var ret=[];
                $.each(elems, $.proxy(function(idx, elem) {
                        var $elem=$(elem).closest(this._paragraphs);
                        if(($elem.length==0)||$elem.is('.zedity-box,.zedity-content')||$elem.find('.zedity-box,.zedity-content').length>0)return;
                        ret.push($elem.get(0))
                    }
                    , this));
                return ret
            }
            , setParagraph:function(ptype) {
                ptype=ptype||'p';
                window.getSelection().collapseToStart();
                var par=this.getParagraph();
                if(!par)return;
                var $par=$(par);
                var content=$par.html();
                var $new=$('<'+ptype+'/>', {
                        html: content
                    }
                );
                $.each($par.prop('attributes')||[], function() {
                        $new.attr(this.name, this.value)
                    }
                );
                $par.replaceWith($new);
                return $new.get(0)
            }
            , forEachElement:function(action) {
                var elem=this.getElement();
                $(elem).children().each(action)
            }
            , unwrap:function(elemtype) {}
            , command:function(command, value) {
                try {
                    document.execCommand(command, false, value)
                }
                catch(e) {}
            }
            , wrap:function(elemtype, css, classname) {
                if(!this.selected())return $( {}
                );
                elemtype=elemtype||'span';
                classname=classname||'';
                var cssneg= {}
                    ;
                for(var prop in css) {
                    cssneg[prop]=''
                }
                this.command('stylewithcss', false);
                this.command('strikethrough');
                var $elem=$(this.getElement()).parents('.zedity-box .zedity-content').addBack().find('s,strike');
                var list=[];
                $elem.each($.proxy(function(idx, elem) {
                        var tempclass=Zedity.core.genId('tfms');
                        var $this=$(elem);
                        $this.replaceWith('<'+elemtype+' class="'+tempclass+'">'+$this.html()+'</'+elemtype+'>');
                        var $newelem=$('.'+tempclass);
                        $newelem.addClass(classname).removeClass(tempclass);
                        $newelem[0].parentNode.normalize();
                        while($newelem.parent().is(elemtype+','+this._elements)&&$newelem[0].parentNode.childNodes.length==1) {
                            $newelem=$($newelem[0].parentNode);
                            $newelem[0].parentNode.normalize()
                        }
                        $newelem.find(elemtype).each(function(idx, elem) {
                                var $elem=$(elem);
                                var oldcss=$elem.getCss(Object.keys(cssneg));
                                $elem.css(cssneg).removeClass(classname);
                                if(!$elem.attr('style')||$elem.attr('style')=='') {
                                    if($elem.parent().is(elemtype)&&(!$elem.parent().attr('style')||$elem.attr('style')=='')) {
                                        $elem.parent().css(oldcss)
                                    }
                                    $elem.replaceWith($elem.contents())
                                }
                                elem.normalize()
                            }
                        );
                        list.push($newelem[0])
                    }
                    , this));
                this.selectElements($(list));
                return $(list)
            }
            , format:function(css, action, classname) {
                var $elem=this.wrap('span', css, classname);
                if(typeof action=='function') {
                    $elem.each(function(idx, element) {
                            action.call(this, element)
                        }
                    )
                }
                else {
                    $elem.css(css)
                }
            }
        }
        ;
        Zedity.core.patterns= {
            patterns: {}
            , add:function(pattern, substitution) {
                this.patterns[pattern]=substitution
            }
            , substitute:function(content) {
                for(var i in this.patterns) {
                    if(this.patterns.hasOwnProperty(i)) {
                        var pattern=i.replace(/([.*+?^=!:$ {}
                    ()|\[\]\/\\])/g, "\\$1");
                        content=content.replace(new RegExp(pattern, 'g'), this.patterns[i])
                    }
                }
                return content
            }
        }
        ;
        Zedity.core.patch=function(obj, func, options) {
            obj=obj||window;
            func=func||function() {}
            ;
            options=$.extend( {
                    before:function() {}
                    , after:function() {}
                    , replace: null, restorePrototype: false
                }
                , options);
            if(options.restorePrototype) {
                var old_prototype=obj[func].prototype;
                var old_map=[];
                for(var i in obj[func]) {
                    if(obj[func].hasOwnProperty(i))old_map[i]=obj[func][i]
                }
            }
            var old_function=obj[func];
            obj[func]=function() {
                options.before.apply(this, arguments);
                if(typeof options.replace=='function') {
                    options.replace.apply(this, arguments)
                }
                else {
                    old_function.apply(this, arguments)
                }
                options.after.apply(this, arguments)
            }
            ;
            if(options.restorePrototype) {
                obj[func].prototype=old_prototype;
                for(var i in old_map) {
                    if(old_map.hasOwnProperty(i))obj[func][i]=old_map[i]
                }
            }
        }
        ;
        Zedity.core.embed= {
            services: {}
            , add:function(service, options) {
                var defaults= {
                        type:null, regex:[], parser:function(code, embed) {}
                        , player: {
                            flash: {}
                            , iframe: {
                                command:function(frame_id, func, args) {}
                            }
                        }
                        , sizeLimits: {
                            minWidth: null, minHeight: null, maxWidth: null, maxHeight: null
                        }
                    }
                    ;
                if(!service||!options)return;
                options.service=service;
                options=$.extend(true, {}
                    , defaults, options);
                this.services[service]=options
            }
            , parse:function(embed, forcetype) {
                var code;
                for(var service in this.services) {
                    if(!this.services.hasOwnProperty(service))continue;
                    if(forcetype&&this.services[service].type!=forcetype)continue;
                    for(var j=this.services[service].regex.length-1;
                        j>=0;
                        --j) {
                        this.services[service].regex.lastIndex=0;
                        if(code=this.services[service].regex[j].exec(embed)) {
                            var links=this.services[service].parser(code, embed);
                            var id=links.id||Zedity.core.genId(this.services[service].service);
                            if(links.flash) {
                                var embed_flash='<object id="'+id+'" data-service="'+service+'" type="application/x-shockwave-flash" data="'+links.flash+'" wmode="opaque" style="width:100%;height:100%">'+'<param name="movie" value="'+links.flash+'"/>'+'<param name="allowfullscreen" value="false"/>'+'<param name="wmode" value="opaque"/>'+'<param name="allowScriptAccess" value="always"/> '+'</object>'
                            }
                            if(links.iframe) {
                                var embed_iframe='<iframe id="'+id+'" data-service="'+service+'" src="'+links.iframe+'" frameborder="0" scrolling="no" style="width:100%;height:100%"></iframe>'
                            }
                            return {
                                code: links.code, service: service, id: id, flash: embed_flash, iframe: embed_iframe, html5: links.html5, links: links
                            }
                        }
                    }
                }
                return {}
            }
            , player:function($elem, service, func, args) {
                var command;
                try {
                    if($elem.is('object')) {
                        command=this.services[service].player.flash[func];
                        if($elem[0][command])$elem[0][command]()
                    }
                    if($elem.is('iframe')) {
                        command=this.services[service].player.iframe[func];
                        this.services[service].player.iframe.command($elem.attr('id'), command, args)
                    }
                    if($elem.is('video')||$elem.is('audio')) {
                        if($elem[0][func])$elem[0][func]()
                    }
                }
                catch(e) {}
            }
            , getServices:function(type, links) {
                var ret=[];
                for(var service in this.services) {
                    if(this.services.hasOwnProperty(service)&&(!type||this.services[service].type==type)) {
                        if(links) {
                            ret.push('<a href="'+this.services[service].url+'" target="_blank">'+service+'</a>')
                        }
                        else {
                            ret.push(service)
                        }
                    }
                }
                return ret
            }
        }
        ;
        Zedity.core.dialog=function(options) {
            options=$.extend( {
                    title:'Zedity', message:'', question:'', default:'', mandatory:Zedity.t('Please insert a value.'), acceptedChars:'', ok:function(answer) {}
                    , cancel: false
                }
                , options);
            $('<div class="zedity-dialog-popup">'+'<p>'+options.message+'</p>'+(options.question?'<p>'+options.question+'</p>'+'<input id="zedity-txtPopupDialog" type="text" value=""><br/><br/>':'')+'</div>').on('keydown.zedity', function(event) {
                    if(event.keyCode==13) {
                        $(this).parent().find('.ui-dialog-buttonpane button:eq(0)').trigger('click');
                        return false
                    }
                }
            ).on('keyup.zedity', function(event) {
                    if(!options.acceptedChars)return;
                    var value=$('#zedity-txtPopupDialog').val();
                    var rxA=new RegExp('^['+options.acceptedChars+']*$');
                    var rxNA=new RegExp('[^'+options.acceptedChars+']', 'g');
                    if(!rxA.test(value)) {
                        $('#zedity-txtPopupDialog').val(value.replace(rxNA, ''));
                        return false
                    }
                }
            ).dialog( {
                    title:options.title, dialogClass:'zedity-dialog', autoOpen:true, modal:true, resizable:false, position: {
                        my: 'center', at: 'center', of: window.top
                    }
                    , open:function() {
                        $(this).find('.zedity-tooltip').tooltip();
                        $('#zedity-txtPopupDialog').val(options.default).select().focus()
                    }
                    , close:function() {
                        setTimeout($.proxy(function() {
                                $(this).dialog('destroy').remove()
                            }
                            , this), 10)
                    }
                    , buttons:[ {
                        text:'OK', click:function() {
                            var answer='';
                            if(options.question) {
                                answer=$.trim($('#zedity-txtPopupDialog').val());
                                if(options.mandatory&&answer=='') {
                                    alert(options.mandatory);
                                    $('#zedity-txtPopupDialog').val(options.default).select().focus();
                                    return
                                }
                            }
                            $(this).dialog('close');
                            var ret=options.ok.call(this, answer);
                            if(ret===false) {
                                setTimeout(function() {
                                        Zedity.core.dialog($.extend(options, {
                                                default: answer
                                            }
                                        ))
                                    }
                                    , 100)
                            }
                        }
                    }
                        , {
                            text:'Cancel', click:function() {
                                $(this).dialog('close');
                                if(typeof options.cancel=='function')options.cancel.call(this)
                            }
                        }
                    ].slice(0, options.question||options.cancel?2:1)
                }
            )
        }
        ;
        Array.prototype.remove=function() {
            var what, a=arguments, L=a.length, ax;
            while(L&&this.length) {
                what=a[--L];
                while((ax=this.indexOf(what))!==-1) {
                    this.splice(ax, 1)
                }
            }
            return this
        }
        ;
        $.widget('ui.tooltip', $.ui.tooltip, {
                options: {
                    content:function() {
                        return $(this).prop('title')
                    }
                }
            }
        );
        $.widget('ui.dialog', $.ui.dialog, {
                options: {
                    draggable: false, resizable: false, show: 'show', hide: 'hide'
                }
                , _createOverlay:function() {
                    this._superApply(arguments);
                    if(!this.uiDialog.hasClass('zedity-dialog'))return;
                    $('body').addClass('has-zedity-dialog');
                    this.overlay.append(this.uiDialog.detach()).append('<div class="zedity-overlay-stopper"/>')
                }
                , _destroyOverlay:function() {
                    if(!this.uiDialog.hasClass('zedity-dialog'))return this._superApply(arguments);
                    this.uiDialog.appendTo('body');
                    this._superApply(arguments);
                    if(!this.document.data('ui-dialog-overlays'))$('body').removeClass('has-zedity-dialog')
                }
                , _keepFocus:function(e) {
                    if($(e.target).closest('.ui-dialog').length==0)e.preventDefault()
                }
            }
        );
        var touched;
        Zedity.core.patch($.ui.mouse.prototype, '_mouseInit', {
                before:function() {
                    function sim(e, type) {
                        e.preventDefault();
                        var touch=e.originalEvent.changedTouches[0];
                        var sim=document.createEvent('MouseEvents');
                        sim.initMouseEvent(type, true, true, window, 1, touch.screenX, touch.screenY, touch.clientX, touch.clientY, false, false, false, false, 0, null);
                        e.target.dispatchEvent(sim)
                    }
                    ;
                    var self=this;
                    this.element.on( {
                            'touchstart.mousesim':function(e) {
                                if(touched||!self._mouseCapture(e.originalEvent.changedTouches[0]))return;
                                touched=true;
                                sim(e, 'mouseover');
                                sim(e, 'mousedown')
                            }
                            , 'touchmove.mousesim':function(e) {
                                if(!touched)return;
                                sim(e, 'mousemove')
                            }
                            , 'touchend.mousesim':function(e) {
                                if(!touched)return;
                                sim(e, 'mouseup');
                                sim(e, 'mouseout');
                                touched=false
                            }
                        }
                    )
                }
            }
        );
        $.event.special.dbltap= {
            setup:function(data, namespaces) {
                $(this).on('touchend.dblclick', $.event.special.dbltap.handler)
            }
            , teardown:function(namespaces) {
                $(this).off('touchend.dblclick')
            }
            , handler:function(event) {
                var $elem=$(event.target);
                var now=new Date().getTime();
                var delta=now-($elem.data('lastTouch')||0);
                if((delta>20)&&(delta<500)) {
                    $elem.data('lastTouch', 0);
                    $elem.trigger('dblclick')
                }
                else {
                    $elem.data('lastTouch', now)
                }
            }
        }
    }

)(jQuery);
(function($) {
        if(!Zedity)throw new Error(Zedity.t('%s needs %s.', 'Zedity.Ribbon', 'Zedity'));
        Zedity.Ribbon=function(options) {
            this._options=$.extend( {
                    top: 0, defaultTab: 2, minWidth: 420, minHeight: 20
                }
                , options);
            this._tabs=[];
            this._data= {
                corner: {
                    left: 0, top: 0
                }
                , onadd:[], mutex:[]
            }
            ;
            var self=this;
            this.id=Zedity.core.genId();
            this.editor=options.editor;
            this.editor.$container.prepend('<div class="zedity-ribbon ui-front"><ul class="zedity-ribbon-tabs"></ul></div>');
            this.$this=this.editor.$container.children('.zedity-ribbon');
            this.$tabs=this.$this.children('.zedity-ribbon-tabs');
            this.$this.tabs( {
                    default:this._options.defaultTab, active:this._options.defaultTab, beforeActivate:function(ev, ui) {
                        ui.newPanel.removeClass('zedity-tab-loaded');
                        self.refresh()
                    }
                    , activate:function(ev, ui) {
                        Zedity.core._later(this, function() {
                                ui.newPanel.addClass('zedity-tab-loaded')
                            }
                            , 0)
                    }
                }
            );
            $(window).add(this.editor.$container).on('resize.zedity scroll.zedity', function() {
                    self._reposition()
                }
            );
            this.$this.on('blur', 'input[type=number]', function() {
                    var $this=$(this);
                    var min=parseInt($this.attr('min')||'-1000000', 10);
                    var max=parseInt($this.attr('max')||'1000000', 10);
                    var val=parseInt($this.val(), 10);
                    var nval=Math.min(Math.max(min, val), max);
                    if(val!=nval) {
                        $this.val(nval).trigger('change')
                    }
                }
            ).on('keypress', 'input[type=number]', function(e) {
                    if(e.keyCode==13)$(this).trigger('blur').focus()
                }
            ).on('click', 'input[type=number]', function(e) {
                    this.select()
                }
            );
            this.add( {
                    tabs: {
                        content: {
                            icon:'content', title:Zedity.t('Content'), order:-1000, groups: {
                                size: {
                                    title:Zedity.t('Size'), order:0, features: {
                                        size: {
                                            type:'panel', build:function($panel, ed) {
                                                $panel.append('<table>'+'<tr><td>'+Zedity.t('Width:')+'</td><td><input class="zedity-PageSize" data-type="width" type="number"></tr>'+'<tr><td>'+Zedity.t('Height:')+'</td><td><input class="zedity-PageSize" data-type="height" type="number"></tr>'+'</table>');
                                                $panel.find('.zedity-PageSize').on('change', function() {
                                                        var $this=$(this);
                                                        if($this.closest('.ui-state-disabled').length)return false;
                                                        var size=ed.page.size();
                                                        var type=$this.attr('data-type');
                                                        size[type]=parseInt($this.val(), 10);
                                                        ed.page.size(size)
                                                    }
                                                )
                                            }
                                            , refresh:function(ed) {
                                                var $ps=this.$panel.find('.zedity-PageSize');
                                                $ps.toggleClass('ui-state-disabled', !ed._options.resizable||!ed._options.userResizable);
                                                var size=ed.page.size();
                                                var sc=ed.page.sizeConstraints();
                                                $ps.eq(0).val(size.width).attr( {
                                                        min: sc.minWidth, max: sc.maxWidth, title: Zedity.t('Set content width')+' '+Zedity.t('(min: %s, max: %s)', sc.minWidth, sc.maxWidth)
                                                    }
                                                );
                                                $ps.eq(1).val(size.height).attr( {
                                                        min: sc.minHeight, max: sc.maxHeight, title: Zedity.t('Set content height')+' '+Zedity.t('(min: %s, max: %s)', sc.minHeight, sc.maxHeight)
                                                    }
                                                )
                                            }
                                        }
                                    }
                                }
                            }
                        }
                        , edit: {
                            icon:'edit', title:Zedity.t('Edit'), order:100, groups: {
                                edit: {
                                    title:Zedity.t('Editing'), order:100, features: {
                                        undo: {
                                            icon:'undo', title:Zedity.t('Undo modifications'), label:Zedity.t('Undo'), order:0, onclick:function() {
                                                self.editor.undo()
                                            }
                                        }
                                        , redo: {
                                            icon:'redo', title:Zedity.t('Redo modifications'), label:Zedity.t('Redo'), order:1, onclick:function() {
                                                self.editor.redo()
                                            }
                                        }
                                        , sep: {
                                            type: 'separator', order: 10
                                        }
                                        , clearall: {
                                            icon:'delete', title:Zedity.t('Clear all'), label:Zedity.t('Clear all'), order:20, onclick:function() {
                                                self.editor.page.content('')
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            );
            var boxes= {
                    tabs: {
                        boxes: {
                            icon:'boxes', title:Zedity.t('Boxes'), order:200, groups: {
                                basic: {
                                    title:Zedity.t('Basic'), order:0, features: {}
                                }
                                , 'media-embed': {
                                    title:Zedity.t('Media embed'), order:10, features: {}
                                }
                                , advanced: {
                                    title:Zedity.t('Advanced'), order:100, features: {}
                                }
                            }
                        }
                    }
                }
                ;
            for(var i=0, len=Zedity.Box.boxes.length;
                i<len;
                ++i) {
                boxes.tabs.boxes.groups[Zedity.Box.boxes[i].section].features[Zedity.Box.boxes[i].type]= {
                    icon:Zedity.Box.boxes[i].type.toLowerCase(), label:Zedity.t(Zedity.Box.boxes[i].type), title:Zedity.t('Add box:')+' '+Zedity.t(Zedity.Box.boxes[i].type), order:Zedity.Box.boxes[i].order, onclick:function() {
                        self.editor.boxes.add($(this).attr('data-name'));
                        var box=self.editor.boxes.selected();
                        if(!box)return;
                        box.$this.css( {
                                left: parseInt(box.$this.css('left').replace('px', ''))+self._data.corner.left, top: parseInt(box.$this.css('top').replace('px', ''))+self._data.corner.top
                            }
                        );
                        box.reposition()
                    }
                }
            }
            for(var group in boxes.tabs.boxes.groups) {
                if(boxes.tabs.boxes.groups.hasOwnProperty(group)&&$.isEmptyObject(boxes.tabs.boxes.groups[group].features))delete boxes.tabs.boxes.groups[group]
            }
            this.add(boxes);
            this._reposition();
            this.$this.tabs('option', 'active', this._options.defaultTab)
        }
        ;
        $.extend(Zedity.Ribbon.prototype, {
                _reposition:function() {
                    hasScrollBar=function($e) {
                        return $e[0].scrollWidth>$e.innerWidth()
                    }
                    ;
                    var $window=$(window);
                    this.$tabs.removeClass('zedity-small').toggleClass('zedity-small', hasScrollBar(this.$tabs));
                    this.$this.find('.ui-tabs-panel:not(.ui-tabs-hide)').removeClass('zedity-small').toggleClass('zedity-small', hasScrollBar(this.$tabs));
                    this._data.corner.left=this.editor.$container.scrollLeft();
                    this.$this.css( {
                            left: this._data.corner.left, top: 0, width: ''
                        }
                    );
                    var topmargin=this.$this.offset().top-this._options.top;
                    var c=$window.scrollTop();
                    if(c>this.editor.$container.outerHeight()+topmargin-this.$this.outerHeight()-this._options.minHeight) {
                        this.$this.css('top', this.editor.$container.outerHeight()-this.$this.outerHeight()-this._options.minHeight);
                        this._data.corner.top=c-topmargin
                    }
                    else if(c>topmargin) {
                        this.$this.css('top', c-topmargin);
                        this._data.corner.top=c-topmargin
                    }
                    else if(c<=topmargin) {
                        this._data.corner.top=0
                    }
                    var $p=this.$this.find('.zedity-extpanel:visible').css('max-height', '').removeClass('zedity-extpanel-scroller');
                    if($p.length) {
                        var d=($p.position().top+$p.outerHeight())-window.innerHeight;
                        if(d>0)$p.css('max-height', Math.max(150, $p.height()-(d+5))).addClass('zedity-extpanel-scroller')
                    }
                    return this
                }
                , _tabId:function(tab) {
                    if(!isNaN(tab))tab=this._tabs[tab].name;
                    return'zedity-ribbon-tab-'+this.id+'-'+tab
                }
                , _tabIdx:function(name) {
                    for(var i=0, len=this._tabs.length-1;
                        i<=len;
                        ++i) {
                        if(this._tabs[i].name==name)return i
                    }
                    return-1
                }
                , _groupIdx:function(tab, name) {
                    if(isNaN(tab))tab=this._tabIdx(tab);
                    for(var i=0, len=this._tabs[tab].groups.length-1;
                        i<=len;
                        ++i) {
                        if(this._tabs[tab].groups[i].name==name)return i
                    }
                    return-1
                }
                , _featureIdx:function(tab, group, name) {
                    if(isNaN(tab))tab=this._tabIdx(tab);
                    if(isNaN(group))tab=this._tabIdx(group);
                    for(var i=0, len=this._tabs[tab].groups[group].features.length-1;
                        i<=len;
                        ++i) {
                        if(this._tabs[tab].groups[group].features[i].name==name)return i
                    }
                    return-1
                }
                , _tab:function(name) {
                    var idx=this._tabIdx(name);
                    return idx>=0?this._tabs[idx]: {
                        groups: []
                    }
                }
                , _group:function(tab, name) {
                    var t=this._tab(tab);
                    for(var i=0, len=t.groups.length;
                        i<len;
                        ++i) {
                        if(t.groups[i].name==name)return t.groups[i]
                    }
                    return {
                        features: []
                    }
                }
                , _feature:function(tab, group, name) {
                    var g=this._group(tab, group);
                    for(var i=0, len=g.features.length;
                        i<len;
                        ++i) {
                        if(g.features[i].name==name)return g.features[i]
                    }
                    return {}
                }
                , _featureElement:function(feat) {
                    return feat.$panel||feat.$button||feat.$menu||$()
                }
                , _addTab:function(name, options) {
                    if(!name)return this;
                    options=$.extend( {
                            order:0, ribbbon:this, show:function() {
                                return true
                            }
                            , enable:function() {
                                return true
                            }
                            , refresh:function() {}
                        }
                        , options);
                    name=name.toLowerCase();
                    var id=this._tabId(name);
                    if(this.$this.tabs('getidx', id)==-1) {
                        options.icon=options.icon||name;
                        options.title=options.title||Zedity.t(name.charAt(0).toUpperCase()+name.slice(1));
                        this._tabs.push($.extend( {}
                            , options, {
                                name: name, groups: []
                            }
                        ));
                        this._tabs.sort(function(a, b) {
                                return a.order-b.order
                            }
                        );
                        var idx=this._tabIdx(name)-1;
                        var n=idx>=0?this._tabs[idx].name:'';
                        (n?this.$tabs.find('[data-name='+n+']'):this.$tabs)[n?'after':'prepend']('<li class="zedity-ribbon-tab" data-name="'+name+'"><a href="#'+id+'">'+'<span class="zicon zicon-'+options.icon+'"></span> '+'<span class="zedity-ribbon-tab-title">'+options.title+'</title>'+'</a></li>');
                        this.$this.append('<div id="'+id+'" class="zedity-ribbon-tab-panel"></div>');
                        this._tabs[idx+1].$tab=this.$tabs.find('[data-name='+name+']');
                        this._tabs[idx+1].$panel=this.$this.find('#'+id);
                        this.$this.tabs('refresh');
                        if(this.$tabs.find('li').length==1)this.$this.tabs('option', 'active', 0)
                    }
                    for(var group in options.groups) {
                        if(!options.groups.hasOwnProperty(group)||!options.groups[group])continue;
                        this._addGroup(name, group, options.groups[group])
                    }
                    return this
                }
                , _addGroup:function(tab, name, options) {
                    if(!tab)return this;
                    tab=tab.toLowerCase();
                    options=$.extend( {
                            class:'', order:0, ribbon:this, show:function() {
                                return true
                            }
                            , enable:function() {
                                return true
                            }
                            , refresh:function() {}
                        }
                        , options);
                    options.title=options.title||Zedity.t(name.charAt(0).toUpperCase()+name.slice(1));
                    var id=this._tabId(tab);
                    var idx=this._tabIdx(tab);
                    var groupidx=this._groupIdx(idx, name);
                    if(groupidx==-1) {
                        this._tabs[idx].groups.push($.extend( {}
                            , options, {
                                name: name, features: []
                            }
                        ));
                        this._tabs[idx].groups.sort(function(a, b) {
                                return a.order-b.order
                            }
                        );
                        groupidx=this._groupIdx(idx, name);
                        var n='';
                        for(var i=0, len=this._tabs[idx].groups.length-1;
                            i<=len;
                            ++i) {
                            if(this._tabs[idx].groups[i].name==name)break;
                            n=this._tabs[idx].groups[i].name
                        }
                        options.$group=$('<div class="zedity-ribbon-group '+options.class+'" data-name="'+name+'">'+'<div class="zedity-ribbon-group-panel"></div>'+'<div class="zedity-ribbon-group-title">'+options.title+'</div>'+'</div>');
                        (n?this.$this.find('#'+id+' .zedity-ribbon-group[data-name='+n+']'):this.$this.find('#'+id))[n?'after':'prepend'](options.$group);
                        options.$panel=options.$group.find('.zedity-ribbon-group-panel');
                        this._tabs[idx].groups[groupidx].$group=options.$group;
                        this._tabs[idx].groups[groupidx].$panel=options.$panel
                    }
                    for(var feature in options.features) {
                        if(!options.features.hasOwnProperty(feature)||!options.features[feature])continue;
                        this._addFeature(tab, name, feature, this._tabs[idx].groups[groupidx].$panel, options.features[feature], options)
                    }
                    return this
                }
                , _addFeature:function(tab, group, name, $panel, feature, options) {
                    function createButton(data1, data2) {
                        data2=data2|| {}
                        ;
                        data1=$.extend( {
                                class: '', size: data2.size||((data1.label||data2.label)?'m': 'l')
                            }
                            , options, {
                                class: ''
                            }
                            , data2, data1);
                        return $('<button/>', $.extend( {
                                title:data1.title, class:'zedity-ribbon-button '+(data1.class||'')+' '+(data2.class||''), 'data-name':name, css: {
                                    'min-width': data1.size=='xs'?'25px': '45px'
                                }
                                , html:$('<span/>', {
                                    class: 'zicon zicon-'+data1.icon+' zicon-size-'+(data1.size||data2.size)
                                }
                                )
                            }
                            , data1.attributes))
                    }
                    ;
                    function appendFeature($e, n, small) {
                        if(small)$e.attr('data-small', '1');
                        if(!n) {
                            $panel.prepend($e)
                        }
                        else {
                            var $f=$panel.find('[data-name='+n+']');
                            var $w=$f.closest('.zedity-ribbon-feature-wrapper');
                            $f=$w;
                            if(small) {
                                var $p=$w.find('[data-name][data-small]');
                                if($p.length==1) {
                                    $f=$p
                                }
                            }
                            $f.after($e)
                        }
                        if($e.closest('.zedity-ribbon-feature-wrapper').length==0) {
                            $e.wrap('<div class="zedity-ribbon-feature-wrapper"/>')
                        }
                    }
                    ;
                    feature=$.extend( {
                            ribbon:this, onclick:function() {}
                            , show:function() {
                                return true
                            }
                            , enable:function() {
                                return true
                            }
                            , refresh:function() {}
                        }
                        , feature);
                    var tabidx=this._tabIdx(tab);
                    var groupidx=this._groupIdx(tabidx, group);
                    this._tabs[tabidx].groups[groupidx].features.push($.extend(feature, {
                            name: name
                        }
                    ));
                    this._tabs[tabidx].groups[groupidx].features.sort(function(a, b) {
                            return a.order-b.order
                        }
                    );
                    var featidx=this._featureIdx(tabidx, groupidx, name);
                    feature=this._tabs[tabidx].groups[groupidx].features[featidx];
                    var n='';
                    for(var i=0, len=this._tabs[tabidx].groups[groupidx].features.length;
                        i<len;
                        ++i) {
                        if(this._tabs[tabidx].groups[groupidx].features[i].name==name)break;
                        n=this._tabs[tabidx].groups[groupidx].features[i].name
                    }
                    var self=this;
                    switch(feature.type) {
                        case'smallpanel':case'panel':feature=$.extend( {
                            build:function() {}
                        }
                        , feature);
                        var $subpanel=$('<div/>', {
                                class: 'zedity-ribbon-group-subpanel', 'data-name': name
                            }
                        );
                        appendFeature($subpanel, n, feature.type=='smallpanel');
                        feature.build.call(feature, $subpanel, self.editor);
                        feature.$panel=$subpanel;
                        break;
                        case'extpanel':feature=$.extend( {
                                build:function() {}
                            }
                            , feature);
                            var $button=createButton(feature);
                            if(feature.label) {
                                $button.append(['xs', 's'].indexOf(feature.size)>-1?'&nbsp;': '<br>');
                                $button.append($('<span>', {
                                        class: 'zedity-ribbon-button-label', html: feature.label
                                    }
                                ))
                            }
                            appendFeature($button, n, ['xs', 's'].indexOf(feature.size)>-1);
                            $button.extpanel();
                            feature.$button=$button.extpanel('widget');
                            feature.$extpanel=$button.extpanel('instance').panel;
                            feature.build.call(feature, feature.$extpanel, self.editor);
                            $button.on('click.zedity-refresh', function() {
                                    self.refresh(tab, group, name)
                                }
                            );
                            break;
                        case'menu':var $s=$('<select/>', $.extend( {
                                title: feature.title, 'data-name': name, 'data-label': feature.label||undefined, 'data-icon': feature.icon?feature.icon+' zicon-size-xs': undefined
                            }
                            , feature.attributes));
                            for(var i=0, len=feature.items.length;
                                i<len;
                                ++i) {
                                $s.append($('<option/>', $.extend( {
                                        value: feature.items[i].value!=null?feature.items[i].value: feature.items[i], html: feature.items[i].label||feature.items[i].value||feature.items[i], class: feature.items[i].class||undefined, 'data-icon': feature.items[i].icon||undefined
                                    }
                                    , feature.items[i].attributes)))
                            }
                            appendFeature($s, n, true);
                            $s.on('refresh', function(e) {
                                    $(this).selectmenu('instance').options.change.call(this, {
                                            originalEvent: {
                                                type: 'menuselect'
                                            }
                                        }
                                    )
                                }
                            ).selectmenu( {
                                    width:feature.width||100, change:function(e, ui) {
                                        if(e.originalEvent.type!='menuselect')return;
                                        feature.onclick.call(this, $(this).val(), e, self.editor, feature)
                                    }
                                }
                            );
                            feature.$menu=$s;
                            feature.$button=$s.selectmenu('widget');
                            if(feature.size=='n') {
                                feature.$button.addClass('zedity-selectmenu-big').find('.zicon').addClass('zicon-size-n').after('<br/>')
                            }
                            break;
                        case'toggle':var $button=createButton(feature.state[0], feature);
                            $button.on('click.zedity-ribbon', function(e) {
                                    var $this=$(this);
                                    if($this.closest('.zedity-disabled').length>0)return false;
                                    var state=feature.state;
                                    var before=parseInt($this.attr('data-state')||0);
                                    var after=(before+1)%state.length;
                                    var res=feature.onclick.call(this, e, self.editor, before, after);
                                    if(res!==false)$this.trigger('toggle.zedity-ribbon')
                                }
                            ).on('toggle.zedity-ribbon', function(e, setstate) {
                                    var $this=$(this);
                                    if($this.hasClass('zedity-disabled'))return false;
                                    var state=feature.state;
                                    var before=parseInt($this.attr('data-state')||0);
                                    var after=setstate!=null?setstate: (before+1)%state.length;
                                    $this.attr('title', state[after].title).attr('data-state', after).find('.zedity-ribbon-button-label').text(state[after].label);
                                    if(state[before].icon) {
                                        $this.find('.zicon').removeClass('zicon-'+state[before].icon).addClass('zicon-'+state[after].icon)
                                    }
                                    return false
                                }
                            );
                            if(feature.state[0].label) {
                                $button.append(['xs', 's'].indexOf(feature.size)>-1?'&nbsp;': '<br>');
                                $button.append($('<span>', {
                                        class: 'zedity-ribbon-button-label', html: feature.state[0].label
                                    }
                                ))
                            }
                            appendFeature($button, n, ['xs', 's'].indexOf(feature.size)>-1);
                            feature.$button=$button;
                            break;
                        case'separator':var $subpanel=$('<div/>', {
                                class: 'zedity-ribbon-separator', 'data-name': name
                            }
                        );
                            appendFeature($subpanel, n);
                            feature.$panel=$subpanel;
                            break;
                        case'button':default:var $button=createButton(feature);
                        $button.on('click.zedity-ribbon', function(e) {
                                if($(this).closest('.zedity-disabled').length>0)return false;
                                feature.onclick.call(this, e, self.editor)
                            }
                        );
                        if(feature.label) {
                            $button.append(['xs', 's'].indexOf(feature.size)>-1?'&nbsp;': '<br>');
                            $button.append($('<span>', {
                                    class: 'zedity-ribbon-button-label', html: feature.label
                                }
                            ))
                        }
                        appendFeature($button, n, ['xs', 's'].indexOf(feature.size)>-1);
                        feature.$button=$button
                    }
                    this._tabs[tabidx].groups[groupidx].features[featidx]=feature;
                    feature.refresh.call(feature, this.editor);
                    this._featureElement(feature).toggle(feature.show.call(feature, this.editor)).toggleClass('zedity-disabled', !feature.enable.call(feature, this.editor));
                    return this
                }
                , add:function(options, mutex) {
                    if(mutex) {
                        if(this._data.mutex.indexOf(mutex)>-1)return this;
                        this._data.mutex.push(mutex)
                    }
                    options=$.extend( {
                            build:function() {}
                            , onadd:function() {}
                        }
                        , options);
                    for(var tab in options.tabs) {
                        if(!options.tabs.hasOwnProperty(tab))continue;
                        this._addTab(tab, options.tabs[tab])
                    }
                    options.build.call(this, this.editor);
                    this._data.onadd.push(options.onadd);
                    for(var i=this._data.onadd.length-1;
                        i>=0;
                        --i) {
                        this._data.onadd[i].call(this, this.editor)
                    }
                    return this
                }
                , openTab:function(tab, show) {
                    if(isNaN(tab))tab=this._tabIdx(tab);
                    var $tab=this.$this.find('[aria-controls='+this._tabId(tab)+']');
                    if(show)$tab.show();
                    if(!show||$tab.is(':visible')) {
                        this.$this.tabs('option', 'active', tab)
                    }
                    return this
                }
                , activateFeature:function(tab, group, feature) {
                    this.openTab(tab);
                    var tabidx=this._tabIdx(tab);
                    var groupidx=this._groupIdx(tabidx, group);
                    var featidx=this._featureIdx(tabidx, groupidx, feature);
                    var f=this._tabs[tabidx].groups[groupidx].features[featidx];
                    if(f.$button) {
                        f.$button.trigger('click')
                    }
                    if(f.$menu) {
                        f.$menu.trigger('refresh')
                    }
                    return this
                }
                , tabBadge:function(tab, badge, text) {
                    var t=this._tab(tab);
                    if(!t)return this;
                    t.$tab.find('.zedity-tab-badge-'+(badge||'0')).remove();
                    if(text) {
                        t.$tab.find('.zedity-ribbon-tab-title').append('<span class="zedity-tab-badge zedity-tab-badge-'+(badge||'0')+'">'+text+'</span>')
                    }
                    return this
                }
                , refresh:function(tab, group, feat) {
                    var refreshTab=function(tab, box) {
                            if(tab==-1)return;
                            this.$this.tabs('show', tab, this._tabs[tab].show.call(this._tabs[tab], this.editor, box));
                            for(var group=this._tabs[tab].groups.length;
                                group>=0;
                                --group) {
                                if(!this._tabs[tab].groups.hasOwnProperty(group))continue;
                                refreshGroup.call(this, tab, group, box)
                            }
                            this._tabs[tab].refresh.call(this._tabs[tab], this.editor, box)
                        }
                        ;
                    var refreshGroup=function(tab, group, box) {
                            if(group==-1)return;
                            this._tabs[tab].groups[group].refresh.call(this._tabs[tab].groups[group], this.editor, box);
                            this._tabs[tab].groups[group].$group.toggle(this._tabs[tab].groups[group].show.call(this._tabs[tab].groups[group], this.editor, box));
                            this._tabs[tab].groups[group].$group.find('.zedity-ribbon-group-panel').toggleClass('zedity-disabled', !this._tabs[tab].groups[group].enable.call(this._tabs[tab].groups[group], this.editor, box));
                            for(var feat=this._tabs[tab].groups[group].features.length;
                                feat>=0;
                                --feat) {
                                if(!this._tabs[tab].groups[group].features.hasOwnProperty(feat))continue;
                                refreshFeature.call(this, tab, group, feat, box)
                            }
                        }
                        ;
                    var refreshFeature=function(tab, group, feat, box) {
                            if(feat==-1)return;
                            this._featureElement(this._tabs[tab].groups[group].features[feat]).toggle(this._tabs[tab].groups[group].features[feat].show.call(this._tabs[tab].groups[group].features[feat], this.editor, box)).toggleClass('zedity-disabled', !this._tabs[tab].groups[group].features[feat].enable.call(this._tabs[tab].groups[group].features[feat], this.editor, box));
                            this._tabs[tab].groups[group].features[feat].refresh.call(this._tabs[tab].groups[group].features[feat], this.editor, box);
                            clearTimeout(this._data.repositionTimer);
                            this._data.repositionTimer=setTimeout($.proxy(function() {
                                    this._reposition()
                                }
                                , this), 100)
                        }
                        ;
                    if(tab&&isNaN(tab))tab=this._tabIdx(tab);
                    if(group&&isNaN(group))group=this._groupIdx(tab, group);
                    if(feat&&isNaN(feat))feat=this._featureIdx(tab, group, feat);
                    var box=this.editor.boxes.selected();
                    if(feat!=null) {
                        refreshFeature.call(this, tab, group, feat, box);
                        return this
                    }
                    if(group!=null) {
                        refreshGroup.call(this, tab, group, box);
                        return this
                    }
                    if(tab!=null) {
                        refreshTab.call(this, tab, box);
                        return this
                    }
                    clearTimeout(this._data.refreshTimer);
                    this._data.refreshTimer=Zedity.core._later(this, function() {
                            var box=this.editor.boxes.selected();
                            var at=this.$tabs.find('.ui-tabs-active').attr('data-name');
                            for(var ttab in this._tabs) {
                                if(!this._tabs.hasOwnProperty(ttab))continue;
                                if(this._tabs[ttab].name==at)refreshTab.call(this, ttab, box);
                                this.$this.tabs('show', ttab, this._tabs[ttab].show.call(this._tabs[ttab], this.editor, box))
                            }
                            if(box&&box!=this._data.oldBox&&['editbox', 'boxstyle'].indexOf(at)==-1) {
                                this.openTab('editbox', true)
                            }
                            this._data.oldBox=box
                        }
                        , 0);
                    return this
                }
            }
        )
    }

)(jQuery);
(function($) {
        $.widget('ui.tabs', $.ui.tabs, {
                options: {
                    default: 0
                }
                , _tabKeydown:function() {}
                , show:function(idx, show) {
                    this.tabs.eq(idx).toggle(!!show);
                    if(this.option('active')==idx&&!show) {
                        this.option('active', this.options.default)
                    }
                }
            }
        );
        $.widget('ui.selectmenu', $.ui.selectmenu, {
                _create:function() {
                    this._superApply(arguments);
                    this.button.attr('title', this.element.attr('title'));
                    if(this.element.attr('data-label')) {
                        this._setText(this.buttonText, this.element.attr('data-label'));
                        this.button.css('width', '');
                        this.button.addClass('zedity-selectmenu');
                        this.menuInstance.element.addClass('zedity-selectmenu-menu');
                        this.element[0].selectedIndex=-1;
                        this.focusIndex=null
                    }
                    else {
                        this.button.addClass('zedity-select');
                        this.menuInstance.element.addClass('zedity-select-menu')
                    }
                    if(this.element.attr('data-icon')) {
                        this.button.prepend('<span class="zicon zicon-'+this.element.attr('data-icon')+'"><span>')
                    }
                    this.button.attr( {
                            'data-name': this.element.attr('data-name'), 'data-small': this.element.attr('data-small')
                        }
                    );
                    this.element.removeAttr('data-name data-small');
                    this.menuInstance._isDivider=$.ui.menu.prototype._isDivider
                }
                , _renderItem:function(ul, item) {
                    var $li=this._superApply(arguments);
                    $li.css('font', item.element.attr('data-font'));
                    $li.addClass(item.element.attr('class'));
                    if(item.element.attr('data-icon')) {
                        $li.prepend('<span class="zicon zicon-size-xs zicon-'+item.element.attr('data-icon')+'"></span>&nbsp;')
                    }
                    return $li
                }
                , _select:function(item, e) {
                    this._superApply(arguments);
                    if(this.element.attr('data-label')) {
                        this._setText(this.buttonText, this.element.attr('data-label'));
                        this.element[0].selectedIndex=-1;
                        this.focusIndex=null
                    }
                }
                , open:function() {
                    this._superApply(arguments);
                    if(this.element.attr('data-label'))this.menu.find('.ui-state-focus').removeClass('ui-state-focus')
                }
            }
        );
        $.widget('ui.extpanel', {
                options: {
                    position: {
                        my: 'center top', at: 'center bottom', collision: 'fit none'
                    }
                }
                , _create:function() {
                    this.element.addClass('zedity-extpanel-button');
                    this.panel=$('<div class="zedity-extpanel"/>');
                    this.panel.appendTo(this.element.closest('.ui-front'));
                    this._on(this.element, {
                            click:function(e) {
                                this._toggle(e)
                            }
                        }
                    );
                    this.panel.on('mousewheel DOMMouseScroll', function(e) {
                            var d=e.originalEvent.wheelDelta||-e.originalEvent.detail;
                            var stop=(d>0&&this.scrollTop==0)||(d<0&&this.scrollTop>=this.scrollHeight-this.offsetHeight);
                            if(stop)e.preventDefault()
                        }
                    )
                }
                , _toggle:function(e) {
                    this[this.isOpen?'close': 'open'](e)
                }
                , open:function(e) {
                    if(this.options.disabled)return;
                    this.isOpen=true;
                    this._on(this.document, {
                            mousedown:function(e) {
                                if(!this.isOpen)return;
                                var $t=$(e.target);
                                if(!$t.closest('.zedity-extpanel-button').is(this.element)&&!$t.closest('.zedity-extpanel').length&&!$t.closest('.ui-widget-overlay').length) {
                                    this.close(e)
                                }
                            }
                        }
                    );
                    this._toggleAttr();
                    this._position();
                    this._trigger('open', e)
                }
                , close:function(e) {
                    if(!this.isOpen)return;
                    this.isOpen=false;
                    this._off(this.document);
                    this._toggleAttr();
                    this._trigger('close', e)
                }
                , _toggleAttr:function() {
                    this.element.attr('aria-expanded', this.isOpen).toggleClass('zedity-pressed', this.isOpen);
                    this.panel.toggleClass('zedity-extpanel-open', this.isOpen)
                }
                , _position:function() {
                    this.panel.position($.extend( {
                            of: this.element, within: this.element.closest('.ui-front')
                        }
                        , this.options.position))
                }
            }
        )
    }

)(jQuery);
(function($) {
        if(!Zedity)throw new Error(Zedity.t('%s needs %s.', 'Zedity.Page', 'Zedity'));
        Zedity.Page=function(options) {
            this._options=$.extend( {
                    width: 800, height: 550, content: '', minWidth: 150, minHeight: 150, maxWidth: 3000, maxHeight: 10000
                }
                , options);
            this._sizeConstraints= {}
            ;
            this.editor=this._options.editor;
            this.editor.id=Zedity.core.genId('zed');
            this.editor.$container.html($('<div/>', {
                    class:'zedity-editor-innercontainer', html:$('<div/>', {
                        id:this.editor.id, 'class':'zedity-editor', css: {
                            position: 'relative', width: this._options.width, height: this._options.height, overflow: 'hidden'
                        }
                    }
                    )
                }
            )).addClass('zedity-editor-container');
            this.editor.$this=this.editor.element();
            this.editor.page=this;
            Zedity.core._call(this, 'content', this._options.content)
        }
        ;
        $.extend(Zedity.Page.prototype, {
                _getPage:function(clean) {
                    var $content=$(this.editor.$this[0].outerHTML);
                    $content.children().addBack().each(function(idx, elem) {
                            var $this=$(this);
                            $this.removeClass('zedity-selected zedity-editable zedity-snapped '+'zedity-warn-size-up zedity-warn-size-down '+'ui-draggable ui-draggable-dragging ui-draggable-handle '+'ui-resizable ui-resizable-resizing '+'ui-rotatable ui-rotatable-rotating ');
                            $this.find('.ui-resizable-handle,.ui-rotatable-handle').remove()
                        }
                    );
                    if(clean) {
                        $content.find('.zedity-empty').each(function(idx, elem) {
                                $(elem).parent().remove()
                            }
                        )
                    }
                    return $content[0].outerHTML
                }
                , _setPage:function(content) {
                    var $content=$(content||'');
                    var $this=this.editor.$this;
                    $this.empty();
                    $content.children('.zedity-box').each(function(idx, elem) {
                            $this.append($(elem)[0].outerHTML)
                        }
                    );
                    $.each($content.prop('attributes')||[], function() {
                            $this.attr(this.name, this.value)
                        }
                    );
                    $this.removeAttr('onclick').css('cursor', '');
                    this.editor.id=$this.attr('id');
                    this.editor.$this.children('.zedity-box').each(function(idx, elem) {
                            var $this=$(this);
                            var editor=$this.editor();
                            var box=$this.box();
                            if(!box&&Zedity.Box.hasOwnProperty($this.attr('data-boxtype'))) {
                                box=new Zedity.Box[$this.attr('data-boxtype')]( {
                                        editor: editor, id: $this.attr('id'), element: $this
                                    }
                                );
                                editor.boxes._boxes.push(box)
                            }
                            else if(box) {
                                box.$this=$this;
                                box.init()
                            }
                            else {
                                editor._error( {
                                        type: 'WARNING', message: Zedity.t('Removed box. Box type "%s" not supported.', $this.attr('data-boxtype'))
                                    }
                                );
                                $this.remove()
                            }
                        }
                    );
                    this.editor.boxes._select(null);
                    Zedity.core._call(this, 'size', this.size())
                }
                , _destroyUnreferencedObjects:function() {
                    var list=Zedity.core.gc.getNonReferenced();
                    for(var i=list.length-1;
                        i>=0;
                        --i) {
                        var box=this.editor.boxes._getFromId(list[i]);
                        if(box)Zedity.core._call(box, 'destroy')
                    }
                    Zedity.core.gc.deleteReference(list)
                }
                , _saveUndo:function() {
                    if(this.editor._data.undoing)return;
                    if(this.editor._data.savingundo)return;
                    this.editor._data.savingundo=true;
                    var idx=Zedity.core.store.get('zedUnIndex')||-1;
                    idx++;
                    Zedity.core.store.set('zedUnIndex', idx);
                    Zedity.core.gc.removeReference(Zedity.core.store.get('zedUnRef'+(idx-this.editor._options.undoSteps)));
                    Zedity.core.store.del('zedUnPage'+(idx-this.editor._options.undoSteps));
                    Zedity.core.store.del('zedUnRef'+(idx-this.editor._options.undoSteps));
                    for(var i=idx, num=idx+this.editor._options.undoSteps;
                        i<=num;
                        i++) {
                        Zedity.core.gc.removeReference(Zedity.core.store.get('zedUnRef'+i));
                        Zedity.core.store.del('zedUnPage'+i);
                        Zedity.core.store.del('zedUnRef'+i)
                    }
                    var $content=$(this._getPage());
                    var list=$content.children('.zedity-box').map(function() {
                            return $(this).attr('id')
                        }
                    ).get();
                    Zedity.core.store.set('zedUnPage'+idx, $content[0].outerHTML);
                    Zedity.core.store.set('zedUnRef'+idx, list.join(' '));
                    Zedity.core.gc.addReference(list);
                    this._destroyUnreferencedObjects();
                    this.editor._data.savingundo=false
                }
                , _clearUndo:function() {
                    var idx=Zedity.core.store.get('zedUnIndex');
                    if(!idx)idx=0;
                    var content=Zedity.core.store.get('zedUnPage'+idx)||'';
                    Zedity.core.store.delprefix('zedUn');
                    Zedity.core.store.set('zedUnPage0', content);
                    Zedity.core.store.set('zedUnIndex', 0);
                    var list=$(content).children('.zedity-box').map(function() {
                            return $(this).attr('id')
                        }
                    ).get();
                    Zedity.core.store.set('zedUnRef0', list.join(' '));
                    Zedity.core.gc.flushData();
                    Zedity.core.gc.addReference(list);
                    this._destroyUnreferencedObjects()
                }
                , _undo:function() {
                    this.editor._data.undoing=true;
                    var idx=Zedity.core.store.get('zedUnIndex');
                    idx--;
                    var content=Zedity.core.store.get('zedUnPage'+idx);
                    if(content) {
                        Zedity.core.store.set('zedUnIndex', idx);
                        this._setPage(content);
                        this.editor._changed()
                    }
                    this.editor._data.undoing=false
                }
                , _redo:function() {
                    this.editor._data.undoing=true;
                    var idx=Zedity.core.store.get('zedUnIndex');
                    idx++;
                    var content=Zedity.core.store.get('zedUnPage'+idx);
                    if(content) {
                        Zedity.core.store.set('zedUnIndex', idx);
                        this._setPage(content);
                        this.editor._changed()
                    }
                    this.editor._data.undoing=false
                }
                , size:function(size) {
                    if(!size) {
                        size= {
                            width: Math.round(this.editor.$this.width()), height: Math.round(this.editor.$this.height())
                        }
                    }
                    else {
                        if(this.editor._options.resizable) {
                            size= {
                                width: size.width||Math.round(this.editor.$this.width()), height: size.height||Math.round(this.editor.$this.height())
                            }
                        }
                        else {
                            size= {
                                width: this.editor._options.width||Math.round(this.editor.$this.width()), height: this.editor._options.height||Math.round(this.editor.$this.height())
                            }
                        }
                        var sc=this.sizeConstraints();
                        size.width=Math.max(size.width, sc.minWidth);
                        size.height=Math.max(size.height, sc.minHeight);
                        size.width=Math.min(size.width, sc.maxWidth);
                        size.height=Math.min(size.height, sc.maxHeight);
                        this.editor.$this.css(size);
                        this.editor.$this.children('.zedity-box').each(function(idx, elem) {
                                Zedity.core._call($(elem).box(), 'reposition')
                            }
                        );
                        this.editor.boxes.refreshSelected();
                        this.editor._changed()
                    }
                    return size
                }
                , resizeToBox:function(box, tocontent) {
                    var old=box.asBackground();
                    box.asBackground(false);
                    if(tocontent)box.resizeToContent();
                    this.size( {
                            width: box.$this.outerWidth(), height: box.$this.outerHeight()
                        }
                    );
                    box.asBackground(old);
                    this.editor.boxes._select(null);
                    this.editor._changed();
                    return this
                }
                , sizeConstraints:function() {
                    return {
                        minWidth: this._options.minWidth, maxWidth: this._options.maxWidth, minHeight: this._options.minHeight, maxHeight: this._options.maxHeight
                    }
                }
                , extractText:function(type) {
                    var text='';
                    var boxes=this.editor.boxes.get(type);
                    for(var i=boxes.length-1;
                        i>=0;
                        --i) {
                        text+=boxes[i].extractText()+' '
                    }
                    return Zedity.utils.cleanText(text)
                }
                , content:function(content) {
                    if(content==null) {
                        content=this._getPage()
                    }
                    else {
                        this._setPage(content);
                        this.editor.boxes._select(null);
                        this.editor._changed()
                    }
                    return content
                }
            }
        );
        Zedity.core.store.delprefix('zedUn');
        Zedity.core.gc.flushData()
    }

)(jQuery);
(function($) {
        Zedity.utils=Zedity.utils|| {}
        ;
        Zedity.utils.formatHtml=function(html) {
            function cleanTag(tag) {
                var tagout='';
                tag=tag.replace(/\n/g, ' ').replace(/[\s] {
                    2,
                }
            /g, ' ').replace(/^\s+|\s+$/g, ' ');
                var suffix='';
                if(tag.match(/\/$/)) {
                    suffix='/';
                    tag=tag.replace(/\/+$/, '')
                }
                var m, partRe=/\s*([^=]+)(?:=((['"']).*?\3|[^]+))?/;
                while(m=partRe.exec(tag)) {
                    if(m[2]) {
                        tagout+=m[1].toLowerCase()+'='+m[2]
                    }
                    else if(m[1]) {
                        tagout+=m[1].toLowerCase()
                    }
                    tagout+=' ';
                    tag=tag.substr(m[0].length)
                }
                return tagout.replace(/\s*$/, '')+suffix+'>'
            }
            ;
            function placeTag(tag, out) {
                var nl=tag.match(newLevel);
                if(tag.match(lineBefore)||nl)out=out.replace(/\s*$/, '')+'\n';
                if(nl&&tag.charAt(1)=='/')level--;
                if(out.charAt(out.length-1)=='\n')out+=tabs();
                if(nl&&tag.charAt(1)!='/')level++;
                out+=tag;
                if(tag.match(lineAfter)||tag.match(newLevel))out=out.replace(/ *$/, '')+'\n';
                return out
            }
            ;
            function tabs() {
                var s='';
                for(var j=0;
                    j<level;
                    j++)s+='\t';
                return s
            }
            ;
            var ownLine=['area', 'body', 'head', 'hr', 'i?frame', 'link', 'meta', 'noscript', 'style', 'table', 'tbody', 'thead', 'tfoot'];
            var contOwnLine=['li', 'dt', 'dt', 'h[1-6]', 'option', 'script'];
            var lineBefore=new RegExp('^<(/?'+ownLine.join('|/?')+'|'+contOwnLine.join('|')+')[ >]');
            var lineAfter=new RegExp('^<(br|/?'+ownLine.join('|/?')+'|/'+contOwnLine.join('|/')+')[ >]');
            var newLevel=['blockquote', 'div', 'dl', 'fieldset', 'form', 'frameset', 'map', 'ol', 'p', 'pre', 'select', 'td', 'th', 'tr', 'ul'];
            newLevel=new RegExp('^</?('+newLevel.join('|')+')[ >]');
            var level=0, point=0, start=null, end=null, tag='', out='', cont='';
            for(var i=0, len=html.length;
                i<len;
                ++i) {
                point=i;
                if(html.substr(i).indexOf('<')==-1) {
                    out+=html.substr(i);
                    break
                }
                while(point<html.length&&html.charAt(point)!='<')point++;
                if(i!=point) {
                    cont=html.substr(i, point-i);
                    if(!cont.match(/^\s+$/)) {
                        if(out.charAt(out.length-1)=='\n') {
                            out+=tabs()
                        }
                        else if(cont.charAt(0)=='\n') {
                            out+='\n'+tabs();
                            cont=cont.replace(/^\s+/, '')
                        }
                        cont=cont.replace(/\s+/g, ' ');
                        out+=cont
                    }
                    if(cont.match(/\n/))out+='\n'+tabs()
                }
                start=point;
                while(point<html.length&&'>'!=html.charAt(point))point++;
                tag=html.substr(start, point-start);
                i=point;
                if(tag.substr(1, 3)=='!--') {
                    if(!tag.match(/--$/)) {
                        while(html.substr(point, 3)!='-->')point++;
                        point+=2;
                        tag=html.substr(start, point-start);
                        i=point
                    }
                    if(out.charAt(out.length-1)!='\n')out+='\n';
                    out+=tabs()+tag+'>\n'
                }
                else if(tag[1]=='!') {
                    out=placeTag(tag+'>', out)
                }
                else if(tag[1]=='?') {
                    out+=tag+'>\n'
                }
                else if(t=tag.match(/^<(script|style)/i)) {
                    var t;
                    t[1]=t[1].toLowerCase();
                    tag=cleanTag(tag);
                    out=placeTag(tag, out);
                    end=String(html.substr(i+1)).toLowerCase().indexOf('</'+t[1]);
                    if(end) {
                        cont=html.substr(i+1, end);
                        i+=end;
                        out+=cont
                    }
                }
                else {
                    tag=cleanTag(tag);
                    out=placeTag(tag, out)
                }
            }
            return out.replace(/\n\s*\n/g, '\n').replace(/^[\s\n]*/, '').replace(/[\s\n]*$/, '')
        }
    }

)(jQuery);
(function($) {
        if(!Zedity)throw new Error(Zedity.t('%s needs %s.', 'Zedity.Box', 'Zedity'));
        Zedity.Box=function(options) {
            options=options|| {}
            ;
            this.editor=options.editor||Zedity.editors[Zedity.editors.length-1];
            this._options=$.extend( {
                    x: undefined, y: undefined, width: 100, height: 50, maxBoxes: undefined
                }
                , this._defaults, this.editor._options.Box, this.editor._options[this.type], options);
            this._can=['background', 'asBackground', 'corners', 'rotation', 'flip'];
            this._data= {}
            ;
            if(this._options.id) {
                this.id=this._options.id;
                this.$this=this.editor.$this.find('#'+this.id)
            }
            else if(this._options.element) {
                this.$this=this._options.element;
                this.id=Zedity.core.genId('zeb');
                this.$this.attr('id', this.id)
            }
            else {
                this.editor.step=(this.editor.step+20)%Math.min(this.editor.page.size().width, this.editor.page.size().height);
                this._options=$.extend( {
                        x: this.editor.step, y: this.editor.step
                    }
                    , this._options);
                this.id=Zedity.core.genId('zeb');
                this.editor.$this.append($('<div/>', {
                        id:this.id, 'class':'zedity-box zedity-box-'+this.type, 'data-boxtype':this.type, css: {
                            position: 'absolute', left: this._options.x, top: this._options.y, width: this._options.width, height: this._options.height, 'background-color': 'transparent'
                        }
                    }
                ));
                this.$this=this.editor.$this.find('#'+this.id)
            }
            this.$this.css('overflow', '');
            if(this._options.maxBoxes) {
                var boxes=this.editor.boxes.get(this.type);
                if(boxes.length>=this._options.maxBoxes) {
                    this.$this.remove();
                    throw new Error(Zedity.t('Too many "%s" boxes (limit: %s).', this.type, this._options.maxBoxes))
                }
            }
            if(this.editor._options.maxTotalBoxes) {
                var boxes=this.editor.boxes.get();
                if(boxes.length>=this.editor._options.maxTotalBoxes) {
                    this.$this.remove();
                    throw new Error(Zedity.t('Too many total boxes (limit: %s).', this.editor._options.maxTotalBoxes))
                }
            }
            this.init()
        }
        ;
        $.extend(Zedity.Box.prototype, {
                _sizeLimits:function() {
                    var sl=Zedity.Box[this.type].sizeLimits;
                    var ps=this.editor.page.size();
                    return {
                        minWidth: sl.minWidth||16, maxWidth: sl.maxWidth, minHeight: sl.minHeight||16, maxHeight: sl.maxHeight
                    }
                }
                , element:function() {
                    this.$this=$('#'+this.id);
                    return this.$this
                }
                , content:function(content) {
                    if(content==null) {
                        content=this.$this.not('.zedity-empty,.ui-resizable-handle').html()
                    }
                    else {
                        this.$this.html(content);
                        this.editor._changed()
                    }
                    return content
                }
                , resizeToContent:function() {
                    var oldsize= {
                            w: this.$this.width(), h: this.$this.height()
                        }
                        ;
                    this.$this.css( {
                            width: this._sizeLimits().maxWidth||this.editor.page.size().width, height: this._sizeLimits().maxHeight||this.editor.page.size().width
                        }
                    );
                    var $content=this.$this.children('.zedity-content');
                    $content.css( {
                            display: 'inline-block', overflow: '', width: 'auto', height: ''
                        }
                    );
                    this.$this.css( {
                            width: $content.width()||oldsize.w, height: $content.height()||oldsize.h
                        }
                    );
                    $content.css( {
                            display: '', overflow: 'auto', width: '100%', height: '100%'
                        }
                    );
                    this._resize().reposition();
                    this.editor.boxes.refreshSelected();
                    this.editor._changed();
                    return this
                }
                , extractText:function($elem) {
                    var text='';
                    this._data.$clone=this._data.$clone||this.$this.clone();
                    $elem=$('<div/>').append(this._data.$clone);
                    $elem.find('.zedity-empty,.zedity-boxoverlay').remove();
                    $elem.find('p,h1,h2,h3,h4,h5,h6').append('<span> </span>');
                    $elem.find('br').replaceWith('<span> </span>');
                    text+=$elem.text()+' ';
                    $elem.find('[title]').each(function(idx, elem) {
                            text+=$(elem).attr('title')+' '
                        }
                    );
                    $elem.find('[alt]').each(function(idx, elem) {
                            text+=$(elem).attr('alt')+' '
                        }
                    );
                    delete this._data.$clone;
                    return Zedity.utils.cleanText(text)
                }
                , proportionalResize:function() {
                    return false
                }
                , _cssFinalize:function() {
                    function cleanup(css) {
                        return css.replace(/\s+/g, ' ').replace(/(;
                    |, |: ) /g, '$1').replace(/;
                        {
                            2,
                        }
                    /g, ';').replace(/(^;
                    |;
                        $)/, '')
                    }
                    ;
                    var css=(this.$this.attr('style')||'').replace(/background(-color|-image|)\s*?:.*?;
                    /g, '');
                    css+=';'+(this.$this.attr('data-zedcssbuffer')||'');
                    css=cleanup(css);
                    this.$this.attr('data-zedcssbuffer', css);
                    this.$this.prop('style', null);
                    this.$this.removeAttr('style');
                    var checkstyle=this.$this.attr('style');
                    if((typeof checkstyle!=='undefined')&&(checkstyle!==false)) {
                        this.editor._error( {
                                message: Zedity.t('Unexpected error: could not finalize box style.')
                            }
                        )
                    }
                    css=cleanup(this.$this.children('.zedity-content').attr('style')||'');
                    this.$this.children('.zedity-content').attr('style', css);
                    this.$this.children('.zedity-empty').removeAttr('style')
                }
                , _save:function(callback) {
                    if(this.$this.hasClass('zedity-selected'))this.editor.boxes._select(null);
                    if(this.$this.attr('data-href')) {
                        this.$this.attr('onclick', 'window.open(\''+this.$this.attr('data-href')+'\',\''+(this.$this.attr('data-target')||'_top')+'\');');
                        this.$this.css('cursor', 'pointer')
                    }
                    this.$this.removeAttr('id data-zed');
                    var flip=Zedity.core._call(this, 'flip');
                    Zedity.core._call(this, 'flip', flip);
                    Zedity.core._call(this, 'flip', flip);
                    Zedity.core._call(this, 'rotation', Zedity.core._call(this, 'rotation'));
                    Zedity.core._call(this, 'background', Zedity.core._call(this, 'background'));
                    this._cssFinalize();
                    if(typeof(callback)=='function')callback.call(this);
                    return this
                }
                , init:function() {
                    this.createPropBar();
                    var self=this;
                    this.$this.on('mouseup.zedity dragstart.zedity', function() {
                            self.select()
                        }
                    ).off('dblclick.zedity dbltap.zedity').on('dblclick.zedity dbltap.zedity', function() {
                            self.select().insert()
                        }
                    );
                    this.$this.on('repositionhandles.zedity', function() {
                            var $this=$(this);
                            var size=-parseInt(($this.css('border-top-width')||'0px').replace('px', ''), 10)-14;
                            $this.find('.ui-resizable-se').css( {
                                    right: size+'px', bottom: size+'px'
                                }
                            );
                            $this.find('.ui-rotatable-handle').css( {
                                    left: size+'px', bottom: size+'px'
                                }
                            )
                        }
                    );
                    this.$this.removeAttr('onclick').css('cursor', '');
                    this._initDrag();
                    return this
                }
                , _initDrag:function() {
                    var ed=this.editor;
                    this.$this.multiDraggable($.extend( {
                            group:'.zedity-editor .zedity-selected:not(.zedity-background)', cursor:'move', reposition:true, cancel:'.zedity-button', startNative:function() {}
                            , dragNative:function() {}
                            , stopNative:function() {
                                ed.$this.children('.zedity-selected').each(function(idx, elem) {
                                        $(elem).box().reposition();
                                        ed._changed()
                                    }
                                )
                            }
                        }
                        , this.rotation()==0? {
                            snapRealPage: true, snapTolerance: 12, snap: ed._getSnap(), snapToGrid: ed.grid&&this.editor.grid.snap(), snapFeedback: ed._options.snapBoxes
                        }
                            : {}
                    ));
                    return this
                }
                , options:function(options) {
                    this._options=$.extend(this._options, options);
                    return this._options
                }
                , select:function() {
                    if(this.$this.hasClass('zedity-editing')||this.$this.hasClass('zedity-playing'))return this;
                    if(this.editor.$this.find('.zedity-box.ui-draggable-dragging').not(this.$this).length)return this;
                    this.editor.boxes._select(this);
                    this.$this.trigger('repositionhandles.zedity');
                    return this
                }
                , can:function(feature) {
                    return this._can.indexOf(feature)>-1
                }
                , createPropBar:function(options) {
                    this.editor.menu.add( {
                            tabs: {
                                editbox: {
                                    icon:'editbox', title:Zedity.t('Edit box'), order:1000, show:function(ed, box) {
                                        return!!box
                                    }
                                    , groups: {
                                        layout: {
                                            title:Zedity.t('Layout'), order:0, features: {
                                                background: {
                                                    type:'toggle', class:'zedity-feature-boxbackground', order:0, state:[ {
                                                        label: Zedity.t('Background'), icon: 'expand', title: Zedity.t('Set selected box as background')
                                                    }
                                                        , {
                                                            label: Zedity.t('Background'), icon: 'shrink', title: Zedity.t('Unset box from background')
                                                        }
                                                    ], onclick:function(e, ed, before) {
                                                        var box=ed.boxes.selected();
                                                        if(!box)return false;
                                                        box.asBackground(before==0)
                                                    }
                                                    , enable:function(ed) {
                                                        var box=ed.boxes.selected();
                                                        if(!box)return false;
                                                        return box.can('asBackground')
                                                    }
                                                    , refresh:function(ed) {
                                                        var box=ed.boxes.selected();
                                                        if(!box)return;
                                                        this.$button.trigger('toggle', box.asBackground()?1: 0)
                                                    }
                                                }
                                                , arrange: {
                                                    type:'menu', icon:'arrange', label:Zedity.t('Arrange'), title:Zedity.t('Arrange box'), order:100, items:[ {
                                                        value: 'front', icon: 'arrange-front', label: Zedity.t('Bring to front')
                                                    }
                                                        , {
                                                            value: 'back', icon: 'arrange-back', label: Zedity.t('Send to back')
                                                        }
                                                        , '--', {
                                                            value: 'forward', icon: 'arrange-forward', label: Zedity.t('Bring forward')
                                                        }
                                                        , {
                                                            value: 'backward', icon: 'arrange-backward', label: Zedity.t('Send backward')
                                                        }
                                                    ], onclick:function(val, e, ed) {
                                                        var box=ed.boxes.selected();
                                                        if(!box)return;
                                                        box.arrange(val)
                                                    }
                                                    , enable:function(ed, box) {
                                                        return box&&!box.asBackground()
                                                    }
                                                }
                                            }
                                        }
                                        , edit: {
                                            title:Zedity.t('Editing'), order:200, features: {
                                                duplicate: {
                                                    label:Zedity.t('Duplicate'), icon:'duplicate', title:Zedity.t('Duplicate selected box'), order:10, onclick:function(e, ed) {
                                                        var box=ed.boxes.selected();
                                                        if(!box)return false;
                                                        box.duplicate()
                                                    }
                                                }
                                                , sep: {
                                                    type: 'separator', order: 20
                                                }
                                                , delete: {
                                                    label:Zedity.t('Delete'), icon:'delete', title:Zedity.t('Delete selected box'), order:30, onclick:function(e, ed) {
                                                        var box=ed.boxes.selected();
                                                        if(!box)return false;
                                                        box.remove();
                                                        box=ed.$this.children('.zedity-box:last-child').box();
                                                        if(box)box.select()
                                                    }
                                                }
                                            }
                                        }
                                        , flip: {
                                            title:Zedity.t('Flip'), order:300, features: {
                                                vertical: {
                                                    label:Zedity.t('Vertical'), icon:'flip', size:'xs', title:Zedity.t('Flip selected box vertically'), onclick:function(e, ed) {
                                                        var box=ed.boxes.selected();
                                                        if(!box)return false;
                                                        box.flip('ver')
                                                    }
                                                }
                                                , horizontal: {
                                                    label:Zedity.t('Horizontal'), icon:'flip zicon-rotate-90cc', size:'xs', title:Zedity.t('Flip selected box horizontally'), onclick:function(e, ed) {
                                                        var box=ed.boxes.selected();
                                                        if(!box)return false;
                                                        box.flip('hor')
                                                    }
                                                }
                                            }
                                            , enable:function(ed) {
                                                var box=ed.boxes.selected();
                                                if(!box)return false;
                                                return box.can('flip')
                                            }
                                        }
                                    }
                                }
                                , boxstyle: {
                                    icon:'style', title:Zedity.t('Box style'), order:1100, show:function(ed, box) {
                                        return!!box
                                    }
                                    , groups: {
                                        background: {
                                            title:Zedity.t('Background'), order:0, features: {
                                                color: {
                                                    type:'extpanel', label:Zedity.t('Color'), icon:'empty zicon-colorpicker', title:Zedity.t('Select background color'), order:0, build:function($panel, ed) {
                                                        this.$button.find('.zicon').width(30);
                                                        $panel.append('<div class="zedity-bgcolor-colorpicker"/>');
                                                        var $cp=$panel.find('.zedity-bgcolor-colorpicker');
                                                        $cp.colorPicker( {
                                                                colors:['transparent', '#ffffff', '#f2f2f2', '#d8d8d8', '#bdbdbd', '#a4a4a4', '#6e6e6e', '#424242', '#000000', '#fbefef', '#f8e0e0', '#f5a9a9', '#f78181', '#fe2e2e', '#df0101', '#b40404', '#8a0808', '#3b0b0b', '#fbf5ef', '#f8ece0', '#f5d0a9', '#faac58', '#ff8000', '#df7401', '#b45f04', '#8a4b08', '#3b240b', '#fbfbef', '#f5f6ce', '#f2f5a9', '#f4fa58', '#ffff00', '#d7df01', '#aeb404', '#868a08', '#393b0b', '#f5fbef', '#e3f6ce', '#d0f5a9', '#acfa58', '#80ff00', '#74df00', '#5fb404', '#4b8a08', '#38610b', '#effbef', '#cef6ce', '#a9f5a9', '#58fa58', '#00ff00', '#01df01', '#04b404', '#088a08', '#0b3b0b', '#effbfb', '#cef6f5', '#a9f5f2', '#58faf4', '#00ffff', '#01dfd7', '#04b4ae', '#088a85', '#0b3b39', '#eff5fb', '#cee3f6', '#81bef7', '#2e9afe', '#0080ff', '#045fb4', '#084b8a', '#08388a', '#0b243b', '#efeffb', '#cecef6', '#5858fa', '#2e2efe', '#0000ff', '#0404b4', '#08088a', '#0b0b61', '#0b0b3b', '#f5effb', '#e3cef6', '#be81f7', '#ac58fa', '#9a2efe', '#5f04b4', '#4b088a', '#380b61', '#240b3b', '#fbeffb', '#f6cef5', '#f781f3', '#fe2ef7', '#ff00ff', '#df01d7', '#b404ae', '#610b5e', '#3b0b39', '#fbeff5', '#f6cee3', '#f5a9d0', '#fa58ac', '#ff0080', '#df0174', '#b4045f', '#610b38', '#3b0b24'], defaultcolor:'#000000', fills:true, alpha:true, buttons:true, maxcols:9, onchange:function(e, color, fill, alpha) {
                                                                    var box=ed.boxes.selected();
                                                                    if(!box)return false;
                                                                    Zedity.core._call(box, 'background', fill);
                                                                    box.$this.find('.zedity-empty').remove();
                                                                    ed._changed()
                                                                }
                                                                , onchangealpha:function(event, alpha) {
                                                                    var box=ed.boxes.selected();
                                                                    if(!box)return false;
                                                                    var fill=$cp.colorPicker('getfill');
                                                                    Zedity.core._call(box, 'background', fill)
                                                                }
                                                            }
                                                        )
                                                    }
                                                    , refresh:function(ed, box) {
                                                        if(!box)return false;
                                                        var fill=box.background();
                                                        var $cp=this.$button.extpanel('instance').panel.find('.zedity-bgcolor-colorpicker');
                                                        $cp.colorPicker('selectfill', fill);
                                                        this.$button.find('.zicon').css('background', box.$this.css('background')||box.$this.css('background-image')||'transparent');
                                                        $cp.find('.zedity-colorbuttons').hide()
                                                    }
                                                    , enable:function(ed, box) {
                                                        return(box&&box.can('background')&&((box.type=='Color')||(box.type=='Text')||(box.$this.children('.zedity-empty').length==0)))
                                                    }
                                                }
                                            }
                                        }
                                        , opacity: {
                                            title:Zedity.t('Opacity'), order:50, features: {
                                                opacity: {
                                                    type:'extpanel', icon:'opacity', label:Zedity.t('Opacity'), title:Zedity.t('Box opacity'), order:100, build:function($panel, ed) {
                                                        $panel.append('<div class="zedity-opacitywrapper" style="width:250px">'+'<div class="zedity-slider zedity-slider-boxopacity" title="'+Zedity.t('Select box opacity')+'"></div>'+'<div class="zedity-slider zedity-slider-boxbgopacity" title="'+Zedity.t('Select background opacity')+'"></div>'+'</div>');
                                                        $panel.find('.zedity-slider-boxopacity').sliderSnap( {
                                                                label:Zedity.t('Box opacity'), min:20, max:100, value:100, slide:function(e, ui) {
                                                                    var box=ed.boxes.selected();
                                                                    if(!box)return;
                                                                    var val=ui.value/100;
                                                                    box.$this.css('opacity', val==1?'': val)
                                                                }
                                                                , stop:function() {
                                                                    ed._changed()
                                                                }
                                                            }
                                                        );
                                                        $panel.find('.zedity-slider-boxbgopacity').sliderSnap( {
                                                                label:Zedity.t('Background opacity'), min:0, max:100, value:100, slide:function(e, ui) {
                                                                    var box=ed.boxes.selected();
                                                                    if(!box)return;
                                                                    var fill=box.background();
                                                                    fill.alpha=ui.value/100;
                                                                    Zedity.core._call(box, 'background', fill)
                                                                }
                                                                , stop:function() {
                                                                    ed._changed()
                                                                }
                                                            }
                                                        )
                                                    }
                                                }
                                            }
                                            , refresh:function(ed, box) {
                                                if(!box)return;
                                                var s=box.shadow();
                                                var $p=this.$panel.find('.zedity-extpanel-button[data-name=opacity]').extpanel('instance').panel;
                                                $p.find('.zedity-slider-boxopacity').sliderSnap('value', parseFloat(box.$this.css('opacity')||'1')*100);
                                                $p.find('.zedity-slider-boxbgopacity').sliderSnap('value', (box.background().alpha||1)*100)
                                            }
                                        }
                                        , border: {
                                            title:Zedity.t('Border'), order:100, features: {
                                                style: {
                                                    type:'menu', order:10, items:['solid', 'dashed', 'dotted', 'double', 'groove', 'ridge', 'inset', 'outset'], title:Zedity.t('Select border style'), onclick:function(val, e, ed) {
                                                        var box=ed.boxes.selected();
                                                        if(!box)return false;
                                                        box.$this.css('border-style', val);
                                                        box.$this.css('border-color', box.$this.css('border-top-color')||'#000000');
                                                        box.$this.css('border-width', box.$this.css('border-top-width')||'0px');
                                                        ed._changed()
                                                    }
                                                    , refresh:function(ed) {
                                                        var box=ed.boxes.selected();
                                                        if(!box)return false;
                                                        this.$menu.val(box.$this.css('border-top-style')||'solid').selectmenu('refresh')
                                                    }
                                                }
                                                , color: {
                                                    type:'extpanel', label:Zedity.t('Color'), icon:'empty zicon-colorpicker', title:Zedity.t('Select border color'), size:'xs', order:10, build:function($panel, ed) {
                                                        this.$button.find('.zicon').width(30);
                                                        $panel.append('<div class="zedity-bordercolor-colorpicker"/>');
                                                        var $cp=$panel.find('.zedity-bordercolor-colorpicker');
                                                        $cp.colorPicker( {
                                                                colors:['#ffffff', '#f2f2f2', '#d8d8d8', '#bdbdbd', '#a4a4a4', '#6e6e6e', '#424242', '#2e2e2e', '#000000', '#fbefef', '#f8e0e0', '#f5a9a9', '#f78181', '#fe2e2e', '#df0101', '#b40404', '#8a0808', '#3b0b0b', '#fbf5ef', '#f8ece0', '#f5d0a9', '#faac58', '#ff8000', '#df7401', '#b45f04', '#8a4b08', '#3b240b', '#fbfbef', '#f5f6ce', '#f2f5a9', '#f4fa58', '#ffff00', '#d7df01', '#aeb404', '#868a08', '#393b0b', '#f5fbef', '#e3f6ce', '#d0f5a9', '#acfa58', '#80ff00', '#74df00', '#5fb404', '#4b8a08', '#38610b', '#effbef', '#cef6ce', '#a9f5a9', '#58fa58', '#00ff00', '#01df01', '#04b404', '#088a08', '#0b3b0b', '#effbfb', '#cef6f5', '#a9f5f2', '#58faf4', '#00ffff', '#01dfd7', '#04b4ae', '#088a85', '#0b3b39', '#eff5fb', '#cee3f6', '#81bef7', '#2e9afe', '#0080ff', '#045fb4', '#084b8a', '#08388a', '#0b243b', '#efeffb', '#cecef6', '#5858fa', '#2e2efe', '#0000ff', '#0404b4', '#08088a', '#0b0b61', '#0b0b3b', '#f5effb', '#e3cef6', '#be81f7', '#ac58fa', '#9a2efe', '#5f04b4', '#4b088a', '#380b61', '#240b3b', '#fbeffb', '#f6cef5', '#f781f3', '#fe2ef7', '#ff00ff', '#df01d7', '#b404ae', '#610b5e', '#3b0b39', '#fbeff5', '#f6cee3', '#f5a9d0', '#fa58ac', '#ff0080', '#df0174', '#b4045f', '#610b38', '#3b0b24'], defaultcolor:'#000000', alpha:true, buttons:true, maxcols:9, onchange:function(e, color, fill, alpha) {
                                                                    var box=ed.boxes.selected();
                                                                    if(!box)return false;
                                                                    box.$this.css('border-color', Zedity.utils.hash2rgba(color, $cp.colorPicker('getalpha')));
                                                                    box.$this.css('border-style', box.$this.css('border-top-style')||'solid');
                                                                    box.$this.css('border-width', box.$this.css('border-top-width')||'0px');
                                                                    ed._changed()
                                                                }
                                                                , onchangealpha:function(event, alpha) {
                                                                    var box=ed.boxes.selected();
                                                                    if(!box)return false;
                                                                    box.$this.css('border-color', Zedity.utils.hash2rgba($cp.colorPicker('getcolor'), alpha))
                                                                }
                                                            }
                                                        )
                                                    }
                                                    , refresh:function(ed, box) {
                                                        if(!box)return false;
                                                        var c=box.$this.css('border-top-color')||'#000000';
                                                        var $cp=this.$button.extpanel('instance').panel.find('.zedity-bordercolor-colorpicker');
                                                        $cp.colorPicker('selectcolor', c);
                                                        this.$button.find('.zicon').css('background', c);
                                                        $cp.find('.zedity-colorbuttons').hide()
                                                    }
                                                }
                                                , width: {
                                                    type:'smallpanel', order:100, build:function($panel, ed) {
                                                        $panel.append('<div style="margin:10px 2px;width:120px">'+'<div class="zedity-slider zedity-borderwidth" title="'+Zedity.t('Select border width')+'"/>'+'</div>');
                                                        $panel.find('.zedity-borderwidth').sliderSnap( {
                                                                label:Zedity.t('Width'), min:0, max:50, slide:function(e, ui) {
                                                                    var box=ed.boxes.selected();
                                                                    if(!box)return false;
                                                                    box.$this.css('border-width', ui.value);
                                                                    box.$this.css('border-style', box.$this.css('border-top-style')||'solid');
                                                                    box.$this.css('border-color', box.$this.css('border-top-color')||'#000000');
                                                                    box.$this.trigger('repositionhandles.zedity');
                                                                    Zedity.core._call(box, 'corners', box.corners())
                                                                }
                                                                , stop:function(e, ui) {
                                                                    ed._changed()
                                                                }
                                                            }
                                                        )
                                                    }
                                                    , refresh:function(ed) {
                                                        var box=ed.boxes.selected();
                                                        if(!box)return false;
                                                        this.$panel.find('.zedity-borderwidth').sliderSnap('value', parseInt(box.$this.css('border-width')||0, 10))
                                                    }
                                                }
                                            }
                                        }
                                        , corners: {
                                            title:Zedity.t('Corners'), order:200, features: {
                                                corners: {
                                                    type:'panel', order:100, build:function($panel, ed) {
                                                        $panel.append('<div class="zedity-cornersselector">'+'<div class="zedity-corner zedity-cornertopleft zedity-selected" title="'+Zedity.t('Top left corner')+'" data-cornertype="border-top-left-radius"></div>'+'<div class="zedity-corner zedity-cornertopright zedity-selected" title="'+Zedity.t('Top right corner')+'" data-cornertype="border-top-right-radius"></div>'+'<div class="zedity-corner zedity-cornerbottomleft zedity-selected" title="'+Zedity.t('Bottom left corner')+'" data-cornertype="border-bottom-left-radius"></div>'+'<div class="zedity-corner zedity-cornerbottomright zedity-selected" title="'+Zedity.t('Bottom right corner')+'" data-cornertype="border-bottom-right-radius"></div>'+'</div>'+'<div style="margin-top:10px;width:120px">'+'<div class="zedity-radiusselector" title="'+Zedity.t('Rounded corners')+'"></div>'+'</div>');
                                                        var $corners=$panel.find('.zedity-corner');
                                                        $corners.on('click.zedity', function() {
                                                                $(this).toggleClass('zedity-selected')
                                                            }
                                                        );
                                                        $panel.find('.zedity-radiusselector').sliderSnap( {
                                                                label:Zedity.t('Radius'), min:0, max:100, slide:function(e, ui) {
                                                                    var box=ed.boxes.selected();
                                                                    if(!box)return false;
                                                                    var c= {}
                                                                        ;
                                                                    $corners.each(function(idx, elem) {
                                                                            var $elem=$(elem);
                                                                            if($elem.hasClass('zedity-selected')) {
                                                                                c[$elem.attr('data-cornertype')]=ui.value
                                                                            }
                                                                        }
                                                                    );
                                                                    Zedity.core._call(box, 'corners', c)
                                                                }
                                                                , stop:function(e, ui) {
                                                                    ed._changed()
                                                                }
                                                            }
                                                        )
                                                    }
                                                    , refresh:function(ed) {
                                                        var box=ed.boxes.selected();
                                                        if(!box)return false;
                                                        var c=box.corners(), size=0;
                                                        for(var i in c)size+=parseInt(c[i], 10);
                                                        size=Math.floor(size/4);
                                                        this.$panel.find('.zedity-radiusselector').sliderSnap('value', size)
                                                    }
                                                }
                                            }
                                            , enable:function(ed) {
                                                var box=ed.boxes.selected();
                                                if(!box)return false;
                                                return box.can('corners')
                                            }
                                        }
                                    }
                                }
                            }
                        }
                        , 'box')
                }
                , showPropBar:function() {
                    return this
                }
                , start:function() {
                    return this
                }
                , stop:function() {
                    return this
                }
                , insert:function() {
                    return this
                }
                , reposition:function(forceinside) {
                    var ofs=0;
                    var bb=this._boundingBox();
                    var w=this.editor.page.size().width;
                    var h=this.editor.page.size().height;
                    var minpixels=10;
                    if(forceinside||(bb.left>w)||(bb.left+bb.width<0)||(bb.top+bb.height<0)||(bb.top>h)) {
                        if(bb.left+bb.width>w) {
                            this.$this.css('left', w-bb.width+bb.dx-ofs)
                        }
                        else if(bb.left<0) {
                            this.$this.css('left', bb.dx-ofs)
                        }
                        if(bb.top+bb.height>h) {
                            this.$this.css('top', h-bb.height+bb.dy-ofs)
                        }
                        else if(bb.top<0) {
                            this.$this.css('top', bb.dy-ofs)
                        }
                    }
                    else if((bb.left+minpixels>w)||(bb.left+bb.width-minpixels<0)||(bb.top+bb.height-minpixels<0)||(bb.top+minpixels>h)) {
                        if(bb.left+minpixels>w) {
                            this.$this.css('left', w-minpixels+bb.dx-ofs)
                        }
                        else if(bb.left+bb.width-minpixels<0) {
                            this.$this.css('left', bb.dx-bb.width+minpixels-ofs)
                        }
                        if(bb.top+minpixels>h) {
                            this.$this.css('top', h-minpixels+bb.dy-ofs)
                        }
                        else if(bb.top+bb.height-minpixels<0) {
                            this.$this.css('top', bb.dy-bb.height+minpixels-ofs)
                        }
                    }
                    return this
                }
                , rect:function(rect) {
                    if(rect!=null) {
                        for(var i in rect)if('left top width height'.indexOf(i)==-1)delete rect[i];
                        this.$this.css(rect);
                        this.reposition()._resize();
                        this.editor._changed()
                    }
                    rect= {
                        left: parseInt(this.$this.css('left'), 10), top: parseInt(this.$this.css('top'), 10), width: parseInt(this.$this.css('width'), 10), height: parseInt(this.$this.css('height'), 10)
                    }
                    ;
                    return rect
                }
                , arrange:function(where) {
                    if(this.asBackground())return this;
                    where=where||'front';
                    var group=$.makeArray(this.$this.editor().$this.children('.zedity-box:not(.zedity-background)')).sort(function(a, b) {
                            return(parseInt($(a).css('zIndex'), 10)||0)-(parseInt($(b).css('zIndex'), 10)||0)
                        }
                    );
                    if(group.length) {
                        var objidx=null;
                        var min=10;
                        var $this=this.$this;
                        $(group).each(function(i, elem) {
                                this.style.zIndex=min+i*2;
                                if($this.is(elem))objidx=i
                            }
                        );
                        switch(where.toLowerCase()) {
                            case'front': this.$this[0].style.zIndex=min+group.length*2;
                                break;
                            case'back': this.$this[0].style.zIndex=min-1;
                                break;
                            case'forward': this.$this[0].style.zIndex=Math.min(min+(objidx*2)+3, min+group.length*2+1);
                                break;
                            case'backward': this.$this[0].style.zIndex=Math.max(min+(objidx*2)-3, min-1);
                                break;
                            case'background': this.$this[0].style.zIndex=1;
                                break
                        }
                    }
                    this.editor._changed();
                    return this
                }
                , _resize:function() {
                    if(this.$this.width()<this._sizeLimits().minWidth)this.$this.css('width', this._sizeLimits().minWidth);
                    if(this.$this.width()>this._sizeLimits().maxWidth)this.$this.css('width', this._sizeLimits().maxWidth);
                    if(this.$this.height()<this._sizeLimits().minHeight)this.$this.css('height', this._sizeLimits().minHeight);
                    if(this.$this.height()>this._sizeLimits().maxHeight)this.$this.css('height', this._sizeLimits().maxHeight);
                    return this
                }
                , _boundingBox:function() {
                    var theta_deg=this.rotation();
                    Zedity.core._call(this, 'rotation', 0);
                    var w=this.$this.outerWidth();
                    var h=this.$this.outerHeight();
                    var x=this.$this.position().left;
                    var y=this.$this.position().top;
                    Zedity.core._call(this, 'rotation', theta_deg);
                    var d=Math.sqrt(w*w+h*h);
                    var t0_rad=Math.acos(w/d);
                    var t_rad=-theta_deg*0.017453292519943295769236907684883;
                    var r=0.5*d;
                    var x0=x+0.5*w;
                    var y0=y+0.5*h;
                    var rcos_sum=r*Math.cos(t_rad+t0_rad);
                    var rsin_sum=r*Math.sin(t_rad+t0_rad);
                    var rcos_dif=r*Math.cos(t_rad-t0_rad);
                    var rsin_dif=r*Math.sin(t_rad-t0_rad);
                    var c1=Array(x0+rcos_sum, y0-rsin_sum);
                    var c2=Array(x0-rcos_dif, y0+rsin_dif);
                    var c3=Array(x0-rcos_sum, y0+rsin_sum);
                    var c4=Array(x0+rcos_dif, y0-rsin_dif);
                    var bounds= {}
                        ;
                    bounds.left=Math.round(Math.min(c1[0], c2[0], c3[0], c4[0]));
                    bounds.right=Math.round(Math.max(c1[0], c2[0], c3[0], c4[0]));
                    bounds.top=Math.round(Math.min(c1[1], c2[1], c3[1], c4[1]));
                    bounds.bottom=Math.round(Math.max(c1[1], c2[1], c3[1], c4[1]));
                    bounds.width=bounds.right-bounds.left;
                    bounds.height=bounds.bottom-bounds.top;
                    bounds.dx=x-bounds.left;
                    bounds.dy=y-bounds.top;
                    return bounds
                }
                , duplicate:function() {
                    var id=Zedity.core.genId('zeb');
                    this.editor.boxes._select(null);
                    var $new=this.$this.clone();
                    $new.appendTo(this.editor.$this).attr('id', id);
                    var box=this.editor.boxes.add(this.type, {
                            id: id, editor: this.editor
                        }
                    );
                    box._data=$.extend(true, {}
                        , this._data);
                    box.init();
                    Zedity.core._call(box, 'asBackground', false);
                    $new.css( {
                            left: $new.position().left+30, top: $new.position().top+30
                        }
                    );
                    this.editor.boxes.refreshSelected();
                    this.editor._changed();
                    return box
                }
                , asBackground:function(setting) {
                    var current=this.$this.hasClass('zedity-background');
                    if(setting===current)return current;
                    if(setting===false) {
                        var data=this.$this.zdata('boxbg')|| {}
                            ;
                        this.$this.zdata('boxbg', null);
                        this.$this.removeClass('zedity-background').css( {
                                left: data.left||this._options.x, top: data.top||this._options.y, width: data.width||this._options.width, height: data.height||this._options.height, 'z-index': 100, 'box-sizing': ''
                            }
                        );
                        Zedity.core._call(this, 'rotation', data.rotation);
                        Zedity.core._call(this, 'arrange', 'front');
                        this._initDrag().reposition();
                        this.editor._changed()
                    }
                    else if(setting===true) {
                        var $box=this.editor.$this.children('.zedity-background');
                        if($box.length>0) {
                            this.editor._data.settingbackground=true;
                            $box.each(function(idx, elem) {
                                    $(elem).box().asBackground(false)
                                }
                            );
                            this.editor._data.settingbackground=false
                        }
                        this.$this.zdata('boxbg', {
                                left: this.$this.css('left'), top: this.$this.css('top'), width: this.$this.css('width'), height: this.$this.css('height'), rotation: this.rotation()
                            }
                        );
                        Zedity.core._call(this, 'arrange', 'background');
                        Zedity.core._call(this, 'rotation', 0);
                        this.$this.draggable('destroy');
                        this.$this.addClass('zedity-background').css( {
                                left: 0, top: 0, width: '100%', height: '100%', 'box-sizing': 'border-box'
                            }
                        );
                        this.editor._changed()
                    }
                    else {
                        return current
                    }
                    this.editor.boxes.refreshSelected();
                    return current
                }
                , rotation:function(angle) {
                    if(angle!=null) {
                        angle=Math.round(parseFloat(angle));
                        var $this=this.$this;
                        this.$this.attr('style', (this.$this.attr('style')||'').replace(/(?: -o-|-ms-|-moz-|-webkit-|)transform.*?;
                    /g, ''));
                        if(angle!=0) {
                            var css='-webkit-transform:rotate('+angle+'deg);'+'-moz-transform:rotate('+angle+'deg);'+'-ms-transform:rotate('+angle+'deg);'+'-o-transform:rotate('+angle+'deg);'+'transform:rotate('+angle+'deg);';
                            this.$this.attr('style', this.$this.attr('style')+';'+css)
                        }
                        this.editor._changed()
                    }
                    else {
                        var ret=this.$this.css('transform')||this.$this.css('-webkit-transform')||this.$this.css('-o-transform')||this.$this.css('-moz-transform')||this.$this.css('-ms-transform');
                        if(/rotate/.test(ret)) {
                            angle=/rotate\s*?\(\s*?(.*?)\s*?deg\s*?\)/.exec(ret);
                            angle=angle?angle[1]: 0
                        }
                        else if(/matrix/.test(ret)) {
                            var m=/matrix\s*?\(\s*?(.*?), \s*?(.*?), \s*?(.*?), \s*?(.*?), \s*?(.*?), \s*?(.*?)\s*?\)/.exec(ret);
                            if(m) {
                                angle=Math.acos((parseFloat(m[1])+parseFloat(m[4]))/2)*57.295779513082320876798154814114;
                                if(parseFloat(m[2])<0)angle=-angle
                            }
                            else {
                                angle=0
                            }
                        }
                        else {
                            angle=0
                        }
                        angle=Math.round(parseFloat(angle))
                    }
                    return angle
                }
                , background:function(fill) {
                    if(fill) {
                        fill=$.extend( {
                                type: 'solid', colors: [fill.color]
                            }
                            , fill);
                        var gradient='';
                        var css='';
                        this.$this.attr('style', (this.$this.attr('style')||'').replace(/background(-color|-image|)\s*?:.*?;
                    /g, ''));
                        this.$this.attr('data-zedcssbuffer', (this.$this.attr('data-zedcssbuffer')||'').replace(/background(-color|-image|)\s*?:.*?;
                    /g, ''));
                        switch(fill.type.toLowerCase()) {
                            case'solid': css='background-color:'+Zedity.utils.hash2rgba(fill.colors[0], fill.alpha)+';';
                                break;
                            case'horizontal': gradient=Zedity.utils.hash2rgba(fill.colors[0], fill.alpha)+' 0%,'+Zedity.utils.hash2rgba(fill.colors[1], fill.alpha)+' 100%);';
                                css='background-image:-webkit-linear-gradient(left,'+gradient+'background-image:-moz-linear-gradient(left,'+gradient+'background-image:-ms-linear-gradient(left,'+gradient+'background-image:-o-linear-gradient(left,'+gradient+'background-image:linear-gradient(to right,'+gradient;
                                break;
                            case'vertical': gradient=Zedity.utils.hash2rgba(fill.colors[0], fill.alpha)+' 0%,'+Zedity.utils.hash2rgba(fill.colors[1], fill.alpha)+' 100%);';
                                css='background-image:-webkit-linear-gradient(top,'+gradient+'background-image:-moz-linear-gradient(top,'+gradient+'background-image:-ms-linear-gradient(top,'+gradient+'background-image:-o-linear-gradient(top,'+gradient+'background-image:linear-gradient(to bottom,'+gradient;
                                break;
                            case'radial': gradient=Zedity.utils.hash2rgba(fill.colors[0], fill.alpha)+' 0%,'+Zedity.utils.hash2rgba(fill.colors[1], fill.alpha)+' 100%);';
                                css='background-image:-webkit-radial-gradient(center,ellipse cover,'+gradient+'background-image:-moz-radial-gradient(center,ellipse cover,'+gradient+'background-image:-ms-radial-gradient(center,ellipse cover,'+gradient+'background-image:-o-radial-gradient(center,ellipse cover,'+gradient+'background-image:radial-gradient(ellipse at center,'+gradient;
                                break
                        }
                        this.$this.attr('style', this.$this.attr('style')+';'+css);
                        this.$this.attr('data-zedcssbuffer', this.$this.attr('data-zedcssbuffer')+';'+css);
                        this.editor._changed();
                        return fill
                    }
                    else {
                        var param='(?:((?!rgb|#|hsl).*?),)?';
                        var color='\\s*(.*?)\\s*\\d*(?:%|px)';
                        var rxlg=new RegExp('linear-gradient\\('+param+color+','+color+'\\)');
                        var rxrg=new RegExp('radial-gradient\\('+param+'\\s*'+param+color+','+color+'\\)');
                        var bg=(this.$this.attr('data-zedcssbuffer')||this.$this.attr('style')||'').toLowerCase();
                        if(bg.indexOf('background-image')>-1) {
                            bg=bg.replace(/.*?(background-image: .*?;
                        ).*/, '$1')
                        }
                        else {
                            bg='none'
                        }
                        if(bg&&bg.toLowerCase()!='none') {
                            var cfill= {}
                                ;
                            var match=null;
                            if(match=rxlg.exec(bg)) {
                                switch((match[1]||'').toLowerCase()) {
                                    case'left': case'to right': cfill.type='horizontal';
                                    break;
                                    case'top': case'to bottom': default: cfill.type='vertical';
                                    break
                                }
                                cfill.colors=[Zedity.utils.rgb2hash(match[2]), Zedity.utils.rgb2hash(match[3])];
                                cfill.alpha=Zedity.utils.rgba2alpha(match[2])||Zedity.utils.rgba2alpha(match[3])||1;
                                return cfill
                            }
                            else if(match=rxrg.exec(bg)) {
                                cfill.type='radial';
                                cfill.colors=[Zedity.utils.rgb2hash(match[3]), Zedity.utils.rgb2hash(match[4])];
                                cfill.alpha=Zedity.utils.rgba2alpha(match[3])||Zedity.utils.rgba2alpha(match[4])||1;
                                return cfill
                            }
                        }
                        else {
                            bg=(this.$this.css('background-color')||'transparent').toLowerCase();
                            if(bg.charAt(0)=='#') {
                                return {
                                    type: 'solid', alpha: 1, colors: [bg]
                                }
                            }
                            else if(bg.substr(0, 3)=='rgb') {
                                var color=Zedity.utils.rgb2hash(bg);
                                return {
                                    type: 'solid', alpha: color=='transparent'?1: (Zedity.utils.rgba2alpha(bg)||1), colors: [color]
                                }
                            }
                        }
                        return {
                            type: 'solid', alpha: 1, colors: ['transparent']
                        }
                    }
                }
                , flip:function(flip) {
                    var $content=this.$this.children('.zedity-content,.zedity-empty');
                    if($content.length==0) {
                        this.editor._error( {
                                message: Zedity.t('Unexpected error: box has no content.')
                            }
                        );
                        return'none'
                    }
                    if(flip!=null) {
                        flip=flip.toLowerCase();
                        var curflip=this.flip();
                        var corners=this.corners();
                        $content.attr('style', ($content.attr('style')||'').replace(/(?: -o-|-ms-|-moz-|-webkit-|)transform.*?;
                    /g, ''));
                        var scale='';
                        switch(flip.substr(0, 3)) {
                            case'hor':switch(curflip.substr(0, 3)) {
                                case'hor': scale='';
                                    break;
                                case'ver': scale='scale(-1);';
                                    break;
                                case'bot': scale='scaleY(-1);';
                                    break;
                                default: scale='scaleX(-1);';
                                    break
                            }
                                break;
                            case'ver':switch(curflip.substr(0, 3)) {
                                case'hor': scale='scale(-1);';
                                    break;
                                case'ver': scale='';
                                    break;
                                case'bot': scale='scaleX(-1);';
                                    break;
                                default: scale='scaleY(-1);';
                                    break
                            }
                                break;
                            case'bot':switch(curflip.substr(0, 3)) {
                                case'bot': scale='';
                                    break;
                                default: scale='scale(-1);';
                                    break
                            }
                                break
                        }
                        var css='-webkit-transform:'+scale+'-moz-transform:'+scale+'-ms-transform:'+scale+'-o-transform:'+scale+'transform:'+scale;
                        if(scale)$content.attr('style', $content.attr('style')+';'+css);
                        this.$this.children('.zedity-empty').css('position', '');
                        Zedity.core._call(this, 'corners', corners);
                        this.editor._changed()
                    }
                    var f='none';
                    var ret=$content.css('transform')||$content.css('-webkit-transform')||$content.css('-o-transform')||$content.css('-moz-transform')||this.$this.css('-ms-transform');
                    if(/scale/.test(ret)) {
                        f=/scale(X|Y|)\s*?\(\s*?-1\s*?\)/.exec(ret);
                        f=f?f[1]: 'none'
                    }
                    else if(/matrix/.test(ret)) {
                        var m=/matrix\s*?\(\s*?(.*?), \s*?(.*?), \s*?(.*?), \s*?(.*?), \s*?(.*?), \s*?(.*?)\s*?\)/.exec(ret);
                        if(m) {
                            var m1=parseFloat(m[1]);
                            var m4=parseFloat(m[4]);
                            if(m1==-1&&m4==1) {
                                f='X'
                            }
                            else if(m1==1&&m4==-1) {
                                f='Y'
                            }
                            else if(m1==-1&&m4==-1) {
                                f=''
                            }
                        }
                    }
                    switch(f) {
                        case'X': return'horizontal';
                        case'Y': return'vertical';
                        case'': return'both';
                        case'none': default: return'none'
                    }
                }
                , corners:function(corners) {
                    function switchCorners(corners, flip) {
                        var t;
                        if(flip=='hor'||flip=='bot') {
                            t=corners['border-top-left-radius'];
                            corners['border-top-left-radius']=corners['border-top-right-radius'];
                            corners['border-top-right-radius']=t;
                            t=corners['border-bottom-left-radius'];
                            corners['border-bottom-left-radius']=corners['border-bottom-right-radius'];
                            corners['border-bottom-right-radius']=t
                        }
                        if(flip=='ver'||flip=='bot') {
                            t=corners['border-top-left-radius'];
                            corners['border-top-left-radius']=corners['border-bottom-left-radius'];
                            corners['border-bottom-left-radius']=t;
                            t=corners['border-top-right-radius'];
                            corners['border-top-right-radius']=corners['border-bottom-right-radius'];
                            corners['border-bottom-right-radius']=t
                        }
                        return corners
                    }
                    ;
                    function neg(corners) {
                        var newcorners= {}
                            ;
                        for(var corner in corners) {
                            if(corners.hasOwnProperty(corner)&&(parseInt(corners[corner])>0)) {
                                newcorners[corner]=''
                            }
                        }
                        return newcorners
                    }
                    ;
                    var flip=this.flip().substr(0, 3).toLowerCase();
                    if(corners) {
                        corners=switchCorners(corners, flip);
                        var css='';
                        for(var corner in corners) {
                            if(corners.hasOwnProperty(corner)&&(parseInt(corners[corner])>=0)) {
                                this.$this.attr('style', (this.$this.attr('style')||'').replace(new RegExp(corner+':.*?(?:;|$)', ''), ''));
                                css+=corner+':'+parseInt(corners[corner], 10)+'px;'
                            }
                        }
                        this.$this.attr('style', this.$this.attr('style')+';'+css);
                        var offset=parseInt(this.$this.css('border-top-width'), 10)||0;
                        if(offset>0) {
                            for(var i in corners) {
                                if(isNaN(corners[i]))corners[i]=parseInt(corners[i]||'0');
                                corners[i]-=(offset+1);
                                if(corners[i]<0)corners[i]=0
                            }
                        }
                        corners=switchCorners(corners, flip);
                        this.$this.children('.zedity-empty,.zedity-content').each(function() {
                                var $this=$(this);
                                var css='';
                                for(var corner in corners) {
                                    if(corners.hasOwnProperty(corner)&&(parseInt(corners[corner], 10)>=0)) {
                                        $this.attr('style', ($this.attr('style')||'').replace(new RegExp(corner+':.*?(?:;|$)', 'g'), ''));
                                        css+=corner+':'+parseInt(corners[corner], 10)+'px;'
                                    }
                                }
                                $this.attr('style', $this.attr('style')+';'+css)
                            }
                        );
                        this.editor._changed()
                    }
                    corners=this.$this.getCss(['border-top-left-radius', 'border-top-right-radius', 'border-bottom-left-radius', 'border-bottom-right-radius']);
                    return switchCorners(corners, flip)
                }
                , lock:function(lock) {
                    if(lock!=null) {
                        this._data.locked=lock;
                        this.$this.toggleClass('zedity-locked', lock);
                        this.editor._changed()
                    }
                    return this._data.locked
                }
                , remove:function() {
                    if(!this.$this)return this;
                    if(this.$this.hasClass('zedity-selected'))this.editor.boxes._select(null);
                    this.$this.remove();
                    this.$this=null;
                    this.editor._changed();
                    return this
                }
                , destroy:function() {
                    Zedity.core._call(this, 'remove');
                    for(var i=this.editor.boxes._boxes.length-1;
                        i>=0;
                        --i) {
                        if(this.editor.boxes._boxes[i].id==this.id) {
                            this.editor.boxes._boxes.splice(i, 1);
                            return this
                        }
                    }
                    return this
                }
            }
        );
        Zedity.Box.types=[];
        Zedity.Box.boxes=[];
        Zedity.Box.register=function(options) {
            var defaults= {
                    type: undefined, requires: [], section: 'advanced', order: 100
                }
                ;
            options=$.extend( {}
                , defaults, options);
            if(!options.type)throw new Error(Zedity.t('Box type not supplied during registration.'));
            for(var i=options.requires.length-1;
                i>=0;
                --i) {
                if(Zedity.core.supports.hasOwnProperty(options.requires[i])&&!Zedity.core.supports[options.requires[i]]())return false
            }
            Zedity.Box.types.push(options.type);
            Zedity.Box.boxes.push(options);
            Zedity.Box.boxes.sort(function(a, b) {
                    return a.order-b.order
                }
            )
        }
    }

)(jQuery);
(function($) {
        Zedity.utils=Zedity.utils|| {}
        ;
        Zedity.utils.cleanText=function(text) {
            var invalidChars=/[^\w\s\u0020-\ud7ff\ue000-\uffdd\u10000-\u10ffff]/g;
            return $.trim(text.replace(invalidChars, '').replace(/\s+/g, ' '))
        }
    }

)(jQuery);
(function($) {
        $.fn.getCss=function(styles, inherited) {
            var $this=$(this);
            var css= {}
                ;
            if(typeof(styles)=='string')styles=styles.split(' ');
            for(var i=styles.length-1;
                i>=0;
                --i) {
                if(inherited) {
                    if($this.css(styles[i])) {
                        css[styles[i]]=$this.css(styles[i])
                    }
                }
                else {
                    if($this.prop('style')[$.camelCase(styles[i])]) {
                        css[styles[i]]=$this.prop('style')[$.camelCase(styles[i])]
                    }
                }
            }
            return css
        }
        ;
        $.fn.multiDraggable=function(options) {
            var initLeftOffset=[];
            var initTopOffset=[];
            options=$.extend(options, {
                    start:function(event, ui) {
                        initLeftOffset=[0];
                        initTopOffset=[0];
                        if($(options.group).length>1) {
                            var pos=$(this).position();
                            $(options.group).draggable('option', 'snap', false).each(function(idx, elem) {
                                    var elemPos=$(elem).position();
                                    initLeftOffset[idx]=elemPos.left-pos.left;
                                    initTopOffset[idx]=elemPos.top-pos.top
                                }
                            )
                        }
                        if(typeof options.startNative=='function')options.startNative.call(this, event, ui)
                    }
                    , drag:function(event, ui) {
                        var pos=$(this).offset();
                        $(options.group).each(function(idx, elem) {
                                $(elem).addClass('ui-draggable-dragging').offset( {
                                        left: pos.left+initLeftOffset[idx], top: pos.top+initTopOffset[idx]
                                    }
                                )
                            }
                        );
                        if(typeof options.dragNative=='function')options.dragNative.call(this, event, ui)
                    }
                    , stop:function(event, ui) {
                        var pos=$(this).offset();
                        $(options.group).each(function(idx, elem) {
                                $(elem).removeClass('ui-draggable-dragging').offset( {
                                        left: pos.left+initLeftOffset[idx], top: pos.top+initTopOffset[idx]
                                    }
                                )
                            }
                        );
                        if(typeof options.stopNative=='function')options.stopNative.call(this, event, ui)
                    }
                }
            );
            $(this).draggable(options);
            return this
        }
        ;
        $.ui.plugin.add('draggable', 'snapFeedback', {
                drag:function(event, ui) {
                    if(this.box().rotation()!=0)return;
                    var inst=this.data('ui-draggable');
                    if(!inst.snapElements)return;
                    for(var i=inst.snapElements.length-1;
                        i>=0;
                        --i) {
                        if(inst.snapElements[i].snapping) {
                            $(inst.snapElements[i].item).stop().addClass('zedity-snapped').delay(1000).queue(function(next) {
                                    $(this).removeClass('zedity-snapped');
                                    next()
                                }
                            )
                        }
                        else {
                            $(inst.snapElements[i].item).stop().removeClass('zedity-snapped')
                        }
                        var box=$(inst.snapElements[i].item).box();
                        if(box&&box.rotation()!==0)inst.snapElements.splice(i, 1)
                    }
                }
            }
        );
        $.ui.plugin.add('draggable', 'snapRealPage', {
                drag:function(event, ui) {
                    var $this=$(this);
                    var inst=$this.data('ui-draggable');
                    if(!inst.snapElements)return;
                    for(var i=inst.snapElements.length-1;
                        i>=0;
                        --i) {
                        var $elem=$(inst.snapElements[i].item);
                        if(inst.snapElements[i].snapping&&$elem.hasClass('zedity-editor')) {
                            if(Math.abs(inst.position.left)<inst.options.snapTolerance)inst.position.left=Math.max(inst.position.left, 0);
                            if(Math.abs(inst.position.top)<inst.options.snapTolerance)inst.position.top=Math.max(inst.position.top, 0);
                            if(Math.abs(inst.position.left+$this.outerWidth()-$elem.width())<inst.options.snapTolerance)inst.position.left=Math.min(inst.position.left, $elem.width()-$this.outerWidth());
                            if(Math.abs(inst.position.top+$this.outerHeight()-$elem.height())<inst.options.snapTolerance)inst.position.top=Math.min(inst.position.top, $elem.height()-$this.outerHeight())
                        }
                    }
                }
            }
        );
        $.ui.plugin.add('draggable', 'reposition', {
                start:function(event, ui) {
                    var bb=this.box()._boundingBox();
                    this.data('ui-draggable').offset.click.left-=bb.dx;
                    this.data('ui-draggable').offset.click.top-=bb.dy
                }
            }
        );
        $.widget('ui.resizable', $.ui.resizable, {
                _numf:function(n) {
                    return isNaN(parseFloat(n))?0: parseFloat(n)
                }
                , _old_mouseStart:$.ui.resizable.prototype._mouseStart, _mouseStart:function() {
                    var res=this._old_mouseStart.apply(this, arguments);
                    var cursor=this.element.find('.ui-resizable-'+this.axis).css('cursor')||$('.ui-resizable-'+this.axis).css('cursor');
                    $('body').css('cursor', cursor==='auto'?this.axis+'-resize': cursor);
                    return res
                }
                , _old_mouseDrag:$.ui.resizable.prototype._mouseDrag, _mouseDrag:function(event) {
                    var box=$(this.element[0]).box();
                    if(!box)return this._old_mouseDrag.apply(this, arguments);
                    var angle=box.rotation();
                    var angle_rad=angle*0.017453292519943295769236907684883;
                    var data, props, smp=this.originalMousePosition, dx=(event.pageX-smp.left)||0, dy=(event.pageY-smp.top)||0, trigger=this._change[this.axis];
                    this._updatePrevProperties();
                    if(!trigger)return false;
                    var _cos=Math.cos(angle_rad), _sin=Math.sin(angle_rad);
                    var ndx=dx*_cos+dy*_sin;
                    var ndy=dy*_cos-dx*_sin;
                    data=trigger.apply(this, [event, ndx, ndy]);
                    this._updateVirtualBoundaries(event.shiftKey);
                    if(this._aspectRatio||event.shiftKey) {
                        data=this._updateRatio(data, event)
                    }
                    data=this._respectSize(data, event);
                    this._updateCache(data);
                    this._propagate("resize", event);
                    var o=(function() {
                            function d(w, h) {
                                var cx=-w/2, cy=h/2, nx=cy*_sin+cx*_cos, ny=cy*_cos-cx*_sin;
                                return {
                                    x: nx-cx, y: ny-cy
                                }
                            }
                            ;
                            var d1=d(this.prevSize.width, this.prevSize.height);
                            var d2=d(this.size.width, this.size.height);
                            return {
                                x: d2.x-d1.x, y: d2.y-d1.y
                            }
                        }
                    ).call(this);
                    this.position.left-=o.x;
                    this.position.top+=o.y;
                    props=this._applyChanges();
                    if(!this._helper&&this._proportionallyResizeElements.length) {
                        this._proportionallyResize()
                    }
                    if(!$.isEmptyObject(props)) {
                        this._updatePrevProperties();
                        this._trigger('resize', event, this.ui());
                        this._applyChanges()
                    }
                    return false
                }
                , _old_updatePrevProperties:$.ui.resizable.prototype._updatePrevProperties, _updatePrevProperties:function() {
                    if(this._old_updatePrevProperties)return this._old_updatePrevProperties.apply(this, arguments);
                    this.prevPosition= {
                        top: this.position.top, left: this.position.left
                    }
                    ;
                    this.prevSize= {
                        width: this.size.width, height: this.size.height
                    }
                }
                , _old_applyChanges:$.ui.resizable.prototype._applyChanges, _applyChanges:function() {
                    if(this._old_applyChanges)return this._old_applyChanges.apply(this, arguments);
                    var props= {}
                        ;
                    if(this.position.top!==this.prevPosition.top)props.top=this.position.top+'px';
                    if(this.position.left!==this.prevPosition.left)props.left=this.position.left+'px';
                    if(this.size.width!==this.prevSize.width)props.width=this.size.width+'px';
                    if(this.size.height!==this.prevSize.height)props.height=this.size.height+'px';
                    this.helper.css(props);
                    return props
                }
            }
        );
        $.widget('ui.rotatable', $.ui.mouse, {
                options: {
                    start:function() {}
                    , rotate:function() {}
                    , stop:function() {}
                    , snaps: [0, 45, 90, 180, 270], snapTolerance: 5
                }
                , _create:function() {
                    var handle=$('<div class="ui-rotatable-handle ui-icon ui-icon-arrowrefresh-1-w">');
                    this.listeners= {
                        start: $.proxy(this._start, this), rotate: $.proxy(this._rotate, this), stop: $.proxy(this._stop, this)
                    }
                    ;
                    handle.draggable( {
                            helper: 'clone', handle: handle
                        }
                    );
                    handle.on('mousedown', this.listeners.start);
                    handle.appendTo(this.element);
                    this.element.addClass('ui-rotatable');
                    this.box=this.element.box();
                    this.elementCurrentAngle=this.box.rotation()
                }
                , _destroy:function() {
                    this.element.removeClass('ui-rotatable');
                    this.element.find('.ui-rotatable-handle').remove()
                }
                , _getCenter:function() {
                    var a=this.box.rotation();
                    Zedity.core._call(this.box, 'rotation', 0);
                    var o=Zedity.core.supports.touch()&&/chrome/i.test(navigator.userAgent)?this.element[0].getBoundingClientRect(): this.element.offset();
                    Zedity.core._call(this.box, 'rotation', a);
                    return {
                        x: o.left+this.element.width()/2, y: o.top+this.element.height()/2
                    }
                }
                , _start:function(e) {
                    var c=this._getCenter();
                    this.mouseStartAngle=Math.atan2(e.pageY-c.y, e.pageX-c.x)*57.29577951308232;
                    this.elementStartAngle=this.elementCurrentAngle;
                    $(document).on('mousemove', this.listeners.rotate);
                    $(document).on('mouseup', this.listeners.stop);
                    this.element.addClass('ui-rotatable-rotating');
                    $('body').css('cursor', 'move');
                    this.options.start.call(this.element, e);
                    return false
                }
                , _rotate:function(e) {
                    var c=this._getCenter();
                    var mouseAngle=Math.atan2(e.pageY-c.y, e.pageX-c.x)*57.29577951308232;
                    var rotateAngle=this._normalizeAngle(mouseAngle-this.mouseStartAngle+this.elementStartAngle);
                    Zedity.core._call(this.box, 'rotation', rotateAngle);
                    this.elementCurrentAngle=rotateAngle;
                    this.options.rotate.call(this.element, e);
                    return false
                }
                , _stop:function(e) {
                    this.elementStopAngle=this.elementCurrentAngle;
                    $(document).off('mousemove', this.listeners.rotate);
                    $(document).off('mouseup', this.listeners.stop);
                    this.element.removeClass('ui-rotatable-rotating');
                    $('body').css('cursor', 'auto');
                    this.options.stop.call(this.element, e);
                    return false
                }
                , _normalizeAngle:function(a) {
                    a=(a<0?360+a: (a>360?a-360: a));
                    for(var snap=this.options.snaps.length-1;
                        snap>=0;
                        --snap) {
                        if(Math.abs(a-this.options.snaps[snap])<this.options.snapTolerance) {
                            a=this.options.snaps[snap];
                            break
                        }
                    }
                    return a
                }
            }
        );
        $.widget('ui.sliderSnap', $.ui.slider, {
                options: {
                    label: '', snaps: [], snaptolerance: 5
                }
                , _create:function() {
                    this.element.text(this.options.label);
                    this._superApply(arguments);
                    this.element.wrap('<div class="zedity-slider-wrapper"/>')
                }
                , _destroy:function() {
                    this._superApply(arguments);
                    this.element.unwrap()
                }
                , _refreshValue:function() {
                    this._superApply(arguments);
                    var h=this.handles.eq(0);
                    h.text(this.value());
                    var w=this.element.parent().width()-h.width();
                    if(w>0)this.element.width(w)
                }
                , _slide:function(event, index, newVal) {
                    if(event.type=='mousemove') {
                        for(var snap=this.options.snaps.length-1;
                            snap>=0;
                            --snap) {
                            if(Math.abs(newVal-this.options.snaps[snap])<this.options.snaptolerance) {
                                newVal=this.options.snaps[snap];
                                break
                            }
                        }
                    }
                    this._superApply(arguments)
                }
            }
        );
        $.widget('ui.tabs', $.ui.tabs, {
                selected:function(id) {
                    var idx;
                    var $this=$(this.element);
                    if(id) {
                        var idx=$this.find('a[href="#'+id+'"]').parent().index();
                        $this.tabs('option', 'active', idx)
                    }
                    else {
                        idx=$this.tabs('option', 'active');
                        return $this.find('a.ui-tabs-anchor').eq(idx).attr('href').replace('#', '')
                    }
                }
                , getidx:function(id) {
                    if(!id)return-1;
                    return $(this.element).find('a[href="#'+id+'"]').parent().index()
                }
            }
        );
        var d;
        d=Zedity.t('Audio');
        d=Zedity.t('Color');
        d=Zedity.t('Document');
        d=Zedity.t('Draw');
        d=Zedity.t('Html');
        d=Zedity.t('Image');
        d=Zedity.t('Text');
        d=Zedity.t('Video')
    }

)(jQuery);
(function($) {
        $.ui.plugin.add('resizable', 'snap', {
                start:function() {
                    var inst=$(this).data('ui-resizable');
                    inst.snapElements=[];
                    $(inst.options.snap).each(function() {
                            if(this==inst.element[0])return;
                            var $el=$(this);
                            if($el.hasClass('zedity-editor')) {
                                inst.snapElements.push( {
                                        item: this, l: 0, t: 0, r: $el.width(), b: $el.height()
                                    }
                                )
                            }
                            else {
                                var p=$el.position();
                                var box=$el.box();
                                if(box&&box.rotation()!==0)return;
                                inst.snapElements.push( {
                                        item: this, l: p.left, t: p.top, r: p.left+$el.outerWidth(), b: p.top+$el.outerHeight()
                                    }
                                )
                            }
                        }
                    )
                }
                , resize:function() {
                    function coord(lt, rb, st) {
                        return(Math.abs(lt)<st?-lt: (Math.abs(rb)<st?-rb: 0))
                    }
                    ;
                    function getstop(ar) {
                        return ar.sort(function(a, b) {
                                return(!a.c?1: (!b.c?-1: Math.abs(a.c)-Math.abs(b.c)))
                            }
                        )[0]
                    }
                    ;
                    var inst=$(this).data('ui-resizable');
                    var st=inst.options.snapTolerance||20;
                    var stops= {
                            l: [], t: [], w: [], h: []
                        }
                        ;
                    var l=inst.position.left;
                    var t=inst.position.top;
                    var r=l+inst.size.width+inst.sizeDiff.width;
                    var b=t+inst.size.height+inst.sizeDiff.height;
                    for(var i=inst.snapElements.length-1;
                        i>=0;
                        --i) {
                        var se=inst.snapElements[i];
                        se.snapping=false;
                        var w=Math.min(r+st, se.r)-Math.max(l-st, se.l);
                        var h=Math.min(b+st, se.b)-Math.max(t-st, se.t);
                        if(w>0&h>0) {
                            var axes=inst.axis.split('');
                            for(var j=axes.length-1;
                                j>=0;
                                --j) {
                                switch(axes[j]) {
                                    case'w':stops.l.push( {
                                            e: se, c: coord(l-se.l, l-se.r, st)
                                        }
                                    );
                                        break;
                                    case'n':stops.t.push( {
                                            e: se, c: coord(t-se.t, t-se.b, st)
                                        }
                                    );
                                        break;
                                    case'e':stops.w.push( {
                                            e: se, c: coord(r-se.l, r-se.r, st)
                                        }
                                    );
                                        break;
                                    case's':stops.h.push( {
                                            e: se, c: coord(b-se.t, b-se.b, st)
                                        }
                                    );
                                        break
                                }
                            }
                        }
                    }
                    var s=null;
                    if(stops.w.length) {
                        s=getstop(stops.w);
                        s.e.snapping=true;
                        inst.size.width+=s.c;
                        if(inst._aspectRatio)inst.size.height=inst.size.width/inst.aspectRatio
                    }
                    if(stops.h.length) {
                        s=getstop(stops.h);
                        s.e.snapping=true;
                        inst.size.height+=s.c;
                        if(inst._aspectRatio)inst.size.width=inst.size.height*inst.aspectRatio
                    }
                    if(stops.l.length) {
                        s=getstop(stops.l);
                        s.e.snapping=true;
                        inst.position.left+=s.c;
                        inst.size.width-=s.c;
                        if(inst._aspectRatio)inst.size.height=inst.size.width/inst.aspectRatio
                    }
                    if(stops.t.length) {
                        s=getstop(stops.t);
                        s.e.snapping=true;
                        inst.position.top+=s.c;
                        inst.size.height-=s.c;
                        if(inst._aspectRatio)inst.size.width=inst.size.height*inst.aspectRatio
                    }
                    for(var i=inst.snapElements.length-1;
                        i>=0;
                        --i) {
                        if(inst.snapElements[i].snapping) {
                            $(inst.snapElements[i].item).stop().addClass('zedity-snapped').delay(1000).queue(function(next) {
                                    $(this).removeClass('zedity-snapped');
                                    next()
                                }
                            )
                        }
                        else {
                            $(inst.snapElements[i].item).stop().removeClass('zedity-snapped')
                        }
                    }
                }
            }
        )
    }

)(jQuery);
(function($) {
        if(!Zedity)throw new Error(Zedity.t('%s needs %s.', 'Zedity.ContextMenu', 'Zedity'));
        Zedity.ContextMenu=function(options) {
            this.editor=options.editor;
            var menu='<ul class="zedity-contextmenu ui-state-active">';
            for(var i=0, len=Zedity.Box.types.length;
                i<len;
                ++i) {
                menu+='<li class="zedity-menu-AddBox" data-boxtype="'+Zedity.Box.types[i]+'"><span class="zicon zicon-size-xs zicon-'+Zedity.Box.types[i].toLowerCase()+'"></span> '+Zedity.t('Add %s box', Zedity.t(Zedity.Box.types[i]))+'</li>'
            }
            menu+='<li class="zedity-menu-EditBox zedity-menu-SelArrangeMain"><span class="zicon zicon-size-xs zicon-arrange"></span> '+Zedity.t('Arrange')+''+'<ul>'+'<li class="zedity-menu-SelArrange" data-type="front"><span class="zicon zicon-size-xs zicon-arrange-front"></span> '+Zedity.t('Bring to front')+'</li>'+'<li class="zedity-menu-SelArrange" data-type="back"><span class="zicon zicon-size-xs zicon-arrange-back"></span> '+Zedity.t('Send to back')+'</li>'+'<li class="zedity-menu-SelArrange" data-type="forward"><span class="zicon zicon-size-xs zicon-arrange-forward"></span> '+Zedity.t('Bring forward')+'</li>'+'<li class="zedity-menu-SelArrange" data-type="backward"><span class="zicon zicon-size-xs zicon-arrange-backward"></span> '+Zedity.t('Send backward')+'</li>'+'</ul>'+'</li>'+'<li class="zedity-menu-EditBox zedity-menu-SelFlipMain"><span class="zicon zicon-size-xs zicon-flip zicon-rotate-90"></span> '+Zedity.t('Flip')+''+'<ul>'+'<li class="zedity-menu-SelFlip" data-type="horizontal"><span class="zicon zicon-size-xs zicon-flip zicon-rotate-90"></span> '+Zedity.t('Horizontal')+'</li>'+'<li class="zedity-menu-SelFlip" data-type="vertical"><span class="zicon zicon-size-xs zicon-flip"></span> '+Zedity.t('Vertical')+'</li>'+'</ul>'+'</li>'+'<li class="zedity-menu-EditBox zedity-menu-SelAsBg"><span class="zicon zicon-size-xs zicon-expand"></span> '+Zedity.t('Set as background')+'</li>'+'<li class="zedity-menu-EditBox zedity-menu-SelDuplicate"><span class="zicon zicon-size-xs zicon-duplicate"></span> '+Zedity.t('Duplicate')+'</li>'+'<li class="zedity-menu-EditBox ui-state-disabled zedity-separator"></li>'+'<li class="zedity-menu-EditBox zedity-menu-SelDelete"><span class="zicon zicon-size-xs zicon-delete"></span> '+Zedity.t('Delete')+'</li>'+'</ul>';
            this.$this=$(menu);
            this.$this.appendTo('body');
            this.$this.menuZedity().hide().menuZedity('option', {
                    position: {
                        my: 'left top', at: 'right top'
                    }
                }
            );
            this.$this.on('mouseleave.zedity', $.proxy(function() {
                    this.$this.menuZedity('collapseAll', null, true).hide()
                }
                , this));
            this.editor.$container.on('contextmenu.zedity', $.proxy(function(event) {
                    var box=$(event.target).box();
                    if(box&&box.$this.is('.zedity-editing,.zedity-mlrd-hidden'))return;
                    var ok=(box!==null&&!box.asBackground());
                    if(ok)box.select();
                    this.$this.find('.zedity-menu-EditBox').toggle(ok&&box.editor.boxes.selected()!=null);
                    this.$this.find('.zedity-menu-AddBox').toggle($(event.target).is(this.editor.$this)||(box!==null&&box.asBackground()));
                    this.$this.find('.zedity-menu-AlignBox').toggle(ok&&!this.editor.boxes.selected());
                    this.refresh();
                    this.$this.css( {
                            left: event.pageX, top: event.pageY
                        }
                    ).show();
                    if(this.$this.find(':visible').length==0)this.$this.hide();
                    return false
                }
                , this));
            var ed=this.editor;
            this.$this.find('.zedity-menu-AddBox').on('click.zedity', function(event) {
                    var $this=$(this);
                    ed.contextMenu.close();
                    ed.boxes.add($this.attr('data-boxtype'), {
                            x: parseInt(ed.contextMenu.$this.css('left'), 10)-ed.$this.offset().left, y: parseInt(ed.contextMenu.$this.css('top'), 10)-ed.$this.offset().top
                        }
                    );
                    return
                }
            );
            this.$this.find('.zedity-menu-SelArrange').on('click.zedity', function(event) {
                    ed.contextMenu.close();
                    var box=ed.boxes.selected();
                    if(box)box.arrange($(this).attr('data-type'));
                    return
                }
            );
            this.$this.find('.zedity-menu-SelFlip').on('click.zedity', function(event) {
                    ed.contextMenu.close();
                    var box=ed.boxes.selected();
                    if(box)box.flip($(this).attr('data-type'));
                    return
                }
            );
            this.$this.find('.zedity-menu-SelAsBg').on('click.zedity', function(event) {
                    ed.contextMenu.close();
                    var box=ed.boxes.selected();
                    if(box)box.asBackground(!box.asBackground());
                    ed.menu.refresh('editbox', 'layout', 'background');
                    return
                }
            );
            this.$this.find('.zedity-menu-SelDuplicate').on('click.zedity', function(event) {
                    ed.contextMenu.close();
                    var box=ed.boxes.selected();
                    if(box)box.duplicate();
                    return
                }
            );
            this.$this.find('.zedity-menu-SelDelete').on('click.zedity', function(event) {
                    ed.contextMenu.close();
                    var box=ed.boxes.selected();
                    if(box)box.remove();
                    return
                }
            )
        }
        ;
        $.extend(Zedity.ContextMenu.prototype, {
                close:function() {
                    this.$this.menuZedity('collapseAll', null, true).hide();
                    return this
                }
                , refresh:function() {
                    var box=this.editor.boxes.selected();
                    this.$this.find('.zedity-menu-Selection').toggleClass('ui-state-disabled', !box);
                    if(box) {
                        this.$this.find('.zedity-menu-SelFlip,.zedity-menu-SelFlipMain').toggleClass('ui-state-disabled', !box.can('flip'));
                        this.$this.find('.zedity-menu-SelAsBg').toggleClass('ui-state-disabled', !box.can('asBackground'));
                        this.$this.find('.zedity-menu-SelAsBg a').html(box.asBackground()?'<span class="zedity-menu-icon zedity-icon-contract"></span> '+Zedity.t('Unset from background'): '<span class="zedity-menu-icon zedity-icon-expand"></span> '+Zedity.t('Set as background'));
                        this.$this.find('.zedity-menu-SelArrangeMain').toggleClass('ui-state-disabled', box.asBackground());
                        this.$this.find('.zedity-menu-SelDuplicate').toggleClass('ui-state-disabled', box.asBackground())
                    }
                    return this
                }
            }
        )
    }

)(jQuery);
(function($) {
        Zedity.utils=Zedity.utils|| {}
        ;
        Zedity.utils.dec2hex=function(num, padding) {
            num=Number(num);
            if(num<0)num=0xffffffff+num+1;
            padding=padding==null?2: padding;
            return(new Array(padding).join('0')+num.toString(16)).substr(-padding)
        }
        ;
        Zedity.utils.rgb2hash=function(color) {
            if(!color)return undefined;
            if(!isNaN(color))return color;
            color=$.trim(color);
            var rgb, match;
            if(color.indexOf('rgba')!=-1) {
                rgb=/rgba\s*\((.*)\s*, \s*(.*)\s*, \s*(.*)\s*, \s*(.*)\s*\)/i;
                match=rgb.exec(color);
                if(match&&match.length==5) {
                    if(match[1]=='0'&&match[2]=='0'&&match[3]=='0'&&match[4]=='0') {
                        return'transparent'
                    }
                    else {
                        return'#'+this.dec2hex(match[1])+this.dec2hex(match[2])+this.dec2hex(match[3])
                    }
                }
            }
            if(color.indexOf('rgb')!=-1) {
                rgb=/rgb\s*\((.*)\s*, \s*(.*)\s*, \s*(.*)\s*\)/i;
                match=rgb.exec(color);
                if(match&&match.length==4)return'#'+this.dec2hex(match[1])+this.dec2hex(match[2])+this.dec2hex(match[3])
            }
            return color
        }
        ;
        Zedity.utils.rgba2alpha=function(color) {
            if(!color)return undefined;
            if(!isNaN(color))return undefined;
            if(color.indexOf('rgb')==-1)return undefined;
            if(color.indexOf('#')>-1)return 1;
            var rgba=/rgba\s*\((.*)\s*, \s*(.*)\s*, \s*(.*)\s*, \s*(.*)\s*\)/i;
            if(color.indexOf('rgba')!=-1) {
                var match=rgba.exec(color);
                if(match&&match.length==5) {
                    return match[4]
                }
            }
            else {
                return 1
            }
            return undefined
        }
        ;
        Zedity.utils.hash2rgba=function(hash, alpha) {
            if(typeof(hash)!='string'||hash.charAt(0)!='#')return hash;
            var hex=parseInt(hash.substring(1), 16);
            if(alpha===undefined||alpha<0||alpha>1)alpha=1;
            return'rgba('+((hex&0xff0000)>>16)+','+((hex&0x00ff00)>>8)+','+(hex&0x0000ff)+','+alpha+')'
        }
        ;
        Zedity.utils.hash2rgb=function(hash) {
            if(typeof(hash)!='string'||hash.charAt(0)!='#')return hash;
            var hex=parseInt(hash.substring(1), 16);
            return'rgb('+((hex&0xff0000)>>16)+','+((hex&0x00ff00)>>8)+','+(hex&0x0000ff)+')'
        }
    }

)(jQuery);
(function($) {
    $.fn.colorPicker=function(method) {
        var methods= {
                init:function(options) {
                    var settings= {
                            colors:['#ffffff', '#c0c0c0', '#808080', '#000000', '#ff0000', '#800000', '#ffff00', '#808000', '#00ff00', '#008000', '#00ffff', '#008080', '#0000ff', '#000080', '#ff00ff', '#800080'], defaultcolor:0, fills:false, alpha:false, buttons:false, onchange:function(event, color, fill, alpha) {}
                            , onchangealpha:function(event, alpha) {}
                            , boxwidth: 18, maxcols: 0
                        }
                        ;
                    if(options)$.extend(settings, options);
                    settings.fills=Zedity.core.supports.gradient()?settings.fills:false;
                    return this.each(function() {
                            var $cp=$(this);
                            $cp.data('colorPicker', {
                                    colors: settings.colors, onchange: settings.onchange, fills: settings.fills, alpha: settings.alpha
                                }
                            );
                            var colors='';
                            for(var i=0;
                                i<settings.colors.length;
                                i++) {
                                var clear=((i%settings.maxcols)==0?';clear:both': '');
                                var check=(i==settings.defaultcolor?' zedity-check': '');
                                if(settings.colors[i]=='transparent') {
                                    colors+='<div class="zedity-color transparent'+check+'" style="width:'+settings.boxwidth+'px;height:'+settings.boxwidth+'px'+clear+'">'+'<a href="javascript:void(0)" title="transparent">&nbsp;&nbsp;&nbsp;</a>'+'</div>'
                                }
                                else {
                                    colors+='<div class="zedity-color'+check+'" style="width:'+settings.boxwidth+'px;height:'+settings.boxwidth+'px;background-color:'+settings.colors[i]+clear+'">'+'<a href="javascript:void(0)" title="'+settings.colors[i]+'">&nbsp;&nbsp;&nbsp;</a>'+'</div>'
                                }
                            }
                            var colorbuttons='';
                            if(settings.buttons) {
                                colorbuttons='<div class="zedity-colorbuttons">'+'<span title="'+Zedity.t('Click to set Hex color')+'" class="zedity-colorbtnhex zedity-button"></span>'+'<span title="'+Zedity.t('Click to set RGB color')+'" class="zedity-colorbtnrgb zedity-button"></span>'+'</div>'
                            }
                            var colortype='';
                            if(settings.fills) {
                                colortype='<div class="zedity-colortype">'+'<select class="zedity-colortype">'+'<option value="solid" class="zedity-solid">'+Zedity.t('Solid color')+'</option>'+'<option value="horizontal" class="zedity-horizontal">'+Zedity.t('Horiz. gradient')+'</option>'+'<option value="vertical" class="zedity-vertical">'+Zedity.t('Vert. gradient')+'</option>'+'<option value="radial" class="zedity-radial">'+Zedity.t('Radial gradient')+'</option>'+'</select>'+'<span class="zedity-colorbtn zedity-color1 zedity-selected'+(settings.colors[settings.defaultcolor||0]=='transparent'?' transparent': '')+'" style="background-color:'+settings.colors[settings.defaultcolor||0]+'"></span>'+'<span class="zedity-gradient zedity-ctpnl" style="display:none">'+'<span class="zedity-colorbtn zedity-color2"></span>'+'</span>'+'</div>'
                            }
                            var coloralpha='';
                            if(settings.alpha) {
                                coloralpha='<div class="zedity-coloralpha"><div class="zedity-slideralpha" title="'+Zedity.t('Select color opacity')+'"></div></div>'
                            }
                            $cp.append('<div class="zedity-colorpicker">'+colortype+coloralpha+colorbuttons+'<div class="zedity-colors">'+colors+'</div>'+'</div>');
                            var $color=$cp.find('.zedity-colorpicker div.zedity-color');
                            $color.each(function(idx) {
                                    $(this).children('a').on('click.colorPicker', function(event) {
                                            $color.removeClass('zedity-check');
                                            $(this).parent().addClass('zedity-check');
                                            $cp.colorPicker('selectcolor', settings.colors[idx], true);
                                            return false
                                        }
                                    )
                                }
                            );
                            if(settings.fills) {
                                $cp.find('select.zedity-colortype').on('change.colorPicker', function(event, onlyui) {
                                        var $gr=$cp.find('.zedity-gradient');
                                        if($(this).val()!='solid') {
                                            $gr.show()
                                        }
                                        else {
                                            $gr.hide();
                                            $cp.find('.zedity-colortype .zedity-colorbtn').removeClass('zedity-selected');
                                            $cp.find('.zedity-colortype .zedity-colorbtn.zedity-color1').addClass('zedity-selected')
                                        }
                                        if(onlyui)return false;
                                        if(typeof(settings.onchange)=='function') {
                                            var color=$cp.colorPicker('getcolor');
                                            var fill=$cp.colorPicker('getfill');
                                            var alpha=$cp.colorPicker('getalpha');
                                            settings.onchange.call($cp[0], event, color, fill, alpha)
                                        }
                                    }
                                )
                            }
                            if(settings.buttons) {
                                $cp.find('.zedity-colorbtnhex').on('click.zedity', function() {
                                        var color=$cp.colorPicker('getcolor');
                                        Zedity.core.dialog( {
                                                title:Zedity.t('Set custom color (Hex)'), default:color, question:Zedity.t('Please enter the color in hex format, e.g. %s', '#F31267'), mandatory:Zedity.t('You must enter a color.'), ok:function(answer) {
                                                    if(answer!='transparent'&&answer.indexOf('#')==-1)answer='#'+answer;
                                                    $cp.colorPicker('selectcolor', answer, true)
                                                }
                                            }
                                        )
                                    }
                                );
                                $cp.find('.zedity-colorbtnrgb').on('click.zedity', function() {
                                        var color=$cp.colorPicker('getcolor');
                                        Zedity.core.dialog( {
                                                title:Zedity.t('Set custom color (RGB)'), default:Zedity.utils.hash2rgb(color).replace('rgb(', '').replace(')', ''), question:Zedity.t('Please enter the color in RGB format, with comma-separated components, e.g. %s', '240,18,103'), mandatory:Zedity.t('You must enter a color.'), ok:function(answer) {
                                                    if(answer!='transparent')answer='rgb('+answer+')';
                                                    $cp.colorPicker('selectcolor', Zedity.utils.rgb2hash(answer), true)
                                                }
                                            }
                                        )
                                    }
                                )
                            }
                            if(settings.alpha) {
                                $cp.find('.zedity-slideralpha').sliderSnap( {
                                        label:Zedity.t('Opacity'), value:100, min:0, max:100, slide:function(event, ui) {
                                            if(typeof(settings.onchangealpha)=='function') {
                                                settings.onchangealpha.call($cp[0], event, ui.value/100)
                                            }
                                        }
                                        , change:function(event, ui) {
                                            if(!event.originalEvent)return false;
                                            if(typeof(settings.onchange)=='function') {
                                                var color=$cp.colorPicker('getcolor');
                                                var fill=$cp.colorPicker('getfill');
                                                settings.onchange.call($cp[0], event, color, fill, ui.value/100)
                                            }
                                        }
                                    }
                                )
                            }
                            $cp.find('.zedity-colortype .zedity-colorbtn').on('click.colorPicker', function(event) {
                                    $cp.find('.zedity-colortype .zedity-colorbtn').removeClass('zedity-selected');
                                    var $this=$(this);
                                    $this.addClass('zedity-selected');
                                    $cp.colorPicker('selectcolor', $this.css('background-color'))
                                }
                            )
                        }
                    );
                    return this
                }
                , getcolor:function() {
                    var data=$(this).data('colorPicker');
                    return data.selected
                }
                , getfill:function() {
                    var $cp=$(this);
                    var data=$cp.data('colorPicker');
                    if(!data.fills) {
                        return {
                            type: 'solid', alpha: $cp.colorPicker('getalpha'), colors: [$cp.colorPicker('getcolor')]
                        }
                    }
                    var fill= {
                            type: $cp.find('select.zedity-colortype').val(), alpha: $cp.colorPicker('getalpha'), colors: []
                        }
                        ;
                    fill.colors.push(Zedity.utils.rgb2hash($cp.find('.zedity-colortype .zedity-color1').css('background-color')));
                    if($cp.find('select.zedity-colortype').val()!='solid') {
                        fill.colors.push(Zedity.utils.rgb2hash($cp.find('.zedity-colortype .zedity-color2').css('background-color')))
                    }
                    return fill
                }
                , getalpha:function() {
                    var $cp=$(this);
                    var data=$cp.data('colorPicker');
                    if(!data.alpha)return 1;
                    return $cp.find('.zedity-slideralpha').sliderSnap('option', 'value')/100
                }
                , refresh:function() {
                    var $cp=$(this);
                    var color=$cp.colorPicker('getcolor');
                    $cp.find('.zedity-colorbtnhex').text(color);
                    $cp.find('.zedity-colorbtnrgb').text(Zedity.utils.hash2rgb(color));
                    $cp.find('.zedity-colortype .zedity-colorbtn.zedity-selected').css('background-color', color).toggleClass('transparent', color=='transparent')
                }
                , selectcolor:function(color, triggerevent) {
                    return this.each(function() {
                            var $cp=$(this);
                            var data=$cp.data('colorPicker');
                            var alpha=undefined;
                            var c='';
                            if(color!=parseInt(color)) {
                                var $fc=$('<div/>').css('color', color);
                                color=$fc.css('color');
                                if(color.indexOf('rgb')>-1) {
                                    if(color.indexOf('rgba')>-1) {
                                        alpha=Zedity.utils.rgba2alpha(color)
                                    }
                                    c=Zedity.utils.rgb2hash(color);
                                    color=data.colors.indexOf(c)
                                }
                                else if(color.charAt(0)=='#'||color=='transparent') {
                                    c=color;
                                    color=data.colors.indexOf(c)
                                }
                                else {
                                    return
                                }
                            }
                            if(color!=-1)c=data.colors[color];
                            $cp.find('.zedity-colorpicker div.zedity-color').removeClass('zedity-check');
                            if(alpha!=undefined&&c!='transparent')$cp.colorPicker('selectalpha', alpha);
                            if(c=='transparent')$cp.colorPicker('selectalpha', 1);
                            if(color>=0&&color<data.colors.length) {
                                $cp.find('.zedity-colorpicker div.zedity-color:nth-child('+(color+1)+')').addClass('zedity-check')
                            }
                            data.selected=c;
                            $cp.colorPicker('refresh');
                            if(triggerevent) {
                                if(typeof(data.onchange)=='function') {
                                    var fill=$cp.colorPicker('getfill');
                                    var alpha=$cp.colorPicker('getalpha');
                                    data.onchange.call($cp[0], null, c, fill, alpha)
                                }
                            }
                        }
                    )
                }
                , selectfill:function(fill, triggerevent) {
                    return this.each(function() {
                            if(!fill)return;
                            var $cp=$(this);
                            var data=$cp.data('colorPicker');
                            if(!data.fills)return;
                            fill.colors=fill.colors||['#000000'];
                            fill.colors=[].concat(fill.colors);
                            fill.type=fill.type||(fill.colors.length==1?'solid': 'horizontal');
                            fill.alpha=('alpha'in fill?fill.alpha: 1);
                            $cp.find('.zedity-color1').css('background-color', fill.colors[0]).toggleClass('transparent', fill.colors[0]=='transparent');
                            if(fill.type!='solid') {
                                $cp.find('.zedity-color2').css('background-color', fill.colors[1]).toggleClass('transparent', fill.colors[1]=='transparent')
                            }
                            $cp.find('select.zedity-colortype').val(fill.type).trigger('change.colorPicker', [true]);
                            $cp.find('div.zedity-colortype .zedity-color1').trigger('click.colorPicker');
                            if(data.alpha) {
                                $cp.find('.zedity-slideralpha').sliderSnap('option', 'value', Math.round(fill.alpha*100))
                            }
                            if(triggerevent) {
                                $cp.find('select.zedity-colortype').trigger('change.colorPicker')
                            }
                        }
                    )
                }
                , selectalpha:function(alpha, triggerevent) {
                    var $cp=$(this);
                    var data=$cp.data('colorPicker');
                    alpha=alpha<=1?Math.round(alpha*100): alpha;
                    var $slider=$cp.find('.zedity-slideralpha');
                    $slider.sliderSnap('option', 'value', alpha);
                    if(triggerevent) {
                        $slider.trigger('change')
                    }
                }
                , destroy:function() {
                    return this.each(function() {
                            var $cp=$(this);
                            $cp.data('colorPicker').target.remove();
                            $cp.off('.colorPicker');
                            $cp.removeData('colorPicker')
                        }
                    )
                }
            }
            ;
        if(methods[method]) {
            return methods[method].apply(this, Array.prototype.slice.call(arguments, 1))
        }
        else if(typeof method==='object'||!method) {
            return methods.init.apply(this, arguments)
        }
        else {
            $.error(Zedity.t('Method %s does not exist on %s.', method, 'jQuery.colorPicker'))
        }
    }
    ;
    $.fn.fontSelector=function(method) {
        var fonts=['Arial,Helvetica,sans-serif', 'Arial Black,Gadget,sans-serif', 'Arial Narrow,sans-serif', 'Century Gothic,sans-serif', 'Comic Sans MS,cursive', 'Copperplate Gothic Light,sans-serif', 'Courier New,Courier,monospace', 'Georgia,serif', 'Gill Sans,sans-serif', 'Impact,Charcoal,sans-serif', 'Lucida Console,Monaco,monospace', 'Lucida Sans Unicode,Lucida Grande,sans-serif', 'Palatino Linotype,Book Antiqua,Palatino,serif', 'Tahoma,Geneva,sans-serif', 'Times New Roman,Times,serif', 'Trebuchet MS,Helvetica,sans-serif', 'Verdana,Geneva,sans-serif'];
        var sizes=['11', '12', '14', '16', '19', '21', '24', '27', '29', '32', '37', '48', '53', '64'];
        var colors=['#ffffff', '#f2f2f2', '#d8d8d8', '#bdbdbd', '#a4a4a4', '#6e6e6e', '#424242', '#2e2e2e', '#000000', '#fbefef', '#f8e0e0', '#f5a9a9', '#f78181', '#fe2e2e', '#df0101', '#b40404', '#8a0808', '#3b0b0b', '#fbf5ef', '#f8ece0', '#f5d0a9', '#faac58', '#ff8000', '#df7401', '#b45f04', '#8a4b08', '#3b240b', '#fbfbef', '#f5f6ce', '#f2f5a9', '#f4fa58', '#ffff00', '#d7df01', '#aeb404', '#868a08', '#393b0b', '#f5fbef', '#e3f6ce', '#d0f5a9', '#acfa58', '#80ff00', '#74df00', '#5fb404', '#4b8a08', '#38610b', '#effbef', '#cef6ce', '#a9f5a9', '#58fa58', '#00ff00', '#01df01', '#04b404', '#088a08', '#0b3b0b', '#effbfb', '#cef6f5', '#a9f5f2', '#58faf4', '#00ffff', '#01dfd7', '#04b4ae', '#088a85', '#0b3b39', '#eff5fb', '#cee3f6', '#81bef7', '#2e9afe', '#0080ff', '#045fb4', '#084b8a', '#08388a', '#0b243b', '#efeffb', '#cecef6', '#5858fa', '#2e2efe', '#0000ff', '#0404b4', '#08088a', '#0b0b61', '#0b0b3b', '#f5effb', '#e3cef6', '#be81f7', '#ac58fa', '#9a2efe', '#5f04b4', '#4b088a', '#380b61', '#240b3b', '#fbeffb', '#f6cef5', '#f781f3', '#fe2ef7', '#ff00ff', '#df01d7', '#b404ae', '#610b5e', '#3b0b39', '#fbeff5', '#f6cee3', '#f5a9d0', '#fa58ac', '#ff0080', '#df0174', '#b4045f', '#610b38', '#3b0b24'];
        var methods= {
            init:function(options) {
                var settings= {
                        order:'font,size,style,color', fonts:fonts, sizes:sizes, colors:colors, colorButtons:false, defaultfont:fonts[0], defaultsize:sizes[3], defaultstyle: {
                            bold: false, italic: false, underline: false
                        }
                        , onchange:function(event) {}
                        , onchangefont:function(font) {}
                        , onchangesize:function(size) {}
                        , onchangestyleB:function(style) {}
                        , onchangestyleI:function(style) {}
                        , onchangestyleU:function(style) {}
                        , onchangestyleS:function(style) {}
                        , onchangestyleSub:function(style) {}
                        , onchangestyleSup:function(style) {}
                        , onchangecolor:function(event, color) {}
                    }
                    ;
                if(options)$.extend(settings, options);
                return this.each(function() {
                        var $sel=$('<div class="zedity-fontselector"/>').appendTo(this);
                        $sel.data('fontSelector', {
                                fonts: settings.fonts, sizes: settings.sizes, defaultsize: settings.defaultsize, onchange: settings.onchange
                            }
                        );
                        var $fontfaceselector;
                        var $fontsizeselector1;
                        var $fontsizeselector2;
                        var $fontstyleselector;
                        var $fontsubsupselector;
                        $.each(settings.order.split(','), function(i, item) {
                                switch(item) {
                                    case'font': var id_ffs=Zedity.core.genId('zedity-ffs');
                                        var tempsel='<div class="zedity-fontfaceselector zedity-button zedity-ddmenu zedity-menu" style="float:left;width:200px" data-ddmenu="#'+id_ffs+'"><span><a href="javascript:;"></a></span></div>'+'<ul id="'+id_ffs+'" class="zedity-ffs-menu zedity-propbar-menu">';
                                        var tempcss='';
                                        for(var i=0, len=settings.fonts.length;
                                            i<len;
                                            ++i) {
                                            var tempclass='fontface'+i+'class';
                                            tempsel+='<li class="zedity-fontface '+tempclass+'" data-value="'+settings.fonts[i]+'"><a href="javascript:;">'+settings.fonts[i].split(',')[0]+'</a></li>';
                                            tempcss+='.'+tempclass+'{font-family:'+settings.fonts[i]+' !important}'
                                        }
                                        tempsel+='</ul>';
                                        $sel.append(tempsel);
                                        if($('#zedity-fontselectorFontsCss').length==0)$('head').prepend('<style id="zedity-fontselectorFontsCss" type="text/css">'+tempcss+'</style>');
                                        $fontfaceselector=$sel.find('.zedity-fontfaceselector');
                                        $fontfaceselector.ddmenu( {
                                                onchange:function(value) {
                                                    if(typeof settings.onchange=='function')settings.onchange.call($sel[0]);
                                                    if(typeof settings.onchangefont=='function')settings.onchangefont.call($sel[0], value)
                                                }
                                            }
                                        );
                                        break;
                                    case'size':var id_fss=Zedity.core.genId('zedity-fss');
                                        var tempsel='<div class="zedity-fontsizeselector1 zedity-button zedity-ddmenu zedity-menu" style="float:left;width:55px" data-ddmenu="#'+id_fss+'"><span><a href="javascript:;"></a></span></div>'+'<ul id="'+id_fss+'" class="zedity-fss-menu zedity-propbar-menu">';
                                        for(var i=0, len=settings.sizes.length;
                                            i<len;
                                            ++i) {
                                            tempsel+='<li data-value="'+settings.sizes[i]+'"><a href="javascript:;">'+settings.sizes[i]+'</a></li>'
                                        }
                                        tempsel+='</ul>';
                                        $sel.append(tempsel);
                                        $fontsizeselector1=$sel.find('div.zedity-fontsizeselector1');
                                        $fontsizeselector1.ddmenu( {
                                                width:80, onchange:function(value) {
                                                    $fontsizeselector2.attr('data-size', value);
                                                    if(typeof settings.onchange=='function')settings.onchange.call($sel[0]);
                                                    if(typeof settings.onchangesize=='function')settings.onchangesize.call($sel[0], value)
                                                }
                                            }
                                        );
                                        $sel.append('<div class="zedity-fontsizeselector2" style="float:left;margin:3px;clear:both;" data-size="'+settings.sizes.indexOf(settings.defaultsize)+'">'+'<span class="zedity-button"><a href="javascript:;" class="zedity-font-increase" title="'+Zedity.t('Increase font size')+'">A+</a></span>'+'<span class="zedity-button"><a href="javascript:;" class="zedity-font-decrease" title="'+Zedity.t('Decrease font size')+'">A-</a></span>'+'</div>');
                                        $fontsizeselector2=$sel.find('div.zedity-fontsizeselector2');
                                        $fontsizeselector2.find('a.zedity-font-decrease').on('click.fontSelector', function(event) {
                                                var idx=settings.sizes.indexOf($fontsizeselector2.attr('data-size'));
                                                idx=(idx>=0?idx: settings.sizes.indexOf(settings.defaultsize));
                                                if(idx<=0)return;
                                                var size=settings.sizes[idx-1];
                                                $fontsizeselector2.attr('data-size', size);
                                                $fontsizeselector1.ddmenu('value', size, false);
                                                if(typeof settings.onchange=='function')settings.onchange.call($sel[0], event);
                                                if(typeof settings.onchangesize=='function')settings.onchangesize.call($sel[0], size)
                                            }
                                        );
                                        $fontsizeselector2.find('a.zedity-font-increase').on('click.fontSelector', function(event) {
                                                var idx=settings.sizes.indexOf($fontsizeselector2.attr('data-size'));
                                                idx=(idx>=0?idx: settings.sizes.indexOf(settings.defaultsize));
                                                if(idx>=settings.sizes.length-1)return;
                                                var size=settings.sizes[idx+1];
                                                $fontsizeselector2.attr('data-size', size);
                                                $fontsizeselector1.ddmenu('value', size, false);
                                                if(typeof settings.onchange=='function')settings.onchange.call($sel[0], event);
                                                if(typeof settings.onchangesize=='function')settings.onchangesize.call($sel[0], size)
                                            }
                                        );
                                        break;
                                    case'style':$sel.append('<span class="zedity-fontstyleselector" style="float:left;margin:3px">'+'<span class="zedity-button zedity-btnB"><a href="javascript:;" title="'+Zedity.t('Bold')+'"><b>B</b></a></span>'+'<span class="zedity-button zedity-btnI"><a href="javascript:;" title="'+Zedity.t('Italic')+'"><i>I</i></a></span>'+'<span class="zedity-button zedity-btnU"><a href="javascript:;" title="'+Zedity.t('Underline')+'"><u>U</u></a></span>'+'<span class="zedity-button zedity-btnS"><a href="javascript:;" title="'+Zedity.t('Shadow')+'"><span style="text-shadow:2px 2px 2px #000">S</span></a></span>'+'</span>');
                                        $fontstyleselector=$sel.find('.zedity-fontstyleselector');
                                        $fontstyleselector.find('a').on('click.fontSelector', function() {
                                                $(this).parent().toggleClass('zedity-checked').trigger('click');
                                                return false
                                            }
                                        );
                                        break;
                                    case'subsup':$sel.append('<span class="zedity-fontsubsupselector" style="float:left;margin:3px">'+'<span class="zedity-button zedity-btnSub"><a href="javascript:;" title="'+Zedity.t('Subscript')+'">X<sub style="font-size:0.8em">2</sub></a></span>'+'<span class="zedity-button zedity-btnSup"><a href="javascript:;" title="'+Zedity.t('Superscript')+'" style="line-height:20px">X<sup style="font-size:0.8em">2</sup></a></span>'+'</span>');
                                        $fontsubsupselector=$sel.find('.zedity-fontsubsupselector');
                                        $fontsubsupselector.find('a').on('click.fontSelector', function() {
                                                $(this).parent().toggleClass('zedity-checked').trigger('click');
                                                return false
                                            }
                                        );
                                        break;
                                    case'color':break
                                }
                            }
                        );
                        if(settings.order.indexOf('color')>-1) {
                            $sel.append('<div class="zedity-fontcolorselector"/>');
                            var $fontcolorselector=$sel.find('.zedity-fontcolorselector');
                            $fontcolorselector.colorPicker( {
                                    colors:settings.colors, defaultcolor:-1, alpha:false, buttons:settings.colorButtons, maxcols:9, onchange:function(event, color, fill, alpha) {
                                        if(typeof settings.onchange=='function')settings.onchange.call($sel[0], event);
                                        if(typeof settings.onchangecolor=='function')settings.onchangecolor.call($sel[0], event, color, alpha)
                                    }
                                }
                            )
                        }
                        if($fontstyleselector) {
                            if(typeof settings.onchange=='function') {
                                $fontstyleselector.find('.zedity-btnB').on('click.fontSelector1', function() {
                                        settings.onchange.apply($sel[0], arguments)
                                    }
                                );
                                $fontstyleselector.find('.zedity-btnI').on('click.fontSelector1', function() {
                                        settings.onchange.apply($sel[0], arguments)
                                    }
                                );
                                $fontstyleselector.find('.zedity-btnU').on('click.fontSelector1', function() {
                                        settings.onchange.apply($sel[0], arguments)
                                    }
                                );
                                $fontstyleselector.find('.zedity-btnS').on('click.fontSelector1', function() {
                                        settings.onchange.apply($sel[0], arguments)
                                    }
                                )
                            }
                            if(typeof settings.onchangestyleB=='function')$fontstyleselector.find('.zedity-btnB').on('click.fontSelector2', function() {
                                    settings.onchangestyleB.apply($sel[0], arguments)
                                }
                            );
                            if(typeof settings.onchangestyleI=='function')$fontstyleselector.find('.zedity-btnI').on('click.fontSelector2', function() {
                                    settings.onchangestyleI.apply($sel[0], arguments)
                                }
                            );
                            if(typeof settings.onchangestyleU=='function')$fontstyleselector.find('.zedity-btnU').on('click.fontSelector2', function() {
                                    settings.onchangestyleU.apply($sel[0], arguments)
                                }
                            );
                            if(typeof settings.onchangestyleS=='function')$fontstyleselector.find('.zedity-btnS').on('click.fontSelector2', function() {
                                    settings.onchangestyleS.apply($sel[0], arguments)
                                }
                            )
                        }
                        if($fontsubsupselector) {
                            if(typeof settings.onchange=='function') {
                                $fontsubsupselector.find('.zedity-btnSub').on('click.fontSelector1', function() {
                                        settings.onchange.apply($sel[0], arguments)
                                    }
                                );
                                $fontsubsupselector.find('.zedity-btnSup').on('click.fontSelector1', function() {
                                        settings.onchange.apply($sel[0], arguments)
                                    }
                                )
                            }
                            if(typeof settings.onchangestyleSub=='function')$fontsubsupselector.find('.zedity-btnSub').on('click.fontSelector2', function() {
                                    settings.onchangestyleSub.apply($sel[0], arguments)
                                }
                            );
                            if(typeof settings.onchangestyleSup=='function')$fontsubsupselector.find('.zedity-btnSup').on('click.fontSelector2', function() {
                                    settings.onchangestyleSup.apply($sel[0], arguments)
                                }
                            )
                        }
                    }
                )
            }
            , selectfont:function(font, triggerevent) {
                return this.each(function() {
                    var $sel=$(this);
                    if(!$sel.hasClass('zedity-fontselector'))$sel=$sel.find('.zedity-fontselector');
                    var data=$sel.data('fontSelector');
                    if(font!='') {
                        font=font.replace(/(, \s*)/g, ',');
                        font=font.replace(/(\'|\")/g,'');for(var i=data.fonts.length-1;i>=0;--i){var f=data.fonts[i].split(', ')[0];if(font==f){font=data.fonts[i];break}}}var $fontfaceselector=$sel.find('.zedity-fontfaceselector');$fontfaceselector.ddmenu('value',font,false);if(triggerevent)$fontfaceselector.trigger('change.fontSelector')})},selectfontsize:function(size,triggerevent){return this.each(function(){var $sel=$(this);if(!$sel.hasClass('zedity-fontselector'))$sel=$sel.find('.zedity-fontselector');var data=$sel.data('fontSelector');if(size!=''){if(/px/.test(size))size=size.replace('px','');if(/pt/.test(size))size=$.pt2px(size);if(data.sizes.indexOf(size)==-1){size=Math.round(parseFloat(size));if(data.sizes.indexOf(size.toString())==-1){var closest=null;$.each(data.sizes,function(){if(closest==null||Math.abs(parseInt(this)-size)<Math.abs(closest-size)){closest=parseInt(this)}});size=closest}}}$sel.find('.zedity-fontsizeselector1').ddmenu('value',size,false);$sel.find('.zedity-fontsizeselector2').attr('data-size',size);if(triggerevent)$sel.find('.zedity-fontsizeselector').trigger('change.fontSelector')})},selectfontstyle:function(style,triggerevent){return this.each(function(){var $sel=$(this);var $cb=$sel.find('.zedity-btnB');var $ci=$sel.find('.zedity-btnI');var $cu=$sel.find('.zedity-btnU');var $cs=$sel.find('.zedity-btnS');var $csub=$sel.find('.zedity-btnSub');var $csup=$sel.find('.zedity-btnSup');if(style.bold==!$cb.hasClass('zedity-checked')){$cb.toggleClass('zedity-checked',!$cb.hasClass('zedity-checked'));if(triggerevent)$cb.trigger('change.fontSelector')}if(style.italic==!$ci.hasClass('zedity-checked')){$ci.toggleClass('zedity-checked',!$ci.hasClass('zedity-checked'));if(triggerevent)$ci.trigger('change.fontSelector')}if(style.underline==!$cu.hasClass('zedity-checked')){$cu.toggleClass('zedity-checked',!$cu.hasClass('zedity-checked'));if(triggerevent)$cu.trigger('change.fontSelector')}if(style.shadow==!$cs.hasClass('zedity-checked')){$cs.toggleClass('zedity-checked',!$cs.hasClass('zedity-checked'));if(triggerevent)$cs.trigger('change.fontSelector')}if(style.subscript==!$csub.hasClass('zedity-checked')){$csub.toggleClass('zedity-checked',!$csub.hasClass('zedity-checked'));if(triggerevent)$csub.trigger('change.fontSelector')}if(style.superscript==!$csup.hasClass('zedity-checked')){$csup.toggleClass('zedity-checked',!$csup.hasClass('zedity-checked'));if(triggerevent)$csup.trigger('change.fontSelector')}})},selectcolor:function(color,triggerevent){return this.each(function(){var $sel=$(this);color=Zedity.utils.rgb2hash(color);$sel.find('.zedity-fontcolorselector').colorPicker('selectcolor',color,triggerevent);if(triggerevent)$sel.find('.zedity-fontcolorselector').trigger('change.boxer')})},change:function(){return this.each(function(){var $sel=$(this);if(!$sel.hasClass('zedity-fontselector'))$sel=$sel.find('.zedity-fontselector');var data=$sel.data('fontSelector');if(typeof data.onchange=='function')data.onchange.call($sel[0])})},getfont:function(){return $(this).find('.zedity-fontfaceselector').ddmenu('value')},getfontsize:function(){return $(this).find('.zedity-fontsizeselector1').attr('data-value')},getfontstyle:function(){var $sel=$(this);return{bold:$sel.find('.zedity-btnB').hasClass('zedity-checked'),italic:$sel.find('.zedity-btnI').hasClass('zedity-checked'),underline:$sel.find('.zedity-btnU').hasClass('zedity-checked'),shadow:$sel.find('.zedity-btnS').hasClass('zedity-checked')}},getcolor:function(){return $(this).find('.zedity-fontcolorselector').colorPicker('getcolor')},destroy:function(){return this.each(function(){var $sel=$(this);if(!$sel.hasClass('zedity-fontselector'))$sel=$sel.find('.zedity-fontselector');$sel.find('.zedity-fontfaceselector').remove();$sel.find('.zedity-fontsizeselector').remove();$sel.find('.zedity-fontstyleselector').remove();$sel.removeData('fontSelector')})}};if(methods[method]){return methods[method].apply(this,Array.prototype.slice.call(arguments,1))}else if(typeof method==='object'||!method){return methods.init.apply(this,arguments)}else{$.error(Zedity.t('Method %s does not exist on %s.',method,'jQuery.fontSelector'))}};$.fn.ddmenu=function(method){var $this=$(this);var $menu=$($this.attr('data-ddmenu'));var methods={init:function(options){var settings={width:200,onchange:function(){}};$.extend(settings,options);$this.data('ddmenu',settings);$menu.hide().addClass('zedity-ddmenu').detach().appendTo('body').menu().css({position:'absolute',width:settings.width}).off('mouseleave.ddmenu').on('mouseleave.ddmenu',function(){$menu.hide()});$this.off('click.ddmenu').on('click.ddmenu',function(){$('.zedity-ddmenu').not($menu).not('.zedity-button').hide();$menu.toggle().position({my:'left top',at:'left bottom',of:this}).css({'min-width':$this.outerWidth()});return false}).on('mousedown.ddmenu',function(){return false});$menu.find('.ui-menu-item').off('click.ddmenu').on('click.ddmenu',function(event){$this.ddmenu('value',$(this).attr('data-value'));$menu.hide();return false}).on('mousedown.ddmenu',function(){return false})},value:function(value,triggerevent){triggerevent=triggerevent===false?false:true;if(value!=null){var $item=$menu.find('[data-value="'+value+'"]');var text=($item.length==0?'':$item.text());$this.attr('data-value',value).find('a').text(text);if(text!=''&&triggerevent)$this.ddmenu('change',value)}else{value=$this.attr('data-value')}return value},change:function(value){var data=$this.data('ddmenu');data.onchange.call($this[0],value)}};if(methods[method]){return methods[method].apply(this,Array.prototype.slice.call(arguments,1))}else if(typeof method==='object'||!method){return methods.init.apply(this,arguments)}else{$.error(Zedity.t('Method %s does not exist on %s.',method,'jQuery.ddmenu'))}}})(jQuery);
(function($) {
        Zedity.tutorials= {
            _tutorials: {}
            , curTutorial:null, curStep:0, $overlay:null, $hl:null, add:function(tutorial, definition) {
                if(!tutorial)return;
                definition=$.extend( {
                        title:tutorial.charAt(0).toUpperCase()+tutorial.slice(1), cleanup:function() {}
                    }
                    , definition);
                if(!definition.tutorial)return;
                this._tutorials[tutorial]=definition
            }
            , start:function(ed, tutorial) {
                if(!this._tutorials[tutorial])return;
                Zedity.core._later(this, function() {
                        this._start(ed, tutorial)
                    }
                    , 100)
            }
            , _start:function(ed, tutorial) {
                if(!ed||(this.$overlay&&this.$overlay.length))return;
                this.curTutorial=this._tutorials[tutorial];
                if(!this.curTutorial)return;
                this._size=ed.page.size();
                ed.page.size( {
                        width: Math.max(800, this._size.width), height: Math.max(600, this._size.height)
                    }
                );
                this.editor=ed;
                this.$overlay=$('<div class="zedity-tutorial-overlay"/>');
                this.$hl=$('<div class="zedity-tutorial-highlight" style="display:none"/>');
                this.curStep=0;
                $('body').append(this.$overlay).addClass('has-zedity-tutorial');
                this.$overlay.append(this.$hl);
                this.$overlay.append('<div class="zedity-tutorial-buttons">'+'<button class="zedity-tutorial-button-close" title="Close tutorial">x</button>'+'<button class="zedity-tutorial-button-next" title="Next step">Next</button>'+'</div>');
                var self=this;
                this.$overlay.find('.zedity-tutorial-button-next').on('click', function() {
                        var $b=$(this).parent();
                        if($b.hasClass('waiting'))return false;
                        $b.addClass('waiting');
                        Zedity.core._later(this, function() {
                                self.editor.$this.find(':animated').promise().done(function() {
                                        $b.removeClass('waiting')
                                    }
                                )
                            }
                            , 300);
                        self.next()
                    }
                );
                this.$overlay.find('.zedity-tutorial-button-close').on('click', function() {
                        var $b=$(this).parent();
                        if($b.hasClass('waiting'))return false;
                        self.stop()
                    }
                );
                $(document).scrollTop(0);
                $(document).scrollTop(this.editor.$container.offset().top);
                this.step(0)
            }
            , stop:function() {
                if(!this.$overlay.length)return;
                $('body').removeClass('has-zedity-tutorial');
                this.$overlay.remove();
                this.$overlay=null;
                this.curTutorial.cleanup.call(this);
                this.editor.page.size(this._size)
            }
            , step:function(inc) {
                var len=this.curTutorial.tutorial.length-1;
                this.curStep+=inc;
                if(this.curStep<0)this.curStep=0;
                if(this.curStep>len)this.curStep=len;
                if(this.curStep==0) {}
                if(this.curStep==len) {
                    this.stop()
                }
                this.$overlay.find('.zedity-tutorial-text').remove();
                this.$hl.css('top', '-10000px');
                this.curTutorial.tutorial[this.curStep].call(this)
            }
            , next:function() {
                var len=this.curTutorial.tutorial.length-1;
                this.curStep++;
                if(this.curStep==len) {
                    this.$overlay.find('.zedity-tutorial-button').text('End')
                }
                else if(this.curStep>len) {
                    this.$overlay.find('.zedity-tutorial-buttons').remove();
                    this.stop();
                    return
                }
                this.$overlay.find('.zedity-tutorial-text').remove();
                this.$hl.css('top', '-10000px').hide();
                this.curTutorial.tutorial[this.curStep].call(this)
            }
            , showHighlight:function($el, text) {
                var offset=8;
                Zedity.core._later(this, function() {
                        var pos=$el[0].getBoundingClientRect();
                        this.$hl.css( {
                                left: pos.left-offset, top: pos.top-offset, width: $el.outerWidth()+offset, height: $el.outerHeight()+offset
                            }
                        ).show();
                        if(text) {
                            this.showText(this.$hl.position().left, this.$hl.position().top+this.$hl.outerHeight(), text, 'above')
                        }
                    }
                    , 100)
            }
            , showText:function(x, y, text, pos) {
                if(x==null||y==null||!text)return;
                pos=pos||'';
                var $t=$('<div class="zedity-tutorial-text '+pos+'"/>').text(text).css( {
                        left: x, top: y>=0?y: '', bottom: y<0?Math.abs(y): ''
                    }
                );
                this.$overlay.append($t)
            }
            , addMenu:function(ed, tab, group) {
                var tut=[];
                for(var i in this._tutorials) {
                    if(!this._tutorials.hasOwnProperty(i))return;
                    tut.push( {
                            value: i, label: this._tutorials[i].title
                        }
                    )
                }
                var mdef= {
                        tabs: {}
                    }
                    ;
                mdef.tabs[tab]= {
                    groups: {}
                }
                ;
                mdef.tabs[tab].groups[group]= {
                    order:99999, title:'Tutorials', features: {
                        tutorials: {
                            type:'menu', size:'n', icon:'help', label:'Tutorials', title:'Tutorials', items:tut, onclick:function(val, e, ed) {
                                Zedity.tutorials.start(ed, val)
                            }
                        }
                    }
                }
                ;
                ed.menu.add(mdef)
            }
        }
        ;
        Zedity.tutorials.add('intro1', {
                title:'Introduction: add and place a box', tutorial:[function() {
                    this.editor.menu.openTab('boxes');
                    this.showHighlight(this.editor.menu._tab('boxes').$tab, 'Open the "Boxes" tab.')
                }
                    , function() {
                        this.showHighlight(this.editor.menu.$this.find('.zedity-ribbon-tab-panel:visible'), 'Choose the box you want to add.')
                    }
                    , function() {
                        this.editor.menu.openTab('boxes');
                        this.showHighlight(this.editor.menu._feature('boxes', 'basic', 'Text').$button, 'E.g. Click on the "Text" box button to add a Text box.')
                    }
                    , function() {
                        this.editor.boxes.add('Text');
                        this.box1=this.editor.boxes.selected();
                        this.box1.$this.css( {
                                left: 50, top: 50
                            }
                        );
                        this.showHighlight(this.box1.$this, 'A new Text box is created.')
                    }
                    , function() {
                        var $b=this.box1.$this;
                        $b.animate( {
                                left: 250, top: 150
                            }
                            , {
                                specialEasing: {
                                    top: 'easeInQuad', left: 'easeOutQuad'
                                }
                                , complete:function() {
                                    $b.animate( {
                                            left: 50, top: 150
                                        }
                                        , 700).animate( {
                                            left: 50, top: 50
                                        }
                                        , 700)
                                }
                                , duration:1000
                            }
                        );
                        this.showText(150, -50, 'Drag the box to put it where you like it.')
                    }
                    , function() {
                        var $b=this.box1.$this;
                        $b.animate( {
                                width: 350, height: 200
                            }
                            , {
                                complete:$.proxy(function() {
                                        this.showHighlight($b.find('.ui-resizable-handle'))
                                    }
                                    , this), duration:700
                            }
                        );
                        this.showText(150, -50, 'Resize the box by dragging the bottom left corner.')
                    }
                ], cleanup:function() {
                    if(this.box1)this.box1.remove()
                }
            }
        );
        Zedity.tutorials.add('intro2', {
                title:'Introduction: add text content', tutorial:[function() {
                    this.editor.boxes.add('Text');
                    this.box1=this.editor.boxes.selected();
                    this.box1.$this.css( {
                            left: 100, top: 50, width: 200, height: 120
                        }
                    );
                    this.showHighlight(this.box1.$this, 'Create a Text box.')
                }
                    , function() {
                        this.showHighlight(this.box1.$this.find('.zedity-button'), 'Click the button to add content.')
                    }
                    , function() {
                        this.showHighlight(this.editor.menu._feature('editbox', 'textbox', 'insert').$button, 'Or click the "Insert" button.')
                    }
                    , function() {
                        this.box1.background( {
                                colors: ['#ffffff']
                            }
                        );
                        this.box1.content('<div class="zedity-content" style="width:100%;height:100%;color:black;line-height:1.2;font-size:14px;font-family:Arial,Helvetica,sans-serif;display:table-cell;overflow:hidden;"><p style="margin:0px;color:black;font-size:14px;font-family:Arial,Helvetica,sans-serif;"><span class="tutorialhelper">Lorem ipsum</span><br/>Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.</p></div>');
                        this.box1.insert();
                        this.showHighlight(this.box1.$this, 'The box is now in edit mode: you can write your text.')
                    }
                    , function() {
                        this.box1.insert();
                        this.showHighlight(this.editor.menu._group('textbox', 'font').$group, 'Use the text edit/style functions (font, paragraph, etc) in the Text tab.')
                    }
                    , function() {
                        this.box1.insert();
                        this.box1.$this.find('.tutorialhelper').css('background', 'lightskyblue');
                        this.showHighlight(this.box1.$this, 'eg. Select the text you want to style...')
                    }
                    , function() {
                        this.box1.insert();
                        this.showHighlight(this.editor.menu._group('textbox', 'font').$group.find('.zedity-btnB'), '...and click the "Bold" function to make it bold.')
                    }
                    , function() {
                        this.box1.content('<div class="zedity-content" style="width:100%;height:100%;color:black;line-height:1.2;font-size:14px;font-family:Arial,Helvetica,sans-serif;display:table-cell;overflow:hidden;"><h3 style="margin:0px;color:black;font-size:18px;font-family:Arial,Helvetica,sans-serif;font-weight:bold;">Lorem ipsum</h3><p style="margin:0px;color:black;font-size:14px;font-family:Arial,Helvetica,sans-serif;">Lorem ipsum dolor sit <b>amet</b>, consectetur adipiscing elit, sed do <i>eiusmod</i> tempor incididunt ut labore et <span style="color:rgb(254,46,46);">dolore magna aliqua</span>.</p></div>');
                        this.showHighlight(this.box1.$this, 'Write and style your text as desired.')
                    }
                ], cleanup:function() {
                    if(this.box1)this.box1.remove()
                }
            }
        );
        Zedity.tutorials.add('intro3', {
                title:'Introduction: add image', tutorial:[function() {
                    this.editor.boxes.add('Image');
                    this.box1=this.editor.boxes.selected();
                    this.box1.$this.css( {
                            left: 100, top: 50, width: 300, height: 200
                        }
                    );
                    this.showHighlight(this.box1.$this, 'Create an Image box.')
                }
                    , function() {
                        this.showHighlight(this.box1.$this.find('.zedity-button'), 'Click the button to add an image.')
                    }
                    , function() {
                        this.showHighlight(this.editor.menu._feature('editbox', 'imagebox', 'insert').$button, 'Or click the "Insert" button.')
                    }
                    , function() {
                        this.box1.insert();
                        $('.zedity-dialog-image .tabs').tabs('selected', 'tab-image-link');
                        $('#zedity-txtImageLink').val('http://mysite.com/uploads/city.jpg');
                        this.showHighlight($('#zedity-txtImageLink'), 'Insert the link (or get it from your Media Library).')
                    }
                    , function() {
                        $('.zedity-dialog-image').dialog('close');
                        this.box1.content('http://lorempixel.com/300/200/city');
                        this.showHighlight(this.editor.boxes.$selected, 'The image is added.')
                    }
                ], cleanup:function() {
                    if(this.box1)this.box1.remove()
                }
            }
        );
        Zedity.tutorials.add('intro4', {
                title:'Introduction: arrange boxes', tutorial:[function() {
                    this.editor.boxes.add('Text');
                    this.box1=this.editor.boxes.selected();
                    this.box1.$this.css( {
                            left: 70, top: 60, width: 200, height: 150
                        }
                    );
                    this.box1.content('<div class="zedity-content" style="width:100%;height:100%;color:black;line-height:1.2;font-size:14px;font-family:Arial,Helvetica,sans-serif;display:table-cell;overflow:hidden;"><p style="margin:0px;color:lightgreen;font-size:24px;font-family:\'Century Gothic\',sans-serif"><b>Modern cities</b></p></div>');
                    this.editor.boxes.add('Image');
                    this.box2=this.editor.boxes.selected();
                    this.box2.$this.css( {
                            left: 100, top: 70, width: 300, height: 200
                        }
                    );
                    this.box2.content('http://lorempixel.com/300/200/city/3/');
                    this.editor.boxes.add('Image');
                    this.box3=this.editor.boxes.selected();
                    this.box3.$this.css( {
                            left: 200, top: 150, width: 300, height: 200
                        }
                    );
                    this.box3.content('http://lorempixel.com/300/200/city/4/');
                    this.showText(150, -50, 'You can arrange your boxes any way you like to create complex designs.')
                }
                    , function() {
                        var $b=this.box3.$this;
                        $b.animate( {
                                left: 450, top: 50
                            }
                            , 700).animate( {
                                left: 200, top: 250
                            }
                            , {
                                specialEasing: {
                                    top: 'easeOutQuad', left: 'easeInQuad'
                                }
                                , complete:function() {
                                    $b.animate( {
                                            left: 250, top: 100
                                        }
                                        , 700)
                                }
                                , duration:1000
                            }
                        );
                        this.showText(150, -50, 'Drag the box to put it where you like it.')
                    }
                    , function() {
                        this.box1.select();
                        this.showHighlight(this.box1.$this, 'Click on a box to select it.')
                    }
                    , function() {
                        this.box1.select();
                        this.showHighlight(this.editor.menu._feature('editbox', 'layout', 'arrange').$button, 'Use the arrange button to bring a box on foreground.')
                    }
                    , function() {
                        this.editor.menu.activateFeature('editbox', 'layout', 'arrange');
                        this.showHighlight(this.editor.menu._feature('editbox', 'layout', 'arrange').$menu.selectmenu('instance').menu, 'Select "Bring to front" to bring the box on top of the others.')
                    }
                    , function() {
                        this.showHighlight(this.box1.$this, 'Now the box is on top.')
                    }
                    , function() {
                        this.box1.$this.animate( {
                                left: 350, top: 100
                            }
                            , 700);
                        this.showText(150, -50, 'Drag the box to put it where you like it.')
                    }
                    , function() {
                        this.box2.select();
                        this.box2.$this.animate( {
                                left: 50, top: 100
                            }
                            , 500);
                        this.showText(150, -50, 'Create your designs with real drag and drop.')
                    }
                ], cleanup:function() {
                    if(this.box1)this.box1.remove();
                    if(this.box2)this.box2.remove();
                    if(this.box3)this.box3.remove()
                }
            }
        );
        Zedity.tutorials.add('intro5', {
                title:'Introduction: style boxes', tutorial:[function() {
                    this.editor.boxes.add('Image');
                    this.box1=this.editor.boxes.selected();
                    this.box1.$this.css( {
                            left: 100, top: 50, width: 300, height: 200
                        }
                    );
                    this.box1.content('http://lorempixel.com/300/200/city');
                    this.editor.menu.openTab('boxstyle');
                    this.showHighlight(this.editor.menu._tab('boxstyle').$tab, 'Open the "Box style" tab.')
                }
                    , function() {
                        this.showHighlight(this.editor.menu._group('boxstyle', 'border').$group, 'You can add a border to your box.')
                    }
                    , function() {
                        var self=this;
                        var $p=this.editor.menu._feature('boxstyle', 'border', 'width').$panel;
                        this.box1.$this.animate( {
                                'border-width': 15
                            }
                            , {
                                complete:function() {
                                    self.box1.select();
                                    self.editor.menu.refresh()
                                }
                            }
                        );
                        this.showHighlight($p, 'You can set the border width.')
                    }
                    , function() {
                        this.box1.$this.css( {
                                'border-color': 'green', 'border-style': 'dotted'
                            }
                        );
                        this.editor.menu.refresh();
                        this.showHighlight(this.editor.menu._group('boxstyle', 'border').$group, 'Color, style, and other properties...')
                    }
                    , function() {
                        this.showHighlight(this.box1.$this, '...to style the box as you like.')
                    }
                    , function() {
                        this.showHighlight(this.editor.menu.$this.find('.zedity-ribbon-tab-panel:visible'), 'Explore other style options to achieve many cool effects.')
                    }
                ], cleanup:function() {
                    if(this.box1)this.box1.remove()
                }
            }
        )
    }
)(jQuery);
(function($) {
        if(!Zedity)throw new Error(Zedity.t('%s needs %s.', 'Zedity.Box.Audio', 'Zedity'));
        if(!Zedity.Box)throw new Error(Zedity.t('%s needs %s.', 'Zedity.Box.Audio', 'Zedity.Box'));
        Zedity.Box.Audio=function(options) {
            this.type='Audio';
            this._defaults=Zedity.Box.Audio._defaults;
            Zedity.Box.prototype.constructor.call(this, options);
            this._can.remove('background', 'asBackground', 'rotation', 'flip', 'corners');
            if(this.$this.find('object,iframe,audio').length==0) {
                if(this.$this.find('.zedity-empty').length==0) {
                    this.$this.append('<div class="zedity-empty"><p>'+Zedity.t('Click %s to insert audio.', '<span class="zedity-button"><span class="zicon zicon-audio zicon-size-s"></span></span>')+'</p></div>')
                }
            }
            else if(this.$this.find('.zedity-boxoverlay').length==0) {
                this.$this.append('<div class="zedity-boxoverlay"/>')
            }
        }
        ;
        Zedity.Box.Audio.prototype=Object.create(Zedity.Box.prototype);
        Zedity.Box.Audio.prototype.constructor=Zedity.Box.Audio;
        $.extend(Zedity.Box.Audio.prototype, {
                createPropBar:function(options) {
                    Zedity.Box.prototype.createPropBar.call(this);
                    this.editor.menu.add( {
                            tabs: {
                                editbox: {
                                    groups: {
                                        audiobox: {
                                            title:Zedity.t('Audio'), order:-1000, class:'zedity-group-box', features: {
                                                insert: {
                                                    type:'button', icon:'audio', label:Zedity.t('Insert'), title:Zedity.t('Insert audio'), onclick:function(e, ed) {
                                                        var box=ed.boxes.selected();
                                                        if(!box)return;
                                                        box.insert()
                                                    }
                                                }
                                                , play: {
                                                    type:'toggle', order:0, state:[ {
                                                        label: Zedity.t('Play'), icon: 'play', title: Zedity.t('Play audio')
                                                    }
                                                        , {
                                                            label: Zedity.t('Pause'), icon: 'pause', title: Zedity.t('Pause audio')
                                                        }
                                                    ], onclick:function(e, ed, before) {
                                                        var box=ed.boxes.selected();
                                                        if(!box)return false;
                                                        switch(before) {
                                                            case 0: box.start();
                                                                break;
                                                            case 1: box.stop();
                                                                break
                                                        }
                                                    }
                                                    , enable:function(ed, box) {
                                                        if(!box||box.type!='Video')return false;
                                                        var service=box.getService();
                                                        return service&&service.canplay
                                                    }
                                                    , show:function(ed, box) {
                                                        if(!box||box.type!='Video')return false;
                                                        var service=box.getService();
                                                        return!service||(service&&service.canplay)
                                                    }
                                                    , refresh:function(ed, box) {
                                                        if(!box)return;
                                                        this.$button.trigger('toggle', box.$this.hasClass('zedity-playing')?1: 0)
                                                    }
                                                }
                                                , view: {
                                                    type:'toggle', order:0, state:[ {
                                                        label: Zedity.t('Show'), icon: 'view', title: Zedity.t('Show audio')
                                                    }
                                                        , {
                                                            label: Zedity.t('Close'), icon: 'view', title: Zedity.t('Close audio')
                                                        }
                                                    ], onclick:function(e, ed, before) {
                                                        var box=ed.boxes.selected();
                                                        if(!box)return false;
                                                        switch(before) {
                                                            case 0: box.start();
                                                                break;
                                                            case 1: box.stop();
                                                                break
                                                        }
                                                    }
                                                    , show:function(ed, box) {
                                                        if(!box||box.type!='Audio')return false;
                                                        var service=box.getService();
                                                        return!!service&&!service.canplay
                                                    }
                                                    , refresh:function(ed, box) {
                                                        if(!box)return;
                                                        this.$button.trigger('toggle', box.$this.hasClass('zedity-playing')?1: 0)
                                                    }
                                                }
                                            }
                                            , show:function(ed, box) {
                                                return box&&box.type=='Audio'
                                            }
                                        }
                                    }
                                }
                            }
                        }
                        , 'audiobox');
                    return this
                }
                , _sizeLimits:function() {
                    var sl=Zedity.Box.prototype._sizeLimits.call(this);
                    var service=this.getService();
                    if(!service)return sl;
                    return {
                        minWidth: service.sizeLimits.minWidth||sl.minWidth, maxWidth: service.sizeLimits.maxWidth||sl.maxWidth, minHeight: service.sizeLimits.minHeight||sl.minHeight, maxHeight: service.sizeLimits.maxHeight||sl.maxHeight
                    }
                }
                , _save:function(callback) {
                    Zedity.Box.prototype._save.call(this);
                    this.$this.find('.zedity-boxoverlay').remove();
                    if(typeof(callback)=='function')callback.call(this);
                    return this
                }
                , content:function(content) {
                    function checkFiles(content) {
                        var filetypes=Object.keys(this._options.filetypes);
                        for(var i=filetypes.length-1;
                            i>=0;
                            --i) {
                            var rx=new RegExp('\\.'+filetypes[i]+'(?:$|\\?)', 'gm');
                            if(rx.test(content))return true
                        }
                        return false
                    }
                    ;
                    if(content!=null) {
                        if(typeof content=='string'||content instanceof String) {
                            var embed=Zedity.core.embed.parse(content, 'audio');
                            if(!embed.code) {
                                if(checkFiles.call(this, content)) {
                                    return Zedity.core._call(this, 'content', content.split('\n'))
                                }
                                else {
                                    this.editor._error( {
                                            message: Zedity.t('Please provide a valid link/embed code for any of the supported audio services.')
                                        }
                                    )
                                }
                                return this.content()
                            }
                            else {
                                content=(embed.iframe||embed.flash)+'<div class="zedity-boxoverlay"/>';
                                this.$this.css('display', '').attr('data-service', embed.service)
                            }
                        }
                        else if($.isArray(content)) {
                            var html='<div style="display:table-cell;width:100%;vertical-align:middle">'+'<audio controls="controls" style="width:100%;vertical-align:middle">';
                            for(var i=0, len=content.length;
                                i<len;
                                ++i) {
                                var ext=content[i].split('.').pop();
                                if(this._options.filetypes[ext]) {
                                    html+='<source src="'+content[i]+'" type="'+this._options.filetypes[ext]+'"/>'
                                }
                            }
                            html+='<p>Your browser does not support HTML5 audio.</p></audio></div><div class="zedity-boxoverlay"/>';
                            content=html;
                            this.$this.css('display', 'table').attr('data-service', 'html5')
                        }
                        else {
                            this.editor._error( {
                                    message: Zedity.t('Could not interpret the content as audio.')
                                }
                            )
                        }
                    }
                    content=Zedity.Box.prototype.content.call(this, content);
                    var src=[];
                    $(content).find('object,iframe,audio source').each(function() {
                            var ts=$(this).attr('src')||$(this).attr('data');
                            if(ts)src.push(ts)
                        }
                    );
                    content=src.join('\n');
                    this._resize();
                    this.editor.boxes.refreshSelected();
                    return content
                }
                , select:function() {
                    if(this.$this.hasClass('zedity-editing')||this.$this.hasClass('zedity-playing'))return this;
                    Zedity.Box.prototype.select.call(this);
                    return this
                }
                , asBackground:function(setting) {
                    if(setting!=null) {
                        this.editor._error( {
                                message: Zedity.t('%s can\'t be set as background.', 'Audio box')
                            }
                        )
                    }
                    return false
                }
                , rotation:function(setting) {
                    if(setting!=null) {
                        this.editor._error( {
                                message: Zedity.t('%s can\'t be rotated.', 'Audio box')
                            }
                        )
                    }
                    return 0
                }
                , background:function(setting) {
                    if(setting!=null) {
                        this.editor._error( {
                                message: Zedity.t('%s doesn\'t support background property.', 'Audio box')
                            }
                        )
                    }
                    return {
                        type: 'solid', alpha: 1, colors: ['transparent']
                    }
                }
                , corners:function(setting) {
                    if(setting!=null) {
                        this.editor._error( {
                                message: Zedity.t('%s doesn\'t support rounded corners.', 'Audio box')
                            }
                        )
                    }
                    return {
                        'border-top-left-radius': 0, 'border-top-right-radius': 0, 'border-bottom-left-radius': 0, 'border-bottom-right-radius': 0
                    }
                }
                , flip:function(setting) {
                    if(setting!=null) {
                        this.editor._error( {
                                message: Zedity.t('%s doesn\'t support flipping.', 'Audio box')
                            }
                        )
                    }
                    return'none'
                }
                , start:function() {
                    Zedity.Box.prototype.start.call(this);
                    var $obj=this.$this.find('object,iframe,audio');
                    if($obj.lenght==0)return this;
                    var service=this.getService();
                    if(!service)return this;
                    if(this.$this.data('ui-draggable'))this.$this.draggable('option', 'disabled', true);
                    if(this.$this.data('ui-resizable'))this.$this.resizable('option', 'disabled', true);
                    this.$this.removeClass('ui-state-disabled');
                    Zedity.core.embed.player($obj, service.service, 'play');
                    this.$this.addClass('zedity-playing').find('.zedity-boxoverlay').hide();
                    return this
                }
                , stop:function() {
                    Zedity.Box.prototype.stop.call(this);
                    var $obj=this.$this.find('object,iframe,audio');
                    if($obj.lenght==0)return this;
                    var service=this.getService();
                    if(!service)return this;
                    if(this.$this.data('ui-draggable'))this.$this.draggable('option', 'disabled', false);
                    if(this.$this.data('ui-resizable'))this.$this.resizable('option', 'disabled', false);
                    Zedity.core.embed.player($obj, service.service, 'pause');
                    this.$this.removeClass('zedity-playing').find('.zedity-boxoverlay').show();
                    return this
                }
                , insert:function() {
                    Zedity.Box.prototype.insert.call(this);
                    $('.zedity-dialog-audio').data('box', this).dialog('open');
                    return this
                }
                , getService:function() {
                    var service=this.$this.attr('data-service')||this.$this.find('object,iframe,audio').attr('data-service');
                    var data;
                    if(service=='html5') {
                        data= {
                            service:'html5', type:'video', canplay:true, sizeLimits: {
                                minWidth: 45, maxWidth: null, minHeight: 30, maxHeight: 100
                            }
                        }
                    }
                    else {
                        data=Zedity.core.embed.services[service];
                        if(data)data.canplay=!!(data.player.flash.play||data.player.iframe.play)
                    }
                    return data
                }
                , duplicate:function() {
                    var newbox=Zedity.Box.prototype.duplicate.call(this);
                    var $obj=newbox.$this.find('object,iframe,audio');
                    var service=newbox.getService();
                    if(service) {
                        $obj.attr('id', Zedity.core.genId(service.service))
                    }
                    return newbox
                }
                , init:function() {
                    Zedity.Box.prototype.init.call(this);
                    if($('.zedity-dialog-audio').length==0) {
                        var $dialog=$('<div class="zedity-dialog-audio">'+'<div class="tabs">'+'<ul>'+'<li><a href="#tab-audio-embed">'+Zedity.t('Embed')+'</a></li>'+'<li><a href="#tab-audio-files">'+Zedity.t('Files')+'</a></li>'+'</ul>'+'<div id="tab-audio-embed">'+Zedity.t('Insert audio embed code or url:')+'<br/>'+'<textarea id="zedity-txtAudioEmbed" rows="4"></textarea>'+'<p>'+Zedity.t('Supported services:')+'<br/><span id="zedity-lblAudioServices"></span></p>'+'</div>'+'<div id="tab-audio-files">'+Zedity.t('Select audio from the list of available audios:')+'<br/>'+'<select id="zedity-ddAudioFiles"></select>'+'</div>'+'</div>'+'</div>');
                        $dialog.find('.tabs').tabs( {
                                activate:function(event, ui) {
                                    $(this).find('.ui-tabs-panel:visible').find('input[type=text],textarea,select').filter(':visible').filter(':first').focus()
                                }
                            }
                        );
                        this.editor.$container.append($dialog);
                        $dialog.dialog( {
                                title:Zedity.t('Insert audio'), dialogClass:'zedity-dialog', autoOpen:false, modal:true, resizable:false, position: {
                                    my: 'center', at: 'center', of: window.top
                                }
                                , open:function() {
                                    var $this=$(this);
                                    var $tabs=$this.find('.tabs');
                                    var box=$this.data('box');
                                    var disabled=[];
                                    if(box._options.files) {
                                        var files='<option value="-1">--</option>';
                                        for(var i=0, len=box._options.files.length;
                                            i<len;
                                            ++i) {
                                            files+='<option value="'+i+'">'+box._options.files[i].title+'</option>'
                                        }
                                        $('#zedity-ddAudioFiles').html(files)
                                    }
                                    else {
                                        disabled.push($tabs.tabs('getidx', 'tab-audio-files'))
                                    }
                                    var services=Zedity.core.embed.getServices('audio', true);
                                    $('#zedity-lblAudioServices').html(services.join(', '));
                                    $this.find('input[type=text],textarea').val('');
                                    $tabs.tabs('option', {
                                            active: 0, disabled: disabled
                                        }
                                    );
                                    $('#zedity-txtAudioEmbed').val(box.content()).focus()
                                }
                                , close:function() {
                                    $(this).data('box', null)
                                }
                                , buttons:[ {
                                    text:Zedity.t('OK'), class:'zedity-button-ok', click:function() {
                                        var box=$(this).data('box');
                                        $(this).dialog('close');
                                        if(!box)return;
                                        var content='';
                                        switch($(this).find('.tabs').tabs('selected')) {
                                            case'tab-audio-embed': content=$('#zedity-txtAudioEmbed').val();
                                                var embed=Zedity.core.embed.parse(content, 'audio');
                                                if(!embed.code) {
                                                    box.editor._error( {
                                                            message: Zedity.t('Please provide a valid link/embed code for any of the supported audio services.')
                                                        }
                                                    );
                                                    return
                                                }
                                                break;
                                            case'tab-audio-files':var val=parseInt($('#zedity-ddAudioFiles').val());
                                                if(val>-1) {
                                                    content=box._options.files[val].src
                                                }
                                                break
                                        }
                                        box.content(content)
                                    }
                                }
                                    , {
                                        text:Zedity.t('Cancel'), class:'zedity-button-cancel', click:function() {
                                            $(this).dialog('close')
                                        }
                                    }
                                ]
                            }
                        )
                    }
                    return this
                }
            }
        );
        Zedity.Box.Audio.type='Audio';
        Zedity.Box.Audio.sizeLimits= {
            minWidth: 200, minHeight: 70, maxWidth: null, maxHeight: 165
        }
        ;
        Zedity.Box.Audio._defaults= {
            width:200, height:100, filetypes: {
                mp3: 'audio/mpeg', ogg: 'audio/ogg', wav: 'audio/wave', webm: 'audio/webm'
            }
        }
        ;
        Zedity.Box.register( {
                type: Zedity.Box.Audio.type, section: 'media-embed', order: 100
            }
        );
        Zedity.core.embed.add('soundcloud', {
                url:'http://soundcloud.com/', type:'audio', regex:[new RegExp('soundcloud\\.com(?:/|%2F)tracks(?:/|%2F)(.*?)(&|"|\'|$)'), new RegExp('snd\\.sc/(.*?)'), new RegExp('http[s]?://soundcloud\\.com/.+')], parser:function(code, embed) {
                    if(!code[1]) {
                        try {
                            var data=$.ajax( {
                                    type: 'GET', url: 'https://soundcloud.com/oembed?format=json&url='+embed, dataType: 'json', async: false
                                }
                            );
                            data=JSON.parse(data.responseText);
                            code=this.regex[0].exec(data.html)
                        }
                        catch(e) {
                            code=undefined
                        }
                    }
                    if(code) {
                        var id=Zedity.core.genId(this.service);
                        return {
                            id: id, code: code[1], flash: '//player.soundcloud.com/player.swf?url=http%3A%2F%2Fapi.soundcloud.com%2Ftracks%2F'+code[1]+'&amp;show_comments=false&amp;auto_play=false&amp;buying=false&amp;sharing=false&amp;download=false&amp;show_bmp=false&amp;show_playcount=false&amp;enable_api=true&amp;object_id='+id, iframe: '//w.soundcloud.com/player/?url=http%3A%2F%2Fapi.soundcloud.com%2Ftracks%2F'+code[1]+'&amp;auto_play=false&amp;show_artwork=false&amp;show_comments=false&amp;show_playcount=false&amp;buying=false&amp;liking=false&amp;download=false&amp;sharing=false'
                        }
                    }
                    return {}
                }
                , player: {
                    flash: {
                        play: 'play', pause: 'pause'
                    }
                    , iframe: {
                        play:'play', pause:'pause', command:function(frame_id, func, args) {
                            $('#'+frame_id)[0].contentWindow.postMessage(JSON.stringify( {
                                    method: func, value: args
                                }
                            ), '*')
                        }
                    }
                }
                , sizeLimits: {
                    minWidth: 60, minHeight: 60
                }
            }
        );
        Zedity.core.embed.add('reverbnation', {
                url:'http://www.reverbnation.com/', type:'audio', regex:[new RegExp('reverbnation\\.com/widget_code/html_widget(?:_config|)/artist_(.*?)\\?.*?song_ids\\]=(.*?)(&|"|\'|$)'), new RegExp('reverbnation\\.com/artist/artist_songs/(.*?)\\?song_id=(.*?)(&|"|\'|$)')], parser:function(code) {
                    if(!code[2])code[2]='';
                    return {
                        code: code[2], iframe: '//www.reverbnation.com/widget_code/html_widget/artist_'+code[1]+'?widget_id=50&pwc[included_songs]=0&pwc[song_ids]='+code[2]+'&pwc[photo]=0&pwc[size]=fit'
                    }
                }
                , sizeLimits: {
                    minWidth: 200, minHeight: 65, maxHeight: 105
                }
            }
        )
    }
)(jQuery);
(function($) {
        if(!Zedity)throw new Error(Zedity.t('%s needs %s.', 'Zedity.Box.Color', 'Zedity'));
        if(!Zedity.Box)throw new Error(Zedity.t('%s needs %s.'), 'Zedity.Box.Color', 'Zedity.Box');
        Zedity.Box.Color=function(options) {
            this.type='Color';
            this._defaults=Zedity.Box.Color._defaults;
            Zedity.Box.prototype.constructor.call(this, options);
            this._can.remove('flip');
            if(!this._options.id&&!this._options.element) {
                this.$this.append('<p style="color:transparent">_</p><div class="zedity-empty"><p>'+Zedity.t('Click %s to add color.', '<span class="zedity-button"><span class="zicon zicon-color zicon-size-s"></span></span>')+'</p></div>')
            }
        }
        ;
        Zedity.Box.Color.prototype=Object.create(Zedity.Box.prototype);
        Zedity.Box.Color.prototype.constructor=Zedity.Box.Color;
        $.extend(Zedity.Box.Color.prototype, {
                createPropBar:function(options) {
                    Zedity.Box.prototype.createPropBar.call(this);
                    this.editor.menu.add( {
                            tabs: {
                                editbox: {
                                    groups: {
                                        colorbox: {
                                            title:Zedity.t('Color'), order:-1000, class:'zedity-group-box', features: {
                                                insert: {
                                                    type:'button', icon:'color', label:Zedity.t('Add'), title:Zedity.t('Add color'), onclick:function(e, ed) {
                                                        var box=ed.boxes.selected();
                                                        if(!box)return;
                                                        box.insert()
                                                    }
                                                }
                                            }
                                            , show:function(ed, box) {
                                                return box&&box.type=='Color'
                                            }
                                        }
                                    }
                                }
                            }
                        }
                        , 'colorbox');
                    return this
                }
                , _save:function(callback) {
                    Zedity.Box.prototype._save.call(this);
                    if(typeof(callback)=='function')callback.call(this);
                    return this
                }
                , select:function() {
                    Zedity.Box.prototype.select.call(this);
                    return this
                }
                , flip:function(setting) {
                    if(setting!=null) {
                        this.editor._error( {
                                message: Zedity.t('%s doesn\'t support flipping.', 'Color box')
                            }
                        )
                    }
                    return'none'
                }
                , start:function() {
                    Zedity.Box.prototype.start.call(this);
                    return this
                }
                , stop:function() {
                    Zedity.Box.prototype.stop.call(this);
                    return this
                }
                , insert:function() {
                    Zedity.Box.prototype.insert.call(this);
                    if(this.editor.menu) {
                        this.editor.menu.activateFeature('boxstyle', 'background', 'color')
                    }
                    return this
                }
                , init:function() {
                    Zedity.Box.prototype.init.call(this);
                    return this
                }
            }
        );
        Zedity.Box.Color.type='Color';
        Zedity.Box.Color.sizeLimits= {
            minWidth: 16, minHeight: 16, maxWidth: null, maxHeight: null
        }
        ;
        Zedity.Box.Color._defaults= {
            width: 150, height: 150
        }
        ;
        Zedity.Box.register( {
                type: Zedity.Box.Color.type, requires: [], section: 'basic', order: 1000
            }
        )
    }
)(jQuery);
(function($) {
        Zedity.utils=Zedity.utils|| {}
        ;
        Zedity.utils.fileTypes= {
            types: {
                jpeg: {
                    type: 'jpeg', mime: 'image/jpeg', extensions: 'jpeg jpg jpe', signature: '/9j', canResize: true
                }
                , png: {
                    type: 'png', mime: 'image/png', extensions: 'png', signature: 'iVBORw0KGgo', canResize: true
                }
                , gif: {
                    type: 'gif', mime: 'image/gif', extensions: 'gif', signature: 'R0lG', canResize: false
                }
            }
            , _notfound: {
                type: '', mime: ''
            }
            , parse:function(data, accept) {
                accept=accept||Object.keys(this.types);
                try {
                    var imgheader=/base64, (. {
                        40
                    }
                )/.exec(data)[1]
                }
                catch(e) {
                    return this._notfound
                }
                for(var i=accept.length-1;
                    i>=0;
                    --i) {
                    var filetype=this.types[accept[i]];
                    if(imgheader.substr(0, filetype.signature.length)==filetype.signature) {
                        return filetype
                    }
                }
                return this._notfound
            }
            , fromExtension:function(filename, accept) {
                accept=accept||Object.keys(this.types);
                var ext=filename.split('.').pop();
                for(var i=accept.length-1;
                    i>=0;
                    --i) {
                    if(this.types[accept[i]].extensions.indexOf(ext)>-1) {
                        return this.types[accept[i]]
                    }
                }
                return this._notfound
            }
        }
    }
)(jQuery);
(function($) {
    if(!Zedity)throw new Error(Zedity.t('%s needs %s.', 'Zedity.Box.Image', 'Zedity'));
    if(!Zedity.Box)throw new Error(Zedity.t('%s needs %s.', 'Zedity.Box.Image', 'Zedity.Box'));
    Zedity.Box.Image=function(options) {
        this.type='Image';
        this._defaults=Zedity.Box.Image._defaults;
        Zedity.Box.prototype.constructor.call(this, options);
        this._can.push('layout');
        if(!this.$this.find('img').length) {
            this.$this.append($('<div/>', {
                    class:'zedity-content', css: {
                        position: 'relative', width: '100%', height: '100%', overflow: 'hidden'
                    }
                    , html:$('<img/>', {
                        src:this._options.src, css: {
                            position: 'absolute', margin: 0
                        }
                    }
                    )
                }
            )).append('<div class="zedity-empty"><p>'+Zedity.t('Click %s to insert image.', '<span class="zedity-button"><span class="zicon zicon-image zicon-size-s"></span></span>')+'</p></div>');
            Zedity.core._call(this, 'layout', this._options.layout);
            if(this._options.proportionalResize)this.$this.attr('data-aspectratio', 1)
        }
        else if(!this.$this.find('div.zedity-content').length) {
            this.$this.find('img').removeClass('zedity-content').wrap($('<div/>', {
                    class:'zedity-content', css: {
                        position: 'relative', width: '100%', height: '100%', overflow: 'hidden'
                    }
                }
            ))
        }
        this.$this.find('style.imgData').detach().appendTo('head');
        Zedity.core._call(this, 'content', this.content(), null, true)
    }
    ;
    Zedity.Box.Image.prototype=Object.create(Zedity.Box.prototype);
    Zedity.Box.Image.prototype.constructor=Zedity.Box.Image;
    $.extend(Zedity.Box.Image.prototype, {
        createPropBar:function(options) {
            Zedity.Box.prototype.createPropBar.call(this);
            this.editor.menu.add( {
                    tabs: {
                        editbox: {
                            groups: {
                                imagebox: {
                                    title:Zedity.t('Image'), order:-1000, class:'zedity-group-box', features: {
                                        insert: {
                                            type:'button', icon:'image', label:Zedity.t('Insert'), title:Zedity.t('Insert image'), order:0, onclick:function(e, ed) {
                                                var box=ed.boxes.selected();
                                                if(!box)return;
                                                box.insert()
                                            }
                                        }
                                        , layout: {
                                            type:'menu', icon:'imagelayout', label:Zedity.t('Layout'), title:Zedity.t('Select image layout'), order:100, items:[ {
                                                label: Zedity.t('Center & fill'), value: 'centerfill'
                                            }
                                                , {
                                                    label: Zedity.t('Fit'), value: 'fit'
                                                }
                                                , {
                                                    label: Zedity.t('Center'), value: 'center'
                                                }
                                                , {
                                                    label: Zedity.t('Stretch'), value: 'stretch'
                                                }
                                            ], onclick:function(val, e, ed) {
                                                var box=ed.boxes.selected();
                                                if(!box)return;
                                                box.layout(val)
                                            }
                                            , enable:function(ed, box) {
                                                return(box&&box.$this.children('.zedity-empty').length==0)
                                            }
                                        }
                                        , config: {
                                            type:'extpanel', icon:'config2', label:Zedity.t('Options'), title:Zedity.t('Image options'), size:'xs', order:200, build:function($panel, ed) {
                                                $panel.append('<div class="zedity-image-quality-feat" style="border-bottom:1px solid silver;padding-bottom:10px;margin-bottom: 10px">'+'<span>'+Zedity.t('Image quality')+'&nbsp;</span>'+'<select class="zedity-image-quality">'+'<option value="2">'+Zedity.t('Original')+'</option>'+'<option value="0.92">'+Zedity.t('High')+'</option>'+'<option value="0.88">'+Zedity.t('Normal')+'</option>'+'<option value="0.75">'+Zedity.t('Low')+'</option>'+'</select>'+'</div>'+'<span class="zedity-button zedity-imagepropresize">'+'<span class="zicon zicon-size-xs zicon-resize"></span> '+Zedity.t('Proportional resize')+'</span><br/>'+'<span class="zedity-button zedity-imageoriginalsize">'+'<span class="zicon zicon-size-xs zicon-image"></span> '+Zedity.t('Set box to image original size')+'</span>');
                                                $panel.find('.zedity-image-quality').selectmenu( {
                                                        width:'auto', appendTo:$panel, change:function(e, ui) {
                                                            var box=ed.boxes.selected();
                                                            if(!box)return;
                                                            box._options.quality=parseFloat(ui.item.value)
                                                        }
                                                    }
                                                );
                                                $panel.find('.zedity-imagepropresize').on('click.zedity', function() {
                                                        var box=ed.boxes.selected();
                                                        if(!box)return;
                                                        var val=!box.proportionalResize();
                                                        val=box.proportionalResize(val);
                                                        $(this).toggleClass('zedity-pressed', val)
                                                    }
                                                );
                                                $panel.find('.zedity-imageoriginalsize').on('click.zedity', function() {
                                                        var box=ed.boxes.selected();
                                                        if(box)box.resizeToContent()
                                                    }
                                                )
                                            }
                                            , refresh:function(ed, box) {
                                                if(!box)return;
                                                this.$extpanel.find('.zedity-image-quality').val(box._options.quality).selectmenu('refresh');
                                                this.$extpanel.find('.zedity-imagepropresize').toggleClass('zedity-pressed', box.proportionalResize())
                                            }
                                            , enable:function(ed, box) {
                                                return(box&&box.$this.children('.zedity-empty').length==0)
                                            }
                                        }
                                    }
                                    , show:function(ed, box) {
                                        return box&&box.type=='Image'
                                    }
                                }
                            }
                        }
                    }
                }
                , 'imagebox');
            if($('.zedity-dialog-image').length==0) {
                var $dialog=$('<div class="zedity-dialog-image">'+'<div class="tabs">'+'<ul>'+'<li><a href="#tab-image-disk">'+Zedity.t('Disk')+'</a></li>'+'<li><a href="#tab-image-link">'+Zedity.t('Link')+'</a></li>'+'</ul>'+'<div id="tab-image-disk">'+Zedity.t('Supported image file types:')+'<br/><span id="zedity-lblSupportedImages"></span><br/><br/>'+Zedity.t('Select image file from disk (max size %s):', '<span id="zedity-lblMaxSize"></span>')+'<br/><br/>'+'<button class="ui-button ui-widget ui-state-default ui-corner-all ui-button-text-only zedity-fileupload"><span class="ui-button-text">'+Zedity.t('Browse...')+'</span></button>'+'<p id="zedity-lblImageDisk" class="selected-file"></p>'+'<p class="zedity-image-quality">'+Zedity.t('Image quality:')+' '+'<select id="zedity-ddImageQuality" style="width:150px;">'+'<option value="2">'+Zedity.t('Original')+'</option>'+'<option value="0.92">'+Zedity.t('High')+'</option>'+'<option value="0.88" selected="selected">'+Zedity.t('Normal')+'</option>'+'<option value="0.75">'+Zedity.t('Low')+'</option>'+'</select>'+'</p>'+'</div>'+'<div id="tab-image-link">'+Zedity.t('Insert image URL link:')+'<br/>'+'<textarea id="zedity-txtImageLink" rows="4"></textarea>'+'</div>'+'</div>'+'<p class="zedity-image-description">'+Zedity.t('Image description:')+'<br/>'+'<input id="zedity-txtImageDescription" type="text" value=""><br/><br/>'+'</p>'+'</div>');
                $dialog.find('.tabs').tabs( {
                        activate:function(event, ui) {
                            $(this).find('.ui-tabs-panel:visible').find('input[type=text],textarea,select,button').filter(':visible').filter(':first').focus()
                        }
                    }
                );
                this.editor.$container.append($dialog);
                $dialog.dialog( {
                        title:Zedity.t('Insert image'), dialogClass:'zedity-dialog', autoOpen:false, modal:true, resizable:false, position: {
                            my: 'center', at: 'center', of: window.top
                        }
                        , open:function() {
                            var $this=$(this);
                            var box=$this.data('box');
                            var disabled=[];
                            if(!box._options.allowLink)disabled.push(1);
                            $this.find('input[type=text],textarea').val('');
                            $this.find('#zedity-ddImageQuality').val(0.88);
                            $this.find('#zedity-lblMaxSize').text(Zedity.utils.beautifySize(box._options.maxSize));
                            $this.find('.tabs').tabs('option', {
                                    active: 0, disabled: disabled
                                }
                            );
                            $this.find('#zedity-lblSupportedImages').text(Object.keys(Zedity.utils.fileTypes.types).join(', '));
                            var content=box.content();
                            if(content&&/^http/.test(content)) {
                                $this.find('.tabs').tabs('selected', 'tab-image-link');
                                $this.find('#zedity-txtImageLink').val(content)
                            }
                            $this.find('#zedity-txtImageDescription').val(box.$this.find('img').attr('alt')||'')
                        }
                        , close:function() {
                            var $this=$(this);
                            $('#zedity-lblImageDisk').text('');
                            $this.find('.zedity-fileupload').upload('clear')
                        }
                        , buttons:[ {
                            text:Zedity.t('OK'), class:'zedity-button-ok', click:function() {
                                var $this=$(this);
                                var box=$this.data('box');
                                if(box) {
                                    var $inputDescription=$('#zedity-txtImageDescription');
                                    if(box._options.descriptionMandatory&&$inputDescription.val().length<4) {
                                        if($inputDescription.val().length==0) {
                                            box.editor._error( {
                                                    message: Zedity.t('Please insert image description.')
                                                }
                                            )
                                        }
                                        else if($inputDescription.val().length<4) {
                                            box.editor._error( {
                                                    message: Zedity.t('Image description is too short.')
                                                }
                                            )
                                        }
                                        $inputDescription.focus();
                                        return
                                    }
                                    box._data.filterOriginal=null;
                                    switch($this.find('.tabs').tabs('selected')) {
                                        case'tab-image-disk': var $fu=$this.find('.zedity-fileupload');
                                            if($fu.upload('getfilename')=='') {
                                                box.editor._error( {
                                                        message: Zedity.t('No file selected.')
                                                    }
                                                );
                                                return
                                            }
                                            box._options.quality=parseFloat($this.find('#zedity-ddImageQuality').val());
                                            if(box._options.quality==1)box._options.quality=2;
                                            $fu.upload('submit');
                                            break;
                                        case'tab-image-link':var content=$('#zedity-txtImageLink').val();
                                            if(content=='') {
                                                box.editor._error( {
                                                        message: Zedity.t('Please insert a link.')
                                                    }
                                                );
                                                return
                                            }
                                            box.content(content);
                                            break
                                    }
                                    box.description($inputDescription.val())
                                }
                                $(this).dialog('close')
                            }
                        }
                            , {
                                text:Zedity.t('Cancel'), class:'zedity-button-cancel', click:function() {
                                    $(this).dialog('close')
                                }
                            }
                        ]
                    }
                )
            }
            $('.zedity-dialog-image .zedity-fileupload').upload( {
                    autosubmit:false, acceptmime:$.map(this._options.accept, function(key) {
                        return Zedity.utils.fileTypes.types[key].mime
                    }
                    ).join(','), extensions:$.map(this._options.accept, function(key) {
                        return Zedity.utils.fileTypes.types[key].extensions
                    }
                    ).join(' '), action:this._options.action, maxsize:this._options.maxSize, onselect:$.proxy(function(event, file) {
                        var fn=$(file).val();
                        fn=fn.split(/[\\\/]/).pop();
                        $('#zedity-lblImageDisk').html('Selected file:<br/><b>'+fn+'</b>');
                        $('#zedity-txtImageDescription').focus()
                    }
                    , this), onsubmit:function(file) {
                        var $this=$(this);
                        var data=$this.data('upload');
                        var box=$this.parents('.zedity-dialog-image').data('box');
                        box._loading();
                        data.$input.trigger('mouseout.upload');
                        if(!Zedity.core.supports.fileapi()) {
                            box.editor._data.imageupload=box;
                            return true
                        }
                        Zedity.utils.resizeImage(file.files[0], {
                                maxwidth:box._sizeLimits().maxWidth, maxheight:box._sizeLimits().maxHeight, aspectratio:true, quality:box._options.quality, accept:box._options.accept, onerror:function(error) {
                                    box.editor._error(error)
                                }
                                , onresizeend:function(size, data, type) {
                                    box.content(data, size);
                                    box._data.fileType=type
                                }
                            }
                        );
                        return false
                    }
                    , oncomplete:function(event, response) {
                        var box=$(this).parents('.zedity-dialog-image').data('box');
                        if(!box)return;
                        if(response.status=='OK') {
                            if(box.editor._data.imageupload) {
                                box.editor._data.imageupload.content(response.data);
                                delete box.editor._data.imageupload
                            }
                            else {
                                box.editor._error( {
                                        message: Zedity.t('An unexpected error occurred. Please try again.')
                                    }
                                )
                            }
                        }
                        else {
                            box.editor._error( {
                                    message: Zedity.t('There was an error during server image resize.')
                                }
                            )
                        }
                    }
                    , onerror:function(error) {
                        var box=$(this).parents('.zedity-dialog-image').data('box');
                        if(!box)return;
                        box.editor._error(error)
                    }
                }
            );
            return this
        }
        , _loading:function(set) {
            if(set===false) {
                this.$this.find('.zedity-loading').remove()
            }
            else {
                this.$this.find('.zedity-empty').remove();
                this.$this.append('<div class="zedity-loading"><p>'+Zedity.t('Loading...')+'</p></div>')
            }
            return this
        }
        , _checkSize:function() {
            this.$this.removeClass('zedity-warn-size-up zedity-warn-size-down');
            if(this._data.size) {
                var $img=this.$this.find('img');
                var w=$img.width(), h=$img.height();
                if(this._data.size.width<w||this._data.size.height<h) {
                    this.$this.addClass('zedity-warn-size-down')
                }
                else if(this._data.size.width>w||this._data.size.height>h) {
                    this.$this.addClass('zedity-warn-size-up')
                }
            }
            return this
        }
        , setOriginalSize:function() {
            return this.resizeToContent()
        }
        , content:function(content, size, dontresize, onload) {
            function resizeBox() {
                this.editor._changed();
                if(dontresize) {
                    Zedity.core._call(this, 'layout', this.layout());
                    return
                }
                var old=this.proportionalResize();
                Zedity.core._call(this, 'proportionalResize', true);
                if(!old)Zedity.core._call(this, 'proportionalResize', false)
            }
            ;
            function getSize(content) {
                var img=new Image();
                img.onload=$.proxy(function() {
                        this._data.size= {
                            width: img.width, height: img.height
                        }
                        ;
                        img=null;
                        resizeBox.call(this);
                        onload.call(this)
                    }
                    , this);
                img.src=content
            }
            ;
            if(content==null) {
                content=this.$this.find('img').css('background-image');
                if(/data: image\ //.test(content)){content=/(url\("?)(data:.*?)("?\))/i.exec(content)[2]}else if(/^url\(/.test(content)){content=/(url\("?)(.*?)("?\))/i.exec(content)[2]}else{content=this.$this.find('img').attr('src')}if(content==this._options.src)content=null}else{onload=onload||function(){};if(/^http/.test(content)){this._loading();this.$this.removeNumberedClass('imgDataS');this.$this.find('img').css({'background-image':'','background-size':'','background-position':''}).attr('src',content);this._loading(false);this._data.fileType=Zedity.utils.fileTypes.fromExtension(content);getSize.call(this,content)}else if(/^data:/.test(content)){this._loading();this.$this.find('img').css({'background-image':'','background-size':'100% 100%','background-position':'left top'}).attr('src',this._options.src);var idx=$('style.imgData').getEmptyNumberedClass('imgDataS');var $imgData=$('<style class="imgData imgDataS'+idx+'" type="text/css"></style>');$imgData.appendTo('head');$imgData.html('#'+this.editor.id+' .imgDataS'+idx+' img{background-image:url("'+content+'")}');this.$this.removeNumberedClass('imgDataS').addClass('imgDataS'+idx);this._addReference();if(this.layout()=='stretch'&&this.$this.find('img')[0].style.backgroundSize=='100%')this.layout('stretch');this._loading(false);if(size){this._data.size=size;resizeBox.call(this)}else{getSize.call(this,content)}}else{this.editor._error({message:Zedity.t('Could not interpret the content as image.')})}}return content},resizeToContent:function(){this.$this.css({width:this._data.size.width,height:this._data.size.height});Zedity.core._call(this,'layout',this.layout());this.reposition()._resize();this.editor.boxes.refreshSelected();this.editor._changed();return this},extractText:function(){this._data.$clone=this.$this.clone();this._data.$clone.find('style').remove();return Zedity.Box.prototype.extractText.call(this)},description:function(description){if(description!=null){this.$this.find('img').attr('alt',description)}else{description=this.$this.find('img').attr('alt')}return description},select:function(){Zedity.Box.prototype.select.call(this);if(this.$this.is(':data(ui-resizable)')){this.$this.resizable('option','aspectRatio',this.proportionalResize())}if(this.$this.data('ui-resizable')){this.$this.resizable('option','resize',$.proxy(function(){Zedity.core._call(this,'layout',this.layout())},this))}return this},_getQualityName:function(){if(this._options.quality<0.8){return'low'}else if(this._options.quality<0.9){return'normal'}else if(this._options.quality<=1){return'high'}else{return'original'}},start:function(){Zedity.Box.prototype.start.call(this);return this},stop:function(){Zedity.Box.prototype.stop.call(this);return this},insert:function(){Zedity.Box.prototype.insert.call(this);$('.zedity-dialog-image').data('box',this).dialog('open');return this},duplicate:function(){Zedity.Box.prototype.duplicate.call(this);if(this.layout()=='stretch'&&this.$this.find('img')[0].style.backgroundSize=='100%')this.layout('stretch');this.editor.boxes.selected()._addReference();return this},init:function(){Zedity.Box.prototype.init.call(this);if(this.$this.hasNumberedClass('imgDataS')){this._addReference();var nc=this.$this.getNumberedClass('imgDataS');var style=this.editor.$this.children('style.'+nc);if(style){style.detach().appendTo('head')}}return this},layout:function(layout){if(layout){this.$this.attr('data-layout',layout);if(!this._data.size)return layout;var wratio,hratio,ratio,width,height;var $c=this.$this.find('.zedity-content');switch(layout){case'fit':wratio=$c.width()/this._data.size.width;hratio=$c.height()/this._data.size.height;ratio=Math.min(wratio,hratio);width=Math.round(this._data.size.width*ratio);height=Math.round(this._data.size.height*ratio);break;case'centerfill':wratio=$c.width()/this._data.size.width;hratio=$c.height()/this._data.size.height;ratio=Math.max(wratio,hratio);width=Math.round(this._data.size.width*ratio);height=Math.round(this._data.size.height*ratio);break;case'stretch':width=$c.width();height=$c.height();break;case'center':width=this._data.size.width;height=this._data.size.height;break}this.$this.find('img').css({left:Math.round(($c.width()-width)/2),top:Math.round(($c.height()-height)/2),width:width,height:height});this._checkSize();this.editor._changed()}else{layout=this.$this.attr('data-layout')||''}return layout},proportionalResize:function(value){if(this.asBackground())return false;if(this.$this.find('.zedity-empty').length>0)return false;if(value===true){this.$this.attr('data-aspectratio',1);if(!this._data.size){Zedity.core._call(this,'content',Zedity.core._call(this,'content'));setTimeout($.proxy(function(){Zedity.core._call(this,'proportionalResize',true)},this),0);return true}var wratio=this.$this.width()/this._data.size.width;var hratio=this.$this.height()/this._data.size.height;var ratio=(wratio<hratio)?wratio:hratio;var width=Math.round(this._data.size.width*ratio);var height=Math.round(this._data.size.height*ratio);this.$this.css({width:width,height:height});if(this.$this.is(':data(ui-resizable)')){this.$this.resizable('option','aspectRatio',value)}Zedity.core._call(this,'layout',this.layout());this.editor.boxes.refreshSelected();this.editor._changed()}else if(value===false){this.$this.removeAttr('data-aspectratio');Zedity.core._call(this,'layout',this.layout());this.editor.boxes.refreshSelected();this.editor._changed()}return this.$this.attr('data-aspectratio')==1},asBackground:function(setting){var res=Zedity.Box.prototype.asBackground.call(this,setting);Zedity.core._call(this,'layout',this.layout());return res},_removeUnreferencedData:function(){var list=Zedity.core.gc.getNonReferenced('imageGc');for(var i=list.length-1;i>=0;--i){$('style.'+list[i]).remove()}Zedity.core.gc.deleteReference(list);return this},_addReference:function(){if(this.$this.hasNumberedClass('imgDataS')){var nc=this.$this.getNumberedClass('imgDataS');Zedity.core.gc.addReference(nc,'imageGc');Zedity.core.gc.addReference(nc,'imageGc-'+this.id)}return this},_save:function(callback,options){this._removeUnreferencedData();var nc=this.$this.getNumberedClass('imgDataS');if(nc){var style=$('head style.'+nc);if(style.length>0){if(!options.finalize){style.detach().appendTo(this.$this);if(typeof(callback)=='function')callback.call(this);return this}if(['center','tile'].indexOf(this.layout())>-1){style.detach().appendTo(this.$this);if(typeof(callback)=='function')callback.call(this)}else{var box=this;var bsize={w:0,h:0};this.editor.$this.children('.zedity-box-Image.'+nc).each(function(idx,elem){bsize.w=Math.max(bsize.w,$(elem).width());bsize.h=Math.max(bsize.h,$(elem).height())});Zedity.utils.resizeImage(style.html(),{maxwidth:bsize.w,maxheight:bsize.h,aspectratio:true,quality:this._options.quality,accept:this._options.accept,onerror:function(error){box.editor._error(error)},onresizeend:function(size,data,type){Zedity.core._call(box,'content',data,size,true);box._data.fileType=type;var newnc=box.$this.getNumberedClass('imgDataS');box.editor.$this.children('.zedity-box-Image.'+nc).removeClass(nc).addClass(newnc);box._addReference();$('head style.'+newnc).detach().appendTo(box.$this);style.remove();Zedity.Box.prototype._save.call(box);if(typeof(callback)=='function')callback.call(this)}})}}else{Zedity.Box.prototype._save.call(this);if(typeof(callback)=='function')callback.call(this)}}else{Zedity.Box.prototype._save.call(this);if(typeof(callback)=='function')callback.call(this)}return this},destroy:function(){Zedity.Box.prototype.destroy.call(this);var ref=Zedity.core.gc.getReferenced('imageGc-'+this.id);for(var i=ref.length-1;i>=0;--i){Zedity.core.gc.removeReference(ref[i],'imageGc')}Zedity.core.gc.flushData('imageGc-'+this.id);this._removeUnreferencedData();return this}});Zedity.Box.Image.type='Image';Zedity.Box.Image.sizeLimits={minWidth:16,minHeight:16,maxWidth:null,maxHeight:null};Zedity.Box.Image._defaults={src:'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',width:250,height:200,layout:'centerfill',proportionalResize:true,quality:0.88,accept:Object.keys(Zedity.utils.fileTypes.types),maxSize:1000000,descriptionMandatory:true,allowLink:true};Zedity.Box.register({type:Zedity.Box.Image.type,requires:['canvas'],section:'basic',order:100});Zedity.core.gc.flushData('imageGc');Zedity.core.store.delprefix('imageGc-')})(jQuery);(function($){$.fn.upload=function(method){var methods={init:function(options){var settings={autosubmit:true,name:'file',acceptmime:'',extensions:undefined,maxsize:undefined,action:'/fake.php',enctype:'multipart/form-data',onsubmit:function(file){},oncomplete:function(event,response){},onselect:function(event,file){},onerror:function(error){}};$.extend(settings,options);if(typeof(settings.extensions)=='string')settings.extensions=settings.extensions.split(' ');return this.each(function(idx,elem){var $upload=$(this);if($upload.data('upload'))return;var id=Zedity.core.genId('upload');var $iframe=$('<iframe/>',{id:id,name:id,src:'javascript:false;',css:{display:'none'}});var $form=$('<form/>',{method:'post',enctype:settings.enctype,action:settings.action,target:id});var $input=$('<input/>',{name:settings.name,type:'file',accept:settings.acceptmime,css:{position:'absolute',right:-4,margin:0,padding:0,'font-size':'480px',opacity:0}}).on('change.upload',function(event){if(typeof(settings.onselect)=='function')settings.onselect.call($upload[0],event,$input[0]);if(settings.autosubmit)$upload.upload('submit')}).appendTo($form);$upload.data('upload',{$input:$input,$form:$form,$iframe:$iframe,extensions:settings.extensions,maxsize:settings.maxsize,onsubmit:settings.onsubmit,oncomplete:settings.oncomplete,onerror:settings.onerror});var $container=$('<div>',{css:{position:'absolute',zIndex:10000,padding:0,overflow:'hidden'}}).append($form).append($iframe);$upload.add($container).on('mouseenter.upload',function(){$container.css({left:$upload.offset().left,top:$upload.offset().top,width:$upload.outerWidth(),height:$upload.outerHeight()});$input.css({cursor:$upload.css('cursor')}).attr('title',$upload.attr('title'));$upload.addClass('zedity-hover')}).on('mouseleave.upload',function(){$upload.removeClass('zedity-hover')});$upload.on('focus.upload',function(){$upload.blur();var tabbables=$(":tabbable:visible");var index=tabbables.index($upload);tabbables.eq(index+1).focus()}).on('click.upload',function(){$input.show().focus().click().hide();return false});$('body').append($container)})},validate:function(){var data=$(this).data('upload');if(data.extensions){var ext=data.$input.val().split('.').pop().toLowerCase();if(data.extensions.indexOf(ext)<0){data.onerror.call(this,{message:Zedity.t('File extension not valid.')});data.$input.val('');return false}}if(data.maxsize&&Zedity.core.supports.fileapi()){if(data.$input[0].files[0].size>data.maxsize){data.onerror.call(this,{message:Zedity.t('File too big (max size: %s).',Zedity.utils.beautifySize(data.maxsize))});data.$input.val('');return false}}return true},getfilename:function(){var data=$(this).data('upload');if(data.$input){return data.$input.val()}return''},clear:function(){var data=$(this).data('upload');data.$input.val('')},submit:function(){var $this=$(this);var data=$this.data('upload');if(!$this.upload('validate'))return false;if(typeof(data.onsubmit)=='function')var ret=data.onsubmit.call(this,data.$input[0]);if(ret===false){data.$input.val('');return false}data.$iframe.off('load.upload').on('load.upload',function(event){data.$input.val('');var response=$(this).contents().find('body').html();try{response=JSON.parse(response)}catch(e){response={status:'ERROR',message:Zedity.t('Error in reading the response from the server')}}if(typeof(data.oncomplete)=='function')data.oncomplete.call($this[0],event,response)});data.$form.submit()}};if(methods[method]){return methods[method].apply(this,Array.prototype.slice.call(arguments,1))}else if(typeof method==='object'||!method){return methods.init.apply(this,arguments)}else{throw new Error(Zedity.t('Method %s does not exist on %s.',method,'jQuery.upload'))}};(function(){var oldSetOption=$.ui.resizable.prototype._setOption;$.ui.resizable.prototype._setOption=function(key,value){oldSetOption.apply(this,arguments);if(key==='aspectRatio')this._aspectRatio=!!value}})();Zedity.utils.resizeImage=function(input,options){if(!input)throw new Error(Zedity.t('Input not defined'));if(input instanceof jQuery)input=input[0];var MAX_FILE_SIZE=10000000;options=$.extend({maxwidth:1024,maxheight:1024,aspectratio:true,quality:0.88,accept:Object.keys(Zedity.utils.fileTypes.types),onerror:null,onresizeend:null},options);if(typeof(options.onerror)!='function')options.onerror=function(event){};if(typeof(options.onresizeend)!='function')options.onresizeend=function(size,data,type){};options.aspectratio=!!options.aspectratio;function resize(){options.origwidth=options.origwidth||options.image.width;options.origheight=options.origheight||options.image.height;options.maxwidth=options.maxwidth||options.image.width;options.maxheight=options.maxheight||options.image.height;var origImgSize=options.image.src.length;options.ftype=options.ftype||Zedity.utils.fileTypes.parse(options.image.src.substr(0,100),options.accept);var needResize=false;var width=options.maxwidth;var height=options.maxheight;if(!options.ftype.canResize){options.onerror({type:'WARNING',message:Zedity.t('Image file type cannot be resized.')});options.onresizeend({width:width,height:height},options.image.src,options.ftype);return}if(options.quality>1){options.onresizeend({width:width,height:height},options.image.src,options.ftype);return}var $canvas=$('<canvas/>');var canvas=$canvas[0];var context=canvas.getContext('2d');var userQualFactor=1;var wratio=(options.maxwidth/options.origwidth)*userQualFactor;var hratio=(options.maxheight/options.origheight)*userQualFactor;if(!options.aspectratio){width=wratio>1?options.origwidth:options.maxwidth;height=hratio>1?options.origheight:options.maxheight}else{if(wratio>1||hratio>1){wratio=hratio=1}else{if(wratio>hratio)hratio=wratio;else wratio=hratio}width=Math.round(options.origwidth*wratio);height=Math.round(options.origheight*hratio)}canvas.width=width;canvas.height=height;context.drawImage(options.image,0,0,canvas.width,canvas.height);var tmp;try{tmp=canvas.toDataURL(options.ftype.mime,options.quality)}catch(e){tmp=canvas.toDataURL('image/jpeg')}if((0.95*origImgSize)>tmp.length){options.onresizeend({width:width,height:height},tmp,options.ftype)}else{width=options.origwidth;height=options.origheight;options.onresizeend({width:width,height:height},options.image.src,options.ftype)}context=null;canvas=null;$canvas=null};function loadFile(){var fr=new FileReader();options.image=new Image();options.image.src='';fr.onload=function(event){if(event.total>MAX_FILE_SIZE){event.target.abort();return}options.ftype=Zedity.utils.fileTypes.parse(event.target.result.substr(0,100),options.accept);if(options.ftype.type=='other'||options.ftype.type==''){options.onerror($.extend(event,{error:Zedity.t('File is not a supported image.')}));return}options.image.onload=function(event){if(options.image.width==0||options.image.height==0){options.onerror($.extend(event,{error:Zedity.t('File is not recognized as valid image.')}));options.image=null;return}var w=options.image.width;var h=options.image.height;options.origwidth=options.image.width;options.origheight=options.image.height;resize()};options.image.src=event.target.result.replace(/^(data:)(.*?)(base64)/,'$1'+options.ftype.mime+';$3')};fr.onerror=function(event){switch(event.target.error.code){case event.target.error.ABORT_ERR:$.extend(event,{error:Zedity.t('File is too big.')});break;case event.target.error.NOT_FOUND_ERR:case event.target.error.NOT_READABLE_ERR:default:$.extend(event,{error:Zedity.t('Error during loading of the image.')});break};options.onerror(event)};fr.readAsDataURL(input)};function loadData(){options.image=new Image();options.image.src='';options.image.onload=function(){resize()};setTimeout(function(){options.image.src=input},0)};if(typeof input=='string'||input instanceof String){var rx=/(data:.*?)["\)$]/i;input=rx.exec(input)[1];loadData()}else if(input instanceof File){loadFile()}else if(input.nodeName=='IMG'){options.image=input;resize()}};Zedity.utils.beautifySize=function(size){if(size==0)return'0 Bytes';var sizes=['Bytes','KB','MB','GB'];var i=Math.min(Math.floor(Math.log(size)/Math.log(1000)),sizes.length-1);return+(size/Math.pow(1000,i)).toFixed(2)+' '+sizes[i]}})(jQuery);(function($){$.fn.hasNumberedClass=function(c){var classes=this.attr('class');var list=classes?classes.split(/\s+/):[];for(var i=0;i<list.length;i++){if(list[i].indexOf(c)!=-1)return true}return false};$.fn.getEmptyNumberedClass=function(c){var list=this.getNumberedClassList(c);var i=0;do{i++}while(list.indexOf(c+i)!=-1);return i};$.fn.getNumberedClass=function(c){var classes=this.attr('class');var list=classes?classes.split(/\s+/):[];for(var i=0,len=list.length;i<len;i++){if(list[i].indexOf(c)!=-1)return list[i]}return''};$.fn.getNumberedClassList=function(c,unique){var cl=[];this.each(function(idx,elem){var nc=$(elem).getNumberedClass(c);if(nc!=''&&(!unique||cl.indexOf(nc)==-1)){cl.push(nc)}});return cl};$.fn.removeNumberedClass=function(c){var numclass;return this.each(function(idx,elem){numclass=$(elem).getNumberedClass(c);if(numclass){$(elem).removeClass(numclass)}})}})(jQuery);
(function($) {
    if(!Zedity)throw new Error(Zedity.t('%s needs %s.', 'Zedity.Box.Text', 'Zedity'));
    if(!Zedity.Box)throw new Error(Zedity.t('%s needs %s.', 'Zedity.Box.Text', 'Zedity.Box'));
    Zedity.Box.Text=function(options) {
        this.type='Text';
        this._defaults=Zedity.Box.Text._defaults;
        Zedity.Box.prototype.constructor.call(this, options);
        this._options.defaultFont=this._options.defaultFont%this._options.fonts.length;
        this._options.defaultFontSize=this._options.defaultFontSize%this._options.fontSizes.length;
        this._data.textlength=0;
        if(this.$this.find('.zedity-content').length==0) {
            this.$this.append('<div class="zedity-content" style="width:100%;height:100%;color:black;line-height:'+this._options.lineHeights[this._options.defaultLineHeight]+'"/>'+'<div class="zedity-empty"><p>'+Zedity.t('Click %s to insert text.', '<span class="zedity-button"><span class="zicon zicon-text zicon-size-s"></span></span>')+'</p></div>');
            this.$this.find('.zedity-content').css( {
                    'font-size': this._options.fontSizes[this._options.defaultFontSize]+'px', 'font-family': this._options.fonts[this._options.defaultFont]
                }
            )
        }
    }
    ;
    Zedity.Box.Text.prototype=Object.create(Zedity.Box.prototype);
    Zedity.Box.Text.prototype.constructor=Zedity.Box.Text;
    $.extend(Zedity.Box.Text.prototype, {
        createPropBar:function(options) {
            Zedity.Box.prototype.createPropBar.call(this);
            var self=this;
            var fonts=[];
            for(var i=0, len=this._options.fonts.length;
                i<len;
                ++i) {
                fonts.push( {
                        value:this._options.fonts[i], label:this._options.fonts[i].split(',')[0], attributes: {
                            'data-font': '12px '+this._options.fonts[i]
                        }
                    }
                )
            }
            this.editor.menu.add( {
                tabs: {
                    editbox: {
                        groups: {
                            textbox: {
                                title:Zedity.t('Text'), order:-1000, class:'zedity-group-box', features: {
                                    insert: {
                                        type:'button', icon:'text', label:Zedity.t('Insert'), title:Zedity.t('Insert/edit text'), onclick:function(e, ed) {
                                            var box=ed.boxes.selected();
                                            if(!box)return;
                                            box.insert()
                                        }
                                    }
                                    , alignment: {
                                        type:'menu', label:Zedity.t('Align'), title:Zedity.t('Text alignment'), icon:'textalign-center', items:[ {
                                            value: 'left', icon: 'textalign-left', label: Zedity.t('Left')
                                        }
                                            , {
                                                value: 'center', icon: 'textalign-center', label: Zedity.t('Center')
                                            }
                                            , {
                                                value: 'right', icon: 'textalign-right', label: Zedity.t('Right')
                                            }
                                            , {
                                                value: 'justify', icon: 'textalign-justify', label: Zedity.t('Justify')
                                            }
                                            , '--', {
                                                value: 'top', icon: 'align-top', label: Zedity.t('Top')
                                            }
                                            , {
                                                value: 'middle', icon: 'align-middle', label: Zedity.t('Middle')
                                            }
                                            , {
                                                value: 'bottom', icon: 'align-bottom', label: Zedity.t('Bottom')
                                            }
                                        ], onclick:function(val, e, ed) {
                                            var box=ed.boxes.selected();
                                            if(!box)return;
                                            box.textAlign(val)
                                        }
                                        , enable:function(ed, box) {
                                            return(box&&box.$this.children('.zedity-empty').length==0)
                                        }
                                    }
                                }
                                , show:function(ed, box) {
                                    return box&&box.type=='Text'
                                }
                            }
                        }
                    }
                    , textbox: {
                        icon:'text', title:Zedity.t('Text'), order:2000, groups: {
                            edit: {
                                title:Zedity.t('Editing'), order:0, class:'zedity-group-box', features: {
                                    done: {
                                        type:'button', icon:'ok', label:Zedity.t('Done'), title:Zedity.t('Done editing'), onclick:function(e, ed) {
                                            var box=ed.boxes.selected();
                                            if(!box)return;
                                            box.stop()
                                        }
                                    }
                                }
                            }
                            , font: {
                                title:Zedity.t('Font'), order:100, features: {
                                    font: {
                                        type:'menu', title:'Select font', width:250, order:0, items:fonts, onclick:function(val, e, ed) {
                                            Zedity.core.selection.restore();
                                            Zedity.core.selection.format( {
                                                    'font-family': val
                                                }
                                            );
                                            Zedity.core.selection.save()
                                        }
                                        , refresh:function(ed, box) {
                                            if(!box)return;
                                            var $elem=$(Zedity.core.selection.getElement());
                                            var font=$elem.css('font-family')||box._options.fonts[box._options.defaultFont];
                                            font=font.replace(/(, \s*)/g, ',').replace(/(\'|\")/g,'');this.$menu.val(font).selectmenu('refresh')}},buttons:{type:'smallpanel',class:'zedity-panel-font',order:10,build:function($panel){$panel.css('font-size','18px').append('<span class="zedity-button zedity-btnB"><a href="javascript:;"><b>B</b></a></span>'+'<span class="zedity-button zedity-btnI"><a href="javascript:;"><i>I</i></a></span>'+'<span class="zedity-button zedity-btnU"><a href="javascript:;"><u>U</u></a></span>'+'<span class="zedity-button zedity-btnS" style="text-shadow:2px 2px 2px #000"><a href="javascript:;">S</a></span>');$panel.find('.zedity-btnB').attr('title',Zedity.t('Bold')).on('click.zedity-ribbon',function(){Zedity.core.selection.restore();Zedity.core.selection.command('bold');Zedity.core.selection.save()});$panel.find('.zedity-btnI').attr('title',Zedity.t('Italic')).on('click.zedity-ribbon',function(){Zedity.core.selection.restore();Zedity.core.selection.command('italic');Zedity.core.selection.save()});$panel.find('.zedity-btnU').attr('title',Zedity.t('Underline')).on('click.zedity-ribbon',function(){Zedity.core.selection.restore();Zedity.core.selection.command('underline');Zedity.core.selection.save()});$panel.find('.zedity-btnS').attr('title',Zedity.t('Shadow')).on('click.zedity-ribbon',function(){if(!Zedity.core.selection.selected())return;Zedity.core.selection.restore();var styled=null;Zedity.core.selection.format({'text-shadow':''},function(elem){var $elem=$(elem);if(styled==null){var ts=$elem.css('text-shadow')||'none';styled=(ts!='none'&&ts.indexOf('px')>-1)}$elem.add($elem.find('span, '+Zedity.core.selection._elements)).css({'text-shadow':(!styled?'4px 4px 4px #666':'none')})});Zedity.core.selection.save()})}},size:{type:'menu',title:Zedity.t('Select font size'),width:70,order:20,items:this._options.fontSizes,onclick:function(val,e,ed){Zedity.core.selection.restore();Zedity.core.selection.format({'font-size':val+'px'});Zedity.core.selection.save()},refresh:function(ed,box){if(!box||box.type!='Text')return;var $elem=$(Zedity.core.selection.getElement());var size=parseInt($elem.css('font-size')||box._options.fontSizes[box._options.defaultFontSize],10);this.$menu.val(size).selectmenu('refresh')}},color:{type:'extpanel',size:'xs',label:Zedity.t('Color'),icon:'empty zicon-colorpicker',title:Zedity.t('Select font color'),class:'zedity-font-colorpicker-button',order:30,build:function($panel,ed){this.$button.find('.zicon').width(30);$panel.append('<div class="zedity-font-colorpicker"/>');var $cp=$panel.find('.zedity-font-colorpicker');$cp.colorPicker({colors:['#ffffff','#f2f2f2','#d8d8d8','#bdbdbd','#a4a4a4','#6e6e6e','#424242','#2e2e2e','#000000','#fbefef','#f8e0e0','#f5a9a9','#f78181','#fe2e2e','#df0101','#b40404','#8a0808','#3b0b0b','#fbf5ef','#f8ece0','#f5d0a9','#faac58','#ff8000','#df7401','#b45f04','#8a4b08','#3b240b','#fbfbef','#f5f6ce','#f2f5a9','#f4fa58','#ffff00','#d7df01','#aeb404','#868a08','#393b0b','#f5fbef','#e3f6ce','#d0f5a9','#acfa58','#80ff00','#74df00','#5fb404','#4b8a08','#38610b','#effbef','#cef6ce','#a9f5a9','#58fa58','#00ff00','#01df01','#04b404','#088a08','#0b3b0b','#effbfb','#cef6f5','#a9f5f2','#58faf4','#00ffff','#01dfd7','#04b4ae','#088a85','#0b3b39','#eff5fb','#cee3f6','#81bef7','#2e9afe','#0080ff','#045fb4','#084b8a','#08388a','#0b243b','#efeffb','#cecef6','#5858fa','#2e2efe','#0000ff','#0404b4','#08088a','#0b0b61','#0b0b3b','#f5effb','#e3cef6','#be81f7','#ac58fa','#9a2efe','#5f04b4','#4b088a','#380b61','#240b3b','#fbeffb','#f6cef5','#f781f3','#fe2ef7','#ff00ff','#df01d7','#b404ae','#610b5e','#3b0b39','#fbeff5','#f6cee3','#f5a9d0','#fa58ac','#ff0080','#df0174','#b4045f','#610b38','#3b0b24'],defaultcolor:'#000000',fills:false,alpha:false,buttons:true,maxcols:9,onchange:function(e,color){var box=ed.boxes.selected();if(!box)return false;Zedity.core.selection.restore();Zedity.core.selection.format({color:color});Zedity.core.selection.save();self.editor.menu.$this.find('.zedity-font-colorpicker-button .zicon').css('background',color)}})},refresh:function(ed,box){if(!box)return false;var $elem=$(Zedity.core.selection.getElement());var c=$elem.css('color')||'#000000';var $cp=this.$button.extpanel('instance').panel.find('.zedity-font-colorpicker');$cp.colorPicker('selectcolor',c);this.$button.find('.zicon').css('background',c);$cp.find('.zedity-colorbuttons').hide()}},size2:{type:'smallpanel',order:40,build:function($panel){$panel.css('font-size','18px').append('<span class="zedity-button zedity-font-increase" data-type="1"><a href="javascript:;">A+</a></span>'+'<span class="zedity-button zedity-font-decrease" data-type="-1"><a href="javascript:;">A-</a></span>');$panel.find('.zedity-font-increase').attr('title',Zedity.t('Increase font size'));$panel.find('.zedity-font-decrease').attr('title',Zedity.t('Decrease font size'));$panel.find('.zedity-button').on('click.zedity-ribbon',function(){var box=self.editor.boxes.selected();if(!box)return;var feat=self.editor.menu._feature('textbox','font','size');var idx=box._options.fontSizes.indexOf(feat.$menu.val());var inc=parseInt($(this).attr('data-type')||1,10);idx=(idx>=0?idx:box._options.fontSizes.indexOf(box._options.defaultFontSize));if(((inc>0)&&(idx>=box._options.fontSizes.length-1))||((inc<0)&&(idx<=0)))return;var size=box._options.fontSizes[idx+inc];feat.$menu.val(size).selectmenu('refresh');feat.onclick.call(self.editor.menu,size,null,self.editor,feat)})}}}},insert:{title:Zedity.t('Insert'),order:300,features:{link:{type:'button',label:'Link',icon:'link',title:'Insert link',onclick:function(e,ed){Zedity.core.selection.save();Zedity.core.dialog({question:Zedity.t('Insert link url: '),default:'http: //',ok:function(url){if(url){Zedity.core.selection.restore();Zedity.core.selection.command('createlink',url);Zedity.core.selection.save()}}})}}}}},show:function(ed,box){return box&&box.type=='Text'&&box.$this.hasClass('zedity-editing')}}}},'textbox');return this},_checkScrollbar:function(){var $content=this.$this.find('.zedity-content');if(!$content)return;var oldy=$content[0].scrollTop;this.$this.addClass('zedity-calculate');this.$this.attr('style',(this.$this.attr('style')||'').replace(/display:.*?(;|$)/g,'').replace(/table-layout:.*?(;|$)/g,''));$content.attr('style',($content.attr('style')||'').replace(/display:.*?(;|$)/g,'').replace(/overflow:.*?(;|$)/g,''));if($content.height()<this.$this.height()){this.$this.attr('style',this.$this.attr('style')+';display:table;table-layout:fixed;');$content.attr('style',$content.attr('style')+';display:table-cell;overflow:hidden;')}else{$content.attr('style',$content.attr('style')+';overflow:auto;')}this.$this.removeClass('zedity-calculate');$content[0].scrollTop=oldy},_calcLength:function(onlythis){if(onlythis){this._data.textlength=this.$this.find('.zedity-content').html().length}else{var boxes=this.editor.boxes.get(this.type);var total=0;for(var i=boxes.length-1;i>0;--i){var $content=boxes[i].$this.find('.zedity-content');if($content.length>0){var len=$content.html().length;total+=len;boxes[i]._data.textlength=len}}}return true},_checkLength:function(){if(this._data.textlength>this._options.maxTextLength)return false;var boxes=this.editor.boxes.get(this.type);var total=0;for(var i=boxes.length-1;i>0;--i){total+=boxes[i]._data.textlength}if(total>this._options.maxTotalTextLength)return false;return true},_refreshFontProperties:function(){clearTimeout(this._data.fontRefreshTimer);this._data.fontRefreshTimer=setTimeout($.proxy(function(){this.editor.menu.refresh('textbox','font');this.editor.menu.refresh('textbox','paragraph')},this),200);return this},_save:function(callback){var css=(this.$this.find('.zedity-content').attr('style')||'');css=css.replace(/\s+/g,' ').replace(/(;|,|:) /g,'$1').replace(/;{2,}/g,';').replace(/(^;|;$)/,'');this.$this.find('.zedity-content').attr('style',css);Zedity.Box.prototype._save.call(this);if(typeof(callback)=='function')callback.call(this);return this},select:function(){if(this.$this.hasClass('zedity-editing')||this.$this.hasClass('zedity-playing'))return this;Zedity.Box.prototype.select.call(this);if(this.$this.is(':data(ui-resizable)')){this.$this.resizable('option',{resize:$.proxy(function(){this._checkScrollbar()},this)})}return this},start:function(){Zedity.Box.prototype.start.call(this);this.editor.boxes._select(null);this.editor.boxes._select(this);var $this=this.$this;var $content=this.$this.find('.zedity-content');this.revert=$this.html();if($this.data('ui-draggable'))$this.draggable('option','disabled',true);if($this.data('ui-resizable'))$this.resizable('option','disabled',true);if($this.data('ui-rotatable'))$this.rotatable('option','disabled',true);$this.find('.zedity-empty').remove();$this.addClass('zedity-editing zedity-edited').removeClass('zedity-selected ui-state-disabled');$content.attr('contenteditable','true').focus();this._normalizeContent();Zedity.core.selection.setCursorPosition($content[0],0);this._calcLength(true);this.reposition(true);$content.focus();var tabs=[];for(var i=this.editor.menu._tabs.length-1;i>=0;--i){if(this.editor.menu._tabs[i].name!='textbox'){tabs.push(this.editor.menu._tabIdx(this.editor.menu._tabs[i].name))}}this.editor.menu.$this.tabs('option','disabled',tabs);this.editor.menu.openTab('textbox',true);return this},stop:function(){if(this._data.stopping||!this.$this.hasClass('zedity-editing'))return this;this._data.stopping=true;Zedity.Box.prototype.stop.call(this);var $this=this.$this;var $content=this.$this.find('.zedity-content');this._normalizeContent();if($this.hasClass('zedity-editing')){Zedity.core.selection.unselect();Zedity.core.selection._savedRange=null;$this.removeClass('zedity-editing');$content.removeAttr('contenteditable').blur();$content[0].normalize();if($this.data('ui-draggable'))$this.draggable('option','disabled',false);if($this.data('ui-resizable'))$this.resizable('option','disabled',false);if($this.data('ui-rotatable'))$this.rotatable('option','disabled',false);this.select();this._checkScrollbar();this.editor._changed();this.editor.menu.$this.tabs('option','disabled',[]);this.editor.menu.openTab('editbox')}this._calcLength();if(!this._checkLength()){this.editor._error({message:Zedity.t('Text length exceeds the maximum limit.')})}this._data.stopping=false;return this},insert:function(){Zedity.Box.prototype.insert.call(this);this.start();return this},_normalizeContent:function(){var $content=this.$this.find('.zedity-content');$content.contents().filter(function(){return((this.nodeType==3)&&($.trim(this.nodeValue)!=''))||($(this).is('span,a,b,strong,i,em,u'))}).each($.proxy(function(idx,elem){var $elem=$(elem);var $new=$('<p/>',{html:elem.outerHTML||$elem.text(),css:{margin:0,color:'black','font-size':this._options.fontSizes[this._options.defaultFontSize]+'px','font-family':this._options.fonts[this._options.defaultFont]}});$elem.replaceWith($new)},this));$content.find('span').each(function(idx,elem){var $elem=$(elem);if(elem.hasChildNodes()&&elem.childNodes.length==1&&elem.firstChild.tagName=='SPAN'){var child=elem.firstChild;for(var j=elem.style.length-1;j>=0;--j){var prop=elem.style[j];var cprop=child.style.getPropertyValue(prop);if(cprop==='')child.style.setProperty(prop,elem.style.getPropertyValue(prop),'')}$elem.replaceWith(child)}});$content.find('a:empty').remove();$content.find('p,h1,h2,h3,h4,h5,h6').filter(':empty').append('<br/>');if($.trim($content.text())==''){$content.html('<p style="margin:0;color:black">&nbsp;</p>');$content.find('p').css({'font-size':this._options.fontSizes[this._options.defaultFontSize]+'px','font-family':this._options.fonts[this._options.defaultFont]});Zedity.core.selection.setCursorPosition($content[0],0);$content.focus()}return this},content:function(content){if(content==null){content=this.$this.find('.zedity-content').html()}else{this.$this.find('.zedity-content').html(content);this.$this.find('.zedity-empty').remove();this.$this.addClass('zedity-editing');this.stop();this.editor._changed()}return content},textAlign:function(type,alignment){alignment=alignment||type;var $content=this.$this.find('.zedity-content');if(['left','center','right','justify'].indexOf(alignment)>-1){$content.css('text-align',alignment);$content.find('*').css('text-align','').removeAttr('align')}if(['top','middle','bottom'].indexOf(alignment)>-1){$content.css('vertical-align',alignment)}var oldflip=this.flip();Zedity.core._call(this,'flip','none');Zedity.core._call(this,'flip',oldflip);this._checkScrollbar();this.editor._changed();return this},init:function(){Zedity.Box.prototype.init.call(this);var self=this;this.$this.off('click.zedity').on('click.zedity',function(){if(!self.$this.hasClass('zedity-editing')){Zedity.core.selection._savedRange=undefined}}).off('dblclick.zedity dbltap.zedity').on('dblclick.zedity dbltap.zedity',function(){if($(this).hasClass('zedity-editing')){if(window.getSelection().toString().slice(-1)==' '){window.getSelection().modify('extend','backward','character')}Zedity.core.selection.save()}else{self.select().insert()}}).off('dblclick.zedity','a').on('dblclick.zedity','a',function(){if(!$(this).closest('.zedity-box-Text').hasClass('zedity-editing'))return;Zedity.core.selection.selectElement(this);Zedity.core.selection.save();$('.zedity-dialog-text-link').data('box',self).dialog('open');return false}).off('blur.zedity').on('blur.zedity',function(){if(Zedity.utils.opera())Zedity.core.selection.save();Zedity.core.selection.restore()}).off('mousedown.zedity').on('mousedown.zedity',function(e){if(e.button==0){Zedity.core.selection.unselect()}}).off('mouseup.zedityed').on('mouseup.zedityed',function(e){if(e.button==0){Zedity.core.selection.save();self._refreshFontProperties();if(Zedity.core.selection.selected()){var $elem=$(Zedity.core.selection.getElement());if($elem.is('a')){Zedity.core.selection.expand();Zedity.core.selection.save();$('.zedity-dialog-text-link').data('box',self).dialog('open')}}}}).off('keydown.zedity').on('keydown.zedity',$.proxy(function(e){if(e.keyCode==13){this._checkScrollbar()}else if(e.keyCode==32||(e.keyCode>=48&&e.keyCode<=90)){this._data.textlength++}else if(e.keyCode==8||e.keyCode==46){this._data.textlength--;this._normalizeContent();if($.trim(this.$this.find('.zedity-content').text())==''){return false}}if(!this._checkLength()){this.editor._error({message:Zedity.t('Text length exceeds the maximum limit.')});this._calcLength(true);return false}},this)).off('keyup.zedity').on('keyup.zedity',$.proxy(function(e){if(e.keyCode==13){var $el=$(Zedity.core.selection.getElement());if($el.closest('ol,ul').length)return;$el=$(Zedity.core.selection.getParagraph());var $prev=$el.prev();if($el.prop('tagName')!=$prev.prop('tagName')||$el.attr('style')==null){$el.css({margin:0,color:'black','font-weight':'','font-style':'','font-size':this._options.fontSizes[this._options.defaultFontSize]+'px','font-family':this._options.fonts[this._options.defaultFont]});var el=Zedity.core.selection.setParagraph('p');$el=$(el);if($.trim($el.text())==''){$el.html('&nbsp;');Zedity.core.selection.selectText(el)}}}this._refreshFontProperties();Zedity.core.selection.save()},this)).off('click.zedity','a').on('click.zedity','a',function(e){return false});$('html,body').off('mouseup.zedity').on('mouseup.zedity',function(){var eb=self.editor.$this.find('.zedity-box.zedity-editing');var ae=$(document.activeElement).closest('.zedity-box');if(eb.length>0&&eb.get(0)===ae.get(0)){Zedity.core.selection.save();return false}});if(Zedity.core.supports.touch()){document.onselectionchange=function(){var e=Zedity.core.selection.getElement();if(!e)return;e=$(e).closest('.zedity-content[contenteditable]');if(!e.length)return;Zedity.core.selection.save();self._refreshFontProperties();if(Zedity.core.selection.selected()){var $elem=$(Zedity.core.selection.getElement());if($elem.is('a')){Zedity.core.selection.expand();Zedity.core.selection.save();$('.zedity-dialog-text-link').data('box',self).dialog('open')}}}}this.$this.off('paste.zedity').on('paste.zedity',$.proxy(function(e){Zedity.core.selection.save();var $content=this.$this.find('.zedity-content');var old=$content.html();$content.blur();var $ta=$('<div contentEditable="true" style="width:1px;height:1px;position:absolute;overflow:hidden"></div>').appendTo('body');$ta.css({top:document.body.scrollTop+100,left:document.body.scrollLeft+10});$ta.focus();setTimeout($.proxy(function(){function pasteText(plain){if(plain){var text=$ta.text();$content.focus();Zedity.core.selection.restore();Zedity.core.selection.insertTextAtCursor(text)}else{var text=$ta.html();$content.focus();Zedity.core.selection.restore();Zedity.core.selection.insertHtmlAtCursor(text)}$ta.remove();this._calcLength(true);if(!this._checkLength()){this.editor._error({message:Zedity.t('Text length exceeds the maximum limit.')});$content.html(old);old=null;this._calcLength(true);Zedity.core.selection.restore();return false}this._normalizeContent();this._checkScrollbar()};if(!this._options.forcePastePlainText&&$ta.find('*').length>0){var zthis=this;$('<div style="padding:20px">'+'<span style="line-height:30px"><input type="radio" id="zedity-rbPasteText1" name="zedity-rbPasteText" value="1" checked="checked"><label for="zedity-rbPasteText1"> '+Zedity.t('Plain text.')+'</label></span><br/>'+'<span><input type="radio" id="zedity-rbPasteText0" name="zedity-rbPasteText" value="0"><label for="zedity-rbPasteText0"> '+Zedity.t('Formatted text.')+'</label></span>'+'</div>').dialog({dialogClass:'zedity-dialog',title:Zedity.t('Paste text'),modal:true,buttons:[{text:Zedity.t('OK'),click:function(){var $this=$(this);pasteText.call(zthis,!!parseInt($this.find('input[name=zedity-rbPasteText]:checked').val()));$this.dialog('close').dialog('destroy').remove()}}]})}else{pasteText.call(this,true)}},this),200)},this));return this}});Zedity.Box.Text.type='Text';Zedity.Box.Text.sizeLimits={minWidth:16,minHeight:16,maxWidth:null,maxHeight:null};Zedity.Box.Text._defaults={width:200,height:100,maxTextLength:300000,maxTotalTextLength:1000000,forcePastePlainText:false,fonts:['Arial,Helvetica,sans-serif','Arial Black,Gadget,sans-serif','Arial Narrow,sans-serif','Century Gothic,sans-serif','Comic Sans MS,cursive','Copperplate Gothic Light,sans-serif','Courier New,Courier,monospace','Georgia,serif','Gill Sans,sans-serif','Helvetica,sans-serif','Impact,Charcoal,sans-serif','Lucida Console,Monaco,monospace','Lucida Sans Unicode,Lucida Grande,sans-serif','Palatino Linotype,Book Antiqua,Palatino,serif','Tahoma,Geneva,sans-serif','Times New Roman,Times,serif','Trebuchet MS,Helvetica,sans-serif','Verdana,Geneva,sans-serif'],defaultFont:0,fontSizes:['11','12','14','16','19','21','24','27','29','32','37','48','53','64'],defaultFontSize:2,lineHeights:[1,1.1,1.2,1.3,1.5,1.7,2,2.5,3,4,5],defaultLineHeight:2};Zedity.Box.register({type:Zedity.Box.Text.type,requires:['selection'],section:'basic',order:0})})(jQuery);(function(){Zedity.utils=Zedity.utils||{};Zedity.utils.opera=function(){return/opera/i.test(navigator.userAgent)}})();
(function($) {
        if(!Zedity)throw new Error(Zedity.t('%s needs %s.', 'Zedity.Box.Video', 'Zedity'));
        if(!Zedity.Box)throw new Error(Zedity.t('%s needs %s.', 'Zedity.Box.Video', 'Zedity.Box'));
        Zedity.Box.Video=function(options) {
            this.type='Video';
            this._defaults=Zedity.Box.Video._defaults;
            Zedity.Box.prototype.constructor.call(this, options);
            this._can.remove('background', 'rotation', 'flip', 'corners');
            if(this.$this.find('object,iframe,video').length==0) {
                if(this.$this.find('.zedity-empty').length==0) {
                    this.$this.append('<div class="zedity-empty"><p>'+Zedity.t('Click %s to insert video.', '<span class="zedity-button"><span class="zicon zicon-video zicon-size-s"></span></span>')+'</p></div>')
                }
            }
            else if(this.$this.find('.zedity-boxoverlay').length==0) {
                this.$this.append('<div class="zedity-boxoverlay"/>');
                var embed=Zedity.core.embed.parse(this.content(), 'video');
                this._data.content=this.getSrc(embed.iframe||embed.flash).join('\n')
            }
        }
        ;
        Zedity.Box.Video.prototype=Object.create(Zedity.Box.prototype);
        Zedity.Box.Video.prototype.constructor=Zedity.Box.Video;
        $.extend(Zedity.Box.Video.prototype, {
                createPropBar:function(options) {
                    Zedity.Box.prototype.createPropBar.call(this);
                    this.editor.menu.add( {
                            tabs: {
                                editbox: {
                                    groups: {
                                        videobox: {
                                            title:Zedity.t('Video'), order:-1000, class:'zedity-group-box', features: {
                                                insert: {
                                                    type:'button', order:0, icon:'video', label:Zedity.t('Insert'), title:Zedity.t('Insert video'), onclick:function(e, ed) {
                                                        var box=ed.boxes.selected();
                                                        if(!box)return;
                                                        box.insert()
                                                    }
                                                }
                                                , options: {
                                                    type:'extpanel', order:10, icon:'config', label:Zedity.t('Options'), title:Zedity.t('Video embed options'), enable:function(ed, box) {
                                                        if(!box||box.type!='Video')return false;
                                                        var service=box.getService();
                                                        return!!service&&!$.isEmptyObject(service.options)
                                                    }
                                                    , refresh:function(ed, box) {
                                                        if(!box||box.type!='Video')return;
                                                        var service=box.getService();
                                                        if(!service||$.isEmptyObject(service.options))return;
                                                        var options=box.videoOptions()||[];
                                                        var html='';
                                                        for(var op in service.options) {
                                                            if(!service.options.hasOwnProperty(op))continue;
                                                            html+='<label>'+'<input type="checkbox" value="'+op+'" '+(options.indexOf(op)>-1?'checked': '')+'/>'+' <span> '+service.options[op].title+'</span>'+'</label><br/>'
                                                        }
                                                        this.$extpanel.html(html);
                                                        var self=this;
                                                        this.$extpanel.find('input').on('change', function() {
                                                                var options=self.$extpanel.find('input:checked').map(function() {
                                                                        return this.value
                                                                    }
                                                                ).get();
                                                                box.videoOptions(options)
                                                            }
                                                        )
                                                    }
                                                }
                                                , play: {
                                                    type:'toggle', order:20, state:[ {
                                                        label: Zedity.t('Play'), icon: 'play', title: Zedity.t('Play video')
                                                    }
                                                        , {
                                                            label: Zedity.t('Pause'), icon: 'pause', title: Zedity.t('Pause video')
                                                        }
                                                    ], onclick:function(e, ed, before) {
                                                        var box=ed.boxes.selected();
                                                        if(!box)return false;
                                                        switch(before) {
                                                            case 0: box.start();
                                                                break;
                                                            case 1: box.stop();
                                                                break
                                                        }
                                                    }
                                                    , enable:function(ed, box) {
                                                        if(!box||box.type!='Video')return false;
                                                        var service=box.getService();
                                                        return service&&service.canplay
                                                    }
                                                    , show:function(ed, box) {
                                                        if(!box||box.type!='Video')return false;
                                                        var service=box.getService();
                                                        return!service||(service&&service.canplay)
                                                    }
                                                    , refresh:function(ed, box) {
                                                        if(!box)return;
                                                        this.$button.trigger('toggle', box.$this.hasClass('zedity-playing')?1: 0)
                                                    }
                                                }
                                                , view: {
                                                    type:'toggle', order:20, state:[ {
                                                        label: Zedity.t('Show'), icon: 'view', title: Zedity.t('Show video')
                                                    }
                                                        , {
                                                            label: Zedity.t('Close'), icon: 'view', title: Zedity.t('Close video')
                                                        }
                                                    ], onclick:function(e, ed, before) {
                                                        var box=ed.boxes.selected();
                                                        if(!box)return false;
                                                        switch(before) {
                                                            case 0: box.start();
                                                                break;
                                                            case 1: box.stop();
                                                                break
                                                        }
                                                    }
                                                    , show:function(ed, box) {
                                                        if(!box||box.type!='Video')return false;
                                                        var service=box.getService();
                                                        return!!service&&!service.canplay
                                                    }
                                                    , refresh:function(ed, box) {
                                                        if(!box)return;
                                                        this.$button.trigger('toggle', box.$this.hasClass('zedity-playing')?1: 0)
                                                    }
                                                }
                                            }
                                            , show:function(ed, box) {
                                                return box&&box.type=='Video'
                                            }
                                        }
                                    }
                                }
                            }
                        }
                        , 'videobox');
                    return this
                }
                , _sizeLimits:function() {
                    var sl=Zedity.Box.prototype._sizeLimits.call(this);
                    var service=this.getService();
                    if(!service)return sl;
                    return {
                        minWidth: service.sizeLimits.minWidth||sl.minWidth, maxWidth: service.sizeLimits.maxWidth||sl.maxWidth, minHeight: service.sizeLimits.minHeight||sl.minHeight, maxHeight: service.sizeLimits.maxHeight||sl.maxHeight
                    }
                }
                , _save:function(callback) {
                    Zedity.Box.prototype._save.call(this);
                    this.$this.find('.zedity-boxoverlay').remove();
                    if(typeof(callback)=='function')callback.call(this);
                    return this
                }
                , content:function(content) {
                    function checkFiles(content) {
                        var filetypes=Object.keys(this._options.filetypes);
                        for(var i=filetypes.length-1;
                            i>=0;
                            --i) {
                            var rx=new RegExp('\\.'+filetypes[i]+'(?:$|\\?)', 'gm');
                            if(rx.test(content))return true
                        }
                        return false
                    }
                    ;
                    if(content!=null) {
                        if(typeof content=='string'||content instanceof String) {
                            var embed=Zedity.core.embed.parse(content, 'video');
                            if(!embed.code) {
                                if(checkFiles.call(this, content)) {
                                    return Zedity.core._call(this, 'content', content.split('\n'))
                                }
                                else {
                                    this.editor._error( {
                                            message: Zedity.t('Please provide a valid link/embed code for any of the supported video services.')
                                        }
                                    );
                                    return this.content()
                                }
                            }
                            else if(embed.html5) {
                                return Zedity.core._call(this, 'content', embed.html5)
                            }
                            else {
                                content=(embed.iframe||embed.flash)+'<div class="zedity-boxoverlay"/>';
                                this.$this.attr('data-service', embed.service)
                            }
                        }
                        else if($.isArray(content)) {
                            var thumbnail='';
                            for(var i=0, len=content.length;
                                i<len;
                                ++i) {
                                if(['jpeg', 'jpg', 'jpe', 'png'].indexOf(content[i].split('.').pop())>-1) {
                                    thumbnail=' poster="'+content[i]+'"';
                                    break
                                }
                            }
                            var html='<video controls="controls" style="width:100%;height:100%" preload="none"'+thumbnail+'>';
                            for(var i=0, len=content.length;
                                i<len;
                                ++i) {
                                var ext=content[i].split('.').pop();
                                if(this._options.filetypes[ext]) {
                                    html+='<source src="'+content[i]+'" type="'+this._options.filetypes[ext]+'"/>'
                                }
                            }
                            html+='<p>Your browser does not support HTML5 videos.</p></video><div class="zedity-boxoverlay"/>';
                            content=html;
                            this.$this.attr('data-service', 'html5')
                        }
                        else {
                            this.editor._error( {
                                    message: Zedity.t('Could not interpret the content as video.')
                                }
                            )
                        }
                        this.videoOptions(this._data.videoOptions)
                    }
                    content=Zedity.Box.prototype.content.call(this, content);
                    this._data.content=content=this.getSrc(content).join('\n');
                    this._resize();
                    this.editor.boxes.refreshSelected();
                    return content
                }
                , getSrc:function(content) {
                    content=content||this.content();
                    var src=[];
                    $('<div/>').html(content).find('object,iframe,video,video source').each(function() {
                            var ts=$(this).attr('src')||$(this).attr('data')||$(this).attr('poster');
                            if(ts)src.push(ts)
                        }
                    );
                    return src
                }
                , videoOptions:function(options) {
                    var service=this.getService();
                    if($.isArray(options)) {
                        var params='';
                        for(var i=options.length-1;
                            i>=0;
                            --i) {
                            params+='&'+service.options[options[i]].urlparam
                        }
                        var self=this;
                        this.$this.find('object,iframe,video,video source').each(function() {
                                var $this=$(this);
                                if($this.attr('src'))$this.attr('src', self._data.content+params);
                                if($this.attr('data'))$this.attr('data', self._data.content+params)
                            }
                        )
                    }
                    else {
                        options=[];
                        var content;
                        this.$this.find('object,iframe,video,video source').each(function() {
                                content=$(this).attr('src')||$(this).attr('data');
                                return false
                            }
                        );
                        if(content) {
                            for(var op in service.options) {
                                if(!service.options.hasOwnProperty(op))continue;
                                if(content.indexOf(service.options[op].urlparam)>=1)options.push(op)
                            }
                        }
                    }
                    this._data.videoOptions=options;
                    return options
                }
                , select:function() {
                    if(this.$this.hasClass('zedity-editing')||this.$this.hasClass('zedity-playing'))return this;
                    Zedity.Box.prototype.select.call(this);
                    return this
                }
                , rotation:function(setting) {
                    if(setting!=null) {
                        this.editor._error( {
                                message: Zedity.t('%s can\'t be rotated.', 'Video box')
                            }
                        )
                    }
                    return 0
                }
                , background:function(setting) {
                    if(setting!=null) {
                        this.editor._error( {
                                message: Zedity.t('%s doesn\'t support background property.', 'Video box')
                            }
                        )
                    }
                    return {
                        type: 'solid', alpha: 1, colors: ['transparent']
                    }
                }
                , corners:function(setting) {
                    if(setting!=null) {
                        this.editor._error( {
                                message: Zedity.t('%s doesn\'t support rounded corners.', 'Video box')
                            }
                        )
                    }
                    return {
                        'border-top-left-radius': 0, 'border-top-right-radius': 0, 'border-bottom-left-radius': 0, 'border-bottom-right-radius': 0
                    }
                }
                , flip:function(setting) {
                    if(setting!=null) {
                        this.editor._error( {
                                message: Zedity.t('%s doesn\'t support flipping.', 'Video box')
                            }
                        )
                    }
                    return'none'
                }
                , start:function() {
                    Zedity.Box.prototype.start.call(this);
                    var $obj=this.$this.find('object,iframe,video');
                    if($obj.lenght==0)return this;
                    var service=this.getService();
                    if(!service)return this;
                    if(this.$this.data('ui-draggable'))this.$this.draggable('option', 'disabled', true);
                    if(this.$this.data('ui-resizable'))this.$this.resizable('option', 'disabled', true);
                    this.$this.removeClass('ui-state-disabled');
                    Zedity.core.embed.player($obj, service.service, 'play');
                    this.$this.addClass('zedity-playing').find('.zedity-boxoverlay').hide();
                    return this
                }
                , stop:function() {
                    Zedity.Box.prototype.stop.call(this);
                    var $obj=this.$this.find('object,iframe,video');
                    if($obj.lenght==0)return this;
                    var service=this.getService();
                    if(!service)return this;
                    if(this.$this.data('ui-draggable'))this.$this.draggable('option', 'disabled', false);
                    if(this.$this.data('ui-resizable'))this.$this.resizable('option', 'disabled', false);
                    if(this.$this.hasClass('zedity-playing')) {
                        Zedity.core.embed.player($obj, service.service, 'pause')
                    }
                    this.$this.removeClass('zedity-playing').find('.zedity-boxoverlay').show();
                    return this
                }
                , insert:function() {
                    Zedity.Box.prototype.insert.call(this);
                    $('.zedity-dialog-video').data('box', this).dialog('open');
                    return this
                }
                , getService:function() {
                    var service=this.$this.attr('data-service')||this.$this.find('object,iframe,video').attr('data-service');
                    var data;
                    if(service=='html5') {
                        data= {
                            service:'html5', type:'video', canplay:true, sizeLimits: {
                                minWidth: 230, maxWidth: null, minHeight: 100, maxHeight: null
                            }
                        }
                    }
                    else {
                        data=Zedity.core.embed.services[service];
                        if(data)data.canplay=!!(data.player.flash.play||data.player.iframe.play)
                    }
                    return data
                }
                , duplicate:function() {
                    var newbox=Zedity.Box.prototype.duplicate.call(this);
                    var $obj=newbox.$this.find('object,iframe,video');
                    var service=newbox.getService();
                    if(service) {
                        $obj.attr('id', Zedity.core.genId(service.service))
                    }
                    return newbox
                }
                , init:function() {
                    Zedity.Box.prototype.init.call(this);
                    if($('.zedity-dialog-video').length==0) {
                        var $dialog=$('<div class="zedity-dialog-video">'+'<div class="tabs">'+'<ul>'+'<li><a href="#tab-video-embed">'+Zedity.t('Embed')+'</a></li>'+'<li><a href="#tab-video-files">'+Zedity.t('Files')+'</a></li>'+'</ul>'+'<div id="tab-video-embed">'+Zedity.t('Insert video embed code or url:')+'<br/>'+'<textarea id="zedity-txtVideoEmbed" rows="4"></textarea>'+'<p>'+Zedity.t('Supported services:')+'<br/><span id="zedity-lblVideoServices"></span></p>'+'</div>'+'<div id="tab-video-files">'+Zedity.t('Select video from the list of available videos:')+'<br/>'+'<div id="zedity-ddVideoFiles" class="zedity-button zedity-ddmenu zedity-menu" data-ddmenu="#zedity-videosel-menu" style="width:260px"><span><a href="javascript:;">--</a></span></div>'+'<ul id="zedity-videosel-menu" class="zedity-propbar-menu"></ul>'+'<img id="zedity-video-preview" src=""/>'+'</div>'+'</div>'+'</div>');
                        $dialog.find('.tabs').tabs( {
                                activate:function(event, ui) {
                                    $(this).find('.ui-tabs-panel:visible').find('input[type=text],textarea,select').filter(':visible').filter(':first').focus()
                                }
                            }
                        );
                        this.editor.$container.append($dialog);
                        $dialog.dialog( {
                                title:Zedity.t('Insert video'), dialogClass:'zedity-dialog', autoOpen:false, modal:true, resizable:false, position: {
                                    my: 'center', at: 'center', of: window.top
                                }
                                , open:function() {
                                    var $this=$(this);
                                    var $tabs=$this.find('.tabs');
                                    var box=$this.data('box');
                                    var disabled=[];
                                    $('#zedity-video-preview').attr('src', '').hide();
                                    $('#zedity-ddVideoFiles a').html('--');
                                    if($('#zedity-videosel-menu').data('ui-menu'))$('#zedity-videosel-menu').menu('destroy').html('');
                                    if(box._options.files) {
                                        var files='<li data-value="-1"><a href="javascript:;">--</a></li>';
                                        for(var i=0, len=box._options.files.length;
                                            i<len;
                                            ++i) {
                                            var tn=box._options.files[i].thumbnail?'<img class="zedity-pic-preview" src="'+box._options.files[i].thumbnail+'"/>': '';
                                            files+='<li data-value="'+i+'"><a href="javascript:;">'+tn+box._options.files[i].title+'</a></li>'
                                        }
                                        $('#zedity-videosel-menu').html(files);
                                        $('#zedity-ddVideoFiles').ddmenu( {
                                                onchange:function() {
                                                    $('#zedity-video-preview').attr('src', '').hide();
                                                    var val=$(this).ddmenu('value');
                                                    if(val==-1)return;
                                                    if(box._options.files[val].thumbnail) {
                                                        $('#zedity-video-preview').attr('src', box._options.files[val].thumbnail).show()
                                                    }
                                                }
                                            }
                                        )
                                    }
                                    else {
                                        disabled.push($tabs.tabs('getidx', 'tab-video-files'))
                                    }
                                    var services=Zedity.core.embed.getServices('video', true);
                                    $('#zedity-lblVideoServices').html(services.join(', '));
                                    $this.find('input[type=text],textarea').val('');
                                    $tabs.tabs('option', {
                                            active: 0, disabled: disabled
                                        }
                                    );
                                    $('#zedity-txtVideoEmbed').val(box.content()).focus()
                                }
                                , close:function() {
                                    $(this).data('box', null)
                                }
                                , buttons:[ {
                                    text:Zedity.t('OK'), class:'zedity-button-ok', click:function() {
                                        var box=$(this).data('box');
                                        $(this).dialog('close');
                                        if(!box)return;
                                        var content='';
                                        switch($(this).find('.tabs').tabs('selected')) {
                                            case'tab-video-embed': content=$('#zedity-txtVideoEmbed').val();
                                                var embed=Zedity.core.embed.parse(content, 'video');
                                                if(!embed.code) {
                                                    box.editor._error( {
                                                            message: Zedity.t('Please provide a valid link/embed code for any of the supported video services.')
                                                        }
                                                    );
                                                    return
                                                }
                                                break;
                                            case'tab-video-files':var val=parseInt($('#zedity-ddVideoFiles').ddmenu('value'));
                                                if(val>-1) {
                                                    content=box._options.files[val].src;
                                                    if(box._options.files[val].thumbnail) {
                                                        content.unshift(box._options.files[val].thumbnail)
                                                    }
                                                }
                                                break
                                        }
                                        box.content(content)
                                    }
                                }
                                    , {
                                        text:Zedity.t('Cancel'), class:'zedity-button-cancel', click:function() {
                                            $(this).dialog('close')
                                        }
                                    }
                                ]
                            }
                        )
                    }
                    return this
                }
            }
        );
        Zedity.Box.Video.type='Video';
        Zedity.Box.Video.sizeLimits= {
            minWidth: 220, minHeight: 200, maxWidth: null, maxHeight: null
        }
        ;
        Zedity.Box.Video._defaults= {
            width:300, height:200, filetypes: {
                mp4: 'video/mp4', mov: 'video/mp4', ogg: 'video/ogg', ogv: 'video/ogg', webm: 'video/webm'
            }
        }
        ;
        Zedity.Box.register( {
                type: Zedity.Box.Video.type, section: 'media-embed', order: 0
            }
        );
        Zedity.core.embed.add('youtube', {
                url:'http://www.youtube.com', type:'video', regex:[new RegExp('youtube\\.com/watch\\?.*v=(.+?)(&|"|\'|$)'), new RegExp('youtu\\.be/(.+?)(\\?|&|$)'), new RegExp('youtube(?:-nocookie|)\\.com/(?:v|embed)/(.+?)(\\?|&|"|\'|$)')], parser:function(code) {
                    return {
                        code: code[1], flash: '//www.youtube.com/v/'+code[1]+'?rel=0&amp;showsearch=0&amp;showinfo=0&amp;enablejsapi=1', iframe: '//www.youtube.com/embed/'+code[1]+'?wmode=opaque&amp;rel=0&amp;modestbranding=1&amp;showinfo=0&amp;enablejsapi=1'
                    }
                }
                , player: {
                    flash: {
                        play: 'playVideo', pause: 'pauseVideo'
                    }
                    , iframe: {
                        play:'playVideo', pause:'pauseVideo', command:function(frame_id, func, args) {
                            $('#'+frame_id)[0].contentWindow.postMessage(JSON.stringify( {
                                    event: 'command', func: func, args: args||[], id: frame_id
                                }
                            ), '*')
                        }
                    }
                }
            }
        );
        Zedity.core.embed.add('vimeo', {
                url:'http://vimeo.com', type:'video', regex:[new RegExp('vimeo\\.com/.*?clip_id=(.*?)("|\'|&|$)'), new RegExp('vimeo\\.com/.*?([^/]+?)("|\'|\\?|&|$)')], parser:function(code) {
                    return {
                        code: code[1], flash: '//vimeo.com/moogaloop.swf?clip_id='+code[1]+'&amp;server=vimeo.com&amp;show_title=0&amp;show_byline=0&amp;show_portrait=0&amp;color=00adef&amp;fullscreen=0&amp;loop=0&amp;api=1', iframe: '//player.vimeo.com/video/'+code[1]+'?title=0&amp;byline=0&amp;portrait=0&amp;api=1'
                    }
                }
                , player: {
                    flash: {
                        play: 'api_play', pause: 'api_pause'
                    }
                    , iframe: {
                        play:'play', pause:'pause', command:function(frame_id, func, value) {
                            $('#'+frame_id)[0].contentWindow.postMessage(JSON.stringify( {
                                    method: func, value: value
                                }
                            ), '*')
                        }
                    }
                }
            }
        )
    }
)(jQuery);
Zedity.i18n.add('cs', {
        "%s needs %s.": "%s pot\u0159eby %s.", "Click %s to insert a document.": "Klikn\u011bte %s pro p\u0159id\u00e1n\u00ed dokumentu.", "Document": "Dokument", "Insert": "Vlo\u017eit", "Insert document": "Vlo\u017eit dokument", "Read": "\u010c\u00edst", "Read document": "\u010c\u00edst dokument", "Close": "Zav\u0159\u00edt", "Close document": "Zav\u0159\u00edt dokument", "Please provide a valid link\/embed code for any of the supported document embed services or a direct link to a document.": "Pros\u00edm uve\u010fte platn\u00fd odkaz\/k\u00f3d pro n\u011bkter\u00fd z podporovan\u00fdch dokument\u016f", "Could not interpret the content as document.": "Nem\u016f\u017ee zobrazit obsah jako dokument.", "%s can't be rotated.": "%s nem\u016f\u017ee b\u00fdt p\u0159eto\u010den.", "%s doesn't support background property.": "%s nepodporuje vlastnosti pozad\u00ed.", "%s doesn't support rounded corners.": "%s nepodporuje zakulacen\u00e9 rohy.", "%s doesn't support flipping.": "%s nepodporuje p\u0159evracen\u00ed.", "Embed": "Vlo\u017eeno", "Insert document embed code or url:": "Vlo\u017ete dokument vkl\u00e1dac\u00ed k\u00f3d nebo url:", "Supported services:": "Podporovan\u00e9 slu\u017eby", "Supported documents:": "Podporovan\u00e9 dokumenty:", "PDF documents, Microsoft Office documents, Apple Pages, Adobe Photoshop and Illustrator, and more.": "PDF dokumenty,Microsoft Office documenty, Apple str\u00e1nky, Adobe Photoshop, Ilustrator...", "OK": "OK", "Cancel": "zru\u0161it", "Click %s to insert HTML.": "Klik %s pro vlo\u017een\u00ed HTML.", "Html": "Html", "Insert HTML": "vlo\u017ete HTML", "View": "uk\u00e1zat", "View box content": "Uk\u00e1zat obsah okna", "Insert HTML code:": "Vlo\u017eit HTML k\u00f3d:", "Safe mode:": "M\u00f3d ulo\u017een\u00ed", "Automatic": "automatick\u00e9", "Enabled": "povoleno", "Disabled": "zak\u00e1zano", "If you insert Javascript or CSS code and you get unexpected effects (e.g. content overflow, etc.) you need to enable safe mode.": "Pokud vlo\u017e\u00edte Javascript nebo CSS k\u00f3d a dostanete neo\u010dek\u00e1van\u00fd v\u00fdsledek (nap\u0159. rozhozen\u00fd obsah). Zap\u011btne bezpe\u010dn\u00fd m\u00f3d.", "The (default) automatic setting enables safe mode only if Javascript is detected.": "P\u0159ednastaven\u00ed automaticky povol\u00ed bezpe\u010dn\u00fd m\u00f3d jen pokud nalezne Javascript.", "Some scripts (for example social network services) need to access the page, so the \"Safe mode\" must be disabled in these cases.": "N\u011bkter\u00e9 scripty (nap\u0159\u00edklad soci\u00e1ln\u00ed m\u00e9dia) pot\u0159ebuj\u00ed p\u0159\u00edstup k str\u00e1nce, \"Bezpe\u010dn\u00fd M\u00f3d\" mus\u00ed b\u00fdt vypnut.", "Inserting a %s content into an HTML box is not supported at the moment.": "Vlo\u017een\u00ed %s obsahu do HTML okna, nen\u00ed v tuto chv\u00edli podporov\u00e1no.", "Filters": "filtry", "Apply image filters": "pou\u017e\u00edt filtr na obr\u00e1zek", "Adjust colors": "upravit barvy", "Black &amp; white": "\u010dern\u00e1 &amp; b\u00edl\u00e1", "Blur": "rozost\u0159en\u00ed", "Brightness": "sv\u011btlos", "Contrast": "kontrast", "Emboss": "reli\u00e9f", "Grayscale": "\u0161ed\u00e1 \u0161k\u00e1la", "Invert": "Invertovat", "Mosaic": "Mosaika", "Motion blur": "pohybov\u00e9 rozost\u0159en\u00ed", "Noise": "\u0161um", "Paint": "\u0161t\u011btec", "Posterize": "posterize", "Psychedelia": "psychedelia", "Sepia": "sepia", "Sharpen": "ost\u0159en\u00ed", "Vignette": "vignette", "Apply filter": "aplikovat filtry", "Reset filter": "resetovat filtry", "Remove all filters": "odstranit v\u0161echny filtry", "Error applying filter \"%s\".": "Chyba p\u0159i pou\u017eit\u00ed filtru \"%s\".", "Filter \"%s\" not defined.": "Filtr \"%s\" nen\u00ed definov\u00e1n.", "Could not read image data. Filters cannot be applied on images hosted on a different domain.": "Nemo\u017en\u00e9 p\u0159e\u010d\u00edst data obr\u00e1zku. Filtr nem\u016f\u017ee b\u00fdt pou\u017e\u00edt na obr\u00e1zc\u00edch um\u00edstn\u011bn\u00fdch na jin\u00e9 dom\u00e9n\u011b.", "Percent": "procent", "Adjustment": "\u00faprava", "Threshold": "m\u00edch\u00e1n\u00ed", "Red": "\u010derven\u00e1", "Green": "zelen\u00e1", "Blue": "modr\u00e1", "Amount": "mno\u017estv\u00ed", "Block size": "velikost okna", "Type": "type", "Strength": "s\u00edla", "Brush size": "velikost \u0161t\u011btce", "Link": "odkaz", "Add link to box": "p\u0159idat odkaz do okna", "This link will be associated to the whole box.": "Tento odkaz bude stoto\u017en\u011bn s cel\u00fdm oknem.", "Insert link url:": "Vlo\u017ete url odkaz:", "Align": "Zarovnat", "Align to page": "Zarovn\u00e1n\u00ed ke str\u00e1nce", "Left": "Levo", "Center": "St\u0159ed", "Right": "Pravo", "Top": "Vr\u0161ek", "Middle": "St\u0159ed", "Bottom": "Spodek", "Fit width": "p\u0159izp\u016fsobit v\u00fd\u0161ku", "Fit height": "p\u0159iyp\u016fsobit \u0161\u00ed\u0159ku", "Keep aspect ratio": "Stejn\u00fd pom\u011br stran", "Select box padding": "Vyberte okno padding", "Padding": "Padding", "Shadow": "St\u00edn", "Color": "Barva", "Text": "Text", "Paragraph": "paragraph", "Heading": "hlavi\u010dka", "Align left": "Zarovnat v levo", "Align center": "Zarovnat na st\u0159ed", "Align right": "Zarovnat v pravo", "Justify": "Zarovn\u00e1n\u00ed", "Ordered list": "ordered seznam", "Unordered list": "unorderet seznam", "Indent": "indent", "Outdent": "outdent", "Open link in the same tab.": "Otev\u0159\u00edt odkaz ve stejn\u00e9m panelu.", "Open link in a new tab.": "Otev\u0159\u00edt odkaz v nov\u00e9m panelu.", "Link style preview": "Styl uk\u00e1zky odkazu", "Link style": "styl odkazu", "Link style on mouse over": "Styl odkazu p\u0159i p\u0159ejet\u00ed mz\u0161\u00ed", "Insert link": "vlo\u017eit odkaz", "Remove": "odstranit", "The box link may override any link in the text.": "odkaz okna m\u016f\u017ee naru\u0161it odkaz vlo\u017een\u00fd v textu.", "Align top": "Zarovnat nahoru", "Align middle": "Zarovnat na st\u0159ed", "Align bottom": "Zarovnat na spode", "Extra small layout": "extra mal\u00e9 rozlo\u017een\u00ed", "Small layout": "mal\u00e9 rozlo\u017een\u00ed", "Medium layout": "st\u0159edn\u00ed rozlo\u017een\u00ed", "Large layout": "velk\u00e9 rozlo\u017een\u00ed", "If you perform this action you will revert to a non-responsive design. Are you sure?": "Poku\u010f potvrd\u00edte tuto akci p\u0159ejdete na nepromn\u011bn\u00fd design. Jste si jist\u00ed?", "You can start your design from any layout.": "M\u016f\u017eete za\u010d\u00edt V\u00e1\u0161 design z jak\u00e9holiv rozlo\u017een\u00ed.", "Boxes can be added in any layout and can be modified only in the layout they were added to.": "Okna m\u016f\u017eou b\u00fdt p\u0159id\u00e1na v jak\u00e9mkoliv rozlo\u017een\u00ed poze kdy\u017e jsou do rozlo\u017een\u00ed p\u0159id\u00e1na.", "Boxes added in a layout can be hidden in other layouts.": "Okna p\u0159id\u00e1na v rozlo\u017een\u00ed m\u016f\u017eou b\u00fdt skryta v ostatn\u00edch rozlo\u017een\u00edch.", "Custom layouts:": "vlastn\u00ed rozlo\u017een\u00ed", "Add custom layout": "p\u0159idat vlastn\u00ed rozlo\u017een\u00ed", "Multiple layout responsive design": "n\u011bkolikan\u00e1sobn\u00fd ", "The width of custom layouts can be adjusted to fit larger designs.": "\u0160\u00ed\u0159ka vlastn\u00edho rozlo\u017een\u00ed m\u016f\u017ee b\u00fdt upravena do velikosti velk\u00e9ho rozlo\u017een\u00ed.", "Click on a layout button to start creating content for that layout.": "Klikn\u011bte na tla\u010d\u00edtko rozlo\u017een\u00ed pro za\u010d\u00e1tek vztv\u00e1\u0159en\u00ed obsahu tohoto rozlou\u017een\u00ed.", "Save": "ulo\u017eit", "Abort": "zru\u0161it", "You may want to review the design for layouts in yellow.": "Mo\u017en\u00e1 chcete posoudit design rozlo\u017een\u00ed ve \u017elut\u00e9", "Save without reviewing": "ulo\u017eit bez posouzen\u00ed", "Please click on the layouts in gray to provide the design for all layouts.": "Pros\u00edm klikn\u011bte na rozlo\u017een\u00ed v \u0161edi, pro poskytnut\u00ed designu pro v\u0161echnz rozlo\u017een\u00ed", "Save anyway (not recommended)": "Ulo\u017eit ka\u017edop\u00e1dn\u011b (nen\u00ed doporu\u010deno)", "Your responsive content is ready to be saved!": "V\u00e1\u0161 p\u0159izp\u016fsobiv\u00fd obsah je p\u0159ipraven\u00fd k ulo\u017een\u00ed! ", "This box was created in another layout.": "Toto okno bylo vytvo\u0159eno v jin\u00e9m rozlo\u017een\u00ed.", "To modify its content edit the layout \"%s\".": "Pro \u00fapravu obsahu zm\u011bnte rozlo\u017een\u00ed \"%s\".", "The box is hidden in this layout.": "Okno je skryt\u00e9 v tomto rozlo\u017een\u00ed.", "Show box": "Zobrazit okno", "Edit box": "upravit okno", "Show": "uk\u00e1zat", "Hide box in this layout": "Skr\u00fdt okno v tomto rozlo\u017een\u00ed.", "This link will be associated to the whole %s content.": "Tento odkaz bude spojen s cel\u00fdm obsahem %s obsah.", "Width:": "\u0161\u00ed\u0159e", "Height:": "v\u00fd\u0161ka", "Delete": "smazat", "Click %s to insert audio.": "Klik %s pro vlo\u017een\u00ed audia.", "Audio": "Audio", "Insert audio": "vlo\u017eit audio", "Play": "p\u0159ehr\u00e1t", "Play audio": "p\u0159ehr\u00e1t audio", "Pause": "pozastavit", "Pause audio": "pozastavit audio", "Show audio": "uk\u00e1zat Audio", "Close audio": "zav\u0159\u00edt audio", "Please provide a valid link\/embed code for any of the supported audio services.": "Pros\u00edm uve\u010fte platn\u00fd odkaz, pro podporovane audio slu\u017eby", "Could not interpret the content as audio.": "Aoudio nebylo rozpozn\u00e1no.", "%s can't be set as background.": "%s nem\u016f\u017ee b\u00fdt nastaven jako pozad\u00ed.", "Files": "Soubory", "Insert audio embed code or url:": "Vlo\u017ete audio vkl\u00e1dac\u00ed k\u00f3d nebo url:", "Select audio from the list of available audios:": "Vybetre audio ze seznamu:", "Click %s to add color.": "Klik %s pro vlo\u017een\u00ed barvy.", "Click %s to insert image.": "Klik %s pro vlo\u017een\u00ed obr\u00e1zku.", "Image": "Obr\u00e1zek", "Insert image": "vlo\u017eit ob\u00e1zek", "Center &amp; fill": "Vycentrovat &amp; vypln\u011bno", "Fit": "vyplnit", "Stretch": "nat\u00e1hnut\u00ed", "Image options": "mo\u017enosti obr\u00e1zku", "Image quality": "Kvalita obr\u00e1zku", "Original": "Origin\u00e1ln\u00ed", "High": "Vysok\u00e1", "Normal": "Norm\u00e1ln\u00ed", "Low": "N\u00edzk\u00e1", "Proportional resize": "propor\u010dn\u00ed zv\u011bt\u0161en\u00ed", "Set box to image original size": "Nastavit okno na velikost obr\u00e1zku.", "Disk": "Disk", "Supported image file types:": "Podporovan\u00e9 typy obr\u00e1zk\u016f:", "Select image file from disk (max size %s):": "Vybrat obr\u00e1zek z disku (max velikost %s):", "Browse...": "Proch\u00e1zet", "Image quality:": "Kvalita obr\u00e1zku:", "Insert image URL link:": "Vlo\u017ete obr\u00e1zek URL odkaz:", "Image description:": "Popis obr\u00e1zku.", "Please insert image description.": "Pros\u00edm uve\u010fte popis obr\u00e1zku.", "Image description is too short.": "Popis obr\u00e1zku je p\u0159\u00edli\u0161 kr\u00e1tk\u00fd.", "No file selected.": "\u017d\u00e1dn\u00fd soubor nebyl vybr\u00e1n.", "Please insert a link.": "Pros\u00edm uve\u010fte odkaz.", "An unexpected error occurred. Please try again.": "Neo\u010dek\u00e1van\u00e1 chyba. Pros\u00edm zkuste znovu.", "There was an error during server image resize.": "Chyba b\u011bhem zmen\u0161ov\u00e1n\u00ed obrazku servrem.", "Loading...": "Na\u010d\u00edt\u00e1n\u00ed...", "Could not interpret the content as image.": "Nerozezn\u00e1no jako obr\u00e1zek.", "File extension not valid.": "Neplatn\u00e1 p\u0159\u00edpona p\u0159\u00edlohy.", "File too big (max size: %s).": "Soubor je p\u0159\u00edpi\u0161 velk\u00fd (max velikost: %s ).", "Error in reading the response from the server": "Chyba po\u0159i \u010dten\u00ed odpov\u011bdi ze servru.", "Method %s does not exist on %s.": "Metoda %s neexistuje na %s.", "Input not defined": "Zdroj nen\u00ed ur\u010den", "Image file type cannot be resized.": "Obr\u00e1zku nem\u016f\u017ee b\u00fdt zm\u011bn\u011bna velikost.", "File is not a supported image.": "Soubor nen\u00ed podporov\u00e1n jako obr\u00e1zek.", "File is not recognized as valid image.": "Soubor nen\u00ed rozpozn\u00e1n jako video.", "File is too big.": "Soubor je p\u0159\u00edi\u0161 velk\u00fd.", "Error during loading of the image.": "Chyba b\u011bhem na\u010d\u00edt\u00e1n\u00ed obr\u00e1zku.", "Too many \"%s\" boxes (limit: %s).": "p\u0159\u00edli\u0161 mnoho \"%s\"oken (limit: %s).", "Too many total boxes (limit: %s).": "P\u0159\u00edli\u0161 mnoho oken (limit: %s).", "Unexpected error: could not finalize box style.": "Ne\u010dekan\u00e1 chyba: nepoda\u0159ilo se dokon\u010dit styl okna.", "Background": "Pozad\u00ed", "Arrange": "se\u0159adit", "Bring to front": "na pop\u0159ed\u00ed", "Send to back": "na pozadi", "Bring forward": "o jednu dopredu", "Send backward": "o jednu dozadu", "Duplicate": "zkop\u00edrovat", "Flip": "p\u0159evr\u00e1tit", "Vertical": "svisle", "Horizontal": "vodorovn\u011b", "Select background color": "Barva pozad\u00ed", "Opacity": "Pr\u016fhlednost", "Box opacity": "Pr\u016fhlenost pozad\u00ed", "Select box opacity": "Vyberte pr\u016fhlednost okna", "Select background opacity": "Vyberte pr\u016fhlednost pozad\u00ed", "Background opacity": "Pr\u016fhlednost pozad\u00ed", "Border": "Okraj", "Select border style": "Vyberte ohrani\u010den\u00ed", "Select border width": "Vyberte \u0161\u00ed\u0159i ohrani\u010den\u00ed", "Width": "\u0161\u00ed\u0159ka", "Corners": "Rohy", "Top left corner": "vrchni roh v levo", "Top right corner": "vrchn\u00ed roh v pravo", "Bottom left corner": "spodn\u00ed roh v levo", "Bottom right corner": "spodn\u00ed roh v pravo", "Rounded corners": "zakulacen\u00e9 rohy", "Unexpected error: box has no content.": "Ne\u010dekan\u00e1 chyba: okno nem\u00e1 obsah.", "Box type not supplied during registration.": "Box type not supplied during registration.", "Video": "Video", "Click %s to insert text.": "Klik %s pro vlo\u017een\u00ed textu.", "Done": "Hotovo", "Done editing": "Dokon\u010deno upravov\u00e1n\u00ed", "Font": "P\u00edsmo", "Bold": "Siln\u00e9", "Italic": "Italic", "Underline": "Podrtr\u017een\u00e9", "Increase font size": "Zv\u011bt\u0161it velikost p\u00edsma", "Decrease font size": "Zmen\u0161it velikost p\u00edsma", "Text length exceeds the maximum limit.": "D\u00e9lka textu p\u0159es\u00e1hla maxim\u00e1ln\u00ed velikost", "Click %s to insert video.": "Klik %s pro vlo\u017een\u00ed videa", "Insert video": "Vlo\u017eit video", "Play video": "P\u0159ehr\u00e1t video", "Pause video": "Pozastavit video", "Show video": "Uka\u017e video", "Close video": "Zav\u0159\u00edt video", "Please provide a valid link\/embed code for any of the supported video services.": "Pros\u00edm uve\u010fte platn\u00fd odkaz\/vkl\u00e1dac\u00ed k\u00f3d pro podporovane slu\u017eby", "Could not interpret the content as video.": "Obsah nebyl roizezn\u00e1n jako video. ", "Insert video embed code or url:": "Vlo\u017ete video vkl\u00e1dac\u00ed k\u00f3d nebo url", "Select video from the list of available videos:": "Vyber video ze seznamu dostupn\u00fdch vide\u00ed:", "Add %s box": "P\u0159idej %s okno", "Set as background": "nastavit jako pozad\u00ed", "Unset from background": "P\u0159enastavt od pozad\u00ed", "Error in generating unique id.": "Chyba p\u0159i generovan\u00ed unik\u00e1tn\u00edho id.", "Improper internal call.": "Nepovolen\u00fd vnit\u0159n\u00ed po\u017eadavek.", "Please insert a value.": "Pros\u00edm udejte hodnoty.", "Browser does not support required feature \"%s\".": "Prohl\u00ed\u017ee\u010d nepodporuje po\u017eadovan\u00e9 vlastnosti\"%s\".", "Could not initialize %s. Container not found.": "nepoda\u0159ilo se aktivovat %s Kontejner nenalezen. ", "Box type \"%s\" doesn't exist.": "Okno typu \"%s\" neexistuje.", "Error during box creation: %s.": "Chyba b\u011bhem vytv\u00e1\u0159en\u00ed okna:%s", "Saving content.": "Ukl\u00e1d\u00e1n\u00ed obsahu.", "Please wait...": "Pros\u00edm \u010dekejte...", "Removed box. Box type \"%s\" not supported.": "Odstran\u011bn\u00e9 okno. Typ okna \"%s\"nen\u00ed podporov\u00e1no.", "This is a %s feature.": "Toto je %s vlastnost.", "For information, please visit %s.": "Pro v\u00edce informac\u00ed, pros\u00edm nav\u0161tivte %s. ", "Box size and position": "Velikost okna a pozice.", "Size": "velikost", "Box": "okno", "SEO and grouping tags": "SEO a spole\u010dn\u00e9 tagy", "Additional audio services:": "Dodate\u010dn\u00e1 audio slu\u017eby:", "Supported in %s:": "Podporov\u00e1no v %s:", "Current color:": "Nyn\u011bj\u0161\u00ed barva:", "Click on the \"%s\" button to start creating content for extra small layouts.": "Klikn\u011bte na \"%s\" tla\u010d\u00edtko. Pro za\u010d\u00e1tek vytv\u00e1\u0159en\u00ed obsahu ve velmi mal\u00fdch rozlo\u017een\u00edch", "Start responsive design": "za\u010dnete prom\u011bn\u00fd design", "Snap boxes to": "P\u0159\u00edpevnit okno k", "Page": "Str\u00e1nka", "Boxes": "Okna", "Content link": "Obsah odkazu", "Content": "obash", "Edit": "upravit", "Undo": "krok zp\u011bt", "Redo": "krok dop\u0159edu", "Clear all": "vy\u010distit v\u0161e", "Click to set Hex color": "Klikn\u011bte pro nastaven\u00ed Hex barvy", "Click to set RGB color": "Klikn\u011bte pro nastaven\u00ed RGB barvy", "Solid color": "pln\u00e1 barva", "Horiz. gradient": "vodorovn\u00fd p\u0159echod", "Vert. gradient": "svisl\u00fd p\u0159echod", "Radial gradient": "kruhov\u00fd p\u0159echod", "Select color opacity": "Nastavte pr\u016fhlednost barvy", "Set custom color (Hex)": "Nasatavte vlastn\u00ed barvy (Hex)", "Please enter the color in hex format, e.g. %s": "Pros\u00edm udejte barvu v hex form\u00e1tu,e.g.%s", "You must enter a color.": "Mus\u00edte udat barvu.", "Set custom color (RGB)": "Nastavte barvy (RGB)", "Please enter the color in RGB format, with comma-separated components, e.g. %s": "Pros\u00edm uve\u010fte barvu v RGB jednotlive hodnoty odd\u011blte \u010d\u00e1rkou."
    }
);
Zedity.i18n.add('de', {
        "%s needs %s.": "%s ben\u00f6tigt %s.", "Click %s to insert a document.": "%s klicken um ein Dokument einzuf\u00fcgen.", "Document": "Dokument", "Insert": "Einf\u00fcgen", "Insert document": "Dokument einf\u00fcgen", "Read": "Lesen", "Read document": "Dokument lesen", "Close": "Schlie\u00dfen", "Close document": "Dokument schlie\u00dfen", "Please provide a valid link\/embed code for any of the supported document embed services or a direct link to a document.": "Bitte geben Sie einen g\u00fcltigen Link oder Code f\u00fcr einen der unterst\u00fctzten Dokument-Services oder einen direkten Link zu einen Dokument ein.", "Could not interpret the content as document.": "Der Inhalt konnte nicht als Dokument erkannt werden.", "%s can't be rotated.": "%s kann nicht gedreht werden.", "%s doesn't support background property.": "%s unterst\u00fctzt keine Hintergrundeigenschaft.", "%s doesn't support rounded corners.": "%s unterst\u00fctzt keine runden Ecken.", "%s doesn't support flipping.": "%s unterst\u00fctzt kein umdrehen.", "Embed": "Einf\u00fcgen", "Insert document embed code or url:": "Dokument-Einf\u00fcgungscode oder URL angeben:", "Supported services:": "Unterst\u00fctzte Services:", "Supported documents:": "Unterst\u00fctzte Dokumente:", "PDF documents, Microsoft Office documents, Apple Pages, Adobe Photoshop and Illustrator, and more.": "PDF-Dokumente, Microsoft Office Dokumente, Apple-Seiten, Adobe Photoshop und Illustrator, und mehr.", "OK": "OK", "Cancel": "Abbrechen", "Click %s to insert HTML.": "%s klicken um HTML einzuf\u00fcgen.", "Html": "Html", "Insert HTML": "HTML einf\u00fcgen", "View": "Ansehen", "View box content": "Box-Inhalt ansehen", "Insert HTML code:": "HTML-Code einf\u00fcgen:", "Safe mode:": "Sicherer Modus:", "Automatic": "Automatisch", "Enabled": "Erm\u00f6glicht", "Disabled": "Gesperrt", "If you insert Javascript or CSS code and you get unexpected effects (e.g. content overflow, etc.) you need to enable safe mode.": "Wenn Sie Javascript oder CSS-Code einf\u00fcgen und unerwartete Effekte erhalten (z.B. \u00fcberflie\u00dfenden Inhalt, etc.), dann m\u00fcssen Sie den Safe-Mode aktivieren.", "The (default) automatic setting enables safe mode only if Javascript is detected.": "In der standardm\u00e4\u00dfigen automatischen Einstellung ist der Safe-Mode nur m\u00f6glich wenn Javascript vorhanden ist.", "Inserting a %s content into an HTML box is not supported at the moment.": "Das Einf\u00fcgen eines %s Inhalts in eine HTML-Box wird zur Zeit nicht unterst\u00fctzt.", "Filters": "Filter", "Apply image filters": "Bild-Filter anwenden", "Adjust colors": "Farben anpassen", "Black &amp; white": "Schwarz &amp; wei\u00df", "Blur": "Verwischen", "Brightness": "Helligkeit", "Contrast": "Kontrast", "Emboss": "Einpr\u00e4gen", "Grayscale": "Grauskala", "Invert": "Invertieren", "Mosaic": "Mosaik", "Motion blur": "Bewegungsunsch\u00e4rfe", "Noise": "Rauschen", "Paint": "Malen", "Posterize": "Tontrennung", "Psychedelia": "Psychedelisch", "Sepia": "Sepia", "Sharpen": "Sch\u00e4rfen", "Vignette": "Vignette", "Apply filter": "Filter anwenden", "Reset filter": "Filter zur\u00fccksetzen", "Remove all filters": "Alle Filter entfernen", "Error applying filter \"%s\".": "Fehler beim Anwenden des Filters \"%s\".", "Filter \"%s\" not defined.": "Filter \"%s\" ist nicht definiert.", "Could not read image data. Filters cannot be applied on images hosted on a different domain.": "Die Bilddaten konnten nicht gelesen werden. Filter k\u00f6nnen bei Bildern, die auf einer anderen Domain gehostet werden, nicht angewandt werden.", "Percent": "Prozent", "Adjustment": "Anpassung", "Threshold": "Schwellenwert", "Red": "Rot", "Green": "Gr\u00fcn", "Blue": "Blau", "Amount": "Betrag", "Block size": "Blockgr\u00f6\u00dfe", "Type": "Typ", "Strength": "St\u00e4rke", "Brush size": "Pinselgr\u00f6\u00dfe", "Link": "Link", "Add link to box": "Zur Box Link hinzuf\u00fcgen", "This link will be associated to the whole box.": "Dieser Link ist mit der ganzen Box verbunden.", "Insert link url:": "Link-URL eingeben:", "Align": "Ausrichten", "Align to page": "An Seite ausrichten", "Left": "Links", "Center": "Zentrum", "Right": "Rechts", "Top": "Oben", "Middle": "Mitte", "Bottom": "Unten", "Fit width": "Breite anpassen", "Fit height": "H\u00f6he anpassen", "Keep aspect ratio": "Aspekt-Ratio einhalten", "Select box padding": "Boxpadding w\u00e4hlen", "Padding": "Padding", "Shadow": "Schatten", "Color": "Farbe", "Text": "Text", "Paragraph": "Paragraph", "Heading": "\u00dcberschrift", "Align left": "Links ausrichten", "Align center": "Im Zentrum ausrichten", "Align right": "Rechts ausrichten", "Justify": "B\u00fcndig machen", "Ordered list": "Geordnete Liste", "Unordered list": "Ungeordnete Liste", "Indent": "Einr\u00fccken", "Outdent": "Ausr\u00fccken", "Open link in the same tab.": "Link im selben Reiter \u00f6ffnen.", "Open link in a new tab.": "Link in einem neuen Reiter \u00f6ffnen.", "Link style preview": "Linkstil-Vorschau", "Link style": "Linkstil", "Link style on mouse over": "Linkstil bei Maus \u00fcber", "Insert link": "Link einf\u00fcgen", "Remove": "Entfernen", "The box link may override any link in the text.": "Der Boxlink kann jeden Link im Text \u00fcberschreiben.", "Align top": "Oben ausrichten", "Align middle": "Mittig ausrichten", "Align bottom": "Unten ausrichten", "Save": "Abspeichern", "Abort": "Abbruch", "Edit box": "Box editieren", "Show": "Anzeigen", "This link will be associated to the whole %s content.": "Dieser Link verbindet den ganzen %s Inhalt.", "Width:": "Breite:", "Height:": "H\u00f6he:", "Delete": "L\u00f6schen", "Click %s to insert audio.": "Audio hinzuf\u00fcgen mit Klick auf %s.", "Audio": "Audio", "Insert audio": "Audio hinzuf\u00fcgen", "Play": "Abspielen", "Play audio": "Audio abspielen", "Pause": "Pause", "Pause audio": "Audio pausieren", "Show audio": "Audio anzeigen", "Close audio": "Audio schlie\u00dfen", "Please provide a valid link\/embed code for any of the supported audio services.": "Bitte einen g\u00fcltigen Link oder Code f\u00fcr einen der unterst\u00fctzten Audio-Services angeben.", "Could not interpret the content as audio.": "Der Inhalt konnte nicht als Audio erkannt werden.", "%s can't be set as background.": "%s kann als Hintergrund nicht verwendet werden.", "Files": "Dateien", "Insert audio embed code or url:": "Audio-Code oder URL eingeben:", "Select audio from the list of available audios:": "Audio von der Liste der verf\u00fcgbaren Audios ausw\u00e4hlen:", "Click %s to add color.": "Farbe hinzuf\u00fcgen mit Klick auf %s.", "Click %s to insert image.": "Bild einf\u00fcgen mit Klick auf %s.", "Image": "Bild", "Insert image": "Bild einf\u00fcgen", "Center &amp; fill": "Zentrieren &amp; f\u00fcllen", "Fit": "Anpassen", "Stretch": "Ausdehnen", "Image options": "Bild-Optionen", "Image quality": "Bildqualit\u00e4t", "Original": "Original", "High": "Hoch", "Normal": "Normal", "Low": "Niedrig", "Proportional resize": "Proportional Gr\u00f6\u00dfe ver\u00e4ndern", "Set box to image original size": "Box auf die reale Bildgr\u00f6\u00dfe anpassen", "Disk": "Festplatte", "Supported image file types:": "Unterst\u00fctzte Bilddatei-Typen:", "Select image file from disk (max size %s):": "Bilddatei von Festplatte ausw\u00e4hlen (maximale Gr\u00f6\u00dfe %s):", "Browse...": "Durchsuchen...", "Image quality:": "Bildqualit\u00e4t:", "Insert image URL link:": "Bild-URL-Link eingeben:", "Image description:": "Bildbeschreibung:", "Please insert image description.": "Bitte Bildbeschreibung eingeben.", "Image description is too short.": "Bildbeschreibung ist zu kurz.", "No file selected.": "Keine Datei ausgew\u00e4hlt.", "Please insert a link.": "Bitte einen Link eingeben.", "An unexpected error occurred. Please try again.": "Es ist ein unerwarteter Fehler passiert. Bitte noch einmal probieren.", "There was an error during server image resize.": "Ein Fehler geschah w\u00e4hrend der Bildgr\u00f6\u00dfenanpassung.", "Loading...": "Ladend...", "Could not interpret the content as image.": "Der Inhalt konnte als Bild nicht interpretiert werden.", "File extension not valid.": "Fehlerhafte Dateiendung.", "File too big (max size: %s).": "Datei ist zu gro\u00df (maximale Gr\u00f6\u00dfe: %s).", "Error in reading the response from the server": "Fehler beim Lesen der Antwort vom Server", "Method %s does not exist on %s.": "Methode %s existiert auf %s nicht.", "Input not defined": "Eingabe nicht definiert", "Image file type cannot be resized.": "Gr\u00f6\u00dfe dieses Bilddateityps kann nicht ver\u00e4ndert werden.", "File is not a supported image.": "Datei ist kein unterst\u00fctztes Bild.", "File is not recognized as valid image.": "Datei wurde als ein nicht g\u00fcltiges Bild bewertet.", "File is too big.": "Datei ist zu gro\u00df.", "Error during loading of the image.": "Fehler w\u00e4hrend dem Bildladen.", "Too many \"%s\" boxes (limit: %s).": "Zu viele \"%s\" Boxen (Limit: %s).", "Too many total boxes (limit: %s).": "Zusammen zu viele Boxen (Limit: %s).", "Unexpected error: could not finalize box style.": "Unerwarteter Fehler: Boxstil konnte nicht fertiggestellt werden.", "Background": "Hintergrund", "Arrange": "Anordnen", "Bring to front": "In den Vordergrund bringen", "Send to back": "In den Hintergrund senden", "Bring forward": "Nach vorne bringen", "Send backward": "nach hinten senden", "Duplicate": "Duplizieren", "Flip": "Umdrehen", "Vertical": "Vertikal", "Horizontal": "Horizontal", "Select background color": "Hintergrundfarbe ausw\u00e4hlen", "Opacity": "Deckkraft", "Box opacity": "Box-Deckkraft", "Select box opacity": "Box-Deckkraft w\u00e4hlen", "Select background opacity": "Hintergrund-Deckkraft w\u00e4hlen", "Background opacity": "Hintergrund-Deckkraft", "Border": "Rahmen", "Select border style": "Rahmenstil w\u00e4hlen", "Select border width": "Rahmenbreite w\u00e4hlen", "Width": "Breite", "Corners": "Ecken", "Top left corner": "Obere linke Ecke", "Top right corner": "Obere rechte Ecke", "Bottom left corner": "Untere linke Ecke", "Bottom right corner": "Untere rechte Ecke", "Rounded corners": "Runde Ecken", "Unexpected error: box has no content.": "Unerwarteter Fehler: Box hat keinen Inhalt.", "Box type not supplied during registration.": "W\u00e4hrend der Registrierung wurde kein Boxtyp angegeben.", "Video": "Video", "Click %s to insert text.": "%s klicken um Text einzugeben.", "Done": "Fertig", "Done editing": "Fertig mit editieren", "Font": "Font", "Bold": "Fett", "Italic": "Italic", "Underline": "Unterstreichen", "Increase font size": "Fontgr\u00f6\u00dfe vergr\u00f6\u00dfern", "Decrease font size": "Fontgr\u00f6\u00dfe verkleinern", "Text length exceeds the maximum limit.": "Textl\u00e4nge \u00fcberschreitet das maximale Limit.", "Click %s to insert video.": "Video mit Klick auf %s einf\u00fcgen.", "Insert video": "Video einf\u00fcgen", "Play video": "Video abspielen", "Pause video": "Video pausieren", "Show video": "Video zeigen", "Close video": "Video schlie\u00dfen", "Please provide a valid link\/embed code for any of the supported video services.": "Bitte einen g\u00fcltigen Link oder Code f\u00fcr einen der unterst\u00fctzten Video-Services eingeben.", "Could not interpret the content as video.": "Der Inhalt wurde nicht als Video erkannt.", "Insert video embed code or url:": "Video-Code oder URL eingeben:", "Select video from the list of available videos:": "Video von der List der verf\u00fcgbaren Videos ausw\u00e4hlen:", "Add %s box": "%s Box hinzuf\u00fcgen", "Set as background": "Als Hintergrund setzen", "Unset from background": "Vom Hintergrund entfernt", "Error in generating unique id.": "Fehler beim Generieren einer einmaligen ID.", "Improper internal call.": "Fehlerhafter interner Aufruf.", "Please insert a value.": "Bitte einen Wert eingeben.", "Browser does not support required feature \"%s\".": "Browser unterst\u00fctzt nicht die erforderliche \"%s\" Eigenschaft.", "Could not initialize %s. Container not found.": "Konnte %s nicht initialisieren. Beh\u00e4lter wurde nicht gefunden.", "Box type \"%s\" doesn't exist.": "Boxtyp \"%s\" existiert nicht.", "Error during box creation: %s.": "Fehler w\u00e4hrend Box-Erstellung: %s.", "Saving content.": "Inhalt wird gespeichert.", "Please wait...": "Bitte warten...", "Removed box. Box type \"%s\" not supported.": "Box wurde entfernt. Boxtyp \"%s\" wird nicht unterst\u00fctzt.", "This is a %s feature.": "Das ist eine %s Eigenschaft.", "For information, please visit %s.": "F\u00fcr Information, bitte %s lesen.", "Size": "Gr\u00f6\u00dfe", "Box": "Box", "SEO and grouping tags": "SEO und Gruppierungskennzeichen", "Additional audio services:": "Zus\u00e4tzliche Audio-Services:", "Supported in %s:": "In %s unterst\u00fctzt:", "Current color:": "Jetzige Farbe:", "Snap boxes to": "Boxes anheften an", "Page": "Seite", "Boxes": "Boxes", "Content link": "Inhaltslink", "Content": "Inhalt", "Edit": "Editieren", "Undo": "Zur\u00fccksetzen", "Redo": "Wiederholen", "Clear all": "Alles l\u00f6schen", "Click to set Hex color": "Klicken zum Setzen der Hex-Farbe", "Click to set RGB color": "Klicken zum Setzen der RGB-Farbe", "Solid color": "Volle Farbe", "Horiz. gradient": "Horiz. Gradient", "Vert. gradient": "Vert. Gradient", "Radial gradient": "Radialer Gradient", "Select color opacity": "Farb-Deckkraft w\u00e4hlen", "Set custom color (Hex)": "Angepasste Farbe w\u00e4hlen (Hex)", "Please enter the color in hex format, e.g. %s": "Bitte die Farbe in Hex-Format angeben, z.B. %s", "You must enter a color.": "Sie m\u00fcssen eine Farbe angeben.", "Set custom color (RGB)": "Angepasste Farbe angeben (RGB)", "Please enter the color in RGB format, with comma-separated components, e.g. %s": "Bitte Farbe im RGB-Format angeben, mit kommaunterteilten Komponenten, z.B. %s"
    }
);
Zedity.i18n.add('el', {
        "%s needs %s.": "%s \u03c7\u03c1\u03b5\u03b9\u03ac\u03b6\u03b5\u03c4\u03b1\u03b9 %s.", "Click %s to insert a document.": "\u039a\u03bb\u03b9\u03ba %s \u03b3\u03b9\u03b1 \u03bd\u03b1 \u03b5\u03b9\u03c3\u03ac\u03b3\u03b5\u03c4\u03b5 \u03ad\u03bd\u03b1 \u03ad\u03b3\u03b3\u03c1\u03b1\u03c6\u03bf.", "Document": "\u0388\u03b3\u03b3\u03c1\u03b1\u03c6\u03bf", "Insert": "\u0395\u03b9\u03c3\u03b1\u03b3\u03c9\u03b3\u03ae", "Insert document": "\u0395\u03b9\u03c3\u03b1\u03b3\u03c9\u03b3\u03ae \u03ad\u03b3\u03b3\u03c1\u03b1\u03c6\u03bf", "Read": "\u0391\u03bd\u03ac\u03b3\u03bd\u03c9\u03c3\u03b7", "Read document": "\u0391\u03bd\u03ac\u03b3\u03bd\u03c9\u03c3\u03b7 \u03ad\u03b3\u03b3\u03c1\u03b1\u03c6\u03bf", "Close": "\u039a\u03bb\u03b5\u03af\u03c3\u03b9\u03bc\u03bf", "Close document": "\u039a\u03bb\u03b5\u03af\u03c3\u03b9\u03bc\u03bf \u03ad\u03b3\u03b3\u03c1\u03b1\u03c6\u03bf", "Please provide a valid link\/embed code for any of the supported document embed services or a direct link to a document.": "\u03a0\u03b1\u03c1\u03b1\u03ba\u03b1\u03bb\u03bf\u03cd\u03bc\u03b5 \u03b4\u03ce\u03c3\u03c4\u03b5 \u03ad\u03bd\u03b1\u03bd \u03ad\u03b3\u03ba\u03c5\u03c1\u03bf \u03b4\u03b5\u03c3\u03bc\u03cc \u03ae \u03ba\u03ce\u03b4\u03b9\u03ba\u03b1 \u03b5\u03bd\u03c3\u03c9\u03bc\u03ac\u03c4\u03c9\u03c3\u03b7 \u03b3\u03b9\u03b1 \u03bf\u03c0\u03bf\u03b9\u03b1\u03b4\u03ae\u03c0\u03bf\u03c4\u03b5 \u03b1\u03c0\u03cc \u03c4\u03b9\u03c2 \u03c5\u03c0\u03bf\u03c3\u03c4\u03b7\u03c1\u03b9\u03b6\u03cc\u03bc\u03b5\u03bd\u03b5\u03c2 \u03c5\u03c0\u03b7\u03c1\u03b5\u03c3\u03af\u03b5\u03c2 \u03b5\u03b3\u03b3\u03c1\u03ac\u03c6\u03bf\u03c5 \u03ae \u03ad\u03bd\u03b1 \u03ac\u03bc\u03b5\u03c3\u03bf \u03b4\u03b5\u03c3\u03bc\u03cc \u03c3\u03b5 \u03ad\u03bd\u03b1 \u03ad\u03b3\u03b3\u03c1\u03b1\u03c6\u03bf.", "Could not interpret the content as document.": "\u03a4\u03bf \u03c0\u03b5\u03c1\u03b9\u03b5\u03c7\u03cc\u03bc\u03b5\u03bd\u03bf \u03b4\u03b5\u03bd \u03b1\u03bd\u03b1\u03b3\u03bd\u03c9\u03c1\u03af\u03c3\u03c4\u03b7\u03ba\u03b5 \u03c9\u03c2 \u03ad\u03b3\u03b3\u03c1\u03b1\u03c6\u03bf.", "%s can't be rotated.": "%s \u03b4\u03b5\u03bd \u03bc\u03c0\u03bf\u03c1\u03b5\u03af \u03bd\u03b1 \u03c0\u03b5\u03c1\u03b9\u03c3\u03c4\u03c1\u03b1\u03c6\u03b5\u03af.", "%s doesn't support background property.": "%s \u03b4\u03b5\u03bd \u03c5\u03c0\u03bf\u03c3\u03c4\u03b7\u03c1\u03af\u03b6\u03b5\u03b9 \u03c4\u03b7\u03bd \u03b4\u03c5\u03bd\u03b1\u03c4\u03cc\u03c4\u03b7\u03c4\u03b1 \u03c6\u03cc\u03bd\u03c4\u03bf.", "%s doesn't support rounded corners.": "%s \u03b4\u03b5\u03bd \u03c5\u03c0\u03bf\u03c3\u03c4\u03b7\u03c1\u03af\u03b6\u03b5\u03b9 \u03c3\u03c4\u03c1\u03bf\u03b3\u03b3\u03c5\u03bb\u03b5\u03bc\u03ad\u03bd\u03b5\u03c2 \u03b3\u03c9\u03bd\u03af\u03b5\u03c2.", "%s doesn't support flipping.": "%s \u03b4\u03b5\u03bd \u03c5\u03c0\u03bf\u03c3\u03c4\u03b7\u03c1\u03af\u03b6\u03b5\u03b9 \u03b1\u03bd\u03b1\u03c3\u03c4\u03c1\u03bf\u03c6\u03ae.", "Embed": "Embed", "Insert document embed code or url:": "\u0395\u03b9\u03c3\u03ac\u03b3\u03b5\u03c4\u03b5 \u03c4\u03bf \u03ba\u03ce\u03b4\u03b9\u03ba\u03b1 \u03b5\u03bd\u03c3\u03c9\u03bc\u03ac\u03c4\u03c9\u03c3\u03b7 \u03ae \u03c4\u03bf URL \u03c4\u03bf\u03c5 \u03b5\u03b3\u03b3\u03c1\u03ac\u03c6\u03bf\u03c5:", "Supported services:": "\u03a5\u03c0\u03bf\u03c3\u03c4\u03b7\u03c1\u03b9\u03b6\u03cc\u03bc\u03b5\u03bd\u03b5\u03c2 \u03c5\u03c0\u03b7\u03c1\u03b5\u03c3\u03af\u03b5\u03c2:", "Supported documents:": "\u03a5\u03c0\u03bf\u03c3\u03c4\u03b7\u03c1\u03b9\u03b6\u03cc\u03bc\u03b5\u03bd\u03b1 \u03ad\u03b3\u03b3\u03c1\u03b1\u03c6\u03b1:", "PDF documents, Microsoft Office documents, Apple Pages, Adobe Photoshop and Illustrator, and more.": "\u0388\u03b3\u03b3\u03c1\u03b1\u03c6\u03b1 PDF, \u03ad\u03b3\u03b3\u03c1\u03b1\u03c6\u03b1 \u03c4\u03bf\u03c5 Microsoft Office, Apple Pages, Adobe Photoshop \u03ba\u03b1\u03b9 Illustrator, \u03ba\u03b1\u03b9 \u03c0\u03bf\u03bb\u03bb\u03ac \u03ac\u03bb\u03bb\u03b1.", "OK": "OK", "Cancel": "\u0391\u03ba\u03cd\u03c1\u03c9\u03c3\u03b7", "Click %s to draw.": "\u039a\u03bb\u03b9\u03ba %s \u03b3\u03b9\u03b1 \u03c3\u03c7\u03b5\u03b4\u03b9\u03b1\u03c3\u03bc\u03cc", "Draw": "\u03a3\u03c7\u03ad\u03b4\u03b9\u03bf", "Editing": "\u0395\u03c0\u03b5\u03be\u03b5\u03c1\u03b3\u03b1\u03c3\u03af\u03b1", "Done": "\u039f\u03bb\u03bf\u03ba\u03bb\u03b7\u03c1\u03ce\u03b8\u03b7\u03ba\u03b5", "Done editing": "\u039f\u03bb\u03bf\u03ba\u03bb\u03b7\u03c1\u03ce\u03b8\u03b7\u03ba\u03b5 \u03b5\u03c0\u03b5\u03be\u03b5\u03c1\u03b3\u03b1\u03c3\u03af\u03b1", "Undo": "\u0391\u03bd\u03b1\u03af\u03c1\u03b5\u03c3\u03b7", "Undo modifications": "\u0391\u03bd\u03b1\u03af\u03c1\u03b5\u03c3\u03b7 \u03b1\u03bb\u03bb\u03b1\u03b3\u03ad\u03c2", "Redo": "\u0391\u03ba\u03cd\u03c1\u03c9\u03c3\u03b7 \u03b1\u03bd\u03b1\u03af\u03c1\u03b5\u03c3\u03b7\u03c2", "Redo modifications": "\u0395\u03c0\u03b1\u03bd\u03ac\u03bb\u03b7\u03c8\u03b7 \u03b1\u03bb\u03bb\u03b1\u03b3\u03ad\u03c2", "Clear all": "\u0394\u03b9\u03b1\u03b3\u03c1\u03b1\u03c6\u03ae \u03cc\u03bb\u03c9\u03bd", "Style": "\u03a3\u03c4\u03c5\u03bb", "Color": "\u03a7\u03c1\u03ce\u03bc\u03b1", "Select stroke color": "\u0395\u03c0\u03b9\u03bb\u03ad\u03be\u03c4\u03b5 \u03c4\u03bf \u03c7\u03c1\u03ce\u03bc\u03b1 \u03b3\u03c1\u03b1\u03bc\u03bc\u03ae\u03c2", "Width": "\u03a0\u03bb\u03ac\u03c4\u03bf\u03c2", "Set stroke width": "\u0395\u03c0\u03b9\u03bb\u03ad\u03be\u03c4\u03b5 \u03c4\u03bf \u03c6\u03ac\u03c1\u03b4\u03bf\u03c2 \u03b3\u03c1\u03b1\u03bc\u03bc\u03ae\u03c2", "Fill": "\u0393\u03ad\u03bc\u03b9\u03c3\u03bc\u03b1", "Select fill color": "\u0395\u03c0\u03b9\u03bb\u03ad\u03be\u03c4\u03b5 \u03c4\u03bf \u03c7\u03c1\u03ce\u03bc\u03b1 \u03c4\u03b7\u03c2 \u03b3\u03ad\u03bc\u03b9\u03c3\u03b7\u03c2", "Tools": "\u0395\u03c1\u03b3\u03b1\u03bb\u03b5\u03af\u03b1", "Freehand drawing": "\u0395\u03bb\u03b5\u03cd\u03b8\u03b5\u03c1\u03bf \u03c3\u03c7\u03ad\u03b4\u03b9\u03bf", "Shapes": "\u03a3\u03c7\u03ae\u03bc\u03b1\u03c4\u03b1", "Draw shapes": "\u03a3\u03c7\u03b5\u03b4\u03b9\u03b1\u03c3\u03bc\u03cc \u03c3\u03c7\u03ae\u03bc\u03b1\u03c4\u03b1", "Line": "\u0393\u03c1\u03b1\u03bc\u03bc\u03ae", "Rectangle": "\u039f\u03c1\u03b8\u03bf\u03b3\u03ce\u03bd\u03b9\u03bf \u03c0\u03b1\u03c1\u03b1\u03bb\u03bb\u03b7\u03bb\u03cc\u03b3\u03c1\u03b1\u03bc\u03bc\u03bf", "Circle": "\u039a\u03cd\u03ba\u03bb\u03bf\u03c2", "Arrow": "\u0392\u03ad\u03bb\u03bf\u03c2", "Polygon": "\u03a0\u03bf\u03bb\u03cd\u03b3\u03c9\u03bd\u03bf", "Star": "\u0391\u03c3\u03c4\u03ad\u03c1\u03b9", "Draw polygon": "\u03a3\u03c7\u03b5\u03b4\u03b9\u03b1\u03c3\u03bc\u03cc \u03c0\u03bf\u03bb\u03cd\u03b3\u03c9\u03bd\u03bf", "Number of faces": "\u0391\u03c1\u03b9\u03b8\u03bc\u03cc\u03c2 \u03c0\u03bb\u03b5\u03c5\u03c1\u03ad\u03c2", "Draw star": "\u03a3\u03c7\u03b5\u03b4\u03b9\u03b1\u03c3\u03bc\u03cc \u03b1\u03c3\u03c4\u03ad\u03c1\u03b9", "Number of star spikes": "\u0391\u03c1\u03b9\u03b8\u03bc\u03cc\u03c2 \u03c3\u03b7\u03bc\u03b5\u03af\u03c9\u03bd \u03c4\u03bf\u03c5 \u03b1\u03c3\u03c4\u03b5\u03c1\u03b9\u03bf\u03cd", "Eraser": "\u03a3\u03b2\u03c5\u03c3\u03c4\u03ae\u03c1\u03b9", "Erase objects": "\u03a3\u03b2\u03ae\u03c3\u03b9\u03bc\u03bf \u03b1\u03bd\u03c4\u03b9\u03ba\u03b5\u03af\u03bc\u03b5\u03bd\u03b1", "rotated": "\u03c0\u03b5\u03c1\u03b9\u03b5\u03c3\u03c4\u03c1\u03b1\u03bc\u03bc\u03ad\u03bd\u03bf", "flipped": "\u03b3\u03c5\u03c1\u03b9\u03c3\u03bc\u03ad\u03bd\u03bf", "It is not possible to draw on a %s box.": "\u0394\u03b5\u03bd \u03b5\u03af\u03bd\u03b1\u03b9 \u03b4\u03c5\u03bd\u03b1\u03c4\u03cc\u03bd \u03c4\u03bf \u03c3\u03c7\u03b5\u03b4\u03b9\u03b1\u03c3\u03bc\u03cc \u03c3\u03b5 \u03ba\u03bf\u03c5\u03c4\u03af %s.", "Click %s to insert HTML.": "\u039a\u03bb\u03b9\u03ba %s \u03b3\u03b9\u03b1 \u03bd\u03b1 \u03b5\u03b9\u03c3\u03ac\u03b3\u03b5\u03c4\u03b5 \u03ba\u03ce\u03b4\u03b9\u03ba\u03b1 HTML.", "Html": "Html", "Insert HTML": "\u0395\u03b9\u03c3\u03b1\u03b3\u03c9\u03b3\u03ae HTML", "View": "\u03a0\u03c1\u03bf\u03b2\u03bf\u03bb\u03ae", "View box content": "\u03a0\u03c1\u03bf\u03b2\u03bf\u03bb\u03ae \u03c0\u03b5\u03c1\u03b9\u03b5\u03c7\u03bf\u03bc\u03ad\u03bd\u03bf\u03c5", "Insert HTML code:": "\u0395\u03b9\u03c3\u03ac\u03b3\u03b5\u03c4\u03b5 \u03c4\u03bf\u03bd \u03ba\u03c9\u03b4\u03b9\u03ba\u03cc HTML:", "Safe mode:": "\u03a4\u03c1\u03cc\u03c0\u03bf \u03b1\u03c3\u03c6\u03b1\u03bb\u03ae:", "Automatic": "\u0391\u03c5\u03c4\u03cc\u03bc\u03b1\u03c4\u03bf", "Enabled": "\u0395\u03bd\u03b5\u03c1\u03b3\u03bf\u03c0\u03bf\u03b9\u03b7\u03bc\u03ad\u03bd\u03bf", "Disabled": "\u0391\u03c0\u03b5\u03bd\u03b5\u03c1\u03b3\u03bf\u03c0\u03bf\u03b9\u03b7\u03bc\u03ad\u03bd\u03bf", "If you insert Javascript or CSS code and you get unexpected effects (e.g. content overflow, etc.) you need to enable safe mode.": "\u0391\u03bd \u03b5\u03b9\u03c3\u03ac\u03b3\u03b5\u03c4\u03b5 Javascript \u03ae CSS \u03ba\u03ce\u03b4\u03b9\u03ba\u03b1 \u03ba\u03b1\u03b9 \u03ad\u03c7\u03b5\u03c4\u03b5 \u03b1\u03c0\u03c1\u03cc\u03b2\u03bb\u03b5\u03c0\u03c4\u03b5\u03c2 \u03c3\u03c5\u03bd\u03ad\u03c0\u03b5\u03b9\u03b5\u03c2 (\u03c0\u03c7. \u03c5\u03c0\u03b5\u03c1\u03c7\u03b5\u03af\u03bb\u03b9\u03c3\u03b7 \u03c0\u03b5\u03c1\u03b9\u03b5\u03c7\u03bf\u03bc\u03ad\u03bd\u03bf\u03c5, \u03ba\u03bb\u03c0.) \u03b8\u03b1 \u03c0\u03c1\u03ad\u03c0\u03b5\u03b9 \u03bd\u03b1 \u03b5\u03bd\u03b5\u03c1\u03b3\u03bf\u03c0\u03bf\u03b9\u03b7\u03b8\u03b5\u03af \u03c4\u03b7\u03bd \u03bb\u03b5\u03b9\u03c4\u03bf\u03c5\u03c1\u03b3\u03af\u03b1 \"\u03b1\u03c3\u03c6\u03b1\u03bb\u03ae\".", "The (default) automatic setting enables safe mode only if Javascript is detected.": "\u0397 \u03b1\u03c5\u03c4\u03cc\u03bc\u03b1\u03c4\u03b7 \u03c1\u03cd\u03b8\u03bc\u03b9\u03c3\u03b7 (\u03c0\u03c1\u03bf\u03b5\u03c0\u03b9\u03bb\u03b5\u03b3\u03bc\u03ad\u03bd\u03b7) \u03b5\u03bd\u03b5\u03c1\u03b3\u03bf\u03c0\u03bf\u03b9\u03b5\u03af \u03c4\u03bf \u03c4\u03c1\u03cc\u03c0\u03bf \u03b1\u03c3\u03c6\u03b1\u03bb\u03ae \u03bc\u03cc\u03bd\u03bf \u03b5\u03ac\u03bd \u03b2\u03c1\u03b5\u03b8\u03b5\u03af \u03ba\u03ce\u03b4\u03b9\u03ba\u03b1 Javascript.", "Some scripts (for example social network services) need to access the page, so the \"Safe mode\" must be disabled in these cases.": "\u039a\u03ac\u03c0\u03bf\u03b9\u03b1 scripts (\u03c0.\u03c7. \u03c5\u03c0\u03b7\u03c1\u03b5\u03c3\u03af\u03b5\u03c2 \u03ba\u03bf\u03b9\u03bd\u03c9\u03bd\u03b9\u03ba\u03ae\u03c2 \u03b4\u03b9\u03ba\u03c4\u03cd\u03c9\u03c3\u03b7\u03c2) \u03c0\u03c1\u03ad\u03c0\u03b5\u03b9 \u03bd\u03b1 \u03ad\u03c7\u03bf\u03c5\u03bd \u03c0\u03c1\u03cc\u03c3\u03b2\u03b1\u03c3\u03b7 \u03c3\u03c4\u03b7 \u03c3\u03b5\u03bb\u03af\u03b4\u03b1, \u03ad\u03c4\u03c3\u03b9 \u03c4\u03bf \"\u03a4\u03c1\u03cc\u03c0\u03bf \u03b1\u03c3\u03c6\u03b1\u03bb\u03ae\" \u03c0\u03c1\u03ad\u03c0\u03b5\u03b9 \u03bd\u03b1 \u03b1\u03c0\u03b5\u03bd\u03b5\u03c1\u03b3\u03bf\u03c0\u03bf\u03b9\u03b7\u03b8\u03b5\u03af \u03c3\u03b5 \u03b1\u03c5\u03c4\u03ad\u03c2 \u03c4\u03b9\u03c2 \u03c0\u03b5\u03c1\u03b9\u03c0\u03c4\u03ce\u03c3\u03b5\u03b9\u03c2.", "Inserting a %s content into an HTML box is not supported at the moment.": "\u0397 \u03b5\u03b9\u03c3\u03b1\u03b3\u03c9\u03b3\u03ae \u03c0\u03b5\u03c1\u03b9\u03b5\u03c7\u03cc\u03bc\u03b5\u03bd\u03bf %s \u03bc\u03ad\u03c3\u03b1 \u03c3\u03b5 \u03ad\u03bd\u03b1 \u03ba\u03bf\u03c5\u03c4\u03af HTML \u03b4\u03b5\u03bd \u03c5\u03c0\u03bf\u03c3\u03c4\u03b7\u03c1\u03af\u03b6\u03b5\u03c4\u03b1\u03b9 \u03b1\u03c5\u03c4\u03ae \u03c4\u03b7 \u03c3\u03c4\u03b9\u03b3\u03bc\u03ae.", "Filters": "\u03a6\u03af\u03bb\u03c4\u03c1\u03b1", "Apply image filters": "\u0395\u03c6\u03b1\u03c1\u03bc\u03cc\u03c3\u03c4\u03b5 \u03c6\u03af\u03bb\u03c4\u03c1\u03b1 \u03b5\u03b9\u03ba\u03cc\u03bd\u03b1\u03c2", "Adjust colors": "\u03a0\u03c1\u03bf\u03c3\u03b1\u03c1\u03bc\u03bf\u03b3\u03ae \u03c7\u03c1\u03c9\u03bc\u03ac\u03c4\u03c9\u03bd", "Black &amp; white": "\u0391\u03c3\u03c0\u03c1\u03cc\u03bc\u03b1\u03c5\u03c1\u03bf", "Blur": "\u0398\u03bf\u03bb\u03bf\u03cd\u03c1\u03b1", "Brightness": "\u03a6\u03c9\u03c4\u03b5\u03b9\u03bd\u03cc\u03c4\u03b7\u03c4\u03b1", "Contrast": "\u0391\u03bd\u03c4\u03af\u03b8\u03b5\u03c3\u03b7", "Emboss": "\u0391\u03bd\u03ac\u03b3\u03bb\u03c5\u03c6\u03bf", "Grayscale": "\u0391\u03c0\u03bf\u03c7\u03c1\u03ce\u03c3\u03b5\u03b9\u03c2 \u03c4\u03bf\u03c5 \u03b3\u03ba\u03c1\u03b9", "Mosaic": "\u039c\u03c9\u03c3\u03b1\u03ca\u03ba\u03cc", "Motion blur": "\u0398\u03cc\u03bb\u03c9\u03bc\u03b1 \u03ba\u03af\u03bd\u03b7\u03c3\u03b7\u03c2", "Paint": "\u039c\u03c0\u03bf\u03b3\u03b9\u03ac", "Posterize": "\u03a0\u03bf\u03c3\u03c4\u03b5\u03c1\u03bf\u03c0\u03bf\u03af\u03b7\u03c3\u03b7", "Psychedelia": "\u03a8\u03c5\u03c7\u03b5\u03b4\u03ad\u03bb\u03b5\u03b9\u03b1\u03c2", "Sepia": "\u039a\u03b1\u03c3\u03c4\u03b1\u03bd\u03cc\u03c7\u03c1\u03bf\u03c5\u03c2", "Vignette": "\u0392\u03b9\u03bd\u03b9\u03ad\u03c4\u03b1", "Apply filter": "\u0395\u03c6\u03b1\u03c1\u03bc\u03bf\u03b3\u03ae \u03c6\u03af\u03bb\u03c4\u03c1\u03bf\u03c5", "Reset filter": "\u0395\u03c0\u03b1\u03bd\u03b1\u03c6\u03bf\u03c1\u03ac \u03c6\u03af\u03bb\u03c4\u03c1\u03bf\u03c5", "Remove all filters": "\u039a\u03b1\u03c4\u03ac\u03c1\u03b3\u03b7\u03c3\u03b7 \u03cc\u03bb\u03c9\u03bd \u03c4\u03c9\u03bd \u03c6\u03af\u03bb\u03c4\u03c1\u03c9\u03bd", "Error applying filter \"%s\".": "\u03a3\u03c6\u03ac\u03bb\u03bc\u03b1 \u03ba\u03b1\u03c4\u03ac \u03c4\u03b7\u03bd \u03b5\u03c6\u03b1\u03c1\u03bc\u03bf\u03b3\u03ae \u03c4\u03bf\u03c5 \u03c6\u03af\u03bb\u03c4\u03c1\u03bf\u03c5 \"%s\".", "Filter \"%s\" not defined.": "\u03a4\u03bf \u03c6\u03af\u03bb\u03c4\u03c1\u03bf \"%s\" \u03b4\u03b5\u03bd \u03c5\u03c0\u03ac\u03c1\u03c7\u03b5\u03b9.", "Could not read image data. Filters cannot be applied on images hosted on a different domain.": "\u0394\u03b5\u03bd \u03ae\u03c4\u03b1\u03bd \u03b4\u03c5\u03bd\u03b1\u03c4\u03ae \u03b7 \u03b1\u03bd\u03ac\u03b3\u03bd\u03c9\u03c3\u03b7 \u03c4\u03c9\u03bd \u03b4\u03b5\u03b4\u03bf\u03bc\u03ad\u03bd\u03c9\u03bd \u03b5\u03b9\u03ba\u03cc\u03bd\u03b1\u03c2. \u03a4\u03b1 \u03c6\u03af\u03bb\u03c4\u03c1\u03b1 \u03b4\u03b5\u03bd \u03bc\u03c0\u03bf\u03c1\u03bf\u03cd\u03bd \u03bd\u03b1 \u03b5\u03c6\u03b1\u03c1\u03bc\u03bf\u03c3\u03c4\u03bf\u03cd\u03bd \u03c3\u03b5 \u03b5\u03b9\u03ba\u03cc\u03bd\u03b5\u03c2 \u03c0\u03bf\u03c5 \u03b2\u03c1\u03af\u03c3\u03ba\u03bf\u03bd\u03c4\u03b1\u03b9 \u03c3\u03b5 \u03b4\u03b9\u03b1\u03c6\u03bf\u03c1\u03b5\u03c4\u03b9\u03ba\u03cc domain.", "Percent": "\u03a4\u03bf\u03b9\u03c2 \u03b5\u03ba\u03b1\u03c4\u03cc", "Adjustment": "\u03a0\u03c1\u03bf\u03c3\u03b1\u03c1\u03bc\u03bf\u03b3\u03ae", "Threshold": "\u038c\u03c1\u03b9\u03bf", "Red": "\u039a\u03cc\u03ba\u03ba\u03b9\u03bd\u03bf", "Green": "\u03a0\u03c1\u03ac\u03c3\u03b9\u03bd\u03bf\u03c2", "Blue": "\u039c\u03c0\u03bb\u03b5", "Amount": "\u03a0\u03bf\u03c3\u03cc", "Block size": "\u039c\u03ad\u03b3\u03b5\u03b8\u03bf\u03c2 \u03c4\u03bc\u03ae\u03bc\u03b1\u03c4\u03bf\u03c2", "Type": "\u03a4\u03cd\u03c0\u03bf", "Strength": "\u0394\u03cd\u03bd\u03b1\u03bc\u03b7", "Brush size": "\u039c\u03ad\u03b3\u03b5\u03b8\u03bf\u03c2 \u03c4\u03bf\u03c5 \u03c0\u03b9\u03bd\u03ad\u03bb\u03bf\u03c5", "Link": "\u0394\u03b5\u03c3\u03bc\u03cc\u03c2", "Add link to box": "\u03a0\u03c1\u03bf\u03c3\u03b8\u03ae\u03ba\u03b7 \u03b4\u03b5\u03c3\u03bc\u03bf\u03cd \u03c3\u03c4\u03bf \u03ba\u03bf\u03c5\u03c4\u03af", "This link will be associated to the whole box.": "\u0391\u03c5\u03c4\u03cc\u03c2 \u03bf \u03b4\u03b5\u03c3\u03bc\u03cc\u03c2 \u03b8\u03b1 \u03c3\u03c5\u03bd\u03b4\u03ad\u03b5\u03c4\u03b1\u03b9 \u03bc\u03b5 \u03cc\u03bb\u03bf \u03c4\u03bf \u03ba\u03bf\u03c5\u03c4\u03af.", "Insert link url:": "\u0395\u03b9\u03c3\u03b1\u03b3\u03c9\u03b3\u03ae \u03b4\u03b5\u03c3\u03bc\u03cc\u03c2 (URL):", "Align": "\u0395\u03c5\u03b8\u03c5\u03b3\u03c1\u03ac\u03bc\u03bc\u03b9\u03c3\u03b7", "Align to page": "\u0395\u03c5\u03b8\u03c5\u03b3\u03c1\u03ac\u03bc\u03bc\u03b9\u03c3\u03b7 \u03c3\u03c4\u03b7 \u03c3\u03b5\u03bb\u03af\u03b4\u03b1", "Left": "\u0391\u03c1\u03b9\u03c3\u03c4\u03b5\u03c1\u03ac", "Center": "\u039a\u03ad\u03bd\u03c4\u03c1\u03bf", "Right": "\u0394\u03b5\u03be\u03b9\u03ac", "Top": "\u03a0\u03ac\u03bd\u03bf", "Middle": "\u039c\u03ad\u03c3\u03bf", "Bottom": "\u039a\u03ac\u03c4\u03c9", "Fit width": "\u03a0\u03c1\u03bf\u03c3\u03b1\u03c1\u03bc\u03bf\u03b3\u03ae \u03c0\u03bb\u03ac\u03c4\u03bf\u03c2", "Fit height": "\u03a0\u03c1\u03bf\u03c3\u03b1\u03c1\u03bc\u03bf\u03b3\u03ae \u03cd\u03c8\u03bf\u03c2", "Position and size": "\u0398\u03ad\u03c3\u03b7 \u03ba\u03b1\u03b9 \u03bc\u03ad\u03b3\u03b5\u03b8\u03bf\u03c2", "Set box position %s.": "\u039f\u03c1\u03b9\u03c3\u03bc\u03cc\u03c2 \u03b8\u03ad\u03c3\u03b7\u03c2 \u03ba\u03bf\u03c5\u03c4\u03b9\u03bf\u03cd % s.", "W:": "\u03a0:", "H:": "\u03a5:", "Set box width": "\u0395\u03c0\u03b9\u03bb\u03ad\u03be\u03c4\u03b5 \u03c4\u03bf \u03c0\u03bb\u03ac\u03c4\u03bf\u03c2 \u03c4\u03bf\u03c5 \u03ba\u03bf\u03c5\u03c4\u03b9\u03bf\u03cd", "Set box height": "\u0395\u03c0\u03b9\u03bb\u03ad\u03be\u03c4\u03b5 \u03c4\u03bf \u03cd\u03c8\u03bf\u03c2 \u03c4\u03bf\u03c5 \u03ba\u03bf\u03c5\u03c4\u03b9\u03bf\u03cd", "Keep aspect ratio": "\u0394\u03b9\u03b1\u03c4\u03ae\u03c1\u03b7\u03c3\u03b7 \u03b1\u03bd\u03b1\u03bb\u03bf\u03b3\u03af\u03b1\u03c2", "Select box padding": "\u0395\u03c0\u03b9\u03bb\u03ad\u03be\u03c4\u03b5 \u03c4\u03b7\u03bd \u03b1\u03c0\u03cc\u03c3\u03c4\u03b1\u03c3\u03b7 \u03ba\u03bf\u03c5\u03c4\u03b9\u03bf\u03cd", "Padding": "\u0391\u03c0\u03cc\u03c3\u03c4\u03b1\u03c3\u03b7", "Shadow": "\u03a3\u03ba\u03b9\u03ac", "Predefined": "\u03a0\u03c1\u03bf\u03ba\u03b1\u03b8\u03bf\u03c1\u03b9\u03c3\u03bc\u03ad\u03bd\u03b1", "Select predefined shadow": "\u0395\u03c0\u03b9\u03bb\u03ad\u03be\u03c4\u03b5 \u03c0\u03c1\u03bf\u03ba\u03b1\u03b8\u03bf\u03c1\u03b9\u03c3\u03bc\u03ad\u03bd\u03b5\u03c2 \u03c3\u03ba\u03b9\u03ad\u03c2", "No shadow": "\u03a7\u03c9\u03c1\u03af\u03c2 \u03c3\u03ba\u03b9\u03ac", "Shadow at bottom right": "\u03a3\u03ba\u03b9\u03ac \u03ba\u03ac\u03c4\u03c9 \u03b4\u03b5\u03be\u03b9\u03ac", "Shadow at bottom left": "\u03a3\u03ba\u03b9\u03ac \u03ba\u03ac\u03c4\u03c9 \u03b1\u03c1\u03b9\u03c3\u03c4\u03b5\u03c1\u03ac", "Shadow at top right": "\u03a3\u03ba\u03b9\u03ac \u03c0\u03ac\u03bd\u03c9 \u03b4\u03b5\u03be\u03b9\u03ac", "Shadow at top left": "\u03a3\u03ba\u03b9\u03ac \u03c0\u03ac\u03bd\u03c9 \u03b1\u03c1\u03b9\u03c3\u03c4\u03b5\u03c1\u03ac", "Diffuse shadow": "\u0394\u03b9\u03ac\u03c7\u03c5\u03c4\u03b7 \u03c3\u03ba\u03b9\u03ac", "Select shadow color": "\u0395\u03c0\u03b9\u03bb\u03ad\u03be\u03c4\u03b5 \u03c4\u03bf \u03c7\u03c1\u03ce\u03bc\u03b1 \u03c3\u03ba\u03b9\u03ac\u03c2", "Box shadow": "\u03a3\u03ba\u03b9\u03ac \u03ba\u03bf\u03c5\u03c4\u03b9\u03bf\u03cd", "Horizontal position": "\u039f\u03c1\u03b9\u03b6\u03cc\u03bd\u03c4\u03b9\u03b1", "Select shadow horizontal position": "\u0395\u03c0\u03b9\u03bb\u03ad\u03be\u03c4\u03b5 \u03bf\u03c1\u03b9\u03b6\u03cc\u03bd\u03c4\u03b9\u03b1 \u03b8\u03ad\u03c3\u03b7 \u03c3\u03ba\u03b9\u03ac\u03c2", "Vertical position": "\u039a\u03b1\u03c4\u03b1\u03ba\u03cc\u03c1\u03c5\u03c6\u03b1", "Select shadow vertical position": "\u0395\u03c0\u03b9\u03bb\u03ad\u03be\u03c4\u03b5 \u03ba\u03ac\u03b8\u03b5\u03c4\u03b7 \u03b8\u03ad\u03c3\u03b7 \u03c3\u03ba\u03b9\u03ac\u03c2", "Select shadow blur": "\u0395\u03c0\u03b9\u03bb\u03ad\u03be\u03c4\u03b5 \u03c4\u03b7\u03bd \u03b8\u03bf\u03bb\u03bf\u03cd\u03c1\u03b1 \u03c3\u03ba\u03b9\u03ac\u03c2", "Spread": "\u0395\u03be\u03ac\u03c0\u03bb\u03c9\u03c3\u03b7", "Select shadow spread": "\u0395\u03c0\u03b9\u03bb\u03ad\u03be\u03c4\u03b5 \u03c4\u03b7\u03bd \u03b5\u03be\u03ac\u03c0\u03bb\u03c9\u03c3\u03b7 \u03c3\u03ba\u03b9\u03ac\u03c2", "Inset": "\u0395\u03c3\u03c9\u03c4\u03b5\u03c1\u03b9\u03ba\u03ae", "Shadow inset": "\u0395\u03c3\u03c9\u03c4\u03b5\u03c1\u03b9\u03ba\u03ae \u03c3\u03ba\u03b9\u03ac", "Text": "\u039a\u03b5\u03af\u03bc\u03b5\u03bd\u03bf", "Paragraph": "\u03a0\u03b1\u03c1\u03ac\u03b3\u03c1\u03b1\u03c6\u03bf\u03c2", "Select paragraph": "\u0395\u03c0\u03b9\u03bb\u03ad\u03be\u03c4\u03b5 \u03c0\u03b1\u03c1\u03ac\u03b3\u03c1\u03b1\u03c6\u03bf", "Heading": "\u0395\u03c0\u03b9\u03ba\u03b5\u03c6\u03b1\u03bb\u03af\u03b4\u03b1", "Align left": "\u0395\u03c5\u03b8\u03c5\u03b3\u03c1\u03ac\u03bc\u03bc\u03b9\u03c3\u03b7 \u03b1\u03c1\u03b9\u03c3\u03c4\u03b5\u03c1\u03ac", "Align center": "\u0395\u03c5\u03b8\u03c5\u03b3\u03c1\u03ac\u03bc\u03bc\u03b9\u03c3\u03b7 \u03ba\u03ad\u03bd\u03c4\u03c1\u03bf", "Align right": "\u0395\u03c5\u03b8\u03c5\u03b3\u03c1\u03ac\u03bc\u03bc\u03b9\u03c3\u03b7 \u03b4\u03b5\u03be\u03b9\u03ac", "Justify": "\u039f\u03bc\u03bf\u03b9\u03cc\u03bc\u03bf\u03c1\u03c6\u03b7", "Select line height": "\u0395\u03c0\u03b9\u03bb\u03ad\u03be\u03c4\u03b5 \u03cd\u03c8\u03bf\u03c2 \u03b3\u03c1\u03b1\u03bc\u03bc\u03ae\u03c2", "Ordered list": "\u039b\u03af\u03c3\u03c4\u03b1 \u03bc\u03b5 \u03b1\u03c1\u03b9\u03b8\u03bc\u03bf\u03cd\u03c2", "Unordered list": "\u039b\u03af\u03c3\u03c4\u03b1 \u03bc\u03b5 \u03ba\u03bf\u03c5\u03ba\u03af\u03b4\u03b5\u03c2", "Select paragraph spacing": "\u0395\u03c0\u03b9\u03bb\u03ad\u03be\u03c4\u03b5 \u03b1\u03c0\u03cc\u03c3\u03c4\u03b1\u03c3\u03b7 \u03c0\u03b1\u03c1\u03ac\u03b3\u03c1\u03b1\u03c6\u03bf", "Indent": "\u0391\u03cd\u03be\u03b7\u03c3\u03b7 \u03b5\u03c3\u03bf\u03c7\u03ae\u03c2", "Outdent": "\u039c\u03b5\u03af\u03c9\u03c3\u03b7 \u03b5\u03c3\u03bf\u03c7\u03ae\u03c2", "Subscript": "\u0394\u03b5\u03af\u03ba\u03c4\u03b7\u03c2", "Superscript": "\u0395\u03ba\u03b8\u03ad\u03c4\u03b7\u03c2", "Open link in the same frame.": "\u0386\u03bd\u03bf\u03b9\u03b3\u03bc\u03b1 \u03b4\u03b5\u03c3\u03bc\u03bf\u03cd \u03c3\u03c4\u03bf \u03af\u03b4\u03b9\u03bf \u03c0\u03bb\u03b1\u03af\u03c3\u03b9\u03bf.", "Open link in the same tab.": "\u0386\u03bd\u03bf\u03b9\u03b3\u03bc\u03b1 \u03b4\u03b5\u03c3\u03bc\u03bf\u03cd \u03c3\u03c4\u03b7\u03bd \u03af\u03b4\u03b9\u03b1 \u03ba\u03b1\u03c1\u03c4\u03ad\u03bb\u03b1.", "Open link in a new tab.": "\u0386\u03bd\u03bf\u03b9\u03b3\u03bc\u03b1 \u03b4\u03b5\u03c3\u03bc\u03bf\u03cd \u03c3\u03b5 \u03bd\u03ad\u03b1 \u03ba\u03b1\u03c1\u03c4\u03ad\u03bb\u03b1.", "Link style preview": "\u03a0\u03c1\u03bf\u03b5\u03c0\u03b9\u03c3\u03ba\u03cc\u03c0\u03b7\u03c3\u03b7 \u03c3\u03c4\u03c5\u03bb \u03c4\u03bf\u03c5 \u03b4\u03b5\u03c3\u03bc\u03bf\u03cd", "Link style": "\u03a3\u03c4\u03c5\u03bb \u03c4\u03bf\u03c5 \u03b4\u03b5\u03c3\u03bc\u03bf\u03cd", "Link style on mouse over": "\u03a3\u03c4\u03c5\u03bb \u03c4\u03bf\u03c5 \u03b4\u03b5\u03c3\u03bc\u03bf\u03cd \u03bc\u03b5 \u03c4\u03bf \u03c0\u03bf\u03bd\u03c4\u03af\u03ba\u03b9 \u03c0\u03ac\u03bd\u03c9", "Insert link": "\u0395\u03b9\u03c3\u03b1\u03b3\u03c9\u03b3\u03ae \u03b4\u03b5\u03c3\u03bc\u03cc\u03c2", "Remove": "\u039a\u03b1\u03c4\u03ac\u03c1\u03b3\u03b7\u03c3\u03b7", "The box link may override any link in the text.": "\u039f \u03b4\u03b5\u03c3\u03bc\u03cc\u03c2 \u03c3\u03c4\u03bf \u03ba\u03bf\u03c5\u03c4\u03af \u03bc\u03c0\u03bf\u03c1\u03b5\u03af \u03bd\u03b1 \u03c5\u03c0\u03b5\u03c1\u03b9\u03c3\u03c7\u03cd\u03c3\u03b5\u03b9 \u03bf\u03c0\u03bf\u03b9\u03bf\u03c5\u03b4\u03ae\u03c0\u03bf\u03c4\u03b5 \u03b4\u03b5\u03c3\u03bc\u03cc \u03c3\u03c4\u03bf \u03ba\u03b5\u03af\u03bc\u03b5\u03bd\u03bf.", "Align top": "\u0395\u03c5\u03b8\u03c5\u03b3\u03c1\u03ac\u03bc\u03bc\u03b9\u03c3\u03b7 \u03c0\u03ac\u03bd\u03bf", "Align middle": "\u0395\u03c5\u03b8\u03c5\u03b3\u03c1\u03ac\u03bc\u03bc\u03b9\u03c3\u03b7 \u03bc\u03ad\u03c3\u03bf", "Align bottom": "\u0395\u03c5\u03b8\u03c5\u03b3\u03c1\u03ac\u03bc\u03bc\u03b9\u03c3\u03b7 \u03ba\u03ac\u03c4\u03c9", "Extra small layout": "\u03a0\u03bf\u03bb\u03cd \u03bc\u03b9\u03ba\u03c1\u03ae \u03b4\u03b9\u03ac\u03c4\u03b1\u03be\u03b7", "Small layout": "\u039c\u03b9\u03ba\u03c1\u03ae \u03b4\u03b9\u03ac\u03c4\u03b1\u03be\u03b7", "Medium layout": "\u039c\u03b5\u03c3\u03b1\u03af\u03b1 \u03b4\u03b9\u03ac\u03c4\u03b1\u03be\u03b7", "Large layout": "\u039c\u03b5\u03b3\u03ac\u03bb\u03b7 \u03b4\u03b9\u03ac\u03c4\u03b1\u03be\u03b7", "If you perform this action you will revert to a non-responsive design. Are you sure?": "\u0395\u03ac\u03bd \u03b5\u03ba\u03c4\u03b5\u03bb\u03ad\u03c3\u03b5\u03c4\u03b5 \u03b1\u03c5\u03c4\u03ae \u03c4\u03b7\u03bd \u03b5\u03bd\u03ad\u03c1\u03b3\u03b5\u03b9\u03b1, \u03b8\u03b1 \u03b5\u03c0\u03b1\u03bd\u03ad\u03bb\u03b8\u03b5\u03b9 \u03c3\u03b5 \u03bc\u03b9\u03b1 \u03ba\u03b1\u03c4\u03ac\u03c3\u03c4\u03b1\u03c3\u03b7 \u03c3\u03c7\u03b5\u03b4\u03b9\u03b1\u03c3\u03bc\u03bf\u03cd \u03bc\u03b7 responsive. \u0395\u03af\u03c3\u03c4\u03b5 \u03c3\u03af\u03b3\u03bf\u03c5\u03c1\u03bf\u03c2;", "You can start your design from any layout.": "\u039c\u03c0\u03bf\u03c1\u03b5\u03af\u03c4\u03b5 \u03bd\u03b1 \u03be\u03b5\u03ba\u03b9\u03bd\u03ae\u03c3\u03b5\u03c4\u03b5 \u03c4\u03bf \u03c3\u03c7\u03b5\u03b4\u03b9\u03b1\u03c3\u03bc\u03cc \u03c3\u03b1\u03c2 \u03b1\u03c0\u03cc \u03bf\u03c0\u03bf\u03b9\u03b1\u03b4\u03ae\u03c0\u03bf\u03c4\u03b5 \u03b4\u03b9\u03ac\u03c4\u03b1\u03be\u03b7.", "Boxes can be added in any layout and can be modified only in the layout they were added to.": "\u03a4\u03b1 \u03ba\u03bf\u03c5\u03c4\u03b9\u03ac \u03bc\u03c0\u03bf\u03c1\u03bf\u03cd\u03bd \u03bd\u03b1 \u03c0\u03c1\u03bf\u03c3\u03c4\u03b5\u03b8\u03bf\u03cd\u03bd \u03c3\u03b5 \u03bf\u03c0\u03bf\u03b9\u03b1\u03b4\u03ae\u03c0\u03bf\u03c4\u03b5 \u03b4\u03b9\u03ac\u03c4\u03b1\u03be\u03b7 \u03ba\u03b1\u03b9 \u03bc\u03c0\u03bf\u03c1\u03bf\u03cd\u03bd \u03bd\u03b1 \u03c4\u03c1\u03bf\u03c0\u03bf\u03c0\u03bf\u03b9\u03b7\u03b8\u03bf\u03cd\u03bd \u03bc\u03cc\u03bd\u03bf \u03c3\u03c4\u03b7 \u03b4\u03b9\u03ac\u03c4\u03b1\u03be\u03b7 \u03c0\u03bf\u03c5 \u03b4\u03b7\u03bc\u03b9\u03bf\u03c5\u03c1\u03b3\u03ae\u03b8\u03b7\u03ba\u03b1\u03bd.", "Boxes added in a layout can be hidden in other layouts.": "\u03a4\u03b1 \u03ba\u03bf\u03c5\u03c4\u03b9\u03ac \u03c0\u03bf\u03c5 \u03c0\u03c1\u03bf\u03c3\u03c4\u03ad\u03b8\u03b7\u03ba\u03b1\u03bd \u03c3\u03b5 \u03bc\u03b9\u03b1 \u03b4\u03b9\u03ac\u03c4\u03b1\u03be\u03b7 \u03bc\u03c0\u03bf\u03c1\u03b5\u03af \u03bd\u03b1 \u03ba\u03c1\u03cd\u03b2\u03bf\u03bd\u03c4\u03b1\u03b9 \u03c3\u03b5 \u03ac\u03bb\u03bb\u03b5\u03c2 \u03b4\u03b9\u03b1\u03c4\u03ac\u03be\u03b5\u03b9\u03c2.", "Custom layouts:": "\u03a0\u03c1\u03bf\u03c3\u03b1\u03c1\u03bc\u03bf\u03c3\u03bc\u03ad\u03bd\u03b5\u03c2 \u03b4\u03b9\u03b1\u03c4\u03ac\u03be\u03b5\u03b9\u03c2:", "Add custom layout": "\u03a0\u03c1\u03bf\u03c3\u03b8\u03ae\u03ba\u03b7 \u03c0\u03c1\u03bf\u03c3\u03b1\u03c1\u03bc\u03bf\u03c3\u03bc\u03ad\u03bd\u03b7\u03c2 \u03b4\u03b9\u03ac\u03c4\u03b1\u03be\u03b7\u03c2", "Multiple layout responsive design": "\u03a3\u03c7\u03b5\u03b4\u03b9\u03b1\u03c3\u03bc\u03bf\u03cd responsive \u03bc\u03b5 \u03c0\u03bf\u03bb\u03bb\u03b1\u03c0\u03bb\u03ad\u03c2 \u03b4\u03b9\u03ac\u03c4\u03b1\u03be\u03b7\u03c2", "The width of custom layouts can be adjusted to fit larger designs.": "\u03a4\u03bf \u03c0\u03bb\u03ac\u03c4\u03bf\u03c2 \u03c4\u03c9\u03bd \u03c0\u03c1\u03bf\u03c3\u03b1\u03c1\u03bc\u03bf\u03c3\u03bc\u03ad\u03bd\u03c9\u03bd \u03b4\u03b9\u03b1\u03c4\u03ac\u03be\u03b5\u03c9\u03bd \u03bc\u03c0\u03bf\u03c1\u03b5\u03af \u03bd\u03b1 \u03c0\u03c1\u03bf\u03c3\u03b1\u03c1\u03bc\u03bf\u03c3\u03c4\u03b5\u03af \u03b3\u03b9\u03b1 \u03bd\u03b1 \u03c4\u03b1\u03b9\u03c1\u03b9\u03ac\u03b6\u03b5\u03b9 \u03bc\u03b5\u03b3\u03b1\u03bb\u03cd\u03c4\u03b5\u03c1\u03b1 \u03c3\u03c7\u03ad\u03b4\u03b9\u03b1.", "Click on a layout button to start creating content for that layout.": "\u039a\u03ac\u03bd\u03c4\u03b5 \u03ba\u03bb\u03b9\u03ba \u03c3\u03b5 \u03ad\u03bd\u03b1 \u03ba\u03bf\u03c5\u03bc\u03c0\u03af  \u03b3\u03b9\u03b1 \u03bd\u03b1 \u03be\u03b5\u03ba\u03b9\u03bd\u03ae\u03c3\u03b5\u03b9 \u03b7 \u03b4\u03b7\u03bc\u03b9\u03bf\u03c5\u03c1\u03b3\u03af\u03b1 \u03c0\u03b5\u03c1\u03b9\u03b5\u03c7\u03bf\u03bc\u03ad\u03bd\u03bf\u03c5 \u03b3\u03b9\u03b1 \u03c4\u03b7 \u03b4\u03b9\u03ac\u03c4\u03b1\u03be\u03b7.", "Save": "\u0391\u03c0\u03bf\u03b8\u03ae\u03ba\u03b5\u03c5\u03c3\u03b7", "Abort": "\u0394\u03b9\u03b1\u03ba\u03bf\u03c0\u03ae", "You may want to review the design for layouts in yellow.": "\u039c\u03c0\u03bf\u03c1\u03b5\u03af \u03bd\u03b1 \u03b8\u03ad\u03bb\u03b5\u03c4\u03b5 \u03bd\u03b1 \u03b5\u03bb\u03ad\u03b3\u03be\u03b5\u03c4\u03b5 \u03c4\u03bf \u03c3\u03c7\u03b5\u03b4\u03b9\u03b1\u03c3\u03bc\u03cc \u03b3\u03b9\u03b1 \u03c4\u03b9\u03c2 \u03b4\u03b9\u03b1\u03c4\u03ac\u03be\u03b5\u03b9\u03c2 \u03c3\u03b5 \u03ba\u03af\u03c4\u03c1\u03b9\u03bd\u03bf.", "Save without reviewing": "\u0391\u03c0\u03bf\u03b8\u03ae\u03ba\u03b5\u03c5\u03c3\u03b7 \u03c7\u03c9\u03c1\u03af\u03c2 \u03ad\u03bb\u03b5\u03b3\u03c7\u03bf", "Please click on the layouts in gray to provide the design for all layouts.": "\u03a0\u03b1\u03c1\u03b1\u03ba\u03b1\u03bb\u03bf\u03cd\u03bc\u03b5 \u03ba\u03ac\u03bd\u03c4\u03b5 \u03ba\u03bb\u03b9\u03ba \u03c3\u03c4\u03b9\u03c2 \u03b4\u03b9\u03b1\u03c4\u03ac\u03be\u03b5\u03b9\u03c2 \u03c3\u03b5 \u03b3\u03ba\u03c1\u03b9 \u03c7\u03c1\u03ce\u03bc\u03b1 \u03b3\u03b9\u03b1 \u03bd\u03b1 \u03b4\u03b7\u03bc\u03b9\u03bf\u03c5\u03c1\u03b3\u03ae\u03c3\u03b5\u03c4\u03b5 \u03c4\u03bf \u03c3\u03c7\u03b5\u03b4\u03b9\u03b1\u03c3\u03bc\u03cc \u03b3\u03b9\u03b1 \u03cc\u03bb\u03b5\u03c2 \u03c4\u03b9\u03c2 \u03b4\u03b9\u03b1\u03c4\u03ac\u03be\u03b5\u03b9\u03c2.", "Save anyway (not recommended)": "\u0391\u03c0\u03bf\u03b8\u03ae\u03ba\u03b5\u03c5\u03c3\u03b7 \u03bf\u03cd\u03c4\u03c9\u03c2 \u03ae \u03ac\u03bb\u03bb\u03c9\u03c2 (\u03b4\u03b5\u03bd \u03c3\u03c5\u03bd\u03b9\u03c3\u03c4\u03ac\u03c4\u03b1\u03b9)", "Your responsive content is ready to be saved!": "\u03a4\u03bf \u03c0\u03b5\u03c1\u03b9\u03b5\u03c7\u03cc\u03bc\u03b5\u03bd\u03bf responsive \u03c3\u03b1\u03c2 \u03b5\u03af\u03bd\u03b1\u03b9 \u03ad\u03c4\u03bf\u03b9\u03bc\u03bf \u03b3\u03b9\u03b1 a\u03c0\u03bf\u03b8\u03ae\u03ba\u03b5\u03c5\u03c3\u03b7!", "This box was created in another layout.": "\u0391\u03c5\u03c4\u03cc \u03c4\u03bf \u03ba\u03bf\u03c5\u03c4\u03af \u03b4\u03b7\u03bc\u03b9\u03bf\u03c5\u03c1\u03b3\u03ae\u03b8\u03b7\u03ba\u03b5 \u03c3\u03b5 \u03ac\u03bb\u03bb\u03b7 \u03b4\u03b9\u03ac\u03c4\u03b1\u03be\u03b7.", "To modify its content edit the layout \"%s\".": "\u0393\u03b9\u03b1 \u03bd\u03b1 \u03c4\u03c1\u03bf\u03c0\u03bf\u03c0\u03bf\u03b9\u03ae\u03c3\u03b5\u03c4\u03b5 \u03c4\u03bf \u03c0\u03b5\u03c1\u03b9\u03b5\u03c7\u03cc\u03bc\u03b5\u03bd\u03bf \u03b5\u03c0\u03b5\u03be\u03b5\u03c1\u03b3\u03b1\u03c3\u03c4\u03b5\u03af\u03c4\u03b5 \u03c4\u03b7 \u03b4\u03b9\u03ac\u03c4\u03b1\u03be\u03b7 \"%s\".", "The box is hidden in this layout.": "\u03a4\u03bf \u03ba\u03bf\u03c5\u03c4\u03af \u03b5\u03af\u03bd\u03b1\u03b9 \u03ba\u03c1\u03c5\u03bc\u03bc\u03ad\u03bd\u03bf \u03c3\u03b5 \u03b1\u03c5\u03c4\u03ae \u03c4\u03b7 \u03b4\u03b9\u03ac\u03c4\u03b1\u03be\u03b7.", "Show box": "\u0395\u03bc\u03c6\u03ac\u03bd\u03b9\u03c3\u03b7 \u03ba\u03bf\u03c5\u03c4\u03b9\u03bf\u03cd", "Responsive": "Responsive", "Start %s": "\u0388\u03bd\u03b1\u03c1\u03be\u03b7 %s", "Save \"%s\"": "\u0391\u03c0\u03bf\u03b8\u03ae\u03ba\u03b5\u03c5\u03c3\u03b7 \"%s\"", "Edit box": "\u0395\u03c0\u03b5\u03be\u03b5\u03c1\u03b3\u03b1\u03c3\u03af\u03b1 \u03ba\u03bf\u03c5\u03c4\u03af", "Layout": "\u0394\u03b9\u03ac\u03c4\u03b1\u03be\u03b7", "Show": "\u0395\u03bc\u03c6\u03ac\u03bd\u03b9\u03c3\u03b7", "Show box in this layout": "\u0395\u03bc\u03c6\u03ac\u03bd\u03b9\u03c3\u03b7 \u03ba\u03bf\u03c5\u03c4\u03b9\u03bf\u03cd \u03c3\u03b5 \u03b1\u03c5\u03c4\u03ae \u03c4\u03b7 \u03b4\u03b9\u03ac\u03c4\u03b1\u03be\u03b7", "Hide": "\u0391\u03c0\u03cc\u03ba\u03c1\u03c5\u03c8\u03b7", "Hide box in this layout": "\u0391\u03c0\u03cc\u03ba\u03c1\u03c5\u03c8\u03b7 \u03ba\u03bf\u03c5\u03c4\u03b9\u03bf\u03cd \u03c3\u03b5 \u03b1\u03c5\u03c4\u03ae \u03c4\u03b7 \u03b4\u03b9\u03ac\u03c4\u03b1\u03be\u03b7", "Box style": "\u03a3\u03c4\u03c5\u03bb \u03c4\u03bf\u03c5 \u03ba\u03bf\u03c5\u03c4\u03b9\u03bf\u03cd", "This link will be associated to the whole %s content.": "\u0391\u03c5\u03c4\u03cc\u03c2 \u03bf \u03b4\u03b5\u03c3\u03bc\u03cc\u03c2 \u03b8\u03b1 \u03c3\u03c5\u03bd\u03b4\u03ad\u03b5\u03c4\u03b1\u03b9 \u03bc\u03b5 \u03cc\u03bb\u03bf \u03c4\u03bf \u03c0\u03b5\u03c1\u03b9\u03b5\u03c7\u03cc\u03bc\u03b5\u03bd\u03bf %s.", "This is useful to create all clickable contents, like banners, etc. If you need to create a textual link, instead, enter the \"boxes\" menu.": "\u0391\u03c5\u03c4\u03cc \u03b5\u03af\u03bd\u03b1\u03b9 \u03c7\u03c1\u03ae\u03c3\u03b9\u03bc\u03bf \u03b3\u03b9\u03b1 \u03c4\u03b7 \u03b4\u03b7\u03bc\u03b9\u03bf\u03c5\u03c1\u03b3\u03af\u03b1 \u03ad\u03bd\u03b1\u03c2 \u03b4\u03b5\u03c3\u03bc\u03cc\u03c2 \u03c3\u03b5 \u03bf\u03bb\u03cc\u03ba\u03bb\u03b9\u03c1\u03bf \u03c0\u03b5\u03c1\u03b9\u03b5\u03c7\u03cc\u03bc\u03b5\u03bd\u03bf, \u03cc\u03c0\u03c9\u03c2 banners, \u03ba\u03bb\u03c0. \u0395\u03ac\u03bd \u03c7\u03c1\u03b5\u03b9\u03ac\u03b6\u03b5\u03c4\u03b1\u03b9 \u03bd\u03b1 \u03b4\u03b7\u03bc\u03b9\u03bf\u03c5\u03c1\u03b3\u03ae\u03c3\u03b5\u03c4\u03b5 \u03ad\u03bd\u03b1 \u03b4\u03b5\u03c3\u03bc\u03cc \u03ba\u03b5\u03b9\u03bc\u03ad\u03bd\u03bf\u03c5, \u03bc\u03c0\u03b5\u03af\u03c4\u03b5 \u03c3\u03c4\u03bf \u03bc\u03b5\u03bd\u03bf\u03cd \"\u03ba\u03bf\u03c5\u03c4\u03b9\u03ac \".", "Snap": "\u03a3\u03c5\u03b3\u03ba\u03c1\u03ac\u03c4\u03b7\u03c3\u03b7", "Snap boxes to page": "\u03a3\u03c5\u03b3\u03ba\u03c1\u03ac\u03c4\u03b7\u03c3\u03b7 \u03ba\u03bf\u03c5\u03c4\u03b9\u03ac \u03c3\u03c4\u03b7 \u03c3\u03b5\u03bb\u03af\u03b4\u03b1", "Snap boxes to boxes": "\u03a3\u03c5\u03b3\u03ba\u03c1\u03ac\u03c4\u03b7\u03c3\u03b7 \u03ba\u03bf\u03c5\u03c4\u03b9\u03ac \u03c3\u03b5 \u03ba\u03bf\u03c5\u03c4\u03b9\u03ac", "Snap boxes to grid": "\u03a3\u03c5\u03b3\u03ba\u03c1\u03ac\u03c4\u03b7\u03c3\u03b7 \u03ba\u03bf\u03c5\u03c4\u03b9\u03ac \u03c3\u03c4\u03bf \u03c0\u03bb\u03ad\u03b3\u03bc\u03b1", "Grid": "\u03a0\u03bb\u03ad\u03b3\u03bc\u03b1", "Width:": "\u03a0\u03bb\u03ac\u03c4\u03bf\u03c2:", "Set grid width": "\u0395\u03c0\u03b9\u03bb\u03ad\u03be\u03c4\u03b5 \u03c4\u03bf \u03c0\u03bb\u03ac\u03c4\u03bf\u03c2 \u03c4\u03bf\u03c5 \u03c0\u03bb\u03ad\u03b3\u03bc\u03b1\u03c4\u03bf\u03c2", "Height:": "\u038e\u03c8\u03bf\u03c2:", "Set grid height": "\u0395\u03c0\u03b9\u03bb\u03ad\u03be\u03c4\u03b5 \u03c4\u03bf \u03cd\u03c0\u03c3\u03bf\u03c2 \u03c4\u03bf\u03c5 \u03c0\u03bb\u03ad\u03b3\u03bc\u03b1\u03c4\u03bf\u03c2", "Lock width and height": "\u039a\u03bb\u03b5\u03af\u03b4\u03c9\u03bc\u03b1 \u03c0\u03bb\u03ac\u03c4\u03bf\u03c5\u03c2 \u03ba\u03b1\u03b9 \u03cd\u03c8\u03bf\u03c5\u03c2", "Templates": "\u03a0\u03c1\u03cc\u03c4\u03c5\u03c0\u03b1", "New Template": "\u039d\u03ad\u03bf \u03a0\u03c1\u03cc\u03c4\u03c5\u03c0\u03bf", "Save current content as Template": "\u0391\u03c0\u03bf\u03b8\u03b7\u03ba\u03b5\u03cd\u03c3\u03c4\u03b5 \u03c4\u03bf \u03c4\u03c1\u03ad\u03c7\u03bf\u03bd \u03c0\u03b5\u03c1\u03b9\u03b5\u03c7\u03cc\u03bc\u03b5\u03bd\u03bf \u03c9\u03c2 \u03a0\u03c1\u03cc\u03c4\u03c5\u03c0\u03bf", "Load selected Template into editor": "\u03a6\u03bf\u03c1\u03c4\u03ce\u03c3\u03c4\u03b5 \u03c4\u03bf \u03b5\u03c0\u03b9\u03bb\u03b5\u03b3\u03bc\u03ad\u03bd\u03bf \u03a0\u03c1\u03cc\u03c4\u03c5\u03c0\u03bf \u03c3\u03c4\u03bf editor", "Load": "\u03a6\u03cc\u03c1\u03c4\u03c9\u03c3\u03b7", "Delete selected Template": "\u0394\u03b9\u03b1\u03b3\u03c1\u03b1\u03c6\u03ae \u03b5\u03c0\u03b9\u03bb\u03b5\u03b3\u03bc\u03ad\u03bd\u03bf\u03c5 \u03a0\u03c1\u03bf\u03c4\u03cd\u03c0\u03bf\u03c5", "Delete": "\u0394\u03b9\u03b1\u03b3\u03c1\u03b1\u03c6\u03ae", "An error occurred while saving the Template. Please try again.": "\u03a0\u03b1\u03c1\u03bf\u03c5\u03c3\u03b9\u03ac\u03c3\u03c4\u03b7\u03ba\u03b5 \u03c3\u03c6\u03ac\u03bb\u03bc\u03b1 \u03ba\u03b1\u03c4\u03ac \u03c4\u03b7\u03bd \u03b1\u03c0\u03bf\u03b8\u03ae\u03ba\u03b5\u03c5\u03c3\u03b7 \u03c4\u03bf\u03c5 \u03a0\u03c1\u03bf\u03c4\u03cd\u03c0\u03bf\u03c5. \u03a0\u03b1\u03c1\u03b1\u03ba\u03b1\u03bb\u03bf\u03cd\u03bc\u03b5 \u03b4\u03bf\u03ba\u03b9\u03bc\u03ac\u03c3\u03c4\u03b5 \u03be\u03b1\u03bd\u03ac.", "Template \"%s\" saved.": "\u03a4\u03bf \u03a0\u03c1\u03cc\u03c4\u03c5\u03c0\u03bf \"%s\" \u03b1\u03c0\u03bf\u03b8\u03b7\u03ba\u03b5\u03cd\u03c4\u03b7\u03ba\u03b5.", "The current content will overwrite the selected Template. Are you sure?": "\u03a4\u03bf \u03c4\u03c1\u03ad\u03c7\u03bf\u03bd \u03c0\u03b5\u03c1\u03b9\u03b5\u03c7\u03cc\u03bc\u03b5\u03bd\u03bf \u03b8\u03b1 \u03b1\u03bd\u03c4\u03b9\u03ba\u03b1\u03c4\u03b1\u03c3\u03c4\u03ae\u03c3\u03b5\u03b9 \u03c4\u03bf \u03b5\u03c0\u03b9\u03bb\u03b5\u03b3\u03bc\u03ad\u03bd\u03bf \u03a0\u03c1\u03cc\u03c4\u03c5\u03c0\u03bf. \u0395\u03af\u03c3\u03c4\u03b5 \u03c3\u03af\u03b3\u03bf\u03c5\u03c1\u03bf\u03b9;", "Give a title to your Template:": "\u0394\u03ce\u03c3\u03c4\u03b5 \u03ad\u03bd\u03b1\u03bd \u03c4\u03af\u03c4\u03bb\u03bf \u03c3\u03c4\u03bf \u03a0\u03c1\u03cc\u03c4\u03c5\u03c0\u03bf \u03c3\u03b1\u03c2:", "A Template with that title already exists, please change the title.": "\u0388\u03bd\u03b1 \u03a0\u03c1\u03cc\u03c4\u03c5\u03c0\u03bf \u03bc\u03b5 \u03c4\u03bf\u03bd \u03c4\u03af\u03c4\u03bb\u03bf \u03b1\u03c5\u03c4\u03cc \u03c5\u03c0\u03ac\u03c1\u03c7\u03b5\u03b9 \u03ae\u03b4\u03b7, \u03c0\u03b1\u03c1\u03b1\u03ba\u03b1\u03bb\u03bf\u03cd\u03bc\u03b5 \u03bd\u03b1 \u03b1\u03bb\u03bb\u03ac\u03be\u03b5\u03c4\u03b5 \u03c4\u03bf\u03bd \u03c4\u03af\u03c4\u03bb\u03bf.", "The Template will overwrite the current editor content. Are you sure?": "\u03a4\u03bf \u03a0\u03c1\u03cc\u03c4\u03c5\u03c0\u03bf \u03b8\u03b1 \u03b1\u03bd\u03c4\u03b9\u03ba\u03b1\u03c4\u03b1\u03c3\u03c4\u03ae\u03c3\u03b5\u03b9 \u03c4\u03bf \u03c4\u03c1\u03ad\u03c7\u03bf\u03bd \u03c0\u03b5\u03c1\u03b9\u03b5\u03c7\u03cc\u03bc\u03b5\u03bd\u03bf \u03c3\u03c4\u03bf editor. \u0395\u03af\u03c3\u03c4\u03b5 \u03c3\u03af\u03b3\u03bf\u03c5\u03c1\u03bf\u03b9;", "An error occurred while loading the Template. Please try again.": "\u03a0\u03b1\u03c1\u03bf\u03c5\u03c3\u03b9\u03ac\u03c3\u03c4\u03b7\u03ba\u03b5 \u03c3\u03c6\u03ac\u03bb\u03bc\u03b1 \u03ba\u03b1\u03c4\u03ac \u03c4\u03b7 \u03c6\u03cc\u03c1\u03c4\u03c9\u03c3\u03b7 \u03c4\u03bf\u03c5 \u03a0\u03c1\u03bf\u03c4\u03cd\u03c0\u03bf\u03c5. \u03a0\u03b1\u03c1\u03b1\u03ba\u03b1\u03bb\u03bf\u03cd\u03bc\u03b5 \u03b4\u03bf\u03ba\u03b9\u03bc\u03ac\u03c3\u03c4\u03b5 \u03be\u03b1\u03bd\u03ac.", "Template \"%s\" loaded.": "\u03a4\u03bf \u03a0\u03c1\u03cc\u03c4\u03c5\u03c0\u03bf \"%s\" \u03c6\u03bf\u03c1\u03c4\u03ce\u03b8\u03b7\u03ba\u03b5.", "Are you sure you want to delete the selected Template?": "\u0395\u03af\u03c3\u03c4\u03b5 \u03c3\u03af\u03b3\u03bf\u03c5\u03c1\u03bf\u03b9 \u03cc\u03c4\u03b9 \u03b8\u03ad\u03bb\u03b5\u03c4\u03b5 \u03bd\u03b1 \u03b4\u03b9\u03b1\u03b3\u03c1\u03ac\u03c8\u03b5\u03c4\u03b5 \u03c4\u03bf \u03b5\u03c0\u03b9\u03bb\u03b5\u03b3\u03bc\u03ad\u03bd\u03bf \u03a0\u03c1\u03cc\u03c4\u03c5\u03c0\u03bf;", "An error occurred while deleting the Template. Please try again.": "\u03a0\u03b1\u03c1\u03bf\u03c5\u03c3\u03b9\u03ac\u03c3\u03c4\u03b7\u03ba\u03b5 \u03c3\u03c6\u03ac\u03bb\u03bc\u03b1 \u03ba\u03b1\u03c4\u03ac \u03c4\u03b7\u03bd \u03b4\u03b9\u03b1\u03b3\u03c1\u03b1\u03c6\u03ae \u03c4\u03bf\u03c5 \u03a0\u03c1\u03bf\u03c4\u03cd\u03c0\u03bf\u03c5. \u03a0\u03b1\u03c1\u03b1\u03ba\u03b1\u03bb\u03bf\u03cd\u03bc\u03b5 \u03b4\u03bf\u03ba\u03b9\u03bc\u03ac\u03c3\u03c4\u03b5 \u03be\u03b1\u03bd\u03ac.", "Click %s to insert audio.": "\u039a\u03bb\u03b9\u03ba %s \u03b3\u03b9\u03b1 \u03bd\u03b1 \u03b5\u03b9\u03c3\u03b1\u03b3\u03ac\u03b3\u03b5\u03c4\u03b5 \u03ae\u03c7\u03bf.", "Audio": "\u0389\u03c7\u03bf\u03c2", "Insert audio": "\u0395\u03b9\u03c3\u03b1\u03b3\u03c9\u03b3\u03ae \u03ae\u03c7\u03bf\u03c5.", "Play": "\u0391\u03bd\u03b1\u03c0\u03b1\u03c1\u03b1\u03b3\u03c9\u03b3\u03ae", "Play audio": "\u0391\u03bd\u03b1\u03c0\u03b1\u03c1\u03b1\u03b3\u03c9\u03b3\u03ae \u03ae\u03c7\u03bf\u03c5", "Pause": "\u03a0\u03b1\u03cd\u03c3\u03b7", "Pause audio": "\u03a0\u03b1\u03cd\u03c3\u03b7 \u03ae\u03c7\u03bf\u03c5", "Show audio": "\u0395\u03bc\u03c6\u03ac\u03bd\u03b9\u03c3\u03b7 \u03ae\u03c7\u03bf\u03c5", "Close audio": "\u039a\u03bb\u03b5\u03af\u03c3\u03b9\u03bc\u03bf \u03ae\u03c7\u03bf\u03c5", "Please provide a valid link\/embed code for any of the supported audio services.": "\u03a0\u03b1\u03c1\u03b1\u03ba\u03b1\u03bb\u03bf\u03cd\u03bc\u03b5 \u03b4\u03ce\u03c3\u03c4\u03b5 \u03ad\u03bd\u03b1\u03bd \u03ad\u03b3\u03ba\u03c5\u03c1\u03bf \u03b4\u03b5\u03c3\u03bc\u03cc \u03ae \u03ba\u03ce\u03b4\u03b9\u03ba\u03b1 \u03b5\u03bd\u03c3\u03c9\u03bc\u03ac\u03c4\u03c9\u03c3\u03b7 \u03b3\u03b9\u03b1 \u03bf\u03c0\u03bf\u03b9\u03b1\u03b4\u03ae\u03c0\u03bf\u03c4\u03b5 \u03b1\u03c0\u03cc \u03c4\u03b9\u03c2 \u03c5\u03c0\u03bf\u03c3\u03c4\u03b7\u03c1\u03b9\u03b6\u03cc\u03bc\u03b5\u03bd\u03b5\u03c2 \u03c5\u03c0\u03b7\u03c1\u03b5\u03c3\u03af\u03b5\u03c2 \u03ae\u03c7\u03bf\u03c5.", "Could not interpret the content as audio.": "\u03a4\u03bf \u03c0\u03b5\u03c1\u03b9\u03b5\u03c7\u03cc\u03bc\u03b5\u03bd\u03bf \u03b4\u03b5\u03bd \u03b1\u03bd\u03b1\u03b3\u03bd\u03c9\u03c1\u03af\u03c3\u03c4\u03b7\u03ba\u03b5 \u03c9\u03c2 \u03ae\u03c7\u03bf\u03c5.", "%s can't be set as background.": "%s \u03b4\u03b5\u03bd \u03bc\u03c0\u03bf\u03c1\u03b5\u03af \u03bd\u03b1 \u03bf\u03c1\u03b9\u03c3\u03c4\u03b5\u03af \u03c9\u03c2 \u03c6\u03cc\u03bd\u03c4\u03bf.", "Files": "\u0391\u03c1\u03c7\u03b5\u03af\u03b1", "Insert audio embed code or url:": "\u0395\u03b9\u03c3\u03ac\u03b3\u03b5\u03c4\u03b5 \u03c4\u03bf \u03ba\u03ce\u03b4\u03b9\u03ba\u03b1 \u03b5\u03bd\u03c3\u03c9\u03bc\u03ac\u03c4\u03c9\u03c3\u03b7 \u03ae \u03c4\u03bf URL \u03c4\u03bf\u03c5 \u03ae\u03c7\u03bf\u03c5:", "Select audio from the list of available audios:": "\u0395\u03c0\u03b9\u03bb\u03ad\u03be\u03c4\u03b5 \u03c4\u03bf\u03bd \u03ae\u03c7\u03bf \u03b1\u03c0\u03cc \u03c4\u03b7 \u03bb\u03af\u03c3\u03c4\u03b1 \u03c4\u03c9\u03bd \u03b4\u03b9\u03b1\u03b8\u03ad\u03c3\u03b9\u03bc\u03c9\u03bd \u03ae\u03c7\u03c9\u03bd:", "Click %s to add color.": "\u039a\u03bb\u03b9\u03ba %s \u03b3\u03b9\u03b1 \u03bd\u03b1 \u03c0\u03c1\u03bf\u03c3\u03b8\u03ad\u03c3\u03b5\u03c4\u03b5 \u03c7\u03c1\u03ce\u03bc\u03b1.", "Add": "\u03a0\u03c1\u03bf\u03c3\u03b8\u03ae\u03ba\u03b7", "Add color": "\u03a0\u03c1\u03bf\u03c3\u03b8\u03ad\u03c3\u03c4\u03b5 \u03c7\u03c1\u03ce\u03bc\u03b1", "Click %s to insert image.": "\u039a\u03bb\u03b9\u03ba %s \u03b3\u03b9\u03b1 \u03bd\u03b1 \u03b5\u03b9\u03c3\u03ac\u03b3\u03b5\u03c4\u03b5 \u03b5\u03b9\u03ba\u03cc\u03bd\u03b1.", "Image": "\u0395\u03b9\u03ba\u03cc\u03bd\u03b1", "Insert image": "\u0395\u03b9\u03c3\u03b1\u03b3\u03c9\u03b3\u03ae \u03b5\u03b9\u03ba\u03cc\u03bd\u03b1\u03c2", "Select image layout": "\u0395\u03c0\u03b9\u03bb\u03ad\u03be\u03c4\u03b5 \u03b7 \u03b4\u03b9\u03ac\u03c4\u03b1\u03be\u03b7 \u03c4\u03b9\u03c2 \u03b5\u03b9\u03ba\u03cc\u03bd\u03b1\u03c2", "Center &amp; fill": "\u039a\u03ad\u03bd\u03c4\u03c1\u03bf \u03ba\u03b1\u03b9 \u03b3\u03ad\u03bc\u03b9\u03c3\u03bc\u03b1", "Fit": "\u0393\u03ad\u03bc\u03b9\u03c3\u03bc\u03b1", "Stretch": "\u03a4\u03ad\u03bd\u03c4\u03c9\u03bc\u03b1", "Options": "\u0395\u03c0\u03b9\u03bb\u03bf\u03b3\u03ad\u03c2", "Image options": "\u0395\u03c0\u03b9\u03bb\u03bf\u03b3\u03ad\u03c2 \u03b5\u03b9\u03ba\u03cc\u03bd\u03b1\u03c2", "Image quality": "\u03a0\u03bf\u03b9\u03cc\u03c4\u03b7\u03c4\u03b1 \u03b5\u03b9\u03ba\u03cc\u03bd\u03b1\u03c2", "Original": "\u0391\u03c1\u03c7\u03b9\u03ba\u03ae", "High": "\u03a5\u03c8\u03b7\u03bb\u03ae", "Normal": "\u039a\u03b1\u03bd\u03bf\u03bd\u03b9\u03ba\u03ae", "Low": "\u03a7\u03b1\u03bc\u03b7\u03bb\u03ae", "Proportional resize": "\u0391\u03bd\u03b1\u03bb\u03bf\u03b3\u03b9\u03ba\u03ae \u03b1\u03bb\u03bb\u03b1\u03b3\u03ae \u03bc\u03b5\u03b3\u03ad\u03b8\u03bf\u03c5\u03c2", "Set box to image original size": "\u03a1\u03c5\u03b8\u03bc\u03af\u03c3\u03c4\u03b5 \u03c4\u03bf \u03ba\u03bf\u03c5\u03c4\u03af \u03c3\u03c4\u03bf \u03b1\u03c1\u03c7\u03b9\u03ba\u03cc \u03bc\u03ad\u03b3\u03b5\u03b8\u03bf\u03c2 \u03c4\u03b7\u03c2 \u03b5\u03b9\u03ba\u03cc\u03bd\u03b1\u03c2", "Disk": "\u0394\u03af\u03c3\u03ba\u03bf\u03c2", "Supported image file types:": "\u03a5\u03c0\u03bf\u03c3\u03c4\u03b7\u03c1\u03b9\u03b6\u03cc\u03bc\u03b5\u03bd\u03bf\u03b9 \u03c4\u03cd\u03c0\u03bf\u03b9 \u03b1\u03c1\u03c7\u03b5\u03af\u03bf\u03c5 \u03b5\u03b9\u03ba\u03cc\u03bd\u03b1\u03c2:", "Select image file from disk (max size %s):": "\u0395\u03c0\u03b9\u03bb\u03ad\u03be\u03c4\u03b5 \u03b1\u03c1\u03c7\u03b5\u03af\u03bf \u03b5\u03b9\u03ba\u03cc\u03bd\u03b1\u03c2 \u03b1\u03c0\u03cc \u03c4\u03bf \u03b4\u03af\u03c3\u03ba\u03bf (\u03bc\u03ad\u03b3\u03b9\u03c3\u03c4\u03bf \u03bc\u03ad\u03b3\u03b5\u03b8\u03bf\u03c2 %s):", "Browse...": "\u0391\u03bd\u03b1\u03b6\u03ae\u03c4\u03b7\u03c3\u03b7...", "Image quality:": "\u03a0\u03bf\u03b9\u03cc\u03c4\u03b7\u03c4\u03b1 \u03b5\u03b9\u03ba\u03cc\u03bd\u03b1\u03c2:", "Insert image URL link:": "\u0395\u03b9\u03c3\u03ac\u03b3\u03b5\u03c4\u03b5 \u03c4\u03bf URL \u03c4\u03b7\u03c2 \u03b5\u03b9\u03ba\u03cc\u03bd\u03b1\u03c2:", "Image description:": "\u03a0\u03b5\u03c1\u03b9\u03b3\u03c1\u03b1\u03c6\u03ae \u03b5\u03b9\u03ba\u03cc\u03bd\u03b1\u03c2:", "Please insert image description.": "\u03a0\u03b1\u03c1\u03b1\u03ba\u03b1\u03bb\u03bf\u03cd\u03bc\u03b5 \u03b5\u03b9\u03c3\u03ac\u03b3\u03b5\u03c4\u03b5 \u03c4\u03b7\u03bd \u03c0\u03b5\u03c1\u03b9\u03b3\u03c1\u03b1\u03c6\u03ae \u03c4\u03b7\u03c2 \u03b5\u03b9\u03ba\u03cc\u03bd\u03b1\u03c2.", "Image description is too short.": "\u0397 \u03c0\u03b5\u03c1\u03b9\u03b3\u03c1\u03b1\u03c6\u03ae \u03c4\u03b7\u03c2 \u03b5\u03b9\u03ba\u03cc\u03bd\u03b1\u03c2 \u03b5\u03af\u03bd\u03b1\u03b9 \u03c0\u03bf\u03bb\u03cd \u03bc\u03b9\u03ba\u03c1\u03ae.", "No file selected.": "\u0394\u03b5\u03bd \u03ad\u03c7\u03b5\u03c4\u03b5 \u03b5\u03c0\u03b9\u03bb\u03ad\u03be\u03b5\u03b9 \u03ba\u03ac\u03c0\u03bf\u03b9\u03bf \u03b1\u03c1\u03c7\u03b5\u03af\u03bf.", "Please insert a link.": "\u03a0\u03b1\u03c1\u03b1\u03ba\u03b1\u03bb\u03bf\u03cd\u03bc\u03b5 \u03b5\u03b9\u03c3\u03ac\u03b3\u03b5\u03c4\u03b5 \u03b5\u03bd\u03b1 \u03b4\u03b5\u03c3\u03bc\u03cc.", "An unexpected error occurred. Please try again.": "\u03a0\u03b1\u03c1\u03bf\u03c5\u03c3\u03b9\u03ac\u03c3\u03c4\u03b7\u03ba\u03b5 \u03ad\u03bd\u03b1 \u03b1\u03c0\u03c1\u03cc\u03b2\u03bb\u03b5\u03c0\u03c4\u03bf\u03c2 \u03c3\u03c6\u03ac\u03bb\u03bc\u03b1. \u03a0\u03b1\u03c1\u03b1\u03ba\u03b1\u03bb\u03bf\u03cd\u03bc\u03b5 \u03b4\u03bf\u03ba\u03b9\u03bc\u03ac\u03c3\u03c4\u03b5 \u03be\u03b1\u03bd\u03ac.", "There was an error during server image resize.": "\u03a3\u03c6\u03ac\u03bb\u03bc\u03b1 \u03ba\u03b1\u03c4\u03ac \u03c4\u03b7\u03bd \u03b1\u03bb\u03bb\u03b1\u03b3\u03ae \u03bc\u03b5\u03b3\u03ad\u03b8\u03bf\u03c5\u03c2 \u03c4\u03b7\u03c2 \u03b5\u03b9\u03ba\u03cc\u03bd\u03b1\u03c2 \u03c3\u03c4\u03bf server.", "Loading...": "\u03a6\u03cc\u03c1\u03c4\u03c9\u03c3\u03b7...", "Could not interpret the content as image.": "\u03a4\u03bf \u03c0\u03b5\u03c1\u03b9\u03b5\u03c7\u03cc\u03bc\u03b5\u03bd\u03bf \u03b4\u03b5\u03bd \u03b1\u03bd\u03b1\u03b3\u03bd\u03c9\u03c1\u03af\u03c3\u03c4\u03b7\u03ba\u03b5 \u03c9\u03c2 \u03b5\u03b9\u03ba\u03cc\u03bd\u03b1.", "File extension not valid.": "\u0397 \u03b5\u03c0\u03ad\u03ba\u03c4\u03b1\u03c3\u03b7 \u03b1\u03c1\u03c7\u03b5\u03af\u03bf\u03c5 \u03b4\u03b5\u03bd \u03b5\u03af\u03bd\u03b1\u03b9 \u03ad\u03b3\u03ba\u03c5\u03c1\u03b7.", "File too big (max size: %s).": "\u03a4\u03bf \u03b1\u03c1\u03c7\u03b5\u03af\u03bf \u03b5\u03af\u03bd\u03b1\u03b9 \u03c0\u03bf\u03bb\u03cd \u03bc\u03b5\u03b3\u03ac\u03bb\u03bf (\u03bc\u03ad\u03b3\u03b9\u03c3\u03c4\u03bf \u03bc\u03ad\u03b3\u03b5\u03b8\u03bf\u03c2: %s).", "Error in reading the response from the server": "\u03a3\u03c6\u03ac\u03bb\u03bc\u03b1 \u03ba\u03b1\u03c4\u03ac \u03c4\u03b7\u03bd \u03b1\u03bd\u03ac\u03b3\u03bd\u03c9\u03c3\u03b7 \u03c4\u03b7\u03c2 \u03b1\u03c0\u03ac\u03bd\u03c4\u03b7\u03c3\u03b7\u03c2 \u03b1\u03c0\u03cc \u03c4\u03bf server", "Method %s does not exist on %s.": "\u039c\u03ad\u03b8\u03bf\u03b4\u03bf\u03c2 %s \u03b4\u03b5\u03bd \u03c5\u03c0\u03ac\u03c1\u03c7\u03b5\u03b9 \u03c3\u03c4\u03bf %s.", "Input not defined": "\u03a4\u03bf input \u03b4\u03b5\u03bd \u03bf\u03c1\u03af\u03b6\u03b5\u03c4\u03b1\u03b9", "Image file type cannot be resized.": "\u0391\u03c5\u03c4\u03cc \u03c4\u03bf \u03c4\u03cd\u03c0\u03bf \u03b5\u03b9\u03ba\u03cc\u03bd\u03b1\u03c2 \u03b4\u03b5\u03bd \u03b5\u03c0\u03b9\u03c4\u03c1\u03ad\u03c0\u03b5\u03b9 \u03b1\u03bb\u03bb\u03b1\u03b3\u03ae \u03bc\u03b5\u03b3\u03ad\u03b8\u03bf\u03c5\u03c2.", "File is not a supported image.": "\u03a4\u03bf \u03b1\u03c1\u03c7\u03b5\u03af\u03bf \u03b4\u03b5\u03bd \u03b5\u03af\u03bd\u03b1\u03b9 \u03bc\u03af\u03b1 \u03c5\u03c0\u03bf\u03c3\u03c4\u03b7\u03c1\u03b9\u03b6\u03cc\u03bc\u03b5\u03bd\u03b7 \u03b5\u03b9\u03ba\u03cc\u03bd\u03b1.", "File is not recognized as valid image.": "\u03a4\u03bf \u03b1\u03c1\u03c7\u03b5\u03af\u03bf \u03b4\u03b5\u03bd \u03b1\u03bd\u03b1\u03b3\u03bd\u03c9\u03c1\u03af\u03b6\u03b5\u03c4\u03b1\u03b9 \u03c9\u03c2 \u03ad\u03b3\u03ba\u03c5\u03c1\u03b7 \u03b5\u03b9\u03ba\u03cc\u03bd\u03b1.", "File is too big.": "\u03a4\u03bf \u03b1\u03c1\u03c7\u03b5\u03af\u03bf \u03b5\u03af\u03bd\u03b1\u03b9 \u03c0\u03bf\u03bb\u03cd \u03bc\u03b5\u03b3\u03ac\u03bb\u03bf.", "Error during loading of the image.": "\u03a3\u03c6\u03ac\u03bb\u03bc\u03b1 \u03ba\u03b1\u03c4\u03ac \u03c4\u03b7 \u03c6\u03cc\u03c1\u03c4\u03c9\u03c3\u03b7 \u03c4\u03b7\u03c2 \u03b5\u03b9\u03ba\u03cc\u03bd\u03b1\u03c2.", "Too many \"%s\" boxes (limit: %s).": "\u03a0\u03ac\u03c1\u03b1 \u03c0\u03bf\u03bb\u03bb\u03ac \u03ba\u03bf\u03c5\u03c4\u03b9\u03ac \"%s\" (\u03cc\u03c1\u03b9\u03bf: %s).", "Too many total boxes (limit: %s).": "\u03a0\u03ac\u03c1\u03b1 \u03c0\u03bf\u03bb\u03bb\u03ac \u03ba\u03bf\u03c5\u03c4\u03b9\u03ac \u03c3\u03c5\u03bd\u03bf\u03bb\u03b9\u03ba\u03ac (\u03cc\u03c1\u03b9\u03bf: %s).", "Unexpected error: could not finalize box style.": "\u0391\u03c0\u03c1\u03cc\u03b2\u03bb\u03b5\u03c0\u03c4\u03bf\u03c2 \u03c3\u03c6\u03ac\u03bb\u03bc\u03b1 \u03ba\u03b1\u03c4\u03ac \u03c4\u03b7\u03bd \u03bf\u03bb\u03bf\u03ba\u03bb\u03ae\u03c1\u03c9\u03c3\u03b7 \u03c4\u03bf\u03c5 \u03c3\u03c4\u03c5\u03bb \u03ba\u03bf\u03c5\u03c4\u03b9\u03bf\u03cd. ", "Background": "\u03a6\u03cc\u03bd\u03c4\u03bf", "Set selected box as background": "\u039f\u03c1\u03b9\u03c3\u03bc\u03cc\u03c2 \u03b5\u03c0\u03b9\u03bb\u03b5\u03b3\u03bc\u03ad\u03bd\u03bf\u03c5 \u03ba\u03bf\u03c5\u03c4\u03b9\u03bf\u03cd \u03c9\u03c2 \u03c6\u03cc\u03bd\u03c4\u03bf", "Unset box from background": "\u0391\u03c6\u03b1\u03af\u03c1\u03b5\u03c3\u03b7 \u03ba\u03bf\u03c5\u03c4\u03b9\u03bf\u03cd \u03b1\u03c0\u03cc \u03c4\u03bf \u03c6\u03cc\u03bd\u03c4\u03bf", "Arrange": "\u03a4\u03b1\u03ba\u03c4\u03bf\u03c0\u03bf\u03af\u03b7\u03c3\u03b7", "Arrange box": "\u03a4\u03b1\u03ba\u03c4\u03bf\u03c0\u03bf\u03af\u03b7\u03c3\u03b7 ", "Bring to front": "\u039c\u03b5\u03c4\u03b1\u03c6\u03bf\u03c1\u03ac \u03c3\u03b5 \u03c0\u03c1\u03ce\u03c4\u03bf \u03c0\u03bb\u03ac\u03bd\u03bf", "Send to back": "\u039c\u03b5\u03c4\u03b1\u03c6\u03bf\u03c1\u03ac \u03c0\u03af\u03c3\u03c9", "Bring forward": "\u039c\u03b5\u03c4\u03b1\u03c6\u03bf\u03c1\u03ac \u03ad\u03bd\u03b1 \u03b5\u03c0\u03af\u03c0\u03b5\u03b4\u03bf \u03b5\u03bc\u03c0\u03c1\u03cc\u03c2", "Send backward": "\u039c\u03b5\u03c4\u03b1\u03c6\u03bf\u03c1\u03ac \u03ad\u03bd\u03b1 \u03b5\u03c0\u03af\u03c0\u03b5\u03b4\u03bf \u03c0\u03af\u03c3\u03c9", "Duplicate": "\u0391\u03bd\u03c4\u03af\u03b3\u03c1\u03b1\u03c6\u03bf", "Duplicate selected box": "\u0391\u03bd\u03c4\u03b9\u03b3\u03c1\u03b1\u03c6\u03ae \u03b5\u03c0\u03b9\u03bb\u03b5\u03b3\u03bc\u03ad\u03bd\u03bf\u03c5 \u03ba\u03bf\u03c5\u03c4\u03b9\u03bf\u03cd", "Delete selected box": "\u0394\u03b9\u03b1\u03b3\u03c1\u03b1\u03c6\u03ae \u03b5\u03c0\u03b9\u03bb\u03b5\u03b3\u03bc\u03ad\u03bd\u03bf\u03c5 \u03ba\u03bf\u03c5\u03c4\u03b9\u03bf\u03cd", "Flip": "\u0391\u03bd\u03b1\u03c3\u03c4\u03c1\u03bf\u03c6\u03ae", "Vertical": "\u039a\u03b1\u03c4\u03b1\u03ba\u03cc\u03c1\u03c5\u03c6\u03b1", "Flip selected box vertically": "\u0391\u03bd\u03b1\u03c3\u03c4\u03c1\u03bf\u03c6\u03ae \u03b5\u03c0\u03b9\u03bb\u03b5\u03b3\u03bc\u03ad\u03bd\u03bf \u03ba\u03bf\u03c5\u03c4\u03af \u03ba\u03b1\u03c4\u03b1\u03ba\u03cc\u03c1\u03c5\u03c6\u03b1", "Horizontal": "\u039f\u03c1\u03b9\u03b6\u03cc\u03bd\u03c4\u03b9\u03b1", "Flip selected box horizontally": "\u0391\u03bd\u03b1\u03c3\u03c4\u03c1\u03bf\u03c6\u03ae \u03b5\u03c0\u03b9\u03bb\u03b5\u03b3\u03bc\u03ad\u03bd\u03bf \u03ba\u03bf\u03c5\u03c4\u03af \u03bf\u03c1\u03b9\u03b6\u03cc\u03bd\u03c4\u03b9\u03b1", "Select background color": "\u0395\u03c0\u03b9\u03bb\u03ad\u03be\u03c4\u03b5 \u03c4\u03bf \u03c7\u03c1\u03ce\u03bc\u03b1 \u03c4\u03bf\u03c5 \u03c6\u03cc\u03bd\u03c4\u03bf\u03c5", "Opacity": "\u0394\u03b9\u03b1\u03c6\u03ac\u03bd\u03b5\u03b9\u03b1", "Box opacity": "\u0394\u03b9\u03b1\u03c6\u03ac\u03bd\u03b5\u03b9\u03b1 \u03ba\u03bf\u03c5\u03c4\u03b9\u03bf\u03cd", "Select box opacity": "\u0395\u03c0\u03b9\u03bb\u03ad\u03be\u03c4\u03b5 \u03b4\u03b9\u03b1\u03c6\u03ac\u03bd\u03b5\u03b9\u03b1 \u03ba\u03bf\u03c5\u03c4\u03b9\u03bf\u03cd", "Select background opacity": "\u0395\u03c0\u03b9\u03bb\u03ad\u03be\u03c4\u03b5 \u03b4\u03b9\u03b1\u03c6\u03ac\u03bd\u03b5\u03b9\u03b1 \u03c6\u03cc\u03bd\u03c4\u03bf\u03c5", "Background opacity": "\u0394\u03b9\u03b1\u03c6\u03ac\u03bd\u03b5\u03b9\u03b1 \u03c6\u03cc\u03bd\u03c4\u03bf\u03c5", "Border": "\u03a0\u03b5\u03c1\u03b9\u03b3\u03c1\u03ac\u03bc\u03bc\u03b1", "Select border style": "\u0395\u03c0\u03b9\u03bb\u03ad\u03be\u03c4\u03b5 \u03c4\u03bf \u03c3\u03c4\u03c5\u03bb \u03c0\u03b5\u03c1\u03b9\u03b3\u03c1\u03ac\u03bc\u03bc\u03b1\u03c4\u03bf\u03c2", "Select border color": "\u0395\u03c0\u03b9\u03bb\u03ad\u03be\u03c4\u03b5 \u03c4\u03bf \u03c7\u03c1\u03ce\u03bc\u03b1 \u03c4\u03bf\u03c5 \u03c0\u03bb\u03b1\u03b9\u03c3\u03af\u03bf\u03c5", "Select border width": "\u0395\u03c0\u03b9\u03bb\u03ad\u03be\u03c4\u03b5 \u03c4\u03bf \u03c0\u03bb\u03ac\u03c4\u03bf\u03c2 \u03c0\u03b5\u03c1\u03b9\u03b3\u03c1\u03ac\u03bc\u03bc\u03b1\u03c4\u03bf\u03c2", "Corners": "\u0393\u03c9\u03bd\u03af\u03b5\u03c2", "Top left corner": "\u0395\u03c0\u03ac\u03bd\u03c9 \u03b1\u03c1\u03b9\u03c3\u03c4\u03b5\u03c1\u03ae \u03b3\u03c9\u03bd\u03af\u03b1", "Top right corner": "\u0395\u03c0\u03ac\u03bd\u03c9 \u03b4\u03b5\u03be\u03b9\u03ac \u03b3\u03c9\u03bd\u03af\u03b1", "Bottom left corner": "\u039a\u03ac\u03c4\u03c9 \u03b1\u03c1\u03b9\u03c3\u03c4\u03b5\u03c1\u03ae \u03b3\u03c9\u03bd\u03af\u03b1", "Bottom right corner": "\u039a\u03ac\u03c4\u03c9 \u03b4\u03b5\u03be\u03b9\u03ac \u03b3\u03c9\u03bd\u03af\u03b1", "Rounded corners": "\u03a3\u03c4\u03c1\u03bf\u03b3\u03b3\u03c5\u03bb\u03b5\u03bc\u03ad\u03bd\u03b5\u03c2 \u03b3\u03c9\u03bd\u03af\u03b5\u03c2", "Radius": "\u0391\u03ba\u03c4\u03af\u03bd\u03b1", "Unexpected error: box has no content.": "\u0391\u03c0\u03c1\u03cc\u03b2\u03bb\u03b5\u03c0\u03c4\u03bf\u03c2 \u03c3\u03c6\u03ac\u03bb\u03bc\u03b1: \u03ba\u03bf\u03c5\u03c4\u03af \u03b4\u03b5\u03bd \u03ad\u03c7\u03b5\u03b9 \u03c0\u03b5\u03c1\u03b9\u03b5\u03c7\u03cc\u03bc\u03b5\u03bd\u03bf.", "Box type not supplied during registration.": "\u0394\u03b5\u03bd \u03c0\u03b1\u03c1\u03b1\u03b4\u03cc\u03b8\u03b7\u03ba\u03b5 \u03c4\u03cd\u03c0\u03bf \u03ba\u03bf\u03c5\u03c4\u03b9\u03bf\u03cd \u03ba\u03b1\u03c4\u03ac \u03c4\u03b7\u03bd \u03b5\u03b3\u03b3\u03c1\u03b1\u03c6\u03ae.", "Video": "\u0392\u03af\u03bd\u03c4\u03b5\u03bf", "Click %s to insert text.": "\u039a\u03bb\u03b9\u03ba %s \u03b3\u03b9\u03b1 \u03bd\u03b1 \u03b5\u03b9\u03c3\u03ac\u03b3\u03b5\u03c4\u03b5 \u03ba\u03b5\u03af\u03bc\u03b5\u03bd\u03bf.", "Insert\/edit text": "\u0395\u03b9\u03c3\u03b1\u03b3\u03c9\u03b3\u03ae\/\u03b5\u03c0\u03b5\u03be\u03b5\u03c1\u03b3\u03b1\u03c3\u03af\u03b1 \u03ba\u03b5\u03b9\u03bc\u03ad\u03bd\u03bf\u03c5", "Text alignment": "\u03a3\u03c4\u03bf\u03af\u03c7\u03b9\u03c3\u03b7 \u03ba\u03b5\u03b9\u03bc\u03ad\u03bd\u03bf\u03c5", "Font": "\u0393\u03c1\u03b1\u03bc\u03bc\u03b1\u03c4\u03bf\u03c3\u03b5\u03b9\u03c1\u03ac", "Bold": "\u0388\u03bd\u03c4\u03bf\u03bd\u03b1", "Italic": "\u03a0\u03bb\u03ac\u03b3\u03b9\u03b1", "Underline": "\u03a5\u03c0\u03bf\u03b3\u03c1\u03ac\u03bc\u03bc\u03b9\u03c3\u03b7", "Select font size": "\u0395\u03c0\u03b9\u03bb\u03ad\u03be\u03c4\u03b5 \u03c4\u03bf \u03bc\u03ad\u03b3\u03b5\u03b8\u03bf\u03c2 \u03c4\u03b7\u03c2 \u03b3\u03c1\u03b1\u03bc\u03bc\u03b1\u03c4\u03bf\u03c3\u03b5\u03b9\u03c1\u03ac\u03c2", "Select font color": "\u0395\u03c0\u03b9\u03bb\u03ad\u03be\u03c4\u03b5 \u03c4\u03bf \u03c7\u03c1\u03ce\u03bc\u03b1 \u03c4\u03b7\u03c2 \u03b3\u03c1\u03b1\u03bc\u03bc\u03b1\u03c4\u03bf\u03c3\u03b5\u03b9\u03c1\u03ac\u03c2", "Increase font size": "\u039c\u03b5\u03b3\u03b1\u03bb\u03cd\u03c4\u03b5\u03c1\u03bf \u03bc\u03ad\u03b3\u03b5\u03b8\u03bf\u03c2 \u03b3\u03c1\u03b1\u03bc\u03bc\u03b1\u03c4\u03bf\u03c3\u03b5\u03b9\u03c1\u03ac\u03c2", "Decrease font size": "\u039c\u03b9\u03ba\u03c1\u03cc\u03c4\u03b5\u03c1\u03bf \u03bc\u03ad\u03b3\u03b5\u03b8\u03bf\u03c2 \u03b3\u03c1\u03b1\u03bc\u03bc\u03b1\u03c4\u03bf\u03c3\u03b5\u03b9\u03c1\u03ac\u03c2", "Text length exceeds the maximum limit.": "\u039c\u03ae\u03ba\u03bf\u03c2 \u03c4\u03bf\u03c5 \u03ba\u03b5\u03b9\u03bc\u03ad\u03bd\u03bf\u03c5 \u03c5\u03c0\u03b5\u03c1\u03b2\u03b1\u03af\u03bd\u03b5\u03b9 \u03c4\u03bf \u03bc\u03ad\u03b3\u03b9\u03c3\u03c4\u03bf \u03cc\u03c1\u03b9\u03bf.", "Plain text.": "\u0391\u03c0\u03bb\u03cc \u03ba\u03b5\u03af\u03bc\u03b5\u03bd\u03bf.", "Formatted text.": "\u039c\u03bf\u03c1\u03c6\u03bf\u03c0\u03bf\u03b9\u03b7\u03bc\u03ad\u03bd\u03bf \u03ba\u03b5\u03af\u03bc\u03b5\u03bd\u03bf.", "Paste text": "\u0395\u03c0\u03b9\u03ba\u03cc\u03bb\u03bb\u03b7\u03c3\u03b7 \u03ba\u03b5\u03b9\u03bc\u03ad\u03bd\u03bf\u03c5", "Click %s to insert video.": "\u039a\u03bb\u03b9\u03ba %s \u03b3\u03b9\u03b1 \u03bd\u03b1 \u03b5\u03b9\u03c3\u03ac\u03b3\u03b5\u03c4\u03b5 \u03b2\u03af\u03bd\u03c4\u03b5\u03bf.", "Insert video": "\u0395\u03b9\u03c3\u03b1\u03b3\u03c9\u03b3\u03ae \u03b2\u03af\u03bd\u03c4\u03b5\u03bf", "Video embed options": "\u0395\u03c0\u03b9\u03bb\u03bf\u03b3\u03ad\u03c2 \u03b2\u03af\u03bd\u03c4\u03b5\u03bf", "Play video": "\u0391\u03bd\u03b1\u03c0\u03b1\u03c1\u03b1\u03b3\u03c9\u03b3\u03ae \u03b2\u03af\u03bd\u03c4\u03b5\u03bf", "Pause video": "\u03a0\u03b1\u03cd\u03c3\u03b7 \u03b2\u03af\u03bd\u03c4\u03b5\u03bf", "Show video": "\u0395\u03bc\u03c6\u03ac\u03bd\u03b9\u03c3\u03b7 \u03b2\u03af\u03bd\u03c4\u03b5\u03bf", "Close video": "\u039a\u03bb\u03b5\u03af\u03c3\u03b9\u03bc\u03bf \u03b2\u03af\u03bd\u03c4\u03b5\u03bf", "Please provide a valid link\/embed code for any of the supported video services.": "\u03a0\u03b1\u03c1\u03b1\u03ba\u03b1\u03bb\u03bf\u03cd\u03bc\u03b5 \u03b4\u03ce\u03c3\u03c4\u03b5 \u03ad\u03bd\u03b1\u03bd \u03ad\u03b3\u03ba\u03c5\u03c1\u03bf \u03b4\u03b5\u03c3\u03bc\u03cc \u03ae \u03ba\u03ce\u03b4\u03b9\u03ba\u03b1 \u03b5\u03bd\u03c3\u03c9\u03bc\u03ac\u03c4\u03c9\u03c3\u03b7 \u03b3\u03b9\u03b1 \u03bf\u03c0\u03bf\u03b9\u03b1\u03b4\u03ae\u03c0\u03bf\u03c4\u03b5 \u03b1\u03c0\u03cc \u03c4\u03b9\u03c2 \u03c5\u03c0\u03bf\u03c3\u03c4\u03b7\u03c1\u03b9\u03b6\u03cc\u03bc\u03b5\u03bd\u03b5\u03c2 \u03c5\u03c0\u03b7\u03c1\u03b5\u03c3\u03af\u03b5\u03c2 \u03b2\u03af\u03bd\u03c4\u03b5\u03bf.", "Could not interpret the content as video.": "\u03a4\u03bf \u03c0\u03b5\u03c1\u03b9\u03b5\u03c7\u03cc\u03bc\u03b5\u03bd\u03bf \u03b4\u03b5\u03bd \u03b1\u03bd\u03b1\u03b3\u03bd\u03c9\u03c1\u03af\u03c3\u03c4\u03b7\u03ba\u03b5 \u03c9\u03c2 \u03b2\u03af\u03bd\u03c4\u03b5\u03bf.", "Insert video embed code or url:": "\u0395\u03b9\u03c3\u03ac\u03b3\u03b5\u03c4\u03b5 \u03c4\u03bf \u03ba\u03ce\u03b4\u03b9\u03ba\u03b1 \u03b5\u03bd\u03c3\u03c9\u03bc\u03ac\u03c4\u03c9\u03c3\u03b7 \u03ae \u03c4\u03bf URL \u03c4\u03bf\u03c5 \u03b2\u03af\u03bd\u03c4\u03b5\u03bf:", "Select video from the list of available videos:": "\u0395\u03c0\u03b9\u03bb\u03ad\u03be\u03c4\u03b5 \u03c4\u03bf \u03b2\u03af\u03bd\u03c4\u03b5\u03bf \u03b1\u03c0\u03cc \u03c4\u03b7 \u03bb\u03af\u03c3\u03c4\u03b1 \u03c4\u03c9\u03bd \u03b4\u03b9\u03b1\u03b8\u03ad\u03c3\u03b9\u03bc\u03c9\u03bd \u03b2\u03af\u03bd\u03c4\u03b5\u03bf:", "Add %s box": "\u03a0\u03c1\u03bf\u03c3\u03b8\u03ae\u03ba\u03b7 \u03ba\u03bf\u03c5\u03c4\u03af %s", "Set as background": "\u039f\u03c1\u03b9\u03c3\u03bc\u03cc\u03c2 \u03c9\u03c2 \u03c6\u03cc\u03bd\u03c4\u03bf", "Unset from background": "\u0391\u03c6\u03b1\u03af\u03c1\u03b5\u03c3\u03b7 \u03b1\u03c0\u03cc \u03c4\u03bf \u03c6\u03cc\u03bd\u03c4\u03bf", "Error in generating unique id.": "\u03a3\u03c6\u03ac\u03bb\u03bc\u03b1 \u03c3\u03c4\u03b7 \u03b4\u03b7\u03bc\u03b9\u03bf\u03c5\u03c1\u03b3\u03af\u03b1 \u03bc\u03bf\u03bd\u03b1\u03b4\u03b9\u03ba\u03cc ID.", "Improper internal call.": "\u0391\u03ba\u03b1\u03c4\u03ac\u03bb\u03bb\u03b7\u03bb\u03b7 \u03b5\u03c3\u03c9\u03c4\u03b5\u03c1\u03b9\u03ba\u03ae \u03ba\u03bb\u03ae\u03c3\u03b7.", "Please insert a value.": "\u03a0\u03b1\u03c1\u03b1\u03ba\u03b1\u03bb\u03bf\u03cd\u03bc\u03b5 \u03b5\u03b9\u03c3\u03ac\u03b3\u03b5\u03c4\u03b5 \u03bc\u03b9\u03b1 \u03c4\u03b9\u03bc\u03ae.", "Browser does not support required feature \"%s\".": "\u03a4\u03bf browser \u03b4\u03b5\u03bd \u03c5\u03c0\u03bf\u03c3\u03c4\u03b7\u03c1\u03af\u03b6\u03b5\u03b9 \u03b7 \u03b1\u03c0\u03b1\u03b9\u03c4\u03bf\u03cd\u03bc\u03b5\u03bd\u03b7 \u03bb\u03b5\u03b9\u03c4\u03bf\u03c5\u03c1\u03b3\u03af\u03b1 \"%s\".", "Could not initialize %s. Container not found.": "\u0394\u03b5\u03bd \u03ae\u03c4\u03b1\u03bd \u03b4\u03c5\u03bd\u03b1\u03c4\u03ae \u03b7 \u03b4\u03b7\u03bc\u03b9\u03bf\u03c5\u03c1\u03b3\u03af\u03b1 \u03c4\u03bf\u03c5 %s. \u0394\u03b5\u03bd \u03b2\u03c1\u03ad\u03b8\u03b7\u03ba\u03b5 \u03c4\u03bf container.", "Box type \"%s\" doesn't exist.": "\u03a4\u03c5\u03c0\u03bf\u03cd \u03ba\u03bf\u03c5\u03c4\u03b9\u03bf\u03cd \"%s\" \u03b4\u03b5\u03bd \u03c5\u03c0\u03ac\u03c1\u03c7\u03b5\u03b9.", "Error during box creation: %s.": "\u03a3\u03c6\u03ac\u03bb\u03bc\u03b1 \u03ba\u03b1\u03c4\u03ac \u03c4\u03b7\u03bd \u03b4\u03b7\u03bc\u03b9\u03bf\u03c5\u03c1\u03b3\u03af\u03b1 \u03ba\u03bf\u03c5\u03c4\u03af: %s.", "Saving content.": "\u0391\u03c0\u03bf\u03b8\u03ae\u03ba\u03b5\u03c5\u03c3\u03b7 \u03c0\u03b5\u03c1\u03b9\u03b5\u03c7\u03bf\u03bc\u03ad\u03bd\u03bf\u03c5.", "Please wait...": "\u03a0\u03b1\u03c1\u03b1\u03ba\u03b1\u03bb\u03bf\u03cd\u03bc\u03b5 \u03c0\u03b5\u03c1\u03b9\u03bc\u03ad\u03bd\u03b5\u03c4\u03b5...", "Removed box. Box type \"%s\" not supported.": "\u0391\u03c6\u03b1\u03b9\u03c1\u03ad\u03b8\u03b7\u03ba\u03b5 \u03ba\u03bf\u03c5\u03c4\u03af. \u03a4\u03c5\u03c0\u03bf\u03cd \u03ba\u03bf\u03c5\u03c4\u03b9\u03bf\u03cd \"%s\" \u03b4\u03b5\u03bd \u03c5\u03c0\u03bf\u03c3\u03c4\u03b7\u03c1\u03af\u03b6\u03b5\u03c4\u03b1\u03b9.", "This is a %s feature.": "\u0391\u03c5\u03c4\u03ae \u03b5\u03af\u03bd\u03b1\u03b9 \u03bc\u03af\u03b1 \u03bb\u03b5\u03b9\u03c4\u03bf\u03c5\u03c1\u03b3\u03af\u03b1 %s.", "For information, please visit %s.": "\u0393\u03b9\u03b1 \u03c0\u03b5\u03c1\u03b9\u03c3\u03c3\u03cc\u03c4\u03b5\u03c1\u03b5\u03c2 \u03c0\u03bb\u03b7\u03c1\u03bf\u03c6\u03bf\u03c1\u03af\u03b5\u03c2, \u03c0\u03b1\u03c1\u03b1\u03ba\u03b1\u03bb\u03bf\u03cd\u03bc\u03b5 \u03b5\u03c0\u03b9\u03c3\u03ba\u03b5\u03c6\u03b8\u03b5\u03af\u03c4\u03b5 %s.", "Box size and position": "\u039c\u03ad\u03b3\u03b5\u03b8\u03bf\u03c2 \u03ba\u03b1\u03b9 \u03b8\u03ad\u03c3\u03b7 \u03c4\u03bf\u03c5 \u03ba\u03bf\u03c5\u03c4\u03b9\u03bf\u03cd", "Size": "\u039c\u03ad\u03b3\u03b5\u03b8\u03bf\u03c2", "Box": "\u039a\u03bf\u03c5\u03c4\u03af", "SEO and grouping tags": "EO \u03ba\u03b1\u03b9 tags \u03bf\u03bc\u03b1\u03b4\u03bf\u03c0\u03bf\u03af\u03b7\u03c3\u03b7", "Additional audio services:": "\u03a0\u03c1\u03cc\u03c3\u03b8\u03b5\u03c4\u03b5\u03c2 \u03c5\u03c0\u03b7\u03c1\u03b5\u03c3\u03af\u03b5\u03c2 \u03ae\u03c7\u03bf\u03c5:", "Supported in %s:": "\u03a5\u03c0\u03bf\u03c3\u03c4\u03b7\u03c1\u03af\u03b6\u03b5\u03c4\u03b1\u03b9 \u03c3\u03b5 %s:", "Current color:": "\u03a7\u03c1\u03ce\u03bc\u03b1:", "Click on the \"%s\" button to start creating content for extra small layouts.": "\u039a\u03ac\u03bd\u03c4\u03b5 \u03ba\u03bb\u03b9\u03ba \u03c3\u03c4\u03bf \u03ba\u03bf\u03c5\u03bc\u03c0\u03af \"%s\" \u03b3\u03b9\u03b1 \u03bd\u03b1 \u03be\u03b5\u03ba\u03b9\u03bd\u03ae\u03c3\u03b5\u03b9 \u03b7 \u03b4\u03b7\u03bc\u03b9\u03bf\u03c5\u03c1\u03b3\u03af\u03b1 \u03c0\u03b5\u03c1\u03b9\u03b5\u03c7\u03bf\u03bc\u03ad\u03bd\u03bf\u03c5 \u03b3\u03b9\u03b1 \u03c0\u03bf\u03bb\u03cd \u03bc\u03b9\u03ba\u03c1\u03ad\u03c2 \u03b4\u03b9\u03b1\u03c4\u03ac\u03be\u03b5\u03b9\u03c2.", "Start responsive design": "\u039e\u03b5\u03ba\u03b9\u03bd\u03ae\u03c3\u03c4\u03b5 \u03c3\u03c7\u03b5\u03b4\u03b9\u03b1\u03c3\u03bc\u03cc responsive", "Snap boxes to": "\u03a3\u03c5\u03b3\u03ba\u03c1\u03ac\u03c4\u03b7\u03c3\u03b7 \u03ba\u03bf\u03c5\u03c4\u03b9\u03ac \u03c3\u03b5", "Page": "\u03a3\u03b5\u03bb\u03af\u03b4\u03b1", "Boxes": "\u039a\u03bf\u03c5\u03c4\u03b9\u03ac", "Content link": "\u0394\u03b5\u03c3\u03bc\u03cc \u03c3\u03c4\u03bf \u03c0\u03b5\u03c1\u03b9\u03b5\u03c7\u03cc\u03bc\u03b5\u03bd\u03bf", "Content": "\u03a0\u03b5\u03c1\u03b9\u03b5\u03c7\u03cc\u03bc\u03b5\u03bd\u03bf", "Set content width": "\u0395\u03c0\u03b9\u03bb\u03ad\u03be\u03c4\u03b5 \u03c4\u03bf \u03c0\u03bb\u03ac\u03c4\u03bf\u03c2 \u03c4\u03bf\u03c5 \u03c0\u03b5\u03c1\u03b9\u03b5\u03c7\u03bf\u03bc\u03ad\u03bd\u03bf\u03c5", "Set content height": "\u03a1\u03c5\u03b8\u03bc\u03af\u03c3\u03c4\u03b5 \u03c4\u03bf \u03cd\u03c8\u03bf\u03c2 \u03c4\u03bf\u03c5 \u03c0\u03b5\u03c1\u03b9\u03b5\u03c7\u03bf\u03bc\u03ad\u03bd\u03bf\u03c5", "Edit": "\u0395\u03c0\u03b5\u03be\u03b5\u03c1\u03b3\u03b1\u03c3\u03af\u03b1", "Basic": "\u0392\u03b1\u03c3\u03b9\u03ba\u03ac", "Media embed": "\u0395\u03bd\u03c3\u03c9\u03bc\u03ac\u03c4\u03c9\u03c3\u03b7 \u03c0\u03bf\u03bb\u03c5\u03bc\u03ad\u03c3\u03c9\u03bd", "Advanced": "\u03a0\u03c1\u03bf\u03c7\u03c9\u03c1\u03b7\u03bc\u03ad\u03bd\u03b1", "Add box:": "\u03a0\u03c1\u03bf\u03c3\u03b8\u03ae\u03ba\u03b7 \u03ba\u03bf\u03c5\u03c4\u03af:", "Click to set Hex color": "\u039a\u03ac\u03bd\u03c4\u03b5 \u03ba\u03bb\u03b9\u03ba \u03b3\u03b9\u03b1 \u03bd\u03b1 \u03bf\u03c1\u03af\u03c3\u03b5\u03c4\u03b5 \u03c4\u03bf \u03c7\u03c1\u03ce\u03bc\u03b1 (Hex)", "Click to set RGB color": "\u039a\u03ac\u03bd\u03c4\u03b5 \u03ba\u03bb\u03b9\u03ba \u03b3\u03b9\u03b1 \u03bd\u03b1 \u03bf\u03c1\u03af\u03c3\u03b5\u03c4\u03b5 \u03c4\u03bf \u03c7\u03c1\u03ce\u03bc\u03b1 (RGB)", "Solid color": "\u03a3\u03c5\u03bc\u03c0\u03b1\u03b3\u03ad\u03c2 \u03c7\u03c1\u03ce\u03bc\u03b1", "Horiz. gradient": "\u039f\u03c1\u03b9\u03b6\u03cc\u03bd\u03c4\u03b9\u03b1 \u03b4\u03b9\u03b1\u03b2\u03ac\u03b8.", "Vert. gradient": "\u039a\u03ac\u03b8\u03b5\u03c4\u03b7 \u03b4\u03b9\u03b1\u03b2\u03ac\u03b8.", "Radial gradient": "\u0391\u03ba\u03c4\u03b9\u03bd\u03b9\u03ba\u03ae \u03b4\u03b9\u03b1\u03b2\u03ac\u03b8.", "Select color opacity": "\u0395\u03c0\u03b9\u03bb\u03ad\u03be\u03c4\u03b5 \u03b4\u03b9\u03b1\u03c6\u03ac\u03bd\u03b5\u03b9\u03b1 \u03c7\u03c1\u03ce\u03bc\u03b1\u03c4\u03bf\u03c2", "Set custom color (Hex)": "\u039f\u03c1\u03b9\u03c3\u03bc\u03cc\u03c2 \u03c7\u03c1\u03ce\u03bc\u03b1\u03c4\u03bf\u03c2 (Hex)", "Please enter the color in hex format, e.g. %s": "\u03a0\u03b1\u03c1\u03b1\u03ba\u03b1\u03bb\u03bf\u03cd\u03bc\u03b5 \u03b5\u03b9\u03c3\u03ac\u03b3\u03b5\u03c4\u03b5 \u03c4\u03bf \u03c7\u03c1\u03ce\u03bc\u03b1 \u03c3\u03b5 \u03bc\u03bf\u03c1\u03c6\u03ae hex, \u03c0\u03c7. %s", "You must enter a color.": "\u03a0\u03c1\u03ad\u03c0\u03b5\u03b9 \u03bd\u03b1 \u03b5\u03b9\u03c3\u03ac\u03b3\u03b5\u03c4\u03b5 \u03c4\u03bf \u03c7\u03c1\u03ce\u03bc\u03b1.", "Set custom color (RGB)": "\u039f\u03c1\u03b9\u03c3\u03bc\u03cc\u03c2 \u03c7\u03c1\u03ce\u03bc\u03b1\u03c4\u03bf\u03c2 (RGB)", "Please enter the color in RGB format, with comma-separated components, e.g. %s": "\u03a0\u03b1\u03c1\u03b1\u03ba\u03b1\u03bb\u03bf\u03cd\u03bc\u03b5 \u03b5\u03b9\u03c3\u03ac\u03b3\u03b5\u03c4\u03b5 \u03c4\u03bf \u03c7\u03c1\u03ce\u03bc\u03b1 \u03c3\u03b5 \u03bc\u03bf\u03c1\u03c6\u03ae RGB, \u03bc\u03b5 \u03c4\u03b9\u03bc\u03ad\u03c2 \u03b4\u03b9\u03b1\u03c7\u03c9\u03c1\u03b9\u03c3\u03bc\u03ad\u03bd\u03b5\u03c2 \u03bc\u03b5 \u03ba\u03cc\u03bc\u03bc\u03b1, \u03c0\u03c7. %s"
    }
);
Zedity.i18n.add('es', {
        "%s needs %s.": "%s necesita %s.", "Click %s to insert a document.": "Click %s para insertar un documento.", "Document": "Documento", "Insert": "Insertar", "Insert document": "Insertar documento", "Read": "Leer", "Read document": "Leer documento", "Close": "Cerrar", "Close document": "Cerrar documento", "Please provide a valid link\/embed code for any of the supported document embed services or a direct link to a document.": "Por favor provee un enlace \/ c\u00f3digo v\u00e1lido para cualquiera de los servicios se embebido de documentos o un enlace directo al documento.", "Could not interpret the content as document.": "No se puede interpretar el contenido como un documento.", "%s can't be rotated.": "%s no puede rotarse.", "%s doesn't support background property.": "%s no soporta un fondo.", "%s doesn't support rounded corners.": "%s no soporta esquinas redondeadas.", "%s doesn't support flipping.": "%s no soporta volteo.", "Embed": "Embeber", "Insert document embed code or url:": "Inserta c\u00f3digo o direcci\u00f3n del documento embebido:", "Supported services:": "Servicios soportados:", "Supported documents:": "Documentos soportados:", "PDF documents, Microsoft Office documents, Apple Pages, Adobe Photoshop and Illustrator, and more.": "Documentos PDF, Microsoft Office, Apple Pages, Adobe Photoshop e Illustrator, y m\u00e1s.", "OK": "Ok", "Cancel": "Cancelar", "Click %s to insert HTML.": "Click %s para insertar HTML.", "Html": "Html", "Insert HTML": "Insertar HTML", "View": "Ver", "View box content": "Ver contenido de la caja", "Insert HTML code:": "Inserta c\u00f3digo HTML:", "Safe mode:": "Modo seguro:", "Automatic": "Autom\u00e1tico", "Enabled": "Activado", "Disabled": "Desactivado", "If you insert Javascript or CSS code and you get unexpected effects (e.g. content overflow, etc.) you need to enable safe mode.": "Si insertas Javascript o CSS y obtienes efectos inesperados (por ej. contenido superpuesto, etc.) necesitar\u00e1s activar el modo seguro.", "The (default) automatic setting enables safe mode only if Javascript is detected.": "El ajuste autom\u00e1tico (predeterminado) s\u00f3lo activa el modo seguro si detecta Javascript.", "Inserting a %s content into an HTML box is not supported at the moment.": "Por el momento no hay soporte para insertar un %s contenido HTML en una caja.", "Filters": "Filtros", "Apply image filters": "Aplicar filtros de imagen", "Adjust colors": "Ajustar colores", "Black &amp; white": "Blanco y Negro", "Blur": "Desenfoque", "Brightness": "Brillo", "Contrast": "Contraste", "Emboss": "Relieve", "Grayscale": "Escala de grises", "Invert": "Invertir", "Mosaic": "Mosaico", "Motion blur": "Desenfoque de movimiento", "Noise": "Ruido", "Paint": "Pintura", "Posterize": "Posterizar", "Psychedelia": "Psicodelia", "Sepia": "Sepia", "Sharpen": "Afilar", "Vignette": "Vi\u00f1eta", "Apply filter": "Aplicar filtro", "Reset filter": "Resetear filtro", "Remove all filters": "Borrar todos los filtros", "Error applying filter \"%s\".": "Error aplicando el filtro \"%s\".", "Filter \"%s\" not defined.": "Filtro \"%s\" no definido.", "Could not read image data. Filters cannot be applied on images hosted on a different domain.": "No se pueden leer los datos de la imagen. Los filtros no pueden ser aplicados en im\u00e1genes alojadas en un dominio diferente.", "Percent": "Porcentaje", "Adjustment": "Ajuste", "Threshold": "Umbral", "Red": "Rojo", "Green": "Verde", "Blue": "Azul", "Amount": "Cantidad", "Block size": "Tama\u00f1o del bloque", "Type": "Tipo", "Strength": "Fuerza", "Brush size": "Tama\u00f1o del pincel", "Link": "Enlace", "Add link to box": "Agregar enlace a la caja", "This link will be associated to the whole box.": "Este enlace se asociar\u00e1 a la caja completa.", "Insert link url:": "Inserte la direcci\u00f3n del enlace:", "Align": "Alinear", "Align to page": "Alinear a la p\u00e1gina", "Left": "Izquierda", "Center": "Centro", "Right": "Derecha", "Top": "Arriba", "Middle": "Medio", "Bottom": "Abajo", "Fit width": "Ajustar ancho", "Fit height": "Ajustar altura", "Keep aspect ratio": "Mantener relaci\u00f3n de aspecto", "Select box padding": "Selecciona espaciado de la caja", "Padding": "Espaciado", "Shadow": "Sombra", "Color": "Color", "Text": "Texto", "Paragraph": "P\u00e1rrafo", "Heading": "T\u00edtulo", "Align left": "Alinear a la izquierda", "Align center": "Alinear al centro", "Align right": "Alinear a la derecha", "Justify": "Justificar", "Ordered list": "Lista ordenada", "Unordered list": "Lista desordenada", "Indent": "Aumentar sangr\u00eda", "Outdent": "Disminuir sangr\u00eda", "Open link in the same tab.": "Abrir enlace en la misma pesta\u00f1a.", "Open link in a new tab.": "Abrir enlace en una nueva pesta\u00f1a.", "Link style preview": "Previsualizar estilo del enlace", "Link style": "Estilo del enlace", "Link style on mouse over": "Estilo del enlace al posar el cursor", "Insert link": "Insertar enlace", "Remove": "Eliminar", "The box link may override any link in the text.": "El enlace en la caja pasar\u00e1 por alto cualquier enlace en el texto.", "Align top": "Alinear arriba", "Align middle": "Alinear al medio", "Align bottom": "Alinear abajo", "Extra small layout": "Dise\u00f1o extra peque\u00f1o", "Small layout": "Dise\u00f1o peque\u00f1o", "Medium layout": "Dise\u00f1o mediano", "Large layout": "Dise\u00f1o grande", "If you perform this action you will revert to a non-responsive design. Are you sure?": "Si realizas esta acci\u00f3n volver\u00e1s a un dise\u00f1o no-responsive. \u00bfEst\u00e1s seguro?", "Custom layouts:": "Dise\u00f1os personalizados:", "Add custom layout": "A\u00f1adir dise\u00f1o personalizado", "Multiple layout responsive design": "Dise\u00f1o m\u00faltiple 'responsive'", "Save": "Guardar", "Abort": "Anular", "You may want to review the design for layouts in yellow.": "Podr\u00edas tener que revisar los dise\u00f1os en amarillo.", "Save without reviewing": "Guardar sin revisar", "Please click on the layouts in gray to provide the design for all layouts.": "Por favor haz click en los dise\u00f1os en gris para proveer el dise\u00f1o para todos.", "Save anyway (not recommended)": "Guardar de todas formas (no recomendado)", "Your responsive content is ready to be saved!": "\u00a1Tu contenido 'responsive' est\u00e1 listo para guardarse!", "Edit box": "Editar caja", "Show": "Mostrar", "This link will be associated to the whole %s content.": "Este enlace ser\u00e1 asociado a todo el contenido %s", "Width:": "Ancho:", "Height:": "Alto:", "Delete": "Borrar", "Click %s to insert audio.": "Click %s para insertar audio.", "Audio": "Audio", "Insert audio": "Insertar audio", "Play": "Reproducir", "Play audio": "Reproducir audio", "Pause": "Pausar", "Pause audio": "Pausar audio", "Show audio": "Mostrar audio", "Close audio": "Cerrar audio", "Please provide a valid link\/embed code for any of the supported audio services.": "Por favor provee un enlace \/ c\u00f3digo v\u00e1lido para cualquiera de los servicios de audio soportados.", "Could not interpret the content as audio.": "No se pudo interpretar el contenido como audio.", "%s can't be set as background.": "%s no puede ser colocado como fondo.", "Files": "Archivos", "Insert audio embed code or url:": "Insertar c\u00f3digo o direcci\u00f3n de audio embebido:", "Select audio from the list of available audios:": "Seleccionar audio de la lista de audios disponibles:", "Click %s to add color.": "Click %s para agregar color.", "Click %s to insert image.": "Click %s para insertar imagen.", "Image": "Imagen", "Insert image": "Insertar imagen", "Center &amp; fill": "Centrada y rellenar", "Fit": "Encajar", "Stretch": "Aplastar", "Image options": "Opciones de im\u00e1genes", "Image quality": "Calidad de la imagen", "Original": "Original", "High": "Alta", "Normal": "Normal", "Low": "Baja", "Proportional resize": "Ajuste proporcional de tama\u00f1o", "Set box to image original size": "Ajustar caja al tama\u00f1o original de la imagen", "Disk": "Disco", "Supported image file types:": "Tipos de imagen soportados:", "Select image file from disk (max size %s):": "Seleccionar archivo de imagen desde el disco (tama\u00f1o m\u00e1ximo %s):", "Browse...": "Explorar...", "Image quality:": "Calidad de imagen:", "Insert image URL link:": "Inserta enlace a la URL de la imagen:", "Image description:": "Descripci\u00f3n de la imagen:", "Please insert image description.": "Por favor inserta descripci\u00f3n de la imagen.", "Image description is too short.": "La descripci\u00f3n de la imagen es muy corta.", "No file selected.": "No se ha seleccionado ning\u00fan archivo.", "Please insert a link.": "Por favor inserta un enlace.", "An unexpected error occurred. Please try again.": "Ocurri\u00f3 un error inesperado. Intenta nuevamente.", "There was an error during server image resize.": "Hubo un error durante el ajuste de tama\u00f1o de imagen.", "Loading...": "Cargando...", "Could not interpret the content as image.": "No se pudo interpretar el contenido como una imagen.", "File extension not valid.": "La extensi\u00f3n del archivo no es v\u00e1lida.", "File too big (max size: %s).": "El archivo es muy grande (tama\u00f1o m\u00e1ximo: %s).", "Error in reading the response from the server": "Error leyendo la respuesta del servidor", "Method %s does not exist on %s.": "El m\u00e9todo %s no existe en %s.", "Input not defined": "Entrada no definida", "Image file type cannot be resized.": "El tipo de imagen no puede ser redimensionada.", "File is not a supported image.": "El archivo no es un tipo de imagen soportada.", "File is not recognized as valid image.": "El archivo no se reconoce como imagen v\u00e1lida.", "File is too big.": "El archivo es muy grande.", "Error during loading of the image.": "Error durante la carga de la imagen.", "Too many \"%s\" boxes (limit: %s).": "Demasiadas \"%s\" cajas (l\u00edmite: %s)", "Too many total boxes (limit: %s).": "Demasiadas cajas en total (l\u00edmite %s).", "Unexpected error: could not finalize box style.": "Error inesperado: no se pudo finalizar el estilo de la caja.", "Background": "Fondo", "Arrange": "Organizar", "Bring to front": "Traer al frente", "Send to back": "Enviar atr\u00e1s", "Bring forward": "Enviar adelante", "Send backward": "Enviar al fondo", "Duplicate": "Duplicar", "Flip": "Voltear", "Vertical": "Vertical", "Horizontal": "Horizontal", "Select background color": "Selecciona el color de fondo", "Opacity": "Opacidad", "Box opacity": "Opacidad de la caja", "Select box opacity": "Selecciona opacidad de la caja", "Select background opacity": "Selecciona opacidad del fondo", "Background opacity": "Opacidad del fondo", "Border": "Borde", "Select border style": "Selecciona estilo del borde", "Select border width": "Selecciona ancho del borde", "Width": "Ancho", "Corners": "Esquinas", "Top left corner": "Esquina superior izquierda", "Top right corner": "Esquina superior derecha", "Bottom left corner": "Esquina inferior izquierda", "Bottom right corner": "Esquina inferior derecha", "Rounded corners": "Bordes redondeados", "Unexpected error: box has no content.": "Error inesperado: la caja no tiene contenido.", "Box type not supplied during registration.": "No se ha suministrado el tipo de caja durante el resgistro.", "Video": "Video", "Click %s to insert text.": "Click %s para insertar texto.", "Done": "Listo", "Done editing": "Edici\u00f3n lista", "Font": "Fuente", "Bold": "Negrita", "Italic": "It\u00e1lica", "Underline": "Subrayado", "Increase font size": "Aumentar tama\u00f1o de fuente", "Decrease font size": "Disminuir tama\u00f1o de fuente", "Text length exceeds the maximum limit.": "El largo del texto excede el l\u00edmite m\u00e1ximo.", "Click %s to insert video.": "Click %s para insertar video.", "Insert video": "Insertar video", "Play video": "Reproducir video", "Pause video": "Pausar video", "Show video": "Mostrar video", "Close video": "Cerrar video", "Please provide a valid link\/embed code for any of the supported video services.": "Por favor provee un enlace \/ c\u00f3digo v\u00e1lido para cualquiera de los servicios de video soportados.", "Could not interpret the content as video.": "No se pudo interpretar el contenido como un video.", "Insert video embed code or url:": "Inserta c\u00f3digo o direcci\u00f3n de video embebido:", "Select video from the list of available videos:": "Seleccionar un video de la lista de videos disponibles:", "Add %s box": "Agregar %s caja", "Set as background": "Asignar como fondo", "Unset from background": "Quitar del fondo", "Error in generating unique id.": "Error generando una id \u00fanica.", "Improper internal call.": "Llamada interna err\u00f3nea.", "Please insert a value.": "Por favor inserta un valor.", "Browser does not support required feature \"%s\".": "El navegador no soporta la caracter\u00edstica requerida \"%s\".", "Could not initialize %s. Container not found.": "No se pudo inicializar %s. No se encontr\u00f3 el contenedor.", "Box type \"%s\" doesn't exist.": "El tipo de caja \"%s\" no existe.", "Error during box creation: %s.": "Error durante la creaci\u00f3n de la caja: %s.", "Saving content.": "Guardando contenido.", "Please wait...": "Por favor espera...", "Removed box. Box type \"%s\" not supported.": "Caja eliminada. Tipo de caja \"%s\" no soportada.", "This is a %s feature.": "Esto es una %s funci\u00f3n.", "For information, please visit %s.": "Para m\u00e1s informaci\u00f3n, por favor visita %s.", "Size": "Tama\u00f1o", "Box": "Caja", "SEO and grouping tags": "SEO y tags", "Additional audio services:": "Servicios de audio adicionales:", "Supported in %s:": "Soportado en %s:", "Current color:": "Color actual:", "Click on the \"%s\" button to start creating content for extra small layouts.": "Click en el bot\u00f3n \"%s\" para comenzar a crear contenido para dise\u00f1os extra peque\u00f1os.", "Start responsive design": "Comenzar dise\u00f1o 'responsive'", "Snap boxes to": "Aplicar cajas en", "Page": "P\u00e1gina", "Boxes": "Cajas", "Content link": "Contenido", "Content": "Contenido", "Edit": "Editar", "Undo": "Deshacer", "Redo": "Rehacer", "Clear all": "Limpiar todo", "Click to set Hex color": "Click para ajustar color Hex", "Click to set RGB color": "Click para ajustar color RGB", "Solid color": "Color s\u00f3lido", "Horiz. gradient": "Degradado horizontal", "Vert. gradient": "Degradado vertical", "Radial gradient": "Degradado radial", "Select color opacity": "Selecciona opacidad de color", "Set custom color (Hex)": "Ajustar color personalizado (Hex)", "Please enter the color in hex format, e.g. %s": "Por favor ingresa el color en formato hex, por ejemplo %s", "You must enter a color.": "Debes ingresar un color.", "Set custom color (RGB)": "Ajusta un color personalizado (RGB)", "Please enter the color in RGB format, with comma-separated components, e.g. %s": "Por favor ingresa un color en formato RGB, con componentes separados por coma, por ejemplo %s"
    }
);
Zedity.i18n.add('fr', {
        "%s needs %s.": "%c n\u00e9cessite %s.", "Click %s to insert a document.": "Cliquer sur %s pour ins\u00e9rer un document.", "Document": "Document", "Insert": "Ins\u00e9rer", "Insert document": "Ins\u00e9rer un document", "Read": "Lire", "Read document": "Lire le document", "Close": "Fermer", "Close document": "Fermer le document", "Please provide a valid link\/embed code for any of the supported document embed services or a direct link to a document.": "Veuillez fournir un code lien\/int\u00e9gr\u00e9 valable pour tous les services int\u00e9gr\u00e9s des documents pris en charge, ou un lien direct vers un document.", "Could not interpret the content as document.": "Impossible d'interpr\u00e9ter le contenu comme un document.", "%s can't be rotated.": "%s ne peut pas \u00eatre tourn\u00e9.", "%s doesn't support background property.": "%s ne supporte pas les propri\u00e9t\u00e9s du fond (background).", "%s doesn't support rounded corners.": "%s ne supporte pas les coins arrondis", "%s doesn't support flipping.": "% s ne supporte pas de retournement.", "Embed": "Int\u00e9gr\u00e9", "Insert document embed code or url:": "Ins\u00e9rer le code du document int\u00e9gr\u00e9 ou l'URL", "Supported services:": "Services support\u00e9s :", "Supported documents:": "Documents support\u00e9s :", "PDF documents, Microsoft Office documents, Apple Pages, Adobe Photoshop and Illustrator, and more.": "Documents PDF, documents Microsoft Office, Apples Pages, Adobe Photoshop, Illustrator et bien d'autres.", "OK": "OK", "Cancel": "Annuler", "Click %s to insert HTML.": "Cliquer %s pour ins\u00e9rer HTML.", "Html": "Html", "Insert HTML": "Ins\u00e9rer HTML", "View": "Voir", "View box content": "Voir le contenu de la bo\u00eete", "Insert HTML code:": "Ins\u00e9rer le code HTML", "Safe mode:": "Mode Sans \u00c9chec :", "Automatic": "Automatique", "Enabled": "Autoris\u00e9", "Disabled": "Invalide", "If you insert Javascript or CSS code and you get unexpected effects (e.g. content overflow, etc.) you need to enable safe mode.": "Si vous ins\u00e9rez du code Javascript ou CSS et que vous obtenez des effets inattendus (par exemple d\u00e9bordement du contenu, etc), vous devez activer le Mode Sans \u00c9chec.", "The (default) automatic setting enables safe mode only if Javascript is detected.": "Le r\u00e9glage automatique (par d\u00e9faut) permet le Mode Sans \u00c9chec seulement si Javascript est d\u00e9tect\u00e9.", "Inserting a %s content into an HTML box is not supported at the moment.": "Ins\u00e9rer un contenu %s dans une bo\u00eete HTML n'est pas support\u00e9, pour l'instant", "Filters": "Filtres", "Apply image filters": "Appliquer des filtres d'images", "Adjust colors": "Ajuster les couleurs", "Black &amp; white": "Noir et Blanc", "Blur": "Flou", "Brightness": "Luminosit\u00e9", "Contrast": "Contraste", "Emboss": "Relief", "Grayscale": "\u00c9chelle de Gris", "Invert": "Inverser", "Mosaic": "Mosa\u00efque", "Motion blur": "Effet de Flou", "Noise": "Bruit", "Paint": "Peindre", "Posterize": "Post\u00e9riser", "Psychedelia": "Psych\u00e9d\u00e9lique", "Sepia": "Tons S\u00e9pia", "Sharpen": "Nettet\u00e9", "Vignette": "Vignette", "Apply filter": "Appliquer le filtre", "Reset filter": "R\u00e9initialiser les filtres", "Remove all filters": "Supprimer tous les filtres", "Error applying filter \"%s\".": "Erreur \u00e0 l'application du filtre \"%s\".", "Filter \"%s\" not defined.": "Le filtre \"%s\" n'est pas d\u00e9fini.", "Could not read image data. Filters cannot be applied on images hosted on a different domain.": "Impossible de lire les donn\u00e9es de l'image. Les filtres ne peuvent pas \u00eatre appliqu\u00e9s sur les images h\u00e9berg\u00e9es sur un domaine diff\u00e9rent.", "Percent": "Pourcentage", "Adjustment": "Ajustement", "Threshold": "Seuil", "Red": "Rouge", "Green": "Vert", "Blue": "Bleu", "Amount": "Quantit\u00e9", "Block size": "Taille des Blocks", "Type": "Type", "Strength": "Intensit\u00e9", "Brush size": "Taille de la brosse", "Link": "Lien", "Add link to box": "Ajouter un lien \u00e0 la bo\u00eete", "This link will be associated to the whole box.": "Ce lien sera associ\u00e9 \u00e0 l'enti\u00e8ret\u00e9 de la bo\u00eete.", "Insert link url:": "Ins\u00e9rer l'URL du lien", "Align": "Aligner", "Align to page": "Aligner \u00e0 la page", "Left": "\u00c0 Gauche", "Center": "Au Centre", "Right": "\u00c0 Droite", "Top": "En Haut", "Middle": "Au Milieu", "Bottom": "En Bas", "Fit width": "Adapter la largeur", "Fit height": "Adapter la hauteur", "Keep aspect ratio": "Conserver les proportions", "Select box padding": "S\u00e9lectionner le remplissage de la bo\u00eete", "Padding": "Padding", "Shadow": "Ombr\u00e9", "Color": "Couleur", "Text": "Texte", "Paragraph": "Paragraphe", "Heading": "Titre", "Align left": "Aligner \u00e0 Gauche", "Align center": "Aligner au Centre", "Align right": "Aligner \u00e0 Droite", "Justify": "Justifier", "Ordered list": "Liste ordonn\u00e9e", "Unordered list": "Liste non ordonn\u00e9e", "Indent": "Renforcer le retrait", "Outdent": "Diminuer le retrait", "Open link in the same tab.": "Ouvrir le lien dans le m\u00eame onglet.", "Open link in a new tab.": "Ouvrir le lien dans un nouvel onglet", "Link style preview": "Aper\u00e7u du style du lien", "Link style": "Style du lien", "Link style on mouse over": "Style de lien sur le mouse over", "Insert link": "Ins\u00e9rer le lien", "Remove": "Supprimer", "The box link may override any link in the text.": "Le lien de la bo\u00eete peut remplacer n'importe quel lien dans le texte.", "Align top": "Aligner en Haut", "Align middle": "Aligner au Milieu", "Align bottom": "Aligner en Bas", "Save": "Sauvegarder", "Abort": "Abandonner", "Edit box": "\u00c9diter la bo\u00eete", "Show": "Voir", "This link will be associated to the whole %s content.": "Ce lien sera associ\u00e9 \u00e0 l'ensemble du contenu %s.", "Width:": "Largeur", "Height:": "Hauteur", "Delete": "Effacer", "Click %s to insert audio.": "Cliquer %s pour ins\u00e9rer l'Audio.", "Audio": "Audio", "Insert audio": "Ins\u00e9rer Audio", "Play": "Play", "Play audio": "Play Audio", "Pause": "Pause", "Pause audio": "Pause Audio", "Show audio": "Afficher l'Audio", "Close audio": "Fermer l'Audio", "Please provide a valid link\/embed code for any of the supported audio services.": "Veuillez fournir, s'il vous pla\u00eet, un code lien\/int\u00e9gr\u00e9 pour chacun des services audio support\u00e9s", "Could not interpret the content as audio.": "Impossible d'interpr\u00e9ter le contenu en tant qu'Audio.", "%s can't be set as background.": "%s ne peut pas \u00eatre d\u00e9fini comme arri\u00e8re-plan", "Files": "Fichiers", "Insert audio embed code or url:": "Ins\u00e9rer le code audio int\u00e9gr\u00e9 ou l'URL :", "Select audio from the list of available audios:": "S\u00e9lectionner l'Audio dans la liste des Audios disponibles.", "Click %s to add color.": "Cliquer sur %s pour ajouter une couleur.", "Click %s to insert image.": "Cliquer sur %s pour ins\u00e9rer une imag", "Image": "Image", "Insert image": "Ins\u00e9rer une image", "Center &amp; fill": "Centrer et remplir", "Fit": "Ajuster", "Stretch": "\u00c9tendre", "Image options": "Options des Images", "Image quality": "Qualit\u00e9 d'image", "Original": "Original", "High": "\u00c9lev\u00e9", "Normal": "Normal", "Low": "Faible", "Proportional resize": "Redimensionnement proportionnel", "Set box to image original size": "Ajuster la bo\u00eete \u00e0 la taille r\u00e9elle de l'image", "Disk": "Disque", "Supported image file types:": "Types de fichiers d'images pris en charge", "Select image file from disk (max size %s):": "S\u00e9lectionnez le fichier d'image sur le disque (taille max% s) :", "Browse...": "Parcourir", "Image quality:": "Qualit\u00e9 d'image", "Insert image URL link:": "Ins\u00e9rer l'URL du lien de l'image", "Image description:": "Description de l'image.", "Please insert image description.": "Veillez ins\u00e9rer la description de l'image.", "Image description is too short.": "La description de l'image est trop courte.", "No file selected.": "Aucun fichier s\u00e9lectionn\u00e9", "Please insert a link.": "Veuillez ins\u00e9rer un lien.", "An unexpected error occurred. Please try again.": "Une erreur inattendue s'est produite. Veuillez, s'il vous pla\u00eet, essayer \u00e0 nouveau.", "There was an error during server image resize.": "Il y a eu une erreur du serveur durant le redimensionnement de l'image.", "Loading...": "Chargement en cours", "Could not interpret the content as image.": "Imposible d'interpr\u00e9ter le contenu comme une image.", "File extension not valid.": "L'extension du fichier n'est pas valide.", "File too big (max size: %s).": "Fichier trop important (taille maximum : %s).", "Error in reading the response from the server": "Erreur dans la lecture de la r\u00e9ponse du serveur", "Method %s does not exist on %s.": "La m\u00e9thode %s n'existe pas sur %s.", "Input not defined": "Entr\u00e9e non d\u00e9finie", "Image file type cannot be resized.": "Ce type de fichier d'image ne peut pas \u00eatre redimensionn\u00e9.", "File is not a supported image.": "Ce format d'image n'erst pas pris en charge.", "File is not recognized as valid image.": "Le fichier n'est pas reconnu comme une image valide.", "File is too big.": "Le fichier est trop important", "Error during loading of the image.": "Erreur pendant le chargement de l'image", "Too many \"%s\" boxes (limit: %s).": "Trop de boites \"%s\" (limite :%s).", "Too many total boxes (limit: %s).": "Trop de bo\u00eetes au total (limite %s).", "Unexpected error: could not finalize box style.": "Erreur inattendue: impossible de finaliser le style de la bo\u00eete.", "Background": "Fond", "Arrange": "Organiser", "Bring to front": "Mettre au premier plan", "Send to back": "Mettre \u00e0 l'arri\u00e8re plan", "Bring forward": "Amener devant", "Send backward": "Envoyer derri\u00e8re", "Duplicate": "Dupliquer", "Flip": "Flip", "Vertical": "Vertical", "Horizontal": "Horizontal", "Select background color": "Choisissez la couleur de fond", "Opacity": "Opacit\u00e9", "Box opacity": "Opacit\u00e9 de la bo\u00eete", "Select box opacity": "Choisissez l'opacit\u00e9 de la bo\u00eete", "Select background opacity": "Choisissez l'opacit\u00e9 du fond", "Background opacity": "Opacit\u00e9 du fond", "Border": "Bordure", "Select border style": "S\u00e9lectionner le style de bordure", "Select border width": "S\u00e9lectionner la largeur de la bordure", "Width": "Largeur", "Corners": "Coins", "Top left corner": "Coin sup\u00e9rieur gauche", "Top right corner": "Coin sup\u00e9rieur droit", "Bottom left corner": "Coin inf\u00e9rieur gauche", "Bottom right corner": "Coin inf\u00e9rieur droit", "Rounded corners": "Coins arrondis", "Unexpected error: box has no content.": "Erreur inattendue : la bo\u00eete n'a pas de contenu.", "Box type not supplied during registration.": "Type de bo\u00eete non fourni durant l'enregistrement.", "Video": "Video", "Click %s to insert text.": "Cliquer %s pour ins\u00e9rer du texte.", "Done": "Termin\u00e9", "Done editing": "\u00c9dition termin\u00e9e", "Font": "Police", "Bold": "Gras", "Italic": "Italique", "Underline": "Soulign\u00e9", "Increase font size": "Augmenter la taille de la police", "Decrease font size": "R\u00e9duire la taille de la police", "Text length exceeds the maximum limit.": "La longueur du texte d\u00e9passe la limite maximale.", "Click %s to insert video.": "Cliquer sur %s pour ins\u00e9rer une video", "Insert video": "Ins\u00e9rer la video", "Play video": "Play video", "Pause video": "Pause video", "Show video": "Afficher la Video", "Close video": "Fermer la Video", "Please provide a valid link\/embed code for any of the supported video services.": "Veuillez fournir un code lien\/int\u00e9gr\u00e9 pour chaque service int\u00e9gr\u00e9 des video prises en charge.", "Could not interpret the content as video.": "Impossible d'interpr\u00e9ter le contenu comme une video.", "Insert video embed code or url:": "Ins\u00e9rer le code int\u00e9gr\u00e9 de la video ou son URL :", "Select video from the list of available videos:": "S\u00e9lectionner une video dans la liste des videos disponibles.", "Add %s box": "Ajouter une bo\u00eete %s", "Set as background": "D\u00e9finir comme fond", "Unset from background": "D\u00e9tach\u00e9 du fond", "Error in generating unique id.": "Erreur dans la g\u00e9n\u00e9ration d'un identifiant unique.", "Improper internal call.": "Appel interne incorrect.", "Please insert a value.": "Veuillez ins\u00e9rer une valeur.", "Browser does not support required feature \"%s\".": "Le navigateur ne supporte pas la fonction exig\u00e9e \"%s\".", "Could not initialize %s. Container not found.": "Impossible d'initialiser %s. Le conteneur est introuvable.", "Box type \"%s\" doesn't exist.": "Le type de bo\u00eete  \"%s\" n'existe pas.", "Error during box creation: %s.": "Erreur pendant la cr\u00e9ation de la bo\u00eete : %s.", "Saving content.": "Sauvegarder le contenu.", "Please wait...": "Veuillez attendre...", "Removed box. Box type \"%s\" not supported.": "La bo\u00eete est supprim\u00e9e. La bo\u00eete du type \"%s\" n'est pas prise en charge.", "This is a %s feature.": "Ceci est une fonction de %s", "For information, please visit %s.": "Pour plus d'information, veuillez visiter %s.", "Size": "Taille", "Box": "Bo\u00eete", "SEO and grouping tags": "SEO et regroupement des tags", "Additional audio services:": "Services additionnels Audio :", "Supported in %s:": "Pris en charge par %s.", "Current color:": "Couleur actuelle :", "Snap boxes to": "Aligner les bo\u00eetes \u00e0", "Page": "Page", "Boxes": "Bo\u00eetes", "Content link": "Lien du Contenu", "Content": "Contenu", "Edit": "\u00c9diter", "Undo": "Annuler", "Redo": "R\u00e9tablir", "Clear all": "Tout effacer", "Click to set Hex color": "Cliquez pour d\u00e9finir la couleur Hex", "Click to set RGB color": "Cliquez pour d\u00e9finir la couleur RVB", "Solid color": "Couleur pleine", "Horiz. gradient": "D\u00e9grad\u00e9 horizontal", "Vert. gradient": "D\u00e9grad\u00e9 vertical", "Radial gradient": "D\u00e9grad\u00e9 radial", "Select color opacity": "S\u00e9lectionner l'opacit\u00e9 de la couleur", "Set custom color (Hex)": "D\u00e9finir une couleur personnalis\u00e9e (Hex)", "Please enter the color in hex format, e.g. %s": "Veuillez entrer la couleur au formatt hex, par exemple %s", "You must enter a color.": "Vous devez entrer une couleur", "Set custom color (RGB)": "D\u00e9finir une couleur personnalis\u00e9e (RGB)", "Please enter the color in RGB format, with comma-separated components, e.g. %s": "Veuillez entrer la couleur au format RGB, avec les composants s\u00e9par\u00e9s par des virgules, par exemple %s"
    }
);
Zedity.i18n.add('hu', {
        "%s needs %s.": "%s hez sz\u00fcks\u00e9ges %s.", "Click %s to insert a document.": "Klikkeljen %s egy dokumentum beilleszt\u00e9s\u00e9hez.", "Document": "Dokumentum", "Insert": "Beilleszt\u00e9s", "Insert document": "Dokumentum beilleszt\u00e9se", "Read": "Olvas\u00e1s", "Read document": "Dokumentum olvas\u00e1sa", "Close": "Bez\u00e1r\u00e1s", "Close document": "Dokumentum bez\u00e1r\u00e1sa", "Please provide a valid link\/embed code for any of the supported document embed services or a direct link to a document.": "K\u00e9rj\u00fck adjon meg egy \u00e9rv\u00e9nyes linket\/be\u00e1gyaz\u00e1si k\u00f3dot b\u00e1rmelyik t\u00e1mogatott dokumentum be\u00e1gyaz\u00f3 szolg\u00e1ltat\u00f3hoz, vagy egy k\u00f6zvetlen linket egy dokumentumhoz.", "Could not interpret the content as document.": "A tartalmat nem tudja dokumentumnak tekinteni.", "%s can't be rotated.": "%s nem lehet elforgatni.", "%s doesn't support background property.": "%s nem t\u00e1mogatja a h\u00e1tt\u00e9r tulajdons\u00e1gait.", "%s doesn't support rounded corners.": "%s nem t\u00e1mogatja a kerek\u00edtett sarkokat.", "%s doesn't support flipping.": "%s nem t\u00e1mogatja a t\u00fckr\u00f6z\u00e9st.", "Embed": "Be\u00e1gyaz\u00e1s", "Insert document embed code or url:": "Be\u00e1gyaz\u00e1si k\u00f3d vagy url beilleszt\u00e9se:", "Supported services:": "T\u00e1mogatott szolg\u00e1ltat\u00e1sok:", "Supported documents:": "T\u00e1mogatott dokumentumok:", "PDF documents, Microsoft Office documents, Apple Pages, Adobe Photoshop and Illustrator, and more.": "PDF, MS Office, Apple Pages, Adobe  Photoshop \u00e9s  Illustrator, \u00e9s m\u00e9g t\u00f6bb m\u00e1s dokumentum.", "OK": "OK", "Cancel": "T\u00f6rl\u00e9s", "Click %s to insert HTML.": "HTML beilleszt\u00e9shez klikkeljen a %s.", "Html": "Html", "Insert HTML": "HTML beilleszt\u00e9se", "View": "N\u00e9zet", "View box content": "Doboz tartalm\u00e1nak n\u00e9zete", "Insert HTML code:": "HTML k\u00f3d beilleszt\u00e9se:", "Safe mode:": "Biztons\u00e1gos m\u00f3d:", "Automatic": "Automatikus", "Enabled": "Enged\u00e9lyezett", "Disabled": "Letiltott", "If you insert Javascript or CSS code and you get unexpected effects (e.g. content overflow, etc.) you need to enable safe mode.": "Ha Javascript vagy CSS k\u00f3dok beilleszt\u00e9sekor v\u00e1ratlan jelens\u00e9get tapasztal (pl. tartalom t\u00falfoly\u00e1s) kapcsolja be a biztons\u00e1gos m\u00f3dot.", "The (default) automatic setting enables safe mode only if Javascript is detected.": "Az (alap) automatikus be\u00e1ll\u00edt\u00e1s csak akkor enged\u00e9lyezi a biztons\u00e1gos m\u00f3dot, ha Javascriptet \u00e9szlel.", "Some scripts (for example social network services) need to access the page, so the \"Safe mode\" must be disabled in these cases.": "N\u00e9h\u00e1ny szkriptnek (pl. k\u00f6z\u00f6ss\u00e9gi h\u00e1l\u00f3zati szolg\u00e1ltat\u00e1s) az oldalhoz hozz\u00e1 kell f\u00e9rnie, ez\u00e9rt ilyenkor a \"Biztons\u00e1gos m\u00f3d\" ot le kell tiltani.", "Inserting a %s content into an HTML box is not supported at the moment.": "A HTML dobozba %s tartalom illeszt\u00e9se jelenleg nem t\u00e1mogatott.", "Filters": "Sz\u0171r\u0151k", "Apply image filters": "K\u00e9p sz\u0171r\u0151k alkalmaz\u00e1sa", "Adjust colors": "Sz\u00ednek igaz\u00edt\u00e1sa", "Black &amp; white": "Fekete &amp; feh\u00e9r", "Blur": "Hom\u00e1lyoss\u00e1g", "Brightness": "F\u00e9nyess\u00e9g", "Contrast": "Kontraszt", "Emboss": "Domborhat\u00e1s", "Grayscale": "Sz\u00fcrke sk\u00e1la", "Invert": "Megford\u00edtott", "Mosaic": "Mozaik", "Motion blur": "Mozg\u00e1s hom\u00e1lyos", "Noise": "Zaj", "Paint": "Fest\u00e9s", "Posterize": "Poszter hat\u00e1s", "Psychedelia": "Pszichedelikus", "Sepia": "Sz\u00e9piasz\u00edn", "Sharpen": "\u00c9les\u00edt\u00e9s", "Vignette": "Vignetta", "Apply filter": "Sz\u0171r\u0151 alkalmaz\u00e1sa", "Reset filter": "Sz\u0171r\u0151 vissza\u00e1ll\u00edt\u00e1sa", "Remove all filters": "Minden sz\u0171r\u0151 elt\u00e1vol\u00edt\u00e1sa", "Error applying filter \"%s\".": "Hiba a \"%s\" sz\u0171r\u0151 alkalmaz\u00e1sa k\u00f6zben.", "Filter \"%s\" not defined.": "A \"%s\" sz\u0171r\u0151 nincs meghat\u00e1rozva.", "Could not read image data. Filters cannot be applied on images hosted on a different domain.": "K\u00e9p adatai nem olvashat\u00f3k. M\u00e1sik domainen lev\u0151 k\u00e9pekre a sz\u0171r\u0151k nem alkalmazhat\u00f3k.", "Percent": "Sz\u00e1zal\u00e9k", "Adjustment": "Be\u00e1ll\u00edt\u00e1s", "Threshold": "K\u00fcsz\u00f6b\u00e9rt\u00e9k", "Red": "Piros", "Green": "Z\u00f6ld", "Blue": "K\u00e9k", "Amount": "Mennyis\u00e9g", "Block size": "Blokk m\u00e9rete", "Type": "T\u00edpus", "Strength": "Er\u0151ss\u00e9g", "Brush size": "Ecset m\u00e9rete", "Link": "Link", "Add link to box": "Adjon linket a dobozhoz.", "This link will be associated to the whole box.": "Ez a link az eg\u00e9sz dobozra \u00e9rv\u00e9nyes lesz.", "Insert link url:": "Link url beilleszt\u00e9se:", "Align": "Igaz\u00edt\u00e1s", "Align to page": "Igaz\u00edt\u00e1s az oldalhoz", "Left": "Bal", "Center": "K\u00f6z\u00e9p", "Right": "Jobb", "Top": "Fel\u00fcl", "Middle": "K\u00f6z\u00e9pen", "Bottom": "Alul", "Fit width": "Illeszt\u00e9si sz\u00e9less\u00e9g", "Fit height": "Illeszt\u00e9si magass\u00e1g", "Position and size": "Helyzet \u00e9s m\u00e9ret", "Set box position %s.": "\u00c1ll\u00edtsa be a doboz helyzet\u00e9t %s.", "W:": "SZ:", "H:": "M:", "Set box width": "\u00c1ll\u00edtsa be a doboz sz\u00e9less\u00e9g\u00e9t", "(min: %s, max: %s)": "(min: %s, max: %s)", "Set box height": "\u00c1ll\u00edtsa be a doboz magass\u00e1g\u00e1t", "Keep aspect ratio": "Ar\u00e1nyok megtart\u00e1sa", "Select box padding": "Doboz kit\u00f6lt\u00e9s, padding v\u00e1laszt\u00e1sa", "Padding": "Padding, kit\u00f6lt\u00e9s", "Shadow": "\u00c1rny\u00e9k", "Predefined": "El\u0151re meghat\u00e1rozott", "Select predefined shadow": "V\u00e1lasszon el\u0151re meghat\u00e1rozott \u00e1rny\u00e9kot", "No shadow": "Nincs \u00e1rny\u00e9k", "Shadow at bottom right": "Jobb als\u00f3 \u00e1rny\u00e9k", "Shadow at bottom left": "Bal als\u00f3 \u00e1rny\u00e9k", "Shadow at top right": "Jobb fels\u0151 \u00e1rny\u00e9k", "Shadow at top left": "Bal fels\u0151 \u00e1rny\u00e9k", "Diffuse shadow": "Diff\u00faz \u00e1rny\u00e9k", "Color": "Sz\u00edn", "Select shadow color": "V\u00e1lasszon \u00e1rny\u00e9k sz\u00ednt", "Box shadow": "Doboz \u00e1rny\u00e9ka", "Horizontal position": "Horizont\u00e1lis poz\u00edci\u00f3", "Select shadow horizontal position": "\u00c1rny\u00e9k horizont\u00e1lis poz\u00edci\u00f3j\u00e1nak v\u00e1laszt\u00e1sa", "Vertical position": "Vertik\u00e1lis poz\u00edci\u00f3", "Select shadow vertical position": "\u00c1rny\u00e9k vertik\u00e1lis poz\u00edci\u00f3j\u00e1nak v\u00e1laszt\u00e1sa", "Select shadow blur": "\u00c1rny\u00e9k hom\u00e1lyoss\u00e1g\u00e1nak v\u00e1laszt\u00e1sa", "Spread": "Kiterjed\u00e9s", "Select shadow spread": "\u00c1rny\u00e9k m\u00e9ret\u00e9nek v\u00e1laszt\u00e1sa", "Inset": "Bem\u00e9lyed\u00e9s", "Shadow inset": "\u00c1rny\u00e9k bem\u00e9lyed\u00e9se", "Text": "Sz\u00f6veg", "Paragraph": "Paragrafus", "Select paragraph": "Paragrafus v\u00e1laszt\u00e1sa", "Heading": "Fejl\u00e9c", "Align left": "Balra igaz\u00edt\u00e1s", "Align center": "K\u00f6z\u00e9pre igaz\u00edt\u00e1s", "Align right": "Jobbra igaz\u00edt\u00e1s", "Justify": "K\u00e9toldali igaz\u00edt\u00e1s", "Select line height": "Sormagass\u00e1g v\u00e1laszt\u00e1sa", "Ordered list": "Sz\u00e1mozott lista", "Unordered list": "Rendezetlen lista", "Select paragraph spacing": "Paragrafus sort\u00e1vols\u00e1g v\u00e1laszt\u00e1sa", "Indent": "Sor beh\u00faz\u00e1sa", "Outdent": "Sor kih\u00faz\u00e1sa", "Subscript": "Als\u00f3 index", "Superscript": "Fels\u0151 index", "Open link in the same frame.": "Link megnyit\u00e1sa ebben az ablakban.", "Open link in the same tab.": "Link megnyit\u00e1sa ugyanebben a f\u00fclben.", "Open link in a new tab.": "Link megnyit\u00e1sa \u00faj f\u00fclben.", "Link style preview": "Link st\u00edlus el\u0151n\u00e9zete", "Link style": "Link s\u00edtlusa", "Link style on mouse over": "Link st\u00edlusa eg\u00e9r \u00e1tvezet\u00e9sekor", "Insert link": "Link beilleszt\u00e9se", "Remove": "Elt\u00e1vol\u00edt\u00e1s", "The box link may override any link in the text.": "A doboz linkje fel\u00fcl\u00edr minden linket, ami a sz\u00f6vegben el\u0151fordul.", "Align top": "Illeszt\u00e9s fel\u00fcl", "Align middle": "Illeszt\u00e9s k\u00f6z\u00e9pen", "Align bottom": "Illeszt\u00e9s alul", "Extra small layout": "Nagyon kicsi elrendez\u00e9s", "Small layout": "Kicsi elrendez\u00e9s", "Medium layout": "K\u00f6zepes elrendez\u00e9s", "Large layout": "Nagy elrendez\u00e9s", "If you perform this action you will revert to a non-responsive design. Are you sure?": "Ezzel az utas\u00edt\u00e1ssal visszat\u00e9r a nem reszponz\u00edv diz\u00e1jnhoz. Biztosan ezt akarja?", "You can start your design from any layout.": "B\u00e1rmilyen elrendez\u00e9sben kezdheti a tervez\u00e9st.", "Boxes can be added in any layout and can be modified only in the layout they were added to.": "B\u00e1rmilyen elrendez\u00e9sben hozz\u00e1 adhat\u00f3k dobozok, de azok csak abban az elrendez\u00e9sben m\u00f3dos\u00edthat\u00f3k, amiben hozz\u00e1 lettek adva.", "Boxes added in a layout can be hidden in other layouts.": "Egy adott elrendez\u00e9sben hozz\u00e1adott dobozok elrejthet\u0151k egy m\u00e1sik elrendez\u00e9sben.", "Custom layouts:": "Felhaszn\u00e1l\u00f3i elrendez\u00e9sek:", "Add custom layout": "Felhaszn\u00e1l\u00f3i elrendez\u00e9s hozz\u00e1ad\u00e1sa", "Multiple layout responsive design": "T\u00f6bbsz\u00f6r\u00f6s elrendez\u00e9s\u0171 reszponz\u00edv diz\u00e1jn", "The width of custom layouts can be adjusted to fit larger designs.": "A felhaszn\u00e1l\u00f3i elrendez\u00e9s sz\u00e9less\u00e9ge v\u00e1ltoztathat\u00f3, hogy nagyobb diz\u00e1jnba is belef\u00e9rjen.", "Click on a layout button to start creating content for that layout.": "Kattintson egy elrendez\u00e9sre, majd kezdje el a tartalom k\u00e9sz\u00edt\u00e9s\u00e9t.", "Save": "Ment\u00e9s", "Abort": "Elvet\u00e9s", "You may want to review the design for layouts in yellow.": "Javasoljuk a s\u00e1rg\u00e1val jel\u00f6lt elrendez\u00e9s diz\u00e1jnjainak \u00e1tn\u00e9z\u00e9s\u00e9t.", "Save without reviewing": "Ment\u00e9s \u00e1tn\u00e9z\u00e9s n\u00e9lk\u00fcl", "Please click on the layouts in gray to provide the design for all layouts.": "K\u00e9rj\u00fck kattintson a sz\u00fcrke elrendez\u00e9sre, hogy az \u00f6sszes elrendez\u00e9shez adjon diz\u00e1jnt.", "Save anyway (not recommended)": "Ment\u00e9s mindenk\u00e9ppen (nem aj\u00e1nlott)", "Your responsive content is ready to be saved!": "Az \u00f6n reszponz\u00edv tartalma k\u00e9szen \u00e1ll a ment\u00e9sre!", "This box was created in another layout.": "Ez a doboz egy m\u00e1sik elrendez\u00e9sben k\u00e9sz\u00fclt.", "To modify its content edit the layout \"%s\".": "A tartalom m\u00f3dos\u00edt\u00e1s\u00e1hoz szerkessze a \"%s\" elrendez\u00e9st.", "The box is hidden in this layout.": "A doboz rejtve van ebben az elrendez\u00e9sben.", "Show box": "Doboz mutat\u00e1sa", "Responsive": "Reszponz\u00edv", "Start %s": "%s kezd\u00e9se", "Save \"%s\"": "Save \"%s\"", "Edit box": "Doboz szerkeszt\u00e9se", "Layout": "Elrendez\u00e9s", "Show": "Mutassa", "Show box in this layout": "Doboz mutat\u00e1sa ebben az elrendez\u00e9sben", "Hide": "Elrejt\u00e9s", "Hide box in this layout": "Doboz elrejt\u00e9se ebben az elrendez\u00e9sben", "Box style": "Doboz st\u00edlusa", "This link will be associated to the whole %s content.": "A link a teljes %s tartalomhoz kapcsol\u00f3dik.", "This is useful to create all clickable contents, like banners, etc. If you need to create a textual link, instead, enter the \"boxes\" menu.": "Ez nagyon hasznos, ha teljes klikkelhet\u0151 tartalmat k\u00e9sz\u00edt, pl. bannert, stb. Ha sz\u00f6veges linket akar k\u00e9sz\u00edteni, l\u00e9pjen be a \"dobozok\"  men\u00fcbe. ", "Snap": "Automatikus igaz\u00edt\u00e1s", "Snap boxes to page": "Dobozok automatikus igaz\u00edt\u00e1sa az oldalhoz", "Snap boxes to boxes": "Dobozok automatikus igaz\u00edt\u00e1sa a dobozokhoz", "Snap boxes to grid": "Dobozok automatikus igaz\u00edt\u00e1sa a r\u00e1cshoz", "Grid": "R\u00e1cs", "Width:": "Sz\u00e9less\u00e9g:", "Set grid width": "\u00c1ll\u00edtsa be a r\u00e1cs sz\u00e9less\u00e9g\u00e9t", "Height:": "Magass\u00e1g:", "Set grid height": "\u00c1ll\u00edtsa be a r\u00e1cs magass\u00e1g\u00e1t", "Lock width and height": "Z\u00e1rolja a sz\u00e9less\u00e9get \u00e9s magass\u00e1got.", "Templates": "Sablonok", "New Template": "\u00daj sablon", "Save current content as Template": "Jelenlegi tartalom ment\u00e9se sablonk\u00e9nt", "Load selected Template into editor": "V\u00e1lasztott sablon bet\u00f6lt\u00e9se a szerkeszt\u0151be", "Load": "Bet\u00f6lt\u00e9s", "Delete selected Template": "V\u00e1lasztott sablon t\u00f6rl\u00e9se", "Delete": "T\u00f6rl\u00e9s", "An error occurred while saving the Template. Please try again.": "Hiba a sablon ment\u00e9se k\u00f6zben. K\u00e9rj\u00fck pr\u00f3b\u00e1lja \u00fajra.", "Template \"%s\" saved.": "A sablon \"%s\"  elmentve.", "The current content will overwrite the selected Template. Are you sure?": "A jelenlegi tartalom fel\u00fcl\u00edrja a kiv\u00e1lasztott sablont. Biztosan ezt akarja?", "Give a title to your Template:": "Adjon c\u00edmet a sablonnak:", "A Template with that title already exists, please change the title.": "Ilyen c\u00edm\u0171 sablon m\u00e1r l\u00e9tezik, k\u00e9rj\u00fck v\u00e1ltoztasson c\u00edmet.", "The Template will overwrite the current editor content. Are you sure?": "A sablon fel\u00fcl\u00edrja a szerkeszt\u0151ben lev\u0151 jelenlegi tartalmat. Biztosan ezt akarja?", "An error occurred while loading the Template. Please try again.": "Hiba a sablon bet\u00f6lt\u00e9se k\u00f6zben. K\u00e9rj\u00fck pr\u00f3b\u00e1lja \u00fajra.", "Template \"%s\" loaded.": "A sablon \"%s\" bet\u00f6ltve.", "Are you sure you want to delete the selected Template?": "Biztosan t\u00f6r\u00f6lni akarja a kiv\u00e1lasztot sablont?", "An error occurred while deleting the Template. Please try again.": "Hiba a sablon t\u00f6rl\u00e9se k\u00f6zben. K\u00e9rj\u00fck pr\u00f3b\u00e1lja \u00fajra.", "Click %s to insert audio.": "Klikkeljen %s audi\u00f3 beilleszt\u00e9s\u00e9hez.", "Audio": "Audi\u00f3", "Insert audio": "Audi\u00f3 beilleszt\u00e9se", "Play": "Lej\u00e1tsz\u00e1s", "Play audio": "Audi\u00f3 lej\u00e1tsz\u00e1sa", "Pause": "Sz\u00fcnet", "Pause audio": "Lej\u00e1tsz\u00e1s sz\u00fcneteltet\u00e9se", "Show audio": "Audi\u00f3 mutat\u00e1sa", "Close audio": "Audi\u00f3 bez\u00e1r\u00e1sa", "Please provide a valid link\/embed code for any of the supported audio services.": "K\u00e9rj\u00fck adon meg egy \u00e9rv\u00e9nyes linket\/be\u00e1gyaz\u00f3 k\u00f3dot b\u00e1rmely t\u00e1mogatott audi\u00f3 szolg\u00e1ltat\u00e1shoz.", "Could not interpret the content as audio.": "A tartalmat nem lehet audi\u00f3k\u00e9nt \u00e9rt\u00e9kelni.", "%s can't be set as background.": "%s nem lehet h\u00e1tt\u00e9r.", "Files": "F\u00e1jlok", "Insert audio embed code or url:": "Audi\u00f3 be\u00e1gyaz\u00f3 k\u00f3d vagy az url beilleszt\u00e9se:", "Select audio from the list of available audios:": "V\u00e1lasszon audi\u00f3t az el\u00e9rhet\u0151 audi\u00f3k list\u00e1j\u00e1r\u00f3l:", "Click %s to add color.": "Klikkeljen %s sz\u00ednez\u00e9shez.", "Add": "Hozz\u00e1ad\u00e1s", "Add color": "Sz\u00edn hozz\u00e1ad\u00e1sa", "Click %s to insert image.": "Klikkeljen %s k\u00e9p hozz\u00e1ad\u00e1s\u00e1hoz", "Image": "K\u00e9p", "Insert image": "K\u00e9p beilleszt\u00e9se", "Select image layout": "K\u00e9p elrendez\u00e9s v\u00e1laszt\u00e1sa", "Center &amp; fill": "K\u00f6z\u00e9pen &amp; kit\u00f6lt\u00e9s", "Fit": "Illeszt\u00e9s", "Stretch": "Ny\u00fajtott", "Options": "Opci\u00f3k", "Image options": "K\u00e9p opci\u00f3k", "Image quality": "K\u00e9p min\u0151s\u00e9g", "Original": "Eredeti", "High": "Magas", "Normal": "Norm\u00e1l", "Low": "Alacsony", "Proportional resize": "Ar\u00e1nyos \u00e1tm\u00e9retez\u00e9s", "Set box to image original size": "Igaz\u00edtsa a doboz m\u00e9ret\u00e9t a k\u00e9p eredeti m\u00e9ret\u00e9hez", "Disk": "Lemez", "Supported image file types:": "T\u00e1mogatott k\u00e9p f\u00e1jl form\u00e1k:", "Select image file from disk (max size %s):": "V\u00e1lasszon k\u00e9pet a lemezr\u0151l (max. m\u00e9ret %s):", "Browse...": "Keres\u00e9s...", "Image quality:": "K\u00e9p min\u0151s\u00e9g:", "Insert image URL link:": "K\u00e9p url link beilleszt\u00e9se:", "Image description:": "K\u00e9p le\u00edr\u00e1sa:", "Please insert image description.": "K\u00e9rj\u00fck illessze be a k\u00e9p le\u00edr\u00e1s\u00e1t.", "Image description is too short.": "A k\u00e9p le\u00edr\u00e1sa t\u00fal r\u00f6vid.", "No file selected.": "Nincs kiv\u00e1lasztott f\u00e1jlt.", "Please insert a link.": "K\u00e9rj\u00fck illesszen be egy linket.", "An unexpected error occurred. Please try again.": "V\u00e1ratlan hiba mer\u00fclt fel. K\u00e9rj\u00fck ism\u00e9telje meg.", "There was an error during server image resize.": "Hiba mer\u00fclt fel a szerveren lev\u0151 k\u00e9p \u00fajram\u00e9retez\u00e9sekor.", "Loading...": "Felt\u00f6lt\u00e9s...", "Could not interpret the content as image.": "A tartalmat nem lehet k\u00e9pk\u00e9nt \u00e9rz\u00e9kelni.", "File extension not valid.": "\u00c9rv\u00e9nytelen a f\u00e1jl kiterjeszt\u00e9se.", "File too big (max size: %s).": "T\u00fal nagy f\u00e1jl (max. m\u00e9ret %s).", "Error in reading the response from the server": "Hiba a szerver v\u00e1lasz\u00e1nak olvas\u00e1sakor.", "Method %s does not exist on %s.": "A %s m\u00f3dszer nem l\u00e9tezik a %s.", "Input not defined": "Nincs meghat\u00e1rozva a bemenet", "Image file type cannot be resized.": "Ezt a k\u00e9p f\u00e1jl t\u00edpust nem lehet \u00fajram\u00e9retezni.", "File is not a supported image.": "A k\u00e9pf\u00e1jl nem t\u00e1mogatott.", "File is not recognized as valid image.": "A f\u00e1jl nem tekinthet\u0151 \u00e9rv\u00e9nyes k\u00e9pnek.", "File is too big.": "A f\u00e1jl t\u00fal nagy.", "Error during loading of the image.": "Hiba a k\u00e9p bet\u00f6lt\u00e9se sor\u00e1n.", "Too many \"%s\" boxes (limit: %s).": "T\u00fal sok \"%s\" doboz (limit: %s).", "Too many total boxes (limit: %s).": "T\u00fal sok az \u00f6sszes doboz (limit: %s).", "Unexpected error: could not finalize box style.": "V\u00e1ratlan hiba: a doboz stiliz\u00e1l\u00e1sa nincs befejezve.", "Background": "H\u00e1tt\u00e9r", "Set selected box as background": "A v\u00e1lasztott dobozt \u00e1ll\u00edtsa be h\u00e1tt\u00e9rk\u00e9nt.", "Unset box from background": "V\u00e1lassza le a dobozt a h\u00e1tt\u00e9rt\u0151l.", "Arrange": "Elrendez\u00e9si sorrend", "Arrange box": "Doboz elrendez\u00e9se", "Bring to front": "Hozza el\u0151re", "Send to back": "K\u00fcldje legh\u00e1tra", "Bring forward": "Hozza el\u0151r\u00e9bb", "Send backward": "K\u00fcldje h\u00e1tr\u00e9bb", "Editing": "Szerkeszt\u00e9s", "Duplicate": "M\u00e1sol\u00e1s", "Duplicate selected box": "A v\u00e1lasztott doboz m\u00e1sol\u00e1sa", "Delete selected box": "A v\u00e1lasztott doboz t\u00f6rl\u00e9se", "Flip": "T\u00fckr\u00f6z\u00e9s", "Vertical": "Vertik\u00e1lis", "Flip selected box vertically": "A v\u00e1lasztott doboz vertik\u00e1lis t\u00fckr\u00f6z\u00e9se", "Horizontal": "Horizont\u00e1lis", "Flip selected box horizontally": "A v\u00e1lasztott doboz horizont\u00e1lis t\u00fckr\u00f6z\u00e9se", "Select background color": "H\u00e1tt\u00e9r sz\u00edn be\u00e1ll\u00edt\u00e1sa", "Opacity": "\u00c1tl\u00e1tsz\u00f3s\u00e1g", "Box opacity": "Doboz \u00e1tl\u00e1tsz\u00f3s\u00e1ga", "Select box opacity": "Doboz \u00e1tl\u00e1tsz\u00f3s\u00e1g kiv\u00e1laszt\u00e1sa", "Select background opacity": "H\u00e1tt\u00e9r \u00e1tl\u00e1tsz\u00f3s\u00e1g kiv\u00e1laszt\u00e1sa", "Background opacity": "H\u00e1tt\u00e9r \u00e1tl\u00e1tsz\u00f3s\u00e1ga", "Border": "Keret", "Select border style": "Keret st\u00edlus kiv\u00e1laszt\u00e1sa", "Select border color": "Keret sz\u00edn kiv\u00e1laszt\u00e1sa", "Select border width": "Keret sz\u00e9less\u00e9g kiv\u00e1laszt\u00e1sa", "Width": "Sz\u00e9less\u00e9g", "Corners": "Sarkok", "Top left corner": "Bal fels\u0151 sarok", "Top right corner": "Jobb fels\u0151 sarok", "Bottom left corner": "Bal als\u00f3 sarok", "Bottom right corner": "Jobb als\u00f3 sarok", "Rounded corners": "Kerek\u00edtett sarkok", "Radius": "Sug\u00e1r", "Unexpected error: box has no content.": "V\u00e1ratlan hiba: a doboz \u00fcres.", "Box type not supplied during registration.": " A doboz t\u00edpus\u00e1t nem adt\u00e1k meg a regisztr\u00e1l\u00e1skor.", "Video": "Vide\u00f3", "Click %s to insert text.": "Klikkeljen a %s sz\u00f6veg beilleszt\u00e9shez", "Insert\/edit text": "Sz\u00f6veg beilleszt\u00e9se\/szerkeszt\u00e9se", "Text alignment": "Sz\u00f6veg igaz\u00edt\u00e1sa", "Done": "K\u00e9sz", "Done editing": "Szerkeszt\u00e9s k\u00e9sz", "Font": "Bet\u0171", "Bold": "K\u00f6v\u00e9r", "Italic": "D\u0151lt", "Underline": "Al\u00e1h\u00fazott", "Select font size": "V\u00e1lasszon bet\u0171m\u00e9retet", "Select font color": "V\u00e1lasszon bet\u0171 sz\u00ednt", "Increase font size": "Bet\u0171m\u00e9ret n\u00f6vel\u00e9se", "Decrease font size": "Bet\u0171m\u00e9ret cs\u00f6kkent\u00e9se", "Text length exceeds the maximum limit.": "A sz\u00f6veg hossza meghaladja a maximumot.", "Plain text.": "Form\u00e1zatlan sz\u00f6veg.", "Formatted text.": "Form\u00e1zott sz\u00f6veg.", "Paste text": "Sz\u00f6veg bem\u00e1sol\u00e1sa", "Click %s to insert video.": "Klikkeljen a %s vide\u00f3 beilleszt\u00e9s\u00e9hez.", "Insert video": "Vide\u00f3 beilleszt\u00e9se", "Play video": "Vide\u00f3 lej\u00e1tsz\u00e1sa", "Pause video": "Vide\u00f3 sz\u00fcneteltet\u00e9se", "Show video": "Mutassa a vide\u00f3t", "Close video": "Vide\u00f3 bez\u00e1r\u00e1sa", "Please provide a valid link\/embed code for any of the supported video services.": "K\u00e9rj\u00fck adjon meg egy \u00e9rv\u00e9nyes linket\/be\u00e1gyaz\u00e1si k\u00f3dot b\u00e1rmelyik t\u00e1mogatott vide\u00f3 szolg\u00e1ltat\u00f3hoz.", "Could not interpret the content as video.": "A tartalmat nem lehet vide\u00f3k\u00e9nt \u00e9rt\u00e9kelni.", "Insert video embed code or url:": "Vide\u00f3 be\u00e1gyaz\u00e1si k\u00f3d vagy url beilleszt\u00e9se:", "Select video from the list of available videos:": "V\u00e1lasszon vide\u00f3t az el\u00e9rhet\u0151 vide\u00f3k list\u00e1j\u00e1r\u00f3l:", "Add %s box": "Doboz %s hozz\u00e1ad\u00e1sa", "Set as background": "\u00c1ll\u00edtsa be h\u00e1tt\u00e9rk\u00e9nt", "Unset from background": "V\u00e1lassza le a h\u00e1tt\u00e9rr\u0151l", "Error in generating unique id.": "Hiba az egyedi ID gener\u00e1l\u00e1sakor.", "Improper internal call.": "Nem megfelel\u0151 bels\u0151 h\u00edv\u00e1s.", "Please insert a value.": "\u00c9rt\u00e9k beiIleszt\u00e9se.", "Browser does not support required feature \"%s\".": "A keres\u0151 nem t\u00e1mogatja a k\u00e9rt tulajdons\u00e1got \"%s\".", "Could not initialize %s. Container not found.": "Sikertelen a %s inicializ\u00e1l\u00e1sa. Kont\u00e9ner nem tal\u00e1lhat\u00f3.", "Box type \"%s\" doesn't exist.": "A doboz t\u00edpus \"%s\" nem l\u00e9tezik.", "Error during box creation: %s.": "Hiba a doboz k\u00e9sz\u00edt\u00e9se k\u00f6zben: %s.", "Saving content.": "Tartalom ment\u00e9se.", "Please wait...": "K\u00e9rj\u00fck v\u00e1rjon...", "Removed box. Box type \"%s\" not supported.": "Doboz elt\u00e1vol\u00edtva. A doboz t\u00edpusa \"%s\" nem t\u00e1mogatott.", "This is a %s feature.": "Ez egy %s tulajdons\u00e1g.", "For information, please visit %s.": "Tov\u00e1bbi inform\u00e1ci\u00f3\u00e9rt k\u00e9rj\u00fck keresse fel %s.", "Box size and position": "Doboz m\u00e9rete \u00e9s helyzete", "Size": "M\u00e9ret", "Box": "Doboz", "SEO and grouping tags": "SEO \u00e9s csoport tagek.", "Additional audio services:": "Kieg\u00e9sz\u00edt\u0151 audi\u00f3 szolg\u00e1ltat\u00e1sok:", "Supported in %s:": "T\u00e1mogatva a %s:", "Current color:": "Jelenlegi sz\u00edn:", "Click on the \"%s\" button to start creating content for extra small layouts.": "Klikkeljen a \"%s\" gombra, hogy tartalmat k\u00e9sz\u00edthessen extra kicsi elrendez\u00e9sekhez.", "Start responsive design": "Reszponz\u00edv diz\u00e1jn kezd\u00e9se", "Snap boxes to": "Dobozok automatikus illeszt\u00e9se", "Page": "Oldal", "Boxes": "Dobozok", "Content link": "Tartalom link", "Content": "Tartalom", "Set content width": "Tartalom sz\u00e9less\u00e9g be\u00e1ll\u00edt\u00e1sa", "Set content height": "Tartalom magass\u00e1g be\u00e1ll\u00edt\u00e1sa", "Edit": "Szerkeszt\u00e9s", "Undo modifications": "M\u00f3dos\u00edt\u00e1sok visszavon\u00e1sa", "Undo": "Visszavon\u00e1s", "Redo modifications": "M\u00f3dos\u00edt\u00e1sok vissza\u00e1ll\u00edt\u00e1sa", "Redo": "Vissza\u00e1ll\u00edt\u00e1s", "Clear all": "Minden t\u00f6rl\u00e9se", "Basic": "Alap", "Media embed": "M\u00e9dia be\u00e1gyaz\u00e1s", "Advanced": "Halad\u00f3", "Add box:": "Doboz hozz\u00e1ad\u00e1sa:", "Click to set Hex color": "Klikkeljen a HEXA sz\u00edn be\u00e1ll\u00edt\u00e1shoz", "Click to set RGB color": "Klikkeljen az RGB sz\u00edn be\u00e1ll\u00edt\u00e1shoz", "Solid color": "Egysz\u00edn\u0171", "Horiz. gradient": "Horizont\u00e1lis gr\u00e1diens", "Vert. gradient": "Vertik\u00e1lis gr\u00e1diens", "Radial gradient": "K\u00f6ralak\u00fa gr\u00e1diens", "Select color opacity": "Sz\u00edn \u00e1tl\u00e1tsz\u00f3s\u00e1g v\u00e1laszt\u00e1sa", "Set custom color (Hex)": "Felhaszn\u00e1l\u00f3i sz\u00edn v\u00e1laszt\u00e1sa (HEXA)", "Please enter the color in hex format, e.g. %s": "Adja meg a sz\u00edn HEXA form\u00e1tum\u00e1t, pl. %s", "You must enter a color.": "Adjon meg egy sz\u00ednt", "Set custom color (RGB)": "Felhaszn\u00e1l\u00f3i sz\u00edn v\u00e1laszt\u00e1sa (RGB)", "Please enter the color in RGB format, with comma-separated components, e.g. %s": "K\u00e9rj\u00fck adja meg a sz\u00ednt RGB form\u00e1ban, a komponenseket vessz\u0151vel v\u00e1lassza el, pl. %s"
    }
);
Zedity.i18n.add('id', {
        "%s needs %s.": "%s membutuhkan %s", "Click %s to insert a document.": "Klik %s untuk memasukkan dokumen.", "Document": "Dokumen", "Insert": "Masukkan", "Insert document": "Masukkan dokumen", "Read": "Baca", "Read document": "Baca dokumen", "Close": "Tutup", "Close document": "Tutup dokumen", "Please provide a valid link\/embed code for any of the supported document embed services or a direct link to a document.": "Mohon sediakan link yang valid\/kode embed untuk semua layanan embed dokumen yang disupport atau link langsung dokumen.", "Could not interpret the content as document.": "Tidak dapat menerjemahkan konten sebagai dokumen.", "%s can't be rotated.": "%s tidak dapat dirotasi.", "%s doesn't support background property.": "%s tidak mendukung properti background.", "%s doesn't support rounded corners.": "%s tidak mendukung sudut melingkar.", "%s doesn't support flipping.": "%s tidak mendukung flipping.", "Embed": "Embed", "Insert document embed code or url:": "Masukkan kode embed dokumen atau url:", "Supported services:": "Layanan yang didukung:", "Supported documents:": "Dokumen yang didukung:", "PDF documents, Microsoft Office documents, Apple Pages, Adobe Photoshop and Illustrator, and more.": "Dokumen PDF, dokumen Microsoft Office, Apple pages, Adobe Photoshop dan Illusrator, dan banyak lainnya.", "OK": "OK", "Cancel": "Batal", "Click %s to insert HTML.": "Klik %s untuk memasukkan HTML.", "Html": "Html", "Insert HTML": "Masukkan HTML", "View": "Lihat", "View box content": "Lihat box konten", "Insert HTML code:": "Masukkan kode HTML:", "Safe mode:": "Mode aman:", "Automatic": "Otomatis", "Enabled": "Fungsikan", "Disabled": "Disfungsikan", "If you insert Javascript or CSS code and you get unexpected effects (e.g. content overflow, etc.) you need to enable safe mode.": "Jika anda mendapatkan hasil yang tidak sesuai harapan setelah memasukkan Javascript atau kode CSS (seperti; konten meluber, dll) maka anda perlu mengaktifkan safe mode.", "The (default) automatic setting enables safe mode only if Javascript is detected.": "Setting otomatis (default) mengaktifkan safe mode hanya jika terdeteksi ada Javascript.", "Some scripts (for example social network services) need to access the page, so the \"Safe mode\" must be disabled in these cases.": "Beberapa script (seperti layanan jejaring sosial) perlu mengakses page, maka \"Safe Mode\" harus dinonaktifkan dalam keadaan ini. ", "Inserting a %s content into an HTML box is not supported at the moment.": "Memasukkan konten %s ke dalam box HTML tidak didukung saat ini.", "Filters": "Filters", "Apply image filters": "Berlakukan filter gambar", "Adjust colors": "Sesuaikan warna", "Black &amp; white": "Black &amp; white", "Blur": "Kekaburan\/Blur", "Brightness": "Kecerahan\/Brightness", "Contrast": "Kontras\/Contrast", "Emboss": "Emboss\/Emboss", "Grayscale": "Skala abu-abu\/Grayscale", "Invert": "Pembalikan\/Invert", "Mosaic": "Mosaik\/Mosaic", "Motion blur": "Blur bergerak", "Apply filter": "Berlakukan filter", "Reset filter": "Atur ulang filter", "Remove all filters": "Lepas semua filter", "Error applying filter \"%s\".": "Salah dalam menambahkan filter \"%s\".", "Filter \"%s\" not defined.": "Filter \"%s\" tidak terdefinisi.", "Could not read image data. Filters cannot be applied on images hosted on a different domain.": "Tidak dapat membaca data gambar. Filter tidak bisa di aplikasikan pada gambar yang di host pada domain yang berbeda.", "Percent": "Persen", "Adjustment": "Penyesuaian", "Threshold": "Ambang batas", "Red": "Merah", "Green": "Hijau", "Blue": "Biru", "Amount": "Jumlah", "Block size": "Ukuran blok", "Type": "Tipe", "Strength": "Kekuatan", "Brush size": "Ukuran Sikat\/Brush", "Link": "Link\/tautan", "Add link to box": "Masukkan link\/tautan ke box", "This link will be associated to the whole box.": "Link\/tautan ini akan terkait dengan keseluruhan box.", "Insert link url:": "Masukan url link:", "Align": "Jajar", "Align to page": "Jajar pada page", "Left": "Kiri", "Center": "Pusat", "Right": "Kanan", "Top": "Atas", "Middle": "Tengah", "Bottom": "Bawah", "Fit width": "Lebar pas", "Fit height": "Tinggi pas", "Keep aspect ratio": "Aspek rasio tetap", "Select box padding": "Pilih padding box", "Padding": "Padding", "Shadow": "Bayangan", "No shadow": "Tidak ada bayangan", "Shadow at bottom right": "Bayangan di kanan bawah", "Shadow at bottom left": "Bayangan di kiri bawah", "Shadow at top right": "Bayangan di kanan atas", "Shadow at top left": "Bayangan di kiri atas", "Diffuse shadow": "Bayangan tersebar", "Color": "Warna", "Box shadow": "Bayangan box", "Horizontal position": "Posisi horisontal", "Select shadow horizontal position": "Pilih posisi horisontal bayangan", "Vertical position": "Posisi vertikal", "Select shadow vertical position": "Pilih posisi vertikal bayangan", "Select shadow blur": "Pilih kekaburan bayangan", "Spread": "Penyebaran", "Select shadow spread": "Pilih penyebaran bayangan", "Inset": "Sisipan", "Shadow inset": "Sisipan bayangan", "Text": "Teks", "Paragraph": "Paragraf", "Heading": "Heading", "Align left": "Jajar Kiri", "Align center": "Jajar Pusat", "Align right": "Jajar Kanan", "Justify": "Merata", "Ordered list": "Daftar berurut", "Unordered list": "Daftar tidak berurut", "Open link in the same tab.": "Buka link\/tautan di tab yang sama.", "Open link in a new tab.": "Buka link\/tautan di tab baru.", "Link style preview": "Tampilan ragam tautan", "Link style": "Ragam tautan", "Link style on mouse over": "Ragam link\/tautan saat mouse over", "Insert link": "Masukkan link\/tautan", "Remove": "Lepas", "The box link may override any link in the text.": "Box link\/tautan dapat menimpali link lain pada text. ", "Align top": "Jajar Atas", "Align middle": "Jajar Tengah", "Align bottom": "Jajar Bawah", "Extra small layout": "Layout ekstra kecil", "Small layout": "Layout kecil", "Medium layout": "Layout menengah", "Large layout": "Layout besar", "If you perform this action you will revert to a non-responsive design. Are you sure?": "Jika anda melakukan hal ini anda akan di alihkan ke desain non-responsif", "You can start your design from any layout.": "Anda dapat mulai mendisain dari layout manapun.", "Boxes can be added in any layout and can be modified only in the layout they were added to.": "Box dapat di tambahkan di layout manapun dan hanya dapat di modifikasi pada layout tersebut.", "Boxes added in a layout can be hidden in other layouts.": "Box-box yang ditambahkan dalam layout dapat di sembunyikan pada layout lain.", "Custom layouts:": "Layout tertentu:", "Add custom layout": "Tambahkan layout tertentu:", "Multiple layout responsive design": "Multiple layout responsive design", "The width of custom layouts can be adjusted to fit larger designs.": "Lebar layout khusus dapat disesuaikan untuk muat pada desain yang lebih besar.", "Click on a layout button to start creating content for that layout.": "Klik tombol layout untuk mulai membuat content.", "Save": "Simpan", "Abort": "Batal", "You may want to review the design for layouts in yellow.": "Anda mungkin ingin memeriksa kembali desain layout dalam warna kuning.", "Save without reviewing": "Simpan tanpa periksa", "Please click on the layouts in gray to provide the design for all layouts.": "Mohon klik pada layout dalam abu-abu agar desain tersedia untuk semua layout.", "Save anyway (not recommended)": "Tetap simpan (tidak disarankan)", "Your responsive content is ready to be saved!": "Muatan\/konten responsif anda siap untuk disimpan!", "This box was created in another layout.": "Box ini dibuat dengan layout lain.", "To modify its content edit the layout \"%s\".": "Untuk memodifikasi konten edit layout \"%s\".", "The box is hidden in this layout.": "Box disembunyikan di layout ini.", "Show box": "Tampilkan box", "Edit box": "Ubah box", "Show": "Tampilkan", "Hide": "Sembunyikan", "Hide box in this layout": "Sembunyikan box di latar ini", "This link will be associated to the whole %s content.": "Link ini akan dihubungkan dengan keseluruhan konten", "Grid": "Kisi", "Width:": "Lebar", "Height:": "Tinggi", "Templates": "Templates", "New Template": "Template Baru", "Save current content as Template": "Simpan konten saat ini sebagai Template", "Load selected Template into editor": "Muat Template terpilih ke dalam editor", "Load": "Muat", "Delete selected Template": "Hapus Template terpilih", "Delete": "Hapus", "An error occurred while saving the Template. Please try again.": "Terdapat kesalahan saat menyimpan Template. Mohon coba lagi.", "Template \"%s\" saved.": "Template \"%s\" disimpan.", "The current content will overwrite the selected Template. Are you sure?": "Konten saat ini akan menimpa Template yang dipilih. Apakah anda yakin?", "Give a title to your Template:": "Beri Template anda sebuah judul:", "A Template with that title already exists, please change the title.": "Sebuah Template dengan judul tersebut sudah ada, mohon ganti judul.", "The Template will overwrite the current editor content. Are you sure?": "Template akan menimpa konten editor saat ini. Apakah anda yakin?", "An error occurred while loading the Template. Please try again.": "Terdapat kesalahan saat memuat Template. Mohon coba lagi.", "Template \"%s\" loaded.": "Template \"%s\" dimuat.", "Are you sure you want to delete the selected Template?": "Apakah anda yakin ingin menghapus Template ini?", "An error occurred while deleting the Template. Please try again.": "Terdapat kesalahan saat menghapus Template. Mohon coba lagi.", "Click %s to insert audio.": "Klik %s untuk memasukkan audio.", "Audio": "Audio\/suara", "Insert audio": "Masukkan audio", "Play": "Mainkan", "Play audio": "Mainkan audio", "Pause": "Tahan", "Pause audio": "Jeda audio", "Show audio": "Tampilkan audio", "Close audio": "Tutup audio", "Please provide a valid link\/embed code for any of the supported audio services.": "Mohon sediakan link yang valid\/kode embed untuk semua layanan audio yang didukung.", "Could not interpret the content as audio.": "Tidak dapat menerjemahkan konten menjadi audio.", "%s can't be set as background.": "%s tidak dapat dijadikan background.", "Files": "File-file", "Insert audio embed code or url:": "Masukkan kode embed audio atau url:", "Select audio from the list of available audios:": "Pilih audio dari daftar audio yang tersedia:", "Click %s to add color.": "Klik %s untuk menambahkan warna.", "Click %s to insert image.": "Klik %s untuk memasukkan gambar.", "Image": "Gambar", "Insert image": "Masukkan gambar", "Fit": "Pas", "Stretch": "Regangkan", "Image options": "Opsi gambar", "Image quality": "Kualitas gambar", "Original": "Orisinil", "High": "Tinggi", "Normal": "Normal", "Low": "Rendah", "Proportional resize": "Ubah ukuran secara proposional", "Set box to image original size": "Atur box ke ukuran asli gambar", "Disk": "Disk", "Supported image file types:": "Mendukung tipe file gambar:", "Select image file from disk (max size %s):": "Pilih file gambar dari disk (max size %s):", "Browse...": "Jelajah...", "Image quality:": "Kualitas gambar:", "Insert image URL link:": "Masukkan link URL gambar:", "Image description:": "Deskripsi gambar:", "Please insert image description.": "Mohon masukkan deskripsi gambar.", "Image description is too short.": "Deskripsi gambar terlalu singkat.", "No file selected.": "Tidak ada file yang dipilih.", "Please insert a link.": "Silahkan masukkan sebuah link.", "An unexpected error occurred. Please try again.": "Terjadi Kesalahan tak terduga. Mohon ulangi lagi.", "There was an error during server image resize.": "Terdapat kesalahan selama pengubahan ukuran gambar oleh server.", "Loading...": "Memuat...", "Could not interpret the content as image.": "Tidak dapat menerjemahkan kontent menjadi gambar.", "File extension not valid.": "Ekstensi file tidak valid.", "File too big (max size: %s).": "File terlalu besar (ukuran maks: %s).", "Error in reading the response from the server": "Salah dalam membaca respon server", "Method %s does not exist on %s.": "Metode %s tidak ada dalam %s.", "Input not defined": "Input tidak terdefinisi", "Image file type cannot be resized.": "Tipe file gambar tidak dapat diresize.", "File is not a supported image.": "File bukanlah gambar yang didukung.", "File is not recognized as valid image.": "File tidak dikenali sebagai gambar yang valid.", "File is too big.": "File terlalu besar.", "Error during loading of the image.": "Kesalahan saat memuat gambar.", "Too many \"%s\" boxes (limit: %s).": "Box \"%s\" terlalu banyak (batas: %s)", "Too many total boxes (limit: %s).": "Jumlah box terlalu banyak (batas: %s).", "Unexpected error: could not finalize box style.": "Kesalahan tak terduga: tidak dapat menyelesaikan ragam box.", "Background": "Background", "Arrange": "Atur", "Bring to front": "Bawa ke depan", "Send to back": "Taruh di belakang", "Bring forward": "Majukan", "Send backward": "Mundurkan", "Duplicate": "Gandakan", "Vertical": "Vertikal", "Horizontal": "Horisontal", "Select background color": "Pilih warna background", "Opacity": "Opacity", "Box opacity": "Opacity box", "Select box opacity": "Pilih opacity box", "Select background opacity": "Pilih opacity background", "Background opacity": "Opacity background", "Border": "Batas", "Select border style": "Pilih ragam border\/tepi\/pinggir\/batas", "Select border width": "Pilih lebar border\/tepi\/pinggir\/batas", "Width": "Lebar", "Corners": "Sudut-sudut", "Top left corner": "Sudut kiri atas", "Top right corner": "Sudut kanan atas", "Bottom left corner": "Sudut kiri bawah", "Bottom right corner": "Sudut kanan bawah", "Rounded corners": "Sudut melingkar", "Unexpected error: box has no content.": "Kesalahan tak terduga: box kosong.", "Box type not supplied during registration.": "Tipe box tidak tersedia selama registrasi.", "Video": "Video", "Click %s to insert text.": "Klik %s untuk memasukkan teks.", "Done": "Selesai", "Done editing": "Selesai mengedit", "Font": "Huruf\/font", "Bold": "Tebal", "Italic": "Miring", "Underline": "Garis Bawahi", "Increase font size": "Tambah ukuran huruf\/font", "Decrease font size": "Kurangi ukuran huruf\/font", "Text length exceeds the maximum limit.": "Panjang teks melebihi batas maksimum.", "Click %s to insert video.": "Klik %s untuk memasukkan video.", "Insert video": "Masukkan video", "Play video": "Mulai video", "Pause video": "Tahan video", "Show video": "Tampilkan video", "Close video": "Tutup video", "Please provide a valid link\/embed code for any of the supported video services.": "Mohon sediakan link yang berlaku\/kode embed dari penyedia video yang didukung.", "Could not interpret the content as video.": "Tidak dapat menerjemahkan konten menjadi video.", "Insert video embed code or url:": "Masukkan kode embed video atau url:", "Select video from the list of available videos:": "Pilih video dari daftar video yang tersedia:", "Add %s box": "Tambah box %s", "Set as background": "Tetapkan sebagai background", "Unset from background": "Lepas dari pengaturan background", "Error in generating unique id.": "Kesalahan dalam menghasilkan id unik.", "Improper internal call.": "Panggilan internal tidak tepat.", "Please insert a value.": "Silahkan masukkan nilai.", "Browser does not support required feature \"%s\".": "Browser tidak mendukung \"%\" fitur yang dibutuhkan.", "Could not initialize %s. Container not found.": "Tidak dapat menginisialisasi%s. Container tidak ditemukan.", "Box type \"%s\" doesn't exist.": "Tipe box \"%s\" tidak ada.", "Error during box creation: %s.": "Kesalahan selama pembuatan box: %s.", "Saving content.": "Simpan konten.", "Please wait...": "Mohon tunggu...", "Removed box. Box type \"%s\" not supported.": "Lepas box. Box tipe \"%s\" tidak didukung.", "This is a %s feature.": "Ini adalah fitur %s.", "For information, please visit %s.": "Untuk informasi, mohon kunjungi %s.", "Box size and position": "Ukuran box dan posisi", "Size": "Ukuran", "Box": "Box\/kotak", "SEO and grouping tags": "SEO dan label pengelompok", "Additional audio services:": "Layanan audio tambahan:", "Supported in %s:": "Didukung dalam %s:", "Current color:": "Warna saat ini:", "Click on the \"%s\" button to start creating content for extra small layouts.": "Klik tombol \"%s\" untuk mulai membuat konten untuk layout ekstra kecil.", "Start responsive design": "Mulai desain responsif", "Snap boxes to": "Hentak box ke", "Page": "Page", "Boxes": "Box", "Content link": "Link konten", "Content": "Muatan\/konten", "Clear all": "Hapus semua", "Click to set Hex color": "Klik untuk mengatur warna Hex", "Click to set RGB color": "Klik untuk mengatur warna RGB", "Solid color": "Warna padat", "Horiz. gradient": "Horisontal, gradient", "Vert. gradient": "Vertikal, gradient", "Select color opacity": "Pilih opacity warna", "Set custom color (Hex)": "Atur warna tertentu (Hex)", "Please enter the color in hex format, e.g. %s": "Mohon masukkan warna dalam format hex, contohi; %s", "You must enter a color.": "Anda harus memasukkan sebuah warna.", "Set custom color (RGB)": "Atur warna tertentu (RGB)", "Please enter the color in RGB format, with comma-separated components, e.g. %s": "Mohon masukkan warna dalam format RGB, dengan terpisah tanda koma, contoh; %s"
    }
);
Zedity.i18n.add('it', {
        "%s needs %s.": "%s ha bisogno di %s.", "Click %s to insert a document.": "Clicca %s per inserire un documento.", "Document": "Documento", "Insert": "Inserisci", "Insert document": "Inserisci documento", "Read": "Leggi", "Read document": "Leggi documento", "Close": "Chiudi", "Close document": "Chiudi documento", "Please provide a valid link\/embed code for any of the supported document embed services or a direct link to a document.": "Fornisci un link o codice embed valido per uno dei servizi supportati o un link diretto ad un documento.", "Could not interpret the content as document.": "Impossibile interpretare il contenuto come documento.", "%s can't be rotated.": "%s non pu\u00f2 essere ruotato.", "%s doesn't support background property.": "%s non supporta la propriet\u00e0 sfondo.", "%s doesn't support rounded corners.": "%s non supporta angoli stondati.", "%s doesn't support flipping.": "%s non supporta il ribaltamento.", "Embed": "Embed", "Insert document embed code or url:": "Inserisci un link o codice embed per il documento:", "Supported services:": "Servizi supportati:", "Supported documents:": "Documenti supportati:", "PDF documents, Microsoft Office documents, Apple Pages, Adobe Photoshop and Illustrator, and more.": "Documenti PDF, documenti Microsoft Office, Apple Pages, Adobe Photoshop e Illustrator, e altri.", "OK": "OK", "Cancel": "Annulla", "Click %s to draw.": "Clicca %s per disegnare.", "Draw": "Disegno", "Editing": "Modifica", "Done": "Fine", "Done editing": "Fine modifiche", "Undo": "Annulla", "Undo modifications": "Annulla modifiche", "Redo": "Ripristina", "Redo modifications": "Ripristina modifiche", "Clear all": "Pulisci tutto", "Style": "Stile", "Color": "Colore", "Select stroke color": "Seleziona il colore del tratto", "Width": "Larghezza", "Set stroke width": "Seleziona larghezza del tratto", "Fill": "Riempimento", "Select fill color": "Seleziona il colore del riempimento", "Tools": "Strumenti", "Freehand drawing": "Disegno a mano libera", "Shapes": "Forme", "Draw shapes": "Disegna forme", "Line": "Linea", "Rectangle": "Rettangolo", "Circle": "Cerchio", "Arrow": "Freccia", "Polygon": "Poligono", "Star": "Stella", "Draw polygon": "Disegna poligono", "Number of faces": "Numero di facce", "Draw star": "Disegna stella", "Number of star spikes": "Numero di punte della stella", "Eraser": "Cancella", "Erase objects": "Cancella oggetti", "rotated": "ruotato", "flipped": "capovolto", "It is not possible to draw on a %s box.": "Non \u00e8 possibile disegnare in un box %s.", "Click %s to insert HTML.": "Clicca %s per inserire HTML.", "Html": "Html", "Insert HTML": "Inserisci HTML", "View": "Vedi", "View box content": "Vedi il contenuto del box", "Insert HTML code:": "Inserisci codice HTML:", "Safe mode:": "Modalit\u00e0 sicura:", "Automatic": "Automatico", "Enabled": "Abilitato", "Disabled": "Disabilitato", "If you insert Javascript or CSS code and you get unexpected effects (e.g. content overflow, etc.) you need to enable safe mode.": "Se inserisci Javascript o CSS e ottieni effetti inaspettati (es. il contenuto esce dal box, ecc.), devi abilitare la Modalit\u00e0 sicura.", "The (default) automatic setting enables safe mode only if Javascript is detected.": "Il settaggio Automatico (preimpostato) abilita la Modalit\u00e0 sicura solo se viene rilevato codice Javascript.", "Some scripts (for example social network services) need to access the page, so the \"Safe mode\" must be disabled in these cases.": "Alcuni script (ad esempio servizi di social network) devono accedere alla pagina, quindi la \/\"Modalit\u00e0 sicura\/\" deve essere disattivata in questi casi.", "Inserting a %s content into an HTML box is not supported at the moment.": "Inserire un contenuto %s in un box HTML non \u00e8 supportato al momento.", "Filters": "Filtri", "Apply image filters": "Applica filtri immagine", "Adjust colors": "Aggiusta i colori", "Black &amp; white": "Bianco e nero", "Blur": "Sfocatura", "Brightness": "Luminosit\u00e0", "Contrast": "Contrasto", "Emboss": "Rilievo", "Grayscale": "Scala di grigio", "Invert": "Inverti", "Mosaic": "Mosaico", "Motion blur": "Sfocatura movimento", "Noise": "Disturbo", "Paint": "Dipinto", "Posterize": "Posterizza", "Psychedelia": "Psichedelia", "Sepia": "Sepia", "Sharpen": "Intensifica", "Vignette": "Vignetta", "Apply filter": "Applica filtri", "Reset filter": "Resetta filtri", "Remove all filters": "Rimuovi tutti i filtri", "Error applying filter \"%s\".": "Errore nell'applicazione del filtro \"%s\".", "Filter \"%s\" not defined.": "Filtro \"%s\" non definito.", "Could not read image data. Filters cannot be applied on images hosted on a different domain.": "Impossibile leggere i dati dell'immagine. I filtri non possono essere applicati su immagini che risiedono in altri domini.", "Percent": "Percentuale", "Adjustment": "Aggiustamento", "Threshold": "Soglia", "Red": "Rosso", "Green": "Verde", "Blue": "Blu", "Amount": "Quantit\u00e0", "Block size": "Dimensioe blocco", "Type": "Tipo", "Strength": "Forza", "Brush size": "Dimensione pennello", "Link": "Link", "Add link to box": "Applica link al box", "This link will be associated to the whole box.": "Questo link sar\u00e0 associato a tutto il box.", "Insert link url:": "Inserisci il link (url):", "Align": "Allinea", "Align to page": "Allinea alla pagina", "Left": "Sinistra", "Center": "Centro", "Right": "Destra", "Top": "Alto", "Middle": "In mezzo", "Bottom": "Basso", "Fit width": "Adatta larghezza", "Fit height": "Adatta altezza", "Position and size": "Posizione e dimensione", "Set box position %s.": "Seleziona posizione %s del box.", "W:": "L:", "H:": "A:", "Set box width": "Seleziona larghezza box", "Set box height": "Seleziona altezza box", "Keep aspect ratio": "Mantieni proporzioni", "Select box padding": "Seleziona spazio ai bordi", "Padding": "Spazio ai bordi", "Shadow": "Ombra", "Predefined": "Predefiniti", "Select predefined shadow": "Seleziona ombra predefinita", "No shadow": "Senza ombra", "Shadow at bottom right": "Ombra in basso a destra", "Shadow at bottom left": "Ombra in basso a sinistra", "Shadow at top right": "Ombra in alto a destra", "Shadow at top left": "Ombra in alto a sinistra", "Diffuse shadow": "Ombra diffusa", "Select shadow color": "Seleziona il colore dell'ombra", "Box shadow": "Ombra box", "Horizontal position": "Posizione orizzontale", "Select shadow horizontal position": "Seleziona la posizione orizzontale dell'ombra", "Vertical position": "Posizione verticale", "Select shadow vertical position": "Seleziona la posizione verticale dell'ombra", "Select shadow blur": "Seleziona la sfocatura dell'ombra", "Spread": "Difffusione", "Select shadow spread": "Seleziona la diffusione dell'ombra", "Inset": "Interna", "Shadow inset": "Ombra interna", "Text": "Testo", "Paragraph": "Paragrafo", "Select paragraph": "Seleziona paragrafo", "Heading": "Titolo", "Align left": "Allinea a sinistra", "Align center": "Allinea al centro", "Align right": "Allinea a destra", "Justify": "Giustificato", "Select line height": "Seleziona altezza riga", "Ordered list": "Elenco numerato", "Unordered list": "Elenco puntato", "Select paragraph spacing": "Seleziona spaziatura tra paragrafi", "Indent": "Aumenta rientro", "Outdent": "Diminuisci rientro", "Subscript": "Pedice", "Superscript": "Apice", "Open link in the same frame.": "Apri il link nello stessa frame.", "Open link in the same tab.": "Apri il link nella stessa scheda.", "Open link in a new tab.": "Apri il link in una nuova scheda.", "Link style preview": "Anteprima stile del link", "Link style": "Stile del link", "Link style on mouse over": "Stile del link al passaggio del mouse", "Insert link": "Inserisci il link", "Remove": "Rimuovi", "The box link may override any link in the text.": "Il link sul box potrebbe avere precedenza su link inseriti nel testo.", "Align top": "Allinea in alto", "Align middle": "Allinea in mezzo", "Align bottom": "Allinea in basso", "Extra small layout": "Impaginazione molto piccola", "Small layout": "Impaginazione piccola", "Medium layout": "Impaginazione media", "Large layout": "Impaginazione grande", "If you perform this action you will revert to a non-responsive design. Are you sure?": "Se si esegue questa azione si torner\u00e0 ad un design non responsive. Sei sicuro?", "You can start your design from any layout.": "Puoi cominciare il tuo design da un'impaginazione qualsiasi.", "Boxes can be added in any layout and can be modified only in the layout they were added to.": "Nuovi box possono essere aggiunti in ogni impaginazione e possono essere modificati solo nell'impaginazione in cui sono stati aggiunti.", "Boxes added in a layout can be hidden in other layouts.": "I box aggiunti in una impaginazione possono essere nascosti in altre impaginazioni.", "Custom layouts:": "Layout personalizzati:", "Add custom layout": "Aggiungi layout personalizzato", "Multiple layout responsive design": "Design responsive con impaginazione multipla.", "The width of custom layouts can be adjusted to fit larger designs.": "La larghezza dei layout personalizzati pu\u00f2 essere regolata per adattarsi a disegni pi\u00f9 grandi.", "Click on a layout button to start creating content for that layout.": "Clicca sul bottone per cominciare a creare il contenuto per quell'impaginazione.", "Save": "Salva", "Abort": "Interrompi", "You may want to review the design for layouts in yellow.": "E' consigliato di rivedere il design per le impaginazioni in giallo.", "Save without reviewing": "Salva senza revisione", "Please click on the layouts in gray to provide the design for all layouts.": "Clicca sui layout in grigio per fornire un design per tutte le impaginazioni.", "Save anyway (not recommended)": "Salva comunque (sconsigliato)", "Your responsive content is ready to be saved!": "Il tuo contenuto responsive \u00e8 pronto per essere salvato!", "This box was created in another layout.": "Questo box \u00e8 stato creato in un'altra impaginazione.", "To modify its content edit the layout \"%s\".": "Per modificarne il contenuto edita l'impaginazione \"%s\".", "The box is hidden in this layout.": "Il box \u00e8 nascosto in questa impaginazione.", "Show box": "Mostra box", "Responsive": "Responsive", "Start %s": "Comincia %s", "Save \"%s\"": "Salva \"%s\"", "Edit box": "Modifica box", "Layout": "Impaginazione", "Show": "Mostra", "Show box in this layout": "Mostra box in questa impaginazione", "Hide": "Nascondi", "Hide box in this layout": "Nascondi box in questa impaginazione", "Box style": "Stile box", "This link will be associated to the whole %s content.": "Questo link sar\u00e0 associato a tutto il contenuto %s.", "This is useful to create all clickable contents, like banners, etc. If you need to create a textual link, instead, enter the \"boxes\" menu.": "Questo \u00e8 utile per creare contenuti cliccabili, come banner, ecc. Se hai bisogno di un link testuale, entra nel menu \"box\" .", "Snap": "Cattura", "Snap boxes to page": "Cattura box alla pagina", "Snap boxes to boxes": "Cattura box a box", "Snap boxes to grid": "Cattura box alla griglia", "Grid": "Griglia", "Width:": "Larghezza:", "Set grid width": "Seleziona larghezza griglia", "Height:": "Altezza:", "Set grid height": "Seleziona altezza griglia", "Lock width and height": "Blocca larghezza e altezza", "Templates": "Modelli", "New Template": "Nuovo Modello", "Save current content as Template": "Salva il contenuto corrente come Modello", "Load selected Template into editor": "Carical il Modello selezionato dentro l'editor", "Load": "Carica", "Delete selected Template": "Cancella il Modello selezionato", "Delete": "Elimina", "An error occurred while saving the Template. Please try again.": "Errore durante il salvataggio del Modello Prova di nuovo.", "Template \"%s\" saved.": "Modello \"%s\" salvato.", "The current content will overwrite the selected Template. Are you sure?": "Il contenuto corrente sovrascriver\u00e0 il Modello selezionato. Sei sicuro?", "Give a title to your Template:": "Dai un titolo al Modello:", "A Template with that title already exists, please change the title.": "Un Modello con questo titolo esiste gi\u00e0.", "The Template will overwrite the current editor content. Are you sure?": "Il Modello sovrascriver\u00e0 il contenuto corrente dell'editor. Sei sicuro?", "An error occurred while loading the Template. Please try again.": "Errore durante il caricamento del Modello Prova di nuovo.", "Template \"%s\" loaded.": "Modello \"%s\" caricato.", "Are you sure you want to delete the selected Template?": "Sei sicuro che vuoi cancellare questo Modello?", "An error occurred while deleting the Template. Please try again.": "Errore durante la cancellazione del Modello Prova di nuovo.", "Click %s to insert audio.": "Clicca %s per inserire audio.", "Audio": "Audio", "Insert audio": "Inserisci audio", "Play": "Riproduzione", "Play audio": "Riproduci audio", "Pause": "Pausa", "Pause audio": "Pausa audio", "Show audio": "Mostra audio", "Close audio": "Chiudi audio", "Please provide a valid link\/embed code for any of the supported audio services.": "Fornisci un link o codice embed valido per uno dei servizi audio supportati.", "Could not interpret the content as audio.": "Impossibile interpretare il contenuto come audio.", "%s can't be set as background.": "%s non pu\u00f2 essere impostato come sfondo.", "Files": "Archivi", "Insert audio embed code or url:": "Inserisci un link o codice embed audio:", "Select audio from the list of available audios:": "Seleziona un audio dalla lista di quelli disponibili:", "Click %s to add color.": "Clicca %s per aggiungere colore.", "Add": "Aggiungi", "Add color": "Aggiungi colore", "Click %s to insert image.": "Click %s per inserire un'immagine.", "Image": "Immagine", "Insert image": "Inserisci immagine", "Select image layout": "Seleziona disposizione immagine", "Center &amp; fill": "Centra e riempi", "Fit": "Adatta", "Stretch": "Distendi", "Options": "Opzioni", "Image options": "Opzioni immagine", "Image quality": "Qualit\u00e0 immagine", "Original": "Originale", "High": "Alta", "Normal": "Normale", "Low": "Bassa", "Proportional resize": "Ridimensionamento proporzionale", "Set box to image original size": "Box alle dimens. originali immagine", "Disk": "Disco", "Supported image file types:": "Tipi di immagine supportati:", "Select image file from disk (max size %s):": "Seleziona un archivio immagine dal disco (Dimensione massima: %s).", "Browse...": "Sfoglia...", "Image quality:": "Qualit\u00e0 immagine:", "Insert image URL link:": "Inserisci un link all'immagine:", "Image description:": "Descrizione immagine:", "Please insert image description.": "Inserisci una descrizione per l'immagine.", "Image description is too short.": "La descrizione dell'immagine \u00e8 troppo corta.", "No file selected.": "Nessun archivio selezionato.", "Please insert a link.": "Inserisci un link:", "An unexpected error occurred. Please try again.": "Errore inaspettato. Prova di nuovo.", "There was an error during server image resize.": "Errore durante il ridimensionamento dell'immagine sul server.", "Loading...": "Caricamento...", "Could not interpret the content as image.": "Impossibile interpretare il contenuto come immagine.", "File extension not valid.": "Estensione archivio non valida.", "File too big (max size: %s).": "L'archivio \u00e8 troppo grande (dimensione massima: %s).", "Error in reading the response from the server": "Errore leggendo la risposta dal server", "Method %s does not exist on %s.": "Il metodo %s non esiste in %s.", "Input not defined": "Input non definito", "Image file type cannot be resized.": "Questo tipo immagine non pu\u00f2 essere ridimensionato.", "File is not a supported image.": "L'archivio non \u00e8 un'immagine supportata.", "File is not recognized as valid image.": "L'archivio non \u00e8 riconosciuto come un'immagine valida.", "File is too big.": "L'archivio \u00e8 troppo grande.", "Error during loading of the image.": "Errore durante il caricamento dell'immagine.", "Too many \"%s\" boxes (limit: %s).": "Troppi box \"%s\" (limite: %s).", "Too many total boxes (limit: %s).": "Troppi box in totale (limite: %s).", "Unexpected error: could not finalize box style.": "Errore inaspettato: impossibile finalizzare lo stile del box.", "Background": "Sfondo", "Set selected box as background": "Imposta box selezionato come sfondo", "Unset box from background": "Togli box da sfondo", "Arrange": "Disponi", "Arrange box": "Disponi box", "Bring to front": "Porta in primo priano", "Send to back": "Porta in fondo", "Bring forward": "Porta avanti", "Send backward": "Porta indietro", "Duplicate": "Duplica", "Duplicate selected box": "Duplica il box selezionato", "Delete selected box": "Cancella il box selezionato", "Flip": "Ribalta", "Vertical": "Verticale", "Flip selected box vertically": "Ribalta verticalmente box selezionato", "Horizontal": "Orizzontale", "Flip selected box horizontally": "Ribalta orizzontalmente box selezionato", "Select background color": "Seleziona colore di sfondo", "Opacity": "Opacit\u00e0", "Box opacity": "Opacit\u00e0 box", "Select box opacity": "Seleziona opacit\u00e0 del box", "Select background opacity": "Seleziona opacit\u00e0 dello sfondo", "Background opacity": "Opacit\u00e0 sfondo", "Border": "Bordo", "Select border style": "Seleziona stile bordo", "Select border color": "Seleziona colore del bordo", "Select border width": "Seleziona larghezza bordo", "Corners": "Angoli", "Top left corner": "Angolo in alto a sinistra", "Top right corner": "Angolo in alto a destra", "Bottom left corner": "Angolo in basso a sinistra", "Bottom right corner": "Angolo in basso a destra", "Rounded corners": "Angoli stondati", "Radius": "Raggio", "Unexpected error: box has no content.": "Errore inaspettato: il box non ha contenuto.", "Box type not supplied during registration.": "Tipo box non fornito durante la registrazione.", "Video": "Video", "Click %s to insert text.": "Clicca %s per inserire testo.", "Insert\/edit text": "Inserisci\/edita testo", "Text alignment": "Allineamento testo", "Font": "Tipo di carattere", "Bold": "Grassetto", "Italic": "Corsivo", "Underline": "Sottolineato", "Select font size": "Seleziona la grandezza del carattere", "Select font color": "Seleziona il colore del carattere", "Increase font size": "Aumenta la grandezza del carattere", "Decrease font size": "Diminuisci la grandezza del carattere", "Text length exceeds the maximum limit.": "La lunghezza del testo supera il limite messimo.", "Plain text.": "Testo normale", "Formatted text.": "Testo formattato.", "Paste text": "Incolla testo", "Click %s to insert video.": "Click %s per inserire un video.", "Insert video": "Inserisci video", "Video embed options": "Opzioni video", "Play video": "Riproduci video", "Pause video": "Pausa video", "Show video": "Mostra video", "Close video": "Chiudi video", "Please provide a valid link\/embed code for any of the supported video services.": "Fornisci un link o codice embed valido per uno dei servizi video supportati.", "Could not interpret the content as video.": "Impossibile interpretare il contenuto come video.", "Insert video embed code or url:": "Inserisci un link o codice embed video:", "Select video from the list of available videos:": "Seleziona il video dalla lista di quelli disponibili:", "Add %s box": "Aggiungi box %s", "Set as background": "Imposta come sfondo", "Unset from background": "Togli da sfondo", "Error in generating unique id.": "Errore nella generazione di un ID unico.", "Improper internal call.": "Chiamata interna errata.", "Please insert a value.": "Inserisci un valore.", "Browser does not support required feature \"%s\".": "Il browser non supporta la funzione necessaria \"%s\".", "Could not initialize %s. Container not found.": "Impossibile inizializzare %s. Contenitore non trovato.", "Box type \"%s\" doesn't exist.": "Il tipo di box \"%s\" non esiste.", "Error during box creation: %s.": "Errore durante la crazione del box: %s.", "Saving content.": "Salvataggio contenuto.", "Please wait...": "Attendere...", "Removed box. Box type \"%s\" not supported.": "Rimosso box. Tipo box \"%s\" non supportato.", "This is a %s feature.": "Questa \u00e8 una feature %s.", "For information, please visit %s.": "Per informazioni, visita %s.", "Box size and position": "Dimensione e posizione box", "Size": "Dimensione", "Box": "Box", "SEO and grouping tags": "SEO e tags raggruppamento", "Additional audio services:": "Servizi audio addizionali:", "Supported in %s:": "Supportato in %s:", "Current color:": "Colore corrente:", "Click on the \"%s\" button to start creating content for extra small layouts.": "Clicca sul bottone \"%s\" per cominciare a creare il contenuto per impaginazioni molto piccole.", "Start responsive design": "Comincia design responsive", "Snap boxes to": "Cattura box a", "Page": "Pagina", "Boxes": "Box", "Content link": "Link contenuto", "Content": "Contenuto", "Set content width": "Seleziona larghezza contenuto", "Set content height": "Seleziona altezza contenuto", "Edit": "Modifica", "Basic": "Base", "Media embed": "Embed media", "Advanced": "Avanzati", "Add box:": "Aggiungi box:", "Click to set Hex color": "Setta colore Hex", "Click to set RGB color": "Setta colore RGB", "Solid color": "Tinta unita", "Horiz. gradient": "Gradiente orizz.", "Vert. gradient": "Gradiente vert.", "Radial gradient": "Gradiente radiale", "Select color opacity": "Seleziona opacit\u00e0 colore", "Set custom color (Hex)": "Imposta colore personalizzato (Hex)", "Please enter the color in hex format, e.g. %s": "Inserisci il colore in formato Hex, es. %s", "You must enter a color.": "Devi inserire un colore.", "Set custom color (RGB)": "Imposta colore personalizzato (RGB)", "Please enter the color in RGB format, with comma-separated components, e.g. %s": "Inserisci il colore in formato RGB, con i componenti separati da una virgola, es. %s"
    }
);
Zedity.i18n.add('nl', {
        "%s needs %s.": "%s heeft %s nodig.", "Click %s to insert a document.": "Klik %s om een document in te voegen.", "Document": "Document", "Insert": "Invoegen", "Insert document": "Document invoegen", "Read": "Lezen", "Read document": "Document lezen", "Close": "Sluiten", "Close document": "Document sluiten", "Please provide a valid link\/embed code for any of the supported document embed services or a direct link to a document.": "Geef een geldige koppelings- of insluitcode op voor een van de ondersteunde invoegtoepassingen of geef een directe link naar een document.", "Could not interpret the content as document.": "De inhoud kan niet als document worden herkend.", "%s can't be rotated.": "%s kan niet gedraaid worden.", "%s doesn't support background property.": "%s ondersteund geen achtergrondeigenschap.", "%s doesn't support rounded corners.": "%s ondersteund geen afgeronde hoeken.", "%s doesn't support flipping.": "%s ondersteund geen spiegelen.", "Embed": "Insluiten", "Insert document embed code or url:": "Voeg een insluitcode of url toe van het document:", "Supported services:": "Ondersteunde diensten:", "Supported documents:": "Ondersteunde documenten:", "PDF documents, Microsoft Office documents, Apple Pages, Adobe Photoshop and Illustrator, and more.": "PDF documenten, Microsoft Office documenten, Apple Pages, Adobe Photoshop en Illustrator, en meer.", "OK": "Accepteren", "Cancel": "annuleren", "Click %s to insert HTML.": "Klik %s om HTML in te voegen.", "Html": "Html", "Insert HTML": "HTML invoegen", "View": "Weergave", "View box content": "Geef vakinhoud weer.", "Insert HTML code:": "Voeg HTML code in:", "Safe mode:": "Veilige modus:", "Automatic": "Automatisch", "Enabled": "Ingeschakeld", "Disabled": "Uitgeschakeld", "If you insert Javascript or CSS code and you get unexpected effects (e.g. content overflow, etc.) you need to enable safe mode.": "Wanneer bij het invoegen van JavaScript of CSS codes onverwachte effecten optreden (bijv. overlopende inhoud, etc.) is het raadzaam om de veilige modus in te schakelen.", "The (default) automatic setting enables safe mode only if Javascript is detected.": "De veilige modus kan alleen ingeschakeld worden wanneer JavaScript gedetecteerd is bij de (standaard) automatische instelling.", "Some scripts (for example social network services) need to access the page, so the \"Safe mode\" must be disabled in these cases.": "Bepaalde Scripts (bijv. services van sociale netwerken) moeten de pagina kunnen benaderen, in deze gevallen moet de \"Veilige modus\" worden uitgeschakeld.", "Inserting a %s content into an HTML box is not supported at the moment.": "Het invoegen van %s inhoud in HTML is op dit moment nog niet mogelijk.", "Filters": "Filters", "Apply image filters": "Afbeeldingfilters toepassen", "Adjust colors": "Pas kleuren aan", "Black &amp; white": "Zwart &amp; wit", "Blur": "Vervagen", "Brightness": "Helderheid", "Contrast": "Contrast", "Emboss": "Contourstansen", "Grayscale": "Grijswaarden", "Invert": "Negatief", "Mosaic": "Mozaiek", "Motion blur": "Bewegingsonscherpte", "Noise": "Korrelig", "Paint": "Verf", "Posterize": "Kleurvermindering", "Psychedelia": "Psychedelisch ", "Sepia": "Sepia", "Sharpen": "Verscherpen", "Vignette": "Vignet", "Apply filter": "Pas filter toe", "Reset filter": "Reset filter", "Remove all filters": "Verwijder alle filters", "Error applying filter \"%s\".": "Error toevoegen filter \"%s\".", "Filter \"%s\" not defined.": "Filter \"%s\" niet gedefinieerd.", "Could not read image data. Filters cannot be applied on images hosted on a different domain.": "Kan de afbeeldingsdata niet lezen. Filters kunnen niet ingesteld worden op afbeeldingen gehost op een ander domein.", "Percent": "Procent", "Adjustment": "Correctie", "Threshold": "Drempelwaarde", "Red": "Rood", "Green": "Groen", "Blue": "Blauw", "Amount": "Hoeveelheid", "Block size": "Blokgrootte", "Type": "Lettertype", "Strength": "Sterkte", "Brush size": "Penseelgrootte", "Link": "Koppeling", "Add link to box": "Link toevoegen aan vlak", "This link will be associated to the whole box.": "Deze link wordt aan het hele vlak gekoppeld", "Insert link url:": "Link url invoegen:", "Align": "Uitlijnen", "Align to page": "Uitlijnen op raster", "Left": "Links", "Center": "Center", "Right": "Rechts", "Top": "Boven", "Middle": "Midden", "Bottom": "Onderzijde", "Fit width": "Pas aan breedte aan", "Fit height": "Pas aan hoogte aan", "Keep aspect ratio": "Behoud hoogte-breedte verhouding", "Select box padding": "Selecteer vak opvulling", "Padding": "Opvulling", "Shadow": "Schaduw", "No shadow": "Geen schaduw", "Shadow at bottom right": "Schaduw onder rechts", "Shadow at bottom left": "Schaduw onder links", "Shadow at top right": "Schaduw boven rechts", "Shadow at top left": "Schaduw boven links", "Diffuse shadow": "Diffuus schaduw", "Color": "Kleur", "Box shadow": "Vlak schaduw", "Horizontal position": "Horizontale positie", "Select shadow horizontal position": "Selecteer horizontale positie van schaduw", "Vertical position": "Verticale positie", "Select shadow vertical position": "Selecteer verticale positie van schaduw", "Select shadow blur": "Schaduw vervagen", "Spread": "Spreiden", "Select shadow spread": "Schaduw spreiden", "Inset": "Aanvulling", "Shadow inset": "Schaduw aanvulling", "Text": "Tekst", "Paragraph": "Paragraaf", "Heading": "Rubriek", "Align left": "Links uitlijnen", "Align center": "Center uitlijnen", "Align right": "Rechts uitlijnen", "Justify": "Uitlijnen", "Ordered list": "Geordende lijst", "Unordered list": "Ongeordende lijst", "Indent": "Inspringing vergroten", "Outdent": "Inspringing verkleinen", "Subscript": "Subscript", "Superscript": "Superscript", "Open link in the same tab.": "Open link in het zelfde tabblad", "Open link in a new tab.": "Open link in nieuw tabblad", "Link style preview": "Linkstijl voorbeeld", "Link style": "Linkstijl", "Link style on mouse over": "Linkstijl bij muisaanwijzing", "Insert link": "Voeg link in", "Remove": "Verwijder", "The box link may override any link in the text.": "De link naar het vlak kan een link in de tekst opheffen", "Align top": "Boven uitlijnen", "Align middle": "Midden uitlijnen", "Align bottom": "Onder uitlijnen", "Extra small layout": "Extra smalle lay-out", "Small layout": "Smalle lay-out", "Medium layout": "Gemiddelde lay-out", "Large layout": "Grote lay-out", "If you perform this action you will revert to a non-responsive design. Are you sure?": "Als u deze actie uitvoert gaat u terug naar een niet responsief ontwerp. Weet u het zeker?", "You can start your design from any layout.": "U kunt uw eigen ontwerp vanaf elke lay-out beginnen.", "Boxes can be added in any layout and can be modified only in the layout they were added to.": "Vakken kunnen aan elke lay-out worden toegevoegd en aangepast worden in de desbetreffende lay-out", "Boxes added in a layout can be hidden in other layouts.": "Vakken die toegevoegd zijn aan een lay-out, kunnen in andere lay-outs verborgen worden.", "Custom layouts:": "Aangepaste lay-outs:", "Add custom layout": "Voeg een aangepaste lay-out toe", "Multiple layout responsive design": "Multi-lay-out responsief ontwerp", "The width of custom layouts can be adjusted to fit larger designs.": "De breedte van een aangepaste layout kan gewijzigd worden om aan de maat van een groter ontwerp te voldoen.", "Click on a layout button to start creating content for that layout.": "Klik op een layout-knop om inhoud voor die layout te maken", "Save": "Bewaar", "Abort": "Annuleer", "You may want to review the design for layouts in yellow.": "U kunt het ontwerp voor de lay-outs in het geel controleren.", "Save without reviewing": "Bewaar zonder controle", "Please click on the layouts in gray to provide the design for all layouts.": "Klik op de layouts in het grijs ", "Save anyway (not recommended)": "Hoe dan ook opslaan (niet aangeraden)", "Your responsive content is ready to be saved!": "Uw responsieve inhoud is gereed om op te slaan!", "This box was created in another layout.": "Dit vlak is in een andere layout aangemaakt.", "To modify its content edit the layout \"%s\".": "Om de inhoud te veranderen dient de layout aangepast te worden \"%s\".", "The box is hidden in this layout.": "Het vlak is verborgen in deze layout.", "Show box": "Toon vlak", "Edit box": "Wijzig vlak", "Show": "Toon", "Hide": "Verberg", "Hide box in this layout": "Verberg vlak in deze layout", "This link will be associated to the whole %s content.": "Deze link wordt gekoppeld aan de hele %s inhoud.", "Grid": "Raster", "Width:": "Breedte:", "Height:": "Hoogte", "Templates": "Sjablonen", "New Template": "Nieuw Sjabloon", "Save current content as Template": "Bwaar huidige inhoud als Sjabloon", "Load selected Template into editor": "Geselecteerde Sjabloon laden in editor", "Load": "Laden", "Delete selected Template": "Verwijder geselecteerde Sjabloon", "Delete": "Verwijder", "An error occurred while saving the Template. Please try again.": "Een fout is opgetreden tijdens het bewaren van de Sjabloon. Probeer het nog eens.", "Template \"%s\" saved.": "Sjabloon \"%s\" is bewaard.", "The current content will overwrite the selected Template. Are you sure?": "De huidige inhoud zal de geselecteerde Sjabloon overschrijven. Weet u het zeker?", "Give a title to your Template:": "Geef uw Sjabloon een naam:", "A Template with that title already exists, please change the title.": "Een Sjabloon met die naam bestaat al, past u de naam alstublieft aan.", "The Template will overwrite the current editor content. Are you sure?": "De Sjabloon zal de huidige inhoud van de editor overschrijven. Weet u het zeker?", "An error occurred while loading the Template. Please try again.": "Een fout deed zich voor bij het laden van de Sjabloon. Probeer het nog eens.", "Template \"%s\" loaded.": "Sjabloon \"%s\" geladen.", "Are you sure you want to delete the selected Template?": "Weet u zeker dat u de geselecteerde Sjabloon wilt verwijderen?", "An error occurred while deleting the Template. Please try again.": "Een fout deed zich voor bij het verwijderen van de Sjabloon. Probeer het nog eens.", "Click %s to insert audio.": "Klik %s om audio in te voegen.", "Audio": "Audio", "Insert audio": "Voeg audio in.", "Play": "Afspelen", "Play audio": "Audio afspelen", "Pause": "Pauzeren", "Pause audio": "Audio pauzeren", "Show audio": "Geef audio weer", "Close audio": "Sluit audio", "Please provide a valid link\/embed code for any of the supported audio services.": "Verstrek een geldige link\/insluitcode voor een van de ondersteunde audio diensten.", "Could not interpret the content as audio.": "Kan de inhoud niet als audio interpreteren.", "%s can't be set as background.": "%s kan niet als achtergrond ingesteld worden.", "Files": "Bestanden", "Insert audio embed code or url:": "Voeg een audio insluitcode of url in:", "Select audio from the list of available audios:": "Selecteer audio van de lijst met beschikbare audiobestanden:", "Click %s to add color.": "Klik %s om kleur toe te voegen.", "Click %s to insert image.": "Klik %s om een afbeelding in te voegen.", "Image": "Afbeelding", "Insert image": "Voeg een afbeedling in.", "Center &amp; fill": "Centreren &amp; vullen", "Fit": "Passen", "Stretch": "Uitrekken", "Image options": "Afbeelding opties:", "Image quality": "Afbeeldingskwaliteit", "Original": "Origineel", "High": "Hoog", "Normal": "Normaal", "Low": "Laag", "Proportional resize": "Proportioneel verschalen", "Set box to image original size": "Beperk vak tot originele afbeeldingsgrootte", "Disk": "Schijf", "Supported image file types:": "Toegestane afbeeldingsformaten:", "Select image file from disk (max size %s):": "Selecteer afbeeldingsbestand van schijf (max formaat %s):", "Browse...": "Bladeren...", "Image quality:": "Afbeeldingskwaliteit:", "Insert image URL link:": "Voeg afbeeldingslink URL in:", "Image description:": "Afbeeldingsomschrijving:", "Please insert image description.": "Voeg a.u.b. een afbeeldingsomschrijving in.", "Image description is too short.": "Afbeeldingsomschrijving is te kort.", "No file selected.": "Geen bestand geselecteerd.", "Please insert a link.": "Voeg a.u.b. een link in.", "An unexpected error occurred. Please try again.": "Een onbekende fout deed zich voor. Probeer het a.u.b. nog eens.", "There was an error during server image resize.": "Er deed zich een fout voor op de server tijdens het verschalen van de afbeelding.", "Loading...": "Laden...", "Could not interpret the content as image.": "Kan de inhoud niet als afbeelding interpreteren.", "File extension not valid.": "Bestandsextensie is niet geldig.", "File too big (max size: %s).": "Bestand is te groot (max formaat: %s).", "Error in reading the response from the server": "Fout bij het lezen van de response afkomstig van de server", "Method %s does not exist on %s.": "Methode %s bestaat niet op %s.", "Input not defined": "Input niet gedefinieerd", "Image file type cannot be resized.": "Van dit afbeeldings bestandstype kan de grootte niet worden aangepast.", "File is not a supported image.": "Het bestand is geen ondersteunde afbeelding.", "File is not recognized as valid image.": "Het bestand is niet herkend als geldige afbeelding.", "File is too big.": "Het bestand is te groot.", "Error during loading of the image.": "Fout tijdens het laden van de afbeelding.", "Too many \"%s\" boxes (limit: %s).": "Te veel \"%s\" vakken (limiet: %s).", "Too many total boxes (limit: %s).": "Totaal te veel vakken (limiet: %s).", "Unexpected error: could not finalize box style.": "Onverwachte fout: kan de stijl van het vak niet toepassen.", "Background": "Achtergrond", "Arrange": "Rangschikken", "Bring to front": "Breng naar voorkant", "Send to back": "Breng naar achteren", "Bring forward": "Breng naar voren", "Send backward": "Breng naar achterkant", "Duplicate": "Dupliceren", "Flip": "Kantelen", "Vertical": "Verticaal", "Horizontal": "Horizontaal", "Select background color": "Selecteer achtergrondkleur", "Opacity": "Dekking", "Box opacity": "Dekking vak", "Select box opacity": "Selecteer dekking vak", "Select background opacity": "Selecteer achtergrond dekking", "Background opacity": "Achtergrond dekking", "Border": "Rand", "Select border style": "Selecteer rand stijl", "Select border width": "Selecteer rand breedte", "Width": "Breedte", "Corners": "Hoeken", "Top left corner": "Bovenste linker hoek", "Top right corner": "Bovenste rechter hoek", "Bottom left corner": "Onderste linker hoek", "Bottom right corner": "Onderste rechter hoek", "Rounded corners": "Afgeronde hoeken", "Unexpected error: box has no content.": "Onverwachte fout: Vak heeft geen inhoud.", "Box type not supplied during registration.": "Vak niet voorzien van type gedurende de registratie.", "Video": "Video", "Click %s to insert text.": "Klik %s om een tekst in te voegen.", "Done": "Gereed", "Done editing": "Gereed met bewerken", "Font": "Lettertype", "Bold": "Dikgedrukt", "Italic": "Schuingedrukt", "Underline": "Onderstreep", "Increase font size": "Vergroot lettertype", "Decrease font size": "Verklein lettertype", "Text length exceeds the maximum limit.": "Tekstlengte overschrijd het maximum limiet. ", "Plain text.": "Eenvoudige tekst.", "Formatted text.": "Geformatteerde tekst.", "Paste text": "Plak tekst.", "Click %s to insert video.": "Klik %s om een video in te voegen.", "Insert video": "Voeg video in", "Play video": "Video afspelen", "Pause video": "Video pauzeren", "Show video": "Video weergeven", "Close video": "Video sluiten", "Please provide a valid link\/embed code for any of the supported video services.": "Verstrek een geldige link\/insluitcode voor een van de ondersteunde video diensten.", "Could not interpret the content as video.": "Kan de inhoud niet als video interpreteren.", "Insert video embed code or url:": "Voeg video insluitcode of url in:", "Select video from the list of available videos:": "Selecteer video van de lijst met beschikbare videobestanden:", "Add %s box": "voeg %s box toe", "Set as background": "Als achtergrond instellen", "Unset from background": "Van achtergrond terughalen", "Error in generating unique id.": "Fout in het genereren van een unieke id.", "Improper internal call.": "Onjuiste interne oproep.", "Please insert a value.": "Voer een waarde in.", "Browser does not support required feature \"%s\".": "Browser ondersteunt de vereiste functie \"%s\" niet.", "Could not initialize %s. Container not found.": "%s kon niet worden ge\u00efnitialiseerd. Container niet gevonden.", "Box type \"%s\" doesn't exist.": "Vak type \"%s\" bestaat niet.", "Error during box creation: %s.": "Fout tijdens het aanmaken van het vak: %s.", "Saving content.": "Bewaar inhoud.", "Please wait...": "Even wachten...", "Removed box. Box type \"%s\" not supported.": "Vak verwijderd. Vak type \"%s\" wordt niet ondersteund.", "This is a %s feature.": "Dit is een %s functie.", "For information, please visit %s.": "Voor informatie, bezoek %s.", "Box size and position": "Vlak grootte en positie", "Size": "Formaat", "Box": "Vak", "SEO and grouping tags": "SEO en tags groeperen", "Additional audio services:": "Additionele audio diensten:", "Supported in %s:": "Ondersteund in %s:", "Current color:": "Huidige kleur:", "Click on the \"%s\" button to start creating content for extra small layouts.": "Klik op de \"%s\" knop om inhoud te maken voor extra smalle layouts.", "Start responsive design": "Start responsief ontwerp", "Snap boxes to": "Vak uitlijnen op raster", "Page": "Pagina", "Boxes": "Vakken", "Content link": "Koppeling naar inhoud", "Content": "Inhoud", "Edit": "Wijzig", "Undo": "Ongedaan maken", "Redo": "Herdoen", "Clear all": "Leeg alles", "Click to set Hex color": "Klik om Hex kleur in te stellen", "Click to set RGB color": "Klik om RGB kleur in te stellen", "Solid color": "Effen kleur", "Horiz. gradient": "Horiz. kleurovergang", "Vert. gradient": "Vert. kleurovergang", "Radial gradient": "Radiale kleurovergang", "Select color opacity": "Selecteer kleurdekking", "Set custom color (Hex)": "Stel aangepaste kleur (Hex) in", "Please enter the color in hex format, e.g. %s": "Geef de kleur a.u.b. op in hex formaat, b.v. %s", "You must enter a color.": "U moet een kleur opgeven.", "Set custom color (RGB)": "Stel aangepaste kleur (RGB) in", "Please enter the color in RGB format, with comma-separated components, e.g. %s": "Geef de kleur a.u.b. op in RBG formaat, met komma tussen de tekens, b.v. %s"
    }
);
Zedity.i18n.add('pl', {
        "%s needs %s.": "%s potrzebuje %s", "Click %s to insert a document.": "Naci\u015bnij %s aby wstawi\u0107 dokument.", "Document": "Dokument", "Insert": "Wstaw", "Insert document": "Wstaw dokument", "Read": "Czytaj", "Read document": "Czytaj dokument", "Close": "Zamknij", "Close document": "Zamknij dokument", "Please provide a valid link\/embed code for any of the supported document embed services or a direct link to a document.": "Podaj prawid\u0142owy kod link do dowolnego z obs\u0142ugiwanych dokument\u00f3w, us\u0142ug lub bezpo\u015bredni link do dokumentu.", "Could not interpret the content as document.": "Nie mog\u0119 zinterpretowa\u0107 zawarto\u015bci jako dokumentu", "%s can't be rotated.": "%s nie mo\u017ce by\u0107 obr\u00f3cony", "%s doesn't support background property.": "%s nie obs\u0142uguje w\u0142a\u015bciwo\u015bci t\u0142a.", "%s doesn't support rounded corners.": "%s nie obs\u0142uguje zaokr\u0105glonych naro\u017cnik\u00f3w.", "%s doesn't support flipping.": "%s nie obs\u0142uguje obracania.", "Embed": "Osad\u017a", "Insert document embed code or url:": "Osad\u017a kod \u017ar\u00f3d\u0142owy dokumentu lub link URL:", "Supported services:": "Wspieranie us\u0142ugi:", "Supported documents:": "Wspierane dokumenty:", "PDF documents, Microsoft Office documents, Apple Pages, Adobe Photoshop and Illustrator, and more.": "dokumenty PDF, dokumenty Microsoft Office, strony Apple, Adobe Photoshop i Illustrator, oraz wi\u0119cej.", "OK": "OK", "Cancel": "Anuluj", "Click %s to insert HTML.": "Kliknij %s aby wklei\u0107 kod HTML.", "Html": "Html", "Insert HTML": "Wstaw kod HTML", "View": "Poka\u017c", "View box content": "Wy\u015bwietl zawarto\u015b\u0107 okna", "Insert HTML code:": "Wstaw kod HTML:", "Safe mode:": "Tryb bezpieczny:", "Automatic": "Automatyczny", "Enabled": "W\u0142\u0105czony", "Disabled": "Wy\u0142\u0105czony", "If you insert Javascript or CSS code and you get unexpected effects (e.g. content overflow, etc.) you need to enable safe mode.": "Je\u015bli wstawisz kod Javascript lub CSS i uzyskasz niespodziewane efekty (np. \"przep\u0142ywanie zawarto\u015bci\" itp.) powinienie\u015b u\u017cy\u0107 trybu bezpiecznego.", "The (default) automatic setting enables safe mode only if Javascript is detected.": "Domy\u015blne automnatyczne ustawienia uruchamiaj\u0105 tryb bezpieczny tylko je\u015bli kod Javascript jest wykryty.", "Some scripts (for example social network services) need to access the page, so the \"Safe mode\" must be disabled in these cases.": "Niekt\u00f3re skrypty (np. serwis\u00f3w spo\u0142eczno\u015bciowych) potrzebuj\u0105 dost\u0119pu do strony, dlatego \"Tryb bezpieczny\" musi by\u0107 deaktywowany w tych przypadkach.", "Inserting a %s content into an HTML box is not supported at the moment.": "Wstawienie %s zawarto\u015bci w okno HTML jest w tej chwili niemo\u017cliwe.", "Filters": "Filtry", "Apply image filters": "Zastosuj filtry obrazu", "Adjust colors": "Dopasuj kolory", "Black &amp; white": "Czarno bia\u0142y", "Blur": "Rozmycie", "Brightness": "Jasno\u015b\u0107", "Contrast": "Kontrast", "Emboss": "Wyrycie", "Grayscale": "Skala szaro\u015bci", "Invert": "Odwr\u00f3cenie", "Mosaic": "Mozajka", "Motion blur": "Rozmycie ruchu", "Noise": "Szum", "Paint": "Malowanie", "Posterize": "Posteryzacja", "Psychedelia": "Psychodelia", "Sepia": "Sephia", "Sharpen": "Ostro\u015b\u0107", "Vignette": "Winieta", "Apply filter": "Zastosuj filtr", "Reset filter": "Zresetuj filtr", "Remove all filters": "Usu\u0144 wszystkie filtry", "Error applying filter \"%s\".": "B\u0142\u0105d u\u017cycia filtra \"%s\".", "Filter \"%s\" not defined.": "Filtr \"%s\" nie zdefiniowany.", "Could not read image data. Filters cannot be applied on images hosted on a different domain.": "Nie mog\u0119 odczyta\u0107 obrazu. Filtr nie mo\u017ce by\u0107 hostowany na inn\u0105 domen\u0119.", "Percent": "Procent", "Adjustment": "Regulacja", "Threshold": "Pr\u00f3g", "Red": "Czerwony", "Green": "Zielony", "Blue": "Niebieski", "Amount": "Ilo\u015b\u0107", "Block size": "Rozmiar bloku", "Type": "Typ", "Strength": "Si\u0142a", "Brush size": "Rozmiar p\u0119dzla", "Link": "Link", "Add link to box": "Dodaj link do pola", "This link will be associated to the whole box.": "Ten link zostanie przypisany do ca\u0142ego pola.", "Insert link url:": "Wstaw link URL:", "Align": "Wyr\u00f3wnaj", "Align to page": "Dopasuj do strony", "Left": "Do lewej", "Center": "Wy\u015brodkuj", "Right": "Do prawej", "Top": "Do g\u00f3ry", "Middle": "Do \u015brodka", "Bottom": "Do do\u0142u", "Fit width": "Dopasuj szeroko\u015b\u0107", "Fit height": "Dopasuj wysoko\u015b\u0107", "Keep aspect ratio": "Zachowaj proporcje", "Select box padding": "Wybierz dope\u0142nienie pola", "Padding": "Dope\u0142nienie", "Shadow": "Cie\u0144", "Color": "Kolor", "Text": "Tekst", "Paragraph": "Paragraf", "Heading": "Nag\u0142\u00f3wek", "Align left": "Wyr\u00f3wnaj do lewej", "Align center": "Wyr\u00f3wnaj centralnie", "Align right": "Wyr\u00f3wnaj do prawej", "Justify": "Justuj", "Ordered list": "Uporz\u0105dkowana lista", "Unordered list": "Nieuporz\u0105dkowana lista", "Indent": "Wci\u0119cie", "Outdent": "Wyci\u0119cie", "Open link in the same tab.": "Otw\u00f3rz link w tej samej karcie.", "Open link in a new tab.": "Otw\u00f3rz link w nowej karcie.", "Link style preview": "Podgl\u0105d stylu linka", "Link style": "Styl linka", "Link style on mouse over": "Styl linka po najechaniu myszk\u0105", "Insert link": "Wstaw link", "Remove": "Usu\u0144", "The box link may override any link in the text.": "Okno linka mo\u017ce zast\u0105pi\u0107 dowolny link w tek\u015bcie.", "Align top": "Wyr\u00f3wnaj do g\u00f3ry", "Align middle": "Wyr\u00f3wnaj do \u015brodka", "Align bottom": "Wyr\u00f3wnaj do do\u0142u", "Extra small layout": "Bardzo ma\u0142y uk\u0142ad", "Small layout": "Ma\u0142y uk\u0142ad", "Medium layout": "\u015aredni uk\u0142ad", "Large layout": "Du\u017cy uk\u0142ad", "If you perform this action you will revert to a non-responsive design. Are you sure?": "Je\u015bli kontynuujesz wr\u00f3cisz do nie responsywnego projektu. Jeste\u015b pewny?", "You can start your design from any layout.": "Mo\u017cesz rozpocz\u0105\u0107 sw\u00f3j projekt z dowolnego uk\u0142adu.", "Boxes can be added in any layout and can be modified only in the layout they were added to.": "Pola mog\u0105 by\u0107 dodane do dowolnego uk\u0142adu ale modyfikowane z uk\u0142adu do kt\u00f3rego zosta\u0142y dodane.", "Boxes added in a layout can be hidden in other layouts.": "Pola dodane w jedym uk\u0142adzie mog\u0105 by\u0107 ukryte w innych uk\u0142adach.", "Custom layouts:": "Uk\u0142ad niestandardowy:", "Add custom layout": "Dodaj uk\u0142ad niestandardowy", "Multiple layout responsive design": "Projektowanie wielu uk\u0142ad\u00f3w responsywnych", "The width of custom layouts can be adjusted to fit larger designs.": "Szeroko\u015b\u0107 uk\u0142ad\u00f3w niestandardowych mo\u017cna dostosowa\u0107 do wi\u0119kszych projekt\u00f3w.", "Click on a layout button to start creating content for that layout.": "Kliknij na przycisku uk\u0142adu, aby rozpocz\u0105\u0107 tworzenie tre\u015bci tego uk\u0142adu.", "Save": "Zapisz", "Abort": "Przerwij", "You may want to review the design for layouts in yellow.": "Mo\u017cesz zobaczy\u0107 projekt dla uk\u0142ad\u00f3w na \u017c\u00f3\u0142to.", "Save without reviewing": "Zapisz bez ogl\u0105dania", "Please click on the layouts in gray to provide the design for all layouts.": "Prosz\u0119 klikn\u0105\u0107 na szary uk\u0142ad aby zapewni\u0107 projekt dla wszystkich uk\u0142ad\u00f3w.", "Save anyway (not recommended)": "Zapisz mimo wszystko (nie zalecane)", "Your responsive content is ready to be saved!": "Tw\u00f3j responsywny uk\u0142ad jest gotowy do zapisania!", "This box was created in another layout.": "To pole zosta\u0142o utworzeone w innym uk\u0142adzie.", "To modify its content edit the layout \"%s\".": "Aby zmodyfikowa\u0107 zawarto\u015b\u0107 edytuj uk\u0142ad \"%s\".", "The box is hidden in this layout.": "Pole jest ukryte w tym widoku", "Show box": "Poka\u017c pole", "Edit box": "Edytuj pole", "Show": "Poka\u017c", "Hide": "Ukryj", "Hide box in this layout": "Ukryj pole w tym uk\u0142adzie", "This link will be associated to the whole %s content.": "Ten link b\u0119dzie powi\u0105zany z ca\u0142\u0105 zawarto\u015bci\u0105 %s.", "Grid": "Siatka", "Width:": "Szeroko\u015b\u0107:", "Height:": "Wysoko\u015b\u0107:", "Delete": "Usu\u0144", "Click %s to insert audio.": "Kliknij %s aby wstawi\u0107 d\u017awi\u0119k.", "Audio": "D\u017awi\u0119k", "Insert audio": "Wstaw d\u017awi\u0119k", "Play": "Odtw\u00f3rz", "Play audio": "Odtw\u00f3rz d\u017awi\u0119k", "Pause": "Pauza", "Pause audio": "Pauzuj d\u017awi\u0119k", "Show audio": "Poka\u017c d\u017awi\u0119k", "Close audio": "Zamknij d\u017awi\u0119k", "Please provide a valid link\/embed code for any of the supported audio services.": "Prosz\u0119 zapewni\u0107 poprawny link do pliku audio", "Could not interpret the content as audio.": "Nie mog\u0119 zinterpretowa\u0107 zawarto\u015bci jako d\u017awi\u0119ku.", "%s can't be set as background.": "%s nie mo\u017ce by\u0107 ustawiony jako t\u0142o.", "Files": "Pliki", "Insert audio embed code or url:": "Wstaw URL do pliku d\u017awi\u0119kowego:", "Select audio from the list of available audios:": "Wybierz plik d\u017awi\u0119kowy z listy dost\u0119pnych plik\u00f3w audio:", "Click %s to add color.": "Kliknij %s aby doda\u0107 kolor.", "Click %s to insert image.": "Kliknij %s aby wstawi\u0107 obraz.", "Image": "Obraz", "Insert image": "Wstaw obraz", "Center &amp; fill": "Wy\u015brodkuj i wype\u0142nij", "Fit": "Dopasuj", "Stretch": "Rozci\u0105gnij", "Image options": "Opcje obrazu", "Image quality": "Jako\u015b\u0107 obrazu", "Original": "Origina\u0142", "High": "Wysoka", "Normal": "Normalna", "Low": "Niska", "Proportional resize": "Proporcjonalna zmiana obrazu", "Set box to image original size": "Ustaw pole do oryginalnego rozmiaru obrazu", "Disk": "Dysk", "Supported image file types:": "Wspierane typy plik\u00f3w obrazu:", "Select image file from disk (max size %s):": "Wybierz plik obrazu z dysku (maksymalny rozmiar %s):", "Browse...": "Przegl\u0105daj...", "Image quality:": "Jako\u015b\u0107 obrazu:", "Insert image URL link:": "Wstaw link URL do obrazu:", "Image description:": "Opis obrazu:", "Please insert image description.": "Prosz\u0119 wpisa\u0107 opis obrazu.", "Image description is too short.": "Opis obrazu jest za kr\u00f3tki.", "No file selected.": "Nie wybrano pliku.", "Please insert a link.": "Prosz\u0119 umie\u015bci\u0107 link URL.", "An unexpected error occurred. Please try again.": "Wyst\u0105pi\u0142 niespodziewany b\u0142\u0105d. Prosz\u0119 spr\u00f3buj ponownie.", "There was an error during server image resize.": "Wyst\u0105pi\u0142 b\u0142\u0105d w trakcie zmiany rozmiaru na serwerze.", "Loading...": "\u0141adowanie...", "Could not interpret the content as image.": "Nie mog\u0119 zinterpretowa\u0107 zawarto\u015bci jako obrazu.", "File extension not valid.": "Rozszerzenie pliku niepoprawne.", "File too big (max size: %s).": "Plik jest za du\u017cy (maksymalny rozmiar: %s).", "Error in reading the response from the server": "B\u0142\u0105d odpowiedzi serwera", "Method %s does not exist on %s.": "Metoda %s nie istnieje w %s.", "Input not defined": "Wej\u015bcie nie okre\u015blone", "Image file type cannot be resized.": "Ten typ pliku nie mo\u017ce by\u0107 przeskalowany.", "File is not a supported image.": "Plik nie jest wspierany jako obraz.", "File is not recognized as valid image.": "Plik nie jest rozpoznany jako prawid\u0142owy obraz.", "File is too big.": "Plik jest za du\u017cy.", "Error during loading of the image.": "B\u0142\u0105d w trakcie \u0142adowania obrazu.", "Too many \"%s\" boxes (limit: %s).": "Za du\u017co \"%s\" p\u00f3l (limit: %s).", "Too many total boxes (limit: %s).": "Za du\u017co p\u00f3l (limit: %s).", "Unexpected error: could not finalize box style.": "Nieoczekiwany b\u0142\u0105d: nie mog\u0119 zapisa\u0107 stylu pola.", "Background": "T\u0142o", "Arrange": "Organizuj", "Bring to front": "Przenie\u015b do przodu", "Send to back": "Przenie\u015b do ty\u0142u", "Bring forward": "Przenie\u015b na wierzch", "Send backward": "Przenie\u015b na ty\u0142", "Duplicate": "Duplikuj", "Flip": "Obr\u00f3\u0107", "Vertical": "Pionowo", "Horizontal": "Poziomo", "Select background color": "Wybierz kolor t\u0142a", "Opacity": "Krycie", "Box opacity": "Krycie pola", "Select box opacity": "Wybierz krycie pola", "Select background opacity": "Wybierz krycie t\u0142a", "Background opacity": "Krycie t\u0142a", "Border": "Ramka", "Select border style": "Wybierz styl obramowania", "Select border width": "Wybierz szeroko\u015b\u0107 obramowania", "Width": "Szeroko\u015b\u0107", "Corners": "Naro\u017cniki", "Top left corner": "Lewy g\u00f3rny r\u00f3g", "Top right corner": "Prawy g\u00f3rny r\u00f3g", "Bottom left corner": "Lewy dolny r\u00f3g", "Bottom right corner": "Prawy dolny r\u00f3g", "Rounded corners": "Zaokr\u0105glone naro\u017cniki", "Unexpected error: box has no content.": "Nieoczekiwany b\u0142\u0105d: pole nie ma zawarto\u015bci.", "Box type not supplied during registration.": "Typ pola nie dostarczony w trakcie rejestracji.", "Video": "Wideo", "Click %s to insert text.": "Kliknij %s aby wstawi\u0107 tekst.", "Done": "Gotowy", "Done editing": "Zako\u0144czenie edycji", "Font": "Czcionka", "Bold": "Pogrubiona", "Italic": "Pochylona", "Underline": "Podkre\u015blona", "Increase font size": "Zwi\u0119ksz rozmiar czcionki", "Decrease font size": "Zmniejsz rozmiar czcionki", "Text length exceeds the maximum limit.": "D\u0142ugo\u015b\u0107 tekstu przekracza okre\u015blony limit.", "Click %s to insert video.": "Kliknij %s aby wstawi\u0107 wideo.", "Insert video": "Wstaw wideo", "Play video": "Odtw\u00f3rz wideo", "Pause video": "Pauzuj wideo", "Show video": "Poka\u017c wideo", "Close video": "Zamknij wideo", "Please provide a valid link\/embed code for any of the supported video services.": "Prosz\u0119 zapewni\u0107 poprawny link do pliku wideo", "Could not interpret the content as video.": "Nie mog\u0119 zweryfikowa\u0107 tre\u015bci jako pliku wideo.", "Insert video embed code or url:": "Wstaw link wideo:", "Select video from the list of available videos:": "Wybierz wideo spo\u015br\u00f3d dost\u0119pnych plik\u00f3w wideo:", "Add %s box": "Dodaj pole %s", "Set as background": "Ustaw jako t\u0142o", "Unset from background": "Usu\u0144 z t\u0142a", "Error in generating unique id.": "B\u0142\u0105d w generowaniu unikatowego id.", "Improper internal call.": "Niew\u0142a\u015bciwe po\u0142\u0105czenie wewn\u0119trzne.", "Please insert a value.": "Prosz\u0119 wprowadzi\u0107 warto\u015b\u0107.", "Browser does not support required feature \"%s\".": "Przegl\u0105darka nie wspiera wymaganej funkcj \"%s\".", "Could not initialize %s. Container not found.": "Nie mo\u017cna zainicjowa\u0107 %s. Nie znaleziono kontenera.", "Box type \"%s\" doesn't exist.": "Pole typu \"%s\" nie istnieje.", "Error during box creation: %s.": "B\u0142\u0105d przy tworzeniu pola: %s.", "Saving content.": "Zapisywanie zawarto\u015bci.", "Please wait...": "Prosz\u0119 czeka\u0107...", "Removed box. Box type \"%s\" not supported.": "Usuni\u0119to pole. Typ pola \"%s\" nie wspierany.", "This is a %s feature.": "To jest funkcja %s.", "For information, please visit %s.": "Dla informacji, prosz\u0119 odwied\u017a %s.", "Box size and position": "Rozmiar pola i pozycja", "Size": "Rozmiar", "Box": "Pole", "SEO and grouping tags": "Tagi SEO i grupowanie", "Additional audio services:": "Dodatkowe us\u0142ugi d\u017awi\u0119kowe:", "Supported in %s:": "Wspierane w %s:", "Current color:": "Aktualny kolor:", "Click on the \"%s\" button to start creating content for extra small layouts.": "Kliknij na klawisz \"%s\" aby zacz\u0105\u0107 tworzy\u0107 zawarto\u015b\u0107 dla extra ma\u0142ego uk\u0142adu.", "Start responsive design": "Uruchom projektowanie uk\u0142adu responsywnego", "Snap boxes to": "Przyci\u0105gaj elementy do", "Page": "Strona", "Boxes": "Pola", "Content link": "Link do tre\u015bci", "Content": "Zawarto\u015b\u0107", "Edit": "Edytuj", "Undo": "Wstecz", "Redo": "Pon\u00f3w", "Clear all": "Wyczy\u015b\u0107 wszystko", "Click to set Hex color": "Kliknij tutaj aby wybra\u0107 kolor Hex", "Click to set RGB color": "Kliknij tutaj aby wybra\u0107 kolor RGB", "Solid color": "Pe\u0142ny kolor", "Horiz. gradient": "Poziomy gradient", "Vert. gradient": "Pionowy gradient", "Radial gradient": "Promieniowy gradient", "Select color opacity": "Wybierz kolor krycia", "Set custom color (Hex)": "Ustaw kolor niestandardowy (Hex)", "Please enter the color in hex format, e.g. %s": "Prosz\u0119 poda\u0107 kolor w formacie HEX np. %s", "You must enter a color.": "Musisz wpisa\u0107 kolor.", "Set custom color (RGB)": "Ustaw kolor niestandardowy (RGB)", "Please enter the color in RGB format, with comma-separated components, e.g. %s": "Prosz\u0119 poda\u0107 kolor w formacie RGB, z element\u00f3w oddzielonych przecinkami, np. %s"
    }
);
Zedity.i18n.add('ru', {
        "%s needs %s.": "%s \u043f\u0440\u0438 \u043d\u0435\u043e\u0431\u0445\u043e\u0434\u0438\u043c\u043e\u0441\u0442\u0438 %s.", "Click %s to insert a document.": "\u041a\u043b\u0438\u043a\u043d\u0438\u0442\u0435 \u043f\u043e %s \u0434\u043b\u044f \u0432\u0441\u0442\u0430\u0432\u043a\u0438 \u0432 \u0434\u043e\u043a\u0443\u043c\u0435\u043d\u0442.", "Document": "\u0414\u043e\u043a\u0443\u043c\u0435\u043d\u0442", "Insert": "\u0412\u0441\u0442\u0430\u0432\u043a\u0430", "Insert document": "\u0412\u0441\u0442\u0430\u0432\u043a\u0430 \u0434\u043e\u043a\u0443\u043c\u0435\u043d\u0442\u0430", "Read": "\u0427\u0442\u0435\u043d\u0438\u0435", "Read document": "\u0427\u0442\u0435\u043d\u0438\u0435 \u0434\u043e\u043a\u0443\u043c\u0435\u043d\u0442\u0430", "Close": "\u0417\u0430\u043a\u0440\u044b\u0442\u044c", "Close document": "\u0417\u0430\u043a\u0440\u044b\u0442\u044c \u0434\u043e\u043a\u0443\u043c\u0435\u043d\u0442", "Please provide a valid link\/embed code for any of the supported document embed services or a direct link to a document.": "\u041f\u043e\u0436\u0430\u043b\u0443\u0439\u0441\u0442\u0430, \u0443\u0441\u0442\u0430\u043d\u043e\u0432\u0438\u0442\u0435 \u0440\u0430\u0431\u043e\u0447\u0443\u044e \u0441\u0441\u044b\u043b\u043a\u0443\/\u0432\u0441\u0442\u0430\u0432\u043a\u0443 \u043a\u043e\u0434\u0430 \u0434\u043b\u044f \u043b\u044e\u0431\u043e\u0433\u043e \u0438\u0437 \u043f\u043e\u0434\u0434\u0435\u0440\u0436\u0438\u0432\u0430\u0435\u043c\u044b\u0445 \u0434\u043e\u043a\u0443\u043c\u0435\u043d\u0442\u043e\u0432 \u0438\u043b\u0438 \u043f\u0440\u044f\u043c\u0443\u044e \u0441\u0441\u044b\u043b\u043a\u0443 \u043d\u0430 \u0434\u043e\u043a\u0443\u043c\u0435\u043d\u0442.", "Could not interpret the content as document.": "\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u0440\u0430\u0441\u043f\u043e\u0437\u043d\u0430\u0442\u044c \u043a\u043e\u043d\u0442\u0435\u043d\u0442 \u043a\u0430\u043a \u0434\u043e\u043a\u0443\u043c\u0435\u043d\u0442.", "%s can't be rotated.": "%s \u043d\u0435\u0442 \u0432\u043e\u0437\u043c\u043e\u0436\u043d\u043e\u0441\u0442\u0438 \u0440\u0430\u0437\u0432\u0435\u0440\u043d\u0443\u0442\u044c", "%s doesn't support background property.": "%s \u043d\u0435 \u043f\u043e\u0434\u0434\u0435\u0440\u0436\u0438\u0432\u0430\u0435\u0442 \u0441\u0432\u043e\u0439\u0441\u0442\u0432\u0430 \u0444\u043e\u043d\u0430.", "%s doesn't support rounded corners.": "%s \u043d\u0435 \u043f\u043e\u0434\u0434\u0435\u0440\u0436\u0438\u0432\u0430\u0435\u0442 \u0441\u043a\u0440\u0443\u0433\u043b\u0435\u043d\u043d\u044b\u0435 \u0443\u0433\u043b\u044b.", "%s doesn't support flipping.": "%s \u043d\u0435 \u043f\u043e\u0434\u0434\u0435\u0440\u0436\u0438\u0432\u0430\u0435\u0442 \u043e\u0442\u0440\u0430\u0436\u0435\u043d\u0438\u0435.", "Embed": "\u0412\u0441\u0442\u0430\u0432\u043a\u0430", "Insert document embed code or url:": "\u0412\u0441\u0442\u0430\u0432\u044c\u0442\u0435 \u0432 \u0434\u043e\u043a\u0443\u043c\u0435\u043d\u0442 \u043a\u043e\u0434 \u0438\u043b\u0438 url:", "Supported services:": "\u0421\u043b\u0443\u0436\u0431\u0430 \u043f\u043e\u0434\u0434\u0435\u0440\u0436\u043a\u0438:", "Supported documents:": "\u041f\u043e\u0434\u0434\u0435\u0440\u0436\u0438\u0432\u0430\u0435\u043c\u044b\u0435 \u0434\u043e\u043a\u0443\u043c\u0435\u043d\u0442\u044b:", "PDF documents, Microsoft Office documents, Apple Pages, Adobe Photoshop and Illustrator, and more.": "PDF-\u0444\u0430\u0439\u043b\u044b, \u0444\u0430\u0439\u043b\u044b Microsoft Office, Apple-\u0444\u0430\u0439\u043b\u044b, Adobe Photoshop \u0438 Illustrator, \u0438 \u0434\u0440\u0443\u0433\u0438\u0435.", "OK": "OK", "Cancel": "\u041e\u0442\u043c\u0435\u043d\u0430", "Click %s to insert HTML.": "\u041a\u043b\u0438\u043a\u043d\u0438\u0442\u0435 %s \u0434\u043b\u044f \u0432\u0441\u0442\u0430\u0432\u043a\u0438 HTML-\u043a\u043e\u0434\u0430.", "Html": "Html", "Insert HTML": "\u0412\u0441\u0442\u0430\u0432\u043a\u0430 HTML", "View": "\u0412\u0438\u0434", "View box content": "\u041e\u0442\u043e\u0431\u0440\u0430\u0436\u0435\u043d\u0438\u0435 \u0431\u043b\u043e\u043a\u0430 \u043a\u043e\u043d\u0442\u0435\u043d\u0442\u0430", "Insert HTML code:": "\u0412\u0441\u0442\u0430\u0432\u043a\u0430 HTML \u043a\u043e\u0434\u0430:", "Safe mode:": "\u0411\u0435\u0437\u043e\u043f\u0430\u0441\u043d\u044b\u0439 \u0440\u0435\u0436\u0438\u043c:", "Automatic": "\u0410\u0432\u0442\u043e\u043c\u0430\u0442\u0438\u0447\u0435\u0441\u043a\u0438", "Enabled": "\u0412\u043a\u043b\u044e\u0447\u0435\u043d\u043e", "Disabled": "\u0412\u044b\u043a\u043b\u044e\u0447\u0435\u043d\u043e", "If you insert Javascript or CSS code and you get unexpected effects (e.g. content overflow, etc.) you need to enable safe mode.": "\u0415\u0441\u043b\u0438 \u043f\u0440\u0438 \u0432\u0441\u0442\u0430\u0432\u043a\u0438 Javascript \u0438\u043b\u0438 CSS \u043a\u043e\u0434\u0430 \u0432\u044b \u043f\u043e\u043b\u0443\u0447\u0438\u0442\u0435 \u043d\u0435\u043e\u0436\u0438\u0434\u0430\u043d\u043d\u044b\u0435 \u044d\u0444\u0444\u0435\u043a\u0442\u044b (\u043d\u0430\u043f\u0440\u0438\u043c\u0435\u0440, \u043f\u0435\u0440\u0435\u043f\u043e\u043b\u043d\u0435\u043d\u0438\u0435 \u043a\u043e\u043d\u0442\u0435\u043d\u0442\u0430 \u0438 \u0442.\u0434.), \u0412\u0430\u043c \u043d\u0435\u043e\u0431\u0445\u043e\u0434\u0438\u043c\u043e \u0432\u043a\u043b\u044e\u0447\u0438\u0442\u044c \u0431\u0435\u0437\u043e\u043f\u0430\u0441\u043d\u044b\u0439 \u0440\u0435\u0436\u0438\u043c.", "The (default) automatic setting enables safe mode only if Javascript is detected.": "(\u041f\u043e \u0443\u043c\u043e\u043b\u0447\u0430\u043d\u0438\u044e) \u0430\u0432\u0442\u043e\u043c\u0430\u0442\u0438\u0447\u0435\u0441\u043a\u0430\u044f \u043d\u0430\u0441\u0442\u0440\u043e\u0439\u043a\u0430 \u0432\u043a\u043b\u044e\u0447\u0438\u0442\u0441\u044f \u0432 \u0431\u0435\u0437\u043e\u043f\u0430\u0441\u043d\u043e\u043c \u0440\u0435\u0436\u0438\u043c\u0435, \u0442\u043e\u043b\u044c\u043a\u043e \u0435\u0441\u043b\u0438 \u043e\u0431\u043d\u0430\u0440\u0443\u0436\u0435\u043d Javascript.", "Inserting a %s content into an HTML box is not supported at the moment.": "\u0412\u0441\u0442\u0430\u0432\u043a\u0430 %s \u0432 \u0441\u043e\u0434\u0435\u0440\u0436\u0438\u043c\u043e\u0435 \u043e\u043a\u043d\u0430 HTML-\u043a\u043e\u0434\u0430 \u043d\u0435 \u043f\u043e\u0434\u0434\u0435\u0440\u0436\u0438\u0432\u0430\u0435\u0442\u0441\u044f \u0432 \u0434\u0430\u043d\u043d\u044b\u0439 \u043c\u043e\u043c\u0435\u043d\u0442.", "Filters": "\u0424\u0438\u043b\u044c\u0442\u0440\u044b", "Apply image filters": "\u041f\u0440\u0438\u043c\u0435\u043d\u0438\u0442\u044c \u0444\u0438\u043b\u044c\u0442\u0440\u044b \u0438\u0437\u043e\u0431\u0440\u0430\u0436\u0435\u043d\u0438\u044f", "Adjust colors": "\u041d\u0430\u0441\u0442\u0440\u043e\u0439\u043a\u0430 \u0446\u0432\u0435\u0442\u0430", "Black &amp; white": "\u0427\u0435\u0440\u043d\u043e-\u0431\u0435\u043b\u044b\u0439", "Blur": "\u0417\u0430\u0442\u0435\u043c\u043d\u0438\u0442\u044c", "Brightness": "\u042f\u0440\u043a\u043e\u0441\u0442\u044c", "Contrast": "\u041a\u043e\u043d\u0442\u0440\u0430\u0441\u0442\u043d\u043e\u0441\u0442\u044c", "Emboss": "\u0422\u0438\u0441\u043d\u0435\u043d\u043d\u043e\u0441\u0442\u044c", "Grayscale": "\u0413\u0440\u0430\u0434\u0430\u0446\u0438\u044f \u0441\u0435\u0440\u043e\u0433\u043e", "Invert": "\u0418\u043d\u0432\u0435\u0440\u0442\u0438\u0440\u043e\u0432\u0430\u0442\u044c", "Mosaic": "\u041f\u0438\u043a\u0441\u0435\u043b\u0438\u0437\u0430\u0446\u0438\u044f", "Motion blur": "\u0420\u0430\u0437\u043c\u044b\u0442\u0438\u0435", "Noise": "\u0428\u0443\u043c\u043e\u0432\u043e\u0439 \u044d\u0444\u0444\u0435\u043a\u0442", "Paint": "\u041e\u043a\u0440\u0430\u0448\u0438\u0432\u0430\u043d\u0438\u0435", "Posterize": "\u041f\u043e\u0441\u0442\u0435\u0440\u0438\u0437\u0430\u0446\u0438\u044f", "Psychedelia": "\u041f\u0441\u0438\u0445\u043e\u0434\u0435\u043b\u0438\u044f", "Sepia": "\u0421\u0435\u043f\u0438\u044f", "Sharpen": "\u041e\u0442\u0442\u0430\u0447\u0438\u0442\u044c", "Vignette": "\u0412\u0438\u043d\u044c\u0435\u0442\u043a\u0438", "Apply filter": "\u041f\u0440\u0438\u043c\u0435\u043d\u0438\u0442\u044c \u0444\u0438\u043b\u044c\u0442\u0440", "Reset filter": "\u0421\u0431\u0440\u043e\u0441 \u0444\u0438\u043b\u044c\u0442\u0440\u0430", "Remove all filters": "\u0423\u0431\u0440\u0430\u0442\u044c \u0432\u0441\u0435 \u0444\u0438\u043b\u044c\u0442\u0440\u044b", "Error applying filter \"%s\".": "\u041e\u0448\u0438\u0431\u043a\u0430 \u043f\u0440\u0438\u043c\u0435\u043d\u0435\u043d\u0438\u044f \u0444\u0438\u043b\u044c\u0442\u0440\u0430 \"%s\".", "Filter \"%s\" not defined.": "\u0424\u0438\u043b\u044c\u0442\u0440 \"%s\" \u043d\u0435 \u043e\u043f\u0440\u0435\u0434\u0435\u043b\u0435\u043d.", "Could not read image data. Filters cannot be applied on images hosted on a different domain.": "\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u0441\u0447\u0438\u0442\u0430\u0442\u044c \u0434\u0430\u043d\u043d\u044b\u0435 \u0438\u0437\u043e\u0431\u0440\u0430\u0436\u0435\u043d\u0438\u044f. \u0424\u0438\u043b\u044c\u0442\u0440\u044b \u043d\u0435 \u043c\u043e\u0433\u0443\u0442 \u043f\u0440\u0438\u043c\u0435\u043d\u044f\u0442\u044c\u0441\u044f \u043a \u0438\u0437\u043e\u0431\u0440\u0430\u0436\u0435\u043d\u0438\u044e, \u0435\u0441\u043b\u0438 \u043e\u043d \u0440\u0430\u0437\u043c\u0435\u0449\u0435\u043d \u043d\u0430 \u0434\u0440\u0443\u0433\u043e\u043c \u0434\u043e\u043c\u0435\u043d\u0435.", "Percent": "\u041f\u0440\u043e\u0446\u0435\u043d\u0442", "Adjustment": "\u041f\u043e\u0434\u0433\u043e\u043d\u043a\u0430", "Threshold": "\u041f\u0440\u0435\u0434\u0435\u043b", "Red": "\u041a\u0440\u0430\u0441\u043d\u044b\u0439", "Green": "\u0417\u0435\u043b\u0435\u043d\u044b\u0439", "Blue": "\u0421\u0438\u043d\u0438\u0439", "Amount": "\u041a\u043e\u043b\u0438\u0447\u0435\u0441\u0442\u0432\u043e", "Block size": "\u0420\u0430\u0437\u043c\u0435\u0440 \u0431\u043b\u043e\u043a\u0430", "Type": "\u0422\u0438\u043f", "Strength": "\u041f\u0440\u043e\u0447\u043d\u043e\u0441\u0442\u044c", "Brush size": "\u0420\u0430\u0437\u043c\u0435\u0440 \u043a\u0438\u0441\u0442\u0438", "Link": "\u0421\u0441\u044b\u043b\u043a\u0430", "Add link to box": "\u0414\u043e\u0431\u0430\u0432\u0438\u0442\u044c \u0441\u0441\u044b\u043b\u043a\u0443 \u0432 \u0431\u043b\u043e\u043a", "This link will be associated to the whole box.": "\u042d\u0442\u0430 \u0441\u0441\u044b\u043b\u043a\u0430 \u0431\u0443\u0434\u0435\u0442 \u0441\u0432\u044f\u0437\u0430\u043d\u0430 \u0441 \u0431\u043b\u043e\u043a\u043e\u043c.", "Insert link url:": "\u0412\u0441\u0442\u0430\u0432\u044c\u0442\u0435 \u0441\u0441\u044b\u043b\u043a\u0443 url:", "Align": "\u0420\u0430\u0441\u043f\u043e\u043b\u043e\u0436\u0435\u043d\u0438\u0435", "Align to page": "\u0412\u044b\u0440\u0430\u0432\u043d\u0438\u0432\u0430\u043d\u0438\u0435 \u043e\u0442\u043d\u043e\u0441\u0438\u0442\u0435\u043b\u044c\u043d\u043e \u0441\u0442\u0440\u0430\u043d\u0438\u0446\u044b", "Left": "\u041f\u043e \u043b\u0435\u0432\u043e\u043c\u0443 \u043a\u0440\u0430\u044e", "Center": "\u041f\u043e \u0446\u0435\u043d\u0442\u0440\u0443", "Right": "\u041f\u043e \u043f\u0440\u0430\u0432\u043e\u043c\u0443 \u043a\u0440\u0430\u044e", "Top": "\u0421\u0432\u0435\u0440\u0445\u0443", "Middle": "\u041f\u043e \u0441\u0435\u0440\u0435\u0434\u0438\u043d\u0435", "Bottom": "\u0421\u043d\u0438\u0437\u0443", "Fit width": "\u041f\u043e \u0448\u0438\u0440\u0438\u043d\u0435", "Fit height": "\u041f\u043e \u0432\u044b\u0441\u043e\u0442\u0435", "(min: %s, max: %s)": "(\u043c\u0438\u043d: %s, \u043c\u0430\u043a\u0441: %s)", "Keep aspect ratio": "\u0421\u043e\u0445\u0440\u0430\u043d\u044f\u0442\u044c \u043f\u0440\u043e\u043f\u043e\u0440\u0446\u0438\u0438", "Select box padding": "\u0412\u044b\u0431\u0440\u0430\u0442\u044c \u0432\u043d\u0443\u0442\u0440\u0435\u043d\u043d\u0438\u0439 \u043e\u0442\u0441\u0442\u0443\u043f \u0431\u043b\u043e\u043a\u0430", "Padding": "\u0412\u043d\u0443\u0442\u0440\u0435\u043d\u043d\u0438\u0435 \u043e\u0442\u0441\u0442\u0443\u043f\u044b", "Shadow": "\u0412\u0441\u0442\u0430\u0432\u043a\u0430 \u0442\u0435\u043d\u0438", "Color": "\u0426\u0432\u0435\u0442", "Text": "\u0422\u0435\u043a\u0441\u0442", "Paragraph": "\u041f\u0430\u0440\u0430\u0433\u0440\u0430\u0444", "Heading": "\u0417\u0430\u0433\u043e\u043b\u043e\u0432\u043e\u043a", "Align left": "\u041f\u043e \u043b\u0435\u0432\u043e\u043c\u0443 \u043a\u0440\u0430\u044e", "Align center": "\u041f\u043e \u0446\u0435\u043d\u0442\u0440\u0443", "Align right": "\u041f\u043e \u043f\u0440\u0430\u0432\u043e\u043c\u0443 \u043a\u0440\u0430\u044e", "Justify": "\u0412\u044b\u0440\u043e\u0432\u043d\u0438\u0442\u044c \u0441\u043f\u0440\u0430\u0432\u0430 \u0438 \u0441\u043b\u0435\u0432\u0430", "Ordered list": "\u041d\u0443\u043c\u0435\u0440\u043e\u0432\u0430\u043d\u043d\u044b\u0439 \u0441\u043f\u0438\u0441\u043e\u043a", "Unordered list": "\u041c\u0430\u0440\u043a\u0438\u0440\u043e\u0432\u0430\u043d\u043d\u044b\u0439 \u0441\u043f\u0438\u0441\u043e\u043a", "Indent": "\u041e\u0442\u0441\u0442\u0443\u043f", "Outdent": "\u0412\u044b\u0441\u0442\u0443\u043f", "Open link in the same tab.": "\u041e\u0442\u043a\u0440\u044b\u0442\u044c \u0441\u0441\u044b\u043b\u043a\u0443 \u0432 \u0442\u043e\u0439 \u0436\u0435 \u0432\u043a\u043b\u0430\u0434\u043a\u0435.", "Open link in a new tab.": "\u041e\u0442\u043a\u0440\u044b\u0442\u044c \u0441\u0441\u044b\u043b\u043a\u0443 \u0432 \u043d\u043e\u0432\u043e\u0439 \u0432\u043a\u043b\u0430\u0434\u043a\u0435.", "Link style preview": "\u0421\u0442\u0438\u043b\u044c \u0441\u0441\u044b\u043b\u043a\u0438 \u043f\u0440\u0435\u0434\u0432\u0430\u0440\u0438\u0442\u0435\u043b\u044c\u043d\u043e\u0433\u043e \u043f\u0440\u043e\u0441\u043c\u043e\u0442\u0440\u0430", "Link style": "\u0421\u0442\u0438\u043b\u044c \u0441\u0441\u044b\u043b\u043a\u0438", "Link style on mouse over": "\u0421\u0442\u0438\u043b\u044c \u0441\u0441\u044b\u043b\u043a\u0438 \u043f\u0440\u0438 \u043d\u0430\u0432\u0435\u0434\u0435\u043d\u0438\u0438 \u043a\u0443\u0440\u0441\u043e\u0440\u0430", "Insert link": "\u0412\u0441\u0442\u0430\u0432\u043a\u0430 \u0441\u0441\u044b\u043b\u043a\u0438", "Remove": "\u0423\u0434\u0430\u043b\u0438\u0442\u044c", "The box link may override any link in the text.": "\u0421\u0441\u044b\u043b\u043a\u0430 \u0432 \u0431\u043b\u043e\u043a\u0435 \u043c\u043e\u0436\u0435\u0442 \u043f\u0435\u0440\u0435\u043e\u043f\u0440\u0435\u0434\u0435\u043b\u0438\u0442\u044c \u043b\u044e\u0431\u0443\u044e \u0441\u0441\u044b\u043b\u043a\u0443 \u0432 \u0442\u0435\u043a\u0441\u0442\u0435.", "Align top": "\u0421\u0432\u0435\u0440\u0445\u0443", "Align middle": "\u041f\u043e \u0441\u0435\u0440\u0435\u0434\u0438\u043d\u0435", "Align bottom": "\u0421\u043d\u0438\u0437\u0443", "Extra small layout": "\u041e\u0447\u0435\u043d\u044c \u043c\u0435\u043b\u043a\u0438\u0439 \u043c\u0430\u043a\u0435\u0442", "Small layout": "\u041d\u0435\u0431\u043e\u043b\u044c\u0448\u043e\u0439 \u043c\u0430\u043a\u0435\u0442", "Medium layout": "\u0421\u0440\u0435\u0434\u043d\u0438\u0439 \u043c\u0430\u043a\u0435\u0442", "Large layout": "\u0411\u043e\u043b\u044c\u0448\u043e\u0439 \u043c\u0430\u043a\u0435\u0442", "If you perform this action you will revert to a non-responsive design. Are you sure?": "\u0415\u0441\u043b\u0438 \u0432\u044b \u0432\u044b\u043f\u043e\u043b\u043d\u0438\u0442\u0435 \u044d\u0442\u043e \u0434\u0435\u0439\u0441\u0442\u0432\u0438\u0435 \u0432\u044b \u0432\u043e\u0437\u0432\u0440\u0430\u0442\u0438\u0442\u0435\u0441\u044c \u043a \u043d\u0430\u0441\u0442\u0440\u043e\u0439\u043a\u0430\u043c \u043d\u0435\u043e\u0442\u0432\u0435\u0447\u0430\u044e\u0449\u0438\u043c \u0432\u0430\u0448\u0435\u043c\u0443 \u0434\u0438\u0437\u0430\u0439\u043d\u0443. \u0412\u044b \u0443\u0432\u0435\u0440\u0435\u043d\u044b?", "Custom layouts:": "\u041d\u0430\u0441\u0442\u0440\u043e\u0439\u043a\u0438 \u043c\u0430\u043a\u0435\u0442\u043e\u0432:", "Add custom layout": "\u0414\u043e\u0431\u0430\u0432\u0438\u0442\u044c \u043f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u0442\u0435\u043b\u044c\u0441\u043a\u0438\u0439 \u043c\u0430\u043a\u0435\u0442", "Multiple layout responsive design": "\u041d\u0435\u0441\u043a\u043e\u043b\u044c\u043a\u043e \u043c\u0430\u043a\u0435\u0442\u043e\u0432 \u0441 \u043e\u0442\u0437\u044b\u0432\u0447\u0438\u0432\u044b\u043c \u0434\u0438\u0437\u0430\u0439\u043d\u043e\u043c", "The width of custom layouts can be adjusted to fit larger designs.": "\u0428\u0438\u0440\u0438\u043d\u0443 \u043f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u0442\u0435\u043b\u044c\u0441\u043a\u0438\u0445 \u043c\u0430\u043a\u0435\u0442\u043e\u0432 \u043c\u043e\u0436\u043d\u043e \u043f\u043e\u0434\u043e\u0433\u043d\u0430\u0442\u044c \u043f\u043e\u0434 \u043a\u0440\u0443\u043f\u043d\u044b\u0435 \u043f\u0440\u043e\u0435\u043a\u0442\u044b.", "Save": "\u0421\u043e\u0445\u0440\u0430\u043d\u0438\u0442\u044c", "Abort": "\u0412\u044b\u043a\u0438\u043d\u0443\u0442\u044c", "You may want to review the design for layouts in yellow.": "\u0412\u044b \u043c\u043e\u0436\u0435\u0442\u0435 \u043f\u0435\u0440\u0435\u0441\u043c\u043e\u0442\u0440\u0435\u0442\u044c \u0434\u0438\u0437\u0430\u0439\u043d \u0434\u043b\u044f \u043c\u0430\u043a\u0435\u0442\u043e\u0432 \u0432 \u0436\u0435\u043b\u0442\u043e\u043c \u0446\u0432\u0435\u0442\u0435.", "Save without reviewing": "\u0421\u043e\u0445\u0440\u0430\u043d\u0438\u0442\u044c \u0431\u0435\u0437 \u0440\u0430\u0441\u0441\u043c\u043e\u0442\u0440\u0435\u043d\u0438\u044f", "Please click on the layouts in gray to provide the design for all layouts.": "\u041f\u043e\u0436\u0430\u043b\u0443\u0439\u0441\u0442\u0430, \u043d\u0430\u0436\u043c\u0438\u0442\u0435 \u043d\u0430 \u0441\u0435\u0440\u044b\u0435 \u043c\u0430\u043a\u0435\u0442\u044b, \u0447\u0442\u043e\u0431\u044b \u043f\u043e\u0441\u043c\u043e\u0442\u0440\u0435\u0442\u044c \u0434\u0438\u0437\u0430\u0439\u043d \u0434\u043b\u044f \u0432\u0441\u0435\u0445 \u043c\u0430\u043a\u0435\u0442\u043e\u0432.", "Save anyway (not recommended)": "\u0421\u043e\u0445\u0440\u0430\u043d\u044f\u0442\u044c \u0432\u0441\u0435\u0433\u0434\u0430 (\u043d\u0435 \u0440\u0435\u043a\u043e\u043c\u0435\u043d\u0434\u0443\u0435\u0442\u0441\u044f)", "Your responsive content is ready to be saved!": "\u0412\u0430\u0448 \u043a\u043e\u043d\u0442\u0435\u043d\u0442 \u0433\u043e\u0442\u043e\u0432 \u043a \u0441\u043e\u0445\u0440\u0430\u043d\u0435\u043d\u0438\u044e!", "Edit box": "\u0420\u0435\u0434\u0430\u043a\u0442\u0438\u0440\u043e\u0432\u0430\u0442\u044c \u0431\u043b\u043e\u043a", "Show": "\u041f\u043e\u043a\u0430\u0437\u0430\u0442\u044c", "This link will be associated to the whole %s content.": "\u042d\u0442\u0430 \u0441\u0441\u044b\u043b\u043a\u0430 \u0431\u0443\u0434\u0435\u0442 \u0441\u0432\u044f\u0437\u0430\u043d\u0430 \u0441\u043e \u0432\u0441\u0435\u043c \u043a\u043e\u043d\u0442\u0435\u043d\u0442\u043e\u043c %s.", "Width:": "\u0428\u0438\u0440\u0438\u043d\u0430:", "Height:": "\u0412\u044b\u0441\u043e\u0442\u0430:", "Delete": "\u0423\u0434\u0430\u043b\u0438\u0442\u044c", "Click %s to insert audio.": "\u041d\u0430\u0436\u043c\u0438\u0442\u0435 %s \u0434\u043b\u044f \u0432\u0441\u0442\u0430\u0432\u043a\u0438 \u0430\u0443\u0434\u0438\u043e.", "Audio": "\u0410\u0443\u0434\u0438\u043e", "Insert audio": "\u0412\u0441\u0442\u0430\u0432\u043a\u0430 \u0430\u0443\u0434\u0438\u043e", "Play": "\u041f\u0443\u0441\u043a", "Play audio": "\u0417\u0430\u043f\u0443\u0441\u043a \u0430\u0443\u0434\u0438\u043e", "Pause": "\u041f\u0430\u0443\u0437\u0430", "Pause audio": "\u041f\u0430\u0443\u0437\u0430 \u0430\u0443\u0434\u0438\u043e", "Show audio": "\u041f\u043e\u043a\u0430\u0437\u0430\u0442\u044c \u0430\u0443\u0434\u0438\u043e", "Close audio": "\u0417\u0430\u043a\u0440\u044b\u0442\u044c \u0430\u0443\u0434\u0438\u043e", "Please provide a valid link\/embed code for any of the supported audio services.": "\u041f\u043e\u0436\u0430\u043b\u0443\u0439\u0441\u0442\u0430, \u0432\u0441\u0442\u0430\u0432\u044c\u0442\u0435 \u0440\u0430\u0431\u043e\u0447\u0443\u044e \u0441\u0441\u044b\u043b\u043a\u0443\/\u0432\u0441\u0442\u0430\u0432\u044c\u0442\u0435 \u043a\u043e\u0434 \u0438\u0437 \u043b\u044e\u0431\u044b\u0445 \u043f\u043e\u0434\u0434\u0435\u0440\u0436\u0438\u0432\u0430\u0435\u043c\u044b\u0445 \u0430\u0443\u0434\u0438\u043e \u0441\u0435\u0440\u0432\u0438\u0441\u043e\u0432.", "Could not interpret the content as audio.": "\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u0432\u043e\u0441\u043f\u0440\u043e\u0438\u0437\u0432\u0435\u0441\u0442\u0438 \u043a\u043e\u043d\u0442\u0435\u043d\u0442 \u043a\u0430\u043a \u0430\u0443\u0434\u0438\u043e.", "%s can't be set as background.": "%s \u043d\u0435 \u043c\u043e\u0436\u0435\u0442 \u0431\u044b\u0442\u044c \u0443\u0441\u0442\u0430\u043d\u043e\u0432\u043b\u0435\u043d \u0432 \u043a\u0430\u0447\u0435\u0441\u0442\u0432\u0435 \u0444\u043e\u043d\u0430.", "Files": "\u0424\u0430\u0439\u043b\u044b", "Insert audio embed code or url:": "\u0414\u043b\u044f \u0432\u0441\u0442\u0430\u0432\u043a\u0438 \u0430\u0443\u0434\u0438\u043e \u0434\u043e\u0431\u0430\u0432\u044c\u0442\u0435 \u043a\u043e\u0434 \u0438\u043b\u0438 url:", "Select audio from the list of available audios:": "\u0412\u044b\u0431\u0435\u0440\u0438\u0442\u0435 \u0430\u0443\u0434\u0438\u043e \u0438\u0437 \u0441\u043f\u0438\u0441\u043a\u0430 \u0434\u043e\u0441\u0442\u0443\u043f\u043d\u044b\u0445 \u0430\u0443\u0434\u0438\u043e-\u0444\u0430\u0439\u043b\u043e\u0432:", "Click %s to add color.": "\u041d\u0430\u0436\u043c\u0438\u0442\u0435 %s \u0434\u043b\u044f \u0434\u043e\u0431\u0430\u0432\u043b\u0435\u043d\u0438\u044f \u0446\u0432\u0435\u0442\u0430.", "Click %s to insert image.": "\u041d\u0430\u0436\u043c\u0438\u0442\u0435 %s \u0434\u043b\u044f \u0432\u0441\u0442\u0430\u0432\u043a\u0438 \u0438\u0437\u043e\u0431\u0440\u0430\u0436\u0435\u043d\u0438\u044f.", "Image": "\u0418\u0437\u043e\u0431\u0440\u0430\u0436\u0435\u043d\u0438\u0435", "Insert image": "\u0412\u0441\u0442\u0430\u0432\u043a\u0430 \u0438\u0437\u043e\u0431\u0440\u0430\u0436\u0435\u043d\u0438\u044f", "Center &amp; fill": "\u0426\u0435\u043d\u0442\u0440 &amp; \u0437\u0430\u043f\u043e\u043b\u043d\u0438\u0442\u044c", "Fit": "\u041f\u043e\u0434\u0433\u043e\u043d\u044f\u0442\u044c", "Stretch": "\u0420\u0430\u0441\u0442\u0435\u043d\u0443\u0442\u044c", "Image options": "\u041d\u0430\u0441\u0442\u0440\u043e\u0439\u043a\u0430 \u0438\u0437\u043e\u0431\u0440\u0430\u0436\u0435\u043d\u0438\u044f", "Image quality": "\u041a\u0430\u0447\u0435\u0441\u0442\u0432\u043e \u0438\u0437\u043e\u0431\u0440\u0430\u0436\u0435\u043d\u0438\u044f", "Original": "\u041d\u0430\u0442\u0443\u0440\u0430\u043b\u044c\u043d\u044b\u0439", "High": "\u0412\u044b\u0441\u043e\u043a\u043e\u0435", "Normal": "\u041d\u043e\u0440\u043c\u0430\u043b\u044c\u043d\u043e\u0435", "Low": "\u041d\u0438\u0437\u043a\u043e\u0435", "Proportional resize": "\u041f\u0440\u043e\u043f\u043e\u0440\u0446\u0438\u043e\u043d\u0430\u043b\u044c\u043d\u043e\u0435 \u0438\u0437\u043c\u0435\u043d\u0435\u043d\u0438\u0435 \u0440\u0430\u0437\u043c\u0435\u0440\u0430", "Set box to image original size": "\u0423\u0441\u0442\u0430\u043d\u043e\u0432\u043a\u0430 \u0431\u043b\u043e\u043a\u0430 \u0438\u0437\u043e\u0431\u0440\u0430\u0436\u0435\u043d\u0438\u044f \u0441 \u0440\u0430\u0437\u043c\u0435\u0440\u0430\u043c\u0438 \u043e\u0440\u0438\u0433\u0438\u043d\u0430\u043b\u0430 .", "Disk": "\u041a\u0440\u0443\u0433", "Supported image file types:": "\u041f\u043e\u0434\u0434\u0435\u0440\u0436\u0438\u0432\u0430\u0435\u043c\u044b\u0435 \u0442\u0438\u043f\u044b \u0444\u0430\u0439\u043b\u043e\u0432 \u0438\u0437\u043e\u0431\u0440\u0430\u0436\u0435\u043d\u0438\u0439:", "Select image file from disk (max size %s):": "\u0412\u044b\u0431\u0435\u0440\u0438\u0442\u0435 \u0444\u0430\u0439\u043b \u0438\u0437\u043e\u0431\u0440\u0430\u0436\u0435\u043d\u0438\u044f \u0441 \u0434\u0438\u0441\u043a\u0430 (\u043c\u0430\u043a\u0441 \u0440\u0430\u0437\u043c\u0435\u0440 %s):", "Browse...": "\u041f\u0435\u0440\u0435\u0439\u0442\u0438...", "Image quality:": "\u041a\u0430\u0447\u0435\u0441\u0442\u0432\u043e \u0438\u0437\u043e\u0431\u0440\u0430\u0436\u0435\u043d\u0438\u044f:", "Insert image URL link:": "\u0412\u0441\u0442\u0430\u0432\u043a\u0430 \u0441\u0441\u044b\u043b\u043a\u0438 \u043d\u0430 \u0438\u0437\u043e\u0431\u0440\u0430\u0436\u0435\u043d\u0438\u0435:", "Image description:": "\u041e\u043f\u0438\u0441\u0430\u043d\u0438\u0435 \u0438\u0437\u043e\u0431\u0440\u0430\u0436\u0435\u043d\u0438\u044f:", "Please insert image description.": "\u041f\u043e\u0436\u0430\u043b\u0443\u0439\u0441\u0442\u0430, \u0432\u0441\u0442\u0430\u0432\u044c\u0442\u0435 \u043e\u043f\u0438\u0441\u0430\u043d\u0438\u0435 \u0438\u0437\u043e\u0431\u0440\u0430\u0436\u0435\u043d\u0438\u044f.", "Image description is too short.": "\u041e\u043f\u0438\u0441\u0430\u043d\u0438\u0435 \u0438\u0437\u043e\u0431\u0440\u0430\u0436\u0435\u043d\u0438\u044f \u044f\u0432\u043b\u044f\u0435\u0442\u0441\u044f \u0441\u043b\u0438\u0448\u043a\u043e\u043c \u043a\u043e\u0440\u043e\u0442\u043a\u0438\u043c.", "No file selected.": "\u0424\u0430\u0439\u043b \u043d\u0435 \u0432\u044b\u0431\u0440\u0430\u043d.", "Please insert a link.": "\u041f\u043e\u0436\u0430\u043b\u0443\u0439\u0441\u0442\u0430, \u0432\u0441\u0442\u0430\u0432\u044c\u0442\u0435 \u0441\u0441\u044b\u043b\u043a\u0443.", "An unexpected error occurred. Please try again.": "\u041f\u0440\u043e\u0438\u0437\u043e\u0448\u043b\u0430 \u043d\u0435\u043f\u0440\u0435\u0434\u0432\u0438\u0434\u0435\u043d\u043d\u0430\u044f \u043e\u0448\u0438\u0431\u043a\u0430. \u041f\u043e\u0436\u0430\u043b\u0443\u0439\u0441\u0442\u0430, \u043f\u043e\u043f\u0440\u043e\u0431\u0443\u0439\u0442\u0435 \u0435\u0449\u0435 \u0440\u0430\u0437.", "There was an error during server image resize.": "\u041f\u0440\u043e\u0438\u0437\u043e\u0448\u043b\u0430 \u043e\u0448\u0438\u0431\u043a\u0430 \u043d\u0430 \u0441\u0435\u0440\u0432\u0435\u0440\u0435 \u0432\u043e \u0432\u0440\u0435\u043c\u044f \u0438\u0437\u043c\u0435\u043d\u0435\u043d\u0438\u044f \u0440\u0430\u0437\u043c\u0435\u0440\u0430 \u0438\u0437\u043e\u0431\u0440\u0430\u0436\u0435\u043d\u0438\u044f.", "Loading...": "\u0417\u0430\u0433\u0440\u0443\u0437\u043a\u0430...", "Could not interpret the content as image.": "\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u0440\u0430\u0441\u043f\u043e\u0437\u043d\u0430\u0442\u044c \u043a\u043e\u043d\u0442\u0435\u043d\u0442, \u043a\u0430\u043a \u0438\u0437\u043e\u0431\u0440\u0430\u0436\u0435\u043d\u0438\u0435.", "File extension not valid.": "\u0420\u0430\u0441\u0448\u0438\u0440\u0435\u043d\u0438\u0435 \u0444\u0430\u0439\u043b\u0430 \u043d\u0435 \u0434\u0435\u0439\u0441\u0442\u0432\u0438\u0442\u0435\u043b\u044c\u043d\u043e.", "File too big (max size: %s).": "\u0424\u0430\u0439\u043b \u0441\u043b\u0438\u0448\u043a\u043e\u043c \u0431\u043e\u043b\u044c\u0448\u043e\u0439 (\u043c\u0430\u043a\u0441 \u0440\u0430\u0437\u043c\u0435\u0440: %s).", "Error in reading the response from the server": "\u041e\u0448\u0438\u0431\u043a\u0430 \u043f\u0440\u0438 \u0447\u0442\u0435\u043d\u0438\u0438 \u043e\u0442\u0432\u0435\u0442\u0430 \u0441 \u0441\u0435\u0440\u0432\u0435\u0440\u0430", "Method %s does not exist on %s.": "\u041c\u0435\u0442\u043e\u0434 %s \u043d\u0435 \u0441\u0443\u0449\u0435\u0441\u0442\u0432\u0443\u0435\u0442 \u0432 %s.", "Input not defined": "\u0412\u0445\u043e\u0434 \u043d\u0435 \u043e\u043f\u0440\u0435\u0434\u0435\u043b\u0435\u043d", "Image file type cannot be resized.": "\u0422\u0438\u043f \u0444\u0430\u0439\u043b\u0430 \u0438\u0437\u043e\u0431\u0440\u0430\u0436\u0435\u043d\u0438\u044f \u043d\u0435 \u043c\u043e\u0436\u0435\u0442 \u0431\u044b\u0442\u044c \u0438\u0437\u043c\u0435\u043d\u0435\u043d.", "File is not a supported image.": "\u0424\u0430\u0439\u043b \u0438\u0437\u043e\u0431\u0440\u0430\u0436\u0435\u043d\u0438\u044f \u043d\u0435 \u043f\u043e\u0434\u0434\u0435\u0440\u0436\u0438\u0432\u0430\u0435\u0442\u0441\u044f .", "File is not recognized as valid image.": "\u0424\u0430\u0439\u043b \u043d\u0435 \u0440\u0430\u0441\u043f\u043e\u0437\u043d\u0430\u0435\u0442\u0441\u044f \u0432 \u043a\u0430\u0447\u0435\u0441\u0442\u0432\u0435 \u0438\u0437\u043e\u0431\u0440\u0430\u0436\u0435\u043d\u0438\u044f.", "File is too big.": "\u0424\u0430\u0439\u043b \u0441\u043b\u0438\u0448\u043a\u043e\u043c \u0432\u0435\u043b\u0438\u043a.", "Error during loading of the image.": "\u041e\u0448\u0438\u0431\u043a\u0430 \u0432\u043e \u0432\u0440\u0435\u043c\u044f \u0437\u0430\u0433\u0440\u0443\u0437\u043a\u0438 \u0438\u0437\u043e\u0431\u0440\u0430\u0436\u0435\u043d\u0438\u044f.", "Too many \"%s\" boxes (limit: %s).": "\u0421\u043b\u0438\u0448\u043a\u043e\u043c \u043c\u043d\u043e\u0433\u043e \"%s\" \u0431\u043b\u043e\u043a\u043e\u0432 (\u043e\u0433\u0440\u0430\u043d\u0438\u0447\u0435\u043d\u0438\u0435: %s).", "Too many total boxes (limit: %s).": "\u0421\u043b\u0438\u0448\u043a\u043e\u043c \u043c\u043d\u043e\u0433\u043e \u0431\u043b\u043e\u043a\u043e\u0432 (\u043e\u0433\u0440\u0430\u043d\u0438\u0447\u0435\u043d\u0438\u0435: %s).", "Unexpected error: could not finalize box style.": "\u041d\u0435\u043e\u0436\u0438\u0434\u0430\u043d\u043d\u0430\u044f \u043e\u0448\u0438\u0431\u043a\u0430: \u043d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u0437\u0430\u0432\u0435\u0440\u0448\u0438\u0442\u044c \u0441\u0442\u0438\u043b\u0438\u0437\u0430\u0446\u0438\u044e \u0431\u043b\u043e\u043a\u043e\u0432.", "Background": "\u0424\u043e\u043d", "Arrange": "\u0420\u0430\u0441\u043f\u043e\u043b\u043e\u0436\u0438\u0442\u044c", "Bring to front": "\u041d\u0430 \u043f\u0435\u0440\u0435\u0434\u043d\u0438\u0439 \u043f\u043b\u0430\u043d", "Send to back": "\u041d\u0430 \u0437\u0430\u0434\u043d\u0438\u0439 \u043f\u043b\u0430\u043d", "Bring forward": "\u0412\u044b\u0434\u0432\u0438\u043d\u0443\u0442\u044c \u0432\u043f\u0435\u0440\u0435\u0434", "Send backward": "\u041e\u0442\u043e\u0434\u0432\u0438\u043d\u0443\u0442\u044c \u043d\u0430\u0437\u0430\u0434", "Duplicate": "\u0414\u0443\u0431\u043b\u0438\u0440\u043e\u0432\u0430\u0442\u044c", "Flip": "\u041f\u043e\u0432\u043e\u0440\u043e\u0442", "Vertical": "\u0412\u0435\u0440\u0442\u0438\u043a\u0430\u043b\u044c\u043d\u043e", "Horizontal": "\u0413\u043e\u0440\u0438\u0437\u043e\u043d\u0442\u0430\u043b\u044c\u043d\u043e", "Select background color": "\u0412\u044b\u0431\u0435\u0440\u0438\u0442\u0435 \u0446\u0432\u0435\u0442 \u0444\u043e\u043d\u0430", "Opacity": "\u041d\u0435\u043f\u0440\u043e\u0437\u0440\u0430\u0447\u043d\u043e\u0441\u0442\u044c", "Box opacity": "\u0411\u043b\u043e\u043a \u043d\u0435\u043f\u0440\u043e\u0437\u0440\u0430\u0447\u043d\u043e\u0441\u0442\u0438", "Select box opacity": "\u0412\u044b\u0431\u0435\u0440\u0438\u0442\u0435 \u0431\u043b\u043e\u043a \u043d\u0435\u043f\u0440\u043e\u0437\u0440\u0430\u0447\u043d\u043e\u0441\u0442\u0438", "Select background opacity": "\u0412\u044b\u0431\u0435\u0440\u0438\u0442\u0435 \u0444\u043e\u043d \u043d\u0435\u043f\u0440\u043e\u0437\u0440\u0430\u0447\u043d\u043e\u0441\u0442\u0438", "Background opacity": "\u0424\u043e\u043d \u043d\u0435\u043f\u0440\u043e\u0437\u0440\u0430\u0447\u043d\u043e\u0441\u0442\u0438", "Border": "\u0420\u0430\u043c\u043a\u0430", "Select border style": "\u0412\u044b\u0431\u0440\u0430\u0442\u044c \u0441\u0442\u0438\u043b\u044c \u0440\u0430\u043c\u043a\u0438", "Select border width": "\u0412\u044b\u0431\u0440\u0430\u0442\u044c \u0442\u043e\u043b\u0449\u0438\u043d\u0443 \u0440\u0430\u043c\u043a\u0438", "Width": "\u0428\u0438\u0440\u0438\u043d\u044b", "Corners": "\u0423\u0433\u043b\u044b", "Top left corner": "\u0412\u0435\u0440\u0445\u043d\u0438\u0439 \u043b\u0435\u0432\u044b\u0439 \u0443\u0433\u043e\u043b", "Top right corner": "\u0412\u0435\u0440\u0445\u043d\u0438\u0439 \u043f\u0440\u0430\u0432\u044b\u0439 \u0443\u0433\u043e\u043b", "Bottom left corner": "\u041d\u0438\u0436\u043d\u0438\u0439 \u043b\u0435\u0432\u044b\u0439 \u0443\u0433\u043e\u043b", "Bottom right corner": "\u041d\u0438\u0436\u043d\u0438\u0439 \u043f\u0440\u0430\u0432\u044b\u0439 \u0443\u0433\u043e\u043b", "Rounded corners": "\u0417\u0430\u043a\u0440\u0443\u0433\u043b\u0435\u043d\u043d\u044b\u0435 \u0443\u0433\u043b\u044b", "Unexpected error: box has no content.": "\u041d\u0435\u043e\u0436\u0438\u0434\u0430\u043d\u043d\u0430\u044f \u043e\u0448\u0438\u0431\u043a\u0430: \u0431\u043b\u043e\u043a \u043d\u0435 \u0438\u043c\u0435\u0435\u0442 \u043a\u043e\u043d\u0442\u0435\u043d\u0442\u0430.", "Box type not supplied during registration.": "\u0422\u0438\u043f \u0431\u043b\u043e\u043a\u0430 \u043d\u0435 \u0432\u0445\u043e\u0434\u0438\u0442 \u0432 \u043a\u043e\u043c\u043f\u043b\u0435\u043a\u0442 \u043f\u043e\u0441\u0442\u0430\u0432\u043a\u0438.", "Video": "\u0412\u0438\u0434\u0435\u043e", "Click %s to insert text.": "\u041d\u0430\u0436\u043c\u0438\u0442\u0435 %s \u0434\u043b\u044f \u0432\u0441\u0442\u0430\u0432\u043a\u0438 \u0442\u0435\u043a\u0441\u0442\u0430.", "Done": "\u0421\u0434\u0435\u043b\u0430\u043d\u043e", "Done editing": "\u041f\u0440\u043e\u0438\u0437\u0432\u0435\u0434\u0435\u043d\u043e \u0440\u0435\u0434\u0430\u043a\u0442\u0438\u0440\u043e\u0432\u0430\u043d\u0438\u0435", "Font": "\u0428\u0440\u0438\u0444\u0442", "Bold": "\u0412\u044b\u0434\u0435\u043b\u0435\u043d\u043d\u044b\u0439", "Italic": "\u041d\u0430\u043a\u043b\u043e\u043d\u043d\u044b\u0439", "Underline": "\u041f\u043e\u0434\u0447\u0435\u0440\u043a\u043d\u0443\u0442\u044b\u0439", "Increase font size": "\u0423\u0432\u0435\u043b\u0438\u0447\u0438\u0442\u044c \u0440\u0430\u0437\u043c\u0435\u0440 \u0448\u0440\u0438\u0444\u0442\u0430", "Decrease font size": "\u0423\u043c\u0435\u043d\u044c\u0448\u0438\u0442\u044c \u0440\u0430\u0437\u043c\u0435\u0440 \u0448\u0440\u0438\u0444\u0442\u0430", "Text length exceeds the maximum limit.": "\u0414\u043b\u0438\u043d\u0430 \u0442\u0435\u043a\u0441\u0442\u0430 \u043f\u0440\u0435\u0432\u044b\u0448\u0430\u0435\u0442 \u043c\u0430\u043a\u0441\u0438\u043c\u0430\u043b\u044c\u043d\u044b\u0439 \u043f\u0440\u0435\u0434\u0435\u043b.", "Click %s to insert video.": "\u041d\u0430\u0436\u043c\u0438\u0442\u0435 %s \u0434\u043b\u044f \u0432\u0441\u0442\u0430\u0432\u043a\u0438 \u0432\u0438\u0434\u0435\u043e.", "Insert video": "\u0412\u0441\u0442\u0430\u0432\u043a\u0430 \u0432\u0438\u0434\u0435\u043e", "Play video": "\u0417\u0430\u043f\u0443\u0441\u043a \u0432\u0438\u0434\u0435\u043e", "Pause video": "\u041f\u0430\u0443\u0437\u0430 \u0432\u0438\u0434\u0435\u043e", "Show video": "\u041f\u043e\u043a\u0430\u0437\u0430\u0442\u044c \u0432\u0438\u0434\u0435\u043e", "Close video": "\u0417\u0430\u043a\u0440\u044b\u0442\u044c \u0432\u0438\u0434\u0435\u043e", "Please provide a valid link\/embed code for any of the supported video services.": "\u041f\u043e\u0436\u0430\u043b\u0443\u0439\u0441\u0442\u0430, \u0438\u0441\u043f\u043e\u043b\u044c\u0437\u0443\u0439\u0442\u0435 \u0440\u0430\u0431\u043e\u0447\u0443\u044e \u0441\u0441\u044b\u043b\u043a\u0443\/\u0432\u0441\u0442\u0430\u0432\u043a\u0443 \u043a\u043e\u0434\u0430 \u0438\u0437 \u043f\u043e\u0434\u0434\u0435\u0440\u0436\u0438\u0432\u0430\u0435\u043c\u044b\u0445 \u0432\u0438\u0434\u0435\u043e\u0441\u0435\u0440\u0432\u0438\u0441\u043e\u0432.", "Could not interpret the content as video.": "\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u0440\u0430\u0441\u043f\u043e\u0437\u043d\u0430\u0442\u044c \u043a\u043e\u043d\u0442\u0435\u043d\u0442, \u043a\u0430\u043a \u0432\u0438\u0434\u0435\u043e.", "Insert video embed code or url:": "\u0414\u043b\u044f \u0432\u0441\u0442\u0430\u0432\u043a\u0438 \u0432\u0438\u0434\u0435\u043e \u0434\u043e\u0431\u0430\u0432\u044c\u0442\u0435 \u043a\u043e\u0434 \u0438\u043b\u0438 url:", "Select video from the list of available videos:": "\u0412\u044b\u0431\u0435\u0440\u0438\u0442\u0435 \u0432\u0438\u0434\u0435\u043e \u0438\u0437 \u0441\u043f\u0438\u0441\u043a\u0430 \u0434\u043e\u0441\u0442\u0443\u043f\u043d\u044b\u0445 \u0432\u0438\u0434\u0435\u043e-\u0444\u0430\u0439\u043b\u043e\u0432:", "Add %s box": "\u0414\u043e\u0431\u0430\u0432\u0438\u0442\u044c %s \u0431\u043b\u043e\u043a", "Set as background": "\u0423\u0441\u0442\u0430\u043d\u043e\u0432\u0438\u0442\u044c \u043a\u0430\u043a \u0444\u043e\u043d", "Unset from background": "\u041e\u0442\u043a\u043b\u044e\u0447\u0435\u043d\u043d\u0438\u0435 \u043e\u0442 \u0444\u043e\u043d\u0430", "Error in generating unique id.": "\u041e\u0448\u0438\u0431\u043a\u0430 \u0432 \u0441\u043e\u0437\u0434\u0430\u043d\u0438\u0438 \u0443\u043d\u0438\u043a\u0430\u043b\u044c\u043d\u043e\u0433\u043e id.", "Improper internal call.": "\u041d\u0435\u043f\u0440\u0430\u0432\u0438\u043b\u044c\u043d\u044b\u0439 \u0432\u043d\u0443\u0442\u0440\u0435\u043d\u043d\u0438\u0439 \u0432\u044b\u0437\u043e\u0432.", "Please insert a value.": "\u041f\u043e\u0436\u0430\u043b\u0443\u0439\u0441\u0442\u0430, \u0432\u0441\u0442\u0430\u0432\u044c\u0442\u0435 \u0437\u043d\u0430\u0447\u0435\u043d\u0438\u0435.", "Browser does not support required feature \"%s\".": "\u0411\u0440\u0430\u0443\u0437\u0435\u0440 \u043d\u0435 \u043f\u043e\u0434\u0434\u0435\u0440\u0436\u0438\u0432\u0430\u0435\u0442 \u0444\u0443\u043d\u043a\u0446\u0438\u044e \"%s\".", "Could not initialize %s. Container not found.": "\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u0438\u043d\u0438\u0446\u0438\u0430\u043b\u0438\u0437\u0438\u0440\u043e\u0432\u0430\u0442\u044c %s. \u041a\u043e\u043d\u0442\u0435\u0439\u043d\u0435\u0440 \u043d\u0435 \u043d\u0430\u0439\u0434\u0435\u043d.", "Box type \"%s\" doesn't exist.": "\u0422\u0438\u043f \u0431\u043b\u043e\u043a\u0430 \"%s\" \u043d\u0435 \u0441\u0443\u0449\u0435\u0441\u0442\u0432\u0443\u0435\u0442.", "Error during box creation: %s.": "\u041e\u0448\u0438\u0431\u043a\u0430 \u043f\u0440\u0438 \u0441\u043e\u0437\u0434\u0430\u043d\u0438\u0438 \u0431\u043b\u043e\u043a\u0430: %s.", "Saving content.": "\u0421\u043e\u0445\u0440\u0430\u043d\u0438\u0442\u044c.", "Please wait...": "\u041e\u0436\u0438\u0434\u0430\u0439\u0442\u0435...", "Removed box. Box type \"%s\" not supported.": "\u0411\u043b\u043e\u043a \u0443\u0434\u0430\u043b\u0435\u043d. \u0422\u0438\u043f \u0431\u043b\u043e\u043a\u0430 \"%s\" \u043d\u0435 \u043f\u043e\u0434\u0434\u0435\u0440\u0436\u0438\u0432\u0430\u0435\u0442\u0441\u044f.", "This is a %s feature.": "\u042d\u0442\u043e \u0444\u0443\u043d\u043a\u0446\u0438\u044f %s.", "For information, please visit %s.": "\u0414\u043b\u044f \u043f\u043e\u043b\u0443\u0447\u0435\u043d\u0438\u044f \u0438\u043d\u0444\u043e\u0440\u043c\u0430\u0446\u0438\u0438, \u0432\u044b \u043c\u043e\u0436\u0435\u0442\u0435 \u043f\u043e\u0441\u0435\u0442\u0438\u0442\u044c %s.", "Box size and position": "\u0420\u0430\u0437\u043c\u0435\u0440 \u0431\u043b\u043e\u043a\u0430 \u0438 \u043f\u043e\u043b\u043e\u0436\u0435\u043d\u0438\u0435", "Size": "\u0420\u0430\u0437\u043c\u0435\u0440", "Box": "\u0411\u043b\u043e\u043a", "SEO and grouping tags": "SEO \u0438 \u0433\u0440\u0443\u043f\u043f\u0438\u0440\u043e\u0432\u043a\u0430 \u0442\u0435\u0433\u043e\u0432", "Additional audio services:": "\u0414\u043e\u043f\u043e\u043b\u043d\u0438\u0442\u0435\u043b\u044c\u043d\u044b\u0435 \u0430\u0443\u0434\u0438\u043e \u0441\u0435\u0440\u0432\u0438\u0441\u044b:", "Supported in %s:": "\u041f\u043e\u0434\u0434\u0435\u0440\u0436\u043a\u0430 \u043e\u0442 %s:", "Current color:": "\u0422\u0435\u043a\u0443\u0449\u0438\u0439 \u0446\u0432\u0435\u0442:", "Click on the \"%s\" button to start creating content for extra small layouts.": "\u041d\u0430\u0436\u043c\u0438\u0442\u0435 \u043d\u0430 \u043a\u043d\u043e\u043f\u043a\u0443 \"%s\" , \u0447\u0442\u043e\u0431\u044b \u043d\u0430\u0447\u0430\u0442\u044c \u0441\u043e\u0437\u0434\u0430\u0432\u0430\u0442\u044c \u043a\u043e\u043d\u0442\u0435\u043d\u0442 \u0434\u043b\u044f \u043d\u0435\u0431\u043e\u043b\u044c\u0448\u0438\u0445 \u043c\u0430\u043a\u0435\u0442\u043e\u0432.", "Start responsive design": "\u041d\u0430\u0447\u043d\u0438\u0442\u0435 \u041e\u0442\u0437\u044b\u0432\u0447\u0438\u0432\u044b\u0439 \u0434\u0438\u0437\u0430\u0439\u043d", "Snap boxes to": "\u0421\u0432\u044f\u0437\u0430\u0442\u044c \u0431\u043b\u043e\u043a\u0438", "Page": "\u0421\u0442\u0440\u0430\u043d\u0438\u0446\u0430", "Boxes": "\u0411\u043b\u043e\u043a\u0438", "Content link": "\u0421\u0441\u044b\u043b\u043a\u0430", "Content": "\u041a\u043e\u043d\u0442\u0435\u043d\u0442\u0430", "Edit": "\u0418\u0437\u043c\u0435\u043d\u0438\u0442\u044c", "Undo": "\u041e\u0442\u043c\u0435\u043d\u0430", "Redo": "\u041f\u043e\u0432\u0442\u043e\u0440", "Clear all": "\u041e\u0447\u0438\u0441\u0442\u0438\u0442\u044c \u0432\u0441\u0435", "Click to set Hex color": "\u041d\u0430\u0436\u043c\u0438\u0442\u0435, \u0447\u0442\u043e\u0431\u044b \u0443\u0441\u0442\u0430\u043d\u043e\u0432\u0438\u0442\u044c \u0446\u0432\u0435\u0442 Hex", "Click to set RGB color": "\u041d\u0430\u0436\u043c\u0438\u0442\u0435, \u0447\u0442\u043e\u0431\u044b \u0443\u0441\u0442\u0430\u043d\u043e\u0432\u0438\u0442\u044c \u0446\u0432\u0435\u0442 RGB", "Solid color": "\u0421\u043f\u043b\u043e\u0448\u043d\u043e\u0439 \u0446\u0432\u0435\u0442", "Horiz. gradient": "\u0413\u043e\u0440\u0438\u0437\u043e\u043d\u0442\u0430\u043b\u044c\u043d\u044b\u0439 \u0433\u0440\u0430\u0434\u0438\u0435\u043d\u0442", "Vert. gradient": "\u0412\u0435\u0440\u0442\u0438\u043a\u0430\u043b\u044c\u043d\u044b\u0439 \u0433\u0440\u0430\u0434\u0438\u0435\u043d\u0442", "Radial gradient": "\u0420\u0430\u0434\u0438\u0430\u043b\u044c\u043d\u044b\u0439 \u0433\u0440\u0430\u0434\u0438\u0435\u043d\u0442", "Select color opacity": "\u0412\u044b\u0431\u0435\u0440\u0438\u0442\u0435 \u0446\u0432\u0435\u0442 \u043d\u0435\u043f\u0440\u043e\u0437\u0440\u0430\u0447\u043d\u043e\u0441\u0442\u044c", "Set custom color (Hex)": "\u0423\u0441\u0442\u0430\u043d\u043e\u0432\u043a\u0430 \u043f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u0442\u0435\u043b\u044c\u0441\u043a\u043e\u0433\u043e \u0446\u0432\u0435\u0442\u0430 (Hex)", "Please enter the color in hex format, e.g. %s": "\u041f\u043e\u0436\u0430\u043b\u0443\u0439\u0441\u0442\u0430, \u0432\u0432\u0435\u0434\u0438\u0442\u0435 \u0446\u0432\u0435\u0442 \u0432 \u0448\u0435\u0441\u0442\u043d\u0430\u0434\u0446\u0430\u0442\u0435\u0440\u0438\u0447\u043d\u043e\u043c \u0444\u043e\u0440\u043c\u0430\u0442\u0435, \u043d\u0430\u043f\u0440\u0438\u043c\u0435\u0440 %s", "You must enter a color.": "\u0412\u044b \u0434\u043e\u043b\u0436\u043d\u044b \u0432\u0432\u0435\u0441\u0442\u0438 \u0446\u0432\u0435\u0442.", "Set custom color (RGB)": "\u0423\u0441\u0442\u0430\u043d\u043e\u0432\u043a\u0430 \u043f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u0442\u0435\u043b\u044c\u0441\u043a\u043e\u0433\u043e \u0446\u0432\u0435\u0442\u0430 (RGB)", "Please enter the color in RGB format, with comma-separated components, e.g. %s": "\u041f\u043e\u0436\u0430\u043b\u0443\u0439\u0441\u0442\u0430, \u0432\u0432\u0435\u0434\u0438\u0442\u0435 \u0446\u0432\u0435\u0442 \u0432 \u0444\u043e\u0440\u043c\u0430\u0442\u0435 RGB, \u0440\u0430\u0437\u0434\u0435\u043b\u044f\u044f \u0437\u0430\u043f\u044f\u0442\u044b\u043c\u0438 \u043a\u043e\u043c\u043f\u043e\u043d\u0435\u043d\u0442\u044b, \u043d\u0430\u043f\u0440\u0438\u043c\u0435\u0440 %s"
    }
);
Zedity.i18n.add('uk', {
        "%s needs %s.": "%s \u043f\u0440\u0438 \u043d\u0435\u043e\u0431\u0445\u0456\u0434\u043d\u043e\u0441\u0442\u0456 %s.", "Click %s to insert a document.": "\u041d\u0430\u0442\u0438\u0441\u043d\u0456\u0442\u044c %s, \u0449\u043e\u0431 \u0432\u0441\u0442\u0430\u0432\u0438\u0442\u0438 \u0434\u043e \u0434\u043e\u043a\u0443\u043c\u0435\u043d\u0442\u0443.", "Document": "\u0414\u043e\u043a\u0443\u043c\u0435\u043d\u0442", "Insert": "\u0412\u0441\u0442\u0430\u0432\u043a\u0430", "Insert document": "\u0412\u0441\u0442\u0430\u0432\u043a\u0430 \u0434\u043e\u043a\u0443\u043c\u0435\u043d\u0442\u0443", "Read": "\u0427\u0438\u0442\u0430\u043d\u043d\u044f", "Read document": "\u0427\u0438\u0442\u0430\u043d\u043d\u044f \u0434\u043e\u043a\u0443\u043c\u0435\u043d\u0442\u0443", "Close": "\u0417\u0430\u0447\u0438\u043d\u0438\u0442\u0438", "Close document": "\u0417\u0430\u0447\u0438\u043d\u0438\u0442\u0438 \u0434\u043e\u043a\u0443\u043c\u0435\u043d\u0442", "Please provide a valid link\/embed code for any of the supported document embed services or a direct link to a document.": "\u0411\u0443\u0434\u044c \u043b\u0430\u0441\u043a\u0430, \u0432\u0441\u0442\u0430\u043d\u043e\u0432\u0438\u0442\u044c \u043f\u043e\u0441\u0438\u043b\u0430\u043d\u043d\u044f\/\u043a\u043e\u0434 \u043d\u0430 \u0431\u0443\u0434\u044c-\u044f\u043a\u0438\u0439 \u0434\u043e\u043a\u0443\u043c\u0435\u043d\u0442, \u044f\u043a\u0456\u0439 \u043f\u0456\u0434\u0442\u0440\u0438\u043c\u0443\u0454\u0442\u044c\u0441\u044f \u0430\u0431\u043e \u043f\u0440\u044f\u043c\u0435 \u043f\u043e\u0441\u0438\u043b\u044f\u043d\u043d\u044f \u0434\u043e \u0434\u043e\u043a\u0443\u043c\u0435\u043d\u0442\u0443.", "Could not interpret the content as document.": "\u041d\u0435 \u0432\u0434\u0430\u043b\u043e\u0441\u044f \u0440\u043e\u0437\u043f\u0456\u0437\u043d\u0430\u0442\u0438 \u043a\u043e\u043d\u0442\u0435\u043d\u0442 \u044f\u043a \u0434\u043e\u043a\u0443\u043c\u0435\u043d\u0442.", "%s can't be rotated.": "%s \u043d\u0435\u043c\u0430\u0454 \u043c\u043e\u0436\u043b\u0438\u0432\u043e\u0441\u0442\u0456 \u0440\u043e\u0437\u0433\u043e\u0440\u043d\u0443\u0442\u0438.", "%s doesn't support background property.": "%s \u043d\u0435\u043c\u0430\u0454 \u043f\u0456\u0434\u0442\u0440\u0438\u043c\u043a\u0438 \u0432\u043b\u0430\u0441\u0442\u0438\u0432\u043e\u0441\u0442\u0456 \u0444\u043e\u043d\u0443.", "%s doesn't support rounded corners.": "%s \u043d\u0435\u043c\u0430\u0454 \u043f\u0456\u0434\u0442\u0440\u0438\u043c\u043a\u0438 \u0437\u0430\u043a\u0440\u0443\u0433\u043b\u0435\u043d\u0438\u0445 \u043a\u0443\u0442\u0456\u0432.", "%s doesn't support flipping.": "%s \u043d\u0435\u043c\u0430\u0454 \u043f\u0456\u0434\u0442\u0440\u0438\u043c\u043a\u0438 \u043f\u0435\u0440\u0435\u0432\u043e\u0440\u043e\u0442\u0443.", "Embed": "\u0412\u0441\u0442\u0430\u0432\u043a\u0430", "Insert document embed code or url:": "\u0412\u0441\u0442\u0430\u043d\u043e\u0432\u0438\u0442\u044c \u0443 \u0434\u043e\u043a\u0443\u043c\u0435\u043d\u0442 \u043a\u043e\u0434 \u0430\u0431\u043e url:", "Supported services:": "\u0421\u043b\u0443\u0436\u0431\u0430 \u043f\u0456\u0434\u0442\u0440\u0438\u043c\u043a\u0438:", "Supported documents:": "\u0414\u043e\u043a\u0443\u043c\u0435\u043d\u0442\u0438, \u044f\u043a\u0456 \u043f\u0456\u0434\u0442\u0440\u0438\u043c\u0443\u044e\u0442\u044c\u0441\u044f:", "PDF documents, Microsoft Office documents, Apple Pages, Adobe Photoshop and Illustrator, and more.": "PDF-\u0444\u0430\u0439\u043b\u0438, \u0444\u0430\u0439\u043b\u0438 Microsoft Office, Apple-\u0444\u0430\u0439\u043b\u0438, Adobe Photoshop \u0442\u0430 Illustrator, \u0442\u0430 \u0456\u043d\u0448\u0456.", "OK": "\u041e\u041a", "Cancel": "\u0412\u0456\u0434\u043c\u0456\u043d\u0438\u0442\u0438", "Click %s to insert HTML.": "\u041d\u0430\u0442\u0438\u0441\u043d\u0456\u0442\u044c %s, \u0449\u043e\u0431 \u0434\u043e\u0434\u0430\u0442\u0438 HTML-\u043a\u043e\u0434.", "Html": "Html", "Insert HTML": "\u0412\u0441\u0442\u0430\u0432\u043a\u0430 HTML-\u043a\u043e\u0434\u0443", "View": "\u0412\u0438\u0434", "View box content": "\u0412\u0456\u0434\u043e\u0431\u0440\u0430\u0436\u0435\u043d\u043d\u044f \u0431\u043b\u043e\u043a\u0443 \u043a\u043e\u043d\u0442\u0435\u043d\u0442\u0430", "Insert HTML code:": "\u0412\u0441\u0442\u0430\u0432\u043a\u0430 \u043a\u043e\u0434\u0443 HTML:", "Safe mode:": "\u0411\u0435\u0437\u043f\u0435\u0447\u043d\u0438\u0439 \u0440\u0435\u0436\u0438\u043c:", "Automatic": "\u0410\u0432\u0442\u043e\u043c\u0430\u0442\u0438\u0447\u043d\u043e", "Enabled": "\u0423\u0432\u0456\u043c\u043a\u043d\u0435\u043d\u043e", "Disabled": "\u0412\u0438\u043c\u043a\u043d\u0435\u043d\u043e", "If you insert Javascript or CSS code and you get unexpected effects (e.g. content overflow, etc.) you need to enable safe mode.": "\u042f\u043a\u0449\u043e \u043f\u0440\u0438 \u0432\u0441\u0442\u0430\u0432\u0446\u0456 Javascript \u0430\u0431\u043e CSS \u043a\u043e\u0434\u0443 \u0432\u0438 \u043e\u0442\u0440\u0438\u043c\u0430\u0454\u0442\u0435 \u043d\u0435\u0441\u043f\u043e\u0434\u0456\u0432\u0430\u043d\u0456 \u0435\u0444\u0435\u043a\u0442\u0438 (\u043d\u0430\u043f\u0440\u0438\u043a\u043b\u0430\u0434, \u043f\u0435\u0440\u0435\u043f\u043e\u0432\u043d\u0435\u043d\u043d\u044f \u043a\u043e\u043d\u0442\u0435\u043d\u0442\u0443 \u0456 \u0442.\u0434.), \u0432\u0430\u043c \u043d\u0435\u043e\u0431\u0445\u0456\u0434\u043d\u043e \u0443\u0432\u0456\u043c\u043a\u043d\u0443\u0442\u0438 \u0431\u0435\u0437\u043f\u0435\u0447\u043d\u0438\u0439 \u0440\u0435\u0436\u0438\u043c.", "The (default) automatic setting enables safe mode only if Javascript is detected.": "(\u0417\u0430 \u0437\u0430\u043c\u043e\u0432\u0447\u0443\u0432\u0430\u043d\u043d\u044f\u043c) \u0430\u0432\u0442\u043e\u043c\u0430\u0442\u0438\u0447\u043d\u0430 \u043d\u0430\u0441\u0442\u0440\u043e\u0439\u043a\u0430 \u0443\u0432\u0456\u043c\u043a\u043d\u0435\u0442\u044c\u0441\u044f \u0432 \u0431\u0435\u0437\u043f\u0435\u0447\u043d\u043e\u043c\u0443 \u0440\u0435\u0436\u0438\u043c\u0456, \u0442\u0456\u043b\u044c\u043a\u0438 \u044f\u043a\u0449\u043e \u0432\u0438\u044f\u0432\u043b\u0435\u043d\u0438\u0439 Javascript.", "Some scripts (for example social network services) need to access the page, so the \"Safe mode\" must be disabled in these cases.": "\u0414\u0435\u044f\u043a\u0456 \u0441\u0446\u0435\u043d\u0430\u0440\u0456\u0457 (\u043d\u0430\u043f\u0440\u0438\u043a\u043b\u0430\u0434, \u0441\u043e\u0446\u0456\u0430\u043b\u044c\u043d\u0456 \u043c\u0435\u0440\u0435\u0436\u0456) \u043f\u043e\u0442\u0440\u0435\u0431\u0443\u044e\u0442\u044c \u0434\u043e\u0441\u0442\u0443\u043f\u0443 \u0434\u043e \u0441\u0442\u043e\u0440\u0456\u043d\u043a\u0438, \u0432 \u0446\u044c\u043e\u043c\u0443 \u0432\u0438\u043f\u0430\u0434\u043a\u0443 \"\u0411\u0435\u0437\u043f\u0435\u0447\u043d\u0438\u0439 \u0440\u0435\u0436\u0438\u043c\" \u043f\u043e\u0432\u0438\u043d\u0435\u043d \u0431\u0443\u0442\u0438 \u0432\u0438\u043c\u043a\u043d\u0435\u043d\u0438\u043c.", "Inserting a %s content into an HTML box is not supported at the moment.": "\u0412\u0441\u0442\u0430\u0432\u043a\u0430 %s \u0434\u043e \u0432\u0456\u043a\u043d\u0430 \u0437 HTML-\u043a\u043e\u0434\u043e\u043c \u0437\u0430\u0440\u0430\u0437 \u043d\u0435 \u043f\u0456\u0434\u0442\u0440\u0438\u043c\u0443\u0454\u0442\u044c\u0441\u044f.", "Filters": "\u0424\u0456\u043b\u044c\u0442\u0440\u0438", "Apply image filters": "\u0417\u0430\u0441\u0442\u043e\u0441\u0443\u0432\u0430\u0442\u0438 \u0444\u0456\u043b\u044c\u0442\u0440\u0438 \u0434\u043e \u0437\u043e\u0431\u0440\u0430\u0436\u0435\u043d\u043d\u044f", "Adjust colors": "\u041d\u0430\u043b\u0430\u0448\u0442\u0443\u0432\u0430\u043d\u043d\u044f \u043a\u043e\u043b\u044c\u043e\u0440\u0443", "Black &amp; white": "\u0427\u043e\u0440\u043d\u043e-\u0431\u0456\u043b\u0438\u0439", "Blur": "\u0417\u0430\u0442\u0435\u043c\u043d\u0438\u0442\u0438", "Brightness": "\u042f\u0441\u043a\u0440\u0430\u0432\u0456\u0441\u0442\u044c", "Contrast": "\u041a\u043e\u043d\u0442\u0440\u0430\u0441\u0442", "Emboss": "\u0422\u0438\u0441\u043d\u0435\u043d\u043d\u044f", "Grayscale": "\u0413\u0440\u0430\u0434\u0430\u0446\u0456\u044f \u0441\u0456\u0440\u043e\u0433\u043e", "Invert": "\u0406\u043d\u0432\u0435\u0440\u0442\u0443\u0432\u0430\u0442\u0438", "Mosaic": "\u041f\u0456\u043a\u0441\u0435\u043b\u0456\u0437\u0430\u0446\u0456\u044f", "Motion blur": "\u0417\u0433\u043b\u0430\u0434\u0436\u0443\u0432\u0430\u043d\u043d\u044f", "Noise": "\u0428\u0443\u043c\u043e\u0432\u0438\u0439 \u0435\u0444\u0435\u043a\u0442", "Paint": "\u0424\u0430\u0440\u0431\u0443\u0432\u0430\u043d\u043d\u044f", "Posterize": "\u041f\u043e\u0441\u0442\u0435\u0440\u0456\u0437\u0430\u0446\u0456\u044f", "Psychedelia": "\u041f\u0441\u0438\u0445\u043e\u0434\u0435\u043b\u0456\u044f", "Sepia": "\u0421\u0435\u043f\u0456\u044f", "Sharpen": "\u041f\u043e\u0441\u0438\u043b\u0438\u0442\u0438", "Vignette": "\u0412\u0456\u043d\u044c\u0454\u0442\u043a\u0430", "Apply filter": "\u0417\u0430\u0441\u0442\u043e\u0441\u0443\u0432\u0430\u0442\u0438 \u0444\u0456\u043b\u044c\u0442\u0440", "Reset filter": "\u0421\u043a\u0438\u043d\u0443\u0442\u0438 \u0444\u0456\u043b\u044c\u0442\u0440", "Remove all filters": "\u0412\u0456\u0434\u043c\u0456\u043d\u0438\u0442\u0438 \u0443\u0441\u0456 \u0444\u0456\u043b\u044c\u0442\u0440\u0438", "Error applying filter \"%s\".": "\u041f\u043e\u043c\u0438\u043b\u043a\u0430 \u0437\u0430\u0441\u0442\u043e\u0441\u0443\u0432\u0430\u043d\u043d\u044f \u0444\u0456\u043b\u044c\u0442\u0440\u0443 \"%s\".", "Filter \"%s\" not defined.": "\u0424\u0456\u043b\u044c\u0442\u0440 \"%s\" \u043d\u0435 \u0432\u0438\u0437\u043d\u0430\u0447\u0435\u043d\u0438\u0439.", "Could not read image data. Filters cannot be applied on images hosted on a different domain.": "\u041d\u0435 \u0432\u0434\u0430\u043b\u043e\u0441\u044f \u0441\u0447\u0438\u0442\u0430\u0442\u0438 \u0434\u0430\u043d\u043d\u0456 \u0437\u043e\u0431\u0440\u0430\u0436\u0435\u043d\u043d\u044f. \u0424\u0456\u043b\u044c\u0442\u0440\u0438 \u043d\u0435 \u043c\u043e\u0436\u0443\u0442\u044c \u0437\u0430\u0441\u0442\u043e\u0441\u0443\u0432\u0430\u0442\u0438\u0441\u044f \u0434\u043e \u0437\u043e\u0431\u0440\u0430\u0436\u0435\u043d\u043d\u044f, \u044f\u043a\u0449\u043e \u0432\u0456\u043d \u0440\u043e\u0437\u0441\u0442\u0430\u0448\u043e\u0432\u0430\u043d \u043d\u0430 \u0456\u043d\u0448\u043e\u043c\u0443 \u0434\u043e\u043c\u0435\u043d\u0456.", "Percent": "\u0412\u0456\u0434\u0441\u043e\u0442\u043e\u043a", "Adjustment": "\u041f\u0456\u0434\u0433\u043e\u043d\u043a\u0430", "Threshold": "\u041c\u0435\u0436\u0430", "Red": "\u0427\u0435\u0440\u0432\u043e\u043d\u0438\u0439", "Green": "\u0417\u0435\u043b\u0435\u043d\u0438\u0439", "Blue": "\u0411\u043b\u0430\u043a\u0438\u0442\u043d\u0438\u0439", "Amount": "\u041a\u0456\u043b\u044c\u043a\u0456\u0441\u0442\u044c", "Block size": "\u0420\u043e\u0437\u043c\u0456\u0440 \u0431\u043b\u043e\u043a\u0443", "Type": "\u0422\u0438\u043f", "Strength": "\u041c\u0456\u0446\u043d\u0456\u0441\u0442\u044c", "Brush size": "\u0420\u043e\u0437\u043c\u0456\u0440 \u043f\u0435\u043d\u0437\u043b\u044f", "Link": "\u041f\u043e\u0441\u0438\u043b\u0430\u043d\u043d\u044f", "Add link to box": "\u0414\u043e\u0434\u0430\u0442\u0438 \u043f\u043e\u0441\u0438\u043b\u0430\u043d\u043d\u044f \u0434\u043e \u0431\u043b\u043e\u043a\u0443", "This link will be associated to the whole box.": "\u0426\u0435 \u043f\u043e\u0441\u0438\u043b\u0430\u043d\u043d\u044f \u0431\u0443\u0434\u0435 \u043f\u043e\u0432'\u044f\u0437\u0430\u043d\u0435 \u0437 \u0431\u043b\u043e\u043a\u043e\u043c.", "Insert link url:": "\u0412\u0432\u0435\u0434\u0456\u0442\u044c \u043f\u043e\u0441\u0438\u043b\u0430\u043d\u043d\u044f url:", "Align": "\u0420\u043e\u0437\u0442\u0430\u0448\u0443\u0432\u0430\u043d\u043d\u044f", "Align to page": "\u0412\u0438\u0440\u0456\u0432\u043d\u044e\u0432\u0430\u043d\u043d\u044f \u0432\u0456\u0434\u043d\u043e\u0441\u043d\u043e \u0441\u0442\u043e\u0440\u0456\u043d\u043a\u0438", "Left": "\u041b\u0456\u0432\u043e\u0440\u0443\u0447", "Center": "\u0423 \u0446\u0435\u043d\u0442\u0440\u0456", "Right": "\u041f\u0440\u0430\u0432\u043e\u0440\u0443\u0447", "Top": "\u0417\u0432\u0435\u0440\u0445\u0443", "Middle": "\u041f\u043e\u0441\u0435\u0440\u0435\u0434\u0438\u043d\u0456", "Bottom": "\u0417\u043d\u0438\u0437\u0443", "Fit width": "\u0428\u0438\u0440\u0438\u043d\u0430", "Fit height": "\u0412\u0438\u0441\u043e\u0442\u0430", "(min: %s, max: %s)": "(\u043c\u0456\u043d: %s, \u043c\u0430\u043a\u0441: %s)", "Keep aspect ratio": "\u0417\u0431\u0435\u0440\u0435\u0433\u0442\u0438 \u043f\u0440\u043e\u043f\u043e\u0440\u0446\u0456\u044e", "Select box padding": "\u0412\u0438\u0431\u0440\u0430\u0442\u0438 \u0432\u043d\u0443\u0442\u0440\u0456\u0448\u043d\u0456\u0439 \u0432\u0456\u0434\u0441\u0442\u0443\u043f \u0431\u043b\u043e\u043a\u0443", "Padding": "\u0412\u043d\u0443\u0442\u0440\u0456\u0448\u043d\u0456 \u0432\u0456\u0434\u0441\u0442\u0443\u043f\u0438", "Shadow": "\u0417\u0430\u0441\u0442\u043e\u0441\u0443\u0432\u0430\u043d\u043d\u044f \u0442\u0456\u043d\u0456", "Color": "\u041a\u043e\u043b\u0456\u0440", "Text": "\u0422\u0435\u043a\u0441\u0442", "Paragraph": "\u041f\u0430\u0440\u0430\u0433\u0440\u0430\u0444", "Heading": "\u0422\u0435\u043c\u0430", "Align left": "\u041b\u0456\u0432\u043e\u0440\u0443\u0447", "Align center": "\u0423 \u0446\u0435\u043d\u0442\u0440\u0456", "Align right": "\u041f\u0440\u0430\u0432\u043e\u0440\u0443\u0447", "Justify": "\u0412\u0438\u0440\u0456\u0432\u043d\u044e\u0432\u0430\u043d\u043d\u044f \u0437\u043b\u0456\u0432\u0430 \u043d\u0430 \u0441\u043f\u0440\u0430\u0432\u0430", "Ordered list": "\u041d\u0443\u043c\u0435\u0440\u043e\u0432\u0430\u043d\u0438\u0439 \u0441\u043f\u0438\u0441\u043e\u043a", "Unordered list": "\u041c\u0430\u0440\u043a\u043e\u0432\u0430\u043d\u0438\u0439 \u0441\u043f\u0438\u0441\u043e\u043a", "Indent": "\u0412\u0456\u0434\u0441\u0442\u0443\u043f", "Outdent": "\u0412\u0438\u0441\u0442\u0443\u043f", "Open link in the same tab.": "\u0412\u0456\u0434\u043a\u0440\u0438\u0442\u0438 \u043f\u043e\u0441\u0438\u043b\u0430\u043d\u043d\u044f \u0432 \u0442\u043e\u0439 \u0441\u0430\u043c\u0456\u0439 \u0432\u043a\u043b\u0430\u0434\u0446\u0456.", "Open link in a new tab.": "\u0412\u0456\u0434\u043a\u0440\u0438\u0442\u0438 \u043f\u043e\u0441\u0438\u043b\u0430\u043d\u043d\u044f \u0443 \u043d\u043e\u0432\u0456\u0439 \u0432\u043a\u043b\u0430\u0434\u0446\u0456.", "Link style preview": "\u0421\u0442\u0438\u043b\u044c \u043f\u043e\u0441\u0438\u043b\u0430\u043d\u043d\u044f \u043f\u043e\u043f\u0435\u0440\u0435\u0434\u043d\u044c\u043e\u0433\u043e \u043f\u0435\u0440\u0435\u0433\u043b\u044f\u0434\u0443", "Link style": "\u0421\u0442\u0438\u043b\u044c \u043f\u043e\u0441\u0438\u043b\u0430\u043d\u043d\u044f", "Link style on mouse over": "\u0421\u0442\u0438\u043b\u044c \u043f\u043e\u0441\u0438\u043b\u0430\u043d\u043d\u044f \u043f\u0440\u0438 \u043d\u0430\u0432\u0435\u0434\u0435\u043d\u043d\u044f \u043a\u0443\u0440\u0441\u043e\u0440\u0443", "Insert link": "\u0414\u043e\u0434\u0430\u0442\u0438 \u043f\u043e\u0441\u0438\u043b\u0430\u043d\u043d\u044f", "Remove": "\u0412\u0438\u0434\u0430\u043b\u0438\u0442\u0438", "The box link may override any link in the text.": "\u041f\u043e\u0441\u0438\u043b\u0430\u043d\u043d\u044f \u0432 \u0431\u043b\u043e\u0446\u0456 \u043c\u043e\u0436\u0435 \u043f\u0435\u0440\u0435\u0432\u0438\u0437\u043d\u0430\u0447\u0438\u0442\u0438 \u0431\u0443\u0434\u044c-\u044f\u043a\u0435 \u043f\u043e\u0441\u0438\u043b\u0430\u043d\u043d\u044f \u0443 \u0442\u0435\u043a\u0441\u0442\u0456.", "Align top": "\u0417\u0432\u0435\u0440\u0445\u0443", "Align middle": "\u041f\u043e\u0441\u0435\u0440\u0435\u0434\u0438\u043d\u0456", "Align bottom": "\u0417\u043d\u0438\u0437\u0443", "Extra small layout": "\u041c\u0430\u043b\u0435\u043d\u044c\u043a\u0438\u0439 \u043c\u0430\u043a\u0435\u0442", "Small layout": "\u041d\u0435\u0432\u0435\u043b\u0438\u043a\u0438\u0439 \u043c\u0430\u043a\u0435\u0442", "Medium layout": "\u0421\u0435\u0440\u0435\u0434\u043d\u044c\u043e\u0433\u043e \u0440\u043e\u0437\u043c\u0456\u0440\u0443 \u043c\u0430\u043a\u0435\u0442", "Large layout": "\u0412\u0435\u043b\u0438\u043a\u0438\u0439 \u043c\u0430\u043a\u0435\u0442", "If you perform this action you will revert to a non-responsive design. Are you sure?": "\u042f\u043a\u0449\u043e \u043f\u0440\u043e\u0432\u0435\u0441\u0442\u0438 \u0446\u0456 \u0434\u0456\u0457, \u0432\u0438 \u043f\u043e\u0432\u0435\u0440\u043d\u0435\u0442\u0435\u0441\u044c \u0434\u043e \u043d\u0430\u043b\u0430\u0448\u0442\u0443\u0432\u0430\u043d\u043d\u044f, \u044f\u043a\u0435 \u043d\u0435 \u0441\u043f\u0456\u0432\u043f\u0430\u0434\u0430\u0454 \u0437 \u0432\u0430\u0448\u0438\u043c \u0434\u0438\u0437\u0430\u0439\u043d\u043e\u043c. \u0412\u0438 \u0432\u043f\u0435\u0432\u043d\u0435\u043d\u0456?", "Custom layouts:": "\u041d\u0430\u043b\u0430\u0448\u0442\u0443\u0432\u0430\u043d\u043d\u044f \u043c\u0430\u043a\u0435\u0442\u0456\u0432:", "Add custom layout": "\u0414\u043e\u0434\u0430\u0442\u0438 \u043c\u0430\u043a\u0435\u0442 \u043a\u043e\u0440\u0438\u0441\u0442\u0443\u0432\u0430\u0447\u0430", "Multiple layout responsive design": "\u0414\u0435\u043a\u0456\u043b\u044c\u043a\u0430 \u043c\u0430\u043a\u0435\u0442\u0456\u0432 \u0437 \u0447\u0443\u0439\u043d\u0438\u043c \u0434\u0438\u0437\u0430\u0439\u043d\u043e\u043c", "The width of custom layouts can be adjusted to fit larger designs.": "\u0428\u0438\u0440\u0438\u043d\u0443 \u043c\u0430\u043a\u0435\u0442\u0430 \u043a\u043e\u0440\u0438\u0441\u0442\u0443\u0432\u0430\u0447\u0430 \u0454 \u043c\u043e\u0436\u043b\u0438\u0432\u0456\u0441\u0442\u044c \u043f\u0456\u0434\u0456\u0433\u043d\u0430\u0442\u0438 \u043f\u0456\u0434 \u0432\u0435\u043b\u0438\u043a\u0438 \u043f\u0440\u043e\u0435\u043a\u0442\u0438.", "Save": "\u0417\u0431\u0435\u0440\u0435\u0433\u0442\u0438", "Abort": "\u0412\u0438\u0434\u0430\u043b\u0430\u0442\u0438", "You may want to review the design for layouts in yellow.": "\u0412\u0438 \u043c\u0430\u0454\u0442\u0435 \u043c\u043e\u0436\u043b\u0438\u0432\u0456\u0441\u0442\u044c \u043f\u0435\u0440\u0435\u0433\u043b\u044f\u0434\u0443 \u043c\u0430\u043a\u0435\u0442\u0456\u0432 \u0443 \u0436\u043e\u0432\u0442\u043e\u043c\u0443 \u043a\u043e\u043b\u044c\u043e\u0440\u0456.", "Save without reviewing": "\u0417\u0431\u0435\u0440\u0435\u0433\u0442\u0438 \u0431\u0435\u0437 \u043f\u0435\u0440\u0435\u0433\u043b\u044f\u0434\u0443", "Please click on the layouts in gray to provide the design for all layouts.": "\u0411\u0443\u0434\u044c \u043b\u0430\u0441\u043a\u0430, \u043d\u0430\u0442\u0438\u0441\u043d\u0438\u0442\u044c \u043d\u0430 \u0441\u0456\u0440\u0456 \u043c\u0430\u043a\u0435\u0442\u0438, \u0449\u043e\u0431 \u043f\u0435\u0440\u0435\u0434\u0438\u0432\u0438\u0442\u0438\u0441\u044f \u0434\u0438\u0437\u0430\u0439\u043d \u0443\u0441\u0456\u0445 \u043c\u0430\u043a\u0435\u0442\u0456\u0432.", "Save anyway (not recommended)": "\u0417\u0431\u0435\u0440\u0435\u0433\u0430\u0442\u0438 \u0437\u0430\u0432\u0436\u0434\u0438 (\u043d\u0435 \u0440\u0435\u043a\u043e\u043c\u0435\u043d\u0434\u043e\u0432\u0430\u043d\u043e)", "Your responsive content is ready to be saved!": "\u0412\u0430\u0448 \u043a\u043e\u043d\u0442\u0435\u043d\u0442 \u0433\u043e\u0442\u043e\u0432\u0438\u0439 \u0434\u043e \u0437\u0431\u0435\u0440\u0435\u0436\u0435\u043d\u043d\u044f!", "Edit box": "\u0420\u0435\u0434\u0430\u0433\u0443\u0432\u0430\u0442\u0438 \u0431\u043b\u043e\u043a", "Show": "\u041f\u043e\u043a\u0430\u0437\u0430\u0442\u0438", "This link will be associated to the whole %s content.": "\u0426\u0435 \u043f\u043e\u0441\u0438\u043b\u0430\u043d\u043d\u044f \u043f\u043e\u0432'\u044f\u0437\u0430\u043d\u0435  \u0437 \u0443\u0441\u0456\u043c \u043a\u043e\u043d\u0442\u0435\u043d\u0442\u043e\u043c %s.", "Width:": "\u0428\u0438\u0440\u0438\u043d\u0430:", "Height:": "\u0412\u0438\u0441\u043e\u0442\u0430:", "Delete": "\u0412\u0438\u0434\u0430\u043b\u0438\u0442\u0438", "Click %s to insert audio.": "\u041d\u0430\u0442\u0438\u0441\u043d\u0438\u0442\u044c  %s, \u0449\u043e\u0431 \u0434\u043e\u0434\u0430\u0442\u0438 \u0430\u0443\u0434\u0456\u043e.", "Audio": "\u0410\u0443\u0434\u0456\u043e", "Insert audio": "\u0414\u043e\u0434\u0430\u0442\u0438 \u0430\u0443\u0434\u0456\u043e", "Play": "\u041f\u0443\u0441\u043a", "Play audio": "\u0417\u0430\u043f\u0443\u0441\u043a \u0430\u0443\u0434\u0456\u043e", "Pause": "\u041f\u0430\u0443\u0437\u0430", "Pause audio": "\u041f\u0430\u0443\u0437\u0430 \u0430\u0443\u0434\u0456\u043e", "Show audio": "\u041f\u043e\u043a\u0430\u0437\u0430\u0442\u0438 \u0430\u0443\u0434\u0456\u043e", "Close audio": "\u0417\u0430\u0447\u0438\u043d\u0438\u0442\u0438 \u0430\u0443\u0434\u0456\u043e", "Please provide a valid link\/embed code for any of the supported audio services.": "\u0411\u0443\u0434\u044c \u043b\u0430\u0441\u043a\u0430, \u0432\u0432\u0435\u0434\u0456\u0442\u044c \u043f\u043e\u0441\u0438\u043b\u0430\u043d\u043d\u044f\/\u043a\u043e\u0434 \u0437 \u0431\u0443\u0434\u044c-\u044f\u043a\u043e\u0433\u043e \u0430\u0443\u0434\u0456\u043e-\u0441\u0435\u0440\u0432\u0456\u0441\u0443, \u044f\u043a\u0438\u0439 \u043f\u0456\u0434\u0442\u0440\u0438\u043c\u0443\u0454\u0442\u044c\u0441\u044f. ", "Could not interpret the content as audio.": "\u041d\u0435 \u0432\u0434\u0430\u043b\u043e\u0441\u044f \u0432\u0456\u0434\u0442\u0432\u043e\u0440\u0438\u0442\u0438 \u043a\u043e\u043d\u0442\u0435\u043d\u0442, \u044f\u043a \u0430\u0443\u0434\u0456\u043e.", "%s can't be set as background.": "%s \u043d\u0435 \u043c\u043e\u0436\u0435 \u0431\u0443\u0442\u0438 \u0444\u043e\u043d\u043e\u043c.", "Files": "\u0424\u0430\u0439\u043b\u0438", "Insert audio embed code or url:": "\u0429\u043e\u0431 \u0434\u043e\u0434\u0430\u0442\u0438 \u0430\u0443\u0434\u0456\u043e, \u0432\u0441\u0442\u0430\u043d\u043e\u0432\u0438\u0442\u044c \u043a\u043e\u0434 \u0430\u0431\u043e url:", "Select audio from the list of available audios:": "\u0412\u0438\u0431\u0435\u0440\u0438\u0442\u044c \u0430\u0443\u0434\u0456\u043e \u0437\u0456 \u0441\u043f\u0438\u0441\u043a\u0443 \u0430\u0443\u0434\u0456\u043e-\u0444\u0430\u0439\u043b\u0456\u0432:", "Click %s to add color.": "\u041d\u0430\u0442\u0438\u0441\u043d\u0456\u0442\u044c %s, \u0449\u043e\u0431 \u0434\u043e\u0434\u0430\u0442\u0438 \u043a\u043e\u043b\u0456\u0440.", "Click %s to insert image.": "\u041d\u0430\u0442\u0438\u0441\u043d\u0438\u0442\u044c %s, \u0449\u043e\u0431 \u0434\u043e\u0434\u0430\u0442\u0438 \u0437\u043e\u0431\u0440\u0430\u0436\u0435\u043d\u043d\u044f.", "Image": "\u0417\u043e\u0431\u0440\u0430\u0436\u0435\u043d\u043d\u044f", "Insert image": "\u0414\u043e\u0434\u0430\u0442\u0438 \u0437\u043e\u0431\u0440\u0430\u0436\u0435\u043d\u043d\u044f", "Center &amp; fill": "\u0426\u0435\u043d\u0442\u0440 &amp; \u0437\u0430\u043f\u043e\u0432\u043d\u0438\u0442\u0438", "Fit": "\u041f\u0456\u0434\u0456\u0433\u043d\u0430\u0442\u0438", "Stretch": "\u0420\u0430\u0441\u0442\u044f\u043d\u0443\u0442\u0438", "Image options": "\u041d\u0430\u043b\u0430\u0448\u0442\u0443\u0432\u0430\u043d\u043d\u044f \u0437\u043e\u0431\u0440\u0430\u0436\u0435\u043d\u043d\u044f", "Image quality": "\u042f\u043a\u0456\u0441\u0442\u044c \u0437\u043e\u0431\u0440\u0430\u0436\u0435\u043d\u043d\u044f", "Original": "\u041d\u0430\u0442\u0443\u0440\u0430\u043b\u044c\u043d\u0430", "High": "\u0412\u0438\u0441\u043e\u043a\u0430", "Normal": "\u041d\u043e\u0440\u043c\u0430\u043b\u044c\u043d\u0430", "Low": "\u041d\u0438\u0437\u044c\u043a\u0430", "Proportional resize": "\u041f\u0440\u043e\u043f\u043e\u0440\u0446\u0456\u0439\u043d\u0430 \u0437\u043c\u0456\u043d\u0430 \u0440\u043e\u0437\u043c\u0456\u0440\u0443", "Set box to image original size": "\u0412\u0441\u0442\u0430\u043d\u043e\u0432\u0438\u0442\u0438 \u0437\u043e\u0431\u0440\u0430\u0436\u0435\u043d\u043d\u044f \u0437\u0430 \u0440\u043e\u0437\u043c\u0456\u0440\u0430\u043c\u0438 \u043e\u0440\u0456\u0433\u0456\u043d\u0430\u043b\u0443", "Disk": "\u0414\u0438\u0441\u043a", "Supported image file types:": "\u041f\u0456\u0434\u0442\u0440\u0438\u043c\u043a\u0430 \u0442\u0438\u043f\u0456\u0432 \u0437\u043e\u0431\u0440\u0430\u0436\u0435\u043d\u043d\u044f:", "Select image file from disk (max size %s):": "\u0412\u0437\u044f\u0442\u0438 \u0444\u0430\u0439\u043b \u0437\u043e\u0431\u0440\u0430\u0436\u0435\u043d\u043d\u044f \u0437 \u0434\u0438\u0441\u043a\u0443 (\u043c\u0430\u043a\u0441 \u0440\u043e\u0437\u043c\u0456\u0440 %s):", "Browse...": "\u041f\u043e\u0448\u0443\u043a...", "Image quality:": "\u042f\u043a\u0456\u0441\u0442\u044c \u0437\u043e\u0431\u0440\u0430\u0436\u0435\u043d\u043d\u044f:", "Insert image URL link:": "\u0414\u043e\u0434\u0430\u0442\u0438 \u043f\u043e\u0441\u0438\u043b\u0430\u043d\u043d\u044f \u043d\u0430 \u0437\u043e\u0431\u0440\u0430\u0436\u0435\u043d\u043d\u044f:", "Image description:": "\u041e\u043f\u0438\u0441 \u0437\u043e\u0431\u0440\u0430\u0436\u0435\u043d\u043d\u044f:", "Please insert image description.": "\u0411\u0443\u0434\u044c \u043b\u0430\u0441\u043a\u0430, \u0434\u043e\u0434\u0430\u0439\u0442\u0435 \u043e\u043f\u0438\u0441 \u0434\u043e \u0437\u043e\u0431\u0440\u0430\u0436\u0435\u043d\u043d\u044f.", "Image description is too short.": "\u0414\u0443\u0436\u0435 \u043a\u043e\u0440\u043e\u0442\u043a\u0438\u0439 \u043e\u043f\u0438\u0441 \u0434\u043e \u0437\u043e\u0431\u0440\u0430\u0436\u0435\u043d\u043d\u044f.", "No file selected.": "\u0412\u0438\u0431\u0435\u0440\u0456\u0442\u044c \u0444\u0430\u0439\u043b.", "Please insert a link.": "\u0411\u0443\u0434\u044c \u043b\u0430\u0441\u043a\u0430, \u0434\u043e\u0434\u0430\u0439\u0442\u0435 \u043f\u043e\u0441\u0438\u043b\u0430\u043d\u043d\u044f.", "An unexpected error occurred. Please try again.": "\u041d\u0435\u043f\u0435\u0440\u0435\u0434\u0431\u0430\u0447\u0443\u0432\u0430\u043b\u044c\u043d\u0430 \u043f\u043e\u043c\u0438\u043b\u043a\u0430. \u0411\u0443\u0434\u044c \u043b\u0430\u0441\u043a\u0430, \u0441\u043f\u0440\u043e\u0431\u0443\u0439\u0442\u0435 \u0449\u0435 \u0440\u0430\u0437.", "There was an error during server image resize.": "\u041f\u043e\u043c\u0438\u043b\u043a\u0430 \u043d\u0430 \u0441\u0435\u0440\u0432\u0435\u0440\u0456 \u0432 \u0442\u043e\u0439 \u0447\u0430\u0441, \u043a\u043e\u043b\u0438 \u0432\u0456\u0434\u0431\u0443\u0432\u0430\u043b\u0430\u0441\u044c \u0437\u043c\u0456\u043d\u0430 \u0440\u043e\u0437\u043c\u0456\u0440\u0443 \u0437\u043e\u0431\u0440\u0430\u0436\u0435\u043d\u043d\u044f.", "Loading...": "\u0417\u0430\u0432\u0430\u043d\u0442\u0430\u0436\u0435\u043d\u043d\u044f...", "Could not interpret the content as image.": "\u041d\u0435 \u0432\u0434\u0430\u043b\u043e\u0441\u044f \u0440\u043e\u0441\u043f\u0456\u0437\u043d\u0430\u0442\u0438 \u043a\u043e\u043d\u0442\u0435\u043d\u0442 \u044f\u043a \u0437\u043e\u0431\u0440\u0430\u0436\u0435\u043d\u043d\u044f.", "File extension not valid.": "\u0420\u043e\u0437\u0448\u0438\u0440\u0435\u043d\u043d\u044f \u0444\u0430\u0439\u043b\u0443 \u043d\u0435 \u0434\u0456\u0439\u0441\u043d\u0435.", "File too big (max size: %s).": "\u0414\u0443\u0436\u0435 \u0432\u0435\u043b\u0438\u043a\u0438\u0439 \u0444\u0430\u0439\u043b (\u043c\u0430\u043a\u0441 \u0440\u043e\u0437\u043c\u0456\u0440: %s).", "Error in reading the response from the server": "\u041f\u043e\u043c\u0438\u043b\u043a\u0430 \u043f\u0456\u0434 \u0447\u0430\u0441 \u0441\u0447\u0438\u0442\u0443\u0432\u0430\u043d\u043d\u044f \u0437 \u0441\u0435\u0440\u0432\u0435\u0440\u0443", "Method %s does not exist on %s.": "\u041c\u0435\u0442\u043e\u0434 %s \u0432\u0456\u0434\u0441\u0443\u0442\u043d\u0456\u0439 \u0443 %s.", "Input not defined": "\u0412\u0445\u0456\u0434 \u043d\u0435 \u0432\u0438\u0437\u043d\u0430\u0447\u0435\u043d\u0438\u0439", "Image file type cannot be resized.": "\u0422\u0438\u043f \u0444\u0430\u0439\u043b\u0443 \u0437\u043e\u0431\u0440\u0430\u0436\u0435\u043d\u043d\u044f \u043d\u0435 \u043c\u043e\u0436\u043b\u0438\u0432\u043e \u0437\u043c\u0456\u043d\u0438\u0442\u0438.", "File is not a supported image.": "\u041d\u0435\u043c\u0430\u0454 \u043f\u0456\u0434\u0442\u0440\u0438\u043c\u043a\u0438 \u0446\u044c\u043e\u0433\u043e \u0444\u0430\u0439\u043b\u0443.", "File is not recognized as valid image.": "\u0424\u0430\u0439\u043b \u043d\u0435 \u0437\u0456\u0437\u043d\u0430\u0454\u0442\u044c\u0441\u044f \u0432 \u044f\u043a\u043e\u0441\u0442\u0456 \u0434\u0456\u0439\u0441\u043d\u043e\u0433\u043e \u0437\u043e\u0431\u0440\u0430\u0436\u0435\u043d\u043d\u044f.", "File is too big.": "\u0414\u0443\u0436\u0435 \u0432\u0435\u043b\u0438\u043a\u0438\u0439 \u0444\u0430\u0439\u043b.", "Error during loading of the image.": "\u041f\u043e\u043c\u0438\u043b\u043a\u0430 \u043f\u0456\u0434 \u0447\u0430\u0441 \u0437\u0430\u0432\u0430\u043d\u0442\u0430\u0436\u0435\u043d\u043d\u044f \u0437\u043e\u0431\u0440\u0430\u0436\u0435\u043d\u043d\u044f.", "Too many \"%s\" boxes (limit: %s).": "\u0414\u0443\u0436\u0435 \u0431\u0430\u0433\u0430\u0442\u043e \"%s\" \u0431\u043b\u043e\u043a\u0456\u0432 (\u043d\u0435 \u0431\u0456\u043b\u044c\u0448 \u043d\u0456\u0436: %s).", "Too many total boxes (limit: %s).": "\u0414\u0443\u0436\u0435 \u0431\u0430\u0433\u0430\u0442\u043e \u0431\u043b\u043e\u043a\u0456\u0432 (\u043d\u0435 \u0431\u0456\u043b\u044c\u0448 \u043d\u0456\u0436: %s).", "Unexpected error: could not finalize box style.": "\u041d\u0435 \u043e\u0447\u0456\u043a\u0443\u0432\u0430\u043d\u0430 \u043f\u043e\u043c\u0438\u043b\u043a\u0430: \u043d\u0435 \u0432\u0434\u0430\u043b\u043e\u0441\u044f \u0437\u0430\u0432\u0435\u0440\u0448\u0438\u0442\u0438 \u0441\u0442\u0438\u043b\u0456\u0437\u0430\u0446\u0456\u044e \u0431\u043b\u043e\u043a\u0456\u0432", "Background": "\u0424\u043e\u043d", "Arrange": "\u0420\u043e\u0437\u0442\u0430\u0448\u0443\u0432\u0430\u0442\u0438", "Bring to front": "\u041f\u043e\u043f\u0435\u0440\u0435\u0434\u0443", "Send to back": "\u041f\u043e\u0437\u0430\u0434\u0443", "Bring forward": "\u0412\u0438\u0441\u0443\u043d\u0443\u0442\u0438 \u0432\u043f\u0435\u0440\u0435\u0434", "Send backward": "\u0412\u0456\u0434\u0441\u0443\u043d\u0443\u0442\u0438 \u043d\u0430\u0437\u0430\u0434", "Duplicate": "\u0414\u0443\u0431\u043b\u044e\u0432\u0430\u0442\u0438", "Flip": "\u0412\u0456\u0434\u043e\u0431\u0440\u0430\u0437\u0438\u0442\u0438", "Vertical": "\u041f\u043e \u0432\u0435\u0440\u0442\u0438\u043a\u0430\u043b\u0456", "Horizontal": "\u041f\u043e \u0433\u043e\u0440\u0456\u0437\u043e\u043d\u0442\u0430\u043b\u0456", "Select background color": "\u0412\u0438\u0431\u0440\u0430\u0442\u0438 \u043a\u043e\u043b\u0456\u0440 \u0444\u043e\u043d\u0443", "Opacity": "\u041d\u0435\u043f\u0440\u043e\u0437\u043e\u0440\u0456\u0441\u0442\u044c", "Box opacity": "\u041d\u0435\u043f\u0440\u043e\u0437\u043e\u0440\u0456\u0441\u0442\u044c \u0431\u043b\u043e\u043a\u0443", "Select box opacity": "\u0412\u0438\u0431\u0435\u0440\u0456\u0442\u044c \u043d\u0435\u043f\u0440\u043e\u0437\u043e\u0440\u0456\u0441\u0442\u044c \u0431\u043b\u043e\u043a\u0443", "Select background opacity": "\u0412\u0438\u0431\u0435\u0440\u0456\u0442\u044c \u043d\u0435\u043f\u0440\u043e\u0437\u043e\u0440\u0456\u0441\u0442\u044c \u0444\u043e\u043d\u0443", "Background opacity": "\u041d\u0435\u043f\u0440\u043e\u0437\u043e\u0440\u0456\u0441\u0442\u044c \u0444\u043e\u043d\u0443", "Border": "\u0420\u0430\u043c\u043a\u0430", "Select border style": "\u0412\u0438\u0431\u0435\u0440\u0456\u0442\u044c \u0441\u0442\u0438\u043b\u044c \u0440\u0430\u043c\u043a\u0438", "Select border width": "\u0412\u0438\u0431\u0435\u0440\u0456\u0442\u044c \u0448\u0438\u0440\u0438\u043d\u0443 \u0440\u0430\u043c\u043a\u0438", "Width": "\u0428\u0438\u0440\u0438\u043d\u0430", "Corners": "\u041a\u0443\u0442\u0438", "Top left corner": "\u0412\u0435\u0440\u0445\u043d\u0456\u0439 \u043b\u0456\u0432\u0438\u0439 \u043a\u0443\u0442", "Top right corner": "\u0412\u0435\u0440\u0445\u043d\u0456\u0439 \u043f\u0440\u0430\u0432\u0438\u0439 \u043a\u0443\u0442", "Bottom left corner": "\u041b\u0456\u0432\u0438\u0439 \u043d\u0438\u0436\u043d\u0456\u0439 \u043a\u0443\u0442", "Bottom right corner": "\u041d\u0438\u0436\u043d\u0456\u0439 \u043f\u0440\u0430\u0432\u0438\u0439 \u043a\u0443\u0442", "Rounded corners": "\u0417\u0430\u043a\u0440\u0443\u0433\u043b\u0435\u043d\u0456 \u043a\u0443\u0442\u0438", "Unexpected error: box has no content.": "\u041d\u0435\u043e\u0447\u0456\u043a\u0443\u0432\u0430\u043d\u0430 \u043f\u043e\u043c\u0438\u043b\u043a\u0430: \u0431\u043b\u043e\u043a \u043d\u0435\u043c\u0430\u0454 \u043a\u043e\u043d\u0442\u0435\u043d\u0442\u0443", "Box type not supplied during registration.": "\u0422\u0438\u043f \u0431\u043b\u043e\u043a\u0443 \u043d\u0435 \u0432\u0445\u043e\u0434\u0438\u0442\u044c \u0432 \u043a\u043e\u043c\u043f\u043b\u0435\u043a\u0442 \u043f\u0440\u0438 \u0440\u0435\u0454\u0441\u0442\u0440\u0430\u0446\u0456\u0457.", "Video": "\u0412\u0456\u0434\u0435\u043e", "Click %s to insert text.": "\u041d\u0430\u0442\u0438\u0441\u043d\u0456\u0442\u044c %s, \u0449\u043e\u0431 \u0434\u043e\u0434\u0430\u0442\u0438 \u0442\u0435\u043a\u0441\u0442.", "Done": "\u0417\u0440\u043e\u0431\u043b\u0435\u043d\u043e", "Done editing": "\u0420\u0435\u0434\u0430\u0433\u0443\u0432\u0430\u043d\u043d\u044f \u0437\u0440\u043e\u0431\u043b\u0435\u043d\u043e", "Font": "\u0428\u0440\u0438\u0444\u0442", "Bold": "\u0412\u0438\u0434\u0456\u043b\u0435\u043d\u0438\u0439", "Italic": "\u041f\u043e\u0445\u0438\u043b\u0438\u0439", "Underline": "\u041f\u0456\u0434\u043a\u0440\u0435\u0441\u043b\u0435\u043d\u0438\u0439", "Increase font size": "\u0417\u0431\u0456\u043b\u044c\u0448\u0438\u0442\u0438 \u0440\u043e\u0437\u043c\u0456\u0440 \u0448\u0440\u0438\u0444\u0442\u0443", "Decrease font size": "\u0417\u043c\u0435\u043d\u0448\u0438\u0442\u0438 \u0440\u043e\u0437\u043c\u0456\u0440 \u0448\u0440\u0438\u0444\u0442\u0443", "Text length exceeds the maximum limit.": "\u0414\u043e\u0432\u0436\u0438\u043d\u0430 \u0442\u0435\u043a\u0441\u0442\u0443 \u043f\u0435\u0440\u0435\u0432\u0438\u0449\u0443\u0454 \u043c\u0430\u043a\u0441\u0438\u043c\u0430\u043b\u044c\u043d\u0443 \u043c\u0435\u0436\u0443.", "Click %s to insert video.": "\u041d\u0430\u0442\u0438\u0441\u043d\u0456\u0442\u044c %s, \u0449\u043e\u0431 \u0434\u043e\u0434\u0430\u0442\u0438 \u0432\u0456\u0434\u0435\u043e.", "Insert video": "\u0414\u043e\u0434\u0430\u0442\u0438 \u0432\u0456\u0434\u0435\u043e", "Play video": "\u0412\u0456\u0434\u0442\u0432\u043e\u0440\u0435\u043d\u043d\u044f \u0432\u0456\u0434\u0435\u043e", "Pause video": "\u041f\u0430\u0443\u0437\u0430 \u0432\u0456\u0434\u0435\u043e", "Show video": "\u041f\u043e\u043a\u0430\u0437\u0430\u0442\u0438 \u0432\u0456\u0434\u0435\u043e", "Close video": "\u0417\u0430\u0447\u0438\u043d\u0438\u0442\u0438 \u0432\u0456\u0434\u0435\u043e", "Please provide a valid link\/embed code for any of the supported video services.": "\u0411\u0443\u0434\u044c \u043b\u0430\u0441\u043a\u0430, \u0437\u0430\u0434\u0456\u0439\u0442\u0435 \u043f\u043e\u0441\u0438\u043b\u0430\u043d\u043d\u044f\/\u043a\u043e\u0434 \u0434\u043b\u044f \u043a\u043e\u0436\u043d\u043e\u0433\u043e \u0437 \u043f\u0456\u0434\u0442\u0440\u0438\u043c\u0443\u0432\u0430\u043d\u0438\u0445 \u0432\u0456\u0434\u0435\u043e\u0441\u0435\u0440\u0432\u0456\u0441\u0456\u0432.", "Could not interpret the content as video.": "\u041d\u0435 \u0432\u0434\u0430\u043b\u043e\u0441\u044f \u0440\u043e\u0441\u043f\u0456\u0437\u043d\u0430\u0442\u0438 \u043a\u043e\u043d\u0442\u0435\u043d\u0442, \u044f\u043a \u0432\u0456\u0434\u0435\u043e.", "Insert video embed code or url:": "\u0429\u043e\u0431 \u0434\u043e\u0434\u0430\u0442\u0438 \u0432\u0456\u0434\u0435\u043e, \u0434\u043e\u0434\u0430\u0439\u0442\u0435 \u043a\u043e\u0434 \u0430\u0431\u043e url:", "Select video from the list of available videos:": "\u0412\u0438\u0431\u0435\u0440\u0438\u0442\u044c \u0432\u0456\u0434\u0435\u043e \u0437\u0456 \u0441\u043f\u0438\u0441\u043a\u0443 \u0434\u043e\u0441\u0442\u0443\u043f\u043d\u0438\u0445 \u0432\u0456\u0434\u0435\u043e-\u0444\u0430\u0439\u043b\u0456\u0432:", "Add %s box": "\u0414\u043e\u0434\u0430\u0439\u0442\u0435 %s \u0431\u043b\u043e\u043a", "Set as background": "\u0412\u0441\u0442\u0430\u043d\u043e\u0432\u0438\u0442\u0438 \u044f\u043a \u0444\u043e\u043d", "Unset from background": "\u0412\u0456\u0434\u043a\u043b\u044e\u0447\u0438\u0442\u0438 \u0432\u0456\u0434 \u0444\u043e\u043d\u0443", "Error in generating unique id.": "\u041f\u043e\u043c\u0438\u043b\u043a\u0430 \u0432 \u0441\u0442\u0432\u043e\u0440\u0435\u043d\u043d\u0456 \u0443\u043d\u0456\u043a\u0430\u043b\u044c\u043d\u043e\u0433\u043e id.", "Improper internal call.": "\u041d\u0435\u043f\u0440\u0430\u0432\u0438\u043b\u044c\u043d\u0438\u0439 \u0432\u043d\u0443\u0442\u0440\u0456\u0448\u043d\u0456\u0439 \u0432\u0438\u043a\u043b\u0438\u043a.", "Please insert a value.": "\u0411\u0443\u0434\u044c \u043b\u0430\u0441\u043a\u0430, \u0432\u0441\u0442\u0430\u0432\u0442\u0435 \u0437\u043d\u0430\u0447\u0435\u043d\u043d\u044f.", "Browser does not support required feature \"%s\".": "\u0411\u0440\u0430\u0443\u0437\u0435\u0440 \u043d\u0435 \u043f\u0456\u0434\u0442\u0440\u0438\u043c\u0443\u0454 \u043d\u0435\u043e\u0431\u0445\u0456\u0434\u043d\u0443 \u0444\u0443\u043d\u043a\u0446\u0456\u044e \"%s\".", "Could not initialize %s. Container not found.": "\u041d\u0435 \u0432\u0434\u0430\u043b\u043e\u0441\u044f \u0456\u043d\u0456\u0446\u0456\u0430\u043b\u0456\u0437\u0443\u0432\u0430\u0442\u0438 %s. \u041a\u043e\u043d\u0442\u0435\u0439\u043d\u0435\u0440 \u043d\u0435 \u0437\u043d\u0430\u0439\u0434\u0435\u043d.", "Box type \"%s\" doesn't exist.": "\u0422\u0438\u043f \u0431\u043b\u043e\u043a\u0443 \"%s\" \u043d\u0435 \u0456\u0441\u043d\u0443\u0454.", "Error during box creation: %s.": "\u041f\u043e\u043c\u0438\u043b\u043a\u0430 \u043f\u0440\u0438 \u0441\u0442\u0432\u043e\u0440\u0435\u043d\u043d\u0456 \u0431\u043b\u043e\u043a\u0443: %s.", "Saving content.": "\u0417\u0431\u0435\u0440\u0435\u0433\u0442\u0438.", "Please wait...": "\u0417\u0430\u0447\u0435\u043a\u0430\u0439\u0442\u0435...", "Removed box. Box type \"%s\" not supported.": "\u0411\u043b\u043e\u043a \u0432\u0438\u0434\u0430\u043b\u0435\u043d\u043e. \u0422\u0438\u043f \u0431\u043b\u043e\u043a\u0443 \"%s\" \u043d\u0435 \u043f\u0456\u0434\u0442\u0440\u0438\u043c\u0443\u0454\u0442\u044c\u0441\u044f.", "This is a %s feature.": "\u0426\u044f \u0444\u0443\u043d\u043a\u0446\u0456\u044f %s.", "For information, please visit %s.": "\u0414\u043b\u044f \u043e\u0442\u0440\u0438\u043c\u0430\u043d\u043d\u044f \u0456\u043d\u0444\u043e\u0440\u043c\u0430\u0446\u0456\u0457, \u0431\u0443\u0434\u044c \u043b\u0430\u0441\u043a\u0430, \u0432\u0456\u0434\u0432\u0456\u0434\u0430\u0439\u0442\u0435 %s.", "Box size and position": "\u0420\u043e\u0437\u043c\u0456\u0440 \u0431\u043b\u043e\u043a\u0443 \u0442\u0430 \u043f\u043e\u043b\u043e\u0436\u0435\u043d\u043d\u044f", "Size": "\u0420\u043e\u0437\u043c\u0456\u0440", "Box": "\u0411\u043b\u043e\u043a", "SEO and grouping tags": "SEO \u0442\u0430 \u0433\u0440\u0443\u043f\u0430 \u0442\u0435\u0433\u0456\u0432", "Additional audio services:": "\u0414\u043e\u0434\u0430\u0442\u043a\u043e\u0432\u0456 \u0430\u0443\u0434\u0456\u043e-\u0441\u0435\u0440\u0432\u0456\u0441\u0438:", "Supported in %s:": "\u041f\u0456\u0434\u0442\u0440\u0438\u043c\u043a\u0430 \u0432\u0456\u0434 %s:", "Current color:": "\u041f\u043e\u0442\u043e\u0447\u043d\u0438\u0439 \u043a\u043e\u043b\u0456\u0440:", "Click on the \"%s\" button to start creating content for extra small layouts.": "\u041d\u0430\u0442\u0438\u0441\u043d\u0438\u0442\u044c \u043d\u0430 \u043a\u043d\u043e\u043f\u043a\u0443 \"%s\", \u0449\u043e\u0431 \u043f\u043e\u0447\u0430\u0442\u0438 \u0441\u0442\u0432\u043e\u0440\u044e\u0432\u0430\u0442\u0438 \u043a\u043e\u043d\u0442\u0435\u043d\u0442 \u0434\u043b\u044f \u043d\u0435\u0432\u0435\u043b\u0438\u043a\u0438\u0445 \u043c\u0430\u043a\u0435\u0442\u0456\u0432.", "Start responsive design": "\u041f\u043e\u0447\u0430\u0442\u0438 \u0447\u0443\u0439\u043d\u0438\u0439 \u0434\u0438\u0437\u0430\u0439\u043d", "Snap boxes to": "\u0417\u0432'\u044f\u0437\u0430\u0442\u0438 \u0431\u043b\u043e\u043a\u0438", "Page": "\u0421\u0442\u043e\u0440\u0456\u043d\u043a\u0430", "Boxes": "\u0411\u043b\u043e\u043a\u0438", "Content link": "\u041f\u043e\u0441\u0438\u043b\u0430\u043d\u043d\u044f", "Content": "\u041a\u043e\u043d\u0442\u0435\u043d\u0442", "Edit": "\u0417\u043c\u0456\u043d\u0438\u0442\u0438", "Undo": "\u0412\u0456\u0434\u043c\u0456\u043d\u0438\u0442\u0438", "Redo": "\u041f\u043e\u0432\u0442\u043e\u0440\u0438\u0442\u0438", "Clear all": "\u0412\u0438\u0434\u0430\u043b\u0438\u0442\u0438 \u0432\u0441\u0435", "Click to set Hex color": "\u041d\u0430\u0442\u0438\u0441\u043d\u0456\u0442\u044c, \u0449\u043e\u0431 \u0432\u0441\u0442\u0430\u043d\u043e\u0432\u0438\u0442\u0438 Hex \u043a\u043e\u043b\u0456\u0440", "Click to set RGB color": "\u041d\u0430\u0442\u0438\u0441\u043d\u0456\u0442\u044c, \u0449\u043e\u0431 \u0432\u0441\u0442\u0430\u043d\u043e\u0432\u0438\u0442\u0438 RGB \u043a\u043e\u043b\u0456\u0440", "Solid color": "\u0420\u0456\u0432\u043d\u0438\u0439 \u043a\u043e\u043b\u0456\u0440", "Horiz. gradient": "\u0413\u043e\u0440\u0456\u0437. \u0433\u0440\u0430\u0434\u0456\u0454\u043d\u0442", "Vert. gradient": "\u0412\u0435\u0440\u0442. \u0433\u0440\u0430\u0434\u0456\u0454\u043d\u0442", "Radial gradient": "\u0420\u0430\u0434\u0456\u0430\u043b\u044c\u043d\u0438\u0439 \u0433\u0440\u0430\u0434\u0456\u0454\u043d\u0442", "Select color opacity": "\u0412\u0438\u0431\u0435\u0440\u0438\u0442\u044c \u043a\u043e\u043b\u0456\u0440 \u043d\u0435\u043f\u0440\u043e\u0437\u043e\u0440\u043e\u0441\u0442\u0456", "Set custom color (Hex)": "\u0412\u0441\u0442\u0430\u043d\u043e\u0432\u043b\u0435\u043d\u043d\u044f \u043a\u043e\u043b\u044c\u043e\u0440\u0443 \u043a\u043e\u0440\u0438\u0441\u0442\u0443\u0432\u0430\u0447\u0430 (Hex)", "Please enter the color in hex format, e.g. %s": "\u0411\u0443\u0434\u044c \u043b\u0430\u0441\u043a\u0430, \u0432\u0432\u0435\u0434\u0456\u0442\u044c \u043a\u043e\u043b\u0456\u0440 \u0432 \u0448\u0456\u0441\u0442\u043d\u0430\u0434\u0446\u044f\u0442\u043a\u043e\u0432\u043e\u043c\u0443 \u0444\u043e\u0440\u043c\u0430\u0442\u0456, \u043d\u0430\u043f\u0440\u0438\u043a\u043b\u0430\u0434 %s", "You must enter a color.": "\u0412\u0438 \u043c\u0430\u0454\u0442\u0435 \u0432\u0432\u0435\u0441\u0442\u0438 \u043a\u043e\u043b\u0456\u0440.", "Set custom color (RGB)": "\u0412\u0441\u0442\u0430\u043d\u043e\u0432\u043b\u0435\u043d\u043d\u044f \u043a\u043e\u043b\u044c\u043e\u0440\u0443 \u043a\u043e\u0440\u0438\u0441\u0442\u0443\u0432\u0430\u0447\u0430 (RGB)", "Please enter the color in RGB format, with comma-separated components, e.g. %s": "\u0411\u0443\u0434\u044c \u043b\u0430\u0441\u043a\u0430, \u0432\u0432\u0435\u0434\u0456\u0442\u044c \u043a\u043e\u043b\u0456\u0440 \u0443 \u0444\u043e\u0440\u043c\u0430\u0442\u0456 RGB, \u0440\u043e\u0437\u0434\u0456\u043b\u044f\u044e\u0447\u0438 \u043a\u043e\u043c\u0430\u043c\u0438 \u043a\u043e\u043c\u043f\u043e\u043d\u0435\u043d\u0442\u0438, \u043d\u0430\u043f\u0440\u0438\u043a\u043b\u0430\u0434 %s"
    }
);
Zedity.i18n.add('vi', {
        "%s needs %s.": "%s c\u1ea7n %s.", "Click %s to insert a document.": "B\u1ea5m %s \u0111\u1ec3 ch\u00e8n m\u1ed9t t\u00e0i li\u1ec7u.", "Document": "T\u00e0i li\u1ec7u", "Insert": "Ch\u00e8n", "Insert document": "Ch\u00e8n t\u00e0i li\u1ec7u", "Read": "\u0110\u1ecdc", "Read document": "\u0110\u1ecdc t\u00e0i li\u1ec7u", "Close": "\u0110\u00f3ng", "Close document": "\u0110\u00f3ng t\u00e0i li\u1ec7u", "Please provide a valid link\/embed code for any of the supported document embed services or a direct link to a document.": "Vui l\u00f2ng cung c\u1ea5p m\u1ed9t li\u00ean k\u1ebft\/m\u00e3 nh\u00fang h\u1ee3p l\u1ec7 cho b\u1ea5t k\u1ef3 lo\u1ea1i d\u1ecbch v\u1ee5 nh\u00fang t\u00e0i li\u1ec7u \u0111\u01b0\u1ee3c h\u1ed7 tr\u1ee3 n\u00e0o ho\u1eb7c m\u1ed9t li\u00ean k\u1ebft tr\u1ef1c ti\u1ebfp \u0111\u1ebfn t\u00e0i li\u1ec7u.", "Could not interpret the content as document.": "Kh\u00f4ng th\u1ec3 bi\u00ean d\u1ecbch n\u1ed9i dung th\u00e0nh t\u00e0i li\u1ec7u.", "%s can't be rotated.": "Kh\u00f4ng th\u1ec3 xoay %s.", "%s doesn't support background property.": "%s kh\u00f4ng h\u1ed7 tr\u1ee3 thu\u1ed9c t\u00ednh n\u1ec1n.", "%s doesn't support rounded corners.": "%s kh\u00f4ng h\u1ed7 tr\u1ee3 c\u00e1c g\u00f3c bo tr\u00f2n.", "%s doesn't support flipping.": "%s kh\u00f4ng h\u1ed7 tr\u1ee3 l\u1eadt.", "Embed": "Nh\u00fang", "Insert document embed code or url:": "Ch\u00e8n m\u00e3 nh\u00fang ho\u1eb7c url c\u1ee7a t\u00e0i li\u1ec7u:", "Supported services:": "C\u00e1c lo\u1ea1i d\u1ecbch v\u1ee5 \u0111\u01b0\u1ee3c h\u1ed7 tr\u1ee3:", "Supported documents:": "C\u00e1c lo\u1ea1i t\u00e0i li\u1ec7u \u0111\u01b0\u1ee3c h\u1ed7 tr\u1ee3:", "PDF documents, Microsoft Office documents, Apple Pages, Adobe Photoshop and Illustrator, and more.": "T\u00e0i li\u1ec7u PDF, t\u00e0i li\u1ec7u Microsoft Office, Pages c\u1ee7a Apple, Photoshop v\u00e0 Illustrator c\u1ee7a Adobe, v\u00e0 nhi\u1ec1u h\u01a1n n\u1eefa.", "OK": "OK", "Cancel": "H\u1ee7y", "Click %s to insert HTML.": "B\u1ea5m %s \u0111\u1ec3 ch\u00e8n HTML.", "Html": "Html", "Insert HTML": "Ch\u00e8n HTML", "View": "Xem", "View box content": "Xem n\u1ed9i dung v\u00f9ng \u0111\u1ed1i t\u01b0\u1ee3ng", "Insert HTML code:": "Ch\u00e8n m\u00e3 HTML:", "Safe mode:": "Ch\u1ebf \u0111\u1ed9 an to\u00e0n:", "Automatic": "T\u1ef1 \u0111\u1ed9ng", "Enabled": "\u0110\u00e3 k\u00edch ho\u1ea1t", "Disabled": "\u0110\u00e3 v\u00f4 hi\u1ec7u", "If you insert Javascript or CSS code and you get unexpected effects (e.g. content overflow, etc.) you need to enable safe mode.": "N\u1ebfu b\u1ea1n ch\u00e8n m\u00e3 Javascript ho\u1eb7c CSS v\u00e0 nh\u1eadn \u0111\u01b0\u1ee3c hi\u1ec7u \u1ee9ng kh\u00f4ng mong mu\u1ed1n (v\u00ed d\u1ee5 b\u1ecb tr\u00e0n n\u1ed9i dung, v.v...) th\u00ec b\u1ea1n c\u1ea7n k\u00edch ho\u1ea1t ch\u1ebf \u0111\u1ed9 an to\u00e0n.", "The (default) automatic setting enables safe mode only if Javascript is detected.": "C\u00e0i \u0111\u1eb7t t\u1ef1 \u0111\u1ed9ng (m\u1eb7c \u0111\u1ecbnh) ch\u1ec9 k\u00edch ho\u1ea1t ch\u1ebf \u0111\u1ed9 an to\u00e0n n\u1ebfu nh\u1eadn ra m\u00e3 Javascript.", "Some scripts (for example social network services) need to access the page, so the \"Safe mode\" must be disabled in these cases.": "M\u1ed9t s\u1ed1 \u0111o\u1ea1n m\u00e3 (v\u00ed d\u1ee5 c\u00e1c d\u1ecbch v\u1ee5 m\u1ea1ng x\u00e3 h\u1ed9i) c\u1ea7n truy c\u1eadp trang, n\u00ean ph\u1ea3i v\u00f4 hi\u1ec7u \"Ch\u1ebf \u0111\u1ed9 an to\u00e0n\" trong c\u00e1c tr\u01b0\u1eddng h\u1ee3p n\u00e0y.", "Inserting a %s content into an HTML box is not supported at the moment.": "Hi\u1ec7n ch\u01b0a h\u1ed7 tr\u1ee3 ch\u00e8n n\u1ed9i dung %s v\u00e0o m\u1ed9t v\u00f9ng \u0111\u1ed1i t\u01b0\u1ee3ng HTML.", "Filters": "B\u1ed9 l\u1ecdc", "Apply image filters": "\u00c1p d\u1ee5ng b\u1ed9 l\u1ecdc h\u00ecnh \u1ea3nh", "Adjust colors": "\u0110i\u1ec1u ch\u1ec9nh m\u00e0u", "Black &amp; white": "\u0110en &amp; tr\u1eafng", "Blur": "L\u00e0m nh\u00f2e", "Brightness": "\u0110\u1ed9 s\u00e1ng", "Contrast": "\u0110\u1ed9 t\u01b0\u01a1ng ph\u1ea3n", "Emboss": "Ch\u1ea1m n\u1ed5i", "Grayscale": "Chuy\u1ec3n sang thang \u0111\u1ed9 x\u00e1m", "Invert": "Chuy\u1ec3n sang m\u00e0u \u00e2m b\u1ea3n", "Mosaic": "Kh\u1ea3m gh\u00e9p", "Motion blur": "L\u00e0m nh\u00f2e chuy\u1ec3n \u0111\u1ed9ng", "Noise": "L\u00e0m nhi\u1ec5u", "Paint": "T\u00f4 m\u00e0u", "Posterize": "L\u00e0m \u00e1p ph\u00edch", "Psychedelia": "T\u1ea1o \u1ea3o gi\u00e1c", "Sepia": "Chuy\u1ec3n sang m\u00e0u n\u00e2u \u0111\u1ecf", "Sharpen": "L\u00e0m s\u1eafc n\u00e9t", "Vignette": "L\u00e0m m\u1edd n\u00e9t", "Apply filter": "\u00c1p d\u1ee5ng b\u1ed9 l\u1ecdc", "Reset filter": "\u0110\u1eb7t l\u1ea1i b\u1ed9 l\u1ecdc", "Remove all filters": "Lo\u1ea1i b\u1ecf t\u1ea5t c\u1ea3 b\u1ed9 l\u1ecdc", "Error applying filter \"%s\".": "L\u1ed7i khi \u00e1p d\u1ee5ng b\u1ed9 l\u1ecdc \"%s\".", "Filter \"%s\" not defined.": "B\u1ed9 l\u1ecdc \"%s\" kh\u00f4ng x\u00e1c \u0111\u1ecbnh.", "Could not read image data. Filters cannot be applied on images hosted on a different domain.": "Kh\u00f4ng \u0111\u1ecdc \u0111\u01b0\u1ee3c d\u1eef li\u1ec7u \u1ea3nh. Kh\u00f4ng th\u1ec3 \u00e1p d\u1ee5ng b\u1ed9 l\u1ecdc cho c\u00e1c \u1ea3nh l\u01b0u tr\u1eef tr\u00ean mi\u1ec1n kh\u00e1c.", "Percent": "Ph\u1ea7n tr\u0103m", "Adjustment": "\u0110i\u1ec1u ch\u1ec9nh", "Threshold": "X\u00e1c \u0111\u1ecbnh \u0111i\u1ec3m s\u00e1ng nh\u1ea5t\/t\u1ed1i nh\u1ea5t", "Red": "\u0110\u1ecf", "Green": "L\u1ee5c", "Blue": "Lam", "Amount": "L\u01b0\u1ee3ng", "Block size": "K\u00edch c\u1ee1 \u00f4 vu\u00f4ng", "Type": "Lo\u1ea1i", "Strength": "C\u01b0\u1eddng \u0111\u1ed9", "Brush size": "K\u00edch c\u1ee1 n\u00e9t b\u00fat", "Link": "Li\u00ean k\u1ebft", "Add link to box": "Th\u00eam li\u00ean k\u1ebft v\u00e0o v\u00f9ng \u0111\u1ed1i t\u01b0\u1ee3ng", "This link will be associated to the whole box.": "Li\u00ean k\u1ebft n\u00e0y s\u1ebd \u0111\u01b0\u1ee3c g\u1eafn v\u1edbi to\u00e0n b\u1ed9 v\u00f9ng \u0111\u1ed1i t\u01b0\u1ee3ng.", "Insert link url:": "Ch\u00e8n url c\u1ee7a li\u00ean k\u1ebft:", "Align": "Canh l\u1ec1", "Align to page": "Canh l\u1ec1 theo trang", "Left": "B\u00ean tr\u00e1i", "Center": "\u1ede gi\u1eefa", "Right": "B\u00ean ph\u1ea3i", "Top": "Tr\u00ean c\u00f9ng", "Middle": "\u1ede gi\u1eefa", "Bottom": "D\u01b0\u1edbi c\u00f9ng", "Fit width": "\u0110\u1ed9 r\u1ed9ng v\u1eeba v\u1eb7n", "Fit height": "\u0110\u1ed9 cao v\u1eeba v\u1eb7n", "Position and size": "V\u1ecb tr\u00ed v\u00e0 k\u00edch c\u1ee1", "Set box position %s.": "\u0110\u1eb7t v\u1ecb tr\u00ed v\u00f9ng \u0111\u1ed1i t\u01b0\u1ee3ng %s.", "W:": "R\u1ed9ng:", "H:": "Cao:", "Set box width": "\u0110\u1eb7t \u0111\u1ed9 r\u1ed9ng c\u1ee7a v\u00f9ng \u0111\u1ed1i t\u01b0\u1ee3ng", "(min: %s, max: %s)": "(t\u1ed1i thi\u1ec3u: %s, t\u1ed1i \u0111a: %s)", "Set box height": "\u0110\u1eb7t \u0111\u1ed9 cao c\u1ee7a v\u00f9ng \u0111\u1ed1i t\u01b0\u1ee3ng", "Keep aspect ratio": "Gi\u1eef nguy\u00ean t\u1ec9 l\u1ec7", "Select box padding": "\u0110\u1eb7t ph\u1ea7n \u0111\u1ec7m c\u1ee7a v\u00f9ng \u0111\u1ed1i t\u01b0\u1ee3ng", "Padding": "Ph\u1ea7n \u0111\u1ec7m", "Shadow": "B\u00f3ng \u0111\u1ed5", "Predefined": "\u0110\u1ecbnh s\u1eb5n", "Select predefined shadow": "Ch\u1ecdn b\u00f3ng \u0111\u1ed5 \u0111\u1ecbnh s\u1eb5n", "No shadow": "Kh\u00f4ng c\u00f3 b\u00f3ng \u0111\u1ed5", "Shadow at bottom right": "B\u00f3ng \u0111\u1ed5 \u1edf g\u00f3c d\u01b0\u1edbi c\u00f9ng b\u00ean ph\u1ea3i", "Shadow at bottom left": "B\u00f3ng \u0111\u1ed5 \u1edf g\u00f3c d\u01b0\u1edbi c\u00f9ng b\u00ean tr\u00e1i", "Shadow at top right": "B\u00f3ng \u0111\u1ed5 \u1edf g\u00f3c tr\u00ean c\u00f9ng b\u00ean ph\u1ea3i", "Shadow at top left": "B\u00f3ng \u0111\u1ed5 \u1edf g\u00f3c tr\u00ean c\u00f9ng b\u00ean tr\u00e1i", "Diffuse shadow": "Khu\u1ebfch t\u00e1n b\u00f3ng \u0111\u1ed5", "Color": "M\u00e0u", "Select shadow color": "Ch\u1ecdn m\u00e0u cho b\u00f3ng \u0111\u1ed5", "Box shadow": "B\u00f3ng \u0111\u1ed5 c\u1ee7a v\u00f9ng \u0111\u1ed1i t\u01b0\u1ee3ng", "Horizontal position": "V\u1ecb tr\u00ed ngang", "Select shadow horizontal position": "Ch\u1ecdn v\u1ecb tr\u00ed ngang c\u1ee7a b\u00f3ng \u0111\u1ed5", "Vertical position": "V\u1ecb tr\u00ed d\u1ecdc", "Select shadow vertical position": "Ch\u1ecdn v\u1ecb tr\u00ed d\u1ecdc c\u1ee7a b\u00f3ng \u0111\u1ed5", "Select shadow blur": "Ch\u1ecdn \u0111\u1ed9 m\u1edd c\u1ee7a b\u00f3ng \u0111\u1ed5", "Spread": "\u0110\u1ed9 lan t\u1ecfa", "Select shadow spread": "Ch\u1ecdn \u0111\u1ed9 lan t\u1ecfa c\u1ee7a b\u00f3ng \u0111\u1ed5", "Inset": "Trong v\u00f9ng \u0111\u1ed1i t\u01b0\u1ee3ng", "Shadow inset": "B\u00f3ng \u0111\u1ed5 trong v\u00f9ng \u0111\u1ed1i t\u01b0\u1ee3ng", "Text": "V\u0103n b\u1ea3n", "Paragraph": "\u0110o\u1ea1n", "Select paragraph": "Ch\u1ecdn \u0111o\u1ea1n", "Heading": "\u0110\u1ea7u \u0111\u1ec1", "Align left": "Canh l\u1ec1 b\u00ean tr\u00e1i", "Align center": "Canh l\u1ec1 \u1edf gi\u1eefa", "Align right": "Canh l\u1ec1 b\u00ean ph\u1ea3i", "Justify": "Canh l\u1ec1 hai b\u00ean", "Select line height": "Ch\u1ecdn \u0111\u1ed9 cao d\u00f2ng", "Ordered list": "Danh s\u00e1ch theo th\u1ee9 t\u1ef1", "Unordered list": "Danh s\u00e1ch kh\u00f4ng theo th\u1ee9 t\u1ef1", "Select paragraph spacing": "Ch\u1ecdn kho\u1ea3ng c\u00e1ch gi\u1eefa c\u00e1c \u0111o\u1ea1n", "Indent": "D\u00f2ng \u0111\u1ea7u th\u1ee5t v\u00e0o", "Outdent": "D\u00f2ng \u0111\u1ea7u l\u00f9i ra", "Subscript": "Ch\u1ec9 s\u1ed1 d\u01b0\u1edbi", "Superscript": "Ch\u1ec9 s\u1ed1 tr\u00ean", "Open link in the same frame.": "M\u1edf li\u00ean k\u1ebft trong c\u00f9ng m\u1ed9t khung.", "Open link in the same tab.": "M\u1edf li\u00ean k\u1ebft trong c\u00f9ng m\u1ed9t tab.", "Open link in a new tab.": "M\u1edf li\u00ean k\u1ebft trong tab m\u1edbi.", "Link style preview": "Xem tr\u01b0\u1edbc ki\u1ec3u li\u00ean k\u1ebft", "Link style": "Ki\u1ec3u li\u00ean k\u1ebft", "Link style on mouse over": "Ki\u1ec3u li\u00ean k\u1ebft khi di chu\u1ed9t qua", "Insert link": "Ch\u00e8n li\u00ean k\u1ebft", "Remove": "Lo\u1ea1i b\u1ecf", "The box link may override any link in the text.": "Li\u00ean k\u1ebft c\u1ee7a v\u00f9ng \u0111\u1ed1i t\u01b0\u1ee3ng c\u00f3 th\u1ec3 ghi \u0111\u00e8 b\u1ea5t k\u1ef3 li\u00ean k\u1ebft n\u00e0o trong ph\u1ea7n v\u0103n b\u1ea3n.", "Align top": "Canh l\u1ec1 tr\u00ean c\u00f9ng", "Align middle": "Canh l\u1ec1 \u1edf gi\u1eefa", "Align bottom": "Canh l\u1ec1 d\u01b0\u1edbi c\u00f9ng", "Extra small layout": "B\u1ed1 c\u1ee5c si\u00eau nh\u1ecf", "Small layout": "B\u1ed1 c\u1ee5c nh\u1ecf", "Medium layout": "B\u1ed1 c\u1ee5c trung b\u00ecnh", "Large layout": "B\u1ed1 c\u1ee5c l\u1edbn", "If you perform this action you will revert to a non-responsive design. Are you sure?": "N\u1ebfu b\u1ea1n th\u1ef1c hi\u1ec7n h\u00e0nh \u0111\u1ed9ng n\u00e0y b\u1ea1n s\u1ebd tr\u1edf l\u1ea1i thi\u1ebft k\u1ebf kh\u00f4ng t\u1ef1 co d\u00e3n theo k\u00edch th\u01b0\u1edbc m\u00e0n h\u00ecnh. B\u1ea1n c\u00f3 ch\u1eafc kh\u00f4ng?", "You can start your design from any layout.": "B\u1ea1n c\u00f3 th\u1ec3 b\u1eaft \u0111\u1ea7u thi\u1ebft k\u1ebf c\u1ee7a m\u00ecnh t\u1eeb b\u1ea5t k\u1ef3 b\u1ed1 c\u1ee5c n\u00e0o.", "Boxes can be added in any layout and can be modified only in the layout they were added to.": "C\u00f3 th\u1ec3 th\u00eam c\u00e1c v\u00f9ng \u0111\u1ed1i t\u01b0\u1ee3ng v\u00e0o b\u1ea5t k\u1ef3 b\u1ed1 c\u1ee5c n\u00e0o v\u00e0 ch\u1ec9 c\u00f3 th\u1ec3 s\u1eeda \u0111\u1ed5i trong b\u1ed1 c\u1ee5c m\u00e0 ch\u00fang \u0111\u01b0\u1ee3c th\u00eam v\u00e0o.", "Boxes added in a layout can be hidden in other layouts.": "C\u00f3 th\u1ec3 \u1ea9n c\u00e1c v\u00f9ng \u0111\u1ed1i t\u01b0\u1ee3ng \u0111\u01b0\u1ee3c th\u00eam v\u00e0o m\u1ed9t b\u1ed1 c\u1ee5c trong c\u00e1c b\u1ed1 c\u1ee5c kh\u00e1c.", "Custom layouts:": "C\u00e1c b\u1ed1 c\u1ee5c t\u00f9y ch\u1ec9nh:", "Add custom layout": "Th\u00eam b\u1ed1 c\u1ee5c t\u00f9y ch\u1ec9nh", "Multiple layout responsive design": "Thi\u1ebft k\u1ebf t\u1ef1 co d\u00e3n theo k\u00edch th\u01b0\u1edbc m\u00e0n h\u00ecnh \u0111a b\u1ed1 c\u1ee5c", "The width of custom layouts can be adjusted to fit larger designs.": "C\u00f3 th\u1ec3 \u0111i\u1ec1u ch\u1ec9nh \u0111\u1ed9 r\u1ed9ng c\u1ee7a c\u00e1c b\u1ed1 c\u1ee5c t\u00f9y ch\u1ec9nh cho v\u1eeba v\u1edbi c\u00e1c thi\u1ebft k\u1ebf l\u1edbn h\u01a1n.", "Click on a layout button to start creating content for that layout.": "B\u1ea5m v\u00e0o m\u1ed9t n\u00fat b\u1ed1 c\u1ee5c \u0111\u1ec3 b\u1eaft \u0111\u1ea7u t\u1ea1o n\u1ed9i dung cho b\u1ed1 c\u1ee5c \u0111\u00f3", "Save": "L\u01b0u", "Abort": "B\u1ecf qua", "You may want to review the design for layouts in yellow.": "B\u1ea1n c\u00f3 th\u1ec3 mu\u1ed1n xem l\u1ea1i thi\u1ebft k\u1ebf cho c\u00e1c b\u1ed1 c\u1ee5c c\u00f3 m\u00e0u v\u00e0ng.", "Save without reviewing": "L\u01b0u m\u00e0 kh\u00f4ng xem l\u1ea1i", "Please click on the layouts in gray to provide the design for all layouts.": "Vui l\u00f2ng b\u1ea5m v\u00e0o c\u00e1c b\u1ed1 c\u1ee5c c\u00f3 m\u00e0u x\u00e1m \u0111\u1ec3 \u00e1p d\u1ee5ng thi\u1ebft k\u1ebf cho t\u1ea5t c\u1ea3 c\u00e1c b\u1ed1 c\u1ee5c.", "Save anyway (not recommended)": "V\u1eabn l\u01b0u (kh\u00f4ng khuy\u1ebfn c\u00e1o)", "Your responsive content is ready to be saved!": "C\u00f3 th\u1ec3 l\u01b0u n\u1ed9i dung t\u1ef1 co d\u00e3n theo k\u00edch th\u01b0\u1edbc m\u00e0n h\u00ecnh c\u1ee7a b\u1ea1n ngay b\u00e2y gi\u1edd!", "This box was created in another layout.": "V\u00f9ng \u0111\u1ed1i t\u01b0\u1ee3ng n\u00e0y \u0111\u01b0\u1ee3c t\u1ea1o ra trong m\u1ed9t b\u1ed1 c\u1ee5c kh\u00e1c.", "To modify its content edit the layout \"%s\".": "\u0110\u1ec3 s\u1eeda \u0111\u1ed5i n\u1ed9i dung c\u1ee7a n\u00f3, h\u00e3y ch\u1ec9nh s\u1eeda b\u1ed1 c\u1ee5c \"%s\".", "The box is hidden in this layout.": "V\u00f9ng \u0111\u1ed1i t\u01b0\u1ee3ng n\u00e0y b\u1ecb \u1ea9n trong b\u1ed1 c\u1ee5c n\u00e0y.", "Show box": "Hi\u1ec3n th\u1ecb v\u00f9ng \u0111\u1ed1i t\u01b0\u1ee3ng.", "Responsive": "T\u1ef1 co d\u00e3n theo k\u00edch th\u01b0\u1edbc m\u00e0n h\u00ecnh", "Start %s": "B\u1eaft \u0111\u1ea7u %s", "Save \"%s\"": "L\u01b0u \"%s\"", "Edit box": "Ch\u1ec9nh s\u1eeda v\u00f9ng \u0111\u1ed1i t\u01b0\u1ee3ng", "Layout": "B\u1ed1 c\u1ee5c", "Show": "Hi\u1ec3n th\u1ecb", "Show box in this layout": "Hi\u1ec3n th\u1ecb v\u00f9ng \u0111\u1ed1i t\u01b0\u1ee3ng trong b\u1ed1 c\u1ee5c n\u00e0y", "Hide": "\u1ea8n", "Hide box in this layout": "\u1ea8n v\u00f9ng \u0111\u1ed1i t\u01b0\u1ee3ng trong b\u1ed1 c\u1ee5c n\u00e0y", "Box style": "Ki\u1ec3u v\u00f9ng \u0111\u1ed1i t\u01b0\u1ee3ng", "This link will be associated to the whole %s content.": "Li\u00ean k\u1ebft n\u00e0y s\u1ebd \u0111\u01b0\u1ee3c g\u1eafn v\u1edbi to\u00e0n b\u1ed9 n\u1ed9i dung %s.", "This is useful to create all clickable contents, like banners, etc. If you need to create a textual link, instead, enter the \"boxes\" menu.": "T\u00ednh n\u0103ng n\u00e0y gi\u00fap t\u1ea1o ra c\u00e1c n\u1ed9i dung c\u00f3 th\u1ec3 b\u1ea5m v\u00e0o, nh\u01b0 banner, v.v... N\u1ebfu b\u1ea1n c\u1ea7n t\u1ea1o ra li\u00ean k\u1ebft theo ng\u1eef c\u1ea3nh, h\u00e3y v\u00e0o tr\u00ecnh \u0111\u01a1n \"c\u00e1c v\u00f9ng \u0111\u1ed1i t\u01b0\u1ee3ng\".", "Snap": "\u0110\u00ednh", "Snap boxes to page": "\u0110\u00ednh c\u00e1c v\u00f9ng \u0111\u1ed1i t\u01b0\u1ee3ng v\u00e0o trang", "Snap boxes to boxes": "\u0110\u00ednh c\u00e1c v\u00f9ng \u0111\u1ed1i t\u01b0\u1ee3ng v\u00e0o c\u00e1c v\u00f9ng \u0111\u1ed1i t\u01b0\u1ee3ng", "Snap boxes to grid": "\u0110\u00ednh c\u00e1c v\u00f9ng \u0111\u1ed1i t\u01b0\u1ee3ng v\u00e0o l\u01b0\u1edbi", "Grid": "L\u01b0\u1edbi", "Width:": "\u0110\u1ed9 r\u1ed9ng:", "Set grid width": "\u0110\u1eb7t \u0111\u1ed9 r\u1ed9ng c\u1ee7a l\u01b0\u1edbi", "Height:": "\u0110\u1ed9 cao:", "Set grid height": "\u0110\u1eb7t \u0111\u1ed9 cao c\u1ee7a l\u01b0\u1edbi", "Lock width and height": "Kh\u00f3a \u0111\u1ed9 r\u1ed9ng v\u00e0 \u0111\u1ed9 cao", "Templates": "M\u1eabu", "New Template": "M\u1eabu M\u1edbi", "Save current content as Template": "L\u01b0u n\u1ed9i dung hi\u1ec7n t\u1ea1i th\u00e0nh M\u1eabu", "Load selected Template into editor": "N\u1ea1p M\u1eabu \u0111\u01b0\u1ee3c ch\u1ecdn v\u00e0o tr\u00ecnh bi\u00ean t\u1eadp", "Load": "N\u1ea1p", "Delete selected Template": "X\u00f3a M\u1eabu \u0111\u01b0\u1ee3c ch\u1ecdn", "Delete": "X\u00f3a", "An error occurred while saving the Template. Please try again.": "C\u00f3 l\u1ed7i x\u1ea3y ra khi l\u01b0u M\u1eabu. Vui l\u00f2ng th\u1eed l\u1ea1i.", "Template \"%s\" saved.": "\u0110\u00e3 l\u01b0u M\u1eabu \"%s\".", "The current content will overwrite the selected Template. Are you sure?": "N\u1ed9i dung hi\u1ec7n t\u1ea1i s\u1ebd ghi \u0111\u00e8 l\u00ean M\u1eabu \u0111\u01b0\u1ee3c ch\u1ecdn. B\u1ea1n c\u00f3 ch\u1eafc kh\u00f4ng?", "Give a title to your Template:": "\u0110\u1eb7t ti\u00eau \u0111\u1ec1 cho M\u1eabu c\u1ee7a b\u1ea1n:", "A Template with that title already exists, please change the title.": "\u0110\u00e3 c\u00f3 s\u1eb5n m\u1ed9t M\u1eabu c\u00f3 ti\u00eau \u0111\u1ec1 \u0111\u00f3, vui l\u00f2ng \u0111\u1ed5i ti\u00eau \u0111\u1ec1.", "The Template will overwrite the current editor content. Are you sure?": "M\u1eabu s\u1ebd ghi \u0111\u00e8 l\u00ean n\u1ed9i dung hi\u1ec7n t\u1ea1i c\u1ee7a tr\u00ecnh bi\u00ean t\u1eadp. B\u1ea1n c\u00f3 ch\u1eafc kh\u00f4ng?", "An error occurred while loading the Template. Please try again.": "C\u00f3 l\u1ed7i x\u1ea3y ra khi n\u1ea1p M\u1eabu. Vui l\u00f2ng th\u1eed l\u1ea1i.", "Template \"%s\" loaded.": "\u0110\u00e3 n\u1ea1p M\u1eabu \"%s\".", "Are you sure you want to delete the selected Template?": "B\u1ea1n c\u00f3 ch\u1eafc mu\u1ed1n x\u00f3a M\u1eabu \u0111\u01b0\u1ee3c ch\u1ecdn kh\u00f4ng?", "An error occurred while deleting the Template. Please try again.": "C\u00f3 l\u1ed7i x\u1ea3y ra khi x\u00f3a M\u1eabu. Vui l\u00f2ng th\u1eed l\u1ea1i.", "Click %s to insert audio.": "B\u1ea5m %s \u0111\u1ec3 ch\u00e8n \u0111o\u1ea1n \u00e2m thanh.", "Audio": "\u0110o\u1ea1n \u00e2m thanh", "Insert audio": "Ch\u00e8n \u0111o\u1ea1n \u00e2m thanh", "Play": "Ph\u00e1t", "Play audio": "Ph\u00e1t \u0111o\u1ea1n \u00e2m thanh", "Pause": "T\u1ea1m d\u1eebng", "Pause audio": "T\u1ea1m d\u1eebng \u0111o\u1ea1n \u00e2m thanh", "Show audio": "Hi\u1ec3n th\u1ecb \u0111o\u1ea1n \u00e2m thanh", "Close audio": "\u0110\u00f3ng \u0111o\u1ea1n \u00e2m thanh", "Please provide a valid link\/embed code for any of the supported audio services.": "Vui l\u00f2ng cung c\u1ea5p m\u1ed9t li\u00ean k\u1ebft\/m\u00e3 nh\u00fang h\u1ee3p l\u1ec7 cho b\u1ea5t k\u1ef3 lo\u1ea1i d\u1ecbch v\u1ee5 \u00e2m thanh \u0111\u01b0\u1ee3c h\u1ed7 tr\u1ee3 n\u00e0o.", "Could not interpret the content as audio.": "Kh\u00f4ng th\u1ec3 bi\u00ean d\u1ecbch n\u1ed9i dung th\u00e0nh \u00e2m thanh.", "%s can't be set as background.": "Kh\u00f4ng th\u1ec3 \u0111\u1eb7t %s l\u00e0m n\u1ec1n.", "Files": "T\u1eadp tin", "Insert audio embed code or url:": "Ch\u00e8n m\u00e3 nh\u00fang ho\u1eb7c url c\u1ee7a \u0111o\u1ea1n \u00e2m thanh:", "Select audio from the list of available audios:": "Ch\u1ecdn \u0111o\u1ea1n \u00e2m thanh t\u1eeb danh s\u00e1ch c\u00e1c \u0111o\u1ea1n \u00e2m thanh c\u00f3 s\u1eb5n:", "Click %s to add color.": "B\u1ea5m %s \u0111\u1ec3 th\u00eam m\u00e0u.", "Add": "Th\u00eam", "Add color": "Th\u00eam m\u00e0u", "Click %s to insert image.": "B\u1ea5m %s \u0111\u1ec3 ch\u00e8n h\u00ecnh \u1ea3nh.", "Image": "H\u00ecnh \u1ea3nh", "Insert image": "Ch\u00e8n h\u00ecnh \u1ea3nh", "Select image layout": "Ch\u1ecdn b\u1ed1 c\u1ee5c h\u00ecnh \u1ea3nh", "Center &amp; fill": "L\u1ea5p \u0111\u1ea7y &amp; \u1edf gi\u1eefa", "Fit": "V\u1eeba kh\u00edt", "Stretch": "D\u00e3n h\u1ebft c\u1ee1", "Options": "T\u00f9y ch\u1ecdn", "Image options": "T\u00f9y ch\u1ecdn h\u00ecnh \u1ea3nh", "Image quality": "Ch\u1ea5t l\u01b0\u1ee3ng h\u00ecnh \u1ea3nh", "Original": "G\u1ed1c", "High": "Cao", "Normal": "Th\u01b0\u1eddng", "Low": "Th\u1ea5p", "Proportional resize": "Thay \u0111\u1ed5i k\u00edch c\u1ee1 theo t\u1ec9 l\u1ec7", "Set box to image original size": "\u0110\u1eb7t v\u00f9ng \u0111\u1ed1i t\u01b0\u1ee3ng theo k\u00edch c\u1ee1 g\u1ed1c", "Disk": "\u0110\u0129a", "Supported image file types:": "C\u00e1c lo\u1ea1i t\u1eadp tin h\u00ecnh \u1ea3nh \u0111\u01b0\u1ee3c h\u1ed7 tr\u1ee3:", "Select image file from disk (max size %s):": "Ch\u1ecdn t\u1eadp tin h\u00ecnh \u1ea3nh t\u1eeb \u0111\u0129a (k\u00edch c\u1ee1 t\u1ed1i \u0111a %s):", "Browse...": "Duy\u1ec7t...", "Image quality:": "Ch\u1ea5t l\u01b0\u1ee3ng h\u00ecnh \u1ea3nh:", "Insert image URL link:": "Ch\u00e8n li\u00ean k\u1ebft URL c\u1ee7a h\u00ecnh \u1ea3nh:", "Image description:": "M\u00f4 t\u1ea3 h\u00ecnh \u1ea3nh:", "Please insert image description.": "Vui l\u00f2ng ch\u00e8n m\u00f4 t\u1ea3 cho h\u00ecnh \u1ea3nh.", "Image description is too short.": "M\u00f4 t\u1ea3 h\u00ecnh \u1ea3nh qu\u00e1 ng\u1eafn.", "No file selected.": "Kh\u00f4ng c\u00f3 t\u1eadp tin n\u00e0o \u0111\u01b0\u1ee3c ch\u1ecdn.", "Please insert a link.": "Vui l\u00f2ng ch\u00e8n m\u1ed9t li\u00ean k\u1ebft.", "An unexpected error occurred. Please try again.": "C\u00f3 l\u1ed7i kh\u00f4ng mong mu\u1ed1n x\u1ea3y ra. Vui l\u00f2ng th\u1eed l\u1ea1i.", "There was an error during server image resize.": "C\u00f3 l\u1ed7i trong khi m\u00e1y ch\u1ee7 thay \u0111\u1ed5i k\u00edch c\u1ee1 h\u00ecnh \u1ea3nh.", "Loading...": "\u0110ang n\u1ea1p...", "Could not interpret the content as image.": "Kh\u00f4ng th\u1ec3 bi\u00ean d\u1ecbch n\u1ed9i dung th\u00e0nh h\u00ecnh \u1ea3nh.", "File extension not valid.": "Ph\u1ea7n m\u1edf r\u1ed9ng c\u1ee7a t\u1eadp tin kh\u00f4ng h\u1ee3p l\u1ec7.", "File too big (max size: %s).": "T\u1eadp tin qu\u00e1 l\u1edbn (k\u00edch c\u1ee1 t\u1ed1i \u0111a: %s).", "Error in reading the response from the server": "L\u1ed7i khi \u0111\u1ecdc k\u1ebft qu\u1ea3 tr\u1ea3 v\u1ec1 t\u1eeb m\u00e1y ch\u1ee7", "Method %s does not exist on %s.": "Kh\u00f4ng t\u1ed3n t\u1ea1i ph\u01b0\u01a1ng ph\u00e1p %s tr\u00ean %s.", "Input not defined": "D\u1eef li\u1ec7u \u0111\u1ea7u v\u00e0o kh\u00f4ng x\u00e1c \u0111\u1ecbnh.", "Image file type cannot be resized.": "Kh\u00f4ng th\u1ec3 thay \u0111\u1ed5i k\u00edch c\u1ee1 c\u1ee7a lo\u1ea1i t\u1eadp tin.", "File is not a supported image.": "T\u1eadp tin kh\u00f4ng ph\u1ea3i l\u00e0 lo\u1ea1i h\u00ecnh \u1ea3nh \u0111\u01b0\u1ee3c h\u1ed7 tr\u1ee3.", "File is not recognized as valid image.": "T\u1eadp tin kh\u00f4ng \u0111\u01b0\u1ee3c nh\u1eadn d\u1ea1ng l\u00e0 h\u00ecnh \u1ea3nh h\u1ee3p l\u1ec7.", "File is too big.": "T\u1eadp tin qu\u00e1 l\u1edbn.", "Error during loading of the image.": "L\u1ed7i khi n\u1ea1p h\u00ecnh \u1ea3nh.", "Too many \"%s\" boxes (limit: %s).": "Qu\u00e1 nhi\u1ec1u v\u00f9ng \u0111\u1ed1i t\u01b0\u1ee3ng \"%s\" (gi\u1edbi h\u1ea1n: %s).", "Too many total boxes (limit: %s).": "T\u1ed5ng s\u1ed1 v\u00f9ng \u0111\u1ed1i t\u01b0\u1ee3ng qu\u00e1 nhi\u1ec1u (gi\u1edbi h\u1ea1n: %s).", "Unexpected error: could not finalize box style.": "L\u1ed7i kh\u00f4ng mong mu\u1ed1n: kh\u00f4ng th\u1ec3 ho\u00e0n ch\u1ec9nh ki\u1ec3u v\u00f9ng \u0111\u1ed1i t\u01b0\u1ee3ng.", "Background": "N\u1ec1n", "Set selected box as background": "\u0110\u1eb7t v\u00f9ng \u0111\u1ed1i t\u01b0\u1ee3ng \u0111\u01b0\u1ee3c ch\u1ecdn l\u00e0m n\u1ec1n", "Unset box from background": "B\u1ecf v\u00f9ng \u0111\u1ed1i t\u01b0\u1ee3ng kh\u1ecfi n\u1ec1n", "Arrange": "S\u1eafp x\u1ebfp", "Arrange box": "S\u1eafp x\u1ebfp v\u00f9ng \u0111\u1ed1i t\u01b0\u1ee3ng", "Bring to front": "\u0110\u01b0a l\u00ean tr\u00ean c\u00f9ng", "Send to back": "\u0110\u1ea9y xu\u1ed1ng d\u01b0\u1edbi c\u00f9ng", "Bring forward": "\u0110\u01b0a l\u00ean tr\u01b0\u1edbc", "Send backward": "\u0110\u1ea9y ra sau", "Editing": "Ch\u1ec9nh s\u1eeda", "Duplicate": "Nh\u00e2n b\u1ea3n", "Duplicate selected box": "Nh\u00e2n b\u1ea3n v\u00f9ng \u0111\u1ed1i t\u01b0\u1ee3ng \u0111\u01b0\u1ee3c ch\u1ecdn", "Delete selected box": "X\u00f3a v\u00f9ng \u0111\u1ed1i t\u01b0\u1ee3ng \u0111\u01b0\u1ee3c ch\u1ecdn", "Flip": "L\u1eadt", "Vertical": "D\u1ecdc", "Flip selected box vertically": "L\u1eadt v\u00f9ng \u0111\u1ed1i t\u01b0\u1ee3ng \u0111\u01b0\u1ee3c ch\u1ecdn theo chi\u1ec1u d\u1ecdc", "Horizontal": "Ngang", "Flip selected box horizontally": "L\u1eadt v\u00f9ng \u0111\u1ed1i t\u01b0\u1ee3ng \u0111\u01b0\u1ee3c ch\u1ecdn theo chi\u1ec1u ngang", "Select background color": "Ch\u1ecdn m\u00e0u n\u1ec1n", "Opacity": "\u0110\u1ed9 m\u1edd", "Box opacity": "\u0110\u1ed9 m\u1edd c\u1ee7a v\u00f9ng \u0111\u1ed1i t\u01b0\u1ee3ng", "Select box opacity": "Ch\u1ecdn \u0111\u1ed9 m\u1edd c\u1ee7a v\u00f9ng \u0111\u1ed1i t\u01b0\u1ee3ng", "Select background opacity": "Ch\u1ecdn \u0111\u1ed9 m\u1edd c\u1ee7a n\u1ec1n", "Background opacity": "\u0110\u1ed9 m\u1edd c\u1ee7a n\u1ec1n", "Border": "Vi\u1ec1n", "Select border style": "Ch\u1ecdn ki\u1ec3u vi\u1ec1n", "Select border color": "Ch\u1ecdn m\u00e0u vi\u1ec1n", "Select border width": "Ch\u1ecdn \u0111\u1ed9 r\u1ed9ng vi\u1ec1n", "Width": "\u0110\u1ed9 r\u1ed9ng", "Corners": "C\u00e1c g\u00f3c", "Top left corner": "G\u00f3c tr\u00ean c\u00f9ng b\u00ean tr\u00e1i", "Top right corner": "G\u00f3c tr\u00ean c\u00f9ng b\u00ean ph\u1ea3i", "Bottom left corner": "G\u00f3c d\u01b0\u1edbi c\u00f9ng b\u00ean tr\u00e1i", "Bottom right corner": "G\u00f3c d\u01b0\u1edbi c\u00f9ng b\u00ean ph\u1ea3i", "Rounded corners": "C\u00e1c g\u00f3c \u0111\u01b0\u1ee3c bo tr\u00f2n", "Radius": "B\u00e1n k\u00ednh", "Unexpected error: box has no content.": "L\u1ed7i kh\u00f4ng mong mu\u1ed1n: v\u00f9ng \u0111\u1ed1i t\u01b0\u1ee3ng kh\u00f4ng c\u00f3 n\u1ed9i dung.", "Box type not supplied during registration.": "Lo\u1ea1i v\u00f9ng \u0111\u1ed1i t\u01b0\u1ee3ng kh\u00f4ng \u0111\u01b0\u1ee3c cung c\u1ea5p khi \u0111\u0103ng k\u00fd.", "Video": "Video", "Click %s to insert text.": "B\u1ea5m %s \u0111\u1ec3 ch\u00e8n v\u0103n b\u1ea3n.", "Insert\/edit text": "Ch\u00e8n\/ch\u1ec9nh s\u1eeda v\u0103n b\u1ea3n", "Text alignment": "Canh l\u1ec1 v\u0103n b\u1ea3n", "Done": "Xong", "Done editing": "Ch\u1ec9nh s\u1eeda xong", "Font": "Font", "Bold": "\u0110\u1eadm", "Italic": "Nghi\u00eang", "Underline": "G\u1ea1ch ch\u00e2n", "Select font size": "Ch\u1ecdn k\u00edch c\u1ee1 font", "Select font color": "Ch\u1ecdn m\u00e0u font", "Increase font size": "T\u0103ng k\u00edch c\u1ee1 font", "Decrease font size": "Gi\u1ea3m k\u00edch c\u1ee1 font", "Text length exceeds the maximum limit.": "\u0110\u1ed9 d\u00e0i v\u0103n b\u1ea3n v\u01b0\u1ee3t qu\u00e1 gi\u1edbi h\u1ea1n t\u1ed1i \u0111a.", "Plain text.": "V\u0103n b\u1ea3n thu\u1ea7n.", "Formatted text.": "V\u0103n b\u1ea3n \u0111\u01b0\u1ee3c \u0111\u1ecbnh d\u1ea1ng.", "Paste text": "D\u00e1n v\u0103n b\u1ea3n", "Click %s to insert video.": "B\u1ea5m %s \u0111\u1ec3 ch\u00e8n \u0111o\u1ea1n video.", "Insert video": "Ch\u00e8n \u0111o\u1ea1n video", "Play video": "Ph\u00e1t \u0111o\u1ea1n video", "Pause video": "T\u1ea1m d\u1eebng \u0111o\u1ea1n video", "Show video": "Hi\u1ec3n th\u1ecb \u0111o\u1ea1n video", "Close video": "\u0110\u00f3ng \u0111o\u1ea1n video", "Please provide a valid link\/embed code for any of the supported video services.": "Vui l\u00f2ng cung c\u1ea5p m\u1ed9t li\u00ean k\u1ebft\/m\u00e3 nh\u00fang h\u1ee3p l\u1ec7 cho b\u1ea5t k\u1ef3 lo\u1ea1i d\u1ecbch v\u1ee5 video \u0111\u01b0\u1ee3c h\u1ed7 tr\u1ee3 n\u00e0o.", "Could not interpret the content as video.": "Kh\u00f4ng th\u1ec3 bi\u00ean d\u1ecbch n\u1ed9i dung th\u00e0nh video.", "Insert video embed code or url:": "Ch\u00e8n m\u00e3 nh\u00fang ho\u1eb7c url c\u1ee7a \u0111o\u1ea1n video:", "Select video from the list of available videos:": "Ch\u1ecdn \u0111o\u1ea1n video t\u1eeb danh s\u00e1ch c\u00e1c \u0111o\u1ea1n video c\u00f3 s\u1eb5n:", "Add %s box": "Th\u00eam v\u00f9ng \u0111\u1ed1i t\u01b0\u1ee3ng %s", "Set as background": "\u0110\u1eb7t l\u00e0m n\u1ec1n", "Unset from background": "B\u1ecf kh\u1ecfi n\u1ec1n", "Error in generating unique id.": "L\u1ed7i t\u1ea1o id ri\u00eang", "Improper internal call.": "Cu\u1ed9c g\u1ecdi n\u1ed9i b\u1ed9 kh\u00f4ng ph\u00f9 h\u1ee3p", "Please insert a value.": "Vui l\u00f2ng ch\u00e8n m\u1ed9t gi\u00e1 tr\u1ecb.", "Browser does not support required feature \"%s\".": "Tr\u00ecnh duy\u1ec7t kh\u00f4ng h\u1ed7 tr\u1ee3 t\u00ednh n\u0103ng \"%s\" \u0111\u01b0\u1ee3c y\u00eau c\u1ea7u.", "Could not initialize %s. Container not found.": "Kh\u00f4ng th\u1ec3 k\u00edch ho\u1ea1t %s. Kh\u00f4ng t\u00ecm th\u1ea5y \u0111\u1ed1i t\u01b0\u1ee3ng ch\u1ee9a.", "Box type \"%s\" doesn't exist.": "Lo\u1ea1i v\u00f9ng \u0111\u1ed1i t\u01b0\u1ee3ng \"%s\" kh\u00f4ng t\u1ed3n t\u1ea1i.", "Error during box creation: %s.": "L\u1ed7i trong khi t\u1ea1o v\u00f9ng \u0111\u1ed1i t\u01b0\u1ee3ng: %s.", "Saving content.": "\u0110ang l\u01b0u n\u1ed9i dung.", "Please wait...": "Vui l\u00f2ng \u0111\u1ee3i...", "Removed box. Box type \"%s\" not supported.": "V\u00f9ng \u0111\u1ed1i t\u01b0\u1ee3ng \u0111\u00e3 \u0111\u01b0\u1ee3c lo\u1ea1i b\u1ecf. Lo\u1ea1i v\u00f9ng \u0111\u1ed1i t\u01b0\u1ee3ng \"%s\" kh\u00f4ng \u0111\u01b0\u1ee3c h\u1ed7 tr\u1ee3.", "This is a %s feature.": "\u0110\u00e2y l\u00e0 t\u00ednh n\u0103ng %s.", "For information, please visit %s.": "\u0110\u1ec3 bi\u1ebft th\u00f4ng tin, vui l\u00f2ng truy c\u1eadp %s.", "Box size and position": "K\u00edch c\u1ee1 v\u00e0 v\u1ecb tr\u00ed v\u00f9ng \u0111\u1ed1i t\u01b0\u1ee3ng.", "Size": "K\u00edch c\u1ee1", "Box": "V\u00f9ng \u0111\u1ed1i t\u01b0\u1ee3ng", "SEO and grouping tags": "C\u00e1c th\u1ebb SEO v\u00e0 t\u1ea1o nh\u00f3m", "Additional audio services:": "C\u00e1c d\u1ecbch v\u1ee5 \u00e2m thanh b\u1ed5 sung:", "Supported in %s:": "\u0110\u01b0\u1ee3c h\u1ed7 tr\u1ee3 trong %s:", "Current color:": "M\u00e0u hi\u1ec7n t\u1ea1i:", "Click on the \"%s\" button to start creating content for extra small layouts.": "B\u1ea5m v\u00e0o n\u00fat \"%s\" \u0111\u1ec3 b\u1eaft \u0111\u1ea7u t\u1ea1o n\u1ed9i dung cho c\u00e1c b\u1ed1 c\u1ee5c si\u00eau nh\u1ecf.", "Start responsive design": "B\u1eaft \u0111\u1ea7u thi\u1ebft k\u1ebf t\u1ef1 co d\u00e3n theo k\u00edch th\u01b0\u1edbc m\u00e0n h\u00ecnh", "Snap boxes to": "\u0110\u00ednh c\u00e1c v\u00f9ng \u0111\u1ed1i t\u01b0\u1ee3ng v\u00e0o", "Page": "Trang", "Boxes": "C\u00e1c v\u00f9ng \u0111\u1ed1i t\u01b0\u1ee3ng", "Content link": "Li\u00ean k\u1ebft n\u1ed9i dung", "Content": "N\u1ed9i dung", "Set content width": "\u0110\u1eb7t \u0111\u1ed9 r\u1ed9ng n\u1ed9i dung", "Set content height": "\u0110\u1eb7t \u0111\u1ed9 cao n\u1ed9i dung", "Edit": "Ch\u1ec9nh s\u1eeda", "Undo modifications": "Ho\u00e0n t\u00e1c c\u00e1c s\u1eeda \u0111\u1ed5i", "Undo": "Ho\u00e0n t\u00e1c", "Redo modifications": "L\u00e0m l\u1ea1i c\u00e1c s\u1eeda \u0111\u1ed5i", "Redo": "L\u00e0m l\u1ea1i", "Clear all": "X\u00f3a s\u1ea1ch t\u1ea5t c\u1ea3", "Basic": "C\u01a1 b\u1ea3n", "Media embed": "Nh\u00fang \u0111a ph\u01b0\u01a1ng ti\u1ec7n", "Advanced": "N\u00e2ng cao", "Add box:": "Th\u00eam v\u00f9ng \u0111\u1ed1i t\u01b0\u1ee3ng:", "Click to set Hex color": "B\u1ea5m \u0111\u1ec3 \u0111\u1eb7t m\u00e0u Hex", "Click to set RGB color": "B\u1ea5m \u0111\u1ec3 \u0111\u1eb7t m\u00e0u RBG", "Solid color": "M\u00e0u \u0111\u01a1n s\u1eafc", "Horiz. gradient": "Gi\u1ea3m t\u00f4ng m\u00e0u theo chi\u1ec1u ngang", "Vert. gradient": "Gi\u1ea3m t\u00f4ng m\u00e0u theo chi\u1ec1u d\u1ecdc", "Radial gradient": "Gi\u1ea3m t\u00f4ng m\u00e0u t\u1ecfa tr\u00f2n", "Select color opacity": "Ch\u1ecdn \u0111\u1ed9 m\u1edd c\u1ee7a m\u00e0u", "Set custom color (Hex)": "\u0110\u1eb7t m\u00e0u t\u00f9y ch\u1ec9nh (Hex)", "Please enter the color in hex format, e.g. %s": "Vui l\u00f2ng nh\u1eadp v\u00e0o m\u00e0u \u1edf \u0111\u1ecbnh d\u1ea1ng hex, v\u00ed d\u1ee5 %s", "You must enter a color.": "B\u1ea1n ph\u1ea3i nh\u1eadp v\u00e0o m\u1ed9t m\u00e0u.", "Set custom color (RGB)": "\u0110\u1eb7t m\u00e0u t\u00f9y ch\u1ec9nh (RBG)", "Please enter the color in RGB format, with comma-separated components, e.g. %s": "Vui l\u00f2ng nh\u1eadp v\u00e0o m\u00e0u \u1edf \u0111\u1ecbnh d\u1ea1ng RBG, ng\u0103n c\u00e1ch c\u00e1c ph\u1ea7n b\u1eb1ng d\u1ea5u ph\u1ea9y, v\u00ed d\u1ee5 %s"
    }
);
Zedity.i18n.add('zh', {
        "%s needs %s.": "%s \u9700\u8981 %s.", "Click %s to insert a document.": "\u9ede\u64ca%s\u63d2\u5165\u4e00\u500b\u6587\u4ef6\u3002", "Document": "\u6587\u4ef6", "Insert": "\u63d2\u5165", "Insert document": "\u63d2\u5165\u6587\u4ef6", "Read": "\u8b80\u53d6", "Read document": "\u8b80\u53d6\u6587\u4ef6", "Close": "\u95dc\u9589", "Close document": "\u95dc\u9589\u6587\u4ef6", "Could not interpret the content as document.": "\u7121\u6cd5\u89e3\u6790\u7684\u5167\u5bb9\u7684\u6587\u4ef6\u3002", "%s can't be rotated.": "%s\u4e0d\u80fd\u65cb\u8f49\u3002", "%s doesn't support background property.": "%s\u4e0d\u652f\u6301\u80cc\u666f\u5c6c\u6027\u3002", "%s doesn't support rounded corners.": "%s\u4e0d\u652f\u6301\u5713\u89d2\u3002", "%s doesn't support flipping.": "%s\u4e0d\u652f\u6301\u7ffb\u8f49\u3002", "Embed": "\u5d4c\u5165", "Insert document embed code or url:": "\u63d2\u5165\u6587\u4ef6\u4ee3\u78bc\u6216\u7db2\u5740\u5d01\u5165\uff1a", "Supported services:": "\u652f\u6301\u7684\u670d\u52d9", "Supported documents:": "\u652f\u6301\u7684\u6587\u4ef6", "PDF documents, Microsoft Office documents, Apple Pages, Adobe Photoshop and Illustrator, and more.": "PDF\u6a94\uff0cMS Office\u6a94\uff0cApple\u7db2\u9801\uff0cAdobe Photoshop\u548cIllustrator,\u7b49\u7b49", "OK": "\u78ba\u5b9a", "Cancel": "\u53d6\u6d88", "Click %s to insert HTML.": "\u9ede\u64ca%s\u63d2\u5165HTML", "Html": "HTML", "Insert HTML": "\u63d2\u5165HTML", "View": "\u67e5\u770b", "View box content": "\u67e5\u770b\u6846\u6846\u5167\u5bb9", "Insert HTML code:": "\u63d2\u5165HTML\u4ee3\u78bc", "Safe mode:": "\u5b89\u5168\u6a21\u5f0f", "Automatic": "\u81ea\u52d5", "Enabled": "\u555f\u7528", "Disabled": "\u7981\u7528", "If you insert Javascript or CSS code and you get unexpected effects (e.g. content overflow, etc.) you need to enable safe mode.": "\u5982\u679c\u63d2\u5165Javascript\u6216CSS\u4ee3\u78bc\uff0c\u4f60\u6703\u5f97\u5230\u610f\u60f3\u4e0d\u5230\u7684\u6548\u679c(\u4f8b\u5982\u5167\u5bb9\u6ea2\u4f4d,\u7b49) \u60a8\u9700\u8981\u555f\u7528\u5b89\u5168\u6a21\u5f0f", "The (default) automatic setting enables safe mode only if Javascript is detected.": "\uff08\u9ed8\u8a8d\uff09\u81ea\u52d5\u8a2d\u7f6e\u5b89\u5168\u6a21\u5f0f\u6aa2\u6e2c\u5230\u4f7f\u7528Javascript\u6642", "Some scripts (for example social network services) need to access the page, so the \"Safe mode\" must be disabled in these cases.": "\u4e00\u4e9b\u8173\u672c\uff08\u4f8b\u5982\u793e\u4ea4\u7db2\u7d61\u670d\u52d9\uff09\u9700\u8981\u8a2a\u554f\u8a72\u9801\u9762 \"Safe mode\"\u5fc5\u9808\u5728\u9019\u60c5\u6cc1\u4e0b\u7981\u7528", "Inserting a %s content into an HTML box is not supported at the moment.": "\u4e0d\u652f\u63f4\u5728HTML\u6846\u6846\u4e2d\u63d2\u5165%s", "Filters": "\u904e\u6ffe\u5668", "Apply image filters": "\u5141\u8a31\u5716\u50cf\u904e\u6ffe\u5668", "Adjust colors": "\u8abf\u6574\u984f\u8272", "Black &amp; white": "\u9ed1 &amp; \u767d", "Blur": "\u6a21\u7cca", "Brightness": "\u4eae\u5ea6", "Contrast": "\u5c0d\u6bd4", "Emboss": "\u6d6e\u96d5", "Grayscale": "\u7070\u968e", "Invert": "\u53cd\u76f8", "Mosaic": "\u99ac\u8cfd\u514b", "Motion blur": "\u52d5\u614b\u6a21\u7cca", "Noise": "\u566a\u97f3\u96dc\u8a0a", "Paint": "\u6cb9\u6f06", "Posterize": "\u8272\u8abf\u5206\u96e2", "Psychedelia": "\u8ff7\u5e7b\u8272", "Sepia": "\u68d5\u8910\u8272", "Sharpen": "\u92b3\u5316", "Vignette": "\u5c0f\u63d2\u5716", "Apply filter": "\u61c9\u7528\u904e\u6ffe\u5668", "Reset filter": "\u91cd\u8a2d\u904e\u6ffe\u5668", "Remove all filters": "\u79fb\u9664\u6240\u6709\u904e\u6ffe\u5668", "Error applying filter \"%s\".": "\u932f\u8aa4\u7684\u61c9\u7528\u904e\u6ffe\u5668\"%s\".", "Filter \"%s\" not defined.": "\u904e\u6ffe\u5668\"%s\"\u7121\u6cd5\u5b9a\u7fa9", "Could not read image data. Filters cannot be applied on images hosted on a different domain.": "\u7121\u6cd5\u8b80\u53d6\u5716\u7247\u6578\u64da\u3002\u904e\u6ffe\u5668\u4e0d\u80fd\u5c0d\u5728\u4e0d\u540c\u7db2\u57df\u4e3b\u6a5f\u5716\u7247\u61c9\u7528", "Percent": "\u767e\u5206\u6bd4", "Adjustment": "\u8abf\u6574", "Threshold": "\u7bc4\u570d\u503c", "Red": "\u7d05\u8272", "Green": "\u7da0\u8272", "Blue": "\u85cd\u8272", "Amount": "\u6578\u91cf", "Block size": "\u5340\u584a\u5c3a\u5bf8", "Type": "\u985e\u578b", "Strength": "\u5f37\u5ea6", "Brush size": "\u756b\u7b46\u5927\u5c0f", "Link": "\u9023\u7d50", "Add link to box": "\u65b0\u589e\u9023\u7d50\u6846\u6846", "This link will be associated to the whole box.": "\u6b64\u9023\u7d50\u5c07\u95dc\u806f\u5230\u6574\u500b\u6846\u3002", "Insert link url:": "\u63d2\u5165\u9023\u7d50", "Align": "\u5c0d\u9f4a", "Align to page": "\u5c0d\u9f4a\u9801\u9762", "Left": "\u81f3\u5de6", "Center": "\u81f3\u4e2d\u5fc3", "Right": "\u81f3\u53f3", "Top": "\u9802\u90e8", "Middle": "\u4e2d\u9593", "Bottom": "\u5e95\u90e8", "Fit width": "\u9069\u5408\u5bec\u5ea6", "Fit height": "\u9069\u5408\u9ad8\u5ea6", "Keep aspect ratio": "\u4fdd\u6301\u986f\u793a\u6bd4\u4f8b", "Select box padding": "\u9078\u64c7\u6846\u6846\u586b\u5145", "Padding": "\u586b\u5145", "Shadow": "\u9670\u5f71", "No shadow": "\u6c92\u6709\u9670\u5f71", "Shadow at bottom right": "\u9670\u5f71\u5728\u53f3\u4e0b\u89d2", "Shadow at bottom left": "\u9670\u5f71\u5728\u5de6\u4e0b\u89d2", "Shadow at top right": "\u9670\u5f71\u5728\u53f3\u4e0a\u89d2", "Shadow at top left": "\u9670\u5f71\u5728\u5de6\u4e0a\u89d2", "Diffuse shadow": "\u64f4\u6563\u9670\u5f71", "Color": "\u984f\u8272", "Box shadow": "\u6846\u6846\u9670\u5f71", "Horizontal position": "\u6c34\u5e73\u4f4d\u7f6e", "Select shadow horizontal position": "\u9078\u64c7\u9670\u5f71\u6c34\u5e73\u4f4d\u7f6e", "Vertical position": "\u5782\u76f4\u4f4d\u7f6e", "Select shadow vertical position": "\u9078\u64c7\u9670\u5f71\u5782\u76f4\u4f4d\u7f6e", "Select shadow blur": "\u9078\u64c7\u9670\u5f71\u6a21\u7cca", "Spread": "\u5c55\u958b", "Select shadow spread": "\u9078\u64c7\u9670\u5f71\u5c55\u958b", "Inset": "\u63d2\u5165", "Shadow inset": "\u9670\u5f71\u63d2\u5165", "Text": "\u6587\u672c", "Paragraph": "\u6bb5\u843d", "Heading": "\u6a19\u984c", "Align left": "\u5c0d\u9f4a\u5de6\u908a", "Align center": "\u5c0d\u9f4a\u4e2d\u5fc3", "Align right": "\u5c0d\u9f4a\u53f3\u908a", "Justify": "\u5de6\u53f3\u8cbc\u9f4a", "Ordered list": "\u6709\u5e8f\u5217\u8868", "Unordered list": "\u7121\u5e8f\u5217\u8868", "Indent": "\u589e\u52a0\u7e2e\u6392", "Outdent": "\u6e1b\u5c11\u7e2e\u6392", "Subscript": "\u4e0b\u6a19", "Superscript": "\u4e0a\u6a19", "Open link in the same tab.": "\u5728\u540c\u4e00\u5206\u9801\u958b\u555f\u9023\u7d50", "Open link in a new tab.": "\u5728\u65b0\u5206\u9801\u958b\u555f\u9023\u7d50", "Link style preview": "\u9810\u89bd\u9023\u7d50\u6a23\u5f0f", "Link style": "\u9023\u7d50\u6a23\u5f0f", "Link style on mouse over": "\u5728\u6ed1\u9f20\u7684\u9023\u7d50\u6a23\u5f0f", "Insert link": "\u63d2\u5165\u9023\u7d50", "Remove": "\u79fb\u9664", "The box link may override any link in the text.": "\u6846\u9023\u7d50\u53ef\u80fd\u6703\u8986\u84cb\u5230\u6587\u672c\u4e2d\u7684\u4efb\u4f55\u9023\u7d50", "Align top": "\u5c0d\u9f4a\u9802\u90e8", "Align middle": "\u5c0d\u9f4a\u4e2d\u9593", "Align bottom": "\u5c0d\u9f4a\u5e95\u90e8", "Extra small layout": "\u7279\u5c0f\u865f\u7248\u9762", "Small layout": "\u5c0f\u7248\u9762", "Medium layout": "\u4e2d\u7248\u9762", "Large layout": "\u5927\u7248\u9762", "If you perform this action you will revert to a non-responsive design. Are you sure?": "\u5982\u679c\u57f7\u884c\u9019\u7a2e\u64cd\u4f5c\uff0c\u60a8\u6703\u6062\u5fa9\u5230\u7121\u81ea\u9069\u7684\u8a2d\u8a08\u3002\u60a8\u78ba\u5b9a\u55ce?", "You can start your design from any layout.": "\u60a8\u53ef\u4ee5\u5f9e\u4efb\u4f55\u7248\u9762\u958b\u59cb\u8a2d\u8a08\u3002", "Boxes can be added in any layout and can be modified only in the layout they were added to.": "\u6846\u6846\u53ef\u4ee5\u88ab\u65b0\u589e\u5230\u4efb\u4f55\u7248\u9762\u4e26\u4e14\u80fd\u4fee\u6539\u7248\u9762", "Boxes added in a layout can be hidden in other layouts.": "\u5728\u7248\u9762\u4e2d\u6dfb\u52a0\u7684\u7bb1\u5b50\u53ef\u4ee5\u96b1\u85cf\u5728\u5176\u4ed6\u7684\u7248\u9762", "Custom layouts:": "\u81ea\u5b9a\u7fa9\u7248\u9762\uff1a", "Add custom layout": "\u65b0\u589e\u81ea\u5b9a\u7fa9\u7248\u9762", "Multiple layout responsive design": "\u591a\u91cd\u7248\u9762\u81ea\u9069\u8a2d\u8a08", "The width of custom layouts can be adjusted to fit larger designs.": "\u81ea\u5b9a\u7fa9\u7684\u7248\u9762\u5bec\u5ea6\u53ef\u4ee5\u8abf\u6574\uff0c\u4ee5\u9069\u61c9\u8f03\u5927\u7684\u8a2d\u8a08", "Click on a layout button to start creating content for that layout.": "\u9ede\u64ca\u7248\u9762\u6309\u9215\uff0c\u958b\u59cb\u5275\u5efa\u8a72\u7248\u9762\u7684\u5167\u5bb9", "Save": "\u5b58\u6a94", "Abort": "\u653e\u68c4", "You may want to review the design for layouts in yellow.": "\u60a8\u53ef\u80fd\u8981\u9810\u89bd\u9ec3\u8272\u7248\u9762\u8a2d\u8a08", "Save without reviewing": "\u5b58\u6a94\u800c\u4e0d\u9810\u89bd", "Please click on the layouts in gray to provide the design for all layouts.": "\u8acb\u9ede\u64ca\u7070\u8272\u7684\u7248\u9762\u8a2d\u8a08\u4ee5\u63d0\u4f9b\u6240\u6709\u7248\u9762", "Save anyway (not recommended)": "\u4efb\u4f55\u65b9\u5f0f\u5b58\u6a94\uff08\u4e0d\u63a8\u85a6\uff09", "Your responsive content is ready to be saved!": "\u60a8\u7684\u81ea\u9069\u5167\u5bb9\u5df2\u88ab\u5b58\u6a94\uff01", "This box was created in another layout.": "\u6b64\u6846\u6846\u662f\u7531\u53e6\u4e00\u500b\u7248\u9762\u6240\u5275\u5efa", "To modify its content edit the layout \"%s\".": "\u7248\u9762\u7de8\u8f2f\"%s\"\u53bb\u4fee\u6539\u5176\u5167\u5bb9", "The box is hidden in this layout.": "\u9019\u6846\u6846\u96b1\u85cf\u65bc\u7248\u9762\u4e2d", "Show box": "\u986f\u793a\u6846\u6846", "Edit box": "\u7de8\u8f2f\u6846\u6846", "Show": "\u986f\u793a", "Hide": "\u96b1\u85cf", "Hide box in this layout": "\u5728\u7576\u524d\u7248\u9762\u96b1\u85cf\u6846\u6846", "This link will be associated to the whole %s content.": "\u9019\u500b\u9023\u7d50\u5c07\u88ab\u95dc\u806f\u5230\u6574\u500b%s\u5167\u5bb9\u3002", "Grid": "\u683c\u5b50", "Width:": "\u5bec\u5ea6\uff1a", "Height:": "\u9ad8\u5ea6\uff1a", "Templates": "\u6a21\u677f", "New Template": "\u4fdd\u5b58\u7576\u524d\u5167\u5bb9\u6a21\u677f", "Load selected Template into editor": "\u52a0\u8f09\u6240\u9078\u6a21\u677f\u5230\u7de8\u8f2f\u5668", "Load": "\u8b80\u53d6", "Delete selected Template": "\u522a\u9664\u6240\u9078\u6a21\u677f", "Delete": "\u522a\u9664", "An error occurred while saving the Template. Please try again.": "\u5728\u4fdd\u5b58\u6a21\u677f\u6642\u767c\u751f\u932f\u8aa4\u3002\u8acb\u91cd\u8a66", "Template \"%s\" saved.": "\u6a21\u677f\"%s\"\u5df2\u5b58\u6a94", "The current content will overwrite the selected Template. Are you sure?": "\u7576\u524d\u7684\u5167\u5bb9\u5c07\u8986\u84cb\u6240\u9078\u6a21\u677f\u3002\u60a8\u78ba\u5b9a\u55ce\uff1f", "Give a title to your Template:": "\u7d66\u60a8\u7684\u6a21\u677f\u4e00\u500b\u6a19\u984c:", "A Template with that title already exists, please change the title.": "\u6a21\u677f\u7684\u6a19\u984c\u5df2\u7d93\u5b58\u5728\uff0c\u8acb\u66f4\u6539\u6a19\u984c", "The Template will overwrite the current editor content. Are you sure?": "\u6a21\u677f\u5c07\u8986\u84cb\u7576\u524d\u7de8\u8f2f\u5668\u7684\u5167\u5bb9\u3002\u60a8\u78ba\u5b9a\u55ce\uff1f", "An error occurred while loading the Template. Please try again.": "\u5728\u8b80\u53d6\u6a21\u677f\u6642\u767c\u751f\u932f\u8aa4\uff0c\u8acb\u91cd\u65b0\u5617\u8a66", "Template \"%s\" loaded.": "\u6a21\u677f\"%s\"\u5df2\u8b80\u53d6", "Are you sure you want to delete the selected Template?": "\u8981\u522a\u9664\u9078\u5b9a\u7684\u6a21\u677f\u55ce\uff1f", "An error occurred while deleting the Template. Please try again.": "\u5728\u522a\u9664\u6a21\u677f\u6642\u767c\u751f\u932f\u8aa4\uff0c\u8acb\u91cd\u65b0\u5617\u8a66", "Click %s to insert audio.": "\u9ede\u64ca%s\u63d2\u5165\u97f3\u6548", "Audio": "\u8072\u97f3", "Insert audio": "\u63d2\u5165\u97f3\u6548", "Play": "\u64a5\u653e", "Play audio": "\u64a5\u653e\u97f3\u6548", "Pause": "\u66ab\u505c", "Pause audio": "\u66ab\u505c\u97f3\u6548", "Show audio": "\u986f\u793a\u97f3\u6548", "Close audio": "\u95dc\u9589\u97f3\u6548", "Please provide a valid link\/embed code for any of the supported audio services.": "\u8acb\u63d0\u4f9b\u4e00\u500b\u6709\u6548\u7684\u9023\u7d50\/\u6216\u4efb\u4f55\u652f\u6301\u7684\u97f3\u6548\u670d\u52d9\u4ee3\u78bc\u5d4c\u5165", "Could not interpret the content as audio.": "\u7121\u6cd5\u89e3\u6790\u7684\u5167\u5bb9\u7684\u97f3\u6548\u3002", "%s can't be set as background.": "%s \u7121\u6cd5\u8a2d\u5b9a\u70ba\u80cc\u666f", "Files": "\u6a94\u6848", "Insert audio embed code or url:": "\u5c07\u97f3\u6548\u4ee3\u78bc\u6216\u7db2\u5740\u5d4c\u5165\uff1a", "Select audio from the list of available audios:": "\u5f9e\u53ef\u7528\u7684\u97f3\u983b\u5217\u8868\u9078\u64c7\u97f3\u6548\uff1a", "Click %s to add color.": "\u9ede\u64ca%s\u589e\u52a0\u8272\u5f69", "Click %s to insert image.": "\u9ede\u64ca%s\u63d2\u5165\u5716\u7247", "Image": "\u5716\u50cf", "Insert image": "\u63d2\u5165\u5716\u7247", "Center &amp; fill": "\u4e2d\u5fc3 &amp; \u6eff", "Fit": "\u5408\u9069", "Stretch": "\u5ef6\u4f38", "Image options": "\u5716\u7247\u9078\u9805", "Image quality": "\u5716\u50cf\u54c1\u8cea", "Original": "\u539f\u59cb", "High": "\u9ad8", "Normal": "\u6b63\u5e38", "Low": "\u4f4e", "Proportional resize": "\u5927\u5c0f\u8abf\u6574\u6210\u6bd4\u4f8b", "Set box to image original size": "\u8a2d\u7f6e\u6846\u5716\u7247\u539f\u59cb\u5927\u5c0f", "Disk": "\u78c1\u76e4", "Supported image file types:": "\u652f\u6301\u7684\u5716\u7247\u6a94\u6848\u985e\u578b", "Select image file from disk (max size %s):": "\u5f9e\u786c\u789f\u4e2d\u9078\u64c7\u5716\u7247\u6a94\u6848(\u6700\u5927\u5c3a\u5bf8 %s):", "Browse...": "\u700f\u89bd...", "Image quality:": "\u5716\u50cf\u54c1\u8cea\uff1a", "Insert image URL link:": "\u63d2\u5165\u5716\u50cfURL\u9023\u7d50\uff1a", "Image description:": "\u5716\u7247\u8aaa\u660e\uff1a", "Please insert image description.": "\u8acb\u586b\u5165\u5716\u7247\u8aaa\u660e", "Image description is too short.": "\u5716\u7247\u8aaa\u660e\u592a\u77ed", "No file selected.": "\u6a94\u6848\u672a\u88ab\u9078\u64c7\u3002", "Please insert a link.": "\u8acb\u63d2\u5165\u4e00\u500b\u9023\u7d50", "An unexpected error occurred. Please try again.": "\u767c\u751f\u610f\u5916\u932f\u8aa4\u3002\u8acb\u91cd\u8a66", "There was an error during server image resize.": "\u8abf\u6574\u5716\u50cf\u5927\u5c0f\u7684\u904e\u7a0b\u4e2d\u670d\u52d9\u5668\u51fa\u73fe\u932f\u8aa4", "Loading...": "\u8b80\u53d6\u4e2d...", "Could not interpret the content as image.": "\u7121\u6cd5\u89e3\u6790\u7684\u5167\u5bb9\u5716\u50cf", "File extension not valid.": "\u6a94\u6848\u64f4\u5c55\u540d\u7121\u6548", "File too big (max size: %s).": "\u6a94\u6848\u904e\u5927\uff08\u6700\u5927\u5927\u5c0f\uff1a%s\uff09\u3002", "Error in reading the response from the server": "\u4f86\u81ea\u4f3a\u670d\u5668\u56de\u61c9\u95b1\u8b80\u6642\u932f\u8aa4", "Method %s does not exist on %s.": "\u6b64\u65b9\u6cd5%s\u4e0d\u5b58\u5728\u65bc%s", "Input not defined": "\u6b64\u8f38\u5165\u6c92\u6709\u5b9a\u7fa9", "Image file type cannot be resized.": "\u5716\u50cf\u6a94\u6848\u985e\u578b\uff0c\u4e0d\u80fd\u8abf\u6574\u5927\u5c0f", "File is not a supported image.": "\u4e0d\u652f\u6301\u7684\u6a94\u6848\u5716\u50cf\u3002", "File is not recognized as valid image.": "\u6a94\u6848\u7121\u6cd5\u8b58\u5225\u70ba\u6709\u6548\u5716\u50cf", "File is too big.": "\u6a94\u6848\u904e\u5927", "Error during loading of the image.": "\u52a0\u8f09\u5716\u50cf\u904e\u7a0b\u4e2d\u51fa\u932f", "Too many \"%s\" boxes (limit: %s).": "\u904e\u591a\u7684\"%s\"\u6846\u6846\uff08\u9650\u5236\uff1a %s\uff09", "Too many total boxes (limit: %s).": "\u904e\u591a\u7684\u7e3d\u6846\u6846\uff08\u9650\u5236\uff1a %s\uff09", "Unexpected error: could not finalize box style.": "\u610f\u5916\u7684\u932f\u8aa4\uff1a\u7121\u6cd5\u5b8c\u6210\u6846\u6a23\u5f0f", "Background": "\u80cc\u666f", "Arrange": "\u5e03\u7f6e", "Bring to front": "\u5c07\u5716\u7247\u79fb\u7f6e\u6700\u4e0a\u5c64", "Send to back": "\u5c07\u5716\u7247\u79fb\u81f3\u6700\u5e95\u5c64", "Bring forward": "\u5c07\u5716\u7247\u5f80\u524d\u63a8\u4e00\u5c64", "Send backward": "\u5c07\u5716\u7247\u5f80\u5f8c\u63a8\u4e00\u5c64", "Duplicate": "\u8907\u88fd", "Flip": "\u7ffb\u52d5", "Vertical": "\u5782\u76f4", "Horizontal": "\u6c34\u5e73", "Select background color": "\u9078\u64c7\u80cc\u666f\u984f\u8272", "Opacity": "\u900f\u660e\u5ea6", "Box opacity": "\u6846\u6846\u900f\u660e\u5ea6", "Select box opacity": "\u9078\u64c7\u6846\u6846\u900f\u660e\u5ea6", "Select background opacity": "\u9078\u64c7\u80cc\u666f\u900f\u660e\u5ea6", "Background opacity": "\u80cc\u666f\u900f\u660e\u5ea6", "Border": "\u908a\u6846", "Select border style": "\u9078\u64c7\u908a\u6846\u6a23\u5f0f", "Select border width": "\u9078\u64c7\u908a\u6846\u5bec\u5ea6", "Width": "\u5bec\u5ea6", "Corners": "\u908a\u89d2", "Top left corner": "\u5de6\u4e0a\u89d2", "Top right corner": "\u53f3\u4e0a\u89d2", "Bottom left corner": "\u5de6\u4e0b\u89d2", "Bottom right corner": "\u53f3\u4e0b\u89d2", "Rounded corners": "\u5713\u89d2", "Unexpected error: box has no content.": "\u610f\u5916\u7684\u932f\u8aa4\uff1a\u6846\u6846\u5167\u6c92\u6709\u5167\u5bb9", "Box type not supplied during registration.": "\u5728\u8a3b\u518a\u904e\u7a0b\u4e2d\u672a\u63d0\u4f9b\u6846\u6846\u6a23\u5f0f", "Video": "\u8996\u983b", "Click %s to insert text.": "\u9ede\u64ca%s\u63d2\u5165\u6587\u672c", "Done": "\u5b8c\u6210\u7de8\u8f2f", "Font": "\u5b57\u9ad4", "Bold": "\u7c97\u9ad4", "Italic": "\u659c\u9ad4", "Underline": "\u4e0b\u5283\u7dda", "Increase font size": "\u589e\u52a0\u5b57\u9ad4\u5927\u5c0f", "Decrease font size": "\u6e1b\u5c11\u5b57\u9ad4\u5927\u5c0f", "Text length exceeds the maximum limit.": "\u6587\u672c\u9577\u5ea6\u8d85\u904e\u6700\u5927\u9650\u5236", "Plain text.": "\u7d14\u6587\u672c", "Formatted text.": "\u522a\u9664\u6587\u672c", "Paste text": "\u8cbc\u4e0a\u6587\u672c", "Click %s to insert video.": "\u9ede\u64ca%s\u63d2\u5165\u8996\u983b", "Insert video": "\u63d2\u5165\u8996\u983b", "Play video": "\u64ad\u653e\u8996\u983b", "Pause video": "\u66ab\u505c\u8996\u983b", "Show video": "\u986f\u793a\u8996\u983b", "Close video": "\u95dc\u9589\u8996\u983b", "Please provide a valid link\/embed code for any of the supported video services.": "\u8acb\u63d0\u4f9b\u4e00\u500b\u6709\u6548\u7684\u9023\u7d50\/\u5141\u8a31\u4ee3\u78bc\u63d0\u4f9b\u4efb\u4f55\u8996\u983b", "Could not interpret the content as video.": "\u7121\u6cd5\u89e3\u6790\u7684\u5167\u5bb9\u8996\u983b", "Insert video embed code or url:": "\u5229\u7528\u4ee3\u78bc\u6216\u7db2\u5740\u52a0\u5165\u8996\u983b\uff1a", "Select video from the list of available videos:": "\u5f9e\u5217\u8868\u4e2d\u9078\u64c7\u53ef\u7528\u7684\u8996\u983b\uff1a", "Add %s box": "\u65b0\u589e%s\u6846\u6846", "Set as background": "\u8a2d\u70ba\u80cc\u666f", "Unset from background": "\u80cc\u666f\u672a\u8a2d\u7f6e", "Error in generating unique id.": "\u5728\u751f\u6210\u552f\u4e00ID\u767c\u751f\u932f\u8aa4", "Improper internal call.": "\u4e0d\u7576\u7684\u5167\u90e8\u8abf\u7528", "Please insert a value.": "\u8acb\u8f38\u5165\u503c", "Browser does not support required feature \"%s\".": "\u700f\u89bd\u5668\u4e0d\u652f\u6301\u6240\u9700\u7684\u529f\u80fd \"%s\".", "Could not initialize %s. Container not found.": "\u7121\u6cd5\u521d\u59cb\u5316%s.\u5bb9\u5668\u672a\u627e\u5230\u3002", "Box type \"%s\" doesn't exist.": "\u6846\u6846\u6a23\u5f0f\"%s\" \u4e0d\u5b58\u5728\u3002", "Error during box creation: %s.": "\u6846\u6846\u5275\u5efa\u904e\u7a0b\u4e2d\u932f\u8aa4\uff1a%s.", "Saving content.": "\u6b63\u5728\u4fdd\u5b58\u5167\u5bb9", "Please wait...": "\u8acb\u7a0d\u5019...", "Removed box. Box type \"%s\" not supported.": "\u522a\u9664\u6846\u3002\u6846\u6a23\u5f0f\"%s\" \u4e0d\u652f\u6301\u3002", "This is a %s feature.": "\u9019\u662f\u4e00\u500b%s\u7684\u529f\u80fd", "For information, please visit %s.": "\u6709\u95dc\u8a73\u7d30\u4fe1\u606f\u8acb\u8a2a\u554f%s.", "Box size and position": "\u6846\u6846\u7684\u5927\u5c0f\u548c\u4f4d\u7f6e", "Size": "\u5927\u5c0f", "Box": "\u6846\u6846", "SEO and grouping tags": "SEO\u53ca\u5206\u7d44\u6a19\u7c64", "Additional audio services:": "\u984d\u5916\u7684\u97f3\u6548\u670d\u52d9\uff1a", "Supported in %s:": "\u652f\u6301\u5728%s:", "Current color:": "\u7576\u524d\u984f\u8272\uff1a", "Click on the \"%s\" button to start creating content for extra small layouts.": "\u9ede\u64ca\"%s\"\u7684\u6309\u9215\u958b\u59cb\u5275\u5efa\u984d\u5916\u7684\u5c0f\u7248\u9762\u5167\u5bb9", "Start responsive design": "\u555f\u52d5\u81ea\u9069\u61c9\u8a2d\u8a08", "Snap boxes to": "\u6355\u6349\u6846\u5230", "Page": "\u9801\u9762", "Boxes": "\u6846\u6846", "Content link": "\u5167\u5bb9\u9023\u7d50", "Content": "\u5167\u5bb9", "Edit": "\u7de8\u8f2f", "Undo": "\u5fa9\u539f", "Redo": "\u6e96\u5099\u5c31\u7dd2", "Clear all": "\u6e05\u9664\u6240\u6709", "Click to set Hex color": "\u9ede\u64ca\u8a2d\u7f6e\u5341\u516d\u9032\u5236\u984f\u8272", "Click to set RGB color": "\u9ede\u64ca\u8a2d\u7f6eRGB\u984f\u8272", "Solid color": "\u7d14\u8272", "Horiz. gradient": "\u81e5\u5f0f\u6f38\u8b8a", "Vert. gradient": "\u7da0\u8272\u6f38\u8b8a", "Radial gradient": "\u653e\u5c04\u72c0\u6f38\u8b8a", "Select color opacity": "\u9078\u64c7\u984f\u8272\u900f\u660e\u5ea6", "Set custom color (Hex)": "\u8a2d\u7f6e\u81ea\u5b9a\u7fa9\u984f\u8272\uff08\u5341\u516d\u9032\u5236\uff09", "Please enter the color in hex format, e.g. %s": "\u8acb\u8f38\u5165\u5341\u516d\u9032\u5236\u683c\u5f0f\u7684\u984f\u8272\u4f8b\u5982: %s ", "You must enter a color.": "\u60a8\u5fc5\u9808\u8f38\u5165\u984f\u8272", "Set custom color (RGB)": "\u8a2d\u7f6e\u81ea\u5b9a\u7fa9\u984f\u8272\uff08RGB\uff09", "Please enter the color in RGB format, with comma-separated components, e.g. %s": "\u8acb\u8f38\u5165RGB\u683c\u5f0f\u7684\u984f\u8272\uff0c\u7528\u9017\u865f\u5206\u9694\u7684\u7d44\u4ef6\u4f8b\u5982: %s "
    }
);