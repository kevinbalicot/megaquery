
/**
 * Queue handle middlewares
 * @module compose
 */

 /**
  * @param {Object} query
  * @param {Array<Object>} middlewares
  *
  * @return {*}
  *
  * @alias module:compose
  */
module.exports = (query, middlewares) => {
    let next = () => {};
    let i = middlewares.length;

    while (i--) {
        next = middlewares[i].callback.bind(middlewares[i], query, next);
    }

    return next;
};
