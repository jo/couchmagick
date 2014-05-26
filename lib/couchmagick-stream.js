/* Couchmagick: Run ImageMagicks `convert` on CouchDB documents.
 *
 * (c) 2014 Johannes J. Schmidt, null2 GmbH, Berlin 
 */

var path = require('path');
var spawn = require('child_process').spawn;
var _ = require('highland');
var async = require('async');
var nano = require('nano');
var strformat = require('strformat');
var docuri = require('docuri');


// TODO: emit all documents, also filtered one, to enable checkpointing
module.exports = function couchmagick(url, options) {
  options = options || {};
  options.concurrency = options.concurrency || 1;
  options.timeout = options.timeout || 60 * 1000; // 1 minute


  var couch = nano(url);
  var configs = {};


  // convert attachment
  // TODO: process
  // * configs
  // * attachments
  // * versions
  // in one go. Don't do the through split pipeline stuff.
  function convertAttachment(data, callback) {
    var db = couch.use(data.db_name);

    // get target doc
    db.get(data.target.id, function(err, doc) {
      data.target.doc = doc || { _id: data.target.id };
      data.target.doc.couchmagick = data.target.doc.couchmagick || {};
      data.target.doc.couchmagick[data.target.id] = data.target.doc.couchmagick[data.target.id] || {};

      
      // do not process attachments twice, respect revpos
      if (data.target.doc.couchmagick[data.target.id][data.target.name] && data.target.doc.couchmagick[data.target.id][data.target.name].revpos === data.source.revpos) {
        return callback(null, data);
      }


      // insert couchmagick stamp
      data.target.doc.couchmagick[data.target.id][data.target.name] = {
        id: data.source.id,
        name: data.source.name,
        revpos: data.source.revpos
      };


      // query params, doc_name is used by nano as id
      var params = {
        doc_name: data.target.id
      };
      if (data.target.doc._rev) {
        params.rev = data.target.doc._rev;
      }
      
      // attachment multipart part
      var attachment = {
        name: data.target.name,
        content_type: data.target.content_type,
        data: []
      };

      // convert process
      var c = spawn('convert', data.args);

      // collect errors
      var cerror = [];
      c.stderr.on('data', function(err) {
        cerror.push(err);
      });

      // convert timeout
      var kill = setTimeout(function() {
        cerror.push(new Buffer('timeout'));
        // send SIGTERM
        c.kill();
      }, options.timeout);

      // collect output
      c.stdout.on('data', function(data) {
        attachment.data.push(data);
      });

      // concat output
      c.stdout.on('end', function() {
        clearTimeout(kill);
        attachment.data = Buffer.concat(attachment.data);
      });

      // convert finish
      c.on('close', function(code) {
        // store exit code
        data.code = code;
        data.target.doc.couchmagick[data.target.id][data.target.name].code = data.code;

        if (code === 0) {
          // no error: make multipart request
          return db.multipart.insert(data.target.doc, [attachment], params, function(err, response) {
            if (err) {
              return callback(err);
            }

            data.response = response;
            if (response.rev) {
              data.target.rev = response.rev;
            }

            callback(null, data);
          });
        }
      
        // store error
        data.error = Buffer.concat(cerror).toString();
        data.target.doc.couchmagick[data.target.id][data.target.name].error = data.error;

        // store document stup, discard attachment
        db.insert(data.target.doc, data.target.id, function(err, response) {
          if (err) {
            return callback(err);
          }

          data.response = response;
          if (response.rev) {
            data.target.rev = response.rev;
          }

          callback(null, data);
        });
      });


      // request attachment and pipe it into convert process
      db.attachment.get(data.source.id, data.source.name).pipe(c.stdin);
    });
  }


  // processing queue
  var convert = async.queue(convertAttachment, options.concurrency);


  return _.pipeline(
    // gather configs
    _.map(function(data) {
      if (data.stream === 'compile') {
        var cfg = {};
        cfg[data.id] = data.doc;

        _.extend(cfg, configs);
      }
      return data;
    }),

    // Decide whether a whole doc needs processing at all
    _.filter(function(data) {
      if (!data.doc) {
        return false;
      }
      if (!data.doc._attachments) {
        return false;
      }

      if (!Object.keys(data.doc._attachments).length) {
        return false;
      }

      return true;
    }),

    // split stream into each config
    // TODO: this prevents us from supporting multiple attachments per document
    // and therefore needs serialisation
    _.map(function(data) {
      return Object.keys(configs).map(function(config) {
        return {
          db_name: data.db_name,
          seq: data.seq,
          doc: data.doc,
          config: configs[config]
        };
      });
    }),
    _.flatten(),

    // Decide if couchmagick should be run on a specific attachment
    _.filter(function(data) {
      if (typeof data.config.filter === 'function' && !data.config.filter(data.doc)) {
        return false;
      }
 
      return true;
    }),

    // split stream into attachments
    // TODO: this prevents us from supporting multiple attachments per document
    // and therefore needs serialisation
    _.map(function(data) {
      return Object.keys(data.doc._attachments).map(function(name) {
        return {
          db_name: data.db_name,
          seq: data.seq,
          doc: data.doc,
          config: data.config,
          name: name
        };
      });
    }),
    _.flatten(),

    // filter attachments with builtin
    _.filter(function(data) {
      if (!data.doc) {
        return false;
      }
      if (!data.name) {
        return false;
      }

      return data.doc._attachments[data.name].content_type.match(/^image\//);
    }),

    // split stream into versions
    // TODO: this prevents us from supporting multiple attachments per document
    // and therefore needs serialisation
    _.map(function(data) {
      return Object.keys(data.config.versions).map(function(key) {
        var version = data.config.versions[key];

        // version defaults
        version.id = version.id || '{id}/{version}';
        version.name = version.name || '{basename}-{version}{extname}';
        version.content_type = version.content_type || 'image/jpeg';
        version.args = version.args || [];

        // first arg is input pipe
        if (!version.args[0] || version.args[0] !== '-') {
          version.args.unshift('-');
        }
        // last arg is output pipe
        if (version.args.length < 2 || !version.args[version.args.length - 1].match(/^[a-z]{0,3}:-$/)) {
          version.args.push('jpg:-');
        }

        // run version filter
        if (typeof version.filter === 'function' && !version.filter(data.doc, data.name)) {
          return;
        }

        // construct target doc
        var id = strformat(version.id, {
          id: data.doc._id,
          docuri: docuri.parse(data.doc._id),
          parts: data.doc._id.split('/'),
          version: key
        });
        var name = strformat(version.name, {
          id: data.doc._id,
          docuri: docuri.parse(data.doc._id),
          parts: data.doc._id.split('/'),
          version: key,

          name: data.name,
          extname: path.extname(data.name),
          basename: path.basename(data.name, path.extname(data.name)),
          dirname: path.dirname(data.name)
        });


        return {
          db_name: data.db_name,
          seq: data.seq,
          source: {
            id: data.doc._id,
            name: data.name,
            revpos: data.doc._attachments[data.name].revpos,
            couchmagick: data.doc.couchmagick
          },
          args: version.args,
          target: {
            id: id,
            name: name,
            content_type: version.content_type
          }
        };
      });
    }),
    _.flatten(),


    // filter derived versions to prevent cascades
    // eg:
    //   single-attachment/thumbnail
    //   single-attachment/thumbnail/thumbnail
    //   single-attachment/thumbnail/thumbnail/thumbnail
    _.filter(function(data) {
      var derivative = data.source.couchmagick &&
        data.source.couchmagick[data.source.id] &&
        data.source.couchmagick[data.source.id][data.source.name] &&
        data.source.couchmagick[data.source.id][data.source.name].id;

      return !derivative;
    }),


    // process attachments
    _.through(function(source) {
      return _(function(push, done) {
        source
          .on('data', function(data) {
            convert.push(data, function(err, res) {
              push(err, res);
            });
          })
          .on('error', push)
          .on('end', done);
      });
    }),

    _.map(function(data) {
      if (!data.response) {
        return data;
      }

      return {
        db_name: data.db_name,
        seq: data.seq,
        type: 'log',
        message: 'Complete: ' + JSON.stringify(data.response)
      };
    })
  );
};

