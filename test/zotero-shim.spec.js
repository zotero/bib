/* eslint-env node, mocha */
import { assert } from 'chai';
import strToDate from '../src/zotero-shim/str-to-date.js';
import itemToCSLJSON from '../src/zotero-shim/item-to-csl-json.js';
import zoteroItemBook from './fixtures/zotero-item-book.js';
import zoteroItemPaper from './fixtures/zotero-item-paper.js';
import cslItemBook from './fixtures/csl-item-book.js';
import cslItemPaper from './fixtures/csl-item-paper.js';

describe('Zotero Shim', () => {
	it('should convert date to CSL format', () => {
		assert.include(strToDate('22 feb 1955'),
			{ year: '1955', month: 1, day: 22 }
		);
		assert.include(strToDate('1st of may 1215'),
			{ year: '1215', month: 4, day: 1 }
		);
		assert.include(strToDate('today'), {
				year: (new Date()).getFullYear().toString(),
				month: (new Date()).getMonth(),
				day: (new Date()).getDate()
			}
		);
	});

	it('should convert Zotero Item format to CSL format', () => {
		assert.deepInclude(itemToCSLJSON(zoteroItemBook), cslItemBook);
		assert.deepInclude(itemToCSLJSON(zoteroItemPaper), cslItemPaper);
	});

	it('should convert ZoteroItem with partially empty creators field to CSL format', () => {
		assert.deepInclude(
			itemToCSLJSON({
				'key': 'ABCDABCD',
				'version': 0,
				'itemType': 'book',
				'creators': [{
					'firstName': '',
					'lastName': '',
					'creatorType': 'author'
				}],
				'title': 'Lorem Ipsum'
		}), {
			type: 'book',
			title: 'Lorem Ipsum',
			author: [ { family: '', given: '' } ]
		});
	});

	it('should port creator type when converting ZoteroItem ', () => {
		assert.deepInclude(
			itemToCSLJSON({
					'key': 'ABCDABCD',
					'version': 0,
					'itemType': 'artwork',
					'creators': [{
						'firstName': 'foo',
						'lastName': 'bar',
						'creatorType': 'artist'
					}],
					'title': 'Lorem Ipsum'
			}), {
				type: 'graphic',
				title: 'Lorem Ipsum',
				author: [ { family: 'bar', given: 'foo' } ]
			}
		);
	});
});
