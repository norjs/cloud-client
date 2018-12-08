import _ from 'lodash';
import sinon from 'sinon';
import assert from 'assert';

import { Async } from '../../dist/Async.js';

import {
	createRequestFunctionWithAuthorization
	, parseTypeToArray
	, isReservedWord
	, isValidName
	, assertValidName
	, isValidClassName
	, assertValidClassName
	, parsePayload
	, sleep
	, updateData
	, longPollData
	, LONG_POLLING_MIN_DELAY
	, setupStaticData
	, parseMethodsAndProperties
	, classFactory
	, buildCloudClassSync
	, getCloudClassFromObject
	, getCloudClassFromURL
	, getCloudInstanceFromObject
	, getCloudInstanceFromURL
	, isUrl
	, cloudClient
} from '../../dist/cloudClient.js';

/**
 * Exception safe destructor execution.
 *
 * @param destructors {Array.<Function>}
 */
function callDestructors (destructors) {
	_.forEach(destructors, destructor => {
		try {
			destructor();
		} catch (err) {
			console.error('Exception in destructor function: ', err);
		}
	});
}

/**
 * Step forward in time and call the function.
 *
 * @param clock {object}
 * @param callback {function}
 * @param time {number}
 * @returns {Promise}
 */
function stepForward (clock, callback, time) {

	const p = Async.Promise( (resolve, reject) => {
		try {
			setTimeout(() => {
				try {
					Async.done(Async.fcall(callback).then(resolve).catch(reject));
				} catch (err) {
					reject(err);
				}
			}, time);
		} catch (err) {
			reject(err);
		}
	});

	clock.tick(time + 50);
	clock.runMicrotasks();

	return p;
}

