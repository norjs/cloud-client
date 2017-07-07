
// See https://stackoverflow.com/a/31090240
const isBrowser = new Function("try {return this===window;}catch(e){ return false;}")();
const isNode = new Function("try {return this===global;}catch(e){return false;}")();
const isAngular = isBrowser && new Function("try {return window.angular !== undefined;}catch(e){ return false;}")();

if (isNode) {
	console.log('Detected node environment.')
	module.exports = require('./node/index.js');
} else if (isAngular) {
	console.log('Detected angular environment.')
	module.exports = require('./angular/index.js');
} else {
	console.log("Warning! Failed to detect environment or unknown environment.");
	module.exports = require('./unknown/index.js');
}
