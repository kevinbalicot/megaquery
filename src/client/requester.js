'use strict';

const engine = require('engine.io-client');
const EventEmitter = require('./../common/event-emitter');

class Requester extends EventEmitter {

    constructor () {
        super();
        this.connection = null;
        this.connecting = true;
        this.connected = false;
        this.queries = [];
    }

    connect (url, port = 8080) {
        if (!!this.connected) {
            return this;
        }

        clearInterval(this.connecting);
        this.listenNewConnection(url, port);

        this.connection = new engine.Socket(`${url}:${port}`);
        this.connection.on('open', () => {
            this.connected = true;
            this.trigger('open');

            if (!!this.connecting) {
                clearInterval(this.connecting);
                this.connecting = false;
            }

            // Receive message from server
            this.connection.on('message', query => {
                query = JSON.parse(query);
                this.refresh(query);
                this.trigger('message', query);
                this.trigger(query.id, query);

                if (query.type === 'find' || query.type === 'findOne' || query.type === 'aggregate') {
                    this.trigger(`message-${query.collection}`, query);
                    this.trigger(`${query.collection}.${query.type}.${query.params}`, query);
                }
            });

            // Lost connection with server, try to reconnect
            this.connection.on('close', () => {
                this.connected = false;
                this.trigger('close');
                this.listenNewConnection(url, port);
            });
        });
    }

    /**
     * Try to reconnecte
     * @param url
     * @param port
     */
    listenNewConnection (url, port) {
        this.connecting = setInterval(() => {
            this.connect(url, port);
        }, 10000);
    }

    refresh (query) {
        let storedQuery = this.queries.find(el => el.id === query.id);

        if (!!storedQuery) {
            storedQuery.result = query.result || [];
        }
    }

    get (id) {
        return this.queries.find(el => el.id === id);
    }

    merge (query) {
        if (query.type === 'find' || query.type === 'findOne' || query.type === 'aggregate') {
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

    find (collection, params = {}, limit = 1000, sort = null, skip = 0, callback = null) {
        const type = 'find';
        const id = `${collection}.${type}.${JSON.stringify(params)}.${skip}.${limit}.${JSON.stringify(sort)}`;
        const query = { id, collection, params, type, limit, sort, skip };

        this.merge(query);

        if (!!callback) {
            this.once(id, callback);
        }

        return id;
    }

    findOne (collection, params = {}, callback = null) {
        const type = 'findOne';
        const id = `${collection}.${type}.${JSON.stringify(params)}`;
        const query = { id, collection, params, type };

        this.merge(query);

        if (!!callback) {
            this.once(id, callback);
        }

        return id;
    }

    insert (collection, params, options = null, callback = null) {
        const type = 'insert';
        const id = `${collection}.${type}.${JSON.stringify(params)}.${JSON.stringify(options)}`;
        const query = { id, collection, params, options, type };

        if (!!callback) {
            this.once(id, callback);
        }

        this.merge(query);
    }

    remove (collection, selector, options = null, callback = null) {
        const type = 'remove';
        const id = `${collection}.${type}.${JSON.stringify(selector)}.${JSON.stringify(options)}`;
        const query = { id, collection, selector, options, type };

        if (!!callback) {
            this.once(id, callback);
        }

        this.merge(query);
    }

    update (collection, selector, params, options = null, callback = null) {
        const type = 'update';
        const id = `${collection}.${type}.${JSON.stringify(selector)}.${JSON.stringify(params)}.${JSON.stringify(options)}`;
        const query = { id, collection, selector, params, options, type };

        if (!!callback) {
            this.once(id, callback);
        }

        this.merge(query);
    }

    aggregate(collection, params, options = null, callback = null) {
        const type = 'aggregate';
        const id = `${collection}.${type}.${JSON.stringify(params)}.${JSON.stringify(options)}`;
        const query = { id, collection, params, options, type };

        this.merge(query);

        if (!!callback) {
            this.once(id, callback);
        }

        return id;
    }

    request (collection, params = {}, type = 'find', limit = 1000, sort = null, skip = 0, callback = null) {
        const id = `${collection}.${type}.${JSON.stringify(params)}.${skip}.${limit}.${JSON.stringify(sort)}`;
        const query = { id, collection, params, type, limit, sort, skip };

        this.merge(query);

        if (!!callback) {
            this.once(id, callback);
        }

        return id;
    }

    subscribe(collection, callback) {
        this.on(`message-${collection}`, callback);
    }

    unsubscribe(collection) {
        this.off(`message-${collection}`);
    }
}

module.exports = Requester;
