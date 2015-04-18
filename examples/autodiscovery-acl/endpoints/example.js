var config = require('../config').auth;
var auth = require('../../../lib/auth.js')(config).endpointAcl;

var data = {
  '1': {'data': 'cool', 'example': 'four'},
  '2': {'data': 'something', 'another': 'example'}
};

module.exports = {
  name: 'Example',
  description: 'Example Endpoints',
  endpoints: [
    {
      name: 'Example',
      description: 'Default Example Endpoint',
      method: 'GET',
      auth: true,
      middleware: auth,
      path: '/example',
      version: '1.0.0',
      fn: function (req, res, next) {
        res.send({"status": "ok", "message": "Example Default Endpoint"});
        return next();
      }
    },
    {
      name: 'getExample',
      description: 'Get Example Data Endpoint',
      method: 'GET',
      auth: true,
      middleware: auth,
      acl_groups: ['admin'],
      path: '/example/:id',
      version: '1.0.0',
      fn: function (req, res, next) {
        debugger;
        res.send(data[req.params.id]);
        return next();
      }
    }
  ]
}
