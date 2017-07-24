'use strict';

const dateToSQL = require('./date-to-sql');

const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec', 'january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];

const _slashRe = /^(.*?)\b([0-9]{1,4})(?:([\-\/\.\u5e74])([0-9]{1,2}))?(?:([\-\/\.\u6708])([0-9]{1,4}))?((?:\b|[^0-9]).*?)$/
const _yearRe = /^(.*?)\b((?:circa |around |about |c\.? ?)?[0-9]{1,4}(?: ?B\.? ?C\.?(?: ?E\.?)?| ?C\.? ?E\.?| ?A\.? ?D\.?)|[0-9]{3,4})\b(.*?)$/i;
const _monthRe = new RegExp('^(.*)\\b(' + months.join('|') + ')[^ ]*(?: (.*)$|$)', 'i');
const _dayRe = new RegExp('\\b([0-9]{1,2})(?:st|nd|rd|th)?\\b(.*)', 'i');

const _insertDateOrderPart = (dateOrder, part, partOrder) => {
		if (!dateOrder) {
			return part;
		}
		if (partOrder.before === true) {
			return part + dateOrder;
		}
		if (partOrder.after === true) {
			return dateOrder + part;
		}
		if (partOrder.before) {
			let pos = dateOrder.indexOf(partOrder.before);
			if (pos == -1) {
				return dateOrder;
			}
			return dateOrder.replace(new RegExp('(' + partOrder.before + ')'), part + '$1');
		}
		if (partOrder.after) {
			let pos = dateOrder.indexOf(partOrder.after);
			if (pos == -1) {
				return dateOrder + part;
			}
			return dateOrder.replace(new RegExp('(' + partOrder.after + ')'), '$1' + part);
		}
		return dateOrder + part;
}

module.exports = string => {
	var date = {
		order: ''
	};

	// skip empty things
	if(!string) {
		return date;
	}

	var parts = [];

	// Parse 'yesterday'/'today'/'tomorrow'
	let lc = (string + '').toLowerCase();
	if (lc == 'yesterday') {
		string = dateToSQL(new Date(Date.now() - 1000*60*60*24)).substr(0, 10);
	}
	else if (lc == 'today') {
		string = dateToSQL(new Date()).substr(0, 10);
	}
	else if (lc == 'tomorrow') {
		string = dateToSQL(new Date(Date.now() + 1000*60*60*24)).substr(0, 10);
	}
	else {
		string = string.toString().replace(/^\s+|\s+$/g, '').replace(/\s+/, ' ');
	}

	// first, directly inspect the string
	let m = _slashRe.exec(string);
	if(m &&
		((!m[5] || !m[3]) || m[3] == m[5] || (m[3] == '\u5e74' && m[5] == '\u6708')) &&	// require sane separators
		((m[2] && m[4] && m[6]) || (!m[1] && !m[7]))) {						// require that either all parts are found,
																			// or else this is the entire date field
		// figure out date based on parts
		if(m[2].length == 3 || m[2].length == 4 || m[3] == '\u5e74') {
			// ISO 8601 style date (big endian)
			date.year = m[2];
			date.month = m[4];
			date.day = m[6];
			date.order += m[2] ? 'y' : '';
			date.order += m[4] ? 'm' : '';
			date.order += m[6] ? 'd' : '';
		} else if(m[2] && !m[4] && m[6]) {
			date.month = m[2];
			date.year = m[6];
			date.order += m[2] ? 'm' : '';
			date.order += m[6] ? 'y' : '';
		} else {
			// local style date (middle or little endian)
			var country = window.navigator.language ? window.navigator.language.substr(3) : 'US';
			if(country == 'US' ||	// The United States
				country == 'FM' ||	// The Federated States of Micronesia
				country == 'PW' ||	// Palau
				country == 'PH') {	// The Philippines
					date.month = m[2];
					date.day = m[4];
					date.order += m[2] ? 'm' : '';
					date.order += m[4] ? 'd' : '';
			} else {
				date.month = m[4];
				date.day = m[2];
				date.order += m[2] ? 'd' : '';
				date.order += m[4] ? 'm' : '';
			}
			date.year = m[6];
			date.order += 'y';
		}

		if(date.year) {
			date.year = parseInt(date.year, 10);
		}
		if(date.day) {
			date.day = parseInt(date.day, 10);
		}
		if(date.month) {
			date.month = parseInt(date.month, 10);

			if(date.month > 12) {
				// swap day and month
				var tmp = date.day;
				date.day = date.month
				date.month = tmp;
				date.order = date.order.replace('m', 'D')
					.replace('d', 'M')
					.replace('D', 'd')
					.replace('M', 'm');
			}
		}

		if((!date.month || date.month <= 12) && (!date.day || date.day <= 31)) {
			if(date.year && date.year < 100) {	// for two digit years, determine proper
												// four digit year
				var today = new Date();
				var year = today.getFullYear();
				var twoDigitYear = year % 100;
				var century = year - twoDigitYear;

				if(date.year <= twoDigitYear) {
					// assume this date is from our century
					date.year = century + date.year;
				} else {
					// assume this date is from the previous century
					date.year = century - 100 + date.year;
				}
			}

			if(date.month) {
				date.month--;		// subtract one for JS style
			} else {
				delete date.month;
			}

			parts.push(
				{ part: m[1], before: true },
				{ part: m[7] }
			);
		} else {
			var date = {
				order: ''
			};
			parts.push({ part: string });
		}
	} else {
		parts.push({ part: string });
	}

	// couldn't find something with the algorithms; use regexp
	// YEAR
	if(!date.year) {
		for (let i in parts) {
			let m = _yearRe.exec(parts[i].part);
			if (m) {
				date.year = m[2];
				date.order = _insertDateOrderPart(date.order, 'y', parts[i]);
				parts.splice(
					i, 1,
					{ part: m[1], before: true },
					{ part: m[3] }
				);
				break;
			}
		}
	}

	// MONTH
	if(date.month === undefined) {
		for (let i in parts) {
			let m = _monthRe.exec(parts[i].part);
			if (m) {
				// Modulo 12 in case we have multiple languages
				date.month = months.indexOf(m[2].toLowerCase()) % 12;
				date.order = _insertDateOrderPart(date.order, 'm', parts[i]);
				parts.splice(
					i, 1,
					{ part: m[1], before: 'm' },
					{ part: m[3], after: 'm' }
				);
				break;
			}
		}
	}

	// DAY
	if(!date.day) {
		// compile day regular expression
		for (let i in parts) {
			let m = _dayRe.exec(parts[i].part);
			if (m) {
				var day = parseInt(m[1], 10),
					part;
				// Sanity check
				if (day <= 31) {
					date.day = day;
					date.order = _insertDateOrderPart(date.order, 'd', parts[i]);
					if(m.index > 0) {
						part = parts[i].part.substr(0, m.index);
						if(m[2]) {
							part += ' ' + m[2];
						}
					} else {
						part = m[2];
					}
					parts.splice(
						i, 1,
						{ part: part }
					);
					break;
				}
			}
		}
	}

	// Concatenate date parts
	date.part = '';
	for (var i in parts) {
		date.part += parts[i].part + ' ';
	}

	// clean up date part
	if(date.part) {
		date.part = date.part.replace(/^[^A-Za-z0-9]+|[^A-Za-z0-9]+$/g, '');
	}

	if(date.part === '' || date.part == undefined) {
		delete date.part;
	}

	//make sure year is always a string
	if(date.year || date.year === 0) date.year += '';

	return date;
}
