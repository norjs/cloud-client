
import Q from 'q';
import angular from 'angular';

const $injector = angular.injector();
const $http = $injector.get('$http');

/** GET request */
function getRequest (url) {
	return Q.when($http.get(url));
}

/** POST request */
function postRequest (url, data) {
	return Q.when($http.post(url, data));
}

// Exports
const request = {
	get: getRequest,
	post: postRequest
};

export default request;