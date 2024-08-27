var ProgressBar = require('progress');
var download = require('download');
var mkdirp = require('mkdirp');
var fs = require('fs');
var path = require('path');
var timers = require('timers');

function DownloadQueue(DOWNLOAD_PATH, LOG_PATH)
{
	this.TIMEOUT_IN_SECONDS = 60; 
	this.downloadQueue = [];
	this.verifyQueue = [];
	this.DOWNLOAD_PATH = DOWNLOAD_PATH;
	this.LOG_PATH = LOG_PATH;
	this.hasVerifyStarted = false;
}

DownloadQueue.prototype.pushAll = function(downloads)
{
	var self = this;
	downloads.forEach((download) => 
	{
		download.directory = path.join(self.DOWNLOAD_PATH, download.directory);
		self.downloadQueue.push(download);
	});
}

DownloadQueue.prototype.push = function(download)
{
	download.directory = path.join(this.DOWNLOAD_PATH, download.directory);
	this.downloadQueue.push(download);
}

DownloadQueue.prototype.start = function()
{
	var self = this;
	if (this.downloadQueue.length > 0)
	{
		this.fillDownloadQueue().then(() => 
		{
			if (!self.hasVerifyStarted)
			{
				fs.writeFile(path.join(self.LOG_PATH, "download_queue.txt"), JSON.stringify(self.verifyQueue));
				self.hasVerifyStarted = true;
			}

			self.verifyDownloadQueue().then(() => 
			{
				self.start();
			});
		});
	}
}

DownloadQueue.prototype.fillDownloadQueue = function()
{
	var self = this;
	return new Promise((resolve, reject) => 
	{
		(function recursion()
		{
			if (self.downloadQueue.length > 0)
			{
				self.popToStart()
				.then((downloadObject) => 
				{
					console.log("Downloading complete! " + self.downloadQueue.length + " files left!");
					self.verifyQueue.push(downloadObject);
					recursion();
				})
				.catch((reason) => 
				{
					var error = reason.error;
					var downloadObject = reason.download;

					var message = "Error has occurred: " + error + "\n";
					message += "=> Directory: " + downloadObject.directory;
					message += "\n=> DownloadLink: " + downloadObject.downloadLink;
					message += "\n=> Filename: " + downloadObject.fileName;
					fs.appendFile(path.join(self.LOG_PATH, "error_downloading.txt"), message + "\n\n");

					console.log("Downloading failed: " + error);
					self.downloadQueue.push(downloadObject);
					console.log("Re-added it to download queue. " + self.downloadQueue.length + " files left!" + "\n");					
					recursion();
				});
			}
			else 
				resolve();
		})();		
	});
}

DownloadQueue.prototype.popToStart = function()
{
	var self = this;
	var downloadObject = this.downloadQueue.shift();
	console.log("Downloading: " + downloadObject.downloadLink);
	
	return new Promise((resolve, reject) => 
	{
		var outputPath = path.join(downloadObject.directory, downloadObject.fileName);
		// Create the download.directory.
		mkdirp.sync(downloadObject.directory);

		var bar = new ProgressBar('[:bar] :percent :etas', {
			complete: '=',
			incomplete: ' ',
			width: 20,
			total: 0
		});

		console.log("Saving the video file to " + outputPath + "...");
		try 
		{
			download(downloadObject.downloadLink)
				.on('response', res => {
					bar.total = Number(res.headers['content-length']);
					downloadObject.fileSize = bar.total;
					var dataLength = 0;
					var idleCounter = 0;
					res.on('data', data => 
					{
						dataLength += data.length;
						return bar.tick(data.length);
					});

					// Timeout 
					(function recursion()
					{
						if (dataLength === bar.total)
							return;
						timers.setTimeout((pastDataLength) => 
						{
							if (dataLength > pastDataLength)
								idleCounter = 0;
							else 
								idleCounter++;

							if (idleCounter > self.TIMEOUT_IN_SECONDS)
							{
								var error = "No data is coming in for " + self.TIMEOUT_IN_SECONDS + " seconds!";
								reject({
									error: error, 
									download: downloadObject
								});
							}
							else 
								recursion();
						}, 1000, dataLength);
					})();
					
				})
				.then((data) =>
					{
						fs.writeFileSync(outputPath, data);
						resolve(downloadObject);
					}
				)
				.catch((error) => 
				{
					reject({
						error: error, 
						download: downloadObject
					});
				});			
		}
		catch(error)
		{
			reject({
				error: error, 
				download: downloadObject
			});		
		}
	});
}

DownloadQueue.prototype.verify = function (verifyQueue)
{
	this.verifyQueue = verifyQueue;
	this.verifyDownloadQueue().then(() => 
	{
		console.log("========================== RESULT ================================");
		console.log("There are " + this.downloadQueue.length + " corrupted downloads!");
		this.downloadQueue.forEach((download, index) => 
		{
			var filePath = path.join(download.directory, download.fileName);
			console.log(index + "=>");
			console.log("Link: " + download.downloadLink);
			console.log("File path: " + filePath);
			console.log("True file size: " + download.fileSize);
			console.log("Downloaded file size: " + fs.existsSync(filePath)? fs.statSync(filePath).size: 'Does not exists!');
			console.log("\n");
		});
	});
}

DownloadQueue.prototype.verifyDownloadQueue = function()
{
	var self = this;
	return new Promise((resolve, reject) => 
	{
		(function recursion()
		{
			if (self.verifyQueue.length > 0)
			{
				self.popToVerify()
				.then(() => 
				{
					console.log("Verification completed! " + self.verifyQueue.length + " files left!");
					recursion();
				})
				.catch((download) => 
				{
					console.log("Verification completed! " + self.verifyQueue.length + " files left!");
					console.log("But file is corrupted so adding it to download queue...");
					self.downloadQueue.push(download);
					recursion();
				});
			}
			else 
				resolve();
		})();		
	});
}

DownloadQueue.prototype.popToVerify = function()
{
	var self = this;
	var downloadObject = this.verifyQueue.shift();
	var outputPath = path.join(downloadObject.directory, downloadObject.fileName);

	console.log("Verifying: " + downloadObject.downloadLink);	
	return new Promise((resolve, reject) =>
	{
		if (!fs.existsSync(outputPath))
		{
			console.log('File does not exists!');
			reject(downloadObject);
		}

		var fileSize = fs.statSync(outputPath).size;
		if (downloadObject.fileSize === fileSize)
			resolve();
		else 
		{
			var errorMessage = "Unequal file size! Original File Size: " + downloadObject.fileSize + " != Downloaded File size: " + fileSize;
			console.log(errorMessage);
			fs.appendFile(path.join(self.LOG_PATH, "broken_downloads.txt"), JSON.stringify(downloadObject) + "\n" + errorMessage + "\n\n");
			reject(downloadObject);
		}
	});
}

module.exports = DownloadQueue;