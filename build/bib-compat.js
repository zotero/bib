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
'use strict';var _extends=Object.assign||function(a){for(var b,c=1;c<arguments.length;c++)for(var d in b=arguments[c],b)Object.prototype.hasOwnProperty.call(b,d)&&(a[d]=b[d]);return a},_createClass=function(){function a(a,b){for(var c,d=0;d<b.length;d++)c=b[d],c.enumerable=c.enumerable||!1,c.configurable=!0,'value'in c&&(c.writable=!0),Object.defineProperty(a,c.key,c)}return function(b,c,d){return c&&a(b.prototype,c),d&&a(b,d),b}}();function _asyncToGenerator(a){return function(){var b=a.apply(this,arguments);return new Promise(function(a,c){function d(e,f){try{var g=b[e](f),h=g.value}catch(a){return void c(a)}return g.done?void a(h):Promise.resolve(h).then(function(a){d('next',a)},function(a){d('throw',a)})}return d('next')})}}function _toConsumableArray(a){if(Array.isArray(a)){for(var b=0,c=Array(a.length);b<a.length;b++)c[b]=a[b];return c}return Array.from(a)}function _classCallCheck(a,b){if(!(a instanceof b))throw new TypeError('Cannot call a class as a function')}var utils=require('./utils'),defaults=require('./defaults'),itemToCSLJSON=require('../zotero-shim/item-to-csl-json'),dateToSql=require('../zotero-shim/date-to-sql'),COMPLETE='COMPLETE',MULTIPLE_ITEMS='MULTIPLE_ITEMS',FAILED='FAILED',ZoteroBib=function(){function a(b){if(_classCallCheck(this,a),this.opts=_extends({sessionid:utils.uuid4()},defaults(),b),this.opts.persist&&this.opts.storage){if(!('getItem'in this.opts.storage||'setItem'in this.opts.storage||'clear'in this.opts.storage))throw new Error('Invalid storage engine provided');this.opts.override&&this.clearItems(),this.items=[].concat(_toConsumableArray(this.opts.initialItems),_toConsumableArray(this.getItemsStorage())),this.setItemsStorage(this.items)}else this.items=[].concat(_toConsumableArray(this.opts.initialItems))}return _createClass(a,[{key:'getItemsStorage',value:function getItemsStorage(){var a=this.opts.storage.getItem(this.opts.storagePrefix+'-items');return a?JSON.parse(a):[]}},{key:'setItemsStorage',value:function setItemsStorage(a){this.opts.storage.setItem(this.opts.storagePrefix+'-items',JSON.stringify(a))}},{key:'addItem',value:function addItem(a){this.items.push(a),this.opts.persist&&this.setItemsStorage(this.items)}},{key:'updateItem',value:function updateItem(a,b){this.items[a]=b,this.opts.persist&&this.setItemsStorage(this.items)}},{key:'removeItem',value:function removeItem(a){var b=this.items.indexOf(a);return-1!==b&&(this.items.splice(b,1),this.opts.persist&&this.setItemsStorage(this.items),a)}},{key:'clearItems',value:function clearItems(){this.items=[],this.opts.persist&&this.setItemsStorage(this.items)}},{key:'exportItems',value:function(){var a=_asyncToGenerator(regeneratorRuntime.mark(function a(b){var c,d,e;return regeneratorRuntime.wrap(function(a){for(;;)switch(a.prev=a.next){case 0:return c=this.opts.translationServerUrl+'/'+this.opts.translationServerPrefix+'export?format='+b,d=_extends({method:'POST',headers:{"Content-Type":'application/json'},body:JSON.stringify(this.items)},this.opts.init),a.next=4,fetch(c,d);case 4:return e=a.sent,a.next=7,e.text();case 7:return a.abrupt('return',a.sent);case 8:case'end':return a.stop();}},a,this)}));return function exportItems(){return a.apply(this,arguments)}}()},{key:'translateIdentifier',value:function(){var a=_asyncToGenerator(regeneratorRuntime.mark(function a(b){for(var c=arguments.length,d=Array(1<c?c-1:0),e=1;e<c;e++)d[e-1]=arguments[e];var f,g;return regeneratorRuntime.wrap(function(a){for(;;)switch(a.prev=a.next){case 0:return f=this.opts.translationServerUrl+'/'+this.opts.translationServerPrefix+'search',g=_extends({method:'POST',headers:{"Content-Type":'text/plain'},body:b},this.opts.init),a.next=4,this.translate.apply(this,[f,g].concat(d));case 4:return a.abrupt('return',a.sent);case 5:case'end':return a.stop();}},a,this)}));return function translateIdentifier(){return a.apply(this,arguments)}}()},{key:'translateUrlItems',value:function(){var a=_asyncToGenerator(regeneratorRuntime.mark(function a(b,c){for(var d=arguments.length,e=Array(2<d?d-2:0),f=2;f<d;f++)e[f-2]=arguments[f];var g,h,i,j;return regeneratorRuntime.wrap(function(a){for(;;)switch(a.prev=a.next){case 0:return g=this.opts.translationServerUrl+'/'+this.opts.translationServerPrefix+'web',h=this.opts.sessionid,i=_extends({url:b,items:c,sessionid:h},this.opts.request),j=_extends({method:'POST',headers:{"Content-Type":'application/json'},body:JSON.stringify(i)},this.opts.init),a.next=6,this.translate.apply(this,[g,j].concat(e));case 6:return a.abrupt('return',a.sent);case 7:case'end':return a.stop();}},a,this)}));return function translateUrlItems(){return a.apply(this,arguments)}}()},{key:'translateUrl',value:function(){var a=_asyncToGenerator(regeneratorRuntime.mark(function a(b){for(var c=arguments.length,d=Array(1<c?c-1:0),e=1;e<c;e++)d[e-1]=arguments[e];var f,g,h,i;return regeneratorRuntime.wrap(function(a){for(;;)switch(a.prev=a.next){case 0:return f=this.opts.translationServerUrl+'/'+this.opts.translationServerPrefix+'web',g=this.opts.sessionid,h=_extends({url:b,sessionid:g},this.opts.request),i=_extends({method:'POST',headers:{"Content-Type":'application/json'},body:JSON.stringify(h)},this.opts.init),a.next=6,this.translate.apply(this,[f,i].concat(d));case 6:return a.abrupt('return',a.sent);case 7:case'end':return a.stop();}},a,this)}));return function translateUrl(){return a.apply(this,arguments)}}()},{key:'translate',value:function(){var a=_asyncToGenerator(regeneratorRuntime.mark(function a(b,c){var d,e,f,g=this,h=2<arguments.length&&void 0!==arguments[2]?arguments[2]:!0;return regeneratorRuntime.wrap(function(a){for(;;)switch(a.prev=a.next){case 0:return a.next=2,fetch(b,c);case 2:if(d=a.sent,!d.ok){a.next=11;break}return a.next=6,d.json();case 6:e=a.sent,Array.isArray(e)&&e.forEach(function(a){if('CURRENT_TIMESTAMP'===a.accessDate){var b=new Date(Date.now());a.accessDate=dateToSql(b,!0)}h&&g.addItem(a)}),f=Array.isArray(e)?COMPLETE:FAILED,a.next=19;break;case 11:if(300!==d.status){a.next=18;break}return a.next=14,d.json();case 14:e=a.sent,f=MULTIPLE_ITEMS,a.next=19;break;case 18:f=FAILED;case 19:return a.abrupt('return',{result:f,items:e,response:d});case 20:case'end':return a.stop();}},a,this)}));return function translate(){return a.apply(this,arguments)}}()},{key:'itemsCSL',get:function get(){return this.items.map(function(a){return itemToCSLJSON(a)})}},{key:'itemsRaw',get:function get(){return this.items}}],[{key:'COMPLETE',get:function get(){return COMPLETE}},{key:'MULTIPLE_ITEMS',get:function get(){return MULTIPLE_ITEMS}},{key:'FAILED',get:function get(){return FAILED}}]),a}();module.exports=ZoteroBib;

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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJub2RlX21vZHVsZXMvYmFiZWwtcmVnZW5lcmF0b3ItcnVudGltZS9ydW50aW1lLmpzIiwibm9kZV9tb2R1bGVzL2VzNi1wcm9taXNlL2F1dG8uanMiLCJub2RlX21vZHVsZXMvZXM2LXByb21pc2UvZGlzdC9lczYtcHJvbWlzZS5qcyIsIm5vZGVfbW9kdWxlcy9pc29tb3JwaGljLWZldGNoL2ZldGNoLW5wbS1icm93c2VyaWZ5LmpzIiwibm9kZV9tb2R1bGVzL3Byb2Nlc3MvYnJvd3Nlci5qcyIsIm5vZGVfbW9kdWxlcy93aGF0d2ctZmV0Y2gvZmV0Y2guanMiLCJzcmMvanMvYmliL2JpYi5qcyIsInNyYy9qcy9iaWIvZGVmYXVsdHMuanMiLCJzcmMvanMvYmliL3V0aWxzLmpzIiwic3JjL2pzL21haW4tY29tcGF0LmpzIiwic3JjL2pzL3pvdGVyby1zaGltL2NyZWF0b3ItdHlwZXMuanMiLCJzcmMvanMvem90ZXJvLXNoaW0vY3NsLW1hcHBpbmdzLmpzIiwic3JjL2pzL3pvdGVyby1zaGltL2RhdGUtdG8tc3FsLmpzIiwic3JjL2pzL3pvdGVyby1zaGltL2RlZmF1bHQtaXRlbS10eXBlLWNyZWF0b3ItdHlwZS1sb29rdXAuanMiLCJzcmMvanMvem90ZXJvLXNoaW0vZmllbGRzLmpzIiwic3JjL2pzL3pvdGVyby1zaGltL2l0ZW0tdG8tY3NsLWpzb24uanMiLCJzcmMvanMvem90ZXJvLXNoaW0vaXRlbS10eXBlcy5qcyIsInNyYy9qcy96b3Rlcm8tc2hpbS9scGFkLmpzIiwic3JjL2pzL3pvdGVyby1zaGltL3N0ci10by1kYXRlLmpzIiwic3JjL2pzL3pvdGVyby1zaGltL3R5cGUtc3BlY2lmaWMtZmllbGQtbWFwLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOztBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7O0FDanBCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7QUNKQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7QUNyb0NBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ05BO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDeExBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtB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RUFwQ2IsNkNBcUNjLEdBckNkLDZDQXNDYyxFQXRDZCw2Q0F1Q2MsRUF2Q2QsNkNBd0NjLEVBeENkLDZDQXlDYyxFQXpDZCw2Q0EwQ2MsRUExQ2QsNkNBMkNjLEVBM0NkLDZDQTRDYyxFQTVDZCw2Q0E2Q2MsRUE3Q2QsNkNBOENjLEVBOUNkLDZDQStDYyxFQS9DZCw2Q0FnRGMsRUFoRGQsNkNBaURjLEVBakRkLDZDQWtEYyxFQWxEZCw2Q0FtRGMsRUFuRGQsNkNBb0RjLEdBcERkLDZDQXFEYyxHQXJEZCw2Q0FzRGMsR0F0RGQsd0JBSE4sQ0E0REEsT0FBTyxPQUFQLENBQWlCLENBQ2hCLElBQUssb0JBRFcsQ0FFaEIsMEJBQTJCLHVDQUFxQixDQUcvQyxNQUZBLEdBQTJCLFFBQWxCLGFBQXNDLFlBRS9DLENBREEsRUFBNkIsUUFBbkIsYUFBd0MsU0FDbEQsQ0FBTyxxQkFBcUIsQ0FBQyxHQUFVLENBQVgsR0FBckIsQ0FDUCxDQU5lLEMiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dmFyIGY9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKTt0aHJvdyBmLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsZn12YXIgbD1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwobC5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxsLGwuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwiLyoqXG4gKiBDb3B5cmlnaHQgKGMpIDIwMTQsIEZhY2Vib29rLCBJbmMuXG4gKiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICpcbiAqIFRoaXMgc291cmNlIGNvZGUgaXMgbGljZW5zZWQgdW5kZXIgdGhlIEJTRC1zdHlsZSBsaWNlbnNlIGZvdW5kIGluIHRoZVxuICogaHR0cHM6Ly9yYXcuZ2l0aHViLmNvbS9mYWNlYm9vay9yZWdlbmVyYXRvci9tYXN0ZXIvTElDRU5TRSBmaWxlLiBBblxuICogYWRkaXRpb25hbCBncmFudCBvZiBwYXRlbnQgcmlnaHRzIGNhbiBiZSBmb3VuZCBpbiB0aGUgUEFURU5UUyBmaWxlIGluXG4gKiB0aGUgc2FtZSBkaXJlY3RvcnkuXG4gKi9cblxuIShmdW5jdGlvbihnbG9iYWwpIHtcbiAgXCJ1c2Ugc3RyaWN0XCI7XG5cbiAgdmFyIGhhc093biA9IE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHk7XG4gIHZhciB1bmRlZmluZWQ7IC8vIE1vcmUgY29tcHJlc3NpYmxlIHRoYW4gdm9pZCAwLlxuICB2YXIgaXRlcmF0b3JTeW1ib2wgPVxuICAgIHR5cGVvZiBTeW1ib2wgPT09IFwiZnVuY3Rpb25cIiAmJiBTeW1ib2wuaXRlcmF0b3IgfHwgXCJAQGl0ZXJhdG9yXCI7XG5cbiAgdmFyIGluTW9kdWxlID0gdHlwZW9mIG1vZHVsZSA9PT0gXCJvYmplY3RcIjtcbiAgdmFyIHJ1bnRpbWUgPSBnbG9iYWwucmVnZW5lcmF0b3JSdW50aW1lO1xuICBpZiAocnVudGltZSkge1xuICAgIGlmIChpbk1vZHVsZSkge1xuICAgICAgLy8gSWYgcmVnZW5lcmF0b3JSdW50aW1lIGlzIGRlZmluZWQgZ2xvYmFsbHkgYW5kIHdlJ3JlIGluIGEgbW9kdWxlLFxuICAgICAgLy8gbWFrZSB0aGUgZXhwb3J0cyBvYmplY3QgaWRlbnRpY2FsIHRvIHJlZ2VuZXJhdG9yUnVudGltZS5cbiAgICAgIG1vZHVsZS5leHBvcnRzID0gcnVudGltZTtcbiAgICB9XG4gICAgLy8gRG9uJ3QgYm90aGVyIGV2YWx1YXRpbmcgdGhlIHJlc3Qgb2YgdGhpcyBmaWxlIGlmIHRoZSBydW50aW1lIHdhc1xuICAgIC8vIGFscmVhZHkgZGVmaW5lZCBnbG9iYWxseS5cbiAgICByZXR1cm47XG4gIH1cblxuICAvLyBEZWZpbmUgdGhlIHJ1bnRpbWUgZ2xvYmFsbHkgKGFzIGV4cGVjdGVkIGJ5IGdlbmVyYXRlZCBjb2RlKSBhcyBlaXRoZXJcbiAgLy8gbW9kdWxlLmV4cG9ydHMgKGlmIHdlJ3JlIGluIGEgbW9kdWxlKSBvciBhIG5ldywgZW1wdHkgb2JqZWN0LlxuICBydW50aW1lID0gZ2xvYmFsLnJlZ2VuZXJhdG9yUnVudGltZSA9IGluTW9kdWxlID8gbW9kdWxlLmV4cG9ydHMgOiB7fTtcblxuICBmdW5jdGlvbiB3cmFwKGlubmVyRm4sIG91dGVyRm4sIHNlbGYsIHRyeUxvY3NMaXN0KSB7XG4gICAgLy8gSWYgb3V0ZXJGbiBwcm92aWRlZCwgdGhlbiBvdXRlckZuLnByb3RvdHlwZSBpbnN0YW5jZW9mIEdlbmVyYXRvci5cbiAgICB2YXIgZ2VuZXJhdG9yID0gT2JqZWN0LmNyZWF0ZSgob3V0ZXJGbiB8fCBHZW5lcmF0b3IpLnByb3RvdHlwZSk7XG4gICAgdmFyIGNvbnRleHQgPSBuZXcgQ29udGV4dCh0cnlMb2NzTGlzdCB8fCBbXSk7XG5cbiAgICAvLyBUaGUgLl9pbnZva2UgbWV0aG9kIHVuaWZpZXMgdGhlIGltcGxlbWVudGF0aW9ucyBvZiB0aGUgLm5leHQsXG4gICAgLy8gLnRocm93LCBhbmQgLnJldHVybiBtZXRob2RzLlxuICAgIGdlbmVyYXRvci5faW52b2tlID0gbWFrZUludm9rZU1ldGhvZChpbm5lckZuLCBzZWxmLCBjb250ZXh0KTtcblxuICAgIHJldHVybiBnZW5lcmF0b3I7XG4gIH1cbiAgcnVudGltZS53cmFwID0gd3JhcDtcblxuICAvLyBUcnkvY2F0Y2ggaGVscGVyIHRvIG1pbmltaXplIGRlb3B0aW1pemF0aW9ucy4gUmV0dXJucyBhIGNvbXBsZXRpb25cbiAgLy8gcmVjb3JkIGxpa2UgY29udGV4dC50cnlFbnRyaWVzW2ldLmNvbXBsZXRpb24uIFRoaXMgaW50ZXJmYWNlIGNvdWxkXG4gIC8vIGhhdmUgYmVlbiAoYW5kIHdhcyBwcmV2aW91c2x5KSBkZXNpZ25lZCB0byB0YWtlIGEgY2xvc3VyZSB0byBiZVxuICAvLyBpbnZva2VkIHdpdGhvdXQgYXJndW1lbnRzLCBidXQgaW4gYWxsIHRoZSBjYXNlcyB3ZSBjYXJlIGFib3V0IHdlXG4gIC8vIGFscmVhZHkgaGF2ZSBhbiBleGlzdGluZyBtZXRob2Qgd2Ugd2FudCB0byBjYWxsLCBzbyB0aGVyZSdzIG5vIG5lZWRcbiAgLy8gdG8gY3JlYXRlIGEgbmV3IGZ1bmN0aW9uIG9iamVjdC4gV2UgY2FuIGV2ZW4gZ2V0IGF3YXkgd2l0aCBhc3N1bWluZ1xuICAvLyB0aGUgbWV0aG9kIHRha2VzIGV4YWN0bHkgb25lIGFyZ3VtZW50LCBzaW5jZSB0aGF0IGhhcHBlbnMgdG8gYmUgdHJ1ZVxuICAvLyBpbiBldmVyeSBjYXNlLCBzbyB3ZSBkb24ndCBoYXZlIHRvIHRvdWNoIHRoZSBhcmd1bWVudHMgb2JqZWN0LiBUaGVcbiAgLy8gb25seSBhZGRpdGlvbmFsIGFsbG9jYXRpb24gcmVxdWlyZWQgaXMgdGhlIGNvbXBsZXRpb24gcmVjb3JkLCB3aGljaFxuICAvLyBoYXMgYSBzdGFibGUgc2hhcGUgYW5kIHNvIGhvcGVmdWxseSBzaG91bGQgYmUgY2hlYXAgdG8gYWxsb2NhdGUuXG4gIGZ1bmN0aW9uIHRyeUNhdGNoKGZuLCBvYmosIGFyZykge1xuICAgIHRyeSB7XG4gICAgICByZXR1cm4geyB0eXBlOiBcIm5vcm1hbFwiLCBhcmc6IGZuLmNhbGwob2JqLCBhcmcpIH07XG4gICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICByZXR1cm4geyB0eXBlOiBcInRocm93XCIsIGFyZzogZXJyIH07XG4gICAgfVxuICB9XG5cbiAgdmFyIEdlblN0YXRlU3VzcGVuZGVkU3RhcnQgPSBcInN1c3BlbmRlZFN0YXJ0XCI7XG4gIHZhciBHZW5TdGF0ZVN1c3BlbmRlZFlpZWxkID0gXCJzdXNwZW5kZWRZaWVsZFwiO1xuICB2YXIgR2VuU3RhdGVFeGVjdXRpbmcgPSBcImV4ZWN1dGluZ1wiO1xuICB2YXIgR2VuU3RhdGVDb21wbGV0ZWQgPSBcImNvbXBsZXRlZFwiO1xuXG4gIC8vIFJldHVybmluZyB0aGlzIG9iamVjdCBmcm9tIHRoZSBpbm5lckZuIGhhcyB0aGUgc2FtZSBlZmZlY3QgYXNcbiAgLy8gYnJlYWtpbmcgb3V0IG9mIHRoZSBkaXNwYXRjaCBzd2l0Y2ggc3RhdGVtZW50LlxuICB2YXIgQ29udGludWVTZW50aW5lbCA9IHt9O1xuXG4gIC8vIER1bW15IGNvbnN0cnVjdG9yIGZ1bmN0aW9ucyB0aGF0IHdlIHVzZSBhcyB0aGUgLmNvbnN0cnVjdG9yIGFuZFxuICAvLyAuY29uc3RydWN0b3IucHJvdG90eXBlIHByb3BlcnRpZXMgZm9yIGZ1bmN0aW9ucyB0aGF0IHJldHVybiBHZW5lcmF0b3JcbiAgLy8gb2JqZWN0cy4gRm9yIGZ1bGwgc3BlYyBjb21wbGlhbmNlLCB5b3UgbWF5IHdpc2ggdG8gY29uZmlndXJlIHlvdXJcbiAgLy8gbWluaWZpZXIgbm90IHRvIG1hbmdsZSB0aGUgbmFtZXMgb2YgdGhlc2UgdHdvIGZ1bmN0aW9ucy5cbiAgZnVuY3Rpb24gR2VuZXJhdG9yKCkge31cbiAgZnVuY3Rpb24gR2VuZXJhdG9yRnVuY3Rpb24oKSB7fVxuICBmdW5jdGlvbiBHZW5lcmF0b3JGdW5jdGlvblByb3RvdHlwZSgpIHt9XG5cbiAgdmFyIEdwID0gR2VuZXJhdG9yRnVuY3Rpb25Qcm90b3R5cGUucHJvdG90eXBlID0gR2VuZXJhdG9yLnByb3RvdHlwZTtcbiAgR2VuZXJhdG9yRnVuY3Rpb24ucHJvdG90eXBlID0gR3AuY29uc3RydWN0b3IgPSBHZW5lcmF0b3JGdW5jdGlvblByb3RvdHlwZTtcbiAgR2VuZXJhdG9yRnVuY3Rpb25Qcm90b3R5cGUuY29uc3RydWN0b3IgPSBHZW5lcmF0b3JGdW5jdGlvbjtcbiAgR2VuZXJhdG9yRnVuY3Rpb24uZGlzcGxheU5hbWUgPSBcIkdlbmVyYXRvckZ1bmN0aW9uXCI7XG5cbiAgLy8gSGVscGVyIGZvciBkZWZpbmluZyB0aGUgLm5leHQsIC50aHJvdywgYW5kIC5yZXR1cm4gbWV0aG9kcyBvZiB0aGVcbiAgLy8gSXRlcmF0b3IgaW50ZXJmYWNlIGluIHRlcm1zIG9mIGEgc2luZ2xlIC5faW52b2tlIG1ldGhvZC5cbiAgZnVuY3Rpb24gZGVmaW5lSXRlcmF0b3JNZXRob2RzKHByb3RvdHlwZSkge1xuICAgIFtcIm5leHRcIiwgXCJ0aHJvd1wiLCBcInJldHVyblwiXS5mb3JFYWNoKGZ1bmN0aW9uKG1ldGhvZCkge1xuICAgICAgcHJvdG90eXBlW21ldGhvZF0gPSBmdW5jdGlvbihhcmcpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2ludm9rZShtZXRob2QsIGFyZyk7XG4gICAgICB9O1xuICAgIH0pO1xuICB9XG5cbiAgcnVudGltZS5pc0dlbmVyYXRvckZ1bmN0aW9uID0gZnVuY3Rpb24oZ2VuRnVuKSB7XG4gICAgdmFyIGN0b3IgPSB0eXBlb2YgZ2VuRnVuID09PSBcImZ1bmN0aW9uXCIgJiYgZ2VuRnVuLmNvbnN0cnVjdG9yO1xuICAgIHJldHVybiBjdG9yXG4gICAgICA/IGN0b3IgPT09IEdlbmVyYXRvckZ1bmN0aW9uIHx8XG4gICAgICAgIC8vIEZvciB0aGUgbmF0aXZlIEdlbmVyYXRvckZ1bmN0aW9uIGNvbnN0cnVjdG9yLCB0aGUgYmVzdCB3ZSBjYW5cbiAgICAgICAgLy8gZG8gaXMgdG8gY2hlY2sgaXRzIC5uYW1lIHByb3BlcnR5LlxuICAgICAgICAoY3Rvci5kaXNwbGF5TmFtZSB8fCBjdG9yLm5hbWUpID09PSBcIkdlbmVyYXRvckZ1bmN0aW9uXCJcbiAgICAgIDogZmFsc2U7XG4gIH07XG5cbiAgcnVudGltZS5tYXJrID0gZnVuY3Rpb24oZ2VuRnVuKSB7XG4gICAgaWYgKE9iamVjdC5zZXRQcm90b3R5cGVPZikge1xuICAgICAgT2JqZWN0LnNldFByb3RvdHlwZU9mKGdlbkZ1biwgR2VuZXJhdG9yRnVuY3Rpb25Qcm90b3R5cGUpO1xuICAgIH0gZWxzZSB7XG4gICAgICBnZW5GdW4uX19wcm90b19fID0gR2VuZXJhdG9yRnVuY3Rpb25Qcm90b3R5cGU7XG4gICAgfVxuICAgIGdlbkZ1bi5wcm90b3R5cGUgPSBPYmplY3QuY3JlYXRlKEdwKTtcbiAgICByZXR1cm4gZ2VuRnVuO1xuICB9O1xuXG4gIC8vIFdpdGhpbiB0aGUgYm9keSBvZiBhbnkgYXN5bmMgZnVuY3Rpb24sIGBhd2FpdCB4YCBpcyB0cmFuc2Zvcm1lZCB0b1xuICAvLyBgeWllbGQgcmVnZW5lcmF0b3JSdW50aW1lLmF3cmFwKHgpYCwgc28gdGhhdCB0aGUgcnVudGltZSBjYW4gdGVzdFxuICAvLyBgdmFsdWUgaW5zdGFuY2VvZiBBd2FpdEFyZ3VtZW50YCB0byBkZXRlcm1pbmUgaWYgdGhlIHlpZWxkZWQgdmFsdWUgaXNcbiAgLy8gbWVhbnQgdG8gYmUgYXdhaXRlZC4gU29tZSBtYXkgY29uc2lkZXIgdGhlIG5hbWUgb2YgdGhpcyBtZXRob2QgdG9vXG4gIC8vIGN1dGVzeSwgYnV0IHRoZXkgYXJlIGN1cm11ZGdlb25zLlxuICBydW50aW1lLmF3cmFwID0gZnVuY3Rpb24oYXJnKSB7XG4gICAgcmV0dXJuIG5ldyBBd2FpdEFyZ3VtZW50KGFyZyk7XG4gIH07XG5cbiAgZnVuY3Rpb24gQXdhaXRBcmd1bWVudChhcmcpIHtcbiAgICB0aGlzLmFyZyA9IGFyZztcbiAgfVxuXG4gIGZ1bmN0aW9uIEFzeW5jSXRlcmF0b3IoZ2VuZXJhdG9yKSB7XG4gICAgLy8gVGhpcyBpbnZva2UgZnVuY3Rpb24gaXMgd3JpdHRlbiBpbiBhIHN0eWxlIHRoYXQgYXNzdW1lcyBzb21lXG4gICAgLy8gY2FsbGluZyBmdW5jdGlvbiAob3IgUHJvbWlzZSkgd2lsbCBoYW5kbGUgZXhjZXB0aW9ucy5cbiAgICBmdW5jdGlvbiBpbnZva2UobWV0aG9kLCBhcmcpIHtcbiAgICAgIHZhciByZXN1bHQgPSBnZW5lcmF0b3JbbWV0aG9kXShhcmcpO1xuICAgICAgdmFyIHZhbHVlID0gcmVzdWx0LnZhbHVlO1xuICAgICAgcmV0dXJuIHZhbHVlIGluc3RhbmNlb2YgQXdhaXRBcmd1bWVudFxuICAgICAgICA/IFByb21pc2UucmVzb2x2ZSh2YWx1ZS5hcmcpLnRoZW4oaW52b2tlTmV4dCwgaW52b2tlVGhyb3cpXG4gICAgICAgIDogUHJvbWlzZS5yZXNvbHZlKHZhbHVlKS50aGVuKGZ1bmN0aW9uKHVud3JhcHBlZCkge1xuICAgICAgICAgICAgLy8gV2hlbiBhIHlpZWxkZWQgUHJvbWlzZSBpcyByZXNvbHZlZCwgaXRzIGZpbmFsIHZhbHVlIGJlY29tZXNcbiAgICAgICAgICAgIC8vIHRoZSAudmFsdWUgb2YgdGhlIFByb21pc2U8e3ZhbHVlLGRvbmV9PiByZXN1bHQgZm9yIHRoZVxuICAgICAgICAgICAgLy8gY3VycmVudCBpdGVyYXRpb24uIElmIHRoZSBQcm9taXNlIGlzIHJlamVjdGVkLCBob3dldmVyLCB0aGVcbiAgICAgICAgICAgIC8vIHJlc3VsdCBmb3IgdGhpcyBpdGVyYXRpb24gd2lsbCBiZSByZWplY3RlZCB3aXRoIHRoZSBzYW1lXG4gICAgICAgICAgICAvLyByZWFzb24uIE5vdGUgdGhhdCByZWplY3Rpb25zIG9mIHlpZWxkZWQgUHJvbWlzZXMgYXJlIG5vdFxuICAgICAgICAgICAgLy8gdGhyb3duIGJhY2sgaW50byB0aGUgZ2VuZXJhdG9yIGZ1bmN0aW9uLCBhcyBpcyB0aGUgY2FzZVxuICAgICAgICAgICAgLy8gd2hlbiBhbiBhd2FpdGVkIFByb21pc2UgaXMgcmVqZWN0ZWQuIFRoaXMgZGlmZmVyZW5jZSBpblxuICAgICAgICAgICAgLy8gYmVoYXZpb3IgYmV0d2VlbiB5aWVsZCBhbmQgYXdhaXQgaXMgaW1wb3J0YW50LCBiZWNhdXNlIGl0XG4gICAgICAgICAgICAvLyBhbGxvd3MgdGhlIGNvbnN1bWVyIHRvIGRlY2lkZSB3aGF0IHRvIGRvIHdpdGggdGhlIHlpZWxkZWRcbiAgICAgICAgICAgIC8vIHJlamVjdGlvbiAoc3dhbGxvdyBpdCBhbmQgY29udGludWUsIG1hbnVhbGx5IC50aHJvdyBpdCBiYWNrXG4gICAgICAgICAgICAvLyBpbnRvIHRoZSBnZW5lcmF0b3IsIGFiYW5kb24gaXRlcmF0aW9uLCB3aGF0ZXZlcikuIFdpdGhcbiAgICAgICAgICAgIC8vIGF3YWl0LCBieSBjb250cmFzdCwgdGhlcmUgaXMgbm8gb3Bwb3J0dW5pdHkgdG8gZXhhbWluZSB0aGVcbiAgICAgICAgICAgIC8vIHJlamVjdGlvbiByZWFzb24gb3V0c2lkZSB0aGUgZ2VuZXJhdG9yIGZ1bmN0aW9uLCBzbyB0aGVcbiAgICAgICAgICAgIC8vIG9ubHkgb3B0aW9uIGlzIHRvIHRocm93IGl0IGZyb20gdGhlIGF3YWl0IGV4cHJlc3Npb24sIGFuZFxuICAgICAgICAgICAgLy8gbGV0IHRoZSBnZW5lcmF0b3IgZnVuY3Rpb24gaGFuZGxlIHRoZSBleGNlcHRpb24uXG4gICAgICAgICAgICByZXN1bHQudmFsdWUgPSB1bndyYXBwZWQ7XG4gICAgICAgICAgICByZXR1cm4gcmVzdWx0O1xuICAgICAgICAgIH0pO1xuICAgIH1cblxuICAgIGlmICh0eXBlb2YgcHJvY2VzcyA9PT0gXCJvYmplY3RcIiAmJiBwcm9jZXNzLmRvbWFpbikge1xuICAgICAgaW52b2tlID0gcHJvY2Vzcy5kb21haW4uYmluZChpbnZva2UpO1xuICAgIH1cblxuICAgIHZhciBpbnZva2VOZXh0ID0gaW52b2tlLmJpbmQoZ2VuZXJhdG9yLCBcIm5leHRcIik7XG4gICAgdmFyIGludm9rZVRocm93ID0gaW52b2tlLmJpbmQoZ2VuZXJhdG9yLCBcInRocm93XCIpO1xuICAgIHZhciBpbnZva2VSZXR1cm4gPSBpbnZva2UuYmluZChnZW5lcmF0b3IsIFwicmV0dXJuXCIpO1xuICAgIHZhciBwcmV2aW91c1Byb21pc2U7XG5cbiAgICBmdW5jdGlvbiBlbnF1ZXVlKG1ldGhvZCwgYXJnKSB7XG4gICAgICBmdW5jdGlvbiBjYWxsSW52b2tlV2l0aE1ldGhvZEFuZEFyZygpIHtcbiAgICAgICAgcmV0dXJuIGludm9rZShtZXRob2QsIGFyZyk7XG4gICAgICB9XG5cbiAgICAgIHJldHVybiBwcmV2aW91c1Byb21pc2UgPVxuICAgICAgICAvLyBJZiBlbnF1ZXVlIGhhcyBiZWVuIGNhbGxlZCBiZWZvcmUsIHRoZW4gd2Ugd2FudCB0byB3YWl0IHVudGlsXG4gICAgICAgIC8vIGFsbCBwcmV2aW91cyBQcm9taXNlcyBoYXZlIGJlZW4gcmVzb2x2ZWQgYmVmb3JlIGNhbGxpbmcgaW52b2tlLFxuICAgICAgICAvLyBzbyB0aGF0IHJlc3VsdHMgYXJlIGFsd2F5cyBkZWxpdmVyZWQgaW4gdGhlIGNvcnJlY3Qgb3JkZXIuIElmXG4gICAgICAgIC8vIGVucXVldWUgaGFzIG5vdCBiZWVuIGNhbGxlZCBiZWZvcmUsIHRoZW4gaXQgaXMgaW1wb3J0YW50IHRvXG4gICAgICAgIC8vIGNhbGwgaW52b2tlIGltbWVkaWF0ZWx5LCB3aXRob3V0IHdhaXRpbmcgb24gYSBjYWxsYmFjayB0byBmaXJlLFxuICAgICAgICAvLyBzbyB0aGF0IHRoZSBhc3luYyBnZW5lcmF0b3IgZnVuY3Rpb24gaGFzIHRoZSBvcHBvcnR1bml0eSB0byBkb1xuICAgICAgICAvLyBhbnkgbmVjZXNzYXJ5IHNldHVwIGluIGEgcHJlZGljdGFibGUgd2F5LiBUaGlzIHByZWRpY3RhYmlsaXR5XG4gICAgICAgIC8vIGlzIHdoeSB0aGUgUHJvbWlzZSBjb25zdHJ1Y3RvciBzeW5jaHJvbm91c2x5IGludm9rZXMgaXRzXG4gICAgICAgIC8vIGV4ZWN1dG9yIGNhbGxiYWNrLCBhbmQgd2h5IGFzeW5jIGZ1bmN0aW9ucyBzeW5jaHJvbm91c2x5XG4gICAgICAgIC8vIGV4ZWN1dGUgY29kZSBiZWZvcmUgdGhlIGZpcnN0IGF3YWl0LiBTaW5jZSB3ZSBpbXBsZW1lbnQgc2ltcGxlXG4gICAgICAgIC8vIGFzeW5jIGZ1bmN0aW9ucyBpbiB0ZXJtcyBvZiBhc3luYyBnZW5lcmF0b3JzLCBpdCBpcyBlc3BlY2lhbGx5XG4gICAgICAgIC8vIGltcG9ydGFudCB0byBnZXQgdGhpcyByaWdodCwgZXZlbiB0aG91Z2ggaXQgcmVxdWlyZXMgY2FyZS5cbiAgICAgICAgcHJldmlvdXNQcm9taXNlID8gcHJldmlvdXNQcm9taXNlLnRoZW4oXG4gICAgICAgICAgY2FsbEludm9rZVdpdGhNZXRob2RBbmRBcmcsXG4gICAgICAgICAgLy8gQXZvaWQgcHJvcGFnYXRpbmcgZmFpbHVyZXMgdG8gUHJvbWlzZXMgcmV0dXJuZWQgYnkgbGF0ZXJcbiAgICAgICAgICAvLyBpbnZvY2F0aW9ucyBvZiB0aGUgaXRlcmF0b3IuXG4gICAgICAgICAgY2FsbEludm9rZVdpdGhNZXRob2RBbmRBcmdcbiAgICAgICAgKSA6IG5ldyBQcm9taXNlKGZ1bmN0aW9uIChyZXNvbHZlKSB7XG4gICAgICAgICAgcmVzb2x2ZShjYWxsSW52b2tlV2l0aE1ldGhvZEFuZEFyZygpKTtcbiAgICAgICAgfSk7XG4gICAgfVxuXG4gICAgLy8gRGVmaW5lIHRoZSB1bmlmaWVkIGhlbHBlciBtZXRob2QgdGhhdCBpcyB1c2VkIHRvIGltcGxlbWVudCAubmV4dCxcbiAgICAvLyAudGhyb3csIGFuZCAucmV0dXJuIChzZWUgZGVmaW5lSXRlcmF0b3JNZXRob2RzKS5cbiAgICB0aGlzLl9pbnZva2UgPSBlbnF1ZXVlO1xuICB9XG5cbiAgZGVmaW5lSXRlcmF0b3JNZXRob2RzKEFzeW5jSXRlcmF0b3IucHJvdG90eXBlKTtcblxuICAvLyBOb3RlIHRoYXQgc2ltcGxlIGFzeW5jIGZ1bmN0aW9ucyBhcmUgaW1wbGVtZW50ZWQgb24gdG9wIG9mXG4gIC8vIEFzeW5jSXRlcmF0b3Igb2JqZWN0czsgdGhleSBqdXN0IHJldHVybiBhIFByb21pc2UgZm9yIHRoZSB2YWx1ZSBvZlxuICAvLyB0aGUgZmluYWwgcmVzdWx0IHByb2R1Y2VkIGJ5IHRoZSBpdGVyYXRvci5cbiAgcnVudGltZS5hc3luYyA9IGZ1bmN0aW9uKGlubmVyRm4sIG91dGVyRm4sIHNlbGYsIHRyeUxvY3NMaXN0KSB7XG4gICAgdmFyIGl0ZXIgPSBuZXcgQXN5bmNJdGVyYXRvcihcbiAgICAgIHdyYXAoaW5uZXJGbiwgb3V0ZXJGbiwgc2VsZiwgdHJ5TG9jc0xpc3QpXG4gICAgKTtcblxuICAgIHJldHVybiBydW50aW1lLmlzR2VuZXJhdG9yRnVuY3Rpb24ob3V0ZXJGbilcbiAgICAgID8gaXRlciAvLyBJZiBvdXRlckZuIGlzIGEgZ2VuZXJhdG9yLCByZXR1cm4gdGhlIGZ1bGwgaXRlcmF0b3IuXG4gICAgICA6IGl0ZXIubmV4dCgpLnRoZW4oZnVuY3Rpb24ocmVzdWx0KSB7XG4gICAgICAgICAgcmV0dXJuIHJlc3VsdC5kb25lID8gcmVzdWx0LnZhbHVlIDogaXRlci5uZXh0KCk7XG4gICAgICAgIH0pO1xuICB9O1xuXG4gIGZ1bmN0aW9uIG1ha2VJbnZva2VNZXRob2QoaW5uZXJGbiwgc2VsZiwgY29udGV4dCkge1xuICAgIHZhciBzdGF0ZSA9IEdlblN0YXRlU3VzcGVuZGVkU3RhcnQ7XG5cbiAgICByZXR1cm4gZnVuY3Rpb24gaW52b2tlKG1ldGhvZCwgYXJnKSB7XG4gICAgICBpZiAoc3RhdGUgPT09IEdlblN0YXRlRXhlY3V0aW5nKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihcIkdlbmVyYXRvciBpcyBhbHJlYWR5IHJ1bm5pbmdcIik7XG4gICAgICB9XG5cbiAgICAgIGlmIChzdGF0ZSA9PT0gR2VuU3RhdGVDb21wbGV0ZWQpIHtcbiAgICAgICAgaWYgKG1ldGhvZCA9PT0gXCJ0aHJvd1wiKSB7XG4gICAgICAgICAgdGhyb3cgYXJnO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gQmUgZm9yZ2l2aW5nLCBwZXIgMjUuMy4zLjMuMyBvZiB0aGUgc3BlYzpcbiAgICAgICAgLy8gaHR0cHM6Ly9wZW9wbGUubW96aWxsYS5vcmcvfmpvcmVuZG9yZmYvZXM2LWRyYWZ0Lmh0bWwjc2VjLWdlbmVyYXRvcnJlc3VtZVxuICAgICAgICByZXR1cm4gZG9uZVJlc3VsdCgpO1xuICAgICAgfVxuXG4gICAgICB3aGlsZSAodHJ1ZSkge1xuICAgICAgICB2YXIgZGVsZWdhdGUgPSBjb250ZXh0LmRlbGVnYXRlO1xuICAgICAgICBpZiAoZGVsZWdhdGUpIHtcbiAgICAgICAgICBpZiAobWV0aG9kID09PSBcInJldHVyblwiIHx8XG4gICAgICAgICAgICAgIChtZXRob2QgPT09IFwidGhyb3dcIiAmJiBkZWxlZ2F0ZS5pdGVyYXRvclttZXRob2RdID09PSB1bmRlZmluZWQpKSB7XG4gICAgICAgICAgICAvLyBBIHJldHVybiBvciB0aHJvdyAod2hlbiB0aGUgZGVsZWdhdGUgaXRlcmF0b3IgaGFzIG5vIHRocm93XG4gICAgICAgICAgICAvLyBtZXRob2QpIGFsd2F5cyB0ZXJtaW5hdGVzIHRoZSB5aWVsZCogbG9vcC5cbiAgICAgICAgICAgIGNvbnRleHQuZGVsZWdhdGUgPSBudWxsO1xuXG4gICAgICAgICAgICAvLyBJZiB0aGUgZGVsZWdhdGUgaXRlcmF0b3IgaGFzIGEgcmV0dXJuIG1ldGhvZCwgZ2l2ZSBpdCBhXG4gICAgICAgICAgICAvLyBjaGFuY2UgdG8gY2xlYW4gdXAuXG4gICAgICAgICAgICB2YXIgcmV0dXJuTWV0aG9kID0gZGVsZWdhdGUuaXRlcmF0b3JbXCJyZXR1cm5cIl07XG4gICAgICAgICAgICBpZiAocmV0dXJuTWV0aG9kKSB7XG4gICAgICAgICAgICAgIHZhciByZWNvcmQgPSB0cnlDYXRjaChyZXR1cm5NZXRob2QsIGRlbGVnYXRlLml0ZXJhdG9yLCBhcmcpO1xuICAgICAgICAgICAgICBpZiAocmVjb3JkLnR5cGUgPT09IFwidGhyb3dcIikge1xuICAgICAgICAgICAgICAgIC8vIElmIHRoZSByZXR1cm4gbWV0aG9kIHRocmV3IGFuIGV4Y2VwdGlvbiwgbGV0IHRoYXRcbiAgICAgICAgICAgICAgICAvLyBleGNlcHRpb24gcHJldmFpbCBvdmVyIHRoZSBvcmlnaW5hbCByZXR1cm4gb3IgdGhyb3cuXG4gICAgICAgICAgICAgICAgbWV0aG9kID0gXCJ0aHJvd1wiO1xuICAgICAgICAgICAgICAgIGFyZyA9IHJlY29yZC5hcmc7XG4gICAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKG1ldGhvZCA9PT0gXCJyZXR1cm5cIikge1xuICAgICAgICAgICAgICAvLyBDb250aW51ZSB3aXRoIHRoZSBvdXRlciByZXR1cm4sIG5vdyB0aGF0IHRoZSBkZWxlZ2F0ZVxuICAgICAgICAgICAgICAvLyBpdGVyYXRvciBoYXMgYmVlbiB0ZXJtaW5hdGVkLlxuICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG5cbiAgICAgICAgICB2YXIgcmVjb3JkID0gdHJ5Q2F0Y2goXG4gICAgICAgICAgICBkZWxlZ2F0ZS5pdGVyYXRvclttZXRob2RdLFxuICAgICAgICAgICAgZGVsZWdhdGUuaXRlcmF0b3IsXG4gICAgICAgICAgICBhcmdcbiAgICAgICAgICApO1xuXG4gICAgICAgICAgaWYgKHJlY29yZC50eXBlID09PSBcInRocm93XCIpIHtcbiAgICAgICAgICAgIGNvbnRleHQuZGVsZWdhdGUgPSBudWxsO1xuXG4gICAgICAgICAgICAvLyBMaWtlIHJldHVybmluZyBnZW5lcmF0b3IudGhyb3codW5jYXVnaHQpLCBidXQgd2l0aG91dCB0aGVcbiAgICAgICAgICAgIC8vIG92ZXJoZWFkIG9mIGFuIGV4dHJhIGZ1bmN0aW9uIGNhbGwuXG4gICAgICAgICAgICBtZXRob2QgPSBcInRocm93XCI7XG4gICAgICAgICAgICBhcmcgPSByZWNvcmQuYXJnO1xuICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgLy8gRGVsZWdhdGUgZ2VuZXJhdG9yIHJhbiBhbmQgaGFuZGxlZCBpdHMgb3duIGV4Y2VwdGlvbnMgc29cbiAgICAgICAgICAvLyByZWdhcmRsZXNzIG9mIHdoYXQgdGhlIG1ldGhvZCB3YXMsIHdlIGNvbnRpbnVlIGFzIGlmIGl0IGlzXG4gICAgICAgICAgLy8gXCJuZXh0XCIgd2l0aCBhbiB1bmRlZmluZWQgYXJnLlxuICAgICAgICAgIG1ldGhvZCA9IFwibmV4dFwiO1xuICAgICAgICAgIGFyZyA9IHVuZGVmaW5lZDtcblxuICAgICAgICAgIHZhciBpbmZvID0gcmVjb3JkLmFyZztcbiAgICAgICAgICBpZiAoaW5mby5kb25lKSB7XG4gICAgICAgICAgICBjb250ZXh0W2RlbGVnYXRlLnJlc3VsdE5hbWVdID0gaW5mby52YWx1ZTtcbiAgICAgICAgICAgIGNvbnRleHQubmV4dCA9IGRlbGVnYXRlLm5leHRMb2M7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHN0YXRlID0gR2VuU3RhdGVTdXNwZW5kZWRZaWVsZDtcbiAgICAgICAgICAgIHJldHVybiBpbmZvO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIGNvbnRleHQuZGVsZWdhdGUgPSBudWxsO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKG1ldGhvZCA9PT0gXCJuZXh0XCIpIHtcbiAgICAgICAgICBjb250ZXh0Ll9zZW50ID0gYXJnO1xuXG4gICAgICAgICAgaWYgKHN0YXRlID09PSBHZW5TdGF0ZVN1c3BlbmRlZFlpZWxkKSB7XG4gICAgICAgICAgICBjb250ZXh0LnNlbnQgPSBhcmc7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGNvbnRleHQuc2VudCA9IHVuZGVmaW5lZDtcbiAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSBpZiAobWV0aG9kID09PSBcInRocm93XCIpIHtcbiAgICAgICAgICBpZiAoc3RhdGUgPT09IEdlblN0YXRlU3VzcGVuZGVkU3RhcnQpIHtcbiAgICAgICAgICAgIHN0YXRlID0gR2VuU3RhdGVDb21wbGV0ZWQ7XG4gICAgICAgICAgICB0aHJvdyBhcmc7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgaWYgKGNvbnRleHQuZGlzcGF0Y2hFeGNlcHRpb24oYXJnKSkge1xuICAgICAgICAgICAgLy8gSWYgdGhlIGRpc3BhdGNoZWQgZXhjZXB0aW9uIHdhcyBjYXVnaHQgYnkgYSBjYXRjaCBibG9jayxcbiAgICAgICAgICAgIC8vIHRoZW4gbGV0IHRoYXQgY2F0Y2ggYmxvY2sgaGFuZGxlIHRoZSBleGNlcHRpb24gbm9ybWFsbHkuXG4gICAgICAgICAgICBtZXRob2QgPSBcIm5leHRcIjtcbiAgICAgICAgICAgIGFyZyA9IHVuZGVmaW5lZDtcbiAgICAgICAgICB9XG5cbiAgICAgICAgfSBlbHNlIGlmIChtZXRob2QgPT09IFwicmV0dXJuXCIpIHtcbiAgICAgICAgICBjb250ZXh0LmFicnVwdChcInJldHVyblwiLCBhcmcpO1xuICAgICAgICB9XG5cbiAgICAgICAgc3RhdGUgPSBHZW5TdGF0ZUV4ZWN1dGluZztcblxuICAgICAgICB2YXIgcmVjb3JkID0gdHJ5Q2F0Y2goaW5uZXJGbiwgc2VsZiwgY29udGV4dCk7XG4gICAgICAgIGlmIChyZWNvcmQudHlwZSA9PT0gXCJub3JtYWxcIikge1xuICAgICAgICAgIC8vIElmIGFuIGV4Y2VwdGlvbiBpcyB0aHJvd24gZnJvbSBpbm5lckZuLCB3ZSBsZWF2ZSBzdGF0ZSA9PT1cbiAgICAgICAgICAvLyBHZW5TdGF0ZUV4ZWN1dGluZyBhbmQgbG9vcCBiYWNrIGZvciBhbm90aGVyIGludm9jYXRpb24uXG4gICAgICAgICAgc3RhdGUgPSBjb250ZXh0LmRvbmVcbiAgICAgICAgICAgID8gR2VuU3RhdGVDb21wbGV0ZWRcbiAgICAgICAgICAgIDogR2VuU3RhdGVTdXNwZW5kZWRZaWVsZDtcblxuICAgICAgICAgIHZhciBpbmZvID0ge1xuICAgICAgICAgICAgdmFsdWU6IHJlY29yZC5hcmcsXG4gICAgICAgICAgICBkb25lOiBjb250ZXh0LmRvbmVcbiAgICAgICAgICB9O1xuXG4gICAgICAgICAgaWYgKHJlY29yZC5hcmcgPT09IENvbnRpbnVlU2VudGluZWwpIHtcbiAgICAgICAgICAgIGlmIChjb250ZXh0LmRlbGVnYXRlICYmIG1ldGhvZCA9PT0gXCJuZXh0XCIpIHtcbiAgICAgICAgICAgICAgLy8gRGVsaWJlcmF0ZWx5IGZvcmdldCB0aGUgbGFzdCBzZW50IHZhbHVlIHNvIHRoYXQgd2UgZG9uJ3RcbiAgICAgICAgICAgICAgLy8gYWNjaWRlbnRhbGx5IHBhc3MgaXQgb24gdG8gdGhlIGRlbGVnYXRlLlxuICAgICAgICAgICAgICBhcmcgPSB1bmRlZmluZWQ7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHJldHVybiBpbmZvO1xuICAgICAgICAgIH1cblxuICAgICAgICB9IGVsc2UgaWYgKHJlY29yZC50eXBlID09PSBcInRocm93XCIpIHtcbiAgICAgICAgICBzdGF0ZSA9IEdlblN0YXRlQ29tcGxldGVkO1xuICAgICAgICAgIC8vIERpc3BhdGNoIHRoZSBleGNlcHRpb24gYnkgbG9vcGluZyBiYWNrIGFyb3VuZCB0byB0aGVcbiAgICAgICAgICAvLyBjb250ZXh0LmRpc3BhdGNoRXhjZXB0aW9uKGFyZykgY2FsbCBhYm92ZS5cbiAgICAgICAgICBtZXRob2QgPSBcInRocm93XCI7XG4gICAgICAgICAgYXJnID0gcmVjb3JkLmFyZztcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH07XG4gIH1cblxuICAvLyBEZWZpbmUgR2VuZXJhdG9yLnByb3RvdHlwZS57bmV4dCx0aHJvdyxyZXR1cm59IGluIHRlcm1zIG9mIHRoZVxuICAvLyB1bmlmaWVkIC5faW52b2tlIGhlbHBlciBtZXRob2QuXG4gIGRlZmluZUl0ZXJhdG9yTWV0aG9kcyhHcCk7XG5cbiAgR3BbaXRlcmF0b3JTeW1ib2xdID0gZnVuY3Rpb24oKSB7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH07XG5cbiAgR3AudG9TdHJpbmcgPSBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gXCJbb2JqZWN0IEdlbmVyYXRvcl1cIjtcbiAgfTtcblxuICBmdW5jdGlvbiBwdXNoVHJ5RW50cnkobG9jcykge1xuICAgIHZhciBlbnRyeSA9IHsgdHJ5TG9jOiBsb2NzWzBdIH07XG5cbiAgICBpZiAoMSBpbiBsb2NzKSB7XG4gICAgICBlbnRyeS5jYXRjaExvYyA9IGxvY3NbMV07XG4gICAgfVxuXG4gICAgaWYgKDIgaW4gbG9jcykge1xuICAgICAgZW50cnkuZmluYWxseUxvYyA9IGxvY3NbMl07XG4gICAgICBlbnRyeS5hZnRlckxvYyA9IGxvY3NbM107XG4gICAgfVxuXG4gICAgdGhpcy50cnlFbnRyaWVzLnB1c2goZW50cnkpO1xuICB9XG5cbiAgZnVuY3Rpb24gcmVzZXRUcnlFbnRyeShlbnRyeSkge1xuICAgIHZhciByZWNvcmQgPSBlbnRyeS5jb21wbGV0aW9uIHx8IHt9O1xuICAgIHJlY29yZC50eXBlID0gXCJub3JtYWxcIjtcbiAgICBkZWxldGUgcmVjb3JkLmFyZztcbiAgICBlbnRyeS5jb21wbGV0aW9uID0gcmVjb3JkO1xuICB9XG5cbiAgZnVuY3Rpb24gQ29udGV4dCh0cnlMb2NzTGlzdCkge1xuICAgIC8vIFRoZSByb290IGVudHJ5IG9iamVjdCAoZWZmZWN0aXZlbHkgYSB0cnkgc3RhdGVtZW50IHdpdGhvdXQgYSBjYXRjaFxuICAgIC8vIG9yIGEgZmluYWxseSBibG9jaykgZ2l2ZXMgdXMgYSBwbGFjZSB0byBzdG9yZSB2YWx1ZXMgdGhyb3duIGZyb21cbiAgICAvLyBsb2NhdGlvbnMgd2hlcmUgdGhlcmUgaXMgbm8gZW5jbG9zaW5nIHRyeSBzdGF0ZW1lbnQuXG4gICAgdGhpcy50cnlFbnRyaWVzID0gW3sgdHJ5TG9jOiBcInJvb3RcIiB9XTtcbiAgICB0cnlMb2NzTGlzdC5mb3JFYWNoKHB1c2hUcnlFbnRyeSwgdGhpcyk7XG4gICAgdGhpcy5yZXNldCh0cnVlKTtcbiAgfVxuXG4gIHJ1bnRpbWUua2V5cyA9IGZ1bmN0aW9uKG9iamVjdCkge1xuICAgIHZhciBrZXlzID0gW107XG4gICAgZm9yICh2YXIga2V5IGluIG9iamVjdCkge1xuICAgICAga2V5cy5wdXNoKGtleSk7XG4gICAgfVxuICAgIGtleXMucmV2ZXJzZSgpO1xuXG4gICAgLy8gUmF0aGVyIHRoYW4gcmV0dXJuaW5nIGFuIG9iamVjdCB3aXRoIGEgbmV4dCBtZXRob2QsIHdlIGtlZXBcbiAgICAvLyB0aGluZ3Mgc2ltcGxlIGFuZCByZXR1cm4gdGhlIG5leHQgZnVuY3Rpb24gaXRzZWxmLlxuICAgIHJldHVybiBmdW5jdGlvbiBuZXh0KCkge1xuICAgICAgd2hpbGUgKGtleXMubGVuZ3RoKSB7XG4gICAgICAgIHZhciBrZXkgPSBrZXlzLnBvcCgpO1xuICAgICAgICBpZiAoa2V5IGluIG9iamVjdCkge1xuICAgICAgICAgIG5leHQudmFsdWUgPSBrZXk7XG4gICAgICAgICAgbmV4dC5kb25lID0gZmFsc2U7XG4gICAgICAgICAgcmV0dXJuIG5leHQ7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgLy8gVG8gYXZvaWQgY3JlYXRpbmcgYW4gYWRkaXRpb25hbCBvYmplY3QsIHdlIGp1c3QgaGFuZyB0aGUgLnZhbHVlXG4gICAgICAvLyBhbmQgLmRvbmUgcHJvcGVydGllcyBvZmYgdGhlIG5leHQgZnVuY3Rpb24gb2JqZWN0IGl0c2VsZi4gVGhpc1xuICAgICAgLy8gYWxzbyBlbnN1cmVzIHRoYXQgdGhlIG1pbmlmaWVyIHdpbGwgbm90IGFub255bWl6ZSB0aGUgZnVuY3Rpb24uXG4gICAgICBuZXh0LmRvbmUgPSB0cnVlO1xuICAgICAgcmV0dXJuIG5leHQ7XG4gICAgfTtcbiAgfTtcblxuICBmdW5jdGlvbiB2YWx1ZXMoaXRlcmFibGUpIHtcbiAgICBpZiAoaXRlcmFibGUpIHtcbiAgICAgIHZhciBpdGVyYXRvck1ldGhvZCA9IGl0ZXJhYmxlW2l0ZXJhdG9yU3ltYm9sXTtcbiAgICAgIGlmIChpdGVyYXRvck1ldGhvZCkge1xuICAgICAgICByZXR1cm4gaXRlcmF0b3JNZXRob2QuY2FsbChpdGVyYWJsZSk7XG4gICAgICB9XG5cbiAgICAgIGlmICh0eXBlb2YgaXRlcmFibGUubmV4dCA9PT0gXCJmdW5jdGlvblwiKSB7XG4gICAgICAgIHJldHVybiBpdGVyYWJsZTtcbiAgICAgIH1cblxuICAgICAgaWYgKCFpc05hTihpdGVyYWJsZS5sZW5ndGgpKSB7XG4gICAgICAgIHZhciBpID0gLTEsIG5leHQgPSBmdW5jdGlvbiBuZXh0KCkge1xuICAgICAgICAgIHdoaWxlICgrK2kgPCBpdGVyYWJsZS5sZW5ndGgpIHtcbiAgICAgICAgICAgIGlmIChoYXNPd24uY2FsbChpdGVyYWJsZSwgaSkpIHtcbiAgICAgICAgICAgICAgbmV4dC52YWx1ZSA9IGl0ZXJhYmxlW2ldO1xuICAgICAgICAgICAgICBuZXh0LmRvbmUgPSBmYWxzZTtcbiAgICAgICAgICAgICAgcmV0dXJuIG5leHQ7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgbmV4dC52YWx1ZSA9IHVuZGVmaW5lZDtcbiAgICAgICAgICBuZXh0LmRvbmUgPSB0cnVlO1xuXG4gICAgICAgICAgcmV0dXJuIG5leHQ7XG4gICAgICAgIH07XG5cbiAgICAgICAgcmV0dXJuIG5leHQubmV4dCA9IG5leHQ7XG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8gUmV0dXJuIGFuIGl0ZXJhdG9yIHdpdGggbm8gdmFsdWVzLlxuICAgIHJldHVybiB7IG5leHQ6IGRvbmVSZXN1bHQgfTtcbiAgfVxuICBydW50aW1lLnZhbHVlcyA9IHZhbHVlcztcblxuICBmdW5jdGlvbiBkb25lUmVzdWx0KCkge1xuICAgIHJldHVybiB7IHZhbHVlOiB1bmRlZmluZWQsIGRvbmU6IHRydWUgfTtcbiAgfVxuXG4gIENvbnRleHQucHJvdG90eXBlID0ge1xuICAgIGNvbnN0cnVjdG9yOiBDb250ZXh0LFxuXG4gICAgcmVzZXQ6IGZ1bmN0aW9uKHNraXBUZW1wUmVzZXQpIHtcbiAgICAgIHRoaXMucHJldiA9IDA7XG4gICAgICB0aGlzLm5leHQgPSAwO1xuICAgICAgdGhpcy5zZW50ID0gdW5kZWZpbmVkO1xuICAgICAgdGhpcy5kb25lID0gZmFsc2U7XG4gICAgICB0aGlzLmRlbGVnYXRlID0gbnVsbDtcblxuICAgICAgdGhpcy50cnlFbnRyaWVzLmZvckVhY2gocmVzZXRUcnlFbnRyeSk7XG5cbiAgICAgIGlmICghc2tpcFRlbXBSZXNldCkge1xuICAgICAgICBmb3IgKHZhciBuYW1lIGluIHRoaXMpIHtcbiAgICAgICAgICAvLyBOb3Qgc3VyZSBhYm91dCB0aGUgb3B0aW1hbCBvcmRlciBvZiB0aGVzZSBjb25kaXRpb25zOlxuICAgICAgICAgIGlmIChuYW1lLmNoYXJBdCgwKSA9PT0gXCJ0XCIgJiZcbiAgICAgICAgICAgICAgaGFzT3duLmNhbGwodGhpcywgbmFtZSkgJiZcbiAgICAgICAgICAgICAgIWlzTmFOKCtuYW1lLnNsaWNlKDEpKSkge1xuICAgICAgICAgICAgdGhpc1tuYW1lXSA9IHVuZGVmaW5lZDtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9LFxuXG4gICAgc3RvcDogZnVuY3Rpb24oKSB7XG4gICAgICB0aGlzLmRvbmUgPSB0cnVlO1xuXG4gICAgICB2YXIgcm9vdEVudHJ5ID0gdGhpcy50cnlFbnRyaWVzWzBdO1xuICAgICAgdmFyIHJvb3RSZWNvcmQgPSByb290RW50cnkuY29tcGxldGlvbjtcbiAgICAgIGlmIChyb290UmVjb3JkLnR5cGUgPT09IFwidGhyb3dcIikge1xuICAgICAgICB0aHJvdyByb290UmVjb3JkLmFyZztcbiAgICAgIH1cblxuICAgICAgcmV0dXJuIHRoaXMucnZhbDtcbiAgICB9LFxuXG4gICAgZGlzcGF0Y2hFeGNlcHRpb246IGZ1bmN0aW9uKGV4Y2VwdGlvbikge1xuICAgICAgaWYgKHRoaXMuZG9uZSkge1xuICAgICAgICB0aHJvdyBleGNlcHRpb247XG4gICAgICB9XG5cbiAgICAgIHZhciBjb250ZXh0ID0gdGhpcztcbiAgICAgIGZ1bmN0aW9uIGhhbmRsZShsb2MsIGNhdWdodCkge1xuICAgICAgICByZWNvcmQudHlwZSA9IFwidGhyb3dcIjtcbiAgICAgICAgcmVjb3JkLmFyZyA9IGV4Y2VwdGlvbjtcbiAgICAgICAgY29udGV4dC5uZXh0ID0gbG9jO1xuICAgICAgICByZXR1cm4gISFjYXVnaHQ7XG4gICAgICB9XG5cbiAgICAgIGZvciAodmFyIGkgPSB0aGlzLnRyeUVudHJpZXMubGVuZ3RoIC0gMTsgaSA+PSAwOyAtLWkpIHtcbiAgICAgICAgdmFyIGVudHJ5ID0gdGhpcy50cnlFbnRyaWVzW2ldO1xuICAgICAgICB2YXIgcmVjb3JkID0gZW50cnkuY29tcGxldGlvbjtcblxuICAgICAgICBpZiAoZW50cnkudHJ5TG9jID09PSBcInJvb3RcIikge1xuICAgICAgICAgIC8vIEV4Y2VwdGlvbiB0aHJvd24gb3V0c2lkZSBvZiBhbnkgdHJ5IGJsb2NrIHRoYXQgY291bGQgaGFuZGxlXG4gICAgICAgICAgLy8gaXQsIHNvIHNldCB0aGUgY29tcGxldGlvbiB2YWx1ZSBvZiB0aGUgZW50aXJlIGZ1bmN0aW9uIHRvXG4gICAgICAgICAgLy8gdGhyb3cgdGhlIGV4Y2VwdGlvbi5cbiAgICAgICAgICByZXR1cm4gaGFuZGxlKFwiZW5kXCIpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGVudHJ5LnRyeUxvYyA8PSB0aGlzLnByZXYpIHtcbiAgICAgICAgICB2YXIgaGFzQ2F0Y2ggPSBoYXNPd24uY2FsbChlbnRyeSwgXCJjYXRjaExvY1wiKTtcbiAgICAgICAgICB2YXIgaGFzRmluYWxseSA9IGhhc093bi5jYWxsKGVudHJ5LCBcImZpbmFsbHlMb2NcIik7XG5cbiAgICAgICAgICBpZiAoaGFzQ2F0Y2ggJiYgaGFzRmluYWxseSkge1xuICAgICAgICAgICAgaWYgKHRoaXMucHJldiA8IGVudHJ5LmNhdGNoTG9jKSB7XG4gICAgICAgICAgICAgIHJldHVybiBoYW5kbGUoZW50cnkuY2F0Y2hMb2MsIHRydWUpO1xuICAgICAgICAgICAgfSBlbHNlIGlmICh0aGlzLnByZXYgPCBlbnRyeS5maW5hbGx5TG9jKSB7XG4gICAgICAgICAgICAgIHJldHVybiBoYW5kbGUoZW50cnkuZmluYWxseUxvYyk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICB9IGVsc2UgaWYgKGhhc0NhdGNoKSB7XG4gICAgICAgICAgICBpZiAodGhpcy5wcmV2IDwgZW50cnkuY2F0Y2hMb2MpIHtcbiAgICAgICAgICAgICAgcmV0dXJuIGhhbmRsZShlbnRyeS5jYXRjaExvYywgdHJ1ZSk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICB9IGVsc2UgaWYgKGhhc0ZpbmFsbHkpIHtcbiAgICAgICAgICAgIGlmICh0aGlzLnByZXYgPCBlbnRyeS5maW5hbGx5TG9jKSB7XG4gICAgICAgICAgICAgIHJldHVybiBoYW5kbGUoZW50cnkuZmluYWxseUxvYyk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwidHJ5IHN0YXRlbWVudCB3aXRob3V0IGNhdGNoIG9yIGZpbmFsbHlcIik7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfSxcblxuICAgIGFicnVwdDogZnVuY3Rpb24odHlwZSwgYXJnKSB7XG4gICAgICBmb3IgKHZhciBpID0gdGhpcy50cnlFbnRyaWVzLmxlbmd0aCAtIDE7IGkgPj0gMDsgLS1pKSB7XG4gICAgICAgIHZhciBlbnRyeSA9IHRoaXMudHJ5RW50cmllc1tpXTtcbiAgICAgICAgaWYgKGVudHJ5LnRyeUxvYyA8PSB0aGlzLnByZXYgJiZcbiAgICAgICAgICAgIGhhc093bi5jYWxsKGVudHJ5LCBcImZpbmFsbHlMb2NcIikgJiZcbiAgICAgICAgICAgIHRoaXMucHJldiA8IGVudHJ5LmZpbmFsbHlMb2MpIHtcbiAgICAgICAgICB2YXIgZmluYWxseUVudHJ5ID0gZW50cnk7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgaWYgKGZpbmFsbHlFbnRyeSAmJlxuICAgICAgICAgICh0eXBlID09PSBcImJyZWFrXCIgfHxcbiAgICAgICAgICAgdHlwZSA9PT0gXCJjb250aW51ZVwiKSAmJlxuICAgICAgICAgIGZpbmFsbHlFbnRyeS50cnlMb2MgPD0gYXJnICYmXG4gICAgICAgICAgYXJnIDw9IGZpbmFsbHlFbnRyeS5maW5hbGx5TG9jKSB7XG4gICAgICAgIC8vIElnbm9yZSB0aGUgZmluYWxseSBlbnRyeSBpZiBjb250cm9sIGlzIG5vdCBqdW1waW5nIHRvIGFcbiAgICAgICAgLy8gbG9jYXRpb24gb3V0c2lkZSB0aGUgdHJ5L2NhdGNoIGJsb2NrLlxuICAgICAgICBmaW5hbGx5RW50cnkgPSBudWxsO1xuICAgICAgfVxuXG4gICAgICB2YXIgcmVjb3JkID0gZmluYWxseUVudHJ5ID8gZmluYWxseUVudHJ5LmNvbXBsZXRpb24gOiB7fTtcbiAgICAgIHJlY29yZC50eXBlID0gdHlwZTtcbiAgICAgIHJlY29yZC5hcmcgPSBhcmc7XG5cbiAgICAgIGlmIChmaW5hbGx5RW50cnkpIHtcbiAgICAgICAgdGhpcy5uZXh0ID0gZmluYWxseUVudHJ5LmZpbmFsbHlMb2M7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aGlzLmNvbXBsZXRlKHJlY29yZCk7XG4gICAgICB9XG5cbiAgICAgIHJldHVybiBDb250aW51ZVNlbnRpbmVsO1xuICAgIH0sXG5cbiAgICBjb21wbGV0ZTogZnVuY3Rpb24ocmVjb3JkLCBhZnRlckxvYykge1xuICAgICAgaWYgKHJlY29yZC50eXBlID09PSBcInRocm93XCIpIHtcbiAgICAgICAgdGhyb3cgcmVjb3JkLmFyZztcbiAgICAgIH1cblxuICAgICAgaWYgKHJlY29yZC50eXBlID09PSBcImJyZWFrXCIgfHxcbiAgICAgICAgICByZWNvcmQudHlwZSA9PT0gXCJjb250aW51ZVwiKSB7XG4gICAgICAgIHRoaXMubmV4dCA9IHJlY29yZC5hcmc7XG4gICAgICB9IGVsc2UgaWYgKHJlY29yZC50eXBlID09PSBcInJldHVyblwiKSB7XG4gICAgICAgIHRoaXMucnZhbCA9IHJlY29yZC5hcmc7XG4gICAgICAgIHRoaXMubmV4dCA9IFwiZW5kXCI7XG4gICAgICB9IGVsc2UgaWYgKHJlY29yZC50eXBlID09PSBcIm5vcm1hbFwiICYmIGFmdGVyTG9jKSB7XG4gICAgICAgIHRoaXMubmV4dCA9IGFmdGVyTG9jO1xuICAgICAgfVxuICAgIH0sXG5cbiAgICBmaW5pc2g6IGZ1bmN0aW9uKGZpbmFsbHlMb2MpIHtcbiAgICAgIGZvciAodmFyIGkgPSB0aGlzLnRyeUVudHJpZXMubGVuZ3RoIC0gMTsgaSA+PSAwOyAtLWkpIHtcbiAgICAgICAgdmFyIGVudHJ5ID0gdGhpcy50cnlFbnRyaWVzW2ldO1xuICAgICAgICBpZiAoZW50cnkuZmluYWxseUxvYyA9PT0gZmluYWxseUxvYykge1xuICAgICAgICAgIHRoaXMuY29tcGxldGUoZW50cnkuY29tcGxldGlvbiwgZW50cnkuYWZ0ZXJMb2MpO1xuICAgICAgICAgIHJlc2V0VHJ5RW50cnkoZW50cnkpO1xuICAgICAgICAgIHJldHVybiBDb250aW51ZVNlbnRpbmVsO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfSxcblxuICAgIFwiY2F0Y2hcIjogZnVuY3Rpb24odHJ5TG9jKSB7XG4gICAgICBmb3IgKHZhciBpID0gdGhpcy50cnlFbnRyaWVzLmxlbmd0aCAtIDE7IGkgPj0gMDsgLS1pKSB7XG4gICAgICAgIHZhciBlbnRyeSA9IHRoaXMudHJ5RW50cmllc1tpXTtcbiAgICAgICAgaWYgKGVudHJ5LnRyeUxvYyA9PT0gdHJ5TG9jKSB7XG4gICAgICAgICAgdmFyIHJlY29yZCA9IGVudHJ5LmNvbXBsZXRpb247XG4gICAgICAgICAgaWYgKHJlY29yZC50eXBlID09PSBcInRocm93XCIpIHtcbiAgICAgICAgICAgIHZhciB0aHJvd24gPSByZWNvcmQuYXJnO1xuICAgICAgICAgICAgcmVzZXRUcnlFbnRyeShlbnRyeSk7XG4gICAgICAgICAgfVxuICAgICAgICAgIHJldHVybiB0aHJvd247XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgLy8gVGhlIGNvbnRleHQuY2F0Y2ggbWV0aG9kIG11c3Qgb25seSBiZSBjYWxsZWQgd2l0aCBhIGxvY2F0aW9uXG4gICAgICAvLyBhcmd1bWVudCB0aGF0IGNvcnJlc3BvbmRzIHRvIGEga25vd24gY2F0Y2ggYmxvY2suXG4gICAgICB0aHJvdyBuZXcgRXJyb3IoXCJpbGxlZ2FsIGNhdGNoIGF0dGVtcHRcIik7XG4gICAgfSxcblxuICAgIGRlbGVnYXRlWWllbGQ6IGZ1bmN0aW9uKGl0ZXJhYmxlLCByZXN1bHROYW1lLCBuZXh0TG9jKSB7XG4gICAgICB0aGlzLmRlbGVnYXRlID0ge1xuICAgICAgICBpdGVyYXRvcjogdmFsdWVzKGl0ZXJhYmxlKSxcbiAgICAgICAgcmVzdWx0TmFtZTogcmVzdWx0TmFtZSxcbiAgICAgICAgbmV4dExvYzogbmV4dExvY1xuICAgICAgfTtcblxuICAgICAgcmV0dXJuIENvbnRpbnVlU2VudGluZWw7XG4gICAgfVxuICB9O1xufSkoXG4gIC8vIEFtb25nIHRoZSB2YXJpb3VzIHRyaWNrcyBmb3Igb2J0YWluaW5nIGEgcmVmZXJlbmNlIHRvIHRoZSBnbG9iYWxcbiAgLy8gb2JqZWN0LCB0aGlzIHNlZW1zIHRvIGJlIHRoZSBtb3N0IHJlbGlhYmxlIHRlY2huaXF1ZSB0aGF0IGRvZXMgbm90XG4gIC8vIHVzZSBpbmRpcmVjdCBldmFsICh3aGljaCB2aW9sYXRlcyBDb250ZW50IFNlY3VyaXR5IFBvbGljeSkuXG4gIHR5cGVvZiBnbG9iYWwgPT09IFwib2JqZWN0XCIgPyBnbG9iYWwgOlxuICB0eXBlb2Ygd2luZG93ID09PSBcIm9iamVjdFwiID8gd2luZG93IDpcbiAgdHlwZW9mIHNlbGYgPT09IFwib2JqZWN0XCIgPyBzZWxmIDogdGhpc1xuKTtcbiIsIi8vIFRoaXMgZmlsZSBjYW4gYmUgcmVxdWlyZWQgaW4gQnJvd3NlcmlmeSBhbmQgTm9kZS5qcyBmb3IgYXV0b21hdGljIHBvbHlmaWxsXG4vLyBUbyB1c2UgaXQ6ICByZXF1aXJlKCdlczYtcHJvbWlzZS9hdXRvJyk7XG4ndXNlIHN0cmljdCc7XG5tb2R1bGUuZXhwb3J0cyA9IHJlcXVpcmUoJy4vJykucG9seWZpbGwoKTtcbiIsIi8qIVxuICogQG92ZXJ2aWV3IGVzNi1wcm9taXNlIC0gYSB0aW55IGltcGxlbWVudGF0aW9uIG9mIFByb21pc2VzL0ErLlxuICogQGNvcHlyaWdodCBDb3B5cmlnaHQgKGMpIDIwMTQgWWVodWRhIEthdHosIFRvbSBEYWxlLCBTdGVmYW4gUGVubmVyIGFuZCBjb250cmlidXRvcnMgKENvbnZlcnNpb24gdG8gRVM2IEFQSSBieSBKYWtlIEFyY2hpYmFsZClcbiAqIEBsaWNlbnNlICAgTGljZW5zZWQgdW5kZXIgTUlUIGxpY2Vuc2VcbiAqICAgICAgICAgICAgU2VlIGh0dHBzOi8vcmF3LmdpdGh1YnVzZXJjb250ZW50LmNvbS9zdGVmYW5wZW5uZXIvZXM2LXByb21pc2UvbWFzdGVyL0xJQ0VOU0VcbiAqIEB2ZXJzaW9uICAgNC4xLjFcbiAqL1xuXG4oZnVuY3Rpb24gKGdsb2JhbCwgZmFjdG9yeSkge1xuXHR0eXBlb2YgZXhwb3J0cyA9PT0gJ29iamVjdCcgJiYgdHlwZW9mIG1vZHVsZSAhPT0gJ3VuZGVmaW5lZCcgPyBtb2R1bGUuZXhwb3J0cyA9IGZhY3RvcnkoKSA6XG5cdHR5cGVvZiBkZWZpbmUgPT09ICdmdW5jdGlvbicgJiYgZGVmaW5lLmFtZCA/IGRlZmluZShmYWN0b3J5KSA6XG5cdChnbG9iYWwuRVM2UHJvbWlzZSA9IGZhY3RvcnkoKSk7XG59KHRoaXMsIChmdW5jdGlvbiAoKSB7ICd1c2Ugc3RyaWN0JztcblxuZnVuY3Rpb24gb2JqZWN0T3JGdW5jdGlvbih4KSB7XG4gIHZhciB0eXBlID0gdHlwZW9mIHg7XG4gIHJldHVybiB4ICE9PSBudWxsICYmICh0eXBlID09PSAnb2JqZWN0JyB8fCB0eXBlID09PSAnZnVuY3Rpb24nKTtcbn1cblxuZnVuY3Rpb24gaXNGdW5jdGlvbih4KSB7XG4gIHJldHVybiB0eXBlb2YgeCA9PT0gJ2Z1bmN0aW9uJztcbn1cblxudmFyIF9pc0FycmF5ID0gdW5kZWZpbmVkO1xuaWYgKEFycmF5LmlzQXJyYXkpIHtcbiAgX2lzQXJyYXkgPSBBcnJheS5pc0FycmF5O1xufSBlbHNlIHtcbiAgX2lzQXJyYXkgPSBmdW5jdGlvbiAoeCkge1xuICAgIHJldHVybiBPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nLmNhbGwoeCkgPT09ICdbb2JqZWN0IEFycmF5XSc7XG4gIH07XG59XG5cbnZhciBpc0FycmF5ID0gX2lzQXJyYXk7XG5cbnZhciBsZW4gPSAwO1xudmFyIHZlcnR4TmV4dCA9IHVuZGVmaW5lZDtcbnZhciBjdXN0b21TY2hlZHVsZXJGbiA9IHVuZGVmaW5lZDtcblxudmFyIGFzYXAgPSBmdW5jdGlvbiBhc2FwKGNhbGxiYWNrLCBhcmcpIHtcbiAgcXVldWVbbGVuXSA9IGNhbGxiYWNrO1xuICBxdWV1ZVtsZW4gKyAxXSA9IGFyZztcbiAgbGVuICs9IDI7XG4gIGlmIChsZW4gPT09IDIpIHtcbiAgICAvLyBJZiBsZW4gaXMgMiwgdGhhdCBtZWFucyB0aGF0IHdlIG5lZWQgdG8gc2NoZWR1bGUgYW4gYXN5bmMgZmx1c2guXG4gICAgLy8gSWYgYWRkaXRpb25hbCBjYWxsYmFja3MgYXJlIHF1ZXVlZCBiZWZvcmUgdGhlIHF1ZXVlIGlzIGZsdXNoZWQsIHRoZXlcbiAgICAvLyB3aWxsIGJlIHByb2Nlc3NlZCBieSB0aGlzIGZsdXNoIHRoYXQgd2UgYXJlIHNjaGVkdWxpbmcuXG4gICAgaWYgKGN1c3RvbVNjaGVkdWxlckZuKSB7XG4gICAgICBjdXN0b21TY2hlZHVsZXJGbihmbHVzaCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHNjaGVkdWxlRmx1c2goKTtcbiAgICB9XG4gIH1cbn07XG5cbmZ1bmN0aW9uIHNldFNjaGVkdWxlcihzY2hlZHVsZUZuKSB7XG4gIGN1c3RvbVNjaGVkdWxlckZuID0gc2NoZWR1bGVGbjtcbn1cblxuZnVuY3Rpb24gc2V0QXNhcChhc2FwRm4pIHtcbiAgYXNhcCA9IGFzYXBGbjtcbn1cblxudmFyIGJyb3dzZXJXaW5kb3cgPSB0eXBlb2Ygd2luZG93ICE9PSAndW5kZWZpbmVkJyA/IHdpbmRvdyA6IHVuZGVmaW5lZDtcbnZhciBicm93c2VyR2xvYmFsID0gYnJvd3NlcldpbmRvdyB8fCB7fTtcbnZhciBCcm93c2VyTXV0YXRpb25PYnNlcnZlciA9IGJyb3dzZXJHbG9iYWwuTXV0YXRpb25PYnNlcnZlciB8fCBicm93c2VyR2xvYmFsLldlYktpdE11dGF0aW9uT2JzZXJ2ZXI7XG52YXIgaXNOb2RlID0gdHlwZW9mIHNlbGYgPT09ICd1bmRlZmluZWQnICYmIHR5cGVvZiBwcm9jZXNzICE9PSAndW5kZWZpbmVkJyAmJiAoe30pLnRvU3RyaW5nLmNhbGwocHJvY2VzcykgPT09ICdbb2JqZWN0IHByb2Nlc3NdJztcblxuLy8gdGVzdCBmb3Igd2ViIHdvcmtlciBidXQgbm90IGluIElFMTBcbnZhciBpc1dvcmtlciA9IHR5cGVvZiBVaW50OENsYW1wZWRBcnJheSAhPT0gJ3VuZGVmaW5lZCcgJiYgdHlwZW9mIGltcG9ydFNjcmlwdHMgIT09ICd1bmRlZmluZWQnICYmIHR5cGVvZiBNZXNzYWdlQ2hhbm5lbCAhPT0gJ3VuZGVmaW5lZCc7XG5cbi8vIG5vZGVcbmZ1bmN0aW9uIHVzZU5leHRUaWNrKCkge1xuICAvLyBub2RlIHZlcnNpb24gMC4xMC54IGRpc3BsYXlzIGEgZGVwcmVjYXRpb24gd2FybmluZyB3aGVuIG5leHRUaWNrIGlzIHVzZWQgcmVjdXJzaXZlbHlcbiAgLy8gc2VlIGh0dHBzOi8vZ2l0aHViLmNvbS9jdWpvanMvd2hlbi9pc3N1ZXMvNDEwIGZvciBkZXRhaWxzXG4gIHJldHVybiBmdW5jdGlvbiAoKSB7XG4gICAgcmV0dXJuIHByb2Nlc3MubmV4dFRpY2soZmx1c2gpO1xuICB9O1xufVxuXG4vLyB2ZXJ0eFxuZnVuY3Rpb24gdXNlVmVydHhUaW1lcigpIHtcbiAgaWYgKHR5cGVvZiB2ZXJ0eE5leHQgIT09ICd1bmRlZmluZWQnKSB7XG4gICAgcmV0dXJuIGZ1bmN0aW9uICgpIHtcbiAgICAgIHZlcnR4TmV4dChmbHVzaCk7XG4gICAgfTtcbiAgfVxuXG4gIHJldHVybiB1c2VTZXRUaW1lb3V0KCk7XG59XG5cbmZ1bmN0aW9uIHVzZU11dGF0aW9uT2JzZXJ2ZXIoKSB7XG4gIHZhciBpdGVyYXRpb25zID0gMDtcbiAgdmFyIG9ic2VydmVyID0gbmV3IEJyb3dzZXJNdXRhdGlvbk9ic2VydmVyKGZsdXNoKTtcbiAgdmFyIG5vZGUgPSBkb2N1bWVudC5jcmVhdGVUZXh0Tm9kZSgnJyk7XG4gIG9ic2VydmVyLm9ic2VydmUobm9kZSwgeyBjaGFyYWN0ZXJEYXRhOiB0cnVlIH0pO1xuXG4gIHJldHVybiBmdW5jdGlvbiAoKSB7XG4gICAgbm9kZS5kYXRhID0gaXRlcmF0aW9ucyA9ICsraXRlcmF0aW9ucyAlIDI7XG4gIH07XG59XG5cbi8vIHdlYiB3b3JrZXJcbmZ1bmN0aW9uIHVzZU1lc3NhZ2VDaGFubmVsKCkge1xuICB2YXIgY2hhbm5lbCA9IG5ldyBNZXNzYWdlQ2hhbm5lbCgpO1xuICBjaGFubmVsLnBvcnQxLm9ubWVzc2FnZSA9IGZsdXNoO1xuICByZXR1cm4gZnVuY3Rpb24gKCkge1xuICAgIHJldHVybiBjaGFubmVsLnBvcnQyLnBvc3RNZXNzYWdlKDApO1xuICB9O1xufVxuXG5mdW5jdGlvbiB1c2VTZXRUaW1lb3V0KCkge1xuICAvLyBTdG9yZSBzZXRUaW1lb3V0IHJlZmVyZW5jZSBzbyBlczYtcHJvbWlzZSB3aWxsIGJlIHVuYWZmZWN0ZWQgYnlcbiAgLy8gb3RoZXIgY29kZSBtb2RpZnlpbmcgc2V0VGltZW91dCAobGlrZSBzaW5vbi51c2VGYWtlVGltZXJzKCkpXG4gIHZhciBnbG9iYWxTZXRUaW1lb3V0ID0gc2V0VGltZW91dDtcbiAgcmV0dXJuIGZ1bmN0aW9uICgpIHtcbiAgICByZXR1cm4gZ2xvYmFsU2V0VGltZW91dChmbHVzaCwgMSk7XG4gIH07XG59XG5cbnZhciBxdWV1ZSA9IG5ldyBBcnJheSgxMDAwKTtcbmZ1bmN0aW9uIGZsdXNoKCkge1xuICBmb3IgKHZhciBpID0gMDsgaSA8IGxlbjsgaSArPSAyKSB7XG4gICAgdmFyIGNhbGxiYWNrID0gcXVldWVbaV07XG4gICAgdmFyIGFyZyA9IHF1ZXVlW2kgKyAxXTtcblxuICAgIGNhbGxiYWNrKGFyZyk7XG5cbiAgICBxdWV1ZVtpXSA9IHVuZGVmaW5lZDtcbiAgICBxdWV1ZVtpICsgMV0gPSB1bmRlZmluZWQ7XG4gIH1cblxuICBsZW4gPSAwO1xufVxuXG5mdW5jdGlvbiBhdHRlbXB0VmVydHgoKSB7XG4gIHRyeSB7XG4gICAgdmFyIHIgPSByZXF1aXJlO1xuICAgIHZhciB2ZXJ0eCA9IHIoJ3ZlcnR4Jyk7XG4gICAgdmVydHhOZXh0ID0gdmVydHgucnVuT25Mb29wIHx8IHZlcnR4LnJ1bk9uQ29udGV4dDtcbiAgICByZXR1cm4gdXNlVmVydHhUaW1lcigpO1xuICB9IGNhdGNoIChlKSB7XG4gICAgcmV0dXJuIHVzZVNldFRpbWVvdXQoKTtcbiAgfVxufVxuXG52YXIgc2NoZWR1bGVGbHVzaCA9IHVuZGVmaW5lZDtcbi8vIERlY2lkZSB3aGF0IGFzeW5jIG1ldGhvZCB0byB1c2UgdG8gdHJpZ2dlcmluZyBwcm9jZXNzaW5nIG9mIHF1ZXVlZCBjYWxsYmFja3M6XG5pZiAoaXNOb2RlKSB7XG4gIHNjaGVkdWxlRmx1c2ggPSB1c2VOZXh0VGljaygpO1xufSBlbHNlIGlmIChCcm93c2VyTXV0YXRpb25PYnNlcnZlcikge1xuICBzY2hlZHVsZUZsdXNoID0gdXNlTXV0YXRpb25PYnNlcnZlcigpO1xufSBlbHNlIGlmIChpc1dvcmtlcikge1xuICBzY2hlZHVsZUZsdXNoID0gdXNlTWVzc2FnZUNoYW5uZWwoKTtcbn0gZWxzZSBpZiAoYnJvd3NlcldpbmRvdyA9PT0gdW5kZWZpbmVkICYmIHR5cGVvZiByZXF1aXJlID09PSAnZnVuY3Rpb24nKSB7XG4gIHNjaGVkdWxlRmx1c2ggPSBhdHRlbXB0VmVydHgoKTtcbn0gZWxzZSB7XG4gIHNjaGVkdWxlRmx1c2ggPSB1c2VTZXRUaW1lb3V0KCk7XG59XG5cbmZ1bmN0aW9uIHRoZW4ob25GdWxmaWxsbWVudCwgb25SZWplY3Rpb24pIHtcbiAgdmFyIF9hcmd1bWVudHMgPSBhcmd1bWVudHM7XG5cbiAgdmFyIHBhcmVudCA9IHRoaXM7XG5cbiAgdmFyIGNoaWxkID0gbmV3IHRoaXMuY29uc3RydWN0b3Iobm9vcCk7XG5cbiAgaWYgKGNoaWxkW1BST01JU0VfSURdID09PSB1bmRlZmluZWQpIHtcbiAgICBtYWtlUHJvbWlzZShjaGlsZCk7XG4gIH1cblxuICB2YXIgX3N0YXRlID0gcGFyZW50Ll9zdGF0ZTtcblxuICBpZiAoX3N0YXRlKSB7XG4gICAgKGZ1bmN0aW9uICgpIHtcbiAgICAgIHZhciBjYWxsYmFjayA9IF9hcmd1bWVudHNbX3N0YXRlIC0gMV07XG4gICAgICBhc2FwKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgcmV0dXJuIGludm9rZUNhbGxiYWNrKF9zdGF0ZSwgY2hpbGQsIGNhbGxiYWNrLCBwYXJlbnQuX3Jlc3VsdCk7XG4gICAgICB9KTtcbiAgICB9KSgpO1xuICB9IGVsc2Uge1xuICAgIHN1YnNjcmliZShwYXJlbnQsIGNoaWxkLCBvbkZ1bGZpbGxtZW50LCBvblJlamVjdGlvbik7XG4gIH1cblxuICByZXR1cm4gY2hpbGQ7XG59XG5cbi8qKlxuICBgUHJvbWlzZS5yZXNvbHZlYCByZXR1cm5zIGEgcHJvbWlzZSB0aGF0IHdpbGwgYmVjb21lIHJlc29sdmVkIHdpdGggdGhlXG4gIHBhc3NlZCBgdmFsdWVgLiBJdCBpcyBzaG9ydGhhbmQgZm9yIHRoZSBmb2xsb3dpbmc6XG5cbiAgYGBgamF2YXNjcmlwdFxuICBsZXQgcHJvbWlzZSA9IG5ldyBQcm9taXNlKGZ1bmN0aW9uKHJlc29sdmUsIHJlamVjdCl7XG4gICAgcmVzb2x2ZSgxKTtcbiAgfSk7XG5cbiAgcHJvbWlzZS50aGVuKGZ1bmN0aW9uKHZhbHVlKXtcbiAgICAvLyB2YWx1ZSA9PT0gMVxuICB9KTtcbiAgYGBgXG5cbiAgSW5zdGVhZCBvZiB3cml0aW5nIHRoZSBhYm92ZSwgeW91ciBjb2RlIG5vdyBzaW1wbHkgYmVjb21lcyB0aGUgZm9sbG93aW5nOlxuXG4gIGBgYGphdmFzY3JpcHRcbiAgbGV0IHByb21pc2UgPSBQcm9taXNlLnJlc29sdmUoMSk7XG5cbiAgcHJvbWlzZS50aGVuKGZ1bmN0aW9uKHZhbHVlKXtcbiAgICAvLyB2YWx1ZSA9PT0gMVxuICB9KTtcbiAgYGBgXG5cbiAgQG1ldGhvZCByZXNvbHZlXG4gIEBzdGF0aWNcbiAgQHBhcmFtIHtBbnl9IHZhbHVlIHZhbHVlIHRoYXQgdGhlIHJldHVybmVkIHByb21pc2Ugd2lsbCBiZSByZXNvbHZlZCB3aXRoXG4gIFVzZWZ1bCBmb3IgdG9vbGluZy5cbiAgQHJldHVybiB7UHJvbWlzZX0gYSBwcm9taXNlIHRoYXQgd2lsbCBiZWNvbWUgZnVsZmlsbGVkIHdpdGggdGhlIGdpdmVuXG4gIGB2YWx1ZWBcbiovXG5mdW5jdGlvbiByZXNvbHZlJDEob2JqZWN0KSB7XG4gIC8qanNoaW50IHZhbGlkdGhpczp0cnVlICovXG4gIHZhciBDb25zdHJ1Y3RvciA9IHRoaXM7XG5cbiAgaWYgKG9iamVjdCAmJiB0eXBlb2Ygb2JqZWN0ID09PSAnb2JqZWN0JyAmJiBvYmplY3QuY29uc3RydWN0b3IgPT09IENvbnN0cnVjdG9yKSB7XG4gICAgcmV0dXJuIG9iamVjdDtcbiAgfVxuXG4gIHZhciBwcm9taXNlID0gbmV3IENvbnN0cnVjdG9yKG5vb3ApO1xuICByZXNvbHZlKHByb21pc2UsIG9iamVjdCk7XG4gIHJldHVybiBwcm9taXNlO1xufVxuXG52YXIgUFJPTUlTRV9JRCA9IE1hdGgucmFuZG9tKCkudG9TdHJpbmcoMzYpLnN1YnN0cmluZygxNik7XG5cbmZ1bmN0aW9uIG5vb3AoKSB7fVxuXG52YXIgUEVORElORyA9IHZvaWQgMDtcbnZhciBGVUxGSUxMRUQgPSAxO1xudmFyIFJFSkVDVEVEID0gMjtcblxudmFyIEdFVF9USEVOX0VSUk9SID0gbmV3IEVycm9yT2JqZWN0KCk7XG5cbmZ1bmN0aW9uIHNlbGZGdWxmaWxsbWVudCgpIHtcbiAgcmV0dXJuIG5ldyBUeXBlRXJyb3IoXCJZb3UgY2Fubm90IHJlc29sdmUgYSBwcm9taXNlIHdpdGggaXRzZWxmXCIpO1xufVxuXG5mdW5jdGlvbiBjYW5ub3RSZXR1cm5Pd24oKSB7XG4gIHJldHVybiBuZXcgVHlwZUVycm9yKCdBIHByb21pc2VzIGNhbGxiYWNrIGNhbm5vdCByZXR1cm4gdGhhdCBzYW1lIHByb21pc2UuJyk7XG59XG5cbmZ1bmN0aW9uIGdldFRoZW4ocHJvbWlzZSkge1xuICB0cnkge1xuICAgIHJldHVybiBwcm9taXNlLnRoZW47XG4gIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgR0VUX1RIRU5fRVJST1IuZXJyb3IgPSBlcnJvcjtcbiAgICByZXR1cm4gR0VUX1RIRU5fRVJST1I7XG4gIH1cbn1cblxuZnVuY3Rpb24gdHJ5VGhlbih0aGVuJCQxLCB2YWx1ZSwgZnVsZmlsbG1lbnRIYW5kbGVyLCByZWplY3Rpb25IYW5kbGVyKSB7XG4gIHRyeSB7XG4gICAgdGhlbiQkMS5jYWxsKHZhbHVlLCBmdWxmaWxsbWVudEhhbmRsZXIsIHJlamVjdGlvbkhhbmRsZXIpO1xuICB9IGNhdGNoIChlKSB7XG4gICAgcmV0dXJuIGU7XG4gIH1cbn1cblxuZnVuY3Rpb24gaGFuZGxlRm9yZWlnblRoZW5hYmxlKHByb21pc2UsIHRoZW5hYmxlLCB0aGVuJCQxKSB7XG4gIGFzYXAoZnVuY3Rpb24gKHByb21pc2UpIHtcbiAgICB2YXIgc2VhbGVkID0gZmFsc2U7XG4gICAgdmFyIGVycm9yID0gdHJ5VGhlbih0aGVuJCQxLCB0aGVuYWJsZSwgZnVuY3Rpb24gKHZhbHVlKSB7XG4gICAgICBpZiAoc2VhbGVkKSB7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICAgIHNlYWxlZCA9IHRydWU7XG4gICAgICBpZiAodGhlbmFibGUgIT09IHZhbHVlKSB7XG4gICAgICAgIHJlc29sdmUocHJvbWlzZSwgdmFsdWUpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgZnVsZmlsbChwcm9taXNlLCB2YWx1ZSk7XG4gICAgICB9XG4gICAgfSwgZnVuY3Rpb24gKHJlYXNvbikge1xuICAgICAgaWYgKHNlYWxlZCkge1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICBzZWFsZWQgPSB0cnVlO1xuXG4gICAgICByZWplY3QocHJvbWlzZSwgcmVhc29uKTtcbiAgICB9LCAnU2V0dGxlOiAnICsgKHByb21pc2UuX2xhYmVsIHx8ICcgdW5rbm93biBwcm9taXNlJykpO1xuXG4gICAgaWYgKCFzZWFsZWQgJiYgZXJyb3IpIHtcbiAgICAgIHNlYWxlZCA9IHRydWU7XG4gICAgICByZWplY3QocHJvbWlzZSwgZXJyb3IpO1xuICAgIH1cbiAgfSwgcHJvbWlzZSk7XG59XG5cbmZ1bmN0aW9uIGhhbmRsZU93blRoZW5hYmxlKHByb21pc2UsIHRoZW5hYmxlKSB7XG4gIGlmICh0aGVuYWJsZS5fc3RhdGUgPT09IEZVTEZJTExFRCkge1xuICAgIGZ1bGZpbGwocHJvbWlzZSwgdGhlbmFibGUuX3Jlc3VsdCk7XG4gIH0gZWxzZSBpZiAodGhlbmFibGUuX3N0YXRlID09PSBSRUpFQ1RFRCkge1xuICAgIHJlamVjdChwcm9taXNlLCB0aGVuYWJsZS5fcmVzdWx0KTtcbiAgfSBlbHNlIHtcbiAgICBzdWJzY3JpYmUodGhlbmFibGUsIHVuZGVmaW5lZCwgZnVuY3Rpb24gKHZhbHVlKSB7XG4gICAgICByZXR1cm4gcmVzb2x2ZShwcm9taXNlLCB2YWx1ZSk7XG4gICAgfSwgZnVuY3Rpb24gKHJlYXNvbikge1xuICAgICAgcmV0dXJuIHJlamVjdChwcm9taXNlLCByZWFzb24pO1xuICAgIH0pO1xuICB9XG59XG5cbmZ1bmN0aW9uIGhhbmRsZU1heWJlVGhlbmFibGUocHJvbWlzZSwgbWF5YmVUaGVuYWJsZSwgdGhlbiQkMSkge1xuICBpZiAobWF5YmVUaGVuYWJsZS5jb25zdHJ1Y3RvciA9PT0gcHJvbWlzZS5jb25zdHJ1Y3RvciAmJiB0aGVuJCQxID09PSB0aGVuICYmIG1heWJlVGhlbmFibGUuY29uc3RydWN0b3IucmVzb2x2ZSA9PT0gcmVzb2x2ZSQxKSB7XG4gICAgaGFuZGxlT3duVGhlbmFibGUocHJvbWlzZSwgbWF5YmVUaGVuYWJsZSk7XG4gIH0gZWxzZSB7XG4gICAgaWYgKHRoZW4kJDEgPT09IEdFVF9USEVOX0VSUk9SKSB7XG4gICAgICByZWplY3QocHJvbWlzZSwgR0VUX1RIRU5fRVJST1IuZXJyb3IpO1xuICAgICAgR0VUX1RIRU5fRVJST1IuZXJyb3IgPSBudWxsO1xuICAgIH0gZWxzZSBpZiAodGhlbiQkMSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICBmdWxmaWxsKHByb21pc2UsIG1heWJlVGhlbmFibGUpO1xuICAgIH0gZWxzZSBpZiAoaXNGdW5jdGlvbih0aGVuJCQxKSkge1xuICAgICAgaGFuZGxlRm9yZWlnblRoZW5hYmxlKHByb21pc2UsIG1heWJlVGhlbmFibGUsIHRoZW4kJDEpO1xuICAgIH0gZWxzZSB7XG4gICAgICBmdWxmaWxsKHByb21pc2UsIG1heWJlVGhlbmFibGUpO1xuICAgIH1cbiAgfVxufVxuXG5mdW5jdGlvbiByZXNvbHZlKHByb21pc2UsIHZhbHVlKSB7XG4gIGlmIChwcm9taXNlID09PSB2YWx1ZSkge1xuICAgIHJlamVjdChwcm9taXNlLCBzZWxmRnVsZmlsbG1lbnQoKSk7XG4gIH0gZWxzZSBpZiAob2JqZWN0T3JGdW5jdGlvbih2YWx1ZSkpIHtcbiAgICBoYW5kbGVNYXliZVRoZW5hYmxlKHByb21pc2UsIHZhbHVlLCBnZXRUaGVuKHZhbHVlKSk7XG4gIH0gZWxzZSB7XG4gICAgZnVsZmlsbChwcm9taXNlLCB2YWx1ZSk7XG4gIH1cbn1cblxuZnVuY3Rpb24gcHVibGlzaFJlamVjdGlvbihwcm9taXNlKSB7XG4gIGlmIChwcm9taXNlLl9vbmVycm9yKSB7XG4gICAgcHJvbWlzZS5fb25lcnJvcihwcm9taXNlLl9yZXN1bHQpO1xuICB9XG5cbiAgcHVibGlzaChwcm9taXNlKTtcbn1cblxuZnVuY3Rpb24gZnVsZmlsbChwcm9taXNlLCB2YWx1ZSkge1xuICBpZiAocHJvbWlzZS5fc3RhdGUgIT09IFBFTkRJTkcpIHtcbiAgICByZXR1cm47XG4gIH1cblxuICBwcm9taXNlLl9yZXN1bHQgPSB2YWx1ZTtcbiAgcHJvbWlzZS5fc3RhdGUgPSBGVUxGSUxMRUQ7XG5cbiAgaWYgKHByb21pc2UuX3N1YnNjcmliZXJzLmxlbmd0aCAhPT0gMCkge1xuICAgIGFzYXAocHVibGlzaCwgcHJvbWlzZSk7XG4gIH1cbn1cblxuZnVuY3Rpb24gcmVqZWN0KHByb21pc2UsIHJlYXNvbikge1xuICBpZiAocHJvbWlzZS5fc3RhdGUgIT09IFBFTkRJTkcpIHtcbiAgICByZXR1cm47XG4gIH1cbiAgcHJvbWlzZS5fc3RhdGUgPSBSRUpFQ1RFRDtcbiAgcHJvbWlzZS5fcmVzdWx0ID0gcmVhc29uO1xuXG4gIGFzYXAocHVibGlzaFJlamVjdGlvbiwgcHJvbWlzZSk7XG59XG5cbmZ1bmN0aW9uIHN1YnNjcmliZShwYXJlbnQsIGNoaWxkLCBvbkZ1bGZpbGxtZW50LCBvblJlamVjdGlvbikge1xuICB2YXIgX3N1YnNjcmliZXJzID0gcGFyZW50Ll9zdWJzY3JpYmVycztcbiAgdmFyIGxlbmd0aCA9IF9zdWJzY3JpYmVycy5sZW5ndGg7XG5cbiAgcGFyZW50Ll9vbmVycm9yID0gbnVsbDtcblxuICBfc3Vic2NyaWJlcnNbbGVuZ3RoXSA9IGNoaWxkO1xuICBfc3Vic2NyaWJlcnNbbGVuZ3RoICsgRlVMRklMTEVEXSA9IG9uRnVsZmlsbG1lbnQ7XG4gIF9zdWJzY3JpYmVyc1tsZW5ndGggKyBSRUpFQ1RFRF0gPSBvblJlamVjdGlvbjtcblxuICBpZiAobGVuZ3RoID09PSAwICYmIHBhcmVudC5fc3RhdGUpIHtcbiAgICBhc2FwKHB1Ymxpc2gsIHBhcmVudCk7XG4gIH1cbn1cblxuZnVuY3Rpb24gcHVibGlzaChwcm9taXNlKSB7XG4gIHZhciBzdWJzY3JpYmVycyA9IHByb21pc2UuX3N1YnNjcmliZXJzO1xuICB2YXIgc2V0dGxlZCA9IHByb21pc2UuX3N0YXRlO1xuXG4gIGlmIChzdWJzY3JpYmVycy5sZW5ndGggPT09IDApIHtcbiAgICByZXR1cm47XG4gIH1cblxuICB2YXIgY2hpbGQgPSB1bmRlZmluZWQsXG4gICAgICBjYWxsYmFjayA9IHVuZGVmaW5lZCxcbiAgICAgIGRldGFpbCA9IHByb21pc2UuX3Jlc3VsdDtcblxuICBmb3IgKHZhciBpID0gMDsgaSA8IHN1YnNjcmliZXJzLmxlbmd0aDsgaSArPSAzKSB7XG4gICAgY2hpbGQgPSBzdWJzY3JpYmVyc1tpXTtcbiAgICBjYWxsYmFjayA9IHN1YnNjcmliZXJzW2kgKyBzZXR0bGVkXTtcblxuICAgIGlmIChjaGlsZCkge1xuICAgICAgaW52b2tlQ2FsbGJhY2soc2V0dGxlZCwgY2hpbGQsIGNhbGxiYWNrLCBkZXRhaWwpO1xuICAgIH0gZWxzZSB7XG4gICAgICBjYWxsYmFjayhkZXRhaWwpO1xuICAgIH1cbiAgfVxuXG4gIHByb21pc2UuX3N1YnNjcmliZXJzLmxlbmd0aCA9IDA7XG59XG5cbmZ1bmN0aW9uIEVycm9yT2JqZWN0KCkge1xuICB0aGlzLmVycm9yID0gbnVsbDtcbn1cblxudmFyIFRSWV9DQVRDSF9FUlJPUiA9IG5ldyBFcnJvck9iamVjdCgpO1xuXG5mdW5jdGlvbiB0cnlDYXRjaChjYWxsYmFjaywgZGV0YWlsKSB7XG4gIHRyeSB7XG4gICAgcmV0dXJuIGNhbGxiYWNrKGRldGFpbCk7XG4gIH0gY2F0Y2ggKGUpIHtcbiAgICBUUllfQ0FUQ0hfRVJST1IuZXJyb3IgPSBlO1xuICAgIHJldHVybiBUUllfQ0FUQ0hfRVJST1I7XG4gIH1cbn1cblxuZnVuY3Rpb24gaW52b2tlQ2FsbGJhY2soc2V0dGxlZCwgcHJvbWlzZSwgY2FsbGJhY2ssIGRldGFpbCkge1xuICB2YXIgaGFzQ2FsbGJhY2sgPSBpc0Z1bmN0aW9uKGNhbGxiYWNrKSxcbiAgICAgIHZhbHVlID0gdW5kZWZpbmVkLFxuICAgICAgZXJyb3IgPSB1bmRlZmluZWQsXG4gICAgICBzdWNjZWVkZWQgPSB1bmRlZmluZWQsXG4gICAgICBmYWlsZWQgPSB1bmRlZmluZWQ7XG5cbiAgaWYgKGhhc0NhbGxiYWNrKSB7XG4gICAgdmFsdWUgPSB0cnlDYXRjaChjYWxsYmFjaywgZGV0YWlsKTtcblxuICAgIGlmICh2YWx1ZSA9PT0gVFJZX0NBVENIX0VSUk9SKSB7XG4gICAgICBmYWlsZWQgPSB0cnVlO1xuICAgICAgZXJyb3IgPSB2YWx1ZS5lcnJvcjtcbiAgICAgIHZhbHVlLmVycm9yID0gbnVsbDtcbiAgICB9IGVsc2Uge1xuICAgICAgc3VjY2VlZGVkID0gdHJ1ZTtcbiAgICB9XG5cbiAgICBpZiAocHJvbWlzZSA9PT0gdmFsdWUpIHtcbiAgICAgIHJlamVjdChwcm9taXNlLCBjYW5ub3RSZXR1cm5Pd24oKSk7XG4gICAgICByZXR1cm47XG4gICAgfVxuICB9IGVsc2Uge1xuICAgIHZhbHVlID0gZGV0YWlsO1xuICAgIHN1Y2NlZWRlZCA9IHRydWU7XG4gIH1cblxuICBpZiAocHJvbWlzZS5fc3RhdGUgIT09IFBFTkRJTkcpIHtcbiAgICAvLyBub29wXG4gIH0gZWxzZSBpZiAoaGFzQ2FsbGJhY2sgJiYgc3VjY2VlZGVkKSB7XG4gICAgICByZXNvbHZlKHByb21pc2UsIHZhbHVlKTtcbiAgICB9IGVsc2UgaWYgKGZhaWxlZCkge1xuICAgICAgcmVqZWN0KHByb21pc2UsIGVycm9yKTtcbiAgICB9IGVsc2UgaWYgKHNldHRsZWQgPT09IEZVTEZJTExFRCkge1xuICAgICAgZnVsZmlsbChwcm9taXNlLCB2YWx1ZSk7XG4gICAgfSBlbHNlIGlmIChzZXR0bGVkID09PSBSRUpFQ1RFRCkge1xuICAgICAgcmVqZWN0KHByb21pc2UsIHZhbHVlKTtcbiAgICB9XG59XG5cbmZ1bmN0aW9uIGluaXRpYWxpemVQcm9taXNlKHByb21pc2UsIHJlc29sdmVyKSB7XG4gIHRyeSB7XG4gICAgcmVzb2x2ZXIoZnVuY3Rpb24gcmVzb2x2ZVByb21pc2UodmFsdWUpIHtcbiAgICAgIHJlc29sdmUocHJvbWlzZSwgdmFsdWUpO1xuICAgIH0sIGZ1bmN0aW9uIHJlamVjdFByb21pc2UocmVhc29uKSB7XG4gICAgICByZWplY3QocHJvbWlzZSwgcmVhc29uKTtcbiAgICB9KTtcbiAgfSBjYXRjaCAoZSkge1xuICAgIHJlamVjdChwcm9taXNlLCBlKTtcbiAgfVxufVxuXG52YXIgaWQgPSAwO1xuZnVuY3Rpb24gbmV4dElkKCkge1xuICByZXR1cm4gaWQrKztcbn1cblxuZnVuY3Rpb24gbWFrZVByb21pc2UocHJvbWlzZSkge1xuICBwcm9taXNlW1BST01JU0VfSURdID0gaWQrKztcbiAgcHJvbWlzZS5fc3RhdGUgPSB1bmRlZmluZWQ7XG4gIHByb21pc2UuX3Jlc3VsdCA9IHVuZGVmaW5lZDtcbiAgcHJvbWlzZS5fc3Vic2NyaWJlcnMgPSBbXTtcbn1cblxuZnVuY3Rpb24gRW51bWVyYXRvciQxKENvbnN0cnVjdG9yLCBpbnB1dCkge1xuICB0aGlzLl9pbnN0YW5jZUNvbnN0cnVjdG9yID0gQ29uc3RydWN0b3I7XG4gIHRoaXMucHJvbWlzZSA9IG5ldyBDb25zdHJ1Y3Rvcihub29wKTtcblxuICBpZiAoIXRoaXMucHJvbWlzZVtQUk9NSVNFX0lEXSkge1xuICAgIG1ha2VQcm9taXNlKHRoaXMucHJvbWlzZSk7XG4gIH1cblxuICBpZiAoaXNBcnJheShpbnB1dCkpIHtcbiAgICB0aGlzLmxlbmd0aCA9IGlucHV0Lmxlbmd0aDtcbiAgICB0aGlzLl9yZW1haW5pbmcgPSBpbnB1dC5sZW5ndGg7XG5cbiAgICB0aGlzLl9yZXN1bHQgPSBuZXcgQXJyYXkodGhpcy5sZW5ndGgpO1xuXG4gICAgaWYgKHRoaXMubGVuZ3RoID09PSAwKSB7XG4gICAgICBmdWxmaWxsKHRoaXMucHJvbWlzZSwgdGhpcy5fcmVzdWx0KTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5sZW5ndGggPSB0aGlzLmxlbmd0aCB8fCAwO1xuICAgICAgdGhpcy5fZW51bWVyYXRlKGlucHV0KTtcbiAgICAgIGlmICh0aGlzLl9yZW1haW5pbmcgPT09IDApIHtcbiAgICAgICAgZnVsZmlsbCh0aGlzLnByb21pc2UsIHRoaXMuX3Jlc3VsdCk7XG4gICAgICB9XG4gICAgfVxuICB9IGVsc2Uge1xuICAgIHJlamVjdCh0aGlzLnByb21pc2UsIHZhbGlkYXRpb25FcnJvcigpKTtcbiAgfVxufVxuXG5mdW5jdGlvbiB2YWxpZGF0aW9uRXJyb3IoKSB7XG4gIHJldHVybiBuZXcgRXJyb3IoJ0FycmF5IE1ldGhvZHMgbXVzdCBiZSBwcm92aWRlZCBhbiBBcnJheScpO1xufVxuXG5FbnVtZXJhdG9yJDEucHJvdG90eXBlLl9lbnVtZXJhdGUgPSBmdW5jdGlvbiAoaW5wdXQpIHtcbiAgZm9yICh2YXIgaSA9IDA7IHRoaXMuX3N0YXRlID09PSBQRU5ESU5HICYmIGkgPCBpbnB1dC5sZW5ndGg7IGkrKykge1xuICAgIHRoaXMuX2VhY2hFbnRyeShpbnB1dFtpXSwgaSk7XG4gIH1cbn07XG5cbkVudW1lcmF0b3IkMS5wcm90b3R5cGUuX2VhY2hFbnRyeSA9IGZ1bmN0aW9uIChlbnRyeSwgaSkge1xuICB2YXIgYyA9IHRoaXMuX2luc3RhbmNlQ29uc3RydWN0b3I7XG4gIHZhciByZXNvbHZlJCQxID0gYy5yZXNvbHZlO1xuXG4gIGlmIChyZXNvbHZlJCQxID09PSByZXNvbHZlJDEpIHtcbiAgICB2YXIgX3RoZW4gPSBnZXRUaGVuKGVudHJ5KTtcblxuICAgIGlmIChfdGhlbiA9PT0gdGhlbiAmJiBlbnRyeS5fc3RhdGUgIT09IFBFTkRJTkcpIHtcbiAgICAgIHRoaXMuX3NldHRsZWRBdChlbnRyeS5fc3RhdGUsIGksIGVudHJ5Ll9yZXN1bHQpO1xuICAgIH0gZWxzZSBpZiAodHlwZW9mIF90aGVuICE9PSAnZnVuY3Rpb24nKSB7XG4gICAgICB0aGlzLl9yZW1haW5pbmctLTtcbiAgICAgIHRoaXMuX3Jlc3VsdFtpXSA9IGVudHJ5O1xuICAgIH0gZWxzZSBpZiAoYyA9PT0gUHJvbWlzZSQyKSB7XG4gICAgICB2YXIgcHJvbWlzZSA9IG5ldyBjKG5vb3ApO1xuICAgICAgaGFuZGxlTWF5YmVUaGVuYWJsZShwcm9taXNlLCBlbnRyeSwgX3RoZW4pO1xuICAgICAgdGhpcy5fd2lsbFNldHRsZUF0KHByb21pc2UsIGkpO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLl93aWxsU2V0dGxlQXQobmV3IGMoZnVuY3Rpb24gKHJlc29sdmUkJDEpIHtcbiAgICAgICAgcmV0dXJuIHJlc29sdmUkJDEoZW50cnkpO1xuICAgICAgfSksIGkpO1xuICAgIH1cbiAgfSBlbHNlIHtcbiAgICB0aGlzLl93aWxsU2V0dGxlQXQocmVzb2x2ZSQkMShlbnRyeSksIGkpO1xuICB9XG59O1xuXG5FbnVtZXJhdG9yJDEucHJvdG90eXBlLl9zZXR0bGVkQXQgPSBmdW5jdGlvbiAoc3RhdGUsIGksIHZhbHVlKSB7XG4gIHZhciBwcm9taXNlID0gdGhpcy5wcm9taXNlO1xuXG4gIGlmIChwcm9taXNlLl9zdGF0ZSA9PT0gUEVORElORykge1xuICAgIHRoaXMuX3JlbWFpbmluZy0tO1xuXG4gICAgaWYgKHN0YXRlID09PSBSRUpFQ1RFRCkge1xuICAgICAgcmVqZWN0KHByb21pc2UsIHZhbHVlKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5fcmVzdWx0W2ldID0gdmFsdWU7XG4gICAgfVxuICB9XG5cbiAgaWYgKHRoaXMuX3JlbWFpbmluZyA9PT0gMCkge1xuICAgIGZ1bGZpbGwocHJvbWlzZSwgdGhpcy5fcmVzdWx0KTtcbiAgfVxufTtcblxuRW51bWVyYXRvciQxLnByb3RvdHlwZS5fd2lsbFNldHRsZUF0ID0gZnVuY3Rpb24gKHByb21pc2UsIGkpIHtcbiAgdmFyIGVudW1lcmF0b3IgPSB0aGlzO1xuXG4gIHN1YnNjcmliZShwcm9taXNlLCB1bmRlZmluZWQsIGZ1bmN0aW9uICh2YWx1ZSkge1xuICAgIHJldHVybiBlbnVtZXJhdG9yLl9zZXR0bGVkQXQoRlVMRklMTEVELCBpLCB2YWx1ZSk7XG4gIH0sIGZ1bmN0aW9uIChyZWFzb24pIHtcbiAgICByZXR1cm4gZW51bWVyYXRvci5fc2V0dGxlZEF0KFJFSkVDVEVELCBpLCByZWFzb24pO1xuICB9KTtcbn07XG5cbi8qKlxuICBgUHJvbWlzZS5hbGxgIGFjY2VwdHMgYW4gYXJyYXkgb2YgcHJvbWlzZXMsIGFuZCByZXR1cm5zIGEgbmV3IHByb21pc2Ugd2hpY2hcbiAgaXMgZnVsZmlsbGVkIHdpdGggYW4gYXJyYXkgb2YgZnVsZmlsbG1lbnQgdmFsdWVzIGZvciB0aGUgcGFzc2VkIHByb21pc2VzLCBvclxuICByZWplY3RlZCB3aXRoIHRoZSByZWFzb24gb2YgdGhlIGZpcnN0IHBhc3NlZCBwcm9taXNlIHRvIGJlIHJlamVjdGVkLiBJdCBjYXN0cyBhbGxcbiAgZWxlbWVudHMgb2YgdGhlIHBhc3NlZCBpdGVyYWJsZSB0byBwcm9taXNlcyBhcyBpdCBydW5zIHRoaXMgYWxnb3JpdGhtLlxuXG4gIEV4YW1wbGU6XG5cbiAgYGBgamF2YXNjcmlwdFxuICBsZXQgcHJvbWlzZTEgPSByZXNvbHZlKDEpO1xuICBsZXQgcHJvbWlzZTIgPSByZXNvbHZlKDIpO1xuICBsZXQgcHJvbWlzZTMgPSByZXNvbHZlKDMpO1xuICBsZXQgcHJvbWlzZXMgPSBbIHByb21pc2UxLCBwcm9taXNlMiwgcHJvbWlzZTMgXTtcblxuICBQcm9taXNlLmFsbChwcm9taXNlcykudGhlbihmdW5jdGlvbihhcnJheSl7XG4gICAgLy8gVGhlIGFycmF5IGhlcmUgd291bGQgYmUgWyAxLCAyLCAzIF07XG4gIH0pO1xuICBgYGBcblxuICBJZiBhbnkgb2YgdGhlIGBwcm9taXNlc2AgZ2l2ZW4gdG8gYGFsbGAgYXJlIHJlamVjdGVkLCB0aGUgZmlyc3QgcHJvbWlzZVxuICB0aGF0IGlzIHJlamVjdGVkIHdpbGwgYmUgZ2l2ZW4gYXMgYW4gYXJndW1lbnQgdG8gdGhlIHJldHVybmVkIHByb21pc2VzJ3NcbiAgcmVqZWN0aW9uIGhhbmRsZXIuIEZvciBleGFtcGxlOlxuXG4gIEV4YW1wbGU6XG5cbiAgYGBgamF2YXNjcmlwdFxuICBsZXQgcHJvbWlzZTEgPSByZXNvbHZlKDEpO1xuICBsZXQgcHJvbWlzZTIgPSByZWplY3QobmV3IEVycm9yKFwiMlwiKSk7XG4gIGxldCBwcm9taXNlMyA9IHJlamVjdChuZXcgRXJyb3IoXCIzXCIpKTtcbiAgbGV0IHByb21pc2VzID0gWyBwcm9taXNlMSwgcHJvbWlzZTIsIHByb21pc2UzIF07XG5cbiAgUHJvbWlzZS5hbGwocHJvbWlzZXMpLnRoZW4oZnVuY3Rpb24oYXJyYXkpe1xuICAgIC8vIENvZGUgaGVyZSBuZXZlciBydW5zIGJlY2F1c2UgdGhlcmUgYXJlIHJlamVjdGVkIHByb21pc2VzIVxuICB9LCBmdW5jdGlvbihlcnJvcikge1xuICAgIC8vIGVycm9yLm1lc3NhZ2UgPT09IFwiMlwiXG4gIH0pO1xuICBgYGBcblxuICBAbWV0aG9kIGFsbFxuICBAc3RhdGljXG4gIEBwYXJhbSB7QXJyYXl9IGVudHJpZXMgYXJyYXkgb2YgcHJvbWlzZXNcbiAgQHBhcmFtIHtTdHJpbmd9IGxhYmVsIG9wdGlvbmFsIHN0cmluZyBmb3IgbGFiZWxpbmcgdGhlIHByb21pc2UuXG4gIFVzZWZ1bCBmb3IgdG9vbGluZy5cbiAgQHJldHVybiB7UHJvbWlzZX0gcHJvbWlzZSB0aGF0IGlzIGZ1bGZpbGxlZCB3aGVuIGFsbCBgcHJvbWlzZXNgIGhhdmUgYmVlblxuICBmdWxmaWxsZWQsIG9yIHJlamVjdGVkIGlmIGFueSBvZiB0aGVtIGJlY29tZSByZWplY3RlZC5cbiAgQHN0YXRpY1xuKi9cbmZ1bmN0aW9uIGFsbCQxKGVudHJpZXMpIHtcbiAgcmV0dXJuIG5ldyBFbnVtZXJhdG9yJDEodGhpcywgZW50cmllcykucHJvbWlzZTtcbn1cblxuLyoqXG4gIGBQcm9taXNlLnJhY2VgIHJldHVybnMgYSBuZXcgcHJvbWlzZSB3aGljaCBpcyBzZXR0bGVkIGluIHRoZSBzYW1lIHdheSBhcyB0aGVcbiAgZmlyc3QgcGFzc2VkIHByb21pc2UgdG8gc2V0dGxlLlxuXG4gIEV4YW1wbGU6XG5cbiAgYGBgamF2YXNjcmlwdFxuICBsZXQgcHJvbWlzZTEgPSBuZXcgUHJvbWlzZShmdW5jdGlvbihyZXNvbHZlLCByZWplY3Qpe1xuICAgIHNldFRpbWVvdXQoZnVuY3Rpb24oKXtcbiAgICAgIHJlc29sdmUoJ3Byb21pc2UgMScpO1xuICAgIH0sIDIwMCk7XG4gIH0pO1xuXG4gIGxldCBwcm9taXNlMiA9IG5ldyBQcm9taXNlKGZ1bmN0aW9uKHJlc29sdmUsIHJlamVjdCl7XG4gICAgc2V0VGltZW91dChmdW5jdGlvbigpe1xuICAgICAgcmVzb2x2ZSgncHJvbWlzZSAyJyk7XG4gICAgfSwgMTAwKTtcbiAgfSk7XG5cbiAgUHJvbWlzZS5yYWNlKFtwcm9taXNlMSwgcHJvbWlzZTJdKS50aGVuKGZ1bmN0aW9uKHJlc3VsdCl7XG4gICAgLy8gcmVzdWx0ID09PSAncHJvbWlzZSAyJyBiZWNhdXNlIGl0IHdhcyByZXNvbHZlZCBiZWZvcmUgcHJvbWlzZTFcbiAgICAvLyB3YXMgcmVzb2x2ZWQuXG4gIH0pO1xuICBgYGBcblxuICBgUHJvbWlzZS5yYWNlYCBpcyBkZXRlcm1pbmlzdGljIGluIHRoYXQgb25seSB0aGUgc3RhdGUgb2YgdGhlIGZpcnN0XG4gIHNldHRsZWQgcHJvbWlzZSBtYXR0ZXJzLiBGb3IgZXhhbXBsZSwgZXZlbiBpZiBvdGhlciBwcm9taXNlcyBnaXZlbiB0byB0aGVcbiAgYHByb21pc2VzYCBhcnJheSBhcmd1bWVudCBhcmUgcmVzb2x2ZWQsIGJ1dCB0aGUgZmlyc3Qgc2V0dGxlZCBwcm9taXNlIGhhc1xuICBiZWNvbWUgcmVqZWN0ZWQgYmVmb3JlIHRoZSBvdGhlciBwcm9taXNlcyBiZWNhbWUgZnVsZmlsbGVkLCB0aGUgcmV0dXJuZWRcbiAgcHJvbWlzZSB3aWxsIGJlY29tZSByZWplY3RlZDpcblxuICBgYGBqYXZhc2NyaXB0XG4gIGxldCBwcm9taXNlMSA9IG5ldyBQcm9taXNlKGZ1bmN0aW9uKHJlc29sdmUsIHJlamVjdCl7XG4gICAgc2V0VGltZW91dChmdW5jdGlvbigpe1xuICAgICAgcmVzb2x2ZSgncHJvbWlzZSAxJyk7XG4gICAgfSwgMjAwKTtcbiAgfSk7XG5cbiAgbGV0IHByb21pc2UyID0gbmV3IFByb21pc2UoZnVuY3Rpb24ocmVzb2x2ZSwgcmVqZWN0KXtcbiAgICBzZXRUaW1lb3V0KGZ1bmN0aW9uKCl7XG4gICAgICByZWplY3QobmV3IEVycm9yKCdwcm9taXNlIDInKSk7XG4gICAgfSwgMTAwKTtcbiAgfSk7XG5cbiAgUHJvbWlzZS5yYWNlKFtwcm9taXNlMSwgcHJvbWlzZTJdKS50aGVuKGZ1bmN0aW9uKHJlc3VsdCl7XG4gICAgLy8gQ29kZSBoZXJlIG5ldmVyIHJ1bnNcbiAgfSwgZnVuY3Rpb24ocmVhc29uKXtcbiAgICAvLyByZWFzb24ubWVzc2FnZSA9PT0gJ3Byb21pc2UgMicgYmVjYXVzZSBwcm9taXNlIDIgYmVjYW1lIHJlamVjdGVkIGJlZm9yZVxuICAgIC8vIHByb21pc2UgMSBiZWNhbWUgZnVsZmlsbGVkXG4gIH0pO1xuICBgYGBcblxuICBBbiBleGFtcGxlIHJlYWwtd29ybGQgdXNlIGNhc2UgaXMgaW1wbGVtZW50aW5nIHRpbWVvdXRzOlxuXG4gIGBgYGphdmFzY3JpcHRcbiAgUHJvbWlzZS5yYWNlKFthamF4KCdmb28uanNvbicpLCB0aW1lb3V0KDUwMDApXSlcbiAgYGBgXG5cbiAgQG1ldGhvZCByYWNlXG4gIEBzdGF0aWNcbiAgQHBhcmFtIHtBcnJheX0gcHJvbWlzZXMgYXJyYXkgb2YgcHJvbWlzZXMgdG8gb2JzZXJ2ZVxuICBVc2VmdWwgZm9yIHRvb2xpbmcuXG4gIEByZXR1cm4ge1Byb21pc2V9IGEgcHJvbWlzZSB3aGljaCBzZXR0bGVzIGluIHRoZSBzYW1lIHdheSBhcyB0aGUgZmlyc3QgcGFzc2VkXG4gIHByb21pc2UgdG8gc2V0dGxlLlxuKi9cbmZ1bmN0aW9uIHJhY2UkMShlbnRyaWVzKSB7XG4gIC8qanNoaW50IHZhbGlkdGhpczp0cnVlICovXG4gIHZhciBDb25zdHJ1Y3RvciA9IHRoaXM7XG5cbiAgaWYgKCFpc0FycmF5KGVudHJpZXMpKSB7XG4gICAgcmV0dXJuIG5ldyBDb25zdHJ1Y3RvcihmdW5jdGlvbiAoXywgcmVqZWN0KSB7XG4gICAgICByZXR1cm4gcmVqZWN0KG5ldyBUeXBlRXJyb3IoJ1lvdSBtdXN0IHBhc3MgYW4gYXJyYXkgdG8gcmFjZS4nKSk7XG4gICAgfSk7XG4gIH0gZWxzZSB7XG4gICAgcmV0dXJuIG5ldyBDb25zdHJ1Y3RvcihmdW5jdGlvbiAocmVzb2x2ZSwgcmVqZWN0KSB7XG4gICAgICB2YXIgbGVuZ3RoID0gZW50cmllcy5sZW5ndGg7XG4gICAgICBmb3IgKHZhciBpID0gMDsgaSA8IGxlbmd0aDsgaSsrKSB7XG4gICAgICAgIENvbnN0cnVjdG9yLnJlc29sdmUoZW50cmllc1tpXSkudGhlbihyZXNvbHZlLCByZWplY3QpO1xuICAgICAgfVxuICAgIH0pO1xuICB9XG59XG5cbi8qKlxuICBgUHJvbWlzZS5yZWplY3RgIHJldHVybnMgYSBwcm9taXNlIHJlamVjdGVkIHdpdGggdGhlIHBhc3NlZCBgcmVhc29uYC5cbiAgSXQgaXMgc2hvcnRoYW5kIGZvciB0aGUgZm9sbG93aW5nOlxuXG4gIGBgYGphdmFzY3JpcHRcbiAgbGV0IHByb21pc2UgPSBuZXcgUHJvbWlzZShmdW5jdGlvbihyZXNvbHZlLCByZWplY3Qpe1xuICAgIHJlamVjdChuZXcgRXJyb3IoJ1dIT09QUycpKTtcbiAgfSk7XG5cbiAgcHJvbWlzZS50aGVuKGZ1bmN0aW9uKHZhbHVlKXtcbiAgICAvLyBDb2RlIGhlcmUgZG9lc24ndCBydW4gYmVjYXVzZSB0aGUgcHJvbWlzZSBpcyByZWplY3RlZCFcbiAgfSwgZnVuY3Rpb24ocmVhc29uKXtcbiAgICAvLyByZWFzb24ubWVzc2FnZSA9PT0gJ1dIT09QUydcbiAgfSk7XG4gIGBgYFxuXG4gIEluc3RlYWQgb2Ygd3JpdGluZyB0aGUgYWJvdmUsIHlvdXIgY29kZSBub3cgc2ltcGx5IGJlY29tZXMgdGhlIGZvbGxvd2luZzpcblxuICBgYGBqYXZhc2NyaXB0XG4gIGxldCBwcm9taXNlID0gUHJvbWlzZS5yZWplY3QobmV3IEVycm9yKCdXSE9PUFMnKSk7XG5cbiAgcHJvbWlzZS50aGVuKGZ1bmN0aW9uKHZhbHVlKXtcbiAgICAvLyBDb2RlIGhlcmUgZG9lc24ndCBydW4gYmVjYXVzZSB0aGUgcHJvbWlzZSBpcyByZWplY3RlZCFcbiAgfSwgZnVuY3Rpb24ocmVhc29uKXtcbiAgICAvLyByZWFzb24ubWVzc2FnZSA9PT0gJ1dIT09QUydcbiAgfSk7XG4gIGBgYFxuXG4gIEBtZXRob2QgcmVqZWN0XG4gIEBzdGF0aWNcbiAgQHBhcmFtIHtBbnl9IHJlYXNvbiB2YWx1ZSB0aGF0IHRoZSByZXR1cm5lZCBwcm9taXNlIHdpbGwgYmUgcmVqZWN0ZWQgd2l0aC5cbiAgVXNlZnVsIGZvciB0b29saW5nLlxuICBAcmV0dXJuIHtQcm9taXNlfSBhIHByb21pc2UgcmVqZWN0ZWQgd2l0aCB0aGUgZ2l2ZW4gYHJlYXNvbmAuXG4qL1xuZnVuY3Rpb24gcmVqZWN0JDEocmVhc29uKSB7XG4gIC8qanNoaW50IHZhbGlkdGhpczp0cnVlICovXG4gIHZhciBDb25zdHJ1Y3RvciA9IHRoaXM7XG4gIHZhciBwcm9taXNlID0gbmV3IENvbnN0cnVjdG9yKG5vb3ApO1xuICByZWplY3QocHJvbWlzZSwgcmVhc29uKTtcbiAgcmV0dXJuIHByb21pc2U7XG59XG5cbmZ1bmN0aW9uIG5lZWRzUmVzb2x2ZXIoKSB7XG4gIHRocm93IG5ldyBUeXBlRXJyb3IoJ1lvdSBtdXN0IHBhc3MgYSByZXNvbHZlciBmdW5jdGlvbiBhcyB0aGUgZmlyc3QgYXJndW1lbnQgdG8gdGhlIHByb21pc2UgY29uc3RydWN0b3InKTtcbn1cblxuZnVuY3Rpb24gbmVlZHNOZXcoKSB7XG4gIHRocm93IG5ldyBUeXBlRXJyb3IoXCJGYWlsZWQgdG8gY29uc3RydWN0ICdQcm9taXNlJzogUGxlYXNlIHVzZSB0aGUgJ25ldycgb3BlcmF0b3IsIHRoaXMgb2JqZWN0IGNvbnN0cnVjdG9yIGNhbm5vdCBiZSBjYWxsZWQgYXMgYSBmdW5jdGlvbi5cIik7XG59XG5cbi8qKlxuICBQcm9taXNlIG9iamVjdHMgcmVwcmVzZW50IHRoZSBldmVudHVhbCByZXN1bHQgb2YgYW4gYXN5bmNocm9ub3VzIG9wZXJhdGlvbi4gVGhlXG4gIHByaW1hcnkgd2F5IG9mIGludGVyYWN0aW5nIHdpdGggYSBwcm9taXNlIGlzIHRocm91Z2ggaXRzIGB0aGVuYCBtZXRob2QsIHdoaWNoXG4gIHJlZ2lzdGVycyBjYWxsYmFja3MgdG8gcmVjZWl2ZSBlaXRoZXIgYSBwcm9taXNlJ3MgZXZlbnR1YWwgdmFsdWUgb3IgdGhlIHJlYXNvblxuICB3aHkgdGhlIHByb21pc2UgY2Fubm90IGJlIGZ1bGZpbGxlZC5cblxuICBUZXJtaW5vbG9neVxuICAtLS0tLS0tLS0tLVxuXG4gIC0gYHByb21pc2VgIGlzIGFuIG9iamVjdCBvciBmdW5jdGlvbiB3aXRoIGEgYHRoZW5gIG1ldGhvZCB3aG9zZSBiZWhhdmlvciBjb25mb3JtcyB0byB0aGlzIHNwZWNpZmljYXRpb24uXG4gIC0gYHRoZW5hYmxlYCBpcyBhbiBvYmplY3Qgb3IgZnVuY3Rpb24gdGhhdCBkZWZpbmVzIGEgYHRoZW5gIG1ldGhvZC5cbiAgLSBgdmFsdWVgIGlzIGFueSBsZWdhbCBKYXZhU2NyaXB0IHZhbHVlIChpbmNsdWRpbmcgdW5kZWZpbmVkLCBhIHRoZW5hYmxlLCBvciBhIHByb21pc2UpLlxuICAtIGBleGNlcHRpb25gIGlzIGEgdmFsdWUgdGhhdCBpcyB0aHJvd24gdXNpbmcgdGhlIHRocm93IHN0YXRlbWVudC5cbiAgLSBgcmVhc29uYCBpcyBhIHZhbHVlIHRoYXQgaW5kaWNhdGVzIHdoeSBhIHByb21pc2Ugd2FzIHJlamVjdGVkLlxuICAtIGBzZXR0bGVkYCB0aGUgZmluYWwgcmVzdGluZyBzdGF0ZSBvZiBhIHByb21pc2UsIGZ1bGZpbGxlZCBvciByZWplY3RlZC5cblxuICBBIHByb21pc2UgY2FuIGJlIGluIG9uZSBvZiB0aHJlZSBzdGF0ZXM6IHBlbmRpbmcsIGZ1bGZpbGxlZCwgb3IgcmVqZWN0ZWQuXG5cbiAgUHJvbWlzZXMgdGhhdCBhcmUgZnVsZmlsbGVkIGhhdmUgYSBmdWxmaWxsbWVudCB2YWx1ZSBhbmQgYXJlIGluIHRoZSBmdWxmaWxsZWRcbiAgc3RhdGUuICBQcm9taXNlcyB0aGF0IGFyZSByZWplY3RlZCBoYXZlIGEgcmVqZWN0aW9uIHJlYXNvbiBhbmQgYXJlIGluIHRoZVxuICByZWplY3RlZCBzdGF0ZS4gIEEgZnVsZmlsbG1lbnQgdmFsdWUgaXMgbmV2ZXIgYSB0aGVuYWJsZS5cblxuICBQcm9taXNlcyBjYW4gYWxzbyBiZSBzYWlkIHRvICpyZXNvbHZlKiBhIHZhbHVlLiAgSWYgdGhpcyB2YWx1ZSBpcyBhbHNvIGFcbiAgcHJvbWlzZSwgdGhlbiB0aGUgb3JpZ2luYWwgcHJvbWlzZSdzIHNldHRsZWQgc3RhdGUgd2lsbCBtYXRjaCB0aGUgdmFsdWUnc1xuICBzZXR0bGVkIHN0YXRlLiAgU28gYSBwcm9taXNlIHRoYXQgKnJlc29sdmVzKiBhIHByb21pc2UgdGhhdCByZWplY3RzIHdpbGxcbiAgaXRzZWxmIHJlamVjdCwgYW5kIGEgcHJvbWlzZSB0aGF0ICpyZXNvbHZlcyogYSBwcm9taXNlIHRoYXQgZnVsZmlsbHMgd2lsbFxuICBpdHNlbGYgZnVsZmlsbC5cblxuXG4gIEJhc2ljIFVzYWdlOlxuICAtLS0tLS0tLS0tLS1cblxuICBgYGBqc1xuICBsZXQgcHJvbWlzZSA9IG5ldyBQcm9taXNlKGZ1bmN0aW9uKHJlc29sdmUsIHJlamVjdCkge1xuICAgIC8vIG9uIHN1Y2Nlc3NcbiAgICByZXNvbHZlKHZhbHVlKTtcblxuICAgIC8vIG9uIGZhaWx1cmVcbiAgICByZWplY3QocmVhc29uKTtcbiAgfSk7XG5cbiAgcHJvbWlzZS50aGVuKGZ1bmN0aW9uKHZhbHVlKSB7XG4gICAgLy8gb24gZnVsZmlsbG1lbnRcbiAgfSwgZnVuY3Rpb24ocmVhc29uKSB7XG4gICAgLy8gb24gcmVqZWN0aW9uXG4gIH0pO1xuICBgYGBcblxuICBBZHZhbmNlZCBVc2FnZTpcbiAgLS0tLS0tLS0tLS0tLS0tXG5cbiAgUHJvbWlzZXMgc2hpbmUgd2hlbiBhYnN0cmFjdGluZyBhd2F5IGFzeW5jaHJvbm91cyBpbnRlcmFjdGlvbnMgc3VjaCBhc1xuICBgWE1MSHR0cFJlcXVlc3Rgcy5cblxuICBgYGBqc1xuICBmdW5jdGlvbiBnZXRKU09OKHVybCkge1xuICAgIHJldHVybiBuZXcgUHJvbWlzZShmdW5jdGlvbihyZXNvbHZlLCByZWplY3Qpe1xuICAgICAgbGV0IHhociA9IG5ldyBYTUxIdHRwUmVxdWVzdCgpO1xuXG4gICAgICB4aHIub3BlbignR0VUJywgdXJsKTtcbiAgICAgIHhoci5vbnJlYWR5c3RhdGVjaGFuZ2UgPSBoYW5kbGVyO1xuICAgICAgeGhyLnJlc3BvbnNlVHlwZSA9ICdqc29uJztcbiAgICAgIHhoci5zZXRSZXF1ZXN0SGVhZGVyKCdBY2NlcHQnLCAnYXBwbGljYXRpb24vanNvbicpO1xuICAgICAgeGhyLnNlbmQoKTtcblxuICAgICAgZnVuY3Rpb24gaGFuZGxlcigpIHtcbiAgICAgICAgaWYgKHRoaXMucmVhZHlTdGF0ZSA9PT0gdGhpcy5ET05FKSB7XG4gICAgICAgICAgaWYgKHRoaXMuc3RhdHVzID09PSAyMDApIHtcbiAgICAgICAgICAgIHJlc29sdmUodGhpcy5yZXNwb25zZSk7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHJlamVjdChuZXcgRXJyb3IoJ2dldEpTT046IGAnICsgdXJsICsgJ2AgZmFpbGVkIHdpdGggc3RhdHVzOiBbJyArIHRoaXMuc3RhdHVzICsgJ10nKSk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9O1xuICAgIH0pO1xuICB9XG5cbiAgZ2V0SlNPTignL3Bvc3RzLmpzb24nKS50aGVuKGZ1bmN0aW9uKGpzb24pIHtcbiAgICAvLyBvbiBmdWxmaWxsbWVudFxuICB9LCBmdW5jdGlvbihyZWFzb24pIHtcbiAgICAvLyBvbiByZWplY3Rpb25cbiAgfSk7XG4gIGBgYFxuXG4gIFVubGlrZSBjYWxsYmFja3MsIHByb21pc2VzIGFyZSBncmVhdCBjb21wb3NhYmxlIHByaW1pdGl2ZXMuXG5cbiAgYGBganNcbiAgUHJvbWlzZS5hbGwoW1xuICAgIGdldEpTT04oJy9wb3N0cycpLFxuICAgIGdldEpTT04oJy9jb21tZW50cycpXG4gIF0pLnRoZW4oZnVuY3Rpb24odmFsdWVzKXtcbiAgICB2YWx1ZXNbMF0gLy8gPT4gcG9zdHNKU09OXG4gICAgdmFsdWVzWzFdIC8vID0+IGNvbW1lbnRzSlNPTlxuXG4gICAgcmV0dXJuIHZhbHVlcztcbiAgfSk7XG4gIGBgYFxuXG4gIEBjbGFzcyBQcm9taXNlXG4gIEBwYXJhbSB7ZnVuY3Rpb259IHJlc29sdmVyXG4gIFVzZWZ1bCBmb3IgdG9vbGluZy5cbiAgQGNvbnN0cnVjdG9yXG4qL1xuZnVuY3Rpb24gUHJvbWlzZSQyKHJlc29sdmVyKSB7XG4gIHRoaXNbUFJPTUlTRV9JRF0gPSBuZXh0SWQoKTtcbiAgdGhpcy5fcmVzdWx0ID0gdGhpcy5fc3RhdGUgPSB1bmRlZmluZWQ7XG4gIHRoaXMuX3N1YnNjcmliZXJzID0gW107XG5cbiAgaWYgKG5vb3AgIT09IHJlc29sdmVyKSB7XG4gICAgdHlwZW9mIHJlc29sdmVyICE9PSAnZnVuY3Rpb24nICYmIG5lZWRzUmVzb2x2ZXIoKTtcbiAgICB0aGlzIGluc3RhbmNlb2YgUHJvbWlzZSQyID8gaW5pdGlhbGl6ZVByb21pc2UodGhpcywgcmVzb2x2ZXIpIDogbmVlZHNOZXcoKTtcbiAgfVxufVxuXG5Qcm9taXNlJDIuYWxsID0gYWxsJDE7XG5Qcm9taXNlJDIucmFjZSA9IHJhY2UkMTtcblByb21pc2UkMi5yZXNvbHZlID0gcmVzb2x2ZSQxO1xuUHJvbWlzZSQyLnJlamVjdCA9IHJlamVjdCQxO1xuUHJvbWlzZSQyLl9zZXRTY2hlZHVsZXIgPSBzZXRTY2hlZHVsZXI7XG5Qcm9taXNlJDIuX3NldEFzYXAgPSBzZXRBc2FwO1xuUHJvbWlzZSQyLl9hc2FwID0gYXNhcDtcblxuUHJvbWlzZSQyLnByb3RvdHlwZSA9IHtcbiAgY29uc3RydWN0b3I6IFByb21pc2UkMixcblxuICAvKipcbiAgICBUaGUgcHJpbWFyeSB3YXkgb2YgaW50ZXJhY3Rpbmcgd2l0aCBhIHByb21pc2UgaXMgdGhyb3VnaCBpdHMgYHRoZW5gIG1ldGhvZCxcbiAgICB3aGljaCByZWdpc3RlcnMgY2FsbGJhY2tzIHRvIHJlY2VpdmUgZWl0aGVyIGEgcHJvbWlzZSdzIGV2ZW50dWFsIHZhbHVlIG9yIHRoZVxuICAgIHJlYXNvbiB3aHkgdGhlIHByb21pc2UgY2Fubm90IGJlIGZ1bGZpbGxlZC5cbiAgXG4gICAgYGBganNcbiAgICBmaW5kVXNlcigpLnRoZW4oZnVuY3Rpb24odXNlcil7XG4gICAgICAvLyB1c2VyIGlzIGF2YWlsYWJsZVxuICAgIH0sIGZ1bmN0aW9uKHJlYXNvbil7XG4gICAgICAvLyB1c2VyIGlzIHVuYXZhaWxhYmxlLCBhbmQgeW91IGFyZSBnaXZlbiB0aGUgcmVhc29uIHdoeVxuICAgIH0pO1xuICAgIGBgYFxuICBcbiAgICBDaGFpbmluZ1xuICAgIC0tLS0tLS0tXG4gIFxuICAgIFRoZSByZXR1cm4gdmFsdWUgb2YgYHRoZW5gIGlzIGl0c2VsZiBhIHByb21pc2UuICBUaGlzIHNlY29uZCwgJ2Rvd25zdHJlYW0nXG4gICAgcHJvbWlzZSBpcyByZXNvbHZlZCB3aXRoIHRoZSByZXR1cm4gdmFsdWUgb2YgdGhlIGZpcnN0IHByb21pc2UncyBmdWxmaWxsbWVudFxuICAgIG9yIHJlamVjdGlvbiBoYW5kbGVyLCBvciByZWplY3RlZCBpZiB0aGUgaGFuZGxlciB0aHJvd3MgYW4gZXhjZXB0aW9uLlxuICBcbiAgICBgYGBqc1xuICAgIGZpbmRVc2VyKCkudGhlbihmdW5jdGlvbiAodXNlcikge1xuICAgICAgcmV0dXJuIHVzZXIubmFtZTtcbiAgICB9LCBmdW5jdGlvbiAocmVhc29uKSB7XG4gICAgICByZXR1cm4gJ2RlZmF1bHQgbmFtZSc7XG4gICAgfSkudGhlbihmdW5jdGlvbiAodXNlck5hbWUpIHtcbiAgICAgIC8vIElmIGBmaW5kVXNlcmAgZnVsZmlsbGVkLCBgdXNlck5hbWVgIHdpbGwgYmUgdGhlIHVzZXIncyBuYW1lLCBvdGhlcndpc2UgaXRcbiAgICAgIC8vIHdpbGwgYmUgYCdkZWZhdWx0IG5hbWUnYFxuICAgIH0pO1xuICBcbiAgICBmaW5kVXNlcigpLnRoZW4oZnVuY3Rpb24gKHVzZXIpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignRm91bmQgdXNlciwgYnV0IHN0aWxsIHVuaGFwcHknKTtcbiAgICB9LCBmdW5jdGlvbiAocmVhc29uKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ2BmaW5kVXNlcmAgcmVqZWN0ZWQgYW5kIHdlJ3JlIHVuaGFwcHknKTtcbiAgICB9KS50aGVuKGZ1bmN0aW9uICh2YWx1ZSkge1xuICAgICAgLy8gbmV2ZXIgcmVhY2hlZFxuICAgIH0sIGZ1bmN0aW9uIChyZWFzb24pIHtcbiAgICAgIC8vIGlmIGBmaW5kVXNlcmAgZnVsZmlsbGVkLCBgcmVhc29uYCB3aWxsIGJlICdGb3VuZCB1c2VyLCBidXQgc3RpbGwgdW5oYXBweScuXG4gICAgICAvLyBJZiBgZmluZFVzZXJgIHJlamVjdGVkLCBgcmVhc29uYCB3aWxsIGJlICdgZmluZFVzZXJgIHJlamVjdGVkIGFuZCB3ZSdyZSB1bmhhcHB5Jy5cbiAgICB9KTtcbiAgICBgYGBcbiAgICBJZiB0aGUgZG93bnN0cmVhbSBwcm9taXNlIGRvZXMgbm90IHNwZWNpZnkgYSByZWplY3Rpb24gaGFuZGxlciwgcmVqZWN0aW9uIHJlYXNvbnMgd2lsbCBiZSBwcm9wYWdhdGVkIGZ1cnRoZXIgZG93bnN0cmVhbS5cbiAgXG4gICAgYGBganNcbiAgICBmaW5kVXNlcigpLnRoZW4oZnVuY3Rpb24gKHVzZXIpIHtcbiAgICAgIHRocm93IG5ldyBQZWRhZ29naWNhbEV4Y2VwdGlvbignVXBzdHJlYW0gZXJyb3InKTtcbiAgICB9KS50aGVuKGZ1bmN0aW9uICh2YWx1ZSkge1xuICAgICAgLy8gbmV2ZXIgcmVhY2hlZFxuICAgIH0pLnRoZW4oZnVuY3Rpb24gKHZhbHVlKSB7XG4gICAgICAvLyBuZXZlciByZWFjaGVkXG4gICAgfSwgZnVuY3Rpb24gKHJlYXNvbikge1xuICAgICAgLy8gVGhlIGBQZWRnYWdvY2lhbEV4Y2VwdGlvbmAgaXMgcHJvcGFnYXRlZCBhbGwgdGhlIHdheSBkb3duIHRvIGhlcmVcbiAgICB9KTtcbiAgICBgYGBcbiAgXG4gICAgQXNzaW1pbGF0aW9uXG4gICAgLS0tLS0tLS0tLS0tXG4gIFxuICAgIFNvbWV0aW1lcyB0aGUgdmFsdWUgeW91IHdhbnQgdG8gcHJvcGFnYXRlIHRvIGEgZG93bnN0cmVhbSBwcm9taXNlIGNhbiBvbmx5IGJlXG4gICAgcmV0cmlldmVkIGFzeW5jaHJvbm91c2x5LiBUaGlzIGNhbiBiZSBhY2hpZXZlZCBieSByZXR1cm5pbmcgYSBwcm9taXNlIGluIHRoZVxuICAgIGZ1bGZpbGxtZW50IG9yIHJlamVjdGlvbiBoYW5kbGVyLiBUaGUgZG93bnN0cmVhbSBwcm9taXNlIHdpbGwgdGhlbiBiZSBwZW5kaW5nXG4gICAgdW50aWwgdGhlIHJldHVybmVkIHByb21pc2UgaXMgc2V0dGxlZC4gVGhpcyBpcyBjYWxsZWQgKmFzc2ltaWxhdGlvbiouXG4gIFxuICAgIGBgYGpzXG4gICAgZmluZFVzZXIoKS50aGVuKGZ1bmN0aW9uICh1c2VyKSB7XG4gICAgICByZXR1cm4gZmluZENvbW1lbnRzQnlBdXRob3IodXNlcik7XG4gICAgfSkudGhlbihmdW5jdGlvbiAoY29tbWVudHMpIHtcbiAgICAgIC8vIFRoZSB1c2VyJ3MgY29tbWVudHMgYXJlIG5vdyBhdmFpbGFibGVcbiAgICB9KTtcbiAgICBgYGBcbiAgXG4gICAgSWYgdGhlIGFzc2ltbGlhdGVkIHByb21pc2UgcmVqZWN0cywgdGhlbiB0aGUgZG93bnN0cmVhbSBwcm9taXNlIHdpbGwgYWxzbyByZWplY3QuXG4gIFxuICAgIGBgYGpzXG4gICAgZmluZFVzZXIoKS50aGVuKGZ1bmN0aW9uICh1c2VyKSB7XG4gICAgICByZXR1cm4gZmluZENvbW1lbnRzQnlBdXRob3IodXNlcik7XG4gICAgfSkudGhlbihmdW5jdGlvbiAoY29tbWVudHMpIHtcbiAgICAgIC8vIElmIGBmaW5kQ29tbWVudHNCeUF1dGhvcmAgZnVsZmlsbHMsIHdlJ2xsIGhhdmUgdGhlIHZhbHVlIGhlcmVcbiAgICB9LCBmdW5jdGlvbiAocmVhc29uKSB7XG4gICAgICAvLyBJZiBgZmluZENvbW1lbnRzQnlBdXRob3JgIHJlamVjdHMsIHdlJ2xsIGhhdmUgdGhlIHJlYXNvbiBoZXJlXG4gICAgfSk7XG4gICAgYGBgXG4gIFxuICAgIFNpbXBsZSBFeGFtcGxlXG4gICAgLS0tLS0tLS0tLS0tLS1cbiAgXG4gICAgU3luY2hyb25vdXMgRXhhbXBsZVxuICBcbiAgICBgYGBqYXZhc2NyaXB0XG4gICAgbGV0IHJlc3VsdDtcbiAgXG4gICAgdHJ5IHtcbiAgICAgIHJlc3VsdCA9IGZpbmRSZXN1bHQoKTtcbiAgICAgIC8vIHN1Y2Nlc3NcbiAgICB9IGNhdGNoKHJlYXNvbikge1xuICAgICAgLy8gZmFpbHVyZVxuICAgIH1cbiAgICBgYGBcbiAgXG4gICAgRXJyYmFjayBFeGFtcGxlXG4gIFxuICAgIGBgYGpzXG4gICAgZmluZFJlc3VsdChmdW5jdGlvbihyZXN1bHQsIGVycil7XG4gICAgICBpZiAoZXJyKSB7XG4gICAgICAgIC8vIGZhaWx1cmVcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIC8vIHN1Y2Nlc3NcbiAgICAgIH1cbiAgICB9KTtcbiAgICBgYGBcbiAgXG4gICAgUHJvbWlzZSBFeGFtcGxlO1xuICBcbiAgICBgYGBqYXZhc2NyaXB0XG4gICAgZmluZFJlc3VsdCgpLnRoZW4oZnVuY3Rpb24ocmVzdWx0KXtcbiAgICAgIC8vIHN1Y2Nlc3NcbiAgICB9LCBmdW5jdGlvbihyZWFzb24pe1xuICAgICAgLy8gZmFpbHVyZVxuICAgIH0pO1xuICAgIGBgYFxuICBcbiAgICBBZHZhbmNlZCBFeGFtcGxlXG4gICAgLS0tLS0tLS0tLS0tLS1cbiAgXG4gICAgU3luY2hyb25vdXMgRXhhbXBsZVxuICBcbiAgICBgYGBqYXZhc2NyaXB0XG4gICAgbGV0IGF1dGhvciwgYm9va3M7XG4gIFxuICAgIHRyeSB7XG4gICAgICBhdXRob3IgPSBmaW5kQXV0aG9yKCk7XG4gICAgICBib29rcyAgPSBmaW5kQm9va3NCeUF1dGhvcihhdXRob3IpO1xuICAgICAgLy8gc3VjY2Vzc1xuICAgIH0gY2F0Y2gocmVhc29uKSB7XG4gICAgICAvLyBmYWlsdXJlXG4gICAgfVxuICAgIGBgYFxuICBcbiAgICBFcnJiYWNrIEV4YW1wbGVcbiAgXG4gICAgYGBganNcbiAgXG4gICAgZnVuY3Rpb24gZm91bmRCb29rcyhib29rcykge1xuICBcbiAgICB9XG4gIFxuICAgIGZ1bmN0aW9uIGZhaWx1cmUocmVhc29uKSB7XG4gIFxuICAgIH1cbiAgXG4gICAgZmluZEF1dGhvcihmdW5jdGlvbihhdXRob3IsIGVycil7XG4gICAgICBpZiAoZXJyKSB7XG4gICAgICAgIGZhaWx1cmUoZXJyKTtcbiAgICAgICAgLy8gZmFpbHVyZVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICBmaW5kQm9vb2tzQnlBdXRob3IoYXV0aG9yLCBmdW5jdGlvbihib29rcywgZXJyKSB7XG4gICAgICAgICAgICBpZiAoZXJyKSB7XG4gICAgICAgICAgICAgIGZhaWx1cmUoZXJyKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgZm91bmRCb29rcyhib29rcyk7XG4gICAgICAgICAgICAgIH0gY2F0Y2gocmVhc29uKSB7XG4gICAgICAgICAgICAgICAgZmFpbHVyZShyZWFzb24pO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSk7XG4gICAgICAgIH0gY2F0Y2goZXJyb3IpIHtcbiAgICAgICAgICBmYWlsdXJlKGVycik7XG4gICAgICAgIH1cbiAgICAgICAgLy8gc3VjY2Vzc1xuICAgICAgfVxuICAgIH0pO1xuICAgIGBgYFxuICBcbiAgICBQcm9taXNlIEV4YW1wbGU7XG4gIFxuICAgIGBgYGphdmFzY3JpcHRcbiAgICBmaW5kQXV0aG9yKCkuXG4gICAgICB0aGVuKGZpbmRCb29rc0J5QXV0aG9yKS5cbiAgICAgIHRoZW4oZnVuY3Rpb24oYm9va3Mpe1xuICAgICAgICAvLyBmb3VuZCBib29rc1xuICAgIH0pLmNhdGNoKGZ1bmN0aW9uKHJlYXNvbil7XG4gICAgICAvLyBzb21ldGhpbmcgd2VudCB3cm9uZ1xuICAgIH0pO1xuICAgIGBgYFxuICBcbiAgICBAbWV0aG9kIHRoZW5cbiAgICBAcGFyYW0ge0Z1bmN0aW9ufSBvbkZ1bGZpbGxlZFxuICAgIEBwYXJhbSB7RnVuY3Rpb259IG9uUmVqZWN0ZWRcbiAgICBVc2VmdWwgZm9yIHRvb2xpbmcuXG4gICAgQHJldHVybiB7UHJvbWlzZX1cbiAgKi9cbiAgdGhlbjogdGhlbixcblxuICAvKipcbiAgICBgY2F0Y2hgIGlzIHNpbXBseSBzdWdhciBmb3IgYHRoZW4odW5kZWZpbmVkLCBvblJlamVjdGlvbilgIHdoaWNoIG1ha2VzIGl0IHRoZSBzYW1lXG4gICAgYXMgdGhlIGNhdGNoIGJsb2NrIG9mIGEgdHJ5L2NhdGNoIHN0YXRlbWVudC5cbiAgXG4gICAgYGBganNcbiAgICBmdW5jdGlvbiBmaW5kQXV0aG9yKCl7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ2NvdWxkbid0IGZpbmQgdGhhdCBhdXRob3InKTtcbiAgICB9XG4gIFxuICAgIC8vIHN5bmNocm9ub3VzXG4gICAgdHJ5IHtcbiAgICAgIGZpbmRBdXRob3IoKTtcbiAgICB9IGNhdGNoKHJlYXNvbikge1xuICAgICAgLy8gc29tZXRoaW5nIHdlbnQgd3JvbmdcbiAgICB9XG4gIFxuICAgIC8vIGFzeW5jIHdpdGggcHJvbWlzZXNcbiAgICBmaW5kQXV0aG9yKCkuY2F0Y2goZnVuY3Rpb24ocmVhc29uKXtcbiAgICAgIC8vIHNvbWV0aGluZyB3ZW50IHdyb25nXG4gICAgfSk7XG4gICAgYGBgXG4gIFxuICAgIEBtZXRob2QgY2F0Y2hcbiAgICBAcGFyYW0ge0Z1bmN0aW9ufSBvblJlamVjdGlvblxuICAgIFVzZWZ1bCBmb3IgdG9vbGluZy5cbiAgICBAcmV0dXJuIHtQcm9taXNlfVxuICAqL1xuICAnY2F0Y2gnOiBmdW5jdGlvbiBfY2F0Y2gob25SZWplY3Rpb24pIHtcbiAgICByZXR1cm4gdGhpcy50aGVuKG51bGwsIG9uUmVqZWN0aW9uKTtcbiAgfVxufTtcblxuLypnbG9iYWwgc2VsZiovXG5mdW5jdGlvbiBwb2x5ZmlsbCQxKCkge1xuICAgIHZhciBsb2NhbCA9IHVuZGVmaW5lZDtcblxuICAgIGlmICh0eXBlb2YgZ2xvYmFsICE9PSAndW5kZWZpbmVkJykge1xuICAgICAgICBsb2NhbCA9IGdsb2JhbDtcbiAgICB9IGVsc2UgaWYgKHR5cGVvZiBzZWxmICE9PSAndW5kZWZpbmVkJykge1xuICAgICAgICBsb2NhbCA9IHNlbGY7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGxvY2FsID0gRnVuY3Rpb24oJ3JldHVybiB0aGlzJykoKTtcbiAgICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdwb2x5ZmlsbCBmYWlsZWQgYmVjYXVzZSBnbG9iYWwgb2JqZWN0IGlzIHVuYXZhaWxhYmxlIGluIHRoaXMgZW52aXJvbm1lbnQnKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHZhciBQID0gbG9jYWwuUHJvbWlzZTtcblxuICAgIGlmIChQKSB7XG4gICAgICAgIHZhciBwcm9taXNlVG9TdHJpbmcgPSBudWxsO1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgcHJvbWlzZVRvU3RyaW5nID0gT2JqZWN0LnByb3RvdHlwZS50b1N0cmluZy5jYWxsKFAucmVzb2x2ZSgpKTtcbiAgICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICAgICAgLy8gc2lsZW50bHkgaWdub3JlZFxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHByb21pc2VUb1N0cmluZyA9PT0gJ1tvYmplY3QgUHJvbWlzZV0nICYmICFQLmNhc3QpIHtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGxvY2FsLlByb21pc2UgPSBQcm9taXNlJDI7XG59XG5cbi8vIFN0cmFuZ2UgY29tcGF0Li5cblByb21pc2UkMi5wb2x5ZmlsbCA9IHBvbHlmaWxsJDE7XG5Qcm9taXNlJDIuUHJvbWlzZSA9IFByb21pc2UkMjtcblxucmV0dXJuIFByb21pc2UkMjtcblxufSkpKTtcblxuLy8jIHNvdXJjZU1hcHBpbmdVUkw9ZXM2LXByb21pc2UubWFwXG4iLCIvLyB0aGUgd2hhdHdnLWZldGNoIHBvbHlmaWxsIGluc3RhbGxzIHRoZSBmZXRjaCgpIGZ1bmN0aW9uXG4vLyBvbiB0aGUgZ2xvYmFsIG9iamVjdCAod2luZG93IG9yIHNlbGYpXG4vL1xuLy8gUmV0dXJuIHRoYXQgYXMgdGhlIGV4cG9ydCBmb3IgdXNlIGluIFdlYnBhY2ssIEJyb3dzZXJpZnkgZXRjLlxucmVxdWlyZSgnd2hhdHdnLWZldGNoJyk7XG5tb2R1bGUuZXhwb3J0cyA9IHNlbGYuZmV0Y2guYmluZChzZWxmKTtcbiIsIi8vIHNoaW0gZm9yIHVzaW5nIHByb2Nlc3MgaW4gYnJvd3NlclxudmFyIHByb2Nlc3MgPSBtb2R1bGUuZXhwb3J0cyA9IHt9O1xuXG4vLyBjYWNoZWQgZnJvbSB3aGF0ZXZlciBnbG9iYWwgaXMgcHJlc2VudCBzbyB0aGF0IHRlc3QgcnVubmVycyB0aGF0IHN0dWIgaXRcbi8vIGRvbid0IGJyZWFrIHRoaW5ncy4gIEJ1dCB3ZSBuZWVkIHRvIHdyYXAgaXQgaW4gYSB0cnkgY2F0Y2ggaW4gY2FzZSBpdCBpc1xuLy8gd3JhcHBlZCBpbiBzdHJpY3QgbW9kZSBjb2RlIHdoaWNoIGRvZXNuJ3QgZGVmaW5lIGFueSBnbG9iYWxzLiAgSXQncyBpbnNpZGUgYVxuLy8gZnVuY3Rpb24gYmVjYXVzZSB0cnkvY2F0Y2hlcyBkZW9wdGltaXplIGluIGNlcnRhaW4gZW5naW5lcy5cblxudmFyIGNhY2hlZFNldFRpbWVvdXQ7XG52YXIgY2FjaGVkQ2xlYXJUaW1lb3V0O1xuXG5mdW5jdGlvbiBkZWZhdWx0U2V0VGltb3V0KCkge1xuICAgIHRocm93IG5ldyBFcnJvcignc2V0VGltZW91dCBoYXMgbm90IGJlZW4gZGVmaW5lZCcpO1xufVxuZnVuY3Rpb24gZGVmYXVsdENsZWFyVGltZW91dCAoKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdjbGVhclRpbWVvdXQgaGFzIG5vdCBiZWVuIGRlZmluZWQnKTtcbn1cbihmdW5jdGlvbiAoKSB7XG4gICAgdHJ5IHtcbiAgICAgICAgaWYgKHR5cGVvZiBzZXRUaW1lb3V0ID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgICAgICBjYWNoZWRTZXRUaW1lb3V0ID0gc2V0VGltZW91dDtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGNhY2hlZFNldFRpbWVvdXQgPSBkZWZhdWx0U2V0VGltb3V0O1xuICAgICAgICB9XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgICBjYWNoZWRTZXRUaW1lb3V0ID0gZGVmYXVsdFNldFRpbW91dDtcbiAgICB9XG4gICAgdHJ5IHtcbiAgICAgICAgaWYgKHR5cGVvZiBjbGVhclRpbWVvdXQgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgICAgIGNhY2hlZENsZWFyVGltZW91dCA9IGNsZWFyVGltZW91dDtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGNhY2hlZENsZWFyVGltZW91dCA9IGRlZmF1bHRDbGVhclRpbWVvdXQ7XG4gICAgICAgIH1cbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgIGNhY2hlZENsZWFyVGltZW91dCA9IGRlZmF1bHRDbGVhclRpbWVvdXQ7XG4gICAgfVxufSAoKSlcbmZ1bmN0aW9uIHJ1blRpbWVvdXQoZnVuKSB7XG4gICAgaWYgKGNhY2hlZFNldFRpbWVvdXQgPT09IHNldFRpbWVvdXQpIHtcbiAgICAgICAgLy9ub3JtYWwgZW52aXJvbWVudHMgaW4gc2FuZSBzaXR1YXRpb25zXG4gICAgICAgIHJldHVybiBzZXRUaW1lb3V0KGZ1biwgMCk7XG4gICAgfVxuICAgIC8vIGlmIHNldFRpbWVvdXQgd2Fzbid0IGF2YWlsYWJsZSBidXQgd2FzIGxhdHRlciBkZWZpbmVkXG4gICAgaWYgKChjYWNoZWRTZXRUaW1lb3V0ID09PSBkZWZhdWx0U2V0VGltb3V0IHx8ICFjYWNoZWRTZXRUaW1lb3V0KSAmJiBzZXRUaW1lb3V0KSB7XG4gICAgICAgIGNhY2hlZFNldFRpbWVvdXQgPSBzZXRUaW1lb3V0O1xuICAgICAgICByZXR1cm4gc2V0VGltZW91dChmdW4sIDApO1xuICAgIH1cbiAgICB0cnkge1xuICAgICAgICAvLyB3aGVuIHdoZW4gc29tZWJvZHkgaGFzIHNjcmV3ZWQgd2l0aCBzZXRUaW1lb3V0IGJ1dCBubyBJLkUuIG1hZGRuZXNzXG4gICAgICAgIHJldHVybiBjYWNoZWRTZXRUaW1lb3V0KGZ1biwgMCk7XG4gICAgfSBjYXRjaChlKXtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIC8vIFdoZW4gd2UgYXJlIGluIEkuRS4gYnV0IHRoZSBzY3JpcHQgaGFzIGJlZW4gZXZhbGVkIHNvIEkuRS4gZG9lc24ndCB0cnVzdCB0aGUgZ2xvYmFsIG9iamVjdCB3aGVuIGNhbGxlZCBub3JtYWxseVxuICAgICAgICAgICAgcmV0dXJuIGNhY2hlZFNldFRpbWVvdXQuY2FsbChudWxsLCBmdW4sIDApO1xuICAgICAgICB9IGNhdGNoKGUpe1xuICAgICAgICAgICAgLy8gc2FtZSBhcyBhYm92ZSBidXQgd2hlbiBpdCdzIGEgdmVyc2lvbiBvZiBJLkUuIHRoYXQgbXVzdCBoYXZlIHRoZSBnbG9iYWwgb2JqZWN0IGZvciAndGhpcycsIGhvcGZ1bGx5IG91ciBjb250ZXh0IGNvcnJlY3Qgb3RoZXJ3aXNlIGl0IHdpbGwgdGhyb3cgYSBnbG9iYWwgZXJyb3JcbiAgICAgICAgICAgIHJldHVybiBjYWNoZWRTZXRUaW1lb3V0LmNhbGwodGhpcywgZnVuLCAwKTtcbiAgICAgICAgfVxuICAgIH1cblxuXG59XG5mdW5jdGlvbiBydW5DbGVhclRpbWVvdXQobWFya2VyKSB7XG4gICAgaWYgKGNhY2hlZENsZWFyVGltZW91dCA9PT0gY2xlYXJUaW1lb3V0KSB7XG4gICAgICAgIC8vbm9ybWFsIGVudmlyb21lbnRzIGluIHNhbmUgc2l0dWF0aW9uc1xuICAgICAgICByZXR1cm4gY2xlYXJUaW1lb3V0KG1hcmtlcik7XG4gICAgfVxuICAgIC8vIGlmIGNsZWFyVGltZW91dCB3YXNuJ3QgYXZhaWxhYmxlIGJ1dCB3YXMgbGF0dGVyIGRlZmluZWRcbiAgICBpZiAoKGNhY2hlZENsZWFyVGltZW91dCA9PT0gZGVmYXVsdENsZWFyVGltZW91dCB8fCAhY2FjaGVkQ2xlYXJUaW1lb3V0KSAmJiBjbGVhclRpbWVvdXQpIHtcbiAgICAgICAgY2FjaGVkQ2xlYXJUaW1lb3V0ID0gY2xlYXJUaW1lb3V0O1xuICAgICAgICByZXR1cm4gY2xlYXJUaW1lb3V0KG1hcmtlcik7XG4gICAgfVxuICAgIHRyeSB7XG4gICAgICAgIC8vIHdoZW4gd2hlbiBzb21lYm9keSBoYXMgc2NyZXdlZCB3aXRoIHNldFRpbWVvdXQgYnV0IG5vIEkuRS4gbWFkZG5lc3NcbiAgICAgICAgcmV0dXJuIGNhY2hlZENsZWFyVGltZW91dChtYXJrZXIpO1xuICAgIH0gY2F0Y2ggKGUpe1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgLy8gV2hlbiB3ZSBhcmUgaW4gSS5FLiBidXQgdGhlIHNjcmlwdCBoYXMgYmVlbiBldmFsZWQgc28gSS5FLiBkb2Vzbid0ICB0cnVzdCB0aGUgZ2xvYmFsIG9iamVjdCB3aGVuIGNhbGxlZCBub3JtYWxseVxuICAgICAgICAgICAgcmV0dXJuIGNhY2hlZENsZWFyVGltZW91dC5jYWxsKG51bGwsIG1hcmtlcik7XG4gICAgICAgIH0gY2F0Y2ggKGUpe1xuICAgICAgICAgICAgLy8gc2FtZSBhcyBhYm92ZSBidXQgd2hlbiBpdCdzIGEgdmVyc2lvbiBvZiBJLkUuIHRoYXQgbXVzdCBoYXZlIHRoZSBnbG9iYWwgb2JqZWN0IGZvciAndGhpcycsIGhvcGZ1bGx5IG91ciBjb250ZXh0IGNvcnJlY3Qgb3RoZXJ3aXNlIGl0IHdpbGwgdGhyb3cgYSBnbG9iYWwgZXJyb3IuXG4gICAgICAgICAgICAvLyBTb21lIHZlcnNpb25zIG9mIEkuRS4gaGF2ZSBkaWZmZXJlbnQgcnVsZXMgZm9yIGNsZWFyVGltZW91dCB2cyBzZXRUaW1lb3V0XG4gICAgICAgICAgICByZXR1cm4gY2FjaGVkQ2xlYXJUaW1lb3V0LmNhbGwodGhpcywgbWFya2VyKTtcbiAgICAgICAgfVxuICAgIH1cblxuXG5cbn1cbnZhciBxdWV1ZSA9IFtdO1xudmFyIGRyYWluaW5nID0gZmFsc2U7XG52YXIgY3VycmVudFF1ZXVlO1xudmFyIHF1ZXVlSW5kZXggPSAtMTtcblxuZnVuY3Rpb24gY2xlYW5VcE5leHRUaWNrKCkge1xuICAgIGlmICghZHJhaW5pbmcgfHwgIWN1cnJlbnRRdWV1ZSkge1xuICAgICAgICByZXR1cm47XG4gICAgfVxuICAgIGRyYWluaW5nID0gZmFsc2U7XG4gICAgaWYgKGN1cnJlbnRRdWV1ZS5sZW5ndGgpIHtcbiAgICAgICAgcXVldWUgPSBjdXJyZW50UXVldWUuY29uY2F0KHF1ZXVlKTtcbiAgICB9IGVsc2Uge1xuICAgICAgICBxdWV1ZUluZGV4ID0gLTE7XG4gICAgfVxuICAgIGlmIChxdWV1ZS5sZW5ndGgpIHtcbiAgICAgICAgZHJhaW5RdWV1ZSgpO1xuICAgIH1cbn1cblxuZnVuY3Rpb24gZHJhaW5RdWV1ZSgpIHtcbiAgICBpZiAoZHJhaW5pbmcpIHtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICB2YXIgdGltZW91dCA9IHJ1blRpbWVvdXQoY2xlYW5VcE5leHRUaWNrKTtcbiAgICBkcmFpbmluZyA9IHRydWU7XG5cbiAgICB2YXIgbGVuID0gcXVldWUubGVuZ3RoO1xuICAgIHdoaWxlKGxlbikge1xuICAgICAgICBjdXJyZW50UXVldWUgPSBxdWV1ZTtcbiAgICAgICAgcXVldWUgPSBbXTtcbiAgICAgICAgd2hpbGUgKCsrcXVldWVJbmRleCA8IGxlbikge1xuICAgICAgICAgICAgaWYgKGN1cnJlbnRRdWV1ZSkge1xuICAgICAgICAgICAgICAgIGN1cnJlbnRRdWV1ZVtxdWV1ZUluZGV4XS5ydW4oKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBxdWV1ZUluZGV4ID0gLTE7XG4gICAgICAgIGxlbiA9IHF1ZXVlLmxlbmd0aDtcbiAgICB9XG4gICAgY3VycmVudFF1ZXVlID0gbnVsbDtcbiAgICBkcmFpbmluZyA9IGZhbHNlO1xuICAgIHJ1bkNsZWFyVGltZW91dCh0aW1lb3V0KTtcbn1cblxucHJvY2Vzcy5uZXh0VGljayA9IGZ1bmN0aW9uIChmdW4pIHtcbiAgICB2YXIgYXJncyA9IG5ldyBBcnJheShhcmd1bWVudHMubGVuZ3RoIC0gMSk7XG4gICAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPiAxKSB7XG4gICAgICAgIGZvciAodmFyIGkgPSAxOyBpIDwgYXJndW1lbnRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBhcmdzW2kgLSAxXSA9IGFyZ3VtZW50c1tpXTtcbiAgICAgICAgfVxuICAgIH1cbiAgICBxdWV1ZS5wdXNoKG5ldyBJdGVtKGZ1biwgYXJncykpO1xuICAgIGlmIChxdWV1ZS5sZW5ndGggPT09IDEgJiYgIWRyYWluaW5nKSB7XG4gICAgICAgIHJ1blRpbWVvdXQoZHJhaW5RdWV1ZSk7XG4gICAgfVxufTtcblxuLy8gdjggbGlrZXMgcHJlZGljdGlibGUgb2JqZWN0c1xuZnVuY3Rpb24gSXRlbShmdW4sIGFycmF5KSB7XG4gICAgdGhpcy5mdW4gPSBmdW47XG4gICAgdGhpcy5hcnJheSA9IGFycmF5O1xufVxuSXRlbS5wcm90b3R5cGUucnVuID0gZnVuY3Rpb24gKCkge1xuICAgIHRoaXMuZnVuLmFwcGx5KG51bGwsIHRoaXMuYXJyYXkpO1xufTtcbnByb2Nlc3MudGl0bGUgPSAnYnJvd3Nlcic7XG5wcm9jZXNzLmJyb3dzZXIgPSB0cnVlO1xucHJvY2Vzcy5lbnYgPSB7fTtcbnByb2Nlc3MuYXJndiA9IFtdO1xucHJvY2Vzcy52ZXJzaW9uID0gJyc7IC8vIGVtcHR5IHN0cmluZyB0byBhdm9pZCByZWdleHAgaXNzdWVzXG5wcm9jZXNzLnZlcnNpb25zID0ge307XG5cbmZ1bmN0aW9uIG5vb3AoKSB7fVxuXG5wcm9jZXNzLm9uID0gbm9vcDtcbnByb2Nlc3MuYWRkTGlzdGVuZXIgPSBub29wO1xucHJvY2Vzcy5vbmNlID0gbm9vcDtcbnByb2Nlc3Mub2ZmID0gbm9vcDtcbnByb2Nlc3MucmVtb3ZlTGlzdGVuZXIgPSBub29wO1xucHJvY2Vzcy5yZW1vdmVBbGxMaXN0ZW5lcnMgPSBub29wO1xucHJvY2Vzcy5lbWl0ID0gbm9vcDtcbnByb2Nlc3MucHJlcGVuZExpc3RlbmVyID0gbm9vcDtcbnByb2Nlc3MucHJlcGVuZE9uY2VMaXN0ZW5lciA9IG5vb3A7XG5cbnByb2Nlc3MubGlzdGVuZXJzID0gZnVuY3Rpb24gKG5hbWUpIHsgcmV0dXJuIFtdIH1cblxucHJvY2Vzcy5iaW5kaW5nID0gZnVuY3Rpb24gKG5hbWUpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ3Byb2Nlc3MuYmluZGluZyBpcyBub3Qgc3VwcG9ydGVkJyk7XG59O1xuXG5wcm9jZXNzLmN3ZCA9IGZ1bmN0aW9uICgpIHsgcmV0dXJuICcvJyB9O1xucHJvY2Vzcy5jaGRpciA9IGZ1bmN0aW9uIChkaXIpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ3Byb2Nlc3MuY2hkaXIgaXMgbm90IHN1cHBvcnRlZCcpO1xufTtcbnByb2Nlc3MudW1hc2sgPSBmdW5jdGlvbigpIHsgcmV0dXJuIDA7IH07XG4iLCIoZnVuY3Rpb24oc2VsZikge1xuICAndXNlIHN0cmljdCc7XG5cbiAgaWYgKHNlbGYuZmV0Y2gpIHtcbiAgICByZXR1cm5cbiAgfVxuXG4gIHZhciBzdXBwb3J0ID0ge1xuICAgIHNlYXJjaFBhcmFtczogJ1VSTFNlYXJjaFBhcmFtcycgaW4gc2VsZixcbiAgICBpdGVyYWJsZTogJ1N5bWJvbCcgaW4gc2VsZiAmJiAnaXRlcmF0b3InIGluIFN5bWJvbCxcbiAgICBibG9iOiAnRmlsZVJlYWRlcicgaW4gc2VsZiAmJiAnQmxvYicgaW4gc2VsZiAmJiAoZnVuY3Rpb24oKSB7XG4gICAgICB0cnkge1xuICAgICAgICBuZXcgQmxvYigpXG4gICAgICAgIHJldHVybiB0cnVlXG4gICAgICB9IGNhdGNoKGUpIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlXG4gICAgICB9XG4gICAgfSkoKSxcbiAgICBmb3JtRGF0YTogJ0Zvcm1EYXRhJyBpbiBzZWxmLFxuICAgIGFycmF5QnVmZmVyOiAnQXJyYXlCdWZmZXInIGluIHNlbGZcbiAgfVxuXG4gIGlmIChzdXBwb3J0LmFycmF5QnVmZmVyKSB7XG4gICAgdmFyIHZpZXdDbGFzc2VzID0gW1xuICAgICAgJ1tvYmplY3QgSW50OEFycmF5XScsXG4gICAgICAnW29iamVjdCBVaW50OEFycmF5XScsXG4gICAgICAnW29iamVjdCBVaW50OENsYW1wZWRBcnJheV0nLFxuICAgICAgJ1tvYmplY3QgSW50MTZBcnJheV0nLFxuICAgICAgJ1tvYmplY3QgVWludDE2QXJyYXldJyxcbiAgICAgICdbb2JqZWN0IEludDMyQXJyYXldJyxcbiAgICAgICdbb2JqZWN0IFVpbnQzMkFycmF5XScsXG4gICAgICAnW29iamVjdCBGbG9hdDMyQXJyYXldJyxcbiAgICAgICdbb2JqZWN0IEZsb2F0NjRBcnJheV0nXG4gICAgXVxuXG4gICAgdmFyIGlzRGF0YVZpZXcgPSBmdW5jdGlvbihvYmopIHtcbiAgICAgIHJldHVybiBvYmogJiYgRGF0YVZpZXcucHJvdG90eXBlLmlzUHJvdG90eXBlT2Yob2JqKVxuICAgIH1cblxuICAgIHZhciBpc0FycmF5QnVmZmVyVmlldyA9IEFycmF5QnVmZmVyLmlzVmlldyB8fCBmdW5jdGlvbihvYmopIHtcbiAgICAgIHJldHVybiBvYmogJiYgdmlld0NsYXNzZXMuaW5kZXhPZihPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nLmNhbGwob2JqKSkgPiAtMVxuICAgIH1cbiAgfVxuXG4gIGZ1bmN0aW9uIG5vcm1hbGl6ZU5hbWUobmFtZSkge1xuICAgIGlmICh0eXBlb2YgbmFtZSAhPT0gJ3N0cmluZycpIHtcbiAgICAgIG5hbWUgPSBTdHJpbmcobmFtZSlcbiAgICB9XG4gICAgaWYgKC9bXmEtejAtOVxcLSMkJSYnKisuXFxeX2B8fl0vaS50ZXN0KG5hbWUpKSB7XG4gICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdJbnZhbGlkIGNoYXJhY3RlciBpbiBoZWFkZXIgZmllbGQgbmFtZScpXG4gICAgfVxuICAgIHJldHVybiBuYW1lLnRvTG93ZXJDYXNlKClcbiAgfVxuXG4gIGZ1bmN0aW9uIG5vcm1hbGl6ZVZhbHVlKHZhbHVlKSB7XG4gICAgaWYgKHR5cGVvZiB2YWx1ZSAhPT0gJ3N0cmluZycpIHtcbiAgICAgIHZhbHVlID0gU3RyaW5nKHZhbHVlKVxuICAgIH1cbiAgICByZXR1cm4gdmFsdWVcbiAgfVxuXG4gIC8vIEJ1aWxkIGEgZGVzdHJ1Y3RpdmUgaXRlcmF0b3IgZm9yIHRoZSB2YWx1ZSBsaXN0XG4gIGZ1bmN0aW9uIGl0ZXJhdG9yRm9yKGl0ZW1zKSB7XG4gICAgdmFyIGl0ZXJhdG9yID0ge1xuICAgICAgbmV4dDogZnVuY3Rpb24oKSB7XG4gICAgICAgIHZhciB2YWx1ZSA9IGl0ZW1zLnNoaWZ0KClcbiAgICAgICAgcmV0dXJuIHtkb25lOiB2YWx1ZSA9PT0gdW5kZWZpbmVkLCB2YWx1ZTogdmFsdWV9XG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKHN1cHBvcnQuaXRlcmFibGUpIHtcbiAgICAgIGl0ZXJhdG9yW1N5bWJvbC5pdGVyYXRvcl0gPSBmdW5jdGlvbigpIHtcbiAgICAgICAgcmV0dXJuIGl0ZXJhdG9yXG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIGl0ZXJhdG9yXG4gIH1cblxuICBmdW5jdGlvbiBIZWFkZXJzKGhlYWRlcnMpIHtcbiAgICB0aGlzLm1hcCA9IHt9XG5cbiAgICBpZiAoaGVhZGVycyBpbnN0YW5jZW9mIEhlYWRlcnMpIHtcbiAgICAgIGhlYWRlcnMuZm9yRWFjaChmdW5jdGlvbih2YWx1ZSwgbmFtZSkge1xuICAgICAgICB0aGlzLmFwcGVuZChuYW1lLCB2YWx1ZSlcbiAgICAgIH0sIHRoaXMpXG4gICAgfSBlbHNlIGlmIChBcnJheS5pc0FycmF5KGhlYWRlcnMpKSB7XG4gICAgICBoZWFkZXJzLmZvckVhY2goZnVuY3Rpb24oaGVhZGVyKSB7XG4gICAgICAgIHRoaXMuYXBwZW5kKGhlYWRlclswXSwgaGVhZGVyWzFdKVxuICAgICAgfSwgdGhpcylcbiAgICB9IGVsc2UgaWYgKGhlYWRlcnMpIHtcbiAgICAgIE9iamVjdC5nZXRPd25Qcm9wZXJ0eU5hbWVzKGhlYWRlcnMpLmZvckVhY2goZnVuY3Rpb24obmFtZSkge1xuICAgICAgICB0aGlzLmFwcGVuZChuYW1lLCBoZWFkZXJzW25hbWVdKVxuICAgICAgfSwgdGhpcylcbiAgICB9XG4gIH1cblxuICBIZWFkZXJzLnByb3RvdHlwZS5hcHBlbmQgPSBmdW5jdGlvbihuYW1lLCB2YWx1ZSkge1xuICAgIG5hbWUgPSBub3JtYWxpemVOYW1lKG5hbWUpXG4gICAgdmFsdWUgPSBub3JtYWxpemVWYWx1ZSh2YWx1ZSlcbiAgICB2YXIgb2xkVmFsdWUgPSB0aGlzLm1hcFtuYW1lXVxuICAgIHRoaXMubWFwW25hbWVdID0gb2xkVmFsdWUgPyBvbGRWYWx1ZSsnLCcrdmFsdWUgOiB2YWx1ZVxuICB9XG5cbiAgSGVhZGVycy5wcm90b3R5cGVbJ2RlbGV0ZSddID0gZnVuY3Rpb24obmFtZSkge1xuICAgIGRlbGV0ZSB0aGlzLm1hcFtub3JtYWxpemVOYW1lKG5hbWUpXVxuICB9XG5cbiAgSGVhZGVycy5wcm90b3R5cGUuZ2V0ID0gZnVuY3Rpb24obmFtZSkge1xuICAgIG5hbWUgPSBub3JtYWxpemVOYW1lKG5hbWUpXG4gICAgcmV0dXJuIHRoaXMuaGFzKG5hbWUpID8gdGhpcy5tYXBbbmFtZV0gOiBudWxsXG4gIH1cblxuICBIZWFkZXJzLnByb3RvdHlwZS5oYXMgPSBmdW5jdGlvbihuYW1lKSB7XG4gICAgcmV0dXJuIHRoaXMubWFwLmhhc093blByb3BlcnR5KG5vcm1hbGl6ZU5hbWUobmFtZSkpXG4gIH1cblxuICBIZWFkZXJzLnByb3RvdHlwZS5zZXQgPSBmdW5jdGlvbihuYW1lLCB2YWx1ZSkge1xuICAgIHRoaXMubWFwW25vcm1hbGl6ZU5hbWUobmFtZSldID0gbm9ybWFsaXplVmFsdWUodmFsdWUpXG4gIH1cblxuICBIZWFkZXJzLnByb3RvdHlwZS5mb3JFYWNoID0gZnVuY3Rpb24oY2FsbGJhY2ssIHRoaXNBcmcpIHtcbiAgICBmb3IgKHZhciBuYW1lIGluIHRoaXMubWFwKSB7XG4gICAgICBpZiAodGhpcy5tYXAuaGFzT3duUHJvcGVydHkobmFtZSkpIHtcbiAgICAgICAgY2FsbGJhY2suY2FsbCh0aGlzQXJnLCB0aGlzLm1hcFtuYW1lXSwgbmFtZSwgdGhpcylcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBIZWFkZXJzLnByb3RvdHlwZS5rZXlzID0gZnVuY3Rpb24oKSB7XG4gICAgdmFyIGl0ZW1zID0gW11cbiAgICB0aGlzLmZvckVhY2goZnVuY3Rpb24odmFsdWUsIG5hbWUpIHsgaXRlbXMucHVzaChuYW1lKSB9KVxuICAgIHJldHVybiBpdGVyYXRvckZvcihpdGVtcylcbiAgfVxuXG4gIEhlYWRlcnMucHJvdG90eXBlLnZhbHVlcyA9IGZ1bmN0aW9uKCkge1xuICAgIHZhciBpdGVtcyA9IFtdXG4gICAgdGhpcy5mb3JFYWNoKGZ1bmN0aW9uKHZhbHVlKSB7IGl0ZW1zLnB1c2godmFsdWUpIH0pXG4gICAgcmV0dXJuIGl0ZXJhdG9yRm9yKGl0ZW1zKVxuICB9XG5cbiAgSGVhZGVycy5wcm90b3R5cGUuZW50cmllcyA9IGZ1bmN0aW9uKCkge1xuICAgIHZhciBpdGVtcyA9IFtdXG4gICAgdGhpcy5mb3JFYWNoKGZ1bmN0aW9uKHZhbHVlLCBuYW1lKSB7IGl0ZW1zLnB1c2goW25hbWUsIHZhbHVlXSkgfSlcbiAgICByZXR1cm4gaXRlcmF0b3JGb3IoaXRlbXMpXG4gIH1cblxuICBpZiAoc3VwcG9ydC5pdGVyYWJsZSkge1xuICAgIEhlYWRlcnMucHJvdG90eXBlW1N5bWJvbC5pdGVyYXRvcl0gPSBIZWFkZXJzLnByb3RvdHlwZS5lbnRyaWVzXG4gIH1cblxuICBmdW5jdGlvbiBjb25zdW1lZChib2R5KSB7XG4gICAgaWYgKGJvZHkuYm9keVVzZWQpIHtcbiAgICAgIHJldHVybiBQcm9taXNlLnJlamVjdChuZXcgVHlwZUVycm9yKCdBbHJlYWR5IHJlYWQnKSlcbiAgICB9XG4gICAgYm9keS5ib2R5VXNlZCA9IHRydWVcbiAgfVxuXG4gIGZ1bmN0aW9uIGZpbGVSZWFkZXJSZWFkeShyZWFkZXIpIHtcbiAgICByZXR1cm4gbmV3IFByb21pc2UoZnVuY3Rpb24ocmVzb2x2ZSwgcmVqZWN0KSB7XG4gICAgICByZWFkZXIub25sb2FkID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIHJlc29sdmUocmVhZGVyLnJlc3VsdClcbiAgICAgIH1cbiAgICAgIHJlYWRlci5vbmVycm9yID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIHJlamVjdChyZWFkZXIuZXJyb3IpXG4gICAgICB9XG4gICAgfSlcbiAgfVxuXG4gIGZ1bmN0aW9uIHJlYWRCbG9iQXNBcnJheUJ1ZmZlcihibG9iKSB7XG4gICAgdmFyIHJlYWRlciA9IG5ldyBGaWxlUmVhZGVyKClcbiAgICB2YXIgcHJvbWlzZSA9IGZpbGVSZWFkZXJSZWFkeShyZWFkZXIpXG4gICAgcmVhZGVyLnJlYWRBc0FycmF5QnVmZmVyKGJsb2IpXG4gICAgcmV0dXJuIHByb21pc2VcbiAgfVxuXG4gIGZ1bmN0aW9uIHJlYWRCbG9iQXNUZXh0KGJsb2IpIHtcbiAgICB2YXIgcmVhZGVyID0gbmV3IEZpbGVSZWFkZXIoKVxuICAgIHZhciBwcm9taXNlID0gZmlsZVJlYWRlclJlYWR5KHJlYWRlcilcbiAgICByZWFkZXIucmVhZEFzVGV4dChibG9iKVxuICAgIHJldHVybiBwcm9taXNlXG4gIH1cblxuICBmdW5jdGlvbiByZWFkQXJyYXlCdWZmZXJBc1RleHQoYnVmKSB7XG4gICAgdmFyIHZpZXcgPSBuZXcgVWludDhBcnJheShidWYpXG4gICAgdmFyIGNoYXJzID0gbmV3IEFycmF5KHZpZXcubGVuZ3RoKVxuXG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCB2aWV3Lmxlbmd0aDsgaSsrKSB7XG4gICAgICBjaGFyc1tpXSA9IFN0cmluZy5mcm9tQ2hhckNvZGUodmlld1tpXSlcbiAgICB9XG4gICAgcmV0dXJuIGNoYXJzLmpvaW4oJycpXG4gIH1cblxuICBmdW5jdGlvbiBidWZmZXJDbG9uZShidWYpIHtcbiAgICBpZiAoYnVmLnNsaWNlKSB7XG4gICAgICByZXR1cm4gYnVmLnNsaWNlKDApXG4gICAgfSBlbHNlIHtcbiAgICAgIHZhciB2aWV3ID0gbmV3IFVpbnQ4QXJyYXkoYnVmLmJ5dGVMZW5ndGgpXG4gICAgICB2aWV3LnNldChuZXcgVWludDhBcnJheShidWYpKVxuICAgICAgcmV0dXJuIHZpZXcuYnVmZmVyXG4gICAgfVxuICB9XG5cbiAgZnVuY3Rpb24gQm9keSgpIHtcbiAgICB0aGlzLmJvZHlVc2VkID0gZmFsc2VcblxuICAgIHRoaXMuX2luaXRCb2R5ID0gZnVuY3Rpb24oYm9keSkge1xuICAgICAgdGhpcy5fYm9keUluaXQgPSBib2R5XG4gICAgICBpZiAoIWJvZHkpIHtcbiAgICAgICAgdGhpcy5fYm9keVRleHQgPSAnJ1xuICAgICAgfSBlbHNlIGlmICh0eXBlb2YgYm9keSA9PT0gJ3N0cmluZycpIHtcbiAgICAgICAgdGhpcy5fYm9keVRleHQgPSBib2R5XG4gICAgICB9IGVsc2UgaWYgKHN1cHBvcnQuYmxvYiAmJiBCbG9iLnByb3RvdHlwZS5pc1Byb3RvdHlwZU9mKGJvZHkpKSB7XG4gICAgICAgIHRoaXMuX2JvZHlCbG9iID0gYm9keVxuICAgICAgfSBlbHNlIGlmIChzdXBwb3J0LmZvcm1EYXRhICYmIEZvcm1EYXRhLnByb3RvdHlwZS5pc1Byb3RvdHlwZU9mKGJvZHkpKSB7XG4gICAgICAgIHRoaXMuX2JvZHlGb3JtRGF0YSA9IGJvZHlcbiAgICAgIH0gZWxzZSBpZiAoc3VwcG9ydC5zZWFyY2hQYXJhbXMgJiYgVVJMU2VhcmNoUGFyYW1zLnByb3RvdHlwZS5pc1Byb3RvdHlwZU9mKGJvZHkpKSB7XG4gICAgICAgIHRoaXMuX2JvZHlUZXh0ID0gYm9keS50b1N0cmluZygpXG4gICAgICB9IGVsc2UgaWYgKHN1cHBvcnQuYXJyYXlCdWZmZXIgJiYgc3VwcG9ydC5ibG9iICYmIGlzRGF0YVZpZXcoYm9keSkpIHtcbiAgICAgICAgdGhpcy5fYm9keUFycmF5QnVmZmVyID0gYnVmZmVyQ2xvbmUoYm9keS5idWZmZXIpXG4gICAgICAgIC8vIElFIDEwLTExIGNhbid0IGhhbmRsZSBhIERhdGFWaWV3IGJvZHkuXG4gICAgICAgIHRoaXMuX2JvZHlJbml0ID0gbmV3IEJsb2IoW3RoaXMuX2JvZHlBcnJheUJ1ZmZlcl0pXG4gICAgICB9IGVsc2UgaWYgKHN1cHBvcnQuYXJyYXlCdWZmZXIgJiYgKEFycmF5QnVmZmVyLnByb3RvdHlwZS5pc1Byb3RvdHlwZU9mKGJvZHkpIHx8IGlzQXJyYXlCdWZmZXJWaWV3KGJvZHkpKSkge1xuICAgICAgICB0aGlzLl9ib2R5QXJyYXlCdWZmZXIgPSBidWZmZXJDbG9uZShib2R5KVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKCd1bnN1cHBvcnRlZCBCb2R5SW5pdCB0eXBlJylcbiAgICAgIH1cblxuICAgICAgaWYgKCF0aGlzLmhlYWRlcnMuZ2V0KCdjb250ZW50LXR5cGUnKSkge1xuICAgICAgICBpZiAodHlwZW9mIGJvZHkgPT09ICdzdHJpbmcnKSB7XG4gICAgICAgICAgdGhpcy5oZWFkZXJzLnNldCgnY29udGVudC10eXBlJywgJ3RleHQvcGxhaW47Y2hhcnNldD1VVEYtOCcpXG4gICAgICAgIH0gZWxzZSBpZiAodGhpcy5fYm9keUJsb2IgJiYgdGhpcy5fYm9keUJsb2IudHlwZSkge1xuICAgICAgICAgIHRoaXMuaGVhZGVycy5zZXQoJ2NvbnRlbnQtdHlwZScsIHRoaXMuX2JvZHlCbG9iLnR5cGUpXG4gICAgICAgIH0gZWxzZSBpZiAoc3VwcG9ydC5zZWFyY2hQYXJhbXMgJiYgVVJMU2VhcmNoUGFyYW1zLnByb3RvdHlwZS5pc1Byb3RvdHlwZU9mKGJvZHkpKSB7XG4gICAgICAgICAgdGhpcy5oZWFkZXJzLnNldCgnY29udGVudC10eXBlJywgJ2FwcGxpY2F0aW9uL3gtd3d3LWZvcm0tdXJsZW5jb2RlZDtjaGFyc2V0PVVURi04JylcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cblxuICAgIGlmIChzdXBwb3J0LmJsb2IpIHtcbiAgICAgIHRoaXMuYmxvYiA9IGZ1bmN0aW9uKCkge1xuICAgICAgICB2YXIgcmVqZWN0ZWQgPSBjb25zdW1lZCh0aGlzKVxuICAgICAgICBpZiAocmVqZWN0ZWQpIHtcbiAgICAgICAgICByZXR1cm4gcmVqZWN0ZWRcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0aGlzLl9ib2R5QmxvYikge1xuICAgICAgICAgIHJldHVybiBQcm9taXNlLnJlc29sdmUodGhpcy5fYm9keUJsb2IpXG4gICAgICAgIH0gZWxzZSBpZiAodGhpcy5fYm9keUFycmF5QnVmZmVyKSB7XG4gICAgICAgICAgcmV0dXJuIFByb21pc2UucmVzb2x2ZShuZXcgQmxvYihbdGhpcy5fYm9keUFycmF5QnVmZmVyXSkpXG4gICAgICAgIH0gZWxzZSBpZiAodGhpcy5fYm9keUZvcm1EYXRhKSB7XG4gICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdjb3VsZCBub3QgcmVhZCBGb3JtRGF0YSBib2R5IGFzIGJsb2InKVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHJldHVybiBQcm9taXNlLnJlc29sdmUobmV3IEJsb2IoW3RoaXMuX2JvZHlUZXh0XSkpXG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgdGhpcy5hcnJheUJ1ZmZlciA9IGZ1bmN0aW9uKCkge1xuICAgICAgICBpZiAodGhpcy5fYm9keUFycmF5QnVmZmVyKSB7XG4gICAgICAgICAgcmV0dXJuIGNvbnN1bWVkKHRoaXMpIHx8IFByb21pc2UucmVzb2x2ZSh0aGlzLl9ib2R5QXJyYXlCdWZmZXIpXG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcmV0dXJuIHRoaXMuYmxvYigpLnRoZW4ocmVhZEJsb2JBc0FycmF5QnVmZmVyKVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuXG4gICAgdGhpcy50ZXh0ID0gZnVuY3Rpb24oKSB7XG4gICAgICB2YXIgcmVqZWN0ZWQgPSBjb25zdW1lZCh0aGlzKVxuICAgICAgaWYgKHJlamVjdGVkKSB7XG4gICAgICAgIHJldHVybiByZWplY3RlZFxuICAgICAgfVxuXG4gICAgICBpZiAodGhpcy5fYm9keUJsb2IpIHtcbiAgICAgICAgcmV0dXJuIHJlYWRCbG9iQXNUZXh0KHRoaXMuX2JvZHlCbG9iKVxuICAgICAgfSBlbHNlIGlmICh0aGlzLl9ib2R5QXJyYXlCdWZmZXIpIHtcbiAgICAgICAgcmV0dXJuIFByb21pc2UucmVzb2x2ZShyZWFkQXJyYXlCdWZmZXJBc1RleHQodGhpcy5fYm9keUFycmF5QnVmZmVyKSlcbiAgICAgIH0gZWxzZSBpZiAodGhpcy5fYm9keUZvcm1EYXRhKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcignY291bGQgbm90IHJlYWQgRm9ybURhdGEgYm9keSBhcyB0ZXh0JylcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJldHVybiBQcm9taXNlLnJlc29sdmUodGhpcy5fYm9keVRleHQpXG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKHN1cHBvcnQuZm9ybURhdGEpIHtcbiAgICAgIHRoaXMuZm9ybURhdGEgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMudGV4dCgpLnRoZW4oZGVjb2RlKVxuICAgICAgfVxuICAgIH1cblxuICAgIHRoaXMuanNvbiA9IGZ1bmN0aW9uKCkge1xuICAgICAgcmV0dXJuIHRoaXMudGV4dCgpLnRoZW4oSlNPTi5wYXJzZSlcbiAgICB9XG5cbiAgICByZXR1cm4gdGhpc1xuICB9XG5cbiAgLy8gSFRUUCBtZXRob2RzIHdob3NlIGNhcGl0YWxpemF0aW9uIHNob3VsZCBiZSBub3JtYWxpemVkXG4gIHZhciBtZXRob2RzID0gWydERUxFVEUnLCAnR0VUJywgJ0hFQUQnLCAnT1BUSU9OUycsICdQT1NUJywgJ1BVVCddXG5cbiAgZnVuY3Rpb24gbm9ybWFsaXplTWV0aG9kKG1ldGhvZCkge1xuICAgIHZhciB1cGNhc2VkID0gbWV0aG9kLnRvVXBwZXJDYXNlKClcbiAgICByZXR1cm4gKG1ldGhvZHMuaW5kZXhPZih1cGNhc2VkKSA+IC0xKSA/IHVwY2FzZWQgOiBtZXRob2RcbiAgfVxuXG4gIGZ1bmN0aW9uIFJlcXVlc3QoaW5wdXQsIG9wdGlvbnMpIHtcbiAgICBvcHRpb25zID0gb3B0aW9ucyB8fCB7fVxuICAgIHZhciBib2R5ID0gb3B0aW9ucy5ib2R5XG5cbiAgICBpZiAoaW5wdXQgaW5zdGFuY2VvZiBSZXF1ZXN0KSB7XG4gICAgICBpZiAoaW5wdXQuYm9keVVzZWQpIHtcbiAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcignQWxyZWFkeSByZWFkJylcbiAgICAgIH1cbiAgICAgIHRoaXMudXJsID0gaW5wdXQudXJsXG4gICAgICB0aGlzLmNyZWRlbnRpYWxzID0gaW5wdXQuY3JlZGVudGlhbHNcbiAgICAgIGlmICghb3B0aW9ucy5oZWFkZXJzKSB7XG4gICAgICAgIHRoaXMuaGVhZGVycyA9IG5ldyBIZWFkZXJzKGlucHV0LmhlYWRlcnMpXG4gICAgICB9XG4gICAgICB0aGlzLm1ldGhvZCA9IGlucHV0Lm1ldGhvZFxuICAgICAgdGhpcy5tb2RlID0gaW5wdXQubW9kZVxuICAgICAgaWYgKCFib2R5ICYmIGlucHV0Ll9ib2R5SW5pdCAhPSBudWxsKSB7XG4gICAgICAgIGJvZHkgPSBpbnB1dC5fYm9keUluaXRcbiAgICAgICAgaW5wdXQuYm9keVVzZWQgPSB0cnVlXG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMudXJsID0gU3RyaW5nKGlucHV0KVxuICAgIH1cblxuICAgIHRoaXMuY3JlZGVudGlhbHMgPSBvcHRpb25zLmNyZWRlbnRpYWxzIHx8IHRoaXMuY3JlZGVudGlhbHMgfHwgJ29taXQnXG4gICAgaWYgKG9wdGlvbnMuaGVhZGVycyB8fCAhdGhpcy5oZWFkZXJzKSB7XG4gICAgICB0aGlzLmhlYWRlcnMgPSBuZXcgSGVhZGVycyhvcHRpb25zLmhlYWRlcnMpXG4gICAgfVxuICAgIHRoaXMubWV0aG9kID0gbm9ybWFsaXplTWV0aG9kKG9wdGlvbnMubWV0aG9kIHx8IHRoaXMubWV0aG9kIHx8ICdHRVQnKVxuICAgIHRoaXMubW9kZSA9IG9wdGlvbnMubW9kZSB8fCB0aGlzLm1vZGUgfHwgbnVsbFxuICAgIHRoaXMucmVmZXJyZXIgPSBudWxsXG5cbiAgICBpZiAoKHRoaXMubWV0aG9kID09PSAnR0VUJyB8fCB0aGlzLm1ldGhvZCA9PT0gJ0hFQUQnKSAmJiBib2R5KSB7XG4gICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdCb2R5IG5vdCBhbGxvd2VkIGZvciBHRVQgb3IgSEVBRCByZXF1ZXN0cycpXG4gICAgfVxuICAgIHRoaXMuX2luaXRCb2R5KGJvZHkpXG4gIH1cblxuICBSZXF1ZXN0LnByb3RvdHlwZS5jbG9uZSA9IGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiBuZXcgUmVxdWVzdCh0aGlzLCB7IGJvZHk6IHRoaXMuX2JvZHlJbml0IH0pXG4gIH1cblxuICBmdW5jdGlvbiBkZWNvZGUoYm9keSkge1xuICAgIHZhciBmb3JtID0gbmV3IEZvcm1EYXRhKClcbiAgICBib2R5LnRyaW0oKS5zcGxpdCgnJicpLmZvckVhY2goZnVuY3Rpb24oYnl0ZXMpIHtcbiAgICAgIGlmIChieXRlcykge1xuICAgICAgICB2YXIgc3BsaXQgPSBieXRlcy5zcGxpdCgnPScpXG4gICAgICAgIHZhciBuYW1lID0gc3BsaXQuc2hpZnQoKS5yZXBsYWNlKC9cXCsvZywgJyAnKVxuICAgICAgICB2YXIgdmFsdWUgPSBzcGxpdC5qb2luKCc9JykucmVwbGFjZSgvXFwrL2csICcgJylcbiAgICAgICAgZm9ybS5hcHBlbmQoZGVjb2RlVVJJQ29tcG9uZW50KG5hbWUpLCBkZWNvZGVVUklDb21wb25lbnQodmFsdWUpKVxuICAgICAgfVxuICAgIH0pXG4gICAgcmV0dXJuIGZvcm1cbiAgfVxuXG4gIGZ1bmN0aW9uIHBhcnNlSGVhZGVycyhyYXdIZWFkZXJzKSB7XG4gICAgdmFyIGhlYWRlcnMgPSBuZXcgSGVhZGVycygpXG4gICAgcmF3SGVhZGVycy5zcGxpdCgvXFxyP1xcbi8pLmZvckVhY2goZnVuY3Rpb24obGluZSkge1xuICAgICAgdmFyIHBhcnRzID0gbGluZS5zcGxpdCgnOicpXG4gICAgICB2YXIga2V5ID0gcGFydHMuc2hpZnQoKS50cmltKClcbiAgICAgIGlmIChrZXkpIHtcbiAgICAgICAgdmFyIHZhbHVlID0gcGFydHMuam9pbignOicpLnRyaW0oKVxuICAgICAgICBoZWFkZXJzLmFwcGVuZChrZXksIHZhbHVlKVxuICAgICAgfVxuICAgIH0pXG4gICAgcmV0dXJuIGhlYWRlcnNcbiAgfVxuXG4gIEJvZHkuY2FsbChSZXF1ZXN0LnByb3RvdHlwZSlcblxuICBmdW5jdGlvbiBSZXNwb25zZShib2R5SW5pdCwgb3B0aW9ucykge1xuICAgIGlmICghb3B0aW9ucykge1xuICAgICAgb3B0aW9ucyA9IHt9XG4gICAgfVxuXG4gICAgdGhpcy50eXBlID0gJ2RlZmF1bHQnXG4gICAgdGhpcy5zdGF0dXMgPSAnc3RhdHVzJyBpbiBvcHRpb25zID8gb3B0aW9ucy5zdGF0dXMgOiAyMDBcbiAgICB0aGlzLm9rID0gdGhpcy5zdGF0dXMgPj0gMjAwICYmIHRoaXMuc3RhdHVzIDwgMzAwXG4gICAgdGhpcy5zdGF0dXNUZXh0ID0gJ3N0YXR1c1RleHQnIGluIG9wdGlvbnMgPyBvcHRpb25zLnN0YXR1c1RleHQgOiAnT0snXG4gICAgdGhpcy5oZWFkZXJzID0gbmV3IEhlYWRlcnMob3B0aW9ucy5oZWFkZXJzKVxuICAgIHRoaXMudXJsID0gb3B0aW9ucy51cmwgfHwgJydcbiAgICB0aGlzLl9pbml0Qm9keShib2R5SW5pdClcbiAgfVxuXG4gIEJvZHkuY2FsbChSZXNwb25zZS5wcm90b3R5cGUpXG5cbiAgUmVzcG9uc2UucHJvdG90eXBlLmNsb25lID0gZnVuY3Rpb24oKSB7XG4gICAgcmV0dXJuIG5ldyBSZXNwb25zZSh0aGlzLl9ib2R5SW5pdCwge1xuICAgICAgc3RhdHVzOiB0aGlzLnN0YXR1cyxcbiAgICAgIHN0YXR1c1RleHQ6IHRoaXMuc3RhdHVzVGV4dCxcbiAgICAgIGhlYWRlcnM6IG5ldyBIZWFkZXJzKHRoaXMuaGVhZGVycyksXG4gICAgICB1cmw6IHRoaXMudXJsXG4gICAgfSlcbiAgfVxuXG4gIFJlc3BvbnNlLmVycm9yID0gZnVuY3Rpb24oKSB7XG4gICAgdmFyIHJlc3BvbnNlID0gbmV3IFJlc3BvbnNlKG51bGwsIHtzdGF0dXM6IDAsIHN0YXR1c1RleHQ6ICcnfSlcbiAgICByZXNwb25zZS50eXBlID0gJ2Vycm9yJ1xuICAgIHJldHVybiByZXNwb25zZVxuICB9XG5cbiAgdmFyIHJlZGlyZWN0U3RhdHVzZXMgPSBbMzAxLCAzMDIsIDMwMywgMzA3LCAzMDhdXG5cbiAgUmVzcG9uc2UucmVkaXJlY3QgPSBmdW5jdGlvbih1cmwsIHN0YXR1cykge1xuICAgIGlmIChyZWRpcmVjdFN0YXR1c2VzLmluZGV4T2Yoc3RhdHVzKSA9PT0gLTEpIHtcbiAgICAgIHRocm93IG5ldyBSYW5nZUVycm9yKCdJbnZhbGlkIHN0YXR1cyBjb2RlJylcbiAgICB9XG5cbiAgICByZXR1cm4gbmV3IFJlc3BvbnNlKG51bGwsIHtzdGF0dXM6IHN0YXR1cywgaGVhZGVyczoge2xvY2F0aW9uOiB1cmx9fSlcbiAgfVxuXG4gIHNlbGYuSGVhZGVycyA9IEhlYWRlcnNcbiAgc2VsZi5SZXF1ZXN0ID0gUmVxdWVzdFxuICBzZWxmLlJlc3BvbnNlID0gUmVzcG9uc2VcblxuICBzZWxmLmZldGNoID0gZnVuY3Rpb24oaW5wdXQsIGluaXQpIHtcbiAgICByZXR1cm4gbmV3IFByb21pc2UoZnVuY3Rpb24ocmVzb2x2ZSwgcmVqZWN0KSB7XG4gICAgICB2YXIgcmVxdWVzdCA9IG5ldyBSZXF1ZXN0KGlucHV0LCBpbml0KVxuICAgICAgdmFyIHhociA9IG5ldyBYTUxIdHRwUmVxdWVzdCgpXG5cbiAgICAgIHhoci5vbmxvYWQgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgdmFyIG9wdGlvbnMgPSB7XG4gICAgICAgICAgc3RhdHVzOiB4aHIuc3RhdHVzLFxuICAgICAgICAgIHN0YXR1c1RleHQ6IHhoci5zdGF0dXNUZXh0LFxuICAgICAgICAgIGhlYWRlcnM6IHBhcnNlSGVhZGVycyh4aHIuZ2V0QWxsUmVzcG9uc2VIZWFkZXJzKCkgfHwgJycpXG4gICAgICAgIH1cbiAgICAgICAgb3B0aW9ucy51cmwgPSAncmVzcG9uc2VVUkwnIGluIHhociA/IHhoci5yZXNwb25zZVVSTCA6IG9wdGlvbnMuaGVhZGVycy5nZXQoJ1gtUmVxdWVzdC1VUkwnKVxuICAgICAgICB2YXIgYm9keSA9ICdyZXNwb25zZScgaW4geGhyID8geGhyLnJlc3BvbnNlIDogeGhyLnJlc3BvbnNlVGV4dFxuICAgICAgICByZXNvbHZlKG5ldyBSZXNwb25zZShib2R5LCBvcHRpb25zKSlcbiAgICAgIH1cblxuICAgICAgeGhyLm9uZXJyb3IgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgcmVqZWN0KG5ldyBUeXBlRXJyb3IoJ05ldHdvcmsgcmVxdWVzdCBmYWlsZWQnKSlcbiAgICAgIH1cblxuICAgICAgeGhyLm9udGltZW91dCA9IGZ1bmN0aW9uKCkge1xuICAgICAgICByZWplY3QobmV3IFR5cGVFcnJvcignTmV0d29yayByZXF1ZXN0IGZhaWxlZCcpKVxuICAgICAgfVxuXG4gICAgICB4aHIub3BlbihyZXF1ZXN0Lm1ldGhvZCwgcmVxdWVzdC51cmwsIHRydWUpXG5cbiAgICAgIGlmIChyZXF1ZXN0LmNyZWRlbnRpYWxzID09PSAnaW5jbHVkZScpIHtcbiAgICAgICAgeGhyLndpdGhDcmVkZW50aWFscyA9IHRydWVcbiAgICAgIH1cblxuICAgICAgaWYgKCdyZXNwb25zZVR5cGUnIGluIHhociAmJiBzdXBwb3J0LmJsb2IpIHtcbiAgICAgICAgeGhyLnJlc3BvbnNlVHlwZSA9ICdibG9iJ1xuICAgICAgfVxuXG4gICAgICByZXF1ZXN0LmhlYWRlcnMuZm9yRWFjaChmdW5jdGlvbih2YWx1ZSwgbmFtZSkge1xuICAgICAgICB4aHIuc2V0UmVxdWVzdEhlYWRlcihuYW1lLCB2YWx1ZSlcbiAgICAgIH0pXG5cbiAgICAgIHhoci5zZW5kKHR5cGVvZiByZXF1ZXN0Ll9ib2R5SW5pdCA9PT0gJ3VuZGVmaW5lZCcgPyBudWxsIDogcmVxdWVzdC5fYm9keUluaXQpXG4gICAgfSlcbiAgfVxuICBzZWxmLmZldGNoLnBvbHlmaWxsID0gdHJ1ZVxufSkodHlwZW9mIHNlbGYgIT09ICd1bmRlZmluZWQnID8gc2VsZiA6IHRoaXMpO1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG5jb25zdCB1dGlscyA9IHJlcXVpcmUoJy4vdXRpbHMnKTtcbmNvbnN0IGRlZmF1bHRzID0gcmVxdWlyZSgnLi9kZWZhdWx0cycpO1xuY29uc3QgaXRlbVRvQ1NMSlNPTiA9IHJlcXVpcmUoJy4uL3pvdGVyby1zaGltL2l0ZW0tdG8tY3NsLWpzb24nKTtcbmNvbnN0IGRhdGVUb1NxbCA9IHJlcXVpcmUoJy4uL3pvdGVyby1zaGltL2RhdGUtdG8tc3FsJyk7XG5jb25zdCBbIENPTVBMRVRFLCBNVUxUSVBMRV9JVEVNUywgRkFJTEVEIF0gPSBbICdDT01QTEVURScsICdNVUxUSVBMRV9JVEVNUycsICdGQUlMRUQnIF07XG5cbmNsYXNzIFpvdGVyb0JpYiB7XG5cdGNvbnN0cnVjdG9yKG9wdHMpIHtcblx0XHR0aGlzLm9wdHMgPSB7XG5cdFx0XHRzZXNzaW9uaWQ6IHV0aWxzLnV1aWQ0KCksXG5cdFx0XHQuLi5kZWZhdWx0cygpLFxuXHRcdFx0Li4ub3B0c1xuXHRcdH07XG5cblx0XHRpZih0aGlzLm9wdHMucGVyc2lzdCAmJiB0aGlzLm9wdHMuc3RvcmFnZSkge1xuXHRcdFx0aWYoISgnZ2V0SXRlbScgaW4gdGhpcy5vcHRzLnN0b3JhZ2UgfHxcblx0XHRcdFx0J3NldEl0ZW0nIGluIHRoaXMub3B0cy5zdG9yYWdlIHx8XG5cdFx0XHRcdCdjbGVhcicgaW4gdGhpcy5vcHRzLnN0b3JhZ2Vcblx0XHRcdCkpIHtcblx0XHRcdFx0dGhyb3cgbmV3IEVycm9yKCdJbnZhbGlkIHN0b3JhZ2UgZW5naW5lIHByb3ZpZGVkJyk7XG5cdFx0XHR9XG5cdFx0XHRpZih0aGlzLm9wdHMub3ZlcnJpZGUpIHtcblx0XHRcdFx0dGhpcy5jbGVhckl0ZW1zKCk7XG5cdFx0XHR9XG5cdFx0XHR0aGlzLml0ZW1zID0gWy4uLnRoaXMub3B0cy5pbml0aWFsSXRlbXMsIC4uLnRoaXMuZ2V0SXRlbXNTdG9yYWdlKCldO1xuXHRcdFx0dGhpcy5zZXRJdGVtc1N0b3JhZ2UodGhpcy5pdGVtcyk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHRoaXMuaXRlbXMgPSBbLi4udGhpcy5vcHRzLmluaXRpYWxJdGVtc107XG5cdFx0fVxuXHR9XG5cblx0Z2V0SXRlbXNTdG9yYWdlKCkge1xuXHRcdGxldCBpdGVtcyA9IHRoaXMub3B0cy5zdG9yYWdlLmdldEl0ZW0oYCR7dGhpcy5vcHRzLnN0b3JhZ2VQcmVmaXh9LWl0ZW1zYCk7XG5cdFx0cmV0dXJuIGl0ZW1zID8gSlNPTi5wYXJzZShpdGVtcykgOiBbXTtcblx0fVxuXG5cdHNldEl0ZW1zU3RvcmFnZShpdGVtcykge1xuXHRcdHRoaXMub3B0cy5zdG9yYWdlLnNldEl0ZW0oXG5cdFx0XHRgJHt0aGlzLm9wdHMuc3RvcmFnZVByZWZpeH0taXRlbXNgLFxuXHRcdFx0SlNPTi5zdHJpbmdpZnkoaXRlbXMpXG5cdFx0KTtcblx0fVxuXG5cdGFkZEl0ZW0oaXRlbSkge1xuXHRcdHRoaXMuaXRlbXMucHVzaChpdGVtKTtcblx0XHRpZih0aGlzLm9wdHMucGVyc2lzdCkge1xuXHRcdFx0dGhpcy5zZXRJdGVtc1N0b3JhZ2UodGhpcy5pdGVtcyk7XG5cdFx0fVxuXHR9XG5cblx0dXBkYXRlSXRlbShpbmRleCwgaXRlbSkge1xuXHRcdHRoaXMuaXRlbXNbaW5kZXhdID0gaXRlbTtcblx0XHRpZih0aGlzLm9wdHMucGVyc2lzdCkge1xuXHRcdFx0dGhpcy5zZXRJdGVtc1N0b3JhZ2UodGhpcy5pdGVtcyk7XG5cdFx0fVxuXHR9XG5cblx0cmVtb3ZlSXRlbShpdGVtKSB7XG5cdFx0bGV0IGluZGV4ID0gdGhpcy5pdGVtcy5pbmRleE9mKGl0ZW0pO1xuXHRcdGlmKGluZGV4ICE9PSAtMSkge1xuXHRcdFx0dGhpcy5pdGVtcy5zcGxpY2UoaW5kZXgsIDEpO1xuXHRcdFx0aWYodGhpcy5vcHRzLnBlcnNpc3QpIHtcblx0XHRcdFx0dGhpcy5zZXRJdGVtc1N0b3JhZ2UodGhpcy5pdGVtcyk7XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gaXRlbTtcblx0XHR9XG5cdFx0cmV0dXJuIGZhbHNlO1xuXHR9XG5cblx0Y2xlYXJJdGVtcygpIHtcblx0XHR0aGlzLml0ZW1zID0gW107XG5cdFx0aWYodGhpcy5vcHRzLnBlcnNpc3QpIHtcblx0XHRcdHRoaXMuc2V0SXRlbXNTdG9yYWdlKHRoaXMuaXRlbXMpO1xuXHRcdH1cblx0fVxuXG5cdGdldCBpdGVtc0NTTCgpIHtcblx0XHRyZXR1cm4gdGhpcy5pdGVtcy5tYXAoaSA9PiBpdGVtVG9DU0xKU09OKGkpKVxuXHR9XG5cblx0Z2V0IGl0ZW1zUmF3KCkge1xuXHRcdHJldHVybiB0aGlzLml0ZW1zO1xuXHR9XG5cblx0YXN5bmMgZXhwb3J0SXRlbXMoZm9ybWF0KSB7XG5cdFx0bGV0IHRyYW5zbGF0aW9uU2VydmVyVXJsID0gYCR7dGhpcy5vcHRzLnRyYW5zbGF0aW9uU2VydmVyVXJsfS8ke3RoaXMub3B0cy50cmFuc2xhdGlvblNlcnZlclByZWZpeH1leHBvcnQ/Zm9ybWF0PSR7Zm9ybWF0fWA7XG5cdFx0bGV0IGZldGNoT3B0aW9ucyA9IHtcblx0XHRcdG1ldGhvZDogJ1BPU1QnLFxuXHRcdFx0aGVhZGVyczoge1xuXHRcdFx0XHQnQ29udGVudC1UeXBlJzogJ2FwcGxpY2F0aW9uL2pzb24nXG5cdFx0XHR9LFxuXHRcdFx0Ym9keTogSlNPTi5zdHJpbmdpZnkodGhpcy5pdGVtcyksXG5cdFx0XHQuLi50aGlzLm9wdHMuaW5pdFxuXHRcdH1cblx0XHRjb25zdCByZXNwb25zZSA9IGF3YWl0IGZldGNoKHRyYW5zbGF0aW9uU2VydmVyVXJsLCBmZXRjaE9wdGlvbnMpO1xuXHRcdHJldHVybiBhd2FpdCByZXNwb25zZS50ZXh0KCk7XG5cdH1cblxuXHRhc3luYyB0cmFuc2xhdGVJZGVudGlmaWVyKGlkZW50aWZpZXIsIC4uLmFyZ3MpIHtcblx0XHRsZXQgdHJhbnNsYXRpb25TZXJ2ZXJVcmwgPSBgJHt0aGlzLm9wdHMudHJhbnNsYXRpb25TZXJ2ZXJVcmx9LyR7dGhpcy5vcHRzLnRyYW5zbGF0aW9uU2VydmVyUHJlZml4fXNlYXJjaGA7XG5cdFx0bGV0IGluaXQgPSB7XG5cdFx0XHRtZXRob2Q6ICdQT1NUJyxcblx0XHRcdGhlYWRlcnM6IHtcblx0XHRcdFx0J0NvbnRlbnQtVHlwZSc6ICd0ZXh0L3BsYWluJ1xuXHRcdFx0fSxcblx0XHRcdGJvZHk6IGlkZW50aWZpZXIsXG5cdFx0XHQuLi50aGlzLm9wdHMuaW5pdFxuXHRcdH07XG5cblx0XHRyZXR1cm4gYXdhaXQgdGhpcy50cmFuc2xhdGUodHJhbnNsYXRpb25TZXJ2ZXJVcmwsIGluaXQsIC4uLmFyZ3MpO1xuXHR9XG5cblx0YXN5bmMgdHJhbnNsYXRlVXJsSXRlbXModXJsLCBpdGVtcywgLi4uYXJncykge1xuXHRcdGxldCB0cmFuc2xhdGlvblNlcnZlclVybCA9IGAke3RoaXMub3B0cy50cmFuc2xhdGlvblNlcnZlclVybH0vJHt0aGlzLm9wdHMudHJhbnNsYXRpb25TZXJ2ZXJQcmVmaXh9d2ViYDtcblx0XHRsZXQgc2Vzc2lvbmlkID0gdGhpcy5vcHRzLnNlc3Npb25pZDtcblx0XHRsZXQgZGF0YSA9IHsgdXJsLCBpdGVtcywgc2Vzc2lvbmlkLCAuLi50aGlzLm9wdHMucmVxdWVzdCB9O1xuXG5cdFx0bGV0IGluaXQgPSB7XG5cdFx0XHRtZXRob2Q6ICdQT1NUJyxcblx0XHRcdGhlYWRlcnM6IHtcblx0XHRcdFx0J0NvbnRlbnQtVHlwZSc6ICdhcHBsaWNhdGlvbi9qc29uJ1xuXHRcdFx0fSxcblx0XHRcdGJvZHk6IEpTT04uc3RyaW5naWZ5KGRhdGEpLFxuXHRcdFx0Li4udGhpcy5vcHRzLmluaXRcblx0XHR9O1xuXG5cdFx0cmV0dXJuIGF3YWl0IHRoaXMudHJhbnNsYXRlKHRyYW5zbGF0aW9uU2VydmVyVXJsLCBpbml0LCAuLi5hcmdzKTtcblx0fVxuXG5cdGFzeW5jIHRyYW5zbGF0ZVVybCh1cmwsIC4uLmFyZ3MpIHtcblx0XHRsZXQgdHJhbnNsYXRpb25TZXJ2ZXJVcmwgPSBgJHt0aGlzLm9wdHMudHJhbnNsYXRpb25TZXJ2ZXJVcmx9LyR7dGhpcy5vcHRzLnRyYW5zbGF0aW9uU2VydmVyUHJlZml4fXdlYmA7XG5cdFx0bGV0IHNlc3Npb25pZCA9IHRoaXMub3B0cy5zZXNzaW9uaWQ7XG5cdFx0bGV0IGRhdGEgPSB7IHVybCwgc2Vzc2lvbmlkLCAuLi50aGlzLm9wdHMucmVxdWVzdCB9O1xuXG5cdFx0bGV0IGluaXQgPSB7XG5cdFx0XHRtZXRob2Q6ICdQT1NUJyxcblx0XHRcdGhlYWRlcnM6IHtcblx0XHRcdFx0J0NvbnRlbnQtVHlwZSc6ICdhcHBsaWNhdGlvbi9qc29uJ1xuXHRcdFx0fSxcblx0XHRcdGJvZHk6IEpTT04uc3RyaW5naWZ5KGRhdGEpLFxuXHRcdFx0Li4udGhpcy5vcHRzLmluaXRcblx0XHR9O1xuXG5cdFx0cmV0dXJuIGF3YWl0IHRoaXMudHJhbnNsYXRlKHRyYW5zbGF0aW9uU2VydmVyVXJsLCBpbml0LCAuLi5hcmdzKTtcblx0fVxuXG5cdGFzeW5jIHRyYW5zbGF0ZSh1cmwsIGZldGNoT3B0aW9ucywgYWRkPXRydWUpIHtcblx0XHRjb25zdCByZXNwb25zZSA9IGF3YWl0IGZldGNoKHVybCwgZmV0Y2hPcHRpb25zKTtcblx0XHR2YXIgaXRlbXMsIHJlc3VsdDtcblxuXHRcdGlmKHJlc3BvbnNlLm9rKSB7XG5cdFx0XHRpdGVtcyA9IGF3YWl0IHJlc3BvbnNlLmpzb24oKTtcblx0XHRcdGlmKEFycmF5LmlzQXJyYXkoaXRlbXMpKSB7XG5cdFx0XHRcdGl0ZW1zLmZvckVhY2goaXRlbSA9PiB7XG5cdFx0XHRcdFx0aWYoaXRlbS5hY2Nlc3NEYXRlID09PSAnQ1VSUkVOVF9USU1FU1RBTVAnKSB7XG5cdFx0XHRcdFx0XHRjb25zdCBkdCA9IG5ldyBEYXRlKERhdGUubm93KCkpO1xuXHRcdFx0XHRcdFx0aXRlbS5hY2Nlc3NEYXRlID0gZGF0ZVRvU3FsKGR0LCB0cnVlKTtcblx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRpZihhZGQpIHtcblx0XHRcdFx0XHRcdHRoaXMuYWRkSXRlbShpdGVtKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0pO1xuXHRcdFx0fVxuXHRcdFx0cmVzdWx0ID0gQXJyYXkuaXNBcnJheShpdGVtcykgPyBDT01QTEVURSA6IEZBSUxFRDtcblx0XHR9IGVsc2UgaWYocmVzcG9uc2Uuc3RhdHVzID09PSAzMDApIHtcblx0XHRcdGl0ZW1zID0gYXdhaXQgcmVzcG9uc2UuanNvbigpO1xuXHRcdFx0cmVzdWx0ID0gTVVMVElQTEVfSVRFTVM7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHJlc3VsdCA9IEZBSUxFRFxuXHRcdH1cblxuXHRcdHJldHVybiB7IHJlc3VsdCwgaXRlbXMsIHJlc3BvbnNlIH07XG5cdH1cblxuXHRzdGF0aWMgZ2V0IENPTVBMRVRFKCkgeyByZXR1cm4gQ09NUExFVEUgfVxuXHRzdGF0aWMgZ2V0IE1VTFRJUExFX0lURU1TKCkgeyByZXR1cm4gTVVMVElQTEVfSVRFTVMgfVxuXHRzdGF0aWMgZ2V0IEZBSUxFRCgpIHsgcmV0dXJuIEZBSUxFRCB9XG59XG5cbm1vZHVsZS5leHBvcnRzID0gWm90ZXJvQmliO1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG5tb2R1bGUuZXhwb3J0cyA9ICgpID0+ICh7XG5cdHRyYW5zbGF0aW9uU2VydmVyVXJsOiB0eXBlb2Ygd2luZG93ICE9ICd1bmRlZmluZWQnICYmIHdpbmRvdy5sb2NhdGlvbi5vcmlnaW4gfHwgJycsXG5cdHRyYW5zbGF0aW9uU2VydmVyUHJlZml4OiAnJyxcblx0ZmV0Y2hDb25maWc6IHt9LFxuXHRpbml0aWFsSXRlbXM6IFtdLFxuXHRyZXF1ZXN0OiB7fSxcblx0c3RvcmFnZTogdHlwZW9mIHdpbmRvdyAhPSAndW5kZWZpbmVkJyAmJiAnbG9jYWxTdG9yYWdlJyBpbiB3aW5kb3cgJiYgd2luZG93LmxvY2FsU3RvcmFnZSB8fCB7fSxcblx0cGVyc2lzdDogdHJ1ZSxcblx0b3ZlcnJpZGU6IGZhbHNlLFxuXHRzdG9yYWdlUHJlZml4OiAnem90ZXJvLWJpYidcbn0pO1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG5tb2R1bGUuZXhwb3J0cyA9IHtcblx0dXVpZDQ6ICgpID0+ICd4eHh4eHh4eC14eHh4LTR4eHgteXh4eC14eHh4eHh4eHh4eHgnLnJlcGxhY2UoL1t4eV0vZywgYyA9PiB7XG5cdFx0XHR2YXIgciA9IE1hdGgucmFuZG9tKCkgKiAxNnwwLFxuXHRcdFx0XHR2ID0gYyA9PSAneCcgPyByIDogKHImMHgzfDB4OCk7XG5cblx0XHRcdHJldHVybiB2LnRvU3RyaW5nKDE2KTtcblx0XHR9KVxufVxuIiwiJ3VzZSBzdHJpY3QnO1xuXG5yZXF1aXJlKCdlczYtcHJvbWlzZS9hdXRvJyk7XG5yZXF1aXJlKCdpc29tb3JwaGljLWZldGNoJyk7XG5yZXF1aXJlKCdiYWJlbC1yZWdlbmVyYXRvci1ydW50aW1lJyk7XG5jb25zdCBab3Rlcm9CaWIgPSByZXF1aXJlKCcuL2JpYi9iaWInKTtcblxubW9kdWxlLmV4cG9ydHMgPSBab3Rlcm9CaWI7XG4iLCIndXNlIHN0cmljdCc7XG5cbmNvbnN0IGNyZWF0b3JUeXBlcyA9IHtcblx0MTogJ2F1dGhvcicsXG5cdDI6ICdjb250cmlidXRvcicsXG5cdDM6ICdlZGl0b3InLFxuXHQ0OiAndHJhbnNsYXRvcicsXG5cdDU6ICdzZXJpZXNFZGl0b3InLFxuXHQ2OiAnaW50ZXJ2aWV3ZWUnLFxuXHQ3OiAnaW50ZXJ2aWV3ZXInLFxuXHQ4OiAnZGlyZWN0b3InLFxuXHQ5OiAnc2NyaXB0d3JpdGVyJyxcblx0MTA6ICdwcm9kdWNlcicsXG5cdDExOiAnY2FzdE1lbWJlcicsXG5cdDEyOiAnc3BvbnNvcicsXG5cdDEzOiAnY291bnNlbCcsXG5cdDE0OiAnaW52ZW50b3InLFxuXHQxNTogJ2F0dG9ybmV5QWdlbnQnLFxuXHQxNjogJ3JlY2lwaWVudCcsXG5cdDE3OiAncGVyZm9ybWVyJyxcblx0MTg6ICdjb21wb3NlcicsXG5cdDE5OiAnd29yZHNCeScsXG5cdDIwOiAnY2FydG9ncmFwaGVyJyxcblx0MjE6ICdwcm9ncmFtbWVyJyxcblx0MjI6ICdhcnRpc3QnLFxuXHQyMzogJ2NvbW1lbnRlcicsXG5cdDI0OiAncHJlc2VudGVyJyxcblx0MjU6ICdndWVzdCcsXG5cdDI2OiAncG9kY2FzdGVyJyxcblx0Mjc6ICdyZXZpZXdlZEF1dGhvcicsXG5cdDI4OiAnY29zcG9uc29yJyxcblx0Mjk6ICdib29rQXV0aG9yJ1xufTtcblxuXG4vL3JldmVyc2UgbG9va3VwXG5PYmplY3Qua2V5cyhjcmVhdG9yVHlwZXMpLm1hcChrID0+IGNyZWF0b3JUeXBlc1tjcmVhdG9yVHlwZXNba11dID0gayk7XG5tb2R1bGUuZXhwb3J0cyA9IGNyZWF0b3JUeXBlcztcbiIsIm1vZHVsZS5leHBvcnRzID0ge1xuXHRDU0xfTkFNRVNfTUFQUElOR1M6IHtcblx0XHQnYXV0aG9yJzonYXV0aG9yJyxcblx0XHQnZWRpdG9yJzonZWRpdG9yJyxcblx0XHQnYm9va0F1dGhvcic6J2NvbnRhaW5lci1hdXRob3InLFxuXHRcdCdjb21wb3Nlcic6J2NvbXBvc2VyJyxcblx0XHQnZGlyZWN0b3InOidkaXJlY3RvcicsXG5cdFx0J2ludGVydmlld2VyJzonaW50ZXJ2aWV3ZXInLFxuXHRcdCdyZWNpcGllbnQnOidyZWNpcGllbnQnLFxuXHRcdCdyZXZpZXdlZEF1dGhvcic6J3Jldmlld2VkLWF1dGhvcicsXG5cdFx0J3Nlcmllc0VkaXRvcic6J2NvbGxlY3Rpb24tZWRpdG9yJyxcblx0XHQndHJhbnNsYXRvcic6J3RyYW5zbGF0b3InXG5cdH0sXG5cblx0Lypcblx0ICogTWFwcGluZ3MgZm9yIHRleHQgdmFyaWFibGVzXG5cdCAqL1xuXHRDU0xfVEVYVF9NQVBQSU5HUzoge1xuXHRcdCd0aXRsZSc6Wyd0aXRsZSddLFxuXHRcdCdjb250YWluZXItdGl0bGUnOlsncHVibGljYXRpb25UaXRsZScsICAncmVwb3J0ZXInLCAnY29kZSddLCAvKiByZXBvcnRlciBhbmQgY29kZSBzaG91bGQgbW92ZSB0byBTUUwgbWFwcGluZyB0YWJsZXMgKi9cblx0XHQnY29sbGVjdGlvbi10aXRsZSc6WydzZXJpZXNUaXRsZScsICdzZXJpZXMnXSxcblx0XHQnY29sbGVjdGlvbi1udW1iZXInOlsnc2VyaWVzTnVtYmVyJ10sXG5cdFx0J3B1Ymxpc2hlcic6WydwdWJsaXNoZXInLCAnZGlzdHJpYnV0b3InXSwgLyogZGlzdHJpYnV0b3Igc2hvdWxkIG1vdmUgdG8gU1FMIG1hcHBpbmcgdGFibGVzICovXG5cdFx0J3B1Ymxpc2hlci1wbGFjZSc6WydwbGFjZSddLFxuXHRcdCdhdXRob3JpdHknOlsnY291cnQnLCdsZWdpc2xhdGl2ZUJvZHknLCAnaXNzdWluZ0F1dGhvcml0eSddLFxuXHRcdCdwYWdlJzpbJ3BhZ2VzJ10sXG5cdFx0J3ZvbHVtZSc6Wyd2b2x1bWUnLCAnY29kZU51bWJlciddLFxuXHRcdCdpc3N1ZSc6Wydpc3N1ZScsICdwcmlvcml0eU51bWJlcnMnXSxcblx0XHQnbnVtYmVyLW9mLXZvbHVtZXMnOlsnbnVtYmVyT2ZWb2x1bWVzJ10sXG5cdFx0J251bWJlci1vZi1wYWdlcyc6WydudW1QYWdlcyddLFxuXHRcdCdlZGl0aW9uJzpbJ2VkaXRpb24nXSxcblx0XHQndmVyc2lvbic6Wyd2ZXJzaW9uTnVtYmVyJ10sXG5cdFx0J3NlY3Rpb24nOlsnc2VjdGlvbicsICdjb21taXR0ZWUnXSxcblx0XHQnZ2VucmUnOlsndHlwZScsICdwcm9ncmFtbWluZ0xhbmd1YWdlJ10sXG5cdFx0J3NvdXJjZSc6WydsaWJyYXJ5Q2F0YWxvZyddLFxuXHRcdCdkaW1lbnNpb25zJzogWydhcnR3b3JrU2l6ZScsICdydW5uaW5nVGltZSddLFxuXHRcdCdtZWRpdW0nOlsnbWVkaXVtJywgJ3N5c3RlbSddLFxuXHRcdCdzY2FsZSc6WydzY2FsZSddLFxuXHRcdCdhcmNoaXZlJzpbJ2FyY2hpdmUnXSxcblx0XHQnYXJjaGl2ZV9sb2NhdGlvbic6WydhcmNoaXZlTG9jYXRpb24nXSxcblx0XHQnZXZlbnQnOlsnbWVldGluZ05hbWUnLCAnY29uZmVyZW5jZU5hbWUnXSwgLyogdGhlc2Ugc2hvdWxkIGJlIG1hcHBlZCB0byB0aGUgc2FtZSBiYXNlIGZpZWxkIGluIFNRTCBtYXBwaW5nIHRhYmxlcyAqL1xuXHRcdCdldmVudC1wbGFjZSc6WydwbGFjZSddLFxuXHRcdCdhYnN0cmFjdCc6WydhYnN0cmFjdE5vdGUnXSxcblx0XHQnVVJMJzpbJ3VybCddLFxuXHRcdCdET0knOlsnRE9JJ10sXG5cdFx0J0lTQk4nOlsnSVNCTiddLFxuXHRcdCdJU1NOJzpbJ0lTU04nXSxcblx0XHQnY2FsbC1udW1iZXInOlsnY2FsbE51bWJlcicsICdhcHBsaWNhdGlvbk51bWJlciddLFxuXHRcdCdub3RlJzpbJ2V4dHJhJ10sXG5cdFx0J251bWJlcic6WydudW1iZXInXSxcblx0XHQnY2hhcHRlci1udW1iZXInOlsnc2Vzc2lvbiddLFxuXHRcdCdyZWZlcmVuY2VzJzpbJ2hpc3RvcnknLCAncmVmZXJlbmNlcyddLFxuXHRcdCdzaG9ydFRpdGxlJzpbJ3Nob3J0VGl0bGUnXSxcblx0XHQnam91cm5hbEFiYnJldmlhdGlvbic6Wydqb3VybmFsQWJicmV2aWF0aW9uJ10sXG5cdFx0J3N0YXR1cyc6WydsZWdhbFN0YXR1cyddLFxuXHRcdCdsYW5ndWFnZSc6WydsYW5ndWFnZSddXG5cdH0sXG5cdENTTF9EQVRFX01BUFBJTkdTOiB7XG5cdFx0J2lzc3VlZCc6J2RhdGUnLFxuXHRcdCdhY2Nlc3NlZCc6J2FjY2Vzc0RhdGUnLFxuXHRcdCdzdWJtaXR0ZWQnOidmaWxpbmdEYXRlJ1xuXHR9LFxuXHRDU0xfVFlQRV9NQVBQSU5HUzoge1xuXHRcdCdib29rJzonYm9vaycsXG5cdFx0J2Jvb2tTZWN0aW9uJzonY2hhcHRlcicsXG5cdFx0J2pvdXJuYWxBcnRpY2xlJzonYXJ0aWNsZS1qb3VybmFsJyxcblx0XHQnbWFnYXppbmVBcnRpY2xlJzonYXJ0aWNsZS1tYWdhemluZScsXG5cdFx0J25ld3NwYXBlckFydGljbGUnOidhcnRpY2xlLW5ld3NwYXBlcicsXG5cdFx0J3RoZXNpcyc6J3RoZXNpcycsXG5cdFx0J2VuY3ljbG9wZWRpYUFydGljbGUnOidlbnRyeS1lbmN5Y2xvcGVkaWEnLFxuXHRcdCdkaWN0aW9uYXJ5RW50cnknOidlbnRyeS1kaWN0aW9uYXJ5Jyxcblx0XHQnY29uZmVyZW5jZVBhcGVyJzoncGFwZXItY29uZmVyZW5jZScsXG5cdFx0J2xldHRlcic6J3BlcnNvbmFsX2NvbW11bmljYXRpb24nLFxuXHRcdCdtYW51c2NyaXB0JzonbWFudXNjcmlwdCcsXG5cdFx0J2ludGVydmlldyc6J2ludGVydmlldycsXG5cdFx0J2ZpbG0nOidtb3Rpb25fcGljdHVyZScsXG5cdFx0J2FydHdvcmsnOidncmFwaGljJyxcblx0XHQnd2VicGFnZSc6J3dlYnBhZ2UnLFxuXHRcdCdyZXBvcnQnOidyZXBvcnQnLFxuXHRcdCdiaWxsJzonYmlsbCcsXG5cdFx0J2Nhc2UnOidsZWdhbF9jYXNlJyxcblx0XHQnaGVhcmluZyc6J2JpbGwnLFx0XHRcdFx0Ly8gPz9cblx0XHQncGF0ZW50JzoncGF0ZW50Jyxcblx0XHQnc3RhdHV0ZSc6J2xlZ2lzbGF0aW9uJyxcdFx0Ly8gPz9cblx0XHQnZW1haWwnOidwZXJzb25hbF9jb21tdW5pY2F0aW9uJyxcblx0XHQnbWFwJzonbWFwJyxcblx0XHQnYmxvZ1Bvc3QnOidwb3N0LXdlYmxvZycsXG5cdFx0J2luc3RhbnRNZXNzYWdlJzoncGVyc29uYWxfY29tbXVuaWNhdGlvbicsXG5cdFx0J2ZvcnVtUG9zdCc6J3Bvc3QnLFxuXHRcdCdhdWRpb1JlY29yZGluZyc6J3NvbmcnLFx0XHQvLyA/P1xuXHRcdCdwcmVzZW50YXRpb24nOidzcGVlY2gnLFxuXHRcdCd2aWRlb1JlY29yZGluZyc6J21vdGlvbl9waWN0dXJlJyxcblx0XHQndHZCcm9hZGNhc3QnOidicm9hZGNhc3QnLFxuXHRcdCdyYWRpb0Jyb2FkY2FzdCc6J2Jyb2FkY2FzdCcsXG5cdFx0J3BvZGNhc3QnOidzb25nJyxcdFx0XHQvLyA/P1xuXHRcdCdjb21wdXRlclByb2dyYW0nOidib29rJyxcdFx0Ly8gPz9cblx0XHQnZG9jdW1lbnQnOidhcnRpY2xlJyxcblx0XHQnbm90ZSc6J2FydGljbGUnLFxuXHRcdCdhdHRhY2htZW50JzonYXJ0aWNsZSdcblx0fVxufTtcbiIsImNvbnN0IGxwYWQgPSByZXF1aXJlKCcuL2xwYWQnKTtcblxubW9kdWxlLmV4cG9ydHMgPSAoZGF0ZSwgdG9VVEMpID0+IHtcblx0dmFyIHllYXIsIG1vbnRoLCBkYXksIGhvdXJzLCBtaW51dGVzLCBzZWNvbmRzO1xuXHR0cnkge1xuXHRcdGlmKHRvVVRDKSB7XG5cdFx0XHR5ZWFyID0gZGF0ZS5nZXRVVENGdWxsWWVhcigpO1xuXHRcdFx0bW9udGggPSBkYXRlLmdldFVUQ01vbnRoKCk7XG5cdFx0XHRkYXkgPSBkYXRlLmdldFVUQ0RhdGUoKTtcblx0XHRcdGhvdXJzID0gZGF0ZS5nZXRVVENIb3VycygpO1xuXHRcdFx0bWludXRlcyA9IGRhdGUuZ2V0VVRDTWludXRlcygpO1xuXHRcdFx0c2Vjb25kcyA9IGRhdGUuZ2V0VVRDU2Vjb25kcygpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHR5ZWFyID0gZGF0ZS5nZXRGdWxsWWVhcigpO1xuXHRcdFx0bW9udGggPSBkYXRlLmdldE1vbnRoKCk7XG5cdFx0XHRkYXkgPSBkYXRlLmdldERhdGUoKTtcblx0XHRcdGhvdXJzID0gZGF0ZS5nZXRIb3VycygpO1xuXHRcdFx0bWludXRlcyA9IGRhdGUuZ2V0TWludXRlcygpO1xuXHRcdFx0c2Vjb25kcyA9IGRhdGUuZ2V0U2Vjb25kcygpO1xuXHRcdH1cblxuXHRcdHllYXIgPSBscGFkKHllYXIsICcwJywgNCk7XG5cdFx0bW9udGggPSBscGFkKG1vbnRoICsgMSwgJzAnLCAyKTtcblx0XHRkYXkgPSBscGFkKGRheSwgJzAnLCAyKTtcblx0XHRob3VycyA9IGxwYWQoaG91cnMsICcwJywgMik7XG5cdFx0bWludXRlcyA9IGxwYWQobWludXRlcywgJzAnLCAyKTtcblx0XHRzZWNvbmRzID0gbHBhZChzZWNvbmRzLCAnMCcsIDIpO1xuXG5cdFx0cmV0dXJuIHllYXIgKyAnLScgKyBtb250aCArICctJyArIGRheSArICcgJ1xuXHRcdFx0KyBob3VycyArICc6JyArIG1pbnV0ZXMgKyAnOicgKyBzZWNvbmRzO1xuXHR9XG5cdGNhdGNoIChlKSB7XG5cdFx0cmV0dXJuICcnO1xuXHR9XG59XG4iLCJjb25zdCBpdGVtVHlwZXMgPSByZXF1aXJlKCcuL2l0ZW0tdHlwZXMnKTtcbmNvbnN0IGNyZWF0b3JUeXBlcyA9IHJlcXVpcmUoJy4vY3JlYXRvci10eXBlcycpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IHtcblx0W2l0ZW1UeXBlc1syXV06IGNyZWF0b3JUeXBlc1sxXSxcblx0W2l0ZW1UeXBlc1szXV06IGNyZWF0b3JUeXBlc1sxXSxcblx0W2l0ZW1UeXBlc1s0XV06IGNyZWF0b3JUeXBlc1sxXSxcblx0W2l0ZW1UeXBlc1s1XV06IGNyZWF0b3JUeXBlc1sxXSxcblx0W2l0ZW1UeXBlc1s2XV06IGNyZWF0b3JUeXBlc1sxXSxcblx0W2l0ZW1UeXBlc1s3XV06IGNyZWF0b3JUeXBlc1sxXSxcblx0W2l0ZW1UeXBlc1s4XV06IGNyZWF0b3JUeXBlc1sxXSxcblx0W2l0ZW1UeXBlc1s5XV06IGNyZWF0b3JUeXBlc1sxXSxcblx0W2l0ZW1UeXBlc1sxMF1dOiBjcmVhdG9yVHlwZXNbNl0sXG5cdFtpdGVtVHlwZXNbMTFdXTogY3JlYXRvclR5cGVzWzhdLFxuXHRbaXRlbVR5cGVzWzEyXV06IGNyZWF0b3JUeXBlc1syMl0sXG5cdFtpdGVtVHlwZXNbMTNdXTogY3JlYXRvclR5cGVzWzFdLFxuXHRbaXRlbVR5cGVzWzE1XV06IGNyZWF0b3JUeXBlc1sxXSxcblx0W2l0ZW1UeXBlc1sxNl1dOiBjcmVhdG9yVHlwZXNbMTJdLFxuXHRbaXRlbVR5cGVzWzE3XV06IGNyZWF0b3JUeXBlc1sxXSxcblx0W2l0ZW1UeXBlc1sxOF1dOiBjcmVhdG9yVHlwZXNbMl0sXG5cdFtpdGVtVHlwZXNbMTldXTogY3JlYXRvclR5cGVzWzE0XSxcblx0W2l0ZW1UeXBlc1syMF1dOiBjcmVhdG9yVHlwZXNbMV0sXG5cdFtpdGVtVHlwZXNbMjFdXTogY3JlYXRvclR5cGVzWzFdLFxuXHRbaXRlbVR5cGVzWzIyXV06IGNyZWF0b3JUeXBlc1syMF0sXG5cdFtpdGVtVHlwZXNbMjNdXTogY3JlYXRvclR5cGVzWzFdLFxuXHRbaXRlbVR5cGVzWzI0XV06IGNyZWF0b3JUeXBlc1sxXSxcblx0W2l0ZW1UeXBlc1syNV1dOiBjcmVhdG9yVHlwZXNbMV0sXG5cdFtpdGVtVHlwZXNbMjZdXTogY3JlYXRvclR5cGVzWzE3XSxcblx0W2l0ZW1UeXBlc1syN11dOiBjcmVhdG9yVHlwZXNbMjRdLFxuXHRbaXRlbVR5cGVzWzI4XV06IGNyZWF0b3JUeXBlc1s4XSxcblx0W2l0ZW1UeXBlc1syOV1dOiBjcmVhdG9yVHlwZXNbOF0sXG5cdFtpdGVtVHlwZXNbMzBdXTogY3JlYXRvclR5cGVzWzhdLFxuXHRbaXRlbVR5cGVzWzMxXV06IGNyZWF0b3JUeXBlc1syNl0sXG5cdFtpdGVtVHlwZXNbMzJdXTogY3JlYXRvclR5cGVzWzIxXSxcblx0W2l0ZW1UeXBlc1szM11dOiBjcmVhdG9yVHlwZXNbMV0sXG5cdFtpdGVtVHlwZXNbMzRdXTogY3JlYXRvclR5cGVzWzFdLFxuXHRbaXRlbVR5cGVzWzM1XV06IGNyZWF0b3JUeXBlc1sxXSxcblx0W2l0ZW1UeXBlc1szNl1dOiBjcmVhdG9yVHlwZXNbMV1cbn07XG4iLCIndXNlIHN0cmljdCc7XG5cbmNvbnN0IGZpZWxkcyA9IHtcblx0MTogJ3VybCcsXG5cdDI6ICdyaWdodHMnLFxuXHQzOiAnc2VyaWVzJyxcblx0NDogJ3ZvbHVtZScsXG5cdDU6ICdpc3N1ZScsXG5cdDY6ICdlZGl0aW9uJyxcblx0NzogJ3BsYWNlJyxcblx0ODogJ3B1Ymxpc2hlcicsXG5cdDEwOiAncGFnZXMnLFxuXHQxMTogJ0lTQk4nLFxuXHQxMjogJ3B1YmxpY2F0aW9uVGl0bGUnLFxuXHQxMzogJ0lTU04nLFxuXHQxNDogJ2RhdGUnLFxuXHQxNTogJ3NlY3Rpb24nLFxuXHQxODogJ2NhbGxOdW1iZXInLFxuXHQxOTogJ2FyY2hpdmVMb2NhdGlvbicsXG5cdDIxOiAnZGlzdHJpYnV0b3InLFxuXHQyMjogJ2V4dHJhJyxcblx0MjU6ICdqb3VybmFsQWJicmV2aWF0aW9uJyxcblx0MjY6ICdET0knLFxuXHQyNzogJ2FjY2Vzc0RhdGUnLFxuXHQyODogJ3Nlcmllc1RpdGxlJyxcblx0Mjk6ICdzZXJpZXNUZXh0Jyxcblx0MzA6ICdzZXJpZXNOdW1iZXInLFxuXHQzMTogJ2luc3RpdHV0aW9uJyxcblx0MzI6ICdyZXBvcnRUeXBlJyxcblx0MzY6ICdjb2RlJyxcblx0NDA6ICdzZXNzaW9uJyxcblx0NDE6ICdsZWdpc2xhdGl2ZUJvZHknLFxuXHQ0MjogJ2hpc3RvcnknLFxuXHQ0MzogJ3JlcG9ydGVyJyxcblx0NDQ6ICdjb3VydCcsXG5cdDQ1OiAnbnVtYmVyT2ZWb2x1bWVzJyxcblx0NDY6ICdjb21taXR0ZWUnLFxuXHQ0ODogJ2Fzc2lnbmVlJyxcblx0NTA6ICdwYXRlbnROdW1iZXInLFxuXHQ1MTogJ3ByaW9yaXR5TnVtYmVycycsXG5cdDUyOiAnaXNzdWVEYXRlJyxcblx0NTM6ICdyZWZlcmVuY2VzJyxcblx0NTQ6ICdsZWdhbFN0YXR1cycsXG5cdDU1OiAnY29kZU51bWJlcicsXG5cdDU5OiAnYXJ0d29ya01lZGl1bScsXG5cdDYwOiAnbnVtYmVyJyxcblx0NjE6ICdhcnR3b3JrU2l6ZScsXG5cdDYyOiAnbGlicmFyeUNhdGFsb2cnLFxuXHQ2MzogJ3ZpZGVvUmVjb3JkaW5nRm9ybWF0Jyxcblx0NjQ6ICdpbnRlcnZpZXdNZWRpdW0nLFxuXHQ2NTogJ2xldHRlclR5cGUnLFxuXHQ2NjogJ21hbnVzY3JpcHRUeXBlJyxcblx0Njc6ICdtYXBUeXBlJyxcblx0Njg6ICdzY2FsZScsXG5cdDY5OiAndGhlc2lzVHlwZScsXG5cdDcwOiAnd2Vic2l0ZVR5cGUnLFxuXHQ3MTogJ2F1ZGlvUmVjb3JkaW5nRm9ybWF0Jyxcblx0NzI6ICdsYWJlbCcsXG5cdDc0OiAncHJlc2VudGF0aW9uVHlwZScsXG5cdDc1OiAnbWVldGluZ05hbWUnLFxuXHQ3NjogJ3N0dWRpbycsXG5cdDc3OiAncnVubmluZ1RpbWUnLFxuXHQ3ODogJ25ldHdvcmsnLFxuXHQ3OTogJ3Bvc3RUeXBlJyxcblx0ODA6ICdhdWRpb0ZpbGVUeXBlJyxcblx0ODE6ICd2ZXJzaW9uTnVtYmVyJyxcblx0ODI6ICdzeXN0ZW0nLFxuXHQ4MzogJ2NvbXBhbnknLFxuXHQ4NDogJ2NvbmZlcmVuY2VOYW1lJyxcblx0ODU6ICdlbmN5Y2xvcGVkaWFUaXRsZScsXG5cdDg2OiAnZGljdGlvbmFyeVRpdGxlJyxcblx0ODc6ICdsYW5ndWFnZScsXG5cdDg4OiAncHJvZ3JhbW1pbmdMYW5ndWFnZScsXG5cdDg5OiAndW5pdmVyc2l0eScsXG5cdDkwOiAnYWJzdHJhY3ROb3RlJyxcblx0OTE6ICd3ZWJzaXRlVGl0bGUnLFxuXHQ5MjogJ3JlcG9ydE51bWJlcicsXG5cdDkzOiAnYmlsbE51bWJlcicsXG5cdDk0OiAnY29kZVZvbHVtZScsXG5cdDk1OiAnY29kZVBhZ2VzJyxcblx0OTY6ICdkYXRlRGVjaWRlZCcsXG5cdDk3OiAncmVwb3J0ZXJWb2x1bWUnLFxuXHQ5ODogJ2ZpcnN0UGFnZScsXG5cdDk5OiAnZG9jdW1lbnROdW1iZXInLFxuXHQxMDA6ICdkYXRlRW5hY3RlZCcsXG5cdDEwMTogJ3B1YmxpY0xhd051bWJlcicsXG5cdDEwMjogJ2NvdW50cnknLFxuXHQxMDM6ICdhcHBsaWNhdGlvbk51bWJlcicsXG5cdDEwNDogJ2ZvcnVtVGl0bGUnLFxuXHQxMDU6ICdlcGlzb2RlTnVtYmVyJyxcblx0MTA3OiAnYmxvZ1RpdGxlJyxcblx0MTA4OiAndHlwZScsXG5cdDEwOTogJ21lZGl1bScsXG5cdDExMDogJ3RpdGxlJyxcblx0MTExOiAnY2FzZU5hbWUnLFxuXHQxMTI6ICduYW1lT2ZBY3QnLFxuXHQxMTM6ICdzdWJqZWN0Jyxcblx0MTE0OiAncHJvY2VlZGluZ3NUaXRsZScsXG5cdDExNTogJ2Jvb2tUaXRsZScsXG5cdDExNjogJ3Nob3J0VGl0bGUnLFxuXHQxMTc6ICdkb2NrZXROdW1iZXInLFxuXHQxMTg6ICdudW1QYWdlcycsXG5cdDExOTogJ3Byb2dyYW1UaXRsZScsXG5cdDEyMDogJ2lzc3VpbmdBdXRob3JpdHknLFxuXHQxMjE6ICdmaWxpbmdEYXRlJyxcblx0MTIyOiAnZ2VucmUnLFxuXHQxMjM6ICdhcmNoaXZlJ1xufTtcblxuLy9yZXZlcnNlIGxvb2t1cFxuT2JqZWN0LmtleXMoZmllbGRzKS5tYXAoayA9PiBmaWVsZHNbZmllbGRzW2tdXSA9IGspO1xuXG5tb2R1bGUuZXhwb3J0cyA9IGZpZWxkcztcbiIsIi8qIGdsb2JhbCBDU0w6ZmFsc2UgKi9cbid1c2Ugc3RyaWN0JztcblxuY29uc3Qge1xuXHRDU0xfTkFNRVNfTUFQUElOR1MsXG5cdENTTF9URVhUX01BUFBJTkdTLFxuXHRDU0xfREFURV9NQVBQSU5HUyxcblx0Q1NMX1RZUEVfTUFQUElOR1Ncbn0gPSByZXF1aXJlKCcuL2NzbC1tYXBwaW5ncycpO1xuXG5jb25zdCB7IGdldEZpZWxkSURGcm9tVHlwZUFuZEJhc2UgfSA9IHJlcXVpcmUoJy4vdHlwZS1zcGVjaWZpYy1maWVsZC1tYXAnKTtcbmNvbnN0IGZpZWxkcyA9IHJlcXVpcmUoJy4vZmllbGRzJyk7XG5jb25zdCBpdGVtVHlwZXMgPSByZXF1aXJlKCcuL2l0ZW0tdHlwZXMnKTtcbmNvbnN0IHN0clRvRGF0ZSA9IHJlcXVpcmUoJy4vc3RyLXRvLWRhdGUnKTtcbmNvbnN0IGRlZmF1bHRJdGVtVHlwZUNyZWF0b3JUeXBlTG9va3VwID0gcmVxdWlyZSgnLi9kZWZhdWx0LWl0ZW0tdHlwZS1jcmVhdG9yLXR5cGUtbG9va3VwJyk7XG5cbm1vZHVsZS5leHBvcnRzID0gem90ZXJvSXRlbSA9PiB7XG5cdHZhciBjc2xUeXBlID0gQ1NMX1RZUEVfTUFQUElOR1Nbem90ZXJvSXRlbS5pdGVtVHlwZV07XG5cdGlmICghY3NsVHlwZSkge1xuXHRcdHRocm93IG5ldyBFcnJvcignVW5leHBlY3RlZCBab3Rlcm8gSXRlbSB0eXBlIFwiJyArIHpvdGVyb0l0ZW0uaXRlbVR5cGUgKyAnXCInKTtcblx0fVxuXG5cdHZhciBpdGVtVHlwZUlEID0gaXRlbVR5cGVzW3pvdGVyb0l0ZW0uaXRlbVR5cGVdO1xuXG5cdHZhciBjc2xJdGVtID0ge1xuXHRcdC8vICdpZCc6em90ZXJvSXRlbS51cmksXG5cdFx0aWQ6IHpvdGVyb0l0ZW0ua2V5LFxuXHRcdCd0eXBlJzpjc2xUeXBlXG5cdH07XG5cblx0Ly8gZ2V0IGFsbCB0ZXh0IHZhcmlhYmxlcyAodGhlcmUgbXVzdCBiZSBhIGJldHRlciB3YXkpXG5cdGZvcihsZXQgdmFyaWFibGUgaW4gQ1NMX1RFWFRfTUFQUElOR1MpIHtcblx0XHRsZXQgZmllbGRzID0gQ1NMX1RFWFRfTUFQUElOR1NbdmFyaWFibGVdO1xuXHRcdGZvcihsZXQgaT0wLCBuPWZpZWxkcy5sZW5ndGg7IGk8bjsgaSsrKSB7XG5cdFx0XHRsZXQgZmllbGQgPSBmaWVsZHNbaV0sXG5cdFx0XHRcdHZhbHVlID0gbnVsbDtcblxuXHRcdFx0aWYoZmllbGQgaW4gem90ZXJvSXRlbSkge1xuXHRcdFx0XHR2YWx1ZSA9IHpvdGVyb0l0ZW1bZmllbGRdO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0Ly8gQE5PVEU6IERvZXMgdGhpcyBuZWVkIHBvcnRpbmc/XG5cdFx0XHRcdC8vIGlmIChmaWVsZCA9PSAndmVyc2lvbk51bWJlcicpIHtcblx0XHRcdFx0Ly8gXHRmaWVsZCA9ICd2ZXJzaW9uJzsgLy8gVW50aWwgaHR0cHM6Ly9naXRodWIuY29tL3pvdGVyby96b3Rlcm8vaXNzdWVzLzY3MFxuXHRcdFx0XHQvLyB9XG5cdFx0XHRcdC8vIHZhciBmaWVsZElEID0gWm90ZXJvLkl0ZW1GaWVsZHMuZ2V0SUQoZmllbGQpLFxuXHRcdFx0XHQvLyBcdHR5cGVGaWVsZElEO1xuXHRcdFx0XHQvLyBpZihmaWVsZElEXG5cdFx0XHRcdC8vIFx0JiYgKHR5cGVGaWVsZElEID0gWm90ZXJvLkl0ZW1GaWVsZHMuZ2V0RmllbGRJREZyb21UeXBlQW5kQmFzZShpdGVtVHlwZUlELCBmaWVsZElEKSlcblx0XHRcdFx0Ly8gKSB7XG5cdFx0XHRcdC8vIFx0dmFsdWUgPSB6b3Rlcm9JdGVtW1pvdGVyby5JdGVtRmllbGRzLmdldE5hbWUodHlwZUZpZWxkSUQpXTtcblx0XHRcdFx0Ly8gfVxuXHRcdFx0fVxuXG5cdFx0XHRpZiAoIXZhbHVlKSBjb250aW51ZTtcblxuXHRcdFx0aWYgKHR5cGVvZiB2YWx1ZSA9PSAnc3RyaW5nJykge1xuXHRcdFx0XHRpZiAoZmllbGQgPT0gJ0lTQk4nKSB7XG5cdFx0XHRcdFx0Ly8gT25seSB1c2UgdGhlIGZpcnN0IElTQk4gaW4gQ1NMIEpTT05cblx0XHRcdFx0XHR2YXIgaXNibiA9IHZhbHVlLm1hdGNoKC9eKD86OTdbODldLT8pPyg/OlxcZC0/KXs5fVtcXGR4XSg/IS0pXFxiL2kpO1xuXHRcdFx0XHRcdGlmKGlzYm4pIHtcblx0XHRcdFx0XHRcdHZhbHVlID0gaXNiblswXTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblxuXHRcdFx0XHQvLyBTdHJpcCBlbmNsb3NpbmcgcXVvdGVzXG5cdFx0XHRcdGlmKHZhbHVlLmNoYXJBdCgwKSA9PSAnXCInICYmIHZhbHVlLmluZGV4T2YoJ1wiJywgMSkgPT0gdmFsdWUubGVuZ3RoIC0gMSkge1xuXHRcdFx0XHRcdHZhbHVlID0gdmFsdWUuc3Vic3RyaW5nKDEsIHZhbHVlLmxlbmd0aCAtIDEpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGNzbEl0ZW1bdmFyaWFibGVdID0gdmFsdWU7XG5cdFx0XHRcdGJyZWFrO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdC8vIHNlcGFyYXRlIG5hbWUgdmFyaWFibGVzXG5cdGlmICh6b3Rlcm9JdGVtLnR5cGUgIT0gJ2F0dGFjaG1lbnQnICYmIHpvdGVyb0l0ZW0udHlwZSAhPSAnbm90ZScpIHtcblx0XHQvLyB2YXIgYXV0aG9yID0gWm90ZXJvLkNyZWF0b3JUeXBlcy5nZXROYW1lKFpvdGVyby5DcmVhdG9yVHlwZXMuZ2V0UHJpbWFyeUlERm9yVHlwZSgpKTtcblx0XHRsZXQgYXV0aG9yID0gZGVmYXVsdEl0ZW1UeXBlQ3JlYXRvclR5cGVMb29rdXBbaXRlbVR5cGVJRF07XG5cdFx0bGV0IGNyZWF0b3JzID0gem90ZXJvSXRlbS5jcmVhdG9ycztcblx0XHRmb3IobGV0IGkgPSAwOyBjcmVhdG9ycyAmJiBpIDwgY3JlYXRvcnMubGVuZ3RoOyBpKyspIHtcblx0XHRcdGxldCBjcmVhdG9yID0gY3JlYXRvcnNbaV07XG5cdFx0XHRsZXQgY3JlYXRvclR5cGUgPSBjcmVhdG9yLmNyZWF0b3JUeXBlO1xuXHRcdFx0bGV0IG5hbWVPYmo7XG5cblx0XHRcdGlmKGNyZWF0b3JUeXBlID09IGF1dGhvcikge1xuXHRcdFx0XHRjcmVhdG9yVHlwZSA9ICdhdXRob3InO1xuXHRcdFx0fVxuXG5cdFx0XHRjcmVhdG9yVHlwZSA9IENTTF9OQU1FU19NQVBQSU5HU1tjcmVhdG9yVHlwZV07XG5cdFx0XHRpZighY3JlYXRvclR5cGUpIHtcblx0XHRcdFx0Y29udGludWU7XG5cdFx0XHR9XG5cblx0XHRcdGlmICgnbGFzdE5hbWUnIGluIGNyZWF0b3IgfHwgJ2ZpcnN0TmFtZScgaW4gY3JlYXRvcikge1xuXHRcdFx0XHRuYW1lT2JqID0ge1xuXHRcdFx0XHRcdGZhbWlseTogY3JlYXRvci5sYXN0TmFtZSB8fCAnJyxcblx0XHRcdFx0XHRnaXZlbjogY3JlYXRvci5maXJzdE5hbWUgfHwgJydcblx0XHRcdFx0fTtcblxuXHRcdFx0XHQvLyBQYXJzZSBuYW1lIHBhcnRpY2xlc1xuXHRcdFx0XHQvLyBSZXBsaWNhdGUgY2l0ZXByb2MtanMgbG9naWMgZm9yIHdoYXQgc2hvdWxkIGJlIHBhcnNlZCBzbyB3ZSBkb24ndFxuXHRcdFx0XHQvLyBicmVhayBjdXJyZW50IGJlaGF2aW9yLlxuXHRcdFx0XHRpZiAobmFtZU9iai5mYW1pbHkgJiYgbmFtZU9iai5naXZlbikge1xuXHRcdFx0XHRcdC8vIERvbid0IHBhcnNlIGlmIGxhc3QgbmFtZSBpcyBxdW90ZWRcblx0XHRcdFx0XHRpZiAobmFtZU9iai5mYW1pbHkubGVuZ3RoID4gMVxuXHRcdFx0XHRcdFx0JiYgbmFtZU9iai5mYW1pbHkuY2hhckF0KDApID09ICdcIidcblx0XHRcdFx0XHRcdCYmIG5hbWVPYmouZmFtaWx5LmNoYXJBdChuYW1lT2JqLmZhbWlseS5sZW5ndGggLSAxKSA9PSAnXCInXG5cdFx0XHRcdFx0KSB7XG5cdFx0XHRcdFx0XHRuYW1lT2JqLmZhbWlseSA9IG5hbWVPYmouZmFtaWx5LnN1YnN0cigxLCBuYW1lT2JqLmZhbWlseS5sZW5ndGggLSAyKTtcblx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0Q1NMLnBhcnNlUGFydGljbGVzKG5hbWVPYmosIHRydWUpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fSBlbHNlIGlmICgnbmFtZScgaW4gY3JlYXRvcikge1xuXHRcdFx0XHRuYW1lT2JqID0geydsaXRlcmFsJzogY3JlYXRvci5uYW1lfTtcblx0XHRcdH1cblxuXHRcdFx0aWYoY3NsSXRlbVtjcmVhdG9yVHlwZV0pIHtcblx0XHRcdFx0Y3NsSXRlbVtjcmVhdG9yVHlwZV0ucHVzaChuYW1lT2JqKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdGNzbEl0ZW1bY3JlYXRvclR5cGVdID0gW25hbWVPYmpdO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdC8vIGdldCBkYXRlIHZhcmlhYmxlc1xuXHRmb3IobGV0IHZhcmlhYmxlIGluIENTTF9EQVRFX01BUFBJTkdTKSB7XG5cdFx0bGV0IGRhdGUgPSB6b3Rlcm9JdGVtW0NTTF9EQVRFX01BUFBJTkdTW3ZhcmlhYmxlXV07XG5cdFx0aWYgKCFkYXRlKSB7XG5cblx0XHRcdGxldCB0eXBlU3BlY2lmaWNGaWVsZElEID0gZ2V0RmllbGRJREZyb21UeXBlQW5kQmFzZShpdGVtVHlwZUlELCBDU0xfREFURV9NQVBQSU5HU1t2YXJpYWJsZV0pO1xuXHRcdFx0aWYgKHR5cGVTcGVjaWZpY0ZpZWxkSUQpIHtcblx0XHRcdFx0ZGF0ZSA9IHpvdGVyb0l0ZW1bZmllbGRzW3R5cGVTcGVjaWZpY0ZpZWxkSURdXTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRpZihkYXRlKSB7XG5cdFx0XHRsZXQgZGF0ZU9iaiA9IHN0clRvRGF0ZShkYXRlKTtcblx0XHRcdC8vIG90aGVyd2lzZSwgdXNlIGRhdGUtcGFydHNcblx0XHRcdGxldCBkYXRlUGFydHMgPSBbXTtcblx0XHRcdGlmKGRhdGVPYmoueWVhcikge1xuXHRcdFx0XHQvLyBhZGQgeWVhciwgbW9udGgsIGFuZCBkYXksIGlmIHRoZXkgZXhpc3Rcblx0XHRcdFx0ZGF0ZVBhcnRzLnB1c2goZGF0ZU9iai55ZWFyKTtcblx0XHRcdFx0aWYoZGF0ZU9iai5tb250aCAhPT0gdW5kZWZpbmVkKSB7XG5cdFx0XHRcdFx0ZGF0ZVBhcnRzLnB1c2goZGF0ZU9iai5tb250aCsxKTtcblx0XHRcdFx0XHRpZihkYXRlT2JqLmRheSkge1xuXHRcdFx0XHRcdFx0ZGF0ZVBhcnRzLnB1c2goZGF0ZU9iai5kYXkpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0XHRjc2xJdGVtW3ZhcmlhYmxlXSA9IHsnZGF0ZS1wYXJ0cyc6W2RhdGVQYXJ0c119O1xuXG5cdFx0XHRcdC8vIGlmIG5vIG1vbnRoLCB1c2Ugc2Vhc29uIGFzIG1vbnRoXG5cdFx0XHRcdGlmKGRhdGVPYmoucGFydCAmJiBkYXRlT2JqLm1vbnRoID09PSB1bmRlZmluZWQpIHtcblx0XHRcdFx0XHRjc2xJdGVtW3ZhcmlhYmxlXS5zZWFzb24gPSBkYXRlT2JqLnBhcnQ7XG5cdFx0XHRcdH1cblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdC8vIGlmIG5vIHllYXIsIHBhc3MgZGF0ZSBsaXRlcmFsbHlcblx0XHRcdFx0Y3NsSXRlbVt2YXJpYWJsZV0gPSB7J2xpdGVyYWwnOmRhdGV9O1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdC8vIFNwZWNpYWwgbWFwcGluZyBmb3Igbm90ZSB0aXRsZVxuXHQvLyBATk9URTogTm90IHBvcnRlZFxuXHQvLyBpZiAoem90ZXJvSXRlbS5pdGVtVHlwZSA9PSAnbm90ZScgJiYgem90ZXJvSXRlbS5ub3RlKSB7XG5cdC8vIFx0Y3NsSXRlbS50aXRsZSA9IFpvdGVyby5Ob3Rlcy5ub3RlVG9UaXRsZSh6b3Rlcm9JdGVtLm5vdGUpO1xuXHQvLyB9XG5cblx0Ly90aGlzLl9jYWNoZVt6b3Rlcm9JdGVtLmlkXSA9IGNzbEl0ZW07XG5cdHJldHVybiBjc2xJdGVtO1xufVxuIiwiJ3VzZSBzdHJpY3QnO1xuXG5jb25zdCBpdGVtVHlwZXMgPSB7XG5cdDE6ICdub3RlJyxcblx0MjogJ2Jvb2snLFxuXHQzOiAnYm9va1NlY3Rpb24nLFxuXHQ0OiAnam91cm5hbEFydGljbGUnLFxuXHQ1OiAnbWFnYXppbmVBcnRpY2xlJyxcblx0NjogJ25ld3NwYXBlckFydGljbGUnLFxuXHQ3OiAndGhlc2lzJyxcblx0ODogJ2xldHRlcicsXG5cdDk6ICdtYW51c2NyaXB0Jyxcblx0MTA6ICdpbnRlcnZpZXcnLFxuXHQxMTogJ2ZpbG0nLFxuXHQxMjogJ2FydHdvcmsnLFxuXHQxMzogJ3dlYnBhZ2UnLFxuXHQxNDogJ2F0dGFjaG1lbnQnLFxuXHQxNTogJ3JlcG9ydCcsXG5cdDE2OiAnYmlsbCcsXG5cdDE3OiAnY2FzZScsXG5cdDE4OiAnaGVhcmluZycsXG5cdDE5OiAncGF0ZW50Jyxcblx0MjA6ICdzdGF0dXRlJyxcblx0MjE6ICdlbWFpbCcsXG5cdDIyOiAnbWFwJyxcblx0MjM6ICdibG9nUG9zdCcsXG5cdDI0OiAnaW5zdGFudE1lc3NhZ2UnLFxuXHQyNTogJ2ZvcnVtUG9zdCcsXG5cdDI2OiAnYXVkaW9SZWNvcmRpbmcnLFxuXHQyNzogJ3ByZXNlbnRhdGlvbicsXG5cdDI4OiAndmlkZW9SZWNvcmRpbmcnLFxuXHQyOTogJ3R2QnJvYWRjYXN0Jyxcblx0MzA6ICdyYWRpb0Jyb2FkY2FzdCcsXG5cdDMxOiAncG9kY2FzdCcsXG5cdDMyOiAnY29tcHV0ZXJQcm9ncmFtJyxcblx0MzM6ICdjb25mZXJlbmNlUGFwZXInLFxuXHQzNDogJ2RvY3VtZW50Jyxcblx0MzU6ICdlbmN5Y2xvcGVkaWFBcnRpY2xlJyxcblx0MzY6ICdkaWN0aW9uYXJ5RW50cnknXG59O1xuXG4vL3JldmVyc2UgbG9va3VwXG5PYmplY3Qua2V5cyhpdGVtVHlwZXMpLm1hcChrID0+IGl0ZW1UeXBlc1tpdGVtVHlwZXNba11dID0gayk7XG5tb2R1bGUuZXhwb3J0cyA9IGl0ZW1UeXBlcztcbiIsIid1c2Ugc3RyaWN0JztcblxubW9kdWxlLmV4cG9ydHMgPSAoc3RyaW5nLCBwYWQsIGxlbmd0aCkgPT4ge1xuXHRzdHJpbmcgPSBzdHJpbmcgPyBzdHJpbmcgKyAnJyA6ICcnO1xuXHR3aGlsZShzdHJpbmcubGVuZ3RoIDwgbGVuZ3RoKSB7XG5cdFx0c3RyaW5nID0gcGFkICsgc3RyaW5nO1xuXHR9XG5cdHJldHVybiBzdHJpbmc7XG59XG4iLCIndXNlIHN0cmljdCc7XG5cbmNvbnN0IGRhdGVUb1NRTCA9IHJlcXVpcmUoJy4vZGF0ZS10by1zcWwnKTtcblxuY29uc3QgbW9udGhzID0gWydqYW4nLCAnZmViJywgJ21hcicsICdhcHInLCAnbWF5JywgJ2p1bicsICdqdWwnLCAnYXVnJywgJ3NlcCcsICdvY3QnLCAnbm92JywgJ2RlYycsICdqYW51YXJ5JywgJ2ZlYnJ1YXJ5JywgJ21hcmNoJywgJ2FwcmlsJywgJ21heScsICdqdW5lJywgJ2p1bHknLCAnYXVndXN0JywgJ3NlcHRlbWJlcicsICdvY3RvYmVyJywgJ25vdmVtYmVyJywgJ2RlY2VtYmVyJ107XG5cbmNvbnN0IF9zbGFzaFJlID0gL14oLio/KVxcYihbMC05XXsxLDR9KSg/OihbXFwtXFwvXFwuXFx1NWU3NF0pKFswLTldezEsMn0pKT8oPzooW1xcLVxcL1xcLlxcdTY3MDhdKShbMC05XXsxLDR9KSk/KCg/OlxcYnxbXjAtOV0pLio/KSQvXG5jb25zdCBfeWVhclJlID0gL14oLio/KVxcYigoPzpjaXJjYSB8YXJvdW5kIHxhYm91dCB8Y1xcLj8gPyk/WzAtOV17MSw0fSg/OiA/QlxcLj8gP0NcXC4/KD86ID9FXFwuPyk/fCA/Q1xcLj8gP0VcXC4/fCA/QVxcLj8gP0RcXC4/KXxbMC05XXszLDR9KVxcYiguKj8pJC9pO1xuY29uc3QgX21vbnRoUmUgPSBuZXcgUmVnRXhwKCdeKC4qKVxcXFxiKCcgKyBtb250aHMuam9pbignfCcpICsgJylbXiBdKig/OiAoLiopJHwkKScsICdpJyk7XG5jb25zdCBfZGF5UmUgPSBuZXcgUmVnRXhwKCdcXFxcYihbMC05XXsxLDJ9KSg/OnN0fG5kfHJkfHRoKT9cXFxcYiguKiknLCAnaScpO1xuXG5jb25zdCBfaW5zZXJ0RGF0ZU9yZGVyUGFydCA9IChkYXRlT3JkZXIsIHBhcnQsIHBhcnRPcmRlcikgPT4ge1xuXHRcdGlmICghZGF0ZU9yZGVyKSB7XG5cdFx0XHRyZXR1cm4gcGFydDtcblx0XHR9XG5cdFx0aWYgKHBhcnRPcmRlci5iZWZvcmUgPT09IHRydWUpIHtcblx0XHRcdHJldHVybiBwYXJ0ICsgZGF0ZU9yZGVyO1xuXHRcdH1cblx0XHRpZiAocGFydE9yZGVyLmFmdGVyID09PSB0cnVlKSB7XG5cdFx0XHRyZXR1cm4gZGF0ZU9yZGVyICsgcGFydDtcblx0XHR9XG5cdFx0aWYgKHBhcnRPcmRlci5iZWZvcmUpIHtcblx0XHRcdGxldCBwb3MgPSBkYXRlT3JkZXIuaW5kZXhPZihwYXJ0T3JkZXIuYmVmb3JlKTtcblx0XHRcdGlmIChwb3MgPT0gLTEpIHtcblx0XHRcdFx0cmV0dXJuIGRhdGVPcmRlcjtcblx0XHRcdH1cblx0XHRcdHJldHVybiBkYXRlT3JkZXIucmVwbGFjZShuZXcgUmVnRXhwKCcoJyArIHBhcnRPcmRlci5iZWZvcmUgKyAnKScpLCBwYXJ0ICsgJyQxJyk7XG5cdFx0fVxuXHRcdGlmIChwYXJ0T3JkZXIuYWZ0ZXIpIHtcblx0XHRcdGxldCBwb3MgPSBkYXRlT3JkZXIuaW5kZXhPZihwYXJ0T3JkZXIuYWZ0ZXIpO1xuXHRcdFx0aWYgKHBvcyA9PSAtMSkge1xuXHRcdFx0XHRyZXR1cm4gZGF0ZU9yZGVyICsgcGFydDtcblx0XHRcdH1cblx0XHRcdHJldHVybiBkYXRlT3JkZXIucmVwbGFjZShuZXcgUmVnRXhwKCcoJyArIHBhcnRPcmRlci5hZnRlciArICcpJyksICckMScgKyBwYXJ0KTtcblx0XHR9XG5cdFx0cmV0dXJuIGRhdGVPcmRlciArIHBhcnQ7XG59XG5cbm1vZHVsZS5leHBvcnRzID0gc3RyaW5nID0+IHtcblx0dmFyIGRhdGUgPSB7XG5cdFx0b3JkZXI6ICcnXG5cdH07XG5cblx0Ly8gc2tpcCBlbXB0eSB0aGluZ3Ncblx0aWYoIXN0cmluZykge1xuXHRcdHJldHVybiBkYXRlO1xuXHR9XG5cblx0dmFyIHBhcnRzID0gW107XG5cblx0Ly8gUGFyc2UgJ3llc3RlcmRheScvJ3RvZGF5Jy8ndG9tb3Jyb3cnXG5cdGxldCBsYyA9IChzdHJpbmcgKyAnJykudG9Mb3dlckNhc2UoKTtcblx0aWYgKGxjID09ICd5ZXN0ZXJkYXknKSB7XG5cdFx0c3RyaW5nID0gZGF0ZVRvU1FMKG5ldyBEYXRlKERhdGUubm93KCkgLSAxMDAwKjYwKjYwKjI0KSkuc3Vic3RyKDAsIDEwKTtcblx0fVxuXHRlbHNlIGlmIChsYyA9PSAndG9kYXknKSB7XG5cdFx0c3RyaW5nID0gZGF0ZVRvU1FMKG5ldyBEYXRlKCkpLnN1YnN0cigwLCAxMCk7XG5cdH1cblx0ZWxzZSBpZiAobGMgPT0gJ3RvbW9ycm93Jykge1xuXHRcdHN0cmluZyA9IGRhdGVUb1NRTChuZXcgRGF0ZShEYXRlLm5vdygpICsgMTAwMCo2MCo2MCoyNCkpLnN1YnN0cigwLCAxMCk7XG5cdH1cblx0ZWxzZSB7XG5cdFx0c3RyaW5nID0gc3RyaW5nLnRvU3RyaW5nKCkucmVwbGFjZSgvXlxccyt8XFxzKyQvZywgJycpLnJlcGxhY2UoL1xccysvLCAnICcpO1xuXHR9XG5cblx0Ly8gZmlyc3QsIGRpcmVjdGx5IGluc3BlY3QgdGhlIHN0cmluZ1xuXHRsZXQgbSA9IF9zbGFzaFJlLmV4ZWMoc3RyaW5nKTtcblx0aWYobSAmJlxuXHRcdCgoIW1bNV0gfHwgIW1bM10pIHx8IG1bM10gPT0gbVs1XSB8fCAobVszXSA9PSAnXFx1NWU3NCcgJiYgbVs1XSA9PSAnXFx1NjcwOCcpKSAmJlx0Ly8gcmVxdWlyZSBzYW5lIHNlcGFyYXRvcnNcblx0XHQoKG1bMl0gJiYgbVs0XSAmJiBtWzZdKSB8fCAoIW1bMV0gJiYgIW1bN10pKSkge1x0XHRcdFx0XHRcdC8vIHJlcXVpcmUgdGhhdCBlaXRoZXIgYWxsIHBhcnRzIGFyZSBmb3VuZCxcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0Ly8gb3IgZWxzZSB0aGlzIGlzIHRoZSBlbnRpcmUgZGF0ZSBmaWVsZFxuXHRcdC8vIGZpZ3VyZSBvdXQgZGF0ZSBiYXNlZCBvbiBwYXJ0c1xuXHRcdGlmKG1bMl0ubGVuZ3RoID09IDMgfHwgbVsyXS5sZW5ndGggPT0gNCB8fCBtWzNdID09ICdcXHU1ZTc0Jykge1xuXHRcdFx0Ly8gSVNPIDg2MDEgc3R5bGUgZGF0ZSAoYmlnIGVuZGlhbilcblx0XHRcdGRhdGUueWVhciA9IG1bMl07XG5cdFx0XHRkYXRlLm1vbnRoID0gbVs0XTtcblx0XHRcdGRhdGUuZGF5ID0gbVs2XTtcblx0XHRcdGRhdGUub3JkZXIgKz0gbVsyXSA/ICd5JyA6ICcnO1xuXHRcdFx0ZGF0ZS5vcmRlciArPSBtWzRdID8gJ20nIDogJyc7XG5cdFx0XHRkYXRlLm9yZGVyICs9IG1bNl0gPyAnZCcgOiAnJztcblx0XHR9IGVsc2UgaWYobVsyXSAmJiAhbVs0XSAmJiBtWzZdKSB7XG5cdFx0XHRkYXRlLm1vbnRoID0gbVsyXTtcblx0XHRcdGRhdGUueWVhciA9IG1bNl07XG5cdFx0XHRkYXRlLm9yZGVyICs9IG1bMl0gPyAnbScgOiAnJztcblx0XHRcdGRhdGUub3JkZXIgKz0gbVs2XSA/ICd5JyA6ICcnO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHQvLyBsb2NhbCBzdHlsZSBkYXRlIChtaWRkbGUgb3IgbGl0dGxlIGVuZGlhbilcblx0XHRcdHZhciBjb3VudHJ5ID0gd2luZG93Lm5hdmlnYXRvci5sYW5ndWFnZSA/IHdpbmRvdy5uYXZpZ2F0b3IubGFuZ3VhZ2Uuc3Vic3RyKDMpIDogJ1VTJztcblx0XHRcdGlmKGNvdW50cnkgPT0gJ1VTJyB8fFx0Ly8gVGhlIFVuaXRlZCBTdGF0ZXNcblx0XHRcdFx0Y291bnRyeSA9PSAnRk0nIHx8XHQvLyBUaGUgRmVkZXJhdGVkIFN0YXRlcyBvZiBNaWNyb25lc2lhXG5cdFx0XHRcdGNvdW50cnkgPT0gJ1BXJyB8fFx0Ly8gUGFsYXVcblx0XHRcdFx0Y291bnRyeSA9PSAnUEgnKSB7XHQvLyBUaGUgUGhpbGlwcGluZXNcblx0XHRcdFx0XHRkYXRlLm1vbnRoID0gbVsyXTtcblx0XHRcdFx0XHRkYXRlLmRheSA9IG1bNF07XG5cdFx0XHRcdFx0ZGF0ZS5vcmRlciArPSBtWzJdID8gJ20nIDogJyc7XG5cdFx0XHRcdFx0ZGF0ZS5vcmRlciArPSBtWzRdID8gJ2QnIDogJyc7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRkYXRlLm1vbnRoID0gbVs0XTtcblx0XHRcdFx0ZGF0ZS5kYXkgPSBtWzJdO1xuXHRcdFx0XHRkYXRlLm9yZGVyICs9IG1bMl0gPyAnZCcgOiAnJztcblx0XHRcdFx0ZGF0ZS5vcmRlciArPSBtWzRdID8gJ20nIDogJyc7XG5cdFx0XHR9XG5cdFx0XHRkYXRlLnllYXIgPSBtWzZdO1xuXHRcdFx0ZGF0ZS5vcmRlciArPSAneSc7XG5cdFx0fVxuXG5cdFx0aWYoZGF0ZS55ZWFyKSB7XG5cdFx0XHRkYXRlLnllYXIgPSBwYXJzZUludChkYXRlLnllYXIsIDEwKTtcblx0XHR9XG5cdFx0aWYoZGF0ZS5kYXkpIHtcblx0XHRcdGRhdGUuZGF5ID0gcGFyc2VJbnQoZGF0ZS5kYXksIDEwKTtcblx0XHR9XG5cdFx0aWYoZGF0ZS5tb250aCkge1xuXHRcdFx0ZGF0ZS5tb250aCA9IHBhcnNlSW50KGRhdGUubW9udGgsIDEwKTtcblxuXHRcdFx0aWYoZGF0ZS5tb250aCA+IDEyKSB7XG5cdFx0XHRcdC8vIHN3YXAgZGF5IGFuZCBtb250aFxuXHRcdFx0XHR2YXIgdG1wID0gZGF0ZS5kYXk7XG5cdFx0XHRcdGRhdGUuZGF5ID0gZGF0ZS5tb250aFxuXHRcdFx0XHRkYXRlLm1vbnRoID0gdG1wO1xuXHRcdFx0XHRkYXRlLm9yZGVyID0gZGF0ZS5vcmRlci5yZXBsYWNlKCdtJywgJ0QnKVxuXHRcdFx0XHRcdC5yZXBsYWNlKCdkJywgJ00nKVxuXHRcdFx0XHRcdC5yZXBsYWNlKCdEJywgJ2QnKVxuXHRcdFx0XHRcdC5yZXBsYWNlKCdNJywgJ20nKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRpZigoIWRhdGUubW9udGggfHwgZGF0ZS5tb250aCA8PSAxMikgJiYgKCFkYXRlLmRheSB8fCBkYXRlLmRheSA8PSAzMSkpIHtcblx0XHRcdGlmKGRhdGUueWVhciAmJiBkYXRlLnllYXIgPCAxMDApIHtcdC8vIGZvciB0d28gZGlnaXQgeWVhcnMsIGRldGVybWluZSBwcm9wZXJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdC8vIGZvdXIgZGlnaXQgeWVhclxuXHRcdFx0XHR2YXIgdG9kYXkgPSBuZXcgRGF0ZSgpO1xuXHRcdFx0XHR2YXIgeWVhciA9IHRvZGF5LmdldEZ1bGxZZWFyKCk7XG5cdFx0XHRcdHZhciB0d29EaWdpdFllYXIgPSB5ZWFyICUgMTAwO1xuXHRcdFx0XHR2YXIgY2VudHVyeSA9IHllYXIgLSB0d29EaWdpdFllYXI7XG5cblx0XHRcdFx0aWYoZGF0ZS55ZWFyIDw9IHR3b0RpZ2l0WWVhcikge1xuXHRcdFx0XHRcdC8vIGFzc3VtZSB0aGlzIGRhdGUgaXMgZnJvbSBvdXIgY2VudHVyeVxuXHRcdFx0XHRcdGRhdGUueWVhciA9IGNlbnR1cnkgKyBkYXRlLnllYXI7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0Ly8gYXNzdW1lIHRoaXMgZGF0ZSBpcyBmcm9tIHRoZSBwcmV2aW91cyBjZW50dXJ5XG5cdFx0XHRcdFx0ZGF0ZS55ZWFyID0gY2VudHVyeSAtIDEwMCArIGRhdGUueWVhcjtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0XHRpZihkYXRlLm1vbnRoKSB7XG5cdFx0XHRcdGRhdGUubW9udGgtLTtcdFx0Ly8gc3VidHJhY3Qgb25lIGZvciBKUyBzdHlsZVxuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0ZGVsZXRlIGRhdGUubW9udGg7XG5cdFx0XHR9XG5cblx0XHRcdHBhcnRzLnB1c2goXG5cdFx0XHRcdHsgcGFydDogbVsxXSwgYmVmb3JlOiB0cnVlIH0sXG5cdFx0XHRcdHsgcGFydDogbVs3XSB9XG5cdFx0XHQpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHR2YXIgZGF0ZSA9IHtcblx0XHRcdFx0b3JkZXI6ICcnXG5cdFx0XHR9O1xuXHRcdFx0cGFydHMucHVzaCh7IHBhcnQ6IHN0cmluZyB9KTtcblx0XHR9XG5cdH0gZWxzZSB7XG5cdFx0cGFydHMucHVzaCh7IHBhcnQ6IHN0cmluZyB9KTtcblx0fVxuXG5cdC8vIGNvdWxkbid0IGZpbmQgc29tZXRoaW5nIHdpdGggdGhlIGFsZ29yaXRobXM7IHVzZSByZWdleHBcblx0Ly8gWUVBUlxuXHRpZighZGF0ZS55ZWFyKSB7XG5cdFx0Zm9yIChsZXQgaSBpbiBwYXJ0cykge1xuXHRcdFx0bGV0IG0gPSBfeWVhclJlLmV4ZWMocGFydHNbaV0ucGFydCk7XG5cdFx0XHRpZiAobSkge1xuXHRcdFx0XHRkYXRlLnllYXIgPSBtWzJdO1xuXHRcdFx0XHRkYXRlLm9yZGVyID0gX2luc2VydERhdGVPcmRlclBhcnQoZGF0ZS5vcmRlciwgJ3knLCBwYXJ0c1tpXSk7XG5cdFx0XHRcdHBhcnRzLnNwbGljZShcblx0XHRcdFx0XHRpLCAxLFxuXHRcdFx0XHRcdHsgcGFydDogbVsxXSwgYmVmb3JlOiB0cnVlIH0sXG5cdFx0XHRcdFx0eyBwYXJ0OiBtWzNdIH1cblx0XHRcdFx0KTtcblx0XHRcdFx0YnJlYWs7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0Ly8gTU9OVEhcblx0aWYoZGF0ZS5tb250aCA9PT0gdW5kZWZpbmVkKSB7XG5cdFx0Zm9yIChsZXQgaSBpbiBwYXJ0cykge1xuXHRcdFx0bGV0IG0gPSBfbW9udGhSZS5leGVjKHBhcnRzW2ldLnBhcnQpO1xuXHRcdFx0aWYgKG0pIHtcblx0XHRcdFx0Ly8gTW9kdWxvIDEyIGluIGNhc2Ugd2UgaGF2ZSBtdWx0aXBsZSBsYW5ndWFnZXNcblx0XHRcdFx0ZGF0ZS5tb250aCA9IG1vbnRocy5pbmRleE9mKG1bMl0udG9Mb3dlckNhc2UoKSkgJSAxMjtcblx0XHRcdFx0ZGF0ZS5vcmRlciA9IF9pbnNlcnREYXRlT3JkZXJQYXJ0KGRhdGUub3JkZXIsICdtJywgcGFydHNbaV0pO1xuXHRcdFx0XHRwYXJ0cy5zcGxpY2UoXG5cdFx0XHRcdFx0aSwgMSxcblx0XHRcdFx0XHR7IHBhcnQ6IG1bMV0sIGJlZm9yZTogJ20nIH0sXG5cdFx0XHRcdFx0eyBwYXJ0OiBtWzNdLCBhZnRlcjogJ20nIH1cblx0XHRcdFx0KTtcblx0XHRcdFx0YnJlYWs7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0Ly8gREFZXG5cdGlmKCFkYXRlLmRheSkge1xuXHRcdC8vIGNvbXBpbGUgZGF5IHJlZ3VsYXIgZXhwcmVzc2lvblxuXHRcdGZvciAobGV0IGkgaW4gcGFydHMpIHtcblx0XHRcdGxldCBtID0gX2RheVJlLmV4ZWMocGFydHNbaV0ucGFydCk7XG5cdFx0XHRpZiAobSkge1xuXHRcdFx0XHR2YXIgZGF5ID0gcGFyc2VJbnQobVsxXSwgMTApLFxuXHRcdFx0XHRcdHBhcnQ7XG5cdFx0XHRcdC8vIFNhbml0eSBjaGVja1xuXHRcdFx0XHRpZiAoZGF5IDw9IDMxKSB7XG5cdFx0XHRcdFx0ZGF0ZS5kYXkgPSBkYXk7XG5cdFx0XHRcdFx0ZGF0ZS5vcmRlciA9IF9pbnNlcnREYXRlT3JkZXJQYXJ0KGRhdGUub3JkZXIsICdkJywgcGFydHNbaV0pO1xuXHRcdFx0XHRcdGlmKG0uaW5kZXggPiAwKSB7XG5cdFx0XHRcdFx0XHRwYXJ0ID0gcGFydHNbaV0ucGFydC5zdWJzdHIoMCwgbS5pbmRleCk7XG5cdFx0XHRcdFx0XHRpZihtWzJdKSB7XG5cdFx0XHRcdFx0XHRcdHBhcnQgKz0gJyAnICsgbVsyXTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0cGFydCA9IG1bMl07XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdHBhcnRzLnNwbGljZShcblx0XHRcdFx0XHRcdGksIDEsXG5cdFx0XHRcdFx0XHR7IHBhcnQ6IHBhcnQgfVxuXHRcdFx0XHRcdCk7XG5cdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHQvLyBDb25jYXRlbmF0ZSBkYXRlIHBhcnRzXG5cdGRhdGUucGFydCA9ICcnO1xuXHRmb3IgKHZhciBpIGluIHBhcnRzKSB7XG5cdFx0ZGF0ZS5wYXJ0ICs9IHBhcnRzW2ldLnBhcnQgKyAnICc7XG5cdH1cblxuXHQvLyBjbGVhbiB1cCBkYXRlIHBhcnRcblx0aWYoZGF0ZS5wYXJ0KSB7XG5cdFx0ZGF0ZS5wYXJ0ID0gZGF0ZS5wYXJ0LnJlcGxhY2UoL15bXkEtWmEtejAtOV0rfFteQS1aYS16MC05XSskL2csICcnKTtcblx0fVxuXG5cdGlmKGRhdGUucGFydCA9PT0gJycgfHwgZGF0ZS5wYXJ0ID09IHVuZGVmaW5lZCkge1xuXHRcdGRlbGV0ZSBkYXRlLnBhcnQ7XG5cdH1cblxuXHQvL21ha2Ugc3VyZSB5ZWFyIGlzIGFsd2F5cyBhIHN0cmluZ1xuXHRpZihkYXRlLnllYXIgfHwgZGF0ZS55ZWFyID09PSAwKSBkYXRlLnllYXIgKz0gJyc7XG5cblx0cmV0dXJuIGRhdGU7XG59XG4iLCJjb25zdCBmaWVsZHMgPSByZXF1aXJlKCcuL2ZpZWxkcycpO1xuY29uc3QgaXRlbVR5cGVzID0gcmVxdWlyZSgnLi9pdGVtLXR5cGVzJyk7XG5cbmNvbnN0IHR5cGVTcGVjaWZpY0ZpZWxkTWFwID0ge1xuXHRbKDE2IDw8IDgpICsgNF06IDk0LFxuXHRbKDE3IDw8IDgpICsgNF06IDk3LFxuXHRbKDcgPDwgOCkgKyA4XTogODksXG5cdFsoMTEgPDwgOCkgKyA4XTogMjEsXG5cdFsoMTUgPDwgOCkgKyA4XTogMzEsXG5cdFsoMjYgPDwgOCkgKyA4XTogNzIsXG5cdFsoMjggPDwgOCkgKyA4XTogNzYsXG5cdFsoMjkgPDwgOCkgKyA4XTogNzgsXG5cdFsoMzAgPDwgOCkgKyA4XTogNzgsXG5cdFsoMzIgPDwgOCkgKyA4XTogODMsXG5cdFsoMTYgPDwgOCkgKyAxMF06IDk1LFxuXHRbKDE3IDw8IDgpICsgMTBdOiA5OCxcblx0WygzIDw8IDgpICsgMTJdOiAxMTUsXG5cdFsoMzMgPDwgOCkgKyAxMl06IDExNCxcblx0WygxMyA8PCA4KSArIDEyXTogOTEsXG5cdFsoMjMgPDwgOCkgKyAxMl06IDEwNyxcblx0WygyNSA8PCA4KSArIDEyXTogMTA0LFxuXHRbKDI5IDw8IDgpICsgMTJdOiAxMTksXG5cdFsoMzAgPDwgOCkgKyAxMl06IDExOSxcblx0WygzNSA8PCA4KSArIDEyXTogODUsXG5cdFsoMzYgPDwgOCkgKyAxMl06IDg2LFxuXHRbKDE3IDw8IDgpICsgMTRdOiA5Nixcblx0WygxOSA8PCA4KSArIDE0XTogNTIsXG5cdFsoMjAgPDwgOCkgKyAxNF06IDEwMCxcblx0WygxNSA8PCA4KSArIDYwXTogOTIsXG5cdFsoMTYgPDwgOCkgKyA2MF06IDkzLFxuXHRbKDE3IDw8IDgpICsgNjBdOiAxMTcsXG5cdFsoMTggPDwgOCkgKyA2MF06IDk5LFxuXHRbKDE5IDw8IDgpICsgNjBdOiA1MCxcblx0WygyMCA8PCA4KSArIDYwXTogMTAxLFxuXHRbKDI5IDw8IDgpICsgNjBdOiAxMDUsXG5cdFsoMzAgPDwgOCkgKyA2MF06IDEwNSxcblx0WygzMSA8PCA4KSArIDYwXTogMTA1LFxuXHRbKDcgPDwgOCkgKyAxMDhdOiA2OSxcblx0Wyg4IDw8IDgpICsgMTA4XTogNjUsXG5cdFsoOSA8PCA4KSArIDEwOF06IDY2LFxuXHRbKDExIDw8IDgpICsgMTA4XTogMTIyLFxuXHRbKDEzIDw8IDgpICsgMTA4XTogNzAsXG5cdFsoMTUgPDwgOCkgKyAxMDhdOiAzMixcblx0WygyMiA8PCA4KSArIDEwOF06IDY3LFxuXHRbKDIzIDw8IDgpICsgMTA4XTogNzAsXG5cdFsoMjUgPDwgOCkgKyAxMDhdOiA3OSxcblx0WygyNyA8PCA4KSArIDEwOF06IDc0LFxuXHRbKDEwIDw8IDgpICsgMTA5XTogNjQsXG5cdFsoMTEgPDwgOCkgKyAxMDldOiA2Myxcblx0WygxMiA8PCA4KSArIDEwOV06IDU5LFxuXHRbKDI2IDw8IDgpICsgMTA5XTogNzEsXG5cdFsoMjggPDwgOCkgKyAxMDldOiA2Myxcblx0WygyOSA8PCA4KSArIDEwOV06IDYzLFxuXHRbKDMwIDw8IDgpICsgMTA5XTogNzEsXG5cdFsoMzEgPDwgOCkgKyAxMDldOiA4MCxcblx0WygxNyA8PCA4KSArIDExMF06IDExMSxcblx0WygyMCA8PCA4KSArIDExMF06IDExMixcblx0WygyMSA8PCA4KSArIDExMF06IDExM1xufTtcblxubW9kdWxlLmV4cG9ydHMgPSB7XG5cdG1hcDogdHlwZVNwZWNpZmljRmllbGRNYXAsXG5cdGdldEZpZWxkSURGcm9tVHlwZUFuZEJhc2U6ICh0eXBlSWQsIGZpZWxkSWQpID0+IHtcblx0XHR0eXBlSWQgPSB0eXBlb2YgdHlwZUlkID09PSAnbnVtYmVyJyA/IHR5cGVJZCA6IGl0ZW1UeXBlc1t0eXBlSWRdO1xuXHRcdGZpZWxkSWQgPSB0eXBlb2YgZmllbGRJZCA9PT0gJ251bWJlcicgPyBmaWVsZElkIDogZmllbGRzW2ZpZWxkSWRdO1xuXHRcdHJldHVybiB0eXBlU3BlY2lmaWNGaWVsZE1hcFsodHlwZUlkIDw8IDgpICsgZmllbGRJZF07XG5cdH1cbn07XG4iXX0=
