function initNzbindexJS()
{
    $(document).on('click','.details .download a', function (e)
    {
        e.preventDefault();
        e.stopPropagation();

        console.log("adding nzb from nzbindex ", $(this).attr("href"));
        chrome.runtime.sendMessage({'add': {
                'url':$(this).attr("href"),
                'title':$(this),
                'desc':$(this).parents("td").find("label").text()
            }});
    });
}

initNzbindexJS();