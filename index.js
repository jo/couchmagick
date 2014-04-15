#!/usr/bin/env node
/* couchmagick
 * (c) 2013 Johannes J. Schmidt, null2 GmbH, Berlin 
 */

var pkg = require('./package.json');

var url = require('url');
var async = require('async');
var nano = require('nano');
var magick = require('couchmagick-listen');
var daemon = require('couch-daemon');

var couchmagick = daemon(process.stdin, process.stdout, function() {
  process.exit(0);
});

couchmagick.get({
  // Connection
  address: 'httpd.bind_address',
  port: 'httpd.port',
  auth: {
    username: pkg.name + '.username',
    password: pkg.name + '.password'
  },

  // Batching
  concurrency: pkg.name + '.concurrency',
  streams:     pkg.name + '.streams',
  limit:       pkg.name + '.limit',

  changes_feed_timeout:    pkg.name + '.changes_feed_timeout',
  convert_process_timeout: pkg.name + '.convert_process_timeout'
}, function(err, config) {
  if (err) {
    return process.exit(0);
  }

  // defaults
  config.concurrency = config.concurrency && parseInt(config.concurrency, 10) || 1;
  config.streams = config.streams && parseInt(config.streams, 10) || 1;
  config.limit = config.limit && parseInt(config.limit, 100) || 0;
  config.changes_feed_timeout = config.changes_feed_timeout && parseInt(config.changes_feed_timeout, 10) || 10000;
  config.convert_process_timeout = config.convert_process_timeout && parseInt(config.convert_process_timeout, 10) || 60000;

  couchmagick.info('using config ' + JSON.stringify(config).replace(/"password":".*?"/, '"password":"***"'));


  // TODO: validate config


  var couch = url.format({
    protocol: 'http',
    hostname: config.address,
    port: config.port,
    auth: config.auth && config.auth.username && config.auth.password ? [ config.auth.username, config.auth.password ].join(':') : null
  });

  var options = {
    limit: config.limit,
    feed: 'continuous',
    changes_feed_timeout: config.changes_feed_timeout,
    convert_process_timeout: config.convert_process_timeout,
    concurrency: config.concurrency
  };


  function listen(db, next) {
    couchmagick.info('Listening on ' + db);

    var stream = magick(url.resolve(couch, db), options);

    stream.on('error', couchmagick.error);
    stream.on('data', function(data) {
      if (data.response) {
        couchmagick.info(data.response);
      }
    });
    stream.on('end', next);
  }


  // main loop ;)
  function run(err) {
    if (err) {
      process.exit(0);
    }


    // get list of all databases
    // TODO: listen to db changes
    nano(couch).db.list(function(err, dbs) {
      if (err) {
        couchmagick.error('Can not get _all_dbs: ' + err.description);

        return process.exit(0);
      }

      async.eachLimit(dbs, config.streams, listen, run);
    });
  }
  run();
});
