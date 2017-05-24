const engine = require('engine.io');
const EventEmitter = require('./../common/event-emitter');
const MongoClient = require('mongodb').MongoClient;
const Query = require ('./query');

// usefull doc https://zestedesavoir.com/tutoriels/312/debuter-avec-mongodb-pour-node-js/
class Requester extends EventEmitter {

    /**
     * @param {string} host
     * @param {string} dbname
     * @param {string} user
     * @param {string} password
     * @param {string} [port='27017']
     */
    constructor(host, dbname, user, password = null, port = '27017') {
        super();

        this.host = host;
        this.user = user;
        this.password = password;
        this.port = port;
        this.dbname = dbname;
        this.options = {};
        this.storedQueries = [];
        this.server = null;
        this.db = null;
    }

    /**
     * Server start to listen on port
     * @param {number|string} port
     * @param {Object} [options={}]
     *
     * @return {Requester}
     */
    listen(port = 8080, options = {}) {
        MongoClient.connect(`mongodb://${this.user}:${this.password}@${this.host}:${this.port}/${this.dbname}`, (error, db) => {
            this.db = db;
        });

        this.server = engine.listen(port);

        this.options = options;
        if (!this.options.auth) {
            this.options.auth = () => Promise.resolve();
        }

        /**
         * On connection with client
         * @param {Object} client
         */
        this.server.on('connection', client => {
            this.trigger('open', client);

            /**
             * On message from client
             * @param {Object} query
             */
            client.on('message', query => {
                query = JSON.parse(query);
                this.options.auth(query)
                    .then(() => {
                        this.trigger('message', query);
                        query.params = query.params || '{}';

                        // If query if type of find, store query into cache else, run it and broadcast
                        if (
                            query.type === 'find' ||
                            query.type === 'findOne' ||
                            query.type === 'aggregate' ||
                            query.type === 'distinct'
                        ) {
                            this.merge(query, client);
                        } else if (
                            query.type === 'update' ||
                            query.type === 'insert' ||
                            query.type === 'save' ||
                            query.type === 'remove'
                        ) {
                            this.run(query, [client.id]).then(() => this.broadcast(query.collection));
                        }
                    })
                    .catch(error => client.send(JSON.stringify({ error: 'auth-error', data: error })));
            });

            client.on('close', () => {
                this.trigger('close', client);
                this.remove(client);
            });
        });

        return this;
    }

    /**
     * Merge query with stored queries
     * @param {Object} query
     * @param {Object} client
     */
    merge(query, client) {
        let storedQuery = this.storedQueries.find(el => el.query.id == query.id);

        // If query is already stored, add client
        if (!!storedQuery) {
            let storedClient = storedQuery.clients.find(c => c == client.id);
            if (!storedClient) {
                storedQuery.clients.push(client.id);
            }

            client.send(JSON.stringify(storedQuery.query));
        } else {
            // Else, add into cache with client and run it
            this.storedQueries.push({ query, clients: [client.id] });
            storedQuery = this.storedQueries.find(el => el.query.id == query.id);
            this.run(storedQuery.query, storedQuery.clients);
        }
    }

    /**
     * Run query and store results. Send result at clients
     * @param {Object} query
     * @param {Array<Object>} [clients=[]]
     *
     * @return {Promise}
     */
    run(query, clients = []) {
        if (!Array.isArray(clients)) {
            clients = [clients];
        }

        let q = Query.unserialize(query);

        return q.run(this.db).then(data => {
            query.result = data;
            clients.forEach(client => this.server.clients[client].send(JSON.stringify(query)));
        });
    }

    /**
     * Get all collection's queries to run them
     * @param {string} collection
     */
    broadcast(collection) {
        let queries = this.storedQueries.filter(el => el.query.collection == collection);

        if (!!queries) {
            queries.forEach(el => this.run(el.query, el.clients));
        }
    }

    /**
     * remove client
     * @param {Object} client
     */
    remove(client) {
        this.storedQueries = this.storedQueries.map(storedQuery => {
            storedQuery.clients = storedQuery.clients.filter(c => c != client.id) || [];

            return storedQuery;
        });
    }
}

module.exports = Requester;
