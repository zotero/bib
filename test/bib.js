/* eslint-env node, karma,jasmine */
'use strict';

let ZoteroBib = require('../src/js/main.js');
let zoteroItemBook = require('./fixtures/zotero-item-book');
let zoteroItemPaper = require('./fixtures/zotero-item-paper');
let cslItemBook = require('./fixtures/csl-item-book');
let cslItemPaper = require('./fixtures/csl-item-paper');

describe('Zotero Bib', () => {
	var fakeStore,
		fetchRequests;

	beforeEach(() => {
		fakeStore = {};
		fetchRequests = [];

		spyOn(localStorage, 'getItem').and.callFake(key => {
			return fakeStore[key];
		});
		spyOn(localStorage, 'setItem').and.callFake((key, value) => {
			return fakeStore[key] = value + '';
		});
		spyOn(localStorage, 'clear').and.callFake(() => {
			fakeStore = {};
		});

		spyOn(window, 'fetch').and.callFake((url, init) => {
			fetchRequests.push({ url, init });
			let headersOK = new Headers({
				'Content-Type': 'application/json'
			})
			let headersBAD = new Headers({
				'Content-Type': 'text/plain'
			})

			try {
				if(JSON.parse(init.body).url.includes('book')) {
					return Promise.resolve(
						new Response(JSON.stringify([zoteroItemBook]), {
							headers: headersOK
						})
					);
				} else if(JSON.parse(init.body).url.includes('paper')) {
					return Promise.resolve(
						new Response(JSON.stringify([zoteroItemPaper]), {
							headers: headersOK
						})
					);
				} else {
					return Promise.resolve(
						new Response('{}', {
							status: 501,
							headers: headersBAD
						})
					);
				}
			} catch(e) {
				return Promise.resolve(
					new Response('{}', {
						status: 400,
						headers: headersBAD
					})
				);
			}
		});

	});


	it('should convert (Zotero -> CSL) initial items', () => {
		let bib = new ZoteroBib({
			persistInLocalStorage: false,
			initialItems: [zoteroItemBook]
		});
		expect(bib.items.length).toBe(1);
		expect(bib.items[0]).toEqual(cslItemBook);
	});

	it('should convert (Zotero -> CSL) manually added items', () => {
		let bib = new ZoteroBib({
			persistInLocalStorage: false
		});
		expect(bib.items.length).toBe(0);
		bib.addItem(zoteroItemBook);
		expect(bib.items.length).toBe(1);
		expect(bib.items[0]).toEqual(cslItemBook);
	});

	it('should allow removing items', () => {
		let bib = new ZoteroBib({
			persistInLocalStorage: false,
			initialItems: [zoteroItemBook]
		});
		expect(bib.items.length).toBe(1);
		bib.removeItem({}); //make sure it removes the right item
		expect(bib.items.length).toBe(1);
		bib.removeItem(bib.rawItems[0]);
		expect(bib.items.length).toBe(0);
	});

	it('should persist initial items in localStorage', () => {
		expect('items' in fakeStore).toBe(false);

		new ZoteroBib({
			persistInLocalStorage: true,
			initialItems: [zoteroItemBook]
		});

		expect('items' in fakeStore).toBe(true);
		expect(JSON.parse(fakeStore.items).length).toBe(1);
		expect(JSON.parse(fakeStore.items)[0]).toEqual(zoteroItemBook);
	});

	it('should load initial items from localStorage without overriding initial items', () => {
		fakeStore['items'] = JSON.stringify([zoteroItemPaper]);

		new ZoteroBib({
			persistInLocalStorage: true,
			initialItems: [zoteroItemBook]
		});

		expect(JSON.parse(fakeStore.items).length).toBe(2);
	});

	it('should persist manually added items in localStorage', () => {
		expect('items' in fakeStore).toBe(false);

		let bib = new ZoteroBib({
			persistInLocalStorage: true
		});

		expect(JSON.parse(fakeStore.items).length).toBe(0);
		bib.addItem(zoteroItemBook);
		expect(JSON.parse(fakeStore.items).length).toBe(1);
		expect(JSON.parse(fakeStore.items)[0]).toEqual(zoteroItemBook);
	});

	it('should persist remove items from localStorage', () => {
		expect('items' in fakeStore).toBe(false);

		let bib = new ZoteroBib({
			persistInLocalStorage: true,
			initialItems: [zoteroItemBook]
		});

		expect(JSON.parse(fakeStore.items).length).toBe(1);
		bib.removeItem(bib.rawItems[0]);
		expect(JSON.parse(fakeStore.items).length).toBe(0);
	});

	it('should translate an url using translation server', (done) => {
		let bib = new ZoteroBib({
			persistInLocalStorage: false
		});

		bib.translateUrl('http://example.com/paper').then(zoteroItems => {
			expect(fetchRequests.length).toBe(1);
			expect(zoteroItems.length).toBe(1);
			expect(zoteroItems[0]).toEqual(zoteroItemPaper);
			done();
		});
	});

	it('should should add a translated item', (done) => {
		let bib = new ZoteroBib({
			persistInLocalStorage: false
		});

		expect(bib.items.length).toBe(0);
		bib.translateUrl('http://example.com/paper').then(() => {
			expect(bib.items.length).toBe(1);
			expect(bib.items[0]).toEqual(cslItemPaper);
			done();
		}).catch(() => {
			fail();
			done();
		})
	});

	it('should shouldn\'t add an untranslatable item', (done) => {
		let bib = new ZoteroBib({
			persistInLocalStorage: false
		});

		expect(bib.items.length).toBe(0);
		bib.translateUrl('http://example.com/').then(result => {
			expect(bib.items.length).toBe(0);
			expect(result).toBe(false);
			done();
		}).catch(() => {
			fail();
			done();
		})
	});

	it('should expose CSL as a static proerty', () => {
		expect(ZoteroBib.CSL).toBeDefined();
	})
});
