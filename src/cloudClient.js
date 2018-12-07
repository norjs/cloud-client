import _ from 'lodash';
import debug from 'nor-debug';
import Q from 'q';
import URL from 'url';

/**
 * ES6 reserved words.
 *
 * @type {{isPrototypeOf: boolean, ReferenceError: boolean, Uint16Array: boolean, URIError: boolean, String: boolean, Math: boolean, protected: boolean, else:
 *     boolean, let: boolean, Uint8Array: boolean, catch: boolean, Boolean: boolean, if: boolean, case: boolean, in: boolean, var: boolean, decodeURI: boolean,
 *     enum: boolean, Promise: boolean, TypeError: boolean, Object: boolean, Map: boolean, parseFloat: boolean, Set: boolean, propertyIsEnumerable: boolean,
 *     isFinite: boolean, undefined: boolean, default: boolean, yield: boolean, escape: boolean, typeof: boolean, Int8Array: boolean, Infinity: boolean, break:
 *     boolean, EvalError: boolean, throw: boolean, Reflect: boolean, ArrayBuffer: boolean, toString: boolean, return: boolean, WeakMap: boolean, debugger:
 *     boolean, WeakSet: boolean, do: boolean, while: boolean, Float64Array: boolean, isNaN: boolean, encodeURI: boolean, SyntaxError: boolean, continue:
 *     boolean, function: boolean, export: boolean, Uint8ClampedArray: boolean, new: boolean, package: boolean, static: boolean, void: boolean, RegExp:
 *     boolean, finally: boolean, this: boolean, Float32Array: boolean, constructor: boolean, eval: boolean, extends: boolean, null: boolean, true: boolean,
 *     try: boolean, encodeURIComponent: boolean, toLocaleString: boolean, implements: boolean, private: boolean, const: boolean, import: boolean, Symbol:
 *     boolean, for: boolean, JSON: boolean, interface: boolean, delete: boolean, System: boolean, switch: boolean, Function: boolean, Int32Array: boolean,
 *     Proxy: boolean, hasOwnProperty: boolean, public: boolean, Number: boolean, await: boolean, RangeError: boolean, NaN: boolean, class: boolean,
 *     Int16Array: boolean, valueOf: boolean, false: boolean, Error: boolean, unescape: boolean, Date: boolean, instanceof: boolean, decodeURIComponent:
 *     boolean, super: boolean, Array: boolean, parseInt: boolean, with: boolean, DataView: boolean, Uint32Array: boolean}}
 */
const RESERVED = {

	// ES6 preserved words
	"await": true,
	"break": true,
	"case": true,
	"catch": true,
	"class": true,
	"const": true,
	"continue": true,
	"debugger": true,
	"default": true,
	"delete": true,
	"do": true,
	"else": true,
	"enum": true,
	"export": true,
	"extends": true,
	"false": true,
	"finally": true,
	"for": true,
	"function": true,
	"if": true,
	"implements": true,
	"import": true,
	"in": true,
	"instanceof": true,
	"interface": true,
	"let": true,
	"new": true,
	"null": true,
	"package": true,
	"private": true,
	"protected": true,
	"public": true,
	"return": true,
	"static": true,
	"super": true,
	"switch": true,
	"this": true,
	"throw": true,
	"true": true,
	"try": true,
	"typeof": true,
	"var": true,
	"void": true,
	"while": true,
	"with": true,
	"yield": true,

	// ES6 preserved global names
	"Array": true,
	"ArrayBuffer": true,
	"Boolean": true,
	"DataView": true,
	"Date": true,
	"Error": true,
	"EvalError": true,
	"Float32Array": true,
	"Float64Array": true,
	"Function": true,
	"Infinity": true,
	"Int16Array": true,
	"Int32Array": true,
	"Int8Array": true,
	"JSON": true,
	"Map": true,
	"Math": true,
	"NaN": true,
	"Number": true,
	"Object": true,
	"Promise": true,
	"Proxy": true,
	"RangeError": true,
	"ReferenceError": true,
	"Reflect": true,
	"RegExp": true,
	"Set": true,
	"String": true,
	"Symbol": true,
	"SyntaxError": true,
	"System": true,
	"TypeError": true,
	"URIError": true,
	"Uint16Array": true,
	"Uint32Array": true,
	"Uint8Array": true,
	"Uint8ClampedArray": true,
	"WeakMap": true,
	"WeakSet": true,
	"constructor": true,
	"decodeURI": true,
	"decodeURIComponent": true,
	"encodeURI": true,
	"encodeURIComponent": true,
	"escape": true,
	"eval": true,
	"hasOwnProperty": true,
	"isFinite": true,
	"isNaN": true,
	"isPrototypeOf": true,
	"parseFloat": true,
	"parseInt": true,
	"propertyIsEnumerable": true,
	"toLocaleString": true,
	"toString": true,
	"undefined": true,
	"unescape": true,
	"valueOf": true

};

