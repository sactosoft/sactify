var Sactory = require("sactory");
var Transpiler = require("sactory/src/transpiler");

var fs = require("fs-extra");
var path = require("path");

var input = process.argv[2];
var output = process.argv[3] || (input + "/dist");

if(!input) throw new Error("No input path specified.");

// init sactory
Sactory.createDocument();

// create or empty output folder
fs.emptyDirSync(output);

// prepare config
try {
	// transpile if needed
	var filename = path.join(input, "sactify.jsb");
	var jsb = fs.readFileSync(filename, "utf8");
	fs.writeFileSync(path.join(input, "sactify.js"), new Transpiler({filename}).transpile(jsb).source.all);
} catch(e) {}
var config = require(input + "/sactify");
var args = Object.keys(config).filter(a => a != "bundles").join(", ");

function compile() {
	Object.keys(config.bundles).forEach(name => {
		var bundle = config.bundles[name];
		if(typeof bundle == "string") {
			if(bundle == "*") bundle = /.*/;
			else bundle = new RegExp("^(" + bundle + ")$");
		} else if(!(bundle instanceof RegExp)) {
			if(bundle instanceof Array) bundle = new RegExp("^(" + bundle.join("|") + ")$");
		}
		var data = Object.assign({}, config);
		delete data.bundles;
		var element = document.createElement("style");
		var content = "";
		fs.readdirSync(output).forEach(script => {
			if(!bundle || bundle.test(script)) {
				require(output + "/" + script.slice(0, -3))(element, data);
				content += element.textContent;
			}
		});
		fs.writeFile(path.join(output, name + ".css"), content, () => {});
		fs.writeFile(path.join(output, name + ".json"), JSON.stringify(data), () => {});
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
								path.join(output, paths.concat(file.slice(0, -3)).join("$") + "js"),
								new Transpiler({filename: currFile}).transpile(`module.exports=function(@, {${args}}){<#ssb>${fs.readFileSync(currFile, "utf8")}</#ssb>}`).source.all
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
