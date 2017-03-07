'use strict';

const MongoObjectID = require("mongodb").ObjectID;

class Query {

    constructor (id, collection, params, type, limit = 1000, skip = 0, sort = null, options = null, selector = null) {
        this.id = id;
        this.collection = collection;
        this.params = params;
        this.type = type;
        this.limit = limit;
        this.skip = skip;
        this.options = options;
        this.sort = sort;
        this.selector = selector;
    }

    find (db) {
        return new Promise((resolve, reject) => {
            db.collection(this.collection).find(this.params).skip(this.skip).limit(this.limit).sort(this.sort).toArray((error, results) => {
                if (!!error) {
                    return reject(error);
                }

                return resolve(results);
            });
        });
    }

    findOne (db) {
        return new Promise((resolve, reject) => {
            let params;
            if (!!this.params.id || !!this.params._id ) {
                params = { _id: new MongoObjectID(this.params._id || this.params.id) };
            } else {
                params = this.params;
            }

            db.collection(this.collection).findOne(params, (error, results) => {
                if (!!error) {
                    return reject(error);
                }

                return resolve(results);
            });
        });
    }

    insert (db) {
        return new Promise((resolve, reject) => {
            db.collection(this.collection).insert(this.params, this.options, (error, results) => {
                if (!!error) {
                    return reject(error);
                }

                return resolve(results);
            });
        });
    }

    remove (db) {
        return new Promise((resolve, reject) => {
            let params = { _id: new MongoObjectID(this.params.id) };
            db.collection(this.collection).remove(params, this.options, (error, results) => {
                if (!!error) {
                    return reject(error);
                }

                return resolve(results);
            });
        });
    }

    update (db) {
        return new Promise((resolve, reject) => {
            let selector;
            if (!!this.selector.id || !!this.selector._id ) {
                selector = { _id: new MongoObjectID(this.selector._id || this.selector.id) };
            } else {
                selector = this.selector;
            }

            db.collection(this.collection).update(selector, this.params, this.options, (error, results) => {
                if (!!error) {
                    return reject(error);
                }

                return resolve(results);
            });
        });
    }

    run (db) {
        if (this.type === 'find') {
            return this.find(db);
        } else if (this.type === 'findOne') {
            return this.findOne(db);
        } else if (this.type === 'insert') {
            return this.insert(db);
        } else if (this.type === 'remove') {
            return this.remove(db);
        } else if (this.type === 'update') {
            return this.update(db).catch(e => console.log(e));
        }
    }

    static unserialize (data) {
        return new Query(
            data.id || null,
            data.collection,
            JSON.parse(data.params),
            data.type,
            data.limit,
            data.skip,
            !!data.sort ? JSON.parse(data.sort) : null,
            !! data.options ? JSON.parse(data.options) : null,
            !! data.selector ? JSON.parse(data.selector) : null
        );
    }
}

module.exports = Query;
