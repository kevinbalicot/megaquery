'use strict';

const engine = require('engine.io-client');
const EventEmitter = require('./../common/event-emitter');

class Requester extends EventEmitter {

    constructor () {
        super();
        this.connection = null;
        this.connecting = false;
        this.connected = false;
        this.queries = [];
    }

    connect (url, port = 8080) {
        this.connection = new engine.Socket(`${url}:${port}`);
        this.connection.on('open', () => {
            this.connected = true;
            this.trigger('open');

            if (!!this.connecting) {
                //clearInterval(this.connecting);
                //this.connecting = null;
            }

            // Receive message from server
            this.connection.on('message', query => {
                query = JSON.parse(query);
                this.refresh(query);
                this.trigger('message', query);
            });

            // Lost connection with server, try to reconnect
            this.connection.on('close', () => {
                this.connected = false;
                this.trigger('close');
                //this.listenNewConnection(url, port);
            });
        });
    }

    refresh (query) {
        let storedQuery = this.queries.find(el => el.id === query.id);
        storedQuery.result = query.result || [];
    }

    get (id) {
        return this.queries.find(el => el.id === id);
    }

    merge (query) {
        if (query.type === 'find' || query.type === 'findOne') {
            let storedQuery = this.queries.find(el => el.id === query.id);

            if (!storedQuery) {
                this.queries.push(query);
            }
        }

        this.connection.send(JSON.stringify({
            id: query.id,
            collection: query.collection,
            params: JSON.stringify(query.params),
            selector: JSON.stringify(query.selector),
            type: query.type,
            limit: query.limit,
            sort: JSON.stringify(query.sort),
            skip: query.skip,
            options: JSON.stringify(query.options)
        }));
    }

    find (collection, params = {}, limit = 1000, sort = null, skip = 0) {
        const type = 'find';
        const id = `${collection}.${type}.${JSON.stringify(params)}.${skip}.${limit}.${JSON.stringify(sort)}`;
        const query = { id, collection, params, type, limit, sort, skip };

        this.merge(query);

        return id;
    }

    findOne (collection, params = {}, limit = 1000, sort = null, skip = 0) {
        const type = 'findOne';
        const id = `${collection}.${type}.${JSON.stringify(params)}.${skip}.${limit}.${JSON.stringify(sort)}`;
        const query = { id, collection, params, type, limit, sort, skip };

        this.merge(query);

        return id;
    }

    insert (collection, params, options = null) {
        const type = 'insert';
        const query = { collection, params, options, type };

        this.merge(query);
    }

    remove (collection, id, options = null) {
        const type = 'remove';
        const query = { collection, params: { id }, options, type };

        this.merge(query);
    }

    update (collection, selector, params, options = null) {
        const type = 'update';
        const query = { collection, selector, params, options, type };

        this.merge(query);
    }

    request (collection, params = {}, type = 'find', limit = 1000, sort = null, skip = 0) {
        const id = `${collection}.${type}.${JSON.stringify(params)}.${skip}.${limit}.${JSON.stringify(sort)}`;
        const query = { id, collection, params, type, limit, sort, skip };

        this.merge(query);

        return id;
    }
}

module.exports = Requester;
