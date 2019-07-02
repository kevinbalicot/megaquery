const MongoClient = require('mongodb').MongoClient;
const MongoObjectID = require("mongodb").ObjectID;

class Requester {
    /**
     * @param {Object} db
     * @param {boolean} [userCache=false]
     */
    constructor(uri, dbname, useCache = false) {
        this.uri = uri;
        this.dbname = dbname;
        this.useCache = useCache;
        this.storedQueries = new Map();
    }

    /**
     * Connect to database
     * @return {Promise}
     */
    connect() {
        return new Promise((resolve, reject) => {
            MongoClient.connect(this.uri, { useNewUrlParser: true }, (err, client) => {
                if (!!err) {
                    return reject(err);
                }

                if (!client.db(this.dbname)) {
                    return reject(`Database ${this.dbname} not found.`);
                }

                return resolve(client);
            });
        });
    }

    /**
     * Play find query
     * @param {MongoClient} client
     * @param {string} collection
     * @param {Object} params
     * @param {number} [limit=100]
     * @param {number} [skip=0]
     * @param {Object} [sort=null]
     *
     * @return {Promise}
     */
    find(client, collection, params, options = {}, skip = 0, limit = 100, sort = null) {
        const id = `${collection}.find.${JSON.stringify(params)}.${JSON.stringify(options)}.${skip}.${limit}.${JSON.stringify(sort)}`;
        const query = { id, type: 'find', cached: false, result: null };

        return new Promise((resolve, reject) => {
            const queryFromCache = this.fromCache(id);

            if (queryFromCache) {
                client.close();
                return resolve(queryFromCache);
            }

            client.db(this.dbname).collection(collection).find(params, options).skip(skip).limit(limit).sort(sort).toArray((error, results) => {
                if (!!error) {
                    return reject(error);
                }

                query.result = results;
                this.cache(id, query);

                client.close();

                return resolve(query);
            });
        });
    }

    /**
     * Play find one query
     * @param {MongoClient} client
     * @param {string} collection
     * @param {Object} params
     *
     * @return {Promise}
     */
    findOne(client, collection, params, options = {}) {
        const id = `${collection}.findOne.${JSON.stringify(params)}.${JSON.stringify(options)}`;
        const query = { id, type: 'findOne', cached: false, result: null };

        return new Promise((resolve, reject) => {
            const queryFromCache = this.fromCache(id);

            if (queryFromCache) {
                client.close();
                return resolve(queryFromCache);
            }

            if (!!params.id || !!params._id ) {
                params._id = new MongoObjectID(params._id || params.id);
                delete params.id;
            }

            client.db(this.dbname).collection(collection).findOne(params, (error, results) => {
                if (!!error) {
                    return reject(error);
                }

                query.result = results;
                this.cache(id, query);

                client.close();

                return resolve(query);
            });
        });
    }

    /**
     * Play insert query
     * @param {MongoClient} client
     * @param {string} collection
     * @param {Object} params
     * @param {Object} [options=null]
     *
     * @return {Promise}
     */
    insert(client, collection, params, options = null) {
        const id = `${collection}.insert.${JSON.stringify(params)}.${JSON.stringify(options)}`;
        const query = { id, type: 'insert', cached: false, result: null };

        return new Promise((resolve, reject) => {
            client.db(this.dbname).collection(collection).insertOne(params, options, (error, response) => {
                if (!!error) {
                    return reject(error);
                }

                query.result = this._parseResponse(response);
                this.clearCache(collection);

                client.close();

                return resolve(query);
            });
        });
    }

    /**
     * Play insert many query
     * @param {MongoClient} client
     * @param {string} collection
     * @param {Object} params
     * @param {Object} [options=null]
     *
     * @return {Promise}
     */
    insertMany(client, collection, docs, options = null) {
        const id = `${collection}.insert.${JSON.stringify(docs)}.${JSON.stringify(options)}`;
        const query = { id, type: 'insertMany', cached: false, result: null };

        return new Promise((resolve, reject) => {
            client.db(this.dbname).collection(collection).insertMany(docs, options, (error, response) => {
                if (!!error) {
                    return reject(error);
                }

                query.result = this._parseResponse(response);
                this.clearCache(collection);

                client.close();

                return resolve(query);
            });
        });
    }

