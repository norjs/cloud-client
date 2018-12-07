import { STATUS_CODES } from 'http';

/** User defined custom codes.
 *
 * @type {{}}
 * @private
 * @TODO - implement static method to register a new CODE constructor
 */
const CODES = {};

/** Exception type for HTTP errors */
export default class HTTPError extends Error {

	constructor (...args) {
		super();

		let headers, msg, code;
		_.forEach(args, arg => {
			if (_.isObject(arg)) {
				headers = arg;
				return;
			}
			if (_.isString(arg)) {
				msg = arg;
				return;
			}
			if (_.isNumber(arg)) {
				code = arg;
			}
		});

		code = code || 500;
		msg = msg || (''+code+' '+STATUS_CODES[code]);
		headers = headers || {};

		Error.captureStackTrace(this, HTTPError);
		this.code = code;
		this.message = msg;
		this.headers = headers;
	}

	/** Create HTTP exception */
	static create (code, msg, headers) {
 		return (CODES[code] && CODES[code](code, msg, headers)) || new HTTPError(code, msg, headers);
	}

}

HTTPError.prototype.name = 'HTTP Error';
