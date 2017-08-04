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
var settings = {};
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
    console.log("initializing nzbBuddy");
    chrome.browserAction.setIcon({path: 'icons/nzb_on.png', tabId: tab.id}, function () {
        if (chrome.runtime.lastError) console.log(chrome.runtime.lastError.message);
    });
    chrome.tabs.executeScript(tab.id, {file: "js/jquery.slim.min.js"});
    chrome.tabs.executeScript(tab.id, {file: "js/content.js"});
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

    var url = settings.url + api.endpoint + settings.apikey + '&' + api[_fnc] + '&';

    // generate spi request url
    if (typeof _data !== undefined && _data !== null) for (var _param in _data) if (_data.hasOwnProperty(_param)) url += '&' + api[_param] + '=' + _data[_param];
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


var search = {
    data: {},
    results: [],
    notifications: {}
};

// event listener

// neuer Tab aufgemacht
chrome.tabs.onUpdated.addListener(function (tabId, changeInfo, tab) {
    var hostname = getHostname(tab.url);
    if (typeof this.settings === "undefined" || typeof this.settings.sites === "undefined") return;
    if (changeInfo.status === "complete" && this.settings.sites && this.settings.sites.indexOf(hostname) > -1) initNzbBuddy(tab);
});

// browser action
chrome.browserAction.onClicked.addListener(function (tab) {
    console.log("CLICKED! LOL!!");
    var hostname = getHostname(tab.url);
    console.log("hostname: " + hostname);
    if (typeof this.settings.sites === "undefined") this.settings.sites = [];
    if (this.settings.sites.indexOf(hostname) > -1) { // disable
        console.log("indexOf " + this.settings.sites.indexOf(hostname));
        delete this.settings.sites.indexOf(hostname);
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
    console.log("new runtime message:", request);

    if (typeof request.fnc !== "undefined") {
        _request(request.fnc, request.data, sendResponse);
        return true;
    }
    else if (typeof request.search !== "undefined") {

        this.search = {
            data: request.search,
            results: [],
            notifications: {}
        };

        var params = deparam(search.data.url);
        if (debug) console.log("params:");
        if (debug) console.log(params);

        if (search.data.url.substr(search.data.url.length - 4) === ".nzb") // direct link
        {
            if (debug) console.log('direct link');
            addToSABnzbd($(this), search.data.url, "addurl", "", "usenet-4all");
            return;
        }
        else if (search.data.provider === 'nzblnk') // usenet-4all.info nzblink
        {
            console.log("nzblnk!");
            search.data.title    = params.t + '{{' + params.p + '}}';
            search.data.url      = 'http://nzbindex.com/search/?q=' + params.h + '&sort=sizedesc&&hidespam=1';
            search.data.provider = 'nzbindex';
            params.q             = params.h;
        }

        // download category
        if (debug) console.log("detecting category from title: " + search.data.title);
        if (search.data.title.search(/[sS]\d{1,2}[eE]\d{1,2}|\d{1,2}x\d{1,2}/i) > -1) search.data.category = 'tv';
        else if (search.data.title.search(/xxx|sex|/i) > -1) search.data.category = 'xxx';
        else if (search.data.title.search(/1080p|720p|UHD|FHD/i) > -1) search.data.category = 'movie';
        if (debug) console.log("category: " + search.data.category);

        // process nzb search
        if (debug) console.log('processing ' + search.data.provider + ' search: ' + search.data.url);
        jQuery.get(search.data.url, function (html) {
            if (search.data.provider === 'nzbclub') {
                $(html).find('#ui_searchResult').find('.media').each(function () {
                    search.results.push({
                        'title': $('.text-muted', $(this)).text().replace(/[^\d\w\s]/gi, ""),
                        'desc': $('.row', $(this)).children('.col-xs-2.col-md-1').first().text() + ' | ' + $('.row', $(this)).children('.col-xs-2.col-md-1').last().text(), //.replace(/[^\d\w\s]/gi, ""),
                        'nzb': 'https://www.nzbclub.com/nzb_get/' + $('.project-action', $(this)).attr('collectionid')
                    });
                });
                if (debug) console.log('search.results:');
                if (debug) console.log(search.results);
                createOverlay($link, items);
            }
            else if (search.data.provider === 'nzbindex') {
                $(html).find('#results').find('input[type="checkbox"]').each(function () {
                    //console.log('this');
                    //console.log(this);
                    var _title = $(this).parent().next().find('label').text().replace(/["'<>]/gi, "").toLowerCase(),
                        _regexp = new RegExp(params.q.toLowerCase().replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&").replace(/\s/g, ".+"));
                    if (debug) console.log("found: ",_title);
                    if (debug) console.log("test regex: ",_regexp);
                    if (debug) console.log("match: ",_title.match(_regexp));
                    //if (_title.indexOf(params.q.toLowerCase()) > -1) search.results.push({
                    if (_title.match(_regexp)) search.results.push({
                        'title': _title,
                        //'desc': $(this).parent().next().next().next().next().text() + ' | ' + $(this).parent().next().next().find('div').first().text() + ' | ' + $(this).parent().next().find('div.info').text().replace(/[<>]/gi, ""),
                        'desc': $(this).parent().next().next().find('div').first().text() + ' | ' + $(this).parent().next().next().next().next().text(),
                        'nzb': $(this).parent().next().find('a[href*="/download/"]').attr('href')
                    });
                });
                if (debug) console.log('results:');
                if (debug) console.log(search.results);
                //createOverlay($link, items);
            }
            else if (search.data.provider === 'binsearch') {
                jQuery.get(url, function (html) {
                    $(html).find('.xMenuT').find('input[type="checkbox"]').each(function () {

                        items.push({
                            'title': $(this).parent().next().find('.s').text().replace(/[<>]/gi, ""),
                            'desc': $(this).parent().next().find('.d').text().replace(/[<>]/gi, ""),
                            'nzb': 'https://www.binsearch.info/?action=nzb&' + $(this).attr("name") + '=1'
                        });
                    });
                    createOverlay($link, items);
                }, "html");
            }

            if (search.results.length < 1) {
                chrome.notifications.create({
                    type: 'basic',
                    priority: 2,
                    iconUrl: chrome.runtime.getURL('icons/nzb_off.png'),
                    title: 'nix gefunden',
                    message: 'sorry... :(',
                    isClickable: false
                });
            } else {
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

        }, "html").fail(function () {
            alert("Link konnte nicht abgerufen werden, bitte versuch einen anderen Link");
        });
    }
});

// clicked on notification
chrome.notifications.onClicked.addListener(function (notificationId) {
    console.log("notification clicked");
    _request('add', {
            'url': search.notifications[notificationId],
            'title': search.data.title,
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
            }
            else if (typeof response.error !== "undefined") // error
            {
                chrome.notifications.update(notificationId, {iconUrl: chrome.runtime.getURL('icons/nzb_off.png'), title: 'Das hat jetzt nicht funktioniert! Läuft der Client?'});
                setInterval(function () {
                    for (var _n in notifications) {
                        if (!notifications.hasOwnProperty(_n)) continue;
                        chrome.notifications.clear(_n);
                    }
                }, 6000);
            }
        });


});


/*

 var add = function (nzb) {
 console.log(nzb.cat);
 if (settings['cat-tv'] && nzb.cat == 'tv') nzb.cat = settings['cat-tv'];
 else if (settings['cat-xxx'] && nzb.cat == 'xxx') nzb.cat = settings['cat-xxx'];
 else if (settings['cat-movie'] && nzb.cat == 'movie') nzb.cat = settings['cat-movie'];

 console.log(nzb.cat);

 var method = {mode: 'addurl'};
 jQuery.extend(method, nzb);
 apiRequest(jQuery.param(method));
 };

 var pause = function () {
 apiRequest('mode=pause');
 };

 var resume = function (nzb) {
 apiRequest('mode=resume');
 };

 */
