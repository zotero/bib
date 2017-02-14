'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});

var _lpad = require('./lpad');

var _lpad2 = _interopRequireDefault(_lpad);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

exports.default = function (date, toUTC) {
	var year, month, day, hours, minutes, seconds;
	try {
		if (toUTC) {
			year = date.getUTCFullYear();
			month = date.getUTCMonth();
			day = date.getUTCDate();
			hours = date.getUTCHours();
			minutes = date.getUTCMinutes();
			seconds = date.getUTCSeconds();
		} else {
			year = date.getFullYear();
			month = date.getMonth();
			day = date.getDate();
			hours = date.getHours();
			minutes = date.getMinutes();
			seconds = date.getSeconds();
		}

		year = (0, _lpad2.default)(year, '0', 4);
		month = (0, _lpad2.default)(month + 1, '0', 2);
		day = (0, _lpad2.default)(day, '0', 2);
		hours = (0, _lpad2.default)(hours, '0', 2);
		minutes = (0, _lpad2.default)(minutes, '0', 2);
		seconds = (0, _lpad2.default)(seconds, '0', 2);

		return year + '-' + month + '-' + day + ' ' + hours + ':' + minutes + ':' + seconds;
	} catch (e) {
		return '';
	}
};

module.exports = exports['default'];