
import Q from 'q';

/** GET request */
function getRequest ($http, url) {
	return Q.when($http.get(url));
}

/** POST request */
function postRequest ($http, url, data) {
	return Q.when($http.post(url, data));
}

// Exports
const request = $http => ({
	get: (...args) => getRequest($http, ...args),
	post: (...args) => postRequest($http, ...args),
});

export default request;