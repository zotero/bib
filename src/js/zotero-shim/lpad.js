'use strict';

export default (string, pad, length) => {
	string = string ? string + '' : '';
	while(string.length < length) {
		string = pad + string;
	}
	return string;
}