const longPollingMinDelay = parseInt(process.env.CLOUD_CLIENT_LONG_POLLING_MIN_DELAY || 500, 10); // ms
const longPollingPreferWait = parseInt(process.env.CLOUD_CLIENT_LONG_POLLING_PREFER_WAIT || 20, 10); // s

/** Global cache for classes */
const _cache = {};

function fixAuthorization (postRequest_, url) {
	const options = URL.parse(url, true);
	const auth = options.auth || '';
	if (!auth) return postRequest_;

	return (realUrl, data) => {

		//console.log('realUrl = ', realUrl);

		let opts = URL.parse(realUrl, true);
		const optsAuth = opts.auth || '';
		if (optsAuth) return postRequest_(realUrl, data);

		opts.auth = auth;

		const newUrl = URL.format(opts);
		//console.log('newUrl = ', newUrl);
		return postRequest_(newUrl, data);
	};
}

/** */
function parse_type (type) {
	if (_.isArray(type)) return type;
	if (_.isString(type)) return [type];
	return [];
}

/** Check if `name` is a reserved word in ES6.
 *
 * @param name {string}
 * @return {boolean}
 */
function isReservedWord (name) {
	return !!_.has(RESERVED, name);
}

/** */
function isValidName (name) {
	return _.isString(name) && /^[a-zA-Z$_][a-zA-Z0-9$_]*$/.test(name);
}

function assertValidName (name) {
	if (!isValidName(name)) {
		throw new TypeError("Name is not a valid name: "+name);
	}
	if (isReservedWord(name)) {
		throw new TypeError("Name is a reserved word: "+name);
	}
}

/** */
function isValidClassName (name) {
	return _.isString(name) && /^[a-zA-Z][a-zA-Z0-9$_]*$/.test(name);
}

function assertValidClassName (className) {
	if (!isValidClassName(className)) {
		throw new TypeError("Class name is not a valid name: "+className);
	}
	if (isReservedWord(className)) {
		throw new TypeError("Class name is a reserved word: "+className);
	}
}

/** Parse payload from backend */
const parsePayload = result => {
	debug.assert(result).is('object');
	const payloadType = result.$type;
	const payloadPath = result.$path;
	const payload = payloadPath ? _.get(result, payloadPath) : result;
	if (payloadType === "Date") {
		return new Date(payload);
	}
	return payload;
}

function _sleep (time) {
	return Q.Promise(resolve => setTimeout(resolve, time));
}

