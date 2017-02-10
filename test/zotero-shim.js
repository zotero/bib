/* eslint-env node, karma,jasmine */
'use strict';

let strToDate = require('../src/js/zotero/str-to-date');
let itemToCSLJSON = require('../src/js/zotero/item-to-csl-json');
let zoteroItemBook = require('./fixtures/zotero-item-book');
let zoteroItemPaper = require('./fixtures/zotero-item-paper');

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
		expect(itemToCSLJSON(zoteroItemBook)).toEqual(
			jasmine.objectContaining({
				type: 'book',
				title: 'Dune',
				publisher: 'Hodder Paperbacks',
				'number-of-pages': '608',
				edition: '2 edition',
				source: 'Amazon',
				ISBN: '9780450011849',
				author: [ { family: 'Herbert', given: 'Frank' } ],
				issued: {
					'date-parts': [ [ '1982', 2, 1 ]]
				}
			})
		);

		expect(itemToCSLJSON(zoteroItemPaper)).toEqual(
			jasmine.objectContaining({
				type: 'article-journal',
				title: 'Scalable-manufactured randomized glass-polymer hybrid metamaterial for daytime radiative cooling',
				'container-title': 'Science',
				page: 'eaai7899',
				source: 'science.sciencemag.org',
				abstract: 'Passive radiative cooling draws heat from surfaces and radiates it into space as infrared radiation to which the atmosphere is transparent. However, the energy density mismatch between solar irradiance and the low infrared radiation flux from a near-ambient-temperature surface require materials that strongly emit thermal energy and barely absorb sunlight. We embedded resonant polar dielectric microspheres randomly in a polymeric matrix, resulting in a metamaterial that is fully transparent to the solar spectrum while having an infrared emissivity greater than 0.93 across the atmospheric window. When backed with silver coating, the metamaterial shows a noon-time radiative cooling power of 93 W/m2 under direct sunshine. More critically, we demonstrated high-throughput, economical roll-to-roll manufacturing of the metamaterial, vital for promoting radiative cooling as a viable energy technology.',
				URL: 'http://science.sciencemag.org/content/early/2017/02/08/science.aai7899',
				DOI: '10.1126/science.aai7899',
				ISSN: '0036-8075, 1095-9203',
				language: 'en',
				author: [ { family: 'Zhai', given: 'Yao' }, { family: 'Ma', given: 'Yaoguang' }, { family: 'David', given: 'Sabrina N.' }, { family: 'Zhao', given: 'Dongliang' }, { family: 'Lou', given: 'Runnan' }, { family: 'Tan', given: 'Gang' }, { family: 'Yang', given: 'Ronggui' }, { family: 'Yin', given: 'Xiaobo' } ], issued: { 'date-parts': [ [ '2017', 2, 9 ] ] }
			})
		);
	});
});
