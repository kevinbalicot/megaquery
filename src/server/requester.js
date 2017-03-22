'use strict';

const engine = require('engine.io');
const EventEmitter = require('./../common/event-emitter');
const MongoClient = require('mongodb').MongoClient;
const Query = require ('./query');

// https://zestedesavoir.com/tutoriels/312/debuter-avec-mongodb-pour-node-js/

class Requester extends EventEmitter {

    constructor (host, dbname, user, password = null, port = '27017') {
        super();

        this.host = host;
        this.user = user;
        this.password = password;
        this.port = port;
        this.dbname = dbname;
        this.storedQueries = [];
        this.server = null;
        this.db = null;
    }

    listen (port = 8080) {
        MongoClient.connect(`mongodb://${this.user}:${this.password}@${this.host}:${this.port}/${this.dbname}`, (error, db) => {
            this.db = db;
        });

        // Listen on port
        this.server = engine.listen(port);
        this.server.on('connection', client => {
            this.trigger('open', client);

            client.on('message', query => {
                this.trigger('message', query);
                query = JSON.parse(query);
                query.params = query.params || '{}';

                console.log('==== receive message ==============================');
                console.log(query);

                // If query if type of find, store query into cache else, run it and broadcast
                if (query.type === 'find' || query.type === 'findOne' || query.type === 'aggregate') {
                    this.merge(query, client);
                } else if (query.type === 'update' || query.type === 'insert' || query.type === 'save' || query.type === 'remove') {
                    this.run(query, [client.id]).then(() => this.broadcast(query.collection));
                }
            });

            client.on('close', () => {
                this.trigger('close', client);
                this.remove(client);
            });
        });

        return this;
    }

    merge (query, client) {
        let storedQuery = this.storedQueries.find(el => el.query.id == query.id);

        // If query is already stored, add client
        if (!!storedQuery) {
            console.log('==== query cached ====');
            console.log(storedQuery);

            let storedClient = storedQuery.clients.find(c => c == client.id);
            if (!storedClient) {
                storedQuery.clients.push(client.id);
            }
            client.send(JSON.stringify(storedQuery.query));
        } else {
            console.log('==== no query cached ====');
            // Else, add into cache with client and run it
            this.storedQueries.push({ query, clients: [client.id] });
            storedQuery = this.storedQueries.find(el => el.query.id == query.id);
            this.run(storedQuery.query, storedQuery.clients);
        }

        console.log('==== actual cache ====');
        this.storedQueries.forEach(el => console.log(el));
    }

    /**
     * Run query and store results
     * Send result at clients
     */
    run (query, clients = []) {

        if (!Array.isArray(clients)) {
            clients = [clients];
        }

        let q = Query.unserialize(query);

        console.log('==== run ====');
        console.log(query);

        return q.run(this.db).then(data => {
            query.result = data;
            console.log('==== result ====');
            console.log(data);

            console.log('==== updated cache ====');
            this.storedQueries.forEach(el => console.log(el));

            clients.forEach(client => this.server.clients[client].send(JSON.stringify(query)));
        });
    }

    broadcast (collection) {
        let queries = this.storedQueries.filter(el => el.query.collection == collection);

        if (!!queries) {
            queries.forEach(el => this.run(el.query, el.clients));
        }
    }

    /**
     * remove client
     */
    remove (client) {
        this.storedQueries = this.storedQueries.map(storedQuery => {
            storedQuery.clients = storedQuery.clients.filter(c => c != client.id) || []
            return storedQuery;
        });
    }
}

module.exports = Requester;
