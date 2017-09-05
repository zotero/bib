'use strict';

const utils = require('./utils');
const defaults = require('./defaults');
const itemToCSLJSON = require('../zotero-shim/item-to-csl-json');
const dateToSql = require('../zotero-shim/date-to-sql');

class ZoteroBib {
	constructor(opts) {
		this.opts = Object.assign({
			sessionid: utils.uuid4()
		}, defaults(), opts);

		this.items = [...this.opts.initialItems];
		if (this.opts.persist && this.opts.storage) {
			if (!('getItem' in this.opts.storage || 'setItem' in this.opts.storage || 'clear' in this.opts.storage)) {
				throw new Error('Invalid storage engine provided');
			}
			this.items = [...this.items, ...this.getItemsStorage()];
			this.setItemsStorage(this.items);
		}
	}

	getItemsStorage() {
		let items = this.opts.storage.getItem('items');
		if (items) {
			return JSON.parse(items);
		} else {
			return [];
		}
	}

	setItemsStorage(items) {
		this.opts.storage.setItem('items', JSON.stringify(items));
	}

	addItem(item) {
		this.items.push(item);
		if (this.opts.persist) {
			this.setItemsStorage(this.items);
		}
	}

	updateItem(index, item) {
		this.items[index] = item;
		if (this.opts.persist) {
			this.setItemsStorage(this.items);
		}
	}

	removeItem(item) {
		let index = this.items.indexOf(item);
		if (index !== -1) {
			this.items.splice(index, 1);
			if (this.opts.persist) {
				this.setItemsStorage(this.items);
			}
			return true;
		} else {
			return false;
		}
	}

	clearItems() {
		this.items = [];
		if (this.opts.persist) {
			this.setItemsStorage(this.items);
		}
	}

	get itemsCSL() {
		return this.items.map(i => itemToCSLJSON(i));
	}

	get itemsRaw() {
		return this.items;
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
		if (Array.isArray(items)) {
			items.forEach(item => {
				if (item.accessDate === 'CURRENT_TIMESTAMP') {
					const dt = new Date(Date.now());
					item.accessDate = dateToSql(dt, true);
				}

				if (add) {
					this.addItem(item);
				}
			});
		}

		return Array.isArray(items) && items || false;
	}
}

module.exports = ZoteroBib;