/** */
export function buildCloudClassSync (body, getRequest_, postRequest_, opts) {
	//debug.log('body = ', body);
	debug.assert(getRequest_).is('function');
	debug.assert(postRequest_).is('function');

	debug.assert(body).is('object');

	const enableLongPolling = !!(opts && opts.enableLongPolling);

	let methods = [];
	let properties = [];

	Object.keys(body).forEach(key => {
		assertValidName(key);
		const value = body[key];
		const isMethod = _.isObject(value) && value.$type === 'Function';
		(isMethod ? methods : properties).push(key);
	});

	const __updateData = (self, data) => {
		//debug.log('__updateData(', self, ', ', data, ')');

		debug.assert(self).is('object');
		debug.assert(data).is('object');

		debug.assert(self.$ref).is('url');
		debug.assert(data.$ref).is('url').equals(self.$ref);

		_.forEach(_.keys(data), key => {
			const value = data[key];

			if ( (key === '$id') || (key === '$hash') ) {
				self[key] = value;
				return;
			}

			const firstLetter = (key.length >= 1) ? key.substr(0, 1) : '';
			if (firstLetter === '$') return;
			if (firstLetter === '_') return;

			self[key] = value;
		});
	};

	let __lastLongPollTime = _.now();

	const __longPollData = self => {
		//debug.log('__longPollData(', self, ')');

		const url = self.$ref;
		const etag = self.$hash;

		if (!(url && etag)) return;

		Q.fcall(() => {

			return Q.fcall( () => {
				const delay = _.now() - __lastLongPollTime;
				if (delay < longPollingMinDelay) {
					return _sleep(longPollingMinDelay - delay);
				}
			}).then(
				() => getRequest_(url, {wait:longPollingPreferWait, etag}).then(body => {
					__lastLongPollTime = _.now();

					//debug.log('body = ', body);

					const statusCode = body && body._statusCode;

					// Node implementation doesn't throw an exception when 304 happens
					if (statusCode === 304) return;
					if (_.isObject(body)) return __updateData(self, body);

					debug.error('Warning! Could not update service: ', body);

				}).fail(err => {

					// Angular throws exceptions in 304
					if (err && err.status === 304) return;

					return Q.reject(err);
				})
			);

		}).fail(err => {
			debug.error('[longPollError] ', err);
		}).fin(() => {
			__longPollData(self);
		}).done();
	};

	const __setupStaticData = (self, data) => {

		// Copy properties from prototype
		_.forEach(properties, key => {
			const firstLetter = key && key.length >= 1 ? key[0] : '';
			if (firstLetter === '$') return;
			if (firstLetter === '_') return;
			self[key] = _.cloneDeep(body[key])
		});

		// Copy properties from provided instance (arguments to constructor)
		if (_.isObject(data)) {
			_.forEach(Object.keys(data), key => {
				const firstLetter = key && key.length >= 1 ? key[0] : '';
				//if (firstLetter === '$') return;
				if (firstLetter === '_') return;
				if (key === '$prototype') return;
				self[key] = _.cloneDeep(data[key]);
			});
		}

		if (enableLongPolling) __longPollData(self);
	};

	let Class;
	const types = parse_type(body.$type);
	//const constructorArgs = _.isArray(body.$args) ? body.$args : [];
	//const constructorArgsStr = constructorArgs.join(', ');
	if (types.length === 0) {
		Class = class {constructor(data) { __setupStaticData(this, data); }};
	} else if (types.length === 1) {
		const className = _.first(types);
		assertValidClassName(className);
		Class = (new Function("__setupStaticData", "return class "+className+" { constructor(data) { __setupStaticData(this, data); } }"))(__setupStaticData);
	} else {
		const firstClassName = _.first(types);
		Class = _.reduceRight(types, (Base, className) => {
			assertValidClassName(className);
			if (Base === undefined) {
				return (new Function("return class "+className+" {}"))();
			}
			debug.assert(Base).is('function');
			if (firstClassName === className) {
				return (new Function("__setupStaticData", "__Base", "return class "+className+" extends __Base { constructor(data) { super(); __setupStaticData(this, data); } }"))(__setupStaticData, Base);
			} else {
				return (new Function("__Base", "return class "+className+" extends __Base { constructor() { super(); } }"))(Base);
			}
		}, undefined);
	}

	// Add prototype methods
	_.forEach(methods, key => {
		const baseUrl = body.$ref || url;
		const methodUrl = (baseUrl && (baseUrl.length >= 1) && (baseUrl[baseUrl.length-1] === '/')) ? baseUrl + key : baseUrl + '/' + key;
		Class.prototype[key] = (...$args) => postRequest_(methodUrl, {$args}).then(parsePayload);
	});

	return Class;
}

export function buildCloudClass (body, getRequest_, postRequest_, opts) {
	debug.assert(getRequest_).is('function');
	debug.assert(postRequest_).is('function');
	return Q.when(buildCloudClassSync(body, getRequest_, postRequest_, opts));
}

