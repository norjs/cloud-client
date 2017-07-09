import _ from 'lodash';
import is from 'nor-is';
import debug from 'nor-debug';
import Q from 'q';
import URL from 'url';
import reserved from 'reserved-words';
import globals from 'globals';
import request from './request/index.js';

const _postRequest = request.post;
const _getRequest = request.get;

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
	if (is.array(type)) return type;
	if (is.string(type)) return [type];
	return [];
}

/** Check if reserved word in ES6 */
function isReservedWord (name) {
	if (reserved.check(name, 6)) {
		return true;
	}
	return globals.es6[name] !== undefined;
}

/** */
function isValidName (name) {
	return is.string(name) && is.pattern(name, /^[a-zA-Z$_][a-zA-Z0-9$_]*$/);
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
	return is.string(name) && is.pattern(name, /^[a-zA-Z][a-zA-Z0-9$_]*$/);
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
export function buildCloudClassSync (body, getRequest_, postRequest_) {
	//debug.log('body = ', body);
	debug.assert(getRequest_).is('function');
	debug.assert(postRequest_).is('function');

	debug.assert(body).is('object');

	let methods = [];
	let properties = [];

	Object.keys(body).forEach(key => {
		assertValidName(key);
		const value = body[key];
		const isMethod = is.object(value) && value.$type === 'Function';
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

					if (statusCode === 304) return;
					if (is.object(body)) return __updateData(self, body);

					debug.error('Warning! Could not update service: ', body);

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
		if (is.object(data)) {
			_.forEach(Object.keys(data), key => {
				const firstLetter = key && key.length >= 1 ? key[0] : '';
				//if (firstLetter === '$') return;
				if (firstLetter === '_') return;
				if (key === '$prototype') return;
				self[key] = _.cloneDeep(data[key]);
			});
		}

		__longPollData(self);
	};

	let Class;
	const types = parse_type(body.$type);
	//const constructorArgs = is.array(body.$args) ? body.$args : [];
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

export function buildCloudClass (body, getRequest_, postRequest_) {
	debug.assert(getRequest_).is('function');
	debug.assert(postRequest_).is('function');
	return Q.when(buildCloudClassSync(body, getRequest_, postRequest_));
}

/** Get a JS class for this cloud object. It is either found from cache or generated. */
export function getCloudClassFromObject (body, getRequest_, postRequest_) {
	return Q.fcall( () => {
		debug.assert(getRequest_).is('function');
		debug.assert(postRequest_).is('function');
		debug.assert(body).is('object');
		debug.assert(body.$id).is('uuid');

		let type;
		if (!is.array(body.$type)) {
			type = body.$type;
		} else {
			type = _.first(body.$type);
		}

		const id = body.$id;

		debug.assert(type).is('string');

		let cache1 = _cache[type];
		if (!is.object(cache1)) {
			cache1 = _cache[type] = {};
		}

		const now = (new Date().getTime());

		let cache2 = cache1[id];
		if (is.object(cache2)) {
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
			Type: buildCloudClassSync(body, getRequest_, postRequest_),
			time: now
		};

		return cache2.Type;
	});
}

export function getCloudClassFromURL (url) {
	return _getRequest(url).then( body => {
		debug.assert(body).is('object');
		debug.assert(body.$prototype).is('object');
		return getCloudClassFromObject(body.$prototype, fixAuthorization(_getRequest, url), fixAuthorization(_postRequest, url));
	});
}

export function getCloudInstanceFromObject (body, getRequest_, postRequest_) {
	debug.assert(getRequest_).is('function');
	debug.assert(postRequest_).is('function');
	debug.assert(body).is('object');
	debug.assert(body.$prototype).is('object');
	return getCloudClassFromObject(body.$prototype, getRequest_, postRequest_).then(Class => {
		debug.assert(Class).is('function');
		let instance = new Class(body);
		debug.assert(instance).is('object');
		return instance;
	});
}

export function getCloudInstanceFromURL (url) {
	const getRequest = fixAuthorization(_getRequest, url);
	const postRequest = fixAuthorization(_postRequest, url);
	return getRequest(url).then(body => getCloudInstanceFromObject(body, getRequest, postRequest) );
}

/** Get a JS class for this cloud object. It is either found from cache or generated. */
function cloudClient (arg) {
	if (is.object(arg)) return getCloudInstanceFromObject(arg, _getRequest, _postRequest);
	if (is.url(arg)) return getCloudInstanceFromURL(arg);
	throw new TypeError("Argument passed to cloudClient() is unsupported type: " + typeof arg);
}

/** Get a cloud class from an URL */
cloudClient.fromObject = getCloudInstanceFromObject;
cloudClient.fromURL = getCloudInstanceFromURL;

cloudClient.classFromURL = getCloudClassFromURL;
cloudClient.classFromObject = getCloudClassFromObject;

export default cloudClient;
