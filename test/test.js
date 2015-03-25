var test = require('tape');
var fs = require('fs');
var util = require('util');
var sqlite3 = require('sqlite3').verbose();
var createKeyStore = require('../lib/keystore');

var createQuery = [
  'PRAGMA foreign_keys=OFF;',
  'BEGIN TRANSACTION;',
  'CREATE TABLE Keys (ID String, PublicKey String, PRIMARY KEY (ID));',
  'INSERT INTO Keys VALUES(\'%s\',\'%s\');',
  'COMMIT;'
].join('\n');

test('sqlite3 keystore', function (t) {
  var keyId = 'dd:f6:20:d2:64:1d:49:31:a9:f9:4d:aa:4e:54:f3:a4';
  var pubKey = fs.readFileSync(__dirname + '/key.pub').toString();
  var db = new sqlite3.Database(':memory:');
  var sql = util.format(createQuery, keyId, pubKey);

  db.exec(sql, function (err) {
    t.ok(!err)
    var opts = {
      backing_type: 'sqlite3',
      sqlite3: {
        db: db
      }
    };
    var store = createKeyStore(opts);
    store.getPubKey(keyId).then(function (res) {
      t.equal(res.ID, keyId, 'id is correct');
      t.equal(res.PublicKey, pubKey, 'public key is correct');
    }).error(function (err) {
      t.fail();
    }).finally(function () {
      store.close(function (err) {
        t.ok(!err);
        t.end();
      });
    });
  });
});
