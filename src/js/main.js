'use strict';

import 'es6-promise/auto';
import 'isomorphic-fetch';
import 'babel-regenerator-runtime';

import utils from './utils';
import defaults from './defaults';

export default class ZoteroBib {
	constructor(formEl, opts) {
		this.opts = Object.assign({}, defaults, opts);
		this.formEl = formEl;
		this.init();
	}

	init() {
		this.formEl.addEventListener('submit', this.submitHandler.bind(this));
	}

	async submitHandler(ev) {
		ev && ev.preventDefault();
		if('elements' in ev.target && 'url' in ev.target.elements) {
			let url = ev.target.elements['url'].value;
			let translationServerUrl = `${this.opts.translationServerUrl}/web`;

			let sessionid = utils.uuid4();
			let data = Object.assign({ url, sessionid }, this.opts.request);

			let init = Object.assign({
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify(data)
			}, this.opts.init);

			let response = await fetch(translationServerUrl, init);
			let item = await response.json();
			console.log(item);
		}
	}
}
