//import _ from 'lodash';
//import sinon from 'sinon';
import assert from 'assert';
import { parseTypeToArray } from '../../dist/cloudClient.js';

describe('cloudClient', () => {

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

});
