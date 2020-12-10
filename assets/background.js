chrome.runtime.onStartup.addListener(function() {
    chrome.cookies.set({
        url: "https://nzbindex.nl",
        domain: "nzbindex.nl",
        name: "agreed",
        value: "true"
    });
});
chrome.runtime.onInstalled.addListener(function () {
    // context menu
    chrome.contextMenus.create({
        'id': 'magic',
        'title': 'extract nzb data',
        'contexts': ["selection"]
    });
    chrome.contextMenus.create({
        'id': 'findnzb (collections)',
        'title': 'findnzb.net',
        'contexts': ["selection"]
    });
    chrome.contextMenus.create({
        'id': 'nzbindex',
        'title': 'NZBindex.nl',
        'contexts': ["selection"]
    });
    chrome.contextMenus.create({
        'id': 'binsearch',
        'title': 'binsearch.info',
        'contexts': ["selection"]
    });

});

chrome.contextMenus.onClicked.addListener(function (data, tab) {
    console.log(data.menuItemId);
    if (data.menuItemId === 'nzbindex' && data.selectionText) {
        chrome.tabs.create({ url: 'https://nzbindex.nl/?q=' + data.selectionText + '&sort=agedesc&hidespam=1' });
        /*searchNzbindex(data.selectionText)
            .then(function (results) {
                if (settings.local.debug) console.log("searchNzbindex done", results);
                if (results.length === 1) {
                    enqueueNzb({
                        'url': results[0].nzb,
                        'title': data.selectionText,
                    }, tab.id);
                } else if (results.length < 6) {
                    if (settings.local.debug) console.log('processing multiple results');
                    chrome.tabs.sendMessage(tab.id, { 'search': data.selectionText, 'results': results });
                } else {
                    chrome.tabs.sendMessage(tab.id, { 'warning': results.length + ' Treffer für die Suche' });
                    chrome.tabs.create({ url: 'https://nzbindex.nl/?q=' + data.selectionText + '&sort=agedesc&hidespam=1' });
                }
            })
            .fail(function (error) {
                if (settings.local.debug) console.log('searchNzbindex failed', error);
                if (error === 'Nix gefunden :(') {
                    chrome.tabs.sendMessage(tab.id, { 'warning': 'Suche bei NZBindex ergab keine Treffer, suche bei Binsearch...' });
                }
            });
            */
    }
    else if (data.menuItemId === 'findnzb' && data.selectionText) {        
        processSearch(tab.id, {
            provider: 'findnzb',
            title: tab.title,
            header: data.selectionText
        });
    }
    else if (data.menuItemId === 'binsearch' && data.selectionText) {
        chrome.tabs.create({ url: 'https://www.binsearch.info/?q=' + data.selectionText + '&max=100&adv_age=1100&server=' });
    }
    else if (data.menuItemId === 'magic' && data.selectionText)
    {
        
        console.log(data.selectionText);
        
        var _title = /title\s?\:?\s*([^\s]+)/gi.exec(data.selectionText);
        //console.log('_title');
        //console.log(_title);

        var _title2 = /(^.+(s\d{2}e\d{2}|1080p?|720p?|UHD|FHD|\d{4})[^\s]+)\s/gi.exec(data.selectionText);
        //console.log('_title2');
        //console.log(_title2);

        var __title = ( _title? _title[1] : null ) || (_title2 ? _title2[1] : null ) || tab.title;

        var _header = /header\s?\:?\s*([^\s]+)/gi.exec(data.selectionText)[1];
        //console.log('_header');
        //console.log(_header);

        var _pass = /(password|passwort|pass|pw)(\s|\:)+\s*([^\s]+)/gi.exec(data.selectionText)[3];
        //console.log(_pass);

        console.log("_title:", __title);
        console.log("_header:", _header);
        console.log("_pass:", _pass);

        //return false;
        processSearch(tab.id, {
            provider: 'manual',
            title: __title,
            header: _header,
            pass: _pass
        });
    }
});

