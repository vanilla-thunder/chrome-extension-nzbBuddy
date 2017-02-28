console.log("nzbBuddy content script running!");

var debug = true;

var board = window.location.hostname.replace('.','');
var selector = {
    'usenet-4allinfo': {
        post: 'div[id^="post_message_"]',
        nzbname: 'input[type="text"]',
        thx: 'div[id^="enb_hhr_hide_thanks"]'
    },
    'ghost-of-usenetorg': {
        post: 'div[id^="post_message_"]',
        nzbname: '.info',
        thx: 'div[id^="enb_hhr_hide_thanks"]'
    }
}[board];

var $body = $("body");
console.log("board",board);
console.log("selectors",selector);

function createOverlay($link, $items)
{
    $("#dlpass").remove();

    var $post = $link.parents(selector.post),
        $container = $link.parents('td').first(),
        $thxcontent = $post.find(selector.thx),

        pagetitle = document.title,

        dltitle = '',
        dlpass = '',
        nzbname = '',
        nzbnameinput = $post.find(selector.nzbname);

    if(debug) console.log("nzbnameinput "+nzbnameinput.length,nzbnameinput);

    if( nzbnameinput.length == 1 ) // input with copy-paste nzb name for sabnzbd
    {
        console.log("nur 1!");
        nzbname = nzbnameinput.first().val();
        if(debug) console.log('title + pass: '+nzbname);
    }
    else if( nzbnameinput.length > 1 ) // input with copy-paste nzb name for sabnzbd
    {
        console.log("mehr als 1!");
        nzbnameinput.each(function(key,value) {
            console.log(key,value);
            console.log($(value).is("input"));
            console.log($(value).val().length);
            console.log($(value).text());
            if($(value).is("input") && $(value).val().length > nzbname.length) nzbname = $(value).val();
            else nzbname = $(value).text().search(/^.+{{.+}}$/mi);
        });
        //nzbname = $post.find('input').first().val();
        if(debug) console.log('title + pass: '+nzbname);
    }
    else if( $("b > font > font[color='#ae0000']", $post).length ) // parse post title
    {
        dltitle = $("b > font > font[color='#ae0000']", $post).first().text();
        if(debug) console.log('title: ' + dltitle);
    }
    else {
        if(debug) console.log("kein Titel gefunden. Nehme "+pagetitle);
    }

    var $pwcontainer = null;
    // get password from highlighted text
    if (window.getSelection && window.getSelection().toString().length)
    {
        if(debug) console.log('got password from window.getSelection()');
        var pass = null;
        pass = window.getSelection().toString();
        if(pass.length) {
            dlpass = pass;
            $pwcontainer = $(window.getSelection().getRangeAt(0).startContainer.parentNode);
        }
    }
    else if(document.selection && document.selection.type != "Control" && document.selection.createRange().text.length)
    {
        if(debug) console.log('got password from document.selection.createRange()');
        var pass = null;
        pass = document.selection.createRange().text;
        if(pass.length) {
            dlpass = pass;
            $pwcontainer = $(document.selection.createRange().parentElement());
        }
    }
    else if (!nzbname.length)
    {
        var i = 1;
        $thxcontent.each(function()
        {
            var fertig = false;
            if(debug) console.log("regex search for password in thx-content "+i);

            if( $match =  /passwor[dt].\s(.*)\s/gi.exec($(this).text()) )
            {
                if(debug) console.log("regex pass found");
                var pass = null;
                pass  = $match[1];
                if(pass.length) {
                    dlpass = pass;
                    $pwcontainer = $(this);
                    //fertig = true;
                    return false;
                }
            }
            if(debug) console.log(i+'. thx-content search finished');
            //if(fertig) return false;
            i++;
        });
    }

    if(dlpass.length)
    {
        $pwcontainer.html($pwcontainer.html().replace(dlpass,dlpass+' <b id="dlpass" style="color:green;"><- passwort wurde erkannt!</b> '));
        if(debug) console.log('password: '+dlpass);
        dlpass = '{{'+dlpass+'}}';
    }

    $("body").append('<div id="nzboverlay" style="display:none;position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0, 0, 0, 0.6);"><div id="nzbocontent" style="margin:10% 20%; background: white; border:2px solid black; border-radius: 15px; padding: 20px; "></div>');
    if($items.length > 0)
    {
        $items.forEach(function(item)
        {
            $('#nzbocontent').append('<button class="addNzb" data-title="'+(nzbname ? nzbname : dltitle)+'" data-alt="'+item.title+'" data-pass="'+dlpass+'" data-nzb="'+item.nzb+'" ' +
                'style="padding:10px; margin: 5px; display:block; background-color: inherit; background-repeat: no-repeat; background-position: bottom left; border; 1px dotted black; cursor: pointer;"><b>'+item.title+'</b><br/><small>'+item.desc+'</small></button>');
        });
    } else {
        $('#nzbocontent').append('<h2>sorry, nix gefunden :(</h2>');
    }
    $("#nzboverlay").fadeIn();

    // Change the onclick handler to send to sabnzbd
    $body.off('click','.addNzb');
    $body.on('click','.addNzb', function(event) {
        event.preventDefault();

        var title = $(this).data("title"),
            alt = $(this).data("alt"),
            pass = $(this).data("pass"),
            url = $(this).data("nzb");

        if(debug) console.log(title);
        if(debug) console.log(alt);
        if(debug) console.log(pass);

        // category
        if(document.title.match(/staffel|season/gi)) board = 'tv';
        else if(document.title.match(/bluray|hdtv|dts|ac3d|1080|uhd|2160|/gi)) board = 'movie';

        if(!title.length) title = pagetitle; //window.prompt("Ist der Titel in Ordnung?",alt);
        //console.log('send '+ title + ' : '+ url +' to SabNZBD');
        chrome.extension.sendMessage( {'add':true,'name':url, 'nzbname': title+pass, 'cat':board},
            function(response) {
                if(response == "ok") {
                    $(this).css("border-color","green");
                    $("#nzboverlay").fadeOut().remove();
                }
            });
        return false;
    });

    return false;
}

