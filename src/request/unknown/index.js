import Q from 'q';

/** GET request */
function getRequest (url) {
	return Q.reject(new Error("No support for GET requests in your environment"));
}

/** POST request */
function postRequest (url, data) {
	return Q.reject(new Error("No support for POST requests in your environment"));
}

// Exports
const request = {
	get: getRequest,
	post: postRequest
};

export default request;