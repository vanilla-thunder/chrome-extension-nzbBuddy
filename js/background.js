// general stuff
function getHostname(href) {
    var l  = document.createElement("a");
    l.href = href;
    return l.hostname;
}

function deparam(url) {
    url        = url.substring(url.indexOf('?') + 1).split('&');
    var params = {}, pair, d = decodeURIComponent, i;
    // march and parse
    for (i = url.length; i > 0;) {
        pair               = url[--i].split('=');
        params[d(pair[0])] = d(pair[1]);
    }
    return params;
}

// settings
var settings = {
    "apikey": "",
    "client": "",
    "url": "",
    "sites": []
};

function loadSettings() {
    chrome.storage.sync.get('settings', function (data) {
        //console.log(data);
        settings = data.settings;
    });
}

function saveSettings() {
    console.log("saving");
    chrome.storage.sync.set({settings: this.settings}, function () {
        console.log("saved!");
    });
}

loadSettings();

// load content script for website in current tab
function initNzbBuddy(tab) {
    //console.log("initializing nzbBuddy");
    chrome.browserAction.setIcon({path: 'icons/nzb_on.png', tabId: tab.id}, function () {
        if (chrome.runtime.lastError) console.log(chrome.runtime.lastError.message);
    });
    //chrome.c
    chrome.tabs.executeScript(tab.id, {file: "js/jquery.slim.min.js"});
    chrome.tabs.executeScript(tab.id, {file: "js/content.js"});
}

var search = {
    data: {},
    results: [],
    notifications: {}
};

function resetSearchData() {
    this.search.data    = {
        'header': '',
        'title': '',
        'pass': ''
    };
    this.search.results = [];
    chrome.contextMenus.update('nzbHeader', {'title': 'header'});
    chrome.contextMenus.update('nzbTitle', {'title': 'title'});
    chrome.contextMenus.update('nzbPass', {'title': 'pass'});
}

