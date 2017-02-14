'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});

var _typeSpecificFieldMap;

var _fields = require('./fields');

var _fields2 = _interopRequireDefault(_fields);

var _itemTypes = require('./item-types');

var _itemTypes2 = _interopRequireDefault(_itemTypes);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

var typeSpecificFieldMap = (_typeSpecificFieldMap = {}, _defineProperty(_typeSpecificFieldMap, (16 << 8) + 4, 94), _defineProperty(_typeSpecificFieldMap, (17 << 8) + 4, 97), _defineProperty(_typeSpecificFieldMap, (7 << 8) + 8, 89), _defineProperty(_typeSpecificFieldMap, (11 << 8) + 8, 21), _defineProperty(_typeSpecificFieldMap, (15 << 8) + 8, 31), _defineProperty(_typeSpecificFieldMap, (26 << 8) + 8, 72), _defineProperty(_typeSpecificFieldMap, (28 << 8) + 8, 76), _defineProperty(_typeSpecificFieldMap, (29 << 8) + 8, 78), _defineProperty(_typeSpecificFieldMap, (30 << 8) + 8, 78), _defineProperty(_typeSpecificFieldMap, (32 << 8) + 8, 83), _defineProperty(_typeSpecificFieldMap, (16 << 8) + 10, 95), _defineProperty(_typeSpecificFieldMap, (17 << 8) + 10, 98), _defineProperty(_typeSpecificFieldMap, (3 << 8) + 12, 115), _defineProperty(_typeSpecificFieldMap, (33 << 8) + 12, 114), _defineProperty(_typeSpecificFieldMap, (13 << 8) + 12, 91), _defineProperty(_typeSpecificFieldMap, (23 << 8) + 12, 107), _defineProperty(_typeSpecificFieldMap, (25 << 8) + 12, 104), _defineProperty(_typeSpecificFieldMap, (29 << 8) + 12, 119), _defineProperty(_typeSpecificFieldMap, (30 << 8) + 12, 119), _defineProperty(_typeSpecificFieldMap, (35 << 8) + 12, 85), _defineProperty(_typeSpecificFieldMap, (36 << 8) + 12, 86), _defineProperty(_typeSpecificFieldMap, (17 << 8) + 14, 96), _defineProperty(_typeSpecificFieldMap, (19 << 8) + 14, 52), _defineProperty(_typeSpecificFieldMap, (20 << 8) + 14, 100), _defineProperty(_typeSpecificFieldMap, (15 << 8) + 60, 92), _defineProperty(_typeSpecificFieldMap, (16 << 8) + 60, 93), _defineProperty(_typeSpecificFieldMap, (17 << 8) + 60, 117), _defineProperty(_typeSpecificFieldMap, (18 << 8) + 60, 99), _defineProperty(_typeSpecificFieldMap, (19 << 8) + 60, 50), _defineProperty(_typeSpecificFieldMap, (20 << 8) + 60, 101), _defineProperty(_typeSpecificFieldMap, (29 << 8) + 60, 105), _defineProperty(_typeSpecificFieldMap, (30 << 8) + 60, 105), _defineProperty(_typeSpecificFieldMap, (31 << 8) + 60, 105), _defineProperty(_typeSpecificFieldMap, (7 << 8) + 108, 69), _defineProperty(_typeSpecificFieldMap, (8 << 8) + 108, 65), _defineProperty(_typeSpecificFieldMap, (9 << 8) + 108, 66), _defineProperty(_typeSpecificFieldMap, (11 << 8) + 108, 122), _defineProperty(_typeSpecificFieldMap, (13 << 8) + 108, 70), _defineProperty(_typeSpecificFieldMap, (15 << 8) + 108, 32), _defineProperty(_typeSpecificFieldMap, (22 << 8) + 108, 67), _defineProperty(_typeSpecificFieldMap, (23 << 8) + 108, 70), _defineProperty(_typeSpecificFieldMap, (25 << 8) + 108, 79), _defineProperty(_typeSpecificFieldMap, (27 << 8) + 108, 74), _defineProperty(_typeSpecificFieldMap, (10 << 8) + 109, 64), _defineProperty(_typeSpecificFieldMap, (11 << 8) + 109, 63), _defineProperty(_typeSpecificFieldMap, (12 << 8) + 109, 59), _defineProperty(_typeSpecificFieldMap, (26 << 8) + 109, 71), _defineProperty(_typeSpecificFieldMap, (28 << 8) + 109, 63), _defineProperty(_typeSpecificFieldMap, (29 << 8) + 109, 63), _defineProperty(_typeSpecificFieldMap, (30 << 8) + 109, 71), _defineProperty(_typeSpecificFieldMap, (31 << 8) + 109, 80), _defineProperty(_typeSpecificFieldMap, (17 << 8) + 110, 111), _defineProperty(_typeSpecificFieldMap, (20 << 8) + 110, 112), _defineProperty(_typeSpecificFieldMap, (21 << 8) + 110, 113), _typeSpecificFieldMap);

exports.default = {
	map: typeSpecificFieldMap,
	getFieldIDFromTypeAndBase: function getFieldIDFromTypeAndBase(typeId, fieldId) {
		typeId = typeof typeId === 'number' ? typeId : _itemTypes2.default[typeId];
		fieldId = typeof fieldId === 'number' ? fieldId : _fields2.default[fieldId];
		return typeSpecificFieldMap[(typeId << 8) + fieldId];
	}
};
module.exports = exports['default'];