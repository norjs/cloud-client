import _ from 'lodash';
import debug from 'nor-debug';
import { Async, promiseCall } from './Async.js';
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

/**
 *
 * @type {number}
 */
export const LONG_POLLING_MIN_DELAY = parseInt(process.env.CLOUD_CLIENT_LONG_POLLING_MIN_DELAY || 500, 10); // ms

/**
 *
 * @type {number}
 */
export const LONG_POLLING_PREFER_WAIT = parseInt(process.env.CLOUD_CLIENT_LONG_POLLING_PREFER_WAIT || 20, 10); // s

/** Global cache for classes
 *
 * @type {{}}
 */
const CACHE = {};

/**
 * Returns a wrapper post function which copies authentication information from `url` into
 * any url which is requested through the new wrapper function.
 *
 * If the `url` doesn't contain authentication information, this function returns the `postRequest` directly.
 *
 * If the url provided to the returned wrapper function contains authentication information, nothing is copied.
 *
 * This function will only copy authentication information if hostname and port are unique.
 *
 * @param origCall {function} The request function which will be wrapped
 * @param origUrl {string} The original URL which may contain authentication information
 * @returns {function}
 */
export function createRequestFunctionWithAuthorization (origCall, origUrl) {
	const { hostname, auth = '' } = URL.parse(origUrl, true);
	if (!auth || !hostname) return origCall;

	return (url, data) => {
		let opts = URL.parse(url, true);

		if (opts.auth || hostname !== opts.hostname) {
			return origCall(url, data);
		}

		opts.auth = auth;

		const newUrl = URL.format(opts);
		return origCall(newUrl, data);
	};
}

/**
 * Convert a string value into an array unless it is already an array.
 *
 * If it's not an array or string, an empty array is returned.
 *
 * @param value {Array.<string>|string}
 * @returns {Array.<string>}
 */
export function parseTypeToArray (value) {
	if (_.isArray(value)) return value;
	if (_.isString(value)) return [value];
	return [];
}

/** Check if `name` is a reserved word in ES6.
 *
 * @param name {string}
 * @return {boolean}
 */
export function isReservedWord (name) {
	return !!_.has(RESERVED, name);
}

/**
 * Returns `true` if `name` is a valid name identifier.
 *
 * @param name
 * @returns {boolean}
 */
export function isValidName (name) {
	return _.isString(name) && /^[a-zA-Z$_][a-zA-Z0-9$_]*$/.test(name);
}

/**
 * Validate a name identifier.
 *
 * @param name {string}
 * @throws TypeError if `name` is not a valid name or it is a reserved word.
 */
export function assertValidName (name) {
	if (!isValidName(name)) {
		throw new TypeError("Name is not a valid name: "+name);
	}
	if (isReservedWord(name)) {
		throw new TypeError("Name is a reserved word: "+name);
	}
}

/**
 * Returns `true` if `name` is a valid class name.
 *
 * @param name {string}
 * @return {boolean}
 */
export function isValidClassName (name) {
	return _.isString(name) && /^[a-zA-Z][a-zA-Z0-9$_]*$/.test(name);
}

/**
 * Verify class name.
 *
 * @param className {string}
 * @throws {TypeError} if `className` is not a valid class name.
 */
export function assertValidClassName (className) {
	if (!isValidClassName(className)) {
		throw new TypeError("Class name is not a valid name: "+className);
	}
	if (isReservedWord(className)) {
		throw new TypeError("Class name is a reserved word: "+className);
	}
}

/** Parse payload from backend.
 *
 * This function parses a payload from result object at place `result.$path` as the type described in `result.$type`.
 *
 * At the moment only `"Date"` type is actually converted. Anything else is passed on the same way as after JSON parsing.
 *
 * @param result {{$type:string, $path: string}}
 * @returns {*}
 */
export function parsePayload (result) {
	debug.assert(result).is('object');
	const payloadType = result.$type;
	const payloadPath = result.$path;
	const payload = payloadPath ? _.get(result, payloadPath) : result;
	if (payloadType === "Date") {
		return new Date(payload);
	}
	return payload;
}

/**
 * Returns a promise which will be resolved after `time` milliseconds.
 *
 * @param time {number}
 * @returns {Promise}
 * @private
 */
export function sleep (time) {
	debug.assert(time).is('number');
	return Async.Promise( (resolve, reject) => {
		try {
			setTimeout(resolve, time);
		} catch (err) {
			reject(err);
		}
	});
}

/**
 * Copies properties from `data` object to `self` object.
 *
 * Skips any property which starts with `$` or `_` letters.
 * Except properties `"$id"` and `"$hash"`, which are copied.
 *
 * @param self {{$ref: string}}
 * @param data {{$ref: string}}
 */
