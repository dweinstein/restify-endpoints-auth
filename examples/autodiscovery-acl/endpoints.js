var EndpointManager = require('restify-endpoints').EndpointManager;

// Instantiate the Restify Endpoint Manager
var manager = new EndpointManager({
  endpointpath: __dirname + '/endpoints'
});

module.exports.manager = manager;
