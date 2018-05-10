'use strict';

const { uuid4, isLikeZoteroItem } = require('./utils');
const defaults = require('./defaults');
const itemToCSLJSON = require('../zotero-shim/item-to-csl-json');
const dateToSql = require('../zotero-shim/date-to-sql');
const [ COMPLETE, MULTIPLE_ITEMS, FAILED ] = [ 'COMPLETE', 'MULTIPLE_ITEMS', 'FAILED' ];

class ZoteroBib {
	constructor(opts) {
		this.opts = {
			sessionid: uuid4(),
			...defaults(),
			...opts
		};

		if(this.opts.persist && this.opts.storage) {
			if(!('getItem' in this.opts.storage ||
				'setItem' in this.opts.storage ||
				'clear' in this.opts.storage
			)) {
				throw new Error('Invalid storage engine provided');
			}
			if(this.opts.override) {
				this.clearItems();
			}
			this.items = [...this.opts.initialItems, ...this.getItemsStorage()]
				.filter(isLikeZoteroItem);
			this.setItemsStorage(this.items);
		} else {
			this.items = [...this.opts.initialItems].filter(isLikeZoteroItem);
		}
	}

	getItemsStorage() {
		let items = this.opts.storage.getItem(`${this.opts.storagePrefix}-items`);
		return items ? JSON.parse(items) : [];
	}

	setItemsStorage(items) {
		this.opts.storage.setItem(
			`${this.opts.storagePrefix}-items`,
			JSON.stringify(items)
		);
	}

	reloadItems() {
		this.items = this.getItemsStorage();
	}

	addItem(item) {
		if(!isLikeZoteroItem(item)) {
			throw new Error('Failed to add item');
		}
		this.items.push(item);
		if(this.opts.persist) {
			this.setItemsStorage(this.items);
		}
	}

	updateItem(index, item) {
		this.items[index] = item;
		if(this.opts.persist) {
			this.setItemsStorage(this.items);
		}
	}

	removeItem(item) {
		let index = this.items.indexOf(item);
		if(index !== -1) {
			this.items.splice(index, 1);
			if(this.opts.persist) {
				this.setItemsStorage(this.items);
			}
			return item;
		}
		return false;
	}

	clearItems() {
		this.items = [];
		if(this.opts.persist) {
			this.setItemsStorage(this.items);
		}
	}

	get itemsCSL() {
		return this.items.map(i => itemToCSLJSON(i))
	}

	get itemsRaw() {
		return this.items;
	}

	async exportItems(format) {
		let translationServerURL = `${this.opts.translationServerURL}/${this.opts.translationServerPrefix}export?format=${format}`;
		let fetchOptions = {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify(this.items.filter(i => 'key' in i )),
			...this.opts.init
		}
		const response = await fetch(translationServerURL, fetchOptions);
		if(response.ok) {
			return await response.text();
		} else {
			throw new Error('Failed to export items');
		}
	}

	async translateIdentifier(identifier, ...args) {
		let translationServerURL = `${this.opts.translationServerURL}/${this.opts.translationServerPrefix}search`;
		let init = {
			method: 'POST',
			headers: {
				'Content-Type': 'text/plain'
			},
			body: identifier,
			...this.opts.init
		};

		return await this.translate(translationServerURL, init, ...args);
	}

	async translateUrlItems(url, items, ...args) {
		let translationServerURL = `${this.opts.translationServerURL}/${this.opts.translationServerPrefix}web`;
		let sessionid = this.opts.sessionid;
		let data = { url, items, sessionid, ...this.opts.request };

		let init = {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify(data),
			...this.opts.init
		};

		return await this.translate(translationServerURL, init, ...args);
	}

	async translateUrl(url, ...args) {
		let translationServerURL = `${this.opts.translationServerURL}/${this.opts.translationServerPrefix}web`;
		let sessionid = this.opts.sessionid;
		let data = { url, sessionid, ...this.opts.request };

		let init = {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify(data),
			...this.opts.init
		};

		return await this.translate(translationServerURL, init, ...args);
	}

	async translate(url, fetchOptions, add=true) {
		const response = await fetch(url, fetchOptions);
		var items, result;

		if(response.ok) {
			items = await response.json();
			if(Array.isArray(items)) {
				items.forEach(item => {
					if(item.accessDate === 'CURRENT_TIMESTAMP') {
						const dt = new Date(Date.now());
						item.accessDate = dateToSql(dt, true);
					}

					if(add) {
						this.addItem(item);
					}
				});
			}
			result = Array.isArray(items) ? COMPLETE : FAILED;
		} else if(response.status === 300) {
			items = await response.json();
			result = MULTIPLE_ITEMS;
		} else {
			result = FAILED
		}

		return { result, items, response };
	}

	static get COMPLETE() { return COMPLETE }
	static get MULTIPLE_ITEMS() { return MULTIPLE_ITEMS }
	static get FAILED() { return FAILED }
}

module.exports = ZoteroBib;