// neuer Tab aufgemacht
chrome.tabs.onUpdated.addListener(function (tabId, changeInfo, tab) {
    //console.log("tan.onUpdate",changeInfo);
    if (changeInfo.status !== "complete") return;
    else if (typeof this.settings.global === "undefined" || typeof this.settings.global.sites === "undefined") return;

    var hostname = getHostname(tab.url);
    if (hostname === 'nzbindex.nl') {
        if (settings.local.debug) console.log("init nzbindex.nl content script");
        chrome.tabs.executeScript(tab.id, { file: "assets/jquery.min.js" });
        chrome.tabs.executeScript(tab.id, { file: "assets/nzbindex.js" });
    } else if (this.settings.global.sites && this.settings.global.sites.indexOf(hostname) > -1) {
        if (settings.local.debug) console.log("init nzbBuddy for: " + tab.title);
        initNzbBuddy(tab);
    }
});

// browser action
chrome.browserAction.onClicked.addListener(function (tab) {
    if (settings.local.debug) console.log("browser action clicked", tab);
    var hostname = getHostname(tab.url);

    //console.log("hostname: " + hostname);
    if (typeof this.settings.global.sites === "undefined") this.settings.global.sites = [];

    //console.log("indexOf " + this.settings.sites.indexOf(hostname));

    var i = this.settings.global.sites.indexOf(hostname);
    if (i > -1) // disable
    {
        //console.log("disabling nzbBuddy for " + tab.url);
        this.settings.global.sites.splice(i, 1);
        saveSettings();
        chrome.tabs.sendMessage(tab.id, { 'error': 'nzbBuddy für ' + hostname + ' deaktiviert' })
        setTimeout(function () {
            chrome.tabs.executeScript(tab.id, { code: 'window.location.reload();' });
        }, 2000);
    }
    else // enable
    {
        //console.log("enabling nzbBuddy for " + tab.url);
        this.settings.global.sites.push(hostname);
        initNzbBuddy(tab);
        saveSettings();
        setTimeout(function () {
            chrome.tabs.sendMessage(tab.id, { 'success': 'nzbBuddy für ' + hostname + ' aktiviert' })
        }, 2000);
    }

});

// message from content script
chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
    if (typeof request.search !== "undefined") processSearch(sender.tab.id, request.search);
    else if (typeof request.add !== "undefined") console.log(request.add);
    else if (typeof request.enqueue !== "undefined") enqueueNzb({
        'url': request.enqueue.url,
        'title': request.enqueue.title,
        'category': request.enqueue.category,
        'desc': request.enqueue.desc
    }, sender.tab.id);
});



// general stuff
function getHostname(href) {
    var l = document.createElement("a");
    l.href = href;
    return l.hostname;
}

// settings
var settings = {
    local: {
        nzbclient: '',
        url: '',
        auth: '',
        debug: 0
    },
    global: {
        titlecleanup: true,
        titlereplaces: [],
        sites: []
    }
};

function saveSettings() {
    chrome.storage.local.set({ 'settings': settings.local }, function () {
        //console.log("local settings saved!");
    });
    chrome.storage.sync.set({ 'settings': settings.global }, function () {
        //console.log("global settings saved!");
    });
}

function loadSettings() {
    chrome.storage.local.get('settings', function (local) {
        //console.log("loading local settings", local);
        if (typeof local.settings !== "undefined") settings.local = local.settings;
        //console.log("local callback", settings);
    });
    chrome.storage.sync.get('settings', function (global) {
        //console.log("loading global settings", global);
        if (typeof global.settings !== "undefined") settings.global = global.settings;
        //console.log("global callback", settings);
    });

}

loadSettings();

chrome.storage.onChanged.addListener(function (changes, areaName) {
    if (typeof changes.settings.newValue === "undefined") return;
    //if (debug) console.log("settings changed:", areaName, changes.settings.newValue);
    if (areaName === "local") this.settings.local = changes.settings.newValue;
    if (areaName === "sync") this.settings.global = changes.settings.newValue;
});


