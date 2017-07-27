# Zotero Bib

Overview
--------
Zotero Bib is a library that can process URLs into CSL-JSON bibliography items. It uses a translation server to translate URLs into a Zotero Items, optionally persisting these items, while also providing functionality to translate Zotero Items to CSL items on-demand.


Quick start
-------------
1. Install and start (translation server)[https://github.com/zotero/translation-server]

2. Configure the library to work with the translation server

```
let bib = new ZoteroBib({
	persist: false,
	translationServerUrl: 'http://my-translation.server.example.com:1234'
});
```

3. Translate some urls

```
const [myPaper] = await bib.translateUrl('http://example.com/paper');
```

In-memory Storage
-----------------
Normally each call to `translateUrl` returns an item and also caches it in memory. Cached items can be retrieved at any time, either as Zotero Items:

```
const [myPaper] = bib.itemsRaw;
```

Or in [CSL-JSON](https://github.com/citation-style-language/schema) format:

```
const [myPaperAsCSL] = bib.itemsCSL;
```

This behaviour can be prevented using second, optional argument to `bib.translate`, i.e. calling `bib.translateUrl(url, false)` will return a translated item but won't store it anywhere.

Persistence
-----------
In the example above, after refreshing the page (or restarting a node script), all previosly translated, cached items are lost. If that's not desired behaviour, ZoteroBib accepts any (Web Storage)[https://developer.mozilla.org/en/docs/Web/API/Storage] compatible container for persistance. In fact, by default, it will attempt to use (Local Storage)[https://developer.mozilla.org/en/docs/Web/API/Window/localStorage] for persistence.

If you're running ZoteroBib in node, you'll either need to disable persistence (as in the example above) or provide your own Web Storage compatible container (e.g. (node-localstorage)[https://github.com/lmaccherone/node-localstorage]):

```
const LocalStorage = require('node-localstorage').LocalStorage;
const fileStorage = new LocalStorage('./my-citations');

let bib = new ZoteroBib({
	storage: fileStorage,
	translationServerUrl: 'http://my-translation.server.example.com:1234'
});
```