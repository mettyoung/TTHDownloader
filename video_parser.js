var EventEmitter = require("events").EventEmitter;
var AsyncHttps = require('./async_https.js');
var https = require("https");
var util = require("util");
var asyncHttps = new AsyncHttps(50);

/**
 * An EventEmitter to get the video link for the treehouse video using a customized regex.
 * @param url 
 * @constructor
 */

function VideoParser(sequenceNumber, directory, url, cookies) 
{
    // If this VideoParser is invoked with the new keyword, an object is created.
    // this is the same as "var newObject = new EventEmitter()"
    EventEmitter.call(this);

    var emitter = this;

    asyncHttps.setCookies(cookies);
    asyncHttps.get(url).on("end", (body) => 
    {
        var patternForVideoStream = /mp4"\s+src="(.*?)"/g;
        var patternForTitle = /<h1>(.*?)<\/h1>/g;
        try 
        {
            var downloadLink = patternForVideoStream.exec(body)[1];
            var filename = "Video-" + sequenceNumber + " " + patternForTitle.exec(body)[1] + ".mp4";  
            emitter.emit("end", directory, downloadLink, filename);
        }
        catch(error)
        {
            emitter.emit("error", error);
        }
    });
}

util.inherits( VideoParser, EventEmitter );

module.exports = VideoParser;