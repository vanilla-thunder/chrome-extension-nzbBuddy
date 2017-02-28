var debug = true;

var selector = {
    'usenet-4all.info': {
        post: 'div[id^="post_message_"]',
        thx: 'div[id^="enb_hhr_hide_thanks"]',
        nzbname: 'input[type="text"]',
        urlregex: 'https?:\/\/de-refer\.me\/\?'
    },
    'wwwg.host-of-usenet.orgg': {
        post: 'div[id^="post_message_"]',
        thx: 'div[id^="enb_hhr_hide_thanks"]',
        nzbname: 'input[type="text"]'
    }
}[window.location.hostname];


var $body = $("body");

function createOverlay($link, $items) {
    $("#dlpass").remove();

    if (typeof selector !== "undefined") {
        // es gibt Selektoren für diese Seite

        if (debug) console.log("selectors set found:");
        if (debug) console.log(selector);

        var $post = $link.parents(selector.post),
            //$container = $link.parents('td').first(),
            $thxcontent = $post.find(selector.thx),

            pagetitle = document.title,

            dltitle = '',
            dlpass = '',
            nzbname = '',
            nzbnameinput = $post.find(selector.nzbname);

        if (debug) console.log(nzbnameinput);

        if (nzbnameinput.length == 1) // input with copy-paste nzb name for sabnzbd
        {
            nzbname = $post.find('input').first().val();
            if (debug) console.log('title + pass: ' + nzbname);
        }
        else if (nzbnameinput.length > 1) // input with copy-paste nzb name for sabnzbd
        {
            nzbnameinput.each(function (key, value) {
                if ($(value).val().length > nzbname.length) nzbname = $(value).val();
            });
            //nzbname = $post.find('input').first().val();
            if (debug) console.log('title + pass: ' + nzbname);
        }
        else if ($("b > font > font[color='#ae0000']", $post).length) // parse post title
        {
            dltitle = $("b > font > font[color='#ae0000']", $post).first().text();
            if (debug) console.log('title: ' + dltitle);
        }
        else {
            if (debug) console.log("kein Titel gefunden. Nehme " + pagetitle);
        }

        var $pwcontainer = null;
        // get password from highlighted text
        if (window.getSelection && window.getSelection().toString().length) {
            if (debug) console.log('got password from window.getSelection()');
            var pass = null;
            pass = window.getSelection().toString();
            if (pass.length) {
                dlpass = pass;
                $pwcontainer = $(window.getSelection().getRangeAt(0).startContainer.parentNode);
            }
        }
        else if (document.selection && document.selection.type != "Control" && document.selection.createRange().text.length) {
            if (debug) console.log('got password from document.selection.createRange()');
            var pass = null;
            pass = document.selection.createRange().text;
            if (pass.length) {
                dlpass = pass;
                $pwcontainer = $(document.selection.createRange().parentElement());
            }
        }
        else if (!nzbname.length) {
            var i = 1;
            $thxcontent.each(function () {
                var fertig = false;
                if (debug) console.log("regex search for password in thx-content " + i);

                if ($match = /passwor[dt].\s(.*)\s/gi.exec($(this).text())) {
                    if (debug) console.log("regex pass found");
                    var pass = null;
                    pass = $match[1];
                    if (pass.length) {
                        dlpass = pass;
                        $pwcontainer = $(this);
                        //fertig = true;
                        return false;
                    }
                }
                if (debug) console.log(i + '. thx-content search finished');
                //if(fertig) return false;
                i++;
            });
        }

        if (dlpass.length) {
            $pwcontainer.html($pwcontainer.html().replace(dlpass, dlpass + ' <b id="dlpass" style="color:green;"><- passwort wurde erkannt!</b> '));
            if (debug) console.log('password: ' + dlpass);
            dlpass = '{{' + dlpass + '}}';
        }
        // es gibt Selektoren für diese Seite ----------------------------------------------------------------------------------------------------------------------- es gibt Selektoren für diese Seite
    }
    else {
        // es gibt keine Selektore, nehme den markierten Text
        if (window.getSelection && window.getSelection().toString().length) {
            if (debug) console.log('got password from window.getSelection()');
            var pass = null;
            pass = window.getSelection().toString();
            if (pass.length) {
                dlpass = pass;
                $pwcontainer = $(window.getSelection().getRangeAt(0).startContainer.parentNode);
            }
        }
    }


    $("body").append('<div id="nzboverlay" style="display:none;position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0, 0, 0, 0.6);"><div id="nzbocontent" style="margin:10% 20%; background: white; border:2px solid black; border-radius: 15px; padding: 20px; "></div>');
    if ($items.length > 0) {
        $items.forEach(function (item) {
            $('#nzbocontent').append('<button class="addNzb" data-title="' + (nzbname ? nzbname : dltitle) + '" data-alt="' + item.title + '" data-pass="' + dlpass + '" data-nzb="' + item.nzb + '" ' +
                'style="padding:10px; margin: 5px; display:block; background-color: inherit; background-repeat: no-repeat; background-position: bottom left; border; 1px dotted black; cursor: pointer;"><b>' + item.title + '</b><br/><small>' + item.desc + '</small></button>');
        });
    } else {
        $('#nzbocontent').append('<h2>sorry, nix gefunden :(</h2>');
    }
    $("#nzboverlay").fadeIn();

    // Change the onclick handler to send to sabnzbd
    $body.off('click', '.addNzb');
    $body.on('click', '.addNzb', function (event) {
        event.preventDefault();

        var title = $(this).data("title"),
            alt = $(this).data("alt"),
            pass = $(this).data("pass"),
            url = $(this).data("nzb");

        if (debug) console.log(title);
        if (debug) console.log(alt);
        if (debug) console.log(pass);

        // category
        if (document.title.match(/staffel|season/gi)) board = 'tv';
        else if (document.title.match(/xxx|erotic/gi) || title.match(/xxx|erotic/gi)) board = 'xxx';
        else if (document.title.match(/bluray|hdtv|dts|ac3d|1080|uhd|2160|/gi)) board = 'movie';

        if (!title.length) title = pagetitle; //window.prompt("Ist der Titel in Ordnung?",alt);
        //console.log('send '+ title + ' : '+ url +' to SabNZBD');
        chrome.extension.sendMessage({'add': true, 'name': url, 'nzbname': title + pass, 'cat': board},
            function (response) {
                if (response == "ok") {
                    $(this).css("border-color", "green");
                    $("#nzboverlay").fadeOut().remove();
                }
            });
        return false;
    });

    return false;
}

