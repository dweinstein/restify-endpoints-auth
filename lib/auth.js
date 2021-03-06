var httpSignature = require('http-signature');
var Promise = require('bluebird');
var NotAuthorizedError = require('restify').errors.NotAuthorizedError;
var createKeyStore = require('./keystore');
var lodash = require('lodash');

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
 * Returns an restify middle that authorizes based on a few patterns and
 * supporting different key backing stores. Currently sqlite3 and redis
 * are supported backing stores.
 * @param {Object}  config - config options
 * @param {String}  config.backing_type - type of public-key backing store (sqlite3 or redis)
 * @param {String}  config.sqlite3.path - path to sqlite3 db (if type: sqlite3)
 * @param {String}  config.redis.host- redis host (if type: redis)
 * @param {Integer} config.redis.port- redis port (if type: redis)
 * @return {Object} Object.requireAuth - restify middleware function that
 * *requires* auth (overrides endpoint)
 * @return {Object} Object.endpointAuth- restify middleware function that
 * checks whether auth is required @ the endpoint (i.e., skips auth if
 * endpoint.auth != true)
 */
module.exports = function(config) {
  var keyLookup = createKeyStore(config);

  var requiredHeaders = {
    POST:   ['host', 'date', 'request-line', 'content-md5', 'content-length'],
    PUT:    ['host', 'date', 'request-line', 'content-md5', 'content-length'],
    GET:    ['host', 'date', 'request-line'],
    DELETE: ['host', 'date', 'request-line']
  };

  function notAuthorized() {
    return new NotAuthorizedError('bad/invalid auth');
  }

  function isAuthorized(params) {
    return keyLookup.getPubKey(params.keyId).then(function (res) {
     return !lodash.isEmpty(res) ? [true, res] : [false, res];
    });
  }

  function hasRequiredHeaders(method, headers) {
    method = method.toUpperCase();
    return !lodash.isEmpty(requiredHeaders[method]) &&
      lodash.isEmpty(lodash.difference(requiredHeaders[method], headers)
    );
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
  function authMiddleware (req, res, next) {
    if (!req.authorization.signature) {
      return next(notAuthorized());
    }
    if (req.authorization.signature.scheme !== 'Signature') {
      return next(notAuthorized());
    }

    validateSignatureAsync(req.authorization.signature)
    .then(function (authorized) {
      if (authorized !== true) {
        return next(notAuthorized());
      }
      if (! hasRequiredHeaders(req.method, req.authorization.signature.params.headers)) {
        return next(new NotAuthorizedError('must sign headers ' + requiredHeaders[req.method]));
      }

      //console.log('%j', req.authorization);
      return next();
    }, function (err) {
      return next(notAuthorized());
    });
  }
  return {
    requireAuth: authMiddleware,
    endpointAuth: function (req, res, next) {
      var endpoint = this;
      if (endpoint.auth !== true) {
        return next();
      }
      return authMiddleWare(req, res, next);
    }
  };
};