/** Get a JS class for this cloud object. It is either found from cache or generated. */
export function getCloudClassFromObject (body, getRequest_, postRequest_, opts) {
	return Q.fcall( () => {
		debug.assert(getRequest_).is('function');
		debug.assert(postRequest_).is('function');
		debug.assert(body).is('object');
		debug.assert(body.$id).is('uuid');

		let type;
		if (!_.isArray(body.$type)) {
			type = body.$type;
		} else {
			type = _.first(body.$type);
		}

		const id = body.$id;

		debug.assert(type).is('string');

		let cache1 = _cache[type];
		if (!_.isObject(cache1)) {
			cache1 = _cache[type] = {};
		}

		const now = (new Date().getTime());

		let cache2 = cache1[id];
		if (_.isObject(cache2)) {
			cache2.time = now;
			return cache2.Type;
		}

		// Remove other IDs from cache which have not been used in 5 minutes
		Object.keys(cache1).forEach(id_ => {
			const value = cache1[id_];
			const time = value.time;
			if (now - time >= 5*60*1000) {
				delete cache1[id_];
			}
		});

		cache2 = cache1[id] = {
			name: type,
			id,
			Type: buildCloudClassSync(body, getRequest_, postRequest_, opts),
			time: now
		};

		return cache2.Type;
	});
}

export function getCloudClassFromURL (url, request, opts) {
	request = request || require('./request/index.js');
	debug.assert(request).is('object');
	const postRequest = request.post;
	const getRequest = request.get;
	debug.assert(postRequest).is('function');
	debug.assert(getRequest).is('function');

	return getRequest(url).then( body => {
		debug.assert(body).is('object');
		debug.assert(body.$prototype).is('object');
		return getCloudClassFromObject(body.$prototype, fixAuthorization(getRequest, url), fixAuthorization(postRequest, url), opts);
	});
}

export function getCloudInstanceFromObject (body, getRequest_, postRequest_, opts) {
	debug.assert(getRequest_).is('function');
	debug.assert(postRequest_).is('function');
	debug.assert(body).is('object');
	debug.assert(body.$prototype).is('object');
	return getCloudClassFromObject(body.$prototype, getRequest_, postRequest_, opts).then(Class => {
		debug.assert(Class).is('function');
		let instance = new Class(body);
		debug.assert(instance).is('object');
		return instance;
	});
}

export function getCloudInstanceFromURL (url, request, opts) {

	//console.log('request =', request);
	debug.assert(request).ignore(undefined).is('object');
	request = request || require('./request/index.js');
	//console.log('request =', request);
	debug.assert(request).is('object');
	let postRequest = request.post;
	let getRequest = request.get;
	debug.assert(postRequest).is('function');
	debug.assert(getRequest).is('function');

	getRequest = fixAuthorization(getRequest, url);
	postRequest = fixAuthorization(postRequest, url);
	return getRequest(url).then(body => getCloudInstanceFromObject(body, getRequest, postRequest, opts) );
}

/**
 * Check if value is a string and an URL.
 *
 * @param value {string}
 * @returns {boolean}
 */
function isUrl (value) {
	return _.isString(value) && /^(ftp|https?):\/\//.test(value);
}

/** Get a JS class for this cloud object. It is either found from cache or generated. */
function cloudClient (arg, request, opts) {

	debug.assert(request).ignore(undefined).is('object');
	debug.assert(opts).ignore(undefined).is('object');

	//console.log('request = ', request);
	request = request || require('./request/index.js');
	//console.log('request = ', request);
	debug.assert(request).is('object');
	const postRequest = request.post;
	const getRequest = request.get;
	debug.assert(postRequest).is('function');
	debug.assert(getRequest).is('function');

	if (_.isObject(arg)) return getCloudInstanceFromObject(arg, getRequest, postRequest, opts);
	if (isUrl(arg)) return getCloudInstanceFromURL(arg, request, opts);
	throw new TypeError("Argument passed to cloudClient() is unsupported type: " + typeof arg);
}

/** Get a cloud class from an URL */
cloudClient.fromObject = getCloudInstanceFromObject;
cloudClient.fromURL = getCloudInstanceFromURL;

cloudClient.classFromURL = getCloudClassFromURL;
cloudClient.classFromObject = getCloudClassFromObject;

export default cloudClient;
