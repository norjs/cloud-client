import angular from 'angular';
import debug from 'nor-debug';
import { Async } from '../../Async.js';

/** Angular to our promise wrapper */
function qWrap (f) {
	debug.assert(f).is('function');
	return Async.Promise( (resolve, reject) => {
		const initInjector = angular.injector(['ng']);
		const $http = initInjector.get('$http');
		const $q = initInjector.get('$q');
		$q.when(f($http)).then( payload => {
			console.log('GET payload =', payload);
			return resolve(payload.data);
		}).catch(reject);
	});
}

/** Get HTTP headers from options */
function getHeaders (opts) {
	let headers;

	if (opts.etag) {
		if (!headers) {
			headers = {};
		}
		headers['if-none-match'] = opts.etag;
	}

	if (opts.wait) {
		if (!headers) {
			headers = {};
		}
		headers.prefer = 'wait=' + opts.wait;
	}

	return headers;
}

/** GET request */
function getRequest (url, opts={}) {
	return qWrap( $http => {
		const headers = getHeaders(opts);
		return $http.get(url, {headers});
	});
}

/** POST request */
function postRequest (url, data, opts={}) {
	return qWrap( $http => {
		const headers = getHeaders(opts);
		return $http.post(url, JSON.stringify(data), {headers});
	});
}

// Exports
const request = {
	get: getRequest,
	post: postRequest
};

export default request;
