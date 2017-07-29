
import Q from 'q';

/** GET request */
function getRequest ($http, url) {
	return Q.Promise(
		(resolve, reject) => $http.get(url).then( payload => {
			"use strict";
			console.log('GET payload =', payload);
			return resolve(payload.data);
		}).catch(reject)
	);
}

/** POST request */
function postRequest ($http, url, data) {
	return Q.Promise(
		(resolve, reject) => $http.post(url, JSON.stringify(data)).then( payload => {
			"use strict";
			console.log('POST payload =', payload);
			return resolve(payload.data);
		}).catch(reject)
	);
}

// Exports
const request = $http => ({
	get: (...args) => getRequest($http, ...args),
	post: (...args) => postRequest($http, ...args),
});

export default request;