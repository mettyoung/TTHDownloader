// Dependencies
var EventEmitter = require("events").EventEmitter;
var https = require('https');
var AsyncHttps = require('./async_https.js');
var util = require("util");
var urlFactory = require('url');
var queryString = require('querystring');
var fs = require('fs');

// Initializations
var asyncHttps = new AsyncHttps(1);
var signInPage = "https://teamtreehouse.com/signin";
var postLogInPage = "https://teamtreehouse.com/person_session";
var patternForAuthenticityToken = /<input.*authenticity_token.*value="*(.*)"/g;
var patternForTreeHouseSessionInCookie = /_treehouse_session=(.*?);/g;
var sessionTokenFile = '_treehouse_session' + getDate();

function getDate() 
{
    var date = new Date();

    var year = date.getFullYear();
    var month = date.getMonth() + 1;
    month = (month < 10 ? "0" : "") + month;
    var day  = date.getDate();
    day = (day < 10 ? "0" : "") + day;

    return year + month + day;
}

function getSessionToken(setCookies)
{
	var sessionToken = {};
	setCookies.forEach((value) => 
	{
		matches = patternForTreeHouseSessionInCookie.exec(value);
		if (matches !== null)
			sessionToken = {
				_treehouse_session:	matches[1]
			};
	});
	return sessionToken;
}

// Only parses courses and NOT workshops!
function AuthenticationModule(email, password) 
{
    EventEmitter.call(this);

    var emitter = this;

    // No arguments were given.
    if (typeof email === 'undefined')
    {
        fs.access(sessionTokenFile, fs.F_OK, (error) => 
        {
            if (error)
                emitter.emit('onFailure')
            else 
            {
                var sessionToken = JSON.parse(fs.readFileSync(sessionTokenFile, {encoding: 'utf8'}));
                sessionToken = getSessionToken(sessionToken);
                emitter.emit('end', sessionToken);
            }
        });
    }
    else 
    {
        asyncHttps.get(signInPage).on("end", (body, response) =>
        {
            var matches = patternForAuthenticityToken.exec(body);

            if (matches.length == 2)
            {
                var authenticityToken = matches[1];
                console.log("Authenticity token parsed successfully: " + authenticityToken);

                var sessionCookie = getSessionToken(response.headers['set-cookie']);
                var urlObject = urlFactory.parse(postLogInPage);
                var options = 
                {
                    hostname: urlObject.host,
                    path: urlObject.pathname,
                    method: 'POST',
                    headers: 
                    {
                        'Content-Type': 'application/x-www-form-urlencoded',
                        Cookie: '_treehouse_session=' + sessionCookie._treehouse_session + ";",
                        Host: "teamtreehouse.com"
                    }
                };

                var postRequest = https.request(options, (response) => 
                {
                    console.log("Response status code: " + response.statusCode);

                    if (response.statusCode === 200 || response.statusCode === 302)
                    {
                        sessionCookie = getSessionToken(response.headers['set-cookie']);
                        console.log("Successfully logged-in! The session key is " + sessionCookie._treehouse_session);
                        fs.writeFile(sessionTokenFile, JSON.stringify(response.headers['set-cookie']));
                        emitter.emit('end', sessionCookie);
                    }
                    else 
                    {
                        console.log("Failed to logged-in!");
                    }
                });

                var postData = queryString.stringify(
                {
                    'user_session[email]': email,
                    'user_session[password]': password,
                    authenticity_token: authenticityToken
                });

                postRequest.write(postData);
                postRequest.end();
                console.log("POST " + postLogInPage + " sent!");
                console.log("Body: " + postData);
            }
            else 
            {
                console.log("Failed to parse authenticity_token!");
            }
        });
    }
}

util.inherits( AuthenticationModule, EventEmitter );

module.exports = AuthenticationModule;