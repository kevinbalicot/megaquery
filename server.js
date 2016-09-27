'use strict';

const Requester = require('./src/server/requester');

const requester = new Requester('ds021691.mlab.com', 'tchat', 'admin', 'admin', '21691');
requester.listen(8081);
console.log('Server started !');
