var httpSignature = require('http-signature');
var Promise = require('bluebird');
var NotAuthorizedError = require('restify').errors.NotAuthorizedError;
var keystore = require('./keystore/index.js');

//{ scheme: 'Signature',
//  credentials: 'keyId="dd:f6:20:d2:64:1d:49:31:a9:f9:4d:aa:4e:54:f3:a4",algorithm="rsa-sha256",h... (length: 100)',
//  signature: 
//    { scheme: 'Signature',
//      params: 
//        { keyId: 'dd:f6:20:d2:64:1d:49:31:a9:f9:4d:aa:4e:54:f3:a4',
//          algorithm: 'rsa-sha256',
//          headers: [Object],
//          signature: 'hpNKvQat4V9pPoOgFjHnGJD2vURkPfn0i1baNeb3am7cth6gH9Z9vEsGVcXm0IvZ7wiBWkTUeQQtoNA6... (length: 684)' },
//          signingString: 'GET / HTTP/1.1\nhost: 127.0.0.1:3000\ndate: Mon, 26 May 2014 21:15:46 GMT',
//          algorithm: "RSA-SHA256',
//          keyId: 'dd:f6:20:d2:64:1d:49:31:a9:f9:4d:aa:4e:54:f3:a4'} }

/**
 * description
 * @todo todo
 * @param {Object}  config - config options
 * @param {String}  config.backing_type - type of public-key backing store (sqlite3 or redis)
 * @param {String}  config.sqlite3.path - path to sqlite3 db (if type: sqlite3)
 * @param {String}  config.redis.host- redis host (if type: redis)
 * @param {Integer} config.redis.port- redis port (if type: redis)
 * @return {Object} Object.requireAuth - restify middleware function
 */
module.exports = function(config) {
  config = config || {};
  var keyLookup;
  if (config.backing_type == 'sqlite3') {
    keyLookup = keystore.sqlite3(config.sqlite3).getInstance();
  } else if (config.backing_type == 'redis') {
    keyLookup = keystore.redis(config.redis).getInstance();
  } else {
    throw new Error("invalid/no backing type specified");
  }

  function notAuthorized() {
    return new NotAuthorizedError('bad/invalid auth');
  }

  function isAuthorized(params) {
    return keyLookup.getPubKey(params.keyId).then(function (res) {
     return res ? [true, res] : [false, res];
    });
  }

  function validateSignatureAsync(parsedSignature) {
    return isAuthorized(parsedSignature)
    .spread(function (keyFound, key) {
      if (!keyFound) {
        return Promise.reject('key not found');
      }
      return httpSignature.verifySignature( parsedSignature, httpSignature.sshKeyToPEM(key.PublicKey));
    })
    .tap(function (res) {
      //console.log('verifySignature result: ' + res);
    });
  }

  return {
    requireAuth: function (req, res, next) {
      if (! this.auth) {
        return next();
      }
      if (!req.authorization.signature) {
        return next(notAuthorized());
      }
      if (req.authorization.signature.scheme !== 'Signature') {
        return next(notAuthorized());
      }
      validateSignatureAsync(req.authorization.signature)
      .then(function (authorized) {
        if (!authorized) {
          return next(notAuthorized());
        }
        console.log('%j', req.authorization);
        return next();
      });
    }
  };
};
