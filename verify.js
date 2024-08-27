var readlineSync = require('readline-sync');
var fs = require('fs');
var path = require('path');
var DownloadQueue = require('./download_queue.js');

var url = readlineSync.question("Please enter the Teamtreehouse Track URL: ");
var downloadQueueFile = path.join(path.join("logs", path.basename(url)), "download_queue.txt");

var downloads = JSON.parse(fs.readFileSync(downloadQueueFile, {encoding: 'utf8'}));
var downloadQueue = new DownloadQueue();
downloadQueue.verify(downloads);