"use strict";

const async = require("async");
const PDFKit = require("pdfkit");
const fs = require("fs");
const streamBuffers = require("stream-buffers");

var Rsvg = null;
var SlimerjsCapture = null;

try {
	Rsvg = require("librsvg").Rsvg;
} catch(err) {}

try {
	SlimerjsCapture = require("slimerjs-capture");
} catch(err) {}

function rsvg(svgBuffer, width, height, numPages, format) {
	// TODO: The "dpi" setting is not currently being used.
	var client = new Rsvg(svgBuffer);
  var result = client.render({
    format: format,
    width: width,
    height: height*numPages
  }).data;
  return result;
}

function slimerjs(svgBuffer, width, height, scale, numPages, format, filename, next) {
	// Note: JPG in slimerjs-capture is not supported yet.
	SlimerjsCapture.capturePngPages(svgBuffer, "svg", width*scale, height*scale, numPages, (err, pngBuffers) => {
		if (err) return next(err);
		if (format === "png") {
			next(null, pngBuffers[0]);
		} else if (format === "pdf") {
			fs.writeFileSync("pngBuffer.png", pngBuffers[0]);
			var doc = new PDFKit({ autoFirstPage: false });
			var writeStream;
			if (filename) {
				writeStream = fs.createWriteStream(filename);
			} else {
				writeStream = new streamBuffers.WritableStreamBuffer();
			}
			// Ugly hack since there is no programatic way to determine when the PDF is done; see https://github.com/devongovett/pdfkit/issues/642
			var inter = setInterval(() => {
				if (doc._waiting === 0) {
					clearInterval(inter);
					if (filename) {
						next(null, null);
					} else {
						next(null, writeStream.getContents());
					}
				}
			}, 50);
			doc.pipe(writeStream);
			for (var i=0; i<numPages; i++) {
				var imgBuf = pngBuffers[i];
				console.log("adding page", i, imgBuf.length)
				doc.addPage({
					width: width,
					height: height
				});
				doc.image(imgBuf, 0, 0, { width: width, height: height });
			}
			doc.end();
		} else {
			next(new Error("Unsupported format in slimerjs:", format));
		}
	});
}

module.exports = { rsvg, slimerjs };