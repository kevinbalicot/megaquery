'use strict';

const Requester = require('./src/server/requester');

const requester = new Requester('ds021691.mlab.com', 'tchat', 'admin', 'admin', '21691');
const port = process.env.NODE_PORT || 8080;

requester.listen(port);
console.log('Server started !');
