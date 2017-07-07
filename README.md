Client for Sendanor's cloud framework
=====================================

This module creates client interfaces into services provided by [`@sendanor/cloud-backend`](https://www.npmjs.com/package/@sendanor/cloud-backend).

Install: `npm i --save '@sendanor/cloud-client'`

```javascript
import cloudClient from '@sendanor/cloud-client';

cloudClient('http://localhost:3000').then(instance => {
	return instance.getDate().then(date => {
		return instance.echo('foobar').then(str => {
			console.log('.echo("foobar") returned "' + str + '" of type '+ typeof str+ " and of class "+ str.constructor.name);
		});
	});
});
```
