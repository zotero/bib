'use strict';

const utils = require('./utils');
const defaults = require('./defaults');
const { CSL } = require('citeproc-js');
const itemToCSLJSON = require('../zotero-shim/item-to-csl-json');

class ZoteroBib {
	constructor(opts) {
		this.opts = Object.assign({
			sessionid: utils.uuid4()
		}, defaults, opts);

		this._items = this.opts.initialItems || [];
		if(this.opts.persistInLocalStorage) {
			this._items = this._items.concat(this.getItemsLocalStorage());
			this.setItemsLocalStorage(this._items);
		}
	}

	getItemsLocalStorage() {
		let items = localStorage.getItem('items');
		if(items) {
			return JSON.parse(items);
		} else {
			return [];
		}
	}

	setItemsLocalStorage(items) {
		localStorage.setItem('items', JSON.stringify(items));
	}

	addItem(item) {
		this._items.push(item);
		if(this.opts.persistInLocalStorage) {
			this.setItemsLocalStorage(this._items);
		}
	}

	removeItem(item) {
		let index = this._items.indexOf(item);
		if(index !== -1) {
			this._items.splice(index, 1);
			if(this.opts.persistInLocalStorage) {
				this.setItemsLocalStorage(this._items);
			}
			return true;
		} else {
			return false;
		}
	}

	clearItems() {
		this._items = [];
		if(this.opts.persistInLocalStorage) {
			this.setItemsLocalStorage(this._items);
		}
	}

	get items() {
		return this._items.map(i => itemToCSLJSON(i))
	}

	get rawItems() {
		return this._items;
	}

	async translateUrl(url, add = true) {
		let translationServerUrl = `${this.opts.translationServerUrl}/web`;
		let sessionid = this.opts.sessionid;
		let data = Object.assign({ url, sessionid }, this.opts.request);

		let init = Object.assign({
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify(data)
		}, this.opts.init);

		let response = await fetch(translationServerUrl, init);
		let items = await response.json();
		if(Array.isArray(items) && add) {
			items.forEach(this.addItem.bind(this));
		}

		return Array.isArray(items) && items || false;
	}

	static get CSL() {
		return CSL;
	}
}

module.exports = ZoteroBib;
