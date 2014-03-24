couchmagick
===========
Run ImageMagicks `convert` on CouchDB documents.

couchmagick runs as an [os_daemon](http://docs.couchdb.org/en/1.5.x/config/externals.html#os_daemons),
which means that CouchDB manages the process and you can configure it using CouchDBs configuration mechanism, which is both a huge win.

The versions and commandline arguments are defined in design documents under a `couchmagick` section.

couchmagicks Stream based implementation provides low memory footprint.

Installation
------------
The installation of couchmagick is dead simple.

Make sure you have `ImageMagick` installed, eg on Debian:
```bash
apt-get install imagemagick
```

Install couchmagick via npm:

```bash
npm install couchmagick -g
```

Daemon Configuration
--------------------
Add couchmagick to `os_daemons` config section:

```ini
[os_daemons]
couchmagick = couchmagick
```

Now CouchDB takes care of the couchmagick process.

```ini
[couchmagick]
; Optional username and password, used by the workers to access the database
username = mein-user
password = secure
; Number of simultaneous changes feeds in parallel. Default is 20.
; Increase it to at least  the number of your databases, to get best performance.
; If streams is less than the number of databases, all databases will still be queried
; but in intervals of the changes_feed_timeout (see below). You should keep the 
; streams parameter equal to or larger than the number of databases in the server
; usually.
streams = 20
; Concurrency level (number of simultanous convert processes per stream). Default is 1.
; this should be set to the number of cores of your cpu for optimum performance, but
; it really depends on the number of databases and their usage patterns.
concurrency = 1
; Timeout for a convert process in ms. Default is 60000 (1min). This should be plenty
; for the usual image resizes, increase it if you deal with really large images and complex
; imagemagick processing.
convert_process_timeout = 60000
; Timeout for changes feed in ms. Default is 60000. See the 'streams' parameter above
; if you have a really large number of databases in your server and cannot afford to
; have a changes feed open to each of them.
changes_feed_timeout = 60000
; Batch size. This limits the batches the workers will take from the changes feed.
; It basically translates to a limit parameter on the changes feed. Default is 100
limit = 100
```

Imagemagick Configuration
-------------------------
Add a `couchmagick` property to a design document. couchmagick will process all
databases which have such a design document.
```json
{
  "_id": "_design/my-couchmagick-config",
  "_rev": "1-a653b27246b01cf9204fa9f5dee7cc64",
  "couchmagick": {
    "versions": {
      "thumbnail": {
        "args": [
          "-resize", "x100"
        ]
      }
    }
  }
}
```

See [couchmagick-stream](https://github.com/null2/couchmagick-stream) for available options.


Contributing
------------
Lint your code via `npm run jshint`.

License
-------
Copyright (c) 2012-2013 Johannes J. Schmidt, null2 GmbH

Licensed under the MIT license.
