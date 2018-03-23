(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.ZoteroBib = f()}})(function(){var define,module,exports;return (function(){function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s}return e})()({1:[function(require,module,exports){
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
 * @version   v4.2.4+314e4831
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



var _isArray = void 0;
if (Array.isArray) {
  _isArray = Array.isArray;
} else {
  _isArray = function (x) {
    return Object.prototype.toString.call(x) === '[object Array]';
  };
}

var isArray = _isArray;

var len = 0;
var vertxNext = void 0;
var customSchedulerFn = void 0;

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
var isNode = typeof self === 'undefined' && typeof process !== 'undefined' && {}.toString.call(process) === '[object process]';

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
    var vertx = Function('return this')().require('vertx');
    vertxNext = vertx.runOnLoop || vertx.runOnContext;
    return useVertxTimer();
  } catch (e) {
    return useSetTimeout();
  }
}

var scheduleFlush = void 0;
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
  var parent = this;

  var child = new this.constructor(noop);

  if (child[PROMISE_ID] === undefined) {
    makePromise(child);
  }

  var _state = parent._state;


  if (_state) {
    var callback = arguments[_state - 1];
    asap(function () {
      return invokeCallback(_state, child, callback, parent._result);
    });
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

var PROMISE_ID = Math.random().toString(36).substring(2);

function noop() {}

var PENDING = void 0;
var FULFILLED = 1;
var REJECTED = 2;

var TRY_CATCH_ERROR = { error: null };

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
    TRY_CATCH_ERROR.error = error;
    return TRY_CATCH_ERROR;
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
    if (then$$1 === TRY_CATCH_ERROR) {
      reject(promise, TRY_CATCH_ERROR.error);
      TRY_CATCH_ERROR.error = null;
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

  var child = void 0,
      callback = void 0,
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
      value = void 0,
      error = void 0,
      succeeded = void 0,
      failed = void 0;

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

function validationError() {
  return new Error('Array Methods must be provided an Array');
}

var Enumerator = function () {
  function Enumerator(Constructor, input) {
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

  Enumerator.prototype._enumerate = function _enumerate(input) {
    for (var i = 0; this._state === PENDING && i < input.length; i++) {
      this._eachEntry(input[i], i);
    }
  };

  Enumerator.prototype._eachEntry = function _eachEntry(entry, i) {
    var c = this._instanceConstructor;
    var resolve$$1 = c.resolve;


    if (resolve$$1 === resolve$1) {
      var _then = getThen(entry);

      if (_then === then && entry._state !== PENDING) {
        this._settledAt(entry._state, i, entry._result);
      } else if (typeof _then !== 'function') {
        this._remaining--;
        this._result[i] = entry;
      } else if (c === Promise$1) {
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

  Enumerator.prototype._settledAt = function _settledAt(state, i, value) {
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

  Enumerator.prototype._willSettleAt = function _willSettleAt(promise, i) {
    var enumerator = this;

    subscribe(promise, undefined, function (value) {
      return enumerator._settledAt(FULFILLED, i, value);
    }, function (reason) {
      return enumerator._settledAt(REJECTED, i, reason);
    });
  };

  return Enumerator;
}();

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
function all(entries) {
  return new Enumerator(this, entries).promise;
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
function race(entries) {
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
  @param {Function} resolver
  Useful for tooling.
  @constructor
*/

var Promise$1 = function () {
  function Promise(resolver) {
    this[PROMISE_ID] = nextId();
    this._result = this._state = undefined;
    this._subscribers = [];

    if (noop !== resolver) {
      typeof resolver !== 'function' && needsResolver();
      this instanceof Promise ? initializePromise(this, resolver) : needsNew();
    }
  }

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


  Promise.prototype.catch = function _catch(onRejection) {
    return this.then(null, onRejection);
  };

  /**
    `finally` will be invoked regardless of the promise's fate just as native
    try/catch/finally behaves
  
    Synchronous example:
  
    ```js
    findAuthor() {
      if (Math.random() > 0.5) {
        throw new Error();
      }
      return new Author();
    }
  
    try {
      return findAuthor(); // succeed or fail
    } catch(error) {
      return findOtherAuther();
    } finally {
      // always runs
      // doesn't affect the return value
    }
    ```
  
    Asynchronous example:
  
    ```js
    findAuthor().catch(function(reason){
      return findOtherAuther();
    }).finally(function(){
      // author was either found, or not
    });
    ```
  
    @method finally
    @param {Function} callback
    @return {Promise}
  */


  Promise.prototype.finally = function _finally(callback) {
    var promise = this;
    var constructor = promise.constructor;

    return promise.then(function (value) {
      return constructor.resolve(callback()).then(function () {
        return value;
      });
    }, function (reason) {
      return constructor.resolve(callback()).then(function () {
        throw reason;
      });
    });
  };

  return Promise;
}();

Promise$1.prototype.then = then;
Promise$1.all = all;
Promise$1.race = race;
Promise$1.resolve = resolve$1;
Promise$1.reject = reject$1;
Promise$1._setScheduler = setScheduler;
Promise$1._setAsap = setAsap;
Promise$1._asap = asap;

/*global self*/
function polyfill() {
  var local = void 0;

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

  local.Promise = Promise$1;
}

// Strange compat..
Promise$1.polyfill = polyfill;
Promise$1.Promise = Promise$1;

return Promise$1;

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
module.exports = Object.freeze({"bill":{"volume":"codeVolume","pages":"codePages","number":"billNumber"},"case":{"volume":"reporterVolume","pages":"firstPage","date":"dateDecided","number":"docketNumber","title":"caseName"},"thesis":{"publisher":"university","type":"thesisType"},"film":{"publisher":"distributor","type":"genre","medium":"videoRecordingFormat"},"report":{"publisher":"institution","number":"reportNumber","type":"reportType"},"audioRecording":{"publisher":"label","medium":"audioRecordingFormat"},"videoRecording":{"publisher":"studio","medium":"videoRecordingFormat"},"tvBroadcast":{"publisher":"network","publicationTitle":"programTitle","number":"episodeNumber","medium":"videoRecordingFormat"},"radioBroadcast":{"publisher":"network","publicationTitle":"programTitle","number":"episodeNumber","medium":"audioRecordingFormat"},"computerProgram":{"publisher":"company"},"bookSection":{"publicationTitle":"bookTitle"},"conferencePaper":{"publicationTitle":"proceedingsTitle"},"webpage":{"publicationTitle":"websiteTitle","type":"websiteType"},"blogPost":{"publicationTitle":"blogTitle","type":"websiteType"},"forumPost":{"publicationTitle":"forumTitle","type":"postType"},"encyclopediaArticle":{"publicationTitle":"encyclopediaTitle"},"dictionaryEntry":{"publicationTitle":"dictionaryTitle"},"patent":{"date":"issueDate","number":"patentNumber"},"statute":{"date":"dateEnacted","number":"publicLawNumber","title":"nameOfAct"},"hearing":{"number":"documentNumber"},"podcast":{"number":"episodeNumber","medium":"audioFileType"},"letter":{"type":"letterType"},"manuscript":{"type":"manuscriptType"},"map":{"type":"mapType"},"presentation":{"type":"presentationType"},"interview":{"medium":"interviewMedium"},"artwork":{"medium":"artworkMedium"},"email":{"title":"subject"}});
},{}],8:[function(require,module,exports){
'use strict';var _extends=Object.assign||function(a){for(var b,c=1;c<arguments.length;c++)for(var d in b=arguments[c],b)Object.prototype.hasOwnProperty.call(b,d)&&(a[d]=b[d]);return a},_createClass=function(){function a(a,b){for(var c,d=0;d<b.length;d++)c=b[d],c.enumerable=c.enumerable||!1,c.configurable=!0,'value'in c&&(c.writable=!0),Object.defineProperty(a,c.key,c)}return function(b,c,d){return c&&a(b.prototype,c),d&&a(b,d),b}}();function _asyncToGenerator(a){return function(){var b=a.apply(this,arguments);return new Promise(function(a,c){function d(e,f){try{var g=b[e](f),h=g.value}catch(a){return void c(a)}return g.done?void a(h):Promise.resolve(h).then(function(a){d('next',a)},function(a){d('throw',a)})}return d('next')})}}function _toConsumableArray(a){if(Array.isArray(a)){for(var b=0,c=Array(a.length);b<a.length;b++)c[b]=a[b];return c}return Array.from(a)}function _classCallCheck(a,b){if(!(a instanceof b))throw new TypeError('Cannot call a class as a function')}var utils=require('./utils'),defaults=require('./defaults'),itemToCSLJSON=require('../zotero-shim/item-to-csl-json'),dateToSql=require('../zotero-shim/date-to-sql'),COMPLETE='COMPLETE',MULTIPLE_ITEMS='MULTIPLE_ITEMS',FAILED='FAILED',ZoteroBib=function(){function a(b){if(_classCallCheck(this,a),this.opts=_extends({sessionid:utils.uuid4()},defaults(),b),this.opts.persist&&this.opts.storage){if(!('getItem'in this.opts.storage||'setItem'in this.opts.storage||'clear'in this.opts.storage))throw new Error('Invalid storage engine provided');this.opts.override&&this.clearItems(),this.items=[].concat(_toConsumableArray(this.opts.initialItems),_toConsumableArray(this.getItemsStorage())),this.setItemsStorage(this.items)}else this.items=[].concat(_toConsumableArray(this.opts.initialItems))}return _createClass(a,[{key:'getItemsStorage',value:function getItemsStorage(){var a=this.opts.storage.getItem(this.opts.storagePrefix+'-items');return a?JSON.parse(a):[]}},{key:'setItemsStorage',value:function setItemsStorage(a){this.opts.storage.setItem(this.opts.storagePrefix+'-items',JSON.stringify(a))}},{key:'reloadItems',value:function reloadItems(){this.items=this.getItemsStorage()}},{key:'addItem',value:function addItem(a){this.items.push(a),this.opts.persist&&this.setItemsStorage(this.items)}},{key:'updateItem',value:function updateItem(a,b){this.items[a]=b,this.opts.persist&&this.setItemsStorage(this.items)}},{key:'removeItem',value:function removeItem(a){var b=this.items.indexOf(a);return-1!==b&&(this.items.splice(b,1),this.opts.persist&&this.setItemsStorage(this.items),a)}},{key:'clearItems',value:function clearItems(){this.items=[],this.opts.persist&&this.setItemsStorage(this.items)}},{key:'exportItems',value:function(){var a=_asyncToGenerator(regeneratorRuntime.mark(function a(b){var c,d,e;return regeneratorRuntime.wrap(function(a){for(;;)switch(a.prev=a.next){case 0:return c=this.opts.translationServerUrl+'/'+this.opts.translationServerPrefix+'export?format='+b,d=_extends({method:'POST',headers:{"Content-Type":'application/json'},body:JSON.stringify(this.items.filter(function(a){return'key'in a}))},this.opts.init),a.next=4,fetch(c,d);case 4:if(e=a.sent,!e.ok){a.next=11;break}return a.next=8,e.text();case 8:return a.abrupt('return',a.sent);case 11:throw new Error('Failed to export items');case 12:case'end':return a.stop();}},a,this)}));return function exportItems(){return a.apply(this,arguments)}}()},{key:'translateIdentifier',value:function(){var a=_asyncToGenerator(regeneratorRuntime.mark(function a(b){for(var c=arguments.length,d=Array(1<c?c-1:0),e=1;e<c;e++)d[e-1]=arguments[e];var f,g;return regeneratorRuntime.wrap(function(a){for(;;)switch(a.prev=a.next){case 0:return f=this.opts.translationServerUrl+'/'+this.opts.translationServerPrefix+'search',g=_extends({method:'POST',headers:{"Content-Type":'text/plain'},body:b},this.opts.init),a.next=4,this.translate.apply(this,[f,g].concat(d));case 4:return a.abrupt('return',a.sent);case 5:case'end':return a.stop();}},a,this)}));return function translateIdentifier(){return a.apply(this,arguments)}}()},{key:'translateUrlItems',value:function(){var a=_asyncToGenerator(regeneratorRuntime.mark(function a(b,c){for(var d=arguments.length,e=Array(2<d?d-2:0),f=2;f<d;f++)e[f-2]=arguments[f];var g,h,i,j;return regeneratorRuntime.wrap(function(a){for(;;)switch(a.prev=a.next){case 0:return g=this.opts.translationServerUrl+'/'+this.opts.translationServerPrefix+'web',h=this.opts.sessionid,i=_extends({url:b,items:c,sessionid:h},this.opts.request),j=_extends({method:'POST',headers:{"Content-Type":'application/json'},body:JSON.stringify(i)},this.opts.init),a.next=6,this.translate.apply(this,[g,j].concat(e));case 6:return a.abrupt('return',a.sent);case 7:case'end':return a.stop();}},a,this)}));return function translateUrlItems(){return a.apply(this,arguments)}}()},{key:'translateUrl',value:function(){var a=_asyncToGenerator(regeneratorRuntime.mark(function a(b){for(var c=arguments.length,d=Array(1<c?c-1:0),e=1;e<c;e++)d[e-1]=arguments[e];var f,g,h,i;return regeneratorRuntime.wrap(function(a){for(;;)switch(a.prev=a.next){case 0:return f=this.opts.translationServerUrl+'/'+this.opts.translationServerPrefix+'web',g=this.opts.sessionid,h=_extends({url:b,sessionid:g},this.opts.request),i=_extends({method:'POST',headers:{"Content-Type":'application/json'},body:JSON.stringify(h)},this.opts.init),a.next=6,this.translate.apply(this,[f,i].concat(d));case 6:return a.abrupt('return',a.sent);case 7:case'end':return a.stop();}},a,this)}));return function translateUrl(){return a.apply(this,arguments)}}()},{key:'translate',value:function(){var a=_asyncToGenerator(regeneratorRuntime.mark(function a(b,c){var d,e,f,g=this,h=2<arguments.length&&void 0!==arguments[2]?arguments[2]:!0;return regeneratorRuntime.wrap(function(a){for(;;)switch(a.prev=a.next){case 0:return a.next=2,fetch(b,c);case 2:if(d=a.sent,!d.ok){a.next=11;break}return a.next=6,d.json();case 6:e=a.sent,Array.isArray(e)&&e.forEach(function(a){if('CURRENT_TIMESTAMP'===a.accessDate){var b=new Date(Date.now());a.accessDate=dateToSql(b,!0)}h&&g.addItem(a)}),f=Array.isArray(e)?COMPLETE:FAILED,a.next=19;break;case 11:if(300!==d.status){a.next=18;break}return a.next=14,d.json();case 14:e=a.sent,f=MULTIPLE_ITEMS,a.next=19;break;case 18:f=FAILED;case 19:return a.abrupt('return',{result:f,items:e,response:d});case 20:case'end':return a.stop();}},a,this)}));return function translate(){return a.apply(this,arguments)}}()},{key:'itemsCSL',get:function get(){return this.items.map(function(a){return itemToCSLJSON(a)})}},{key:'itemsRaw',get:function get(){return this.items}}],[{key:'COMPLETE',get:function get(){return COMPLETE}},{key:'MULTIPLE_ITEMS',get:function get(){return MULTIPLE_ITEMS}},{key:'FAILED',get:function get(){return FAILED}}]),a}();module.exports=ZoteroBib;

},{"../zotero-shim/date-to-sql":14,"../zotero-shim/item-to-csl-json":17,"./defaults":9,"./utils":10}],9:[function(require,module,exports){
'use strict';module.exports=function(){return{translationServerUrl:'undefined'!=typeof window&&window.location.origin||'',translationServerPrefix:'',fetchConfig:{},initialItems:[],request:{},storage:'undefined'!=typeof window&&'localStorage'in window&&window.localStorage||{},persist:!0,override:!1,storagePrefix:'zotero-bib'}};

},{}],10:[function(require,module,exports){
'use strict';module.exports={uuid4:function uuid4(){return'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,function(a){var b=0|16*Math.random(),c='x'==a?b:8|3&b;return c.toString(16)})}};

},{}],11:[function(require,module,exports){
'use strict';require('es6-promise/auto'),require('isomorphic-fetch'),require('babel-regenerator-runtime');var ZoteroBib=require('./bib/bib');module.exports=ZoteroBib;

},{"./bib/bib":8,"babel-regenerator-runtime":1,"es6-promise/auto":2,"isomorphic-fetch":4}],12:[function(require,module,exports){
'use strict';var creatorTypes={1:'author',2:'contributor',3:'editor',4:'translator',5:'seriesEditor',6:'interviewee',7:'interviewer',8:'director',9:'scriptwriter',10:'producer',11:'castMember',12:'sponsor',13:'counsel',14:'inventor',15:'attorneyAgent',16:'recipient',17:'performer',18:'composer',19:'wordsBy',20:'cartographer',21:'programmer',22:'artist',23:'commenter',24:'presenter',25:'guest',26:'podcaster',27:'reviewedAuthor',28:'cosponsor',29:'bookAuthor'};Object.keys(creatorTypes).map(function(a){return creatorTypes[creatorTypes[a]]=a}),module.exports=creatorTypes;

},{}],13:[function(require,module,exports){
'use strict';module.exports={CSL_NAMES_MAPPINGS:{author:'author',editor:'editor',bookAuthor:'container-author',composer:'composer',director:'director',interviewer:'interviewer',recipient:'recipient',reviewedAuthor:'reviewed-author',seriesEditor:'collection-editor',translator:'translator'},CSL_TEXT_MAPPINGS:{title:['title'],"container-title":['publicationTitle','reporter','code'],"collection-title":['seriesTitle','series'],"collection-number":['seriesNumber'],publisher:['publisher','distributor'],"publisher-place":['place'],authority:['court','legislativeBody','issuingAuthority'],page:['pages'],volume:['volume','codeNumber'],issue:['issue','priorityNumbers'],"number-of-volumes":['numberOfVolumes'],"number-of-pages":['numPages'],edition:['edition'],version:['versionNumber'],section:['section','committee'],genre:['type','programmingLanguage'],source:['libraryCatalog'],dimensions:['artworkSize','runningTime'],medium:['medium','system'],scale:['scale'],archive:['archive'],archive_location:['archiveLocation'],event:['meetingName','conferenceName'],"event-place":['place'],abstract:['abstractNote'],URL:['url'],DOI:['DOI'],ISBN:['ISBN'],ISSN:['ISSN'],"call-number":['callNumber','applicationNumber'],note:['extra'],number:['number'],"chapter-number":['session'],references:['history','references'],shortTitle:['shortTitle'],journalAbbreviation:['journalAbbreviation'],status:['legalStatus'],language:['language']},CSL_DATE_MAPPINGS:{issued:'date',accessed:'accessDate',submitted:'filingDate'},CSL_TYPE_MAPPINGS:{book:'book',bookSection:'chapter',journalArticle:'article-journal',magazineArticle:'article-magazine',newspaperArticle:'article-newspaper',thesis:'thesis',encyclopediaArticle:'entry-encyclopedia',dictionaryEntry:'entry-dictionary',conferencePaper:'paper-conference',letter:'personal_communication',manuscript:'manuscript',interview:'interview',film:'motion_picture',artwork:'graphic',webpage:'webpage',report:'report',bill:'bill',case:'legal_case',hearing:'bill',patent:'patent',statute:'legislation',email:'personal_communication',map:'map',blogPost:'post-weblog',instantMessage:'personal_communication',forumPost:'post',audioRecording:'song',presentation:'speech',videoRecording:'motion_picture',tvBroadcast:'broadcast',radioBroadcast:'broadcast',podcast:'song',computerProgram:'book',document:'article',note:'article',attachment:'article'}};

},{}],14:[function(require,module,exports){
'use strict';var lpad=require('./lpad');module.exports=function(a,b){var c,d,e,f,g,h;try{return b?(c=a.getUTCFullYear(),d=a.getUTCMonth(),e=a.getUTCDate(),f=a.getUTCHours(),g=a.getUTCMinutes(),h=a.getUTCSeconds()):(c=a.getFullYear(),d=a.getMonth(),e=a.getDate(),f=a.getHours(),g=a.getMinutes(),h=a.getSeconds()),c=lpad(c,'0',4),d=lpad(d+1,'0',2),e=lpad(e,'0',2),f=lpad(f,'0',2),g=lpad(g,'0',2),h=lpad(h,'0',2),c+'-'+d+'-'+e+' '+f+':'+g+':'+h}catch(a){return''}};

},{"./lpad":19}],15:[function(require,module,exports){
'use strict';var _module$exports;function _defineProperty(a,b,c){return b in a?Object.defineProperty(a,b,{value:c,enumerable:!0,configurable:!0,writable:!0}):a[b]=c,a}var itemTypes=require('./item-types'),creatorTypes=require('./creator-types');module.exports=(_module$exports={},_defineProperty(_module$exports,itemTypes[2],creatorTypes[1]),_defineProperty(_module$exports,itemTypes[3],creatorTypes[1]),_defineProperty(_module$exports,itemTypes[4],creatorTypes[1]),_defineProperty(_module$exports,itemTypes[5],creatorTypes[1]),_defineProperty(_module$exports,itemTypes[6],creatorTypes[1]),_defineProperty(_module$exports,itemTypes[7],creatorTypes[1]),_defineProperty(_module$exports,itemTypes[8],creatorTypes[1]),_defineProperty(_module$exports,itemTypes[9],creatorTypes[1]),_defineProperty(_module$exports,itemTypes[10],creatorTypes[6]),_defineProperty(_module$exports,itemTypes[11],creatorTypes[8]),_defineProperty(_module$exports,itemTypes[12],creatorTypes[22]),_defineProperty(_module$exports,itemTypes[13],creatorTypes[1]),_defineProperty(_module$exports,itemTypes[15],creatorTypes[1]),_defineProperty(_module$exports,itemTypes[16],creatorTypes[12]),_defineProperty(_module$exports,itemTypes[17],creatorTypes[1]),_defineProperty(_module$exports,itemTypes[18],creatorTypes[2]),_defineProperty(_module$exports,itemTypes[19],creatorTypes[14]),_defineProperty(_module$exports,itemTypes[20],creatorTypes[1]),_defineProperty(_module$exports,itemTypes[21],creatorTypes[1]),_defineProperty(_module$exports,itemTypes[22],creatorTypes[20]),_defineProperty(_module$exports,itemTypes[23],creatorTypes[1]),_defineProperty(_module$exports,itemTypes[24],creatorTypes[1]),_defineProperty(_module$exports,itemTypes[25],creatorTypes[1]),_defineProperty(_module$exports,itemTypes[26],creatorTypes[17]),_defineProperty(_module$exports,itemTypes[27],creatorTypes[24]),_defineProperty(_module$exports,itemTypes[28],creatorTypes[8]),_defineProperty(_module$exports,itemTypes[29],creatorTypes[8]),_defineProperty(_module$exports,itemTypes[30],creatorTypes[8]),_defineProperty(_module$exports,itemTypes[31],creatorTypes[26]),_defineProperty(_module$exports,itemTypes[32],creatorTypes[21]),_defineProperty(_module$exports,itemTypes[33],creatorTypes[1]),_defineProperty(_module$exports,itemTypes[34],creatorTypes[1]),_defineProperty(_module$exports,itemTypes[35],creatorTypes[1]),_defineProperty(_module$exports,itemTypes[36],creatorTypes[1]),_module$exports);

},{"./creator-types":12,"./item-types":18}],16:[function(require,module,exports){
'use strict';var fields={1:'url',2:'rights',3:'series',4:'volume',5:'issue',6:'edition',7:'place',8:'publisher',10:'pages',11:'ISBN',12:'publicationTitle',13:'ISSN',14:'date',15:'section',18:'callNumber',19:'archiveLocation',21:'distributor',22:'extra',25:'journalAbbreviation',26:'DOI',27:'accessDate',28:'seriesTitle',29:'seriesText',30:'seriesNumber',31:'institution',32:'reportType',36:'code',40:'session',41:'legislativeBody',42:'history',43:'reporter',44:'court',45:'numberOfVolumes',46:'committee',48:'assignee',50:'patentNumber',51:'priorityNumbers',52:'issueDate',53:'references',54:'legalStatus',55:'codeNumber',59:'artworkMedium',60:'number',61:'artworkSize',62:'libraryCatalog',63:'videoRecordingFormat',64:'interviewMedium',65:'letterType',66:'manuscriptType',67:'mapType',68:'scale',69:'thesisType',70:'websiteType',71:'audioRecordingFormat',72:'label',74:'presentationType',75:'meetingName',76:'studio',77:'runningTime',78:'network',79:'postType',80:'audioFileType',81:'versionNumber',82:'system',83:'company',84:'conferenceName',85:'encyclopediaTitle',86:'dictionaryTitle',87:'language',88:'programmingLanguage',89:'university',90:'abstractNote',91:'websiteTitle',92:'reportNumber',93:'billNumber',94:'codeVolume',95:'codePages',96:'dateDecided',97:'reporterVolume',98:'firstPage',99:'documentNumber',100:'dateEnacted',101:'publicLawNumber',102:'country',103:'applicationNumber',104:'forumTitle',105:'episodeNumber',107:'blogTitle',108:'type',109:'medium',110:'title',111:'caseName',112:'nameOfAct',113:'subject',114:'proceedingsTitle',115:'bookTitle',116:'shortTitle',117:'docketNumber',118:'numPages',119:'programTitle',120:'issuingAuthority',121:'filingDate',122:'genre',123:'archive'};Object.keys(fields).map(function(a){return fields[fields[a]]=a}),module.exports=fields;

},{}],17:[function(require,module,exports){
'use strict';var baseMappings=require('zotero-base-mappings'),_require=require('./csl-mappings'),CSL_NAMES_MAPPINGS=_require.CSL_NAMES_MAPPINGS,CSL_TEXT_MAPPINGS=_require.CSL_TEXT_MAPPINGS,CSL_DATE_MAPPINGS=_require.CSL_DATE_MAPPINGS,CSL_TYPE_MAPPINGS=_require.CSL_TYPE_MAPPINGS,_require2=require('./type-specific-field-map'),getFieldIDFromTypeAndBase=_require2.getFieldIDFromTypeAndBase,fields=require('./fields'),itemTypes=require('./item-types'),strToDate=require('./str-to-date'),defaultItemTypeCreatorTypeLookup=require('./default-item-type-creator-type-lookup'),baseMappingsFlat=Object.keys(baseMappings).reduce(function(a,b){return Object.keys(baseMappings[b]).forEach(function(c){var d=baseMappings[b][c];a[''+b+c]=d}),a},{});module.exports=function(a){var b=CSL_TYPE_MAPPINGS[a.itemType];if(!b)throw new Error('Unexpected Zotero Item type "'+a.itemType+'"');var c=itemTypes[a.itemType],d={id:a.key,type:b};for(var l in CSL_TEXT_MAPPINGS)for(var e=CSL_TEXT_MAPPINGS[l],f=0,g=e.length;f<g;f++){var m=e[f],n=null;if(m in a)n=a[m];else{var o=baseMappingsFlat[''+a.itemType+m];n=a[o]}if(n&&'string'==typeof n){if('ISBN'==m){var h=n.match(/^(?:97[89]-?)?(?:\d-?){9}[\dx](?!-)\b/i);h&&(n=h[0])}'"'==n.charAt(0)&&n.indexOf('"',1)==n.length-1&&(n=n.substring(1,n.length-1)),d[l]=n;break}}if('attachment'!=a.type&&'note'!=a.type)for(var i=defaultItemTypeCreatorTypeLookup[c],j=a.creators,k=0;j&&k<j.length;k++){var p=j[k],q=p.creatorType,r=void 0;(q==i&&(q='author'),q=CSL_NAMES_MAPPINGS[q],!!q)&&('lastName'in p||'firstName'in p?(r={family:p.lastName||'',given:p.firstName||''},r.family&&r.given&&(1<r.family.length&&'"'==r.family.charAt(0)&&'"'==r.family.charAt(r.family.length-1)?r.family=r.family.substr(1,r.family.length-2):CSL.parseParticles(r,!0))):'name'in p&&(r={literal:p.name}),d[q]?d[q].push(r):d[q]=[r])}for(var s in CSL_DATE_MAPPINGS){var t=a[CSL_DATE_MAPPINGS[s]];if(!t){var u=getFieldIDFromTypeAndBase(c,CSL_DATE_MAPPINGS[s]);u&&(t=a[fields[u]])}if(t){var v=strToDate(t),w=[];v.year?(w.push(v.year),void 0!==v.month&&(w.push(v.month+1),v.day&&w.push(v.day)),d[s]={"date-parts":[w]},v.part&&void 0===v.month&&(d[s].season=v.part)):d[s]={literal:t}}}return d};

},{"./csl-mappings":13,"./default-item-type-creator-type-lookup":15,"./fields":16,"./item-types":18,"./str-to-date":20,"./type-specific-field-map":21,"zotero-base-mappings":7}],18:[function(require,module,exports){
'use strict';var itemTypes={1:'note',2:'book',3:'bookSection',4:'journalArticle',5:'magazineArticle',6:'newspaperArticle',7:'thesis',8:'letter',9:'manuscript',10:'interview',11:'film',12:'artwork',13:'webpage',14:'attachment',15:'report',16:'bill',17:'case',18:'hearing',19:'patent',20:'statute',21:'email',22:'map',23:'blogPost',24:'instantMessage',25:'forumPost',26:'audioRecording',27:'presentation',28:'videoRecording',29:'tvBroadcast',30:'radioBroadcast',31:'podcast',32:'computerProgram',33:'conferencePaper',34:'document',35:'encyclopediaArticle',36:'dictionaryEntry'};Object.keys(itemTypes).map(function(a){return itemTypes[itemTypes[a]]=a}),module.exports=itemTypes;

},{}],19:[function(require,module,exports){
'use strict';module.exports=function(a,b,c){for(a=a?a+'':'';a.length<c;)a=b+a;return a};

},{}],20:[function(require,module,exports){
'use strict';var dateToSQL=require('./date-to-sql'),months=['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec','january','february','march','april','may','june','july','august','september','october','november','december'],_slashRe=/^(.*?)\b([0-9]{1,4})(?:([\-\/\.\u5e74])([0-9]{1,2}))?(?:([\-\/\.\u6708])([0-9]{1,4}))?((?:\b|[^0-9]).*?)$/,_yearRe=/^(.*?)\b((?:circa |around |about |c\.? ?)?[0-9]{1,4}(?: ?B\.? ?C\.?(?: ?E\.?)?| ?C\.? ?E\.?| ?A\.? ?D\.?)|[0-9]{3,4})\b(.*?)$/i,_monthRe=new RegExp('^(.*)\\b('+months.join('|')+')[^ ]*(?: (.*)$|$)','i'),_dayRe=/\b([0-9]{1,2})(?:st|nd|rd|th)?\b(.*)/i,_insertDateOrderPart=function(a,b,c){if(!a)return b;if(!0===c.before)return b+a;if(!0===c.after)return a+b;if(c.before){var d=a.indexOf(c.before);return-1==d?a:a.replace(new RegExp('('+c.before+')'),b+'$1')}if(c.after){var e=a.indexOf(c.after);return-1==e?a+b:a.replace(new RegExp('('+c.after+')'),'$1'+b)}return a+b};module.exports=function(a){var b={order:''};if(!a)return b;var c=[],d=(a+'').toLowerCase();a='yesterday'==d?dateToSQL(new Date(Date.now()-86400000)).substr(0,10):'today'==d?dateToSQL(new Date).substr(0,10):'tomorrow'==d?dateToSQL(new Date(Date.now()+86400000)).substr(0,10):a.toString().replace(/^\s+|\s+$/g,'').replace(/\s+/,' ');var e=_slashRe.exec(a);if(e&&(!e[5]||!e[3]||e[3]==e[5]||'\u5E74'==e[3]&&'\u6708'==e[5])&&(e[2]&&e[4]&&e[6]||!e[1]&&!e[7])){if(3==e[2].length||4==e[2].length||'\u5E74'==e[3])b.year=e[2],b.month=e[4],b.day=e[6],b.order+=e[2]?'y':'',b.order+=e[4]?'m':'',b.order+=e[6]?'d':'';else if(e[2]&&!e[4]&&e[6])b.month=e[2],b.year=e[6],b.order+=e[2]?'m':'',b.order+=e[6]?'y':'';else{var f=window.navigator.language?window.navigator.language.substr(3):'US';'US'==f||'FM'==f||'PW'==f||'PH'==f?(b.month=e[2],b.day=e[4],b.order+=e[2]?'m':'',b.order+=e[4]?'d':''):(b.month=e[4],b.day=e[2],b.order+=e[2]?'d':'',b.order+=e[4]?'m':''),b.year=e[6],b.order+='y'}if(b.year&&(b.year=parseInt(b.year,10)),b.day&&(b.day=parseInt(b.day,10)),b.month&&(b.month=parseInt(b.month,10),12<b.month)){var g=b.day;b.day=b.month,b.month=g,b.order=b.order.replace('m','D').replace('d','M').replace('D','d').replace('M','m')}if((!b.month||12>=b.month)&&(!b.day||31>=b.day)){if(b.year&&100>b.year){var h=new Date,j=h.getFullYear(),k=j%100,l=j-k;b.year=b.year<=k?l+b.year:l-100+b.year}b.month?b.month--:delete b.month,c.push({part:e[1],before:!0},{part:e[7]})}else{var b={order:''};c.push({part:a})}}else c.push({part:a});if(!b.year)for(var i in c){var p=_yearRe.exec(c[i].part);if(p){b.year=p[2],b.order=_insertDateOrderPart(b.order,'y',c[i]),c.splice(i,1,{part:p[1],before:!0},{part:p[3]});break}}if(void 0===b.month)for(var q in c){var r=_monthRe.exec(c[q].part);if(r){b.month=months.indexOf(r[2].toLowerCase())%12,b.order=_insertDateOrderPart(b.order,'m',c[q]),c.splice(q,1,{part:r[1],before:'m'},{part:r[3],after:'m'});break}}if(!b.day)for(var s in c){var t=_dayRe.exec(c[s].part);if(t){var m,n=parseInt(t[1],10);if(31>=n){b.day=n,b.order=_insertDateOrderPart(b.order,'d',c[s]),0<t.index?(m=c[s].part.substr(0,t.index),t[2]&&(m+=' '+t[2])):m=t[2],c.splice(s,1,{part:m});break}}}for(var o in b.part='',c)b.part+=c[o].part+' ';return b.part&&(b.part=b.part.replace(/^[^A-Za-z0-9]+|[^A-Za-z0-9]+$/g,'')),(''===b.part||void 0==b.part)&&delete b.part,(b.year||0===b.year)&&(b.year+=''),b};

},{"./date-to-sql":14}],21:[function(require,module,exports){
'use strict';var _typeSpecificFieldMap;function _defineProperty(a,b,c){return b in a?Object.defineProperty(a,b,{value:c,enumerable:!0,configurable:!0,writable:!0}):a[b]=c,a}var fields=require('./fields'),itemTypes=require('./item-types'),typeSpecificFieldMap=(_typeSpecificFieldMap={},_defineProperty(_typeSpecificFieldMap,4100,94),_defineProperty(_typeSpecificFieldMap,4356,97),_defineProperty(_typeSpecificFieldMap,1800,89),_defineProperty(_typeSpecificFieldMap,2824,21),_defineProperty(_typeSpecificFieldMap,3848,31),_defineProperty(_typeSpecificFieldMap,6664,72),_defineProperty(_typeSpecificFieldMap,7176,76),_defineProperty(_typeSpecificFieldMap,7432,78),_defineProperty(_typeSpecificFieldMap,7688,78),_defineProperty(_typeSpecificFieldMap,8200,83),_defineProperty(_typeSpecificFieldMap,4106,95),_defineProperty(_typeSpecificFieldMap,4362,98),_defineProperty(_typeSpecificFieldMap,780,115),_defineProperty(_typeSpecificFieldMap,8460,114),_defineProperty(_typeSpecificFieldMap,3340,91),_defineProperty(_typeSpecificFieldMap,5900,107),_defineProperty(_typeSpecificFieldMap,6412,104),_defineProperty(_typeSpecificFieldMap,7436,119),_defineProperty(_typeSpecificFieldMap,7692,119),_defineProperty(_typeSpecificFieldMap,8972,85),_defineProperty(_typeSpecificFieldMap,9228,86),_defineProperty(_typeSpecificFieldMap,4366,96),_defineProperty(_typeSpecificFieldMap,4878,52),_defineProperty(_typeSpecificFieldMap,5134,100),_defineProperty(_typeSpecificFieldMap,3900,92),_defineProperty(_typeSpecificFieldMap,4156,93),_defineProperty(_typeSpecificFieldMap,4412,117),_defineProperty(_typeSpecificFieldMap,4668,99),_defineProperty(_typeSpecificFieldMap,4924,50),_defineProperty(_typeSpecificFieldMap,5180,101),_defineProperty(_typeSpecificFieldMap,7484,105),_defineProperty(_typeSpecificFieldMap,7740,105),_defineProperty(_typeSpecificFieldMap,7996,105),_defineProperty(_typeSpecificFieldMap,1900,69),_defineProperty(_typeSpecificFieldMap,2156,65),_defineProperty(_typeSpecificFieldMap,2412,66),_defineProperty(_typeSpecificFieldMap,2924,122),_defineProperty(_typeSpecificFieldMap,3436,70),_defineProperty(_typeSpecificFieldMap,3948,32),_defineProperty(_typeSpecificFieldMap,5740,67),_defineProperty(_typeSpecificFieldMap,5996,70),_defineProperty(_typeSpecificFieldMap,6508,79),_defineProperty(_typeSpecificFieldMap,7020,74),_defineProperty(_typeSpecificFieldMap,2669,64),_defineProperty(_typeSpecificFieldMap,2925,63),_defineProperty(_typeSpecificFieldMap,3181,59),_defineProperty(_typeSpecificFieldMap,6765,71),_defineProperty(_typeSpecificFieldMap,7277,63),_defineProperty(_typeSpecificFieldMap,7533,63),_defineProperty(_typeSpecificFieldMap,7789,71),_defineProperty(_typeSpecificFieldMap,8045,80),_defineProperty(_typeSpecificFieldMap,4462,111),_defineProperty(_typeSpecificFieldMap,5230,112),_defineProperty(_typeSpecificFieldMap,5486,113),_typeSpecificFieldMap);module.exports={map:typeSpecificFieldMap,getFieldIDFromTypeAndBase:function getFieldIDFromTypeAndBase(a,b){return a='number'==typeof a?a:itemTypes[a],b='number'==typeof b?b:fields[b],typeSpecificFieldMap[(a<<8)+b]}};

},{"./fields":16,"./item-types":18}]},{},[11])(11)
});

//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJub2RlX21vZHVsZXMvYmFiZWwtcmVnZW5lcmF0b3ItcnVudGltZS9ydW50aW1lLmpzIiwibm9kZV9tb2R1bGVzL2VzNi1wcm9taXNlL2F1dG8uanMiLCJub2RlX21vZHVsZXMvZXM2LXByb21pc2UvZGlzdC9lczYtcHJvbWlzZS5qcyIsIm5vZGVfbW9kdWxlcy9pc29tb3JwaGljLWZldGNoL2ZldGNoLW5wbS1icm93c2VyaWZ5LmpzIiwibm9kZV9tb2R1bGVzL3Byb2Nlc3MvYnJvd3Nlci5qcyIsIm5vZGVfbW9kdWxlcy93aGF0d2ctZmV0Y2gvZmV0Y2guanMiLCJub2RlX21vZHVsZXMvem90ZXJvLWJhc2UtbWFwcGluZ3MvaW5kZXguanMiLCJzcmMvanMvYmliL2JpYi5qcyIsInNyYy9qcy9iaWIvZGVmYXVsdHMuanMiLCJzcmMvanMvYmliL3V0aWxzLmpzIiwic3JjL2pzL21haW4tY29tcGF0LmpzIiwic3JjL2pzL3pvdGVyby1zaGltL2NyZWF0b3ItdHlwZXMuanMiLCJzcmMvanMvem90ZXJvLXNoaW0vY3NsLW1hcHBpbmdzLmpzIiwic3JjL2pzL3pvdGVyby1zaGltL2RhdGUtdG8tc3FsLmpzIiwic3JjL2pzL3pvdGVyby1zaGltL2RlZmF1bHQtaXRlbS10eXBlLWNyZWF0b3ItdHlwZS1sb29rdXAuanMiLCJzcmMvanMvem90ZXJvLXNoaW0vZmllbGRzLmpzIiwic3JjL2pzL3pvdGVyby1zaGltL2l0ZW0tdG8tY3NsLWpzb24uanMiLCJzcmMvanMvem90ZXJvLXNoaW0vaXRlbS10eXBlcy5qcyIsInNyYy9qcy96b3Rlcm8tc2hpbS9scGFkLmpzIiwic3JjL2pzL3pvdGVyby1zaGltL3N0ci10by1kYXRlLmpzIiwic3JjL2pzL3pvdGVyby1zaGltL3R5cGUtc3BlY2lmaWMtZmllbGQtbWFwLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOztBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7O0FDanBCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7QUNKQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7OztBQzNwQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDTkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN4TEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzdjQTs7QUNBQSxhLDA4QkFFQSxHQUFNLE9BQVEsUUFBUSxTQUFSLENBQWQsQ0FDTSxTQUFXLFFBQVEsWUFBUixDQURqQixDQUVNLGNBQWdCLFFBQVEsaUNBQVIsQ0FGdEIsQ0FHTSxVQUFZLFFBQVEs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QUFxQixDQUcvQyxNQUZBLEdBQTJCLFFBQWxCLGFBQXNDLFlBRS9DLENBREEsRUFBNkIsUUFBbkIsYUFBd0MsU0FDbEQsQ0FBTyxxQkFBcUIsQ0FBQyxHQUFVLENBQVgsR0FBckIsQ0FDUCxDQU5lLEMiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbigpe2Z1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt2YXIgZj1uZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpO3Rocm93IGYuY29kZT1cIk1PRFVMRV9OT1RfRk9VTkRcIixmfXZhciBsPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChsLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGwsbC5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfXJldHVybiBlfSkoKSIsIi8qKlxuICogQ29weXJpZ2h0IChjKSAyMDE0LCBGYWNlYm9vaywgSW5jLlxuICogQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqXG4gKiBUaGlzIHNvdXJjZSBjb2RlIGlzIGxpY2Vuc2VkIHVuZGVyIHRoZSBCU0Qtc3R5bGUgbGljZW5zZSBmb3VuZCBpbiB0aGVcbiAqIGh0dHBzOi8vcmF3LmdpdGh1Yi5jb20vZmFjZWJvb2svcmVnZW5lcmF0b3IvbWFzdGVyL0xJQ0VOU0UgZmlsZS4gQW5cbiAqIGFkZGl0aW9uYWwgZ3JhbnQgb2YgcGF0ZW50IHJpZ2h0cyBjYW4gYmUgZm91bmQgaW4gdGhlIFBBVEVOVFMgZmlsZSBpblxuICogdGhlIHNhbWUgZGlyZWN0b3J5LlxuICovXG5cbiEoZnVuY3Rpb24oZ2xvYmFsKSB7XG4gIFwidXNlIHN0cmljdFwiO1xuXG4gIHZhciBoYXNPd24gPSBPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5O1xuICB2YXIgdW5kZWZpbmVkOyAvLyBNb3JlIGNvbXByZXNzaWJsZSB0aGFuIHZvaWQgMC5cbiAgdmFyIGl0ZXJhdG9yU3ltYm9sID1cbiAgICB0eXBlb2YgU3ltYm9sID09PSBcImZ1bmN0aW9uXCIgJiYgU3ltYm9sLml0ZXJhdG9yIHx8IFwiQEBpdGVyYXRvclwiO1xuXG4gIHZhciBpbk1vZHVsZSA9IHR5cGVvZiBtb2R1bGUgPT09IFwib2JqZWN0XCI7XG4gIHZhciBydW50aW1lID0gZ2xvYmFsLnJlZ2VuZXJhdG9yUnVudGltZTtcbiAgaWYgKHJ1bnRpbWUpIHtcbiAgICBpZiAoaW5Nb2R1bGUpIHtcbiAgICAgIC8vIElmIHJlZ2VuZXJhdG9yUnVudGltZSBpcyBkZWZpbmVkIGdsb2JhbGx5IGFuZCB3ZSdyZSBpbiBhIG1vZHVsZSxcbiAgICAgIC8vIG1ha2UgdGhlIGV4cG9ydHMgb2JqZWN0IGlkZW50aWNhbCB0byByZWdlbmVyYXRvclJ1bnRpbWUuXG4gICAgICBtb2R1bGUuZXhwb3J0cyA9IHJ1bnRpbWU7XG4gICAgfVxuICAgIC8vIERvbid0IGJvdGhlciBldmFsdWF0aW5nIHRoZSByZXN0IG9mIHRoaXMgZmlsZSBpZiB0aGUgcnVudGltZSB3YXNcbiAgICAvLyBhbHJlYWR5IGRlZmluZWQgZ2xvYmFsbHkuXG4gICAgcmV0dXJuO1xuICB9XG5cbiAgLy8gRGVmaW5lIHRoZSBydW50aW1lIGdsb2JhbGx5IChhcyBleHBlY3RlZCBieSBnZW5lcmF0ZWQgY29kZSkgYXMgZWl0aGVyXG4gIC8vIG1vZHVsZS5leHBvcnRzIChpZiB3ZSdyZSBpbiBhIG1vZHVsZSkgb3IgYSBuZXcsIGVtcHR5IG9iamVjdC5cbiAgcnVudGltZSA9IGdsb2JhbC5yZWdlbmVyYXRvclJ1bnRpbWUgPSBpbk1vZHVsZSA/IG1vZHVsZS5leHBvcnRzIDoge307XG5cbiAgZnVuY3Rpb24gd3JhcChpbm5lckZuLCBvdXRlckZuLCBzZWxmLCB0cnlMb2NzTGlzdCkge1xuICAgIC8vIElmIG91dGVyRm4gcHJvdmlkZWQsIHRoZW4gb3V0ZXJGbi5wcm90b3R5cGUgaW5zdGFuY2VvZiBHZW5lcmF0b3IuXG4gICAgdmFyIGdlbmVyYXRvciA9IE9iamVjdC5jcmVhdGUoKG91dGVyRm4gfHwgR2VuZXJhdG9yKS5wcm90b3R5cGUpO1xuICAgIHZhciBjb250ZXh0ID0gbmV3IENvbnRleHQodHJ5TG9jc0xpc3QgfHwgW10pO1xuXG4gICAgLy8gVGhlIC5faW52b2tlIG1ldGhvZCB1bmlmaWVzIHRoZSBpbXBsZW1lbnRhdGlvbnMgb2YgdGhlIC5uZXh0LFxuICAgIC8vIC50aHJvdywgYW5kIC5yZXR1cm4gbWV0aG9kcy5cbiAgICBnZW5lcmF0b3IuX2ludm9rZSA9IG1ha2VJbnZva2VNZXRob2QoaW5uZXJGbiwgc2VsZiwgY29udGV4dCk7XG5cbiAgICByZXR1cm4gZ2VuZXJhdG9yO1xuICB9XG4gIHJ1bnRpbWUud3JhcCA9IHdyYXA7XG5cbiAgLy8gVHJ5L2NhdGNoIGhlbHBlciB0byBtaW5pbWl6ZSBkZW9wdGltaXphdGlvbnMuIFJldHVybnMgYSBjb21wbGV0aW9uXG4gIC8vIHJlY29yZCBsaWtlIGNvbnRleHQudHJ5RW50cmllc1tpXS5jb21wbGV0aW9uLiBUaGlzIGludGVyZmFjZSBjb3VsZFxuICAvLyBoYXZlIGJlZW4gKGFuZCB3YXMgcHJldmlvdXNseSkgZGVzaWduZWQgdG8gdGFrZSBhIGNsb3N1cmUgdG8gYmVcbiAgLy8gaW52b2tlZCB3aXRob3V0IGFyZ3VtZW50cywgYnV0IGluIGFsbCB0aGUgY2FzZXMgd2UgY2FyZSBhYm91dCB3ZVxuICAvLyBhbHJlYWR5IGhhdmUgYW4gZXhpc3RpbmcgbWV0aG9kIHdlIHdhbnQgdG8gY2FsbCwgc28gdGhlcmUncyBubyBuZWVkXG4gIC8vIHRvIGNyZWF0ZSBhIG5ldyBmdW5jdGlvbiBvYmplY3QuIFdlIGNhbiBldmVuIGdldCBhd2F5IHdpdGggYXNzdW1pbmdcbiAgLy8gdGhlIG1ldGhvZCB0YWtlcyBleGFjdGx5IG9uZSBhcmd1bWVudCwgc2luY2UgdGhhdCBoYXBwZW5zIHRvIGJlIHRydWVcbiAgLy8gaW4gZXZlcnkgY2FzZSwgc28gd2UgZG9uJ3QgaGF2ZSB0byB0b3VjaCB0aGUgYXJndW1lbnRzIG9iamVjdC4gVGhlXG4gIC8vIG9ubHkgYWRkaXRpb25hbCBhbGxvY2F0aW9uIHJlcXVpcmVkIGlzIHRoZSBjb21wbGV0aW9uIHJlY29yZCwgd2hpY2hcbiAgLy8gaGFzIGEgc3RhYmxlIHNoYXBlIGFuZCBzbyBob3BlZnVsbHkgc2hvdWxkIGJlIGNoZWFwIHRvIGFsbG9jYXRlLlxuICBmdW5jdGlvbiB0cnlDYXRjaChmbiwgb2JqLCBhcmcpIHtcbiAgICB0cnkge1xuICAgICAgcmV0dXJuIHsgdHlwZTogXCJub3JtYWxcIiwgYXJnOiBmbi5jYWxsKG9iaiwgYXJnKSB9O1xuICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgcmV0dXJuIHsgdHlwZTogXCJ0aHJvd1wiLCBhcmc6IGVyciB9O1xuICAgIH1cbiAgfVxuXG4gIHZhciBHZW5TdGF0ZVN1c3BlbmRlZFN0YXJ0ID0gXCJzdXNwZW5kZWRTdGFydFwiO1xuICB2YXIgR2VuU3RhdGVTdXNwZW5kZWRZaWVsZCA9IFwic3VzcGVuZGVkWWllbGRcIjtcbiAgdmFyIEdlblN0YXRlRXhlY3V0aW5nID0gXCJleGVjdXRpbmdcIjtcbiAgdmFyIEdlblN0YXRlQ29tcGxldGVkID0gXCJjb21wbGV0ZWRcIjtcblxuICAvLyBSZXR1cm5pbmcgdGhpcyBvYmplY3QgZnJvbSB0aGUgaW5uZXJGbiBoYXMgdGhlIHNhbWUgZWZmZWN0IGFzXG4gIC8vIGJyZWFraW5nIG91dCBvZiB0aGUgZGlzcGF0Y2ggc3dpdGNoIHN0YXRlbWVudC5cbiAgdmFyIENvbnRpbnVlU2VudGluZWwgPSB7fTtcblxuICAvLyBEdW1teSBjb25zdHJ1Y3RvciBmdW5jdGlvbnMgdGhhdCB3ZSB1c2UgYXMgdGhlIC5jb25zdHJ1Y3RvciBhbmRcbiAgLy8gLmNvbnN0cnVjdG9yLnByb3RvdHlwZSBwcm9wZXJ0aWVzIGZvciBmdW5jdGlvbnMgdGhhdCByZXR1cm4gR2VuZXJhdG9yXG4gIC8vIG9iamVjdHMuIEZvciBmdWxsIHNwZWMgY29tcGxpYW5jZSwgeW91IG1heSB3aXNoIHRvIGNvbmZpZ3VyZSB5b3VyXG4gIC8vIG1pbmlmaWVyIG5vdCB0byBtYW5nbGUgdGhlIG5hbWVzIG9mIHRoZXNlIHR3byBmdW5jdGlvbnMuXG4gIGZ1bmN0aW9uIEdlbmVyYXRvcigpIHt9XG4gIGZ1bmN0aW9uIEdlbmVyYXRvckZ1bmN0aW9uKCkge31cbiAgZnVuY3Rpb24gR2VuZXJhdG9yRnVuY3Rpb25Qcm90b3R5cGUoKSB7fVxuXG4gIHZhciBHcCA9IEdlbmVyYXRvckZ1bmN0aW9uUHJvdG90eXBlLnByb3RvdHlwZSA9IEdlbmVyYXRvci5wcm90b3R5cGU7XG4gIEdlbmVyYXRvckZ1bmN0aW9uLnByb3RvdHlwZSA9IEdwLmNvbnN0cnVjdG9yID0gR2VuZXJhdG9yRnVuY3Rpb25Qcm90b3R5cGU7XG4gIEdlbmVyYXRvckZ1bmN0aW9uUHJvdG90eXBlLmNvbnN0cnVjdG9yID0gR2VuZXJhdG9yRnVuY3Rpb247XG4gIEdlbmVyYXRvckZ1bmN0aW9uLmRpc3BsYXlOYW1lID0gXCJHZW5lcmF0b3JGdW5jdGlvblwiO1xuXG4gIC8vIEhlbHBlciBmb3IgZGVmaW5pbmcgdGhlIC5uZXh0LCAudGhyb3csIGFuZCAucmV0dXJuIG1ldGhvZHMgb2YgdGhlXG4gIC8vIEl0ZXJhdG9yIGludGVyZmFjZSBpbiB0ZXJtcyBvZiBhIHNpbmdsZSAuX2ludm9rZSBtZXRob2QuXG4gIGZ1bmN0aW9uIGRlZmluZUl0ZXJhdG9yTWV0aG9kcyhwcm90b3R5cGUpIHtcbiAgICBbXCJuZXh0XCIsIFwidGhyb3dcIiwgXCJyZXR1cm5cIl0uZm9yRWFjaChmdW5jdGlvbihtZXRob2QpIHtcbiAgICAgIHByb3RvdHlwZVttZXRob2RdID0gZnVuY3Rpb24oYXJnKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9pbnZva2UobWV0aG9kLCBhcmcpO1xuICAgICAgfTtcbiAgICB9KTtcbiAgfVxuXG4gIHJ1bnRpbWUuaXNHZW5lcmF0b3JGdW5jdGlvbiA9IGZ1bmN0aW9uKGdlbkZ1bikge1xuICAgIHZhciBjdG9yID0gdHlwZW9mIGdlbkZ1biA9PT0gXCJmdW5jdGlvblwiICYmIGdlbkZ1bi5jb25zdHJ1Y3RvcjtcbiAgICByZXR1cm4gY3RvclxuICAgICAgPyBjdG9yID09PSBHZW5lcmF0b3JGdW5jdGlvbiB8fFxuICAgICAgICAvLyBGb3IgdGhlIG5hdGl2ZSBHZW5lcmF0b3JGdW5jdGlvbiBjb25zdHJ1Y3RvciwgdGhlIGJlc3Qgd2UgY2FuXG4gICAgICAgIC8vIGRvIGlzIHRvIGNoZWNrIGl0cyAubmFtZSBwcm9wZXJ0eS5cbiAgICAgICAgKGN0b3IuZGlzcGxheU5hbWUgfHwgY3Rvci5uYW1lKSA9PT0gXCJHZW5lcmF0b3JGdW5jdGlvblwiXG4gICAgICA6IGZhbHNlO1xuICB9O1xuXG4gIHJ1bnRpbWUubWFyayA9IGZ1bmN0aW9uKGdlbkZ1bikge1xuICAgIGlmIChPYmplY3Quc2V0UHJvdG90eXBlT2YpIHtcbiAgICAgIE9iamVjdC5zZXRQcm90b3R5cGVPZihnZW5GdW4sIEdlbmVyYXRvckZ1bmN0aW9uUHJvdG90eXBlKTtcbiAgICB9IGVsc2Uge1xuICAgICAgZ2VuRnVuLl9fcHJvdG9fXyA9IEdlbmVyYXRvckZ1bmN0aW9uUHJvdG90eXBlO1xuICAgIH1cbiAgICBnZW5GdW4ucHJvdG90eXBlID0gT2JqZWN0LmNyZWF0ZShHcCk7XG4gICAgcmV0dXJuIGdlbkZ1bjtcbiAgfTtcblxuICAvLyBXaXRoaW4gdGhlIGJvZHkgb2YgYW55IGFzeW5jIGZ1bmN0aW9uLCBgYXdhaXQgeGAgaXMgdHJhbnNmb3JtZWQgdG9cbiAgLy8gYHlpZWxkIHJlZ2VuZXJhdG9yUnVudGltZS5hd3JhcCh4KWAsIHNvIHRoYXQgdGhlIHJ1bnRpbWUgY2FuIHRlc3RcbiAgLy8gYHZhbHVlIGluc3RhbmNlb2YgQXdhaXRBcmd1bWVudGAgdG8gZGV0ZXJtaW5lIGlmIHRoZSB5aWVsZGVkIHZhbHVlIGlzXG4gIC8vIG1lYW50IHRvIGJlIGF3YWl0ZWQuIFNvbWUgbWF5IGNvbnNpZGVyIHRoZSBuYW1lIG9mIHRoaXMgbWV0aG9kIHRvb1xuICAvLyBjdXRlc3ksIGJ1dCB0aGV5IGFyZSBjdXJtdWRnZW9ucy5cbiAgcnVudGltZS5hd3JhcCA9IGZ1bmN0aW9uKGFyZykge1xuICAgIHJldHVybiBuZXcgQXdhaXRBcmd1bWVudChhcmcpO1xuICB9O1xuXG4gIGZ1bmN0aW9uIEF3YWl0QXJndW1lbnQoYXJnKSB7XG4gICAgdGhpcy5hcmcgPSBhcmc7XG4gIH1cblxuICBmdW5jdGlvbiBBc3luY0l0ZXJhdG9yKGdlbmVyYXRvcikge1xuICAgIC8vIFRoaXMgaW52b2tlIGZ1bmN0aW9uIGlzIHdyaXR0ZW4gaW4gYSBzdHlsZSB0aGF0IGFzc3VtZXMgc29tZVxuICAgIC8vIGNhbGxpbmcgZnVuY3Rpb24gKG9yIFByb21pc2UpIHdpbGwgaGFuZGxlIGV4Y2VwdGlvbnMuXG4gICAgZnVuY3Rpb24gaW52b2tlKG1ldGhvZCwgYXJnKSB7XG4gICAgICB2YXIgcmVzdWx0ID0gZ2VuZXJhdG9yW21ldGhvZF0oYXJnKTtcbiAgICAgIHZhciB2YWx1ZSA9IHJlc3VsdC52YWx1ZTtcbiAgICAgIHJldHVybiB2YWx1ZSBpbnN0YW5jZW9mIEF3YWl0QXJndW1lbnRcbiAgICAgICAgPyBQcm9taXNlLnJlc29sdmUodmFsdWUuYXJnKS50aGVuKGludm9rZU5leHQsIGludm9rZVRocm93KVxuICAgICAgICA6IFByb21pc2UucmVzb2x2ZSh2YWx1ZSkudGhlbihmdW5jdGlvbih1bndyYXBwZWQpIHtcbiAgICAgICAgICAgIC8vIFdoZW4gYSB5aWVsZGVkIFByb21pc2UgaXMgcmVzb2x2ZWQsIGl0cyBmaW5hbCB2YWx1ZSBiZWNvbWVzXG4gICAgICAgICAgICAvLyB0aGUgLnZhbHVlIG9mIHRoZSBQcm9taXNlPHt2YWx1ZSxkb25lfT4gcmVzdWx0IGZvciB0aGVcbiAgICAgICAgICAgIC8vIGN1cnJlbnQgaXRlcmF0aW9uLiBJZiB0aGUgUHJvbWlzZSBpcyByZWplY3RlZCwgaG93ZXZlciwgdGhlXG4gICAgICAgICAgICAvLyByZXN1bHQgZm9yIHRoaXMgaXRlcmF0aW9uIHdpbGwgYmUgcmVqZWN0ZWQgd2l0aCB0aGUgc2FtZVxuICAgICAgICAgICAgLy8gcmVhc29uLiBOb3RlIHRoYXQgcmVqZWN0aW9ucyBvZiB5aWVsZGVkIFByb21pc2VzIGFyZSBub3RcbiAgICAgICAgICAgIC8vIHRocm93biBiYWNrIGludG8gdGhlIGdlbmVyYXRvciBmdW5jdGlvbiwgYXMgaXMgdGhlIGNhc2VcbiAgICAgICAgICAgIC8vIHdoZW4gYW4gYXdhaXRlZCBQcm9taXNlIGlzIHJlamVjdGVkLiBUaGlzIGRpZmZlcmVuY2UgaW5cbiAgICAgICAgICAgIC8vIGJlaGF2aW9yIGJldHdlZW4geWllbGQgYW5kIGF3YWl0IGlzIGltcG9ydGFudCwgYmVjYXVzZSBpdFxuICAgICAgICAgICAgLy8gYWxsb3dzIHRoZSBjb25zdW1lciB0byBkZWNpZGUgd2hhdCB0byBkbyB3aXRoIHRoZSB5aWVsZGVkXG4gICAgICAgICAgICAvLyByZWplY3Rpb24gKHN3YWxsb3cgaXQgYW5kIGNvbnRpbnVlLCBtYW51YWxseSAudGhyb3cgaXQgYmFja1xuICAgICAgICAgICAgLy8gaW50byB0aGUgZ2VuZXJhdG9yLCBhYmFuZG9uIGl0ZXJhdGlvbiwgd2hhdGV2ZXIpLiBXaXRoXG4gICAgICAgICAgICAvLyBhd2FpdCwgYnkgY29udHJhc3QsIHRoZXJlIGlzIG5vIG9wcG9ydHVuaXR5IHRvIGV4YW1pbmUgdGhlXG4gICAgICAgICAgICAvLyByZWplY3Rpb24gcmVhc29uIG91dHNpZGUgdGhlIGdlbmVyYXRvciBmdW5jdGlvbiwgc28gdGhlXG4gICAgICAgICAgICAvLyBvbmx5IG9wdGlvbiBpcyB0byB0aHJvdyBpdCBmcm9tIHRoZSBhd2FpdCBleHByZXNzaW9uLCBhbmRcbiAgICAgICAgICAgIC8vIGxldCB0aGUgZ2VuZXJhdG9yIGZ1bmN0aW9uIGhhbmRsZSB0aGUgZXhjZXB0aW9uLlxuICAgICAgICAgICAgcmVzdWx0LnZhbHVlID0gdW53cmFwcGVkO1xuICAgICAgICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICAgICAgICB9KTtcbiAgICB9XG5cbiAgICBpZiAodHlwZW9mIHByb2Nlc3MgPT09IFwib2JqZWN0XCIgJiYgcHJvY2Vzcy5kb21haW4pIHtcbiAgICAgIGludm9rZSA9IHByb2Nlc3MuZG9tYWluLmJpbmQoaW52b2tlKTtcbiAgICB9XG5cbiAgICB2YXIgaW52b2tlTmV4dCA9IGludm9rZS5iaW5kKGdlbmVyYXRvciwgXCJuZXh0XCIpO1xuICAgIHZhciBpbnZva2VUaHJvdyA9IGludm9rZS5iaW5kKGdlbmVyYXRvciwgXCJ0aHJvd1wiKTtcbiAgICB2YXIgaW52b2tlUmV0dXJuID0gaW52b2tlLmJpbmQoZ2VuZXJhdG9yLCBcInJldHVyblwiKTtcbiAgICB2YXIgcHJldmlvdXNQcm9taXNlO1xuXG4gICAgZnVuY3Rpb24gZW5xdWV1ZShtZXRob2QsIGFyZykge1xuICAgICAgZnVuY3Rpb24gY2FsbEludm9rZVdpdGhNZXRob2RBbmRBcmcoKSB7XG4gICAgICAgIHJldHVybiBpbnZva2UobWV0aG9kLCBhcmcpO1xuICAgICAgfVxuXG4gICAgICByZXR1cm4gcHJldmlvdXNQcm9taXNlID1cbiAgICAgICAgLy8gSWYgZW5xdWV1ZSBoYXMgYmVlbiBjYWxsZWQgYmVmb3JlLCB0aGVuIHdlIHdhbnQgdG8gd2FpdCB1bnRpbFxuICAgICAgICAvLyBhbGwgcHJldmlvdXMgUHJvbWlzZXMgaGF2ZSBiZWVuIHJlc29sdmVkIGJlZm9yZSBjYWxsaW5nIGludm9rZSxcbiAgICAgICAgLy8gc28gdGhhdCByZXN1bHRzIGFyZSBhbHdheXMgZGVsaXZlcmVkIGluIHRoZSBjb3JyZWN0IG9yZGVyLiBJZlxuICAgICAgICAvLyBlbnF1ZXVlIGhhcyBub3QgYmVlbiBjYWxsZWQgYmVmb3JlLCB0aGVuIGl0IGlzIGltcG9ydGFudCB0b1xuICAgICAgICAvLyBjYWxsIGludm9rZSBpbW1lZGlhdGVseSwgd2l0aG91dCB3YWl0aW5nIG9uIGEgY2FsbGJhY2sgdG8gZmlyZSxcbiAgICAgICAgLy8gc28gdGhhdCB0aGUgYXN5bmMgZ2VuZXJhdG9yIGZ1bmN0aW9uIGhhcyB0aGUgb3Bwb3J0dW5pdHkgdG8gZG9cbiAgICAgICAgLy8gYW55IG5lY2Vzc2FyeSBzZXR1cCBpbiBhIHByZWRpY3RhYmxlIHdheS4gVGhpcyBwcmVkaWN0YWJpbGl0eVxuICAgICAgICAvLyBpcyB3aHkgdGhlIFByb21pc2UgY29uc3RydWN0b3Igc3luY2hyb25vdXNseSBpbnZva2VzIGl0c1xuICAgICAgICAvLyBleGVjdXRvciBjYWxsYmFjaywgYW5kIHdoeSBhc3luYyBmdW5jdGlvbnMgc3luY2hyb25vdXNseVxuICAgICAgICAvLyBleGVjdXRlIGNvZGUgYmVmb3JlIHRoZSBmaXJzdCBhd2FpdC4gU2luY2Ugd2UgaW1wbGVtZW50IHNpbXBsZVxuICAgICAgICAvLyBhc3luYyBmdW5jdGlvbnMgaW4gdGVybXMgb2YgYXN5bmMgZ2VuZXJhdG9ycywgaXQgaXMgZXNwZWNpYWxseVxuICAgICAgICAvLyBpbXBvcnRhbnQgdG8gZ2V0IHRoaXMgcmlnaHQsIGV2ZW4gdGhvdWdoIGl0IHJlcXVpcmVzIGNhcmUuXG4gICAgICAgIHByZXZpb3VzUHJvbWlzZSA/IHByZXZpb3VzUHJvbWlzZS50aGVuKFxuICAgICAgICAgIGNhbGxJbnZva2VXaXRoTWV0aG9kQW5kQXJnLFxuICAgICAgICAgIC8vIEF2b2lkIHByb3BhZ2F0aW5nIGZhaWx1cmVzIHRvIFByb21pc2VzIHJldHVybmVkIGJ5IGxhdGVyXG4gICAgICAgICAgLy8gaW52b2NhdGlvbnMgb2YgdGhlIGl0ZXJhdG9yLlxuICAgICAgICAgIGNhbGxJbnZva2VXaXRoTWV0aG9kQW5kQXJnXG4gICAgICAgICkgOiBuZXcgUHJvbWlzZShmdW5jdGlvbiAocmVzb2x2ZSkge1xuICAgICAgICAgIHJlc29sdmUoY2FsbEludm9rZVdpdGhNZXRob2RBbmRBcmcoKSk7XG4gICAgICAgIH0pO1xuICAgIH1cblxuICAgIC8vIERlZmluZSB0aGUgdW5pZmllZCBoZWxwZXIgbWV0aG9kIHRoYXQgaXMgdXNlZCB0byBpbXBsZW1lbnQgLm5leHQsXG4gICAgLy8gLnRocm93LCBhbmQgLnJldHVybiAoc2VlIGRlZmluZUl0ZXJhdG9yTWV0aG9kcykuXG4gICAgdGhpcy5faW52b2tlID0gZW5xdWV1ZTtcbiAgfVxuXG4gIGRlZmluZUl0ZXJhdG9yTWV0aG9kcyhBc3luY0l0ZXJhdG9yLnByb3RvdHlwZSk7XG5cbiAgLy8gTm90ZSB0aGF0IHNpbXBsZSBhc3luYyBmdW5jdGlvbnMgYXJlIGltcGxlbWVudGVkIG9uIHRvcCBvZlxuICAvLyBBc3luY0l0ZXJhdG9yIG9iamVjdHM7IHRoZXkganVzdCByZXR1cm4gYSBQcm9taXNlIGZvciB0aGUgdmFsdWUgb2ZcbiAgLy8gdGhlIGZpbmFsIHJlc3VsdCBwcm9kdWNlZCBieSB0aGUgaXRlcmF0b3IuXG4gIHJ1bnRpbWUuYXN5bmMgPSBmdW5jdGlvbihpbm5lckZuLCBvdXRlckZuLCBzZWxmLCB0cnlMb2NzTGlzdCkge1xuICAgIHZhciBpdGVyID0gbmV3IEFzeW5jSXRlcmF0b3IoXG4gICAgICB3cmFwKGlubmVyRm4sIG91dGVyRm4sIHNlbGYsIHRyeUxvY3NMaXN0KVxuICAgICk7XG5cbiAgICByZXR1cm4gcnVudGltZS5pc0dlbmVyYXRvckZ1bmN0aW9uKG91dGVyRm4pXG4gICAgICA/IGl0ZXIgLy8gSWYgb3V0ZXJGbiBpcyBhIGdlbmVyYXRvciwgcmV0dXJuIHRoZSBmdWxsIGl0ZXJhdG9yLlxuICAgICAgOiBpdGVyLm5leHQoKS50aGVuKGZ1bmN0aW9uKHJlc3VsdCkge1xuICAgICAgICAgIHJldHVybiByZXN1bHQuZG9uZSA/IHJlc3VsdC52YWx1ZSA6IGl0ZXIubmV4dCgpO1xuICAgICAgICB9KTtcbiAgfTtcblxuICBmdW5jdGlvbiBtYWtlSW52b2tlTWV0aG9kKGlubmVyRm4sIHNlbGYsIGNvbnRleHQpIHtcbiAgICB2YXIgc3RhdGUgPSBHZW5TdGF0ZVN1c3BlbmRlZFN0YXJ0O1xuXG4gICAgcmV0dXJuIGZ1bmN0aW9uIGludm9rZShtZXRob2QsIGFyZykge1xuICAgICAgaWYgKHN0YXRlID09PSBHZW5TdGF0ZUV4ZWN1dGluZykge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJHZW5lcmF0b3IgaXMgYWxyZWFkeSBydW5uaW5nXCIpO1xuICAgICAgfVxuXG4gICAgICBpZiAoc3RhdGUgPT09IEdlblN0YXRlQ29tcGxldGVkKSB7XG4gICAgICAgIGlmIChtZXRob2QgPT09IFwidGhyb3dcIikge1xuICAgICAgICAgIHRocm93IGFyZztcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIEJlIGZvcmdpdmluZywgcGVyIDI1LjMuMy4zLjMgb2YgdGhlIHNwZWM6XG4gICAgICAgIC8vIGh0dHBzOi8vcGVvcGxlLm1vemlsbGEub3JnL35qb3JlbmRvcmZmL2VzNi1kcmFmdC5odG1sI3NlYy1nZW5lcmF0b3JyZXN1bWVcbiAgICAgICAgcmV0dXJuIGRvbmVSZXN1bHQoKTtcbiAgICAgIH1cblxuICAgICAgd2hpbGUgKHRydWUpIHtcbiAgICAgICAgdmFyIGRlbGVnYXRlID0gY29udGV4dC5kZWxlZ2F0ZTtcbiAgICAgICAgaWYgKGRlbGVnYXRlKSB7XG4gICAgICAgICAgaWYgKG1ldGhvZCA9PT0gXCJyZXR1cm5cIiB8fFxuICAgICAgICAgICAgICAobWV0aG9kID09PSBcInRocm93XCIgJiYgZGVsZWdhdGUuaXRlcmF0b3JbbWV0aG9kXSA9PT0gdW5kZWZpbmVkKSkge1xuICAgICAgICAgICAgLy8gQSByZXR1cm4gb3IgdGhyb3cgKHdoZW4gdGhlIGRlbGVnYXRlIGl0ZXJhdG9yIGhhcyBubyB0aHJvd1xuICAgICAgICAgICAgLy8gbWV0aG9kKSBhbHdheXMgdGVybWluYXRlcyB0aGUgeWllbGQqIGxvb3AuXG4gICAgICAgICAgICBjb250ZXh0LmRlbGVnYXRlID0gbnVsbDtcblxuICAgICAgICAgICAgLy8gSWYgdGhlIGRlbGVnYXRlIGl0ZXJhdG9yIGhhcyBhIHJldHVybiBtZXRob2QsIGdpdmUgaXQgYVxuICAgICAgICAgICAgLy8gY2hhbmNlIHRvIGNsZWFuIHVwLlxuICAgICAgICAgICAgdmFyIHJldHVybk1ldGhvZCA9IGRlbGVnYXRlLml0ZXJhdG9yW1wicmV0dXJuXCJdO1xuICAgICAgICAgICAgaWYgKHJldHVybk1ldGhvZCkge1xuICAgICAgICAgICAgICB2YXIgcmVjb3JkID0gdHJ5Q2F0Y2gocmV0dXJuTWV0aG9kLCBkZWxlZ2F0ZS5pdGVyYXRvciwgYXJnKTtcbiAgICAgICAgICAgICAgaWYgKHJlY29yZC50eXBlID09PSBcInRocm93XCIpIHtcbiAgICAgICAgICAgICAgICAvLyBJZiB0aGUgcmV0dXJuIG1ldGhvZCB0aHJldyBhbiBleGNlcHRpb24sIGxldCB0aGF0XG4gICAgICAgICAgICAgICAgLy8gZXhjZXB0aW9uIHByZXZhaWwgb3ZlciB0aGUgb3JpZ2luYWwgcmV0dXJuIG9yIHRocm93LlxuICAgICAgICAgICAgICAgIG1ldGhvZCA9IFwidGhyb3dcIjtcbiAgICAgICAgICAgICAgICBhcmcgPSByZWNvcmQuYXJnO1xuICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmIChtZXRob2QgPT09IFwicmV0dXJuXCIpIHtcbiAgICAgICAgICAgICAgLy8gQ29udGludWUgd2l0aCB0aGUgb3V0ZXIgcmV0dXJuLCBub3cgdGhhdCB0aGUgZGVsZWdhdGVcbiAgICAgICAgICAgICAgLy8gaXRlcmF0b3IgaGFzIGJlZW4gdGVybWluYXRlZC5cbiAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgdmFyIHJlY29yZCA9IHRyeUNhdGNoKFxuICAgICAgICAgICAgZGVsZWdhdGUuaXRlcmF0b3JbbWV0aG9kXSxcbiAgICAgICAgICAgIGRlbGVnYXRlLml0ZXJhdG9yLFxuICAgICAgICAgICAgYXJnXG4gICAgICAgICAgKTtcblxuICAgICAgICAgIGlmIChyZWNvcmQudHlwZSA9PT0gXCJ0aHJvd1wiKSB7XG4gICAgICAgICAgICBjb250ZXh0LmRlbGVnYXRlID0gbnVsbDtcblxuICAgICAgICAgICAgLy8gTGlrZSByZXR1cm5pbmcgZ2VuZXJhdG9yLnRocm93KHVuY2F1Z2h0KSwgYnV0IHdpdGhvdXQgdGhlXG4gICAgICAgICAgICAvLyBvdmVyaGVhZCBvZiBhbiBleHRyYSBmdW5jdGlvbiBjYWxsLlxuICAgICAgICAgICAgbWV0aG9kID0gXCJ0aHJvd1wiO1xuICAgICAgICAgICAgYXJnID0gcmVjb3JkLmFyZztcbiAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIC8vIERlbGVnYXRlIGdlbmVyYXRvciByYW4gYW5kIGhhbmRsZWQgaXRzIG93biBleGNlcHRpb25zIHNvXG4gICAgICAgICAgLy8gcmVnYXJkbGVzcyBvZiB3aGF0IHRoZSBtZXRob2Qgd2FzLCB3ZSBjb250aW51ZSBhcyBpZiBpdCBpc1xuICAgICAgICAgIC8vIFwibmV4dFwiIHdpdGggYW4gdW5kZWZpbmVkIGFyZy5cbiAgICAgICAgICBtZXRob2QgPSBcIm5leHRcIjtcbiAgICAgICAgICBhcmcgPSB1bmRlZmluZWQ7XG5cbiAgICAgICAgICB2YXIgaW5mbyA9IHJlY29yZC5hcmc7XG4gICAgICAgICAgaWYgKGluZm8uZG9uZSkge1xuICAgICAgICAgICAgY29udGV4dFtkZWxlZ2F0ZS5yZXN1bHROYW1lXSA9IGluZm8udmFsdWU7XG4gICAgICAgICAgICBjb250ZXh0Lm5leHQgPSBkZWxlZ2F0ZS5uZXh0TG9jO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBzdGF0ZSA9IEdlblN0YXRlU3VzcGVuZGVkWWllbGQ7XG4gICAgICAgICAgICByZXR1cm4gaW5mbztcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBjb250ZXh0LmRlbGVnYXRlID0gbnVsbDtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChtZXRob2QgPT09IFwibmV4dFwiKSB7XG4gICAgICAgICAgY29udGV4dC5fc2VudCA9IGFyZztcblxuICAgICAgICAgIGlmIChzdGF0ZSA9PT0gR2VuU3RhdGVTdXNwZW5kZWRZaWVsZCkge1xuICAgICAgICAgICAgY29udGV4dC5zZW50ID0gYXJnO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBjb250ZXh0LnNlbnQgPSB1bmRlZmluZWQ7XG4gICAgICAgICAgfVxuICAgICAgICB9IGVsc2UgaWYgKG1ldGhvZCA9PT0gXCJ0aHJvd1wiKSB7XG4gICAgICAgICAgaWYgKHN0YXRlID09PSBHZW5TdGF0ZVN1c3BlbmRlZFN0YXJ0KSB7XG4gICAgICAgICAgICBzdGF0ZSA9IEdlblN0YXRlQ29tcGxldGVkO1xuICAgICAgICAgICAgdGhyb3cgYXJnO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIGlmIChjb250ZXh0LmRpc3BhdGNoRXhjZXB0aW9uKGFyZykpIHtcbiAgICAgICAgICAgIC8vIElmIHRoZSBkaXNwYXRjaGVkIGV4Y2VwdGlvbiB3YXMgY2F1Z2h0IGJ5IGEgY2F0Y2ggYmxvY2ssXG4gICAgICAgICAgICAvLyB0aGVuIGxldCB0aGF0IGNhdGNoIGJsb2NrIGhhbmRsZSB0aGUgZXhjZXB0aW9uIG5vcm1hbGx5LlxuICAgICAgICAgICAgbWV0aG9kID0gXCJuZXh0XCI7XG4gICAgICAgICAgICBhcmcgPSB1bmRlZmluZWQ7XG4gICAgICAgICAgfVxuXG4gICAgICAgIH0gZWxzZSBpZiAobWV0aG9kID09PSBcInJldHVyblwiKSB7XG4gICAgICAgICAgY29udGV4dC5hYnJ1cHQoXCJyZXR1cm5cIiwgYXJnKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHN0YXRlID0gR2VuU3RhdGVFeGVjdXRpbmc7XG5cbiAgICAgICAgdmFyIHJlY29yZCA9IHRyeUNhdGNoKGlubmVyRm4sIHNlbGYsIGNvbnRleHQpO1xuICAgICAgICBpZiAocmVjb3JkLnR5cGUgPT09IFwibm9ybWFsXCIpIHtcbiAgICAgICAgICAvLyBJZiBhbiBleGNlcHRpb24gaXMgdGhyb3duIGZyb20gaW5uZXJGbiwgd2UgbGVhdmUgc3RhdGUgPT09XG4gICAgICAgICAgLy8gR2VuU3RhdGVFeGVjdXRpbmcgYW5kIGxvb3AgYmFjayBmb3IgYW5vdGhlciBpbnZvY2F0aW9uLlxuICAgICAgICAgIHN0YXRlID0gY29udGV4dC5kb25lXG4gICAgICAgICAgICA/IEdlblN0YXRlQ29tcGxldGVkXG4gICAgICAgICAgICA6IEdlblN0YXRlU3VzcGVuZGVkWWllbGQ7XG5cbiAgICAgICAgICB2YXIgaW5mbyA9IHtcbiAgICAgICAgICAgIHZhbHVlOiByZWNvcmQuYXJnLFxuICAgICAgICAgICAgZG9uZTogY29udGV4dC5kb25lXG4gICAgICAgICAgfTtcblxuICAgICAgICAgIGlmIChyZWNvcmQuYXJnID09PSBDb250aW51ZVNlbnRpbmVsKSB7XG4gICAgICAgICAgICBpZiAoY29udGV4dC5kZWxlZ2F0ZSAmJiBtZXRob2QgPT09IFwibmV4dFwiKSB7XG4gICAgICAgICAgICAgIC8vIERlbGliZXJhdGVseSBmb3JnZXQgdGhlIGxhc3Qgc2VudCB2YWx1ZSBzbyB0aGF0IHdlIGRvbid0XG4gICAgICAgICAgICAgIC8vIGFjY2lkZW50YWxseSBwYXNzIGl0IG9uIHRvIHRoZSBkZWxlZ2F0ZS5cbiAgICAgICAgICAgICAgYXJnID0gdW5kZWZpbmVkO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICByZXR1cm4gaW5mbztcbiAgICAgICAgICB9XG5cbiAgICAgICAgfSBlbHNlIGlmIChyZWNvcmQudHlwZSA9PT0gXCJ0aHJvd1wiKSB7XG4gICAgICAgICAgc3RhdGUgPSBHZW5TdGF0ZUNvbXBsZXRlZDtcbiAgICAgICAgICAvLyBEaXNwYXRjaCB0aGUgZXhjZXB0aW9uIGJ5IGxvb3BpbmcgYmFjayBhcm91bmQgdG8gdGhlXG4gICAgICAgICAgLy8gY29udGV4dC5kaXNwYXRjaEV4Y2VwdGlvbihhcmcpIGNhbGwgYWJvdmUuXG4gICAgICAgICAgbWV0aG9kID0gXCJ0aHJvd1wiO1xuICAgICAgICAgIGFyZyA9IHJlY29yZC5hcmc7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9O1xuICB9XG5cbiAgLy8gRGVmaW5lIEdlbmVyYXRvci5wcm90b3R5cGUue25leHQsdGhyb3cscmV0dXJufSBpbiB0ZXJtcyBvZiB0aGVcbiAgLy8gdW5pZmllZCAuX2ludm9rZSBoZWxwZXIgbWV0aG9kLlxuICBkZWZpbmVJdGVyYXRvck1ldGhvZHMoR3ApO1xuXG4gIEdwW2l0ZXJhdG9yU3ltYm9sXSA9IGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiB0aGlzO1xuICB9O1xuXG4gIEdwLnRvU3RyaW5nID0gZnVuY3Rpb24oKSB7XG4gICAgcmV0dXJuIFwiW29iamVjdCBHZW5lcmF0b3JdXCI7XG4gIH07XG5cbiAgZnVuY3Rpb24gcHVzaFRyeUVudHJ5KGxvY3MpIHtcbiAgICB2YXIgZW50cnkgPSB7IHRyeUxvYzogbG9jc1swXSB9O1xuXG4gICAgaWYgKDEgaW4gbG9jcykge1xuICAgICAgZW50cnkuY2F0Y2hMb2MgPSBsb2NzWzFdO1xuICAgIH1cblxuICAgIGlmICgyIGluIGxvY3MpIHtcbiAgICAgIGVudHJ5LmZpbmFsbHlMb2MgPSBsb2NzWzJdO1xuICAgICAgZW50cnkuYWZ0ZXJMb2MgPSBsb2NzWzNdO1xuICAgIH1cblxuICAgIHRoaXMudHJ5RW50cmllcy5wdXNoKGVudHJ5KTtcbiAgfVxuXG4gIGZ1bmN0aW9uIHJlc2V0VHJ5RW50cnkoZW50cnkpIHtcbiAgICB2YXIgcmVjb3JkID0gZW50cnkuY29tcGxldGlvbiB8fCB7fTtcbiAgICByZWNvcmQudHlwZSA9IFwibm9ybWFsXCI7XG4gICAgZGVsZXRlIHJlY29yZC5hcmc7XG4gICAgZW50cnkuY29tcGxldGlvbiA9IHJlY29yZDtcbiAgfVxuXG4gIGZ1bmN0aW9uIENvbnRleHQodHJ5TG9jc0xpc3QpIHtcbiAgICAvLyBUaGUgcm9vdCBlbnRyeSBvYmplY3QgKGVmZmVjdGl2ZWx5IGEgdHJ5IHN0YXRlbWVudCB3aXRob3V0IGEgY2F0Y2hcbiAgICAvLyBvciBhIGZpbmFsbHkgYmxvY2spIGdpdmVzIHVzIGEgcGxhY2UgdG8gc3RvcmUgdmFsdWVzIHRocm93biBmcm9tXG4gICAgLy8gbG9jYXRpb25zIHdoZXJlIHRoZXJlIGlzIG5vIGVuY2xvc2luZyB0cnkgc3RhdGVtZW50LlxuICAgIHRoaXMudHJ5RW50cmllcyA9IFt7IHRyeUxvYzogXCJyb290XCIgfV07XG4gICAgdHJ5TG9jc0xpc3QuZm9yRWFjaChwdXNoVHJ5RW50cnksIHRoaXMpO1xuICAgIHRoaXMucmVzZXQodHJ1ZSk7XG4gIH1cblxuICBydW50aW1lLmtleXMgPSBmdW5jdGlvbihvYmplY3QpIHtcbiAgICB2YXIga2V5cyA9IFtdO1xuICAgIGZvciAodmFyIGtleSBpbiBvYmplY3QpIHtcbiAgICAgIGtleXMucHVzaChrZXkpO1xuICAgIH1cbiAgICBrZXlzLnJldmVyc2UoKTtcblxuICAgIC8vIFJhdGhlciB0aGFuIHJldHVybmluZyBhbiBvYmplY3Qgd2l0aCBhIG5leHQgbWV0aG9kLCB3ZSBrZWVwXG4gICAgLy8gdGhpbmdzIHNpbXBsZSBhbmQgcmV0dXJuIHRoZSBuZXh0IGZ1bmN0aW9uIGl0c2VsZi5cbiAgICByZXR1cm4gZnVuY3Rpb24gbmV4dCgpIHtcbiAgICAgIHdoaWxlIChrZXlzLmxlbmd0aCkge1xuICAgICAgICB2YXIga2V5ID0ga2V5cy5wb3AoKTtcbiAgICAgICAgaWYgKGtleSBpbiBvYmplY3QpIHtcbiAgICAgICAgICBuZXh0LnZhbHVlID0ga2V5O1xuICAgICAgICAgIG5leHQuZG9uZSA9IGZhbHNlO1xuICAgICAgICAgIHJldHVybiBuZXh0O1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIC8vIFRvIGF2b2lkIGNyZWF0aW5nIGFuIGFkZGl0aW9uYWwgb2JqZWN0LCB3ZSBqdXN0IGhhbmcgdGhlIC52YWx1ZVxuICAgICAgLy8gYW5kIC5kb25lIHByb3BlcnRpZXMgb2ZmIHRoZSBuZXh0IGZ1bmN0aW9uIG9iamVjdCBpdHNlbGYuIFRoaXNcbiAgICAgIC8vIGFsc28gZW5zdXJlcyB0aGF0IHRoZSBtaW5pZmllciB3aWxsIG5vdCBhbm9ueW1pemUgdGhlIGZ1bmN0aW9uLlxuICAgICAgbmV4dC5kb25lID0gdHJ1ZTtcbiAgICAgIHJldHVybiBuZXh0O1xuICAgIH07XG4gIH07XG5cbiAgZnVuY3Rpb24gdmFsdWVzKGl0ZXJhYmxlKSB7XG4gICAgaWYgKGl0ZXJhYmxlKSB7XG4gICAgICB2YXIgaXRlcmF0b3JNZXRob2QgPSBpdGVyYWJsZVtpdGVyYXRvclN5bWJvbF07XG4gICAgICBpZiAoaXRlcmF0b3JNZXRob2QpIHtcbiAgICAgICAgcmV0dXJuIGl0ZXJhdG9yTWV0aG9kLmNhbGwoaXRlcmFibGUpO1xuICAgICAgfVxuXG4gICAgICBpZiAodHlwZW9mIGl0ZXJhYmxlLm5leHQgPT09IFwiZnVuY3Rpb25cIikge1xuICAgICAgICByZXR1cm4gaXRlcmFibGU7XG4gICAgICB9XG5cbiAgICAgIGlmICghaXNOYU4oaXRlcmFibGUubGVuZ3RoKSkge1xuICAgICAgICB2YXIgaSA9IC0xLCBuZXh0ID0gZnVuY3Rpb24gbmV4dCgpIHtcbiAgICAgICAgICB3aGlsZSAoKytpIDwgaXRlcmFibGUubGVuZ3RoKSB7XG4gICAgICAgICAgICBpZiAoaGFzT3duLmNhbGwoaXRlcmFibGUsIGkpKSB7XG4gICAgICAgICAgICAgIG5leHQudmFsdWUgPSBpdGVyYWJsZVtpXTtcbiAgICAgICAgICAgICAgbmV4dC5kb25lID0gZmFsc2U7XG4gICAgICAgICAgICAgIHJldHVybiBuZXh0O1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cblxuICAgICAgICAgIG5leHQudmFsdWUgPSB1bmRlZmluZWQ7XG4gICAgICAgICAgbmV4dC5kb25lID0gdHJ1ZTtcblxuICAgICAgICAgIHJldHVybiBuZXh0O1xuICAgICAgICB9O1xuXG4gICAgICAgIHJldHVybiBuZXh0Lm5leHQgPSBuZXh0O1xuICAgICAgfVxuICAgIH1cblxuICAgIC8vIFJldHVybiBhbiBpdGVyYXRvciB3aXRoIG5vIHZhbHVlcy5cbiAgICByZXR1cm4geyBuZXh0OiBkb25lUmVzdWx0IH07XG4gIH1cbiAgcnVudGltZS52YWx1ZXMgPSB2YWx1ZXM7XG5cbiAgZnVuY3Rpb24gZG9uZVJlc3VsdCgpIHtcbiAgICByZXR1cm4geyB2YWx1ZTogdW5kZWZpbmVkLCBkb25lOiB0cnVlIH07XG4gIH1cblxuICBDb250ZXh0LnByb3RvdHlwZSA9IHtcbiAgICBjb25zdHJ1Y3RvcjogQ29udGV4dCxcblxuICAgIHJlc2V0OiBmdW5jdGlvbihza2lwVGVtcFJlc2V0KSB7XG4gICAgICB0aGlzLnByZXYgPSAwO1xuICAgICAgdGhpcy5uZXh0ID0gMDtcbiAgICAgIHRoaXMuc2VudCA9IHVuZGVmaW5lZDtcbiAgICAgIHRoaXMuZG9uZSA9IGZhbHNlO1xuICAgICAgdGhpcy5kZWxlZ2F0ZSA9IG51bGw7XG5cbiAgICAgIHRoaXMudHJ5RW50cmllcy5mb3JFYWNoKHJlc2V0VHJ5RW50cnkpO1xuXG4gICAgICBpZiAoIXNraXBUZW1wUmVzZXQpIHtcbiAgICAgICAgZm9yICh2YXIgbmFtZSBpbiB0aGlzKSB7XG4gICAgICAgICAgLy8gTm90IHN1cmUgYWJvdXQgdGhlIG9wdGltYWwgb3JkZXIgb2YgdGhlc2UgY29uZGl0aW9uczpcbiAgICAgICAgICBpZiAobmFtZS5jaGFyQXQoMCkgPT09IFwidFwiICYmXG4gICAgICAgICAgICAgIGhhc093bi5jYWxsKHRoaXMsIG5hbWUpICYmXG4gICAgICAgICAgICAgICFpc05hTigrbmFtZS5zbGljZSgxKSkpIHtcbiAgICAgICAgICAgIHRoaXNbbmFtZV0gPSB1bmRlZmluZWQ7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfSxcblxuICAgIHN0b3A6IGZ1bmN0aW9uKCkge1xuICAgICAgdGhpcy5kb25lID0gdHJ1ZTtcblxuICAgICAgdmFyIHJvb3RFbnRyeSA9IHRoaXMudHJ5RW50cmllc1swXTtcbiAgICAgIHZhciByb290UmVjb3JkID0gcm9vdEVudHJ5LmNvbXBsZXRpb247XG4gICAgICBpZiAocm9vdFJlY29yZC50eXBlID09PSBcInRocm93XCIpIHtcbiAgICAgICAgdGhyb3cgcm9vdFJlY29yZC5hcmc7XG4gICAgICB9XG5cbiAgICAgIHJldHVybiB0aGlzLnJ2YWw7XG4gICAgfSxcblxuICAgIGRpc3BhdGNoRXhjZXB0aW9uOiBmdW5jdGlvbihleGNlcHRpb24pIHtcbiAgICAgIGlmICh0aGlzLmRvbmUpIHtcbiAgICAgICAgdGhyb3cgZXhjZXB0aW9uO1xuICAgICAgfVxuXG4gICAgICB2YXIgY29udGV4dCA9IHRoaXM7XG4gICAgICBmdW5jdGlvbiBoYW5kbGUobG9jLCBjYXVnaHQpIHtcbiAgICAgICAgcmVjb3JkLnR5cGUgPSBcInRocm93XCI7XG4gICAgICAgIHJlY29yZC5hcmcgPSBleGNlcHRpb247XG4gICAgICAgIGNvbnRleHQubmV4dCA9IGxvYztcbiAgICAgICAgcmV0dXJuICEhY2F1Z2h0O1xuICAgICAgfVxuXG4gICAgICBmb3IgKHZhciBpID0gdGhpcy50cnlFbnRyaWVzLmxlbmd0aCAtIDE7IGkgPj0gMDsgLS1pKSB7XG4gICAgICAgIHZhciBlbnRyeSA9IHRoaXMudHJ5RW50cmllc1tpXTtcbiAgICAgICAgdmFyIHJlY29yZCA9IGVudHJ5LmNvbXBsZXRpb247XG5cbiAgICAgICAgaWYgKGVudHJ5LnRyeUxvYyA9PT0gXCJyb290XCIpIHtcbiAgICAgICAgICAvLyBFeGNlcHRpb24gdGhyb3duIG91dHNpZGUgb2YgYW55IHRyeSBibG9jayB0aGF0IGNvdWxkIGhhbmRsZVxuICAgICAgICAgIC8vIGl0LCBzbyBzZXQgdGhlIGNvbXBsZXRpb24gdmFsdWUgb2YgdGhlIGVudGlyZSBmdW5jdGlvbiB0b1xuICAgICAgICAgIC8vIHRocm93IHRoZSBleGNlcHRpb24uXG4gICAgICAgICAgcmV0dXJuIGhhbmRsZShcImVuZFwiKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChlbnRyeS50cnlMb2MgPD0gdGhpcy5wcmV2KSB7XG4gICAgICAgICAgdmFyIGhhc0NhdGNoID0gaGFzT3duLmNhbGwoZW50cnksIFwiY2F0Y2hMb2NcIik7XG4gICAgICAgICAgdmFyIGhhc0ZpbmFsbHkgPSBoYXNPd24uY2FsbChlbnRyeSwgXCJmaW5hbGx5TG9jXCIpO1xuXG4gICAgICAgICAgaWYgKGhhc0NhdGNoICYmIGhhc0ZpbmFsbHkpIHtcbiAgICAgICAgICAgIGlmICh0aGlzLnByZXYgPCBlbnRyeS5jYXRjaExvYykge1xuICAgICAgICAgICAgICByZXR1cm4gaGFuZGxlKGVudHJ5LmNhdGNoTG9jLCB0cnVlKTtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAodGhpcy5wcmV2IDwgZW50cnkuZmluYWxseUxvYykge1xuICAgICAgICAgICAgICByZXR1cm4gaGFuZGxlKGVudHJ5LmZpbmFsbHlMb2MpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgfSBlbHNlIGlmIChoYXNDYXRjaCkge1xuICAgICAgICAgICAgaWYgKHRoaXMucHJldiA8IGVudHJ5LmNhdGNoTG9jKSB7XG4gICAgICAgICAgICAgIHJldHVybiBoYW5kbGUoZW50cnkuY2F0Y2hMb2MsIHRydWUpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgfSBlbHNlIGlmIChoYXNGaW5hbGx5KSB7XG4gICAgICAgICAgICBpZiAodGhpcy5wcmV2IDwgZW50cnkuZmluYWxseUxvYykge1xuICAgICAgICAgICAgICByZXR1cm4gaGFuZGxlKGVudHJ5LmZpbmFsbHlMb2MpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihcInRyeSBzdGF0ZW1lbnQgd2l0aG91dCBjYXRjaCBvciBmaW5hbGx5XCIpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0sXG5cbiAgICBhYnJ1cHQ6IGZ1bmN0aW9uKHR5cGUsIGFyZykge1xuICAgICAgZm9yICh2YXIgaSA9IHRoaXMudHJ5RW50cmllcy5sZW5ndGggLSAxOyBpID49IDA7IC0taSkge1xuICAgICAgICB2YXIgZW50cnkgPSB0aGlzLnRyeUVudHJpZXNbaV07XG4gICAgICAgIGlmIChlbnRyeS50cnlMb2MgPD0gdGhpcy5wcmV2ICYmXG4gICAgICAgICAgICBoYXNPd24uY2FsbChlbnRyeSwgXCJmaW5hbGx5TG9jXCIpICYmXG4gICAgICAgICAgICB0aGlzLnByZXYgPCBlbnRyeS5maW5hbGx5TG9jKSB7XG4gICAgICAgICAgdmFyIGZpbmFsbHlFbnRyeSA9IGVudHJ5O1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIGlmIChmaW5hbGx5RW50cnkgJiZcbiAgICAgICAgICAodHlwZSA9PT0gXCJicmVha1wiIHx8XG4gICAgICAgICAgIHR5cGUgPT09IFwiY29udGludWVcIikgJiZcbiAgICAgICAgICBmaW5hbGx5RW50cnkudHJ5TG9jIDw9IGFyZyAmJlxuICAgICAgICAgIGFyZyA8PSBmaW5hbGx5RW50cnkuZmluYWxseUxvYykge1xuICAgICAgICAvLyBJZ25vcmUgdGhlIGZpbmFsbHkgZW50cnkgaWYgY29udHJvbCBpcyBub3QganVtcGluZyB0byBhXG4gICAgICAgIC8vIGxvY2F0aW9uIG91dHNpZGUgdGhlIHRyeS9jYXRjaCBibG9jay5cbiAgICAgICAgZmluYWxseUVudHJ5ID0gbnVsbDtcbiAgICAgIH1cblxuICAgICAgdmFyIHJlY29yZCA9IGZpbmFsbHlFbnRyeSA/IGZpbmFsbHlFbnRyeS5jb21wbGV0aW9uIDoge307XG4gICAgICByZWNvcmQudHlwZSA9IHR5cGU7XG4gICAgICByZWNvcmQuYXJnID0gYXJnO1xuXG4gICAgICBpZiAoZmluYWxseUVudHJ5KSB7XG4gICAgICAgIHRoaXMubmV4dCA9IGZpbmFsbHlFbnRyeS5maW5hbGx5TG9jO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhpcy5jb21wbGV0ZShyZWNvcmQpO1xuICAgICAgfVxuXG4gICAgICByZXR1cm4gQ29udGludWVTZW50aW5lbDtcbiAgICB9LFxuXG4gICAgY29tcGxldGU6IGZ1bmN0aW9uKHJlY29yZCwgYWZ0ZXJMb2MpIHtcbiAgICAgIGlmIChyZWNvcmQudHlwZSA9PT0gXCJ0aHJvd1wiKSB7XG4gICAgICAgIHRocm93IHJlY29yZC5hcmc7XG4gICAgICB9XG5cbiAgICAgIGlmIChyZWNvcmQudHlwZSA9PT0gXCJicmVha1wiIHx8XG4gICAgICAgICAgcmVjb3JkLnR5cGUgPT09IFwiY29udGludWVcIikge1xuICAgICAgICB0aGlzLm5leHQgPSByZWNvcmQuYXJnO1xuICAgICAgfSBlbHNlIGlmIChyZWNvcmQudHlwZSA9PT0gXCJyZXR1cm5cIikge1xuICAgICAgICB0aGlzLnJ2YWwgPSByZWNvcmQuYXJnO1xuICAgICAgICB0aGlzLm5leHQgPSBcImVuZFwiO1xuICAgICAgfSBlbHNlIGlmIChyZWNvcmQudHlwZSA9PT0gXCJub3JtYWxcIiAmJiBhZnRlckxvYykge1xuICAgICAgICB0aGlzLm5leHQgPSBhZnRlckxvYztcbiAgICAgIH1cbiAgICB9LFxuXG4gICAgZmluaXNoOiBmdW5jdGlvbihmaW5hbGx5TG9jKSB7XG4gICAgICBmb3IgKHZhciBpID0gdGhpcy50cnlFbnRyaWVzLmxlbmd0aCAtIDE7IGkgPj0gMDsgLS1pKSB7XG4gICAgICAgIHZhciBlbnRyeSA9IHRoaXMudHJ5RW50cmllc1tpXTtcbiAgICAgICAgaWYgKGVudHJ5LmZpbmFsbHlMb2MgPT09IGZpbmFsbHlMb2MpIHtcbiAgICAgICAgICB0aGlzLmNvbXBsZXRlKGVudHJ5LmNvbXBsZXRpb24sIGVudHJ5LmFmdGVyTG9jKTtcbiAgICAgICAgICByZXNldFRyeUVudHJ5KGVudHJ5KTtcbiAgICAgICAgICByZXR1cm4gQ29udGludWVTZW50aW5lbDtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0sXG5cbiAgICBcImNhdGNoXCI6IGZ1bmN0aW9uKHRyeUxvYykge1xuICAgICAgZm9yICh2YXIgaSA9IHRoaXMudHJ5RW50cmllcy5sZW5ndGggLSAxOyBpID49IDA7IC0taSkge1xuICAgICAgICB2YXIgZW50cnkgPSB0aGlzLnRyeUVudHJpZXNbaV07XG4gICAgICAgIGlmIChlbnRyeS50cnlMb2MgPT09IHRyeUxvYykge1xuICAgICAgICAgIHZhciByZWNvcmQgPSBlbnRyeS5jb21wbGV0aW9uO1xuICAgICAgICAgIGlmIChyZWNvcmQudHlwZSA9PT0gXCJ0aHJvd1wiKSB7XG4gICAgICAgICAgICB2YXIgdGhyb3duID0gcmVjb3JkLmFyZztcbiAgICAgICAgICAgIHJlc2V0VHJ5RW50cnkoZW50cnkpO1xuICAgICAgICAgIH1cbiAgICAgICAgICByZXR1cm4gdGhyb3duO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIC8vIFRoZSBjb250ZXh0LmNhdGNoIG1ldGhvZCBtdXN0IG9ubHkgYmUgY2FsbGVkIHdpdGggYSBsb2NhdGlvblxuICAgICAgLy8gYXJndW1lbnQgdGhhdCBjb3JyZXNwb25kcyB0byBhIGtub3duIGNhdGNoIGJsb2NrLlxuICAgICAgdGhyb3cgbmV3IEVycm9yKFwiaWxsZWdhbCBjYXRjaCBhdHRlbXB0XCIpO1xuICAgIH0sXG5cbiAgICBkZWxlZ2F0ZVlpZWxkOiBmdW5jdGlvbihpdGVyYWJsZSwgcmVzdWx0TmFtZSwgbmV4dExvYykge1xuICAgICAgdGhpcy5kZWxlZ2F0ZSA9IHtcbiAgICAgICAgaXRlcmF0b3I6IHZhbHVlcyhpdGVyYWJsZSksXG4gICAgICAgIHJlc3VsdE5hbWU6IHJlc3VsdE5hbWUsXG4gICAgICAgIG5leHRMb2M6IG5leHRMb2NcbiAgICAgIH07XG5cbiAgICAgIHJldHVybiBDb250aW51ZVNlbnRpbmVsO1xuICAgIH1cbiAgfTtcbn0pKFxuICAvLyBBbW9uZyB0aGUgdmFyaW91cyB0cmlja3MgZm9yIG9idGFpbmluZyBhIHJlZmVyZW5jZSB0byB0aGUgZ2xvYmFsXG4gIC8vIG9iamVjdCwgdGhpcyBzZWVtcyB0byBiZSB0aGUgbW9zdCByZWxpYWJsZSB0ZWNobmlxdWUgdGhhdCBkb2VzIG5vdFxuICAvLyB1c2UgaW5kaXJlY3QgZXZhbCAod2hpY2ggdmlvbGF0ZXMgQ29udGVudCBTZWN1cml0eSBQb2xpY3kpLlxuICB0eXBlb2YgZ2xvYmFsID09PSBcIm9iamVjdFwiID8gZ2xvYmFsIDpcbiAgdHlwZW9mIHdpbmRvdyA9PT0gXCJvYmplY3RcIiA/IHdpbmRvdyA6XG4gIHR5cGVvZiBzZWxmID09PSBcIm9iamVjdFwiID8gc2VsZiA6IHRoaXNcbik7XG4iLCIvLyBUaGlzIGZpbGUgY2FuIGJlIHJlcXVpcmVkIGluIEJyb3dzZXJpZnkgYW5kIE5vZGUuanMgZm9yIGF1dG9tYXRpYyBwb2x5ZmlsbFxuLy8gVG8gdXNlIGl0OiAgcmVxdWlyZSgnZXM2LXByb21pc2UvYXV0bycpO1xuJ3VzZSBzdHJpY3QnO1xubW9kdWxlLmV4cG9ydHMgPSByZXF1aXJlKCcuLycpLnBvbHlmaWxsKCk7XG4iLCIvKiFcbiAqIEBvdmVydmlldyBlczYtcHJvbWlzZSAtIGEgdGlueSBpbXBsZW1lbnRhdGlvbiBvZiBQcm9taXNlcy9BKy5cbiAqIEBjb3B5cmlnaHQgQ29weXJpZ2h0IChjKSAyMDE0IFllaHVkYSBLYXR6LCBUb20gRGFsZSwgU3RlZmFuIFBlbm5lciBhbmQgY29udHJpYnV0b3JzIChDb252ZXJzaW9uIHRvIEVTNiBBUEkgYnkgSmFrZSBBcmNoaWJhbGQpXG4gKiBAbGljZW5zZSAgIExpY2Vuc2VkIHVuZGVyIE1JVCBsaWNlbnNlXG4gKiAgICAgICAgICAgIFNlZSBodHRwczovL3Jhdy5naXRodWJ1c2VyY29udGVudC5jb20vc3RlZmFucGVubmVyL2VzNi1wcm9taXNlL21hc3Rlci9MSUNFTlNFXG4gKiBAdmVyc2lvbiAgIHY0LjIuNCszMTRlNDgzMVxuICovXG5cbihmdW5jdGlvbiAoZ2xvYmFsLCBmYWN0b3J5KSB7XG5cdHR5cGVvZiBleHBvcnRzID09PSAnb2JqZWN0JyAmJiB0eXBlb2YgbW9kdWxlICE9PSAndW5kZWZpbmVkJyA/IG1vZHVsZS5leHBvcnRzID0gZmFjdG9yeSgpIDpcblx0dHlwZW9mIGRlZmluZSA9PT0gJ2Z1bmN0aW9uJyAmJiBkZWZpbmUuYW1kID8gZGVmaW5lKGZhY3RvcnkpIDpcblx0KGdsb2JhbC5FUzZQcm9taXNlID0gZmFjdG9yeSgpKTtcbn0odGhpcywgKGZ1bmN0aW9uICgpIHsgJ3VzZSBzdHJpY3QnO1xuXG5mdW5jdGlvbiBvYmplY3RPckZ1bmN0aW9uKHgpIHtcbiAgdmFyIHR5cGUgPSB0eXBlb2YgeDtcbiAgcmV0dXJuIHggIT09IG51bGwgJiYgKHR5cGUgPT09ICdvYmplY3QnIHx8IHR5cGUgPT09ICdmdW5jdGlvbicpO1xufVxuXG5mdW5jdGlvbiBpc0Z1bmN0aW9uKHgpIHtcbiAgcmV0dXJuIHR5cGVvZiB4ID09PSAnZnVuY3Rpb24nO1xufVxuXG5cblxudmFyIF9pc0FycmF5ID0gdm9pZCAwO1xuaWYgKEFycmF5LmlzQXJyYXkpIHtcbiAgX2lzQXJyYXkgPSBBcnJheS5pc0FycmF5O1xufSBlbHNlIHtcbiAgX2lzQXJyYXkgPSBmdW5jdGlvbiAoeCkge1xuICAgIHJldHVybiBPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nLmNhbGwoeCkgPT09ICdbb2JqZWN0IEFycmF5XSc7XG4gIH07XG59XG5cbnZhciBpc0FycmF5ID0gX2lzQXJyYXk7XG5cbnZhciBsZW4gPSAwO1xudmFyIHZlcnR4TmV4dCA9IHZvaWQgMDtcbnZhciBjdXN0b21TY2hlZHVsZXJGbiA9IHZvaWQgMDtcblxudmFyIGFzYXAgPSBmdW5jdGlvbiBhc2FwKGNhbGxiYWNrLCBhcmcpIHtcbiAgcXVldWVbbGVuXSA9IGNhbGxiYWNrO1xuICBxdWV1ZVtsZW4gKyAxXSA9IGFyZztcbiAgbGVuICs9IDI7XG4gIGlmIChsZW4gPT09IDIpIHtcbiAgICAvLyBJZiBsZW4gaXMgMiwgdGhhdCBtZWFucyB0aGF0IHdlIG5lZWQgdG8gc2NoZWR1bGUgYW4gYXN5bmMgZmx1c2guXG4gICAgLy8gSWYgYWRkaXRpb25hbCBjYWxsYmFja3MgYXJlIHF1ZXVlZCBiZWZvcmUgdGhlIHF1ZXVlIGlzIGZsdXNoZWQsIHRoZXlcbiAgICAvLyB3aWxsIGJlIHByb2Nlc3NlZCBieSB0aGlzIGZsdXNoIHRoYXQgd2UgYXJlIHNjaGVkdWxpbmcuXG4gICAgaWYgKGN1c3RvbVNjaGVkdWxlckZuKSB7XG4gICAgICBjdXN0b21TY2hlZHVsZXJGbihmbHVzaCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHNjaGVkdWxlRmx1c2goKTtcbiAgICB9XG4gIH1cbn07XG5cbmZ1bmN0aW9uIHNldFNjaGVkdWxlcihzY2hlZHVsZUZuKSB7XG4gIGN1c3RvbVNjaGVkdWxlckZuID0gc2NoZWR1bGVGbjtcbn1cblxuZnVuY3Rpb24gc2V0QXNhcChhc2FwRm4pIHtcbiAgYXNhcCA9IGFzYXBGbjtcbn1cblxudmFyIGJyb3dzZXJXaW5kb3cgPSB0eXBlb2Ygd2luZG93ICE9PSAndW5kZWZpbmVkJyA/IHdpbmRvdyA6IHVuZGVmaW5lZDtcbnZhciBicm93c2VyR2xvYmFsID0gYnJvd3NlcldpbmRvdyB8fCB7fTtcbnZhciBCcm93c2VyTXV0YXRpb25PYnNlcnZlciA9IGJyb3dzZXJHbG9iYWwuTXV0YXRpb25PYnNlcnZlciB8fCBicm93c2VyR2xvYmFsLldlYktpdE11dGF0aW9uT2JzZXJ2ZXI7XG52YXIgaXNOb2RlID0gdHlwZW9mIHNlbGYgPT09ICd1bmRlZmluZWQnICYmIHR5cGVvZiBwcm9jZXNzICE9PSAndW5kZWZpbmVkJyAmJiB7fS50b1N0cmluZy5jYWxsKHByb2Nlc3MpID09PSAnW29iamVjdCBwcm9jZXNzXSc7XG5cbi8vIHRlc3QgZm9yIHdlYiB3b3JrZXIgYnV0IG5vdCBpbiBJRTEwXG52YXIgaXNXb3JrZXIgPSB0eXBlb2YgVWludDhDbGFtcGVkQXJyYXkgIT09ICd1bmRlZmluZWQnICYmIHR5cGVvZiBpbXBvcnRTY3JpcHRzICE9PSAndW5kZWZpbmVkJyAmJiB0eXBlb2YgTWVzc2FnZUNoYW5uZWwgIT09ICd1bmRlZmluZWQnO1xuXG4vLyBub2RlXG5mdW5jdGlvbiB1c2VOZXh0VGljaygpIHtcbiAgLy8gbm9kZSB2ZXJzaW9uIDAuMTAueCBkaXNwbGF5cyBhIGRlcHJlY2F0aW9uIHdhcm5pbmcgd2hlbiBuZXh0VGljayBpcyB1c2VkIHJlY3Vyc2l2ZWx5XG4gIC8vIHNlZSBodHRwczovL2dpdGh1Yi5jb20vY3Vqb2pzL3doZW4vaXNzdWVzLzQxMCBmb3IgZGV0YWlsc1xuICByZXR1cm4gZnVuY3Rpb24gKCkge1xuICAgIHJldHVybiBwcm9jZXNzLm5leHRUaWNrKGZsdXNoKTtcbiAgfTtcbn1cblxuLy8gdmVydHhcbmZ1bmN0aW9uIHVzZVZlcnR4VGltZXIoKSB7XG4gIGlmICh0eXBlb2YgdmVydHhOZXh0ICE9PSAndW5kZWZpbmVkJykge1xuICAgIHJldHVybiBmdW5jdGlvbiAoKSB7XG4gICAgICB2ZXJ0eE5leHQoZmx1c2gpO1xuICAgIH07XG4gIH1cblxuICByZXR1cm4gdXNlU2V0VGltZW91dCgpO1xufVxuXG5mdW5jdGlvbiB1c2VNdXRhdGlvbk9ic2VydmVyKCkge1xuICB2YXIgaXRlcmF0aW9ucyA9IDA7XG4gIHZhciBvYnNlcnZlciA9IG5ldyBCcm93c2VyTXV0YXRpb25PYnNlcnZlcihmbHVzaCk7XG4gIHZhciBub2RlID0gZG9jdW1lbnQuY3JlYXRlVGV4dE5vZGUoJycpO1xuICBvYnNlcnZlci5vYnNlcnZlKG5vZGUsIHsgY2hhcmFjdGVyRGF0YTogdHJ1ZSB9KTtcblxuICByZXR1cm4gZnVuY3Rpb24gKCkge1xuICAgIG5vZGUuZGF0YSA9IGl0ZXJhdGlvbnMgPSArK2l0ZXJhdGlvbnMgJSAyO1xuICB9O1xufVxuXG4vLyB3ZWIgd29ya2VyXG5mdW5jdGlvbiB1c2VNZXNzYWdlQ2hhbm5lbCgpIHtcbiAgdmFyIGNoYW5uZWwgPSBuZXcgTWVzc2FnZUNoYW5uZWwoKTtcbiAgY2hhbm5lbC5wb3J0MS5vbm1lc3NhZ2UgPSBmbHVzaDtcbiAgcmV0dXJuIGZ1bmN0aW9uICgpIHtcbiAgICByZXR1cm4gY2hhbm5lbC5wb3J0Mi5wb3N0TWVzc2FnZSgwKTtcbiAgfTtcbn1cblxuZnVuY3Rpb24gdXNlU2V0VGltZW91dCgpIHtcbiAgLy8gU3RvcmUgc2V0VGltZW91dCByZWZlcmVuY2Ugc28gZXM2LXByb21pc2Ugd2lsbCBiZSB1bmFmZmVjdGVkIGJ5XG4gIC8vIG90aGVyIGNvZGUgbW9kaWZ5aW5nIHNldFRpbWVvdXQgKGxpa2Ugc2lub24udXNlRmFrZVRpbWVycygpKVxuICB2YXIgZ2xvYmFsU2V0VGltZW91dCA9IHNldFRpbWVvdXQ7XG4gIHJldHVybiBmdW5jdGlvbiAoKSB7XG4gICAgcmV0dXJuIGdsb2JhbFNldFRpbWVvdXQoZmx1c2gsIDEpO1xuICB9O1xufVxuXG52YXIgcXVldWUgPSBuZXcgQXJyYXkoMTAwMCk7XG5mdW5jdGlvbiBmbHVzaCgpIHtcbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBsZW47IGkgKz0gMikge1xuICAgIHZhciBjYWxsYmFjayA9IHF1ZXVlW2ldO1xuICAgIHZhciBhcmcgPSBxdWV1ZVtpICsgMV07XG5cbiAgICBjYWxsYmFjayhhcmcpO1xuXG4gICAgcXVldWVbaV0gPSB1bmRlZmluZWQ7XG4gICAgcXVldWVbaSArIDFdID0gdW5kZWZpbmVkO1xuICB9XG5cbiAgbGVuID0gMDtcbn1cblxuZnVuY3Rpb24gYXR0ZW1wdFZlcnR4KCkge1xuICB0cnkge1xuICAgIHZhciB2ZXJ0eCA9IEZ1bmN0aW9uKCdyZXR1cm4gdGhpcycpKCkucmVxdWlyZSgndmVydHgnKTtcbiAgICB2ZXJ0eE5leHQgPSB2ZXJ0eC5ydW5Pbkxvb3AgfHwgdmVydHgucnVuT25Db250ZXh0O1xuICAgIHJldHVybiB1c2VWZXJ0eFRpbWVyKCk7XG4gIH0gY2F0Y2ggKGUpIHtcbiAgICByZXR1cm4gdXNlU2V0VGltZW91dCgpO1xuICB9XG59XG5cbnZhciBzY2hlZHVsZUZsdXNoID0gdm9pZCAwO1xuLy8gRGVjaWRlIHdoYXQgYXN5bmMgbWV0aG9kIHRvIHVzZSB0byB0cmlnZ2VyaW5nIHByb2Nlc3Npbmcgb2YgcXVldWVkIGNhbGxiYWNrczpcbmlmIChpc05vZGUpIHtcbiAgc2NoZWR1bGVGbHVzaCA9IHVzZU5leHRUaWNrKCk7XG59IGVsc2UgaWYgKEJyb3dzZXJNdXRhdGlvbk9ic2VydmVyKSB7XG4gIHNjaGVkdWxlRmx1c2ggPSB1c2VNdXRhdGlvbk9ic2VydmVyKCk7XG59IGVsc2UgaWYgKGlzV29ya2VyKSB7XG4gIHNjaGVkdWxlRmx1c2ggPSB1c2VNZXNzYWdlQ2hhbm5lbCgpO1xufSBlbHNlIGlmIChicm93c2VyV2luZG93ID09PSB1bmRlZmluZWQgJiYgdHlwZW9mIHJlcXVpcmUgPT09ICdmdW5jdGlvbicpIHtcbiAgc2NoZWR1bGVGbHVzaCA9IGF0dGVtcHRWZXJ0eCgpO1xufSBlbHNlIHtcbiAgc2NoZWR1bGVGbHVzaCA9IHVzZVNldFRpbWVvdXQoKTtcbn1cblxuZnVuY3Rpb24gdGhlbihvbkZ1bGZpbGxtZW50LCBvblJlamVjdGlvbikge1xuICB2YXIgcGFyZW50ID0gdGhpcztcblxuICB2YXIgY2hpbGQgPSBuZXcgdGhpcy5jb25zdHJ1Y3Rvcihub29wKTtcblxuICBpZiAoY2hpbGRbUFJPTUlTRV9JRF0gPT09IHVuZGVmaW5lZCkge1xuICAgIG1ha2VQcm9taXNlKGNoaWxkKTtcbiAgfVxuXG4gIHZhciBfc3RhdGUgPSBwYXJlbnQuX3N0YXRlO1xuXG5cbiAgaWYgKF9zdGF0ZSkge1xuICAgIHZhciBjYWxsYmFjayA9IGFyZ3VtZW50c1tfc3RhdGUgLSAxXTtcbiAgICBhc2FwKGZ1bmN0aW9uICgpIHtcbiAgICAgIHJldHVybiBpbnZva2VDYWxsYmFjayhfc3RhdGUsIGNoaWxkLCBjYWxsYmFjaywgcGFyZW50Ll9yZXN1bHQpO1xuICAgIH0pO1xuICB9IGVsc2Uge1xuICAgIHN1YnNjcmliZShwYXJlbnQsIGNoaWxkLCBvbkZ1bGZpbGxtZW50LCBvblJlamVjdGlvbik7XG4gIH1cblxuICByZXR1cm4gY2hpbGQ7XG59XG5cbi8qKlxuICBgUHJvbWlzZS5yZXNvbHZlYCByZXR1cm5zIGEgcHJvbWlzZSB0aGF0IHdpbGwgYmVjb21lIHJlc29sdmVkIHdpdGggdGhlXG4gIHBhc3NlZCBgdmFsdWVgLiBJdCBpcyBzaG9ydGhhbmQgZm9yIHRoZSBmb2xsb3dpbmc6XG5cbiAgYGBgamF2YXNjcmlwdFxuICBsZXQgcHJvbWlzZSA9IG5ldyBQcm9taXNlKGZ1bmN0aW9uKHJlc29sdmUsIHJlamVjdCl7XG4gICAgcmVzb2x2ZSgxKTtcbiAgfSk7XG5cbiAgcHJvbWlzZS50aGVuKGZ1bmN0aW9uKHZhbHVlKXtcbiAgICAvLyB2YWx1ZSA9PT0gMVxuICB9KTtcbiAgYGBgXG5cbiAgSW5zdGVhZCBvZiB3cml0aW5nIHRoZSBhYm92ZSwgeW91ciBjb2RlIG5vdyBzaW1wbHkgYmVjb21lcyB0aGUgZm9sbG93aW5nOlxuXG4gIGBgYGphdmFzY3JpcHRcbiAgbGV0IHByb21pc2UgPSBQcm9taXNlLnJlc29sdmUoMSk7XG5cbiAgcHJvbWlzZS50aGVuKGZ1bmN0aW9uKHZhbHVlKXtcbiAgICAvLyB2YWx1ZSA9PT0gMVxuICB9KTtcbiAgYGBgXG5cbiAgQG1ldGhvZCByZXNvbHZlXG4gIEBzdGF0aWNcbiAgQHBhcmFtIHtBbnl9IHZhbHVlIHZhbHVlIHRoYXQgdGhlIHJldHVybmVkIHByb21pc2Ugd2lsbCBiZSByZXNvbHZlZCB3aXRoXG4gIFVzZWZ1bCBmb3IgdG9vbGluZy5cbiAgQHJldHVybiB7UHJvbWlzZX0gYSBwcm9taXNlIHRoYXQgd2lsbCBiZWNvbWUgZnVsZmlsbGVkIHdpdGggdGhlIGdpdmVuXG4gIGB2YWx1ZWBcbiovXG5mdW5jdGlvbiByZXNvbHZlJDEob2JqZWN0KSB7XG4gIC8qanNoaW50IHZhbGlkdGhpczp0cnVlICovXG4gIHZhciBDb25zdHJ1Y3RvciA9IHRoaXM7XG5cbiAgaWYgKG9iamVjdCAmJiB0eXBlb2Ygb2JqZWN0ID09PSAnb2JqZWN0JyAmJiBvYmplY3QuY29uc3RydWN0b3IgPT09IENvbnN0cnVjdG9yKSB7XG4gICAgcmV0dXJuIG9iamVjdDtcbiAgfVxuXG4gIHZhciBwcm9taXNlID0gbmV3IENvbnN0cnVjdG9yKG5vb3ApO1xuICByZXNvbHZlKHByb21pc2UsIG9iamVjdCk7XG4gIHJldHVybiBwcm9taXNlO1xufVxuXG52YXIgUFJPTUlTRV9JRCA9IE1hdGgucmFuZG9tKCkudG9TdHJpbmcoMzYpLnN1YnN0cmluZygyKTtcblxuZnVuY3Rpb24gbm9vcCgpIHt9XG5cbnZhciBQRU5ESU5HID0gdm9pZCAwO1xudmFyIEZVTEZJTExFRCA9IDE7XG52YXIgUkVKRUNURUQgPSAyO1xuXG52YXIgVFJZX0NBVENIX0VSUk9SID0geyBlcnJvcjogbnVsbCB9O1xuXG5mdW5jdGlvbiBzZWxmRnVsZmlsbG1lbnQoKSB7XG4gIHJldHVybiBuZXcgVHlwZUVycm9yKFwiWW91IGNhbm5vdCByZXNvbHZlIGEgcHJvbWlzZSB3aXRoIGl0c2VsZlwiKTtcbn1cblxuZnVuY3Rpb24gY2Fubm90UmV0dXJuT3duKCkge1xuICByZXR1cm4gbmV3IFR5cGVFcnJvcignQSBwcm9taXNlcyBjYWxsYmFjayBjYW5ub3QgcmV0dXJuIHRoYXQgc2FtZSBwcm9taXNlLicpO1xufVxuXG5mdW5jdGlvbiBnZXRUaGVuKHByb21pc2UpIHtcbiAgdHJ5IHtcbiAgICByZXR1cm4gcHJvbWlzZS50aGVuO1xuICB9IGNhdGNoIChlcnJvcikge1xuICAgIFRSWV9DQVRDSF9FUlJPUi5lcnJvciA9IGVycm9yO1xuICAgIHJldHVybiBUUllfQ0FUQ0hfRVJST1I7XG4gIH1cbn1cblxuZnVuY3Rpb24gdHJ5VGhlbih0aGVuJCQxLCB2YWx1ZSwgZnVsZmlsbG1lbnRIYW5kbGVyLCByZWplY3Rpb25IYW5kbGVyKSB7XG4gIHRyeSB7XG4gICAgdGhlbiQkMS5jYWxsKHZhbHVlLCBmdWxmaWxsbWVudEhhbmRsZXIsIHJlamVjdGlvbkhhbmRsZXIpO1xuICB9IGNhdGNoIChlKSB7XG4gICAgcmV0dXJuIGU7XG4gIH1cbn1cblxuZnVuY3Rpb24gaGFuZGxlRm9yZWlnblRoZW5hYmxlKHByb21pc2UsIHRoZW5hYmxlLCB0aGVuJCQxKSB7XG4gIGFzYXAoZnVuY3Rpb24gKHByb21pc2UpIHtcbiAgICB2YXIgc2VhbGVkID0gZmFsc2U7XG4gICAgdmFyIGVycm9yID0gdHJ5VGhlbih0aGVuJCQxLCB0aGVuYWJsZSwgZnVuY3Rpb24gKHZhbHVlKSB7XG4gICAgICBpZiAoc2VhbGVkKSB7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICAgIHNlYWxlZCA9IHRydWU7XG4gICAgICBpZiAodGhlbmFibGUgIT09IHZhbHVlKSB7XG4gICAgICAgIHJlc29sdmUocHJvbWlzZSwgdmFsdWUpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgZnVsZmlsbChwcm9taXNlLCB2YWx1ZSk7XG4gICAgICB9XG4gICAgfSwgZnVuY3Rpb24gKHJlYXNvbikge1xuICAgICAgaWYgKHNlYWxlZCkge1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICBzZWFsZWQgPSB0cnVlO1xuXG4gICAgICByZWplY3QocHJvbWlzZSwgcmVhc29uKTtcbiAgICB9LCAnU2V0dGxlOiAnICsgKHByb21pc2UuX2xhYmVsIHx8ICcgdW5rbm93biBwcm9taXNlJykpO1xuXG4gICAgaWYgKCFzZWFsZWQgJiYgZXJyb3IpIHtcbiAgICAgIHNlYWxlZCA9IHRydWU7XG4gICAgICByZWplY3QocHJvbWlzZSwgZXJyb3IpO1xuICAgIH1cbiAgfSwgcHJvbWlzZSk7XG59XG5cbmZ1bmN0aW9uIGhhbmRsZU93blRoZW5hYmxlKHByb21pc2UsIHRoZW5hYmxlKSB7XG4gIGlmICh0aGVuYWJsZS5fc3RhdGUgPT09IEZVTEZJTExFRCkge1xuICAgIGZ1bGZpbGwocHJvbWlzZSwgdGhlbmFibGUuX3Jlc3VsdCk7XG4gIH0gZWxzZSBpZiAodGhlbmFibGUuX3N0YXRlID09PSBSRUpFQ1RFRCkge1xuICAgIHJlamVjdChwcm9taXNlLCB0aGVuYWJsZS5fcmVzdWx0KTtcbiAgfSBlbHNlIHtcbiAgICBzdWJzY3JpYmUodGhlbmFibGUsIHVuZGVmaW5lZCwgZnVuY3Rpb24gKHZhbHVlKSB7XG4gICAgICByZXR1cm4gcmVzb2x2ZShwcm9taXNlLCB2YWx1ZSk7XG4gICAgfSwgZnVuY3Rpb24gKHJlYXNvbikge1xuICAgICAgcmV0dXJuIHJlamVjdChwcm9taXNlLCByZWFzb24pO1xuICAgIH0pO1xuICB9XG59XG5cbmZ1bmN0aW9uIGhhbmRsZU1heWJlVGhlbmFibGUocHJvbWlzZSwgbWF5YmVUaGVuYWJsZSwgdGhlbiQkMSkge1xuICBpZiAobWF5YmVUaGVuYWJsZS5jb25zdHJ1Y3RvciA9PT0gcHJvbWlzZS5jb25zdHJ1Y3RvciAmJiB0aGVuJCQxID09PSB0aGVuICYmIG1heWJlVGhlbmFibGUuY29uc3RydWN0b3IucmVzb2x2ZSA9PT0gcmVzb2x2ZSQxKSB7XG4gICAgaGFuZGxlT3duVGhlbmFibGUocHJvbWlzZSwgbWF5YmVUaGVuYWJsZSk7XG4gIH0gZWxzZSB7XG4gICAgaWYgKHRoZW4kJDEgPT09IFRSWV9DQVRDSF9FUlJPUikge1xuICAgICAgcmVqZWN0KHByb21pc2UsIFRSWV9DQVRDSF9FUlJPUi5lcnJvcik7XG4gICAgICBUUllfQ0FUQ0hfRVJST1IuZXJyb3IgPSBudWxsO1xuICAgIH0gZWxzZSBpZiAodGhlbiQkMSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICBmdWxmaWxsKHByb21pc2UsIG1heWJlVGhlbmFibGUpO1xuICAgIH0gZWxzZSBpZiAoaXNGdW5jdGlvbih0aGVuJCQxKSkge1xuICAgICAgaGFuZGxlRm9yZWlnblRoZW5hYmxlKHByb21pc2UsIG1heWJlVGhlbmFibGUsIHRoZW4kJDEpO1xuICAgIH0gZWxzZSB7XG4gICAgICBmdWxmaWxsKHByb21pc2UsIG1heWJlVGhlbmFibGUpO1xuICAgIH1cbiAgfVxufVxuXG5mdW5jdGlvbiByZXNvbHZlKHByb21pc2UsIHZhbHVlKSB7XG4gIGlmIChwcm9taXNlID09PSB2YWx1ZSkge1xuICAgIHJlamVjdChwcm9taXNlLCBzZWxmRnVsZmlsbG1lbnQoKSk7XG4gIH0gZWxzZSBpZiAob2JqZWN0T3JGdW5jdGlvbih2YWx1ZSkpIHtcbiAgICBoYW5kbGVNYXliZVRoZW5hYmxlKHByb21pc2UsIHZhbHVlLCBnZXRUaGVuKHZhbHVlKSk7XG4gIH0gZWxzZSB7XG4gICAgZnVsZmlsbChwcm9taXNlLCB2YWx1ZSk7XG4gIH1cbn1cblxuZnVuY3Rpb24gcHVibGlzaFJlamVjdGlvbihwcm9taXNlKSB7XG4gIGlmIChwcm9taXNlLl9vbmVycm9yKSB7XG4gICAgcHJvbWlzZS5fb25lcnJvcihwcm9taXNlLl9yZXN1bHQpO1xuICB9XG5cbiAgcHVibGlzaChwcm9taXNlKTtcbn1cblxuZnVuY3Rpb24gZnVsZmlsbChwcm9taXNlLCB2YWx1ZSkge1xuICBpZiAocHJvbWlzZS5fc3RhdGUgIT09IFBFTkRJTkcpIHtcbiAgICByZXR1cm47XG4gIH1cblxuICBwcm9taXNlLl9yZXN1bHQgPSB2YWx1ZTtcbiAgcHJvbWlzZS5fc3RhdGUgPSBGVUxGSUxMRUQ7XG5cbiAgaWYgKHByb21pc2UuX3N1YnNjcmliZXJzLmxlbmd0aCAhPT0gMCkge1xuICAgIGFzYXAocHVibGlzaCwgcHJvbWlzZSk7XG4gIH1cbn1cblxuZnVuY3Rpb24gcmVqZWN0KHByb21pc2UsIHJlYXNvbikge1xuICBpZiAocHJvbWlzZS5fc3RhdGUgIT09IFBFTkRJTkcpIHtcbiAgICByZXR1cm47XG4gIH1cbiAgcHJvbWlzZS5fc3RhdGUgPSBSRUpFQ1RFRDtcbiAgcHJvbWlzZS5fcmVzdWx0ID0gcmVhc29uO1xuXG4gIGFzYXAocHVibGlzaFJlamVjdGlvbiwgcHJvbWlzZSk7XG59XG5cbmZ1bmN0aW9uIHN1YnNjcmliZShwYXJlbnQsIGNoaWxkLCBvbkZ1bGZpbGxtZW50LCBvblJlamVjdGlvbikge1xuICB2YXIgX3N1YnNjcmliZXJzID0gcGFyZW50Ll9zdWJzY3JpYmVycztcbiAgdmFyIGxlbmd0aCA9IF9zdWJzY3JpYmVycy5sZW5ndGg7XG5cblxuICBwYXJlbnQuX29uZXJyb3IgPSBudWxsO1xuXG4gIF9zdWJzY3JpYmVyc1tsZW5ndGhdID0gY2hpbGQ7XG4gIF9zdWJzY3JpYmVyc1tsZW5ndGggKyBGVUxGSUxMRURdID0gb25GdWxmaWxsbWVudDtcbiAgX3N1YnNjcmliZXJzW2xlbmd0aCArIFJFSkVDVEVEXSA9IG9uUmVqZWN0aW9uO1xuXG4gIGlmIChsZW5ndGggPT09IDAgJiYgcGFyZW50Ll9zdGF0ZSkge1xuICAgIGFzYXAocHVibGlzaCwgcGFyZW50KTtcbiAgfVxufVxuXG5mdW5jdGlvbiBwdWJsaXNoKHByb21pc2UpIHtcbiAgdmFyIHN1YnNjcmliZXJzID0gcHJvbWlzZS5fc3Vic2NyaWJlcnM7XG4gIHZhciBzZXR0bGVkID0gcHJvbWlzZS5fc3RhdGU7XG5cbiAgaWYgKHN1YnNjcmliZXJzLmxlbmd0aCA9PT0gMCkge1xuICAgIHJldHVybjtcbiAgfVxuXG4gIHZhciBjaGlsZCA9IHZvaWQgMCxcbiAgICAgIGNhbGxiYWNrID0gdm9pZCAwLFxuICAgICAgZGV0YWlsID0gcHJvbWlzZS5fcmVzdWx0O1xuXG4gIGZvciAodmFyIGkgPSAwOyBpIDwgc3Vic2NyaWJlcnMubGVuZ3RoOyBpICs9IDMpIHtcbiAgICBjaGlsZCA9IHN1YnNjcmliZXJzW2ldO1xuICAgIGNhbGxiYWNrID0gc3Vic2NyaWJlcnNbaSArIHNldHRsZWRdO1xuXG4gICAgaWYgKGNoaWxkKSB7XG4gICAgICBpbnZva2VDYWxsYmFjayhzZXR0bGVkLCBjaGlsZCwgY2FsbGJhY2ssIGRldGFpbCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGNhbGxiYWNrKGRldGFpbCk7XG4gICAgfVxuICB9XG5cbiAgcHJvbWlzZS5fc3Vic2NyaWJlcnMubGVuZ3RoID0gMDtcbn1cblxuZnVuY3Rpb24gdHJ5Q2F0Y2goY2FsbGJhY2ssIGRldGFpbCkge1xuICB0cnkge1xuICAgIHJldHVybiBjYWxsYmFjayhkZXRhaWwpO1xuICB9IGNhdGNoIChlKSB7XG4gICAgVFJZX0NBVENIX0VSUk9SLmVycm9yID0gZTtcbiAgICByZXR1cm4gVFJZX0NBVENIX0VSUk9SO1xuICB9XG59XG5cbmZ1bmN0aW9uIGludm9rZUNhbGxiYWNrKHNldHRsZWQsIHByb21pc2UsIGNhbGxiYWNrLCBkZXRhaWwpIHtcbiAgdmFyIGhhc0NhbGxiYWNrID0gaXNGdW5jdGlvbihjYWxsYmFjayksXG4gICAgICB2YWx1ZSA9IHZvaWQgMCxcbiAgICAgIGVycm9yID0gdm9pZCAwLFxuICAgICAgc3VjY2VlZGVkID0gdm9pZCAwLFxuICAgICAgZmFpbGVkID0gdm9pZCAwO1xuXG4gIGlmIChoYXNDYWxsYmFjaykge1xuICAgIHZhbHVlID0gdHJ5Q2F0Y2goY2FsbGJhY2ssIGRldGFpbCk7XG5cbiAgICBpZiAodmFsdWUgPT09IFRSWV9DQVRDSF9FUlJPUikge1xuICAgICAgZmFpbGVkID0gdHJ1ZTtcbiAgICAgIGVycm9yID0gdmFsdWUuZXJyb3I7XG4gICAgICB2YWx1ZS5lcnJvciA9IG51bGw7XG4gICAgfSBlbHNlIHtcbiAgICAgIHN1Y2NlZWRlZCA9IHRydWU7XG4gICAgfVxuXG4gICAgaWYgKHByb21pc2UgPT09IHZhbHVlKSB7XG4gICAgICByZWplY3QocHJvbWlzZSwgY2Fubm90UmV0dXJuT3duKCkpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgfSBlbHNlIHtcbiAgICB2YWx1ZSA9IGRldGFpbDtcbiAgICBzdWNjZWVkZWQgPSB0cnVlO1xuICB9XG5cbiAgaWYgKHByb21pc2UuX3N0YXRlICE9PSBQRU5ESU5HKSB7XG4gICAgLy8gbm9vcFxuICB9IGVsc2UgaWYgKGhhc0NhbGxiYWNrICYmIHN1Y2NlZWRlZCkge1xuICAgIHJlc29sdmUocHJvbWlzZSwgdmFsdWUpO1xuICB9IGVsc2UgaWYgKGZhaWxlZCkge1xuICAgIHJlamVjdChwcm9taXNlLCBlcnJvcik7XG4gIH0gZWxzZSBpZiAoc2V0dGxlZCA9PT0gRlVMRklMTEVEKSB7XG4gICAgZnVsZmlsbChwcm9taXNlLCB2YWx1ZSk7XG4gIH0gZWxzZSBpZiAoc2V0dGxlZCA9PT0gUkVKRUNURUQpIHtcbiAgICByZWplY3QocHJvbWlzZSwgdmFsdWUpO1xuICB9XG59XG5cbmZ1bmN0aW9uIGluaXRpYWxpemVQcm9taXNlKHByb21pc2UsIHJlc29sdmVyKSB7XG4gIHRyeSB7XG4gICAgcmVzb2x2ZXIoZnVuY3Rpb24gcmVzb2x2ZVByb21pc2UodmFsdWUpIHtcbiAgICAgIHJlc29sdmUocHJvbWlzZSwgdmFsdWUpO1xuICAgIH0sIGZ1bmN0aW9uIHJlamVjdFByb21pc2UocmVhc29uKSB7XG4gICAgICByZWplY3QocHJvbWlzZSwgcmVhc29uKTtcbiAgICB9KTtcbiAgfSBjYXRjaCAoZSkge1xuICAgIHJlamVjdChwcm9taXNlLCBlKTtcbiAgfVxufVxuXG52YXIgaWQgPSAwO1xuZnVuY3Rpb24gbmV4dElkKCkge1xuICByZXR1cm4gaWQrKztcbn1cblxuZnVuY3Rpb24gbWFrZVByb21pc2UocHJvbWlzZSkge1xuICBwcm9taXNlW1BST01JU0VfSURdID0gaWQrKztcbiAgcHJvbWlzZS5fc3RhdGUgPSB1bmRlZmluZWQ7XG4gIHByb21pc2UuX3Jlc3VsdCA9IHVuZGVmaW5lZDtcbiAgcHJvbWlzZS5fc3Vic2NyaWJlcnMgPSBbXTtcbn1cblxuZnVuY3Rpb24gdmFsaWRhdGlvbkVycm9yKCkge1xuICByZXR1cm4gbmV3IEVycm9yKCdBcnJheSBNZXRob2RzIG11c3QgYmUgcHJvdmlkZWQgYW4gQXJyYXknKTtcbn1cblxudmFyIEVudW1lcmF0b3IgPSBmdW5jdGlvbiAoKSB7XG4gIGZ1bmN0aW9uIEVudW1lcmF0b3IoQ29uc3RydWN0b3IsIGlucHV0KSB7XG4gICAgdGhpcy5faW5zdGFuY2VDb25zdHJ1Y3RvciA9IENvbnN0cnVjdG9yO1xuICAgIHRoaXMucHJvbWlzZSA9IG5ldyBDb25zdHJ1Y3Rvcihub29wKTtcblxuICAgIGlmICghdGhpcy5wcm9taXNlW1BST01JU0VfSURdKSB7XG4gICAgICBtYWtlUHJvbWlzZSh0aGlzLnByb21pc2UpO1xuICAgIH1cblxuICAgIGlmIChpc0FycmF5KGlucHV0KSkge1xuICAgICAgdGhpcy5sZW5ndGggPSBpbnB1dC5sZW5ndGg7XG4gICAgICB0aGlzLl9yZW1haW5pbmcgPSBpbnB1dC5sZW5ndGg7XG5cbiAgICAgIHRoaXMuX3Jlc3VsdCA9IG5ldyBBcnJheSh0aGlzLmxlbmd0aCk7XG5cbiAgICAgIGlmICh0aGlzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICBmdWxmaWxsKHRoaXMucHJvbWlzZSwgdGhpcy5fcmVzdWx0KTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMubGVuZ3RoID0gdGhpcy5sZW5ndGggfHwgMDtcbiAgICAgICAgdGhpcy5fZW51bWVyYXRlKGlucHV0KTtcbiAgICAgICAgaWYgKHRoaXMuX3JlbWFpbmluZyA9PT0gMCkge1xuICAgICAgICAgIGZ1bGZpbGwodGhpcy5wcm9taXNlLCB0aGlzLl9yZXN1bHQpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIHJlamVjdCh0aGlzLnByb21pc2UsIHZhbGlkYXRpb25FcnJvcigpKTtcbiAgICB9XG4gIH1cblxuICBFbnVtZXJhdG9yLnByb3RvdHlwZS5fZW51bWVyYXRlID0gZnVuY3Rpb24gX2VudW1lcmF0ZShpbnB1dCkge1xuICAgIGZvciAodmFyIGkgPSAwOyB0aGlzLl9zdGF0ZSA9PT0gUEVORElORyAmJiBpIDwgaW5wdXQubGVuZ3RoOyBpKyspIHtcbiAgICAgIHRoaXMuX2VhY2hFbnRyeShpbnB1dFtpXSwgaSk7XG4gICAgfVxuICB9O1xuXG4gIEVudW1lcmF0b3IucHJvdG90eXBlLl9lYWNoRW50cnkgPSBmdW5jdGlvbiBfZWFjaEVudHJ5KGVudHJ5LCBpKSB7XG4gICAgdmFyIGMgPSB0aGlzLl9pbnN0YW5jZUNvbnN0cnVjdG9yO1xuICAgIHZhciByZXNvbHZlJCQxID0gYy5yZXNvbHZlO1xuXG5cbiAgICBpZiAocmVzb2x2ZSQkMSA9PT0gcmVzb2x2ZSQxKSB7XG4gICAgICB2YXIgX3RoZW4gPSBnZXRUaGVuKGVudHJ5KTtcblxuICAgICAgaWYgKF90aGVuID09PSB0aGVuICYmIGVudHJ5Ll9zdGF0ZSAhPT0gUEVORElORykge1xuICAgICAgICB0aGlzLl9zZXR0bGVkQXQoZW50cnkuX3N0YXRlLCBpLCBlbnRyeS5fcmVzdWx0KTtcbiAgICAgIH0gZWxzZSBpZiAodHlwZW9mIF90aGVuICE9PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgIHRoaXMuX3JlbWFpbmluZy0tO1xuICAgICAgICB0aGlzLl9yZXN1bHRbaV0gPSBlbnRyeTtcbiAgICAgIH0gZWxzZSBpZiAoYyA9PT0gUHJvbWlzZSQxKSB7XG4gICAgICAgIHZhciBwcm9taXNlID0gbmV3IGMobm9vcCk7XG4gICAgICAgIGhhbmRsZU1heWJlVGhlbmFibGUocHJvbWlzZSwgZW50cnksIF90aGVuKTtcbiAgICAgICAgdGhpcy5fd2lsbFNldHRsZUF0KHByb21pc2UsIGkpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhpcy5fd2lsbFNldHRsZUF0KG5ldyBjKGZ1bmN0aW9uIChyZXNvbHZlJCQxKSB7XG4gICAgICAgICAgcmV0dXJuIHJlc29sdmUkJDEoZW50cnkpO1xuICAgICAgICB9KSwgaSk7XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMuX3dpbGxTZXR0bGVBdChyZXNvbHZlJCQxKGVudHJ5KSwgaSk7XG4gICAgfVxuICB9O1xuXG4gIEVudW1lcmF0b3IucHJvdG90eXBlLl9zZXR0bGVkQXQgPSBmdW5jdGlvbiBfc2V0dGxlZEF0KHN0YXRlLCBpLCB2YWx1ZSkge1xuICAgIHZhciBwcm9taXNlID0gdGhpcy5wcm9taXNlO1xuXG5cbiAgICBpZiAocHJvbWlzZS5fc3RhdGUgPT09IFBFTkRJTkcpIHtcbiAgICAgIHRoaXMuX3JlbWFpbmluZy0tO1xuXG4gICAgICBpZiAoc3RhdGUgPT09IFJFSkVDVEVEKSB7XG4gICAgICAgIHJlamVjdChwcm9taXNlLCB2YWx1ZSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aGlzLl9yZXN1bHRbaV0gPSB2YWx1ZTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAodGhpcy5fcmVtYWluaW5nID09PSAwKSB7XG4gICAgICBmdWxmaWxsKHByb21pc2UsIHRoaXMuX3Jlc3VsdCk7XG4gICAgfVxuICB9O1xuXG4gIEVudW1lcmF0b3IucHJvdG90eXBlLl93aWxsU2V0dGxlQXQgPSBmdW5jdGlvbiBfd2lsbFNldHRsZUF0KHByb21pc2UsIGkpIHtcbiAgICB2YXIgZW51bWVyYXRvciA9IHRoaXM7XG5cbiAgICBzdWJzY3JpYmUocHJvbWlzZSwgdW5kZWZpbmVkLCBmdW5jdGlvbiAodmFsdWUpIHtcbiAgICAgIHJldHVybiBlbnVtZXJhdG9yLl9zZXR0bGVkQXQoRlVMRklMTEVELCBpLCB2YWx1ZSk7XG4gICAgfSwgZnVuY3Rpb24gKHJlYXNvbikge1xuICAgICAgcmV0dXJuIGVudW1lcmF0b3IuX3NldHRsZWRBdChSRUpFQ1RFRCwgaSwgcmVhc29uKTtcbiAgICB9KTtcbiAgfTtcblxuICByZXR1cm4gRW51bWVyYXRvcjtcbn0oKTtcblxuLyoqXG4gIGBQcm9taXNlLmFsbGAgYWNjZXB0cyBhbiBhcnJheSBvZiBwcm9taXNlcywgYW5kIHJldHVybnMgYSBuZXcgcHJvbWlzZSB3aGljaFxuICBpcyBmdWxmaWxsZWQgd2l0aCBhbiBhcnJheSBvZiBmdWxmaWxsbWVudCB2YWx1ZXMgZm9yIHRoZSBwYXNzZWQgcHJvbWlzZXMsIG9yXG4gIHJlamVjdGVkIHdpdGggdGhlIHJlYXNvbiBvZiB0aGUgZmlyc3QgcGFzc2VkIHByb21pc2UgdG8gYmUgcmVqZWN0ZWQuIEl0IGNhc3RzIGFsbFxuICBlbGVtZW50cyBvZiB0aGUgcGFzc2VkIGl0ZXJhYmxlIHRvIHByb21pc2VzIGFzIGl0IHJ1bnMgdGhpcyBhbGdvcml0aG0uXG5cbiAgRXhhbXBsZTpcblxuICBgYGBqYXZhc2NyaXB0XG4gIGxldCBwcm9taXNlMSA9IHJlc29sdmUoMSk7XG4gIGxldCBwcm9taXNlMiA9IHJlc29sdmUoMik7XG4gIGxldCBwcm9taXNlMyA9IHJlc29sdmUoMyk7XG4gIGxldCBwcm9taXNlcyA9IFsgcHJvbWlzZTEsIHByb21pc2UyLCBwcm9taXNlMyBdO1xuXG4gIFByb21pc2UuYWxsKHByb21pc2VzKS50aGVuKGZ1bmN0aW9uKGFycmF5KXtcbiAgICAvLyBUaGUgYXJyYXkgaGVyZSB3b3VsZCBiZSBbIDEsIDIsIDMgXTtcbiAgfSk7XG4gIGBgYFxuXG4gIElmIGFueSBvZiB0aGUgYHByb21pc2VzYCBnaXZlbiB0byBgYWxsYCBhcmUgcmVqZWN0ZWQsIHRoZSBmaXJzdCBwcm9taXNlXG4gIHRoYXQgaXMgcmVqZWN0ZWQgd2lsbCBiZSBnaXZlbiBhcyBhbiBhcmd1bWVudCB0byB0aGUgcmV0dXJuZWQgcHJvbWlzZXMnc1xuICByZWplY3Rpb24gaGFuZGxlci4gRm9yIGV4YW1wbGU6XG5cbiAgRXhhbXBsZTpcblxuICBgYGBqYXZhc2NyaXB0XG4gIGxldCBwcm9taXNlMSA9IHJlc29sdmUoMSk7XG4gIGxldCBwcm9taXNlMiA9IHJlamVjdChuZXcgRXJyb3IoXCIyXCIpKTtcbiAgbGV0IHByb21pc2UzID0gcmVqZWN0KG5ldyBFcnJvcihcIjNcIikpO1xuICBsZXQgcHJvbWlzZXMgPSBbIHByb21pc2UxLCBwcm9taXNlMiwgcHJvbWlzZTMgXTtcblxuICBQcm9taXNlLmFsbChwcm9taXNlcykudGhlbihmdW5jdGlvbihhcnJheSl7XG4gICAgLy8gQ29kZSBoZXJlIG5ldmVyIHJ1bnMgYmVjYXVzZSB0aGVyZSBhcmUgcmVqZWN0ZWQgcHJvbWlzZXMhXG4gIH0sIGZ1bmN0aW9uKGVycm9yKSB7XG4gICAgLy8gZXJyb3IubWVzc2FnZSA9PT0gXCIyXCJcbiAgfSk7XG4gIGBgYFxuXG4gIEBtZXRob2QgYWxsXG4gIEBzdGF0aWNcbiAgQHBhcmFtIHtBcnJheX0gZW50cmllcyBhcnJheSBvZiBwcm9taXNlc1xuICBAcGFyYW0ge1N0cmluZ30gbGFiZWwgb3B0aW9uYWwgc3RyaW5nIGZvciBsYWJlbGluZyB0aGUgcHJvbWlzZS5cbiAgVXNlZnVsIGZvciB0b29saW5nLlxuICBAcmV0dXJuIHtQcm9taXNlfSBwcm9taXNlIHRoYXQgaXMgZnVsZmlsbGVkIHdoZW4gYWxsIGBwcm9taXNlc2AgaGF2ZSBiZWVuXG4gIGZ1bGZpbGxlZCwgb3IgcmVqZWN0ZWQgaWYgYW55IG9mIHRoZW0gYmVjb21lIHJlamVjdGVkLlxuICBAc3RhdGljXG4qL1xuZnVuY3Rpb24gYWxsKGVudHJpZXMpIHtcbiAgcmV0dXJuIG5ldyBFbnVtZXJhdG9yKHRoaXMsIGVudHJpZXMpLnByb21pc2U7XG59XG5cbi8qKlxuICBgUHJvbWlzZS5yYWNlYCByZXR1cm5zIGEgbmV3IHByb21pc2Ugd2hpY2ggaXMgc2V0dGxlZCBpbiB0aGUgc2FtZSB3YXkgYXMgdGhlXG4gIGZpcnN0IHBhc3NlZCBwcm9taXNlIHRvIHNldHRsZS5cblxuICBFeGFtcGxlOlxuXG4gIGBgYGphdmFzY3JpcHRcbiAgbGV0IHByb21pc2UxID0gbmV3IFByb21pc2UoZnVuY3Rpb24ocmVzb2x2ZSwgcmVqZWN0KXtcbiAgICBzZXRUaW1lb3V0KGZ1bmN0aW9uKCl7XG4gICAgICByZXNvbHZlKCdwcm9taXNlIDEnKTtcbiAgICB9LCAyMDApO1xuICB9KTtcblxuICBsZXQgcHJvbWlzZTIgPSBuZXcgUHJvbWlzZShmdW5jdGlvbihyZXNvbHZlLCByZWplY3Qpe1xuICAgIHNldFRpbWVvdXQoZnVuY3Rpb24oKXtcbiAgICAgIHJlc29sdmUoJ3Byb21pc2UgMicpO1xuICAgIH0sIDEwMCk7XG4gIH0pO1xuXG4gIFByb21pc2UucmFjZShbcHJvbWlzZTEsIHByb21pc2UyXSkudGhlbihmdW5jdGlvbihyZXN1bHQpe1xuICAgIC8vIHJlc3VsdCA9PT0gJ3Byb21pc2UgMicgYmVjYXVzZSBpdCB3YXMgcmVzb2x2ZWQgYmVmb3JlIHByb21pc2UxXG4gICAgLy8gd2FzIHJlc29sdmVkLlxuICB9KTtcbiAgYGBgXG5cbiAgYFByb21pc2UucmFjZWAgaXMgZGV0ZXJtaW5pc3RpYyBpbiB0aGF0IG9ubHkgdGhlIHN0YXRlIG9mIHRoZSBmaXJzdFxuICBzZXR0bGVkIHByb21pc2UgbWF0dGVycy4gRm9yIGV4YW1wbGUsIGV2ZW4gaWYgb3RoZXIgcHJvbWlzZXMgZ2l2ZW4gdG8gdGhlXG4gIGBwcm9taXNlc2AgYXJyYXkgYXJndW1lbnQgYXJlIHJlc29sdmVkLCBidXQgdGhlIGZpcnN0IHNldHRsZWQgcHJvbWlzZSBoYXNcbiAgYmVjb21lIHJlamVjdGVkIGJlZm9yZSB0aGUgb3RoZXIgcHJvbWlzZXMgYmVjYW1lIGZ1bGZpbGxlZCwgdGhlIHJldHVybmVkXG4gIHByb21pc2Ugd2lsbCBiZWNvbWUgcmVqZWN0ZWQ6XG5cbiAgYGBgamF2YXNjcmlwdFxuICBsZXQgcHJvbWlzZTEgPSBuZXcgUHJvbWlzZShmdW5jdGlvbihyZXNvbHZlLCByZWplY3Qpe1xuICAgIHNldFRpbWVvdXQoZnVuY3Rpb24oKXtcbiAgICAgIHJlc29sdmUoJ3Byb21pc2UgMScpO1xuICAgIH0sIDIwMCk7XG4gIH0pO1xuXG4gIGxldCBwcm9taXNlMiA9IG5ldyBQcm9taXNlKGZ1bmN0aW9uKHJlc29sdmUsIHJlamVjdCl7XG4gICAgc2V0VGltZW91dChmdW5jdGlvbigpe1xuICAgICAgcmVqZWN0KG5ldyBFcnJvcigncHJvbWlzZSAyJykpO1xuICAgIH0sIDEwMCk7XG4gIH0pO1xuXG4gIFByb21pc2UucmFjZShbcHJvbWlzZTEsIHByb21pc2UyXSkudGhlbihmdW5jdGlvbihyZXN1bHQpe1xuICAgIC8vIENvZGUgaGVyZSBuZXZlciBydW5zXG4gIH0sIGZ1bmN0aW9uKHJlYXNvbil7XG4gICAgLy8gcmVhc29uLm1lc3NhZ2UgPT09ICdwcm9taXNlIDInIGJlY2F1c2UgcHJvbWlzZSAyIGJlY2FtZSByZWplY3RlZCBiZWZvcmVcbiAgICAvLyBwcm9taXNlIDEgYmVjYW1lIGZ1bGZpbGxlZFxuICB9KTtcbiAgYGBgXG5cbiAgQW4gZXhhbXBsZSByZWFsLXdvcmxkIHVzZSBjYXNlIGlzIGltcGxlbWVudGluZyB0aW1lb3V0czpcblxuICBgYGBqYXZhc2NyaXB0XG4gIFByb21pc2UucmFjZShbYWpheCgnZm9vLmpzb24nKSwgdGltZW91dCg1MDAwKV0pXG4gIGBgYFxuXG4gIEBtZXRob2QgcmFjZVxuICBAc3RhdGljXG4gIEBwYXJhbSB7QXJyYXl9IHByb21pc2VzIGFycmF5IG9mIHByb21pc2VzIHRvIG9ic2VydmVcbiAgVXNlZnVsIGZvciB0b29saW5nLlxuICBAcmV0dXJuIHtQcm9taXNlfSBhIHByb21pc2Ugd2hpY2ggc2V0dGxlcyBpbiB0aGUgc2FtZSB3YXkgYXMgdGhlIGZpcnN0IHBhc3NlZFxuICBwcm9taXNlIHRvIHNldHRsZS5cbiovXG5mdW5jdGlvbiByYWNlKGVudHJpZXMpIHtcbiAgLypqc2hpbnQgdmFsaWR0aGlzOnRydWUgKi9cbiAgdmFyIENvbnN0cnVjdG9yID0gdGhpcztcblxuICBpZiAoIWlzQXJyYXkoZW50cmllcykpIHtcbiAgICByZXR1cm4gbmV3IENvbnN0cnVjdG9yKGZ1bmN0aW9uIChfLCByZWplY3QpIHtcbiAgICAgIHJldHVybiByZWplY3QobmV3IFR5cGVFcnJvcignWW91IG11c3QgcGFzcyBhbiBhcnJheSB0byByYWNlLicpKTtcbiAgICB9KTtcbiAgfSBlbHNlIHtcbiAgICByZXR1cm4gbmV3IENvbnN0cnVjdG9yKGZ1bmN0aW9uIChyZXNvbHZlLCByZWplY3QpIHtcbiAgICAgIHZhciBsZW5ndGggPSBlbnRyaWVzLmxlbmd0aDtcbiAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgbGVuZ3RoOyBpKyspIHtcbiAgICAgICAgQ29uc3RydWN0b3IucmVzb2x2ZShlbnRyaWVzW2ldKS50aGVuKHJlc29sdmUsIHJlamVjdCk7XG4gICAgICB9XG4gICAgfSk7XG4gIH1cbn1cblxuLyoqXG4gIGBQcm9taXNlLnJlamVjdGAgcmV0dXJucyBhIHByb21pc2UgcmVqZWN0ZWQgd2l0aCB0aGUgcGFzc2VkIGByZWFzb25gLlxuICBJdCBpcyBzaG9ydGhhbmQgZm9yIHRoZSBmb2xsb3dpbmc6XG5cbiAgYGBgamF2YXNjcmlwdFxuICBsZXQgcHJvbWlzZSA9IG5ldyBQcm9taXNlKGZ1bmN0aW9uKHJlc29sdmUsIHJlamVjdCl7XG4gICAgcmVqZWN0KG5ldyBFcnJvcignV0hPT1BTJykpO1xuICB9KTtcblxuICBwcm9taXNlLnRoZW4oZnVuY3Rpb24odmFsdWUpe1xuICAgIC8vIENvZGUgaGVyZSBkb2Vzbid0IHJ1biBiZWNhdXNlIHRoZSBwcm9taXNlIGlzIHJlamVjdGVkIVxuICB9LCBmdW5jdGlvbihyZWFzb24pe1xuICAgIC8vIHJlYXNvbi5tZXNzYWdlID09PSAnV0hPT1BTJ1xuICB9KTtcbiAgYGBgXG5cbiAgSW5zdGVhZCBvZiB3cml0aW5nIHRoZSBhYm92ZSwgeW91ciBjb2RlIG5vdyBzaW1wbHkgYmVjb21lcyB0aGUgZm9sbG93aW5nOlxuXG4gIGBgYGphdmFzY3JpcHRcbiAgbGV0IHByb21pc2UgPSBQcm9taXNlLnJlamVjdChuZXcgRXJyb3IoJ1dIT09QUycpKTtcblxuICBwcm9taXNlLnRoZW4oZnVuY3Rpb24odmFsdWUpe1xuICAgIC8vIENvZGUgaGVyZSBkb2Vzbid0IHJ1biBiZWNhdXNlIHRoZSBwcm9taXNlIGlzIHJlamVjdGVkIVxuICB9LCBmdW5jdGlvbihyZWFzb24pe1xuICAgIC8vIHJlYXNvbi5tZXNzYWdlID09PSAnV0hPT1BTJ1xuICB9KTtcbiAgYGBgXG5cbiAgQG1ldGhvZCByZWplY3RcbiAgQHN0YXRpY1xuICBAcGFyYW0ge0FueX0gcmVhc29uIHZhbHVlIHRoYXQgdGhlIHJldHVybmVkIHByb21pc2Ugd2lsbCBiZSByZWplY3RlZCB3aXRoLlxuICBVc2VmdWwgZm9yIHRvb2xpbmcuXG4gIEByZXR1cm4ge1Byb21pc2V9IGEgcHJvbWlzZSByZWplY3RlZCB3aXRoIHRoZSBnaXZlbiBgcmVhc29uYC5cbiovXG5mdW5jdGlvbiByZWplY3QkMShyZWFzb24pIHtcbiAgLypqc2hpbnQgdmFsaWR0aGlzOnRydWUgKi9cbiAgdmFyIENvbnN0cnVjdG9yID0gdGhpcztcbiAgdmFyIHByb21pc2UgPSBuZXcgQ29uc3RydWN0b3Iobm9vcCk7XG4gIHJlamVjdChwcm9taXNlLCByZWFzb24pO1xuICByZXR1cm4gcHJvbWlzZTtcbn1cblxuZnVuY3Rpb24gbmVlZHNSZXNvbHZlcigpIHtcbiAgdGhyb3cgbmV3IFR5cGVFcnJvcignWW91IG11c3QgcGFzcyBhIHJlc29sdmVyIGZ1bmN0aW9uIGFzIHRoZSBmaXJzdCBhcmd1bWVudCB0byB0aGUgcHJvbWlzZSBjb25zdHJ1Y3RvcicpO1xufVxuXG5mdW5jdGlvbiBuZWVkc05ldygpIHtcbiAgdGhyb3cgbmV3IFR5cGVFcnJvcihcIkZhaWxlZCB0byBjb25zdHJ1Y3QgJ1Byb21pc2UnOiBQbGVhc2UgdXNlIHRoZSAnbmV3JyBvcGVyYXRvciwgdGhpcyBvYmplY3QgY29uc3RydWN0b3IgY2Fubm90IGJlIGNhbGxlZCBhcyBhIGZ1bmN0aW9uLlwiKTtcbn1cblxuLyoqXG4gIFByb21pc2Ugb2JqZWN0cyByZXByZXNlbnQgdGhlIGV2ZW50dWFsIHJlc3VsdCBvZiBhbiBhc3luY2hyb25vdXMgb3BlcmF0aW9uLiBUaGVcbiAgcHJpbWFyeSB3YXkgb2YgaW50ZXJhY3Rpbmcgd2l0aCBhIHByb21pc2UgaXMgdGhyb3VnaCBpdHMgYHRoZW5gIG1ldGhvZCwgd2hpY2hcbiAgcmVnaXN0ZXJzIGNhbGxiYWNrcyB0byByZWNlaXZlIGVpdGhlciBhIHByb21pc2UncyBldmVudHVhbCB2YWx1ZSBvciB0aGUgcmVhc29uXG4gIHdoeSB0aGUgcHJvbWlzZSBjYW5ub3QgYmUgZnVsZmlsbGVkLlxuXG4gIFRlcm1pbm9sb2d5XG4gIC0tLS0tLS0tLS0tXG5cbiAgLSBgcHJvbWlzZWAgaXMgYW4gb2JqZWN0IG9yIGZ1bmN0aW9uIHdpdGggYSBgdGhlbmAgbWV0aG9kIHdob3NlIGJlaGF2aW9yIGNvbmZvcm1zIHRvIHRoaXMgc3BlY2lmaWNhdGlvbi5cbiAgLSBgdGhlbmFibGVgIGlzIGFuIG9iamVjdCBvciBmdW5jdGlvbiB0aGF0IGRlZmluZXMgYSBgdGhlbmAgbWV0aG9kLlxuICAtIGB2YWx1ZWAgaXMgYW55IGxlZ2FsIEphdmFTY3JpcHQgdmFsdWUgKGluY2x1ZGluZyB1bmRlZmluZWQsIGEgdGhlbmFibGUsIG9yIGEgcHJvbWlzZSkuXG4gIC0gYGV4Y2VwdGlvbmAgaXMgYSB2YWx1ZSB0aGF0IGlzIHRocm93biB1c2luZyB0aGUgdGhyb3cgc3RhdGVtZW50LlxuICAtIGByZWFzb25gIGlzIGEgdmFsdWUgdGhhdCBpbmRpY2F0ZXMgd2h5IGEgcHJvbWlzZSB3YXMgcmVqZWN0ZWQuXG4gIC0gYHNldHRsZWRgIHRoZSBmaW5hbCByZXN0aW5nIHN0YXRlIG9mIGEgcHJvbWlzZSwgZnVsZmlsbGVkIG9yIHJlamVjdGVkLlxuXG4gIEEgcHJvbWlzZSBjYW4gYmUgaW4gb25lIG9mIHRocmVlIHN0YXRlczogcGVuZGluZywgZnVsZmlsbGVkLCBvciByZWplY3RlZC5cblxuICBQcm9taXNlcyB0aGF0IGFyZSBmdWxmaWxsZWQgaGF2ZSBhIGZ1bGZpbGxtZW50IHZhbHVlIGFuZCBhcmUgaW4gdGhlIGZ1bGZpbGxlZFxuICBzdGF0ZS4gIFByb21pc2VzIHRoYXQgYXJlIHJlamVjdGVkIGhhdmUgYSByZWplY3Rpb24gcmVhc29uIGFuZCBhcmUgaW4gdGhlXG4gIHJlamVjdGVkIHN0YXRlLiAgQSBmdWxmaWxsbWVudCB2YWx1ZSBpcyBuZXZlciBhIHRoZW5hYmxlLlxuXG4gIFByb21pc2VzIGNhbiBhbHNvIGJlIHNhaWQgdG8gKnJlc29sdmUqIGEgdmFsdWUuICBJZiB0aGlzIHZhbHVlIGlzIGFsc28gYVxuICBwcm9taXNlLCB0aGVuIHRoZSBvcmlnaW5hbCBwcm9taXNlJ3Mgc2V0dGxlZCBzdGF0ZSB3aWxsIG1hdGNoIHRoZSB2YWx1ZSdzXG4gIHNldHRsZWQgc3RhdGUuICBTbyBhIHByb21pc2UgdGhhdCAqcmVzb2x2ZXMqIGEgcHJvbWlzZSB0aGF0IHJlamVjdHMgd2lsbFxuICBpdHNlbGYgcmVqZWN0LCBhbmQgYSBwcm9taXNlIHRoYXQgKnJlc29sdmVzKiBhIHByb21pc2UgdGhhdCBmdWxmaWxscyB3aWxsXG4gIGl0c2VsZiBmdWxmaWxsLlxuXG5cbiAgQmFzaWMgVXNhZ2U6XG4gIC0tLS0tLS0tLS0tLVxuXG4gIGBgYGpzXG4gIGxldCBwcm9taXNlID0gbmV3IFByb21pc2UoZnVuY3Rpb24ocmVzb2x2ZSwgcmVqZWN0KSB7XG4gICAgLy8gb24gc3VjY2Vzc1xuICAgIHJlc29sdmUodmFsdWUpO1xuXG4gICAgLy8gb24gZmFpbHVyZVxuICAgIHJlamVjdChyZWFzb24pO1xuICB9KTtcblxuICBwcm9taXNlLnRoZW4oZnVuY3Rpb24odmFsdWUpIHtcbiAgICAvLyBvbiBmdWxmaWxsbWVudFxuICB9LCBmdW5jdGlvbihyZWFzb24pIHtcbiAgICAvLyBvbiByZWplY3Rpb25cbiAgfSk7XG4gIGBgYFxuXG4gIEFkdmFuY2VkIFVzYWdlOlxuICAtLS0tLS0tLS0tLS0tLS1cblxuICBQcm9taXNlcyBzaGluZSB3aGVuIGFic3RyYWN0aW5nIGF3YXkgYXN5bmNocm9ub3VzIGludGVyYWN0aW9ucyBzdWNoIGFzXG4gIGBYTUxIdHRwUmVxdWVzdGBzLlxuXG4gIGBgYGpzXG4gIGZ1bmN0aW9uIGdldEpTT04odXJsKSB7XG4gICAgcmV0dXJuIG5ldyBQcm9taXNlKGZ1bmN0aW9uKHJlc29sdmUsIHJlamVjdCl7XG4gICAgICBsZXQgeGhyID0gbmV3IFhNTEh0dHBSZXF1ZXN0KCk7XG5cbiAgICAgIHhoci5vcGVuKCdHRVQnLCB1cmwpO1xuICAgICAgeGhyLm9ucmVhZHlzdGF0ZWNoYW5nZSA9IGhhbmRsZXI7XG4gICAgICB4aHIucmVzcG9uc2VUeXBlID0gJ2pzb24nO1xuICAgICAgeGhyLnNldFJlcXVlc3RIZWFkZXIoJ0FjY2VwdCcsICdhcHBsaWNhdGlvbi9qc29uJyk7XG4gICAgICB4aHIuc2VuZCgpO1xuXG4gICAgICBmdW5jdGlvbiBoYW5kbGVyKCkge1xuICAgICAgICBpZiAodGhpcy5yZWFkeVN0YXRlID09PSB0aGlzLkRPTkUpIHtcbiAgICAgICAgICBpZiAodGhpcy5zdGF0dXMgPT09IDIwMCkge1xuICAgICAgICAgICAgcmVzb2x2ZSh0aGlzLnJlc3BvbnNlKTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcmVqZWN0KG5ldyBFcnJvcignZ2V0SlNPTjogYCcgKyB1cmwgKyAnYCBmYWlsZWQgd2l0aCBzdGF0dXM6IFsnICsgdGhpcy5zdGF0dXMgKyAnXScpKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH07XG4gICAgfSk7XG4gIH1cblxuICBnZXRKU09OKCcvcG9zdHMuanNvbicpLnRoZW4oZnVuY3Rpb24oanNvbikge1xuICAgIC8vIG9uIGZ1bGZpbGxtZW50XG4gIH0sIGZ1bmN0aW9uKHJlYXNvbikge1xuICAgIC8vIG9uIHJlamVjdGlvblxuICB9KTtcbiAgYGBgXG5cbiAgVW5saWtlIGNhbGxiYWNrcywgcHJvbWlzZXMgYXJlIGdyZWF0IGNvbXBvc2FibGUgcHJpbWl0aXZlcy5cblxuICBgYGBqc1xuICBQcm9taXNlLmFsbChbXG4gICAgZ2V0SlNPTignL3Bvc3RzJyksXG4gICAgZ2V0SlNPTignL2NvbW1lbnRzJylcbiAgXSkudGhlbihmdW5jdGlvbih2YWx1ZXMpe1xuICAgIHZhbHVlc1swXSAvLyA9PiBwb3N0c0pTT05cbiAgICB2YWx1ZXNbMV0gLy8gPT4gY29tbWVudHNKU09OXG5cbiAgICByZXR1cm4gdmFsdWVzO1xuICB9KTtcbiAgYGBgXG5cbiAgQGNsYXNzIFByb21pc2VcbiAgQHBhcmFtIHtGdW5jdGlvbn0gcmVzb2x2ZXJcbiAgVXNlZnVsIGZvciB0b29saW5nLlxuICBAY29uc3RydWN0b3JcbiovXG5cbnZhciBQcm9taXNlJDEgPSBmdW5jdGlvbiAoKSB7XG4gIGZ1bmN0aW9uIFByb21pc2UocmVzb2x2ZXIpIHtcbiAgICB0aGlzW1BST01JU0VfSURdID0gbmV4dElkKCk7XG4gICAgdGhpcy5fcmVzdWx0ID0gdGhpcy5fc3RhdGUgPSB1bmRlZmluZWQ7XG4gICAgdGhpcy5fc3Vic2NyaWJlcnMgPSBbXTtcblxuICAgIGlmIChub29wICE9PSByZXNvbHZlcikge1xuICAgICAgdHlwZW9mIHJlc29sdmVyICE9PSAnZnVuY3Rpb24nICYmIG5lZWRzUmVzb2x2ZXIoKTtcbiAgICAgIHRoaXMgaW5zdGFuY2VvZiBQcm9taXNlID8gaW5pdGlhbGl6ZVByb21pc2UodGhpcywgcmVzb2x2ZXIpIDogbmVlZHNOZXcoKTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgVGhlIHByaW1hcnkgd2F5IG9mIGludGVyYWN0aW5nIHdpdGggYSBwcm9taXNlIGlzIHRocm91Z2ggaXRzIGB0aGVuYCBtZXRob2QsXG4gIHdoaWNoIHJlZ2lzdGVycyBjYWxsYmFja3MgdG8gcmVjZWl2ZSBlaXRoZXIgYSBwcm9taXNlJ3MgZXZlbnR1YWwgdmFsdWUgb3IgdGhlXG4gIHJlYXNvbiB3aHkgdGhlIHByb21pc2UgY2Fubm90IGJlIGZ1bGZpbGxlZC5cbiAgIGBgYGpzXG4gIGZpbmRVc2VyKCkudGhlbihmdW5jdGlvbih1c2VyKXtcbiAgICAvLyB1c2VyIGlzIGF2YWlsYWJsZVxuICB9LCBmdW5jdGlvbihyZWFzb24pe1xuICAgIC8vIHVzZXIgaXMgdW5hdmFpbGFibGUsIGFuZCB5b3UgYXJlIGdpdmVuIHRoZSByZWFzb24gd2h5XG4gIH0pO1xuICBgYGBcbiAgIENoYWluaW5nXG4gIC0tLS0tLS0tXG4gICBUaGUgcmV0dXJuIHZhbHVlIG9mIGB0aGVuYCBpcyBpdHNlbGYgYSBwcm9taXNlLiAgVGhpcyBzZWNvbmQsICdkb3duc3RyZWFtJ1xuICBwcm9taXNlIGlzIHJlc29sdmVkIHdpdGggdGhlIHJldHVybiB2YWx1ZSBvZiB0aGUgZmlyc3QgcHJvbWlzZSdzIGZ1bGZpbGxtZW50XG4gIG9yIHJlamVjdGlvbiBoYW5kbGVyLCBvciByZWplY3RlZCBpZiB0aGUgaGFuZGxlciB0aHJvd3MgYW4gZXhjZXB0aW9uLlxuICAgYGBganNcbiAgZmluZFVzZXIoKS50aGVuKGZ1bmN0aW9uICh1c2VyKSB7XG4gICAgcmV0dXJuIHVzZXIubmFtZTtcbiAgfSwgZnVuY3Rpb24gKHJlYXNvbikge1xuICAgIHJldHVybiAnZGVmYXVsdCBuYW1lJztcbiAgfSkudGhlbihmdW5jdGlvbiAodXNlck5hbWUpIHtcbiAgICAvLyBJZiBgZmluZFVzZXJgIGZ1bGZpbGxlZCwgYHVzZXJOYW1lYCB3aWxsIGJlIHRoZSB1c2VyJ3MgbmFtZSwgb3RoZXJ3aXNlIGl0XG4gICAgLy8gd2lsbCBiZSBgJ2RlZmF1bHQgbmFtZSdgXG4gIH0pO1xuICAgZmluZFVzZXIoKS50aGVuKGZ1bmN0aW9uICh1c2VyKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdGb3VuZCB1c2VyLCBidXQgc3RpbGwgdW5oYXBweScpO1xuICB9LCBmdW5jdGlvbiAocmVhc29uKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdgZmluZFVzZXJgIHJlamVjdGVkIGFuZCB3ZSdyZSB1bmhhcHB5Jyk7XG4gIH0pLnRoZW4oZnVuY3Rpb24gKHZhbHVlKSB7XG4gICAgLy8gbmV2ZXIgcmVhY2hlZFxuICB9LCBmdW5jdGlvbiAocmVhc29uKSB7XG4gICAgLy8gaWYgYGZpbmRVc2VyYCBmdWxmaWxsZWQsIGByZWFzb25gIHdpbGwgYmUgJ0ZvdW5kIHVzZXIsIGJ1dCBzdGlsbCB1bmhhcHB5Jy5cbiAgICAvLyBJZiBgZmluZFVzZXJgIHJlamVjdGVkLCBgcmVhc29uYCB3aWxsIGJlICdgZmluZFVzZXJgIHJlamVjdGVkIGFuZCB3ZSdyZSB1bmhhcHB5Jy5cbiAgfSk7XG4gIGBgYFxuICBJZiB0aGUgZG93bnN0cmVhbSBwcm9taXNlIGRvZXMgbm90IHNwZWNpZnkgYSByZWplY3Rpb24gaGFuZGxlciwgcmVqZWN0aW9uIHJlYXNvbnMgd2lsbCBiZSBwcm9wYWdhdGVkIGZ1cnRoZXIgZG93bnN0cmVhbS5cbiAgIGBgYGpzXG4gIGZpbmRVc2VyKCkudGhlbihmdW5jdGlvbiAodXNlcikge1xuICAgIHRocm93IG5ldyBQZWRhZ29naWNhbEV4Y2VwdGlvbignVXBzdHJlYW0gZXJyb3InKTtcbiAgfSkudGhlbihmdW5jdGlvbiAodmFsdWUpIHtcbiAgICAvLyBuZXZlciByZWFjaGVkXG4gIH0pLnRoZW4oZnVuY3Rpb24gKHZhbHVlKSB7XG4gICAgLy8gbmV2ZXIgcmVhY2hlZFxuICB9LCBmdW5jdGlvbiAocmVhc29uKSB7XG4gICAgLy8gVGhlIGBQZWRnYWdvY2lhbEV4Y2VwdGlvbmAgaXMgcHJvcGFnYXRlZCBhbGwgdGhlIHdheSBkb3duIHRvIGhlcmVcbiAgfSk7XG4gIGBgYFxuICAgQXNzaW1pbGF0aW9uXG4gIC0tLS0tLS0tLS0tLVxuICAgU29tZXRpbWVzIHRoZSB2YWx1ZSB5b3Ugd2FudCB0byBwcm9wYWdhdGUgdG8gYSBkb3duc3RyZWFtIHByb21pc2UgY2FuIG9ubHkgYmVcbiAgcmV0cmlldmVkIGFzeW5jaHJvbm91c2x5LiBUaGlzIGNhbiBiZSBhY2hpZXZlZCBieSByZXR1cm5pbmcgYSBwcm9taXNlIGluIHRoZVxuICBmdWxmaWxsbWVudCBvciByZWplY3Rpb24gaGFuZGxlci4gVGhlIGRvd25zdHJlYW0gcHJvbWlzZSB3aWxsIHRoZW4gYmUgcGVuZGluZ1xuICB1bnRpbCB0aGUgcmV0dXJuZWQgcHJvbWlzZSBpcyBzZXR0bGVkLiBUaGlzIGlzIGNhbGxlZCAqYXNzaW1pbGF0aW9uKi5cbiAgIGBgYGpzXG4gIGZpbmRVc2VyKCkudGhlbihmdW5jdGlvbiAodXNlcikge1xuICAgIHJldHVybiBmaW5kQ29tbWVudHNCeUF1dGhvcih1c2VyKTtcbiAgfSkudGhlbihmdW5jdGlvbiAoY29tbWVudHMpIHtcbiAgICAvLyBUaGUgdXNlcidzIGNvbW1lbnRzIGFyZSBub3cgYXZhaWxhYmxlXG4gIH0pO1xuICBgYGBcbiAgIElmIHRoZSBhc3NpbWxpYXRlZCBwcm9taXNlIHJlamVjdHMsIHRoZW4gdGhlIGRvd25zdHJlYW0gcHJvbWlzZSB3aWxsIGFsc28gcmVqZWN0LlxuICAgYGBganNcbiAgZmluZFVzZXIoKS50aGVuKGZ1bmN0aW9uICh1c2VyKSB7XG4gICAgcmV0dXJuIGZpbmRDb21tZW50c0J5QXV0aG9yKHVzZXIpO1xuICB9KS50aGVuKGZ1bmN0aW9uIChjb21tZW50cykge1xuICAgIC8vIElmIGBmaW5kQ29tbWVudHNCeUF1dGhvcmAgZnVsZmlsbHMsIHdlJ2xsIGhhdmUgdGhlIHZhbHVlIGhlcmVcbiAgfSwgZnVuY3Rpb24gKHJlYXNvbikge1xuICAgIC8vIElmIGBmaW5kQ29tbWVudHNCeUF1dGhvcmAgcmVqZWN0cywgd2UnbGwgaGF2ZSB0aGUgcmVhc29uIGhlcmVcbiAgfSk7XG4gIGBgYFxuICAgU2ltcGxlIEV4YW1wbGVcbiAgLS0tLS0tLS0tLS0tLS1cbiAgIFN5bmNocm9ub3VzIEV4YW1wbGVcbiAgIGBgYGphdmFzY3JpcHRcbiAgbGV0IHJlc3VsdDtcbiAgIHRyeSB7XG4gICAgcmVzdWx0ID0gZmluZFJlc3VsdCgpO1xuICAgIC8vIHN1Y2Nlc3NcbiAgfSBjYXRjaChyZWFzb24pIHtcbiAgICAvLyBmYWlsdXJlXG4gIH1cbiAgYGBgXG4gICBFcnJiYWNrIEV4YW1wbGVcbiAgIGBgYGpzXG4gIGZpbmRSZXN1bHQoZnVuY3Rpb24ocmVzdWx0LCBlcnIpe1xuICAgIGlmIChlcnIpIHtcbiAgICAgIC8vIGZhaWx1cmVcbiAgICB9IGVsc2Uge1xuICAgICAgLy8gc3VjY2Vzc1xuICAgIH1cbiAgfSk7XG4gIGBgYFxuICAgUHJvbWlzZSBFeGFtcGxlO1xuICAgYGBgamF2YXNjcmlwdFxuICBmaW5kUmVzdWx0KCkudGhlbihmdW5jdGlvbihyZXN1bHQpe1xuICAgIC8vIHN1Y2Nlc3NcbiAgfSwgZnVuY3Rpb24ocmVhc29uKXtcbiAgICAvLyBmYWlsdXJlXG4gIH0pO1xuICBgYGBcbiAgIEFkdmFuY2VkIEV4YW1wbGVcbiAgLS0tLS0tLS0tLS0tLS1cbiAgIFN5bmNocm9ub3VzIEV4YW1wbGVcbiAgIGBgYGphdmFzY3JpcHRcbiAgbGV0IGF1dGhvciwgYm9va3M7XG4gICB0cnkge1xuICAgIGF1dGhvciA9IGZpbmRBdXRob3IoKTtcbiAgICBib29rcyAgPSBmaW5kQm9va3NCeUF1dGhvcihhdXRob3IpO1xuICAgIC8vIHN1Y2Nlc3NcbiAgfSBjYXRjaChyZWFzb24pIHtcbiAgICAvLyBmYWlsdXJlXG4gIH1cbiAgYGBgXG4gICBFcnJiYWNrIEV4YW1wbGVcbiAgIGBgYGpzXG4gICBmdW5jdGlvbiBmb3VuZEJvb2tzKGJvb2tzKSB7XG4gICB9XG4gICBmdW5jdGlvbiBmYWlsdXJlKHJlYXNvbikge1xuICAgfVxuICAgZmluZEF1dGhvcihmdW5jdGlvbihhdXRob3IsIGVycil7XG4gICAgaWYgKGVycikge1xuICAgICAgZmFpbHVyZShlcnIpO1xuICAgICAgLy8gZmFpbHVyZVxuICAgIH0gZWxzZSB7XG4gICAgICB0cnkge1xuICAgICAgICBmaW5kQm9vb2tzQnlBdXRob3IoYXV0aG9yLCBmdW5jdGlvbihib29rcywgZXJyKSB7XG4gICAgICAgICAgaWYgKGVycikge1xuICAgICAgICAgICAgZmFpbHVyZShlcnIpO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICBmb3VuZEJvb2tzKGJvb2tzKTtcbiAgICAgICAgICAgIH0gY2F0Y2gocmVhc29uKSB7XG4gICAgICAgICAgICAgIGZhaWx1cmUocmVhc29uKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgICAgfSBjYXRjaChlcnJvcikge1xuICAgICAgICBmYWlsdXJlKGVycik7XG4gICAgICB9XG4gICAgICAvLyBzdWNjZXNzXG4gICAgfVxuICB9KTtcbiAgYGBgXG4gICBQcm9taXNlIEV4YW1wbGU7XG4gICBgYGBqYXZhc2NyaXB0XG4gIGZpbmRBdXRob3IoKS5cbiAgICB0aGVuKGZpbmRCb29rc0J5QXV0aG9yKS5cbiAgICB0aGVuKGZ1bmN0aW9uKGJvb2tzKXtcbiAgICAgIC8vIGZvdW5kIGJvb2tzXG4gIH0pLmNhdGNoKGZ1bmN0aW9uKHJlYXNvbil7XG4gICAgLy8gc29tZXRoaW5nIHdlbnQgd3JvbmdcbiAgfSk7XG4gIGBgYFxuICAgQG1ldGhvZCB0aGVuXG4gIEBwYXJhbSB7RnVuY3Rpb259IG9uRnVsZmlsbGVkXG4gIEBwYXJhbSB7RnVuY3Rpb259IG9uUmVqZWN0ZWRcbiAgVXNlZnVsIGZvciB0b29saW5nLlxuICBAcmV0dXJuIHtQcm9taXNlfVxuICAqL1xuXG4gIC8qKlxuICBgY2F0Y2hgIGlzIHNpbXBseSBzdWdhciBmb3IgYHRoZW4odW5kZWZpbmVkLCBvblJlamVjdGlvbilgIHdoaWNoIG1ha2VzIGl0IHRoZSBzYW1lXG4gIGFzIHRoZSBjYXRjaCBibG9jayBvZiBhIHRyeS9jYXRjaCBzdGF0ZW1lbnQuXG4gIGBgYGpzXG4gIGZ1bmN0aW9uIGZpbmRBdXRob3IoKXtcbiAgdGhyb3cgbmV3IEVycm9yKCdjb3VsZG4ndCBmaW5kIHRoYXQgYXV0aG9yJyk7XG4gIH1cbiAgLy8gc3luY2hyb25vdXNcbiAgdHJ5IHtcbiAgZmluZEF1dGhvcigpO1xuICB9IGNhdGNoKHJlYXNvbikge1xuICAvLyBzb21ldGhpbmcgd2VudCB3cm9uZ1xuICB9XG4gIC8vIGFzeW5jIHdpdGggcHJvbWlzZXNcbiAgZmluZEF1dGhvcigpLmNhdGNoKGZ1bmN0aW9uKHJlYXNvbil7XG4gIC8vIHNvbWV0aGluZyB3ZW50IHdyb25nXG4gIH0pO1xuICBgYGBcbiAgQG1ldGhvZCBjYXRjaFxuICBAcGFyYW0ge0Z1bmN0aW9ufSBvblJlamVjdGlvblxuICBVc2VmdWwgZm9yIHRvb2xpbmcuXG4gIEByZXR1cm4ge1Byb21pc2V9XG4gICovXG5cblxuICBQcm9taXNlLnByb3RvdHlwZS5jYXRjaCA9IGZ1bmN0aW9uIF9jYXRjaChvblJlamVjdGlvbikge1xuICAgIHJldHVybiB0aGlzLnRoZW4obnVsbCwgb25SZWplY3Rpb24pO1xuICB9O1xuXG4gIC8qKlxuICAgIGBmaW5hbGx5YCB3aWxsIGJlIGludm9rZWQgcmVnYXJkbGVzcyBvZiB0aGUgcHJvbWlzZSdzIGZhdGUganVzdCBhcyBuYXRpdmVcbiAgICB0cnkvY2F0Y2gvZmluYWxseSBiZWhhdmVzXG4gIFxuICAgIFN5bmNocm9ub3VzIGV4YW1wbGU6XG4gIFxuICAgIGBgYGpzXG4gICAgZmluZEF1dGhvcigpIHtcbiAgICAgIGlmIChNYXRoLnJhbmRvbSgpID4gMC41KSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcigpO1xuICAgICAgfVxuICAgICAgcmV0dXJuIG5ldyBBdXRob3IoKTtcbiAgICB9XG4gIFxuICAgIHRyeSB7XG4gICAgICByZXR1cm4gZmluZEF1dGhvcigpOyAvLyBzdWNjZWVkIG9yIGZhaWxcbiAgICB9IGNhdGNoKGVycm9yKSB7XG4gICAgICByZXR1cm4gZmluZE90aGVyQXV0aGVyKCk7XG4gICAgfSBmaW5hbGx5IHtcbiAgICAgIC8vIGFsd2F5cyBydW5zXG4gICAgICAvLyBkb2Vzbid0IGFmZmVjdCB0aGUgcmV0dXJuIHZhbHVlXG4gICAgfVxuICAgIGBgYFxuICBcbiAgICBBc3luY2hyb25vdXMgZXhhbXBsZTpcbiAgXG4gICAgYGBganNcbiAgICBmaW5kQXV0aG9yKCkuY2F0Y2goZnVuY3Rpb24ocmVhc29uKXtcbiAgICAgIHJldHVybiBmaW5kT3RoZXJBdXRoZXIoKTtcbiAgICB9KS5maW5hbGx5KGZ1bmN0aW9uKCl7XG4gICAgICAvLyBhdXRob3Igd2FzIGVpdGhlciBmb3VuZCwgb3Igbm90XG4gICAgfSk7XG4gICAgYGBgXG4gIFxuICAgIEBtZXRob2QgZmluYWxseVxuICAgIEBwYXJhbSB7RnVuY3Rpb259IGNhbGxiYWNrXG4gICAgQHJldHVybiB7UHJvbWlzZX1cbiAgKi9cblxuXG4gIFByb21pc2UucHJvdG90eXBlLmZpbmFsbHkgPSBmdW5jdGlvbiBfZmluYWxseShjYWxsYmFjaykge1xuICAgIHZhciBwcm9taXNlID0gdGhpcztcbiAgICB2YXIgY29uc3RydWN0b3IgPSBwcm9taXNlLmNvbnN0cnVjdG9yO1xuXG4gICAgcmV0dXJuIHByb21pc2UudGhlbihmdW5jdGlvbiAodmFsdWUpIHtcbiAgICAgIHJldHVybiBjb25zdHJ1Y3Rvci5yZXNvbHZlKGNhbGxiYWNrKCkpLnRoZW4oZnVuY3Rpb24gKCkge1xuICAgICAgICByZXR1cm4gdmFsdWU7XG4gICAgICB9KTtcbiAgICB9LCBmdW5jdGlvbiAocmVhc29uKSB7XG4gICAgICByZXR1cm4gY29uc3RydWN0b3IucmVzb2x2ZShjYWxsYmFjaygpKS50aGVuKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgdGhyb3cgcmVhc29uO1xuICAgICAgfSk7XG4gICAgfSk7XG4gIH07XG5cbiAgcmV0dXJuIFByb21pc2U7XG59KCk7XG5cblByb21pc2UkMS5wcm90b3R5cGUudGhlbiA9IHRoZW47XG5Qcm9taXNlJDEuYWxsID0gYWxsO1xuUHJvbWlzZSQxLnJhY2UgPSByYWNlO1xuUHJvbWlzZSQxLnJlc29sdmUgPSByZXNvbHZlJDE7XG5Qcm9taXNlJDEucmVqZWN0ID0gcmVqZWN0JDE7XG5Qcm9taXNlJDEuX3NldFNjaGVkdWxlciA9IHNldFNjaGVkdWxlcjtcblByb21pc2UkMS5fc2V0QXNhcCA9IHNldEFzYXA7XG5Qcm9taXNlJDEuX2FzYXAgPSBhc2FwO1xuXG4vKmdsb2JhbCBzZWxmKi9cbmZ1bmN0aW9uIHBvbHlmaWxsKCkge1xuICB2YXIgbG9jYWwgPSB2b2lkIDA7XG5cbiAgaWYgKHR5cGVvZiBnbG9iYWwgIT09ICd1bmRlZmluZWQnKSB7XG4gICAgbG9jYWwgPSBnbG9iYWw7XG4gIH0gZWxzZSBpZiAodHlwZW9mIHNlbGYgIT09ICd1bmRlZmluZWQnKSB7XG4gICAgbG9jYWwgPSBzZWxmO1xuICB9IGVsc2Uge1xuICAgIHRyeSB7XG4gICAgICBsb2NhbCA9IEZ1bmN0aW9uKCdyZXR1cm4gdGhpcycpKCk7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdwb2x5ZmlsbCBmYWlsZWQgYmVjYXVzZSBnbG9iYWwgb2JqZWN0IGlzIHVuYXZhaWxhYmxlIGluIHRoaXMgZW52aXJvbm1lbnQnKTtcbiAgICB9XG4gIH1cblxuICB2YXIgUCA9IGxvY2FsLlByb21pc2U7XG5cbiAgaWYgKFApIHtcbiAgICB2YXIgcHJvbWlzZVRvU3RyaW5nID0gbnVsbDtcbiAgICB0cnkge1xuICAgICAgcHJvbWlzZVRvU3RyaW5nID0gT2JqZWN0LnByb3RvdHlwZS50b1N0cmluZy5jYWxsKFAucmVzb2x2ZSgpKTtcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICAvLyBzaWxlbnRseSBpZ25vcmVkXG4gICAgfVxuXG4gICAgaWYgKHByb21pc2VUb1N0cmluZyA9PT0gJ1tvYmplY3QgUHJvbWlzZV0nICYmICFQLmNhc3QpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gIH1cblxuICBsb2NhbC5Qcm9taXNlID0gUHJvbWlzZSQxO1xufVxuXG4vLyBTdHJhbmdlIGNvbXBhdC4uXG5Qcm9taXNlJDEucG9seWZpbGwgPSBwb2x5ZmlsbDtcblByb21pc2UkMS5Qcm9taXNlID0gUHJvbWlzZSQxO1xuXG5yZXR1cm4gUHJvbWlzZSQxO1xuXG59KSkpO1xuXG5cblxuLy8jIHNvdXJjZU1hcHBpbmdVUkw9ZXM2LXByb21pc2UubWFwXG4iLCIvLyB0aGUgd2hhdHdnLWZldGNoIHBvbHlmaWxsIGluc3RhbGxzIHRoZSBmZXRjaCgpIGZ1bmN0aW9uXG4vLyBvbiB0aGUgZ2xvYmFsIG9iamVjdCAod2luZG93IG9yIHNlbGYpXG4vL1xuLy8gUmV0dXJuIHRoYXQgYXMgdGhlIGV4cG9ydCBmb3IgdXNlIGluIFdlYnBhY2ssIEJyb3dzZXJpZnkgZXRjLlxucmVxdWlyZSgnd2hhdHdnLWZldGNoJyk7XG5tb2R1bGUuZXhwb3J0cyA9IHNlbGYuZmV0Y2guYmluZChzZWxmKTtcbiIsIi8vIHNoaW0gZm9yIHVzaW5nIHByb2Nlc3MgaW4gYnJvd3NlclxudmFyIHByb2Nlc3MgPSBtb2R1bGUuZXhwb3J0cyA9IHt9O1xuXG4vLyBjYWNoZWQgZnJvbSB3aGF0ZXZlciBnbG9iYWwgaXMgcHJlc2VudCBzbyB0aGF0IHRlc3QgcnVubmVycyB0aGF0IHN0dWIgaXRcbi8vIGRvbid0IGJyZWFrIHRoaW5ncy4gIEJ1dCB3ZSBuZWVkIHRvIHdyYXAgaXQgaW4gYSB0cnkgY2F0Y2ggaW4gY2FzZSBpdCBpc1xuLy8gd3JhcHBlZCBpbiBzdHJpY3QgbW9kZSBjb2RlIHdoaWNoIGRvZXNuJ3QgZGVmaW5lIGFueSBnbG9iYWxzLiAgSXQncyBpbnNpZGUgYVxuLy8gZnVuY3Rpb24gYmVjYXVzZSB0cnkvY2F0Y2hlcyBkZW9wdGltaXplIGluIGNlcnRhaW4gZW5naW5lcy5cblxudmFyIGNhY2hlZFNldFRpbWVvdXQ7XG52YXIgY2FjaGVkQ2xlYXJUaW1lb3V0O1xuXG5mdW5jdGlvbiBkZWZhdWx0U2V0VGltb3V0KCkge1xuICAgIHRocm93IG5ldyBFcnJvcignc2V0VGltZW91dCBoYXMgbm90IGJlZW4gZGVmaW5lZCcpO1xufVxuZnVuY3Rpb24gZGVmYXVsdENsZWFyVGltZW91dCAoKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdjbGVhclRpbWVvdXQgaGFzIG5vdCBiZWVuIGRlZmluZWQnKTtcbn1cbihmdW5jdGlvbiAoKSB7XG4gICAgdHJ5IHtcbiAgICAgICAgaWYgKHR5cGVvZiBzZXRUaW1lb3V0ID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgICAgICBjYWNoZWRTZXRUaW1lb3V0ID0gc2V0VGltZW91dDtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGNhY2hlZFNldFRpbWVvdXQgPSBkZWZhdWx0U2V0VGltb3V0O1xuICAgICAgICB9XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgICBjYWNoZWRTZXRUaW1lb3V0ID0gZGVmYXVsdFNldFRpbW91dDtcbiAgICB9XG4gICAgdHJ5IHtcbiAgICAgICAgaWYgKHR5cGVvZiBjbGVhclRpbWVvdXQgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgICAgIGNhY2hlZENsZWFyVGltZW91dCA9IGNsZWFyVGltZW91dDtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGNhY2hlZENsZWFyVGltZW91dCA9IGRlZmF1bHRDbGVhclRpbWVvdXQ7XG4gICAgICAgIH1cbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgIGNhY2hlZENsZWFyVGltZW91dCA9IGRlZmF1bHRDbGVhclRpbWVvdXQ7XG4gICAgfVxufSAoKSlcbmZ1bmN0aW9uIHJ1blRpbWVvdXQoZnVuKSB7XG4gICAgaWYgKGNhY2hlZFNldFRpbWVvdXQgPT09IHNldFRpbWVvdXQpIHtcbiAgICAgICAgLy9ub3JtYWwgZW52aXJvbWVudHMgaW4gc2FuZSBzaXR1YXRpb25zXG4gICAgICAgIHJldHVybiBzZXRUaW1lb3V0KGZ1biwgMCk7XG4gICAgfVxuICAgIC8vIGlmIHNldFRpbWVvdXQgd2Fzbid0IGF2YWlsYWJsZSBidXQgd2FzIGxhdHRlciBkZWZpbmVkXG4gICAgaWYgKChjYWNoZWRTZXRUaW1lb3V0ID09PSBkZWZhdWx0U2V0VGltb3V0IHx8ICFjYWNoZWRTZXRUaW1lb3V0KSAmJiBzZXRUaW1lb3V0KSB7XG4gICAgICAgIGNhY2hlZFNldFRpbWVvdXQgPSBzZXRUaW1lb3V0O1xuICAgICAgICByZXR1cm4gc2V0VGltZW91dChmdW4sIDApO1xuICAgIH1cbiAgICB0cnkge1xuICAgICAgICAvLyB3aGVuIHdoZW4gc29tZWJvZHkgaGFzIHNjcmV3ZWQgd2l0aCBzZXRUaW1lb3V0IGJ1dCBubyBJLkUuIG1hZGRuZXNzXG4gICAgICAgIHJldHVybiBjYWNoZWRTZXRUaW1lb3V0KGZ1biwgMCk7XG4gICAgfSBjYXRjaChlKXtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIC8vIFdoZW4gd2UgYXJlIGluIEkuRS4gYnV0IHRoZSBzY3JpcHQgaGFzIGJlZW4gZXZhbGVkIHNvIEkuRS4gZG9lc24ndCB0cnVzdCB0aGUgZ2xvYmFsIG9iamVjdCB3aGVuIGNhbGxlZCBub3JtYWxseVxuICAgICAgICAgICAgcmV0dXJuIGNhY2hlZFNldFRpbWVvdXQuY2FsbChudWxsLCBmdW4sIDApO1xuICAgICAgICB9IGNhdGNoKGUpe1xuICAgICAgICAgICAgLy8gc2FtZSBhcyBhYm92ZSBidXQgd2hlbiBpdCdzIGEgdmVyc2lvbiBvZiBJLkUuIHRoYXQgbXVzdCBoYXZlIHRoZSBnbG9iYWwgb2JqZWN0IGZvciAndGhpcycsIGhvcGZ1bGx5IG91ciBjb250ZXh0IGNvcnJlY3Qgb3RoZXJ3aXNlIGl0IHdpbGwgdGhyb3cgYSBnbG9iYWwgZXJyb3JcbiAgICAgICAgICAgIHJldHVybiBjYWNoZWRTZXRUaW1lb3V0LmNhbGwodGhpcywgZnVuLCAwKTtcbiAgICAgICAgfVxuICAgIH1cblxuXG59XG5mdW5jdGlvbiBydW5DbGVhclRpbWVvdXQobWFya2VyKSB7XG4gICAgaWYgKGNhY2hlZENsZWFyVGltZW91dCA9PT0gY2xlYXJUaW1lb3V0KSB7XG4gICAgICAgIC8vbm9ybWFsIGVudmlyb21lbnRzIGluIHNhbmUgc2l0dWF0aW9uc1xuICAgICAgICByZXR1cm4gY2xlYXJUaW1lb3V0KG1hcmtlcik7XG4gICAgfVxuICAgIC8vIGlmIGNsZWFyVGltZW91dCB3YXNuJ3QgYXZhaWxhYmxlIGJ1dCB3YXMgbGF0dGVyIGRlZmluZWRcbiAgICBpZiAoKGNhY2hlZENsZWFyVGltZW91dCA9PT0gZGVmYXVsdENsZWFyVGltZW91dCB8fCAhY2FjaGVkQ2xlYXJUaW1lb3V0KSAmJiBjbGVhclRpbWVvdXQpIHtcbiAgICAgICAgY2FjaGVkQ2xlYXJUaW1lb3V0ID0gY2xlYXJUaW1lb3V0O1xuICAgICAgICByZXR1cm4gY2xlYXJUaW1lb3V0KG1hcmtlcik7XG4gICAgfVxuICAgIHRyeSB7XG4gICAgICAgIC8vIHdoZW4gd2hlbiBzb21lYm9keSBoYXMgc2NyZXdlZCB3aXRoIHNldFRpbWVvdXQgYnV0IG5vIEkuRS4gbWFkZG5lc3NcbiAgICAgICAgcmV0dXJuIGNhY2hlZENsZWFyVGltZW91dChtYXJrZXIpO1xuICAgIH0gY2F0Y2ggKGUpe1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgLy8gV2hlbiB3ZSBhcmUgaW4gSS5FLiBidXQgdGhlIHNjcmlwdCBoYXMgYmVlbiBldmFsZWQgc28gSS5FLiBkb2Vzbid0ICB0cnVzdCB0aGUgZ2xvYmFsIG9iamVjdCB3aGVuIGNhbGxlZCBub3JtYWxseVxuICAgICAgICAgICAgcmV0dXJuIGNhY2hlZENsZWFyVGltZW91dC5jYWxsKG51bGwsIG1hcmtlcik7XG4gICAgICAgIH0gY2F0Y2ggKGUpe1xuICAgICAgICAgICAgLy8gc2FtZSBhcyBhYm92ZSBidXQgd2hlbiBpdCdzIGEgdmVyc2lvbiBvZiBJLkUuIHRoYXQgbXVzdCBoYXZlIHRoZSBnbG9iYWwgb2JqZWN0IGZvciAndGhpcycsIGhvcGZ1bGx5IG91ciBjb250ZXh0IGNvcnJlY3Qgb3RoZXJ3aXNlIGl0IHdpbGwgdGhyb3cgYSBnbG9iYWwgZXJyb3IuXG4gICAgICAgICAgICAvLyBTb21lIHZlcnNpb25zIG9mIEkuRS4gaGF2ZSBkaWZmZXJlbnQgcnVsZXMgZm9yIGNsZWFyVGltZW91dCB2cyBzZXRUaW1lb3V0XG4gICAgICAgICAgICByZXR1cm4gY2FjaGVkQ2xlYXJUaW1lb3V0LmNhbGwodGhpcywgbWFya2VyKTtcbiAgICAgICAgfVxuICAgIH1cblxuXG5cbn1cbnZhciBxdWV1ZSA9IFtdO1xudmFyIGRyYWluaW5nID0gZmFsc2U7XG52YXIgY3VycmVudFF1ZXVlO1xudmFyIHF1ZXVlSW5kZXggPSAtMTtcblxuZnVuY3Rpb24gY2xlYW5VcE5leHRUaWNrKCkge1xuICAgIGlmICghZHJhaW5pbmcgfHwgIWN1cnJlbnRRdWV1ZSkge1xuICAgICAgICByZXR1cm47XG4gICAgfVxuICAgIGRyYWluaW5nID0gZmFsc2U7XG4gICAgaWYgKGN1cnJlbnRRdWV1ZS5sZW5ndGgpIHtcbiAgICAgICAgcXVldWUgPSBjdXJyZW50UXVldWUuY29uY2F0KHF1ZXVlKTtcbiAgICB9IGVsc2Uge1xuICAgICAgICBxdWV1ZUluZGV4ID0gLTE7XG4gICAgfVxuICAgIGlmIChxdWV1ZS5sZW5ndGgpIHtcbiAgICAgICAgZHJhaW5RdWV1ZSgpO1xuICAgIH1cbn1cblxuZnVuY3Rpb24gZHJhaW5RdWV1ZSgpIHtcbiAgICBpZiAoZHJhaW5pbmcpIHtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICB2YXIgdGltZW91dCA9IHJ1blRpbWVvdXQoY2xlYW5VcE5leHRUaWNrKTtcbiAgICBkcmFpbmluZyA9IHRydWU7XG5cbiAgICB2YXIgbGVuID0gcXVldWUubGVuZ3RoO1xuICAgIHdoaWxlKGxlbikge1xuICAgICAgICBjdXJyZW50UXVldWUgPSBxdWV1ZTtcbiAgICAgICAgcXVldWUgPSBbXTtcbiAgICAgICAgd2hpbGUgKCsrcXVldWVJbmRleCA8IGxlbikge1xuICAgICAgICAgICAgaWYgKGN1cnJlbnRRdWV1ZSkge1xuICAgICAgICAgICAgICAgIGN1cnJlbnRRdWV1ZVtxdWV1ZUluZGV4XS5ydW4oKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBxdWV1ZUluZGV4ID0gLTE7XG4gICAgICAgIGxlbiA9IHF1ZXVlLmxlbmd0aDtcbiAgICB9XG4gICAgY3VycmVudFF1ZXVlID0gbnVsbDtcbiAgICBkcmFpbmluZyA9IGZhbHNlO1xuICAgIHJ1bkNsZWFyVGltZW91dCh0aW1lb3V0KTtcbn1cblxucHJvY2Vzcy5uZXh0VGljayA9IGZ1bmN0aW9uIChmdW4pIHtcbiAgICB2YXIgYXJncyA9IG5ldyBBcnJheShhcmd1bWVudHMubGVuZ3RoIC0gMSk7XG4gICAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPiAxKSB7XG4gICAgICAgIGZvciAodmFyIGkgPSAxOyBpIDwgYXJndW1lbnRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBhcmdzW2kgLSAxXSA9IGFyZ3VtZW50c1tpXTtcbiAgICAgICAgfVxuICAgIH1cbiAgICBxdWV1ZS5wdXNoKG5ldyBJdGVtKGZ1biwgYXJncykpO1xuICAgIGlmIChxdWV1ZS5sZW5ndGggPT09IDEgJiYgIWRyYWluaW5nKSB7XG4gICAgICAgIHJ1blRpbWVvdXQoZHJhaW5RdWV1ZSk7XG4gICAgfVxufTtcblxuLy8gdjggbGlrZXMgcHJlZGljdGlibGUgb2JqZWN0c1xuZnVuY3Rpb24gSXRlbShmdW4sIGFycmF5KSB7XG4gICAgdGhpcy5mdW4gPSBmdW47XG4gICAgdGhpcy5hcnJheSA9IGFycmF5O1xufVxuSXRlbS5wcm90b3R5cGUucnVuID0gZnVuY3Rpb24gKCkge1xuICAgIHRoaXMuZnVuLmFwcGx5KG51bGwsIHRoaXMuYXJyYXkpO1xufTtcbnByb2Nlc3MudGl0bGUgPSAnYnJvd3Nlcic7XG5wcm9jZXNzLmJyb3dzZXIgPSB0cnVlO1xucHJvY2Vzcy5lbnYgPSB7fTtcbnByb2Nlc3MuYXJndiA9IFtdO1xucHJvY2Vzcy52ZXJzaW9uID0gJyc7IC8vIGVtcHR5IHN0cmluZyB0byBhdm9pZCByZWdleHAgaXNzdWVzXG5wcm9jZXNzLnZlcnNpb25zID0ge307XG5cbmZ1bmN0aW9uIG5vb3AoKSB7fVxuXG5wcm9jZXNzLm9uID0gbm9vcDtcbnByb2Nlc3MuYWRkTGlzdGVuZXIgPSBub29wO1xucHJvY2Vzcy5vbmNlID0gbm9vcDtcbnByb2Nlc3Mub2ZmID0gbm9vcDtcbnByb2Nlc3MucmVtb3ZlTGlzdGVuZXIgPSBub29wO1xucHJvY2Vzcy5yZW1vdmVBbGxMaXN0ZW5lcnMgPSBub29wO1xucHJvY2Vzcy5lbWl0ID0gbm9vcDtcbnByb2Nlc3MucHJlcGVuZExpc3RlbmVyID0gbm9vcDtcbnByb2Nlc3MucHJlcGVuZE9uY2VMaXN0ZW5lciA9IG5vb3A7XG5cbnByb2Nlc3MubGlzdGVuZXJzID0gZnVuY3Rpb24gKG5hbWUpIHsgcmV0dXJuIFtdIH1cblxucHJvY2Vzcy5iaW5kaW5nID0gZnVuY3Rpb24gKG5hbWUpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ3Byb2Nlc3MuYmluZGluZyBpcyBub3Qgc3VwcG9ydGVkJyk7XG59O1xuXG5wcm9jZXNzLmN3ZCA9IGZ1bmN0aW9uICgpIHsgcmV0dXJuICcvJyB9O1xucHJvY2Vzcy5jaGRpciA9IGZ1bmN0aW9uIChkaXIpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ3Byb2Nlc3MuY2hkaXIgaXMgbm90IHN1cHBvcnRlZCcpO1xufTtcbnByb2Nlc3MudW1hc2sgPSBmdW5jdGlvbigpIHsgcmV0dXJuIDA7IH07XG4iLCIoZnVuY3Rpb24oc2VsZikge1xuICAndXNlIHN0cmljdCc7XG5cbiAgaWYgKHNlbGYuZmV0Y2gpIHtcbiAgICByZXR1cm5cbiAgfVxuXG4gIHZhciBzdXBwb3J0ID0ge1xuICAgIHNlYXJjaFBhcmFtczogJ1VSTFNlYXJjaFBhcmFtcycgaW4gc2VsZixcbiAgICBpdGVyYWJsZTogJ1N5bWJvbCcgaW4gc2VsZiAmJiAnaXRlcmF0b3InIGluIFN5bWJvbCxcbiAgICBibG9iOiAnRmlsZVJlYWRlcicgaW4gc2VsZiAmJiAnQmxvYicgaW4gc2VsZiAmJiAoZnVuY3Rpb24oKSB7XG4gICAgICB0cnkge1xuICAgICAgICBuZXcgQmxvYigpXG4gICAgICAgIHJldHVybiB0cnVlXG4gICAgICB9IGNhdGNoKGUpIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlXG4gICAgICB9XG4gICAgfSkoKSxcbiAgICBmb3JtRGF0YTogJ0Zvcm1EYXRhJyBpbiBzZWxmLFxuICAgIGFycmF5QnVmZmVyOiAnQXJyYXlCdWZmZXInIGluIHNlbGZcbiAgfVxuXG4gIGlmIChzdXBwb3J0LmFycmF5QnVmZmVyKSB7XG4gICAgdmFyIHZpZXdDbGFzc2VzID0gW1xuICAgICAgJ1tvYmplY3QgSW50OEFycmF5XScsXG4gICAgICAnW29iamVjdCBVaW50OEFycmF5XScsXG4gICAgICAnW29iamVjdCBVaW50OENsYW1wZWRBcnJheV0nLFxuICAgICAgJ1tvYmplY3QgSW50MTZBcnJheV0nLFxuICAgICAgJ1tvYmplY3QgVWludDE2QXJyYXldJyxcbiAgICAgICdbb2JqZWN0IEludDMyQXJyYXldJyxcbiAgICAgICdbb2JqZWN0IFVpbnQzMkFycmF5XScsXG4gICAgICAnW29iamVjdCBGbG9hdDMyQXJyYXldJyxcbiAgICAgICdbb2JqZWN0IEZsb2F0NjRBcnJheV0nXG4gICAgXVxuXG4gICAgdmFyIGlzRGF0YVZpZXcgPSBmdW5jdGlvbihvYmopIHtcbiAgICAgIHJldHVybiBvYmogJiYgRGF0YVZpZXcucHJvdG90eXBlLmlzUHJvdG90eXBlT2Yob2JqKVxuICAgIH1cblxuICAgIHZhciBpc0FycmF5QnVmZmVyVmlldyA9IEFycmF5QnVmZmVyLmlzVmlldyB8fCBmdW5jdGlvbihvYmopIHtcbiAgICAgIHJldHVybiBvYmogJiYgdmlld0NsYXNzZXMuaW5kZXhPZihPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nLmNhbGwob2JqKSkgPiAtMVxuICAgIH1cbiAgfVxuXG4gIGZ1bmN0aW9uIG5vcm1hbGl6ZU5hbWUobmFtZSkge1xuICAgIGlmICh0eXBlb2YgbmFtZSAhPT0gJ3N0cmluZycpIHtcbiAgICAgIG5hbWUgPSBTdHJpbmcobmFtZSlcbiAgICB9XG4gICAgaWYgKC9bXmEtejAtOVxcLSMkJSYnKisuXFxeX2B8fl0vaS50ZXN0KG5hbWUpKSB7XG4gICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdJbnZhbGlkIGNoYXJhY3RlciBpbiBoZWFkZXIgZmllbGQgbmFtZScpXG4gICAgfVxuICAgIHJldHVybiBuYW1lLnRvTG93ZXJDYXNlKClcbiAgfVxuXG4gIGZ1bmN0aW9uIG5vcm1hbGl6ZVZhbHVlKHZhbHVlKSB7XG4gICAgaWYgKHR5cGVvZiB2YWx1ZSAhPT0gJ3N0cmluZycpIHtcbiAgICAgIHZhbHVlID0gU3RyaW5nKHZhbHVlKVxuICAgIH1cbiAgICByZXR1cm4gdmFsdWVcbiAgfVxuXG4gIC8vIEJ1aWxkIGEgZGVzdHJ1Y3RpdmUgaXRlcmF0b3IgZm9yIHRoZSB2YWx1ZSBsaXN0XG4gIGZ1bmN0aW9uIGl0ZXJhdG9yRm9yKGl0ZW1zKSB7XG4gICAgdmFyIGl0ZXJhdG9yID0ge1xuICAgICAgbmV4dDogZnVuY3Rpb24oKSB7XG4gICAgICAgIHZhciB2YWx1ZSA9IGl0ZW1zLnNoaWZ0KClcbiAgICAgICAgcmV0dXJuIHtkb25lOiB2YWx1ZSA9PT0gdW5kZWZpbmVkLCB2YWx1ZTogdmFsdWV9XG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKHN1cHBvcnQuaXRlcmFibGUpIHtcbiAgICAgIGl0ZXJhdG9yW1N5bWJvbC5pdGVyYXRvcl0gPSBmdW5jdGlvbigpIHtcbiAgICAgICAgcmV0dXJuIGl0ZXJhdG9yXG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIGl0ZXJhdG9yXG4gIH1cblxuICBmdW5jdGlvbiBIZWFkZXJzKGhlYWRlcnMpIHtcbiAgICB0aGlzLm1hcCA9IHt9XG5cbiAgICBpZiAoaGVhZGVycyBpbnN0YW5jZW9mIEhlYWRlcnMpIHtcbiAgICAgIGhlYWRlcnMuZm9yRWFjaChmdW5jdGlvbih2YWx1ZSwgbmFtZSkge1xuICAgICAgICB0aGlzLmFwcGVuZChuYW1lLCB2YWx1ZSlcbiAgICAgIH0sIHRoaXMpXG4gICAgfSBlbHNlIGlmIChBcnJheS5pc0FycmF5KGhlYWRlcnMpKSB7XG4gICAgICBoZWFkZXJzLmZvckVhY2goZnVuY3Rpb24oaGVhZGVyKSB7XG4gICAgICAgIHRoaXMuYXBwZW5kKGhlYWRlclswXSwgaGVhZGVyWzFdKVxuICAgICAgfSwgdGhpcylcbiAgICB9IGVsc2UgaWYgKGhlYWRlcnMpIHtcbiAgICAgIE9iamVjdC5nZXRPd25Qcm9wZXJ0eU5hbWVzKGhlYWRlcnMpLmZvckVhY2goZnVuY3Rpb24obmFtZSkge1xuICAgICAgICB0aGlzLmFwcGVuZChuYW1lLCBoZWFkZXJzW25hbWVdKVxuICAgICAgfSwgdGhpcylcbiAgICB9XG4gIH1cblxuICBIZWFkZXJzLnByb3RvdHlwZS5hcHBlbmQgPSBmdW5jdGlvbihuYW1lLCB2YWx1ZSkge1xuICAgIG5hbWUgPSBub3JtYWxpemVOYW1lKG5hbWUpXG4gICAgdmFsdWUgPSBub3JtYWxpemVWYWx1ZSh2YWx1ZSlcbiAgICB2YXIgb2xkVmFsdWUgPSB0aGlzLm1hcFtuYW1lXVxuICAgIHRoaXMubWFwW25hbWVdID0gb2xkVmFsdWUgPyBvbGRWYWx1ZSsnLCcrdmFsdWUgOiB2YWx1ZVxuICB9XG5cbiAgSGVhZGVycy5wcm90b3R5cGVbJ2RlbGV0ZSddID0gZnVuY3Rpb24obmFtZSkge1xuICAgIGRlbGV0ZSB0aGlzLm1hcFtub3JtYWxpemVOYW1lKG5hbWUpXVxuICB9XG5cbiAgSGVhZGVycy5wcm90b3R5cGUuZ2V0ID0gZnVuY3Rpb24obmFtZSkge1xuICAgIG5hbWUgPSBub3JtYWxpemVOYW1lKG5hbWUpXG4gICAgcmV0dXJuIHRoaXMuaGFzKG5hbWUpID8gdGhpcy5tYXBbbmFtZV0gOiBudWxsXG4gIH1cblxuICBIZWFkZXJzLnByb3RvdHlwZS5oYXMgPSBmdW5jdGlvbihuYW1lKSB7XG4gICAgcmV0dXJuIHRoaXMubWFwLmhhc093blByb3BlcnR5KG5vcm1hbGl6ZU5hbWUobmFtZSkpXG4gIH1cblxuICBIZWFkZXJzLnByb3RvdHlwZS5zZXQgPSBmdW5jdGlvbihuYW1lLCB2YWx1ZSkge1xuICAgIHRoaXMubWFwW25vcm1hbGl6ZU5hbWUobmFtZSldID0gbm9ybWFsaXplVmFsdWUodmFsdWUpXG4gIH1cblxuICBIZWFkZXJzLnByb3RvdHlwZS5mb3JFYWNoID0gZnVuY3Rpb24oY2FsbGJhY2ssIHRoaXNBcmcpIHtcbiAgICBmb3IgKHZhciBuYW1lIGluIHRoaXMubWFwKSB7XG4gICAgICBpZiAodGhpcy5tYXAuaGFzT3duUHJvcGVydHkobmFtZSkpIHtcbiAgICAgICAgY2FsbGJhY2suY2FsbCh0aGlzQXJnLCB0aGlzLm1hcFtuYW1lXSwgbmFtZSwgdGhpcylcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBIZWFkZXJzLnByb3RvdHlwZS5rZXlzID0gZnVuY3Rpb24oKSB7XG4gICAgdmFyIGl0ZW1zID0gW11cbiAgICB0aGlzLmZvckVhY2goZnVuY3Rpb24odmFsdWUsIG5hbWUpIHsgaXRlbXMucHVzaChuYW1lKSB9KVxuICAgIHJldHVybiBpdGVyYXRvckZvcihpdGVtcylcbiAgfVxuXG4gIEhlYWRlcnMucHJvdG90eXBlLnZhbHVlcyA9IGZ1bmN0aW9uKCkge1xuICAgIHZhciBpdGVtcyA9IFtdXG4gICAgdGhpcy5mb3JFYWNoKGZ1bmN0aW9uKHZhbHVlKSB7IGl0ZW1zLnB1c2godmFsdWUpIH0pXG4gICAgcmV0dXJuIGl0ZXJhdG9yRm9yKGl0ZW1zKVxuICB9XG5cbiAgSGVhZGVycy5wcm90b3R5cGUuZW50cmllcyA9IGZ1bmN0aW9uKCkge1xuICAgIHZhciBpdGVtcyA9IFtdXG4gICAgdGhpcy5mb3JFYWNoKGZ1bmN0aW9uKHZhbHVlLCBuYW1lKSB7IGl0ZW1zLnB1c2goW25hbWUsIHZhbHVlXSkgfSlcbiAgICByZXR1cm4gaXRlcmF0b3JGb3IoaXRlbXMpXG4gIH1cblxuICBpZiAoc3VwcG9ydC5pdGVyYWJsZSkge1xuICAgIEhlYWRlcnMucHJvdG90eXBlW1N5bWJvbC5pdGVyYXRvcl0gPSBIZWFkZXJzLnByb3RvdHlwZS5lbnRyaWVzXG4gIH1cblxuICBmdW5jdGlvbiBjb25zdW1lZChib2R5KSB7XG4gICAgaWYgKGJvZHkuYm9keVVzZWQpIHtcbiAgICAgIHJldHVybiBQcm9taXNlLnJlamVjdChuZXcgVHlwZUVycm9yKCdBbHJlYWR5IHJlYWQnKSlcbiAgICB9XG4gICAgYm9keS5ib2R5VXNlZCA9IHRydWVcbiAgfVxuXG4gIGZ1bmN0aW9uIGZpbGVSZWFkZXJSZWFkeShyZWFkZXIpIHtcbiAgICByZXR1cm4gbmV3IFByb21pc2UoZnVuY3Rpb24ocmVzb2x2ZSwgcmVqZWN0KSB7XG4gICAgICByZWFkZXIub25sb2FkID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIHJlc29sdmUocmVhZGVyLnJlc3VsdClcbiAgICAgIH1cbiAgICAgIHJlYWRlci5vbmVycm9yID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIHJlamVjdChyZWFkZXIuZXJyb3IpXG4gICAgICB9XG4gICAgfSlcbiAgfVxuXG4gIGZ1bmN0aW9uIHJlYWRCbG9iQXNBcnJheUJ1ZmZlcihibG9iKSB7XG4gICAgdmFyIHJlYWRlciA9IG5ldyBGaWxlUmVhZGVyKClcbiAgICB2YXIgcHJvbWlzZSA9IGZpbGVSZWFkZXJSZWFkeShyZWFkZXIpXG4gICAgcmVhZGVyLnJlYWRBc0FycmF5QnVmZmVyKGJsb2IpXG4gICAgcmV0dXJuIHByb21pc2VcbiAgfVxuXG4gIGZ1bmN0aW9uIHJlYWRCbG9iQXNUZXh0KGJsb2IpIHtcbiAgICB2YXIgcmVhZGVyID0gbmV3IEZpbGVSZWFkZXIoKVxuICAgIHZhciBwcm9taXNlID0gZmlsZVJlYWRlclJlYWR5KHJlYWRlcilcbiAgICByZWFkZXIucmVhZEFzVGV4dChibG9iKVxuICAgIHJldHVybiBwcm9taXNlXG4gIH1cblxuICBmdW5jdGlvbiByZWFkQXJyYXlCdWZmZXJBc1RleHQoYnVmKSB7XG4gICAgdmFyIHZpZXcgPSBuZXcgVWludDhBcnJheShidWYpXG4gICAgdmFyIGNoYXJzID0gbmV3IEFycmF5KHZpZXcubGVuZ3RoKVxuXG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCB2aWV3Lmxlbmd0aDsgaSsrKSB7XG4gICAgICBjaGFyc1tpXSA9IFN0cmluZy5mcm9tQ2hhckNvZGUodmlld1tpXSlcbiAgICB9XG4gICAgcmV0dXJuIGNoYXJzLmpvaW4oJycpXG4gIH1cblxuICBmdW5jdGlvbiBidWZmZXJDbG9uZShidWYpIHtcbiAgICBpZiAoYnVmLnNsaWNlKSB7XG4gICAgICByZXR1cm4gYnVmLnNsaWNlKDApXG4gICAgfSBlbHNlIHtcbiAgICAgIHZhciB2aWV3ID0gbmV3IFVpbnQ4QXJyYXkoYnVmLmJ5dGVMZW5ndGgpXG4gICAgICB2aWV3LnNldChuZXcgVWludDhBcnJheShidWYpKVxuICAgICAgcmV0dXJuIHZpZXcuYnVmZmVyXG4gICAgfVxuICB9XG5cbiAgZnVuY3Rpb24gQm9keSgpIHtcbiAgICB0aGlzLmJvZHlVc2VkID0gZmFsc2VcblxuICAgIHRoaXMuX2luaXRCb2R5ID0gZnVuY3Rpb24oYm9keSkge1xuICAgICAgdGhpcy5fYm9keUluaXQgPSBib2R5XG4gICAgICBpZiAoIWJvZHkpIHtcbiAgICAgICAgdGhpcy5fYm9keVRleHQgPSAnJ1xuICAgICAgfSBlbHNlIGlmICh0eXBlb2YgYm9keSA9PT0gJ3N0cmluZycpIHtcbiAgICAgICAgdGhpcy5fYm9keVRleHQgPSBib2R5XG4gICAgICB9IGVsc2UgaWYgKHN1cHBvcnQuYmxvYiAmJiBCbG9iLnByb3RvdHlwZS5pc1Byb3RvdHlwZU9mKGJvZHkpKSB7XG4gICAgICAgIHRoaXMuX2JvZHlCbG9iID0gYm9keVxuICAgICAgfSBlbHNlIGlmIChzdXBwb3J0LmZvcm1EYXRhICYmIEZvcm1EYXRhLnByb3RvdHlwZS5pc1Byb3RvdHlwZU9mKGJvZHkpKSB7XG4gICAgICAgIHRoaXMuX2JvZHlGb3JtRGF0YSA9IGJvZHlcbiAgICAgIH0gZWxzZSBpZiAoc3VwcG9ydC5zZWFyY2hQYXJhbXMgJiYgVVJMU2VhcmNoUGFyYW1zLnByb3RvdHlwZS5pc1Byb3RvdHlwZU9mKGJvZHkpKSB7XG4gICAgICAgIHRoaXMuX2JvZHlUZXh0ID0gYm9keS50b1N0cmluZygpXG4gICAgICB9IGVsc2UgaWYgKHN1cHBvcnQuYXJyYXlCdWZmZXIgJiYgc3VwcG9ydC5ibG9iICYmIGlzRGF0YVZpZXcoYm9keSkpIHtcbiAgICAgICAgdGhpcy5fYm9keUFycmF5QnVmZmVyID0gYnVmZmVyQ2xvbmUoYm9keS5idWZmZXIpXG4gICAgICAgIC8vIElFIDEwLTExIGNhbid0IGhhbmRsZSBhIERhdGFWaWV3IGJvZHkuXG4gICAgICAgIHRoaXMuX2JvZHlJbml0ID0gbmV3IEJsb2IoW3RoaXMuX2JvZHlBcnJheUJ1ZmZlcl0pXG4gICAgICB9IGVsc2UgaWYgKHN1cHBvcnQuYXJyYXlCdWZmZXIgJiYgKEFycmF5QnVmZmVyLnByb3RvdHlwZS5pc1Byb3RvdHlwZU9mKGJvZHkpIHx8IGlzQXJyYXlCdWZmZXJWaWV3KGJvZHkpKSkge1xuICAgICAgICB0aGlzLl9ib2R5QXJyYXlCdWZmZXIgPSBidWZmZXJDbG9uZShib2R5KVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKCd1bnN1cHBvcnRlZCBCb2R5SW5pdCB0eXBlJylcbiAgICAgIH1cblxuICAgICAgaWYgKCF0aGlzLmhlYWRlcnMuZ2V0KCdjb250ZW50LXR5cGUnKSkge1xuICAgICAgICBpZiAodHlwZW9mIGJvZHkgPT09ICdzdHJpbmcnKSB7XG4gICAgICAgICAgdGhpcy5oZWFkZXJzLnNldCgnY29udGVudC10eXBlJywgJ3RleHQvcGxhaW47Y2hhcnNldD1VVEYtOCcpXG4gICAgICAgIH0gZWxzZSBpZiAodGhpcy5fYm9keUJsb2IgJiYgdGhpcy5fYm9keUJsb2IudHlwZSkge1xuICAgICAgICAgIHRoaXMuaGVhZGVycy5zZXQoJ2NvbnRlbnQtdHlwZScsIHRoaXMuX2JvZHlCbG9iLnR5cGUpXG4gICAgICAgIH0gZWxzZSBpZiAoc3VwcG9ydC5zZWFyY2hQYXJhbXMgJiYgVVJMU2VhcmNoUGFyYW1zLnByb3RvdHlwZS5pc1Byb3RvdHlwZU9mKGJvZHkpKSB7XG4gICAgICAgICAgdGhpcy5oZWFkZXJzLnNldCgnY29udGVudC10eXBlJywgJ2FwcGxpY2F0aW9uL3gtd3d3LWZvcm0tdXJsZW5jb2RlZDtjaGFyc2V0PVVURi04JylcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cblxuICAgIGlmIChzdXBwb3J0LmJsb2IpIHtcbiAgICAgIHRoaXMuYmxvYiA9IGZ1bmN0aW9uKCkge1xuICAgICAgICB2YXIgcmVqZWN0ZWQgPSBjb25zdW1lZCh0aGlzKVxuICAgICAgICBpZiAocmVqZWN0ZWQpIHtcbiAgICAgICAgICByZXR1cm4gcmVqZWN0ZWRcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0aGlzLl9ib2R5QmxvYikge1xuICAgICAgICAgIHJldHVybiBQcm9taXNlLnJlc29sdmUodGhpcy5fYm9keUJsb2IpXG4gICAgICAgIH0gZWxzZSBpZiAodGhpcy5fYm9keUFycmF5QnVmZmVyKSB7XG4gICAgICAgICAgcmV0dXJuIFByb21pc2UucmVzb2x2ZShuZXcgQmxvYihbdGhpcy5fYm9keUFycmF5QnVmZmVyXSkpXG4gICAgICAgIH0gZWxzZSBpZiAodGhpcy5fYm9keUZvcm1EYXRhKSB7XG4gICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdjb3VsZCBub3QgcmVhZCBGb3JtRGF0YSBib2R5IGFzIGJsb2InKVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHJldHVybiBQcm9taXNlLnJlc29sdmUobmV3IEJsb2IoW3RoaXMuX2JvZHlUZXh0XSkpXG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgdGhpcy5hcnJheUJ1ZmZlciA9IGZ1bmN0aW9uKCkge1xuICAgICAgICBpZiAodGhpcy5fYm9keUFycmF5QnVmZmVyKSB7XG4gICAgICAgICAgcmV0dXJuIGNvbnN1bWVkKHRoaXMpIHx8IFByb21pc2UucmVzb2x2ZSh0aGlzLl9ib2R5QXJyYXlCdWZmZXIpXG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcmV0dXJuIHRoaXMuYmxvYigpLnRoZW4ocmVhZEJsb2JBc0FycmF5QnVmZmVyKVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuXG4gICAgdGhpcy50ZXh0ID0gZnVuY3Rpb24oKSB7XG4gICAgICB2YXIgcmVqZWN0ZWQgPSBjb25zdW1lZCh0aGlzKVxuICAgICAgaWYgKHJlamVjdGVkKSB7XG4gICAgICAgIHJldHVybiByZWplY3RlZFxuICAgICAgfVxuXG4gICAgICBpZiAodGhpcy5fYm9keUJsb2IpIHtcbiAgICAgICAgcmV0dXJuIHJlYWRCbG9iQXNUZXh0KHRoaXMuX2JvZHlCbG9iKVxuICAgICAgfSBlbHNlIGlmICh0aGlzLl9ib2R5QXJyYXlCdWZmZXIpIHtcbiAgICAgICAgcmV0dXJuIFByb21pc2UucmVzb2x2ZShyZWFkQXJyYXlCdWZmZXJBc1RleHQodGhpcy5fYm9keUFycmF5QnVmZmVyKSlcbiAgICAgIH0gZWxzZSBpZiAodGhpcy5fYm9keUZvcm1EYXRhKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcignY291bGQgbm90IHJlYWQgRm9ybURhdGEgYm9keSBhcyB0ZXh0JylcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJldHVybiBQcm9taXNlLnJlc29sdmUodGhpcy5fYm9keVRleHQpXG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKHN1cHBvcnQuZm9ybURhdGEpIHtcbiAgICAgIHRoaXMuZm9ybURhdGEgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMudGV4dCgpLnRoZW4oZGVjb2RlKVxuICAgICAgfVxuICAgIH1cblxuICAgIHRoaXMuanNvbiA9IGZ1bmN0aW9uKCkge1xuICAgICAgcmV0dXJuIHRoaXMudGV4dCgpLnRoZW4oSlNPTi5wYXJzZSlcbiAgICB9XG5cbiAgICByZXR1cm4gdGhpc1xuICB9XG5cbiAgLy8gSFRUUCBtZXRob2RzIHdob3NlIGNhcGl0YWxpemF0aW9uIHNob3VsZCBiZSBub3JtYWxpemVkXG4gIHZhciBtZXRob2RzID0gWydERUxFVEUnLCAnR0VUJywgJ0hFQUQnLCAnT1BUSU9OUycsICdQT1NUJywgJ1BVVCddXG5cbiAgZnVuY3Rpb24gbm9ybWFsaXplTWV0aG9kKG1ldGhvZCkge1xuICAgIHZhciB1cGNhc2VkID0gbWV0aG9kLnRvVXBwZXJDYXNlKClcbiAgICByZXR1cm4gKG1ldGhvZHMuaW5kZXhPZih1cGNhc2VkKSA+IC0xKSA/IHVwY2FzZWQgOiBtZXRob2RcbiAgfVxuXG4gIGZ1bmN0aW9uIFJlcXVlc3QoaW5wdXQsIG9wdGlvbnMpIHtcbiAgICBvcHRpb25zID0gb3B0aW9ucyB8fCB7fVxuICAgIHZhciBib2R5ID0gb3B0aW9ucy5ib2R5XG5cbiAgICBpZiAoaW5wdXQgaW5zdGFuY2VvZiBSZXF1ZXN0KSB7XG4gICAgICBpZiAoaW5wdXQuYm9keVVzZWQpIHtcbiAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcignQWxyZWFkeSByZWFkJylcbiAgICAgIH1cbiAgICAgIHRoaXMudXJsID0gaW5wdXQudXJsXG4gICAgICB0aGlzLmNyZWRlbnRpYWxzID0gaW5wdXQuY3JlZGVudGlhbHNcbiAgICAgIGlmICghb3B0aW9ucy5oZWFkZXJzKSB7XG4gICAgICAgIHRoaXMuaGVhZGVycyA9IG5ldyBIZWFkZXJzKGlucHV0LmhlYWRlcnMpXG4gICAgICB9XG4gICAgICB0aGlzLm1ldGhvZCA9IGlucHV0Lm1ldGhvZFxuICAgICAgdGhpcy5tb2RlID0gaW5wdXQubW9kZVxuICAgICAgaWYgKCFib2R5ICYmIGlucHV0Ll9ib2R5SW5pdCAhPSBudWxsKSB7XG4gICAgICAgIGJvZHkgPSBpbnB1dC5fYm9keUluaXRcbiAgICAgICAgaW5wdXQuYm9keVVzZWQgPSB0cnVlXG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMudXJsID0gU3RyaW5nKGlucHV0KVxuICAgIH1cblxuICAgIHRoaXMuY3JlZGVudGlhbHMgPSBvcHRpb25zLmNyZWRlbnRpYWxzIHx8IHRoaXMuY3JlZGVudGlhbHMgfHwgJ29taXQnXG4gICAgaWYgKG9wdGlvbnMuaGVhZGVycyB8fCAhdGhpcy5oZWFkZXJzKSB7XG4gICAgICB0aGlzLmhlYWRlcnMgPSBuZXcgSGVhZGVycyhvcHRpb25zLmhlYWRlcnMpXG4gICAgfVxuICAgIHRoaXMubWV0aG9kID0gbm9ybWFsaXplTWV0aG9kKG9wdGlvbnMubWV0aG9kIHx8IHRoaXMubWV0aG9kIHx8ICdHRVQnKVxuICAgIHRoaXMubW9kZSA9IG9wdGlvbnMubW9kZSB8fCB0aGlzLm1vZGUgfHwgbnVsbFxuICAgIHRoaXMucmVmZXJyZXIgPSBudWxsXG5cbiAgICBpZiAoKHRoaXMubWV0aG9kID09PSAnR0VUJyB8fCB0aGlzLm1ldGhvZCA9PT0gJ0hFQUQnKSAmJiBib2R5KSB7XG4gICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdCb2R5IG5vdCBhbGxvd2VkIGZvciBHRVQgb3IgSEVBRCByZXF1ZXN0cycpXG4gICAgfVxuICAgIHRoaXMuX2luaXRCb2R5KGJvZHkpXG4gIH1cblxuICBSZXF1ZXN0LnByb3RvdHlwZS5jbG9uZSA9IGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiBuZXcgUmVxdWVzdCh0aGlzLCB7IGJvZHk6IHRoaXMuX2JvZHlJbml0IH0pXG4gIH1cblxuICBmdW5jdGlvbiBkZWNvZGUoYm9keSkge1xuICAgIHZhciBmb3JtID0gbmV3IEZvcm1EYXRhKClcbiAgICBib2R5LnRyaW0oKS5zcGxpdCgnJicpLmZvckVhY2goZnVuY3Rpb24oYnl0ZXMpIHtcbiAgICAgIGlmIChieXRlcykge1xuICAgICAgICB2YXIgc3BsaXQgPSBieXRlcy5zcGxpdCgnPScpXG4gICAgICAgIHZhciBuYW1lID0gc3BsaXQuc2hpZnQoKS5yZXBsYWNlKC9cXCsvZywgJyAnKVxuICAgICAgICB2YXIgdmFsdWUgPSBzcGxpdC5qb2luKCc9JykucmVwbGFjZSgvXFwrL2csICcgJylcbiAgICAgICAgZm9ybS5hcHBlbmQoZGVjb2RlVVJJQ29tcG9uZW50KG5hbWUpLCBkZWNvZGVVUklDb21wb25lbnQodmFsdWUpKVxuICAgICAgfVxuICAgIH0pXG4gICAgcmV0dXJuIGZvcm1cbiAgfVxuXG4gIGZ1bmN0aW9uIHBhcnNlSGVhZGVycyhyYXdIZWFkZXJzKSB7XG4gICAgdmFyIGhlYWRlcnMgPSBuZXcgSGVhZGVycygpXG4gICAgcmF3SGVhZGVycy5zcGxpdCgvXFxyP1xcbi8pLmZvckVhY2goZnVuY3Rpb24obGluZSkge1xuICAgICAgdmFyIHBhcnRzID0gbGluZS5zcGxpdCgnOicpXG4gICAgICB2YXIga2V5ID0gcGFydHMuc2hpZnQoKS50cmltKClcbiAgICAgIGlmIChrZXkpIHtcbiAgICAgICAgdmFyIHZhbHVlID0gcGFydHMuam9pbignOicpLnRyaW0oKVxuICAgICAgICBoZWFkZXJzLmFwcGVuZChrZXksIHZhbHVlKVxuICAgICAgfVxuICAgIH0pXG4gICAgcmV0dXJuIGhlYWRlcnNcbiAgfVxuXG4gIEJvZHkuY2FsbChSZXF1ZXN0LnByb3RvdHlwZSlcblxuICBmdW5jdGlvbiBSZXNwb25zZShib2R5SW5pdCwgb3B0aW9ucykge1xuICAgIGlmICghb3B0aW9ucykge1xuICAgICAgb3B0aW9ucyA9IHt9XG4gICAgfVxuXG4gICAgdGhpcy50eXBlID0gJ2RlZmF1bHQnXG4gICAgdGhpcy5zdGF0dXMgPSAnc3RhdHVzJyBpbiBvcHRpb25zID8gb3B0aW9ucy5zdGF0dXMgOiAyMDBcbiAgICB0aGlzLm9rID0gdGhpcy5zdGF0dXMgPj0gMjAwICYmIHRoaXMuc3RhdHVzIDwgMzAwXG4gICAgdGhpcy5zdGF0dXNUZXh0ID0gJ3N0YXR1c1RleHQnIGluIG9wdGlvbnMgPyBvcHRpb25zLnN0YXR1c1RleHQgOiAnT0snXG4gICAgdGhpcy5oZWFkZXJzID0gbmV3IEhlYWRlcnMob3B0aW9ucy5oZWFkZXJzKVxuICAgIHRoaXMudXJsID0gb3B0aW9ucy51cmwgfHwgJydcbiAgICB0aGlzLl9pbml0Qm9keShib2R5SW5pdClcbiAgfVxuXG4gIEJvZHkuY2FsbChSZXNwb25zZS5wcm90b3R5cGUpXG5cbiAgUmVzcG9uc2UucHJvdG90eXBlLmNsb25lID0gZnVuY3Rpb24oKSB7XG4gICAgcmV0dXJuIG5ldyBSZXNwb25zZSh0aGlzLl9ib2R5SW5pdCwge1xuICAgICAgc3RhdHVzOiB0aGlzLnN0YXR1cyxcbiAgICAgIHN0YXR1c1RleHQ6IHRoaXMuc3RhdHVzVGV4dCxcbiAgICAgIGhlYWRlcnM6IG5ldyBIZWFkZXJzKHRoaXMuaGVhZGVycyksXG4gICAgICB1cmw6IHRoaXMudXJsXG4gICAgfSlcbiAgfVxuXG4gIFJlc3BvbnNlLmVycm9yID0gZnVuY3Rpb24oKSB7XG4gICAgdmFyIHJlc3BvbnNlID0gbmV3IFJlc3BvbnNlKG51bGwsIHtzdGF0dXM6IDAsIHN0YXR1c1RleHQ6ICcnfSlcbiAgICByZXNwb25zZS50eXBlID0gJ2Vycm9yJ1xuICAgIHJldHVybiByZXNwb25zZVxuICB9XG5cbiAgdmFyIHJlZGlyZWN0U3RhdHVzZXMgPSBbMzAxLCAzMDIsIDMwMywgMzA3LCAzMDhdXG5cbiAgUmVzcG9uc2UucmVkaXJlY3QgPSBmdW5jdGlvbih1cmwsIHN0YXR1cykge1xuICAgIGlmIChyZWRpcmVjdFN0YXR1c2VzLmluZGV4T2Yoc3RhdHVzKSA9PT0gLTEpIHtcbiAgICAgIHRocm93IG5ldyBSYW5nZUVycm9yKCdJbnZhbGlkIHN0YXR1cyBjb2RlJylcbiAgICB9XG5cbiAgICByZXR1cm4gbmV3IFJlc3BvbnNlKG51bGwsIHtzdGF0dXM6IHN0YXR1cywgaGVhZGVyczoge2xvY2F0aW9uOiB1cmx9fSlcbiAgfVxuXG4gIHNlbGYuSGVhZGVycyA9IEhlYWRlcnNcbiAgc2VsZi5SZXF1ZXN0ID0gUmVxdWVzdFxuICBzZWxmLlJlc3BvbnNlID0gUmVzcG9uc2VcblxuICBzZWxmLmZldGNoID0gZnVuY3Rpb24oaW5wdXQsIGluaXQpIHtcbiAgICByZXR1cm4gbmV3IFByb21pc2UoZnVuY3Rpb24ocmVzb2x2ZSwgcmVqZWN0KSB7XG4gICAgICB2YXIgcmVxdWVzdCA9IG5ldyBSZXF1ZXN0KGlucHV0LCBpbml0KVxuICAgICAgdmFyIHhociA9IG5ldyBYTUxIdHRwUmVxdWVzdCgpXG5cbiAgICAgIHhoci5vbmxvYWQgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgdmFyIG9wdGlvbnMgPSB7XG4gICAgICAgICAgc3RhdHVzOiB4aHIuc3RhdHVzLFxuICAgICAgICAgIHN0YXR1c1RleHQ6IHhoci5zdGF0dXNUZXh0LFxuICAgICAgICAgIGhlYWRlcnM6IHBhcnNlSGVhZGVycyh4aHIuZ2V0QWxsUmVzcG9uc2VIZWFkZXJzKCkgfHwgJycpXG4gICAgICAgIH1cbiAgICAgICAgb3B0aW9ucy51cmwgPSAncmVzcG9uc2VVUkwnIGluIHhociA/IHhoci5yZXNwb25zZVVSTCA6IG9wdGlvbnMuaGVhZGVycy5nZXQoJ1gtUmVxdWVzdC1VUkwnKVxuICAgICAgICB2YXIgYm9keSA9ICdyZXNwb25zZScgaW4geGhyID8geGhyLnJlc3BvbnNlIDogeGhyLnJlc3BvbnNlVGV4dFxuICAgICAgICByZXNvbHZlKG5ldyBSZXNwb25zZShib2R5LCBvcHRpb25zKSlcbiAgICAgIH1cblxuICAgICAgeGhyLm9uZXJyb3IgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgcmVqZWN0KG5ldyBUeXBlRXJyb3IoJ05ldHdvcmsgcmVxdWVzdCBmYWlsZWQnKSlcbiAgICAgIH1cblxuICAgICAgeGhyLm9udGltZW91dCA9IGZ1bmN0aW9uKCkge1xuICAgICAgICByZWplY3QobmV3IFR5cGVFcnJvcignTmV0d29yayByZXF1ZXN0IGZhaWxlZCcpKVxuICAgICAgfVxuXG4gICAgICB4aHIub3BlbihyZXF1ZXN0Lm1ldGhvZCwgcmVxdWVzdC51cmwsIHRydWUpXG5cbiAgICAgIGlmIChyZXF1ZXN0LmNyZWRlbnRpYWxzID09PSAnaW5jbHVkZScpIHtcbiAgICAgICAgeGhyLndpdGhDcmVkZW50aWFscyA9IHRydWVcbiAgICAgIH1cblxuICAgICAgaWYgKCdyZXNwb25zZVR5cGUnIGluIHhociAmJiBzdXBwb3J0LmJsb2IpIHtcbiAgICAgICAgeGhyLnJlc3BvbnNlVHlwZSA9ICdibG9iJ1xuICAgICAgfVxuXG4gICAgICByZXF1ZXN0LmhlYWRlcnMuZm9yRWFjaChmdW5jdGlvbih2YWx1ZSwgbmFtZSkge1xuICAgICAgICB4aHIuc2V0UmVxdWVzdEhlYWRlcihuYW1lLCB2YWx1ZSlcbiAgICAgIH0pXG5cbiAgICAgIHhoci5zZW5kKHR5cGVvZiByZXF1ZXN0Ll9ib2R5SW5pdCA9PT0gJ3VuZGVmaW5lZCcgPyBudWxsIDogcmVxdWVzdC5fYm9keUluaXQpXG4gICAgfSlcbiAgfVxuICBzZWxmLmZldGNoLnBvbHlmaWxsID0gdHJ1ZVxufSkodHlwZW9mIHNlbGYgIT09ICd1bmRlZmluZWQnID8gc2VsZiA6IHRoaXMpO1xuIiwibW9kdWxlLmV4cG9ydHMgPSBPYmplY3QuZnJlZXplKHtcImJpbGxcIjp7XCJ2b2x1bWVcIjpcImNvZGVWb2x1bWVcIixcInBhZ2VzXCI6XCJjb2RlUGFnZXNcIixcIm51bWJlclwiOlwiYmlsbE51bWJlclwifSxcImNhc2VcIjp7XCJ2b2x1bWVcIjpcInJlcG9ydGVyVm9sdW1lXCIsXCJwYWdlc1wiOlwiZmlyc3RQYWdlXCIsXCJkYXRlXCI6XCJkYXRlRGVjaWRlZFwiLFwibnVtYmVyXCI6XCJkb2NrZXROdW1iZXJcIixcInRpdGxlXCI6XCJjYXNlTmFtZVwifSxcInRoZXNpc1wiOntcInB1Ymxpc2hlclwiOlwidW5pdmVyc2l0eVwiLFwidHlwZVwiOlwidGhlc2lzVHlwZVwifSxcImZpbG1cIjp7XCJwdWJsaXNoZXJcIjpcImRpc3RyaWJ1dG9yXCIsXCJ0eXBlXCI6XCJnZW5yZVwiLFwibWVkaXVtXCI6XCJ2aWRlb1JlY29yZGluZ0Zvcm1hdFwifSxcInJlcG9ydFwiOntcInB1Ymxpc2hlclwiOlwiaW5zdGl0dXRpb25cIixcIm51bWJlclwiOlwicmVwb3J0TnVtYmVyXCIsXCJ0eXBlXCI6XCJyZXBvcnRUeXBlXCJ9LFwiYXVkaW9SZWNvcmRpbmdcIjp7XCJwdWJsaXNoZXJcIjpcImxhYmVsXCIsXCJtZWRpdW1cIjpcImF1ZGlvUmVjb3JkaW5nRm9ybWF0XCJ9LFwidmlkZW9SZWNvcmRpbmdcIjp7XCJwdWJsaXNoZXJcIjpcInN0dWRpb1wiLFwibWVkaXVtXCI6XCJ2aWRlb1JlY29yZGluZ0Zvcm1hdFwifSxcInR2QnJvYWRjYXN0XCI6e1wicHVibGlzaGVyXCI6XCJuZXR3b3JrXCIsXCJwdWJsaWNhdGlvblRpdGxlXCI6XCJwcm9ncmFtVGl0bGVcIixcIm51bWJlclwiOlwiZXBpc29kZU51bWJlclwiLFwibWVkaXVtXCI6XCJ2aWRlb1JlY29yZGluZ0Zvcm1hdFwifSxcInJhZGlvQnJvYWRjYXN0XCI6e1wicHVibGlzaGVyXCI6XCJuZXR3b3JrXCIsXCJwdWJsaWNhdGlvblRpdGxlXCI6XCJwcm9ncmFtVGl0bGVcIixcIm51bWJlclwiOlwiZXBpc29kZU51bWJlclwiLFwibWVkaXVtXCI6XCJhdWRpb1JlY29yZGluZ0Zvcm1hdFwifSxcImNvbXB1dGVyUHJvZ3JhbVwiOntcInB1Ymxpc2hlclwiOlwiY29tcGFueVwifSxcImJvb2tTZWN0aW9uXCI6e1wicHVibGljYXRpb25UaXRsZVwiOlwiYm9va1RpdGxlXCJ9LFwiY29uZmVyZW5jZVBhcGVyXCI6e1wicHVibGljYXRpb25UaXRsZVwiOlwicHJvY2VlZGluZ3NUaXRsZVwifSxcIndlYnBhZ2VcIjp7XCJwdWJsaWNhdGlvblRpdGxlXCI6XCJ3ZWJzaXRlVGl0bGVcIixcInR5cGVcIjpcIndlYnNpdGVUeXBlXCJ9LFwiYmxvZ1Bvc3RcIjp7XCJwdWJsaWNhdGlvblRpdGxlXCI6XCJibG9nVGl0bGVcIixcInR5cGVcIjpcIndlYnNpdGVUeXBlXCJ9LFwiZm9ydW1Qb3N0XCI6e1wicHVibGljYXRpb25UaXRsZVwiOlwiZm9ydW1UaXRsZVwiLFwidHlwZVwiOlwicG9zdFR5cGVcIn0sXCJlbmN5Y2xvcGVkaWFBcnRpY2xlXCI6e1wicHVibGljYXRpb25UaXRsZVwiOlwiZW5jeWNsb3BlZGlhVGl0bGVcIn0sXCJkaWN0aW9uYXJ5RW50cnlcIjp7XCJwdWJsaWNhdGlvblRpdGxlXCI6XCJkaWN0aW9uYXJ5VGl0bGVcIn0sXCJwYXRlbnRcIjp7XCJkYXRlXCI6XCJpc3N1ZURhdGVcIixcIm51bWJlclwiOlwicGF0ZW50TnVtYmVyXCJ9LFwic3RhdHV0ZVwiOntcImRhdGVcIjpcImRhdGVFbmFjdGVkXCIsXCJudW1iZXJcIjpcInB1YmxpY0xhd051bWJlclwiLFwidGl0bGVcIjpcIm5hbWVPZkFjdFwifSxcImhlYXJpbmdcIjp7XCJudW1iZXJcIjpcImRvY3VtZW50TnVtYmVyXCJ9LFwicG9kY2FzdFwiOntcIm51bWJlclwiOlwiZXBpc29kZU51bWJlclwiLFwibWVkaXVtXCI6XCJhdWRpb0ZpbGVUeXBlXCJ9LFwibGV0dGVyXCI6e1widHlwZVwiOlwibGV0dGVyVHlwZVwifSxcIm1hbnVzY3JpcHRcIjp7XCJ0eXBlXCI6XCJtYW51c2NyaXB0VHlwZVwifSxcIm1hcFwiOntcInR5cGVcIjpcIm1hcFR5cGVcIn0sXCJwcmVzZW50YXRpb25cIjp7XCJ0eXBlXCI6XCJwcmVzZW50YXRpb25UeXBlXCJ9LFwiaW50ZXJ2aWV3XCI6e1wibWVkaXVtXCI6XCJpbnRlcnZpZXdNZWRpdW1cIn0sXCJhcnR3b3JrXCI6e1wibWVkaXVtXCI6XCJhcnR3b3JrTWVkaXVtXCJ9LFwiZW1haWxcIjp7XCJ0aXRsZVwiOlwic3ViamVjdFwifX0pOyIsIid1c2Ugc3RyaWN0JztcblxuY29uc3QgdXRpbHMgPSByZXF1aXJlKCcuL3V0aWxzJyk7XG5jb25zdCBkZWZhdWx0cyA9IHJlcXVpcmUoJy4vZGVmYXVsdHMnKTtcbmNvbnN0IGl0ZW1Ub0NTTEpTT04gPSByZXF1aXJlKCcuLi96b3Rlcm8tc2hpbS9pdGVtLXRvLWNzbC1qc29uJyk7XG5jb25zdCBkYXRlVG9TcWwgPSByZXF1aXJlKCcuLi96b3Rlcm8tc2hpbS9kYXRlLXRvLXNxbCcpO1xuY29uc3QgWyBDT01QTEVURSwgTVVMVElQTEVfSVRFTVMsIEZBSUxFRCBdID0gWyAnQ09NUExFVEUnLCAnTVVMVElQTEVfSVRFTVMnLCAnRkFJTEVEJyBdO1xuXG5jbGFzcyBab3Rlcm9CaWIge1xuXHRjb25zdHJ1Y3RvcihvcHRzKSB7XG5cdFx0dGhpcy5vcHRzID0ge1xuXHRcdFx0c2Vzc2lvbmlkOiB1dGlscy51dWlkNCgpLFxuXHRcdFx0Li4uZGVmYXVsdHMoKSxcblx0XHRcdC4uLm9wdHNcblx0XHR9O1xuXG5cdFx0aWYodGhpcy5vcHRzLnBlcnNpc3QgJiYgdGhpcy5vcHRzLnN0b3JhZ2UpIHtcblx0XHRcdGlmKCEoJ2dldEl0ZW0nIGluIHRoaXMub3B0cy5zdG9yYWdlIHx8XG5cdFx0XHRcdCdzZXRJdGVtJyBpbiB0aGlzLm9wdHMuc3RvcmFnZSB8fFxuXHRcdFx0XHQnY2xlYXInIGluIHRoaXMub3B0cy5zdG9yYWdlXG5cdFx0XHQpKSB7XG5cdFx0XHRcdHRocm93IG5ldyBFcnJvcignSW52YWxpZCBzdG9yYWdlIGVuZ2luZSBwcm92aWRlZCcpO1xuXHRcdFx0fVxuXHRcdFx0aWYodGhpcy5vcHRzLm92ZXJyaWRlKSB7XG5cdFx0XHRcdHRoaXMuY2xlYXJJdGVtcygpO1xuXHRcdFx0fVxuXHRcdFx0dGhpcy5pdGVtcyA9IFsuLi50aGlzLm9wdHMuaW5pdGlhbEl0ZW1zLCAuLi50aGlzLmdldEl0ZW1zU3RvcmFnZSgpXTtcblx0XHRcdHRoaXMuc2V0SXRlbXNTdG9yYWdlKHRoaXMuaXRlbXMpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHR0aGlzLml0ZW1zID0gWy4uLnRoaXMub3B0cy5pbml0aWFsSXRlbXNdO1xuXHRcdH1cblx0fVxuXG5cdGdldEl0ZW1zU3RvcmFnZSgpIHtcblx0XHRsZXQgaXRlbXMgPSB0aGlzLm9wdHMuc3RvcmFnZS5nZXRJdGVtKGAke3RoaXMub3B0cy5zdG9yYWdlUHJlZml4fS1pdGVtc2ApO1xuXHRcdHJldHVybiBpdGVtcyA/IEpTT04ucGFyc2UoaXRlbXMpIDogW107XG5cdH1cblxuXHRzZXRJdGVtc1N0b3JhZ2UoaXRlbXMpIHtcblx0XHR0aGlzLm9wdHMuc3RvcmFnZS5zZXRJdGVtKFxuXHRcdFx0YCR7dGhpcy5vcHRzLnN0b3JhZ2VQcmVmaXh9LWl0ZW1zYCxcblx0XHRcdEpTT04uc3RyaW5naWZ5KGl0ZW1zKVxuXHRcdCk7XG5cdH1cblxuXHRyZWxvYWRJdGVtcygpIHtcblx0XHR0aGlzLml0ZW1zID0gdGhpcy5nZXRJdGVtc1N0b3JhZ2UoKTtcblx0fVxuXG5cdGFkZEl0ZW0oaXRlbSkge1xuXHRcdHRoaXMuaXRlbXMucHVzaChpdGVtKTtcblx0XHRpZih0aGlzLm9wdHMucGVyc2lzdCkge1xuXHRcdFx0dGhpcy5zZXRJdGVtc1N0b3JhZ2UodGhpcy5pdGVtcyk7XG5cdFx0fVxuXHR9XG5cblx0dXBkYXRlSXRlbShpbmRleCwgaXRlbSkge1xuXHRcdHRoaXMuaXRlbXNbaW5kZXhdID0gaXRlbTtcblx0XHRpZih0aGlzLm9wdHMucGVyc2lzdCkge1xuXHRcdFx0dGhpcy5zZXRJdGVtc1N0b3JhZ2UodGhpcy5pdGVtcyk7XG5cdFx0fVxuXHR9XG5cblx0cmVtb3ZlSXRlbShpdGVtKSB7XG5cdFx0bGV0IGluZGV4ID0gdGhpcy5pdGVtcy5pbmRleE9mKGl0ZW0pO1xuXHRcdGlmKGluZGV4ICE9PSAtMSkge1xuXHRcdFx0dGhpcy5pdGVtcy5zcGxpY2UoaW5kZXgsIDEpO1xuXHRcdFx0aWYodGhpcy5vcHRzLnBlcnNpc3QpIHtcblx0XHRcdFx0dGhpcy5zZXRJdGVtc1N0b3JhZ2UodGhpcy5pdGVtcyk7XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gaXRlbTtcblx0XHR9XG5cdFx0cmV0dXJuIGZhbHNlO1xuXHR9XG5cblx0Y2xlYXJJdGVtcygpIHtcblx0XHR0aGlzLml0ZW1zID0gW107XG5cdFx0aWYodGhpcy5vcHRzLnBlcnNpc3QpIHtcblx0XHRcdHRoaXMuc2V0SXRlbXNTdG9yYWdlKHRoaXMuaXRlbXMpO1xuXHRcdH1cblx0fVxuXG5cdGdldCBpdGVtc0NTTCgpIHtcblx0XHRyZXR1cm4gdGhpcy5pdGVtcy5tYXAoaSA9PiBpdGVtVG9DU0xKU09OKGkpKVxuXHR9XG5cblx0Z2V0IGl0ZW1zUmF3KCkge1xuXHRcdHJldHVybiB0aGlzLml0ZW1zO1xuXHR9XG5cblx0YXN5bmMgZXhwb3J0SXRlbXMoZm9ybWF0KSB7XG5cdFx0bGV0IHRyYW5zbGF0aW9uU2VydmVyVXJsID0gYCR7dGhpcy5vcHRzLnRyYW5zbGF0aW9uU2VydmVyVXJsfS8ke3RoaXMub3B0cy50cmFuc2xhdGlvblNlcnZlclByZWZpeH1leHBvcnQ/Zm9ybWF0PSR7Zm9ybWF0fWA7XG5cdFx0bGV0IGZldGNoT3B0aW9ucyA9IHtcblx0XHRcdG1ldGhvZDogJ1BPU1QnLFxuXHRcdFx0aGVhZGVyczoge1xuXHRcdFx0XHQnQ29udGVudC1UeXBlJzogJ2FwcGxpY2F0aW9uL2pzb24nXG5cdFx0XHR9LFxuXHRcdFx0Ym9keTogSlNPTi5zdHJpbmdpZnkodGhpcy5pdGVtcy5maWx0ZXIoaSA9PiAna2V5JyBpbiBpICkpLFxuXHRcdFx0Li4udGhpcy5vcHRzLmluaXRcblx0XHR9XG5cdFx0Y29uc3QgcmVzcG9uc2UgPSBhd2FpdCBmZXRjaCh0cmFuc2xhdGlvblNlcnZlclVybCwgZmV0Y2hPcHRpb25zKTtcblx0XHRpZihyZXNwb25zZS5vaykge1xuXHRcdFx0cmV0dXJuIGF3YWl0IHJlc3BvbnNlLnRleHQoKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKCdGYWlsZWQgdG8gZXhwb3J0IGl0ZW1zJyk7XG5cdFx0fVxuXHR9XG5cblx0YXN5bmMgdHJhbnNsYXRlSWRlbnRpZmllcihpZGVudGlmaWVyLCAuLi5hcmdzKSB7XG5cdFx0bGV0IHRyYW5zbGF0aW9uU2VydmVyVXJsID0gYCR7dGhpcy5vcHRzLnRyYW5zbGF0aW9uU2VydmVyVXJsfS8ke3RoaXMub3B0cy50cmFuc2xhdGlvblNlcnZlclByZWZpeH1zZWFyY2hgO1xuXHRcdGxldCBpbml0ID0ge1xuXHRcdFx0bWV0aG9kOiAnUE9TVCcsXG5cdFx0XHRoZWFkZXJzOiB7XG5cdFx0XHRcdCdDb250ZW50LVR5cGUnOiAndGV4dC9wbGFpbidcblx0XHRcdH0sXG5cdFx0XHRib2R5OiBpZGVudGlmaWVyLFxuXHRcdFx0Li4udGhpcy5vcHRzLmluaXRcblx0XHR9O1xuXG5cdFx0cmV0dXJuIGF3YWl0IHRoaXMudHJhbnNsYXRlKHRyYW5zbGF0aW9uU2VydmVyVXJsLCBpbml0LCAuLi5hcmdzKTtcblx0fVxuXG5cdGFzeW5jIHRyYW5zbGF0ZVVybEl0ZW1zKHVybCwgaXRlbXMsIC4uLmFyZ3MpIHtcblx0XHRsZXQgdHJhbnNsYXRpb25TZXJ2ZXJVcmwgPSBgJHt0aGlzLm9wdHMudHJhbnNsYXRpb25TZXJ2ZXJVcmx9LyR7dGhpcy5vcHRzLnRyYW5zbGF0aW9uU2VydmVyUHJlZml4fXdlYmA7XG5cdFx0bGV0IHNlc3Npb25pZCA9IHRoaXMub3B0cy5zZXNzaW9uaWQ7XG5cdFx0bGV0IGRhdGEgPSB7IHVybCwgaXRlbXMsIHNlc3Npb25pZCwgLi4udGhpcy5vcHRzLnJlcXVlc3QgfTtcblxuXHRcdGxldCBpbml0ID0ge1xuXHRcdFx0bWV0aG9kOiAnUE9TVCcsXG5cdFx0XHRoZWFkZXJzOiB7XG5cdFx0XHRcdCdDb250ZW50LVR5cGUnOiAnYXBwbGljYXRpb24vanNvbidcblx0XHRcdH0sXG5cdFx0XHRib2R5OiBKU09OLnN0cmluZ2lmeShkYXRhKSxcblx0XHRcdC4uLnRoaXMub3B0cy5pbml0XG5cdFx0fTtcblxuXHRcdHJldHVybiBhd2FpdCB0aGlzLnRyYW5zbGF0ZSh0cmFuc2xhdGlvblNlcnZlclVybCwgaW5pdCwgLi4uYXJncyk7XG5cdH1cblxuXHRhc3luYyB0cmFuc2xhdGVVcmwodXJsLCAuLi5hcmdzKSB7XG5cdFx0bGV0IHRyYW5zbGF0aW9uU2VydmVyVXJsID0gYCR7dGhpcy5vcHRzLnRyYW5zbGF0aW9uU2VydmVyVXJsfS8ke3RoaXMub3B0cy50cmFuc2xhdGlvblNlcnZlclByZWZpeH13ZWJgO1xuXHRcdGxldCBzZXNzaW9uaWQgPSB0aGlzLm9wdHMuc2Vzc2lvbmlkO1xuXHRcdGxldCBkYXRhID0geyB1cmwsIHNlc3Npb25pZCwgLi4udGhpcy5vcHRzLnJlcXVlc3QgfTtcblxuXHRcdGxldCBpbml0ID0ge1xuXHRcdFx0bWV0aG9kOiAnUE9TVCcsXG5cdFx0XHRoZWFkZXJzOiB7XG5cdFx0XHRcdCdDb250ZW50LVR5cGUnOiAnYXBwbGljYXRpb24vanNvbidcblx0XHRcdH0sXG5cdFx0XHRib2R5OiBKU09OLnN0cmluZ2lmeShkYXRhKSxcblx0XHRcdC4uLnRoaXMub3B0cy5pbml0XG5cdFx0fTtcblxuXHRcdHJldHVybiBhd2FpdCB0aGlzLnRyYW5zbGF0ZSh0cmFuc2xhdGlvblNlcnZlclVybCwgaW5pdCwgLi4uYXJncyk7XG5cdH1cblxuXHRhc3luYyB0cmFuc2xhdGUodXJsLCBmZXRjaE9wdGlvbnMsIGFkZD10cnVlKSB7XG5cdFx0Y29uc3QgcmVzcG9uc2UgPSBhd2FpdCBmZXRjaCh1cmwsIGZldGNoT3B0aW9ucyk7XG5cdFx0dmFyIGl0ZW1zLCByZXN1bHQ7XG5cblx0XHRpZihyZXNwb25zZS5vaykge1xuXHRcdFx0aXRlbXMgPSBhd2FpdCByZXNwb25zZS5qc29uKCk7XG5cdFx0XHRpZihBcnJheS5pc0FycmF5KGl0ZW1zKSkge1xuXHRcdFx0XHRpdGVtcy5mb3JFYWNoKGl0ZW0gPT4ge1xuXHRcdFx0XHRcdGlmKGl0ZW0uYWNjZXNzRGF0ZSA9PT0gJ0NVUlJFTlRfVElNRVNUQU1QJykge1xuXHRcdFx0XHRcdFx0Y29uc3QgZHQgPSBuZXcgRGF0ZShEYXRlLm5vdygpKTtcblx0XHRcdFx0XHRcdGl0ZW0uYWNjZXNzRGF0ZSA9IGRhdGVUb1NxbChkdCwgdHJ1ZSk7XG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0aWYoYWRkKSB7XG5cdFx0XHRcdFx0XHR0aGlzLmFkZEl0ZW0oaXRlbSk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9KTtcblx0XHRcdH1cblx0XHRcdHJlc3VsdCA9IEFycmF5LmlzQXJyYXkoaXRlbXMpID8gQ09NUExFVEUgOiBGQUlMRUQ7XG5cdFx0fSBlbHNlIGlmKHJlc3BvbnNlLnN0YXR1cyA9PT0gMzAwKSB7XG5cdFx0XHRpdGVtcyA9IGF3YWl0IHJlc3BvbnNlLmpzb24oKTtcblx0XHRcdHJlc3VsdCA9IE1VTFRJUExFX0lURU1TO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRyZXN1bHQgPSBGQUlMRURcblx0XHR9XG5cblx0XHRyZXR1cm4geyByZXN1bHQsIGl0ZW1zLCByZXNwb25zZSB9O1xuXHR9XG5cblx0c3RhdGljIGdldCBDT01QTEVURSgpIHsgcmV0dXJuIENPTVBMRVRFIH1cblx0c3RhdGljIGdldCBNVUxUSVBMRV9JVEVNUygpIHsgcmV0dXJuIE1VTFRJUExFX0lURU1TIH1cblx0c3RhdGljIGdldCBGQUlMRUQoKSB7IHJldHVybiBGQUlMRUQgfVxufVxuXG5tb2R1bGUuZXhwb3J0cyA9IFpvdGVyb0JpYjtcbiIsIid1c2Ugc3RyaWN0JztcblxubW9kdWxlLmV4cG9ydHMgPSAoKSA9PiAoe1xuXHR0cmFuc2xhdGlvblNlcnZlclVybDogdHlwZW9mIHdpbmRvdyAhPSAndW5kZWZpbmVkJyAmJiB3aW5kb3cubG9jYXRpb24ub3JpZ2luIHx8ICcnLFxuXHR0cmFuc2xhdGlvblNlcnZlclByZWZpeDogJycsXG5cdGZldGNoQ29uZmlnOiB7fSxcblx0aW5pdGlhbEl0ZW1zOiBbXSxcblx0cmVxdWVzdDoge30sXG5cdHN0b3JhZ2U6IHR5cGVvZiB3aW5kb3cgIT0gJ3VuZGVmaW5lZCcgJiYgJ2xvY2FsU3RvcmFnZScgaW4gd2luZG93ICYmIHdpbmRvdy5sb2NhbFN0b3JhZ2UgfHwge30sXG5cdHBlcnNpc3Q6IHRydWUsXG5cdG92ZXJyaWRlOiBmYWxzZSxcblx0c3RvcmFnZVByZWZpeDogJ3pvdGVyby1iaWInXG59KTtcbiIsIid1c2Ugc3RyaWN0JztcblxubW9kdWxlLmV4cG9ydHMgPSB7XG5cdHV1aWQ0OiAoKSA9PiAneHh4eHh4eHgteHh4eC00eHh4LXl4eHgteHh4eHh4eHh4eHh4Jy5yZXBsYWNlKC9beHldL2csIGMgPT4ge1xuXHRcdFx0dmFyIHIgPSBNYXRoLnJhbmRvbSgpICogMTZ8MCxcblx0XHRcdFx0diA9IGMgPT0gJ3gnID8gciA6IChyJjB4M3wweDgpO1xuXG5cdFx0XHRyZXR1cm4gdi50b1N0cmluZygxNik7XG5cdFx0fSlcbn1cbiIsIid1c2Ugc3RyaWN0JztcblxucmVxdWlyZSgnZXM2LXByb21pc2UvYXV0bycpO1xucmVxdWlyZSgnaXNvbW9ycGhpYy1mZXRjaCcpO1xucmVxdWlyZSgnYmFiZWwtcmVnZW5lcmF0b3ItcnVudGltZScpO1xuY29uc3QgWm90ZXJvQmliID0gcmVxdWlyZSgnLi9iaWIvYmliJyk7XG5cbm1vZHVsZS5leHBvcnRzID0gWm90ZXJvQmliO1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG5jb25zdCBjcmVhdG9yVHlwZXMgPSB7XG5cdDE6ICdhdXRob3InLFxuXHQyOiAnY29udHJpYnV0b3InLFxuXHQzOiAnZWRpdG9yJyxcblx0NDogJ3RyYW5zbGF0b3InLFxuXHQ1OiAnc2VyaWVzRWRpdG9yJyxcblx0NjogJ2ludGVydmlld2VlJyxcblx0NzogJ2ludGVydmlld2VyJyxcblx0ODogJ2RpcmVjdG9yJyxcblx0OTogJ3NjcmlwdHdyaXRlcicsXG5cdDEwOiAncHJvZHVjZXInLFxuXHQxMTogJ2Nhc3RNZW1iZXInLFxuXHQxMjogJ3Nwb25zb3InLFxuXHQxMzogJ2NvdW5zZWwnLFxuXHQxNDogJ2ludmVudG9yJyxcblx0MTU6ICdhdHRvcm5leUFnZW50Jyxcblx0MTY6ICdyZWNpcGllbnQnLFxuXHQxNzogJ3BlcmZvcm1lcicsXG5cdDE4OiAnY29tcG9zZXInLFxuXHQxOTogJ3dvcmRzQnknLFxuXHQyMDogJ2NhcnRvZ3JhcGhlcicsXG5cdDIxOiAncHJvZ3JhbW1lcicsXG5cdDIyOiAnYXJ0aXN0Jyxcblx0MjM6ICdjb21tZW50ZXInLFxuXHQyNDogJ3ByZXNlbnRlcicsXG5cdDI1OiAnZ3Vlc3QnLFxuXHQyNjogJ3BvZGNhc3RlcicsXG5cdDI3OiAncmV2aWV3ZWRBdXRob3InLFxuXHQyODogJ2Nvc3BvbnNvcicsXG5cdDI5OiAnYm9va0F1dGhvcidcbn07XG5cblxuLy9yZXZlcnNlIGxvb2t1cFxuT2JqZWN0LmtleXMoY3JlYXRvclR5cGVzKS5tYXAoayA9PiBjcmVhdG9yVHlwZXNbY3JlYXRvclR5cGVzW2tdXSA9IGspO1xubW9kdWxlLmV4cG9ydHMgPSBjcmVhdG9yVHlwZXM7XG4iLCJtb2R1bGUuZXhwb3J0cyA9IHtcblx0Q1NMX05BTUVTX01BUFBJTkdTOiB7XG5cdFx0J2F1dGhvcic6J2F1dGhvcicsXG5cdFx0J2VkaXRvcic6J2VkaXRvcicsXG5cdFx0J2Jvb2tBdXRob3InOidjb250YWluZXItYXV0aG9yJyxcblx0XHQnY29tcG9zZXInOidjb21wb3NlcicsXG5cdFx0J2RpcmVjdG9yJzonZGlyZWN0b3InLFxuXHRcdCdpbnRlcnZpZXdlcic6J2ludGVydmlld2VyJyxcblx0XHQncmVjaXBpZW50JzoncmVjaXBpZW50Jyxcblx0XHQncmV2aWV3ZWRBdXRob3InOidyZXZpZXdlZC1hdXRob3InLFxuXHRcdCdzZXJpZXNFZGl0b3InOidjb2xsZWN0aW9uLWVkaXRvcicsXG5cdFx0J3RyYW5zbGF0b3InOid0cmFuc2xhdG9yJ1xuXHR9LFxuXG5cdC8qXG5cdCAqIE1hcHBpbmdzIGZvciB0ZXh0IHZhcmlhYmxlc1xuXHQgKi9cblx0Q1NMX1RFWFRfTUFQUElOR1M6IHtcblx0XHQndGl0bGUnOlsndGl0bGUnXSxcblx0XHQnY29udGFpbmVyLXRpdGxlJzpbJ3B1YmxpY2F0aW9uVGl0bGUnLCAgJ3JlcG9ydGVyJywgJ2NvZGUnXSwgLyogcmVwb3J0ZXIgYW5kIGNvZGUgc2hvdWxkIG1vdmUgdG8gU1FMIG1hcHBpbmcgdGFibGVzICovXG5cdFx0J2NvbGxlY3Rpb24tdGl0bGUnOlsnc2VyaWVzVGl0bGUnLCAnc2VyaWVzJ10sXG5cdFx0J2NvbGxlY3Rpb24tbnVtYmVyJzpbJ3Nlcmllc051bWJlciddLFxuXHRcdCdwdWJsaXNoZXInOlsncHVibGlzaGVyJywgJ2Rpc3RyaWJ1dG9yJ10sIC8qIGRpc3RyaWJ1dG9yIHNob3VsZCBtb3ZlIHRvIFNRTCBtYXBwaW5nIHRhYmxlcyAqL1xuXHRcdCdwdWJsaXNoZXItcGxhY2UnOlsncGxhY2UnXSxcblx0XHQnYXV0aG9yaXR5JzpbJ2NvdXJ0JywnbGVnaXNsYXRpdmVCb2R5JywgJ2lzc3VpbmdBdXRob3JpdHknXSxcblx0XHQncGFnZSc6WydwYWdlcyddLFxuXHRcdCd2b2x1bWUnOlsndm9sdW1lJywgJ2NvZGVOdW1iZXInXSxcblx0XHQnaXNzdWUnOlsnaXNzdWUnLCAncHJpb3JpdHlOdW1iZXJzJ10sXG5cdFx0J251bWJlci1vZi12b2x1bWVzJzpbJ251bWJlck9mVm9sdW1lcyddLFxuXHRcdCdudW1iZXItb2YtcGFnZXMnOlsnbnVtUGFnZXMnXSxcblx0XHQnZWRpdGlvbic6WydlZGl0aW9uJ10sXG5cdFx0J3ZlcnNpb24nOlsndmVyc2lvbk51bWJlciddLFxuXHRcdCdzZWN0aW9uJzpbJ3NlY3Rpb24nLCAnY29tbWl0dGVlJ10sXG5cdFx0J2dlbnJlJzpbJ3R5cGUnLCAncHJvZ3JhbW1pbmdMYW5ndWFnZSddLFxuXHRcdCdzb3VyY2UnOlsnbGlicmFyeUNhdGFsb2cnXSxcblx0XHQnZGltZW5zaW9ucyc6IFsnYXJ0d29ya1NpemUnLCAncnVubmluZ1RpbWUnXSxcblx0XHQnbWVkaXVtJzpbJ21lZGl1bScsICdzeXN0ZW0nXSxcblx0XHQnc2NhbGUnOlsnc2NhbGUnXSxcblx0XHQnYXJjaGl2ZSc6WydhcmNoaXZlJ10sXG5cdFx0J2FyY2hpdmVfbG9jYXRpb24nOlsnYXJjaGl2ZUxvY2F0aW9uJ10sXG5cdFx0J2V2ZW50JzpbJ21lZXRpbmdOYW1lJywgJ2NvbmZlcmVuY2VOYW1lJ10sIC8qIHRoZXNlIHNob3VsZCBiZSBtYXBwZWQgdG8gdGhlIHNhbWUgYmFzZSBmaWVsZCBpbiBTUUwgbWFwcGluZyB0YWJsZXMgKi9cblx0XHQnZXZlbnQtcGxhY2UnOlsncGxhY2UnXSxcblx0XHQnYWJzdHJhY3QnOlsnYWJzdHJhY3ROb3RlJ10sXG5cdFx0J1VSTCc6Wyd1cmwnXSxcblx0XHQnRE9JJzpbJ0RPSSddLFxuXHRcdCdJU0JOJzpbJ0lTQk4nXSxcblx0XHQnSVNTTic6WydJU1NOJ10sXG5cdFx0J2NhbGwtbnVtYmVyJzpbJ2NhbGxOdW1iZXInLCAnYXBwbGljYXRpb25OdW1iZXInXSxcblx0XHQnbm90ZSc6WydleHRyYSddLFxuXHRcdCdudW1iZXInOlsnbnVtYmVyJ10sXG5cdFx0J2NoYXB0ZXItbnVtYmVyJzpbJ3Nlc3Npb24nXSxcblx0XHQncmVmZXJlbmNlcyc6WydoaXN0b3J5JywgJ3JlZmVyZW5jZXMnXSxcblx0XHQnc2hvcnRUaXRsZSc6WydzaG9ydFRpdGxlJ10sXG5cdFx0J2pvdXJuYWxBYmJyZXZpYXRpb24nOlsnam91cm5hbEFiYnJldmlhdGlvbiddLFxuXHRcdCdzdGF0dXMnOlsnbGVnYWxTdGF0dXMnXSxcblx0XHQnbGFuZ3VhZ2UnOlsnbGFuZ3VhZ2UnXVxuXHR9LFxuXHRDU0xfREFURV9NQVBQSU5HUzoge1xuXHRcdCdpc3N1ZWQnOidkYXRlJyxcblx0XHQnYWNjZXNzZWQnOidhY2Nlc3NEYXRlJyxcblx0XHQnc3VibWl0dGVkJzonZmlsaW5nRGF0ZSdcblx0fSxcblx0Q1NMX1RZUEVfTUFQUElOR1M6IHtcblx0XHQnYm9vayc6J2Jvb2snLFxuXHRcdCdib29rU2VjdGlvbic6J2NoYXB0ZXInLFxuXHRcdCdqb3VybmFsQXJ0aWNsZSc6J2FydGljbGUtam91cm5hbCcsXG5cdFx0J21hZ2F6aW5lQXJ0aWNsZSc6J2FydGljbGUtbWFnYXppbmUnLFxuXHRcdCduZXdzcGFwZXJBcnRpY2xlJzonYXJ0aWNsZS1uZXdzcGFwZXInLFxuXHRcdCd0aGVzaXMnOid0aGVzaXMnLFxuXHRcdCdlbmN5Y2xvcGVkaWFBcnRpY2xlJzonZW50cnktZW5jeWNsb3BlZGlhJyxcblx0XHQnZGljdGlvbmFyeUVudHJ5JzonZW50cnktZGljdGlvbmFyeScsXG5cdFx0J2NvbmZlcmVuY2VQYXBlcic6J3BhcGVyLWNvbmZlcmVuY2UnLFxuXHRcdCdsZXR0ZXInOidwZXJzb25hbF9jb21tdW5pY2F0aW9uJyxcblx0XHQnbWFudXNjcmlwdCc6J21hbnVzY3JpcHQnLFxuXHRcdCdpbnRlcnZpZXcnOidpbnRlcnZpZXcnLFxuXHRcdCdmaWxtJzonbW90aW9uX3BpY3R1cmUnLFxuXHRcdCdhcnR3b3JrJzonZ3JhcGhpYycsXG5cdFx0J3dlYnBhZ2UnOid3ZWJwYWdlJyxcblx0XHQncmVwb3J0JzoncmVwb3J0Jyxcblx0XHQnYmlsbCc6J2JpbGwnLFxuXHRcdCdjYXNlJzonbGVnYWxfY2FzZScsXG5cdFx0J2hlYXJpbmcnOidiaWxsJyxcdFx0XHRcdC8vID8/XG5cdFx0J3BhdGVudCc6J3BhdGVudCcsXG5cdFx0J3N0YXR1dGUnOidsZWdpc2xhdGlvbicsXHRcdC8vID8/XG5cdFx0J2VtYWlsJzoncGVyc29uYWxfY29tbXVuaWNhdGlvbicsXG5cdFx0J21hcCc6J21hcCcsXG5cdFx0J2Jsb2dQb3N0JzoncG9zdC13ZWJsb2cnLFxuXHRcdCdpbnN0YW50TWVzc2FnZSc6J3BlcnNvbmFsX2NvbW11bmljYXRpb24nLFxuXHRcdCdmb3J1bVBvc3QnOidwb3N0Jyxcblx0XHQnYXVkaW9SZWNvcmRpbmcnOidzb25nJyxcdFx0Ly8gPz9cblx0XHQncHJlc2VudGF0aW9uJzonc3BlZWNoJyxcblx0XHQndmlkZW9SZWNvcmRpbmcnOidtb3Rpb25fcGljdHVyZScsXG5cdFx0J3R2QnJvYWRjYXN0JzonYnJvYWRjYXN0Jyxcblx0XHQncmFkaW9Ccm9hZGNhc3QnOidicm9hZGNhc3QnLFxuXHRcdCdwb2RjYXN0Jzonc29uZycsXHRcdFx0Ly8gPz9cblx0XHQnY29tcHV0ZXJQcm9ncmFtJzonYm9vaycsXHRcdC8vID8/XG5cdFx0J2RvY3VtZW50JzonYXJ0aWNsZScsXG5cdFx0J25vdGUnOidhcnRpY2xlJyxcblx0XHQnYXR0YWNobWVudCc6J2FydGljbGUnXG5cdH1cbn07XG4iLCJjb25zdCBscGFkID0gcmVxdWlyZSgnLi9scGFkJyk7XG5cbm1vZHVsZS5leHBvcnRzID0gKGRhdGUsIHRvVVRDKSA9PiB7XG5cdHZhciB5ZWFyLCBtb250aCwgZGF5LCBob3VycywgbWludXRlcywgc2Vjb25kcztcblx0dHJ5IHtcblx0XHRpZih0b1VUQykge1xuXHRcdFx0eWVhciA9IGRhdGUuZ2V0VVRDRnVsbFllYXIoKTtcblx0XHRcdG1vbnRoID0gZGF0ZS5nZXRVVENNb250aCgpO1xuXHRcdFx0ZGF5ID0gZGF0ZS5nZXRVVENEYXRlKCk7XG5cdFx0XHRob3VycyA9IGRhdGUuZ2V0VVRDSG91cnMoKTtcblx0XHRcdG1pbnV0ZXMgPSBkYXRlLmdldFVUQ01pbnV0ZXMoKTtcblx0XHRcdHNlY29uZHMgPSBkYXRlLmdldFVUQ1NlY29uZHMoKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0eWVhciA9IGRhdGUuZ2V0RnVsbFllYXIoKTtcblx0XHRcdG1vbnRoID0gZGF0ZS5nZXRNb250aCgpO1xuXHRcdFx0ZGF5ID0gZGF0ZS5nZXREYXRlKCk7XG5cdFx0XHRob3VycyA9IGRhdGUuZ2V0SG91cnMoKTtcblx0XHRcdG1pbnV0ZXMgPSBkYXRlLmdldE1pbnV0ZXMoKTtcblx0XHRcdHNlY29uZHMgPSBkYXRlLmdldFNlY29uZHMoKTtcblx0XHR9XG5cblx0XHR5ZWFyID0gbHBhZCh5ZWFyLCAnMCcsIDQpO1xuXHRcdG1vbnRoID0gbHBhZChtb250aCArIDEsICcwJywgMik7XG5cdFx0ZGF5ID0gbHBhZChkYXksICcwJywgMik7XG5cdFx0aG91cnMgPSBscGFkKGhvdXJzLCAnMCcsIDIpO1xuXHRcdG1pbnV0ZXMgPSBscGFkKG1pbnV0ZXMsICcwJywgMik7XG5cdFx0c2Vjb25kcyA9IGxwYWQoc2Vjb25kcywgJzAnLCAyKTtcblxuXHRcdHJldHVybiB5ZWFyICsgJy0nICsgbW9udGggKyAnLScgKyBkYXkgKyAnICdcblx0XHRcdCsgaG91cnMgKyAnOicgKyBtaW51dGVzICsgJzonICsgc2Vjb25kcztcblx0fVxuXHRjYXRjaCAoZSkge1xuXHRcdHJldHVybiAnJztcblx0fVxufVxuIiwiY29uc3QgaXRlbVR5cGVzID0gcmVxdWlyZSgnLi9pdGVtLXR5cGVzJyk7XG5jb25zdCBjcmVhdG9yVHlwZXMgPSByZXF1aXJlKCcuL2NyZWF0b3ItdHlwZXMnKTtcblxubW9kdWxlLmV4cG9ydHMgPSB7XG5cdFtpdGVtVHlwZXNbMl1dOiBjcmVhdG9yVHlwZXNbMV0sXG5cdFtpdGVtVHlwZXNbM11dOiBjcmVhdG9yVHlwZXNbMV0sXG5cdFtpdGVtVHlwZXNbNF1dOiBjcmVhdG9yVHlwZXNbMV0sXG5cdFtpdGVtVHlwZXNbNV1dOiBjcmVhdG9yVHlwZXNbMV0sXG5cdFtpdGVtVHlwZXNbNl1dOiBjcmVhdG9yVHlwZXNbMV0sXG5cdFtpdGVtVHlwZXNbN11dOiBjcmVhdG9yVHlwZXNbMV0sXG5cdFtpdGVtVHlwZXNbOF1dOiBjcmVhdG9yVHlwZXNbMV0sXG5cdFtpdGVtVHlwZXNbOV1dOiBjcmVhdG9yVHlwZXNbMV0sXG5cdFtpdGVtVHlwZXNbMTBdXTogY3JlYXRvclR5cGVzWzZdLFxuXHRbaXRlbVR5cGVzWzExXV06IGNyZWF0b3JUeXBlc1s4XSxcblx0W2l0ZW1UeXBlc1sxMl1dOiBjcmVhdG9yVHlwZXNbMjJdLFxuXHRbaXRlbVR5cGVzWzEzXV06IGNyZWF0b3JUeXBlc1sxXSxcblx0W2l0ZW1UeXBlc1sxNV1dOiBjcmVhdG9yVHlwZXNbMV0sXG5cdFtpdGVtVHlwZXNbMTZdXTogY3JlYXRvclR5cGVzWzEyXSxcblx0W2l0ZW1UeXBlc1sxN11dOiBjcmVhdG9yVHlwZXNbMV0sXG5cdFtpdGVtVHlwZXNbMThdXTogY3JlYXRvclR5cGVzWzJdLFxuXHRbaXRlbVR5cGVzWzE5XV06IGNyZWF0b3JUeXBlc1sxNF0sXG5cdFtpdGVtVHlwZXNbMjBdXTogY3JlYXRvclR5cGVzWzFdLFxuXHRbaXRlbVR5cGVzWzIxXV06IGNyZWF0b3JUeXBlc1sxXSxcblx0W2l0ZW1UeXBlc1syMl1dOiBjcmVhdG9yVHlwZXNbMjBdLFxuXHRbaXRlbVR5cGVzWzIzXV06IGNyZWF0b3JUeXBlc1sxXSxcblx0W2l0ZW1UeXBlc1syNF1dOiBjcmVhdG9yVHlwZXNbMV0sXG5cdFtpdGVtVHlwZXNbMjVdXTogY3JlYXRvclR5cGVzWzFdLFxuXHRbaXRlbVR5cGVzWzI2XV06IGNyZWF0b3JUeXBlc1sxN10sXG5cdFtpdGVtVHlwZXNbMjddXTogY3JlYXRvclR5cGVzWzI0XSxcblx0W2l0ZW1UeXBlc1syOF1dOiBjcmVhdG9yVHlwZXNbOF0sXG5cdFtpdGVtVHlwZXNbMjldXTogY3JlYXRvclR5cGVzWzhdLFxuXHRbaXRlbVR5cGVzWzMwXV06IGNyZWF0b3JUeXBlc1s4XSxcblx0W2l0ZW1UeXBlc1szMV1dOiBjcmVhdG9yVHlwZXNbMjZdLFxuXHRbaXRlbVR5cGVzWzMyXV06IGNyZWF0b3JUeXBlc1syMV0sXG5cdFtpdGVtVHlwZXNbMzNdXTogY3JlYXRvclR5cGVzWzFdLFxuXHRbaXRlbVR5cGVzWzM0XV06IGNyZWF0b3JUeXBlc1sxXSxcblx0W2l0ZW1UeXBlc1szNV1dOiBjcmVhdG9yVHlwZXNbMV0sXG5cdFtpdGVtVHlwZXNbMzZdXTogY3JlYXRvclR5cGVzWzFdXG59O1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG5jb25zdCBmaWVsZHMgPSB7XG5cdDE6ICd1cmwnLFxuXHQyOiAncmlnaHRzJyxcblx0MzogJ3NlcmllcycsXG5cdDQ6ICd2b2x1bWUnLFxuXHQ1OiAnaXNzdWUnLFxuXHQ2OiAnZWRpdGlvbicsXG5cdDc6ICdwbGFjZScsXG5cdDg6ICdwdWJsaXNoZXInLFxuXHQxMDogJ3BhZ2VzJyxcblx0MTE6ICdJU0JOJyxcblx0MTI6ICdwdWJsaWNhdGlvblRpdGxlJyxcblx0MTM6ICdJU1NOJyxcblx0MTQ6ICdkYXRlJyxcblx0MTU6ICdzZWN0aW9uJyxcblx0MTg6ICdjYWxsTnVtYmVyJyxcblx0MTk6ICdhcmNoaXZlTG9jYXRpb24nLFxuXHQyMTogJ2Rpc3RyaWJ1dG9yJyxcblx0MjI6ICdleHRyYScsXG5cdDI1OiAnam91cm5hbEFiYnJldmlhdGlvbicsXG5cdDI2OiAnRE9JJyxcblx0Mjc6ICdhY2Nlc3NEYXRlJyxcblx0Mjg6ICdzZXJpZXNUaXRsZScsXG5cdDI5OiAnc2VyaWVzVGV4dCcsXG5cdDMwOiAnc2VyaWVzTnVtYmVyJyxcblx0MzE6ICdpbnN0aXR1dGlvbicsXG5cdDMyOiAncmVwb3J0VHlwZScsXG5cdDM2OiAnY29kZScsXG5cdDQwOiAnc2Vzc2lvbicsXG5cdDQxOiAnbGVnaXNsYXRpdmVCb2R5Jyxcblx0NDI6ICdoaXN0b3J5Jyxcblx0NDM6ICdyZXBvcnRlcicsXG5cdDQ0OiAnY291cnQnLFxuXHQ0NTogJ251bWJlck9mVm9sdW1lcycsXG5cdDQ2OiAnY29tbWl0dGVlJyxcblx0NDg6ICdhc3NpZ25lZScsXG5cdDUwOiAncGF0ZW50TnVtYmVyJyxcblx0NTE6ICdwcmlvcml0eU51bWJlcnMnLFxuXHQ1MjogJ2lzc3VlRGF0ZScsXG5cdDUzOiAncmVmZXJlbmNlcycsXG5cdDU0OiAnbGVnYWxTdGF0dXMnLFxuXHQ1NTogJ2NvZGVOdW1iZXInLFxuXHQ1OTogJ2FydHdvcmtNZWRpdW0nLFxuXHQ2MDogJ251bWJlcicsXG5cdDYxOiAnYXJ0d29ya1NpemUnLFxuXHQ2MjogJ2xpYnJhcnlDYXRhbG9nJyxcblx0NjM6ICd2aWRlb1JlY29yZGluZ0Zvcm1hdCcsXG5cdDY0OiAnaW50ZXJ2aWV3TWVkaXVtJyxcblx0NjU6ICdsZXR0ZXJUeXBlJyxcblx0NjY6ICdtYW51c2NyaXB0VHlwZScsXG5cdDY3OiAnbWFwVHlwZScsXG5cdDY4OiAnc2NhbGUnLFxuXHQ2OTogJ3RoZXNpc1R5cGUnLFxuXHQ3MDogJ3dlYnNpdGVUeXBlJyxcblx0NzE6ICdhdWRpb1JlY29yZGluZ0Zvcm1hdCcsXG5cdDcyOiAnbGFiZWwnLFxuXHQ3NDogJ3ByZXNlbnRhdGlvblR5cGUnLFxuXHQ3NTogJ21lZXRpbmdOYW1lJyxcblx0NzY6ICdzdHVkaW8nLFxuXHQ3NzogJ3J1bm5pbmdUaW1lJyxcblx0Nzg6ICduZXR3b3JrJyxcblx0Nzk6ICdwb3N0VHlwZScsXG5cdDgwOiAnYXVkaW9GaWxlVHlwZScsXG5cdDgxOiAndmVyc2lvbk51bWJlcicsXG5cdDgyOiAnc3lzdGVtJyxcblx0ODM6ICdjb21wYW55Jyxcblx0ODQ6ICdjb25mZXJlbmNlTmFtZScsXG5cdDg1OiAnZW5jeWNsb3BlZGlhVGl0bGUnLFxuXHQ4NjogJ2RpY3Rpb25hcnlUaXRsZScsXG5cdDg3OiAnbGFuZ3VhZ2UnLFxuXHQ4ODogJ3Byb2dyYW1taW5nTGFuZ3VhZ2UnLFxuXHQ4OTogJ3VuaXZlcnNpdHknLFxuXHQ5MDogJ2Fic3RyYWN0Tm90ZScsXG5cdDkxOiAnd2Vic2l0ZVRpdGxlJyxcblx0OTI6ICdyZXBvcnROdW1iZXInLFxuXHQ5MzogJ2JpbGxOdW1iZXInLFxuXHQ5NDogJ2NvZGVWb2x1bWUnLFxuXHQ5NTogJ2NvZGVQYWdlcycsXG5cdDk2OiAnZGF0ZURlY2lkZWQnLFxuXHQ5NzogJ3JlcG9ydGVyVm9sdW1lJyxcblx0OTg6ICdmaXJzdFBhZ2UnLFxuXHQ5OTogJ2RvY3VtZW50TnVtYmVyJyxcblx0MTAwOiAnZGF0ZUVuYWN0ZWQnLFxuXHQxMDE6ICdwdWJsaWNMYXdOdW1iZXInLFxuXHQxMDI6ICdjb3VudHJ5Jyxcblx0MTAzOiAnYXBwbGljYXRpb25OdW1iZXInLFxuXHQxMDQ6ICdmb3J1bVRpdGxlJyxcblx0MTA1OiAnZXBpc29kZU51bWJlcicsXG5cdDEwNzogJ2Jsb2dUaXRsZScsXG5cdDEwODogJ3R5cGUnLFxuXHQxMDk6ICdtZWRpdW0nLFxuXHQxMTA6ICd0aXRsZScsXG5cdDExMTogJ2Nhc2VOYW1lJyxcblx0MTEyOiAnbmFtZU9mQWN0Jyxcblx0MTEzOiAnc3ViamVjdCcsXG5cdDExNDogJ3Byb2NlZWRpbmdzVGl0bGUnLFxuXHQxMTU6ICdib29rVGl0bGUnLFxuXHQxMTY6ICdzaG9ydFRpdGxlJyxcblx0MTE3OiAnZG9ja2V0TnVtYmVyJyxcblx0MTE4OiAnbnVtUGFnZXMnLFxuXHQxMTk6ICdwcm9ncmFtVGl0bGUnLFxuXHQxMjA6ICdpc3N1aW5nQXV0aG9yaXR5Jyxcblx0MTIxOiAnZmlsaW5nRGF0ZScsXG5cdDEyMjogJ2dlbnJlJyxcblx0MTIzOiAnYXJjaGl2ZSdcbn07XG5cbi8vcmV2ZXJzZSBsb29rdXBcbk9iamVjdC5rZXlzKGZpZWxkcykubWFwKGsgPT4gZmllbGRzW2ZpZWxkc1trXV0gPSBrKTtcblxubW9kdWxlLmV4cG9ydHMgPSBmaWVsZHM7XG4iLCIvKiBnbG9iYWwgQ1NMOmZhbHNlICovXG4ndXNlIHN0cmljdCc7XG5cbmNvbnN0IGJhc2VNYXBwaW5ncyA9IHJlcXVpcmUoJ3pvdGVyby1iYXNlLW1hcHBpbmdzJyk7XG5cbmNvbnN0IHtcblx0Q1NMX05BTUVTX01BUFBJTkdTLFxuXHRDU0xfVEVYVF9NQVBQSU5HUyxcblx0Q1NMX0RBVEVfTUFQUElOR1MsXG5cdENTTF9UWVBFX01BUFBJTkdTXG59ID0gcmVxdWlyZSgnLi9jc2wtbWFwcGluZ3MnKTtcblxuY29uc3QgeyBnZXRGaWVsZElERnJvbVR5cGVBbmRCYXNlIH0gPSByZXF1aXJlKCcuL3R5cGUtc3BlY2lmaWMtZmllbGQtbWFwJyk7XG5jb25zdCBmaWVsZHMgPSByZXF1aXJlKCcuL2ZpZWxkcycpO1xuY29uc3QgaXRlbVR5cGVzID0gcmVxdWlyZSgnLi9pdGVtLXR5cGVzJyk7XG5jb25zdCBzdHJUb0RhdGUgPSByZXF1aXJlKCcuL3N0ci10by1kYXRlJyk7XG5jb25zdCBkZWZhdWx0SXRlbVR5cGVDcmVhdG9yVHlwZUxvb2t1cCA9IHJlcXVpcmUoJy4vZGVmYXVsdC1pdGVtLXR5cGUtY3JlYXRvci10eXBlLWxvb2t1cCcpO1xuXG5jb25zdCBiYXNlTWFwcGluZ3NGbGF0ID0gT2JqZWN0LmtleXMoYmFzZU1hcHBpbmdzKS5yZWR1Y2UoKGFnZ3IsIGl0KSA9PiB7XG5cdE9iamVjdC5rZXlzKGJhc2VNYXBwaW5nc1tpdF0pLmZvckVhY2gobWFwRnJvbSA9PiB7XG5cdFx0bGV0IGtleSA9IGAke2l0fSR7bWFwRnJvbX1gO1xuXHRcdGxldCB2YWx1ZSA9IGJhc2VNYXBwaW5nc1tpdF1bbWFwRnJvbV07XG5cdFx0YWdncltrZXldID0gdmFsdWU7XG5cdH0pO1xuXHRyZXR1cm4gYWdncjtcbn0sIHt9KTtcblxubW9kdWxlLmV4cG9ydHMgPSB6b3Rlcm9JdGVtID0+IHtcblx0dmFyIGNzbFR5cGUgPSBDU0xfVFlQRV9NQVBQSU5HU1t6b3Rlcm9JdGVtLml0ZW1UeXBlXTtcblx0aWYgKCFjc2xUeXBlKSB7XG5cdFx0dGhyb3cgbmV3IEVycm9yKCdVbmV4cGVjdGVkIFpvdGVybyBJdGVtIHR5cGUgXCInICsgem90ZXJvSXRlbS5pdGVtVHlwZSArICdcIicpO1xuXHR9XG5cblx0dmFyIGl0ZW1UeXBlSUQgPSBpdGVtVHlwZXNbem90ZXJvSXRlbS5pdGVtVHlwZV07XG5cblx0dmFyIGNzbEl0ZW0gPSB7XG5cdFx0Ly8gJ2lkJzp6b3Rlcm9JdGVtLnVyaSxcblx0XHRpZDogem90ZXJvSXRlbS5rZXksXG5cdFx0J3R5cGUnOmNzbFR5cGVcblx0fTtcblxuXHQvLyBnZXQgYWxsIHRleHQgdmFyaWFibGVzICh0aGVyZSBtdXN0IGJlIGEgYmV0dGVyIHdheSlcblx0Zm9yKGxldCB2YXJpYWJsZSBpbiBDU0xfVEVYVF9NQVBQSU5HUykge1xuXHRcdGxldCBmaWVsZHMgPSBDU0xfVEVYVF9NQVBQSU5HU1t2YXJpYWJsZV07XG5cdFx0Zm9yKGxldCBpPTAsIG49ZmllbGRzLmxlbmd0aDsgaTxuOyBpKyspIHtcblx0XHRcdGxldCBmaWVsZCA9IGZpZWxkc1tpXSxcblx0XHRcdFx0dmFsdWUgPSBudWxsO1xuXG5cdFx0XHRpZihmaWVsZCBpbiB6b3Rlcm9JdGVtKSB7XG5cdFx0XHRcdHZhbHVlID0gem90ZXJvSXRlbVtmaWVsZF07XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRjb25zdCBtYXBwZWRGaWVsZCA9IGJhc2VNYXBwaW5nc0ZsYXRbYCR7em90ZXJvSXRlbS5pdGVtVHlwZX0ke2ZpZWxkfWBdO1xuXHRcdFx0XHR2YWx1ZSA9IHpvdGVyb0l0ZW1bbWFwcGVkRmllbGRdO1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAoIXZhbHVlKSBjb250aW51ZTtcblxuXHRcdFx0aWYgKHR5cGVvZiB2YWx1ZSA9PSAnc3RyaW5nJykge1xuXHRcdFx0XHRpZiAoZmllbGQgPT0gJ0lTQk4nKSB7XG5cdFx0XHRcdFx0Ly8gT25seSB1c2UgdGhlIGZpcnN0IElTQk4gaW4gQ1NMIEpTT05cblx0XHRcdFx0XHR2YXIgaXNibiA9IHZhbHVlLm1hdGNoKC9eKD86OTdbODldLT8pPyg/OlxcZC0/KXs5fVtcXGR4XSg/IS0pXFxiL2kpO1xuXHRcdFx0XHRcdGlmKGlzYm4pIHtcblx0XHRcdFx0XHRcdHZhbHVlID0gaXNiblswXTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblxuXHRcdFx0XHQvLyBTdHJpcCBlbmNsb3NpbmcgcXVvdGVzXG5cdFx0XHRcdGlmKHZhbHVlLmNoYXJBdCgwKSA9PSAnXCInICYmIHZhbHVlLmluZGV4T2YoJ1wiJywgMSkgPT0gdmFsdWUubGVuZ3RoIC0gMSkge1xuXHRcdFx0XHRcdHZhbHVlID0gdmFsdWUuc3Vic3RyaW5nKDEsIHZhbHVlLmxlbmd0aCAtIDEpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGNzbEl0ZW1bdmFyaWFibGVdID0gdmFsdWU7XG5cdFx0XHRcdGJyZWFrO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdC8vIHNlcGFyYXRlIG5hbWUgdmFyaWFibGVzXG5cdGlmICh6b3Rlcm9JdGVtLnR5cGUgIT0gJ2F0dGFjaG1lbnQnICYmIHpvdGVyb0l0ZW0udHlwZSAhPSAnbm90ZScpIHtcblx0XHQvLyB2YXIgYXV0aG9yID0gWm90ZXJvLkNyZWF0b3JUeXBlcy5nZXROYW1lKFpvdGVyby5DcmVhdG9yVHlwZXMuZ2V0UHJpbWFyeUlERm9yVHlwZSgpKTtcblx0XHRsZXQgYXV0aG9yID0gZGVmYXVsdEl0ZW1UeXBlQ3JlYXRvclR5cGVMb29rdXBbaXRlbVR5cGVJRF07XG5cdFx0bGV0IGNyZWF0b3JzID0gem90ZXJvSXRlbS5jcmVhdG9ycztcblx0XHRmb3IobGV0IGkgPSAwOyBjcmVhdG9ycyAmJiBpIDwgY3JlYXRvcnMubGVuZ3RoOyBpKyspIHtcblx0XHRcdGxldCBjcmVhdG9yID0gY3JlYXRvcnNbaV07XG5cdFx0XHRsZXQgY3JlYXRvclR5cGUgPSBjcmVhdG9yLmNyZWF0b3JUeXBlO1xuXHRcdFx0bGV0IG5hbWVPYmo7XG5cblx0XHRcdGlmKGNyZWF0b3JUeXBlID09IGF1dGhvcikge1xuXHRcdFx0XHRjcmVhdG9yVHlwZSA9ICdhdXRob3InO1xuXHRcdFx0fVxuXG5cdFx0XHRjcmVhdG9yVHlwZSA9IENTTF9OQU1FU19NQVBQSU5HU1tjcmVhdG9yVHlwZV07XG5cdFx0XHRpZighY3JlYXRvclR5cGUpIHtcblx0XHRcdFx0Y29udGludWU7XG5cdFx0XHR9XG5cblx0XHRcdGlmICgnbGFzdE5hbWUnIGluIGNyZWF0b3IgfHwgJ2ZpcnN0TmFtZScgaW4gY3JlYXRvcikge1xuXHRcdFx0XHRuYW1lT2JqID0ge1xuXHRcdFx0XHRcdGZhbWlseTogY3JlYXRvci5sYXN0TmFtZSB8fCAnJyxcblx0XHRcdFx0XHRnaXZlbjogY3JlYXRvci5maXJzdE5hbWUgfHwgJydcblx0XHRcdFx0fTtcblxuXHRcdFx0XHQvLyBQYXJzZSBuYW1lIHBhcnRpY2xlc1xuXHRcdFx0XHQvLyBSZXBsaWNhdGUgY2l0ZXByb2MtanMgbG9naWMgZm9yIHdoYXQgc2hvdWxkIGJlIHBhcnNlZCBzbyB3ZSBkb24ndFxuXHRcdFx0XHQvLyBicmVhayBjdXJyZW50IGJlaGF2aW9yLlxuXHRcdFx0XHRpZiAobmFtZU9iai5mYW1pbHkgJiYgbmFtZU9iai5naXZlbikge1xuXHRcdFx0XHRcdC8vIERvbid0IHBhcnNlIGlmIGxhc3QgbmFtZSBpcyBxdW90ZWRcblx0XHRcdFx0XHRpZiAobmFtZU9iai5mYW1pbHkubGVuZ3RoID4gMVxuXHRcdFx0XHRcdFx0JiYgbmFtZU9iai5mYW1pbHkuY2hhckF0KDApID09ICdcIidcblx0XHRcdFx0XHRcdCYmIG5hbWVPYmouZmFtaWx5LmNoYXJBdChuYW1lT2JqLmZhbWlseS5sZW5ndGggLSAxKSA9PSAnXCInXG5cdFx0XHRcdFx0KSB7XG5cdFx0XHRcdFx0XHRuYW1lT2JqLmZhbWlseSA9IG5hbWVPYmouZmFtaWx5LnN1YnN0cigxLCBuYW1lT2JqLmZhbWlseS5sZW5ndGggLSAyKTtcblx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0Q1NMLnBhcnNlUGFydGljbGVzKG5hbWVPYmosIHRydWUpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fSBlbHNlIGlmICgnbmFtZScgaW4gY3JlYXRvcikge1xuXHRcdFx0XHRuYW1lT2JqID0geydsaXRlcmFsJzogY3JlYXRvci5uYW1lfTtcblx0XHRcdH1cblxuXHRcdFx0aWYoY3NsSXRlbVtjcmVhdG9yVHlwZV0pIHtcblx0XHRcdFx0Y3NsSXRlbVtjcmVhdG9yVHlwZV0ucHVzaChuYW1lT2JqKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdGNzbEl0ZW1bY3JlYXRvclR5cGVdID0gW25hbWVPYmpdO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdC8vIGdldCBkYXRlIHZhcmlhYmxlc1xuXHRmb3IobGV0IHZhcmlhYmxlIGluIENTTF9EQVRFX01BUFBJTkdTKSB7XG5cdFx0bGV0IGRhdGUgPSB6b3Rlcm9JdGVtW0NTTF9EQVRFX01BUFBJTkdTW3ZhcmlhYmxlXV07XG5cdFx0aWYgKCFkYXRlKSB7XG5cblx0XHRcdGxldCB0eXBlU3BlY2lmaWNGaWVsZElEID0gZ2V0RmllbGRJREZyb21UeXBlQW5kQmFzZShpdGVtVHlwZUlELCBDU0xfREFURV9NQVBQSU5HU1t2YXJpYWJsZV0pO1xuXHRcdFx0aWYgKHR5cGVTcGVjaWZpY0ZpZWxkSUQpIHtcblx0XHRcdFx0ZGF0ZSA9IHpvdGVyb0l0ZW1bZmllbGRzW3R5cGVTcGVjaWZpY0ZpZWxkSURdXTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRpZihkYXRlKSB7XG5cdFx0XHRsZXQgZGF0ZU9iaiA9IHN0clRvRGF0ZShkYXRlKTtcblx0XHRcdC8vIG90aGVyd2lzZSwgdXNlIGRhdGUtcGFydHNcblx0XHRcdGxldCBkYXRlUGFydHMgPSBbXTtcblx0XHRcdGlmKGRhdGVPYmoueWVhcikge1xuXHRcdFx0XHQvLyBhZGQgeWVhciwgbW9udGgsIGFuZCBkYXksIGlmIHRoZXkgZXhpc3Rcblx0XHRcdFx0ZGF0ZVBhcnRzLnB1c2goZGF0ZU9iai55ZWFyKTtcblx0XHRcdFx0aWYoZGF0ZU9iai5tb250aCAhPT0gdW5kZWZpbmVkKSB7XG5cdFx0XHRcdFx0ZGF0ZVBhcnRzLnB1c2goZGF0ZU9iai5tb250aCsxKTtcblx0XHRcdFx0XHRpZihkYXRlT2JqLmRheSkge1xuXHRcdFx0XHRcdFx0ZGF0ZVBhcnRzLnB1c2goZGF0ZU9iai5kYXkpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0XHRjc2xJdGVtW3ZhcmlhYmxlXSA9IHsnZGF0ZS1wYXJ0cyc6W2RhdGVQYXJ0c119O1xuXG5cdFx0XHRcdC8vIGlmIG5vIG1vbnRoLCB1c2Ugc2Vhc29uIGFzIG1vbnRoXG5cdFx0XHRcdGlmKGRhdGVPYmoucGFydCAmJiBkYXRlT2JqLm1vbnRoID09PSB1bmRlZmluZWQpIHtcblx0XHRcdFx0XHRjc2xJdGVtW3ZhcmlhYmxlXS5zZWFzb24gPSBkYXRlT2JqLnBhcnQ7XG5cdFx0XHRcdH1cblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdC8vIGlmIG5vIHllYXIsIHBhc3MgZGF0ZSBsaXRlcmFsbHlcblx0XHRcdFx0Y3NsSXRlbVt2YXJpYWJsZV0gPSB7J2xpdGVyYWwnOmRhdGV9O1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdC8vIFNwZWNpYWwgbWFwcGluZyBmb3Igbm90ZSB0aXRsZVxuXHQvLyBATk9URTogTm90IHBvcnRlZFxuXHQvLyBpZiAoem90ZXJvSXRlbS5pdGVtVHlwZSA9PSAnbm90ZScgJiYgem90ZXJvSXRlbS5ub3RlKSB7XG5cdC8vIFx0Y3NsSXRlbS50aXRsZSA9IFpvdGVyby5Ob3Rlcy5ub3RlVG9UaXRsZSh6b3Rlcm9JdGVtLm5vdGUpO1xuXHQvLyB9XG5cblx0Ly90aGlzLl9jYWNoZVt6b3Rlcm9JdGVtLmlkXSA9IGNzbEl0ZW07XG5cdHJldHVybiBjc2xJdGVtO1xufVxuIiwiJ3VzZSBzdHJpY3QnO1xuXG5jb25zdCBpdGVtVHlwZXMgPSB7XG5cdDE6ICdub3RlJyxcblx0MjogJ2Jvb2snLFxuXHQzOiAnYm9va1NlY3Rpb24nLFxuXHQ0OiAnam91cm5hbEFydGljbGUnLFxuXHQ1OiAnbWFnYXppbmVBcnRpY2xlJyxcblx0NjogJ25ld3NwYXBlckFydGljbGUnLFxuXHQ3OiAndGhlc2lzJyxcblx0ODogJ2xldHRlcicsXG5cdDk6ICdtYW51c2NyaXB0Jyxcblx0MTA6ICdpbnRlcnZpZXcnLFxuXHQxMTogJ2ZpbG0nLFxuXHQxMjogJ2FydHdvcmsnLFxuXHQxMzogJ3dlYnBhZ2UnLFxuXHQxNDogJ2F0dGFjaG1lbnQnLFxuXHQxNTogJ3JlcG9ydCcsXG5cdDE2OiAnYmlsbCcsXG5cdDE3OiAnY2FzZScsXG5cdDE4OiAnaGVhcmluZycsXG5cdDE5OiAncGF0ZW50Jyxcblx0MjA6ICdzdGF0dXRlJyxcblx0MjE6ICdlbWFpbCcsXG5cdDIyOiAnbWFwJyxcblx0MjM6ICdibG9nUG9zdCcsXG5cdDI0OiAnaW5zdGFudE1lc3NhZ2UnLFxuXHQyNTogJ2ZvcnVtUG9zdCcsXG5cdDI2OiAnYXVkaW9SZWNvcmRpbmcnLFxuXHQyNzogJ3ByZXNlbnRhdGlvbicsXG5cdDI4OiAndmlkZW9SZWNvcmRpbmcnLFxuXHQyOTogJ3R2QnJvYWRjYXN0Jyxcblx0MzA6ICdyYWRpb0Jyb2FkY2FzdCcsXG5cdDMxOiAncG9kY2FzdCcsXG5cdDMyOiAnY29tcHV0ZXJQcm9ncmFtJyxcblx0MzM6ICdjb25mZXJlbmNlUGFwZXInLFxuXHQzNDogJ2RvY3VtZW50Jyxcblx0MzU6ICdlbmN5Y2xvcGVkaWFBcnRpY2xlJyxcblx0MzY6ICdkaWN0aW9uYXJ5RW50cnknXG59O1xuXG4vL3JldmVyc2UgbG9va3VwXG5PYmplY3Qua2V5cyhpdGVtVHlwZXMpLm1hcChrID0+IGl0ZW1UeXBlc1tpdGVtVHlwZXNba11dID0gayk7XG5tb2R1bGUuZXhwb3J0cyA9IGl0ZW1UeXBlcztcbiIsIid1c2Ugc3RyaWN0JztcblxubW9kdWxlLmV4cG9ydHMgPSAoc3RyaW5nLCBwYWQsIGxlbmd0aCkgPT4ge1xuXHRzdHJpbmcgPSBzdHJpbmcgPyBzdHJpbmcgKyAnJyA6ICcnO1xuXHR3aGlsZShzdHJpbmcubGVuZ3RoIDwgbGVuZ3RoKSB7XG5cdFx0c3RyaW5nID0gcGFkICsgc3RyaW5nO1xuXHR9XG5cdHJldHVybiBzdHJpbmc7XG59XG4iLCIndXNlIHN0cmljdCc7XG5cbmNvbnN0IGRhdGVUb1NRTCA9IHJlcXVpcmUoJy4vZGF0ZS10by1zcWwnKTtcblxuY29uc3QgbW9udGhzID0gWydqYW4nLCAnZmViJywgJ21hcicsICdhcHInLCAnbWF5JywgJ2p1bicsICdqdWwnLCAnYXVnJywgJ3NlcCcsICdvY3QnLCAnbm92JywgJ2RlYycsICdqYW51YXJ5JywgJ2ZlYnJ1YXJ5JywgJ21hcmNoJywgJ2FwcmlsJywgJ21heScsICdqdW5lJywgJ2p1bHknLCAnYXVndXN0JywgJ3NlcHRlbWJlcicsICdvY3RvYmVyJywgJ25vdmVtYmVyJywgJ2RlY2VtYmVyJ107XG5cbmNvbnN0IF9zbGFzaFJlID0gL14oLio/KVxcYihbMC05XXsxLDR9KSg/OihbXFwtXFwvXFwuXFx1NWU3NF0pKFswLTldezEsMn0pKT8oPzooW1xcLVxcL1xcLlxcdTY3MDhdKShbMC05XXsxLDR9KSk/KCg/OlxcYnxbXjAtOV0pLio/KSQvXG5jb25zdCBfeWVhclJlID0gL14oLio/KVxcYigoPzpjaXJjYSB8YXJvdW5kIHxhYm91dCB8Y1xcLj8gPyk/WzAtOV17MSw0fSg/OiA/QlxcLj8gP0NcXC4/KD86ID9FXFwuPyk/fCA/Q1xcLj8gP0VcXC4/fCA/QVxcLj8gP0RcXC4/KXxbMC05XXszLDR9KVxcYiguKj8pJC9pO1xuY29uc3QgX21vbnRoUmUgPSBuZXcgUmVnRXhwKCdeKC4qKVxcXFxiKCcgKyBtb250aHMuam9pbignfCcpICsgJylbXiBdKig/OiAoLiopJHwkKScsICdpJyk7XG5jb25zdCBfZGF5UmUgPSBuZXcgUmVnRXhwKCdcXFxcYihbMC05XXsxLDJ9KSg/OnN0fG5kfHJkfHRoKT9cXFxcYiguKiknLCAnaScpO1xuXG5jb25zdCBfaW5zZXJ0RGF0ZU9yZGVyUGFydCA9IChkYXRlT3JkZXIsIHBhcnQsIHBhcnRPcmRlcikgPT4ge1xuXHRcdGlmICghZGF0ZU9yZGVyKSB7XG5cdFx0XHRyZXR1cm4gcGFydDtcblx0XHR9XG5cdFx0aWYgKHBhcnRPcmRlci5iZWZvcmUgPT09IHRydWUpIHtcblx0XHRcdHJldHVybiBwYXJ0ICsgZGF0ZU9yZGVyO1xuXHRcdH1cblx0XHRpZiAocGFydE9yZGVyLmFmdGVyID09PSB0cnVlKSB7XG5cdFx0XHRyZXR1cm4gZGF0ZU9yZGVyICsgcGFydDtcblx0XHR9XG5cdFx0aWYgKHBhcnRPcmRlci5iZWZvcmUpIHtcblx0XHRcdGxldCBwb3MgPSBkYXRlT3JkZXIuaW5kZXhPZihwYXJ0T3JkZXIuYmVmb3JlKTtcblx0XHRcdGlmIChwb3MgPT0gLTEpIHtcblx0XHRcdFx0cmV0dXJuIGRhdGVPcmRlcjtcblx0XHRcdH1cblx0XHRcdHJldHVybiBkYXRlT3JkZXIucmVwbGFjZShuZXcgUmVnRXhwKCcoJyArIHBhcnRPcmRlci5iZWZvcmUgKyAnKScpLCBwYXJ0ICsgJyQxJyk7XG5cdFx0fVxuXHRcdGlmIChwYXJ0T3JkZXIuYWZ0ZXIpIHtcblx0XHRcdGxldCBwb3MgPSBkYXRlT3JkZXIuaW5kZXhPZihwYXJ0T3JkZXIuYWZ0ZXIpO1xuXHRcdFx0aWYgKHBvcyA9PSAtMSkge1xuXHRcdFx0XHRyZXR1cm4gZGF0ZU9yZGVyICsgcGFydDtcblx0XHRcdH1cblx0XHRcdHJldHVybiBkYXRlT3JkZXIucmVwbGFjZShuZXcgUmVnRXhwKCcoJyArIHBhcnRPcmRlci5hZnRlciArICcpJyksICckMScgKyBwYXJ0KTtcblx0XHR9XG5cdFx0cmV0dXJuIGRhdGVPcmRlciArIHBhcnQ7XG59XG5cbm1vZHVsZS5leHBvcnRzID0gc3RyaW5nID0+IHtcblx0dmFyIGRhdGUgPSB7XG5cdFx0b3JkZXI6ICcnXG5cdH07XG5cblx0Ly8gc2tpcCBlbXB0eSB0aGluZ3Ncblx0aWYoIXN0cmluZykge1xuXHRcdHJldHVybiBkYXRlO1xuXHR9XG5cblx0dmFyIHBhcnRzID0gW107XG5cblx0Ly8gUGFyc2UgJ3llc3RlcmRheScvJ3RvZGF5Jy8ndG9tb3Jyb3cnXG5cdGxldCBsYyA9IChzdHJpbmcgKyAnJykudG9Mb3dlckNhc2UoKTtcblx0aWYgKGxjID09ICd5ZXN0ZXJkYXknKSB7XG5cdFx0c3RyaW5nID0gZGF0ZVRvU1FMKG5ldyBEYXRlKERhdGUubm93KCkgLSAxMDAwKjYwKjYwKjI0KSkuc3Vic3RyKDAsIDEwKTtcblx0fVxuXHRlbHNlIGlmIChsYyA9PSAndG9kYXknKSB7XG5cdFx0c3RyaW5nID0gZGF0ZVRvU1FMKG5ldyBEYXRlKCkpLnN1YnN0cigwLCAxMCk7XG5cdH1cblx0ZWxzZSBpZiAobGMgPT0gJ3RvbW9ycm93Jykge1xuXHRcdHN0cmluZyA9IGRhdGVUb1NRTChuZXcgRGF0ZShEYXRlLm5vdygpICsgMTAwMCo2MCo2MCoyNCkpLnN1YnN0cigwLCAxMCk7XG5cdH1cblx0ZWxzZSB7XG5cdFx0c3RyaW5nID0gc3RyaW5nLnRvU3RyaW5nKCkucmVwbGFjZSgvXlxccyt8XFxzKyQvZywgJycpLnJlcGxhY2UoL1xccysvLCAnICcpO1xuXHR9XG5cblx0Ly8gZmlyc3QsIGRpcmVjdGx5IGluc3BlY3QgdGhlIHN0cmluZ1xuXHRsZXQgbSA9IF9zbGFzaFJlLmV4ZWMoc3RyaW5nKTtcblx0aWYobSAmJlxuXHRcdCgoIW1bNV0gfHwgIW1bM10pIHx8IG1bM10gPT0gbVs1XSB8fCAobVszXSA9PSAnXFx1NWU3NCcgJiYgbVs1XSA9PSAnXFx1NjcwOCcpKSAmJlx0Ly8gcmVxdWlyZSBzYW5lIHNlcGFyYXRvcnNcblx0XHQoKG1bMl0gJiYgbVs0XSAmJiBtWzZdKSB8fCAoIW1bMV0gJiYgIW1bN10pKSkge1x0XHRcdFx0XHRcdC8vIHJlcXVpcmUgdGhhdCBlaXRoZXIgYWxsIHBhcnRzIGFyZSBmb3VuZCxcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0Ly8gb3IgZWxzZSB0aGlzIGlzIHRoZSBlbnRpcmUgZGF0ZSBmaWVsZFxuXHRcdC8vIGZpZ3VyZSBvdXQgZGF0ZSBiYXNlZCBvbiBwYXJ0c1xuXHRcdGlmKG1bMl0ubGVuZ3RoID09IDMgfHwgbVsyXS5sZW5ndGggPT0gNCB8fCBtWzNdID09ICdcXHU1ZTc0Jykge1xuXHRcdFx0Ly8gSVNPIDg2MDEgc3R5bGUgZGF0ZSAoYmlnIGVuZGlhbilcblx0XHRcdGRhdGUueWVhciA9IG1bMl07XG5cdFx0XHRkYXRlLm1vbnRoID0gbVs0XTtcblx0XHRcdGRhdGUuZGF5ID0gbVs2XTtcblx0XHRcdGRhdGUub3JkZXIgKz0gbVsyXSA/ICd5JyA6ICcnO1xuXHRcdFx0ZGF0ZS5vcmRlciArPSBtWzRdID8gJ20nIDogJyc7XG5cdFx0XHRkYXRlLm9yZGVyICs9IG1bNl0gPyAnZCcgOiAnJztcblx0XHR9IGVsc2UgaWYobVsyXSAmJiAhbVs0XSAmJiBtWzZdKSB7XG5cdFx0XHRkYXRlLm1vbnRoID0gbVsyXTtcblx0XHRcdGRhdGUueWVhciA9IG1bNl07XG5cdFx0XHRkYXRlLm9yZGVyICs9IG1bMl0gPyAnbScgOiAnJztcblx0XHRcdGRhdGUub3JkZXIgKz0gbVs2XSA/ICd5JyA6ICcnO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHQvLyBsb2NhbCBzdHlsZSBkYXRlIChtaWRkbGUgb3IgbGl0dGxlIGVuZGlhbilcblx0XHRcdHZhciBjb3VudHJ5ID0gd2luZG93Lm5hdmlnYXRvci5sYW5ndWFnZSA/IHdpbmRvdy5uYXZpZ2F0b3IubGFuZ3VhZ2Uuc3Vic3RyKDMpIDogJ1VTJztcblx0XHRcdGlmKGNvdW50cnkgPT0gJ1VTJyB8fFx0Ly8gVGhlIFVuaXRlZCBTdGF0ZXNcblx0XHRcdFx0Y291bnRyeSA9PSAnRk0nIHx8XHQvLyBUaGUgRmVkZXJhdGVkIFN0YXRlcyBvZiBNaWNyb25lc2lhXG5cdFx0XHRcdGNvdW50cnkgPT0gJ1BXJyB8fFx0Ly8gUGFsYXVcblx0XHRcdFx0Y291bnRyeSA9PSAnUEgnKSB7XHQvLyBUaGUgUGhpbGlwcGluZXNcblx0XHRcdFx0XHRkYXRlLm1vbnRoID0gbVsyXTtcblx0XHRcdFx0XHRkYXRlLmRheSA9IG1bNF07XG5cdFx0XHRcdFx0ZGF0ZS5vcmRlciArPSBtWzJdID8gJ20nIDogJyc7XG5cdFx0XHRcdFx0ZGF0ZS5vcmRlciArPSBtWzRdID8gJ2QnIDogJyc7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRkYXRlLm1vbnRoID0gbVs0XTtcblx0XHRcdFx0ZGF0ZS5kYXkgPSBtWzJdO1xuXHRcdFx0XHRkYXRlLm9yZGVyICs9IG1bMl0gPyAnZCcgOiAnJztcblx0XHRcdFx0ZGF0ZS5vcmRlciArPSBtWzRdID8gJ20nIDogJyc7XG5cdFx0XHR9XG5cdFx0XHRkYXRlLnllYXIgPSBtWzZdO1xuXHRcdFx0ZGF0ZS5vcmRlciArPSAneSc7XG5cdFx0fVxuXG5cdFx0aWYoZGF0ZS55ZWFyKSB7XG5cdFx0XHRkYXRlLnllYXIgPSBwYXJzZUludChkYXRlLnllYXIsIDEwKTtcblx0XHR9XG5cdFx0aWYoZGF0ZS5kYXkpIHtcblx0XHRcdGRhdGUuZGF5ID0gcGFyc2VJbnQoZGF0ZS5kYXksIDEwKTtcblx0XHR9XG5cdFx0aWYoZGF0ZS5tb250aCkge1xuXHRcdFx0ZGF0ZS5tb250aCA9IHBhcnNlSW50KGRhdGUubW9udGgsIDEwKTtcblxuXHRcdFx0aWYoZGF0ZS5tb250aCA+IDEyKSB7XG5cdFx0XHRcdC8vIHN3YXAgZGF5IGFuZCBtb250aFxuXHRcdFx0XHR2YXIgdG1wID0gZGF0ZS5kYXk7XG5cdFx0XHRcdGRhdGUuZGF5ID0gZGF0ZS5tb250aFxuXHRcdFx0XHRkYXRlLm1vbnRoID0gdG1wO1xuXHRcdFx0XHRkYXRlLm9yZGVyID0gZGF0ZS5vcmRlci5yZXBsYWNlKCdtJywgJ0QnKVxuXHRcdFx0XHRcdC5yZXBsYWNlKCdkJywgJ00nKVxuXHRcdFx0XHRcdC5yZXBsYWNlKCdEJywgJ2QnKVxuXHRcdFx0XHRcdC5yZXBsYWNlKCdNJywgJ20nKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRpZigoIWRhdGUubW9udGggfHwgZGF0ZS5tb250aCA8PSAxMikgJiYgKCFkYXRlLmRheSB8fCBkYXRlLmRheSA8PSAzMSkpIHtcblx0XHRcdGlmKGRhdGUueWVhciAmJiBkYXRlLnllYXIgPCAxMDApIHtcdC8vIGZvciB0d28gZGlnaXQgeWVhcnMsIGRldGVybWluZSBwcm9wZXJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdC8vIGZvdXIgZGlnaXQgeWVhclxuXHRcdFx0XHR2YXIgdG9kYXkgPSBuZXcgRGF0ZSgpO1xuXHRcdFx0XHR2YXIgeWVhciA9IHRvZGF5LmdldEZ1bGxZZWFyKCk7XG5cdFx0XHRcdHZhciB0d29EaWdpdFllYXIgPSB5ZWFyICUgMTAwO1xuXHRcdFx0XHR2YXIgY2VudHVyeSA9IHllYXIgLSB0d29EaWdpdFllYXI7XG5cblx0XHRcdFx0aWYoZGF0ZS55ZWFyIDw9IHR3b0RpZ2l0WWVhcikge1xuXHRcdFx0XHRcdC8vIGFzc3VtZSB0aGlzIGRhdGUgaXMgZnJvbSBvdXIgY2VudHVyeVxuXHRcdFx0XHRcdGRhdGUueWVhciA9IGNlbnR1cnkgKyBkYXRlLnllYXI7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0Ly8gYXNzdW1lIHRoaXMgZGF0ZSBpcyBmcm9tIHRoZSBwcmV2aW91cyBjZW50dXJ5XG5cdFx0XHRcdFx0ZGF0ZS55ZWFyID0gY2VudHVyeSAtIDEwMCArIGRhdGUueWVhcjtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0XHRpZihkYXRlLm1vbnRoKSB7XG5cdFx0XHRcdGRhdGUubW9udGgtLTtcdFx0Ly8gc3VidHJhY3Qgb25lIGZvciBKUyBzdHlsZVxuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0ZGVsZXRlIGRhdGUubW9udGg7XG5cdFx0XHR9XG5cblx0XHRcdHBhcnRzLnB1c2goXG5cdFx0XHRcdHsgcGFydDogbVsxXSwgYmVmb3JlOiB0cnVlIH0sXG5cdFx0XHRcdHsgcGFydDogbVs3XSB9XG5cdFx0XHQpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHR2YXIgZGF0ZSA9IHtcblx0XHRcdFx0b3JkZXI6ICcnXG5cdFx0XHR9O1xuXHRcdFx0cGFydHMucHVzaCh7IHBhcnQ6IHN0cmluZyB9KTtcblx0XHR9XG5cdH0gZWxzZSB7XG5cdFx0cGFydHMucHVzaCh7IHBhcnQ6IHN0cmluZyB9KTtcblx0fVxuXG5cdC8vIGNvdWxkbid0IGZpbmQgc29tZXRoaW5nIHdpdGggdGhlIGFsZ29yaXRobXM7IHVzZSByZWdleHBcblx0Ly8gWUVBUlxuXHRpZighZGF0ZS55ZWFyKSB7XG5cdFx0Zm9yIChsZXQgaSBpbiBwYXJ0cykge1xuXHRcdFx0bGV0IG0gPSBfeWVhclJlLmV4ZWMocGFydHNbaV0ucGFydCk7XG5cdFx0XHRpZiAobSkge1xuXHRcdFx0XHRkYXRlLnllYXIgPSBtWzJdO1xuXHRcdFx0XHRkYXRlLm9yZGVyID0gX2luc2VydERhdGVPcmRlclBhcnQoZGF0ZS5vcmRlciwgJ3knLCBwYXJ0c1tpXSk7XG5cdFx0XHRcdHBhcnRzLnNwbGljZShcblx0XHRcdFx0XHRpLCAxLFxuXHRcdFx0XHRcdHsgcGFydDogbVsxXSwgYmVmb3JlOiB0cnVlIH0sXG5cdFx0XHRcdFx0eyBwYXJ0OiBtWzNdIH1cblx0XHRcdFx0KTtcblx0XHRcdFx0YnJlYWs7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0Ly8gTU9OVEhcblx0aWYoZGF0ZS5tb250aCA9PT0gdW5kZWZpbmVkKSB7XG5cdFx0Zm9yIChsZXQgaSBpbiBwYXJ0cykge1xuXHRcdFx0bGV0IG0gPSBfbW9udGhSZS5leGVjKHBhcnRzW2ldLnBhcnQpO1xuXHRcdFx0aWYgKG0pIHtcblx0XHRcdFx0Ly8gTW9kdWxvIDEyIGluIGNhc2Ugd2UgaGF2ZSBtdWx0aXBsZSBsYW5ndWFnZXNcblx0XHRcdFx0ZGF0ZS5tb250aCA9IG1vbnRocy5pbmRleE9mKG1bMl0udG9Mb3dlckNhc2UoKSkgJSAxMjtcblx0XHRcdFx0ZGF0ZS5vcmRlciA9IF9pbnNlcnREYXRlT3JkZXJQYXJ0KGRhdGUub3JkZXIsICdtJywgcGFydHNbaV0pO1xuXHRcdFx0XHRwYXJ0cy5zcGxpY2UoXG5cdFx0XHRcdFx0aSwgMSxcblx0XHRcdFx0XHR7IHBhcnQ6IG1bMV0sIGJlZm9yZTogJ20nIH0sXG5cdFx0XHRcdFx0eyBwYXJ0OiBtWzNdLCBhZnRlcjogJ20nIH1cblx0XHRcdFx0KTtcblx0XHRcdFx0YnJlYWs7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0Ly8gREFZXG5cdGlmKCFkYXRlLmRheSkge1xuXHRcdC8vIGNvbXBpbGUgZGF5IHJlZ3VsYXIgZXhwcmVzc2lvblxuXHRcdGZvciAobGV0IGkgaW4gcGFydHMpIHtcblx0XHRcdGxldCBtID0gX2RheVJlLmV4ZWMocGFydHNbaV0ucGFydCk7XG5cdFx0XHRpZiAobSkge1xuXHRcdFx0XHR2YXIgZGF5ID0gcGFyc2VJbnQobVsxXSwgMTApLFxuXHRcdFx0XHRcdHBhcnQ7XG5cdFx0XHRcdC8vIFNhbml0eSBjaGVja1xuXHRcdFx0XHRpZiAoZGF5IDw9IDMxKSB7XG5cdFx0XHRcdFx0ZGF0ZS5kYXkgPSBkYXk7XG5cdFx0XHRcdFx0ZGF0ZS5vcmRlciA9IF9pbnNlcnREYXRlT3JkZXJQYXJ0KGRhdGUub3JkZXIsICdkJywgcGFydHNbaV0pO1xuXHRcdFx0XHRcdGlmKG0uaW5kZXggPiAwKSB7XG5cdFx0XHRcdFx0XHRwYXJ0ID0gcGFydHNbaV0ucGFydC5zdWJzdHIoMCwgbS5pbmRleCk7XG5cdFx0XHRcdFx0XHRpZihtWzJdKSB7XG5cdFx0XHRcdFx0XHRcdHBhcnQgKz0gJyAnICsgbVsyXTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0cGFydCA9IG1bMl07XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdHBhcnRzLnNwbGljZShcblx0XHRcdFx0XHRcdGksIDEsXG5cdFx0XHRcdFx0XHR7IHBhcnQ6IHBhcnQgfVxuXHRcdFx0XHRcdCk7XG5cdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHQvLyBDb25jYXRlbmF0ZSBkYXRlIHBhcnRzXG5cdGRhdGUucGFydCA9ICcnO1xuXHRmb3IgKHZhciBpIGluIHBhcnRzKSB7XG5cdFx0ZGF0ZS5wYXJ0ICs9IHBhcnRzW2ldLnBhcnQgKyAnICc7XG5cdH1cblxuXHQvLyBjbGVhbiB1cCBkYXRlIHBhcnRcblx0aWYoZGF0ZS5wYXJ0KSB7XG5cdFx0ZGF0ZS5wYXJ0ID0gZGF0ZS5wYXJ0LnJlcGxhY2UoL15bXkEtWmEtejAtOV0rfFteQS1aYS16MC05XSskL2csICcnKTtcblx0fVxuXG5cdGlmKGRhdGUucGFydCA9PT0gJycgfHwgZGF0ZS5wYXJ0ID09IHVuZGVmaW5lZCkge1xuXHRcdGRlbGV0ZSBkYXRlLnBhcnQ7XG5cdH1cblxuXHQvL21ha2Ugc3VyZSB5ZWFyIGlzIGFsd2F5cyBhIHN0cmluZ1xuXHRpZihkYXRlLnllYXIgfHwgZGF0ZS55ZWFyID09PSAwKSBkYXRlLnllYXIgKz0gJyc7XG5cblx0cmV0dXJuIGRhdGU7XG59XG4iLCJjb25zdCBmaWVsZHMgPSByZXF1aXJlKCcuL2ZpZWxkcycpO1xuY29uc3QgaXRlbVR5cGVzID0gcmVxdWlyZSgnLi9pdGVtLXR5cGVzJyk7XG5cbmNvbnN0IHR5cGVTcGVjaWZpY0ZpZWxkTWFwID0ge1xuXHRbKDE2IDw8IDgpICsgNF06IDk0LFxuXHRbKDE3IDw8IDgpICsgNF06IDk3LFxuXHRbKDcgPDwgOCkgKyA4XTogODksXG5cdFsoMTEgPDwgOCkgKyA4XTogMjEsXG5cdFsoMTUgPDwgOCkgKyA4XTogMzEsXG5cdFsoMjYgPDwgOCkgKyA4XTogNzIsXG5cdFsoMjggPDwgOCkgKyA4XTogNzYsXG5cdFsoMjkgPDwgOCkgKyA4XTogNzgsXG5cdFsoMzAgPDwgOCkgKyA4XTogNzgsXG5cdFsoMzIgPDwgOCkgKyA4XTogODMsXG5cdFsoMTYgPDwgOCkgKyAxMF06IDk1LFxuXHRbKDE3IDw8IDgpICsgMTBdOiA5OCxcblx0WygzIDw8IDgpICsgMTJdOiAxMTUsXG5cdFsoMzMgPDwgOCkgKyAxMl06IDExNCxcblx0WygxMyA8PCA4KSArIDEyXTogOTEsXG5cdFsoMjMgPDwgOCkgKyAxMl06IDEwNyxcblx0WygyNSA8PCA4KSArIDEyXTogMTA0LFxuXHRbKDI5IDw8IDgpICsgMTJdOiAxMTksXG5cdFsoMzAgPDwgOCkgKyAxMl06IDExOSxcblx0WygzNSA8PCA4KSArIDEyXTogODUsXG5cdFsoMzYgPDwgOCkgKyAxMl06IDg2LFxuXHRbKDE3IDw8IDgpICsgMTRdOiA5Nixcblx0WygxOSA8PCA4KSArIDE0XTogNTIsXG5cdFsoMjAgPDwgOCkgKyAxNF06IDEwMCxcblx0WygxNSA8PCA4KSArIDYwXTogOTIsXG5cdFsoMTYgPDwgOCkgKyA2MF06IDkzLFxuXHRbKDE3IDw8IDgpICsgNjBdOiAxMTcsXG5cdFsoMTggPDwgOCkgKyA2MF06IDk5LFxuXHRbKDE5IDw8IDgpICsgNjBdOiA1MCxcblx0WygyMCA8PCA4KSArIDYwXTogMTAxLFxuXHRbKDI5IDw8IDgpICsgNjBdOiAxMDUsXG5cdFsoMzAgPDwgOCkgKyA2MF06IDEwNSxcblx0WygzMSA8PCA4KSArIDYwXTogMTA1LFxuXHRbKDcgPDwgOCkgKyAxMDhdOiA2OSxcblx0Wyg4IDw8IDgpICsgMTA4XTogNjUsXG5cdFsoOSA8PCA4KSArIDEwOF06IDY2LFxuXHRbKDExIDw8IDgpICsgMTA4XTogMTIyLFxuXHRbKDEzIDw8IDgpICsgMTA4XTogNzAsXG5cdFsoMTUgPDwgOCkgKyAxMDhdOiAzMixcblx0WygyMiA8PCA4KSArIDEwOF06IDY3LFxuXHRbKDIzIDw8IDgpICsgMTA4XTogNzAsXG5cdFsoMjUgPDwgOCkgKyAxMDhdOiA3OSxcblx0WygyNyA8PCA4KSArIDEwOF06IDc0LFxuXHRbKDEwIDw8IDgpICsgMTA5XTogNjQsXG5cdFsoMTEgPDwgOCkgKyAxMDldOiA2Myxcblx0WygxMiA8PCA4KSArIDEwOV06IDU5LFxuXHRbKDI2IDw8IDgpICsgMTA5XTogNzEsXG5cdFsoMjggPDwgOCkgKyAxMDldOiA2Myxcblx0WygyOSA8PCA4KSArIDEwOV06IDYzLFxuXHRbKDMwIDw8IDgpICsgMTA5XTogNzEsXG5cdFsoMzEgPDwgOCkgKyAxMDldOiA4MCxcblx0WygxNyA8PCA4KSArIDExMF06IDExMSxcblx0WygyMCA8PCA4KSArIDExMF06IDExMixcblx0WygyMSA8PCA4KSArIDExMF06IDExM1xufTtcblxubW9kdWxlLmV4cG9ydHMgPSB7XG5cdG1hcDogdHlwZVNwZWNpZmljRmllbGRNYXAsXG5cdGdldEZpZWxkSURGcm9tVHlwZUFuZEJhc2U6ICh0eXBlSWQsIGZpZWxkSWQpID0+IHtcblx0XHR0eXBlSWQgPSB0eXBlb2YgdHlwZUlkID09PSAnbnVtYmVyJyA/IHR5cGVJZCA6IGl0ZW1UeXBlc1t0eXBlSWRdO1xuXHRcdGZpZWxkSWQgPSB0eXBlb2YgZmllbGRJZCA9PT0gJ251bWJlcicgPyBmaWVsZElkIDogZmllbGRzW2ZpZWxkSWRdO1xuXHRcdHJldHVybiB0eXBlU3BlY2lmaWNGaWVsZE1hcFsodHlwZUlkIDw8IDgpICsgZmllbGRJZF07XG5cdH1cbn07XG4iXX0=