function handleSearchLink($link, $provider)
{
    // nzb password from selected text
    if (window.getSelection && window.getSelection().toString().length)
    {
        pass = window.getSelection().toString();
        if (pass.length) {
            dlpass = pass;
            if (debug) console.log('got password from window.getSelection: ',pass);
            $pwcontainer = jQuery(window.getSelection().getRangeAt(0).startContainer.parentNode);
        }
    }
    else if (document.selection && document.selection.type != "Control" && document.selection.createRange().text.length)
    {
        pass = document.selection.createRange().text;
        if (pass.length) {
            dlpass = pass;
            if (debug) console.log('got password from document.selection.createRange(): ',pass);
            $pwcontainer = jQuery(document.selection.createRange().parentElement());
        }
    }

    var url = $link.attr('href').replace('https://de-refer.me/?', '').replace('http://de-refer.me/?', '');
    var items = [];

    if (url.substr(url.length - 4) == ".nzb") // direct link
    {
        if (debug) console.log('direct link');
        addToSABnzbd(jQuery(this), url, "addurl", "", "usenet-4all");
    }
    else
    {
        if (debug) console.log('processing ' + $provider + ' search: ' + url);
        var q = url.match(/(q=[^&\n]+)/);

        if ($provider == 'nzbclub') {
            jQuery.get(url, function (html) {
                jQuery(html).find('#ui_searchResult').find('.media').each(function () {
                    items.push({
                        'title': jQuery('.text-muted', jQuery(this)).text().replace(/[^\d\w\s]/gi, ""),
                        'desc': jQuery('.row', jQuery(this)).children('.col-xs-2.col-md-1').first().text() + ' | ' + jQuery('.row', jQuery(this)).children('.col-xs-2.col-md-1').last().text(), //.replace(/[^\d\w\s]/gi, ""),
                        'nzb': 'https://www.nzbclub.com/nzb_get/' + jQuery('.project-action', jQuery(this)).attr('collectionid')
                    });
                });
                if (debug) console.log('items:');
                if (debug) console.log(items);
                createOverlay($link, items);
            }, "html").fail(function () {
                alert("Link konnte nicht abgerufen werden, bitte versuch einen anderen Link");
            });
        }
        else if ($provider == 'nzbindex') {
            jQuery.get(url, function (html) {
                jQuery(html).find('#results').find('input[type="checkbox"]').each(function () {
                    //console.log('this');
                    //console.log(this);
                    var _title = jQuery(this).parent().next().find('label').text().replace(/["'<>]/gi, "").toLowerCase(),
                        check = q[1].substr(2).split(" "),
                        ok = 0;
                    console.log('_title');
                    console.log(_title);
                    console.log('check');
                    console.log(check);
                    for (var i = 0; i < check.length; i++) {
                        if (_title.indexOf(check[i].toLowerCase()) != -1) ok++;
                    }
                    if (ok == check.length) items.push({
                        'title': _title,
                        'desc': jQuery(this).parent().next().next().next().next().text() + ' | ' + jQuery(this).parent().next().next().find('div').first().text() + ' | ' + jQuery(this).parent().next().find('div.info').text().replace(/[<>]/gi, ""),
                        'nzb': jQuery(this).parent().next().find('a[href*="/download/"]').attr('href')
                    });
                });
                if (debug) console.log('items:');
                if (debug) console.log(items);
                createOverlay($link, items);
            }, "html").fail(function () {
                alert("Link konnte nicht abgerufen werden, bitte versuch einen anderen Link");
            });
        }
        else if ($provider == 'binsearch') {
            jQuery.get(url, function (html) {
                jQuery(html).find('.xMenuT').find('input[type="checkbox"]').each(function () {

                    items.push({
                        'title': jQuery(this).parent().next().find('.s').text().replace(/[<>]/gi, ""),
                        'desc': jQuery(this).parent().next().find('.d').text().replace(/[<>]/gi, ""),
                        'nzb': 'https://www.binsearch.info/?action=nzb&' + jQuery(this).attr("name") + '=1'
                    });
                });
                createOverlay($link, items);
            }, "html");
        }
        else {
            console.log('not doing anything');
        }
    }


}
$body.on('click', '#nzboverlay', function (e) { $("#nzboverlay").fadeOut().remove(); });
$body.on('click', 'a[href*="nzbclub.com/search.aspx"]', function (e) {
    e.preventDefault();
    handleSearchLink(jQuery(this), 'nzbclub')
});
$body.on('click', 'a[href*="nzbindex.com/search/?"]', function (e) {
    e.preventDefault();
    handleSearchLink(jQuery(this), 'nzbindex')
});
$body.on('click', 'a[href*="nzbindex.nl/search/?"]', function (e) {
    e.preventDefault();
    handleSearchLink(jQuery(this), 'nzbindex')
});
$body.on('click', 'a[href*="binsearch.info/?"]', function (e) {
    e.preventDefault();
    handleSearchLink(jQuery(this), 'binsearch')
});