    /**
     * Play remove query
     * @param {MongoClient} client
     * @param {string} collection
     * @param {Object} selector
     * @param {Object} [options=null]
     *
     * @return {Promise}
     */
    remove(client, collection, selector, options = null) {
        const id = `${collection}.remove.${JSON.stringify(selector)}.${JSON.stringify(options)}`;
        const query = { id, type: 'remove', cached: false, result: null };

        return new Promise((resolve, reject) => {
            if (!!selector.id || !!selector._id ) {
                selector._id = new MongoObjectID(selector._id || selector.id);
                delete selector.id;
            }

            client.db(this.dbname).collection(collection).deleteOne(selector, options, (error, response) => {
                if (!!error) {
                    return reject(error);
                }

                query.result = this._parseResponse(response);
                this.clearCache(collection);

                client.close();

                return resolve(query);
            });
        });
    }

    /**
     * Play remove many query
     * @param {MongoClient} client
     * @param {string} collection
     * @param {Object} selector
     * @param {Object} [options=null]
     *
     * @return {Promise}
     */
    removeMany(client, collection, selector, options = null) {
        const id = `${collection}.remove.${JSON.stringify(selector)}.${JSON.stringify(options)}`;
        const query = { id, type: 'removeMany', cached: false, result: null };

        return new Promise((resolve, reject) => {
            if (!!selector.id || !!selector._id ) {
                selector._id = new MongoObjectID(selector._id || selector.id);
                delete selector.id;
            }

            client.db(this.dbname).collection(collection).deleteMany(selector, options, (error, response) => {
                if (!!error) {
                    return reject(error);
                }

                query.result = this._parseResponse(response);
                this.clearCache(collection);

                client.close();

                return resolve(query);
            });
        });
    }

    /**
     * Play update query
     * @param {MongoClient} client
     * @param {string} collection
     * @param {Object} selector
     * @param {Object} params
     * @param {Object} [options=null]
     *
     * @return {Promise}
     */
    update(client, collection, selector, params, options = null) {
        const id = `${collection}.update.${JSON.stringify(selector)}.${JSON.stringify(params)}.${JSON.stringify(options)}`;
        const query = { id, type: 'update', cached: false, result: null };

        return new Promise((resolve, reject) => {
            if (!!selector.id || !!selector._id ) {
                selector._id = new MongoObjectID(selector._id || selector.id);
                delete selector.id;
            }

            client.db(this.dbname).collection(collection).updateOne(selector, params, options, (error, response) => {
                if (!!error) {
                    return reject(error);
                }

                query.result = this._parseResponse(response);
                this.clearCache(collection);

                client.close();

                return resolve(query);
            });
        });
    }

    /**
     * Play update query
     * @param {MongoClient} client
     * @param {string} collection
     * @param {Object} selector
     * @param {Object} params
     * @param {Object} [options=null]
     *
     * @return {Promise}
     */
    updateMany(client, collection, selector, params, options = null) {
        const id = `${collection}.update.${JSON.stringify(selector)}.${JSON.stringify(params)}.${JSON.stringify(options)}`;
        const query = { id, type: 'updateMany', cached: false, result: null };

        return new Promise((resolve, reject) => {
            if (!!selector.id || !!selector._id ) {
                selector._id = new MongoObjectID(selector._id || selector.id);
                delete selector.id;
            }

            client.db(this.dbname).collection(collection).updateMany(selector, params, options, (error, response) => {
                if (!!error) {
                    return reject(error);
                }

                query.result = this._parseResponse(response);
                this.clearCache(collection);

                client.close();

                return resolve(query);
            });
        });
    }

    /**
     * Play aggregate query
     * @param {MongoClient} client
     * @param {string} collection
     * @param {Object} params
     * @param {Object} [options=null]
     *
     * @return {Promise}
     */
    aggregate(client, collection, params, options = null) {
        const id = `${collection}.aggregate.${JSON.stringify(params)}.${JSON.stringify(options)}`;
        const query = { id, type: 'aggregate', cached: false, result: null };

        return new Promise((resolve, reject) => {
            const queryFromCache = this.fromCache(id);

            if (queryFromCache) {
                client.close();
                return resolve(queryFromCache);
            }

            // because mongoclient driver have bug at lib/collection#2582
            if (null === options) {
                client.db(this.dbname).collection(collection).aggregate(params, (error, results) => {
                    if (!!error) {
                        return reject(error);
                    }

                    query.result = results;
                    this.cache(id, query);

                    client.close();

                    return resolve(query);
                });
            } else {
                client.db(this.dbname).collection(collection).aggregate(params, options, (error, results) => {
                    if (!!error) {
                        return reject(error);
                    }

                    query.result = results;
                    this.cache(id, query);

                    client.close();

                    return resolve(query);
                });
            }
        });
    }

