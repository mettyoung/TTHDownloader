var EventEmitter = require("events").EventEmitter;
var AsyncHttps = require('./async_https.js');
var util = require("util");
var Entities = require('html-entities').AllHtmlEntities;
entities = new Entities();

var asyncHttps = new AsyncHttps(50);

function LibraryParser(directoryName, library, cookies) 
{
    var patternForSectionTitle = /<h2.*?>\s+(.*)/g;
    var patternForVideoPages = /<a.*?href="(.*?)">?\s+.*?<p>(.*?)<\/p>/g;
    var patternForVideo = /\d{1,2}:\d{1,2}/g;
    var patternForSections = /<ul.*?>(.*?)<\/ul>/g;

    var workshopPatterns = 
    {
        videoListContainer: /<ul id="workshop-videos">(.*?)<\/ul>/g,
        videoDisplay: /<a id="workshop-hero".*?href="(.*?)"/g,
        video: /a href="(.*?)"/g
    };
 
    EventEmitter.call(this);
    var emitter = this;

    directoryName += "/" + library.name;
    console.log("Directory to be created: " + directoryName);

    asyncHttps.setCookies(cookies);

    if (library.type === 'Course')
    {
        // Parses and creates sub-directories for the different stages.
        asyncHttps.get(library.url + "/stages").on("end", (body) =>
        {
            var matches = null;
            var subMatches = null;

            var i = 0;
            var subDirectories = [];
            while ((matches = patternForSectionTitle.exec(body)) !== null) 
            {
                if (matches.length > 1)
                {
                    var subDirectoryName = directoryName + "/" + "Stage-" + ++i + " " + entities.decode(matches[1]);
                    subDirectories.push(subDirectoryName);
                    console.log("Directory to be created: " + subDirectoryName);
                }
            }

            // Since Javascript RegEx's . wildcard does not include newlines, we must remove all newlines.
            body = body.replace(/\n/g, '');

            var i = 0;
            var libraries = [];

            while ((matches = patternForSections.exec(body)) !== null) 
            {
                var urls = [];
                if (matches.length > 1)
                {
                    var subBody = matches[1];

                    while ((subMatches = patternForVideoPages.exec(subBody)) !== null)
                        if (subMatches[2].search(patternForVideo) > -1)
                            urls.push("https://teamtreehouse.com" + subMatches[1]);


                    emitter.emit("eachSection", subDirectories[i], urls);

                    libraries.push({
                        directory: subDirectories[i++], 
                        urls: urls
                    });
                }
            }
            emitter.emit("end", libraries);
        });
    }
    else if (library.type === 'Workshop')
    {
        // Parses url with video and subDirectory set to ''.
        asyncHttps.get(library.url).on("end", (body) =>
        {
            var matches = null;
            var subMatches = null;
            // Since Javascript RegEx's . wildcard does not include newlines, we must remove all newlines.
            var libraries = [];
            body = body.replace(/\n/g, '');

            // Find if it has multiple videos.
            if ((matches = workshopPatterns.videoListContainer.exec(body)) !== null)
            {
                if (matches.length <= 1)
                    throw new Error("Failed to parsed workshop with pattern " + workshopPatterns.videoListContainer);

                var urls = [];
                // If yes, then get all videos.
                while ((subMatches = workshopPatterns.video.exec(matches[1])) !== null)
                {
                    if (subMatches.length <= 1)
                        throw new Error("Failed to parsed workshop with pattern " + workshopPatterns.video);
                    urls.push("https://teamtreehouse.com" + subMatches[1]);
                }

                libraries.push({
                    directory: directoryName, 
                    urls: urls
                });
            }
            else 
            {
                // If no, then get the video display.
                matches = workshopPatterns.videoDisplay.exec(body);
                if (matches === null || matches.length <= 1)
                    throw new Error("Failed to parsed workshop with pattern " + workshopPatterns.videoDisplay);

                libraries.push({
                    directory: directoryName, 
                    urls: ["https://teamtreehouse.com" + matches[1]]
                });
            }
            emitter.emit("end", libraries);
        });
    }
    else 
        throw new Error(library.type + " is not supported by the downloader!");
}

util.inherits(LibraryParser, EventEmitter );

module.exports = LibraryParser;