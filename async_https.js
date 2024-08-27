var https = require("https");
var EventEmitter = require("events");
var util = require("util");
var queryString = require('querystring');
var urlFactory = require('url');

var AsyncHttps = function(REQUEST_LIMIT, cookies)
{
    var self = this;
    var queue = [];
    var numberOfRequests = 0;
    var options = { headers: {} };

    this.setCookies = function(cookies)
    {
        options.headers.Cookie = queryString.stringify(cookies);
    };
    
    this.get = function(url)
    {
        var emitter = new EventEmitter();
        queue.push({
            url: url,
            emitter: emitter
        });
        fillRequestQueue();
        return emitter;
    };

    var fillRequestQueue = function()
    {
        while (numberOfRequests < REQUEST_LIMIT && queue.length > 0)
        {
            var object = queue.pop();
            actualGetRequest(object);
            // Increment the number of requests active.
            numberOfRequests++;
            console.log("GET[total=" + numberOfRequests + "] " + object.url + " sent!");
        }
    };

    var actualGetRequest = function(object)
    {
        var emitter = object.emitter;
        var url = object.url;

        var urlObject = urlFactory.parse(url);

        options.hostname = urlObject.host;
        options.path = urlObject.pathname;
        https.get(options, function(res)
        {
            if (res.statusCode !== 200) 
            {
                //Status Code Error
                console.error("There was an error getting the URL " + url + ". (" + res.statusCode + ")");
                console.error("Requesting the same URL....");
                actualGetRequest({
                    url: url,
                    emitter: emitter
                });
                return;
            }

            var body = "";
            res.on("data", function(chunk)
            {
                body += chunk;
            });

            res.on("end", () => 
            {
                numberOfRequests--;
                console.log("GET[total=" + numberOfRequests + "] response received!");
                emitter.emit("end", body, res);
                fillRequestQueue();
            });

        }).on("error", function(error){
            console.error("There was an error with the HTTP request...");
            console.error("Requesting the same URL....");
            actualGetRequest({
                url: url,
                emitter: emitter
            });
        });   
    };
}

module.exports = AsyncHttps;