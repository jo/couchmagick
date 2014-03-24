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
; Optional username and password
username = mein-user
password = secure
; Number of simultanous streams of changes feeds in parallel. Default is 1.
; Increase it to the number of your databases, to get best performance.
streams = 1
; Concurrency level (number of simultanous convert processes per stream). Default is 1.
concurrency = 1
; Timeout for convert process in ms. Default is 60000 (1min)
convert_process_timeout = 60000
; Timeout for changes feed in ms. Default is 10000
changes_feed_timeout = 10000
; Batch size. Default is 100
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
