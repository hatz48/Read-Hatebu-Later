const EXPORT = ['ReadLater'];

var ReadLater = {
    prefs: null,
    rhlTag: "",
    tagList: null,
    rhlList: null,
    user: null,

    init: function() {

        RHL.User.login();
        // ログインユーザー名を取得
        // this.user = RHL.User.user; // まだ取得できていないので無意味

        this.setupConfig();
        this.setupContextMenu();
        this.setupRhlList();

        let icon = document.getElementById("rhl-locationbar-icon");
        icon.addEventListener('click', this.toggle, false);

        gBrowser.addEventListener('load', this.setIcon, true);
        document.addEventListener('TabSelect', this.setIcon, false);
        window.setInterval(this.setupRhlList, 10*60*1000);
    },

    shutdown: function() {
	this.prefs.removeObserver("", this);
    },

    setupConfig: function Setup_config() {
        // 設定を初期化
        var nsISupportsString = Components.interfaces.nsISupportsString;
        this.prefs = Components.classes["@mozilla.org/preferences-service;1"]
            .getService(Components.interfaces.nsIPrefService)
            .getBranch("extensions.readhatebulater.");
        this.prefs.QueryInterface(Components.interfaces.nsIPrefBranch2);
        this.prefs.addObserver("", this, false);
	
        this.rhlTag = this.prefs.getComplexValue('tag', nsISupportsString).data;
        
    },

    setupContextMenu: function() {
        // コンテキストメニューを初期化
        // set context appearance
        var contextMenu = document.getElementById("contentAreaContextMenu");
        if (contextMenu) {
            contextMenu.addEventListener("popupshowing", function(e) {
                var addlink = document.getElementById("rhl-menu-addlink");
                addlink.setAttribute('hidden', !gContextMenu.onLink);
            }, false);
        }
        // set context action
        var contextAddlink = document.getElementById("rhl-menu-addlink");
        contextAddlink.addEventListener('click', function(){
            var url = gContextMenu.linkURL;
            if (!ReadLater.rhlList[url]) {
                ReadLater.addBookmarkByIcon(url);
                ReadLater.rhlList[url] = {
                    url: url,
                    tag: ReadLater.rhlTag
                };
            }
        });
    },

    setupRhlList: function setup_rhl_list() {
        var req = new XMLHttpRequest();
        req.open('GET', 'http://b.hatena.ne.jp/hatsu48/search.data', true);
        req.onreadystatechange = ReadLater.setRhlList;
        req.send(null);
    },
    

    // callback
    observe: function(subject, topic, data) {
	if (topic != "nsPref:changed") {
	    return;
	}
	switch(data) {
          case 'tag':
            var nsISupportsString = Components.interfaces.nsISupportsString;
            ReadLater.rhlTag = this.prefs.getComplexValue('tag', nsISupportsString).data;
            // TODO.
            // 設定のタグが修正されるたびに呼ばれているっぽい。
            // 無駄な更新を行ってしまっているはず。
            ReadLater.setupRhlList();
            break;
        }
    },

    // callback
    setRhlList: function (aEvt) {
        var tagList = {};
        var rhlList = {};
        var bookmarks = [];
        var LF  = String.fromCharCode(10); // 改行コード LF
        var TAB = String.fromCharCode(9); // タブコード

        if (this.readyState != 4) { return; }
        if (this.status == 200) {
            var i, j, len;
            var data = this.responseText.split(LF);
            for (i = 0, len = data.length / 4 * 3; i < len; i += 3) {
                var tag = [];
                var tmp = data[i + 1].match(/\[(.*?)\]/g);
                if (tmp) for (j = 0; j < tmp.length; j++) {
                    tag.push(tmp[j].slice(1,-1));
                }
                bookmarks.push({
                    title  : data[i],
                    comment: data[i + 1],
                    url    : data[i + 2],
                    tag    : tag
                });
            }
            // ブックマーク数、自分がタグ付けした日付を取得
            for (i = data.length / 4 * 3, j = 0, len = data.length;
                 i < len; i++, j++) {
                var bookmarkNumAndDate = data[i].split(TAB);
                bookmarks[j].bookmarkNum = bookmarkNumAndDate[0];
                bookmarks[j].date        = bookmarkNumAndDate[1];
            }
            // [*あとで読む]のタグがついてるものを rhlList に確保
            for (i = 0, len = bookmarks.length; i < len; i++) {
                let bookmark = bookmarks[i];
                tagList[bookmark.url] = bookmark;
                if (bookmark.tag.indexOf(ReadLater.rhlTag) != -1) {
                    rhlList[bookmark.url] = bookmark;
                }
            }
        } else {
            dump("Error loading page\n");
        }
        ReadLater.rhlList = rhlList;
        ReadLater.tagList = tagList;
    },
    
    // callback
    toggle: function toggle (){
        dump('toggle\n');
        let icon = document.getElementById("rhl-locationbar-icon");
        // 現在開いているタブ
        let tab = gBrowser.selectedBrowser.contentDocument;
        let url = tab.location;
        let registed = icon.getAttribute('registed');
        if (registed == 'true') {
            icon.setAttribute('registed', 'false');
            ReadLater.deleteBookmark(url);
        } else {
            icon.setAttribute('registed', 'true');
            ReadLater.addBookmarkByIcon(url);
        }
    },

    // callback
    setIcon: function set_icon () {
        let icon = document.getElementById("rhl-locationbar-icon");
        // 現在開いているタブ
        let tab = gBrowser.selectedBrowser.contentDocument;
        let url = tab.location;
        if (ReadLater.rhlList[url]) {
            icon.setAttribute('registed', 'true');
        } else {
            icon.setAttribute('registed', 'false');
        }
    },

    // callback
    addBookmarkByIcon: function add_bookmark(url) {
        dump('add_bookmark');
        var comment = '[' + ReadLater.rhlTag + ']';
        if (ReadLater.tagList[url]) {
            comment += ReadLater.tagList[url].comment;
        }
        let query = {
            url: url,
            comment: comment
        };
        net.post('add', query);
        ReadLater.rhlList[url] = {
            url: url,
            tag: [ReadLater.rhlTag],
            comment: comment
        };
    },
    
    // callback
    addBookmarkByContextMenu: function add_bookmark_by_ctx (url) {
        
    },

    // callback
    deleteBookmark: function delete_bookmark(url) {
        var comment = ReadLater.rhlList[url].comment;
        comment = comment.replace('[' + ReadLater.rhlTag + ']', '').trim();
        let query = {
            url: url
            //comment: null
        };
        if (comment) {
            query.comment = comment;
            net.post('edit', query);
        } else {
            net.post('delete', query);
            delete ReadLater.tagList[url];
        }
        delete ReadLater.rhlList[url];
    }
    
};

