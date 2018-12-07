/** HTTP/HTTPS requests */

import _ from 'lodash';
import debug from 'nor-debug';
import Q from 'q';
import URL from 'url';
import HTTPError from '../../HTTPError';
import LazyProtocolPicker from './LazyProtocolPicker.js';

const protocolPicker = new LazyProtocolPicker();

/** */
function _parse_url (url) {
	return URL.parse(url, true);
}

function _parseProtocol (protocol) {
	protocol = protocol || 'http';
	if (protocol[protocol.length-1] === ':') {
		return protocol.substr(0, protocol.length - 1 );
	}
	return protocol;
}

function __request_errorListener (req, listeners, reject, err) {
	reject(err);
	req.removeListener('response', listeners.response);
	delete listeners.response;
}

function __request_response_endListener (res, listeners, buffer) {

	res.removeListener('data', listeners.data);
	delete listeners.data;

	let contentType = res.headers['content-type'] || undefined;
	if ( (!contentType) && buffer[0] === '{') {
		contentType = 'application/json';
	}

	const statusCode = res.statusCode;

	// Support for redirections
	//if ( (statusCode >= 301) && (statusCode <= 303) ) {
	//
	//	if (redirectLoopCounter < 0) {
	//		throw new Error('Redirect loop detected');
	//	}
	//
	//	redirectLoopCounter -= 1;
	//
	//	return request(res.headers.location, {
	//		'method': 'GET',
	//		'headers': {
	//			'accept': opts.url.headers && opts.url.headers.accept
	//		}
	//	});
	//}

	if (!((statusCode >= 200) && (statusCode < 400))) {
		throw new HTTPError(statusCode, ((contentType === 'application/json') ? JSON.parse(buffer) : buffer) );
	}

	buffer = (contentType === 'application/json') ? JSON.parse(buffer) : buffer;

	if (buffer === '') {
		buffer = {};
	}

	if (_.isObject(buffer)) {
		buffer._statusCode = statusCode;
	}

	return buffer;
}

function __request_responseListener (req, res, listeners, resolve) {
	let buffer = "";

	listeners.data = chunk => buffer += chunk;
	listeners.end = () => resolve( Q.fcall( () => __request_response_endListener(res, listeners, buffer) ));

	res.setEncoding('utf8');
	res.on('data', listeners.data);
	res.once('end', listeners.end);

	req.removeListener('error', listeners.error);
	delete listeners.error;
}

function __request (resolve, reject, method, url, body, opts={}) {
	method = _.toLower(method);

	//debug.log('method = ', method)
	//debug.log('url = ', url)

	const options = _parse_url(url);
	//debug.log('options = ', options);
	debug.assert(options).is('object');

	options.method = method;

	const protocol = _parseProtocol(options.protocol);

	//debug.log('protocol = ', protocol);

	const protocolImplementation = protocolPicker[protocol];

	if (!protocolImplementation) throw new Error("No implementation detected for " + protocol);

	if (opts.etag) {
		if (!options.headers) {
			options.headers = {};
		}
		options.headers['if-none-match'] = opts.etag;
	}

	if (opts.wait) {
		if (!options.headers) {
			options.headers = {};
		}
		options.headers.prefer = 'wait=' + opts.wait;
	}

	const req = protocolImplementation.request(options);

	let listeners = {};

	/** Error event listener */
	listeners.error = err => __request_errorListener(req, listeners, reject, err);

	/** Response event listener */
	listeners.response = res => __request_responseListener(req, res, listeners, resolve);

	// Register listeners
	req.once('error', listeners.error);
	req.once('response', listeners.response);

	if (body && (method !== 'get')) {
		const buffer = _.isString(body) ? body : JSON.stringify(body);
		req.end( buffer, 'utf8' );
	} else {
		req.end();
	}
}

/** */
function _request (method, url, body, opts) {
	return Q.Promise( (resolve, reject) => __request(resolve, reject, method, url, body, opts));
}

/** GET request */
function getRequest (url, opts={}) {
	return _request("get", url, null, opts);
}

/** POST request */
function postRequest (url, data, opts={}) {
	return _request("post", url, data, opts);
}

// Exports
const request = {
	get: getRequest,
	post: postRequest
};

export default request;