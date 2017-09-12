const EventEmitter = require('events');
const WebSocket = require('ws');
const uuid = require('node-uuid');
const MongoClient = require('mongodb').MongoClient;

const Query = require ('./query');

// usefull doc https://zestedesavoir.com/tutoriels/312/debuter-avec-mongodb-pour-node-js/
class Requester extends EventEmitter {

    /**
     * @param {Object|Array} options
     */
    constructor(options) {
        super();

        let dbs = options;
        if (!Array.isArray(options)) {
            dbs = [options];
        }

        this.storedQueries = [];
        this.server = null;
        this.dbs = [];

        dbs.forEach(({ host, dbname, user, password, port }) => {
            console.log(`Connecting on ${user}@${host}:${port || '27017'}/${dbname}...`);
            MongoClient.connect(`mongodb://${user}:${password || null}@${host}:${port || '27017'}/${dbname}`, (error, db) => {
                if (!!error) {
                    throw new Error(error);
                }

                console.log(`Connected on ${user}@${host}:${port || '27017'}/${dbname}!`);
                this.dbs.push(db);
            });
        });
    }

    /**
     * Server start to listen on port
     * @param {number|string} port
     * @param {Object} [options={}]
     *
     * @return {Requester}
     */
    listen(port = 8080, options = {}) {
        if (!!options.server) {
            this.server = new WebSocket.Server({ server: options.server, verifyClient: options.auth });
        } else {
            this.server = new WebSocket.Server({ port, verifyClient: options.auth });
        }

        this.server.storedClients = {};

        /**
         * On connection with client
         * @param {Object} client
         */
        this.server.on('connection', (client, req) => {
            client.id = uuid.v4();
            this.server.storedClients[client.id] = client;

            this.emit('connection', client);

            /**
             * On message from client
             * @param {Object} query
             */
            client.on('message', query => {
                query = JSON.parse(query);
                this.emit('message', query);
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
                    this.run(query, [client.id]).then(() => this.broadcast(query.collection, query.dbname));
                }
            });

            client.on('close', () => {
                this.emit('close', client);
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

            storedQuery.query.cached = true;
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
        let db = this.getDb(q.dbname);

        return q.run(db).then(data => {
            query.result = data;
            clients.forEach(client => this.server.storedClients[client].send(JSON.stringify(query)));
        }).catch(error => {
            query.error = error.message;
            clients.forEach(client => this.server.storedClients[client].send(JSON.stringify(query)));
        });
    }

    /**
     * Get all collection's queries to run them
     * @param {string} collection
     * @param {string} dbname
     */
    broadcast(collection, dbname) {
        let queries = this.storedQueries.filter(el => el.query.collection === collection && el.query.dbname === dbname);

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

        delete this.server.storedClients[client.id];
    }

    /**
     * Get database connection
     * @param {string} dbname
     *
     * @return {*}
     */
    getDb(dbname = null) {
        if (null === dbname) {
            return this.dbs[0];
        }

        return this.dbs.find(db => db.databaseName === dbname);
    }
}

module.exports = Requester;
