'use strict';

import 'es6-promise/auto';
import 'isomorphic-fetch';
import 'babel-regenerator-runtime';

import utils from './utils';
import defaults from './defaults';

export default class ZoteroBib {
	constructor() {
		var opts, formEl;
		let args = Array.from(arguments);

		if(args.length == 1) {
			[ opts ] = args;
		} else if(args.length == 2) {
			[ formEl, opts ] = args;
		}

		this.opts = Object.assign({
			sessionid: utils.uuid4()
		}, defaults, opts);

		this._items = this.opts.initialItems;

		if(formEl) {
			this.formEl = formEl;
			this.init();
		}
	}

	init() {
		if(this.opts.persistInLocalStorage) {
			this._items = this._items.concat(this.getItemsFromLocalStorage());
		}
		this.formEl.addEventListener('submit', this.submitHandler.bind(this));
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
		if(index) {
			this._items.splice(index, 1);
			if(this.opts.persistInLocalStorage) {
				this.setItemsLocalStorage(this._items);
			}
			return true;
		} else {
			return false;
		}
	}

	async translateUrl(url) {
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
		return await response.json();
	}

	async submitHandler(ev) {
		ev && ev.preventDefault();
		if('elements' in ev.target && 'url' in ev.target.elements) {
			let item = await this.translateUrl(ev.target.elements['url'].value);
			this.addItem(item);
		}
	}
}
