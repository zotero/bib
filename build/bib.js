(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.ZoteroBib = f()}})(function(){var define,module,exports;return (function(){function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s}return e})()({1:[function(require,module,exports){
'use strict';

var qs = require('querystring')
  , url = require('url')
  , xtend = require('xtend');

function hasRel(x) {
  return x && x.rel;
}

function intoRels (acc, x) {
  function splitRel (rel) {
    acc[rel] = xtend(x, { rel: rel });
  }

  x.rel.split(/\s+/).forEach(splitRel);

  return acc;
}

function createObjects (acc, p) {
  // rel="next" => 1: rel 2: next
  var m = p.match(/\s*(.+)\s*=\s*"?([^"]+)"?/)
  if (m) acc[m[1]] = m[2];
  return acc;
}

function parseLink(link) {
  try {
    var m         =  link.match(/<?([^>]*)>(.*)/)
      , linkUrl   =  m[1]
      , parts     =  m[2].split(';')
      , parsedUrl =  url.parse(linkUrl)
      , qry       =  qs.parse(parsedUrl.query);

    parts.shift();

    var info = parts
      .reduce(createObjects, {});
    
    info = xtend(qry, info);
    info.url = linkUrl;
    return info;
  } catch (e) {
    return null;
  }
}

module.exports = function (linkHeader) {
  if (!linkHeader) return null;

  return linkHeader.split(/,\s*</)
   .map(parseLink)
   .filter(hasRel)
   .reduce(intoRels, {});
};

},{"querystring":5,"url":6,"xtend":8}],2:[function(require,module,exports){
(function (global){
/*! https://mths.be/punycode v1.4.1 by @mathias */
;(function(root) {

	/** Detect free variables */
	var freeExports = typeof exports == 'object' && exports &&
		!exports.nodeType && exports;
	var freeModule = typeof module == 'object' && module &&
		!module.nodeType && module;
	var freeGlobal = typeof global == 'object' && global;
	if (
		freeGlobal.global === freeGlobal ||
		freeGlobal.window === freeGlobal ||
		freeGlobal.self === freeGlobal
	) {
		root = freeGlobal;
	}

	/**
	 * The `punycode` object.
	 * @name punycode
	 * @type Object
	 */
	var punycode,

	/** Highest positive signed 32-bit float value */
	maxInt = 2147483647, // aka. 0x7FFFFFFF or 2^31-1

	/** Bootstring parameters */
	base = 36,
	tMin = 1,
	tMax = 26,
	skew = 38,
	damp = 700,
	initialBias = 72,
	initialN = 128, // 0x80
	delimiter = '-', // '\x2D'

	/** Regular expressions */
	regexPunycode = /^xn--/,
	regexNonASCII = /[^\x20-\x7E]/, // unprintable ASCII chars + non-ASCII chars
	regexSeparators = /[\x2E\u3002\uFF0E\uFF61]/g, // RFC 3490 separators

	/** Error messages */
	errors = {
		'overflow': 'Overflow: input needs wider integers to process',
		'not-basic': 'Illegal input >= 0x80 (not a basic code point)',
		'invalid-input': 'Invalid input'
	},

	/** Convenience shortcuts */
	baseMinusTMin = base - tMin,
	floor = Math.floor,
	stringFromCharCode = String.fromCharCode,

	/** Temporary variable */
	key;

	/*--------------------------------------------------------------------------*/

	/**
	 * A generic error utility function.
	 * @private
	 * @param {String} type The error type.
	 * @returns {Error} Throws a `RangeError` with the applicable error message.
	 */
	function error(type) {
		throw new RangeError(errors[type]);
	}

	/**
	 * A generic `Array#map` utility function.
	 * @private
	 * @param {Array} array The array to iterate over.
	 * @param {Function} callback The function that gets called for every array
	 * item.
	 * @returns {Array} A new array of values returned by the callback function.
	 */
	function map(array, fn) {
		var length = array.length;
		var result = [];
		while (length--) {
			result[length] = fn(array[length]);
		}
		return result;
	}

	/**
	 * A simple `Array#map`-like wrapper to work with domain name strings or email
	 * addresses.
	 * @private
	 * @param {String} domain The domain name or email address.
	 * @param {Function} callback The function that gets called for every
	 * character.
	 * @returns {Array} A new string of characters returned by the callback
	 * function.
	 */
	function mapDomain(string, fn) {
		var parts = string.split('@');
		var result = '';
		if (parts.length > 1) {
			// In email addresses, only the domain name should be punycoded. Leave
			// the local part (i.e. everything up to `@`) intact.
			result = parts[0] + '@';
			string = parts[1];
		}
		// Avoid `split(regex)` for IE8 compatibility. See #17.
		string = string.replace(regexSeparators, '\x2E');
		var labels = string.split('.');
		var encoded = map(labels, fn).join('.');
		return result + encoded;
	}

	/**
	 * Creates an array containing the numeric code points of each Unicode
	 * character in the string. While JavaScript uses UCS-2 internally,
	 * this function will convert a pair of surrogate halves (each of which
	 * UCS-2 exposes as separate characters) into a single code point,
	 * matching UTF-16.
	 * @see `punycode.ucs2.encode`
	 * @see <https://mathiasbynens.be/notes/javascript-encoding>
	 * @memberOf punycode.ucs2
	 * @name decode
	 * @param {String} string The Unicode input string (UCS-2).
	 * @returns {Array} The new array of code points.
	 */
	function ucs2decode(string) {
		var output = [],
		    counter = 0,
		    length = string.length,
		    value,
		    extra;
		while (counter < length) {
			value = string.charCodeAt(counter++);
			if (value >= 0xD800 && value <= 0xDBFF && counter < length) {
				// high surrogate, and there is a next character
				extra = string.charCodeAt(counter++);
				if ((extra & 0xFC00) == 0xDC00) { // low surrogate
					output.push(((value & 0x3FF) << 10) + (extra & 0x3FF) + 0x10000);
				} else {
					// unmatched surrogate; only append this code unit, in case the next
					// code unit is the high surrogate of a surrogate pair
					output.push(value);
					counter--;
				}
			} else {
				output.push(value);
			}
		}
		return output;
	}

	/**
	 * Creates a string based on an array of numeric code points.
	 * @see `punycode.ucs2.decode`
	 * @memberOf punycode.ucs2
	 * @name encode
	 * @param {Array} codePoints The array of numeric code points.
	 * @returns {String} The new Unicode string (UCS-2).
	 */
	function ucs2encode(array) {
		return map(array, function(value) {
			var output = '';
			if (value > 0xFFFF) {
				value -= 0x10000;
				output += stringFromCharCode(value >>> 10 & 0x3FF | 0xD800);
				value = 0xDC00 | value & 0x3FF;
			}
			output += stringFromCharCode(value);
			return output;
		}).join('');
	}

	/**
	 * Converts a basic code point into a digit/integer.
	 * @see `digitToBasic()`
	 * @private
	 * @param {Number} codePoint The basic numeric code point value.
	 * @returns {Number} The numeric value of a basic code point (for use in
	 * representing integers) in the range `0` to `base - 1`, or `base` if
	 * the code point does not represent a value.
	 */
	function basicToDigit(codePoint) {
		if (codePoint - 48 < 10) {
			return codePoint - 22;
		}
		if (codePoint - 65 < 26) {
			return codePoint - 65;
		}
		if (codePoint - 97 < 26) {
			return codePoint - 97;
		}
		return base;
	}

	/**
	 * Converts a digit/integer into a basic code point.
	 * @see `basicToDigit()`
	 * @private
	 * @param {Number} digit The numeric value of a basic code point.
	 * @returns {Number} The basic code point whose value (when used for
	 * representing integers) is `digit`, which needs to be in the range
	 * `0` to `base - 1`. If `flag` is non-zero, the uppercase form is
	 * used; else, the lowercase form is used. The behavior is undefined
	 * if `flag` is non-zero and `digit` has no uppercase form.
	 */
	function digitToBasic(digit, flag) {
		//  0..25 map to ASCII a..z or A..Z
		// 26..35 map to ASCII 0..9
		return digit + 22 + 75 * (digit < 26) - ((flag != 0) << 5);
	}

	/**
	 * Bias adaptation function as per section 3.4 of RFC 3492.
	 * https://tools.ietf.org/html/rfc3492#section-3.4
	 * @private
	 */
	function adapt(delta, numPoints, firstTime) {
		var k = 0;
		delta = firstTime ? floor(delta / damp) : delta >> 1;
		delta += floor(delta / numPoints);
		for (/* no initialization */; delta > baseMinusTMin * tMax >> 1; k += base) {
			delta = floor(delta / baseMinusTMin);
		}
		return floor(k + (baseMinusTMin + 1) * delta / (delta + skew));
	}

	/**
	 * Converts a Punycode string of ASCII-only symbols to a string of Unicode
	 * symbols.
	 * @memberOf punycode
	 * @param {String} input The Punycode string of ASCII-only symbols.
	 * @returns {String} The resulting string of Unicode symbols.
	 */
	function decode(input) {
		// Don't use UCS-2
		var output = [],
		    inputLength = input.length,
		    out,
		    i = 0,
		    n = initialN,
		    bias = initialBias,
		    basic,
		    j,
		    index,
		    oldi,
		    w,
		    k,
		    digit,
		    t,
		    /** Cached calculation results */
		    baseMinusT;

		// Handle the basic code points: let `basic` be the number of input code
		// points before the last delimiter, or `0` if there is none, then copy
		// the first basic code points to the output.

		basic = input.lastIndexOf(delimiter);
		if (basic < 0) {
			basic = 0;
		}

		for (j = 0; j < basic; ++j) {
			// if it's not a basic code point
			if (input.charCodeAt(j) >= 0x80) {
				error('not-basic');
			}
			output.push(input.charCodeAt(j));
		}

		// Main decoding loop: start just after the last delimiter if any basic code
		// points were copied; start at the beginning otherwise.

		for (index = basic > 0 ? basic + 1 : 0; index < inputLength; /* no final expression */) {

			// `index` is the index of the next character to be consumed.
			// Decode a generalized variable-length integer into `delta`,
			// which gets added to `i`. The overflow checking is easier
			// if we increase `i` as we go, then subtract off its starting
			// value at the end to obtain `delta`.
			for (oldi = i, w = 1, k = base; /* no condition */; k += base) {

				if (index >= inputLength) {
					error('invalid-input');
				}

				digit = basicToDigit(input.charCodeAt(index++));

				if (digit >= base || digit > floor((maxInt - i) / w)) {
					error('overflow');
				}

				i += digit * w;
				t = k <= bias ? tMin : (k >= bias + tMax ? tMax : k - bias);

				if (digit < t) {
					break;
				}

				baseMinusT = base - t;
				if (w > floor(maxInt / baseMinusT)) {
					error('overflow');
				}

				w *= baseMinusT;

			}

			out = output.length + 1;
			bias = adapt(i - oldi, out, oldi == 0);

			// `i` was supposed to wrap around from `out` to `0`,
			// incrementing `n` each time, so we'll fix that now:
			if (floor(i / out) > maxInt - n) {
				error('overflow');
			}

			n += floor(i / out);
			i %= out;

			// Insert `n` at position `i` of the output
			output.splice(i++, 0, n);

		}

		return ucs2encode(output);
	}

	/**
	 * Converts a string of Unicode symbols (e.g. a domain name label) to a
	 * Punycode string of ASCII-only symbols.
	 * @memberOf punycode
	 * @param {String} input The string of Unicode symbols.
	 * @returns {String} The resulting Punycode string of ASCII-only symbols.
	 */
	function encode(input) {
		var n,
		    delta,
		    handledCPCount,
		    basicLength,
		    bias,
		    j,
		    m,
		    q,
		    k,
		    t,
		    currentValue,
		    output = [],
		    /** `inputLength` will hold the number of code points in `input`. */
		    inputLength,
		    /** Cached calculation results */
		    handledCPCountPlusOne,
		    baseMinusT,
		    qMinusT;

		// Convert the input in UCS-2 to Unicode
		input = ucs2decode(input);

		// Cache the length
		inputLength = input.length;

		// Initialize the state
		n = initialN;
		delta = 0;
		bias = initialBias;

		// Handle the basic code points
		for (j = 0; j < inputLength; ++j) {
			currentValue = input[j];
			if (currentValue < 0x80) {
				output.push(stringFromCharCode(currentValue));
			}
		}

		handledCPCount = basicLength = output.length;

		// `handledCPCount` is the number of code points that have been handled;
		// `basicLength` is the number of basic code points.

		// Finish the basic string - if it is not empty - with a delimiter
		if (basicLength) {
			output.push(delimiter);
		}

		// Main encoding loop:
		while (handledCPCount < inputLength) {

			// All non-basic code points < n have been handled already. Find the next
			// larger one:
			for (m = maxInt, j = 0; j < inputLength; ++j) {
				currentValue = input[j];
				if (currentValue >= n && currentValue < m) {
					m = currentValue;
				}
			}

			// Increase `delta` enough to advance the decoder's <n,i> state to <m,0>,
			// but guard against overflow
			handledCPCountPlusOne = handledCPCount + 1;
			if (m - n > floor((maxInt - delta) / handledCPCountPlusOne)) {
				error('overflow');
			}

			delta += (m - n) * handledCPCountPlusOne;
			n = m;

			for (j = 0; j < inputLength; ++j) {
				currentValue = input[j];

				if (currentValue < n && ++delta > maxInt) {
					error('overflow');
				}

				if (currentValue == n) {
					// Represent delta as a generalized variable-length integer
					for (q = delta, k = base; /* no condition */; k += base) {
						t = k <= bias ? tMin : (k >= bias + tMax ? tMax : k - bias);
						if (q < t) {
							break;
						}
						qMinusT = q - t;
						baseMinusT = base - t;
						output.push(
							stringFromCharCode(digitToBasic(t + qMinusT % baseMinusT, 0))
						);
						q = floor(qMinusT / baseMinusT);
					}

					output.push(stringFromCharCode(digitToBasic(q, 0)));
					bias = adapt(delta, handledCPCountPlusOne, handledCPCount == basicLength);
					delta = 0;
					++handledCPCount;
				}
			}

			++delta;
			++n;

		}
		return output.join('');
	}

	/**
	 * Converts a Punycode string representing a domain name or an email address
	 * to Unicode. Only the Punycoded parts of the input will be converted, i.e.
	 * it doesn't matter if you call it on a string that has already been
	 * converted to Unicode.
	 * @memberOf punycode
	 * @param {String} input The Punycoded domain name or email address to
	 * convert to Unicode.
	 * @returns {String} The Unicode representation of the given Punycode
	 * string.
	 */
	function toUnicode(input) {
		return mapDomain(input, function(string) {
			return regexPunycode.test(string)
				? decode(string.slice(4).toLowerCase())
				: string;
		});
	}

	/**
	 * Converts a Unicode string representing a domain name or an email address to
	 * Punycode. Only the non-ASCII parts of the domain name will be converted,
	 * i.e. it doesn't matter if you call it with a domain that's already in
	 * ASCII.
	 * @memberOf punycode
	 * @param {String} input The domain name or email address to convert, as a
	 * Unicode string.
	 * @returns {String} The Punycode representation of the given domain name or
	 * email address.
	 */
	function toASCII(input) {
		return mapDomain(input, function(string) {
			return regexNonASCII.test(string)
				? 'xn--' + encode(string)
				: string;
		});
	}

	/*--------------------------------------------------------------------------*/

	/** Define the public API */
	punycode = {
		/**
		 * A string representing the current Punycode.js version number.
		 * @memberOf punycode
		 * @type String
		 */
		'version': '1.4.1',
		/**
		 * An object of methods to convert from JavaScript's internal character
		 * representation (UCS-2) to Unicode code points, and back.
		 * @see <https://mathiasbynens.be/notes/javascript-encoding>
		 * @memberOf punycode
		 * @type Object
		 */
		'ucs2': {
			'decode': ucs2decode,
			'encode': ucs2encode
		},
		'decode': decode,
		'encode': encode,
		'toASCII': toASCII,
		'toUnicode': toUnicode
	};

	/** Expose `punycode` */
	// Some AMD build optimizers, like r.js, check for specific condition patterns
	// like the following:
	if (
		typeof define == 'function' &&
		typeof define.amd == 'object' &&
		define.amd
	) {
		define('punycode', function() {
			return punycode;
		});
	} else if (freeExports && freeModule) {
		if (module.exports == freeExports) {
			// in Node.js, io.js, or RingoJS v0.8.0+
			freeModule.exports = punycode;
		} else {
			// in Narwhal or RingoJS v0.7.0-
			for (key in punycode) {
				punycode.hasOwnProperty(key) && (freeExports[key] = punycode[key]);
			}
		}
	} else {
		// in Rhino or a web browser
		root.punycode = punycode;
	}

}(this));

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{}],3:[function(require,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

'use strict';

// If obj.hasOwnProperty has been overridden, then calling
// obj.hasOwnProperty(prop) will break.
// See: https://github.com/joyent/node/issues/1707
function hasOwnProperty(obj, prop) {
  return Object.prototype.hasOwnProperty.call(obj, prop);
}

module.exports = function(qs, sep, eq, options) {
  sep = sep || '&';
  eq = eq || '=';
  var obj = {};

  if (typeof qs !== 'string' || qs.length === 0) {
    return obj;
  }

  var regexp = /\+/g;
  qs = qs.split(sep);

  var maxKeys = 1000;
  if (options && typeof options.maxKeys === 'number') {
    maxKeys = options.maxKeys;
  }

  var len = qs.length;
  // maxKeys <= 0 means that we should not limit keys count
  if (maxKeys > 0 && len > maxKeys) {
    len = maxKeys;
  }

  for (var i = 0; i < len; ++i) {
    var x = qs[i].replace(regexp, '%20'),
        idx = x.indexOf(eq),
        kstr, vstr, k, v;

    if (idx >= 0) {
      kstr = x.substr(0, idx);
      vstr = x.substr(idx + 1);
    } else {
      kstr = x;
      vstr = '';
    }

    k = decodeURIComponent(kstr);
    v = decodeURIComponent(vstr);

    if (!hasOwnProperty(obj, k)) {
      obj[k] = v;
    } else if (isArray(obj[k])) {
      obj[k].push(v);
    } else {
      obj[k] = [obj[k], v];
    }
  }

  return obj;
};

var isArray = Array.isArray || function (xs) {
  return Object.prototype.toString.call(xs) === '[object Array]';
};

},{}],4:[function(require,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

'use strict';

var stringifyPrimitive = function(v) {
  switch (typeof v) {
    case 'string':
      return v;

    case 'boolean':
      return v ? 'true' : 'false';

    case 'number':
      return isFinite(v) ? v : '';

    default:
      return '';
  }
};

module.exports = function(obj, sep, eq, name) {
  sep = sep || '&';
  eq = eq || '=';
  if (obj === null) {
    obj = undefined;
  }

  if (typeof obj === 'object') {
    return map(objectKeys(obj), function(k) {
      var ks = encodeURIComponent(stringifyPrimitive(k)) + eq;
      if (isArray(obj[k])) {
        return map(obj[k], function(v) {
          return ks + encodeURIComponent(stringifyPrimitive(v));
        }).join(sep);
      } else {
        return ks + encodeURIComponent(stringifyPrimitive(obj[k]));
      }
    }).join(sep);

  }

  if (!name) return '';
  return encodeURIComponent(stringifyPrimitive(name)) + eq +
         encodeURIComponent(stringifyPrimitive(obj));
};

var isArray = Array.isArray || function (xs) {
  return Object.prototype.toString.call(xs) === '[object Array]';
};

function map (xs, f) {
  if (xs.map) return xs.map(f);
  var res = [];
  for (var i = 0; i < xs.length; i++) {
    res.push(f(xs[i], i));
  }
  return res;
}

var objectKeys = Object.keys || function (obj) {
  var res = [];
  for (var key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) res.push(key);
  }
  return res;
};

},{}],5:[function(require,module,exports){
'use strict';

exports.decode = exports.parse = require('./decode');
exports.encode = exports.stringify = require('./encode');

},{"./decode":3,"./encode":4}],6:[function(require,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

'use strict';

var punycode = require('punycode');
var util = require('./util');

exports.parse = urlParse;
exports.resolve = urlResolve;
exports.resolveObject = urlResolveObject;
exports.format = urlFormat;

exports.Url = Url;

function Url() {
  this.protocol = null;
  this.slashes = null;
  this.auth = null;
  this.host = null;
  this.port = null;
  this.hostname = null;
  this.hash = null;
  this.search = null;
  this.query = null;
  this.pathname = null;
  this.path = null;
  this.href = null;
}

// Reference: RFC 3986, RFC 1808, RFC 2396

// define these here so at least they only have to be
// compiled once on the first module load.
var protocolPattern = /^([a-z0-9.+-]+:)/i,
    portPattern = /:[0-9]*$/,

    // Special case for a simple path URL
    simplePathPattern = /^(\/\/?(?!\/)[^\?\s]*)(\?[^\s]*)?$/,

    // RFC 2396: characters reserved for delimiting URLs.
    // We actually just auto-escape these.
    delims = ['<', '>', '"', '`', ' ', '\r', '\n', '\t'],

    // RFC 2396: characters not allowed for various reasons.
    unwise = ['{', '}', '|', '\\', '^', '`'].concat(delims),

    // Allowed by RFCs, but cause of XSS attacks.  Always escape these.
    autoEscape = ['\''].concat(unwise),
    // Characters that are never ever allowed in a hostname.
    // Note that any invalid chars are also handled, but these
    // are the ones that are *expected* to be seen, so we fast-path
    // them.
    nonHostChars = ['%', '/', '?', ';', '#'].concat(autoEscape),
    hostEndingChars = ['/', '?', '#'],
    hostnameMaxLen = 255,
    hostnamePartPattern = /^[+a-z0-9A-Z_-]{0,63}$/,
    hostnamePartStart = /^([+a-z0-9A-Z_-]{0,63})(.*)$/,
    // protocols that can allow "unsafe" and "unwise" chars.
    unsafeProtocol = {
      'javascript': true,
      'javascript:': true
    },
    // protocols that never have a hostname.
    hostlessProtocol = {
      'javascript': true,
      'javascript:': true
    },
    // protocols that always contain a // bit.
    slashedProtocol = {
      'http': true,
      'https': true,
      'ftp': true,
      'gopher': true,
      'file': true,
      'http:': true,
      'https:': true,
      'ftp:': true,
      'gopher:': true,
      'file:': true
    },
    querystring = require('querystring');

function urlParse(url, parseQueryString, slashesDenoteHost) {
  if (url && util.isObject(url) && url instanceof Url) return url;

  var u = new Url;
  u.parse(url, parseQueryString, slashesDenoteHost);
  return u;
}

Url.prototype.parse = function(url, parseQueryString, slashesDenoteHost) {
  if (!util.isString(url)) {
    throw new TypeError("Parameter 'url' must be a string, not " + typeof url);
  }

  // Copy chrome, IE, opera backslash-handling behavior.
  // Back slashes before the query string get converted to forward slashes
  // See: https://code.google.com/p/chromium/issues/detail?id=25916
  var queryIndex = url.indexOf('?'),
      splitter =
          (queryIndex !== -1 && queryIndex < url.indexOf('#')) ? '?' : '#',
      uSplit = url.split(splitter),
      slashRegex = /\\/g;
  uSplit[0] = uSplit[0].replace(slashRegex, '/');
  url = uSplit.join(splitter);

  var rest = url;

  // trim before proceeding.
  // This is to support parse stuff like "  http://foo.com  \n"
  rest = rest.trim();

  if (!slashesDenoteHost && url.split('#').length === 1) {
    // Try fast path regexp
    var simplePath = simplePathPattern.exec(rest);
    if (simplePath) {
      this.path = rest;
      this.href = rest;
      this.pathname = simplePath[1];
      if (simplePath[2]) {
        this.search = simplePath[2];
        if (parseQueryString) {
          this.query = querystring.parse(this.search.substr(1));
        } else {
          this.query = this.search.substr(1);
        }
      } else if (parseQueryString) {
        this.search = '';
        this.query = {};
      }
      return this;
    }
  }

  var proto = protocolPattern.exec(rest);
  if (proto) {
    proto = proto[0];
    var lowerProto = proto.toLowerCase();
    this.protocol = lowerProto;
    rest = rest.substr(proto.length);
  }

  // figure out if it's got a host
  // user@server is *always* interpreted as a hostname, and url
  // resolution will treat //foo/bar as host=foo,path=bar because that's
  // how the browser resolves relative URLs.
  if (slashesDenoteHost || proto || rest.match(/^\/\/[^@\/]+@[^@\/]+/)) {
    var slashes = rest.substr(0, 2) === '//';
    if (slashes && !(proto && hostlessProtocol[proto])) {
      rest = rest.substr(2);
      this.slashes = true;
    }
  }

  if (!hostlessProtocol[proto] &&
      (slashes || (proto && !slashedProtocol[proto]))) {

    // there's a hostname.
    // the first instance of /, ?, ;, or # ends the host.
    //
    // If there is an @ in the hostname, then non-host chars *are* allowed
    // to the left of the last @ sign, unless some host-ending character
    // comes *before* the @-sign.
    // URLs are obnoxious.
    //
    // ex:
    // http://a@b@c/ => user:a@b host:c
    // http://a@b?@c => user:a host:c path:/?@c

    // v0.12 TODO(isaacs): This is not quite how Chrome does things.
    // Review our test case against browsers more comprehensively.

    // find the first instance of any hostEndingChars
    var hostEnd = -1;
    for (var i = 0; i < hostEndingChars.length; i++) {
      var hec = rest.indexOf(hostEndingChars[i]);
      if (hec !== -1 && (hostEnd === -1 || hec < hostEnd))
        hostEnd = hec;
    }

    // at this point, either we have an explicit point where the
    // auth portion cannot go past, or the last @ char is the decider.
    var auth, atSign;
    if (hostEnd === -1) {
      // atSign can be anywhere.
      atSign = rest.lastIndexOf('@');
    } else {
      // atSign must be in auth portion.
      // http://a@b/c@d => host:b auth:a path:/c@d
      atSign = rest.lastIndexOf('@', hostEnd);
    }

    // Now we have a portion which is definitely the auth.
    // Pull that off.
    if (atSign !== -1) {
      auth = rest.slice(0, atSign);
      rest = rest.slice(atSign + 1);
      this.auth = decodeURIComponent(auth);
    }

    // the host is the remaining to the left of the first non-host char
    hostEnd = -1;
    for (var i = 0; i < nonHostChars.length; i++) {
      var hec = rest.indexOf(nonHostChars[i]);
      if (hec !== -1 && (hostEnd === -1 || hec < hostEnd))
        hostEnd = hec;
    }
    // if we still have not hit it, then the entire thing is a host.
    if (hostEnd === -1)
      hostEnd = rest.length;

    this.host = rest.slice(0, hostEnd);
    rest = rest.slice(hostEnd);

    // pull out port.
    this.parseHost();

    // we've indicated that there is a hostname,
    // so even if it's empty, it has to be present.
    this.hostname = this.hostname || '';

    // if hostname begins with [ and ends with ]
    // assume that it's an IPv6 address.
    var ipv6Hostname = this.hostname[0] === '[' &&
        this.hostname[this.hostname.length - 1] === ']';

    // validate a little.
    if (!ipv6Hostname) {
      var hostparts = this.hostname.split(/\./);
      for (var i = 0, l = hostparts.length; i < l; i++) {
        var part = hostparts[i];
        if (!part) continue;
        if (!part.match(hostnamePartPattern)) {
          var newpart = '';
          for (var j = 0, k = part.length; j < k; j++) {
            if (part.charCodeAt(j) > 127) {
              // we replace non-ASCII char with a temporary placeholder
              // we need this to make sure size of hostname is not
              // broken by replacing non-ASCII by nothing
              newpart += 'x';
            } else {
              newpart += part[j];
            }
          }
          // we test again with ASCII char only
          if (!newpart.match(hostnamePartPattern)) {
            var validParts = hostparts.slice(0, i);
            var notHost = hostparts.slice(i + 1);
            var bit = part.match(hostnamePartStart);
            if (bit) {
              validParts.push(bit[1]);
              notHost.unshift(bit[2]);
            }
            if (notHost.length) {
              rest = '/' + notHost.join('.') + rest;
            }
            this.hostname = validParts.join('.');
            break;
          }
        }
      }
    }

    if (this.hostname.length > hostnameMaxLen) {
      this.hostname = '';
    } else {
      // hostnames are always lower case.
      this.hostname = this.hostname.toLowerCase();
    }

    if (!ipv6Hostname) {
      // IDNA Support: Returns a punycoded representation of "domain".
      // It only converts parts of the domain name that
      // have non-ASCII characters, i.e. it doesn't matter if
      // you call it with a domain that already is ASCII-only.
      this.hostname = punycode.toASCII(this.hostname);
    }

    var p = this.port ? ':' + this.port : '';
    var h = this.hostname || '';
    this.host = h + p;
    this.href += this.host;

    // strip [ and ] from the hostname
    // the host field still retains them, though
    if (ipv6Hostname) {
      this.hostname = this.hostname.substr(1, this.hostname.length - 2);
      if (rest[0] !== '/') {
        rest = '/' + rest;
      }
    }
  }

  // now rest is set to the post-host stuff.
  // chop off any delim chars.
  if (!unsafeProtocol[lowerProto]) {

    // First, make 100% sure that any "autoEscape" chars get
    // escaped, even if encodeURIComponent doesn't think they
    // need to be.
    for (var i = 0, l = autoEscape.length; i < l; i++) {
      var ae = autoEscape[i];
      if (rest.indexOf(ae) === -1)
        continue;
      var esc = encodeURIComponent(ae);
      if (esc === ae) {
        esc = escape(ae);
      }
      rest = rest.split(ae).join(esc);
    }
  }


  // chop off from the tail first.
  var hash = rest.indexOf('#');
  if (hash !== -1) {
    // got a fragment string.
    this.hash = rest.substr(hash);
    rest = rest.slice(0, hash);
  }
  var qm = rest.indexOf('?');
  if (qm !== -1) {
    this.search = rest.substr(qm);
    this.query = rest.substr(qm + 1);
    if (parseQueryString) {
      this.query = querystring.parse(this.query);
    }
    rest = rest.slice(0, qm);
  } else if (parseQueryString) {
    // no query string, but parseQueryString still requested
    this.search = '';
    this.query = {};
  }
  if (rest) this.pathname = rest;
  if (slashedProtocol[lowerProto] &&
      this.hostname && !this.pathname) {
    this.pathname = '/';
  }

  //to support http.request
  if (this.pathname || this.search) {
    var p = this.pathname || '';
    var s = this.search || '';
    this.path = p + s;
  }

  // finally, reconstruct the href based on what has been validated.
  this.href = this.format();
  return this;
};

// format a parsed object into a url string
function urlFormat(obj) {
  // ensure it's an object, and not a string url.
  // If it's an obj, this is a no-op.
  // this way, you can call url_format() on strings
  // to clean up potentially wonky urls.
  if (util.isString(obj)) obj = urlParse(obj);
  if (!(obj instanceof Url)) return Url.prototype.format.call(obj);
  return obj.format();
}

Url.prototype.format = function() {
  var auth = this.auth || '';
  if (auth) {
    auth = encodeURIComponent(auth);
    auth = auth.replace(/%3A/i, ':');
    auth += '@';
  }

  var protocol = this.protocol || '',
      pathname = this.pathname || '',
      hash = this.hash || '',
      host = false,
      query = '';

  if (this.host) {
    host = auth + this.host;
  } else if (this.hostname) {
    host = auth + (this.hostname.indexOf(':') === -1 ?
        this.hostname :
        '[' + this.hostname + ']');
    if (this.port) {
      host += ':' + this.port;
    }
  }

  if (this.query &&
      util.isObject(this.query) &&
      Object.keys(this.query).length) {
    query = querystring.stringify(this.query);
  }

  var search = this.search || (query && ('?' + query)) || '';

  if (protocol && protocol.substr(-1) !== ':') protocol += ':';

  // only the slashedProtocols get the //.  Not mailto:, xmpp:, etc.
  // unless they had them to begin with.
  if (this.slashes ||
      (!protocol || slashedProtocol[protocol]) && host !== false) {
    host = '//' + (host || '');
    if (pathname && pathname.charAt(0) !== '/') pathname = '/' + pathname;
  } else if (!host) {
    host = '';
  }

  if (hash && hash.charAt(0) !== '#') hash = '#' + hash;
  if (search && search.charAt(0) !== '?') search = '?' + search;

  pathname = pathname.replace(/[?#]/g, function(match) {
    return encodeURIComponent(match);
  });
  search = search.replace('#', '%23');

  return protocol + host + pathname + search + hash;
};

function urlResolve(source, relative) {
  return urlParse(source, false, true).resolve(relative);
}

Url.prototype.resolve = function(relative) {
  return this.resolveObject(urlParse(relative, false, true)).format();
};

function urlResolveObject(source, relative) {
  if (!source) return relative;
  return urlParse(source, false, true).resolveObject(relative);
}

Url.prototype.resolveObject = function(relative) {
  if (util.isString(relative)) {
    var rel = new Url();
    rel.parse(relative, false, true);
    relative = rel;
  }

  var result = new Url();
  var tkeys = Object.keys(this);
  for (var tk = 0; tk < tkeys.length; tk++) {
    var tkey = tkeys[tk];
    result[tkey] = this[tkey];
  }

  // hash is always overridden, no matter what.
  // even href="" will remove it.
  result.hash = relative.hash;

  // if the relative url is empty, then there's nothing left to do here.
  if (relative.href === '') {
    result.href = result.format();
    return result;
  }

  // hrefs like //foo/bar always cut to the protocol.
  if (relative.slashes && !relative.protocol) {
    // take everything except the protocol from relative
    var rkeys = Object.keys(relative);
    for (var rk = 0; rk < rkeys.length; rk++) {
      var rkey = rkeys[rk];
      if (rkey !== 'protocol')
        result[rkey] = relative[rkey];
    }

    //urlParse appends trailing / to urls like http://www.example.com
    if (slashedProtocol[result.protocol] &&
        result.hostname && !result.pathname) {
      result.path = result.pathname = '/';
    }

    result.href = result.format();
    return result;
  }

  if (relative.protocol && relative.protocol !== result.protocol) {
    // if it's a known url protocol, then changing
    // the protocol does weird things
    // first, if it's not file:, then we MUST have a host,
    // and if there was a path
    // to begin with, then we MUST have a path.
    // if it is file:, then the host is dropped,
    // because that's known to be hostless.
    // anything else is assumed to be absolute.
    if (!slashedProtocol[relative.protocol]) {
      var keys = Object.keys(relative);
      for (var v = 0; v < keys.length; v++) {
        var k = keys[v];
        result[k] = relative[k];
      }
      result.href = result.format();
      return result;
    }

    result.protocol = relative.protocol;
    if (!relative.host && !hostlessProtocol[relative.protocol]) {
      var relPath = (relative.pathname || '').split('/');
      while (relPath.length && !(relative.host = relPath.shift()));
      if (!relative.host) relative.host = '';
      if (!relative.hostname) relative.hostname = '';
      if (relPath[0] !== '') relPath.unshift('');
      if (relPath.length < 2) relPath.unshift('');
      result.pathname = relPath.join('/');
    } else {
      result.pathname = relative.pathname;
    }
    result.search = relative.search;
    result.query = relative.query;
    result.host = relative.host || '';
    result.auth = relative.auth;
    result.hostname = relative.hostname || relative.host;
    result.port = relative.port;
    // to support http.request
    if (result.pathname || result.search) {
      var p = result.pathname || '';
      var s = result.search || '';
      result.path = p + s;
    }
    result.slashes = result.slashes || relative.slashes;
    result.href = result.format();
    return result;
  }

  var isSourceAbs = (result.pathname && result.pathname.charAt(0) === '/'),
      isRelAbs = (
          relative.host ||
          relative.pathname && relative.pathname.charAt(0) === '/'
      ),
      mustEndAbs = (isRelAbs || isSourceAbs ||
                    (result.host && relative.pathname)),
      removeAllDots = mustEndAbs,
      srcPath = result.pathname && result.pathname.split('/') || [],
      relPath = relative.pathname && relative.pathname.split('/') || [],
      psychotic = result.protocol && !slashedProtocol[result.protocol];

  // if the url is a non-slashed url, then relative
  // links like ../.. should be able
  // to crawl up to the hostname, as well.  This is strange.
  // result.protocol has already been set by now.
  // Later on, put the first path part into the host field.
  if (psychotic) {
    result.hostname = '';
    result.port = null;
    if (result.host) {
      if (srcPath[0] === '') srcPath[0] = result.host;
      else srcPath.unshift(result.host);
    }
    result.host = '';
    if (relative.protocol) {
      relative.hostname = null;
      relative.port = null;
      if (relative.host) {
        if (relPath[0] === '') relPath[0] = relative.host;
        else relPath.unshift(relative.host);
      }
      relative.host = null;
    }
    mustEndAbs = mustEndAbs && (relPath[0] === '' || srcPath[0] === '');
  }

  if (isRelAbs) {
    // it's absolute.
    result.host = (relative.host || relative.host === '') ?
                  relative.host : result.host;
    result.hostname = (relative.hostname || relative.hostname === '') ?
                      relative.hostname : result.hostname;
    result.search = relative.search;
    result.query = relative.query;
    srcPath = relPath;
    // fall through to the dot-handling below.
  } else if (relPath.length) {
    // it's relative
    // throw away the existing file, and take the new path instead.
    if (!srcPath) srcPath = [];
    srcPath.pop();
    srcPath = srcPath.concat(relPath);
    result.search = relative.search;
    result.query = relative.query;
  } else if (!util.isNullOrUndefined(relative.search)) {
    // just pull out the search.
    // like href='?foo'.
    // Put this after the other two cases because it simplifies the booleans
    if (psychotic) {
      result.hostname = result.host = srcPath.shift();
      //occationaly the auth can get stuck only in host
      //this especially happens in cases like
      //url.resolveObject('mailto:local1@domain1', 'local2@domain2')
      var authInHost = result.host && result.host.indexOf('@') > 0 ?
                       result.host.split('@') : false;
      if (authInHost) {
        result.auth = authInHost.shift();
        result.host = result.hostname = authInHost.shift();
      }
    }
    result.search = relative.search;
    result.query = relative.query;
    //to support http.request
    if (!util.isNull(result.pathname) || !util.isNull(result.search)) {
      result.path = (result.pathname ? result.pathname : '') +
                    (result.search ? result.search : '');
    }
    result.href = result.format();
    return result;
  }

  if (!srcPath.length) {
    // no path at all.  easy.
    // we've already handled the other stuff above.
    result.pathname = null;
    //to support http.request
    if (result.search) {
      result.path = '/' + result.search;
    } else {
      result.path = null;
    }
    result.href = result.format();
    return result;
  }

  // if a url ENDs in . or .., then it must get a trailing slash.
  // however, if it ends in anything else non-slashy,
  // then it must NOT get a trailing slash.
  var last = srcPath.slice(-1)[0];
  var hasTrailingSlash = (
      (result.host || relative.host || srcPath.length > 1) &&
      (last === '.' || last === '..') || last === '');

  // strip single dots, resolve double dots to parent dir
  // if the path tries to go above the root, `up` ends up > 0
  var up = 0;
  for (var i = srcPath.length; i >= 0; i--) {
    last = srcPath[i];
    if (last === '.') {
      srcPath.splice(i, 1);
    } else if (last === '..') {
      srcPath.splice(i, 1);
      up++;
    } else if (up) {
      srcPath.splice(i, 1);
      up--;
    }
  }

  // if the path is allowed to go above the root, restore leading ..s
  if (!mustEndAbs && !removeAllDots) {
    for (; up--; up) {
      srcPath.unshift('..');
    }
  }

  if (mustEndAbs && srcPath[0] !== '' &&
      (!srcPath[0] || srcPath[0].charAt(0) !== '/')) {
    srcPath.unshift('');
  }

  if (hasTrailingSlash && (srcPath.join('/').substr(-1) !== '/')) {
    srcPath.push('');
  }

  var isAbsolute = srcPath[0] === '' ||
      (srcPath[0] && srcPath[0].charAt(0) === '/');

  // put the host back
  if (psychotic) {
    result.hostname = result.host = isAbsolute ? '' :
                                    srcPath.length ? srcPath.shift() : '';
    //occationaly the auth can get stuck only in host
    //this especially happens in cases like
    //url.resolveObject('mailto:local1@domain1', 'local2@domain2')
    var authInHost = result.host && result.host.indexOf('@') > 0 ?
                     result.host.split('@') : false;
    if (authInHost) {
      result.auth = authInHost.shift();
      result.host = result.hostname = authInHost.shift();
    }
  }

  mustEndAbs = mustEndAbs || (result.host && srcPath.length);

  if (mustEndAbs && !isAbsolute) {
    srcPath.unshift('');
  }

  if (!srcPath.length) {
    result.pathname = null;
    result.path = null;
  } else {
    result.pathname = srcPath.join('/');
  }

  //to support request.http
  if (!util.isNull(result.pathname) || !util.isNull(result.search)) {
    result.path = (result.pathname ? result.pathname : '') +
                  (result.search ? result.search : '');
  }
  result.auth = relative.auth || result.auth;
  result.slashes = result.slashes || relative.slashes;
  result.href = result.format();
  return result;
};

Url.prototype.parseHost = function() {
  var host = this.host;
  var port = portPattern.exec(host);
  if (port) {
    port = port[0];
    if (port !== ':') {
      this.port = port.substr(1);
    }
    host = host.substr(0, host.length - port.length);
  }
  if (host) this.hostname = host;
};

},{"./util":7,"punycode":2,"querystring":5}],7:[function(require,module,exports){
'use strict';

module.exports = {
  isString: function(arg) {
    return typeof(arg) === 'string';
  },
  isObject: function(arg) {
    return typeof(arg) === 'object' && arg !== null;
  },
  isNull: function(arg) {
    return arg === null;
  },
  isNullOrUndefined: function(arg) {
    return arg == null;
  }
};

},{}],8:[function(require,module,exports){
module.exports = extend

var hasOwnProperty = Object.prototype.hasOwnProperty;

function extend() {
    var target = {}

    for (var i = 0; i < arguments.length; i++) {
        var source = arguments[i]

        for (var key in source) {
            if (hasOwnProperty.call(source, key)) {
                target[key] = source[key]
            }
        }
    }

    return target
}

},{}],9:[function(require,module,exports){
module.exports = Object.freeze({"bill":{"volume":"codeVolume","pages":"codePages","number":"billNumber"},"case":{"volume":"reporterVolume","pages":"firstPage","date":"dateDecided","number":"docketNumber","title":"caseName"},"thesis":{"publisher":"university","type":"thesisType"},"film":{"publisher":"distributor","type":"genre","medium":"videoRecordingFormat"},"report":{"publisher":"institution","number":"reportNumber","type":"reportType"},"audioRecording":{"publisher":"label","medium":"audioRecordingFormat"},"videoRecording":{"publisher":"studio","medium":"videoRecordingFormat"},"tvBroadcast":{"publisher":"network","publicationTitle":"programTitle","number":"episodeNumber","medium":"videoRecordingFormat"},"radioBroadcast":{"publisher":"network","publicationTitle":"programTitle","number":"episodeNumber","medium":"audioRecordingFormat"},"computerProgram":{"publisher":"company"},"bookSection":{"publicationTitle":"bookTitle"},"conferencePaper":{"publicationTitle":"proceedingsTitle"},"webpage":{"publicationTitle":"websiteTitle","type":"websiteType"},"blogPost":{"publicationTitle":"blogTitle","type":"websiteType"},"forumPost":{"publicationTitle":"forumTitle","type":"postType"},"encyclopediaArticle":{"publicationTitle":"encyclopediaTitle"},"dictionaryEntry":{"publicationTitle":"dictionaryTitle"},"patent":{"date":"issueDate","number":"patentNumber"},"statute":{"date":"dateEnacted","number":"publicLawNumber","title":"nameOfAct"},"hearing":{"number":"documentNumber"},"podcast":{"number":"episodeNumber","medium":"audioFileType"},"letter":{"type":"letterType"},"manuscript":{"type":"manuscriptType"},"map":{"type":"mapType"},"presentation":{"type":"presentationType"},"interview":{"medium":"interviewMedium"},"artwork":{"medium":"artworkMedium"},"email":{"title":"subject"}});
},{}],10:[function(require,module,exports){
'use strict';var _extends=Object.assign||function(e){for(var a,b=1;b<arguments.length;b++)for(var c in a=arguments[b],a)Object.prototype.hasOwnProperty.call(a,c)&&(e[c]=a[c]);return e};const dateToSql=require('../zotero-shim/date-to-sql'),defaults=require('./defaults'),itemToCSLJSON=require('../zotero-shim/item-to-csl-json'),parseLinkHeader=require('parse-link-header'),{uuid4,isLikeZoteroItem}=require('./utils'),[COMPLETE,MULTIPLE_ITEMS,FAILED]=['COMPLETE','MULTIPLE_ITEMS','FAILED'];class ZoteroBib{constructor(b){if(this.opts=_extends({sessionid:uuid4()},defaults(),b),this.opts.persist&&this.opts.storage){if(!('getItem'in this.opts.storage||'setItem'in this.opts.storage||'clear'in this.opts.storage))throw new Error('Invalid storage engine provided');this.opts.override&&this.clearItems(),this.items=[...this.opts.initialItems,...this.getItemsStorage()].filter(isLikeZoteroItem),this.setItemsStorage(this.items)}else this.items=[...this.opts.initialItems].filter(isLikeZoteroItem)}getItemsStorage(){let b=this.opts.storage.getItem(`${this.opts.storagePrefix}-items`);return b?JSON.parse(b):[]}setItemsStorage(b){this.opts.storage.setItem(`${this.opts.storagePrefix}-items`,JSON.stringify(b))}reloadItems(){this.items=this.getItemsStorage()}addItem(b){if(!isLikeZoteroItem(b))throw new Error('Failed to add item');this.items.push(b),this.opts.persist&&this.setItemsStorage(this.items)}updateItem(c,a){this.items[c]=a,this.opts.persist&&this.setItemsStorage(this.items)}removeItem(c){let a=this.items.indexOf(c);return-1!==a&&(this.items.splice(a,1),this.opts.persist&&this.setItemsStorage(this.items),c)}clearItems(){this.items=[],this.opts.persist&&this.setItemsStorage(this.items)}get itemsCSL(){return this.items.map((b)=>itemToCSLJSON(b))}get itemsRaw(){return this.items}async exportItems(e){let a=`${this.opts.translationServerURL}/${this.opts.translationServerPrefix}export?format=${e}`,b=_extends({method:'POST',headers:{"Content-Type":'application/json'},body:JSON.stringify(this.items.filter((b)=>'key'in b))},this.opts.init);const c=await fetch(a,b);if(c.ok)return await c.text();throw new Error('Failed to export items')}async translateIdentifier(e,...f){let b=`${this.opts.translationServerURL}/${this.opts.translationServerPrefix}search`,c=_extends({method:'POST',headers:{"Content-Type":'text/plain'},body:e},this.opts.init);return await this.translate(b,c,...f)}async translateUrlItems(h,i,...j){let c=`${this.opts.translationServerURL}/${this.opts.translationServerPrefix}web`,d=this.opts.sessionid,k=_extends({url:h,items:i,sessionid:d},this.opts.request),f=_extends({method:'POST',headers:{"Content-Type":'application/json'},body:JSON.stringify(k)},this.opts.init);return await this.translate(c,f,...j)}async translateUrl(g,...h){let b=`${this.opts.translationServerURL}/${this.opts.translationServerPrefix}web`,c=this.opts.sessionid,i=_extends({url:g,sessionid:c},this.opts.request),e=_extends({method:'POST',headers:{"Content-Type":'application/json'},body:JSON.stringify(i)},this.opts.init);return await this.translate(b,e,...h)}async translate(h,a,b=!0){const c=await fetch(h,a);var i,j,k={};return c.headers.has('Link')&&(k=parseLinkHeader(c.headers.get('Link'))),c.ok?(i=await c.json(),Array.isArray(i)&&i.forEach((c)=>{if('CURRENT_TIMESTAMP'===c.accessDate){const a=new Date(Date.now());c.accessDate=dateToSql(a,!0)}b&&this.addItem(c)}),j=Array.isArray(i)?COMPLETE:FAILED):300===c.status?(i=await c.json(),j=MULTIPLE_ITEMS):j=FAILED,{result:j,items:i,response:c,links:k}}static get COMPLETE(){return COMPLETE}static get MULTIPLE_ITEMS(){return MULTIPLE_ITEMS}static get FAILED(){return FAILED}}module.exports=ZoteroBib;

},{"../zotero-shim/date-to-sql":16,"../zotero-shim/item-to-csl-json":19,"./defaults":11,"./utils":12,"parse-link-header":1}],11:[function(require,module,exports){
'use strict';module.exports=()=>({translationServerURL:'undefined'!=typeof window&&window.location.origin||'',translationServerPrefix:'',fetchConfig:{},initialItems:[],request:{},storage:'undefined'!=typeof window&&'localStorage'in window&&window.localStorage||{},persist:!0,override:!1,storagePrefix:'zotero-bib'});

},{}],12:[function(require,module,exports){
'use strict';module.exports={uuid4:()=>'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,(d)=>{var a=0|16*Math.random(),b='x'==d?a:8|3&a;return b.toString(16)}),isLikeZoteroItem:(b)=>b&&'object'==typeof b&&'itemType'in b};

},{}],13:[function(require,module,exports){
'use strict';const ZoteroBib=require('./bib/bib');module.exports=ZoteroBib;

},{"./bib/bib":10}],14:[function(require,module,exports){
'use strict';const creatorTypes={1:'author',2:'contributor',3:'editor',4:'translator',5:'seriesEditor',6:'interviewee',7:'interviewer',8:'director',9:'scriptwriter',10:'producer',11:'castMember',12:'sponsor',13:'counsel',14:'inventor',15:'attorneyAgent',16:'recipient',17:'performer',18:'composer',19:'wordsBy',20:'cartographer',21:'programmer',22:'artist',23:'commenter',24:'presenter',25:'guest',26:'podcaster',27:'reviewedAuthor',28:'cosponsor',29:'bookAuthor'};Object.keys(creatorTypes).map((b)=>creatorTypes[creatorTypes[b]]=b),module.exports=creatorTypes;

},{}],15:[function(require,module,exports){
module.exports={CSL_NAMES_MAPPINGS:{author:'author',editor:'editor',bookAuthor:'container-author',composer:'composer',director:'director',interviewer:'interviewer',recipient:'recipient',reviewedAuthor:'reviewed-author',seriesEditor:'collection-editor',translator:'translator'},CSL_TEXT_MAPPINGS:{title:['title'],"container-title":['publicationTitle','reporter','code'],"collection-title":['seriesTitle','series'],"collection-number":['seriesNumber'],publisher:['publisher','distributor'],"publisher-place":['place'],authority:['court','legislativeBody','issuingAuthority'],page:['pages'],volume:['volume','codeNumber'],issue:['issue','priorityNumbers'],"number-of-volumes":['numberOfVolumes'],"number-of-pages":['numPages'],edition:['edition'],version:['versionNumber'],section:['section','committee'],genre:['type','programmingLanguage'],source:['libraryCatalog'],dimensions:['artworkSize','runningTime'],medium:['medium','system'],scale:['scale'],archive:['archive'],archive_location:['archiveLocation'],event:['meetingName','conferenceName'],"event-place":['place'],abstract:['abstractNote'],URL:['url'],DOI:['DOI'],ISBN:['ISBN'],ISSN:['ISSN'],"call-number":['callNumber','applicationNumber'],note:['extra'],number:['number'],"chapter-number":['session'],references:['history','references'],shortTitle:['shortTitle'],journalAbbreviation:['journalAbbreviation'],status:['legalStatus'],language:['language']},CSL_DATE_MAPPINGS:{issued:'date',accessed:'accessDate',submitted:'filingDate'},CSL_TYPE_MAPPINGS:{book:'book',bookSection:'chapter',journalArticle:'article-journal',magazineArticle:'article-magazine',newspaperArticle:'article-newspaper',thesis:'thesis',encyclopediaArticle:'entry-encyclopedia',dictionaryEntry:'entry-dictionary',conferencePaper:'paper-conference',letter:'personal_communication',manuscript:'manuscript',interview:'interview',film:'motion_picture',artwork:'graphic',webpage:'webpage',report:'report',bill:'bill',case:'legal_case',hearing:'bill',patent:'patent',statute:'legislation',email:'personal_communication',map:'map',blogPost:'post-weblog',instantMessage:'personal_communication',forumPost:'post',audioRecording:'song',presentation:'speech',videoRecording:'motion_picture',tvBroadcast:'broadcast',radioBroadcast:'broadcast',podcast:'song',computerProgram:'book',document:'article',note:'article',attachment:'article'}};

},{}],16:[function(require,module,exports){
const lpad=require('./lpad');module.exports=(i,a)=>{var b,c,d,e,f,g;try{return a?(b=i.getUTCFullYear(),c=i.getUTCMonth(),d=i.getUTCDate(),e=i.getUTCHours(),f=i.getUTCMinutes(),g=i.getUTCSeconds()):(b=i.getFullYear(),c=i.getMonth(),d=i.getDate(),e=i.getHours(),f=i.getMinutes(),g=i.getSeconds()),b=lpad(b,'0',4),c=lpad(c+1,'0',2),d=lpad(d,'0',2),e=lpad(e,'0',2),f=lpad(f,'0',2),g=lpad(g,'0',2),b+'-'+c+'-'+d+' '+e+':'+f+':'+g}catch(b){return''}};

},{"./lpad":21}],17:[function(require,module,exports){
const itemTypes=require('./item-types'),creatorTypes=require('./creator-types');module.exports={[itemTypes[2]]:creatorTypes[1],[itemTypes[3]]:creatorTypes[1],[itemTypes[4]]:creatorTypes[1],[itemTypes[5]]:creatorTypes[1],[itemTypes[6]]:creatorTypes[1],[itemTypes[7]]:creatorTypes[1],[itemTypes[8]]:creatorTypes[1],[itemTypes[9]]:creatorTypes[1],[itemTypes[10]]:creatorTypes[6],[itemTypes[11]]:creatorTypes[8],[itemTypes[12]]:creatorTypes[22],[itemTypes[13]]:creatorTypes[1],[itemTypes[15]]:creatorTypes[1],[itemTypes[16]]:creatorTypes[12],[itemTypes[17]]:creatorTypes[1],[itemTypes[18]]:creatorTypes[2],[itemTypes[19]]:creatorTypes[14],[itemTypes[20]]:creatorTypes[1],[itemTypes[21]]:creatorTypes[1],[itemTypes[22]]:creatorTypes[20],[itemTypes[23]]:creatorTypes[1],[itemTypes[24]]:creatorTypes[1],[itemTypes[25]]:creatorTypes[1],[itemTypes[26]]:creatorTypes[17],[itemTypes[27]]:creatorTypes[24],[itemTypes[28]]:creatorTypes[8],[itemTypes[29]]:creatorTypes[8],[itemTypes[30]]:creatorTypes[8],[itemTypes[31]]:creatorTypes[26],[itemTypes[32]]:creatorTypes[21],[itemTypes[33]]:creatorTypes[1],[itemTypes[34]]:creatorTypes[1],[itemTypes[35]]:creatorTypes[1],[itemTypes[36]]:creatorTypes[1]};

},{"./creator-types":14,"./item-types":20}],18:[function(require,module,exports){
'use strict';const fields={1:'url',2:'rights',3:'series',4:'volume',5:'issue',6:'edition',7:'place',8:'publisher',10:'pages',11:'ISBN',12:'publicationTitle',13:'ISSN',14:'date',15:'section',18:'callNumber',19:'archiveLocation',21:'distributor',22:'extra',25:'journalAbbreviation',26:'DOI',27:'accessDate',28:'seriesTitle',29:'seriesText',30:'seriesNumber',31:'institution',32:'reportType',36:'code',40:'session',41:'legislativeBody',42:'history',43:'reporter',44:'court',45:'numberOfVolumes',46:'committee',48:'assignee',50:'patentNumber',51:'priorityNumbers',52:'issueDate',53:'references',54:'legalStatus',55:'codeNumber',59:'artworkMedium',60:'number',61:'artworkSize',62:'libraryCatalog',63:'videoRecordingFormat',64:'interviewMedium',65:'letterType',66:'manuscriptType',67:'mapType',68:'scale',69:'thesisType',70:'websiteType',71:'audioRecordingFormat',72:'label',74:'presentationType',75:'meetingName',76:'studio',77:'runningTime',78:'network',79:'postType',80:'audioFileType',81:'versionNumber',82:'system',83:'company',84:'conferenceName',85:'encyclopediaTitle',86:'dictionaryTitle',87:'language',88:'programmingLanguage',89:'university',90:'abstractNote',91:'websiteTitle',92:'reportNumber',93:'billNumber',94:'codeVolume',95:'codePages',96:'dateDecided',97:'reporterVolume',98:'firstPage',99:'documentNumber',100:'dateEnacted',101:'publicLawNumber',102:'country',103:'applicationNumber',104:'forumTitle',105:'episodeNumber',107:'blogTitle',108:'type',109:'medium',110:'title',111:'caseName',112:'nameOfAct',113:'subject',114:'proceedingsTitle',115:'bookTitle',116:'shortTitle',117:'docketNumber',118:'numPages',119:'programTitle',120:'issuingAuthority',121:'filingDate',122:'genre',123:'archive'};Object.keys(fields).map((b)=>fields[fields[b]]=b),module.exports=fields;

},{}],19:[function(require,module,exports){
'use strict';const baseMappings=require('zotero-base-mappings'),{CSL_NAMES_MAPPINGS,CSL_TEXT_MAPPINGS,CSL_DATE_MAPPINGS,CSL_TYPE_MAPPINGS}=require('./csl-mappings'),{getFieldIDFromTypeAndBase}=require('./type-specific-field-map'),fields=require('./fields'),itemTypes=require('./item-types'),strToDate=require('./str-to-date'),defaultItemTypeCreatorTypeLookup=require('./default-item-type-creator-type-lookup'),baseMappingsFlat=Object.keys(baseMappings).reduce((f,a)=>{return Object.keys(baseMappings[a]).forEach((b)=>{let c=`${a}${b}`,d=baseMappings[a][b];f[c]=d}),f},{});module.exports=(i)=>{var a=CSL_TYPE_MAPPINGS[i.itemType];if(!a)throw new Error('Unexpected Zotero Item type "'+i.itemType+'"');var f=itemTypes[i.itemType],j={id:i.key,type:a};for(let a in CSL_TEXT_MAPPINGS){let b=CSL_TEXT_MAPPINGS[a];for(let d=0,e=b.length;d<e;d++){let e=b[d],f=null;if(e in i)f=i[e];else{const a=baseMappingsFlat[`${i.itemType}${e}`];f=i[a]}if(f&&'string'==typeof f){if('ISBN'==e){var c=f.match(/^(?:97[89]-?)?(?:\d-?){9}[\dx](?!-)\b/i);c&&(f=c[0])}'"'==f.charAt(0)&&f.indexOf('"',1)==f.length-1&&(f=f.substring(1,f.length-1)),j[a]=f;break}}}if('attachment'!=i.type&&'note'!=i.type){let d=defaultItemTypeCreatorTypeLookup[f],b=i.creators;for(let e=0;b&&e<b.length;e++){let a,c=b[e],f=c.creatorType;(f==d&&(f='author'),f=CSL_NAMES_MAPPINGS[f],!!f)&&('lastName'in c||'firstName'in c?(a={family:c.lastName||'',given:c.firstName||''},a.family&&a.given&&(1<a.family.length&&'"'==a.family.charAt(0)&&'"'==a.family.charAt(a.family.length-1)?a.family=a.family.substr(1,a.family.length-2):CSL.parseParticles(a,!0))):'name'in c&&(a={literal:c.name}),j[f]?j[f].push(a):j[f]=[a])}}for(let g in CSL_DATE_MAPPINGS){let b=i[CSL_DATE_MAPPINGS[g]];if(!b){let a=getFieldIDFromTypeAndBase(f,CSL_DATE_MAPPINGS[g]);a&&(b=i[fields[a]])}if(b){let d=strToDate(b),a=[];d.year?(a.push(d.year),void 0!==d.month&&(a.push(d.month+1),d.day&&a.push(d.day)),j[g]={"date-parts":[a]},d.part&&void 0===d.month&&(j[g].season=d.part)):j[g]={literal:b}}}return j};

},{"./csl-mappings":15,"./default-item-type-creator-type-lookup":17,"./fields":18,"./item-types":20,"./str-to-date":22,"./type-specific-field-map":23,"zotero-base-mappings":9}],20:[function(require,module,exports){
'use strict';const itemTypes={1:'note',2:'book',3:'bookSection',4:'journalArticle',5:'magazineArticle',6:'newspaperArticle',7:'thesis',8:'letter',9:'manuscript',10:'interview',11:'film',12:'artwork',13:'webpage',14:'attachment',15:'report',16:'bill',17:'case',18:'hearing',19:'patent',20:'statute',21:'email',22:'map',23:'blogPost',24:'instantMessage',25:'forumPost',26:'audioRecording',27:'presentation',28:'videoRecording',29:'tvBroadcast',30:'radioBroadcast',31:'podcast',32:'computerProgram',33:'conferencePaper',34:'document',35:'encyclopediaArticle',36:'dictionaryEntry'};Object.keys(itemTypes).map((b)=>itemTypes[itemTypes[b]]=b),module.exports=itemTypes;

},{}],21:[function(require,module,exports){
'use strict';module.exports=(d,a,b)=>{for(d=d?d+'':'';d.length<b;)d=a+d;return d};

},{}],22:[function(require,module,exports){
'use strict';const dateToSQL=require('./date-to-sql'),months=['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec','january','february','march','april','may','june','july','august','september','october','november','december'],_slashRe=/^(.*?)\b([0-9]{1,4})(?:([\-\/\.\u5e74])([0-9]{1,2}))?(?:([\-\/\.\u6708])([0-9]{1,4}))?((?:\b|[^0-9]).*?)$/,_yearRe=/^(.*?)\b((?:circa |around |about |c\.? ?)?[0-9]{1,4}(?: ?B\.? ?C\.?(?: ?E\.?)?| ?C\.? ?E\.?| ?A\.? ?D\.?)|[0-9]{3,4})\b(.*?)$/i,_monthRe=new RegExp('^(.*)\\b('+months.join('|')+')[^ ]*(?: (.*)$|$)','i'),_dayRe=/\b([0-9]{1,2})(?:st|nd|rd|th)?\b(.*)/i,_insertDateOrderPart=(e,f,b)=>{if(!e)return f;if(!0===b.before)return f+e;if(!0===b.after)return e+f;if(b.before){let a=e.indexOf(b.before);return-1==a?e:e.replace(new RegExp('('+b.before+')'),f+'$1')}if(b.after){let a=e.indexOf(b.after);return-1==a?e+f:e.replace(new RegExp('('+b.after+')'),'$1'+f)}return e+f};module.exports=(i)=>{var p={order:''};if(!i)return p;var b=[];let c=(i+'').toLowerCase();i='yesterday'==c?dateToSQL(new Date(Date.now()-8.64e7)).substr(0,10):'today'==c?dateToSQL(new Date).substr(0,10):'tomorrow'==c?dateToSQL(new Date(Date.now()+8.64e7)).substr(0,10):i.toString().replace(/^\s+|\s+$/g,'').replace(/\s+/,' ');let d=_slashRe.exec(i);if(d&&(!d[5]||!d[3]||d[3]==d[5]||'\u5E74'==d[3]&&'\u6708'==d[5])&&(d[2]&&d[4]&&d[6]||!d[1]&&!d[7])){if(3==d[2].length||4==d[2].length||'\u5E74'==d[3])p.year=d[2],p.month=d[4],p.day=d[6],p.order+=d[2]?'y':'',p.order+=d[4]?'m':'',p.order+=d[6]?'d':'';else if(d[2]&&!d[4]&&d[6])p.month=d[2],p.year=d[6],p.order+=d[2]?'m':'',p.order+=d[6]?'y':'';else{var e=window.navigator.language?window.navigator.language.substr(3):'US';'US'==e||'FM'==e||'PW'==e||'PH'==e?(p.month=d[2],p.day=d[4],p.order+=d[2]?'m':'',p.order+=d[4]?'d':''):(p.month=d[4],p.day=d[2],p.order+=d[2]?'d':'',p.order+=d[4]?'m':''),p.year=d[6],p.order+='y'}if(p.year&&(p.year=parseInt(p.year,10)),p.day&&(p.day=parseInt(p.day,10)),p.month&&(p.month=parseInt(p.month,10),12<p.month)){var f=p.day;p.day=p.month,p.month=f,p.order=p.order.replace('m','D').replace('d','M').replace('D','d').replace('M','m')}if((!p.month||12>=p.month)&&(!p.day||31>=p.day)){if(p.year&&100>p.year){var g=new Date,h=g.getFullYear(),j=h%100,k=h-j;p.year=p.year<=j?k+p.year:k-100+p.year}p.month?p.month--:delete p.month,b.push({part:d[1],before:!0},{part:d[7]})}else{var p={order:''};b.push({part:i})}}else b.push({part:i});if(!p.year)for(let c in b){let a=_yearRe.exec(b[c].part);if(a){p.year=a[2],p.order=_insertDateOrderPart(p.order,'y',b[c]),b.splice(c,1,{part:a[1],before:!0},{part:a[3]});break}}if(void 0===p.month)for(let c in b){let a=_monthRe.exec(b[c].part);if(a){p.month=months.indexOf(a[2].toLowerCase())%12,p.order=_insertDateOrderPart(p.order,'m',b[c]),b.splice(c,1,{part:a[1],before:'m'},{part:a[3],after:'m'});break}}if(!p.day)for(let c in b){let a=_dayRe.exec(b[c].part);if(a){var l,q=parseInt(a[1],10);if(31>=q){p.day=q,p.order=_insertDateOrderPart(p.order,'d',b[c]),0<a.index?(l=b[c].part.substr(0,a.index),a[2]&&(l+=' '+a[2])):l=a[2],b.splice(c,1,{part:l});break}}}for(var o in p.part='',b)p.part+=b[o].part+' ';return p.part&&(p.part=p.part.replace(/^[^A-Za-z0-9]+|[^A-Za-z0-9]+$/g,'')),(''===p.part||void 0==p.part)&&delete p.part,(p.year||0===p.year)&&(p.year+=''),p};

},{"./date-to-sql":16}],23:[function(require,module,exports){
const fields=require('./fields'),itemTypes=require('./item-types'),typeSpecificFieldMap={780:115,1800:89,1900:69,2156:65,2412:66,2669:64,2824:21,2924:122,2925:63,3181:59,3340:91,3436:70,3848:31,3900:92,3948:32,4100:94,4106:95,4156:93,4356:97,4362:98,4366:96,4412:117,4462:111,4668:99,4878:52,4924:50,5134:100,5180:101,5230:112,5486:113,5740:67,5900:107,5996:70,6412:104,6508:79,6664:72,6765:71,7020:74,7176:76,7277:63,7432:78,7436:119,7484:105,7533:63,7688:78,7692:119,7740:105,7789:71,7996:105,8045:80,8200:83,8460:114,8972:85,9228:86};module.exports={map:typeSpecificFieldMap,getFieldIDFromTypeAndBase:(c,d)=>{return c='number'==typeof c?c:itemTypes[c],d='number'==typeof d?d:fields[d],typeSpecificFieldMap[(c<<8)+d]}};

},{"./fields":18,"./item-types":20}]},{},[13])(13)
});

//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJub2RlX21vZHVsZXMvcGFyc2UtbGluay1oZWFkZXIvaW5kZXguanMiLCJub2RlX21vZHVsZXMvcHVueWNvZGUvcHVueWNvZGUuanMiLCJub2RlX21vZHVsZXMvcXVlcnlzdHJpbmctZXMzL2RlY29kZS5qcyIsIm5vZGVfbW9kdWxlcy9xdWVyeXN0cmluZy1lczMvZW5jb2RlLmpzIiwibm9kZV9tb2R1bGVzL3F1ZXJ5c3RyaW5nLWVzMy9pbmRleC5qcyIsIm5vZGVfbW9kdWxlcy91cmwvdXJsLmpzIiwibm9kZV9tb2R1bGVzL3VybC91dGlsLmpzIiwibm9kZV9tb2R1bGVzL3h0ZW5kL2ltbXV0YWJsZS5qcyIsIm5vZGVfbW9kdWxlcy96b3Rlcm8tYmFzZS1tYXBwaW5ncy9pbmRleC5qcyIsInNyYy9qcy9iaWIvYmliLmpzIiwic3JjL2pzL2JpYi9kZWZhdWx0cy5qcyIsInNyYy9qcy9iaWIvdXRpbHMuanMiLCJzcmMvanMvbWFpbi5qcyIsInNyYy9qcy96b3Rlcm8tc2hpbS9jcmVhdG9yLXR5cGVzLmpzIiwic3JjL2pzL3pvdGVyby1zaGltL2NzbC1tYXBwaW5ncy5qcyIsInNyYy9qcy96b3Rlcm8tc2hpbS9kYXRlLXRvLXNxbC5qcyIsInNyYy9qcy96b3Rlcm8tc2hpbS9kZWZhdWx0LWl0ZW0tdHlwZS1jcmVhdG9yLXR5cGUtbG9va3VwLmpzIiwic3JjL2pzL3pvdGVyby1zaGltL2ZpZWxkcy5qcyIsInNyYy9qcy96b3Rlcm8tc2hpbS9pdGVtLXRvLWNzbC1qc29uLmpzIiwic3JjL2pzL3pvdGVyby1zaGltL2l0ZW0tdHlwZXMuanMiLCJzcmMvanMvem90ZXJvLXNoaW0vbHBhZC5qcyIsInNyYy9qcy96b3Rlcm8tc2hpbS9zdHItdG8tZGF0ZS5qcyIsInNyYy9qcy96b3Rlcm8tc2hpbS90eXBlLXNwZWNpZmljLWZpZWxkLW1hcC5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7O0FDeERBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7OztBQ3JoQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDcEZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDckZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDSkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7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QyxLLEFBTmUiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbigpe2Z1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt2YXIgZj1uZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpO3Rocm93IGYuY29kZT1cIk1PRFVMRV9OT1RfRk9VTkRcIixmfXZhciBsPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChsLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGwsbC5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfXJldHVybiBlfSkoKSIsIid1c2Ugc3RyaWN0JztcblxudmFyIHFzID0gcmVxdWlyZSgncXVlcnlzdHJpbmcnKVxuICAsIHVybCA9IHJlcXVpcmUoJ3VybCcpXG4gICwgeHRlbmQgPSByZXF1aXJlKCd4dGVuZCcpO1xuXG5mdW5jdGlvbiBoYXNSZWwoeCkge1xuICByZXR1cm4geCAmJiB4LnJlbDtcbn1cblxuZnVuY3Rpb24gaW50b1JlbHMgKGFjYywgeCkge1xuICBmdW5jdGlvbiBzcGxpdFJlbCAocmVsKSB7XG4gICAgYWNjW3JlbF0gPSB4dGVuZCh4LCB7IHJlbDogcmVsIH0pO1xuICB9XG5cbiAgeC5yZWwuc3BsaXQoL1xccysvKS5mb3JFYWNoKHNwbGl0UmVsKTtcblxuICByZXR1cm4gYWNjO1xufVxuXG5mdW5jdGlvbiBjcmVhdGVPYmplY3RzIChhY2MsIHApIHtcbiAgLy8gcmVsPVwibmV4dFwiID0+IDE6IHJlbCAyOiBuZXh0XG4gIHZhciBtID0gcC5tYXRjaCgvXFxzKiguKylcXHMqPVxccypcIj8oW15cIl0rKVwiPy8pXG4gIGlmIChtKSBhY2NbbVsxXV0gPSBtWzJdO1xuICByZXR1cm4gYWNjO1xufVxuXG5mdW5jdGlvbiBwYXJzZUxpbmsobGluaykge1xuICB0cnkge1xuICAgIHZhciBtICAgICAgICAgPSAgbGluay5tYXRjaCgvPD8oW14+XSopPiguKikvKVxuICAgICAgLCBsaW5rVXJsICAgPSAgbVsxXVxuICAgICAgLCBwYXJ0cyAgICAgPSAgbVsyXS5zcGxpdCgnOycpXG4gICAgICAsIHBhcnNlZFVybCA9ICB1cmwucGFyc2UobGlua1VybClcbiAgICAgICwgcXJ5ICAgICAgID0gIHFzLnBhcnNlKHBhcnNlZFVybC5xdWVyeSk7XG5cbiAgICBwYXJ0cy5zaGlmdCgpO1xuXG4gICAgdmFyIGluZm8gPSBwYXJ0c1xuICAgICAgLnJlZHVjZShjcmVhdGVPYmplY3RzLCB7fSk7XG4gICAgXG4gICAgaW5mbyA9IHh0ZW5kKHFyeSwgaW5mbyk7XG4gICAgaW5mby51cmwgPSBsaW5rVXJsO1xuICAgIHJldHVybiBpbmZvO1xuICB9IGNhdGNoIChlKSB7XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cbn1cblxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiAobGlua0hlYWRlcikge1xuICBpZiAoIWxpbmtIZWFkZXIpIHJldHVybiBudWxsO1xuXG4gIHJldHVybiBsaW5rSGVhZGVyLnNwbGl0KC8sXFxzKjwvKVxuICAgLm1hcChwYXJzZUxpbmspXG4gICAuZmlsdGVyKGhhc1JlbClcbiAgIC5yZWR1Y2UoaW50b1JlbHMsIHt9KTtcbn07XG4iLCIvKiEgaHR0cHM6Ly9tdGhzLmJlL3B1bnljb2RlIHYxLjQuMSBieSBAbWF0aGlhcyAqL1xuOyhmdW5jdGlvbihyb290KSB7XG5cblx0LyoqIERldGVjdCBmcmVlIHZhcmlhYmxlcyAqL1xuXHR2YXIgZnJlZUV4cG9ydHMgPSB0eXBlb2YgZXhwb3J0cyA9PSAnb2JqZWN0JyAmJiBleHBvcnRzICYmXG5cdFx0IWV4cG9ydHMubm9kZVR5cGUgJiYgZXhwb3J0cztcblx0dmFyIGZyZWVNb2R1bGUgPSB0eXBlb2YgbW9kdWxlID09ICdvYmplY3QnICYmIG1vZHVsZSAmJlxuXHRcdCFtb2R1bGUubm9kZVR5cGUgJiYgbW9kdWxlO1xuXHR2YXIgZnJlZUdsb2JhbCA9IHR5cGVvZiBnbG9iYWwgPT0gJ29iamVjdCcgJiYgZ2xvYmFsO1xuXHRpZiAoXG5cdFx0ZnJlZUdsb2JhbC5nbG9iYWwgPT09IGZyZWVHbG9iYWwgfHxcblx0XHRmcmVlR2xvYmFsLndpbmRvdyA9PT0gZnJlZUdsb2JhbCB8fFxuXHRcdGZyZWVHbG9iYWwuc2VsZiA9PT0gZnJlZUdsb2JhbFxuXHQpIHtcblx0XHRyb290ID0gZnJlZUdsb2JhbDtcblx0fVxuXG5cdC8qKlxuXHQgKiBUaGUgYHB1bnljb2RlYCBvYmplY3QuXG5cdCAqIEBuYW1lIHB1bnljb2RlXG5cdCAqIEB0eXBlIE9iamVjdFxuXHQgKi9cblx0dmFyIHB1bnljb2RlLFxuXG5cdC8qKiBIaWdoZXN0IHBvc2l0aXZlIHNpZ25lZCAzMi1iaXQgZmxvYXQgdmFsdWUgKi9cblx0bWF4SW50ID0gMjE0NzQ4MzY0NywgLy8gYWthLiAweDdGRkZGRkZGIG9yIDJeMzEtMVxuXG5cdC8qKiBCb290c3RyaW5nIHBhcmFtZXRlcnMgKi9cblx0YmFzZSA9IDM2LFxuXHR0TWluID0gMSxcblx0dE1heCA9IDI2LFxuXHRza2V3ID0gMzgsXG5cdGRhbXAgPSA3MDAsXG5cdGluaXRpYWxCaWFzID0gNzIsXG5cdGluaXRpYWxOID0gMTI4LCAvLyAweDgwXG5cdGRlbGltaXRlciA9ICctJywgLy8gJ1xceDJEJ1xuXG5cdC8qKiBSZWd1bGFyIGV4cHJlc3Npb25zICovXG5cdHJlZ2V4UHVueWNvZGUgPSAvXnhuLS0vLFxuXHRyZWdleE5vbkFTQ0lJID0gL1teXFx4MjAtXFx4N0VdLywgLy8gdW5wcmludGFibGUgQVNDSUkgY2hhcnMgKyBub24tQVNDSUkgY2hhcnNcblx0cmVnZXhTZXBhcmF0b3JzID0gL1tcXHgyRVxcdTMwMDJcXHVGRjBFXFx1RkY2MV0vZywgLy8gUkZDIDM0OTAgc2VwYXJhdG9yc1xuXG5cdC8qKiBFcnJvciBtZXNzYWdlcyAqL1xuXHRlcnJvcnMgPSB7XG5cdFx0J292ZXJmbG93JzogJ092ZXJmbG93OiBpbnB1dCBuZWVkcyB3aWRlciBpbnRlZ2VycyB0byBwcm9jZXNzJyxcblx0XHQnbm90LWJhc2ljJzogJ0lsbGVnYWwgaW5wdXQgPj0gMHg4MCAobm90IGEgYmFzaWMgY29kZSBwb2ludCknLFxuXHRcdCdpbnZhbGlkLWlucHV0JzogJ0ludmFsaWQgaW5wdXQnXG5cdH0sXG5cblx0LyoqIENvbnZlbmllbmNlIHNob3J0Y3V0cyAqL1xuXHRiYXNlTWludXNUTWluID0gYmFzZSAtIHRNaW4sXG5cdGZsb29yID0gTWF0aC5mbG9vcixcblx0c3RyaW5nRnJvbUNoYXJDb2RlID0gU3RyaW5nLmZyb21DaGFyQ29kZSxcblxuXHQvKiogVGVtcG9yYXJ5IHZhcmlhYmxlICovXG5cdGtleTtcblxuXHQvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuXHQvKipcblx0ICogQSBnZW5lcmljIGVycm9yIHV0aWxpdHkgZnVuY3Rpb24uXG5cdCAqIEBwcml2YXRlXG5cdCAqIEBwYXJhbSB7U3RyaW5nfSB0eXBlIFRoZSBlcnJvciB0eXBlLlxuXHQgKiBAcmV0dXJucyB7RXJyb3J9IFRocm93cyBhIGBSYW5nZUVycm9yYCB3aXRoIHRoZSBhcHBsaWNhYmxlIGVycm9yIG1lc3NhZ2UuXG5cdCAqL1xuXHRmdW5jdGlvbiBlcnJvcih0eXBlKSB7XG5cdFx0dGhyb3cgbmV3IFJhbmdlRXJyb3IoZXJyb3JzW3R5cGVdKTtcblx0fVxuXG5cdC8qKlxuXHQgKiBBIGdlbmVyaWMgYEFycmF5I21hcGAgdXRpbGl0eSBmdW5jdGlvbi5cblx0ICogQHByaXZhdGVcblx0ICogQHBhcmFtIHtBcnJheX0gYXJyYXkgVGhlIGFycmF5IHRvIGl0ZXJhdGUgb3Zlci5cblx0ICogQHBhcmFtIHtGdW5jdGlvbn0gY2FsbGJhY2sgVGhlIGZ1bmN0aW9uIHRoYXQgZ2V0cyBjYWxsZWQgZm9yIGV2ZXJ5IGFycmF5XG5cdCAqIGl0ZW0uXG5cdCAqIEByZXR1cm5zIHtBcnJheX0gQSBuZXcgYXJyYXkgb2YgdmFsdWVzIHJldHVybmVkIGJ5IHRoZSBjYWxsYmFjayBmdW5jdGlvbi5cblx0ICovXG5cdGZ1bmN0aW9uIG1hcChhcnJheSwgZm4pIHtcblx0XHR2YXIgbGVuZ3RoID0gYXJyYXkubGVuZ3RoO1xuXHRcdHZhciByZXN1bHQgPSBbXTtcblx0XHR3aGlsZSAobGVuZ3RoLS0pIHtcblx0XHRcdHJlc3VsdFtsZW5ndGhdID0gZm4oYXJyYXlbbGVuZ3RoXSk7XG5cdFx0fVxuXHRcdHJldHVybiByZXN1bHQ7XG5cdH1cblxuXHQvKipcblx0ICogQSBzaW1wbGUgYEFycmF5I21hcGAtbGlrZSB3cmFwcGVyIHRvIHdvcmsgd2l0aCBkb21haW4gbmFtZSBzdHJpbmdzIG9yIGVtYWlsXG5cdCAqIGFkZHJlc3Nlcy5cblx0ICogQHByaXZhdGVcblx0ICogQHBhcmFtIHtTdHJpbmd9IGRvbWFpbiBUaGUgZG9tYWluIG5hbWUgb3IgZW1haWwgYWRkcmVzcy5cblx0ICogQHBhcmFtIHtGdW5jdGlvbn0gY2FsbGJhY2sgVGhlIGZ1bmN0aW9uIHRoYXQgZ2V0cyBjYWxsZWQgZm9yIGV2ZXJ5XG5cdCAqIGNoYXJhY3Rlci5cblx0ICogQHJldHVybnMge0FycmF5fSBBIG5ldyBzdHJpbmcgb2YgY2hhcmFjdGVycyByZXR1cm5lZCBieSB0aGUgY2FsbGJhY2tcblx0ICogZnVuY3Rpb24uXG5cdCAqL1xuXHRmdW5jdGlvbiBtYXBEb21haW4oc3RyaW5nLCBmbikge1xuXHRcdHZhciBwYXJ0cyA9IHN0cmluZy5zcGxpdCgnQCcpO1xuXHRcdHZhciByZXN1bHQgPSAnJztcblx0XHRpZiAocGFydHMubGVuZ3RoID4gMSkge1xuXHRcdFx0Ly8gSW4gZW1haWwgYWRkcmVzc2VzLCBvbmx5IHRoZSBkb21haW4gbmFtZSBzaG91bGQgYmUgcHVueWNvZGVkLiBMZWF2ZVxuXHRcdFx0Ly8gdGhlIGxvY2FsIHBhcnQgKGkuZS4gZXZlcnl0aGluZyB1cCB0byBgQGApIGludGFjdC5cblx0XHRcdHJlc3VsdCA9IHBhcnRzWzBdICsgJ0AnO1xuXHRcdFx0c3RyaW5nID0gcGFydHNbMV07XG5cdFx0fVxuXHRcdC8vIEF2b2lkIGBzcGxpdChyZWdleClgIGZvciBJRTggY29tcGF0aWJpbGl0eS4gU2VlICMxNy5cblx0XHRzdHJpbmcgPSBzdHJpbmcucmVwbGFjZShyZWdleFNlcGFyYXRvcnMsICdcXHgyRScpO1xuXHRcdHZhciBsYWJlbHMgPSBzdHJpbmcuc3BsaXQoJy4nKTtcblx0XHR2YXIgZW5jb2RlZCA9IG1hcChsYWJlbHMsIGZuKS5qb2luKCcuJyk7XG5cdFx0cmV0dXJuIHJlc3VsdCArIGVuY29kZWQ7XG5cdH1cblxuXHQvKipcblx0ICogQ3JlYXRlcyBhbiBhcnJheSBjb250YWluaW5nIHRoZSBudW1lcmljIGNvZGUgcG9pbnRzIG9mIGVhY2ggVW5pY29kZVxuXHQgKiBjaGFyYWN0ZXIgaW4gdGhlIHN0cmluZy4gV2hpbGUgSmF2YVNjcmlwdCB1c2VzIFVDUy0yIGludGVybmFsbHksXG5cdCAqIHRoaXMgZnVuY3Rpb24gd2lsbCBjb252ZXJ0IGEgcGFpciBvZiBzdXJyb2dhdGUgaGFsdmVzIChlYWNoIG9mIHdoaWNoXG5cdCAqIFVDUy0yIGV4cG9zZXMgYXMgc2VwYXJhdGUgY2hhcmFjdGVycykgaW50byBhIHNpbmdsZSBjb2RlIHBvaW50LFxuXHQgKiBtYXRjaGluZyBVVEYtMTYuXG5cdCAqIEBzZWUgYHB1bnljb2RlLnVjczIuZW5jb2RlYFxuXHQgKiBAc2VlIDxodHRwczovL21hdGhpYXNieW5lbnMuYmUvbm90ZXMvamF2YXNjcmlwdC1lbmNvZGluZz5cblx0ICogQG1lbWJlck9mIHB1bnljb2RlLnVjczJcblx0ICogQG5hbWUgZGVjb2RlXG5cdCAqIEBwYXJhbSB7U3RyaW5nfSBzdHJpbmcgVGhlIFVuaWNvZGUgaW5wdXQgc3RyaW5nIChVQ1MtMikuXG5cdCAqIEByZXR1cm5zIHtBcnJheX0gVGhlIG5ldyBhcnJheSBvZiBjb2RlIHBvaW50cy5cblx0ICovXG5cdGZ1bmN0aW9uIHVjczJkZWNvZGUoc3RyaW5nKSB7XG5cdFx0dmFyIG91dHB1dCA9IFtdLFxuXHRcdCAgICBjb3VudGVyID0gMCxcblx0XHQgICAgbGVuZ3RoID0gc3RyaW5nLmxlbmd0aCxcblx0XHQgICAgdmFsdWUsXG5cdFx0ICAgIGV4dHJhO1xuXHRcdHdoaWxlIChjb3VudGVyIDwgbGVuZ3RoKSB7XG5cdFx0XHR2YWx1ZSA9IHN0cmluZy5jaGFyQ29kZUF0KGNvdW50ZXIrKyk7XG5cdFx0XHRpZiAodmFsdWUgPj0gMHhEODAwICYmIHZhbHVlIDw9IDB4REJGRiAmJiBjb3VudGVyIDwgbGVuZ3RoKSB7XG5cdFx0XHRcdC8vIGhpZ2ggc3Vycm9nYXRlLCBhbmQgdGhlcmUgaXMgYSBuZXh0IGNoYXJhY3RlclxuXHRcdFx0XHRleHRyYSA9IHN0cmluZy5jaGFyQ29kZUF0KGNvdW50ZXIrKyk7XG5cdFx0XHRcdGlmICgoZXh0cmEgJiAweEZDMDApID09IDB4REMwMCkgeyAvLyBsb3cgc3Vycm9nYXRlXG5cdFx0XHRcdFx0b3V0cHV0LnB1c2goKCh2YWx1ZSAmIDB4M0ZGKSA8PCAxMCkgKyAoZXh0cmEgJiAweDNGRikgKyAweDEwMDAwKTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHQvLyB1bm1hdGNoZWQgc3Vycm9nYXRlOyBvbmx5IGFwcGVuZCB0aGlzIGNvZGUgdW5pdCwgaW4gY2FzZSB0aGUgbmV4dFxuXHRcdFx0XHRcdC8vIGNvZGUgdW5pdCBpcyB0aGUgaGlnaCBzdXJyb2dhdGUgb2YgYSBzdXJyb2dhdGUgcGFpclxuXHRcdFx0XHRcdG91dHB1dC5wdXNoKHZhbHVlKTtcblx0XHRcdFx0XHRjb3VudGVyLS07XG5cdFx0XHRcdH1cblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdG91dHB1dC5wdXNoKHZhbHVlKTtcblx0XHRcdH1cblx0XHR9XG5cdFx0cmV0dXJuIG91dHB1dDtcblx0fVxuXG5cdC8qKlxuXHQgKiBDcmVhdGVzIGEgc3RyaW5nIGJhc2VkIG9uIGFuIGFycmF5IG9mIG51bWVyaWMgY29kZSBwb2ludHMuXG5cdCAqIEBzZWUgYHB1bnljb2RlLnVjczIuZGVjb2RlYFxuXHQgKiBAbWVtYmVyT2YgcHVueWNvZGUudWNzMlxuXHQgKiBAbmFtZSBlbmNvZGVcblx0ICogQHBhcmFtIHtBcnJheX0gY29kZVBvaW50cyBUaGUgYXJyYXkgb2YgbnVtZXJpYyBjb2RlIHBvaW50cy5cblx0ICogQHJldHVybnMge1N0cmluZ30gVGhlIG5ldyBVbmljb2RlIHN0cmluZyAoVUNTLTIpLlxuXHQgKi9cblx0ZnVuY3Rpb24gdWNzMmVuY29kZShhcnJheSkge1xuXHRcdHJldHVybiBtYXAoYXJyYXksIGZ1bmN0aW9uKHZhbHVlKSB7XG5cdFx0XHR2YXIgb3V0cHV0ID0gJyc7XG5cdFx0XHRpZiAodmFsdWUgPiAweEZGRkYpIHtcblx0XHRcdFx0dmFsdWUgLT0gMHgxMDAwMDtcblx0XHRcdFx0b3V0cHV0ICs9IHN0cmluZ0Zyb21DaGFyQ29kZSh2YWx1ZSA+Pj4gMTAgJiAweDNGRiB8IDB4RDgwMCk7XG5cdFx0XHRcdHZhbHVlID0gMHhEQzAwIHwgdmFsdWUgJiAweDNGRjtcblx0XHRcdH1cblx0XHRcdG91dHB1dCArPSBzdHJpbmdGcm9tQ2hhckNvZGUodmFsdWUpO1xuXHRcdFx0cmV0dXJuIG91dHB1dDtcblx0XHR9KS5qb2luKCcnKTtcblx0fVxuXG5cdC8qKlxuXHQgKiBDb252ZXJ0cyBhIGJhc2ljIGNvZGUgcG9pbnQgaW50byBhIGRpZ2l0L2ludGVnZXIuXG5cdCAqIEBzZWUgYGRpZ2l0VG9CYXNpYygpYFxuXHQgKiBAcHJpdmF0ZVxuXHQgKiBAcGFyYW0ge051bWJlcn0gY29kZVBvaW50IFRoZSBiYXNpYyBudW1lcmljIGNvZGUgcG9pbnQgdmFsdWUuXG5cdCAqIEByZXR1cm5zIHtOdW1iZXJ9IFRoZSBudW1lcmljIHZhbHVlIG9mIGEgYmFzaWMgY29kZSBwb2ludCAoZm9yIHVzZSBpblxuXHQgKiByZXByZXNlbnRpbmcgaW50ZWdlcnMpIGluIHRoZSByYW5nZSBgMGAgdG8gYGJhc2UgLSAxYCwgb3IgYGJhc2VgIGlmXG5cdCAqIHRoZSBjb2RlIHBvaW50IGRvZXMgbm90IHJlcHJlc2VudCBhIHZhbHVlLlxuXHQgKi9cblx0ZnVuY3Rpb24gYmFzaWNUb0RpZ2l0KGNvZGVQb2ludCkge1xuXHRcdGlmIChjb2RlUG9pbnQgLSA0OCA8IDEwKSB7XG5cdFx0XHRyZXR1cm4gY29kZVBvaW50IC0gMjI7XG5cdFx0fVxuXHRcdGlmIChjb2RlUG9pbnQgLSA2NSA8IDI2KSB7XG5cdFx0XHRyZXR1cm4gY29kZVBvaW50IC0gNjU7XG5cdFx0fVxuXHRcdGlmIChjb2RlUG9pbnQgLSA5NyA8IDI2KSB7XG5cdFx0XHRyZXR1cm4gY29kZVBvaW50IC0gOTc7XG5cdFx0fVxuXHRcdHJldHVybiBiYXNlO1xuXHR9XG5cblx0LyoqXG5cdCAqIENvbnZlcnRzIGEgZGlnaXQvaW50ZWdlciBpbnRvIGEgYmFzaWMgY29kZSBwb2ludC5cblx0ICogQHNlZSBgYmFzaWNUb0RpZ2l0KClgXG5cdCAqIEBwcml2YXRlXG5cdCAqIEBwYXJhbSB7TnVtYmVyfSBkaWdpdCBUaGUgbnVtZXJpYyB2YWx1ZSBvZiBhIGJhc2ljIGNvZGUgcG9pbnQuXG5cdCAqIEByZXR1cm5zIHtOdW1iZXJ9IFRoZSBiYXNpYyBjb2RlIHBvaW50IHdob3NlIHZhbHVlICh3aGVuIHVzZWQgZm9yXG5cdCAqIHJlcHJlc2VudGluZyBpbnRlZ2VycykgaXMgYGRpZ2l0YCwgd2hpY2ggbmVlZHMgdG8gYmUgaW4gdGhlIHJhbmdlXG5cdCAqIGAwYCB0byBgYmFzZSAtIDFgLiBJZiBgZmxhZ2AgaXMgbm9uLXplcm8sIHRoZSB1cHBlcmNhc2UgZm9ybSBpc1xuXHQgKiB1c2VkOyBlbHNlLCB0aGUgbG93ZXJjYXNlIGZvcm0gaXMgdXNlZC4gVGhlIGJlaGF2aW9yIGlzIHVuZGVmaW5lZFxuXHQgKiBpZiBgZmxhZ2AgaXMgbm9uLXplcm8gYW5kIGBkaWdpdGAgaGFzIG5vIHVwcGVyY2FzZSBmb3JtLlxuXHQgKi9cblx0ZnVuY3Rpb24gZGlnaXRUb0Jhc2ljKGRpZ2l0LCBmbGFnKSB7XG5cdFx0Ly8gIDAuLjI1IG1hcCB0byBBU0NJSSBhLi56IG9yIEEuLlpcblx0XHQvLyAyNi4uMzUgbWFwIHRvIEFTQ0lJIDAuLjlcblx0XHRyZXR1cm4gZGlnaXQgKyAyMiArIDc1ICogKGRpZ2l0IDwgMjYpIC0gKChmbGFnICE9IDApIDw8IDUpO1xuXHR9XG5cblx0LyoqXG5cdCAqIEJpYXMgYWRhcHRhdGlvbiBmdW5jdGlvbiBhcyBwZXIgc2VjdGlvbiAzLjQgb2YgUkZDIDM0OTIuXG5cdCAqIGh0dHBzOi8vdG9vbHMuaWV0Zi5vcmcvaHRtbC9yZmMzNDkyI3NlY3Rpb24tMy40XG5cdCAqIEBwcml2YXRlXG5cdCAqL1xuXHRmdW5jdGlvbiBhZGFwdChkZWx0YSwgbnVtUG9pbnRzLCBmaXJzdFRpbWUpIHtcblx0XHR2YXIgayA9IDA7XG5cdFx0ZGVsdGEgPSBmaXJzdFRpbWUgPyBmbG9vcihkZWx0YSAvIGRhbXApIDogZGVsdGEgPj4gMTtcblx0XHRkZWx0YSArPSBmbG9vcihkZWx0YSAvIG51bVBvaW50cyk7XG5cdFx0Zm9yICgvKiBubyBpbml0aWFsaXphdGlvbiAqLzsgZGVsdGEgPiBiYXNlTWludXNUTWluICogdE1heCA+PiAxOyBrICs9IGJhc2UpIHtcblx0XHRcdGRlbHRhID0gZmxvb3IoZGVsdGEgLyBiYXNlTWludXNUTWluKTtcblx0XHR9XG5cdFx0cmV0dXJuIGZsb29yKGsgKyAoYmFzZU1pbnVzVE1pbiArIDEpICogZGVsdGEgLyAoZGVsdGEgKyBza2V3KSk7XG5cdH1cblxuXHQvKipcblx0ICogQ29udmVydHMgYSBQdW55Y29kZSBzdHJpbmcgb2YgQVNDSUktb25seSBzeW1ib2xzIHRvIGEgc3RyaW5nIG9mIFVuaWNvZGVcblx0ICogc3ltYm9scy5cblx0ICogQG1lbWJlck9mIHB1bnljb2RlXG5cdCAqIEBwYXJhbSB7U3RyaW5nfSBpbnB1dCBUaGUgUHVueWNvZGUgc3RyaW5nIG9mIEFTQ0lJLW9ubHkgc3ltYm9scy5cblx0ICogQHJldHVybnMge1N0cmluZ30gVGhlIHJlc3VsdGluZyBzdHJpbmcgb2YgVW5pY29kZSBzeW1ib2xzLlxuXHQgKi9cblx0ZnVuY3Rpb24gZGVjb2RlKGlucHV0KSB7XG5cdFx0Ly8gRG9uJ3QgdXNlIFVDUy0yXG5cdFx0dmFyIG91dHB1dCA9IFtdLFxuXHRcdCAgICBpbnB1dExlbmd0aCA9IGlucHV0Lmxlbmd0aCxcblx0XHQgICAgb3V0LFxuXHRcdCAgICBpID0gMCxcblx0XHQgICAgbiA9IGluaXRpYWxOLFxuXHRcdCAgICBiaWFzID0gaW5pdGlhbEJpYXMsXG5cdFx0ICAgIGJhc2ljLFxuXHRcdCAgICBqLFxuXHRcdCAgICBpbmRleCxcblx0XHQgICAgb2xkaSxcblx0XHQgICAgdyxcblx0XHQgICAgayxcblx0XHQgICAgZGlnaXQsXG5cdFx0ICAgIHQsXG5cdFx0ICAgIC8qKiBDYWNoZWQgY2FsY3VsYXRpb24gcmVzdWx0cyAqL1xuXHRcdCAgICBiYXNlTWludXNUO1xuXG5cdFx0Ly8gSGFuZGxlIHRoZSBiYXNpYyBjb2RlIHBvaW50czogbGV0IGBiYXNpY2AgYmUgdGhlIG51bWJlciBvZiBpbnB1dCBjb2RlXG5cdFx0Ly8gcG9pbnRzIGJlZm9yZSB0aGUgbGFzdCBkZWxpbWl0ZXIsIG9yIGAwYCBpZiB0aGVyZSBpcyBub25lLCB0aGVuIGNvcHlcblx0XHQvLyB0aGUgZmlyc3QgYmFzaWMgY29kZSBwb2ludHMgdG8gdGhlIG91dHB1dC5cblxuXHRcdGJhc2ljID0gaW5wdXQubGFzdEluZGV4T2YoZGVsaW1pdGVyKTtcblx0XHRpZiAoYmFzaWMgPCAwKSB7XG5cdFx0XHRiYXNpYyA9IDA7XG5cdFx0fVxuXG5cdFx0Zm9yIChqID0gMDsgaiA8IGJhc2ljOyArK2opIHtcblx0XHRcdC8vIGlmIGl0J3Mgbm90IGEgYmFzaWMgY29kZSBwb2ludFxuXHRcdFx0aWYgKGlucHV0LmNoYXJDb2RlQXQoaikgPj0gMHg4MCkge1xuXHRcdFx0XHRlcnJvcignbm90LWJhc2ljJyk7XG5cdFx0XHR9XG5cdFx0XHRvdXRwdXQucHVzaChpbnB1dC5jaGFyQ29kZUF0KGopKTtcblx0XHR9XG5cblx0XHQvLyBNYWluIGRlY29kaW5nIGxvb3A6IHN0YXJ0IGp1c3QgYWZ0ZXIgdGhlIGxhc3QgZGVsaW1pdGVyIGlmIGFueSBiYXNpYyBjb2RlXG5cdFx0Ly8gcG9pbnRzIHdlcmUgY29waWVkOyBzdGFydCBhdCB0aGUgYmVnaW5uaW5nIG90aGVyd2lzZS5cblxuXHRcdGZvciAoaW5kZXggPSBiYXNpYyA+IDAgPyBiYXNpYyArIDEgOiAwOyBpbmRleCA8IGlucHV0TGVuZ3RoOyAvKiBubyBmaW5hbCBleHByZXNzaW9uICovKSB7XG5cblx0XHRcdC8vIGBpbmRleGAgaXMgdGhlIGluZGV4IG9mIHRoZSBuZXh0IGNoYXJhY3RlciB0byBiZSBjb25zdW1lZC5cblx0XHRcdC8vIERlY29kZSBhIGdlbmVyYWxpemVkIHZhcmlhYmxlLWxlbmd0aCBpbnRlZ2VyIGludG8gYGRlbHRhYCxcblx0XHRcdC8vIHdoaWNoIGdldHMgYWRkZWQgdG8gYGlgLiBUaGUgb3ZlcmZsb3cgY2hlY2tpbmcgaXMgZWFzaWVyXG5cdFx0XHQvLyBpZiB3ZSBpbmNyZWFzZSBgaWAgYXMgd2UgZ28sIHRoZW4gc3VidHJhY3Qgb2ZmIGl0cyBzdGFydGluZ1xuXHRcdFx0Ly8gdmFsdWUgYXQgdGhlIGVuZCB0byBvYnRhaW4gYGRlbHRhYC5cblx0XHRcdGZvciAob2xkaSA9IGksIHcgPSAxLCBrID0gYmFzZTsgLyogbm8gY29uZGl0aW9uICovOyBrICs9IGJhc2UpIHtcblxuXHRcdFx0XHRpZiAoaW5kZXggPj0gaW5wdXRMZW5ndGgpIHtcblx0XHRcdFx0XHRlcnJvcignaW52YWxpZC1pbnB1dCcpO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0ZGlnaXQgPSBiYXNpY1RvRGlnaXQoaW5wdXQuY2hhckNvZGVBdChpbmRleCsrKSk7XG5cblx0XHRcdFx0aWYgKGRpZ2l0ID49IGJhc2UgfHwgZGlnaXQgPiBmbG9vcigobWF4SW50IC0gaSkgLyB3KSkge1xuXHRcdFx0XHRcdGVycm9yKCdvdmVyZmxvdycpO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0aSArPSBkaWdpdCAqIHc7XG5cdFx0XHRcdHQgPSBrIDw9IGJpYXMgPyB0TWluIDogKGsgPj0gYmlhcyArIHRNYXggPyB0TWF4IDogayAtIGJpYXMpO1xuXG5cdFx0XHRcdGlmIChkaWdpdCA8IHQpIHtcblx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0fVxuXG5cdFx0XHRcdGJhc2VNaW51c1QgPSBiYXNlIC0gdDtcblx0XHRcdFx0aWYgKHcgPiBmbG9vcihtYXhJbnQgLyBiYXNlTWludXNUKSkge1xuXHRcdFx0XHRcdGVycm9yKCdvdmVyZmxvdycpO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0dyAqPSBiYXNlTWludXNUO1xuXG5cdFx0XHR9XG5cblx0XHRcdG91dCA9IG91dHB1dC5sZW5ndGggKyAxO1xuXHRcdFx0YmlhcyA9IGFkYXB0KGkgLSBvbGRpLCBvdXQsIG9sZGkgPT0gMCk7XG5cblx0XHRcdC8vIGBpYCB3YXMgc3VwcG9zZWQgdG8gd3JhcCBhcm91bmQgZnJvbSBgb3V0YCB0byBgMGAsXG5cdFx0XHQvLyBpbmNyZW1lbnRpbmcgYG5gIGVhY2ggdGltZSwgc28gd2UnbGwgZml4IHRoYXQgbm93OlxuXHRcdFx0aWYgKGZsb29yKGkgLyBvdXQpID4gbWF4SW50IC0gbikge1xuXHRcdFx0XHRlcnJvcignb3ZlcmZsb3cnKTtcblx0XHRcdH1cblxuXHRcdFx0biArPSBmbG9vcihpIC8gb3V0KTtcblx0XHRcdGkgJT0gb3V0O1xuXG5cdFx0XHQvLyBJbnNlcnQgYG5gIGF0IHBvc2l0aW9uIGBpYCBvZiB0aGUgb3V0cHV0XG5cdFx0XHRvdXRwdXQuc3BsaWNlKGkrKywgMCwgbik7XG5cblx0XHR9XG5cblx0XHRyZXR1cm4gdWNzMmVuY29kZShvdXRwdXQpO1xuXHR9XG5cblx0LyoqXG5cdCAqIENvbnZlcnRzIGEgc3RyaW5nIG9mIFVuaWNvZGUgc3ltYm9scyAoZS5nLiBhIGRvbWFpbiBuYW1lIGxhYmVsKSB0byBhXG5cdCAqIFB1bnljb2RlIHN0cmluZyBvZiBBU0NJSS1vbmx5IHN5bWJvbHMuXG5cdCAqIEBtZW1iZXJPZiBwdW55Y29kZVxuXHQgKiBAcGFyYW0ge1N0cmluZ30gaW5wdXQgVGhlIHN0cmluZyBvZiBVbmljb2RlIHN5bWJvbHMuXG5cdCAqIEByZXR1cm5zIHtTdHJpbmd9IFRoZSByZXN1bHRpbmcgUHVueWNvZGUgc3RyaW5nIG9mIEFTQ0lJLW9ubHkgc3ltYm9scy5cblx0ICovXG5cdGZ1bmN0aW9uIGVuY29kZShpbnB1dCkge1xuXHRcdHZhciBuLFxuXHRcdCAgICBkZWx0YSxcblx0XHQgICAgaGFuZGxlZENQQ291bnQsXG5cdFx0ICAgIGJhc2ljTGVuZ3RoLFxuXHRcdCAgICBiaWFzLFxuXHRcdCAgICBqLFxuXHRcdCAgICBtLFxuXHRcdCAgICBxLFxuXHRcdCAgICBrLFxuXHRcdCAgICB0LFxuXHRcdCAgICBjdXJyZW50VmFsdWUsXG5cdFx0ICAgIG91dHB1dCA9IFtdLFxuXHRcdCAgICAvKiogYGlucHV0TGVuZ3RoYCB3aWxsIGhvbGQgdGhlIG51bWJlciBvZiBjb2RlIHBvaW50cyBpbiBgaW5wdXRgLiAqL1xuXHRcdCAgICBpbnB1dExlbmd0aCxcblx0XHQgICAgLyoqIENhY2hlZCBjYWxjdWxhdGlvbiByZXN1bHRzICovXG5cdFx0ICAgIGhhbmRsZWRDUENvdW50UGx1c09uZSxcblx0XHQgICAgYmFzZU1pbnVzVCxcblx0XHQgICAgcU1pbnVzVDtcblxuXHRcdC8vIENvbnZlcnQgdGhlIGlucHV0IGluIFVDUy0yIHRvIFVuaWNvZGVcblx0XHRpbnB1dCA9IHVjczJkZWNvZGUoaW5wdXQpO1xuXG5cdFx0Ly8gQ2FjaGUgdGhlIGxlbmd0aFxuXHRcdGlucHV0TGVuZ3RoID0gaW5wdXQubGVuZ3RoO1xuXG5cdFx0Ly8gSW5pdGlhbGl6ZSB0aGUgc3RhdGVcblx0XHRuID0gaW5pdGlhbE47XG5cdFx0ZGVsdGEgPSAwO1xuXHRcdGJpYXMgPSBpbml0aWFsQmlhcztcblxuXHRcdC8vIEhhbmRsZSB0aGUgYmFzaWMgY29kZSBwb2ludHNcblx0XHRmb3IgKGogPSAwOyBqIDwgaW5wdXRMZW5ndGg7ICsraikge1xuXHRcdFx0Y3VycmVudFZhbHVlID0gaW5wdXRbal07XG5cdFx0XHRpZiAoY3VycmVudFZhbHVlIDwgMHg4MCkge1xuXHRcdFx0XHRvdXRwdXQucHVzaChzdHJpbmdGcm9tQ2hhckNvZGUoY3VycmVudFZhbHVlKSk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0aGFuZGxlZENQQ291bnQgPSBiYXNpY0xlbmd0aCA9IG91dHB1dC5sZW5ndGg7XG5cblx0XHQvLyBgaGFuZGxlZENQQ291bnRgIGlzIHRoZSBudW1iZXIgb2YgY29kZSBwb2ludHMgdGhhdCBoYXZlIGJlZW4gaGFuZGxlZDtcblx0XHQvLyBgYmFzaWNMZW5ndGhgIGlzIHRoZSBudW1iZXIgb2YgYmFzaWMgY29kZSBwb2ludHMuXG5cblx0XHQvLyBGaW5pc2ggdGhlIGJhc2ljIHN0cmluZyAtIGlmIGl0IGlzIG5vdCBlbXB0eSAtIHdpdGggYSBkZWxpbWl0ZXJcblx0XHRpZiAoYmFzaWNMZW5ndGgpIHtcblx0XHRcdG91dHB1dC5wdXNoKGRlbGltaXRlcik7XG5cdFx0fVxuXG5cdFx0Ly8gTWFpbiBlbmNvZGluZyBsb29wOlxuXHRcdHdoaWxlIChoYW5kbGVkQ1BDb3VudCA8IGlucHV0TGVuZ3RoKSB7XG5cblx0XHRcdC8vIEFsbCBub24tYmFzaWMgY29kZSBwb2ludHMgPCBuIGhhdmUgYmVlbiBoYW5kbGVkIGFscmVhZHkuIEZpbmQgdGhlIG5leHRcblx0XHRcdC8vIGxhcmdlciBvbmU6XG5cdFx0XHRmb3IgKG0gPSBtYXhJbnQsIGogPSAwOyBqIDwgaW5wdXRMZW5ndGg7ICsraikge1xuXHRcdFx0XHRjdXJyZW50VmFsdWUgPSBpbnB1dFtqXTtcblx0XHRcdFx0aWYgKGN1cnJlbnRWYWx1ZSA+PSBuICYmIGN1cnJlbnRWYWx1ZSA8IG0pIHtcblx0XHRcdFx0XHRtID0gY3VycmVudFZhbHVlO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cblx0XHRcdC8vIEluY3JlYXNlIGBkZWx0YWAgZW5vdWdoIHRvIGFkdmFuY2UgdGhlIGRlY29kZXIncyA8bixpPiBzdGF0ZSB0byA8bSwwPixcblx0XHRcdC8vIGJ1dCBndWFyZCBhZ2FpbnN0IG92ZXJmbG93XG5cdFx0XHRoYW5kbGVkQ1BDb3VudFBsdXNPbmUgPSBoYW5kbGVkQ1BDb3VudCArIDE7XG5cdFx0XHRpZiAobSAtIG4gPiBmbG9vcigobWF4SW50IC0gZGVsdGEpIC8gaGFuZGxlZENQQ291bnRQbHVzT25lKSkge1xuXHRcdFx0XHRlcnJvcignb3ZlcmZsb3cnKTtcblx0XHRcdH1cblxuXHRcdFx0ZGVsdGEgKz0gKG0gLSBuKSAqIGhhbmRsZWRDUENvdW50UGx1c09uZTtcblx0XHRcdG4gPSBtO1xuXG5cdFx0XHRmb3IgKGogPSAwOyBqIDwgaW5wdXRMZW5ndGg7ICsraikge1xuXHRcdFx0XHRjdXJyZW50VmFsdWUgPSBpbnB1dFtqXTtcblxuXHRcdFx0XHRpZiAoY3VycmVudFZhbHVlIDwgbiAmJiArK2RlbHRhID4gbWF4SW50KSB7XG5cdFx0XHRcdFx0ZXJyb3IoJ292ZXJmbG93Jyk7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRpZiAoY3VycmVudFZhbHVlID09IG4pIHtcblx0XHRcdFx0XHQvLyBSZXByZXNlbnQgZGVsdGEgYXMgYSBnZW5lcmFsaXplZCB2YXJpYWJsZS1sZW5ndGggaW50ZWdlclxuXHRcdFx0XHRcdGZvciAocSA9IGRlbHRhLCBrID0gYmFzZTsgLyogbm8gY29uZGl0aW9uICovOyBrICs9IGJhc2UpIHtcblx0XHRcdFx0XHRcdHQgPSBrIDw9IGJpYXMgPyB0TWluIDogKGsgPj0gYmlhcyArIHRNYXggPyB0TWF4IDogayAtIGJpYXMpO1xuXHRcdFx0XHRcdFx0aWYgKHEgPCB0KSB7XG5cdFx0XHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0cU1pbnVzVCA9IHEgLSB0O1xuXHRcdFx0XHRcdFx0YmFzZU1pbnVzVCA9IGJhc2UgLSB0O1xuXHRcdFx0XHRcdFx0b3V0cHV0LnB1c2goXG5cdFx0XHRcdFx0XHRcdHN0cmluZ0Zyb21DaGFyQ29kZShkaWdpdFRvQmFzaWModCArIHFNaW51c1QgJSBiYXNlTWludXNULCAwKSlcblx0XHRcdFx0XHRcdCk7XG5cdFx0XHRcdFx0XHRxID0gZmxvb3IocU1pbnVzVCAvIGJhc2VNaW51c1QpO1xuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdG91dHB1dC5wdXNoKHN0cmluZ0Zyb21DaGFyQ29kZShkaWdpdFRvQmFzaWMocSwgMCkpKTtcblx0XHRcdFx0XHRiaWFzID0gYWRhcHQoZGVsdGEsIGhhbmRsZWRDUENvdW50UGx1c09uZSwgaGFuZGxlZENQQ291bnQgPT0gYmFzaWNMZW5ndGgpO1xuXHRcdFx0XHRcdGRlbHRhID0gMDtcblx0XHRcdFx0XHQrK2hhbmRsZWRDUENvdW50O1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cblx0XHRcdCsrZGVsdGE7XG5cdFx0XHQrK247XG5cblx0XHR9XG5cdFx0cmV0dXJuIG91dHB1dC5qb2luKCcnKTtcblx0fVxuXG5cdC8qKlxuXHQgKiBDb252ZXJ0cyBhIFB1bnljb2RlIHN0cmluZyByZXByZXNlbnRpbmcgYSBkb21haW4gbmFtZSBvciBhbiBlbWFpbCBhZGRyZXNzXG5cdCAqIHRvIFVuaWNvZGUuIE9ubHkgdGhlIFB1bnljb2RlZCBwYXJ0cyBvZiB0aGUgaW5wdXQgd2lsbCBiZSBjb252ZXJ0ZWQsIGkuZS5cblx0ICogaXQgZG9lc24ndCBtYXR0ZXIgaWYgeW91IGNhbGwgaXQgb24gYSBzdHJpbmcgdGhhdCBoYXMgYWxyZWFkeSBiZWVuXG5cdCAqIGNvbnZlcnRlZCB0byBVbmljb2RlLlxuXHQgKiBAbWVtYmVyT2YgcHVueWNvZGVcblx0ICogQHBhcmFtIHtTdHJpbmd9IGlucHV0IFRoZSBQdW55Y29kZWQgZG9tYWluIG5hbWUgb3IgZW1haWwgYWRkcmVzcyB0b1xuXHQgKiBjb252ZXJ0IHRvIFVuaWNvZGUuXG5cdCAqIEByZXR1cm5zIHtTdHJpbmd9IFRoZSBVbmljb2RlIHJlcHJlc2VudGF0aW9uIG9mIHRoZSBnaXZlbiBQdW55Y29kZVxuXHQgKiBzdHJpbmcuXG5cdCAqL1xuXHRmdW5jdGlvbiB0b1VuaWNvZGUoaW5wdXQpIHtcblx0XHRyZXR1cm4gbWFwRG9tYWluKGlucHV0LCBmdW5jdGlvbihzdHJpbmcpIHtcblx0XHRcdHJldHVybiByZWdleFB1bnljb2RlLnRlc3Qoc3RyaW5nKVxuXHRcdFx0XHQ/IGRlY29kZShzdHJpbmcuc2xpY2UoNCkudG9Mb3dlckNhc2UoKSlcblx0XHRcdFx0OiBzdHJpbmc7XG5cdFx0fSk7XG5cdH1cblxuXHQvKipcblx0ICogQ29udmVydHMgYSBVbmljb2RlIHN0cmluZyByZXByZXNlbnRpbmcgYSBkb21haW4gbmFtZSBvciBhbiBlbWFpbCBhZGRyZXNzIHRvXG5cdCAqIFB1bnljb2RlLiBPbmx5IHRoZSBub24tQVNDSUkgcGFydHMgb2YgdGhlIGRvbWFpbiBuYW1lIHdpbGwgYmUgY29udmVydGVkLFxuXHQgKiBpLmUuIGl0IGRvZXNuJ3QgbWF0dGVyIGlmIHlvdSBjYWxsIGl0IHdpdGggYSBkb21haW4gdGhhdCdzIGFscmVhZHkgaW5cblx0ICogQVNDSUkuXG5cdCAqIEBtZW1iZXJPZiBwdW55Y29kZVxuXHQgKiBAcGFyYW0ge1N0cmluZ30gaW5wdXQgVGhlIGRvbWFpbiBuYW1lIG9yIGVtYWlsIGFkZHJlc3MgdG8gY29udmVydCwgYXMgYVxuXHQgKiBVbmljb2RlIHN0cmluZy5cblx0ICogQHJldHVybnMge1N0cmluZ30gVGhlIFB1bnljb2RlIHJlcHJlc2VudGF0aW9uIG9mIHRoZSBnaXZlbiBkb21haW4gbmFtZSBvclxuXHQgKiBlbWFpbCBhZGRyZXNzLlxuXHQgKi9cblx0ZnVuY3Rpb24gdG9BU0NJSShpbnB1dCkge1xuXHRcdHJldHVybiBtYXBEb21haW4oaW5wdXQsIGZ1bmN0aW9uKHN0cmluZykge1xuXHRcdFx0cmV0dXJuIHJlZ2V4Tm9uQVNDSUkudGVzdChzdHJpbmcpXG5cdFx0XHRcdD8gJ3huLS0nICsgZW5jb2RlKHN0cmluZylcblx0XHRcdFx0OiBzdHJpbmc7XG5cdFx0fSk7XG5cdH1cblxuXHQvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuXHQvKiogRGVmaW5lIHRoZSBwdWJsaWMgQVBJICovXG5cdHB1bnljb2RlID0ge1xuXHRcdC8qKlxuXHRcdCAqIEEgc3RyaW5nIHJlcHJlc2VudGluZyB0aGUgY3VycmVudCBQdW55Y29kZS5qcyB2ZXJzaW9uIG51bWJlci5cblx0XHQgKiBAbWVtYmVyT2YgcHVueWNvZGVcblx0XHQgKiBAdHlwZSBTdHJpbmdcblx0XHQgKi9cblx0XHQndmVyc2lvbic6ICcxLjQuMScsXG5cdFx0LyoqXG5cdFx0ICogQW4gb2JqZWN0IG9mIG1ldGhvZHMgdG8gY29udmVydCBmcm9tIEphdmFTY3JpcHQncyBpbnRlcm5hbCBjaGFyYWN0ZXJcblx0XHQgKiByZXByZXNlbnRhdGlvbiAoVUNTLTIpIHRvIFVuaWNvZGUgY29kZSBwb2ludHMsIGFuZCBiYWNrLlxuXHRcdCAqIEBzZWUgPGh0dHBzOi8vbWF0aGlhc2J5bmVucy5iZS9ub3Rlcy9qYXZhc2NyaXB0LWVuY29kaW5nPlxuXHRcdCAqIEBtZW1iZXJPZiBwdW55Y29kZVxuXHRcdCAqIEB0eXBlIE9iamVjdFxuXHRcdCAqL1xuXHRcdCd1Y3MyJzoge1xuXHRcdFx0J2RlY29kZSc6IHVjczJkZWNvZGUsXG5cdFx0XHQnZW5jb2RlJzogdWNzMmVuY29kZVxuXHRcdH0sXG5cdFx0J2RlY29kZSc6IGRlY29kZSxcblx0XHQnZW5jb2RlJzogZW5jb2RlLFxuXHRcdCd0b0FTQ0lJJzogdG9BU0NJSSxcblx0XHQndG9Vbmljb2RlJzogdG9Vbmljb2RlXG5cdH07XG5cblx0LyoqIEV4cG9zZSBgcHVueWNvZGVgICovXG5cdC8vIFNvbWUgQU1EIGJ1aWxkIG9wdGltaXplcnMsIGxpa2Ugci5qcywgY2hlY2sgZm9yIHNwZWNpZmljIGNvbmRpdGlvbiBwYXR0ZXJuc1xuXHQvLyBsaWtlIHRoZSBmb2xsb3dpbmc6XG5cdGlmIChcblx0XHR0eXBlb2YgZGVmaW5lID09ICdmdW5jdGlvbicgJiZcblx0XHR0eXBlb2YgZGVmaW5lLmFtZCA9PSAnb2JqZWN0JyAmJlxuXHRcdGRlZmluZS5hbWRcblx0KSB7XG5cdFx0ZGVmaW5lKCdwdW55Y29kZScsIGZ1bmN0aW9uKCkge1xuXHRcdFx0cmV0dXJuIHB1bnljb2RlO1xuXHRcdH0pO1xuXHR9IGVsc2UgaWYgKGZyZWVFeHBvcnRzICYmIGZyZWVNb2R1bGUpIHtcblx0XHRpZiAobW9kdWxlLmV4cG9ydHMgPT0gZnJlZUV4cG9ydHMpIHtcblx0XHRcdC8vIGluIE5vZGUuanMsIGlvLmpzLCBvciBSaW5nb0pTIHYwLjguMCtcblx0XHRcdGZyZWVNb2R1bGUuZXhwb3J0cyA9IHB1bnljb2RlO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHQvLyBpbiBOYXJ3aGFsIG9yIFJpbmdvSlMgdjAuNy4wLVxuXHRcdFx0Zm9yIChrZXkgaW4gcHVueWNvZGUpIHtcblx0XHRcdFx0cHVueWNvZGUuaGFzT3duUHJvcGVydHkoa2V5KSAmJiAoZnJlZUV4cG9ydHNba2V5XSA9IHB1bnljb2RlW2tleV0pO1xuXHRcdFx0fVxuXHRcdH1cblx0fSBlbHNlIHtcblx0XHQvLyBpbiBSaGlubyBvciBhIHdlYiBicm93c2VyXG5cdFx0cm9vdC5wdW55Y29kZSA9IHB1bnljb2RlO1xuXHR9XG5cbn0odGhpcykpO1xuIiwiLy8gQ29weXJpZ2h0IEpveWVudCwgSW5jLiBhbmQgb3RoZXIgTm9kZSBjb250cmlidXRvcnMuXG4vL1xuLy8gUGVybWlzc2lvbiBpcyBoZXJlYnkgZ3JhbnRlZCwgZnJlZSBvZiBjaGFyZ2UsIHRvIGFueSBwZXJzb24gb2J0YWluaW5nIGFcbi8vIGNvcHkgb2YgdGhpcyBzb2Z0d2FyZSBhbmQgYXNzb2NpYXRlZCBkb2N1bWVudGF0aW9uIGZpbGVzICh0aGVcbi8vIFwiU29mdHdhcmVcIiksIHRvIGRlYWwgaW4gdGhlIFNvZnR3YXJlIHdpdGhvdXQgcmVzdHJpY3Rpb24sIGluY2x1ZGluZ1xuLy8gd2l0aG91dCBsaW1pdGF0aW9uIHRoZSByaWdodHMgdG8gdXNlLCBjb3B5LCBtb2RpZnksIG1lcmdlLCBwdWJsaXNoLFxuLy8gZGlzdHJpYnV0ZSwgc3VibGljZW5zZSwgYW5kL29yIHNlbGwgY29waWVzIG9mIHRoZSBTb2Z0d2FyZSwgYW5kIHRvIHBlcm1pdFxuLy8gcGVyc29ucyB0byB3aG9tIHRoZSBTb2Z0d2FyZSBpcyBmdXJuaXNoZWQgdG8gZG8gc28sIHN1YmplY3QgdG8gdGhlXG4vLyBmb2xsb3dpbmcgY29uZGl0aW9uczpcbi8vXG4vLyBUaGUgYWJvdmUgY29weXJpZ2h0IG5vdGljZSBhbmQgdGhpcyBwZXJtaXNzaW9uIG5vdGljZSBzaGFsbCBiZSBpbmNsdWRlZFxuLy8gaW4gYWxsIGNvcGllcyBvciBzdWJzdGFudGlhbCBwb3J0aW9ucyBvZiB0aGUgU29mdHdhcmUuXG4vL1xuLy8gVEhFIFNPRlRXQVJFIElTIFBST1ZJREVEIFwiQVMgSVNcIiwgV0lUSE9VVCBXQVJSQU5UWSBPRiBBTlkgS0lORCwgRVhQUkVTU1xuLy8gT1IgSU1QTElFRCwgSU5DTFVESU5HIEJVVCBOT1QgTElNSVRFRCBUTyBUSEUgV0FSUkFOVElFUyBPRlxuLy8gTUVSQ0hBTlRBQklMSVRZLCBGSVRORVNTIEZPUiBBIFBBUlRJQ1VMQVIgUFVSUE9TRSBBTkQgTk9OSU5GUklOR0VNRU5ULiBJTlxuLy8gTk8gRVZFTlQgU0hBTEwgVEhFIEFVVEhPUlMgT1IgQ09QWVJJR0hUIEhPTERFUlMgQkUgTElBQkxFIEZPUiBBTlkgQ0xBSU0sXG4vLyBEQU1BR0VTIE9SIE9USEVSIExJQUJJTElUWSwgV0hFVEhFUiBJTiBBTiBBQ1RJT04gT0YgQ09OVFJBQ1QsIFRPUlQgT1Jcbi8vIE9USEVSV0lTRSwgQVJJU0lORyBGUk9NLCBPVVQgT0YgT1IgSU4gQ09OTkVDVElPTiBXSVRIIFRIRSBTT0ZUV0FSRSBPUiBUSEVcbi8vIFVTRSBPUiBPVEhFUiBERUFMSU5HUyBJTiBUSEUgU09GVFdBUkUuXG5cbid1c2Ugc3RyaWN0JztcblxuLy8gSWYgb2JqLmhhc093blByb3BlcnR5IGhhcyBiZWVuIG92ZXJyaWRkZW4sIHRoZW4gY2FsbGluZ1xuLy8gb2JqLmhhc093blByb3BlcnR5KHByb3ApIHdpbGwgYnJlYWsuXG4vLyBTZWU6IGh0dHBzOi8vZ2l0aHViLmNvbS9qb3llbnQvbm9kZS9pc3N1ZXMvMTcwN1xuZnVuY3Rpb24gaGFzT3duUHJvcGVydHkob2JqLCBwcm9wKSB7XG4gIHJldHVybiBPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LmNhbGwob2JqLCBwcm9wKTtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbihxcywgc2VwLCBlcSwgb3B0aW9ucykge1xuICBzZXAgPSBzZXAgfHwgJyYnO1xuICBlcSA9IGVxIHx8ICc9JztcbiAgdmFyIG9iaiA9IHt9O1xuXG4gIGlmICh0eXBlb2YgcXMgIT09ICdzdHJpbmcnIHx8IHFzLmxlbmd0aCA9PT0gMCkge1xuICAgIHJldHVybiBvYmo7XG4gIH1cblxuICB2YXIgcmVnZXhwID0gL1xcKy9nO1xuICBxcyA9IHFzLnNwbGl0KHNlcCk7XG5cbiAgdmFyIG1heEtleXMgPSAxMDAwO1xuICBpZiAob3B0aW9ucyAmJiB0eXBlb2Ygb3B0aW9ucy5tYXhLZXlzID09PSAnbnVtYmVyJykge1xuICAgIG1heEtleXMgPSBvcHRpb25zLm1heEtleXM7XG4gIH1cblxuICB2YXIgbGVuID0gcXMubGVuZ3RoO1xuICAvLyBtYXhLZXlzIDw9IDAgbWVhbnMgdGhhdCB3ZSBzaG91bGQgbm90IGxpbWl0IGtleXMgY291bnRcbiAgaWYgKG1heEtleXMgPiAwICYmIGxlbiA+IG1heEtleXMpIHtcbiAgICBsZW4gPSBtYXhLZXlzO1xuICB9XG5cbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBsZW47ICsraSkge1xuICAgIHZhciB4ID0gcXNbaV0ucmVwbGFjZShyZWdleHAsICclMjAnKSxcbiAgICAgICAgaWR4ID0geC5pbmRleE9mKGVxKSxcbiAgICAgICAga3N0ciwgdnN0ciwgaywgdjtcblxuICAgIGlmIChpZHggPj0gMCkge1xuICAgICAga3N0ciA9IHguc3Vic3RyKDAsIGlkeCk7XG4gICAgICB2c3RyID0geC5zdWJzdHIoaWR4ICsgMSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGtzdHIgPSB4O1xuICAgICAgdnN0ciA9ICcnO1xuICAgIH1cblxuICAgIGsgPSBkZWNvZGVVUklDb21wb25lbnQoa3N0cik7XG4gICAgdiA9IGRlY29kZVVSSUNvbXBvbmVudCh2c3RyKTtcblxuICAgIGlmICghaGFzT3duUHJvcGVydHkob2JqLCBrKSkge1xuICAgICAgb2JqW2tdID0gdjtcbiAgICB9IGVsc2UgaWYgKGlzQXJyYXkob2JqW2tdKSkge1xuICAgICAgb2JqW2tdLnB1c2godik7XG4gICAgfSBlbHNlIHtcbiAgICAgIG9ialtrXSA9IFtvYmpba10sIHZdO1xuICAgIH1cbiAgfVxuXG4gIHJldHVybiBvYmo7XG59O1xuXG52YXIgaXNBcnJheSA9IEFycmF5LmlzQXJyYXkgfHwgZnVuY3Rpb24gKHhzKSB7XG4gIHJldHVybiBPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nLmNhbGwoeHMpID09PSAnW29iamVjdCBBcnJheV0nO1xufTtcbiIsIi8vIENvcHlyaWdodCBKb3llbnQsIEluYy4gYW5kIG90aGVyIE5vZGUgY29udHJpYnV0b3JzLlxuLy9cbi8vIFBlcm1pc3Npb24gaXMgaGVyZWJ5IGdyYW50ZWQsIGZyZWUgb2YgY2hhcmdlLCB0byBhbnkgcGVyc29uIG9idGFpbmluZyBhXG4vLyBjb3B5IG9mIHRoaXMgc29mdHdhcmUgYW5kIGFzc29jaWF0ZWQgZG9jdW1lbnRhdGlvbiBmaWxlcyAodGhlXG4vLyBcIlNvZnR3YXJlXCIpLCB0byBkZWFsIGluIHRoZSBTb2Z0d2FyZSB3aXRob3V0IHJlc3RyaWN0aW9uLCBpbmNsdWRpbmdcbi8vIHdpdGhvdXQgbGltaXRhdGlvbiB0aGUgcmlnaHRzIHRvIHVzZSwgY29weSwgbW9kaWZ5LCBtZXJnZSwgcHVibGlzaCxcbi8vIGRpc3RyaWJ1dGUsIHN1YmxpY2Vuc2UsIGFuZC9vciBzZWxsIGNvcGllcyBvZiB0aGUgU29mdHdhcmUsIGFuZCB0byBwZXJtaXRcbi8vIHBlcnNvbnMgdG8gd2hvbSB0aGUgU29mdHdhcmUgaXMgZnVybmlzaGVkIHRvIGRvIHNvLCBzdWJqZWN0IHRvIHRoZVxuLy8gZm9sbG93aW5nIGNvbmRpdGlvbnM6XG4vL1xuLy8gVGhlIGFib3ZlIGNvcHlyaWdodCBub3RpY2UgYW5kIHRoaXMgcGVybWlzc2lvbiBub3RpY2Ugc2hhbGwgYmUgaW5jbHVkZWRcbi8vIGluIGFsbCBjb3BpZXMgb3Igc3Vic3RhbnRpYWwgcG9ydGlvbnMgb2YgdGhlIFNvZnR3YXJlLlxuLy9cbi8vIFRIRSBTT0ZUV0FSRSBJUyBQUk9WSURFRCBcIkFTIElTXCIsIFdJVEhPVVQgV0FSUkFOVFkgT0YgQU5ZIEtJTkQsIEVYUFJFU1Ncbi8vIE9SIElNUExJRUQsIElOQ0xVRElORyBCVVQgTk9UIExJTUlURUQgVE8gVEhFIFdBUlJBTlRJRVMgT0Zcbi8vIE1FUkNIQU5UQUJJTElUWSwgRklUTkVTUyBGT1IgQSBQQVJUSUNVTEFSIFBVUlBPU0UgQU5EIE5PTklORlJJTkdFTUVOVC4gSU5cbi8vIE5PIEVWRU5UIFNIQUxMIFRIRSBBVVRIT1JTIE9SIENPUFlSSUdIVCBIT0xERVJTIEJFIExJQUJMRSBGT1IgQU5ZIENMQUlNLFxuLy8gREFNQUdFUyBPUiBPVEhFUiBMSUFCSUxJVFksIFdIRVRIRVIgSU4gQU4gQUNUSU9OIE9GIENPTlRSQUNULCBUT1JUIE9SXG4vLyBPVEhFUldJU0UsIEFSSVNJTkcgRlJPTSwgT1VUIE9GIE9SIElOIENPTk5FQ1RJT04gV0lUSCBUSEUgU09GVFdBUkUgT1IgVEhFXG4vLyBVU0UgT1IgT1RIRVIgREVBTElOR1MgSU4gVEhFIFNPRlRXQVJFLlxuXG4ndXNlIHN0cmljdCc7XG5cbnZhciBzdHJpbmdpZnlQcmltaXRpdmUgPSBmdW5jdGlvbih2KSB7XG4gIHN3aXRjaCAodHlwZW9mIHYpIHtcbiAgICBjYXNlICdzdHJpbmcnOlxuICAgICAgcmV0dXJuIHY7XG5cbiAgICBjYXNlICdib29sZWFuJzpcbiAgICAgIHJldHVybiB2ID8gJ3RydWUnIDogJ2ZhbHNlJztcblxuICAgIGNhc2UgJ251bWJlcic6XG4gICAgICByZXR1cm4gaXNGaW5pdGUodikgPyB2IDogJyc7XG5cbiAgICBkZWZhdWx0OlxuICAgICAgcmV0dXJuICcnO1xuICB9XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKG9iaiwgc2VwLCBlcSwgbmFtZSkge1xuICBzZXAgPSBzZXAgfHwgJyYnO1xuICBlcSA9IGVxIHx8ICc9JztcbiAgaWYgKG9iaiA9PT0gbnVsbCkge1xuICAgIG9iaiA9IHVuZGVmaW5lZDtcbiAgfVxuXG4gIGlmICh0eXBlb2Ygb2JqID09PSAnb2JqZWN0Jykge1xuICAgIHJldHVybiBtYXAob2JqZWN0S2V5cyhvYmopLCBmdW5jdGlvbihrKSB7XG4gICAgICB2YXIga3MgPSBlbmNvZGVVUklDb21wb25lbnQoc3RyaW5naWZ5UHJpbWl0aXZlKGspKSArIGVxO1xuICAgICAgaWYgKGlzQXJyYXkob2JqW2tdKSkge1xuICAgICAgICByZXR1cm4gbWFwKG9ialtrXSwgZnVuY3Rpb24odikge1xuICAgICAgICAgIHJldHVybiBrcyArIGVuY29kZVVSSUNvbXBvbmVudChzdHJpbmdpZnlQcmltaXRpdmUodikpO1xuICAgICAgICB9KS5qb2luKHNlcCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4ga3MgKyBlbmNvZGVVUklDb21wb25lbnQoc3RyaW5naWZ5UHJpbWl0aXZlKG9ialtrXSkpO1xuICAgICAgfVxuICAgIH0pLmpvaW4oc2VwKTtcblxuICB9XG5cbiAgaWYgKCFuYW1lKSByZXR1cm4gJyc7XG4gIHJldHVybiBlbmNvZGVVUklDb21wb25lbnQoc3RyaW5naWZ5UHJpbWl0aXZlKG5hbWUpKSArIGVxICtcbiAgICAgICAgIGVuY29kZVVSSUNvbXBvbmVudChzdHJpbmdpZnlQcmltaXRpdmUob2JqKSk7XG59O1xuXG52YXIgaXNBcnJheSA9IEFycmF5LmlzQXJyYXkgfHwgZnVuY3Rpb24gKHhzKSB7XG4gIHJldHVybiBPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nLmNhbGwoeHMpID09PSAnW29iamVjdCBBcnJheV0nO1xufTtcblxuZnVuY3Rpb24gbWFwICh4cywgZikge1xuICBpZiAoeHMubWFwKSByZXR1cm4geHMubWFwKGYpO1xuICB2YXIgcmVzID0gW107XG4gIGZvciAodmFyIGkgPSAwOyBpIDwgeHMubGVuZ3RoOyBpKyspIHtcbiAgICByZXMucHVzaChmKHhzW2ldLCBpKSk7XG4gIH1cbiAgcmV0dXJuIHJlcztcbn1cblxudmFyIG9iamVjdEtleXMgPSBPYmplY3Qua2V5cyB8fCBmdW5jdGlvbiAob2JqKSB7XG4gIHZhciByZXMgPSBbXTtcbiAgZm9yICh2YXIga2V5IGluIG9iaikge1xuICAgIGlmIChPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LmNhbGwob2JqLCBrZXkpKSByZXMucHVzaChrZXkpO1xuICB9XG4gIHJldHVybiByZXM7XG59O1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG5leHBvcnRzLmRlY29kZSA9IGV4cG9ydHMucGFyc2UgPSByZXF1aXJlKCcuL2RlY29kZScpO1xuZXhwb3J0cy5lbmNvZGUgPSBleHBvcnRzLnN0cmluZ2lmeSA9IHJlcXVpcmUoJy4vZW5jb2RlJyk7XG4iLCIvLyBDb3B5cmlnaHQgSm95ZW50LCBJbmMuIGFuZCBvdGhlciBOb2RlIGNvbnRyaWJ1dG9ycy5cbi8vXG4vLyBQZXJtaXNzaW9uIGlzIGhlcmVieSBncmFudGVkLCBmcmVlIG9mIGNoYXJnZSwgdG8gYW55IHBlcnNvbiBvYnRhaW5pbmcgYVxuLy8gY29weSBvZiB0aGlzIHNvZnR3YXJlIGFuZCBhc3NvY2lhdGVkIGRvY3VtZW50YXRpb24gZmlsZXMgKHRoZVxuLy8gXCJTb2Z0d2FyZVwiKSwgdG8gZGVhbCBpbiB0aGUgU29mdHdhcmUgd2l0aG91dCByZXN0cmljdGlvbiwgaW5jbHVkaW5nXG4vLyB3aXRob3V0IGxpbWl0YXRpb24gdGhlIHJpZ2h0cyB0byB1c2UsIGNvcHksIG1vZGlmeSwgbWVyZ2UsIHB1Ymxpc2gsXG4vLyBkaXN0cmlidXRlLCBzdWJsaWNlbnNlLCBhbmQvb3Igc2VsbCBjb3BpZXMgb2YgdGhlIFNvZnR3YXJlLCBhbmQgdG8gcGVybWl0XG4vLyBwZXJzb25zIHRvIHdob20gdGhlIFNvZnR3YXJlIGlzIGZ1cm5pc2hlZCB0byBkbyBzbywgc3ViamVjdCB0byB0aGVcbi8vIGZvbGxvd2luZyBjb25kaXRpb25zOlxuLy9cbi8vIFRoZSBhYm92ZSBjb3B5cmlnaHQgbm90aWNlIGFuZCB0aGlzIHBlcm1pc3Npb24gbm90aWNlIHNoYWxsIGJlIGluY2x1ZGVkXG4vLyBpbiBhbGwgY29waWVzIG9yIHN1YnN0YW50aWFsIHBvcnRpb25zIG9mIHRoZSBTb2Z0d2FyZS5cbi8vXG4vLyBUSEUgU09GVFdBUkUgSVMgUFJPVklERUQgXCJBUyBJU1wiLCBXSVRIT1VUIFdBUlJBTlRZIE9GIEFOWSBLSU5ELCBFWFBSRVNTXG4vLyBPUiBJTVBMSUVELCBJTkNMVURJTkcgQlVUIE5PVCBMSU1JVEVEIFRPIFRIRSBXQVJSQU5USUVTIE9GXG4vLyBNRVJDSEFOVEFCSUxJVFksIEZJVE5FU1MgRk9SIEEgUEFSVElDVUxBUiBQVVJQT1NFIEFORCBOT05JTkZSSU5HRU1FTlQuIElOXG4vLyBOTyBFVkVOVCBTSEFMTCBUSEUgQVVUSE9SUyBPUiBDT1BZUklHSFQgSE9MREVSUyBCRSBMSUFCTEUgRk9SIEFOWSBDTEFJTSxcbi8vIERBTUFHRVMgT1IgT1RIRVIgTElBQklMSVRZLCBXSEVUSEVSIElOIEFOIEFDVElPTiBPRiBDT05UUkFDVCwgVE9SVCBPUlxuLy8gT1RIRVJXSVNFLCBBUklTSU5HIEZST00sIE9VVCBPRiBPUiBJTiBDT05ORUNUSU9OIFdJVEggVEhFIFNPRlRXQVJFIE9SIFRIRVxuLy8gVVNFIE9SIE9USEVSIERFQUxJTkdTIElOIFRIRSBTT0ZUV0FSRS5cblxuJ3VzZSBzdHJpY3QnO1xuXG52YXIgcHVueWNvZGUgPSByZXF1aXJlKCdwdW55Y29kZScpO1xudmFyIHV0aWwgPSByZXF1aXJlKCcuL3V0aWwnKTtcblxuZXhwb3J0cy5wYXJzZSA9IHVybFBhcnNlO1xuZXhwb3J0cy5yZXNvbHZlID0gdXJsUmVzb2x2ZTtcbmV4cG9ydHMucmVzb2x2ZU9iamVjdCA9IHVybFJlc29sdmVPYmplY3Q7XG5leHBvcnRzLmZvcm1hdCA9IHVybEZvcm1hdDtcblxuZXhwb3J0cy5VcmwgPSBVcmw7XG5cbmZ1bmN0aW9uIFVybCgpIHtcbiAgdGhpcy5wcm90b2NvbCA9IG51bGw7XG4gIHRoaXMuc2xhc2hlcyA9IG51bGw7XG4gIHRoaXMuYXV0aCA9IG51bGw7XG4gIHRoaXMuaG9zdCA9IG51bGw7XG4gIHRoaXMucG9ydCA9IG51bGw7XG4gIHRoaXMuaG9zdG5hbWUgPSBudWxsO1xuICB0aGlzLmhhc2ggPSBudWxsO1xuICB0aGlzLnNlYXJjaCA9IG51bGw7XG4gIHRoaXMucXVlcnkgPSBudWxsO1xuICB0aGlzLnBhdGhuYW1lID0gbnVsbDtcbiAgdGhpcy5wYXRoID0gbnVsbDtcbiAgdGhpcy5ocmVmID0gbnVsbDtcbn1cblxuLy8gUmVmZXJlbmNlOiBSRkMgMzk4NiwgUkZDIDE4MDgsIFJGQyAyMzk2XG5cbi8vIGRlZmluZSB0aGVzZSBoZXJlIHNvIGF0IGxlYXN0IHRoZXkgb25seSBoYXZlIHRvIGJlXG4vLyBjb21waWxlZCBvbmNlIG9uIHRoZSBmaXJzdCBtb2R1bGUgbG9hZC5cbnZhciBwcm90b2NvbFBhdHRlcm4gPSAvXihbYS16MC05ListXSs6KS9pLFxuICAgIHBvcnRQYXR0ZXJuID0gLzpbMC05XSokLyxcblxuICAgIC8vIFNwZWNpYWwgY2FzZSBmb3IgYSBzaW1wbGUgcGF0aCBVUkxcbiAgICBzaW1wbGVQYXRoUGF0dGVybiA9IC9eKFxcL1xcLz8oPyFcXC8pW15cXD9cXHNdKikoXFw/W15cXHNdKik/JC8sXG5cbiAgICAvLyBSRkMgMjM5NjogY2hhcmFjdGVycyByZXNlcnZlZCBmb3IgZGVsaW1pdGluZyBVUkxzLlxuICAgIC8vIFdlIGFjdHVhbGx5IGp1c3QgYXV0by1lc2NhcGUgdGhlc2UuXG4gICAgZGVsaW1zID0gWyc8JywgJz4nLCAnXCInLCAnYCcsICcgJywgJ1xccicsICdcXG4nLCAnXFx0J10sXG5cbiAgICAvLyBSRkMgMjM5NjogY2hhcmFjdGVycyBub3QgYWxsb3dlZCBmb3IgdmFyaW91cyByZWFzb25zLlxuICAgIHVud2lzZSA9IFsneycsICd9JywgJ3wnLCAnXFxcXCcsICdeJywgJ2AnXS5jb25jYXQoZGVsaW1zKSxcblxuICAgIC8vIEFsbG93ZWQgYnkgUkZDcywgYnV0IGNhdXNlIG9mIFhTUyBhdHRhY2tzLiAgQWx3YXlzIGVzY2FwZSB0aGVzZS5cbiAgICBhdXRvRXNjYXBlID0gWydcXCcnXS5jb25jYXQodW53aXNlKSxcbiAgICAvLyBDaGFyYWN0ZXJzIHRoYXQgYXJlIG5ldmVyIGV2ZXIgYWxsb3dlZCBpbiBhIGhvc3RuYW1lLlxuICAgIC8vIE5vdGUgdGhhdCBhbnkgaW52YWxpZCBjaGFycyBhcmUgYWxzbyBoYW5kbGVkLCBidXQgdGhlc2VcbiAgICAvLyBhcmUgdGhlIG9uZXMgdGhhdCBhcmUgKmV4cGVjdGVkKiB0byBiZSBzZWVuLCBzbyB3ZSBmYXN0LXBhdGhcbiAgICAvLyB0aGVtLlxuICAgIG5vbkhvc3RDaGFycyA9IFsnJScsICcvJywgJz8nLCAnOycsICcjJ10uY29uY2F0KGF1dG9Fc2NhcGUpLFxuICAgIGhvc3RFbmRpbmdDaGFycyA9IFsnLycsICc/JywgJyMnXSxcbiAgICBob3N0bmFtZU1heExlbiA9IDI1NSxcbiAgICBob3N0bmFtZVBhcnRQYXR0ZXJuID0gL15bK2EtejAtOUEtWl8tXXswLDYzfSQvLFxuICAgIGhvc3RuYW1lUGFydFN0YXJ0ID0gL14oWythLXowLTlBLVpfLV17MCw2M30pKC4qKSQvLFxuICAgIC8vIHByb3RvY29scyB0aGF0IGNhbiBhbGxvdyBcInVuc2FmZVwiIGFuZCBcInVud2lzZVwiIGNoYXJzLlxuICAgIHVuc2FmZVByb3RvY29sID0ge1xuICAgICAgJ2phdmFzY3JpcHQnOiB0cnVlLFxuICAgICAgJ2phdmFzY3JpcHQ6JzogdHJ1ZVxuICAgIH0sXG4gICAgLy8gcHJvdG9jb2xzIHRoYXQgbmV2ZXIgaGF2ZSBhIGhvc3RuYW1lLlxuICAgIGhvc3RsZXNzUHJvdG9jb2wgPSB7XG4gICAgICAnamF2YXNjcmlwdCc6IHRydWUsXG4gICAgICAnamF2YXNjcmlwdDonOiB0cnVlXG4gICAgfSxcbiAgICAvLyBwcm90b2NvbHMgdGhhdCBhbHdheXMgY29udGFpbiBhIC8vIGJpdC5cbiAgICBzbGFzaGVkUHJvdG9jb2wgPSB7XG4gICAgICAnaHR0cCc6IHRydWUsXG4gICAgICAnaHR0cHMnOiB0cnVlLFxuICAgICAgJ2Z0cCc6IHRydWUsXG4gICAgICAnZ29waGVyJzogdHJ1ZSxcbiAgICAgICdmaWxlJzogdHJ1ZSxcbiAgICAgICdodHRwOic6IHRydWUsXG4gICAgICAnaHR0cHM6JzogdHJ1ZSxcbiAgICAgICdmdHA6JzogdHJ1ZSxcbiAgICAgICdnb3BoZXI6JzogdHJ1ZSxcbiAgICAgICdmaWxlOic6IHRydWVcbiAgICB9LFxuICAgIHF1ZXJ5c3RyaW5nID0gcmVxdWlyZSgncXVlcnlzdHJpbmcnKTtcblxuZnVuY3Rpb24gdXJsUGFyc2UodXJsLCBwYXJzZVF1ZXJ5U3RyaW5nLCBzbGFzaGVzRGVub3RlSG9zdCkge1xuICBpZiAodXJsICYmIHV0aWwuaXNPYmplY3QodXJsKSAmJiB1cmwgaW5zdGFuY2VvZiBVcmwpIHJldHVybiB1cmw7XG5cbiAgdmFyIHUgPSBuZXcgVXJsO1xuICB1LnBhcnNlKHVybCwgcGFyc2VRdWVyeVN0cmluZywgc2xhc2hlc0Rlbm90ZUhvc3QpO1xuICByZXR1cm4gdTtcbn1cblxuVXJsLnByb3RvdHlwZS5wYXJzZSA9IGZ1bmN0aW9uKHVybCwgcGFyc2VRdWVyeVN0cmluZywgc2xhc2hlc0Rlbm90ZUhvc3QpIHtcbiAgaWYgKCF1dGlsLmlzU3RyaW5nKHVybCkpIHtcbiAgICB0aHJvdyBuZXcgVHlwZUVycm9yKFwiUGFyYW1ldGVyICd1cmwnIG11c3QgYmUgYSBzdHJpbmcsIG5vdCBcIiArIHR5cGVvZiB1cmwpO1xuICB9XG5cbiAgLy8gQ29weSBjaHJvbWUsIElFLCBvcGVyYSBiYWNrc2xhc2gtaGFuZGxpbmcgYmVoYXZpb3IuXG4gIC8vIEJhY2sgc2xhc2hlcyBiZWZvcmUgdGhlIHF1ZXJ5IHN0cmluZyBnZXQgY29udmVydGVkIHRvIGZvcndhcmQgc2xhc2hlc1xuICAvLyBTZWU6IGh0dHBzOi8vY29kZS5nb29nbGUuY29tL3AvY2hyb21pdW0vaXNzdWVzL2RldGFpbD9pZD0yNTkxNlxuICB2YXIgcXVlcnlJbmRleCA9IHVybC5pbmRleE9mKCc/JyksXG4gICAgICBzcGxpdHRlciA9XG4gICAgICAgICAgKHF1ZXJ5SW5kZXggIT09IC0xICYmIHF1ZXJ5SW5kZXggPCB1cmwuaW5kZXhPZignIycpKSA/ICc/JyA6ICcjJyxcbiAgICAgIHVTcGxpdCA9IHVybC5zcGxpdChzcGxpdHRlciksXG4gICAgICBzbGFzaFJlZ2V4ID0gL1xcXFwvZztcbiAgdVNwbGl0WzBdID0gdVNwbGl0WzBdLnJlcGxhY2Uoc2xhc2hSZWdleCwgJy8nKTtcbiAgdXJsID0gdVNwbGl0LmpvaW4oc3BsaXR0ZXIpO1xuXG4gIHZhciByZXN0ID0gdXJsO1xuXG4gIC8vIHRyaW0gYmVmb3JlIHByb2NlZWRpbmcuXG4gIC8vIFRoaXMgaXMgdG8gc3VwcG9ydCBwYXJzZSBzdHVmZiBsaWtlIFwiICBodHRwOi8vZm9vLmNvbSAgXFxuXCJcbiAgcmVzdCA9IHJlc3QudHJpbSgpO1xuXG4gIGlmICghc2xhc2hlc0Rlbm90ZUhvc3QgJiYgdXJsLnNwbGl0KCcjJykubGVuZ3RoID09PSAxKSB7XG4gICAgLy8gVHJ5IGZhc3QgcGF0aCByZWdleHBcbiAgICB2YXIgc2ltcGxlUGF0aCA9IHNpbXBsZVBhdGhQYXR0ZXJuLmV4ZWMocmVzdCk7XG4gICAgaWYgKHNpbXBsZVBhdGgpIHtcbiAgICAgIHRoaXMucGF0aCA9IHJlc3Q7XG4gICAgICB0aGlzLmhyZWYgPSByZXN0O1xuICAgICAgdGhpcy5wYXRobmFtZSA9IHNpbXBsZVBhdGhbMV07XG4gICAgICBpZiAoc2ltcGxlUGF0aFsyXSkge1xuICAgICAgICB0aGlzLnNlYXJjaCA9IHNpbXBsZVBhdGhbMl07XG4gICAgICAgIGlmIChwYXJzZVF1ZXJ5U3RyaW5nKSB7XG4gICAgICAgICAgdGhpcy5xdWVyeSA9IHF1ZXJ5c3RyaW5nLnBhcnNlKHRoaXMuc2VhcmNoLnN1YnN0cigxKSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgdGhpcy5xdWVyeSA9IHRoaXMuc2VhcmNoLnN1YnN0cigxKTtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIGlmIChwYXJzZVF1ZXJ5U3RyaW5nKSB7XG4gICAgICAgIHRoaXMuc2VhcmNoID0gJyc7XG4gICAgICAgIHRoaXMucXVlcnkgPSB7fTtcbiAgICAgIH1cbiAgICAgIHJldHVybiB0aGlzO1xuICAgIH1cbiAgfVxuXG4gIHZhciBwcm90byA9IHByb3RvY29sUGF0dGVybi5leGVjKHJlc3QpO1xuICBpZiAocHJvdG8pIHtcbiAgICBwcm90byA9IHByb3RvWzBdO1xuICAgIHZhciBsb3dlclByb3RvID0gcHJvdG8udG9Mb3dlckNhc2UoKTtcbiAgICB0aGlzLnByb3RvY29sID0gbG93ZXJQcm90bztcbiAgICByZXN0ID0gcmVzdC5zdWJzdHIocHJvdG8ubGVuZ3RoKTtcbiAgfVxuXG4gIC8vIGZpZ3VyZSBvdXQgaWYgaXQncyBnb3QgYSBob3N0XG4gIC8vIHVzZXJAc2VydmVyIGlzICphbHdheXMqIGludGVycHJldGVkIGFzIGEgaG9zdG5hbWUsIGFuZCB1cmxcbiAgLy8gcmVzb2x1dGlvbiB3aWxsIHRyZWF0IC8vZm9vL2JhciBhcyBob3N0PWZvbyxwYXRoPWJhciBiZWNhdXNlIHRoYXQnc1xuICAvLyBob3cgdGhlIGJyb3dzZXIgcmVzb2x2ZXMgcmVsYXRpdmUgVVJMcy5cbiAgaWYgKHNsYXNoZXNEZW5vdGVIb3N0IHx8IHByb3RvIHx8IHJlc3QubWF0Y2goL15cXC9cXC9bXkBcXC9dK0BbXkBcXC9dKy8pKSB7XG4gICAgdmFyIHNsYXNoZXMgPSByZXN0LnN1YnN0cigwLCAyKSA9PT0gJy8vJztcbiAgICBpZiAoc2xhc2hlcyAmJiAhKHByb3RvICYmIGhvc3RsZXNzUHJvdG9jb2xbcHJvdG9dKSkge1xuICAgICAgcmVzdCA9IHJlc3Quc3Vic3RyKDIpO1xuICAgICAgdGhpcy5zbGFzaGVzID0gdHJ1ZTtcbiAgICB9XG4gIH1cblxuICBpZiAoIWhvc3RsZXNzUHJvdG9jb2xbcHJvdG9dICYmXG4gICAgICAoc2xhc2hlcyB8fCAocHJvdG8gJiYgIXNsYXNoZWRQcm90b2NvbFtwcm90b10pKSkge1xuXG4gICAgLy8gdGhlcmUncyBhIGhvc3RuYW1lLlxuICAgIC8vIHRoZSBmaXJzdCBpbnN0YW5jZSBvZiAvLCA/LCA7LCBvciAjIGVuZHMgdGhlIGhvc3QuXG4gICAgLy9cbiAgICAvLyBJZiB0aGVyZSBpcyBhbiBAIGluIHRoZSBob3N0bmFtZSwgdGhlbiBub24taG9zdCBjaGFycyAqYXJlKiBhbGxvd2VkXG4gICAgLy8gdG8gdGhlIGxlZnQgb2YgdGhlIGxhc3QgQCBzaWduLCB1bmxlc3Mgc29tZSBob3N0LWVuZGluZyBjaGFyYWN0ZXJcbiAgICAvLyBjb21lcyAqYmVmb3JlKiB0aGUgQC1zaWduLlxuICAgIC8vIFVSTHMgYXJlIG9ibm94aW91cy5cbiAgICAvL1xuICAgIC8vIGV4OlxuICAgIC8vIGh0dHA6Ly9hQGJAYy8gPT4gdXNlcjphQGIgaG9zdDpjXG4gICAgLy8gaHR0cDovL2FAYj9AYyA9PiB1c2VyOmEgaG9zdDpjIHBhdGg6Lz9AY1xuXG4gICAgLy8gdjAuMTIgVE9ETyhpc2FhY3MpOiBUaGlzIGlzIG5vdCBxdWl0ZSBob3cgQ2hyb21lIGRvZXMgdGhpbmdzLlxuICAgIC8vIFJldmlldyBvdXIgdGVzdCBjYXNlIGFnYWluc3QgYnJvd3NlcnMgbW9yZSBjb21wcmVoZW5zaXZlbHkuXG5cbiAgICAvLyBmaW5kIHRoZSBmaXJzdCBpbnN0YW5jZSBvZiBhbnkgaG9zdEVuZGluZ0NoYXJzXG4gICAgdmFyIGhvc3RFbmQgPSAtMTtcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IGhvc3RFbmRpbmdDaGFycy5sZW5ndGg7IGkrKykge1xuICAgICAgdmFyIGhlYyA9IHJlc3QuaW5kZXhPZihob3N0RW5kaW5nQ2hhcnNbaV0pO1xuICAgICAgaWYgKGhlYyAhPT0gLTEgJiYgKGhvc3RFbmQgPT09IC0xIHx8IGhlYyA8IGhvc3RFbmQpKVxuICAgICAgICBob3N0RW5kID0gaGVjO1xuICAgIH1cblxuICAgIC8vIGF0IHRoaXMgcG9pbnQsIGVpdGhlciB3ZSBoYXZlIGFuIGV4cGxpY2l0IHBvaW50IHdoZXJlIHRoZVxuICAgIC8vIGF1dGggcG9ydGlvbiBjYW5ub3QgZ28gcGFzdCwgb3IgdGhlIGxhc3QgQCBjaGFyIGlzIHRoZSBkZWNpZGVyLlxuICAgIHZhciBhdXRoLCBhdFNpZ247XG4gICAgaWYgKGhvc3RFbmQgPT09IC0xKSB7XG4gICAgICAvLyBhdFNpZ24gY2FuIGJlIGFueXdoZXJlLlxuICAgICAgYXRTaWduID0gcmVzdC5sYXN0SW5kZXhPZignQCcpO1xuICAgIH0gZWxzZSB7XG4gICAgICAvLyBhdFNpZ24gbXVzdCBiZSBpbiBhdXRoIHBvcnRpb24uXG4gICAgICAvLyBodHRwOi8vYUBiL2NAZCA9PiBob3N0OmIgYXV0aDphIHBhdGg6L2NAZFxuICAgICAgYXRTaWduID0gcmVzdC5sYXN0SW5kZXhPZignQCcsIGhvc3RFbmQpO1xuICAgIH1cblxuICAgIC8vIE5vdyB3ZSBoYXZlIGEgcG9ydGlvbiB3aGljaCBpcyBkZWZpbml0ZWx5IHRoZSBhdXRoLlxuICAgIC8vIFB1bGwgdGhhdCBvZmYuXG4gICAgaWYgKGF0U2lnbiAhPT0gLTEpIHtcbiAgICAgIGF1dGggPSByZXN0LnNsaWNlKDAsIGF0U2lnbik7XG4gICAgICByZXN0ID0gcmVzdC5zbGljZShhdFNpZ24gKyAxKTtcbiAgICAgIHRoaXMuYXV0aCA9IGRlY29kZVVSSUNvbXBvbmVudChhdXRoKTtcbiAgICB9XG5cbiAgICAvLyB0aGUgaG9zdCBpcyB0aGUgcmVtYWluaW5nIHRvIHRoZSBsZWZ0IG9mIHRoZSBmaXJzdCBub24taG9zdCBjaGFyXG4gICAgaG9zdEVuZCA9IC0xO1xuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgbm9uSG9zdENoYXJzLmxlbmd0aDsgaSsrKSB7XG4gICAgICB2YXIgaGVjID0gcmVzdC5pbmRleE9mKG5vbkhvc3RDaGFyc1tpXSk7XG4gICAgICBpZiAoaGVjICE9PSAtMSAmJiAoaG9zdEVuZCA9PT0gLTEgfHwgaGVjIDwgaG9zdEVuZCkpXG4gICAgICAgIGhvc3RFbmQgPSBoZWM7XG4gICAgfVxuICAgIC8vIGlmIHdlIHN0aWxsIGhhdmUgbm90IGhpdCBpdCwgdGhlbiB0aGUgZW50aXJlIHRoaW5nIGlzIGEgaG9zdC5cbiAgICBpZiAoaG9zdEVuZCA9PT0gLTEpXG4gICAgICBob3N0RW5kID0gcmVzdC5sZW5ndGg7XG5cbiAgICB0aGlzLmhvc3QgPSByZXN0LnNsaWNlKDAsIGhvc3RFbmQpO1xuICAgIHJlc3QgPSByZXN0LnNsaWNlKGhvc3RFbmQpO1xuXG4gICAgLy8gcHVsbCBvdXQgcG9ydC5cbiAgICB0aGlzLnBhcnNlSG9zdCgpO1xuXG4gICAgLy8gd2UndmUgaW5kaWNhdGVkIHRoYXQgdGhlcmUgaXMgYSBob3N0bmFtZSxcbiAgICAvLyBzbyBldmVuIGlmIGl0J3MgZW1wdHksIGl0IGhhcyB0byBiZSBwcmVzZW50LlxuICAgIHRoaXMuaG9zdG5hbWUgPSB0aGlzLmhvc3RuYW1lIHx8ICcnO1xuXG4gICAgLy8gaWYgaG9zdG5hbWUgYmVnaW5zIHdpdGggWyBhbmQgZW5kcyB3aXRoIF1cbiAgICAvLyBhc3N1bWUgdGhhdCBpdCdzIGFuIElQdjYgYWRkcmVzcy5cbiAgICB2YXIgaXB2Nkhvc3RuYW1lID0gdGhpcy5ob3N0bmFtZVswXSA9PT0gJ1snICYmXG4gICAgICAgIHRoaXMuaG9zdG5hbWVbdGhpcy5ob3N0bmFtZS5sZW5ndGggLSAxXSA9PT0gJ10nO1xuXG4gICAgLy8gdmFsaWRhdGUgYSBsaXR0bGUuXG4gICAgaWYgKCFpcHY2SG9zdG5hbWUpIHtcbiAgICAgIHZhciBob3N0cGFydHMgPSB0aGlzLmhvc3RuYW1lLnNwbGl0KC9cXC4vKTtcbiAgICAgIGZvciAodmFyIGkgPSAwLCBsID0gaG9zdHBhcnRzLmxlbmd0aDsgaSA8IGw7IGkrKykge1xuICAgICAgICB2YXIgcGFydCA9IGhvc3RwYXJ0c1tpXTtcbiAgICAgICAgaWYgKCFwYXJ0KSBjb250aW51ZTtcbiAgICAgICAgaWYgKCFwYXJ0Lm1hdGNoKGhvc3RuYW1lUGFydFBhdHRlcm4pKSB7XG4gICAgICAgICAgdmFyIG5ld3BhcnQgPSAnJztcbiAgICAgICAgICBmb3IgKHZhciBqID0gMCwgayA9IHBhcnQubGVuZ3RoOyBqIDwgazsgaisrKSB7XG4gICAgICAgICAgICBpZiAocGFydC5jaGFyQ29kZUF0KGopID4gMTI3KSB7XG4gICAgICAgICAgICAgIC8vIHdlIHJlcGxhY2Ugbm9uLUFTQ0lJIGNoYXIgd2l0aCBhIHRlbXBvcmFyeSBwbGFjZWhvbGRlclxuICAgICAgICAgICAgICAvLyB3ZSBuZWVkIHRoaXMgdG8gbWFrZSBzdXJlIHNpemUgb2YgaG9zdG5hbWUgaXMgbm90XG4gICAgICAgICAgICAgIC8vIGJyb2tlbiBieSByZXBsYWNpbmcgbm9uLUFTQ0lJIGJ5IG5vdGhpbmdcbiAgICAgICAgICAgICAgbmV3cGFydCArPSAneCc7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICBuZXdwYXJ0ICs9IHBhcnRbal07XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICAgIC8vIHdlIHRlc3QgYWdhaW4gd2l0aCBBU0NJSSBjaGFyIG9ubHlcbiAgICAgICAgICBpZiAoIW5ld3BhcnQubWF0Y2goaG9zdG5hbWVQYXJ0UGF0dGVybikpIHtcbiAgICAgICAgICAgIHZhciB2YWxpZFBhcnRzID0gaG9zdHBhcnRzLnNsaWNlKDAsIGkpO1xuICAgICAgICAgICAgdmFyIG5vdEhvc3QgPSBob3N0cGFydHMuc2xpY2UoaSArIDEpO1xuICAgICAgICAgICAgdmFyIGJpdCA9IHBhcnQubWF0Y2goaG9zdG5hbWVQYXJ0U3RhcnQpO1xuICAgICAgICAgICAgaWYgKGJpdCkge1xuICAgICAgICAgICAgICB2YWxpZFBhcnRzLnB1c2goYml0WzFdKTtcbiAgICAgICAgICAgICAgbm90SG9zdC51bnNoaWZ0KGJpdFsyXSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAobm90SG9zdC5sZW5ndGgpIHtcbiAgICAgICAgICAgICAgcmVzdCA9ICcvJyArIG5vdEhvc3Quam9pbignLicpICsgcmVzdDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHRoaXMuaG9zdG5hbWUgPSB2YWxpZFBhcnRzLmpvaW4oJy4nKTtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cblxuICAgIGlmICh0aGlzLmhvc3RuYW1lLmxlbmd0aCA+IGhvc3RuYW1lTWF4TGVuKSB7XG4gICAgICB0aGlzLmhvc3RuYW1lID0gJyc7XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIGhvc3RuYW1lcyBhcmUgYWx3YXlzIGxvd2VyIGNhc2UuXG4gICAgICB0aGlzLmhvc3RuYW1lID0gdGhpcy5ob3N0bmFtZS50b0xvd2VyQ2FzZSgpO1xuICAgIH1cblxuICAgIGlmICghaXB2Nkhvc3RuYW1lKSB7XG4gICAgICAvLyBJRE5BIFN1cHBvcnQ6IFJldHVybnMgYSBwdW55Y29kZWQgcmVwcmVzZW50YXRpb24gb2YgXCJkb21haW5cIi5cbiAgICAgIC8vIEl0IG9ubHkgY29udmVydHMgcGFydHMgb2YgdGhlIGRvbWFpbiBuYW1lIHRoYXRcbiAgICAgIC8vIGhhdmUgbm9uLUFTQ0lJIGNoYXJhY3RlcnMsIGkuZS4gaXQgZG9lc24ndCBtYXR0ZXIgaWZcbiAgICAgIC8vIHlvdSBjYWxsIGl0IHdpdGggYSBkb21haW4gdGhhdCBhbHJlYWR5IGlzIEFTQ0lJLW9ubHkuXG4gICAgICB0aGlzLmhvc3RuYW1lID0gcHVueWNvZGUudG9BU0NJSSh0aGlzLmhvc3RuYW1lKTtcbiAgICB9XG5cbiAgICB2YXIgcCA9IHRoaXMucG9ydCA/ICc6JyArIHRoaXMucG9ydCA6ICcnO1xuICAgIHZhciBoID0gdGhpcy5ob3N0bmFtZSB8fCAnJztcbiAgICB0aGlzLmhvc3QgPSBoICsgcDtcbiAgICB0aGlzLmhyZWYgKz0gdGhpcy5ob3N0O1xuXG4gICAgLy8gc3RyaXAgWyBhbmQgXSBmcm9tIHRoZSBob3N0bmFtZVxuICAgIC8vIHRoZSBob3N0IGZpZWxkIHN0aWxsIHJldGFpbnMgdGhlbSwgdGhvdWdoXG4gICAgaWYgKGlwdjZIb3N0bmFtZSkge1xuICAgICAgdGhpcy5ob3N0bmFtZSA9IHRoaXMuaG9zdG5hbWUuc3Vic3RyKDEsIHRoaXMuaG9zdG5hbWUubGVuZ3RoIC0gMik7XG4gICAgICBpZiAocmVzdFswXSAhPT0gJy8nKSB7XG4gICAgICAgIHJlc3QgPSAnLycgKyByZXN0O1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIC8vIG5vdyByZXN0IGlzIHNldCB0byB0aGUgcG9zdC1ob3N0IHN0dWZmLlxuICAvLyBjaG9wIG9mZiBhbnkgZGVsaW0gY2hhcnMuXG4gIGlmICghdW5zYWZlUHJvdG9jb2xbbG93ZXJQcm90b10pIHtcblxuICAgIC8vIEZpcnN0LCBtYWtlIDEwMCUgc3VyZSB0aGF0IGFueSBcImF1dG9Fc2NhcGVcIiBjaGFycyBnZXRcbiAgICAvLyBlc2NhcGVkLCBldmVuIGlmIGVuY29kZVVSSUNvbXBvbmVudCBkb2Vzbid0IHRoaW5rIHRoZXlcbiAgICAvLyBuZWVkIHRvIGJlLlxuICAgIGZvciAodmFyIGkgPSAwLCBsID0gYXV0b0VzY2FwZS5sZW5ndGg7IGkgPCBsOyBpKyspIHtcbiAgICAgIHZhciBhZSA9IGF1dG9Fc2NhcGVbaV07XG4gICAgICBpZiAocmVzdC5pbmRleE9mKGFlKSA9PT0gLTEpXG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgdmFyIGVzYyA9IGVuY29kZVVSSUNvbXBvbmVudChhZSk7XG4gICAgICBpZiAoZXNjID09PSBhZSkge1xuICAgICAgICBlc2MgPSBlc2NhcGUoYWUpO1xuICAgICAgfVxuICAgICAgcmVzdCA9IHJlc3Quc3BsaXQoYWUpLmpvaW4oZXNjKTtcbiAgICB9XG4gIH1cblxuXG4gIC8vIGNob3Agb2ZmIGZyb20gdGhlIHRhaWwgZmlyc3QuXG4gIHZhciBoYXNoID0gcmVzdC5pbmRleE9mKCcjJyk7XG4gIGlmIChoYXNoICE9PSAtMSkge1xuICAgIC8vIGdvdCBhIGZyYWdtZW50IHN0cmluZy5cbiAgICB0aGlzLmhhc2ggPSByZXN0LnN1YnN0cihoYXNoKTtcbiAgICByZXN0ID0gcmVzdC5zbGljZSgwLCBoYXNoKTtcbiAgfVxuICB2YXIgcW0gPSByZXN0LmluZGV4T2YoJz8nKTtcbiAgaWYgKHFtICE9PSAtMSkge1xuICAgIHRoaXMuc2VhcmNoID0gcmVzdC5zdWJzdHIocW0pO1xuICAgIHRoaXMucXVlcnkgPSByZXN0LnN1YnN0cihxbSArIDEpO1xuICAgIGlmIChwYXJzZVF1ZXJ5U3RyaW5nKSB7XG4gICAgICB0aGlzLnF1ZXJ5ID0gcXVlcnlzdHJpbmcucGFyc2UodGhpcy5xdWVyeSk7XG4gICAgfVxuICAgIHJlc3QgPSByZXN0LnNsaWNlKDAsIHFtKTtcbiAgfSBlbHNlIGlmIChwYXJzZVF1ZXJ5U3RyaW5nKSB7XG4gICAgLy8gbm8gcXVlcnkgc3RyaW5nLCBidXQgcGFyc2VRdWVyeVN0cmluZyBzdGlsbCByZXF1ZXN0ZWRcbiAgICB0aGlzLnNlYXJjaCA9ICcnO1xuICAgIHRoaXMucXVlcnkgPSB7fTtcbiAgfVxuICBpZiAocmVzdCkgdGhpcy5wYXRobmFtZSA9IHJlc3Q7XG4gIGlmIChzbGFzaGVkUHJvdG9jb2xbbG93ZXJQcm90b10gJiZcbiAgICAgIHRoaXMuaG9zdG5hbWUgJiYgIXRoaXMucGF0aG5hbWUpIHtcbiAgICB0aGlzLnBhdGhuYW1lID0gJy8nO1xuICB9XG5cbiAgLy90byBzdXBwb3J0IGh0dHAucmVxdWVzdFxuICBpZiAodGhpcy5wYXRobmFtZSB8fCB0aGlzLnNlYXJjaCkge1xuICAgIHZhciBwID0gdGhpcy5wYXRobmFtZSB8fCAnJztcbiAgICB2YXIgcyA9IHRoaXMuc2VhcmNoIHx8ICcnO1xuICAgIHRoaXMucGF0aCA9IHAgKyBzO1xuICB9XG5cbiAgLy8gZmluYWxseSwgcmVjb25zdHJ1Y3QgdGhlIGhyZWYgYmFzZWQgb24gd2hhdCBoYXMgYmVlbiB2YWxpZGF0ZWQuXG4gIHRoaXMuaHJlZiA9IHRoaXMuZm9ybWF0KCk7XG4gIHJldHVybiB0aGlzO1xufTtcblxuLy8gZm9ybWF0IGEgcGFyc2VkIG9iamVjdCBpbnRvIGEgdXJsIHN0cmluZ1xuZnVuY3Rpb24gdXJsRm9ybWF0KG9iaikge1xuICAvLyBlbnN1cmUgaXQncyBhbiBvYmplY3QsIGFuZCBub3QgYSBzdHJpbmcgdXJsLlxuICAvLyBJZiBpdCdzIGFuIG9iaiwgdGhpcyBpcyBhIG5vLW9wLlxuICAvLyB0aGlzIHdheSwgeW91IGNhbiBjYWxsIHVybF9mb3JtYXQoKSBvbiBzdHJpbmdzXG4gIC8vIHRvIGNsZWFuIHVwIHBvdGVudGlhbGx5IHdvbmt5IHVybHMuXG4gIGlmICh1dGlsLmlzU3RyaW5nKG9iaikpIG9iaiA9IHVybFBhcnNlKG9iaik7XG4gIGlmICghKG9iaiBpbnN0YW5jZW9mIFVybCkpIHJldHVybiBVcmwucHJvdG90eXBlLmZvcm1hdC5jYWxsKG9iaik7XG4gIHJldHVybiBvYmouZm9ybWF0KCk7XG59XG5cblVybC5wcm90b3R5cGUuZm9ybWF0ID0gZnVuY3Rpb24oKSB7XG4gIHZhciBhdXRoID0gdGhpcy5hdXRoIHx8ICcnO1xuICBpZiAoYXV0aCkge1xuICAgIGF1dGggPSBlbmNvZGVVUklDb21wb25lbnQoYXV0aCk7XG4gICAgYXV0aCA9IGF1dGgucmVwbGFjZSgvJTNBL2ksICc6Jyk7XG4gICAgYXV0aCArPSAnQCc7XG4gIH1cblxuICB2YXIgcHJvdG9jb2wgPSB0aGlzLnByb3RvY29sIHx8ICcnLFxuICAgICAgcGF0aG5hbWUgPSB0aGlzLnBhdGhuYW1lIHx8ICcnLFxuICAgICAgaGFzaCA9IHRoaXMuaGFzaCB8fCAnJyxcbiAgICAgIGhvc3QgPSBmYWxzZSxcbiAgICAgIHF1ZXJ5ID0gJyc7XG5cbiAgaWYgKHRoaXMuaG9zdCkge1xuICAgIGhvc3QgPSBhdXRoICsgdGhpcy5ob3N0O1xuICB9IGVsc2UgaWYgKHRoaXMuaG9zdG5hbWUpIHtcbiAgICBob3N0ID0gYXV0aCArICh0aGlzLmhvc3RuYW1lLmluZGV4T2YoJzonKSA9PT0gLTEgP1xuICAgICAgICB0aGlzLmhvc3RuYW1lIDpcbiAgICAgICAgJ1snICsgdGhpcy5ob3N0bmFtZSArICddJyk7XG4gICAgaWYgKHRoaXMucG9ydCkge1xuICAgICAgaG9zdCArPSAnOicgKyB0aGlzLnBvcnQ7XG4gICAgfVxuICB9XG5cbiAgaWYgKHRoaXMucXVlcnkgJiZcbiAgICAgIHV0aWwuaXNPYmplY3QodGhpcy5xdWVyeSkgJiZcbiAgICAgIE9iamVjdC5rZXlzKHRoaXMucXVlcnkpLmxlbmd0aCkge1xuICAgIHF1ZXJ5ID0gcXVlcnlzdHJpbmcuc3RyaW5naWZ5KHRoaXMucXVlcnkpO1xuICB9XG5cbiAgdmFyIHNlYXJjaCA9IHRoaXMuc2VhcmNoIHx8IChxdWVyeSAmJiAoJz8nICsgcXVlcnkpKSB8fCAnJztcblxuICBpZiAocHJvdG9jb2wgJiYgcHJvdG9jb2wuc3Vic3RyKC0xKSAhPT0gJzonKSBwcm90b2NvbCArPSAnOic7XG5cbiAgLy8gb25seSB0aGUgc2xhc2hlZFByb3RvY29scyBnZXQgdGhlIC8vLiAgTm90IG1haWx0bzosIHhtcHA6LCBldGMuXG4gIC8vIHVubGVzcyB0aGV5IGhhZCB0aGVtIHRvIGJlZ2luIHdpdGguXG4gIGlmICh0aGlzLnNsYXNoZXMgfHxcbiAgICAgICghcHJvdG9jb2wgfHwgc2xhc2hlZFByb3RvY29sW3Byb3RvY29sXSkgJiYgaG9zdCAhPT0gZmFsc2UpIHtcbiAgICBob3N0ID0gJy8vJyArIChob3N0IHx8ICcnKTtcbiAgICBpZiAocGF0aG5hbWUgJiYgcGF0aG5hbWUuY2hhckF0KDApICE9PSAnLycpIHBhdGhuYW1lID0gJy8nICsgcGF0aG5hbWU7XG4gIH0gZWxzZSBpZiAoIWhvc3QpIHtcbiAgICBob3N0ID0gJyc7XG4gIH1cblxuICBpZiAoaGFzaCAmJiBoYXNoLmNoYXJBdCgwKSAhPT0gJyMnKSBoYXNoID0gJyMnICsgaGFzaDtcbiAgaWYgKHNlYXJjaCAmJiBzZWFyY2guY2hhckF0KDApICE9PSAnPycpIHNlYXJjaCA9ICc/JyArIHNlYXJjaDtcblxuICBwYXRobmFtZSA9IHBhdGhuYW1lLnJlcGxhY2UoL1s/I10vZywgZnVuY3Rpb24obWF0Y2gpIHtcbiAgICByZXR1cm4gZW5jb2RlVVJJQ29tcG9uZW50KG1hdGNoKTtcbiAgfSk7XG4gIHNlYXJjaCA9IHNlYXJjaC5yZXBsYWNlKCcjJywgJyUyMycpO1xuXG4gIHJldHVybiBwcm90b2NvbCArIGhvc3QgKyBwYXRobmFtZSArIHNlYXJjaCArIGhhc2g7XG59O1xuXG5mdW5jdGlvbiB1cmxSZXNvbHZlKHNvdXJjZSwgcmVsYXRpdmUpIHtcbiAgcmV0dXJuIHVybFBhcnNlKHNvdXJjZSwgZmFsc2UsIHRydWUpLnJlc29sdmUocmVsYXRpdmUpO1xufVxuXG5VcmwucHJvdG90eXBlLnJlc29sdmUgPSBmdW5jdGlvbihyZWxhdGl2ZSkge1xuICByZXR1cm4gdGhpcy5yZXNvbHZlT2JqZWN0KHVybFBhcnNlKHJlbGF0aXZlLCBmYWxzZSwgdHJ1ZSkpLmZvcm1hdCgpO1xufTtcblxuZnVuY3Rpb24gdXJsUmVzb2x2ZU9iamVjdChzb3VyY2UsIHJlbGF0aXZlKSB7XG4gIGlmICghc291cmNlKSByZXR1cm4gcmVsYXRpdmU7XG4gIHJldHVybiB1cmxQYXJzZShzb3VyY2UsIGZhbHNlLCB0cnVlKS5yZXNvbHZlT2JqZWN0KHJlbGF0aXZlKTtcbn1cblxuVXJsLnByb3RvdHlwZS5yZXNvbHZlT2JqZWN0ID0gZnVuY3Rpb24ocmVsYXRpdmUpIHtcbiAgaWYgKHV0aWwuaXNTdHJpbmcocmVsYXRpdmUpKSB7XG4gICAgdmFyIHJlbCA9IG5ldyBVcmwoKTtcbiAgICByZWwucGFyc2UocmVsYXRpdmUsIGZhbHNlLCB0cnVlKTtcbiAgICByZWxhdGl2ZSA9IHJlbDtcbiAgfVxuXG4gIHZhciByZXN1bHQgPSBuZXcgVXJsKCk7XG4gIHZhciB0a2V5cyA9IE9iamVjdC5rZXlzKHRoaXMpO1xuICBmb3IgKHZhciB0ayA9IDA7IHRrIDwgdGtleXMubGVuZ3RoOyB0aysrKSB7XG4gICAgdmFyIHRrZXkgPSB0a2V5c1t0a107XG4gICAgcmVzdWx0W3RrZXldID0gdGhpc1t0a2V5XTtcbiAgfVxuXG4gIC8vIGhhc2ggaXMgYWx3YXlzIG92ZXJyaWRkZW4sIG5vIG1hdHRlciB3aGF0LlxuICAvLyBldmVuIGhyZWY9XCJcIiB3aWxsIHJlbW92ZSBpdC5cbiAgcmVzdWx0Lmhhc2ggPSByZWxhdGl2ZS5oYXNoO1xuXG4gIC8vIGlmIHRoZSByZWxhdGl2ZSB1cmwgaXMgZW1wdHksIHRoZW4gdGhlcmUncyBub3RoaW5nIGxlZnQgdG8gZG8gaGVyZS5cbiAgaWYgKHJlbGF0aXZlLmhyZWYgPT09ICcnKSB7XG4gICAgcmVzdWx0LmhyZWYgPSByZXN1bHQuZm9ybWF0KCk7XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxuXG4gIC8vIGhyZWZzIGxpa2UgLy9mb28vYmFyIGFsd2F5cyBjdXQgdG8gdGhlIHByb3RvY29sLlxuICBpZiAocmVsYXRpdmUuc2xhc2hlcyAmJiAhcmVsYXRpdmUucHJvdG9jb2wpIHtcbiAgICAvLyB0YWtlIGV2ZXJ5dGhpbmcgZXhjZXB0IHRoZSBwcm90b2NvbCBmcm9tIHJlbGF0aXZlXG4gICAgdmFyIHJrZXlzID0gT2JqZWN0LmtleXMocmVsYXRpdmUpO1xuICAgIGZvciAodmFyIHJrID0gMDsgcmsgPCBya2V5cy5sZW5ndGg7IHJrKyspIHtcbiAgICAgIHZhciBya2V5ID0gcmtleXNbcmtdO1xuICAgICAgaWYgKHJrZXkgIT09ICdwcm90b2NvbCcpXG4gICAgICAgIHJlc3VsdFtya2V5XSA9IHJlbGF0aXZlW3JrZXldO1xuICAgIH1cblxuICAgIC8vdXJsUGFyc2UgYXBwZW5kcyB0cmFpbGluZyAvIHRvIHVybHMgbGlrZSBodHRwOi8vd3d3LmV4YW1wbGUuY29tXG4gICAgaWYgKHNsYXNoZWRQcm90b2NvbFtyZXN1bHQucHJvdG9jb2xdICYmXG4gICAgICAgIHJlc3VsdC5ob3N0bmFtZSAmJiAhcmVzdWx0LnBhdGhuYW1lKSB7XG4gICAgICByZXN1bHQucGF0aCA9IHJlc3VsdC5wYXRobmFtZSA9ICcvJztcbiAgICB9XG5cbiAgICByZXN1bHQuaHJlZiA9IHJlc3VsdC5mb3JtYXQoKTtcbiAgICByZXR1cm4gcmVzdWx0O1xuICB9XG5cbiAgaWYgKHJlbGF0aXZlLnByb3RvY29sICYmIHJlbGF0aXZlLnByb3RvY29sICE9PSByZXN1bHQucHJvdG9jb2wpIHtcbiAgICAvLyBpZiBpdCdzIGEga25vd24gdXJsIHByb3RvY29sLCB0aGVuIGNoYW5naW5nXG4gICAgLy8gdGhlIHByb3RvY29sIGRvZXMgd2VpcmQgdGhpbmdzXG4gICAgLy8gZmlyc3QsIGlmIGl0J3Mgbm90IGZpbGU6LCB0aGVuIHdlIE1VU1QgaGF2ZSBhIGhvc3QsXG4gICAgLy8gYW5kIGlmIHRoZXJlIHdhcyBhIHBhdGhcbiAgICAvLyB0byBiZWdpbiB3aXRoLCB0aGVuIHdlIE1VU1QgaGF2ZSBhIHBhdGguXG4gICAgLy8gaWYgaXQgaXMgZmlsZTosIHRoZW4gdGhlIGhvc3QgaXMgZHJvcHBlZCxcbiAgICAvLyBiZWNhdXNlIHRoYXQncyBrbm93biB0byBiZSBob3N0bGVzcy5cbiAgICAvLyBhbnl0aGluZyBlbHNlIGlzIGFzc3VtZWQgdG8gYmUgYWJzb2x1dGUuXG4gICAgaWYgKCFzbGFzaGVkUHJvdG9jb2xbcmVsYXRpdmUucHJvdG9jb2xdKSB7XG4gICAgICB2YXIga2V5cyA9IE9iamVjdC5rZXlzKHJlbGF0aXZlKTtcbiAgICAgIGZvciAodmFyIHYgPSAwOyB2IDwga2V5cy5sZW5ndGg7IHYrKykge1xuICAgICAgICB2YXIgayA9IGtleXNbdl07XG4gICAgICAgIHJlc3VsdFtrXSA9IHJlbGF0aXZlW2tdO1xuICAgICAgfVxuICAgICAgcmVzdWx0LmhyZWYgPSByZXN1bHQuZm9ybWF0KCk7XG4gICAgICByZXR1cm4gcmVzdWx0O1xuICAgIH1cblxuICAgIHJlc3VsdC5wcm90b2NvbCA9IHJlbGF0aXZlLnByb3RvY29sO1xuICAgIGlmICghcmVsYXRpdmUuaG9zdCAmJiAhaG9zdGxlc3NQcm90b2NvbFtyZWxhdGl2ZS5wcm90b2NvbF0pIHtcbiAgICAgIHZhciByZWxQYXRoID0gKHJlbGF0aXZlLnBhdGhuYW1lIHx8ICcnKS5zcGxpdCgnLycpO1xuICAgICAgd2hpbGUgKHJlbFBhdGgubGVuZ3RoICYmICEocmVsYXRpdmUuaG9zdCA9IHJlbFBhdGguc2hpZnQoKSkpO1xuICAgICAgaWYgKCFyZWxhdGl2ZS5ob3N0KSByZWxhdGl2ZS5ob3N0ID0gJyc7XG4gICAgICBpZiAoIXJlbGF0aXZlLmhvc3RuYW1lKSByZWxhdGl2ZS5ob3N0bmFtZSA9ICcnO1xuICAgICAgaWYgKHJlbFBhdGhbMF0gIT09ICcnKSByZWxQYXRoLnVuc2hpZnQoJycpO1xuICAgICAgaWYgKHJlbFBhdGgubGVuZ3RoIDwgMikgcmVsUGF0aC51bnNoaWZ0KCcnKTtcbiAgICAgIHJlc3VsdC5wYXRobmFtZSA9IHJlbFBhdGguam9pbignLycpO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXN1bHQucGF0aG5hbWUgPSByZWxhdGl2ZS5wYXRobmFtZTtcbiAgICB9XG4gICAgcmVzdWx0LnNlYXJjaCA9IHJlbGF0aXZlLnNlYXJjaDtcbiAgICByZXN1bHQucXVlcnkgPSByZWxhdGl2ZS5xdWVyeTtcbiAgICByZXN1bHQuaG9zdCA9IHJlbGF0aXZlLmhvc3QgfHwgJyc7XG4gICAgcmVzdWx0LmF1dGggPSByZWxhdGl2ZS5hdXRoO1xuICAgIHJlc3VsdC5ob3N0bmFtZSA9IHJlbGF0aXZlLmhvc3RuYW1lIHx8IHJlbGF0aXZlLmhvc3Q7XG4gICAgcmVzdWx0LnBvcnQgPSByZWxhdGl2ZS5wb3J0O1xuICAgIC8vIHRvIHN1cHBvcnQgaHR0cC5yZXF1ZXN0XG4gICAgaWYgKHJlc3VsdC5wYXRobmFtZSB8fCByZXN1bHQuc2VhcmNoKSB7XG4gICAgICB2YXIgcCA9IHJlc3VsdC5wYXRobmFtZSB8fCAnJztcbiAgICAgIHZhciBzID0gcmVzdWx0LnNlYXJjaCB8fCAnJztcbiAgICAgIHJlc3VsdC5wYXRoID0gcCArIHM7XG4gICAgfVxuICAgIHJlc3VsdC5zbGFzaGVzID0gcmVzdWx0LnNsYXNoZXMgfHwgcmVsYXRpdmUuc2xhc2hlcztcbiAgICByZXN1bHQuaHJlZiA9IHJlc3VsdC5mb3JtYXQoKTtcbiAgICByZXR1cm4gcmVzdWx0O1xuICB9XG5cbiAgdmFyIGlzU291cmNlQWJzID0gKHJlc3VsdC5wYXRobmFtZSAmJiByZXN1bHQucGF0aG5hbWUuY2hhckF0KDApID09PSAnLycpLFxuICAgICAgaXNSZWxBYnMgPSAoXG4gICAgICAgICAgcmVsYXRpdmUuaG9zdCB8fFxuICAgICAgICAgIHJlbGF0aXZlLnBhdGhuYW1lICYmIHJlbGF0aXZlLnBhdGhuYW1lLmNoYXJBdCgwKSA9PT0gJy8nXG4gICAgICApLFxuICAgICAgbXVzdEVuZEFicyA9IChpc1JlbEFicyB8fCBpc1NvdXJjZUFicyB8fFxuICAgICAgICAgICAgICAgICAgICAocmVzdWx0Lmhvc3QgJiYgcmVsYXRpdmUucGF0aG5hbWUpKSxcbiAgICAgIHJlbW92ZUFsbERvdHMgPSBtdXN0RW5kQWJzLFxuICAgICAgc3JjUGF0aCA9IHJlc3VsdC5wYXRobmFtZSAmJiByZXN1bHQucGF0aG5hbWUuc3BsaXQoJy8nKSB8fCBbXSxcbiAgICAgIHJlbFBhdGggPSByZWxhdGl2ZS5wYXRobmFtZSAmJiByZWxhdGl2ZS5wYXRobmFtZS5zcGxpdCgnLycpIHx8IFtdLFxuICAgICAgcHN5Y2hvdGljID0gcmVzdWx0LnByb3RvY29sICYmICFzbGFzaGVkUHJvdG9jb2xbcmVzdWx0LnByb3RvY29sXTtcblxuICAvLyBpZiB0aGUgdXJsIGlzIGEgbm9uLXNsYXNoZWQgdXJsLCB0aGVuIHJlbGF0aXZlXG4gIC8vIGxpbmtzIGxpa2UgLi4vLi4gc2hvdWxkIGJlIGFibGVcbiAgLy8gdG8gY3Jhd2wgdXAgdG8gdGhlIGhvc3RuYW1lLCBhcyB3ZWxsLiAgVGhpcyBpcyBzdHJhbmdlLlxuICAvLyByZXN1bHQucHJvdG9jb2wgaGFzIGFscmVhZHkgYmVlbiBzZXQgYnkgbm93LlxuICAvLyBMYXRlciBvbiwgcHV0IHRoZSBmaXJzdCBwYXRoIHBhcnQgaW50byB0aGUgaG9zdCBmaWVsZC5cbiAgaWYgKHBzeWNob3RpYykge1xuICAgIHJlc3VsdC5ob3N0bmFtZSA9ICcnO1xuICAgIHJlc3VsdC5wb3J0ID0gbnVsbDtcbiAgICBpZiAocmVzdWx0Lmhvc3QpIHtcbiAgICAgIGlmIChzcmNQYXRoWzBdID09PSAnJykgc3JjUGF0aFswXSA9IHJlc3VsdC5ob3N0O1xuICAgICAgZWxzZSBzcmNQYXRoLnVuc2hpZnQocmVzdWx0Lmhvc3QpO1xuICAgIH1cbiAgICByZXN1bHQuaG9zdCA9ICcnO1xuICAgIGlmIChyZWxhdGl2ZS5wcm90b2NvbCkge1xuICAgICAgcmVsYXRpdmUuaG9zdG5hbWUgPSBudWxsO1xuICAgICAgcmVsYXRpdmUucG9ydCA9IG51bGw7XG4gICAgICBpZiAocmVsYXRpdmUuaG9zdCkge1xuICAgICAgICBpZiAocmVsUGF0aFswXSA9PT0gJycpIHJlbFBhdGhbMF0gPSByZWxhdGl2ZS5ob3N0O1xuICAgICAgICBlbHNlIHJlbFBhdGgudW5zaGlmdChyZWxhdGl2ZS5ob3N0KTtcbiAgICAgIH1cbiAgICAgIHJlbGF0aXZlLmhvc3QgPSBudWxsO1xuICAgIH1cbiAgICBtdXN0RW5kQWJzID0gbXVzdEVuZEFicyAmJiAocmVsUGF0aFswXSA9PT0gJycgfHwgc3JjUGF0aFswXSA9PT0gJycpO1xuICB9XG5cbiAgaWYgKGlzUmVsQWJzKSB7XG4gICAgLy8gaXQncyBhYnNvbHV0ZS5cbiAgICByZXN1bHQuaG9zdCA9IChyZWxhdGl2ZS5ob3N0IHx8IHJlbGF0aXZlLmhvc3QgPT09ICcnKSA/XG4gICAgICAgICAgICAgICAgICByZWxhdGl2ZS5ob3N0IDogcmVzdWx0Lmhvc3Q7XG4gICAgcmVzdWx0Lmhvc3RuYW1lID0gKHJlbGF0aXZlLmhvc3RuYW1lIHx8IHJlbGF0aXZlLmhvc3RuYW1lID09PSAnJykgP1xuICAgICAgICAgICAgICAgICAgICAgIHJlbGF0aXZlLmhvc3RuYW1lIDogcmVzdWx0Lmhvc3RuYW1lO1xuICAgIHJlc3VsdC5zZWFyY2ggPSByZWxhdGl2ZS5zZWFyY2g7XG4gICAgcmVzdWx0LnF1ZXJ5ID0gcmVsYXRpdmUucXVlcnk7XG4gICAgc3JjUGF0aCA9IHJlbFBhdGg7XG4gICAgLy8gZmFsbCB0aHJvdWdoIHRvIHRoZSBkb3QtaGFuZGxpbmcgYmVsb3cuXG4gIH0gZWxzZSBpZiAocmVsUGF0aC5sZW5ndGgpIHtcbiAgICAvLyBpdCdzIHJlbGF0aXZlXG4gICAgLy8gdGhyb3cgYXdheSB0aGUgZXhpc3RpbmcgZmlsZSwgYW5kIHRha2UgdGhlIG5ldyBwYXRoIGluc3RlYWQuXG4gICAgaWYgKCFzcmNQYXRoKSBzcmNQYXRoID0gW107XG4gICAgc3JjUGF0aC5wb3AoKTtcbiAgICBzcmNQYXRoID0gc3JjUGF0aC5jb25jYXQocmVsUGF0aCk7XG4gICAgcmVzdWx0LnNlYXJjaCA9IHJlbGF0aXZlLnNlYXJjaDtcbiAgICByZXN1bHQucXVlcnkgPSByZWxhdGl2ZS5xdWVyeTtcbiAgfSBlbHNlIGlmICghdXRpbC5pc051bGxPclVuZGVmaW5lZChyZWxhdGl2ZS5zZWFyY2gpKSB7XG4gICAgLy8ganVzdCBwdWxsIG91dCB0aGUgc2VhcmNoLlxuICAgIC8vIGxpa2UgaHJlZj0nP2ZvbycuXG4gICAgLy8gUHV0IHRoaXMgYWZ0ZXIgdGhlIG90aGVyIHR3byBjYXNlcyBiZWNhdXNlIGl0IHNpbXBsaWZpZXMgdGhlIGJvb2xlYW5zXG4gICAgaWYgKHBzeWNob3RpYykge1xuICAgICAgcmVzdWx0Lmhvc3RuYW1lID0gcmVzdWx0Lmhvc3QgPSBzcmNQYXRoLnNoaWZ0KCk7XG4gICAgICAvL29jY2F0aW9uYWx5IHRoZSBhdXRoIGNhbiBnZXQgc3R1Y2sgb25seSBpbiBob3N0XG4gICAgICAvL3RoaXMgZXNwZWNpYWxseSBoYXBwZW5zIGluIGNhc2VzIGxpa2VcbiAgICAgIC8vdXJsLnJlc29sdmVPYmplY3QoJ21haWx0bzpsb2NhbDFAZG9tYWluMScsICdsb2NhbDJAZG9tYWluMicpXG4gICAgICB2YXIgYXV0aEluSG9zdCA9IHJlc3VsdC5ob3N0ICYmIHJlc3VsdC5ob3N0LmluZGV4T2YoJ0AnKSA+IDAgP1xuICAgICAgICAgICAgICAgICAgICAgICByZXN1bHQuaG9zdC5zcGxpdCgnQCcpIDogZmFsc2U7XG4gICAgICBpZiAoYXV0aEluSG9zdCkge1xuICAgICAgICByZXN1bHQuYXV0aCA9IGF1dGhJbkhvc3Quc2hpZnQoKTtcbiAgICAgICAgcmVzdWx0Lmhvc3QgPSByZXN1bHQuaG9zdG5hbWUgPSBhdXRoSW5Ib3N0LnNoaWZ0KCk7XG4gICAgICB9XG4gICAgfVxuICAgIHJlc3VsdC5zZWFyY2ggPSByZWxhdGl2ZS5zZWFyY2g7XG4gICAgcmVzdWx0LnF1ZXJ5ID0gcmVsYXRpdmUucXVlcnk7XG4gICAgLy90byBzdXBwb3J0IGh0dHAucmVxdWVzdFxuICAgIGlmICghdXRpbC5pc051bGwocmVzdWx0LnBhdGhuYW1lKSB8fCAhdXRpbC5pc051bGwocmVzdWx0LnNlYXJjaCkpIHtcbiAgICAgIHJlc3VsdC5wYXRoID0gKHJlc3VsdC5wYXRobmFtZSA/IHJlc3VsdC5wYXRobmFtZSA6ICcnKSArXG4gICAgICAgICAgICAgICAgICAgIChyZXN1bHQuc2VhcmNoID8gcmVzdWx0LnNlYXJjaCA6ICcnKTtcbiAgICB9XG4gICAgcmVzdWx0LmhyZWYgPSByZXN1bHQuZm9ybWF0KCk7XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxuXG4gIGlmICghc3JjUGF0aC5sZW5ndGgpIHtcbiAgICAvLyBubyBwYXRoIGF0IGFsbC4gIGVhc3kuXG4gICAgLy8gd2UndmUgYWxyZWFkeSBoYW5kbGVkIHRoZSBvdGhlciBzdHVmZiBhYm92ZS5cbiAgICByZXN1bHQucGF0aG5hbWUgPSBudWxsO1xuICAgIC8vdG8gc3VwcG9ydCBodHRwLnJlcXVlc3RcbiAgICBpZiAocmVzdWx0LnNlYXJjaCkge1xuICAgICAgcmVzdWx0LnBhdGggPSAnLycgKyByZXN1bHQuc2VhcmNoO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXN1bHQucGF0aCA9IG51bGw7XG4gICAgfVxuICAgIHJlc3VsdC5ocmVmID0gcmVzdWx0LmZvcm1hdCgpO1xuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cblxuICAvLyBpZiBhIHVybCBFTkRzIGluIC4gb3IgLi4sIHRoZW4gaXQgbXVzdCBnZXQgYSB0cmFpbGluZyBzbGFzaC5cbiAgLy8gaG93ZXZlciwgaWYgaXQgZW5kcyBpbiBhbnl0aGluZyBlbHNlIG5vbi1zbGFzaHksXG4gIC8vIHRoZW4gaXQgbXVzdCBOT1QgZ2V0IGEgdHJhaWxpbmcgc2xhc2guXG4gIHZhciBsYXN0ID0gc3JjUGF0aC5zbGljZSgtMSlbMF07XG4gIHZhciBoYXNUcmFpbGluZ1NsYXNoID0gKFxuICAgICAgKHJlc3VsdC5ob3N0IHx8IHJlbGF0aXZlLmhvc3QgfHwgc3JjUGF0aC5sZW5ndGggPiAxKSAmJlxuICAgICAgKGxhc3QgPT09ICcuJyB8fCBsYXN0ID09PSAnLi4nKSB8fCBsYXN0ID09PSAnJyk7XG5cbiAgLy8gc3RyaXAgc2luZ2xlIGRvdHMsIHJlc29sdmUgZG91YmxlIGRvdHMgdG8gcGFyZW50IGRpclxuICAvLyBpZiB0aGUgcGF0aCB0cmllcyB0byBnbyBhYm92ZSB0aGUgcm9vdCwgYHVwYCBlbmRzIHVwID4gMFxuICB2YXIgdXAgPSAwO1xuICBmb3IgKHZhciBpID0gc3JjUGF0aC5sZW5ndGg7IGkgPj0gMDsgaS0tKSB7XG4gICAgbGFzdCA9IHNyY1BhdGhbaV07XG4gICAgaWYgKGxhc3QgPT09ICcuJykge1xuICAgICAgc3JjUGF0aC5zcGxpY2UoaSwgMSk7XG4gICAgfSBlbHNlIGlmIChsYXN0ID09PSAnLi4nKSB7XG4gICAgICBzcmNQYXRoLnNwbGljZShpLCAxKTtcbiAgICAgIHVwKys7XG4gICAgfSBlbHNlIGlmICh1cCkge1xuICAgICAgc3JjUGF0aC5zcGxpY2UoaSwgMSk7XG4gICAgICB1cC0tO1xuICAgIH1cbiAgfVxuXG4gIC8vIGlmIHRoZSBwYXRoIGlzIGFsbG93ZWQgdG8gZ28gYWJvdmUgdGhlIHJvb3QsIHJlc3RvcmUgbGVhZGluZyAuLnNcbiAgaWYgKCFtdXN0RW5kQWJzICYmICFyZW1vdmVBbGxEb3RzKSB7XG4gICAgZm9yICg7IHVwLS07IHVwKSB7XG4gICAgICBzcmNQYXRoLnVuc2hpZnQoJy4uJyk7XG4gICAgfVxuICB9XG5cbiAgaWYgKG11c3RFbmRBYnMgJiYgc3JjUGF0aFswXSAhPT0gJycgJiZcbiAgICAgICghc3JjUGF0aFswXSB8fCBzcmNQYXRoWzBdLmNoYXJBdCgwKSAhPT0gJy8nKSkge1xuICAgIHNyY1BhdGgudW5zaGlmdCgnJyk7XG4gIH1cblxuICBpZiAoaGFzVHJhaWxpbmdTbGFzaCAmJiAoc3JjUGF0aC5qb2luKCcvJykuc3Vic3RyKC0xKSAhPT0gJy8nKSkge1xuICAgIHNyY1BhdGgucHVzaCgnJyk7XG4gIH1cblxuICB2YXIgaXNBYnNvbHV0ZSA9IHNyY1BhdGhbMF0gPT09ICcnIHx8XG4gICAgICAoc3JjUGF0aFswXSAmJiBzcmNQYXRoWzBdLmNoYXJBdCgwKSA9PT0gJy8nKTtcblxuICAvLyBwdXQgdGhlIGhvc3QgYmFja1xuICBpZiAocHN5Y2hvdGljKSB7XG4gICAgcmVzdWx0Lmhvc3RuYW1lID0gcmVzdWx0Lmhvc3QgPSBpc0Fic29sdXRlID8gJycgOlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgc3JjUGF0aC5sZW5ndGggPyBzcmNQYXRoLnNoaWZ0KCkgOiAnJztcbiAgICAvL29jY2F0aW9uYWx5IHRoZSBhdXRoIGNhbiBnZXQgc3R1Y2sgb25seSBpbiBob3N0XG4gICAgLy90aGlzIGVzcGVjaWFsbHkgaGFwcGVucyBpbiBjYXNlcyBsaWtlXG4gICAgLy91cmwucmVzb2x2ZU9iamVjdCgnbWFpbHRvOmxvY2FsMUBkb21haW4xJywgJ2xvY2FsMkBkb21haW4yJylcbiAgICB2YXIgYXV0aEluSG9zdCA9IHJlc3VsdC5ob3N0ICYmIHJlc3VsdC5ob3N0LmluZGV4T2YoJ0AnKSA+IDAgP1xuICAgICAgICAgICAgICAgICAgICAgcmVzdWx0Lmhvc3Quc3BsaXQoJ0AnKSA6IGZhbHNlO1xuICAgIGlmIChhdXRoSW5Ib3N0KSB7XG4gICAgICByZXN1bHQuYXV0aCA9IGF1dGhJbkhvc3Quc2hpZnQoKTtcbiAgICAgIHJlc3VsdC5ob3N0ID0gcmVzdWx0Lmhvc3RuYW1lID0gYXV0aEluSG9zdC5zaGlmdCgpO1xuICAgIH1cbiAgfVxuXG4gIG11c3RFbmRBYnMgPSBtdXN0RW5kQWJzIHx8IChyZXN1bHQuaG9zdCAmJiBzcmNQYXRoLmxlbmd0aCk7XG5cbiAgaWYgKG11c3RFbmRBYnMgJiYgIWlzQWJzb2x1dGUpIHtcbiAgICBzcmNQYXRoLnVuc2hpZnQoJycpO1xuICB9XG5cbiAgaWYgKCFzcmNQYXRoLmxlbmd0aCkge1xuICAgIHJlc3VsdC5wYXRobmFtZSA9IG51bGw7XG4gICAgcmVzdWx0LnBhdGggPSBudWxsO1xuICB9IGVsc2Uge1xuICAgIHJlc3VsdC5wYXRobmFtZSA9IHNyY1BhdGguam9pbignLycpO1xuICB9XG5cbiAgLy90byBzdXBwb3J0IHJlcXVlc3QuaHR0cFxuICBpZiAoIXV0aWwuaXNOdWxsKHJlc3VsdC5wYXRobmFtZSkgfHwgIXV0aWwuaXNOdWxsKHJlc3VsdC5zZWFyY2gpKSB7XG4gICAgcmVzdWx0LnBhdGggPSAocmVzdWx0LnBhdGhuYW1lID8gcmVzdWx0LnBhdGhuYW1lIDogJycpICtcbiAgICAgICAgICAgICAgICAgIChyZXN1bHQuc2VhcmNoID8gcmVzdWx0LnNlYXJjaCA6ICcnKTtcbiAgfVxuICByZXN1bHQuYXV0aCA9IHJlbGF0aXZlLmF1dGggfHwgcmVzdWx0LmF1dGg7XG4gIHJlc3VsdC5zbGFzaGVzID0gcmVzdWx0LnNsYXNoZXMgfHwgcmVsYXRpdmUuc2xhc2hlcztcbiAgcmVzdWx0LmhyZWYgPSByZXN1bHQuZm9ybWF0KCk7XG4gIHJldHVybiByZXN1bHQ7XG59O1xuXG5VcmwucHJvdG90eXBlLnBhcnNlSG9zdCA9IGZ1bmN0aW9uKCkge1xuICB2YXIgaG9zdCA9IHRoaXMuaG9zdDtcbiAgdmFyIHBvcnQgPSBwb3J0UGF0dGVybi5leGVjKGhvc3QpO1xuICBpZiAocG9ydCkge1xuICAgIHBvcnQgPSBwb3J0WzBdO1xuICAgIGlmIChwb3J0ICE9PSAnOicpIHtcbiAgICAgIHRoaXMucG9ydCA9IHBvcnQuc3Vic3RyKDEpO1xuICAgIH1cbiAgICBob3N0ID0gaG9zdC5zdWJzdHIoMCwgaG9zdC5sZW5ndGggLSBwb3J0Lmxlbmd0aCk7XG4gIH1cbiAgaWYgKGhvc3QpIHRoaXMuaG9zdG5hbWUgPSBob3N0O1xufTtcbiIsIid1c2Ugc3RyaWN0JztcblxubW9kdWxlLmV4cG9ydHMgPSB7XG4gIGlzU3RyaW5nOiBmdW5jdGlvbihhcmcpIHtcbiAgICByZXR1cm4gdHlwZW9mKGFyZykgPT09ICdzdHJpbmcnO1xuICB9LFxuICBpc09iamVjdDogZnVuY3Rpb24oYXJnKSB7XG4gICAgcmV0dXJuIHR5cGVvZihhcmcpID09PSAnb2JqZWN0JyAmJiBhcmcgIT09IG51bGw7XG4gIH0sXG4gIGlzTnVsbDogZnVuY3Rpb24oYXJnKSB7XG4gICAgcmV0dXJuIGFyZyA9PT0gbnVsbDtcbiAgfSxcbiAgaXNOdWxsT3JVbmRlZmluZWQ6IGZ1bmN0aW9uKGFyZykge1xuICAgIHJldHVybiBhcmcgPT0gbnVsbDtcbiAgfVxufTtcbiIsIm1vZHVsZS5leHBvcnRzID0gZXh0ZW5kXG5cbnZhciBoYXNPd25Qcm9wZXJ0eSA9IE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHk7XG5cbmZ1bmN0aW9uIGV4dGVuZCgpIHtcbiAgICB2YXIgdGFyZ2V0ID0ge31cblxuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgYXJndW1lbnRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIHZhciBzb3VyY2UgPSBhcmd1bWVudHNbaV1cblxuICAgICAgICBmb3IgKHZhciBrZXkgaW4gc291cmNlKSB7XG4gICAgICAgICAgICBpZiAoaGFzT3duUHJvcGVydHkuY2FsbChzb3VyY2UsIGtleSkpIHtcbiAgICAgICAgICAgICAgICB0YXJnZXRba2V5XSA9IHNvdXJjZVtrZXldXG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gdGFyZ2V0XG59XG4iLCJtb2R1bGUuZXhwb3J0cyA9IE9iamVjdC5mcmVlemUoe1wiYmlsbFwiOntcInZvbHVtZVwiOlwiY29kZVZvbHVtZVwiLFwicGFnZXNcIjpcImNvZGVQYWdlc1wiLFwibnVtYmVyXCI6XCJiaWxsTnVtYmVyXCJ9LFwiY2FzZVwiOntcInZvbHVtZVwiOlwicmVwb3J0ZXJWb2x1bWVcIixcInBhZ2VzXCI6XCJmaXJzdFBhZ2VcIixcImRhdGVcIjpcImRhdGVEZWNpZGVkXCIsXCJudW1iZXJcIjpcImRvY2tldE51bWJlclwiLFwidGl0bGVcIjpcImNhc2VOYW1lXCJ9LFwidGhlc2lzXCI6e1wicHVibGlzaGVyXCI6XCJ1bml2ZXJzaXR5XCIsXCJ0eXBlXCI6XCJ0aGVzaXNUeXBlXCJ9LFwiZmlsbVwiOntcInB1Ymxpc2hlclwiOlwiZGlzdHJpYnV0b3JcIixcInR5cGVcIjpcImdlbnJlXCIsXCJtZWRpdW1cIjpcInZpZGVvUmVjb3JkaW5nRm9ybWF0XCJ9LFwicmVwb3J0XCI6e1wicHVibGlzaGVyXCI6XCJpbnN0aXR1dGlvblwiLFwibnVtYmVyXCI6XCJyZXBvcnROdW1iZXJcIixcInR5cGVcIjpcInJlcG9ydFR5cGVcIn0sXCJhdWRpb1JlY29yZGluZ1wiOntcInB1Ymxpc2hlclwiOlwibGFiZWxcIixcIm1lZGl1bVwiOlwiYXVkaW9SZWNvcmRpbmdGb3JtYXRcIn0sXCJ2aWRlb1JlY29yZGluZ1wiOntcInB1Ymxpc2hlclwiOlwic3R1ZGlvXCIsXCJtZWRpdW1cIjpcInZpZGVvUmVjb3JkaW5nRm9ybWF0XCJ9LFwidHZCcm9hZGNhc3RcIjp7XCJwdWJsaXNoZXJcIjpcIm5ldHdvcmtcIixcInB1YmxpY2F0aW9uVGl0bGVcIjpcInByb2dyYW1UaXRsZVwiLFwibnVtYmVyXCI6XCJlcGlzb2RlTnVtYmVyXCIsXCJtZWRpdW1cIjpcInZpZGVvUmVjb3JkaW5nRm9ybWF0XCJ9LFwicmFkaW9Ccm9hZGNhc3RcIjp7XCJwdWJsaXNoZXJcIjpcIm5ldHdvcmtcIixcInB1YmxpY2F0aW9uVGl0bGVcIjpcInByb2dyYW1UaXRsZVwiLFwibnVtYmVyXCI6XCJlcGlzb2RlTnVtYmVyXCIsXCJtZWRpdW1cIjpcImF1ZGlvUmVjb3JkaW5nRm9ybWF0XCJ9LFwiY29tcHV0ZXJQcm9ncmFtXCI6e1wicHVibGlzaGVyXCI6XCJjb21wYW55XCJ9LFwiYm9va1NlY3Rpb25cIjp7XCJwdWJsaWNhdGlvblRpdGxlXCI6XCJib29rVGl0bGVcIn0sXCJjb25mZXJlbmNlUGFwZXJcIjp7XCJwdWJsaWNhdGlvblRpdGxlXCI6XCJwcm9jZWVkaW5nc1RpdGxlXCJ9LFwid2VicGFnZVwiOntcInB1YmxpY2F0aW9uVGl0bGVcIjpcIndlYnNpdGVUaXRsZVwiLFwidHlwZVwiOlwid2Vic2l0ZVR5cGVcIn0sXCJibG9nUG9zdFwiOntcInB1YmxpY2F0aW9uVGl0bGVcIjpcImJsb2dUaXRsZVwiLFwidHlwZVwiOlwid2Vic2l0ZVR5cGVcIn0sXCJmb3J1bVBvc3RcIjp7XCJwdWJsaWNhdGlvblRpdGxlXCI6XCJmb3J1bVRpdGxlXCIsXCJ0eXBlXCI6XCJwb3N0VHlwZVwifSxcImVuY3ljbG9wZWRpYUFydGljbGVcIjp7XCJwdWJsaWNhdGlvblRpdGxlXCI6XCJlbmN5Y2xvcGVkaWFUaXRsZVwifSxcImRpY3Rpb25hcnlFbnRyeVwiOntcInB1YmxpY2F0aW9uVGl0bGVcIjpcImRpY3Rpb25hcnlUaXRsZVwifSxcInBhdGVudFwiOntcImRhdGVcIjpcImlzc3VlRGF0ZVwiLFwibnVtYmVyXCI6XCJwYXRlbnROdW1iZXJcIn0sXCJzdGF0dXRlXCI6e1wiZGF0ZVwiOlwiZGF0ZUVuYWN0ZWRcIixcIm51bWJlclwiOlwicHVibGljTGF3TnVtYmVyXCIsXCJ0aXRsZVwiOlwibmFtZU9mQWN0XCJ9LFwiaGVhcmluZ1wiOntcIm51bWJlclwiOlwiZG9jdW1lbnROdW1iZXJcIn0sXCJwb2RjYXN0XCI6e1wibnVtYmVyXCI6XCJlcGlzb2RlTnVtYmVyXCIsXCJtZWRpdW1cIjpcImF1ZGlvRmlsZVR5cGVcIn0sXCJsZXR0ZXJcIjp7XCJ0eXBlXCI6XCJsZXR0ZXJUeXBlXCJ9LFwibWFudXNjcmlwdFwiOntcInR5cGVcIjpcIm1hbnVzY3JpcHRUeXBlXCJ9LFwibWFwXCI6e1widHlwZVwiOlwibWFwVHlwZVwifSxcInByZXNlbnRhdGlvblwiOntcInR5cGVcIjpcInByZXNlbnRhdGlvblR5cGVcIn0sXCJpbnRlcnZpZXdcIjp7XCJtZWRpdW1cIjpcImludGVydmlld01lZGl1bVwifSxcImFydHdvcmtcIjp7XCJtZWRpdW1cIjpcImFydHdvcmtNZWRpdW1cIn0sXCJlbWFpbFwiOntcInRpdGxlXCI6XCJzdWJqZWN0XCJ9fSk7IiwiJ3VzZSBzdHJpY3QnO1xuXG5jb25zdCBkYXRlVG9TcWwgPSByZXF1aXJlKCcuLi96b3Rlcm8tc2hpbS9kYXRlLXRvLXNxbCcpO1xuY29uc3QgZGVmYXVsdHMgPSByZXF1aXJlKCcuL2RlZmF1bHRzJyk7XG5jb25zdCBpdGVtVG9DU0xKU09OID0gcmVxdWlyZSgnLi4vem90ZXJvLXNoaW0vaXRlbS10by1jc2wtanNvbicpO1xuY29uc3QgcGFyc2VMaW5rSGVhZGVyID0gcmVxdWlyZSgncGFyc2UtbGluay1oZWFkZXInKTtcbmNvbnN0IHsgdXVpZDQsIGlzTGlrZVpvdGVyb0l0ZW0gfSA9IHJlcXVpcmUoJy4vdXRpbHMnKTtcbmNvbnN0IFsgQ09NUExFVEUsIE1VTFRJUExFX0lURU1TLCBGQUlMRUQgXSA9IFsgJ0NPTVBMRVRFJywgJ01VTFRJUExFX0lURU1TJywgJ0ZBSUxFRCcgXTtcblxuY2xhc3MgWm90ZXJvQmliIHtcblx0Y29uc3RydWN0b3Iob3B0cykge1xuXHRcdHRoaXMub3B0cyA9IHtcblx0XHRcdHNlc3Npb25pZDogdXVpZDQoKSxcblx0XHRcdC4uLmRlZmF1bHRzKCksXG5cdFx0XHQuLi5vcHRzXG5cdFx0fTtcblxuXHRcdGlmKHRoaXMub3B0cy5wZXJzaXN0ICYmIHRoaXMub3B0cy5zdG9yYWdlKSB7XG5cdFx0XHRpZighKCdnZXRJdGVtJyBpbiB0aGlzLm9wdHMuc3RvcmFnZSB8fFxuXHRcdFx0XHQnc2V0SXRlbScgaW4gdGhpcy5vcHRzLnN0b3JhZ2UgfHxcblx0XHRcdFx0J2NsZWFyJyBpbiB0aGlzLm9wdHMuc3RvcmFnZVxuXHRcdFx0KSkge1xuXHRcdFx0XHR0aHJvdyBuZXcgRXJyb3IoJ0ludmFsaWQgc3RvcmFnZSBlbmdpbmUgcHJvdmlkZWQnKTtcblx0XHRcdH1cblx0XHRcdGlmKHRoaXMub3B0cy5vdmVycmlkZSkge1xuXHRcdFx0XHR0aGlzLmNsZWFySXRlbXMoKTtcblx0XHRcdH1cblx0XHRcdHRoaXMuaXRlbXMgPSBbLi4udGhpcy5vcHRzLmluaXRpYWxJdGVtcywgLi4udGhpcy5nZXRJdGVtc1N0b3JhZ2UoKV1cblx0XHRcdFx0LmZpbHRlcihpc0xpa2Vab3Rlcm9JdGVtKTtcblx0XHRcdHRoaXMuc2V0SXRlbXNTdG9yYWdlKHRoaXMuaXRlbXMpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHR0aGlzLml0ZW1zID0gWy4uLnRoaXMub3B0cy5pbml0aWFsSXRlbXNdLmZpbHRlcihpc0xpa2Vab3Rlcm9JdGVtKTtcblx0XHR9XG5cdH1cblxuXHRnZXRJdGVtc1N0b3JhZ2UoKSB7XG5cdFx0bGV0IGl0ZW1zID0gdGhpcy5vcHRzLnN0b3JhZ2UuZ2V0SXRlbShgJHt0aGlzLm9wdHMuc3RvcmFnZVByZWZpeH0taXRlbXNgKTtcblx0XHRyZXR1cm4gaXRlbXMgPyBKU09OLnBhcnNlKGl0ZW1zKSA6IFtdO1xuXHR9XG5cblx0c2V0SXRlbXNTdG9yYWdlKGl0ZW1zKSB7XG5cdFx0dGhpcy5vcHRzLnN0b3JhZ2Uuc2V0SXRlbShcblx0XHRcdGAke3RoaXMub3B0cy5zdG9yYWdlUHJlZml4fS1pdGVtc2AsXG5cdFx0XHRKU09OLnN0cmluZ2lmeShpdGVtcylcblx0XHQpO1xuXHR9XG5cblx0cmVsb2FkSXRlbXMoKSB7XG5cdFx0dGhpcy5pdGVtcyA9IHRoaXMuZ2V0SXRlbXNTdG9yYWdlKCk7XG5cdH1cblxuXHRhZGRJdGVtKGl0ZW0pIHtcblx0XHRpZighaXNMaWtlWm90ZXJvSXRlbShpdGVtKSkge1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKCdGYWlsZWQgdG8gYWRkIGl0ZW0nKTtcblx0XHR9XG5cdFx0dGhpcy5pdGVtcy5wdXNoKGl0ZW0pO1xuXHRcdGlmKHRoaXMub3B0cy5wZXJzaXN0KSB7XG5cdFx0XHR0aGlzLnNldEl0ZW1zU3RvcmFnZSh0aGlzLml0ZW1zKTtcblx0XHR9XG5cdH1cblxuXHR1cGRhdGVJdGVtKGluZGV4LCBpdGVtKSB7XG5cdFx0dGhpcy5pdGVtc1tpbmRleF0gPSBpdGVtO1xuXHRcdGlmKHRoaXMub3B0cy5wZXJzaXN0KSB7XG5cdFx0XHR0aGlzLnNldEl0ZW1zU3RvcmFnZSh0aGlzLml0ZW1zKTtcblx0XHR9XG5cdH1cblxuXHRyZW1vdmVJdGVtKGl0ZW0pIHtcblx0XHRsZXQgaW5kZXggPSB0aGlzLml0ZW1zLmluZGV4T2YoaXRlbSk7XG5cdFx0aWYoaW5kZXggIT09IC0xKSB7XG5cdFx0XHR0aGlzLml0ZW1zLnNwbGljZShpbmRleCwgMSk7XG5cdFx0XHRpZih0aGlzLm9wdHMucGVyc2lzdCkge1xuXHRcdFx0XHR0aGlzLnNldEl0ZW1zU3RvcmFnZSh0aGlzLml0ZW1zKTtcblx0XHRcdH1cblx0XHRcdHJldHVybiBpdGVtO1xuXHRcdH1cblx0XHRyZXR1cm4gZmFsc2U7XG5cdH1cblxuXHRjbGVhckl0ZW1zKCkge1xuXHRcdHRoaXMuaXRlbXMgPSBbXTtcblx0XHRpZih0aGlzLm9wdHMucGVyc2lzdCkge1xuXHRcdFx0dGhpcy5zZXRJdGVtc1N0b3JhZ2UodGhpcy5pdGVtcyk7XG5cdFx0fVxuXHR9XG5cblx0Z2V0IGl0ZW1zQ1NMKCkge1xuXHRcdHJldHVybiB0aGlzLml0ZW1zLm1hcChpID0+IGl0ZW1Ub0NTTEpTT04oaSkpXG5cdH1cblxuXHRnZXQgaXRlbXNSYXcoKSB7XG5cdFx0cmV0dXJuIHRoaXMuaXRlbXM7XG5cdH1cblxuXHRhc3luYyBleHBvcnRJdGVtcyhmb3JtYXQpIHtcblx0XHRsZXQgdHJhbnNsYXRpb25TZXJ2ZXJVUkwgPSBgJHt0aGlzLm9wdHMudHJhbnNsYXRpb25TZXJ2ZXJVUkx9LyR7dGhpcy5vcHRzLnRyYW5zbGF0aW9uU2VydmVyUHJlZml4fWV4cG9ydD9mb3JtYXQ9JHtmb3JtYXR9YDtcblx0XHRsZXQgZmV0Y2hPcHRpb25zID0ge1xuXHRcdFx0bWV0aG9kOiAnUE9TVCcsXG5cdFx0XHRoZWFkZXJzOiB7XG5cdFx0XHRcdCdDb250ZW50LVR5cGUnOiAnYXBwbGljYXRpb24vanNvbidcblx0XHRcdH0sXG5cdFx0XHRib2R5OiBKU09OLnN0cmluZ2lmeSh0aGlzLml0ZW1zLmZpbHRlcihpID0+ICdrZXknIGluIGkgKSksXG5cdFx0XHQuLi50aGlzLm9wdHMuaW5pdFxuXHRcdH1cblx0XHRjb25zdCByZXNwb25zZSA9IGF3YWl0IGZldGNoKHRyYW5zbGF0aW9uU2VydmVyVVJMLCBmZXRjaE9wdGlvbnMpO1xuXHRcdGlmKHJlc3BvbnNlLm9rKSB7XG5cdFx0XHRyZXR1cm4gYXdhaXQgcmVzcG9uc2UudGV4dCgpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoJ0ZhaWxlZCB0byBleHBvcnQgaXRlbXMnKTtcblx0XHR9XG5cdH1cblxuXHRhc3luYyB0cmFuc2xhdGVJZGVudGlmaWVyKGlkZW50aWZpZXIsIC4uLmFyZ3MpIHtcblx0XHRsZXQgdHJhbnNsYXRpb25TZXJ2ZXJVUkwgPSBgJHt0aGlzLm9wdHMudHJhbnNsYXRpb25TZXJ2ZXJVUkx9LyR7dGhpcy5vcHRzLnRyYW5zbGF0aW9uU2VydmVyUHJlZml4fXNlYXJjaGA7XG5cdFx0bGV0IGluaXQgPSB7XG5cdFx0XHRtZXRob2Q6ICdQT1NUJyxcblx0XHRcdGhlYWRlcnM6IHtcblx0XHRcdFx0J0NvbnRlbnQtVHlwZSc6ICd0ZXh0L3BsYWluJ1xuXHRcdFx0fSxcblx0XHRcdGJvZHk6IGlkZW50aWZpZXIsXG5cdFx0XHQuLi50aGlzLm9wdHMuaW5pdFxuXHRcdH07XG5cblx0XHRyZXR1cm4gYXdhaXQgdGhpcy50cmFuc2xhdGUodHJhbnNsYXRpb25TZXJ2ZXJVUkwsIGluaXQsIC4uLmFyZ3MpO1xuXHR9XG5cblx0YXN5bmMgdHJhbnNsYXRlVXJsSXRlbXModXJsLCBpdGVtcywgLi4uYXJncykge1xuXHRcdGxldCB0cmFuc2xhdGlvblNlcnZlclVSTCA9IGAke3RoaXMub3B0cy50cmFuc2xhdGlvblNlcnZlclVSTH0vJHt0aGlzLm9wdHMudHJhbnNsYXRpb25TZXJ2ZXJQcmVmaXh9d2ViYDtcblx0XHRsZXQgc2Vzc2lvbmlkID0gdGhpcy5vcHRzLnNlc3Npb25pZDtcblx0XHRsZXQgZGF0YSA9IHsgdXJsLCBpdGVtcywgc2Vzc2lvbmlkLCAuLi50aGlzLm9wdHMucmVxdWVzdCB9O1xuXG5cdFx0bGV0IGluaXQgPSB7XG5cdFx0XHRtZXRob2Q6ICdQT1NUJyxcblx0XHRcdGhlYWRlcnM6IHtcblx0XHRcdFx0J0NvbnRlbnQtVHlwZSc6ICdhcHBsaWNhdGlvbi9qc29uJ1xuXHRcdFx0fSxcblx0XHRcdGJvZHk6IEpTT04uc3RyaW5naWZ5KGRhdGEpLFxuXHRcdFx0Li4udGhpcy5vcHRzLmluaXRcblx0XHR9O1xuXG5cdFx0cmV0dXJuIGF3YWl0IHRoaXMudHJhbnNsYXRlKHRyYW5zbGF0aW9uU2VydmVyVVJMLCBpbml0LCAuLi5hcmdzKTtcblx0fVxuXG5cdGFzeW5jIHRyYW5zbGF0ZVVybCh1cmwsIC4uLmFyZ3MpIHtcblx0XHRsZXQgdHJhbnNsYXRpb25TZXJ2ZXJVUkwgPSBgJHt0aGlzLm9wdHMudHJhbnNsYXRpb25TZXJ2ZXJVUkx9LyR7dGhpcy5vcHRzLnRyYW5zbGF0aW9uU2VydmVyUHJlZml4fXdlYmA7XG5cdFx0bGV0IHNlc3Npb25pZCA9IHRoaXMub3B0cy5zZXNzaW9uaWQ7XG5cdFx0bGV0IGRhdGEgPSB7IHVybCwgc2Vzc2lvbmlkLCAuLi50aGlzLm9wdHMucmVxdWVzdCB9O1xuXG5cdFx0bGV0IGluaXQgPSB7XG5cdFx0XHRtZXRob2Q6ICdQT1NUJyxcblx0XHRcdGhlYWRlcnM6IHtcblx0XHRcdFx0J0NvbnRlbnQtVHlwZSc6ICdhcHBsaWNhdGlvbi9qc29uJ1xuXHRcdFx0fSxcblx0XHRcdGJvZHk6IEpTT04uc3RyaW5naWZ5KGRhdGEpLFxuXHRcdFx0Li4udGhpcy5vcHRzLmluaXRcblx0XHR9O1xuXG5cdFx0cmV0dXJuIGF3YWl0IHRoaXMudHJhbnNsYXRlKHRyYW5zbGF0aW9uU2VydmVyVVJMLCBpbml0LCAuLi5hcmdzKTtcblx0fVxuXG5cdGFzeW5jIHRyYW5zbGF0ZSh1cmwsIGZldGNoT3B0aW9ucywgYWRkPXRydWUpIHtcblx0XHRjb25zdCByZXNwb25zZSA9IGF3YWl0IGZldGNoKHVybCwgZmV0Y2hPcHRpb25zKTtcblx0XHR2YXIgaXRlbXMsIHJlc3VsdCwgbGlua3MgPSB7fTtcblxuXHRcdGlmKHJlc3BvbnNlLmhlYWRlcnMuaGFzKCdMaW5rJykpIHtcblx0XHRcdGxpbmtzID0gcGFyc2VMaW5rSGVhZGVyKHJlc3BvbnNlLmhlYWRlcnMuZ2V0KCdMaW5rJykpO1xuXHRcdH1cblx0XHRpZihyZXNwb25zZS5vaykge1xuXHRcdFx0aXRlbXMgPSBhd2FpdCByZXNwb25zZS5qc29uKCk7XG5cdFx0XHRpZihBcnJheS5pc0FycmF5KGl0ZW1zKSkge1xuXHRcdFx0XHRpdGVtcy5mb3JFYWNoKGl0ZW0gPT4ge1xuXHRcdFx0XHRcdGlmKGl0ZW0uYWNjZXNzRGF0ZSA9PT0gJ0NVUlJFTlRfVElNRVNUQU1QJykge1xuXHRcdFx0XHRcdFx0Y29uc3QgZHQgPSBuZXcgRGF0ZShEYXRlLm5vdygpKTtcblx0XHRcdFx0XHRcdGl0ZW0uYWNjZXNzRGF0ZSA9IGRhdGVUb1NxbChkdCwgdHJ1ZSk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGlmKGFkZCkge1xuXHRcdFx0XHRcdFx0dGhpcy5hZGRJdGVtKGl0ZW0pO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSk7XG5cdFx0XHR9XG5cdFx0XHRyZXN1bHQgPSBBcnJheS5pc0FycmF5KGl0ZW1zKSA/IENPTVBMRVRFIDogRkFJTEVEO1xuXHRcdH0gZWxzZSBpZihyZXNwb25zZS5zdGF0dXMgPT09IDMwMCkge1xuXHRcdFx0aXRlbXMgPSBhd2FpdCByZXNwb25zZS5qc29uKCk7XG5cdFx0XHRyZXN1bHQgPSBNVUxUSVBMRV9JVEVNUztcblx0XHR9IGVsc2Uge1xuXHRcdFx0cmVzdWx0ID0gRkFJTEVEXG5cdFx0fVxuXG5cdFx0cmV0dXJuIHsgcmVzdWx0LCBpdGVtcywgcmVzcG9uc2UsIGxpbmtzIH07XG5cdH1cblxuXHRzdGF0aWMgZ2V0IENPTVBMRVRFKCkgeyByZXR1cm4gQ09NUExFVEUgfVxuXHRzdGF0aWMgZ2V0IE1VTFRJUExFX0lURU1TKCkgeyByZXR1cm4gTVVMVElQTEVfSVRFTVMgfVxuXHRzdGF0aWMgZ2V0IEZBSUxFRCgpIHsgcmV0dXJuIEZBSUxFRCB9XG59XG5cbm1vZHVsZS5leHBvcnRzID0gWm90ZXJvQmliO1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG5tb2R1bGUuZXhwb3J0cyA9ICgpID0+ICh7XG5cdHRyYW5zbGF0aW9uU2VydmVyVVJMOiB0eXBlb2Ygd2luZG93ICE9ICd1bmRlZmluZWQnICYmIHdpbmRvdy5sb2NhdGlvbi5vcmlnaW4gfHwgJycsXG5cdHRyYW5zbGF0aW9uU2VydmVyUHJlZml4OiAnJyxcblx0ZmV0Y2hDb25maWc6IHt9LFxuXHRpbml0aWFsSXRlbXM6IFtdLFxuXHRyZXF1ZXN0OiB7fSxcblx0c3RvcmFnZTogdHlwZW9mIHdpbmRvdyAhPSAndW5kZWZpbmVkJyAmJiAnbG9jYWxTdG9yYWdlJyBpbiB3aW5kb3cgJiYgd2luZG93LmxvY2FsU3RvcmFnZSB8fCB7fSxcblx0cGVyc2lzdDogdHJ1ZSxcblx0b3ZlcnJpZGU6IGZhbHNlLFxuXHRzdG9yYWdlUHJlZml4OiAnem90ZXJvLWJpYidcbn0pO1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG5tb2R1bGUuZXhwb3J0cyA9IHtcblx0dXVpZDQ6ICgpID0+ICd4eHh4eHh4eC14eHh4LTR4eHgteXh4eC14eHh4eHh4eHh4eHgnLnJlcGxhY2UoL1t4eV0vZywgYyA9PiB7XG5cdFx0XHR2YXIgciA9IE1hdGgucmFuZG9tKCkgKiAxNnwwLFxuXHRcdFx0XHR2ID0gYyA9PSAneCcgPyByIDogKHImMHgzfDB4OCk7XG5cblx0XHRcdHJldHVybiB2LnRvU3RyaW5nKDE2KTtcblx0XHR9KSxcblx0aXNMaWtlWm90ZXJvSXRlbTogaXRlbSA9PiBpdGVtICYmIHR5cGVvZiBpdGVtID09PSAnb2JqZWN0JyAmJiAnaXRlbVR5cGUnIGluIGl0ZW1cbn1cbiIsIid1c2Ugc3RyaWN0JztcblxuY29uc3QgWm90ZXJvQmliID0gcmVxdWlyZSgnLi9iaWIvYmliJyk7XG5tb2R1bGUuZXhwb3J0cyA9IFpvdGVyb0JpYjtcbiIsIid1c2Ugc3RyaWN0JztcblxuY29uc3QgY3JlYXRvclR5cGVzID0ge1xuXHQxOiAnYXV0aG9yJyxcblx0MjogJ2NvbnRyaWJ1dG9yJyxcblx0MzogJ2VkaXRvcicsXG5cdDQ6ICd0cmFuc2xhdG9yJyxcblx0NTogJ3Nlcmllc0VkaXRvcicsXG5cdDY6ICdpbnRlcnZpZXdlZScsXG5cdDc6ICdpbnRlcnZpZXdlcicsXG5cdDg6ICdkaXJlY3RvcicsXG5cdDk6ICdzY3JpcHR3cml0ZXInLFxuXHQxMDogJ3Byb2R1Y2VyJyxcblx0MTE6ICdjYXN0TWVtYmVyJyxcblx0MTI6ICdzcG9uc29yJyxcblx0MTM6ICdjb3Vuc2VsJyxcblx0MTQ6ICdpbnZlbnRvcicsXG5cdDE1OiAnYXR0b3JuZXlBZ2VudCcsXG5cdDE2OiAncmVjaXBpZW50Jyxcblx0MTc6ICdwZXJmb3JtZXInLFxuXHQxODogJ2NvbXBvc2VyJyxcblx0MTk6ICd3b3Jkc0J5Jyxcblx0MjA6ICdjYXJ0b2dyYXBoZXInLFxuXHQyMTogJ3Byb2dyYW1tZXInLFxuXHQyMjogJ2FydGlzdCcsXG5cdDIzOiAnY29tbWVudGVyJyxcblx0MjQ6ICdwcmVzZW50ZXInLFxuXHQyNTogJ2d1ZXN0Jyxcblx0MjY6ICdwb2RjYXN0ZXInLFxuXHQyNzogJ3Jldmlld2VkQXV0aG9yJyxcblx0Mjg6ICdjb3Nwb25zb3InLFxuXHQyOTogJ2Jvb2tBdXRob3InXG59O1xuXG5cbi8vcmV2ZXJzZSBsb29rdXBcbk9iamVjdC5rZXlzKGNyZWF0b3JUeXBlcykubWFwKGsgPT4gY3JlYXRvclR5cGVzW2NyZWF0b3JUeXBlc1trXV0gPSBrKTtcbm1vZHVsZS5leHBvcnRzID0gY3JlYXRvclR5cGVzO1xuIiwibW9kdWxlLmV4cG9ydHMgPSB7XG5cdENTTF9OQU1FU19NQVBQSU5HUzoge1xuXHRcdCdhdXRob3InOidhdXRob3InLFxuXHRcdCdlZGl0b3InOidlZGl0b3InLFxuXHRcdCdib29rQXV0aG9yJzonY29udGFpbmVyLWF1dGhvcicsXG5cdFx0J2NvbXBvc2VyJzonY29tcG9zZXInLFxuXHRcdCdkaXJlY3Rvcic6J2RpcmVjdG9yJyxcblx0XHQnaW50ZXJ2aWV3ZXInOidpbnRlcnZpZXdlcicsXG5cdFx0J3JlY2lwaWVudCc6J3JlY2lwaWVudCcsXG5cdFx0J3Jldmlld2VkQXV0aG9yJzoncmV2aWV3ZWQtYXV0aG9yJyxcblx0XHQnc2VyaWVzRWRpdG9yJzonY29sbGVjdGlvbi1lZGl0b3InLFxuXHRcdCd0cmFuc2xhdG9yJzondHJhbnNsYXRvcidcblx0fSxcblxuXHQvKlxuXHQgKiBNYXBwaW5ncyBmb3IgdGV4dCB2YXJpYWJsZXNcblx0ICovXG5cdENTTF9URVhUX01BUFBJTkdTOiB7XG5cdFx0J3RpdGxlJzpbJ3RpdGxlJ10sXG5cdFx0J2NvbnRhaW5lci10aXRsZSc6WydwdWJsaWNhdGlvblRpdGxlJywgICdyZXBvcnRlcicsICdjb2RlJ10sIC8qIHJlcG9ydGVyIGFuZCBjb2RlIHNob3VsZCBtb3ZlIHRvIFNRTCBtYXBwaW5nIHRhYmxlcyAqL1xuXHRcdCdjb2xsZWN0aW9uLXRpdGxlJzpbJ3Nlcmllc1RpdGxlJywgJ3NlcmllcyddLFxuXHRcdCdjb2xsZWN0aW9uLW51bWJlcic6WydzZXJpZXNOdW1iZXInXSxcblx0XHQncHVibGlzaGVyJzpbJ3B1Ymxpc2hlcicsICdkaXN0cmlidXRvciddLCAvKiBkaXN0cmlidXRvciBzaG91bGQgbW92ZSB0byBTUUwgbWFwcGluZyB0YWJsZXMgKi9cblx0XHQncHVibGlzaGVyLXBsYWNlJzpbJ3BsYWNlJ10sXG5cdFx0J2F1dGhvcml0eSc6Wydjb3VydCcsJ2xlZ2lzbGF0aXZlQm9keScsICdpc3N1aW5nQXV0aG9yaXR5J10sXG5cdFx0J3BhZ2UnOlsncGFnZXMnXSxcblx0XHQndm9sdW1lJzpbJ3ZvbHVtZScsICdjb2RlTnVtYmVyJ10sXG5cdFx0J2lzc3VlJzpbJ2lzc3VlJywgJ3ByaW9yaXR5TnVtYmVycyddLFxuXHRcdCdudW1iZXItb2Ytdm9sdW1lcyc6WydudW1iZXJPZlZvbHVtZXMnXSxcblx0XHQnbnVtYmVyLW9mLXBhZ2VzJzpbJ251bVBhZ2VzJ10sXG5cdFx0J2VkaXRpb24nOlsnZWRpdGlvbiddLFxuXHRcdCd2ZXJzaW9uJzpbJ3ZlcnNpb25OdW1iZXInXSxcblx0XHQnc2VjdGlvbic6WydzZWN0aW9uJywgJ2NvbW1pdHRlZSddLFxuXHRcdCdnZW5yZSc6Wyd0eXBlJywgJ3Byb2dyYW1taW5nTGFuZ3VhZ2UnXSxcblx0XHQnc291cmNlJzpbJ2xpYnJhcnlDYXRhbG9nJ10sXG5cdFx0J2RpbWVuc2lvbnMnOiBbJ2FydHdvcmtTaXplJywgJ3J1bm5pbmdUaW1lJ10sXG5cdFx0J21lZGl1bSc6WydtZWRpdW0nLCAnc3lzdGVtJ10sXG5cdFx0J3NjYWxlJzpbJ3NjYWxlJ10sXG5cdFx0J2FyY2hpdmUnOlsnYXJjaGl2ZSddLFxuXHRcdCdhcmNoaXZlX2xvY2F0aW9uJzpbJ2FyY2hpdmVMb2NhdGlvbiddLFxuXHRcdCdldmVudCc6WydtZWV0aW5nTmFtZScsICdjb25mZXJlbmNlTmFtZSddLCAvKiB0aGVzZSBzaG91bGQgYmUgbWFwcGVkIHRvIHRoZSBzYW1lIGJhc2UgZmllbGQgaW4gU1FMIG1hcHBpbmcgdGFibGVzICovXG5cdFx0J2V2ZW50LXBsYWNlJzpbJ3BsYWNlJ10sXG5cdFx0J2Fic3RyYWN0JzpbJ2Fic3RyYWN0Tm90ZSddLFxuXHRcdCdVUkwnOlsndXJsJ10sXG5cdFx0J0RPSSc6WydET0knXSxcblx0XHQnSVNCTic6WydJU0JOJ10sXG5cdFx0J0lTU04nOlsnSVNTTiddLFxuXHRcdCdjYWxsLW51bWJlcic6WydjYWxsTnVtYmVyJywgJ2FwcGxpY2F0aW9uTnVtYmVyJ10sXG5cdFx0J25vdGUnOlsnZXh0cmEnXSxcblx0XHQnbnVtYmVyJzpbJ251bWJlciddLFxuXHRcdCdjaGFwdGVyLW51bWJlcic6WydzZXNzaW9uJ10sXG5cdFx0J3JlZmVyZW5jZXMnOlsnaGlzdG9yeScsICdyZWZlcmVuY2VzJ10sXG5cdFx0J3Nob3J0VGl0bGUnOlsnc2hvcnRUaXRsZSddLFxuXHRcdCdqb3VybmFsQWJicmV2aWF0aW9uJzpbJ2pvdXJuYWxBYmJyZXZpYXRpb24nXSxcblx0XHQnc3RhdHVzJzpbJ2xlZ2FsU3RhdHVzJ10sXG5cdFx0J2xhbmd1YWdlJzpbJ2xhbmd1YWdlJ11cblx0fSxcblx0Q1NMX0RBVEVfTUFQUElOR1M6IHtcblx0XHQnaXNzdWVkJzonZGF0ZScsXG5cdFx0J2FjY2Vzc2VkJzonYWNjZXNzRGF0ZScsXG5cdFx0J3N1Ym1pdHRlZCc6J2ZpbGluZ0RhdGUnXG5cdH0sXG5cdENTTF9UWVBFX01BUFBJTkdTOiB7XG5cdFx0J2Jvb2snOidib29rJyxcblx0XHQnYm9va1NlY3Rpb24nOidjaGFwdGVyJyxcblx0XHQnam91cm5hbEFydGljbGUnOidhcnRpY2xlLWpvdXJuYWwnLFxuXHRcdCdtYWdhemluZUFydGljbGUnOidhcnRpY2xlLW1hZ2F6aW5lJyxcblx0XHQnbmV3c3BhcGVyQXJ0aWNsZSc6J2FydGljbGUtbmV3c3BhcGVyJyxcblx0XHQndGhlc2lzJzondGhlc2lzJyxcblx0XHQnZW5jeWNsb3BlZGlhQXJ0aWNsZSc6J2VudHJ5LWVuY3ljbG9wZWRpYScsXG5cdFx0J2RpY3Rpb25hcnlFbnRyeSc6J2VudHJ5LWRpY3Rpb25hcnknLFxuXHRcdCdjb25mZXJlbmNlUGFwZXInOidwYXBlci1jb25mZXJlbmNlJyxcblx0XHQnbGV0dGVyJzoncGVyc29uYWxfY29tbXVuaWNhdGlvbicsXG5cdFx0J21hbnVzY3JpcHQnOidtYW51c2NyaXB0Jyxcblx0XHQnaW50ZXJ2aWV3JzonaW50ZXJ2aWV3Jyxcblx0XHQnZmlsbSc6J21vdGlvbl9waWN0dXJlJyxcblx0XHQnYXJ0d29yayc6J2dyYXBoaWMnLFxuXHRcdCd3ZWJwYWdlJzond2VicGFnZScsXG5cdFx0J3JlcG9ydCc6J3JlcG9ydCcsXG5cdFx0J2JpbGwnOidiaWxsJyxcblx0XHQnY2FzZSc6J2xlZ2FsX2Nhc2UnLFxuXHRcdCdoZWFyaW5nJzonYmlsbCcsXHRcdFx0XHQvLyA/P1xuXHRcdCdwYXRlbnQnOidwYXRlbnQnLFxuXHRcdCdzdGF0dXRlJzonbGVnaXNsYXRpb24nLFx0XHQvLyA/P1xuXHRcdCdlbWFpbCc6J3BlcnNvbmFsX2NvbW11bmljYXRpb24nLFxuXHRcdCdtYXAnOidtYXAnLFxuXHRcdCdibG9nUG9zdCc6J3Bvc3Qtd2VibG9nJyxcblx0XHQnaW5zdGFudE1lc3NhZ2UnOidwZXJzb25hbF9jb21tdW5pY2F0aW9uJyxcblx0XHQnZm9ydW1Qb3N0JzoncG9zdCcsXG5cdFx0J2F1ZGlvUmVjb3JkaW5nJzonc29uZycsXHRcdC8vID8/XG5cdFx0J3ByZXNlbnRhdGlvbic6J3NwZWVjaCcsXG5cdFx0J3ZpZGVvUmVjb3JkaW5nJzonbW90aW9uX3BpY3R1cmUnLFxuXHRcdCd0dkJyb2FkY2FzdCc6J2Jyb2FkY2FzdCcsXG5cdFx0J3JhZGlvQnJvYWRjYXN0JzonYnJvYWRjYXN0Jyxcblx0XHQncG9kY2FzdCc6J3NvbmcnLFx0XHRcdC8vID8/XG5cdFx0J2NvbXB1dGVyUHJvZ3JhbSc6J2Jvb2snLFx0XHQvLyA/P1xuXHRcdCdkb2N1bWVudCc6J2FydGljbGUnLFxuXHRcdCdub3RlJzonYXJ0aWNsZScsXG5cdFx0J2F0dGFjaG1lbnQnOidhcnRpY2xlJ1xuXHR9XG59O1xuIiwiY29uc3QgbHBhZCA9IHJlcXVpcmUoJy4vbHBhZCcpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IChkYXRlLCB0b1VUQykgPT4ge1xuXHR2YXIgeWVhciwgbW9udGgsIGRheSwgaG91cnMsIG1pbnV0ZXMsIHNlY29uZHM7XG5cdHRyeSB7XG5cdFx0aWYodG9VVEMpIHtcblx0XHRcdHllYXIgPSBkYXRlLmdldFVUQ0Z1bGxZZWFyKCk7XG5cdFx0XHRtb250aCA9IGRhdGUuZ2V0VVRDTW9udGgoKTtcblx0XHRcdGRheSA9IGRhdGUuZ2V0VVRDRGF0ZSgpO1xuXHRcdFx0aG91cnMgPSBkYXRlLmdldFVUQ0hvdXJzKCk7XG5cdFx0XHRtaW51dGVzID0gZGF0ZS5nZXRVVENNaW51dGVzKCk7XG5cdFx0XHRzZWNvbmRzID0gZGF0ZS5nZXRVVENTZWNvbmRzKCk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHllYXIgPSBkYXRlLmdldEZ1bGxZZWFyKCk7XG5cdFx0XHRtb250aCA9IGRhdGUuZ2V0TW9udGgoKTtcblx0XHRcdGRheSA9IGRhdGUuZ2V0RGF0ZSgpO1xuXHRcdFx0aG91cnMgPSBkYXRlLmdldEhvdXJzKCk7XG5cdFx0XHRtaW51dGVzID0gZGF0ZS5nZXRNaW51dGVzKCk7XG5cdFx0XHRzZWNvbmRzID0gZGF0ZS5nZXRTZWNvbmRzKCk7XG5cdFx0fVxuXG5cdFx0eWVhciA9IGxwYWQoeWVhciwgJzAnLCA0KTtcblx0XHRtb250aCA9IGxwYWQobW9udGggKyAxLCAnMCcsIDIpO1xuXHRcdGRheSA9IGxwYWQoZGF5LCAnMCcsIDIpO1xuXHRcdGhvdXJzID0gbHBhZChob3VycywgJzAnLCAyKTtcblx0XHRtaW51dGVzID0gbHBhZChtaW51dGVzLCAnMCcsIDIpO1xuXHRcdHNlY29uZHMgPSBscGFkKHNlY29uZHMsICcwJywgMik7XG5cblx0XHRyZXR1cm4geWVhciArICctJyArIG1vbnRoICsgJy0nICsgZGF5ICsgJyAnXG5cdFx0XHQrIGhvdXJzICsgJzonICsgbWludXRlcyArICc6JyArIHNlY29uZHM7XG5cdH1cblx0Y2F0Y2ggKGUpIHtcblx0XHRyZXR1cm4gJyc7XG5cdH1cbn1cbiIsImNvbnN0IGl0ZW1UeXBlcyA9IHJlcXVpcmUoJy4vaXRlbS10eXBlcycpO1xuY29uc3QgY3JlYXRvclR5cGVzID0gcmVxdWlyZSgnLi9jcmVhdG9yLXR5cGVzJyk7XG5cbm1vZHVsZS5leHBvcnRzID0ge1xuXHRbaXRlbVR5cGVzWzJdXTogY3JlYXRvclR5cGVzWzFdLFxuXHRbaXRlbVR5cGVzWzNdXTogY3JlYXRvclR5cGVzWzFdLFxuXHRbaXRlbVR5cGVzWzRdXTogY3JlYXRvclR5cGVzWzFdLFxuXHRbaXRlbVR5cGVzWzVdXTogY3JlYXRvclR5cGVzWzFdLFxuXHRbaXRlbVR5cGVzWzZdXTogY3JlYXRvclR5cGVzWzFdLFxuXHRbaXRlbVR5cGVzWzddXTogY3JlYXRvclR5cGVzWzFdLFxuXHRbaXRlbVR5cGVzWzhdXTogY3JlYXRvclR5cGVzWzFdLFxuXHRbaXRlbVR5cGVzWzldXTogY3JlYXRvclR5cGVzWzFdLFxuXHRbaXRlbVR5cGVzWzEwXV06IGNyZWF0b3JUeXBlc1s2XSxcblx0W2l0ZW1UeXBlc1sxMV1dOiBjcmVhdG9yVHlwZXNbOF0sXG5cdFtpdGVtVHlwZXNbMTJdXTogY3JlYXRvclR5cGVzWzIyXSxcblx0W2l0ZW1UeXBlc1sxM11dOiBjcmVhdG9yVHlwZXNbMV0sXG5cdFtpdGVtVHlwZXNbMTVdXTogY3JlYXRvclR5cGVzWzFdLFxuXHRbaXRlbVR5cGVzWzE2XV06IGNyZWF0b3JUeXBlc1sxMl0sXG5cdFtpdGVtVHlwZXNbMTddXTogY3JlYXRvclR5cGVzWzFdLFxuXHRbaXRlbVR5cGVzWzE4XV06IGNyZWF0b3JUeXBlc1syXSxcblx0W2l0ZW1UeXBlc1sxOV1dOiBjcmVhdG9yVHlwZXNbMTRdLFxuXHRbaXRlbVR5cGVzWzIwXV06IGNyZWF0b3JUeXBlc1sxXSxcblx0W2l0ZW1UeXBlc1syMV1dOiBjcmVhdG9yVHlwZXNbMV0sXG5cdFtpdGVtVHlwZXNbMjJdXTogY3JlYXRvclR5cGVzWzIwXSxcblx0W2l0ZW1UeXBlc1syM11dOiBjcmVhdG9yVHlwZXNbMV0sXG5cdFtpdGVtVHlwZXNbMjRdXTogY3JlYXRvclR5cGVzWzFdLFxuXHRbaXRlbVR5cGVzWzI1XV06IGNyZWF0b3JUeXBlc1sxXSxcblx0W2l0ZW1UeXBlc1syNl1dOiBjcmVhdG9yVHlwZXNbMTddLFxuXHRbaXRlbVR5cGVzWzI3XV06IGNyZWF0b3JUeXBlc1syNF0sXG5cdFtpdGVtVHlwZXNbMjhdXTogY3JlYXRvclR5cGVzWzhdLFxuXHRbaXRlbVR5cGVzWzI5XV06IGNyZWF0b3JUeXBlc1s4XSxcblx0W2l0ZW1UeXBlc1szMF1dOiBjcmVhdG9yVHlwZXNbOF0sXG5cdFtpdGVtVHlwZXNbMzFdXTogY3JlYXRvclR5cGVzWzI2XSxcblx0W2l0ZW1UeXBlc1szMl1dOiBjcmVhdG9yVHlwZXNbMjFdLFxuXHRbaXRlbVR5cGVzWzMzXV06IGNyZWF0b3JUeXBlc1sxXSxcblx0W2l0ZW1UeXBlc1szNF1dOiBjcmVhdG9yVHlwZXNbMV0sXG5cdFtpdGVtVHlwZXNbMzVdXTogY3JlYXRvclR5cGVzWzFdLFxuXHRbaXRlbVR5cGVzWzM2XV06IGNyZWF0b3JUeXBlc1sxXVxufTtcbiIsIid1c2Ugc3RyaWN0JztcblxuY29uc3QgZmllbGRzID0ge1xuXHQxOiAndXJsJyxcblx0MjogJ3JpZ2h0cycsXG5cdDM6ICdzZXJpZXMnLFxuXHQ0OiAndm9sdW1lJyxcblx0NTogJ2lzc3VlJyxcblx0NjogJ2VkaXRpb24nLFxuXHQ3OiAncGxhY2UnLFxuXHQ4OiAncHVibGlzaGVyJyxcblx0MTA6ICdwYWdlcycsXG5cdDExOiAnSVNCTicsXG5cdDEyOiAncHVibGljYXRpb25UaXRsZScsXG5cdDEzOiAnSVNTTicsXG5cdDE0OiAnZGF0ZScsXG5cdDE1OiAnc2VjdGlvbicsXG5cdDE4OiAnY2FsbE51bWJlcicsXG5cdDE5OiAnYXJjaGl2ZUxvY2F0aW9uJyxcblx0MjE6ICdkaXN0cmlidXRvcicsXG5cdDIyOiAnZXh0cmEnLFxuXHQyNTogJ2pvdXJuYWxBYmJyZXZpYXRpb24nLFxuXHQyNjogJ0RPSScsXG5cdDI3OiAnYWNjZXNzRGF0ZScsXG5cdDI4OiAnc2VyaWVzVGl0bGUnLFxuXHQyOTogJ3Nlcmllc1RleHQnLFxuXHQzMDogJ3Nlcmllc051bWJlcicsXG5cdDMxOiAnaW5zdGl0dXRpb24nLFxuXHQzMjogJ3JlcG9ydFR5cGUnLFxuXHQzNjogJ2NvZGUnLFxuXHQ0MDogJ3Nlc3Npb24nLFxuXHQ0MTogJ2xlZ2lzbGF0aXZlQm9keScsXG5cdDQyOiAnaGlzdG9yeScsXG5cdDQzOiAncmVwb3J0ZXInLFxuXHQ0NDogJ2NvdXJ0Jyxcblx0NDU6ICdudW1iZXJPZlZvbHVtZXMnLFxuXHQ0NjogJ2NvbW1pdHRlZScsXG5cdDQ4OiAnYXNzaWduZWUnLFxuXHQ1MDogJ3BhdGVudE51bWJlcicsXG5cdDUxOiAncHJpb3JpdHlOdW1iZXJzJyxcblx0NTI6ICdpc3N1ZURhdGUnLFxuXHQ1MzogJ3JlZmVyZW5jZXMnLFxuXHQ1NDogJ2xlZ2FsU3RhdHVzJyxcblx0NTU6ICdjb2RlTnVtYmVyJyxcblx0NTk6ICdhcnR3b3JrTWVkaXVtJyxcblx0NjA6ICdudW1iZXInLFxuXHQ2MTogJ2FydHdvcmtTaXplJyxcblx0NjI6ICdsaWJyYXJ5Q2F0YWxvZycsXG5cdDYzOiAndmlkZW9SZWNvcmRpbmdGb3JtYXQnLFxuXHQ2NDogJ2ludGVydmlld01lZGl1bScsXG5cdDY1OiAnbGV0dGVyVHlwZScsXG5cdDY2OiAnbWFudXNjcmlwdFR5cGUnLFxuXHQ2NzogJ21hcFR5cGUnLFxuXHQ2ODogJ3NjYWxlJyxcblx0Njk6ICd0aGVzaXNUeXBlJyxcblx0NzA6ICd3ZWJzaXRlVHlwZScsXG5cdDcxOiAnYXVkaW9SZWNvcmRpbmdGb3JtYXQnLFxuXHQ3MjogJ2xhYmVsJyxcblx0NzQ6ICdwcmVzZW50YXRpb25UeXBlJyxcblx0NzU6ICdtZWV0aW5nTmFtZScsXG5cdDc2OiAnc3R1ZGlvJyxcblx0Nzc6ICdydW5uaW5nVGltZScsXG5cdDc4OiAnbmV0d29yaycsXG5cdDc5OiAncG9zdFR5cGUnLFxuXHQ4MDogJ2F1ZGlvRmlsZVR5cGUnLFxuXHQ4MTogJ3ZlcnNpb25OdW1iZXInLFxuXHQ4MjogJ3N5c3RlbScsXG5cdDgzOiAnY29tcGFueScsXG5cdDg0OiAnY29uZmVyZW5jZU5hbWUnLFxuXHQ4NTogJ2VuY3ljbG9wZWRpYVRpdGxlJyxcblx0ODY6ICdkaWN0aW9uYXJ5VGl0bGUnLFxuXHQ4NzogJ2xhbmd1YWdlJyxcblx0ODg6ICdwcm9ncmFtbWluZ0xhbmd1YWdlJyxcblx0ODk6ICd1bml2ZXJzaXR5Jyxcblx0OTA6ICdhYnN0cmFjdE5vdGUnLFxuXHQ5MTogJ3dlYnNpdGVUaXRsZScsXG5cdDkyOiAncmVwb3J0TnVtYmVyJyxcblx0OTM6ICdiaWxsTnVtYmVyJyxcblx0OTQ6ICdjb2RlVm9sdW1lJyxcblx0OTU6ICdjb2RlUGFnZXMnLFxuXHQ5NjogJ2RhdGVEZWNpZGVkJyxcblx0OTc6ICdyZXBvcnRlclZvbHVtZScsXG5cdDk4OiAnZmlyc3RQYWdlJyxcblx0OTk6ICdkb2N1bWVudE51bWJlcicsXG5cdDEwMDogJ2RhdGVFbmFjdGVkJyxcblx0MTAxOiAncHVibGljTGF3TnVtYmVyJyxcblx0MTAyOiAnY291bnRyeScsXG5cdDEwMzogJ2FwcGxpY2F0aW9uTnVtYmVyJyxcblx0MTA0OiAnZm9ydW1UaXRsZScsXG5cdDEwNTogJ2VwaXNvZGVOdW1iZXInLFxuXHQxMDc6ICdibG9nVGl0bGUnLFxuXHQxMDg6ICd0eXBlJyxcblx0MTA5OiAnbWVkaXVtJyxcblx0MTEwOiAndGl0bGUnLFxuXHQxMTE6ICdjYXNlTmFtZScsXG5cdDExMjogJ25hbWVPZkFjdCcsXG5cdDExMzogJ3N1YmplY3QnLFxuXHQxMTQ6ICdwcm9jZWVkaW5nc1RpdGxlJyxcblx0MTE1OiAnYm9va1RpdGxlJyxcblx0MTE2OiAnc2hvcnRUaXRsZScsXG5cdDExNzogJ2RvY2tldE51bWJlcicsXG5cdDExODogJ251bVBhZ2VzJyxcblx0MTE5OiAncHJvZ3JhbVRpdGxlJyxcblx0MTIwOiAnaXNzdWluZ0F1dGhvcml0eScsXG5cdDEyMTogJ2ZpbGluZ0RhdGUnLFxuXHQxMjI6ICdnZW5yZScsXG5cdDEyMzogJ2FyY2hpdmUnXG59O1xuXG4vL3JldmVyc2UgbG9va3VwXG5PYmplY3Qua2V5cyhmaWVsZHMpLm1hcChrID0+IGZpZWxkc1tmaWVsZHNba11dID0gayk7XG5cbm1vZHVsZS5leHBvcnRzID0gZmllbGRzO1xuIiwiLyogZ2xvYmFsIENTTDpmYWxzZSAqL1xuJ3VzZSBzdHJpY3QnO1xuXG5jb25zdCBiYXNlTWFwcGluZ3MgPSByZXF1aXJlKCd6b3Rlcm8tYmFzZS1tYXBwaW5ncycpO1xuXG5jb25zdCB7XG5cdENTTF9OQU1FU19NQVBQSU5HUyxcblx0Q1NMX1RFWFRfTUFQUElOR1MsXG5cdENTTF9EQVRFX01BUFBJTkdTLFxuXHRDU0xfVFlQRV9NQVBQSU5HU1xufSA9IHJlcXVpcmUoJy4vY3NsLW1hcHBpbmdzJyk7XG5cbmNvbnN0IHsgZ2V0RmllbGRJREZyb21UeXBlQW5kQmFzZSB9ID0gcmVxdWlyZSgnLi90eXBlLXNwZWNpZmljLWZpZWxkLW1hcCcpO1xuY29uc3QgZmllbGRzID0gcmVxdWlyZSgnLi9maWVsZHMnKTtcbmNvbnN0IGl0ZW1UeXBlcyA9IHJlcXVpcmUoJy4vaXRlbS10eXBlcycpO1xuY29uc3Qgc3RyVG9EYXRlID0gcmVxdWlyZSgnLi9zdHItdG8tZGF0ZScpO1xuY29uc3QgZGVmYXVsdEl0ZW1UeXBlQ3JlYXRvclR5cGVMb29rdXAgPSByZXF1aXJlKCcuL2RlZmF1bHQtaXRlbS10eXBlLWNyZWF0b3ItdHlwZS1sb29rdXAnKTtcblxuY29uc3QgYmFzZU1hcHBpbmdzRmxhdCA9IE9iamVjdC5rZXlzKGJhc2VNYXBwaW5ncykucmVkdWNlKChhZ2dyLCBpdCkgPT4ge1xuXHRPYmplY3Qua2V5cyhiYXNlTWFwcGluZ3NbaXRdKS5mb3JFYWNoKG1hcEZyb20gPT4ge1xuXHRcdGxldCBrZXkgPSBgJHtpdH0ke21hcEZyb219YDtcblx0XHRsZXQgdmFsdWUgPSBiYXNlTWFwcGluZ3NbaXRdW21hcEZyb21dO1xuXHRcdGFnZ3Jba2V5XSA9IHZhbHVlO1xuXHR9KTtcblx0cmV0dXJuIGFnZ3I7XG59LCB7fSk7XG5cbm1vZHVsZS5leHBvcnRzID0gem90ZXJvSXRlbSA9PiB7XG5cdHZhciBjc2xUeXBlID0gQ1NMX1RZUEVfTUFQUElOR1Nbem90ZXJvSXRlbS5pdGVtVHlwZV07XG5cdGlmICghY3NsVHlwZSkge1xuXHRcdHRocm93IG5ldyBFcnJvcignVW5leHBlY3RlZCBab3Rlcm8gSXRlbSB0eXBlIFwiJyArIHpvdGVyb0l0ZW0uaXRlbVR5cGUgKyAnXCInKTtcblx0fVxuXG5cdHZhciBpdGVtVHlwZUlEID0gaXRlbVR5cGVzW3pvdGVyb0l0ZW0uaXRlbVR5cGVdO1xuXG5cdHZhciBjc2xJdGVtID0ge1xuXHRcdC8vICdpZCc6em90ZXJvSXRlbS51cmksXG5cdFx0aWQ6IHpvdGVyb0l0ZW0ua2V5LFxuXHRcdCd0eXBlJzpjc2xUeXBlXG5cdH07XG5cblx0Ly8gZ2V0IGFsbCB0ZXh0IHZhcmlhYmxlcyAodGhlcmUgbXVzdCBiZSBhIGJldHRlciB3YXkpXG5cdGZvcihsZXQgdmFyaWFibGUgaW4gQ1NMX1RFWFRfTUFQUElOR1MpIHtcblx0XHRsZXQgZmllbGRzID0gQ1NMX1RFWFRfTUFQUElOR1NbdmFyaWFibGVdO1xuXHRcdGZvcihsZXQgaT0wLCBuPWZpZWxkcy5sZW5ndGg7IGk8bjsgaSsrKSB7XG5cdFx0XHRsZXQgZmllbGQgPSBmaWVsZHNbaV0sXG5cdFx0XHRcdHZhbHVlID0gbnVsbDtcblxuXHRcdFx0aWYoZmllbGQgaW4gem90ZXJvSXRlbSkge1xuXHRcdFx0XHR2YWx1ZSA9IHpvdGVyb0l0ZW1bZmllbGRdO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0Y29uc3QgbWFwcGVkRmllbGQgPSBiYXNlTWFwcGluZ3NGbGF0W2Ake3pvdGVyb0l0ZW0uaXRlbVR5cGV9JHtmaWVsZH1gXTtcblx0XHRcdFx0dmFsdWUgPSB6b3Rlcm9JdGVtW21hcHBlZEZpZWxkXTtcblx0XHRcdH1cblxuXHRcdFx0aWYgKCF2YWx1ZSkgY29udGludWU7XG5cblx0XHRcdGlmICh0eXBlb2YgdmFsdWUgPT0gJ3N0cmluZycpIHtcblx0XHRcdFx0aWYgKGZpZWxkID09ICdJU0JOJykge1xuXHRcdFx0XHRcdC8vIE9ubHkgdXNlIHRoZSBmaXJzdCBJU0JOIGluIENTTCBKU09OXG5cdFx0XHRcdFx0dmFyIGlzYm4gPSB2YWx1ZS5tYXRjaCgvXig/Ojk3Wzg5XS0/KT8oPzpcXGQtPyl7OX1bXFxkeF0oPyEtKVxcYi9pKTtcblx0XHRcdFx0XHRpZihpc2JuKSB7XG5cdFx0XHRcdFx0XHR2YWx1ZSA9IGlzYm5bMF07XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cblx0XHRcdFx0Ly8gU3RyaXAgZW5jbG9zaW5nIHF1b3Rlc1xuXHRcdFx0XHRpZih2YWx1ZS5jaGFyQXQoMCkgPT0gJ1wiJyAmJiB2YWx1ZS5pbmRleE9mKCdcIicsIDEpID09IHZhbHVlLmxlbmd0aCAtIDEpIHtcblx0XHRcdFx0XHR2YWx1ZSA9IHZhbHVlLnN1YnN0cmluZygxLCB2YWx1ZS5sZW5ndGggLSAxKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRjc2xJdGVtW3ZhcmlhYmxlXSA9IHZhbHVlO1xuXHRcdFx0XHRicmVhaztcblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHQvLyBzZXBhcmF0ZSBuYW1lIHZhcmlhYmxlc1xuXHRpZiAoem90ZXJvSXRlbS50eXBlICE9ICdhdHRhY2htZW50JyAmJiB6b3Rlcm9JdGVtLnR5cGUgIT0gJ25vdGUnKSB7XG5cdFx0Ly8gdmFyIGF1dGhvciA9IFpvdGVyby5DcmVhdG9yVHlwZXMuZ2V0TmFtZShab3Rlcm8uQ3JlYXRvclR5cGVzLmdldFByaW1hcnlJREZvclR5cGUoKSk7XG5cdFx0bGV0IGF1dGhvciA9IGRlZmF1bHRJdGVtVHlwZUNyZWF0b3JUeXBlTG9va3VwW2l0ZW1UeXBlSURdO1xuXHRcdGxldCBjcmVhdG9ycyA9IHpvdGVyb0l0ZW0uY3JlYXRvcnM7XG5cdFx0Zm9yKGxldCBpID0gMDsgY3JlYXRvcnMgJiYgaSA8IGNyZWF0b3JzLmxlbmd0aDsgaSsrKSB7XG5cdFx0XHRsZXQgY3JlYXRvciA9IGNyZWF0b3JzW2ldO1xuXHRcdFx0bGV0IGNyZWF0b3JUeXBlID0gY3JlYXRvci5jcmVhdG9yVHlwZTtcblx0XHRcdGxldCBuYW1lT2JqO1xuXG5cdFx0XHRpZihjcmVhdG9yVHlwZSA9PSBhdXRob3IpIHtcblx0XHRcdFx0Y3JlYXRvclR5cGUgPSAnYXV0aG9yJztcblx0XHRcdH1cblxuXHRcdFx0Y3JlYXRvclR5cGUgPSBDU0xfTkFNRVNfTUFQUElOR1NbY3JlYXRvclR5cGVdO1xuXHRcdFx0aWYoIWNyZWF0b3JUeXBlKSB7XG5cdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAoJ2xhc3ROYW1lJyBpbiBjcmVhdG9yIHx8ICdmaXJzdE5hbWUnIGluIGNyZWF0b3IpIHtcblx0XHRcdFx0bmFtZU9iaiA9IHtcblx0XHRcdFx0XHRmYW1pbHk6IGNyZWF0b3IubGFzdE5hbWUgfHwgJycsXG5cdFx0XHRcdFx0Z2l2ZW46IGNyZWF0b3IuZmlyc3ROYW1lIHx8ICcnXG5cdFx0XHRcdH07XG5cblx0XHRcdFx0Ly8gUGFyc2UgbmFtZSBwYXJ0aWNsZXNcblx0XHRcdFx0Ly8gUmVwbGljYXRlIGNpdGVwcm9jLWpzIGxvZ2ljIGZvciB3aGF0IHNob3VsZCBiZSBwYXJzZWQgc28gd2UgZG9uJ3Rcblx0XHRcdFx0Ly8gYnJlYWsgY3VycmVudCBiZWhhdmlvci5cblx0XHRcdFx0aWYgKG5hbWVPYmouZmFtaWx5ICYmIG5hbWVPYmouZ2l2ZW4pIHtcblx0XHRcdFx0XHQvLyBEb24ndCBwYXJzZSBpZiBsYXN0IG5hbWUgaXMgcXVvdGVkXG5cdFx0XHRcdFx0aWYgKG5hbWVPYmouZmFtaWx5Lmxlbmd0aCA+IDFcblx0XHRcdFx0XHRcdCYmIG5hbWVPYmouZmFtaWx5LmNoYXJBdCgwKSA9PSAnXCInXG5cdFx0XHRcdFx0XHQmJiBuYW1lT2JqLmZhbWlseS5jaGFyQXQobmFtZU9iai5mYW1pbHkubGVuZ3RoIC0gMSkgPT0gJ1wiJ1xuXHRcdFx0XHRcdCkge1xuXHRcdFx0XHRcdFx0bmFtZU9iai5mYW1pbHkgPSBuYW1lT2JqLmZhbWlseS5zdWJzdHIoMSwgbmFtZU9iai5mYW1pbHkubGVuZ3RoIC0gMik7XG5cdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdENTTC5wYXJzZVBhcnRpY2xlcyhuYW1lT2JqLCB0cnVlKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH0gZWxzZSBpZiAoJ25hbWUnIGluIGNyZWF0b3IpIHtcblx0XHRcdFx0bmFtZU9iaiA9IHsnbGl0ZXJhbCc6IGNyZWF0b3IubmFtZX07XG5cdFx0XHR9XG5cblx0XHRcdGlmKGNzbEl0ZW1bY3JlYXRvclR5cGVdKSB7XG5cdFx0XHRcdGNzbEl0ZW1bY3JlYXRvclR5cGVdLnB1c2gobmFtZU9iaik7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRjc2xJdGVtW2NyZWF0b3JUeXBlXSA9IFtuYW1lT2JqXTtcblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHQvLyBnZXQgZGF0ZSB2YXJpYWJsZXNcblx0Zm9yKGxldCB2YXJpYWJsZSBpbiBDU0xfREFURV9NQVBQSU5HUykge1xuXHRcdGxldCBkYXRlID0gem90ZXJvSXRlbVtDU0xfREFURV9NQVBQSU5HU1t2YXJpYWJsZV1dO1xuXHRcdGlmICghZGF0ZSkge1xuXG5cdFx0XHRsZXQgdHlwZVNwZWNpZmljRmllbGRJRCA9IGdldEZpZWxkSURGcm9tVHlwZUFuZEJhc2UoaXRlbVR5cGVJRCwgQ1NMX0RBVEVfTUFQUElOR1NbdmFyaWFibGVdKTtcblx0XHRcdGlmICh0eXBlU3BlY2lmaWNGaWVsZElEKSB7XG5cdFx0XHRcdGRhdGUgPSB6b3Rlcm9JdGVtW2ZpZWxkc1t0eXBlU3BlY2lmaWNGaWVsZElEXV07XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0aWYoZGF0ZSkge1xuXHRcdFx0bGV0IGRhdGVPYmogPSBzdHJUb0RhdGUoZGF0ZSk7XG5cdFx0XHQvLyBvdGhlcndpc2UsIHVzZSBkYXRlLXBhcnRzXG5cdFx0XHRsZXQgZGF0ZVBhcnRzID0gW107XG5cdFx0XHRpZihkYXRlT2JqLnllYXIpIHtcblx0XHRcdFx0Ly8gYWRkIHllYXIsIG1vbnRoLCBhbmQgZGF5LCBpZiB0aGV5IGV4aXN0XG5cdFx0XHRcdGRhdGVQYXJ0cy5wdXNoKGRhdGVPYmoueWVhcik7XG5cdFx0XHRcdGlmKGRhdGVPYmoubW9udGggIT09IHVuZGVmaW5lZCkge1xuXHRcdFx0XHRcdGRhdGVQYXJ0cy5wdXNoKGRhdGVPYmoubW9udGgrMSk7XG5cdFx0XHRcdFx0aWYoZGF0ZU9iai5kYXkpIHtcblx0XHRcdFx0XHRcdGRhdGVQYXJ0cy5wdXNoKGRhdGVPYmouZGF5KTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdFx0Y3NsSXRlbVt2YXJpYWJsZV0gPSB7J2RhdGUtcGFydHMnOltkYXRlUGFydHNdfTtcblxuXHRcdFx0XHQvLyBpZiBubyBtb250aCwgdXNlIHNlYXNvbiBhcyBtb250aFxuXHRcdFx0XHRpZihkYXRlT2JqLnBhcnQgJiYgZGF0ZU9iai5tb250aCA9PT0gdW5kZWZpbmVkKSB7XG5cdFx0XHRcdFx0Y3NsSXRlbVt2YXJpYWJsZV0uc2Vhc29uID0gZGF0ZU9iai5wYXJ0O1xuXHRcdFx0XHR9XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHQvLyBpZiBubyB5ZWFyLCBwYXNzIGRhdGUgbGl0ZXJhbGx5XG5cdFx0XHRcdGNzbEl0ZW1bdmFyaWFibGVdID0geydsaXRlcmFsJzpkYXRlfTtcblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHQvLyBTcGVjaWFsIG1hcHBpbmcgZm9yIG5vdGUgdGl0bGVcblx0Ly8gQE5PVEU6IE5vdCBwb3J0ZWRcblx0Ly8gaWYgKHpvdGVyb0l0ZW0uaXRlbVR5cGUgPT0gJ25vdGUnICYmIHpvdGVyb0l0ZW0ubm90ZSkge1xuXHQvLyBcdGNzbEl0ZW0udGl0bGUgPSBab3Rlcm8uTm90ZXMubm90ZVRvVGl0bGUoem90ZXJvSXRlbS5ub3RlKTtcblx0Ly8gfVxuXG5cdC8vdGhpcy5fY2FjaGVbem90ZXJvSXRlbS5pZF0gPSBjc2xJdGVtO1xuXHRyZXR1cm4gY3NsSXRlbTtcbn1cbiIsIid1c2Ugc3RyaWN0JztcblxuY29uc3QgaXRlbVR5cGVzID0ge1xuXHQxOiAnbm90ZScsXG5cdDI6ICdib29rJyxcblx0MzogJ2Jvb2tTZWN0aW9uJyxcblx0NDogJ2pvdXJuYWxBcnRpY2xlJyxcblx0NTogJ21hZ2F6aW5lQXJ0aWNsZScsXG5cdDY6ICduZXdzcGFwZXJBcnRpY2xlJyxcblx0NzogJ3RoZXNpcycsXG5cdDg6ICdsZXR0ZXInLFxuXHQ5OiAnbWFudXNjcmlwdCcsXG5cdDEwOiAnaW50ZXJ2aWV3Jyxcblx0MTE6ICdmaWxtJyxcblx0MTI6ICdhcnR3b3JrJyxcblx0MTM6ICd3ZWJwYWdlJyxcblx0MTQ6ICdhdHRhY2htZW50Jyxcblx0MTU6ICdyZXBvcnQnLFxuXHQxNjogJ2JpbGwnLFxuXHQxNzogJ2Nhc2UnLFxuXHQxODogJ2hlYXJpbmcnLFxuXHQxOTogJ3BhdGVudCcsXG5cdDIwOiAnc3RhdHV0ZScsXG5cdDIxOiAnZW1haWwnLFxuXHQyMjogJ21hcCcsXG5cdDIzOiAnYmxvZ1Bvc3QnLFxuXHQyNDogJ2luc3RhbnRNZXNzYWdlJyxcblx0MjU6ICdmb3J1bVBvc3QnLFxuXHQyNjogJ2F1ZGlvUmVjb3JkaW5nJyxcblx0Mjc6ICdwcmVzZW50YXRpb24nLFxuXHQyODogJ3ZpZGVvUmVjb3JkaW5nJyxcblx0Mjk6ICd0dkJyb2FkY2FzdCcsXG5cdDMwOiAncmFkaW9Ccm9hZGNhc3QnLFxuXHQzMTogJ3BvZGNhc3QnLFxuXHQzMjogJ2NvbXB1dGVyUHJvZ3JhbScsXG5cdDMzOiAnY29uZmVyZW5jZVBhcGVyJyxcblx0MzQ6ICdkb2N1bWVudCcsXG5cdDM1OiAnZW5jeWNsb3BlZGlhQXJ0aWNsZScsXG5cdDM2OiAnZGljdGlvbmFyeUVudHJ5J1xufTtcblxuLy9yZXZlcnNlIGxvb2t1cFxuT2JqZWN0LmtleXMoaXRlbVR5cGVzKS5tYXAoayA9PiBpdGVtVHlwZXNbaXRlbVR5cGVzW2tdXSA9IGspO1xubW9kdWxlLmV4cG9ydHMgPSBpdGVtVHlwZXM7XG4iLCIndXNlIHN0cmljdCc7XG5cbm1vZHVsZS5leHBvcnRzID0gKHN0cmluZywgcGFkLCBsZW5ndGgpID0+IHtcblx0c3RyaW5nID0gc3RyaW5nID8gc3RyaW5nICsgJycgOiAnJztcblx0d2hpbGUoc3RyaW5nLmxlbmd0aCA8IGxlbmd0aCkge1xuXHRcdHN0cmluZyA9IHBhZCArIHN0cmluZztcblx0fVxuXHRyZXR1cm4gc3RyaW5nO1xufVxuIiwiJ3VzZSBzdHJpY3QnO1xuXG5jb25zdCBkYXRlVG9TUUwgPSByZXF1aXJlKCcuL2RhdGUtdG8tc3FsJyk7XG5cbmNvbnN0IG1vbnRocyA9IFsnamFuJywgJ2ZlYicsICdtYXInLCAnYXByJywgJ21heScsICdqdW4nLCAnanVsJywgJ2F1ZycsICdzZXAnLCAnb2N0JywgJ25vdicsICdkZWMnLCAnamFudWFyeScsICdmZWJydWFyeScsICdtYXJjaCcsICdhcHJpbCcsICdtYXknLCAnanVuZScsICdqdWx5JywgJ2F1Z3VzdCcsICdzZXB0ZW1iZXInLCAnb2N0b2JlcicsICdub3ZlbWJlcicsICdkZWNlbWJlciddO1xuXG5jb25zdCBfc2xhc2hSZSA9IC9eKC4qPylcXGIoWzAtOV17MSw0fSkoPzooW1xcLVxcL1xcLlxcdTVlNzRdKShbMC05XXsxLDJ9KSk/KD86KFtcXC1cXC9cXC5cXHU2NzA4XSkoWzAtOV17MSw0fSkpPygoPzpcXGJ8W14wLTldKS4qPykkL1xuY29uc3QgX3llYXJSZSA9IC9eKC4qPylcXGIoKD86Y2lyY2EgfGFyb3VuZCB8YWJvdXQgfGNcXC4/ID8pP1swLTldezEsNH0oPzogP0JcXC4/ID9DXFwuPyg/OiA/RVxcLj8pP3wgP0NcXC4/ID9FXFwuP3wgP0FcXC4/ID9EXFwuPyl8WzAtOV17Myw0fSlcXGIoLio/KSQvaTtcbmNvbnN0IF9tb250aFJlID0gbmV3IFJlZ0V4cCgnXiguKilcXFxcYignICsgbW9udGhzLmpvaW4oJ3wnKSArICcpW14gXSooPzogKC4qKSR8JCknLCAnaScpO1xuY29uc3QgX2RheVJlID0gbmV3IFJlZ0V4cCgnXFxcXGIoWzAtOV17MSwyfSkoPzpzdHxuZHxyZHx0aCk/XFxcXGIoLiopJywgJ2knKTtcblxuY29uc3QgX2luc2VydERhdGVPcmRlclBhcnQgPSAoZGF0ZU9yZGVyLCBwYXJ0LCBwYXJ0T3JkZXIpID0+IHtcblx0XHRpZiAoIWRhdGVPcmRlcikge1xuXHRcdFx0cmV0dXJuIHBhcnQ7XG5cdFx0fVxuXHRcdGlmIChwYXJ0T3JkZXIuYmVmb3JlID09PSB0cnVlKSB7XG5cdFx0XHRyZXR1cm4gcGFydCArIGRhdGVPcmRlcjtcblx0XHR9XG5cdFx0aWYgKHBhcnRPcmRlci5hZnRlciA9PT0gdHJ1ZSkge1xuXHRcdFx0cmV0dXJuIGRhdGVPcmRlciArIHBhcnQ7XG5cdFx0fVxuXHRcdGlmIChwYXJ0T3JkZXIuYmVmb3JlKSB7XG5cdFx0XHRsZXQgcG9zID0gZGF0ZU9yZGVyLmluZGV4T2YocGFydE9yZGVyLmJlZm9yZSk7XG5cdFx0XHRpZiAocG9zID09IC0xKSB7XG5cdFx0XHRcdHJldHVybiBkYXRlT3JkZXI7XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gZGF0ZU9yZGVyLnJlcGxhY2UobmV3IFJlZ0V4cCgnKCcgKyBwYXJ0T3JkZXIuYmVmb3JlICsgJyknKSwgcGFydCArICckMScpO1xuXHRcdH1cblx0XHRpZiAocGFydE9yZGVyLmFmdGVyKSB7XG5cdFx0XHRsZXQgcG9zID0gZGF0ZU9yZGVyLmluZGV4T2YocGFydE9yZGVyLmFmdGVyKTtcblx0XHRcdGlmIChwb3MgPT0gLTEpIHtcblx0XHRcdFx0cmV0dXJuIGRhdGVPcmRlciArIHBhcnQ7XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gZGF0ZU9yZGVyLnJlcGxhY2UobmV3IFJlZ0V4cCgnKCcgKyBwYXJ0T3JkZXIuYWZ0ZXIgKyAnKScpLCAnJDEnICsgcGFydCk7XG5cdFx0fVxuXHRcdHJldHVybiBkYXRlT3JkZXIgKyBwYXJ0O1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IHN0cmluZyA9PiB7XG5cdHZhciBkYXRlID0ge1xuXHRcdG9yZGVyOiAnJ1xuXHR9O1xuXG5cdC8vIHNraXAgZW1wdHkgdGhpbmdzXG5cdGlmKCFzdHJpbmcpIHtcblx0XHRyZXR1cm4gZGF0ZTtcblx0fVxuXG5cdHZhciBwYXJ0cyA9IFtdO1xuXG5cdC8vIFBhcnNlICd5ZXN0ZXJkYXknLyd0b2RheScvJ3RvbW9ycm93J1xuXHRsZXQgbGMgPSAoc3RyaW5nICsgJycpLnRvTG93ZXJDYXNlKCk7XG5cdGlmIChsYyA9PSAneWVzdGVyZGF5Jykge1xuXHRcdHN0cmluZyA9IGRhdGVUb1NRTChuZXcgRGF0ZShEYXRlLm5vdygpIC0gMTAwMCo2MCo2MCoyNCkpLnN1YnN0cigwLCAxMCk7XG5cdH1cblx0ZWxzZSBpZiAobGMgPT0gJ3RvZGF5Jykge1xuXHRcdHN0cmluZyA9IGRhdGVUb1NRTChuZXcgRGF0ZSgpKS5zdWJzdHIoMCwgMTApO1xuXHR9XG5cdGVsc2UgaWYgKGxjID09ICd0b21vcnJvdycpIHtcblx0XHRzdHJpbmcgPSBkYXRlVG9TUUwobmV3IERhdGUoRGF0ZS5ub3coKSArIDEwMDAqNjAqNjAqMjQpKS5zdWJzdHIoMCwgMTApO1xuXHR9XG5cdGVsc2Uge1xuXHRcdHN0cmluZyA9IHN0cmluZy50b1N0cmluZygpLnJlcGxhY2UoL15cXHMrfFxccyskL2csICcnKS5yZXBsYWNlKC9cXHMrLywgJyAnKTtcblx0fVxuXG5cdC8vIGZpcnN0LCBkaXJlY3RseSBpbnNwZWN0IHRoZSBzdHJpbmdcblx0bGV0IG0gPSBfc2xhc2hSZS5leGVjKHN0cmluZyk7XG5cdGlmKG0gJiZcblx0XHQoKCFtWzVdIHx8ICFtWzNdKSB8fCBtWzNdID09IG1bNV0gfHwgKG1bM10gPT0gJ1xcdTVlNzQnICYmIG1bNV0gPT0gJ1xcdTY3MDgnKSkgJiZcdC8vIHJlcXVpcmUgc2FuZSBzZXBhcmF0b3JzXG5cdFx0KChtWzJdICYmIG1bNF0gJiYgbVs2XSkgfHwgKCFtWzFdICYmICFtWzddKSkpIHtcdFx0XHRcdFx0XHQvLyByZXF1aXJlIHRoYXQgZWl0aGVyIGFsbCBwYXJ0cyBhcmUgZm91bmQsXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdC8vIG9yIGVsc2UgdGhpcyBpcyB0aGUgZW50aXJlIGRhdGUgZmllbGRcblx0XHQvLyBmaWd1cmUgb3V0IGRhdGUgYmFzZWQgb24gcGFydHNcblx0XHRpZihtWzJdLmxlbmd0aCA9PSAzIHx8IG1bMl0ubGVuZ3RoID09IDQgfHwgbVszXSA9PSAnXFx1NWU3NCcpIHtcblx0XHRcdC8vIElTTyA4NjAxIHN0eWxlIGRhdGUgKGJpZyBlbmRpYW4pXG5cdFx0XHRkYXRlLnllYXIgPSBtWzJdO1xuXHRcdFx0ZGF0ZS5tb250aCA9IG1bNF07XG5cdFx0XHRkYXRlLmRheSA9IG1bNl07XG5cdFx0XHRkYXRlLm9yZGVyICs9IG1bMl0gPyAneScgOiAnJztcblx0XHRcdGRhdGUub3JkZXIgKz0gbVs0XSA/ICdtJyA6ICcnO1xuXHRcdFx0ZGF0ZS5vcmRlciArPSBtWzZdID8gJ2QnIDogJyc7XG5cdFx0fSBlbHNlIGlmKG1bMl0gJiYgIW1bNF0gJiYgbVs2XSkge1xuXHRcdFx0ZGF0ZS5tb250aCA9IG1bMl07XG5cdFx0XHRkYXRlLnllYXIgPSBtWzZdO1xuXHRcdFx0ZGF0ZS5vcmRlciArPSBtWzJdID8gJ20nIDogJyc7XG5cdFx0XHRkYXRlLm9yZGVyICs9IG1bNl0gPyAneScgOiAnJztcblx0XHR9IGVsc2Uge1xuXHRcdFx0Ly8gbG9jYWwgc3R5bGUgZGF0ZSAobWlkZGxlIG9yIGxpdHRsZSBlbmRpYW4pXG5cdFx0XHR2YXIgY291bnRyeSA9IHdpbmRvdy5uYXZpZ2F0b3IubGFuZ3VhZ2UgPyB3aW5kb3cubmF2aWdhdG9yLmxhbmd1YWdlLnN1YnN0cigzKSA6ICdVUyc7XG5cdFx0XHRpZihjb3VudHJ5ID09ICdVUycgfHxcdC8vIFRoZSBVbml0ZWQgU3RhdGVzXG5cdFx0XHRcdGNvdW50cnkgPT0gJ0ZNJyB8fFx0Ly8gVGhlIEZlZGVyYXRlZCBTdGF0ZXMgb2YgTWljcm9uZXNpYVxuXHRcdFx0XHRjb3VudHJ5ID09ICdQVycgfHxcdC8vIFBhbGF1XG5cdFx0XHRcdGNvdW50cnkgPT0gJ1BIJykge1x0Ly8gVGhlIFBoaWxpcHBpbmVzXG5cdFx0XHRcdFx0ZGF0ZS5tb250aCA9IG1bMl07XG5cdFx0XHRcdFx0ZGF0ZS5kYXkgPSBtWzRdO1xuXHRcdFx0XHRcdGRhdGUub3JkZXIgKz0gbVsyXSA/ICdtJyA6ICcnO1xuXHRcdFx0XHRcdGRhdGUub3JkZXIgKz0gbVs0XSA/ICdkJyA6ICcnO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0ZGF0ZS5tb250aCA9IG1bNF07XG5cdFx0XHRcdGRhdGUuZGF5ID0gbVsyXTtcblx0XHRcdFx0ZGF0ZS5vcmRlciArPSBtWzJdID8gJ2QnIDogJyc7XG5cdFx0XHRcdGRhdGUub3JkZXIgKz0gbVs0XSA/ICdtJyA6ICcnO1xuXHRcdFx0fVxuXHRcdFx0ZGF0ZS55ZWFyID0gbVs2XTtcblx0XHRcdGRhdGUub3JkZXIgKz0gJ3knO1xuXHRcdH1cblxuXHRcdGlmKGRhdGUueWVhcikge1xuXHRcdFx0ZGF0ZS55ZWFyID0gcGFyc2VJbnQoZGF0ZS55ZWFyLCAxMCk7XG5cdFx0fVxuXHRcdGlmKGRhdGUuZGF5KSB7XG5cdFx0XHRkYXRlLmRheSA9IHBhcnNlSW50KGRhdGUuZGF5LCAxMCk7XG5cdFx0fVxuXHRcdGlmKGRhdGUubW9udGgpIHtcblx0XHRcdGRhdGUubW9udGggPSBwYXJzZUludChkYXRlLm1vbnRoLCAxMCk7XG5cblx0XHRcdGlmKGRhdGUubW9udGggPiAxMikge1xuXHRcdFx0XHQvLyBzd2FwIGRheSBhbmQgbW9udGhcblx0XHRcdFx0dmFyIHRtcCA9IGRhdGUuZGF5O1xuXHRcdFx0XHRkYXRlLmRheSA9IGRhdGUubW9udGhcblx0XHRcdFx0ZGF0ZS5tb250aCA9IHRtcDtcblx0XHRcdFx0ZGF0ZS5vcmRlciA9IGRhdGUub3JkZXIucmVwbGFjZSgnbScsICdEJylcblx0XHRcdFx0XHQucmVwbGFjZSgnZCcsICdNJylcblx0XHRcdFx0XHQucmVwbGFjZSgnRCcsICdkJylcblx0XHRcdFx0XHQucmVwbGFjZSgnTScsICdtJyk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0aWYoKCFkYXRlLm1vbnRoIHx8IGRhdGUubW9udGggPD0gMTIpICYmICghZGF0ZS5kYXkgfHwgZGF0ZS5kYXkgPD0gMzEpKSB7XG5cdFx0XHRpZihkYXRlLnllYXIgJiYgZGF0ZS55ZWFyIDwgMTAwKSB7XHQvLyBmb3IgdHdvIGRpZ2l0IHllYXJzLCBkZXRlcm1pbmUgcHJvcGVyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQvLyBmb3VyIGRpZ2l0IHllYXJcblx0XHRcdFx0dmFyIHRvZGF5ID0gbmV3IERhdGUoKTtcblx0XHRcdFx0dmFyIHllYXIgPSB0b2RheS5nZXRGdWxsWWVhcigpO1xuXHRcdFx0XHR2YXIgdHdvRGlnaXRZZWFyID0geWVhciAlIDEwMDtcblx0XHRcdFx0dmFyIGNlbnR1cnkgPSB5ZWFyIC0gdHdvRGlnaXRZZWFyO1xuXG5cdFx0XHRcdGlmKGRhdGUueWVhciA8PSB0d29EaWdpdFllYXIpIHtcblx0XHRcdFx0XHQvLyBhc3N1bWUgdGhpcyBkYXRlIGlzIGZyb20gb3VyIGNlbnR1cnlcblx0XHRcdFx0XHRkYXRlLnllYXIgPSBjZW50dXJ5ICsgZGF0ZS55ZWFyO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdC8vIGFzc3VtZSB0aGlzIGRhdGUgaXMgZnJvbSB0aGUgcHJldmlvdXMgY2VudHVyeVxuXHRcdFx0XHRcdGRhdGUueWVhciA9IGNlbnR1cnkgLSAxMDAgKyBkYXRlLnllYXI7XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdFx0aWYoZGF0ZS5tb250aCkge1xuXHRcdFx0XHRkYXRlLm1vbnRoLS07XHRcdC8vIHN1YnRyYWN0IG9uZSBmb3IgSlMgc3R5bGVcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdGRlbGV0ZSBkYXRlLm1vbnRoO1xuXHRcdFx0fVxuXG5cdFx0XHRwYXJ0cy5wdXNoKFxuXHRcdFx0XHR7IHBhcnQ6IG1bMV0sIGJlZm9yZTogdHJ1ZSB9LFxuXHRcdFx0XHR7IHBhcnQ6IG1bN10gfVxuXHRcdFx0KTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0dmFyIGRhdGUgPSB7XG5cdFx0XHRcdG9yZGVyOiAnJ1xuXHRcdFx0fTtcblx0XHRcdHBhcnRzLnB1c2goeyBwYXJ0OiBzdHJpbmcgfSk7XG5cdFx0fVxuXHR9IGVsc2Uge1xuXHRcdHBhcnRzLnB1c2goeyBwYXJ0OiBzdHJpbmcgfSk7XG5cdH1cblxuXHQvLyBjb3VsZG4ndCBmaW5kIHNvbWV0aGluZyB3aXRoIHRoZSBhbGdvcml0aG1zOyB1c2UgcmVnZXhwXG5cdC8vIFlFQVJcblx0aWYoIWRhdGUueWVhcikge1xuXHRcdGZvciAobGV0IGkgaW4gcGFydHMpIHtcblx0XHRcdGxldCBtID0gX3llYXJSZS5leGVjKHBhcnRzW2ldLnBhcnQpO1xuXHRcdFx0aWYgKG0pIHtcblx0XHRcdFx0ZGF0ZS55ZWFyID0gbVsyXTtcblx0XHRcdFx0ZGF0ZS5vcmRlciA9IF9pbnNlcnREYXRlT3JkZXJQYXJ0KGRhdGUub3JkZXIsICd5JywgcGFydHNbaV0pO1xuXHRcdFx0XHRwYXJ0cy5zcGxpY2UoXG5cdFx0XHRcdFx0aSwgMSxcblx0XHRcdFx0XHR7IHBhcnQ6IG1bMV0sIGJlZm9yZTogdHJ1ZSB9LFxuXHRcdFx0XHRcdHsgcGFydDogbVszXSB9XG5cdFx0XHRcdCk7XG5cdFx0XHRcdGJyZWFrO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdC8vIE1PTlRIXG5cdGlmKGRhdGUubW9udGggPT09IHVuZGVmaW5lZCkge1xuXHRcdGZvciAobGV0IGkgaW4gcGFydHMpIHtcblx0XHRcdGxldCBtID0gX21vbnRoUmUuZXhlYyhwYXJ0c1tpXS5wYXJ0KTtcblx0XHRcdGlmIChtKSB7XG5cdFx0XHRcdC8vIE1vZHVsbyAxMiBpbiBjYXNlIHdlIGhhdmUgbXVsdGlwbGUgbGFuZ3VhZ2VzXG5cdFx0XHRcdGRhdGUubW9udGggPSBtb250aHMuaW5kZXhPZihtWzJdLnRvTG93ZXJDYXNlKCkpICUgMTI7XG5cdFx0XHRcdGRhdGUub3JkZXIgPSBfaW5zZXJ0RGF0ZU9yZGVyUGFydChkYXRlLm9yZGVyLCAnbScsIHBhcnRzW2ldKTtcblx0XHRcdFx0cGFydHMuc3BsaWNlKFxuXHRcdFx0XHRcdGksIDEsXG5cdFx0XHRcdFx0eyBwYXJ0OiBtWzFdLCBiZWZvcmU6ICdtJyB9LFxuXHRcdFx0XHRcdHsgcGFydDogbVszXSwgYWZ0ZXI6ICdtJyB9XG5cdFx0XHRcdCk7XG5cdFx0XHRcdGJyZWFrO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdC8vIERBWVxuXHRpZighZGF0ZS5kYXkpIHtcblx0XHQvLyBjb21waWxlIGRheSByZWd1bGFyIGV4cHJlc3Npb25cblx0XHRmb3IgKGxldCBpIGluIHBhcnRzKSB7XG5cdFx0XHRsZXQgbSA9IF9kYXlSZS5leGVjKHBhcnRzW2ldLnBhcnQpO1xuXHRcdFx0aWYgKG0pIHtcblx0XHRcdFx0dmFyIGRheSA9IHBhcnNlSW50KG1bMV0sIDEwKSxcblx0XHRcdFx0XHRwYXJ0O1xuXHRcdFx0XHQvLyBTYW5pdHkgY2hlY2tcblx0XHRcdFx0aWYgKGRheSA8PSAzMSkge1xuXHRcdFx0XHRcdGRhdGUuZGF5ID0gZGF5O1xuXHRcdFx0XHRcdGRhdGUub3JkZXIgPSBfaW5zZXJ0RGF0ZU9yZGVyUGFydChkYXRlLm9yZGVyLCAnZCcsIHBhcnRzW2ldKTtcblx0XHRcdFx0XHRpZihtLmluZGV4ID4gMCkge1xuXHRcdFx0XHRcdFx0cGFydCA9IHBhcnRzW2ldLnBhcnQuc3Vic3RyKDAsIG0uaW5kZXgpO1xuXHRcdFx0XHRcdFx0aWYobVsyXSkge1xuXHRcdFx0XHRcdFx0XHRwYXJ0ICs9ICcgJyArIG1bMl07XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdHBhcnQgPSBtWzJdO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRwYXJ0cy5zcGxpY2UoXG5cdFx0XHRcdFx0XHRpLCAxLFxuXHRcdFx0XHRcdFx0eyBwYXJ0OiBwYXJ0IH1cblx0XHRcdFx0XHQpO1xuXHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0Ly8gQ29uY2F0ZW5hdGUgZGF0ZSBwYXJ0c1xuXHRkYXRlLnBhcnQgPSAnJztcblx0Zm9yICh2YXIgaSBpbiBwYXJ0cykge1xuXHRcdGRhdGUucGFydCArPSBwYXJ0c1tpXS5wYXJ0ICsgJyAnO1xuXHR9XG5cblx0Ly8gY2xlYW4gdXAgZGF0ZSBwYXJ0XG5cdGlmKGRhdGUucGFydCkge1xuXHRcdGRhdGUucGFydCA9IGRhdGUucGFydC5yZXBsYWNlKC9eW15BLVphLXowLTldK3xbXkEtWmEtejAtOV0rJC9nLCAnJyk7XG5cdH1cblxuXHRpZihkYXRlLnBhcnQgPT09ICcnIHx8IGRhdGUucGFydCA9PSB1bmRlZmluZWQpIHtcblx0XHRkZWxldGUgZGF0ZS5wYXJ0O1xuXHR9XG5cblx0Ly9tYWtlIHN1cmUgeWVhciBpcyBhbHdheXMgYSBzdHJpbmdcblx0aWYoZGF0ZS55ZWFyIHx8IGRhdGUueWVhciA9PT0gMCkgZGF0ZS55ZWFyICs9ICcnO1xuXG5cdHJldHVybiBkYXRlO1xufVxuIiwiY29uc3QgZmllbGRzID0gcmVxdWlyZSgnLi9maWVsZHMnKTtcbmNvbnN0IGl0ZW1UeXBlcyA9IHJlcXVpcmUoJy4vaXRlbS10eXBlcycpO1xuXG5jb25zdCB0eXBlU3BlY2lmaWNGaWVsZE1hcCA9IHtcblx0WygxNiA8PCA4KSArIDRdOiA5NCxcblx0WygxNyA8PCA4KSArIDRdOiA5Nyxcblx0Wyg3IDw8IDgpICsgOF06IDg5LFxuXHRbKDExIDw8IDgpICsgOF06IDIxLFxuXHRbKDE1IDw8IDgpICsgOF06IDMxLFxuXHRbKDI2IDw8IDgpICsgOF06IDcyLFxuXHRbKDI4IDw8IDgpICsgOF06IDc2LFxuXHRbKDI5IDw8IDgpICsgOF06IDc4LFxuXHRbKDMwIDw8IDgpICsgOF06IDc4LFxuXHRbKDMyIDw8IDgpICsgOF06IDgzLFxuXHRbKDE2IDw8IDgpICsgMTBdOiA5NSxcblx0WygxNyA8PCA4KSArIDEwXTogOTgsXG5cdFsoMyA8PCA4KSArIDEyXTogMTE1LFxuXHRbKDMzIDw8IDgpICsgMTJdOiAxMTQsXG5cdFsoMTMgPDwgOCkgKyAxMl06IDkxLFxuXHRbKDIzIDw8IDgpICsgMTJdOiAxMDcsXG5cdFsoMjUgPDwgOCkgKyAxMl06IDEwNCxcblx0WygyOSA8PCA4KSArIDEyXTogMTE5LFxuXHRbKDMwIDw8IDgpICsgMTJdOiAxMTksXG5cdFsoMzUgPDwgOCkgKyAxMl06IDg1LFxuXHRbKDM2IDw8IDgpICsgMTJdOiA4Nixcblx0WygxNyA8PCA4KSArIDE0XTogOTYsXG5cdFsoMTkgPDwgOCkgKyAxNF06IDUyLFxuXHRbKDIwIDw8IDgpICsgMTRdOiAxMDAsXG5cdFsoMTUgPDwgOCkgKyA2MF06IDkyLFxuXHRbKDE2IDw8IDgpICsgNjBdOiA5Myxcblx0WygxNyA8PCA4KSArIDYwXTogMTE3LFxuXHRbKDE4IDw8IDgpICsgNjBdOiA5OSxcblx0WygxOSA8PCA4KSArIDYwXTogNTAsXG5cdFsoMjAgPDwgOCkgKyA2MF06IDEwMSxcblx0WygyOSA8PCA4KSArIDYwXTogMTA1LFxuXHRbKDMwIDw8IDgpICsgNjBdOiAxMDUsXG5cdFsoMzEgPDwgOCkgKyA2MF06IDEwNSxcblx0Wyg3IDw8IDgpICsgMTA4XTogNjksXG5cdFsoOCA8PCA4KSArIDEwOF06IDY1LFxuXHRbKDkgPDwgOCkgKyAxMDhdOiA2Nixcblx0WygxMSA8PCA4KSArIDEwOF06IDEyMixcblx0WygxMyA8PCA4KSArIDEwOF06IDcwLFxuXHRbKDE1IDw8IDgpICsgMTA4XTogMzIsXG5cdFsoMjIgPDwgOCkgKyAxMDhdOiA2Nyxcblx0WygyMyA8PCA4KSArIDEwOF06IDcwLFxuXHRbKDI1IDw8IDgpICsgMTA4XTogNzksXG5cdFsoMjcgPDwgOCkgKyAxMDhdOiA3NCxcblx0WygxMCA8PCA4KSArIDEwOV06IDY0LFxuXHRbKDExIDw8IDgpICsgMTA5XTogNjMsXG5cdFsoMTIgPDwgOCkgKyAxMDldOiA1OSxcblx0WygyNiA8PCA4KSArIDEwOV06IDcxLFxuXHRbKDI4IDw8IDgpICsgMTA5XTogNjMsXG5cdFsoMjkgPDwgOCkgKyAxMDldOiA2Myxcblx0WygzMCA8PCA4KSArIDEwOV06IDcxLFxuXHRbKDMxIDw8IDgpICsgMTA5XTogODAsXG5cdFsoMTcgPDwgOCkgKyAxMTBdOiAxMTEsXG5cdFsoMjAgPDwgOCkgKyAxMTBdOiAxMTIsXG5cdFsoMjEgPDwgOCkgKyAxMTBdOiAxMTNcbn07XG5cbm1vZHVsZS5leHBvcnRzID0ge1xuXHRtYXA6IHR5cGVTcGVjaWZpY0ZpZWxkTWFwLFxuXHRnZXRGaWVsZElERnJvbVR5cGVBbmRCYXNlOiAodHlwZUlkLCBmaWVsZElkKSA9PiB7XG5cdFx0dHlwZUlkID0gdHlwZW9mIHR5cGVJZCA9PT0gJ251bWJlcicgPyB0eXBlSWQgOiBpdGVtVHlwZXNbdHlwZUlkXTtcblx0XHRmaWVsZElkID0gdHlwZW9mIGZpZWxkSWQgPT09ICdudW1iZXInID8gZmllbGRJZCA6IGZpZWxkc1tmaWVsZElkXTtcblx0XHRyZXR1cm4gdHlwZVNwZWNpZmljRmllbGRNYXBbKHR5cGVJZCA8PCA4KSArIGZpZWxkSWRdO1xuXHR9XG59O1xuIl19