export function updateData (self, data) {

	debug.assert(self).is('object');
	debug.assert(self.$ref).is('url');

	debug.assert(data).is('object');
	debug.assert(data.$ref).is('url').equals(self.$ref);

	_.forEach(_.keys(data), key => {
		const value = data[key];
		const firstLetter = (key.length >= 1) ? key[0] : '';

		if ( (key === '$id') || (key === '$hash') || !(firstLetter && (firstLetter === '$' || firstLetter === '_')) ) {
			self[key] = value;
		}

	});
}

/**
 * Start long polling for changes in the remote object.
 *
 * @param self {object} The local class object.
 * @param context {Object} Context object
 * @param context.getRequest {function(url:string, data:object)} Function to call for HTTP GET request
 * @return {function(): boolean} Destruction function. When called, will no longer continue polling at the next time.
 */
export function longPollData (self, context) {
	debug.assert(self).is('object');
	const url = self.$ref;
	const etag = self.$hash;

	if (!(url && etag)) {
		throw new TypeError("Resource did not have $ref nor $hash; cannot long poll.");
	}

	debug.assert(context).is('object');
	debug.assert(context.getRequest).is('function');

	if (context.__runPoller === undefined) {
		context.__runPoller = true;
	}

	Async.done(promiseCall(() => {

		return promiseCall( () => {
			const delay = context.__lastLongPollTime !== undefined ? _.now() - context.__lastLongPollTime : 0;
			if (delay < LONG_POLLING_MIN_DELAY) {
				return sleep(LONG_POLLING_MIN_DELAY - delay);
			}
		}).then(
			() => context.getRequest(url, {wait:LONG_POLLING_PREFER_WAIT, etag}).then(body => {

				context.__lastLongPollTime = _.now();

				const statusCode = body && body._statusCode;

				// Node implementation doesn't throw an exception when 304 happens
				if (statusCode === 304) return;

				if (_.isObject(body)) {
					return updateData(self, body);
				}

				debug.error('Warning! Could not update service: ', body);

			}).catch(err => {

				context.__lastLongPollTime = _.now();

				// Angular throws exceptions in 304
				if (err && err.status === 304) return;

				return Async.Promise( (resolve, reject) => reject(err) );
			})
		);

	}).catch(err => {
		debug.error('[longPollError] ', err);
	}).finally(() => {
		if (context.__runPoller) longPollData(self, context);
	}));


	return () => context.__runPoller = false;
}

/**
 * Copy static data properties from source object to target object.
 *
 * This function also:
 *
 *  - copies prototype properties from `context.body`
 *  - starts long polling if enabled in `context.enableLongPolling`
 *
 * @param context {object}
 * @param self {object} Target object where properties are copied to
 * @param data {object} Source object where properties are copied from
 * @return {function(): boolean} Destruction function which will stop long polling, or a no-op function if long polling was not enabled.
 * @private
 */
export function setupStaticData (context, self, data) {

	// Copy properties from prototype
	_.forEach(context.properties, key => {
		const firstLetter = key && key.length >= 1 ? key[0] : '';
		if (firstLetter === '$' || firstLetter === '_') return;
		self[key] = _.cloneDeep(context.body[key])
	});

	// Copy properties from provided instance (arguments to constructor)
	if (_.isObject(data)) {
		_.forEach(Object.keys(data), key => {
			const firstLetter = key && key.length >= 1 ? key[0] : '';
			if (firstLetter === '_' || key === '$prototype') return;
			self[key] = _.cloneDeep(data[key]);
		});
	}

	if (context.enableLongPolling) {
		return longPollData(self, context.getRequest);
	}

	return () => {};
}

/**
 * Filter names of keywords in `body` to arrays based on their value $type.
 *
 * Functions are added to `methods` and non-functions to `properties`.
 *
 * @param body {object}
 * @returns {{methods: Array.<string>, properties: Array.<string>}}
 */
export function parseMethodsAndProperties (body) {
	let methods = [];
	let properties = [];

	Object.keys(body).forEach(key => {
		assertValidName(key);
		const value = body[key];
		const isMethod = _.isObject(value) && value.$type === 'Function';
		(isMethod ? methods : properties).push(key);
	});

	return {methods, properties};
}

/**
 * Create a class function from context data.
 *
 * @param context {object}
 * @returns {*}
 * @param setup {function(context, self, data): function}
 */
