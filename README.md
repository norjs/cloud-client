Client for NorJS's cloud framework
==================================

This module creates client interfaces into services provided by 
[`@norjs/cloud-backend`](https://www.npmjs.com/package/@norjs/cloud-backend).

Install: `npm i --save '@norjs/cloud-client'`

```javascript
import cloudClient from '@norjs/cloud-client';

cloudClient('http://localhost:3000').then(instance => {
	return instance.getDate().then(date => {
		return instance.echo('foobar').then(str => {
			console.log('.echo("foobar") returned "' + str + '" of type '+ typeof str+ " and of class "+ str.constructor.name);
		});
	});
});
```