function _nzbClient(_fnc, _data, callback) 
{

    //console.log("current settings:", settings);

    if (typeof settings.local.nzbclient == "undefined" || typeof settings.local.url == "undefined" || typeof settings.local.auth == "undefined") callback({ 'error': 'please configure extesion settings!' });

    var api = {
        'SabNZBd': {
            'endpoint': '/api?output=json&apikey=',
            'test': 'mode=version',
            'add': 'mode=addurl',
            'queue': 'mode=queue',
            'url': 'name',
            'title': 'nzbname',
            'category': 'cat'
        },
        'NZBGet': {
            'endpoint': '/api?output=json',
            'test': 'mode=version'
        }
    }[settings.local.nzbclient];

    //console.log("_data: ", _data);
    //_data = jQuery.param(_data);

    var url = this.settings.local.url + api.endpoint + this.settings.local.auth + '&' + api[_fnc];

    // generate api request url
    if (typeof _data !== undefined && _data !== null)
        for (var _param in _data) if (_data.hasOwnProperty(_param)) url += '&' + api[_param] + '=' + encodeURIComponent(_data[_param]);

    if (settings.local.debug) console.log("calling "+settings.local.nzbclient+" API: " + url);
// http://127.0.0.1//api?output=json&apikey=ec75776b25d8242a701952f6d74b8a06&mode=addurl&name=https://nzbindex.nl/download/464097037/&nzbname=Crowded%20S01E07%7B%7BHEINUlS8s2lBaODsSYUEVE30u%7D%7D&cat=tv    

    jQuery.getJSON(url)
        .done(function (result) {
            if (settings.local.debug) console.log("done: " + result);
            if (typeof callback !== 'undefined') callback(result);
        })
        .fail(function (jqxhr, textStatus, error) {
            if (settings.local.debug) console.log("fail:",jqxhr, textStatus, error);
            if (typeof callback !== 'undefined') callback({ 'error': error });
        });
    return true;
}

// load content script for website in current tab
function initNzbBuddy(tab) {
    chrome.browserAction.setIcon({ path: 'icons/nzb_on.png', tabId: tab.id }, function () {
        if (chrome.runtime.lastError) console.log(chrome.runtime.lastError.message);
    });

    chrome.tabs.executeScript(tab.id, { file: "assets/jquery.min.js" });
    chrome.tabs.executeScript(tab.id, { file: "assets/toastr.min.js" });
    chrome.tabs.insertCSS(tab.id, { file: "assets/toastr.min.css" });
    chrome.tabs.executeScript(tab.id, { file: "assets/content.js" });
}