export function classFactory (context, {setup = setupStaticData} = {}) {
	let firstClassName;
	const types = parseTypeToArray(context.body.$type);
	switch(types.length) {

	case 0:
		return class {
			constructor(data) {
				setup(context, this, data);
			}
		};

	case 1:
		firstClassName = _.first(types);
		assertValidClassName(firstClassName);
		return (new Function("__setup", "return class "+firstClassName+" { constructor(data) { __setup(this, data); } }"))(setup.bind(undefined, context));

	default:
		firstClassName = _.first(types);
		return _.reduceRight(types, (Base, className) => {
			assertValidClassName(className);
			if (Base === undefined) {
				return (new Function("return class "+className+" {}"))();
			}
			debug.assert(Base).is('function');
			if (firstClassName === className) {
				return (new Function("__setup", "__Base", "return class "+className+" extends __Base { constructor(data) { super(); __setup(this, data); } }"))(setup.bind(undefined, context), Base);
			} else {
				return (new Function("__Base", "return class "+className+" extends __Base { constructor() { super(); } }"))(Base);
			}
		}, undefined);
	}
}

/**
 * Returns a Class function from a remote resource.
 *
 * @param body {object}
 * @param getRequest {function}
 * @param postRequest {function}
 * @param enableLongPolling {boolean}
 * @returns {Class}
 */
export function buildCloudClassSync (body, getRequest, postRequest, {enableLongPolling = false} = {}) {
	debug.assert(body).is('object');
	debug.assert(getRequest).is('function');
	debug.assert(postRequest).is('function');
	debug.assert(enableLongPolling).is('boolean');

	let { methods, properties } = parseMethodsAndProperties(body);

	const context = {
		body,
		methods,
		properties,
		getRequest,
		enableLongPolling
	};

	let Class = classFactory(context);

	// Add prototype methods
	_.forEach(methods, key => {
		const baseUrl = body.$ref || url;
		const methodUrl = (baseUrl && (baseUrl.length >= 1) && (baseUrl[baseUrl.length-1] === '/')) ? baseUrl + key : baseUrl + '/' + key;
		Class.prototype[key] = (...$args) => postRequest(methodUrl, {$args}).then(parsePayload);
	});

	return Class;
}

/** Get a JS class for this cloud object. It is either found from cache or generated.
 *
 * @param body {object}
 * @param request {{post: function, get: function}}
 * @param enableLongPolling {boolean}
 * @param cache {object}
 * @returns {Promise.<Function>}
 */
export function getCloudClassFromObject (
	body
	, request = require('./request/index.js')
	, {
		enableLongPolling = false
		, cache = CACHE
	} = {}
) {
	return promiseCall( () => {
		debug.assert(request).is('object');
		const postRequest = request.post;
		const getRequest = request.get;
		debug.assert(getRequest).is('function');
		debug.assert(postRequest).is('function');
		debug.assert(body).is('object');
		debug.assert(body.$id).is('uuid');
		debug.assert(enableLongPolling).is('boolean');

		let type;
		if (!_.isArray(body.$type)) {
			type = body.$type;
		} else {
			type = _.first(body.$type);
		}

		const id = body.$id;

		debug.assert(type).is('string');

		let cache1 = cache[type];
		if (!_.isObject(cache1)) {
			cache1 = cache[type] = {};
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
			Type: buildCloudClassSync(body, getRequest, postRequest, {enableLongPolling}),
			time: now
		};

		return cache2.Type;
	});
}

/**
 * Create a Class from a remote resource using an URL.
 *
 * @param url {string}
 * @param request {{post: function, get: function}}
 * @param enableLongPolling {boolean}
 * @param getClass {function} Defaults to `getCloudClassFromObject()`
 * @param prepareRequest {function} Defaults to `createRequestFunctionWithAuthorization()`
 * @param prepareGetRequest {function} Defaults to `prepareRequest()`
 * @param preparePostRequest {function} Defaults to `prepareRequest()`
 * @returns {*}
 */
export function getCloudClassFromURL (
	url
    , request = require('./request/index.js')
	, {
		enableLongPolling = false
		, getClass = getCloudClassFromObject
		, prepareRequest = createRequestFunctionWithAuthorization
		, prepareGetRequest = prepareRequest
		, preparePostRequest = prepareRequest
	} = {}
) {
	debug.assert(request).is('object');
	const postRequest = request.post;
	const getRequest = request.get;
	debug.assert(postRequest).is('function');
	debug.assert(getRequest).is('function');
	debug.assert(enableLongPolling).is('boolean');

	return getRequest(url).then( body => {
		debug.assert(body).is('object');
		debug.assert(body.$prototype).is('object');
		return getClass(
			body.$prototype
			, prepareGetRequest(getRequest, url)
			, preparePostRequest(postRequest, url)
			, {enableLongPolling}
		);
	});
}

