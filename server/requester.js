const MongoObjectID = require("mongodb").ObjectID;

class Requester {
    /**
     * @param {Object} db
     * @param {boolean} [userCache=false]
     */
    constructor(db, useCache = false) {
        this.db = db;
        this.useCache = useCache;
        this.storedQueries = [];
    }

    /**
     * Play find query
     * @param {string} collection
     * @param {Object} params
     * @param {number} [limit=100]
     * @param {number} [skip=0]
     * @param {Object} [sort=null]
     *
     * @return {Promise}
     */
    find(collection, params, options = {}, skip = 0, limit = 100, sort = null) {
        const id = `${collection}.find.${JSON.stringify(params)}.${JSON.stringify(options)}.${skip}.${limit}.${JSON.stringify(sort)}`;
        const query = { id, type: 'find', cached: false, result: null };

        return new Promise((resolve, reject) => {
            const queryFromCache = this.fromCache(id);

            if (queryFromCache) {
                return resolve(queryFromCache);
            }

            this.db.collection(collection).find(params, options).skip(skip).limit(limit).sort(sort).toArray((error, results) => {
                if (!!error) {
                    return reject(error);
                }

                query.result = results;
                this.cache(query);

                return resolve(query);
            });
        });
    }

    /**
     * Play find one query
     * @param {string} collection
     * @param {Object} params
     *
     * @return {Promise}
     */
    findOne(collection, params, options = {}) {
        const id = `${collection}.findOne.${JSON.stringify(params)}.${JSON.stringify(options)}`;
        const query = { id, type: 'findOne', cached: false, result: null };

        return new Promise((resolve, reject) => {
            const queryFromCache = this.fromCache(id);

            if (queryFromCache) {
                return resolve(queryFromCache);
            }

            if (!!params.id || !!params._id ) {
                params._id = new MongoObjectID(params._id || params.id);
                delete params.id;
            }

            this.db.collection(collection).findOne(params, (error, results) => {
                if (!!error) {
                    return reject(error);
                }

                query.result = results;
                this.cache(query);

                return resolve(query);
            });
        });
    }

    /**
     * Play insert query
     * @param {string} collection
     * @param {Object} params
     * @param {Object} [options=null]
     *
     * @return {Promise}
     */
    insert(collection, params, options = null) {
        const id = `${collection}.insert.${JSON.stringify(params)}.${JSON.stringify(options)}`;
        const query = { id, type: 'insert', cached: false, result: null };

        return new Promise((resolve, reject) => {
            this.db.collection(collection).insertOne(params, options, (error, results) => {
                if (!!error) {
                    return reject(error);
                }

                query.result = results;
                this.clearCache(collection);

                return resolve(query);
            });
        });
    }

    /**
     * Play insert many query
     * @param {string} collection
     * @param {Object} params
     * @param {Object} [options=null]
     *
     * @return {Promise}
     */
    insertMany(collection, docs, options = null) {
        const id = `${collection}.insert.${JSON.stringify(docs)}.${JSON.stringify(options)}`;
        const query = { id, type: 'insertMany', cached: false, result: null };

        return new Promise((resolve, reject) => {
            this.db.collection(collection).insertMany(docs, options, (error, results) => {
                if (!!error) {
                    return reject(error);
                }

                query.result = results;
                this.clearCache(collection);

                return resolve(query);
            });
        });
    }

    /**
     * Play remove query
     * @param {string} collection
     * @param {Object} selector
     * @param {Object} [options=null]
     *
     * @return {Promise}
     */
    remove(collection, selector, options = null) {
        const id = `${collection}.remove.${JSON.stringify(selector)}.${JSON.stringify(options)}`;
        const query = { id, type: 'remove', cached: false, result: null };

        return new Promise((resolve, reject) => {
            if (!!selector.id || !!selector._id ) {
                selector._id = new MongoObjectID(selector._id || selector.id);
                delete selector.id;
            }

            this.db.collection(collection).deleteOne(selector, options, (error, response) => {
                if (!!error) {
                    return reject(error);
                }

                query.result = response;
                this.clearCache(collection);

                return resolve(query);
            });
        });
    }

    /**
     * Play remove many query
     * @param {string} collection
     * @param {Object} selector
     * @param {Object} [options=null]
     *
     * @return {Promise}
     */
    removeMany(collection, selector, options = null) {
        const id = `${collection}.remove.${JSON.stringify(selector)}.${JSON.stringify(options)}`;
        const query = { id, type: 'removeMany', cached: false, result: null };

        return new Promise((resolve, reject) => {
            if (!!selector.id || !!selector._id ) {
                selector._id = new MongoObjectID(selector._id || selector.id);
                delete selector.id;
            }

            this.db.collection(collection).deleteMany(selector, options, (error, response) => {
                if (!!error) {
                    return reject(error);
                }

                query.result = response;
                this.clearCache(collection);

                return resolve(query);
            });
        });
    }

