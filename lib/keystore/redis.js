var Promise = require('bluebird');
var lodash = require('lodash');
var redis = require('redis');

/**
 * RedisBackedKeyLookup
 * @todo todo
 * @param {Object} config - config object
 * @param {Object} config.prefix- redis key prefix (defaults to 'ssh:')
 * @param {Object} config.host - redis hostname/ip
 * @param {Object} config.port - redis port
 * @param {Object} config.seed - seed SSH public keys { 'dd:f6:20:...' : 'ssh-rsa ...', ... }
 * @return {Object}
 */
var RedisBackedKeyLookup = (function(config) {
  var instance;
  var db;
  var prefix = config.prefix || 'ssh:';

  function idToKey(keyId) {
    return prefix+keyId;
  }

  function init() {
    db = Promise.promisifyAll(redis.createClient(config.port, config.host));
    db.on("error", function (err) {
      console.log("Error " + err);
      throw new Error('lost redis keystore');
    });
    if (config.seed) {
      lodash.forEach(config.seed, function (val, key) {
        db.setAsync(key, val);
      });
    }
    return {
      close: close,
      getPubKey: getPubKey,
      setPubKey: setPubKey
    };
  }

  function close() {
    if (db) {
      db.quit();
      db = null;
    }
  }
  /**
   * Lookup a key id (fingerprint) in the database
   * @param {String} keyId - RSA fingerprint ('de:ad:be:ef:...')
   * @return {Object} return.ID
   * @return {Object} return.PublicKey
   */
  function getPubKey(keyId) {
    return db.getAsync(idToKey(keyId))
    .then(function (res) {
      return {
        ID: keyId,
        PublicKey: res
      };
    });
  }

  function setPubKey(keyId, pubKey) {
    return db.setAsync(idToKey(keyId), pubKey);
  }

  return {
    getInstance: function () {
      if (!instance) {
        instance = init();
      }
      return instance;
    }
  };

});

module.exports = RedisBackedKeyLookup;
