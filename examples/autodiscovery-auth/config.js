module.exports = {
  auth: {
    backing_type: 'sqlite3',
    sqlite3: {
      path: __dirname + '/keys.db'
    }
  }
};