    /**
     * Play update query
     * @param {string} collection
     * @param {Object} selector
     * @param {Object} params
     * @param {Object} [options=null]
     *
     * @return {Promise}
     */
    update(collection, selector, params, options = null) {
        const id = `${collection}.update.${JSON.stringify(selector)}.${JSON.stringify(params)}.${JSON.stringify(options)}`;
        const query = { id, type: 'update', cached: false, result: null };

        return new Promise((resolve, reject) => {
            if (!!selector.id || !!selector._id ) {
                selector._id = new MongoObjectID(selector._id || selector.id);
                delete selector.id;
            }

            this.db.collection(collection).updateOne(selector, params, options, (error, response) => {
                if (!!error) {
                    return reject(error);
                }

                query.result = response;
                this.clearCache(collection);

                return resolve(query);
            });
        });
    }

    /**
     * Play update query
     * @param {string} collection
     * @param {Object} selector
     * @param {Object} params
     * @param {Object} [options=null]
     *
     * @return {Promise}
     */
    updateMany(collection, selector, params, options = null) {
        const id = `${collection}.update.${JSON.stringify(selector)}.${JSON.stringify(params)}.${JSON.stringify(options)}`;
        const query = { id, type: 'updateMany', cached: false, result: null };

        return new Promise((resolve, reject) => {
            if (!!selector.id || !!selector._id ) {
                selector._id = new MongoObjectID(selector._id || selector.id);
                delete selector.id;
            }

            this.db.collection(collection).updateMany(selector, params, options, (error, response) => {
                if (!!error) {
                    return reject(error);
                }

                query.result = response;
                this.clearCache(collection);

                return resolve(query);
            });
        });
    }

    /**
     * Play aggregate query
     * @param {string} collection
     * @param {Object} params
     * @param {Object} [options=null]
     *
     * @return {Promise}
     */
    aggregate(collection, params, options = null) {
        const id = `${collection}.aggregate.${JSON.stringify(params)}.${JSON.stringify(options)}`;
        const query = { id, type: 'aggregate', cached: false, result: null };

        return new Promise((resolve, reject) => {
            const queryFromCache = this.fromCache(id);

            if (queryFromCache) {
                return resolve(queryFromCache);
            }

            // because mongodb driver have bug at lib/collection#2582
            if (null === options) {
                this.db.collection(collection).aggregate(params, (error, results) => {
                    if (!!error) {
                        return reject(error);
                    }

                    query.result = results;
                    this.cache(query);

                    return resolve(query);
                });
            } else {
                this.db.collection(collection).aggregate(params, options, (error, results) => {
                    if (!!error) {
                        return reject(error);
                    }

                    query.result = results;
                    this.cache(query);

                    return resolve(query);
                });
            }
        });
    }

    /**
     * Play distinct query
     * @param {string} collection
     * @param {string} field
     * @param {Object} [params=null]
     * @param {Object} [options=null]
     *
     * @return {Promise}
     */
    distinct(collection, field, params = {}, options = null) {
        const id = `${collection}.distinct.${field}.${JSON.stringify(params)}.${JSON.stringify(options)}`;
        const query = { id, type: 'distinct', cached: false, result: null };

        return new Promise((resolve, reject) => {
            const queryFromCache = this.fromCache(id);

            if (queryFromCache) {
                return resolve(queryFromCache);
            }

            this.db.collection(collection).distinct(field, params, options, (error, results) => {
                if (!!error) {
                    return reject(error);
                }

                query.result = results;
                this.cache(query);

                return resolve(query);
            });
        });
    }

    /**
     * Play count query
     * @param {string} collection
     * @param {Object} [params=null]
     * @param {Object} [options=null]
     *
     * @return {Promise}
     */
    count(collection, params = {}, options = null) {
        const id = `${collection}.count.${JSON.stringify(params)}.${JSON.stringify(options)}`;
        const query = { id, type: 'count', cached: false, result: null };

        return new Promise((resolve, reject) => {
            const queryFromCache = this.fromCache(id);

            if (queryFromCache) {
                return resolve(queryFromCache);
            }

            this.db.collection(collection).countDocuments(params, options, (error, count) => {
                if (!!error) {
                    return reject(error);
                }

                query.result = count;
                this.cache(query);

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
            return this.find(collection, params, options, skip, limit, sort);
        } else if (type === 'findOne') {
            return this.findOne(collection, params, options);
        } else if (type === 'insert') {
            return this.insert(collection, params, options);
        } else if (type === 'insertMany') {
            return this.insertMany(collection, params, options);
        } else if (type === 'remove') {
            return this.remove(collection, selector, options);
        } else if (type === 'removeMany') {
            return this.removeMany(collection, selector, options);
        } else if (type === 'update') {
            return this.update(collection, selector, params, options);
        } else if (type === 'updateMany') {
            return this.updateMany(collection, selector, params, options);
        } else if (type === 'aggregate') {
            return this.aggregate(collection, params, options);
        } else if (type === 'distinct') {
            return this.distinct(collection, field, params, options);
        } else if (type === 'count') {
            return this.count(collection, params, options);
        }

        return Promise.reject('Query type is undefined.');
    }

    clearCache(collection = null) {
        if (null === collection) {
            return this.storedQueries = [];
        }

        this.storedQueries = this.storedQueries.filter(q => q.collection !== collection);
    }

    fromCache(id) {
        return this.storedQueries.find(q => q.id === id);
    }

    cache(query) {
        if (this.useCache) {
            query.cached = true;
            this.storedQueries.push(query);
        }
    }
}

module.exports = Requester;
