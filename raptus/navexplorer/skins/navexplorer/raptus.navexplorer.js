raptus_navexplorer = {

    //default configuration
    settings : { refreshtime: 30000,
                 observetime: 33,
                 manual_expires: 300,
                 standaloneWindow: 'width=800,height=1000,toolbar=no,location=no,directories=no,status=no,menubar=no,scrollbars=yes, copyhistory=no, resizable=yes',
                },


    init: function($){
        
        // jstree
        $.jstree._themes = 'navexplorer_tree_themes/';
        
        var inst = raptus_navexplorer.treeinst = $('#navexplorer_tree');
        inst.jstree({
            json_data: {
                progressive_unload : true,
                ajax: {
                    url: portal_url + '/navexplorer_ajax',
                    data: function(n){
                        return {
                            path: n.data ? n.data('path') : '',
                        };
                    }
                }
            },
            
            themes: {
                theme : 'apple',
                dots : false,
                icons : true
            },
            ui: { select_limit : -1,
                  select_multiple_modifier: 'alt'},
            
            contextmenu: {items: raptus_navexplorer.customContextMenu },
            
            hotkeys: { 'del': false,
                       'f2': false,
                       'return': function(){ var o = this.data.ui.hovered || this.data.ui.last_selected;
                                               this.deselect_all();
                                               this.select_node(o)}},
                                               
            dnd: {
                // don't work with contextmenu 
                //drag_target: '.jstree li',
                check_timeout: 800,
                //drop_target: '.jstree li',
                drop_check: raptus_navexplorer.dndCheck,
            },

            plugins: ['themes', 'json_data', 'dnd', 'ui', 'hotkeys', 'contextmenu', 'cookies']

        });
        
        //events notifications
        inst.bind('select_node.jstree', function (event, data) {
            $('#navexplorer_tree').resize(raptus_navexplorer.resizeAccordion());
            raptus_navexplorer.goToLocation(data.rslt.obj.data('url'));
        });
        inst.bind('hover_node.jstree', raptus_navexplorer.reloadAccordion);
        inst.bind('before.jstree',raptus_navexplorer.resizeAccordion);
        inst.bind('move_node.jstree', raptus_navexplorer.dndMoved);
        
        // overriding default click function
        inst.undelegate('a', 'click.jstree');
        inst.delegate('a', 'dblclick.jstree', $.proxy(function (event) {
            event.preventDefault();
            event.currentTarget.blur();
            if(!$(event.currentTarget).hasClass("jstree-loading")) {
                this.select_node(event.currentTarget, true, event);
            }
        }, inst.jstree('')));
        // restore selection function from ui plugin
        // and check first of key down event
        inst.delegate('a', 'click.jstree', $.proxy(function (event) {
            var settings = this.get_settings().ui;
            if (!(event[settings.select_multiple_modifier + 'Key'] || event[settings.select_range_modifier + 'Key']))
                return;
            event.preventDefault();
            event.currentTarget.blur();
            if(!$(event.currentTarget).hasClass("jstree-loading")) {
                this.select_node(event.currentTarget, true, event);
            }
        }, inst.jstree('')));
        inst.undelegate('a', 'mouseenter.jstree');
        inst.delegate('a', 'click.jstree', $.proxy(function (event) {
            if(!$(event.currentTarget).hasClass("jstree-loading")) {
                this.hover_node(event.target);
            }
        }, inst.jstree('')));
        inst.undelegate('a', 'mouseleave.jstree');

        
        
        // set interval to sync
        window.setInterval(raptus_navexplorer.sync,
                           raptus_navexplorer.settings.refreshtime);
                           
        // set interval to url change notification
        window.setInterval(raptus_navexplorer.urlObserve, raptus_navexplorer.settings.observetime);
       
        //info box
        raptus_navexplorer.initAccordion();
        
        // init buttons
        raptus_navexplorer.initButtons();
        
    },
    
    
    sync : function(){
            
        var li = new Array();
        raptus_navexplorer.treeinst.find('li').each(function(){
            if (!$(this).data('path') || !$(this).data('mtime'))
                return;
            
            var children = null;
            if (!($(this).hasClass('jstree-closed') || $(this).hasClass('jstree-leaf'))){
                children = new Array();
                $(this).children('ul').children('li').each(function(){
                    children.push($(this).attr('id'));
                });
            }
            
            li.push({path:$(this).data('path'),
                     mtime:$(this).data('mtime'),
                     id:$(this).attr('id'),
                     children:children});
        });
        var data = {tree: JSON.stringify(li)};
        
        $.ajax({
            type: 'POST',
            dataType: 'json',
            url: portal_url + '/navexplorer_sync',
            data: data,
            success: function(data){
                $.each(data, function(){
                    raptus_navexplorer.update(this.id, this);
                });
            }
        });
    },
    
    
    update: function(id, obj){
        var el = $('#'+id);
        var tree = raptus_navexplorer.treeinst.jstree('');
        if (obj.metadata){
            $.each(obj.metadata, function(key, value){
                el.data(key, value);
            });
        }
        
        if (obj.title){
            tree.set_text(el, obj.title);
        }
        
        if (obj.reloadchildren){
            tree.refresh(el);
        }
        
        if (obj.deletenode){
            tree.delete_node(el);
        }
    },
    
    
    urlObserve: function(){
        if (!raptus_navexplorer.getPloneFrame())
            return;
        if (raptus_navexplorer.url_observation != raptus_navexplorer.getPloneFrame().location)
            if (raptus_navexplorer.url_observation)
                jQuery(raptus_navexplorer.getPloneFrame().window).load(raptus_navexplorer.urlChanged);
            else 
                jQuery(raptus_navexplorer.getPloneFrame().document).ready(raptus_navexplorer.urlChanged);
        raptus_navexplorer.url_observation = raptus_navexplorer.getPloneFrame().location;
    },
    
    
    urlChanged: function(){
        if (!raptus_navexplorer.getPloneFrame())
            return;
        parent.document.title = raptus_navexplorer.getPloneFrame().document.title;
        raptus_navexplorer.sync();
        raptus_navexplorer.getPloneFrame().jq('#contentview-open_navexplorer').remove();
    },
    
    
    initButtons: function(){
        $('#header_close').button({
            icons: { primary: 'ui-icon-close' },
            text: false
        }).click(function(){
            parent.location = raptus_navexplorer.getPloneFrame().document.location;
        });
        if (!parent.frames.tree_frame)
            $('#header_newwin').attr('checked',true);
        $('#header_newwin').button({
            icons: { primary: 'ui-icon-newwin' },
            text: false
        }).click(function(){
            if ($(this).attr('checked'))
                raptus_navexplorer.openStandalone();
            else
                raptus_navexplorer.closeStandalone();
        });
        $('#header_notice').button({
            icons: { primary: 'ui-icon-notice' },
            text: false
        }).click(function(){
            $('#manual-message').dialog('open');
        });
        $('#manual-message').dialog({
            modal: true,
            autoOpen: $.cookie('raptus_navexplorer_manual')?false:true,
            draggable: false,
            buttons: {
                Ok: function() {
                    $( this ).dialog('close');
                }
            }
        });
        $.cookie('raptus_navexplorer_manual', true,{
            expires: raptus_navexplorer.settings.manual_expires,
        });
    },
    
    
    openStandalone: function(){
        $('body>*').remove();
        var tree_window = window.open(document.location,'own_window_tree', raptus_navexplorer.settings.standaloneWindow);
        parent.location = raptus_navexplorer.getPloneFrame().location
        tree_window.parent.frames.plone_frame = parent;
    },


    closeStandalone: function(){
        $('body>*').remove();
        raptus_navexplorer.getPloneFrame().location = portal_url + '/@@navexplorer_view';
        self.close();
    },


    initAccordion : function(){
        $('#navexplorer_info').accordion({
            header: 'h3',
        });
    },
    
    
    resizeAccordion: function(){
        var size_window= $(window).height();
        var info = $('#navexplorer_info');
        var margin_info = info.data('margin_info') ? info.data('margin_info') : parseInt(info.css('margin-top'));
        info.data('margin_info', margin_info);
        info.css('margin-top','0px');
        var size_info = $('#navexplorer_info').height();
        var size_tree = $('#navexplorer_tree').height() + margin_info + parseInt($('#navexplorer_content').css('margin-top'));
        var absolute = size_window - size_info;
        if (absolute <= size_tree)
            absolute = size_tree;
        $('#navexplorer_info').css('bottom', 'auto').css('top', absolute + 'px');
    },
    
    
    reloadAccordion : function(event, data){
        var url = data.rslt.obj.data('url') + '/navexplorer_accordion';
        $.get(url, function(data) {
              $('#navexplorer_info_wrap').html(data);
              raptus_navexplorer.initAccordion();
              raptus_navexplorer.resizeAccordion();
        });
    },
    
    
    customContextMenu : function(node){
        
        var eval_action = function(menu){
            var mdi = {};
            $.each(menu,function(mkey, mvalue){
                var di = {};
                $.each(mvalue, function(key, value) {
                    switch(key) {
                    case 'action':
                        di['action'] = function(obj){eval(value)};
                        break;
                    case 'submenu':
                        di['submenu'] = eval_action(value);
                        break;
                    default: 
                        di[key]=value;
                    }
                });
                mdi[mkey] = di;
            });
          return mdi;
        }
        return eval_action(node.data('contextmenu'));
    },


    dndMoved: function(e){
        // event is not completely and some attribute are missing. so we take
        // the last position from dndCheck.
        var dnd = raptus_navexplorer.dnd_last_position;
        var data = raptus_navexplorer.dndAjax(dnd, false);
        $.each(data.sync, function(){
            raptus_navexplorer.update(this.id, this);
        });
        raptus_navexplorer.goToLocation(dnd.r.parent().data('url')+'/folder_contents');
    },
    
    
    dndCheck: function(dnd){
        raptus_navexplorer.dnd_last_position = dnd;
        var data = raptus_navexplorer.dndAjax(dnd, true);
        return {
                inside: false,
                after: false,
                before: false
            };
        return data.permission;
    },
    
    
    dndAjax: function(dnd, dryrun){
        if (dnd.drop === false)
            return false;
        var li = [];
        dnd.o.each(function(){
            var path = $(this).data('path');
            if (!path)
                return false;
            li.push(path);
        });
        if (!li.length) 
            return false;
        var data = { drag: li,
                     drop: dnd.r.data('path')?dnd.r.data('path'):dnd.r.parent().data('path'),
                     dryrun: dryrun}
        data = {dnd: JSON.stringify(data)};

        $.vakata.dnd.helper.children('ins').attr('class','jstree-invalid');

        var xhr = $.ajax({
                            type: 'POST',
                            dataType: 'json',
                            url: portal_url + '/navexplorer_dnd',
                            data: data,
                            success: function(data,textStatus, xhr){
                                if (!raptus_navexplorer.dnd_last_xhr === xhr)
                                    return;
                                if (data.permission.inside)
                                    $.vakata.dnd.helper.children('ins').attr('class', 'jstree-ok');
                            },
        });
        raptus_navexplorer.dnd_last_xhr = xhr;
        return false;
    },

    getPloneFrame: function(){
        return parent.frames.plone_frame;
    },


    goToLocation: function(url){
        if (raptus_navexplorer.getPloneFrame())
            raptus_navexplorer.getPloneFrame().location = url;
    }
}

jQuery(document).ready(raptus_navexplorer.init);
