'use strict';

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

const utils = require('./utils');
const defaults = require('./defaults');
const itemToCSLJSON = require('../zotero-shim/item-to-csl-json');
const dateToSql = require('../zotero-shim/date-to-sql');

class ZoteroBib {
	constructor(opts) {
		this.opts = _extends({
			sessionid: utils.uuid4()
		}, defaults(), opts);

		if (this.opts.persist && this.opts.storage) {
			if (!('getItem' in this.opts.storage || 'setItem' in this.opts.storage || 'clear' in this.opts.storage)) {
				throw new Error('Invalid storage engine provided');
			}
			if (this.opts.override) {
				this.clearItems();
			}
			this.items = [...this.opts.initialItems, ...this.getItemsStorage()];
			this.setItemsStorage(this.items);
		} else {
			this.items = [...this.opts.initialItems];
		}
	}

	getItemsStorage() {
		let items = this.opts.storage.getItem(`${this.opts.storagePrefix}-items`);
		return items ? JSON.parse(items) : [];
	}

	setItemsStorage(items) {
		this.opts.storage.setItem(`${this.opts.storagePrefix}-items`, JSON.stringify(items));
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
		}
		return false;
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

	async translateIdentifier(identifier, ...args) {
		let translationServerUrl = `${this.opts.translationServerUrl}/${this.opts.translationServerPrefix}search`;
		let init = _extends({
			method: 'POST',
			headers: {
				'Content-Type': 'text/plain'
			},
			body: identifier
		}, this.opts.init);

		return await this.translate(translationServerUrl, init, ...args);
	}

	async translateUrl(url, ...args) {
		let translationServerUrl = `${this.opts.translationServerUrl}/${this.opts.translationServerPrefix}web`;
		let sessionid = this.opts.sessionid;
		let data = _extends({
			url,
			sessionid
		}, this.opts.request);

		let init = _extends({
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify(data)
		}, this.opts.init);

		return await this.translate(translationServerUrl, init, ...args);
	}

	async translate(url, fetchOptions, add = true) {
		let response = await fetch(url, fetchOptions);
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