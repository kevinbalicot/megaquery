'use strict';

class EventEmitter {

    constructor () {
        this.listeners = [];
    }

    /**
     * Add event listener
     * @param event
     * @param callback
     * @param context
     */
    on (event, callback, context) {

        if (!this.listeners[event]) {
            this.listeners[event] = [];
        }

        this.listeners[event].push({
            once: false,
            callback: callback,
            context: context
        });

        return this;
    }

    /**
     * Add event listener will call one time
     * @param event
     * @param callback
     * @param context
     */
    once (event, callback, context) {

        if (!this.listeners[event]) {
            this.listeners[event] = [];
        }

        this.listeners[event].push({
            once: true,
            callback: callback,
            context: context
        });

        return this;
    }

    /**
     * Delete event listeners
     * @param event
     */
    off (event) {
        if (!!this.listeners[event]) {
            delete this.listeners[event];
        }

        return this;
    }

    /**
     * Call every listener for event
     * @param event
     * @param data
     */
    trigger (event, data = {}) {
        if (!!this.listeners[event]) {
            let i = 0;
            this.listeners[event].forEach(listener => {
                listener.callback.call(listener.context || this, data);

                if (listener.once) {
                    this.listeners[event].splice(i, 1);
                }

                i++;
            });
        }

        return this;
    }
}

module.exports = EventEmitter;
