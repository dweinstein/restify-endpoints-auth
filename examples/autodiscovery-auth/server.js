var restify = require('restify');
var endpoints = require('./endpoints.js');

// Create the RESTful Server
var server = restify.createServer();

server.use(restify.acceptParser(server.acceptable));
server.use(restify.authorizationParser());
server.use(restify.dateParser());
server.use(restify.queryParser());
server.use(restify.jsonp());
server.use(restify.gzipResponse());
server.use(restify.bodyParser());
server.use(restify.conditionalRequest());

// Attach Restify Endpoints to Restify Server
endpoints.manager.attach(server);

// Log all requests here (this includes latency)
server.on('after', function(req, res, route, error) {
  var latency = res.get('Response-Time');
  if (typeof (latency) !== 'number')
    latency = Date.now() - req._time;

  console.log('info', 'REQUEST -', {method: req.method, url: req.url, code: res.statusCode, latency: latency, remote: req.connection.remoteAddress});
  console.log('debug', 'REQUEST HEADERS - ', req.headers);
});
server.listen(3000, function() {
  console.log('server is listening on port 3000...');
});
