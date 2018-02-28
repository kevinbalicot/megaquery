
/**
 * Queue handle middlewares
 * @module compose
 */

 /**
  * @param {Object} data
  * @param {Array<Object>} middlewares
  *
  * @return {*}
  *
  * @alias module:compose
  */
module.exports = (data, middlewares, next = () => {}) => {
    let i = middlewares.length;

    while (i--) {
        next = middlewares[i].callback.bind(middlewares[i], data, next);
    }

    return next;
};
