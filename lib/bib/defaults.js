'use strict';

module.exports = () => ({
	translationServerUrl: typeof window != 'undefined' && window.location.origin || '',
	fetchConfig: {},
	initialItems: [],
	request: {},
	storage: typeof window != 'undefined' && 'localStorage' in window && window.localStorage || {},
	persist: true
});