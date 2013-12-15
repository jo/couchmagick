couchmagick
===========
Run ImageMagicks `convert` on CouchDB documents.

Installation
------------
via npm:

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
user = mein-user  ; optional
password = secure ; optional
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
    "filter": "function(doc) { return doc.type === 'post'; }",
    "versions": {
      "thumbnail": {
        "filter": "function(doc, name) { return doc.display && doc.display.indexOf('overview') > -1; }",
        "format": "jpg",
        "id": "{id}/thumbnail",
        "name": "{basename}-thumbnail.jpg",
        "args": [
          "-",
          "-resize", "x100",
          "-quality", "75",
          "-colorspace", "sRGB",
          "-strip",
          "jpg:-"
        ]
      }
    }
  }
}
```

See [couchmagick-stream](https://github.com/null2/couchmagick-stream) for available options;


Contributing
------------
Lint your code via `npm run jshint`.

License
-------
Copyright (c) 2012-2013 Johannes J. Schmidt, null2 GmbH

Licensed under the MIT license.
