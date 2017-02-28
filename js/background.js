// general stuff
function getHostname(href) {
    var l = document.createElement("a");
    l.href = href;
    return l.hostname;
}
function deparam (url) {
    url = url.substring(url.indexOf('?')+1).split('&');
    var params = {}, pair, d = decodeURIComponent, i;
    // march and parse
    for (i = url.length; i > 0;) {
        pair = url[--i].split('=');
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
    chrome.storage.sync.set({variable: data}, function () {
        console.log("saved!");
    });
}
loadSettings();

// communication with SabnNZBD
function apiRequest(data, success, failure) {

    var endpoint = {
        'SabNZBd': '/api?output=json&apikey=',
        'NewsBin': '/api?output=json'
    };

    data = jQuery.param(data);
    console.log("data: ", data);

    var url = settings.url + endpoint[settings.client] + settings['api-key'] + '&' + data;
    console.log("url: ", url);

    jQuery.get(url).then(function (res) {
        console.log("result: ", res);
        if (typeof success !== 'undefined') success(res);
    }, function errorCallback(response) {
        if (typeof failure !== 'undefined') failure();
        else console.log("Das war jetzt echt kacke!", res)
    });
}



var search = {
    data: {},
    results:[],
    notifications: {}
};

function initNzbBuddy(tab) {
    chrome.browserAction.setIcon({path: 'icons/nzb_on.png', tabId: tab.id}, function () {
        if (chrome.runtime.lastError) console.log(chrome.runtime.lastError.message);
    });
    chrome.tabs.executeScript(tab.id, {file: "js/jquery.slim.min.js"});
    chrome.tabs.executeScript(tab.id, {file: "js/content.js"});
}



// event listener

// neuer Tab aufgemacht
chrome.tabs.onUpdated.addListener(function (tabId, changeInfo, tab) {
    var hostname = getHostname(tab.url);
    if (changeInfo.status === "complete" && settings.sites.indexOf(hostname) > -1) initNzbBuddy(tab);
});
// browser action
chrome.browserAction.onClicked.addListener(function (tab) {
    console.log("CLICKED! LOL!!");
    var hostname = getHostname(tab.url);
    if (this.sites.hostname) {
        // disable
        delete settings.sites.indexOf(hostname);
        console.log("disabling nzbBuddy for " + tab.url);
        saveSettings();
    } else {
        // enable
        settings.sites.push(hostname);
        console.log("enabling nzbBuddy for " + tab.url);
        saveSettings();
    }

});

chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) // message from content script
{
    var debug = true;

    search = {
        data: request.nzb,
        results:[],
        notifications: {}
    };

    var params = deparam(search.data.url);
    if (debug) console.log("params:");
    if (debug) console.log(params);

    if (search.data.url.substr(search.data.url.length - 4) == ".nzb") // direct link
    {
        if (debug) console.log('direct link');
        addToSABnzbd($(this), search.data.url, "addurl", "", "usenet-4all");
        return;
    }
    else if(request.provider == 'nzblink') // usenet-4all.info nzblink
    {
        search.data.title = params.t+'{{'+params.p+'}}';
        search.data.url = 'http://nzbindex.com/search/?q='+params.h+'&sort=sizedesc&&hidespam=1';
        request.provider = 'nzbindex';
    }

    // download category
    if (search.data.title.search(/[sS]\d{1,2}[eE]\d{1,2}|\d{1,2}x\d{1,2}/i)) search.data.category = 'tv';
    else if (search.data.title.search(/xxx/i) ) search.data.category = 'xxx';
    else if (search.data.title.search(/1080p|720p|UHD|FHD/i)) search.data.category = 'movie';

    if (debug) console.log("category: "+search.data.category);

    // process nzb search
    if (debug) console.log('processing ' + request.provider + ' search: ' + search.data.url);

    jQuery.get(search.data.url, function (html) {
        if (request.provider == 'nzbclub') {
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
        else if (request.provider == 'nzbindex') {
            $(html).find('#results').find('input[type="checkbox"]').each(function () {
                //console.log('this');
                //console.log(this);
                var _title = $(this).parent().next().find('label').text().replace(/["'<>]/gi, "").toLowerCase();
                if(_title.indexOf(params.q.toLowerCase()) > -1) search.results.push({
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
        else if (request.provider == 'binsearch') {
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

        search.results.forEach(function (_result) {
            chrome.notifications.create({
                type: 'basic',
                priority: 2,
                iconUrl: chrome.runtime.getURL('icons/nzb_queue.png'),
                title: _result.title,
                message: _result.desc.replace(/\s\s+/g, ' '),
                isClickable: true
                //requireInteraction: true
            }, function (notificationId) {
                search.notifications[notificationId] = _result.nzb;
            });
        });

    }, "html").fail(function () {
        alert("Link konnte nicht abgerufen werden, bitte versuch einen anderen Link");
    });
});
// notification interaction
chrome.notifications.onClicked.addListener(function(notificationId) {
    console.log("notificationId: " + notificationId);
    chrome.notifications.update(notificationId, {iconUrl: chrome.runtime.getURL('icons/nzb_on.png')});
    chrome.notifications.getAll(function(notifications) {
        console.log(notifications);
        setInterval(function () {
            for (var _n in notifications) {
                if(!notifications.hasOwnProperty(_n)) continue;
                chrome.notifications.clear(_n);
            }
        },3000);
    });

    apiRequest({
        'mode':'addurl',
        'name':search.notifications[notificationId],
        'nzbname':search.data.title,
        'cat':search.data.category

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