describe('cloudClient', () => {

	describe('#createRequestFunctionWithAuthorization(origCall, origUrl)', () => {

		it('should pass on same function if no authentication token', () => {
			const f1 = () => {};
			const f2 = createRequestFunctionWithAuthorization(f1, 'https://example.com:80');
			assert.equal(f1, f2);
		});

		it('should add the authentication token to the call with same hostname', () => {
			const f1 = sinon.spy();
			const f2 = createRequestFunctionWithAuthorization(f1, 'https://foo:bar@example.com:80');

			const data = {};
			f2('https://example.com:80/get/something', data);

			assert.equal(f1.calledOnce, true);
			assert.equal(f1.args[0][0], 'https://foo:bar@example.com:80/get/something');
			assert.equal(f1.args[0][1], data);

		});

		it('should not add the authentication token to the call with different hostname', () => {
			const f1 = sinon.spy();
			const f2 = createRequestFunctionWithAuthorization(f1, 'https://foo:bar@example.com:80');

			const data = {};
			f2('https://example.fi:80/get/something', data);

			assert.equal(f1.calledOnce, true);
			assert.equal(f1.args[0][0], 'https://example.fi:80/get/something');
			assert.equal(f1.args[0][1], data);

		});

	});

	describe('#parseTypeToArray(value)', () => {

		it('should parse a string value to an array', () => {
			assert.deepStrictEqual( parseTypeToArray("foo"), ["foo"]);
		});

		it('should parse an array value with one value to an array', () => {
			assert.deepStrictEqual( parseTypeToArray(["foo"]), ["foo"]);
		});

		it('should parse an array value with multiple values to an array', () => {
			assert.deepStrictEqual( parseTypeToArray(["foo", "bar"]), ["foo", "bar"]);
		});

		it('should parse undefined value to an empty array', () => {
			assert.deepStrictEqual( parseTypeToArray(undefined), [] );
		});

	});

	describe('#isReservedWord(name)', () => {

		it('should detect a reserved word', () => {
			assert.equal( isReservedWord("class"), true, "class is reserved word");
		});

		it('should detect non-reserved word', () => {
			assert.equal( isReservedWord("foo"), false, "foo is not reserved word");
		});

	});

	describe('#isValidName(name)', () => {

		it('should detect a valid word', () => {
			assert.equal( isValidName("f"), true, "'f' is valid word");
			assert.equal( isValidName("foo"), true, "'foo' is valid word");
			assert.equal( isValidName("FOO"), true, "'FOO' is valid word");
			assert.equal( isValidName("$foo"), true, "'$foo' is valid word");
			assert.equal( isValidName("_foo"), true, "'_foo' is valid word");
			assert.equal( isValidName("_123"), true, "'_123' is valid word");
			assert.equal( isValidName("_foo123"), true, "'_foo123' is valid word");
		});

		it('should detect non-valid word', () => {
			assert.equal( isValidName("foo "), false, "'foo ' is not valid word");
			assert.equal( isValidName(" foo "), false, "' foo ' is not valid word");
			assert.equal( isValidName("123"), false, "'123' is not valid word");
			assert.equal( isValidName(""), false, "'' is not valid word");
			assert.equal( isValidName(" "), false, "' ' is not valid word");
		});

	});

	describe('#assertValidName(name)', () => {

		it('should allow a valid words', () => {
			assertValidName("f");
			assertValidName("foo");
			assertValidName("FOO");
			assertValidName("$foo");
			assertValidName("_foo");
			assertValidName("_123");
			assertValidName("_foo123");
		});

		it('should throw errors on non-valid words', () => {
			assert.throws( () => assertValidName("foo "), TypeError, "'foo ' is not valid word");
			assert.throws( () => assertValidName(" foo "), TypeError, "' foo ' is not valid word");
			assert.throws( () => assertValidName("123"), TypeError, "'123' is not valid word");
			assert.throws( () => assertValidName(""), TypeError, "'' is not valid word");
			assert.throws( () => assertValidName(" "), TypeError, "' ' is not valid word");
		});

	});

	describe('#isValidClassName(name)', () => {

		it('should detect valid class names', () => {
			assert.equal( isValidClassName("f"), true, "'f' is valid class name");
			assert.equal( isValidClassName("foo"), true, "'foo' is valid class name");
			assert.equal( isValidClassName("FOO"), true, "'FOO' is valid class name");
		});

		it('should detect non-valid class names', () => {
			assert.equal( isValidClassName("foo "), false, "'foo ' is not valid class name");
			assert.equal( isValidClassName(" foo "), false, "' foo ' is not valid class name");
			assert.equal( isValidClassName("123"), false, "'123' is not valid class name");
			assert.equal( isValidClassName(""), false, "'' is not valid class name");
			assert.equal( isValidClassName(" "), false, "' ' is not valid class name");
			assert.equal( isValidClassName("$foo"), false, "'$foo' is not valid class name");
			assert.equal( isValidClassName("_foo"), false, "'_foo' is not valid class name");
			assert.equal( isValidClassName("_123"), false, "'_123' is not valid class name");
			assert.equal( isValidClassName("_foo123"), false, "'_foo123' is not valid class name");
		});

	});

	describe('#assertValidClassName(name)', () => {

		it('should accept valid class names', () => {
			assertValidClassName("f");
			assertValidClassName("foo");
			assertValidClassName("FOO");
		});

		it('should throw errors on non-valid class names', () => {
			assert.throws( () => assertValidClassName("foo "), TypeError, "'foo ' is not valid class name");
			assert.throws( () => assertValidClassName(" foo "), TypeError, "' foo ' is not valid class name");
			assert.throws( () => assertValidClassName("123"), TypeError, "'123' is not valid class name");
			assert.throws( () => assertValidClassName(""), TypeError, "'' is not valid class name");
			assert.throws( () => assertValidClassName(" "), TypeError, "' ' is not valid class name");
			assert.throws( () => assertValidClassName("$foo"), TypeError, "'$foo' is not valid class name");
			assert.throws( () => assertValidClassName("_foo"), TypeError, "'_foo' is not valid class name");
			assert.throws( () => assertValidClassName("_123"), TypeError, "'_123' is not valid class name");
			assert.throws( () => assertValidClassName("_foo123"), TypeError, "'_foo123' is not valid class name");
		});

	});

	describe('#parsePayload(result)', () => {

		it('should parse object payload without $path', () => {

			const result = {
				$type: 'object',
				payload: {
					foo: 'bar'
				}
			};

			const payload = parsePayload(result);

			assert.deepStrictEqual(payload, {$type: 'object', payload: {foo: 'bar'}}, "payload must match");
		});

		it('should parse object payload with $path', () => {

			const result = {
				$type: 'object',
				$path: 'payload',
				payload: {
					foo: 'bar'
				}
			};

			const payload = parsePayload(result);

			assert.deepStrictEqual(payload, {foo: 'bar'}, "payload must match");
		});

		it('should parse string payload with $path', () => {

			const result = {
				$type: 'string',
				$path: 'payload',
				payload: 'foobar'
			};

			const payload = parsePayload(result);

			assert.equal(payload, 'foobar', "payload must match");
		});

		it('should parse Date payload with $type', () => {

			const now = (new Date()).getTime();

			const result = {
				$type: 'Date',
				$path: 'payload',
				payload: now
			};

			const payload = parsePayload(result);

			assert.equal(payload.getTime(), now, "payload must match");
		});

	});

	describe('#sleep(time)', () => {

		it('should wait time', () => {

			const clock = sinon.useFakeTimers();
			try {

				let p = sleep(1000);

				assert.equal(clock.countTimers(), 1, "one timer left");

				let thenCalled = 0;

				p = p.then( () => thenCalled += 1 );

				clock.tick(600);
				clock.runMicrotasks();

				assert.equal(clock.countTimers(), 1, "one timer left");
				assert.equal(thenCalled, 0, "then was not yet called");

				clock.tick(600);
				clock.runMicrotasks();

				assert.equal(clock.countTimers(), 0, "no timers left");

				return p.then( () => {

					assert.equal(clock.countTimers(), 0, "no timers left");
					assert.equal(thenCalled, 1, "then must be called");

				}).finally( () => {
					clock.restore();
				});

			} catch (err) {
				clock.restore();
			}

		});
	});

	describe('#updateData(self, data)', () => {

		it('should copy properties', () => {
			let self = {
				$ref: 'https://example.com/path/to/resource'
			};
			const data = {
				$ref: 'https://example.com/path/to/resource',
				foo: 'bar'
			};
			updateData(self, data);
			assert.deepStrictEqual(self, {$ref: 'https://example.com/path/to/resource', foo: 'bar'});
		});

		it('should skip underscore properties', () => {
			let self = {
				$ref: 'https://example.com/path/to/resource'
			};
			const data = {
				$ref: 'https://example.com/path/to/resource',
				foo: 'bar',
				_bar: 'secret'
			};
			updateData(self, data);
			assert.deepStrictEqual(self, {$ref: 'https://example.com/path/to/resource', foo: 'bar'});
		});

		it('should skip dollar properties', () => {
			let self = {
				$ref: 'https://example.com/path/to/resource'
			};
			const data = {
				$ref: 'https://example.com/path/to/resource',
				foo: 'bar',
				$bar: 'secret'
			};
			updateData(self, data);
			assert.deepStrictEqual(self, {$ref: 'https://example.com/path/to/resource', foo: 'bar'});
		});

		it('should copy $id property', () => {
			let self = {
				$ref: 'https://example.com/path/to/resource'
			};
			const data = {
				$ref: 'https://example.com/path/to/resource',
				foo: 'bar',
				$id: '123456'
			};
			updateData(self, data);
			assert.deepStrictEqual(self, {$ref: 'https://example.com/path/to/resource', foo: 'bar', $id: '123456'});
		});

		it('should copy $hash property', () => {
			let self = {
				$ref: 'https://example.com/path/to/resource'
			};
			const data = {
				$ref: 'https://example.com/path/to/resource',
				foo: 'bar',
				$hash: '123456'
			};
			updateData(self, data);
			assert.deepStrictEqual(self, {$ref: 'https://example.com/path/to/resource', foo: 'bar', $hash: '123456'});
		});

	});

	describe('#longPollData(self, getRequest)', () => {

		it('should call getRequest after a moment', () => {

			const clock = sinon.useFakeTimers({
				now: 1483228800000
			});

			const self = {
				$ref: 'https://example.com/path/to/resource',
				$hash: '123456'
			};

			const context = {getRequest: () => {}};

			const getRequest = sinon.stub(context, "getRequest");

			getRequest.onCall(0).returns(Async.resolve({
				_statusCode: 200
				, $ref: 'https://example.com/path/to/resource'
				, $hash: '123457'
				, foobar: {
					hello: 'world'
				}
			}));

			getRequest.returns(Async.resolve({
				_statusCode: 200
				, $ref: 'https://example.com/path/to/resource'
				, $hash: '123458'
				, foobar: {
					hello: 'world2'
				}
			}));

			const destructor = longPollData(self, context);

			assert.equal(_.isFunction(destructor), true, "destructor must be function");

			assert.equal(getRequest.callCount, 0, "getRequest should not have been called yet");

			return stepForward(clock, () => {
				try {
					assert.equal(getRequest.callCount, 1, "getRequest should have been called once");

					assert.equal(self.$ref, 'https://example.com/path/to/resource');
					assert.equal(self.$hash, '123457');
					assert.deepStrictEqual(self.foobar, {hello: 'world'});

					return stepForward(clock, () => {
						try {

							assert.equal(getRequest.callCount, 2, "getRequest should have been called twice");

							assert.equal(self.$ref, 'https://example.com/path/to/resource');
							assert.equal(self.$hash, '123458');
							assert.deepStrictEqual(self.foobar, {hello: 'world2'});

						} finally {
							callDestructors([
								destructor
								, () => clock.restore()
							]);
						}

						return stepForward(clock, () => {
							assert.equal(clock.countTimers(), 0, "no timers left");
						}, 100);
					}, LONG_POLLING_MIN_DELAY + 50);

				} catch (err) {
					callDestructors([
						destructor
						, () => clock.restore()
					]);
				}

			}, LONG_POLLING_MIN_DELAY+50);

		});

	});

	describe('#setupStaticData(context, self, data)', () => {

		it('should copy properties from context.body', () => {

			const context = {
				properties: ['foo'],
				methods: [],
				body: {
					foo: 'bar'
				},
				enableLongPolling: false,
				getRequest: () => {}
			};

			const self = {
			};

			const data = {
			};

			setupStaticData(context, self, data);

			assert.deepStrictEqual(self, {foo: 'bar'});
		});

		it('should skip properties from context.body which start $ or _', () => {

			const context = {
				properties: ['$foo', '$hello'],
				methods: [],
				body: {
					$foo: 'bar',
					$hello: 'world'
				},
				enableLongPolling: false,
				getRequest: () => {}
			};

			const self = {
				foo: 'bar'
			};

			const data = {
			};

			setupStaticData(context, self, data);

			assert.deepStrictEqual(self, {foo: 'bar'});
		});

		it('should copy properties from data', () => {

			const context = {
				properties: [],
				methods: [],
				body: {
				},
				enableLongPolling: false,
				getRequest: () => {}
			};

			const self = {
			};

			const data = {
				foo: 'bar'
			};

			setupStaticData(context, self, data);

			assert.deepStrictEqual(self, {foo: 'bar'});
		});

		it('should skip properties from data which start _ or are $prototype', () => {

			const context = {
				properties: [],
				methods: [],
				body: {
				},
				enableLongPolling: false,
				getRequest: () => {}
			};

			const self = {
			};

			const data = {
				foo: 'bar',
				_hello: 'world',
				$prototype: {}
			};

			setupStaticData(context, self, data);

			assert.deepStrictEqual(self, {foo: 'bar'});
		});

		it('should copy properties from data over context.body', () => {

			const context = {
				properties: ['foo'],
				methods: [],
				body: {
					foo: 'hello'
				},
				enableLongPolling: false,
				getRequest: () => {}
			};

			const self = {
			};

			const data = {
				foo: 'bar'
			};

			setupStaticData(context, self, data);

			assert.deepStrictEqual(self, {foo: 'bar'});
		});

	});

	describe('#parseMethodsAndProperties(body)', () => {

		it('should parse empty object', () => {
			let body = {};
			let {methods, properties} = parseMethodsAndProperties(body);
			assert.deepStrictEqual(methods, [], "methods");
			assert.deepStrictEqual(properties, [], "properties");
		});

		it('should parse data object', () => {
			let body = {
				data: 'hello world'
			};
			let {methods, properties} = parseMethodsAndProperties(body);
			assert.deepStrictEqual(methods, [], "methods");
			assert.deepStrictEqual(properties, ['data'], "properties");
		});

		it('should parse method object', () => {
			let body = {
				getFoo: {
					$type: 'Function'
				}
			};
			let {methods, properties} = parseMethodsAndProperties(body);
			assert.deepStrictEqual(methods, ['getFoo'], "methods");
			assert.deepStrictEqual(properties, [], "properties");
		});

		it('should parse method object and data property', () => {
			let body = {
				getFoo: {
					$type: 'Function'
				},
				getBar: {
					$type: 'Function'
				},
				helloWorld: 'foobar',
				foo: 123
			};
			let {methods, properties} = parseMethodsAndProperties(body);
			assert.deepStrictEqual(methods, ['getFoo', 'getBar'], "methods");
			assert.deepStrictEqual(properties, ['helloWorld', 'foo'], "properties");
		});

	});

	describe('#classFactory(context)', () => {

		it('should create class from empty type', () => {
			const setup = sinon.stub();
			let context = {
				properties: ['$type'],
				body: {
					$type: []
				}
			};
			let Class = classFactory(context, {setup});
			assert.equal(_.isFunction(Class), true, "is a function");
			assert.equal(setup.calledOnce, false, "setup must not be called yet");
			let c = new Class();
			assert.equal(setup.calledOnce, true, "setup was called");
			assert.equal(_.isObject(c), true, "instance is an object");
		});

		it('should create class from named Foo type', () => {
			const setup = sinon.stub();
			let context = {
				properties: ['$type'],
				body: {
					$type: 'Foo'
				}
			};
			let Class = classFactory(context, {setup});
			assert.equal(_.isFunction(Class), true, "is a function");
			assert.equal(Class.name, "Foo", "name of class");
			assert.equal(setup.calledOnce, false, "setup must not be called yet");
			let c = new Class();
			assert.equal(setup.calledOnce, true, "setup was called");
			assert.equal(_.isObject(c), true, "instance is an object");
		});

		it('should create class Foo extended from Bar', () => {
			const setup = sinon.stub();
			let context = {
				properties: ['$type'],
				body: {
					$type: ['Foo', 'Bar']
				}
			};
			let Class = classFactory(context, {setup});
			assert.equal(_.isFunction(Class), true, "is a function");
			assert.equal(Class.name, "Foo", "name of class");
			assert.equal(Object.getPrototypeOf(Class).name, "Bar", "name of parent class");
			assert.equal(setup.calledOnce, false, "setup must not be called yet");
			let c = new Class();
			assert.equal(setup.calledOnce, true, "setup was called");
			assert.equal(_.isObject(c), true, "instance is an object");
		});

	});

	describe('#buildCloudClassSync()', () => {

		it('should create class with method', () => {
			const getRequest = sinon.stub();
			const postRequest = sinon.stub().returns(Async.resolve({
				"$id": "c3247bf6-8952-51d9-8388-6377423b1c47",
				"$hash": "a9b621e28280d72507bf7d84e2af36c300b3b8889e4ad9edc240b2f350ad8dd1",
				"$ref": "http://localhost:28028/send",
				"$type": "Object",
				"message": "250 OK",
				"messageId": "38bfaac0ade28f221b1f1bba2b636b@omppu2.local"
			}));

			let body = {
				"$id": "a99e8326-76b2-5d10-b38e-889d95083e3c",
				"$hash": "ef3216f1d0ba5a1178ea66c282683934e12a04ff9df018fc773f790fc96fa8f8",
				"$ref": "http://localhost:8025/",
				"$name": "SMTPService",
				"$type": [
					"SMTPService"
				],
				"send": {
					"$ref": "http://localhost:8025/send",
					"$type": "Function",
					"$method": "post",
					"$args": [
						"opts"
					],
					"length": 1,
					"name": "send"
				}
			};

			let SMTPService = buildCloudClassSync(body, getRequest, postRequest, {enableLongPolling: false});
			assert.equal(_.isFunction(SMTPService), true, "is a function");

			let service = new SMTPService();
			assert.equal(_.isObject(service), true, "service must be an object");

			assert.equal(_.isFunction(service.send), true, "service.send() must be a function");

			assert.equal(postRequest.calledOnce, false, "postRequest must not have been called yet")

			let p = service.send({foo:'bar'});

			assert.equal(postRequest.calledOnce, true, "postRequest must have been called now")

			return p.then(data => {
				assert.equal(_.isObject(data), true, "data must be object");
				assert.equal(data.$id, 'c3247bf6-8952-51d9-8388-6377423b1c47', "data.$id must be valid");
			});

		});

	});

	describe('#getCloudClassFromObject()', () => {

		it('should create class with method', () => {

			const cache = {};

			const getRequest = sinon.stub();

			const postRequest = sinon.stub().returns(Async.resolve({
				"$id": "c3247bf6-8952-51d9-8388-6377423b1c47",
				"$hash": "a9b621e28280d72507bf7d84e2af36c300b3b8889e4ad9edc240b2f350ad8dd1",
				"$ref": "http://localhost:28028/send",
				"$type": "Object",
				"message": "250 OK",
				"messageId": "38bfaac0ade28f221b1f1bba2b636b@omppu2.local"
			}));

			const request = {
				get: getRequest
				, post: postRequest
			};

			let body = {
				"$id": "a99e8326-76b2-5d10-b38e-889d95083e3c",
				"$hash": "ef3216f1d0ba5a1178ea66c282683934e12a04ff9df018fc773f790fc96fa8f8",
				"$ref": "http://localhost:8025/",
				"$name": "SMTPService",
				"$type": [
					"SMTPService"
				],
				"send": {
					"$ref": "http://localhost:8025/send",
					"$type": "Function",
					"$method": "post",
					"$args": [
						"opts"
					],
					"length": 1,
					"name": "send"
				}
			};

			let SMTPServicePromise = getCloudClassFromObject(body, request, {enableLongPolling: false, cache});

			return SMTPServicePromise.then(SMTPService => {

				assert.equal(_.isFunction(SMTPService), true, "is a function");

				assert.equal(_.isObject(cache.SMTPService), true, 'cache.SMTPService must exist');
				const cachedObject = cache.SMTPService['a99e8326-76b2-5d10-b38e-889d95083e3c'];
				assert.equal(_.isObject(cachedObject), true, 'cached object exists');
				assert.equal(cachedObject.Type, SMTPService, 'cached class must be SMTPService');

				let service = new SMTPService();
				assert.equal(_.isObject(service), true, "service must be an object");

				assert.equal(_.isFunction(service.send), true, "service.send() must be a function");

				assert.equal(postRequest.calledOnce, false, "postRequest must not have been called yet")

				let p = service.send({foo:'bar'});

				assert.equal(postRequest.calledOnce, true, "postRequest must have been called now")

				return p.then(data => {
					assert.equal(_.isObject(data), true, "data must be object");
					assert.equal(data.$id, 'c3247bf6-8952-51d9-8388-6377423b1c47', "data.$id must be valid");
				});

			});

		});

		it('should return class from cache', () => {

			class SMTPService {

			}

			const cache = {
				SMTPService: {
					['a99e8326-76b2-5d10-b38e-889d95083e3c']: {
						name: 'SMTPService',
						id: 'a99e8326-76b2-5d10-b38e-889d95083e3c',
						Type: SMTPService,
						time: (new Date().getTime())
					}
				}
			};

			const getRequest = sinon.stub();

			const postRequest = sinon.stub();

			const request = {
				get: getRequest
				, post: postRequest
			};

			let body = {
				"$id": "a99e8326-76b2-5d10-b38e-889d95083e3c",
				"$hash": "ef3216f1d0ba5a1178ea66c282683934e12a04ff9df018fc773f790fc96fa8f8",
				"$ref": "http://localhost:8025/",
				"$name": "SMTPService",
				"$type": [
					"SMTPService"
				],
				"send": {
					"$ref": "http://localhost:8025/send",
					"$type": "Function",
					"$method": "post",
					"$args": [
						"opts"
					],
					"length": 1,
					"name": "send"
				}
			};

			let SMTPServicePromise = getCloudClassFromObject(body, request, {enableLongPolling: false, cache});
			return SMTPServicePromise.then(Service => {
				assert.equal(_.isFunction(Service), true, "is a function");
				assert.equal(Service, SMTPService, "is same as our SMTPService");
			});

		});

	});

	describe('#getCloudClassFromURL()', () => {

		it('should create class from URL', () => {

			const url = 'http://localhost:8025/';

			class SMTPService {}

			const getResult = {
				"$id": "1c48b887-8951-5f02-ad71-0492ffd485c6",
				"$hash": "116e58c7b1b1e875e11c7d4db3aad4487e275c136a4cd5a7ba07d33a3df0c0a8",
				"$ref": "http://localhost:8025/",
				"$type": "SMTPService",
				"$prototype": {
					"$id": "a99e8326-76b2-5d10-b38e-889d95083e3c",
					"$hash": "ef3216f1d0ba5a1178ea66c282683934e12a04ff9df018fc773f790fc96fa8f8",
					"$ref": "http://localhost:8025/",
					"$name": "SMTPService",
					"$type": [
						"SMTPService"
					],
					"send": {
						"$ref": "http://localhost:8025/send",
						"$type": "Function",
						"$method": "post",
						"$args": [
							"opts"
						],
						"length": 1,
						"name": "send"
					}
				}
			};

			const request = {
				get: sinon.stub().returns(Async.resolve(getResult))
				, post: sinon.stub()
			};

			const getClass = sinon.stub().returns(Async.resolve(SMTPService));
			const prepareGetRequest = sinon.spy(call => call);
			const preparePostRequest = sinon.spy(call => call);

			return getCloudClassFromURL(
				url
				, request
				, {
					enableLongPolling: false
					, getClass
					, prepareGetRequest
					, preparePostRequest
				}
			).then( Class => {

				assert.equal(getClass.calledOnce, true, "getClass must have been called only once");
				assert.equal(request.get.calledOnce, true, "request.get must have been called once");
				assert.equal(request.post.called, false, "request.post must not have been called");
				assert.equal(prepareGetRequest.calledOnce, true, "prepareGetRequest must have been called only once");
				assert.equal(preparePostRequest.calledOnce, true, "preparePostRequest must have been called only once");
				assert.equal(Class, SMTPService, "Class must equal SMTPService");

			});

		});

	});

	describe('#getCloudInstanceFromObject()', () => {

		it('should create instance from object', () => {

			const url = 'http://localhost:8025/';

			class SMTPService {}

			const classes = {
				SMTPService
			};

			const constructorSpy = sinon.spy(classes, "SMTPService");

			const body = {
				"$id": "1c48b887-8951-5f02-ad71-0492ffd485c6",
				"$hash": "116e58c7b1b1e875e11c7d4db3aad4487e275c136a4cd5a7ba07d33a3df0c0a8",
				"$ref": "http://localhost:8025/",
				"$type": "SMTPService",
				"$prototype": {
					"$id": "a99e8326-76b2-5d10-b38e-889d95083e3c",
					"$hash": "ef3216f1d0ba5a1178ea66c282683934e12a04ff9df018fc773f790fc96fa8f8",
					"$ref": "http://localhost:8025/",
					"$name": "SMTPService",
					"$type": [
						"SMTPService"
					],
					"send": {
						"$ref": "http://localhost:8025/send",
						"$type": "Function",
						"$method": "post",
						"$args": [
							"opts"
						],
						"length": 1,
						"name": "send"
					}
				}
			};

			const getRequest = sinon.stub().returns(Async.resolve({}));
			const postRequest = sinon.stub();

			const request = {
				get: getRequest
				, post: postRequest
			};

			const getClass = sinon.stub().returns(Async.resolve(classes.SMTPService));

			return getCloudInstanceFromObject(
				body
				, request
				, {
					enableLongPolling: false
					, getClass
				}
			).then( instance => {
				assert.equal(getClass.calledOnce, true, "getClass must have been called only once");
				assert.equal(getRequest.called, false, "request.get must not have been called");
				assert.equal(postRequest.called, false, "request.post must not have been called");
				assert.equal(constructorSpy.calledOnce, true, "constructor must have been called once");
				assert.deepStrictEqual(constructorSpy.args[0][0], body, "constructor must have been called with body");
				assert.equal(instance instanceof SMTPService, true, "instance must be of SMTPService");
			});

		});

	});

	describe('#getCloudInstanceFromURL()', () => {

		it('should create instance from URL', () => {

			const url = 'http://localhost:8025/';

			class SMTPService {}

			const getResult = {
				"$id": "1c48b887-8951-5f02-ad71-0492ffd485c6",
				"$hash": "116e58c7b1b1e875e11c7d4db3aad4487e275c136a4cd5a7ba07d33a3df0c0a8",
				"$ref": "http://localhost:8025/",
				"$type": "SMTPService",
				"$prototype": {
					"$id": "a99e8326-76b2-5d10-b38e-889d95083e3c",
					"$hash": "ef3216f1d0ba5a1178ea66c282683934e12a04ff9df018fc773f790fc96fa8f8",
					"$ref": "http://localhost:8025/",
					"$name": "SMTPService",
					"$type": [
						"SMTPService"
					],
					"send": {
						"$ref": "http://localhost:8025/send",
						"$type": "Function",
						"$method": "post",
						"$args": [
							"opts"
						],
						"length": 1,
						"name": "send"
					}
				}
			};

			const request = {
				get: sinon.stub().returns(Async.resolve(getResult))
				, post: sinon.stub()
			};

			const getInstance = sinon.stub().returns(Async.resolve(new SMTPService()));
			const prepareGetRequest = sinon.spy(call => call);
			const preparePostRequest = sinon.spy(call => call);

			return getCloudInstanceFromURL(
				url
				, request
				, {
					enableLongPolling: false
					, getInstance
					, prepareGetRequest
					, preparePostRequest
				}
			).then( instance => {
				assert.equal(getInstance.calledOnce, true, "getClass must have been called only once");
				assert.deepStrictEqual(getInstance.args[0][0], getResult, "getClass must have been called with getResult");
				assert.equal(request.get.calledOnce, true, "request.get must have been called once");
				assert.equal(request.get.args[0][0], url, "request.get must have been called with url");
				assert.equal(request.post.called, false, "request.post must not have been called");
				assert.equal(prepareGetRequest.called, true, "prepareGetRequest must have been called once");
				assert.equal(preparePostRequest.called, true, "preparePostRequest must have been called once");
				assert.equal(instance instanceof SMTPService, true, "instance must be of SMTPService");
			});

		});

	});

	describe('#isUrl(url)', () => {

		it('should detect a valid url', () => {
			assert.equal( isUrl("http://example.com:80/"), true);
			assert.equal( isUrl("https://example.com:80/"), true);
			assert.equal( isUrl("http://example.com/"), true);
			assert.equal( isUrl("https://example.com/"), true);
			assert.equal( isUrl("http://example.com"), true);
			assert.equal( isUrl("https://example.com"), true);
			assert.equal( isUrl("http://example.com/foo/bar"), true);
			assert.equal( isUrl("https://example.com/foo/bar"), true);
		});

		it('should detect non-valid url', () => {
			assert.equal( isUrl("example.com"), false, "'example.com' is not valid url");
			assert.equal( isUrl("example.com:80"), false, "'example.com:80' is not valid url");
			assert.equal( isUrl("foo"), false, "'foo' is not valid url");
			assert.equal( isUrl("FOO"), false, "'FOO' is not valid url");
			assert.equal( isUrl("$foo"), false, "'$foo' is not valid url");
			assert.equal( isUrl("_foo"), false, "'_foo' is not valid url");
			assert.equal( isUrl("_123"), false, "'_123' is not valid url");
			assert.equal( isUrl("_foo123"), false, "'_foo123' is not valid url");
			assert.equal( isUrl("foo "), false, "'foo ' is not valid url");
			assert.equal( isUrl(" foo "), false, "' foo ' is not valid url");
			assert.equal( isUrl("123"), false, "'123' is not valid url");
			assert.equal( isUrl(""), false, "'' is not valid url");
			assert.equal( isUrl(" "), false, "' ' is not valid url");
		});

	});

	describe('#cloudClient', () => {

		it('should create instance from URL', () => {

			const url = 'http://localhost:8025/';

			class SMTPService {}

			const getResult = {
				"$id": "1c48b887-8951-5f02-ad71-0492ffd485c6",
				"$hash": "116e58c7b1b1e875e11c7d4db3aad4487e275c136a4cd5a7ba07d33a3df0c0a8",
				"$ref": "http://localhost:8025/",
				"$type": "SMTPService",
				"$prototype": {
					"$id": "a99e8326-76b2-5d10-b38e-889d95083e3c",
					"$hash": "ef3216f1d0ba5a1178ea66c282683934e12a04ff9df018fc773f790fc96fa8f8",
					"$ref": "http://localhost:8025/",
					"$name": "SMTPService",
					"$type": [
						"SMTPService"
					],
					"send": {
						"$ref": "http://localhost:8025/send",
						"$type": "Function",
						"$method": "post",
						"$args": [
							"opts"
						],
						"length": 1,
						"name": "send"
					}
				}
			};

			const request = {
				get: sinon.stub().returns(Async.resolve(getResult))
				, post: sinon.stub()
			};

			const fromURL = sinon.stub().returns(Async.resolve(new SMTPService()));
			const fromObject = sinon.stub().returns(Async.resolve(new SMTPService()));

			return cloudClient(
				url
				, request
				, {
					enableLongPolling: false
					, fromObject
					, fromURL
				}
			).then( instance => {
				assert.equal(fromURL.calledOnce, true, "fromURL must have been called only once");
				assert.equal(fromObject.notCalled, true, "fromObject must not have been called");
				assert.deepStrictEqual(fromURL.args[0][0], url, "fromURL must have been called with url");
				assert.deepStrictEqual(fromURL.args[0][1], request, "fromURL must have been called with request 2nd argument");
				assert.deepStrictEqual(fromURL.args[0][2].enableLongPolling, false, "fromURL must have been called with enableLongPolling as false");
				assert.equal(request.get.notCalled, true, "request.get must not have been called");
				assert.equal(request.post.notCalled, true, "request.post must not have been called");
				assert.equal(instance instanceof SMTPService, true, "instance must be of SMTPService");
			});

		});

		it('should create instance from object', () => {

			const url = 'http://localhost:8025/';

			class SMTPService {}

			const result = {
				"$id": "1c48b887-8951-5f02-ad71-0492ffd485c6",
				"$hash": "116e58c7b1b1e875e11c7d4db3aad4487e275c136a4cd5a7ba07d33a3df0c0a8",
				"$ref": "http://localhost:8025/",
				"$type": "SMTPService",
				"$prototype": {
					"$id": "a99e8326-76b2-5d10-b38e-889d95083e3c",
					"$hash": "ef3216f1d0ba5a1178ea66c282683934e12a04ff9df018fc773f790fc96fa8f8",
					"$ref": "http://localhost:8025/",
					"$name": "SMTPService",
					"$type": [
						"SMTPService"
					],
					"send": {
						"$ref": "http://localhost:8025/send",
						"$type": "Function",
						"$method": "post",
						"$args": [
							"opts"
						],
						"length": 1,
						"name": "send"
					}
				}
			};

			const request = {
				get: sinon.stub().returns(Async.resolve(result))
				, post: sinon.stub()
			};

			const fromURL = sinon.stub().returns(Async.resolve(new SMTPService()));
			const fromObject = sinon.stub().returns(Async.resolve(new SMTPService()));

			return cloudClient(
				result
				, request
				, {
					enableLongPolling: false
					, fromObject
					, fromURL
				}
			).then( instance => {
				assert.equal(fromURL.notCalled, true, "fromURL must not have been called");
				assert.equal(fromObject.calledOnce, true, "fromObject must have been called");
				assert.deepStrictEqual(fromObject.args[0][0], result, "fromObject must have been called with result object");
				assert.deepStrictEqual(fromObject.args[0][1], request, "fromObject must have been called with request 2nd argument");
				assert.deepStrictEqual(fromObject.args[0][2].enableLongPolling, false, "fromObject must have been called with enableLongPolling as false");
				assert.equal(request.get.notCalled, true, "request.get must not have been called");
				assert.equal(request.post.notCalled, true, "request.post must not have been called");
				assert.equal(instance instanceof SMTPService, true, "instance must be of SMTPService");
			});

		});

		it('should have .fromObject', () => {
			assert.equal(cloudClient.fromObject, getCloudInstanceFromObject);
		});

		it('should have .fromURL', () => {
			assert.equal(cloudClient.fromURL, getCloudInstanceFromURL);
		});

		it('should have .classFromURL', () => {
			assert.equal(cloudClient.classFromURL, getCloudClassFromURL);
		});

		it('should have .classFromObject', () => {
			assert.equal(cloudClient.classFromObject, getCloudClassFromObject);
		});

	});

});
