'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});

exports.default = function (string, pad, length) {
	string = string ? string + '' : '';
	while (string.length < length) {
		string = pad + string;
	}
	return string;
};

module.exports = exports['default'];