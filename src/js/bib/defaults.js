export default {
	translationServerUrl: typeof window != 'undefined' && window.location.origin || '',
	init: {},
	request: {},
	persistInLocalStorage: true
}
