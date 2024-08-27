"use strict";

// Input Prompt Dependencies
var readlineSync = require('readline-sync');

// Download Handler Dependencies
var fs = require('fs');
var path = require('path');
var rmdir = require('rmdir');
var mkdirp = require('mkdirp');
var DownloadQueue = require('./download_queue.js');

var url = readlineSync.question("Please enter the Teamtreehouse Track URL: ");
var downloadPath = readlineSync.question("Please enter where you want to store your downloads: ");

var logPath = "logs/" + path.basename(url);

// Erase previous logs.
rmdir(logPath, () => 
{
	mkdirp(logPath);
});

var parserLogPath = "parser-logs/" + path.basename(url);

var downloadQueue = new DownloadQueue(downloadPath, logPath);

downloadQueue.pushAll(JSON.parse(fs.readFileSync(path.join(parserLogPath, 'download_queue.txt'), {encoding: 'utf8'})));
downloadQueue.start();