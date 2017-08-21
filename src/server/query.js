const MongoObjectID = require("mongodb").ObjectID;

class Query {

    /**
     * @param {string} id
     * @param {string} dbname
     * @param {string} collection
     * @param {Object} params
     * @param {string} type
     * @param {number} [limit=100]
     * @param {number} [skip=0]
     * @param {Object} [options=null]
     * @param {Object} [selector=null]
     * @param {string} [field=null]
     */
    constructor(id, dbname, collection, params, type, limit = 1000, skip = 0, sort = null, options = null, selector = null, field = null) {
        this.id = id;
        this.dbname = dbname;
        this.collection = collection;
        this.params = params;
        this.type = type;
        this.limit = limit;
        this.skip = skip;
        this.options = options;
        this.sort = sort;
        this.selector = selector;
        this.field = field;
    }

    /**
     * Play find query
     * @param {Object} db
     *
     * @return {Promise}
     */
    find(db) {
        return new Promise((resolve, reject) => {
            db.collection(this.collection).find(this.params).skip(this.skip).limit(this.limit).sort(this.sort).toArray((error, results) => {
                if (!!error) {
                    return reject(error);
                }

                return resolve(results);
            });
        });
    }

    /**
     * Play find one query
     * @param {Object} db
     *
     * @return {Promise}
     */
    findOne(db) {
        return new Promise((resolve, reject) => {
            let params = this.params;
            if (!!this.params.id || !!this.params._id ) {
                params = { _id: new MongoObjectID(this.params._id || this.params.id) };
            }

            db.collection(this.collection).findOne(params, (error, results) => {
                if (!!error) {
                    return reject(error);
                }

                return resolve(results);
            });
        });
    }

    /**
     * Play insert query
     * @param {Object} db
     *
     * @return {Promise}
     */
    insert(db) {
        return new Promise((resolve, reject) => {
            db.collection(this.collection).insert(this.params, this.options, (error, results) => {
                if (!!error) {
                    return reject(error);
                }

                return resolve(results);
            });
        });
    }

    /**
     * Play remove query
     * @param {Object} db
     *
     * @return {Promise}
     */
    remove(db) {
        return new Promise((resolve, reject) => {
            const params = { _id: new MongoObjectID(this.selector._id || this.selector.id) };

            db.collection(this.collection).remove(params, this.options, (error, response) => {
                if (!!error) {
                    return reject(error);
                }

                return resolve(response.result);
            });
        });
    }

    /**
     * Play update query
     * @param {Object} db
     *
     * @return {Promise}
     */
    update(db) {
        return new Promise((resolve, reject) => {
            let selector = this.selector;
            if (!!this.selector._id || !!this.selector.id) {
                selector = { _id: new MongoObjectID(this.selector._id || this.selector.id) };
            }

            db.collection(this.collection).update(selector, this.params, this.options, (error, response) => {
                if (!!error) {
                    return reject(error);
                }

                return resolve(response.result);
            });
        });
    }

    /**
     * Play aggregate query
     * @param {Object} db
     *
     * @return {Promise}
     */
    aggregate(db) {
        return new Promise((resolve, reject) => {
            // because mongodb driver have bug at lib/collection#2582
            if (null === this.options) {
                db.collection(this.collection).aggregate(this.params, (error, results) => {
                    if (!!error) {
                        return reject(error);
                    }

                    return resolve(results);
                });
            } else {
                db.collection(this.collection).aggregate(this.params, this.options, (error, results) => {
                    if (!!error) {
                        return reject(error);
                    }

                    return resolve(results);
                });
            }
        });
    }

    /**
     * Play distinct query
     * @param {Object} db
     *
     * @return {Promise}
     */
    distinct(db) {
        return new Promise((resolve, reject) => {
            db.collection(this.collection).distinct(this.field, this.params, this.options, (error, results) => {
                if (!!error) {
                    return reject(error);
                }

                return resolve(results);
            });
        });
    }

    /**
     * Run query
     * @param {Object} db
     *
     * @return {Promise}
     */
    run(db) {
        if (!db) {
            return Promise.reject(new Error('No database found.'));
        }

        if (this.type === 'find') {
            return this.find(db).catch(e => console.log(e));
        } else if (this.type === 'findOne') {
            return this.findOne(db).catch(e => console.log(e));
        } else if (this.type === 'insert') {
            return this.insert(db).catch(e => console.log(e));
        } else if (this.type === 'remove') {
            return this.remove(db).catch(e => console.log(e));
        } else if (this.type === 'update') {
            return this.update(db).catch(e => console.log(e));
        } else if (this.type === 'aggregate') {
            return this.aggregate(db).catch(e => console.log(e));
        } else if (this.type === 'distinct') {
            return this.distinct(db).catch(e => console.log(e));
        }
    }

    /**
     * Unserialize query
     * @param {Object} data
     *
     * @return {Query}
     */
    static unserialize(data) {
        return new Query(
            data.id || null,
            data.dbname || null,
            data.collection,
            JSON.parse(data.params),
            data.type,
            data.limit,
            data.skip,
            !!data.sort ? JSON.parse(data.sort) : null,
            !!data.options ? JSON.parse(data.options) : null,
            !!data.selector ? JSON.parse(data.selector) : null,
            data.field
        );
    }
}

module.exports = Query;
