(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.ZoteroBib = f()}})(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
(function (process,global){
/**
 * Copyright (c) 2014, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * https://raw.github.com/facebook/regenerator/master/LICENSE file. An
 * additional grant of patent rights can be found in the PATENTS file in
 * the same directory.
 */

!(function(global) {
  "use strict";

  var hasOwn = Object.prototype.hasOwnProperty;
  var undefined; // More compressible than void 0.
  var iteratorSymbol =
    typeof Symbol === "function" && Symbol.iterator || "@@iterator";

  var inModule = typeof module === "object";
  var runtime = global.regeneratorRuntime;
  if (runtime) {
    if (inModule) {
      // If regeneratorRuntime is defined globally and we're in a module,
      // make the exports object identical to regeneratorRuntime.
      module.exports = runtime;
    }
    // Don't bother evaluating the rest of this file if the runtime was
    // already defined globally.
    return;
  }

  // Define the runtime globally (as expected by generated code) as either
  // module.exports (if we're in a module) or a new, empty object.
  runtime = global.regeneratorRuntime = inModule ? module.exports : {};

  function wrap(innerFn, outerFn, self, tryLocsList) {
    // If outerFn provided, then outerFn.prototype instanceof Generator.
    var generator = Object.create((outerFn || Generator).prototype);
    var context = new Context(tryLocsList || []);

    // The ._invoke method unifies the implementations of the .next,
    // .throw, and .return methods.
    generator._invoke = makeInvokeMethod(innerFn, self, context);

    return generator;
  }
  runtime.wrap = wrap;

  // Try/catch helper to minimize deoptimizations. Returns a completion
  // record like context.tryEntries[i].completion. This interface could
  // have been (and was previously) designed to take a closure to be
  // invoked without arguments, but in all the cases we care about we
  // already have an existing method we want to call, so there's no need
  // to create a new function object. We can even get away with assuming
  // the method takes exactly one argument, since that happens to be true
  // in every case, so we don't have to touch the arguments object. The
  // only additional allocation required is the completion record, which
  // has a stable shape and so hopefully should be cheap to allocate.
  function tryCatch(fn, obj, arg) {
    try {
      return { type: "normal", arg: fn.call(obj, arg) };
    } catch (err) {
      return { type: "throw", arg: err };
    }
  }

  var GenStateSuspendedStart = "suspendedStart";
  var GenStateSuspendedYield = "suspendedYield";
  var GenStateExecuting = "executing";
  var GenStateCompleted = "completed";

  // Returning this object from the innerFn has the same effect as
  // breaking out of the dispatch switch statement.
  var ContinueSentinel = {};

  // Dummy constructor functions that we use as the .constructor and
  // .constructor.prototype properties for functions that return Generator
  // objects. For full spec compliance, you may wish to configure your
  // minifier not to mangle the names of these two functions.
  function Generator() {}
  function GeneratorFunction() {}
  function GeneratorFunctionPrototype() {}

  var Gp = GeneratorFunctionPrototype.prototype = Generator.prototype;
  GeneratorFunction.prototype = Gp.constructor = GeneratorFunctionPrototype;
  GeneratorFunctionPrototype.constructor = GeneratorFunction;
  GeneratorFunction.displayName = "GeneratorFunction";

  // Helper for defining the .next, .throw, and .return methods of the
  // Iterator interface in terms of a single ._invoke method.
  function defineIteratorMethods(prototype) {
    ["next", "throw", "return"].forEach(function(method) {
      prototype[method] = function(arg) {
        return this._invoke(method, arg);
      };
    });
  }

  runtime.isGeneratorFunction = function(genFun) {
    var ctor = typeof genFun === "function" && genFun.constructor;
    return ctor
      ? ctor === GeneratorFunction ||
        // For the native GeneratorFunction constructor, the best we can
        // do is to check its .name property.
        (ctor.displayName || ctor.name) === "GeneratorFunction"
      : false;
  };

  runtime.mark = function(genFun) {
    if (Object.setPrototypeOf) {
      Object.setPrototypeOf(genFun, GeneratorFunctionPrototype);
    } else {
      genFun.__proto__ = GeneratorFunctionPrototype;
    }
    genFun.prototype = Object.create(Gp);
    return genFun;
  };

  // Within the body of any async function, `await x` is transformed to
  // `yield regeneratorRuntime.awrap(x)`, so that the runtime can test
  // `value instanceof AwaitArgument` to determine if the yielded value is
  // meant to be awaited. Some may consider the name of this method too
  // cutesy, but they are curmudgeons.
  runtime.awrap = function(arg) {
    return new AwaitArgument(arg);
  };

  function AwaitArgument(arg) {
    this.arg = arg;
  }

  function AsyncIterator(generator) {
    // This invoke function is written in a style that assumes some
    // calling function (or Promise) will handle exceptions.
    function invoke(method, arg) {
      var result = generator[method](arg);
      var value = result.value;
      return value instanceof AwaitArgument
        ? Promise.resolve(value.arg).then(invokeNext, invokeThrow)
        : Promise.resolve(value).then(function(unwrapped) {
            // When a yielded Promise is resolved, its final value becomes
            // the .value of the Promise<{value,done}> result for the
            // current iteration. If the Promise is rejected, however, the
            // result for this iteration will be rejected with the same
            // reason. Note that rejections of yielded Promises are not
            // thrown back into the generator function, as is the case
            // when an awaited Promise is rejected. This difference in
            // behavior between yield and await is important, because it
            // allows the consumer to decide what to do with the yielded
            // rejection (swallow it and continue, manually .throw it back
            // into the generator, abandon iteration, whatever). With
            // await, by contrast, there is no opportunity to examine the
            // rejection reason outside the generator function, so the
            // only option is to throw it from the await expression, and
            // let the generator function handle the exception.
            result.value = unwrapped;
            return result;
          });
    }

    if (typeof process === "object" && process.domain) {
      invoke = process.domain.bind(invoke);
    }

    var invokeNext = invoke.bind(generator, "next");
    var invokeThrow = invoke.bind(generator, "throw");
    var invokeReturn = invoke.bind(generator, "return");
    var previousPromise;

    function enqueue(method, arg) {
      function callInvokeWithMethodAndArg() {
        return invoke(method, arg);
      }

      return previousPromise =
        // If enqueue has been called before, then we want to wait until
        // all previous Promises have been resolved before calling invoke,
        // so that results are always delivered in the correct order. If
        // enqueue has not been called before, then it is important to
        // call invoke immediately, without waiting on a callback to fire,
        // so that the async generator function has the opportunity to do
        // any necessary setup in a predictable way. This predictability
        // is why the Promise constructor synchronously invokes its
        // executor callback, and why async functions synchronously
        // execute code before the first await. Since we implement simple
        // async functions in terms of async generators, it is especially
        // important to get this right, even though it requires care.
        previousPromise ? previousPromise.then(
          callInvokeWithMethodAndArg,
          // Avoid propagating failures to Promises returned by later
          // invocations of the iterator.
          callInvokeWithMethodAndArg
        ) : new Promise(function (resolve) {
          resolve(callInvokeWithMethodAndArg());
        });
    }

    // Define the unified helper method that is used to implement .next,
    // .throw, and .return (see defineIteratorMethods).
    this._invoke = enqueue;
  }

  defineIteratorMethods(AsyncIterator.prototype);

  // Note that simple async functions are implemented on top of
  // AsyncIterator objects; they just return a Promise for the value of
  // the final result produced by the iterator.
  runtime.async = function(innerFn, outerFn, self, tryLocsList) {
    var iter = new AsyncIterator(
      wrap(innerFn, outerFn, self, tryLocsList)
    );

    return runtime.isGeneratorFunction(outerFn)
      ? iter // If outerFn is a generator, return the full iterator.
      : iter.next().then(function(result) {
          return result.done ? result.value : iter.next();
        });
  };

  function makeInvokeMethod(innerFn, self, context) {
    var state = GenStateSuspendedStart;

    return function invoke(method, arg) {
      if (state === GenStateExecuting) {
        throw new Error("Generator is already running");
      }

      if (state === GenStateCompleted) {
        if (method === "throw") {
          throw arg;
        }

        // Be forgiving, per 25.3.3.3.3 of the spec:
        // https://people.mozilla.org/~jorendorff/es6-draft.html#sec-generatorresume
        return doneResult();
      }

      while (true) {
        var delegate = context.delegate;
        if (delegate) {
          if (method === "return" ||
              (method === "throw" && delegate.iterator[method] === undefined)) {
            // A return or throw (when the delegate iterator has no throw
            // method) always terminates the yield* loop.
            context.delegate = null;

            // If the delegate iterator has a return method, give it a
            // chance to clean up.
            var returnMethod = delegate.iterator["return"];
            if (returnMethod) {
              var record = tryCatch(returnMethod, delegate.iterator, arg);
              if (record.type === "throw") {
                // If the return method threw an exception, let that
                // exception prevail over the original return or throw.
                method = "throw";
                arg = record.arg;
                continue;
              }
            }

            if (method === "return") {
              // Continue with the outer return, now that the delegate
              // iterator has been terminated.
              continue;
            }
          }

          var record = tryCatch(
            delegate.iterator[method],
            delegate.iterator,
            arg
          );

          if (record.type === "throw") {
            context.delegate = null;

            // Like returning generator.throw(uncaught), but without the
            // overhead of an extra function call.
            method = "throw";
            arg = record.arg;
            continue;
          }

          // Delegate generator ran and handled its own exceptions so
          // regardless of what the method was, we continue as if it is
          // "next" with an undefined arg.
          method = "next";
          arg = undefined;

          var info = record.arg;
          if (info.done) {
            context[delegate.resultName] = info.value;
            context.next = delegate.nextLoc;
          } else {
            state = GenStateSuspendedYield;
            return info;
          }

          context.delegate = null;
        }

        if (method === "next") {
          context._sent = arg;

          if (state === GenStateSuspendedYield) {
            context.sent = arg;
          } else {
            context.sent = undefined;
          }
        } else if (method === "throw") {
          if (state === GenStateSuspendedStart) {
            state = GenStateCompleted;
            throw arg;
          }

          if (context.dispatchException(arg)) {
            // If the dispatched exception was caught by a catch block,
            // then let that catch block handle the exception normally.
            method = "next";
            arg = undefined;
          }

        } else if (method === "return") {
          context.abrupt("return", arg);
        }

        state = GenStateExecuting;

        var record = tryCatch(innerFn, self, context);
        if (record.type === "normal") {
          // If an exception is thrown from innerFn, we leave state ===
          // GenStateExecuting and loop back for another invocation.
          state = context.done
            ? GenStateCompleted
            : GenStateSuspendedYield;

          var info = {
            value: record.arg,
            done: context.done
          };

          if (record.arg === ContinueSentinel) {
            if (context.delegate && method === "next") {
              // Deliberately forget the last sent value so that we don't
              // accidentally pass it on to the delegate.
              arg = undefined;
            }
          } else {
            return info;
          }

        } else if (record.type === "throw") {
          state = GenStateCompleted;
          // Dispatch the exception by looping back around to the
          // context.dispatchException(arg) call above.
          method = "throw";
          arg = record.arg;
        }
      }
    };
  }

  // Define Generator.prototype.{next,throw,return} in terms of the
  // unified ._invoke helper method.
  defineIteratorMethods(Gp);

  Gp[iteratorSymbol] = function() {
    return this;
  };

  Gp.toString = function() {
    return "[object Generator]";
  };

  function pushTryEntry(locs) {
    var entry = { tryLoc: locs[0] };

    if (1 in locs) {
      entry.catchLoc = locs[1];
    }

    if (2 in locs) {
      entry.finallyLoc = locs[2];
      entry.afterLoc = locs[3];
    }

    this.tryEntries.push(entry);
  }

  function resetTryEntry(entry) {
    var record = entry.completion || {};
    record.type = "normal";
    delete record.arg;
    entry.completion = record;
  }

  function Context(tryLocsList) {
    // The root entry object (effectively a try statement without a catch
    // or a finally block) gives us a place to store values thrown from
    // locations where there is no enclosing try statement.
    this.tryEntries = [{ tryLoc: "root" }];
    tryLocsList.forEach(pushTryEntry, this);
    this.reset(true);
  }

  runtime.keys = function(object) {
    var keys = [];
    for (var key in object) {
      keys.push(key);
    }
    keys.reverse();

    // Rather than returning an object with a next method, we keep
    // things simple and return the next function itself.
    return function next() {
      while (keys.length) {
        var key = keys.pop();
        if (key in object) {
          next.value = key;
          next.done = false;
          return next;
        }
      }

      // To avoid creating an additional object, we just hang the .value
      // and .done properties off the next function object itself. This
      // also ensures that the minifier will not anonymize the function.
      next.done = true;
      return next;
    };
  };

  function values(iterable) {
    if (iterable) {
      var iteratorMethod = iterable[iteratorSymbol];
      if (iteratorMethod) {
        return iteratorMethod.call(iterable);
      }

      if (typeof iterable.next === "function") {
        return iterable;
      }

      if (!isNaN(iterable.length)) {
        var i = -1, next = function next() {
          while (++i < iterable.length) {
            if (hasOwn.call(iterable, i)) {
              next.value = iterable[i];
              next.done = false;
              return next;
            }
          }

          next.value = undefined;
          next.done = true;

          return next;
        };

        return next.next = next;
      }
    }

    // Return an iterator with no values.
    return { next: doneResult };
  }
  runtime.values = values;

  function doneResult() {
    return { value: undefined, done: true };
  }

  Context.prototype = {
    constructor: Context,

    reset: function(skipTempReset) {
      this.prev = 0;
      this.next = 0;
      this.sent = undefined;
      this.done = false;
      this.delegate = null;

      this.tryEntries.forEach(resetTryEntry);

      if (!skipTempReset) {
        for (var name in this) {
          // Not sure about the optimal order of these conditions:
          if (name.charAt(0) === "t" &&
              hasOwn.call(this, name) &&
              !isNaN(+name.slice(1))) {
            this[name] = undefined;
          }
        }
      }
    },

    stop: function() {
      this.done = true;

      var rootEntry = this.tryEntries[0];
      var rootRecord = rootEntry.completion;
      if (rootRecord.type === "throw") {
        throw rootRecord.arg;
      }

      return this.rval;
    },

    dispatchException: function(exception) {
      if (this.done) {
        throw exception;
      }

      var context = this;
      function handle(loc, caught) {
        record.type = "throw";
        record.arg = exception;
        context.next = loc;
        return !!caught;
      }

      for (var i = this.tryEntries.length - 1; i >= 0; --i) {
        var entry = this.tryEntries[i];
        var record = entry.completion;

        if (entry.tryLoc === "root") {
          // Exception thrown outside of any try block that could handle
          // it, so set the completion value of the entire function to
          // throw the exception.
          return handle("end");
        }

        if (entry.tryLoc <= this.prev) {
          var hasCatch = hasOwn.call(entry, "catchLoc");
          var hasFinally = hasOwn.call(entry, "finallyLoc");

          if (hasCatch && hasFinally) {
            if (this.prev < entry.catchLoc) {
              return handle(entry.catchLoc, true);
            } else if (this.prev < entry.finallyLoc) {
              return handle(entry.finallyLoc);
            }

          } else if (hasCatch) {
            if (this.prev < entry.catchLoc) {
              return handle(entry.catchLoc, true);
            }

          } else if (hasFinally) {
            if (this.prev < entry.finallyLoc) {
              return handle(entry.finallyLoc);
            }

          } else {
            throw new Error("try statement without catch or finally");
          }
        }
      }
    },

    abrupt: function(type, arg) {
      for (var i = this.tryEntries.length - 1; i >= 0; --i) {
        var entry = this.tryEntries[i];
        if (entry.tryLoc <= this.prev &&
            hasOwn.call(entry, "finallyLoc") &&
            this.prev < entry.finallyLoc) {
          var finallyEntry = entry;
          break;
        }
      }

      if (finallyEntry &&
          (type === "break" ||
           type === "continue") &&
          finallyEntry.tryLoc <= arg &&
          arg <= finallyEntry.finallyLoc) {
        // Ignore the finally entry if control is not jumping to a
        // location outside the try/catch block.
        finallyEntry = null;
      }

      var record = finallyEntry ? finallyEntry.completion : {};
      record.type = type;
      record.arg = arg;

      if (finallyEntry) {
        this.next = finallyEntry.finallyLoc;
      } else {
        this.complete(record);
      }

      return ContinueSentinel;
    },

    complete: function(record, afterLoc) {
      if (record.type === "throw") {
        throw record.arg;
      }

      if (record.type === "break" ||
          record.type === "continue") {
        this.next = record.arg;
      } else if (record.type === "return") {
        this.rval = record.arg;
        this.next = "end";
      } else if (record.type === "normal" && afterLoc) {
        this.next = afterLoc;
      }
    },

    finish: function(finallyLoc) {
      for (var i = this.tryEntries.length - 1; i >= 0; --i) {
        var entry = this.tryEntries[i];
        if (entry.finallyLoc === finallyLoc) {
          this.complete(entry.completion, entry.afterLoc);
          resetTryEntry(entry);
          return ContinueSentinel;
        }
      }
    },

    "catch": function(tryLoc) {
      for (var i = this.tryEntries.length - 1; i >= 0; --i) {
        var entry = this.tryEntries[i];
        if (entry.tryLoc === tryLoc) {
          var record = entry.completion;
          if (record.type === "throw") {
            var thrown = record.arg;
            resetTryEntry(entry);
          }
          return thrown;
        }
      }

      // The context.catch method must only be called with a location
      // argument that corresponds to a known catch block.
      throw new Error("illegal catch attempt");
    },

    delegateYield: function(iterable, resultName, nextLoc) {
      this.delegate = {
        iterator: values(iterable),
        resultName: resultName,
        nextLoc: nextLoc
      };

      return ContinueSentinel;
    }
  };
})(
  // Among the various tricks for obtaining a reference to the global
  // object, this seems to be the most reliable technique that does not
  // use indirect eval (which violates Content Security Policy).
  typeof global === "object" ? global :
  typeof window === "object" ? window :
  typeof self === "object" ? self : this
);

}).call(this,require('_process'),typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{"_process":5}],2:[function(require,module,exports){
// This file can be required in Browserify and Node.js for automatic polyfill
// To use it:  require('es6-promise/auto');
'use strict';
module.exports = require('./').polyfill();

},{"./":3}],3:[function(require,module,exports){
(function (process,global){
/*!
 * @overview es6-promise - a tiny implementation of Promises/A+.
 * @copyright Copyright (c) 2014 Yehuda Katz, Tom Dale, Stefan Penner and contributors (Conversion to ES6 API by Jake Archibald)
 * @license   Licensed under MIT license
 *            See https://raw.githubusercontent.com/stefanpenner/es6-promise/master/LICENSE
 * @version   4.1.1
 */

(function (global, factory) {
	typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
	typeof define === 'function' && define.amd ? define(factory) :
	(global.ES6Promise = factory());
}(this, (function () { 'use strict';

function objectOrFunction(x) {
  var type = typeof x;
  return x !== null && (type === 'object' || type === 'function');
}

function isFunction(x) {
  return typeof x === 'function';
}

var _isArray = undefined;
if (Array.isArray) {
  _isArray = Array.isArray;
} else {
  _isArray = function (x) {
    return Object.prototype.toString.call(x) === '[object Array]';
  };
}

var isArray = _isArray;

var len = 0;
var vertxNext = undefined;
var customSchedulerFn = undefined;

var asap = function asap(callback, arg) {
  queue[len] = callback;
  queue[len + 1] = arg;
  len += 2;
  if (len === 2) {
    // If len is 2, that means that we need to schedule an async flush.
    // If additional callbacks are queued before the queue is flushed, they
    // will be processed by this flush that we are scheduling.
    if (customSchedulerFn) {
      customSchedulerFn(flush);
    } else {
      scheduleFlush();
    }
  }
};

function setScheduler(scheduleFn) {
  customSchedulerFn = scheduleFn;
}

function setAsap(asapFn) {
  asap = asapFn;
}

var browserWindow = typeof window !== 'undefined' ? window : undefined;
var browserGlobal = browserWindow || {};
var BrowserMutationObserver = browserGlobal.MutationObserver || browserGlobal.WebKitMutationObserver;
var isNode = typeof self === 'undefined' && typeof process !== 'undefined' && ({}).toString.call(process) === '[object process]';

// test for web worker but not in IE10
var isWorker = typeof Uint8ClampedArray !== 'undefined' && typeof importScripts !== 'undefined' && typeof MessageChannel !== 'undefined';

// node
function useNextTick() {
  // node version 0.10.x displays a deprecation warning when nextTick is used recursively
  // see https://github.com/cujojs/when/issues/410 for details
  return function () {
    return process.nextTick(flush);
  };
}

// vertx
function useVertxTimer() {
  if (typeof vertxNext !== 'undefined') {
    return function () {
      vertxNext(flush);
    };
  }

  return useSetTimeout();
}

function useMutationObserver() {
  var iterations = 0;
  var observer = new BrowserMutationObserver(flush);
  var node = document.createTextNode('');
  observer.observe(node, { characterData: true });

  return function () {
    node.data = iterations = ++iterations % 2;
  };
}

// web worker
function useMessageChannel() {
  var channel = new MessageChannel();
  channel.port1.onmessage = flush;
  return function () {
    return channel.port2.postMessage(0);
  };
}

function useSetTimeout() {
  // Store setTimeout reference so es6-promise will be unaffected by
  // other code modifying setTimeout (like sinon.useFakeTimers())
  var globalSetTimeout = setTimeout;
  return function () {
    return globalSetTimeout(flush, 1);
  };
}

var queue = new Array(1000);
function flush() {
  for (var i = 0; i < len; i += 2) {
    var callback = queue[i];
    var arg = queue[i + 1];

    callback(arg);

    queue[i] = undefined;
    queue[i + 1] = undefined;
  }

  len = 0;
}

function attemptVertx() {
  try {
    var r = require;
    var vertx = r('vertx');
    vertxNext = vertx.runOnLoop || vertx.runOnContext;
    return useVertxTimer();
  } catch (e) {
    return useSetTimeout();
  }
}

var scheduleFlush = undefined;
// Decide what async method to use to triggering processing of queued callbacks:
if (isNode) {
  scheduleFlush = useNextTick();
} else if (BrowserMutationObserver) {
  scheduleFlush = useMutationObserver();
} else if (isWorker) {
  scheduleFlush = useMessageChannel();
} else if (browserWindow === undefined && typeof require === 'function') {
  scheduleFlush = attemptVertx();
} else {
  scheduleFlush = useSetTimeout();
}

function then(onFulfillment, onRejection) {
  var _arguments = arguments;

  var parent = this;

  var child = new this.constructor(noop);

  if (child[PROMISE_ID] === undefined) {
    makePromise(child);
  }

  var _state = parent._state;

  if (_state) {
    (function () {
      var callback = _arguments[_state - 1];
      asap(function () {
        return invokeCallback(_state, child, callback, parent._result);
      });
    })();
  } else {
    subscribe(parent, child, onFulfillment, onRejection);
  }

  return child;
}

/**
  `Promise.resolve` returns a promise that will become resolved with the
  passed `value`. It is shorthand for the following:

  ```javascript
  let promise = new Promise(function(resolve, reject){
    resolve(1);
  });

  promise.then(function(value){
    // value === 1
  });
  ```

  Instead of writing the above, your code now simply becomes the following:

  ```javascript
  let promise = Promise.resolve(1);

  promise.then(function(value){
    // value === 1
  });
  ```

  @method resolve
  @static
  @param {Any} value value that the returned promise will be resolved with
  Useful for tooling.
  @return {Promise} a promise that will become fulfilled with the given
  `value`
*/
function resolve$1(object) {
  /*jshint validthis:true */
  var Constructor = this;

  if (object && typeof object === 'object' && object.constructor === Constructor) {
    return object;
  }

  var promise = new Constructor(noop);
  resolve(promise, object);
  return promise;
}

var PROMISE_ID = Math.random().toString(36).substring(16);

function noop() {}

var PENDING = void 0;
var FULFILLED = 1;
var REJECTED = 2;

var GET_THEN_ERROR = new ErrorObject();

function selfFulfillment() {
  return new TypeError("You cannot resolve a promise with itself");
}

function cannotReturnOwn() {
  return new TypeError('A promises callback cannot return that same promise.');
}

function getThen(promise) {
  try {
    return promise.then;
  } catch (error) {
    GET_THEN_ERROR.error = error;
    return GET_THEN_ERROR;
  }
}

function tryThen(then$$1, value, fulfillmentHandler, rejectionHandler) {
  try {
    then$$1.call(value, fulfillmentHandler, rejectionHandler);
  } catch (e) {
    return e;
  }
}

function handleForeignThenable(promise, thenable, then$$1) {
  asap(function (promise) {
    var sealed = false;
    var error = tryThen(then$$1, thenable, function (value) {
      if (sealed) {
        return;
      }
      sealed = true;
      if (thenable !== value) {
        resolve(promise, value);
      } else {
        fulfill(promise, value);
      }
    }, function (reason) {
      if (sealed) {
        return;
      }
      sealed = true;

      reject(promise, reason);
    }, 'Settle: ' + (promise._label || ' unknown promise'));

    if (!sealed && error) {
      sealed = true;
      reject(promise, error);
    }
  }, promise);
}

function handleOwnThenable(promise, thenable) {
  if (thenable._state === FULFILLED) {
    fulfill(promise, thenable._result);
  } else if (thenable._state === REJECTED) {
    reject(promise, thenable._result);
  } else {
    subscribe(thenable, undefined, function (value) {
      return resolve(promise, value);
    }, function (reason) {
      return reject(promise, reason);
    });
  }
}

function handleMaybeThenable(promise, maybeThenable, then$$1) {
  if (maybeThenable.constructor === promise.constructor && then$$1 === then && maybeThenable.constructor.resolve === resolve$1) {
    handleOwnThenable(promise, maybeThenable);
  } else {
    if (then$$1 === GET_THEN_ERROR) {
      reject(promise, GET_THEN_ERROR.error);
      GET_THEN_ERROR.error = null;
    } else if (then$$1 === undefined) {
      fulfill(promise, maybeThenable);
    } else if (isFunction(then$$1)) {
      handleForeignThenable(promise, maybeThenable, then$$1);
    } else {
      fulfill(promise, maybeThenable);
    }
  }
}

function resolve(promise, value) {
  if (promise === value) {
    reject(promise, selfFulfillment());
  } else if (objectOrFunction(value)) {
    handleMaybeThenable(promise, value, getThen(value));
  } else {
    fulfill(promise, value);
  }
}

function publishRejection(promise) {
  if (promise._onerror) {
    promise._onerror(promise._result);
  }

  publish(promise);
}

function fulfill(promise, value) {
  if (promise._state !== PENDING) {
    return;
  }

  promise._result = value;
  promise._state = FULFILLED;

  if (promise._subscribers.length !== 0) {
    asap(publish, promise);
  }
}

function reject(promise, reason) {
  if (promise._state !== PENDING) {
    return;
  }
  promise._state = REJECTED;
  promise._result = reason;

  asap(publishRejection, promise);
}

function subscribe(parent, child, onFulfillment, onRejection) {
  var _subscribers = parent._subscribers;
  var length = _subscribers.length;

  parent._onerror = null;

  _subscribers[length] = child;
  _subscribers[length + FULFILLED] = onFulfillment;
  _subscribers[length + REJECTED] = onRejection;

  if (length === 0 && parent._state) {
    asap(publish, parent);
  }
}

function publish(promise) {
  var subscribers = promise._subscribers;
  var settled = promise._state;

  if (subscribers.length === 0) {
    return;
  }

  var child = undefined,
      callback = undefined,
      detail = promise._result;

  for (var i = 0; i < subscribers.length; i += 3) {
    child = subscribers[i];
    callback = subscribers[i + settled];

    if (child) {
      invokeCallback(settled, child, callback, detail);
    } else {
      callback(detail);
    }
  }

  promise._subscribers.length = 0;
}

function ErrorObject() {
  this.error = null;
}

var TRY_CATCH_ERROR = new ErrorObject();

function tryCatch(callback, detail) {
  try {
    return callback(detail);
  } catch (e) {
    TRY_CATCH_ERROR.error = e;
    return TRY_CATCH_ERROR;
  }
}

function invokeCallback(settled, promise, callback, detail) {
  var hasCallback = isFunction(callback),
      value = undefined,
      error = undefined,
      succeeded = undefined,
      failed = undefined;

  if (hasCallback) {
    value = tryCatch(callback, detail);

    if (value === TRY_CATCH_ERROR) {
      failed = true;
      error = value.error;
      value.error = null;
    } else {
      succeeded = true;
    }

    if (promise === value) {
      reject(promise, cannotReturnOwn());
      return;
    }
  } else {
    value = detail;
    succeeded = true;
  }

  if (promise._state !== PENDING) {
    // noop
  } else if (hasCallback && succeeded) {
      resolve(promise, value);
    } else if (failed) {
      reject(promise, error);
    } else if (settled === FULFILLED) {
      fulfill(promise, value);
    } else if (settled === REJECTED) {
      reject(promise, value);
    }
}

function initializePromise(promise, resolver) {
  try {
    resolver(function resolvePromise(value) {
      resolve(promise, value);
    }, function rejectPromise(reason) {
      reject(promise, reason);
    });
  } catch (e) {
    reject(promise, e);
  }
}

var id = 0;
function nextId() {
  return id++;
}

function makePromise(promise) {
  promise[PROMISE_ID] = id++;
  promise._state = undefined;
  promise._result = undefined;
  promise._subscribers = [];
}

function Enumerator$1(Constructor, input) {
  this._instanceConstructor = Constructor;
  this.promise = new Constructor(noop);

  if (!this.promise[PROMISE_ID]) {
    makePromise(this.promise);
  }

  if (isArray(input)) {
    this.length = input.length;
    this._remaining = input.length;

    this._result = new Array(this.length);

    if (this.length === 0) {
      fulfill(this.promise, this._result);
    } else {
      this.length = this.length || 0;
      this._enumerate(input);
      if (this._remaining === 0) {
        fulfill(this.promise, this._result);
      }
    }
  } else {
    reject(this.promise, validationError());
  }
}

function validationError() {
  return new Error('Array Methods must be provided an Array');
}

Enumerator$1.prototype._enumerate = function (input) {
  for (var i = 0; this._state === PENDING && i < input.length; i++) {
    this._eachEntry(input[i], i);
  }
};

Enumerator$1.prototype._eachEntry = function (entry, i) {
  var c = this._instanceConstructor;
  var resolve$$1 = c.resolve;

  if (resolve$$1 === resolve$1) {
    var _then = getThen(entry);

    if (_then === then && entry._state !== PENDING) {
      this._settledAt(entry._state, i, entry._result);
    } else if (typeof _then !== 'function') {
      this._remaining--;
      this._result[i] = entry;
    } else if (c === Promise$2) {
      var promise = new c(noop);
      handleMaybeThenable(promise, entry, _then);
      this._willSettleAt(promise, i);
    } else {
      this._willSettleAt(new c(function (resolve$$1) {
        return resolve$$1(entry);
      }), i);
    }
  } else {
    this._willSettleAt(resolve$$1(entry), i);
  }
};

Enumerator$1.prototype._settledAt = function (state, i, value) {
  var promise = this.promise;

  if (promise._state === PENDING) {
    this._remaining--;

    if (state === REJECTED) {
      reject(promise, value);
    } else {
      this._result[i] = value;
    }
  }

  if (this._remaining === 0) {
    fulfill(promise, this._result);
  }
};

Enumerator$1.prototype._willSettleAt = function (promise, i) {
  var enumerator = this;

  subscribe(promise, undefined, function (value) {
    return enumerator._settledAt(FULFILLED, i, value);
  }, function (reason) {
    return enumerator._settledAt(REJECTED, i, reason);
  });
};

/**
  `Promise.all` accepts an array of promises, and returns a new promise which
  is fulfilled with an array of fulfillment values for the passed promises, or
  rejected with the reason of the first passed promise to be rejected. It casts all
  elements of the passed iterable to promises as it runs this algorithm.

  Example:

  ```javascript
  let promise1 = resolve(1);
  let promise2 = resolve(2);
  let promise3 = resolve(3);
  let promises = [ promise1, promise2, promise3 ];

  Promise.all(promises).then(function(array){
    // The array here would be [ 1, 2, 3 ];
  });
  ```

  If any of the `promises` given to `all` are rejected, the first promise
  that is rejected will be given as an argument to the returned promises's
  rejection handler. For example:

  Example:

  ```javascript
  let promise1 = resolve(1);
  let promise2 = reject(new Error("2"));
  let promise3 = reject(new Error("3"));
  let promises = [ promise1, promise2, promise3 ];

  Promise.all(promises).then(function(array){
    // Code here never runs because there are rejected promises!
  }, function(error) {
    // error.message === "2"
  });
  ```

  @method all
  @static
  @param {Array} entries array of promises
  @param {String} label optional string for labeling the promise.
  Useful for tooling.
  @return {Promise} promise that is fulfilled when all `promises` have been
  fulfilled, or rejected if any of them become rejected.
  @static
*/
function all$1(entries) {
  return new Enumerator$1(this, entries).promise;
}

/**
  `Promise.race` returns a new promise which is settled in the same way as the
  first passed promise to settle.

  Example:

  ```javascript
  let promise1 = new Promise(function(resolve, reject){
    setTimeout(function(){
      resolve('promise 1');
    }, 200);
  });

  let promise2 = new Promise(function(resolve, reject){
    setTimeout(function(){
      resolve('promise 2');
    }, 100);
  });

  Promise.race([promise1, promise2]).then(function(result){
    // result === 'promise 2' because it was resolved before promise1
    // was resolved.
  });
  ```

  `Promise.race` is deterministic in that only the state of the first
  settled promise matters. For example, even if other promises given to the
  `promises` array argument are resolved, but the first settled promise has
  become rejected before the other promises became fulfilled, the returned
  promise will become rejected:

  ```javascript
  let promise1 = new Promise(function(resolve, reject){
    setTimeout(function(){
      resolve('promise 1');
    }, 200);
  });

  let promise2 = new Promise(function(resolve, reject){
    setTimeout(function(){
      reject(new Error('promise 2'));
    }, 100);
  });

  Promise.race([promise1, promise2]).then(function(result){
    // Code here never runs
  }, function(reason){
    // reason.message === 'promise 2' because promise 2 became rejected before
    // promise 1 became fulfilled
  });
  ```

  An example real-world use case is implementing timeouts:

  ```javascript
  Promise.race([ajax('foo.json'), timeout(5000)])
  ```

  @method race
  @static
  @param {Array} promises array of promises to observe
  Useful for tooling.
  @return {Promise} a promise which settles in the same way as the first passed
  promise to settle.
*/
function race$1(entries) {
  /*jshint validthis:true */
  var Constructor = this;

  if (!isArray(entries)) {
    return new Constructor(function (_, reject) {
      return reject(new TypeError('You must pass an array to race.'));
    });
  } else {
    return new Constructor(function (resolve, reject) {
      var length = entries.length;
      for (var i = 0; i < length; i++) {
        Constructor.resolve(entries[i]).then(resolve, reject);
      }
    });
  }
}

/**
  `Promise.reject` returns a promise rejected with the passed `reason`.
  It is shorthand for the following:

  ```javascript
  let promise = new Promise(function(resolve, reject){
    reject(new Error('WHOOPS'));
  });

  promise.then(function(value){
    // Code here doesn't run because the promise is rejected!
  }, function(reason){
    // reason.message === 'WHOOPS'
  });
  ```

  Instead of writing the above, your code now simply becomes the following:

  ```javascript
  let promise = Promise.reject(new Error('WHOOPS'));

  promise.then(function(value){
    // Code here doesn't run because the promise is rejected!
  }, function(reason){
    // reason.message === 'WHOOPS'
  });
  ```

  @method reject
  @static
  @param {Any} reason value that the returned promise will be rejected with.
  Useful for tooling.
  @return {Promise} a promise rejected with the given `reason`.
*/
function reject$1(reason) {
  /*jshint validthis:true */
  var Constructor = this;
  var promise = new Constructor(noop);
  reject(promise, reason);
  return promise;
}

function needsResolver() {
  throw new TypeError('You must pass a resolver function as the first argument to the promise constructor');
}

function needsNew() {
  throw new TypeError("Failed to construct 'Promise': Please use the 'new' operator, this object constructor cannot be called as a function.");
}

/**
  Promise objects represent the eventual result of an asynchronous operation. The
  primary way of interacting with a promise is through its `then` method, which
  registers callbacks to receive either a promise's eventual value or the reason
  why the promise cannot be fulfilled.

  Terminology
  -----------

  - `promise` is an object or function with a `then` method whose behavior conforms to this specification.
  - `thenable` is an object or function that defines a `then` method.
  - `value` is any legal JavaScript value (including undefined, a thenable, or a promise).
  - `exception` is a value that is thrown using the throw statement.
  - `reason` is a value that indicates why a promise was rejected.
  - `settled` the final resting state of a promise, fulfilled or rejected.

  A promise can be in one of three states: pending, fulfilled, or rejected.

  Promises that are fulfilled have a fulfillment value and are in the fulfilled
  state.  Promises that are rejected have a rejection reason and are in the
  rejected state.  A fulfillment value is never a thenable.

  Promises can also be said to *resolve* a value.  If this value is also a
  promise, then the original promise's settled state will match the value's
  settled state.  So a promise that *resolves* a promise that rejects will
  itself reject, and a promise that *resolves* a promise that fulfills will
  itself fulfill.


  Basic Usage:
  ------------

  ```js
  let promise = new Promise(function(resolve, reject) {
    // on success
    resolve(value);

    // on failure
    reject(reason);
  });

  promise.then(function(value) {
    // on fulfillment
  }, function(reason) {
    // on rejection
  });
  ```

  Advanced Usage:
  ---------------

  Promises shine when abstracting away asynchronous interactions such as
  `XMLHttpRequest`s.

  ```js
  function getJSON(url) {
    return new Promise(function(resolve, reject){
      let xhr = new XMLHttpRequest();

      xhr.open('GET', url);
      xhr.onreadystatechange = handler;
      xhr.responseType = 'json';
      xhr.setRequestHeader('Accept', 'application/json');
      xhr.send();

      function handler() {
        if (this.readyState === this.DONE) {
          if (this.status === 200) {
            resolve(this.response);
          } else {
            reject(new Error('getJSON: `' + url + '` failed with status: [' + this.status + ']'));
          }
        }
      };
    });
  }

  getJSON('/posts.json').then(function(json) {
    // on fulfillment
  }, function(reason) {
    // on rejection
  });
  ```

  Unlike callbacks, promises are great composable primitives.

  ```js
  Promise.all([
    getJSON('/posts'),
    getJSON('/comments')
  ]).then(function(values){
    values[0] // => postsJSON
    values[1] // => commentsJSON

    return values;
  });
  ```

  @class Promise
  @param {function} resolver
  Useful for tooling.
  @constructor
*/
function Promise$2(resolver) {
  this[PROMISE_ID] = nextId();
  this._result = this._state = undefined;
  this._subscribers = [];

  if (noop !== resolver) {
    typeof resolver !== 'function' && needsResolver();
    this instanceof Promise$2 ? initializePromise(this, resolver) : needsNew();
  }
}

Promise$2.all = all$1;
Promise$2.race = race$1;
Promise$2.resolve = resolve$1;
Promise$2.reject = reject$1;
Promise$2._setScheduler = setScheduler;
Promise$2._setAsap = setAsap;
Promise$2._asap = asap;

Promise$2.prototype = {
  constructor: Promise$2,

  /**
    The primary way of interacting with a promise is through its `then` method,
    which registers callbacks to receive either a promise's eventual value or the
    reason why the promise cannot be fulfilled.
  
    ```js
    findUser().then(function(user){
      // user is available
    }, function(reason){
      // user is unavailable, and you are given the reason why
    });
    ```
  
    Chaining
    --------
  
    The return value of `then` is itself a promise.  This second, 'downstream'
    promise is resolved with the return value of the first promise's fulfillment
    or rejection handler, or rejected if the handler throws an exception.
  
    ```js
    findUser().then(function (user) {
      return user.name;
    }, function (reason) {
      return 'default name';
    }).then(function (userName) {
      // If `findUser` fulfilled, `userName` will be the user's name, otherwise it
      // will be `'default name'`
    });
  
    findUser().then(function (user) {
      throw new Error('Found user, but still unhappy');
    }, function (reason) {
      throw new Error('`findUser` rejected and we're unhappy');
    }).then(function (value) {
      // never reached
    }, function (reason) {
      // if `findUser` fulfilled, `reason` will be 'Found user, but still unhappy'.
      // If `findUser` rejected, `reason` will be '`findUser` rejected and we're unhappy'.
    });
    ```
    If the downstream promise does not specify a rejection handler, rejection reasons will be propagated further downstream.
  
    ```js
    findUser().then(function (user) {
      throw new PedagogicalException('Upstream error');
    }).then(function (value) {
      // never reached
    }).then(function (value) {
      // never reached
    }, function (reason) {
      // The `PedgagocialException` is propagated all the way down to here
    });
    ```
  
    Assimilation
    ------------
  
    Sometimes the value you want to propagate to a downstream promise can only be
    retrieved asynchronously. This can be achieved by returning a promise in the
    fulfillment or rejection handler. The downstream promise will then be pending
    until the returned promise is settled. This is called *assimilation*.
  
    ```js
    findUser().then(function (user) {
      return findCommentsByAuthor(user);
    }).then(function (comments) {
      // The user's comments are now available
    });
    ```
  
    If the assimliated promise rejects, then the downstream promise will also reject.
  
    ```js
    findUser().then(function (user) {
      return findCommentsByAuthor(user);
    }).then(function (comments) {
      // If `findCommentsByAuthor` fulfills, we'll have the value here
    }, function (reason) {
      // If `findCommentsByAuthor` rejects, we'll have the reason here
    });
    ```
  
    Simple Example
    --------------
  
    Synchronous Example
  
    ```javascript
    let result;
  
    try {
      result = findResult();
      // success
    } catch(reason) {
      // failure
    }
    ```
  
    Errback Example
  
    ```js
    findResult(function(result, err){
      if (err) {
        // failure
      } else {
        // success
      }
    });
    ```
  
    Promise Example;
  
    ```javascript
    findResult().then(function(result){
      // success
    }, function(reason){
      // failure
    });
    ```
  
    Advanced Example
    --------------
  
    Synchronous Example
  
    ```javascript
    let author, books;
  
    try {
      author = findAuthor();
      books  = findBooksByAuthor(author);
      // success
    } catch(reason) {
      // failure
    }
    ```
  
    Errback Example
  
    ```js
  
    function foundBooks(books) {
  
    }
  
    function failure(reason) {
  
    }
  
    findAuthor(function(author, err){
      if (err) {
        failure(err);
        // failure
      } else {
        try {
          findBoooksByAuthor(author, function(books, err) {
            if (err) {
              failure(err);
            } else {
              try {
                foundBooks(books);
              } catch(reason) {
                failure(reason);
              }
            }
          });
        } catch(error) {
          failure(err);
        }
        // success
      }
    });
    ```
  
    Promise Example;
  
    ```javascript
    findAuthor().
      then(findBooksByAuthor).
      then(function(books){
        // found books
    }).catch(function(reason){
      // something went wrong
    });
    ```
  
    @method then
    @param {Function} onFulfilled
    @param {Function} onRejected
    Useful for tooling.
    @return {Promise}
  */
  then: then,

  /**
    `catch` is simply sugar for `then(undefined, onRejection)` which makes it the same
    as the catch block of a try/catch statement.
  
    ```js
    function findAuthor(){
      throw new Error('couldn't find that author');
    }
  
    // synchronous
    try {
      findAuthor();
    } catch(reason) {
      // something went wrong
    }
  
    // async with promises
    findAuthor().catch(function(reason){
      // something went wrong
    });
    ```
  
    @method catch
    @param {Function} onRejection
    Useful for tooling.
    @return {Promise}
  */
  'catch': function _catch(onRejection) {
    return this.then(null, onRejection);
  }
};

/*global self*/
function polyfill$1() {
    var local = undefined;

    if (typeof global !== 'undefined') {
        local = global;
    } else if (typeof self !== 'undefined') {
        local = self;
    } else {
        try {
            local = Function('return this')();
        } catch (e) {
            throw new Error('polyfill failed because global object is unavailable in this environment');
        }
    }

    var P = local.Promise;

    if (P) {
        var promiseToString = null;
        try {
            promiseToString = Object.prototype.toString.call(P.resolve());
        } catch (e) {
            // silently ignored
        }

        if (promiseToString === '[object Promise]' && !P.cast) {
            return;
        }
    }

    local.Promise = Promise$2;
}

// Strange compat..
Promise$2.polyfill = polyfill$1;
Promise$2.Promise = Promise$2;

return Promise$2;

})));



}).call(this,require('_process'),typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{"_process":5}],4:[function(require,module,exports){
// the whatwg-fetch polyfill installs the fetch() function
// on the global object (window or self)
//
// Return that as the export for use in Webpack, Browserify etc.
require('whatwg-fetch');
module.exports = self.fetch.bind(self);

},{"whatwg-fetch":6}],5:[function(require,module,exports){
// shim for using process in browser
var process = module.exports = {};

// cached from whatever global is present so that test runners that stub it
// don't break things.  But we need to wrap it in a try catch in case it is
// wrapped in strict mode code which doesn't define any globals.  It's inside a
// function because try/catches deoptimize in certain engines.

var cachedSetTimeout;
var cachedClearTimeout;

function defaultSetTimout() {
    throw new Error('setTimeout has not been defined');
}
function defaultClearTimeout () {
    throw new Error('clearTimeout has not been defined');
}
(function () {
    try {
        if (typeof setTimeout === 'function') {
            cachedSetTimeout = setTimeout;
        } else {
            cachedSetTimeout = defaultSetTimout;
        }
    } catch (e) {
        cachedSetTimeout = defaultSetTimout;
    }
    try {
        if (typeof clearTimeout === 'function') {
            cachedClearTimeout = clearTimeout;
        } else {
            cachedClearTimeout = defaultClearTimeout;
        }
    } catch (e) {
        cachedClearTimeout = defaultClearTimeout;
    }
} ())
function runTimeout(fun) {
    if (cachedSetTimeout === setTimeout) {
        //normal enviroments in sane situations
        return setTimeout(fun, 0);
    }
    // if setTimeout wasn't available but was latter defined
    if ((cachedSetTimeout === defaultSetTimout || !cachedSetTimeout) && setTimeout) {
        cachedSetTimeout = setTimeout;
        return setTimeout(fun, 0);
    }
    try {
        // when when somebody has screwed with setTimeout but no I.E. maddness
        return cachedSetTimeout(fun, 0);
    } catch(e){
        try {
            // When we are in I.E. but the script has been evaled so I.E. doesn't trust the global object when called normally
            return cachedSetTimeout.call(null, fun, 0);
        } catch(e){
            // same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error
            return cachedSetTimeout.call(this, fun, 0);
        }
    }


}
function runClearTimeout(marker) {
    if (cachedClearTimeout === clearTimeout) {
        //normal enviroments in sane situations
        return clearTimeout(marker);
    }
    // if clearTimeout wasn't available but was latter defined
    if ((cachedClearTimeout === defaultClearTimeout || !cachedClearTimeout) && clearTimeout) {
        cachedClearTimeout = clearTimeout;
        return clearTimeout(marker);
    }
    try {
        // when when somebody has screwed with setTimeout but no I.E. maddness
        return cachedClearTimeout(marker);
    } catch (e){
        try {
            // When we are in I.E. but the script has been evaled so I.E. doesn't  trust the global object when called normally
            return cachedClearTimeout.call(null, marker);
        } catch (e){
            // same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error.
            // Some versions of I.E. have different rules for clearTimeout vs setTimeout
            return cachedClearTimeout.call(this, marker);
        }
    }



}
var queue = [];
var draining = false;
var currentQueue;
var queueIndex = -1;

function cleanUpNextTick() {
    if (!draining || !currentQueue) {
        return;
    }
    draining = false;
    if (currentQueue.length) {
        queue = currentQueue.concat(queue);
    } else {
        queueIndex = -1;
    }
    if (queue.length) {
        drainQueue();
    }
}

function drainQueue() {
    if (draining) {
        return;
    }
    var timeout = runTimeout(cleanUpNextTick);
    draining = true;

    var len = queue.length;
    while(len) {
        currentQueue = queue;
        queue = [];
        while (++queueIndex < len) {
            if (currentQueue) {
                currentQueue[queueIndex].run();
            }
        }
        queueIndex = -1;
        len = queue.length;
    }
    currentQueue = null;
    draining = false;
    runClearTimeout(timeout);
}

process.nextTick = function (fun) {
    var args = new Array(arguments.length - 1);
    if (arguments.length > 1) {
        for (var i = 1; i < arguments.length; i++) {
            args[i - 1] = arguments[i];
        }
    }
    queue.push(new Item(fun, args));
    if (queue.length === 1 && !draining) {
        runTimeout(drainQueue);
    }
};

// v8 likes predictible objects
function Item(fun, array) {
    this.fun = fun;
    this.array = array;
}
Item.prototype.run = function () {
    this.fun.apply(null, this.array);
};
process.title = 'browser';
process.browser = true;
process.env = {};
process.argv = [];
process.version = ''; // empty string to avoid regexp issues
process.versions = {};

function noop() {}

process.on = noop;
process.addListener = noop;
process.once = noop;
process.off = noop;
process.removeListener = noop;
process.removeAllListeners = noop;
process.emit = noop;
process.prependListener = noop;
process.prependOnceListener = noop;

process.listeners = function (name) { return [] }

process.binding = function (name) {
    throw new Error('process.binding is not supported');
};

process.cwd = function () { return '/' };
process.chdir = function (dir) {
    throw new Error('process.chdir is not supported');
};
process.umask = function() { return 0; };

},{}],6:[function(require,module,exports){
(function(self) {
  'use strict';

  if (self.fetch) {
    return
  }

  var support = {
    searchParams: 'URLSearchParams' in self,
    iterable: 'Symbol' in self && 'iterator' in Symbol,
    blob: 'FileReader' in self && 'Blob' in self && (function() {
      try {
        new Blob()
        return true
      } catch(e) {
        return false
      }
    })(),
    formData: 'FormData' in self,
    arrayBuffer: 'ArrayBuffer' in self
  }

  if (support.arrayBuffer) {
    var viewClasses = [
      '[object Int8Array]',
      '[object Uint8Array]',
      '[object Uint8ClampedArray]',
      '[object Int16Array]',
      '[object Uint16Array]',
      '[object Int32Array]',
      '[object Uint32Array]',
      '[object Float32Array]',
      '[object Float64Array]'
    ]

    var isDataView = function(obj) {
      return obj && DataView.prototype.isPrototypeOf(obj)
    }

    var isArrayBufferView = ArrayBuffer.isView || function(obj) {
      return obj && viewClasses.indexOf(Object.prototype.toString.call(obj)) > -1
    }
  }

  function normalizeName(name) {
    if (typeof name !== 'string') {
      name = String(name)
    }
    if (/[^a-z0-9\-#$%&'*+.\^_`|~]/i.test(name)) {
      throw new TypeError('Invalid character in header field name')
    }
    return name.toLowerCase()
  }

  function normalizeValue(value) {
    if (typeof value !== 'string') {
      value = String(value)
    }
    return value
  }

  // Build a destructive iterator for the value list
  function iteratorFor(items) {
    var iterator = {
      next: function() {
        var value = items.shift()
        return {done: value === undefined, value: value}
      }
    }

    if (support.iterable) {
      iterator[Symbol.iterator] = function() {
        return iterator
      }
    }

    return iterator
  }

  function Headers(headers) {
    this.map = {}

    if (headers instanceof Headers) {
      headers.forEach(function(value, name) {
        this.append(name, value)
      }, this)
    } else if (Array.isArray(headers)) {
      headers.forEach(function(header) {
        this.append(header[0], header[1])
      }, this)
    } else if (headers) {
      Object.getOwnPropertyNames(headers).forEach(function(name) {
        this.append(name, headers[name])
      }, this)
    }
  }

  Headers.prototype.append = function(name, value) {
    name = normalizeName(name)
    value = normalizeValue(value)
    var oldValue = this.map[name]
    this.map[name] = oldValue ? oldValue+','+value : value
  }

  Headers.prototype['delete'] = function(name) {
    delete this.map[normalizeName(name)]
  }

  Headers.prototype.get = function(name) {
    name = normalizeName(name)
    return this.has(name) ? this.map[name] : null
  }

  Headers.prototype.has = function(name) {
    return this.map.hasOwnProperty(normalizeName(name))
  }

  Headers.prototype.set = function(name, value) {
    this.map[normalizeName(name)] = normalizeValue(value)
  }

  Headers.prototype.forEach = function(callback, thisArg) {
    for (var name in this.map) {
      if (this.map.hasOwnProperty(name)) {
        callback.call(thisArg, this.map[name], name, this)
      }
    }
  }

  Headers.prototype.keys = function() {
    var items = []
    this.forEach(function(value, name) { items.push(name) })
    return iteratorFor(items)
  }

  Headers.prototype.values = function() {
    var items = []
    this.forEach(function(value) { items.push(value) })
    return iteratorFor(items)
  }

  Headers.prototype.entries = function() {
    var items = []
    this.forEach(function(value, name) { items.push([name, value]) })
    return iteratorFor(items)
  }

  if (support.iterable) {
    Headers.prototype[Symbol.iterator] = Headers.prototype.entries
  }

  function consumed(body) {
    if (body.bodyUsed) {
      return Promise.reject(new TypeError('Already read'))
    }
    body.bodyUsed = true
  }

  function fileReaderReady(reader) {
    return new Promise(function(resolve, reject) {
      reader.onload = function() {
        resolve(reader.result)
      }
      reader.onerror = function() {
        reject(reader.error)
      }
    })
  }

  function readBlobAsArrayBuffer(blob) {
    var reader = new FileReader()
    var promise = fileReaderReady(reader)
    reader.readAsArrayBuffer(blob)
    return promise
  }

  function readBlobAsText(blob) {
    var reader = new FileReader()
    var promise = fileReaderReady(reader)
    reader.readAsText(blob)
    return promise
  }

  function readArrayBufferAsText(buf) {
    var view = new Uint8Array(buf)
    var chars = new Array(view.length)

    for (var i = 0; i < view.length; i++) {
      chars[i] = String.fromCharCode(view[i])
    }
    return chars.join('')
  }

  function bufferClone(buf) {
    if (buf.slice) {
      return buf.slice(0)
    } else {
      var view = new Uint8Array(buf.byteLength)
      view.set(new Uint8Array(buf))
      return view.buffer
    }
  }

  function Body() {
    this.bodyUsed = false

    this._initBody = function(body) {
      this._bodyInit = body
      if (!body) {
        this._bodyText = ''
      } else if (typeof body === 'string') {
        this._bodyText = body
      } else if (support.blob && Blob.prototype.isPrototypeOf(body)) {
        this._bodyBlob = body
      } else if (support.formData && FormData.prototype.isPrototypeOf(body)) {
        this._bodyFormData = body
      } else if (support.searchParams && URLSearchParams.prototype.isPrototypeOf(body)) {
        this._bodyText = body.toString()
      } else if (support.arrayBuffer && support.blob && isDataView(body)) {
        this._bodyArrayBuffer = bufferClone(body.buffer)
        // IE 10-11 can't handle a DataView body.
        this._bodyInit = new Blob([this._bodyArrayBuffer])
      } else if (support.arrayBuffer && (ArrayBuffer.prototype.isPrototypeOf(body) || isArrayBufferView(body))) {
        this._bodyArrayBuffer = bufferClone(body)
      } else {
        throw new Error('unsupported BodyInit type')
      }

      if (!this.headers.get('content-type')) {
        if (typeof body === 'string') {
          this.headers.set('content-type', 'text/plain;charset=UTF-8')
        } else if (this._bodyBlob && this._bodyBlob.type) {
          this.headers.set('content-type', this._bodyBlob.type)
        } else if (support.searchParams && URLSearchParams.prototype.isPrototypeOf(body)) {
          this.headers.set('content-type', 'application/x-www-form-urlencoded;charset=UTF-8')
        }
      }
    }

    if (support.blob) {
      this.blob = function() {
        var rejected = consumed(this)
        if (rejected) {
          return rejected
        }

        if (this._bodyBlob) {
          return Promise.resolve(this._bodyBlob)
        } else if (this._bodyArrayBuffer) {
          return Promise.resolve(new Blob([this._bodyArrayBuffer]))
        } else if (this._bodyFormData) {
          throw new Error('could not read FormData body as blob')
        } else {
          return Promise.resolve(new Blob([this._bodyText]))
        }
      }

      this.arrayBuffer = function() {
        if (this._bodyArrayBuffer) {
          return consumed(this) || Promise.resolve(this._bodyArrayBuffer)
        } else {
          return this.blob().then(readBlobAsArrayBuffer)
        }
      }
    }

    this.text = function() {
      var rejected = consumed(this)
      if (rejected) {
        return rejected
      }

      if (this._bodyBlob) {
        return readBlobAsText(this._bodyBlob)
      } else if (this._bodyArrayBuffer) {
        return Promise.resolve(readArrayBufferAsText(this._bodyArrayBuffer))
      } else if (this._bodyFormData) {
        throw new Error('could not read FormData body as text')
      } else {
        return Promise.resolve(this._bodyText)
      }
    }

    if (support.formData) {
      this.formData = function() {
        return this.text().then(decode)
      }
    }

    this.json = function() {
      return this.text().then(JSON.parse)
    }

    return this
  }

  // HTTP methods whose capitalization should be normalized
  var methods = ['DELETE', 'GET', 'HEAD', 'OPTIONS', 'POST', 'PUT']

  function normalizeMethod(method) {
    var upcased = method.toUpperCase()
    return (methods.indexOf(upcased) > -1) ? upcased : method
  }

  function Request(input, options) {
    options = options || {}
    var body = options.body

    if (input instanceof Request) {
      if (input.bodyUsed) {
        throw new TypeError('Already read')
      }
      this.url = input.url
      this.credentials = input.credentials
      if (!options.headers) {
        this.headers = new Headers(input.headers)
      }
      this.method = input.method
      this.mode = input.mode
      if (!body && input._bodyInit != null) {
        body = input._bodyInit
        input.bodyUsed = true
      }
    } else {
      this.url = String(input)
    }

    this.credentials = options.credentials || this.credentials || 'omit'
    if (options.headers || !this.headers) {
      this.headers = new Headers(options.headers)
    }
    this.method = normalizeMethod(options.method || this.method || 'GET')
    this.mode = options.mode || this.mode || null
    this.referrer = null

    if ((this.method === 'GET' || this.method === 'HEAD') && body) {
      throw new TypeError('Body not allowed for GET or HEAD requests')
    }
    this._initBody(body)
  }

  Request.prototype.clone = function() {
    return new Request(this, { body: this._bodyInit })
  }

  function decode(body) {
    var form = new FormData()
    body.trim().split('&').forEach(function(bytes) {
      if (bytes) {
        var split = bytes.split('=')
        var name = split.shift().replace(/\+/g, ' ')
        var value = split.join('=').replace(/\+/g, ' ')
        form.append(decodeURIComponent(name), decodeURIComponent(value))
      }
    })
    return form
  }

  function parseHeaders(rawHeaders) {
    var headers = new Headers()
    rawHeaders.split(/\r?\n/).forEach(function(line) {
      var parts = line.split(':')
      var key = parts.shift().trim()
      if (key) {
        var value = parts.join(':').trim()
        headers.append(key, value)
      }
    })
    return headers
  }

  Body.call(Request.prototype)

  function Response(bodyInit, options) {
    if (!options) {
      options = {}
    }

    this.type = 'default'
    this.status = 'status' in options ? options.status : 200
    this.ok = this.status >= 200 && this.status < 300
    this.statusText = 'statusText' in options ? options.statusText : 'OK'
    this.headers = new Headers(options.headers)
    this.url = options.url || ''
    this._initBody(bodyInit)
  }

  Body.call(Response.prototype)

  Response.prototype.clone = function() {
    return new Response(this._bodyInit, {
      status: this.status,
      statusText: this.statusText,
      headers: new Headers(this.headers),
      url: this.url
    })
  }

  Response.error = function() {
    var response = new Response(null, {status: 0, statusText: ''})
    response.type = 'error'
    return response
  }

  var redirectStatuses = [301, 302, 303, 307, 308]

  Response.redirect = function(url, status) {
    if (redirectStatuses.indexOf(status) === -1) {
      throw new RangeError('Invalid status code')
    }

    return new Response(null, {status: status, headers: {location: url}})
  }

  self.Headers = Headers
  self.Request = Request
  self.Response = Response

  self.fetch = function(input, init) {
    return new Promise(function(resolve, reject) {
      var request = new Request(input, init)
      var xhr = new XMLHttpRequest()

      xhr.onload = function() {
        var options = {
          status: xhr.status,
          statusText: xhr.statusText,
          headers: parseHeaders(xhr.getAllResponseHeaders() || '')
        }
        options.url = 'responseURL' in xhr ? xhr.responseURL : options.headers.get('X-Request-URL')
        var body = 'response' in xhr ? xhr.response : xhr.responseText
        resolve(new Response(body, options))
      }

      xhr.onerror = function() {
        reject(new TypeError('Network request failed'))
      }

      xhr.ontimeout = function() {
        reject(new TypeError('Network request failed'))
      }

      xhr.open(request.method, request.url, true)

      if (request.credentials === 'include') {
        xhr.withCredentials = true
      }

      if ('responseType' in xhr && support.blob) {
        xhr.responseType = 'blob'
      }

      request.headers.forEach(function(value, name) {
        xhr.setRequestHeader(name, value)
      })

      xhr.send(typeof request._bodyInit === 'undefined' ? null : request._bodyInit)
    })
  }
  self.fetch.polyfill = true
})(typeof self !== 'undefined' ? self : this);

},{}],7:[function(require,module,exports){
'use strict';var _extends=Object.assign||function(a){for(var b,c=1;c<arguments.length;c++)for(var d in b=arguments[c],b)Object.prototype.hasOwnProperty.call(b,d)&&(a[d]=b[d]);return a},_createClass=function(){function a(a,b){for(var c,d=0;d<b.length;d++)c=b[d],c.enumerable=c.enumerable||!1,c.configurable=!0,'value'in c&&(c.writable=!0),Object.defineProperty(a,c.key,c)}return function(b,c,d){return c&&a(b.prototype,c),d&&a(b,d),b}}();function _asyncToGenerator(a){return function(){var b=a.apply(this,arguments);return new Promise(function(a,c){function d(e,f){try{var g=b[e](f),h=g.value}catch(a){return void c(a)}return g.done?void a(h):Promise.resolve(h).then(function(a){d('next',a)},function(a){d('throw',a)})}return d('next')})}}function _toConsumableArray(a){if(Array.isArray(a)){for(var b=0,c=Array(a.length);b<a.length;b++)c[b]=a[b];return c}return Array.from(a)}function _classCallCheck(a,b){if(!(a instanceof b))throw new TypeError('Cannot call a class as a function')}var utils=require('./utils'),defaults=require('./defaults'),itemToCSLJSON=require('../zotero-shim/item-to-csl-json'),dateToSql=require('../zotero-shim/date-to-sql'),COMPLETE='COMPLETE',MULTIPLE_ITEMS='MULTIPLE_ITEMS',FAILED='FAILED',ZoteroBib=function(){function a(b){if(_classCallCheck(this,a),this.opts=_extends({sessionid:utils.uuid4()},defaults(),b),this.opts.persist&&this.opts.storage){if(!('getItem'in this.opts.storage||'setItem'in this.opts.storage||'clear'in this.opts.storage))throw new Error('Invalid storage engine provided');this.opts.override&&this.clearItems(),this.items=[].concat(_toConsumableArray(this.opts.initialItems),_toConsumableArray(this.getItemsStorage())),this.setItemsStorage(this.items)}else this.items=[].concat(_toConsumableArray(this.opts.initialItems))}return _createClass(a,[{key:'getItemsStorage',value:function getItemsStorage(){var a=this.opts.storage.getItem(this.opts.storagePrefix+'-items');return a?JSON.parse(a):[]}},{key:'setItemsStorage',value:function setItemsStorage(a){this.opts.storage.setItem(this.opts.storagePrefix+'-items',JSON.stringify(a))}},{key:'addItem',value:function addItem(a){this.items.push(a),this.opts.persist&&this.setItemsStorage(this.items)}},{key:'updateItem',value:function updateItem(a,b){this.items[a]=b,this.opts.persist&&this.setItemsStorage(this.items)}},{key:'removeItem',value:function removeItem(a){var b=this.items.indexOf(a);return-1!==b&&(this.items.splice(b,1),this.opts.persist&&this.setItemsStorage(this.items),a)}},{key:'clearItems',value:function clearItems(){this.items=[],this.opts.persist&&this.setItemsStorage(this.items)}},{key:'exportItems',value:function(){var a=_asyncToGenerator(regeneratorRuntime.mark(function a(b){var c,d,e;return regeneratorRuntime.wrap(function(a){for(;;)switch(a.prev=a.next){case 0:return c=this.opts.translationServerUrl+'/'+this.opts.translationServerPrefix+'export?format='+b,d=_extends({method:'POST',headers:{"Content-Type":'application/json'},body:JSON.stringify(this.items.filter(function(a){return'key'in a}))},this.opts.init),a.next=4,fetch(c,d);case 4:if(e=a.sent,!e.ok){a.next=11;break}return a.next=8,e.text();case 8:return a.abrupt('return',a.sent);case 11:throw new Error('Failed to export items');case 12:case'end':return a.stop();}},a,this)}));return function exportItems(){return a.apply(this,arguments)}}()},{key:'translateIdentifier',value:function(){var a=_asyncToGenerator(regeneratorRuntime.mark(function a(b){for(var c=arguments.length,d=Array(1<c?c-1:0),e=1;e<c;e++)d[e-1]=arguments[e];var f,g;return regeneratorRuntime.wrap(function(a){for(;;)switch(a.prev=a.next){case 0:return f=this.opts.translationServerUrl+'/'+this.opts.translationServerPrefix+'search',g=_extends({method:'POST',headers:{"Content-Type":'text/plain'},body:b},this.opts.init),a.next=4,this.translate.apply(this,[f,g].concat(d));case 4:return a.abrupt('return',a.sent);case 5:case'end':return a.stop();}},a,this)}));return function translateIdentifier(){return a.apply(this,arguments)}}()},{key:'translateUrlItems',value:function(){var a=_asyncToGenerator(regeneratorRuntime.mark(function a(b,c){for(var d=arguments.length,e=Array(2<d?d-2:0),f=2;f<d;f++)e[f-2]=arguments[f];var g,h,i,j;return regeneratorRuntime.wrap(function(a){for(;;)switch(a.prev=a.next){case 0:return g=this.opts.translationServerUrl+'/'+this.opts.translationServerPrefix+'web',h=this.opts.sessionid,i=_extends({url:b,items:c,sessionid:h},this.opts.request),j=_extends({method:'POST',headers:{"Content-Type":'application/json'},body:JSON.stringify(i)},this.opts.init),a.next=6,this.translate.apply(this,[g,j].concat(e));case 6:return a.abrupt('return',a.sent);case 7:case'end':return a.stop();}},a,this)}));return function translateUrlItems(){return a.apply(this,arguments)}}()},{key:'translateUrl',value:function(){var a=_asyncToGenerator(regeneratorRuntime.mark(function a(b){for(var c=arguments.length,d=Array(1<c?c-1:0),e=1;e<c;e++)d[e-1]=arguments[e];var f,g,h,i;return regeneratorRuntime.wrap(function(a){for(;;)switch(a.prev=a.next){case 0:return f=this.opts.translationServerUrl+'/'+this.opts.translationServerPrefix+'web',g=this.opts.sessionid,h=_extends({url:b,sessionid:g},this.opts.request),i=_extends({method:'POST',headers:{"Content-Type":'application/json'},body:JSON.stringify(h)},this.opts.init),a.next=6,this.translate.apply(this,[f,i].concat(d));case 6:return a.abrupt('return',a.sent);case 7:case'end':return a.stop();}},a,this)}));return function translateUrl(){return a.apply(this,arguments)}}()},{key:'translate',value:function(){var a=_asyncToGenerator(regeneratorRuntime.mark(function a(b,c){var d,e,f,g=this,h=2<arguments.length&&void 0!==arguments[2]?arguments[2]:!0;return regeneratorRuntime.wrap(function(a){for(;;)switch(a.prev=a.next){case 0:return a.next=2,fetch(b,c);case 2:if(d=a.sent,!d.ok){a.next=11;break}return a.next=6,d.json();case 6:e=a.sent,Array.isArray(e)&&e.forEach(function(a){if('CURRENT_TIMESTAMP'===a.accessDate){var b=new Date(Date.now());a.accessDate=dateToSql(b,!0)}h&&g.addItem(a)}),f=Array.isArray(e)?COMPLETE:FAILED,a.next=19;break;case 11:if(300!==d.status){a.next=18;break}return a.next=14,d.json();case 14:e=a.sent,f=MULTIPLE_ITEMS,a.next=19;break;case 18:f=FAILED;case 19:return a.abrupt('return',{result:f,items:e,response:d});case 20:case'end':return a.stop();}},a,this)}));return function translate(){return a.apply(this,arguments)}}()},{key:'itemsCSL',get:function get(){return this.items.map(function(a){return itemToCSLJSON(a)})}},{key:'itemsRaw',get:function get(){return this.items}}],[{key:'COMPLETE',get:function get(){return COMPLETE}},{key:'MULTIPLE_ITEMS',get:function get(){return MULTIPLE_ITEMS}},{key:'FAILED',get:function get(){return FAILED}}]),a}();module.exports=ZoteroBib;

},{"../zotero-shim/date-to-sql":13,"../zotero-shim/item-to-csl-json":16,"./defaults":8,"./utils":9}],8:[function(require,module,exports){
'use strict';module.exports=function(){return{translationServerUrl:'undefined'!=typeof window&&window.location.origin||'',translationServerPrefix:'',fetchConfig:{},initialItems:[],request:{},storage:'undefined'!=typeof window&&'localStorage'in window&&window.localStorage||{},persist:!0,override:!1,storagePrefix:'zotero-bib'}};

},{}],9:[function(require,module,exports){
'use strict';module.exports={uuid4:function uuid4(){return'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,function(a){var b=0|16*Math.random(),c='x'==a?b:8|3&b;return c.toString(16)})}};

},{}],10:[function(require,module,exports){
'use strict';require('es6-promise/auto'),require('isomorphic-fetch'),require('babel-regenerator-runtime');var ZoteroBib=require('./bib/bib');module.exports=ZoteroBib;

},{"./bib/bib":7,"babel-regenerator-runtime":1,"es6-promise/auto":2,"isomorphic-fetch":4}],11:[function(require,module,exports){
'use strict';var creatorTypes={1:'author',2:'contributor',3:'editor',4:'translator',5:'seriesEditor',6:'interviewee',7:'interviewer',8:'director',9:'scriptwriter',10:'producer',11:'castMember',12:'sponsor',13:'counsel',14:'inventor',15:'attorneyAgent',16:'recipient',17:'performer',18:'composer',19:'wordsBy',20:'cartographer',21:'programmer',22:'artist',23:'commenter',24:'presenter',25:'guest',26:'podcaster',27:'reviewedAuthor',28:'cosponsor',29:'bookAuthor'};Object.keys(creatorTypes).map(function(a){return creatorTypes[creatorTypes[a]]=a}),module.exports=creatorTypes;

},{}],12:[function(require,module,exports){
'use strict';module.exports={CSL_NAMES_MAPPINGS:{author:'author',editor:'editor',bookAuthor:'container-author',composer:'composer',director:'director',interviewer:'interviewer',recipient:'recipient',reviewedAuthor:'reviewed-author',seriesEditor:'collection-editor',translator:'translator'},CSL_TEXT_MAPPINGS:{title:['title'],"container-title":['publicationTitle','reporter','code'],"collection-title":['seriesTitle','series'],"collection-number":['seriesNumber'],publisher:['publisher','distributor'],"publisher-place":['place'],authority:['court','legislativeBody','issuingAuthority'],page:['pages'],volume:['volume','codeNumber'],issue:['issue','priorityNumbers'],"number-of-volumes":['numberOfVolumes'],"number-of-pages":['numPages'],edition:['edition'],version:['versionNumber'],section:['section','committee'],genre:['type','programmingLanguage'],source:['libraryCatalog'],dimensions:['artworkSize','runningTime'],medium:['medium','system'],scale:['scale'],archive:['archive'],archive_location:['archiveLocation'],event:['meetingName','conferenceName'],"event-place":['place'],abstract:['abstractNote'],URL:['url'],DOI:['DOI'],ISBN:['ISBN'],ISSN:['ISSN'],"call-number":['callNumber','applicationNumber'],note:['extra'],number:['number'],"chapter-number":['session'],references:['history','references'],shortTitle:['shortTitle'],journalAbbreviation:['journalAbbreviation'],status:['legalStatus'],language:['language']},CSL_DATE_MAPPINGS:{issued:'date',accessed:'accessDate',submitted:'filingDate'},CSL_TYPE_MAPPINGS:{book:'book',bookSection:'chapter',journalArticle:'article-journal',magazineArticle:'article-magazine',newspaperArticle:'article-newspaper',thesis:'thesis',encyclopediaArticle:'entry-encyclopedia',dictionaryEntry:'entry-dictionary',conferencePaper:'paper-conference',letter:'personal_communication',manuscript:'manuscript',interview:'interview',film:'motion_picture',artwork:'graphic',webpage:'webpage',report:'report',bill:'bill',case:'legal_case',hearing:'bill',patent:'patent',statute:'legislation',email:'personal_communication',map:'map',blogPost:'post-weblog',instantMessage:'personal_communication',forumPost:'post',audioRecording:'song',presentation:'speech',videoRecording:'motion_picture',tvBroadcast:'broadcast',radioBroadcast:'broadcast',podcast:'song',computerProgram:'book',document:'article',note:'article',attachment:'article'}};

},{}],13:[function(require,module,exports){
'use strict';var lpad=require('./lpad');module.exports=function(a,b){var c,d,e,f,g,h;try{return b?(c=a.getUTCFullYear(),d=a.getUTCMonth(),e=a.getUTCDate(),f=a.getUTCHours(),g=a.getUTCMinutes(),h=a.getUTCSeconds()):(c=a.getFullYear(),d=a.getMonth(),e=a.getDate(),f=a.getHours(),g=a.getMinutes(),h=a.getSeconds()),c=lpad(c,'0',4),d=lpad(d+1,'0',2),e=lpad(e,'0',2),f=lpad(f,'0',2),g=lpad(g,'0',2),h=lpad(h,'0',2),c+'-'+d+'-'+e+' '+f+':'+g+':'+h}catch(a){return''}};

},{"./lpad":18}],14:[function(require,module,exports){
'use strict';var _module$exports;function _defineProperty(a,b,c){return b in a?Object.defineProperty(a,b,{value:c,enumerable:!0,configurable:!0,writable:!0}):a[b]=c,a}var itemTypes=require('./item-types'),creatorTypes=require('./creator-types');module.exports=(_module$exports={},_defineProperty(_module$exports,itemTypes[2],creatorTypes[1]),_defineProperty(_module$exports,itemTypes[3],creatorTypes[1]),_defineProperty(_module$exports,itemTypes[4],creatorTypes[1]),_defineProperty(_module$exports,itemTypes[5],creatorTypes[1]),_defineProperty(_module$exports,itemTypes[6],creatorTypes[1]),_defineProperty(_module$exports,itemTypes[7],creatorTypes[1]),_defineProperty(_module$exports,itemTypes[8],creatorTypes[1]),_defineProperty(_module$exports,itemTypes[9],creatorTypes[1]),_defineProperty(_module$exports,itemTypes[10],creatorTypes[6]),_defineProperty(_module$exports,itemTypes[11],creatorTypes[8]),_defineProperty(_module$exports,itemTypes[12],creatorTypes[22]),_defineProperty(_module$exports,itemTypes[13],creatorTypes[1]),_defineProperty(_module$exports,itemTypes[15],creatorTypes[1]),_defineProperty(_module$exports,itemTypes[16],creatorTypes[12]),_defineProperty(_module$exports,itemTypes[17],creatorTypes[1]),_defineProperty(_module$exports,itemTypes[18],creatorTypes[2]),_defineProperty(_module$exports,itemTypes[19],creatorTypes[14]),_defineProperty(_module$exports,itemTypes[20],creatorTypes[1]),_defineProperty(_module$exports,itemTypes[21],creatorTypes[1]),_defineProperty(_module$exports,itemTypes[22],creatorTypes[20]),_defineProperty(_module$exports,itemTypes[23],creatorTypes[1]),_defineProperty(_module$exports,itemTypes[24],creatorTypes[1]),_defineProperty(_module$exports,itemTypes[25],creatorTypes[1]),_defineProperty(_module$exports,itemTypes[26],creatorTypes[17]),_defineProperty(_module$exports,itemTypes[27],creatorTypes[24]),_defineProperty(_module$exports,itemTypes[28],creatorTypes[8]),_defineProperty(_module$exports,itemTypes[29],creatorTypes[8]),_defineProperty(_module$exports,itemTypes[30],creatorTypes[8]),_defineProperty(_module$exports,itemTypes[31],creatorTypes[26]),_defineProperty(_module$exports,itemTypes[32],creatorTypes[21]),_defineProperty(_module$exports,itemTypes[33],creatorTypes[1]),_defineProperty(_module$exports,itemTypes[34],creatorTypes[1]),_defineProperty(_module$exports,itemTypes[35],creatorTypes[1]),_defineProperty(_module$exports,itemTypes[36],creatorTypes[1]),_module$exports);

},{"./creator-types":11,"./item-types":17}],15:[function(require,module,exports){
'use strict';var fields={1:'url',2:'rights',3:'series',4:'volume',5:'issue',6:'edition',7:'place',8:'publisher',10:'pages',11:'ISBN',12:'publicationTitle',13:'ISSN',14:'date',15:'section',18:'callNumber',19:'archiveLocation',21:'distributor',22:'extra',25:'journalAbbreviation',26:'DOI',27:'accessDate',28:'seriesTitle',29:'seriesText',30:'seriesNumber',31:'institution',32:'reportType',36:'code',40:'session',41:'legislativeBody',42:'history',43:'reporter',44:'court',45:'numberOfVolumes',46:'committee',48:'assignee',50:'patentNumber',51:'priorityNumbers',52:'issueDate',53:'references',54:'legalStatus',55:'codeNumber',59:'artworkMedium',60:'number',61:'artworkSize',62:'libraryCatalog',63:'videoRecordingFormat',64:'interviewMedium',65:'letterType',66:'manuscriptType',67:'mapType',68:'scale',69:'thesisType',70:'websiteType',71:'audioRecordingFormat',72:'label',74:'presentationType',75:'meetingName',76:'studio',77:'runningTime',78:'network',79:'postType',80:'audioFileType',81:'versionNumber',82:'system',83:'company',84:'conferenceName',85:'encyclopediaTitle',86:'dictionaryTitle',87:'language',88:'programmingLanguage',89:'university',90:'abstractNote',91:'websiteTitle',92:'reportNumber',93:'billNumber',94:'codeVolume',95:'codePages',96:'dateDecided',97:'reporterVolume',98:'firstPage',99:'documentNumber',100:'dateEnacted',101:'publicLawNumber',102:'country',103:'applicationNumber',104:'forumTitle',105:'episodeNumber',107:'blogTitle',108:'type',109:'medium',110:'title',111:'caseName',112:'nameOfAct',113:'subject',114:'proceedingsTitle',115:'bookTitle',116:'shortTitle',117:'docketNumber',118:'numPages',119:'programTitle',120:'issuingAuthority',121:'filingDate',122:'genre',123:'archive'};Object.keys(fields).map(function(a){return fields[fields[a]]=a}),module.exports=fields;

},{}],16:[function(require,module,exports){
'use strict';var _require=require('./csl-mappings'),CSL_NAMES_MAPPINGS=_require.CSL_NAMES_MAPPINGS,CSL_TEXT_MAPPINGS=_require.CSL_TEXT_MAPPINGS,CSL_DATE_MAPPINGS=_require.CSL_DATE_MAPPINGS,CSL_TYPE_MAPPINGS=_require.CSL_TYPE_MAPPINGS,_require2=require('./type-specific-field-map'),getFieldIDFromTypeAndBase=_require2.getFieldIDFromTypeAndBase,fields=require('./fields'),itemTypes=require('./item-types'),strToDate=require('./str-to-date'),defaultItemTypeCreatorTypeLookup=require('./default-item-type-creator-type-lookup');module.exports=function(a){var b=CSL_TYPE_MAPPINGS[a.itemType];if(!b)throw new Error('Unexpected Zotero Item type "'+a.itemType+'"');var c=itemTypes[a.itemType],d={id:a.key,type:b};for(var f in CSL_TEXT_MAPPINGS)for(var g=CSL_TEXT_MAPPINGS[f],h=0,i=g.length;h<i;h++){var j=g[h],k=null;if(j in a&&(k=a[j]),k&&'string'==typeof k){if('ISBN'==j){var e=k.match(/^(?:97[89]-?)?(?:\d-?){9}[\dx](?!-)\b/i);e&&(k=e[0])}'"'==k.charAt(0)&&k.indexOf('"',1)==k.length-1&&(k=k.substring(1,k.length-1)),d[f]=k;break}}if('attachment'!=a.type&&'note'!=a.type)for(var l=defaultItemTypeCreatorTypeLookup[c],m=a.creators,n=0;m&&n<m.length;n++){var o=m[n],p=o.creatorType,q=void 0;(p==l&&(p='author'),p=CSL_NAMES_MAPPINGS[p],!!p)&&('lastName'in o||'firstName'in o?(q={family:o.lastName||'',given:o.firstName||''},q.family&&q.given&&(1<q.family.length&&'"'==q.family.charAt(0)&&'"'==q.family.charAt(q.family.length-1)?q.family=q.family.substr(1,q.family.length-2):CSL.parseParticles(q,!0))):'name'in o&&(q={literal:o.name}),d[p]?d[p].push(q):d[p]=[q])}for(var r in CSL_DATE_MAPPINGS){var s=a[CSL_DATE_MAPPINGS[r]];if(!s){var t=getFieldIDFromTypeAndBase(c,CSL_DATE_MAPPINGS[r]);t&&(s=a[fields[t]])}if(s){var u=strToDate(s),v=[];u.year?(v.push(u.year),void 0!==u.month&&(v.push(u.month+1),u.day&&v.push(u.day)),d[r]={"date-parts":[v]},u.part&&void 0===u.month&&(d[r].season=u.part)):d[r]={literal:s}}}return d};

},{"./csl-mappings":12,"./default-item-type-creator-type-lookup":14,"./fields":15,"./item-types":17,"./str-to-date":19,"./type-specific-field-map":20}],17:[function(require,module,exports){
'use strict';var itemTypes={1:'note',2:'book',3:'bookSection',4:'journalArticle',5:'magazineArticle',6:'newspaperArticle',7:'thesis',8:'letter',9:'manuscript',10:'interview',11:'film',12:'artwork',13:'webpage',14:'attachment',15:'report',16:'bill',17:'case',18:'hearing',19:'patent',20:'statute',21:'email',22:'map',23:'blogPost',24:'instantMessage',25:'forumPost',26:'audioRecording',27:'presentation',28:'videoRecording',29:'tvBroadcast',30:'radioBroadcast',31:'podcast',32:'computerProgram',33:'conferencePaper',34:'document',35:'encyclopediaArticle',36:'dictionaryEntry'};Object.keys(itemTypes).map(function(a){return itemTypes[itemTypes[a]]=a}),module.exports=itemTypes;

},{}],18:[function(require,module,exports){
'use strict';module.exports=function(a,b,c){for(a=a?a+'':'';a.length<c;)a=b+a;return a};

},{}],19:[function(require,module,exports){
'use strict';var dateToSQL=require('./date-to-sql'),months=['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec','january','february','march','april','may','june','july','august','september','october','november','december'],_slashRe=/^(.*?)\b([0-9]{1,4})(?:([\-\/\.\u5e74])([0-9]{1,2}))?(?:([\-\/\.\u6708])([0-9]{1,4}))?((?:\b|[^0-9]).*?)$/,_yearRe=/^(.*?)\b((?:circa |around |about |c\.? ?)?[0-9]{1,4}(?: ?B\.? ?C\.?(?: ?E\.?)?| ?C\.? ?E\.?| ?A\.? ?D\.?)|[0-9]{3,4})\b(.*?)$/i,_monthRe=new RegExp('^(.*)\\b('+months.join('|')+')[^ ]*(?: (.*)$|$)','i'),_dayRe=/\b([0-9]{1,2})(?:st|nd|rd|th)?\b(.*)/i,_insertDateOrderPart=function(a,b,c){if(!a)return b;if(!0===c.before)return b+a;if(!0===c.after)return a+b;if(c.before){var d=a.indexOf(c.before);return-1==d?a:a.replace(new RegExp('('+c.before+')'),b+'$1')}if(c.after){var e=a.indexOf(c.after);return-1==e?a+b:a.replace(new RegExp('('+c.after+')'),'$1'+b)}return a+b};module.exports=function(a){var b={order:''};if(!a)return b;var c=[],d=(a+'').toLowerCase();a='yesterday'==d?dateToSQL(new Date(Date.now()-86400000)).substr(0,10):'today'==d?dateToSQL(new Date).substr(0,10):'tomorrow'==d?dateToSQL(new Date(Date.now()+86400000)).substr(0,10):a.toString().replace(/^\s+|\s+$/g,'').replace(/\s+/,' ');var e=_slashRe.exec(a);if(e&&(!e[5]||!e[3]||e[3]==e[5]||'\u5E74'==e[3]&&'\u6708'==e[5])&&(e[2]&&e[4]&&e[6]||!e[1]&&!e[7])){if(3==e[2].length||4==e[2].length||'\u5E74'==e[3])b.year=e[2],b.month=e[4],b.day=e[6],b.order+=e[2]?'y':'',b.order+=e[4]?'m':'',b.order+=e[6]?'d':'';else if(e[2]&&!e[4]&&e[6])b.month=e[2],b.year=e[6],b.order+=e[2]?'m':'',b.order+=e[6]?'y':'';else{var f=window.navigator.language?window.navigator.language.substr(3):'US';'US'==f||'FM'==f||'PW'==f||'PH'==f?(b.month=e[2],b.day=e[4],b.order+=e[2]?'m':'',b.order+=e[4]?'d':''):(b.month=e[4],b.day=e[2],b.order+=e[2]?'d':'',b.order+=e[4]?'m':''),b.year=e[6],b.order+='y'}if(b.year&&(b.year=parseInt(b.year,10)),b.day&&(b.day=parseInt(b.day,10)),b.month&&(b.month=parseInt(b.month,10),12<b.month)){var g=b.day;b.day=b.month,b.month=g,b.order=b.order.replace('m','D').replace('d','M').replace('D','d').replace('M','m')}if((!b.month||12>=b.month)&&(!b.day||31>=b.day)){if(b.year&&100>b.year){var h=new Date,j=h.getFullYear(),k=j%100,l=j-k;b.year=b.year<=k?l+b.year:l-100+b.year}b.month?b.month--:delete b.month,c.push({part:e[1],before:!0},{part:e[7]})}else{var b={order:''};c.push({part:a})}}else c.push({part:a});if(!b.year)for(var i in c){var p=_yearRe.exec(c[i].part);if(p){b.year=p[2],b.order=_insertDateOrderPart(b.order,'y',c[i]),c.splice(i,1,{part:p[1],before:!0},{part:p[3]});break}}if(void 0===b.month)for(var q in c){var r=_monthRe.exec(c[q].part);if(r){b.month=months.indexOf(r[2].toLowerCase())%12,b.order=_insertDateOrderPart(b.order,'m',c[q]),c.splice(q,1,{part:r[1],before:'m'},{part:r[3],after:'m'});break}}if(!b.day)for(var s in c){var t=_dayRe.exec(c[s].part);if(t){var m,n=parseInt(t[1],10);if(31>=n){b.day=n,b.order=_insertDateOrderPart(b.order,'d',c[s]),0<t.index?(m=c[s].part.substr(0,t.index),t[2]&&(m+=' '+t[2])):m=t[2],c.splice(s,1,{part:m});break}}}for(var o in b.part='',c)b.part+=c[o].part+' ';return b.part&&(b.part=b.part.replace(/^[^A-Za-z0-9]+|[^A-Za-z0-9]+$/g,'')),(''===b.part||void 0==b.part)&&delete b.part,(b.year||0===b.year)&&(b.year+=''),b};

},{"./date-to-sql":13}],20:[function(require,module,exports){
'use strict';var _typeSpecificFieldMap;function _defineProperty(a,b,c){return b in a?Object.defineProperty(a,b,{value:c,enumerable:!0,configurable:!0,writable:!0}):a[b]=c,a}var fields=require('./fields'),itemTypes=require('./item-types'),typeSpecificFieldMap=(_typeSpecificFieldMap={},_defineProperty(_typeSpecificFieldMap,4100,94),_defineProperty(_typeSpecificFieldMap,4356,97),_defineProperty(_typeSpecificFieldMap,1800,89),_defineProperty(_typeSpecificFieldMap,2824,21),_defineProperty(_typeSpecificFieldMap,3848,31),_defineProperty(_typeSpecificFieldMap,6664,72),_defineProperty(_typeSpecificFieldMap,7176,76),_defineProperty(_typeSpecificFieldMap,7432,78),_defineProperty(_typeSpecificFieldMap,7688,78),_defineProperty(_typeSpecificFieldMap,8200,83),_defineProperty(_typeSpecificFieldMap,4106,95),_defineProperty(_typeSpecificFieldMap,4362,98),_defineProperty(_typeSpecificFieldMap,780,115),_defineProperty(_typeSpecificFieldMap,8460,114),_defineProperty(_typeSpecificFieldMap,3340,91),_defineProperty(_typeSpecificFieldMap,5900,107),_defineProperty(_typeSpecificFieldMap,6412,104),_defineProperty(_typeSpecificFieldMap,7436,119),_defineProperty(_typeSpecificFieldMap,7692,119),_defineProperty(_typeSpecificFieldMap,8972,85),_defineProperty(_typeSpecificFieldMap,9228,86),_defineProperty(_typeSpecificFieldMap,4366,96),_defineProperty(_typeSpecificFieldMap,4878,52),_defineProperty(_typeSpecificFieldMap,5134,100),_defineProperty(_typeSpecificFieldMap,3900,92),_defineProperty(_typeSpecificFieldMap,4156,93),_defineProperty(_typeSpecificFieldMap,4412,117),_defineProperty(_typeSpecificFieldMap,4668,99),_defineProperty(_typeSpecificFieldMap,4924,50),_defineProperty(_typeSpecificFieldMap,5180,101),_defineProperty(_typeSpecificFieldMap,7484,105),_defineProperty(_typeSpecificFieldMap,7740,105),_defineProperty(_typeSpecificFieldMap,7996,105),_defineProperty(_typeSpecificFieldMap,1900,69),_defineProperty(_typeSpecificFieldMap,2156,65),_defineProperty(_typeSpecificFieldMap,2412,66),_defineProperty(_typeSpecificFieldMap,2924,122),_defineProperty(_typeSpecificFieldMap,3436,70),_defineProperty(_typeSpecificFieldMap,3948,32),_defineProperty(_typeSpecificFieldMap,5740,67),_defineProperty(_typeSpecificFieldMap,5996,70),_defineProperty(_typeSpecificFieldMap,6508,79),_defineProperty(_typeSpecificFieldMap,7020,74),_defineProperty(_typeSpecificFieldMap,2669,64),_defineProperty(_typeSpecificFieldMap,2925,63),_defineProperty(_typeSpecificFieldMap,3181,59),_defineProperty(_typeSpecificFieldMap,6765,71),_defineProperty(_typeSpecificFieldMap,7277,63),_defineProperty(_typeSpecificFieldMap,7533,63),_defineProperty(_typeSpecificFieldMap,7789,71),_defineProperty(_typeSpecificFieldMap,8045,80),_defineProperty(_typeSpecificFieldMap,4462,111),_defineProperty(_typeSpecificFieldMap,5230,112),_defineProperty(_typeSpecificFieldMap,5486,113),_typeSpecificFieldMap);module.exports={map:typeSpecificFieldMap,getFieldIDFromTypeAndBase:function getFieldIDFromTypeAndBase(a,b){return a='number'==typeof a?a:itemTypes[a],b='number'==typeof b?b:fields[b],typeSpecificFieldMap[(a<<8)+b]}};

},{"./fields":15,"./item-types":17}]},{},[10])(10)
});
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJub2RlX21vZHVsZXMvYmFiZWwtcmVnZW5lcmF0b3ItcnVudGltZS9ydW50aW1lLmpzIiwibm9kZV9tb2R1bGVzL2VzNi1wcm9taXNlL2F1dG8uanMiLCJub2RlX21vZHVsZXMvZXM2LXByb21pc2UvZGlzdC9lczYtcHJvbWlzZS5qcyIsIm5vZGVfbW9kdWxlcy9pc29tb3JwaGljLWZldGNoL2ZldGNoLW5wbS1icm93c2VyaWZ5LmpzIiwibm9kZV9tb2R1bGVzL3Byb2Nlc3MvYnJvd3Nlci5qcyIsIm5vZGVfbW9kdWxlcy93aGF0d2ctZmV0Y2gvZmV0Y2guanMiLCJzcmMvanMvYmliL2JpYi5qcyIsInNyYy9qcy9iaWIvZGVmYXVsdHMuanMiLCJzcmMvanMvYmliL3V0aWxzLmpzIiwic3JjL2pzL21haW4tY29tcGF0LmpzIiwic3JjL2pzL3pvdGVyby1zaGltL2NyZWF0b3ItdHlwZXMuanMiLCJzcmMvanMvem90ZXJvLXNoaW0vY3NsLW1hcHBpbmdzLmpzIiwic3JjL2pzL3pvdGVyby1zaGltL2RhdGUtdG8tc3FsLmpzIiwic3JjL2pzL3pvdGVyby1zaGltL2RlZmF1bHQtaXRlbS10eXBlLWNyZWF0b3ItdHlwZS1sb29rdXAuanMiLCJzcmMvanMvem90ZXJvLXNoaW0vZmllbGRzLmpzIiwic3JjL2pzL3pvdGVyby1zaGltL2l0ZW0tdG8tY3NsLWpzb24uanMiLCJzcmMvanMvem90ZXJvLXNoaW0vaXRlbS10eXBlcy5qcyIsInNyYy9qcy96b3Rlcm8tc2hpbS9scGFkLmpzIiwic3JjL2pzL3pvdGVyby1zaGltL3N0ci10by1kYXRlLmpzIiwic3JjL2pzL3pvdGVyby1zaGltL3R5cGUtc3BlY2lmaWMtZmllbGQtbWFwLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOztBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7O0FDanBCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7QUNKQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7QUNyb0NBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ05BO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDeExBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtB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RUE3QmIsNkNBOEJhLEdBOUJiLDZDQStCYSxHQS9CYiw2Q0FnQ2EsR0FoQ2IsNkNBaUNhLEdBakNiLDZDQWtDYSxFQWxDYiw2Q0FtQ2EsRUFuQ2IsNkNBb0NhLEVBcENiLDZDQXFDYyxHQXJDZCw2Q0FzQ2MsRUF0Q2QsNkNBdUNjLEVBdkNkLDZDQXdDYyxFQXhDZCw2Q0F5Q2MsRUF6Q2QsNkNBMENjLEVBMUNkLDZDQTJDYyxFQTNDZCw2Q0E0Q2MsRUE1Q2QsNkNBNkNjLEVBN0NkLDZDQThDYyxFQTlDZCw2Q0ErQ2MsRUEvQ2QsNkNBZ0RjLEVBaERkLDZDQWlEYyxFQWpEZCw2Q0FrRGMsRUFsRGQsNkNBbURjLEVBbkRkLDZDQW9EYyxHQXBEZCw2Q0FxRGMsR0FyRGQsNkNBc0RjLEdBdERkLHdCQUhOLENBNERBLE9BQU8sT0FBUCxDQUFpQixDQUNoQixJQUFLLG9CQURXLENBRWhCLDBCQUEyQix1Q0FBcUIsQ0FHL0MsTUFGQSxHQUEyQixRQUFsQixhQUFzQyxZQUUvQyxDQURBLEVBQTZCLFFBQW5CLGFBQXdDLFNBQ2xELENBQU8scUJBQXFCLENBQUMsR0FBVSxDQUFYLEdBQXJCLENBQ1AsQ0FOZSxDIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3ZhciBmPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIik7dGhyb3cgZi5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGZ9dmFyIGw9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGwuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sbCxsLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsIi8qKlxuICogQ29weXJpZ2h0IChjKSAyMDE0LCBGYWNlYm9vaywgSW5jLlxuICogQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqXG4gKiBUaGlzIHNvdXJjZSBjb2RlIGlzIGxpY2Vuc2VkIHVuZGVyIHRoZSBCU0Qtc3R5bGUgbGljZW5zZSBmb3VuZCBpbiB0aGVcbiAqIGh0dHBzOi8vcmF3LmdpdGh1Yi5jb20vZmFjZWJvb2svcmVnZW5lcmF0b3IvbWFzdGVyL0xJQ0VOU0UgZmlsZS4gQW5cbiAqIGFkZGl0aW9uYWwgZ3JhbnQgb2YgcGF0ZW50IHJpZ2h0cyBjYW4gYmUgZm91bmQgaW4gdGhlIFBBVEVOVFMgZmlsZSBpblxuICogdGhlIHNhbWUgZGlyZWN0b3J5LlxuICovXG5cbiEoZnVuY3Rpb24oZ2xvYmFsKSB7XG4gIFwidXNlIHN0cmljdFwiO1xuXG4gIHZhciBoYXNPd24gPSBPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5O1xuICB2YXIgdW5kZWZpbmVkOyAvLyBNb3JlIGNvbXByZXNzaWJsZSB0aGFuIHZvaWQgMC5cbiAgdmFyIGl0ZXJhdG9yU3ltYm9sID1cbiAgICB0eXBlb2YgU3ltYm9sID09PSBcImZ1bmN0aW9uXCIgJiYgU3ltYm9sLml0ZXJhdG9yIHx8IFwiQEBpdGVyYXRvclwiO1xuXG4gIHZhciBpbk1vZHVsZSA9IHR5cGVvZiBtb2R1bGUgPT09IFwib2JqZWN0XCI7XG4gIHZhciBydW50aW1lID0gZ2xvYmFsLnJlZ2VuZXJhdG9yUnVudGltZTtcbiAgaWYgKHJ1bnRpbWUpIHtcbiAgICBpZiAoaW5Nb2R1bGUpIHtcbiAgICAgIC8vIElmIHJlZ2VuZXJhdG9yUnVudGltZSBpcyBkZWZpbmVkIGdsb2JhbGx5IGFuZCB3ZSdyZSBpbiBhIG1vZHVsZSxcbiAgICAgIC8vIG1ha2UgdGhlIGV4cG9ydHMgb2JqZWN0IGlkZW50aWNhbCB0byByZWdlbmVyYXRvclJ1bnRpbWUuXG4gICAgICBtb2R1bGUuZXhwb3J0cyA9IHJ1bnRpbWU7XG4gICAgfVxuICAgIC8vIERvbid0IGJvdGhlciBldmFsdWF0aW5nIHRoZSByZXN0IG9mIHRoaXMgZmlsZSBpZiB0aGUgcnVudGltZSB3YXNcbiAgICAvLyBhbHJlYWR5IGRlZmluZWQgZ2xvYmFsbHkuXG4gICAgcmV0dXJuO1xuICB9XG5cbiAgLy8gRGVmaW5lIHRoZSBydW50aW1lIGdsb2JhbGx5IChhcyBleHBlY3RlZCBieSBnZW5lcmF0ZWQgY29kZSkgYXMgZWl0aGVyXG4gIC8vIG1vZHVsZS5leHBvcnRzIChpZiB3ZSdyZSBpbiBhIG1vZHVsZSkgb3IgYSBuZXcsIGVtcHR5IG9iamVjdC5cbiAgcnVudGltZSA9IGdsb2JhbC5yZWdlbmVyYXRvclJ1bnRpbWUgPSBpbk1vZHVsZSA/IG1vZHVsZS5leHBvcnRzIDoge307XG5cbiAgZnVuY3Rpb24gd3JhcChpbm5lckZuLCBvdXRlckZuLCBzZWxmLCB0cnlMb2NzTGlzdCkge1xuICAgIC8vIElmIG91dGVyRm4gcHJvdmlkZWQsIHRoZW4gb3V0ZXJGbi5wcm90b3R5cGUgaW5zdGFuY2VvZiBHZW5lcmF0b3IuXG4gICAgdmFyIGdlbmVyYXRvciA9IE9iamVjdC5jcmVhdGUoKG91dGVyRm4gfHwgR2VuZXJhdG9yKS5wcm90b3R5cGUpO1xuICAgIHZhciBjb250ZXh0ID0gbmV3IENvbnRleHQodHJ5TG9jc0xpc3QgfHwgW10pO1xuXG4gICAgLy8gVGhlIC5faW52b2tlIG1ldGhvZCB1bmlmaWVzIHRoZSBpbXBsZW1lbnRhdGlvbnMgb2YgdGhlIC5uZXh0LFxuICAgIC8vIC50aHJvdywgYW5kIC5yZXR1cm4gbWV0aG9kcy5cbiAgICBnZW5lcmF0b3IuX2ludm9rZSA9IG1ha2VJbnZva2VNZXRob2QoaW5uZXJGbiwgc2VsZiwgY29udGV4dCk7XG5cbiAgICByZXR1cm4gZ2VuZXJhdG9yO1xuICB9XG4gIHJ1bnRpbWUud3JhcCA9IHdyYXA7XG5cbiAgLy8gVHJ5L2NhdGNoIGhlbHBlciB0byBtaW5pbWl6ZSBkZW9wdGltaXphdGlvbnMuIFJldHVybnMgYSBjb21wbGV0aW9uXG4gIC8vIHJlY29yZCBsaWtlIGNvbnRleHQudHJ5RW50cmllc1tpXS5jb21wbGV0aW9uLiBUaGlzIGludGVyZmFjZSBjb3VsZFxuICAvLyBoYXZlIGJlZW4gKGFuZCB3YXMgcHJldmlvdXNseSkgZGVzaWduZWQgdG8gdGFrZSBhIGNsb3N1cmUgdG8gYmVcbiAgLy8gaW52b2tlZCB3aXRob3V0IGFyZ3VtZW50cywgYnV0IGluIGFsbCB0aGUgY2FzZXMgd2UgY2FyZSBhYm91dCB3ZVxuICAvLyBhbHJlYWR5IGhhdmUgYW4gZXhpc3RpbmcgbWV0aG9kIHdlIHdhbnQgdG8gY2FsbCwgc28gdGhlcmUncyBubyBuZWVkXG4gIC8vIHRvIGNyZWF0ZSBhIG5ldyBmdW5jdGlvbiBvYmplY3QuIFdlIGNhbiBldmVuIGdldCBhd2F5IHdpdGggYXNzdW1pbmdcbiAgLy8gdGhlIG1ldGhvZCB0YWtlcyBleGFjdGx5IG9uZSBhcmd1bWVudCwgc2luY2UgdGhhdCBoYXBwZW5zIHRvIGJlIHRydWVcbiAgLy8gaW4gZXZlcnkgY2FzZSwgc28gd2UgZG9uJ3QgaGF2ZSB0byB0b3VjaCB0aGUgYXJndW1lbnRzIG9iamVjdC4gVGhlXG4gIC8vIG9ubHkgYWRkaXRpb25hbCBhbGxvY2F0aW9uIHJlcXVpcmVkIGlzIHRoZSBjb21wbGV0aW9uIHJlY29yZCwgd2hpY2hcbiAgLy8gaGFzIGEgc3RhYmxlIHNoYXBlIGFuZCBzbyBob3BlZnVsbHkgc2hvdWxkIGJlIGNoZWFwIHRvIGFsbG9jYXRlLlxuICBmdW5jdGlvbiB0cnlDYXRjaChmbiwgb2JqLCBhcmcpIHtcbiAgICB0cnkge1xuICAgICAgcmV0dXJuIHsgdHlwZTogXCJub3JtYWxcIiwgYXJnOiBmbi5jYWxsKG9iaiwgYXJnKSB9O1xuICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgcmV0dXJuIHsgdHlwZTogXCJ0aHJvd1wiLCBhcmc6IGVyciB9O1xuICAgIH1cbiAgfVxuXG4gIHZhciBHZW5TdGF0ZVN1c3BlbmRlZFN0YXJ0ID0gXCJzdXNwZW5kZWRTdGFydFwiO1xuICB2YXIgR2VuU3RhdGVTdXNwZW5kZWRZaWVsZCA9IFwic3VzcGVuZGVkWWllbGRcIjtcbiAgdmFyIEdlblN0YXRlRXhlY3V0aW5nID0gXCJleGVjdXRpbmdcIjtcbiAgdmFyIEdlblN0YXRlQ29tcGxldGVkID0gXCJjb21wbGV0ZWRcIjtcblxuICAvLyBSZXR1cm5pbmcgdGhpcyBvYmplY3QgZnJvbSB0aGUgaW5uZXJGbiBoYXMgdGhlIHNhbWUgZWZmZWN0IGFzXG4gIC8vIGJyZWFraW5nIG91dCBvZiB0aGUgZGlzcGF0Y2ggc3dpdGNoIHN0YXRlbWVudC5cbiAgdmFyIENvbnRpbnVlU2VudGluZWwgPSB7fTtcblxuICAvLyBEdW1teSBjb25zdHJ1Y3RvciBmdW5jdGlvbnMgdGhhdCB3ZSB1c2UgYXMgdGhlIC5jb25zdHJ1Y3RvciBhbmRcbiAgLy8gLmNvbnN0cnVjdG9yLnByb3RvdHlwZSBwcm9wZXJ0aWVzIGZvciBmdW5jdGlvbnMgdGhhdCByZXR1cm4gR2VuZXJhdG9yXG4gIC8vIG9iamVjdHMuIEZvciBmdWxsIHNwZWMgY29tcGxpYW5jZSwgeW91IG1heSB3aXNoIHRvIGNvbmZpZ3VyZSB5b3VyXG4gIC8vIG1pbmlmaWVyIG5vdCB0byBtYW5nbGUgdGhlIG5hbWVzIG9mIHRoZXNlIHR3byBmdW5jdGlvbnMuXG4gIGZ1bmN0aW9uIEdlbmVyYXRvcigpIHt9XG4gIGZ1bmN0aW9uIEdlbmVyYXRvckZ1bmN0aW9uKCkge31cbiAgZnVuY3Rpb24gR2VuZXJhdG9yRnVuY3Rpb25Qcm90b3R5cGUoKSB7fVxuXG4gIHZhciBHcCA9IEdlbmVyYXRvckZ1bmN0aW9uUHJvdG90eXBlLnByb3RvdHlwZSA9IEdlbmVyYXRvci5wcm90b3R5cGU7XG4gIEdlbmVyYXRvckZ1bmN0aW9uLnByb3RvdHlwZSA9IEdwLmNvbnN0cnVjdG9yID0gR2VuZXJhdG9yRnVuY3Rpb25Qcm90b3R5cGU7XG4gIEdlbmVyYXRvckZ1bmN0aW9uUHJvdG90eXBlLmNvbnN0cnVjdG9yID0gR2VuZXJhdG9yRnVuY3Rpb247XG4gIEdlbmVyYXRvckZ1bmN0aW9uLmRpc3BsYXlOYW1lID0gXCJHZW5lcmF0b3JGdW5jdGlvblwiO1xuXG4gIC8vIEhlbHBlciBmb3IgZGVmaW5pbmcgdGhlIC5uZXh0LCAudGhyb3csIGFuZCAucmV0dXJuIG1ldGhvZHMgb2YgdGhlXG4gIC8vIEl0ZXJhdG9yIGludGVyZmFjZSBpbiB0ZXJtcyBvZiBhIHNpbmdsZSAuX2ludm9rZSBtZXRob2QuXG4gIGZ1bmN0aW9uIGRlZmluZUl0ZXJhdG9yTWV0aG9kcyhwcm90b3R5cGUpIHtcbiAgICBbXCJuZXh0XCIsIFwidGhyb3dcIiwgXCJyZXR1cm5cIl0uZm9yRWFjaChmdW5jdGlvbihtZXRob2QpIHtcbiAgICAgIHByb3RvdHlwZVttZXRob2RdID0gZnVuY3Rpb24oYXJnKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9pbnZva2UobWV0aG9kLCBhcmcpO1xuICAgICAgfTtcbiAgICB9KTtcbiAgfVxuXG4gIHJ1bnRpbWUuaXNHZW5lcmF0b3JGdW5jdGlvbiA9IGZ1bmN0aW9uKGdlbkZ1bikge1xuICAgIHZhciBjdG9yID0gdHlwZW9mIGdlbkZ1biA9PT0gXCJmdW5jdGlvblwiICYmIGdlbkZ1bi5jb25zdHJ1Y3RvcjtcbiAgICByZXR1cm4gY3RvclxuICAgICAgPyBjdG9yID09PSBHZW5lcmF0b3JGdW5jdGlvbiB8fFxuICAgICAgICAvLyBGb3IgdGhlIG5hdGl2ZSBHZW5lcmF0b3JGdW5jdGlvbiBjb25zdHJ1Y3RvciwgdGhlIGJlc3Qgd2UgY2FuXG4gICAgICAgIC8vIGRvIGlzIHRvIGNoZWNrIGl0cyAubmFtZSBwcm9wZXJ0eS5cbiAgICAgICAgKGN0b3IuZGlzcGxheU5hbWUgfHwgY3Rvci5uYW1lKSA9PT0gXCJHZW5lcmF0b3JGdW5jdGlvblwiXG4gICAgICA6IGZhbHNlO1xuICB9O1xuXG4gIHJ1bnRpbWUubWFyayA9IGZ1bmN0aW9uKGdlbkZ1bikge1xuICAgIGlmIChPYmplY3Quc2V0UHJvdG90eXBlT2YpIHtcbiAgICAgIE9iamVjdC5zZXRQcm90b3R5cGVPZihnZW5GdW4sIEdlbmVyYXRvckZ1bmN0aW9uUHJvdG90eXBlKTtcbiAgICB9IGVsc2Uge1xuICAgICAgZ2VuRnVuLl9fcHJvdG9fXyA9IEdlbmVyYXRvckZ1bmN0aW9uUHJvdG90eXBlO1xuICAgIH1cbiAgICBnZW5GdW4ucHJvdG90eXBlID0gT2JqZWN0LmNyZWF0ZShHcCk7XG4gICAgcmV0dXJuIGdlbkZ1bjtcbiAgfTtcblxuICAvLyBXaXRoaW4gdGhlIGJvZHkgb2YgYW55IGFzeW5jIGZ1bmN0aW9uLCBgYXdhaXQgeGAgaXMgdHJhbnNmb3JtZWQgdG9cbiAgLy8gYHlpZWxkIHJlZ2VuZXJhdG9yUnVudGltZS5hd3JhcCh4KWAsIHNvIHRoYXQgdGhlIHJ1bnRpbWUgY2FuIHRlc3RcbiAgLy8gYHZhbHVlIGluc3RhbmNlb2YgQXdhaXRBcmd1bWVudGAgdG8gZGV0ZXJtaW5lIGlmIHRoZSB5aWVsZGVkIHZhbHVlIGlzXG4gIC8vIG1lYW50IHRvIGJlIGF3YWl0ZWQuIFNvbWUgbWF5IGNvbnNpZGVyIHRoZSBuYW1lIG9mIHRoaXMgbWV0aG9kIHRvb1xuICAvLyBjdXRlc3ksIGJ1dCB0aGV5IGFyZSBjdXJtdWRnZW9ucy5cbiAgcnVudGltZS5hd3JhcCA9IGZ1bmN0aW9uKGFyZykge1xuICAgIHJldHVybiBuZXcgQXdhaXRBcmd1bWVudChhcmcpO1xuICB9O1xuXG4gIGZ1bmN0aW9uIEF3YWl0QXJndW1lbnQoYXJnKSB7XG4gICAgdGhpcy5hcmcgPSBhcmc7XG4gIH1cblxuICBmdW5jdGlvbiBBc3luY0l0ZXJhdG9yKGdlbmVyYXRvcikge1xuICAgIC8vIFRoaXMgaW52b2tlIGZ1bmN0aW9uIGlzIHdyaXR0ZW4gaW4gYSBzdHlsZSB0aGF0IGFzc3VtZXMgc29tZVxuICAgIC8vIGNhbGxpbmcgZnVuY3Rpb24gKG9yIFByb21pc2UpIHdpbGwgaGFuZGxlIGV4Y2VwdGlvbnMuXG4gICAgZnVuY3Rpb24gaW52b2tlKG1ldGhvZCwgYXJnKSB7XG4gICAgICB2YXIgcmVzdWx0ID0gZ2VuZXJhdG9yW21ldGhvZF0oYXJnKTtcbiAgICAgIHZhciB2YWx1ZSA9IHJlc3VsdC52YWx1ZTtcbiAgICAgIHJldHVybiB2YWx1ZSBpbnN0YW5jZW9mIEF3YWl0QXJndW1lbnRcbiAgICAgICAgPyBQcm9taXNlLnJlc29sdmUodmFsdWUuYXJnKS50aGVuKGludm9rZU5leHQsIGludm9rZVRocm93KVxuICAgICAgICA6IFByb21pc2UucmVzb2x2ZSh2YWx1ZSkudGhlbihmdW5jdGlvbih1bndyYXBwZWQpIHtcbiAgICAgICAgICAgIC8vIFdoZW4gYSB5aWVsZGVkIFByb21pc2UgaXMgcmVzb2x2ZWQsIGl0cyBmaW5hbCB2YWx1ZSBiZWNvbWVzXG4gICAgICAgICAgICAvLyB0aGUgLnZhbHVlIG9mIHRoZSBQcm9taXNlPHt2YWx1ZSxkb25lfT4gcmVzdWx0IGZvciB0aGVcbiAgICAgICAgICAgIC8vIGN1cnJlbnQgaXRlcmF0aW9uLiBJZiB0aGUgUHJvbWlzZSBpcyByZWplY3RlZCwgaG93ZXZlciwgdGhlXG4gICAgICAgICAgICAvLyByZXN1bHQgZm9yIHRoaXMgaXRlcmF0aW9uIHdpbGwgYmUgcmVqZWN0ZWQgd2l0aCB0aGUgc2FtZVxuICAgICAgICAgICAgLy8gcmVhc29uLiBOb3RlIHRoYXQgcmVqZWN0aW9ucyBvZiB5aWVsZGVkIFByb21pc2VzIGFyZSBub3RcbiAgICAgICAgICAgIC8vIHRocm93biBiYWNrIGludG8gdGhlIGdlbmVyYXRvciBmdW5jdGlvbiwgYXMgaXMgdGhlIGNhc2VcbiAgICAgICAgICAgIC8vIHdoZW4gYW4gYXdhaXRlZCBQcm9taXNlIGlzIHJlamVjdGVkLiBUaGlzIGRpZmZlcmVuY2UgaW5cbiAgICAgICAgICAgIC8vIGJlaGF2aW9yIGJldHdlZW4geWllbGQgYW5kIGF3YWl0IGlzIGltcG9ydGFudCwgYmVjYXVzZSBpdFxuICAgICAgICAgICAgLy8gYWxsb3dzIHRoZSBjb25zdW1lciB0byBkZWNpZGUgd2hhdCB0byBkbyB3aXRoIHRoZSB5aWVsZGVkXG4gICAgICAgICAgICAvLyByZWplY3Rpb24gKHN3YWxsb3cgaXQgYW5kIGNvbnRpbnVlLCBtYW51YWxseSAudGhyb3cgaXQgYmFja1xuICAgICAgICAgICAgLy8gaW50byB0aGUgZ2VuZXJhdG9yLCBhYmFuZG9uIGl0ZXJhdGlvbiwgd2hhdGV2ZXIpLiBXaXRoXG4gICAgICAgICAgICAvLyBhd2FpdCwgYnkgY29udHJhc3QsIHRoZXJlIGlzIG5vIG9wcG9ydHVuaXR5IHRvIGV4YW1pbmUgdGhlXG4gICAgICAgICAgICAvLyByZWplY3Rpb24gcmVhc29uIG91dHNpZGUgdGhlIGdlbmVyYXRvciBmdW5jdGlvbiwgc28gdGhlXG4gICAgICAgICAgICAvLyBvbmx5IG9wdGlvbiBpcyB0byB0aHJvdyBpdCBmcm9tIHRoZSBhd2FpdCBleHByZXNzaW9uLCBhbmRcbiAgICAgICAgICAgIC8vIGxldCB0aGUgZ2VuZXJhdG9yIGZ1bmN0aW9uIGhhbmRsZSB0aGUgZXhjZXB0aW9uLlxuICAgICAgICAgICAgcmVzdWx0LnZhbHVlID0gdW53cmFwcGVkO1xuICAgICAgICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICAgICAgICB9KTtcbiAgICB9XG5cbiAgICBpZiAodHlwZW9mIHByb2Nlc3MgPT09IFwib2JqZWN0XCIgJiYgcHJvY2Vzcy5kb21haW4pIHtcbiAgICAgIGludm9rZSA9IHByb2Nlc3MuZG9tYWluLmJpbmQoaW52b2tlKTtcbiAgICB9XG5cbiAgICB2YXIgaW52b2tlTmV4dCA9IGludm9rZS5iaW5kKGdlbmVyYXRvciwgXCJuZXh0XCIpO1xuICAgIHZhciBpbnZva2VUaHJvdyA9IGludm9rZS5iaW5kKGdlbmVyYXRvciwgXCJ0aHJvd1wiKTtcbiAgICB2YXIgaW52b2tlUmV0dXJuID0gaW52b2tlLmJpbmQoZ2VuZXJhdG9yLCBcInJldHVyblwiKTtcbiAgICB2YXIgcHJldmlvdXNQcm9taXNlO1xuXG4gICAgZnVuY3Rpb24gZW5xdWV1ZShtZXRob2QsIGFyZykge1xuICAgICAgZnVuY3Rpb24gY2FsbEludm9rZVdpdGhNZXRob2RBbmRBcmcoKSB7XG4gICAgICAgIHJldHVybiBpbnZva2UobWV0aG9kLCBhcmcpO1xuICAgICAgfVxuXG4gICAgICByZXR1cm4gcHJldmlvdXNQcm9taXNlID1cbiAgICAgICAgLy8gSWYgZW5xdWV1ZSBoYXMgYmVlbiBjYWxsZWQgYmVmb3JlLCB0aGVuIHdlIHdhbnQgdG8gd2FpdCB1bnRpbFxuICAgICAgICAvLyBhbGwgcHJldmlvdXMgUHJvbWlzZXMgaGF2ZSBiZWVuIHJlc29sdmVkIGJlZm9yZSBjYWxsaW5nIGludm9rZSxcbiAgICAgICAgLy8gc28gdGhhdCByZXN1bHRzIGFyZSBhbHdheXMgZGVsaXZlcmVkIGluIHRoZSBjb3JyZWN0IG9yZGVyLiBJZlxuICAgICAgICAvLyBlbnF1ZXVlIGhhcyBub3QgYmVlbiBjYWxsZWQgYmVmb3JlLCB0aGVuIGl0IGlzIGltcG9ydGFudCB0b1xuICAgICAgICAvLyBjYWxsIGludm9rZSBpbW1lZGlhdGVseSwgd2l0aG91dCB3YWl0aW5nIG9uIGEgY2FsbGJhY2sgdG8gZmlyZSxcbiAgICAgICAgLy8gc28gdGhhdCB0aGUgYXN5bmMgZ2VuZXJhdG9yIGZ1bmN0aW9uIGhhcyB0aGUgb3Bwb3J0dW5pdHkgdG8gZG9cbiAgICAgICAgLy8gYW55IG5lY2Vzc2FyeSBzZXR1cCBpbiBhIHByZWRpY3RhYmxlIHdheS4gVGhpcyBwcmVkaWN0YWJpbGl0eVxuICAgICAgICAvLyBpcyB3aHkgdGhlIFByb21pc2UgY29uc3RydWN0b3Igc3luY2hyb25vdXNseSBpbnZva2VzIGl0c1xuICAgICAgICAvLyBleGVjdXRvciBjYWxsYmFjaywgYW5kIHdoeSBhc3luYyBmdW5jdGlvbnMgc3luY2hyb25vdXNseVxuICAgICAgICAvLyBleGVjdXRlIGNvZGUgYmVmb3JlIHRoZSBmaXJzdCBhd2FpdC4gU2luY2Ugd2UgaW1wbGVtZW50IHNpbXBsZVxuICAgICAgICAvLyBhc3luYyBmdW5jdGlvbnMgaW4gdGVybXMgb2YgYXN5bmMgZ2VuZXJhdG9ycywgaXQgaXMgZXNwZWNpYWxseVxuICAgICAgICAvLyBpbXBvcnRhbnQgdG8gZ2V0IHRoaXMgcmlnaHQsIGV2ZW4gdGhvdWdoIGl0IHJlcXVpcmVzIGNhcmUuXG4gICAgICAgIHByZXZpb3VzUHJvbWlzZSA/IHByZXZpb3VzUHJvbWlzZS50aGVuKFxuICAgICAgICAgIGNhbGxJbnZva2VXaXRoTWV0aG9kQW5kQXJnLFxuICAgICAgICAgIC8vIEF2b2lkIHByb3BhZ2F0aW5nIGZhaWx1cmVzIHRvIFByb21pc2VzIHJldHVybmVkIGJ5IGxhdGVyXG4gICAgICAgICAgLy8gaW52b2NhdGlvbnMgb2YgdGhlIGl0ZXJhdG9yLlxuICAgICAgICAgIGNhbGxJbnZva2VXaXRoTWV0aG9kQW5kQXJnXG4gICAgICAgICkgOiBuZXcgUHJvbWlzZShmdW5jdGlvbiAocmVzb2x2ZSkge1xuICAgICAgICAgIHJlc29sdmUoY2FsbEludm9rZVdpdGhNZXRob2RBbmRBcmcoKSk7XG4gICAgICAgIH0pO1xuICAgIH1cblxuICAgIC8vIERlZmluZSB0aGUgdW5pZmllZCBoZWxwZXIgbWV0aG9kIHRoYXQgaXMgdXNlZCB0byBpbXBsZW1lbnQgLm5leHQsXG4gICAgLy8gLnRocm93LCBhbmQgLnJldHVybiAoc2VlIGRlZmluZUl0ZXJhdG9yTWV0aG9kcykuXG4gICAgdGhpcy5faW52b2tlID0gZW5xdWV1ZTtcbiAgfVxuXG4gIGRlZmluZUl0ZXJhdG9yTWV0aG9kcyhBc3luY0l0ZXJhdG9yLnByb3RvdHlwZSk7XG5cbiAgLy8gTm90ZSB0aGF0IHNpbXBsZSBhc3luYyBmdW5jdGlvbnMgYXJlIGltcGxlbWVudGVkIG9uIHRvcCBvZlxuICAvLyBBc3luY0l0ZXJhdG9yIG9iamVjdHM7IHRoZXkganVzdCByZXR1cm4gYSBQcm9taXNlIGZvciB0aGUgdmFsdWUgb2ZcbiAgLy8gdGhlIGZpbmFsIHJlc3VsdCBwcm9kdWNlZCBieSB0aGUgaXRlcmF0b3IuXG4gIHJ1bnRpbWUuYXN5bmMgPSBmdW5jdGlvbihpbm5lckZuLCBvdXRlckZuLCBzZWxmLCB0cnlMb2NzTGlzdCkge1xuICAgIHZhciBpdGVyID0gbmV3IEFzeW5jSXRlcmF0b3IoXG4gICAgICB3cmFwKGlubmVyRm4sIG91dGVyRm4sIHNlbGYsIHRyeUxvY3NMaXN0KVxuICAgICk7XG5cbiAgICByZXR1cm4gcnVudGltZS5pc0dlbmVyYXRvckZ1bmN0aW9uKG91dGVyRm4pXG4gICAgICA/IGl0ZXIgLy8gSWYgb3V0ZXJGbiBpcyBhIGdlbmVyYXRvciwgcmV0dXJuIHRoZSBmdWxsIGl0ZXJhdG9yLlxuICAgICAgOiBpdGVyLm5leHQoKS50aGVuKGZ1bmN0aW9uKHJlc3VsdCkge1xuICAgICAgICAgIHJldHVybiByZXN1bHQuZG9uZSA/IHJlc3VsdC52YWx1ZSA6IGl0ZXIubmV4dCgpO1xuICAgICAgICB9KTtcbiAgfTtcblxuICBmdW5jdGlvbiBtYWtlSW52b2tlTWV0aG9kKGlubmVyRm4sIHNlbGYsIGNvbnRleHQpIHtcbiAgICB2YXIgc3RhdGUgPSBHZW5TdGF0ZVN1c3BlbmRlZFN0YXJ0O1xuXG4gICAgcmV0dXJuIGZ1bmN0aW9uIGludm9rZShtZXRob2QsIGFyZykge1xuICAgICAgaWYgKHN0YXRlID09PSBHZW5TdGF0ZUV4ZWN1dGluZykge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJHZW5lcmF0b3IgaXMgYWxyZWFkeSBydW5uaW5nXCIpO1xuICAgICAgfVxuXG4gICAgICBpZiAoc3RhdGUgPT09IEdlblN0YXRlQ29tcGxldGVkKSB7XG4gICAgICAgIGlmIChtZXRob2QgPT09IFwidGhyb3dcIikge1xuICAgICAgICAgIHRocm93IGFyZztcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIEJlIGZvcmdpdmluZywgcGVyIDI1LjMuMy4zLjMgb2YgdGhlIHNwZWM6XG4gICAgICAgIC8vIGh0dHBzOi8vcGVvcGxlLm1vemlsbGEub3JnL35qb3JlbmRvcmZmL2VzNi1kcmFmdC5odG1sI3NlYy1nZW5lcmF0b3JyZXN1bWVcbiAgICAgICAgcmV0dXJuIGRvbmVSZXN1bHQoKTtcbiAgICAgIH1cblxuICAgICAgd2hpbGUgKHRydWUpIHtcbiAgICAgICAgdmFyIGRlbGVnYXRlID0gY29udGV4dC5kZWxlZ2F0ZTtcbiAgICAgICAgaWYgKGRlbGVnYXRlKSB7XG4gICAgICAgICAgaWYgKG1ldGhvZCA9PT0gXCJyZXR1cm5cIiB8fFxuICAgICAgICAgICAgICAobWV0aG9kID09PSBcInRocm93XCIgJiYgZGVsZWdhdGUuaXRlcmF0b3JbbWV0aG9kXSA9PT0gdW5kZWZpbmVkKSkge1xuICAgICAgICAgICAgLy8gQSByZXR1cm4gb3IgdGhyb3cgKHdoZW4gdGhlIGRlbGVnYXRlIGl0ZXJhdG9yIGhhcyBubyB0aHJvd1xuICAgICAgICAgICAgLy8gbWV0aG9kKSBhbHdheXMgdGVybWluYXRlcyB0aGUgeWllbGQqIGxvb3AuXG4gICAgICAgICAgICBjb250ZXh0LmRlbGVnYXRlID0gbnVsbDtcblxuICAgICAgICAgICAgLy8gSWYgdGhlIGRlbGVnYXRlIGl0ZXJhdG9yIGhhcyBhIHJldHVybiBtZXRob2QsIGdpdmUgaXQgYVxuICAgICAgICAgICAgLy8gY2hhbmNlIHRvIGNsZWFuIHVwLlxuICAgICAgICAgICAgdmFyIHJldHVybk1ldGhvZCA9IGRlbGVnYXRlLml0ZXJhdG9yW1wicmV0dXJuXCJdO1xuICAgICAgICAgICAgaWYgKHJldHVybk1ldGhvZCkge1xuICAgICAgICAgICAgICB2YXIgcmVjb3JkID0gdHJ5Q2F0Y2gocmV0dXJuTWV0aG9kLCBkZWxlZ2F0ZS5pdGVyYXRvciwgYXJnKTtcbiAgICAgICAgICAgICAgaWYgKHJlY29yZC50eXBlID09PSBcInRocm93XCIpIHtcbiAgICAgICAgICAgICAgICAvLyBJZiB0aGUgcmV0dXJuIG1ldGhvZCB0aHJldyBhbiBleGNlcHRpb24sIGxldCB0aGF0XG4gICAgICAgICAgICAgICAgLy8gZXhjZXB0aW9uIHByZXZhaWwgb3ZlciB0aGUgb3JpZ2luYWwgcmV0dXJuIG9yIHRocm93LlxuICAgICAgICAgICAgICAgIG1ldGhvZCA9IFwidGhyb3dcIjtcbiAgICAgICAgICAgICAgICBhcmcgPSByZWNvcmQuYXJnO1xuICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmIChtZXRob2QgPT09IFwicmV0dXJuXCIpIHtcbiAgICAgICAgICAgICAgLy8gQ29udGludWUgd2l0aCB0aGUgb3V0ZXIgcmV0dXJuLCBub3cgdGhhdCB0aGUgZGVsZWdhdGVcbiAgICAgICAgICAgICAgLy8gaXRlcmF0b3IgaGFzIGJlZW4gdGVybWluYXRlZC5cbiAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgdmFyIHJlY29yZCA9IHRyeUNhdGNoKFxuICAgICAgICAgICAgZGVsZWdhdGUuaXRlcmF0b3JbbWV0aG9kXSxcbiAgICAgICAgICAgIGRlbGVnYXRlLml0ZXJhdG9yLFxuICAgICAgICAgICAgYXJnXG4gICAgICAgICAgKTtcblxuICAgICAgICAgIGlmIChyZWNvcmQudHlwZSA9PT0gXCJ0aHJvd1wiKSB7XG4gICAgICAgICAgICBjb250ZXh0LmRlbGVnYXRlID0gbnVsbDtcblxuICAgICAgICAgICAgLy8gTGlrZSByZXR1cm5pbmcgZ2VuZXJhdG9yLnRocm93KHVuY2F1Z2h0KSwgYnV0IHdpdGhvdXQgdGhlXG4gICAgICAgICAgICAvLyBvdmVyaGVhZCBvZiBhbiBleHRyYSBmdW5jdGlvbiBjYWxsLlxuICAgICAgICAgICAgbWV0aG9kID0gXCJ0aHJvd1wiO1xuICAgICAgICAgICAgYXJnID0gcmVjb3JkLmFyZztcbiAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIC8vIERlbGVnYXRlIGdlbmVyYXRvciByYW4gYW5kIGhhbmRsZWQgaXRzIG93biBleGNlcHRpb25zIHNvXG4gICAgICAgICAgLy8gcmVnYXJkbGVzcyBvZiB3aGF0IHRoZSBtZXRob2Qgd2FzLCB3ZSBjb250aW51ZSBhcyBpZiBpdCBpc1xuICAgICAgICAgIC8vIFwibmV4dFwiIHdpdGggYW4gdW5kZWZpbmVkIGFyZy5cbiAgICAgICAgICBtZXRob2QgPSBcIm5leHRcIjtcbiAgICAgICAgICBhcmcgPSB1bmRlZmluZWQ7XG5cbiAgICAgICAgICB2YXIgaW5mbyA9IHJlY29yZC5hcmc7XG4gICAgICAgICAgaWYgKGluZm8uZG9uZSkge1xuICAgICAgICAgICAgY29udGV4dFtkZWxlZ2F0ZS5yZXN1bHROYW1lXSA9IGluZm8udmFsdWU7XG4gICAgICAgICAgICBjb250ZXh0Lm5leHQgPSBkZWxlZ2F0ZS5uZXh0TG9jO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBzdGF0ZSA9IEdlblN0YXRlU3VzcGVuZGVkWWllbGQ7XG4gICAgICAgICAgICByZXR1cm4gaW5mbztcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBjb250ZXh0LmRlbGVnYXRlID0gbnVsbDtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChtZXRob2QgPT09IFwibmV4dFwiKSB7XG4gICAgICAgICAgY29udGV4dC5fc2VudCA9IGFyZztcblxuICAgICAgICAgIGlmIChzdGF0ZSA9PT0gR2VuU3RhdGVTdXNwZW5kZWRZaWVsZCkge1xuICAgICAgICAgICAgY29udGV4dC5zZW50ID0gYXJnO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBjb250ZXh0LnNlbnQgPSB1bmRlZmluZWQ7XG4gICAgICAgICAgfVxuICAgICAgICB9IGVsc2UgaWYgKG1ldGhvZCA9PT0gXCJ0aHJvd1wiKSB7XG4gICAgICAgICAgaWYgKHN0YXRlID09PSBHZW5TdGF0ZVN1c3BlbmRlZFN0YXJ0KSB7XG4gICAgICAgICAgICBzdGF0ZSA9IEdlblN0YXRlQ29tcGxldGVkO1xuICAgICAgICAgICAgdGhyb3cgYXJnO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIGlmIChjb250ZXh0LmRpc3BhdGNoRXhjZXB0aW9uKGFyZykpIHtcbiAgICAgICAgICAgIC8vIElmIHRoZSBkaXNwYXRjaGVkIGV4Y2VwdGlvbiB3YXMgY2F1Z2h0IGJ5IGEgY2F0Y2ggYmxvY2ssXG4gICAgICAgICAgICAvLyB0aGVuIGxldCB0aGF0IGNhdGNoIGJsb2NrIGhhbmRsZSB0aGUgZXhjZXB0aW9uIG5vcm1hbGx5LlxuICAgICAgICAgICAgbWV0aG9kID0gXCJuZXh0XCI7XG4gICAgICAgICAgICBhcmcgPSB1bmRlZmluZWQ7XG4gICAgICAgICAgfVxuXG4gICAgICAgIH0gZWxzZSBpZiAobWV0aG9kID09PSBcInJldHVyblwiKSB7XG4gICAgICAgICAgY29udGV4dC5hYnJ1cHQoXCJyZXR1cm5cIiwgYXJnKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHN0YXRlID0gR2VuU3RhdGVFeGVjdXRpbmc7XG5cbiAgICAgICAgdmFyIHJlY29yZCA9IHRyeUNhdGNoKGlubmVyRm4sIHNlbGYsIGNvbnRleHQpO1xuICAgICAgICBpZiAocmVjb3JkLnR5cGUgPT09IFwibm9ybWFsXCIpIHtcbiAgICAgICAgICAvLyBJZiBhbiBleGNlcHRpb24gaXMgdGhyb3duIGZyb20gaW5uZXJGbiwgd2UgbGVhdmUgc3RhdGUgPT09XG4gICAgICAgICAgLy8gR2VuU3RhdGVFeGVjdXRpbmcgYW5kIGxvb3AgYmFjayBmb3IgYW5vdGhlciBpbnZvY2F0aW9uLlxuICAgICAgICAgIHN0YXRlID0gY29udGV4dC5kb25lXG4gICAgICAgICAgICA/IEdlblN0YXRlQ29tcGxldGVkXG4gICAgICAgICAgICA6IEdlblN0YXRlU3VzcGVuZGVkWWllbGQ7XG5cbiAgICAgICAgICB2YXIgaW5mbyA9IHtcbiAgICAgICAgICAgIHZhbHVlOiByZWNvcmQuYXJnLFxuICAgICAgICAgICAgZG9uZTogY29udGV4dC5kb25lXG4gICAgICAgICAgfTtcblxuICAgICAgICAgIGlmIChyZWNvcmQuYXJnID09PSBDb250aW51ZVNlbnRpbmVsKSB7XG4gICAgICAgICAgICBpZiAoY29udGV4dC5kZWxlZ2F0ZSAmJiBtZXRob2QgPT09IFwibmV4dFwiKSB7XG4gICAgICAgICAgICAgIC8vIERlbGliZXJhdGVseSBmb3JnZXQgdGhlIGxhc3Qgc2VudCB2YWx1ZSBzbyB0aGF0IHdlIGRvbid0XG4gICAgICAgICAgICAgIC8vIGFjY2lkZW50YWxseSBwYXNzIGl0IG9uIHRvIHRoZSBkZWxlZ2F0ZS5cbiAgICAgICAgICAgICAgYXJnID0gdW5kZWZpbmVkO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICByZXR1cm4gaW5mbztcbiAgICAgICAgICB9XG5cbiAgICAgICAgfSBlbHNlIGlmIChyZWNvcmQudHlwZSA9PT0gXCJ0aHJvd1wiKSB7XG4gICAgICAgICAgc3RhdGUgPSBHZW5TdGF0ZUNvbXBsZXRlZDtcbiAgICAgICAgICAvLyBEaXNwYXRjaCB0aGUgZXhjZXB0aW9uIGJ5IGxvb3BpbmcgYmFjayBhcm91bmQgdG8gdGhlXG4gICAgICAgICAgLy8gY29udGV4dC5kaXNwYXRjaEV4Y2VwdGlvbihhcmcpIGNhbGwgYWJvdmUuXG4gICAgICAgICAgbWV0aG9kID0gXCJ0aHJvd1wiO1xuICAgICAgICAgIGFyZyA9IHJlY29yZC5hcmc7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9O1xuICB9XG5cbiAgLy8gRGVmaW5lIEdlbmVyYXRvci5wcm90b3R5cGUue25leHQsdGhyb3cscmV0dXJufSBpbiB0ZXJtcyBvZiB0aGVcbiAgLy8gdW5pZmllZCAuX2ludm9rZSBoZWxwZXIgbWV0aG9kLlxuICBkZWZpbmVJdGVyYXRvck1ldGhvZHMoR3ApO1xuXG4gIEdwW2l0ZXJhdG9yU3ltYm9sXSA9IGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiB0aGlzO1xuICB9O1xuXG4gIEdwLnRvU3RyaW5nID0gZnVuY3Rpb24oKSB7XG4gICAgcmV0dXJuIFwiW29iamVjdCBHZW5lcmF0b3JdXCI7XG4gIH07XG5cbiAgZnVuY3Rpb24gcHVzaFRyeUVudHJ5KGxvY3MpIHtcbiAgICB2YXIgZW50cnkgPSB7IHRyeUxvYzogbG9jc1swXSB9O1xuXG4gICAgaWYgKDEgaW4gbG9jcykge1xuICAgICAgZW50cnkuY2F0Y2hMb2MgPSBsb2NzWzFdO1xuICAgIH1cblxuICAgIGlmICgyIGluIGxvY3MpIHtcbiAgICAgIGVudHJ5LmZpbmFsbHlMb2MgPSBsb2NzWzJdO1xuICAgICAgZW50cnkuYWZ0ZXJMb2MgPSBsb2NzWzNdO1xuICAgIH1cblxuICAgIHRoaXMudHJ5RW50cmllcy5wdXNoKGVudHJ5KTtcbiAgfVxuXG4gIGZ1bmN0aW9uIHJlc2V0VHJ5RW50cnkoZW50cnkpIHtcbiAgICB2YXIgcmVjb3JkID0gZW50cnkuY29tcGxldGlvbiB8fCB7fTtcbiAgICByZWNvcmQudHlwZSA9IFwibm9ybWFsXCI7XG4gICAgZGVsZXRlIHJlY29yZC5hcmc7XG4gICAgZW50cnkuY29tcGxldGlvbiA9IHJlY29yZDtcbiAgfVxuXG4gIGZ1bmN0aW9uIENvbnRleHQodHJ5TG9jc0xpc3QpIHtcbiAgICAvLyBUaGUgcm9vdCBlbnRyeSBvYmplY3QgKGVmZmVjdGl2ZWx5IGEgdHJ5IHN0YXRlbWVudCB3aXRob3V0IGEgY2F0Y2hcbiAgICAvLyBvciBhIGZpbmFsbHkgYmxvY2spIGdpdmVzIHVzIGEgcGxhY2UgdG8gc3RvcmUgdmFsdWVzIHRocm93biBmcm9tXG4gICAgLy8gbG9jYXRpb25zIHdoZXJlIHRoZXJlIGlzIG5vIGVuY2xvc2luZyB0cnkgc3RhdGVtZW50LlxuICAgIHRoaXMudHJ5RW50cmllcyA9IFt7IHRyeUxvYzogXCJyb290XCIgfV07XG4gICAgdHJ5TG9jc0xpc3QuZm9yRWFjaChwdXNoVHJ5RW50cnksIHRoaXMpO1xuICAgIHRoaXMucmVzZXQodHJ1ZSk7XG4gIH1cblxuICBydW50aW1lLmtleXMgPSBmdW5jdGlvbihvYmplY3QpIHtcbiAgICB2YXIga2V5cyA9IFtdO1xuICAgIGZvciAodmFyIGtleSBpbiBvYmplY3QpIHtcbiAgICAgIGtleXMucHVzaChrZXkpO1xuICAgIH1cbiAgICBrZXlzLnJldmVyc2UoKTtcblxuICAgIC8vIFJhdGhlciB0aGFuIHJldHVybmluZyBhbiBvYmplY3Qgd2l0aCBhIG5leHQgbWV0aG9kLCB3ZSBrZWVwXG4gICAgLy8gdGhpbmdzIHNpbXBsZSBhbmQgcmV0dXJuIHRoZSBuZXh0IGZ1bmN0aW9uIGl0c2VsZi5cbiAgICByZXR1cm4gZnVuY3Rpb24gbmV4dCgpIHtcbiAgICAgIHdoaWxlIChrZXlzLmxlbmd0aCkge1xuICAgICAgICB2YXIga2V5ID0ga2V5cy5wb3AoKTtcbiAgICAgICAgaWYgKGtleSBpbiBvYmplY3QpIHtcbiAgICAgICAgICBuZXh0LnZhbHVlID0ga2V5O1xuICAgICAgICAgIG5leHQuZG9uZSA9IGZhbHNlO1xuICAgICAgICAgIHJldHVybiBuZXh0O1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIC8vIFRvIGF2b2lkIGNyZWF0aW5nIGFuIGFkZGl0aW9uYWwgb2JqZWN0LCB3ZSBqdXN0IGhhbmcgdGhlIC52YWx1ZVxuICAgICAgLy8gYW5kIC5kb25lIHByb3BlcnRpZXMgb2ZmIHRoZSBuZXh0IGZ1bmN0aW9uIG9iamVjdCBpdHNlbGYuIFRoaXNcbiAgICAgIC8vIGFsc28gZW5zdXJlcyB0aGF0IHRoZSBtaW5pZmllciB3aWxsIG5vdCBhbm9ueW1pemUgdGhlIGZ1bmN0aW9uLlxuICAgICAgbmV4dC5kb25lID0gdHJ1ZTtcbiAgICAgIHJldHVybiBuZXh0O1xuICAgIH07XG4gIH07XG5cbiAgZnVuY3Rpb24gdmFsdWVzKGl0ZXJhYmxlKSB7XG4gICAgaWYgKGl0ZXJhYmxlKSB7XG4gICAgICB2YXIgaXRlcmF0b3JNZXRob2QgPSBpdGVyYWJsZVtpdGVyYXRvclN5bWJvbF07XG4gICAgICBpZiAoaXRlcmF0b3JNZXRob2QpIHtcbiAgICAgICAgcmV0dXJuIGl0ZXJhdG9yTWV0aG9kLmNhbGwoaXRlcmFibGUpO1xuICAgICAgfVxuXG4gICAgICBpZiAodHlwZW9mIGl0ZXJhYmxlLm5leHQgPT09IFwiZnVuY3Rpb25cIikge1xuICAgICAgICByZXR1cm4gaXRlcmFibGU7XG4gICAgICB9XG5cbiAgICAgIGlmICghaXNOYU4oaXRlcmFibGUubGVuZ3RoKSkge1xuICAgICAgICB2YXIgaSA9IC0xLCBuZXh0ID0gZnVuY3Rpb24gbmV4dCgpIHtcbiAgICAgICAgICB3aGlsZSAoKytpIDwgaXRlcmFibGUubGVuZ3RoKSB7XG4gICAgICAgICAgICBpZiAoaGFzT3duLmNhbGwoaXRlcmFibGUsIGkpKSB7XG4gICAgICAgICAgICAgIG5leHQudmFsdWUgPSBpdGVyYWJsZVtpXTtcbiAgICAgICAgICAgICAgbmV4dC5kb25lID0gZmFsc2U7XG4gICAgICAgICAgICAgIHJldHVybiBuZXh0O1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cblxuICAgICAgICAgIG5leHQudmFsdWUgPSB1bmRlZmluZWQ7XG4gICAgICAgICAgbmV4dC5kb25lID0gdHJ1ZTtcblxuICAgICAgICAgIHJldHVybiBuZXh0O1xuICAgICAgICB9O1xuXG4gICAgICAgIHJldHVybiBuZXh0Lm5leHQgPSBuZXh0O1xuICAgICAgfVxuICAgIH1cblxuICAgIC8vIFJldHVybiBhbiBpdGVyYXRvciB3aXRoIG5vIHZhbHVlcy5cbiAgICByZXR1cm4geyBuZXh0OiBkb25lUmVzdWx0IH07XG4gIH1cbiAgcnVudGltZS52YWx1ZXMgPSB2YWx1ZXM7XG5cbiAgZnVuY3Rpb24gZG9uZVJlc3VsdCgpIHtcbiAgICByZXR1cm4geyB2YWx1ZTogdW5kZWZpbmVkLCBkb25lOiB0cnVlIH07XG4gIH1cblxuICBDb250ZXh0LnByb3RvdHlwZSA9IHtcbiAgICBjb25zdHJ1Y3RvcjogQ29udGV4dCxcblxuICAgIHJlc2V0OiBmdW5jdGlvbihza2lwVGVtcFJlc2V0KSB7XG4gICAgICB0aGlzLnByZXYgPSAwO1xuICAgICAgdGhpcy5uZXh0ID0gMDtcbiAgICAgIHRoaXMuc2VudCA9IHVuZGVmaW5lZDtcbiAgICAgIHRoaXMuZG9uZSA9IGZhbHNlO1xuICAgICAgdGhpcy5kZWxlZ2F0ZSA9IG51bGw7XG5cbiAgICAgIHRoaXMudHJ5RW50cmllcy5mb3JFYWNoKHJlc2V0VHJ5RW50cnkpO1xuXG4gICAgICBpZiAoIXNraXBUZW1wUmVzZXQpIHtcbiAgICAgICAgZm9yICh2YXIgbmFtZSBpbiB0aGlzKSB7XG4gICAgICAgICAgLy8gTm90IHN1cmUgYWJvdXQgdGhlIG9wdGltYWwgb3JkZXIgb2YgdGhlc2UgY29uZGl0aW9uczpcbiAgICAgICAgICBpZiAobmFtZS5jaGFyQXQoMCkgPT09IFwidFwiICYmXG4gICAgICAgICAgICAgIGhhc093bi5jYWxsKHRoaXMsIG5hbWUpICYmXG4gICAgICAgICAgICAgICFpc05hTigrbmFtZS5zbGljZSgxKSkpIHtcbiAgICAgICAgICAgIHRoaXNbbmFtZV0gPSB1bmRlZmluZWQ7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfSxcblxuICAgIHN0b3A6IGZ1bmN0aW9uKCkge1xuICAgICAgdGhpcy5kb25lID0gdHJ1ZTtcblxuICAgICAgdmFyIHJvb3RFbnRyeSA9IHRoaXMudHJ5RW50cmllc1swXTtcbiAgICAgIHZhciByb290UmVjb3JkID0gcm9vdEVudHJ5LmNvbXBsZXRpb247XG4gICAgICBpZiAocm9vdFJlY29yZC50eXBlID09PSBcInRocm93XCIpIHtcbiAgICAgICAgdGhyb3cgcm9vdFJlY29yZC5hcmc7XG4gICAgICB9XG5cbiAgICAgIHJldHVybiB0aGlzLnJ2YWw7XG4gICAgfSxcblxuICAgIGRpc3BhdGNoRXhjZXB0aW9uOiBmdW5jdGlvbihleGNlcHRpb24pIHtcbiAgICAgIGlmICh0aGlzLmRvbmUpIHtcbiAgICAgICAgdGhyb3cgZXhjZXB0aW9uO1xuICAgICAgfVxuXG4gICAgICB2YXIgY29udGV4dCA9IHRoaXM7XG4gICAgICBmdW5jdGlvbiBoYW5kbGUobG9jLCBjYXVnaHQpIHtcbiAgICAgICAgcmVjb3JkLnR5cGUgPSBcInRocm93XCI7XG4gICAgICAgIHJlY29yZC5hcmcgPSBleGNlcHRpb247XG4gICAgICAgIGNvbnRleHQubmV4dCA9IGxvYztcbiAgICAgICAgcmV0dXJuICEhY2F1Z2h0O1xuICAgICAgfVxuXG4gICAgICBmb3IgKHZhciBpID0gdGhpcy50cnlFbnRyaWVzLmxlbmd0aCAtIDE7IGkgPj0gMDsgLS1pKSB7XG4gICAgICAgIHZhciBlbnRyeSA9IHRoaXMudHJ5RW50cmllc1tpXTtcbiAgICAgICAgdmFyIHJlY29yZCA9IGVudHJ5LmNvbXBsZXRpb247XG5cbiAgICAgICAgaWYgKGVudHJ5LnRyeUxvYyA9PT0gXCJyb290XCIpIHtcbiAgICAgICAgICAvLyBFeGNlcHRpb24gdGhyb3duIG91dHNpZGUgb2YgYW55IHRyeSBibG9jayB0aGF0IGNvdWxkIGhhbmRsZVxuICAgICAgICAgIC8vIGl0LCBzbyBzZXQgdGhlIGNvbXBsZXRpb24gdmFsdWUgb2YgdGhlIGVudGlyZSBmdW5jdGlvbiB0b1xuICAgICAgICAgIC8vIHRocm93IHRoZSBleGNlcHRpb24uXG4gICAgICAgICAgcmV0dXJuIGhhbmRsZShcImVuZFwiKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChlbnRyeS50cnlMb2MgPD0gdGhpcy5wcmV2KSB7XG4gICAgICAgICAgdmFyIGhhc0NhdGNoID0gaGFzT3duLmNhbGwoZW50cnksIFwiY2F0Y2hMb2NcIik7XG4gICAgICAgICAgdmFyIGhhc0ZpbmFsbHkgPSBoYXNPd24uY2FsbChlbnRyeSwgXCJmaW5hbGx5TG9jXCIpO1xuXG4gICAgICAgICAgaWYgKGhhc0NhdGNoICYmIGhhc0ZpbmFsbHkpIHtcbiAgICAgICAgICAgIGlmICh0aGlzLnByZXYgPCBlbnRyeS5jYXRjaExvYykge1xuICAgICAgICAgICAgICByZXR1cm4gaGFuZGxlKGVudHJ5LmNhdGNoTG9jLCB0cnVlKTtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAodGhpcy5wcmV2IDwgZW50cnkuZmluYWxseUxvYykge1xuICAgICAgICAgICAgICByZXR1cm4gaGFuZGxlKGVudHJ5LmZpbmFsbHlMb2MpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgfSBlbHNlIGlmIChoYXNDYXRjaCkge1xuICAgICAgICAgICAgaWYgKHRoaXMucHJldiA8IGVudHJ5LmNhdGNoTG9jKSB7XG4gICAgICAgICAgICAgIHJldHVybiBoYW5kbGUoZW50cnkuY2F0Y2hMb2MsIHRydWUpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgfSBlbHNlIGlmIChoYXNGaW5hbGx5KSB7XG4gICAgICAgICAgICBpZiAodGhpcy5wcmV2IDwgZW50cnkuZmluYWxseUxvYykge1xuICAgICAgICAgICAgICByZXR1cm4gaGFuZGxlKGVudHJ5LmZpbmFsbHlMb2MpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihcInRyeSBzdGF0ZW1lbnQgd2l0aG91dCBjYXRjaCBvciBmaW5hbGx5XCIpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0sXG5cbiAgICBhYnJ1cHQ6IGZ1bmN0aW9uKHR5cGUsIGFyZykge1xuICAgICAgZm9yICh2YXIgaSA9IHRoaXMudHJ5RW50cmllcy5sZW5ndGggLSAxOyBpID49IDA7IC0taSkge1xuICAgICAgICB2YXIgZW50cnkgPSB0aGlzLnRyeUVudHJpZXNbaV07XG4gICAgICAgIGlmIChlbnRyeS50cnlMb2MgPD0gdGhpcy5wcmV2ICYmXG4gICAgICAgICAgICBoYXNPd24uY2FsbChlbnRyeSwgXCJmaW5hbGx5TG9jXCIpICYmXG4gICAgICAgICAgICB0aGlzLnByZXYgPCBlbnRyeS5maW5hbGx5TG9jKSB7XG4gICAgICAgICAgdmFyIGZpbmFsbHlFbnRyeSA9IGVudHJ5O1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIGlmIChmaW5hbGx5RW50cnkgJiZcbiAgICAgICAgICAodHlwZSA9PT0gXCJicmVha1wiIHx8XG4gICAgICAgICAgIHR5cGUgPT09IFwiY29udGludWVcIikgJiZcbiAgICAgICAgICBmaW5hbGx5RW50cnkudHJ5TG9jIDw9IGFyZyAmJlxuICAgICAgICAgIGFyZyA8PSBmaW5hbGx5RW50cnkuZmluYWxseUxvYykge1xuICAgICAgICAvLyBJZ25vcmUgdGhlIGZpbmFsbHkgZW50cnkgaWYgY29udHJvbCBpcyBub3QganVtcGluZyB0byBhXG4gICAgICAgIC8vIGxvY2F0aW9uIG91dHNpZGUgdGhlIHRyeS9jYXRjaCBibG9jay5cbiAgICAgICAgZmluYWxseUVudHJ5ID0gbnVsbDtcbiAgICAgIH1cblxuICAgICAgdmFyIHJlY29yZCA9IGZpbmFsbHlFbnRyeSA/IGZpbmFsbHlFbnRyeS5jb21wbGV0aW9uIDoge307XG4gICAgICByZWNvcmQudHlwZSA9IHR5cGU7XG4gICAgICByZWNvcmQuYXJnID0gYXJnO1xuXG4gICAgICBpZiAoZmluYWxseUVudHJ5KSB7XG4gICAgICAgIHRoaXMubmV4dCA9IGZpbmFsbHlFbnRyeS5maW5hbGx5TG9jO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhpcy5jb21wbGV0ZShyZWNvcmQpO1xuICAgICAgfVxuXG4gICAgICByZXR1cm4gQ29udGludWVTZW50aW5lbDtcbiAgICB9LFxuXG4gICAgY29tcGxldGU6IGZ1bmN0aW9uKHJlY29yZCwgYWZ0ZXJMb2MpIHtcbiAgICAgIGlmIChyZWNvcmQudHlwZSA9PT0gXCJ0aHJvd1wiKSB7XG4gICAgICAgIHRocm93IHJlY29yZC5hcmc7XG4gICAgICB9XG5cbiAgICAgIGlmIChyZWNvcmQudHlwZSA9PT0gXCJicmVha1wiIHx8XG4gICAgICAgICAgcmVjb3JkLnR5cGUgPT09IFwiY29udGludWVcIikge1xuICAgICAgICB0aGlzLm5leHQgPSByZWNvcmQuYXJnO1xuICAgICAgfSBlbHNlIGlmIChyZWNvcmQudHlwZSA9PT0gXCJyZXR1cm5cIikge1xuICAgICAgICB0aGlzLnJ2YWwgPSByZWNvcmQuYXJnO1xuICAgICAgICB0aGlzLm5leHQgPSBcImVuZFwiO1xuICAgICAgfSBlbHNlIGlmIChyZWNvcmQudHlwZSA9PT0gXCJub3JtYWxcIiAmJiBhZnRlckxvYykge1xuICAgICAgICB0aGlzLm5leHQgPSBhZnRlckxvYztcbiAgICAgIH1cbiAgICB9LFxuXG4gICAgZmluaXNoOiBmdW5jdGlvbihmaW5hbGx5TG9jKSB7XG4gICAgICBmb3IgKHZhciBpID0gdGhpcy50cnlFbnRyaWVzLmxlbmd0aCAtIDE7IGkgPj0gMDsgLS1pKSB7XG4gICAgICAgIHZhciBlbnRyeSA9IHRoaXMudHJ5RW50cmllc1tpXTtcbiAgICAgICAgaWYgKGVudHJ5LmZpbmFsbHlMb2MgPT09IGZpbmFsbHlMb2MpIHtcbiAgICAgICAgICB0aGlzLmNvbXBsZXRlKGVudHJ5LmNvbXBsZXRpb24sIGVudHJ5LmFmdGVyTG9jKTtcbiAgICAgICAgICByZXNldFRyeUVudHJ5KGVudHJ5KTtcbiAgICAgICAgICByZXR1cm4gQ29udGludWVTZW50aW5lbDtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0sXG5cbiAgICBcImNhdGNoXCI6IGZ1bmN0aW9uKHRyeUxvYykge1xuICAgICAgZm9yICh2YXIgaSA9IHRoaXMudHJ5RW50cmllcy5sZW5ndGggLSAxOyBpID49IDA7IC0taSkge1xuICAgICAgICB2YXIgZW50cnkgPSB0aGlzLnRyeUVudHJpZXNbaV07XG4gICAgICAgIGlmIChlbnRyeS50cnlMb2MgPT09IHRyeUxvYykge1xuICAgICAgICAgIHZhciByZWNvcmQgPSBlbnRyeS5jb21wbGV0aW9uO1xuICAgICAgICAgIGlmIChyZWNvcmQudHlwZSA9PT0gXCJ0aHJvd1wiKSB7XG4gICAgICAgICAgICB2YXIgdGhyb3duID0gcmVjb3JkLmFyZztcbiAgICAgICAgICAgIHJlc2V0VHJ5RW50cnkoZW50cnkpO1xuICAgICAgICAgIH1cbiAgICAgICAgICByZXR1cm4gdGhyb3duO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIC8vIFRoZSBjb250ZXh0LmNhdGNoIG1ldGhvZCBtdXN0IG9ubHkgYmUgY2FsbGVkIHdpdGggYSBsb2NhdGlvblxuICAgICAgLy8gYXJndW1lbnQgdGhhdCBjb3JyZXNwb25kcyB0byBhIGtub3duIGNhdGNoIGJsb2NrLlxuICAgICAgdGhyb3cgbmV3IEVycm9yKFwiaWxsZWdhbCBjYXRjaCBhdHRlbXB0XCIpO1xuICAgIH0sXG5cbiAgICBkZWxlZ2F0ZVlpZWxkOiBmdW5jdGlvbihpdGVyYWJsZSwgcmVzdWx0TmFtZSwgbmV4dExvYykge1xuICAgICAgdGhpcy5kZWxlZ2F0ZSA9IHtcbiAgICAgICAgaXRlcmF0b3I6IHZhbHVlcyhpdGVyYWJsZSksXG4gICAgICAgIHJlc3VsdE5hbWU6IHJlc3VsdE5hbWUsXG4gICAgICAgIG5leHRMb2M6IG5leHRMb2NcbiAgICAgIH07XG5cbiAgICAgIHJldHVybiBDb250aW51ZVNlbnRpbmVsO1xuICAgIH1cbiAgfTtcbn0pKFxuICAvLyBBbW9uZyB0aGUgdmFyaW91cyB0cmlja3MgZm9yIG9idGFpbmluZyBhIHJlZmVyZW5jZSB0byB0aGUgZ2xvYmFsXG4gIC8vIG9iamVjdCwgdGhpcyBzZWVtcyB0byBiZSB0aGUgbW9zdCByZWxpYWJsZSB0ZWNobmlxdWUgdGhhdCBkb2VzIG5vdFxuICAvLyB1c2UgaW5kaXJlY3QgZXZhbCAod2hpY2ggdmlvbGF0ZXMgQ29udGVudCBTZWN1cml0eSBQb2xpY3kpLlxuICB0eXBlb2YgZ2xvYmFsID09PSBcIm9iamVjdFwiID8gZ2xvYmFsIDpcbiAgdHlwZW9mIHdpbmRvdyA9PT0gXCJvYmplY3RcIiA/IHdpbmRvdyA6XG4gIHR5cGVvZiBzZWxmID09PSBcIm9iamVjdFwiID8gc2VsZiA6IHRoaXNcbik7XG4iLCIvLyBUaGlzIGZpbGUgY2FuIGJlIHJlcXVpcmVkIGluIEJyb3dzZXJpZnkgYW5kIE5vZGUuanMgZm9yIGF1dG9tYXRpYyBwb2x5ZmlsbFxuLy8gVG8gdXNlIGl0OiAgcmVxdWlyZSgnZXM2LXByb21pc2UvYXV0bycpO1xuJ3VzZSBzdHJpY3QnO1xubW9kdWxlLmV4cG9ydHMgPSByZXF1aXJlKCcuLycpLnBvbHlmaWxsKCk7XG4iLCIvKiFcbiAqIEBvdmVydmlldyBlczYtcHJvbWlzZSAtIGEgdGlueSBpbXBsZW1lbnRhdGlvbiBvZiBQcm9taXNlcy9BKy5cbiAqIEBjb3B5cmlnaHQgQ29weXJpZ2h0IChjKSAyMDE0IFllaHVkYSBLYXR6LCBUb20gRGFsZSwgU3RlZmFuIFBlbm5lciBhbmQgY29udHJpYnV0b3JzIChDb252ZXJzaW9uIHRvIEVTNiBBUEkgYnkgSmFrZSBBcmNoaWJhbGQpXG4gKiBAbGljZW5zZSAgIExpY2Vuc2VkIHVuZGVyIE1JVCBsaWNlbnNlXG4gKiAgICAgICAgICAgIFNlZSBodHRwczovL3Jhdy5naXRodWJ1c2VyY29udGVudC5jb20vc3RlZmFucGVubmVyL2VzNi1wcm9taXNlL21hc3Rlci9MSUNFTlNFXG4gKiBAdmVyc2lvbiAgIDQuMS4xXG4gKi9cblxuKGZ1bmN0aW9uIChnbG9iYWwsIGZhY3RvcnkpIHtcblx0dHlwZW9mIGV4cG9ydHMgPT09ICdvYmplY3QnICYmIHR5cGVvZiBtb2R1bGUgIT09ICd1bmRlZmluZWQnID8gbW9kdWxlLmV4cG9ydHMgPSBmYWN0b3J5KCkgOlxuXHR0eXBlb2YgZGVmaW5lID09PSAnZnVuY3Rpb24nICYmIGRlZmluZS5hbWQgPyBkZWZpbmUoZmFjdG9yeSkgOlxuXHQoZ2xvYmFsLkVTNlByb21pc2UgPSBmYWN0b3J5KCkpO1xufSh0aGlzLCAoZnVuY3Rpb24gKCkgeyAndXNlIHN0cmljdCc7XG5cbmZ1bmN0aW9uIG9iamVjdE9yRnVuY3Rpb24oeCkge1xuICB2YXIgdHlwZSA9IHR5cGVvZiB4O1xuICByZXR1cm4geCAhPT0gbnVsbCAmJiAodHlwZSA9PT0gJ29iamVjdCcgfHwgdHlwZSA9PT0gJ2Z1bmN0aW9uJyk7XG59XG5cbmZ1bmN0aW9uIGlzRnVuY3Rpb24oeCkge1xuICByZXR1cm4gdHlwZW9mIHggPT09ICdmdW5jdGlvbic7XG59XG5cbnZhciBfaXNBcnJheSA9IHVuZGVmaW5lZDtcbmlmIChBcnJheS5pc0FycmF5KSB7XG4gIF9pc0FycmF5ID0gQXJyYXkuaXNBcnJheTtcbn0gZWxzZSB7XG4gIF9pc0FycmF5ID0gZnVuY3Rpb24gKHgpIHtcbiAgICByZXR1cm4gT2JqZWN0LnByb3RvdHlwZS50b1N0cmluZy5jYWxsKHgpID09PSAnW29iamVjdCBBcnJheV0nO1xuICB9O1xufVxuXG52YXIgaXNBcnJheSA9IF9pc0FycmF5O1xuXG52YXIgbGVuID0gMDtcbnZhciB2ZXJ0eE5leHQgPSB1bmRlZmluZWQ7XG52YXIgY3VzdG9tU2NoZWR1bGVyRm4gPSB1bmRlZmluZWQ7XG5cbnZhciBhc2FwID0gZnVuY3Rpb24gYXNhcChjYWxsYmFjaywgYXJnKSB7XG4gIHF1ZXVlW2xlbl0gPSBjYWxsYmFjaztcbiAgcXVldWVbbGVuICsgMV0gPSBhcmc7XG4gIGxlbiArPSAyO1xuICBpZiAobGVuID09PSAyKSB7XG4gICAgLy8gSWYgbGVuIGlzIDIsIHRoYXQgbWVhbnMgdGhhdCB3ZSBuZWVkIHRvIHNjaGVkdWxlIGFuIGFzeW5jIGZsdXNoLlxuICAgIC8vIElmIGFkZGl0aW9uYWwgY2FsbGJhY2tzIGFyZSBxdWV1ZWQgYmVmb3JlIHRoZSBxdWV1ZSBpcyBmbHVzaGVkLCB0aGV5XG4gICAgLy8gd2lsbCBiZSBwcm9jZXNzZWQgYnkgdGhpcyBmbHVzaCB0aGF0IHdlIGFyZSBzY2hlZHVsaW5nLlxuICAgIGlmIChjdXN0b21TY2hlZHVsZXJGbikge1xuICAgICAgY3VzdG9tU2NoZWR1bGVyRm4oZmx1c2gpO1xuICAgIH0gZWxzZSB7XG4gICAgICBzY2hlZHVsZUZsdXNoKCk7XG4gICAgfVxuICB9XG59O1xuXG5mdW5jdGlvbiBzZXRTY2hlZHVsZXIoc2NoZWR1bGVGbikge1xuICBjdXN0b21TY2hlZHVsZXJGbiA9IHNjaGVkdWxlRm47XG59XG5cbmZ1bmN0aW9uIHNldEFzYXAoYXNhcEZuKSB7XG4gIGFzYXAgPSBhc2FwRm47XG59XG5cbnZhciBicm93c2VyV2luZG93ID0gdHlwZW9mIHdpbmRvdyAhPT0gJ3VuZGVmaW5lZCcgPyB3aW5kb3cgOiB1bmRlZmluZWQ7XG52YXIgYnJvd3Nlckdsb2JhbCA9IGJyb3dzZXJXaW5kb3cgfHwge307XG52YXIgQnJvd3Nlck11dGF0aW9uT2JzZXJ2ZXIgPSBicm93c2VyR2xvYmFsLk11dGF0aW9uT2JzZXJ2ZXIgfHwgYnJvd3Nlckdsb2JhbC5XZWJLaXRNdXRhdGlvbk9ic2VydmVyO1xudmFyIGlzTm9kZSA9IHR5cGVvZiBzZWxmID09PSAndW5kZWZpbmVkJyAmJiB0eXBlb2YgcHJvY2VzcyAhPT0gJ3VuZGVmaW5lZCcgJiYgKHt9KS50b1N0cmluZy5jYWxsKHByb2Nlc3MpID09PSAnW29iamVjdCBwcm9jZXNzXSc7XG5cbi8vIHRlc3QgZm9yIHdlYiB3b3JrZXIgYnV0IG5vdCBpbiBJRTEwXG52YXIgaXNXb3JrZXIgPSB0eXBlb2YgVWludDhDbGFtcGVkQXJyYXkgIT09ICd1bmRlZmluZWQnICYmIHR5cGVvZiBpbXBvcnRTY3JpcHRzICE9PSAndW5kZWZpbmVkJyAmJiB0eXBlb2YgTWVzc2FnZUNoYW5uZWwgIT09ICd1bmRlZmluZWQnO1xuXG4vLyBub2RlXG5mdW5jdGlvbiB1c2VOZXh0VGljaygpIHtcbiAgLy8gbm9kZSB2ZXJzaW9uIDAuMTAueCBkaXNwbGF5cyBhIGRlcHJlY2F0aW9uIHdhcm5pbmcgd2hlbiBuZXh0VGljayBpcyB1c2VkIHJlY3Vyc2l2ZWx5XG4gIC8vIHNlZSBodHRwczovL2dpdGh1Yi5jb20vY3Vqb2pzL3doZW4vaXNzdWVzLzQxMCBmb3IgZGV0YWlsc1xuICByZXR1cm4gZnVuY3Rpb24gKCkge1xuICAgIHJldHVybiBwcm9jZXNzLm5leHRUaWNrKGZsdXNoKTtcbiAgfTtcbn1cblxuLy8gdmVydHhcbmZ1bmN0aW9uIHVzZVZlcnR4VGltZXIoKSB7XG4gIGlmICh0eXBlb2YgdmVydHhOZXh0ICE9PSAndW5kZWZpbmVkJykge1xuICAgIHJldHVybiBmdW5jdGlvbiAoKSB7XG4gICAgICB2ZXJ0eE5leHQoZmx1c2gpO1xuICAgIH07XG4gIH1cblxuICByZXR1cm4gdXNlU2V0VGltZW91dCgpO1xufVxuXG5mdW5jdGlvbiB1c2VNdXRhdGlvbk9ic2VydmVyKCkge1xuICB2YXIgaXRlcmF0aW9ucyA9IDA7XG4gIHZhciBvYnNlcnZlciA9IG5ldyBCcm93c2VyTXV0YXRpb25PYnNlcnZlcihmbHVzaCk7XG4gIHZhciBub2RlID0gZG9jdW1lbnQuY3JlYXRlVGV4dE5vZGUoJycpO1xuICBvYnNlcnZlci5vYnNlcnZlKG5vZGUsIHsgY2hhcmFjdGVyRGF0YTogdHJ1ZSB9KTtcblxuICByZXR1cm4gZnVuY3Rpb24gKCkge1xuICAgIG5vZGUuZGF0YSA9IGl0ZXJhdGlvbnMgPSArK2l0ZXJhdGlvbnMgJSAyO1xuICB9O1xufVxuXG4vLyB3ZWIgd29ya2VyXG5mdW5jdGlvbiB1c2VNZXNzYWdlQ2hhbm5lbCgpIHtcbiAgdmFyIGNoYW5uZWwgPSBuZXcgTWVzc2FnZUNoYW5uZWwoKTtcbiAgY2hhbm5lbC5wb3J0MS5vbm1lc3NhZ2UgPSBmbHVzaDtcbiAgcmV0dXJuIGZ1bmN0aW9uICgpIHtcbiAgICByZXR1cm4gY2hhbm5lbC5wb3J0Mi5wb3N0TWVzc2FnZSgwKTtcbiAgfTtcbn1cblxuZnVuY3Rpb24gdXNlU2V0VGltZW91dCgpIHtcbiAgLy8gU3RvcmUgc2V0VGltZW91dCByZWZlcmVuY2Ugc28gZXM2LXByb21pc2Ugd2lsbCBiZSB1bmFmZmVjdGVkIGJ5XG4gIC8vIG90aGVyIGNvZGUgbW9kaWZ5aW5nIHNldFRpbWVvdXQgKGxpa2Ugc2lub24udXNlRmFrZVRpbWVycygpKVxuICB2YXIgZ2xvYmFsU2V0VGltZW91dCA9IHNldFRpbWVvdXQ7XG4gIHJldHVybiBmdW5jdGlvbiAoKSB7XG4gICAgcmV0dXJuIGdsb2JhbFNldFRpbWVvdXQoZmx1c2gsIDEpO1xuICB9O1xufVxuXG52YXIgcXVldWUgPSBuZXcgQXJyYXkoMTAwMCk7XG5mdW5jdGlvbiBmbHVzaCgpIHtcbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBsZW47IGkgKz0gMikge1xuICAgIHZhciBjYWxsYmFjayA9IHF1ZXVlW2ldO1xuICAgIHZhciBhcmcgPSBxdWV1ZVtpICsgMV07XG5cbiAgICBjYWxsYmFjayhhcmcpO1xuXG4gICAgcXVldWVbaV0gPSB1bmRlZmluZWQ7XG4gICAgcXVldWVbaSArIDFdID0gdW5kZWZpbmVkO1xuICB9XG5cbiAgbGVuID0gMDtcbn1cblxuZnVuY3Rpb24gYXR0ZW1wdFZlcnR4KCkge1xuICB0cnkge1xuICAgIHZhciByID0gcmVxdWlyZTtcbiAgICB2YXIgdmVydHggPSByKCd2ZXJ0eCcpO1xuICAgIHZlcnR4TmV4dCA9IHZlcnR4LnJ1bk9uTG9vcCB8fCB2ZXJ0eC5ydW5PbkNvbnRleHQ7XG4gICAgcmV0dXJuIHVzZVZlcnR4VGltZXIoKTtcbiAgfSBjYXRjaCAoZSkge1xuICAgIHJldHVybiB1c2VTZXRUaW1lb3V0KCk7XG4gIH1cbn1cblxudmFyIHNjaGVkdWxlRmx1c2ggPSB1bmRlZmluZWQ7XG4vLyBEZWNpZGUgd2hhdCBhc3luYyBtZXRob2QgdG8gdXNlIHRvIHRyaWdnZXJpbmcgcHJvY2Vzc2luZyBvZiBxdWV1ZWQgY2FsbGJhY2tzOlxuaWYgKGlzTm9kZSkge1xuICBzY2hlZHVsZUZsdXNoID0gdXNlTmV4dFRpY2soKTtcbn0gZWxzZSBpZiAoQnJvd3Nlck11dGF0aW9uT2JzZXJ2ZXIpIHtcbiAgc2NoZWR1bGVGbHVzaCA9IHVzZU11dGF0aW9uT2JzZXJ2ZXIoKTtcbn0gZWxzZSBpZiAoaXNXb3JrZXIpIHtcbiAgc2NoZWR1bGVGbHVzaCA9IHVzZU1lc3NhZ2VDaGFubmVsKCk7XG59IGVsc2UgaWYgKGJyb3dzZXJXaW5kb3cgPT09IHVuZGVmaW5lZCAmJiB0eXBlb2YgcmVxdWlyZSA9PT0gJ2Z1bmN0aW9uJykge1xuICBzY2hlZHVsZUZsdXNoID0gYXR0ZW1wdFZlcnR4KCk7XG59IGVsc2Uge1xuICBzY2hlZHVsZUZsdXNoID0gdXNlU2V0VGltZW91dCgpO1xufVxuXG5mdW5jdGlvbiB0aGVuKG9uRnVsZmlsbG1lbnQsIG9uUmVqZWN0aW9uKSB7XG4gIHZhciBfYXJndW1lbnRzID0gYXJndW1lbnRzO1xuXG4gIHZhciBwYXJlbnQgPSB0aGlzO1xuXG4gIHZhciBjaGlsZCA9IG5ldyB0aGlzLmNvbnN0cnVjdG9yKG5vb3ApO1xuXG4gIGlmIChjaGlsZFtQUk9NSVNFX0lEXSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgbWFrZVByb21pc2UoY2hpbGQpO1xuICB9XG5cbiAgdmFyIF9zdGF0ZSA9IHBhcmVudC5fc3RhdGU7XG5cbiAgaWYgKF9zdGF0ZSkge1xuICAgIChmdW5jdGlvbiAoKSB7XG4gICAgICB2YXIgY2FsbGJhY2sgPSBfYXJndW1lbnRzW19zdGF0ZSAtIDFdO1xuICAgICAgYXNhcChmdW5jdGlvbiAoKSB7XG4gICAgICAgIHJldHVybiBpbnZva2VDYWxsYmFjayhfc3RhdGUsIGNoaWxkLCBjYWxsYmFjaywgcGFyZW50Ll9yZXN1bHQpO1xuICAgICAgfSk7XG4gICAgfSkoKTtcbiAgfSBlbHNlIHtcbiAgICBzdWJzY3JpYmUocGFyZW50LCBjaGlsZCwgb25GdWxmaWxsbWVudCwgb25SZWplY3Rpb24pO1xuICB9XG5cbiAgcmV0dXJuIGNoaWxkO1xufVxuXG4vKipcbiAgYFByb21pc2UucmVzb2x2ZWAgcmV0dXJucyBhIHByb21pc2UgdGhhdCB3aWxsIGJlY29tZSByZXNvbHZlZCB3aXRoIHRoZVxuICBwYXNzZWQgYHZhbHVlYC4gSXQgaXMgc2hvcnRoYW5kIGZvciB0aGUgZm9sbG93aW5nOlxuXG4gIGBgYGphdmFzY3JpcHRcbiAgbGV0IHByb21pc2UgPSBuZXcgUHJvbWlzZShmdW5jdGlvbihyZXNvbHZlLCByZWplY3Qpe1xuICAgIHJlc29sdmUoMSk7XG4gIH0pO1xuXG4gIHByb21pc2UudGhlbihmdW5jdGlvbih2YWx1ZSl7XG4gICAgLy8gdmFsdWUgPT09IDFcbiAgfSk7XG4gIGBgYFxuXG4gIEluc3RlYWQgb2Ygd3JpdGluZyB0aGUgYWJvdmUsIHlvdXIgY29kZSBub3cgc2ltcGx5IGJlY29tZXMgdGhlIGZvbGxvd2luZzpcblxuICBgYGBqYXZhc2NyaXB0XG4gIGxldCBwcm9taXNlID0gUHJvbWlzZS5yZXNvbHZlKDEpO1xuXG4gIHByb21pc2UudGhlbihmdW5jdGlvbih2YWx1ZSl7XG4gICAgLy8gdmFsdWUgPT09IDFcbiAgfSk7XG4gIGBgYFxuXG4gIEBtZXRob2QgcmVzb2x2ZVxuICBAc3RhdGljXG4gIEBwYXJhbSB7QW55fSB2YWx1ZSB2YWx1ZSB0aGF0IHRoZSByZXR1cm5lZCBwcm9taXNlIHdpbGwgYmUgcmVzb2x2ZWQgd2l0aFxuICBVc2VmdWwgZm9yIHRvb2xpbmcuXG4gIEByZXR1cm4ge1Byb21pc2V9IGEgcHJvbWlzZSB0aGF0IHdpbGwgYmVjb21lIGZ1bGZpbGxlZCB3aXRoIHRoZSBnaXZlblxuICBgdmFsdWVgXG4qL1xuZnVuY3Rpb24gcmVzb2x2ZSQxKG9iamVjdCkge1xuICAvKmpzaGludCB2YWxpZHRoaXM6dHJ1ZSAqL1xuICB2YXIgQ29uc3RydWN0b3IgPSB0aGlzO1xuXG4gIGlmIChvYmplY3QgJiYgdHlwZW9mIG9iamVjdCA9PT0gJ29iamVjdCcgJiYgb2JqZWN0LmNvbnN0cnVjdG9yID09PSBDb25zdHJ1Y3Rvcikge1xuICAgIHJldHVybiBvYmplY3Q7XG4gIH1cblxuICB2YXIgcHJvbWlzZSA9IG5ldyBDb25zdHJ1Y3Rvcihub29wKTtcbiAgcmVzb2x2ZShwcm9taXNlLCBvYmplY3QpO1xuICByZXR1cm4gcHJvbWlzZTtcbn1cblxudmFyIFBST01JU0VfSUQgPSBNYXRoLnJhbmRvbSgpLnRvU3RyaW5nKDM2KS5zdWJzdHJpbmcoMTYpO1xuXG5mdW5jdGlvbiBub29wKCkge31cblxudmFyIFBFTkRJTkcgPSB2b2lkIDA7XG52YXIgRlVMRklMTEVEID0gMTtcbnZhciBSRUpFQ1RFRCA9IDI7XG5cbnZhciBHRVRfVEhFTl9FUlJPUiA9IG5ldyBFcnJvck9iamVjdCgpO1xuXG5mdW5jdGlvbiBzZWxmRnVsZmlsbG1lbnQoKSB7XG4gIHJldHVybiBuZXcgVHlwZUVycm9yKFwiWW91IGNhbm5vdCByZXNvbHZlIGEgcHJvbWlzZSB3aXRoIGl0c2VsZlwiKTtcbn1cblxuZnVuY3Rpb24gY2Fubm90UmV0dXJuT3duKCkge1xuICByZXR1cm4gbmV3IFR5cGVFcnJvcignQSBwcm9taXNlcyBjYWxsYmFjayBjYW5ub3QgcmV0dXJuIHRoYXQgc2FtZSBwcm9taXNlLicpO1xufVxuXG5mdW5jdGlvbiBnZXRUaGVuKHByb21pc2UpIHtcbiAgdHJ5IHtcbiAgICByZXR1cm4gcHJvbWlzZS50aGVuO1xuICB9IGNhdGNoIChlcnJvcikge1xuICAgIEdFVF9USEVOX0VSUk9SLmVycm9yID0gZXJyb3I7XG4gICAgcmV0dXJuIEdFVF9USEVOX0VSUk9SO1xuICB9XG59XG5cbmZ1bmN0aW9uIHRyeVRoZW4odGhlbiQkMSwgdmFsdWUsIGZ1bGZpbGxtZW50SGFuZGxlciwgcmVqZWN0aW9uSGFuZGxlcikge1xuICB0cnkge1xuICAgIHRoZW4kJDEuY2FsbCh2YWx1ZSwgZnVsZmlsbG1lbnRIYW5kbGVyLCByZWplY3Rpb25IYW5kbGVyKTtcbiAgfSBjYXRjaCAoZSkge1xuICAgIHJldHVybiBlO1xuICB9XG59XG5cbmZ1bmN0aW9uIGhhbmRsZUZvcmVpZ25UaGVuYWJsZShwcm9taXNlLCB0aGVuYWJsZSwgdGhlbiQkMSkge1xuICBhc2FwKGZ1bmN0aW9uIChwcm9taXNlKSB7XG4gICAgdmFyIHNlYWxlZCA9IGZhbHNlO1xuICAgIHZhciBlcnJvciA9IHRyeVRoZW4odGhlbiQkMSwgdGhlbmFibGUsIGZ1bmN0aW9uICh2YWx1ZSkge1xuICAgICAgaWYgKHNlYWxlZCkge1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICBzZWFsZWQgPSB0cnVlO1xuICAgICAgaWYgKHRoZW5hYmxlICE9PSB2YWx1ZSkge1xuICAgICAgICByZXNvbHZlKHByb21pc2UsIHZhbHVlKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGZ1bGZpbGwocHJvbWlzZSwgdmFsdWUpO1xuICAgICAgfVxuICAgIH0sIGZ1bmN0aW9uIChyZWFzb24pIHtcbiAgICAgIGlmIChzZWFsZWQpIHtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgICAgc2VhbGVkID0gdHJ1ZTtcblxuICAgICAgcmVqZWN0KHByb21pc2UsIHJlYXNvbik7XG4gICAgfSwgJ1NldHRsZTogJyArIChwcm9taXNlLl9sYWJlbCB8fCAnIHVua25vd24gcHJvbWlzZScpKTtcblxuICAgIGlmICghc2VhbGVkICYmIGVycm9yKSB7XG4gICAgICBzZWFsZWQgPSB0cnVlO1xuICAgICAgcmVqZWN0KHByb21pc2UsIGVycm9yKTtcbiAgICB9XG4gIH0sIHByb21pc2UpO1xufVxuXG5mdW5jdGlvbiBoYW5kbGVPd25UaGVuYWJsZShwcm9taXNlLCB0aGVuYWJsZSkge1xuICBpZiAodGhlbmFibGUuX3N0YXRlID09PSBGVUxGSUxMRUQpIHtcbiAgICBmdWxmaWxsKHByb21pc2UsIHRoZW5hYmxlLl9yZXN1bHQpO1xuICB9IGVsc2UgaWYgKHRoZW5hYmxlLl9zdGF0ZSA9PT0gUkVKRUNURUQpIHtcbiAgICByZWplY3QocHJvbWlzZSwgdGhlbmFibGUuX3Jlc3VsdCk7XG4gIH0gZWxzZSB7XG4gICAgc3Vic2NyaWJlKHRoZW5hYmxlLCB1bmRlZmluZWQsIGZ1bmN0aW9uICh2YWx1ZSkge1xuICAgICAgcmV0dXJuIHJlc29sdmUocHJvbWlzZSwgdmFsdWUpO1xuICAgIH0sIGZ1bmN0aW9uIChyZWFzb24pIHtcbiAgICAgIHJldHVybiByZWplY3QocHJvbWlzZSwgcmVhc29uKTtcbiAgICB9KTtcbiAgfVxufVxuXG5mdW5jdGlvbiBoYW5kbGVNYXliZVRoZW5hYmxlKHByb21pc2UsIG1heWJlVGhlbmFibGUsIHRoZW4kJDEpIHtcbiAgaWYgKG1heWJlVGhlbmFibGUuY29uc3RydWN0b3IgPT09IHByb21pc2UuY29uc3RydWN0b3IgJiYgdGhlbiQkMSA9PT0gdGhlbiAmJiBtYXliZVRoZW5hYmxlLmNvbnN0cnVjdG9yLnJlc29sdmUgPT09IHJlc29sdmUkMSkge1xuICAgIGhhbmRsZU93blRoZW5hYmxlKHByb21pc2UsIG1heWJlVGhlbmFibGUpO1xuICB9IGVsc2Uge1xuICAgIGlmICh0aGVuJCQxID09PSBHRVRfVEhFTl9FUlJPUikge1xuICAgICAgcmVqZWN0KHByb21pc2UsIEdFVF9USEVOX0VSUk9SLmVycm9yKTtcbiAgICAgIEdFVF9USEVOX0VSUk9SLmVycm9yID0gbnVsbDtcbiAgICB9IGVsc2UgaWYgKHRoZW4kJDEgPT09IHVuZGVmaW5lZCkge1xuICAgICAgZnVsZmlsbChwcm9taXNlLCBtYXliZVRoZW5hYmxlKTtcbiAgICB9IGVsc2UgaWYgKGlzRnVuY3Rpb24odGhlbiQkMSkpIHtcbiAgICAgIGhhbmRsZUZvcmVpZ25UaGVuYWJsZShwcm9taXNlLCBtYXliZVRoZW5hYmxlLCB0aGVuJCQxKTtcbiAgICB9IGVsc2Uge1xuICAgICAgZnVsZmlsbChwcm9taXNlLCBtYXliZVRoZW5hYmxlKTtcbiAgICB9XG4gIH1cbn1cblxuZnVuY3Rpb24gcmVzb2x2ZShwcm9taXNlLCB2YWx1ZSkge1xuICBpZiAocHJvbWlzZSA9PT0gdmFsdWUpIHtcbiAgICByZWplY3QocHJvbWlzZSwgc2VsZkZ1bGZpbGxtZW50KCkpO1xuICB9IGVsc2UgaWYgKG9iamVjdE9yRnVuY3Rpb24odmFsdWUpKSB7XG4gICAgaGFuZGxlTWF5YmVUaGVuYWJsZShwcm9taXNlLCB2YWx1ZSwgZ2V0VGhlbih2YWx1ZSkpO1xuICB9IGVsc2Uge1xuICAgIGZ1bGZpbGwocHJvbWlzZSwgdmFsdWUpO1xuICB9XG59XG5cbmZ1bmN0aW9uIHB1Ymxpc2hSZWplY3Rpb24ocHJvbWlzZSkge1xuICBpZiAocHJvbWlzZS5fb25lcnJvcikge1xuICAgIHByb21pc2UuX29uZXJyb3IocHJvbWlzZS5fcmVzdWx0KTtcbiAgfVxuXG4gIHB1Ymxpc2gocHJvbWlzZSk7XG59XG5cbmZ1bmN0aW9uIGZ1bGZpbGwocHJvbWlzZSwgdmFsdWUpIHtcbiAgaWYgKHByb21pc2UuX3N0YXRlICE9PSBQRU5ESU5HKSB7XG4gICAgcmV0dXJuO1xuICB9XG5cbiAgcHJvbWlzZS5fcmVzdWx0ID0gdmFsdWU7XG4gIHByb21pc2UuX3N0YXRlID0gRlVMRklMTEVEO1xuXG4gIGlmIChwcm9taXNlLl9zdWJzY3JpYmVycy5sZW5ndGggIT09IDApIHtcbiAgICBhc2FwKHB1Ymxpc2gsIHByb21pc2UpO1xuICB9XG59XG5cbmZ1bmN0aW9uIHJlamVjdChwcm9taXNlLCByZWFzb24pIHtcbiAgaWYgKHByb21pc2UuX3N0YXRlICE9PSBQRU5ESU5HKSB7XG4gICAgcmV0dXJuO1xuICB9XG4gIHByb21pc2UuX3N0YXRlID0gUkVKRUNURUQ7XG4gIHByb21pc2UuX3Jlc3VsdCA9IHJlYXNvbjtcblxuICBhc2FwKHB1Ymxpc2hSZWplY3Rpb24sIHByb21pc2UpO1xufVxuXG5mdW5jdGlvbiBzdWJzY3JpYmUocGFyZW50LCBjaGlsZCwgb25GdWxmaWxsbWVudCwgb25SZWplY3Rpb24pIHtcbiAgdmFyIF9zdWJzY3JpYmVycyA9IHBhcmVudC5fc3Vic2NyaWJlcnM7XG4gIHZhciBsZW5ndGggPSBfc3Vic2NyaWJlcnMubGVuZ3RoO1xuXG4gIHBhcmVudC5fb25lcnJvciA9IG51bGw7XG5cbiAgX3N1YnNjcmliZXJzW2xlbmd0aF0gPSBjaGlsZDtcbiAgX3N1YnNjcmliZXJzW2xlbmd0aCArIEZVTEZJTExFRF0gPSBvbkZ1bGZpbGxtZW50O1xuICBfc3Vic2NyaWJlcnNbbGVuZ3RoICsgUkVKRUNURURdID0gb25SZWplY3Rpb247XG5cbiAgaWYgKGxlbmd0aCA9PT0gMCAmJiBwYXJlbnQuX3N0YXRlKSB7XG4gICAgYXNhcChwdWJsaXNoLCBwYXJlbnQpO1xuICB9XG59XG5cbmZ1bmN0aW9uIHB1Ymxpc2gocHJvbWlzZSkge1xuICB2YXIgc3Vic2NyaWJlcnMgPSBwcm9taXNlLl9zdWJzY3JpYmVycztcbiAgdmFyIHNldHRsZWQgPSBwcm9taXNlLl9zdGF0ZTtcblxuICBpZiAoc3Vic2NyaWJlcnMubGVuZ3RoID09PSAwKSB7XG4gICAgcmV0dXJuO1xuICB9XG5cbiAgdmFyIGNoaWxkID0gdW5kZWZpbmVkLFxuICAgICAgY2FsbGJhY2sgPSB1bmRlZmluZWQsXG4gICAgICBkZXRhaWwgPSBwcm9taXNlLl9yZXN1bHQ7XG5cbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBzdWJzY3JpYmVycy5sZW5ndGg7IGkgKz0gMykge1xuICAgIGNoaWxkID0gc3Vic2NyaWJlcnNbaV07XG4gICAgY2FsbGJhY2sgPSBzdWJzY3JpYmVyc1tpICsgc2V0dGxlZF07XG5cbiAgICBpZiAoY2hpbGQpIHtcbiAgICAgIGludm9rZUNhbGxiYWNrKHNldHRsZWQsIGNoaWxkLCBjYWxsYmFjaywgZGV0YWlsKTtcbiAgICB9IGVsc2Uge1xuICAgICAgY2FsbGJhY2soZGV0YWlsKTtcbiAgICB9XG4gIH1cblxuICBwcm9taXNlLl9zdWJzY3JpYmVycy5sZW5ndGggPSAwO1xufVxuXG5mdW5jdGlvbiBFcnJvck9iamVjdCgpIHtcbiAgdGhpcy5lcnJvciA9IG51bGw7XG59XG5cbnZhciBUUllfQ0FUQ0hfRVJST1IgPSBuZXcgRXJyb3JPYmplY3QoKTtcblxuZnVuY3Rpb24gdHJ5Q2F0Y2goY2FsbGJhY2ssIGRldGFpbCkge1xuICB0cnkge1xuICAgIHJldHVybiBjYWxsYmFjayhkZXRhaWwpO1xuICB9IGNhdGNoIChlKSB7XG4gICAgVFJZX0NBVENIX0VSUk9SLmVycm9yID0gZTtcbiAgICByZXR1cm4gVFJZX0NBVENIX0VSUk9SO1xuICB9XG59XG5cbmZ1bmN0aW9uIGludm9rZUNhbGxiYWNrKHNldHRsZWQsIHByb21pc2UsIGNhbGxiYWNrLCBkZXRhaWwpIHtcbiAgdmFyIGhhc0NhbGxiYWNrID0gaXNGdW5jdGlvbihjYWxsYmFjayksXG4gICAgICB2YWx1ZSA9IHVuZGVmaW5lZCxcbiAgICAgIGVycm9yID0gdW5kZWZpbmVkLFxuICAgICAgc3VjY2VlZGVkID0gdW5kZWZpbmVkLFxuICAgICAgZmFpbGVkID0gdW5kZWZpbmVkO1xuXG4gIGlmIChoYXNDYWxsYmFjaykge1xuICAgIHZhbHVlID0gdHJ5Q2F0Y2goY2FsbGJhY2ssIGRldGFpbCk7XG5cbiAgICBpZiAodmFsdWUgPT09IFRSWV9DQVRDSF9FUlJPUikge1xuICAgICAgZmFpbGVkID0gdHJ1ZTtcbiAgICAgIGVycm9yID0gdmFsdWUuZXJyb3I7XG4gICAgICB2YWx1ZS5lcnJvciA9IG51bGw7XG4gICAgfSBlbHNlIHtcbiAgICAgIHN1Y2NlZWRlZCA9IHRydWU7XG4gICAgfVxuXG4gICAgaWYgKHByb21pc2UgPT09IHZhbHVlKSB7XG4gICAgICByZWplY3QocHJvbWlzZSwgY2Fubm90UmV0dXJuT3duKCkpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgfSBlbHNlIHtcbiAgICB2YWx1ZSA9IGRldGFpbDtcbiAgICBzdWNjZWVkZWQgPSB0cnVlO1xuICB9XG5cbiAgaWYgKHByb21pc2UuX3N0YXRlICE9PSBQRU5ESU5HKSB7XG4gICAgLy8gbm9vcFxuICB9IGVsc2UgaWYgKGhhc0NhbGxiYWNrICYmIHN1Y2NlZWRlZCkge1xuICAgICAgcmVzb2x2ZShwcm9taXNlLCB2YWx1ZSk7XG4gICAgfSBlbHNlIGlmIChmYWlsZWQpIHtcbiAgICAgIHJlamVjdChwcm9taXNlLCBlcnJvcik7XG4gICAgfSBlbHNlIGlmIChzZXR0bGVkID09PSBGVUxGSUxMRUQpIHtcbiAgICAgIGZ1bGZpbGwocHJvbWlzZSwgdmFsdWUpO1xuICAgIH0gZWxzZSBpZiAoc2V0dGxlZCA9PT0gUkVKRUNURUQpIHtcbiAgICAgIHJlamVjdChwcm9taXNlLCB2YWx1ZSk7XG4gICAgfVxufVxuXG5mdW5jdGlvbiBpbml0aWFsaXplUHJvbWlzZShwcm9taXNlLCByZXNvbHZlcikge1xuICB0cnkge1xuICAgIHJlc29sdmVyKGZ1bmN0aW9uIHJlc29sdmVQcm9taXNlKHZhbHVlKSB7XG4gICAgICByZXNvbHZlKHByb21pc2UsIHZhbHVlKTtcbiAgICB9LCBmdW5jdGlvbiByZWplY3RQcm9taXNlKHJlYXNvbikge1xuICAgICAgcmVqZWN0KHByb21pc2UsIHJlYXNvbik7XG4gICAgfSk7XG4gIH0gY2F0Y2ggKGUpIHtcbiAgICByZWplY3QocHJvbWlzZSwgZSk7XG4gIH1cbn1cblxudmFyIGlkID0gMDtcbmZ1bmN0aW9uIG5leHRJZCgpIHtcbiAgcmV0dXJuIGlkKys7XG59XG5cbmZ1bmN0aW9uIG1ha2VQcm9taXNlKHByb21pc2UpIHtcbiAgcHJvbWlzZVtQUk9NSVNFX0lEXSA9IGlkKys7XG4gIHByb21pc2UuX3N0YXRlID0gdW5kZWZpbmVkO1xuICBwcm9taXNlLl9yZXN1bHQgPSB1bmRlZmluZWQ7XG4gIHByb21pc2UuX3N1YnNjcmliZXJzID0gW107XG59XG5cbmZ1bmN0aW9uIEVudW1lcmF0b3IkMShDb25zdHJ1Y3RvciwgaW5wdXQpIHtcbiAgdGhpcy5faW5zdGFuY2VDb25zdHJ1Y3RvciA9IENvbnN0cnVjdG9yO1xuICB0aGlzLnByb21pc2UgPSBuZXcgQ29uc3RydWN0b3Iobm9vcCk7XG5cbiAgaWYgKCF0aGlzLnByb21pc2VbUFJPTUlTRV9JRF0pIHtcbiAgICBtYWtlUHJvbWlzZSh0aGlzLnByb21pc2UpO1xuICB9XG5cbiAgaWYgKGlzQXJyYXkoaW5wdXQpKSB7XG4gICAgdGhpcy5sZW5ndGggPSBpbnB1dC5sZW5ndGg7XG4gICAgdGhpcy5fcmVtYWluaW5nID0gaW5wdXQubGVuZ3RoO1xuXG4gICAgdGhpcy5fcmVzdWx0ID0gbmV3IEFycmF5KHRoaXMubGVuZ3RoKTtcblxuICAgIGlmICh0aGlzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgZnVsZmlsbCh0aGlzLnByb21pc2UsIHRoaXMuX3Jlc3VsdCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMubGVuZ3RoID0gdGhpcy5sZW5ndGggfHwgMDtcbiAgICAgIHRoaXMuX2VudW1lcmF0ZShpbnB1dCk7XG4gICAgICBpZiAodGhpcy5fcmVtYWluaW5nID09PSAwKSB7XG4gICAgICAgIGZ1bGZpbGwodGhpcy5wcm9taXNlLCB0aGlzLl9yZXN1bHQpO1xuICAgICAgfVxuICAgIH1cbiAgfSBlbHNlIHtcbiAgICByZWplY3QodGhpcy5wcm9taXNlLCB2YWxpZGF0aW9uRXJyb3IoKSk7XG4gIH1cbn1cblxuZnVuY3Rpb24gdmFsaWRhdGlvbkVycm9yKCkge1xuICByZXR1cm4gbmV3IEVycm9yKCdBcnJheSBNZXRob2RzIG11c3QgYmUgcHJvdmlkZWQgYW4gQXJyYXknKTtcbn1cblxuRW51bWVyYXRvciQxLnByb3RvdHlwZS5fZW51bWVyYXRlID0gZnVuY3Rpb24gKGlucHV0KSB7XG4gIGZvciAodmFyIGkgPSAwOyB0aGlzLl9zdGF0ZSA9PT0gUEVORElORyAmJiBpIDwgaW5wdXQubGVuZ3RoOyBpKyspIHtcbiAgICB0aGlzLl9lYWNoRW50cnkoaW5wdXRbaV0sIGkpO1xuICB9XG59O1xuXG5FbnVtZXJhdG9yJDEucHJvdG90eXBlLl9lYWNoRW50cnkgPSBmdW5jdGlvbiAoZW50cnksIGkpIHtcbiAgdmFyIGMgPSB0aGlzLl9pbnN0YW5jZUNvbnN0cnVjdG9yO1xuICB2YXIgcmVzb2x2ZSQkMSA9IGMucmVzb2x2ZTtcblxuICBpZiAocmVzb2x2ZSQkMSA9PT0gcmVzb2x2ZSQxKSB7XG4gICAgdmFyIF90aGVuID0gZ2V0VGhlbihlbnRyeSk7XG5cbiAgICBpZiAoX3RoZW4gPT09IHRoZW4gJiYgZW50cnkuX3N0YXRlICE9PSBQRU5ESU5HKSB7XG4gICAgICB0aGlzLl9zZXR0bGVkQXQoZW50cnkuX3N0YXRlLCBpLCBlbnRyeS5fcmVzdWx0KTtcbiAgICB9IGVsc2UgaWYgKHR5cGVvZiBfdGhlbiAhPT0gJ2Z1bmN0aW9uJykge1xuICAgICAgdGhpcy5fcmVtYWluaW5nLS07XG4gICAgICB0aGlzLl9yZXN1bHRbaV0gPSBlbnRyeTtcbiAgICB9IGVsc2UgaWYgKGMgPT09IFByb21pc2UkMikge1xuICAgICAgdmFyIHByb21pc2UgPSBuZXcgYyhub29wKTtcbiAgICAgIGhhbmRsZU1heWJlVGhlbmFibGUocHJvbWlzZSwgZW50cnksIF90aGVuKTtcbiAgICAgIHRoaXMuX3dpbGxTZXR0bGVBdChwcm9taXNlLCBpKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5fd2lsbFNldHRsZUF0KG5ldyBjKGZ1bmN0aW9uIChyZXNvbHZlJCQxKSB7XG4gICAgICAgIHJldHVybiByZXNvbHZlJCQxKGVudHJ5KTtcbiAgICAgIH0pLCBpKTtcbiAgICB9XG4gIH0gZWxzZSB7XG4gICAgdGhpcy5fd2lsbFNldHRsZUF0KHJlc29sdmUkJDEoZW50cnkpLCBpKTtcbiAgfVxufTtcblxuRW51bWVyYXRvciQxLnByb3RvdHlwZS5fc2V0dGxlZEF0ID0gZnVuY3Rpb24gKHN0YXRlLCBpLCB2YWx1ZSkge1xuICB2YXIgcHJvbWlzZSA9IHRoaXMucHJvbWlzZTtcblxuICBpZiAocHJvbWlzZS5fc3RhdGUgPT09IFBFTkRJTkcpIHtcbiAgICB0aGlzLl9yZW1haW5pbmctLTtcblxuICAgIGlmIChzdGF0ZSA9PT0gUkVKRUNURUQpIHtcbiAgICAgIHJlamVjdChwcm9taXNlLCB2YWx1ZSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMuX3Jlc3VsdFtpXSA9IHZhbHVlO1xuICAgIH1cbiAgfVxuXG4gIGlmICh0aGlzLl9yZW1haW5pbmcgPT09IDApIHtcbiAgICBmdWxmaWxsKHByb21pc2UsIHRoaXMuX3Jlc3VsdCk7XG4gIH1cbn07XG5cbkVudW1lcmF0b3IkMS5wcm90b3R5cGUuX3dpbGxTZXR0bGVBdCA9IGZ1bmN0aW9uIChwcm9taXNlLCBpKSB7XG4gIHZhciBlbnVtZXJhdG9yID0gdGhpcztcblxuICBzdWJzY3JpYmUocHJvbWlzZSwgdW5kZWZpbmVkLCBmdW5jdGlvbiAodmFsdWUpIHtcbiAgICByZXR1cm4gZW51bWVyYXRvci5fc2V0dGxlZEF0KEZVTEZJTExFRCwgaSwgdmFsdWUpO1xuICB9LCBmdW5jdGlvbiAocmVhc29uKSB7XG4gICAgcmV0dXJuIGVudW1lcmF0b3IuX3NldHRsZWRBdChSRUpFQ1RFRCwgaSwgcmVhc29uKTtcbiAgfSk7XG59O1xuXG4vKipcbiAgYFByb21pc2UuYWxsYCBhY2NlcHRzIGFuIGFycmF5IG9mIHByb21pc2VzLCBhbmQgcmV0dXJucyBhIG5ldyBwcm9taXNlIHdoaWNoXG4gIGlzIGZ1bGZpbGxlZCB3aXRoIGFuIGFycmF5IG9mIGZ1bGZpbGxtZW50IHZhbHVlcyBmb3IgdGhlIHBhc3NlZCBwcm9taXNlcywgb3JcbiAgcmVqZWN0ZWQgd2l0aCB0aGUgcmVhc29uIG9mIHRoZSBmaXJzdCBwYXNzZWQgcHJvbWlzZSB0byBiZSByZWplY3RlZC4gSXQgY2FzdHMgYWxsXG4gIGVsZW1lbnRzIG9mIHRoZSBwYXNzZWQgaXRlcmFibGUgdG8gcHJvbWlzZXMgYXMgaXQgcnVucyB0aGlzIGFsZ29yaXRobS5cblxuICBFeGFtcGxlOlxuXG4gIGBgYGphdmFzY3JpcHRcbiAgbGV0IHByb21pc2UxID0gcmVzb2x2ZSgxKTtcbiAgbGV0IHByb21pc2UyID0gcmVzb2x2ZSgyKTtcbiAgbGV0IHByb21pc2UzID0gcmVzb2x2ZSgzKTtcbiAgbGV0IHByb21pc2VzID0gWyBwcm9taXNlMSwgcHJvbWlzZTIsIHByb21pc2UzIF07XG5cbiAgUHJvbWlzZS5hbGwocHJvbWlzZXMpLnRoZW4oZnVuY3Rpb24oYXJyYXkpe1xuICAgIC8vIFRoZSBhcnJheSBoZXJlIHdvdWxkIGJlIFsgMSwgMiwgMyBdO1xuICB9KTtcbiAgYGBgXG5cbiAgSWYgYW55IG9mIHRoZSBgcHJvbWlzZXNgIGdpdmVuIHRvIGBhbGxgIGFyZSByZWplY3RlZCwgdGhlIGZpcnN0IHByb21pc2VcbiAgdGhhdCBpcyByZWplY3RlZCB3aWxsIGJlIGdpdmVuIGFzIGFuIGFyZ3VtZW50IHRvIHRoZSByZXR1cm5lZCBwcm9taXNlcydzXG4gIHJlamVjdGlvbiBoYW5kbGVyLiBGb3IgZXhhbXBsZTpcblxuICBFeGFtcGxlOlxuXG4gIGBgYGphdmFzY3JpcHRcbiAgbGV0IHByb21pc2UxID0gcmVzb2x2ZSgxKTtcbiAgbGV0IHByb21pc2UyID0gcmVqZWN0KG5ldyBFcnJvcihcIjJcIikpO1xuICBsZXQgcHJvbWlzZTMgPSByZWplY3QobmV3IEVycm9yKFwiM1wiKSk7XG4gIGxldCBwcm9taXNlcyA9IFsgcHJvbWlzZTEsIHByb21pc2UyLCBwcm9taXNlMyBdO1xuXG4gIFByb21pc2UuYWxsKHByb21pc2VzKS50aGVuKGZ1bmN0aW9uKGFycmF5KXtcbiAgICAvLyBDb2RlIGhlcmUgbmV2ZXIgcnVucyBiZWNhdXNlIHRoZXJlIGFyZSByZWplY3RlZCBwcm9taXNlcyFcbiAgfSwgZnVuY3Rpb24oZXJyb3IpIHtcbiAgICAvLyBlcnJvci5tZXNzYWdlID09PSBcIjJcIlxuICB9KTtcbiAgYGBgXG5cbiAgQG1ldGhvZCBhbGxcbiAgQHN0YXRpY1xuICBAcGFyYW0ge0FycmF5fSBlbnRyaWVzIGFycmF5IG9mIHByb21pc2VzXG4gIEBwYXJhbSB7U3RyaW5nfSBsYWJlbCBvcHRpb25hbCBzdHJpbmcgZm9yIGxhYmVsaW5nIHRoZSBwcm9taXNlLlxuICBVc2VmdWwgZm9yIHRvb2xpbmcuXG4gIEByZXR1cm4ge1Byb21pc2V9IHByb21pc2UgdGhhdCBpcyBmdWxmaWxsZWQgd2hlbiBhbGwgYHByb21pc2VzYCBoYXZlIGJlZW5cbiAgZnVsZmlsbGVkLCBvciByZWplY3RlZCBpZiBhbnkgb2YgdGhlbSBiZWNvbWUgcmVqZWN0ZWQuXG4gIEBzdGF0aWNcbiovXG5mdW5jdGlvbiBhbGwkMShlbnRyaWVzKSB7XG4gIHJldHVybiBuZXcgRW51bWVyYXRvciQxKHRoaXMsIGVudHJpZXMpLnByb21pc2U7XG59XG5cbi8qKlxuICBgUHJvbWlzZS5yYWNlYCByZXR1cm5zIGEgbmV3IHByb21pc2Ugd2hpY2ggaXMgc2V0dGxlZCBpbiB0aGUgc2FtZSB3YXkgYXMgdGhlXG4gIGZpcnN0IHBhc3NlZCBwcm9taXNlIHRvIHNldHRsZS5cblxuICBFeGFtcGxlOlxuXG4gIGBgYGphdmFzY3JpcHRcbiAgbGV0IHByb21pc2UxID0gbmV3IFByb21pc2UoZnVuY3Rpb24ocmVzb2x2ZSwgcmVqZWN0KXtcbiAgICBzZXRUaW1lb3V0KGZ1bmN0aW9uKCl7XG4gICAgICByZXNvbHZlKCdwcm9taXNlIDEnKTtcbiAgICB9LCAyMDApO1xuICB9KTtcblxuICBsZXQgcHJvbWlzZTIgPSBuZXcgUHJvbWlzZShmdW5jdGlvbihyZXNvbHZlLCByZWplY3Qpe1xuICAgIHNldFRpbWVvdXQoZnVuY3Rpb24oKXtcbiAgICAgIHJlc29sdmUoJ3Byb21pc2UgMicpO1xuICAgIH0sIDEwMCk7XG4gIH0pO1xuXG4gIFByb21pc2UucmFjZShbcHJvbWlzZTEsIHByb21pc2UyXSkudGhlbihmdW5jdGlvbihyZXN1bHQpe1xuICAgIC8vIHJlc3VsdCA9PT0gJ3Byb21pc2UgMicgYmVjYXVzZSBpdCB3YXMgcmVzb2x2ZWQgYmVmb3JlIHByb21pc2UxXG4gICAgLy8gd2FzIHJlc29sdmVkLlxuICB9KTtcbiAgYGBgXG5cbiAgYFByb21pc2UucmFjZWAgaXMgZGV0ZXJtaW5pc3RpYyBpbiB0aGF0IG9ubHkgdGhlIHN0YXRlIG9mIHRoZSBmaXJzdFxuICBzZXR0bGVkIHByb21pc2UgbWF0dGVycy4gRm9yIGV4YW1wbGUsIGV2ZW4gaWYgb3RoZXIgcHJvbWlzZXMgZ2l2ZW4gdG8gdGhlXG4gIGBwcm9taXNlc2AgYXJyYXkgYXJndW1lbnQgYXJlIHJlc29sdmVkLCBidXQgdGhlIGZpcnN0IHNldHRsZWQgcHJvbWlzZSBoYXNcbiAgYmVjb21lIHJlamVjdGVkIGJlZm9yZSB0aGUgb3RoZXIgcHJvbWlzZXMgYmVjYW1lIGZ1bGZpbGxlZCwgdGhlIHJldHVybmVkXG4gIHByb21pc2Ugd2lsbCBiZWNvbWUgcmVqZWN0ZWQ6XG5cbiAgYGBgamF2YXNjcmlwdFxuICBsZXQgcHJvbWlzZTEgPSBuZXcgUHJvbWlzZShmdW5jdGlvbihyZXNvbHZlLCByZWplY3Qpe1xuICAgIHNldFRpbWVvdXQoZnVuY3Rpb24oKXtcbiAgICAgIHJlc29sdmUoJ3Byb21pc2UgMScpO1xuICAgIH0sIDIwMCk7XG4gIH0pO1xuXG4gIGxldCBwcm9taXNlMiA9IG5ldyBQcm9taXNlKGZ1bmN0aW9uKHJlc29sdmUsIHJlamVjdCl7XG4gICAgc2V0VGltZW91dChmdW5jdGlvbigpe1xuICAgICAgcmVqZWN0KG5ldyBFcnJvcigncHJvbWlzZSAyJykpO1xuICAgIH0sIDEwMCk7XG4gIH0pO1xuXG4gIFByb21pc2UucmFjZShbcHJvbWlzZTEsIHByb21pc2UyXSkudGhlbihmdW5jdGlvbihyZXN1bHQpe1xuICAgIC8vIENvZGUgaGVyZSBuZXZlciBydW5zXG4gIH0sIGZ1bmN0aW9uKHJlYXNvbil7XG4gICAgLy8gcmVhc29uLm1lc3NhZ2UgPT09ICdwcm9taXNlIDInIGJlY2F1c2UgcHJvbWlzZSAyIGJlY2FtZSByZWplY3RlZCBiZWZvcmVcbiAgICAvLyBwcm9taXNlIDEgYmVjYW1lIGZ1bGZpbGxlZFxuICB9KTtcbiAgYGBgXG5cbiAgQW4gZXhhbXBsZSByZWFsLXdvcmxkIHVzZSBjYXNlIGlzIGltcGxlbWVudGluZyB0aW1lb3V0czpcblxuICBgYGBqYXZhc2NyaXB0XG4gIFByb21pc2UucmFjZShbYWpheCgnZm9vLmpzb24nKSwgdGltZW91dCg1MDAwKV0pXG4gIGBgYFxuXG4gIEBtZXRob2QgcmFjZVxuICBAc3RhdGljXG4gIEBwYXJhbSB7QXJyYXl9IHByb21pc2VzIGFycmF5IG9mIHByb21pc2VzIHRvIG9ic2VydmVcbiAgVXNlZnVsIGZvciB0b29saW5nLlxuICBAcmV0dXJuIHtQcm9taXNlfSBhIHByb21pc2Ugd2hpY2ggc2V0dGxlcyBpbiB0aGUgc2FtZSB3YXkgYXMgdGhlIGZpcnN0IHBhc3NlZFxuICBwcm9taXNlIHRvIHNldHRsZS5cbiovXG5mdW5jdGlvbiByYWNlJDEoZW50cmllcykge1xuICAvKmpzaGludCB2YWxpZHRoaXM6dHJ1ZSAqL1xuICB2YXIgQ29uc3RydWN0b3IgPSB0aGlzO1xuXG4gIGlmICghaXNBcnJheShlbnRyaWVzKSkge1xuICAgIHJldHVybiBuZXcgQ29uc3RydWN0b3IoZnVuY3Rpb24gKF8sIHJlamVjdCkge1xuICAgICAgcmV0dXJuIHJlamVjdChuZXcgVHlwZUVycm9yKCdZb3UgbXVzdCBwYXNzIGFuIGFycmF5IHRvIHJhY2UuJykpO1xuICAgIH0pO1xuICB9IGVsc2Uge1xuICAgIHJldHVybiBuZXcgQ29uc3RydWN0b3IoZnVuY3Rpb24gKHJlc29sdmUsIHJlamVjdCkge1xuICAgICAgdmFyIGxlbmd0aCA9IGVudHJpZXMubGVuZ3RoO1xuICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBsZW5ndGg7IGkrKykge1xuICAgICAgICBDb25zdHJ1Y3Rvci5yZXNvbHZlKGVudHJpZXNbaV0pLnRoZW4ocmVzb2x2ZSwgcmVqZWN0KTtcbiAgICAgIH1cbiAgICB9KTtcbiAgfVxufVxuXG4vKipcbiAgYFByb21pc2UucmVqZWN0YCByZXR1cm5zIGEgcHJvbWlzZSByZWplY3RlZCB3aXRoIHRoZSBwYXNzZWQgYHJlYXNvbmAuXG4gIEl0IGlzIHNob3J0aGFuZCBmb3IgdGhlIGZvbGxvd2luZzpcblxuICBgYGBqYXZhc2NyaXB0XG4gIGxldCBwcm9taXNlID0gbmV3IFByb21pc2UoZnVuY3Rpb24ocmVzb2x2ZSwgcmVqZWN0KXtcbiAgICByZWplY3QobmV3IEVycm9yKCdXSE9PUFMnKSk7XG4gIH0pO1xuXG4gIHByb21pc2UudGhlbihmdW5jdGlvbih2YWx1ZSl7XG4gICAgLy8gQ29kZSBoZXJlIGRvZXNuJ3QgcnVuIGJlY2F1c2UgdGhlIHByb21pc2UgaXMgcmVqZWN0ZWQhXG4gIH0sIGZ1bmN0aW9uKHJlYXNvbil7XG4gICAgLy8gcmVhc29uLm1lc3NhZ2UgPT09ICdXSE9PUFMnXG4gIH0pO1xuICBgYGBcblxuICBJbnN0ZWFkIG9mIHdyaXRpbmcgdGhlIGFib3ZlLCB5b3VyIGNvZGUgbm93IHNpbXBseSBiZWNvbWVzIHRoZSBmb2xsb3dpbmc6XG5cbiAgYGBgamF2YXNjcmlwdFxuICBsZXQgcHJvbWlzZSA9IFByb21pc2UucmVqZWN0KG5ldyBFcnJvcignV0hPT1BTJykpO1xuXG4gIHByb21pc2UudGhlbihmdW5jdGlvbih2YWx1ZSl7XG4gICAgLy8gQ29kZSBoZXJlIGRvZXNuJ3QgcnVuIGJlY2F1c2UgdGhlIHByb21pc2UgaXMgcmVqZWN0ZWQhXG4gIH0sIGZ1bmN0aW9uKHJlYXNvbil7XG4gICAgLy8gcmVhc29uLm1lc3NhZ2UgPT09ICdXSE9PUFMnXG4gIH0pO1xuICBgYGBcblxuICBAbWV0aG9kIHJlamVjdFxuICBAc3RhdGljXG4gIEBwYXJhbSB7QW55fSByZWFzb24gdmFsdWUgdGhhdCB0aGUgcmV0dXJuZWQgcHJvbWlzZSB3aWxsIGJlIHJlamVjdGVkIHdpdGguXG4gIFVzZWZ1bCBmb3IgdG9vbGluZy5cbiAgQHJldHVybiB7UHJvbWlzZX0gYSBwcm9taXNlIHJlamVjdGVkIHdpdGggdGhlIGdpdmVuIGByZWFzb25gLlxuKi9cbmZ1bmN0aW9uIHJlamVjdCQxKHJlYXNvbikge1xuICAvKmpzaGludCB2YWxpZHRoaXM6dHJ1ZSAqL1xuICB2YXIgQ29uc3RydWN0b3IgPSB0aGlzO1xuICB2YXIgcHJvbWlzZSA9IG5ldyBDb25zdHJ1Y3Rvcihub29wKTtcbiAgcmVqZWN0KHByb21pc2UsIHJlYXNvbik7XG4gIHJldHVybiBwcm9taXNlO1xufVxuXG5mdW5jdGlvbiBuZWVkc1Jlc29sdmVyKCkge1xuICB0aHJvdyBuZXcgVHlwZUVycm9yKCdZb3UgbXVzdCBwYXNzIGEgcmVzb2x2ZXIgZnVuY3Rpb24gYXMgdGhlIGZpcnN0IGFyZ3VtZW50IHRvIHRoZSBwcm9taXNlIGNvbnN0cnVjdG9yJyk7XG59XG5cbmZ1bmN0aW9uIG5lZWRzTmV3KCkge1xuICB0aHJvdyBuZXcgVHlwZUVycm9yKFwiRmFpbGVkIHRvIGNvbnN0cnVjdCAnUHJvbWlzZSc6IFBsZWFzZSB1c2UgdGhlICduZXcnIG9wZXJhdG9yLCB0aGlzIG9iamVjdCBjb25zdHJ1Y3RvciBjYW5ub3QgYmUgY2FsbGVkIGFzIGEgZnVuY3Rpb24uXCIpO1xufVxuXG4vKipcbiAgUHJvbWlzZSBvYmplY3RzIHJlcHJlc2VudCB0aGUgZXZlbnR1YWwgcmVzdWx0IG9mIGFuIGFzeW5jaHJvbm91cyBvcGVyYXRpb24uIFRoZVxuICBwcmltYXJ5IHdheSBvZiBpbnRlcmFjdGluZyB3aXRoIGEgcHJvbWlzZSBpcyB0aHJvdWdoIGl0cyBgdGhlbmAgbWV0aG9kLCB3aGljaFxuICByZWdpc3RlcnMgY2FsbGJhY2tzIHRvIHJlY2VpdmUgZWl0aGVyIGEgcHJvbWlzZSdzIGV2ZW50dWFsIHZhbHVlIG9yIHRoZSByZWFzb25cbiAgd2h5IHRoZSBwcm9taXNlIGNhbm5vdCBiZSBmdWxmaWxsZWQuXG5cbiAgVGVybWlub2xvZ3lcbiAgLS0tLS0tLS0tLS1cblxuICAtIGBwcm9taXNlYCBpcyBhbiBvYmplY3Qgb3IgZnVuY3Rpb24gd2l0aCBhIGB0aGVuYCBtZXRob2Qgd2hvc2UgYmVoYXZpb3IgY29uZm9ybXMgdG8gdGhpcyBzcGVjaWZpY2F0aW9uLlxuICAtIGB0aGVuYWJsZWAgaXMgYW4gb2JqZWN0IG9yIGZ1bmN0aW9uIHRoYXQgZGVmaW5lcyBhIGB0aGVuYCBtZXRob2QuXG4gIC0gYHZhbHVlYCBpcyBhbnkgbGVnYWwgSmF2YVNjcmlwdCB2YWx1ZSAoaW5jbHVkaW5nIHVuZGVmaW5lZCwgYSB0aGVuYWJsZSwgb3IgYSBwcm9taXNlKS5cbiAgLSBgZXhjZXB0aW9uYCBpcyBhIHZhbHVlIHRoYXQgaXMgdGhyb3duIHVzaW5nIHRoZSB0aHJvdyBzdGF0ZW1lbnQuXG4gIC0gYHJlYXNvbmAgaXMgYSB2YWx1ZSB0aGF0IGluZGljYXRlcyB3aHkgYSBwcm9taXNlIHdhcyByZWplY3RlZC5cbiAgLSBgc2V0dGxlZGAgdGhlIGZpbmFsIHJlc3Rpbmcgc3RhdGUgb2YgYSBwcm9taXNlLCBmdWxmaWxsZWQgb3IgcmVqZWN0ZWQuXG5cbiAgQSBwcm9taXNlIGNhbiBiZSBpbiBvbmUgb2YgdGhyZWUgc3RhdGVzOiBwZW5kaW5nLCBmdWxmaWxsZWQsIG9yIHJlamVjdGVkLlxuXG4gIFByb21pc2VzIHRoYXQgYXJlIGZ1bGZpbGxlZCBoYXZlIGEgZnVsZmlsbG1lbnQgdmFsdWUgYW5kIGFyZSBpbiB0aGUgZnVsZmlsbGVkXG4gIHN0YXRlLiAgUHJvbWlzZXMgdGhhdCBhcmUgcmVqZWN0ZWQgaGF2ZSBhIHJlamVjdGlvbiByZWFzb24gYW5kIGFyZSBpbiB0aGVcbiAgcmVqZWN0ZWQgc3RhdGUuICBBIGZ1bGZpbGxtZW50IHZhbHVlIGlzIG5ldmVyIGEgdGhlbmFibGUuXG5cbiAgUHJvbWlzZXMgY2FuIGFsc28gYmUgc2FpZCB0byAqcmVzb2x2ZSogYSB2YWx1ZS4gIElmIHRoaXMgdmFsdWUgaXMgYWxzbyBhXG4gIHByb21pc2UsIHRoZW4gdGhlIG9yaWdpbmFsIHByb21pc2UncyBzZXR0bGVkIHN0YXRlIHdpbGwgbWF0Y2ggdGhlIHZhbHVlJ3NcbiAgc2V0dGxlZCBzdGF0ZS4gIFNvIGEgcHJvbWlzZSB0aGF0ICpyZXNvbHZlcyogYSBwcm9taXNlIHRoYXQgcmVqZWN0cyB3aWxsXG4gIGl0c2VsZiByZWplY3QsIGFuZCBhIHByb21pc2UgdGhhdCAqcmVzb2x2ZXMqIGEgcHJvbWlzZSB0aGF0IGZ1bGZpbGxzIHdpbGxcbiAgaXRzZWxmIGZ1bGZpbGwuXG5cblxuICBCYXNpYyBVc2FnZTpcbiAgLS0tLS0tLS0tLS0tXG5cbiAgYGBganNcbiAgbGV0IHByb21pc2UgPSBuZXcgUHJvbWlzZShmdW5jdGlvbihyZXNvbHZlLCByZWplY3QpIHtcbiAgICAvLyBvbiBzdWNjZXNzXG4gICAgcmVzb2x2ZSh2YWx1ZSk7XG5cbiAgICAvLyBvbiBmYWlsdXJlXG4gICAgcmVqZWN0KHJlYXNvbik7XG4gIH0pO1xuXG4gIHByb21pc2UudGhlbihmdW5jdGlvbih2YWx1ZSkge1xuICAgIC8vIG9uIGZ1bGZpbGxtZW50XG4gIH0sIGZ1bmN0aW9uKHJlYXNvbikge1xuICAgIC8vIG9uIHJlamVjdGlvblxuICB9KTtcbiAgYGBgXG5cbiAgQWR2YW5jZWQgVXNhZ2U6XG4gIC0tLS0tLS0tLS0tLS0tLVxuXG4gIFByb21pc2VzIHNoaW5lIHdoZW4gYWJzdHJhY3RpbmcgYXdheSBhc3luY2hyb25vdXMgaW50ZXJhY3Rpb25zIHN1Y2ggYXNcbiAgYFhNTEh0dHBSZXF1ZXN0YHMuXG5cbiAgYGBganNcbiAgZnVuY3Rpb24gZ2V0SlNPTih1cmwpIHtcbiAgICByZXR1cm4gbmV3IFByb21pc2UoZnVuY3Rpb24ocmVzb2x2ZSwgcmVqZWN0KXtcbiAgICAgIGxldCB4aHIgPSBuZXcgWE1MSHR0cFJlcXVlc3QoKTtcblxuICAgICAgeGhyLm9wZW4oJ0dFVCcsIHVybCk7XG4gICAgICB4aHIub25yZWFkeXN0YXRlY2hhbmdlID0gaGFuZGxlcjtcbiAgICAgIHhoci5yZXNwb25zZVR5cGUgPSAnanNvbic7XG4gICAgICB4aHIuc2V0UmVxdWVzdEhlYWRlcignQWNjZXB0JywgJ2FwcGxpY2F0aW9uL2pzb24nKTtcbiAgICAgIHhoci5zZW5kKCk7XG5cbiAgICAgIGZ1bmN0aW9uIGhhbmRsZXIoKSB7XG4gICAgICAgIGlmICh0aGlzLnJlYWR5U3RhdGUgPT09IHRoaXMuRE9ORSkge1xuICAgICAgICAgIGlmICh0aGlzLnN0YXR1cyA9PT0gMjAwKSB7XG4gICAgICAgICAgICByZXNvbHZlKHRoaXMucmVzcG9uc2UpO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICByZWplY3QobmV3IEVycm9yKCdnZXRKU09OOiBgJyArIHVybCArICdgIGZhaWxlZCB3aXRoIHN0YXR1czogWycgKyB0aGlzLnN0YXR1cyArICddJykpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfTtcbiAgICB9KTtcbiAgfVxuXG4gIGdldEpTT04oJy9wb3N0cy5qc29uJykudGhlbihmdW5jdGlvbihqc29uKSB7XG4gICAgLy8gb24gZnVsZmlsbG1lbnRcbiAgfSwgZnVuY3Rpb24ocmVhc29uKSB7XG4gICAgLy8gb24gcmVqZWN0aW9uXG4gIH0pO1xuICBgYGBcblxuICBVbmxpa2UgY2FsbGJhY2tzLCBwcm9taXNlcyBhcmUgZ3JlYXQgY29tcG9zYWJsZSBwcmltaXRpdmVzLlxuXG4gIGBgYGpzXG4gIFByb21pc2UuYWxsKFtcbiAgICBnZXRKU09OKCcvcG9zdHMnKSxcbiAgICBnZXRKU09OKCcvY29tbWVudHMnKVxuICBdKS50aGVuKGZ1bmN0aW9uKHZhbHVlcyl7XG4gICAgdmFsdWVzWzBdIC8vID0+IHBvc3RzSlNPTlxuICAgIHZhbHVlc1sxXSAvLyA9PiBjb21tZW50c0pTT05cblxuICAgIHJldHVybiB2YWx1ZXM7XG4gIH0pO1xuICBgYGBcblxuICBAY2xhc3MgUHJvbWlzZVxuICBAcGFyYW0ge2Z1bmN0aW9ufSByZXNvbHZlclxuICBVc2VmdWwgZm9yIHRvb2xpbmcuXG4gIEBjb25zdHJ1Y3RvclxuKi9cbmZ1bmN0aW9uIFByb21pc2UkMihyZXNvbHZlcikge1xuICB0aGlzW1BST01JU0VfSURdID0gbmV4dElkKCk7XG4gIHRoaXMuX3Jlc3VsdCA9IHRoaXMuX3N0YXRlID0gdW5kZWZpbmVkO1xuICB0aGlzLl9zdWJzY3JpYmVycyA9IFtdO1xuXG4gIGlmIChub29wICE9PSByZXNvbHZlcikge1xuICAgIHR5cGVvZiByZXNvbHZlciAhPT0gJ2Z1bmN0aW9uJyAmJiBuZWVkc1Jlc29sdmVyKCk7XG4gICAgdGhpcyBpbnN0YW5jZW9mIFByb21pc2UkMiA/IGluaXRpYWxpemVQcm9taXNlKHRoaXMsIHJlc29sdmVyKSA6IG5lZWRzTmV3KCk7XG4gIH1cbn1cblxuUHJvbWlzZSQyLmFsbCA9IGFsbCQxO1xuUHJvbWlzZSQyLnJhY2UgPSByYWNlJDE7XG5Qcm9taXNlJDIucmVzb2x2ZSA9IHJlc29sdmUkMTtcblByb21pc2UkMi5yZWplY3QgPSByZWplY3QkMTtcblByb21pc2UkMi5fc2V0U2NoZWR1bGVyID0gc2V0U2NoZWR1bGVyO1xuUHJvbWlzZSQyLl9zZXRBc2FwID0gc2V0QXNhcDtcblByb21pc2UkMi5fYXNhcCA9IGFzYXA7XG5cblByb21pc2UkMi5wcm90b3R5cGUgPSB7XG4gIGNvbnN0cnVjdG9yOiBQcm9taXNlJDIsXG5cbiAgLyoqXG4gICAgVGhlIHByaW1hcnkgd2F5IG9mIGludGVyYWN0aW5nIHdpdGggYSBwcm9taXNlIGlzIHRocm91Z2ggaXRzIGB0aGVuYCBtZXRob2QsXG4gICAgd2hpY2ggcmVnaXN0ZXJzIGNhbGxiYWNrcyB0byByZWNlaXZlIGVpdGhlciBhIHByb21pc2UncyBldmVudHVhbCB2YWx1ZSBvciB0aGVcbiAgICByZWFzb24gd2h5IHRoZSBwcm9taXNlIGNhbm5vdCBiZSBmdWxmaWxsZWQuXG4gIFxuICAgIGBgYGpzXG4gICAgZmluZFVzZXIoKS50aGVuKGZ1bmN0aW9uKHVzZXIpe1xuICAgICAgLy8gdXNlciBpcyBhdmFpbGFibGVcbiAgICB9LCBmdW5jdGlvbihyZWFzb24pe1xuICAgICAgLy8gdXNlciBpcyB1bmF2YWlsYWJsZSwgYW5kIHlvdSBhcmUgZ2l2ZW4gdGhlIHJlYXNvbiB3aHlcbiAgICB9KTtcbiAgICBgYGBcbiAgXG4gICAgQ2hhaW5pbmdcbiAgICAtLS0tLS0tLVxuICBcbiAgICBUaGUgcmV0dXJuIHZhbHVlIG9mIGB0aGVuYCBpcyBpdHNlbGYgYSBwcm9taXNlLiAgVGhpcyBzZWNvbmQsICdkb3duc3RyZWFtJ1xuICAgIHByb21pc2UgaXMgcmVzb2x2ZWQgd2l0aCB0aGUgcmV0dXJuIHZhbHVlIG9mIHRoZSBmaXJzdCBwcm9taXNlJ3MgZnVsZmlsbG1lbnRcbiAgICBvciByZWplY3Rpb24gaGFuZGxlciwgb3IgcmVqZWN0ZWQgaWYgdGhlIGhhbmRsZXIgdGhyb3dzIGFuIGV4Y2VwdGlvbi5cbiAgXG4gICAgYGBganNcbiAgICBmaW5kVXNlcigpLnRoZW4oZnVuY3Rpb24gKHVzZXIpIHtcbiAgICAgIHJldHVybiB1c2VyLm5hbWU7XG4gICAgfSwgZnVuY3Rpb24gKHJlYXNvbikge1xuICAgICAgcmV0dXJuICdkZWZhdWx0IG5hbWUnO1xuICAgIH0pLnRoZW4oZnVuY3Rpb24gKHVzZXJOYW1lKSB7XG4gICAgICAvLyBJZiBgZmluZFVzZXJgIGZ1bGZpbGxlZCwgYHVzZXJOYW1lYCB3aWxsIGJlIHRoZSB1c2VyJ3MgbmFtZSwgb3RoZXJ3aXNlIGl0XG4gICAgICAvLyB3aWxsIGJlIGAnZGVmYXVsdCBuYW1lJ2BcbiAgICB9KTtcbiAgXG4gICAgZmluZFVzZXIoKS50aGVuKGZ1bmN0aW9uICh1c2VyKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ0ZvdW5kIHVzZXIsIGJ1dCBzdGlsbCB1bmhhcHB5Jyk7XG4gICAgfSwgZnVuY3Rpb24gKHJlYXNvbikge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdgZmluZFVzZXJgIHJlamVjdGVkIGFuZCB3ZSdyZSB1bmhhcHB5Jyk7XG4gICAgfSkudGhlbihmdW5jdGlvbiAodmFsdWUpIHtcbiAgICAgIC8vIG5ldmVyIHJlYWNoZWRcbiAgICB9LCBmdW5jdGlvbiAocmVhc29uKSB7XG4gICAgICAvLyBpZiBgZmluZFVzZXJgIGZ1bGZpbGxlZCwgYHJlYXNvbmAgd2lsbCBiZSAnRm91bmQgdXNlciwgYnV0IHN0aWxsIHVuaGFwcHknLlxuICAgICAgLy8gSWYgYGZpbmRVc2VyYCByZWplY3RlZCwgYHJlYXNvbmAgd2lsbCBiZSAnYGZpbmRVc2VyYCByZWplY3RlZCBhbmQgd2UncmUgdW5oYXBweScuXG4gICAgfSk7XG4gICAgYGBgXG4gICAgSWYgdGhlIGRvd25zdHJlYW0gcHJvbWlzZSBkb2VzIG5vdCBzcGVjaWZ5IGEgcmVqZWN0aW9uIGhhbmRsZXIsIHJlamVjdGlvbiByZWFzb25zIHdpbGwgYmUgcHJvcGFnYXRlZCBmdXJ0aGVyIGRvd25zdHJlYW0uXG4gIFxuICAgIGBgYGpzXG4gICAgZmluZFVzZXIoKS50aGVuKGZ1bmN0aW9uICh1c2VyKSB7XG4gICAgICB0aHJvdyBuZXcgUGVkYWdvZ2ljYWxFeGNlcHRpb24oJ1Vwc3RyZWFtIGVycm9yJyk7XG4gICAgfSkudGhlbihmdW5jdGlvbiAodmFsdWUpIHtcbiAgICAgIC8vIG5ldmVyIHJlYWNoZWRcbiAgICB9KS50aGVuKGZ1bmN0aW9uICh2YWx1ZSkge1xuICAgICAgLy8gbmV2ZXIgcmVhY2hlZFxuICAgIH0sIGZ1bmN0aW9uIChyZWFzb24pIHtcbiAgICAgIC8vIFRoZSBgUGVkZ2Fnb2NpYWxFeGNlcHRpb25gIGlzIHByb3BhZ2F0ZWQgYWxsIHRoZSB3YXkgZG93biB0byBoZXJlXG4gICAgfSk7XG4gICAgYGBgXG4gIFxuICAgIEFzc2ltaWxhdGlvblxuICAgIC0tLS0tLS0tLS0tLVxuICBcbiAgICBTb21ldGltZXMgdGhlIHZhbHVlIHlvdSB3YW50IHRvIHByb3BhZ2F0ZSB0byBhIGRvd25zdHJlYW0gcHJvbWlzZSBjYW4gb25seSBiZVxuICAgIHJldHJpZXZlZCBhc3luY2hyb25vdXNseS4gVGhpcyBjYW4gYmUgYWNoaWV2ZWQgYnkgcmV0dXJuaW5nIGEgcHJvbWlzZSBpbiB0aGVcbiAgICBmdWxmaWxsbWVudCBvciByZWplY3Rpb24gaGFuZGxlci4gVGhlIGRvd25zdHJlYW0gcHJvbWlzZSB3aWxsIHRoZW4gYmUgcGVuZGluZ1xuICAgIHVudGlsIHRoZSByZXR1cm5lZCBwcm9taXNlIGlzIHNldHRsZWQuIFRoaXMgaXMgY2FsbGVkICphc3NpbWlsYXRpb24qLlxuICBcbiAgICBgYGBqc1xuICAgIGZpbmRVc2VyKCkudGhlbihmdW5jdGlvbiAodXNlcikge1xuICAgICAgcmV0dXJuIGZpbmRDb21tZW50c0J5QXV0aG9yKHVzZXIpO1xuICAgIH0pLnRoZW4oZnVuY3Rpb24gKGNvbW1lbnRzKSB7XG4gICAgICAvLyBUaGUgdXNlcidzIGNvbW1lbnRzIGFyZSBub3cgYXZhaWxhYmxlXG4gICAgfSk7XG4gICAgYGBgXG4gIFxuICAgIElmIHRoZSBhc3NpbWxpYXRlZCBwcm9taXNlIHJlamVjdHMsIHRoZW4gdGhlIGRvd25zdHJlYW0gcHJvbWlzZSB3aWxsIGFsc28gcmVqZWN0LlxuICBcbiAgICBgYGBqc1xuICAgIGZpbmRVc2VyKCkudGhlbihmdW5jdGlvbiAodXNlcikge1xuICAgICAgcmV0dXJuIGZpbmRDb21tZW50c0J5QXV0aG9yKHVzZXIpO1xuICAgIH0pLnRoZW4oZnVuY3Rpb24gKGNvbW1lbnRzKSB7XG4gICAgICAvLyBJZiBgZmluZENvbW1lbnRzQnlBdXRob3JgIGZ1bGZpbGxzLCB3ZSdsbCBoYXZlIHRoZSB2YWx1ZSBoZXJlXG4gICAgfSwgZnVuY3Rpb24gKHJlYXNvbikge1xuICAgICAgLy8gSWYgYGZpbmRDb21tZW50c0J5QXV0aG9yYCByZWplY3RzLCB3ZSdsbCBoYXZlIHRoZSByZWFzb24gaGVyZVxuICAgIH0pO1xuICAgIGBgYFxuICBcbiAgICBTaW1wbGUgRXhhbXBsZVxuICAgIC0tLS0tLS0tLS0tLS0tXG4gIFxuICAgIFN5bmNocm9ub3VzIEV4YW1wbGVcbiAgXG4gICAgYGBgamF2YXNjcmlwdFxuICAgIGxldCByZXN1bHQ7XG4gIFxuICAgIHRyeSB7XG4gICAgICByZXN1bHQgPSBmaW5kUmVzdWx0KCk7XG4gICAgICAvLyBzdWNjZXNzXG4gICAgfSBjYXRjaChyZWFzb24pIHtcbiAgICAgIC8vIGZhaWx1cmVcbiAgICB9XG4gICAgYGBgXG4gIFxuICAgIEVycmJhY2sgRXhhbXBsZVxuICBcbiAgICBgYGBqc1xuICAgIGZpbmRSZXN1bHQoZnVuY3Rpb24ocmVzdWx0LCBlcnIpe1xuICAgICAgaWYgKGVycikge1xuICAgICAgICAvLyBmYWlsdXJlXG4gICAgICB9IGVsc2Uge1xuICAgICAgICAvLyBzdWNjZXNzXG4gICAgICB9XG4gICAgfSk7XG4gICAgYGBgXG4gIFxuICAgIFByb21pc2UgRXhhbXBsZTtcbiAgXG4gICAgYGBgamF2YXNjcmlwdFxuICAgIGZpbmRSZXN1bHQoKS50aGVuKGZ1bmN0aW9uKHJlc3VsdCl7XG4gICAgICAvLyBzdWNjZXNzXG4gICAgfSwgZnVuY3Rpb24ocmVhc29uKXtcbiAgICAgIC8vIGZhaWx1cmVcbiAgICB9KTtcbiAgICBgYGBcbiAgXG4gICAgQWR2YW5jZWQgRXhhbXBsZVxuICAgIC0tLS0tLS0tLS0tLS0tXG4gIFxuICAgIFN5bmNocm9ub3VzIEV4YW1wbGVcbiAgXG4gICAgYGBgamF2YXNjcmlwdFxuICAgIGxldCBhdXRob3IsIGJvb2tzO1xuICBcbiAgICB0cnkge1xuICAgICAgYXV0aG9yID0gZmluZEF1dGhvcigpO1xuICAgICAgYm9va3MgID0gZmluZEJvb2tzQnlBdXRob3IoYXV0aG9yKTtcbiAgICAgIC8vIHN1Y2Nlc3NcbiAgICB9IGNhdGNoKHJlYXNvbikge1xuICAgICAgLy8gZmFpbHVyZVxuICAgIH1cbiAgICBgYGBcbiAgXG4gICAgRXJyYmFjayBFeGFtcGxlXG4gIFxuICAgIGBgYGpzXG4gIFxuICAgIGZ1bmN0aW9uIGZvdW5kQm9va3MoYm9va3MpIHtcbiAgXG4gICAgfVxuICBcbiAgICBmdW5jdGlvbiBmYWlsdXJlKHJlYXNvbikge1xuICBcbiAgICB9XG4gIFxuICAgIGZpbmRBdXRob3IoZnVuY3Rpb24oYXV0aG9yLCBlcnIpe1xuICAgICAgaWYgKGVycikge1xuICAgICAgICBmYWlsdXJlKGVycik7XG4gICAgICAgIC8vIGZhaWx1cmVcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgZmluZEJvb29rc0J5QXV0aG9yKGF1dGhvciwgZnVuY3Rpb24oYm9va3MsIGVycikge1xuICAgICAgICAgICAgaWYgKGVycikge1xuICAgICAgICAgICAgICBmYWlsdXJlKGVycik7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgIGZvdW5kQm9va3MoYm9va3MpO1xuICAgICAgICAgICAgICB9IGNhdGNoKHJlYXNvbikge1xuICAgICAgICAgICAgICAgIGZhaWx1cmUocmVhc29uKTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH0pO1xuICAgICAgICB9IGNhdGNoKGVycm9yKSB7XG4gICAgICAgICAgZmFpbHVyZShlcnIpO1xuICAgICAgICB9XG4gICAgICAgIC8vIHN1Y2Nlc3NcbiAgICAgIH1cbiAgICB9KTtcbiAgICBgYGBcbiAgXG4gICAgUHJvbWlzZSBFeGFtcGxlO1xuICBcbiAgICBgYGBqYXZhc2NyaXB0XG4gICAgZmluZEF1dGhvcigpLlxuICAgICAgdGhlbihmaW5kQm9va3NCeUF1dGhvcikuXG4gICAgICB0aGVuKGZ1bmN0aW9uKGJvb2tzKXtcbiAgICAgICAgLy8gZm91bmQgYm9va3NcbiAgICB9KS5jYXRjaChmdW5jdGlvbihyZWFzb24pe1xuICAgICAgLy8gc29tZXRoaW5nIHdlbnQgd3JvbmdcbiAgICB9KTtcbiAgICBgYGBcbiAgXG4gICAgQG1ldGhvZCB0aGVuXG4gICAgQHBhcmFtIHtGdW5jdGlvbn0gb25GdWxmaWxsZWRcbiAgICBAcGFyYW0ge0Z1bmN0aW9ufSBvblJlamVjdGVkXG4gICAgVXNlZnVsIGZvciB0b29saW5nLlxuICAgIEByZXR1cm4ge1Byb21pc2V9XG4gICovXG4gIHRoZW46IHRoZW4sXG5cbiAgLyoqXG4gICAgYGNhdGNoYCBpcyBzaW1wbHkgc3VnYXIgZm9yIGB0aGVuKHVuZGVmaW5lZCwgb25SZWplY3Rpb24pYCB3aGljaCBtYWtlcyBpdCB0aGUgc2FtZVxuICAgIGFzIHRoZSBjYXRjaCBibG9jayBvZiBhIHRyeS9jYXRjaCBzdGF0ZW1lbnQuXG4gIFxuICAgIGBgYGpzXG4gICAgZnVuY3Rpb24gZmluZEF1dGhvcigpe1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdjb3VsZG4ndCBmaW5kIHRoYXQgYXV0aG9yJyk7XG4gICAgfVxuICBcbiAgICAvLyBzeW5jaHJvbm91c1xuICAgIHRyeSB7XG4gICAgICBmaW5kQXV0aG9yKCk7XG4gICAgfSBjYXRjaChyZWFzb24pIHtcbiAgICAgIC8vIHNvbWV0aGluZyB3ZW50IHdyb25nXG4gICAgfVxuICBcbiAgICAvLyBhc3luYyB3aXRoIHByb21pc2VzXG4gICAgZmluZEF1dGhvcigpLmNhdGNoKGZ1bmN0aW9uKHJlYXNvbil7XG4gICAgICAvLyBzb21ldGhpbmcgd2VudCB3cm9uZ1xuICAgIH0pO1xuICAgIGBgYFxuICBcbiAgICBAbWV0aG9kIGNhdGNoXG4gICAgQHBhcmFtIHtGdW5jdGlvbn0gb25SZWplY3Rpb25cbiAgICBVc2VmdWwgZm9yIHRvb2xpbmcuXG4gICAgQHJldHVybiB7UHJvbWlzZX1cbiAgKi9cbiAgJ2NhdGNoJzogZnVuY3Rpb24gX2NhdGNoKG9uUmVqZWN0aW9uKSB7XG4gICAgcmV0dXJuIHRoaXMudGhlbihudWxsLCBvblJlamVjdGlvbik7XG4gIH1cbn07XG5cbi8qZ2xvYmFsIHNlbGYqL1xuZnVuY3Rpb24gcG9seWZpbGwkMSgpIHtcbiAgICB2YXIgbG9jYWwgPSB1bmRlZmluZWQ7XG5cbiAgICBpZiAodHlwZW9mIGdsb2JhbCAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgbG9jYWwgPSBnbG9iYWw7XG4gICAgfSBlbHNlIGlmICh0eXBlb2Ygc2VsZiAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgbG9jYWwgPSBzZWxmO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBsb2NhbCA9IEZ1bmN0aW9uKCdyZXR1cm4gdGhpcycpKCk7XG4gICAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcigncG9seWZpbGwgZmFpbGVkIGJlY2F1c2UgZ2xvYmFsIG9iamVjdCBpcyB1bmF2YWlsYWJsZSBpbiB0aGlzIGVudmlyb25tZW50Jyk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICB2YXIgUCA9IGxvY2FsLlByb21pc2U7XG5cbiAgICBpZiAoUCkge1xuICAgICAgICB2YXIgcHJvbWlzZVRvU3RyaW5nID0gbnVsbDtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIHByb21pc2VUb1N0cmluZyA9IE9iamVjdC5wcm90b3R5cGUudG9TdHJpbmcuY2FsbChQLnJlc29sdmUoKSk7XG4gICAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgICAgIC8vIHNpbGVudGx5IGlnbm9yZWRcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChwcm9taXNlVG9TdHJpbmcgPT09ICdbb2JqZWN0IFByb21pc2VdJyAmJiAhUC5jYXN0KSB7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBsb2NhbC5Qcm9taXNlID0gUHJvbWlzZSQyO1xufVxuXG4vLyBTdHJhbmdlIGNvbXBhdC4uXG5Qcm9taXNlJDIucG9seWZpbGwgPSBwb2x5ZmlsbCQxO1xuUHJvbWlzZSQyLlByb21pc2UgPSBQcm9taXNlJDI7XG5cbnJldHVybiBQcm9taXNlJDI7XG5cbn0pKSk7XG5cbi8vIyBzb3VyY2VNYXBwaW5nVVJMPWVzNi1wcm9taXNlLm1hcFxuIiwiLy8gdGhlIHdoYXR3Zy1mZXRjaCBwb2x5ZmlsbCBpbnN0YWxscyB0aGUgZmV0Y2goKSBmdW5jdGlvblxuLy8gb24gdGhlIGdsb2JhbCBvYmplY3QgKHdpbmRvdyBvciBzZWxmKVxuLy9cbi8vIFJldHVybiB0aGF0IGFzIHRoZSBleHBvcnQgZm9yIHVzZSBpbiBXZWJwYWNrLCBCcm93c2VyaWZ5IGV0Yy5cbnJlcXVpcmUoJ3doYXR3Zy1mZXRjaCcpO1xubW9kdWxlLmV4cG9ydHMgPSBzZWxmLmZldGNoLmJpbmQoc2VsZik7XG4iLCIvLyBzaGltIGZvciB1c2luZyBwcm9jZXNzIGluIGJyb3dzZXJcbnZhciBwcm9jZXNzID0gbW9kdWxlLmV4cG9ydHMgPSB7fTtcblxuLy8gY2FjaGVkIGZyb20gd2hhdGV2ZXIgZ2xvYmFsIGlzIHByZXNlbnQgc28gdGhhdCB0ZXN0IHJ1bm5lcnMgdGhhdCBzdHViIGl0XG4vLyBkb24ndCBicmVhayB0aGluZ3MuICBCdXQgd2UgbmVlZCB0byB3cmFwIGl0IGluIGEgdHJ5IGNhdGNoIGluIGNhc2UgaXQgaXNcbi8vIHdyYXBwZWQgaW4gc3RyaWN0IG1vZGUgY29kZSB3aGljaCBkb2Vzbid0IGRlZmluZSBhbnkgZ2xvYmFscy4gIEl0J3MgaW5zaWRlIGFcbi8vIGZ1bmN0aW9uIGJlY2F1c2UgdHJ5L2NhdGNoZXMgZGVvcHRpbWl6ZSBpbiBjZXJ0YWluIGVuZ2luZXMuXG5cbnZhciBjYWNoZWRTZXRUaW1lb3V0O1xudmFyIGNhY2hlZENsZWFyVGltZW91dDtcblxuZnVuY3Rpb24gZGVmYXVsdFNldFRpbW91dCgpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ3NldFRpbWVvdXQgaGFzIG5vdCBiZWVuIGRlZmluZWQnKTtcbn1cbmZ1bmN0aW9uIGRlZmF1bHRDbGVhclRpbWVvdXQgKCkge1xuICAgIHRocm93IG5ldyBFcnJvcignY2xlYXJUaW1lb3V0IGhhcyBub3QgYmVlbiBkZWZpbmVkJyk7XG59XG4oZnVuY3Rpb24gKCkge1xuICAgIHRyeSB7XG4gICAgICAgIGlmICh0eXBlb2Ygc2V0VGltZW91dCA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICAgICAgY2FjaGVkU2V0VGltZW91dCA9IHNldFRpbWVvdXQ7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBjYWNoZWRTZXRUaW1lb3V0ID0gZGVmYXVsdFNldFRpbW91dDtcbiAgICAgICAgfVxuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgY2FjaGVkU2V0VGltZW91dCA9IGRlZmF1bHRTZXRUaW1vdXQ7XG4gICAgfVxuICAgIHRyeSB7XG4gICAgICAgIGlmICh0eXBlb2YgY2xlYXJUaW1lb3V0ID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgICAgICBjYWNoZWRDbGVhclRpbWVvdXQgPSBjbGVhclRpbWVvdXQ7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBjYWNoZWRDbGVhclRpbWVvdXQgPSBkZWZhdWx0Q2xlYXJUaW1lb3V0O1xuICAgICAgICB9XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgICBjYWNoZWRDbGVhclRpbWVvdXQgPSBkZWZhdWx0Q2xlYXJUaW1lb3V0O1xuICAgIH1cbn0gKCkpXG5mdW5jdGlvbiBydW5UaW1lb3V0KGZ1bikge1xuICAgIGlmIChjYWNoZWRTZXRUaW1lb3V0ID09PSBzZXRUaW1lb3V0KSB7XG4gICAgICAgIC8vbm9ybWFsIGVudmlyb21lbnRzIGluIHNhbmUgc2l0dWF0aW9uc1xuICAgICAgICByZXR1cm4gc2V0VGltZW91dChmdW4sIDApO1xuICAgIH1cbiAgICAvLyBpZiBzZXRUaW1lb3V0IHdhc24ndCBhdmFpbGFibGUgYnV0IHdhcyBsYXR0ZXIgZGVmaW5lZFxuICAgIGlmICgoY2FjaGVkU2V0VGltZW91dCA9PT0gZGVmYXVsdFNldFRpbW91dCB8fCAhY2FjaGVkU2V0VGltZW91dCkgJiYgc2V0VGltZW91dCkge1xuICAgICAgICBjYWNoZWRTZXRUaW1lb3V0ID0gc2V0VGltZW91dDtcbiAgICAgICAgcmV0dXJuIHNldFRpbWVvdXQoZnVuLCAwKTtcbiAgICB9XG4gICAgdHJ5IHtcbiAgICAgICAgLy8gd2hlbiB3aGVuIHNvbWVib2R5IGhhcyBzY3Jld2VkIHdpdGggc2V0VGltZW91dCBidXQgbm8gSS5FLiBtYWRkbmVzc1xuICAgICAgICByZXR1cm4gY2FjaGVkU2V0VGltZW91dChmdW4sIDApO1xuICAgIH0gY2F0Y2goZSl7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICAvLyBXaGVuIHdlIGFyZSBpbiBJLkUuIGJ1dCB0aGUgc2NyaXB0IGhhcyBiZWVuIGV2YWxlZCBzbyBJLkUuIGRvZXNuJ3QgdHJ1c3QgdGhlIGdsb2JhbCBvYmplY3Qgd2hlbiBjYWxsZWQgbm9ybWFsbHlcbiAgICAgICAgICAgIHJldHVybiBjYWNoZWRTZXRUaW1lb3V0LmNhbGwobnVsbCwgZnVuLCAwKTtcbiAgICAgICAgfSBjYXRjaChlKXtcbiAgICAgICAgICAgIC8vIHNhbWUgYXMgYWJvdmUgYnV0IHdoZW4gaXQncyBhIHZlcnNpb24gb2YgSS5FLiB0aGF0IG11c3QgaGF2ZSB0aGUgZ2xvYmFsIG9iamVjdCBmb3IgJ3RoaXMnLCBob3BmdWxseSBvdXIgY29udGV4dCBjb3JyZWN0IG90aGVyd2lzZSBpdCB3aWxsIHRocm93IGEgZ2xvYmFsIGVycm9yXG4gICAgICAgICAgICByZXR1cm4gY2FjaGVkU2V0VGltZW91dC5jYWxsKHRoaXMsIGZ1biwgMCk7XG4gICAgICAgIH1cbiAgICB9XG5cblxufVxuZnVuY3Rpb24gcnVuQ2xlYXJUaW1lb3V0KG1hcmtlcikge1xuICAgIGlmIChjYWNoZWRDbGVhclRpbWVvdXQgPT09IGNsZWFyVGltZW91dCkge1xuICAgICAgICAvL25vcm1hbCBlbnZpcm9tZW50cyBpbiBzYW5lIHNpdHVhdGlvbnNcbiAgICAgICAgcmV0dXJuIGNsZWFyVGltZW91dChtYXJrZXIpO1xuICAgIH1cbiAgICAvLyBpZiBjbGVhclRpbWVvdXQgd2Fzbid0IGF2YWlsYWJsZSBidXQgd2FzIGxhdHRlciBkZWZpbmVkXG4gICAgaWYgKChjYWNoZWRDbGVhclRpbWVvdXQgPT09IGRlZmF1bHRDbGVhclRpbWVvdXQgfHwgIWNhY2hlZENsZWFyVGltZW91dCkgJiYgY2xlYXJUaW1lb3V0KSB7XG4gICAgICAgIGNhY2hlZENsZWFyVGltZW91dCA9IGNsZWFyVGltZW91dDtcbiAgICAgICAgcmV0dXJuIGNsZWFyVGltZW91dChtYXJrZXIpO1xuICAgIH1cbiAgICB0cnkge1xuICAgICAgICAvLyB3aGVuIHdoZW4gc29tZWJvZHkgaGFzIHNjcmV3ZWQgd2l0aCBzZXRUaW1lb3V0IGJ1dCBubyBJLkUuIG1hZGRuZXNzXG4gICAgICAgIHJldHVybiBjYWNoZWRDbGVhclRpbWVvdXQobWFya2VyKTtcbiAgICB9IGNhdGNoIChlKXtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIC8vIFdoZW4gd2UgYXJlIGluIEkuRS4gYnV0IHRoZSBzY3JpcHQgaGFzIGJlZW4gZXZhbGVkIHNvIEkuRS4gZG9lc24ndCAgdHJ1c3QgdGhlIGdsb2JhbCBvYmplY3Qgd2hlbiBjYWxsZWQgbm9ybWFsbHlcbiAgICAgICAgICAgIHJldHVybiBjYWNoZWRDbGVhclRpbWVvdXQuY2FsbChudWxsLCBtYXJrZXIpO1xuICAgICAgICB9IGNhdGNoIChlKXtcbiAgICAgICAgICAgIC8vIHNhbWUgYXMgYWJvdmUgYnV0IHdoZW4gaXQncyBhIHZlcnNpb24gb2YgSS5FLiB0aGF0IG11c3QgaGF2ZSB0aGUgZ2xvYmFsIG9iamVjdCBmb3IgJ3RoaXMnLCBob3BmdWxseSBvdXIgY29udGV4dCBjb3JyZWN0IG90aGVyd2lzZSBpdCB3aWxsIHRocm93IGEgZ2xvYmFsIGVycm9yLlxuICAgICAgICAgICAgLy8gU29tZSB2ZXJzaW9ucyBvZiBJLkUuIGhhdmUgZGlmZmVyZW50IHJ1bGVzIGZvciBjbGVhclRpbWVvdXQgdnMgc2V0VGltZW91dFxuICAgICAgICAgICAgcmV0dXJuIGNhY2hlZENsZWFyVGltZW91dC5jYWxsKHRoaXMsIG1hcmtlcik7XG4gICAgICAgIH1cbiAgICB9XG5cblxuXG59XG52YXIgcXVldWUgPSBbXTtcbnZhciBkcmFpbmluZyA9IGZhbHNlO1xudmFyIGN1cnJlbnRRdWV1ZTtcbnZhciBxdWV1ZUluZGV4ID0gLTE7XG5cbmZ1bmN0aW9uIGNsZWFuVXBOZXh0VGljaygpIHtcbiAgICBpZiAoIWRyYWluaW5nIHx8ICFjdXJyZW50UXVldWUpIHtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBkcmFpbmluZyA9IGZhbHNlO1xuICAgIGlmIChjdXJyZW50UXVldWUubGVuZ3RoKSB7XG4gICAgICAgIHF1ZXVlID0gY3VycmVudFF1ZXVlLmNvbmNhdChxdWV1ZSk7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgcXVldWVJbmRleCA9IC0xO1xuICAgIH1cbiAgICBpZiAocXVldWUubGVuZ3RoKSB7XG4gICAgICAgIGRyYWluUXVldWUoKTtcbiAgICB9XG59XG5cbmZ1bmN0aW9uIGRyYWluUXVldWUoKSB7XG4gICAgaWYgKGRyYWluaW5nKSB7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG4gICAgdmFyIHRpbWVvdXQgPSBydW5UaW1lb3V0KGNsZWFuVXBOZXh0VGljayk7XG4gICAgZHJhaW5pbmcgPSB0cnVlO1xuXG4gICAgdmFyIGxlbiA9IHF1ZXVlLmxlbmd0aDtcbiAgICB3aGlsZShsZW4pIHtcbiAgICAgICAgY3VycmVudFF1ZXVlID0gcXVldWU7XG4gICAgICAgIHF1ZXVlID0gW107XG4gICAgICAgIHdoaWxlICgrK3F1ZXVlSW5kZXggPCBsZW4pIHtcbiAgICAgICAgICAgIGlmIChjdXJyZW50UXVldWUpIHtcbiAgICAgICAgICAgICAgICBjdXJyZW50UXVldWVbcXVldWVJbmRleF0ucnVuKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcXVldWVJbmRleCA9IC0xO1xuICAgICAgICBsZW4gPSBxdWV1ZS5sZW5ndGg7XG4gICAgfVxuICAgIGN1cnJlbnRRdWV1ZSA9IG51bGw7XG4gICAgZHJhaW5pbmcgPSBmYWxzZTtcbiAgICBydW5DbGVhclRpbWVvdXQodGltZW91dCk7XG59XG5cbnByb2Nlc3MubmV4dFRpY2sgPSBmdW5jdGlvbiAoZnVuKSB7XG4gICAgdmFyIGFyZ3MgPSBuZXcgQXJyYXkoYXJndW1lbnRzLmxlbmd0aCAtIDEpO1xuICAgIGlmIChhcmd1bWVudHMubGVuZ3RoID4gMSkge1xuICAgICAgICBmb3IgKHZhciBpID0gMTsgaSA8IGFyZ3VtZW50cy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgYXJnc1tpIC0gMV0gPSBhcmd1bWVudHNbaV07XG4gICAgICAgIH1cbiAgICB9XG4gICAgcXVldWUucHVzaChuZXcgSXRlbShmdW4sIGFyZ3MpKTtcbiAgICBpZiAocXVldWUubGVuZ3RoID09PSAxICYmICFkcmFpbmluZykge1xuICAgICAgICBydW5UaW1lb3V0KGRyYWluUXVldWUpO1xuICAgIH1cbn07XG5cbi8vIHY4IGxpa2VzIHByZWRpY3RpYmxlIG9iamVjdHNcbmZ1bmN0aW9uIEl0ZW0oZnVuLCBhcnJheSkge1xuICAgIHRoaXMuZnVuID0gZnVuO1xuICAgIHRoaXMuYXJyYXkgPSBhcnJheTtcbn1cbkl0ZW0ucHJvdG90eXBlLnJ1biA9IGZ1bmN0aW9uICgpIHtcbiAgICB0aGlzLmZ1bi5hcHBseShudWxsLCB0aGlzLmFycmF5KTtcbn07XG5wcm9jZXNzLnRpdGxlID0gJ2Jyb3dzZXInO1xucHJvY2Vzcy5icm93c2VyID0gdHJ1ZTtcbnByb2Nlc3MuZW52ID0ge307XG5wcm9jZXNzLmFyZ3YgPSBbXTtcbnByb2Nlc3MudmVyc2lvbiA9ICcnOyAvLyBlbXB0eSBzdHJpbmcgdG8gYXZvaWQgcmVnZXhwIGlzc3Vlc1xucHJvY2Vzcy52ZXJzaW9ucyA9IHt9O1xuXG5mdW5jdGlvbiBub29wKCkge31cblxucHJvY2Vzcy5vbiA9IG5vb3A7XG5wcm9jZXNzLmFkZExpc3RlbmVyID0gbm9vcDtcbnByb2Nlc3Mub25jZSA9IG5vb3A7XG5wcm9jZXNzLm9mZiA9IG5vb3A7XG5wcm9jZXNzLnJlbW92ZUxpc3RlbmVyID0gbm9vcDtcbnByb2Nlc3MucmVtb3ZlQWxsTGlzdGVuZXJzID0gbm9vcDtcbnByb2Nlc3MuZW1pdCA9IG5vb3A7XG5wcm9jZXNzLnByZXBlbmRMaXN0ZW5lciA9IG5vb3A7XG5wcm9jZXNzLnByZXBlbmRPbmNlTGlzdGVuZXIgPSBub29wO1xuXG5wcm9jZXNzLmxpc3RlbmVycyA9IGZ1bmN0aW9uIChuYW1lKSB7IHJldHVybiBbXSB9XG5cbnByb2Nlc3MuYmluZGluZyA9IGZ1bmN0aW9uIChuYW1lKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdwcm9jZXNzLmJpbmRpbmcgaXMgbm90IHN1cHBvcnRlZCcpO1xufTtcblxucHJvY2Vzcy5jd2QgPSBmdW5jdGlvbiAoKSB7IHJldHVybiAnLycgfTtcbnByb2Nlc3MuY2hkaXIgPSBmdW5jdGlvbiAoZGlyKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdwcm9jZXNzLmNoZGlyIGlzIG5vdCBzdXBwb3J0ZWQnKTtcbn07XG5wcm9jZXNzLnVtYXNrID0gZnVuY3Rpb24oKSB7IHJldHVybiAwOyB9O1xuIiwiKGZ1bmN0aW9uKHNlbGYpIHtcbiAgJ3VzZSBzdHJpY3QnO1xuXG4gIGlmIChzZWxmLmZldGNoKSB7XG4gICAgcmV0dXJuXG4gIH1cblxuICB2YXIgc3VwcG9ydCA9IHtcbiAgICBzZWFyY2hQYXJhbXM6ICdVUkxTZWFyY2hQYXJhbXMnIGluIHNlbGYsXG4gICAgaXRlcmFibGU6ICdTeW1ib2wnIGluIHNlbGYgJiYgJ2l0ZXJhdG9yJyBpbiBTeW1ib2wsXG4gICAgYmxvYjogJ0ZpbGVSZWFkZXInIGluIHNlbGYgJiYgJ0Jsb2InIGluIHNlbGYgJiYgKGZ1bmN0aW9uKCkge1xuICAgICAgdHJ5IHtcbiAgICAgICAgbmV3IEJsb2IoKVxuICAgICAgICByZXR1cm4gdHJ1ZVxuICAgICAgfSBjYXRjaChlKSB7XG4gICAgICAgIHJldHVybiBmYWxzZVxuICAgICAgfVxuICAgIH0pKCksXG4gICAgZm9ybURhdGE6ICdGb3JtRGF0YScgaW4gc2VsZixcbiAgICBhcnJheUJ1ZmZlcjogJ0FycmF5QnVmZmVyJyBpbiBzZWxmXG4gIH1cblxuICBpZiAoc3VwcG9ydC5hcnJheUJ1ZmZlcikge1xuICAgIHZhciB2aWV3Q2xhc3NlcyA9IFtcbiAgICAgICdbb2JqZWN0IEludDhBcnJheV0nLFxuICAgICAgJ1tvYmplY3QgVWludDhBcnJheV0nLFxuICAgICAgJ1tvYmplY3QgVWludDhDbGFtcGVkQXJyYXldJyxcbiAgICAgICdbb2JqZWN0IEludDE2QXJyYXldJyxcbiAgICAgICdbb2JqZWN0IFVpbnQxNkFycmF5XScsXG4gICAgICAnW29iamVjdCBJbnQzMkFycmF5XScsXG4gICAgICAnW29iamVjdCBVaW50MzJBcnJheV0nLFxuICAgICAgJ1tvYmplY3QgRmxvYXQzMkFycmF5XScsXG4gICAgICAnW29iamVjdCBGbG9hdDY0QXJyYXldJ1xuICAgIF1cblxuICAgIHZhciBpc0RhdGFWaWV3ID0gZnVuY3Rpb24ob2JqKSB7XG4gICAgICByZXR1cm4gb2JqICYmIERhdGFWaWV3LnByb3RvdHlwZS5pc1Byb3RvdHlwZU9mKG9iailcbiAgICB9XG5cbiAgICB2YXIgaXNBcnJheUJ1ZmZlclZpZXcgPSBBcnJheUJ1ZmZlci5pc1ZpZXcgfHwgZnVuY3Rpb24ob2JqKSB7XG4gICAgICByZXR1cm4gb2JqICYmIHZpZXdDbGFzc2VzLmluZGV4T2YoT2JqZWN0LnByb3RvdHlwZS50b1N0cmluZy5jYWxsKG9iaikpID4gLTFcbiAgICB9XG4gIH1cblxuICBmdW5jdGlvbiBub3JtYWxpemVOYW1lKG5hbWUpIHtcbiAgICBpZiAodHlwZW9mIG5hbWUgIT09ICdzdHJpbmcnKSB7XG4gICAgICBuYW1lID0gU3RyaW5nKG5hbWUpXG4gICAgfVxuICAgIGlmICgvW15hLXowLTlcXC0jJCUmJyorLlxcXl9gfH5dL2kudGVzdChuYW1lKSkge1xuICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcignSW52YWxpZCBjaGFyYWN0ZXIgaW4gaGVhZGVyIGZpZWxkIG5hbWUnKVxuICAgIH1cbiAgICByZXR1cm4gbmFtZS50b0xvd2VyQ2FzZSgpXG4gIH1cblxuICBmdW5jdGlvbiBub3JtYWxpemVWYWx1ZSh2YWx1ZSkge1xuICAgIGlmICh0eXBlb2YgdmFsdWUgIT09ICdzdHJpbmcnKSB7XG4gICAgICB2YWx1ZSA9IFN0cmluZyh2YWx1ZSlcbiAgICB9XG4gICAgcmV0dXJuIHZhbHVlXG4gIH1cblxuICAvLyBCdWlsZCBhIGRlc3RydWN0aXZlIGl0ZXJhdG9yIGZvciB0aGUgdmFsdWUgbGlzdFxuICBmdW5jdGlvbiBpdGVyYXRvckZvcihpdGVtcykge1xuICAgIHZhciBpdGVyYXRvciA9IHtcbiAgICAgIG5leHQ6IGZ1bmN0aW9uKCkge1xuICAgICAgICB2YXIgdmFsdWUgPSBpdGVtcy5zaGlmdCgpXG4gICAgICAgIHJldHVybiB7ZG9uZTogdmFsdWUgPT09IHVuZGVmaW5lZCwgdmFsdWU6IHZhbHVlfVxuICAgICAgfVxuICAgIH1cblxuICAgIGlmIChzdXBwb3J0Lml0ZXJhYmxlKSB7XG4gICAgICBpdGVyYXRvcltTeW1ib2wuaXRlcmF0b3JdID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIHJldHVybiBpdGVyYXRvclxuICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiBpdGVyYXRvclxuICB9XG5cbiAgZnVuY3Rpb24gSGVhZGVycyhoZWFkZXJzKSB7XG4gICAgdGhpcy5tYXAgPSB7fVxuXG4gICAgaWYgKGhlYWRlcnMgaW5zdGFuY2VvZiBIZWFkZXJzKSB7XG4gICAgICBoZWFkZXJzLmZvckVhY2goZnVuY3Rpb24odmFsdWUsIG5hbWUpIHtcbiAgICAgICAgdGhpcy5hcHBlbmQobmFtZSwgdmFsdWUpXG4gICAgICB9LCB0aGlzKVxuICAgIH0gZWxzZSBpZiAoQXJyYXkuaXNBcnJheShoZWFkZXJzKSkge1xuICAgICAgaGVhZGVycy5mb3JFYWNoKGZ1bmN0aW9uKGhlYWRlcikge1xuICAgICAgICB0aGlzLmFwcGVuZChoZWFkZXJbMF0sIGhlYWRlclsxXSlcbiAgICAgIH0sIHRoaXMpXG4gICAgfSBlbHNlIGlmIChoZWFkZXJzKSB7XG4gICAgICBPYmplY3QuZ2V0T3duUHJvcGVydHlOYW1lcyhoZWFkZXJzKS5mb3JFYWNoKGZ1bmN0aW9uKG5hbWUpIHtcbiAgICAgICAgdGhpcy5hcHBlbmQobmFtZSwgaGVhZGVyc1tuYW1lXSlcbiAgICAgIH0sIHRoaXMpXG4gICAgfVxuICB9XG5cbiAgSGVhZGVycy5wcm90b3R5cGUuYXBwZW5kID0gZnVuY3Rpb24obmFtZSwgdmFsdWUpIHtcbiAgICBuYW1lID0gbm9ybWFsaXplTmFtZShuYW1lKVxuICAgIHZhbHVlID0gbm9ybWFsaXplVmFsdWUodmFsdWUpXG4gICAgdmFyIG9sZFZhbHVlID0gdGhpcy5tYXBbbmFtZV1cbiAgICB0aGlzLm1hcFtuYW1lXSA9IG9sZFZhbHVlID8gb2xkVmFsdWUrJywnK3ZhbHVlIDogdmFsdWVcbiAgfVxuXG4gIEhlYWRlcnMucHJvdG90eXBlWydkZWxldGUnXSA9IGZ1bmN0aW9uKG5hbWUpIHtcbiAgICBkZWxldGUgdGhpcy5tYXBbbm9ybWFsaXplTmFtZShuYW1lKV1cbiAgfVxuXG4gIEhlYWRlcnMucHJvdG90eXBlLmdldCA9IGZ1bmN0aW9uKG5hbWUpIHtcbiAgICBuYW1lID0gbm9ybWFsaXplTmFtZShuYW1lKVxuICAgIHJldHVybiB0aGlzLmhhcyhuYW1lKSA/IHRoaXMubWFwW25hbWVdIDogbnVsbFxuICB9XG5cbiAgSGVhZGVycy5wcm90b3R5cGUuaGFzID0gZnVuY3Rpb24obmFtZSkge1xuICAgIHJldHVybiB0aGlzLm1hcC5oYXNPd25Qcm9wZXJ0eShub3JtYWxpemVOYW1lKG5hbWUpKVxuICB9XG5cbiAgSGVhZGVycy5wcm90b3R5cGUuc2V0ID0gZnVuY3Rpb24obmFtZSwgdmFsdWUpIHtcbiAgICB0aGlzLm1hcFtub3JtYWxpemVOYW1lKG5hbWUpXSA9IG5vcm1hbGl6ZVZhbHVlKHZhbHVlKVxuICB9XG5cbiAgSGVhZGVycy5wcm90b3R5cGUuZm9yRWFjaCA9IGZ1bmN0aW9uKGNhbGxiYWNrLCB0aGlzQXJnKSB7XG4gICAgZm9yICh2YXIgbmFtZSBpbiB0aGlzLm1hcCkge1xuICAgICAgaWYgKHRoaXMubWFwLmhhc093blByb3BlcnR5KG5hbWUpKSB7XG4gICAgICAgIGNhbGxiYWNrLmNhbGwodGhpc0FyZywgdGhpcy5tYXBbbmFtZV0sIG5hbWUsIHRoaXMpXG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgSGVhZGVycy5wcm90b3R5cGUua2V5cyA9IGZ1bmN0aW9uKCkge1xuICAgIHZhciBpdGVtcyA9IFtdXG4gICAgdGhpcy5mb3JFYWNoKGZ1bmN0aW9uKHZhbHVlLCBuYW1lKSB7IGl0ZW1zLnB1c2gobmFtZSkgfSlcbiAgICByZXR1cm4gaXRlcmF0b3JGb3IoaXRlbXMpXG4gIH1cblxuICBIZWFkZXJzLnByb3RvdHlwZS52YWx1ZXMgPSBmdW5jdGlvbigpIHtcbiAgICB2YXIgaXRlbXMgPSBbXVxuICAgIHRoaXMuZm9yRWFjaChmdW5jdGlvbih2YWx1ZSkgeyBpdGVtcy5wdXNoKHZhbHVlKSB9KVxuICAgIHJldHVybiBpdGVyYXRvckZvcihpdGVtcylcbiAgfVxuXG4gIEhlYWRlcnMucHJvdG90eXBlLmVudHJpZXMgPSBmdW5jdGlvbigpIHtcbiAgICB2YXIgaXRlbXMgPSBbXVxuICAgIHRoaXMuZm9yRWFjaChmdW5jdGlvbih2YWx1ZSwgbmFtZSkgeyBpdGVtcy5wdXNoKFtuYW1lLCB2YWx1ZV0pIH0pXG4gICAgcmV0dXJuIGl0ZXJhdG9yRm9yKGl0ZW1zKVxuICB9XG5cbiAgaWYgKHN1cHBvcnQuaXRlcmFibGUpIHtcbiAgICBIZWFkZXJzLnByb3RvdHlwZVtTeW1ib2wuaXRlcmF0b3JdID0gSGVhZGVycy5wcm90b3R5cGUuZW50cmllc1xuICB9XG5cbiAgZnVuY3Rpb24gY29uc3VtZWQoYm9keSkge1xuICAgIGlmIChib2R5LmJvZHlVc2VkKSB7XG4gICAgICByZXR1cm4gUHJvbWlzZS5yZWplY3QobmV3IFR5cGVFcnJvcignQWxyZWFkeSByZWFkJykpXG4gICAgfVxuICAgIGJvZHkuYm9keVVzZWQgPSB0cnVlXG4gIH1cblxuICBmdW5jdGlvbiBmaWxlUmVhZGVyUmVhZHkocmVhZGVyKSB7XG4gICAgcmV0dXJuIG5ldyBQcm9taXNlKGZ1bmN0aW9uKHJlc29sdmUsIHJlamVjdCkge1xuICAgICAgcmVhZGVyLm9ubG9hZCA9IGZ1bmN0aW9uKCkge1xuICAgICAgICByZXNvbHZlKHJlYWRlci5yZXN1bHQpXG4gICAgICB9XG4gICAgICByZWFkZXIub25lcnJvciA9IGZ1bmN0aW9uKCkge1xuICAgICAgICByZWplY3QocmVhZGVyLmVycm9yKVxuICAgICAgfVxuICAgIH0pXG4gIH1cblxuICBmdW5jdGlvbiByZWFkQmxvYkFzQXJyYXlCdWZmZXIoYmxvYikge1xuICAgIHZhciByZWFkZXIgPSBuZXcgRmlsZVJlYWRlcigpXG4gICAgdmFyIHByb21pc2UgPSBmaWxlUmVhZGVyUmVhZHkocmVhZGVyKVxuICAgIHJlYWRlci5yZWFkQXNBcnJheUJ1ZmZlcihibG9iKVxuICAgIHJldHVybiBwcm9taXNlXG4gIH1cblxuICBmdW5jdGlvbiByZWFkQmxvYkFzVGV4dChibG9iKSB7XG4gICAgdmFyIHJlYWRlciA9IG5ldyBGaWxlUmVhZGVyKClcbiAgICB2YXIgcHJvbWlzZSA9IGZpbGVSZWFkZXJSZWFkeShyZWFkZXIpXG4gICAgcmVhZGVyLnJlYWRBc1RleHQoYmxvYilcbiAgICByZXR1cm4gcHJvbWlzZVxuICB9XG5cbiAgZnVuY3Rpb24gcmVhZEFycmF5QnVmZmVyQXNUZXh0KGJ1Zikge1xuICAgIHZhciB2aWV3ID0gbmV3IFVpbnQ4QXJyYXkoYnVmKVxuICAgIHZhciBjaGFycyA9IG5ldyBBcnJheSh2aWV3Lmxlbmd0aClcblxuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgdmlldy5sZW5ndGg7IGkrKykge1xuICAgICAgY2hhcnNbaV0gPSBTdHJpbmcuZnJvbUNoYXJDb2RlKHZpZXdbaV0pXG4gICAgfVxuICAgIHJldHVybiBjaGFycy5qb2luKCcnKVxuICB9XG5cbiAgZnVuY3Rpb24gYnVmZmVyQ2xvbmUoYnVmKSB7XG4gICAgaWYgKGJ1Zi5zbGljZSkge1xuICAgICAgcmV0dXJuIGJ1Zi5zbGljZSgwKVxuICAgIH0gZWxzZSB7XG4gICAgICB2YXIgdmlldyA9IG5ldyBVaW50OEFycmF5KGJ1Zi5ieXRlTGVuZ3RoKVxuICAgICAgdmlldy5zZXQobmV3IFVpbnQ4QXJyYXkoYnVmKSlcbiAgICAgIHJldHVybiB2aWV3LmJ1ZmZlclxuICAgIH1cbiAgfVxuXG4gIGZ1bmN0aW9uIEJvZHkoKSB7XG4gICAgdGhpcy5ib2R5VXNlZCA9IGZhbHNlXG5cbiAgICB0aGlzLl9pbml0Qm9keSA9IGZ1bmN0aW9uKGJvZHkpIHtcbiAgICAgIHRoaXMuX2JvZHlJbml0ID0gYm9keVxuICAgICAgaWYgKCFib2R5KSB7XG4gICAgICAgIHRoaXMuX2JvZHlUZXh0ID0gJydcbiAgICAgIH0gZWxzZSBpZiAodHlwZW9mIGJvZHkgPT09ICdzdHJpbmcnKSB7XG4gICAgICAgIHRoaXMuX2JvZHlUZXh0ID0gYm9keVxuICAgICAgfSBlbHNlIGlmIChzdXBwb3J0LmJsb2IgJiYgQmxvYi5wcm90b3R5cGUuaXNQcm90b3R5cGVPZihib2R5KSkge1xuICAgICAgICB0aGlzLl9ib2R5QmxvYiA9IGJvZHlcbiAgICAgIH0gZWxzZSBpZiAoc3VwcG9ydC5mb3JtRGF0YSAmJiBGb3JtRGF0YS5wcm90b3R5cGUuaXNQcm90b3R5cGVPZihib2R5KSkge1xuICAgICAgICB0aGlzLl9ib2R5Rm9ybURhdGEgPSBib2R5XG4gICAgICB9IGVsc2UgaWYgKHN1cHBvcnQuc2VhcmNoUGFyYW1zICYmIFVSTFNlYXJjaFBhcmFtcy5wcm90b3R5cGUuaXNQcm90b3R5cGVPZihib2R5KSkge1xuICAgICAgICB0aGlzLl9ib2R5VGV4dCA9IGJvZHkudG9TdHJpbmcoKVxuICAgICAgfSBlbHNlIGlmIChzdXBwb3J0LmFycmF5QnVmZmVyICYmIHN1cHBvcnQuYmxvYiAmJiBpc0RhdGFWaWV3KGJvZHkpKSB7XG4gICAgICAgIHRoaXMuX2JvZHlBcnJheUJ1ZmZlciA9IGJ1ZmZlckNsb25lKGJvZHkuYnVmZmVyKVxuICAgICAgICAvLyBJRSAxMC0xMSBjYW4ndCBoYW5kbGUgYSBEYXRhVmlldyBib2R5LlxuICAgICAgICB0aGlzLl9ib2R5SW5pdCA9IG5ldyBCbG9iKFt0aGlzLl9ib2R5QXJyYXlCdWZmZXJdKVxuICAgICAgfSBlbHNlIGlmIChzdXBwb3J0LmFycmF5QnVmZmVyICYmIChBcnJheUJ1ZmZlci5wcm90b3R5cGUuaXNQcm90b3R5cGVPZihib2R5KSB8fCBpc0FycmF5QnVmZmVyVmlldyhib2R5KSkpIHtcbiAgICAgICAgdGhpcy5fYm9keUFycmF5QnVmZmVyID0gYnVmZmVyQ2xvbmUoYm9keSlcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcigndW5zdXBwb3J0ZWQgQm9keUluaXQgdHlwZScpXG4gICAgICB9XG5cbiAgICAgIGlmICghdGhpcy5oZWFkZXJzLmdldCgnY29udGVudC10eXBlJykpIHtcbiAgICAgICAgaWYgKHR5cGVvZiBib2R5ID09PSAnc3RyaW5nJykge1xuICAgICAgICAgIHRoaXMuaGVhZGVycy5zZXQoJ2NvbnRlbnQtdHlwZScsICd0ZXh0L3BsYWluO2NoYXJzZXQ9VVRGLTgnKVxuICAgICAgICB9IGVsc2UgaWYgKHRoaXMuX2JvZHlCbG9iICYmIHRoaXMuX2JvZHlCbG9iLnR5cGUpIHtcbiAgICAgICAgICB0aGlzLmhlYWRlcnMuc2V0KCdjb250ZW50LXR5cGUnLCB0aGlzLl9ib2R5QmxvYi50eXBlKVxuICAgICAgICB9IGVsc2UgaWYgKHN1cHBvcnQuc2VhcmNoUGFyYW1zICYmIFVSTFNlYXJjaFBhcmFtcy5wcm90b3R5cGUuaXNQcm90b3R5cGVPZihib2R5KSkge1xuICAgICAgICAgIHRoaXMuaGVhZGVycy5zZXQoJ2NvbnRlbnQtdHlwZScsICdhcHBsaWNhdGlvbi94LXd3dy1mb3JtLXVybGVuY29kZWQ7Y2hhcnNldD1VVEYtOCcpXG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAoc3VwcG9ydC5ibG9iKSB7XG4gICAgICB0aGlzLmJsb2IgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgdmFyIHJlamVjdGVkID0gY29uc3VtZWQodGhpcylcbiAgICAgICAgaWYgKHJlamVjdGVkKSB7XG4gICAgICAgICAgcmV0dXJuIHJlamVjdGVkXG4gICAgICAgIH1cblxuICAgICAgICBpZiAodGhpcy5fYm9keUJsb2IpIHtcbiAgICAgICAgICByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKHRoaXMuX2JvZHlCbG9iKVxuICAgICAgICB9IGVsc2UgaWYgKHRoaXMuX2JvZHlBcnJheUJ1ZmZlcikge1xuICAgICAgICAgIHJldHVybiBQcm9taXNlLnJlc29sdmUobmV3IEJsb2IoW3RoaXMuX2JvZHlBcnJheUJ1ZmZlcl0pKVxuICAgICAgICB9IGVsc2UgaWYgKHRoaXMuX2JvZHlGb3JtRGF0YSkge1xuICAgICAgICAgIHRocm93IG5ldyBFcnJvcignY291bGQgbm90IHJlYWQgRm9ybURhdGEgYm9keSBhcyBibG9iJylcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKG5ldyBCbG9iKFt0aGlzLl9ib2R5VGV4dF0pKVxuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIHRoaXMuYXJyYXlCdWZmZXIgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgaWYgKHRoaXMuX2JvZHlBcnJheUJ1ZmZlcikge1xuICAgICAgICAgIHJldHVybiBjb25zdW1lZCh0aGlzKSB8fCBQcm9taXNlLnJlc29sdmUodGhpcy5fYm9keUFycmF5QnVmZmVyKVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHJldHVybiB0aGlzLmJsb2IoKS50aGVuKHJlYWRCbG9iQXNBcnJheUJ1ZmZlcilcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cblxuICAgIHRoaXMudGV4dCA9IGZ1bmN0aW9uKCkge1xuICAgICAgdmFyIHJlamVjdGVkID0gY29uc3VtZWQodGhpcylcbiAgICAgIGlmIChyZWplY3RlZCkge1xuICAgICAgICByZXR1cm4gcmVqZWN0ZWRcbiAgICAgIH1cblxuICAgICAgaWYgKHRoaXMuX2JvZHlCbG9iKSB7XG4gICAgICAgIHJldHVybiByZWFkQmxvYkFzVGV4dCh0aGlzLl9ib2R5QmxvYilcbiAgICAgIH0gZWxzZSBpZiAodGhpcy5fYm9keUFycmF5QnVmZmVyKSB7XG4gICAgICAgIHJldHVybiBQcm9taXNlLnJlc29sdmUocmVhZEFycmF5QnVmZmVyQXNUZXh0KHRoaXMuX2JvZHlBcnJheUJ1ZmZlcikpXG4gICAgICB9IGVsc2UgaWYgKHRoaXMuX2JvZHlGb3JtRGF0YSkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ2NvdWxkIG5vdCByZWFkIEZvcm1EYXRhIGJvZHkgYXMgdGV4dCcpXG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKHRoaXMuX2JvZHlUZXh0KVxuICAgICAgfVxuICAgIH1cblxuICAgIGlmIChzdXBwb3J0LmZvcm1EYXRhKSB7XG4gICAgICB0aGlzLmZvcm1EYXRhID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIHJldHVybiB0aGlzLnRleHQoKS50aGVuKGRlY29kZSlcbiAgICAgIH1cbiAgICB9XG5cbiAgICB0aGlzLmpzb24gPSBmdW5jdGlvbigpIHtcbiAgICAgIHJldHVybiB0aGlzLnRleHQoKS50aGVuKEpTT04ucGFyc2UpXG4gICAgfVxuXG4gICAgcmV0dXJuIHRoaXNcbiAgfVxuXG4gIC8vIEhUVFAgbWV0aG9kcyB3aG9zZSBjYXBpdGFsaXphdGlvbiBzaG91bGQgYmUgbm9ybWFsaXplZFxuICB2YXIgbWV0aG9kcyA9IFsnREVMRVRFJywgJ0dFVCcsICdIRUFEJywgJ09QVElPTlMnLCAnUE9TVCcsICdQVVQnXVxuXG4gIGZ1bmN0aW9uIG5vcm1hbGl6ZU1ldGhvZChtZXRob2QpIHtcbiAgICB2YXIgdXBjYXNlZCA9IG1ldGhvZC50b1VwcGVyQ2FzZSgpXG4gICAgcmV0dXJuIChtZXRob2RzLmluZGV4T2YodXBjYXNlZCkgPiAtMSkgPyB1cGNhc2VkIDogbWV0aG9kXG4gIH1cblxuICBmdW5jdGlvbiBSZXF1ZXN0KGlucHV0LCBvcHRpb25zKSB7XG4gICAgb3B0aW9ucyA9IG9wdGlvbnMgfHwge31cbiAgICB2YXIgYm9keSA9IG9wdGlvbnMuYm9keVxuXG4gICAgaWYgKGlucHV0IGluc3RhbmNlb2YgUmVxdWVzdCkge1xuICAgICAgaWYgKGlucHV0LmJvZHlVc2VkKSB7XG4gICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ0FscmVhZHkgcmVhZCcpXG4gICAgICB9XG4gICAgICB0aGlzLnVybCA9IGlucHV0LnVybFxuICAgICAgdGhpcy5jcmVkZW50aWFscyA9IGlucHV0LmNyZWRlbnRpYWxzXG4gICAgICBpZiAoIW9wdGlvbnMuaGVhZGVycykge1xuICAgICAgICB0aGlzLmhlYWRlcnMgPSBuZXcgSGVhZGVycyhpbnB1dC5oZWFkZXJzKVxuICAgICAgfVxuICAgICAgdGhpcy5tZXRob2QgPSBpbnB1dC5tZXRob2RcbiAgICAgIHRoaXMubW9kZSA9IGlucHV0Lm1vZGVcbiAgICAgIGlmICghYm9keSAmJiBpbnB1dC5fYm9keUluaXQgIT0gbnVsbCkge1xuICAgICAgICBib2R5ID0gaW5wdXQuX2JvZHlJbml0XG4gICAgICAgIGlucHV0LmJvZHlVc2VkID0gdHJ1ZVxuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLnVybCA9IFN0cmluZyhpbnB1dClcbiAgICB9XG5cbiAgICB0aGlzLmNyZWRlbnRpYWxzID0gb3B0aW9ucy5jcmVkZW50aWFscyB8fCB0aGlzLmNyZWRlbnRpYWxzIHx8ICdvbWl0J1xuICAgIGlmIChvcHRpb25zLmhlYWRlcnMgfHwgIXRoaXMuaGVhZGVycykge1xuICAgICAgdGhpcy5oZWFkZXJzID0gbmV3IEhlYWRlcnMob3B0aW9ucy5oZWFkZXJzKVxuICAgIH1cbiAgICB0aGlzLm1ldGhvZCA9IG5vcm1hbGl6ZU1ldGhvZChvcHRpb25zLm1ldGhvZCB8fCB0aGlzLm1ldGhvZCB8fCAnR0VUJylcbiAgICB0aGlzLm1vZGUgPSBvcHRpb25zLm1vZGUgfHwgdGhpcy5tb2RlIHx8IG51bGxcbiAgICB0aGlzLnJlZmVycmVyID0gbnVsbFxuXG4gICAgaWYgKCh0aGlzLm1ldGhvZCA9PT0gJ0dFVCcgfHwgdGhpcy5tZXRob2QgPT09ICdIRUFEJykgJiYgYm9keSkge1xuICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcignQm9keSBub3QgYWxsb3dlZCBmb3IgR0VUIG9yIEhFQUQgcmVxdWVzdHMnKVxuICAgIH1cbiAgICB0aGlzLl9pbml0Qm9keShib2R5KVxuICB9XG5cbiAgUmVxdWVzdC5wcm90b3R5cGUuY2xvbmUgPSBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gbmV3IFJlcXVlc3QodGhpcywgeyBib2R5OiB0aGlzLl9ib2R5SW5pdCB9KVxuICB9XG5cbiAgZnVuY3Rpb24gZGVjb2RlKGJvZHkpIHtcbiAgICB2YXIgZm9ybSA9IG5ldyBGb3JtRGF0YSgpXG4gICAgYm9keS50cmltKCkuc3BsaXQoJyYnKS5mb3JFYWNoKGZ1bmN0aW9uKGJ5dGVzKSB7XG4gICAgICBpZiAoYnl0ZXMpIHtcbiAgICAgICAgdmFyIHNwbGl0ID0gYnl0ZXMuc3BsaXQoJz0nKVxuICAgICAgICB2YXIgbmFtZSA9IHNwbGl0LnNoaWZ0KCkucmVwbGFjZSgvXFwrL2csICcgJylcbiAgICAgICAgdmFyIHZhbHVlID0gc3BsaXQuam9pbignPScpLnJlcGxhY2UoL1xcKy9nLCAnICcpXG4gICAgICAgIGZvcm0uYXBwZW5kKGRlY29kZVVSSUNvbXBvbmVudChuYW1lKSwgZGVjb2RlVVJJQ29tcG9uZW50KHZhbHVlKSlcbiAgICAgIH1cbiAgICB9KVxuICAgIHJldHVybiBmb3JtXG4gIH1cblxuICBmdW5jdGlvbiBwYXJzZUhlYWRlcnMocmF3SGVhZGVycykge1xuICAgIHZhciBoZWFkZXJzID0gbmV3IEhlYWRlcnMoKVxuICAgIHJhd0hlYWRlcnMuc3BsaXQoL1xccj9cXG4vKS5mb3JFYWNoKGZ1bmN0aW9uKGxpbmUpIHtcbiAgICAgIHZhciBwYXJ0cyA9IGxpbmUuc3BsaXQoJzonKVxuICAgICAgdmFyIGtleSA9IHBhcnRzLnNoaWZ0KCkudHJpbSgpXG4gICAgICBpZiAoa2V5KSB7XG4gICAgICAgIHZhciB2YWx1ZSA9IHBhcnRzLmpvaW4oJzonKS50cmltKClcbiAgICAgICAgaGVhZGVycy5hcHBlbmQoa2V5LCB2YWx1ZSlcbiAgICAgIH1cbiAgICB9KVxuICAgIHJldHVybiBoZWFkZXJzXG4gIH1cblxuICBCb2R5LmNhbGwoUmVxdWVzdC5wcm90b3R5cGUpXG5cbiAgZnVuY3Rpb24gUmVzcG9uc2UoYm9keUluaXQsIG9wdGlvbnMpIHtcbiAgICBpZiAoIW9wdGlvbnMpIHtcbiAgICAgIG9wdGlvbnMgPSB7fVxuICAgIH1cblxuICAgIHRoaXMudHlwZSA9ICdkZWZhdWx0J1xuICAgIHRoaXMuc3RhdHVzID0gJ3N0YXR1cycgaW4gb3B0aW9ucyA/IG9wdGlvbnMuc3RhdHVzIDogMjAwXG4gICAgdGhpcy5vayA9IHRoaXMuc3RhdHVzID49IDIwMCAmJiB0aGlzLnN0YXR1cyA8IDMwMFxuICAgIHRoaXMuc3RhdHVzVGV4dCA9ICdzdGF0dXNUZXh0JyBpbiBvcHRpb25zID8gb3B0aW9ucy5zdGF0dXNUZXh0IDogJ09LJ1xuICAgIHRoaXMuaGVhZGVycyA9IG5ldyBIZWFkZXJzKG9wdGlvbnMuaGVhZGVycylcbiAgICB0aGlzLnVybCA9IG9wdGlvbnMudXJsIHx8ICcnXG4gICAgdGhpcy5faW5pdEJvZHkoYm9keUluaXQpXG4gIH1cblxuICBCb2R5LmNhbGwoUmVzcG9uc2UucHJvdG90eXBlKVxuXG4gIFJlc3BvbnNlLnByb3RvdHlwZS5jbG9uZSA9IGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiBuZXcgUmVzcG9uc2UodGhpcy5fYm9keUluaXQsIHtcbiAgICAgIHN0YXR1czogdGhpcy5zdGF0dXMsXG4gICAgICBzdGF0dXNUZXh0OiB0aGlzLnN0YXR1c1RleHQsXG4gICAgICBoZWFkZXJzOiBuZXcgSGVhZGVycyh0aGlzLmhlYWRlcnMpLFxuICAgICAgdXJsOiB0aGlzLnVybFxuICAgIH0pXG4gIH1cblxuICBSZXNwb25zZS5lcnJvciA9IGZ1bmN0aW9uKCkge1xuICAgIHZhciByZXNwb25zZSA9IG5ldyBSZXNwb25zZShudWxsLCB7c3RhdHVzOiAwLCBzdGF0dXNUZXh0OiAnJ30pXG4gICAgcmVzcG9uc2UudHlwZSA9ICdlcnJvcidcbiAgICByZXR1cm4gcmVzcG9uc2VcbiAgfVxuXG4gIHZhciByZWRpcmVjdFN0YXR1c2VzID0gWzMwMSwgMzAyLCAzMDMsIDMwNywgMzA4XVxuXG4gIFJlc3BvbnNlLnJlZGlyZWN0ID0gZnVuY3Rpb24odXJsLCBzdGF0dXMpIHtcbiAgICBpZiAocmVkaXJlY3RTdGF0dXNlcy5pbmRleE9mKHN0YXR1cykgPT09IC0xKSB7XG4gICAgICB0aHJvdyBuZXcgUmFuZ2VFcnJvcignSW52YWxpZCBzdGF0dXMgY29kZScpXG4gICAgfVxuXG4gICAgcmV0dXJuIG5ldyBSZXNwb25zZShudWxsLCB7c3RhdHVzOiBzdGF0dXMsIGhlYWRlcnM6IHtsb2NhdGlvbjogdXJsfX0pXG4gIH1cblxuICBzZWxmLkhlYWRlcnMgPSBIZWFkZXJzXG4gIHNlbGYuUmVxdWVzdCA9IFJlcXVlc3RcbiAgc2VsZi5SZXNwb25zZSA9IFJlc3BvbnNlXG5cbiAgc2VsZi5mZXRjaCA9IGZ1bmN0aW9uKGlucHV0LCBpbml0KSB7XG4gICAgcmV0dXJuIG5ldyBQcm9taXNlKGZ1bmN0aW9uKHJlc29sdmUsIHJlamVjdCkge1xuICAgICAgdmFyIHJlcXVlc3QgPSBuZXcgUmVxdWVzdChpbnB1dCwgaW5pdClcbiAgICAgIHZhciB4aHIgPSBuZXcgWE1MSHR0cFJlcXVlc3QoKVxuXG4gICAgICB4aHIub25sb2FkID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIHZhciBvcHRpb25zID0ge1xuICAgICAgICAgIHN0YXR1czogeGhyLnN0YXR1cyxcbiAgICAgICAgICBzdGF0dXNUZXh0OiB4aHIuc3RhdHVzVGV4dCxcbiAgICAgICAgICBoZWFkZXJzOiBwYXJzZUhlYWRlcnMoeGhyLmdldEFsbFJlc3BvbnNlSGVhZGVycygpIHx8ICcnKVxuICAgICAgICB9XG4gICAgICAgIG9wdGlvbnMudXJsID0gJ3Jlc3BvbnNlVVJMJyBpbiB4aHIgPyB4aHIucmVzcG9uc2VVUkwgOiBvcHRpb25zLmhlYWRlcnMuZ2V0KCdYLVJlcXVlc3QtVVJMJylcbiAgICAgICAgdmFyIGJvZHkgPSAncmVzcG9uc2UnIGluIHhociA/IHhoci5yZXNwb25zZSA6IHhoci5yZXNwb25zZVRleHRcbiAgICAgICAgcmVzb2x2ZShuZXcgUmVzcG9uc2UoYm9keSwgb3B0aW9ucykpXG4gICAgICB9XG5cbiAgICAgIHhoci5vbmVycm9yID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIHJlamVjdChuZXcgVHlwZUVycm9yKCdOZXR3b3JrIHJlcXVlc3QgZmFpbGVkJykpXG4gICAgICB9XG5cbiAgICAgIHhoci5vbnRpbWVvdXQgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgcmVqZWN0KG5ldyBUeXBlRXJyb3IoJ05ldHdvcmsgcmVxdWVzdCBmYWlsZWQnKSlcbiAgICAgIH1cblxuICAgICAgeGhyLm9wZW4ocmVxdWVzdC5tZXRob2QsIHJlcXVlc3QudXJsLCB0cnVlKVxuXG4gICAgICBpZiAocmVxdWVzdC5jcmVkZW50aWFscyA9PT0gJ2luY2x1ZGUnKSB7XG4gICAgICAgIHhoci53aXRoQ3JlZGVudGlhbHMgPSB0cnVlXG4gICAgICB9XG5cbiAgICAgIGlmICgncmVzcG9uc2VUeXBlJyBpbiB4aHIgJiYgc3VwcG9ydC5ibG9iKSB7XG4gICAgICAgIHhoci5yZXNwb25zZVR5cGUgPSAnYmxvYidcbiAgICAgIH1cblxuICAgICAgcmVxdWVzdC5oZWFkZXJzLmZvckVhY2goZnVuY3Rpb24odmFsdWUsIG5hbWUpIHtcbiAgICAgICAgeGhyLnNldFJlcXVlc3RIZWFkZXIobmFtZSwgdmFsdWUpXG4gICAgICB9KVxuXG4gICAgICB4aHIuc2VuZCh0eXBlb2YgcmVxdWVzdC5fYm9keUluaXQgPT09ICd1bmRlZmluZWQnID8gbnVsbCA6IHJlcXVlc3QuX2JvZHlJbml0KVxuICAgIH0pXG4gIH1cbiAgc2VsZi5mZXRjaC5wb2x5ZmlsbCA9IHRydWVcbn0pKHR5cGVvZiBzZWxmICE9PSAndW5kZWZpbmVkJyA/IHNlbGYgOiB0aGlzKTtcbiIsIid1c2Ugc3RyaWN0JztcblxuY29uc3QgdXRpbHMgPSByZXF1aXJlKCcuL3V0aWxzJyk7XG5jb25zdCBkZWZhdWx0cyA9IHJlcXVpcmUoJy4vZGVmYXVsdHMnKTtcbmNvbnN0IGl0ZW1Ub0NTTEpTT04gPSByZXF1aXJlKCcuLi96b3Rlcm8tc2hpbS9pdGVtLXRvLWNzbC1qc29uJyk7XG5jb25zdCBkYXRlVG9TcWwgPSByZXF1aXJlKCcuLi96b3Rlcm8tc2hpbS9kYXRlLXRvLXNxbCcpO1xuY29uc3QgWyBDT01QTEVURSwgTVVMVElQTEVfSVRFTVMsIEZBSUxFRCBdID0gWyAnQ09NUExFVEUnLCAnTVVMVElQTEVfSVRFTVMnLCAnRkFJTEVEJyBdO1xuXG5jbGFzcyBab3Rlcm9CaWIge1xuXHRjb25zdHJ1Y3RvcihvcHRzKSB7XG5cdFx0dGhpcy5vcHRzID0ge1xuXHRcdFx0c2Vzc2lvbmlkOiB1dGlscy51dWlkNCgpLFxuXHRcdFx0Li4uZGVmYXVsdHMoKSxcblx0XHRcdC4uLm9wdHNcblx0XHR9O1xuXG5cdFx0aWYodGhpcy5vcHRzLnBlcnNpc3QgJiYgdGhpcy5vcHRzLnN0b3JhZ2UpIHtcblx0XHRcdGlmKCEoJ2dldEl0ZW0nIGluIHRoaXMub3B0cy5zdG9yYWdlIHx8XG5cdFx0XHRcdCdzZXRJdGVtJyBpbiB0aGlzLm9wdHMuc3RvcmFnZSB8fFxuXHRcdFx0XHQnY2xlYXInIGluIHRoaXMub3B0cy5zdG9yYWdlXG5cdFx0XHQpKSB7XG5cdFx0XHRcdHRocm93IG5ldyBFcnJvcignSW52YWxpZCBzdG9yYWdlIGVuZ2luZSBwcm92aWRlZCcpO1xuXHRcdFx0fVxuXHRcdFx0aWYodGhpcy5vcHRzLm92ZXJyaWRlKSB7XG5cdFx0XHRcdHRoaXMuY2xlYXJJdGVtcygpO1xuXHRcdFx0fVxuXHRcdFx0dGhpcy5pdGVtcyA9IFsuLi50aGlzLm9wdHMuaW5pdGlhbEl0ZW1zLCAuLi50aGlzLmdldEl0ZW1zU3RvcmFnZSgpXTtcblx0XHRcdHRoaXMuc2V0SXRlbXNTdG9yYWdlKHRoaXMuaXRlbXMpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHR0aGlzLml0ZW1zID0gWy4uLnRoaXMub3B0cy5pbml0aWFsSXRlbXNdO1xuXHRcdH1cblx0fVxuXG5cdGdldEl0ZW1zU3RvcmFnZSgpIHtcblx0XHRsZXQgaXRlbXMgPSB0aGlzLm9wdHMuc3RvcmFnZS5nZXRJdGVtKGAke3RoaXMub3B0cy5zdG9yYWdlUHJlZml4fS1pdGVtc2ApO1xuXHRcdHJldHVybiBpdGVtcyA/IEpTT04ucGFyc2UoaXRlbXMpIDogW107XG5cdH1cblxuXHRzZXRJdGVtc1N0b3JhZ2UoaXRlbXMpIHtcblx0XHR0aGlzLm9wdHMuc3RvcmFnZS5zZXRJdGVtKFxuXHRcdFx0YCR7dGhpcy5vcHRzLnN0b3JhZ2VQcmVmaXh9LWl0ZW1zYCxcblx0XHRcdEpTT04uc3RyaW5naWZ5KGl0ZW1zKVxuXHRcdCk7XG5cdH1cblxuXHRhZGRJdGVtKGl0ZW0pIHtcblx0XHR0aGlzLml0ZW1zLnB1c2goaXRlbSk7XG5cdFx0aWYodGhpcy5vcHRzLnBlcnNpc3QpIHtcblx0XHRcdHRoaXMuc2V0SXRlbXNTdG9yYWdlKHRoaXMuaXRlbXMpO1xuXHRcdH1cblx0fVxuXG5cdHVwZGF0ZUl0ZW0oaW5kZXgsIGl0ZW0pIHtcblx0XHR0aGlzLml0ZW1zW2luZGV4XSA9IGl0ZW07XG5cdFx0aWYodGhpcy5vcHRzLnBlcnNpc3QpIHtcblx0XHRcdHRoaXMuc2V0SXRlbXNTdG9yYWdlKHRoaXMuaXRlbXMpO1xuXHRcdH1cblx0fVxuXG5cdHJlbW92ZUl0ZW0oaXRlbSkge1xuXHRcdGxldCBpbmRleCA9IHRoaXMuaXRlbXMuaW5kZXhPZihpdGVtKTtcblx0XHRpZihpbmRleCAhPT0gLTEpIHtcblx0XHRcdHRoaXMuaXRlbXMuc3BsaWNlKGluZGV4LCAxKTtcblx0XHRcdGlmKHRoaXMub3B0cy5wZXJzaXN0KSB7XG5cdFx0XHRcdHRoaXMuc2V0SXRlbXNTdG9yYWdlKHRoaXMuaXRlbXMpO1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIGl0ZW07XG5cdFx0fVxuXHRcdHJldHVybiBmYWxzZTtcblx0fVxuXG5cdGNsZWFySXRlbXMoKSB7XG5cdFx0dGhpcy5pdGVtcyA9IFtdO1xuXHRcdGlmKHRoaXMub3B0cy5wZXJzaXN0KSB7XG5cdFx0XHR0aGlzLnNldEl0ZW1zU3RvcmFnZSh0aGlzLml0ZW1zKTtcblx0XHR9XG5cdH1cblxuXHRnZXQgaXRlbXNDU0woKSB7XG5cdFx0cmV0dXJuIHRoaXMuaXRlbXMubWFwKGkgPT4gaXRlbVRvQ1NMSlNPTihpKSlcblx0fVxuXG5cdGdldCBpdGVtc1JhdygpIHtcblx0XHRyZXR1cm4gdGhpcy5pdGVtcztcblx0fVxuXG5cdGFzeW5jIGV4cG9ydEl0ZW1zKGZvcm1hdCkge1xuXHRcdGxldCB0cmFuc2xhdGlvblNlcnZlclVybCA9IGAke3RoaXMub3B0cy50cmFuc2xhdGlvblNlcnZlclVybH0vJHt0aGlzLm9wdHMudHJhbnNsYXRpb25TZXJ2ZXJQcmVmaXh9ZXhwb3J0P2Zvcm1hdD0ke2Zvcm1hdH1gO1xuXHRcdGxldCBmZXRjaE9wdGlvbnMgPSB7XG5cdFx0XHRtZXRob2Q6ICdQT1NUJyxcblx0XHRcdGhlYWRlcnM6IHtcblx0XHRcdFx0J0NvbnRlbnQtVHlwZSc6ICdhcHBsaWNhdGlvbi9qc29uJ1xuXHRcdFx0fSxcblx0XHRcdGJvZHk6IEpTT04uc3RyaW5naWZ5KHRoaXMuaXRlbXMuZmlsdGVyKGkgPT4gJ2tleScgaW4gaSApKSxcblx0XHRcdC4uLnRoaXMub3B0cy5pbml0XG5cdFx0fVxuXHRcdGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgZmV0Y2godHJhbnNsYXRpb25TZXJ2ZXJVcmwsIGZldGNoT3B0aW9ucyk7XG5cdFx0aWYocmVzcG9uc2Uub2spIHtcblx0XHRcdHJldHVybiBhd2FpdCByZXNwb25zZS50ZXh0KCk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHRocm93IG5ldyBFcnJvcignRmFpbGVkIHRvIGV4cG9ydCBpdGVtcycpO1xuXHRcdH1cblx0fVxuXG5cdGFzeW5jIHRyYW5zbGF0ZUlkZW50aWZpZXIoaWRlbnRpZmllciwgLi4uYXJncykge1xuXHRcdGxldCB0cmFuc2xhdGlvblNlcnZlclVybCA9IGAke3RoaXMub3B0cy50cmFuc2xhdGlvblNlcnZlclVybH0vJHt0aGlzLm9wdHMudHJhbnNsYXRpb25TZXJ2ZXJQcmVmaXh9c2VhcmNoYDtcblx0XHRsZXQgaW5pdCA9IHtcblx0XHRcdG1ldGhvZDogJ1BPU1QnLFxuXHRcdFx0aGVhZGVyczoge1xuXHRcdFx0XHQnQ29udGVudC1UeXBlJzogJ3RleHQvcGxhaW4nXG5cdFx0XHR9LFxuXHRcdFx0Ym9keTogaWRlbnRpZmllcixcblx0XHRcdC4uLnRoaXMub3B0cy5pbml0XG5cdFx0fTtcblxuXHRcdHJldHVybiBhd2FpdCB0aGlzLnRyYW5zbGF0ZSh0cmFuc2xhdGlvblNlcnZlclVybCwgaW5pdCwgLi4uYXJncyk7XG5cdH1cblxuXHRhc3luYyB0cmFuc2xhdGVVcmxJdGVtcyh1cmwsIGl0ZW1zLCAuLi5hcmdzKSB7XG5cdFx0bGV0IHRyYW5zbGF0aW9uU2VydmVyVXJsID0gYCR7dGhpcy5vcHRzLnRyYW5zbGF0aW9uU2VydmVyVXJsfS8ke3RoaXMub3B0cy50cmFuc2xhdGlvblNlcnZlclByZWZpeH13ZWJgO1xuXHRcdGxldCBzZXNzaW9uaWQgPSB0aGlzLm9wdHMuc2Vzc2lvbmlkO1xuXHRcdGxldCBkYXRhID0geyB1cmwsIGl0ZW1zLCBzZXNzaW9uaWQsIC4uLnRoaXMub3B0cy5yZXF1ZXN0IH07XG5cblx0XHRsZXQgaW5pdCA9IHtcblx0XHRcdG1ldGhvZDogJ1BPU1QnLFxuXHRcdFx0aGVhZGVyczoge1xuXHRcdFx0XHQnQ29udGVudC1UeXBlJzogJ2FwcGxpY2F0aW9uL2pzb24nXG5cdFx0XHR9LFxuXHRcdFx0Ym9keTogSlNPTi5zdHJpbmdpZnkoZGF0YSksXG5cdFx0XHQuLi50aGlzLm9wdHMuaW5pdFxuXHRcdH07XG5cblx0XHRyZXR1cm4gYXdhaXQgdGhpcy50cmFuc2xhdGUodHJhbnNsYXRpb25TZXJ2ZXJVcmwsIGluaXQsIC4uLmFyZ3MpO1xuXHR9XG5cblx0YXN5bmMgdHJhbnNsYXRlVXJsKHVybCwgLi4uYXJncykge1xuXHRcdGxldCB0cmFuc2xhdGlvblNlcnZlclVybCA9IGAke3RoaXMub3B0cy50cmFuc2xhdGlvblNlcnZlclVybH0vJHt0aGlzLm9wdHMudHJhbnNsYXRpb25TZXJ2ZXJQcmVmaXh9d2ViYDtcblx0XHRsZXQgc2Vzc2lvbmlkID0gdGhpcy5vcHRzLnNlc3Npb25pZDtcblx0XHRsZXQgZGF0YSA9IHsgdXJsLCBzZXNzaW9uaWQsIC4uLnRoaXMub3B0cy5yZXF1ZXN0IH07XG5cblx0XHRsZXQgaW5pdCA9IHtcblx0XHRcdG1ldGhvZDogJ1BPU1QnLFxuXHRcdFx0aGVhZGVyczoge1xuXHRcdFx0XHQnQ29udGVudC1UeXBlJzogJ2FwcGxpY2F0aW9uL2pzb24nXG5cdFx0XHR9LFxuXHRcdFx0Ym9keTogSlNPTi5zdHJpbmdpZnkoZGF0YSksXG5cdFx0XHQuLi50aGlzLm9wdHMuaW5pdFxuXHRcdH07XG5cblx0XHRyZXR1cm4gYXdhaXQgdGhpcy50cmFuc2xhdGUodHJhbnNsYXRpb25TZXJ2ZXJVcmwsIGluaXQsIC4uLmFyZ3MpO1xuXHR9XG5cblx0YXN5bmMgdHJhbnNsYXRlKHVybCwgZmV0Y2hPcHRpb25zLCBhZGQ9dHJ1ZSkge1xuXHRcdGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgZmV0Y2godXJsLCBmZXRjaE9wdGlvbnMpO1xuXHRcdHZhciBpdGVtcywgcmVzdWx0O1xuXG5cdFx0aWYocmVzcG9uc2Uub2spIHtcblx0XHRcdGl0ZW1zID0gYXdhaXQgcmVzcG9uc2UuanNvbigpO1xuXHRcdFx0aWYoQXJyYXkuaXNBcnJheShpdGVtcykpIHtcblx0XHRcdFx0aXRlbXMuZm9yRWFjaChpdGVtID0+IHtcblx0XHRcdFx0XHRpZihpdGVtLmFjY2Vzc0RhdGUgPT09ICdDVVJSRU5UX1RJTUVTVEFNUCcpIHtcblx0XHRcdFx0XHRcdGNvbnN0IGR0ID0gbmV3IERhdGUoRGF0ZS5ub3coKSk7XG5cdFx0XHRcdFx0XHRpdGVtLmFjY2Vzc0RhdGUgPSBkYXRlVG9TcWwoZHQsIHRydWUpO1xuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdGlmKGFkZCkge1xuXHRcdFx0XHRcdFx0dGhpcy5hZGRJdGVtKGl0ZW0pO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSk7XG5cdFx0XHR9XG5cdFx0XHRyZXN1bHQgPSBBcnJheS5pc0FycmF5KGl0ZW1zKSA/IENPTVBMRVRFIDogRkFJTEVEO1xuXHRcdH0gZWxzZSBpZihyZXNwb25zZS5zdGF0dXMgPT09IDMwMCkge1xuXHRcdFx0aXRlbXMgPSBhd2FpdCByZXNwb25zZS5qc29uKCk7XG5cdFx0XHRyZXN1bHQgPSBNVUxUSVBMRV9JVEVNUztcblx0XHR9IGVsc2Uge1xuXHRcdFx0cmVzdWx0ID0gRkFJTEVEXG5cdFx0fVxuXG5cdFx0cmV0dXJuIHsgcmVzdWx0LCBpdGVtcywgcmVzcG9uc2UgfTtcblx0fVxuXG5cdHN0YXRpYyBnZXQgQ09NUExFVEUoKSB7IHJldHVybiBDT01QTEVURSB9XG5cdHN0YXRpYyBnZXQgTVVMVElQTEVfSVRFTVMoKSB7IHJldHVybiBNVUxUSVBMRV9JVEVNUyB9XG5cdHN0YXRpYyBnZXQgRkFJTEVEKCkgeyByZXR1cm4gRkFJTEVEIH1cbn1cblxubW9kdWxlLmV4cG9ydHMgPSBab3Rlcm9CaWI7XG4iLCIndXNlIHN0cmljdCc7XG5cbm1vZHVsZS5leHBvcnRzID0gKCkgPT4gKHtcblx0dHJhbnNsYXRpb25TZXJ2ZXJVcmw6IHR5cGVvZiB3aW5kb3cgIT0gJ3VuZGVmaW5lZCcgJiYgd2luZG93LmxvY2F0aW9uLm9yaWdpbiB8fCAnJyxcblx0dHJhbnNsYXRpb25TZXJ2ZXJQcmVmaXg6ICcnLFxuXHRmZXRjaENvbmZpZzoge30sXG5cdGluaXRpYWxJdGVtczogW10sXG5cdHJlcXVlc3Q6IHt9LFxuXHRzdG9yYWdlOiB0eXBlb2Ygd2luZG93ICE9ICd1bmRlZmluZWQnICYmICdsb2NhbFN0b3JhZ2UnIGluIHdpbmRvdyAmJiB3aW5kb3cubG9jYWxTdG9yYWdlIHx8IHt9LFxuXHRwZXJzaXN0OiB0cnVlLFxuXHRvdmVycmlkZTogZmFsc2UsXG5cdHN0b3JhZ2VQcmVmaXg6ICd6b3Rlcm8tYmliJ1xufSk7XG4iLCIndXNlIHN0cmljdCc7XG5cbm1vZHVsZS5leHBvcnRzID0ge1xuXHR1dWlkNDogKCkgPT4gJ3h4eHh4eHh4LXh4eHgtNHh4eC15eHh4LXh4eHh4eHh4eHh4eCcucmVwbGFjZSgvW3h5XS9nLCBjID0+IHtcblx0XHRcdHZhciByID0gTWF0aC5yYW5kb20oKSAqIDE2fDAsXG5cdFx0XHRcdHYgPSBjID09ICd4JyA/IHIgOiAociYweDN8MHg4KTtcblxuXHRcdFx0cmV0dXJuIHYudG9TdHJpbmcoMTYpO1xuXHRcdH0pXG59XG4iLCIndXNlIHN0cmljdCc7XG5cbnJlcXVpcmUoJ2VzNi1wcm9taXNlL2F1dG8nKTtcbnJlcXVpcmUoJ2lzb21vcnBoaWMtZmV0Y2gnKTtcbnJlcXVpcmUoJ2JhYmVsLXJlZ2VuZXJhdG9yLXJ1bnRpbWUnKTtcbmNvbnN0IFpvdGVyb0JpYiA9IHJlcXVpcmUoJy4vYmliL2JpYicpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IFpvdGVyb0JpYjtcbiIsIid1c2Ugc3RyaWN0JztcblxuY29uc3QgY3JlYXRvclR5cGVzID0ge1xuXHQxOiAnYXV0aG9yJyxcblx0MjogJ2NvbnRyaWJ1dG9yJyxcblx0MzogJ2VkaXRvcicsXG5cdDQ6ICd0cmFuc2xhdG9yJyxcblx0NTogJ3Nlcmllc0VkaXRvcicsXG5cdDY6ICdpbnRlcnZpZXdlZScsXG5cdDc6ICdpbnRlcnZpZXdlcicsXG5cdDg6ICdkaXJlY3RvcicsXG5cdDk6ICdzY3JpcHR3cml0ZXInLFxuXHQxMDogJ3Byb2R1Y2VyJyxcblx0MTE6ICdjYXN0TWVtYmVyJyxcblx0MTI6ICdzcG9uc29yJyxcblx0MTM6ICdjb3Vuc2VsJyxcblx0MTQ6ICdpbnZlbnRvcicsXG5cdDE1OiAnYXR0b3JuZXlBZ2VudCcsXG5cdDE2OiAncmVjaXBpZW50Jyxcblx0MTc6ICdwZXJmb3JtZXInLFxuXHQxODogJ2NvbXBvc2VyJyxcblx0MTk6ICd3b3Jkc0J5Jyxcblx0MjA6ICdjYXJ0b2dyYXBoZXInLFxuXHQyMTogJ3Byb2dyYW1tZXInLFxuXHQyMjogJ2FydGlzdCcsXG5cdDIzOiAnY29tbWVudGVyJyxcblx0MjQ6ICdwcmVzZW50ZXInLFxuXHQyNTogJ2d1ZXN0Jyxcblx0MjY6ICdwb2RjYXN0ZXInLFxuXHQyNzogJ3Jldmlld2VkQXV0aG9yJyxcblx0Mjg6ICdjb3Nwb25zb3InLFxuXHQyOTogJ2Jvb2tBdXRob3InXG59O1xuXG5cbi8vcmV2ZXJzZSBsb29rdXBcbk9iamVjdC5rZXlzKGNyZWF0b3JUeXBlcykubWFwKGsgPT4gY3JlYXRvclR5cGVzW2NyZWF0b3JUeXBlc1trXV0gPSBrKTtcbm1vZHVsZS5leHBvcnRzID0gY3JlYXRvclR5cGVzO1xuIiwibW9kdWxlLmV4cG9ydHMgPSB7XG5cdENTTF9OQU1FU19NQVBQSU5HUzoge1xuXHRcdCdhdXRob3InOidhdXRob3InLFxuXHRcdCdlZGl0b3InOidlZGl0b3InLFxuXHRcdCdib29rQXV0aG9yJzonY29udGFpbmVyLWF1dGhvcicsXG5cdFx0J2NvbXBvc2VyJzonY29tcG9zZXInLFxuXHRcdCdkaXJlY3Rvcic6J2RpcmVjdG9yJyxcblx0XHQnaW50ZXJ2aWV3ZXInOidpbnRlcnZpZXdlcicsXG5cdFx0J3JlY2lwaWVudCc6J3JlY2lwaWVudCcsXG5cdFx0J3Jldmlld2VkQXV0aG9yJzoncmV2aWV3ZWQtYXV0aG9yJyxcblx0XHQnc2VyaWVzRWRpdG9yJzonY29sbGVjdGlvbi1lZGl0b3InLFxuXHRcdCd0cmFuc2xhdG9yJzondHJhbnNsYXRvcidcblx0fSxcblxuXHQvKlxuXHQgKiBNYXBwaW5ncyBmb3IgdGV4dCB2YXJpYWJsZXNcblx0ICovXG5cdENTTF9URVhUX01BUFBJTkdTOiB7XG5cdFx0J3RpdGxlJzpbJ3RpdGxlJ10sXG5cdFx0J2NvbnRhaW5lci10aXRsZSc6WydwdWJsaWNhdGlvblRpdGxlJywgICdyZXBvcnRlcicsICdjb2RlJ10sIC8qIHJlcG9ydGVyIGFuZCBjb2RlIHNob3VsZCBtb3ZlIHRvIFNRTCBtYXBwaW5nIHRhYmxlcyAqL1xuXHRcdCdjb2xsZWN0aW9uLXRpdGxlJzpbJ3Nlcmllc1RpdGxlJywgJ3NlcmllcyddLFxuXHRcdCdjb2xsZWN0aW9uLW51bWJlcic6WydzZXJpZXNOdW1iZXInXSxcblx0XHQncHVibGlzaGVyJzpbJ3B1Ymxpc2hlcicsICdkaXN0cmlidXRvciddLCAvKiBkaXN0cmlidXRvciBzaG91bGQgbW92ZSB0byBTUUwgbWFwcGluZyB0YWJsZXMgKi9cblx0XHQncHVibGlzaGVyLXBsYWNlJzpbJ3BsYWNlJ10sXG5cdFx0J2F1dGhvcml0eSc6Wydjb3VydCcsJ2xlZ2lzbGF0aXZlQm9keScsICdpc3N1aW5nQXV0aG9yaXR5J10sXG5cdFx0J3BhZ2UnOlsncGFnZXMnXSxcblx0XHQndm9sdW1lJzpbJ3ZvbHVtZScsICdjb2RlTnVtYmVyJ10sXG5cdFx0J2lzc3VlJzpbJ2lzc3VlJywgJ3ByaW9yaXR5TnVtYmVycyddLFxuXHRcdCdudW1iZXItb2Ytdm9sdW1lcyc6WydudW1iZXJPZlZvbHVtZXMnXSxcblx0XHQnbnVtYmVyLW9mLXBhZ2VzJzpbJ251bVBhZ2VzJ10sXG5cdFx0J2VkaXRpb24nOlsnZWRpdGlvbiddLFxuXHRcdCd2ZXJzaW9uJzpbJ3ZlcnNpb25OdW1iZXInXSxcblx0XHQnc2VjdGlvbic6WydzZWN0aW9uJywgJ2NvbW1pdHRlZSddLFxuXHRcdCdnZW5yZSc6Wyd0eXBlJywgJ3Byb2dyYW1taW5nTGFuZ3VhZ2UnXSxcblx0XHQnc291cmNlJzpbJ2xpYnJhcnlDYXRhbG9nJ10sXG5cdFx0J2RpbWVuc2lvbnMnOiBbJ2FydHdvcmtTaXplJywgJ3J1bm5pbmdUaW1lJ10sXG5cdFx0J21lZGl1bSc6WydtZWRpdW0nLCAnc3lzdGVtJ10sXG5cdFx0J3NjYWxlJzpbJ3NjYWxlJ10sXG5cdFx0J2FyY2hpdmUnOlsnYXJjaGl2ZSddLFxuXHRcdCdhcmNoaXZlX2xvY2F0aW9uJzpbJ2FyY2hpdmVMb2NhdGlvbiddLFxuXHRcdCdldmVudCc6WydtZWV0aW5nTmFtZScsICdjb25mZXJlbmNlTmFtZSddLCAvKiB0aGVzZSBzaG91bGQgYmUgbWFwcGVkIHRvIHRoZSBzYW1lIGJhc2UgZmllbGQgaW4gU1FMIG1hcHBpbmcgdGFibGVzICovXG5cdFx0J2V2ZW50LXBsYWNlJzpbJ3BsYWNlJ10sXG5cdFx0J2Fic3RyYWN0JzpbJ2Fic3RyYWN0Tm90ZSddLFxuXHRcdCdVUkwnOlsndXJsJ10sXG5cdFx0J0RPSSc6WydET0knXSxcblx0XHQnSVNCTic6WydJU0JOJ10sXG5cdFx0J0lTU04nOlsnSVNTTiddLFxuXHRcdCdjYWxsLW51bWJlcic6WydjYWxsTnVtYmVyJywgJ2FwcGxpY2F0aW9uTnVtYmVyJ10sXG5cdFx0J25vdGUnOlsnZXh0cmEnXSxcblx0XHQnbnVtYmVyJzpbJ251bWJlciddLFxuXHRcdCdjaGFwdGVyLW51bWJlcic6WydzZXNzaW9uJ10sXG5cdFx0J3JlZmVyZW5jZXMnOlsnaGlzdG9yeScsICdyZWZlcmVuY2VzJ10sXG5cdFx0J3Nob3J0VGl0bGUnOlsnc2hvcnRUaXRsZSddLFxuXHRcdCdqb3VybmFsQWJicmV2aWF0aW9uJzpbJ2pvdXJuYWxBYmJyZXZpYXRpb24nXSxcblx0XHQnc3RhdHVzJzpbJ2xlZ2FsU3RhdHVzJ10sXG5cdFx0J2xhbmd1YWdlJzpbJ2xhbmd1YWdlJ11cblx0fSxcblx0Q1NMX0RBVEVfTUFQUElOR1M6IHtcblx0XHQnaXNzdWVkJzonZGF0ZScsXG5cdFx0J2FjY2Vzc2VkJzonYWNjZXNzRGF0ZScsXG5cdFx0J3N1Ym1pdHRlZCc6J2ZpbGluZ0RhdGUnXG5cdH0sXG5cdENTTF9UWVBFX01BUFBJTkdTOiB7XG5cdFx0J2Jvb2snOidib29rJyxcblx0XHQnYm9va1NlY3Rpb24nOidjaGFwdGVyJyxcblx0XHQnam91cm5hbEFydGljbGUnOidhcnRpY2xlLWpvdXJuYWwnLFxuXHRcdCdtYWdhemluZUFydGljbGUnOidhcnRpY2xlLW1hZ2F6aW5lJyxcblx0XHQnbmV3c3BhcGVyQXJ0aWNsZSc6J2FydGljbGUtbmV3c3BhcGVyJyxcblx0XHQndGhlc2lzJzondGhlc2lzJyxcblx0XHQnZW5jeWNsb3BlZGlhQXJ0aWNsZSc6J2VudHJ5LWVuY3ljbG9wZWRpYScsXG5cdFx0J2RpY3Rpb25hcnlFbnRyeSc6J2VudHJ5LWRpY3Rpb25hcnknLFxuXHRcdCdjb25mZXJlbmNlUGFwZXInOidwYXBlci1jb25mZXJlbmNlJyxcblx0XHQnbGV0dGVyJzoncGVyc29uYWxfY29tbXVuaWNhdGlvbicsXG5cdFx0J21hbnVzY3JpcHQnOidtYW51c2NyaXB0Jyxcblx0XHQnaW50ZXJ2aWV3JzonaW50ZXJ2aWV3Jyxcblx0XHQnZmlsbSc6J21vdGlvbl9waWN0dXJlJyxcblx0XHQnYXJ0d29yayc6J2dyYXBoaWMnLFxuXHRcdCd3ZWJwYWdlJzond2VicGFnZScsXG5cdFx0J3JlcG9ydCc6J3JlcG9ydCcsXG5cdFx0J2JpbGwnOidiaWxsJyxcblx0XHQnY2FzZSc6J2xlZ2FsX2Nhc2UnLFxuXHRcdCdoZWFyaW5nJzonYmlsbCcsXHRcdFx0XHQvLyA/P1xuXHRcdCdwYXRlbnQnOidwYXRlbnQnLFxuXHRcdCdzdGF0dXRlJzonbGVnaXNsYXRpb24nLFx0XHQvLyA/P1xuXHRcdCdlbWFpbCc6J3BlcnNvbmFsX2NvbW11bmljYXRpb24nLFxuXHRcdCdtYXAnOidtYXAnLFxuXHRcdCdibG9nUG9zdCc6J3Bvc3Qtd2VibG9nJyxcblx0XHQnaW5zdGFudE1lc3NhZ2UnOidwZXJzb25hbF9jb21tdW5pY2F0aW9uJyxcblx0XHQnZm9ydW1Qb3N0JzoncG9zdCcsXG5cdFx0J2F1ZGlvUmVjb3JkaW5nJzonc29uZycsXHRcdC8vID8/XG5cdFx0J3ByZXNlbnRhdGlvbic6J3NwZWVjaCcsXG5cdFx0J3ZpZGVvUmVjb3JkaW5nJzonbW90aW9uX3BpY3R1cmUnLFxuXHRcdCd0dkJyb2FkY2FzdCc6J2Jyb2FkY2FzdCcsXG5cdFx0J3JhZGlvQnJvYWRjYXN0JzonYnJvYWRjYXN0Jyxcblx0XHQncG9kY2FzdCc6J3NvbmcnLFx0XHRcdC8vID8/XG5cdFx0J2NvbXB1dGVyUHJvZ3JhbSc6J2Jvb2snLFx0XHQvLyA/P1xuXHRcdCdkb2N1bWVudCc6J2FydGljbGUnLFxuXHRcdCdub3RlJzonYXJ0aWNsZScsXG5cdFx0J2F0dGFjaG1lbnQnOidhcnRpY2xlJ1xuXHR9XG59O1xuIiwiY29uc3QgbHBhZCA9IHJlcXVpcmUoJy4vbHBhZCcpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IChkYXRlLCB0b1VUQykgPT4ge1xuXHR2YXIgeWVhciwgbW9udGgsIGRheSwgaG91cnMsIG1pbnV0ZXMsIHNlY29uZHM7XG5cdHRyeSB7XG5cdFx0aWYodG9VVEMpIHtcblx0XHRcdHllYXIgPSBkYXRlLmdldFVUQ0Z1bGxZZWFyKCk7XG5cdFx0XHRtb250aCA9IGRhdGUuZ2V0VVRDTW9udGgoKTtcblx0XHRcdGRheSA9IGRhdGUuZ2V0VVRDRGF0ZSgpO1xuXHRcdFx0aG91cnMgPSBkYXRlLmdldFVUQ0hvdXJzKCk7XG5cdFx0XHRtaW51dGVzID0gZGF0ZS5nZXRVVENNaW51dGVzKCk7XG5cdFx0XHRzZWNvbmRzID0gZGF0ZS5nZXRVVENTZWNvbmRzKCk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHllYXIgPSBkYXRlLmdldEZ1bGxZZWFyKCk7XG5cdFx0XHRtb250aCA9IGRhdGUuZ2V0TW9udGgoKTtcblx0XHRcdGRheSA9IGRhdGUuZ2V0RGF0ZSgpO1xuXHRcdFx0aG91cnMgPSBkYXRlLmdldEhvdXJzKCk7XG5cdFx0XHRtaW51dGVzID0gZGF0ZS5nZXRNaW51dGVzKCk7XG5cdFx0XHRzZWNvbmRzID0gZGF0ZS5nZXRTZWNvbmRzKCk7XG5cdFx0fVxuXG5cdFx0eWVhciA9IGxwYWQoeWVhciwgJzAnLCA0KTtcblx0XHRtb250aCA9IGxwYWQobW9udGggKyAxLCAnMCcsIDIpO1xuXHRcdGRheSA9IGxwYWQoZGF5LCAnMCcsIDIpO1xuXHRcdGhvdXJzID0gbHBhZChob3VycywgJzAnLCAyKTtcblx0XHRtaW51dGVzID0gbHBhZChtaW51dGVzLCAnMCcsIDIpO1xuXHRcdHNlY29uZHMgPSBscGFkKHNlY29uZHMsICcwJywgMik7XG5cblx0XHRyZXR1cm4geWVhciArICctJyArIG1vbnRoICsgJy0nICsgZGF5ICsgJyAnXG5cdFx0XHQrIGhvdXJzICsgJzonICsgbWludXRlcyArICc6JyArIHNlY29uZHM7XG5cdH1cblx0Y2F0Y2ggKGUpIHtcblx0XHRyZXR1cm4gJyc7XG5cdH1cbn1cbiIsImNvbnN0IGl0ZW1UeXBlcyA9IHJlcXVpcmUoJy4vaXRlbS10eXBlcycpO1xuY29uc3QgY3JlYXRvclR5cGVzID0gcmVxdWlyZSgnLi9jcmVhdG9yLXR5cGVzJyk7XG5cbm1vZHVsZS5leHBvcnRzID0ge1xuXHRbaXRlbVR5cGVzWzJdXTogY3JlYXRvclR5cGVzWzFdLFxuXHRbaXRlbVR5cGVzWzNdXTogY3JlYXRvclR5cGVzWzFdLFxuXHRbaXRlbVR5cGVzWzRdXTogY3JlYXRvclR5cGVzWzFdLFxuXHRbaXRlbVR5cGVzWzVdXTogY3JlYXRvclR5cGVzWzFdLFxuXHRbaXRlbVR5cGVzWzZdXTogY3JlYXRvclR5cGVzWzFdLFxuXHRbaXRlbVR5cGVzWzddXTogY3JlYXRvclR5cGVzWzFdLFxuXHRbaXRlbVR5cGVzWzhdXTogY3JlYXRvclR5cGVzWzFdLFxuXHRbaXRlbVR5cGVzWzldXTogY3JlYXRvclR5cGVzWzFdLFxuXHRbaXRlbVR5cGVzWzEwXV06IGNyZWF0b3JUeXBlc1s2XSxcblx0W2l0ZW1UeXBlc1sxMV1dOiBjcmVhdG9yVHlwZXNbOF0sXG5cdFtpdGVtVHlwZXNbMTJdXTogY3JlYXRvclR5cGVzWzIyXSxcblx0W2l0ZW1UeXBlc1sxM11dOiBjcmVhdG9yVHlwZXNbMV0sXG5cdFtpdGVtVHlwZXNbMTVdXTogY3JlYXRvclR5cGVzWzFdLFxuXHRbaXRlbVR5cGVzWzE2XV06IGNyZWF0b3JUeXBlc1sxMl0sXG5cdFtpdGVtVHlwZXNbMTddXTogY3JlYXRvclR5cGVzWzFdLFxuXHRbaXRlbVR5cGVzWzE4XV06IGNyZWF0b3JUeXBlc1syXSxcblx0W2l0ZW1UeXBlc1sxOV1dOiBjcmVhdG9yVHlwZXNbMTRdLFxuXHRbaXRlbVR5cGVzWzIwXV06IGNyZWF0b3JUeXBlc1sxXSxcblx0W2l0ZW1UeXBlc1syMV1dOiBjcmVhdG9yVHlwZXNbMV0sXG5cdFtpdGVtVHlwZXNbMjJdXTogY3JlYXRvclR5cGVzWzIwXSxcblx0W2l0ZW1UeXBlc1syM11dOiBjcmVhdG9yVHlwZXNbMV0sXG5cdFtpdGVtVHlwZXNbMjRdXTogY3JlYXRvclR5cGVzWzFdLFxuXHRbaXRlbVR5cGVzWzI1XV06IGNyZWF0b3JUeXBlc1sxXSxcblx0W2l0ZW1UeXBlc1syNl1dOiBjcmVhdG9yVHlwZXNbMTddLFxuXHRbaXRlbVR5cGVzWzI3XV06IGNyZWF0b3JUeXBlc1syNF0sXG5cdFtpdGVtVHlwZXNbMjhdXTogY3JlYXRvclR5cGVzWzhdLFxuXHRbaXRlbVR5cGVzWzI5XV06IGNyZWF0b3JUeXBlc1s4XSxcblx0W2l0ZW1UeXBlc1szMF1dOiBjcmVhdG9yVHlwZXNbOF0sXG5cdFtpdGVtVHlwZXNbMzFdXTogY3JlYXRvclR5cGVzWzI2XSxcblx0W2l0ZW1UeXBlc1szMl1dOiBjcmVhdG9yVHlwZXNbMjFdLFxuXHRbaXRlbVR5cGVzWzMzXV06IGNyZWF0b3JUeXBlc1sxXSxcblx0W2l0ZW1UeXBlc1szNF1dOiBjcmVhdG9yVHlwZXNbMV0sXG5cdFtpdGVtVHlwZXNbMzVdXTogY3JlYXRvclR5cGVzWzFdLFxuXHRbaXRlbVR5cGVzWzM2XV06IGNyZWF0b3JUeXBlc1sxXVxufTtcbiIsIid1c2Ugc3RyaWN0JztcblxuY29uc3QgZmllbGRzID0ge1xuXHQxOiAndXJsJyxcblx0MjogJ3JpZ2h0cycsXG5cdDM6ICdzZXJpZXMnLFxuXHQ0OiAndm9sdW1lJyxcblx0NTogJ2lzc3VlJyxcblx0NjogJ2VkaXRpb24nLFxuXHQ3OiAncGxhY2UnLFxuXHQ4OiAncHVibGlzaGVyJyxcblx0MTA6ICdwYWdlcycsXG5cdDExOiAnSVNCTicsXG5cdDEyOiAncHVibGljYXRpb25UaXRsZScsXG5cdDEzOiAnSVNTTicsXG5cdDE0OiAnZGF0ZScsXG5cdDE1OiAnc2VjdGlvbicsXG5cdDE4OiAnY2FsbE51bWJlcicsXG5cdDE5OiAnYXJjaGl2ZUxvY2F0aW9uJyxcblx0MjE6ICdkaXN0cmlidXRvcicsXG5cdDIyOiAnZXh0cmEnLFxuXHQyNTogJ2pvdXJuYWxBYmJyZXZpYXRpb24nLFxuXHQyNjogJ0RPSScsXG5cdDI3OiAnYWNjZXNzRGF0ZScsXG5cdDI4OiAnc2VyaWVzVGl0bGUnLFxuXHQyOTogJ3Nlcmllc1RleHQnLFxuXHQzMDogJ3Nlcmllc051bWJlcicsXG5cdDMxOiAnaW5zdGl0dXRpb24nLFxuXHQzMjogJ3JlcG9ydFR5cGUnLFxuXHQzNjogJ2NvZGUnLFxuXHQ0MDogJ3Nlc3Npb24nLFxuXHQ0MTogJ2xlZ2lzbGF0aXZlQm9keScsXG5cdDQyOiAnaGlzdG9yeScsXG5cdDQzOiAncmVwb3J0ZXInLFxuXHQ0NDogJ2NvdXJ0Jyxcblx0NDU6ICdudW1iZXJPZlZvbHVtZXMnLFxuXHQ0NjogJ2NvbW1pdHRlZScsXG5cdDQ4OiAnYXNzaWduZWUnLFxuXHQ1MDogJ3BhdGVudE51bWJlcicsXG5cdDUxOiAncHJpb3JpdHlOdW1iZXJzJyxcblx0NTI6ICdpc3N1ZURhdGUnLFxuXHQ1MzogJ3JlZmVyZW5jZXMnLFxuXHQ1NDogJ2xlZ2FsU3RhdHVzJyxcblx0NTU6ICdjb2RlTnVtYmVyJyxcblx0NTk6ICdhcnR3b3JrTWVkaXVtJyxcblx0NjA6ICdudW1iZXInLFxuXHQ2MTogJ2FydHdvcmtTaXplJyxcblx0NjI6ICdsaWJyYXJ5Q2F0YWxvZycsXG5cdDYzOiAndmlkZW9SZWNvcmRpbmdGb3JtYXQnLFxuXHQ2NDogJ2ludGVydmlld01lZGl1bScsXG5cdDY1OiAnbGV0dGVyVHlwZScsXG5cdDY2OiAnbWFudXNjcmlwdFR5cGUnLFxuXHQ2NzogJ21hcFR5cGUnLFxuXHQ2ODogJ3NjYWxlJyxcblx0Njk6ICd0aGVzaXNUeXBlJyxcblx0NzA6ICd3ZWJzaXRlVHlwZScsXG5cdDcxOiAnYXVkaW9SZWNvcmRpbmdGb3JtYXQnLFxuXHQ3MjogJ2xhYmVsJyxcblx0NzQ6ICdwcmVzZW50YXRpb25UeXBlJyxcblx0NzU6ICdtZWV0aW5nTmFtZScsXG5cdDc2OiAnc3R1ZGlvJyxcblx0Nzc6ICdydW5uaW5nVGltZScsXG5cdDc4OiAnbmV0d29yaycsXG5cdDc5OiAncG9zdFR5cGUnLFxuXHQ4MDogJ2F1ZGlvRmlsZVR5cGUnLFxuXHQ4MTogJ3ZlcnNpb25OdW1iZXInLFxuXHQ4MjogJ3N5c3RlbScsXG5cdDgzOiAnY29tcGFueScsXG5cdDg0OiAnY29uZmVyZW5jZU5hbWUnLFxuXHQ4NTogJ2VuY3ljbG9wZWRpYVRpdGxlJyxcblx0ODY6ICdkaWN0aW9uYXJ5VGl0bGUnLFxuXHQ4NzogJ2xhbmd1YWdlJyxcblx0ODg6ICdwcm9ncmFtbWluZ0xhbmd1YWdlJyxcblx0ODk6ICd1bml2ZXJzaXR5Jyxcblx0OTA6ICdhYnN0cmFjdE5vdGUnLFxuXHQ5MTogJ3dlYnNpdGVUaXRsZScsXG5cdDkyOiAncmVwb3J0TnVtYmVyJyxcblx0OTM6ICdiaWxsTnVtYmVyJyxcblx0OTQ6ICdjb2RlVm9sdW1lJyxcblx0OTU6ICdjb2RlUGFnZXMnLFxuXHQ5NjogJ2RhdGVEZWNpZGVkJyxcblx0OTc6ICdyZXBvcnRlclZvbHVtZScsXG5cdDk4OiAnZmlyc3RQYWdlJyxcblx0OTk6ICdkb2N1bWVudE51bWJlcicsXG5cdDEwMDogJ2RhdGVFbmFjdGVkJyxcblx0MTAxOiAncHVibGljTGF3TnVtYmVyJyxcblx0MTAyOiAnY291bnRyeScsXG5cdDEwMzogJ2FwcGxpY2F0aW9uTnVtYmVyJyxcblx0MTA0OiAnZm9ydW1UaXRsZScsXG5cdDEwNTogJ2VwaXNvZGVOdW1iZXInLFxuXHQxMDc6ICdibG9nVGl0bGUnLFxuXHQxMDg6ICd0eXBlJyxcblx0MTA5OiAnbWVkaXVtJyxcblx0MTEwOiAndGl0bGUnLFxuXHQxMTE6ICdjYXNlTmFtZScsXG5cdDExMjogJ25hbWVPZkFjdCcsXG5cdDExMzogJ3N1YmplY3QnLFxuXHQxMTQ6ICdwcm9jZWVkaW5nc1RpdGxlJyxcblx0MTE1OiAnYm9va1RpdGxlJyxcblx0MTE2OiAnc2hvcnRUaXRsZScsXG5cdDExNzogJ2RvY2tldE51bWJlcicsXG5cdDExODogJ251bVBhZ2VzJyxcblx0MTE5OiAncHJvZ3JhbVRpdGxlJyxcblx0MTIwOiAnaXNzdWluZ0F1dGhvcml0eScsXG5cdDEyMTogJ2ZpbGluZ0RhdGUnLFxuXHQxMjI6ICdnZW5yZScsXG5cdDEyMzogJ2FyY2hpdmUnXG59O1xuXG4vL3JldmVyc2UgbG9va3VwXG5PYmplY3Qua2V5cyhmaWVsZHMpLm1hcChrID0+IGZpZWxkc1tmaWVsZHNba11dID0gayk7XG5cbm1vZHVsZS5leHBvcnRzID0gZmllbGRzO1xuIiwiLyogZ2xvYmFsIENTTDpmYWxzZSAqL1xuJ3VzZSBzdHJpY3QnO1xuXG5jb25zdCB7XG5cdENTTF9OQU1FU19NQVBQSU5HUyxcblx0Q1NMX1RFWFRfTUFQUElOR1MsXG5cdENTTF9EQVRFX01BUFBJTkdTLFxuXHRDU0xfVFlQRV9NQVBQSU5HU1xufSA9IHJlcXVpcmUoJy4vY3NsLW1hcHBpbmdzJyk7XG5cbmNvbnN0IHsgZ2V0RmllbGRJREZyb21UeXBlQW5kQmFzZSB9ID0gcmVxdWlyZSgnLi90eXBlLXNwZWNpZmljLWZpZWxkLW1hcCcpO1xuY29uc3QgZmllbGRzID0gcmVxdWlyZSgnLi9maWVsZHMnKTtcbmNvbnN0IGl0ZW1UeXBlcyA9IHJlcXVpcmUoJy4vaXRlbS10eXBlcycpO1xuY29uc3Qgc3RyVG9EYXRlID0gcmVxdWlyZSgnLi9zdHItdG8tZGF0ZScpO1xuY29uc3QgZGVmYXVsdEl0ZW1UeXBlQ3JlYXRvclR5cGVMb29rdXAgPSByZXF1aXJlKCcuL2RlZmF1bHQtaXRlbS10eXBlLWNyZWF0b3ItdHlwZS1sb29rdXAnKTtcblxubW9kdWxlLmV4cG9ydHMgPSB6b3Rlcm9JdGVtID0+IHtcblx0dmFyIGNzbFR5cGUgPSBDU0xfVFlQRV9NQVBQSU5HU1t6b3Rlcm9JdGVtLml0ZW1UeXBlXTtcblx0aWYgKCFjc2xUeXBlKSB7XG5cdFx0dGhyb3cgbmV3IEVycm9yKCdVbmV4cGVjdGVkIFpvdGVybyBJdGVtIHR5cGUgXCInICsgem90ZXJvSXRlbS5pdGVtVHlwZSArICdcIicpO1xuXHR9XG5cblx0dmFyIGl0ZW1UeXBlSUQgPSBpdGVtVHlwZXNbem90ZXJvSXRlbS5pdGVtVHlwZV07XG5cblx0dmFyIGNzbEl0ZW0gPSB7XG5cdFx0Ly8gJ2lkJzp6b3Rlcm9JdGVtLnVyaSxcblx0XHRpZDogem90ZXJvSXRlbS5rZXksXG5cdFx0J3R5cGUnOmNzbFR5cGVcblx0fTtcblxuXHQvLyBnZXQgYWxsIHRleHQgdmFyaWFibGVzICh0aGVyZSBtdXN0IGJlIGEgYmV0dGVyIHdheSlcblx0Zm9yKGxldCB2YXJpYWJsZSBpbiBDU0xfVEVYVF9NQVBQSU5HUykge1xuXHRcdGxldCBmaWVsZHMgPSBDU0xfVEVYVF9NQVBQSU5HU1t2YXJpYWJsZV07XG5cdFx0Zm9yKGxldCBpPTAsIG49ZmllbGRzLmxlbmd0aDsgaTxuOyBpKyspIHtcblx0XHRcdGxldCBmaWVsZCA9IGZpZWxkc1tpXSxcblx0XHRcdFx0dmFsdWUgPSBudWxsO1xuXG5cdFx0XHRpZihmaWVsZCBpbiB6b3Rlcm9JdGVtKSB7XG5cdFx0XHRcdHZhbHVlID0gem90ZXJvSXRlbVtmaWVsZF07XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHQvLyBATk9URTogRG9lcyB0aGlzIG5lZWQgcG9ydGluZz9cblx0XHRcdFx0Ly8gaWYgKGZpZWxkID09ICd2ZXJzaW9uTnVtYmVyJykge1xuXHRcdFx0XHQvLyBcdGZpZWxkID0gJ3ZlcnNpb24nOyAvLyBVbnRpbCBodHRwczovL2dpdGh1Yi5jb20vem90ZXJvL3pvdGVyby9pc3N1ZXMvNjcwXG5cdFx0XHRcdC8vIH1cblx0XHRcdFx0Ly8gdmFyIGZpZWxkSUQgPSBab3Rlcm8uSXRlbUZpZWxkcy5nZXRJRChmaWVsZCksXG5cdFx0XHRcdC8vIFx0dHlwZUZpZWxkSUQ7XG5cdFx0XHRcdC8vIGlmKGZpZWxkSURcblx0XHRcdFx0Ly8gXHQmJiAodHlwZUZpZWxkSUQgPSBab3Rlcm8uSXRlbUZpZWxkcy5nZXRGaWVsZElERnJvbVR5cGVBbmRCYXNlKGl0ZW1UeXBlSUQsIGZpZWxkSUQpKVxuXHRcdFx0XHQvLyApIHtcblx0XHRcdFx0Ly8gXHR2YWx1ZSA9IHpvdGVyb0l0ZW1bWm90ZXJvLkl0ZW1GaWVsZHMuZ2V0TmFtZSh0eXBlRmllbGRJRCldO1xuXHRcdFx0XHQvLyB9XG5cdFx0XHR9XG5cblx0XHRcdGlmICghdmFsdWUpIGNvbnRpbnVlO1xuXG5cdFx0XHRpZiAodHlwZW9mIHZhbHVlID09ICdzdHJpbmcnKSB7XG5cdFx0XHRcdGlmIChmaWVsZCA9PSAnSVNCTicpIHtcblx0XHRcdFx0XHQvLyBPbmx5IHVzZSB0aGUgZmlyc3QgSVNCTiBpbiBDU0wgSlNPTlxuXHRcdFx0XHRcdHZhciBpc2JuID0gdmFsdWUubWF0Y2goL14oPzo5N1s4OV0tPyk/KD86XFxkLT8pezl9W1xcZHhdKD8hLSlcXGIvaSk7XG5cdFx0XHRcdFx0aWYoaXNibikge1xuXHRcdFx0XHRcdFx0dmFsdWUgPSBpc2JuWzBdO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXG5cdFx0XHRcdC8vIFN0cmlwIGVuY2xvc2luZyBxdW90ZXNcblx0XHRcdFx0aWYodmFsdWUuY2hhckF0KDApID09ICdcIicgJiYgdmFsdWUuaW5kZXhPZignXCInLCAxKSA9PSB2YWx1ZS5sZW5ndGggLSAxKSB7XG5cdFx0XHRcdFx0dmFsdWUgPSB2YWx1ZS5zdWJzdHJpbmcoMSwgdmFsdWUubGVuZ3RoIC0gMSk7XG5cdFx0XHRcdH1cblx0XHRcdFx0Y3NsSXRlbVt2YXJpYWJsZV0gPSB2YWx1ZTtcblx0XHRcdFx0YnJlYWs7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0Ly8gc2VwYXJhdGUgbmFtZSB2YXJpYWJsZXNcblx0aWYgKHpvdGVyb0l0ZW0udHlwZSAhPSAnYXR0YWNobWVudCcgJiYgem90ZXJvSXRlbS50eXBlICE9ICdub3RlJykge1xuXHRcdC8vIHZhciBhdXRob3IgPSBab3Rlcm8uQ3JlYXRvclR5cGVzLmdldE5hbWUoWm90ZXJvLkNyZWF0b3JUeXBlcy5nZXRQcmltYXJ5SURGb3JUeXBlKCkpO1xuXHRcdGxldCBhdXRob3IgPSBkZWZhdWx0SXRlbVR5cGVDcmVhdG9yVHlwZUxvb2t1cFtpdGVtVHlwZUlEXTtcblx0XHRsZXQgY3JlYXRvcnMgPSB6b3Rlcm9JdGVtLmNyZWF0b3JzO1xuXHRcdGZvcihsZXQgaSA9IDA7IGNyZWF0b3JzICYmIGkgPCBjcmVhdG9ycy5sZW5ndGg7IGkrKykge1xuXHRcdFx0bGV0IGNyZWF0b3IgPSBjcmVhdG9yc1tpXTtcblx0XHRcdGxldCBjcmVhdG9yVHlwZSA9IGNyZWF0b3IuY3JlYXRvclR5cGU7XG5cdFx0XHRsZXQgbmFtZU9iajtcblxuXHRcdFx0aWYoY3JlYXRvclR5cGUgPT0gYXV0aG9yKSB7XG5cdFx0XHRcdGNyZWF0b3JUeXBlID0gJ2F1dGhvcic7XG5cdFx0XHR9XG5cblx0XHRcdGNyZWF0b3JUeXBlID0gQ1NMX05BTUVTX01BUFBJTkdTW2NyZWF0b3JUeXBlXTtcblx0XHRcdGlmKCFjcmVhdG9yVHlwZSkge1xuXHRcdFx0XHRjb250aW51ZTtcblx0XHRcdH1cblxuXHRcdFx0aWYgKCdsYXN0TmFtZScgaW4gY3JlYXRvciB8fCAnZmlyc3ROYW1lJyBpbiBjcmVhdG9yKSB7XG5cdFx0XHRcdG5hbWVPYmogPSB7XG5cdFx0XHRcdFx0ZmFtaWx5OiBjcmVhdG9yLmxhc3ROYW1lIHx8ICcnLFxuXHRcdFx0XHRcdGdpdmVuOiBjcmVhdG9yLmZpcnN0TmFtZSB8fCAnJ1xuXHRcdFx0XHR9O1xuXG5cdFx0XHRcdC8vIFBhcnNlIG5hbWUgcGFydGljbGVzXG5cdFx0XHRcdC8vIFJlcGxpY2F0ZSBjaXRlcHJvYy1qcyBsb2dpYyBmb3Igd2hhdCBzaG91bGQgYmUgcGFyc2VkIHNvIHdlIGRvbid0XG5cdFx0XHRcdC8vIGJyZWFrIGN1cnJlbnQgYmVoYXZpb3IuXG5cdFx0XHRcdGlmIChuYW1lT2JqLmZhbWlseSAmJiBuYW1lT2JqLmdpdmVuKSB7XG5cdFx0XHRcdFx0Ly8gRG9uJ3QgcGFyc2UgaWYgbGFzdCBuYW1lIGlzIHF1b3RlZFxuXHRcdFx0XHRcdGlmIChuYW1lT2JqLmZhbWlseS5sZW5ndGggPiAxXG5cdFx0XHRcdFx0XHQmJiBuYW1lT2JqLmZhbWlseS5jaGFyQXQoMCkgPT0gJ1wiJ1xuXHRcdFx0XHRcdFx0JiYgbmFtZU9iai5mYW1pbHkuY2hhckF0KG5hbWVPYmouZmFtaWx5Lmxlbmd0aCAtIDEpID09ICdcIidcblx0XHRcdFx0XHQpIHtcblx0XHRcdFx0XHRcdG5hbWVPYmouZmFtaWx5ID0gbmFtZU9iai5mYW1pbHkuc3Vic3RyKDEsIG5hbWVPYmouZmFtaWx5Lmxlbmd0aCAtIDIpO1xuXHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRDU0wucGFyc2VQYXJ0aWNsZXMobmFtZU9iaiwgdHJ1ZSk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9IGVsc2UgaWYgKCduYW1lJyBpbiBjcmVhdG9yKSB7XG5cdFx0XHRcdG5hbWVPYmogPSB7J2xpdGVyYWwnOiBjcmVhdG9yLm5hbWV9O1xuXHRcdFx0fVxuXG5cdFx0XHRpZihjc2xJdGVtW2NyZWF0b3JUeXBlXSkge1xuXHRcdFx0XHRjc2xJdGVtW2NyZWF0b3JUeXBlXS5wdXNoKG5hbWVPYmopO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0Y3NsSXRlbVtjcmVhdG9yVHlwZV0gPSBbbmFtZU9ial07XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0Ly8gZ2V0IGRhdGUgdmFyaWFibGVzXG5cdGZvcihsZXQgdmFyaWFibGUgaW4gQ1NMX0RBVEVfTUFQUElOR1MpIHtcblx0XHRsZXQgZGF0ZSA9IHpvdGVyb0l0ZW1bQ1NMX0RBVEVfTUFQUElOR1NbdmFyaWFibGVdXTtcblx0XHRpZiAoIWRhdGUpIHtcblxuXHRcdFx0bGV0IHR5cGVTcGVjaWZpY0ZpZWxkSUQgPSBnZXRGaWVsZElERnJvbVR5cGVBbmRCYXNlKGl0ZW1UeXBlSUQsIENTTF9EQVRFX01BUFBJTkdTW3ZhcmlhYmxlXSk7XG5cdFx0XHRpZiAodHlwZVNwZWNpZmljRmllbGRJRCkge1xuXHRcdFx0XHRkYXRlID0gem90ZXJvSXRlbVtmaWVsZHNbdHlwZVNwZWNpZmljRmllbGRJRF1dO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGlmKGRhdGUpIHtcblx0XHRcdGxldCBkYXRlT2JqID0gc3RyVG9EYXRlKGRhdGUpO1xuXHRcdFx0Ly8gb3RoZXJ3aXNlLCB1c2UgZGF0ZS1wYXJ0c1xuXHRcdFx0bGV0IGRhdGVQYXJ0cyA9IFtdO1xuXHRcdFx0aWYoZGF0ZU9iai55ZWFyKSB7XG5cdFx0XHRcdC8vIGFkZCB5ZWFyLCBtb250aCwgYW5kIGRheSwgaWYgdGhleSBleGlzdFxuXHRcdFx0XHRkYXRlUGFydHMucHVzaChkYXRlT2JqLnllYXIpO1xuXHRcdFx0XHRpZihkYXRlT2JqLm1vbnRoICE9PSB1bmRlZmluZWQpIHtcblx0XHRcdFx0XHRkYXRlUGFydHMucHVzaChkYXRlT2JqLm1vbnRoKzEpO1xuXHRcdFx0XHRcdGlmKGRhdGVPYmouZGF5KSB7XG5cdFx0XHRcdFx0XHRkYXRlUGFydHMucHVzaChkYXRlT2JqLmRheSk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHRcdGNzbEl0ZW1bdmFyaWFibGVdID0geydkYXRlLXBhcnRzJzpbZGF0ZVBhcnRzXX07XG5cblx0XHRcdFx0Ly8gaWYgbm8gbW9udGgsIHVzZSBzZWFzb24gYXMgbW9udGhcblx0XHRcdFx0aWYoZGF0ZU9iai5wYXJ0ICYmIGRhdGVPYmoubW9udGggPT09IHVuZGVmaW5lZCkge1xuXHRcdFx0XHRcdGNzbEl0ZW1bdmFyaWFibGVdLnNlYXNvbiA9IGRhdGVPYmoucGFydDtcblx0XHRcdFx0fVxuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0Ly8gaWYgbm8geWVhciwgcGFzcyBkYXRlIGxpdGVyYWxseVxuXHRcdFx0XHRjc2xJdGVtW3ZhcmlhYmxlXSA9IHsnbGl0ZXJhbCc6ZGF0ZX07XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0Ly8gU3BlY2lhbCBtYXBwaW5nIGZvciBub3RlIHRpdGxlXG5cdC8vIEBOT1RFOiBOb3QgcG9ydGVkXG5cdC8vIGlmICh6b3Rlcm9JdGVtLml0ZW1UeXBlID09ICdub3RlJyAmJiB6b3Rlcm9JdGVtLm5vdGUpIHtcblx0Ly8gXHRjc2xJdGVtLnRpdGxlID0gWm90ZXJvLk5vdGVzLm5vdGVUb1RpdGxlKHpvdGVyb0l0ZW0ubm90ZSk7XG5cdC8vIH1cblxuXHQvL3RoaXMuX2NhY2hlW3pvdGVyb0l0ZW0uaWRdID0gY3NsSXRlbTtcblx0cmV0dXJuIGNzbEl0ZW07XG59XG4iLCIndXNlIHN0cmljdCc7XG5cbmNvbnN0IGl0ZW1UeXBlcyA9IHtcblx0MTogJ25vdGUnLFxuXHQyOiAnYm9vaycsXG5cdDM6ICdib29rU2VjdGlvbicsXG5cdDQ6ICdqb3VybmFsQXJ0aWNsZScsXG5cdDU6ICdtYWdhemluZUFydGljbGUnLFxuXHQ2OiAnbmV3c3BhcGVyQXJ0aWNsZScsXG5cdDc6ICd0aGVzaXMnLFxuXHQ4OiAnbGV0dGVyJyxcblx0OTogJ21hbnVzY3JpcHQnLFxuXHQxMDogJ2ludGVydmlldycsXG5cdDExOiAnZmlsbScsXG5cdDEyOiAnYXJ0d29yaycsXG5cdDEzOiAnd2VicGFnZScsXG5cdDE0OiAnYXR0YWNobWVudCcsXG5cdDE1OiAncmVwb3J0Jyxcblx0MTY6ICdiaWxsJyxcblx0MTc6ICdjYXNlJyxcblx0MTg6ICdoZWFyaW5nJyxcblx0MTk6ICdwYXRlbnQnLFxuXHQyMDogJ3N0YXR1dGUnLFxuXHQyMTogJ2VtYWlsJyxcblx0MjI6ICdtYXAnLFxuXHQyMzogJ2Jsb2dQb3N0Jyxcblx0MjQ6ICdpbnN0YW50TWVzc2FnZScsXG5cdDI1OiAnZm9ydW1Qb3N0Jyxcblx0MjY6ICdhdWRpb1JlY29yZGluZycsXG5cdDI3OiAncHJlc2VudGF0aW9uJyxcblx0Mjg6ICd2aWRlb1JlY29yZGluZycsXG5cdDI5OiAndHZCcm9hZGNhc3QnLFxuXHQzMDogJ3JhZGlvQnJvYWRjYXN0Jyxcblx0MzE6ICdwb2RjYXN0Jyxcblx0MzI6ICdjb21wdXRlclByb2dyYW0nLFxuXHQzMzogJ2NvbmZlcmVuY2VQYXBlcicsXG5cdDM0OiAnZG9jdW1lbnQnLFxuXHQzNTogJ2VuY3ljbG9wZWRpYUFydGljbGUnLFxuXHQzNjogJ2RpY3Rpb25hcnlFbnRyeSdcbn07XG5cbi8vcmV2ZXJzZSBsb29rdXBcbk9iamVjdC5rZXlzKGl0ZW1UeXBlcykubWFwKGsgPT4gaXRlbVR5cGVzW2l0ZW1UeXBlc1trXV0gPSBrKTtcbm1vZHVsZS5leHBvcnRzID0gaXRlbVR5cGVzO1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG5tb2R1bGUuZXhwb3J0cyA9IChzdHJpbmcsIHBhZCwgbGVuZ3RoKSA9PiB7XG5cdHN0cmluZyA9IHN0cmluZyA/IHN0cmluZyArICcnIDogJyc7XG5cdHdoaWxlKHN0cmluZy5sZW5ndGggPCBsZW5ndGgpIHtcblx0XHRzdHJpbmcgPSBwYWQgKyBzdHJpbmc7XG5cdH1cblx0cmV0dXJuIHN0cmluZztcbn1cbiIsIid1c2Ugc3RyaWN0JztcblxuY29uc3QgZGF0ZVRvU1FMID0gcmVxdWlyZSgnLi9kYXRlLXRvLXNxbCcpO1xuXG5jb25zdCBtb250aHMgPSBbJ2phbicsICdmZWInLCAnbWFyJywgJ2FwcicsICdtYXknLCAnanVuJywgJ2p1bCcsICdhdWcnLCAnc2VwJywgJ29jdCcsICdub3YnLCAnZGVjJywgJ2phbnVhcnknLCAnZmVicnVhcnknLCAnbWFyY2gnLCAnYXByaWwnLCAnbWF5JywgJ2p1bmUnLCAnanVseScsICdhdWd1c3QnLCAnc2VwdGVtYmVyJywgJ29jdG9iZXInLCAnbm92ZW1iZXInLCAnZGVjZW1iZXInXTtcblxuY29uc3QgX3NsYXNoUmUgPSAvXiguKj8pXFxiKFswLTldezEsNH0pKD86KFtcXC1cXC9cXC5cXHU1ZTc0XSkoWzAtOV17MSwyfSkpPyg/OihbXFwtXFwvXFwuXFx1NjcwOF0pKFswLTldezEsNH0pKT8oKD86XFxifFteMC05XSkuKj8pJC9cbmNvbnN0IF95ZWFyUmUgPSAvXiguKj8pXFxiKCg/OmNpcmNhIHxhcm91bmQgfGFib3V0IHxjXFwuPyA/KT9bMC05XXsxLDR9KD86ID9CXFwuPyA/Q1xcLj8oPzogP0VcXC4/KT98ID9DXFwuPyA/RVxcLj98ID9BXFwuPyA/RFxcLj8pfFswLTldezMsNH0pXFxiKC4qPykkL2k7XG5jb25zdCBfbW9udGhSZSA9IG5ldyBSZWdFeHAoJ14oLiopXFxcXGIoJyArIG1vbnRocy5qb2luKCd8JykgKyAnKVteIF0qKD86ICguKikkfCQpJywgJ2knKTtcbmNvbnN0IF9kYXlSZSA9IG5ldyBSZWdFeHAoJ1xcXFxiKFswLTldezEsMn0pKD86c3R8bmR8cmR8dGgpP1xcXFxiKC4qKScsICdpJyk7XG5cbmNvbnN0IF9pbnNlcnREYXRlT3JkZXJQYXJ0ID0gKGRhdGVPcmRlciwgcGFydCwgcGFydE9yZGVyKSA9PiB7XG5cdFx0aWYgKCFkYXRlT3JkZXIpIHtcblx0XHRcdHJldHVybiBwYXJ0O1xuXHRcdH1cblx0XHRpZiAocGFydE9yZGVyLmJlZm9yZSA9PT0gdHJ1ZSkge1xuXHRcdFx0cmV0dXJuIHBhcnQgKyBkYXRlT3JkZXI7XG5cdFx0fVxuXHRcdGlmIChwYXJ0T3JkZXIuYWZ0ZXIgPT09IHRydWUpIHtcblx0XHRcdHJldHVybiBkYXRlT3JkZXIgKyBwYXJ0O1xuXHRcdH1cblx0XHRpZiAocGFydE9yZGVyLmJlZm9yZSkge1xuXHRcdFx0bGV0IHBvcyA9IGRhdGVPcmRlci5pbmRleE9mKHBhcnRPcmRlci5iZWZvcmUpO1xuXHRcdFx0aWYgKHBvcyA9PSAtMSkge1xuXHRcdFx0XHRyZXR1cm4gZGF0ZU9yZGVyO1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIGRhdGVPcmRlci5yZXBsYWNlKG5ldyBSZWdFeHAoJygnICsgcGFydE9yZGVyLmJlZm9yZSArICcpJyksIHBhcnQgKyAnJDEnKTtcblx0XHR9XG5cdFx0aWYgKHBhcnRPcmRlci5hZnRlcikge1xuXHRcdFx0bGV0IHBvcyA9IGRhdGVPcmRlci5pbmRleE9mKHBhcnRPcmRlci5hZnRlcik7XG5cdFx0XHRpZiAocG9zID09IC0xKSB7XG5cdFx0XHRcdHJldHVybiBkYXRlT3JkZXIgKyBwYXJ0O1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIGRhdGVPcmRlci5yZXBsYWNlKG5ldyBSZWdFeHAoJygnICsgcGFydE9yZGVyLmFmdGVyICsgJyknKSwgJyQxJyArIHBhcnQpO1xuXHRcdH1cblx0XHRyZXR1cm4gZGF0ZU9yZGVyICsgcGFydDtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBzdHJpbmcgPT4ge1xuXHR2YXIgZGF0ZSA9IHtcblx0XHRvcmRlcjogJydcblx0fTtcblxuXHQvLyBza2lwIGVtcHR5IHRoaW5nc1xuXHRpZighc3RyaW5nKSB7XG5cdFx0cmV0dXJuIGRhdGU7XG5cdH1cblxuXHR2YXIgcGFydHMgPSBbXTtcblxuXHQvLyBQYXJzZSAneWVzdGVyZGF5Jy8ndG9kYXknLyd0b21vcnJvdydcblx0bGV0IGxjID0gKHN0cmluZyArICcnKS50b0xvd2VyQ2FzZSgpO1xuXHRpZiAobGMgPT0gJ3llc3RlcmRheScpIHtcblx0XHRzdHJpbmcgPSBkYXRlVG9TUUwobmV3IERhdGUoRGF0ZS5ub3coKSAtIDEwMDAqNjAqNjAqMjQpKS5zdWJzdHIoMCwgMTApO1xuXHR9XG5cdGVsc2UgaWYgKGxjID09ICd0b2RheScpIHtcblx0XHRzdHJpbmcgPSBkYXRlVG9TUUwobmV3IERhdGUoKSkuc3Vic3RyKDAsIDEwKTtcblx0fVxuXHRlbHNlIGlmIChsYyA9PSAndG9tb3Jyb3cnKSB7XG5cdFx0c3RyaW5nID0gZGF0ZVRvU1FMKG5ldyBEYXRlKERhdGUubm93KCkgKyAxMDAwKjYwKjYwKjI0KSkuc3Vic3RyKDAsIDEwKTtcblx0fVxuXHRlbHNlIHtcblx0XHRzdHJpbmcgPSBzdHJpbmcudG9TdHJpbmcoKS5yZXBsYWNlKC9eXFxzK3xcXHMrJC9nLCAnJykucmVwbGFjZSgvXFxzKy8sICcgJyk7XG5cdH1cblxuXHQvLyBmaXJzdCwgZGlyZWN0bHkgaW5zcGVjdCB0aGUgc3RyaW5nXG5cdGxldCBtID0gX3NsYXNoUmUuZXhlYyhzdHJpbmcpO1xuXHRpZihtICYmXG5cdFx0KCghbVs1XSB8fCAhbVszXSkgfHwgbVszXSA9PSBtWzVdIHx8IChtWzNdID09ICdcXHU1ZTc0JyAmJiBtWzVdID09ICdcXHU2NzA4JykpICYmXHQvLyByZXF1aXJlIHNhbmUgc2VwYXJhdG9yc1xuXHRcdCgobVsyXSAmJiBtWzRdICYmIG1bNl0pIHx8ICghbVsxXSAmJiAhbVs3XSkpKSB7XHRcdFx0XHRcdFx0Ly8gcmVxdWlyZSB0aGF0IGVpdGhlciBhbGwgcGFydHMgYXJlIGZvdW5kLFxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQvLyBvciBlbHNlIHRoaXMgaXMgdGhlIGVudGlyZSBkYXRlIGZpZWxkXG5cdFx0Ly8gZmlndXJlIG91dCBkYXRlIGJhc2VkIG9uIHBhcnRzXG5cdFx0aWYobVsyXS5sZW5ndGggPT0gMyB8fCBtWzJdLmxlbmd0aCA9PSA0IHx8IG1bM10gPT0gJ1xcdTVlNzQnKSB7XG5cdFx0XHQvLyBJU08gODYwMSBzdHlsZSBkYXRlIChiaWcgZW5kaWFuKVxuXHRcdFx0ZGF0ZS55ZWFyID0gbVsyXTtcblx0XHRcdGRhdGUubW9udGggPSBtWzRdO1xuXHRcdFx0ZGF0ZS5kYXkgPSBtWzZdO1xuXHRcdFx0ZGF0ZS5vcmRlciArPSBtWzJdID8gJ3knIDogJyc7XG5cdFx0XHRkYXRlLm9yZGVyICs9IG1bNF0gPyAnbScgOiAnJztcblx0XHRcdGRhdGUub3JkZXIgKz0gbVs2XSA/ICdkJyA6ICcnO1xuXHRcdH0gZWxzZSBpZihtWzJdICYmICFtWzRdICYmIG1bNl0pIHtcblx0XHRcdGRhdGUubW9udGggPSBtWzJdO1xuXHRcdFx0ZGF0ZS55ZWFyID0gbVs2XTtcblx0XHRcdGRhdGUub3JkZXIgKz0gbVsyXSA/ICdtJyA6ICcnO1xuXHRcdFx0ZGF0ZS5vcmRlciArPSBtWzZdID8gJ3knIDogJyc7XG5cdFx0fSBlbHNlIHtcblx0XHRcdC8vIGxvY2FsIHN0eWxlIGRhdGUgKG1pZGRsZSBvciBsaXR0bGUgZW5kaWFuKVxuXHRcdFx0dmFyIGNvdW50cnkgPSB3aW5kb3cubmF2aWdhdG9yLmxhbmd1YWdlID8gd2luZG93Lm5hdmlnYXRvci5sYW5ndWFnZS5zdWJzdHIoMykgOiAnVVMnO1xuXHRcdFx0aWYoY291bnRyeSA9PSAnVVMnIHx8XHQvLyBUaGUgVW5pdGVkIFN0YXRlc1xuXHRcdFx0XHRjb3VudHJ5ID09ICdGTScgfHxcdC8vIFRoZSBGZWRlcmF0ZWQgU3RhdGVzIG9mIE1pY3JvbmVzaWFcblx0XHRcdFx0Y291bnRyeSA9PSAnUFcnIHx8XHQvLyBQYWxhdVxuXHRcdFx0XHRjb3VudHJ5ID09ICdQSCcpIHtcdC8vIFRoZSBQaGlsaXBwaW5lc1xuXHRcdFx0XHRcdGRhdGUubW9udGggPSBtWzJdO1xuXHRcdFx0XHRcdGRhdGUuZGF5ID0gbVs0XTtcblx0XHRcdFx0XHRkYXRlLm9yZGVyICs9IG1bMl0gPyAnbScgOiAnJztcblx0XHRcdFx0XHRkYXRlLm9yZGVyICs9IG1bNF0gPyAnZCcgOiAnJztcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdGRhdGUubW9udGggPSBtWzRdO1xuXHRcdFx0XHRkYXRlLmRheSA9IG1bMl07XG5cdFx0XHRcdGRhdGUub3JkZXIgKz0gbVsyXSA/ICdkJyA6ICcnO1xuXHRcdFx0XHRkYXRlLm9yZGVyICs9IG1bNF0gPyAnbScgOiAnJztcblx0XHRcdH1cblx0XHRcdGRhdGUueWVhciA9IG1bNl07XG5cdFx0XHRkYXRlLm9yZGVyICs9ICd5Jztcblx0XHR9XG5cblx0XHRpZihkYXRlLnllYXIpIHtcblx0XHRcdGRhdGUueWVhciA9IHBhcnNlSW50KGRhdGUueWVhciwgMTApO1xuXHRcdH1cblx0XHRpZihkYXRlLmRheSkge1xuXHRcdFx0ZGF0ZS5kYXkgPSBwYXJzZUludChkYXRlLmRheSwgMTApO1xuXHRcdH1cblx0XHRpZihkYXRlLm1vbnRoKSB7XG5cdFx0XHRkYXRlLm1vbnRoID0gcGFyc2VJbnQoZGF0ZS5tb250aCwgMTApO1xuXG5cdFx0XHRpZihkYXRlLm1vbnRoID4gMTIpIHtcblx0XHRcdFx0Ly8gc3dhcCBkYXkgYW5kIG1vbnRoXG5cdFx0XHRcdHZhciB0bXAgPSBkYXRlLmRheTtcblx0XHRcdFx0ZGF0ZS5kYXkgPSBkYXRlLm1vbnRoXG5cdFx0XHRcdGRhdGUubW9udGggPSB0bXA7XG5cdFx0XHRcdGRhdGUub3JkZXIgPSBkYXRlLm9yZGVyLnJlcGxhY2UoJ20nLCAnRCcpXG5cdFx0XHRcdFx0LnJlcGxhY2UoJ2QnLCAnTScpXG5cdFx0XHRcdFx0LnJlcGxhY2UoJ0QnLCAnZCcpXG5cdFx0XHRcdFx0LnJlcGxhY2UoJ00nLCAnbScpO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGlmKCghZGF0ZS5tb250aCB8fCBkYXRlLm1vbnRoIDw9IDEyKSAmJiAoIWRhdGUuZGF5IHx8IGRhdGUuZGF5IDw9IDMxKSkge1xuXHRcdFx0aWYoZGF0ZS55ZWFyICYmIGRhdGUueWVhciA8IDEwMCkge1x0Ly8gZm9yIHR3byBkaWdpdCB5ZWFycywgZGV0ZXJtaW5lIHByb3BlclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0Ly8gZm91ciBkaWdpdCB5ZWFyXG5cdFx0XHRcdHZhciB0b2RheSA9IG5ldyBEYXRlKCk7XG5cdFx0XHRcdHZhciB5ZWFyID0gdG9kYXkuZ2V0RnVsbFllYXIoKTtcblx0XHRcdFx0dmFyIHR3b0RpZ2l0WWVhciA9IHllYXIgJSAxMDA7XG5cdFx0XHRcdHZhciBjZW50dXJ5ID0geWVhciAtIHR3b0RpZ2l0WWVhcjtcblxuXHRcdFx0XHRpZihkYXRlLnllYXIgPD0gdHdvRGlnaXRZZWFyKSB7XG5cdFx0XHRcdFx0Ly8gYXNzdW1lIHRoaXMgZGF0ZSBpcyBmcm9tIG91ciBjZW50dXJ5XG5cdFx0XHRcdFx0ZGF0ZS55ZWFyID0gY2VudHVyeSArIGRhdGUueWVhcjtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHQvLyBhc3N1bWUgdGhpcyBkYXRlIGlzIGZyb20gdGhlIHByZXZpb3VzIGNlbnR1cnlcblx0XHRcdFx0XHRkYXRlLnllYXIgPSBjZW50dXJ5IC0gMTAwICsgZGF0ZS55ZWFyO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cblx0XHRcdGlmKGRhdGUubW9udGgpIHtcblx0XHRcdFx0ZGF0ZS5tb250aC0tO1x0XHQvLyBzdWJ0cmFjdCBvbmUgZm9yIEpTIHN0eWxlXG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRkZWxldGUgZGF0ZS5tb250aDtcblx0XHRcdH1cblxuXHRcdFx0cGFydHMucHVzaChcblx0XHRcdFx0eyBwYXJ0OiBtWzFdLCBiZWZvcmU6IHRydWUgfSxcblx0XHRcdFx0eyBwYXJ0OiBtWzddIH1cblx0XHRcdCk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHZhciBkYXRlID0ge1xuXHRcdFx0XHRvcmRlcjogJydcblx0XHRcdH07XG5cdFx0XHRwYXJ0cy5wdXNoKHsgcGFydDogc3RyaW5nIH0pO1xuXHRcdH1cblx0fSBlbHNlIHtcblx0XHRwYXJ0cy5wdXNoKHsgcGFydDogc3RyaW5nIH0pO1xuXHR9XG5cblx0Ly8gY291bGRuJ3QgZmluZCBzb21ldGhpbmcgd2l0aCB0aGUgYWxnb3JpdGhtczsgdXNlIHJlZ2V4cFxuXHQvLyBZRUFSXG5cdGlmKCFkYXRlLnllYXIpIHtcblx0XHRmb3IgKGxldCBpIGluIHBhcnRzKSB7XG5cdFx0XHRsZXQgbSA9IF95ZWFyUmUuZXhlYyhwYXJ0c1tpXS5wYXJ0KTtcblx0XHRcdGlmIChtKSB7XG5cdFx0XHRcdGRhdGUueWVhciA9IG1bMl07XG5cdFx0XHRcdGRhdGUub3JkZXIgPSBfaW5zZXJ0RGF0ZU9yZGVyUGFydChkYXRlLm9yZGVyLCAneScsIHBhcnRzW2ldKTtcblx0XHRcdFx0cGFydHMuc3BsaWNlKFxuXHRcdFx0XHRcdGksIDEsXG5cdFx0XHRcdFx0eyBwYXJ0OiBtWzFdLCBiZWZvcmU6IHRydWUgfSxcblx0XHRcdFx0XHR7IHBhcnQ6IG1bM10gfVxuXHRcdFx0XHQpO1xuXHRcdFx0XHRicmVhaztcblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHQvLyBNT05USFxuXHRpZihkYXRlLm1vbnRoID09PSB1bmRlZmluZWQpIHtcblx0XHRmb3IgKGxldCBpIGluIHBhcnRzKSB7XG5cdFx0XHRsZXQgbSA9IF9tb250aFJlLmV4ZWMocGFydHNbaV0ucGFydCk7XG5cdFx0XHRpZiAobSkge1xuXHRcdFx0XHQvLyBNb2R1bG8gMTIgaW4gY2FzZSB3ZSBoYXZlIG11bHRpcGxlIGxhbmd1YWdlc1xuXHRcdFx0XHRkYXRlLm1vbnRoID0gbW9udGhzLmluZGV4T2YobVsyXS50b0xvd2VyQ2FzZSgpKSAlIDEyO1xuXHRcdFx0XHRkYXRlLm9yZGVyID0gX2luc2VydERhdGVPcmRlclBhcnQoZGF0ZS5vcmRlciwgJ20nLCBwYXJ0c1tpXSk7XG5cdFx0XHRcdHBhcnRzLnNwbGljZShcblx0XHRcdFx0XHRpLCAxLFxuXHRcdFx0XHRcdHsgcGFydDogbVsxXSwgYmVmb3JlOiAnbScgfSxcblx0XHRcdFx0XHR7IHBhcnQ6IG1bM10sIGFmdGVyOiAnbScgfVxuXHRcdFx0XHQpO1xuXHRcdFx0XHRicmVhaztcblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHQvLyBEQVlcblx0aWYoIWRhdGUuZGF5KSB7XG5cdFx0Ly8gY29tcGlsZSBkYXkgcmVndWxhciBleHByZXNzaW9uXG5cdFx0Zm9yIChsZXQgaSBpbiBwYXJ0cykge1xuXHRcdFx0bGV0IG0gPSBfZGF5UmUuZXhlYyhwYXJ0c1tpXS5wYXJ0KTtcblx0XHRcdGlmIChtKSB7XG5cdFx0XHRcdHZhciBkYXkgPSBwYXJzZUludChtWzFdLCAxMCksXG5cdFx0XHRcdFx0cGFydDtcblx0XHRcdFx0Ly8gU2FuaXR5IGNoZWNrXG5cdFx0XHRcdGlmIChkYXkgPD0gMzEpIHtcblx0XHRcdFx0XHRkYXRlLmRheSA9IGRheTtcblx0XHRcdFx0XHRkYXRlLm9yZGVyID0gX2luc2VydERhdGVPcmRlclBhcnQoZGF0ZS5vcmRlciwgJ2QnLCBwYXJ0c1tpXSk7XG5cdFx0XHRcdFx0aWYobS5pbmRleCA+IDApIHtcblx0XHRcdFx0XHRcdHBhcnQgPSBwYXJ0c1tpXS5wYXJ0LnN1YnN0cigwLCBtLmluZGV4KTtcblx0XHRcdFx0XHRcdGlmKG1bMl0pIHtcblx0XHRcdFx0XHRcdFx0cGFydCArPSAnICcgKyBtWzJdO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRwYXJ0ID0gbVsyXTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0cGFydHMuc3BsaWNlKFxuXHRcdFx0XHRcdFx0aSwgMSxcblx0XHRcdFx0XHRcdHsgcGFydDogcGFydCB9XG5cdFx0XHRcdFx0KTtcblx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdC8vIENvbmNhdGVuYXRlIGRhdGUgcGFydHNcblx0ZGF0ZS5wYXJ0ID0gJyc7XG5cdGZvciAodmFyIGkgaW4gcGFydHMpIHtcblx0XHRkYXRlLnBhcnQgKz0gcGFydHNbaV0ucGFydCArICcgJztcblx0fVxuXG5cdC8vIGNsZWFuIHVwIGRhdGUgcGFydFxuXHRpZihkYXRlLnBhcnQpIHtcblx0XHRkYXRlLnBhcnQgPSBkYXRlLnBhcnQucmVwbGFjZSgvXlteQS1aYS16MC05XSt8W15BLVphLXowLTldKyQvZywgJycpO1xuXHR9XG5cblx0aWYoZGF0ZS5wYXJ0ID09PSAnJyB8fCBkYXRlLnBhcnQgPT0gdW5kZWZpbmVkKSB7XG5cdFx0ZGVsZXRlIGRhdGUucGFydDtcblx0fVxuXG5cdC8vbWFrZSBzdXJlIHllYXIgaXMgYWx3YXlzIGEgc3RyaW5nXG5cdGlmKGRhdGUueWVhciB8fCBkYXRlLnllYXIgPT09IDApIGRhdGUueWVhciArPSAnJztcblxuXHRyZXR1cm4gZGF0ZTtcbn1cbiIsImNvbnN0IGZpZWxkcyA9IHJlcXVpcmUoJy4vZmllbGRzJyk7XG5jb25zdCBpdGVtVHlwZXMgPSByZXF1aXJlKCcuL2l0ZW0tdHlwZXMnKTtcblxuY29uc3QgdHlwZVNwZWNpZmljRmllbGRNYXAgPSB7XG5cdFsoMTYgPDwgOCkgKyA0XTogOTQsXG5cdFsoMTcgPDwgOCkgKyA0XTogOTcsXG5cdFsoNyA8PCA4KSArIDhdOiA4OSxcblx0WygxMSA8PCA4KSArIDhdOiAyMSxcblx0WygxNSA8PCA4KSArIDhdOiAzMSxcblx0WygyNiA8PCA4KSArIDhdOiA3Mixcblx0WygyOCA8PCA4KSArIDhdOiA3Nixcblx0WygyOSA8PCA4KSArIDhdOiA3OCxcblx0WygzMCA8PCA4KSArIDhdOiA3OCxcblx0WygzMiA8PCA4KSArIDhdOiA4Myxcblx0WygxNiA8PCA4KSArIDEwXTogOTUsXG5cdFsoMTcgPDwgOCkgKyAxMF06IDk4LFxuXHRbKDMgPDwgOCkgKyAxMl06IDExNSxcblx0WygzMyA8PCA4KSArIDEyXTogMTE0LFxuXHRbKDEzIDw8IDgpICsgMTJdOiA5MSxcblx0WygyMyA8PCA4KSArIDEyXTogMTA3LFxuXHRbKDI1IDw8IDgpICsgMTJdOiAxMDQsXG5cdFsoMjkgPDwgOCkgKyAxMl06IDExOSxcblx0WygzMCA8PCA4KSArIDEyXTogMTE5LFxuXHRbKDM1IDw8IDgpICsgMTJdOiA4NSxcblx0WygzNiA8PCA4KSArIDEyXTogODYsXG5cdFsoMTcgPDwgOCkgKyAxNF06IDk2LFxuXHRbKDE5IDw8IDgpICsgMTRdOiA1Mixcblx0WygyMCA8PCA4KSArIDE0XTogMTAwLFxuXHRbKDE1IDw8IDgpICsgNjBdOiA5Mixcblx0WygxNiA8PCA4KSArIDYwXTogOTMsXG5cdFsoMTcgPDwgOCkgKyA2MF06IDExNyxcblx0WygxOCA8PCA4KSArIDYwXTogOTksXG5cdFsoMTkgPDwgOCkgKyA2MF06IDUwLFxuXHRbKDIwIDw8IDgpICsgNjBdOiAxMDEsXG5cdFsoMjkgPDwgOCkgKyA2MF06IDEwNSxcblx0WygzMCA8PCA4KSArIDYwXTogMTA1LFxuXHRbKDMxIDw8IDgpICsgNjBdOiAxMDUsXG5cdFsoNyA8PCA4KSArIDEwOF06IDY5LFxuXHRbKDggPDwgOCkgKyAxMDhdOiA2NSxcblx0Wyg5IDw8IDgpICsgMTA4XTogNjYsXG5cdFsoMTEgPDwgOCkgKyAxMDhdOiAxMjIsXG5cdFsoMTMgPDwgOCkgKyAxMDhdOiA3MCxcblx0WygxNSA8PCA4KSArIDEwOF06IDMyLFxuXHRbKDIyIDw8IDgpICsgMTA4XTogNjcsXG5cdFsoMjMgPDwgOCkgKyAxMDhdOiA3MCxcblx0WygyNSA8PCA4KSArIDEwOF06IDc5LFxuXHRbKDI3IDw8IDgpICsgMTA4XTogNzQsXG5cdFsoMTAgPDwgOCkgKyAxMDldOiA2NCxcblx0WygxMSA8PCA4KSArIDEwOV06IDYzLFxuXHRbKDEyIDw8IDgpICsgMTA5XTogNTksXG5cdFsoMjYgPDwgOCkgKyAxMDldOiA3MSxcblx0WygyOCA8PCA4KSArIDEwOV06IDYzLFxuXHRbKDI5IDw8IDgpICsgMTA5XTogNjMsXG5cdFsoMzAgPDwgOCkgKyAxMDldOiA3MSxcblx0WygzMSA8PCA4KSArIDEwOV06IDgwLFxuXHRbKDE3IDw8IDgpICsgMTEwXTogMTExLFxuXHRbKDIwIDw8IDgpICsgMTEwXTogMTEyLFxuXHRbKDIxIDw8IDgpICsgMTEwXTogMTEzXG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IHtcblx0bWFwOiB0eXBlU3BlY2lmaWNGaWVsZE1hcCxcblx0Z2V0RmllbGRJREZyb21UeXBlQW5kQmFzZTogKHR5cGVJZCwgZmllbGRJZCkgPT4ge1xuXHRcdHR5cGVJZCA9IHR5cGVvZiB0eXBlSWQgPT09ICdudW1iZXInID8gdHlwZUlkIDogaXRlbVR5cGVzW3R5cGVJZF07XG5cdFx0ZmllbGRJZCA9IHR5cGVvZiBmaWVsZElkID09PSAnbnVtYmVyJyA/IGZpZWxkSWQgOiBmaWVsZHNbZmllbGRJZF07XG5cdFx0cmV0dXJuIHR5cGVTcGVjaWZpY0ZpZWxkTWFwWyh0eXBlSWQgPDwgOCkgKyBmaWVsZElkXTtcblx0fVxufTtcbiJdfQ==