function processSearch() {
    var debug = true;
    if (debug) console.log("new nzb search", this.search);

    // category
    if (this.search.data.title !== '') {
        if (debug) console.log("detecting category from title: " + this.search.data.title);
        if (this.search.data.title.search(/[sS]\d{1,2}[eE]\d{1,2}|\d{1,2}x\d{1,2}/i) > -1) this.search.data.category = 'tv';
        else if (this.search.data.title.search(/xxx|sex|erotic/i) > -1) this.search.data.category = 'xxx';
        else if (this.search.data.title.search(/1080p|720p|UHD|FHD/i) > -1) this.search.data.category = 'movie';
        if (debug) console.log("category: " + this.search.data.category);
    }

    // direct nzb link
    if (this.search.data.url.substr(this.search.data.url.length - 4) === ".nzb") {
        _request('add', {
                'url': this.search.data.url,
                'title': this.search.data.title + (this.search.data.pass ? '{{' + this.search.data.pass + '}}' : ''),
                'category': this.search.data.category
            },
            function (response) {
                chrome.notifications.create({
                    type: 'basic',
                    priority: 2,
                    iconUrl: chrome.runtime.getURL((typeof response.error === "undefined" ? 'icons/nzb_on.png' : 'icons/nzb_off.png')),
                    title: search.data.title,
                    message: search.data.url,
                    isClickable: false
                }, function (notificationId) {
                    resetSearchData();
                    setInterval(function () {
                        chrome.notifications.clear(notificationId);
                    }, 1500);
                });
            });
        return;
    }
    // process nzb search
    if (this.search.data.url === '' && this.search.data.header !== '') this.search.data.url = 'https://www.nzbindex.com/search/?q=' + this.search.data.header + '&sort=sizedesc&&hidespam=1';
    if (debug) console.log('processing search: ' + this.search.data.url);
    jQuery.get(this.search.data.url, function (html) {
            var _regexp = (search.data.header && search.data.header !== '' ? new RegExp(search.data.header.toLowerCase().replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&").replace(/\s/g, ".+")) : false);

            if (search.data.provider === 'newzleech') {
                // newzleech
                $(html).find('table.bigsearch-table').find('tr[class^="content"]').each(function () {
                    var _title  = $(this).find('td.subject').text().replace(/["'<>]/gi, "").toLowerCase();
                    if (!_regexp || _title.match(_regexp)) search.results.push({
                        'title': _title,
                        'desc': $(this).find('td.size').text().trim() + ' | ' + $(this).find('td.age').text().trim(),
                        'nzb': 'https://www.newzleech.com/'+$(this).find('td.get a').attr('href')
                    });
                });
            }
            else {
                // default nzbindex
                $(html).find('#results').find('input[type="checkbox"]').each(function () {
                    var _title  = $(this).parent().next().find('label').text().replace(/["'<>]/gi, "").toLowerCase();
                    if (!_regexp || _title.match(_regexp)) search.results.push({
                        'title': _title,
                        //'desc': $(this).parent().next().next().next().next().text() + ' | ' + $(this).parent().next().next().find('div').first().text() + ' | ' + $(this).parent().next().find('div.info').text().replace(/[<>]/gi, ""),
                        'desc': $(this).parent().next().next().find('div').first().text().trim() + ' | ' + $(this).parent().next().next().next().next().text().trim(),
                        'nzb': $(this).parent().next().find('a[href*="/download/"]').attr('href')
                    });
                });
            }

            if (debug) console.log('search.results:');
            if (debug) console.log(search.results);

            if (search.results.length < 1) {
                chrome.notifications.create({
                    type: 'basic',
                    priority: 2,
                    iconUrl: chrome.runtime.getURL('icons/nzb_off.png'),
                    title: 'nix gefunden',
                    message: 'sorry... :(',
                    isClickable: false
                });
            }
            else {
                search.results.forEach(function (_result) {
                    chrome.notifications.create({
                        type: 'basic',
                        priority: 2,
                        iconUrl: chrome.runtime.getURL('icons/nzb_queue.png'),
                        title: _result.desc.replace(/\s\s+/g, ' '),
                        message: _result.title,
                        isClickable: true
                        //requireInteraction: true
                    }, function (notificationId) {
                        search.notifications[notificationId] = _result.nzb;
                    });
                });
            }

        },
        "html"
    ).fail(function () {
        alert("nzbindex.com konnte nicht aufgerufen werden");
    });
}

// communication with SabnNZBD
function _request(_fnc, _data, callback) {

    if (typeof settings.client == "undefined" || typeof settings.url == "undefined" || typeof settings.apikey == "undefined") callback({'error': 'please configure extesion settings!'});

    var api = {
        'sabnzbd': {
            'endpoint': '/api?output=json&apikey=',
            'test': 'mode=version',
            'add': 'mode=addurl',
            'url': 'name',
            'title': 'nzbname',
            'category': 'cat'
        },
        'newsbin': {
            'endpoint': '/api?output=json',
            'test': 'mode=version'
        }
    }[settings.client];

    console.log("_data: ", _data);
    //_data = jQuery.param(_data);

    var url = settings.url + api.endpoint + settings.apikey + '&' + api[_fnc] ;

    // generate spi request url
    if (typeof _data !== undefined && _data !== null) for (var _param in _data) if (_data.hasOwnProperty(_param)) url += '&' + api[_param] + '=' + encodeURI(_data[_param]);
    console.log("url: ", url);

    jQuery.getJSON(url)
        .done(function (result) {
            console.log("result: ", result);
            if (typeof callback !== 'undefined') callback(result);
        })
        .fail(function (jqxhr, textStatus, error) {
            console.log(jqxhr, textStatus, error);
            if (typeof callback !== 'undefined') callback({'error': error});
        });
    return true;
}


// context menu
chrome.contextMenus.create({
    'id': 'nzbHeader',
    'title': 'header',
    'contexts': ["selection"]
});
chrome.contextMenus.create({
    'id': 'nzbTitle',
    'title': 'title',
    'contexts': ["selection"]
});
chrome.contextMenus.create({
    'id': 'nzbPass',
    'title': 'pass',
    'contexts': ["selection"]
});
chrome.contextMenus.create({
    'type': 'separator',
    'id': 'nzbSeparator',
    'contexts': ["selection"]
});
chrome.contextMenus.create({
    'id': 'nzbStart',
    'title': 'Suche starten',
    'contexts': ["selection"]
});
chrome.contextMenus.create({
    'id': 'nzbReset',
    'title': 'zurücksetzen',
    'contexts': ["selection"]
});
chrome.contextMenus.onClicked.addListener(function (data) {
    if (data.menuItemId === 'nzbHeader' && data.selectionText) {
        search.data.header = data.selectionText;
        chrome.contextMenus.update('nzbHeader', {'title': 'header: ' + data.selectionText});
    }
    if (data.menuItemId === 'nzbTitle' && data.selectionText) {
        search.data.title = data.selectionText;
        chrome.contextMenus.update('nzbTitle', {'title': 'title: ' + data.selectionText});
    }
    if (data.menuItemId === 'nzbPass' && data.selectionText) {
        search.data.pass = data.selectionText;
        chrome.contextMenus.update('nzbPass', {'title': 'pass: ' + data.selectionText});
    }
    if (data.menuItemId === 'nzbStart' && search.data.header) processSearch();
    if (data.menuItemId === 'nzbReset') resetSearchData();
});

// hotkeys
chrome.commands.onCommand.addListener(function (command) {
    console.log('Command:', command);
});

// neuer Tab aufgemacht

chrome.tabs.onUpdated.addListener(function (tabId, changeInfo, tab) {
    var hostname = getHostname(tab.url);
    if (typeof this.settings === "undefined" || typeof this.settings.sites === "undefined") return;
    if (changeInfo.status === "complete" && this.settings.sites && this.settings.sites.indexOf(hostname) > -1) initNzbBuddy(tab);
});


// browser action
chrome.browserAction.onClicked.addListener(function (tab) {
    var hostname = getHostname(tab.url);
    console.log("hostname: " + hostname);
    if (typeof this.settings.sites === "undefined") this.settings.sites = [];

    console.log("indexOf " + this.settings.sites.indexOf(hostname));

    var i = this.settings.sites.indexOf(hostname);
    if (i > -1) // disable
    {
        this.settings.sites.splice(i, 1);
        console.log("disabling nzbBuddy for " + tab.url);
        saveSettings();
        var code = 'window.location.reload();';
        chrome.tabs.executeScript(tab.id, {code: code});
    } else { // enable
        this.settings.sites.push(hostname);
        console.log("enabling nzbBuddy for " + tab.url);
        saveSettings();
        initNzbBuddy(tab);
    }

});

// message from content script
chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
    var debug = true;
    /*
        if (typeof request.fnc !== "undefined") {
            _request(request.fnc, request.data, sendResponse);
            return true;
        }
        else
        */
    if (typeof request.search !== "undefined") {

        this.search.data.url      = request.search.url + ( request.search.provider === 'newzleech' ? '&m=search' : '');
        this.search.data.provider = request.search.provider;
        if (this.search.data.title === '') this.search.data.title = request.search.title;
        processSearch();
    }
});

// clicked on notification
chrome.notifications.onClicked.addListener(function (notificationId) {
    // reset search data and context menu
    _request('add', {
            'url': search.notifications[notificationId],
            'title': search.data.title + (search.data.pass ? '{{' + search.data.pass + '}}' : ''),
            'category': search.data.category
        },
        function (response) {
            if (typeof response.error === "undefined")// success
            {
                chrome.notifications.update(notificationId, {iconUrl: chrome.runtime.getURL('icons/nzb_on.png')});
                chrome.notifications.getAll(function (notifications) {
                    console.log("all notifications", notifications);
                    setInterval(function () {
                        for (var _n in notifications) {
                            if (!notifications.hasOwnProperty(_n)) continue;
                            chrome.notifications.clear(_n);
                        }
                    }, 2000);
                });
                resetSearchData();
            }
            else if (typeof response.error !== "undefined") // error
            {
                chrome.notifications.update(notificationId, {iconUrl: chrome.runtime.getURL('icons/nzb_off.png'), title: 'Das hat jetzt nicht funktioniert! Läuft der Client?'});
                setInterval(function () {
                    for (var _n in search.notifications) {
                        if (!search.notifications.hasOwnProperty(_n)) continue;
                        chrome.notifications.clear(_n);
                    }
                }, 6000);
            }
        });


});
