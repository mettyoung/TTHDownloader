var patternForTrackTitle = /<h2>(.*?)<\/h2>/g;
var patternForCourseUrls = /<a.*?card-box.*?href="(.*?)"/g;
var patternForCourseNames = /<strong.*>(.*)<\/strong>\n.*<h3.*?card-title.>(.*?)<\/h3>/g;

var EventEmitter = require("events").EventEmitter;
var AsyncHttps = require('./async_https.js');
var util = require("util");
var Entities = require('html-entities').AllHtmlEntities;
entities = new Entities();
var asyncHttps = new AsyncHttps(50);

// Only parses courses and NOT workshops!
function TrackParser(url, cookies) 
{
    EventEmitter.call(this);

    var emitter = this;

    asyncHttps.setCookies(cookies);
    asyncHttps.get(url).on("end", (body) =>
    {
        var libraries = [];
        var directoryName = patternForTrackTitle.exec(body)[1] + " Track";

        console.log("Directory to be created: " + directoryName);

        var urlMatches;
        var courseNameMatches;
        // !!(a * b) == a && b but not short-circuit
        while ( !!(
           ((urlMatches = patternForCourseUrls.exec(body)) !== null) * 
           ((courseNameMatches = patternForCourseNames.exec(body)) !== null)
        )) 
        {
              libraries.push({
                 url: "https://teamtreehouse.com" + urlMatches[1],
                 name: entities.decode(courseNameMatches[2]),
                 type: courseNameMatches[1].trim()
              });
        }
        emitter.emit("end", directoryName, libraries);
   });
}

util.inherits( TrackParser, EventEmitter );

module.exports = TrackParser;