# Couchmagick
Run ImageMagicks `convert` on CouchDB documents.

Couchmagick runs as an [os_daemon](http://docs.couchdb.org/en/1.5.x/config/externals.html#os_daemons),
which means that CouchDB manages the process and you can configure it using CouchDBs configuration mechanism, which is both a huge win.

Versions and commandline arguments which are passed to `convert` are defined in design documents under a `couchmagick` section.

couchmagicks stream based implementation provides low memory footprint.

## Installation
The installation of Couchmagick is dead simple.

Make sure you have `ImageMagick` installed, eg on Debian:   
`apt-get install imagemagick`

Install Couchmagick via npm:   
`npm install couchmagick -g`

## Commandline Client
You can run Couchmagick from the commandline:
```shell
couchmagick
```

The options explained above can be given as commandline parameters (prefixed with
`--`) or environment variables (UPPERCASED).

```shell
couchmagick --username bernd --password secure --whitelist projects --concurrency 8 --timeout 1000
```

## Daemon Configuration
Add Couchmagick to `os_daemons` config section (eg. in local.ini):

```ini
[os_daemons]
couchmagick = couchmagick
```

Now CouchDB takes care of the Couchmagick process.

```ini
[couchmagick]
; Optional username and password, used by the workers to access the database.
; Default is null.
username = bernd
password = secure
; Concurrency level (number of simultanous convert processes per stream). Default is 1.
; this should be set to the number of cores of your cpu for optimum performance, but
; it really depends on the number of databases and their usage patterns.
concurrency = 1
; Timeout for a convert process in ms. Default is 60000 (1min). This should be plenty
; for the usual image resizes, increase it if you deal with really large images and complex
; imagemagick processing.
timeout = 60000
; Only documents in the databases below are processed (separate with comma).
; Regular expressions are allowed:
;whitelist = mydb,otherdb,/^special-.*/
; Ignore the following databases (again comma separated list)
; Regular expressions are again allowed:
blacklist = /^_/
```

## Imagemagick Configuration
Add a `couchmagick` property to a design document. Couchmagick will process all
databases which have such a design document.

### Minimal Example
```json
{
  "_id": "_design/minimal-couchmagick-config",
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

### `filter`
There are two kinds of filters which you can define: one operates on doc level
and one on version level.

#### Document Filter
This filter is called with one argument: document.

#### Version Filter
This filter is called with two arguments, document and attachment name.

### `content_type`
Content-Type of the resulting attachment. Default is `image/jpeg`.

### `id`
The document id where the version is stored. Defaults to `{id}/{version}`.

Can have the following [strformat placeholders](https://github.com/fhellwig/strformat):
* `id` - the original doc id
* `parts` - array of the id splitted at `/`
* `docuri` - [docuri](https://github.com/jo/docuri) parsed id object:
 * `docuri.type` - index part of docuri
 * `docuri.id` - id part of docuri
 * `docuri.subtype` - subtype part of docuri
 * `docuri.version` - version part of docuri
 * `docuri.index` - index part of docuri
* `version` - name of the version

### `name`
The attachment name of the version. Default is `{basename}-{version}{extname}`.

Can have placeholders:
* `id` - the original doc id
* `parts` - array of the id splitted at `/`
* `docuri` - [docuri](https://github.com/jo/docuri) parsed id object:
 * `docuri.type` - index part of docuri
 * `docuri.id` - id part of docuri
 * `docuri.subtype` - subtype part of docuri
 * `docuri.version` - version part of docuri
 * `docuri.index` - index part of docuri
* `version` - name of the version
* `name` - original attachment name, eg `this/is/my-image.jpg`
* `extname` - file extenstion of the original attachment name, eg `.jpg`
* `basename` - basename without extension, eg `my-image`
* `dirname` - directory name, eg `this/is`
* `version` - name of the version

### `args`
Array of argument strings for ImageMagicks `convert`.

The default is `['-', 'jpg:-']`, which means that ImageMagick converts the image
to `jpg`. You can see that we use `convert` with pipes for in- and output.

See [ImageMagick Convert Command-line Tool](http://www.imagemagick.org/script/convert.php)
for a comprehensive list of options.

### Advanced Example
```json
{
  "_id": "_design/advanced-couchmagick-config",
  "_rev": "1-0b42e71d7b179c7e44a436704e4fd8e3",
  "couchmagick": {
    "filter": "function(doc) { return doc.type === 'post'; }",
    "versions": {
      "medium": {
        "id": "{id}-{version}",
        "name": "{basename}/{version}{extname}",
        "args": [
          "-resize", "800x600",
          "-quality", "75",
          "-colorspace", "sRGB",
          "-strip"
        ]
      },
      "large": {
        "filter": "function(doc, name) { return name.match(/^header/); }",
        "id": "{id}-header",
        "name": "header/large.jpg",
        "args": [
          "-quality", "75",
          "-unsharp", "0",
          "-colorspace", "sRGB",
          "-interlace", "Plane",
          "-strip",
          "-density", "72",
          "-resize", "960x320^",
          "-gravity", "center",
          "-crop", "960x320+0+0", "+repage"
        ]
      }
    }
  }
}
```

## License
Copyright (c) 2012-2014 Johannes J. Schmidt, null2 GmbH   
Licensed under the MIT license.
