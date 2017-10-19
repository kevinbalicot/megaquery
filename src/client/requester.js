const EventEmitter = require('events');
const url = require('url');

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
        this.dbname = null;
    }

    /**
     * Connect to server
     * @param {string} uri
     * @param {Object} [options={}]
     *
     * @return {*}
     *
     * @alias module:Requester
     */
    connect(uri, options = {}) {
        if (!!this.connected) {
            return this;
        }

        uri = url.parse(uri);
        this.dbname = uri.pathname.replace('/', '') || options.dbname || null;

        clearInterval(this.connecting);
        this.listenNewConnection(uri.href);
        this.connection = new WebSocket(uri.href);

        this.connection.onopen = () => {
            this.connected = true;
            this.emit('open');
            this.synchronize();

            if (!!this.connecting) {
                clearInterval(this.connecting);
                this.connecting = false;
            }

            this.connection.onmessage = result => {
                let query = JSON.parse(result.data);

                this.refresh(query);
                this.emit('message', query);
                this.emit(query.id, query);

                if (
                    query.type === 'find' ||
                    query.type === 'findOne' ||
                    query.type === 'aggregate' ||
                    query.type === 'distinct' ||
                    query.type === 'count'
                ) {
                    this.emit(`message-${query.collection}`, query);
                    this.emit(`${query.collection}.${query.type}.${query.params}`, query);
                }
            };

            // Lost connection with server, try to reconnect
            this.connection.onclose = () => {
                this.connected = false;
                this.emit('close');
                this.listenNewConnection(uri);
            };
        };
    }

    /**
     * Try to reconnecte
     * @param {string} uri
     * @param port
     */
    listenNewConnection(uri) {
        this.connecting = setInterval(() => {
            this.connect(uri);
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
     * Synchronize all query when connection opened
     */
    synchronize() {
        this.queries.forEach(query => this.merge(query));
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
            query.type === 'distinct' ||
            query.type === 'count'
        ) {
            let storedQuery = this.queries.find(el => el.id === query.id);

            if (!storedQuery) {
                this.queries.push(query);
            }
        }

        if (!this.connected) {
            return;
        }

        const data = {};

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
        data.dbname = this.dbname;

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
    find(collection, params = {}, limit = 1000, sort = null, skip = 0, callback = null) {
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
    findOne(collection, params = {}, callback = null) {
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
    insert(collection, params, options = null, callback = null) {
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
    remove(collection, selector, options = null, callback = null) {
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
    update(collection, selector, params, options = null, callback = null) {
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
     * Create count query
     * @param {string} collection - Mongo collection
     * @param {Object} params - Mongo query params
     * @param {Object} [options=null]
     * @param {Callable} [callback=null]
     *
     * @return {string} return query id
     */
    count(collection, params, options = null, callback = null) {
        const type = 'count';
        const id = `${collection}.${type}.${JSON.stringify(params)}.${JSON.stringify(options)}`;
        const query = { id, collection, params, options, type };

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
    request(collection, params = {}, type = 'find', limit = 1000, sort = null, skip = 0, callback = null) {
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
        this.removeListener(`message-${collection}`);
    }
}

module.exports = Requester;
