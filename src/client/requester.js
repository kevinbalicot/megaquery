const engine = require('engine.io-client');
const EventEmitter = require('./../common/event-emitter');

/**
 * Requester module
 * @module Requester
 */
class Requester extends EventEmitter {
    constructor() {
        super();

        this.connection = null;
        this.connecting = true;
        this.connected = false;
        this.queries = [];
        this.options = {};
    }

    /**
     * Connect to server
     * @param {string} uri
     * @param {Object} [options={}]
     * @param {Object}
     *
     * @return {*}
     *
     * @alias module:Requester
     */
    connect(uri, port = 8080, options = {}) {
        if (!!this.connected) {
            return this;
        }

        this.options = options;
        if (!this.options.auth) {
            this.options.auth = () => {};
        }

        clearInterval(this.connecting);
        this.listenNewConnection(uri, port);

        this.connection = new engine.Socket(`${uri}:${port}`);
        this.connection.on('open', () => {
            this.connected = true;
            this.trigger('open');

            if (!!this.connecting) {
                clearInterval(this.connecting);
                this.connecting = false;
            }

            /**
             * Receive message from server
             * @param {Object} query
             */
            this.connection.on('message', query => {
                query = JSON.parse(query);

                if (!!query.error) {
                    this.trigger(query.error, query.data);
                    return;
                }

                this.refresh(query);
                this.trigger('message', query);
                this.trigger(query.id, query);

                if (
                    query.type === 'find' ||
                    query.type === 'findOne' ||
                    query.type === 'aggregate' ||
                    query.type === 'distinct'
                ) {
                    this.trigger(`message-${query.collection}`, query);
                    this.trigger(`${query.collection}.${query.type}.${query.params}`, query);
                }
            });

            // Lost connection with server, try to reconnect
            this.connection.on('close', () => {
                this.connected = false;
                this.trigger('close');
                this.listenNewConnection(uri, port);
            });
        });
    }

    /**
     * Try to reconnecte
     * @param {string} uri
     * @param port
     */
    listenNewConnection(uri, port) {
        this.connecting = setInterval(() => {
            this.connect(uri, port);
        }, 10000);
    }

    /**
     * Refresh stored query
     * @param {Object} query
     */
    refresh(query) {
        let storedQuery = this.queries.find(el => el.id === query.id);

        if (!!storedQuery) {
            storedQuery.result = query.result || [];
        }
    }

    /**
     * Get query by id
     * @param {string} id
     *
     * @return {Object}
     */
    get(id) {
        return this.queries.find(el => el.id === id);
    }

    /**
     * Merge query into stored queries and send to server
     * @param {Object} query
     */
    merge(query) {
        if (
            query.type === 'find' ||
            query.type === 'findOne' ||
            query.type === 'aggregate' ||
            query.type === 'distinct'
        ) {
            let storedQuery = this.queries.find(el => el.id === query.id);

            if (!storedQuery) {
                this.queries.push(query);
            }
        }

        const data = {};
        this.options.auth(data);

        data.id = query.id;
        data.collection = query.collection;
        data.field = query.field;
        data.type = query.type;
        data.limit = query.limit;
        data.skip = query.skip;
        data.params = JSON.stringify(query.params);
        data.selector = JSON.stringify(query.selector);
        data.sort = JSON.stringify(query.sort);
        data.options = JSON.stringify(query.options);

        this.connection.send(JSON.stringify(data));
    }

    /**
     * Create find query
     * @param {string} collection - Mongo collection
     * @param {Object} [params={}] - Mongo query params
     * @param {number} [limit=100]
     * @param {Object} [sort=null]
     * @param {number} [skip=0]
     * @param {Callable} [callback=null]
     *
     * @return {string} return query id
     */
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

    /**
     * Create find one query
     * @param {string} collection - Mongo collection
     * @param {Object} [params={}] - Mongo query params
     * @param {Callable} [callback=null]
     *
     * @return {string} return query id
     */
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

