# Zotero Bib

Overview
--------
Zotero Bib is a library that can process URLs into CSL bibliography items. It uses a translation server to translate URLs into a Zotero Items, optionally persisting these items in any (Web Storage)[https://developer.mozilla.org/en/docs/Web/API/Storage] compatible container 

 which it can optionally store in  which then is translated into a CSL item that then can be proessed by citeproc-js so that finally a bibliography item can be rendered. 

Prerequisites
------------

1. Node JS with npm
1. Running translation-server

Local Demo
----------

Getting The Library

1. `git clone git@github.com:zotero/bib.git`

1. `cd bib`

1. `npm install`

1. `npm start`

This will serve demo on http://127.0.0.1:8001.

By default the **translations server is expected to be listening on localhost:1969**. If your server is located elsewhere you need to provide the path, e.g. the last step above would look like this:

1. `npm start --zotero-bib:translation_server="http://localhost:1234"`

