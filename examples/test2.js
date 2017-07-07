
import debug from 'nor-debug';
import cloudClient from '@sendanor/cloud-client';

cloudClient('http://localhost:3000').then(instance => {

	debug.log('instance = ', instance);
	debug.assert(instance).is('object');

	return instance.getDate().then(date => {
		debug.log('.getDate() returned ', date, " of type ", typeof date, " and of class ", date.constructor.name);
		debug.assert(date).is('date');

		return instance.echo('foobar').then(str => {
			debug.assert(str).is('string');
			debug.log('.echo("foobar") returned "' + str + '" of type ', typeof str, " and of class ", str.constructor.name);
		});
	});

}).fail(err => debug.error(err)).done();