    /**
     * Create insert query
     * @param {string} collection - Mongo collection
     * @param {Object} params - Mongo query params
     * @param {Object} [options=null]
     * @param {Callable} [callback=null]
     *
     * @return {string} return query id
     */
    insert (collection, params, options = null, callback = null) {
        const type = 'insert';
        const id = `${collection}.${type}.${JSON.stringify(params)}.${JSON.stringify(options)}`;
        const query = { id, collection, params, options, type };

        if (!!callback) {
            this.once(id, callback);
        }

        this.merge(query);
    }

    /**
     * Create remove query
     * @param {string} collection - Mongo collection
     * @param {Object} selector - Mongo query selector
     * @param {Object} [options=null]
     * @param {Callable} [callback=null]
     *
     * @return {string} return query id
     */
    remove (collection, selector, options = null, callback = null) {
        const type = 'remove';
        const id = `${collection}.${type}.${JSON.stringify(selector)}.${JSON.stringify(options)}`;
        const query = { id, collection, selector, options, type };

        if (!!callback) {
            this.once(id, callback);
        }

        this.merge(query);
    }

    /**
     * Create update query
     * @param {string} collection - Mongo collection
     * @param {Object} selector - Mongo query selector
     * @param {Object} params - Mongo query params
     * @param {Object} [options=null]
     * @param {Callable} [callback=null]
     *
     * @return {string} return query id
     */
    update (collection, selector, params, options = null, callback = null) {
        const type = 'update';
        const id = `${collection}.${type}.${JSON.stringify(selector)}.${JSON.stringify(params)}.${JSON.stringify(options)}`;
        const query = { id, collection, selector, params, options, type };

        if (!!callback) {
            this.once(id, callback);
        }

        this.merge(query);
    }

    /**
     * Create aggregate query
     * @param {string} collection - Mongo collection
     * @param {Object} params - Mongo query params
     * @param {Object} [options=null]
     * @param {Callable} [callback=null]
     *
     * @return {string} return query id
     */
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

    /**
     * Create distinct query
     * @param {string} collection - Mongo collection
     * @param {string} field - Mongo query field
     * @param {Object} params - Mongo query params
     * @param {Object} [options=null]
     * @param {Callable} [callback=null]
     *
     * @return {string} return query id
     */
    distinct(collection, field, params, options = null, callback = null) {
        const type = 'distinct';
        const id = `${collection}.${type}.${field}.${JSON.stringify(params)}.${JSON.stringify(options)}`;
        const query = { id, collection, field, params, options, type };

        this.merge(query);

        if (!!callback) {
            this.once(id, callback);
        }

        return id;
    }

    /**
     * Create custom request query
     * @param {string} collection - Mongo collection
     * @param {Object} [params={}] - Mongo query params
     * @param {string} [type='find'] - Query type
     * @param {number} [limit=100]
     * @param {Object} [sort=null]
     * @param {number} [skip=0]
     * @param {Callable} [callback=null]
     *
     * @return {string} return query id
     */
    request (collection, params = {}, type = 'find', limit = 1000, sort = null, skip = 0, callback = null) {
        const id = `${collection}.${type}.${JSON.stringify(params)}.${skip}.${limit}.${JSON.stringify(sort)}`;
        const query = { id, collection, params, type, limit, sort, skip };

        this.merge(query);

        if (!!callback) {
            this.once(id, callback);
        }

        return id;
    }

    /**
     * Subscribe callable on collection event
     * @param {string} collection
     * @param {Callable} callback
     */
    subscribe(collection, callback) {
        this.on(`message-${collection}`, callback);
    }

    /**
     * Unsubscribe callable from collection event
     * @param {string} collection
     * @param {Callable} callback
     */
    unsubscribe(collection) {
        this.off(`message-${collection}`);
    }
}

module.exports = Requester;
