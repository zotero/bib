'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _utils = require('./utils');

var _utils2 = _interopRequireDefault(_utils);

var _defaults = require('./defaults');

var _defaults2 = _interopRequireDefault(_defaults);

var _citeprocJs = require('citeproc-js');

var _itemToCslJson = require('../zotero-shim/item-to-csl-json');

var _itemToCslJson2 = _interopRequireDefault(_itemToCslJson);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _asyncToGenerator(fn) { return function () { var gen = fn.apply(this, arguments); return new Promise(function (resolve, reject) { function step(key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { return Promise.resolve(value).then(function (value) { step("next", value); }, function (err) { step("throw", err); }); } } return step("next"); }); }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var ZoteroBib = function () {
	function ZoteroBib(opts) {
		_classCallCheck(this, ZoteroBib);

		this.opts = Object.assign({
			sessionid: _utils2.default.uuid4()
		}, _defaults2.default, opts);

		this._items = this.opts.initialItems || [];
		if (this.opts.persistInLocalStorage) {
			this._items = this._items.concat(this.getItemsLocalStorage());
			this.setItemsLocalStorage(this._items);
		}
	}

	_createClass(ZoteroBib, [{
		key: 'getItemsLocalStorage',
		value: function getItemsLocalStorage() {
			var items = localStorage.getItem('items');
			if (items) {
				return JSON.parse(items);
			} else {
				return [];
			}
		}
	}, {
		key: 'setItemsLocalStorage',
		value: function setItemsLocalStorage(items) {
			localStorage.setItem('items', JSON.stringify(items));
		}
	}, {
		key: 'addItem',
		value: function addItem(item) {
			this._items.push(item);
			if (this.opts.persistInLocalStorage) {
				this.setItemsLocalStorage(this._items);
			}
		}
	}, {
		key: 'removeItem',
		value: function removeItem(item) {
			var index = this._items.indexOf(item);
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
	}, {
		key: 'clearItems',
		value: function clearItems() {
			this._items = [];
			if (this.opts.persistInLocalStorage) {
				this.setItemsLocalStorage(this._items);
			}
		}
	}, {
		key: 'translateUrl',
		value: function () {
			var _ref = _asyncToGenerator(regeneratorRuntime.mark(function _callee(url) {
				var add = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : true;
				var translationServerUrl, sessionid, data, init, response, items;
				return regeneratorRuntime.wrap(function _callee$(_context) {
					while (1) {
						switch (_context.prev = _context.next) {
							case 0:
								translationServerUrl = this.opts.translationServerUrl + '/web';
								sessionid = this.opts.sessionid;
								data = Object.assign({ url: url, sessionid: sessionid }, this.opts.request);
								init = Object.assign({
									method: 'POST',
									headers: {
										'Content-Type': 'application/json'
									},
									body: JSON.stringify(data)
								}, this.opts.init);
								_context.next = 6;
								return fetch(translationServerUrl, init);

							case 6:
								response = _context.sent;
								_context.next = 9;
								return response.json();

							case 9:
								items = _context.sent;

								if (Array.isArray(items) && add) {
									items.forEach(this.addItem.bind(this));
								}

								return _context.abrupt('return', Array.isArray(items) && items || false);

							case 12:
							case 'end':
								return _context.stop();
						}
					}
				}, _callee, this);
			}));

			function translateUrl(_x) {
				return _ref.apply(this, arguments);
			}

			return translateUrl;
		}()
	}, {
		key: 'items',
		get: function get() {
			return this._items.map(function (i) {
				return (0, _itemToCslJson2.default)(i);
			});
		}
	}, {
		key: 'rawItems',
		get: function get() {
			return this._items;
		}
	}], [{
		key: 'CSL',
		get: function get() {
			return _citeprocJs.CSL;
		}
	}]);

	return ZoteroBib;
}();

exports.default = ZoteroBib;
module.exports = exports['default'];