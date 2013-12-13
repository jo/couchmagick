/* couchmagick
 * (c) 2013 Johannes J. Schmidt, null2 GmbH, Berlin 
 */

'use strict';

var pkg = require('./package.json');
var couchdbWorker = require('couchdb-worker');
var url = require('url');

// logging
function info(msg) {
  process.stdout.write(JSON.stringify(["log", msg]) + '\n');
}
function error(msg) {
  process.stdout.write(JSON.stringify(["log", msg, {"level": "error"}]) + '\n');
}
function debug(msg) {
  process.stdout.write(JSON.stringify(["log", msg, {"level": "debug"}]) + '\n');
}

// configuration
// [httpd]
//   {"bind_address": "127.0.0.1", "port": "5984"}
// [couchmagick]
//   {"dbs": "myfotos"}
var config = {};
function parseConfig(data) {
  debug('parsing config: ' + data);

  try {
    data = JSON.parse(data);
  } catch(e) {
    error('Error parsing config: ' + e);
  }

  // [httpd]
  if (data.port) {
    config.port = data.port;
  }
  if (data.bind_address) {
    config.bind_address = data.bind_address;
  }
  
  // [couchmagick]
  if (data.dbs) {
    config.dbs = data.dbs.split(/,\s+/);
  }
  if (data.user) {
    config.user = data.user;
  }
  if (data.password) {
    config.password = data.password;
  }
  if (data.filter) {
    config.filter = data.filter;
  }

  return config;
}

// process function
function convert(doc, db, next) {
  info('processing doc ' + doc._id + '...');
  next(null);
}

// run workers
function run(config) {
  if (!config.bind_address) {
    return;
  }
  if (!config.dbs) {
    return;
  }

  info('using config: ' + JSON.stringify(config));

  var server = url.format({
    protocol: 'http',
    hostname: config.bind_address,
    port: config.port
  });
  debug('using server: ' + server);

  var auth;
  if (config.user && config.password) {
    auth = {
      user: config.user,
      password: config.password
    };
  }

  var followOptions = {};
  if (config.filter) {
    followOptions.filter = config.filter;
  }

  config.dbs.forEach(function(db) {
    debug('starting worker for ' + db);

    var options = {
      id: pkg.name,
      db: {
        url: url.resolve(server, db),
        auth: auth
      },
      follow: followOptions,
      process: convert
    };

    debug('using worker options: ' + JSON.stringify(options));

    try {
      var worker = couchdbWorker(options);

      worker.on('error', function(err) {
        error('Serious error: ' + err);
      });

      worker.on('worker:complete', function(doc) {
        debug('Completed: ' + doc._id);
      });

      worker.on('worker:error', function(err, doc) {
        info('Error processing ' + doc._id  + ' :' + err);
      });

      worker.start();
    } catch(e) {
      error('Error starting worker: ' + e);
    }
  });
}


module.exports = function() {
  process.stdin.on('data', function(data) {
    if (typeof data !== 'string') {
      data = data.toString();
    }

    data.replace(/\s+$/, '').split(/\n+/).forEach(parseConfig);

    run(config);
  });

  process.stdin.on('end', function () {
    process.exit(0);
  });

  // restart on config change
  process.stdout.write(JSON.stringify(["register", "httpd"]) + '\n');
  process.stdout.write(JSON.stringify(["register", pkg.name]) + '\n');

  // get config
  process.stdout.write(JSON.stringify(["get", "httpd"]) + '\n');
  process.stdout.write(JSON.stringify(["get", pkg.name]) + '\n');
};
