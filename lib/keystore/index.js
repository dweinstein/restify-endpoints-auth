var sqlite3 = require('./sqlite3.js');
var redis = require('./redis.js');

module.exports = function (config) {
  config = config || {};
  if (config.backing_type == 'sqlite3') {
    return sqlite3(config.sqlite3).getInstance();
  } else if (config.backing_type == 'redis') {
    return redis(config.redis).getInstance();
  } else {
    throw new Error('invalid/no backing type specified');
  }
}