    /**
     * Play distinct query
     * @param {MongoClient} client
     * @param {string} collection
     * @param {string} field
     * @param {Object} [params=null]
     * @param {Object} [options=null]
     *
     * @return {Promise}
     */
    distinct(client, collection, field, params = {}, options = null) {
        const id = `${collection}.distinct.${field}.${JSON.stringify(params)}.${JSON.stringify(options)}`;
        const query = { id, type: 'distinct', cached: false, result: null };

        return new Promise((resolve, reject) => {
            const queryFromCache = this.fromCache(id);

            if (queryFromCache) {
                client.close();
                return resolve(queryFromCache);
            }

            client.db(this.dbname).collection(collection).distinct(field, params, options, (error, results) => {
                if (!!error) {
                    return reject(error);
                }

                query.result = results;
                this.cache(id, query);

                client.close();

                return resolve(query);
            });
        });
    }

    /**
     * Play count query
     * @param {MongoClient} client
     * @param {string} collection
     * @param {Object} [params=null]
     * @param {Object} [options=null]
     *
     * @return {Promise}
     */
    count(client, collection, params = {}, options = null) {
        const id = `${collection}.count.${JSON.stringify(params)}.${JSON.stringify(options)}`;
        const query = { id, type: 'count', cached: false, result: null };

        return new Promise((resolve, reject) => {
            const queryFromCache = this.fromCache(id);

            if (queryFromCache) {
                client.close();
                return resolve(queryFromCache);
            }

            client.db(this.dbname).collection(collection).countDocuments(params, options, (error, count) => {
                if (!!error) {
                    return reject(error);
                }

                query.result = count;

                this.cache(id, query);

                client.close();

                return resolve(query);
            });
        });
    }

    /**
     * Run query
     * @param {Object} params
     *
     * @return {Promise}
     */
    query({
        collection,
        params,
        type,
        limit,
        skip,
        sort,
        options,
        selector,
        field
    }) {
        if (type === 'find') {
            return this.connect().then(client => this.find(client, collection, params, options, skip, limit, sort));
        } else if (type === 'findOne') {
            return this.connect().then(client => this.findOne(client, collection, params, options));
        } else if (type === 'insert') {
            return this.connect().then(client => this.insert(client, collection, params, options));
        } else if (type === 'insertMany') {
            return this.connect().then(client => this.insertMany(client, collection, params, options));
        } else if (type === 'remove') {
            return this.connect().then(client => this.remove(client, collection, selector, options));
        } else if (type === 'removeMany') {
            return this.connect().then(client => this.removeMany(client, collection, selector, options));
        } else if (type === 'update') {
            return this.connect().then(client => this.update(client, collection, selector, params, options));
        } else if (type === 'updateMany') {
            return this.connect().then(client => this.updateMany(client, collection, selector, params, options));
        } else if (type === 'aggregate') {
            return this.connect().then(client => this.aggregate(client, collection, params, options));
        } else if (type === 'distinct') {
            return this.connect().then(client => this.distinct(client, collection, field, params, options));
        } else if (type === 'count') {
            return this.connect().then(client => this.count(client, collection, params, options));
        }

        return Promise.reject('Query type is undefined.');
    }

    clearCache(collection = null) {
        if (null === collection) {
            return this.storedQueries.clear();
        }

        Array.from(this.storedQueries.keys()).forEach(id => {
            const idChunk = id.split('.');
            if (idChunk[0] === collection) {
                this.storedQueries.delete(id);
            }
        });
    }

    fromCache(id) {
        return this.storedQueries.get(id);
    }

    cache(id, query) {
        if (this.useCache) {
            query.cached = true;
            this.storedQueries.set(id, query);
        }
    }

    _parseResponse(response) {
        const {
            insertedCount,
            ops,
            insertedId,
            upsertedId,
            deletedCount,
            matchedCount,
            modifiedCount,
            upsertedCount,
            result
        } = response;

        return {
            insertedCount,
            ops,
            insertedId,
            upsertedId,
            deletedCount,
            matchedCount,
            modifiedCount,
            upsertedCount,
            result
        };
    }
}

module.exports = Requester;
