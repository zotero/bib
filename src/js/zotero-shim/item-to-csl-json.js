'use strict';

const {
	CSL_NAMES_MAPPINGS,
	CSL_TEXT_MAPPINGS,
	CSL_DATE_MAPPINGS,
	CSL_TYPE_MAPPINGS
} = require('./csl-mappings');

const { CSL } = require('citeproc-js');
const { getFieldIDFromTypeAndBase } = require('./type-specific-field-map');
const fields = require('./fields');
const itemTypes = require('./item-types');
const strToDate = require('./str-to-date');
const defaultItemTypeCreatorTypeLookup = require('./default-item-type-creator-type-lookup');

module.exports = zoteroItem => {
	var cslType = CSL_TYPE_MAPPINGS[zoteroItem.itemType];
	if (!cslType) {
		throw new Error('Unexpected Zotero Item type "' + zoteroItem.itemType + '"');
	}

	var itemTypeID = itemTypes[zoteroItem.itemType];

	var cslItem = {
		// 'id':zoteroItem.uri,
		id: zoteroItem.itemKey,
		'type':cslType
	};

	// get all text variables (there must be a better way)
	for(let variable in CSL_TEXT_MAPPINGS) {
		let fields = CSL_TEXT_MAPPINGS[variable];
		for(let i=0, n=fields.length; i<n; i++) {
			let field = fields[i],
				value = null;

			if(field in zoteroItem) {
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
					if(isbn) {
						value = isbn[0];
					}
				}

				// Strip enclosing quotes
				if(value.charAt(0) == '"' && value.indexOf('"', 1) == value.length - 1) {
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
		let author = defaultItemTypeCreatorTypeLookup[itemTypeID];
		let creators = zoteroItem.creators;
		for(let i = 0; creators && i < creators.length; i++) {
			let creator = creators[i];
			let creatorType = creator.creatorType;
			let nameObj;

			if(creatorType == author) {
				creatorType = 'author';
			}

			creatorType = CSL_NAMES_MAPPINGS[creatorType];
			if(!creatorType) {
				continue;
			}

			if ('lastName' in creator || 'firstName' in creator) {
				nameObj = {
					family: creator.lastName || '',
					given: creator.firstName || ''
				};

				// Parse name particles
				// Replicate citeproc-js logic for what should be parsed so we don't
				// break current behavior.
				if (nameObj.family && nameObj.given) {
					// Don't parse if last name is quoted
					if (nameObj.family.length > 1
						&& nameObj.family.charAt(0) == '"'
						&& nameObj.family.charAt(nameObj.family.length - 1) == '"'
					) {
						nameObj.family = nameObj.family.substr(1, nameObj.family.length - 2);
					} else {
						CSL.parseParticles(nameObj, true);
					}
				}
			} else if ('name' in creator) {
				nameObj = {'literal': creator.name};
			}

			if(cslItem[creatorType]) {
				cslItem[creatorType].push(nameObj);
			} else {
				cslItem[creatorType] = [nameObj];
			}
		}
	}

	// get date variables
	for(let variable in CSL_DATE_MAPPINGS) {
		let date = zoteroItem[CSL_DATE_MAPPINGS[variable]];
		if (!date) {

			let typeSpecificFieldID = getFieldIDFromTypeAndBase(itemTypeID, CSL_DATE_MAPPINGS[variable]);
			if (typeSpecificFieldID) {
				date = zoteroItem[fields[typeSpecificFieldID]];
			}
		}

		if(date) {
			let dateObj = strToDate(date);
			// otherwise, use date-parts
			let dateParts = [];
			if(dateObj.year) {
				// add year, month, and day, if they exist
				dateParts.push(dateObj.year);
				if(dateObj.month !== undefined) {
					dateParts.push(dateObj.month+1);
					if(dateObj.day) {
						dateParts.push(dateObj.day);
					}
				}
				cslItem[variable] = {'date-parts':[dateParts]};

				// if no month, use season as month
				if(dateObj.part && dateObj.month === undefined) {
					cslItem[variable].season = dateObj.part;
				}
			} else {
				// if no year, pass date literally
				cslItem[variable] = {'literal':date};
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
}
