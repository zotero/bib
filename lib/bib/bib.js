'use strict';

function _asyncToGenerator(fn) { return function () { var gen = fn.apply(this, arguments); return new Promise(function (resolve, reject) { function step(key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { return Promise.resolve(value).then(function (value) { step("next", value); }, function (err) { step("throw", err); }); } } return step("next"); }); }; }

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
		if (this.opts.persistInLocalStorage) {
			this._items = this._items.concat(this.getItemsLocalStorage());
			this.setItemsLocalStorage(this._items);
		}
	}

	getItemsLocalStorage() {
		let items = localStorage.getItem('items');
		if (items) {
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
		if (this.opts.persistInLocalStorage) {
			this.setItemsLocalStorage(this._items);
		}
	}

	removeItem(item) {
		let index = this._items.indexOf(item);
		if (index !== -1) {
			this._items.splice(index, 1);
			if (this.opts.persistInLocalStorage) {
				this.setItemsLocalStorage(this._items);
			}
			return true;
		} else {
			return false;
		}
	}

	clearItems() {
		this._items = [];
		if (this.opts.persistInLocalStorage) {
			this.setItemsLocalStorage(this._items);
		}
	}

	get items() {
		return this._items.map(i => itemToCSLJSON(i));
	}

	get rawItems() {
		return this._items;
	}

	translateUrl(url, add = true) {
		var _this = this;

		return _asyncToGenerator(function* () {
			let translationServerUrl = `${_this.opts.translationServerUrl}/web`;
			let sessionid = _this.opts.sessionid;
			let data = Object.assign({ url, sessionid }, _this.opts.request);

			let init = Object.assign({
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify(data)
			}, _this.opts.init);

			let response = yield fetch(translationServerUrl, init);
			let items = yield response.json();
			if (Array.isArray(items) && add) {
				items.forEach(_this.addItem.bind(_this));
			}

			return Array.isArray(items) && items || false;
		})();
	}

	static get CSL() {
		return CSL;
	}
}

module.exports = ZoteroBib;