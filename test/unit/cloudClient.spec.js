import _ from 'lodash';
import sinon from 'sinon';
import assert from 'assert';
import Q from 'q';
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

	const p = Q.Promise( (resolve, reject) => {
		try {
			setTimeout(() => {
				try {
					Q.fcall(callback).then(resolve).catch(reject).done();
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

			getRequest.onCall(0).returns(Q({
				_statusCode: 200
				, $ref: 'https://example.com/path/to/resource'
				, $hash: '123457'
				, foobar: {
					hello: 'world'
				}
			}));

			getRequest.returns(Q({
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

});