function processSearch(tabId, search) {
    if (settings.local.debug) console.log("----------------------------------------");
    if (settings.local.debug) console.log("processing nzb search", search);

    if (!search.header && !search.url) {
        chrome.tabs.sendMessage(tabId, { 'errror': 'Es sind keine Suchparameter gesetzt!' })
        return false;
    }

    //jQuery.post('https://www.nzbindex.nl/agree/', {'agree': 'I agree'})
    //jQuery.post('http://nzbindex.nl/disclaimer', {'agree': 'I agree'}).done();

    var _results = [];
    search.category = guessCategoryFromTitle(search.selection || search.title);
    search.title = cleanupTitle(search.selection || search.title);

    // direct nzb link
    // müsste neu getestet werden
    if (search.url && (search.url.substr(search.url.length - 4) === ".nzb" || search.provider === 'attachment')) {
        console.log("handle attachment or direct link", search);

        chrome.tabs.sendMessage(tabId, {
            'title': 'Wie soll der Download heißen?',
            'search': search,
            'results': [{
                'id': 'attachment1',
                'title': search.link,
                'desc': '',
                'nzb': search.url
            }, {
                'id': 'attachment2',
                'title': search.title,
                'desc': '',
                'nzb': search.url
            }]
        });
        /*
        _nzbClient('add', {
            'url': search.url,
            'title': _title + (search.pass ? '{{' + search.pass + '}}' : ''),
            'category': search.category
        },
            function (response) {
                chrome.notifications.create({
                    type: 'basic',
                    priority: 1,
                    iconUrl: chrome.runtime.getURL((typeof response.error === "undefined" ? 'icons/nzb_on.png' : 'icons/nzb_off.png')),
                    title: cleanupTitle(search.title),
                    message: search.url,
                }, function (notificationId) {
                    resetSearchData();
                    setInterval(function () {
                        chrome.notifications.clear(notificationId);
                    }, 2500);
                });
            });*/
        return;
    } 
    else if (search.provider === 'nzblnk') {
        // format:  nzblnk://?t=Lethal.Weapon.S02E01.GERMAN.DL.DUBBED.1080p.WebHD.h264-VoDTv&h=x6O4ZqE9A0rxv8TPV3p6ln333533QM&p=3RxWNJo5bRe42QKvLEwh
        // für nzblnk wird reguläre NZB Suche bei nzbindex gemacht

        // extrachiere Header + TItel + PW aus dem nzblnk
        _title = /[?&]t=([^&]+)/g.exec(search.url);
        _header = /[?&]h=([^&]+)/g.exec(search.url);
        _pass = /[?&]p=([^&]+)/g.exec(search.url);

        search.title = cleanupTitle(decodeURI(_title[1]));
        search.category = guessCategoryFromTitle(decodeURI(_title[1]));
        search.header = _header[1];
        search.pass = (_pass === null ? false : _pass[1]);
        search.url = '';
        if (settings.local.debug) console.log("search data", search);

        searchNzbindex(search.header)
            .then(function (results) {
                if (settings.local.debug) console.log("searchNzbindex done", results);
                processSearchResults(tabId, search, results);
            })
            .fail(function (error) {
                if (settings.local.debug) console.log('searchNzbindex failed', error);
                if (error === 'Nix gefunden :(') {
                    chrome.tabs.sendMessage(tabId, { 'warning': 'Suche bei NZBindex ergab keine Treffer, suche bei Binsearch...' });
                    
                    searchBinsearch(search.header)
                        .then(function (results) {
                            if (settings.local.debug) console.log("searchBinsearch done", results);
                            processSearchResults(search, results);
                        })
                        .fail(function (error) {
                            if (settings.local.debug) console.log('searchBinsearch failed', error);
                            if (error === 'Nix gefunden :(') {
                                chrome.tabs.sendMessage(tabId, { 'warning': 'Suche bei NZBindex ergab keine Treffer, suche bei Binsearch...' });
                            }
                        });
                    return;
                    searchBinsearch(search.header)
                        .then(function (results) {
                            if (settings.local.debug) console.log("searchBinsearch done", results);
                            processSearchResults(search, results);
                        })
                        .fail(function (error) {
                            if (settings.local.debug) console.log('searchBinsearch failed', error);
                            if (error === 'Nix gefunden :(') {
                                chrome.tabs.sendMessage(tabId, { 'warning': 'Suche bei NZBindex ergab keine Treffer, suche bei Binsearch...' });
                            }
                        });
                }
            });
    } 
    else if (search.provider === 'nzbindex') 
    {
        _header = /[?&]q=([^&]+)/g.exec(search.url);

        search.header = _header[1];
        search.url = '';

        searchNzbindex(search.header)
            .then(function (results) {
                if (settings.local.debug) console.log("searchNzbindex done", results);
                processSearchResults(tabId, search, results);
            })
            .fail(function (error) {
                if (settings.local.debug) console.log('searchNzbindex failed', error);
                if (error === 'Nix gefunden :(') {
                    //chrome.tabs.sendMessage(tabId, { 'warning': 'Suche bei NZBindex ergab keine Treffer, suche bei NZBKing...' });

                    searchNzbKing(search.header)
                        .then(function (results) {
                            if (settings.local.debug) console.log("searchNzbKing done", results);
                            processSearchResults(tabId, search, results);
                        })
                        .fail(function (error) {
                            if (settings.local.debug) console.log('searchNzbKing failed', error);
                            if (error === 'Nix gefunden :(') {
                                chrome.tabs.sendMessage(tabId, { 'warning': 'Suche bei NzbKing ergab keine Treffer.' });
                            }
                        });
                }
            });
    }
    else if (search.provider === 'findnzb') 
    {
        searchFindNZB(search.header)
        .then(function (results) {
            if (settings.local.debug) console.log("searchFindNZB done", results);
            processSearchResults(tabId, search, results);
        })
        .fail(function (error) {
            if (settings.local.debug) console.log('searchFindNZB failed', error);
            if (error === 'Nix gefunden :(') {
                chrome.tabs.sendMessage(tabId, { 'warning': 'Suche bei FindNZB ergab keine Treffer' });
                return;
            }
        });
    }
    else if (search.provider === 'manual')
    {
        searchNzbindex(search.header)
            .then(function (results) {
                if (settings.local.debug) console.log("searchNzbindex done", results);
                processSearchResults(tabId, search, results);
            })
            .fail(function (error) {
                if (settings.local.debug) console.log('searchNzbindex failed', error);
                if (error === 'Nix gefunden :(') {
                    chrome.tabs.sendMessage(tabId, { 'warning': 'Suche bei NZBindex ergab keine Treffer, suche bei Binsearch...' });
                    return;
                    searchBinsearch(search.header)
                        .then(function (results) {
                            if (settings.local.debug) console.log("searchBinsearch done", results);
                            processSearchResults(search, results);
                        })
                        .fail(function (error) {
                            if (settings.local.debug) console.log('searchBinsearch failed', error);
                            if (error === 'Nix gefunden :(') {
                                chrome.tabs.sendMessage(tabId, { 'warning': 'Suche bei NZBindex ergab keine Treffer, suche bei Binsearch...' });
                            }
                        });
                }
            });
    }



    // NZB Suche


    //_results = await searchNzbindex(search.header);

    // nzbindex

    //console.log("disaclaimer",data);

    //if (settings.local.debug) console.log("nzbindex results", _results);

    /*
    if (_results.length == 0) sendMessage(tabId,{'error': 'nix gefunden :('});
    else
    {

    }*/


    //processNzbindexResults(json, true);
    // fallback binsearch oder so
}

