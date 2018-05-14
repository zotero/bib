const lpad = require('./lpad');

module.exports = (date, toUTC) => {
	var year, month, day, hours, minutes, seconds;
	try {
		if(toUTC) {
			year = date.getUTCFullYear();
			month = date.getUTCMonth();
			day = date.getUTCDate();
			hours = date.getUTCHours();
			minutes = date.getUTCMinutes();
			seconds = date.getUTCSeconds();
		} else {
			year = date.getFullYear();
			month = date.getMonth();
			day = date.getDate();
			hours = date.getHours();
			minutes = date.getMinutes();
			seconds = date.getSeconds();
		}

		year = lpad(year, '0', 4);
		month = lpad(month + 1, '0', 2);
		day = lpad(day, '0', 2);
		hours = lpad(hours, '0', 2);
		minutes = lpad(minutes, '0', 2);
		seconds = lpad(seconds, '0', 2);

		return year + '-' + month + '-' + day + ' '
			+ hours + ':' + minutes + ':' + seconds;
	}
	catch (e) {
		return '';
	}
}
