"use strict";

const IS_PRODUCTION = true;

// Input Prompt Dependencies
var readlineSync = require('readline-sync');
var process = require('process');

// Custom-made Dependencies
var AuthModule = require('./authentication_module.js');
var TrackParser = require('./track_parser.js');
var LibraryParser = require('./library_parser.js');
var VideoParser = require('./video_parser.js');
var DownloadQueue = require('./download_queue.js');

// Download Handler Dependencies
var fs = require('fs');
var sanitize = require("sanitize-filename");
var mkdirp = require('mkdirp');
var rmdir = require('rmdir');
var path = require('path');

// Download Handler Variables
var hasExecuted = false;

var authModule = new AuthModule();
authModule.on('end', (sessionCookie) => 
{
	if (IS_PRODUCTION)
	{
		var url = readlineSync.question("Please enter the Teamtreehouse Track URL: ");
		// Ask for username and password.
		var downloadPath = readlineSync.question("Please enter where you want to store your downloads: ");
	}
	else 
	{
		var url = "https://teamtreehouse.com/tracks/learn-wordpress";
		var downloadPath = 'C:/Storage/test';
	}

	var logPath = "logs/" + path.basename(url);
	var downloadQueue = new DownloadQueue(downloadPath, logPath);

	startDownloading(sessionCookie, url, downloadQueue, logPath);
});

authModule.on('onFailure', () => 
{
	if (IS_PRODUCTION)
	{
		var url = readlineSync.question("Please enter the Teamtreehouse Track URL: ");
		// Ask for username and password.
		var username = readlineSync.question("Please enter Teamtreehouse username: ");
		var password = readlineSync.question("Please enter Teamtreehouse password: ", {
			hideEchoBack: true,
			mask: ''
		});
		var downloadPath = readlineSync.question("Please enter where you want to store your downloads: ");
	}
	else 
	{
		var url = "https://teamtreehouse.com/tracks/learn-wordpress";
		var username = "emmett_young92@yahoo.com";
		var password = "Young!080492";
		var downloadPath = 'C:/Storage/test';
	}

	var logPath = "logs/" + path.basename(url);
	var downloadQueue = new DownloadQueue(downloadPath, logPath);

	authModule = new AuthModule(username, password);
	authModule.on("end", (sessionCookie) => 
	{
		startDownloading(sessionCookie, url, downloadQueue, logPath);
	});
});


function startDownloading(sessionCookie, url, downloadQueue, logPath) 
{
	// Erase previous logs.
	rmdir(logPath, () => 
	{
		mkdirp(logPath);
	});
	// Create logs
	console.log("__________________ PARSING TRACK STARTS ______________________");
	var trackParser = new TrackParser(url, sessionCookie);

	trackParser.on("end", (directory, libraries) =>
	{
		console.log("__________________ PARSING TRACK ENDS ______________________");
		var pending = libraries.length;
		var libraryCollection = [];

		libraries.forEach((library, index) =>
		{
			library.name = library.type + "-" + (index + 1) + " " + library.name;
			console.log("__________________ PARSING COURSE "+ library.name + " STARTS ______________________");

			var libraryParser = new LibraryParser(directory, library, sessionCookie);
			// Collect all video-lesson page in each sections
			libraryParser.on("end", (sections) => 
			{
				console.log("__________________ PARSING COURSE "+ library.name + " ENDS ______________________");
				console.log("Pending courses: " + --pending);

				// A library has multiple sections.
				libraryCollection.push(sections);
				if (pending === 0)
				{
					console.log("______________________ ALL COURSES FINISHED ______________________");

					var totalUrls = 0;
					libraryCollection.forEach((sections) => 
					{
						sections.forEach((section) => 
						{
							totalUrls += section.urls.length;
						});
					});

					var pendingUrls = totalUrls;
					libraryCollection.forEach((sections) => 
					{
						sections.forEach((section) => 
						{
							section.urls.forEach((url, index) => 
							{
								var videoParser = new VideoParser(index + 1, section.directory, url, sessionCookie);
								videoParser.on("end", (directory, downloadLink, fileName) => 
								{								
									if (downloadLink === null)
									{
										console.log("Failed to parsed the download link! No match found! "  + url);
										process.exit(1);
									}
									else 
									{
										// Sanitize directory.
										directory = directory.split('/').map((path) => 
											{
												return sanitize(path);
											}).join('/');

										// Sanitize filename
										fileName = sanitize(fileName);

										downloadQueue.push({
											directory: directory,
											downloadLink: downloadLink,
											fileName: fileName
										});

										pendingUrls--;
										console.log("Pending urls: " + pendingUrls);
										console.log("Total Urls: " + totalUrls);
										if (!hasExecuted && pendingUrls === 0)
										{
											downloadQueue.start();
											hasExecuted = true;
										}
									}
								}).on("error", (error) => 
								{
						            fs.appendFile(path.join(logPath, "error.txt"), "Video parsing failed on section " + section.directory + 
						            	" on url " + url + " due to " + error + "\n");                
								});	
							});
						});
					})
				}
			});
		});
	});
}