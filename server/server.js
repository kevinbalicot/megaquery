const WebSocketServer = require("ws").Server;
const uuid = require('uuid');
const MongoClient = require('mongodb').MongoClient;
const Validator = require('pxl-json-validator');

const Requester = require('./requester');
const Token = require('./token');

const auth = (info, next) => {
    info.req.verifyParameters = {};
    const token = info.req.url.match(/token=([A-Za-z0-9-_=.]+)/);

    if (!!token) {
        try {
            info.req.verifyParameters.token = new Token(token[1]);
        } catch (error) {
            next(false, 403, error.message);
        }
    }

    next(true);
};

class SocketServer extends WebSocketServer {
    /**
     * @param {object} options
     */
    constructor(options, callback) {
        const { host, dbname, user, password, port, server, verifyClient, useCache } = options;
        const uri = `mongodb://${user}:${!!password ? password : ''}@${host}:${!!port ? port : 27017}/${dbname}`;

        if (!options.verifyClient) {
            options.verifyClient = auth;
        }

        delete options.host;
        delete options.dbname;
        delete options.user;
        delete options.password;
        delete options.port;

        super(options, callback);

        this.storedQueries = [];

        MongoClient.connect(uri, (err, client) => {
            if (!!err) {
                throw new Error(err);
            }

            this.requester = new Requester(client.db(dbname), useCache);

            this.emit('dbconnected', this.requester);
        });

        this.on('connection', (client, req) => {
            client.id = uuid.v4();

            if (!!req.verifyParameters) {
                for (let param in req.verifyParameters) {
                    client[param] = req.verifyParameters[param];
                }
            }

            client.on('message', message => {
                const event = this.createEvent(message, client);
                const { name, data } = event;

                // If there are a validator, check schema and scopes
                if (this.validators[name]) {
                    if (
                        this.validators[name].scopes.length > 0 &&
                        client.token && client.token instanceof Token &&
                        // client.token.isExpired()
                        this.validators[name].scopes.every(scope => !client.token.isGranted(scope))
                    ) {
                        return this.abort(event, 'Not authorized.');
                    }

                    try {
                        event.data = this.schemaValidator.validate(data, name);
                    } catch (e) {
                        return this.abort(event, e.message);
                    }
                }

                this.emit(name, event, this);
            });

            client.on('close', () => {
                this.removeClient(client);
            });
        });

        this.schemaValidator = new Validator();
        this.validators = {};
    }

    /**
     * Create event
     * @param {string} message
     * @param {Object} client
     *
     * @return {Object}
     */
     createEvent(message, client) {
         const { queryId, name, data } = JSON.parse(message);

         return { queryId, name, data, client };
     }

    /**
     * Prepare query
     * @param {object} queryHeader
     * @param {object} [event=null]
     *
     * @return {Promise}
     */
    query(queryHeader, event = null) {
        if (null === event) {
            return this.requester.query(queryHeader);
        }

        queryHeader.id = event.queryId;

        return this.executeQueryForClient(queryHeader, event.client);
    }

    /**
     * Execute query for client
     * @param {object} queryHeader
     * @param {Client} client
     *
     * @return {Promise}
     */
    executeQueryForClient(queryHeader, client) {
        if (
            queryHeader.type === 'find' ||
            queryHeader.type === 'findOne' ||
            queryHeader.type === 'aggregate' ||
            queryHeader.type === 'distinct' ||
            queryHeader.type === 'count'
        ) {
            this.storeQueryForClient(queryHeader, client);
        }

        return this.requester.query(queryHeader)
            .then(query => {
                query.id = queryHeader.id;
                this.sendQueryToClient(query, client);

                if (
                    !queryHeader.noSynchronize &&
                    (queryHeader.type === 'update' ||
                    queryHeader.type === 'insert' ||
                    queryHeader.type === 'save' ||
                    queryHeader.type === 'remove')
                ) {
                    this.synchronizeQuery(queryHeader);
                }

                return query;
            });
    }

    /**
     * Store query into cache for client
     * @param {object} queryHeader
     * @param {Client} client
     */
    storeQueryForClient(queryHeader, client) {
        let storedQuery = this.storedQueries.find(el => el.query.id == queryHeader.id);

        // If query is already stored, add client
        if (!!storedQuery) {
            let storedClient = storedQuery.clients.find(c => c == client.id);
            if (!storedClient) {
                storedQuery.clients.push(client.id);
            }
        } else {
            // Else, add into cache with client
            this.storedQueries.push({ query: queryHeader, clients: [client.id] });
        }
    }

    /**
     * Abort query
     * @param {object} event
     * @param {string} raison
     *
     * @return {Promise}
     */
    abort(event, raison) {
        this.sendQueryToClient({
            id: event.queryId,
            name: event.name,
            error: raison
        }, event.client);
    }

    /**
     * Synchronize query with other clients
     * @param {Object} queryHeader
     */
    synchronizeQuery(queryHeader) {
        this.storedQueries.filter(storedQuery => storedQuery.query.collection === queryHeader.collection)
            .forEach(storedQuery => {
                storedQuery.clients.forEach(clientId => {
                    this.executeQueryForClient(storedQuery.query, this.getClient(clientId));
                });
            });
    }

    /**
     * @param {string} id
     *
     * @return {Client}
     */
    getClient(id) {
        return Array.from(this.clients).find(c => c.id === id);
    }

    /**
     * @param {Client} client
     */
    removeClient(client) {
        this.storedQueries = this.storedQueries.map(storedQuery => {
            storedQuery.clients = storedQuery.clients.filter(c => c != client.id) || [];

            return storedQuery;
        });
    }

    /**
     * Format json to string
     * @param {string} data
     *
     * @return {string}
     */
    jsonToString(data) {
        return JSON.stringify(data).trim();
    }

    /**
     * Send query to client
     * @param {Object} query
     * @param {Client} client
     */
    sendQueryToClient(query, client) {
        client.send(this.jsonToString(query));
    }

    /**
     * Broadcast query
     * @param {Object} query
     */
    broadcastQuery(query) {
        this.clients.forEach(client => {
            if(client.readyState === client.OPEN) {
                client.send(this.jsonToString(query));
            }
        });
    }

    /**
     * Add validator for event
     * @param {string} name
     * @param {Object} [schema={}]
     * @param {Array} [scopes=[]]
     */
    addValidator(name, schema = {}, scopes = []) {
        this.schemaValidator.addSchema(name, schema);
        this.validators[name] = { scopes };
    }
}

module.exports = SocketServer;
