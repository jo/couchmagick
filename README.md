couchmagick
===========
Run ImageMagicks `convert` on CouchDB documents.

Installation
------------
via npm:

```bash
npm install couchmagick -g
```

Configuration
-------------
Add couchmagick to the `os_daemons`:
```ini
[os_daemons]
couchmagick = couchmagick
```

Now CouchDB takes care of the couchmagick process.

```ini
[couchmagick]
user = mein-user
password = secure
dbs = photos, _users
filter = 'myapp/myfilter'
```

Contributing
------------
Lint your code via `npm run jshint`.

License
-------
Copyright (c) 2012-2013 Johannes J. Schmidt, null2 GmbH

Licensed under the MIT license.
