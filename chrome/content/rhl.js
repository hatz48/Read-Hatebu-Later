const EXPORT = ['ReadLater'];
var rhlTag = Application.prefs.get('extensions.readhatebulater.tag').value;

var ReadLater = {
    prefs: null,
    rhlTag: "",
    rhlList: null,
    user: null,

    init: function() {

        RHL.User.login();
        // ログインユーザー名を取得
        // this.user = RHL.User.user; // まだ取得できていないので無意味
        // 設定を初期化
        var nsISupportsString = Components.interfaces.nsISupportsString;
        this.prefs = Components.classes["@mozilla.org/preferences-service;1"]
            .getService(Components.interfaces.nsIPrefService)
            .getBranch("extensions.readhatebulater.");
        this.prefs.QueryInterface(Components.interfaces.nsIPrefBranch2);
        this.prefs.addObserver("", this, false);
	
        this.rhlTag = this.prefs.getComplexValue('tag', nsISupportsString).data;
        // コンテキストメニューを初期化
        this.setupContextMenu();
        this.setupRhlList();

        let icon = document.getElementById("rhl-locationbar-icon");
        icon.addEventListener('click', this.toggle, false);

        gBrowser.addEventListener('load', this.setIcon, true);
        document.addEventListener('TabSelect', this.setIcon, false);
    },

    shutdown: function() {
	this.prefs.removeObserver("", this);
    },

    observe: function(subject, topic, data) {
	if (topic != "nsPref:changed") {
	    return;
	}
	switch(data) {
          case 'tag':
            this.rhlTag = this.prefs.getComplexValue('tag', nsISupportsString).data;
            break;
        }
    },

    setupContextMenu: function() {
        // set context appearance
        var contextMenu = document.getElementById("contentAreaContextMenu");
        if (contextMenu) {
            contextMenu.addEventListener("popupshowing", function(e) {
                var addlink = document.getElementById("rhl-menu-addlink");
                addlink.setAttribute('hidden', !gContextMenu.onLink);
            }, false);
        }
    },

    setupRhlList: function setup_rhl_list() {
        var bookmarks = [];
        var cache = {};
        var LF = String.fromCharCode(10); // 改行コード LF
        var TAB = String.fromCharCode(9); // タブコード
        var req = new XMLHttpRequest();
        req.open('GET', 'http://b.hatena.ne.jp/hatsu48/search.data', true);
        req.onreadystatechange = function (aEvt) {
            if (req.readyState == 4) {
                if(req.status == 200) {
                    var i, j, len;
                    var data = req.responseText.split(LF);
                    for (i = 0, len = data.length / 4 * 3; i < len; i += 3) {
                        bookmarks.push({
                            title: data[i],
                            tag  : data[i + 1],
                            url  : data[i + 2]
                        });
                    }
                    for (i = data.length / 4 * 3, j = 0, len = data.length;
                         i < len; i++, j++) {
                        var bookmarkNumAndDate = data[i].split(TAB);
                        bookmarks[j].bookmarkNum = bookmarkNumAndDate[0];
                        bookmarks[j].date        = bookmarkNumAndDate[1];
                    }
                    for (i = 0, len = bookmarks.length; i < len; i++) {
                        let bookmark = bookmarks[i];
                        if (bookmark.tag.indexOf(ReadLater.rhlTag) != -1) {
                            cache[bookmark.url] = bookmark;
                        }
                    }
                } else {
                    dump("Error loading page\n");
                }
            }
        };
        req.send(null);
        this.rhlList = cache;
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
            delete_bookmark(url);
            delete ReadLater.rhlList[url];
        } else {
            icon.setAttribute('registed', 'true');
            add_bookmark(url);
            ReadLater.rhlList[url] = {
                url: url,
                tag: ReadLater.rhlTag
            };
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
    }
};

window.addEventListener('load',   function(e) { ReadLater.init(); }, false);
window.addEventListener('unload', function(e) { ReadLater.shutdown(); }, false);

window.addEventListener('load', function() {

    // prefs.setCharPref('tag', unescape(encodeURIComponent('*あとで読め')));
    // var str = prefs.getComplexValue('tag', nsISupportsString).data;
    //dump(prefs.getCharPref('tag'));

    // RHL.User.login();

    let context_addlink = document.getElementById("rhl-menu-addlink");
    context_addlink.addEventListener('click', function(){
        let url = gContextMenu.linkURL;
        if (!cache[url]) {
            add_bookmark(url);
            cache[url] = {
                url: url,
                tag: ReadLater.rhlTag
            };
        }
    });
});

function add_bookmark(url) {
    dump('add bookmark\n');
    var request = new XMLHttpRequest();
    request.mozBackgroundRequest = true;
    request.open('POST', 'http://b.hatena.ne.jp/' + RHL.User.user.name + '/add.edit.json?editer=fxaddon');
    request.addEventListener('error', function(e){dump('error...');}, false);
    let headers = {
        "Content-Type": "application/x-www-form-urlencoded",
        "Cookie":       "rk=" + RHL.User.user.rk
    };
    for (let [field, value] in Iterator(headers))
        request.setRequestHeader(field, value);
    let query = {
        url:url,
        comment:'[' + ReadLater.rhlTag + ']',
        rks: RHL.User.user.rks
    };
    request.send(net.makeQuery(query));
}

function delete_bookmark(url) {
    var request = new XMLHttpRequest();
    request.mozBackgroundRequest = true;
    request.open('POST', 'http://b.hatena.ne.jp/' + RHL.User.user.name + '/api.delete_bookmark.json?editer=fxaddon');
    //request.open('POST', 'http://b.hatena.ne.jp/' + RHL.User.user.name + '/add.edit.json?editer=fxaddon');
    request.addEventListener('error', function(e){dump('error...');}, false);
    let headers = {
        "Content-Type": "application/x-www-form-urlencoded",
        "Cookie":       "rk=" + RHL.User.user.rk
    };
    for (let [field, value] in Iterator(headers))
        request.setRequestHeader(field, value);
    let query = {
        url:url,
        comment:'[' + ReadLater.rhlTag + ']',
        rks: RHL.User.user.rks
    };
    request.send(net.makeQuery(query));
}

var net = {};
net.makeQuery =  function net_makeQuery (data) {
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
};
