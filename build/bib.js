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
'use strict';var _extends=Object.assign||function(e){for(var a,b=1;b<arguments.length;b++)for(var c in a=arguments[b],a)Object.prototype.hasOwnProperty.call(a,c)&&(e[c]=a[c]);return e};const dateToSql=require('../zotero-shim/date-to-sql'),defaults=require('./defaults'),itemToCSLJSON=require('../zotero-shim/item-to-csl-json'),parseLinkHeader=require('parse-link-header'),{uuid4,isLikeZoteroItem}=require('./utils'),[COMPLETE,MULTIPLE_ITEMS,FAILED]=['COMPLETE','MULTIPLE_ITEMS','FAILED'];class ZoteroBib{constructor(b){if(this.opts=_extends({sessionid:uuid4()},defaults(),b),this.opts.persist&&this.opts.storage){if(!('getItem'in this.opts.storage||'setItem'in this.opts.storage||'clear'in this.opts.storage))throw new Error('Invalid storage engine provided');this.opts.override&&this.clearItems(),this.items=[...this.opts.initialItems,...this.getItemsStorage()].filter(isLikeZoteroItem),this.setItemsStorage(this.items)}else this.items=[...this.opts.initialItems].filter(isLikeZoteroItem)}getItemsStorage(){let b=this.opts.storage.getItem(`${this.opts.storagePrefix}-items`);return b?JSON.parse(b):[]}setItemsStorage(b){this.opts.storage.setItem(`${this.opts.storagePrefix}-items`,JSON.stringify(b))}reloadItems(){this.items=this.getItemsStorage()}addItem(b){if(!isLikeZoteroItem(b))throw new Error('Failed to add item');this.items.push(b),this.opts.persist&&this.setItemsStorage(this.items)}updateItem(c,a){this.items[c]=a,this.opts.persist&&this.setItemsStorage(this.items)}removeItem(c){let a=this.items.indexOf(c);return-1!==a&&(this.items.splice(a,1),this.opts.persist&&this.setItemsStorage(this.items),c)}clearItems(){this.items=[],this.opts.persist&&this.setItemsStorage(this.items)}get itemsCSL(){return this.items.map((b)=>itemToCSLJSON(b))}get itemsRaw(){return this.items}async exportItems(e){let a=`${this.opts.translateURL}/${this.opts.translatePrefix}export?format=${e}`,b=_extends({method:'POST',headers:{"Content-Type":'application/json'},body:JSON.stringify(this.items.filter((b)=>'key'in b))},this.opts.init);const c=await fetch(a,b);if(c.ok)return await c.text();throw new Error('Failed to export items')}async translateIdentifier(e,...f){let b=`${this.opts.translateURL}/${this.opts.translatePrefix}search`,c=_extends({method:'POST',headers:{"Content-Type":'text/plain'},body:e},this.opts.init);return await this.translate(b,c,...f)}async translateUrlItems(h,i,...j){let c=`${this.opts.translateURL}/${this.opts.translatePrefix}web`,d=this.opts.sessionid,k=_extends({url:h,items:i,sessionid:d},this.opts.request),f=_extends({method:'POST',headers:{"Content-Type":'application/json'},body:JSON.stringify(k)},this.opts.init);return await this.translate(c,f,...j)}async translateUrl(g,...h){let b=`${this.opts.translateURL}/${this.opts.translatePrefix}web`,c=this.opts.sessionid,i=_extends({url:g,sessionid:c},this.opts.request),e=_extends({method:'POST',headers:{"Content-Type":'application/json'},body:JSON.stringify(i)},this.opts.init);return await this.translate(b,e,...h)}async translate(h,a,b=!0){const c=await fetch(h,a);var i,j,k={};return c.headers.has('Link')&&(k=parseLinkHeader(c.headers.get('Link'))),c.ok?(i=await c.json(),Array.isArray(i)&&i.forEach((c)=>{if('CURRENT_TIMESTAMP'===c.accessDate){const a=new Date(Date.now());c.accessDate=dateToSql(a,!0)}b&&this.addItem(c)}),j=Array.isArray(i)?COMPLETE:FAILED):300===c.status?(i=await c.json(),j=MULTIPLE_ITEMS):j=FAILED,{result:j,items:i,response:c,links:k}}static get COMPLETE(){return COMPLETE}static get MULTIPLE_ITEMS(){return MULTIPLE_ITEMS}static get FAILED(){return FAILED}}module.exports=ZoteroBib;

},{"../zotero-shim/date-to-sql":16,"../zotero-shim/item-to-csl-json":19,"./defaults":11,"./utils":12,"parse-link-header":1}],11:[function(require,module,exports){
'use strict';module.exports=()=>({translateURL:'undefined'!=typeof window&&window.location.origin||'',translatePrefix:'',fetchConfig:{},initialItems:[],request:{},storage:'undefined'!=typeof window&&'localStorage'in window&&window.localStorage||{},persist:!0,override:!1,storagePrefix:'zotero-bib'});

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

//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJub2RlX21vZHVsZXMvcGFyc2UtbGluay1oZWFkZXIvaW5kZXguanMiLCJub2RlX21vZHVsZXMvcHVueWNvZGUvcHVueWNvZGUuanMiLCJub2RlX21vZHVsZXMvcXVlcnlzdHJpbmctZXMzL2RlY29kZS5qcyIsIm5vZGVfbW9kdWxlcy9xdWVyeXN0cmluZy1lczMvZW5jb2RlLmpzIiwibm9kZV9tb2R1bGVzL3F1ZXJ5c3RyaW5nLWVzMy9pbmRleC5qcyIsIm5vZGVfbW9kdWxlcy91cmwvdXJsLmpzIiwibm9kZV9tb2R1bGVzL3VybC91dGlsLmpzIiwibm9kZV9tb2R1bGVzL3h0ZW5kL2ltbXV0YWJsZS5qcyIsIm5vZGVfbW9kdWxlcy96b3Rlcm8tYmFzZS1tYXBwaW5ncy9pbmRleC5qcyIsInNyYy9qcy9iaWIvYmliLmpzIiwic3JjL2pzL2JpYi9kZWZhdWx0cy5qcyIsInNyYy9qcy9iaWIvdXRpbHMuanMiLCJzcmMvanMvbWFpbi5qcyIsInNyYy9qcy96b3Rlcm8tc2hpbS9jcmVhdG9yLXR5cGVzLmpzIiwic3JjL2pzL3pvdGVyby1zaGltL2NzbC1tYXBwaW5ncy5qcyIsInNyYy9qcy96b3Rlcm8tc2hpbS9kYXRlLXRvLXNxbC5qcyIsInNyYy9qcy96b3Rlcm8tc2hpbS9kZWZhdWx0LWl0ZW0tdHlwZS1jcmVhdG9yLXR5cGUtbG9va3VwLmpzIiwic3JjL2pzL3pvdGVyby1zaGltL2ZpZWxkcy5qcyIsInNyYy9qcy96b3Rlcm8tc2hpbS9pdGVtLXRvLWNzbC1qc29uLmpzIiwic3JjL2pzL3pvdGVyby1zaGltL2l0ZW0tdHlwZXMuanMiLCJzcmMvanMvem90ZXJvLXNoaW0vbHBhZC5qcyIsInNyYy9qcy96b3Rlcm8tc2hpbS9zdHItdG8tZGF0ZS5qcyIsInNyYy9qcy96b3Rlcm8tc2hpbS90eXBlLXNwZWNpZmljLWZpZWxkLW1hcC5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7O0FDeERBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7OztBQ3JoQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDcEZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDckZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDSkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7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ImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uKCl7ZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3ZhciBmPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIik7dGhyb3cgZi5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGZ9dmFyIGw9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGwuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sbCxsLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9cmV0dXJuIGV9KSgpIiwiJ3VzZSBzdHJpY3QnO1xuXG52YXIgcXMgPSByZXF1aXJlKCdxdWVyeXN0cmluZycpXG4gICwgdXJsID0gcmVxdWlyZSgndXJsJylcbiAgLCB4dGVuZCA9IHJlcXVpcmUoJ3h0ZW5kJyk7XG5cbmZ1bmN0aW9uIGhhc1JlbCh4KSB7XG4gIHJldHVybiB4ICYmIHgucmVsO1xufVxuXG5mdW5jdGlvbiBpbnRvUmVscyAoYWNjLCB4KSB7XG4gIGZ1bmN0aW9uIHNwbGl0UmVsIChyZWwpIHtcbiAgICBhY2NbcmVsXSA9IHh0ZW5kKHgsIHsgcmVsOiByZWwgfSk7XG4gIH1cblxuICB4LnJlbC5zcGxpdCgvXFxzKy8pLmZvckVhY2goc3BsaXRSZWwpO1xuXG4gIHJldHVybiBhY2M7XG59XG5cbmZ1bmN0aW9uIGNyZWF0ZU9iamVjdHMgKGFjYywgcCkge1xuICAvLyByZWw9XCJuZXh0XCIgPT4gMTogcmVsIDI6IG5leHRcbiAgdmFyIG0gPSBwLm1hdGNoKC9cXHMqKC4rKVxccyo9XFxzKlwiPyhbXlwiXSspXCI/LylcbiAgaWYgKG0pIGFjY1ttWzFdXSA9IG1bMl07XG4gIHJldHVybiBhY2M7XG59XG5cbmZ1bmN0aW9uIHBhcnNlTGluayhsaW5rKSB7XG4gIHRyeSB7XG4gICAgdmFyIG0gICAgICAgICA9ICBsaW5rLm1hdGNoKC88PyhbXj5dKik+KC4qKS8pXG4gICAgICAsIGxpbmtVcmwgICA9ICBtWzFdXG4gICAgICAsIHBhcnRzICAgICA9ICBtWzJdLnNwbGl0KCc7JylcbiAgICAgICwgcGFyc2VkVXJsID0gIHVybC5wYXJzZShsaW5rVXJsKVxuICAgICAgLCBxcnkgICAgICAgPSAgcXMucGFyc2UocGFyc2VkVXJsLnF1ZXJ5KTtcblxuICAgIHBhcnRzLnNoaWZ0KCk7XG5cbiAgICB2YXIgaW5mbyA9IHBhcnRzXG4gICAgICAucmVkdWNlKGNyZWF0ZU9iamVjdHMsIHt9KTtcbiAgICBcbiAgICBpbmZvID0geHRlbmQocXJ5LCBpbmZvKTtcbiAgICBpbmZvLnVybCA9IGxpbmtVcmw7XG4gICAgcmV0dXJuIGluZm87XG4gIH0gY2F0Y2ggKGUpIHtcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxufVxuXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIChsaW5rSGVhZGVyKSB7XG4gIGlmICghbGlua0hlYWRlcikgcmV0dXJuIG51bGw7XG5cbiAgcmV0dXJuIGxpbmtIZWFkZXIuc3BsaXQoLyxcXHMqPC8pXG4gICAubWFwKHBhcnNlTGluaylcbiAgIC5maWx0ZXIoaGFzUmVsKVxuICAgLnJlZHVjZShpbnRvUmVscywge30pO1xufTtcbiIsIi8qISBodHRwczovL210aHMuYmUvcHVueWNvZGUgdjEuNC4xIGJ5IEBtYXRoaWFzICovXG47KGZ1bmN0aW9uKHJvb3QpIHtcblxuXHQvKiogRGV0ZWN0IGZyZWUgdmFyaWFibGVzICovXG5cdHZhciBmcmVlRXhwb3J0cyA9IHR5cGVvZiBleHBvcnRzID09ICdvYmplY3QnICYmIGV4cG9ydHMgJiZcblx0XHQhZXhwb3J0cy5ub2RlVHlwZSAmJiBleHBvcnRzO1xuXHR2YXIgZnJlZU1vZHVsZSA9IHR5cGVvZiBtb2R1bGUgPT0gJ29iamVjdCcgJiYgbW9kdWxlICYmXG5cdFx0IW1vZHVsZS5ub2RlVHlwZSAmJiBtb2R1bGU7XG5cdHZhciBmcmVlR2xvYmFsID0gdHlwZW9mIGdsb2JhbCA9PSAnb2JqZWN0JyAmJiBnbG9iYWw7XG5cdGlmIChcblx0XHRmcmVlR2xvYmFsLmdsb2JhbCA9PT0gZnJlZUdsb2JhbCB8fFxuXHRcdGZyZWVHbG9iYWwud2luZG93ID09PSBmcmVlR2xvYmFsIHx8XG5cdFx0ZnJlZUdsb2JhbC5zZWxmID09PSBmcmVlR2xvYmFsXG5cdCkge1xuXHRcdHJvb3QgPSBmcmVlR2xvYmFsO1xuXHR9XG5cblx0LyoqXG5cdCAqIFRoZSBgcHVueWNvZGVgIG9iamVjdC5cblx0ICogQG5hbWUgcHVueWNvZGVcblx0ICogQHR5cGUgT2JqZWN0XG5cdCAqL1xuXHR2YXIgcHVueWNvZGUsXG5cblx0LyoqIEhpZ2hlc3QgcG9zaXRpdmUgc2lnbmVkIDMyLWJpdCBmbG9hdCB2YWx1ZSAqL1xuXHRtYXhJbnQgPSAyMTQ3NDgzNjQ3LCAvLyBha2EuIDB4N0ZGRkZGRkYgb3IgMl4zMS0xXG5cblx0LyoqIEJvb3RzdHJpbmcgcGFyYW1ldGVycyAqL1xuXHRiYXNlID0gMzYsXG5cdHRNaW4gPSAxLFxuXHR0TWF4ID0gMjYsXG5cdHNrZXcgPSAzOCxcblx0ZGFtcCA9IDcwMCxcblx0aW5pdGlhbEJpYXMgPSA3Mixcblx0aW5pdGlhbE4gPSAxMjgsIC8vIDB4ODBcblx0ZGVsaW1pdGVyID0gJy0nLCAvLyAnXFx4MkQnXG5cblx0LyoqIFJlZ3VsYXIgZXhwcmVzc2lvbnMgKi9cblx0cmVnZXhQdW55Y29kZSA9IC9eeG4tLS8sXG5cdHJlZ2V4Tm9uQVNDSUkgPSAvW15cXHgyMC1cXHg3RV0vLCAvLyB1bnByaW50YWJsZSBBU0NJSSBjaGFycyArIG5vbi1BU0NJSSBjaGFyc1xuXHRyZWdleFNlcGFyYXRvcnMgPSAvW1xceDJFXFx1MzAwMlxcdUZGMEVcXHVGRjYxXS9nLCAvLyBSRkMgMzQ5MCBzZXBhcmF0b3JzXG5cblx0LyoqIEVycm9yIG1lc3NhZ2VzICovXG5cdGVycm9ycyA9IHtcblx0XHQnb3ZlcmZsb3cnOiAnT3ZlcmZsb3c6IGlucHV0IG5lZWRzIHdpZGVyIGludGVnZXJzIHRvIHByb2Nlc3MnLFxuXHRcdCdub3QtYmFzaWMnOiAnSWxsZWdhbCBpbnB1dCA+PSAweDgwIChub3QgYSBiYXNpYyBjb2RlIHBvaW50KScsXG5cdFx0J2ludmFsaWQtaW5wdXQnOiAnSW52YWxpZCBpbnB1dCdcblx0fSxcblxuXHQvKiogQ29udmVuaWVuY2Ugc2hvcnRjdXRzICovXG5cdGJhc2VNaW51c1RNaW4gPSBiYXNlIC0gdE1pbixcblx0Zmxvb3IgPSBNYXRoLmZsb29yLFxuXHRzdHJpbmdGcm9tQ2hhckNvZGUgPSBTdHJpbmcuZnJvbUNoYXJDb2RlLFxuXG5cdC8qKiBUZW1wb3JhcnkgdmFyaWFibGUgKi9cblx0a2V5O1xuXG5cdC8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5cdC8qKlxuXHQgKiBBIGdlbmVyaWMgZXJyb3IgdXRpbGl0eSBmdW5jdGlvbi5cblx0ICogQHByaXZhdGVcblx0ICogQHBhcmFtIHtTdHJpbmd9IHR5cGUgVGhlIGVycm9yIHR5cGUuXG5cdCAqIEByZXR1cm5zIHtFcnJvcn0gVGhyb3dzIGEgYFJhbmdlRXJyb3JgIHdpdGggdGhlIGFwcGxpY2FibGUgZXJyb3IgbWVzc2FnZS5cblx0ICovXG5cdGZ1bmN0aW9uIGVycm9yKHR5cGUpIHtcblx0XHR0aHJvdyBuZXcgUmFuZ2VFcnJvcihlcnJvcnNbdHlwZV0pO1xuXHR9XG5cblx0LyoqXG5cdCAqIEEgZ2VuZXJpYyBgQXJyYXkjbWFwYCB1dGlsaXR5IGZ1bmN0aW9uLlxuXHQgKiBAcHJpdmF0ZVxuXHQgKiBAcGFyYW0ge0FycmF5fSBhcnJheSBUaGUgYXJyYXkgdG8gaXRlcmF0ZSBvdmVyLlxuXHQgKiBAcGFyYW0ge0Z1bmN0aW9ufSBjYWxsYmFjayBUaGUgZnVuY3Rpb24gdGhhdCBnZXRzIGNhbGxlZCBmb3IgZXZlcnkgYXJyYXlcblx0ICogaXRlbS5cblx0ICogQHJldHVybnMge0FycmF5fSBBIG5ldyBhcnJheSBvZiB2YWx1ZXMgcmV0dXJuZWQgYnkgdGhlIGNhbGxiYWNrIGZ1bmN0aW9uLlxuXHQgKi9cblx0ZnVuY3Rpb24gbWFwKGFycmF5LCBmbikge1xuXHRcdHZhciBsZW5ndGggPSBhcnJheS5sZW5ndGg7XG5cdFx0dmFyIHJlc3VsdCA9IFtdO1xuXHRcdHdoaWxlIChsZW5ndGgtLSkge1xuXHRcdFx0cmVzdWx0W2xlbmd0aF0gPSBmbihhcnJheVtsZW5ndGhdKTtcblx0XHR9XG5cdFx0cmV0dXJuIHJlc3VsdDtcblx0fVxuXG5cdC8qKlxuXHQgKiBBIHNpbXBsZSBgQXJyYXkjbWFwYC1saWtlIHdyYXBwZXIgdG8gd29yayB3aXRoIGRvbWFpbiBuYW1lIHN0cmluZ3Mgb3IgZW1haWxcblx0ICogYWRkcmVzc2VzLlxuXHQgKiBAcHJpdmF0ZVxuXHQgKiBAcGFyYW0ge1N0cmluZ30gZG9tYWluIFRoZSBkb21haW4gbmFtZSBvciBlbWFpbCBhZGRyZXNzLlxuXHQgKiBAcGFyYW0ge0Z1bmN0aW9ufSBjYWxsYmFjayBUaGUgZnVuY3Rpb24gdGhhdCBnZXRzIGNhbGxlZCBmb3IgZXZlcnlcblx0ICogY2hhcmFjdGVyLlxuXHQgKiBAcmV0dXJucyB7QXJyYXl9IEEgbmV3IHN0cmluZyBvZiBjaGFyYWN0ZXJzIHJldHVybmVkIGJ5IHRoZSBjYWxsYmFja1xuXHQgKiBmdW5jdGlvbi5cblx0ICovXG5cdGZ1bmN0aW9uIG1hcERvbWFpbihzdHJpbmcsIGZuKSB7XG5cdFx0dmFyIHBhcnRzID0gc3RyaW5nLnNwbGl0KCdAJyk7XG5cdFx0dmFyIHJlc3VsdCA9ICcnO1xuXHRcdGlmIChwYXJ0cy5sZW5ndGggPiAxKSB7XG5cdFx0XHQvLyBJbiBlbWFpbCBhZGRyZXNzZXMsIG9ubHkgdGhlIGRvbWFpbiBuYW1lIHNob3VsZCBiZSBwdW55Y29kZWQuIExlYXZlXG5cdFx0XHQvLyB0aGUgbG9jYWwgcGFydCAoaS5lLiBldmVyeXRoaW5nIHVwIHRvIGBAYCkgaW50YWN0LlxuXHRcdFx0cmVzdWx0ID0gcGFydHNbMF0gKyAnQCc7XG5cdFx0XHRzdHJpbmcgPSBwYXJ0c1sxXTtcblx0XHR9XG5cdFx0Ly8gQXZvaWQgYHNwbGl0KHJlZ2V4KWAgZm9yIElFOCBjb21wYXRpYmlsaXR5LiBTZWUgIzE3LlxuXHRcdHN0cmluZyA9IHN0cmluZy5yZXBsYWNlKHJlZ2V4U2VwYXJhdG9ycywgJ1xceDJFJyk7XG5cdFx0dmFyIGxhYmVscyA9IHN0cmluZy5zcGxpdCgnLicpO1xuXHRcdHZhciBlbmNvZGVkID0gbWFwKGxhYmVscywgZm4pLmpvaW4oJy4nKTtcblx0XHRyZXR1cm4gcmVzdWx0ICsgZW5jb2RlZDtcblx0fVxuXG5cdC8qKlxuXHQgKiBDcmVhdGVzIGFuIGFycmF5IGNvbnRhaW5pbmcgdGhlIG51bWVyaWMgY29kZSBwb2ludHMgb2YgZWFjaCBVbmljb2RlXG5cdCAqIGNoYXJhY3RlciBpbiB0aGUgc3RyaW5nLiBXaGlsZSBKYXZhU2NyaXB0IHVzZXMgVUNTLTIgaW50ZXJuYWxseSxcblx0ICogdGhpcyBmdW5jdGlvbiB3aWxsIGNvbnZlcnQgYSBwYWlyIG9mIHN1cnJvZ2F0ZSBoYWx2ZXMgKGVhY2ggb2Ygd2hpY2hcblx0ICogVUNTLTIgZXhwb3NlcyBhcyBzZXBhcmF0ZSBjaGFyYWN0ZXJzKSBpbnRvIGEgc2luZ2xlIGNvZGUgcG9pbnQsXG5cdCAqIG1hdGNoaW5nIFVURi0xNi5cblx0ICogQHNlZSBgcHVueWNvZGUudWNzMi5lbmNvZGVgXG5cdCAqIEBzZWUgPGh0dHBzOi8vbWF0aGlhc2J5bmVucy5iZS9ub3Rlcy9qYXZhc2NyaXB0LWVuY29kaW5nPlxuXHQgKiBAbWVtYmVyT2YgcHVueWNvZGUudWNzMlxuXHQgKiBAbmFtZSBkZWNvZGVcblx0ICogQHBhcmFtIHtTdHJpbmd9IHN0cmluZyBUaGUgVW5pY29kZSBpbnB1dCBzdHJpbmcgKFVDUy0yKS5cblx0ICogQHJldHVybnMge0FycmF5fSBUaGUgbmV3IGFycmF5IG9mIGNvZGUgcG9pbnRzLlxuXHQgKi9cblx0ZnVuY3Rpb24gdWNzMmRlY29kZShzdHJpbmcpIHtcblx0XHR2YXIgb3V0cHV0ID0gW10sXG5cdFx0ICAgIGNvdW50ZXIgPSAwLFxuXHRcdCAgICBsZW5ndGggPSBzdHJpbmcubGVuZ3RoLFxuXHRcdCAgICB2YWx1ZSxcblx0XHQgICAgZXh0cmE7XG5cdFx0d2hpbGUgKGNvdW50ZXIgPCBsZW5ndGgpIHtcblx0XHRcdHZhbHVlID0gc3RyaW5nLmNoYXJDb2RlQXQoY291bnRlcisrKTtcblx0XHRcdGlmICh2YWx1ZSA+PSAweEQ4MDAgJiYgdmFsdWUgPD0gMHhEQkZGICYmIGNvdW50ZXIgPCBsZW5ndGgpIHtcblx0XHRcdFx0Ly8gaGlnaCBzdXJyb2dhdGUsIGFuZCB0aGVyZSBpcyBhIG5leHQgY2hhcmFjdGVyXG5cdFx0XHRcdGV4dHJhID0gc3RyaW5nLmNoYXJDb2RlQXQoY291bnRlcisrKTtcblx0XHRcdFx0aWYgKChleHRyYSAmIDB4RkMwMCkgPT0gMHhEQzAwKSB7IC8vIGxvdyBzdXJyb2dhdGVcblx0XHRcdFx0XHRvdXRwdXQucHVzaCgoKHZhbHVlICYgMHgzRkYpIDw8IDEwKSArIChleHRyYSAmIDB4M0ZGKSArIDB4MTAwMDApO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdC8vIHVubWF0Y2hlZCBzdXJyb2dhdGU7IG9ubHkgYXBwZW5kIHRoaXMgY29kZSB1bml0LCBpbiBjYXNlIHRoZSBuZXh0XG5cdFx0XHRcdFx0Ly8gY29kZSB1bml0IGlzIHRoZSBoaWdoIHN1cnJvZ2F0ZSBvZiBhIHN1cnJvZ2F0ZSBwYWlyXG5cdFx0XHRcdFx0b3V0cHV0LnB1c2godmFsdWUpO1xuXHRcdFx0XHRcdGNvdW50ZXItLTtcblx0XHRcdFx0fVxuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0b3V0cHV0LnB1c2godmFsdWUpO1xuXHRcdFx0fVxuXHRcdH1cblx0XHRyZXR1cm4gb3V0cHV0O1xuXHR9XG5cblx0LyoqXG5cdCAqIENyZWF0ZXMgYSBzdHJpbmcgYmFzZWQgb24gYW4gYXJyYXkgb2YgbnVtZXJpYyBjb2RlIHBvaW50cy5cblx0ICogQHNlZSBgcHVueWNvZGUudWNzMi5kZWNvZGVgXG5cdCAqIEBtZW1iZXJPZiBwdW55Y29kZS51Y3MyXG5cdCAqIEBuYW1lIGVuY29kZVxuXHQgKiBAcGFyYW0ge0FycmF5fSBjb2RlUG9pbnRzIFRoZSBhcnJheSBvZiBudW1lcmljIGNvZGUgcG9pbnRzLlxuXHQgKiBAcmV0dXJucyB7U3RyaW5nfSBUaGUgbmV3IFVuaWNvZGUgc3RyaW5nIChVQ1MtMikuXG5cdCAqL1xuXHRmdW5jdGlvbiB1Y3MyZW5jb2RlKGFycmF5KSB7XG5cdFx0cmV0dXJuIG1hcChhcnJheSwgZnVuY3Rpb24odmFsdWUpIHtcblx0XHRcdHZhciBvdXRwdXQgPSAnJztcblx0XHRcdGlmICh2YWx1ZSA+IDB4RkZGRikge1xuXHRcdFx0XHR2YWx1ZSAtPSAweDEwMDAwO1xuXHRcdFx0XHRvdXRwdXQgKz0gc3RyaW5nRnJvbUNoYXJDb2RlKHZhbHVlID4+PiAxMCAmIDB4M0ZGIHwgMHhEODAwKTtcblx0XHRcdFx0dmFsdWUgPSAweERDMDAgfCB2YWx1ZSAmIDB4M0ZGO1xuXHRcdFx0fVxuXHRcdFx0b3V0cHV0ICs9IHN0cmluZ0Zyb21DaGFyQ29kZSh2YWx1ZSk7XG5cdFx0XHRyZXR1cm4gb3V0cHV0O1xuXHRcdH0pLmpvaW4oJycpO1xuXHR9XG5cblx0LyoqXG5cdCAqIENvbnZlcnRzIGEgYmFzaWMgY29kZSBwb2ludCBpbnRvIGEgZGlnaXQvaW50ZWdlci5cblx0ICogQHNlZSBgZGlnaXRUb0Jhc2ljKClgXG5cdCAqIEBwcml2YXRlXG5cdCAqIEBwYXJhbSB7TnVtYmVyfSBjb2RlUG9pbnQgVGhlIGJhc2ljIG51bWVyaWMgY29kZSBwb2ludCB2YWx1ZS5cblx0ICogQHJldHVybnMge051bWJlcn0gVGhlIG51bWVyaWMgdmFsdWUgb2YgYSBiYXNpYyBjb2RlIHBvaW50IChmb3IgdXNlIGluXG5cdCAqIHJlcHJlc2VudGluZyBpbnRlZ2VycykgaW4gdGhlIHJhbmdlIGAwYCB0byBgYmFzZSAtIDFgLCBvciBgYmFzZWAgaWZcblx0ICogdGhlIGNvZGUgcG9pbnQgZG9lcyBub3QgcmVwcmVzZW50IGEgdmFsdWUuXG5cdCAqL1xuXHRmdW5jdGlvbiBiYXNpY1RvRGlnaXQoY29kZVBvaW50KSB7XG5cdFx0aWYgKGNvZGVQb2ludCAtIDQ4IDwgMTApIHtcblx0XHRcdHJldHVybiBjb2RlUG9pbnQgLSAyMjtcblx0XHR9XG5cdFx0aWYgKGNvZGVQb2ludCAtIDY1IDwgMjYpIHtcblx0XHRcdHJldHVybiBjb2RlUG9pbnQgLSA2NTtcblx0XHR9XG5cdFx0aWYgKGNvZGVQb2ludCAtIDk3IDwgMjYpIHtcblx0XHRcdHJldHVybiBjb2RlUG9pbnQgLSA5Nztcblx0XHR9XG5cdFx0cmV0dXJuIGJhc2U7XG5cdH1cblxuXHQvKipcblx0ICogQ29udmVydHMgYSBkaWdpdC9pbnRlZ2VyIGludG8gYSBiYXNpYyBjb2RlIHBvaW50LlxuXHQgKiBAc2VlIGBiYXNpY1RvRGlnaXQoKWBcblx0ICogQHByaXZhdGVcblx0ICogQHBhcmFtIHtOdW1iZXJ9IGRpZ2l0IFRoZSBudW1lcmljIHZhbHVlIG9mIGEgYmFzaWMgY29kZSBwb2ludC5cblx0ICogQHJldHVybnMge051bWJlcn0gVGhlIGJhc2ljIGNvZGUgcG9pbnQgd2hvc2UgdmFsdWUgKHdoZW4gdXNlZCBmb3Jcblx0ICogcmVwcmVzZW50aW5nIGludGVnZXJzKSBpcyBgZGlnaXRgLCB3aGljaCBuZWVkcyB0byBiZSBpbiB0aGUgcmFuZ2Vcblx0ICogYDBgIHRvIGBiYXNlIC0gMWAuIElmIGBmbGFnYCBpcyBub24temVybywgdGhlIHVwcGVyY2FzZSBmb3JtIGlzXG5cdCAqIHVzZWQ7IGVsc2UsIHRoZSBsb3dlcmNhc2UgZm9ybSBpcyB1c2VkLiBUaGUgYmVoYXZpb3IgaXMgdW5kZWZpbmVkXG5cdCAqIGlmIGBmbGFnYCBpcyBub24temVybyBhbmQgYGRpZ2l0YCBoYXMgbm8gdXBwZXJjYXNlIGZvcm0uXG5cdCAqL1xuXHRmdW5jdGlvbiBkaWdpdFRvQmFzaWMoZGlnaXQsIGZsYWcpIHtcblx0XHQvLyAgMC4uMjUgbWFwIHRvIEFTQ0lJIGEuLnogb3IgQS4uWlxuXHRcdC8vIDI2Li4zNSBtYXAgdG8gQVNDSUkgMC4uOVxuXHRcdHJldHVybiBkaWdpdCArIDIyICsgNzUgKiAoZGlnaXQgPCAyNikgLSAoKGZsYWcgIT0gMCkgPDwgNSk7XG5cdH1cblxuXHQvKipcblx0ICogQmlhcyBhZGFwdGF0aW9uIGZ1bmN0aW9uIGFzIHBlciBzZWN0aW9uIDMuNCBvZiBSRkMgMzQ5Mi5cblx0ICogaHR0cHM6Ly90b29scy5pZXRmLm9yZy9odG1sL3JmYzM0OTIjc2VjdGlvbi0zLjRcblx0ICogQHByaXZhdGVcblx0ICovXG5cdGZ1bmN0aW9uIGFkYXB0KGRlbHRhLCBudW1Qb2ludHMsIGZpcnN0VGltZSkge1xuXHRcdHZhciBrID0gMDtcblx0XHRkZWx0YSA9IGZpcnN0VGltZSA/IGZsb29yKGRlbHRhIC8gZGFtcCkgOiBkZWx0YSA+PiAxO1xuXHRcdGRlbHRhICs9IGZsb29yKGRlbHRhIC8gbnVtUG9pbnRzKTtcblx0XHRmb3IgKC8qIG5vIGluaXRpYWxpemF0aW9uICovOyBkZWx0YSA+IGJhc2VNaW51c1RNaW4gKiB0TWF4ID4+IDE7IGsgKz0gYmFzZSkge1xuXHRcdFx0ZGVsdGEgPSBmbG9vcihkZWx0YSAvIGJhc2VNaW51c1RNaW4pO1xuXHRcdH1cblx0XHRyZXR1cm4gZmxvb3IoayArIChiYXNlTWludXNUTWluICsgMSkgKiBkZWx0YSAvIChkZWx0YSArIHNrZXcpKTtcblx0fVxuXG5cdC8qKlxuXHQgKiBDb252ZXJ0cyBhIFB1bnljb2RlIHN0cmluZyBvZiBBU0NJSS1vbmx5IHN5bWJvbHMgdG8gYSBzdHJpbmcgb2YgVW5pY29kZVxuXHQgKiBzeW1ib2xzLlxuXHQgKiBAbWVtYmVyT2YgcHVueWNvZGVcblx0ICogQHBhcmFtIHtTdHJpbmd9IGlucHV0IFRoZSBQdW55Y29kZSBzdHJpbmcgb2YgQVNDSUktb25seSBzeW1ib2xzLlxuXHQgKiBAcmV0dXJucyB7U3RyaW5nfSBUaGUgcmVzdWx0aW5nIHN0cmluZyBvZiBVbmljb2RlIHN5bWJvbHMuXG5cdCAqL1xuXHRmdW5jdGlvbiBkZWNvZGUoaW5wdXQpIHtcblx0XHQvLyBEb24ndCB1c2UgVUNTLTJcblx0XHR2YXIgb3V0cHV0ID0gW10sXG5cdFx0ICAgIGlucHV0TGVuZ3RoID0gaW5wdXQubGVuZ3RoLFxuXHRcdCAgICBvdXQsXG5cdFx0ICAgIGkgPSAwLFxuXHRcdCAgICBuID0gaW5pdGlhbE4sXG5cdFx0ICAgIGJpYXMgPSBpbml0aWFsQmlhcyxcblx0XHQgICAgYmFzaWMsXG5cdFx0ICAgIGosXG5cdFx0ICAgIGluZGV4LFxuXHRcdCAgICBvbGRpLFxuXHRcdCAgICB3LFxuXHRcdCAgICBrLFxuXHRcdCAgICBkaWdpdCxcblx0XHQgICAgdCxcblx0XHQgICAgLyoqIENhY2hlZCBjYWxjdWxhdGlvbiByZXN1bHRzICovXG5cdFx0ICAgIGJhc2VNaW51c1Q7XG5cblx0XHQvLyBIYW5kbGUgdGhlIGJhc2ljIGNvZGUgcG9pbnRzOiBsZXQgYGJhc2ljYCBiZSB0aGUgbnVtYmVyIG9mIGlucHV0IGNvZGVcblx0XHQvLyBwb2ludHMgYmVmb3JlIHRoZSBsYXN0IGRlbGltaXRlciwgb3IgYDBgIGlmIHRoZXJlIGlzIG5vbmUsIHRoZW4gY29weVxuXHRcdC8vIHRoZSBmaXJzdCBiYXNpYyBjb2RlIHBvaW50cyB0byB0aGUgb3V0cHV0LlxuXG5cdFx0YmFzaWMgPSBpbnB1dC5sYXN0SW5kZXhPZihkZWxpbWl0ZXIpO1xuXHRcdGlmIChiYXNpYyA8IDApIHtcblx0XHRcdGJhc2ljID0gMDtcblx0XHR9XG5cblx0XHRmb3IgKGogPSAwOyBqIDwgYmFzaWM7ICsraikge1xuXHRcdFx0Ly8gaWYgaXQncyBub3QgYSBiYXNpYyBjb2RlIHBvaW50XG5cdFx0XHRpZiAoaW5wdXQuY2hhckNvZGVBdChqKSA+PSAweDgwKSB7XG5cdFx0XHRcdGVycm9yKCdub3QtYmFzaWMnKTtcblx0XHRcdH1cblx0XHRcdG91dHB1dC5wdXNoKGlucHV0LmNoYXJDb2RlQXQoaikpO1xuXHRcdH1cblxuXHRcdC8vIE1haW4gZGVjb2RpbmcgbG9vcDogc3RhcnQganVzdCBhZnRlciB0aGUgbGFzdCBkZWxpbWl0ZXIgaWYgYW55IGJhc2ljIGNvZGVcblx0XHQvLyBwb2ludHMgd2VyZSBjb3BpZWQ7IHN0YXJ0IGF0IHRoZSBiZWdpbm5pbmcgb3RoZXJ3aXNlLlxuXG5cdFx0Zm9yIChpbmRleCA9IGJhc2ljID4gMCA/IGJhc2ljICsgMSA6IDA7IGluZGV4IDwgaW5wdXRMZW5ndGg7IC8qIG5vIGZpbmFsIGV4cHJlc3Npb24gKi8pIHtcblxuXHRcdFx0Ly8gYGluZGV4YCBpcyB0aGUgaW5kZXggb2YgdGhlIG5leHQgY2hhcmFjdGVyIHRvIGJlIGNvbnN1bWVkLlxuXHRcdFx0Ly8gRGVjb2RlIGEgZ2VuZXJhbGl6ZWQgdmFyaWFibGUtbGVuZ3RoIGludGVnZXIgaW50byBgZGVsdGFgLFxuXHRcdFx0Ly8gd2hpY2ggZ2V0cyBhZGRlZCB0byBgaWAuIFRoZSBvdmVyZmxvdyBjaGVja2luZyBpcyBlYXNpZXJcblx0XHRcdC8vIGlmIHdlIGluY3JlYXNlIGBpYCBhcyB3ZSBnbywgdGhlbiBzdWJ0cmFjdCBvZmYgaXRzIHN0YXJ0aW5nXG5cdFx0XHQvLyB2YWx1ZSBhdCB0aGUgZW5kIHRvIG9idGFpbiBgZGVsdGFgLlxuXHRcdFx0Zm9yIChvbGRpID0gaSwgdyA9IDEsIGsgPSBiYXNlOyAvKiBubyBjb25kaXRpb24gKi87IGsgKz0gYmFzZSkge1xuXG5cdFx0XHRcdGlmIChpbmRleCA+PSBpbnB1dExlbmd0aCkge1xuXHRcdFx0XHRcdGVycm9yKCdpbnZhbGlkLWlucHV0Jyk7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRkaWdpdCA9IGJhc2ljVG9EaWdpdChpbnB1dC5jaGFyQ29kZUF0KGluZGV4KyspKTtcblxuXHRcdFx0XHRpZiAoZGlnaXQgPj0gYmFzZSB8fCBkaWdpdCA+IGZsb29yKChtYXhJbnQgLSBpKSAvIHcpKSB7XG5cdFx0XHRcdFx0ZXJyb3IoJ292ZXJmbG93Jyk7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRpICs9IGRpZ2l0ICogdztcblx0XHRcdFx0dCA9IGsgPD0gYmlhcyA/IHRNaW4gOiAoayA+PSBiaWFzICsgdE1heCA/IHRNYXggOiBrIC0gYmlhcyk7XG5cblx0XHRcdFx0aWYgKGRpZ2l0IDwgdCkge1xuXHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0YmFzZU1pbnVzVCA9IGJhc2UgLSB0O1xuXHRcdFx0XHRpZiAodyA+IGZsb29yKG1heEludCAvIGJhc2VNaW51c1QpKSB7XG5cdFx0XHRcdFx0ZXJyb3IoJ292ZXJmbG93Jyk7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHR3ICo9IGJhc2VNaW51c1Q7XG5cblx0XHRcdH1cblxuXHRcdFx0b3V0ID0gb3V0cHV0Lmxlbmd0aCArIDE7XG5cdFx0XHRiaWFzID0gYWRhcHQoaSAtIG9sZGksIG91dCwgb2xkaSA9PSAwKTtcblxuXHRcdFx0Ly8gYGlgIHdhcyBzdXBwb3NlZCB0byB3cmFwIGFyb3VuZCBmcm9tIGBvdXRgIHRvIGAwYCxcblx0XHRcdC8vIGluY3JlbWVudGluZyBgbmAgZWFjaCB0aW1lLCBzbyB3ZSdsbCBmaXggdGhhdCBub3c6XG5cdFx0XHRpZiAoZmxvb3IoaSAvIG91dCkgPiBtYXhJbnQgLSBuKSB7XG5cdFx0XHRcdGVycm9yKCdvdmVyZmxvdycpO1xuXHRcdFx0fVxuXG5cdFx0XHRuICs9IGZsb29yKGkgLyBvdXQpO1xuXHRcdFx0aSAlPSBvdXQ7XG5cblx0XHRcdC8vIEluc2VydCBgbmAgYXQgcG9zaXRpb24gYGlgIG9mIHRoZSBvdXRwdXRcblx0XHRcdG91dHB1dC5zcGxpY2UoaSsrLCAwLCBuKTtcblxuXHRcdH1cblxuXHRcdHJldHVybiB1Y3MyZW5jb2RlKG91dHB1dCk7XG5cdH1cblxuXHQvKipcblx0ICogQ29udmVydHMgYSBzdHJpbmcgb2YgVW5pY29kZSBzeW1ib2xzIChlLmcuIGEgZG9tYWluIG5hbWUgbGFiZWwpIHRvIGFcblx0ICogUHVueWNvZGUgc3RyaW5nIG9mIEFTQ0lJLW9ubHkgc3ltYm9scy5cblx0ICogQG1lbWJlck9mIHB1bnljb2RlXG5cdCAqIEBwYXJhbSB7U3RyaW5nfSBpbnB1dCBUaGUgc3RyaW5nIG9mIFVuaWNvZGUgc3ltYm9scy5cblx0ICogQHJldHVybnMge1N0cmluZ30gVGhlIHJlc3VsdGluZyBQdW55Y29kZSBzdHJpbmcgb2YgQVNDSUktb25seSBzeW1ib2xzLlxuXHQgKi9cblx0ZnVuY3Rpb24gZW5jb2RlKGlucHV0KSB7XG5cdFx0dmFyIG4sXG5cdFx0ICAgIGRlbHRhLFxuXHRcdCAgICBoYW5kbGVkQ1BDb3VudCxcblx0XHQgICAgYmFzaWNMZW5ndGgsXG5cdFx0ICAgIGJpYXMsXG5cdFx0ICAgIGosXG5cdFx0ICAgIG0sXG5cdFx0ICAgIHEsXG5cdFx0ICAgIGssXG5cdFx0ICAgIHQsXG5cdFx0ICAgIGN1cnJlbnRWYWx1ZSxcblx0XHQgICAgb3V0cHV0ID0gW10sXG5cdFx0ICAgIC8qKiBgaW5wdXRMZW5ndGhgIHdpbGwgaG9sZCB0aGUgbnVtYmVyIG9mIGNvZGUgcG9pbnRzIGluIGBpbnB1dGAuICovXG5cdFx0ICAgIGlucHV0TGVuZ3RoLFxuXHRcdCAgICAvKiogQ2FjaGVkIGNhbGN1bGF0aW9uIHJlc3VsdHMgKi9cblx0XHQgICAgaGFuZGxlZENQQ291bnRQbHVzT25lLFxuXHRcdCAgICBiYXNlTWludXNULFxuXHRcdCAgICBxTWludXNUO1xuXG5cdFx0Ly8gQ29udmVydCB0aGUgaW5wdXQgaW4gVUNTLTIgdG8gVW5pY29kZVxuXHRcdGlucHV0ID0gdWNzMmRlY29kZShpbnB1dCk7XG5cblx0XHQvLyBDYWNoZSB0aGUgbGVuZ3RoXG5cdFx0aW5wdXRMZW5ndGggPSBpbnB1dC5sZW5ndGg7XG5cblx0XHQvLyBJbml0aWFsaXplIHRoZSBzdGF0ZVxuXHRcdG4gPSBpbml0aWFsTjtcblx0XHRkZWx0YSA9IDA7XG5cdFx0YmlhcyA9IGluaXRpYWxCaWFzO1xuXG5cdFx0Ly8gSGFuZGxlIHRoZSBiYXNpYyBjb2RlIHBvaW50c1xuXHRcdGZvciAoaiA9IDA7IGogPCBpbnB1dExlbmd0aDsgKytqKSB7XG5cdFx0XHRjdXJyZW50VmFsdWUgPSBpbnB1dFtqXTtcblx0XHRcdGlmIChjdXJyZW50VmFsdWUgPCAweDgwKSB7XG5cdFx0XHRcdG91dHB1dC5wdXNoKHN0cmluZ0Zyb21DaGFyQ29kZShjdXJyZW50VmFsdWUpKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRoYW5kbGVkQ1BDb3VudCA9IGJhc2ljTGVuZ3RoID0gb3V0cHV0Lmxlbmd0aDtcblxuXHRcdC8vIGBoYW5kbGVkQ1BDb3VudGAgaXMgdGhlIG51bWJlciBvZiBjb2RlIHBvaW50cyB0aGF0IGhhdmUgYmVlbiBoYW5kbGVkO1xuXHRcdC8vIGBiYXNpY0xlbmd0aGAgaXMgdGhlIG51bWJlciBvZiBiYXNpYyBjb2RlIHBvaW50cy5cblxuXHRcdC8vIEZpbmlzaCB0aGUgYmFzaWMgc3RyaW5nIC0gaWYgaXQgaXMgbm90IGVtcHR5IC0gd2l0aCBhIGRlbGltaXRlclxuXHRcdGlmIChiYXNpY0xlbmd0aCkge1xuXHRcdFx0b3V0cHV0LnB1c2goZGVsaW1pdGVyKTtcblx0XHR9XG5cblx0XHQvLyBNYWluIGVuY29kaW5nIGxvb3A6XG5cdFx0d2hpbGUgKGhhbmRsZWRDUENvdW50IDwgaW5wdXRMZW5ndGgpIHtcblxuXHRcdFx0Ly8gQWxsIG5vbi1iYXNpYyBjb2RlIHBvaW50cyA8IG4gaGF2ZSBiZWVuIGhhbmRsZWQgYWxyZWFkeS4gRmluZCB0aGUgbmV4dFxuXHRcdFx0Ly8gbGFyZ2VyIG9uZTpcblx0XHRcdGZvciAobSA9IG1heEludCwgaiA9IDA7IGogPCBpbnB1dExlbmd0aDsgKytqKSB7XG5cdFx0XHRcdGN1cnJlbnRWYWx1ZSA9IGlucHV0W2pdO1xuXHRcdFx0XHRpZiAoY3VycmVudFZhbHVlID49IG4gJiYgY3VycmVudFZhbHVlIDwgbSkge1xuXHRcdFx0XHRcdG0gPSBjdXJyZW50VmFsdWU7XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdFx0Ly8gSW5jcmVhc2UgYGRlbHRhYCBlbm91Z2ggdG8gYWR2YW5jZSB0aGUgZGVjb2RlcidzIDxuLGk+IHN0YXRlIHRvIDxtLDA+LFxuXHRcdFx0Ly8gYnV0IGd1YXJkIGFnYWluc3Qgb3ZlcmZsb3dcblx0XHRcdGhhbmRsZWRDUENvdW50UGx1c09uZSA9IGhhbmRsZWRDUENvdW50ICsgMTtcblx0XHRcdGlmIChtIC0gbiA+IGZsb29yKChtYXhJbnQgLSBkZWx0YSkgLyBoYW5kbGVkQ1BDb3VudFBsdXNPbmUpKSB7XG5cdFx0XHRcdGVycm9yKCdvdmVyZmxvdycpO1xuXHRcdFx0fVxuXG5cdFx0XHRkZWx0YSArPSAobSAtIG4pICogaGFuZGxlZENQQ291bnRQbHVzT25lO1xuXHRcdFx0biA9IG07XG5cblx0XHRcdGZvciAoaiA9IDA7IGogPCBpbnB1dExlbmd0aDsgKytqKSB7XG5cdFx0XHRcdGN1cnJlbnRWYWx1ZSA9IGlucHV0W2pdO1xuXG5cdFx0XHRcdGlmIChjdXJyZW50VmFsdWUgPCBuICYmICsrZGVsdGEgPiBtYXhJbnQpIHtcblx0XHRcdFx0XHRlcnJvcignb3ZlcmZsb3cnKTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdGlmIChjdXJyZW50VmFsdWUgPT0gbikge1xuXHRcdFx0XHRcdC8vIFJlcHJlc2VudCBkZWx0YSBhcyBhIGdlbmVyYWxpemVkIHZhcmlhYmxlLWxlbmd0aCBpbnRlZ2VyXG5cdFx0XHRcdFx0Zm9yIChxID0gZGVsdGEsIGsgPSBiYXNlOyAvKiBubyBjb25kaXRpb24gKi87IGsgKz0gYmFzZSkge1xuXHRcdFx0XHRcdFx0dCA9IGsgPD0gYmlhcyA/IHRNaW4gOiAoayA+PSBiaWFzICsgdE1heCA/IHRNYXggOiBrIC0gYmlhcyk7XG5cdFx0XHRcdFx0XHRpZiAocSA8IHQpIHtcblx0XHRcdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRxTWludXNUID0gcSAtIHQ7XG5cdFx0XHRcdFx0XHRiYXNlTWludXNUID0gYmFzZSAtIHQ7XG5cdFx0XHRcdFx0XHRvdXRwdXQucHVzaChcblx0XHRcdFx0XHRcdFx0c3RyaW5nRnJvbUNoYXJDb2RlKGRpZ2l0VG9CYXNpYyh0ICsgcU1pbnVzVCAlIGJhc2VNaW51c1QsIDApKVxuXHRcdFx0XHRcdFx0KTtcblx0XHRcdFx0XHRcdHEgPSBmbG9vcihxTWludXNUIC8gYmFzZU1pbnVzVCk7XG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0b3V0cHV0LnB1c2goc3RyaW5nRnJvbUNoYXJDb2RlKGRpZ2l0VG9CYXNpYyhxLCAwKSkpO1xuXHRcdFx0XHRcdGJpYXMgPSBhZGFwdChkZWx0YSwgaGFuZGxlZENQQ291bnRQbHVzT25lLCBoYW5kbGVkQ1BDb3VudCA9PSBiYXNpY0xlbmd0aCk7XG5cdFx0XHRcdFx0ZGVsdGEgPSAwO1xuXHRcdFx0XHRcdCsraGFuZGxlZENQQ291bnQ7XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdFx0KytkZWx0YTtcblx0XHRcdCsrbjtcblxuXHRcdH1cblx0XHRyZXR1cm4gb3V0cHV0LmpvaW4oJycpO1xuXHR9XG5cblx0LyoqXG5cdCAqIENvbnZlcnRzIGEgUHVueWNvZGUgc3RyaW5nIHJlcHJlc2VudGluZyBhIGRvbWFpbiBuYW1lIG9yIGFuIGVtYWlsIGFkZHJlc3Ncblx0ICogdG8gVW5pY29kZS4gT25seSB0aGUgUHVueWNvZGVkIHBhcnRzIG9mIHRoZSBpbnB1dCB3aWxsIGJlIGNvbnZlcnRlZCwgaS5lLlxuXHQgKiBpdCBkb2Vzbid0IG1hdHRlciBpZiB5b3UgY2FsbCBpdCBvbiBhIHN0cmluZyB0aGF0IGhhcyBhbHJlYWR5IGJlZW5cblx0ICogY29udmVydGVkIHRvIFVuaWNvZGUuXG5cdCAqIEBtZW1iZXJPZiBwdW55Y29kZVxuXHQgKiBAcGFyYW0ge1N0cmluZ30gaW5wdXQgVGhlIFB1bnljb2RlZCBkb21haW4gbmFtZSBvciBlbWFpbCBhZGRyZXNzIHRvXG5cdCAqIGNvbnZlcnQgdG8gVW5pY29kZS5cblx0ICogQHJldHVybnMge1N0cmluZ30gVGhlIFVuaWNvZGUgcmVwcmVzZW50YXRpb24gb2YgdGhlIGdpdmVuIFB1bnljb2RlXG5cdCAqIHN0cmluZy5cblx0ICovXG5cdGZ1bmN0aW9uIHRvVW5pY29kZShpbnB1dCkge1xuXHRcdHJldHVybiBtYXBEb21haW4oaW5wdXQsIGZ1bmN0aW9uKHN0cmluZykge1xuXHRcdFx0cmV0dXJuIHJlZ2V4UHVueWNvZGUudGVzdChzdHJpbmcpXG5cdFx0XHRcdD8gZGVjb2RlKHN0cmluZy5zbGljZSg0KS50b0xvd2VyQ2FzZSgpKVxuXHRcdFx0XHQ6IHN0cmluZztcblx0XHR9KTtcblx0fVxuXG5cdC8qKlxuXHQgKiBDb252ZXJ0cyBhIFVuaWNvZGUgc3RyaW5nIHJlcHJlc2VudGluZyBhIGRvbWFpbiBuYW1lIG9yIGFuIGVtYWlsIGFkZHJlc3MgdG9cblx0ICogUHVueWNvZGUuIE9ubHkgdGhlIG5vbi1BU0NJSSBwYXJ0cyBvZiB0aGUgZG9tYWluIG5hbWUgd2lsbCBiZSBjb252ZXJ0ZWQsXG5cdCAqIGkuZS4gaXQgZG9lc24ndCBtYXR0ZXIgaWYgeW91IGNhbGwgaXQgd2l0aCBhIGRvbWFpbiB0aGF0J3MgYWxyZWFkeSBpblxuXHQgKiBBU0NJSS5cblx0ICogQG1lbWJlck9mIHB1bnljb2RlXG5cdCAqIEBwYXJhbSB7U3RyaW5nfSBpbnB1dCBUaGUgZG9tYWluIG5hbWUgb3IgZW1haWwgYWRkcmVzcyB0byBjb252ZXJ0LCBhcyBhXG5cdCAqIFVuaWNvZGUgc3RyaW5nLlxuXHQgKiBAcmV0dXJucyB7U3RyaW5nfSBUaGUgUHVueWNvZGUgcmVwcmVzZW50YXRpb24gb2YgdGhlIGdpdmVuIGRvbWFpbiBuYW1lIG9yXG5cdCAqIGVtYWlsIGFkZHJlc3MuXG5cdCAqL1xuXHRmdW5jdGlvbiB0b0FTQ0lJKGlucHV0KSB7XG5cdFx0cmV0dXJuIG1hcERvbWFpbihpbnB1dCwgZnVuY3Rpb24oc3RyaW5nKSB7XG5cdFx0XHRyZXR1cm4gcmVnZXhOb25BU0NJSS50ZXN0KHN0cmluZylcblx0XHRcdFx0PyAneG4tLScgKyBlbmNvZGUoc3RyaW5nKVxuXHRcdFx0XHQ6IHN0cmluZztcblx0XHR9KTtcblx0fVxuXG5cdC8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5cdC8qKiBEZWZpbmUgdGhlIHB1YmxpYyBBUEkgKi9cblx0cHVueWNvZGUgPSB7XG5cdFx0LyoqXG5cdFx0ICogQSBzdHJpbmcgcmVwcmVzZW50aW5nIHRoZSBjdXJyZW50IFB1bnljb2RlLmpzIHZlcnNpb24gbnVtYmVyLlxuXHRcdCAqIEBtZW1iZXJPZiBwdW55Y29kZVxuXHRcdCAqIEB0eXBlIFN0cmluZ1xuXHRcdCAqL1xuXHRcdCd2ZXJzaW9uJzogJzEuNC4xJyxcblx0XHQvKipcblx0XHQgKiBBbiBvYmplY3Qgb2YgbWV0aG9kcyB0byBjb252ZXJ0IGZyb20gSmF2YVNjcmlwdCdzIGludGVybmFsIGNoYXJhY3RlclxuXHRcdCAqIHJlcHJlc2VudGF0aW9uIChVQ1MtMikgdG8gVW5pY29kZSBjb2RlIHBvaW50cywgYW5kIGJhY2suXG5cdFx0ICogQHNlZSA8aHR0cHM6Ly9tYXRoaWFzYnluZW5zLmJlL25vdGVzL2phdmFzY3JpcHQtZW5jb2Rpbmc+XG5cdFx0ICogQG1lbWJlck9mIHB1bnljb2RlXG5cdFx0ICogQHR5cGUgT2JqZWN0XG5cdFx0ICovXG5cdFx0J3VjczInOiB7XG5cdFx0XHQnZGVjb2RlJzogdWNzMmRlY29kZSxcblx0XHRcdCdlbmNvZGUnOiB1Y3MyZW5jb2RlXG5cdFx0fSxcblx0XHQnZGVjb2RlJzogZGVjb2RlLFxuXHRcdCdlbmNvZGUnOiBlbmNvZGUsXG5cdFx0J3RvQVNDSUknOiB0b0FTQ0lJLFxuXHRcdCd0b1VuaWNvZGUnOiB0b1VuaWNvZGVcblx0fTtcblxuXHQvKiogRXhwb3NlIGBwdW55Y29kZWAgKi9cblx0Ly8gU29tZSBBTUQgYnVpbGQgb3B0aW1pemVycywgbGlrZSByLmpzLCBjaGVjayBmb3Igc3BlY2lmaWMgY29uZGl0aW9uIHBhdHRlcm5zXG5cdC8vIGxpa2UgdGhlIGZvbGxvd2luZzpcblx0aWYgKFxuXHRcdHR5cGVvZiBkZWZpbmUgPT0gJ2Z1bmN0aW9uJyAmJlxuXHRcdHR5cGVvZiBkZWZpbmUuYW1kID09ICdvYmplY3QnICYmXG5cdFx0ZGVmaW5lLmFtZFxuXHQpIHtcblx0XHRkZWZpbmUoJ3B1bnljb2RlJywgZnVuY3Rpb24oKSB7XG5cdFx0XHRyZXR1cm4gcHVueWNvZGU7XG5cdFx0fSk7XG5cdH0gZWxzZSBpZiAoZnJlZUV4cG9ydHMgJiYgZnJlZU1vZHVsZSkge1xuXHRcdGlmIChtb2R1bGUuZXhwb3J0cyA9PSBmcmVlRXhwb3J0cykge1xuXHRcdFx0Ly8gaW4gTm9kZS5qcywgaW8uanMsIG9yIFJpbmdvSlMgdjAuOC4wK1xuXHRcdFx0ZnJlZU1vZHVsZS5leHBvcnRzID0gcHVueWNvZGU7XG5cdFx0fSBlbHNlIHtcblx0XHRcdC8vIGluIE5hcndoYWwgb3IgUmluZ29KUyB2MC43LjAtXG5cdFx0XHRmb3IgKGtleSBpbiBwdW55Y29kZSkge1xuXHRcdFx0XHRwdW55Y29kZS5oYXNPd25Qcm9wZXJ0eShrZXkpICYmIChmcmVlRXhwb3J0c1trZXldID0gcHVueWNvZGVba2V5XSk7XG5cdFx0XHR9XG5cdFx0fVxuXHR9IGVsc2Uge1xuXHRcdC8vIGluIFJoaW5vIG9yIGEgd2ViIGJyb3dzZXJcblx0XHRyb290LnB1bnljb2RlID0gcHVueWNvZGU7XG5cdH1cblxufSh0aGlzKSk7XG4iLCIvLyBDb3B5cmlnaHQgSm95ZW50LCBJbmMuIGFuZCBvdGhlciBOb2RlIGNvbnRyaWJ1dG9ycy5cbi8vXG4vLyBQZXJtaXNzaW9uIGlzIGhlcmVieSBncmFudGVkLCBmcmVlIG9mIGNoYXJnZSwgdG8gYW55IHBlcnNvbiBvYnRhaW5pbmcgYVxuLy8gY29weSBvZiB0aGlzIHNvZnR3YXJlIGFuZCBhc3NvY2lhdGVkIGRvY3VtZW50YXRpb24gZmlsZXMgKHRoZVxuLy8gXCJTb2Z0d2FyZVwiKSwgdG8gZGVhbCBpbiB0aGUgU29mdHdhcmUgd2l0aG91dCByZXN0cmljdGlvbiwgaW5jbHVkaW5nXG4vLyB3aXRob3V0IGxpbWl0YXRpb24gdGhlIHJpZ2h0cyB0byB1c2UsIGNvcHksIG1vZGlmeSwgbWVyZ2UsIHB1Ymxpc2gsXG4vLyBkaXN0cmlidXRlLCBzdWJsaWNlbnNlLCBhbmQvb3Igc2VsbCBjb3BpZXMgb2YgdGhlIFNvZnR3YXJlLCBhbmQgdG8gcGVybWl0XG4vLyBwZXJzb25zIHRvIHdob20gdGhlIFNvZnR3YXJlIGlzIGZ1cm5pc2hlZCB0byBkbyBzbywgc3ViamVjdCB0byB0aGVcbi8vIGZvbGxvd2luZyBjb25kaXRpb25zOlxuLy9cbi8vIFRoZSBhYm92ZSBjb3B5cmlnaHQgbm90aWNlIGFuZCB0aGlzIHBlcm1pc3Npb24gbm90aWNlIHNoYWxsIGJlIGluY2x1ZGVkXG4vLyBpbiBhbGwgY29waWVzIG9yIHN1YnN0YW50aWFsIHBvcnRpb25zIG9mIHRoZSBTb2Z0d2FyZS5cbi8vXG4vLyBUSEUgU09GVFdBUkUgSVMgUFJPVklERUQgXCJBUyBJU1wiLCBXSVRIT1VUIFdBUlJBTlRZIE9GIEFOWSBLSU5ELCBFWFBSRVNTXG4vLyBPUiBJTVBMSUVELCBJTkNMVURJTkcgQlVUIE5PVCBMSU1JVEVEIFRPIFRIRSBXQVJSQU5USUVTIE9GXG4vLyBNRVJDSEFOVEFCSUxJVFksIEZJVE5FU1MgRk9SIEEgUEFSVElDVUxBUiBQVVJQT1NFIEFORCBOT05JTkZSSU5HRU1FTlQuIElOXG4vLyBOTyBFVkVOVCBTSEFMTCBUSEUgQVVUSE9SUyBPUiBDT1BZUklHSFQgSE9MREVSUyBCRSBMSUFCTEUgRk9SIEFOWSBDTEFJTSxcbi8vIERBTUFHRVMgT1IgT1RIRVIgTElBQklMSVRZLCBXSEVUSEVSIElOIEFOIEFDVElPTiBPRiBDT05UUkFDVCwgVE9SVCBPUlxuLy8gT1RIRVJXSVNFLCBBUklTSU5HIEZST00sIE9VVCBPRiBPUiBJTiBDT05ORUNUSU9OIFdJVEggVEhFIFNPRlRXQVJFIE9SIFRIRVxuLy8gVVNFIE9SIE9USEVSIERFQUxJTkdTIElOIFRIRSBTT0ZUV0FSRS5cblxuJ3VzZSBzdHJpY3QnO1xuXG4vLyBJZiBvYmouaGFzT3duUHJvcGVydHkgaGFzIGJlZW4gb3ZlcnJpZGRlbiwgdGhlbiBjYWxsaW5nXG4vLyBvYmouaGFzT3duUHJvcGVydHkocHJvcCkgd2lsbCBicmVhay5cbi8vIFNlZTogaHR0cHM6Ly9naXRodWIuY29tL2pveWVudC9ub2RlL2lzc3Vlcy8xNzA3XG5mdW5jdGlvbiBoYXNPd25Qcm9wZXJ0eShvYmosIHByb3ApIHtcbiAgcmV0dXJuIE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkuY2FsbChvYmosIHByb3ApO1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKHFzLCBzZXAsIGVxLCBvcHRpb25zKSB7XG4gIHNlcCA9IHNlcCB8fCAnJic7XG4gIGVxID0gZXEgfHwgJz0nO1xuICB2YXIgb2JqID0ge307XG5cbiAgaWYgKHR5cGVvZiBxcyAhPT0gJ3N0cmluZycgfHwgcXMubGVuZ3RoID09PSAwKSB7XG4gICAgcmV0dXJuIG9iajtcbiAgfVxuXG4gIHZhciByZWdleHAgPSAvXFwrL2c7XG4gIHFzID0gcXMuc3BsaXQoc2VwKTtcblxuICB2YXIgbWF4S2V5cyA9IDEwMDA7XG4gIGlmIChvcHRpb25zICYmIHR5cGVvZiBvcHRpb25zLm1heEtleXMgPT09ICdudW1iZXInKSB7XG4gICAgbWF4S2V5cyA9IG9wdGlvbnMubWF4S2V5cztcbiAgfVxuXG4gIHZhciBsZW4gPSBxcy5sZW5ndGg7XG4gIC8vIG1heEtleXMgPD0gMCBtZWFucyB0aGF0IHdlIHNob3VsZCBub3QgbGltaXQga2V5cyBjb3VudFxuICBpZiAobWF4S2V5cyA+IDAgJiYgbGVuID4gbWF4S2V5cykge1xuICAgIGxlbiA9IG1heEtleXM7XG4gIH1cblxuICBmb3IgKHZhciBpID0gMDsgaSA8IGxlbjsgKytpKSB7XG4gICAgdmFyIHggPSBxc1tpXS5yZXBsYWNlKHJlZ2V4cCwgJyUyMCcpLFxuICAgICAgICBpZHggPSB4LmluZGV4T2YoZXEpLFxuICAgICAgICBrc3RyLCB2c3RyLCBrLCB2O1xuXG4gICAgaWYgKGlkeCA+PSAwKSB7XG4gICAgICBrc3RyID0geC5zdWJzdHIoMCwgaWR4KTtcbiAgICAgIHZzdHIgPSB4LnN1YnN0cihpZHggKyAxKTtcbiAgICB9IGVsc2Uge1xuICAgICAga3N0ciA9IHg7XG4gICAgICB2c3RyID0gJyc7XG4gICAgfVxuXG4gICAgayA9IGRlY29kZVVSSUNvbXBvbmVudChrc3RyKTtcbiAgICB2ID0gZGVjb2RlVVJJQ29tcG9uZW50KHZzdHIpO1xuXG4gICAgaWYgKCFoYXNPd25Qcm9wZXJ0eShvYmosIGspKSB7XG4gICAgICBvYmpba10gPSB2O1xuICAgIH0gZWxzZSBpZiAoaXNBcnJheShvYmpba10pKSB7XG4gICAgICBvYmpba10ucHVzaCh2KTtcbiAgICB9IGVsc2Uge1xuICAgICAgb2JqW2tdID0gW29ialtrXSwgdl07XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIG9iajtcbn07XG5cbnZhciBpc0FycmF5ID0gQXJyYXkuaXNBcnJheSB8fCBmdW5jdGlvbiAoeHMpIHtcbiAgcmV0dXJuIE9iamVjdC5wcm90b3R5cGUudG9TdHJpbmcuY2FsbCh4cykgPT09ICdbb2JqZWN0IEFycmF5XSc7XG59O1xuIiwiLy8gQ29weXJpZ2h0IEpveWVudCwgSW5jLiBhbmQgb3RoZXIgTm9kZSBjb250cmlidXRvcnMuXG4vL1xuLy8gUGVybWlzc2lvbiBpcyBoZXJlYnkgZ3JhbnRlZCwgZnJlZSBvZiBjaGFyZ2UsIHRvIGFueSBwZXJzb24gb2J0YWluaW5nIGFcbi8vIGNvcHkgb2YgdGhpcyBzb2Z0d2FyZSBhbmQgYXNzb2NpYXRlZCBkb2N1bWVudGF0aW9uIGZpbGVzICh0aGVcbi8vIFwiU29mdHdhcmVcIiksIHRvIGRlYWwgaW4gdGhlIFNvZnR3YXJlIHdpdGhvdXQgcmVzdHJpY3Rpb24sIGluY2x1ZGluZ1xuLy8gd2l0aG91dCBsaW1pdGF0aW9uIHRoZSByaWdodHMgdG8gdXNlLCBjb3B5LCBtb2RpZnksIG1lcmdlLCBwdWJsaXNoLFxuLy8gZGlzdHJpYnV0ZSwgc3VibGljZW5zZSwgYW5kL29yIHNlbGwgY29waWVzIG9mIHRoZSBTb2Z0d2FyZSwgYW5kIHRvIHBlcm1pdFxuLy8gcGVyc29ucyB0byB3aG9tIHRoZSBTb2Z0d2FyZSBpcyBmdXJuaXNoZWQgdG8gZG8gc28sIHN1YmplY3QgdG8gdGhlXG4vLyBmb2xsb3dpbmcgY29uZGl0aW9uczpcbi8vXG4vLyBUaGUgYWJvdmUgY29weXJpZ2h0IG5vdGljZSBhbmQgdGhpcyBwZXJtaXNzaW9uIG5vdGljZSBzaGFsbCBiZSBpbmNsdWRlZFxuLy8gaW4gYWxsIGNvcGllcyBvciBzdWJzdGFudGlhbCBwb3J0aW9ucyBvZiB0aGUgU29mdHdhcmUuXG4vL1xuLy8gVEhFIFNPRlRXQVJFIElTIFBST1ZJREVEIFwiQVMgSVNcIiwgV0lUSE9VVCBXQVJSQU5UWSBPRiBBTlkgS0lORCwgRVhQUkVTU1xuLy8gT1IgSU1QTElFRCwgSU5DTFVESU5HIEJVVCBOT1QgTElNSVRFRCBUTyBUSEUgV0FSUkFOVElFUyBPRlxuLy8gTUVSQ0hBTlRBQklMSVRZLCBGSVRORVNTIEZPUiBBIFBBUlRJQ1VMQVIgUFVSUE9TRSBBTkQgTk9OSU5GUklOR0VNRU5ULiBJTlxuLy8gTk8gRVZFTlQgU0hBTEwgVEhFIEFVVEhPUlMgT1IgQ09QWVJJR0hUIEhPTERFUlMgQkUgTElBQkxFIEZPUiBBTlkgQ0xBSU0sXG4vLyBEQU1BR0VTIE9SIE9USEVSIExJQUJJTElUWSwgV0hFVEhFUiBJTiBBTiBBQ1RJT04gT0YgQ09OVFJBQ1QsIFRPUlQgT1Jcbi8vIE9USEVSV0lTRSwgQVJJU0lORyBGUk9NLCBPVVQgT0YgT1IgSU4gQ09OTkVDVElPTiBXSVRIIFRIRSBTT0ZUV0FSRSBPUiBUSEVcbi8vIFVTRSBPUiBPVEhFUiBERUFMSU5HUyBJTiBUSEUgU09GVFdBUkUuXG5cbid1c2Ugc3RyaWN0JztcblxudmFyIHN0cmluZ2lmeVByaW1pdGl2ZSA9IGZ1bmN0aW9uKHYpIHtcbiAgc3dpdGNoICh0eXBlb2Ygdikge1xuICAgIGNhc2UgJ3N0cmluZyc6XG4gICAgICByZXR1cm4gdjtcblxuICAgIGNhc2UgJ2Jvb2xlYW4nOlxuICAgICAgcmV0dXJuIHYgPyAndHJ1ZScgOiAnZmFsc2UnO1xuXG4gICAgY2FzZSAnbnVtYmVyJzpcbiAgICAgIHJldHVybiBpc0Zpbml0ZSh2KSA/IHYgOiAnJztcblxuICAgIGRlZmF1bHQ6XG4gICAgICByZXR1cm4gJyc7XG4gIH1cbn07XG5cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24ob2JqLCBzZXAsIGVxLCBuYW1lKSB7XG4gIHNlcCA9IHNlcCB8fCAnJic7XG4gIGVxID0gZXEgfHwgJz0nO1xuICBpZiAob2JqID09PSBudWxsKSB7XG4gICAgb2JqID0gdW5kZWZpbmVkO1xuICB9XG5cbiAgaWYgKHR5cGVvZiBvYmogPT09ICdvYmplY3QnKSB7XG4gICAgcmV0dXJuIG1hcChvYmplY3RLZXlzKG9iaiksIGZ1bmN0aW9uKGspIHtcbiAgICAgIHZhciBrcyA9IGVuY29kZVVSSUNvbXBvbmVudChzdHJpbmdpZnlQcmltaXRpdmUoaykpICsgZXE7XG4gICAgICBpZiAoaXNBcnJheShvYmpba10pKSB7XG4gICAgICAgIHJldHVybiBtYXAob2JqW2tdLCBmdW5jdGlvbih2KSB7XG4gICAgICAgICAgcmV0dXJuIGtzICsgZW5jb2RlVVJJQ29tcG9uZW50KHN0cmluZ2lmeVByaW1pdGl2ZSh2KSk7XG4gICAgICAgIH0pLmpvaW4oc2VwKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJldHVybiBrcyArIGVuY29kZVVSSUNvbXBvbmVudChzdHJpbmdpZnlQcmltaXRpdmUob2JqW2tdKSk7XG4gICAgICB9XG4gICAgfSkuam9pbihzZXApO1xuXG4gIH1cblxuICBpZiAoIW5hbWUpIHJldHVybiAnJztcbiAgcmV0dXJuIGVuY29kZVVSSUNvbXBvbmVudChzdHJpbmdpZnlQcmltaXRpdmUobmFtZSkpICsgZXEgK1xuICAgICAgICAgZW5jb2RlVVJJQ29tcG9uZW50KHN0cmluZ2lmeVByaW1pdGl2ZShvYmopKTtcbn07XG5cbnZhciBpc0FycmF5ID0gQXJyYXkuaXNBcnJheSB8fCBmdW5jdGlvbiAoeHMpIHtcbiAgcmV0dXJuIE9iamVjdC5wcm90b3R5cGUudG9TdHJpbmcuY2FsbCh4cykgPT09ICdbb2JqZWN0IEFycmF5XSc7XG59O1xuXG5mdW5jdGlvbiBtYXAgKHhzLCBmKSB7XG4gIGlmICh4cy5tYXApIHJldHVybiB4cy5tYXAoZik7XG4gIHZhciByZXMgPSBbXTtcbiAgZm9yICh2YXIgaSA9IDA7IGkgPCB4cy5sZW5ndGg7IGkrKykge1xuICAgIHJlcy5wdXNoKGYoeHNbaV0sIGkpKTtcbiAgfVxuICByZXR1cm4gcmVzO1xufVxuXG52YXIgb2JqZWN0S2V5cyA9IE9iamVjdC5rZXlzIHx8IGZ1bmN0aW9uIChvYmopIHtcbiAgdmFyIHJlcyA9IFtdO1xuICBmb3IgKHZhciBrZXkgaW4gb2JqKSB7XG4gICAgaWYgKE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkuY2FsbChvYmosIGtleSkpIHJlcy5wdXNoKGtleSk7XG4gIH1cbiAgcmV0dXJuIHJlcztcbn07XG4iLCIndXNlIHN0cmljdCc7XG5cbmV4cG9ydHMuZGVjb2RlID0gZXhwb3J0cy5wYXJzZSA9IHJlcXVpcmUoJy4vZGVjb2RlJyk7XG5leHBvcnRzLmVuY29kZSA9IGV4cG9ydHMuc3RyaW5naWZ5ID0gcmVxdWlyZSgnLi9lbmNvZGUnKTtcbiIsIi8vIENvcHlyaWdodCBKb3llbnQsIEluYy4gYW5kIG90aGVyIE5vZGUgY29udHJpYnV0b3JzLlxuLy9cbi8vIFBlcm1pc3Npb24gaXMgaGVyZWJ5IGdyYW50ZWQsIGZyZWUgb2YgY2hhcmdlLCB0byBhbnkgcGVyc29uIG9idGFpbmluZyBhXG4vLyBjb3B5IG9mIHRoaXMgc29mdHdhcmUgYW5kIGFzc29jaWF0ZWQgZG9jdW1lbnRhdGlvbiBmaWxlcyAodGhlXG4vLyBcIlNvZnR3YXJlXCIpLCB0byBkZWFsIGluIHRoZSBTb2Z0d2FyZSB3aXRob3V0IHJlc3RyaWN0aW9uLCBpbmNsdWRpbmdcbi8vIHdpdGhvdXQgbGltaXRhdGlvbiB0aGUgcmlnaHRzIHRvIHVzZSwgY29weSwgbW9kaWZ5LCBtZXJnZSwgcHVibGlzaCxcbi8vIGRpc3RyaWJ1dGUsIHN1YmxpY2Vuc2UsIGFuZC9vciBzZWxsIGNvcGllcyBvZiB0aGUgU29mdHdhcmUsIGFuZCB0byBwZXJtaXRcbi8vIHBlcnNvbnMgdG8gd2hvbSB0aGUgU29mdHdhcmUgaXMgZnVybmlzaGVkIHRvIGRvIHNvLCBzdWJqZWN0IHRvIHRoZVxuLy8gZm9sbG93aW5nIGNvbmRpdGlvbnM6XG4vL1xuLy8gVGhlIGFib3ZlIGNvcHlyaWdodCBub3RpY2UgYW5kIHRoaXMgcGVybWlzc2lvbiBub3RpY2Ugc2hhbGwgYmUgaW5jbHVkZWRcbi8vIGluIGFsbCBjb3BpZXMgb3Igc3Vic3RhbnRpYWwgcG9ydGlvbnMgb2YgdGhlIFNvZnR3YXJlLlxuLy9cbi8vIFRIRSBTT0ZUV0FSRSBJUyBQUk9WSURFRCBcIkFTIElTXCIsIFdJVEhPVVQgV0FSUkFOVFkgT0YgQU5ZIEtJTkQsIEVYUFJFU1Ncbi8vIE9SIElNUExJRUQsIElOQ0xVRElORyBCVVQgTk9UIExJTUlURUQgVE8gVEhFIFdBUlJBTlRJRVMgT0Zcbi8vIE1FUkNIQU5UQUJJTElUWSwgRklUTkVTUyBGT1IgQSBQQVJUSUNVTEFSIFBVUlBPU0UgQU5EIE5PTklORlJJTkdFTUVOVC4gSU5cbi8vIE5PIEVWRU5UIFNIQUxMIFRIRSBBVVRIT1JTIE9SIENPUFlSSUdIVCBIT0xERVJTIEJFIExJQUJMRSBGT1IgQU5ZIENMQUlNLFxuLy8gREFNQUdFUyBPUiBPVEhFUiBMSUFCSUxJVFksIFdIRVRIRVIgSU4gQU4gQUNUSU9OIE9GIENPTlRSQUNULCBUT1JUIE9SXG4vLyBPVEhFUldJU0UsIEFSSVNJTkcgRlJPTSwgT1VUIE9GIE9SIElOIENPTk5FQ1RJT04gV0lUSCBUSEUgU09GVFdBUkUgT1IgVEhFXG4vLyBVU0UgT1IgT1RIRVIgREVBTElOR1MgSU4gVEhFIFNPRlRXQVJFLlxuXG4ndXNlIHN0cmljdCc7XG5cbnZhciBwdW55Y29kZSA9IHJlcXVpcmUoJ3B1bnljb2RlJyk7XG52YXIgdXRpbCA9IHJlcXVpcmUoJy4vdXRpbCcpO1xuXG5leHBvcnRzLnBhcnNlID0gdXJsUGFyc2U7XG5leHBvcnRzLnJlc29sdmUgPSB1cmxSZXNvbHZlO1xuZXhwb3J0cy5yZXNvbHZlT2JqZWN0ID0gdXJsUmVzb2x2ZU9iamVjdDtcbmV4cG9ydHMuZm9ybWF0ID0gdXJsRm9ybWF0O1xuXG5leHBvcnRzLlVybCA9IFVybDtcblxuZnVuY3Rpb24gVXJsKCkge1xuICB0aGlzLnByb3RvY29sID0gbnVsbDtcbiAgdGhpcy5zbGFzaGVzID0gbnVsbDtcbiAgdGhpcy5hdXRoID0gbnVsbDtcbiAgdGhpcy5ob3N0ID0gbnVsbDtcbiAgdGhpcy5wb3J0ID0gbnVsbDtcbiAgdGhpcy5ob3N0bmFtZSA9IG51bGw7XG4gIHRoaXMuaGFzaCA9IG51bGw7XG4gIHRoaXMuc2VhcmNoID0gbnVsbDtcbiAgdGhpcy5xdWVyeSA9IG51bGw7XG4gIHRoaXMucGF0aG5hbWUgPSBudWxsO1xuICB0aGlzLnBhdGggPSBudWxsO1xuICB0aGlzLmhyZWYgPSBudWxsO1xufVxuXG4vLyBSZWZlcmVuY2U6IFJGQyAzOTg2LCBSRkMgMTgwOCwgUkZDIDIzOTZcblxuLy8gZGVmaW5lIHRoZXNlIGhlcmUgc28gYXQgbGVhc3QgdGhleSBvbmx5IGhhdmUgdG8gYmVcbi8vIGNvbXBpbGVkIG9uY2Ugb24gdGhlIGZpcnN0IG1vZHVsZSBsb2FkLlxudmFyIHByb3RvY29sUGF0dGVybiA9IC9eKFthLXowLTkuKy1dKzopL2ksXG4gICAgcG9ydFBhdHRlcm4gPSAvOlswLTldKiQvLFxuXG4gICAgLy8gU3BlY2lhbCBjYXNlIGZvciBhIHNpbXBsZSBwYXRoIFVSTFxuICAgIHNpbXBsZVBhdGhQYXR0ZXJuID0gL14oXFwvXFwvPyg/IVxcLylbXlxcP1xcc10qKShcXD9bXlxcc10qKT8kLyxcblxuICAgIC8vIFJGQyAyMzk2OiBjaGFyYWN0ZXJzIHJlc2VydmVkIGZvciBkZWxpbWl0aW5nIFVSTHMuXG4gICAgLy8gV2UgYWN0dWFsbHkganVzdCBhdXRvLWVzY2FwZSB0aGVzZS5cbiAgICBkZWxpbXMgPSBbJzwnLCAnPicsICdcIicsICdgJywgJyAnLCAnXFxyJywgJ1xcbicsICdcXHQnXSxcblxuICAgIC8vIFJGQyAyMzk2OiBjaGFyYWN0ZXJzIG5vdCBhbGxvd2VkIGZvciB2YXJpb3VzIHJlYXNvbnMuXG4gICAgdW53aXNlID0gWyd7JywgJ30nLCAnfCcsICdcXFxcJywgJ14nLCAnYCddLmNvbmNhdChkZWxpbXMpLFxuXG4gICAgLy8gQWxsb3dlZCBieSBSRkNzLCBidXQgY2F1c2Ugb2YgWFNTIGF0dGFja3MuICBBbHdheXMgZXNjYXBlIHRoZXNlLlxuICAgIGF1dG9Fc2NhcGUgPSBbJ1xcJyddLmNvbmNhdCh1bndpc2UpLFxuICAgIC8vIENoYXJhY3RlcnMgdGhhdCBhcmUgbmV2ZXIgZXZlciBhbGxvd2VkIGluIGEgaG9zdG5hbWUuXG4gICAgLy8gTm90ZSB0aGF0IGFueSBpbnZhbGlkIGNoYXJzIGFyZSBhbHNvIGhhbmRsZWQsIGJ1dCB0aGVzZVxuICAgIC8vIGFyZSB0aGUgb25lcyB0aGF0IGFyZSAqZXhwZWN0ZWQqIHRvIGJlIHNlZW4sIHNvIHdlIGZhc3QtcGF0aFxuICAgIC8vIHRoZW0uXG4gICAgbm9uSG9zdENoYXJzID0gWyclJywgJy8nLCAnPycsICc7JywgJyMnXS5jb25jYXQoYXV0b0VzY2FwZSksXG4gICAgaG9zdEVuZGluZ0NoYXJzID0gWycvJywgJz8nLCAnIyddLFxuICAgIGhvc3RuYW1lTWF4TGVuID0gMjU1LFxuICAgIGhvc3RuYW1lUGFydFBhdHRlcm4gPSAvXlsrYS16MC05QS1aXy1dezAsNjN9JC8sXG4gICAgaG9zdG5hbWVQYXJ0U3RhcnQgPSAvXihbK2EtejAtOUEtWl8tXXswLDYzfSkoLiopJC8sXG4gICAgLy8gcHJvdG9jb2xzIHRoYXQgY2FuIGFsbG93IFwidW5zYWZlXCIgYW5kIFwidW53aXNlXCIgY2hhcnMuXG4gICAgdW5zYWZlUHJvdG9jb2wgPSB7XG4gICAgICAnamF2YXNjcmlwdCc6IHRydWUsXG4gICAgICAnamF2YXNjcmlwdDonOiB0cnVlXG4gICAgfSxcbiAgICAvLyBwcm90b2NvbHMgdGhhdCBuZXZlciBoYXZlIGEgaG9zdG5hbWUuXG4gICAgaG9zdGxlc3NQcm90b2NvbCA9IHtcbiAgICAgICdqYXZhc2NyaXB0JzogdHJ1ZSxcbiAgICAgICdqYXZhc2NyaXB0Oic6IHRydWVcbiAgICB9LFxuICAgIC8vIHByb3RvY29scyB0aGF0IGFsd2F5cyBjb250YWluIGEgLy8gYml0LlxuICAgIHNsYXNoZWRQcm90b2NvbCA9IHtcbiAgICAgICdodHRwJzogdHJ1ZSxcbiAgICAgICdodHRwcyc6IHRydWUsXG4gICAgICAnZnRwJzogdHJ1ZSxcbiAgICAgICdnb3BoZXInOiB0cnVlLFxuICAgICAgJ2ZpbGUnOiB0cnVlLFxuICAgICAgJ2h0dHA6JzogdHJ1ZSxcbiAgICAgICdodHRwczonOiB0cnVlLFxuICAgICAgJ2Z0cDonOiB0cnVlLFxuICAgICAgJ2dvcGhlcjonOiB0cnVlLFxuICAgICAgJ2ZpbGU6JzogdHJ1ZVxuICAgIH0sXG4gICAgcXVlcnlzdHJpbmcgPSByZXF1aXJlKCdxdWVyeXN0cmluZycpO1xuXG5mdW5jdGlvbiB1cmxQYXJzZSh1cmwsIHBhcnNlUXVlcnlTdHJpbmcsIHNsYXNoZXNEZW5vdGVIb3N0KSB7XG4gIGlmICh1cmwgJiYgdXRpbC5pc09iamVjdCh1cmwpICYmIHVybCBpbnN0YW5jZW9mIFVybCkgcmV0dXJuIHVybDtcblxuICB2YXIgdSA9IG5ldyBVcmw7XG4gIHUucGFyc2UodXJsLCBwYXJzZVF1ZXJ5U3RyaW5nLCBzbGFzaGVzRGVub3RlSG9zdCk7XG4gIHJldHVybiB1O1xufVxuXG5VcmwucHJvdG90eXBlLnBhcnNlID0gZnVuY3Rpb24odXJsLCBwYXJzZVF1ZXJ5U3RyaW5nLCBzbGFzaGVzRGVub3RlSG9zdCkge1xuICBpZiAoIXV0aWwuaXNTdHJpbmcodXJsKSkge1xuICAgIHRocm93IG5ldyBUeXBlRXJyb3IoXCJQYXJhbWV0ZXIgJ3VybCcgbXVzdCBiZSBhIHN0cmluZywgbm90IFwiICsgdHlwZW9mIHVybCk7XG4gIH1cblxuICAvLyBDb3B5IGNocm9tZSwgSUUsIG9wZXJhIGJhY2tzbGFzaC1oYW5kbGluZyBiZWhhdmlvci5cbiAgLy8gQmFjayBzbGFzaGVzIGJlZm9yZSB0aGUgcXVlcnkgc3RyaW5nIGdldCBjb252ZXJ0ZWQgdG8gZm9yd2FyZCBzbGFzaGVzXG4gIC8vIFNlZTogaHR0cHM6Ly9jb2RlLmdvb2dsZS5jb20vcC9jaHJvbWl1bS9pc3N1ZXMvZGV0YWlsP2lkPTI1OTE2XG4gIHZhciBxdWVyeUluZGV4ID0gdXJsLmluZGV4T2YoJz8nKSxcbiAgICAgIHNwbGl0dGVyID1cbiAgICAgICAgICAocXVlcnlJbmRleCAhPT0gLTEgJiYgcXVlcnlJbmRleCA8IHVybC5pbmRleE9mKCcjJykpID8gJz8nIDogJyMnLFxuICAgICAgdVNwbGl0ID0gdXJsLnNwbGl0KHNwbGl0dGVyKSxcbiAgICAgIHNsYXNoUmVnZXggPSAvXFxcXC9nO1xuICB1U3BsaXRbMF0gPSB1U3BsaXRbMF0ucmVwbGFjZShzbGFzaFJlZ2V4LCAnLycpO1xuICB1cmwgPSB1U3BsaXQuam9pbihzcGxpdHRlcik7XG5cbiAgdmFyIHJlc3QgPSB1cmw7XG5cbiAgLy8gdHJpbSBiZWZvcmUgcHJvY2VlZGluZy5cbiAgLy8gVGhpcyBpcyB0byBzdXBwb3J0IHBhcnNlIHN0dWZmIGxpa2UgXCIgIGh0dHA6Ly9mb28uY29tICBcXG5cIlxuICByZXN0ID0gcmVzdC50cmltKCk7XG5cbiAgaWYgKCFzbGFzaGVzRGVub3RlSG9zdCAmJiB1cmwuc3BsaXQoJyMnKS5sZW5ndGggPT09IDEpIHtcbiAgICAvLyBUcnkgZmFzdCBwYXRoIHJlZ2V4cFxuICAgIHZhciBzaW1wbGVQYXRoID0gc2ltcGxlUGF0aFBhdHRlcm4uZXhlYyhyZXN0KTtcbiAgICBpZiAoc2ltcGxlUGF0aCkge1xuICAgICAgdGhpcy5wYXRoID0gcmVzdDtcbiAgICAgIHRoaXMuaHJlZiA9IHJlc3Q7XG4gICAgICB0aGlzLnBhdGhuYW1lID0gc2ltcGxlUGF0aFsxXTtcbiAgICAgIGlmIChzaW1wbGVQYXRoWzJdKSB7XG4gICAgICAgIHRoaXMuc2VhcmNoID0gc2ltcGxlUGF0aFsyXTtcbiAgICAgICAgaWYgKHBhcnNlUXVlcnlTdHJpbmcpIHtcbiAgICAgICAgICB0aGlzLnF1ZXJ5ID0gcXVlcnlzdHJpbmcucGFyc2UodGhpcy5zZWFyY2guc3Vic3RyKDEpKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB0aGlzLnF1ZXJ5ID0gdGhpcy5zZWFyY2guc3Vic3RyKDEpO1xuICAgICAgICB9XG4gICAgICB9IGVsc2UgaWYgKHBhcnNlUXVlcnlTdHJpbmcpIHtcbiAgICAgICAgdGhpcy5zZWFyY2ggPSAnJztcbiAgICAgICAgdGhpcy5xdWVyeSA9IHt9O1xuICAgICAgfVxuICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfVxuICB9XG5cbiAgdmFyIHByb3RvID0gcHJvdG9jb2xQYXR0ZXJuLmV4ZWMocmVzdCk7XG4gIGlmIChwcm90bykge1xuICAgIHByb3RvID0gcHJvdG9bMF07XG4gICAgdmFyIGxvd2VyUHJvdG8gPSBwcm90by50b0xvd2VyQ2FzZSgpO1xuICAgIHRoaXMucHJvdG9jb2wgPSBsb3dlclByb3RvO1xuICAgIHJlc3QgPSByZXN0LnN1YnN0cihwcm90by5sZW5ndGgpO1xuICB9XG5cbiAgLy8gZmlndXJlIG91dCBpZiBpdCdzIGdvdCBhIGhvc3RcbiAgLy8gdXNlckBzZXJ2ZXIgaXMgKmFsd2F5cyogaW50ZXJwcmV0ZWQgYXMgYSBob3N0bmFtZSwgYW5kIHVybFxuICAvLyByZXNvbHV0aW9uIHdpbGwgdHJlYXQgLy9mb28vYmFyIGFzIGhvc3Q9Zm9vLHBhdGg9YmFyIGJlY2F1c2UgdGhhdCdzXG4gIC8vIGhvdyB0aGUgYnJvd3NlciByZXNvbHZlcyByZWxhdGl2ZSBVUkxzLlxuICBpZiAoc2xhc2hlc0Rlbm90ZUhvc3QgfHwgcHJvdG8gfHwgcmVzdC5tYXRjaCgvXlxcL1xcL1teQFxcL10rQFteQFxcL10rLykpIHtcbiAgICB2YXIgc2xhc2hlcyA9IHJlc3Quc3Vic3RyKDAsIDIpID09PSAnLy8nO1xuICAgIGlmIChzbGFzaGVzICYmICEocHJvdG8gJiYgaG9zdGxlc3NQcm90b2NvbFtwcm90b10pKSB7XG4gICAgICByZXN0ID0gcmVzdC5zdWJzdHIoMik7XG4gICAgICB0aGlzLnNsYXNoZXMgPSB0cnVlO1xuICAgIH1cbiAgfVxuXG4gIGlmICghaG9zdGxlc3NQcm90b2NvbFtwcm90b10gJiZcbiAgICAgIChzbGFzaGVzIHx8IChwcm90byAmJiAhc2xhc2hlZFByb3RvY29sW3Byb3RvXSkpKSB7XG5cbiAgICAvLyB0aGVyZSdzIGEgaG9zdG5hbWUuXG4gICAgLy8gdGhlIGZpcnN0IGluc3RhbmNlIG9mIC8sID8sIDssIG9yICMgZW5kcyB0aGUgaG9zdC5cbiAgICAvL1xuICAgIC8vIElmIHRoZXJlIGlzIGFuIEAgaW4gdGhlIGhvc3RuYW1lLCB0aGVuIG5vbi1ob3N0IGNoYXJzICphcmUqIGFsbG93ZWRcbiAgICAvLyB0byB0aGUgbGVmdCBvZiB0aGUgbGFzdCBAIHNpZ24sIHVubGVzcyBzb21lIGhvc3QtZW5kaW5nIGNoYXJhY3RlclxuICAgIC8vIGNvbWVzICpiZWZvcmUqIHRoZSBALXNpZ24uXG4gICAgLy8gVVJMcyBhcmUgb2Jub3hpb3VzLlxuICAgIC8vXG4gICAgLy8gZXg6XG4gICAgLy8gaHR0cDovL2FAYkBjLyA9PiB1c2VyOmFAYiBob3N0OmNcbiAgICAvLyBodHRwOi8vYUBiP0BjID0+IHVzZXI6YSBob3N0OmMgcGF0aDovP0BjXG5cbiAgICAvLyB2MC4xMiBUT0RPKGlzYWFjcyk6IFRoaXMgaXMgbm90IHF1aXRlIGhvdyBDaHJvbWUgZG9lcyB0aGluZ3MuXG4gICAgLy8gUmV2aWV3IG91ciB0ZXN0IGNhc2UgYWdhaW5zdCBicm93c2VycyBtb3JlIGNvbXByZWhlbnNpdmVseS5cblxuICAgIC8vIGZpbmQgdGhlIGZpcnN0IGluc3RhbmNlIG9mIGFueSBob3N0RW5kaW5nQ2hhcnNcbiAgICB2YXIgaG9zdEVuZCA9IC0xO1xuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgaG9zdEVuZGluZ0NoYXJzLmxlbmd0aDsgaSsrKSB7XG4gICAgICB2YXIgaGVjID0gcmVzdC5pbmRleE9mKGhvc3RFbmRpbmdDaGFyc1tpXSk7XG4gICAgICBpZiAoaGVjICE9PSAtMSAmJiAoaG9zdEVuZCA9PT0gLTEgfHwgaGVjIDwgaG9zdEVuZCkpXG4gICAgICAgIGhvc3RFbmQgPSBoZWM7XG4gICAgfVxuXG4gICAgLy8gYXQgdGhpcyBwb2ludCwgZWl0aGVyIHdlIGhhdmUgYW4gZXhwbGljaXQgcG9pbnQgd2hlcmUgdGhlXG4gICAgLy8gYXV0aCBwb3J0aW9uIGNhbm5vdCBnbyBwYXN0LCBvciB0aGUgbGFzdCBAIGNoYXIgaXMgdGhlIGRlY2lkZXIuXG4gICAgdmFyIGF1dGgsIGF0U2lnbjtcbiAgICBpZiAoaG9zdEVuZCA9PT0gLTEpIHtcbiAgICAgIC8vIGF0U2lnbiBjYW4gYmUgYW55d2hlcmUuXG4gICAgICBhdFNpZ24gPSByZXN0Lmxhc3RJbmRleE9mKCdAJyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIGF0U2lnbiBtdXN0IGJlIGluIGF1dGggcG9ydGlvbi5cbiAgICAgIC8vIGh0dHA6Ly9hQGIvY0BkID0+IGhvc3Q6YiBhdXRoOmEgcGF0aDovY0BkXG4gICAgICBhdFNpZ24gPSByZXN0Lmxhc3RJbmRleE9mKCdAJywgaG9zdEVuZCk7XG4gICAgfVxuXG4gICAgLy8gTm93IHdlIGhhdmUgYSBwb3J0aW9uIHdoaWNoIGlzIGRlZmluaXRlbHkgdGhlIGF1dGguXG4gICAgLy8gUHVsbCB0aGF0IG9mZi5cbiAgICBpZiAoYXRTaWduICE9PSAtMSkge1xuICAgICAgYXV0aCA9IHJlc3Quc2xpY2UoMCwgYXRTaWduKTtcbiAgICAgIHJlc3QgPSByZXN0LnNsaWNlKGF0U2lnbiArIDEpO1xuICAgICAgdGhpcy5hdXRoID0gZGVjb2RlVVJJQ29tcG9uZW50KGF1dGgpO1xuICAgIH1cblxuICAgIC8vIHRoZSBob3N0IGlzIHRoZSByZW1haW5pbmcgdG8gdGhlIGxlZnQgb2YgdGhlIGZpcnN0IG5vbi1ob3N0IGNoYXJcbiAgICBob3N0RW5kID0gLTE7XG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBub25Ib3N0Q2hhcnMubGVuZ3RoOyBpKyspIHtcbiAgICAgIHZhciBoZWMgPSByZXN0LmluZGV4T2Yobm9uSG9zdENoYXJzW2ldKTtcbiAgICAgIGlmIChoZWMgIT09IC0xICYmIChob3N0RW5kID09PSAtMSB8fCBoZWMgPCBob3N0RW5kKSlcbiAgICAgICAgaG9zdEVuZCA9IGhlYztcbiAgICB9XG4gICAgLy8gaWYgd2Ugc3RpbGwgaGF2ZSBub3QgaGl0IGl0LCB0aGVuIHRoZSBlbnRpcmUgdGhpbmcgaXMgYSBob3N0LlxuICAgIGlmIChob3N0RW5kID09PSAtMSlcbiAgICAgIGhvc3RFbmQgPSByZXN0Lmxlbmd0aDtcblxuICAgIHRoaXMuaG9zdCA9IHJlc3Quc2xpY2UoMCwgaG9zdEVuZCk7XG4gICAgcmVzdCA9IHJlc3Quc2xpY2UoaG9zdEVuZCk7XG5cbiAgICAvLyBwdWxsIG91dCBwb3J0LlxuICAgIHRoaXMucGFyc2VIb3N0KCk7XG5cbiAgICAvLyB3ZSd2ZSBpbmRpY2F0ZWQgdGhhdCB0aGVyZSBpcyBhIGhvc3RuYW1lLFxuICAgIC8vIHNvIGV2ZW4gaWYgaXQncyBlbXB0eSwgaXQgaGFzIHRvIGJlIHByZXNlbnQuXG4gICAgdGhpcy5ob3N0bmFtZSA9IHRoaXMuaG9zdG5hbWUgfHwgJyc7XG5cbiAgICAvLyBpZiBob3N0bmFtZSBiZWdpbnMgd2l0aCBbIGFuZCBlbmRzIHdpdGggXVxuICAgIC8vIGFzc3VtZSB0aGF0IGl0J3MgYW4gSVB2NiBhZGRyZXNzLlxuICAgIHZhciBpcHY2SG9zdG5hbWUgPSB0aGlzLmhvc3RuYW1lWzBdID09PSAnWycgJiZcbiAgICAgICAgdGhpcy5ob3N0bmFtZVt0aGlzLmhvc3RuYW1lLmxlbmd0aCAtIDFdID09PSAnXSc7XG5cbiAgICAvLyB2YWxpZGF0ZSBhIGxpdHRsZS5cbiAgICBpZiAoIWlwdjZIb3N0bmFtZSkge1xuICAgICAgdmFyIGhvc3RwYXJ0cyA9IHRoaXMuaG9zdG5hbWUuc3BsaXQoL1xcLi8pO1xuICAgICAgZm9yICh2YXIgaSA9IDAsIGwgPSBob3N0cGFydHMubGVuZ3RoOyBpIDwgbDsgaSsrKSB7XG4gICAgICAgIHZhciBwYXJ0ID0gaG9zdHBhcnRzW2ldO1xuICAgICAgICBpZiAoIXBhcnQpIGNvbnRpbnVlO1xuICAgICAgICBpZiAoIXBhcnQubWF0Y2goaG9zdG5hbWVQYXJ0UGF0dGVybikpIHtcbiAgICAgICAgICB2YXIgbmV3cGFydCA9ICcnO1xuICAgICAgICAgIGZvciAodmFyIGogPSAwLCBrID0gcGFydC5sZW5ndGg7IGogPCBrOyBqKyspIHtcbiAgICAgICAgICAgIGlmIChwYXJ0LmNoYXJDb2RlQXQoaikgPiAxMjcpIHtcbiAgICAgICAgICAgICAgLy8gd2UgcmVwbGFjZSBub24tQVNDSUkgY2hhciB3aXRoIGEgdGVtcG9yYXJ5IHBsYWNlaG9sZGVyXG4gICAgICAgICAgICAgIC8vIHdlIG5lZWQgdGhpcyB0byBtYWtlIHN1cmUgc2l6ZSBvZiBob3N0bmFtZSBpcyBub3RcbiAgICAgICAgICAgICAgLy8gYnJva2VuIGJ5IHJlcGxhY2luZyBub24tQVNDSUkgYnkgbm90aGluZ1xuICAgICAgICAgICAgICBuZXdwYXJ0ICs9ICd4JztcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIG5ld3BhcnQgKz0gcGFydFtqXTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgICAgLy8gd2UgdGVzdCBhZ2FpbiB3aXRoIEFTQ0lJIGNoYXIgb25seVxuICAgICAgICAgIGlmICghbmV3cGFydC5tYXRjaChob3N0bmFtZVBhcnRQYXR0ZXJuKSkge1xuICAgICAgICAgICAgdmFyIHZhbGlkUGFydHMgPSBob3N0cGFydHMuc2xpY2UoMCwgaSk7XG4gICAgICAgICAgICB2YXIgbm90SG9zdCA9IGhvc3RwYXJ0cy5zbGljZShpICsgMSk7XG4gICAgICAgICAgICB2YXIgYml0ID0gcGFydC5tYXRjaChob3N0bmFtZVBhcnRTdGFydCk7XG4gICAgICAgICAgICBpZiAoYml0KSB7XG4gICAgICAgICAgICAgIHZhbGlkUGFydHMucHVzaChiaXRbMV0pO1xuICAgICAgICAgICAgICBub3RIb3N0LnVuc2hpZnQoYml0WzJdKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChub3RIb3N0Lmxlbmd0aCkge1xuICAgICAgICAgICAgICByZXN0ID0gJy8nICsgbm90SG9zdC5qb2luKCcuJykgKyByZXN0O1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdGhpcy5ob3N0bmFtZSA9IHZhbGlkUGFydHMuam9pbignLicpO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKHRoaXMuaG9zdG5hbWUubGVuZ3RoID4gaG9zdG5hbWVNYXhMZW4pIHtcbiAgICAgIHRoaXMuaG9zdG5hbWUgPSAnJztcbiAgICB9IGVsc2Uge1xuICAgICAgLy8gaG9zdG5hbWVzIGFyZSBhbHdheXMgbG93ZXIgY2FzZS5cbiAgICAgIHRoaXMuaG9zdG5hbWUgPSB0aGlzLmhvc3RuYW1lLnRvTG93ZXJDYXNlKCk7XG4gICAgfVxuXG4gICAgaWYgKCFpcHY2SG9zdG5hbWUpIHtcbiAgICAgIC8vIElETkEgU3VwcG9ydDogUmV0dXJucyBhIHB1bnljb2RlZCByZXByZXNlbnRhdGlvbiBvZiBcImRvbWFpblwiLlxuICAgICAgLy8gSXQgb25seSBjb252ZXJ0cyBwYXJ0cyBvZiB0aGUgZG9tYWluIG5hbWUgdGhhdFxuICAgICAgLy8gaGF2ZSBub24tQVNDSUkgY2hhcmFjdGVycywgaS5lLiBpdCBkb2Vzbid0IG1hdHRlciBpZlxuICAgICAgLy8geW91IGNhbGwgaXQgd2l0aCBhIGRvbWFpbiB0aGF0IGFscmVhZHkgaXMgQVNDSUktb25seS5cbiAgICAgIHRoaXMuaG9zdG5hbWUgPSBwdW55Y29kZS50b0FTQ0lJKHRoaXMuaG9zdG5hbWUpO1xuICAgIH1cblxuICAgIHZhciBwID0gdGhpcy5wb3J0ID8gJzonICsgdGhpcy5wb3J0IDogJyc7XG4gICAgdmFyIGggPSB0aGlzLmhvc3RuYW1lIHx8ICcnO1xuICAgIHRoaXMuaG9zdCA9IGggKyBwO1xuICAgIHRoaXMuaHJlZiArPSB0aGlzLmhvc3Q7XG5cbiAgICAvLyBzdHJpcCBbIGFuZCBdIGZyb20gdGhlIGhvc3RuYW1lXG4gICAgLy8gdGhlIGhvc3QgZmllbGQgc3RpbGwgcmV0YWlucyB0aGVtLCB0aG91Z2hcbiAgICBpZiAoaXB2Nkhvc3RuYW1lKSB7XG4gICAgICB0aGlzLmhvc3RuYW1lID0gdGhpcy5ob3N0bmFtZS5zdWJzdHIoMSwgdGhpcy5ob3N0bmFtZS5sZW5ndGggLSAyKTtcbiAgICAgIGlmIChyZXN0WzBdICE9PSAnLycpIHtcbiAgICAgICAgcmVzdCA9ICcvJyArIHJlc3Q7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgLy8gbm93IHJlc3QgaXMgc2V0IHRvIHRoZSBwb3N0LWhvc3Qgc3R1ZmYuXG4gIC8vIGNob3Agb2ZmIGFueSBkZWxpbSBjaGFycy5cbiAgaWYgKCF1bnNhZmVQcm90b2NvbFtsb3dlclByb3RvXSkge1xuXG4gICAgLy8gRmlyc3QsIG1ha2UgMTAwJSBzdXJlIHRoYXQgYW55IFwiYXV0b0VzY2FwZVwiIGNoYXJzIGdldFxuICAgIC8vIGVzY2FwZWQsIGV2ZW4gaWYgZW5jb2RlVVJJQ29tcG9uZW50IGRvZXNuJ3QgdGhpbmsgdGhleVxuICAgIC8vIG5lZWQgdG8gYmUuXG4gICAgZm9yICh2YXIgaSA9IDAsIGwgPSBhdXRvRXNjYXBlLmxlbmd0aDsgaSA8IGw7IGkrKykge1xuICAgICAgdmFyIGFlID0gYXV0b0VzY2FwZVtpXTtcbiAgICAgIGlmIChyZXN0LmluZGV4T2YoYWUpID09PSAtMSlcbiAgICAgICAgY29udGludWU7XG4gICAgICB2YXIgZXNjID0gZW5jb2RlVVJJQ29tcG9uZW50KGFlKTtcbiAgICAgIGlmIChlc2MgPT09IGFlKSB7XG4gICAgICAgIGVzYyA9IGVzY2FwZShhZSk7XG4gICAgICB9XG4gICAgICByZXN0ID0gcmVzdC5zcGxpdChhZSkuam9pbihlc2MpO1xuICAgIH1cbiAgfVxuXG5cbiAgLy8gY2hvcCBvZmYgZnJvbSB0aGUgdGFpbCBmaXJzdC5cbiAgdmFyIGhhc2ggPSByZXN0LmluZGV4T2YoJyMnKTtcbiAgaWYgKGhhc2ggIT09IC0xKSB7XG4gICAgLy8gZ290IGEgZnJhZ21lbnQgc3RyaW5nLlxuICAgIHRoaXMuaGFzaCA9IHJlc3Quc3Vic3RyKGhhc2gpO1xuICAgIHJlc3QgPSByZXN0LnNsaWNlKDAsIGhhc2gpO1xuICB9XG4gIHZhciBxbSA9IHJlc3QuaW5kZXhPZignPycpO1xuICBpZiAocW0gIT09IC0xKSB7XG4gICAgdGhpcy5zZWFyY2ggPSByZXN0LnN1YnN0cihxbSk7XG4gICAgdGhpcy5xdWVyeSA9IHJlc3Quc3Vic3RyKHFtICsgMSk7XG4gICAgaWYgKHBhcnNlUXVlcnlTdHJpbmcpIHtcbiAgICAgIHRoaXMucXVlcnkgPSBxdWVyeXN0cmluZy5wYXJzZSh0aGlzLnF1ZXJ5KTtcbiAgICB9XG4gICAgcmVzdCA9IHJlc3Quc2xpY2UoMCwgcW0pO1xuICB9IGVsc2UgaWYgKHBhcnNlUXVlcnlTdHJpbmcpIHtcbiAgICAvLyBubyBxdWVyeSBzdHJpbmcsIGJ1dCBwYXJzZVF1ZXJ5U3RyaW5nIHN0aWxsIHJlcXVlc3RlZFxuICAgIHRoaXMuc2VhcmNoID0gJyc7XG4gICAgdGhpcy5xdWVyeSA9IHt9O1xuICB9XG4gIGlmIChyZXN0KSB0aGlzLnBhdGhuYW1lID0gcmVzdDtcbiAgaWYgKHNsYXNoZWRQcm90b2NvbFtsb3dlclByb3RvXSAmJlxuICAgICAgdGhpcy5ob3N0bmFtZSAmJiAhdGhpcy5wYXRobmFtZSkge1xuICAgIHRoaXMucGF0aG5hbWUgPSAnLyc7XG4gIH1cblxuICAvL3RvIHN1cHBvcnQgaHR0cC5yZXF1ZXN0XG4gIGlmICh0aGlzLnBhdGhuYW1lIHx8IHRoaXMuc2VhcmNoKSB7XG4gICAgdmFyIHAgPSB0aGlzLnBhdGhuYW1lIHx8ICcnO1xuICAgIHZhciBzID0gdGhpcy5zZWFyY2ggfHwgJyc7XG4gICAgdGhpcy5wYXRoID0gcCArIHM7XG4gIH1cblxuICAvLyBmaW5hbGx5LCByZWNvbnN0cnVjdCB0aGUgaHJlZiBiYXNlZCBvbiB3aGF0IGhhcyBiZWVuIHZhbGlkYXRlZC5cbiAgdGhpcy5ocmVmID0gdGhpcy5mb3JtYXQoKTtcbiAgcmV0dXJuIHRoaXM7XG59O1xuXG4vLyBmb3JtYXQgYSBwYXJzZWQgb2JqZWN0IGludG8gYSB1cmwgc3RyaW5nXG5mdW5jdGlvbiB1cmxGb3JtYXQob2JqKSB7XG4gIC8vIGVuc3VyZSBpdCdzIGFuIG9iamVjdCwgYW5kIG5vdCBhIHN0cmluZyB1cmwuXG4gIC8vIElmIGl0J3MgYW4gb2JqLCB0aGlzIGlzIGEgbm8tb3AuXG4gIC8vIHRoaXMgd2F5LCB5b3UgY2FuIGNhbGwgdXJsX2Zvcm1hdCgpIG9uIHN0cmluZ3NcbiAgLy8gdG8gY2xlYW4gdXAgcG90ZW50aWFsbHkgd29ua3kgdXJscy5cbiAgaWYgKHV0aWwuaXNTdHJpbmcob2JqKSkgb2JqID0gdXJsUGFyc2Uob2JqKTtcbiAgaWYgKCEob2JqIGluc3RhbmNlb2YgVXJsKSkgcmV0dXJuIFVybC5wcm90b3R5cGUuZm9ybWF0LmNhbGwob2JqKTtcbiAgcmV0dXJuIG9iai5mb3JtYXQoKTtcbn1cblxuVXJsLnByb3RvdHlwZS5mb3JtYXQgPSBmdW5jdGlvbigpIHtcbiAgdmFyIGF1dGggPSB0aGlzLmF1dGggfHwgJyc7XG4gIGlmIChhdXRoKSB7XG4gICAgYXV0aCA9IGVuY29kZVVSSUNvbXBvbmVudChhdXRoKTtcbiAgICBhdXRoID0gYXV0aC5yZXBsYWNlKC8lM0EvaSwgJzonKTtcbiAgICBhdXRoICs9ICdAJztcbiAgfVxuXG4gIHZhciBwcm90b2NvbCA9IHRoaXMucHJvdG9jb2wgfHwgJycsXG4gICAgICBwYXRobmFtZSA9IHRoaXMucGF0aG5hbWUgfHwgJycsXG4gICAgICBoYXNoID0gdGhpcy5oYXNoIHx8ICcnLFxuICAgICAgaG9zdCA9IGZhbHNlLFxuICAgICAgcXVlcnkgPSAnJztcblxuICBpZiAodGhpcy5ob3N0KSB7XG4gICAgaG9zdCA9IGF1dGggKyB0aGlzLmhvc3Q7XG4gIH0gZWxzZSBpZiAodGhpcy5ob3N0bmFtZSkge1xuICAgIGhvc3QgPSBhdXRoICsgKHRoaXMuaG9zdG5hbWUuaW5kZXhPZignOicpID09PSAtMSA/XG4gICAgICAgIHRoaXMuaG9zdG5hbWUgOlxuICAgICAgICAnWycgKyB0aGlzLmhvc3RuYW1lICsgJ10nKTtcbiAgICBpZiAodGhpcy5wb3J0KSB7XG4gICAgICBob3N0ICs9ICc6JyArIHRoaXMucG9ydDtcbiAgICB9XG4gIH1cblxuICBpZiAodGhpcy5xdWVyeSAmJlxuICAgICAgdXRpbC5pc09iamVjdCh0aGlzLnF1ZXJ5KSAmJlxuICAgICAgT2JqZWN0LmtleXModGhpcy5xdWVyeSkubGVuZ3RoKSB7XG4gICAgcXVlcnkgPSBxdWVyeXN0cmluZy5zdHJpbmdpZnkodGhpcy5xdWVyeSk7XG4gIH1cblxuICB2YXIgc2VhcmNoID0gdGhpcy5zZWFyY2ggfHwgKHF1ZXJ5ICYmICgnPycgKyBxdWVyeSkpIHx8ICcnO1xuXG4gIGlmIChwcm90b2NvbCAmJiBwcm90b2NvbC5zdWJzdHIoLTEpICE9PSAnOicpIHByb3RvY29sICs9ICc6JztcblxuICAvLyBvbmx5IHRoZSBzbGFzaGVkUHJvdG9jb2xzIGdldCB0aGUgLy8uICBOb3QgbWFpbHRvOiwgeG1wcDosIGV0Yy5cbiAgLy8gdW5sZXNzIHRoZXkgaGFkIHRoZW0gdG8gYmVnaW4gd2l0aC5cbiAgaWYgKHRoaXMuc2xhc2hlcyB8fFxuICAgICAgKCFwcm90b2NvbCB8fCBzbGFzaGVkUHJvdG9jb2xbcHJvdG9jb2xdKSAmJiBob3N0ICE9PSBmYWxzZSkge1xuICAgIGhvc3QgPSAnLy8nICsgKGhvc3QgfHwgJycpO1xuICAgIGlmIChwYXRobmFtZSAmJiBwYXRobmFtZS5jaGFyQXQoMCkgIT09ICcvJykgcGF0aG5hbWUgPSAnLycgKyBwYXRobmFtZTtcbiAgfSBlbHNlIGlmICghaG9zdCkge1xuICAgIGhvc3QgPSAnJztcbiAgfVxuXG4gIGlmIChoYXNoICYmIGhhc2guY2hhckF0KDApICE9PSAnIycpIGhhc2ggPSAnIycgKyBoYXNoO1xuICBpZiAoc2VhcmNoICYmIHNlYXJjaC5jaGFyQXQoMCkgIT09ICc/Jykgc2VhcmNoID0gJz8nICsgc2VhcmNoO1xuXG4gIHBhdGhuYW1lID0gcGF0aG5hbWUucmVwbGFjZSgvWz8jXS9nLCBmdW5jdGlvbihtYXRjaCkge1xuICAgIHJldHVybiBlbmNvZGVVUklDb21wb25lbnQobWF0Y2gpO1xuICB9KTtcbiAgc2VhcmNoID0gc2VhcmNoLnJlcGxhY2UoJyMnLCAnJTIzJyk7XG5cbiAgcmV0dXJuIHByb3RvY29sICsgaG9zdCArIHBhdGhuYW1lICsgc2VhcmNoICsgaGFzaDtcbn07XG5cbmZ1bmN0aW9uIHVybFJlc29sdmUoc291cmNlLCByZWxhdGl2ZSkge1xuICByZXR1cm4gdXJsUGFyc2Uoc291cmNlLCBmYWxzZSwgdHJ1ZSkucmVzb2x2ZShyZWxhdGl2ZSk7XG59XG5cblVybC5wcm90b3R5cGUucmVzb2x2ZSA9IGZ1bmN0aW9uKHJlbGF0aXZlKSB7XG4gIHJldHVybiB0aGlzLnJlc29sdmVPYmplY3QodXJsUGFyc2UocmVsYXRpdmUsIGZhbHNlLCB0cnVlKSkuZm9ybWF0KCk7XG59O1xuXG5mdW5jdGlvbiB1cmxSZXNvbHZlT2JqZWN0KHNvdXJjZSwgcmVsYXRpdmUpIHtcbiAgaWYgKCFzb3VyY2UpIHJldHVybiByZWxhdGl2ZTtcbiAgcmV0dXJuIHVybFBhcnNlKHNvdXJjZSwgZmFsc2UsIHRydWUpLnJlc29sdmVPYmplY3QocmVsYXRpdmUpO1xufVxuXG5VcmwucHJvdG90eXBlLnJlc29sdmVPYmplY3QgPSBmdW5jdGlvbihyZWxhdGl2ZSkge1xuICBpZiAodXRpbC5pc1N0cmluZyhyZWxhdGl2ZSkpIHtcbiAgICB2YXIgcmVsID0gbmV3IFVybCgpO1xuICAgIHJlbC5wYXJzZShyZWxhdGl2ZSwgZmFsc2UsIHRydWUpO1xuICAgIHJlbGF0aXZlID0gcmVsO1xuICB9XG5cbiAgdmFyIHJlc3VsdCA9IG5ldyBVcmwoKTtcbiAgdmFyIHRrZXlzID0gT2JqZWN0LmtleXModGhpcyk7XG4gIGZvciAodmFyIHRrID0gMDsgdGsgPCB0a2V5cy5sZW5ndGg7IHRrKyspIHtcbiAgICB2YXIgdGtleSA9IHRrZXlzW3RrXTtcbiAgICByZXN1bHRbdGtleV0gPSB0aGlzW3RrZXldO1xuICB9XG5cbiAgLy8gaGFzaCBpcyBhbHdheXMgb3ZlcnJpZGRlbiwgbm8gbWF0dGVyIHdoYXQuXG4gIC8vIGV2ZW4gaHJlZj1cIlwiIHdpbGwgcmVtb3ZlIGl0LlxuICByZXN1bHQuaGFzaCA9IHJlbGF0aXZlLmhhc2g7XG5cbiAgLy8gaWYgdGhlIHJlbGF0aXZlIHVybCBpcyBlbXB0eSwgdGhlbiB0aGVyZSdzIG5vdGhpbmcgbGVmdCB0byBkbyBoZXJlLlxuICBpZiAocmVsYXRpdmUuaHJlZiA9PT0gJycpIHtcbiAgICByZXN1bHQuaHJlZiA9IHJlc3VsdC5mb3JtYXQoKTtcbiAgICByZXR1cm4gcmVzdWx0O1xuICB9XG5cbiAgLy8gaHJlZnMgbGlrZSAvL2Zvby9iYXIgYWx3YXlzIGN1dCB0byB0aGUgcHJvdG9jb2wuXG4gIGlmIChyZWxhdGl2ZS5zbGFzaGVzICYmICFyZWxhdGl2ZS5wcm90b2NvbCkge1xuICAgIC8vIHRha2UgZXZlcnl0aGluZyBleGNlcHQgdGhlIHByb3RvY29sIGZyb20gcmVsYXRpdmVcbiAgICB2YXIgcmtleXMgPSBPYmplY3Qua2V5cyhyZWxhdGl2ZSk7XG4gICAgZm9yICh2YXIgcmsgPSAwOyByayA8IHJrZXlzLmxlbmd0aDsgcmsrKykge1xuICAgICAgdmFyIHJrZXkgPSBya2V5c1tya107XG4gICAgICBpZiAocmtleSAhPT0gJ3Byb3RvY29sJylcbiAgICAgICAgcmVzdWx0W3JrZXldID0gcmVsYXRpdmVbcmtleV07XG4gICAgfVxuXG4gICAgLy91cmxQYXJzZSBhcHBlbmRzIHRyYWlsaW5nIC8gdG8gdXJscyBsaWtlIGh0dHA6Ly93d3cuZXhhbXBsZS5jb21cbiAgICBpZiAoc2xhc2hlZFByb3RvY29sW3Jlc3VsdC5wcm90b2NvbF0gJiZcbiAgICAgICAgcmVzdWx0Lmhvc3RuYW1lICYmICFyZXN1bHQucGF0aG5hbWUpIHtcbiAgICAgIHJlc3VsdC5wYXRoID0gcmVzdWx0LnBhdGhuYW1lID0gJy8nO1xuICAgIH1cblxuICAgIHJlc3VsdC5ocmVmID0gcmVzdWx0LmZvcm1hdCgpO1xuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cblxuICBpZiAocmVsYXRpdmUucHJvdG9jb2wgJiYgcmVsYXRpdmUucHJvdG9jb2wgIT09IHJlc3VsdC5wcm90b2NvbCkge1xuICAgIC8vIGlmIGl0J3MgYSBrbm93biB1cmwgcHJvdG9jb2wsIHRoZW4gY2hhbmdpbmdcbiAgICAvLyB0aGUgcHJvdG9jb2wgZG9lcyB3ZWlyZCB0aGluZ3NcbiAgICAvLyBmaXJzdCwgaWYgaXQncyBub3QgZmlsZTosIHRoZW4gd2UgTVVTVCBoYXZlIGEgaG9zdCxcbiAgICAvLyBhbmQgaWYgdGhlcmUgd2FzIGEgcGF0aFxuICAgIC8vIHRvIGJlZ2luIHdpdGgsIHRoZW4gd2UgTVVTVCBoYXZlIGEgcGF0aC5cbiAgICAvLyBpZiBpdCBpcyBmaWxlOiwgdGhlbiB0aGUgaG9zdCBpcyBkcm9wcGVkLFxuICAgIC8vIGJlY2F1c2UgdGhhdCdzIGtub3duIHRvIGJlIGhvc3RsZXNzLlxuICAgIC8vIGFueXRoaW5nIGVsc2UgaXMgYXNzdW1lZCB0byBiZSBhYnNvbHV0ZS5cbiAgICBpZiAoIXNsYXNoZWRQcm90b2NvbFtyZWxhdGl2ZS5wcm90b2NvbF0pIHtcbiAgICAgIHZhciBrZXlzID0gT2JqZWN0LmtleXMocmVsYXRpdmUpO1xuICAgICAgZm9yICh2YXIgdiA9IDA7IHYgPCBrZXlzLmxlbmd0aDsgdisrKSB7XG4gICAgICAgIHZhciBrID0ga2V5c1t2XTtcbiAgICAgICAgcmVzdWx0W2tdID0gcmVsYXRpdmVba107XG4gICAgICB9XG4gICAgICByZXN1bHQuaHJlZiA9IHJlc3VsdC5mb3JtYXQoKTtcbiAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgfVxuXG4gICAgcmVzdWx0LnByb3RvY29sID0gcmVsYXRpdmUucHJvdG9jb2w7XG4gICAgaWYgKCFyZWxhdGl2ZS5ob3N0ICYmICFob3N0bGVzc1Byb3RvY29sW3JlbGF0aXZlLnByb3RvY29sXSkge1xuICAgICAgdmFyIHJlbFBhdGggPSAocmVsYXRpdmUucGF0aG5hbWUgfHwgJycpLnNwbGl0KCcvJyk7XG4gICAgICB3aGlsZSAocmVsUGF0aC5sZW5ndGggJiYgIShyZWxhdGl2ZS5ob3N0ID0gcmVsUGF0aC5zaGlmdCgpKSk7XG4gICAgICBpZiAoIXJlbGF0aXZlLmhvc3QpIHJlbGF0aXZlLmhvc3QgPSAnJztcbiAgICAgIGlmICghcmVsYXRpdmUuaG9zdG5hbWUpIHJlbGF0aXZlLmhvc3RuYW1lID0gJyc7XG4gICAgICBpZiAocmVsUGF0aFswXSAhPT0gJycpIHJlbFBhdGgudW5zaGlmdCgnJyk7XG4gICAgICBpZiAocmVsUGF0aC5sZW5ndGggPCAyKSByZWxQYXRoLnVuc2hpZnQoJycpO1xuICAgICAgcmVzdWx0LnBhdGhuYW1lID0gcmVsUGF0aC5qb2luKCcvJyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJlc3VsdC5wYXRobmFtZSA9IHJlbGF0aXZlLnBhdGhuYW1lO1xuICAgIH1cbiAgICByZXN1bHQuc2VhcmNoID0gcmVsYXRpdmUuc2VhcmNoO1xuICAgIHJlc3VsdC5xdWVyeSA9IHJlbGF0aXZlLnF1ZXJ5O1xuICAgIHJlc3VsdC5ob3N0ID0gcmVsYXRpdmUuaG9zdCB8fCAnJztcbiAgICByZXN1bHQuYXV0aCA9IHJlbGF0aXZlLmF1dGg7XG4gICAgcmVzdWx0Lmhvc3RuYW1lID0gcmVsYXRpdmUuaG9zdG5hbWUgfHwgcmVsYXRpdmUuaG9zdDtcbiAgICByZXN1bHQucG9ydCA9IHJlbGF0aXZlLnBvcnQ7XG4gICAgLy8gdG8gc3VwcG9ydCBodHRwLnJlcXVlc3RcbiAgICBpZiAocmVzdWx0LnBhdGhuYW1lIHx8IHJlc3VsdC5zZWFyY2gpIHtcbiAgICAgIHZhciBwID0gcmVzdWx0LnBhdGhuYW1lIHx8ICcnO1xuICAgICAgdmFyIHMgPSByZXN1bHQuc2VhcmNoIHx8ICcnO1xuICAgICAgcmVzdWx0LnBhdGggPSBwICsgcztcbiAgICB9XG4gICAgcmVzdWx0LnNsYXNoZXMgPSByZXN1bHQuc2xhc2hlcyB8fCByZWxhdGl2ZS5zbGFzaGVzO1xuICAgIHJlc3VsdC5ocmVmID0gcmVzdWx0LmZvcm1hdCgpO1xuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cblxuICB2YXIgaXNTb3VyY2VBYnMgPSAocmVzdWx0LnBhdGhuYW1lICYmIHJlc3VsdC5wYXRobmFtZS5jaGFyQXQoMCkgPT09ICcvJyksXG4gICAgICBpc1JlbEFicyA9IChcbiAgICAgICAgICByZWxhdGl2ZS5ob3N0IHx8XG4gICAgICAgICAgcmVsYXRpdmUucGF0aG5hbWUgJiYgcmVsYXRpdmUucGF0aG5hbWUuY2hhckF0KDApID09PSAnLydcbiAgICAgICksXG4gICAgICBtdXN0RW5kQWJzID0gKGlzUmVsQWJzIHx8IGlzU291cmNlQWJzIHx8XG4gICAgICAgICAgICAgICAgICAgIChyZXN1bHQuaG9zdCAmJiByZWxhdGl2ZS5wYXRobmFtZSkpLFxuICAgICAgcmVtb3ZlQWxsRG90cyA9IG11c3RFbmRBYnMsXG4gICAgICBzcmNQYXRoID0gcmVzdWx0LnBhdGhuYW1lICYmIHJlc3VsdC5wYXRobmFtZS5zcGxpdCgnLycpIHx8IFtdLFxuICAgICAgcmVsUGF0aCA9IHJlbGF0aXZlLnBhdGhuYW1lICYmIHJlbGF0aXZlLnBhdGhuYW1lLnNwbGl0KCcvJykgfHwgW10sXG4gICAgICBwc3ljaG90aWMgPSByZXN1bHQucHJvdG9jb2wgJiYgIXNsYXNoZWRQcm90b2NvbFtyZXN1bHQucHJvdG9jb2xdO1xuXG4gIC8vIGlmIHRoZSB1cmwgaXMgYSBub24tc2xhc2hlZCB1cmwsIHRoZW4gcmVsYXRpdmVcbiAgLy8gbGlua3MgbGlrZSAuLi8uLiBzaG91bGQgYmUgYWJsZVxuICAvLyB0byBjcmF3bCB1cCB0byB0aGUgaG9zdG5hbWUsIGFzIHdlbGwuICBUaGlzIGlzIHN0cmFuZ2UuXG4gIC8vIHJlc3VsdC5wcm90b2NvbCBoYXMgYWxyZWFkeSBiZWVuIHNldCBieSBub3cuXG4gIC8vIExhdGVyIG9uLCBwdXQgdGhlIGZpcnN0IHBhdGggcGFydCBpbnRvIHRoZSBob3N0IGZpZWxkLlxuICBpZiAocHN5Y2hvdGljKSB7XG4gICAgcmVzdWx0Lmhvc3RuYW1lID0gJyc7XG4gICAgcmVzdWx0LnBvcnQgPSBudWxsO1xuICAgIGlmIChyZXN1bHQuaG9zdCkge1xuICAgICAgaWYgKHNyY1BhdGhbMF0gPT09ICcnKSBzcmNQYXRoWzBdID0gcmVzdWx0Lmhvc3Q7XG4gICAgICBlbHNlIHNyY1BhdGgudW5zaGlmdChyZXN1bHQuaG9zdCk7XG4gICAgfVxuICAgIHJlc3VsdC5ob3N0ID0gJyc7XG4gICAgaWYgKHJlbGF0aXZlLnByb3RvY29sKSB7XG4gICAgICByZWxhdGl2ZS5ob3N0bmFtZSA9IG51bGw7XG4gICAgICByZWxhdGl2ZS5wb3J0ID0gbnVsbDtcbiAgICAgIGlmIChyZWxhdGl2ZS5ob3N0KSB7XG4gICAgICAgIGlmIChyZWxQYXRoWzBdID09PSAnJykgcmVsUGF0aFswXSA9IHJlbGF0aXZlLmhvc3Q7XG4gICAgICAgIGVsc2UgcmVsUGF0aC51bnNoaWZ0KHJlbGF0aXZlLmhvc3QpO1xuICAgICAgfVxuICAgICAgcmVsYXRpdmUuaG9zdCA9IG51bGw7XG4gICAgfVxuICAgIG11c3RFbmRBYnMgPSBtdXN0RW5kQWJzICYmIChyZWxQYXRoWzBdID09PSAnJyB8fCBzcmNQYXRoWzBdID09PSAnJyk7XG4gIH1cblxuICBpZiAoaXNSZWxBYnMpIHtcbiAgICAvLyBpdCdzIGFic29sdXRlLlxuICAgIHJlc3VsdC5ob3N0ID0gKHJlbGF0aXZlLmhvc3QgfHwgcmVsYXRpdmUuaG9zdCA9PT0gJycpID9cbiAgICAgICAgICAgICAgICAgIHJlbGF0aXZlLmhvc3QgOiByZXN1bHQuaG9zdDtcbiAgICByZXN1bHQuaG9zdG5hbWUgPSAocmVsYXRpdmUuaG9zdG5hbWUgfHwgcmVsYXRpdmUuaG9zdG5hbWUgPT09ICcnKSA/XG4gICAgICAgICAgICAgICAgICAgICAgcmVsYXRpdmUuaG9zdG5hbWUgOiByZXN1bHQuaG9zdG5hbWU7XG4gICAgcmVzdWx0LnNlYXJjaCA9IHJlbGF0aXZlLnNlYXJjaDtcbiAgICByZXN1bHQucXVlcnkgPSByZWxhdGl2ZS5xdWVyeTtcbiAgICBzcmNQYXRoID0gcmVsUGF0aDtcbiAgICAvLyBmYWxsIHRocm91Z2ggdG8gdGhlIGRvdC1oYW5kbGluZyBiZWxvdy5cbiAgfSBlbHNlIGlmIChyZWxQYXRoLmxlbmd0aCkge1xuICAgIC8vIGl0J3MgcmVsYXRpdmVcbiAgICAvLyB0aHJvdyBhd2F5IHRoZSBleGlzdGluZyBmaWxlLCBhbmQgdGFrZSB0aGUgbmV3IHBhdGggaW5zdGVhZC5cbiAgICBpZiAoIXNyY1BhdGgpIHNyY1BhdGggPSBbXTtcbiAgICBzcmNQYXRoLnBvcCgpO1xuICAgIHNyY1BhdGggPSBzcmNQYXRoLmNvbmNhdChyZWxQYXRoKTtcbiAgICByZXN1bHQuc2VhcmNoID0gcmVsYXRpdmUuc2VhcmNoO1xuICAgIHJlc3VsdC5xdWVyeSA9IHJlbGF0aXZlLnF1ZXJ5O1xuICB9IGVsc2UgaWYgKCF1dGlsLmlzTnVsbE9yVW5kZWZpbmVkKHJlbGF0aXZlLnNlYXJjaCkpIHtcbiAgICAvLyBqdXN0IHB1bGwgb3V0IHRoZSBzZWFyY2guXG4gICAgLy8gbGlrZSBocmVmPSc/Zm9vJy5cbiAgICAvLyBQdXQgdGhpcyBhZnRlciB0aGUgb3RoZXIgdHdvIGNhc2VzIGJlY2F1c2UgaXQgc2ltcGxpZmllcyB0aGUgYm9vbGVhbnNcbiAgICBpZiAocHN5Y2hvdGljKSB7XG4gICAgICByZXN1bHQuaG9zdG5hbWUgPSByZXN1bHQuaG9zdCA9IHNyY1BhdGguc2hpZnQoKTtcbiAgICAgIC8vb2NjYXRpb25hbHkgdGhlIGF1dGggY2FuIGdldCBzdHVjayBvbmx5IGluIGhvc3RcbiAgICAgIC8vdGhpcyBlc3BlY2lhbGx5IGhhcHBlbnMgaW4gY2FzZXMgbGlrZVxuICAgICAgLy91cmwucmVzb2x2ZU9iamVjdCgnbWFpbHRvOmxvY2FsMUBkb21haW4xJywgJ2xvY2FsMkBkb21haW4yJylcbiAgICAgIHZhciBhdXRoSW5Ib3N0ID0gcmVzdWx0Lmhvc3QgJiYgcmVzdWx0Lmhvc3QuaW5kZXhPZignQCcpID4gMCA/XG4gICAgICAgICAgICAgICAgICAgICAgIHJlc3VsdC5ob3N0LnNwbGl0KCdAJykgOiBmYWxzZTtcbiAgICAgIGlmIChhdXRoSW5Ib3N0KSB7XG4gICAgICAgIHJlc3VsdC5hdXRoID0gYXV0aEluSG9zdC5zaGlmdCgpO1xuICAgICAgICByZXN1bHQuaG9zdCA9IHJlc3VsdC5ob3N0bmFtZSA9IGF1dGhJbkhvc3Quc2hpZnQoKTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmVzdWx0LnNlYXJjaCA9IHJlbGF0aXZlLnNlYXJjaDtcbiAgICByZXN1bHQucXVlcnkgPSByZWxhdGl2ZS5xdWVyeTtcbiAgICAvL3RvIHN1cHBvcnQgaHR0cC5yZXF1ZXN0XG4gICAgaWYgKCF1dGlsLmlzTnVsbChyZXN1bHQucGF0aG5hbWUpIHx8ICF1dGlsLmlzTnVsbChyZXN1bHQuc2VhcmNoKSkge1xuICAgICAgcmVzdWx0LnBhdGggPSAocmVzdWx0LnBhdGhuYW1lID8gcmVzdWx0LnBhdGhuYW1lIDogJycpICtcbiAgICAgICAgICAgICAgICAgICAgKHJlc3VsdC5zZWFyY2ggPyByZXN1bHQuc2VhcmNoIDogJycpO1xuICAgIH1cbiAgICByZXN1bHQuaHJlZiA9IHJlc3VsdC5mb3JtYXQoKTtcbiAgICByZXR1cm4gcmVzdWx0O1xuICB9XG5cbiAgaWYgKCFzcmNQYXRoLmxlbmd0aCkge1xuICAgIC8vIG5vIHBhdGggYXQgYWxsLiAgZWFzeS5cbiAgICAvLyB3ZSd2ZSBhbHJlYWR5IGhhbmRsZWQgdGhlIG90aGVyIHN0dWZmIGFib3ZlLlxuICAgIHJlc3VsdC5wYXRobmFtZSA9IG51bGw7XG4gICAgLy90byBzdXBwb3J0IGh0dHAucmVxdWVzdFxuICAgIGlmIChyZXN1bHQuc2VhcmNoKSB7XG4gICAgICByZXN1bHQucGF0aCA9ICcvJyArIHJlc3VsdC5zZWFyY2g7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJlc3VsdC5wYXRoID0gbnVsbDtcbiAgICB9XG4gICAgcmVzdWx0LmhyZWYgPSByZXN1bHQuZm9ybWF0KCk7XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxuXG4gIC8vIGlmIGEgdXJsIEVORHMgaW4gLiBvciAuLiwgdGhlbiBpdCBtdXN0IGdldCBhIHRyYWlsaW5nIHNsYXNoLlxuICAvLyBob3dldmVyLCBpZiBpdCBlbmRzIGluIGFueXRoaW5nIGVsc2Ugbm9uLXNsYXNoeSxcbiAgLy8gdGhlbiBpdCBtdXN0IE5PVCBnZXQgYSB0cmFpbGluZyBzbGFzaC5cbiAgdmFyIGxhc3QgPSBzcmNQYXRoLnNsaWNlKC0xKVswXTtcbiAgdmFyIGhhc1RyYWlsaW5nU2xhc2ggPSAoXG4gICAgICAocmVzdWx0Lmhvc3QgfHwgcmVsYXRpdmUuaG9zdCB8fCBzcmNQYXRoLmxlbmd0aCA+IDEpICYmXG4gICAgICAobGFzdCA9PT0gJy4nIHx8IGxhc3QgPT09ICcuLicpIHx8IGxhc3QgPT09ICcnKTtcblxuICAvLyBzdHJpcCBzaW5nbGUgZG90cywgcmVzb2x2ZSBkb3VibGUgZG90cyB0byBwYXJlbnQgZGlyXG4gIC8vIGlmIHRoZSBwYXRoIHRyaWVzIHRvIGdvIGFib3ZlIHRoZSByb290LCBgdXBgIGVuZHMgdXAgPiAwXG4gIHZhciB1cCA9IDA7XG4gIGZvciAodmFyIGkgPSBzcmNQYXRoLmxlbmd0aDsgaSA+PSAwOyBpLS0pIHtcbiAgICBsYXN0ID0gc3JjUGF0aFtpXTtcbiAgICBpZiAobGFzdCA9PT0gJy4nKSB7XG4gICAgICBzcmNQYXRoLnNwbGljZShpLCAxKTtcbiAgICB9IGVsc2UgaWYgKGxhc3QgPT09ICcuLicpIHtcbiAgICAgIHNyY1BhdGguc3BsaWNlKGksIDEpO1xuICAgICAgdXArKztcbiAgICB9IGVsc2UgaWYgKHVwKSB7XG4gICAgICBzcmNQYXRoLnNwbGljZShpLCAxKTtcbiAgICAgIHVwLS07XG4gICAgfVxuICB9XG5cbiAgLy8gaWYgdGhlIHBhdGggaXMgYWxsb3dlZCB0byBnbyBhYm92ZSB0aGUgcm9vdCwgcmVzdG9yZSBsZWFkaW5nIC4uc1xuICBpZiAoIW11c3RFbmRBYnMgJiYgIXJlbW92ZUFsbERvdHMpIHtcbiAgICBmb3IgKDsgdXAtLTsgdXApIHtcbiAgICAgIHNyY1BhdGgudW5zaGlmdCgnLi4nKTtcbiAgICB9XG4gIH1cblxuICBpZiAobXVzdEVuZEFicyAmJiBzcmNQYXRoWzBdICE9PSAnJyAmJlxuICAgICAgKCFzcmNQYXRoWzBdIHx8IHNyY1BhdGhbMF0uY2hhckF0KDApICE9PSAnLycpKSB7XG4gICAgc3JjUGF0aC51bnNoaWZ0KCcnKTtcbiAgfVxuXG4gIGlmIChoYXNUcmFpbGluZ1NsYXNoICYmIChzcmNQYXRoLmpvaW4oJy8nKS5zdWJzdHIoLTEpICE9PSAnLycpKSB7XG4gICAgc3JjUGF0aC5wdXNoKCcnKTtcbiAgfVxuXG4gIHZhciBpc0Fic29sdXRlID0gc3JjUGF0aFswXSA9PT0gJycgfHxcbiAgICAgIChzcmNQYXRoWzBdICYmIHNyY1BhdGhbMF0uY2hhckF0KDApID09PSAnLycpO1xuXG4gIC8vIHB1dCB0aGUgaG9zdCBiYWNrXG4gIGlmIChwc3ljaG90aWMpIHtcbiAgICByZXN1bHQuaG9zdG5hbWUgPSByZXN1bHQuaG9zdCA9IGlzQWJzb2x1dGUgPyAnJyA6XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBzcmNQYXRoLmxlbmd0aCA/IHNyY1BhdGguc2hpZnQoKSA6ICcnO1xuICAgIC8vb2NjYXRpb25hbHkgdGhlIGF1dGggY2FuIGdldCBzdHVjayBvbmx5IGluIGhvc3RcbiAgICAvL3RoaXMgZXNwZWNpYWxseSBoYXBwZW5zIGluIGNhc2VzIGxpa2VcbiAgICAvL3VybC5yZXNvbHZlT2JqZWN0KCdtYWlsdG86bG9jYWwxQGRvbWFpbjEnLCAnbG9jYWwyQGRvbWFpbjInKVxuICAgIHZhciBhdXRoSW5Ib3N0ID0gcmVzdWx0Lmhvc3QgJiYgcmVzdWx0Lmhvc3QuaW5kZXhPZignQCcpID4gMCA/XG4gICAgICAgICAgICAgICAgICAgICByZXN1bHQuaG9zdC5zcGxpdCgnQCcpIDogZmFsc2U7XG4gICAgaWYgKGF1dGhJbkhvc3QpIHtcbiAgICAgIHJlc3VsdC5hdXRoID0gYXV0aEluSG9zdC5zaGlmdCgpO1xuICAgICAgcmVzdWx0Lmhvc3QgPSByZXN1bHQuaG9zdG5hbWUgPSBhdXRoSW5Ib3N0LnNoaWZ0KCk7XG4gICAgfVxuICB9XG5cbiAgbXVzdEVuZEFicyA9IG11c3RFbmRBYnMgfHwgKHJlc3VsdC5ob3N0ICYmIHNyY1BhdGgubGVuZ3RoKTtcblxuICBpZiAobXVzdEVuZEFicyAmJiAhaXNBYnNvbHV0ZSkge1xuICAgIHNyY1BhdGgudW5zaGlmdCgnJyk7XG4gIH1cblxuICBpZiAoIXNyY1BhdGgubGVuZ3RoKSB7XG4gICAgcmVzdWx0LnBhdGhuYW1lID0gbnVsbDtcbiAgICByZXN1bHQucGF0aCA9IG51bGw7XG4gIH0gZWxzZSB7XG4gICAgcmVzdWx0LnBhdGhuYW1lID0gc3JjUGF0aC5qb2luKCcvJyk7XG4gIH1cblxuICAvL3RvIHN1cHBvcnQgcmVxdWVzdC5odHRwXG4gIGlmICghdXRpbC5pc051bGwocmVzdWx0LnBhdGhuYW1lKSB8fCAhdXRpbC5pc051bGwocmVzdWx0LnNlYXJjaCkpIHtcbiAgICByZXN1bHQucGF0aCA9IChyZXN1bHQucGF0aG5hbWUgPyByZXN1bHQucGF0aG5hbWUgOiAnJykgK1xuICAgICAgICAgICAgICAgICAgKHJlc3VsdC5zZWFyY2ggPyByZXN1bHQuc2VhcmNoIDogJycpO1xuICB9XG4gIHJlc3VsdC5hdXRoID0gcmVsYXRpdmUuYXV0aCB8fCByZXN1bHQuYXV0aDtcbiAgcmVzdWx0LnNsYXNoZXMgPSByZXN1bHQuc2xhc2hlcyB8fCByZWxhdGl2ZS5zbGFzaGVzO1xuICByZXN1bHQuaHJlZiA9IHJlc3VsdC5mb3JtYXQoKTtcbiAgcmV0dXJuIHJlc3VsdDtcbn07XG5cblVybC5wcm90b3R5cGUucGFyc2VIb3N0ID0gZnVuY3Rpb24oKSB7XG4gIHZhciBob3N0ID0gdGhpcy5ob3N0O1xuICB2YXIgcG9ydCA9IHBvcnRQYXR0ZXJuLmV4ZWMoaG9zdCk7XG4gIGlmIChwb3J0KSB7XG4gICAgcG9ydCA9IHBvcnRbMF07XG4gICAgaWYgKHBvcnQgIT09ICc6Jykge1xuICAgICAgdGhpcy5wb3J0ID0gcG9ydC5zdWJzdHIoMSk7XG4gICAgfVxuICAgIGhvc3QgPSBob3N0LnN1YnN0cigwLCBob3N0Lmxlbmd0aCAtIHBvcnQubGVuZ3RoKTtcbiAgfVxuICBpZiAoaG9zdCkgdGhpcy5ob3N0bmFtZSA9IGhvc3Q7XG59O1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG5tb2R1bGUuZXhwb3J0cyA9IHtcbiAgaXNTdHJpbmc6IGZ1bmN0aW9uKGFyZykge1xuICAgIHJldHVybiB0eXBlb2YoYXJnKSA9PT0gJ3N0cmluZyc7XG4gIH0sXG4gIGlzT2JqZWN0OiBmdW5jdGlvbihhcmcpIHtcbiAgICByZXR1cm4gdHlwZW9mKGFyZykgPT09ICdvYmplY3QnICYmIGFyZyAhPT0gbnVsbDtcbiAgfSxcbiAgaXNOdWxsOiBmdW5jdGlvbihhcmcpIHtcbiAgICByZXR1cm4gYXJnID09PSBudWxsO1xuICB9LFxuICBpc051bGxPclVuZGVmaW5lZDogZnVuY3Rpb24oYXJnKSB7XG4gICAgcmV0dXJuIGFyZyA9PSBudWxsO1xuICB9XG59O1xuIiwibW9kdWxlLmV4cG9ydHMgPSBleHRlbmRcblxudmFyIGhhc093blByb3BlcnR5ID0gT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eTtcblxuZnVuY3Rpb24gZXh0ZW5kKCkge1xuICAgIHZhciB0YXJnZXQgPSB7fVxuXG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBhcmd1bWVudHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgdmFyIHNvdXJjZSA9IGFyZ3VtZW50c1tpXVxuXG4gICAgICAgIGZvciAodmFyIGtleSBpbiBzb3VyY2UpIHtcbiAgICAgICAgICAgIGlmIChoYXNPd25Qcm9wZXJ0eS5jYWxsKHNvdXJjZSwga2V5KSkge1xuICAgICAgICAgICAgICAgIHRhcmdldFtrZXldID0gc291cmNlW2tleV1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiB0YXJnZXRcbn1cbiIsIm1vZHVsZS5leHBvcnRzID0gT2JqZWN0LmZyZWV6ZSh7XCJiaWxsXCI6e1widm9sdW1lXCI6XCJjb2RlVm9sdW1lXCIsXCJwYWdlc1wiOlwiY29kZVBhZ2VzXCIsXCJudW1iZXJcIjpcImJpbGxOdW1iZXJcIn0sXCJjYXNlXCI6e1widm9sdW1lXCI6XCJyZXBvcnRlclZvbHVtZVwiLFwicGFnZXNcIjpcImZpcnN0UGFnZVwiLFwiZGF0ZVwiOlwiZGF0ZURlY2lkZWRcIixcIm51bWJlclwiOlwiZG9ja2V0TnVtYmVyXCIsXCJ0aXRsZVwiOlwiY2FzZU5hbWVcIn0sXCJ0aGVzaXNcIjp7XCJwdWJsaXNoZXJcIjpcInVuaXZlcnNpdHlcIixcInR5cGVcIjpcInRoZXNpc1R5cGVcIn0sXCJmaWxtXCI6e1wicHVibGlzaGVyXCI6XCJkaXN0cmlidXRvclwiLFwidHlwZVwiOlwiZ2VucmVcIixcIm1lZGl1bVwiOlwidmlkZW9SZWNvcmRpbmdGb3JtYXRcIn0sXCJyZXBvcnRcIjp7XCJwdWJsaXNoZXJcIjpcImluc3RpdHV0aW9uXCIsXCJudW1iZXJcIjpcInJlcG9ydE51bWJlclwiLFwidHlwZVwiOlwicmVwb3J0VHlwZVwifSxcImF1ZGlvUmVjb3JkaW5nXCI6e1wicHVibGlzaGVyXCI6XCJsYWJlbFwiLFwibWVkaXVtXCI6XCJhdWRpb1JlY29yZGluZ0Zvcm1hdFwifSxcInZpZGVvUmVjb3JkaW5nXCI6e1wicHVibGlzaGVyXCI6XCJzdHVkaW9cIixcIm1lZGl1bVwiOlwidmlkZW9SZWNvcmRpbmdGb3JtYXRcIn0sXCJ0dkJyb2FkY2FzdFwiOntcInB1Ymxpc2hlclwiOlwibmV0d29ya1wiLFwicHVibGljYXRpb25UaXRsZVwiOlwicHJvZ3JhbVRpdGxlXCIsXCJudW1iZXJcIjpcImVwaXNvZGVOdW1iZXJcIixcIm1lZGl1bVwiOlwidmlkZW9SZWNvcmRpbmdGb3JtYXRcIn0sXCJyYWRpb0Jyb2FkY2FzdFwiOntcInB1Ymxpc2hlclwiOlwibmV0d29ya1wiLFwicHVibGljYXRpb25UaXRsZVwiOlwicHJvZ3JhbVRpdGxlXCIsXCJudW1iZXJcIjpcImVwaXNvZGVOdW1iZXJcIixcIm1lZGl1bVwiOlwiYXVkaW9SZWNvcmRpbmdGb3JtYXRcIn0sXCJjb21wdXRlclByb2dyYW1cIjp7XCJwdWJsaXNoZXJcIjpcImNvbXBhbnlcIn0sXCJib29rU2VjdGlvblwiOntcInB1YmxpY2F0aW9uVGl0bGVcIjpcImJvb2tUaXRsZVwifSxcImNvbmZlcmVuY2VQYXBlclwiOntcInB1YmxpY2F0aW9uVGl0bGVcIjpcInByb2NlZWRpbmdzVGl0bGVcIn0sXCJ3ZWJwYWdlXCI6e1wicHVibGljYXRpb25UaXRsZVwiOlwid2Vic2l0ZVRpdGxlXCIsXCJ0eXBlXCI6XCJ3ZWJzaXRlVHlwZVwifSxcImJsb2dQb3N0XCI6e1wicHVibGljYXRpb25UaXRsZVwiOlwiYmxvZ1RpdGxlXCIsXCJ0eXBlXCI6XCJ3ZWJzaXRlVHlwZVwifSxcImZvcnVtUG9zdFwiOntcInB1YmxpY2F0aW9uVGl0bGVcIjpcImZvcnVtVGl0bGVcIixcInR5cGVcIjpcInBvc3RUeXBlXCJ9LFwiZW5jeWNsb3BlZGlhQXJ0aWNsZVwiOntcInB1YmxpY2F0aW9uVGl0bGVcIjpcImVuY3ljbG9wZWRpYVRpdGxlXCJ9LFwiZGljdGlvbmFyeUVudHJ5XCI6e1wicHVibGljYXRpb25UaXRsZVwiOlwiZGljdGlvbmFyeVRpdGxlXCJ9LFwicGF0ZW50XCI6e1wiZGF0ZVwiOlwiaXNzdWVEYXRlXCIsXCJudW1iZXJcIjpcInBhdGVudE51bWJlclwifSxcInN0YXR1dGVcIjp7XCJkYXRlXCI6XCJkYXRlRW5hY3RlZFwiLFwibnVtYmVyXCI6XCJwdWJsaWNMYXdOdW1iZXJcIixcInRpdGxlXCI6XCJuYW1lT2ZBY3RcIn0sXCJoZWFyaW5nXCI6e1wibnVtYmVyXCI6XCJkb2N1bWVudE51bWJlclwifSxcInBvZGNhc3RcIjp7XCJudW1iZXJcIjpcImVwaXNvZGVOdW1iZXJcIixcIm1lZGl1bVwiOlwiYXVkaW9GaWxlVHlwZVwifSxcImxldHRlclwiOntcInR5cGVcIjpcImxldHRlclR5cGVcIn0sXCJtYW51c2NyaXB0XCI6e1widHlwZVwiOlwibWFudXNjcmlwdFR5cGVcIn0sXCJtYXBcIjp7XCJ0eXBlXCI6XCJtYXBUeXBlXCJ9LFwicHJlc2VudGF0aW9uXCI6e1widHlwZVwiOlwicHJlc2VudGF0aW9uVHlwZVwifSxcImludGVydmlld1wiOntcIm1lZGl1bVwiOlwiaW50ZXJ2aWV3TWVkaXVtXCJ9LFwiYXJ0d29ya1wiOntcIm1lZGl1bVwiOlwiYXJ0d29ya01lZGl1bVwifSxcImVtYWlsXCI6e1widGl0bGVcIjpcInN1YmplY3RcIn19KTsiLCIndXNlIHN0cmljdCc7XG5cbmNvbnN0IGRhdGVUb1NxbCA9IHJlcXVpcmUoJy4uL3pvdGVyby1zaGltL2RhdGUtdG8tc3FsJyk7XG5jb25zdCBkZWZhdWx0cyA9IHJlcXVpcmUoJy4vZGVmYXVsdHMnKTtcbmNvbnN0IGl0ZW1Ub0NTTEpTT04gPSByZXF1aXJlKCcuLi96b3Rlcm8tc2hpbS9pdGVtLXRvLWNzbC1qc29uJyk7XG5jb25zdCBwYXJzZUxpbmtIZWFkZXIgPSByZXF1aXJlKCdwYXJzZS1saW5rLWhlYWRlcicpO1xuY29uc3QgeyB1dWlkNCwgaXNMaWtlWm90ZXJvSXRlbSB9ID0gcmVxdWlyZSgnLi91dGlscycpO1xuY29uc3QgWyBDT01QTEVURSwgTVVMVElQTEVfSVRFTVMsIEZBSUxFRCBdID0gWyAnQ09NUExFVEUnLCAnTVVMVElQTEVfSVRFTVMnLCAnRkFJTEVEJyBdO1xuXG5jbGFzcyBab3Rlcm9CaWIge1xuXHRjb25zdHJ1Y3RvcihvcHRzKSB7XG5cdFx0dGhpcy5vcHRzID0ge1xuXHRcdFx0c2Vzc2lvbmlkOiB1dWlkNCgpLFxuXHRcdFx0Li4uZGVmYXVsdHMoKSxcblx0XHRcdC4uLm9wdHNcblx0XHR9O1xuXG5cdFx0aWYodGhpcy5vcHRzLnBlcnNpc3QgJiYgdGhpcy5vcHRzLnN0b3JhZ2UpIHtcblx0XHRcdGlmKCEoJ2dldEl0ZW0nIGluIHRoaXMub3B0cy5zdG9yYWdlIHx8XG5cdFx0XHRcdCdzZXRJdGVtJyBpbiB0aGlzLm9wdHMuc3RvcmFnZSB8fFxuXHRcdFx0XHQnY2xlYXInIGluIHRoaXMub3B0cy5zdG9yYWdlXG5cdFx0XHQpKSB7XG5cdFx0XHRcdHRocm93IG5ldyBFcnJvcignSW52YWxpZCBzdG9yYWdlIGVuZ2luZSBwcm92aWRlZCcpO1xuXHRcdFx0fVxuXHRcdFx0aWYodGhpcy5vcHRzLm92ZXJyaWRlKSB7XG5cdFx0XHRcdHRoaXMuY2xlYXJJdGVtcygpO1xuXHRcdFx0fVxuXHRcdFx0dGhpcy5pdGVtcyA9IFsuLi50aGlzLm9wdHMuaW5pdGlhbEl0ZW1zLCAuLi50aGlzLmdldEl0ZW1zU3RvcmFnZSgpXVxuXHRcdFx0XHQuZmlsdGVyKGlzTGlrZVpvdGVyb0l0ZW0pO1xuXHRcdFx0dGhpcy5zZXRJdGVtc1N0b3JhZ2UodGhpcy5pdGVtcyk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHRoaXMuaXRlbXMgPSBbLi4udGhpcy5vcHRzLmluaXRpYWxJdGVtc10uZmlsdGVyKGlzTGlrZVpvdGVyb0l0ZW0pO1xuXHRcdH1cblx0fVxuXG5cdGdldEl0ZW1zU3RvcmFnZSgpIHtcblx0XHRsZXQgaXRlbXMgPSB0aGlzLm9wdHMuc3RvcmFnZS5nZXRJdGVtKGAke3RoaXMub3B0cy5zdG9yYWdlUHJlZml4fS1pdGVtc2ApO1xuXHRcdHJldHVybiBpdGVtcyA/IEpTT04ucGFyc2UoaXRlbXMpIDogW107XG5cdH1cblxuXHRzZXRJdGVtc1N0b3JhZ2UoaXRlbXMpIHtcblx0XHR0aGlzLm9wdHMuc3RvcmFnZS5zZXRJdGVtKFxuXHRcdFx0YCR7dGhpcy5vcHRzLnN0b3JhZ2VQcmVmaXh9LWl0ZW1zYCxcblx0XHRcdEpTT04uc3RyaW5naWZ5KGl0ZW1zKVxuXHRcdCk7XG5cdH1cblxuXHRyZWxvYWRJdGVtcygpIHtcblx0XHR0aGlzLml0ZW1zID0gdGhpcy5nZXRJdGVtc1N0b3JhZ2UoKTtcblx0fVxuXG5cdGFkZEl0ZW0oaXRlbSkge1xuXHRcdGlmKCFpc0xpa2Vab3Rlcm9JdGVtKGl0ZW0pKSB7XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoJ0ZhaWxlZCB0byBhZGQgaXRlbScpO1xuXHRcdH1cblx0XHR0aGlzLml0ZW1zLnB1c2goaXRlbSk7XG5cdFx0aWYodGhpcy5vcHRzLnBlcnNpc3QpIHtcblx0XHRcdHRoaXMuc2V0SXRlbXNTdG9yYWdlKHRoaXMuaXRlbXMpO1xuXHRcdH1cblx0fVxuXG5cdHVwZGF0ZUl0ZW0oaW5kZXgsIGl0ZW0pIHtcblx0XHR0aGlzLml0ZW1zW2luZGV4XSA9IGl0ZW07XG5cdFx0aWYodGhpcy5vcHRzLnBlcnNpc3QpIHtcblx0XHRcdHRoaXMuc2V0SXRlbXNTdG9yYWdlKHRoaXMuaXRlbXMpO1xuXHRcdH1cblx0fVxuXG5cdHJlbW92ZUl0ZW0oaXRlbSkge1xuXHRcdGxldCBpbmRleCA9IHRoaXMuaXRlbXMuaW5kZXhPZihpdGVtKTtcblx0XHRpZihpbmRleCAhPT0gLTEpIHtcblx0XHRcdHRoaXMuaXRlbXMuc3BsaWNlKGluZGV4LCAxKTtcblx0XHRcdGlmKHRoaXMub3B0cy5wZXJzaXN0KSB7XG5cdFx0XHRcdHRoaXMuc2V0SXRlbXNTdG9yYWdlKHRoaXMuaXRlbXMpO1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIGl0ZW07XG5cdFx0fVxuXHRcdHJldHVybiBmYWxzZTtcblx0fVxuXG5cdGNsZWFySXRlbXMoKSB7XG5cdFx0dGhpcy5pdGVtcyA9IFtdO1xuXHRcdGlmKHRoaXMub3B0cy5wZXJzaXN0KSB7XG5cdFx0XHR0aGlzLnNldEl0ZW1zU3RvcmFnZSh0aGlzLml0ZW1zKTtcblx0XHR9XG5cdH1cblxuXHRnZXQgaXRlbXNDU0woKSB7XG5cdFx0cmV0dXJuIHRoaXMuaXRlbXMubWFwKGkgPT4gaXRlbVRvQ1NMSlNPTihpKSlcblx0fVxuXG5cdGdldCBpdGVtc1JhdygpIHtcblx0XHRyZXR1cm4gdGhpcy5pdGVtcztcblx0fVxuXG5cdGFzeW5jIGV4cG9ydEl0ZW1zKGZvcm1hdCkge1xuXHRcdGxldCB0cmFuc2xhdGVVUkwgPSBgJHt0aGlzLm9wdHMudHJhbnNsYXRlVVJMfS8ke3RoaXMub3B0cy50cmFuc2xhdGVQcmVmaXh9ZXhwb3J0P2Zvcm1hdD0ke2Zvcm1hdH1gO1xuXHRcdGxldCBmZXRjaE9wdGlvbnMgPSB7XG5cdFx0XHRtZXRob2Q6ICdQT1NUJyxcblx0XHRcdGhlYWRlcnM6IHtcblx0XHRcdFx0J0NvbnRlbnQtVHlwZSc6ICdhcHBsaWNhdGlvbi9qc29uJ1xuXHRcdFx0fSxcblx0XHRcdGJvZHk6IEpTT04uc3RyaW5naWZ5KHRoaXMuaXRlbXMuZmlsdGVyKGkgPT4gJ2tleScgaW4gaSApKSxcblx0XHRcdC4uLnRoaXMub3B0cy5pbml0XG5cdFx0fVxuXHRcdGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgZmV0Y2godHJhbnNsYXRlVVJMLCBmZXRjaE9wdGlvbnMpO1xuXHRcdGlmKHJlc3BvbnNlLm9rKSB7XG5cdFx0XHRyZXR1cm4gYXdhaXQgcmVzcG9uc2UudGV4dCgpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoJ0ZhaWxlZCB0byBleHBvcnQgaXRlbXMnKTtcblx0XHR9XG5cdH1cblxuXHRhc3luYyB0cmFuc2xhdGVJZGVudGlmaWVyKGlkZW50aWZpZXIsIC4uLmFyZ3MpIHtcblx0XHRsZXQgdHJhbnNsYXRlVVJMID0gYCR7dGhpcy5vcHRzLnRyYW5zbGF0ZVVSTH0vJHt0aGlzLm9wdHMudHJhbnNsYXRlUHJlZml4fXNlYXJjaGA7XG5cdFx0bGV0IGluaXQgPSB7XG5cdFx0XHRtZXRob2Q6ICdQT1NUJyxcblx0XHRcdGhlYWRlcnM6IHtcblx0XHRcdFx0J0NvbnRlbnQtVHlwZSc6ICd0ZXh0L3BsYWluJ1xuXHRcdFx0fSxcblx0XHRcdGJvZHk6IGlkZW50aWZpZXIsXG5cdFx0XHQuLi50aGlzLm9wdHMuaW5pdFxuXHRcdH07XG5cblx0XHRyZXR1cm4gYXdhaXQgdGhpcy50cmFuc2xhdGUodHJhbnNsYXRlVVJMLCBpbml0LCAuLi5hcmdzKTtcblx0fVxuXG5cdGFzeW5jIHRyYW5zbGF0ZVVybEl0ZW1zKHVybCwgaXRlbXMsIC4uLmFyZ3MpIHtcblx0XHRsZXQgdHJhbnNsYXRlVVJMID0gYCR7dGhpcy5vcHRzLnRyYW5zbGF0ZVVSTH0vJHt0aGlzLm9wdHMudHJhbnNsYXRlUHJlZml4fXdlYmA7XG5cdFx0bGV0IHNlc3Npb25pZCA9IHRoaXMub3B0cy5zZXNzaW9uaWQ7XG5cdFx0bGV0IGRhdGEgPSB7IHVybCwgaXRlbXMsIHNlc3Npb25pZCwgLi4udGhpcy5vcHRzLnJlcXVlc3QgfTtcblxuXHRcdGxldCBpbml0ID0ge1xuXHRcdFx0bWV0aG9kOiAnUE9TVCcsXG5cdFx0XHRoZWFkZXJzOiB7XG5cdFx0XHRcdCdDb250ZW50LVR5cGUnOiAnYXBwbGljYXRpb24vanNvbidcblx0XHRcdH0sXG5cdFx0XHRib2R5OiBKU09OLnN0cmluZ2lmeShkYXRhKSxcblx0XHRcdC4uLnRoaXMub3B0cy5pbml0XG5cdFx0fTtcblxuXHRcdHJldHVybiBhd2FpdCB0aGlzLnRyYW5zbGF0ZSh0cmFuc2xhdGVVUkwsIGluaXQsIC4uLmFyZ3MpO1xuXHR9XG5cblx0YXN5bmMgdHJhbnNsYXRlVXJsKHVybCwgLi4uYXJncykge1xuXHRcdGxldCB0cmFuc2xhdGVVUkwgPSBgJHt0aGlzLm9wdHMudHJhbnNsYXRlVVJMfS8ke3RoaXMub3B0cy50cmFuc2xhdGVQcmVmaXh9d2ViYDtcblx0XHRsZXQgc2Vzc2lvbmlkID0gdGhpcy5vcHRzLnNlc3Npb25pZDtcblx0XHRsZXQgZGF0YSA9IHsgdXJsLCBzZXNzaW9uaWQsIC4uLnRoaXMub3B0cy5yZXF1ZXN0IH07XG5cblx0XHRsZXQgaW5pdCA9IHtcblx0XHRcdG1ldGhvZDogJ1BPU1QnLFxuXHRcdFx0aGVhZGVyczoge1xuXHRcdFx0XHQnQ29udGVudC1UeXBlJzogJ2FwcGxpY2F0aW9uL2pzb24nXG5cdFx0XHR9LFxuXHRcdFx0Ym9keTogSlNPTi5zdHJpbmdpZnkoZGF0YSksXG5cdFx0XHQuLi50aGlzLm9wdHMuaW5pdFxuXHRcdH07XG5cblx0XHRyZXR1cm4gYXdhaXQgdGhpcy50cmFuc2xhdGUodHJhbnNsYXRlVVJMLCBpbml0LCAuLi5hcmdzKTtcblx0fVxuXG5cdGFzeW5jIHRyYW5zbGF0ZSh1cmwsIGZldGNoT3B0aW9ucywgYWRkPXRydWUpIHtcblx0XHRjb25zdCByZXNwb25zZSA9IGF3YWl0IGZldGNoKHVybCwgZmV0Y2hPcHRpb25zKTtcblx0XHR2YXIgaXRlbXMsIHJlc3VsdCwgbGlua3MgPSB7fTtcblxuXHRcdGlmKHJlc3BvbnNlLmhlYWRlcnMuaGFzKCdMaW5rJykpIHtcblx0XHRcdGxpbmtzID0gcGFyc2VMaW5rSGVhZGVyKHJlc3BvbnNlLmhlYWRlcnMuZ2V0KCdMaW5rJykpO1xuXHRcdH1cblx0XHRpZihyZXNwb25zZS5vaykge1xuXHRcdFx0aXRlbXMgPSBhd2FpdCByZXNwb25zZS5qc29uKCk7XG5cdFx0XHRpZihBcnJheS5pc0FycmF5KGl0ZW1zKSkge1xuXHRcdFx0XHRpdGVtcy5mb3JFYWNoKGl0ZW0gPT4ge1xuXHRcdFx0XHRcdGlmKGl0ZW0uYWNjZXNzRGF0ZSA9PT0gJ0NVUlJFTlRfVElNRVNUQU1QJykge1xuXHRcdFx0XHRcdFx0Y29uc3QgZHQgPSBuZXcgRGF0ZShEYXRlLm5vdygpKTtcblx0XHRcdFx0XHRcdGl0ZW0uYWNjZXNzRGF0ZSA9IGRhdGVUb1NxbChkdCwgdHJ1ZSk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGlmKGFkZCkge1xuXHRcdFx0XHRcdFx0dGhpcy5hZGRJdGVtKGl0ZW0pO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSk7XG5cdFx0XHR9XG5cdFx0XHRyZXN1bHQgPSBBcnJheS5pc0FycmF5KGl0ZW1zKSA/IENPTVBMRVRFIDogRkFJTEVEO1xuXHRcdH0gZWxzZSBpZihyZXNwb25zZS5zdGF0dXMgPT09IDMwMCkge1xuXHRcdFx0aXRlbXMgPSBhd2FpdCByZXNwb25zZS5qc29uKCk7XG5cdFx0XHRyZXN1bHQgPSBNVUxUSVBMRV9JVEVNUztcblx0XHR9IGVsc2Uge1xuXHRcdFx0cmVzdWx0ID0gRkFJTEVEXG5cdFx0fVxuXG5cdFx0cmV0dXJuIHsgcmVzdWx0LCBpdGVtcywgcmVzcG9uc2UsIGxpbmtzIH07XG5cdH1cblxuXHRzdGF0aWMgZ2V0IENPTVBMRVRFKCkgeyByZXR1cm4gQ09NUExFVEUgfVxuXHRzdGF0aWMgZ2V0IE1VTFRJUExFX0lURU1TKCkgeyByZXR1cm4gTVVMVElQTEVfSVRFTVMgfVxuXHRzdGF0aWMgZ2V0IEZBSUxFRCgpIHsgcmV0dXJuIEZBSUxFRCB9XG59XG5cbm1vZHVsZS5leHBvcnRzID0gWm90ZXJvQmliO1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG5tb2R1bGUuZXhwb3J0cyA9ICgpID0+ICh7XG5cdHRyYW5zbGF0ZVVSTDogdHlwZW9mIHdpbmRvdyAhPSAndW5kZWZpbmVkJyAmJiB3aW5kb3cubG9jYXRpb24ub3JpZ2luIHx8ICcnLFxuXHR0cmFuc2xhdGVQcmVmaXg6ICcnLFxuXHRmZXRjaENvbmZpZzoge30sXG5cdGluaXRpYWxJdGVtczogW10sXG5cdHJlcXVlc3Q6IHt9LFxuXHRzdG9yYWdlOiB0eXBlb2Ygd2luZG93ICE9ICd1bmRlZmluZWQnICYmICdsb2NhbFN0b3JhZ2UnIGluIHdpbmRvdyAmJiB3aW5kb3cubG9jYWxTdG9yYWdlIHx8IHt9LFxuXHRwZXJzaXN0OiB0cnVlLFxuXHRvdmVycmlkZTogZmFsc2UsXG5cdHN0b3JhZ2VQcmVmaXg6ICd6b3Rlcm8tYmliJ1xufSk7XG4iLCIndXNlIHN0cmljdCc7XG5cbm1vZHVsZS5leHBvcnRzID0ge1xuXHR1dWlkNDogKCkgPT4gJ3h4eHh4eHh4LXh4eHgtNHh4eC15eHh4LXh4eHh4eHh4eHh4eCcucmVwbGFjZSgvW3h5XS9nLCBjID0+IHtcblx0XHRcdHZhciByID0gTWF0aC5yYW5kb20oKSAqIDE2fDAsXG5cdFx0XHRcdHYgPSBjID09ICd4JyA/IHIgOiAociYweDN8MHg4KTtcblxuXHRcdFx0cmV0dXJuIHYudG9TdHJpbmcoMTYpO1xuXHRcdH0pLFxuXHRpc0xpa2Vab3Rlcm9JdGVtOiBpdGVtID0+IGl0ZW0gJiYgdHlwZW9mIGl0ZW0gPT09ICdvYmplY3QnICYmICdpdGVtVHlwZScgaW4gaXRlbVxufVxuIiwiJ3VzZSBzdHJpY3QnO1xuXG5jb25zdCBab3Rlcm9CaWIgPSByZXF1aXJlKCcuL2JpYi9iaWInKTtcbm1vZHVsZS5leHBvcnRzID0gWm90ZXJvQmliO1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG5jb25zdCBjcmVhdG9yVHlwZXMgPSB7XG5cdDE6ICdhdXRob3InLFxuXHQyOiAnY29udHJpYnV0b3InLFxuXHQzOiAnZWRpdG9yJyxcblx0NDogJ3RyYW5zbGF0b3InLFxuXHQ1OiAnc2VyaWVzRWRpdG9yJyxcblx0NjogJ2ludGVydmlld2VlJyxcblx0NzogJ2ludGVydmlld2VyJyxcblx0ODogJ2RpcmVjdG9yJyxcblx0OTogJ3NjcmlwdHdyaXRlcicsXG5cdDEwOiAncHJvZHVjZXInLFxuXHQxMTogJ2Nhc3RNZW1iZXInLFxuXHQxMjogJ3Nwb25zb3InLFxuXHQxMzogJ2NvdW5zZWwnLFxuXHQxNDogJ2ludmVudG9yJyxcblx0MTU6ICdhdHRvcm5leUFnZW50Jyxcblx0MTY6ICdyZWNpcGllbnQnLFxuXHQxNzogJ3BlcmZvcm1lcicsXG5cdDE4OiAnY29tcG9zZXInLFxuXHQxOTogJ3dvcmRzQnknLFxuXHQyMDogJ2NhcnRvZ3JhcGhlcicsXG5cdDIxOiAncHJvZ3JhbW1lcicsXG5cdDIyOiAnYXJ0aXN0Jyxcblx0MjM6ICdjb21tZW50ZXInLFxuXHQyNDogJ3ByZXNlbnRlcicsXG5cdDI1OiAnZ3Vlc3QnLFxuXHQyNjogJ3BvZGNhc3RlcicsXG5cdDI3OiAncmV2aWV3ZWRBdXRob3InLFxuXHQyODogJ2Nvc3BvbnNvcicsXG5cdDI5OiAnYm9va0F1dGhvcidcbn07XG5cblxuLy9yZXZlcnNlIGxvb2t1cFxuT2JqZWN0LmtleXMoY3JlYXRvclR5cGVzKS5tYXAoayA9PiBjcmVhdG9yVHlwZXNbY3JlYXRvclR5cGVzW2tdXSA9IGspO1xubW9kdWxlLmV4cG9ydHMgPSBjcmVhdG9yVHlwZXM7XG4iLCJtb2R1bGUuZXhwb3J0cyA9IHtcblx0Q1NMX05BTUVTX01BUFBJTkdTOiB7XG5cdFx0J2F1dGhvcic6J2F1dGhvcicsXG5cdFx0J2VkaXRvcic6J2VkaXRvcicsXG5cdFx0J2Jvb2tBdXRob3InOidjb250YWluZXItYXV0aG9yJyxcblx0XHQnY29tcG9zZXInOidjb21wb3NlcicsXG5cdFx0J2RpcmVjdG9yJzonZGlyZWN0b3InLFxuXHRcdCdpbnRlcnZpZXdlcic6J2ludGVydmlld2VyJyxcblx0XHQncmVjaXBpZW50JzoncmVjaXBpZW50Jyxcblx0XHQncmV2aWV3ZWRBdXRob3InOidyZXZpZXdlZC1hdXRob3InLFxuXHRcdCdzZXJpZXNFZGl0b3InOidjb2xsZWN0aW9uLWVkaXRvcicsXG5cdFx0J3RyYW5zbGF0b3InOid0cmFuc2xhdG9yJ1xuXHR9LFxuXG5cdC8qXG5cdCAqIE1hcHBpbmdzIGZvciB0ZXh0IHZhcmlhYmxlc1xuXHQgKi9cblx0Q1NMX1RFWFRfTUFQUElOR1M6IHtcblx0XHQndGl0bGUnOlsndGl0bGUnXSxcblx0XHQnY29udGFpbmVyLXRpdGxlJzpbJ3B1YmxpY2F0aW9uVGl0bGUnLCAgJ3JlcG9ydGVyJywgJ2NvZGUnXSwgLyogcmVwb3J0ZXIgYW5kIGNvZGUgc2hvdWxkIG1vdmUgdG8gU1FMIG1hcHBpbmcgdGFibGVzICovXG5cdFx0J2NvbGxlY3Rpb24tdGl0bGUnOlsnc2VyaWVzVGl0bGUnLCAnc2VyaWVzJ10sXG5cdFx0J2NvbGxlY3Rpb24tbnVtYmVyJzpbJ3Nlcmllc051bWJlciddLFxuXHRcdCdwdWJsaXNoZXInOlsncHVibGlzaGVyJywgJ2Rpc3RyaWJ1dG9yJ10sIC8qIGRpc3RyaWJ1dG9yIHNob3VsZCBtb3ZlIHRvIFNRTCBtYXBwaW5nIHRhYmxlcyAqL1xuXHRcdCdwdWJsaXNoZXItcGxhY2UnOlsncGxhY2UnXSxcblx0XHQnYXV0aG9yaXR5JzpbJ2NvdXJ0JywnbGVnaXNsYXRpdmVCb2R5JywgJ2lzc3VpbmdBdXRob3JpdHknXSxcblx0XHQncGFnZSc6WydwYWdlcyddLFxuXHRcdCd2b2x1bWUnOlsndm9sdW1lJywgJ2NvZGVOdW1iZXInXSxcblx0XHQnaXNzdWUnOlsnaXNzdWUnLCAncHJpb3JpdHlOdW1iZXJzJ10sXG5cdFx0J251bWJlci1vZi12b2x1bWVzJzpbJ251bWJlck9mVm9sdW1lcyddLFxuXHRcdCdudW1iZXItb2YtcGFnZXMnOlsnbnVtUGFnZXMnXSxcblx0XHQnZWRpdGlvbic6WydlZGl0aW9uJ10sXG5cdFx0J3ZlcnNpb24nOlsndmVyc2lvbk51bWJlciddLFxuXHRcdCdzZWN0aW9uJzpbJ3NlY3Rpb24nLCAnY29tbWl0dGVlJ10sXG5cdFx0J2dlbnJlJzpbJ3R5cGUnLCAncHJvZ3JhbW1pbmdMYW5ndWFnZSddLFxuXHRcdCdzb3VyY2UnOlsnbGlicmFyeUNhdGFsb2cnXSxcblx0XHQnZGltZW5zaW9ucyc6IFsnYXJ0d29ya1NpemUnLCAncnVubmluZ1RpbWUnXSxcblx0XHQnbWVkaXVtJzpbJ21lZGl1bScsICdzeXN0ZW0nXSxcblx0XHQnc2NhbGUnOlsnc2NhbGUnXSxcblx0XHQnYXJjaGl2ZSc6WydhcmNoaXZlJ10sXG5cdFx0J2FyY2hpdmVfbG9jYXRpb24nOlsnYXJjaGl2ZUxvY2F0aW9uJ10sXG5cdFx0J2V2ZW50JzpbJ21lZXRpbmdOYW1lJywgJ2NvbmZlcmVuY2VOYW1lJ10sIC8qIHRoZXNlIHNob3VsZCBiZSBtYXBwZWQgdG8gdGhlIHNhbWUgYmFzZSBmaWVsZCBpbiBTUUwgbWFwcGluZyB0YWJsZXMgKi9cblx0XHQnZXZlbnQtcGxhY2UnOlsncGxhY2UnXSxcblx0XHQnYWJzdHJhY3QnOlsnYWJzdHJhY3ROb3RlJ10sXG5cdFx0J1VSTCc6Wyd1cmwnXSxcblx0XHQnRE9JJzpbJ0RPSSddLFxuXHRcdCdJU0JOJzpbJ0lTQk4nXSxcblx0XHQnSVNTTic6WydJU1NOJ10sXG5cdFx0J2NhbGwtbnVtYmVyJzpbJ2NhbGxOdW1iZXInLCAnYXBwbGljYXRpb25OdW1iZXInXSxcblx0XHQnbm90ZSc6WydleHRyYSddLFxuXHRcdCdudW1iZXInOlsnbnVtYmVyJ10sXG5cdFx0J2NoYXB0ZXItbnVtYmVyJzpbJ3Nlc3Npb24nXSxcblx0XHQncmVmZXJlbmNlcyc6WydoaXN0b3J5JywgJ3JlZmVyZW5jZXMnXSxcblx0XHQnc2hvcnRUaXRsZSc6WydzaG9ydFRpdGxlJ10sXG5cdFx0J2pvdXJuYWxBYmJyZXZpYXRpb24nOlsnam91cm5hbEFiYnJldmlhdGlvbiddLFxuXHRcdCdzdGF0dXMnOlsnbGVnYWxTdGF0dXMnXSxcblx0XHQnbGFuZ3VhZ2UnOlsnbGFuZ3VhZ2UnXVxuXHR9LFxuXHRDU0xfREFURV9NQVBQSU5HUzoge1xuXHRcdCdpc3N1ZWQnOidkYXRlJyxcblx0XHQnYWNjZXNzZWQnOidhY2Nlc3NEYXRlJyxcblx0XHQnc3VibWl0dGVkJzonZmlsaW5nRGF0ZSdcblx0fSxcblx0Q1NMX1RZUEVfTUFQUElOR1M6IHtcblx0XHQnYm9vayc6J2Jvb2snLFxuXHRcdCdib29rU2VjdGlvbic6J2NoYXB0ZXInLFxuXHRcdCdqb3VybmFsQXJ0aWNsZSc6J2FydGljbGUtam91cm5hbCcsXG5cdFx0J21hZ2F6aW5lQXJ0aWNsZSc6J2FydGljbGUtbWFnYXppbmUnLFxuXHRcdCduZXdzcGFwZXJBcnRpY2xlJzonYXJ0aWNsZS1uZXdzcGFwZXInLFxuXHRcdCd0aGVzaXMnOid0aGVzaXMnLFxuXHRcdCdlbmN5Y2xvcGVkaWFBcnRpY2xlJzonZW50cnktZW5jeWNsb3BlZGlhJyxcblx0XHQnZGljdGlvbmFyeUVudHJ5JzonZW50cnktZGljdGlvbmFyeScsXG5cdFx0J2NvbmZlcmVuY2VQYXBlcic6J3BhcGVyLWNvbmZlcmVuY2UnLFxuXHRcdCdsZXR0ZXInOidwZXJzb25hbF9jb21tdW5pY2F0aW9uJyxcblx0XHQnbWFudXNjcmlwdCc6J21hbnVzY3JpcHQnLFxuXHRcdCdpbnRlcnZpZXcnOidpbnRlcnZpZXcnLFxuXHRcdCdmaWxtJzonbW90aW9uX3BpY3R1cmUnLFxuXHRcdCdhcnR3b3JrJzonZ3JhcGhpYycsXG5cdFx0J3dlYnBhZ2UnOid3ZWJwYWdlJyxcblx0XHQncmVwb3J0JzoncmVwb3J0Jyxcblx0XHQnYmlsbCc6J2JpbGwnLFxuXHRcdCdjYXNlJzonbGVnYWxfY2FzZScsXG5cdFx0J2hlYXJpbmcnOidiaWxsJyxcdFx0XHRcdC8vID8/XG5cdFx0J3BhdGVudCc6J3BhdGVudCcsXG5cdFx0J3N0YXR1dGUnOidsZWdpc2xhdGlvbicsXHRcdC8vID8/XG5cdFx0J2VtYWlsJzoncGVyc29uYWxfY29tbXVuaWNhdGlvbicsXG5cdFx0J21hcCc6J21hcCcsXG5cdFx0J2Jsb2dQb3N0JzoncG9zdC13ZWJsb2cnLFxuXHRcdCdpbnN0YW50TWVzc2FnZSc6J3BlcnNvbmFsX2NvbW11bmljYXRpb24nLFxuXHRcdCdmb3J1bVBvc3QnOidwb3N0Jyxcblx0XHQnYXVkaW9SZWNvcmRpbmcnOidzb25nJyxcdFx0Ly8gPz9cblx0XHQncHJlc2VudGF0aW9uJzonc3BlZWNoJyxcblx0XHQndmlkZW9SZWNvcmRpbmcnOidtb3Rpb25fcGljdHVyZScsXG5cdFx0J3R2QnJvYWRjYXN0JzonYnJvYWRjYXN0Jyxcblx0XHQncmFkaW9Ccm9hZGNhc3QnOidicm9hZGNhc3QnLFxuXHRcdCdwb2RjYXN0Jzonc29uZycsXHRcdFx0Ly8gPz9cblx0XHQnY29tcHV0ZXJQcm9ncmFtJzonYm9vaycsXHRcdC8vID8/XG5cdFx0J2RvY3VtZW50JzonYXJ0aWNsZScsXG5cdFx0J25vdGUnOidhcnRpY2xlJyxcblx0XHQnYXR0YWNobWVudCc6J2FydGljbGUnXG5cdH1cbn07XG4iLCJjb25zdCBscGFkID0gcmVxdWlyZSgnLi9scGFkJyk7XG5cbm1vZHVsZS5leHBvcnRzID0gKGRhdGUsIHRvVVRDKSA9PiB7XG5cdHZhciB5ZWFyLCBtb250aCwgZGF5LCBob3VycywgbWludXRlcywgc2Vjb25kcztcblx0dHJ5IHtcblx0XHRpZih0b1VUQykge1xuXHRcdFx0eWVhciA9IGRhdGUuZ2V0VVRDRnVsbFllYXIoKTtcblx0XHRcdG1vbnRoID0gZGF0ZS5nZXRVVENNb250aCgpO1xuXHRcdFx0ZGF5ID0gZGF0ZS5nZXRVVENEYXRlKCk7XG5cdFx0XHRob3VycyA9IGRhdGUuZ2V0VVRDSG91cnMoKTtcblx0XHRcdG1pbnV0ZXMgPSBkYXRlLmdldFVUQ01pbnV0ZXMoKTtcblx0XHRcdHNlY29uZHMgPSBkYXRlLmdldFVUQ1NlY29uZHMoKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0eWVhciA9IGRhdGUuZ2V0RnVsbFllYXIoKTtcblx0XHRcdG1vbnRoID0gZGF0ZS5nZXRNb250aCgpO1xuXHRcdFx0ZGF5ID0gZGF0ZS5nZXREYXRlKCk7XG5cdFx0XHRob3VycyA9IGRhdGUuZ2V0SG91cnMoKTtcblx0XHRcdG1pbnV0ZXMgPSBkYXRlLmdldE1pbnV0ZXMoKTtcblx0XHRcdHNlY29uZHMgPSBkYXRlLmdldFNlY29uZHMoKTtcblx0XHR9XG5cblx0XHR5ZWFyID0gbHBhZCh5ZWFyLCAnMCcsIDQpO1xuXHRcdG1vbnRoID0gbHBhZChtb250aCArIDEsICcwJywgMik7XG5cdFx0ZGF5ID0gbHBhZChkYXksICcwJywgMik7XG5cdFx0aG91cnMgPSBscGFkKGhvdXJzLCAnMCcsIDIpO1xuXHRcdG1pbnV0ZXMgPSBscGFkKG1pbnV0ZXMsICcwJywgMik7XG5cdFx0c2Vjb25kcyA9IGxwYWQoc2Vjb25kcywgJzAnLCAyKTtcblxuXHRcdHJldHVybiB5ZWFyICsgJy0nICsgbW9udGggKyAnLScgKyBkYXkgKyAnICdcblx0XHRcdCsgaG91cnMgKyAnOicgKyBtaW51dGVzICsgJzonICsgc2Vjb25kcztcblx0fVxuXHRjYXRjaCAoZSkge1xuXHRcdHJldHVybiAnJztcblx0fVxufVxuIiwiY29uc3QgaXRlbVR5cGVzID0gcmVxdWlyZSgnLi9pdGVtLXR5cGVzJyk7XG5jb25zdCBjcmVhdG9yVHlwZXMgPSByZXF1aXJlKCcuL2NyZWF0b3ItdHlwZXMnKTtcblxubW9kdWxlLmV4cG9ydHMgPSB7XG5cdFtpdGVtVHlwZXNbMl1dOiBjcmVhdG9yVHlwZXNbMV0sXG5cdFtpdGVtVHlwZXNbM11dOiBjcmVhdG9yVHlwZXNbMV0sXG5cdFtpdGVtVHlwZXNbNF1dOiBjcmVhdG9yVHlwZXNbMV0sXG5cdFtpdGVtVHlwZXNbNV1dOiBjcmVhdG9yVHlwZXNbMV0sXG5cdFtpdGVtVHlwZXNbNl1dOiBjcmVhdG9yVHlwZXNbMV0sXG5cdFtpdGVtVHlwZXNbN11dOiBjcmVhdG9yVHlwZXNbMV0sXG5cdFtpdGVtVHlwZXNbOF1dOiBjcmVhdG9yVHlwZXNbMV0sXG5cdFtpdGVtVHlwZXNbOV1dOiBjcmVhdG9yVHlwZXNbMV0sXG5cdFtpdGVtVHlwZXNbMTBdXTogY3JlYXRvclR5cGVzWzZdLFxuXHRbaXRlbVR5cGVzWzExXV06IGNyZWF0b3JUeXBlc1s4XSxcblx0W2l0ZW1UeXBlc1sxMl1dOiBjcmVhdG9yVHlwZXNbMjJdLFxuXHRbaXRlbVR5cGVzWzEzXV06IGNyZWF0b3JUeXBlc1sxXSxcblx0W2l0ZW1UeXBlc1sxNV1dOiBjcmVhdG9yVHlwZXNbMV0sXG5cdFtpdGVtVHlwZXNbMTZdXTogY3JlYXRvclR5cGVzWzEyXSxcblx0W2l0ZW1UeXBlc1sxN11dOiBjcmVhdG9yVHlwZXNbMV0sXG5cdFtpdGVtVHlwZXNbMThdXTogY3JlYXRvclR5cGVzWzJdLFxuXHRbaXRlbVR5cGVzWzE5XV06IGNyZWF0b3JUeXBlc1sxNF0sXG5cdFtpdGVtVHlwZXNbMjBdXTogY3JlYXRvclR5cGVzWzFdLFxuXHRbaXRlbVR5cGVzWzIxXV06IGNyZWF0b3JUeXBlc1sxXSxcblx0W2l0ZW1UeXBlc1syMl1dOiBjcmVhdG9yVHlwZXNbMjBdLFxuXHRbaXRlbVR5cGVzWzIzXV06IGNyZWF0b3JUeXBlc1sxXSxcblx0W2l0ZW1UeXBlc1syNF1dOiBjcmVhdG9yVHlwZXNbMV0sXG5cdFtpdGVtVHlwZXNbMjVdXTogY3JlYXRvclR5cGVzWzFdLFxuXHRbaXRlbVR5cGVzWzI2XV06IGNyZWF0b3JUeXBlc1sxN10sXG5cdFtpdGVtVHlwZXNbMjddXTogY3JlYXRvclR5cGVzWzI0XSxcblx0W2l0ZW1UeXBlc1syOF1dOiBjcmVhdG9yVHlwZXNbOF0sXG5cdFtpdGVtVHlwZXNbMjldXTogY3JlYXRvclR5cGVzWzhdLFxuXHRbaXRlbVR5cGVzWzMwXV06IGNyZWF0b3JUeXBlc1s4XSxcblx0W2l0ZW1UeXBlc1szMV1dOiBjcmVhdG9yVHlwZXNbMjZdLFxuXHRbaXRlbVR5cGVzWzMyXV06IGNyZWF0b3JUeXBlc1syMV0sXG5cdFtpdGVtVHlwZXNbMzNdXTogY3JlYXRvclR5cGVzWzFdLFxuXHRbaXRlbVR5cGVzWzM0XV06IGNyZWF0b3JUeXBlc1sxXSxcblx0W2l0ZW1UeXBlc1szNV1dOiBjcmVhdG9yVHlwZXNbMV0sXG5cdFtpdGVtVHlwZXNbMzZdXTogY3JlYXRvclR5cGVzWzFdXG59O1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG5jb25zdCBmaWVsZHMgPSB7XG5cdDE6ICd1cmwnLFxuXHQyOiAncmlnaHRzJyxcblx0MzogJ3NlcmllcycsXG5cdDQ6ICd2b2x1bWUnLFxuXHQ1OiAnaXNzdWUnLFxuXHQ2OiAnZWRpdGlvbicsXG5cdDc6ICdwbGFjZScsXG5cdDg6ICdwdWJsaXNoZXInLFxuXHQxMDogJ3BhZ2VzJyxcblx0MTE6ICdJU0JOJyxcblx0MTI6ICdwdWJsaWNhdGlvblRpdGxlJyxcblx0MTM6ICdJU1NOJyxcblx0MTQ6ICdkYXRlJyxcblx0MTU6ICdzZWN0aW9uJyxcblx0MTg6ICdjYWxsTnVtYmVyJyxcblx0MTk6ICdhcmNoaXZlTG9jYXRpb24nLFxuXHQyMTogJ2Rpc3RyaWJ1dG9yJyxcblx0MjI6ICdleHRyYScsXG5cdDI1OiAnam91cm5hbEFiYnJldmlhdGlvbicsXG5cdDI2OiAnRE9JJyxcblx0Mjc6ICdhY2Nlc3NEYXRlJyxcblx0Mjg6ICdzZXJpZXNUaXRsZScsXG5cdDI5OiAnc2VyaWVzVGV4dCcsXG5cdDMwOiAnc2VyaWVzTnVtYmVyJyxcblx0MzE6ICdpbnN0aXR1dGlvbicsXG5cdDMyOiAncmVwb3J0VHlwZScsXG5cdDM2OiAnY29kZScsXG5cdDQwOiAnc2Vzc2lvbicsXG5cdDQxOiAnbGVnaXNsYXRpdmVCb2R5Jyxcblx0NDI6ICdoaXN0b3J5Jyxcblx0NDM6ICdyZXBvcnRlcicsXG5cdDQ0OiAnY291cnQnLFxuXHQ0NTogJ251bWJlck9mVm9sdW1lcycsXG5cdDQ2OiAnY29tbWl0dGVlJyxcblx0NDg6ICdhc3NpZ25lZScsXG5cdDUwOiAncGF0ZW50TnVtYmVyJyxcblx0NTE6ICdwcmlvcml0eU51bWJlcnMnLFxuXHQ1MjogJ2lzc3VlRGF0ZScsXG5cdDUzOiAncmVmZXJlbmNlcycsXG5cdDU0OiAnbGVnYWxTdGF0dXMnLFxuXHQ1NTogJ2NvZGVOdW1iZXInLFxuXHQ1OTogJ2FydHdvcmtNZWRpdW0nLFxuXHQ2MDogJ251bWJlcicsXG5cdDYxOiAnYXJ0d29ya1NpemUnLFxuXHQ2MjogJ2xpYnJhcnlDYXRhbG9nJyxcblx0NjM6ICd2aWRlb1JlY29yZGluZ0Zvcm1hdCcsXG5cdDY0OiAnaW50ZXJ2aWV3TWVkaXVtJyxcblx0NjU6ICdsZXR0ZXJUeXBlJyxcblx0NjY6ICdtYW51c2NyaXB0VHlwZScsXG5cdDY3OiAnbWFwVHlwZScsXG5cdDY4OiAnc2NhbGUnLFxuXHQ2OTogJ3RoZXNpc1R5cGUnLFxuXHQ3MDogJ3dlYnNpdGVUeXBlJyxcblx0NzE6ICdhdWRpb1JlY29yZGluZ0Zvcm1hdCcsXG5cdDcyOiAnbGFiZWwnLFxuXHQ3NDogJ3ByZXNlbnRhdGlvblR5cGUnLFxuXHQ3NTogJ21lZXRpbmdOYW1lJyxcblx0NzY6ICdzdHVkaW8nLFxuXHQ3NzogJ3J1bm5pbmdUaW1lJyxcblx0Nzg6ICduZXR3b3JrJyxcblx0Nzk6ICdwb3N0VHlwZScsXG5cdDgwOiAnYXVkaW9GaWxlVHlwZScsXG5cdDgxOiAndmVyc2lvbk51bWJlcicsXG5cdDgyOiAnc3lzdGVtJyxcblx0ODM6ICdjb21wYW55Jyxcblx0ODQ6ICdjb25mZXJlbmNlTmFtZScsXG5cdDg1OiAnZW5jeWNsb3BlZGlhVGl0bGUnLFxuXHQ4NjogJ2RpY3Rpb25hcnlUaXRsZScsXG5cdDg3OiAnbGFuZ3VhZ2UnLFxuXHQ4ODogJ3Byb2dyYW1taW5nTGFuZ3VhZ2UnLFxuXHQ4OTogJ3VuaXZlcnNpdHknLFxuXHQ5MDogJ2Fic3RyYWN0Tm90ZScsXG5cdDkxOiAnd2Vic2l0ZVRpdGxlJyxcblx0OTI6ICdyZXBvcnROdW1iZXInLFxuXHQ5MzogJ2JpbGxOdW1iZXInLFxuXHQ5NDogJ2NvZGVWb2x1bWUnLFxuXHQ5NTogJ2NvZGVQYWdlcycsXG5cdDk2OiAnZGF0ZURlY2lkZWQnLFxuXHQ5NzogJ3JlcG9ydGVyVm9sdW1lJyxcblx0OTg6ICdmaXJzdFBhZ2UnLFxuXHQ5OTogJ2RvY3VtZW50TnVtYmVyJyxcblx0MTAwOiAnZGF0ZUVuYWN0ZWQnLFxuXHQxMDE6ICdwdWJsaWNMYXdOdW1iZXInLFxuXHQxMDI6ICdjb3VudHJ5Jyxcblx0MTAzOiAnYXBwbGljYXRpb25OdW1iZXInLFxuXHQxMDQ6ICdmb3J1bVRpdGxlJyxcblx0MTA1OiAnZXBpc29kZU51bWJlcicsXG5cdDEwNzogJ2Jsb2dUaXRsZScsXG5cdDEwODogJ3R5cGUnLFxuXHQxMDk6ICdtZWRpdW0nLFxuXHQxMTA6ICd0aXRsZScsXG5cdDExMTogJ2Nhc2VOYW1lJyxcblx0MTEyOiAnbmFtZU9mQWN0Jyxcblx0MTEzOiAnc3ViamVjdCcsXG5cdDExNDogJ3Byb2NlZWRpbmdzVGl0bGUnLFxuXHQxMTU6ICdib29rVGl0bGUnLFxuXHQxMTY6ICdzaG9ydFRpdGxlJyxcblx0MTE3OiAnZG9ja2V0TnVtYmVyJyxcblx0MTE4OiAnbnVtUGFnZXMnLFxuXHQxMTk6ICdwcm9ncmFtVGl0bGUnLFxuXHQxMjA6ICdpc3N1aW5nQXV0aG9yaXR5Jyxcblx0MTIxOiAnZmlsaW5nRGF0ZScsXG5cdDEyMjogJ2dlbnJlJyxcblx0MTIzOiAnYXJjaGl2ZSdcbn07XG5cbi8vcmV2ZXJzZSBsb29rdXBcbk9iamVjdC5rZXlzKGZpZWxkcykubWFwKGsgPT4gZmllbGRzW2ZpZWxkc1trXV0gPSBrKTtcblxubW9kdWxlLmV4cG9ydHMgPSBmaWVsZHM7XG4iLCIvKiBnbG9iYWwgQ1NMOmZhbHNlICovXG4ndXNlIHN0cmljdCc7XG5cbmNvbnN0IGJhc2VNYXBwaW5ncyA9IHJlcXVpcmUoJ3pvdGVyby1iYXNlLW1hcHBpbmdzJyk7XG5cbmNvbnN0IHtcblx0Q1NMX05BTUVTX01BUFBJTkdTLFxuXHRDU0xfVEVYVF9NQVBQSU5HUyxcblx0Q1NMX0RBVEVfTUFQUElOR1MsXG5cdENTTF9UWVBFX01BUFBJTkdTXG59ID0gcmVxdWlyZSgnLi9jc2wtbWFwcGluZ3MnKTtcblxuY29uc3QgeyBnZXRGaWVsZElERnJvbVR5cGVBbmRCYXNlIH0gPSByZXF1aXJlKCcuL3R5cGUtc3BlY2lmaWMtZmllbGQtbWFwJyk7XG5jb25zdCBmaWVsZHMgPSByZXF1aXJlKCcuL2ZpZWxkcycpO1xuY29uc3QgaXRlbVR5cGVzID0gcmVxdWlyZSgnLi9pdGVtLXR5cGVzJyk7XG5jb25zdCBzdHJUb0RhdGUgPSByZXF1aXJlKCcuL3N0ci10by1kYXRlJyk7XG5jb25zdCBkZWZhdWx0SXRlbVR5cGVDcmVhdG9yVHlwZUxvb2t1cCA9IHJlcXVpcmUoJy4vZGVmYXVsdC1pdGVtLXR5cGUtY3JlYXRvci10eXBlLWxvb2t1cCcpO1xuXG5jb25zdCBiYXNlTWFwcGluZ3NGbGF0ID0gT2JqZWN0LmtleXMoYmFzZU1hcHBpbmdzKS5yZWR1Y2UoKGFnZ3IsIGl0KSA9PiB7XG5cdE9iamVjdC5rZXlzKGJhc2VNYXBwaW5nc1tpdF0pLmZvckVhY2gobWFwRnJvbSA9PiB7XG5cdFx0bGV0IGtleSA9IGAke2l0fSR7bWFwRnJvbX1gO1xuXHRcdGxldCB2YWx1ZSA9IGJhc2VNYXBwaW5nc1tpdF1bbWFwRnJvbV07XG5cdFx0YWdncltrZXldID0gdmFsdWU7XG5cdH0pO1xuXHRyZXR1cm4gYWdncjtcbn0sIHt9KTtcblxubW9kdWxlLmV4cG9ydHMgPSB6b3Rlcm9JdGVtID0+IHtcblx0dmFyIGNzbFR5cGUgPSBDU0xfVFlQRV9NQVBQSU5HU1t6b3Rlcm9JdGVtLml0ZW1UeXBlXTtcblx0aWYgKCFjc2xUeXBlKSB7XG5cdFx0dGhyb3cgbmV3IEVycm9yKCdVbmV4cGVjdGVkIFpvdGVybyBJdGVtIHR5cGUgXCInICsgem90ZXJvSXRlbS5pdGVtVHlwZSArICdcIicpO1xuXHR9XG5cblx0dmFyIGl0ZW1UeXBlSUQgPSBpdGVtVHlwZXNbem90ZXJvSXRlbS5pdGVtVHlwZV07XG5cblx0dmFyIGNzbEl0ZW0gPSB7XG5cdFx0Ly8gJ2lkJzp6b3Rlcm9JdGVtLnVyaSxcblx0XHRpZDogem90ZXJvSXRlbS5rZXksXG5cdFx0J3R5cGUnOmNzbFR5cGVcblx0fTtcblxuXHQvLyBnZXQgYWxsIHRleHQgdmFyaWFibGVzICh0aGVyZSBtdXN0IGJlIGEgYmV0dGVyIHdheSlcblx0Zm9yKGxldCB2YXJpYWJsZSBpbiBDU0xfVEVYVF9NQVBQSU5HUykge1xuXHRcdGxldCBmaWVsZHMgPSBDU0xfVEVYVF9NQVBQSU5HU1t2YXJpYWJsZV07XG5cdFx0Zm9yKGxldCBpPTAsIG49ZmllbGRzLmxlbmd0aDsgaTxuOyBpKyspIHtcblx0XHRcdGxldCBmaWVsZCA9IGZpZWxkc1tpXSxcblx0XHRcdFx0dmFsdWUgPSBudWxsO1xuXG5cdFx0XHRpZihmaWVsZCBpbiB6b3Rlcm9JdGVtKSB7XG5cdFx0XHRcdHZhbHVlID0gem90ZXJvSXRlbVtmaWVsZF07XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRjb25zdCBtYXBwZWRGaWVsZCA9IGJhc2VNYXBwaW5nc0ZsYXRbYCR7em90ZXJvSXRlbS5pdGVtVHlwZX0ke2ZpZWxkfWBdO1xuXHRcdFx0XHR2YWx1ZSA9IHpvdGVyb0l0ZW1bbWFwcGVkRmllbGRdO1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAoIXZhbHVlKSBjb250aW51ZTtcblxuXHRcdFx0aWYgKHR5cGVvZiB2YWx1ZSA9PSAnc3RyaW5nJykge1xuXHRcdFx0XHRpZiAoZmllbGQgPT0gJ0lTQk4nKSB7XG5cdFx0XHRcdFx0Ly8gT25seSB1c2UgdGhlIGZpcnN0IElTQk4gaW4gQ1NMIEpTT05cblx0XHRcdFx0XHR2YXIgaXNibiA9IHZhbHVlLm1hdGNoKC9eKD86OTdbODldLT8pPyg/OlxcZC0/KXs5fVtcXGR4XSg/IS0pXFxiL2kpO1xuXHRcdFx0XHRcdGlmKGlzYm4pIHtcblx0XHRcdFx0XHRcdHZhbHVlID0gaXNiblswXTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblxuXHRcdFx0XHQvLyBTdHJpcCBlbmNsb3NpbmcgcXVvdGVzXG5cdFx0XHRcdGlmKHZhbHVlLmNoYXJBdCgwKSA9PSAnXCInICYmIHZhbHVlLmluZGV4T2YoJ1wiJywgMSkgPT0gdmFsdWUubGVuZ3RoIC0gMSkge1xuXHRcdFx0XHRcdHZhbHVlID0gdmFsdWUuc3Vic3RyaW5nKDEsIHZhbHVlLmxlbmd0aCAtIDEpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGNzbEl0ZW1bdmFyaWFibGVdID0gdmFsdWU7XG5cdFx0XHRcdGJyZWFrO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdC8vIHNlcGFyYXRlIG5hbWUgdmFyaWFibGVzXG5cdGlmICh6b3Rlcm9JdGVtLnR5cGUgIT0gJ2F0dGFjaG1lbnQnICYmIHpvdGVyb0l0ZW0udHlwZSAhPSAnbm90ZScpIHtcblx0XHQvLyB2YXIgYXV0aG9yID0gWm90ZXJvLkNyZWF0b3JUeXBlcy5nZXROYW1lKFpvdGVyby5DcmVhdG9yVHlwZXMuZ2V0UHJpbWFyeUlERm9yVHlwZSgpKTtcblx0XHRsZXQgYXV0aG9yID0gZGVmYXVsdEl0ZW1UeXBlQ3JlYXRvclR5cGVMb29rdXBbaXRlbVR5cGVJRF07XG5cdFx0bGV0IGNyZWF0b3JzID0gem90ZXJvSXRlbS5jcmVhdG9ycztcblx0XHRmb3IobGV0IGkgPSAwOyBjcmVhdG9ycyAmJiBpIDwgY3JlYXRvcnMubGVuZ3RoOyBpKyspIHtcblx0XHRcdGxldCBjcmVhdG9yID0gY3JlYXRvcnNbaV07XG5cdFx0XHRsZXQgY3JlYXRvclR5cGUgPSBjcmVhdG9yLmNyZWF0b3JUeXBlO1xuXHRcdFx0bGV0IG5hbWVPYmo7XG5cblx0XHRcdGlmKGNyZWF0b3JUeXBlID09IGF1dGhvcikge1xuXHRcdFx0XHRjcmVhdG9yVHlwZSA9ICdhdXRob3InO1xuXHRcdFx0fVxuXG5cdFx0XHRjcmVhdG9yVHlwZSA9IENTTF9OQU1FU19NQVBQSU5HU1tjcmVhdG9yVHlwZV07XG5cdFx0XHRpZighY3JlYXRvclR5cGUpIHtcblx0XHRcdFx0Y29udGludWU7XG5cdFx0XHR9XG5cblx0XHRcdGlmICgnbGFzdE5hbWUnIGluIGNyZWF0b3IgfHwgJ2ZpcnN0TmFtZScgaW4gY3JlYXRvcikge1xuXHRcdFx0XHRuYW1lT2JqID0ge1xuXHRcdFx0XHRcdGZhbWlseTogY3JlYXRvci5sYXN0TmFtZSB8fCAnJyxcblx0XHRcdFx0XHRnaXZlbjogY3JlYXRvci5maXJzdE5hbWUgfHwgJydcblx0XHRcdFx0fTtcblxuXHRcdFx0XHQvLyBQYXJzZSBuYW1lIHBhcnRpY2xlc1xuXHRcdFx0XHQvLyBSZXBsaWNhdGUgY2l0ZXByb2MtanMgbG9naWMgZm9yIHdoYXQgc2hvdWxkIGJlIHBhcnNlZCBzbyB3ZSBkb24ndFxuXHRcdFx0XHQvLyBicmVhayBjdXJyZW50IGJlaGF2aW9yLlxuXHRcdFx0XHRpZiAobmFtZU9iai5mYW1pbHkgJiYgbmFtZU9iai5naXZlbikge1xuXHRcdFx0XHRcdC8vIERvbid0IHBhcnNlIGlmIGxhc3QgbmFtZSBpcyBxdW90ZWRcblx0XHRcdFx0XHRpZiAobmFtZU9iai5mYW1pbHkubGVuZ3RoID4gMVxuXHRcdFx0XHRcdFx0JiYgbmFtZU9iai5mYW1pbHkuY2hhckF0KDApID09ICdcIidcblx0XHRcdFx0XHRcdCYmIG5hbWVPYmouZmFtaWx5LmNoYXJBdChuYW1lT2JqLmZhbWlseS5sZW5ndGggLSAxKSA9PSAnXCInXG5cdFx0XHRcdFx0KSB7XG5cdFx0XHRcdFx0XHRuYW1lT2JqLmZhbWlseSA9IG5hbWVPYmouZmFtaWx5LnN1YnN0cigxLCBuYW1lT2JqLmZhbWlseS5sZW5ndGggLSAyKTtcblx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0Q1NMLnBhcnNlUGFydGljbGVzKG5hbWVPYmosIHRydWUpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fSBlbHNlIGlmICgnbmFtZScgaW4gY3JlYXRvcikge1xuXHRcdFx0XHRuYW1lT2JqID0geydsaXRlcmFsJzogY3JlYXRvci5uYW1lfTtcblx0XHRcdH1cblxuXHRcdFx0aWYoY3NsSXRlbVtjcmVhdG9yVHlwZV0pIHtcblx0XHRcdFx0Y3NsSXRlbVtjcmVhdG9yVHlwZV0ucHVzaChuYW1lT2JqKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdGNzbEl0ZW1bY3JlYXRvclR5cGVdID0gW25hbWVPYmpdO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdC8vIGdldCBkYXRlIHZhcmlhYmxlc1xuXHRmb3IobGV0IHZhcmlhYmxlIGluIENTTF9EQVRFX01BUFBJTkdTKSB7XG5cdFx0bGV0IGRhdGUgPSB6b3Rlcm9JdGVtW0NTTF9EQVRFX01BUFBJTkdTW3ZhcmlhYmxlXV07XG5cdFx0aWYgKCFkYXRlKSB7XG5cblx0XHRcdGxldCB0eXBlU3BlY2lmaWNGaWVsZElEID0gZ2V0RmllbGRJREZyb21UeXBlQW5kQmFzZShpdGVtVHlwZUlELCBDU0xfREFURV9NQVBQSU5HU1t2YXJpYWJsZV0pO1xuXHRcdFx0aWYgKHR5cGVTcGVjaWZpY0ZpZWxkSUQpIHtcblx0XHRcdFx0ZGF0ZSA9IHpvdGVyb0l0ZW1bZmllbGRzW3R5cGVTcGVjaWZpY0ZpZWxkSURdXTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRpZihkYXRlKSB7XG5cdFx0XHRsZXQgZGF0ZU9iaiA9IHN0clRvRGF0ZShkYXRlKTtcblx0XHRcdC8vIG90aGVyd2lzZSwgdXNlIGRhdGUtcGFydHNcblx0XHRcdGxldCBkYXRlUGFydHMgPSBbXTtcblx0XHRcdGlmKGRhdGVPYmoueWVhcikge1xuXHRcdFx0XHQvLyBhZGQgeWVhciwgbW9udGgsIGFuZCBkYXksIGlmIHRoZXkgZXhpc3Rcblx0XHRcdFx0ZGF0ZVBhcnRzLnB1c2goZGF0ZU9iai55ZWFyKTtcblx0XHRcdFx0aWYoZGF0ZU9iai5tb250aCAhPT0gdW5kZWZpbmVkKSB7XG5cdFx0XHRcdFx0ZGF0ZVBhcnRzLnB1c2goZGF0ZU9iai5tb250aCsxKTtcblx0XHRcdFx0XHRpZihkYXRlT2JqLmRheSkge1xuXHRcdFx0XHRcdFx0ZGF0ZVBhcnRzLnB1c2goZGF0ZU9iai5kYXkpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0XHRjc2xJdGVtW3ZhcmlhYmxlXSA9IHsnZGF0ZS1wYXJ0cyc6W2RhdGVQYXJ0c119O1xuXG5cdFx0XHRcdC8vIGlmIG5vIG1vbnRoLCB1c2Ugc2Vhc29uIGFzIG1vbnRoXG5cdFx0XHRcdGlmKGRhdGVPYmoucGFydCAmJiBkYXRlT2JqLm1vbnRoID09PSB1bmRlZmluZWQpIHtcblx0XHRcdFx0XHRjc2xJdGVtW3ZhcmlhYmxlXS5zZWFzb24gPSBkYXRlT2JqLnBhcnQ7XG5cdFx0XHRcdH1cblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdC8vIGlmIG5vIHllYXIsIHBhc3MgZGF0ZSBsaXRlcmFsbHlcblx0XHRcdFx0Y3NsSXRlbVt2YXJpYWJsZV0gPSB7J2xpdGVyYWwnOmRhdGV9O1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdC8vIFNwZWNpYWwgbWFwcGluZyBmb3Igbm90ZSB0aXRsZVxuXHQvLyBATk9URTogTm90IHBvcnRlZFxuXHQvLyBpZiAoem90ZXJvSXRlbS5pdGVtVHlwZSA9PSAnbm90ZScgJiYgem90ZXJvSXRlbS5ub3RlKSB7XG5cdC8vIFx0Y3NsSXRlbS50aXRsZSA9IFpvdGVyby5Ob3Rlcy5ub3RlVG9UaXRsZSh6b3Rlcm9JdGVtLm5vdGUpO1xuXHQvLyB9XG5cblx0Ly90aGlzLl9jYWNoZVt6b3Rlcm9JdGVtLmlkXSA9IGNzbEl0ZW07XG5cdHJldHVybiBjc2xJdGVtO1xufVxuIiwiJ3VzZSBzdHJpY3QnO1xuXG5jb25zdCBpdGVtVHlwZXMgPSB7XG5cdDE6ICdub3RlJyxcblx0MjogJ2Jvb2snLFxuXHQzOiAnYm9va1NlY3Rpb24nLFxuXHQ0OiAnam91cm5hbEFydGljbGUnLFxuXHQ1OiAnbWFnYXppbmVBcnRpY2xlJyxcblx0NjogJ25ld3NwYXBlckFydGljbGUnLFxuXHQ3OiAndGhlc2lzJyxcblx0ODogJ2xldHRlcicsXG5cdDk6ICdtYW51c2NyaXB0Jyxcblx0MTA6ICdpbnRlcnZpZXcnLFxuXHQxMTogJ2ZpbG0nLFxuXHQxMjogJ2FydHdvcmsnLFxuXHQxMzogJ3dlYnBhZ2UnLFxuXHQxNDogJ2F0dGFjaG1lbnQnLFxuXHQxNTogJ3JlcG9ydCcsXG5cdDE2OiAnYmlsbCcsXG5cdDE3OiAnY2FzZScsXG5cdDE4OiAnaGVhcmluZycsXG5cdDE5OiAncGF0ZW50Jyxcblx0MjA6ICdzdGF0dXRlJyxcblx0MjE6ICdlbWFpbCcsXG5cdDIyOiAnbWFwJyxcblx0MjM6ICdibG9nUG9zdCcsXG5cdDI0OiAnaW5zdGFudE1lc3NhZ2UnLFxuXHQyNTogJ2ZvcnVtUG9zdCcsXG5cdDI2OiAnYXVkaW9SZWNvcmRpbmcnLFxuXHQyNzogJ3ByZXNlbnRhdGlvbicsXG5cdDI4OiAndmlkZW9SZWNvcmRpbmcnLFxuXHQyOTogJ3R2QnJvYWRjYXN0Jyxcblx0MzA6ICdyYWRpb0Jyb2FkY2FzdCcsXG5cdDMxOiAncG9kY2FzdCcsXG5cdDMyOiAnY29tcHV0ZXJQcm9ncmFtJyxcblx0MzM6ICdjb25mZXJlbmNlUGFwZXInLFxuXHQzNDogJ2RvY3VtZW50Jyxcblx0MzU6ICdlbmN5Y2xvcGVkaWFBcnRpY2xlJyxcblx0MzY6ICdkaWN0aW9uYXJ5RW50cnknXG59O1xuXG4vL3JldmVyc2UgbG9va3VwXG5PYmplY3Qua2V5cyhpdGVtVHlwZXMpLm1hcChrID0+IGl0ZW1UeXBlc1tpdGVtVHlwZXNba11dID0gayk7XG5tb2R1bGUuZXhwb3J0cyA9IGl0ZW1UeXBlcztcbiIsIid1c2Ugc3RyaWN0JztcblxubW9kdWxlLmV4cG9ydHMgPSAoc3RyaW5nLCBwYWQsIGxlbmd0aCkgPT4ge1xuXHRzdHJpbmcgPSBzdHJpbmcgPyBzdHJpbmcgKyAnJyA6ICcnO1xuXHR3aGlsZShzdHJpbmcubGVuZ3RoIDwgbGVuZ3RoKSB7XG5cdFx0c3RyaW5nID0gcGFkICsgc3RyaW5nO1xuXHR9XG5cdHJldHVybiBzdHJpbmc7XG59XG4iLCIndXNlIHN0cmljdCc7XG5cbmNvbnN0IGRhdGVUb1NRTCA9IHJlcXVpcmUoJy4vZGF0ZS10by1zcWwnKTtcblxuY29uc3QgbW9udGhzID0gWydqYW4nLCAnZmViJywgJ21hcicsICdhcHInLCAnbWF5JywgJ2p1bicsICdqdWwnLCAnYXVnJywgJ3NlcCcsICdvY3QnLCAnbm92JywgJ2RlYycsICdqYW51YXJ5JywgJ2ZlYnJ1YXJ5JywgJ21hcmNoJywgJ2FwcmlsJywgJ21heScsICdqdW5lJywgJ2p1bHknLCAnYXVndXN0JywgJ3NlcHRlbWJlcicsICdvY3RvYmVyJywgJ25vdmVtYmVyJywgJ2RlY2VtYmVyJ107XG5cbmNvbnN0IF9zbGFzaFJlID0gL14oLio/KVxcYihbMC05XXsxLDR9KSg/OihbXFwtXFwvXFwuXFx1NWU3NF0pKFswLTldezEsMn0pKT8oPzooW1xcLVxcL1xcLlxcdTY3MDhdKShbMC05XXsxLDR9KSk/KCg/OlxcYnxbXjAtOV0pLio/KSQvXG5jb25zdCBfeWVhclJlID0gL14oLio/KVxcYigoPzpjaXJjYSB8YXJvdW5kIHxhYm91dCB8Y1xcLj8gPyk/WzAtOV17MSw0fSg/OiA/QlxcLj8gP0NcXC4/KD86ID9FXFwuPyk/fCA/Q1xcLj8gP0VcXC4/fCA/QVxcLj8gP0RcXC4/KXxbMC05XXszLDR9KVxcYiguKj8pJC9pO1xuY29uc3QgX21vbnRoUmUgPSBuZXcgUmVnRXhwKCdeKC4qKVxcXFxiKCcgKyBtb250aHMuam9pbignfCcpICsgJylbXiBdKig/OiAoLiopJHwkKScsICdpJyk7XG5jb25zdCBfZGF5UmUgPSBuZXcgUmVnRXhwKCdcXFxcYihbMC05XXsxLDJ9KSg/OnN0fG5kfHJkfHRoKT9cXFxcYiguKiknLCAnaScpO1xuXG5jb25zdCBfaW5zZXJ0RGF0ZU9yZGVyUGFydCA9IChkYXRlT3JkZXIsIHBhcnQsIHBhcnRPcmRlcikgPT4ge1xuXHRcdGlmICghZGF0ZU9yZGVyKSB7XG5cdFx0XHRyZXR1cm4gcGFydDtcblx0XHR9XG5cdFx0aWYgKHBhcnRPcmRlci5iZWZvcmUgPT09IHRydWUpIHtcblx0XHRcdHJldHVybiBwYXJ0ICsgZGF0ZU9yZGVyO1xuXHRcdH1cblx0XHRpZiAocGFydE9yZGVyLmFmdGVyID09PSB0cnVlKSB7XG5cdFx0XHRyZXR1cm4gZGF0ZU9yZGVyICsgcGFydDtcblx0XHR9XG5cdFx0aWYgKHBhcnRPcmRlci5iZWZvcmUpIHtcblx0XHRcdGxldCBwb3MgPSBkYXRlT3JkZXIuaW5kZXhPZihwYXJ0T3JkZXIuYmVmb3JlKTtcblx0XHRcdGlmIChwb3MgPT0gLTEpIHtcblx0XHRcdFx0cmV0dXJuIGRhdGVPcmRlcjtcblx0XHRcdH1cblx0XHRcdHJldHVybiBkYXRlT3JkZXIucmVwbGFjZShuZXcgUmVnRXhwKCcoJyArIHBhcnRPcmRlci5iZWZvcmUgKyAnKScpLCBwYXJ0ICsgJyQxJyk7XG5cdFx0fVxuXHRcdGlmIChwYXJ0T3JkZXIuYWZ0ZXIpIHtcblx0XHRcdGxldCBwb3MgPSBkYXRlT3JkZXIuaW5kZXhPZihwYXJ0T3JkZXIuYWZ0ZXIpO1xuXHRcdFx0aWYgKHBvcyA9PSAtMSkge1xuXHRcdFx0XHRyZXR1cm4gZGF0ZU9yZGVyICsgcGFydDtcblx0XHRcdH1cblx0XHRcdHJldHVybiBkYXRlT3JkZXIucmVwbGFjZShuZXcgUmVnRXhwKCcoJyArIHBhcnRPcmRlci5hZnRlciArICcpJyksICckMScgKyBwYXJ0KTtcblx0XHR9XG5cdFx0cmV0dXJuIGRhdGVPcmRlciArIHBhcnQ7XG59XG5cbm1vZHVsZS5leHBvcnRzID0gc3RyaW5nID0+IHtcblx0dmFyIGRhdGUgPSB7XG5cdFx0b3JkZXI6ICcnXG5cdH07XG5cblx0Ly8gc2tpcCBlbXB0eSB0aGluZ3Ncblx0aWYoIXN0cmluZykge1xuXHRcdHJldHVybiBkYXRlO1xuXHR9XG5cblx0dmFyIHBhcnRzID0gW107XG5cblx0Ly8gUGFyc2UgJ3llc3RlcmRheScvJ3RvZGF5Jy8ndG9tb3Jyb3cnXG5cdGxldCBsYyA9IChzdHJpbmcgKyAnJykudG9Mb3dlckNhc2UoKTtcblx0aWYgKGxjID09ICd5ZXN0ZXJkYXknKSB7XG5cdFx0c3RyaW5nID0gZGF0ZVRvU1FMKG5ldyBEYXRlKERhdGUubm93KCkgLSAxMDAwKjYwKjYwKjI0KSkuc3Vic3RyKDAsIDEwKTtcblx0fVxuXHRlbHNlIGlmIChsYyA9PSAndG9kYXknKSB7XG5cdFx0c3RyaW5nID0gZGF0ZVRvU1FMKG5ldyBEYXRlKCkpLnN1YnN0cigwLCAxMCk7XG5cdH1cblx0ZWxzZSBpZiAobGMgPT0gJ3RvbW9ycm93Jykge1xuXHRcdHN0cmluZyA9IGRhdGVUb1NRTChuZXcgRGF0ZShEYXRlLm5vdygpICsgMTAwMCo2MCo2MCoyNCkpLnN1YnN0cigwLCAxMCk7XG5cdH1cblx0ZWxzZSB7XG5cdFx0c3RyaW5nID0gc3RyaW5nLnRvU3RyaW5nKCkucmVwbGFjZSgvXlxccyt8XFxzKyQvZywgJycpLnJlcGxhY2UoL1xccysvLCAnICcpO1xuXHR9XG5cblx0Ly8gZmlyc3QsIGRpcmVjdGx5IGluc3BlY3QgdGhlIHN0cmluZ1xuXHRsZXQgbSA9IF9zbGFzaFJlLmV4ZWMoc3RyaW5nKTtcblx0aWYobSAmJlxuXHRcdCgoIW1bNV0gfHwgIW1bM10pIHx8IG1bM10gPT0gbVs1XSB8fCAobVszXSA9PSAnXFx1NWU3NCcgJiYgbVs1XSA9PSAnXFx1NjcwOCcpKSAmJlx0Ly8gcmVxdWlyZSBzYW5lIHNlcGFyYXRvcnNcblx0XHQoKG1bMl0gJiYgbVs0XSAmJiBtWzZdKSB8fCAoIW1bMV0gJiYgIW1bN10pKSkge1x0XHRcdFx0XHRcdC8vIHJlcXVpcmUgdGhhdCBlaXRoZXIgYWxsIHBhcnRzIGFyZSBmb3VuZCxcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0Ly8gb3IgZWxzZSB0aGlzIGlzIHRoZSBlbnRpcmUgZGF0ZSBmaWVsZFxuXHRcdC8vIGZpZ3VyZSBvdXQgZGF0ZSBiYXNlZCBvbiBwYXJ0c1xuXHRcdGlmKG1bMl0ubGVuZ3RoID09IDMgfHwgbVsyXS5sZW5ndGggPT0gNCB8fCBtWzNdID09ICdcXHU1ZTc0Jykge1xuXHRcdFx0Ly8gSVNPIDg2MDEgc3R5bGUgZGF0ZSAoYmlnIGVuZGlhbilcblx0XHRcdGRhdGUueWVhciA9IG1bMl07XG5cdFx0XHRkYXRlLm1vbnRoID0gbVs0XTtcblx0XHRcdGRhdGUuZGF5ID0gbVs2XTtcblx0XHRcdGRhdGUub3JkZXIgKz0gbVsyXSA/ICd5JyA6ICcnO1xuXHRcdFx0ZGF0ZS5vcmRlciArPSBtWzRdID8gJ20nIDogJyc7XG5cdFx0XHRkYXRlLm9yZGVyICs9IG1bNl0gPyAnZCcgOiAnJztcblx0XHR9IGVsc2UgaWYobVsyXSAmJiAhbVs0XSAmJiBtWzZdKSB7XG5cdFx0XHRkYXRlLm1vbnRoID0gbVsyXTtcblx0XHRcdGRhdGUueWVhciA9IG1bNl07XG5cdFx0XHRkYXRlLm9yZGVyICs9IG1bMl0gPyAnbScgOiAnJztcblx0XHRcdGRhdGUub3JkZXIgKz0gbVs2XSA/ICd5JyA6ICcnO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHQvLyBsb2NhbCBzdHlsZSBkYXRlIChtaWRkbGUgb3IgbGl0dGxlIGVuZGlhbilcblx0XHRcdHZhciBjb3VudHJ5ID0gd2luZG93Lm5hdmlnYXRvci5sYW5ndWFnZSA/IHdpbmRvdy5uYXZpZ2F0b3IubGFuZ3VhZ2Uuc3Vic3RyKDMpIDogJ1VTJztcblx0XHRcdGlmKGNvdW50cnkgPT0gJ1VTJyB8fFx0Ly8gVGhlIFVuaXRlZCBTdGF0ZXNcblx0XHRcdFx0Y291bnRyeSA9PSAnRk0nIHx8XHQvLyBUaGUgRmVkZXJhdGVkIFN0YXRlcyBvZiBNaWNyb25lc2lhXG5cdFx0XHRcdGNvdW50cnkgPT0gJ1BXJyB8fFx0Ly8gUGFsYXVcblx0XHRcdFx0Y291bnRyeSA9PSAnUEgnKSB7XHQvLyBUaGUgUGhpbGlwcGluZXNcblx0XHRcdFx0XHRkYXRlLm1vbnRoID0gbVsyXTtcblx0XHRcdFx0XHRkYXRlLmRheSA9IG1bNF07XG5cdFx0XHRcdFx0ZGF0ZS5vcmRlciArPSBtWzJdID8gJ20nIDogJyc7XG5cdFx0XHRcdFx0ZGF0ZS5vcmRlciArPSBtWzRdID8gJ2QnIDogJyc7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRkYXRlLm1vbnRoID0gbVs0XTtcblx0XHRcdFx0ZGF0ZS5kYXkgPSBtWzJdO1xuXHRcdFx0XHRkYXRlLm9yZGVyICs9IG1bMl0gPyAnZCcgOiAnJztcblx0XHRcdFx0ZGF0ZS5vcmRlciArPSBtWzRdID8gJ20nIDogJyc7XG5cdFx0XHR9XG5cdFx0XHRkYXRlLnllYXIgPSBtWzZdO1xuXHRcdFx0ZGF0ZS5vcmRlciArPSAneSc7XG5cdFx0fVxuXG5cdFx0aWYoZGF0ZS55ZWFyKSB7XG5cdFx0XHRkYXRlLnllYXIgPSBwYXJzZUludChkYXRlLnllYXIsIDEwKTtcblx0XHR9XG5cdFx0aWYoZGF0ZS5kYXkpIHtcblx0XHRcdGRhdGUuZGF5ID0gcGFyc2VJbnQoZGF0ZS5kYXksIDEwKTtcblx0XHR9XG5cdFx0aWYoZGF0ZS5tb250aCkge1xuXHRcdFx0ZGF0ZS5tb250aCA9IHBhcnNlSW50KGRhdGUubW9udGgsIDEwKTtcblxuXHRcdFx0aWYoZGF0ZS5tb250aCA+IDEyKSB7XG5cdFx0XHRcdC8vIHN3YXAgZGF5IGFuZCBtb250aFxuXHRcdFx0XHR2YXIgdG1wID0gZGF0ZS5kYXk7XG5cdFx0XHRcdGRhdGUuZGF5ID0gZGF0ZS5tb250aFxuXHRcdFx0XHRkYXRlLm1vbnRoID0gdG1wO1xuXHRcdFx0XHRkYXRlLm9yZGVyID0gZGF0ZS5vcmRlci5yZXBsYWNlKCdtJywgJ0QnKVxuXHRcdFx0XHRcdC5yZXBsYWNlKCdkJywgJ00nKVxuXHRcdFx0XHRcdC5yZXBsYWNlKCdEJywgJ2QnKVxuXHRcdFx0XHRcdC5yZXBsYWNlKCdNJywgJ20nKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRpZigoIWRhdGUubW9udGggfHwgZGF0ZS5tb250aCA8PSAxMikgJiYgKCFkYXRlLmRheSB8fCBkYXRlLmRheSA8PSAzMSkpIHtcblx0XHRcdGlmKGRhdGUueWVhciAmJiBkYXRlLnllYXIgPCAxMDApIHtcdC8vIGZvciB0d28gZGlnaXQgeWVhcnMsIGRldGVybWluZSBwcm9wZXJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdC8vIGZvdXIgZGlnaXQgeWVhclxuXHRcdFx0XHR2YXIgdG9kYXkgPSBuZXcgRGF0ZSgpO1xuXHRcdFx0XHR2YXIgeWVhciA9IHRvZGF5LmdldEZ1bGxZZWFyKCk7XG5cdFx0XHRcdHZhciB0d29EaWdpdFllYXIgPSB5ZWFyICUgMTAwO1xuXHRcdFx0XHR2YXIgY2VudHVyeSA9IHllYXIgLSB0d29EaWdpdFllYXI7XG5cblx0XHRcdFx0aWYoZGF0ZS55ZWFyIDw9IHR3b0RpZ2l0WWVhcikge1xuXHRcdFx0XHRcdC8vIGFzc3VtZSB0aGlzIGRhdGUgaXMgZnJvbSBvdXIgY2VudHVyeVxuXHRcdFx0XHRcdGRhdGUueWVhciA9IGNlbnR1cnkgKyBkYXRlLnllYXI7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0Ly8gYXNzdW1lIHRoaXMgZGF0ZSBpcyBmcm9tIHRoZSBwcmV2aW91cyBjZW50dXJ5XG5cdFx0XHRcdFx0ZGF0ZS55ZWFyID0gY2VudHVyeSAtIDEwMCArIGRhdGUueWVhcjtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0XHRpZihkYXRlLm1vbnRoKSB7XG5cdFx0XHRcdGRhdGUubW9udGgtLTtcdFx0Ly8gc3VidHJhY3Qgb25lIGZvciBKUyBzdHlsZVxuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0ZGVsZXRlIGRhdGUubW9udGg7XG5cdFx0XHR9XG5cblx0XHRcdHBhcnRzLnB1c2goXG5cdFx0XHRcdHsgcGFydDogbVsxXSwgYmVmb3JlOiB0cnVlIH0sXG5cdFx0XHRcdHsgcGFydDogbVs3XSB9XG5cdFx0XHQpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHR2YXIgZGF0ZSA9IHtcblx0XHRcdFx0b3JkZXI6ICcnXG5cdFx0XHR9O1xuXHRcdFx0cGFydHMucHVzaCh7IHBhcnQ6IHN0cmluZyB9KTtcblx0XHR9XG5cdH0gZWxzZSB7XG5cdFx0cGFydHMucHVzaCh7IHBhcnQ6IHN0cmluZyB9KTtcblx0fVxuXG5cdC8vIGNvdWxkbid0IGZpbmQgc29tZXRoaW5nIHdpdGggdGhlIGFsZ29yaXRobXM7IHVzZSByZWdleHBcblx0Ly8gWUVBUlxuXHRpZighZGF0ZS55ZWFyKSB7XG5cdFx0Zm9yIChsZXQgaSBpbiBwYXJ0cykge1xuXHRcdFx0bGV0IG0gPSBfeWVhclJlLmV4ZWMocGFydHNbaV0ucGFydCk7XG5cdFx0XHRpZiAobSkge1xuXHRcdFx0XHRkYXRlLnllYXIgPSBtWzJdO1xuXHRcdFx0XHRkYXRlLm9yZGVyID0gX2luc2VydERhdGVPcmRlclBhcnQoZGF0ZS5vcmRlciwgJ3knLCBwYXJ0c1tpXSk7XG5cdFx0XHRcdHBhcnRzLnNwbGljZShcblx0XHRcdFx0XHRpLCAxLFxuXHRcdFx0XHRcdHsgcGFydDogbVsxXSwgYmVmb3JlOiB0cnVlIH0sXG5cdFx0XHRcdFx0eyBwYXJ0OiBtWzNdIH1cblx0XHRcdFx0KTtcblx0XHRcdFx0YnJlYWs7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0Ly8gTU9OVEhcblx0aWYoZGF0ZS5tb250aCA9PT0gdW5kZWZpbmVkKSB7XG5cdFx0Zm9yIChsZXQgaSBpbiBwYXJ0cykge1xuXHRcdFx0bGV0IG0gPSBfbW9udGhSZS5leGVjKHBhcnRzW2ldLnBhcnQpO1xuXHRcdFx0aWYgKG0pIHtcblx0XHRcdFx0Ly8gTW9kdWxvIDEyIGluIGNhc2Ugd2UgaGF2ZSBtdWx0aXBsZSBsYW5ndWFnZXNcblx0XHRcdFx0ZGF0ZS5tb250aCA9IG1vbnRocy5pbmRleE9mKG1bMl0udG9Mb3dlckNhc2UoKSkgJSAxMjtcblx0XHRcdFx0ZGF0ZS5vcmRlciA9IF9pbnNlcnREYXRlT3JkZXJQYXJ0KGRhdGUub3JkZXIsICdtJywgcGFydHNbaV0pO1xuXHRcdFx0XHRwYXJ0cy5zcGxpY2UoXG5cdFx0XHRcdFx0aSwgMSxcblx0XHRcdFx0XHR7IHBhcnQ6IG1bMV0sIGJlZm9yZTogJ20nIH0sXG5cdFx0XHRcdFx0eyBwYXJ0OiBtWzNdLCBhZnRlcjogJ20nIH1cblx0XHRcdFx0KTtcblx0XHRcdFx0YnJlYWs7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0Ly8gREFZXG5cdGlmKCFkYXRlLmRheSkge1xuXHRcdC8vIGNvbXBpbGUgZGF5IHJlZ3VsYXIgZXhwcmVzc2lvblxuXHRcdGZvciAobGV0IGkgaW4gcGFydHMpIHtcblx0XHRcdGxldCBtID0gX2RheVJlLmV4ZWMocGFydHNbaV0ucGFydCk7XG5cdFx0XHRpZiAobSkge1xuXHRcdFx0XHR2YXIgZGF5ID0gcGFyc2VJbnQobVsxXSwgMTApLFxuXHRcdFx0XHRcdHBhcnQ7XG5cdFx0XHRcdC8vIFNhbml0eSBjaGVja1xuXHRcdFx0XHRpZiAoZGF5IDw9IDMxKSB7XG5cdFx0XHRcdFx0ZGF0ZS5kYXkgPSBkYXk7XG5cdFx0XHRcdFx0ZGF0ZS5vcmRlciA9IF9pbnNlcnREYXRlT3JkZXJQYXJ0KGRhdGUub3JkZXIsICdkJywgcGFydHNbaV0pO1xuXHRcdFx0XHRcdGlmKG0uaW5kZXggPiAwKSB7XG5cdFx0XHRcdFx0XHRwYXJ0ID0gcGFydHNbaV0ucGFydC5zdWJzdHIoMCwgbS5pbmRleCk7XG5cdFx0XHRcdFx0XHRpZihtWzJdKSB7XG5cdFx0XHRcdFx0XHRcdHBhcnQgKz0gJyAnICsgbVsyXTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0cGFydCA9IG1bMl07XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdHBhcnRzLnNwbGljZShcblx0XHRcdFx0XHRcdGksIDEsXG5cdFx0XHRcdFx0XHR7IHBhcnQ6IHBhcnQgfVxuXHRcdFx0XHRcdCk7XG5cdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHQvLyBDb25jYXRlbmF0ZSBkYXRlIHBhcnRzXG5cdGRhdGUucGFydCA9ICcnO1xuXHRmb3IgKHZhciBpIGluIHBhcnRzKSB7XG5cdFx0ZGF0ZS5wYXJ0ICs9IHBhcnRzW2ldLnBhcnQgKyAnICc7XG5cdH1cblxuXHQvLyBjbGVhbiB1cCBkYXRlIHBhcnRcblx0aWYoZGF0ZS5wYXJ0KSB7XG5cdFx0ZGF0ZS5wYXJ0ID0gZGF0ZS5wYXJ0LnJlcGxhY2UoL15bXkEtWmEtejAtOV0rfFteQS1aYS16MC05XSskL2csICcnKTtcblx0fVxuXG5cdGlmKGRhdGUucGFydCA9PT0gJycgfHwgZGF0ZS5wYXJ0ID09IHVuZGVmaW5lZCkge1xuXHRcdGRlbGV0ZSBkYXRlLnBhcnQ7XG5cdH1cblxuXHQvL21ha2Ugc3VyZSB5ZWFyIGlzIGFsd2F5cyBhIHN0cmluZ1xuXHRpZihkYXRlLnllYXIgfHwgZGF0ZS55ZWFyID09PSAwKSBkYXRlLnllYXIgKz0gJyc7XG5cblx0cmV0dXJuIGRhdGU7XG59XG4iLCJjb25zdCBmaWVsZHMgPSByZXF1aXJlKCcuL2ZpZWxkcycpO1xuY29uc3QgaXRlbVR5cGVzID0gcmVxdWlyZSgnLi9pdGVtLXR5cGVzJyk7XG5cbmNvbnN0IHR5cGVTcGVjaWZpY0ZpZWxkTWFwID0ge1xuXHRbKDE2IDw8IDgpICsgNF06IDk0LFxuXHRbKDE3IDw8IDgpICsgNF06IDk3LFxuXHRbKDcgPDwgOCkgKyA4XTogODksXG5cdFsoMTEgPDwgOCkgKyA4XTogMjEsXG5cdFsoMTUgPDwgOCkgKyA4XTogMzEsXG5cdFsoMjYgPDwgOCkgKyA4XTogNzIsXG5cdFsoMjggPDwgOCkgKyA4XTogNzYsXG5cdFsoMjkgPDwgOCkgKyA4XTogNzgsXG5cdFsoMzAgPDwgOCkgKyA4XTogNzgsXG5cdFsoMzIgPDwgOCkgKyA4XTogODMsXG5cdFsoMTYgPDwgOCkgKyAxMF06IDk1LFxuXHRbKDE3IDw8IDgpICsgMTBdOiA5OCxcblx0WygzIDw8IDgpICsgMTJdOiAxMTUsXG5cdFsoMzMgPDwgOCkgKyAxMl06IDExNCxcblx0WygxMyA8PCA4KSArIDEyXTogOTEsXG5cdFsoMjMgPDwgOCkgKyAxMl06IDEwNyxcblx0WygyNSA8PCA4KSArIDEyXTogMTA0LFxuXHRbKDI5IDw8IDgpICsgMTJdOiAxMTksXG5cdFsoMzAgPDwgOCkgKyAxMl06IDExOSxcblx0WygzNSA8PCA4KSArIDEyXTogODUsXG5cdFsoMzYgPDwgOCkgKyAxMl06IDg2LFxuXHRbKDE3IDw8IDgpICsgMTRdOiA5Nixcblx0WygxOSA8PCA4KSArIDE0XTogNTIsXG5cdFsoMjAgPDwgOCkgKyAxNF06IDEwMCxcblx0WygxNSA8PCA4KSArIDYwXTogOTIsXG5cdFsoMTYgPDwgOCkgKyA2MF06IDkzLFxuXHRbKDE3IDw8IDgpICsgNjBdOiAxMTcsXG5cdFsoMTggPDwgOCkgKyA2MF06IDk5LFxuXHRbKDE5IDw8IDgpICsgNjBdOiA1MCxcblx0WygyMCA8PCA4KSArIDYwXTogMTAxLFxuXHRbKDI5IDw8IDgpICsgNjBdOiAxMDUsXG5cdFsoMzAgPDwgOCkgKyA2MF06IDEwNSxcblx0WygzMSA8PCA4KSArIDYwXTogMTA1LFxuXHRbKDcgPDwgOCkgKyAxMDhdOiA2OSxcblx0Wyg4IDw8IDgpICsgMTA4XTogNjUsXG5cdFsoOSA8PCA4KSArIDEwOF06IDY2LFxuXHRbKDExIDw8IDgpICsgMTA4XTogMTIyLFxuXHRbKDEzIDw8IDgpICsgMTA4XTogNzAsXG5cdFsoMTUgPDwgOCkgKyAxMDhdOiAzMixcblx0WygyMiA8PCA4KSArIDEwOF06IDY3LFxuXHRbKDIzIDw8IDgpICsgMTA4XTogNzAsXG5cdFsoMjUgPDwgOCkgKyAxMDhdOiA3OSxcblx0WygyNyA8PCA4KSArIDEwOF06IDc0LFxuXHRbKDEwIDw8IDgpICsgMTA5XTogNjQsXG5cdFsoMTEgPDwgOCkgKyAxMDldOiA2Myxcblx0WygxMiA8PCA4KSArIDEwOV06IDU5LFxuXHRbKDI2IDw8IDgpICsgMTA5XTogNzEsXG5cdFsoMjggPDwgOCkgKyAxMDldOiA2Myxcblx0WygyOSA8PCA4KSArIDEwOV06IDYzLFxuXHRbKDMwIDw8IDgpICsgMTA5XTogNzEsXG5cdFsoMzEgPDwgOCkgKyAxMDldOiA4MCxcblx0WygxNyA8PCA4KSArIDExMF06IDExMSxcblx0WygyMCA8PCA4KSArIDExMF06IDExMixcblx0WygyMSA8PCA4KSArIDExMF06IDExM1xufTtcblxubW9kdWxlLmV4cG9ydHMgPSB7XG5cdG1hcDogdHlwZVNwZWNpZmljRmllbGRNYXAsXG5cdGdldEZpZWxkSURGcm9tVHlwZUFuZEJhc2U6ICh0eXBlSWQsIGZpZWxkSWQpID0+IHtcblx0XHR0eXBlSWQgPSB0eXBlb2YgdHlwZUlkID09PSAnbnVtYmVyJyA/IHR5cGVJZCA6IGl0ZW1UeXBlc1t0eXBlSWRdO1xuXHRcdGZpZWxkSWQgPSB0eXBlb2YgZmllbGRJZCA9PT0gJ251bWJlcicgPyBmaWVsZElkIDogZmllbGRzW2ZpZWxkSWRdO1xuXHRcdHJldHVybiB0eXBlU3BlY2lmaWNGaWVsZE1hcFsodHlwZUlkIDw8IDgpICsgZmllbGRJZF07XG5cdH1cbn07XG4iXX0=
