'use strict';

module.exports = {
	isLikeZoteroItem: item => item && typeof item === 'object' && 'itemType' in item
}
