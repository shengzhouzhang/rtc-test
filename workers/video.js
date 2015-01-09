(function() {
  var conn, dbName, indexName, loadVideo, queryChunks, queryKeys, storeName, storeVideo, version;

  dbName = 'WebCamDB';

  storeName = 'chunks';

  indexName = 'startIndex';

  version = 2;

  conn = new Promise(function(resolve, reject) {
    var request;
    request = indexedDB.open(dbName, version);
    request.onupgradeneeded = function(e) {
      var db, store;
      db = e.target.result;
      console.log('create store', storeName);
      store = db.createObjectStore(storeName);
      return store.createIndex(indexName, 'start', {
        unique: true
      });
    };
    request.onsuccess = function(e) {
      return resolve(e.target.result);
    };
    request.onerror = function(e) {
      return reject();
    };
    request.onblocked = function(e) {
      console.log('db block', e);
      return reject();
    };
  });

  storeVideo = function(start, end, blob) {
    return conn.then(function(db) {
      db.onerror = function (e) {
        console.log('db error', e);
      }
      db.onabort = function (e) {
        console.log('db abort', e);
      }
      var request, store, transaction;
      transaction = db.transaction([storeName], 'readwrite');
      store = transaction.objectStore(storeName);
      request = store.add({
        start: start,
        end: end,
        blob: blob
      }, start);
      request.onsuccess = function(e) {
        return console.log('store chunk success', e.target.result);
      };
    }).catch(function (err) {
      console.log('unexpect error', err.stack || err);
    })
  };

  queryChunks = function(start, end) {
    return conn.then(function(db) {
      var query;
      query = IDBKeyRange.bound(start, end);
      return db.transaction([storeName], 'readonly').objectStore(storeName).index(indexName).openCursor(query).onsuccess = function(e) {
        var cursor;
        cursor = e.target.result;
        if (cursor) {
          console.log(cursor);
          return cursor["continue"]();
        }
      };
    });
  };

  queryKeys = function(start, end) {
    return conn.then(function(db) {
      var count, query;
      query = IDBKeyRange.bound(start, end);
      count = 0;
      return db.transaction([storeName], 'readonly').objectStore(storeName).index(indexName).openKeyCursor(query).onsuccess = function(e) {
        var cursor;
        cursor = e.target.result;
        if (cursor) {
          console.log(cursor.key, ++count);
          return cursor["continue"]();
        }
      };
    });
  };

  queryKeys(0, Date.now());

  loadVideo = function(uri, cb) {
    var xhr;
    xhr = new XMLHttpRequest();
    xhr.responseType = 'blob';
    xhr.open('GET', uri, true);
    xhr.onload = function(e) {
      var blob;
      if (this.status === 200) {
        blob = new Blob([this.response], {
          type: 'video/webm'
        });
        URL.revokeObjectURL(uri);
        return cb(blob);
      }
    };
    return xhr.send();
  };

  self.addEventListener('message', function(event) {
    var data;
    data = event.data;
    if (data.chunk) {
      return loadVideo(data.chunk, function(blob) {
        return storeVideo(data.start, data.end, blob);
      });
    }
  });

}).call(this);
