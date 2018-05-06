'use strict';

module.exports = () => ({
	translationServerURL: typeof window != 'undefined' && window.location.origin || '',
	translationServerPrefix: '',
	fetchConfig: {},
	initialItems: [],
	request: {},
	storage: typeof window != 'undefined' && 'localStorage' in window && window.localStorage || {},
	persist: true,
	override: false,
	storagePrefix: 'zotero-bib'
});
