var httpSignature = require('http-signature');
var Promise = require('bluebird');
var NotAuthorizedError = require('restify').errors.NotAuthorizedError;
var keystore = require('./keystore/index.js');
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
  config = config || {};
  var keyLookup;
  if (config.backing_type == 'sqlite3') {
    keyLookup = keystore.sqlite3(config.sqlite3).getInstance();
  } else if (config.backing_type == 'redis') {
    keyLookup = keystore.redis(config.redis).getInstance();
  } else {
    throw new Error("invalid/no backing type specified");
  }

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

  function getAcl(keyId) {
    return keyLookup.getAcl(keyId).then(function (res) {
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

  function authMiddleware (req, res) {
    return new Promise(function (resolve, reject) {
      if (!req.authorization.signature) {
        return reject(notAuthorized());
      }
      if (req.authorization.signature.scheme !== 'Signature') {
        return reject(notAuthorized());
      }

      return validateSignatureAsync(req.authorization.signature)
      .then(function (authorized) {
        if (authorized !== true) {
          return reject(notAuthorized());
        }
        if (! hasRequiredHeaders(req.method, req.authorization.signature.params.headers)) {
          return reject(new NotAuthorizedError('must sign headers ' + requiredHeaders[req.method]));
        }

        //console.log('%j', req.authorization);
        return resolve(req.authorization.signature.params);
      }).caught(function (err) {
        return reject(notAuthorized());
      });
    });
  }

  function aclMiddleware(acls, req, res) {
    return new Promise(function(reject, resolve) {
      var keyId = req.authorization.signature.params.keyId;
      if (!keyId) {
        return reject('no key id');
      }
      return getAcl(keyId)
      .spread(function(found, result) {
        debugger;
        return resolve(result);
      });
    });
  }

  function endpointAuth(endpoint, req, res) {
    return new Promise(function (resolve, reject) {
      if (endpoint.auth !== true) {
        return resolve();
      }
      return authMiddleWare(req, res);
    });
  }

  function endpointAcl(endpoint, req, res) {
    return new Promise(function (resolve, reject) {
      if (typeof endpoint.acl_groups === 'undefined') {
        return resolve();
      }

      return endpointAuth(req, res).bind(endpoint)
      .then(function (result) {
        return authMiddleware(req, res);
      })
      .then(function (res) {
        return aclMiddleware(endpoint.acl_groups, req, res).bind(endpoint);
      });
    });
  }

  return {
    requireAuth: function (req, res, next) {
      return authMiddleware(req, res).nodeify(next);
    },
    endpointAuth: function (req, res, next) {
      var ep = this;
      return endpointAuth(ep, req, res).nodeify(next);
    },
    endpointAcl: function (req, res, next) {
      var ep = this;
      return endpointAcl(ep, req, res).nodeify(next);
    }
  };

};
