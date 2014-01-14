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
  timeout:     pkg.name + '.timeout'
}, function(err, config) {
  if (err) {
    return process.exit(0);
  }

  // defaults
  config.concurrency = config.concurrency || 1;
  config.streams     = config.streams     || 1;
  config.timeout     = config.timeout     || 10000;
  config.limit       = config.limit       || 100;

  couchmagick.info('using config ' + JSON.stringify(config).replace(/"password":".*?"/, '"password":"***"'));


  // TODO: validate config


  var couch = url.format({
    protocol: 'http',
    hostname: config.address,
    port:     config.port,
    auth:     config.auth && config.auth.username && config.auth.password ? [ config.auth.username, config.auth.password ].join(':') : null
  });

  var options = {
    limit:       config.limit,
    feed:        'continuous',
    timeout:     config.timeout,
    concurrency: config.concurrency
  };


  function listen(db, next) {
    couchmagick.info('Listening on ' + db);

    var stream = magick(url.resolve(couch, db), options);

    stream.on('error', couchmagick.error);
    stream.on('data', function(data) {
      couchmagick.info(data.response);
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
