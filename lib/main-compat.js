'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

require('es6-promise/auto');

require('isomorphic-fetch');

require('babel-regenerator-runtime');

var _bib = require('./bib/bib');

var _bib2 = _interopRequireDefault(_bib);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

exports.default = _bib2.default;
module.exports = exports['default'];