/**
 * Create an instance of a remote resource from an object.
 *
 * @param body {object}
 * @param request {{post: function, get: function}}
 * @param enableLongPolling {boolean}
 * @param getClass {function: Promise}
 * @returns {Promise.<function>}
 */
export function getCloudInstanceFromObject (
	body
	, request = require('./request/index.js')
	, {
		enableLongPolling = false
		, getClass = getCloudClassFromObject
	} = {}
) {
	debug.assert(request).is('object');
	let postRequest = request.post;
	let getRequest = request.get;
	debug.assert(postRequest).is('function');
	debug.assert(getRequest).is('function');
	debug.assert(body).is('object');
	debug.assert(body.$prototype).is('object');
	debug.assert(enableLongPolling).is('boolean');
	return getClass(body.$prototype, getRequest, postRequest, {enableLongPolling}).then(Class => {
		debug.assert(Class).is('function');
		let instance = new Class(body);
		debug.assert(instance).is('object');
		return instance;
	});
}

/**
 * Create an instance of a remote resource using an URL.
 *
 * @param url {string}
 * @param request {{post: function, get: function}}
 * @param enableLongPolling {boolean}
 * @param getInstance {function} Defaults to `getCloudInstanceFromObject()`
 * @param prepareRequest {function} Defaults to `createRequestFunctionWithAuthorization()`
 * @param prepareGetRequest {function} Defaults to `prepareRequest()`
 * @param preparePostRequest {function} Defaults to `prepareRequest()`
 * @returns {Promise.<function>}
 */
export function getCloudInstanceFromURL (
	url
	, request = require('./request/index.js')
	, {
		enableLongPolling = false
		, getInstance = getCloudInstanceFromObject
		, prepareRequest = createRequestFunctionWithAuthorization
		, prepareGetRequest = prepareRequest
		, preparePostRequest = prepareRequest
	} = {}
) {

	debug.assert(request).is('object');
	let postRequest = request.post;
	let getRequest = request.get;
	debug.assert(postRequest).is('function');
	debug.assert(getRequest).is('function');
	debug.assert(enableLongPolling).is('boolean');

	getRequest = prepareGetRequest(getRequest, url);
	postRequest = preparePostRequest(postRequest, url);
	return getRequest(url).then(body => getInstance(body, request, {enableLongPolling}) );
}

/**
 * Check if value is a string and an URL.
 *
 * @param value {string}
 * @returns {boolean}
 */
export function isUrl (value) {
	return _.isString(value) && /^(ftp|https?):\/\//.test(value);
}

/** Get a JS class for this cloud object. It is either found from cache or generated.
 *
 * @param arg {string|object}
 * @param request {{post: function, get: function}|undefined}
 * @param enableLongPolling {boolean}
 * @param fromObject {function}
 * @param fromURL {function}
 * @returns {Promise.<function>}
 */
export function cloudClient (
	arg
	, request = require('./request/index.js')
	, {
		enableLongPolling = false
		, fromObject = getCloudInstanceFromObject
		, fromURL = getCloudInstanceFromURL
	} = {}
) {
	debug.assert(request).is('object');
	debug.assert(request.post).is('function');
	debug.assert(request.get).is('function');
	debug.assert(enableLongPolling).is('boolean');

	if (_.isObject(arg)) {
		debug.assert(fromObject).is('function');
		return fromObject(arg, request, {enableLongPolling});
	}

	if (isUrl(arg)) {
		debug.assert(fromURL).is('function');
		return fromURL(arg, request, {enableLongPolling});
	}

	throw new TypeError("Argument passed to cloudClient() is unsupported type: " + typeof arg);
}

/** Get a cloud class from an URL
 *
 * @type {function(Object, {post: Function, get: Function}, {enableLongPolling?: boolean}=): Promise<Function | never>}
 */
cloudClient.fromObject = getCloudInstanceFromObject;

/**
 *
 * @type {function(string, {post: Function, get: Function}, {enableLongPolling?: boolean}=): *}
 */
cloudClient.fromURL = getCloudInstanceFromURL;

/**
 *
 * @type {function(string, {post: Function, get: Function}, {enableLongPolling?: boolean}=): *}
 */
cloudClient.classFromURL = getCloudClassFromURL;

/**
 *
 * @type {function(Object, {post: Function, get: Function}, {enableLongPolling?: boolean}=): *}
 */
cloudClient.classFromObject = getCloudClassFromObject;

/**
 * Set Promise implementation.
 *
 * @param Promise {function} A promise implementation, eg ES6 `Promise` or `Q.Promise`.
 */
cloudClient.setPromise = (Promise) => {
	Async.Promise = Promise;
};

export default cloudClient;
