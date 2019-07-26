var Sactory = require("sactory");
var Transpiler = require("sactory/transpiler");

var fs = require("fs-extra");
var path = require("path");

var nop = () => {};

var input = process.argv[2];
var output = process.argv[3] || (input + "/dist");

if(!input) throw new Error("No input path specified.");

var dist = path.join(__dirname, "dist");

// init sactory
Sactory.createDocument();

// create or empty cache folder
fs.emptyDirSync(dist);

// create or empty output folder
fs.emptyDirSync(output);

// prepare config
var config = (function(){
	try {
		// transpile if needed
		var filename = path.join(input, "sactify.jsb");
		var jsb = fs.readFileSync(filename, "utf8");
		fs.writeFileSync(path.join(dist, "sactify.js"), new Transpiler({filename, env: "commonjs"}).transpile(jsb).source.all);
		var ret = require(path.join(dist, "sactify"));
		fs.unlink(path.join(dist, "sactify.js"), nop);
		return ret;
	} catch(e) {
		return require(path.join(process.cwd(), input, "sactify"));
	}
})();
var args = {};
Object.keys(config).forEach(value => args[value] = 0);
Object.values(config.bundles).forEach(bundle => {
	if(typeof bundle == "object") {
		Object.keys(bundle).forEach(value => args[value] = 0);
	}
});
delete args.bundles;
args = Object.keys(args).join(", ");

function getPaths(bundle) {
	if(bundle instanceof RegExp) {
		return bundle;
	} else if(bundle instanceof Array) {
		return new RegExp("^(" + bundle.join("|") + ")$");
	} else if(typeof bundle == "string") {
		if(bundle == "*") return false;
		else return new RegExp("^(" + bundle + ")$");
	} else {
		return typeof bundle == "object" && bundle.paths && getPaths(bundle.paths) || false;
	}
}

function compile() {
	Object.keys(config.bundles).forEach(name => {
		var bundle = config.bundles[name];
		var paths = getPaths(config.bundles[name]);
		var data = Object.assign({}, config, typeof bundle == "object" ? bundle : {});
		delete data.bundles;
		var element = document.createElement("style");
		var content = "";
		fs.readdirSync(dist).forEach(script => {
			if(!paths || paths.test(script.slice(0, -3).replace(/\\/g, "/"))) {
				require(path.join(dist, script.slice(0, -3)))({element}, data);
				content += element.textContent;
			}
		});
		var json = JSON.stringify(data);
		fs.writeFile(path.join(output, name + ".css"), content, nop);
		fs.writeFile(path.join(output, name + ".json"), json, nop);
		fs.writeFile(path.join(output, name + ".js"), "var " + name + "=" + json + ";", nop);
		fs.writeFile(path.join(output, name + ".amd.js"), "define([],function(){return " + json + "});", nop);
	});
}

// transpile ssb files
var writing = 0;
function read(currFolder, paths) {
	fs.readdir(currFolder, (error, files) => {
		if(error) {
			console.error(error);
		} else {
			files.forEach(file => {
				var currFile = path.join(currFolder, file);
				fs.stat(currFile, (error, stat) => {
					if(error) {
						console.error(error);
					} else if(stat.isFile()) {
						if(file.endsWith(".ssb")) {
							writing++;
							fs.writeFile(
								path.join(dist, paths.concat(file.slice(0, -3)).join("$") + "js"),
								new Transpiler({filename: currFile, env: "commonjs"}).transpile(`module.exports=function(@, {${args}}){<#ssb>${fs.readFileSync(currFile, "utf8")}</#ssb>}`).source.all
							, () => {
								if(--writing == 0) compile();
							});
						}
					} else if(stat.isDirectory()) {
						read(currFile, paths.concat(file));
					}
				});
			});
		}
	});
}
read(path.normalize(input), []);
