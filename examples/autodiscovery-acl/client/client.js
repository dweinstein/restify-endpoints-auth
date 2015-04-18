var fs = require('fs');
var restify = require('restify');
var httpSignature = require('http-signature');

// Define the Restify JSON Client
// You could easily use an http request client as well.
var client = restify.createJsonClient({
  url: 'http://127.0.0.1:3000',
  signRequest: function (req) {

    // The default headers for http signature is date
    var headers = ['request-line','host','date'];
    if (req.method == 'POST') {
      headers = headers.concat([
        'content-type',
        'content-md5',
        'content-length'
      ]);
    }
    var fingerprint = httpSignature.sshKeyFingerprint(
      fs.readFileSync(__dirname + '/key.pub', 'ascii')
    );
    // Sign the request with http-signature library
    httpSignature.sign(req, {
      key: fs.readFileSync(__dirname + '/key', 'ascii'),
      keyId: fingerprint,
      headers: headers
    });
  }
});

// Perform a GET request against the API server defined in server.js
client.get('/example', function(err, req, res, obj) {
  console.log(obj);

  client.close();
});

// Perform a GET request against the API server defined in server.js
client.get('/example/10', function(err, req, res, obj) {
  console.log(obj);

  client.close();
});
