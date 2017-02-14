'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});
exports.default = {
	translationServerUrl: typeof window != 'undefined' && window.location.origin || '',
	init: {},
	request: {},
	persistInLocalStorage: true
};
module.exports = exports['default'];