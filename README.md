# Zotero Translation Client

Overview
--------
Zotero Translation Client is a library that can process URLs and identifiers (such as ISBN or DOI) into CSL-JSON bibliography items using [translation server](https://github.com/zotero/translation-server), optionally persisting these items in a storage object provided.

Getting The Library
-------------

```javascript
npm i zotero-translation-client
```

Quick start
-------------
1. Install and start [translation server](https://github.com/zotero/translation-server)

2. Configure the library to work with the translation server

```javascript
const ZoteroTranslationClient = require('zotero-translation-client');
let translationClient = new ZoteroTranslationClient({
	persist: false,
	translateURL: 'http://my-translation.server.example.com:1234'
});
```

3. Translate some urls

```javascript
const [myPaper] = await translationClient.translateUrl('http://example.com/paper');
```

In-memory Storage
-----------------
Normally each call to `translateUrl` returns an item and also caches it in memory. Cached items can be retrieved at any time, either as Zotero Items:

```javascript
const [myPaper] = translationClient.itemsRaw;
```

Or in [CSL-JSON](https://github.com/citation-style-language/schema) format:

```javascript
const [myPaperAsCSL] = translationClient.itemsCSL;
```

This behaviour can be prevented using second, optional argument to `translationClient.translate`, i.e. calling `translationClient.translateUrl(url, { add: false })` will return a translated item but won't store it anywhere.

Persistence
-----------
In the example above, after refreshing the page (or restarting a node script), all previosly translated, cached items are lost. If that's not desired behaviour, Zotero Translation Client accepts any [Web Storage](https://developer.mozilla.org/en/docs/Web/API/Storage) compatible container for persistance. In fact, by default, it will attempt to use [Local Storage](https://developer.mozilla.org/en/docs/Web/API/Window/localStorage) for persistence.

If you're running Zotero Translation Client in node, you'll either need to disable persistence (as in the example above) or provide your own Web Storage compatible container (e.g. [node-localstorage](https://github.com/lmaccherone/node-localstorage)):

```javascript
const LocalStorage = require('node-localstorage').LocalStorage;
const fileStorage = new LocalStorage('./my-citations');

let translationClient = new ZoteroTranslationClient({
	storage: fileStorage,
	translateURL: 'http://my-translation.server.example.com:1234'
});
```
