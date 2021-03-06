var sqlite3 = require('sqlite3').verbose();
var Promise = require('bluebird');

/**
 * Example:
 * session.getPubKey('dd:f6:20:d2:64:1d:49:31:a9:f9:4d:aa:4e:54:f3:a4')
 * .then(function (res) {
 *   console.log(res);
 * })
 * .error(function(err) {
 *   console.log(err);
 * })
 * .finally(function() {
 *   session.close();
 * });
 * */

module.exports = function Sqlite3BackedKeyLookup(config) {
  var instance;
  var db;

  function init() {
    db = config.db || new sqlite3.Database(config.path);
    return {
      close: close,
      getPubKey: getPubKey
    };
  }

  function close(cb) {
    if (db) {
      return db.close(function (err) {
        db = null;
        cb && cb(err);
      });
    }
    if (cb) process.nextTick(cb);
  }
  /**
   * Lookup a key id (fingerprint) in the database
   * @param {String} keyId - RSA fingerprint ('de:ad:be:ef:...')
   * @return {Object} return.ID
   * @return {Object} return.PublicKey
   */
  function getPubKey(keyId) {
    return new Promise(function (resolve, reject) {
      function cb(err, row) {
        if (err) {
          return reject(err);
        }
        row = row || {};
        return resolve(row);
      }
      db.get('SELECT ID, PublicKey FROM Keys WHERE ID = $id', {$id: keyId}, cb);
    });
  }

  return {
    getInstance: function () {
      if (!instance) {
        instance = init();
      }
      return instance;
    }
  };

};
