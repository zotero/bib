export default () => ({
	translateURL: typeof window != 'undefined' && window.location.origin || '',
	translatePrefix: '',
	fetchConfig: {},
	initialItems: [],
	request: {},
	storage: typeof window != 'undefined' && 'localStorage' in window && window.localStorage || {},
	persist: true,
	override: false,
	storagePrefix: 'zotero-bib'
});
