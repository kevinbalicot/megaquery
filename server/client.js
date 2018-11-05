const EventEmitter = require('events');
const WebSocket = require('ws');
const uuid = require('uuid');

class SocketClient extends EventEmitter {
    constructor(uri, options = {}) {
        super();

        this.messages = [];
        this.connecting = true;
        this.connected = false;
        this.subscribers = {};

        this.connect(uri, options);
    }

    /**
     * Connect to server
     * @param {string} uri
     * @param {Object} [options={}]
     *
     * @return {Client}
     */
    connect(uri, options = {}) {
        if (!!this.connected) {
            return this;
        }

        this.listenNewConnection(uri);

        this.client = new WebSocket(uri, options);
        this.client.on('open', () => {
            this.connected = true;
            this.synchronizeMessages();

            if (!!this.connecting) {
                clearInterval(this.connecting);
                this.connecting = false;
            }

            this.emit('open');

            this.client.on('message', message => {
                for (let subribeId in this.subscribers) {
                    this.subscribers[subribeId](JSON.parse(message));
                }

                this.emit('message', JSON.parse(message));
            });

            // Lost connection with server, try to reconnect
            this.client.on('close', () => {
                this.connected = false;
                this.emit('close');
                this.listenNewConnection(uri);
            });
        });
    }

    /**
     * Try to reconnecte
     * @param {string} uri
     */
    listenNewConnection(uri) {
        clearInterval(this.connecting);
        this.connecting = setInterval(() => {
            this.connect(uri);
        }, 10000);
    }

    /**
     * @param {string} name
     * @param {Object} [data={}]
     *
     * @return {string}
     */
    query(name, data = {}) {
        const queryId = `${name}-${JSON.stringify(data)}`;
        const message = { queryId, name, data };

        if (this.connected) {
            this.client.send(JSON.stringify(message));
        } else {
            this.storeMessage(message);
        }

        return queryId;
    }

    storeMessage(message) {
        let storedMessage = this.messages.find(m => m.data.id === message.data.id);

        if (!storedMessage) {
            this.messages.push(message);
        }
    }

    /**
     * Synchronize all message when connection opened
     */
    synchronizeMessages() {
        this.messages.forEach(message => this.client.send(JSON.stringify(message)));
    }

    /**
     * Subscribe on client
     * @param {string} id
     * @param {Callable} callback
     */
    subscribe(id, callback) {
        this.subscribers[id] = callback;
    }

    /**
     * Unsubscribe on client
     * @param {string} id
     */
    unsubscribe(id) {
        delete this.subscribers[id];
    }
}

class Repository {
    /**
     * @param {Client} client
     */
    constructor(client) {
        this.id = uuid.v4();
        this.client = client;
        this.subscribers = [];

        this.client.subscribe(this.id, query => {
            const subscriber = this.subscribers.find(s => (s.queryId && s.queryId === query.id) || (s.listen && s.listen === query.name));

            if (!!subscriber) {
                subscriber.callback(query);

                if (subscriber.once) {
                    this.unsubscribe(subscriber.id);
                }
            }
        });
    }

    /**
     * @param {string} name
     * @param {Object} [data={}]
     * @param {Callable} [callback=null]
     *
     * @return {string}
     */
    query(name, data = {}, callback = null) {
        const id = this.client.query(name, data);

        if (null !== callback) {
            const subscribe = {
                id: uuid.v4(),
                queryId: id,
                name,
                once: true,
                callback
            };

            this.subscribers.push(subscribe);

            return subscribe.id;
        }

        return null;
    }

    /**
     * Subscribe on query
     * @param {string} name
     * @param {Object} [data={}]
     * @param {Callable} [callback=null]
     */
    subscribe(name, data = {}, callback = null) {
        const id = this.client.query(name, data);

        if (null !== callback) {
            const subscribe = {
                id: uuid.v4(),
                queryId: id,
                name,
                once: false,
                callback
            };

            this.subscribers.push(subscribe);

            return subscribe.id;
        }

        return null;
    }

    /**
     * Listen query
     * @param {string} name
     * @param {function} callback
     */
    listen(name, callback) {
        const subscribe = {
            id: uuid.v4(),
            listen: name,
            name,
            once: false,
            callback
        };

        this.subscribers.push(subscribe);

        return subscribe.id;
    }

    /**
     * Unsubscribe on query
     * @param {string} queryId
     */
    unsubscribe(queryId) {
        const index = this.subscribers.findIndex(s => s.id === queryId);

        if (index > -1) {
            this.subscribers.splice(index, 1);
        }
    }

    /**
     * @param {string} name
     */
    unsubscribeAll(name) {
        const subscribers = this.subscribers.filter(s => s.name === name);
        subscribers.forEach(s => this.unsubscribe(s.id));
    }

    /**
     * Clear all listener
     */
    clear() {
        this.client.unsubscribe(this.id);
        this.subscribers = [];
    }
}

module.exports = { SocketClient, Repository };