function searchNzbindex(header) {
    var d = $.Deferred();
/*
    $.ajax({
        url: 'https://nzbindex.nl/disclaimer',
        method: 'POST',
        data: { 'agree': 'I agree' },
    })
        .done(function () {
*/
            var results = [];
            $.ajax({
                url: 'https://nzbindex.nl/search/json?q=' + header, // + '&sort=agedesc&hidespam=1',
                dataType: 'json', // @todo: json??
                cache: false
            })
                .done(function (json) {
                    if (settings.local.debug) console.log("nzbindex json search done", json);

                    if (json.stats.total > 0) {
                        // was gefunden, ergebnisse filtern
                        json.results.forEach(function (_result) {
                            //regexp matching for filtering
                            var _regexp = (header && header !== '' ? new RegExp(header.toLowerCase().replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&").replace(/\s/g, ".+"), 'i') : false);
                            if (!_regexp || _regexp.test(_result.name)) {
                                results.push({
                                    'id': _result.id,
                                    'title': wieGross(_result.size) + ' // ' + wieAlt(_result.posted),
                                    'desc': _result.name,
                                    'nzb': 'https://nzbindex.nl/download/' + _result.id + '/'
                                });
                            }
                        });

                        // nochmal ohne Filter, wenn gefilterte results leer sind
                        if (results.length === 0) json.results.forEach(function (_result) {
                            results.push({
                                'id': _result.id,
                                'title': wieGross(_result.size) + ' // ' + wieAlt(_result.posted),
                                'desc': _result.name,
                                'nzb': 'https://nzbindex.nl/download/' + _result.id + '/'
                            });
                        });

                        return d.resolve(results);
                    }
                    // es wurde gar nix über JSON gefunden.
                    else return d.reject("Nix gefunden :(");
                })
                .fail(function (error) {
                    if (settings.local.debug) console.log('nzbindex json search failed', error);
                    // fallback über HTTP Suche

                    $.ajax({
                        url: 'https://nzbindex.nl/?q=' + header + '&sort=agedesc&hidespam=1',
                        cache: false
                    })
                        .done(function (html) {
                            if (settings.local.debug) console.log('nzbindex http search done', html);
                        })
                        .fail(function (error) {
                            if (settings.local.debug) console.log('nzbindex http search failed', error);
                            return d.reject(error);
                        });

                    /*
                    if (search.data.provider === 'newzleech') {
                        // newzleech
                        console.log("results html",$(html).find('table.bigsearch-table'));
                        $(html).find('table.bigsearch-table').find('tr[class^="content"]').each(function () {
                            console.log(this);
                            search.results.push({
                                'title': $(this).find('td.subject').text().replace(/["'<>]/gi, "").toLowerCase(),
                                'desc': $(this).find('td.size').text().trim() + ' | ' + $(this).find('td.age').text().trim(),
                                'nzb': 'https://www.newzleech.com/' + $(this).find('td.get a').attr('href')
                            });
                        });
                    }*/

                    //processNzbindexResults(json);
                    //processSearchResults();

                    return d.reject(error);

                    /*
                    jQuery.getJSON(_url.replace('https:', 'http:'))
                          .done(function (json)
                          {
                              //processNzbindexResults(json, false);
                              //processSearchResults();
                          })
                          .fail(function (data)
                          {
                              alert("nzbindex.nl konnte nicht aufgerufen werden");
                              console.log(data);
                          });
                     */
                });
/*
        })
        .fail(function (error) {
            if (settings.local.debug) console.log('nzbindex disclaimer failed', error);
            d.reject(error);
        });
*/
    return d.promise();
}

function searchNzbKing(header) {
    var d = $.Deferred();
    var results = [];
    $.ajax({
        url: 'https://www.nzbking.com/search/?q=' + header, // + '&sort=agedesc&hidespam=1',
        cache: false
    })
    .done(function (html) {
        if (settings.local.debug) console.log("NZBKing search done", html);

        $(html).find('div.search-results-group').first().children().each(function (index, element) {
            if(index === 0) return;
            //console.log(element);

            var _link = $(element).find('.search-subject').first().find('a.button').first().attr('href');
            //var _link = new URLSearchParams($(element).find('.search-subject').first().find('a.button').first().attr('href'));
            //console.log("https://www.nzbking.com/"+_link);

            results.push({
                'title': $(element).find('.search-age').text().trim(),
                'desc': $(element).find('.search-subject').text().trim(),
                'nzb': "https://www.nzbking.com/"+_link
            });
            
        });

        if(results.length > 0) return d.resolve(results);
        else return d.reject("Nix gefunden :(");
    })
    .fail(function (error) {
        if (settings.local.debug) console.log('NZBKing search failed', error);            
    });

    return d.promise();
}

function searchFindNZB(header) {
    var d = $.Deferred();
    var results = [];
    $.ajax({
            url: 'https://findnzb.net/?q=' + header, // + '&init=form&sort=relevance&limit=25',
            cache: false
        })
        .done(function (html) {
            if (settings.local.debug) console.log("findnzb search done", html);

            
            $(html).find('table.results tbody').first().children().each(function (index, element) {
                if(index === 0) return;
                //console.log(element);
                
                var _link = new URLSearchParams($(element).find('td').last().find('a').attr('href'));

                results.push({
                    'title': $(element).find('td .big a').text().trim() + ' | ' + $(element).children('td').eq(4).text().trim(),
                    'desc': $(element).children('td').eq(1).text(),
                    'nzb': _link.get("url")
                });
                
            });
            //console.log(results);
            // https://findnzb.net/nzb/?collection=217589111&uuid=919965ad-2f87-5123-f096-c3fb6cd0cbb8&q=5f413375bc9e4ad7807063f29a22382a#
            // https://findnzb.net/get/collection/VG5kS0ZOVi9ydkJhSWNqazJkMnhkdi9KNkl5ZVBRT05QcHNwL1pURTV4TStueE9rKytDdmYxVUFYU2E1QWdBM0hMazNCTEY4/?save=5f413375bc9e4ad7807063f29a22382a
           //  http://findnzb.net/get/collection/VG5kS0ZOVi9ydkJhSWNqazJkMnhkdi9KNkl5ZVBRT05QcHNwL1pURTV4TStueE9rKytDdmYxVUFYU2E1QWdBM0hMazNCTEY4/?save=5f413375bc9e4ad7807063f29a22382a

            if(results.length > 0) return d.resolve(results);
            else return d.reject("Nix gefunden :(");
        })
        .fail(function (error) 
        {
            if (settings.local.debug) console.log('findnzb search failed', error);            
        });

    return d.promise();
}

function searchBinsearch(header,allgroups = false) {
    var d = $.Deferred();
    var results = [];

    $.ajax({
        url: 'https://www.binsearch.info/?max=100&q=' + header + (allgroups ? '&server=2' : ''),
        cache: false
    })
        .done(function (html) {
            html = $.parseHTML(html);
            if (settings.local.debug) console.log("binsearch search done", html);
            /*html.find('table#r2').each(function (index)
                {
                    console.log(index, this);
                }
            );*/
            $(html).find('table#r2').each(function (index) {
                console.log(index, this);
            });

            /*
            $(div).html(html).find(' tr').each(function (index)
            {
                console.log(index, this);
                search.results.push({
                    'title': $(this).find('td.subject').text().replace(/["'<>]/gi, "").toLowerCase(),
                    'desc': $(this).find('td.size').text().trim() + ' | ' + $(this).find('td.age').text().trim(),
                    'nzb': 'https://www.newzleech.com/' + $(this).find('td.get a').attr('href')
                });
            });
                 if (json.stats.total > 0)
                 {
                     // was gefunden, ergebnisse filtern
                     json.results.forEach(function (_result)
                     {
                         //regexp matching for filtering
                         var _regexp = (header && header !== '' ? new RegExp(header.toLowerCase().replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&").replace(/\s/g, ".+"), 'i') : false);
                         if (!_regexp || _regexp.test(_result.name))
                         {
                             results.push({
                                 'id': _result.id,
                                 'title': Math.floor(_result.size / 1024 / 1024) + ' MB // ' + wieAlt(_result.posted),
                                 'desc': _result.name,
                                 'nzb': 'https://nzbindex.nl/download/' + _result.id + '/'
                             });
                         }
                     });
   
                     // nochmal ohne Filter, wenn gefilterte results leer sind
                     if(results.length === 0) json.results.forEach(function (_result)
                     {
                         results.push({
                             'id': _result.id,
                             'title': Math.floor(_result.size / 1024 / 1024) + ' MB: ' + wieAlt(_result.posted),
                             'desc': _result.name,
                             'nzb': 'https://nzbindex.nl/download/' + _result.id + '/'
                         });
                     });
   
                     return d.resolve(results);
                 }
                 // es wurde gar nix über JSON gefunden.
                 else return d.reject("Nix gefunden :(");
                     */
        })
        .fail(function (error) {
            if (settings.local.debug) console.log('nzbindex json search failed', error);
            return d.reject(error);
        })

    return d.promise();
}

function processSearchResults(tabId, search, results) {
    if (results.length === 0) chrome.tabs.sendMessage(tabId, { 'error': 'nix gefunden :(' });
    else if (results.length === 1) {
        // ein einziges Ergebnis => hinzufügen
        if (settings.local.debug) console.log('nur 1 gefunden');
        enqueueNzb({
            'url': results[0].nzb,
            'title': search.title.replace(/\./g, ' ') + (search.pass ? '{{' + search.pass + '}}' : ''),
            'cleantitle': search.title.replace(/\./g, ' '),
            'category': search.category,
            'desc': results[0].title + "\r\n" + results[0].desc
        }, tabId);
    } else if (results.length < 6) {
        if (settings.local.debug) console.log('processing multiple results');
        chrome.tabs.sendMessage(tabId, { 'search': search, 'results': results });
    } else {
        chrome.tabs.sendMessage(tabId, { 'warning': results.length + ' Treffer für die Suche' });
        chrome.tabs.create({ url: 'https://nzbindex.nl/?q=' + search.header + '&sort=agedesc&hidespam=1' });
    }
}

function enqueueNzb(nzb, tabId) {
    if (settings.local.debug) console.log("enqueuing nzb", nzb)
    _nzbClient('add', {
        'url': nzb.url,
        'title': nzb.title,
        'category': nzb.category || "default"
    },
        function (response) {
            if (settings.local.debug) console.log("enqueuing nzb response", response);
            //console.log(typeof response);
            //if(response.status === true)chrome.tabs.sendMessage(tabId, { 'success': nzb.cleantitle || nzb.title, 'msg': 'hinzugefügt in Kategorie "'+ nzb.category+'"' }); // success

            if (typeof response.error === "undefined") chrome.tabs.sendMessage(tabId, { 'success': nzb.cleantitle || nzb.title, 'msg': 'hinzugefügt in Kategorie "'+ nzb.category+'"' }); // success
            else if (typeof response.error !== "undefined") chrome.tabs.sendMessage(tabId, { 'error': 'Das hat jetzt nicht funktioniert!', 'msg': 'Läuft der NZB Client?' }); // error
        });
}

// postprocessing
function guessCategoryFromTitle(title) {
    if (settings.local.debug > 1) console.log("guess category from title: " + title);
    if (typeof title === "undefined" || !title) return "default";
    else if (title.search(/u?n?censored|xxx|sex|erotic/i) > -1) return 'xxx';
    else if (title.search(/(s\d{1,2})?e\d{1,2}|episode\s?\d{1,2}|\d{1,2}x\d{1,2}/i) > -1) return 'tv';
    else if (title.search(/s\d{1,2}/i) > -1) return 'default'; // staffel komplett
    else if (title.search(/2160p|1080p|720p|UHD|FHD|HD/i) > -1) return 'movie';
    return "default";
}

function cleanupTitle(title) {
    if (!this.settings.global.titlecleanup) return title;
    if (settings.local.debug > 1) console.log("cleaning title: " + title);
    title = title.replace(/\++/g, " "); // + wegmachen
    //if (settings.local.debug > 1) console.log(this.settings.global.titlereplaces);
    this.settings.global.titlereplaces.forEach(function (_str) {
        var re = new RegExp('(\\.|\\s)(' + _str + ')', 'gi');
        if (settings.local.debug > 1) console.log( "-----");
        if (settings.local.debug > 1) console.log( "| regex:" ,re);
        if (settings.local.debug > 1) console.log( "| " + title );
        if (settings.local.debug > 1) console.log( "| " + title.replace(re, ""));
        title = title.replace(re, "");
    });
    if (settings.local.debug > 1) console.log( "-----");
    title = title.replace(/\(\s?\)/g, ""); // () wegmachen
    return title;
}

function wieGross(size) {
    var i = -1;
    var byteUnits = [' kB', ' MB', ' GB', ' TB', 'PB', 'EB', 'ZB', 'YB'];
    do {
        size = size / 1024;
        i++;
    } while (size > 1024);

    return Math.max(size, 0.1).toFixed(1) + byteUnits[i];
}

function wieAlt(timestamp) {
    var date = new Date(timestamp);
    var seconds = Math.floor((new Date() - date) / 1000);

    interval = Math.floor(seconds / 2592000);
    if (interval > 1) return interval + " Monate alt";

    interval = Math.floor(seconds / 86400);
    if (interval > 1) return interval + " Tage alt";

    interval = Math.floor(seconds / 3600);
    if (interval > 1) return interval + " Stunden alt";

    interval = Math.floor(seconds / 60);
    if (interval > 1) return interval + " Minuten alt";

    return Math.floor(seconds) + " Sekunden alt";
}



