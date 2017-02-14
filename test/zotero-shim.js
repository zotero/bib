/* eslint-env node, karma,jasmine */
'use strict';

let strToDate = require('../src/js/zotero-shim/str-to-date');
let itemToCSLJSON = require('../src/js/zotero-shim/item-to-csl-json');
let zoteroItemBook = require('./fixtures/zotero-item-book');
let zoteroItemPaper = require('./fixtures/zotero-item-paper');
let cslItemBook = require('./fixtures/csl-item-book');
let cslItemPaper = require('./fixtures/csl-item-paper');

describe('Zotero Shim', () => {
	it('should convert date to CSL format', () => {
		expect(strToDate('22 feb 1955')).toEqual(
			jasmine.objectContaining({year: '1955', month: 1, day: 22 })
		);
		expect(strToDate('1st of may 1215')).toEqual(
			jasmine.objectContaining({year: '1215', month: 4, day: 1 })
		);
		expect(strToDate('today')).toEqual(
			jasmine.objectContaining({
				year: (new Date()).getFullYear().toString(),
				month: (new Date()).getMonth(),
				day: (new Date()).getDate()
			})
		);
	});

	it('should convert Zotero Item format to CSL format', () => {
		expect(itemToCSLJSON(zoteroItemBook)).toEqual(cslItemBook);
		expect(itemToCSLJSON(zoteroItemPaper)).toEqual(cslItemPaper);
	});
});
