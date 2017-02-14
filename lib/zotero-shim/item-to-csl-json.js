'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});

var _cslMappings = require('./csl-mappings');

var _citeprocJs = require('citeproc-js');

var _typeSpecificFieldMap = require('./type-specific-field-map');

var _fields2 = require('./fields');

var _fields3 = _interopRequireDefault(_fields2);

var _itemTypes = require('./item-types');

var _itemTypes2 = _interopRequireDefault(_itemTypes);

var _strToDate = require('./str-to-date');

var _strToDate2 = _interopRequireDefault(_strToDate);

var _defaultItemTypeCreatorTypeLookup = require('./default-item-type-creator-type-lookup');

var _defaultItemTypeCreatorTypeLookup2 = _interopRequireDefault(_defaultItemTypeCreatorTypeLookup);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

exports.default = function (zoteroItem) {
	var cslType = _cslMappings.CSL_TYPE_MAPPINGS[zoteroItem.itemType];
	if (!cslType) {
		throw new Error('Unexpected Zotero Item type "' + zoteroItem.itemType + '"');
	}

	var itemTypeID = _itemTypes2.default[zoteroItem.itemType];

	var cslItem = {
		// 'id':zoteroItem.uri,
		id: zoteroItem.itemKey,
		'type': cslType
	};

	// get all text variables (there must be a better way)
	for (var variable in _cslMappings.CSL_TEXT_MAPPINGS) {
		var _fields = _cslMappings.CSL_TEXT_MAPPINGS[variable];
		for (var i = 0, n = _fields.length; i < n; i++) {
			var field = _fields[i],
			    value = null;

			if (field in zoteroItem) {
				value = zoteroItem[field];
			} else {
				// @NOTE: Does this need porting?
				// if (field == 'versionNumber') {
				// 	field = 'version'; // Until https://github.com/zotero/zotero/issues/670
				// }
				// var fieldID = Zotero.ItemFields.getID(field),
				// 	typeFieldID;
				// if(fieldID
				// 	&& (typeFieldID = Zotero.ItemFields.getFieldIDFromTypeAndBase(itemTypeID, fieldID))
				// ) {
				// 	value = zoteroItem[Zotero.ItemFields.getName(typeFieldID)];
				// }
			}

			if (!value) continue;

			if (typeof value == 'string') {
				if (field == 'ISBN') {
					// Only use the first ISBN in CSL JSON
					var isbn = value.match(/^(?:97[89]-?)?(?:\d-?){9}[\dx](?!-)\b/i);
					if (isbn) {
						value = isbn[0];
					}
				}

				// Strip enclosing quotes
				if (value.charAt(0) == '"' && value.indexOf('"', 1) == value.length - 1) {
					value = value.substring(1, value.length - 1);
				}
				cslItem[variable] = value;
				break;
			}
		}
	}

	// separate name variables
	if (zoteroItem.type != 'attachment' && zoteroItem.type != 'note') {
		// var author = Zotero.CreatorTypes.getName(Zotero.CreatorTypes.getPrimaryIDForType());
		var author = _defaultItemTypeCreatorTypeLookup2.default[itemTypeID];
		var creators = zoteroItem.creators;
		for (var _i = 0; creators && _i < creators.length; _i++) {
			var creator = creators[_i];
			var creatorType = creator.creatorType;
			var nameObj = void 0;

			if (creatorType == author) {
				creatorType = 'author';
			}

			creatorType = _cslMappings.CSL_NAMES_MAPPINGS[creatorType];
			if (!creatorType) {
				continue;
			}

			if (creator.lastName || creator.firstName) {
				nameObj = {
					family: creator.lastName || '',
					given: creator.firstName || ''
				};

				// Parse name particles
				// Replicate citeproc-js logic for what should be parsed so we don't
				// break current behavior.
				if (nameObj.family && nameObj.given) {
					// Don't parse if last name is quoted
					if (nameObj.family.length > 1 && nameObj.family.charAt(0) == '"' && nameObj.family.charAt(nameObj.family.length - 1) == '"') {
						nameObj.family = nameObj.family.substr(1, nameObj.family.length - 2);
					} else {
						_citeprocJs.CSL.parseParticles(nameObj, true);
					}
				}
			} else if (creator.name) {
				nameObj = { 'literal': creator.name };
			}

			if (cslItem[creatorType]) {
				cslItem[creatorType].push(nameObj);
			} else {
				cslItem[creatorType] = [nameObj];
			}
		}
	}

	// get date variables
	for (var _variable in _cslMappings.CSL_DATE_MAPPINGS) {
		var date = zoteroItem[_cslMappings.CSL_DATE_MAPPINGS[_variable]];
		if (!date) {

			var typeSpecificFieldID = (0, _typeSpecificFieldMap.getFieldIDFromTypeAndBase)(itemTypeID, _cslMappings.CSL_DATE_MAPPINGS[_variable]);
			if (typeSpecificFieldID) {
				date = zoteroItem[_fields3.default[typeSpecificFieldID]];
			}
		}

		if (date) {
			var dateObj = (0, _strToDate2.default)(date);
			// otherwise, use date-parts
			var dateParts = [];
			if (dateObj.year) {
				// add year, month, and day, if they exist
				dateParts.push(dateObj.year);
				if (dateObj.month !== undefined) {
					dateParts.push(dateObj.month + 1);
					if (dateObj.day) {
						dateParts.push(dateObj.day);
					}
				}
				cslItem[_variable] = { 'date-parts': [dateParts] };

				// if no month, use season as month
				if (dateObj.part && dateObj.month === undefined) {
					cslItem[_variable].season = dateObj.part;
				}
			} else {
				// if no year, pass date literally
				cslItem[_variable] = { 'literal': date };
			}
		}
	}

	// Special mapping for note title
	// @NOTE: Not ported
	// if (zoteroItem.itemType == 'note' && zoteroItem.note) {
	// 	cslItem.title = Zotero.Notes.noteToTitle(zoteroItem.note);
	// }

	//this._cache[zoteroItem.id] = cslItem;
	return cslItem;
};

module.exports = exports['default'];