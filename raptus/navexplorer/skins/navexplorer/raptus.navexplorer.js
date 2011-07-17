raptus_navexplorer = {

    //default configuration
    settings : { refreshtime: 30000,
                 observetime: 33,
                 manual_expires: 300
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
            
            themes : {
                theme : 'apple',
                dots : false,
                icons : true
            },
            ui : { select_limit : 1},
            
            contextmenu: {items: raptus_navexplorer.customContextMenu },
            
            hotkeys: { 'del' : false,
                       'f2' : false,
                       'return' : function(){ var o = this.data.ui.hovered || this.data.ui.last_selected;
                                               this.deselect_all();
                                               this.select_node(o)}},
                                               
            plugins : ['themes', 'json_data', 'ui','hotkeys', 'contextmenu']

        });
        
        //events notifications
        inst.bind('select_node.jstree', function (event, data) {
            $('#navexplorer_tree').resize(raptus_navexplorer.resizeAccordion());
            raptus_navexplorer.goToLocation(data.rslt.obj.data('url'));
        });
        inst.bind('hover_node.jstree', raptus_navexplorer.reloadAccordion);
        inst.bind('before.jstree',raptus_navexplorer.resizeAccordion);
        
        // overriding default click function
        inst.undelegate('a', 'click.jstree');
        inst.delegate('a', 'dblclick.jstree', $.proxy(function (event) {
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
        
        
        //init buttons
        $('#header_close').button({
            icons: { primary: 'ui-icon-close' },
            text: false
        }).click(function(){
            document.main_document.location = document.plone_frame.document.location;
        });
        $('#header_newwin').button({
            icons: { primary: 'ui-icon-newwin' },
            text: false
        }).click(function(){
            alert('Sorry, function is not implemented yet');
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
    
    sync : function(){
            
        var li = new Array();
        raptus_navexplorer.treeinst.find('li').each(function(){
            if (!$(this).data('path') || !$(this).data('mtime'))
                return;
            li.push({path:$(this).data('path'),
                     mtime:$(this).data('mtime'),
                     id:$(this).attr('id')});
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
        
        if (obj.contextmenu){
            el.data('contextmenu', obj.contextmenu);
        }
        
        if (obj.reloadchildren){
            tree.refresh(el);
        }
    },
    
    urlObserve: function(){
        if (!document.plone_frame)
            return;
        if (raptus_navexplorer.url_observation != document.plone_frame.location)
            if (raptus_navexplorer.url_observation)
                jQuery(document.plone_frame.window).load(raptus_navexplorer.urlChanged);
            else 
                jQuery(document.plone_frame).ready(raptus_navexplorer.urlChanged);
        raptus_navexplorer.url_observation = document.plone_frame.location;
    },
    
    urlChanged: function(){
        document.main_document.title = document.plone_frame.document.title;
        raptus_navexplorer.sync();
        document.plone_frame.jq('#contentview-open_navexplorer').remove();
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
    
    reloadAccordion : function(evnet, data){
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

    goToLocation : function(url){
        document.plone_frame.location = url;
    }
}

jQuery(document).ready(raptus_navexplorer.init);
