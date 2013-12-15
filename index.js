#!/usr/bin/env node
/* couchmagick
 * (c) 2013 Johannes J. Schmidt, null2 GmbH, Berlin 
 */

var pkg = require('./package.json');

var url = require('url');
var es = require('event-stream');
var async = require('async');
var nano = require('nano');
var magick = require('couchmagick-listen');
var daemon = require('couch-daemon');

var couchmagick = daemon(process.stdin, process.stdout, function() {
  process.exit(0);
});

var noop = function() {};

couchmagick.get({
  address: 'httpd.bind_address',
  port: 'httpd.port',
  // auth: {
  //   username: pkg.name + '.username',
  //   password: pkg.name + '.password'
  // }
}, function(config) {

  console.log(config);

  var auth = config.auth && config.auth.username && config.auth.password ?
    [config.auth.username, config.auth.password].join(':') :
    null;

  var couch = url.format({
    protocol: 'http',
    hostname: config.address,
    port: config.port,
    auth: auth
  });

  var options = {
    limit: 100,
    feed: 'continuous',
    timeout: 1000
  };

  function listen(db, next) {
    couchmagick.info('Listening on ' + db);

    var stream = magick(url.resolve(couch, db), options);

    // stream.pipe(couchmagick.info());
    // stream.on('error', couchmagick.error().write);

    stream.on('end', next);
  }

  console.log('start list dbs');
  nano(couch).db.list(function(err, dbs) {
    async.eachSeries(dbs, listen, function() {
      couchmagick.info('done.');
      process.exit(0);
    });
  });

  // TODO: listen to db changes
});