var net = {
    api: {
        add   : '/add.edit.json?editer=fxaddon',
        edit  : '/add.edit.json?editer=fxaddon',
        delete: '/api.delete_bookmark.json?editer=fxaddon'
    },

    makeQuery: function net_makeQuery (data) {
        let pairs = [];
        let regexp = /%20/g;
        let toString = Object.prototype.toString;
        for (let k in data) {
            if (typeof data[k] == 'undefined') continue;
            let n = encodeURIComponent(k);
            let v = data[k];
            if (toString.call(v) === '[object Array]') {
                pairs.push(v.map(function (c) {
                    return n + '=' + encodeURIComponent(c).replace(regexp, '+');
                }).join('&'));
            } else {
                pairs.push(n + '=' + encodeURIComponent(v).replace(regexp, '+'));
            }
        }
        return pairs.join('&');
    },

    post: function net_post (command, query) {
        var req = new XMLHttpRequest();
        req.mozBackgroundRequest = true;
        req.open('POST', 'http://b.hatena.ne.jp/' + RHL.User.user.name + net.api[command]);
        req.addEventListener('error', function(e){dump('error...');}, false);
        let headers = {
            "Content-Type": "application/x-www-form-urlencoded",
            "Cookie":       "rk=" + RHL.User.user.rk
        };
        for (let [field, value] in Iterator(headers))
            req.setRequestHeader(field, value);
        query.rks = RHL.User.user.rks;
        req.send(net.makeQuery(query));
    }
};

window.addEventListener('load',   function(e) { ReadLater.init(); }, false);
window.addEventListener('unload', function(e) { ReadLater.shutdown(); }, false);
