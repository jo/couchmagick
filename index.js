#!/usr/bin/env node
/* Couchmagick: Run ImageMagicks `convert` on CouchDB documents.
 *
 * (c) 2014 Johannes J. Schmidt, null2 GmbH, Berlin 
 */

var pkg = require('./package.json');
var couchmagickstream = require('./lib/couchmagick-stream');

var daemon = require('couch-daemon');


daemon({
  name: pkg.name,
  version: pkg.version,
  include_docs: true
}, function(url, options) {
  var magick = couchmagickstream(url, options);

  return function(source) {
    return source.pipe(magick);
  };
});

