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
'use strict';var _extends=Object.assign||function(e){for(var a,b=1;b<arguments.length;b++)for(var c in a=arguments[b],a)Object.prototype.hasOwnProperty.call(a,c)&&(e[c]=a[c]);return e},_createClass=function(){function e(e,f){for(var b,c=0;c<f.length;c++)b=f[c],b.enumerable=b.enumerable||!1,b.configurable=!0,'value'in b&&(b.writable=!0),Object.defineProperty(e,b.key,b)}return function(a,b,c){return b&&e(a.prototype,b),c&&e(a,c),a}}();function _asyncToGenerator(c){return function(){var a=c.apply(this,arguments);return new Promise(function(b,e){function c(d,i){try{var f=a[d](i),g=f.value}catch(b){return void e(b)}return f.done?void b(g):Promise.resolve(g).then(function(b){c('next',b)},function(b){c('throw',b)})}return c('next')})}}function _toConsumableArray(d){if(Array.isArray(d)){for(var a=0,b=Array(d.length);a<d.length;a++)b[a]=d[a];return b}return Array.from(d)}function _classCallCheck(c,a){if(!(c instanceof a))throw new TypeError('Cannot call a class as a function')}var _require=require('./utils'),uuid4=_require.uuid4,isLikeZoteroItem=_require.isLikeZoteroItem,defaults=require('./defaults'),itemToCSLJSON=require('../zotero-shim/item-to-csl-json'),dateToSql=require('../zotero-shim/date-to-sql'),COMPLETE='COMPLETE',MULTIPLE_ITEMS='MULTIPLE_ITEMS',FAILED='FAILED',ZoteroBib=function(){function c(a){if(_classCallCheck(this,c),this.opts=_extends({sessionid:uuid4()},defaults(),a),this.opts.persist&&this.opts.storage){if(!('getItem'in this.opts.storage||'setItem'in this.opts.storage||'clear'in this.opts.storage))throw new Error('Invalid storage engine provided');this.opts.override&&this.clearItems(),this.items=[].concat(_toConsumableArray(this.opts.initialItems),_toConsumableArray(this.getItemsStorage())).filter(isLikeZoteroItem),this.setItemsStorage(this.items)}else this.items=[].concat(_toConsumableArray(this.opts.initialItems)).filter(isLikeZoteroItem)}return _createClass(c,[{key:'getItemsStorage',value:function(){var b=this.opts.storage.getItem(this.opts.storagePrefix+'-items');return b?JSON.parse(b):[]}},{key:'setItemsStorage',value:function(b){this.opts.storage.setItem(this.opts.storagePrefix+'-items',JSON.stringify(b))}},{key:'reloadItems',value:function(){this.items=this.getItemsStorage()}},{key:'addItem',value:function(b){if(!isLikeZoteroItem(b))throw new Error('Failed to add item');this.items.push(b),this.opts.persist&&this.setItemsStorage(this.items)}},{key:'updateItem',value:function(c,a){this.items[c]=a,this.opts.persist&&this.setItemsStorage(this.items)}},{key:'removeItem',value:function(c){var a=this.items.indexOf(c);return-1!==a&&(this.items.splice(a,1),this.opts.persist&&this.setItemsStorage(this.items),c)}},{key:'clearItems',value:function(){this.items=[],this.opts.persist&&this.setItemsStorage(this.items)}},{key:'exportItems',value:function(){var b=_asyncToGenerator(regeneratorRuntime.mark(function f(g){var b,c,d;return regeneratorRuntime.wrap(function(e){for(;;)switch(e.prev=e.next){case 0:return b=this.opts.translationServerUrl+'/'+this.opts.translationServerPrefix+'export?format='+g,c=_extends({method:'POST',headers:{"Content-Type":'application/json'},body:JSON.stringify(this.items.filter(function(b){return'key'in b}))},this.opts.init),e.next=4,fetch(b,c);case 4:if(d=e.sent,!d.ok){e.next=11;break}return e.next=8,d.text();case 8:return e.abrupt('return',e.sent);case 11:throw new Error('Failed to export items');case 12:case'end':return e.stop();}},f,this)}));return function(){return b.apply(this,arguments)}}()},{key:'translateIdentifier',value:function(){var b=_asyncToGenerator(regeneratorRuntime.mark(function h(i){for(var a=arguments.length,c=Array(1<a?a-1:0),d=1;d<a;d++)c[d-1]=arguments[d];var e,f;return regeneratorRuntime.wrap(function(d){for(;;)switch(d.prev=d.next){case 0:return e=this.opts.translationServerUrl+'/'+this.opts.translationServerPrefix+'search',f=_extends({method:'POST',headers:{"Content-Type":'text/plain'},body:i},this.opts.init),d.next=4,this.translate.apply(this,[e,f].concat(c));case 4:return d.abrupt('return',d.sent);case 5:case'end':return d.stop();}},h,this)}));return function(){return b.apply(this,arguments)}}()},{key:'translateUrlItems',value:function(){var b=_asyncToGenerator(regeneratorRuntime.mark(function k(l,m){for(var a=arguments.length,d=Array(2<a?a-2:0),e=2;e<a;e++)d[e-2]=arguments[e];var f,g,n,i;return regeneratorRuntime.wrap(function(e){for(;;)switch(e.prev=e.next){case 0:return f=this.opts.translationServerUrl+'/'+this.opts.translationServerPrefix+'web',g=this.opts.sessionid,n=_extends({url:l,items:m,sessionid:g},this.opts.request),i=_extends({method:'POST',headers:{"Content-Type":'application/json'},body:JSON.stringify(n)},this.opts.init),e.next=6,this.translate.apply(this,[f,i].concat(d));case 6:return e.abrupt('return',e.sent);case 7:case'end':return e.stop();}},k,this)}));return function(){return b.apply(this,arguments)}}()},{key:'translateUrl',value:function(){var b=_asyncToGenerator(regeneratorRuntime.mark(function j(k){for(var a=arguments.length,c=Array(1<a?a-1:0),d=1;d<a;d++)c[d-1]=arguments[d];var e,f,l,h;return regeneratorRuntime.wrap(function(d){for(;;)switch(d.prev=d.next){case 0:return e=this.opts.translationServerUrl+'/'+this.opts.translationServerPrefix+'web',f=this.opts.sessionid,l=_extends({url:k,sessionid:f},this.opts.request),h=_extends({method:'POST',headers:{"Content-Type":'application/json'},body:JSON.stringify(l)},this.opts.init),d.next=6,this.translate.apply(this,[e,h].concat(c));case 6:return d.abrupt('return',d.sent);case 7:case'end':return d.stop();}},j,this)}));return function(){return b.apply(this,arguments)}}()},{key:'translate',value:function(){var b=_asyncToGenerator(regeneratorRuntime.mark(function i(j,b){var c,k,l,m=this,g=2<arguments.length&&void 0!==arguments[2]?arguments[2]:!0;return regeneratorRuntime.wrap(function(h){for(;;)switch(h.prev=h.next){case 0:return h.next=2,fetch(j,b);case 2:if(c=h.sent,!c.ok){h.next=11;break}return h.next=6,c.json();case 6:k=h.sent,Array.isArray(k)&&k.forEach(function(c){if('CURRENT_TIMESTAMP'===c.accessDate){var a=new Date(Date.now());c.accessDate=dateToSql(a,!0)}g&&m.addItem(c)}),l=Array.isArray(k)?COMPLETE:FAILED,h.next=19;break;case 11:if(300!==c.status){h.next=18;break}return h.next=14,c.json();case 14:k=h.sent,l=MULTIPLE_ITEMS,h.next=19;break;case 18:l=FAILED;case 19:return h.abrupt('return',{result:l,items:k,response:c});case 20:case'end':return h.stop();}},i,this)}));return function(){return b.apply(this,arguments)}}()},{key:'itemsCSL',get:function(){return this.items.map(function(b){return itemToCSLJSON(b)})}},{key:'itemsRaw',get:function(){return this.items}}],[{key:'COMPLETE',get:function(){return COMPLETE}},{key:'MULTIPLE_ITEMS',get:function(){return MULTIPLE_ITEMS}},{key:'FAILED',get:function(){return FAILED}}]),c}();module.exports=ZoteroBib;

},{"../zotero-shim/date-to-sql":14,"../zotero-shim/item-to-csl-json":17,"./defaults":9,"./utils":10}],9:[function(require,module,exports){
'use strict';module.exports=function(){return{translationServerUrl:'undefined'!=typeof window&&window.location.origin||'',translationServerPrefix:'',fetchConfig:{},initialItems:[],request:{},storage:'undefined'!=typeof window&&'localStorage'in window&&window.localStorage||{},persist:!0,override:!1,storagePrefix:'zotero-bib'}};

},{}],10:[function(require,module,exports){
'use strict';var _typeof2='function'==typeof Symbol&&'symbol'==typeof Symbol.iterator?function(a){return typeof a}:function(a){return a&&'function'==typeof Symbol&&a.constructor===Symbol&&a!==Symbol.prototype?'symbol':typeof a},_typeof='function'==typeof Symbol&&'symbol'==_typeof2(Symbol.iterator)?function(b){return'undefined'==typeof b?'undefined':_typeof2(b)}:function(b){return b&&'function'==typeof Symbol&&b.constructor===Symbol&&b!==Symbol.prototype?'symbol':'undefined'==typeof b?'undefined':_typeof2(b)};module.exports={uuid4:function(){return'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,function(d){var a=0|16*Math.random(),b='x'==d?a:8|3&a;return b.toString(16)})},isLikeZoteroItem:function(b){return b&&'object'===('undefined'==typeof b?'undefined':_typeof(b))&&'itemType'in b}};

},{}],11:[function(require,module,exports){
'use strict';require('es6-promise/auto'),require('isomorphic-fetch'),require('babel-regenerator-runtime');var ZoteroBib=require('./bib/bib');module.exports=ZoteroBib;

},{"./bib/bib":8,"babel-regenerator-runtime":1,"es6-promise/auto":2,"isomorphic-fetch":4}],12:[function(require,module,exports){
'use strict';var creatorTypes={1:'author',2:'contributor',3:'editor',4:'translator',5:'seriesEditor',6:'interviewee',7:'interviewer',8:'director',9:'scriptwriter',10:'producer',11:'castMember',12:'sponsor',13:'counsel',14:'inventor',15:'attorneyAgent',16:'recipient',17:'performer',18:'composer',19:'wordsBy',20:'cartographer',21:'programmer',22:'artist',23:'commenter',24:'presenter',25:'guest',26:'podcaster',27:'reviewedAuthor',28:'cosponsor',29:'bookAuthor'};Object.keys(creatorTypes).map(function(b){return creatorTypes[creatorTypes[b]]=b}),module.exports=creatorTypes;

},{}],13:[function(require,module,exports){
'use strict';module.exports={CSL_NAMES_MAPPINGS:{author:'author',editor:'editor',bookAuthor:'container-author',composer:'composer',director:'director',interviewer:'interviewer',recipient:'recipient',reviewedAuthor:'reviewed-author',seriesEditor:'collection-editor',translator:'translator'},CSL_TEXT_MAPPINGS:{title:['title'],"container-title":['publicationTitle','reporter','code'],"collection-title":['seriesTitle','series'],"collection-number":['seriesNumber'],publisher:['publisher','distributor'],"publisher-place":['place'],authority:['court','legislativeBody','issuingAuthority'],page:['pages'],volume:['volume','codeNumber'],issue:['issue','priorityNumbers'],"number-of-volumes":['numberOfVolumes'],"number-of-pages":['numPages'],edition:['edition'],version:['versionNumber'],section:['section','committee'],genre:['type','programmingLanguage'],source:['libraryCatalog'],dimensions:['artworkSize','runningTime'],medium:['medium','system'],scale:['scale'],archive:['archive'],archive_location:['archiveLocation'],event:['meetingName','conferenceName'],"event-place":['place'],abstract:['abstractNote'],URL:['url'],DOI:['DOI'],ISBN:['ISBN'],ISSN:['ISSN'],"call-number":['callNumber','applicationNumber'],note:['extra'],number:['number'],"chapter-number":['session'],references:['history','references'],shortTitle:['shortTitle'],journalAbbreviation:['journalAbbreviation'],status:['legalStatus'],language:['language']},CSL_DATE_MAPPINGS:{issued:'date',accessed:'accessDate',submitted:'filingDate'},CSL_TYPE_MAPPINGS:{book:'book',bookSection:'chapter',journalArticle:'article-journal',magazineArticle:'article-magazine',newspaperArticle:'article-newspaper',thesis:'thesis',encyclopediaArticle:'entry-encyclopedia',dictionaryEntry:'entry-dictionary',conferencePaper:'paper-conference',letter:'personal_communication',manuscript:'manuscript',interview:'interview',film:'motion_picture',artwork:'graphic',webpage:'webpage',report:'report',bill:'bill',case:'legal_case',hearing:'bill',patent:'patent',statute:'legislation',email:'personal_communication',map:'map',blogPost:'post-weblog',instantMessage:'personal_communication',forumPost:'post',audioRecording:'song',presentation:'speech',videoRecording:'motion_picture',tvBroadcast:'broadcast',radioBroadcast:'broadcast',podcast:'song',computerProgram:'book',document:'article',note:'article',attachment:'article'}};

},{}],14:[function(require,module,exports){
'use strict';var lpad=require('./lpad');module.exports=function(i,a){var b,c,d,e,f,g;try{return a?(b=i.getUTCFullYear(),c=i.getUTCMonth(),d=i.getUTCDate(),e=i.getUTCHours(),f=i.getUTCMinutes(),g=i.getUTCSeconds()):(b=i.getFullYear(),c=i.getMonth(),d=i.getDate(),e=i.getHours(),f=i.getMinutes(),g=i.getSeconds()),b=lpad(b,'0',4),c=lpad(c+1,'0',2),d=lpad(d,'0',2),e=lpad(e,'0',2),f=lpad(f,'0',2),g=lpad(g,'0',2),b+'-'+c+'-'+d+' '+e+':'+f+':'+g}catch(b){return''}};

},{"./lpad":19}],15:[function(require,module,exports){
'use strict';var _module$exports;function _defineProperty(d,a,b){return a in d?Object.defineProperty(d,a,{value:b,enumerable:!0,configurable:!0,writable:!0}):d[a]=b,d}var itemTypes=require('./item-types'),creatorTypes=require('./creator-types');module.exports=(_module$exports={},_defineProperty(_module$exports,itemTypes[2],creatorTypes[1]),_defineProperty(_module$exports,itemTypes[3],creatorTypes[1]),_defineProperty(_module$exports,itemTypes[4],creatorTypes[1]),_defineProperty(_module$exports,itemTypes[5],creatorTypes[1]),_defineProperty(_module$exports,itemTypes[6],creatorTypes[1]),_defineProperty(_module$exports,itemTypes[7],creatorTypes[1]),_defineProperty(_module$exports,itemTypes[8],creatorTypes[1]),_defineProperty(_module$exports,itemTypes[9],creatorTypes[1]),_defineProperty(_module$exports,itemTypes[10],creatorTypes[6]),_defineProperty(_module$exports,itemTypes[11],creatorTypes[8]),_defineProperty(_module$exports,itemTypes[12],creatorTypes[22]),_defineProperty(_module$exports,itemTypes[13],creatorTypes[1]),_defineProperty(_module$exports,itemTypes[15],creatorTypes[1]),_defineProperty(_module$exports,itemTypes[16],creatorTypes[12]),_defineProperty(_module$exports,itemTypes[17],creatorTypes[1]),_defineProperty(_module$exports,itemTypes[18],creatorTypes[2]),_defineProperty(_module$exports,itemTypes[19],creatorTypes[14]),_defineProperty(_module$exports,itemTypes[20],creatorTypes[1]),_defineProperty(_module$exports,itemTypes[21],creatorTypes[1]),_defineProperty(_module$exports,itemTypes[22],creatorTypes[20]),_defineProperty(_module$exports,itemTypes[23],creatorTypes[1]),_defineProperty(_module$exports,itemTypes[24],creatorTypes[1]),_defineProperty(_module$exports,itemTypes[25],creatorTypes[1]),_defineProperty(_module$exports,itemTypes[26],creatorTypes[17]),_defineProperty(_module$exports,itemTypes[27],creatorTypes[24]),_defineProperty(_module$exports,itemTypes[28],creatorTypes[8]),_defineProperty(_module$exports,itemTypes[29],creatorTypes[8]),_defineProperty(_module$exports,itemTypes[30],creatorTypes[8]),_defineProperty(_module$exports,itemTypes[31],creatorTypes[26]),_defineProperty(_module$exports,itemTypes[32],creatorTypes[21]),_defineProperty(_module$exports,itemTypes[33],creatorTypes[1]),_defineProperty(_module$exports,itemTypes[34],creatorTypes[1]),_defineProperty(_module$exports,itemTypes[35],creatorTypes[1]),_defineProperty(_module$exports,itemTypes[36],creatorTypes[1]),_module$exports);

},{"./creator-types":12,"./item-types":18}],16:[function(require,module,exports){
'use strict';var fields={1:'url',2:'rights',3:'series',4:'volume',5:'issue',6:'edition',7:'place',8:'publisher',10:'pages',11:'ISBN',12:'publicationTitle',13:'ISSN',14:'date',15:'section',18:'callNumber',19:'archiveLocation',21:'distributor',22:'extra',25:'journalAbbreviation',26:'DOI',27:'accessDate',28:'seriesTitle',29:'seriesText',30:'seriesNumber',31:'institution',32:'reportType',36:'code',40:'session',41:'legislativeBody',42:'history',43:'reporter',44:'court',45:'numberOfVolumes',46:'committee',48:'assignee',50:'patentNumber',51:'priorityNumbers',52:'issueDate',53:'references',54:'legalStatus',55:'codeNumber',59:'artworkMedium',60:'number',61:'artworkSize',62:'libraryCatalog',63:'videoRecordingFormat',64:'interviewMedium',65:'letterType',66:'manuscriptType',67:'mapType',68:'scale',69:'thesisType',70:'websiteType',71:'audioRecordingFormat',72:'label',74:'presentationType',75:'meetingName',76:'studio',77:'runningTime',78:'network',79:'postType',80:'audioFileType',81:'versionNumber',82:'system',83:'company',84:'conferenceName',85:'encyclopediaTitle',86:'dictionaryTitle',87:'language',88:'programmingLanguage',89:'university',90:'abstractNote',91:'websiteTitle',92:'reportNumber',93:'billNumber',94:'codeVolume',95:'codePages',96:'dateDecided',97:'reporterVolume',98:'firstPage',99:'documentNumber',100:'dateEnacted',101:'publicLawNumber',102:'country',103:'applicationNumber',104:'forumTitle',105:'episodeNumber',107:'blogTitle',108:'type',109:'medium',110:'title',111:'caseName',112:'nameOfAct',113:'subject',114:'proceedingsTitle',115:'bookTitle',116:'shortTitle',117:'docketNumber',118:'numPages',119:'programTitle',120:'issuingAuthority',121:'filingDate',122:'genre',123:'archive'};Object.keys(fields).map(function(b){return fields[fields[b]]=b}),module.exports=fields;

},{}],17:[function(require,module,exports){
'use strict';var baseMappings=require('zotero-base-mappings'),_require=require('./csl-mappings'),CSL_NAMES_MAPPINGS=_require.CSL_NAMES_MAPPINGS,CSL_TEXT_MAPPINGS=_require.CSL_TEXT_MAPPINGS,CSL_DATE_MAPPINGS=_require.CSL_DATE_MAPPINGS,CSL_TYPE_MAPPINGS=_require.CSL_TYPE_MAPPINGS,_require2=require('./type-specific-field-map'),getFieldIDFromTypeAndBase=_require2.getFieldIDFromTypeAndBase,fields=require('./fields'),itemTypes=require('./item-types'),strToDate=require('./str-to-date'),defaultItemTypeCreatorTypeLookup=require('./default-item-type-creator-type-lookup'),baseMappingsFlat=Object.keys(baseMappings).reduce(function(e,a){return Object.keys(baseMappings[a]).forEach(function(b){var c=baseMappings[a][b];e[''+a+b]=c}),e},{});module.exports=function(x){var a=CSL_TYPE_MAPPINGS[x.itemType];if(!a)throw new Error('Unexpected Zotero Item type "'+x.itemType+'"');var y=itemTypes[x.itemType],c={id:x.key,type:a};for(var d in CSL_TEXT_MAPPINGS)for(var l=CSL_TEXT_MAPPINGS[d],e=0,f=l.length;e<f;e++){var g=l[e],m=null;if(g in x)m=x[g];else{var z=baseMappingsFlat[''+x.itemType+g];m=x[z]}if(m&&'string'==typeof m){if('ISBN'==g){var o=m.match(/^(?:97[89]-?)?(?:\d-?){9}[\dx](?!-)\b/i);o&&(m=o[0])}'"'==m.charAt(0)&&m.indexOf('"',1)==m.length-1&&(m=m.substring(1,m.length-1)),c[d]=m;break}}if('attachment'!=x.type&&'note'!=x.type)for(var h=defaultItemTypeCreatorTypeLookup[y],i=x.creators,j=0;i&&j<i.length;j++){var k=i[j],p=k.creatorType,A=void 0;(p==h&&(p='author'),p=CSL_NAMES_MAPPINGS[p],!!p)&&('lastName'in k||'firstName'in k?(A={family:k.lastName||'',given:k.firstName||''},A.family&&A.given&&(1<A.family.length&&'"'==A.family.charAt(0)&&'"'==A.family.charAt(A.family.length-1)?A.family=A.family.substr(1,A.family.length-2):CSL.parseParticles(A,!0))):'name'in k&&(A={literal:k.name}),c[p]?c[p].push(A):c[p]=[A])}for(var r in CSL_DATE_MAPPINGS){var s=x[CSL_DATE_MAPPINGS[r]];if(!s){var B=getFieldIDFromTypeAndBase(y,CSL_DATE_MAPPINGS[r]);B&&(s=x[fields[B]])}if(s){var u=strToDate(s),v=[];u.year?(v.push(u.year),void 0!==u.month&&(v.push(u.month+1),u.day&&v.push(u.day)),c[r]={"date-parts":[v]},u.part&&void 0===u.month&&(c[r].season=u.part)):c[r]={literal:s}}}return c};

},{"./csl-mappings":13,"./default-item-type-creator-type-lookup":15,"./fields":16,"./item-types":18,"./str-to-date":20,"./type-specific-field-map":21,"zotero-base-mappings":7}],18:[function(require,module,exports){
'use strict';var itemTypes={1:'note',2:'book',3:'bookSection',4:'journalArticle',5:'magazineArticle',6:'newspaperArticle',7:'thesis',8:'letter',9:'manuscript',10:'interview',11:'film',12:'artwork',13:'webpage',14:'attachment',15:'report',16:'bill',17:'case',18:'hearing',19:'patent',20:'statute',21:'email',22:'map',23:'blogPost',24:'instantMessage',25:'forumPost',26:'audioRecording',27:'presentation',28:'videoRecording',29:'tvBroadcast',30:'radioBroadcast',31:'podcast',32:'computerProgram',33:'conferencePaper',34:'document',35:'encyclopediaArticle',36:'dictionaryEntry'};Object.keys(itemTypes).map(function(b){return itemTypes[itemTypes[b]]=b}),module.exports=itemTypes;

},{}],19:[function(require,module,exports){
'use strict';module.exports=function(d,a,b){for(d=d?d+'':'';d.length<b;)d=a+d;return d};

},{}],20:[function(require,module,exports){
'use strict';var dateToSQL=require('./date-to-sql'),months=['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec','january','february','march','april','may','june','july','august','september','october','november','december'],_slashRe=/^(.*?)\b([0-9]{1,4})(?:([\-\/\.\u5e74])([0-9]{1,2}))?(?:([\-\/\.\u6708])([0-9]{1,4}))?((?:\b|[^0-9]).*?)$/,_yearRe=/^(.*?)\b((?:circa |around |about |c\.? ?)?[0-9]{1,4}(?: ?B\.? ?C\.?(?: ?E\.?)?| ?C\.? ?E\.?| ?A\.? ?D\.?)|[0-9]{3,4})\b(.*?)$/i,_monthRe=new RegExp('^(.*)\\b('+months.join('|')+')[^ ]*(?: (.*)$|$)','i'),_dayRe=/\b([0-9]{1,2})(?:st|nd|rd|th)?\b(.*)/i,_insertDateOrderPart=function(f,g,b){if(!f)return g;if(!0===b.before)return g+f;if(!0===b.after)return f+g;if(b.before){var c=f.indexOf(b.before);return-1==c?f:f.replace(new RegExp('('+b.before+')'),g+'$1')}if(b.after){var d=f.indexOf(b.after);return-1==d?f+g:f.replace(new RegExp('('+b.after+')'),'$1'+g)}return f+g};module.exports=function(u){var v={order:''};if(!u)return v;var b=[],c=(u+'').toLowerCase();u='yesterday'==c?dateToSQL(new Date(Date.now()-8.64e7)).substr(0,10):'today'==c?dateToSQL(new Date).substr(0,10):'tomorrow'==c?dateToSQL(new Date(Date.now()+8.64e7)).substr(0,10):u.toString().replace(/^\s+|\s+$/g,'').replace(/\s+/,' ');var d=_slashRe.exec(u);if(d&&(!d[5]||!d[3]||d[3]==d[5]||'\u5E74'==d[3]&&'\u6708'==d[5])&&(d[2]&&d[4]&&d[6]||!d[1]&&!d[7])){if(3==d[2].length||4==d[2].length||'\u5E74'==d[3])v.year=d[2],v.month=d[4],v.day=d[6],v.order+=d[2]?'y':'',v.order+=d[4]?'m':'',v.order+=d[6]?'d':'';else if(d[2]&&!d[4]&&d[6])v.month=d[2],v.year=d[6],v.order+=d[2]?'m':'',v.order+=d[6]?'y':'';else{var e=window.navigator.language?window.navigator.language.substr(3):'US';'US'==e||'FM'==e||'PW'==e||'PH'==e?(v.month=d[2],v.day=d[4],v.order+=d[2]?'m':'',v.order+=d[4]?'d':''):(v.month=d[4],v.day=d[2],v.order+=d[2]?'d':'',v.order+=d[4]?'m':''),v.year=d[6],v.order+='y'}if(v.year&&(v.year=parseInt(v.year,10)),v.day&&(v.day=parseInt(v.day,10)),v.month&&(v.month=parseInt(v.month,10),12<v.month)){var f=v.day;v.day=v.month,v.month=f,v.order=v.order.replace('m','D').replace('d','M').replace('D','d').replace('M','m')}if((!v.month||12>=v.month)&&(!v.day||31>=v.day)){if(v.year&&100>v.year){var g=new Date,h=g.getFullYear(),j=h%100,k=h-j;v.year=v.year<=j?k+v.year:k-100+v.year}v.month?v.month--:delete v.month,b.push({part:d[1],before:!0},{part:d[7]})}else{var v={order:''};b.push({part:u})}}else b.push({part:u});if(!v.year)for(var l in b){var i=_yearRe.exec(b[l].part);if(i){v.year=i[2],v.order=_insertDateOrderPart(v.order,'y',b[l]),b.splice(l,1,{part:i[1],before:!0},{part:i[3]});break}}if(void 0===v.month)for(var p in b){var q=_monthRe.exec(b[p].part);if(q){v.month=months.indexOf(q[2].toLowerCase())%12,v.order=_insertDateOrderPart(v.order,'m',b[p]),b.splice(p,1,{part:q[1],before:'m'},{part:q[3],after:'m'});break}}if(!v.day)for(var r in b){var s=_dayRe.exec(b[r].part);if(s){var t,w=parseInt(s[1],10);if(31>=w){v.day=w,v.order=_insertDateOrderPart(v.order,'d',b[r]),0<s.index?(t=b[r].part.substr(0,s.index),s[2]&&(t+=' '+s[2])):t=s[2],b.splice(r,1,{part:t});break}}}for(var n in v.part='',b)v.part+=b[n].part+' ';return v.part&&(v.part=v.part.replace(/^[^A-Za-z0-9]+|[^A-Za-z0-9]+$/g,'')),(''===v.part||void 0==v.part)&&delete v.part,(v.year||0===v.year)&&(v.year+=''),v};

},{"./date-to-sql":14}],21:[function(require,module,exports){
'use strict';var _typeSpecificFieldMap;function _defineProperty(d,a,b){return a in d?Object.defineProperty(d,a,{value:b,enumerable:!0,configurable:!0,writable:!0}):d[a]=b,d}var fields=require('./fields'),itemTypes=require('./item-types'),typeSpecificFieldMap=(_typeSpecificFieldMap={},_defineProperty(_typeSpecificFieldMap,4100,94),_defineProperty(_typeSpecificFieldMap,4356,97),_defineProperty(_typeSpecificFieldMap,1800,89),_defineProperty(_typeSpecificFieldMap,2824,21),_defineProperty(_typeSpecificFieldMap,3848,31),_defineProperty(_typeSpecificFieldMap,6664,72),_defineProperty(_typeSpecificFieldMap,7176,76),_defineProperty(_typeSpecificFieldMap,7432,78),_defineProperty(_typeSpecificFieldMap,7688,78),_defineProperty(_typeSpecificFieldMap,8200,83),_defineProperty(_typeSpecificFieldMap,4106,95),_defineProperty(_typeSpecificFieldMap,4362,98),_defineProperty(_typeSpecificFieldMap,780,115),_defineProperty(_typeSpecificFieldMap,8460,114),_defineProperty(_typeSpecificFieldMap,3340,91),_defineProperty(_typeSpecificFieldMap,5900,107),_defineProperty(_typeSpecificFieldMap,6412,104),_defineProperty(_typeSpecificFieldMap,7436,119),_defineProperty(_typeSpecificFieldMap,7692,119),_defineProperty(_typeSpecificFieldMap,8972,85),_defineProperty(_typeSpecificFieldMap,9228,86),_defineProperty(_typeSpecificFieldMap,4366,96),_defineProperty(_typeSpecificFieldMap,4878,52),_defineProperty(_typeSpecificFieldMap,5134,100),_defineProperty(_typeSpecificFieldMap,3900,92),_defineProperty(_typeSpecificFieldMap,4156,93),_defineProperty(_typeSpecificFieldMap,4412,117),_defineProperty(_typeSpecificFieldMap,4668,99),_defineProperty(_typeSpecificFieldMap,4924,50),_defineProperty(_typeSpecificFieldMap,5180,101),_defineProperty(_typeSpecificFieldMap,7484,105),_defineProperty(_typeSpecificFieldMap,7740,105),_defineProperty(_typeSpecificFieldMap,7996,105),_defineProperty(_typeSpecificFieldMap,1900,69),_defineProperty(_typeSpecificFieldMap,2156,65),_defineProperty(_typeSpecificFieldMap,2412,66),_defineProperty(_typeSpecificFieldMap,2924,122),_defineProperty(_typeSpecificFieldMap,3436,70),_defineProperty(_typeSpecificFieldMap,3948,32),_defineProperty(_typeSpecificFieldMap,5740,67),_defineProperty(_typeSpecificFieldMap,5996,70),_defineProperty(_typeSpecificFieldMap,6508,79),_defineProperty(_typeSpecificFieldMap,7020,74),_defineProperty(_typeSpecificFieldMap,2669,64),_defineProperty(_typeSpecificFieldMap,2925,63),_defineProperty(_typeSpecificFieldMap,3181,59),_defineProperty(_typeSpecificFieldMap,6765,71),_defineProperty(_typeSpecificFieldMap,7277,63),_defineProperty(_typeSpecificFieldMap,7533,63),_defineProperty(_typeSpecificFieldMap,7789,71),_defineProperty(_typeSpecificFieldMap,8045,80),_defineProperty(_typeSpecificFieldMap,4462,111),_defineProperty(_typeSpecificFieldMap,5230,112),_defineProperty(_typeSpecificFieldMap,5486,113),_typeSpecificFieldMap);module.exports={map:typeSpecificFieldMap,getFieldIDFromTypeAndBase:function(c,d){return c='number'==typeof c?c:itemTypes[c],d='number'==typeof d?d:fields[d],typeSpecificFieldMap[(c<<8)+d]}};

},{"./fields":16,"./item-types":18}]},{},[11])(11)
});

//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJub2RlX21vZHVsZXMvYmFiZWwtcmVnZW5lcmF0b3ItcnVudGltZS9ydW50aW1lLmpzIiwibm9kZV9tb2R1bGVzL2VzNi1wcm9taXNlL2F1dG8uanMiLCJub2RlX21vZHVsZXMvZXM2LXByb21pc2UvZGlzdC9lczYtcHJvbWlzZS5qcyIsIm5vZGVfbW9kdWxlcy9pc29tb3JwaGljLWZldGNoL2ZldGNoLW5wbS1icm93c2VyaWZ5LmpzIiwibm9kZV9tb2R1bGVzL3Byb2Nlc3MvYnJvd3Nlci5qcyIsIm5vZGVfbW9kdWxlcy93aGF0d2ctZmV0Y2gvZmV0Y2guanMiLCJub2RlX21vZHVsZXMvem90ZXJvLWJhc2UtbWFwcGluZ3MvaW5kZXguanMiLCJzcmMvanMvYmliL2JpYi5qcyIsInNyYy9qcy9iaWIvZGVmYXVsdHMuanMiLCJzcmMvanMvYmliL3V0aWxzLmpzIiwic3JjL2pzL21haW4tY29tcGF0LmpzIiwic3JjL2pzL3pvdGVyby1zaGltL2NyZWF0b3ItdHlwZXMuanMiLCJzcmMvanMvem90ZXJvLXNoaW0vY3NsLW1hcHBpbmdzLmpzIiwic3JjL2pzL3pvdGVyby1zaGltL2RhdGUtdG8tc3FsLmpzIiwic3JjL2pzL3pvdGVyby1zaGltL2RlZmF1bHQtaXRlbS10eXBlLWNyZWF0b3ItdHlwZS1sb29rdXAuanMiLCJzcmMvanMvem90ZXJvLXNoaW0vZmllbGRzLmpzIiwic3JjL2pzL3pvdGVyby1zaGltL2l0ZW0tdG8tY3NsLWpzb24uanMiLCJzcmMvanMvem90ZXJvLXNoaW0vaXRlbS10eXBlcy5qcyIsInNyYy9qcy96b3Rlcm8tc2hpbS9scGFkLmpzIiwic3JjL2pzL3pvdGVyby1zaGltL3N0ci10by1kYXRlLmpzIiwic3JjL2pzL3pvdGVyby1zaGltL3R5cGUtc3BlY2lmaWMtZmllbGQtbWFwLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOztBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7O0FDanBCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7QUNKQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7OztBQzNwQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDTkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN4TEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzdjQTs7QUNBQSxhLHU5QkFFb0MsUSxBQUFBLEFBQVEsVyxBQUFwQyxlLEFBQUEsTSxBQUFPLDBCLEFBQUEsaUJBQ1QsU0FBVyxRLEFBQUEsQUFBUSxjQUNuQixjQUFnQixRLEFBQUEsQUFBUSxtQ0FD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QU5lIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24oKXtmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dmFyIGY9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKTt0aHJvdyBmLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsZn12YXIgbD1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwobC5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxsLGwuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc31yZXR1cm4gZX0pKCkiLCIvKipcbiAqIENvcHlyaWdodCAoYykgMjAxNCwgRmFjZWJvb2ssIEluYy5cbiAqIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKlxuICogVGhpcyBzb3VyY2UgY29kZSBpcyBsaWNlbnNlZCB1bmRlciB0aGUgQlNELXN0eWxlIGxpY2Vuc2UgZm91bmQgaW4gdGhlXG4gKiBodHRwczovL3Jhdy5naXRodWIuY29tL2ZhY2Vib29rL3JlZ2VuZXJhdG9yL21hc3Rlci9MSUNFTlNFIGZpbGUuIEFuXG4gKiBhZGRpdGlvbmFsIGdyYW50IG9mIHBhdGVudCByaWdodHMgY2FuIGJlIGZvdW5kIGluIHRoZSBQQVRFTlRTIGZpbGUgaW5cbiAqIHRoZSBzYW1lIGRpcmVjdG9yeS5cbiAqL1xuXG4hKGZ1bmN0aW9uKGdsb2JhbCkge1xuICBcInVzZSBzdHJpY3RcIjtcblxuICB2YXIgaGFzT3duID0gT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eTtcbiAgdmFyIHVuZGVmaW5lZDsgLy8gTW9yZSBjb21wcmVzc2libGUgdGhhbiB2b2lkIDAuXG4gIHZhciBpdGVyYXRvclN5bWJvbCA9XG4gICAgdHlwZW9mIFN5bWJvbCA9PT0gXCJmdW5jdGlvblwiICYmIFN5bWJvbC5pdGVyYXRvciB8fCBcIkBAaXRlcmF0b3JcIjtcblxuICB2YXIgaW5Nb2R1bGUgPSB0eXBlb2YgbW9kdWxlID09PSBcIm9iamVjdFwiO1xuICB2YXIgcnVudGltZSA9IGdsb2JhbC5yZWdlbmVyYXRvclJ1bnRpbWU7XG4gIGlmIChydW50aW1lKSB7XG4gICAgaWYgKGluTW9kdWxlKSB7XG4gICAgICAvLyBJZiByZWdlbmVyYXRvclJ1bnRpbWUgaXMgZGVmaW5lZCBnbG9iYWxseSBhbmQgd2UncmUgaW4gYSBtb2R1bGUsXG4gICAgICAvLyBtYWtlIHRoZSBleHBvcnRzIG9iamVjdCBpZGVudGljYWwgdG8gcmVnZW5lcmF0b3JSdW50aW1lLlxuICAgICAgbW9kdWxlLmV4cG9ydHMgPSBydW50aW1lO1xuICAgIH1cbiAgICAvLyBEb24ndCBib3RoZXIgZXZhbHVhdGluZyB0aGUgcmVzdCBvZiB0aGlzIGZpbGUgaWYgdGhlIHJ1bnRpbWUgd2FzXG4gICAgLy8gYWxyZWFkeSBkZWZpbmVkIGdsb2JhbGx5LlxuICAgIHJldHVybjtcbiAgfVxuXG4gIC8vIERlZmluZSB0aGUgcnVudGltZSBnbG9iYWxseSAoYXMgZXhwZWN0ZWQgYnkgZ2VuZXJhdGVkIGNvZGUpIGFzIGVpdGhlclxuICAvLyBtb2R1bGUuZXhwb3J0cyAoaWYgd2UncmUgaW4gYSBtb2R1bGUpIG9yIGEgbmV3LCBlbXB0eSBvYmplY3QuXG4gIHJ1bnRpbWUgPSBnbG9iYWwucmVnZW5lcmF0b3JSdW50aW1lID0gaW5Nb2R1bGUgPyBtb2R1bGUuZXhwb3J0cyA6IHt9O1xuXG4gIGZ1bmN0aW9uIHdyYXAoaW5uZXJGbiwgb3V0ZXJGbiwgc2VsZiwgdHJ5TG9jc0xpc3QpIHtcbiAgICAvLyBJZiBvdXRlckZuIHByb3ZpZGVkLCB0aGVuIG91dGVyRm4ucHJvdG90eXBlIGluc3RhbmNlb2YgR2VuZXJhdG9yLlxuICAgIHZhciBnZW5lcmF0b3IgPSBPYmplY3QuY3JlYXRlKChvdXRlckZuIHx8IEdlbmVyYXRvcikucHJvdG90eXBlKTtcbiAgICB2YXIgY29udGV4dCA9IG5ldyBDb250ZXh0KHRyeUxvY3NMaXN0IHx8IFtdKTtcblxuICAgIC8vIFRoZSAuX2ludm9rZSBtZXRob2QgdW5pZmllcyB0aGUgaW1wbGVtZW50YXRpb25zIG9mIHRoZSAubmV4dCxcbiAgICAvLyAudGhyb3csIGFuZCAucmV0dXJuIG1ldGhvZHMuXG4gICAgZ2VuZXJhdG9yLl9pbnZva2UgPSBtYWtlSW52b2tlTWV0aG9kKGlubmVyRm4sIHNlbGYsIGNvbnRleHQpO1xuXG4gICAgcmV0dXJuIGdlbmVyYXRvcjtcbiAgfVxuICBydW50aW1lLndyYXAgPSB3cmFwO1xuXG4gIC8vIFRyeS9jYXRjaCBoZWxwZXIgdG8gbWluaW1pemUgZGVvcHRpbWl6YXRpb25zLiBSZXR1cm5zIGEgY29tcGxldGlvblxuICAvLyByZWNvcmQgbGlrZSBjb250ZXh0LnRyeUVudHJpZXNbaV0uY29tcGxldGlvbi4gVGhpcyBpbnRlcmZhY2UgY291bGRcbiAgLy8gaGF2ZSBiZWVuIChhbmQgd2FzIHByZXZpb3VzbHkpIGRlc2lnbmVkIHRvIHRha2UgYSBjbG9zdXJlIHRvIGJlXG4gIC8vIGludm9rZWQgd2l0aG91dCBhcmd1bWVudHMsIGJ1dCBpbiBhbGwgdGhlIGNhc2VzIHdlIGNhcmUgYWJvdXQgd2VcbiAgLy8gYWxyZWFkeSBoYXZlIGFuIGV4aXN0aW5nIG1ldGhvZCB3ZSB3YW50IHRvIGNhbGwsIHNvIHRoZXJlJ3Mgbm8gbmVlZFxuICAvLyB0byBjcmVhdGUgYSBuZXcgZnVuY3Rpb24gb2JqZWN0LiBXZSBjYW4gZXZlbiBnZXQgYXdheSB3aXRoIGFzc3VtaW5nXG4gIC8vIHRoZSBtZXRob2QgdGFrZXMgZXhhY3RseSBvbmUgYXJndW1lbnQsIHNpbmNlIHRoYXQgaGFwcGVucyB0byBiZSB0cnVlXG4gIC8vIGluIGV2ZXJ5IGNhc2UsIHNvIHdlIGRvbid0IGhhdmUgdG8gdG91Y2ggdGhlIGFyZ3VtZW50cyBvYmplY3QuIFRoZVxuICAvLyBvbmx5IGFkZGl0aW9uYWwgYWxsb2NhdGlvbiByZXF1aXJlZCBpcyB0aGUgY29tcGxldGlvbiByZWNvcmQsIHdoaWNoXG4gIC8vIGhhcyBhIHN0YWJsZSBzaGFwZSBhbmQgc28gaG9wZWZ1bGx5IHNob3VsZCBiZSBjaGVhcCB0byBhbGxvY2F0ZS5cbiAgZnVuY3Rpb24gdHJ5Q2F0Y2goZm4sIG9iaiwgYXJnKSB7XG4gICAgdHJ5IHtcbiAgICAgIHJldHVybiB7IHR5cGU6IFwibm9ybWFsXCIsIGFyZzogZm4uY2FsbChvYmosIGFyZykgfTtcbiAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgIHJldHVybiB7IHR5cGU6IFwidGhyb3dcIiwgYXJnOiBlcnIgfTtcbiAgICB9XG4gIH1cblxuICB2YXIgR2VuU3RhdGVTdXNwZW5kZWRTdGFydCA9IFwic3VzcGVuZGVkU3RhcnRcIjtcbiAgdmFyIEdlblN0YXRlU3VzcGVuZGVkWWllbGQgPSBcInN1c3BlbmRlZFlpZWxkXCI7XG4gIHZhciBHZW5TdGF0ZUV4ZWN1dGluZyA9IFwiZXhlY3V0aW5nXCI7XG4gIHZhciBHZW5TdGF0ZUNvbXBsZXRlZCA9IFwiY29tcGxldGVkXCI7XG5cbiAgLy8gUmV0dXJuaW5nIHRoaXMgb2JqZWN0IGZyb20gdGhlIGlubmVyRm4gaGFzIHRoZSBzYW1lIGVmZmVjdCBhc1xuICAvLyBicmVha2luZyBvdXQgb2YgdGhlIGRpc3BhdGNoIHN3aXRjaCBzdGF0ZW1lbnQuXG4gIHZhciBDb250aW51ZVNlbnRpbmVsID0ge307XG5cbiAgLy8gRHVtbXkgY29uc3RydWN0b3IgZnVuY3Rpb25zIHRoYXQgd2UgdXNlIGFzIHRoZSAuY29uc3RydWN0b3IgYW5kXG4gIC8vIC5jb25zdHJ1Y3Rvci5wcm90b3R5cGUgcHJvcGVydGllcyBmb3IgZnVuY3Rpb25zIHRoYXQgcmV0dXJuIEdlbmVyYXRvclxuICAvLyBvYmplY3RzLiBGb3IgZnVsbCBzcGVjIGNvbXBsaWFuY2UsIHlvdSBtYXkgd2lzaCB0byBjb25maWd1cmUgeW91clxuICAvLyBtaW5pZmllciBub3QgdG8gbWFuZ2xlIHRoZSBuYW1lcyBvZiB0aGVzZSB0d28gZnVuY3Rpb25zLlxuICBmdW5jdGlvbiBHZW5lcmF0b3IoKSB7fVxuICBmdW5jdGlvbiBHZW5lcmF0b3JGdW5jdGlvbigpIHt9XG4gIGZ1bmN0aW9uIEdlbmVyYXRvckZ1bmN0aW9uUHJvdG90eXBlKCkge31cblxuICB2YXIgR3AgPSBHZW5lcmF0b3JGdW5jdGlvblByb3RvdHlwZS5wcm90b3R5cGUgPSBHZW5lcmF0b3IucHJvdG90eXBlO1xuICBHZW5lcmF0b3JGdW5jdGlvbi5wcm90b3R5cGUgPSBHcC5jb25zdHJ1Y3RvciA9IEdlbmVyYXRvckZ1bmN0aW9uUHJvdG90eXBlO1xuICBHZW5lcmF0b3JGdW5jdGlvblByb3RvdHlwZS5jb25zdHJ1Y3RvciA9IEdlbmVyYXRvckZ1bmN0aW9uO1xuICBHZW5lcmF0b3JGdW5jdGlvbi5kaXNwbGF5TmFtZSA9IFwiR2VuZXJhdG9yRnVuY3Rpb25cIjtcblxuICAvLyBIZWxwZXIgZm9yIGRlZmluaW5nIHRoZSAubmV4dCwgLnRocm93LCBhbmQgLnJldHVybiBtZXRob2RzIG9mIHRoZVxuICAvLyBJdGVyYXRvciBpbnRlcmZhY2UgaW4gdGVybXMgb2YgYSBzaW5nbGUgLl9pbnZva2UgbWV0aG9kLlxuICBmdW5jdGlvbiBkZWZpbmVJdGVyYXRvck1ldGhvZHMocHJvdG90eXBlKSB7XG4gICAgW1wibmV4dFwiLCBcInRocm93XCIsIFwicmV0dXJuXCJdLmZvckVhY2goZnVuY3Rpb24obWV0aG9kKSB7XG4gICAgICBwcm90b3R5cGVbbWV0aG9kXSA9IGZ1bmN0aW9uKGFyZykge1xuICAgICAgICByZXR1cm4gdGhpcy5faW52b2tlKG1ldGhvZCwgYXJnKTtcbiAgICAgIH07XG4gICAgfSk7XG4gIH1cblxuICBydW50aW1lLmlzR2VuZXJhdG9yRnVuY3Rpb24gPSBmdW5jdGlvbihnZW5GdW4pIHtcbiAgICB2YXIgY3RvciA9IHR5cGVvZiBnZW5GdW4gPT09IFwiZnVuY3Rpb25cIiAmJiBnZW5GdW4uY29uc3RydWN0b3I7XG4gICAgcmV0dXJuIGN0b3JcbiAgICAgID8gY3RvciA9PT0gR2VuZXJhdG9yRnVuY3Rpb24gfHxcbiAgICAgICAgLy8gRm9yIHRoZSBuYXRpdmUgR2VuZXJhdG9yRnVuY3Rpb24gY29uc3RydWN0b3IsIHRoZSBiZXN0IHdlIGNhblxuICAgICAgICAvLyBkbyBpcyB0byBjaGVjayBpdHMgLm5hbWUgcHJvcGVydHkuXG4gICAgICAgIChjdG9yLmRpc3BsYXlOYW1lIHx8IGN0b3IubmFtZSkgPT09IFwiR2VuZXJhdG9yRnVuY3Rpb25cIlxuICAgICAgOiBmYWxzZTtcbiAgfTtcblxuICBydW50aW1lLm1hcmsgPSBmdW5jdGlvbihnZW5GdW4pIHtcbiAgICBpZiAoT2JqZWN0LnNldFByb3RvdHlwZU9mKSB7XG4gICAgICBPYmplY3Quc2V0UHJvdG90eXBlT2YoZ2VuRnVuLCBHZW5lcmF0b3JGdW5jdGlvblByb3RvdHlwZSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGdlbkZ1bi5fX3Byb3RvX18gPSBHZW5lcmF0b3JGdW5jdGlvblByb3RvdHlwZTtcbiAgICB9XG4gICAgZ2VuRnVuLnByb3RvdHlwZSA9IE9iamVjdC5jcmVhdGUoR3ApO1xuICAgIHJldHVybiBnZW5GdW47XG4gIH07XG5cbiAgLy8gV2l0aGluIHRoZSBib2R5IG9mIGFueSBhc3luYyBmdW5jdGlvbiwgYGF3YWl0IHhgIGlzIHRyYW5zZm9ybWVkIHRvXG4gIC8vIGB5aWVsZCByZWdlbmVyYXRvclJ1bnRpbWUuYXdyYXAoeClgLCBzbyB0aGF0IHRoZSBydW50aW1lIGNhbiB0ZXN0XG4gIC8vIGB2YWx1ZSBpbnN0YW5jZW9mIEF3YWl0QXJndW1lbnRgIHRvIGRldGVybWluZSBpZiB0aGUgeWllbGRlZCB2YWx1ZSBpc1xuICAvLyBtZWFudCB0byBiZSBhd2FpdGVkLiBTb21lIG1heSBjb25zaWRlciB0aGUgbmFtZSBvZiB0aGlzIG1ldGhvZCB0b29cbiAgLy8gY3V0ZXN5LCBidXQgdGhleSBhcmUgY3VybXVkZ2VvbnMuXG4gIHJ1bnRpbWUuYXdyYXAgPSBmdW5jdGlvbihhcmcpIHtcbiAgICByZXR1cm4gbmV3IEF3YWl0QXJndW1lbnQoYXJnKTtcbiAgfTtcblxuICBmdW5jdGlvbiBBd2FpdEFyZ3VtZW50KGFyZykge1xuICAgIHRoaXMuYXJnID0gYXJnO1xuICB9XG5cbiAgZnVuY3Rpb24gQXN5bmNJdGVyYXRvcihnZW5lcmF0b3IpIHtcbiAgICAvLyBUaGlzIGludm9rZSBmdW5jdGlvbiBpcyB3cml0dGVuIGluIGEgc3R5bGUgdGhhdCBhc3N1bWVzIHNvbWVcbiAgICAvLyBjYWxsaW5nIGZ1bmN0aW9uIChvciBQcm9taXNlKSB3aWxsIGhhbmRsZSBleGNlcHRpb25zLlxuICAgIGZ1bmN0aW9uIGludm9rZShtZXRob2QsIGFyZykge1xuICAgICAgdmFyIHJlc3VsdCA9IGdlbmVyYXRvclttZXRob2RdKGFyZyk7XG4gICAgICB2YXIgdmFsdWUgPSByZXN1bHQudmFsdWU7XG4gICAgICByZXR1cm4gdmFsdWUgaW5zdGFuY2VvZiBBd2FpdEFyZ3VtZW50XG4gICAgICAgID8gUHJvbWlzZS5yZXNvbHZlKHZhbHVlLmFyZykudGhlbihpbnZva2VOZXh0LCBpbnZva2VUaHJvdylcbiAgICAgICAgOiBQcm9taXNlLnJlc29sdmUodmFsdWUpLnRoZW4oZnVuY3Rpb24odW53cmFwcGVkKSB7XG4gICAgICAgICAgICAvLyBXaGVuIGEgeWllbGRlZCBQcm9taXNlIGlzIHJlc29sdmVkLCBpdHMgZmluYWwgdmFsdWUgYmVjb21lc1xuICAgICAgICAgICAgLy8gdGhlIC52YWx1ZSBvZiB0aGUgUHJvbWlzZTx7dmFsdWUsZG9uZX0+IHJlc3VsdCBmb3IgdGhlXG4gICAgICAgICAgICAvLyBjdXJyZW50IGl0ZXJhdGlvbi4gSWYgdGhlIFByb21pc2UgaXMgcmVqZWN0ZWQsIGhvd2V2ZXIsIHRoZVxuICAgICAgICAgICAgLy8gcmVzdWx0IGZvciB0aGlzIGl0ZXJhdGlvbiB3aWxsIGJlIHJlamVjdGVkIHdpdGggdGhlIHNhbWVcbiAgICAgICAgICAgIC8vIHJlYXNvbi4gTm90ZSB0aGF0IHJlamVjdGlvbnMgb2YgeWllbGRlZCBQcm9taXNlcyBhcmUgbm90XG4gICAgICAgICAgICAvLyB0aHJvd24gYmFjayBpbnRvIHRoZSBnZW5lcmF0b3IgZnVuY3Rpb24sIGFzIGlzIHRoZSBjYXNlXG4gICAgICAgICAgICAvLyB3aGVuIGFuIGF3YWl0ZWQgUHJvbWlzZSBpcyByZWplY3RlZC4gVGhpcyBkaWZmZXJlbmNlIGluXG4gICAgICAgICAgICAvLyBiZWhhdmlvciBiZXR3ZWVuIHlpZWxkIGFuZCBhd2FpdCBpcyBpbXBvcnRhbnQsIGJlY2F1c2UgaXRcbiAgICAgICAgICAgIC8vIGFsbG93cyB0aGUgY29uc3VtZXIgdG8gZGVjaWRlIHdoYXQgdG8gZG8gd2l0aCB0aGUgeWllbGRlZFxuICAgICAgICAgICAgLy8gcmVqZWN0aW9uIChzd2FsbG93IGl0IGFuZCBjb250aW51ZSwgbWFudWFsbHkgLnRocm93IGl0IGJhY2tcbiAgICAgICAgICAgIC8vIGludG8gdGhlIGdlbmVyYXRvciwgYWJhbmRvbiBpdGVyYXRpb24sIHdoYXRldmVyKS4gV2l0aFxuICAgICAgICAgICAgLy8gYXdhaXQsIGJ5IGNvbnRyYXN0LCB0aGVyZSBpcyBubyBvcHBvcnR1bml0eSB0byBleGFtaW5lIHRoZVxuICAgICAgICAgICAgLy8gcmVqZWN0aW9uIHJlYXNvbiBvdXRzaWRlIHRoZSBnZW5lcmF0b3IgZnVuY3Rpb24sIHNvIHRoZVxuICAgICAgICAgICAgLy8gb25seSBvcHRpb24gaXMgdG8gdGhyb3cgaXQgZnJvbSB0aGUgYXdhaXQgZXhwcmVzc2lvbiwgYW5kXG4gICAgICAgICAgICAvLyBsZXQgdGhlIGdlbmVyYXRvciBmdW5jdGlvbiBoYW5kbGUgdGhlIGV4Y2VwdGlvbi5cbiAgICAgICAgICAgIHJlc3VsdC52YWx1ZSA9IHVud3JhcHBlZDtcbiAgICAgICAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgICAgICAgfSk7XG4gICAgfVxuXG4gICAgaWYgKHR5cGVvZiBwcm9jZXNzID09PSBcIm9iamVjdFwiICYmIHByb2Nlc3MuZG9tYWluKSB7XG4gICAgICBpbnZva2UgPSBwcm9jZXNzLmRvbWFpbi5iaW5kKGludm9rZSk7XG4gICAgfVxuXG4gICAgdmFyIGludm9rZU5leHQgPSBpbnZva2UuYmluZChnZW5lcmF0b3IsIFwibmV4dFwiKTtcbiAgICB2YXIgaW52b2tlVGhyb3cgPSBpbnZva2UuYmluZChnZW5lcmF0b3IsIFwidGhyb3dcIik7XG4gICAgdmFyIGludm9rZVJldHVybiA9IGludm9rZS5iaW5kKGdlbmVyYXRvciwgXCJyZXR1cm5cIik7XG4gICAgdmFyIHByZXZpb3VzUHJvbWlzZTtcblxuICAgIGZ1bmN0aW9uIGVucXVldWUobWV0aG9kLCBhcmcpIHtcbiAgICAgIGZ1bmN0aW9uIGNhbGxJbnZva2VXaXRoTWV0aG9kQW5kQXJnKCkge1xuICAgICAgICByZXR1cm4gaW52b2tlKG1ldGhvZCwgYXJnKTtcbiAgICAgIH1cblxuICAgICAgcmV0dXJuIHByZXZpb3VzUHJvbWlzZSA9XG4gICAgICAgIC8vIElmIGVucXVldWUgaGFzIGJlZW4gY2FsbGVkIGJlZm9yZSwgdGhlbiB3ZSB3YW50IHRvIHdhaXQgdW50aWxcbiAgICAgICAgLy8gYWxsIHByZXZpb3VzIFByb21pc2VzIGhhdmUgYmVlbiByZXNvbHZlZCBiZWZvcmUgY2FsbGluZyBpbnZva2UsXG4gICAgICAgIC8vIHNvIHRoYXQgcmVzdWx0cyBhcmUgYWx3YXlzIGRlbGl2ZXJlZCBpbiB0aGUgY29ycmVjdCBvcmRlci4gSWZcbiAgICAgICAgLy8gZW5xdWV1ZSBoYXMgbm90IGJlZW4gY2FsbGVkIGJlZm9yZSwgdGhlbiBpdCBpcyBpbXBvcnRhbnQgdG9cbiAgICAgICAgLy8gY2FsbCBpbnZva2UgaW1tZWRpYXRlbHksIHdpdGhvdXQgd2FpdGluZyBvbiBhIGNhbGxiYWNrIHRvIGZpcmUsXG4gICAgICAgIC8vIHNvIHRoYXQgdGhlIGFzeW5jIGdlbmVyYXRvciBmdW5jdGlvbiBoYXMgdGhlIG9wcG9ydHVuaXR5IHRvIGRvXG4gICAgICAgIC8vIGFueSBuZWNlc3Nhcnkgc2V0dXAgaW4gYSBwcmVkaWN0YWJsZSB3YXkuIFRoaXMgcHJlZGljdGFiaWxpdHlcbiAgICAgICAgLy8gaXMgd2h5IHRoZSBQcm9taXNlIGNvbnN0cnVjdG9yIHN5bmNocm9ub3VzbHkgaW52b2tlcyBpdHNcbiAgICAgICAgLy8gZXhlY3V0b3IgY2FsbGJhY2ssIGFuZCB3aHkgYXN5bmMgZnVuY3Rpb25zIHN5bmNocm9ub3VzbHlcbiAgICAgICAgLy8gZXhlY3V0ZSBjb2RlIGJlZm9yZSB0aGUgZmlyc3QgYXdhaXQuIFNpbmNlIHdlIGltcGxlbWVudCBzaW1wbGVcbiAgICAgICAgLy8gYXN5bmMgZnVuY3Rpb25zIGluIHRlcm1zIG9mIGFzeW5jIGdlbmVyYXRvcnMsIGl0IGlzIGVzcGVjaWFsbHlcbiAgICAgICAgLy8gaW1wb3J0YW50IHRvIGdldCB0aGlzIHJpZ2h0LCBldmVuIHRob3VnaCBpdCByZXF1aXJlcyBjYXJlLlxuICAgICAgICBwcmV2aW91c1Byb21pc2UgPyBwcmV2aW91c1Byb21pc2UudGhlbihcbiAgICAgICAgICBjYWxsSW52b2tlV2l0aE1ldGhvZEFuZEFyZyxcbiAgICAgICAgICAvLyBBdm9pZCBwcm9wYWdhdGluZyBmYWlsdXJlcyB0byBQcm9taXNlcyByZXR1cm5lZCBieSBsYXRlclxuICAgICAgICAgIC8vIGludm9jYXRpb25zIG9mIHRoZSBpdGVyYXRvci5cbiAgICAgICAgICBjYWxsSW52b2tlV2l0aE1ldGhvZEFuZEFyZ1xuICAgICAgICApIDogbmV3IFByb21pc2UoZnVuY3Rpb24gKHJlc29sdmUpIHtcbiAgICAgICAgICByZXNvbHZlKGNhbGxJbnZva2VXaXRoTWV0aG9kQW5kQXJnKCkpO1xuICAgICAgICB9KTtcbiAgICB9XG5cbiAgICAvLyBEZWZpbmUgdGhlIHVuaWZpZWQgaGVscGVyIG1ldGhvZCB0aGF0IGlzIHVzZWQgdG8gaW1wbGVtZW50IC5uZXh0LFxuICAgIC8vIC50aHJvdywgYW5kIC5yZXR1cm4gKHNlZSBkZWZpbmVJdGVyYXRvck1ldGhvZHMpLlxuICAgIHRoaXMuX2ludm9rZSA9IGVucXVldWU7XG4gIH1cblxuICBkZWZpbmVJdGVyYXRvck1ldGhvZHMoQXN5bmNJdGVyYXRvci5wcm90b3R5cGUpO1xuXG4gIC8vIE5vdGUgdGhhdCBzaW1wbGUgYXN5bmMgZnVuY3Rpb25zIGFyZSBpbXBsZW1lbnRlZCBvbiB0b3Agb2ZcbiAgLy8gQXN5bmNJdGVyYXRvciBvYmplY3RzOyB0aGV5IGp1c3QgcmV0dXJuIGEgUHJvbWlzZSBmb3IgdGhlIHZhbHVlIG9mXG4gIC8vIHRoZSBmaW5hbCByZXN1bHQgcHJvZHVjZWQgYnkgdGhlIGl0ZXJhdG9yLlxuICBydW50aW1lLmFzeW5jID0gZnVuY3Rpb24oaW5uZXJGbiwgb3V0ZXJGbiwgc2VsZiwgdHJ5TG9jc0xpc3QpIHtcbiAgICB2YXIgaXRlciA9IG5ldyBBc3luY0l0ZXJhdG9yKFxuICAgICAgd3JhcChpbm5lckZuLCBvdXRlckZuLCBzZWxmLCB0cnlMb2NzTGlzdClcbiAgICApO1xuXG4gICAgcmV0dXJuIHJ1bnRpbWUuaXNHZW5lcmF0b3JGdW5jdGlvbihvdXRlckZuKVxuICAgICAgPyBpdGVyIC8vIElmIG91dGVyRm4gaXMgYSBnZW5lcmF0b3IsIHJldHVybiB0aGUgZnVsbCBpdGVyYXRvci5cbiAgICAgIDogaXRlci5uZXh0KCkudGhlbihmdW5jdGlvbihyZXN1bHQpIHtcbiAgICAgICAgICByZXR1cm4gcmVzdWx0LmRvbmUgPyByZXN1bHQudmFsdWUgOiBpdGVyLm5leHQoKTtcbiAgICAgICAgfSk7XG4gIH07XG5cbiAgZnVuY3Rpb24gbWFrZUludm9rZU1ldGhvZChpbm5lckZuLCBzZWxmLCBjb250ZXh0KSB7XG4gICAgdmFyIHN0YXRlID0gR2VuU3RhdGVTdXNwZW5kZWRTdGFydDtcblxuICAgIHJldHVybiBmdW5jdGlvbiBpbnZva2UobWV0aG9kLCBhcmcpIHtcbiAgICAgIGlmIChzdGF0ZSA9PT0gR2VuU3RhdGVFeGVjdXRpbmcpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiR2VuZXJhdG9yIGlzIGFscmVhZHkgcnVubmluZ1wiKTtcbiAgICAgIH1cblxuICAgICAgaWYgKHN0YXRlID09PSBHZW5TdGF0ZUNvbXBsZXRlZCkge1xuICAgICAgICBpZiAobWV0aG9kID09PSBcInRocm93XCIpIHtcbiAgICAgICAgICB0aHJvdyBhcmc7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBCZSBmb3JnaXZpbmcsIHBlciAyNS4zLjMuMy4zIG9mIHRoZSBzcGVjOlxuICAgICAgICAvLyBodHRwczovL3Blb3BsZS5tb3ppbGxhLm9yZy9+am9yZW5kb3JmZi9lczYtZHJhZnQuaHRtbCNzZWMtZ2VuZXJhdG9ycmVzdW1lXG4gICAgICAgIHJldHVybiBkb25lUmVzdWx0KCk7XG4gICAgICB9XG5cbiAgICAgIHdoaWxlICh0cnVlKSB7XG4gICAgICAgIHZhciBkZWxlZ2F0ZSA9IGNvbnRleHQuZGVsZWdhdGU7XG4gICAgICAgIGlmIChkZWxlZ2F0ZSkge1xuICAgICAgICAgIGlmIChtZXRob2QgPT09IFwicmV0dXJuXCIgfHxcbiAgICAgICAgICAgICAgKG1ldGhvZCA9PT0gXCJ0aHJvd1wiICYmIGRlbGVnYXRlLml0ZXJhdG9yW21ldGhvZF0gPT09IHVuZGVmaW5lZCkpIHtcbiAgICAgICAgICAgIC8vIEEgcmV0dXJuIG9yIHRocm93ICh3aGVuIHRoZSBkZWxlZ2F0ZSBpdGVyYXRvciBoYXMgbm8gdGhyb3dcbiAgICAgICAgICAgIC8vIG1ldGhvZCkgYWx3YXlzIHRlcm1pbmF0ZXMgdGhlIHlpZWxkKiBsb29wLlxuICAgICAgICAgICAgY29udGV4dC5kZWxlZ2F0ZSA9IG51bGw7XG5cbiAgICAgICAgICAgIC8vIElmIHRoZSBkZWxlZ2F0ZSBpdGVyYXRvciBoYXMgYSByZXR1cm4gbWV0aG9kLCBnaXZlIGl0IGFcbiAgICAgICAgICAgIC8vIGNoYW5jZSB0byBjbGVhbiB1cC5cbiAgICAgICAgICAgIHZhciByZXR1cm5NZXRob2QgPSBkZWxlZ2F0ZS5pdGVyYXRvcltcInJldHVyblwiXTtcbiAgICAgICAgICAgIGlmIChyZXR1cm5NZXRob2QpIHtcbiAgICAgICAgICAgICAgdmFyIHJlY29yZCA9IHRyeUNhdGNoKHJldHVybk1ldGhvZCwgZGVsZWdhdGUuaXRlcmF0b3IsIGFyZyk7XG4gICAgICAgICAgICAgIGlmIChyZWNvcmQudHlwZSA9PT0gXCJ0aHJvd1wiKSB7XG4gICAgICAgICAgICAgICAgLy8gSWYgdGhlIHJldHVybiBtZXRob2QgdGhyZXcgYW4gZXhjZXB0aW9uLCBsZXQgdGhhdFxuICAgICAgICAgICAgICAgIC8vIGV4Y2VwdGlvbiBwcmV2YWlsIG92ZXIgdGhlIG9yaWdpbmFsIHJldHVybiBvciB0aHJvdy5cbiAgICAgICAgICAgICAgICBtZXRob2QgPSBcInRocm93XCI7XG4gICAgICAgICAgICAgICAgYXJnID0gcmVjb3JkLmFyZztcbiAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAobWV0aG9kID09PSBcInJldHVyblwiKSB7XG4gICAgICAgICAgICAgIC8vIENvbnRpbnVlIHdpdGggdGhlIG91dGVyIHJldHVybiwgbm93IHRoYXQgdGhlIGRlbGVnYXRlXG4gICAgICAgICAgICAgIC8vIGl0ZXJhdG9yIGhhcyBiZWVuIHRlcm1pbmF0ZWQuXG4gICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cblxuICAgICAgICAgIHZhciByZWNvcmQgPSB0cnlDYXRjaChcbiAgICAgICAgICAgIGRlbGVnYXRlLml0ZXJhdG9yW21ldGhvZF0sXG4gICAgICAgICAgICBkZWxlZ2F0ZS5pdGVyYXRvcixcbiAgICAgICAgICAgIGFyZ1xuICAgICAgICAgICk7XG5cbiAgICAgICAgICBpZiAocmVjb3JkLnR5cGUgPT09IFwidGhyb3dcIikge1xuICAgICAgICAgICAgY29udGV4dC5kZWxlZ2F0ZSA9IG51bGw7XG5cbiAgICAgICAgICAgIC8vIExpa2UgcmV0dXJuaW5nIGdlbmVyYXRvci50aHJvdyh1bmNhdWdodCksIGJ1dCB3aXRob3V0IHRoZVxuICAgICAgICAgICAgLy8gb3ZlcmhlYWQgb2YgYW4gZXh0cmEgZnVuY3Rpb24gY2FsbC5cbiAgICAgICAgICAgIG1ldGhvZCA9IFwidGhyb3dcIjtcbiAgICAgICAgICAgIGFyZyA9IHJlY29yZC5hcmc7XG4gICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICAvLyBEZWxlZ2F0ZSBnZW5lcmF0b3IgcmFuIGFuZCBoYW5kbGVkIGl0cyBvd24gZXhjZXB0aW9ucyBzb1xuICAgICAgICAgIC8vIHJlZ2FyZGxlc3Mgb2Ygd2hhdCB0aGUgbWV0aG9kIHdhcywgd2UgY29udGludWUgYXMgaWYgaXQgaXNcbiAgICAgICAgICAvLyBcIm5leHRcIiB3aXRoIGFuIHVuZGVmaW5lZCBhcmcuXG4gICAgICAgICAgbWV0aG9kID0gXCJuZXh0XCI7XG4gICAgICAgICAgYXJnID0gdW5kZWZpbmVkO1xuXG4gICAgICAgICAgdmFyIGluZm8gPSByZWNvcmQuYXJnO1xuICAgICAgICAgIGlmIChpbmZvLmRvbmUpIHtcbiAgICAgICAgICAgIGNvbnRleHRbZGVsZWdhdGUucmVzdWx0TmFtZV0gPSBpbmZvLnZhbHVlO1xuICAgICAgICAgICAgY29udGV4dC5uZXh0ID0gZGVsZWdhdGUubmV4dExvYztcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgc3RhdGUgPSBHZW5TdGF0ZVN1c3BlbmRlZFlpZWxkO1xuICAgICAgICAgICAgcmV0dXJuIGluZm87XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgY29udGV4dC5kZWxlZ2F0ZSA9IG51bGw7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAobWV0aG9kID09PSBcIm5leHRcIikge1xuICAgICAgICAgIGNvbnRleHQuX3NlbnQgPSBhcmc7XG5cbiAgICAgICAgICBpZiAoc3RhdGUgPT09IEdlblN0YXRlU3VzcGVuZGVkWWllbGQpIHtcbiAgICAgICAgICAgIGNvbnRleHQuc2VudCA9IGFyZztcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgY29udGV4dC5zZW50ID0gdW5kZWZpbmVkO1xuICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIGlmIChtZXRob2QgPT09IFwidGhyb3dcIikge1xuICAgICAgICAgIGlmIChzdGF0ZSA9PT0gR2VuU3RhdGVTdXNwZW5kZWRTdGFydCkge1xuICAgICAgICAgICAgc3RhdGUgPSBHZW5TdGF0ZUNvbXBsZXRlZDtcbiAgICAgICAgICAgIHRocm93IGFyZztcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBpZiAoY29udGV4dC5kaXNwYXRjaEV4Y2VwdGlvbihhcmcpKSB7XG4gICAgICAgICAgICAvLyBJZiB0aGUgZGlzcGF0Y2hlZCBleGNlcHRpb24gd2FzIGNhdWdodCBieSBhIGNhdGNoIGJsb2NrLFxuICAgICAgICAgICAgLy8gdGhlbiBsZXQgdGhhdCBjYXRjaCBibG9jayBoYW5kbGUgdGhlIGV4Y2VwdGlvbiBub3JtYWxseS5cbiAgICAgICAgICAgIG1ldGhvZCA9IFwibmV4dFwiO1xuICAgICAgICAgICAgYXJnID0gdW5kZWZpbmVkO1xuICAgICAgICAgIH1cblxuICAgICAgICB9IGVsc2UgaWYgKG1ldGhvZCA9PT0gXCJyZXR1cm5cIikge1xuICAgICAgICAgIGNvbnRleHQuYWJydXB0KFwicmV0dXJuXCIsIGFyZyk7XG4gICAgICAgIH1cblxuICAgICAgICBzdGF0ZSA9IEdlblN0YXRlRXhlY3V0aW5nO1xuXG4gICAgICAgIHZhciByZWNvcmQgPSB0cnlDYXRjaChpbm5lckZuLCBzZWxmLCBjb250ZXh0KTtcbiAgICAgICAgaWYgKHJlY29yZC50eXBlID09PSBcIm5vcm1hbFwiKSB7XG4gICAgICAgICAgLy8gSWYgYW4gZXhjZXB0aW9uIGlzIHRocm93biBmcm9tIGlubmVyRm4sIHdlIGxlYXZlIHN0YXRlID09PVxuICAgICAgICAgIC8vIEdlblN0YXRlRXhlY3V0aW5nIGFuZCBsb29wIGJhY2sgZm9yIGFub3RoZXIgaW52b2NhdGlvbi5cbiAgICAgICAgICBzdGF0ZSA9IGNvbnRleHQuZG9uZVxuICAgICAgICAgICAgPyBHZW5TdGF0ZUNvbXBsZXRlZFxuICAgICAgICAgICAgOiBHZW5TdGF0ZVN1c3BlbmRlZFlpZWxkO1xuXG4gICAgICAgICAgdmFyIGluZm8gPSB7XG4gICAgICAgICAgICB2YWx1ZTogcmVjb3JkLmFyZyxcbiAgICAgICAgICAgIGRvbmU6IGNvbnRleHQuZG9uZVxuICAgICAgICAgIH07XG5cbiAgICAgICAgICBpZiAocmVjb3JkLmFyZyA9PT0gQ29udGludWVTZW50aW5lbCkge1xuICAgICAgICAgICAgaWYgKGNvbnRleHQuZGVsZWdhdGUgJiYgbWV0aG9kID09PSBcIm5leHRcIikge1xuICAgICAgICAgICAgICAvLyBEZWxpYmVyYXRlbHkgZm9yZ2V0IHRoZSBsYXN0IHNlbnQgdmFsdWUgc28gdGhhdCB3ZSBkb24ndFxuICAgICAgICAgICAgICAvLyBhY2NpZGVudGFsbHkgcGFzcyBpdCBvbiB0byB0aGUgZGVsZWdhdGUuXG4gICAgICAgICAgICAgIGFyZyA9IHVuZGVmaW5lZDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcmV0dXJuIGluZm87XG4gICAgICAgICAgfVxuXG4gICAgICAgIH0gZWxzZSBpZiAocmVjb3JkLnR5cGUgPT09IFwidGhyb3dcIikge1xuICAgICAgICAgIHN0YXRlID0gR2VuU3RhdGVDb21wbGV0ZWQ7XG4gICAgICAgICAgLy8gRGlzcGF0Y2ggdGhlIGV4Y2VwdGlvbiBieSBsb29waW5nIGJhY2sgYXJvdW5kIHRvIHRoZVxuICAgICAgICAgIC8vIGNvbnRleHQuZGlzcGF0Y2hFeGNlcHRpb24oYXJnKSBjYWxsIGFib3ZlLlxuICAgICAgICAgIG1ldGhvZCA9IFwidGhyb3dcIjtcbiAgICAgICAgICBhcmcgPSByZWNvcmQuYXJnO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfTtcbiAgfVxuXG4gIC8vIERlZmluZSBHZW5lcmF0b3IucHJvdG90eXBlLntuZXh0LHRocm93LHJldHVybn0gaW4gdGVybXMgb2YgdGhlXG4gIC8vIHVuaWZpZWQgLl9pbnZva2UgaGVscGVyIG1ldGhvZC5cbiAgZGVmaW5lSXRlcmF0b3JNZXRob2RzKEdwKTtcblxuICBHcFtpdGVyYXRvclN5bWJvbF0gPSBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gdGhpcztcbiAgfTtcblxuICBHcC50b1N0cmluZyA9IGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiBcIltvYmplY3QgR2VuZXJhdG9yXVwiO1xuICB9O1xuXG4gIGZ1bmN0aW9uIHB1c2hUcnlFbnRyeShsb2NzKSB7XG4gICAgdmFyIGVudHJ5ID0geyB0cnlMb2M6IGxvY3NbMF0gfTtcblxuICAgIGlmICgxIGluIGxvY3MpIHtcbiAgICAgIGVudHJ5LmNhdGNoTG9jID0gbG9jc1sxXTtcbiAgICB9XG5cbiAgICBpZiAoMiBpbiBsb2NzKSB7XG4gICAgICBlbnRyeS5maW5hbGx5TG9jID0gbG9jc1syXTtcbiAgICAgIGVudHJ5LmFmdGVyTG9jID0gbG9jc1szXTtcbiAgICB9XG5cbiAgICB0aGlzLnRyeUVudHJpZXMucHVzaChlbnRyeSk7XG4gIH1cblxuICBmdW5jdGlvbiByZXNldFRyeUVudHJ5KGVudHJ5KSB7XG4gICAgdmFyIHJlY29yZCA9IGVudHJ5LmNvbXBsZXRpb24gfHwge307XG4gICAgcmVjb3JkLnR5cGUgPSBcIm5vcm1hbFwiO1xuICAgIGRlbGV0ZSByZWNvcmQuYXJnO1xuICAgIGVudHJ5LmNvbXBsZXRpb24gPSByZWNvcmQ7XG4gIH1cblxuICBmdW5jdGlvbiBDb250ZXh0KHRyeUxvY3NMaXN0KSB7XG4gICAgLy8gVGhlIHJvb3QgZW50cnkgb2JqZWN0IChlZmZlY3RpdmVseSBhIHRyeSBzdGF0ZW1lbnQgd2l0aG91dCBhIGNhdGNoXG4gICAgLy8gb3IgYSBmaW5hbGx5IGJsb2NrKSBnaXZlcyB1cyBhIHBsYWNlIHRvIHN0b3JlIHZhbHVlcyB0aHJvd24gZnJvbVxuICAgIC8vIGxvY2F0aW9ucyB3aGVyZSB0aGVyZSBpcyBubyBlbmNsb3NpbmcgdHJ5IHN0YXRlbWVudC5cbiAgICB0aGlzLnRyeUVudHJpZXMgPSBbeyB0cnlMb2M6IFwicm9vdFwiIH1dO1xuICAgIHRyeUxvY3NMaXN0LmZvckVhY2gocHVzaFRyeUVudHJ5LCB0aGlzKTtcbiAgICB0aGlzLnJlc2V0KHRydWUpO1xuICB9XG5cbiAgcnVudGltZS5rZXlzID0gZnVuY3Rpb24ob2JqZWN0KSB7XG4gICAgdmFyIGtleXMgPSBbXTtcbiAgICBmb3IgKHZhciBrZXkgaW4gb2JqZWN0KSB7XG4gICAgICBrZXlzLnB1c2goa2V5KTtcbiAgICB9XG4gICAga2V5cy5yZXZlcnNlKCk7XG5cbiAgICAvLyBSYXRoZXIgdGhhbiByZXR1cm5pbmcgYW4gb2JqZWN0IHdpdGggYSBuZXh0IG1ldGhvZCwgd2Uga2VlcFxuICAgIC8vIHRoaW5ncyBzaW1wbGUgYW5kIHJldHVybiB0aGUgbmV4dCBmdW5jdGlvbiBpdHNlbGYuXG4gICAgcmV0dXJuIGZ1bmN0aW9uIG5leHQoKSB7XG4gICAgICB3aGlsZSAoa2V5cy5sZW5ndGgpIHtcbiAgICAgICAgdmFyIGtleSA9IGtleXMucG9wKCk7XG4gICAgICAgIGlmIChrZXkgaW4gb2JqZWN0KSB7XG4gICAgICAgICAgbmV4dC52YWx1ZSA9IGtleTtcbiAgICAgICAgICBuZXh0LmRvbmUgPSBmYWxzZTtcbiAgICAgICAgICByZXR1cm4gbmV4dDtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICAvLyBUbyBhdm9pZCBjcmVhdGluZyBhbiBhZGRpdGlvbmFsIG9iamVjdCwgd2UganVzdCBoYW5nIHRoZSAudmFsdWVcbiAgICAgIC8vIGFuZCAuZG9uZSBwcm9wZXJ0aWVzIG9mZiB0aGUgbmV4dCBmdW5jdGlvbiBvYmplY3QgaXRzZWxmLiBUaGlzXG4gICAgICAvLyBhbHNvIGVuc3VyZXMgdGhhdCB0aGUgbWluaWZpZXIgd2lsbCBub3QgYW5vbnltaXplIHRoZSBmdW5jdGlvbi5cbiAgICAgIG5leHQuZG9uZSA9IHRydWU7XG4gICAgICByZXR1cm4gbmV4dDtcbiAgICB9O1xuICB9O1xuXG4gIGZ1bmN0aW9uIHZhbHVlcyhpdGVyYWJsZSkge1xuICAgIGlmIChpdGVyYWJsZSkge1xuICAgICAgdmFyIGl0ZXJhdG9yTWV0aG9kID0gaXRlcmFibGVbaXRlcmF0b3JTeW1ib2xdO1xuICAgICAgaWYgKGl0ZXJhdG9yTWV0aG9kKSB7XG4gICAgICAgIHJldHVybiBpdGVyYXRvck1ldGhvZC5jYWxsKGl0ZXJhYmxlKTtcbiAgICAgIH1cblxuICAgICAgaWYgKHR5cGVvZiBpdGVyYWJsZS5uZXh0ID09PSBcImZ1bmN0aW9uXCIpIHtcbiAgICAgICAgcmV0dXJuIGl0ZXJhYmxlO1xuICAgICAgfVxuXG4gICAgICBpZiAoIWlzTmFOKGl0ZXJhYmxlLmxlbmd0aCkpIHtcbiAgICAgICAgdmFyIGkgPSAtMSwgbmV4dCA9IGZ1bmN0aW9uIG5leHQoKSB7XG4gICAgICAgICAgd2hpbGUgKCsraSA8IGl0ZXJhYmxlLmxlbmd0aCkge1xuICAgICAgICAgICAgaWYgKGhhc093bi5jYWxsKGl0ZXJhYmxlLCBpKSkge1xuICAgICAgICAgICAgICBuZXh0LnZhbHVlID0gaXRlcmFibGVbaV07XG4gICAgICAgICAgICAgIG5leHQuZG9uZSA9IGZhbHNlO1xuICAgICAgICAgICAgICByZXR1cm4gbmV4dDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG5cbiAgICAgICAgICBuZXh0LnZhbHVlID0gdW5kZWZpbmVkO1xuICAgICAgICAgIG5leHQuZG9uZSA9IHRydWU7XG5cbiAgICAgICAgICByZXR1cm4gbmV4dDtcbiAgICAgICAgfTtcblxuICAgICAgICByZXR1cm4gbmV4dC5uZXh0ID0gbmV4dDtcbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBSZXR1cm4gYW4gaXRlcmF0b3Igd2l0aCBubyB2YWx1ZXMuXG4gICAgcmV0dXJuIHsgbmV4dDogZG9uZVJlc3VsdCB9O1xuICB9XG4gIHJ1bnRpbWUudmFsdWVzID0gdmFsdWVzO1xuXG4gIGZ1bmN0aW9uIGRvbmVSZXN1bHQoKSB7XG4gICAgcmV0dXJuIHsgdmFsdWU6IHVuZGVmaW5lZCwgZG9uZTogdHJ1ZSB9O1xuICB9XG5cbiAgQ29udGV4dC5wcm90b3R5cGUgPSB7XG4gICAgY29uc3RydWN0b3I6IENvbnRleHQsXG5cbiAgICByZXNldDogZnVuY3Rpb24oc2tpcFRlbXBSZXNldCkge1xuICAgICAgdGhpcy5wcmV2ID0gMDtcbiAgICAgIHRoaXMubmV4dCA9IDA7XG4gICAgICB0aGlzLnNlbnQgPSB1bmRlZmluZWQ7XG4gICAgICB0aGlzLmRvbmUgPSBmYWxzZTtcbiAgICAgIHRoaXMuZGVsZWdhdGUgPSBudWxsO1xuXG4gICAgICB0aGlzLnRyeUVudHJpZXMuZm9yRWFjaChyZXNldFRyeUVudHJ5KTtcblxuICAgICAgaWYgKCFza2lwVGVtcFJlc2V0KSB7XG4gICAgICAgIGZvciAodmFyIG5hbWUgaW4gdGhpcykge1xuICAgICAgICAgIC8vIE5vdCBzdXJlIGFib3V0IHRoZSBvcHRpbWFsIG9yZGVyIG9mIHRoZXNlIGNvbmRpdGlvbnM6XG4gICAgICAgICAgaWYgKG5hbWUuY2hhckF0KDApID09PSBcInRcIiAmJlxuICAgICAgICAgICAgICBoYXNPd24uY2FsbCh0aGlzLCBuYW1lKSAmJlxuICAgICAgICAgICAgICAhaXNOYU4oK25hbWUuc2xpY2UoMSkpKSB7XG4gICAgICAgICAgICB0aGlzW25hbWVdID0gdW5kZWZpbmVkO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0sXG5cbiAgICBzdG9wOiBmdW5jdGlvbigpIHtcbiAgICAgIHRoaXMuZG9uZSA9IHRydWU7XG5cbiAgICAgIHZhciByb290RW50cnkgPSB0aGlzLnRyeUVudHJpZXNbMF07XG4gICAgICB2YXIgcm9vdFJlY29yZCA9IHJvb3RFbnRyeS5jb21wbGV0aW9uO1xuICAgICAgaWYgKHJvb3RSZWNvcmQudHlwZSA9PT0gXCJ0aHJvd1wiKSB7XG4gICAgICAgIHRocm93IHJvb3RSZWNvcmQuYXJnO1xuICAgICAgfVxuXG4gICAgICByZXR1cm4gdGhpcy5ydmFsO1xuICAgIH0sXG5cbiAgICBkaXNwYXRjaEV4Y2VwdGlvbjogZnVuY3Rpb24oZXhjZXB0aW9uKSB7XG4gICAgICBpZiAodGhpcy5kb25lKSB7XG4gICAgICAgIHRocm93IGV4Y2VwdGlvbjtcbiAgICAgIH1cblxuICAgICAgdmFyIGNvbnRleHQgPSB0aGlzO1xuICAgICAgZnVuY3Rpb24gaGFuZGxlKGxvYywgY2F1Z2h0KSB7XG4gICAgICAgIHJlY29yZC50eXBlID0gXCJ0aHJvd1wiO1xuICAgICAgICByZWNvcmQuYXJnID0gZXhjZXB0aW9uO1xuICAgICAgICBjb250ZXh0Lm5leHQgPSBsb2M7XG4gICAgICAgIHJldHVybiAhIWNhdWdodDtcbiAgICAgIH1cblxuICAgICAgZm9yICh2YXIgaSA9IHRoaXMudHJ5RW50cmllcy5sZW5ndGggLSAxOyBpID49IDA7IC0taSkge1xuICAgICAgICB2YXIgZW50cnkgPSB0aGlzLnRyeUVudHJpZXNbaV07XG4gICAgICAgIHZhciByZWNvcmQgPSBlbnRyeS5jb21wbGV0aW9uO1xuXG4gICAgICAgIGlmIChlbnRyeS50cnlMb2MgPT09IFwicm9vdFwiKSB7XG4gICAgICAgICAgLy8gRXhjZXB0aW9uIHRocm93biBvdXRzaWRlIG9mIGFueSB0cnkgYmxvY2sgdGhhdCBjb3VsZCBoYW5kbGVcbiAgICAgICAgICAvLyBpdCwgc28gc2V0IHRoZSBjb21wbGV0aW9uIHZhbHVlIG9mIHRoZSBlbnRpcmUgZnVuY3Rpb24gdG9cbiAgICAgICAgICAvLyB0aHJvdyB0aGUgZXhjZXB0aW9uLlxuICAgICAgICAgIHJldHVybiBoYW5kbGUoXCJlbmRcIik7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoZW50cnkudHJ5TG9jIDw9IHRoaXMucHJldikge1xuICAgICAgICAgIHZhciBoYXNDYXRjaCA9IGhhc093bi5jYWxsKGVudHJ5LCBcImNhdGNoTG9jXCIpO1xuICAgICAgICAgIHZhciBoYXNGaW5hbGx5ID0gaGFzT3duLmNhbGwoZW50cnksIFwiZmluYWxseUxvY1wiKTtcblxuICAgICAgICAgIGlmIChoYXNDYXRjaCAmJiBoYXNGaW5hbGx5KSB7XG4gICAgICAgICAgICBpZiAodGhpcy5wcmV2IDwgZW50cnkuY2F0Y2hMb2MpIHtcbiAgICAgICAgICAgICAgcmV0dXJuIGhhbmRsZShlbnRyeS5jYXRjaExvYywgdHJ1ZSk7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKHRoaXMucHJldiA8IGVudHJ5LmZpbmFsbHlMb2MpIHtcbiAgICAgICAgICAgICAgcmV0dXJuIGhhbmRsZShlbnRyeS5maW5hbGx5TG9jKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgIH0gZWxzZSBpZiAoaGFzQ2F0Y2gpIHtcbiAgICAgICAgICAgIGlmICh0aGlzLnByZXYgPCBlbnRyeS5jYXRjaExvYykge1xuICAgICAgICAgICAgICByZXR1cm4gaGFuZGxlKGVudHJ5LmNhdGNoTG9jLCB0cnVlKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgIH0gZWxzZSBpZiAoaGFzRmluYWxseSkge1xuICAgICAgICAgICAgaWYgKHRoaXMucHJldiA8IGVudHJ5LmZpbmFsbHlMb2MpIHtcbiAgICAgICAgICAgICAgcmV0dXJuIGhhbmRsZShlbnRyeS5maW5hbGx5TG9jKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJ0cnkgc3RhdGVtZW50IHdpdGhvdXQgY2F0Y2ggb3IgZmluYWxseVwiKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9LFxuXG4gICAgYWJydXB0OiBmdW5jdGlvbih0eXBlLCBhcmcpIHtcbiAgICAgIGZvciAodmFyIGkgPSB0aGlzLnRyeUVudHJpZXMubGVuZ3RoIC0gMTsgaSA+PSAwOyAtLWkpIHtcbiAgICAgICAgdmFyIGVudHJ5ID0gdGhpcy50cnlFbnRyaWVzW2ldO1xuICAgICAgICBpZiAoZW50cnkudHJ5TG9jIDw9IHRoaXMucHJldiAmJlxuICAgICAgICAgICAgaGFzT3duLmNhbGwoZW50cnksIFwiZmluYWxseUxvY1wiKSAmJlxuICAgICAgICAgICAgdGhpcy5wcmV2IDwgZW50cnkuZmluYWxseUxvYykge1xuICAgICAgICAgIHZhciBmaW5hbGx5RW50cnkgPSBlbnRyeTtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICBpZiAoZmluYWxseUVudHJ5ICYmXG4gICAgICAgICAgKHR5cGUgPT09IFwiYnJlYWtcIiB8fFxuICAgICAgICAgICB0eXBlID09PSBcImNvbnRpbnVlXCIpICYmXG4gICAgICAgICAgZmluYWxseUVudHJ5LnRyeUxvYyA8PSBhcmcgJiZcbiAgICAgICAgICBhcmcgPD0gZmluYWxseUVudHJ5LmZpbmFsbHlMb2MpIHtcbiAgICAgICAgLy8gSWdub3JlIHRoZSBmaW5hbGx5IGVudHJ5IGlmIGNvbnRyb2wgaXMgbm90IGp1bXBpbmcgdG8gYVxuICAgICAgICAvLyBsb2NhdGlvbiBvdXRzaWRlIHRoZSB0cnkvY2F0Y2ggYmxvY2suXG4gICAgICAgIGZpbmFsbHlFbnRyeSA9IG51bGw7XG4gICAgICB9XG5cbiAgICAgIHZhciByZWNvcmQgPSBmaW5hbGx5RW50cnkgPyBmaW5hbGx5RW50cnkuY29tcGxldGlvbiA6IHt9O1xuICAgICAgcmVjb3JkLnR5cGUgPSB0eXBlO1xuICAgICAgcmVjb3JkLmFyZyA9IGFyZztcblxuICAgICAgaWYgKGZpbmFsbHlFbnRyeSkge1xuICAgICAgICB0aGlzLm5leHQgPSBmaW5hbGx5RW50cnkuZmluYWxseUxvYztcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMuY29tcGxldGUocmVjb3JkKTtcbiAgICAgIH1cblxuICAgICAgcmV0dXJuIENvbnRpbnVlU2VudGluZWw7XG4gICAgfSxcblxuICAgIGNvbXBsZXRlOiBmdW5jdGlvbihyZWNvcmQsIGFmdGVyTG9jKSB7XG4gICAgICBpZiAocmVjb3JkLnR5cGUgPT09IFwidGhyb3dcIikge1xuICAgICAgICB0aHJvdyByZWNvcmQuYXJnO1xuICAgICAgfVxuXG4gICAgICBpZiAocmVjb3JkLnR5cGUgPT09IFwiYnJlYWtcIiB8fFxuICAgICAgICAgIHJlY29yZC50eXBlID09PSBcImNvbnRpbnVlXCIpIHtcbiAgICAgICAgdGhpcy5uZXh0ID0gcmVjb3JkLmFyZztcbiAgICAgIH0gZWxzZSBpZiAocmVjb3JkLnR5cGUgPT09IFwicmV0dXJuXCIpIHtcbiAgICAgICAgdGhpcy5ydmFsID0gcmVjb3JkLmFyZztcbiAgICAgICAgdGhpcy5uZXh0ID0gXCJlbmRcIjtcbiAgICAgIH0gZWxzZSBpZiAocmVjb3JkLnR5cGUgPT09IFwibm9ybWFsXCIgJiYgYWZ0ZXJMb2MpIHtcbiAgICAgICAgdGhpcy5uZXh0ID0gYWZ0ZXJMb2M7XG4gICAgICB9XG4gICAgfSxcblxuICAgIGZpbmlzaDogZnVuY3Rpb24oZmluYWxseUxvYykge1xuICAgICAgZm9yICh2YXIgaSA9IHRoaXMudHJ5RW50cmllcy5sZW5ndGggLSAxOyBpID49IDA7IC0taSkge1xuICAgICAgICB2YXIgZW50cnkgPSB0aGlzLnRyeUVudHJpZXNbaV07XG4gICAgICAgIGlmIChlbnRyeS5maW5hbGx5TG9jID09PSBmaW5hbGx5TG9jKSB7XG4gICAgICAgICAgdGhpcy5jb21wbGV0ZShlbnRyeS5jb21wbGV0aW9uLCBlbnRyeS5hZnRlckxvYyk7XG4gICAgICAgICAgcmVzZXRUcnlFbnRyeShlbnRyeSk7XG4gICAgICAgICAgcmV0dXJuIENvbnRpbnVlU2VudGluZWw7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9LFxuXG4gICAgXCJjYXRjaFwiOiBmdW5jdGlvbih0cnlMb2MpIHtcbiAgICAgIGZvciAodmFyIGkgPSB0aGlzLnRyeUVudHJpZXMubGVuZ3RoIC0gMTsgaSA+PSAwOyAtLWkpIHtcbiAgICAgICAgdmFyIGVudHJ5ID0gdGhpcy50cnlFbnRyaWVzW2ldO1xuICAgICAgICBpZiAoZW50cnkudHJ5TG9jID09PSB0cnlMb2MpIHtcbiAgICAgICAgICB2YXIgcmVjb3JkID0gZW50cnkuY29tcGxldGlvbjtcbiAgICAgICAgICBpZiAocmVjb3JkLnR5cGUgPT09IFwidGhyb3dcIikge1xuICAgICAgICAgICAgdmFyIHRocm93biA9IHJlY29yZC5hcmc7XG4gICAgICAgICAgICByZXNldFRyeUVudHJ5KGVudHJ5KTtcbiAgICAgICAgICB9XG4gICAgICAgICAgcmV0dXJuIHRocm93bjtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICAvLyBUaGUgY29udGV4dC5jYXRjaCBtZXRob2QgbXVzdCBvbmx5IGJlIGNhbGxlZCB3aXRoIGEgbG9jYXRpb25cbiAgICAgIC8vIGFyZ3VtZW50IHRoYXQgY29ycmVzcG9uZHMgdG8gYSBrbm93biBjYXRjaCBibG9jay5cbiAgICAgIHRocm93IG5ldyBFcnJvcihcImlsbGVnYWwgY2F0Y2ggYXR0ZW1wdFwiKTtcbiAgICB9LFxuXG4gICAgZGVsZWdhdGVZaWVsZDogZnVuY3Rpb24oaXRlcmFibGUsIHJlc3VsdE5hbWUsIG5leHRMb2MpIHtcbiAgICAgIHRoaXMuZGVsZWdhdGUgPSB7XG4gICAgICAgIGl0ZXJhdG9yOiB2YWx1ZXMoaXRlcmFibGUpLFxuICAgICAgICByZXN1bHROYW1lOiByZXN1bHROYW1lLFxuICAgICAgICBuZXh0TG9jOiBuZXh0TG9jXG4gICAgICB9O1xuXG4gICAgICByZXR1cm4gQ29udGludWVTZW50aW5lbDtcbiAgICB9XG4gIH07XG59KShcbiAgLy8gQW1vbmcgdGhlIHZhcmlvdXMgdHJpY2tzIGZvciBvYnRhaW5pbmcgYSByZWZlcmVuY2UgdG8gdGhlIGdsb2JhbFxuICAvLyBvYmplY3QsIHRoaXMgc2VlbXMgdG8gYmUgdGhlIG1vc3QgcmVsaWFibGUgdGVjaG5pcXVlIHRoYXQgZG9lcyBub3RcbiAgLy8gdXNlIGluZGlyZWN0IGV2YWwgKHdoaWNoIHZpb2xhdGVzIENvbnRlbnQgU2VjdXJpdHkgUG9saWN5KS5cbiAgdHlwZW9mIGdsb2JhbCA9PT0gXCJvYmplY3RcIiA/IGdsb2JhbCA6XG4gIHR5cGVvZiB3aW5kb3cgPT09IFwib2JqZWN0XCIgPyB3aW5kb3cgOlxuICB0eXBlb2Ygc2VsZiA9PT0gXCJvYmplY3RcIiA/IHNlbGYgOiB0aGlzXG4pO1xuIiwiLy8gVGhpcyBmaWxlIGNhbiBiZSByZXF1aXJlZCBpbiBCcm93c2VyaWZ5IGFuZCBOb2RlLmpzIGZvciBhdXRvbWF0aWMgcG9seWZpbGxcbi8vIFRvIHVzZSBpdDogIHJlcXVpcmUoJ2VzNi1wcm9taXNlL2F1dG8nKTtcbid1c2Ugc3RyaWN0Jztcbm1vZHVsZS5leHBvcnRzID0gcmVxdWlyZSgnLi8nKS5wb2x5ZmlsbCgpO1xuIiwiLyohXG4gKiBAb3ZlcnZpZXcgZXM2LXByb21pc2UgLSBhIHRpbnkgaW1wbGVtZW50YXRpb24gb2YgUHJvbWlzZXMvQSsuXG4gKiBAY29weXJpZ2h0IENvcHlyaWdodCAoYykgMjAxNCBZZWh1ZGEgS2F0eiwgVG9tIERhbGUsIFN0ZWZhbiBQZW5uZXIgYW5kIGNvbnRyaWJ1dG9ycyAoQ29udmVyc2lvbiB0byBFUzYgQVBJIGJ5IEpha2UgQXJjaGliYWxkKVxuICogQGxpY2Vuc2UgICBMaWNlbnNlZCB1bmRlciBNSVQgbGljZW5zZVxuICogICAgICAgICAgICBTZWUgaHR0cHM6Ly9yYXcuZ2l0aHVidXNlcmNvbnRlbnQuY29tL3N0ZWZhbnBlbm5lci9lczYtcHJvbWlzZS9tYXN0ZXIvTElDRU5TRVxuICogQHZlcnNpb24gICB2NC4yLjQrMzE0ZTQ4MzFcbiAqL1xuXG4oZnVuY3Rpb24gKGdsb2JhbCwgZmFjdG9yeSkge1xuXHR0eXBlb2YgZXhwb3J0cyA9PT0gJ29iamVjdCcgJiYgdHlwZW9mIG1vZHVsZSAhPT0gJ3VuZGVmaW5lZCcgPyBtb2R1bGUuZXhwb3J0cyA9IGZhY3RvcnkoKSA6XG5cdHR5cGVvZiBkZWZpbmUgPT09ICdmdW5jdGlvbicgJiYgZGVmaW5lLmFtZCA/IGRlZmluZShmYWN0b3J5KSA6XG5cdChnbG9iYWwuRVM2UHJvbWlzZSA9IGZhY3RvcnkoKSk7XG59KHRoaXMsIChmdW5jdGlvbiAoKSB7ICd1c2Ugc3RyaWN0JztcblxuZnVuY3Rpb24gb2JqZWN0T3JGdW5jdGlvbih4KSB7XG4gIHZhciB0eXBlID0gdHlwZW9mIHg7XG4gIHJldHVybiB4ICE9PSBudWxsICYmICh0eXBlID09PSAnb2JqZWN0JyB8fCB0eXBlID09PSAnZnVuY3Rpb24nKTtcbn1cblxuZnVuY3Rpb24gaXNGdW5jdGlvbih4KSB7XG4gIHJldHVybiB0eXBlb2YgeCA9PT0gJ2Z1bmN0aW9uJztcbn1cblxuXG5cbnZhciBfaXNBcnJheSA9IHZvaWQgMDtcbmlmIChBcnJheS5pc0FycmF5KSB7XG4gIF9pc0FycmF5ID0gQXJyYXkuaXNBcnJheTtcbn0gZWxzZSB7XG4gIF9pc0FycmF5ID0gZnVuY3Rpb24gKHgpIHtcbiAgICByZXR1cm4gT2JqZWN0LnByb3RvdHlwZS50b1N0cmluZy5jYWxsKHgpID09PSAnW29iamVjdCBBcnJheV0nO1xuICB9O1xufVxuXG52YXIgaXNBcnJheSA9IF9pc0FycmF5O1xuXG52YXIgbGVuID0gMDtcbnZhciB2ZXJ0eE5leHQgPSB2b2lkIDA7XG52YXIgY3VzdG9tU2NoZWR1bGVyRm4gPSB2b2lkIDA7XG5cbnZhciBhc2FwID0gZnVuY3Rpb24gYXNhcChjYWxsYmFjaywgYXJnKSB7XG4gIHF1ZXVlW2xlbl0gPSBjYWxsYmFjaztcbiAgcXVldWVbbGVuICsgMV0gPSBhcmc7XG4gIGxlbiArPSAyO1xuICBpZiAobGVuID09PSAyKSB7XG4gICAgLy8gSWYgbGVuIGlzIDIsIHRoYXQgbWVhbnMgdGhhdCB3ZSBuZWVkIHRvIHNjaGVkdWxlIGFuIGFzeW5jIGZsdXNoLlxuICAgIC8vIElmIGFkZGl0aW9uYWwgY2FsbGJhY2tzIGFyZSBxdWV1ZWQgYmVmb3JlIHRoZSBxdWV1ZSBpcyBmbHVzaGVkLCB0aGV5XG4gICAgLy8gd2lsbCBiZSBwcm9jZXNzZWQgYnkgdGhpcyBmbHVzaCB0aGF0IHdlIGFyZSBzY2hlZHVsaW5nLlxuICAgIGlmIChjdXN0b21TY2hlZHVsZXJGbikge1xuICAgICAgY3VzdG9tU2NoZWR1bGVyRm4oZmx1c2gpO1xuICAgIH0gZWxzZSB7XG4gICAgICBzY2hlZHVsZUZsdXNoKCk7XG4gICAgfVxuICB9XG59O1xuXG5mdW5jdGlvbiBzZXRTY2hlZHVsZXIoc2NoZWR1bGVGbikge1xuICBjdXN0b21TY2hlZHVsZXJGbiA9IHNjaGVkdWxlRm47XG59XG5cbmZ1bmN0aW9uIHNldEFzYXAoYXNhcEZuKSB7XG4gIGFzYXAgPSBhc2FwRm47XG59XG5cbnZhciBicm93c2VyV2luZG93ID0gdHlwZW9mIHdpbmRvdyAhPT0gJ3VuZGVmaW5lZCcgPyB3aW5kb3cgOiB1bmRlZmluZWQ7XG52YXIgYnJvd3Nlckdsb2JhbCA9IGJyb3dzZXJXaW5kb3cgfHwge307XG52YXIgQnJvd3Nlck11dGF0aW9uT2JzZXJ2ZXIgPSBicm93c2VyR2xvYmFsLk11dGF0aW9uT2JzZXJ2ZXIgfHwgYnJvd3Nlckdsb2JhbC5XZWJLaXRNdXRhdGlvbk9ic2VydmVyO1xudmFyIGlzTm9kZSA9IHR5cGVvZiBzZWxmID09PSAndW5kZWZpbmVkJyAmJiB0eXBlb2YgcHJvY2VzcyAhPT0gJ3VuZGVmaW5lZCcgJiYge30udG9TdHJpbmcuY2FsbChwcm9jZXNzKSA9PT0gJ1tvYmplY3QgcHJvY2Vzc10nO1xuXG4vLyB0ZXN0IGZvciB3ZWIgd29ya2VyIGJ1dCBub3QgaW4gSUUxMFxudmFyIGlzV29ya2VyID0gdHlwZW9mIFVpbnQ4Q2xhbXBlZEFycmF5ICE9PSAndW5kZWZpbmVkJyAmJiB0eXBlb2YgaW1wb3J0U2NyaXB0cyAhPT0gJ3VuZGVmaW5lZCcgJiYgdHlwZW9mIE1lc3NhZ2VDaGFubmVsICE9PSAndW5kZWZpbmVkJztcblxuLy8gbm9kZVxuZnVuY3Rpb24gdXNlTmV4dFRpY2soKSB7XG4gIC8vIG5vZGUgdmVyc2lvbiAwLjEwLnggZGlzcGxheXMgYSBkZXByZWNhdGlvbiB3YXJuaW5nIHdoZW4gbmV4dFRpY2sgaXMgdXNlZCByZWN1cnNpdmVseVxuICAvLyBzZWUgaHR0cHM6Ly9naXRodWIuY29tL2N1am9qcy93aGVuL2lzc3Vlcy80MTAgZm9yIGRldGFpbHNcbiAgcmV0dXJuIGZ1bmN0aW9uICgpIHtcbiAgICByZXR1cm4gcHJvY2Vzcy5uZXh0VGljayhmbHVzaCk7XG4gIH07XG59XG5cbi8vIHZlcnR4XG5mdW5jdGlvbiB1c2VWZXJ0eFRpbWVyKCkge1xuICBpZiAodHlwZW9mIHZlcnR4TmV4dCAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICByZXR1cm4gZnVuY3Rpb24gKCkge1xuICAgICAgdmVydHhOZXh0KGZsdXNoKTtcbiAgICB9O1xuICB9XG5cbiAgcmV0dXJuIHVzZVNldFRpbWVvdXQoKTtcbn1cblxuZnVuY3Rpb24gdXNlTXV0YXRpb25PYnNlcnZlcigpIHtcbiAgdmFyIGl0ZXJhdGlvbnMgPSAwO1xuICB2YXIgb2JzZXJ2ZXIgPSBuZXcgQnJvd3Nlck11dGF0aW9uT2JzZXJ2ZXIoZmx1c2gpO1xuICB2YXIgbm9kZSA9IGRvY3VtZW50LmNyZWF0ZVRleHROb2RlKCcnKTtcbiAgb2JzZXJ2ZXIub2JzZXJ2ZShub2RlLCB7IGNoYXJhY3RlckRhdGE6IHRydWUgfSk7XG5cbiAgcmV0dXJuIGZ1bmN0aW9uICgpIHtcbiAgICBub2RlLmRhdGEgPSBpdGVyYXRpb25zID0gKytpdGVyYXRpb25zICUgMjtcbiAgfTtcbn1cblxuLy8gd2ViIHdvcmtlclxuZnVuY3Rpb24gdXNlTWVzc2FnZUNoYW5uZWwoKSB7XG4gIHZhciBjaGFubmVsID0gbmV3IE1lc3NhZ2VDaGFubmVsKCk7XG4gIGNoYW5uZWwucG9ydDEub25tZXNzYWdlID0gZmx1c2g7XG4gIHJldHVybiBmdW5jdGlvbiAoKSB7XG4gICAgcmV0dXJuIGNoYW5uZWwucG9ydDIucG9zdE1lc3NhZ2UoMCk7XG4gIH07XG59XG5cbmZ1bmN0aW9uIHVzZVNldFRpbWVvdXQoKSB7XG4gIC8vIFN0b3JlIHNldFRpbWVvdXQgcmVmZXJlbmNlIHNvIGVzNi1wcm9taXNlIHdpbGwgYmUgdW5hZmZlY3RlZCBieVxuICAvLyBvdGhlciBjb2RlIG1vZGlmeWluZyBzZXRUaW1lb3V0IChsaWtlIHNpbm9uLnVzZUZha2VUaW1lcnMoKSlcbiAgdmFyIGdsb2JhbFNldFRpbWVvdXQgPSBzZXRUaW1lb3V0O1xuICByZXR1cm4gZnVuY3Rpb24gKCkge1xuICAgIHJldHVybiBnbG9iYWxTZXRUaW1lb3V0KGZsdXNoLCAxKTtcbiAgfTtcbn1cblxudmFyIHF1ZXVlID0gbmV3IEFycmF5KDEwMDApO1xuZnVuY3Rpb24gZmx1c2goKSB7XG4gIGZvciAodmFyIGkgPSAwOyBpIDwgbGVuOyBpICs9IDIpIHtcbiAgICB2YXIgY2FsbGJhY2sgPSBxdWV1ZVtpXTtcbiAgICB2YXIgYXJnID0gcXVldWVbaSArIDFdO1xuXG4gICAgY2FsbGJhY2soYXJnKTtcblxuICAgIHF1ZXVlW2ldID0gdW5kZWZpbmVkO1xuICAgIHF1ZXVlW2kgKyAxXSA9IHVuZGVmaW5lZDtcbiAgfVxuXG4gIGxlbiA9IDA7XG59XG5cbmZ1bmN0aW9uIGF0dGVtcHRWZXJ0eCgpIHtcbiAgdHJ5IHtcbiAgICB2YXIgdmVydHggPSBGdW5jdGlvbigncmV0dXJuIHRoaXMnKSgpLnJlcXVpcmUoJ3ZlcnR4Jyk7XG4gICAgdmVydHhOZXh0ID0gdmVydHgucnVuT25Mb29wIHx8IHZlcnR4LnJ1bk9uQ29udGV4dDtcbiAgICByZXR1cm4gdXNlVmVydHhUaW1lcigpO1xuICB9IGNhdGNoIChlKSB7XG4gICAgcmV0dXJuIHVzZVNldFRpbWVvdXQoKTtcbiAgfVxufVxuXG52YXIgc2NoZWR1bGVGbHVzaCA9IHZvaWQgMDtcbi8vIERlY2lkZSB3aGF0IGFzeW5jIG1ldGhvZCB0byB1c2UgdG8gdHJpZ2dlcmluZyBwcm9jZXNzaW5nIG9mIHF1ZXVlZCBjYWxsYmFja3M6XG5pZiAoaXNOb2RlKSB7XG4gIHNjaGVkdWxlRmx1c2ggPSB1c2VOZXh0VGljaygpO1xufSBlbHNlIGlmIChCcm93c2VyTXV0YXRpb25PYnNlcnZlcikge1xuICBzY2hlZHVsZUZsdXNoID0gdXNlTXV0YXRpb25PYnNlcnZlcigpO1xufSBlbHNlIGlmIChpc1dvcmtlcikge1xuICBzY2hlZHVsZUZsdXNoID0gdXNlTWVzc2FnZUNoYW5uZWwoKTtcbn0gZWxzZSBpZiAoYnJvd3NlcldpbmRvdyA9PT0gdW5kZWZpbmVkICYmIHR5cGVvZiByZXF1aXJlID09PSAnZnVuY3Rpb24nKSB7XG4gIHNjaGVkdWxlRmx1c2ggPSBhdHRlbXB0VmVydHgoKTtcbn0gZWxzZSB7XG4gIHNjaGVkdWxlRmx1c2ggPSB1c2VTZXRUaW1lb3V0KCk7XG59XG5cbmZ1bmN0aW9uIHRoZW4ob25GdWxmaWxsbWVudCwgb25SZWplY3Rpb24pIHtcbiAgdmFyIHBhcmVudCA9IHRoaXM7XG5cbiAgdmFyIGNoaWxkID0gbmV3IHRoaXMuY29uc3RydWN0b3Iobm9vcCk7XG5cbiAgaWYgKGNoaWxkW1BST01JU0VfSURdID09PSB1bmRlZmluZWQpIHtcbiAgICBtYWtlUHJvbWlzZShjaGlsZCk7XG4gIH1cblxuICB2YXIgX3N0YXRlID0gcGFyZW50Ll9zdGF0ZTtcblxuXG4gIGlmIChfc3RhdGUpIHtcbiAgICB2YXIgY2FsbGJhY2sgPSBhcmd1bWVudHNbX3N0YXRlIC0gMV07XG4gICAgYXNhcChmdW5jdGlvbiAoKSB7XG4gICAgICByZXR1cm4gaW52b2tlQ2FsbGJhY2soX3N0YXRlLCBjaGlsZCwgY2FsbGJhY2ssIHBhcmVudC5fcmVzdWx0KTtcbiAgICB9KTtcbiAgfSBlbHNlIHtcbiAgICBzdWJzY3JpYmUocGFyZW50LCBjaGlsZCwgb25GdWxmaWxsbWVudCwgb25SZWplY3Rpb24pO1xuICB9XG5cbiAgcmV0dXJuIGNoaWxkO1xufVxuXG4vKipcbiAgYFByb21pc2UucmVzb2x2ZWAgcmV0dXJucyBhIHByb21pc2UgdGhhdCB3aWxsIGJlY29tZSByZXNvbHZlZCB3aXRoIHRoZVxuICBwYXNzZWQgYHZhbHVlYC4gSXQgaXMgc2hvcnRoYW5kIGZvciB0aGUgZm9sbG93aW5nOlxuXG4gIGBgYGphdmFzY3JpcHRcbiAgbGV0IHByb21pc2UgPSBuZXcgUHJvbWlzZShmdW5jdGlvbihyZXNvbHZlLCByZWplY3Qpe1xuICAgIHJlc29sdmUoMSk7XG4gIH0pO1xuXG4gIHByb21pc2UudGhlbihmdW5jdGlvbih2YWx1ZSl7XG4gICAgLy8gdmFsdWUgPT09IDFcbiAgfSk7XG4gIGBgYFxuXG4gIEluc3RlYWQgb2Ygd3JpdGluZyB0aGUgYWJvdmUsIHlvdXIgY29kZSBub3cgc2ltcGx5IGJlY29tZXMgdGhlIGZvbGxvd2luZzpcblxuICBgYGBqYXZhc2NyaXB0XG4gIGxldCBwcm9taXNlID0gUHJvbWlzZS5yZXNvbHZlKDEpO1xuXG4gIHByb21pc2UudGhlbihmdW5jdGlvbih2YWx1ZSl7XG4gICAgLy8gdmFsdWUgPT09IDFcbiAgfSk7XG4gIGBgYFxuXG4gIEBtZXRob2QgcmVzb2x2ZVxuICBAc3RhdGljXG4gIEBwYXJhbSB7QW55fSB2YWx1ZSB2YWx1ZSB0aGF0IHRoZSByZXR1cm5lZCBwcm9taXNlIHdpbGwgYmUgcmVzb2x2ZWQgd2l0aFxuICBVc2VmdWwgZm9yIHRvb2xpbmcuXG4gIEByZXR1cm4ge1Byb21pc2V9IGEgcHJvbWlzZSB0aGF0IHdpbGwgYmVjb21lIGZ1bGZpbGxlZCB3aXRoIHRoZSBnaXZlblxuICBgdmFsdWVgXG4qL1xuZnVuY3Rpb24gcmVzb2x2ZSQxKG9iamVjdCkge1xuICAvKmpzaGludCB2YWxpZHRoaXM6dHJ1ZSAqL1xuICB2YXIgQ29uc3RydWN0b3IgPSB0aGlzO1xuXG4gIGlmIChvYmplY3QgJiYgdHlwZW9mIG9iamVjdCA9PT0gJ29iamVjdCcgJiYgb2JqZWN0LmNvbnN0cnVjdG9yID09PSBDb25zdHJ1Y3Rvcikge1xuICAgIHJldHVybiBvYmplY3Q7XG4gIH1cblxuICB2YXIgcHJvbWlzZSA9IG5ldyBDb25zdHJ1Y3Rvcihub29wKTtcbiAgcmVzb2x2ZShwcm9taXNlLCBvYmplY3QpO1xuICByZXR1cm4gcHJvbWlzZTtcbn1cblxudmFyIFBST01JU0VfSUQgPSBNYXRoLnJhbmRvbSgpLnRvU3RyaW5nKDM2KS5zdWJzdHJpbmcoMik7XG5cbmZ1bmN0aW9uIG5vb3AoKSB7fVxuXG52YXIgUEVORElORyA9IHZvaWQgMDtcbnZhciBGVUxGSUxMRUQgPSAxO1xudmFyIFJFSkVDVEVEID0gMjtcblxudmFyIFRSWV9DQVRDSF9FUlJPUiA9IHsgZXJyb3I6IG51bGwgfTtcblxuZnVuY3Rpb24gc2VsZkZ1bGZpbGxtZW50KCkge1xuICByZXR1cm4gbmV3IFR5cGVFcnJvcihcIllvdSBjYW5ub3QgcmVzb2x2ZSBhIHByb21pc2Ugd2l0aCBpdHNlbGZcIik7XG59XG5cbmZ1bmN0aW9uIGNhbm5vdFJldHVybk93bigpIHtcbiAgcmV0dXJuIG5ldyBUeXBlRXJyb3IoJ0EgcHJvbWlzZXMgY2FsbGJhY2sgY2Fubm90IHJldHVybiB0aGF0IHNhbWUgcHJvbWlzZS4nKTtcbn1cblxuZnVuY3Rpb24gZ2V0VGhlbihwcm9taXNlKSB7XG4gIHRyeSB7XG4gICAgcmV0dXJuIHByb21pc2UudGhlbjtcbiAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICBUUllfQ0FUQ0hfRVJST1IuZXJyb3IgPSBlcnJvcjtcbiAgICByZXR1cm4gVFJZX0NBVENIX0VSUk9SO1xuICB9XG59XG5cbmZ1bmN0aW9uIHRyeVRoZW4odGhlbiQkMSwgdmFsdWUsIGZ1bGZpbGxtZW50SGFuZGxlciwgcmVqZWN0aW9uSGFuZGxlcikge1xuICB0cnkge1xuICAgIHRoZW4kJDEuY2FsbCh2YWx1ZSwgZnVsZmlsbG1lbnRIYW5kbGVyLCByZWplY3Rpb25IYW5kbGVyKTtcbiAgfSBjYXRjaCAoZSkge1xuICAgIHJldHVybiBlO1xuICB9XG59XG5cbmZ1bmN0aW9uIGhhbmRsZUZvcmVpZ25UaGVuYWJsZShwcm9taXNlLCB0aGVuYWJsZSwgdGhlbiQkMSkge1xuICBhc2FwKGZ1bmN0aW9uIChwcm9taXNlKSB7XG4gICAgdmFyIHNlYWxlZCA9IGZhbHNlO1xuICAgIHZhciBlcnJvciA9IHRyeVRoZW4odGhlbiQkMSwgdGhlbmFibGUsIGZ1bmN0aW9uICh2YWx1ZSkge1xuICAgICAgaWYgKHNlYWxlZCkge1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICBzZWFsZWQgPSB0cnVlO1xuICAgICAgaWYgKHRoZW5hYmxlICE9PSB2YWx1ZSkge1xuICAgICAgICByZXNvbHZlKHByb21pc2UsIHZhbHVlKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGZ1bGZpbGwocHJvbWlzZSwgdmFsdWUpO1xuICAgICAgfVxuICAgIH0sIGZ1bmN0aW9uIChyZWFzb24pIHtcbiAgICAgIGlmIChzZWFsZWQpIHtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgICAgc2VhbGVkID0gdHJ1ZTtcblxuICAgICAgcmVqZWN0KHByb21pc2UsIHJlYXNvbik7XG4gICAgfSwgJ1NldHRsZTogJyArIChwcm9taXNlLl9sYWJlbCB8fCAnIHVua25vd24gcHJvbWlzZScpKTtcblxuICAgIGlmICghc2VhbGVkICYmIGVycm9yKSB7XG4gICAgICBzZWFsZWQgPSB0cnVlO1xuICAgICAgcmVqZWN0KHByb21pc2UsIGVycm9yKTtcbiAgICB9XG4gIH0sIHByb21pc2UpO1xufVxuXG5mdW5jdGlvbiBoYW5kbGVPd25UaGVuYWJsZShwcm9taXNlLCB0aGVuYWJsZSkge1xuICBpZiAodGhlbmFibGUuX3N0YXRlID09PSBGVUxGSUxMRUQpIHtcbiAgICBmdWxmaWxsKHByb21pc2UsIHRoZW5hYmxlLl9yZXN1bHQpO1xuICB9IGVsc2UgaWYgKHRoZW5hYmxlLl9zdGF0ZSA9PT0gUkVKRUNURUQpIHtcbiAgICByZWplY3QocHJvbWlzZSwgdGhlbmFibGUuX3Jlc3VsdCk7XG4gIH0gZWxzZSB7XG4gICAgc3Vic2NyaWJlKHRoZW5hYmxlLCB1bmRlZmluZWQsIGZ1bmN0aW9uICh2YWx1ZSkge1xuICAgICAgcmV0dXJuIHJlc29sdmUocHJvbWlzZSwgdmFsdWUpO1xuICAgIH0sIGZ1bmN0aW9uIChyZWFzb24pIHtcbiAgICAgIHJldHVybiByZWplY3QocHJvbWlzZSwgcmVhc29uKTtcbiAgICB9KTtcbiAgfVxufVxuXG5mdW5jdGlvbiBoYW5kbGVNYXliZVRoZW5hYmxlKHByb21pc2UsIG1heWJlVGhlbmFibGUsIHRoZW4kJDEpIHtcbiAgaWYgKG1heWJlVGhlbmFibGUuY29uc3RydWN0b3IgPT09IHByb21pc2UuY29uc3RydWN0b3IgJiYgdGhlbiQkMSA9PT0gdGhlbiAmJiBtYXliZVRoZW5hYmxlLmNvbnN0cnVjdG9yLnJlc29sdmUgPT09IHJlc29sdmUkMSkge1xuICAgIGhhbmRsZU93blRoZW5hYmxlKHByb21pc2UsIG1heWJlVGhlbmFibGUpO1xuICB9IGVsc2Uge1xuICAgIGlmICh0aGVuJCQxID09PSBUUllfQ0FUQ0hfRVJST1IpIHtcbiAgICAgIHJlamVjdChwcm9taXNlLCBUUllfQ0FUQ0hfRVJST1IuZXJyb3IpO1xuICAgICAgVFJZX0NBVENIX0VSUk9SLmVycm9yID0gbnVsbDtcbiAgICB9IGVsc2UgaWYgKHRoZW4kJDEgPT09IHVuZGVmaW5lZCkge1xuICAgICAgZnVsZmlsbChwcm9taXNlLCBtYXliZVRoZW5hYmxlKTtcbiAgICB9IGVsc2UgaWYgKGlzRnVuY3Rpb24odGhlbiQkMSkpIHtcbiAgICAgIGhhbmRsZUZvcmVpZ25UaGVuYWJsZShwcm9taXNlLCBtYXliZVRoZW5hYmxlLCB0aGVuJCQxKTtcbiAgICB9IGVsc2Uge1xuICAgICAgZnVsZmlsbChwcm9taXNlLCBtYXliZVRoZW5hYmxlKTtcbiAgICB9XG4gIH1cbn1cblxuZnVuY3Rpb24gcmVzb2x2ZShwcm9taXNlLCB2YWx1ZSkge1xuICBpZiAocHJvbWlzZSA9PT0gdmFsdWUpIHtcbiAgICByZWplY3QocHJvbWlzZSwgc2VsZkZ1bGZpbGxtZW50KCkpO1xuICB9IGVsc2UgaWYgKG9iamVjdE9yRnVuY3Rpb24odmFsdWUpKSB7XG4gICAgaGFuZGxlTWF5YmVUaGVuYWJsZShwcm9taXNlLCB2YWx1ZSwgZ2V0VGhlbih2YWx1ZSkpO1xuICB9IGVsc2Uge1xuICAgIGZ1bGZpbGwocHJvbWlzZSwgdmFsdWUpO1xuICB9XG59XG5cbmZ1bmN0aW9uIHB1Ymxpc2hSZWplY3Rpb24ocHJvbWlzZSkge1xuICBpZiAocHJvbWlzZS5fb25lcnJvcikge1xuICAgIHByb21pc2UuX29uZXJyb3IocHJvbWlzZS5fcmVzdWx0KTtcbiAgfVxuXG4gIHB1Ymxpc2gocHJvbWlzZSk7XG59XG5cbmZ1bmN0aW9uIGZ1bGZpbGwocHJvbWlzZSwgdmFsdWUpIHtcbiAgaWYgKHByb21pc2UuX3N0YXRlICE9PSBQRU5ESU5HKSB7XG4gICAgcmV0dXJuO1xuICB9XG5cbiAgcHJvbWlzZS5fcmVzdWx0ID0gdmFsdWU7XG4gIHByb21pc2UuX3N0YXRlID0gRlVMRklMTEVEO1xuXG4gIGlmIChwcm9taXNlLl9zdWJzY3JpYmVycy5sZW5ndGggIT09IDApIHtcbiAgICBhc2FwKHB1Ymxpc2gsIHByb21pc2UpO1xuICB9XG59XG5cbmZ1bmN0aW9uIHJlamVjdChwcm9taXNlLCByZWFzb24pIHtcbiAgaWYgKHByb21pc2UuX3N0YXRlICE9PSBQRU5ESU5HKSB7XG4gICAgcmV0dXJuO1xuICB9XG4gIHByb21pc2UuX3N0YXRlID0gUkVKRUNURUQ7XG4gIHByb21pc2UuX3Jlc3VsdCA9IHJlYXNvbjtcblxuICBhc2FwKHB1Ymxpc2hSZWplY3Rpb24sIHByb21pc2UpO1xufVxuXG5mdW5jdGlvbiBzdWJzY3JpYmUocGFyZW50LCBjaGlsZCwgb25GdWxmaWxsbWVudCwgb25SZWplY3Rpb24pIHtcbiAgdmFyIF9zdWJzY3JpYmVycyA9IHBhcmVudC5fc3Vic2NyaWJlcnM7XG4gIHZhciBsZW5ndGggPSBfc3Vic2NyaWJlcnMubGVuZ3RoO1xuXG5cbiAgcGFyZW50Ll9vbmVycm9yID0gbnVsbDtcblxuICBfc3Vic2NyaWJlcnNbbGVuZ3RoXSA9IGNoaWxkO1xuICBfc3Vic2NyaWJlcnNbbGVuZ3RoICsgRlVMRklMTEVEXSA9IG9uRnVsZmlsbG1lbnQ7XG4gIF9zdWJzY3JpYmVyc1tsZW5ndGggKyBSRUpFQ1RFRF0gPSBvblJlamVjdGlvbjtcblxuICBpZiAobGVuZ3RoID09PSAwICYmIHBhcmVudC5fc3RhdGUpIHtcbiAgICBhc2FwKHB1Ymxpc2gsIHBhcmVudCk7XG4gIH1cbn1cblxuZnVuY3Rpb24gcHVibGlzaChwcm9taXNlKSB7XG4gIHZhciBzdWJzY3JpYmVycyA9IHByb21pc2UuX3N1YnNjcmliZXJzO1xuICB2YXIgc2V0dGxlZCA9IHByb21pc2UuX3N0YXRlO1xuXG4gIGlmIChzdWJzY3JpYmVycy5sZW5ndGggPT09IDApIHtcbiAgICByZXR1cm47XG4gIH1cblxuICB2YXIgY2hpbGQgPSB2b2lkIDAsXG4gICAgICBjYWxsYmFjayA9IHZvaWQgMCxcbiAgICAgIGRldGFpbCA9IHByb21pc2UuX3Jlc3VsdDtcblxuICBmb3IgKHZhciBpID0gMDsgaSA8IHN1YnNjcmliZXJzLmxlbmd0aDsgaSArPSAzKSB7XG4gICAgY2hpbGQgPSBzdWJzY3JpYmVyc1tpXTtcbiAgICBjYWxsYmFjayA9IHN1YnNjcmliZXJzW2kgKyBzZXR0bGVkXTtcblxuICAgIGlmIChjaGlsZCkge1xuICAgICAgaW52b2tlQ2FsbGJhY2soc2V0dGxlZCwgY2hpbGQsIGNhbGxiYWNrLCBkZXRhaWwpO1xuICAgIH0gZWxzZSB7XG4gICAgICBjYWxsYmFjayhkZXRhaWwpO1xuICAgIH1cbiAgfVxuXG4gIHByb21pc2UuX3N1YnNjcmliZXJzLmxlbmd0aCA9IDA7XG59XG5cbmZ1bmN0aW9uIHRyeUNhdGNoKGNhbGxiYWNrLCBkZXRhaWwpIHtcbiAgdHJ5IHtcbiAgICByZXR1cm4gY2FsbGJhY2soZGV0YWlsKTtcbiAgfSBjYXRjaCAoZSkge1xuICAgIFRSWV9DQVRDSF9FUlJPUi5lcnJvciA9IGU7XG4gICAgcmV0dXJuIFRSWV9DQVRDSF9FUlJPUjtcbiAgfVxufVxuXG5mdW5jdGlvbiBpbnZva2VDYWxsYmFjayhzZXR0bGVkLCBwcm9taXNlLCBjYWxsYmFjaywgZGV0YWlsKSB7XG4gIHZhciBoYXNDYWxsYmFjayA9IGlzRnVuY3Rpb24oY2FsbGJhY2spLFxuICAgICAgdmFsdWUgPSB2b2lkIDAsXG4gICAgICBlcnJvciA9IHZvaWQgMCxcbiAgICAgIHN1Y2NlZWRlZCA9IHZvaWQgMCxcbiAgICAgIGZhaWxlZCA9IHZvaWQgMDtcblxuICBpZiAoaGFzQ2FsbGJhY2spIHtcbiAgICB2YWx1ZSA9IHRyeUNhdGNoKGNhbGxiYWNrLCBkZXRhaWwpO1xuXG4gICAgaWYgKHZhbHVlID09PSBUUllfQ0FUQ0hfRVJST1IpIHtcbiAgICAgIGZhaWxlZCA9IHRydWU7XG4gICAgICBlcnJvciA9IHZhbHVlLmVycm9yO1xuICAgICAgdmFsdWUuZXJyb3IgPSBudWxsO1xuICAgIH0gZWxzZSB7XG4gICAgICBzdWNjZWVkZWQgPSB0cnVlO1xuICAgIH1cblxuICAgIGlmIChwcm9taXNlID09PSB2YWx1ZSkge1xuICAgICAgcmVqZWN0KHByb21pc2UsIGNhbm5vdFJldHVybk93bigpKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gIH0gZWxzZSB7XG4gICAgdmFsdWUgPSBkZXRhaWw7XG4gICAgc3VjY2VlZGVkID0gdHJ1ZTtcbiAgfVxuXG4gIGlmIChwcm9taXNlLl9zdGF0ZSAhPT0gUEVORElORykge1xuICAgIC8vIG5vb3BcbiAgfSBlbHNlIGlmIChoYXNDYWxsYmFjayAmJiBzdWNjZWVkZWQpIHtcbiAgICByZXNvbHZlKHByb21pc2UsIHZhbHVlKTtcbiAgfSBlbHNlIGlmIChmYWlsZWQpIHtcbiAgICByZWplY3QocHJvbWlzZSwgZXJyb3IpO1xuICB9IGVsc2UgaWYgKHNldHRsZWQgPT09IEZVTEZJTExFRCkge1xuICAgIGZ1bGZpbGwocHJvbWlzZSwgdmFsdWUpO1xuICB9IGVsc2UgaWYgKHNldHRsZWQgPT09IFJFSkVDVEVEKSB7XG4gICAgcmVqZWN0KHByb21pc2UsIHZhbHVlKTtcbiAgfVxufVxuXG5mdW5jdGlvbiBpbml0aWFsaXplUHJvbWlzZShwcm9taXNlLCByZXNvbHZlcikge1xuICB0cnkge1xuICAgIHJlc29sdmVyKGZ1bmN0aW9uIHJlc29sdmVQcm9taXNlKHZhbHVlKSB7XG4gICAgICByZXNvbHZlKHByb21pc2UsIHZhbHVlKTtcbiAgICB9LCBmdW5jdGlvbiByZWplY3RQcm9taXNlKHJlYXNvbikge1xuICAgICAgcmVqZWN0KHByb21pc2UsIHJlYXNvbik7XG4gICAgfSk7XG4gIH0gY2F0Y2ggKGUpIHtcbiAgICByZWplY3QocHJvbWlzZSwgZSk7XG4gIH1cbn1cblxudmFyIGlkID0gMDtcbmZ1bmN0aW9uIG5leHRJZCgpIHtcbiAgcmV0dXJuIGlkKys7XG59XG5cbmZ1bmN0aW9uIG1ha2VQcm9taXNlKHByb21pc2UpIHtcbiAgcHJvbWlzZVtQUk9NSVNFX0lEXSA9IGlkKys7XG4gIHByb21pc2UuX3N0YXRlID0gdW5kZWZpbmVkO1xuICBwcm9taXNlLl9yZXN1bHQgPSB1bmRlZmluZWQ7XG4gIHByb21pc2UuX3N1YnNjcmliZXJzID0gW107XG59XG5cbmZ1bmN0aW9uIHZhbGlkYXRpb25FcnJvcigpIHtcbiAgcmV0dXJuIG5ldyBFcnJvcignQXJyYXkgTWV0aG9kcyBtdXN0IGJlIHByb3ZpZGVkIGFuIEFycmF5Jyk7XG59XG5cbnZhciBFbnVtZXJhdG9yID0gZnVuY3Rpb24gKCkge1xuICBmdW5jdGlvbiBFbnVtZXJhdG9yKENvbnN0cnVjdG9yLCBpbnB1dCkge1xuICAgIHRoaXMuX2luc3RhbmNlQ29uc3RydWN0b3IgPSBDb25zdHJ1Y3RvcjtcbiAgICB0aGlzLnByb21pc2UgPSBuZXcgQ29uc3RydWN0b3Iobm9vcCk7XG5cbiAgICBpZiAoIXRoaXMucHJvbWlzZVtQUk9NSVNFX0lEXSkge1xuICAgICAgbWFrZVByb21pc2UodGhpcy5wcm9taXNlKTtcbiAgICB9XG5cbiAgICBpZiAoaXNBcnJheShpbnB1dCkpIHtcbiAgICAgIHRoaXMubGVuZ3RoID0gaW5wdXQubGVuZ3RoO1xuICAgICAgdGhpcy5fcmVtYWluaW5nID0gaW5wdXQubGVuZ3RoO1xuXG4gICAgICB0aGlzLl9yZXN1bHQgPSBuZXcgQXJyYXkodGhpcy5sZW5ndGgpO1xuXG4gICAgICBpZiAodGhpcy5sZW5ndGggPT09IDApIHtcbiAgICAgICAgZnVsZmlsbCh0aGlzLnByb21pc2UsIHRoaXMuX3Jlc3VsdCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aGlzLmxlbmd0aCA9IHRoaXMubGVuZ3RoIHx8IDA7XG4gICAgICAgIHRoaXMuX2VudW1lcmF0ZShpbnB1dCk7XG4gICAgICAgIGlmICh0aGlzLl9yZW1haW5pbmcgPT09IDApIHtcbiAgICAgICAgICBmdWxmaWxsKHRoaXMucHJvbWlzZSwgdGhpcy5fcmVzdWx0KTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICByZWplY3QodGhpcy5wcm9taXNlLCB2YWxpZGF0aW9uRXJyb3IoKSk7XG4gICAgfVxuICB9XG5cbiAgRW51bWVyYXRvci5wcm90b3R5cGUuX2VudW1lcmF0ZSA9IGZ1bmN0aW9uIF9lbnVtZXJhdGUoaW5wdXQpIHtcbiAgICBmb3IgKHZhciBpID0gMDsgdGhpcy5fc3RhdGUgPT09IFBFTkRJTkcgJiYgaSA8IGlucHV0Lmxlbmd0aDsgaSsrKSB7XG4gICAgICB0aGlzLl9lYWNoRW50cnkoaW5wdXRbaV0sIGkpO1xuICAgIH1cbiAgfTtcblxuICBFbnVtZXJhdG9yLnByb3RvdHlwZS5fZWFjaEVudHJ5ID0gZnVuY3Rpb24gX2VhY2hFbnRyeShlbnRyeSwgaSkge1xuICAgIHZhciBjID0gdGhpcy5faW5zdGFuY2VDb25zdHJ1Y3RvcjtcbiAgICB2YXIgcmVzb2x2ZSQkMSA9IGMucmVzb2x2ZTtcblxuXG4gICAgaWYgKHJlc29sdmUkJDEgPT09IHJlc29sdmUkMSkge1xuICAgICAgdmFyIF90aGVuID0gZ2V0VGhlbihlbnRyeSk7XG5cbiAgICAgIGlmIChfdGhlbiA9PT0gdGhlbiAmJiBlbnRyeS5fc3RhdGUgIT09IFBFTkRJTkcpIHtcbiAgICAgICAgdGhpcy5fc2V0dGxlZEF0KGVudHJ5Ll9zdGF0ZSwgaSwgZW50cnkuX3Jlc3VsdCk7XG4gICAgICB9IGVsc2UgaWYgKHR5cGVvZiBfdGhlbiAhPT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICB0aGlzLl9yZW1haW5pbmctLTtcbiAgICAgICAgdGhpcy5fcmVzdWx0W2ldID0gZW50cnk7XG4gICAgICB9IGVsc2UgaWYgKGMgPT09IFByb21pc2UkMSkge1xuICAgICAgICB2YXIgcHJvbWlzZSA9IG5ldyBjKG5vb3ApO1xuICAgICAgICBoYW5kbGVNYXliZVRoZW5hYmxlKHByb21pc2UsIGVudHJ5LCBfdGhlbik7XG4gICAgICAgIHRoaXMuX3dpbGxTZXR0bGVBdChwcm9taXNlLCBpKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMuX3dpbGxTZXR0bGVBdChuZXcgYyhmdW5jdGlvbiAocmVzb2x2ZSQkMSkge1xuICAgICAgICAgIHJldHVybiByZXNvbHZlJCQxKGVudHJ5KTtcbiAgICAgICAgfSksIGkpO1xuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLl93aWxsU2V0dGxlQXQocmVzb2x2ZSQkMShlbnRyeSksIGkpO1xuICAgIH1cbiAgfTtcblxuICBFbnVtZXJhdG9yLnByb3RvdHlwZS5fc2V0dGxlZEF0ID0gZnVuY3Rpb24gX3NldHRsZWRBdChzdGF0ZSwgaSwgdmFsdWUpIHtcbiAgICB2YXIgcHJvbWlzZSA9IHRoaXMucHJvbWlzZTtcblxuXG4gICAgaWYgKHByb21pc2UuX3N0YXRlID09PSBQRU5ESU5HKSB7XG4gICAgICB0aGlzLl9yZW1haW5pbmctLTtcblxuICAgICAgaWYgKHN0YXRlID09PSBSRUpFQ1RFRCkge1xuICAgICAgICByZWplY3QocHJvbWlzZSwgdmFsdWUpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhpcy5fcmVzdWx0W2ldID0gdmFsdWU7XG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKHRoaXMuX3JlbWFpbmluZyA9PT0gMCkge1xuICAgICAgZnVsZmlsbChwcm9taXNlLCB0aGlzLl9yZXN1bHQpO1xuICAgIH1cbiAgfTtcblxuICBFbnVtZXJhdG9yLnByb3RvdHlwZS5fd2lsbFNldHRsZUF0ID0gZnVuY3Rpb24gX3dpbGxTZXR0bGVBdChwcm9taXNlLCBpKSB7XG4gICAgdmFyIGVudW1lcmF0b3IgPSB0aGlzO1xuXG4gICAgc3Vic2NyaWJlKHByb21pc2UsIHVuZGVmaW5lZCwgZnVuY3Rpb24gKHZhbHVlKSB7XG4gICAgICByZXR1cm4gZW51bWVyYXRvci5fc2V0dGxlZEF0KEZVTEZJTExFRCwgaSwgdmFsdWUpO1xuICAgIH0sIGZ1bmN0aW9uIChyZWFzb24pIHtcbiAgICAgIHJldHVybiBlbnVtZXJhdG9yLl9zZXR0bGVkQXQoUkVKRUNURUQsIGksIHJlYXNvbik7XG4gICAgfSk7XG4gIH07XG5cbiAgcmV0dXJuIEVudW1lcmF0b3I7XG59KCk7XG5cbi8qKlxuICBgUHJvbWlzZS5hbGxgIGFjY2VwdHMgYW4gYXJyYXkgb2YgcHJvbWlzZXMsIGFuZCByZXR1cm5zIGEgbmV3IHByb21pc2Ugd2hpY2hcbiAgaXMgZnVsZmlsbGVkIHdpdGggYW4gYXJyYXkgb2YgZnVsZmlsbG1lbnQgdmFsdWVzIGZvciB0aGUgcGFzc2VkIHByb21pc2VzLCBvclxuICByZWplY3RlZCB3aXRoIHRoZSByZWFzb24gb2YgdGhlIGZpcnN0IHBhc3NlZCBwcm9taXNlIHRvIGJlIHJlamVjdGVkLiBJdCBjYXN0cyBhbGxcbiAgZWxlbWVudHMgb2YgdGhlIHBhc3NlZCBpdGVyYWJsZSB0byBwcm9taXNlcyBhcyBpdCBydW5zIHRoaXMgYWxnb3JpdGhtLlxuXG4gIEV4YW1wbGU6XG5cbiAgYGBgamF2YXNjcmlwdFxuICBsZXQgcHJvbWlzZTEgPSByZXNvbHZlKDEpO1xuICBsZXQgcHJvbWlzZTIgPSByZXNvbHZlKDIpO1xuICBsZXQgcHJvbWlzZTMgPSByZXNvbHZlKDMpO1xuICBsZXQgcHJvbWlzZXMgPSBbIHByb21pc2UxLCBwcm9taXNlMiwgcHJvbWlzZTMgXTtcblxuICBQcm9taXNlLmFsbChwcm9taXNlcykudGhlbihmdW5jdGlvbihhcnJheSl7XG4gICAgLy8gVGhlIGFycmF5IGhlcmUgd291bGQgYmUgWyAxLCAyLCAzIF07XG4gIH0pO1xuICBgYGBcblxuICBJZiBhbnkgb2YgdGhlIGBwcm9taXNlc2AgZ2l2ZW4gdG8gYGFsbGAgYXJlIHJlamVjdGVkLCB0aGUgZmlyc3QgcHJvbWlzZVxuICB0aGF0IGlzIHJlamVjdGVkIHdpbGwgYmUgZ2l2ZW4gYXMgYW4gYXJndW1lbnQgdG8gdGhlIHJldHVybmVkIHByb21pc2VzJ3NcbiAgcmVqZWN0aW9uIGhhbmRsZXIuIEZvciBleGFtcGxlOlxuXG4gIEV4YW1wbGU6XG5cbiAgYGBgamF2YXNjcmlwdFxuICBsZXQgcHJvbWlzZTEgPSByZXNvbHZlKDEpO1xuICBsZXQgcHJvbWlzZTIgPSByZWplY3QobmV3IEVycm9yKFwiMlwiKSk7XG4gIGxldCBwcm9taXNlMyA9IHJlamVjdChuZXcgRXJyb3IoXCIzXCIpKTtcbiAgbGV0IHByb21pc2VzID0gWyBwcm9taXNlMSwgcHJvbWlzZTIsIHByb21pc2UzIF07XG5cbiAgUHJvbWlzZS5hbGwocHJvbWlzZXMpLnRoZW4oZnVuY3Rpb24oYXJyYXkpe1xuICAgIC8vIENvZGUgaGVyZSBuZXZlciBydW5zIGJlY2F1c2UgdGhlcmUgYXJlIHJlamVjdGVkIHByb21pc2VzIVxuICB9LCBmdW5jdGlvbihlcnJvcikge1xuICAgIC8vIGVycm9yLm1lc3NhZ2UgPT09IFwiMlwiXG4gIH0pO1xuICBgYGBcblxuICBAbWV0aG9kIGFsbFxuICBAc3RhdGljXG4gIEBwYXJhbSB7QXJyYXl9IGVudHJpZXMgYXJyYXkgb2YgcHJvbWlzZXNcbiAgQHBhcmFtIHtTdHJpbmd9IGxhYmVsIG9wdGlvbmFsIHN0cmluZyBmb3IgbGFiZWxpbmcgdGhlIHByb21pc2UuXG4gIFVzZWZ1bCBmb3IgdG9vbGluZy5cbiAgQHJldHVybiB7UHJvbWlzZX0gcHJvbWlzZSB0aGF0IGlzIGZ1bGZpbGxlZCB3aGVuIGFsbCBgcHJvbWlzZXNgIGhhdmUgYmVlblxuICBmdWxmaWxsZWQsIG9yIHJlamVjdGVkIGlmIGFueSBvZiB0aGVtIGJlY29tZSByZWplY3RlZC5cbiAgQHN0YXRpY1xuKi9cbmZ1bmN0aW9uIGFsbChlbnRyaWVzKSB7XG4gIHJldHVybiBuZXcgRW51bWVyYXRvcih0aGlzLCBlbnRyaWVzKS5wcm9taXNlO1xufVxuXG4vKipcbiAgYFByb21pc2UucmFjZWAgcmV0dXJucyBhIG5ldyBwcm9taXNlIHdoaWNoIGlzIHNldHRsZWQgaW4gdGhlIHNhbWUgd2F5IGFzIHRoZVxuICBmaXJzdCBwYXNzZWQgcHJvbWlzZSB0byBzZXR0bGUuXG5cbiAgRXhhbXBsZTpcblxuICBgYGBqYXZhc2NyaXB0XG4gIGxldCBwcm9taXNlMSA9IG5ldyBQcm9taXNlKGZ1bmN0aW9uKHJlc29sdmUsIHJlamVjdCl7XG4gICAgc2V0VGltZW91dChmdW5jdGlvbigpe1xuICAgICAgcmVzb2x2ZSgncHJvbWlzZSAxJyk7XG4gICAgfSwgMjAwKTtcbiAgfSk7XG5cbiAgbGV0IHByb21pc2UyID0gbmV3IFByb21pc2UoZnVuY3Rpb24ocmVzb2x2ZSwgcmVqZWN0KXtcbiAgICBzZXRUaW1lb3V0KGZ1bmN0aW9uKCl7XG4gICAgICByZXNvbHZlKCdwcm9taXNlIDInKTtcbiAgICB9LCAxMDApO1xuICB9KTtcblxuICBQcm9taXNlLnJhY2UoW3Byb21pc2UxLCBwcm9taXNlMl0pLnRoZW4oZnVuY3Rpb24ocmVzdWx0KXtcbiAgICAvLyByZXN1bHQgPT09ICdwcm9taXNlIDInIGJlY2F1c2UgaXQgd2FzIHJlc29sdmVkIGJlZm9yZSBwcm9taXNlMVxuICAgIC8vIHdhcyByZXNvbHZlZC5cbiAgfSk7XG4gIGBgYFxuXG4gIGBQcm9taXNlLnJhY2VgIGlzIGRldGVybWluaXN0aWMgaW4gdGhhdCBvbmx5IHRoZSBzdGF0ZSBvZiB0aGUgZmlyc3RcbiAgc2V0dGxlZCBwcm9taXNlIG1hdHRlcnMuIEZvciBleGFtcGxlLCBldmVuIGlmIG90aGVyIHByb21pc2VzIGdpdmVuIHRvIHRoZVxuICBgcHJvbWlzZXNgIGFycmF5IGFyZ3VtZW50IGFyZSByZXNvbHZlZCwgYnV0IHRoZSBmaXJzdCBzZXR0bGVkIHByb21pc2UgaGFzXG4gIGJlY29tZSByZWplY3RlZCBiZWZvcmUgdGhlIG90aGVyIHByb21pc2VzIGJlY2FtZSBmdWxmaWxsZWQsIHRoZSByZXR1cm5lZFxuICBwcm9taXNlIHdpbGwgYmVjb21lIHJlamVjdGVkOlxuXG4gIGBgYGphdmFzY3JpcHRcbiAgbGV0IHByb21pc2UxID0gbmV3IFByb21pc2UoZnVuY3Rpb24ocmVzb2x2ZSwgcmVqZWN0KXtcbiAgICBzZXRUaW1lb3V0KGZ1bmN0aW9uKCl7XG4gICAgICByZXNvbHZlKCdwcm9taXNlIDEnKTtcbiAgICB9LCAyMDApO1xuICB9KTtcblxuICBsZXQgcHJvbWlzZTIgPSBuZXcgUHJvbWlzZShmdW5jdGlvbihyZXNvbHZlLCByZWplY3Qpe1xuICAgIHNldFRpbWVvdXQoZnVuY3Rpb24oKXtcbiAgICAgIHJlamVjdChuZXcgRXJyb3IoJ3Byb21pc2UgMicpKTtcbiAgICB9LCAxMDApO1xuICB9KTtcblxuICBQcm9taXNlLnJhY2UoW3Byb21pc2UxLCBwcm9taXNlMl0pLnRoZW4oZnVuY3Rpb24ocmVzdWx0KXtcbiAgICAvLyBDb2RlIGhlcmUgbmV2ZXIgcnVuc1xuICB9LCBmdW5jdGlvbihyZWFzb24pe1xuICAgIC8vIHJlYXNvbi5tZXNzYWdlID09PSAncHJvbWlzZSAyJyBiZWNhdXNlIHByb21pc2UgMiBiZWNhbWUgcmVqZWN0ZWQgYmVmb3JlXG4gICAgLy8gcHJvbWlzZSAxIGJlY2FtZSBmdWxmaWxsZWRcbiAgfSk7XG4gIGBgYFxuXG4gIEFuIGV4YW1wbGUgcmVhbC13b3JsZCB1c2UgY2FzZSBpcyBpbXBsZW1lbnRpbmcgdGltZW91dHM6XG5cbiAgYGBgamF2YXNjcmlwdFxuICBQcm9taXNlLnJhY2UoW2FqYXgoJ2Zvby5qc29uJyksIHRpbWVvdXQoNTAwMCldKVxuICBgYGBcblxuICBAbWV0aG9kIHJhY2VcbiAgQHN0YXRpY1xuICBAcGFyYW0ge0FycmF5fSBwcm9taXNlcyBhcnJheSBvZiBwcm9taXNlcyB0byBvYnNlcnZlXG4gIFVzZWZ1bCBmb3IgdG9vbGluZy5cbiAgQHJldHVybiB7UHJvbWlzZX0gYSBwcm9taXNlIHdoaWNoIHNldHRsZXMgaW4gdGhlIHNhbWUgd2F5IGFzIHRoZSBmaXJzdCBwYXNzZWRcbiAgcHJvbWlzZSB0byBzZXR0bGUuXG4qL1xuZnVuY3Rpb24gcmFjZShlbnRyaWVzKSB7XG4gIC8qanNoaW50IHZhbGlkdGhpczp0cnVlICovXG4gIHZhciBDb25zdHJ1Y3RvciA9IHRoaXM7XG5cbiAgaWYgKCFpc0FycmF5KGVudHJpZXMpKSB7XG4gICAgcmV0dXJuIG5ldyBDb25zdHJ1Y3RvcihmdW5jdGlvbiAoXywgcmVqZWN0KSB7XG4gICAgICByZXR1cm4gcmVqZWN0KG5ldyBUeXBlRXJyb3IoJ1lvdSBtdXN0IHBhc3MgYW4gYXJyYXkgdG8gcmFjZS4nKSk7XG4gICAgfSk7XG4gIH0gZWxzZSB7XG4gICAgcmV0dXJuIG5ldyBDb25zdHJ1Y3RvcihmdW5jdGlvbiAocmVzb2x2ZSwgcmVqZWN0KSB7XG4gICAgICB2YXIgbGVuZ3RoID0gZW50cmllcy5sZW5ndGg7XG4gICAgICBmb3IgKHZhciBpID0gMDsgaSA8IGxlbmd0aDsgaSsrKSB7XG4gICAgICAgIENvbnN0cnVjdG9yLnJlc29sdmUoZW50cmllc1tpXSkudGhlbihyZXNvbHZlLCByZWplY3QpO1xuICAgICAgfVxuICAgIH0pO1xuICB9XG59XG5cbi8qKlxuICBgUHJvbWlzZS5yZWplY3RgIHJldHVybnMgYSBwcm9taXNlIHJlamVjdGVkIHdpdGggdGhlIHBhc3NlZCBgcmVhc29uYC5cbiAgSXQgaXMgc2hvcnRoYW5kIGZvciB0aGUgZm9sbG93aW5nOlxuXG4gIGBgYGphdmFzY3JpcHRcbiAgbGV0IHByb21pc2UgPSBuZXcgUHJvbWlzZShmdW5jdGlvbihyZXNvbHZlLCByZWplY3Qpe1xuICAgIHJlamVjdChuZXcgRXJyb3IoJ1dIT09QUycpKTtcbiAgfSk7XG5cbiAgcHJvbWlzZS50aGVuKGZ1bmN0aW9uKHZhbHVlKXtcbiAgICAvLyBDb2RlIGhlcmUgZG9lc24ndCBydW4gYmVjYXVzZSB0aGUgcHJvbWlzZSBpcyByZWplY3RlZCFcbiAgfSwgZnVuY3Rpb24ocmVhc29uKXtcbiAgICAvLyByZWFzb24ubWVzc2FnZSA9PT0gJ1dIT09QUydcbiAgfSk7XG4gIGBgYFxuXG4gIEluc3RlYWQgb2Ygd3JpdGluZyB0aGUgYWJvdmUsIHlvdXIgY29kZSBub3cgc2ltcGx5IGJlY29tZXMgdGhlIGZvbGxvd2luZzpcblxuICBgYGBqYXZhc2NyaXB0XG4gIGxldCBwcm9taXNlID0gUHJvbWlzZS5yZWplY3QobmV3IEVycm9yKCdXSE9PUFMnKSk7XG5cbiAgcHJvbWlzZS50aGVuKGZ1bmN0aW9uKHZhbHVlKXtcbiAgICAvLyBDb2RlIGhlcmUgZG9lc24ndCBydW4gYmVjYXVzZSB0aGUgcHJvbWlzZSBpcyByZWplY3RlZCFcbiAgfSwgZnVuY3Rpb24ocmVhc29uKXtcbiAgICAvLyByZWFzb24ubWVzc2FnZSA9PT0gJ1dIT09QUydcbiAgfSk7XG4gIGBgYFxuXG4gIEBtZXRob2QgcmVqZWN0XG4gIEBzdGF0aWNcbiAgQHBhcmFtIHtBbnl9IHJlYXNvbiB2YWx1ZSB0aGF0IHRoZSByZXR1cm5lZCBwcm9taXNlIHdpbGwgYmUgcmVqZWN0ZWQgd2l0aC5cbiAgVXNlZnVsIGZvciB0b29saW5nLlxuICBAcmV0dXJuIHtQcm9taXNlfSBhIHByb21pc2UgcmVqZWN0ZWQgd2l0aCB0aGUgZ2l2ZW4gYHJlYXNvbmAuXG4qL1xuZnVuY3Rpb24gcmVqZWN0JDEocmVhc29uKSB7XG4gIC8qanNoaW50IHZhbGlkdGhpczp0cnVlICovXG4gIHZhciBDb25zdHJ1Y3RvciA9IHRoaXM7XG4gIHZhciBwcm9taXNlID0gbmV3IENvbnN0cnVjdG9yKG5vb3ApO1xuICByZWplY3QocHJvbWlzZSwgcmVhc29uKTtcbiAgcmV0dXJuIHByb21pc2U7XG59XG5cbmZ1bmN0aW9uIG5lZWRzUmVzb2x2ZXIoKSB7XG4gIHRocm93IG5ldyBUeXBlRXJyb3IoJ1lvdSBtdXN0IHBhc3MgYSByZXNvbHZlciBmdW5jdGlvbiBhcyB0aGUgZmlyc3QgYXJndW1lbnQgdG8gdGhlIHByb21pc2UgY29uc3RydWN0b3InKTtcbn1cblxuZnVuY3Rpb24gbmVlZHNOZXcoKSB7XG4gIHRocm93IG5ldyBUeXBlRXJyb3IoXCJGYWlsZWQgdG8gY29uc3RydWN0ICdQcm9taXNlJzogUGxlYXNlIHVzZSB0aGUgJ25ldycgb3BlcmF0b3IsIHRoaXMgb2JqZWN0IGNvbnN0cnVjdG9yIGNhbm5vdCBiZSBjYWxsZWQgYXMgYSBmdW5jdGlvbi5cIik7XG59XG5cbi8qKlxuICBQcm9taXNlIG9iamVjdHMgcmVwcmVzZW50IHRoZSBldmVudHVhbCByZXN1bHQgb2YgYW4gYXN5bmNocm9ub3VzIG9wZXJhdGlvbi4gVGhlXG4gIHByaW1hcnkgd2F5IG9mIGludGVyYWN0aW5nIHdpdGggYSBwcm9taXNlIGlzIHRocm91Z2ggaXRzIGB0aGVuYCBtZXRob2QsIHdoaWNoXG4gIHJlZ2lzdGVycyBjYWxsYmFja3MgdG8gcmVjZWl2ZSBlaXRoZXIgYSBwcm9taXNlJ3MgZXZlbnR1YWwgdmFsdWUgb3IgdGhlIHJlYXNvblxuICB3aHkgdGhlIHByb21pc2UgY2Fubm90IGJlIGZ1bGZpbGxlZC5cblxuICBUZXJtaW5vbG9neVxuICAtLS0tLS0tLS0tLVxuXG4gIC0gYHByb21pc2VgIGlzIGFuIG9iamVjdCBvciBmdW5jdGlvbiB3aXRoIGEgYHRoZW5gIG1ldGhvZCB3aG9zZSBiZWhhdmlvciBjb25mb3JtcyB0byB0aGlzIHNwZWNpZmljYXRpb24uXG4gIC0gYHRoZW5hYmxlYCBpcyBhbiBvYmplY3Qgb3IgZnVuY3Rpb24gdGhhdCBkZWZpbmVzIGEgYHRoZW5gIG1ldGhvZC5cbiAgLSBgdmFsdWVgIGlzIGFueSBsZWdhbCBKYXZhU2NyaXB0IHZhbHVlIChpbmNsdWRpbmcgdW5kZWZpbmVkLCBhIHRoZW5hYmxlLCBvciBhIHByb21pc2UpLlxuICAtIGBleGNlcHRpb25gIGlzIGEgdmFsdWUgdGhhdCBpcyB0aHJvd24gdXNpbmcgdGhlIHRocm93IHN0YXRlbWVudC5cbiAgLSBgcmVhc29uYCBpcyBhIHZhbHVlIHRoYXQgaW5kaWNhdGVzIHdoeSBhIHByb21pc2Ugd2FzIHJlamVjdGVkLlxuICAtIGBzZXR0bGVkYCB0aGUgZmluYWwgcmVzdGluZyBzdGF0ZSBvZiBhIHByb21pc2UsIGZ1bGZpbGxlZCBvciByZWplY3RlZC5cblxuICBBIHByb21pc2UgY2FuIGJlIGluIG9uZSBvZiB0aHJlZSBzdGF0ZXM6IHBlbmRpbmcsIGZ1bGZpbGxlZCwgb3IgcmVqZWN0ZWQuXG5cbiAgUHJvbWlzZXMgdGhhdCBhcmUgZnVsZmlsbGVkIGhhdmUgYSBmdWxmaWxsbWVudCB2YWx1ZSBhbmQgYXJlIGluIHRoZSBmdWxmaWxsZWRcbiAgc3RhdGUuICBQcm9taXNlcyB0aGF0IGFyZSByZWplY3RlZCBoYXZlIGEgcmVqZWN0aW9uIHJlYXNvbiBhbmQgYXJlIGluIHRoZVxuICByZWplY3RlZCBzdGF0ZS4gIEEgZnVsZmlsbG1lbnQgdmFsdWUgaXMgbmV2ZXIgYSB0aGVuYWJsZS5cblxuICBQcm9taXNlcyBjYW4gYWxzbyBiZSBzYWlkIHRvICpyZXNvbHZlKiBhIHZhbHVlLiAgSWYgdGhpcyB2YWx1ZSBpcyBhbHNvIGFcbiAgcHJvbWlzZSwgdGhlbiB0aGUgb3JpZ2luYWwgcHJvbWlzZSdzIHNldHRsZWQgc3RhdGUgd2lsbCBtYXRjaCB0aGUgdmFsdWUnc1xuICBzZXR0bGVkIHN0YXRlLiAgU28gYSBwcm9taXNlIHRoYXQgKnJlc29sdmVzKiBhIHByb21pc2UgdGhhdCByZWplY3RzIHdpbGxcbiAgaXRzZWxmIHJlamVjdCwgYW5kIGEgcHJvbWlzZSB0aGF0ICpyZXNvbHZlcyogYSBwcm9taXNlIHRoYXQgZnVsZmlsbHMgd2lsbFxuICBpdHNlbGYgZnVsZmlsbC5cblxuXG4gIEJhc2ljIFVzYWdlOlxuICAtLS0tLS0tLS0tLS1cblxuICBgYGBqc1xuICBsZXQgcHJvbWlzZSA9IG5ldyBQcm9taXNlKGZ1bmN0aW9uKHJlc29sdmUsIHJlamVjdCkge1xuICAgIC8vIG9uIHN1Y2Nlc3NcbiAgICByZXNvbHZlKHZhbHVlKTtcblxuICAgIC8vIG9uIGZhaWx1cmVcbiAgICByZWplY3QocmVhc29uKTtcbiAgfSk7XG5cbiAgcHJvbWlzZS50aGVuKGZ1bmN0aW9uKHZhbHVlKSB7XG4gICAgLy8gb24gZnVsZmlsbG1lbnRcbiAgfSwgZnVuY3Rpb24ocmVhc29uKSB7XG4gICAgLy8gb24gcmVqZWN0aW9uXG4gIH0pO1xuICBgYGBcblxuICBBZHZhbmNlZCBVc2FnZTpcbiAgLS0tLS0tLS0tLS0tLS0tXG5cbiAgUHJvbWlzZXMgc2hpbmUgd2hlbiBhYnN0cmFjdGluZyBhd2F5IGFzeW5jaHJvbm91cyBpbnRlcmFjdGlvbnMgc3VjaCBhc1xuICBgWE1MSHR0cFJlcXVlc3Rgcy5cblxuICBgYGBqc1xuICBmdW5jdGlvbiBnZXRKU09OKHVybCkge1xuICAgIHJldHVybiBuZXcgUHJvbWlzZShmdW5jdGlvbihyZXNvbHZlLCByZWplY3Qpe1xuICAgICAgbGV0IHhociA9IG5ldyBYTUxIdHRwUmVxdWVzdCgpO1xuXG4gICAgICB4aHIub3BlbignR0VUJywgdXJsKTtcbiAgICAgIHhoci5vbnJlYWR5c3RhdGVjaGFuZ2UgPSBoYW5kbGVyO1xuICAgICAgeGhyLnJlc3BvbnNlVHlwZSA9ICdqc29uJztcbiAgICAgIHhoci5zZXRSZXF1ZXN0SGVhZGVyKCdBY2NlcHQnLCAnYXBwbGljYXRpb24vanNvbicpO1xuICAgICAgeGhyLnNlbmQoKTtcblxuICAgICAgZnVuY3Rpb24gaGFuZGxlcigpIHtcbiAgICAgICAgaWYgKHRoaXMucmVhZHlTdGF0ZSA9PT0gdGhpcy5ET05FKSB7XG4gICAgICAgICAgaWYgKHRoaXMuc3RhdHVzID09PSAyMDApIHtcbiAgICAgICAgICAgIHJlc29sdmUodGhpcy5yZXNwb25zZSk7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHJlamVjdChuZXcgRXJyb3IoJ2dldEpTT046IGAnICsgdXJsICsgJ2AgZmFpbGVkIHdpdGggc3RhdHVzOiBbJyArIHRoaXMuc3RhdHVzICsgJ10nKSk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9O1xuICAgIH0pO1xuICB9XG5cbiAgZ2V0SlNPTignL3Bvc3RzLmpzb24nKS50aGVuKGZ1bmN0aW9uKGpzb24pIHtcbiAgICAvLyBvbiBmdWxmaWxsbWVudFxuICB9LCBmdW5jdGlvbihyZWFzb24pIHtcbiAgICAvLyBvbiByZWplY3Rpb25cbiAgfSk7XG4gIGBgYFxuXG4gIFVubGlrZSBjYWxsYmFja3MsIHByb21pc2VzIGFyZSBncmVhdCBjb21wb3NhYmxlIHByaW1pdGl2ZXMuXG5cbiAgYGBganNcbiAgUHJvbWlzZS5hbGwoW1xuICAgIGdldEpTT04oJy9wb3N0cycpLFxuICAgIGdldEpTT04oJy9jb21tZW50cycpXG4gIF0pLnRoZW4oZnVuY3Rpb24odmFsdWVzKXtcbiAgICB2YWx1ZXNbMF0gLy8gPT4gcG9zdHNKU09OXG4gICAgdmFsdWVzWzFdIC8vID0+IGNvbW1lbnRzSlNPTlxuXG4gICAgcmV0dXJuIHZhbHVlcztcbiAgfSk7XG4gIGBgYFxuXG4gIEBjbGFzcyBQcm9taXNlXG4gIEBwYXJhbSB7RnVuY3Rpb259IHJlc29sdmVyXG4gIFVzZWZ1bCBmb3IgdG9vbGluZy5cbiAgQGNvbnN0cnVjdG9yXG4qL1xuXG52YXIgUHJvbWlzZSQxID0gZnVuY3Rpb24gKCkge1xuICBmdW5jdGlvbiBQcm9taXNlKHJlc29sdmVyKSB7XG4gICAgdGhpc1tQUk9NSVNFX0lEXSA9IG5leHRJZCgpO1xuICAgIHRoaXMuX3Jlc3VsdCA9IHRoaXMuX3N0YXRlID0gdW5kZWZpbmVkO1xuICAgIHRoaXMuX3N1YnNjcmliZXJzID0gW107XG5cbiAgICBpZiAobm9vcCAhPT0gcmVzb2x2ZXIpIHtcbiAgICAgIHR5cGVvZiByZXNvbHZlciAhPT0gJ2Z1bmN0aW9uJyAmJiBuZWVkc1Jlc29sdmVyKCk7XG4gICAgICB0aGlzIGluc3RhbmNlb2YgUHJvbWlzZSA/IGluaXRpYWxpemVQcm9taXNlKHRoaXMsIHJlc29sdmVyKSA6IG5lZWRzTmV3KCk7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gIFRoZSBwcmltYXJ5IHdheSBvZiBpbnRlcmFjdGluZyB3aXRoIGEgcHJvbWlzZSBpcyB0aHJvdWdoIGl0cyBgdGhlbmAgbWV0aG9kLFxuICB3aGljaCByZWdpc3RlcnMgY2FsbGJhY2tzIHRvIHJlY2VpdmUgZWl0aGVyIGEgcHJvbWlzZSdzIGV2ZW50dWFsIHZhbHVlIG9yIHRoZVxuICByZWFzb24gd2h5IHRoZSBwcm9taXNlIGNhbm5vdCBiZSBmdWxmaWxsZWQuXG4gICBgYGBqc1xuICBmaW5kVXNlcigpLnRoZW4oZnVuY3Rpb24odXNlcil7XG4gICAgLy8gdXNlciBpcyBhdmFpbGFibGVcbiAgfSwgZnVuY3Rpb24ocmVhc29uKXtcbiAgICAvLyB1c2VyIGlzIHVuYXZhaWxhYmxlLCBhbmQgeW91IGFyZSBnaXZlbiB0aGUgcmVhc29uIHdoeVxuICB9KTtcbiAgYGBgXG4gICBDaGFpbmluZ1xuICAtLS0tLS0tLVxuICAgVGhlIHJldHVybiB2YWx1ZSBvZiBgdGhlbmAgaXMgaXRzZWxmIGEgcHJvbWlzZS4gIFRoaXMgc2Vjb25kLCAnZG93bnN0cmVhbSdcbiAgcHJvbWlzZSBpcyByZXNvbHZlZCB3aXRoIHRoZSByZXR1cm4gdmFsdWUgb2YgdGhlIGZpcnN0IHByb21pc2UncyBmdWxmaWxsbWVudFxuICBvciByZWplY3Rpb24gaGFuZGxlciwgb3IgcmVqZWN0ZWQgaWYgdGhlIGhhbmRsZXIgdGhyb3dzIGFuIGV4Y2VwdGlvbi5cbiAgIGBgYGpzXG4gIGZpbmRVc2VyKCkudGhlbihmdW5jdGlvbiAodXNlcikge1xuICAgIHJldHVybiB1c2VyLm5hbWU7XG4gIH0sIGZ1bmN0aW9uIChyZWFzb24pIHtcbiAgICByZXR1cm4gJ2RlZmF1bHQgbmFtZSc7XG4gIH0pLnRoZW4oZnVuY3Rpb24gKHVzZXJOYW1lKSB7XG4gICAgLy8gSWYgYGZpbmRVc2VyYCBmdWxmaWxsZWQsIGB1c2VyTmFtZWAgd2lsbCBiZSB0aGUgdXNlcidzIG5hbWUsIG90aGVyd2lzZSBpdFxuICAgIC8vIHdpbGwgYmUgYCdkZWZhdWx0IG5hbWUnYFxuICB9KTtcbiAgIGZpbmRVc2VyKCkudGhlbihmdW5jdGlvbiAodXNlcikge1xuICAgIHRocm93IG5ldyBFcnJvcignRm91bmQgdXNlciwgYnV0IHN0aWxsIHVuaGFwcHknKTtcbiAgfSwgZnVuY3Rpb24gKHJlYXNvbikge1xuICAgIHRocm93IG5ldyBFcnJvcignYGZpbmRVc2VyYCByZWplY3RlZCBhbmQgd2UncmUgdW5oYXBweScpO1xuICB9KS50aGVuKGZ1bmN0aW9uICh2YWx1ZSkge1xuICAgIC8vIG5ldmVyIHJlYWNoZWRcbiAgfSwgZnVuY3Rpb24gKHJlYXNvbikge1xuICAgIC8vIGlmIGBmaW5kVXNlcmAgZnVsZmlsbGVkLCBgcmVhc29uYCB3aWxsIGJlICdGb3VuZCB1c2VyLCBidXQgc3RpbGwgdW5oYXBweScuXG4gICAgLy8gSWYgYGZpbmRVc2VyYCByZWplY3RlZCwgYHJlYXNvbmAgd2lsbCBiZSAnYGZpbmRVc2VyYCByZWplY3RlZCBhbmQgd2UncmUgdW5oYXBweScuXG4gIH0pO1xuICBgYGBcbiAgSWYgdGhlIGRvd25zdHJlYW0gcHJvbWlzZSBkb2VzIG5vdCBzcGVjaWZ5IGEgcmVqZWN0aW9uIGhhbmRsZXIsIHJlamVjdGlvbiByZWFzb25zIHdpbGwgYmUgcHJvcGFnYXRlZCBmdXJ0aGVyIGRvd25zdHJlYW0uXG4gICBgYGBqc1xuICBmaW5kVXNlcigpLnRoZW4oZnVuY3Rpb24gKHVzZXIpIHtcbiAgICB0aHJvdyBuZXcgUGVkYWdvZ2ljYWxFeGNlcHRpb24oJ1Vwc3RyZWFtIGVycm9yJyk7XG4gIH0pLnRoZW4oZnVuY3Rpb24gKHZhbHVlKSB7XG4gICAgLy8gbmV2ZXIgcmVhY2hlZFxuICB9KS50aGVuKGZ1bmN0aW9uICh2YWx1ZSkge1xuICAgIC8vIG5ldmVyIHJlYWNoZWRcbiAgfSwgZnVuY3Rpb24gKHJlYXNvbikge1xuICAgIC8vIFRoZSBgUGVkZ2Fnb2NpYWxFeGNlcHRpb25gIGlzIHByb3BhZ2F0ZWQgYWxsIHRoZSB3YXkgZG93biB0byBoZXJlXG4gIH0pO1xuICBgYGBcbiAgIEFzc2ltaWxhdGlvblxuICAtLS0tLS0tLS0tLS1cbiAgIFNvbWV0aW1lcyB0aGUgdmFsdWUgeW91IHdhbnQgdG8gcHJvcGFnYXRlIHRvIGEgZG93bnN0cmVhbSBwcm9taXNlIGNhbiBvbmx5IGJlXG4gIHJldHJpZXZlZCBhc3luY2hyb25vdXNseS4gVGhpcyBjYW4gYmUgYWNoaWV2ZWQgYnkgcmV0dXJuaW5nIGEgcHJvbWlzZSBpbiB0aGVcbiAgZnVsZmlsbG1lbnQgb3IgcmVqZWN0aW9uIGhhbmRsZXIuIFRoZSBkb3duc3RyZWFtIHByb21pc2Ugd2lsbCB0aGVuIGJlIHBlbmRpbmdcbiAgdW50aWwgdGhlIHJldHVybmVkIHByb21pc2UgaXMgc2V0dGxlZC4gVGhpcyBpcyBjYWxsZWQgKmFzc2ltaWxhdGlvbiouXG4gICBgYGBqc1xuICBmaW5kVXNlcigpLnRoZW4oZnVuY3Rpb24gKHVzZXIpIHtcbiAgICByZXR1cm4gZmluZENvbW1lbnRzQnlBdXRob3IodXNlcik7XG4gIH0pLnRoZW4oZnVuY3Rpb24gKGNvbW1lbnRzKSB7XG4gICAgLy8gVGhlIHVzZXIncyBjb21tZW50cyBhcmUgbm93IGF2YWlsYWJsZVxuICB9KTtcbiAgYGBgXG4gICBJZiB0aGUgYXNzaW1saWF0ZWQgcHJvbWlzZSByZWplY3RzLCB0aGVuIHRoZSBkb3duc3RyZWFtIHByb21pc2Ugd2lsbCBhbHNvIHJlamVjdC5cbiAgIGBgYGpzXG4gIGZpbmRVc2VyKCkudGhlbihmdW5jdGlvbiAodXNlcikge1xuICAgIHJldHVybiBmaW5kQ29tbWVudHNCeUF1dGhvcih1c2VyKTtcbiAgfSkudGhlbihmdW5jdGlvbiAoY29tbWVudHMpIHtcbiAgICAvLyBJZiBgZmluZENvbW1lbnRzQnlBdXRob3JgIGZ1bGZpbGxzLCB3ZSdsbCBoYXZlIHRoZSB2YWx1ZSBoZXJlXG4gIH0sIGZ1bmN0aW9uIChyZWFzb24pIHtcbiAgICAvLyBJZiBgZmluZENvbW1lbnRzQnlBdXRob3JgIHJlamVjdHMsIHdlJ2xsIGhhdmUgdGhlIHJlYXNvbiBoZXJlXG4gIH0pO1xuICBgYGBcbiAgIFNpbXBsZSBFeGFtcGxlXG4gIC0tLS0tLS0tLS0tLS0tXG4gICBTeW5jaHJvbm91cyBFeGFtcGxlXG4gICBgYGBqYXZhc2NyaXB0XG4gIGxldCByZXN1bHQ7XG4gICB0cnkge1xuICAgIHJlc3VsdCA9IGZpbmRSZXN1bHQoKTtcbiAgICAvLyBzdWNjZXNzXG4gIH0gY2F0Y2gocmVhc29uKSB7XG4gICAgLy8gZmFpbHVyZVxuICB9XG4gIGBgYFxuICAgRXJyYmFjayBFeGFtcGxlXG4gICBgYGBqc1xuICBmaW5kUmVzdWx0KGZ1bmN0aW9uKHJlc3VsdCwgZXJyKXtcbiAgICBpZiAoZXJyKSB7XG4gICAgICAvLyBmYWlsdXJlXG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIHN1Y2Nlc3NcbiAgICB9XG4gIH0pO1xuICBgYGBcbiAgIFByb21pc2UgRXhhbXBsZTtcbiAgIGBgYGphdmFzY3JpcHRcbiAgZmluZFJlc3VsdCgpLnRoZW4oZnVuY3Rpb24ocmVzdWx0KXtcbiAgICAvLyBzdWNjZXNzXG4gIH0sIGZ1bmN0aW9uKHJlYXNvbil7XG4gICAgLy8gZmFpbHVyZVxuICB9KTtcbiAgYGBgXG4gICBBZHZhbmNlZCBFeGFtcGxlXG4gIC0tLS0tLS0tLS0tLS0tXG4gICBTeW5jaHJvbm91cyBFeGFtcGxlXG4gICBgYGBqYXZhc2NyaXB0XG4gIGxldCBhdXRob3IsIGJvb2tzO1xuICAgdHJ5IHtcbiAgICBhdXRob3IgPSBmaW5kQXV0aG9yKCk7XG4gICAgYm9va3MgID0gZmluZEJvb2tzQnlBdXRob3IoYXV0aG9yKTtcbiAgICAvLyBzdWNjZXNzXG4gIH0gY2F0Y2gocmVhc29uKSB7XG4gICAgLy8gZmFpbHVyZVxuICB9XG4gIGBgYFxuICAgRXJyYmFjayBFeGFtcGxlXG4gICBgYGBqc1xuICAgZnVuY3Rpb24gZm91bmRCb29rcyhib29rcykge1xuICAgfVxuICAgZnVuY3Rpb24gZmFpbHVyZShyZWFzb24pIHtcbiAgIH1cbiAgIGZpbmRBdXRob3IoZnVuY3Rpb24oYXV0aG9yLCBlcnIpe1xuICAgIGlmIChlcnIpIHtcbiAgICAgIGZhaWx1cmUoZXJyKTtcbiAgICAgIC8vIGZhaWx1cmVcbiAgICB9IGVsc2Uge1xuICAgICAgdHJ5IHtcbiAgICAgICAgZmluZEJvb29rc0J5QXV0aG9yKGF1dGhvciwgZnVuY3Rpb24oYm9va3MsIGVycikge1xuICAgICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICAgIGZhaWx1cmUoZXJyKTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgZm91bmRCb29rcyhib29rcyk7XG4gICAgICAgICAgICB9IGNhdGNoKHJlYXNvbikge1xuICAgICAgICAgICAgICBmYWlsdXJlKHJlYXNvbik7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICAgIH0gY2F0Y2goZXJyb3IpIHtcbiAgICAgICAgZmFpbHVyZShlcnIpO1xuICAgICAgfVxuICAgICAgLy8gc3VjY2Vzc1xuICAgIH1cbiAgfSk7XG4gIGBgYFxuICAgUHJvbWlzZSBFeGFtcGxlO1xuICAgYGBgamF2YXNjcmlwdFxuICBmaW5kQXV0aG9yKCkuXG4gICAgdGhlbihmaW5kQm9va3NCeUF1dGhvcikuXG4gICAgdGhlbihmdW5jdGlvbihib29rcyl7XG4gICAgICAvLyBmb3VuZCBib29rc1xuICB9KS5jYXRjaChmdW5jdGlvbihyZWFzb24pe1xuICAgIC8vIHNvbWV0aGluZyB3ZW50IHdyb25nXG4gIH0pO1xuICBgYGBcbiAgIEBtZXRob2QgdGhlblxuICBAcGFyYW0ge0Z1bmN0aW9ufSBvbkZ1bGZpbGxlZFxuICBAcGFyYW0ge0Z1bmN0aW9ufSBvblJlamVjdGVkXG4gIFVzZWZ1bCBmb3IgdG9vbGluZy5cbiAgQHJldHVybiB7UHJvbWlzZX1cbiAgKi9cblxuICAvKipcbiAgYGNhdGNoYCBpcyBzaW1wbHkgc3VnYXIgZm9yIGB0aGVuKHVuZGVmaW5lZCwgb25SZWplY3Rpb24pYCB3aGljaCBtYWtlcyBpdCB0aGUgc2FtZVxuICBhcyB0aGUgY2F0Y2ggYmxvY2sgb2YgYSB0cnkvY2F0Y2ggc3RhdGVtZW50LlxuICBgYGBqc1xuICBmdW5jdGlvbiBmaW5kQXV0aG9yKCl7XG4gIHRocm93IG5ldyBFcnJvcignY291bGRuJ3QgZmluZCB0aGF0IGF1dGhvcicpO1xuICB9XG4gIC8vIHN5bmNocm9ub3VzXG4gIHRyeSB7XG4gIGZpbmRBdXRob3IoKTtcbiAgfSBjYXRjaChyZWFzb24pIHtcbiAgLy8gc29tZXRoaW5nIHdlbnQgd3JvbmdcbiAgfVxuICAvLyBhc3luYyB3aXRoIHByb21pc2VzXG4gIGZpbmRBdXRob3IoKS5jYXRjaChmdW5jdGlvbihyZWFzb24pe1xuICAvLyBzb21ldGhpbmcgd2VudCB3cm9uZ1xuICB9KTtcbiAgYGBgXG4gIEBtZXRob2QgY2F0Y2hcbiAgQHBhcmFtIHtGdW5jdGlvbn0gb25SZWplY3Rpb25cbiAgVXNlZnVsIGZvciB0b29saW5nLlxuICBAcmV0dXJuIHtQcm9taXNlfVxuICAqL1xuXG5cbiAgUHJvbWlzZS5wcm90b3R5cGUuY2F0Y2ggPSBmdW5jdGlvbiBfY2F0Y2gob25SZWplY3Rpb24pIHtcbiAgICByZXR1cm4gdGhpcy50aGVuKG51bGwsIG9uUmVqZWN0aW9uKTtcbiAgfTtcblxuICAvKipcbiAgICBgZmluYWxseWAgd2lsbCBiZSBpbnZva2VkIHJlZ2FyZGxlc3Mgb2YgdGhlIHByb21pc2UncyBmYXRlIGp1c3QgYXMgbmF0aXZlXG4gICAgdHJ5L2NhdGNoL2ZpbmFsbHkgYmVoYXZlc1xuICBcbiAgICBTeW5jaHJvbm91cyBleGFtcGxlOlxuICBcbiAgICBgYGBqc1xuICAgIGZpbmRBdXRob3IoKSB7XG4gICAgICBpZiAoTWF0aC5yYW5kb20oKSA+IDAuNSkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBuZXcgQXV0aG9yKCk7XG4gICAgfVxuICBcbiAgICB0cnkge1xuICAgICAgcmV0dXJuIGZpbmRBdXRob3IoKTsgLy8gc3VjY2VlZCBvciBmYWlsXG4gICAgfSBjYXRjaChlcnJvcikge1xuICAgICAgcmV0dXJuIGZpbmRPdGhlckF1dGhlcigpO1xuICAgIH0gZmluYWxseSB7XG4gICAgICAvLyBhbHdheXMgcnVuc1xuICAgICAgLy8gZG9lc24ndCBhZmZlY3QgdGhlIHJldHVybiB2YWx1ZVxuICAgIH1cbiAgICBgYGBcbiAgXG4gICAgQXN5bmNocm9ub3VzIGV4YW1wbGU6XG4gIFxuICAgIGBgYGpzXG4gICAgZmluZEF1dGhvcigpLmNhdGNoKGZ1bmN0aW9uKHJlYXNvbil7XG4gICAgICByZXR1cm4gZmluZE90aGVyQXV0aGVyKCk7XG4gICAgfSkuZmluYWxseShmdW5jdGlvbigpe1xuICAgICAgLy8gYXV0aG9yIHdhcyBlaXRoZXIgZm91bmQsIG9yIG5vdFxuICAgIH0pO1xuICAgIGBgYFxuICBcbiAgICBAbWV0aG9kIGZpbmFsbHlcbiAgICBAcGFyYW0ge0Z1bmN0aW9ufSBjYWxsYmFja1xuICAgIEByZXR1cm4ge1Byb21pc2V9XG4gICovXG5cblxuICBQcm9taXNlLnByb3RvdHlwZS5maW5hbGx5ID0gZnVuY3Rpb24gX2ZpbmFsbHkoY2FsbGJhY2spIHtcbiAgICB2YXIgcHJvbWlzZSA9IHRoaXM7XG4gICAgdmFyIGNvbnN0cnVjdG9yID0gcHJvbWlzZS5jb25zdHJ1Y3RvcjtcblxuICAgIHJldHVybiBwcm9taXNlLnRoZW4oZnVuY3Rpb24gKHZhbHVlKSB7XG4gICAgICByZXR1cm4gY29uc3RydWN0b3IucmVzb2x2ZShjYWxsYmFjaygpKS50aGVuKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgcmV0dXJuIHZhbHVlO1xuICAgICAgfSk7XG4gICAgfSwgZnVuY3Rpb24gKHJlYXNvbikge1xuICAgICAgcmV0dXJuIGNvbnN0cnVjdG9yLnJlc29sdmUoY2FsbGJhY2soKSkudGhlbihmdW5jdGlvbiAoKSB7XG4gICAgICAgIHRocm93IHJlYXNvbjtcbiAgICAgIH0pO1xuICAgIH0pO1xuICB9O1xuXG4gIHJldHVybiBQcm9taXNlO1xufSgpO1xuXG5Qcm9taXNlJDEucHJvdG90eXBlLnRoZW4gPSB0aGVuO1xuUHJvbWlzZSQxLmFsbCA9IGFsbDtcblByb21pc2UkMS5yYWNlID0gcmFjZTtcblByb21pc2UkMS5yZXNvbHZlID0gcmVzb2x2ZSQxO1xuUHJvbWlzZSQxLnJlamVjdCA9IHJlamVjdCQxO1xuUHJvbWlzZSQxLl9zZXRTY2hlZHVsZXIgPSBzZXRTY2hlZHVsZXI7XG5Qcm9taXNlJDEuX3NldEFzYXAgPSBzZXRBc2FwO1xuUHJvbWlzZSQxLl9hc2FwID0gYXNhcDtcblxuLypnbG9iYWwgc2VsZiovXG5mdW5jdGlvbiBwb2x5ZmlsbCgpIHtcbiAgdmFyIGxvY2FsID0gdm9pZCAwO1xuXG4gIGlmICh0eXBlb2YgZ2xvYmFsICE9PSAndW5kZWZpbmVkJykge1xuICAgIGxvY2FsID0gZ2xvYmFsO1xuICB9IGVsc2UgaWYgKHR5cGVvZiBzZWxmICE9PSAndW5kZWZpbmVkJykge1xuICAgIGxvY2FsID0gc2VsZjtcbiAgfSBlbHNlIHtcbiAgICB0cnkge1xuICAgICAgbG9jYWwgPSBGdW5jdGlvbigncmV0dXJuIHRoaXMnKSgpO1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcigncG9seWZpbGwgZmFpbGVkIGJlY2F1c2UgZ2xvYmFsIG9iamVjdCBpcyB1bmF2YWlsYWJsZSBpbiB0aGlzIGVudmlyb25tZW50Jyk7XG4gICAgfVxuICB9XG5cbiAgdmFyIFAgPSBsb2NhbC5Qcm9taXNlO1xuXG4gIGlmIChQKSB7XG4gICAgdmFyIHByb21pc2VUb1N0cmluZyA9IG51bGw7XG4gICAgdHJ5IHtcbiAgICAgIHByb21pc2VUb1N0cmluZyA9IE9iamVjdC5wcm90b3R5cGUudG9TdHJpbmcuY2FsbChQLnJlc29sdmUoKSk7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgLy8gc2lsZW50bHkgaWdub3JlZFxuICAgIH1cblxuICAgIGlmIChwcm9taXNlVG9TdHJpbmcgPT09ICdbb2JqZWN0IFByb21pc2VdJyAmJiAhUC5jYXN0KSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuICB9XG5cbiAgbG9jYWwuUHJvbWlzZSA9IFByb21pc2UkMTtcbn1cblxuLy8gU3RyYW5nZSBjb21wYXQuLlxuUHJvbWlzZSQxLnBvbHlmaWxsID0gcG9seWZpbGw7XG5Qcm9taXNlJDEuUHJvbWlzZSA9IFByb21pc2UkMTtcblxucmV0dXJuIFByb21pc2UkMTtcblxufSkpKTtcblxuXG5cbi8vIyBzb3VyY2VNYXBwaW5nVVJMPWVzNi1wcm9taXNlLm1hcFxuIiwiLy8gdGhlIHdoYXR3Zy1mZXRjaCBwb2x5ZmlsbCBpbnN0YWxscyB0aGUgZmV0Y2goKSBmdW5jdGlvblxuLy8gb24gdGhlIGdsb2JhbCBvYmplY3QgKHdpbmRvdyBvciBzZWxmKVxuLy9cbi8vIFJldHVybiB0aGF0IGFzIHRoZSBleHBvcnQgZm9yIHVzZSBpbiBXZWJwYWNrLCBCcm93c2VyaWZ5IGV0Yy5cbnJlcXVpcmUoJ3doYXR3Zy1mZXRjaCcpO1xubW9kdWxlLmV4cG9ydHMgPSBzZWxmLmZldGNoLmJpbmQoc2VsZik7XG4iLCIvLyBzaGltIGZvciB1c2luZyBwcm9jZXNzIGluIGJyb3dzZXJcbnZhciBwcm9jZXNzID0gbW9kdWxlLmV4cG9ydHMgPSB7fTtcblxuLy8gY2FjaGVkIGZyb20gd2hhdGV2ZXIgZ2xvYmFsIGlzIHByZXNlbnQgc28gdGhhdCB0ZXN0IHJ1bm5lcnMgdGhhdCBzdHViIGl0XG4vLyBkb24ndCBicmVhayB0aGluZ3MuICBCdXQgd2UgbmVlZCB0byB3cmFwIGl0IGluIGEgdHJ5IGNhdGNoIGluIGNhc2UgaXQgaXNcbi8vIHdyYXBwZWQgaW4gc3RyaWN0IG1vZGUgY29kZSB3aGljaCBkb2Vzbid0IGRlZmluZSBhbnkgZ2xvYmFscy4gIEl0J3MgaW5zaWRlIGFcbi8vIGZ1bmN0aW9uIGJlY2F1c2UgdHJ5L2NhdGNoZXMgZGVvcHRpbWl6ZSBpbiBjZXJ0YWluIGVuZ2luZXMuXG5cbnZhciBjYWNoZWRTZXRUaW1lb3V0O1xudmFyIGNhY2hlZENsZWFyVGltZW91dDtcblxuZnVuY3Rpb24gZGVmYXVsdFNldFRpbW91dCgpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ3NldFRpbWVvdXQgaGFzIG5vdCBiZWVuIGRlZmluZWQnKTtcbn1cbmZ1bmN0aW9uIGRlZmF1bHRDbGVhclRpbWVvdXQgKCkge1xuICAgIHRocm93IG5ldyBFcnJvcignY2xlYXJUaW1lb3V0IGhhcyBub3QgYmVlbiBkZWZpbmVkJyk7XG59XG4oZnVuY3Rpb24gKCkge1xuICAgIHRyeSB7XG4gICAgICAgIGlmICh0eXBlb2Ygc2V0VGltZW91dCA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICAgICAgY2FjaGVkU2V0VGltZW91dCA9IHNldFRpbWVvdXQ7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBjYWNoZWRTZXRUaW1lb3V0ID0gZGVmYXVsdFNldFRpbW91dDtcbiAgICAgICAgfVxuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgY2FjaGVkU2V0VGltZW91dCA9IGRlZmF1bHRTZXRUaW1vdXQ7XG4gICAgfVxuICAgIHRyeSB7XG4gICAgICAgIGlmICh0eXBlb2YgY2xlYXJUaW1lb3V0ID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgICAgICBjYWNoZWRDbGVhclRpbWVvdXQgPSBjbGVhclRpbWVvdXQ7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBjYWNoZWRDbGVhclRpbWVvdXQgPSBkZWZhdWx0Q2xlYXJUaW1lb3V0O1xuICAgICAgICB9XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgICBjYWNoZWRDbGVhclRpbWVvdXQgPSBkZWZhdWx0Q2xlYXJUaW1lb3V0O1xuICAgIH1cbn0gKCkpXG5mdW5jdGlvbiBydW5UaW1lb3V0KGZ1bikge1xuICAgIGlmIChjYWNoZWRTZXRUaW1lb3V0ID09PSBzZXRUaW1lb3V0KSB7XG4gICAgICAgIC8vbm9ybWFsIGVudmlyb21lbnRzIGluIHNhbmUgc2l0dWF0aW9uc1xuICAgICAgICByZXR1cm4gc2V0VGltZW91dChmdW4sIDApO1xuICAgIH1cbiAgICAvLyBpZiBzZXRUaW1lb3V0IHdhc24ndCBhdmFpbGFibGUgYnV0IHdhcyBsYXR0ZXIgZGVmaW5lZFxuICAgIGlmICgoY2FjaGVkU2V0VGltZW91dCA9PT0gZGVmYXVsdFNldFRpbW91dCB8fCAhY2FjaGVkU2V0VGltZW91dCkgJiYgc2V0VGltZW91dCkge1xuICAgICAgICBjYWNoZWRTZXRUaW1lb3V0ID0gc2V0VGltZW91dDtcbiAgICAgICAgcmV0dXJuIHNldFRpbWVvdXQoZnVuLCAwKTtcbiAgICB9XG4gICAgdHJ5IHtcbiAgICAgICAgLy8gd2hlbiB3aGVuIHNvbWVib2R5IGhhcyBzY3Jld2VkIHdpdGggc2V0VGltZW91dCBidXQgbm8gSS5FLiBtYWRkbmVzc1xuICAgICAgICByZXR1cm4gY2FjaGVkU2V0VGltZW91dChmdW4sIDApO1xuICAgIH0gY2F0Y2goZSl7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICAvLyBXaGVuIHdlIGFyZSBpbiBJLkUuIGJ1dCB0aGUgc2NyaXB0IGhhcyBiZWVuIGV2YWxlZCBzbyBJLkUuIGRvZXNuJ3QgdHJ1c3QgdGhlIGdsb2JhbCBvYmplY3Qgd2hlbiBjYWxsZWQgbm9ybWFsbHlcbiAgICAgICAgICAgIHJldHVybiBjYWNoZWRTZXRUaW1lb3V0LmNhbGwobnVsbCwgZnVuLCAwKTtcbiAgICAgICAgfSBjYXRjaChlKXtcbiAgICAgICAgICAgIC8vIHNhbWUgYXMgYWJvdmUgYnV0IHdoZW4gaXQncyBhIHZlcnNpb24gb2YgSS5FLiB0aGF0IG11c3QgaGF2ZSB0aGUgZ2xvYmFsIG9iamVjdCBmb3IgJ3RoaXMnLCBob3BmdWxseSBvdXIgY29udGV4dCBjb3JyZWN0IG90aGVyd2lzZSBpdCB3aWxsIHRocm93IGEgZ2xvYmFsIGVycm9yXG4gICAgICAgICAgICByZXR1cm4gY2FjaGVkU2V0VGltZW91dC5jYWxsKHRoaXMsIGZ1biwgMCk7XG4gICAgICAgIH1cbiAgICB9XG5cblxufVxuZnVuY3Rpb24gcnVuQ2xlYXJUaW1lb3V0KG1hcmtlcikge1xuICAgIGlmIChjYWNoZWRDbGVhclRpbWVvdXQgPT09IGNsZWFyVGltZW91dCkge1xuICAgICAgICAvL25vcm1hbCBlbnZpcm9tZW50cyBpbiBzYW5lIHNpdHVhdGlvbnNcbiAgICAgICAgcmV0dXJuIGNsZWFyVGltZW91dChtYXJrZXIpO1xuICAgIH1cbiAgICAvLyBpZiBjbGVhclRpbWVvdXQgd2Fzbid0IGF2YWlsYWJsZSBidXQgd2FzIGxhdHRlciBkZWZpbmVkXG4gICAgaWYgKChjYWNoZWRDbGVhclRpbWVvdXQgPT09IGRlZmF1bHRDbGVhclRpbWVvdXQgfHwgIWNhY2hlZENsZWFyVGltZW91dCkgJiYgY2xlYXJUaW1lb3V0KSB7XG4gICAgICAgIGNhY2hlZENsZWFyVGltZW91dCA9IGNsZWFyVGltZW91dDtcbiAgICAgICAgcmV0dXJuIGNsZWFyVGltZW91dChtYXJrZXIpO1xuICAgIH1cbiAgICB0cnkge1xuICAgICAgICAvLyB3aGVuIHdoZW4gc29tZWJvZHkgaGFzIHNjcmV3ZWQgd2l0aCBzZXRUaW1lb3V0IGJ1dCBubyBJLkUuIG1hZGRuZXNzXG4gICAgICAgIHJldHVybiBjYWNoZWRDbGVhclRpbWVvdXQobWFya2VyKTtcbiAgICB9IGNhdGNoIChlKXtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIC8vIFdoZW4gd2UgYXJlIGluIEkuRS4gYnV0IHRoZSBzY3JpcHQgaGFzIGJlZW4gZXZhbGVkIHNvIEkuRS4gZG9lc24ndCAgdHJ1c3QgdGhlIGdsb2JhbCBvYmplY3Qgd2hlbiBjYWxsZWQgbm9ybWFsbHlcbiAgICAgICAgICAgIHJldHVybiBjYWNoZWRDbGVhclRpbWVvdXQuY2FsbChudWxsLCBtYXJrZXIpO1xuICAgICAgICB9IGNhdGNoIChlKXtcbiAgICAgICAgICAgIC8vIHNhbWUgYXMgYWJvdmUgYnV0IHdoZW4gaXQncyBhIHZlcnNpb24gb2YgSS5FLiB0aGF0IG11c3QgaGF2ZSB0aGUgZ2xvYmFsIG9iamVjdCBmb3IgJ3RoaXMnLCBob3BmdWxseSBvdXIgY29udGV4dCBjb3JyZWN0IG90aGVyd2lzZSBpdCB3aWxsIHRocm93IGEgZ2xvYmFsIGVycm9yLlxuICAgICAgICAgICAgLy8gU29tZSB2ZXJzaW9ucyBvZiBJLkUuIGhhdmUgZGlmZmVyZW50IHJ1bGVzIGZvciBjbGVhclRpbWVvdXQgdnMgc2V0VGltZW91dFxuICAgICAgICAgICAgcmV0dXJuIGNhY2hlZENsZWFyVGltZW91dC5jYWxsKHRoaXMsIG1hcmtlcik7XG4gICAgICAgIH1cbiAgICB9XG5cblxuXG59XG52YXIgcXVldWUgPSBbXTtcbnZhciBkcmFpbmluZyA9IGZhbHNlO1xudmFyIGN1cnJlbnRRdWV1ZTtcbnZhciBxdWV1ZUluZGV4ID0gLTE7XG5cbmZ1bmN0aW9uIGNsZWFuVXBOZXh0VGljaygpIHtcbiAgICBpZiAoIWRyYWluaW5nIHx8ICFjdXJyZW50UXVldWUpIHtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBkcmFpbmluZyA9IGZhbHNlO1xuICAgIGlmIChjdXJyZW50UXVldWUubGVuZ3RoKSB7XG4gICAgICAgIHF1ZXVlID0gY3VycmVudFF1ZXVlLmNvbmNhdChxdWV1ZSk7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgcXVldWVJbmRleCA9IC0xO1xuICAgIH1cbiAgICBpZiAocXVldWUubGVuZ3RoKSB7XG4gICAgICAgIGRyYWluUXVldWUoKTtcbiAgICB9XG59XG5cbmZ1bmN0aW9uIGRyYWluUXVldWUoKSB7XG4gICAgaWYgKGRyYWluaW5nKSB7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG4gICAgdmFyIHRpbWVvdXQgPSBydW5UaW1lb3V0KGNsZWFuVXBOZXh0VGljayk7XG4gICAgZHJhaW5pbmcgPSB0cnVlO1xuXG4gICAgdmFyIGxlbiA9IHF1ZXVlLmxlbmd0aDtcbiAgICB3aGlsZShsZW4pIHtcbiAgICAgICAgY3VycmVudFF1ZXVlID0gcXVldWU7XG4gICAgICAgIHF1ZXVlID0gW107XG4gICAgICAgIHdoaWxlICgrK3F1ZXVlSW5kZXggPCBsZW4pIHtcbiAgICAgICAgICAgIGlmIChjdXJyZW50UXVldWUpIHtcbiAgICAgICAgICAgICAgICBjdXJyZW50UXVldWVbcXVldWVJbmRleF0ucnVuKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcXVldWVJbmRleCA9IC0xO1xuICAgICAgICBsZW4gPSBxdWV1ZS5sZW5ndGg7XG4gICAgfVxuICAgIGN1cnJlbnRRdWV1ZSA9IG51bGw7XG4gICAgZHJhaW5pbmcgPSBmYWxzZTtcbiAgICBydW5DbGVhclRpbWVvdXQodGltZW91dCk7XG59XG5cbnByb2Nlc3MubmV4dFRpY2sgPSBmdW5jdGlvbiAoZnVuKSB7XG4gICAgdmFyIGFyZ3MgPSBuZXcgQXJyYXkoYXJndW1lbnRzLmxlbmd0aCAtIDEpO1xuICAgIGlmIChhcmd1bWVudHMubGVuZ3RoID4gMSkge1xuICAgICAgICBmb3IgKHZhciBpID0gMTsgaSA8IGFyZ3VtZW50cy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgYXJnc1tpIC0gMV0gPSBhcmd1bWVudHNbaV07XG4gICAgICAgIH1cbiAgICB9XG4gICAgcXVldWUucHVzaChuZXcgSXRlbShmdW4sIGFyZ3MpKTtcbiAgICBpZiAocXVldWUubGVuZ3RoID09PSAxICYmICFkcmFpbmluZykge1xuICAgICAgICBydW5UaW1lb3V0KGRyYWluUXVldWUpO1xuICAgIH1cbn07XG5cbi8vIHY4IGxpa2VzIHByZWRpY3RpYmxlIG9iamVjdHNcbmZ1bmN0aW9uIEl0ZW0oZnVuLCBhcnJheSkge1xuICAgIHRoaXMuZnVuID0gZnVuO1xuICAgIHRoaXMuYXJyYXkgPSBhcnJheTtcbn1cbkl0ZW0ucHJvdG90eXBlLnJ1biA9IGZ1bmN0aW9uICgpIHtcbiAgICB0aGlzLmZ1bi5hcHBseShudWxsLCB0aGlzLmFycmF5KTtcbn07XG5wcm9jZXNzLnRpdGxlID0gJ2Jyb3dzZXInO1xucHJvY2Vzcy5icm93c2VyID0gdHJ1ZTtcbnByb2Nlc3MuZW52ID0ge307XG5wcm9jZXNzLmFyZ3YgPSBbXTtcbnByb2Nlc3MudmVyc2lvbiA9ICcnOyAvLyBlbXB0eSBzdHJpbmcgdG8gYXZvaWQgcmVnZXhwIGlzc3Vlc1xucHJvY2Vzcy52ZXJzaW9ucyA9IHt9O1xuXG5mdW5jdGlvbiBub29wKCkge31cblxucHJvY2Vzcy5vbiA9IG5vb3A7XG5wcm9jZXNzLmFkZExpc3RlbmVyID0gbm9vcDtcbnByb2Nlc3Mub25jZSA9IG5vb3A7XG5wcm9jZXNzLm9mZiA9IG5vb3A7XG5wcm9jZXNzLnJlbW92ZUxpc3RlbmVyID0gbm9vcDtcbnByb2Nlc3MucmVtb3ZlQWxsTGlzdGVuZXJzID0gbm9vcDtcbnByb2Nlc3MuZW1pdCA9IG5vb3A7XG5wcm9jZXNzLnByZXBlbmRMaXN0ZW5lciA9IG5vb3A7XG5wcm9jZXNzLnByZXBlbmRPbmNlTGlzdGVuZXIgPSBub29wO1xuXG5wcm9jZXNzLmxpc3RlbmVycyA9IGZ1bmN0aW9uIChuYW1lKSB7IHJldHVybiBbXSB9XG5cbnByb2Nlc3MuYmluZGluZyA9IGZ1bmN0aW9uIChuYW1lKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdwcm9jZXNzLmJpbmRpbmcgaXMgbm90IHN1cHBvcnRlZCcpO1xufTtcblxucHJvY2Vzcy5jd2QgPSBmdW5jdGlvbiAoKSB7IHJldHVybiAnLycgfTtcbnByb2Nlc3MuY2hkaXIgPSBmdW5jdGlvbiAoZGlyKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdwcm9jZXNzLmNoZGlyIGlzIG5vdCBzdXBwb3J0ZWQnKTtcbn07XG5wcm9jZXNzLnVtYXNrID0gZnVuY3Rpb24oKSB7IHJldHVybiAwOyB9O1xuIiwiKGZ1bmN0aW9uKHNlbGYpIHtcbiAgJ3VzZSBzdHJpY3QnO1xuXG4gIGlmIChzZWxmLmZldGNoKSB7XG4gICAgcmV0dXJuXG4gIH1cblxuICB2YXIgc3VwcG9ydCA9IHtcbiAgICBzZWFyY2hQYXJhbXM6ICdVUkxTZWFyY2hQYXJhbXMnIGluIHNlbGYsXG4gICAgaXRlcmFibGU6ICdTeW1ib2wnIGluIHNlbGYgJiYgJ2l0ZXJhdG9yJyBpbiBTeW1ib2wsXG4gICAgYmxvYjogJ0ZpbGVSZWFkZXInIGluIHNlbGYgJiYgJ0Jsb2InIGluIHNlbGYgJiYgKGZ1bmN0aW9uKCkge1xuICAgICAgdHJ5IHtcbiAgICAgICAgbmV3IEJsb2IoKVxuICAgICAgICByZXR1cm4gdHJ1ZVxuICAgICAgfSBjYXRjaChlKSB7XG4gICAgICAgIHJldHVybiBmYWxzZVxuICAgICAgfVxuICAgIH0pKCksXG4gICAgZm9ybURhdGE6ICdGb3JtRGF0YScgaW4gc2VsZixcbiAgICBhcnJheUJ1ZmZlcjogJ0FycmF5QnVmZmVyJyBpbiBzZWxmXG4gIH1cblxuICBpZiAoc3VwcG9ydC5hcnJheUJ1ZmZlcikge1xuICAgIHZhciB2aWV3Q2xhc3NlcyA9IFtcbiAgICAgICdbb2JqZWN0IEludDhBcnJheV0nLFxuICAgICAgJ1tvYmplY3QgVWludDhBcnJheV0nLFxuICAgICAgJ1tvYmplY3QgVWludDhDbGFtcGVkQXJyYXldJyxcbiAgICAgICdbb2JqZWN0IEludDE2QXJyYXldJyxcbiAgICAgICdbb2JqZWN0IFVpbnQxNkFycmF5XScsXG4gICAgICAnW29iamVjdCBJbnQzMkFycmF5XScsXG4gICAgICAnW29iamVjdCBVaW50MzJBcnJheV0nLFxuICAgICAgJ1tvYmplY3QgRmxvYXQzMkFycmF5XScsXG4gICAgICAnW29iamVjdCBGbG9hdDY0QXJyYXldJ1xuICAgIF1cblxuICAgIHZhciBpc0RhdGFWaWV3ID0gZnVuY3Rpb24ob2JqKSB7XG4gICAgICByZXR1cm4gb2JqICYmIERhdGFWaWV3LnByb3RvdHlwZS5pc1Byb3RvdHlwZU9mKG9iailcbiAgICB9XG5cbiAgICB2YXIgaXNBcnJheUJ1ZmZlclZpZXcgPSBBcnJheUJ1ZmZlci5pc1ZpZXcgfHwgZnVuY3Rpb24ob2JqKSB7XG4gICAgICByZXR1cm4gb2JqICYmIHZpZXdDbGFzc2VzLmluZGV4T2YoT2JqZWN0LnByb3RvdHlwZS50b1N0cmluZy5jYWxsKG9iaikpID4gLTFcbiAgICB9XG4gIH1cblxuICBmdW5jdGlvbiBub3JtYWxpemVOYW1lKG5hbWUpIHtcbiAgICBpZiAodHlwZW9mIG5hbWUgIT09ICdzdHJpbmcnKSB7XG4gICAgICBuYW1lID0gU3RyaW5nKG5hbWUpXG4gICAgfVxuICAgIGlmICgvW15hLXowLTlcXC0jJCUmJyorLlxcXl9gfH5dL2kudGVzdChuYW1lKSkge1xuICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcignSW52YWxpZCBjaGFyYWN0ZXIgaW4gaGVhZGVyIGZpZWxkIG5hbWUnKVxuICAgIH1cbiAgICByZXR1cm4gbmFtZS50b0xvd2VyQ2FzZSgpXG4gIH1cblxuICBmdW5jdGlvbiBub3JtYWxpemVWYWx1ZSh2YWx1ZSkge1xuICAgIGlmICh0eXBlb2YgdmFsdWUgIT09ICdzdHJpbmcnKSB7XG4gICAgICB2YWx1ZSA9IFN0cmluZyh2YWx1ZSlcbiAgICB9XG4gICAgcmV0dXJuIHZhbHVlXG4gIH1cblxuICAvLyBCdWlsZCBhIGRlc3RydWN0aXZlIGl0ZXJhdG9yIGZvciB0aGUgdmFsdWUgbGlzdFxuICBmdW5jdGlvbiBpdGVyYXRvckZvcihpdGVtcykge1xuICAgIHZhciBpdGVyYXRvciA9IHtcbiAgICAgIG5leHQ6IGZ1bmN0aW9uKCkge1xuICAgICAgICB2YXIgdmFsdWUgPSBpdGVtcy5zaGlmdCgpXG4gICAgICAgIHJldHVybiB7ZG9uZTogdmFsdWUgPT09IHVuZGVmaW5lZCwgdmFsdWU6IHZhbHVlfVxuICAgICAgfVxuICAgIH1cblxuICAgIGlmIChzdXBwb3J0Lml0ZXJhYmxlKSB7XG4gICAgICBpdGVyYXRvcltTeW1ib2wuaXRlcmF0b3JdID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIHJldHVybiBpdGVyYXRvclxuICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiBpdGVyYXRvclxuICB9XG5cbiAgZnVuY3Rpb24gSGVhZGVycyhoZWFkZXJzKSB7XG4gICAgdGhpcy5tYXAgPSB7fVxuXG4gICAgaWYgKGhlYWRlcnMgaW5zdGFuY2VvZiBIZWFkZXJzKSB7XG4gICAgICBoZWFkZXJzLmZvckVhY2goZnVuY3Rpb24odmFsdWUsIG5hbWUpIHtcbiAgICAgICAgdGhpcy5hcHBlbmQobmFtZSwgdmFsdWUpXG4gICAgICB9LCB0aGlzKVxuICAgIH0gZWxzZSBpZiAoQXJyYXkuaXNBcnJheShoZWFkZXJzKSkge1xuICAgICAgaGVhZGVycy5mb3JFYWNoKGZ1bmN0aW9uKGhlYWRlcikge1xuICAgICAgICB0aGlzLmFwcGVuZChoZWFkZXJbMF0sIGhlYWRlclsxXSlcbiAgICAgIH0sIHRoaXMpXG4gICAgfSBlbHNlIGlmIChoZWFkZXJzKSB7XG4gICAgICBPYmplY3QuZ2V0T3duUHJvcGVydHlOYW1lcyhoZWFkZXJzKS5mb3JFYWNoKGZ1bmN0aW9uKG5hbWUpIHtcbiAgICAgICAgdGhpcy5hcHBlbmQobmFtZSwgaGVhZGVyc1tuYW1lXSlcbiAgICAgIH0sIHRoaXMpXG4gICAgfVxuICB9XG5cbiAgSGVhZGVycy5wcm90b3R5cGUuYXBwZW5kID0gZnVuY3Rpb24obmFtZSwgdmFsdWUpIHtcbiAgICBuYW1lID0gbm9ybWFsaXplTmFtZShuYW1lKVxuICAgIHZhbHVlID0gbm9ybWFsaXplVmFsdWUodmFsdWUpXG4gICAgdmFyIG9sZFZhbHVlID0gdGhpcy5tYXBbbmFtZV1cbiAgICB0aGlzLm1hcFtuYW1lXSA9IG9sZFZhbHVlID8gb2xkVmFsdWUrJywnK3ZhbHVlIDogdmFsdWVcbiAgfVxuXG4gIEhlYWRlcnMucHJvdG90eXBlWydkZWxldGUnXSA9IGZ1bmN0aW9uKG5hbWUpIHtcbiAgICBkZWxldGUgdGhpcy5tYXBbbm9ybWFsaXplTmFtZShuYW1lKV1cbiAgfVxuXG4gIEhlYWRlcnMucHJvdG90eXBlLmdldCA9IGZ1bmN0aW9uKG5hbWUpIHtcbiAgICBuYW1lID0gbm9ybWFsaXplTmFtZShuYW1lKVxuICAgIHJldHVybiB0aGlzLmhhcyhuYW1lKSA/IHRoaXMubWFwW25hbWVdIDogbnVsbFxuICB9XG5cbiAgSGVhZGVycy5wcm90b3R5cGUuaGFzID0gZnVuY3Rpb24obmFtZSkge1xuICAgIHJldHVybiB0aGlzLm1hcC5oYXNPd25Qcm9wZXJ0eShub3JtYWxpemVOYW1lKG5hbWUpKVxuICB9XG5cbiAgSGVhZGVycy5wcm90b3R5cGUuc2V0ID0gZnVuY3Rpb24obmFtZSwgdmFsdWUpIHtcbiAgICB0aGlzLm1hcFtub3JtYWxpemVOYW1lKG5hbWUpXSA9IG5vcm1hbGl6ZVZhbHVlKHZhbHVlKVxuICB9XG5cbiAgSGVhZGVycy5wcm90b3R5cGUuZm9yRWFjaCA9IGZ1bmN0aW9uKGNhbGxiYWNrLCB0aGlzQXJnKSB7XG4gICAgZm9yICh2YXIgbmFtZSBpbiB0aGlzLm1hcCkge1xuICAgICAgaWYgKHRoaXMubWFwLmhhc093blByb3BlcnR5KG5hbWUpKSB7XG4gICAgICAgIGNhbGxiYWNrLmNhbGwodGhpc0FyZywgdGhpcy5tYXBbbmFtZV0sIG5hbWUsIHRoaXMpXG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgSGVhZGVycy5wcm90b3R5cGUua2V5cyA9IGZ1bmN0aW9uKCkge1xuICAgIHZhciBpdGVtcyA9IFtdXG4gICAgdGhpcy5mb3JFYWNoKGZ1bmN0aW9uKHZhbHVlLCBuYW1lKSB7IGl0ZW1zLnB1c2gobmFtZSkgfSlcbiAgICByZXR1cm4gaXRlcmF0b3JGb3IoaXRlbXMpXG4gIH1cblxuICBIZWFkZXJzLnByb3RvdHlwZS52YWx1ZXMgPSBmdW5jdGlvbigpIHtcbiAgICB2YXIgaXRlbXMgPSBbXVxuICAgIHRoaXMuZm9yRWFjaChmdW5jdGlvbih2YWx1ZSkgeyBpdGVtcy5wdXNoKHZhbHVlKSB9KVxuICAgIHJldHVybiBpdGVyYXRvckZvcihpdGVtcylcbiAgfVxuXG4gIEhlYWRlcnMucHJvdG90eXBlLmVudHJpZXMgPSBmdW5jdGlvbigpIHtcbiAgICB2YXIgaXRlbXMgPSBbXVxuICAgIHRoaXMuZm9yRWFjaChmdW5jdGlvbih2YWx1ZSwgbmFtZSkgeyBpdGVtcy5wdXNoKFtuYW1lLCB2YWx1ZV0pIH0pXG4gICAgcmV0dXJuIGl0ZXJhdG9yRm9yKGl0ZW1zKVxuICB9XG5cbiAgaWYgKHN1cHBvcnQuaXRlcmFibGUpIHtcbiAgICBIZWFkZXJzLnByb3RvdHlwZVtTeW1ib2wuaXRlcmF0b3JdID0gSGVhZGVycy5wcm90b3R5cGUuZW50cmllc1xuICB9XG5cbiAgZnVuY3Rpb24gY29uc3VtZWQoYm9keSkge1xuICAgIGlmIChib2R5LmJvZHlVc2VkKSB7XG4gICAgICByZXR1cm4gUHJvbWlzZS5yZWplY3QobmV3IFR5cGVFcnJvcignQWxyZWFkeSByZWFkJykpXG4gICAgfVxuICAgIGJvZHkuYm9keVVzZWQgPSB0cnVlXG4gIH1cblxuICBmdW5jdGlvbiBmaWxlUmVhZGVyUmVhZHkocmVhZGVyKSB7XG4gICAgcmV0dXJuIG5ldyBQcm9taXNlKGZ1bmN0aW9uKHJlc29sdmUsIHJlamVjdCkge1xuICAgICAgcmVhZGVyLm9ubG9hZCA9IGZ1bmN0aW9uKCkge1xuICAgICAgICByZXNvbHZlKHJlYWRlci5yZXN1bHQpXG4gICAgICB9XG4gICAgICByZWFkZXIub25lcnJvciA9IGZ1bmN0aW9uKCkge1xuICAgICAgICByZWplY3QocmVhZGVyLmVycm9yKVxuICAgICAgfVxuICAgIH0pXG4gIH1cblxuICBmdW5jdGlvbiByZWFkQmxvYkFzQXJyYXlCdWZmZXIoYmxvYikge1xuICAgIHZhciByZWFkZXIgPSBuZXcgRmlsZVJlYWRlcigpXG4gICAgdmFyIHByb21pc2UgPSBmaWxlUmVhZGVyUmVhZHkocmVhZGVyKVxuICAgIHJlYWRlci5yZWFkQXNBcnJheUJ1ZmZlcihibG9iKVxuICAgIHJldHVybiBwcm9taXNlXG4gIH1cblxuICBmdW5jdGlvbiByZWFkQmxvYkFzVGV4dChibG9iKSB7XG4gICAgdmFyIHJlYWRlciA9IG5ldyBGaWxlUmVhZGVyKClcbiAgICB2YXIgcHJvbWlzZSA9IGZpbGVSZWFkZXJSZWFkeShyZWFkZXIpXG4gICAgcmVhZGVyLnJlYWRBc1RleHQoYmxvYilcbiAgICByZXR1cm4gcHJvbWlzZVxuICB9XG5cbiAgZnVuY3Rpb24gcmVhZEFycmF5QnVmZmVyQXNUZXh0KGJ1Zikge1xuICAgIHZhciB2aWV3ID0gbmV3IFVpbnQ4QXJyYXkoYnVmKVxuICAgIHZhciBjaGFycyA9IG5ldyBBcnJheSh2aWV3Lmxlbmd0aClcblxuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgdmlldy5sZW5ndGg7IGkrKykge1xuICAgICAgY2hhcnNbaV0gPSBTdHJpbmcuZnJvbUNoYXJDb2RlKHZpZXdbaV0pXG4gICAgfVxuICAgIHJldHVybiBjaGFycy5qb2luKCcnKVxuICB9XG5cbiAgZnVuY3Rpb24gYnVmZmVyQ2xvbmUoYnVmKSB7XG4gICAgaWYgKGJ1Zi5zbGljZSkge1xuICAgICAgcmV0dXJuIGJ1Zi5zbGljZSgwKVxuICAgIH0gZWxzZSB7XG4gICAgICB2YXIgdmlldyA9IG5ldyBVaW50OEFycmF5KGJ1Zi5ieXRlTGVuZ3RoKVxuICAgICAgdmlldy5zZXQobmV3IFVpbnQ4QXJyYXkoYnVmKSlcbiAgICAgIHJldHVybiB2aWV3LmJ1ZmZlclxuICAgIH1cbiAgfVxuXG4gIGZ1bmN0aW9uIEJvZHkoKSB7XG4gICAgdGhpcy5ib2R5VXNlZCA9IGZhbHNlXG5cbiAgICB0aGlzLl9pbml0Qm9keSA9IGZ1bmN0aW9uKGJvZHkpIHtcbiAgICAgIHRoaXMuX2JvZHlJbml0ID0gYm9keVxuICAgICAgaWYgKCFib2R5KSB7XG4gICAgICAgIHRoaXMuX2JvZHlUZXh0ID0gJydcbiAgICAgIH0gZWxzZSBpZiAodHlwZW9mIGJvZHkgPT09ICdzdHJpbmcnKSB7XG4gICAgICAgIHRoaXMuX2JvZHlUZXh0ID0gYm9keVxuICAgICAgfSBlbHNlIGlmIChzdXBwb3J0LmJsb2IgJiYgQmxvYi5wcm90b3R5cGUuaXNQcm90b3R5cGVPZihib2R5KSkge1xuICAgICAgICB0aGlzLl9ib2R5QmxvYiA9IGJvZHlcbiAgICAgIH0gZWxzZSBpZiAoc3VwcG9ydC5mb3JtRGF0YSAmJiBGb3JtRGF0YS5wcm90b3R5cGUuaXNQcm90b3R5cGVPZihib2R5KSkge1xuICAgICAgICB0aGlzLl9ib2R5Rm9ybURhdGEgPSBib2R5XG4gICAgICB9IGVsc2UgaWYgKHN1cHBvcnQuc2VhcmNoUGFyYW1zICYmIFVSTFNlYXJjaFBhcmFtcy5wcm90b3R5cGUuaXNQcm90b3R5cGVPZihib2R5KSkge1xuICAgICAgICB0aGlzLl9ib2R5VGV4dCA9IGJvZHkudG9TdHJpbmcoKVxuICAgICAgfSBlbHNlIGlmIChzdXBwb3J0LmFycmF5QnVmZmVyICYmIHN1cHBvcnQuYmxvYiAmJiBpc0RhdGFWaWV3KGJvZHkpKSB7XG4gICAgICAgIHRoaXMuX2JvZHlBcnJheUJ1ZmZlciA9IGJ1ZmZlckNsb25lKGJvZHkuYnVmZmVyKVxuICAgICAgICAvLyBJRSAxMC0xMSBjYW4ndCBoYW5kbGUgYSBEYXRhVmlldyBib2R5LlxuICAgICAgICB0aGlzLl9ib2R5SW5pdCA9IG5ldyBCbG9iKFt0aGlzLl9ib2R5QXJyYXlCdWZmZXJdKVxuICAgICAgfSBlbHNlIGlmIChzdXBwb3J0LmFycmF5QnVmZmVyICYmIChBcnJheUJ1ZmZlci5wcm90b3R5cGUuaXNQcm90b3R5cGVPZihib2R5KSB8fCBpc0FycmF5QnVmZmVyVmlldyhib2R5KSkpIHtcbiAgICAgICAgdGhpcy5fYm9keUFycmF5QnVmZmVyID0gYnVmZmVyQ2xvbmUoYm9keSlcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcigndW5zdXBwb3J0ZWQgQm9keUluaXQgdHlwZScpXG4gICAgICB9XG5cbiAgICAgIGlmICghdGhpcy5oZWFkZXJzLmdldCgnY29udGVudC10eXBlJykpIHtcbiAgICAgICAgaWYgKHR5cGVvZiBib2R5ID09PSAnc3RyaW5nJykge1xuICAgICAgICAgIHRoaXMuaGVhZGVycy5zZXQoJ2NvbnRlbnQtdHlwZScsICd0ZXh0L3BsYWluO2NoYXJzZXQ9VVRGLTgnKVxuICAgICAgICB9IGVsc2UgaWYgKHRoaXMuX2JvZHlCbG9iICYmIHRoaXMuX2JvZHlCbG9iLnR5cGUpIHtcbiAgICAgICAgICB0aGlzLmhlYWRlcnMuc2V0KCdjb250ZW50LXR5cGUnLCB0aGlzLl9ib2R5QmxvYi50eXBlKVxuICAgICAgICB9IGVsc2UgaWYgKHN1cHBvcnQuc2VhcmNoUGFyYW1zICYmIFVSTFNlYXJjaFBhcmFtcy5wcm90b3R5cGUuaXNQcm90b3R5cGVPZihib2R5KSkge1xuICAgICAgICAgIHRoaXMuaGVhZGVycy5zZXQoJ2NvbnRlbnQtdHlwZScsICdhcHBsaWNhdGlvbi94LXd3dy1mb3JtLXVybGVuY29kZWQ7Y2hhcnNldD1VVEYtOCcpXG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAoc3VwcG9ydC5ibG9iKSB7XG4gICAgICB0aGlzLmJsb2IgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgdmFyIHJlamVjdGVkID0gY29uc3VtZWQodGhpcylcbiAgICAgICAgaWYgKHJlamVjdGVkKSB7XG4gICAgICAgICAgcmV0dXJuIHJlamVjdGVkXG4gICAgICAgIH1cblxuICAgICAgICBpZiAodGhpcy5fYm9keUJsb2IpIHtcbiAgICAgICAgICByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKHRoaXMuX2JvZHlCbG9iKVxuICAgICAgICB9IGVsc2UgaWYgKHRoaXMuX2JvZHlBcnJheUJ1ZmZlcikge1xuICAgICAgICAgIHJldHVybiBQcm9taXNlLnJlc29sdmUobmV3IEJsb2IoW3RoaXMuX2JvZHlBcnJheUJ1ZmZlcl0pKVxuICAgICAgICB9IGVsc2UgaWYgKHRoaXMuX2JvZHlGb3JtRGF0YSkge1xuICAgICAgICAgIHRocm93IG5ldyBFcnJvcignY291bGQgbm90IHJlYWQgRm9ybURhdGEgYm9keSBhcyBibG9iJylcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKG5ldyBCbG9iKFt0aGlzLl9ib2R5VGV4dF0pKVxuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIHRoaXMuYXJyYXlCdWZmZXIgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgaWYgKHRoaXMuX2JvZHlBcnJheUJ1ZmZlcikge1xuICAgICAgICAgIHJldHVybiBjb25zdW1lZCh0aGlzKSB8fCBQcm9taXNlLnJlc29sdmUodGhpcy5fYm9keUFycmF5QnVmZmVyKVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHJldHVybiB0aGlzLmJsb2IoKS50aGVuKHJlYWRCbG9iQXNBcnJheUJ1ZmZlcilcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cblxuICAgIHRoaXMudGV4dCA9IGZ1bmN0aW9uKCkge1xuICAgICAgdmFyIHJlamVjdGVkID0gY29uc3VtZWQodGhpcylcbiAgICAgIGlmIChyZWplY3RlZCkge1xuICAgICAgICByZXR1cm4gcmVqZWN0ZWRcbiAgICAgIH1cblxuICAgICAgaWYgKHRoaXMuX2JvZHlCbG9iKSB7XG4gICAgICAgIHJldHVybiByZWFkQmxvYkFzVGV4dCh0aGlzLl9ib2R5QmxvYilcbiAgICAgIH0gZWxzZSBpZiAodGhpcy5fYm9keUFycmF5QnVmZmVyKSB7XG4gICAgICAgIHJldHVybiBQcm9taXNlLnJlc29sdmUocmVhZEFycmF5QnVmZmVyQXNUZXh0KHRoaXMuX2JvZHlBcnJheUJ1ZmZlcikpXG4gICAgICB9IGVsc2UgaWYgKHRoaXMuX2JvZHlGb3JtRGF0YSkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ2NvdWxkIG5vdCByZWFkIEZvcm1EYXRhIGJvZHkgYXMgdGV4dCcpXG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKHRoaXMuX2JvZHlUZXh0KVxuICAgICAgfVxuICAgIH1cblxuICAgIGlmIChzdXBwb3J0LmZvcm1EYXRhKSB7XG4gICAgICB0aGlzLmZvcm1EYXRhID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIHJldHVybiB0aGlzLnRleHQoKS50aGVuKGRlY29kZSlcbiAgICAgIH1cbiAgICB9XG5cbiAgICB0aGlzLmpzb24gPSBmdW5jdGlvbigpIHtcbiAgICAgIHJldHVybiB0aGlzLnRleHQoKS50aGVuKEpTT04ucGFyc2UpXG4gICAgfVxuXG4gICAgcmV0dXJuIHRoaXNcbiAgfVxuXG4gIC8vIEhUVFAgbWV0aG9kcyB3aG9zZSBjYXBpdGFsaXphdGlvbiBzaG91bGQgYmUgbm9ybWFsaXplZFxuICB2YXIgbWV0aG9kcyA9IFsnREVMRVRFJywgJ0dFVCcsICdIRUFEJywgJ09QVElPTlMnLCAnUE9TVCcsICdQVVQnXVxuXG4gIGZ1bmN0aW9uIG5vcm1hbGl6ZU1ldGhvZChtZXRob2QpIHtcbiAgICB2YXIgdXBjYXNlZCA9IG1ldGhvZC50b1VwcGVyQ2FzZSgpXG4gICAgcmV0dXJuIChtZXRob2RzLmluZGV4T2YodXBjYXNlZCkgPiAtMSkgPyB1cGNhc2VkIDogbWV0aG9kXG4gIH1cblxuICBmdW5jdGlvbiBSZXF1ZXN0KGlucHV0LCBvcHRpb25zKSB7XG4gICAgb3B0aW9ucyA9IG9wdGlvbnMgfHwge31cbiAgICB2YXIgYm9keSA9IG9wdGlvbnMuYm9keVxuXG4gICAgaWYgKGlucHV0IGluc3RhbmNlb2YgUmVxdWVzdCkge1xuICAgICAgaWYgKGlucHV0LmJvZHlVc2VkKSB7XG4gICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ0FscmVhZHkgcmVhZCcpXG4gICAgICB9XG4gICAgICB0aGlzLnVybCA9IGlucHV0LnVybFxuICAgICAgdGhpcy5jcmVkZW50aWFscyA9IGlucHV0LmNyZWRlbnRpYWxzXG4gICAgICBpZiAoIW9wdGlvbnMuaGVhZGVycykge1xuICAgICAgICB0aGlzLmhlYWRlcnMgPSBuZXcgSGVhZGVycyhpbnB1dC5oZWFkZXJzKVxuICAgICAgfVxuICAgICAgdGhpcy5tZXRob2QgPSBpbnB1dC5tZXRob2RcbiAgICAgIHRoaXMubW9kZSA9IGlucHV0Lm1vZGVcbiAgICAgIGlmICghYm9keSAmJiBpbnB1dC5fYm9keUluaXQgIT0gbnVsbCkge1xuICAgICAgICBib2R5ID0gaW5wdXQuX2JvZHlJbml0XG4gICAgICAgIGlucHV0LmJvZHlVc2VkID0gdHJ1ZVxuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLnVybCA9IFN0cmluZyhpbnB1dClcbiAgICB9XG5cbiAgICB0aGlzLmNyZWRlbnRpYWxzID0gb3B0aW9ucy5jcmVkZW50aWFscyB8fCB0aGlzLmNyZWRlbnRpYWxzIHx8ICdvbWl0J1xuICAgIGlmIChvcHRpb25zLmhlYWRlcnMgfHwgIXRoaXMuaGVhZGVycykge1xuICAgICAgdGhpcy5oZWFkZXJzID0gbmV3IEhlYWRlcnMob3B0aW9ucy5oZWFkZXJzKVxuICAgIH1cbiAgICB0aGlzLm1ldGhvZCA9IG5vcm1hbGl6ZU1ldGhvZChvcHRpb25zLm1ldGhvZCB8fCB0aGlzLm1ldGhvZCB8fCAnR0VUJylcbiAgICB0aGlzLm1vZGUgPSBvcHRpb25zLm1vZGUgfHwgdGhpcy5tb2RlIHx8IG51bGxcbiAgICB0aGlzLnJlZmVycmVyID0gbnVsbFxuXG4gICAgaWYgKCh0aGlzLm1ldGhvZCA9PT0gJ0dFVCcgfHwgdGhpcy5tZXRob2QgPT09ICdIRUFEJykgJiYgYm9keSkge1xuICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcignQm9keSBub3QgYWxsb3dlZCBmb3IgR0VUIG9yIEhFQUQgcmVxdWVzdHMnKVxuICAgIH1cbiAgICB0aGlzLl9pbml0Qm9keShib2R5KVxuICB9XG5cbiAgUmVxdWVzdC5wcm90b3R5cGUuY2xvbmUgPSBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gbmV3IFJlcXVlc3QodGhpcywgeyBib2R5OiB0aGlzLl9ib2R5SW5pdCB9KVxuICB9XG5cbiAgZnVuY3Rpb24gZGVjb2RlKGJvZHkpIHtcbiAgICB2YXIgZm9ybSA9IG5ldyBGb3JtRGF0YSgpXG4gICAgYm9keS50cmltKCkuc3BsaXQoJyYnKS5mb3JFYWNoKGZ1bmN0aW9uKGJ5dGVzKSB7XG4gICAgICBpZiAoYnl0ZXMpIHtcbiAgICAgICAgdmFyIHNwbGl0ID0gYnl0ZXMuc3BsaXQoJz0nKVxuICAgICAgICB2YXIgbmFtZSA9IHNwbGl0LnNoaWZ0KCkucmVwbGFjZSgvXFwrL2csICcgJylcbiAgICAgICAgdmFyIHZhbHVlID0gc3BsaXQuam9pbignPScpLnJlcGxhY2UoL1xcKy9nLCAnICcpXG4gICAgICAgIGZvcm0uYXBwZW5kKGRlY29kZVVSSUNvbXBvbmVudChuYW1lKSwgZGVjb2RlVVJJQ29tcG9uZW50KHZhbHVlKSlcbiAgICAgIH1cbiAgICB9KVxuICAgIHJldHVybiBmb3JtXG4gIH1cblxuICBmdW5jdGlvbiBwYXJzZUhlYWRlcnMocmF3SGVhZGVycykge1xuICAgIHZhciBoZWFkZXJzID0gbmV3IEhlYWRlcnMoKVxuICAgIHJhd0hlYWRlcnMuc3BsaXQoL1xccj9cXG4vKS5mb3JFYWNoKGZ1bmN0aW9uKGxpbmUpIHtcbiAgICAgIHZhciBwYXJ0cyA9IGxpbmUuc3BsaXQoJzonKVxuICAgICAgdmFyIGtleSA9IHBhcnRzLnNoaWZ0KCkudHJpbSgpXG4gICAgICBpZiAoa2V5KSB7XG4gICAgICAgIHZhciB2YWx1ZSA9IHBhcnRzLmpvaW4oJzonKS50cmltKClcbiAgICAgICAgaGVhZGVycy5hcHBlbmQoa2V5LCB2YWx1ZSlcbiAgICAgIH1cbiAgICB9KVxuICAgIHJldHVybiBoZWFkZXJzXG4gIH1cblxuICBCb2R5LmNhbGwoUmVxdWVzdC5wcm90b3R5cGUpXG5cbiAgZnVuY3Rpb24gUmVzcG9uc2UoYm9keUluaXQsIG9wdGlvbnMpIHtcbiAgICBpZiAoIW9wdGlvbnMpIHtcbiAgICAgIG9wdGlvbnMgPSB7fVxuICAgIH1cblxuICAgIHRoaXMudHlwZSA9ICdkZWZhdWx0J1xuICAgIHRoaXMuc3RhdHVzID0gJ3N0YXR1cycgaW4gb3B0aW9ucyA/IG9wdGlvbnMuc3RhdHVzIDogMjAwXG4gICAgdGhpcy5vayA9IHRoaXMuc3RhdHVzID49IDIwMCAmJiB0aGlzLnN0YXR1cyA8IDMwMFxuICAgIHRoaXMuc3RhdHVzVGV4dCA9ICdzdGF0dXNUZXh0JyBpbiBvcHRpb25zID8gb3B0aW9ucy5zdGF0dXNUZXh0IDogJ09LJ1xuICAgIHRoaXMuaGVhZGVycyA9IG5ldyBIZWFkZXJzKG9wdGlvbnMuaGVhZGVycylcbiAgICB0aGlzLnVybCA9IG9wdGlvbnMudXJsIHx8ICcnXG4gICAgdGhpcy5faW5pdEJvZHkoYm9keUluaXQpXG4gIH1cblxuICBCb2R5LmNhbGwoUmVzcG9uc2UucHJvdG90eXBlKVxuXG4gIFJlc3BvbnNlLnByb3RvdHlwZS5jbG9uZSA9IGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiBuZXcgUmVzcG9uc2UodGhpcy5fYm9keUluaXQsIHtcbiAgICAgIHN0YXR1czogdGhpcy5zdGF0dXMsXG4gICAgICBzdGF0dXNUZXh0OiB0aGlzLnN0YXR1c1RleHQsXG4gICAgICBoZWFkZXJzOiBuZXcgSGVhZGVycyh0aGlzLmhlYWRlcnMpLFxuICAgICAgdXJsOiB0aGlzLnVybFxuICAgIH0pXG4gIH1cblxuICBSZXNwb25zZS5lcnJvciA9IGZ1bmN0aW9uKCkge1xuICAgIHZhciByZXNwb25zZSA9IG5ldyBSZXNwb25zZShudWxsLCB7c3RhdHVzOiAwLCBzdGF0dXNUZXh0OiAnJ30pXG4gICAgcmVzcG9uc2UudHlwZSA9ICdlcnJvcidcbiAgICByZXR1cm4gcmVzcG9uc2VcbiAgfVxuXG4gIHZhciByZWRpcmVjdFN0YXR1c2VzID0gWzMwMSwgMzAyLCAzMDMsIDMwNywgMzA4XVxuXG4gIFJlc3BvbnNlLnJlZGlyZWN0ID0gZnVuY3Rpb24odXJsLCBzdGF0dXMpIHtcbiAgICBpZiAocmVkaXJlY3RTdGF0dXNlcy5pbmRleE9mKHN0YXR1cykgPT09IC0xKSB7XG4gICAgICB0aHJvdyBuZXcgUmFuZ2VFcnJvcignSW52YWxpZCBzdGF0dXMgY29kZScpXG4gICAgfVxuXG4gICAgcmV0dXJuIG5ldyBSZXNwb25zZShudWxsLCB7c3RhdHVzOiBzdGF0dXMsIGhlYWRlcnM6IHtsb2NhdGlvbjogdXJsfX0pXG4gIH1cblxuICBzZWxmLkhlYWRlcnMgPSBIZWFkZXJzXG4gIHNlbGYuUmVxdWVzdCA9IFJlcXVlc3RcbiAgc2VsZi5SZXNwb25zZSA9IFJlc3BvbnNlXG5cbiAgc2VsZi5mZXRjaCA9IGZ1bmN0aW9uKGlucHV0LCBpbml0KSB7XG4gICAgcmV0dXJuIG5ldyBQcm9taXNlKGZ1bmN0aW9uKHJlc29sdmUsIHJlamVjdCkge1xuICAgICAgdmFyIHJlcXVlc3QgPSBuZXcgUmVxdWVzdChpbnB1dCwgaW5pdClcbiAgICAgIHZhciB4aHIgPSBuZXcgWE1MSHR0cFJlcXVlc3QoKVxuXG4gICAgICB4aHIub25sb2FkID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIHZhciBvcHRpb25zID0ge1xuICAgICAgICAgIHN0YXR1czogeGhyLnN0YXR1cyxcbiAgICAgICAgICBzdGF0dXNUZXh0OiB4aHIuc3RhdHVzVGV4dCxcbiAgICAgICAgICBoZWFkZXJzOiBwYXJzZUhlYWRlcnMoeGhyLmdldEFsbFJlc3BvbnNlSGVhZGVycygpIHx8ICcnKVxuICAgICAgICB9XG4gICAgICAgIG9wdGlvbnMudXJsID0gJ3Jlc3BvbnNlVVJMJyBpbiB4aHIgPyB4aHIucmVzcG9uc2VVUkwgOiBvcHRpb25zLmhlYWRlcnMuZ2V0KCdYLVJlcXVlc3QtVVJMJylcbiAgICAgICAgdmFyIGJvZHkgPSAncmVzcG9uc2UnIGluIHhociA/IHhoci5yZXNwb25zZSA6IHhoci5yZXNwb25zZVRleHRcbiAgICAgICAgcmVzb2x2ZShuZXcgUmVzcG9uc2UoYm9keSwgb3B0aW9ucykpXG4gICAgICB9XG5cbiAgICAgIHhoci5vbmVycm9yID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIHJlamVjdChuZXcgVHlwZUVycm9yKCdOZXR3b3JrIHJlcXVlc3QgZmFpbGVkJykpXG4gICAgICB9XG5cbiAgICAgIHhoci5vbnRpbWVvdXQgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgcmVqZWN0KG5ldyBUeXBlRXJyb3IoJ05ldHdvcmsgcmVxdWVzdCBmYWlsZWQnKSlcbiAgICAgIH1cblxuICAgICAgeGhyLm9wZW4ocmVxdWVzdC5tZXRob2QsIHJlcXVlc3QudXJsLCB0cnVlKVxuXG4gICAgICBpZiAocmVxdWVzdC5jcmVkZW50aWFscyA9PT0gJ2luY2x1ZGUnKSB7XG4gICAgICAgIHhoci53aXRoQ3JlZGVudGlhbHMgPSB0cnVlXG4gICAgICB9XG5cbiAgICAgIGlmICgncmVzcG9uc2VUeXBlJyBpbiB4aHIgJiYgc3VwcG9ydC5ibG9iKSB7XG4gICAgICAgIHhoci5yZXNwb25zZVR5cGUgPSAnYmxvYidcbiAgICAgIH1cblxuICAgICAgcmVxdWVzdC5oZWFkZXJzLmZvckVhY2goZnVuY3Rpb24odmFsdWUsIG5hbWUpIHtcbiAgICAgICAgeGhyLnNldFJlcXVlc3RIZWFkZXIobmFtZSwgdmFsdWUpXG4gICAgICB9KVxuXG4gICAgICB4aHIuc2VuZCh0eXBlb2YgcmVxdWVzdC5fYm9keUluaXQgPT09ICd1bmRlZmluZWQnID8gbnVsbCA6IHJlcXVlc3QuX2JvZHlJbml0KVxuICAgIH0pXG4gIH1cbiAgc2VsZi5mZXRjaC5wb2x5ZmlsbCA9IHRydWVcbn0pKHR5cGVvZiBzZWxmICE9PSAndW5kZWZpbmVkJyA/IHNlbGYgOiB0aGlzKTtcbiIsIm1vZHVsZS5leHBvcnRzID0gT2JqZWN0LmZyZWV6ZSh7XCJiaWxsXCI6e1widm9sdW1lXCI6XCJjb2RlVm9sdW1lXCIsXCJwYWdlc1wiOlwiY29kZVBhZ2VzXCIsXCJudW1iZXJcIjpcImJpbGxOdW1iZXJcIn0sXCJjYXNlXCI6e1widm9sdW1lXCI6XCJyZXBvcnRlclZvbHVtZVwiLFwicGFnZXNcIjpcImZpcnN0UGFnZVwiLFwiZGF0ZVwiOlwiZGF0ZURlY2lkZWRcIixcIm51bWJlclwiOlwiZG9ja2V0TnVtYmVyXCIsXCJ0aXRsZVwiOlwiY2FzZU5hbWVcIn0sXCJ0aGVzaXNcIjp7XCJwdWJsaXNoZXJcIjpcInVuaXZlcnNpdHlcIixcInR5cGVcIjpcInRoZXNpc1R5cGVcIn0sXCJmaWxtXCI6e1wicHVibGlzaGVyXCI6XCJkaXN0cmlidXRvclwiLFwidHlwZVwiOlwiZ2VucmVcIixcIm1lZGl1bVwiOlwidmlkZW9SZWNvcmRpbmdGb3JtYXRcIn0sXCJyZXBvcnRcIjp7XCJwdWJsaXNoZXJcIjpcImluc3RpdHV0aW9uXCIsXCJudW1iZXJcIjpcInJlcG9ydE51bWJlclwiLFwidHlwZVwiOlwicmVwb3J0VHlwZVwifSxcImF1ZGlvUmVjb3JkaW5nXCI6e1wicHVibGlzaGVyXCI6XCJsYWJlbFwiLFwibWVkaXVtXCI6XCJhdWRpb1JlY29yZGluZ0Zvcm1hdFwifSxcInZpZGVvUmVjb3JkaW5nXCI6e1wicHVibGlzaGVyXCI6XCJzdHVkaW9cIixcIm1lZGl1bVwiOlwidmlkZW9SZWNvcmRpbmdGb3JtYXRcIn0sXCJ0dkJyb2FkY2FzdFwiOntcInB1Ymxpc2hlclwiOlwibmV0d29ya1wiLFwicHVibGljYXRpb25UaXRsZVwiOlwicHJvZ3JhbVRpdGxlXCIsXCJudW1iZXJcIjpcImVwaXNvZGVOdW1iZXJcIixcIm1lZGl1bVwiOlwidmlkZW9SZWNvcmRpbmdGb3JtYXRcIn0sXCJyYWRpb0Jyb2FkY2FzdFwiOntcInB1Ymxpc2hlclwiOlwibmV0d29ya1wiLFwicHVibGljYXRpb25UaXRsZVwiOlwicHJvZ3JhbVRpdGxlXCIsXCJudW1iZXJcIjpcImVwaXNvZGVOdW1iZXJcIixcIm1lZGl1bVwiOlwiYXVkaW9SZWNvcmRpbmdGb3JtYXRcIn0sXCJjb21wdXRlclByb2dyYW1cIjp7XCJwdWJsaXNoZXJcIjpcImNvbXBhbnlcIn0sXCJib29rU2VjdGlvblwiOntcInB1YmxpY2F0aW9uVGl0bGVcIjpcImJvb2tUaXRsZVwifSxcImNvbmZlcmVuY2VQYXBlclwiOntcInB1YmxpY2F0aW9uVGl0bGVcIjpcInByb2NlZWRpbmdzVGl0bGVcIn0sXCJ3ZWJwYWdlXCI6e1wicHVibGljYXRpb25UaXRsZVwiOlwid2Vic2l0ZVRpdGxlXCIsXCJ0eXBlXCI6XCJ3ZWJzaXRlVHlwZVwifSxcImJsb2dQb3N0XCI6e1wicHVibGljYXRpb25UaXRsZVwiOlwiYmxvZ1RpdGxlXCIsXCJ0eXBlXCI6XCJ3ZWJzaXRlVHlwZVwifSxcImZvcnVtUG9zdFwiOntcInB1YmxpY2F0aW9uVGl0bGVcIjpcImZvcnVtVGl0bGVcIixcInR5cGVcIjpcInBvc3RUeXBlXCJ9LFwiZW5jeWNsb3BlZGlhQXJ0aWNsZVwiOntcInB1YmxpY2F0aW9uVGl0bGVcIjpcImVuY3ljbG9wZWRpYVRpdGxlXCJ9LFwiZGljdGlvbmFyeUVudHJ5XCI6e1wicHVibGljYXRpb25UaXRsZVwiOlwiZGljdGlvbmFyeVRpdGxlXCJ9LFwicGF0ZW50XCI6e1wiZGF0ZVwiOlwiaXNzdWVEYXRlXCIsXCJudW1iZXJcIjpcInBhdGVudE51bWJlclwifSxcInN0YXR1dGVcIjp7XCJkYXRlXCI6XCJkYXRlRW5hY3RlZFwiLFwibnVtYmVyXCI6XCJwdWJsaWNMYXdOdW1iZXJcIixcInRpdGxlXCI6XCJuYW1lT2ZBY3RcIn0sXCJoZWFyaW5nXCI6e1wibnVtYmVyXCI6XCJkb2N1bWVudE51bWJlclwifSxcInBvZGNhc3RcIjp7XCJudW1iZXJcIjpcImVwaXNvZGVOdW1iZXJcIixcIm1lZGl1bVwiOlwiYXVkaW9GaWxlVHlwZVwifSxcImxldHRlclwiOntcInR5cGVcIjpcImxldHRlclR5cGVcIn0sXCJtYW51c2NyaXB0XCI6e1widHlwZVwiOlwibWFudXNjcmlwdFR5cGVcIn0sXCJtYXBcIjp7XCJ0eXBlXCI6XCJtYXBUeXBlXCJ9LFwicHJlc2VudGF0aW9uXCI6e1widHlwZVwiOlwicHJlc2VudGF0aW9uVHlwZVwifSxcImludGVydmlld1wiOntcIm1lZGl1bVwiOlwiaW50ZXJ2aWV3TWVkaXVtXCJ9LFwiYXJ0d29ya1wiOntcIm1lZGl1bVwiOlwiYXJ0d29ya01lZGl1bVwifSxcImVtYWlsXCI6e1widGl0bGVcIjpcInN1YmplY3RcIn19KTsiLCIndXNlIHN0cmljdCc7XG5cbmNvbnN0IHsgdXVpZDQsIGlzTGlrZVpvdGVyb0l0ZW0gfSA9IHJlcXVpcmUoJy4vdXRpbHMnKTtcbmNvbnN0IGRlZmF1bHRzID0gcmVxdWlyZSgnLi9kZWZhdWx0cycpO1xuY29uc3QgaXRlbVRvQ1NMSlNPTiA9IHJlcXVpcmUoJy4uL3pvdGVyby1zaGltL2l0ZW0tdG8tY3NsLWpzb24nKTtcbmNvbnN0IGRhdGVUb1NxbCA9IHJlcXVpcmUoJy4uL3pvdGVyby1zaGltL2RhdGUtdG8tc3FsJyk7XG5jb25zdCBbIENPTVBMRVRFLCBNVUxUSVBMRV9JVEVNUywgRkFJTEVEIF0gPSBbICdDT01QTEVURScsICdNVUxUSVBMRV9JVEVNUycsICdGQUlMRUQnIF07XG5cbmNsYXNzIFpvdGVyb0JpYiB7XG5cdGNvbnN0cnVjdG9yKG9wdHMpIHtcblx0XHR0aGlzLm9wdHMgPSB7XG5cdFx0XHRzZXNzaW9uaWQ6IHV1aWQ0KCksXG5cdFx0XHQuLi5kZWZhdWx0cygpLFxuXHRcdFx0Li4ub3B0c1xuXHRcdH07XG5cblx0XHRpZih0aGlzLm9wdHMucGVyc2lzdCAmJiB0aGlzLm9wdHMuc3RvcmFnZSkge1xuXHRcdFx0aWYoISgnZ2V0SXRlbScgaW4gdGhpcy5vcHRzLnN0b3JhZ2UgfHxcblx0XHRcdFx0J3NldEl0ZW0nIGluIHRoaXMub3B0cy5zdG9yYWdlIHx8XG5cdFx0XHRcdCdjbGVhcicgaW4gdGhpcy5vcHRzLnN0b3JhZ2Vcblx0XHRcdCkpIHtcblx0XHRcdFx0dGhyb3cgbmV3IEVycm9yKCdJbnZhbGlkIHN0b3JhZ2UgZW5naW5lIHByb3ZpZGVkJyk7XG5cdFx0XHR9XG5cdFx0XHRpZih0aGlzLm9wdHMub3ZlcnJpZGUpIHtcblx0XHRcdFx0dGhpcy5jbGVhckl0ZW1zKCk7XG5cdFx0XHR9XG5cdFx0XHR0aGlzLml0ZW1zID0gWy4uLnRoaXMub3B0cy5pbml0aWFsSXRlbXMsIC4uLnRoaXMuZ2V0SXRlbXNTdG9yYWdlKCldXG5cdFx0XHRcdC5maWx0ZXIoaXNMaWtlWm90ZXJvSXRlbSk7XG5cdFx0XHR0aGlzLnNldEl0ZW1zU3RvcmFnZSh0aGlzLml0ZW1zKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0dGhpcy5pdGVtcyA9IFsuLi50aGlzLm9wdHMuaW5pdGlhbEl0ZW1zXS5maWx0ZXIoaXNMaWtlWm90ZXJvSXRlbSk7XG5cdFx0fVxuXHR9XG5cblx0Z2V0SXRlbXNTdG9yYWdlKCkge1xuXHRcdGxldCBpdGVtcyA9IHRoaXMub3B0cy5zdG9yYWdlLmdldEl0ZW0oYCR7dGhpcy5vcHRzLnN0b3JhZ2VQcmVmaXh9LWl0ZW1zYCk7XG5cdFx0cmV0dXJuIGl0ZW1zID8gSlNPTi5wYXJzZShpdGVtcykgOiBbXTtcblx0fVxuXG5cdHNldEl0ZW1zU3RvcmFnZShpdGVtcykge1xuXHRcdHRoaXMub3B0cy5zdG9yYWdlLnNldEl0ZW0oXG5cdFx0XHRgJHt0aGlzLm9wdHMuc3RvcmFnZVByZWZpeH0taXRlbXNgLFxuXHRcdFx0SlNPTi5zdHJpbmdpZnkoaXRlbXMpXG5cdFx0KTtcblx0fVxuXG5cdHJlbG9hZEl0ZW1zKCkge1xuXHRcdHRoaXMuaXRlbXMgPSB0aGlzLmdldEl0ZW1zU3RvcmFnZSgpO1xuXHR9XG5cblx0YWRkSXRlbShpdGVtKSB7XG5cdFx0aWYoIWlzTGlrZVpvdGVyb0l0ZW0oaXRlbSkpIHtcblx0XHRcdHRocm93IG5ldyBFcnJvcignRmFpbGVkIHRvIGFkZCBpdGVtJyk7XG5cdFx0fVxuXHRcdHRoaXMuaXRlbXMucHVzaChpdGVtKTtcblx0XHRpZih0aGlzLm9wdHMucGVyc2lzdCkge1xuXHRcdFx0dGhpcy5zZXRJdGVtc1N0b3JhZ2UodGhpcy5pdGVtcyk7XG5cdFx0fVxuXHR9XG5cblx0dXBkYXRlSXRlbShpbmRleCwgaXRlbSkge1xuXHRcdHRoaXMuaXRlbXNbaW5kZXhdID0gaXRlbTtcblx0XHRpZih0aGlzLm9wdHMucGVyc2lzdCkge1xuXHRcdFx0dGhpcy5zZXRJdGVtc1N0b3JhZ2UodGhpcy5pdGVtcyk7XG5cdFx0fVxuXHR9XG5cblx0cmVtb3ZlSXRlbShpdGVtKSB7XG5cdFx0bGV0IGluZGV4ID0gdGhpcy5pdGVtcy5pbmRleE9mKGl0ZW0pO1xuXHRcdGlmKGluZGV4ICE9PSAtMSkge1xuXHRcdFx0dGhpcy5pdGVtcy5zcGxpY2UoaW5kZXgsIDEpO1xuXHRcdFx0aWYodGhpcy5vcHRzLnBlcnNpc3QpIHtcblx0XHRcdFx0dGhpcy5zZXRJdGVtc1N0b3JhZ2UodGhpcy5pdGVtcyk7XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gaXRlbTtcblx0XHR9XG5cdFx0cmV0dXJuIGZhbHNlO1xuXHR9XG5cblx0Y2xlYXJJdGVtcygpIHtcblx0XHR0aGlzLml0ZW1zID0gW107XG5cdFx0aWYodGhpcy5vcHRzLnBlcnNpc3QpIHtcblx0XHRcdHRoaXMuc2V0SXRlbXNTdG9yYWdlKHRoaXMuaXRlbXMpO1xuXHRcdH1cblx0fVxuXG5cdGdldCBpdGVtc0NTTCgpIHtcblx0XHRyZXR1cm4gdGhpcy5pdGVtcy5tYXAoaSA9PiBpdGVtVG9DU0xKU09OKGkpKVxuXHR9XG5cblx0Z2V0IGl0ZW1zUmF3KCkge1xuXHRcdHJldHVybiB0aGlzLml0ZW1zO1xuXHR9XG5cblx0YXN5bmMgZXhwb3J0SXRlbXMoZm9ybWF0KSB7XG5cdFx0bGV0IHRyYW5zbGF0aW9uU2VydmVyVXJsID0gYCR7dGhpcy5vcHRzLnRyYW5zbGF0aW9uU2VydmVyVXJsfS8ke3RoaXMub3B0cy50cmFuc2xhdGlvblNlcnZlclByZWZpeH1leHBvcnQ/Zm9ybWF0PSR7Zm9ybWF0fWA7XG5cdFx0bGV0IGZldGNoT3B0aW9ucyA9IHtcblx0XHRcdG1ldGhvZDogJ1BPU1QnLFxuXHRcdFx0aGVhZGVyczoge1xuXHRcdFx0XHQnQ29udGVudC1UeXBlJzogJ2FwcGxpY2F0aW9uL2pzb24nXG5cdFx0XHR9LFxuXHRcdFx0Ym9keTogSlNPTi5zdHJpbmdpZnkodGhpcy5pdGVtcy5maWx0ZXIoaSA9PiAna2V5JyBpbiBpICkpLFxuXHRcdFx0Li4udGhpcy5vcHRzLmluaXRcblx0XHR9XG5cdFx0Y29uc3QgcmVzcG9uc2UgPSBhd2FpdCBmZXRjaCh0cmFuc2xhdGlvblNlcnZlclVybCwgZmV0Y2hPcHRpb25zKTtcblx0XHRpZihyZXNwb25zZS5vaykge1xuXHRcdFx0cmV0dXJuIGF3YWl0IHJlc3BvbnNlLnRleHQoKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKCdGYWlsZWQgdG8gZXhwb3J0IGl0ZW1zJyk7XG5cdFx0fVxuXHR9XG5cblx0YXN5bmMgdHJhbnNsYXRlSWRlbnRpZmllcihpZGVudGlmaWVyLCAuLi5hcmdzKSB7XG5cdFx0bGV0IHRyYW5zbGF0aW9uU2VydmVyVXJsID0gYCR7dGhpcy5vcHRzLnRyYW5zbGF0aW9uU2VydmVyVXJsfS8ke3RoaXMub3B0cy50cmFuc2xhdGlvblNlcnZlclByZWZpeH1zZWFyY2hgO1xuXHRcdGxldCBpbml0ID0ge1xuXHRcdFx0bWV0aG9kOiAnUE9TVCcsXG5cdFx0XHRoZWFkZXJzOiB7XG5cdFx0XHRcdCdDb250ZW50LVR5cGUnOiAndGV4dC9wbGFpbidcblx0XHRcdH0sXG5cdFx0XHRib2R5OiBpZGVudGlmaWVyLFxuXHRcdFx0Li4udGhpcy5vcHRzLmluaXRcblx0XHR9O1xuXG5cdFx0cmV0dXJuIGF3YWl0IHRoaXMudHJhbnNsYXRlKHRyYW5zbGF0aW9uU2VydmVyVXJsLCBpbml0LCAuLi5hcmdzKTtcblx0fVxuXG5cdGFzeW5jIHRyYW5zbGF0ZVVybEl0ZW1zKHVybCwgaXRlbXMsIC4uLmFyZ3MpIHtcblx0XHRsZXQgdHJhbnNsYXRpb25TZXJ2ZXJVcmwgPSBgJHt0aGlzLm9wdHMudHJhbnNsYXRpb25TZXJ2ZXJVcmx9LyR7dGhpcy5vcHRzLnRyYW5zbGF0aW9uU2VydmVyUHJlZml4fXdlYmA7XG5cdFx0bGV0IHNlc3Npb25pZCA9IHRoaXMub3B0cy5zZXNzaW9uaWQ7XG5cdFx0bGV0IGRhdGEgPSB7IHVybCwgaXRlbXMsIHNlc3Npb25pZCwgLi4udGhpcy5vcHRzLnJlcXVlc3QgfTtcblxuXHRcdGxldCBpbml0ID0ge1xuXHRcdFx0bWV0aG9kOiAnUE9TVCcsXG5cdFx0XHRoZWFkZXJzOiB7XG5cdFx0XHRcdCdDb250ZW50LVR5cGUnOiAnYXBwbGljYXRpb24vanNvbidcblx0XHRcdH0sXG5cdFx0XHRib2R5OiBKU09OLnN0cmluZ2lmeShkYXRhKSxcblx0XHRcdC4uLnRoaXMub3B0cy5pbml0XG5cdFx0fTtcblxuXHRcdHJldHVybiBhd2FpdCB0aGlzLnRyYW5zbGF0ZSh0cmFuc2xhdGlvblNlcnZlclVybCwgaW5pdCwgLi4uYXJncyk7XG5cdH1cblxuXHRhc3luYyB0cmFuc2xhdGVVcmwodXJsLCAuLi5hcmdzKSB7XG5cdFx0bGV0IHRyYW5zbGF0aW9uU2VydmVyVXJsID0gYCR7dGhpcy5vcHRzLnRyYW5zbGF0aW9uU2VydmVyVXJsfS8ke3RoaXMub3B0cy50cmFuc2xhdGlvblNlcnZlclByZWZpeH13ZWJgO1xuXHRcdGxldCBzZXNzaW9uaWQgPSB0aGlzLm9wdHMuc2Vzc2lvbmlkO1xuXHRcdGxldCBkYXRhID0geyB1cmwsIHNlc3Npb25pZCwgLi4udGhpcy5vcHRzLnJlcXVlc3QgfTtcblxuXHRcdGxldCBpbml0ID0ge1xuXHRcdFx0bWV0aG9kOiAnUE9TVCcsXG5cdFx0XHRoZWFkZXJzOiB7XG5cdFx0XHRcdCdDb250ZW50LVR5cGUnOiAnYXBwbGljYXRpb24vanNvbidcblx0XHRcdH0sXG5cdFx0XHRib2R5OiBKU09OLnN0cmluZ2lmeShkYXRhKSxcblx0XHRcdC4uLnRoaXMub3B0cy5pbml0XG5cdFx0fTtcblxuXHRcdHJldHVybiBhd2FpdCB0aGlzLnRyYW5zbGF0ZSh0cmFuc2xhdGlvblNlcnZlclVybCwgaW5pdCwgLi4uYXJncyk7XG5cdH1cblxuXHRhc3luYyB0cmFuc2xhdGUodXJsLCBmZXRjaE9wdGlvbnMsIGFkZD10cnVlKSB7XG5cdFx0Y29uc3QgcmVzcG9uc2UgPSBhd2FpdCBmZXRjaCh1cmwsIGZldGNoT3B0aW9ucyk7XG5cdFx0dmFyIGl0ZW1zLCByZXN1bHQ7XG5cblx0XHRpZihyZXNwb25zZS5vaykge1xuXHRcdFx0aXRlbXMgPSBhd2FpdCByZXNwb25zZS5qc29uKCk7XG5cdFx0XHRpZihBcnJheS5pc0FycmF5KGl0ZW1zKSkge1xuXHRcdFx0XHRpdGVtcy5mb3JFYWNoKGl0ZW0gPT4ge1xuXHRcdFx0XHRcdGlmKGl0ZW0uYWNjZXNzRGF0ZSA9PT0gJ0NVUlJFTlRfVElNRVNUQU1QJykge1xuXHRcdFx0XHRcdFx0Y29uc3QgZHQgPSBuZXcgRGF0ZShEYXRlLm5vdygpKTtcblx0XHRcdFx0XHRcdGl0ZW0uYWNjZXNzRGF0ZSA9IGRhdGVUb1NxbChkdCwgdHJ1ZSk7XG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0aWYoYWRkKSB7XG5cdFx0XHRcdFx0XHR0aGlzLmFkZEl0ZW0oaXRlbSk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9KTtcblx0XHRcdH1cblx0XHRcdHJlc3VsdCA9IEFycmF5LmlzQXJyYXkoaXRlbXMpID8gQ09NUExFVEUgOiBGQUlMRUQ7XG5cdFx0fSBlbHNlIGlmKHJlc3BvbnNlLnN0YXR1cyA9PT0gMzAwKSB7XG5cdFx0XHRpdGVtcyA9IGF3YWl0IHJlc3BvbnNlLmpzb24oKTtcblx0XHRcdHJlc3VsdCA9IE1VTFRJUExFX0lURU1TO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRyZXN1bHQgPSBGQUlMRURcblx0XHR9XG5cblx0XHRyZXR1cm4geyByZXN1bHQsIGl0ZW1zLCByZXNwb25zZSB9O1xuXHR9XG5cblx0c3RhdGljIGdldCBDT01QTEVURSgpIHsgcmV0dXJuIENPTVBMRVRFIH1cblx0c3RhdGljIGdldCBNVUxUSVBMRV9JVEVNUygpIHsgcmV0dXJuIE1VTFRJUExFX0lURU1TIH1cblx0c3RhdGljIGdldCBGQUlMRUQoKSB7IHJldHVybiBGQUlMRUQgfVxufVxuXG5tb2R1bGUuZXhwb3J0cyA9IFpvdGVyb0JpYjtcbiIsIid1c2Ugc3RyaWN0JztcblxubW9kdWxlLmV4cG9ydHMgPSAoKSA9PiAoe1xuXHR0cmFuc2xhdGlvblNlcnZlclVybDogdHlwZW9mIHdpbmRvdyAhPSAndW5kZWZpbmVkJyAmJiB3aW5kb3cubG9jYXRpb24ub3JpZ2luIHx8ICcnLFxuXHR0cmFuc2xhdGlvblNlcnZlclByZWZpeDogJycsXG5cdGZldGNoQ29uZmlnOiB7fSxcblx0aW5pdGlhbEl0ZW1zOiBbXSxcblx0cmVxdWVzdDoge30sXG5cdHN0b3JhZ2U6IHR5cGVvZiB3aW5kb3cgIT0gJ3VuZGVmaW5lZCcgJiYgJ2xvY2FsU3RvcmFnZScgaW4gd2luZG93ICYmIHdpbmRvdy5sb2NhbFN0b3JhZ2UgfHwge30sXG5cdHBlcnNpc3Q6IHRydWUsXG5cdG92ZXJyaWRlOiBmYWxzZSxcblx0c3RvcmFnZVByZWZpeDogJ3pvdGVyby1iaWInXG59KTtcbiIsIid1c2Ugc3RyaWN0JztcblxubW9kdWxlLmV4cG9ydHMgPSB7XG5cdHV1aWQ0OiAoKSA9PiAneHh4eHh4eHgteHh4eC00eHh4LXl4eHgteHh4eHh4eHh4eHh4Jy5yZXBsYWNlKC9beHldL2csIGMgPT4ge1xuXHRcdFx0dmFyIHIgPSBNYXRoLnJhbmRvbSgpICogMTZ8MCxcblx0XHRcdFx0diA9IGMgPT0gJ3gnID8gciA6IChyJjB4M3wweDgpO1xuXG5cdFx0XHRyZXR1cm4gdi50b1N0cmluZygxNik7XG5cdFx0fSksXG5cdGlzTGlrZVpvdGVyb0l0ZW06IGl0ZW0gPT4gaXRlbSAmJiB0eXBlb2YgaXRlbSA9PT0gJ29iamVjdCcgJiYgJ2l0ZW1UeXBlJyBpbiBpdGVtXG59XG4iLCIndXNlIHN0cmljdCc7XG5cbnJlcXVpcmUoJ2VzNi1wcm9taXNlL2F1dG8nKTtcbnJlcXVpcmUoJ2lzb21vcnBoaWMtZmV0Y2gnKTtcbnJlcXVpcmUoJ2JhYmVsLXJlZ2VuZXJhdG9yLXJ1bnRpbWUnKTtcbmNvbnN0IFpvdGVyb0JpYiA9IHJlcXVpcmUoJy4vYmliL2JpYicpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IFpvdGVyb0JpYjtcbiIsIid1c2Ugc3RyaWN0JztcblxuY29uc3QgY3JlYXRvclR5cGVzID0ge1xuXHQxOiAnYXV0aG9yJyxcblx0MjogJ2NvbnRyaWJ1dG9yJyxcblx0MzogJ2VkaXRvcicsXG5cdDQ6ICd0cmFuc2xhdG9yJyxcblx0NTogJ3Nlcmllc0VkaXRvcicsXG5cdDY6ICdpbnRlcnZpZXdlZScsXG5cdDc6ICdpbnRlcnZpZXdlcicsXG5cdDg6ICdkaXJlY3RvcicsXG5cdDk6ICdzY3JpcHR3cml0ZXInLFxuXHQxMDogJ3Byb2R1Y2VyJyxcblx0MTE6ICdjYXN0TWVtYmVyJyxcblx0MTI6ICdzcG9uc29yJyxcblx0MTM6ICdjb3Vuc2VsJyxcblx0MTQ6ICdpbnZlbnRvcicsXG5cdDE1OiAnYXR0b3JuZXlBZ2VudCcsXG5cdDE2OiAncmVjaXBpZW50Jyxcblx0MTc6ICdwZXJmb3JtZXInLFxuXHQxODogJ2NvbXBvc2VyJyxcblx0MTk6ICd3b3Jkc0J5Jyxcblx0MjA6ICdjYXJ0b2dyYXBoZXInLFxuXHQyMTogJ3Byb2dyYW1tZXInLFxuXHQyMjogJ2FydGlzdCcsXG5cdDIzOiAnY29tbWVudGVyJyxcblx0MjQ6ICdwcmVzZW50ZXInLFxuXHQyNTogJ2d1ZXN0Jyxcblx0MjY6ICdwb2RjYXN0ZXInLFxuXHQyNzogJ3Jldmlld2VkQXV0aG9yJyxcblx0Mjg6ICdjb3Nwb25zb3InLFxuXHQyOTogJ2Jvb2tBdXRob3InXG59O1xuXG5cbi8vcmV2ZXJzZSBsb29rdXBcbk9iamVjdC5rZXlzKGNyZWF0b3JUeXBlcykubWFwKGsgPT4gY3JlYXRvclR5cGVzW2NyZWF0b3JUeXBlc1trXV0gPSBrKTtcbm1vZHVsZS5leHBvcnRzID0gY3JlYXRvclR5cGVzO1xuIiwibW9kdWxlLmV4cG9ydHMgPSB7XG5cdENTTF9OQU1FU19NQVBQSU5HUzoge1xuXHRcdCdhdXRob3InOidhdXRob3InLFxuXHRcdCdlZGl0b3InOidlZGl0b3InLFxuXHRcdCdib29rQXV0aG9yJzonY29udGFpbmVyLWF1dGhvcicsXG5cdFx0J2NvbXBvc2VyJzonY29tcG9zZXInLFxuXHRcdCdkaXJlY3Rvcic6J2RpcmVjdG9yJyxcblx0XHQnaW50ZXJ2aWV3ZXInOidpbnRlcnZpZXdlcicsXG5cdFx0J3JlY2lwaWVudCc6J3JlY2lwaWVudCcsXG5cdFx0J3Jldmlld2VkQXV0aG9yJzoncmV2aWV3ZWQtYXV0aG9yJyxcblx0XHQnc2VyaWVzRWRpdG9yJzonY29sbGVjdGlvbi1lZGl0b3InLFxuXHRcdCd0cmFuc2xhdG9yJzondHJhbnNsYXRvcidcblx0fSxcblxuXHQvKlxuXHQgKiBNYXBwaW5ncyBmb3IgdGV4dCB2YXJpYWJsZXNcblx0ICovXG5cdENTTF9URVhUX01BUFBJTkdTOiB7XG5cdFx0J3RpdGxlJzpbJ3RpdGxlJ10sXG5cdFx0J2NvbnRhaW5lci10aXRsZSc6WydwdWJsaWNhdGlvblRpdGxlJywgICdyZXBvcnRlcicsICdjb2RlJ10sIC8qIHJlcG9ydGVyIGFuZCBjb2RlIHNob3VsZCBtb3ZlIHRvIFNRTCBtYXBwaW5nIHRhYmxlcyAqL1xuXHRcdCdjb2xsZWN0aW9uLXRpdGxlJzpbJ3Nlcmllc1RpdGxlJywgJ3NlcmllcyddLFxuXHRcdCdjb2xsZWN0aW9uLW51bWJlcic6WydzZXJpZXNOdW1iZXInXSxcblx0XHQncHVibGlzaGVyJzpbJ3B1Ymxpc2hlcicsICdkaXN0cmlidXRvciddLCAvKiBkaXN0cmlidXRvciBzaG91bGQgbW92ZSB0byBTUUwgbWFwcGluZyB0YWJsZXMgKi9cblx0XHQncHVibGlzaGVyLXBsYWNlJzpbJ3BsYWNlJ10sXG5cdFx0J2F1dGhvcml0eSc6Wydjb3VydCcsJ2xlZ2lzbGF0aXZlQm9keScsICdpc3N1aW5nQXV0aG9yaXR5J10sXG5cdFx0J3BhZ2UnOlsncGFnZXMnXSxcblx0XHQndm9sdW1lJzpbJ3ZvbHVtZScsICdjb2RlTnVtYmVyJ10sXG5cdFx0J2lzc3VlJzpbJ2lzc3VlJywgJ3ByaW9yaXR5TnVtYmVycyddLFxuXHRcdCdudW1iZXItb2Ytdm9sdW1lcyc6WydudW1iZXJPZlZvbHVtZXMnXSxcblx0XHQnbnVtYmVyLW9mLXBhZ2VzJzpbJ251bVBhZ2VzJ10sXG5cdFx0J2VkaXRpb24nOlsnZWRpdGlvbiddLFxuXHRcdCd2ZXJzaW9uJzpbJ3ZlcnNpb25OdW1iZXInXSxcblx0XHQnc2VjdGlvbic6WydzZWN0aW9uJywgJ2NvbW1pdHRlZSddLFxuXHRcdCdnZW5yZSc6Wyd0eXBlJywgJ3Byb2dyYW1taW5nTGFuZ3VhZ2UnXSxcblx0XHQnc291cmNlJzpbJ2xpYnJhcnlDYXRhbG9nJ10sXG5cdFx0J2RpbWVuc2lvbnMnOiBbJ2FydHdvcmtTaXplJywgJ3J1bm5pbmdUaW1lJ10sXG5cdFx0J21lZGl1bSc6WydtZWRpdW0nLCAnc3lzdGVtJ10sXG5cdFx0J3NjYWxlJzpbJ3NjYWxlJ10sXG5cdFx0J2FyY2hpdmUnOlsnYXJjaGl2ZSddLFxuXHRcdCdhcmNoaXZlX2xvY2F0aW9uJzpbJ2FyY2hpdmVMb2NhdGlvbiddLFxuXHRcdCdldmVudCc6WydtZWV0aW5nTmFtZScsICdjb25mZXJlbmNlTmFtZSddLCAvKiB0aGVzZSBzaG91bGQgYmUgbWFwcGVkIHRvIHRoZSBzYW1lIGJhc2UgZmllbGQgaW4gU1FMIG1hcHBpbmcgdGFibGVzICovXG5cdFx0J2V2ZW50LXBsYWNlJzpbJ3BsYWNlJ10sXG5cdFx0J2Fic3RyYWN0JzpbJ2Fic3RyYWN0Tm90ZSddLFxuXHRcdCdVUkwnOlsndXJsJ10sXG5cdFx0J0RPSSc6WydET0knXSxcblx0XHQnSVNCTic6WydJU0JOJ10sXG5cdFx0J0lTU04nOlsnSVNTTiddLFxuXHRcdCdjYWxsLW51bWJlcic6WydjYWxsTnVtYmVyJywgJ2FwcGxpY2F0aW9uTnVtYmVyJ10sXG5cdFx0J25vdGUnOlsnZXh0cmEnXSxcblx0XHQnbnVtYmVyJzpbJ251bWJlciddLFxuXHRcdCdjaGFwdGVyLW51bWJlcic6WydzZXNzaW9uJ10sXG5cdFx0J3JlZmVyZW5jZXMnOlsnaGlzdG9yeScsICdyZWZlcmVuY2VzJ10sXG5cdFx0J3Nob3J0VGl0bGUnOlsnc2hvcnRUaXRsZSddLFxuXHRcdCdqb3VybmFsQWJicmV2aWF0aW9uJzpbJ2pvdXJuYWxBYmJyZXZpYXRpb24nXSxcblx0XHQnc3RhdHVzJzpbJ2xlZ2FsU3RhdHVzJ10sXG5cdFx0J2xhbmd1YWdlJzpbJ2xhbmd1YWdlJ11cblx0fSxcblx0Q1NMX0RBVEVfTUFQUElOR1M6IHtcblx0XHQnaXNzdWVkJzonZGF0ZScsXG5cdFx0J2FjY2Vzc2VkJzonYWNjZXNzRGF0ZScsXG5cdFx0J3N1Ym1pdHRlZCc6J2ZpbGluZ0RhdGUnXG5cdH0sXG5cdENTTF9UWVBFX01BUFBJTkdTOiB7XG5cdFx0J2Jvb2snOidib29rJyxcblx0XHQnYm9va1NlY3Rpb24nOidjaGFwdGVyJyxcblx0XHQnam91cm5hbEFydGljbGUnOidhcnRpY2xlLWpvdXJuYWwnLFxuXHRcdCdtYWdhemluZUFydGljbGUnOidhcnRpY2xlLW1hZ2F6aW5lJyxcblx0XHQnbmV3c3BhcGVyQXJ0aWNsZSc6J2FydGljbGUtbmV3c3BhcGVyJyxcblx0XHQndGhlc2lzJzondGhlc2lzJyxcblx0XHQnZW5jeWNsb3BlZGlhQXJ0aWNsZSc6J2VudHJ5LWVuY3ljbG9wZWRpYScsXG5cdFx0J2RpY3Rpb25hcnlFbnRyeSc6J2VudHJ5LWRpY3Rpb25hcnknLFxuXHRcdCdjb25mZXJlbmNlUGFwZXInOidwYXBlci1jb25mZXJlbmNlJyxcblx0XHQnbGV0dGVyJzoncGVyc29uYWxfY29tbXVuaWNhdGlvbicsXG5cdFx0J21hbnVzY3JpcHQnOidtYW51c2NyaXB0Jyxcblx0XHQnaW50ZXJ2aWV3JzonaW50ZXJ2aWV3Jyxcblx0XHQnZmlsbSc6J21vdGlvbl9waWN0dXJlJyxcblx0XHQnYXJ0d29yayc6J2dyYXBoaWMnLFxuXHRcdCd3ZWJwYWdlJzond2VicGFnZScsXG5cdFx0J3JlcG9ydCc6J3JlcG9ydCcsXG5cdFx0J2JpbGwnOidiaWxsJyxcblx0XHQnY2FzZSc6J2xlZ2FsX2Nhc2UnLFxuXHRcdCdoZWFyaW5nJzonYmlsbCcsXHRcdFx0XHQvLyA/P1xuXHRcdCdwYXRlbnQnOidwYXRlbnQnLFxuXHRcdCdzdGF0dXRlJzonbGVnaXNsYXRpb24nLFx0XHQvLyA/P1xuXHRcdCdlbWFpbCc6J3BlcnNvbmFsX2NvbW11bmljYXRpb24nLFxuXHRcdCdtYXAnOidtYXAnLFxuXHRcdCdibG9nUG9zdCc6J3Bvc3Qtd2VibG9nJyxcblx0XHQnaW5zdGFudE1lc3NhZ2UnOidwZXJzb25hbF9jb21tdW5pY2F0aW9uJyxcblx0XHQnZm9ydW1Qb3N0JzoncG9zdCcsXG5cdFx0J2F1ZGlvUmVjb3JkaW5nJzonc29uZycsXHRcdC8vID8/XG5cdFx0J3ByZXNlbnRhdGlvbic6J3NwZWVjaCcsXG5cdFx0J3ZpZGVvUmVjb3JkaW5nJzonbW90aW9uX3BpY3R1cmUnLFxuXHRcdCd0dkJyb2FkY2FzdCc6J2Jyb2FkY2FzdCcsXG5cdFx0J3JhZGlvQnJvYWRjYXN0JzonYnJvYWRjYXN0Jyxcblx0XHQncG9kY2FzdCc6J3NvbmcnLFx0XHRcdC8vID8/XG5cdFx0J2NvbXB1dGVyUHJvZ3JhbSc6J2Jvb2snLFx0XHQvLyA/P1xuXHRcdCdkb2N1bWVudCc6J2FydGljbGUnLFxuXHRcdCdub3RlJzonYXJ0aWNsZScsXG5cdFx0J2F0dGFjaG1lbnQnOidhcnRpY2xlJ1xuXHR9XG59O1xuIiwiY29uc3QgbHBhZCA9IHJlcXVpcmUoJy4vbHBhZCcpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IChkYXRlLCB0b1VUQykgPT4ge1xuXHR2YXIgeWVhciwgbW9udGgsIGRheSwgaG91cnMsIG1pbnV0ZXMsIHNlY29uZHM7XG5cdHRyeSB7XG5cdFx0aWYodG9VVEMpIHtcblx0XHRcdHllYXIgPSBkYXRlLmdldFVUQ0Z1bGxZZWFyKCk7XG5cdFx0XHRtb250aCA9IGRhdGUuZ2V0VVRDTW9udGgoKTtcblx0XHRcdGRheSA9IGRhdGUuZ2V0VVRDRGF0ZSgpO1xuXHRcdFx0aG91cnMgPSBkYXRlLmdldFVUQ0hvdXJzKCk7XG5cdFx0XHRtaW51dGVzID0gZGF0ZS5nZXRVVENNaW51dGVzKCk7XG5cdFx0XHRzZWNvbmRzID0gZGF0ZS5nZXRVVENTZWNvbmRzKCk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHllYXIgPSBkYXRlLmdldEZ1bGxZZWFyKCk7XG5cdFx0XHRtb250aCA9IGRhdGUuZ2V0TW9udGgoKTtcblx0XHRcdGRheSA9IGRhdGUuZ2V0RGF0ZSgpO1xuXHRcdFx0aG91cnMgPSBkYXRlLmdldEhvdXJzKCk7XG5cdFx0XHRtaW51dGVzID0gZGF0ZS5nZXRNaW51dGVzKCk7XG5cdFx0XHRzZWNvbmRzID0gZGF0ZS5nZXRTZWNvbmRzKCk7XG5cdFx0fVxuXG5cdFx0eWVhciA9IGxwYWQoeWVhciwgJzAnLCA0KTtcblx0XHRtb250aCA9IGxwYWQobW9udGggKyAxLCAnMCcsIDIpO1xuXHRcdGRheSA9IGxwYWQoZGF5LCAnMCcsIDIpO1xuXHRcdGhvdXJzID0gbHBhZChob3VycywgJzAnLCAyKTtcblx0XHRtaW51dGVzID0gbHBhZChtaW51dGVzLCAnMCcsIDIpO1xuXHRcdHNlY29uZHMgPSBscGFkKHNlY29uZHMsICcwJywgMik7XG5cblx0XHRyZXR1cm4geWVhciArICctJyArIG1vbnRoICsgJy0nICsgZGF5ICsgJyAnXG5cdFx0XHQrIGhvdXJzICsgJzonICsgbWludXRlcyArICc6JyArIHNlY29uZHM7XG5cdH1cblx0Y2F0Y2ggKGUpIHtcblx0XHRyZXR1cm4gJyc7XG5cdH1cbn1cbiIsImNvbnN0IGl0ZW1UeXBlcyA9IHJlcXVpcmUoJy4vaXRlbS10eXBlcycpO1xuY29uc3QgY3JlYXRvclR5cGVzID0gcmVxdWlyZSgnLi9jcmVhdG9yLXR5cGVzJyk7XG5cbm1vZHVsZS5leHBvcnRzID0ge1xuXHRbaXRlbVR5cGVzWzJdXTogY3JlYXRvclR5cGVzWzFdLFxuXHRbaXRlbVR5cGVzWzNdXTogY3JlYXRvclR5cGVzWzFdLFxuXHRbaXRlbVR5cGVzWzRdXTogY3JlYXRvclR5cGVzWzFdLFxuXHRbaXRlbVR5cGVzWzVdXTogY3JlYXRvclR5cGVzWzFdLFxuXHRbaXRlbVR5cGVzWzZdXTogY3JlYXRvclR5cGVzWzFdLFxuXHRbaXRlbVR5cGVzWzddXTogY3JlYXRvclR5cGVzWzFdLFxuXHRbaXRlbVR5cGVzWzhdXTogY3JlYXRvclR5cGVzWzFdLFxuXHRbaXRlbVR5cGVzWzldXTogY3JlYXRvclR5cGVzWzFdLFxuXHRbaXRlbVR5cGVzWzEwXV06IGNyZWF0b3JUeXBlc1s2XSxcblx0W2l0ZW1UeXBlc1sxMV1dOiBjcmVhdG9yVHlwZXNbOF0sXG5cdFtpdGVtVHlwZXNbMTJdXTogY3JlYXRvclR5cGVzWzIyXSxcblx0W2l0ZW1UeXBlc1sxM11dOiBjcmVhdG9yVHlwZXNbMV0sXG5cdFtpdGVtVHlwZXNbMTVdXTogY3JlYXRvclR5cGVzWzFdLFxuXHRbaXRlbVR5cGVzWzE2XV06IGNyZWF0b3JUeXBlc1sxMl0sXG5cdFtpdGVtVHlwZXNbMTddXTogY3JlYXRvclR5cGVzWzFdLFxuXHRbaXRlbVR5cGVzWzE4XV06IGNyZWF0b3JUeXBlc1syXSxcblx0W2l0ZW1UeXBlc1sxOV1dOiBjcmVhdG9yVHlwZXNbMTRdLFxuXHRbaXRlbVR5cGVzWzIwXV06IGNyZWF0b3JUeXBlc1sxXSxcblx0W2l0ZW1UeXBlc1syMV1dOiBjcmVhdG9yVHlwZXNbMV0sXG5cdFtpdGVtVHlwZXNbMjJdXTogY3JlYXRvclR5cGVzWzIwXSxcblx0W2l0ZW1UeXBlc1syM11dOiBjcmVhdG9yVHlwZXNbMV0sXG5cdFtpdGVtVHlwZXNbMjRdXTogY3JlYXRvclR5cGVzWzFdLFxuXHRbaXRlbVR5cGVzWzI1XV06IGNyZWF0b3JUeXBlc1sxXSxcblx0W2l0ZW1UeXBlc1syNl1dOiBjcmVhdG9yVHlwZXNbMTddLFxuXHRbaXRlbVR5cGVzWzI3XV06IGNyZWF0b3JUeXBlc1syNF0sXG5cdFtpdGVtVHlwZXNbMjhdXTogY3JlYXRvclR5cGVzWzhdLFxuXHRbaXRlbVR5cGVzWzI5XV06IGNyZWF0b3JUeXBlc1s4XSxcblx0W2l0ZW1UeXBlc1szMF1dOiBjcmVhdG9yVHlwZXNbOF0sXG5cdFtpdGVtVHlwZXNbMzFdXTogY3JlYXRvclR5cGVzWzI2XSxcblx0W2l0ZW1UeXBlc1szMl1dOiBjcmVhdG9yVHlwZXNbMjFdLFxuXHRbaXRlbVR5cGVzWzMzXV06IGNyZWF0b3JUeXBlc1sxXSxcblx0W2l0ZW1UeXBlc1szNF1dOiBjcmVhdG9yVHlwZXNbMV0sXG5cdFtpdGVtVHlwZXNbMzVdXTogY3JlYXRvclR5cGVzWzFdLFxuXHRbaXRlbVR5cGVzWzM2XV06IGNyZWF0b3JUeXBlc1sxXVxufTtcbiIsIid1c2Ugc3RyaWN0JztcblxuY29uc3QgZmllbGRzID0ge1xuXHQxOiAndXJsJyxcblx0MjogJ3JpZ2h0cycsXG5cdDM6ICdzZXJpZXMnLFxuXHQ0OiAndm9sdW1lJyxcblx0NTogJ2lzc3VlJyxcblx0NjogJ2VkaXRpb24nLFxuXHQ3OiAncGxhY2UnLFxuXHQ4OiAncHVibGlzaGVyJyxcblx0MTA6ICdwYWdlcycsXG5cdDExOiAnSVNCTicsXG5cdDEyOiAncHVibGljYXRpb25UaXRsZScsXG5cdDEzOiAnSVNTTicsXG5cdDE0OiAnZGF0ZScsXG5cdDE1OiAnc2VjdGlvbicsXG5cdDE4OiAnY2FsbE51bWJlcicsXG5cdDE5OiAnYXJjaGl2ZUxvY2F0aW9uJyxcblx0MjE6ICdkaXN0cmlidXRvcicsXG5cdDIyOiAnZXh0cmEnLFxuXHQyNTogJ2pvdXJuYWxBYmJyZXZpYXRpb24nLFxuXHQyNjogJ0RPSScsXG5cdDI3OiAnYWNjZXNzRGF0ZScsXG5cdDI4OiAnc2VyaWVzVGl0bGUnLFxuXHQyOTogJ3Nlcmllc1RleHQnLFxuXHQzMDogJ3Nlcmllc051bWJlcicsXG5cdDMxOiAnaW5zdGl0dXRpb24nLFxuXHQzMjogJ3JlcG9ydFR5cGUnLFxuXHQzNjogJ2NvZGUnLFxuXHQ0MDogJ3Nlc3Npb24nLFxuXHQ0MTogJ2xlZ2lzbGF0aXZlQm9keScsXG5cdDQyOiAnaGlzdG9yeScsXG5cdDQzOiAncmVwb3J0ZXInLFxuXHQ0NDogJ2NvdXJ0Jyxcblx0NDU6ICdudW1iZXJPZlZvbHVtZXMnLFxuXHQ0NjogJ2NvbW1pdHRlZScsXG5cdDQ4OiAnYXNzaWduZWUnLFxuXHQ1MDogJ3BhdGVudE51bWJlcicsXG5cdDUxOiAncHJpb3JpdHlOdW1iZXJzJyxcblx0NTI6ICdpc3N1ZURhdGUnLFxuXHQ1MzogJ3JlZmVyZW5jZXMnLFxuXHQ1NDogJ2xlZ2FsU3RhdHVzJyxcblx0NTU6ICdjb2RlTnVtYmVyJyxcblx0NTk6ICdhcnR3b3JrTWVkaXVtJyxcblx0NjA6ICdudW1iZXInLFxuXHQ2MTogJ2FydHdvcmtTaXplJyxcblx0NjI6ICdsaWJyYXJ5Q2F0YWxvZycsXG5cdDYzOiAndmlkZW9SZWNvcmRpbmdGb3JtYXQnLFxuXHQ2NDogJ2ludGVydmlld01lZGl1bScsXG5cdDY1OiAnbGV0dGVyVHlwZScsXG5cdDY2OiAnbWFudXNjcmlwdFR5cGUnLFxuXHQ2NzogJ21hcFR5cGUnLFxuXHQ2ODogJ3NjYWxlJyxcblx0Njk6ICd0aGVzaXNUeXBlJyxcblx0NzA6ICd3ZWJzaXRlVHlwZScsXG5cdDcxOiAnYXVkaW9SZWNvcmRpbmdGb3JtYXQnLFxuXHQ3MjogJ2xhYmVsJyxcblx0NzQ6ICdwcmVzZW50YXRpb25UeXBlJyxcblx0NzU6ICdtZWV0aW5nTmFtZScsXG5cdDc2OiAnc3R1ZGlvJyxcblx0Nzc6ICdydW5uaW5nVGltZScsXG5cdDc4OiAnbmV0d29yaycsXG5cdDc5OiAncG9zdFR5cGUnLFxuXHQ4MDogJ2F1ZGlvRmlsZVR5cGUnLFxuXHQ4MTogJ3ZlcnNpb25OdW1iZXInLFxuXHQ4MjogJ3N5c3RlbScsXG5cdDgzOiAnY29tcGFueScsXG5cdDg0OiAnY29uZmVyZW5jZU5hbWUnLFxuXHQ4NTogJ2VuY3ljbG9wZWRpYVRpdGxlJyxcblx0ODY6ICdkaWN0aW9uYXJ5VGl0bGUnLFxuXHQ4NzogJ2xhbmd1YWdlJyxcblx0ODg6ICdwcm9ncmFtbWluZ0xhbmd1YWdlJyxcblx0ODk6ICd1bml2ZXJzaXR5Jyxcblx0OTA6ICdhYnN0cmFjdE5vdGUnLFxuXHQ5MTogJ3dlYnNpdGVUaXRsZScsXG5cdDkyOiAncmVwb3J0TnVtYmVyJyxcblx0OTM6ICdiaWxsTnVtYmVyJyxcblx0OTQ6ICdjb2RlVm9sdW1lJyxcblx0OTU6ICdjb2RlUGFnZXMnLFxuXHQ5NjogJ2RhdGVEZWNpZGVkJyxcblx0OTc6ICdyZXBvcnRlclZvbHVtZScsXG5cdDk4OiAnZmlyc3RQYWdlJyxcblx0OTk6ICdkb2N1bWVudE51bWJlcicsXG5cdDEwMDogJ2RhdGVFbmFjdGVkJyxcblx0MTAxOiAncHVibGljTGF3TnVtYmVyJyxcblx0MTAyOiAnY291bnRyeScsXG5cdDEwMzogJ2FwcGxpY2F0aW9uTnVtYmVyJyxcblx0MTA0OiAnZm9ydW1UaXRsZScsXG5cdDEwNTogJ2VwaXNvZGVOdW1iZXInLFxuXHQxMDc6ICdibG9nVGl0bGUnLFxuXHQxMDg6ICd0eXBlJyxcblx0MTA5OiAnbWVkaXVtJyxcblx0MTEwOiAndGl0bGUnLFxuXHQxMTE6ICdjYXNlTmFtZScsXG5cdDExMjogJ25hbWVPZkFjdCcsXG5cdDExMzogJ3N1YmplY3QnLFxuXHQxMTQ6ICdwcm9jZWVkaW5nc1RpdGxlJyxcblx0MTE1OiAnYm9va1RpdGxlJyxcblx0MTE2OiAnc2hvcnRUaXRsZScsXG5cdDExNzogJ2RvY2tldE51bWJlcicsXG5cdDExODogJ251bVBhZ2VzJyxcblx0MTE5OiAncHJvZ3JhbVRpdGxlJyxcblx0MTIwOiAnaXNzdWluZ0F1dGhvcml0eScsXG5cdDEyMTogJ2ZpbGluZ0RhdGUnLFxuXHQxMjI6ICdnZW5yZScsXG5cdDEyMzogJ2FyY2hpdmUnXG59O1xuXG4vL3JldmVyc2UgbG9va3VwXG5PYmplY3Qua2V5cyhmaWVsZHMpLm1hcChrID0+IGZpZWxkc1tmaWVsZHNba11dID0gayk7XG5cbm1vZHVsZS5leHBvcnRzID0gZmllbGRzO1xuIiwiLyogZ2xvYmFsIENTTDpmYWxzZSAqL1xuJ3VzZSBzdHJpY3QnO1xuXG5jb25zdCBiYXNlTWFwcGluZ3MgPSByZXF1aXJlKCd6b3Rlcm8tYmFzZS1tYXBwaW5ncycpO1xuXG5jb25zdCB7XG5cdENTTF9OQU1FU19NQVBQSU5HUyxcblx0Q1NMX1RFWFRfTUFQUElOR1MsXG5cdENTTF9EQVRFX01BUFBJTkdTLFxuXHRDU0xfVFlQRV9NQVBQSU5HU1xufSA9IHJlcXVpcmUoJy4vY3NsLW1hcHBpbmdzJyk7XG5cbmNvbnN0IHsgZ2V0RmllbGRJREZyb21UeXBlQW5kQmFzZSB9ID0gcmVxdWlyZSgnLi90eXBlLXNwZWNpZmljLWZpZWxkLW1hcCcpO1xuY29uc3QgZmllbGRzID0gcmVxdWlyZSgnLi9maWVsZHMnKTtcbmNvbnN0IGl0ZW1UeXBlcyA9IHJlcXVpcmUoJy4vaXRlbS10eXBlcycpO1xuY29uc3Qgc3RyVG9EYXRlID0gcmVxdWlyZSgnLi9zdHItdG8tZGF0ZScpO1xuY29uc3QgZGVmYXVsdEl0ZW1UeXBlQ3JlYXRvclR5cGVMb29rdXAgPSByZXF1aXJlKCcuL2RlZmF1bHQtaXRlbS10eXBlLWNyZWF0b3ItdHlwZS1sb29rdXAnKTtcblxuY29uc3QgYmFzZU1hcHBpbmdzRmxhdCA9IE9iamVjdC5rZXlzKGJhc2VNYXBwaW5ncykucmVkdWNlKChhZ2dyLCBpdCkgPT4ge1xuXHRPYmplY3Qua2V5cyhiYXNlTWFwcGluZ3NbaXRdKS5mb3JFYWNoKG1hcEZyb20gPT4ge1xuXHRcdGxldCBrZXkgPSBgJHtpdH0ke21hcEZyb219YDtcblx0XHRsZXQgdmFsdWUgPSBiYXNlTWFwcGluZ3NbaXRdW21hcEZyb21dO1xuXHRcdGFnZ3Jba2V5XSA9IHZhbHVlO1xuXHR9KTtcblx0cmV0dXJuIGFnZ3I7XG59LCB7fSk7XG5cbm1vZHVsZS5leHBvcnRzID0gem90ZXJvSXRlbSA9PiB7XG5cdHZhciBjc2xUeXBlID0gQ1NMX1RZUEVfTUFQUElOR1Nbem90ZXJvSXRlbS5pdGVtVHlwZV07XG5cdGlmICghY3NsVHlwZSkge1xuXHRcdHRocm93IG5ldyBFcnJvcignVW5leHBlY3RlZCBab3Rlcm8gSXRlbSB0eXBlIFwiJyArIHpvdGVyb0l0ZW0uaXRlbVR5cGUgKyAnXCInKTtcblx0fVxuXG5cdHZhciBpdGVtVHlwZUlEID0gaXRlbVR5cGVzW3pvdGVyb0l0ZW0uaXRlbVR5cGVdO1xuXG5cdHZhciBjc2xJdGVtID0ge1xuXHRcdC8vICdpZCc6em90ZXJvSXRlbS51cmksXG5cdFx0aWQ6IHpvdGVyb0l0ZW0ua2V5LFxuXHRcdCd0eXBlJzpjc2xUeXBlXG5cdH07XG5cblx0Ly8gZ2V0IGFsbCB0ZXh0IHZhcmlhYmxlcyAodGhlcmUgbXVzdCBiZSBhIGJldHRlciB3YXkpXG5cdGZvcihsZXQgdmFyaWFibGUgaW4gQ1NMX1RFWFRfTUFQUElOR1MpIHtcblx0XHRsZXQgZmllbGRzID0gQ1NMX1RFWFRfTUFQUElOR1NbdmFyaWFibGVdO1xuXHRcdGZvcihsZXQgaT0wLCBuPWZpZWxkcy5sZW5ndGg7IGk8bjsgaSsrKSB7XG5cdFx0XHRsZXQgZmllbGQgPSBmaWVsZHNbaV0sXG5cdFx0XHRcdHZhbHVlID0gbnVsbDtcblxuXHRcdFx0aWYoZmllbGQgaW4gem90ZXJvSXRlbSkge1xuXHRcdFx0XHR2YWx1ZSA9IHpvdGVyb0l0ZW1bZmllbGRdO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0Y29uc3QgbWFwcGVkRmllbGQgPSBiYXNlTWFwcGluZ3NGbGF0W2Ake3pvdGVyb0l0ZW0uaXRlbVR5cGV9JHtmaWVsZH1gXTtcblx0XHRcdFx0dmFsdWUgPSB6b3Rlcm9JdGVtW21hcHBlZEZpZWxkXTtcblx0XHRcdH1cblxuXHRcdFx0aWYgKCF2YWx1ZSkgY29udGludWU7XG5cblx0XHRcdGlmICh0eXBlb2YgdmFsdWUgPT0gJ3N0cmluZycpIHtcblx0XHRcdFx0aWYgKGZpZWxkID09ICdJU0JOJykge1xuXHRcdFx0XHRcdC8vIE9ubHkgdXNlIHRoZSBmaXJzdCBJU0JOIGluIENTTCBKU09OXG5cdFx0XHRcdFx0dmFyIGlzYm4gPSB2YWx1ZS5tYXRjaCgvXig/Ojk3Wzg5XS0/KT8oPzpcXGQtPyl7OX1bXFxkeF0oPyEtKVxcYi9pKTtcblx0XHRcdFx0XHRpZihpc2JuKSB7XG5cdFx0XHRcdFx0XHR2YWx1ZSA9IGlzYm5bMF07XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cblx0XHRcdFx0Ly8gU3RyaXAgZW5jbG9zaW5nIHF1b3Rlc1xuXHRcdFx0XHRpZih2YWx1ZS5jaGFyQXQoMCkgPT0gJ1wiJyAmJiB2YWx1ZS5pbmRleE9mKCdcIicsIDEpID09IHZhbHVlLmxlbmd0aCAtIDEpIHtcblx0XHRcdFx0XHR2YWx1ZSA9IHZhbHVlLnN1YnN0cmluZygxLCB2YWx1ZS5sZW5ndGggLSAxKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRjc2xJdGVtW3ZhcmlhYmxlXSA9IHZhbHVlO1xuXHRcdFx0XHRicmVhaztcblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHQvLyBzZXBhcmF0ZSBuYW1lIHZhcmlhYmxlc1xuXHRpZiAoem90ZXJvSXRlbS50eXBlICE9ICdhdHRhY2htZW50JyAmJiB6b3Rlcm9JdGVtLnR5cGUgIT0gJ25vdGUnKSB7XG5cdFx0Ly8gdmFyIGF1dGhvciA9IFpvdGVyby5DcmVhdG9yVHlwZXMuZ2V0TmFtZShab3Rlcm8uQ3JlYXRvclR5cGVzLmdldFByaW1hcnlJREZvclR5cGUoKSk7XG5cdFx0bGV0IGF1dGhvciA9IGRlZmF1bHRJdGVtVHlwZUNyZWF0b3JUeXBlTG9va3VwW2l0ZW1UeXBlSURdO1xuXHRcdGxldCBjcmVhdG9ycyA9IHpvdGVyb0l0ZW0uY3JlYXRvcnM7XG5cdFx0Zm9yKGxldCBpID0gMDsgY3JlYXRvcnMgJiYgaSA8IGNyZWF0b3JzLmxlbmd0aDsgaSsrKSB7XG5cdFx0XHRsZXQgY3JlYXRvciA9IGNyZWF0b3JzW2ldO1xuXHRcdFx0bGV0IGNyZWF0b3JUeXBlID0gY3JlYXRvci5jcmVhdG9yVHlwZTtcblx0XHRcdGxldCBuYW1lT2JqO1xuXG5cdFx0XHRpZihjcmVhdG9yVHlwZSA9PSBhdXRob3IpIHtcblx0XHRcdFx0Y3JlYXRvclR5cGUgPSAnYXV0aG9yJztcblx0XHRcdH1cblxuXHRcdFx0Y3JlYXRvclR5cGUgPSBDU0xfTkFNRVNfTUFQUElOR1NbY3JlYXRvclR5cGVdO1xuXHRcdFx0aWYoIWNyZWF0b3JUeXBlKSB7XG5cdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAoJ2xhc3ROYW1lJyBpbiBjcmVhdG9yIHx8ICdmaXJzdE5hbWUnIGluIGNyZWF0b3IpIHtcblx0XHRcdFx0bmFtZU9iaiA9IHtcblx0XHRcdFx0XHRmYW1pbHk6IGNyZWF0b3IubGFzdE5hbWUgfHwgJycsXG5cdFx0XHRcdFx0Z2l2ZW46IGNyZWF0b3IuZmlyc3ROYW1lIHx8ICcnXG5cdFx0XHRcdH07XG5cblx0XHRcdFx0Ly8gUGFyc2UgbmFtZSBwYXJ0aWNsZXNcblx0XHRcdFx0Ly8gUmVwbGljYXRlIGNpdGVwcm9jLWpzIGxvZ2ljIGZvciB3aGF0IHNob3VsZCBiZSBwYXJzZWQgc28gd2UgZG9uJ3Rcblx0XHRcdFx0Ly8gYnJlYWsgY3VycmVudCBiZWhhdmlvci5cblx0XHRcdFx0aWYgKG5hbWVPYmouZmFtaWx5ICYmIG5hbWVPYmouZ2l2ZW4pIHtcblx0XHRcdFx0XHQvLyBEb24ndCBwYXJzZSBpZiBsYXN0IG5hbWUgaXMgcXVvdGVkXG5cdFx0XHRcdFx0aWYgKG5hbWVPYmouZmFtaWx5Lmxlbmd0aCA+IDFcblx0XHRcdFx0XHRcdCYmIG5hbWVPYmouZmFtaWx5LmNoYXJBdCgwKSA9PSAnXCInXG5cdFx0XHRcdFx0XHQmJiBuYW1lT2JqLmZhbWlseS5jaGFyQXQobmFtZU9iai5mYW1pbHkubGVuZ3RoIC0gMSkgPT0gJ1wiJ1xuXHRcdFx0XHRcdCkge1xuXHRcdFx0XHRcdFx0bmFtZU9iai5mYW1pbHkgPSBuYW1lT2JqLmZhbWlseS5zdWJzdHIoMSwgbmFtZU9iai5mYW1pbHkubGVuZ3RoIC0gMik7XG5cdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdENTTC5wYXJzZVBhcnRpY2xlcyhuYW1lT2JqLCB0cnVlKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH0gZWxzZSBpZiAoJ25hbWUnIGluIGNyZWF0b3IpIHtcblx0XHRcdFx0bmFtZU9iaiA9IHsnbGl0ZXJhbCc6IGNyZWF0b3IubmFtZX07XG5cdFx0XHR9XG5cblx0XHRcdGlmKGNzbEl0ZW1bY3JlYXRvclR5cGVdKSB7XG5cdFx0XHRcdGNzbEl0ZW1bY3JlYXRvclR5cGVdLnB1c2gobmFtZU9iaik7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRjc2xJdGVtW2NyZWF0b3JUeXBlXSA9IFtuYW1lT2JqXTtcblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHQvLyBnZXQgZGF0ZSB2YXJpYWJsZXNcblx0Zm9yKGxldCB2YXJpYWJsZSBpbiBDU0xfREFURV9NQVBQSU5HUykge1xuXHRcdGxldCBkYXRlID0gem90ZXJvSXRlbVtDU0xfREFURV9NQVBQSU5HU1t2YXJpYWJsZV1dO1xuXHRcdGlmICghZGF0ZSkge1xuXG5cdFx0XHRsZXQgdHlwZVNwZWNpZmljRmllbGRJRCA9IGdldEZpZWxkSURGcm9tVHlwZUFuZEJhc2UoaXRlbVR5cGVJRCwgQ1NMX0RBVEVfTUFQUElOR1NbdmFyaWFibGVdKTtcblx0XHRcdGlmICh0eXBlU3BlY2lmaWNGaWVsZElEKSB7XG5cdFx0XHRcdGRhdGUgPSB6b3Rlcm9JdGVtW2ZpZWxkc1t0eXBlU3BlY2lmaWNGaWVsZElEXV07XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0aWYoZGF0ZSkge1xuXHRcdFx0bGV0IGRhdGVPYmogPSBzdHJUb0RhdGUoZGF0ZSk7XG5cdFx0XHQvLyBvdGhlcndpc2UsIHVzZSBkYXRlLXBhcnRzXG5cdFx0XHRsZXQgZGF0ZVBhcnRzID0gW107XG5cdFx0XHRpZihkYXRlT2JqLnllYXIpIHtcblx0XHRcdFx0Ly8gYWRkIHllYXIsIG1vbnRoLCBhbmQgZGF5LCBpZiB0aGV5IGV4aXN0XG5cdFx0XHRcdGRhdGVQYXJ0cy5wdXNoKGRhdGVPYmoueWVhcik7XG5cdFx0XHRcdGlmKGRhdGVPYmoubW9udGggIT09IHVuZGVmaW5lZCkge1xuXHRcdFx0XHRcdGRhdGVQYXJ0cy5wdXNoKGRhdGVPYmoubW9udGgrMSk7XG5cdFx0XHRcdFx0aWYoZGF0ZU9iai5kYXkpIHtcblx0XHRcdFx0XHRcdGRhdGVQYXJ0cy5wdXNoKGRhdGVPYmouZGF5KTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdFx0Y3NsSXRlbVt2YXJpYWJsZV0gPSB7J2RhdGUtcGFydHMnOltkYXRlUGFydHNdfTtcblxuXHRcdFx0XHQvLyBpZiBubyBtb250aCwgdXNlIHNlYXNvbiBhcyBtb250aFxuXHRcdFx0XHRpZihkYXRlT2JqLnBhcnQgJiYgZGF0ZU9iai5tb250aCA9PT0gdW5kZWZpbmVkKSB7XG5cdFx0XHRcdFx0Y3NsSXRlbVt2YXJpYWJsZV0uc2Vhc29uID0gZGF0ZU9iai5wYXJ0O1xuXHRcdFx0XHR9XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHQvLyBpZiBubyB5ZWFyLCBwYXNzIGRhdGUgbGl0ZXJhbGx5XG5cdFx0XHRcdGNzbEl0ZW1bdmFyaWFibGVdID0geydsaXRlcmFsJzpkYXRlfTtcblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHQvLyBTcGVjaWFsIG1hcHBpbmcgZm9yIG5vdGUgdGl0bGVcblx0Ly8gQE5PVEU6IE5vdCBwb3J0ZWRcblx0Ly8gaWYgKHpvdGVyb0l0ZW0uaXRlbVR5cGUgPT0gJ25vdGUnICYmIHpvdGVyb0l0ZW0ubm90ZSkge1xuXHQvLyBcdGNzbEl0ZW0udGl0bGUgPSBab3Rlcm8uTm90ZXMubm90ZVRvVGl0bGUoem90ZXJvSXRlbS5ub3RlKTtcblx0Ly8gfVxuXG5cdC8vdGhpcy5fY2FjaGVbem90ZXJvSXRlbS5pZF0gPSBjc2xJdGVtO1xuXHRyZXR1cm4gY3NsSXRlbTtcbn1cbiIsIid1c2Ugc3RyaWN0JztcblxuY29uc3QgaXRlbVR5cGVzID0ge1xuXHQxOiAnbm90ZScsXG5cdDI6ICdib29rJyxcblx0MzogJ2Jvb2tTZWN0aW9uJyxcblx0NDogJ2pvdXJuYWxBcnRpY2xlJyxcblx0NTogJ21hZ2F6aW5lQXJ0aWNsZScsXG5cdDY6ICduZXdzcGFwZXJBcnRpY2xlJyxcblx0NzogJ3RoZXNpcycsXG5cdDg6ICdsZXR0ZXInLFxuXHQ5OiAnbWFudXNjcmlwdCcsXG5cdDEwOiAnaW50ZXJ2aWV3Jyxcblx0MTE6ICdmaWxtJyxcblx0MTI6ICdhcnR3b3JrJyxcblx0MTM6ICd3ZWJwYWdlJyxcblx0MTQ6ICdhdHRhY2htZW50Jyxcblx0MTU6ICdyZXBvcnQnLFxuXHQxNjogJ2JpbGwnLFxuXHQxNzogJ2Nhc2UnLFxuXHQxODogJ2hlYXJpbmcnLFxuXHQxOTogJ3BhdGVudCcsXG5cdDIwOiAnc3RhdHV0ZScsXG5cdDIxOiAnZW1haWwnLFxuXHQyMjogJ21hcCcsXG5cdDIzOiAnYmxvZ1Bvc3QnLFxuXHQyNDogJ2luc3RhbnRNZXNzYWdlJyxcblx0MjU6ICdmb3J1bVBvc3QnLFxuXHQyNjogJ2F1ZGlvUmVjb3JkaW5nJyxcblx0Mjc6ICdwcmVzZW50YXRpb24nLFxuXHQyODogJ3ZpZGVvUmVjb3JkaW5nJyxcblx0Mjk6ICd0dkJyb2FkY2FzdCcsXG5cdDMwOiAncmFkaW9Ccm9hZGNhc3QnLFxuXHQzMTogJ3BvZGNhc3QnLFxuXHQzMjogJ2NvbXB1dGVyUHJvZ3JhbScsXG5cdDMzOiAnY29uZmVyZW5jZVBhcGVyJyxcblx0MzQ6ICdkb2N1bWVudCcsXG5cdDM1OiAnZW5jeWNsb3BlZGlhQXJ0aWNsZScsXG5cdDM2OiAnZGljdGlvbmFyeUVudHJ5J1xufTtcblxuLy9yZXZlcnNlIGxvb2t1cFxuT2JqZWN0LmtleXMoaXRlbVR5cGVzKS5tYXAoayA9PiBpdGVtVHlwZXNbaXRlbVR5cGVzW2tdXSA9IGspO1xubW9kdWxlLmV4cG9ydHMgPSBpdGVtVHlwZXM7XG4iLCIndXNlIHN0cmljdCc7XG5cbm1vZHVsZS5leHBvcnRzID0gKHN0cmluZywgcGFkLCBsZW5ndGgpID0+IHtcblx0c3RyaW5nID0gc3RyaW5nID8gc3RyaW5nICsgJycgOiAnJztcblx0d2hpbGUoc3RyaW5nLmxlbmd0aCA8IGxlbmd0aCkge1xuXHRcdHN0cmluZyA9IHBhZCArIHN0cmluZztcblx0fVxuXHRyZXR1cm4gc3RyaW5nO1xufVxuIiwiJ3VzZSBzdHJpY3QnO1xuXG5jb25zdCBkYXRlVG9TUUwgPSByZXF1aXJlKCcuL2RhdGUtdG8tc3FsJyk7XG5cbmNvbnN0IG1vbnRocyA9IFsnamFuJywgJ2ZlYicsICdtYXInLCAnYXByJywgJ21heScsICdqdW4nLCAnanVsJywgJ2F1ZycsICdzZXAnLCAnb2N0JywgJ25vdicsICdkZWMnLCAnamFudWFyeScsICdmZWJydWFyeScsICdtYXJjaCcsICdhcHJpbCcsICdtYXknLCAnanVuZScsICdqdWx5JywgJ2F1Z3VzdCcsICdzZXB0ZW1iZXInLCAnb2N0b2JlcicsICdub3ZlbWJlcicsICdkZWNlbWJlciddO1xuXG5jb25zdCBfc2xhc2hSZSA9IC9eKC4qPylcXGIoWzAtOV17MSw0fSkoPzooW1xcLVxcL1xcLlxcdTVlNzRdKShbMC05XXsxLDJ9KSk/KD86KFtcXC1cXC9cXC5cXHU2NzA4XSkoWzAtOV17MSw0fSkpPygoPzpcXGJ8W14wLTldKS4qPykkL1xuY29uc3QgX3llYXJSZSA9IC9eKC4qPylcXGIoKD86Y2lyY2EgfGFyb3VuZCB8YWJvdXQgfGNcXC4/ID8pP1swLTldezEsNH0oPzogP0JcXC4/ID9DXFwuPyg/OiA/RVxcLj8pP3wgP0NcXC4/ID9FXFwuP3wgP0FcXC4/ID9EXFwuPyl8WzAtOV17Myw0fSlcXGIoLio/KSQvaTtcbmNvbnN0IF9tb250aFJlID0gbmV3IFJlZ0V4cCgnXiguKilcXFxcYignICsgbW9udGhzLmpvaW4oJ3wnKSArICcpW14gXSooPzogKC4qKSR8JCknLCAnaScpO1xuY29uc3QgX2RheVJlID0gbmV3IFJlZ0V4cCgnXFxcXGIoWzAtOV17MSwyfSkoPzpzdHxuZHxyZHx0aCk/XFxcXGIoLiopJywgJ2knKTtcblxuY29uc3QgX2luc2VydERhdGVPcmRlclBhcnQgPSAoZGF0ZU9yZGVyLCBwYXJ0LCBwYXJ0T3JkZXIpID0+IHtcblx0XHRpZiAoIWRhdGVPcmRlcikge1xuXHRcdFx0cmV0dXJuIHBhcnQ7XG5cdFx0fVxuXHRcdGlmIChwYXJ0T3JkZXIuYmVmb3JlID09PSB0cnVlKSB7XG5cdFx0XHRyZXR1cm4gcGFydCArIGRhdGVPcmRlcjtcblx0XHR9XG5cdFx0aWYgKHBhcnRPcmRlci5hZnRlciA9PT0gdHJ1ZSkge1xuXHRcdFx0cmV0dXJuIGRhdGVPcmRlciArIHBhcnQ7XG5cdFx0fVxuXHRcdGlmIChwYXJ0T3JkZXIuYmVmb3JlKSB7XG5cdFx0XHRsZXQgcG9zID0gZGF0ZU9yZGVyLmluZGV4T2YocGFydE9yZGVyLmJlZm9yZSk7XG5cdFx0XHRpZiAocG9zID09IC0xKSB7XG5cdFx0XHRcdHJldHVybiBkYXRlT3JkZXI7XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gZGF0ZU9yZGVyLnJlcGxhY2UobmV3IFJlZ0V4cCgnKCcgKyBwYXJ0T3JkZXIuYmVmb3JlICsgJyknKSwgcGFydCArICckMScpO1xuXHRcdH1cblx0XHRpZiAocGFydE9yZGVyLmFmdGVyKSB7XG5cdFx0XHRsZXQgcG9zID0gZGF0ZU9yZGVyLmluZGV4T2YocGFydE9yZGVyLmFmdGVyKTtcblx0XHRcdGlmIChwb3MgPT0gLTEpIHtcblx0XHRcdFx0cmV0dXJuIGRhdGVPcmRlciArIHBhcnQ7XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gZGF0ZU9yZGVyLnJlcGxhY2UobmV3IFJlZ0V4cCgnKCcgKyBwYXJ0T3JkZXIuYWZ0ZXIgKyAnKScpLCAnJDEnICsgcGFydCk7XG5cdFx0fVxuXHRcdHJldHVybiBkYXRlT3JkZXIgKyBwYXJ0O1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IHN0cmluZyA9PiB7XG5cdHZhciBkYXRlID0ge1xuXHRcdG9yZGVyOiAnJ1xuXHR9O1xuXG5cdC8vIHNraXAgZW1wdHkgdGhpbmdzXG5cdGlmKCFzdHJpbmcpIHtcblx0XHRyZXR1cm4gZGF0ZTtcblx0fVxuXG5cdHZhciBwYXJ0cyA9IFtdO1xuXG5cdC8vIFBhcnNlICd5ZXN0ZXJkYXknLyd0b2RheScvJ3RvbW9ycm93J1xuXHRsZXQgbGMgPSAoc3RyaW5nICsgJycpLnRvTG93ZXJDYXNlKCk7XG5cdGlmIChsYyA9PSAneWVzdGVyZGF5Jykge1xuXHRcdHN0cmluZyA9IGRhdGVUb1NRTChuZXcgRGF0ZShEYXRlLm5vdygpIC0gMTAwMCo2MCo2MCoyNCkpLnN1YnN0cigwLCAxMCk7XG5cdH1cblx0ZWxzZSBpZiAobGMgPT0gJ3RvZGF5Jykge1xuXHRcdHN0cmluZyA9IGRhdGVUb1NRTChuZXcgRGF0ZSgpKS5zdWJzdHIoMCwgMTApO1xuXHR9XG5cdGVsc2UgaWYgKGxjID09ICd0b21vcnJvdycpIHtcblx0XHRzdHJpbmcgPSBkYXRlVG9TUUwobmV3IERhdGUoRGF0ZS5ub3coKSArIDEwMDAqNjAqNjAqMjQpKS5zdWJzdHIoMCwgMTApO1xuXHR9XG5cdGVsc2Uge1xuXHRcdHN0cmluZyA9IHN0cmluZy50b1N0cmluZygpLnJlcGxhY2UoL15cXHMrfFxccyskL2csICcnKS5yZXBsYWNlKC9cXHMrLywgJyAnKTtcblx0fVxuXG5cdC8vIGZpcnN0LCBkaXJlY3RseSBpbnNwZWN0IHRoZSBzdHJpbmdcblx0bGV0IG0gPSBfc2xhc2hSZS5leGVjKHN0cmluZyk7XG5cdGlmKG0gJiZcblx0XHQoKCFtWzVdIHx8ICFtWzNdKSB8fCBtWzNdID09IG1bNV0gfHwgKG1bM10gPT0gJ1xcdTVlNzQnICYmIG1bNV0gPT0gJ1xcdTY3MDgnKSkgJiZcdC8vIHJlcXVpcmUgc2FuZSBzZXBhcmF0b3JzXG5cdFx0KChtWzJdICYmIG1bNF0gJiYgbVs2XSkgfHwgKCFtWzFdICYmICFtWzddKSkpIHtcdFx0XHRcdFx0XHQvLyByZXF1aXJlIHRoYXQgZWl0aGVyIGFsbCBwYXJ0cyBhcmUgZm91bmQsXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdC8vIG9yIGVsc2UgdGhpcyBpcyB0aGUgZW50aXJlIGRhdGUgZmllbGRcblx0XHQvLyBmaWd1cmUgb3V0IGRhdGUgYmFzZWQgb24gcGFydHNcblx0XHRpZihtWzJdLmxlbmd0aCA9PSAzIHx8IG1bMl0ubGVuZ3RoID09IDQgfHwgbVszXSA9PSAnXFx1NWU3NCcpIHtcblx0XHRcdC8vIElTTyA4NjAxIHN0eWxlIGRhdGUgKGJpZyBlbmRpYW4pXG5cdFx0XHRkYXRlLnllYXIgPSBtWzJdO1xuXHRcdFx0ZGF0ZS5tb250aCA9IG1bNF07XG5cdFx0XHRkYXRlLmRheSA9IG1bNl07XG5cdFx0XHRkYXRlLm9yZGVyICs9IG1bMl0gPyAneScgOiAnJztcblx0XHRcdGRhdGUub3JkZXIgKz0gbVs0XSA/ICdtJyA6ICcnO1xuXHRcdFx0ZGF0ZS5vcmRlciArPSBtWzZdID8gJ2QnIDogJyc7XG5cdFx0fSBlbHNlIGlmKG1bMl0gJiYgIW1bNF0gJiYgbVs2XSkge1xuXHRcdFx0ZGF0ZS5tb250aCA9IG1bMl07XG5cdFx0XHRkYXRlLnllYXIgPSBtWzZdO1xuXHRcdFx0ZGF0ZS5vcmRlciArPSBtWzJdID8gJ20nIDogJyc7XG5cdFx0XHRkYXRlLm9yZGVyICs9IG1bNl0gPyAneScgOiAnJztcblx0XHR9IGVsc2Uge1xuXHRcdFx0Ly8gbG9jYWwgc3R5bGUgZGF0ZSAobWlkZGxlIG9yIGxpdHRsZSBlbmRpYW4pXG5cdFx0XHR2YXIgY291bnRyeSA9IHdpbmRvdy5uYXZpZ2F0b3IubGFuZ3VhZ2UgPyB3aW5kb3cubmF2aWdhdG9yLmxhbmd1YWdlLnN1YnN0cigzKSA6ICdVUyc7XG5cdFx0XHRpZihjb3VudHJ5ID09ICdVUycgfHxcdC8vIFRoZSBVbml0ZWQgU3RhdGVzXG5cdFx0XHRcdGNvdW50cnkgPT0gJ0ZNJyB8fFx0Ly8gVGhlIEZlZGVyYXRlZCBTdGF0ZXMgb2YgTWljcm9uZXNpYVxuXHRcdFx0XHRjb3VudHJ5ID09ICdQVycgfHxcdC8vIFBhbGF1XG5cdFx0XHRcdGNvdW50cnkgPT0gJ1BIJykge1x0Ly8gVGhlIFBoaWxpcHBpbmVzXG5cdFx0XHRcdFx0ZGF0ZS5tb250aCA9IG1bMl07XG5cdFx0XHRcdFx0ZGF0ZS5kYXkgPSBtWzRdO1xuXHRcdFx0XHRcdGRhdGUub3JkZXIgKz0gbVsyXSA/ICdtJyA6ICcnO1xuXHRcdFx0XHRcdGRhdGUub3JkZXIgKz0gbVs0XSA/ICdkJyA6ICcnO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0ZGF0ZS5tb250aCA9IG1bNF07XG5cdFx0XHRcdGRhdGUuZGF5ID0gbVsyXTtcblx0XHRcdFx0ZGF0ZS5vcmRlciArPSBtWzJdID8gJ2QnIDogJyc7XG5cdFx0XHRcdGRhdGUub3JkZXIgKz0gbVs0XSA/ICdtJyA6ICcnO1xuXHRcdFx0fVxuXHRcdFx0ZGF0ZS55ZWFyID0gbVs2XTtcblx0XHRcdGRhdGUub3JkZXIgKz0gJ3knO1xuXHRcdH1cblxuXHRcdGlmKGRhdGUueWVhcikge1xuXHRcdFx0ZGF0ZS55ZWFyID0gcGFyc2VJbnQoZGF0ZS55ZWFyLCAxMCk7XG5cdFx0fVxuXHRcdGlmKGRhdGUuZGF5KSB7XG5cdFx0XHRkYXRlLmRheSA9IHBhcnNlSW50KGRhdGUuZGF5LCAxMCk7XG5cdFx0fVxuXHRcdGlmKGRhdGUubW9udGgpIHtcblx0XHRcdGRhdGUubW9udGggPSBwYXJzZUludChkYXRlLm1vbnRoLCAxMCk7XG5cblx0XHRcdGlmKGRhdGUubW9udGggPiAxMikge1xuXHRcdFx0XHQvLyBzd2FwIGRheSBhbmQgbW9udGhcblx0XHRcdFx0dmFyIHRtcCA9IGRhdGUuZGF5O1xuXHRcdFx0XHRkYXRlLmRheSA9IGRhdGUubW9udGhcblx0XHRcdFx0ZGF0ZS5tb250aCA9IHRtcDtcblx0XHRcdFx0ZGF0ZS5vcmRlciA9IGRhdGUub3JkZXIucmVwbGFjZSgnbScsICdEJylcblx0XHRcdFx0XHQucmVwbGFjZSgnZCcsICdNJylcblx0XHRcdFx0XHQucmVwbGFjZSgnRCcsICdkJylcblx0XHRcdFx0XHQucmVwbGFjZSgnTScsICdtJyk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0aWYoKCFkYXRlLm1vbnRoIHx8IGRhdGUubW9udGggPD0gMTIpICYmICghZGF0ZS5kYXkgfHwgZGF0ZS5kYXkgPD0gMzEpKSB7XG5cdFx0XHRpZihkYXRlLnllYXIgJiYgZGF0ZS55ZWFyIDwgMTAwKSB7XHQvLyBmb3IgdHdvIGRpZ2l0IHllYXJzLCBkZXRlcm1pbmUgcHJvcGVyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQvLyBmb3VyIGRpZ2l0IHllYXJcblx0XHRcdFx0dmFyIHRvZGF5ID0gbmV3IERhdGUoKTtcblx0XHRcdFx0dmFyIHllYXIgPSB0b2RheS5nZXRGdWxsWWVhcigpO1xuXHRcdFx0XHR2YXIgdHdvRGlnaXRZZWFyID0geWVhciAlIDEwMDtcblx0XHRcdFx0dmFyIGNlbnR1cnkgPSB5ZWFyIC0gdHdvRGlnaXRZZWFyO1xuXG5cdFx0XHRcdGlmKGRhdGUueWVhciA8PSB0d29EaWdpdFllYXIpIHtcblx0XHRcdFx0XHQvLyBhc3N1bWUgdGhpcyBkYXRlIGlzIGZyb20gb3VyIGNlbnR1cnlcblx0XHRcdFx0XHRkYXRlLnllYXIgPSBjZW50dXJ5ICsgZGF0ZS55ZWFyO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdC8vIGFzc3VtZSB0aGlzIGRhdGUgaXMgZnJvbSB0aGUgcHJldmlvdXMgY2VudHVyeVxuXHRcdFx0XHRcdGRhdGUueWVhciA9IGNlbnR1cnkgLSAxMDAgKyBkYXRlLnllYXI7XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdFx0aWYoZGF0ZS5tb250aCkge1xuXHRcdFx0XHRkYXRlLm1vbnRoLS07XHRcdC8vIHN1YnRyYWN0IG9uZSBmb3IgSlMgc3R5bGVcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdGRlbGV0ZSBkYXRlLm1vbnRoO1xuXHRcdFx0fVxuXG5cdFx0XHRwYXJ0cy5wdXNoKFxuXHRcdFx0XHR7IHBhcnQ6IG1bMV0sIGJlZm9yZTogdHJ1ZSB9LFxuXHRcdFx0XHR7IHBhcnQ6IG1bN10gfVxuXHRcdFx0KTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0dmFyIGRhdGUgPSB7XG5cdFx0XHRcdG9yZGVyOiAnJ1xuXHRcdFx0fTtcblx0XHRcdHBhcnRzLnB1c2goeyBwYXJ0OiBzdHJpbmcgfSk7XG5cdFx0fVxuXHR9IGVsc2Uge1xuXHRcdHBhcnRzLnB1c2goeyBwYXJ0OiBzdHJpbmcgfSk7XG5cdH1cblxuXHQvLyBjb3VsZG4ndCBmaW5kIHNvbWV0aGluZyB3aXRoIHRoZSBhbGdvcml0aG1zOyB1c2UgcmVnZXhwXG5cdC8vIFlFQVJcblx0aWYoIWRhdGUueWVhcikge1xuXHRcdGZvciAobGV0IGkgaW4gcGFydHMpIHtcblx0XHRcdGxldCBtID0gX3llYXJSZS5leGVjKHBhcnRzW2ldLnBhcnQpO1xuXHRcdFx0aWYgKG0pIHtcblx0XHRcdFx0ZGF0ZS55ZWFyID0gbVsyXTtcblx0XHRcdFx0ZGF0ZS5vcmRlciA9IF9pbnNlcnREYXRlT3JkZXJQYXJ0KGRhdGUub3JkZXIsICd5JywgcGFydHNbaV0pO1xuXHRcdFx0XHRwYXJ0cy5zcGxpY2UoXG5cdFx0XHRcdFx0aSwgMSxcblx0XHRcdFx0XHR7IHBhcnQ6IG1bMV0sIGJlZm9yZTogdHJ1ZSB9LFxuXHRcdFx0XHRcdHsgcGFydDogbVszXSB9XG5cdFx0XHRcdCk7XG5cdFx0XHRcdGJyZWFrO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdC8vIE1PTlRIXG5cdGlmKGRhdGUubW9udGggPT09IHVuZGVmaW5lZCkge1xuXHRcdGZvciAobGV0IGkgaW4gcGFydHMpIHtcblx0XHRcdGxldCBtID0gX21vbnRoUmUuZXhlYyhwYXJ0c1tpXS5wYXJ0KTtcblx0XHRcdGlmIChtKSB7XG5cdFx0XHRcdC8vIE1vZHVsbyAxMiBpbiBjYXNlIHdlIGhhdmUgbXVsdGlwbGUgbGFuZ3VhZ2VzXG5cdFx0XHRcdGRhdGUubW9udGggPSBtb250aHMuaW5kZXhPZihtWzJdLnRvTG93ZXJDYXNlKCkpICUgMTI7XG5cdFx0XHRcdGRhdGUub3JkZXIgPSBfaW5zZXJ0RGF0ZU9yZGVyUGFydChkYXRlLm9yZGVyLCAnbScsIHBhcnRzW2ldKTtcblx0XHRcdFx0cGFydHMuc3BsaWNlKFxuXHRcdFx0XHRcdGksIDEsXG5cdFx0XHRcdFx0eyBwYXJ0OiBtWzFdLCBiZWZvcmU6ICdtJyB9LFxuXHRcdFx0XHRcdHsgcGFydDogbVszXSwgYWZ0ZXI6ICdtJyB9XG5cdFx0XHRcdCk7XG5cdFx0XHRcdGJyZWFrO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdC8vIERBWVxuXHRpZighZGF0ZS5kYXkpIHtcblx0XHQvLyBjb21waWxlIGRheSByZWd1bGFyIGV4cHJlc3Npb25cblx0XHRmb3IgKGxldCBpIGluIHBhcnRzKSB7XG5cdFx0XHRsZXQgbSA9IF9kYXlSZS5leGVjKHBhcnRzW2ldLnBhcnQpO1xuXHRcdFx0aWYgKG0pIHtcblx0XHRcdFx0dmFyIGRheSA9IHBhcnNlSW50KG1bMV0sIDEwKSxcblx0XHRcdFx0XHRwYXJ0O1xuXHRcdFx0XHQvLyBTYW5pdHkgY2hlY2tcblx0XHRcdFx0aWYgKGRheSA8PSAzMSkge1xuXHRcdFx0XHRcdGRhdGUuZGF5ID0gZGF5O1xuXHRcdFx0XHRcdGRhdGUub3JkZXIgPSBfaW5zZXJ0RGF0ZU9yZGVyUGFydChkYXRlLm9yZGVyLCAnZCcsIHBhcnRzW2ldKTtcblx0XHRcdFx0XHRpZihtLmluZGV4ID4gMCkge1xuXHRcdFx0XHRcdFx0cGFydCA9IHBhcnRzW2ldLnBhcnQuc3Vic3RyKDAsIG0uaW5kZXgpO1xuXHRcdFx0XHRcdFx0aWYobVsyXSkge1xuXHRcdFx0XHRcdFx0XHRwYXJ0ICs9ICcgJyArIG1bMl07XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdHBhcnQgPSBtWzJdO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRwYXJ0cy5zcGxpY2UoXG5cdFx0XHRcdFx0XHRpLCAxLFxuXHRcdFx0XHRcdFx0eyBwYXJ0OiBwYXJ0IH1cblx0XHRcdFx0XHQpO1xuXHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0Ly8gQ29uY2F0ZW5hdGUgZGF0ZSBwYXJ0c1xuXHRkYXRlLnBhcnQgPSAnJztcblx0Zm9yICh2YXIgaSBpbiBwYXJ0cykge1xuXHRcdGRhdGUucGFydCArPSBwYXJ0c1tpXS5wYXJ0ICsgJyAnO1xuXHR9XG5cblx0Ly8gY2xlYW4gdXAgZGF0ZSBwYXJ0XG5cdGlmKGRhdGUucGFydCkge1xuXHRcdGRhdGUucGFydCA9IGRhdGUucGFydC5yZXBsYWNlKC9eW15BLVphLXowLTldK3xbXkEtWmEtejAtOV0rJC9nLCAnJyk7XG5cdH1cblxuXHRpZihkYXRlLnBhcnQgPT09ICcnIHx8IGRhdGUucGFydCA9PSB1bmRlZmluZWQpIHtcblx0XHRkZWxldGUgZGF0ZS5wYXJ0O1xuXHR9XG5cblx0Ly9tYWtlIHN1cmUgeWVhciBpcyBhbHdheXMgYSBzdHJpbmdcblx0aWYoZGF0ZS55ZWFyIHx8IGRhdGUueWVhciA9PT0gMCkgZGF0ZS55ZWFyICs9ICcnO1xuXG5cdHJldHVybiBkYXRlO1xufVxuIiwiY29uc3QgZmllbGRzID0gcmVxdWlyZSgnLi9maWVsZHMnKTtcbmNvbnN0IGl0ZW1UeXBlcyA9IHJlcXVpcmUoJy4vaXRlbS10eXBlcycpO1xuXG5jb25zdCB0eXBlU3BlY2lmaWNGaWVsZE1hcCA9IHtcblx0WygxNiA8PCA4KSArIDRdOiA5NCxcblx0WygxNyA8PCA4KSArIDRdOiA5Nyxcblx0Wyg3IDw8IDgpICsgOF06IDg5LFxuXHRbKDExIDw8IDgpICsgOF06IDIxLFxuXHRbKDE1IDw8IDgpICsgOF06IDMxLFxuXHRbKDI2IDw8IDgpICsgOF06IDcyLFxuXHRbKDI4IDw8IDgpICsgOF06IDc2LFxuXHRbKDI5IDw8IDgpICsgOF06IDc4LFxuXHRbKDMwIDw8IDgpICsgOF06IDc4LFxuXHRbKDMyIDw8IDgpICsgOF06IDgzLFxuXHRbKDE2IDw8IDgpICsgMTBdOiA5NSxcblx0WygxNyA8PCA4KSArIDEwXTogOTgsXG5cdFsoMyA8PCA4KSArIDEyXTogMTE1LFxuXHRbKDMzIDw8IDgpICsgMTJdOiAxMTQsXG5cdFsoMTMgPDwgOCkgKyAxMl06IDkxLFxuXHRbKDIzIDw8IDgpICsgMTJdOiAxMDcsXG5cdFsoMjUgPDwgOCkgKyAxMl06IDEwNCxcblx0WygyOSA8PCA4KSArIDEyXTogMTE5LFxuXHRbKDMwIDw8IDgpICsgMTJdOiAxMTksXG5cdFsoMzUgPDwgOCkgKyAxMl06IDg1LFxuXHRbKDM2IDw8IDgpICsgMTJdOiA4Nixcblx0WygxNyA8PCA4KSArIDE0XTogOTYsXG5cdFsoMTkgPDwgOCkgKyAxNF06IDUyLFxuXHRbKDIwIDw8IDgpICsgMTRdOiAxMDAsXG5cdFsoMTUgPDwgOCkgKyA2MF06IDkyLFxuXHRbKDE2IDw8IDgpICsgNjBdOiA5Myxcblx0WygxNyA8PCA4KSArIDYwXTogMTE3LFxuXHRbKDE4IDw8IDgpICsgNjBdOiA5OSxcblx0WygxOSA8PCA4KSArIDYwXTogNTAsXG5cdFsoMjAgPDwgOCkgKyA2MF06IDEwMSxcblx0WygyOSA8PCA4KSArIDYwXTogMTA1LFxuXHRbKDMwIDw8IDgpICsgNjBdOiAxMDUsXG5cdFsoMzEgPDwgOCkgKyA2MF06IDEwNSxcblx0Wyg3IDw8IDgpICsgMTA4XTogNjksXG5cdFsoOCA8PCA4KSArIDEwOF06IDY1LFxuXHRbKDkgPDwgOCkgKyAxMDhdOiA2Nixcblx0WygxMSA8PCA4KSArIDEwOF06IDEyMixcblx0WygxMyA8PCA4KSArIDEwOF06IDcwLFxuXHRbKDE1IDw8IDgpICsgMTA4XTogMzIsXG5cdFsoMjIgPDwgOCkgKyAxMDhdOiA2Nyxcblx0WygyMyA8PCA4KSArIDEwOF06IDcwLFxuXHRbKDI1IDw8IDgpICsgMTA4XTogNzksXG5cdFsoMjcgPDwgOCkgKyAxMDhdOiA3NCxcblx0WygxMCA8PCA4KSArIDEwOV06IDY0LFxuXHRbKDExIDw8IDgpICsgMTA5XTogNjMsXG5cdFsoMTIgPDwgOCkgKyAxMDldOiA1OSxcblx0WygyNiA8PCA4KSArIDEwOV06IDcxLFxuXHRbKDI4IDw8IDgpICsgMTA5XTogNjMsXG5cdFsoMjkgPDwgOCkgKyAxMDldOiA2Myxcblx0WygzMCA8PCA4KSArIDEwOV06IDcxLFxuXHRbKDMxIDw8IDgpICsgMTA5XTogODAsXG5cdFsoMTcgPDwgOCkgKyAxMTBdOiAxMTEsXG5cdFsoMjAgPDwgOCkgKyAxMTBdOiAxMTIsXG5cdFsoMjEgPDwgOCkgKyAxMTBdOiAxMTNcbn07XG5cbm1vZHVsZS5leHBvcnRzID0ge1xuXHRtYXA6IHR5cGVTcGVjaWZpY0ZpZWxkTWFwLFxuXHRnZXRGaWVsZElERnJvbVR5cGVBbmRCYXNlOiAodHlwZUlkLCBmaWVsZElkKSA9PiB7XG5cdFx0dHlwZUlkID0gdHlwZW9mIHR5cGVJZCA9PT0gJ251bWJlcicgPyB0eXBlSWQgOiBpdGVtVHlwZXNbdHlwZUlkXTtcblx0XHRmaWVsZElkID0gdHlwZW9mIGZpZWxkSWQgPT09ICdudW1iZXInID8gZmllbGRJZCA6IGZpZWxkc1tmaWVsZElkXTtcblx0XHRyZXR1cm4gdHlwZVNwZWNpZmljRmllbGRNYXBbKHR5cGVJZCA8PCA4KSArIGZpZWxkSWRdO1xuXHR9XG59O1xuIl19
