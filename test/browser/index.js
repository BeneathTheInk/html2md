var http = require("http"),
	fs = require("fs"),
	path = require("path"),
	grunt = require("grunt");

var argv = require('minimist')(process.argv.slice(2));

function resolve(p) {
	return path.resolve(__dirname, "../..", p);
}

var mimes = {
	".js": "application/javascript",
	".css": "text/css",
	".html": "text/html"
}

var server = http.createServer(function(req, res) {
	res.statusCode = 200;

	grunt.log.debug("%s %s", req.method, req.url);

	var fpath = resolve("." + req.url),
		stat, mime;

	fs.stat(fpath, function(err, stat) {
		if (stat && stat.isFile()) {
			mime = mimes[path.extname(fpath)];
		} else if (req.url.substr(0, 10) === "/lazybones") {
			mime = mimes[path.extname(fpath)];
			fpath = resolve(".." + req.url);
		} else {
			mime = mimes[".html"];
			fpath = resolve("test/browser/test.html");
		}

		res.setHeader("Content-Type", mime);
		fs.createReadStream(fpath, "utf-8").pipe(res);
	});
});

var port = argv.port || 8000;
var options = { debug: argv.debug };

grunt.tasks([ "build-test" ], options, function(err) {
	if (err) {
		console.error(err.stack || err.toString());
		return process.exit(1);
	}

	server.listen(port, function() {
		grunt.log.ok("Test server listening on port " + port + ".");

		grunt.tasks([ "watch:test" ], options, function(err) {
			if (err) {
				console.error(err.stack || err.toString());
				return process.exit(1);
			}
		});
	});
});