function handleSearchLink($link, $provider) {
    console.log(selector);
    if (typeof selector !== 'undefined') // selector vorhanden
    {
        var $post = $link.parents(selector.post),
            $thx = $post.find(selector.thx),
            $nzbname = $post.find(selector.nzbname),
            nzbname = '';

        console.log('$nzbname:');
        console.log($nzbname);
        console.log('$thx:');
        console.log($thx);



        if ($nzbname.length == 1) nzbname = $nzbname.val();
        else $nzbname.each(function () { nzbname = ($(this).val().length > nzbname.length) ? $(this).val() : nzbname; });

        if(nzbname.indexOf('{{') == -1 || nzbname.indexOf('}}') == -1 ) console.log("nix pw!!");
        //else console.log("pw drin!");
        //console.log(nzbname);
    }
    var nzb = {
        title: nzbname,
        url: $link.attr("href")
    };
    console.log("nzb:");
    console.log(nzb);
    chrome.runtime.sendMessage({'nzb': nzb, 'provider': $provider});
}


function initJS() {
    // direct nzblink usenet-4all.info
    $(document).on('click', 'a[href*="nzblnk:?"]', function (e) {
        e.preventDefault();
        e.stopPropagation();
        chrome.runtime.sendMessage({'nzb': {'url': jQuery(this).attr('href').replace('https://de-refer.me/?', '').replace('http://de-refer.me/?', '')}, 'provider': 'nzblink'});
    });

    var links = [
        {provider: 'nzbclub', link: 'a[href*="nzbclub.com/search.aspx"]'},
        {provider: 'nzbindex', link: 'a[href*="nzbindex.com/search/?"]'},
        {provider: 'nzbindex', link: 'a[href*="nzbindex.nl/search/?"]'},
        {provider: 'binsearch', link: 'a[href*="binsearch.info/?"]'},
    ];

    links.forEach(function (element, index, array) {
        //console.log("verarbeite "+element.provider+" links: "+element.link);
        $(element.link).off();
        //$(element.link).unbind();
        $(document).on('click', element.link, function (e) {
            e.preventDefault();
            e.stopPropagation();
            handleSearchLink(jQuery(this), element.provider);
        });
    });
}
initJS();