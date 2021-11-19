var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __markAsModule = (target) => __defProp(target, "__esModule", { value: true });
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[Object.keys(fn)[0]])(fn = 0)), res;
};
var __commonJS = (cb, mod) => function __require() {
  return mod || (0, cb[Object.keys(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};
var __export = (target, all) => {
  __markAsModule(target);
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __reExport = (target, module2, desc) => {
  if (module2 && typeof module2 === "object" || typeof module2 === "function") {
    for (let key of __getOwnPropNames(module2))
      if (!__hasOwnProp.call(target, key) && key !== "default")
        __defProp(target, key, { get: () => module2[key], enumerable: !(desc = __getOwnPropDesc(module2, key)) || desc.enumerable });
  }
  return target;
};
var __toModule = (module2) => {
  return __reExport(__markAsModule(__defProp(module2 != null ? __create(__getProtoOf(module2)) : {}, "default", module2 && module2.__esModule && "default" in module2 ? { get: () => module2.default, enumerable: true } : { value: module2, enumerable: true })), module2);
};

// node_modules/@sveltejs/kit/dist/install-fetch.js
function dataUriToBuffer(uri) {
  if (!/^data:/i.test(uri)) {
    throw new TypeError('`uri` does not appear to be a Data URI (must begin with "data:")');
  }
  uri = uri.replace(/\r?\n/g, "");
  const firstComma = uri.indexOf(",");
  if (firstComma === -1 || firstComma <= 4) {
    throw new TypeError("malformed data: URI");
  }
  const meta = uri.substring(5, firstComma).split(";");
  let charset = "";
  let base64 = false;
  const type = meta[0] || "text/plain";
  let typeFull = type;
  for (let i = 1; i < meta.length; i++) {
    if (meta[i] === "base64") {
      base64 = true;
    } else {
      typeFull += `;${meta[i]}`;
      if (meta[i].indexOf("charset=") === 0) {
        charset = meta[i].substring(8);
      }
    }
  }
  if (!meta[0] && !charset.length) {
    typeFull += ";charset=US-ASCII";
    charset = "US-ASCII";
  }
  const encoding = base64 ? "base64" : "ascii";
  const data = unescape(uri.substring(firstComma + 1));
  const buffer = Buffer.from(data, encoding);
  buffer.type = type;
  buffer.typeFull = typeFull;
  buffer.charset = charset;
  return buffer;
}
async function* toIterator(parts, clone2 = true) {
  for (const part of parts) {
    if ("stream" in part) {
      yield* part.stream();
    } else if (ArrayBuffer.isView(part)) {
      if (clone2) {
        let position = part.byteOffset;
        const end = part.byteOffset + part.byteLength;
        while (position !== end) {
          const size = Math.min(end - position, POOL_SIZE);
          const chunk = part.buffer.slice(position, position + size);
          position += chunk.byteLength;
          yield new Uint8Array(chunk);
        }
      } else {
        yield part;
      }
    } else {
      let position = 0;
      while (position !== part.size) {
        const chunk = part.slice(position, Math.min(part.size, position + POOL_SIZE));
        const buffer = await chunk.arrayBuffer();
        position += buffer.byteLength;
        yield new Uint8Array(buffer);
      }
    }
  }
}
function isFormData(object) {
  return typeof object === "object" && typeof object.append === "function" && typeof object.set === "function" && typeof object.get === "function" && typeof object.getAll === "function" && typeof object.delete === "function" && typeof object.keys === "function" && typeof object.values === "function" && typeof object.entries === "function" && typeof object.constructor === "function" && object[NAME] === "FormData";
}
function getHeader(boundary, name, field) {
  let header = "";
  header += `${dashes}${boundary}${carriage}`;
  header += `Content-Disposition: form-data; name="${name}"`;
  if (isBlob(field)) {
    header += `; filename="${field.name}"${carriage}`;
    header += `Content-Type: ${field.type || "application/octet-stream"}`;
  }
  return `${header}${carriage.repeat(2)}`;
}
async function* formDataIterator(form, boundary) {
  for (const [name, value] of form) {
    yield getHeader(boundary, name, value);
    if (isBlob(value)) {
      yield* value.stream();
    } else {
      yield value;
    }
    yield carriage;
  }
  yield getFooter(boundary);
}
function getFormDataLength(form, boundary) {
  let length = 0;
  for (const [name, value] of form) {
    length += Buffer.byteLength(getHeader(boundary, name, value));
    length += isBlob(value) ? value.size : Buffer.byteLength(String(value));
    length += carriageLength;
  }
  length += Buffer.byteLength(getFooter(boundary));
  return length;
}
async function consumeBody(data) {
  if (data[INTERNALS$2].disturbed) {
    throw new TypeError(`body used already for: ${data.url}`);
  }
  data[INTERNALS$2].disturbed = true;
  if (data[INTERNALS$2].error) {
    throw data[INTERNALS$2].error;
  }
  let { body } = data;
  if (body === null) {
    return Buffer.alloc(0);
  }
  if (isBlob(body)) {
    body = import_stream.default.Readable.from(body.stream());
  }
  if (Buffer.isBuffer(body)) {
    return body;
  }
  if (!(body instanceof import_stream.default)) {
    return Buffer.alloc(0);
  }
  const accum = [];
  let accumBytes = 0;
  try {
    for await (const chunk of body) {
      if (data.size > 0 && accumBytes + chunk.length > data.size) {
        const error2 = new FetchError(`content size at ${data.url} over limit: ${data.size}`, "max-size");
        body.destroy(error2);
        throw error2;
      }
      accumBytes += chunk.length;
      accum.push(chunk);
    }
  } catch (error2) {
    const error_ = error2 instanceof FetchBaseError ? error2 : new FetchError(`Invalid response body while trying to fetch ${data.url}: ${error2.message}`, "system", error2);
    throw error_;
  }
  if (body.readableEnded === true || body._readableState.ended === true) {
    try {
      if (accum.every((c) => typeof c === "string")) {
        return Buffer.from(accum.join(""));
      }
      return Buffer.concat(accum, accumBytes);
    } catch (error2) {
      throw new FetchError(`Could not create Buffer from response body for ${data.url}: ${error2.message}`, "system", error2);
    }
  } else {
    throw new FetchError(`Premature close of server response while trying to fetch ${data.url}`);
  }
}
function fromRawHeaders(headers = []) {
  return new Headers(headers.reduce((result, value, index, array) => {
    if (index % 2 === 0) {
      result.push(array.slice(index, index + 2));
    }
    return result;
  }, []).filter(([name, value]) => {
    try {
      validateHeaderName(name);
      validateHeaderValue(name, String(value));
      return true;
    } catch {
      return false;
    }
  }));
}
async function fetch(url, options_) {
  return new Promise((resolve2, reject) => {
    const request = new Request(url, options_);
    const options2 = getNodeRequestOptions(request);
    if (!supportedSchemas.has(options2.protocol)) {
      throw new TypeError(`node-fetch cannot load ${url}. URL scheme "${options2.protocol.replace(/:$/, "")}" is not supported.`);
    }
    if (options2.protocol === "data:") {
      const data = dataUriToBuffer$1(request.url);
      const response2 = new Response(data, { headers: { "Content-Type": data.typeFull } });
      resolve2(response2);
      return;
    }
    const send = (options2.protocol === "https:" ? import_https.default : import_http.default).request;
    const { signal } = request;
    let response = null;
    const abort = () => {
      const error2 = new AbortError("The operation was aborted.");
      reject(error2);
      if (request.body && request.body instanceof import_stream.default.Readable) {
        request.body.destroy(error2);
      }
      if (!response || !response.body) {
        return;
      }
      response.body.emit("error", error2);
    };
    if (signal && signal.aborted) {
      abort();
      return;
    }
    const abortAndFinalize = () => {
      abort();
      finalize();
    };
    const request_ = send(options2);
    if (signal) {
      signal.addEventListener("abort", abortAndFinalize);
    }
    const finalize = () => {
      request_.abort();
      if (signal) {
        signal.removeEventListener("abort", abortAndFinalize);
      }
    };
    request_.on("error", (error2) => {
      reject(new FetchError(`request to ${request.url} failed, reason: ${error2.message}`, "system", error2));
      finalize();
    });
    fixResponseChunkedTransferBadEnding(request_, (error2) => {
      response.body.destroy(error2);
    });
    if (process.version < "v14") {
      request_.on("socket", (s2) => {
        let endedWithEventsCount;
        s2.prependListener("end", () => {
          endedWithEventsCount = s2._eventsCount;
        });
        s2.prependListener("close", (hadError) => {
          if (response && endedWithEventsCount < s2._eventsCount && !hadError) {
            const error2 = new Error("Premature close");
            error2.code = "ERR_STREAM_PREMATURE_CLOSE";
            response.body.emit("error", error2);
          }
        });
      });
    }
    request_.on("response", (response_) => {
      request_.setTimeout(0);
      const headers = fromRawHeaders(response_.rawHeaders);
      if (isRedirect(response_.statusCode)) {
        const location = headers.get("Location");
        const locationURL = location === null ? null : new URL(location, request.url);
        switch (request.redirect) {
          case "error":
            reject(new FetchError(`uri requested responds with a redirect, redirect mode is set to error: ${request.url}`, "no-redirect"));
            finalize();
            return;
          case "manual":
            if (locationURL !== null) {
              headers.set("Location", locationURL);
            }
            break;
          case "follow": {
            if (locationURL === null) {
              break;
            }
            if (request.counter >= request.follow) {
              reject(new FetchError(`maximum redirect reached at: ${request.url}`, "max-redirect"));
              finalize();
              return;
            }
            const requestOptions = {
              headers: new Headers(request.headers),
              follow: request.follow,
              counter: request.counter + 1,
              agent: request.agent,
              compress: request.compress,
              method: request.method,
              body: request.body,
              signal: request.signal,
              size: request.size
            };
            if (response_.statusCode !== 303 && request.body && options_.body instanceof import_stream.default.Readable) {
              reject(new FetchError("Cannot follow redirect with body being a readable stream", "unsupported-redirect"));
              finalize();
              return;
            }
            if (response_.statusCode === 303 || (response_.statusCode === 301 || response_.statusCode === 302) && request.method === "POST") {
              requestOptions.method = "GET";
              requestOptions.body = void 0;
              requestOptions.headers.delete("content-length");
            }
            resolve2(fetch(new Request(locationURL, requestOptions)));
            finalize();
            return;
          }
          default:
            return reject(new TypeError(`Redirect option '${request.redirect}' is not a valid value of RequestRedirect`));
        }
      }
      if (signal) {
        response_.once("end", () => {
          signal.removeEventListener("abort", abortAndFinalize);
        });
      }
      let body = (0, import_stream.pipeline)(response_, new import_stream.PassThrough(), reject);
      if (process.version < "v12.10") {
        response_.on("aborted", abortAndFinalize);
      }
      const responseOptions = {
        url: request.url,
        status: response_.statusCode,
        statusText: response_.statusMessage,
        headers,
        size: request.size,
        counter: request.counter,
        highWaterMark: request.highWaterMark
      };
      const codings = headers.get("Content-Encoding");
      if (!request.compress || request.method === "HEAD" || codings === null || response_.statusCode === 204 || response_.statusCode === 304) {
        response = new Response(body, responseOptions);
        resolve2(response);
        return;
      }
      const zlibOptions = {
        flush: import_zlib.default.Z_SYNC_FLUSH,
        finishFlush: import_zlib.default.Z_SYNC_FLUSH
      };
      if (codings === "gzip" || codings === "x-gzip") {
        body = (0, import_stream.pipeline)(body, import_zlib.default.createGunzip(zlibOptions), reject);
        response = new Response(body, responseOptions);
        resolve2(response);
        return;
      }
      if (codings === "deflate" || codings === "x-deflate") {
        const raw = (0, import_stream.pipeline)(response_, new import_stream.PassThrough(), reject);
        raw.once("data", (chunk) => {
          body = (chunk[0] & 15) === 8 ? (0, import_stream.pipeline)(body, import_zlib.default.createInflate(), reject) : (0, import_stream.pipeline)(body, import_zlib.default.createInflateRaw(), reject);
          response = new Response(body, responseOptions);
          resolve2(response);
        });
        return;
      }
      if (codings === "br") {
        body = (0, import_stream.pipeline)(body, import_zlib.default.createBrotliDecompress(), reject);
        response = new Response(body, responseOptions);
        resolve2(response);
        return;
      }
      response = new Response(body, responseOptions);
      resolve2(response);
    });
    writeToStream(request_, request);
  });
}
function fixResponseChunkedTransferBadEnding(request, errorCallback) {
  const LAST_CHUNK = Buffer.from("0\r\n\r\n");
  let isChunkedTransfer = false;
  let properLastChunkReceived = false;
  let previousChunk;
  request.on("response", (response) => {
    const { headers } = response;
    isChunkedTransfer = headers["transfer-encoding"] === "chunked" && !headers["content-length"];
  });
  request.on("socket", (socket) => {
    const onSocketClose = () => {
      if (isChunkedTransfer && !properLastChunkReceived) {
        const error2 = new Error("Premature close");
        error2.code = "ERR_STREAM_PREMATURE_CLOSE";
        errorCallback(error2);
      }
    };
    socket.prependListener("close", onSocketClose);
    request.on("abort", () => {
      socket.removeListener("close", onSocketClose);
    });
    socket.on("data", (buf) => {
      properLastChunkReceived = Buffer.compare(buf.slice(-5), LAST_CHUNK) === 0;
      if (!properLastChunkReceived && previousChunk) {
        properLastChunkReceived = Buffer.compare(previousChunk.slice(-3), LAST_CHUNK.slice(0, 3)) === 0 && Buffer.compare(buf.slice(-2), LAST_CHUNK.slice(3)) === 0;
      }
      previousChunk = buf;
    });
  });
}
var import_http, import_https, import_zlib, import_stream, import_util, import_crypto, import_url, commonjsGlobal, src, dataUriToBuffer$1, ponyfill_es2018, POOL_SIZE$1, POOL_SIZE, _Blob, Blob3, Blob$1, FetchBaseError, FetchError, NAME, isURLSearchParameters, isBlob, isAbortSignal, carriage, dashes, carriageLength, getFooter, getBoundary, INTERNALS$2, Body, clone, extractContentType, getTotalBytes, writeToStream, validateHeaderName, validateHeaderValue, Headers, redirectStatus, isRedirect, INTERNALS$1, Response, getSearch, INTERNALS, isRequest, Request, getNodeRequestOptions, AbortError, supportedSchemas;
var init_install_fetch = __esm({
  "node_modules/@sveltejs/kit/dist/install-fetch.js"() {
    init_shims();
    import_http = __toModule(require("http"));
    import_https = __toModule(require("https"));
    import_zlib = __toModule(require("zlib"));
    import_stream = __toModule(require("stream"));
    import_util = __toModule(require("util"));
    import_crypto = __toModule(require("crypto"));
    import_url = __toModule(require("url"));
    commonjsGlobal = typeof globalThis !== "undefined" ? globalThis : typeof window !== "undefined" ? window : typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : {};
    src = dataUriToBuffer;
    dataUriToBuffer$1 = src;
    ponyfill_es2018 = { exports: {} };
    (function(module2, exports) {
      (function(global2, factory) {
        factory(exports);
      })(commonjsGlobal, function(exports2) {
        const SymbolPolyfill = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? Symbol : (description) => `Symbol(${description})`;
        function noop2() {
          return void 0;
        }
        function getGlobals() {
          if (typeof self !== "undefined") {
            return self;
          } else if (typeof window !== "undefined") {
            return window;
          } else if (typeof commonjsGlobal !== "undefined") {
            return commonjsGlobal;
          }
          return void 0;
        }
        const globals = getGlobals();
        function typeIsObject(x) {
          return typeof x === "object" && x !== null || typeof x === "function";
        }
        const rethrowAssertionErrorRejection = noop2;
        const originalPromise = Promise;
        const originalPromiseThen = Promise.prototype.then;
        const originalPromiseResolve = Promise.resolve.bind(originalPromise);
        const originalPromiseReject = Promise.reject.bind(originalPromise);
        function newPromise(executor) {
          return new originalPromise(executor);
        }
        function promiseResolvedWith(value) {
          return originalPromiseResolve(value);
        }
        function promiseRejectedWith(reason) {
          return originalPromiseReject(reason);
        }
        function PerformPromiseThen(promise, onFulfilled, onRejected) {
          return originalPromiseThen.call(promise, onFulfilled, onRejected);
        }
        function uponPromise(promise, onFulfilled, onRejected) {
          PerformPromiseThen(PerformPromiseThen(promise, onFulfilled, onRejected), void 0, rethrowAssertionErrorRejection);
        }
        function uponFulfillment(promise, onFulfilled) {
          uponPromise(promise, onFulfilled);
        }
        function uponRejection(promise, onRejected) {
          uponPromise(promise, void 0, onRejected);
        }
        function transformPromiseWith(promise, fulfillmentHandler, rejectionHandler) {
          return PerformPromiseThen(promise, fulfillmentHandler, rejectionHandler);
        }
        function setPromiseIsHandledToTrue(promise) {
          PerformPromiseThen(promise, void 0, rethrowAssertionErrorRejection);
        }
        const queueMicrotask = (() => {
          const globalQueueMicrotask = globals && globals.queueMicrotask;
          if (typeof globalQueueMicrotask === "function") {
            return globalQueueMicrotask;
          }
          const resolvedPromise = promiseResolvedWith(void 0);
          return (fn) => PerformPromiseThen(resolvedPromise, fn);
        })();
        function reflectCall(F, V, args) {
          if (typeof F !== "function") {
            throw new TypeError("Argument is not a function");
          }
          return Function.prototype.apply.call(F, V, args);
        }
        function promiseCall(F, V, args) {
          try {
            return promiseResolvedWith(reflectCall(F, V, args));
          } catch (value) {
            return promiseRejectedWith(value);
          }
        }
        const QUEUE_MAX_ARRAY_SIZE = 16384;
        class SimpleQueue {
          constructor() {
            this._cursor = 0;
            this._size = 0;
            this._front = {
              _elements: [],
              _next: void 0
            };
            this._back = this._front;
            this._cursor = 0;
            this._size = 0;
          }
          get length() {
            return this._size;
          }
          push(element) {
            const oldBack = this._back;
            let newBack = oldBack;
            if (oldBack._elements.length === QUEUE_MAX_ARRAY_SIZE - 1) {
              newBack = {
                _elements: [],
                _next: void 0
              };
            }
            oldBack._elements.push(element);
            if (newBack !== oldBack) {
              this._back = newBack;
              oldBack._next = newBack;
            }
            ++this._size;
          }
          shift() {
            const oldFront = this._front;
            let newFront = oldFront;
            const oldCursor = this._cursor;
            let newCursor = oldCursor + 1;
            const elements = oldFront._elements;
            const element = elements[oldCursor];
            if (newCursor === QUEUE_MAX_ARRAY_SIZE) {
              newFront = oldFront._next;
              newCursor = 0;
            }
            --this._size;
            this._cursor = newCursor;
            if (oldFront !== newFront) {
              this._front = newFront;
            }
            elements[oldCursor] = void 0;
            return element;
          }
          forEach(callback) {
            let i = this._cursor;
            let node = this._front;
            let elements = node._elements;
            while (i !== elements.length || node._next !== void 0) {
              if (i === elements.length) {
                node = node._next;
                elements = node._elements;
                i = 0;
                if (elements.length === 0) {
                  break;
                }
              }
              callback(elements[i]);
              ++i;
            }
          }
          peek() {
            const front = this._front;
            const cursor = this._cursor;
            return front._elements[cursor];
          }
        }
        function ReadableStreamReaderGenericInitialize(reader, stream) {
          reader._ownerReadableStream = stream;
          stream._reader = reader;
          if (stream._state === "readable") {
            defaultReaderClosedPromiseInitialize(reader);
          } else if (stream._state === "closed") {
            defaultReaderClosedPromiseInitializeAsResolved(reader);
          } else {
            defaultReaderClosedPromiseInitializeAsRejected(reader, stream._storedError);
          }
        }
        function ReadableStreamReaderGenericCancel(reader, reason) {
          const stream = reader._ownerReadableStream;
          return ReadableStreamCancel(stream, reason);
        }
        function ReadableStreamReaderGenericRelease(reader) {
          if (reader._ownerReadableStream._state === "readable") {
            defaultReaderClosedPromiseReject(reader, new TypeError(`Reader was released and can no longer be used to monitor the stream's closedness`));
          } else {
            defaultReaderClosedPromiseResetToRejected(reader, new TypeError(`Reader was released and can no longer be used to monitor the stream's closedness`));
          }
          reader._ownerReadableStream._reader = void 0;
          reader._ownerReadableStream = void 0;
        }
        function readerLockException(name) {
          return new TypeError("Cannot " + name + " a stream using a released reader");
        }
        function defaultReaderClosedPromiseInitialize(reader) {
          reader._closedPromise = newPromise((resolve2, reject) => {
            reader._closedPromise_resolve = resolve2;
            reader._closedPromise_reject = reject;
          });
        }
        function defaultReaderClosedPromiseInitializeAsRejected(reader, reason) {
          defaultReaderClosedPromiseInitialize(reader);
          defaultReaderClosedPromiseReject(reader, reason);
        }
        function defaultReaderClosedPromiseInitializeAsResolved(reader) {
          defaultReaderClosedPromiseInitialize(reader);
          defaultReaderClosedPromiseResolve(reader);
        }
        function defaultReaderClosedPromiseReject(reader, reason) {
          if (reader._closedPromise_reject === void 0) {
            return;
          }
          setPromiseIsHandledToTrue(reader._closedPromise);
          reader._closedPromise_reject(reason);
          reader._closedPromise_resolve = void 0;
          reader._closedPromise_reject = void 0;
        }
        function defaultReaderClosedPromiseResetToRejected(reader, reason) {
          defaultReaderClosedPromiseInitializeAsRejected(reader, reason);
        }
        function defaultReaderClosedPromiseResolve(reader) {
          if (reader._closedPromise_resolve === void 0) {
            return;
          }
          reader._closedPromise_resolve(void 0);
          reader._closedPromise_resolve = void 0;
          reader._closedPromise_reject = void 0;
        }
        const AbortSteps = SymbolPolyfill("[[AbortSteps]]");
        const ErrorSteps = SymbolPolyfill("[[ErrorSteps]]");
        const CancelSteps = SymbolPolyfill("[[CancelSteps]]");
        const PullSteps = SymbolPolyfill("[[PullSteps]]");
        const NumberIsFinite = Number.isFinite || function(x) {
          return typeof x === "number" && isFinite(x);
        };
        const MathTrunc = Math.trunc || function(v) {
          return v < 0 ? Math.ceil(v) : Math.floor(v);
        };
        function isDictionary(x) {
          return typeof x === "object" || typeof x === "function";
        }
        function assertDictionary(obj, context) {
          if (obj !== void 0 && !isDictionary(obj)) {
            throw new TypeError(`${context} is not an object.`);
          }
        }
        function assertFunction(x, context) {
          if (typeof x !== "function") {
            throw new TypeError(`${context} is not a function.`);
          }
        }
        function isObject(x) {
          return typeof x === "object" && x !== null || typeof x === "function";
        }
        function assertObject(x, context) {
          if (!isObject(x)) {
            throw new TypeError(`${context} is not an object.`);
          }
        }
        function assertRequiredArgument(x, position, context) {
          if (x === void 0) {
            throw new TypeError(`Parameter ${position} is required in '${context}'.`);
          }
        }
        function assertRequiredField(x, field, context) {
          if (x === void 0) {
            throw new TypeError(`${field} is required in '${context}'.`);
          }
        }
        function convertUnrestrictedDouble(value) {
          return Number(value);
        }
        function censorNegativeZero(x) {
          return x === 0 ? 0 : x;
        }
        function integerPart(x) {
          return censorNegativeZero(MathTrunc(x));
        }
        function convertUnsignedLongLongWithEnforceRange(value, context) {
          const lowerBound = 0;
          const upperBound = Number.MAX_SAFE_INTEGER;
          let x = Number(value);
          x = censorNegativeZero(x);
          if (!NumberIsFinite(x)) {
            throw new TypeError(`${context} is not a finite number`);
          }
          x = integerPart(x);
          if (x < lowerBound || x > upperBound) {
            throw new TypeError(`${context} is outside the accepted range of ${lowerBound} to ${upperBound}, inclusive`);
          }
          if (!NumberIsFinite(x) || x === 0) {
            return 0;
          }
          return x;
        }
        function assertReadableStream(x, context) {
          if (!IsReadableStream(x)) {
            throw new TypeError(`${context} is not a ReadableStream.`);
          }
        }
        function AcquireReadableStreamDefaultReader(stream) {
          return new ReadableStreamDefaultReader(stream);
        }
        function ReadableStreamAddReadRequest(stream, readRequest) {
          stream._reader._readRequests.push(readRequest);
        }
        function ReadableStreamFulfillReadRequest(stream, chunk, done) {
          const reader = stream._reader;
          const readRequest = reader._readRequests.shift();
          if (done) {
            readRequest._closeSteps();
          } else {
            readRequest._chunkSteps(chunk);
          }
        }
        function ReadableStreamGetNumReadRequests(stream) {
          return stream._reader._readRequests.length;
        }
        function ReadableStreamHasDefaultReader(stream) {
          const reader = stream._reader;
          if (reader === void 0) {
            return false;
          }
          if (!IsReadableStreamDefaultReader(reader)) {
            return false;
          }
          return true;
        }
        class ReadableStreamDefaultReader {
          constructor(stream) {
            assertRequiredArgument(stream, 1, "ReadableStreamDefaultReader");
            assertReadableStream(stream, "First parameter");
            if (IsReadableStreamLocked(stream)) {
              throw new TypeError("This stream has already been locked for exclusive reading by another reader");
            }
            ReadableStreamReaderGenericInitialize(this, stream);
            this._readRequests = new SimpleQueue();
          }
          get closed() {
            if (!IsReadableStreamDefaultReader(this)) {
              return promiseRejectedWith(defaultReaderBrandCheckException("closed"));
            }
            return this._closedPromise;
          }
          cancel(reason = void 0) {
            if (!IsReadableStreamDefaultReader(this)) {
              return promiseRejectedWith(defaultReaderBrandCheckException("cancel"));
            }
            if (this._ownerReadableStream === void 0) {
              return promiseRejectedWith(readerLockException("cancel"));
            }
            return ReadableStreamReaderGenericCancel(this, reason);
          }
          read() {
            if (!IsReadableStreamDefaultReader(this)) {
              return promiseRejectedWith(defaultReaderBrandCheckException("read"));
            }
            if (this._ownerReadableStream === void 0) {
              return promiseRejectedWith(readerLockException("read from"));
            }
            let resolvePromise;
            let rejectPromise;
            const promise = newPromise((resolve2, reject) => {
              resolvePromise = resolve2;
              rejectPromise = reject;
            });
            const readRequest = {
              _chunkSteps: (chunk) => resolvePromise({ value: chunk, done: false }),
              _closeSteps: () => resolvePromise({ value: void 0, done: true }),
              _errorSteps: (e) => rejectPromise(e)
            };
            ReadableStreamDefaultReaderRead(this, readRequest);
            return promise;
          }
          releaseLock() {
            if (!IsReadableStreamDefaultReader(this)) {
              throw defaultReaderBrandCheckException("releaseLock");
            }
            if (this._ownerReadableStream === void 0) {
              return;
            }
            if (this._readRequests.length > 0) {
              throw new TypeError("Tried to release a reader lock when that reader has pending read() calls un-settled");
            }
            ReadableStreamReaderGenericRelease(this);
          }
        }
        Object.defineProperties(ReadableStreamDefaultReader.prototype, {
          cancel: { enumerable: true },
          read: { enumerable: true },
          releaseLock: { enumerable: true },
          closed: { enumerable: true }
        });
        if (typeof SymbolPolyfill.toStringTag === "symbol") {
          Object.defineProperty(ReadableStreamDefaultReader.prototype, SymbolPolyfill.toStringTag, {
            value: "ReadableStreamDefaultReader",
            configurable: true
          });
        }
        function IsReadableStreamDefaultReader(x) {
          if (!typeIsObject(x)) {
            return false;
          }
          if (!Object.prototype.hasOwnProperty.call(x, "_readRequests")) {
            return false;
          }
          return x instanceof ReadableStreamDefaultReader;
        }
        function ReadableStreamDefaultReaderRead(reader, readRequest) {
          const stream = reader._ownerReadableStream;
          stream._disturbed = true;
          if (stream._state === "closed") {
            readRequest._closeSteps();
          } else if (stream._state === "errored") {
            readRequest._errorSteps(stream._storedError);
          } else {
            stream._readableStreamController[PullSteps](readRequest);
          }
        }
        function defaultReaderBrandCheckException(name) {
          return new TypeError(`ReadableStreamDefaultReader.prototype.${name} can only be used on a ReadableStreamDefaultReader`);
        }
        const AsyncIteratorPrototype = Object.getPrototypeOf(Object.getPrototypeOf(async function* () {
        }).prototype);
        class ReadableStreamAsyncIteratorImpl {
          constructor(reader, preventCancel) {
            this._ongoingPromise = void 0;
            this._isFinished = false;
            this._reader = reader;
            this._preventCancel = preventCancel;
          }
          next() {
            const nextSteps = () => this._nextSteps();
            this._ongoingPromise = this._ongoingPromise ? transformPromiseWith(this._ongoingPromise, nextSteps, nextSteps) : nextSteps();
            return this._ongoingPromise;
          }
          return(value) {
            const returnSteps = () => this._returnSteps(value);
            return this._ongoingPromise ? transformPromiseWith(this._ongoingPromise, returnSteps, returnSteps) : returnSteps();
          }
          _nextSteps() {
            if (this._isFinished) {
              return Promise.resolve({ value: void 0, done: true });
            }
            const reader = this._reader;
            if (reader._ownerReadableStream === void 0) {
              return promiseRejectedWith(readerLockException("iterate"));
            }
            let resolvePromise;
            let rejectPromise;
            const promise = newPromise((resolve2, reject) => {
              resolvePromise = resolve2;
              rejectPromise = reject;
            });
            const readRequest = {
              _chunkSteps: (chunk) => {
                this._ongoingPromise = void 0;
                queueMicrotask(() => resolvePromise({ value: chunk, done: false }));
              },
              _closeSteps: () => {
                this._ongoingPromise = void 0;
                this._isFinished = true;
                ReadableStreamReaderGenericRelease(reader);
                resolvePromise({ value: void 0, done: true });
              },
              _errorSteps: (reason) => {
                this._ongoingPromise = void 0;
                this._isFinished = true;
                ReadableStreamReaderGenericRelease(reader);
                rejectPromise(reason);
              }
            };
            ReadableStreamDefaultReaderRead(reader, readRequest);
            return promise;
          }
          _returnSteps(value) {
            if (this._isFinished) {
              return Promise.resolve({ value, done: true });
            }
            this._isFinished = true;
            const reader = this._reader;
            if (reader._ownerReadableStream === void 0) {
              return promiseRejectedWith(readerLockException("finish iterating"));
            }
            if (!this._preventCancel) {
              const result = ReadableStreamReaderGenericCancel(reader, value);
              ReadableStreamReaderGenericRelease(reader);
              return transformPromiseWith(result, () => ({ value, done: true }));
            }
            ReadableStreamReaderGenericRelease(reader);
            return promiseResolvedWith({ value, done: true });
          }
        }
        const ReadableStreamAsyncIteratorPrototype = {
          next() {
            if (!IsReadableStreamAsyncIterator(this)) {
              return promiseRejectedWith(streamAsyncIteratorBrandCheckException("next"));
            }
            return this._asyncIteratorImpl.next();
          },
          return(value) {
            if (!IsReadableStreamAsyncIterator(this)) {
              return promiseRejectedWith(streamAsyncIteratorBrandCheckException("return"));
            }
            return this._asyncIteratorImpl.return(value);
          }
        };
        if (AsyncIteratorPrototype !== void 0) {
          Object.setPrototypeOf(ReadableStreamAsyncIteratorPrototype, AsyncIteratorPrototype);
        }
        function AcquireReadableStreamAsyncIterator(stream, preventCancel) {
          const reader = AcquireReadableStreamDefaultReader(stream);
          const impl = new ReadableStreamAsyncIteratorImpl(reader, preventCancel);
          const iterator = Object.create(ReadableStreamAsyncIteratorPrototype);
          iterator._asyncIteratorImpl = impl;
          return iterator;
        }
        function IsReadableStreamAsyncIterator(x) {
          if (!typeIsObject(x)) {
            return false;
          }
          if (!Object.prototype.hasOwnProperty.call(x, "_asyncIteratorImpl")) {
            return false;
          }
          try {
            return x._asyncIteratorImpl instanceof ReadableStreamAsyncIteratorImpl;
          } catch (_a) {
            return false;
          }
        }
        function streamAsyncIteratorBrandCheckException(name) {
          return new TypeError(`ReadableStreamAsyncIterator.${name} can only be used on a ReadableSteamAsyncIterator`);
        }
        const NumberIsNaN = Number.isNaN || function(x) {
          return x !== x;
        };
        function CreateArrayFromList(elements) {
          return elements.slice();
        }
        function CopyDataBlockBytes(dest, destOffset, src2, srcOffset, n) {
          new Uint8Array(dest).set(new Uint8Array(src2, srcOffset, n), destOffset);
        }
        function TransferArrayBuffer(O) {
          return O;
        }
        function IsDetachedBuffer(O) {
          return false;
        }
        function ArrayBufferSlice(buffer, begin, end) {
          if (buffer.slice) {
            return buffer.slice(begin, end);
          }
          const length = end - begin;
          const slice = new ArrayBuffer(length);
          CopyDataBlockBytes(slice, 0, buffer, begin, length);
          return slice;
        }
        function IsNonNegativeNumber(v) {
          if (typeof v !== "number") {
            return false;
          }
          if (NumberIsNaN(v)) {
            return false;
          }
          if (v < 0) {
            return false;
          }
          return true;
        }
        function CloneAsUint8Array(O) {
          const buffer = ArrayBufferSlice(O.buffer, O.byteOffset, O.byteOffset + O.byteLength);
          return new Uint8Array(buffer);
        }
        function DequeueValue(container) {
          const pair = container._queue.shift();
          container._queueTotalSize -= pair.size;
          if (container._queueTotalSize < 0) {
            container._queueTotalSize = 0;
          }
          return pair.value;
        }
        function EnqueueValueWithSize(container, value, size) {
          if (!IsNonNegativeNumber(size) || size === Infinity) {
            throw new RangeError("Size must be a finite, non-NaN, non-negative number.");
          }
          container._queue.push({ value, size });
          container._queueTotalSize += size;
        }
        function PeekQueueValue(container) {
          const pair = container._queue.peek();
          return pair.value;
        }
        function ResetQueue(container) {
          container._queue = new SimpleQueue();
          container._queueTotalSize = 0;
        }
        class ReadableStreamBYOBRequest {
          constructor() {
            throw new TypeError("Illegal constructor");
          }
          get view() {
            if (!IsReadableStreamBYOBRequest(this)) {
              throw byobRequestBrandCheckException("view");
            }
            return this._view;
          }
          respond(bytesWritten) {
            if (!IsReadableStreamBYOBRequest(this)) {
              throw byobRequestBrandCheckException("respond");
            }
            assertRequiredArgument(bytesWritten, 1, "respond");
            bytesWritten = convertUnsignedLongLongWithEnforceRange(bytesWritten, "First parameter");
            if (this._associatedReadableByteStreamController === void 0) {
              throw new TypeError("This BYOB request has been invalidated");
            }
            if (IsDetachedBuffer(this._view.buffer))
              ;
            ReadableByteStreamControllerRespond(this._associatedReadableByteStreamController, bytesWritten);
          }
          respondWithNewView(view) {
            if (!IsReadableStreamBYOBRequest(this)) {
              throw byobRequestBrandCheckException("respondWithNewView");
            }
            assertRequiredArgument(view, 1, "respondWithNewView");
            if (!ArrayBuffer.isView(view)) {
              throw new TypeError("You can only respond with array buffer views");
            }
            if (this._associatedReadableByteStreamController === void 0) {
              throw new TypeError("This BYOB request has been invalidated");
            }
            if (IsDetachedBuffer(view.buffer))
              ;
            ReadableByteStreamControllerRespondWithNewView(this._associatedReadableByteStreamController, view);
          }
        }
        Object.defineProperties(ReadableStreamBYOBRequest.prototype, {
          respond: { enumerable: true },
          respondWithNewView: { enumerable: true },
          view: { enumerable: true }
        });
        if (typeof SymbolPolyfill.toStringTag === "symbol") {
          Object.defineProperty(ReadableStreamBYOBRequest.prototype, SymbolPolyfill.toStringTag, {
            value: "ReadableStreamBYOBRequest",
            configurable: true
          });
        }
        class ReadableByteStreamController {
          constructor() {
            throw new TypeError("Illegal constructor");
          }
          get byobRequest() {
            if (!IsReadableByteStreamController(this)) {
              throw byteStreamControllerBrandCheckException("byobRequest");
            }
            return ReadableByteStreamControllerGetBYOBRequest(this);
          }
          get desiredSize() {
            if (!IsReadableByteStreamController(this)) {
              throw byteStreamControllerBrandCheckException("desiredSize");
            }
            return ReadableByteStreamControllerGetDesiredSize(this);
          }
          close() {
            if (!IsReadableByteStreamController(this)) {
              throw byteStreamControllerBrandCheckException("close");
            }
            if (this._closeRequested) {
              throw new TypeError("The stream has already been closed; do not close it again!");
            }
            const state = this._controlledReadableByteStream._state;
            if (state !== "readable") {
              throw new TypeError(`The stream (in ${state} state) is not in the readable state and cannot be closed`);
            }
            ReadableByteStreamControllerClose(this);
          }
          enqueue(chunk) {
            if (!IsReadableByteStreamController(this)) {
              throw byteStreamControllerBrandCheckException("enqueue");
            }
            assertRequiredArgument(chunk, 1, "enqueue");
            if (!ArrayBuffer.isView(chunk)) {
              throw new TypeError("chunk must be an array buffer view");
            }
            if (chunk.byteLength === 0) {
              throw new TypeError("chunk must have non-zero byteLength");
            }
            if (chunk.buffer.byteLength === 0) {
              throw new TypeError(`chunk's buffer must have non-zero byteLength`);
            }
            if (this._closeRequested) {
              throw new TypeError("stream is closed or draining");
            }
            const state = this._controlledReadableByteStream._state;
            if (state !== "readable") {
              throw new TypeError(`The stream (in ${state} state) is not in the readable state and cannot be enqueued to`);
            }
            ReadableByteStreamControllerEnqueue(this, chunk);
          }
          error(e = void 0) {
            if (!IsReadableByteStreamController(this)) {
              throw byteStreamControllerBrandCheckException("error");
            }
            ReadableByteStreamControllerError(this, e);
          }
          [CancelSteps](reason) {
            ReadableByteStreamControllerClearPendingPullIntos(this);
            ResetQueue(this);
            const result = this._cancelAlgorithm(reason);
            ReadableByteStreamControllerClearAlgorithms(this);
            return result;
          }
          [PullSteps](readRequest) {
            const stream = this._controlledReadableByteStream;
            if (this._queueTotalSize > 0) {
              const entry = this._queue.shift();
              this._queueTotalSize -= entry.byteLength;
              ReadableByteStreamControllerHandleQueueDrain(this);
              const view = new Uint8Array(entry.buffer, entry.byteOffset, entry.byteLength);
              readRequest._chunkSteps(view);
              return;
            }
            const autoAllocateChunkSize = this._autoAllocateChunkSize;
            if (autoAllocateChunkSize !== void 0) {
              let buffer;
              try {
                buffer = new ArrayBuffer(autoAllocateChunkSize);
              } catch (bufferE) {
                readRequest._errorSteps(bufferE);
                return;
              }
              const pullIntoDescriptor = {
                buffer,
                bufferByteLength: autoAllocateChunkSize,
                byteOffset: 0,
                byteLength: autoAllocateChunkSize,
                bytesFilled: 0,
                elementSize: 1,
                viewConstructor: Uint8Array,
                readerType: "default"
              };
              this._pendingPullIntos.push(pullIntoDescriptor);
            }
            ReadableStreamAddReadRequest(stream, readRequest);
            ReadableByteStreamControllerCallPullIfNeeded(this);
          }
        }
        Object.defineProperties(ReadableByteStreamController.prototype, {
          close: { enumerable: true },
          enqueue: { enumerable: true },
          error: { enumerable: true },
          byobRequest: { enumerable: true },
          desiredSize: { enumerable: true }
        });
        if (typeof SymbolPolyfill.toStringTag === "symbol") {
          Object.defineProperty(ReadableByteStreamController.prototype, SymbolPolyfill.toStringTag, {
            value: "ReadableByteStreamController",
            configurable: true
          });
        }
        function IsReadableByteStreamController(x) {
          if (!typeIsObject(x)) {
            return false;
          }
          if (!Object.prototype.hasOwnProperty.call(x, "_controlledReadableByteStream")) {
            return false;
          }
          return x instanceof ReadableByteStreamController;
        }
        function IsReadableStreamBYOBRequest(x) {
          if (!typeIsObject(x)) {
            return false;
          }
          if (!Object.prototype.hasOwnProperty.call(x, "_associatedReadableByteStreamController")) {
            return false;
          }
          return x instanceof ReadableStreamBYOBRequest;
        }
        function ReadableByteStreamControllerCallPullIfNeeded(controller) {
          const shouldPull = ReadableByteStreamControllerShouldCallPull(controller);
          if (!shouldPull) {
            return;
          }
          if (controller._pulling) {
            controller._pullAgain = true;
            return;
          }
          controller._pulling = true;
          const pullPromise = controller._pullAlgorithm();
          uponPromise(pullPromise, () => {
            controller._pulling = false;
            if (controller._pullAgain) {
              controller._pullAgain = false;
              ReadableByteStreamControllerCallPullIfNeeded(controller);
            }
          }, (e) => {
            ReadableByteStreamControllerError(controller, e);
          });
        }
        function ReadableByteStreamControllerClearPendingPullIntos(controller) {
          ReadableByteStreamControllerInvalidateBYOBRequest(controller);
          controller._pendingPullIntos = new SimpleQueue();
        }
        function ReadableByteStreamControllerCommitPullIntoDescriptor(stream, pullIntoDescriptor) {
          let done = false;
          if (stream._state === "closed") {
            done = true;
          }
          const filledView = ReadableByteStreamControllerConvertPullIntoDescriptor(pullIntoDescriptor);
          if (pullIntoDescriptor.readerType === "default") {
            ReadableStreamFulfillReadRequest(stream, filledView, done);
          } else {
            ReadableStreamFulfillReadIntoRequest(stream, filledView, done);
          }
        }
        function ReadableByteStreamControllerConvertPullIntoDescriptor(pullIntoDescriptor) {
          const bytesFilled = pullIntoDescriptor.bytesFilled;
          const elementSize = pullIntoDescriptor.elementSize;
          return new pullIntoDescriptor.viewConstructor(pullIntoDescriptor.buffer, pullIntoDescriptor.byteOffset, bytesFilled / elementSize);
        }
        function ReadableByteStreamControllerEnqueueChunkToQueue(controller, buffer, byteOffset, byteLength) {
          controller._queue.push({ buffer, byteOffset, byteLength });
          controller._queueTotalSize += byteLength;
        }
        function ReadableByteStreamControllerFillPullIntoDescriptorFromQueue(controller, pullIntoDescriptor) {
          const elementSize = pullIntoDescriptor.elementSize;
          const currentAlignedBytes = pullIntoDescriptor.bytesFilled - pullIntoDescriptor.bytesFilled % elementSize;
          const maxBytesToCopy = Math.min(controller._queueTotalSize, pullIntoDescriptor.byteLength - pullIntoDescriptor.bytesFilled);
          const maxBytesFilled = pullIntoDescriptor.bytesFilled + maxBytesToCopy;
          const maxAlignedBytes = maxBytesFilled - maxBytesFilled % elementSize;
          let totalBytesToCopyRemaining = maxBytesToCopy;
          let ready = false;
          if (maxAlignedBytes > currentAlignedBytes) {
            totalBytesToCopyRemaining = maxAlignedBytes - pullIntoDescriptor.bytesFilled;
            ready = true;
          }
          const queue = controller._queue;
          while (totalBytesToCopyRemaining > 0) {
            const headOfQueue = queue.peek();
            const bytesToCopy = Math.min(totalBytesToCopyRemaining, headOfQueue.byteLength);
            const destStart = pullIntoDescriptor.byteOffset + pullIntoDescriptor.bytesFilled;
            CopyDataBlockBytes(pullIntoDescriptor.buffer, destStart, headOfQueue.buffer, headOfQueue.byteOffset, bytesToCopy);
            if (headOfQueue.byteLength === bytesToCopy) {
              queue.shift();
            } else {
              headOfQueue.byteOffset += bytesToCopy;
              headOfQueue.byteLength -= bytesToCopy;
            }
            controller._queueTotalSize -= bytesToCopy;
            ReadableByteStreamControllerFillHeadPullIntoDescriptor(controller, bytesToCopy, pullIntoDescriptor);
            totalBytesToCopyRemaining -= bytesToCopy;
          }
          return ready;
        }
        function ReadableByteStreamControllerFillHeadPullIntoDescriptor(controller, size, pullIntoDescriptor) {
          pullIntoDescriptor.bytesFilled += size;
        }
        function ReadableByteStreamControllerHandleQueueDrain(controller) {
          if (controller._queueTotalSize === 0 && controller._closeRequested) {
            ReadableByteStreamControllerClearAlgorithms(controller);
            ReadableStreamClose(controller._controlledReadableByteStream);
          } else {
            ReadableByteStreamControllerCallPullIfNeeded(controller);
          }
        }
        function ReadableByteStreamControllerInvalidateBYOBRequest(controller) {
          if (controller._byobRequest === null) {
            return;
          }
          controller._byobRequest._associatedReadableByteStreamController = void 0;
          controller._byobRequest._view = null;
          controller._byobRequest = null;
        }
        function ReadableByteStreamControllerProcessPullIntoDescriptorsUsingQueue(controller) {
          while (controller._pendingPullIntos.length > 0) {
            if (controller._queueTotalSize === 0) {
              return;
            }
            const pullIntoDescriptor = controller._pendingPullIntos.peek();
            if (ReadableByteStreamControllerFillPullIntoDescriptorFromQueue(controller, pullIntoDescriptor)) {
              ReadableByteStreamControllerShiftPendingPullInto(controller);
              ReadableByteStreamControllerCommitPullIntoDescriptor(controller._controlledReadableByteStream, pullIntoDescriptor);
            }
          }
        }
        function ReadableByteStreamControllerPullInto(controller, view, readIntoRequest) {
          const stream = controller._controlledReadableByteStream;
          let elementSize = 1;
          if (view.constructor !== DataView) {
            elementSize = view.constructor.BYTES_PER_ELEMENT;
          }
          const ctor = view.constructor;
          const buffer = TransferArrayBuffer(view.buffer);
          const pullIntoDescriptor = {
            buffer,
            bufferByteLength: buffer.byteLength,
            byteOffset: view.byteOffset,
            byteLength: view.byteLength,
            bytesFilled: 0,
            elementSize,
            viewConstructor: ctor,
            readerType: "byob"
          };
          if (controller._pendingPullIntos.length > 0) {
            controller._pendingPullIntos.push(pullIntoDescriptor);
            ReadableStreamAddReadIntoRequest(stream, readIntoRequest);
            return;
          }
          if (stream._state === "closed") {
            const emptyView = new ctor(pullIntoDescriptor.buffer, pullIntoDescriptor.byteOffset, 0);
            readIntoRequest._closeSteps(emptyView);
            return;
          }
          if (controller._queueTotalSize > 0) {
            if (ReadableByteStreamControllerFillPullIntoDescriptorFromQueue(controller, pullIntoDescriptor)) {
              const filledView = ReadableByteStreamControllerConvertPullIntoDescriptor(pullIntoDescriptor);
              ReadableByteStreamControllerHandleQueueDrain(controller);
              readIntoRequest._chunkSteps(filledView);
              return;
            }
            if (controller._closeRequested) {
              const e = new TypeError("Insufficient bytes to fill elements in the given buffer");
              ReadableByteStreamControllerError(controller, e);
              readIntoRequest._errorSteps(e);
              return;
            }
          }
          controller._pendingPullIntos.push(pullIntoDescriptor);
          ReadableStreamAddReadIntoRequest(stream, readIntoRequest);
          ReadableByteStreamControllerCallPullIfNeeded(controller);
        }
        function ReadableByteStreamControllerRespondInClosedState(controller, firstDescriptor) {
          const stream = controller._controlledReadableByteStream;
          if (ReadableStreamHasBYOBReader(stream)) {
            while (ReadableStreamGetNumReadIntoRequests(stream) > 0) {
              const pullIntoDescriptor = ReadableByteStreamControllerShiftPendingPullInto(controller);
              ReadableByteStreamControllerCommitPullIntoDescriptor(stream, pullIntoDescriptor);
            }
          }
        }
        function ReadableByteStreamControllerRespondInReadableState(controller, bytesWritten, pullIntoDescriptor) {
          ReadableByteStreamControllerFillHeadPullIntoDescriptor(controller, bytesWritten, pullIntoDescriptor);
          if (pullIntoDescriptor.bytesFilled < pullIntoDescriptor.elementSize) {
            return;
          }
          ReadableByteStreamControllerShiftPendingPullInto(controller);
          const remainderSize = pullIntoDescriptor.bytesFilled % pullIntoDescriptor.elementSize;
          if (remainderSize > 0) {
            const end = pullIntoDescriptor.byteOffset + pullIntoDescriptor.bytesFilled;
            const remainder = ArrayBufferSlice(pullIntoDescriptor.buffer, end - remainderSize, end);
            ReadableByteStreamControllerEnqueueChunkToQueue(controller, remainder, 0, remainder.byteLength);
          }
          pullIntoDescriptor.bytesFilled -= remainderSize;
          ReadableByteStreamControllerCommitPullIntoDescriptor(controller._controlledReadableByteStream, pullIntoDescriptor);
          ReadableByteStreamControllerProcessPullIntoDescriptorsUsingQueue(controller);
        }
        function ReadableByteStreamControllerRespondInternal(controller, bytesWritten) {
          const firstDescriptor = controller._pendingPullIntos.peek();
          ReadableByteStreamControllerInvalidateBYOBRequest(controller);
          const state = controller._controlledReadableByteStream._state;
          if (state === "closed") {
            ReadableByteStreamControllerRespondInClosedState(controller);
          } else {
            ReadableByteStreamControllerRespondInReadableState(controller, bytesWritten, firstDescriptor);
          }
          ReadableByteStreamControllerCallPullIfNeeded(controller);
        }
        function ReadableByteStreamControllerShiftPendingPullInto(controller) {
          const descriptor = controller._pendingPullIntos.shift();
          return descriptor;
        }
        function ReadableByteStreamControllerShouldCallPull(controller) {
          const stream = controller._controlledReadableByteStream;
          if (stream._state !== "readable") {
            return false;
          }
          if (controller._closeRequested) {
            return false;
          }
          if (!controller._started) {
            return false;
          }
          if (ReadableStreamHasDefaultReader(stream) && ReadableStreamGetNumReadRequests(stream) > 0) {
            return true;
          }
          if (ReadableStreamHasBYOBReader(stream) && ReadableStreamGetNumReadIntoRequests(stream) > 0) {
            return true;
          }
          const desiredSize = ReadableByteStreamControllerGetDesiredSize(controller);
          if (desiredSize > 0) {
            return true;
          }
          return false;
        }
        function ReadableByteStreamControllerClearAlgorithms(controller) {
          controller._pullAlgorithm = void 0;
          controller._cancelAlgorithm = void 0;
        }
        function ReadableByteStreamControllerClose(controller) {
          const stream = controller._controlledReadableByteStream;
          if (controller._closeRequested || stream._state !== "readable") {
            return;
          }
          if (controller._queueTotalSize > 0) {
            controller._closeRequested = true;
            return;
          }
          if (controller._pendingPullIntos.length > 0) {
            const firstPendingPullInto = controller._pendingPullIntos.peek();
            if (firstPendingPullInto.bytesFilled > 0) {
              const e = new TypeError("Insufficient bytes to fill elements in the given buffer");
              ReadableByteStreamControllerError(controller, e);
              throw e;
            }
          }
          ReadableByteStreamControllerClearAlgorithms(controller);
          ReadableStreamClose(stream);
        }
        function ReadableByteStreamControllerEnqueue(controller, chunk) {
          const stream = controller._controlledReadableByteStream;
          if (controller._closeRequested || stream._state !== "readable") {
            return;
          }
          const buffer = chunk.buffer;
          const byteOffset = chunk.byteOffset;
          const byteLength = chunk.byteLength;
          const transferredBuffer = TransferArrayBuffer(buffer);
          if (controller._pendingPullIntos.length > 0) {
            const firstPendingPullInto = controller._pendingPullIntos.peek();
            if (IsDetachedBuffer(firstPendingPullInto.buffer))
              ;
            firstPendingPullInto.buffer = TransferArrayBuffer(firstPendingPullInto.buffer);
          }
          ReadableByteStreamControllerInvalidateBYOBRequest(controller);
          if (ReadableStreamHasDefaultReader(stream)) {
            if (ReadableStreamGetNumReadRequests(stream) === 0) {
              ReadableByteStreamControllerEnqueueChunkToQueue(controller, transferredBuffer, byteOffset, byteLength);
            } else {
              const transferredView = new Uint8Array(transferredBuffer, byteOffset, byteLength);
              ReadableStreamFulfillReadRequest(stream, transferredView, false);
            }
          } else if (ReadableStreamHasBYOBReader(stream)) {
            ReadableByteStreamControllerEnqueueChunkToQueue(controller, transferredBuffer, byteOffset, byteLength);
            ReadableByteStreamControllerProcessPullIntoDescriptorsUsingQueue(controller);
          } else {
            ReadableByteStreamControllerEnqueueChunkToQueue(controller, transferredBuffer, byteOffset, byteLength);
          }
          ReadableByteStreamControllerCallPullIfNeeded(controller);
        }
        function ReadableByteStreamControllerError(controller, e) {
          const stream = controller._controlledReadableByteStream;
          if (stream._state !== "readable") {
            return;
          }
          ReadableByteStreamControllerClearPendingPullIntos(controller);
          ResetQueue(controller);
          ReadableByteStreamControllerClearAlgorithms(controller);
          ReadableStreamError(stream, e);
        }
        function ReadableByteStreamControllerGetBYOBRequest(controller) {
          if (controller._byobRequest === null && controller._pendingPullIntos.length > 0) {
            const firstDescriptor = controller._pendingPullIntos.peek();
            const view = new Uint8Array(firstDescriptor.buffer, firstDescriptor.byteOffset + firstDescriptor.bytesFilled, firstDescriptor.byteLength - firstDescriptor.bytesFilled);
            const byobRequest = Object.create(ReadableStreamBYOBRequest.prototype);
            SetUpReadableStreamBYOBRequest(byobRequest, controller, view);
            controller._byobRequest = byobRequest;
          }
          return controller._byobRequest;
        }
        function ReadableByteStreamControllerGetDesiredSize(controller) {
          const state = controller._controlledReadableByteStream._state;
          if (state === "errored") {
            return null;
          }
          if (state === "closed") {
            return 0;
          }
          return controller._strategyHWM - controller._queueTotalSize;
        }
        function ReadableByteStreamControllerRespond(controller, bytesWritten) {
          const firstDescriptor = controller._pendingPullIntos.peek();
          const state = controller._controlledReadableByteStream._state;
          if (state === "closed") {
            if (bytesWritten !== 0) {
              throw new TypeError("bytesWritten must be 0 when calling respond() on a closed stream");
            }
          } else {
            if (bytesWritten === 0) {
              throw new TypeError("bytesWritten must be greater than 0 when calling respond() on a readable stream");
            }
            if (firstDescriptor.bytesFilled + bytesWritten > firstDescriptor.byteLength) {
              throw new RangeError("bytesWritten out of range");
            }
          }
          firstDescriptor.buffer = TransferArrayBuffer(firstDescriptor.buffer);
          ReadableByteStreamControllerRespondInternal(controller, bytesWritten);
        }
        function ReadableByteStreamControllerRespondWithNewView(controller, view) {
          const firstDescriptor = controller._pendingPullIntos.peek();
          const state = controller._controlledReadableByteStream._state;
          if (state === "closed") {
            if (view.byteLength !== 0) {
              throw new TypeError("The view's length must be 0 when calling respondWithNewView() on a closed stream");
            }
          } else {
            if (view.byteLength === 0) {
              throw new TypeError("The view's length must be greater than 0 when calling respondWithNewView() on a readable stream");
            }
          }
          if (firstDescriptor.byteOffset + firstDescriptor.bytesFilled !== view.byteOffset) {
            throw new RangeError("The region specified by view does not match byobRequest");
          }
          if (firstDescriptor.bufferByteLength !== view.buffer.byteLength) {
            throw new RangeError("The buffer of view has different capacity than byobRequest");
          }
          if (firstDescriptor.bytesFilled + view.byteLength > firstDescriptor.byteLength) {
            throw new RangeError("The region specified by view is larger than byobRequest");
          }
          firstDescriptor.buffer = TransferArrayBuffer(view.buffer);
          ReadableByteStreamControllerRespondInternal(controller, view.byteLength);
        }
        function SetUpReadableByteStreamController(stream, controller, startAlgorithm, pullAlgorithm, cancelAlgorithm, highWaterMark, autoAllocateChunkSize) {
          controller._controlledReadableByteStream = stream;
          controller._pullAgain = false;
          controller._pulling = false;
          controller._byobRequest = null;
          controller._queue = controller._queueTotalSize = void 0;
          ResetQueue(controller);
          controller._closeRequested = false;
          controller._started = false;
          controller._strategyHWM = highWaterMark;
          controller._pullAlgorithm = pullAlgorithm;
          controller._cancelAlgorithm = cancelAlgorithm;
          controller._autoAllocateChunkSize = autoAllocateChunkSize;
          controller._pendingPullIntos = new SimpleQueue();
          stream._readableStreamController = controller;
          const startResult = startAlgorithm();
          uponPromise(promiseResolvedWith(startResult), () => {
            controller._started = true;
            ReadableByteStreamControllerCallPullIfNeeded(controller);
          }, (r) => {
            ReadableByteStreamControllerError(controller, r);
          });
        }
        function SetUpReadableByteStreamControllerFromUnderlyingSource(stream, underlyingByteSource, highWaterMark) {
          const controller = Object.create(ReadableByteStreamController.prototype);
          let startAlgorithm = () => void 0;
          let pullAlgorithm = () => promiseResolvedWith(void 0);
          let cancelAlgorithm = () => promiseResolvedWith(void 0);
          if (underlyingByteSource.start !== void 0) {
            startAlgorithm = () => underlyingByteSource.start(controller);
          }
          if (underlyingByteSource.pull !== void 0) {
            pullAlgorithm = () => underlyingByteSource.pull(controller);
          }
          if (underlyingByteSource.cancel !== void 0) {
            cancelAlgorithm = (reason) => underlyingByteSource.cancel(reason);
          }
          const autoAllocateChunkSize = underlyingByteSource.autoAllocateChunkSize;
          if (autoAllocateChunkSize === 0) {
            throw new TypeError("autoAllocateChunkSize must be greater than 0");
          }
          SetUpReadableByteStreamController(stream, controller, startAlgorithm, pullAlgorithm, cancelAlgorithm, highWaterMark, autoAllocateChunkSize);
        }
        function SetUpReadableStreamBYOBRequest(request, controller, view) {
          request._associatedReadableByteStreamController = controller;
          request._view = view;
        }
        function byobRequestBrandCheckException(name) {
          return new TypeError(`ReadableStreamBYOBRequest.prototype.${name} can only be used on a ReadableStreamBYOBRequest`);
        }
        function byteStreamControllerBrandCheckException(name) {
          return new TypeError(`ReadableByteStreamController.prototype.${name} can only be used on a ReadableByteStreamController`);
        }
        function AcquireReadableStreamBYOBReader(stream) {
          return new ReadableStreamBYOBReader(stream);
        }
        function ReadableStreamAddReadIntoRequest(stream, readIntoRequest) {
          stream._reader._readIntoRequests.push(readIntoRequest);
        }
        function ReadableStreamFulfillReadIntoRequest(stream, chunk, done) {
          const reader = stream._reader;
          const readIntoRequest = reader._readIntoRequests.shift();
          if (done) {
            readIntoRequest._closeSteps(chunk);
          } else {
            readIntoRequest._chunkSteps(chunk);
          }
        }
        function ReadableStreamGetNumReadIntoRequests(stream) {
          return stream._reader._readIntoRequests.length;
        }
        function ReadableStreamHasBYOBReader(stream) {
          const reader = stream._reader;
          if (reader === void 0) {
            return false;
          }
          if (!IsReadableStreamBYOBReader(reader)) {
            return false;
          }
          return true;
        }
        class ReadableStreamBYOBReader {
          constructor(stream) {
            assertRequiredArgument(stream, 1, "ReadableStreamBYOBReader");
            assertReadableStream(stream, "First parameter");
            if (IsReadableStreamLocked(stream)) {
              throw new TypeError("This stream has already been locked for exclusive reading by another reader");
            }
            if (!IsReadableByteStreamController(stream._readableStreamController)) {
              throw new TypeError("Cannot construct a ReadableStreamBYOBReader for a stream not constructed with a byte source");
            }
            ReadableStreamReaderGenericInitialize(this, stream);
            this._readIntoRequests = new SimpleQueue();
          }
          get closed() {
            if (!IsReadableStreamBYOBReader(this)) {
              return promiseRejectedWith(byobReaderBrandCheckException("closed"));
            }
            return this._closedPromise;
          }
          cancel(reason = void 0) {
            if (!IsReadableStreamBYOBReader(this)) {
              return promiseRejectedWith(byobReaderBrandCheckException("cancel"));
            }
            if (this._ownerReadableStream === void 0) {
              return promiseRejectedWith(readerLockException("cancel"));
            }
            return ReadableStreamReaderGenericCancel(this, reason);
          }
          read(view) {
            if (!IsReadableStreamBYOBReader(this)) {
              return promiseRejectedWith(byobReaderBrandCheckException("read"));
            }
            if (!ArrayBuffer.isView(view)) {
              return promiseRejectedWith(new TypeError("view must be an array buffer view"));
            }
            if (view.byteLength === 0) {
              return promiseRejectedWith(new TypeError("view must have non-zero byteLength"));
            }
            if (view.buffer.byteLength === 0) {
              return promiseRejectedWith(new TypeError(`view's buffer must have non-zero byteLength`));
            }
            if (IsDetachedBuffer(view.buffer))
              ;
            if (this._ownerReadableStream === void 0) {
              return promiseRejectedWith(readerLockException("read from"));
            }
            let resolvePromise;
            let rejectPromise;
            const promise = newPromise((resolve2, reject) => {
              resolvePromise = resolve2;
              rejectPromise = reject;
            });
            const readIntoRequest = {
              _chunkSteps: (chunk) => resolvePromise({ value: chunk, done: false }),
              _closeSteps: (chunk) => resolvePromise({ value: chunk, done: true }),
              _errorSteps: (e) => rejectPromise(e)
            };
            ReadableStreamBYOBReaderRead(this, view, readIntoRequest);
            return promise;
          }
          releaseLock() {
            if (!IsReadableStreamBYOBReader(this)) {
              throw byobReaderBrandCheckException("releaseLock");
            }
            if (this._ownerReadableStream === void 0) {
              return;
            }
            if (this._readIntoRequests.length > 0) {
              throw new TypeError("Tried to release a reader lock when that reader has pending read() calls un-settled");
            }
            ReadableStreamReaderGenericRelease(this);
          }
        }
        Object.defineProperties(ReadableStreamBYOBReader.prototype, {
          cancel: { enumerable: true },
          read: { enumerable: true },
          releaseLock: { enumerable: true },
          closed: { enumerable: true }
        });
        if (typeof SymbolPolyfill.toStringTag === "symbol") {
          Object.defineProperty(ReadableStreamBYOBReader.prototype, SymbolPolyfill.toStringTag, {
            value: "ReadableStreamBYOBReader",
            configurable: true
          });
        }
        function IsReadableStreamBYOBReader(x) {
          if (!typeIsObject(x)) {
            return false;
          }
          if (!Object.prototype.hasOwnProperty.call(x, "_readIntoRequests")) {
            return false;
          }
          return x instanceof ReadableStreamBYOBReader;
        }
        function ReadableStreamBYOBReaderRead(reader, view, readIntoRequest) {
          const stream = reader._ownerReadableStream;
          stream._disturbed = true;
          if (stream._state === "errored") {
            readIntoRequest._errorSteps(stream._storedError);
          } else {
            ReadableByteStreamControllerPullInto(stream._readableStreamController, view, readIntoRequest);
          }
        }
        function byobReaderBrandCheckException(name) {
          return new TypeError(`ReadableStreamBYOBReader.prototype.${name} can only be used on a ReadableStreamBYOBReader`);
        }
        function ExtractHighWaterMark(strategy, defaultHWM) {
          const { highWaterMark } = strategy;
          if (highWaterMark === void 0) {
            return defaultHWM;
          }
          if (NumberIsNaN(highWaterMark) || highWaterMark < 0) {
            throw new RangeError("Invalid highWaterMark");
          }
          return highWaterMark;
        }
        function ExtractSizeAlgorithm(strategy) {
          const { size } = strategy;
          if (!size) {
            return () => 1;
          }
          return size;
        }
        function convertQueuingStrategy(init2, context) {
          assertDictionary(init2, context);
          const highWaterMark = init2 === null || init2 === void 0 ? void 0 : init2.highWaterMark;
          const size = init2 === null || init2 === void 0 ? void 0 : init2.size;
          return {
            highWaterMark: highWaterMark === void 0 ? void 0 : convertUnrestrictedDouble(highWaterMark),
            size: size === void 0 ? void 0 : convertQueuingStrategySize(size, `${context} has member 'size' that`)
          };
        }
        function convertQueuingStrategySize(fn, context) {
          assertFunction(fn, context);
          return (chunk) => convertUnrestrictedDouble(fn(chunk));
        }
        function convertUnderlyingSink(original, context) {
          assertDictionary(original, context);
          const abort = original === null || original === void 0 ? void 0 : original.abort;
          const close = original === null || original === void 0 ? void 0 : original.close;
          const start = original === null || original === void 0 ? void 0 : original.start;
          const type = original === null || original === void 0 ? void 0 : original.type;
          const write = original === null || original === void 0 ? void 0 : original.write;
          return {
            abort: abort === void 0 ? void 0 : convertUnderlyingSinkAbortCallback(abort, original, `${context} has member 'abort' that`),
            close: close === void 0 ? void 0 : convertUnderlyingSinkCloseCallback(close, original, `${context} has member 'close' that`),
            start: start === void 0 ? void 0 : convertUnderlyingSinkStartCallback(start, original, `${context} has member 'start' that`),
            write: write === void 0 ? void 0 : convertUnderlyingSinkWriteCallback(write, original, `${context} has member 'write' that`),
            type
          };
        }
        function convertUnderlyingSinkAbortCallback(fn, original, context) {
          assertFunction(fn, context);
          return (reason) => promiseCall(fn, original, [reason]);
        }
        function convertUnderlyingSinkCloseCallback(fn, original, context) {
          assertFunction(fn, context);
          return () => promiseCall(fn, original, []);
        }
        function convertUnderlyingSinkStartCallback(fn, original, context) {
          assertFunction(fn, context);
          return (controller) => reflectCall(fn, original, [controller]);
        }
        function convertUnderlyingSinkWriteCallback(fn, original, context) {
          assertFunction(fn, context);
          return (chunk, controller) => promiseCall(fn, original, [chunk, controller]);
        }
        function assertWritableStream(x, context) {
          if (!IsWritableStream(x)) {
            throw new TypeError(`${context} is not a WritableStream.`);
          }
        }
        function isAbortSignal2(value) {
          if (typeof value !== "object" || value === null) {
            return false;
          }
          try {
            return typeof value.aborted === "boolean";
          } catch (_a) {
            return false;
          }
        }
        const supportsAbortController = typeof AbortController === "function";
        function createAbortController() {
          if (supportsAbortController) {
            return new AbortController();
          }
          return void 0;
        }
        class WritableStream {
          constructor(rawUnderlyingSink = {}, rawStrategy = {}) {
            if (rawUnderlyingSink === void 0) {
              rawUnderlyingSink = null;
            } else {
              assertObject(rawUnderlyingSink, "First parameter");
            }
            const strategy = convertQueuingStrategy(rawStrategy, "Second parameter");
            const underlyingSink = convertUnderlyingSink(rawUnderlyingSink, "First parameter");
            InitializeWritableStream(this);
            const type = underlyingSink.type;
            if (type !== void 0) {
              throw new RangeError("Invalid type is specified");
            }
            const sizeAlgorithm = ExtractSizeAlgorithm(strategy);
            const highWaterMark = ExtractHighWaterMark(strategy, 1);
            SetUpWritableStreamDefaultControllerFromUnderlyingSink(this, underlyingSink, highWaterMark, sizeAlgorithm);
          }
          get locked() {
            if (!IsWritableStream(this)) {
              throw streamBrandCheckException$2("locked");
            }
            return IsWritableStreamLocked(this);
          }
          abort(reason = void 0) {
            if (!IsWritableStream(this)) {
              return promiseRejectedWith(streamBrandCheckException$2("abort"));
            }
            if (IsWritableStreamLocked(this)) {
              return promiseRejectedWith(new TypeError("Cannot abort a stream that already has a writer"));
            }
            return WritableStreamAbort(this, reason);
          }
          close() {
            if (!IsWritableStream(this)) {
              return promiseRejectedWith(streamBrandCheckException$2("close"));
            }
            if (IsWritableStreamLocked(this)) {
              return promiseRejectedWith(new TypeError("Cannot close a stream that already has a writer"));
            }
            if (WritableStreamCloseQueuedOrInFlight(this)) {
              return promiseRejectedWith(new TypeError("Cannot close an already-closing stream"));
            }
            return WritableStreamClose(this);
          }
          getWriter() {
            if (!IsWritableStream(this)) {
              throw streamBrandCheckException$2("getWriter");
            }
            return AcquireWritableStreamDefaultWriter(this);
          }
        }
        Object.defineProperties(WritableStream.prototype, {
          abort: { enumerable: true },
          close: { enumerable: true },
          getWriter: { enumerable: true },
          locked: { enumerable: true }
        });
        if (typeof SymbolPolyfill.toStringTag === "symbol") {
          Object.defineProperty(WritableStream.prototype, SymbolPolyfill.toStringTag, {
            value: "WritableStream",
            configurable: true
          });
        }
        function AcquireWritableStreamDefaultWriter(stream) {
          return new WritableStreamDefaultWriter(stream);
        }
        function CreateWritableStream(startAlgorithm, writeAlgorithm, closeAlgorithm, abortAlgorithm, highWaterMark = 1, sizeAlgorithm = () => 1) {
          const stream = Object.create(WritableStream.prototype);
          InitializeWritableStream(stream);
          const controller = Object.create(WritableStreamDefaultController.prototype);
          SetUpWritableStreamDefaultController(stream, controller, startAlgorithm, writeAlgorithm, closeAlgorithm, abortAlgorithm, highWaterMark, sizeAlgorithm);
          return stream;
        }
        function InitializeWritableStream(stream) {
          stream._state = "writable";
          stream._storedError = void 0;
          stream._writer = void 0;
          stream._writableStreamController = void 0;
          stream._writeRequests = new SimpleQueue();
          stream._inFlightWriteRequest = void 0;
          stream._closeRequest = void 0;
          stream._inFlightCloseRequest = void 0;
          stream._pendingAbortRequest = void 0;
          stream._backpressure = false;
        }
        function IsWritableStream(x) {
          if (!typeIsObject(x)) {
            return false;
          }
          if (!Object.prototype.hasOwnProperty.call(x, "_writableStreamController")) {
            return false;
          }
          return x instanceof WritableStream;
        }
        function IsWritableStreamLocked(stream) {
          if (stream._writer === void 0) {
            return false;
          }
          return true;
        }
        function WritableStreamAbort(stream, reason) {
          var _a;
          if (stream._state === "closed" || stream._state === "errored") {
            return promiseResolvedWith(void 0);
          }
          stream._writableStreamController._abortReason = reason;
          (_a = stream._writableStreamController._abortController) === null || _a === void 0 ? void 0 : _a.abort();
          const state = stream._state;
          if (state === "closed" || state === "errored") {
            return promiseResolvedWith(void 0);
          }
          if (stream._pendingAbortRequest !== void 0) {
            return stream._pendingAbortRequest._promise;
          }
          let wasAlreadyErroring = false;
          if (state === "erroring") {
            wasAlreadyErroring = true;
            reason = void 0;
          }
          const promise = newPromise((resolve2, reject) => {
            stream._pendingAbortRequest = {
              _promise: void 0,
              _resolve: resolve2,
              _reject: reject,
              _reason: reason,
              _wasAlreadyErroring: wasAlreadyErroring
            };
          });
          stream._pendingAbortRequest._promise = promise;
          if (!wasAlreadyErroring) {
            WritableStreamStartErroring(stream, reason);
          }
          return promise;
        }
        function WritableStreamClose(stream) {
          const state = stream._state;
          if (state === "closed" || state === "errored") {
            return promiseRejectedWith(new TypeError(`The stream (in ${state} state) is not in the writable state and cannot be closed`));
          }
          const promise = newPromise((resolve2, reject) => {
            const closeRequest = {
              _resolve: resolve2,
              _reject: reject
            };
            stream._closeRequest = closeRequest;
          });
          const writer = stream._writer;
          if (writer !== void 0 && stream._backpressure && state === "writable") {
            defaultWriterReadyPromiseResolve(writer);
          }
          WritableStreamDefaultControllerClose(stream._writableStreamController);
          return promise;
        }
        function WritableStreamAddWriteRequest(stream) {
          const promise = newPromise((resolve2, reject) => {
            const writeRequest = {
              _resolve: resolve2,
              _reject: reject
            };
            stream._writeRequests.push(writeRequest);
          });
          return promise;
        }
        function WritableStreamDealWithRejection(stream, error2) {
          const state = stream._state;
          if (state === "writable") {
            WritableStreamStartErroring(stream, error2);
            return;
          }
          WritableStreamFinishErroring(stream);
        }
        function WritableStreamStartErroring(stream, reason) {
          const controller = stream._writableStreamController;
          stream._state = "erroring";
          stream._storedError = reason;
          const writer = stream._writer;
          if (writer !== void 0) {
            WritableStreamDefaultWriterEnsureReadyPromiseRejected(writer, reason);
          }
          if (!WritableStreamHasOperationMarkedInFlight(stream) && controller._started) {
            WritableStreamFinishErroring(stream);
          }
        }
        function WritableStreamFinishErroring(stream) {
          stream._state = "errored";
          stream._writableStreamController[ErrorSteps]();
          const storedError = stream._storedError;
          stream._writeRequests.forEach((writeRequest) => {
            writeRequest._reject(storedError);
          });
          stream._writeRequests = new SimpleQueue();
          if (stream._pendingAbortRequest === void 0) {
            WritableStreamRejectCloseAndClosedPromiseIfNeeded(stream);
            return;
          }
          const abortRequest = stream._pendingAbortRequest;
          stream._pendingAbortRequest = void 0;
          if (abortRequest._wasAlreadyErroring) {
            abortRequest._reject(storedError);
            WritableStreamRejectCloseAndClosedPromiseIfNeeded(stream);
            return;
          }
          const promise = stream._writableStreamController[AbortSteps](abortRequest._reason);
          uponPromise(promise, () => {
            abortRequest._resolve();
            WritableStreamRejectCloseAndClosedPromiseIfNeeded(stream);
          }, (reason) => {
            abortRequest._reject(reason);
            WritableStreamRejectCloseAndClosedPromiseIfNeeded(stream);
          });
        }
        function WritableStreamFinishInFlightWrite(stream) {
          stream._inFlightWriteRequest._resolve(void 0);
          stream._inFlightWriteRequest = void 0;
        }
        function WritableStreamFinishInFlightWriteWithError(stream, error2) {
          stream._inFlightWriteRequest._reject(error2);
          stream._inFlightWriteRequest = void 0;
          WritableStreamDealWithRejection(stream, error2);
        }
        function WritableStreamFinishInFlightClose(stream) {
          stream._inFlightCloseRequest._resolve(void 0);
          stream._inFlightCloseRequest = void 0;
          const state = stream._state;
          if (state === "erroring") {
            stream._storedError = void 0;
            if (stream._pendingAbortRequest !== void 0) {
              stream._pendingAbortRequest._resolve();
              stream._pendingAbortRequest = void 0;
            }
          }
          stream._state = "closed";
          const writer = stream._writer;
          if (writer !== void 0) {
            defaultWriterClosedPromiseResolve(writer);
          }
        }
        function WritableStreamFinishInFlightCloseWithError(stream, error2) {
          stream._inFlightCloseRequest._reject(error2);
          stream._inFlightCloseRequest = void 0;
          if (stream._pendingAbortRequest !== void 0) {
            stream._pendingAbortRequest._reject(error2);
            stream._pendingAbortRequest = void 0;
          }
          WritableStreamDealWithRejection(stream, error2);
        }
        function WritableStreamCloseQueuedOrInFlight(stream) {
          if (stream._closeRequest === void 0 && stream._inFlightCloseRequest === void 0) {
            return false;
          }
          return true;
        }
        function WritableStreamHasOperationMarkedInFlight(stream) {
          if (stream._inFlightWriteRequest === void 0 && stream._inFlightCloseRequest === void 0) {
            return false;
          }
          return true;
        }
        function WritableStreamMarkCloseRequestInFlight(stream) {
          stream._inFlightCloseRequest = stream._closeRequest;
          stream._closeRequest = void 0;
        }
        function WritableStreamMarkFirstWriteRequestInFlight(stream) {
          stream._inFlightWriteRequest = stream._writeRequests.shift();
        }
        function WritableStreamRejectCloseAndClosedPromiseIfNeeded(stream) {
          if (stream._closeRequest !== void 0) {
            stream._closeRequest._reject(stream._storedError);
            stream._closeRequest = void 0;
          }
          const writer = stream._writer;
          if (writer !== void 0) {
            defaultWriterClosedPromiseReject(writer, stream._storedError);
          }
        }
        function WritableStreamUpdateBackpressure(stream, backpressure) {
          const writer = stream._writer;
          if (writer !== void 0 && backpressure !== stream._backpressure) {
            if (backpressure) {
              defaultWriterReadyPromiseReset(writer);
            } else {
              defaultWriterReadyPromiseResolve(writer);
            }
          }
          stream._backpressure = backpressure;
        }
        class WritableStreamDefaultWriter {
          constructor(stream) {
            assertRequiredArgument(stream, 1, "WritableStreamDefaultWriter");
            assertWritableStream(stream, "First parameter");
            if (IsWritableStreamLocked(stream)) {
              throw new TypeError("This stream has already been locked for exclusive writing by another writer");
            }
            this._ownerWritableStream = stream;
            stream._writer = this;
            const state = stream._state;
            if (state === "writable") {
              if (!WritableStreamCloseQueuedOrInFlight(stream) && stream._backpressure) {
                defaultWriterReadyPromiseInitialize(this);
              } else {
                defaultWriterReadyPromiseInitializeAsResolved(this);
              }
              defaultWriterClosedPromiseInitialize(this);
            } else if (state === "erroring") {
              defaultWriterReadyPromiseInitializeAsRejected(this, stream._storedError);
              defaultWriterClosedPromiseInitialize(this);
            } else if (state === "closed") {
              defaultWriterReadyPromiseInitializeAsResolved(this);
              defaultWriterClosedPromiseInitializeAsResolved(this);
            } else {
              const storedError = stream._storedError;
              defaultWriterReadyPromiseInitializeAsRejected(this, storedError);
              defaultWriterClosedPromiseInitializeAsRejected(this, storedError);
            }
          }
          get closed() {
            if (!IsWritableStreamDefaultWriter(this)) {
              return promiseRejectedWith(defaultWriterBrandCheckException("closed"));
            }
            return this._closedPromise;
          }
          get desiredSize() {
            if (!IsWritableStreamDefaultWriter(this)) {
              throw defaultWriterBrandCheckException("desiredSize");
            }
            if (this._ownerWritableStream === void 0) {
              throw defaultWriterLockException("desiredSize");
            }
            return WritableStreamDefaultWriterGetDesiredSize(this);
          }
          get ready() {
            if (!IsWritableStreamDefaultWriter(this)) {
              return promiseRejectedWith(defaultWriterBrandCheckException("ready"));
            }
            return this._readyPromise;
          }
          abort(reason = void 0) {
            if (!IsWritableStreamDefaultWriter(this)) {
              return promiseRejectedWith(defaultWriterBrandCheckException("abort"));
            }
            if (this._ownerWritableStream === void 0) {
              return promiseRejectedWith(defaultWriterLockException("abort"));
            }
            return WritableStreamDefaultWriterAbort(this, reason);
          }
          close() {
            if (!IsWritableStreamDefaultWriter(this)) {
              return promiseRejectedWith(defaultWriterBrandCheckException("close"));
            }
            const stream = this._ownerWritableStream;
            if (stream === void 0) {
              return promiseRejectedWith(defaultWriterLockException("close"));
            }
            if (WritableStreamCloseQueuedOrInFlight(stream)) {
              return promiseRejectedWith(new TypeError("Cannot close an already-closing stream"));
            }
            return WritableStreamDefaultWriterClose(this);
          }
          releaseLock() {
            if (!IsWritableStreamDefaultWriter(this)) {
              throw defaultWriterBrandCheckException("releaseLock");
            }
            const stream = this._ownerWritableStream;
            if (stream === void 0) {
              return;
            }
            WritableStreamDefaultWriterRelease(this);
          }
          write(chunk = void 0) {
            if (!IsWritableStreamDefaultWriter(this)) {
              return promiseRejectedWith(defaultWriterBrandCheckException("write"));
            }
            if (this._ownerWritableStream === void 0) {
              return promiseRejectedWith(defaultWriterLockException("write to"));
            }
            return WritableStreamDefaultWriterWrite(this, chunk);
          }
        }
        Object.defineProperties(WritableStreamDefaultWriter.prototype, {
          abort: { enumerable: true },
          close: { enumerable: true },
          releaseLock: { enumerable: true },
          write: { enumerable: true },
          closed: { enumerable: true },
          desiredSize: { enumerable: true },
          ready: { enumerable: true }
        });
        if (typeof SymbolPolyfill.toStringTag === "symbol") {
          Object.defineProperty(WritableStreamDefaultWriter.prototype, SymbolPolyfill.toStringTag, {
            value: "WritableStreamDefaultWriter",
            configurable: true
          });
        }
        function IsWritableStreamDefaultWriter(x) {
          if (!typeIsObject(x)) {
            return false;
          }
          if (!Object.prototype.hasOwnProperty.call(x, "_ownerWritableStream")) {
            return false;
          }
          return x instanceof WritableStreamDefaultWriter;
        }
        function WritableStreamDefaultWriterAbort(writer, reason) {
          const stream = writer._ownerWritableStream;
          return WritableStreamAbort(stream, reason);
        }
        function WritableStreamDefaultWriterClose(writer) {
          const stream = writer._ownerWritableStream;
          return WritableStreamClose(stream);
        }
        function WritableStreamDefaultWriterCloseWithErrorPropagation(writer) {
          const stream = writer._ownerWritableStream;
          const state = stream._state;
          if (WritableStreamCloseQueuedOrInFlight(stream) || state === "closed") {
            return promiseResolvedWith(void 0);
          }
          if (state === "errored") {
            return promiseRejectedWith(stream._storedError);
          }
          return WritableStreamDefaultWriterClose(writer);
        }
        function WritableStreamDefaultWriterEnsureClosedPromiseRejected(writer, error2) {
          if (writer._closedPromiseState === "pending") {
            defaultWriterClosedPromiseReject(writer, error2);
          } else {
            defaultWriterClosedPromiseResetToRejected(writer, error2);
          }
        }
        function WritableStreamDefaultWriterEnsureReadyPromiseRejected(writer, error2) {
          if (writer._readyPromiseState === "pending") {
            defaultWriterReadyPromiseReject(writer, error2);
          } else {
            defaultWriterReadyPromiseResetToRejected(writer, error2);
          }
        }
        function WritableStreamDefaultWriterGetDesiredSize(writer) {
          const stream = writer._ownerWritableStream;
          const state = stream._state;
          if (state === "errored" || state === "erroring") {
            return null;
          }
          if (state === "closed") {
            return 0;
          }
          return WritableStreamDefaultControllerGetDesiredSize(stream._writableStreamController);
        }
        function WritableStreamDefaultWriterRelease(writer) {
          const stream = writer._ownerWritableStream;
          const releasedError = new TypeError(`Writer was released and can no longer be used to monitor the stream's closedness`);
          WritableStreamDefaultWriterEnsureReadyPromiseRejected(writer, releasedError);
          WritableStreamDefaultWriterEnsureClosedPromiseRejected(writer, releasedError);
          stream._writer = void 0;
          writer._ownerWritableStream = void 0;
        }
        function WritableStreamDefaultWriterWrite(writer, chunk) {
          const stream = writer._ownerWritableStream;
          const controller = stream._writableStreamController;
          const chunkSize = WritableStreamDefaultControllerGetChunkSize(controller, chunk);
          if (stream !== writer._ownerWritableStream) {
            return promiseRejectedWith(defaultWriterLockException("write to"));
          }
          const state = stream._state;
          if (state === "errored") {
            return promiseRejectedWith(stream._storedError);
          }
          if (WritableStreamCloseQueuedOrInFlight(stream) || state === "closed") {
            return promiseRejectedWith(new TypeError("The stream is closing or closed and cannot be written to"));
          }
          if (state === "erroring") {
            return promiseRejectedWith(stream._storedError);
          }
          const promise = WritableStreamAddWriteRequest(stream);
          WritableStreamDefaultControllerWrite(controller, chunk, chunkSize);
          return promise;
        }
        const closeSentinel = {};
        class WritableStreamDefaultController {
          constructor() {
            throw new TypeError("Illegal constructor");
          }
          get abortReason() {
            if (!IsWritableStreamDefaultController(this)) {
              throw defaultControllerBrandCheckException$2("abortReason");
            }
            return this._abortReason;
          }
          get signal() {
            if (!IsWritableStreamDefaultController(this)) {
              throw defaultControllerBrandCheckException$2("signal");
            }
            if (this._abortController === void 0) {
              throw new TypeError("WritableStreamDefaultController.prototype.signal is not supported");
            }
            return this._abortController.signal;
          }
          error(e = void 0) {
            if (!IsWritableStreamDefaultController(this)) {
              throw defaultControllerBrandCheckException$2("error");
            }
            const state = this._controlledWritableStream._state;
            if (state !== "writable") {
              return;
            }
            WritableStreamDefaultControllerError(this, e);
          }
          [AbortSteps](reason) {
            const result = this._abortAlgorithm(reason);
            WritableStreamDefaultControllerClearAlgorithms(this);
            return result;
          }
          [ErrorSteps]() {
            ResetQueue(this);
          }
        }
        Object.defineProperties(WritableStreamDefaultController.prototype, {
          error: { enumerable: true }
        });
        if (typeof SymbolPolyfill.toStringTag === "symbol") {
          Object.defineProperty(WritableStreamDefaultController.prototype, SymbolPolyfill.toStringTag, {
            value: "WritableStreamDefaultController",
            configurable: true
          });
        }
        function IsWritableStreamDefaultController(x) {
          if (!typeIsObject(x)) {
            return false;
          }
          if (!Object.prototype.hasOwnProperty.call(x, "_controlledWritableStream")) {
            return false;
          }
          return x instanceof WritableStreamDefaultController;
        }
        function SetUpWritableStreamDefaultController(stream, controller, startAlgorithm, writeAlgorithm, closeAlgorithm, abortAlgorithm, highWaterMark, sizeAlgorithm) {
          controller._controlledWritableStream = stream;
          stream._writableStreamController = controller;
          controller._queue = void 0;
          controller._queueTotalSize = void 0;
          ResetQueue(controller);
          controller._abortReason = void 0;
          controller._abortController = createAbortController();
          controller._started = false;
          controller._strategySizeAlgorithm = sizeAlgorithm;
          controller._strategyHWM = highWaterMark;
          controller._writeAlgorithm = writeAlgorithm;
          controller._closeAlgorithm = closeAlgorithm;
          controller._abortAlgorithm = abortAlgorithm;
          const backpressure = WritableStreamDefaultControllerGetBackpressure(controller);
          WritableStreamUpdateBackpressure(stream, backpressure);
          const startResult = startAlgorithm();
          const startPromise = promiseResolvedWith(startResult);
          uponPromise(startPromise, () => {
            controller._started = true;
            WritableStreamDefaultControllerAdvanceQueueIfNeeded(controller);
          }, (r) => {
            controller._started = true;
            WritableStreamDealWithRejection(stream, r);
          });
        }
        function SetUpWritableStreamDefaultControllerFromUnderlyingSink(stream, underlyingSink, highWaterMark, sizeAlgorithm) {
          const controller = Object.create(WritableStreamDefaultController.prototype);
          let startAlgorithm = () => void 0;
          let writeAlgorithm = () => promiseResolvedWith(void 0);
          let closeAlgorithm = () => promiseResolvedWith(void 0);
          let abortAlgorithm = () => promiseResolvedWith(void 0);
          if (underlyingSink.start !== void 0) {
            startAlgorithm = () => underlyingSink.start(controller);
          }
          if (underlyingSink.write !== void 0) {
            writeAlgorithm = (chunk) => underlyingSink.write(chunk, controller);
          }
          if (underlyingSink.close !== void 0) {
            closeAlgorithm = () => underlyingSink.close();
          }
          if (underlyingSink.abort !== void 0) {
            abortAlgorithm = (reason) => underlyingSink.abort(reason);
          }
          SetUpWritableStreamDefaultController(stream, controller, startAlgorithm, writeAlgorithm, closeAlgorithm, abortAlgorithm, highWaterMark, sizeAlgorithm);
        }
        function WritableStreamDefaultControllerClearAlgorithms(controller) {
          controller._writeAlgorithm = void 0;
          controller._closeAlgorithm = void 0;
          controller._abortAlgorithm = void 0;
          controller._strategySizeAlgorithm = void 0;
        }
        function WritableStreamDefaultControllerClose(controller) {
          EnqueueValueWithSize(controller, closeSentinel, 0);
          WritableStreamDefaultControllerAdvanceQueueIfNeeded(controller);
        }
        function WritableStreamDefaultControllerGetChunkSize(controller, chunk) {
          try {
            return controller._strategySizeAlgorithm(chunk);
          } catch (chunkSizeE) {
            WritableStreamDefaultControllerErrorIfNeeded(controller, chunkSizeE);
            return 1;
          }
        }
        function WritableStreamDefaultControllerGetDesiredSize(controller) {
          return controller._strategyHWM - controller._queueTotalSize;
        }
        function WritableStreamDefaultControllerWrite(controller, chunk, chunkSize) {
          try {
            EnqueueValueWithSize(controller, chunk, chunkSize);
          } catch (enqueueE) {
            WritableStreamDefaultControllerErrorIfNeeded(controller, enqueueE);
            return;
          }
          const stream = controller._controlledWritableStream;
          if (!WritableStreamCloseQueuedOrInFlight(stream) && stream._state === "writable") {
            const backpressure = WritableStreamDefaultControllerGetBackpressure(controller);
            WritableStreamUpdateBackpressure(stream, backpressure);
          }
          WritableStreamDefaultControllerAdvanceQueueIfNeeded(controller);
        }
        function WritableStreamDefaultControllerAdvanceQueueIfNeeded(controller) {
          const stream = controller._controlledWritableStream;
          if (!controller._started) {
            return;
          }
          if (stream._inFlightWriteRequest !== void 0) {
            return;
          }
          const state = stream._state;
          if (state === "erroring") {
            WritableStreamFinishErroring(stream);
            return;
          }
          if (controller._queue.length === 0) {
            return;
          }
          const value = PeekQueueValue(controller);
          if (value === closeSentinel) {
            WritableStreamDefaultControllerProcessClose(controller);
          } else {
            WritableStreamDefaultControllerProcessWrite(controller, value);
          }
        }
        function WritableStreamDefaultControllerErrorIfNeeded(controller, error2) {
          if (controller._controlledWritableStream._state === "writable") {
            WritableStreamDefaultControllerError(controller, error2);
          }
        }
        function WritableStreamDefaultControllerProcessClose(controller) {
          const stream = controller._controlledWritableStream;
          WritableStreamMarkCloseRequestInFlight(stream);
          DequeueValue(controller);
          const sinkClosePromise = controller._closeAlgorithm();
          WritableStreamDefaultControllerClearAlgorithms(controller);
          uponPromise(sinkClosePromise, () => {
            WritableStreamFinishInFlightClose(stream);
          }, (reason) => {
            WritableStreamFinishInFlightCloseWithError(stream, reason);
          });
        }
        function WritableStreamDefaultControllerProcessWrite(controller, chunk) {
          const stream = controller._controlledWritableStream;
          WritableStreamMarkFirstWriteRequestInFlight(stream);
          const sinkWritePromise = controller._writeAlgorithm(chunk);
          uponPromise(sinkWritePromise, () => {
            WritableStreamFinishInFlightWrite(stream);
            const state = stream._state;
            DequeueValue(controller);
            if (!WritableStreamCloseQueuedOrInFlight(stream) && state === "writable") {
              const backpressure = WritableStreamDefaultControllerGetBackpressure(controller);
              WritableStreamUpdateBackpressure(stream, backpressure);
            }
            WritableStreamDefaultControllerAdvanceQueueIfNeeded(controller);
          }, (reason) => {
            if (stream._state === "writable") {
              WritableStreamDefaultControllerClearAlgorithms(controller);
            }
            WritableStreamFinishInFlightWriteWithError(stream, reason);
          });
        }
        function WritableStreamDefaultControllerGetBackpressure(controller) {
          const desiredSize = WritableStreamDefaultControllerGetDesiredSize(controller);
          return desiredSize <= 0;
        }
        function WritableStreamDefaultControllerError(controller, error2) {
          const stream = controller._controlledWritableStream;
          WritableStreamDefaultControllerClearAlgorithms(controller);
          WritableStreamStartErroring(stream, error2);
        }
        function streamBrandCheckException$2(name) {
          return new TypeError(`WritableStream.prototype.${name} can only be used on a WritableStream`);
        }
        function defaultControllerBrandCheckException$2(name) {
          return new TypeError(`WritableStreamDefaultController.prototype.${name} can only be used on a WritableStreamDefaultController`);
        }
        function defaultWriterBrandCheckException(name) {
          return new TypeError(`WritableStreamDefaultWriter.prototype.${name} can only be used on a WritableStreamDefaultWriter`);
        }
        function defaultWriterLockException(name) {
          return new TypeError("Cannot " + name + " a stream using a released writer");
        }
        function defaultWriterClosedPromiseInitialize(writer) {
          writer._closedPromise = newPromise((resolve2, reject) => {
            writer._closedPromise_resolve = resolve2;
            writer._closedPromise_reject = reject;
            writer._closedPromiseState = "pending";
          });
        }
        function defaultWriterClosedPromiseInitializeAsRejected(writer, reason) {
          defaultWriterClosedPromiseInitialize(writer);
          defaultWriterClosedPromiseReject(writer, reason);
        }
        function defaultWriterClosedPromiseInitializeAsResolved(writer) {
          defaultWriterClosedPromiseInitialize(writer);
          defaultWriterClosedPromiseResolve(writer);
        }
        function defaultWriterClosedPromiseReject(writer, reason) {
          if (writer._closedPromise_reject === void 0) {
            return;
          }
          setPromiseIsHandledToTrue(writer._closedPromise);
          writer._closedPromise_reject(reason);
          writer._closedPromise_resolve = void 0;
          writer._closedPromise_reject = void 0;
          writer._closedPromiseState = "rejected";
        }
        function defaultWriterClosedPromiseResetToRejected(writer, reason) {
          defaultWriterClosedPromiseInitializeAsRejected(writer, reason);
        }
        function defaultWriterClosedPromiseResolve(writer) {
          if (writer._closedPromise_resolve === void 0) {
            return;
          }
          writer._closedPromise_resolve(void 0);
          writer._closedPromise_resolve = void 0;
          writer._closedPromise_reject = void 0;
          writer._closedPromiseState = "resolved";
        }
        function defaultWriterReadyPromiseInitialize(writer) {
          writer._readyPromise = newPromise((resolve2, reject) => {
            writer._readyPromise_resolve = resolve2;
            writer._readyPromise_reject = reject;
          });
          writer._readyPromiseState = "pending";
        }
        function defaultWriterReadyPromiseInitializeAsRejected(writer, reason) {
          defaultWriterReadyPromiseInitialize(writer);
          defaultWriterReadyPromiseReject(writer, reason);
        }
        function defaultWriterReadyPromiseInitializeAsResolved(writer) {
          defaultWriterReadyPromiseInitialize(writer);
          defaultWriterReadyPromiseResolve(writer);
        }
        function defaultWriterReadyPromiseReject(writer, reason) {
          if (writer._readyPromise_reject === void 0) {
            return;
          }
          setPromiseIsHandledToTrue(writer._readyPromise);
          writer._readyPromise_reject(reason);
          writer._readyPromise_resolve = void 0;
          writer._readyPromise_reject = void 0;
          writer._readyPromiseState = "rejected";
        }
        function defaultWriterReadyPromiseReset(writer) {
          defaultWriterReadyPromiseInitialize(writer);
        }
        function defaultWriterReadyPromiseResetToRejected(writer, reason) {
          defaultWriterReadyPromiseInitializeAsRejected(writer, reason);
        }
        function defaultWriterReadyPromiseResolve(writer) {
          if (writer._readyPromise_resolve === void 0) {
            return;
          }
          writer._readyPromise_resolve(void 0);
          writer._readyPromise_resolve = void 0;
          writer._readyPromise_reject = void 0;
          writer._readyPromiseState = "fulfilled";
        }
        const NativeDOMException = typeof DOMException !== "undefined" ? DOMException : void 0;
        function isDOMExceptionConstructor(ctor) {
          if (!(typeof ctor === "function" || typeof ctor === "object")) {
            return false;
          }
          try {
            new ctor();
            return true;
          } catch (_a) {
            return false;
          }
        }
        function createDOMExceptionPolyfill() {
          const ctor = function DOMException2(message, name) {
            this.message = message || "";
            this.name = name || "Error";
            if (Error.captureStackTrace) {
              Error.captureStackTrace(this, this.constructor);
            }
          };
          ctor.prototype = Object.create(Error.prototype);
          Object.defineProperty(ctor.prototype, "constructor", { value: ctor, writable: true, configurable: true });
          return ctor;
        }
        const DOMException$1 = isDOMExceptionConstructor(NativeDOMException) ? NativeDOMException : createDOMExceptionPolyfill();
        function ReadableStreamPipeTo(source, dest, preventClose, preventAbort, preventCancel, signal) {
          const reader = AcquireReadableStreamDefaultReader(source);
          const writer = AcquireWritableStreamDefaultWriter(dest);
          source._disturbed = true;
          let shuttingDown = false;
          let currentWrite = promiseResolvedWith(void 0);
          return newPromise((resolve2, reject) => {
            let abortAlgorithm;
            if (signal !== void 0) {
              abortAlgorithm = () => {
                const error2 = new DOMException$1("Aborted", "AbortError");
                const actions = [];
                if (!preventAbort) {
                  actions.push(() => {
                    if (dest._state === "writable") {
                      return WritableStreamAbort(dest, error2);
                    }
                    return promiseResolvedWith(void 0);
                  });
                }
                if (!preventCancel) {
                  actions.push(() => {
                    if (source._state === "readable") {
                      return ReadableStreamCancel(source, error2);
                    }
                    return promiseResolvedWith(void 0);
                  });
                }
                shutdownWithAction(() => Promise.all(actions.map((action) => action())), true, error2);
              };
              if (signal.aborted) {
                abortAlgorithm();
                return;
              }
              signal.addEventListener("abort", abortAlgorithm);
            }
            function pipeLoop() {
              return newPromise((resolveLoop, rejectLoop) => {
                function next(done) {
                  if (done) {
                    resolveLoop();
                  } else {
                    PerformPromiseThen(pipeStep(), next, rejectLoop);
                  }
                }
                next(false);
              });
            }
            function pipeStep() {
              if (shuttingDown) {
                return promiseResolvedWith(true);
              }
              return PerformPromiseThen(writer._readyPromise, () => {
                return newPromise((resolveRead, rejectRead) => {
                  ReadableStreamDefaultReaderRead(reader, {
                    _chunkSteps: (chunk) => {
                      currentWrite = PerformPromiseThen(WritableStreamDefaultWriterWrite(writer, chunk), void 0, noop2);
                      resolveRead(false);
                    },
                    _closeSteps: () => resolveRead(true),
                    _errorSteps: rejectRead
                  });
                });
              });
            }
            isOrBecomesErrored(source, reader._closedPromise, (storedError) => {
              if (!preventAbort) {
                shutdownWithAction(() => WritableStreamAbort(dest, storedError), true, storedError);
              } else {
                shutdown(true, storedError);
              }
            });
            isOrBecomesErrored(dest, writer._closedPromise, (storedError) => {
              if (!preventCancel) {
                shutdownWithAction(() => ReadableStreamCancel(source, storedError), true, storedError);
              } else {
                shutdown(true, storedError);
              }
            });
            isOrBecomesClosed(source, reader._closedPromise, () => {
              if (!preventClose) {
                shutdownWithAction(() => WritableStreamDefaultWriterCloseWithErrorPropagation(writer));
              } else {
                shutdown();
              }
            });
            if (WritableStreamCloseQueuedOrInFlight(dest) || dest._state === "closed") {
              const destClosed = new TypeError("the destination writable stream closed before all data could be piped to it");
              if (!preventCancel) {
                shutdownWithAction(() => ReadableStreamCancel(source, destClosed), true, destClosed);
              } else {
                shutdown(true, destClosed);
              }
            }
            setPromiseIsHandledToTrue(pipeLoop());
            function waitForWritesToFinish() {
              const oldCurrentWrite = currentWrite;
              return PerformPromiseThen(currentWrite, () => oldCurrentWrite !== currentWrite ? waitForWritesToFinish() : void 0);
            }
            function isOrBecomesErrored(stream, promise, action) {
              if (stream._state === "errored") {
                action(stream._storedError);
              } else {
                uponRejection(promise, action);
              }
            }
            function isOrBecomesClosed(stream, promise, action) {
              if (stream._state === "closed") {
                action();
              } else {
                uponFulfillment(promise, action);
              }
            }
            function shutdownWithAction(action, originalIsError, originalError) {
              if (shuttingDown) {
                return;
              }
              shuttingDown = true;
              if (dest._state === "writable" && !WritableStreamCloseQueuedOrInFlight(dest)) {
                uponFulfillment(waitForWritesToFinish(), doTheRest);
              } else {
                doTheRest();
              }
              function doTheRest() {
                uponPromise(action(), () => finalize(originalIsError, originalError), (newError) => finalize(true, newError));
              }
            }
            function shutdown(isError, error2) {
              if (shuttingDown) {
                return;
              }
              shuttingDown = true;
              if (dest._state === "writable" && !WritableStreamCloseQueuedOrInFlight(dest)) {
                uponFulfillment(waitForWritesToFinish(), () => finalize(isError, error2));
              } else {
                finalize(isError, error2);
              }
            }
            function finalize(isError, error2) {
              WritableStreamDefaultWriterRelease(writer);
              ReadableStreamReaderGenericRelease(reader);
              if (signal !== void 0) {
                signal.removeEventListener("abort", abortAlgorithm);
              }
              if (isError) {
                reject(error2);
              } else {
                resolve2(void 0);
              }
            }
          });
        }
        class ReadableStreamDefaultController {
          constructor() {
            throw new TypeError("Illegal constructor");
          }
          get desiredSize() {
            if (!IsReadableStreamDefaultController(this)) {
              throw defaultControllerBrandCheckException$1("desiredSize");
            }
            return ReadableStreamDefaultControllerGetDesiredSize(this);
          }
          close() {
            if (!IsReadableStreamDefaultController(this)) {
              throw defaultControllerBrandCheckException$1("close");
            }
            if (!ReadableStreamDefaultControllerCanCloseOrEnqueue(this)) {
              throw new TypeError("The stream is not in a state that permits close");
            }
            ReadableStreamDefaultControllerClose(this);
          }
          enqueue(chunk = void 0) {
            if (!IsReadableStreamDefaultController(this)) {
              throw defaultControllerBrandCheckException$1("enqueue");
            }
            if (!ReadableStreamDefaultControllerCanCloseOrEnqueue(this)) {
              throw new TypeError("The stream is not in a state that permits enqueue");
            }
            return ReadableStreamDefaultControllerEnqueue(this, chunk);
          }
          error(e = void 0) {
            if (!IsReadableStreamDefaultController(this)) {
              throw defaultControllerBrandCheckException$1("error");
            }
            ReadableStreamDefaultControllerError(this, e);
          }
          [CancelSteps](reason) {
            ResetQueue(this);
            const result = this._cancelAlgorithm(reason);
            ReadableStreamDefaultControllerClearAlgorithms(this);
            return result;
          }
          [PullSteps](readRequest) {
            const stream = this._controlledReadableStream;
            if (this._queue.length > 0) {
              const chunk = DequeueValue(this);
              if (this._closeRequested && this._queue.length === 0) {
                ReadableStreamDefaultControllerClearAlgorithms(this);
                ReadableStreamClose(stream);
              } else {
                ReadableStreamDefaultControllerCallPullIfNeeded(this);
              }
              readRequest._chunkSteps(chunk);
            } else {
              ReadableStreamAddReadRequest(stream, readRequest);
              ReadableStreamDefaultControllerCallPullIfNeeded(this);
            }
          }
        }
        Object.defineProperties(ReadableStreamDefaultController.prototype, {
          close: { enumerable: true },
          enqueue: { enumerable: true },
          error: { enumerable: true },
          desiredSize: { enumerable: true }
        });
        if (typeof SymbolPolyfill.toStringTag === "symbol") {
          Object.defineProperty(ReadableStreamDefaultController.prototype, SymbolPolyfill.toStringTag, {
            value: "ReadableStreamDefaultController",
            configurable: true
          });
        }
        function IsReadableStreamDefaultController(x) {
          if (!typeIsObject(x)) {
            return false;
          }
          if (!Object.prototype.hasOwnProperty.call(x, "_controlledReadableStream")) {
            return false;
          }
          return x instanceof ReadableStreamDefaultController;
        }
        function ReadableStreamDefaultControllerCallPullIfNeeded(controller) {
          const shouldPull = ReadableStreamDefaultControllerShouldCallPull(controller);
          if (!shouldPull) {
            return;
          }
          if (controller._pulling) {
            controller._pullAgain = true;
            return;
          }
          controller._pulling = true;
          const pullPromise = controller._pullAlgorithm();
          uponPromise(pullPromise, () => {
            controller._pulling = false;
            if (controller._pullAgain) {
              controller._pullAgain = false;
              ReadableStreamDefaultControllerCallPullIfNeeded(controller);
            }
          }, (e) => {
            ReadableStreamDefaultControllerError(controller, e);
          });
        }
        function ReadableStreamDefaultControllerShouldCallPull(controller) {
          const stream = controller._controlledReadableStream;
          if (!ReadableStreamDefaultControllerCanCloseOrEnqueue(controller)) {
            return false;
          }
          if (!controller._started) {
            return false;
          }
          if (IsReadableStreamLocked(stream) && ReadableStreamGetNumReadRequests(stream) > 0) {
            return true;
          }
          const desiredSize = ReadableStreamDefaultControllerGetDesiredSize(controller);
          if (desiredSize > 0) {
            return true;
          }
          return false;
        }
        function ReadableStreamDefaultControllerClearAlgorithms(controller) {
          controller._pullAlgorithm = void 0;
          controller._cancelAlgorithm = void 0;
          controller._strategySizeAlgorithm = void 0;
        }
        function ReadableStreamDefaultControllerClose(controller) {
          if (!ReadableStreamDefaultControllerCanCloseOrEnqueue(controller)) {
            return;
          }
          const stream = controller._controlledReadableStream;
          controller._closeRequested = true;
          if (controller._queue.length === 0) {
            ReadableStreamDefaultControllerClearAlgorithms(controller);
            ReadableStreamClose(stream);
          }
        }
        function ReadableStreamDefaultControllerEnqueue(controller, chunk) {
          if (!ReadableStreamDefaultControllerCanCloseOrEnqueue(controller)) {
            return;
          }
          const stream = controller._controlledReadableStream;
          if (IsReadableStreamLocked(stream) && ReadableStreamGetNumReadRequests(stream) > 0) {
            ReadableStreamFulfillReadRequest(stream, chunk, false);
          } else {
            let chunkSize;
            try {
              chunkSize = controller._strategySizeAlgorithm(chunk);
            } catch (chunkSizeE) {
              ReadableStreamDefaultControllerError(controller, chunkSizeE);
              throw chunkSizeE;
            }
            try {
              EnqueueValueWithSize(controller, chunk, chunkSize);
            } catch (enqueueE) {
              ReadableStreamDefaultControllerError(controller, enqueueE);
              throw enqueueE;
            }
          }
          ReadableStreamDefaultControllerCallPullIfNeeded(controller);
        }
        function ReadableStreamDefaultControllerError(controller, e) {
          const stream = controller._controlledReadableStream;
          if (stream._state !== "readable") {
            return;
          }
          ResetQueue(controller);
          ReadableStreamDefaultControllerClearAlgorithms(controller);
          ReadableStreamError(stream, e);
        }
        function ReadableStreamDefaultControllerGetDesiredSize(controller) {
          const state = controller._controlledReadableStream._state;
          if (state === "errored") {
            return null;
          }
          if (state === "closed") {
            return 0;
          }
          return controller._strategyHWM - controller._queueTotalSize;
        }
        function ReadableStreamDefaultControllerHasBackpressure(controller) {
          if (ReadableStreamDefaultControllerShouldCallPull(controller)) {
            return false;
          }
          return true;
        }
        function ReadableStreamDefaultControllerCanCloseOrEnqueue(controller) {
          const state = controller._controlledReadableStream._state;
          if (!controller._closeRequested && state === "readable") {
            return true;
          }
          return false;
        }
        function SetUpReadableStreamDefaultController(stream, controller, startAlgorithm, pullAlgorithm, cancelAlgorithm, highWaterMark, sizeAlgorithm) {
          controller._controlledReadableStream = stream;
          controller._queue = void 0;
          controller._queueTotalSize = void 0;
          ResetQueue(controller);
          controller._started = false;
          controller._closeRequested = false;
          controller._pullAgain = false;
          controller._pulling = false;
          controller._strategySizeAlgorithm = sizeAlgorithm;
          controller._strategyHWM = highWaterMark;
          controller._pullAlgorithm = pullAlgorithm;
          controller._cancelAlgorithm = cancelAlgorithm;
          stream._readableStreamController = controller;
          const startResult = startAlgorithm();
          uponPromise(promiseResolvedWith(startResult), () => {
            controller._started = true;
            ReadableStreamDefaultControllerCallPullIfNeeded(controller);
          }, (r) => {
            ReadableStreamDefaultControllerError(controller, r);
          });
        }
        function SetUpReadableStreamDefaultControllerFromUnderlyingSource(stream, underlyingSource, highWaterMark, sizeAlgorithm) {
          const controller = Object.create(ReadableStreamDefaultController.prototype);
          let startAlgorithm = () => void 0;
          let pullAlgorithm = () => promiseResolvedWith(void 0);
          let cancelAlgorithm = () => promiseResolvedWith(void 0);
          if (underlyingSource.start !== void 0) {
            startAlgorithm = () => underlyingSource.start(controller);
          }
          if (underlyingSource.pull !== void 0) {
            pullAlgorithm = () => underlyingSource.pull(controller);
          }
          if (underlyingSource.cancel !== void 0) {
            cancelAlgorithm = (reason) => underlyingSource.cancel(reason);
          }
          SetUpReadableStreamDefaultController(stream, controller, startAlgorithm, pullAlgorithm, cancelAlgorithm, highWaterMark, sizeAlgorithm);
        }
        function defaultControllerBrandCheckException$1(name) {
          return new TypeError(`ReadableStreamDefaultController.prototype.${name} can only be used on a ReadableStreamDefaultController`);
        }
        function ReadableStreamTee(stream, cloneForBranch2) {
          if (IsReadableByteStreamController(stream._readableStreamController)) {
            return ReadableByteStreamTee(stream);
          }
          return ReadableStreamDefaultTee(stream);
        }
        function ReadableStreamDefaultTee(stream, cloneForBranch2) {
          const reader = AcquireReadableStreamDefaultReader(stream);
          let reading = false;
          let canceled1 = false;
          let canceled2 = false;
          let reason1;
          let reason2;
          let branch1;
          let branch2;
          let resolveCancelPromise;
          const cancelPromise = newPromise((resolve2) => {
            resolveCancelPromise = resolve2;
          });
          function pullAlgorithm() {
            if (reading) {
              return promiseResolvedWith(void 0);
            }
            reading = true;
            const readRequest = {
              _chunkSteps: (chunk) => {
                queueMicrotask(() => {
                  reading = false;
                  const chunk1 = chunk;
                  const chunk2 = chunk;
                  if (!canceled1) {
                    ReadableStreamDefaultControllerEnqueue(branch1._readableStreamController, chunk1);
                  }
                  if (!canceled2) {
                    ReadableStreamDefaultControllerEnqueue(branch2._readableStreamController, chunk2);
                  }
                });
              },
              _closeSteps: () => {
                reading = false;
                if (!canceled1) {
                  ReadableStreamDefaultControllerClose(branch1._readableStreamController);
                }
                if (!canceled2) {
                  ReadableStreamDefaultControllerClose(branch2._readableStreamController);
                }
                if (!canceled1 || !canceled2) {
                  resolveCancelPromise(void 0);
                }
              },
              _errorSteps: () => {
                reading = false;
              }
            };
            ReadableStreamDefaultReaderRead(reader, readRequest);
            return promiseResolvedWith(void 0);
          }
          function cancel1Algorithm(reason) {
            canceled1 = true;
            reason1 = reason;
            if (canceled2) {
              const compositeReason = CreateArrayFromList([reason1, reason2]);
              const cancelResult = ReadableStreamCancel(stream, compositeReason);
              resolveCancelPromise(cancelResult);
            }
            return cancelPromise;
          }
          function cancel2Algorithm(reason) {
            canceled2 = true;
            reason2 = reason;
            if (canceled1) {
              const compositeReason = CreateArrayFromList([reason1, reason2]);
              const cancelResult = ReadableStreamCancel(stream, compositeReason);
              resolveCancelPromise(cancelResult);
            }
            return cancelPromise;
          }
          function startAlgorithm() {
          }
          branch1 = CreateReadableStream(startAlgorithm, pullAlgorithm, cancel1Algorithm);
          branch2 = CreateReadableStream(startAlgorithm, pullAlgorithm, cancel2Algorithm);
          uponRejection(reader._closedPromise, (r) => {
            ReadableStreamDefaultControllerError(branch1._readableStreamController, r);
            ReadableStreamDefaultControllerError(branch2._readableStreamController, r);
            if (!canceled1 || !canceled2) {
              resolveCancelPromise(void 0);
            }
          });
          return [branch1, branch2];
        }
        function ReadableByteStreamTee(stream) {
          let reader = AcquireReadableStreamDefaultReader(stream);
          let reading = false;
          let canceled1 = false;
          let canceled2 = false;
          let reason1;
          let reason2;
          let branch1;
          let branch2;
          let resolveCancelPromise;
          const cancelPromise = newPromise((resolve2) => {
            resolveCancelPromise = resolve2;
          });
          function forwardReaderError(thisReader) {
            uponRejection(thisReader._closedPromise, (r) => {
              if (thisReader !== reader) {
                return;
              }
              ReadableByteStreamControllerError(branch1._readableStreamController, r);
              ReadableByteStreamControllerError(branch2._readableStreamController, r);
              if (!canceled1 || !canceled2) {
                resolveCancelPromise(void 0);
              }
            });
          }
          function pullWithDefaultReader() {
            if (IsReadableStreamBYOBReader(reader)) {
              ReadableStreamReaderGenericRelease(reader);
              reader = AcquireReadableStreamDefaultReader(stream);
              forwardReaderError(reader);
            }
            const readRequest = {
              _chunkSteps: (chunk) => {
                queueMicrotask(() => {
                  reading = false;
                  const chunk1 = chunk;
                  let chunk2 = chunk;
                  if (!canceled1 && !canceled2) {
                    try {
                      chunk2 = CloneAsUint8Array(chunk);
                    } catch (cloneE) {
                      ReadableByteStreamControllerError(branch1._readableStreamController, cloneE);
                      ReadableByteStreamControllerError(branch2._readableStreamController, cloneE);
                      resolveCancelPromise(ReadableStreamCancel(stream, cloneE));
                      return;
                    }
                  }
                  if (!canceled1) {
                    ReadableByteStreamControllerEnqueue(branch1._readableStreamController, chunk1);
                  }
                  if (!canceled2) {
                    ReadableByteStreamControllerEnqueue(branch2._readableStreamController, chunk2);
                  }
                });
              },
              _closeSteps: () => {
                reading = false;
                if (!canceled1) {
                  ReadableByteStreamControllerClose(branch1._readableStreamController);
                }
                if (!canceled2) {
                  ReadableByteStreamControllerClose(branch2._readableStreamController);
                }
                if (branch1._readableStreamController._pendingPullIntos.length > 0) {
                  ReadableByteStreamControllerRespond(branch1._readableStreamController, 0);
                }
                if (branch2._readableStreamController._pendingPullIntos.length > 0) {
                  ReadableByteStreamControllerRespond(branch2._readableStreamController, 0);
                }
                if (!canceled1 || !canceled2) {
                  resolveCancelPromise(void 0);
                }
              },
              _errorSteps: () => {
                reading = false;
              }
            };
            ReadableStreamDefaultReaderRead(reader, readRequest);
          }
          function pullWithBYOBReader(view, forBranch2) {
            if (IsReadableStreamDefaultReader(reader)) {
              ReadableStreamReaderGenericRelease(reader);
              reader = AcquireReadableStreamBYOBReader(stream);
              forwardReaderError(reader);
            }
            const byobBranch = forBranch2 ? branch2 : branch1;
            const otherBranch = forBranch2 ? branch1 : branch2;
            const readIntoRequest = {
              _chunkSteps: (chunk) => {
                queueMicrotask(() => {
                  reading = false;
                  const byobCanceled = forBranch2 ? canceled2 : canceled1;
                  const otherCanceled = forBranch2 ? canceled1 : canceled2;
                  if (!otherCanceled) {
                    let clonedChunk;
                    try {
                      clonedChunk = CloneAsUint8Array(chunk);
                    } catch (cloneE) {
                      ReadableByteStreamControllerError(byobBranch._readableStreamController, cloneE);
                      ReadableByteStreamControllerError(otherBranch._readableStreamController, cloneE);
                      resolveCancelPromise(ReadableStreamCancel(stream, cloneE));
                      return;
                    }
                    if (!byobCanceled) {
                      ReadableByteStreamControllerRespondWithNewView(byobBranch._readableStreamController, chunk);
                    }
                    ReadableByteStreamControllerEnqueue(otherBranch._readableStreamController, clonedChunk);
                  } else if (!byobCanceled) {
                    ReadableByteStreamControllerRespondWithNewView(byobBranch._readableStreamController, chunk);
                  }
                });
              },
              _closeSteps: (chunk) => {
                reading = false;
                const byobCanceled = forBranch2 ? canceled2 : canceled1;
                const otherCanceled = forBranch2 ? canceled1 : canceled2;
                if (!byobCanceled) {
                  ReadableByteStreamControllerClose(byobBranch._readableStreamController);
                }
                if (!otherCanceled) {
                  ReadableByteStreamControllerClose(otherBranch._readableStreamController);
                }
                if (chunk !== void 0) {
                  if (!byobCanceled) {
                    ReadableByteStreamControllerRespondWithNewView(byobBranch._readableStreamController, chunk);
                  }
                  if (!otherCanceled && otherBranch._readableStreamController._pendingPullIntos.length > 0) {
                    ReadableByteStreamControllerRespond(otherBranch._readableStreamController, 0);
                  }
                }
                if (!byobCanceled || !otherCanceled) {
                  resolveCancelPromise(void 0);
                }
              },
              _errorSteps: () => {
                reading = false;
              }
            };
            ReadableStreamBYOBReaderRead(reader, view, readIntoRequest);
          }
          function pull1Algorithm() {
            if (reading) {
              return promiseResolvedWith(void 0);
            }
            reading = true;
            const byobRequest = ReadableByteStreamControllerGetBYOBRequest(branch1._readableStreamController);
            if (byobRequest === null) {
              pullWithDefaultReader();
            } else {
              pullWithBYOBReader(byobRequest._view, false);
            }
            return promiseResolvedWith(void 0);
          }
          function pull2Algorithm() {
            if (reading) {
              return promiseResolvedWith(void 0);
            }
            reading = true;
            const byobRequest = ReadableByteStreamControllerGetBYOBRequest(branch2._readableStreamController);
            if (byobRequest === null) {
              pullWithDefaultReader();
            } else {
              pullWithBYOBReader(byobRequest._view, true);
            }
            return promiseResolvedWith(void 0);
          }
          function cancel1Algorithm(reason) {
            canceled1 = true;
            reason1 = reason;
            if (canceled2) {
              const compositeReason = CreateArrayFromList([reason1, reason2]);
              const cancelResult = ReadableStreamCancel(stream, compositeReason);
              resolveCancelPromise(cancelResult);
            }
            return cancelPromise;
          }
          function cancel2Algorithm(reason) {
            canceled2 = true;
            reason2 = reason;
            if (canceled1) {
              const compositeReason = CreateArrayFromList([reason1, reason2]);
              const cancelResult = ReadableStreamCancel(stream, compositeReason);
              resolveCancelPromise(cancelResult);
            }
            return cancelPromise;
          }
          function startAlgorithm() {
            return;
          }
          branch1 = CreateReadableByteStream(startAlgorithm, pull1Algorithm, cancel1Algorithm);
          branch2 = CreateReadableByteStream(startAlgorithm, pull2Algorithm, cancel2Algorithm);
          forwardReaderError(reader);
          return [branch1, branch2];
        }
        function convertUnderlyingDefaultOrByteSource(source, context) {
          assertDictionary(source, context);
          const original = source;
          const autoAllocateChunkSize = original === null || original === void 0 ? void 0 : original.autoAllocateChunkSize;
          const cancel = original === null || original === void 0 ? void 0 : original.cancel;
          const pull = original === null || original === void 0 ? void 0 : original.pull;
          const start = original === null || original === void 0 ? void 0 : original.start;
          const type = original === null || original === void 0 ? void 0 : original.type;
          return {
            autoAllocateChunkSize: autoAllocateChunkSize === void 0 ? void 0 : convertUnsignedLongLongWithEnforceRange(autoAllocateChunkSize, `${context} has member 'autoAllocateChunkSize' that`),
            cancel: cancel === void 0 ? void 0 : convertUnderlyingSourceCancelCallback(cancel, original, `${context} has member 'cancel' that`),
            pull: pull === void 0 ? void 0 : convertUnderlyingSourcePullCallback(pull, original, `${context} has member 'pull' that`),
            start: start === void 0 ? void 0 : convertUnderlyingSourceStartCallback(start, original, `${context} has member 'start' that`),
            type: type === void 0 ? void 0 : convertReadableStreamType(type, `${context} has member 'type' that`)
          };
        }
        function convertUnderlyingSourceCancelCallback(fn, original, context) {
          assertFunction(fn, context);
          return (reason) => promiseCall(fn, original, [reason]);
        }
        function convertUnderlyingSourcePullCallback(fn, original, context) {
          assertFunction(fn, context);
          return (controller) => promiseCall(fn, original, [controller]);
        }
        function convertUnderlyingSourceStartCallback(fn, original, context) {
          assertFunction(fn, context);
          return (controller) => reflectCall(fn, original, [controller]);
        }
        function convertReadableStreamType(type, context) {
          type = `${type}`;
          if (type !== "bytes") {
            throw new TypeError(`${context} '${type}' is not a valid enumeration value for ReadableStreamType`);
          }
          return type;
        }
        function convertReaderOptions(options2, context) {
          assertDictionary(options2, context);
          const mode = options2 === null || options2 === void 0 ? void 0 : options2.mode;
          return {
            mode: mode === void 0 ? void 0 : convertReadableStreamReaderMode(mode, `${context} has member 'mode' that`)
          };
        }
        function convertReadableStreamReaderMode(mode, context) {
          mode = `${mode}`;
          if (mode !== "byob") {
            throw new TypeError(`${context} '${mode}' is not a valid enumeration value for ReadableStreamReaderMode`);
          }
          return mode;
        }
        function convertIteratorOptions(options2, context) {
          assertDictionary(options2, context);
          const preventCancel = options2 === null || options2 === void 0 ? void 0 : options2.preventCancel;
          return { preventCancel: Boolean(preventCancel) };
        }
        function convertPipeOptions(options2, context) {
          assertDictionary(options2, context);
          const preventAbort = options2 === null || options2 === void 0 ? void 0 : options2.preventAbort;
          const preventCancel = options2 === null || options2 === void 0 ? void 0 : options2.preventCancel;
          const preventClose = options2 === null || options2 === void 0 ? void 0 : options2.preventClose;
          const signal = options2 === null || options2 === void 0 ? void 0 : options2.signal;
          if (signal !== void 0) {
            assertAbortSignal(signal, `${context} has member 'signal' that`);
          }
          return {
            preventAbort: Boolean(preventAbort),
            preventCancel: Boolean(preventCancel),
            preventClose: Boolean(preventClose),
            signal
          };
        }
        function assertAbortSignal(signal, context) {
          if (!isAbortSignal2(signal)) {
            throw new TypeError(`${context} is not an AbortSignal.`);
          }
        }
        function convertReadableWritablePair(pair, context) {
          assertDictionary(pair, context);
          const readable = pair === null || pair === void 0 ? void 0 : pair.readable;
          assertRequiredField(readable, "readable", "ReadableWritablePair");
          assertReadableStream(readable, `${context} has member 'readable' that`);
          const writable2 = pair === null || pair === void 0 ? void 0 : pair.writable;
          assertRequiredField(writable2, "writable", "ReadableWritablePair");
          assertWritableStream(writable2, `${context} has member 'writable' that`);
          return { readable, writable: writable2 };
        }
        class ReadableStream2 {
          constructor(rawUnderlyingSource = {}, rawStrategy = {}) {
            if (rawUnderlyingSource === void 0) {
              rawUnderlyingSource = null;
            } else {
              assertObject(rawUnderlyingSource, "First parameter");
            }
            const strategy = convertQueuingStrategy(rawStrategy, "Second parameter");
            const underlyingSource = convertUnderlyingDefaultOrByteSource(rawUnderlyingSource, "First parameter");
            InitializeReadableStream(this);
            if (underlyingSource.type === "bytes") {
              if (strategy.size !== void 0) {
                throw new RangeError("The strategy for a byte stream cannot have a size function");
              }
              const highWaterMark = ExtractHighWaterMark(strategy, 0);
              SetUpReadableByteStreamControllerFromUnderlyingSource(this, underlyingSource, highWaterMark);
            } else {
              const sizeAlgorithm = ExtractSizeAlgorithm(strategy);
              const highWaterMark = ExtractHighWaterMark(strategy, 1);
              SetUpReadableStreamDefaultControllerFromUnderlyingSource(this, underlyingSource, highWaterMark, sizeAlgorithm);
            }
          }
          get locked() {
            if (!IsReadableStream(this)) {
              throw streamBrandCheckException$1("locked");
            }
            return IsReadableStreamLocked(this);
          }
          cancel(reason = void 0) {
            if (!IsReadableStream(this)) {
              return promiseRejectedWith(streamBrandCheckException$1("cancel"));
            }
            if (IsReadableStreamLocked(this)) {
              return promiseRejectedWith(new TypeError("Cannot cancel a stream that already has a reader"));
            }
            return ReadableStreamCancel(this, reason);
          }
          getReader(rawOptions = void 0) {
            if (!IsReadableStream(this)) {
              throw streamBrandCheckException$1("getReader");
            }
            const options2 = convertReaderOptions(rawOptions, "First parameter");
            if (options2.mode === void 0) {
              return AcquireReadableStreamDefaultReader(this);
            }
            return AcquireReadableStreamBYOBReader(this);
          }
          pipeThrough(rawTransform, rawOptions = {}) {
            if (!IsReadableStream(this)) {
              throw streamBrandCheckException$1("pipeThrough");
            }
            assertRequiredArgument(rawTransform, 1, "pipeThrough");
            const transform = convertReadableWritablePair(rawTransform, "First parameter");
            const options2 = convertPipeOptions(rawOptions, "Second parameter");
            if (IsReadableStreamLocked(this)) {
              throw new TypeError("ReadableStream.prototype.pipeThrough cannot be used on a locked ReadableStream");
            }
            if (IsWritableStreamLocked(transform.writable)) {
              throw new TypeError("ReadableStream.prototype.pipeThrough cannot be used on a locked WritableStream");
            }
            const promise = ReadableStreamPipeTo(this, transform.writable, options2.preventClose, options2.preventAbort, options2.preventCancel, options2.signal);
            setPromiseIsHandledToTrue(promise);
            return transform.readable;
          }
          pipeTo(destination, rawOptions = {}) {
            if (!IsReadableStream(this)) {
              return promiseRejectedWith(streamBrandCheckException$1("pipeTo"));
            }
            if (destination === void 0) {
              return promiseRejectedWith(`Parameter 1 is required in 'pipeTo'.`);
            }
            if (!IsWritableStream(destination)) {
              return promiseRejectedWith(new TypeError(`ReadableStream.prototype.pipeTo's first argument must be a WritableStream`));
            }
            let options2;
            try {
              options2 = convertPipeOptions(rawOptions, "Second parameter");
            } catch (e) {
              return promiseRejectedWith(e);
            }
            if (IsReadableStreamLocked(this)) {
              return promiseRejectedWith(new TypeError("ReadableStream.prototype.pipeTo cannot be used on a locked ReadableStream"));
            }
            if (IsWritableStreamLocked(destination)) {
              return promiseRejectedWith(new TypeError("ReadableStream.prototype.pipeTo cannot be used on a locked WritableStream"));
            }
            return ReadableStreamPipeTo(this, destination, options2.preventClose, options2.preventAbort, options2.preventCancel, options2.signal);
          }
          tee() {
            if (!IsReadableStream(this)) {
              throw streamBrandCheckException$1("tee");
            }
            const branches = ReadableStreamTee(this);
            return CreateArrayFromList(branches);
          }
          values(rawOptions = void 0) {
            if (!IsReadableStream(this)) {
              throw streamBrandCheckException$1("values");
            }
            const options2 = convertIteratorOptions(rawOptions, "First parameter");
            return AcquireReadableStreamAsyncIterator(this, options2.preventCancel);
          }
        }
        Object.defineProperties(ReadableStream2.prototype, {
          cancel: { enumerable: true },
          getReader: { enumerable: true },
          pipeThrough: { enumerable: true },
          pipeTo: { enumerable: true },
          tee: { enumerable: true },
          values: { enumerable: true },
          locked: { enumerable: true }
        });
        if (typeof SymbolPolyfill.toStringTag === "symbol") {
          Object.defineProperty(ReadableStream2.prototype, SymbolPolyfill.toStringTag, {
            value: "ReadableStream",
            configurable: true
          });
        }
        if (typeof SymbolPolyfill.asyncIterator === "symbol") {
          Object.defineProperty(ReadableStream2.prototype, SymbolPolyfill.asyncIterator, {
            value: ReadableStream2.prototype.values,
            writable: true,
            configurable: true
          });
        }
        function CreateReadableStream(startAlgorithm, pullAlgorithm, cancelAlgorithm, highWaterMark = 1, sizeAlgorithm = () => 1) {
          const stream = Object.create(ReadableStream2.prototype);
          InitializeReadableStream(stream);
          const controller = Object.create(ReadableStreamDefaultController.prototype);
          SetUpReadableStreamDefaultController(stream, controller, startAlgorithm, pullAlgorithm, cancelAlgorithm, highWaterMark, sizeAlgorithm);
          return stream;
        }
        function CreateReadableByteStream(startAlgorithm, pullAlgorithm, cancelAlgorithm) {
          const stream = Object.create(ReadableStream2.prototype);
          InitializeReadableStream(stream);
          const controller = Object.create(ReadableByteStreamController.prototype);
          SetUpReadableByteStreamController(stream, controller, startAlgorithm, pullAlgorithm, cancelAlgorithm, 0, void 0);
          return stream;
        }
        function InitializeReadableStream(stream) {
          stream._state = "readable";
          stream._reader = void 0;
          stream._storedError = void 0;
          stream._disturbed = false;
        }
        function IsReadableStream(x) {
          if (!typeIsObject(x)) {
            return false;
          }
          if (!Object.prototype.hasOwnProperty.call(x, "_readableStreamController")) {
            return false;
          }
          return x instanceof ReadableStream2;
        }
        function IsReadableStreamLocked(stream) {
          if (stream._reader === void 0) {
            return false;
          }
          return true;
        }
        function ReadableStreamCancel(stream, reason) {
          stream._disturbed = true;
          if (stream._state === "closed") {
            return promiseResolvedWith(void 0);
          }
          if (stream._state === "errored") {
            return promiseRejectedWith(stream._storedError);
          }
          ReadableStreamClose(stream);
          const reader = stream._reader;
          if (reader !== void 0 && IsReadableStreamBYOBReader(reader)) {
            reader._readIntoRequests.forEach((readIntoRequest) => {
              readIntoRequest._closeSteps(void 0);
            });
            reader._readIntoRequests = new SimpleQueue();
          }
          const sourceCancelPromise = stream._readableStreamController[CancelSteps](reason);
          return transformPromiseWith(sourceCancelPromise, noop2);
        }
        function ReadableStreamClose(stream) {
          stream._state = "closed";
          const reader = stream._reader;
          if (reader === void 0) {
            return;
          }
          defaultReaderClosedPromiseResolve(reader);
          if (IsReadableStreamDefaultReader(reader)) {
            reader._readRequests.forEach((readRequest) => {
              readRequest._closeSteps();
            });
            reader._readRequests = new SimpleQueue();
          }
        }
        function ReadableStreamError(stream, e) {
          stream._state = "errored";
          stream._storedError = e;
          const reader = stream._reader;
          if (reader === void 0) {
            return;
          }
          defaultReaderClosedPromiseReject(reader, e);
          if (IsReadableStreamDefaultReader(reader)) {
            reader._readRequests.forEach((readRequest) => {
              readRequest._errorSteps(e);
            });
            reader._readRequests = new SimpleQueue();
          } else {
            reader._readIntoRequests.forEach((readIntoRequest) => {
              readIntoRequest._errorSteps(e);
            });
            reader._readIntoRequests = new SimpleQueue();
          }
        }
        function streamBrandCheckException$1(name) {
          return new TypeError(`ReadableStream.prototype.${name} can only be used on a ReadableStream`);
        }
        function convertQueuingStrategyInit(init2, context) {
          assertDictionary(init2, context);
          const highWaterMark = init2 === null || init2 === void 0 ? void 0 : init2.highWaterMark;
          assertRequiredField(highWaterMark, "highWaterMark", "QueuingStrategyInit");
          return {
            highWaterMark: convertUnrestrictedDouble(highWaterMark)
          };
        }
        const byteLengthSizeFunction = (chunk) => {
          return chunk.byteLength;
        };
        Object.defineProperty(byteLengthSizeFunction, "name", {
          value: "size",
          configurable: true
        });
        class ByteLengthQueuingStrategy {
          constructor(options2) {
            assertRequiredArgument(options2, 1, "ByteLengthQueuingStrategy");
            options2 = convertQueuingStrategyInit(options2, "First parameter");
            this._byteLengthQueuingStrategyHighWaterMark = options2.highWaterMark;
          }
          get highWaterMark() {
            if (!IsByteLengthQueuingStrategy(this)) {
              throw byteLengthBrandCheckException("highWaterMark");
            }
            return this._byteLengthQueuingStrategyHighWaterMark;
          }
          get size() {
            if (!IsByteLengthQueuingStrategy(this)) {
              throw byteLengthBrandCheckException("size");
            }
            return byteLengthSizeFunction;
          }
        }
        Object.defineProperties(ByteLengthQueuingStrategy.prototype, {
          highWaterMark: { enumerable: true },
          size: { enumerable: true }
        });
        if (typeof SymbolPolyfill.toStringTag === "symbol") {
          Object.defineProperty(ByteLengthQueuingStrategy.prototype, SymbolPolyfill.toStringTag, {
            value: "ByteLengthQueuingStrategy",
            configurable: true
          });
        }
        function byteLengthBrandCheckException(name) {
          return new TypeError(`ByteLengthQueuingStrategy.prototype.${name} can only be used on a ByteLengthQueuingStrategy`);
        }
        function IsByteLengthQueuingStrategy(x) {
          if (!typeIsObject(x)) {
            return false;
          }
          if (!Object.prototype.hasOwnProperty.call(x, "_byteLengthQueuingStrategyHighWaterMark")) {
            return false;
          }
          return x instanceof ByteLengthQueuingStrategy;
        }
        const countSizeFunction = () => {
          return 1;
        };
        Object.defineProperty(countSizeFunction, "name", {
          value: "size",
          configurable: true
        });
        class CountQueuingStrategy {
          constructor(options2) {
            assertRequiredArgument(options2, 1, "CountQueuingStrategy");
            options2 = convertQueuingStrategyInit(options2, "First parameter");
            this._countQueuingStrategyHighWaterMark = options2.highWaterMark;
          }
          get highWaterMark() {
            if (!IsCountQueuingStrategy(this)) {
              throw countBrandCheckException("highWaterMark");
            }
            return this._countQueuingStrategyHighWaterMark;
          }
          get size() {
            if (!IsCountQueuingStrategy(this)) {
              throw countBrandCheckException("size");
            }
            return countSizeFunction;
          }
        }
        Object.defineProperties(CountQueuingStrategy.prototype, {
          highWaterMark: { enumerable: true },
          size: { enumerable: true }
        });
        if (typeof SymbolPolyfill.toStringTag === "symbol") {
          Object.defineProperty(CountQueuingStrategy.prototype, SymbolPolyfill.toStringTag, {
            value: "CountQueuingStrategy",
            configurable: true
          });
        }
        function countBrandCheckException(name) {
          return new TypeError(`CountQueuingStrategy.prototype.${name} can only be used on a CountQueuingStrategy`);
        }
        function IsCountQueuingStrategy(x) {
          if (!typeIsObject(x)) {
            return false;
          }
          if (!Object.prototype.hasOwnProperty.call(x, "_countQueuingStrategyHighWaterMark")) {
            return false;
          }
          return x instanceof CountQueuingStrategy;
        }
        function convertTransformer(original, context) {
          assertDictionary(original, context);
          const flush = original === null || original === void 0 ? void 0 : original.flush;
          const readableType = original === null || original === void 0 ? void 0 : original.readableType;
          const start = original === null || original === void 0 ? void 0 : original.start;
          const transform = original === null || original === void 0 ? void 0 : original.transform;
          const writableType = original === null || original === void 0 ? void 0 : original.writableType;
          return {
            flush: flush === void 0 ? void 0 : convertTransformerFlushCallback(flush, original, `${context} has member 'flush' that`),
            readableType,
            start: start === void 0 ? void 0 : convertTransformerStartCallback(start, original, `${context} has member 'start' that`),
            transform: transform === void 0 ? void 0 : convertTransformerTransformCallback(transform, original, `${context} has member 'transform' that`),
            writableType
          };
        }
        function convertTransformerFlushCallback(fn, original, context) {
          assertFunction(fn, context);
          return (controller) => promiseCall(fn, original, [controller]);
        }
        function convertTransformerStartCallback(fn, original, context) {
          assertFunction(fn, context);
          return (controller) => reflectCall(fn, original, [controller]);
        }
        function convertTransformerTransformCallback(fn, original, context) {
          assertFunction(fn, context);
          return (chunk, controller) => promiseCall(fn, original, [chunk, controller]);
        }
        class TransformStream {
          constructor(rawTransformer = {}, rawWritableStrategy = {}, rawReadableStrategy = {}) {
            if (rawTransformer === void 0) {
              rawTransformer = null;
            }
            const writableStrategy = convertQueuingStrategy(rawWritableStrategy, "Second parameter");
            const readableStrategy = convertQueuingStrategy(rawReadableStrategy, "Third parameter");
            const transformer = convertTransformer(rawTransformer, "First parameter");
            if (transformer.readableType !== void 0) {
              throw new RangeError("Invalid readableType specified");
            }
            if (transformer.writableType !== void 0) {
              throw new RangeError("Invalid writableType specified");
            }
            const readableHighWaterMark = ExtractHighWaterMark(readableStrategy, 0);
            const readableSizeAlgorithm = ExtractSizeAlgorithm(readableStrategy);
            const writableHighWaterMark = ExtractHighWaterMark(writableStrategy, 1);
            const writableSizeAlgorithm = ExtractSizeAlgorithm(writableStrategy);
            let startPromise_resolve;
            const startPromise = newPromise((resolve2) => {
              startPromise_resolve = resolve2;
            });
            InitializeTransformStream(this, startPromise, writableHighWaterMark, writableSizeAlgorithm, readableHighWaterMark, readableSizeAlgorithm);
            SetUpTransformStreamDefaultControllerFromTransformer(this, transformer);
            if (transformer.start !== void 0) {
              startPromise_resolve(transformer.start(this._transformStreamController));
            } else {
              startPromise_resolve(void 0);
            }
          }
          get readable() {
            if (!IsTransformStream(this)) {
              throw streamBrandCheckException("readable");
            }
            return this._readable;
          }
          get writable() {
            if (!IsTransformStream(this)) {
              throw streamBrandCheckException("writable");
            }
            return this._writable;
          }
        }
        Object.defineProperties(TransformStream.prototype, {
          readable: { enumerable: true },
          writable: { enumerable: true }
        });
        if (typeof SymbolPolyfill.toStringTag === "symbol") {
          Object.defineProperty(TransformStream.prototype, SymbolPolyfill.toStringTag, {
            value: "TransformStream",
            configurable: true
          });
        }
        function InitializeTransformStream(stream, startPromise, writableHighWaterMark, writableSizeAlgorithm, readableHighWaterMark, readableSizeAlgorithm) {
          function startAlgorithm() {
            return startPromise;
          }
          function writeAlgorithm(chunk) {
            return TransformStreamDefaultSinkWriteAlgorithm(stream, chunk);
          }
          function abortAlgorithm(reason) {
            return TransformStreamDefaultSinkAbortAlgorithm(stream, reason);
          }
          function closeAlgorithm() {
            return TransformStreamDefaultSinkCloseAlgorithm(stream);
          }
          stream._writable = CreateWritableStream(startAlgorithm, writeAlgorithm, closeAlgorithm, abortAlgorithm, writableHighWaterMark, writableSizeAlgorithm);
          function pullAlgorithm() {
            return TransformStreamDefaultSourcePullAlgorithm(stream);
          }
          function cancelAlgorithm(reason) {
            TransformStreamErrorWritableAndUnblockWrite(stream, reason);
            return promiseResolvedWith(void 0);
          }
          stream._readable = CreateReadableStream(startAlgorithm, pullAlgorithm, cancelAlgorithm, readableHighWaterMark, readableSizeAlgorithm);
          stream._backpressure = void 0;
          stream._backpressureChangePromise = void 0;
          stream._backpressureChangePromise_resolve = void 0;
          TransformStreamSetBackpressure(stream, true);
          stream._transformStreamController = void 0;
        }
        function IsTransformStream(x) {
          if (!typeIsObject(x)) {
            return false;
          }
          if (!Object.prototype.hasOwnProperty.call(x, "_transformStreamController")) {
            return false;
          }
          return x instanceof TransformStream;
        }
        function TransformStreamError(stream, e) {
          ReadableStreamDefaultControllerError(stream._readable._readableStreamController, e);
          TransformStreamErrorWritableAndUnblockWrite(stream, e);
        }
        function TransformStreamErrorWritableAndUnblockWrite(stream, e) {
          TransformStreamDefaultControllerClearAlgorithms(stream._transformStreamController);
          WritableStreamDefaultControllerErrorIfNeeded(stream._writable._writableStreamController, e);
          if (stream._backpressure) {
            TransformStreamSetBackpressure(stream, false);
          }
        }
        function TransformStreamSetBackpressure(stream, backpressure) {
          if (stream._backpressureChangePromise !== void 0) {
            stream._backpressureChangePromise_resolve();
          }
          stream._backpressureChangePromise = newPromise((resolve2) => {
            stream._backpressureChangePromise_resolve = resolve2;
          });
          stream._backpressure = backpressure;
        }
        class TransformStreamDefaultController {
          constructor() {
            throw new TypeError("Illegal constructor");
          }
          get desiredSize() {
            if (!IsTransformStreamDefaultController(this)) {
              throw defaultControllerBrandCheckException("desiredSize");
            }
            const readableController = this._controlledTransformStream._readable._readableStreamController;
            return ReadableStreamDefaultControllerGetDesiredSize(readableController);
          }
          enqueue(chunk = void 0) {
            if (!IsTransformStreamDefaultController(this)) {
              throw defaultControllerBrandCheckException("enqueue");
            }
            TransformStreamDefaultControllerEnqueue(this, chunk);
          }
          error(reason = void 0) {
            if (!IsTransformStreamDefaultController(this)) {
              throw defaultControllerBrandCheckException("error");
            }
            TransformStreamDefaultControllerError(this, reason);
          }
          terminate() {
            if (!IsTransformStreamDefaultController(this)) {
              throw defaultControllerBrandCheckException("terminate");
            }
            TransformStreamDefaultControllerTerminate(this);
          }
        }
        Object.defineProperties(TransformStreamDefaultController.prototype, {
          enqueue: { enumerable: true },
          error: { enumerable: true },
          terminate: { enumerable: true },
          desiredSize: { enumerable: true }
        });
        if (typeof SymbolPolyfill.toStringTag === "symbol") {
          Object.defineProperty(TransformStreamDefaultController.prototype, SymbolPolyfill.toStringTag, {
            value: "TransformStreamDefaultController",
            configurable: true
          });
        }
        function IsTransformStreamDefaultController(x) {
          if (!typeIsObject(x)) {
            return false;
          }
          if (!Object.prototype.hasOwnProperty.call(x, "_controlledTransformStream")) {
            return false;
          }
          return x instanceof TransformStreamDefaultController;
        }
        function SetUpTransformStreamDefaultController(stream, controller, transformAlgorithm, flushAlgorithm) {
          controller._controlledTransformStream = stream;
          stream._transformStreamController = controller;
          controller._transformAlgorithm = transformAlgorithm;
          controller._flushAlgorithm = flushAlgorithm;
        }
        function SetUpTransformStreamDefaultControllerFromTransformer(stream, transformer) {
          const controller = Object.create(TransformStreamDefaultController.prototype);
          let transformAlgorithm = (chunk) => {
            try {
              TransformStreamDefaultControllerEnqueue(controller, chunk);
              return promiseResolvedWith(void 0);
            } catch (transformResultE) {
              return promiseRejectedWith(transformResultE);
            }
          };
          let flushAlgorithm = () => promiseResolvedWith(void 0);
          if (transformer.transform !== void 0) {
            transformAlgorithm = (chunk) => transformer.transform(chunk, controller);
          }
          if (transformer.flush !== void 0) {
            flushAlgorithm = () => transformer.flush(controller);
          }
          SetUpTransformStreamDefaultController(stream, controller, transformAlgorithm, flushAlgorithm);
        }
        function TransformStreamDefaultControllerClearAlgorithms(controller) {
          controller._transformAlgorithm = void 0;
          controller._flushAlgorithm = void 0;
        }
        function TransformStreamDefaultControllerEnqueue(controller, chunk) {
          const stream = controller._controlledTransformStream;
          const readableController = stream._readable._readableStreamController;
          if (!ReadableStreamDefaultControllerCanCloseOrEnqueue(readableController)) {
            throw new TypeError("Readable side is not in a state that permits enqueue");
          }
          try {
            ReadableStreamDefaultControllerEnqueue(readableController, chunk);
          } catch (e) {
            TransformStreamErrorWritableAndUnblockWrite(stream, e);
            throw stream._readable._storedError;
          }
          const backpressure = ReadableStreamDefaultControllerHasBackpressure(readableController);
          if (backpressure !== stream._backpressure) {
            TransformStreamSetBackpressure(stream, true);
          }
        }
        function TransformStreamDefaultControllerError(controller, e) {
          TransformStreamError(controller._controlledTransformStream, e);
        }
        function TransformStreamDefaultControllerPerformTransform(controller, chunk) {
          const transformPromise = controller._transformAlgorithm(chunk);
          return transformPromiseWith(transformPromise, void 0, (r) => {
            TransformStreamError(controller._controlledTransformStream, r);
            throw r;
          });
        }
        function TransformStreamDefaultControllerTerminate(controller) {
          const stream = controller._controlledTransformStream;
          const readableController = stream._readable._readableStreamController;
          ReadableStreamDefaultControllerClose(readableController);
          const error2 = new TypeError("TransformStream terminated");
          TransformStreamErrorWritableAndUnblockWrite(stream, error2);
        }
        function TransformStreamDefaultSinkWriteAlgorithm(stream, chunk) {
          const controller = stream._transformStreamController;
          if (stream._backpressure) {
            const backpressureChangePromise = stream._backpressureChangePromise;
            return transformPromiseWith(backpressureChangePromise, () => {
              const writable2 = stream._writable;
              const state = writable2._state;
              if (state === "erroring") {
                throw writable2._storedError;
              }
              return TransformStreamDefaultControllerPerformTransform(controller, chunk);
            });
          }
          return TransformStreamDefaultControllerPerformTransform(controller, chunk);
        }
        function TransformStreamDefaultSinkAbortAlgorithm(stream, reason) {
          TransformStreamError(stream, reason);
          return promiseResolvedWith(void 0);
        }
        function TransformStreamDefaultSinkCloseAlgorithm(stream) {
          const readable = stream._readable;
          const controller = stream._transformStreamController;
          const flushPromise = controller._flushAlgorithm();
          TransformStreamDefaultControllerClearAlgorithms(controller);
          return transformPromiseWith(flushPromise, () => {
            if (readable._state === "errored") {
              throw readable._storedError;
            }
            ReadableStreamDefaultControllerClose(readable._readableStreamController);
          }, (r) => {
            TransformStreamError(stream, r);
            throw readable._storedError;
          });
        }
        function TransformStreamDefaultSourcePullAlgorithm(stream) {
          TransformStreamSetBackpressure(stream, false);
          return stream._backpressureChangePromise;
        }
        function defaultControllerBrandCheckException(name) {
          return new TypeError(`TransformStreamDefaultController.prototype.${name} can only be used on a TransformStreamDefaultController`);
        }
        function streamBrandCheckException(name) {
          return new TypeError(`TransformStream.prototype.${name} can only be used on a TransformStream`);
        }
        exports2.ByteLengthQueuingStrategy = ByteLengthQueuingStrategy;
        exports2.CountQueuingStrategy = CountQueuingStrategy;
        exports2.ReadableByteStreamController = ReadableByteStreamController;
        exports2.ReadableStream = ReadableStream2;
        exports2.ReadableStreamBYOBReader = ReadableStreamBYOBReader;
        exports2.ReadableStreamBYOBRequest = ReadableStreamBYOBRequest;
        exports2.ReadableStreamDefaultController = ReadableStreamDefaultController;
        exports2.ReadableStreamDefaultReader = ReadableStreamDefaultReader;
        exports2.TransformStream = TransformStream;
        exports2.TransformStreamDefaultController = TransformStreamDefaultController;
        exports2.WritableStream = WritableStream;
        exports2.WritableStreamDefaultController = WritableStreamDefaultController;
        exports2.WritableStreamDefaultWriter = WritableStreamDefaultWriter;
        Object.defineProperty(exports2, "__esModule", { value: true });
      });
    })(ponyfill_es2018, ponyfill_es2018.exports);
    POOL_SIZE$1 = 65536;
    if (!globalThis.ReadableStream) {
      try {
        const process2 = require("node:process");
        const { emitWarning } = process2;
        try {
          process2.emitWarning = () => {
          };
          Object.assign(globalThis, require("node:stream/web"));
          process2.emitWarning = emitWarning;
        } catch (error2) {
          process2.emitWarning = emitWarning;
          throw error2;
        }
      } catch (error2) {
        Object.assign(globalThis, ponyfill_es2018.exports);
      }
    }
    try {
      const { Blob: Blob4 } = require("buffer");
      if (Blob4 && !Blob4.prototype.stream) {
        Blob4.prototype.stream = function name(params) {
          let position = 0;
          const blob = this;
          return new ReadableStream({
            type: "bytes",
            async pull(ctrl) {
              const chunk = blob.slice(position, Math.min(blob.size, position + POOL_SIZE$1));
              const buffer = await chunk.arrayBuffer();
              position += buffer.byteLength;
              ctrl.enqueue(new Uint8Array(buffer));
              if (position === blob.size) {
                ctrl.close();
              }
            }
          });
        };
      }
    } catch (error2) {
    }
    POOL_SIZE = 65536;
    _Blob = class Blob2 {
      #parts = [];
      #type = "";
      #size = 0;
      constructor(blobParts = [], options2 = {}) {
        if (typeof blobParts !== "object" || blobParts === null) {
          throw new TypeError("Failed to construct 'Blob': The provided value cannot be converted to a sequence.");
        }
        if (typeof blobParts[Symbol.iterator] !== "function") {
          throw new TypeError("Failed to construct 'Blob': The object must have a callable @@iterator property.");
        }
        if (typeof options2 !== "object" && typeof options2 !== "function") {
          throw new TypeError("Failed to construct 'Blob': parameter 2 cannot convert to dictionary.");
        }
        if (options2 === null)
          options2 = {};
        const encoder = new TextEncoder();
        for (const element of blobParts) {
          let part;
          if (ArrayBuffer.isView(element)) {
            part = new Uint8Array(element.buffer.slice(element.byteOffset, element.byteOffset + element.byteLength));
          } else if (element instanceof ArrayBuffer) {
            part = new Uint8Array(element.slice(0));
          } else if (element instanceof Blob2) {
            part = element;
          } else {
            part = encoder.encode(element);
          }
          this.#size += ArrayBuffer.isView(part) ? part.byteLength : part.size;
          this.#parts.push(part);
        }
        const type = options2.type === void 0 ? "" : String(options2.type);
        this.#type = /^[\x20-\x7E]*$/.test(type) ? type : "";
      }
      get size() {
        return this.#size;
      }
      get type() {
        return this.#type;
      }
      async text() {
        const decoder = new TextDecoder();
        let str = "";
        for await (const part of toIterator(this.#parts, false)) {
          str += decoder.decode(part, { stream: true });
        }
        str += decoder.decode();
        return str;
      }
      async arrayBuffer() {
        const data = new Uint8Array(this.size);
        let offset = 0;
        for await (const chunk of toIterator(this.#parts, false)) {
          data.set(chunk, offset);
          offset += chunk.length;
        }
        return data.buffer;
      }
      stream() {
        const it = toIterator(this.#parts, true);
        return new globalThis.ReadableStream({
          type: "bytes",
          async pull(ctrl) {
            const chunk = await it.next();
            chunk.done ? ctrl.close() : ctrl.enqueue(chunk.value);
          },
          async cancel() {
            await it.return();
          }
        });
      }
      slice(start = 0, end = this.size, type = "") {
        const { size } = this;
        let relativeStart = start < 0 ? Math.max(size + start, 0) : Math.min(start, size);
        let relativeEnd = end < 0 ? Math.max(size + end, 0) : Math.min(end, size);
        const span = Math.max(relativeEnd - relativeStart, 0);
        const parts = this.#parts;
        const blobParts = [];
        let added = 0;
        for (const part of parts) {
          if (added >= span) {
            break;
          }
          const size2 = ArrayBuffer.isView(part) ? part.byteLength : part.size;
          if (relativeStart && size2 <= relativeStart) {
            relativeStart -= size2;
            relativeEnd -= size2;
          } else {
            let chunk;
            if (ArrayBuffer.isView(part)) {
              chunk = part.subarray(relativeStart, Math.min(size2, relativeEnd));
              added += chunk.byteLength;
            } else {
              chunk = part.slice(relativeStart, Math.min(size2, relativeEnd));
              added += chunk.size;
            }
            relativeEnd -= size2;
            blobParts.push(chunk);
            relativeStart = 0;
          }
        }
        const blob = new Blob2([], { type: String(type).toLowerCase() });
        blob.#size = span;
        blob.#parts = blobParts;
        return blob;
      }
      get [Symbol.toStringTag]() {
        return "Blob";
      }
      static [Symbol.hasInstance](object) {
        return object && typeof object === "object" && typeof object.constructor === "function" && (typeof object.stream === "function" || typeof object.arrayBuffer === "function") && /^(Blob|File)$/.test(object[Symbol.toStringTag]);
      }
    };
    Object.defineProperties(_Blob.prototype, {
      size: { enumerable: true },
      type: { enumerable: true },
      slice: { enumerable: true }
    });
    Blob3 = _Blob;
    Blob$1 = Blob3;
    FetchBaseError = class extends Error {
      constructor(message, type) {
        super(message);
        Error.captureStackTrace(this, this.constructor);
        this.type = type;
      }
      get name() {
        return this.constructor.name;
      }
      get [Symbol.toStringTag]() {
        return this.constructor.name;
      }
    };
    FetchError = class extends FetchBaseError {
      constructor(message, type, systemError) {
        super(message, type);
        if (systemError) {
          this.code = this.errno = systemError.code;
          this.erroredSysCall = systemError.syscall;
        }
      }
    };
    NAME = Symbol.toStringTag;
    isURLSearchParameters = (object) => {
      return typeof object === "object" && typeof object.append === "function" && typeof object.delete === "function" && typeof object.get === "function" && typeof object.getAll === "function" && typeof object.has === "function" && typeof object.set === "function" && typeof object.sort === "function" && object[NAME] === "URLSearchParams";
    };
    isBlob = (object) => {
      return typeof object === "object" && typeof object.arrayBuffer === "function" && typeof object.type === "string" && typeof object.stream === "function" && typeof object.constructor === "function" && /^(Blob|File)$/.test(object[NAME]);
    };
    isAbortSignal = (object) => {
      return typeof object === "object" && (object[NAME] === "AbortSignal" || object[NAME] === "EventTarget");
    };
    carriage = "\r\n";
    dashes = "-".repeat(2);
    carriageLength = Buffer.byteLength(carriage);
    getFooter = (boundary) => `${dashes}${boundary}${dashes}${carriage.repeat(2)}`;
    getBoundary = () => (0, import_crypto.randomBytes)(8).toString("hex");
    INTERNALS$2 = Symbol("Body internals");
    Body = class {
      constructor(body, {
        size = 0
      } = {}) {
        let boundary = null;
        if (body === null) {
          body = null;
        } else if (isURLSearchParameters(body)) {
          body = Buffer.from(body.toString());
        } else if (isBlob(body))
          ;
        else if (Buffer.isBuffer(body))
          ;
        else if (import_util.types.isAnyArrayBuffer(body)) {
          body = Buffer.from(body);
        } else if (ArrayBuffer.isView(body)) {
          body = Buffer.from(body.buffer, body.byteOffset, body.byteLength);
        } else if (body instanceof import_stream.default)
          ;
        else if (isFormData(body)) {
          boundary = `NodeFetchFormDataBoundary${getBoundary()}`;
          body = import_stream.default.Readable.from(formDataIterator(body, boundary));
        } else {
          body = Buffer.from(String(body));
        }
        this[INTERNALS$2] = {
          body,
          boundary,
          disturbed: false,
          error: null
        };
        this.size = size;
        if (body instanceof import_stream.default) {
          body.on("error", (error_) => {
            const error2 = error_ instanceof FetchBaseError ? error_ : new FetchError(`Invalid response body while trying to fetch ${this.url}: ${error_.message}`, "system", error_);
            this[INTERNALS$2].error = error2;
          });
        }
      }
      get body() {
        return this[INTERNALS$2].body;
      }
      get bodyUsed() {
        return this[INTERNALS$2].disturbed;
      }
      async arrayBuffer() {
        const { buffer, byteOffset, byteLength } = await consumeBody(this);
        return buffer.slice(byteOffset, byteOffset + byteLength);
      }
      async blob() {
        const ct = this.headers && this.headers.get("content-type") || this[INTERNALS$2].body && this[INTERNALS$2].body.type || "";
        const buf = await this.buffer();
        return new Blob$1([buf], {
          type: ct
        });
      }
      async json() {
        const buffer = await consumeBody(this);
        return JSON.parse(buffer.toString());
      }
      async text() {
        const buffer = await consumeBody(this);
        return buffer.toString();
      }
      buffer() {
        return consumeBody(this);
      }
    };
    Object.defineProperties(Body.prototype, {
      body: { enumerable: true },
      bodyUsed: { enumerable: true },
      arrayBuffer: { enumerable: true },
      blob: { enumerable: true },
      json: { enumerable: true },
      text: { enumerable: true }
    });
    clone = (instance, highWaterMark) => {
      let p1;
      let p2;
      let { body } = instance;
      if (instance.bodyUsed) {
        throw new Error("cannot clone body after it is used");
      }
      if (body instanceof import_stream.default && typeof body.getBoundary !== "function") {
        p1 = new import_stream.PassThrough({ highWaterMark });
        p2 = new import_stream.PassThrough({ highWaterMark });
        body.pipe(p1);
        body.pipe(p2);
        instance[INTERNALS$2].body = p1;
        body = p2;
      }
      return body;
    };
    extractContentType = (body, request) => {
      if (body === null) {
        return null;
      }
      if (typeof body === "string") {
        return "text/plain;charset=UTF-8";
      }
      if (isURLSearchParameters(body)) {
        return "application/x-www-form-urlencoded;charset=UTF-8";
      }
      if (isBlob(body)) {
        return body.type || null;
      }
      if (Buffer.isBuffer(body) || import_util.types.isAnyArrayBuffer(body) || ArrayBuffer.isView(body)) {
        return null;
      }
      if (body && typeof body.getBoundary === "function") {
        return `multipart/form-data;boundary=${body.getBoundary()}`;
      }
      if (isFormData(body)) {
        return `multipart/form-data; boundary=${request[INTERNALS$2].boundary}`;
      }
      if (body instanceof import_stream.default) {
        return null;
      }
      return "text/plain;charset=UTF-8";
    };
    getTotalBytes = (request) => {
      const { body } = request;
      if (body === null) {
        return 0;
      }
      if (isBlob(body)) {
        return body.size;
      }
      if (Buffer.isBuffer(body)) {
        return body.length;
      }
      if (body && typeof body.getLengthSync === "function") {
        return body.hasKnownLength && body.hasKnownLength() ? body.getLengthSync() : null;
      }
      if (isFormData(body)) {
        return getFormDataLength(request[INTERNALS$2].boundary);
      }
      return null;
    };
    writeToStream = (dest, { body }) => {
      if (body === null) {
        dest.end();
      } else if (isBlob(body)) {
        import_stream.default.Readable.from(body.stream()).pipe(dest);
      } else if (Buffer.isBuffer(body)) {
        dest.write(body);
        dest.end();
      } else {
        body.pipe(dest);
      }
    };
    validateHeaderName = typeof import_http.default.validateHeaderName === "function" ? import_http.default.validateHeaderName : (name) => {
      if (!/^[\^`\-\w!#$%&'*+.|~]+$/.test(name)) {
        const error2 = new TypeError(`Header name must be a valid HTTP token [${name}]`);
        Object.defineProperty(error2, "code", { value: "ERR_INVALID_HTTP_TOKEN" });
        throw error2;
      }
    };
    validateHeaderValue = typeof import_http.default.validateHeaderValue === "function" ? import_http.default.validateHeaderValue : (name, value) => {
      if (/[^\t\u0020-\u007E\u0080-\u00FF]/.test(value)) {
        const error2 = new TypeError(`Invalid character in header content ["${name}"]`);
        Object.defineProperty(error2, "code", { value: "ERR_INVALID_CHAR" });
        throw error2;
      }
    };
    Headers = class extends URLSearchParams {
      constructor(init2) {
        let result = [];
        if (init2 instanceof Headers) {
          const raw = init2.raw();
          for (const [name, values] of Object.entries(raw)) {
            result.push(...values.map((value) => [name, value]));
          }
        } else if (init2 == null)
          ;
        else if (typeof init2 === "object" && !import_util.types.isBoxedPrimitive(init2)) {
          const method = init2[Symbol.iterator];
          if (method == null) {
            result.push(...Object.entries(init2));
          } else {
            if (typeof method !== "function") {
              throw new TypeError("Header pairs must be iterable");
            }
            result = [...init2].map((pair) => {
              if (typeof pair !== "object" || import_util.types.isBoxedPrimitive(pair)) {
                throw new TypeError("Each header pair must be an iterable object");
              }
              return [...pair];
            }).map((pair) => {
              if (pair.length !== 2) {
                throw new TypeError("Each header pair must be a name/value tuple");
              }
              return [...pair];
            });
          }
        } else {
          throw new TypeError("Failed to construct 'Headers': The provided value is not of type '(sequence<sequence<ByteString>> or record<ByteString, ByteString>)");
        }
        result = result.length > 0 ? result.map(([name, value]) => {
          validateHeaderName(name);
          validateHeaderValue(name, String(value));
          return [String(name).toLowerCase(), String(value)];
        }) : void 0;
        super(result);
        return new Proxy(this, {
          get(target, p, receiver) {
            switch (p) {
              case "append":
              case "set":
                return (name, value) => {
                  validateHeaderName(name);
                  validateHeaderValue(name, String(value));
                  return URLSearchParams.prototype[p].call(target, String(name).toLowerCase(), String(value));
                };
              case "delete":
              case "has":
              case "getAll":
                return (name) => {
                  validateHeaderName(name);
                  return URLSearchParams.prototype[p].call(target, String(name).toLowerCase());
                };
              case "keys":
                return () => {
                  target.sort();
                  return new Set(URLSearchParams.prototype.keys.call(target)).keys();
                };
              default:
                return Reflect.get(target, p, receiver);
            }
          }
        });
      }
      get [Symbol.toStringTag]() {
        return this.constructor.name;
      }
      toString() {
        return Object.prototype.toString.call(this);
      }
      get(name) {
        const values = this.getAll(name);
        if (values.length === 0) {
          return null;
        }
        let value = values.join(", ");
        if (/^content-encoding$/i.test(name)) {
          value = value.toLowerCase();
        }
        return value;
      }
      forEach(callback, thisArg = void 0) {
        for (const name of this.keys()) {
          Reflect.apply(callback, thisArg, [this.get(name), name, this]);
        }
      }
      *values() {
        for (const name of this.keys()) {
          yield this.get(name);
        }
      }
      *entries() {
        for (const name of this.keys()) {
          yield [name, this.get(name)];
        }
      }
      [Symbol.iterator]() {
        return this.entries();
      }
      raw() {
        return [...this.keys()].reduce((result, key) => {
          result[key] = this.getAll(key);
          return result;
        }, {});
      }
      [Symbol.for("nodejs.util.inspect.custom")]() {
        return [...this.keys()].reduce((result, key) => {
          const values = this.getAll(key);
          if (key === "host") {
            result[key] = values[0];
          } else {
            result[key] = values.length > 1 ? values : values[0];
          }
          return result;
        }, {});
      }
    };
    Object.defineProperties(Headers.prototype, ["get", "entries", "forEach", "values"].reduce((result, property) => {
      result[property] = { enumerable: true };
      return result;
    }, {}));
    redirectStatus = new Set([301, 302, 303, 307, 308]);
    isRedirect = (code) => {
      return redirectStatus.has(code);
    };
    INTERNALS$1 = Symbol("Response internals");
    Response = class extends Body {
      constructor(body = null, options2 = {}) {
        super(body, options2);
        const status = options2.status != null ? options2.status : 200;
        const headers = new Headers(options2.headers);
        if (body !== null && !headers.has("Content-Type")) {
          const contentType = extractContentType(body);
          if (contentType) {
            headers.append("Content-Type", contentType);
          }
        }
        this[INTERNALS$1] = {
          type: "default",
          url: options2.url,
          status,
          statusText: options2.statusText || "",
          headers,
          counter: options2.counter,
          highWaterMark: options2.highWaterMark
        };
      }
      get type() {
        return this[INTERNALS$1].type;
      }
      get url() {
        return this[INTERNALS$1].url || "";
      }
      get status() {
        return this[INTERNALS$1].status;
      }
      get ok() {
        return this[INTERNALS$1].status >= 200 && this[INTERNALS$1].status < 300;
      }
      get redirected() {
        return this[INTERNALS$1].counter > 0;
      }
      get statusText() {
        return this[INTERNALS$1].statusText;
      }
      get headers() {
        return this[INTERNALS$1].headers;
      }
      get highWaterMark() {
        return this[INTERNALS$1].highWaterMark;
      }
      clone() {
        return new Response(clone(this, this.highWaterMark), {
          type: this.type,
          url: this.url,
          status: this.status,
          statusText: this.statusText,
          headers: this.headers,
          ok: this.ok,
          redirected: this.redirected,
          size: this.size
        });
      }
      static redirect(url, status = 302) {
        if (!isRedirect(status)) {
          throw new RangeError('Failed to execute "redirect" on "response": Invalid status code');
        }
        return new Response(null, {
          headers: {
            location: new URL(url).toString()
          },
          status
        });
      }
      static error() {
        const response = new Response(null, { status: 0, statusText: "" });
        response[INTERNALS$1].type = "error";
        return response;
      }
      get [Symbol.toStringTag]() {
        return "Response";
      }
    };
    Object.defineProperties(Response.prototype, {
      type: { enumerable: true },
      url: { enumerable: true },
      status: { enumerable: true },
      ok: { enumerable: true },
      redirected: { enumerable: true },
      statusText: { enumerable: true },
      headers: { enumerable: true },
      clone: { enumerable: true }
    });
    getSearch = (parsedURL) => {
      if (parsedURL.search) {
        return parsedURL.search;
      }
      const lastOffset = parsedURL.href.length - 1;
      const hash2 = parsedURL.hash || (parsedURL.href[lastOffset] === "#" ? "#" : "");
      return parsedURL.href[lastOffset - hash2.length] === "?" ? "?" : "";
    };
    INTERNALS = Symbol("Request internals");
    isRequest = (object) => {
      return typeof object === "object" && typeof object[INTERNALS] === "object";
    };
    Request = class extends Body {
      constructor(input, init2 = {}) {
        let parsedURL;
        if (isRequest(input)) {
          parsedURL = new URL(input.url);
        } else {
          parsedURL = new URL(input);
          input = {};
        }
        let method = init2.method || input.method || "GET";
        method = method.toUpperCase();
        if ((init2.body != null || isRequest(input)) && input.body !== null && (method === "GET" || method === "HEAD")) {
          throw new TypeError("Request with GET/HEAD method cannot have body");
        }
        const inputBody = init2.body ? init2.body : isRequest(input) && input.body !== null ? clone(input) : null;
        super(inputBody, {
          size: init2.size || input.size || 0
        });
        const headers = new Headers(init2.headers || input.headers || {});
        if (inputBody !== null && !headers.has("Content-Type")) {
          const contentType = extractContentType(inputBody, this);
          if (contentType) {
            headers.append("Content-Type", contentType);
          }
        }
        let signal = isRequest(input) ? input.signal : null;
        if ("signal" in init2) {
          signal = init2.signal;
        }
        if (signal != null && !isAbortSignal(signal)) {
          throw new TypeError("Expected signal to be an instanceof AbortSignal or EventTarget");
        }
        this[INTERNALS] = {
          method,
          redirect: init2.redirect || input.redirect || "follow",
          headers,
          parsedURL,
          signal
        };
        this.follow = init2.follow === void 0 ? input.follow === void 0 ? 20 : input.follow : init2.follow;
        this.compress = init2.compress === void 0 ? input.compress === void 0 ? true : input.compress : init2.compress;
        this.counter = init2.counter || input.counter || 0;
        this.agent = init2.agent || input.agent;
        this.highWaterMark = init2.highWaterMark || input.highWaterMark || 16384;
        this.insecureHTTPParser = init2.insecureHTTPParser || input.insecureHTTPParser || false;
      }
      get method() {
        return this[INTERNALS].method;
      }
      get url() {
        return (0, import_url.format)(this[INTERNALS].parsedURL);
      }
      get headers() {
        return this[INTERNALS].headers;
      }
      get redirect() {
        return this[INTERNALS].redirect;
      }
      get signal() {
        return this[INTERNALS].signal;
      }
      clone() {
        return new Request(this);
      }
      get [Symbol.toStringTag]() {
        return "Request";
      }
    };
    Object.defineProperties(Request.prototype, {
      method: { enumerable: true },
      url: { enumerable: true },
      headers: { enumerable: true },
      redirect: { enumerable: true },
      clone: { enumerable: true },
      signal: { enumerable: true }
    });
    getNodeRequestOptions = (request) => {
      const { parsedURL } = request[INTERNALS];
      const headers = new Headers(request[INTERNALS].headers);
      if (!headers.has("Accept")) {
        headers.set("Accept", "*/*");
      }
      let contentLengthValue = null;
      if (request.body === null && /^(post|put)$/i.test(request.method)) {
        contentLengthValue = "0";
      }
      if (request.body !== null) {
        const totalBytes = getTotalBytes(request);
        if (typeof totalBytes === "number" && !Number.isNaN(totalBytes)) {
          contentLengthValue = String(totalBytes);
        }
      }
      if (contentLengthValue) {
        headers.set("Content-Length", contentLengthValue);
      }
      if (!headers.has("User-Agent")) {
        headers.set("User-Agent", "node-fetch");
      }
      if (request.compress && !headers.has("Accept-Encoding")) {
        headers.set("Accept-Encoding", "gzip,deflate,br");
      }
      let { agent } = request;
      if (typeof agent === "function") {
        agent = agent(parsedURL);
      }
      if (!headers.has("Connection") && !agent) {
        headers.set("Connection", "close");
      }
      const search = getSearch(parsedURL);
      const requestOptions = {
        path: parsedURL.pathname + search,
        pathname: parsedURL.pathname,
        hostname: parsedURL.hostname,
        protocol: parsedURL.protocol,
        port: parsedURL.port,
        hash: parsedURL.hash,
        search: parsedURL.search,
        query: parsedURL.query,
        href: parsedURL.href,
        method: request.method,
        headers: headers[Symbol.for("nodejs.util.inspect.custom")](),
        insecureHTTPParser: request.insecureHTTPParser,
        agent
      };
      return requestOptions;
    };
    AbortError = class extends FetchBaseError {
      constructor(message, type = "aborted") {
        super(message, type);
      }
    };
    supportedSchemas = new Set(["data:", "http:", "https:"]);
  }
});

// node_modules/@sveltejs/adapter-vercel/files/shims.js
var init_shims = __esm({
  "node_modules/@sveltejs/adapter-vercel/files/shims.js"() {
    init_install_fetch();
  }
});

// node_modules/tsparticles/pjs.js
var require_pjs = __commonJS({
  "node_modules/tsparticles/pjs.js"(exports) {
    init_shims();
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.initPjs = void 0;
    var initPjs = (main) => {
      const particlesJS = (tagId, options2) => {
        return main.load(tagId, options2);
      };
      particlesJS.load = (tagId, pathConfigJson, callback) => {
        main.loadJSON(tagId, pathConfigJson).then((container) => {
          if (container) {
            callback(container);
          }
        }).catch(() => {
          callback(void 0);
        });
      };
      particlesJS.setOnClickHandler = (callback) => {
        main.setOnClickHandler(callback);
      };
      const pJSDom = main.dom();
      return { particlesJS, pJSDom };
    };
    exports.initPjs = initPjs;
  }
});

// node_modules/tsparticles/Enums/Directions/MoveDirection.js
var require_MoveDirection = __commonJS({
  "node_modules/tsparticles/Enums/Directions/MoveDirection.js"(exports) {
    init_shims();
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.MoveDirection = void 0;
    var MoveDirection;
    (function(MoveDirection2) {
      MoveDirection2["bottom"] = "bottom";
      MoveDirection2["bottomLeft"] = "bottom-left";
      MoveDirection2["bottomRight"] = "bottom-right";
      MoveDirection2["left"] = "left";
      MoveDirection2["none"] = "none";
      MoveDirection2["right"] = "right";
      MoveDirection2["top"] = "top";
      MoveDirection2["topLeft"] = "top-left";
      MoveDirection2["topRight"] = "top-right";
    })(MoveDirection = exports.MoveDirection || (exports.MoveDirection = {}));
  }
});

// node_modules/tsparticles/Enums/Directions/RotateDirection.js
var require_RotateDirection = __commonJS({
  "node_modules/tsparticles/Enums/Directions/RotateDirection.js"(exports) {
    init_shims();
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.RotateDirection = void 0;
    var RotateDirection;
    (function(RotateDirection2) {
      RotateDirection2["clockwise"] = "clockwise";
      RotateDirection2["counterClockwise"] = "counter-clockwise";
      RotateDirection2["random"] = "random";
    })(RotateDirection = exports.RotateDirection || (exports.RotateDirection = {}));
  }
});

// node_modules/tsparticles/Enums/Directions/OutModeDirection.js
var require_OutModeDirection = __commonJS({
  "node_modules/tsparticles/Enums/Directions/OutModeDirection.js"(exports) {
    init_shims();
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.OutModeDirection = void 0;
    var OutModeDirection;
    (function(OutModeDirection2) {
      OutModeDirection2["bottom"] = "bottom";
      OutModeDirection2["left"] = "left";
      OutModeDirection2["right"] = "right";
      OutModeDirection2["top"] = "top";
    })(OutModeDirection = exports.OutModeDirection || (exports.OutModeDirection = {}));
  }
});

// node_modules/tsparticles/Enums/Directions/TiltDirection.js
var require_TiltDirection = __commonJS({
  "node_modules/tsparticles/Enums/Directions/TiltDirection.js"(exports) {
    init_shims();
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.TiltDirection = void 0;
    var TiltDirection;
    (function(TiltDirection2) {
      TiltDirection2["clockwise"] = "clockwise";
      TiltDirection2["counterClockwise"] = "counter-clockwise";
      TiltDirection2["random"] = "random";
    })(TiltDirection = exports.TiltDirection || (exports.TiltDirection = {}));
  }
});

// node_modules/tsparticles/Enums/Directions/index.js
var require_Directions = __commonJS({
  "node_modules/tsparticles/Enums/Directions/index.js"(exports) {
    init_shims();
    "use strict";
    var __createBinding = exports && exports.__createBinding || (Object.create ? function(o, m, k, k2) {
      if (k2 === void 0)
        k2 = k;
      Object.defineProperty(o, k2, { enumerable: true, get: function() {
        return m[k];
      } });
    } : function(o, m, k, k2) {
      if (k2 === void 0)
        k2 = k;
      o[k2] = m[k];
    });
    var __exportStar = exports && exports.__exportStar || function(m, exports2) {
      for (var p in m)
        if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports2, p))
          __createBinding(exports2, m, p);
    };
    Object.defineProperty(exports, "__esModule", { value: true });
    __exportStar(require_MoveDirection(), exports);
    __exportStar(require_RotateDirection(), exports);
    __exportStar(require_OutModeDirection(), exports);
    __exportStar(require_TiltDirection(), exports);
  }
});

// node_modules/tsparticles/Enums/Modes/ClickMode.js
var require_ClickMode = __commonJS({
  "node_modules/tsparticles/Enums/Modes/ClickMode.js"(exports) {
    init_shims();
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.ClickMode = void 0;
    var ClickMode;
    (function(ClickMode2) {
      ClickMode2["attract"] = "attract";
      ClickMode2["bubble"] = "bubble";
      ClickMode2["push"] = "push";
      ClickMode2["remove"] = "remove";
      ClickMode2["repulse"] = "repulse";
      ClickMode2["pause"] = "pause";
      ClickMode2["trail"] = "trail";
    })(ClickMode = exports.ClickMode || (exports.ClickMode = {}));
  }
});

// node_modules/tsparticles/Enums/Modes/DestroyMode.js
var require_DestroyMode = __commonJS({
  "node_modules/tsparticles/Enums/Modes/DestroyMode.js"(exports) {
    init_shims();
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.DestroyMode = void 0;
    var DestroyMode;
    (function(DestroyMode2) {
      DestroyMode2["none"] = "none";
      DestroyMode2["split"] = "split";
    })(DestroyMode = exports.DestroyMode || (exports.DestroyMode = {}));
  }
});

// node_modules/tsparticles/Enums/Modes/DivMode.js
var require_DivMode = __commonJS({
  "node_modules/tsparticles/Enums/Modes/DivMode.js"(exports) {
    init_shims();
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.DivMode = void 0;
    var DivMode;
    (function(DivMode2) {
      DivMode2["bounce"] = "bounce";
      DivMode2["bubble"] = "bubble";
      DivMode2["repulse"] = "repulse";
    })(DivMode = exports.DivMode || (exports.DivMode = {}));
  }
});

// node_modules/tsparticles/Enums/Modes/HoverMode.js
var require_HoverMode = __commonJS({
  "node_modules/tsparticles/Enums/Modes/HoverMode.js"(exports) {
    init_shims();
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.HoverMode = void 0;
    var HoverMode;
    (function(HoverMode2) {
      HoverMode2["attract"] = "attract";
      HoverMode2["bounce"] = "bounce";
      HoverMode2["bubble"] = "bubble";
      HoverMode2["connect"] = "connect";
      HoverMode2["grab"] = "grab";
      HoverMode2["light"] = "light";
      HoverMode2["repulse"] = "repulse";
      HoverMode2["slow"] = "slow";
      HoverMode2["trail"] = "trail";
    })(HoverMode = exports.HoverMode || (exports.HoverMode = {}));
  }
});

// node_modules/tsparticles/Enums/Modes/CollisionMode.js
var require_CollisionMode = __commonJS({
  "node_modules/tsparticles/Enums/Modes/CollisionMode.js"(exports) {
    init_shims();
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.CollisionMode = void 0;
    var CollisionMode;
    (function(CollisionMode2) {
      CollisionMode2["absorb"] = "absorb";
      CollisionMode2["bounce"] = "bounce";
      CollisionMode2["destroy"] = "destroy";
    })(CollisionMode = exports.CollisionMode || (exports.CollisionMode = {}));
  }
});

// node_modules/tsparticles/Enums/Modes/OutMode.js
var require_OutMode = __commonJS({
  "node_modules/tsparticles/Enums/Modes/OutMode.js"(exports) {
    init_shims();
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.OutMode = void 0;
    var OutMode;
    (function(OutMode2) {
      OutMode2["bounce"] = "bounce";
      OutMode2["bounceHorizontal"] = "bounce-horizontal";
      OutMode2["bounceVertical"] = "bounce-vertical";
      OutMode2["none"] = "none";
      OutMode2["out"] = "out";
      OutMode2["destroy"] = "destroy";
      OutMode2["split"] = "split";
    })(OutMode = exports.OutMode || (exports.OutMode = {}));
  }
});

// node_modules/tsparticles/Enums/Modes/RollMode.js
var require_RollMode = __commonJS({
  "node_modules/tsparticles/Enums/Modes/RollMode.js"(exports) {
    init_shims();
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.RollMode = void 0;
    var RollMode;
    (function(RollMode2) {
      RollMode2["both"] = "both";
      RollMode2["horizontal"] = "horizontal";
      RollMode2["vertical"] = "vertical";
    })(RollMode = exports.RollMode || (exports.RollMode = {}));
  }
});

// node_modules/tsparticles/Enums/Modes/SizeMode.js
var require_SizeMode = __commonJS({
  "node_modules/tsparticles/Enums/Modes/SizeMode.js"(exports) {
    init_shims();
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.SizeMode = void 0;
    var SizeMode;
    (function(SizeMode2) {
      SizeMode2["precise"] = "precise";
      SizeMode2["percent"] = "percent";
    })(SizeMode = exports.SizeMode || (exports.SizeMode = {}));
  }
});

// node_modules/tsparticles/Enums/Modes/ThemeMode.js
var require_ThemeMode = __commonJS({
  "node_modules/tsparticles/Enums/Modes/ThemeMode.js"(exports) {
    init_shims();
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.ThemeMode = void 0;
    var ThemeMode;
    (function(ThemeMode2) {
      ThemeMode2["any"] = "any";
      ThemeMode2["dark"] = "dark";
      ThemeMode2["light"] = "light";
    })(ThemeMode = exports.ThemeMode || (exports.ThemeMode = {}));
  }
});

// node_modules/tsparticles/Enums/Modes/ResponsiveMode.js
var require_ResponsiveMode = __commonJS({
  "node_modules/tsparticles/Enums/Modes/ResponsiveMode.js"(exports) {
    init_shims();
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.ResponsiveMode = void 0;
    var ResponsiveMode;
    (function(ResponsiveMode2) {
      ResponsiveMode2["screen"] = "screen";
      ResponsiveMode2["canvas"] = "canvas";
    })(ResponsiveMode = exports.ResponsiveMode || (exports.ResponsiveMode = {}));
  }
});

// node_modules/tsparticles/Enums/Modes/index.js
var require_Modes = __commonJS({
  "node_modules/tsparticles/Enums/Modes/index.js"(exports) {
    init_shims();
    "use strict";
    var __createBinding = exports && exports.__createBinding || (Object.create ? function(o, m, k, k2) {
      if (k2 === void 0)
        k2 = k;
      Object.defineProperty(o, k2, { enumerable: true, get: function() {
        return m[k];
      } });
    } : function(o, m, k, k2) {
      if (k2 === void 0)
        k2 = k;
      o[k2] = m[k];
    });
    var __exportStar = exports && exports.__exportStar || function(m, exports2) {
      for (var p in m)
        if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports2, p))
          __createBinding(exports2, m, p);
    };
    Object.defineProperty(exports, "__esModule", { value: true });
    __exportStar(require_ClickMode(), exports);
    __exportStar(require_DestroyMode(), exports);
    __exportStar(require_DivMode(), exports);
    __exportStar(require_HoverMode(), exports);
    __exportStar(require_CollisionMode(), exports);
    __exportStar(require_OutMode(), exports);
    __exportStar(require_RollMode(), exports);
    __exportStar(require_SizeMode(), exports);
    __exportStar(require_ThemeMode(), exports);
    __exportStar(require_ResponsiveMode(), exports);
  }
});

// node_modules/tsparticles/Enums/AnimationStatus.js
var require_AnimationStatus = __commonJS({
  "node_modules/tsparticles/Enums/AnimationStatus.js"(exports) {
    init_shims();
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.AnimationStatus = void 0;
    var AnimationStatus;
    (function(AnimationStatus2) {
      AnimationStatus2[AnimationStatus2["increasing"] = 0] = "increasing";
      AnimationStatus2[AnimationStatus2["decreasing"] = 1] = "decreasing";
    })(AnimationStatus = exports.AnimationStatus || (exports.AnimationStatus = {}));
  }
});

// node_modules/tsparticles/Enums/Types/AlterType.js
var require_AlterType = __commonJS({
  "node_modules/tsparticles/Enums/Types/AlterType.js"(exports) {
    init_shims();
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.AlterType = void 0;
    var AlterType;
    (function(AlterType2) {
      AlterType2["darken"] = "darken";
      AlterType2["enlighten"] = "enlighten";
    })(AlterType = exports.AlterType || (exports.AlterType = {}));
  }
});

// node_modules/tsparticles/Enums/Types/DestroyType.js
var require_DestroyType = __commonJS({
  "node_modules/tsparticles/Enums/Types/DestroyType.js"(exports) {
    init_shims();
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.DestroyType = void 0;
    var DestroyType;
    (function(DestroyType2) {
      DestroyType2["none"] = "none";
      DestroyType2["max"] = "max";
      DestroyType2["min"] = "min";
    })(DestroyType = exports.DestroyType || (exports.DestroyType = {}));
  }
});

// node_modules/tsparticles/Enums/Types/GradientType.js
var require_GradientType = __commonJS({
  "node_modules/tsparticles/Enums/Types/GradientType.js"(exports) {
    init_shims();
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.GradientType = void 0;
    var GradientType;
    (function(GradientType2) {
      GradientType2["linear"] = "linear";
      GradientType2["radial"] = "radial";
      GradientType2["random"] = "random";
    })(GradientType = exports.GradientType || (exports.GradientType = {}));
  }
});

// node_modules/tsparticles/Enums/Types/InteractorType.js
var require_InteractorType = __commonJS({
  "node_modules/tsparticles/Enums/Types/InteractorType.js"(exports) {
    init_shims();
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.InteractorType = void 0;
    var InteractorType;
    (function(InteractorType2) {
      InteractorType2[InteractorType2["External"] = 0] = "External";
      InteractorType2[InteractorType2["Particles"] = 1] = "Particles";
    })(InteractorType = exports.InteractorType || (exports.InteractorType = {}));
  }
});

// node_modules/tsparticles/Enums/Types/ShapeType.js
var require_ShapeType = __commonJS({
  "node_modules/tsparticles/Enums/Types/ShapeType.js"(exports) {
    init_shims();
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.ShapeType = void 0;
    var ShapeType;
    (function(ShapeType2) {
      ShapeType2["char"] = "char";
      ShapeType2["character"] = "character";
      ShapeType2["circle"] = "circle";
      ShapeType2["edge"] = "edge";
      ShapeType2["image"] = "image";
      ShapeType2["images"] = "images";
      ShapeType2["line"] = "line";
      ShapeType2["polygon"] = "polygon";
      ShapeType2["square"] = "square";
      ShapeType2["star"] = "star";
      ShapeType2["triangle"] = "triangle";
    })(ShapeType = exports.ShapeType || (exports.ShapeType = {}));
  }
});

// node_modules/tsparticles/Enums/Types/StartValueType.js
var require_StartValueType = __commonJS({
  "node_modules/tsparticles/Enums/Types/StartValueType.js"(exports) {
    init_shims();
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.StartValueType = void 0;
    var StartValueType;
    (function(StartValueType2) {
      StartValueType2["max"] = "max";
      StartValueType2["min"] = "min";
      StartValueType2["random"] = "random";
    })(StartValueType = exports.StartValueType || (exports.StartValueType = {}));
  }
});

// node_modules/tsparticles/Enums/Types/DivType.js
var require_DivType = __commonJS({
  "node_modules/tsparticles/Enums/Types/DivType.js"(exports) {
    init_shims();
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.DivType = void 0;
    var DivType;
    (function(DivType2) {
      DivType2["circle"] = "circle";
      DivType2["rectangle"] = "rectangle";
    })(DivType = exports.DivType || (exports.DivType = {}));
  }
});

// node_modules/tsparticles/Enums/Types/EasingType.js
var require_EasingType = __commonJS({
  "node_modules/tsparticles/Enums/Types/EasingType.js"(exports) {
    init_shims();
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.EasingType = void 0;
    var EasingType;
    (function(EasingType2) {
      EasingType2["easeOutBack"] = "ease-out-back";
      EasingType2["easeOutCirc"] = "ease-out-circ";
      EasingType2["easeOutCubic"] = "ease-out-cubic";
      EasingType2["easeOutQuad"] = "ease-out-quad";
      EasingType2["easeOutQuart"] = "ease-out-quart";
      EasingType2["easeOutQuint"] = "ease-out-quint";
      EasingType2["easeOutExpo"] = "ease-out-expo";
      EasingType2["easeOutSine"] = "ease-out-sine";
    })(EasingType = exports.EasingType || (exports.EasingType = {}));
  }
});

// node_modules/tsparticles/Enums/Types/OrbitType.js
var require_OrbitType = __commonJS({
  "node_modules/tsparticles/Enums/Types/OrbitType.js"(exports) {
    init_shims();
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.OrbitType = void 0;
    var OrbitType;
    (function(OrbitType2) {
      OrbitType2["front"] = "front";
      OrbitType2["back"] = "back";
    })(OrbitType = exports.OrbitType || (exports.OrbitType = {}));
  }
});

// node_modules/tsparticles/Enums/Types/index.js
var require_Types = __commonJS({
  "node_modules/tsparticles/Enums/Types/index.js"(exports) {
    init_shims();
    "use strict";
    var __createBinding = exports && exports.__createBinding || (Object.create ? function(o, m, k, k2) {
      if (k2 === void 0)
        k2 = k;
      Object.defineProperty(o, k2, { enumerable: true, get: function() {
        return m[k];
      } });
    } : function(o, m, k, k2) {
      if (k2 === void 0)
        k2 = k;
      o[k2] = m[k];
    });
    var __exportStar = exports && exports.__exportStar || function(m, exports2) {
      for (var p in m)
        if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports2, p))
          __createBinding(exports2, m, p);
    };
    Object.defineProperty(exports, "__esModule", { value: true });
    __exportStar(require_AlterType(), exports);
    __exportStar(require_DestroyType(), exports);
    __exportStar(require_GradientType(), exports);
    __exportStar(require_InteractorType(), exports);
    __exportStar(require_ShapeType(), exports);
    __exportStar(require_StartValueType(), exports);
    __exportStar(require_DivType(), exports);
    __exportStar(require_EasingType(), exports);
    __exportStar(require_OrbitType(), exports);
  }
});

// node_modules/tsparticles/Enums/InteractivityDetect.js
var require_InteractivityDetect = __commonJS({
  "node_modules/tsparticles/Enums/InteractivityDetect.js"(exports) {
    init_shims();
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.InteractivityDetect = void 0;
    var InteractivityDetect;
    (function(InteractivityDetect2) {
      InteractivityDetect2["canvas"] = "canvas";
      InteractivityDetect2["parent"] = "parent";
      InteractivityDetect2["window"] = "window";
    })(InteractivityDetect = exports.InteractivityDetect || (exports.InteractivityDetect = {}));
  }
});

// node_modules/tsparticles/Enums/index.js
var require_Enums = __commonJS({
  "node_modules/tsparticles/Enums/index.js"(exports) {
    init_shims();
    "use strict";
    var __createBinding = exports && exports.__createBinding || (Object.create ? function(o, m, k, k2) {
      if (k2 === void 0)
        k2 = k;
      Object.defineProperty(o, k2, { enumerable: true, get: function() {
        return m[k];
      } });
    } : function(o, m, k, k2) {
      if (k2 === void 0)
        k2 = k;
      o[k2] = m[k];
    });
    var __exportStar = exports && exports.__exportStar || function(m, exports2) {
      for (var p in m)
        if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports2, p))
          __createBinding(exports2, m, p);
    };
    Object.defineProperty(exports, "__esModule", { value: true });
    __exportStar(require_Directions(), exports);
    __exportStar(require_Modes(), exports);
    __exportStar(require_AnimationStatus(), exports);
    __exportStar(require_Types(), exports);
    __exportStar(require_InteractivityDetect(), exports);
  }
});

// node_modules/tsparticles/Core/Particle/Vector.js
var require_Vector = __commonJS({
  "node_modules/tsparticles/Core/Particle/Vector.js"(exports) {
    init_shims();
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.Vector = void 0;
    var Vector = class {
      constructor(x, y) {
        let defX, defY;
        if (y === void 0) {
          if (typeof x === "number") {
            throw new Error("tsParticles - Vector not initialized correctly");
          }
          const coords = x;
          [defX, defY] = [coords.x, coords.y];
        } else {
          [defX, defY] = [x, y];
        }
        this.x = defX;
        this.y = defY;
      }
      static clone(source) {
        return Vector.create(source.x, source.y);
      }
      static create(x, y) {
        return new Vector(x, y);
      }
      static get origin() {
        return Vector.create(0, 0);
      }
      get angle() {
        return Math.atan2(this.y, this.x);
      }
      set angle(angle) {
        this.updateFromAngle(angle, this.length);
      }
      get length() {
        return Math.sqrt(this.x ** 2 + this.y ** 2);
      }
      set length(length) {
        this.updateFromAngle(this.angle, length);
      }
      add(v) {
        return Vector.create(this.x + v.x, this.y + v.y);
      }
      addTo(v) {
        this.x += v.x;
        this.y += v.y;
      }
      sub(v) {
        return Vector.create(this.x - v.x, this.y - v.y);
      }
      subFrom(v) {
        this.x -= v.x;
        this.y -= v.y;
      }
      mult(n) {
        return Vector.create(this.x * n, this.y * n);
      }
      multTo(n) {
        this.x *= n;
        this.y *= n;
      }
      div(n) {
        return Vector.create(this.x / n, this.y / n);
      }
      divTo(n) {
        this.x /= n;
        this.y /= n;
      }
      distanceTo(v) {
        return this.sub(v).length;
      }
      getLengthSq() {
        return this.x ** 2 + this.y ** 2;
      }
      distanceToSq(v) {
        return this.sub(v).getLengthSq();
      }
      manhattanDistanceTo(v) {
        return Math.abs(v.x - this.x) + Math.abs(v.y - this.y);
      }
      copy() {
        return Vector.clone(this);
      }
      setTo(velocity) {
        this.x = velocity.x;
        this.y = velocity.y;
      }
      rotate(angle) {
        return Vector.create(this.x * Math.cos(angle) - this.y * Math.sin(angle), this.x * Math.sin(angle) + this.y * Math.cos(angle));
      }
      updateFromAngle(angle, length) {
        this.x = Math.cos(angle) * length;
        this.y = Math.sin(angle) * length;
      }
    };
    exports.Vector = Vector;
  }
});

// node_modules/tsparticles/Utils/NumberUtils.js
var require_NumberUtils = __commonJS({
  "node_modules/tsparticles/Utils/NumberUtils.js"(exports) {
    init_shims();
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.calcEasing = exports.collisionVelocity = exports.getParticleBaseVelocity = exports.getParticleDirectionAngle = exports.getDistance = exports.getDistances = exports.getValue = exports.setRangeValue = exports.getRangeMax = exports.getRangeMin = exports.getRangeValue = exports.randomInRange = exports.mix = exports.clamp = void 0;
    var Enums_1 = require_Enums();
    var Vector_1 = require_Vector();
    function clamp(num, min, max) {
      return Math.min(Math.max(num, min), max);
    }
    exports.clamp = clamp;
    function mix(comp1, comp2, weight1, weight2) {
      return Math.floor((comp1 * weight1 + comp2 * weight2) / (weight1 + weight2));
    }
    exports.mix = mix;
    function randomInRange(r) {
      const max = getRangeMax(r);
      let min = getRangeMin(r);
      if (max === min) {
        min = 0;
      }
      return Math.random() * (max - min) + min;
    }
    exports.randomInRange = randomInRange;
    function getRangeValue(value) {
      return typeof value === "number" ? value : randomInRange(value);
    }
    exports.getRangeValue = getRangeValue;
    function getRangeMin(value) {
      return typeof value === "number" ? value : value.min;
    }
    exports.getRangeMin = getRangeMin;
    function getRangeMax(value) {
      return typeof value === "number" ? value : value.max;
    }
    exports.getRangeMax = getRangeMax;
    function setRangeValue(source, value) {
      if (source === value || value === void 0 && typeof source === "number") {
        return source;
      }
      const min = getRangeMin(source), max = getRangeMax(source);
      return value !== void 0 ? {
        min: Math.min(min, value),
        max: Math.max(max, value)
      } : setRangeValue(min, max);
    }
    exports.setRangeValue = setRangeValue;
    function getValue(options2) {
      const random = options2.random;
      const { enable, minimumValue } = typeof random === "boolean" ? { enable: random, minimumValue: 0 } : random;
      return enable ? getRangeValue(setRangeValue(options2.value, minimumValue)) : getRangeValue(options2.value);
    }
    exports.getValue = getValue;
    function getDistances(pointA, pointB) {
      const dx = pointA.x - pointB.x;
      const dy = pointA.y - pointB.y;
      return { dx, dy, distance: Math.sqrt(dx * dx + dy * dy) };
    }
    exports.getDistances = getDistances;
    function getDistance(pointA, pointB) {
      return getDistances(pointA, pointB).distance;
    }
    exports.getDistance = getDistance;
    function getParticleDirectionAngle(direction) {
      if (typeof direction === "number") {
        return direction * Math.PI / 180;
      } else {
        switch (direction) {
          case Enums_1.MoveDirection.top:
            return -Math.PI / 2;
          case Enums_1.MoveDirection.topRight:
            return -Math.PI / 4;
          case Enums_1.MoveDirection.right:
            return 0;
          case Enums_1.MoveDirection.bottomRight:
            return Math.PI / 4;
          case Enums_1.MoveDirection.bottom:
            return Math.PI / 2;
          case Enums_1.MoveDirection.bottomLeft:
            return 3 * Math.PI / 4;
          case Enums_1.MoveDirection.left:
            return Math.PI;
          case Enums_1.MoveDirection.topLeft:
            return -3 * Math.PI / 4;
          case Enums_1.MoveDirection.none:
          default:
            return Math.random() * Math.PI * 2;
        }
      }
    }
    exports.getParticleDirectionAngle = getParticleDirectionAngle;
    function getParticleBaseVelocity(direction) {
      const baseVelocity = Vector_1.Vector.origin;
      baseVelocity.length = 1;
      baseVelocity.angle = direction;
      return baseVelocity;
    }
    exports.getParticleBaseVelocity = getParticleBaseVelocity;
    function collisionVelocity(v1, v2, m1, m2) {
      return Vector_1.Vector.create(v1.x * (m1 - m2) / (m1 + m2) + v2.x * 2 * m2 / (m1 + m2), v1.y);
    }
    exports.collisionVelocity = collisionVelocity;
    function calcEasing(value, type) {
      switch (type) {
        case Enums_1.EasingType.easeOutQuad:
          return 1 - (1 - value) ** 2;
        case Enums_1.EasingType.easeOutCubic:
          return 1 - (1 - value) ** 3;
        case Enums_1.EasingType.easeOutQuart:
          return 1 - (1 - value) ** 4;
        case Enums_1.EasingType.easeOutQuint:
          return 1 - (1 - value) ** 5;
        case Enums_1.EasingType.easeOutExpo:
          return value === 1 ? 1 : 1 - Math.pow(2, -10 * value);
        case Enums_1.EasingType.easeOutSine:
          return Math.sin(value * Math.PI / 2);
        case Enums_1.EasingType.easeOutBack: {
          const c1 = 1.70158;
          const c3 = c1 + 1;
          return 1 + c3 * Math.pow(value - 1, 3) + c1 * Math.pow(value - 1, 2);
        }
        case Enums_1.EasingType.easeOutCirc:
          return Math.sqrt(1 - Math.pow(value - 1, 2));
        default:
          return value;
      }
    }
    exports.calcEasing = calcEasing;
  }
});

// node_modules/tsparticles/Utils/Utils.js
var require_Utils = __commonJS({
  "node_modules/tsparticles/Utils/Utils.js"(exports) {
    init_shims();
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.rectBounce = exports.circleBounce = exports.circleBounceDataFromParticle = exports.divMode = exports.singleDivModeExecute = exports.divModeExecute = exports.isDivModeEnabled = exports.deepExtend = exports.calculateBounds = exports.areBoundsInside = exports.isPointInside = exports.itemFromArray = exports.arrayRandomIndex = exports.loadFont = exports.isInArray = exports.cancelAnimation = exports.animate = exports.isSsr = void 0;
    var Enums_1 = require_Enums();
    var NumberUtils_1 = require_NumberUtils();
    var Vector_1 = require_Vector();
    function rectSideBounce(pSide, pOtherSide, rectSide, rectOtherSide, velocity, factor) {
      const res = { bounced: false };
      if (pOtherSide.min >= rectOtherSide.min && pOtherSide.min <= rectOtherSide.max && pOtherSide.max >= rectOtherSide.min && pOtherSide.max <= rectOtherSide.max) {
        if (pSide.max >= rectSide.min && pSide.max <= (rectSide.max + rectSide.min) / 2 && velocity > 0 || pSide.min <= rectSide.max && pSide.min > (rectSide.max + rectSide.min) / 2 && velocity < 0) {
          res.velocity = velocity * -factor;
          res.bounced = true;
        }
      }
      return res;
    }
    function checkSelector(element, selectors) {
      if (selectors instanceof Array) {
        for (const selector of selectors) {
          if (element.matches(selector)) {
            return true;
          }
        }
        return false;
      } else {
        return element.matches(selectors);
      }
    }
    function isSsr() {
      return typeof window === "undefined" || !window || typeof window.document === "undefined" || !window.document;
    }
    exports.isSsr = isSsr;
    function animate() {
      return isSsr() ? (callback) => setTimeout(callback) : (callback) => (window.requestAnimationFrame || window.webkitRequestAnimationFrame || window.mozRequestAnimationFrame || window.oRequestAnimationFrame || window.msRequestAnimationFrame || window.setTimeout)(callback);
    }
    exports.animate = animate;
    function cancelAnimation() {
      return isSsr() ? (handle) => clearTimeout(handle) : (handle) => (window.cancelAnimationFrame || window.webkitCancelRequestAnimationFrame || window.mozCancelRequestAnimationFrame || window.oCancelRequestAnimationFrame || window.msCancelRequestAnimationFrame || window.clearTimeout)(handle);
    }
    exports.cancelAnimation = cancelAnimation;
    function isInArray(value, array) {
      return value === array || array instanceof Array && array.indexOf(value) > -1;
    }
    exports.isInArray = isInArray;
    async function loadFont(character) {
      var _a, _b;
      try {
        await document.fonts.load(`${(_a = character.weight) !== null && _a !== void 0 ? _a : "400"} 36px '${(_b = character.font) !== null && _b !== void 0 ? _b : "Verdana"}'`);
      } catch (_c) {
      }
    }
    exports.loadFont = loadFont;
    function arrayRandomIndex(array) {
      return Math.floor(Math.random() * array.length);
    }
    exports.arrayRandomIndex = arrayRandomIndex;
    function itemFromArray(array, index, useIndex = true) {
      const fixedIndex = index !== void 0 && useIndex ? index % array.length : arrayRandomIndex(array);
      return array[fixedIndex];
    }
    exports.itemFromArray = itemFromArray;
    function isPointInside(point, size, radius, direction) {
      return areBoundsInside(calculateBounds(point, radius !== null && radius !== void 0 ? radius : 0), size, direction);
    }
    exports.isPointInside = isPointInside;
    function areBoundsInside(bounds, size, direction) {
      let inside = true;
      if (!direction || direction === Enums_1.OutModeDirection.bottom) {
        inside = bounds.top < size.height;
      }
      if (inside && (!direction || direction === Enums_1.OutModeDirection.left)) {
        inside = bounds.right > 0;
      }
      if (inside && (!direction || direction === Enums_1.OutModeDirection.right)) {
        inside = bounds.left < size.width;
      }
      if (inside && (!direction || direction === Enums_1.OutModeDirection.top)) {
        inside = bounds.bottom > 0;
      }
      return inside;
    }
    exports.areBoundsInside = areBoundsInside;
    function calculateBounds(point, radius) {
      return {
        bottom: point.y + radius,
        left: point.x - radius,
        right: point.x + radius,
        top: point.y - radius
      };
    }
    exports.calculateBounds = calculateBounds;
    function deepExtend(destination, ...sources) {
      for (const source of sources) {
        if (source === void 0 || source === null) {
          continue;
        }
        if (typeof source !== "object") {
          destination = source;
          continue;
        }
        const sourceIsArray = Array.isArray(source);
        if (sourceIsArray && (typeof destination !== "object" || !destination || !Array.isArray(destination))) {
          destination = [];
        } else if (!sourceIsArray && (typeof destination !== "object" || !destination || Array.isArray(destination))) {
          destination = {};
        }
        for (const key in source) {
          if (key === "__proto__") {
            continue;
          }
          const sourceDict = source;
          const value = sourceDict[key];
          const isObject = typeof value === "object";
          const destDict = destination;
          destDict[key] = isObject && Array.isArray(value) ? value.map((v) => deepExtend(destDict[key], v)) : deepExtend(destDict[key], value);
        }
      }
      return destination;
    }
    exports.deepExtend = deepExtend;
    function isDivModeEnabled(mode, divs) {
      return divs instanceof Array ? !!divs.find((t) => t.enable && isInArray(mode, t.mode)) : isInArray(mode, divs.mode);
    }
    exports.isDivModeEnabled = isDivModeEnabled;
    function divModeExecute(mode, divs, callback) {
      if (divs instanceof Array) {
        for (const div of divs) {
          const divMode2 = div.mode;
          const divEnabled = div.enable;
          if (divEnabled && isInArray(mode, divMode2)) {
            singleDivModeExecute(div, callback);
          }
        }
      } else {
        const divMode2 = divs.mode;
        const divEnabled = divs.enable;
        if (divEnabled && isInArray(mode, divMode2)) {
          singleDivModeExecute(divs, callback);
        }
      }
    }
    exports.divModeExecute = divModeExecute;
    function singleDivModeExecute(div, callback) {
      const selectors = div.selectors;
      if (selectors instanceof Array) {
        for (const selector of selectors) {
          callback(selector, div);
        }
      } else {
        callback(selectors, div);
      }
    }
    exports.singleDivModeExecute = singleDivModeExecute;
    function divMode(divs, element) {
      if (!element || !divs) {
        return;
      }
      if (divs instanceof Array) {
        return divs.find((d) => checkSelector(element, d.selectors));
      } else if (checkSelector(element, divs.selectors)) {
        return divs;
      }
    }
    exports.divMode = divMode;
    function circleBounceDataFromParticle(p) {
      return {
        position: p.getPosition(),
        radius: p.getRadius(),
        mass: p.getMass(),
        velocity: p.velocity,
        factor: Vector_1.Vector.create((0, NumberUtils_1.getValue)(p.options.bounce.horizontal), (0, NumberUtils_1.getValue)(p.options.bounce.vertical))
      };
    }
    exports.circleBounceDataFromParticle = circleBounceDataFromParticle;
    function circleBounce(p1, p2) {
      const xVelocityDiff = p1.velocity.x;
      const yVelocityDiff = p1.velocity.y;
      const pos1 = p1.position;
      const pos2 = p2.position;
      const xDist = pos2.x - pos1.x;
      const yDist = pos2.y - pos1.y;
      if (xVelocityDiff * xDist + yVelocityDiff * yDist >= 0) {
        const angle = -Math.atan2(pos2.y - pos1.y, pos2.x - pos1.x);
        const m1 = p1.mass;
        const m2 = p2.mass;
        const u1 = p1.velocity.rotate(angle);
        const u2 = p2.velocity.rotate(angle);
        const v1 = (0, NumberUtils_1.collisionVelocity)(u1, u2, m1, m2);
        const v2 = (0, NumberUtils_1.collisionVelocity)(u2, u1, m1, m2);
        const vFinal1 = v1.rotate(-angle);
        const vFinal2 = v2.rotate(-angle);
        p1.velocity.x = vFinal1.x * p1.factor.x;
        p1.velocity.y = vFinal1.y * p1.factor.y;
        p2.velocity.x = vFinal2.x * p2.factor.x;
        p2.velocity.y = vFinal2.y * p2.factor.y;
      }
    }
    exports.circleBounce = circleBounce;
    function rectBounce(particle, divBounds) {
      const pPos = particle.getPosition();
      const size = particle.getRadius();
      const bounds = calculateBounds(pPos, size);
      const resH = rectSideBounce({
        min: bounds.left,
        max: bounds.right
      }, {
        min: bounds.top,
        max: bounds.bottom
      }, {
        min: divBounds.left,
        max: divBounds.right
      }, {
        min: divBounds.top,
        max: divBounds.bottom
      }, particle.velocity.x, (0, NumberUtils_1.getValue)(particle.options.bounce.horizontal));
      if (resH.bounced) {
        if (resH.velocity !== void 0) {
          particle.velocity.x = resH.velocity;
        }
        if (resH.position !== void 0) {
          particle.position.x = resH.position;
        }
      }
      const resV = rectSideBounce({
        min: bounds.top,
        max: bounds.bottom
      }, {
        min: bounds.left,
        max: bounds.right
      }, {
        min: divBounds.top,
        max: divBounds.bottom
      }, {
        min: divBounds.left,
        max: divBounds.right
      }, particle.velocity.y, (0, NumberUtils_1.getValue)(particle.options.bounce.vertical));
      if (resV.bounced) {
        if (resV.velocity !== void 0) {
          particle.velocity.y = resV.velocity;
        }
        if (resV.position !== void 0) {
          particle.position.y = resV.position;
        }
      }
    }
    exports.rectBounce = rectBounce;
  }
});

// node_modules/tsparticles/Utils/Constants.js
var require_Constants = __commonJS({
  "node_modules/tsparticles/Utils/Constants.js"(exports) {
    init_shims();
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.Constants = void 0;
    var Constants = class {
    };
    exports.Constants = Constants;
    Constants.canvasClass = "tsparticles-canvas-el";
    Constants.randomColorValue = "random";
    Constants.midColorValue = "mid";
    Constants.touchEndEvent = "touchend";
    Constants.mouseDownEvent = "mousedown";
    Constants.mouseUpEvent = "mouseup";
    Constants.mouseMoveEvent = "mousemove";
    Constants.touchStartEvent = "touchstart";
    Constants.touchMoveEvent = "touchmove";
    Constants.mouseLeaveEvent = "mouseleave";
    Constants.mouseOutEvent = "mouseout";
    Constants.touchCancelEvent = "touchcancel";
    Constants.resizeEvent = "resize";
    Constants.visibilityChangeEvent = "visibilitychange";
    Constants.noPolygonDataLoaded = "No polygon data loaded.";
    Constants.noPolygonFound = "No polygon found, you need to specify SVG url in config.";
  }
});

// node_modules/tsparticles/Utils/ColorUtils.js
var require_ColorUtils = __commonJS({
  "node_modules/tsparticles/Utils/ColorUtils.js"(exports) {
    init_shims();
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.getHslAnimationFromHsl = exports.getHslFromAnimation = exports.getLinkRandomColor = exports.getLinkColor = exports.colorMix = exports.getStyleFromHsv = exports.getStyleFromHsl = exports.getStyleFromRgb = exports.getRandomRgbColor = exports.rgbaToHsva = exports.rgbToHsv = exports.hsvaToRgba = exports.hsvToRgb = exports.hsvaToHsla = exports.hsvToHsl = exports.hslaToHsva = exports.hslToHsv = exports.hslaToRgba = exports.hslToRgb = exports.stringToRgb = exports.stringToAlpha = exports.rgbToHsl = exports.colorToHsl = exports.colorToRgb = void 0;
    var Utils_1 = require_Utils();
    var Constants_1 = require_Constants();
    var NumberUtils_1 = require_NumberUtils();
    var Enums_1 = require_Enums();
    function hue2rgb(p, q, t) {
      let tCalc = t;
      if (tCalc < 0) {
        tCalc += 1;
      }
      if (tCalc > 1) {
        tCalc -= 1;
      }
      if (tCalc < 1 / 6) {
        return p + (q - p) * 6 * tCalc;
      }
      if (tCalc < 1 / 2) {
        return q;
      }
      if (tCalc < 2 / 3) {
        return p + (q - p) * (2 / 3 - tCalc) * 6;
      }
      return p;
    }
    function stringToRgba(input) {
      if (input.startsWith("rgb")) {
        const regex = /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(,\s*([\d.]+)\s*)?\)/i;
        const result = regex.exec(input);
        return result ? {
          a: result.length > 4 ? parseFloat(result[5]) : 1,
          b: parseInt(result[3], 10),
          g: parseInt(result[2], 10),
          r: parseInt(result[1], 10)
        } : void 0;
      } else if (input.startsWith("hsl")) {
        const regex = /hsla?\(\s*(\d+)\s*,\s*(\d+)%\s*,\s*(\d+)%\s*(,\s*([\d.]+)\s*)?\)/i;
        const result = regex.exec(input);
        return result ? hslaToRgba({
          a: result.length > 4 ? parseFloat(result[5]) : 1,
          h: parseInt(result[1], 10),
          l: parseInt(result[3], 10),
          s: parseInt(result[2], 10)
        }) : void 0;
      } else if (input.startsWith("hsv")) {
        const regex = /hsva?\(\s*(\d+)°\s*,\s*(\d+)%\s*,\s*(\d+)%\s*(,\s*([\d.]+)\s*)?\)/i;
        const result = regex.exec(input);
        return result ? hsvaToRgba({
          a: result.length > 4 ? parseFloat(result[5]) : 1,
          h: parseInt(result[1], 10),
          s: parseInt(result[2], 10),
          v: parseInt(result[3], 10)
        }) : void 0;
      } else {
        const shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])([a-f\d])?$/i;
        const hexFixed = input.replace(shorthandRegex, (_m, r, g, b, a) => {
          return r + r + g + g + b + b + (a !== void 0 ? a + a : "");
        });
        const regex = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})?$/i;
        const result = regex.exec(hexFixed);
        return result ? {
          a: result[4] !== void 0 ? parseInt(result[4], 16) / 255 : 1,
          b: parseInt(result[3], 16),
          g: parseInt(result[2], 16),
          r: parseInt(result[1], 16)
        } : void 0;
      }
    }
    function colorToRgb(input, index, useIndex = true) {
      var _a, _b, _c;
      if (input === void 0) {
        return;
      }
      const color = typeof input === "string" ? { value: input } : input;
      let res;
      if (typeof color.value === "string") {
        if (color.value === Constants_1.Constants.randomColorValue) {
          res = getRandomRgbColor();
        } else {
          res = stringToRgb(color.value);
        }
      } else {
        if (color.value instanceof Array) {
          const colorSelected = (0, Utils_1.itemFromArray)(color.value, index, useIndex);
          res = colorToRgb({ value: colorSelected });
        } else {
          const colorValue = color.value;
          const rgbColor = (_a = colorValue.rgb) !== null && _a !== void 0 ? _a : color.value;
          if (rgbColor.r !== void 0) {
            res = rgbColor;
          } else {
            const hslColor = (_b = colorValue.hsl) !== null && _b !== void 0 ? _b : color.value;
            if (hslColor.h !== void 0 && hslColor.l !== void 0) {
              res = hslToRgb(hslColor);
            } else {
              const hsvColor = (_c = colorValue.hsv) !== null && _c !== void 0 ? _c : color.value;
              if (hsvColor.h !== void 0 && hsvColor.v !== void 0) {
                res = hsvToRgb(hsvColor);
              }
            }
          }
        }
      }
      return res;
    }
    exports.colorToRgb = colorToRgb;
    function colorToHsl(color, index, useIndex = true) {
      const rgb = colorToRgb(color, index, useIndex);
      return rgb !== void 0 ? rgbToHsl(rgb) : void 0;
    }
    exports.colorToHsl = colorToHsl;
    function rgbToHsl(color) {
      const r1 = color.r / 255;
      const g1 = color.g / 255;
      const b1 = color.b / 255;
      const max = Math.max(r1, g1, b1);
      const min = Math.min(r1, g1, b1);
      const res = {
        h: 0,
        l: (max + min) / 2,
        s: 0
      };
      if (max != min) {
        res.s = res.l < 0.5 ? (max - min) / (max + min) : (max - min) / (2 - max - min);
        res.h = r1 === max ? (g1 - b1) / (max - min) : res.h = g1 === max ? 2 + (b1 - r1) / (max - min) : 4 + (r1 - g1) / (max - min);
      }
      res.l *= 100;
      res.s *= 100;
      res.h *= 60;
      if (res.h < 0) {
        res.h += 360;
      }
      return res;
    }
    exports.rgbToHsl = rgbToHsl;
    function stringToAlpha(input) {
      var _a;
      return (_a = stringToRgba(input)) === null || _a === void 0 ? void 0 : _a.a;
    }
    exports.stringToAlpha = stringToAlpha;
    function stringToRgb(input) {
      return stringToRgba(input);
    }
    exports.stringToRgb = stringToRgb;
    function hslToRgb(hsl) {
      const result = { b: 0, g: 0, r: 0 };
      const hslPercent = {
        h: hsl.h / 360,
        l: hsl.l / 100,
        s: hsl.s / 100
      };
      if (hslPercent.s === 0) {
        result.b = hslPercent.l;
        result.g = hslPercent.l;
        result.r = hslPercent.l;
      } else {
        const q = hslPercent.l < 0.5 ? hslPercent.l * (1 + hslPercent.s) : hslPercent.l + hslPercent.s - hslPercent.l * hslPercent.s;
        const p = 2 * hslPercent.l - q;
        result.r = hue2rgb(p, q, hslPercent.h + 1 / 3);
        result.g = hue2rgb(p, q, hslPercent.h);
        result.b = hue2rgb(p, q, hslPercent.h - 1 / 3);
      }
      result.r = Math.floor(result.r * 255);
      result.g = Math.floor(result.g * 255);
      result.b = Math.floor(result.b * 255);
      return result;
    }
    exports.hslToRgb = hslToRgb;
    function hslaToRgba(hsla) {
      const rgbResult = hslToRgb(hsla);
      return {
        a: hsla.a,
        b: rgbResult.b,
        g: rgbResult.g,
        r: rgbResult.r
      };
    }
    exports.hslaToRgba = hslaToRgba;
    function hslToHsv(hsl) {
      const l = hsl.l / 100, sl = hsl.s / 100;
      const v = l + sl * Math.min(l, 1 - l), sv = !v ? 0 : 2 * (1 - l / v);
      return {
        h: hsl.h,
        s: sv * 100,
        v: v * 100
      };
    }
    exports.hslToHsv = hslToHsv;
    function hslaToHsva(hsla) {
      const hsvResult = hslToHsv(hsla);
      return {
        a: hsla.a,
        h: hsvResult.h,
        s: hsvResult.s,
        v: hsvResult.v
      };
    }
    exports.hslaToHsva = hslaToHsva;
    function hsvToHsl(hsv) {
      const v = hsv.v / 100, sv = hsv.s / 100;
      const l = v * (1 - sv / 2), sl = l === 0 || l === 1 ? 0 : (v - l) / Math.min(l, 1 - l);
      return {
        h: hsv.h,
        l: l * 100,
        s: sl * 100
      };
    }
    exports.hsvToHsl = hsvToHsl;
    function hsvaToHsla(hsva) {
      const hslResult = hsvToHsl(hsva);
      return {
        a: hsva.a,
        h: hslResult.h,
        l: hslResult.l,
        s: hslResult.s
      };
    }
    exports.hsvaToHsla = hsvaToHsla;
    function hsvToRgb(hsv) {
      const result = { b: 0, g: 0, r: 0 };
      const hsvPercent = {
        h: hsv.h / 60,
        s: hsv.s / 100,
        v: hsv.v / 100
      };
      const c = hsvPercent.v * hsvPercent.s, x = c * (1 - Math.abs(hsvPercent.h % 2 - 1));
      let tempRgb;
      if (hsvPercent.h >= 0 && hsvPercent.h <= 1) {
        tempRgb = {
          r: c,
          g: x,
          b: 0
        };
      } else if (hsvPercent.h > 1 && hsvPercent.h <= 2) {
        tempRgb = {
          r: x,
          g: c,
          b: 0
        };
      } else if (hsvPercent.h > 2 && hsvPercent.h <= 3) {
        tempRgb = {
          r: 0,
          g: c,
          b: x
        };
      } else if (hsvPercent.h > 3 && hsvPercent.h <= 4) {
        tempRgb = {
          r: 0,
          g: x,
          b: c
        };
      } else if (hsvPercent.h > 4 && hsvPercent.h <= 5) {
        tempRgb = {
          r: x,
          g: 0,
          b: c
        };
      } else if (hsvPercent.h > 5 && hsvPercent.h <= 6) {
        tempRgb = {
          r: c,
          g: 0,
          b: x
        };
      }
      if (tempRgb) {
        const m = hsvPercent.v - c;
        result.r = Math.floor((tempRgb.r + m) * 255);
        result.g = Math.floor((tempRgb.g + m) * 255);
        result.b = Math.floor((tempRgb.b + m) * 255);
      }
      return result;
    }
    exports.hsvToRgb = hsvToRgb;
    function hsvaToRgba(hsva) {
      const rgbResult = hsvToRgb(hsva);
      return {
        a: hsva.a,
        b: rgbResult.b,
        g: rgbResult.g,
        r: rgbResult.r
      };
    }
    exports.hsvaToRgba = hsvaToRgba;
    function rgbToHsv(rgb) {
      const rgbPercent = {
        r: rgb.r / 255,
        g: rgb.g / 255,
        b: rgb.b / 255
      }, xMax = Math.max(rgbPercent.r, rgbPercent.g, rgbPercent.b), xMin = Math.min(rgbPercent.r, rgbPercent.g, rgbPercent.b), v = xMax, c = xMax - xMin;
      let h = 0;
      if (v === rgbPercent.r) {
        h = 60 * ((rgbPercent.g - rgbPercent.b) / c);
      } else if (v === rgbPercent.g) {
        h = 60 * (2 + (rgbPercent.b - rgbPercent.r) / c);
      } else if (v === rgbPercent.b) {
        h = 60 * (4 + (rgbPercent.r - rgbPercent.g) / c);
      }
      const s2 = !v ? 0 : c / v;
      return {
        h,
        s: s2 * 100,
        v: v * 100
      };
    }
    exports.rgbToHsv = rgbToHsv;
    function rgbaToHsva(rgba) {
      const hsvResult = rgbToHsv(rgba);
      return {
        a: rgba.a,
        h: hsvResult.h,
        s: hsvResult.s,
        v: hsvResult.v
      };
    }
    exports.rgbaToHsva = rgbaToHsva;
    function getRandomRgbColor(min) {
      const fixedMin = min !== null && min !== void 0 ? min : 0;
      return {
        b: Math.floor((0, NumberUtils_1.randomInRange)((0, NumberUtils_1.setRangeValue)(fixedMin, 256))),
        g: Math.floor((0, NumberUtils_1.randomInRange)((0, NumberUtils_1.setRangeValue)(fixedMin, 256))),
        r: Math.floor((0, NumberUtils_1.randomInRange)((0, NumberUtils_1.setRangeValue)(fixedMin, 256)))
      };
    }
    exports.getRandomRgbColor = getRandomRgbColor;
    function getStyleFromRgb(color, opacity) {
      return `rgba(${color.r}, ${color.g}, ${color.b}, ${opacity !== null && opacity !== void 0 ? opacity : 1})`;
    }
    exports.getStyleFromRgb = getStyleFromRgb;
    function getStyleFromHsl(color, opacity) {
      return `hsla(${color.h}, ${color.s}%, ${color.l}%, ${opacity !== null && opacity !== void 0 ? opacity : 1})`;
    }
    exports.getStyleFromHsl = getStyleFromHsl;
    function getStyleFromHsv(color, opacity) {
      return getStyleFromHsl(hsvToHsl(color), opacity);
    }
    exports.getStyleFromHsv = getStyleFromHsv;
    function colorMix(color1, color2, size1, size2) {
      let rgb1 = color1;
      let rgb2 = color2;
      if (rgb1.r === void 0) {
        rgb1 = hslToRgb(color1);
      }
      if (rgb2.r === void 0) {
        rgb2 = hslToRgb(color2);
      }
      return {
        b: (0, NumberUtils_1.mix)(rgb1.b, rgb2.b, size1, size2),
        g: (0, NumberUtils_1.mix)(rgb1.g, rgb2.g, size1, size2),
        r: (0, NumberUtils_1.mix)(rgb1.r, rgb2.r, size1, size2)
      };
    }
    exports.colorMix = colorMix;
    function getLinkColor(p1, p2, linkColor) {
      var _a, _b;
      if (linkColor === Constants_1.Constants.randomColorValue) {
        return getRandomRgbColor();
      } else if (linkColor === "mid") {
        const sourceColor = (_a = p1.getFillColor()) !== null && _a !== void 0 ? _a : p1.getStrokeColor();
        const destColor = (_b = p2 === null || p2 === void 0 ? void 0 : p2.getFillColor()) !== null && _b !== void 0 ? _b : p2 === null || p2 === void 0 ? void 0 : p2.getStrokeColor();
        if (sourceColor && destColor && p2) {
          return colorMix(sourceColor, destColor, p1.getRadius(), p2.getRadius());
        } else {
          const hslColor = sourceColor !== null && sourceColor !== void 0 ? sourceColor : destColor;
          if (hslColor) {
            return hslToRgb(hslColor);
          }
        }
      } else {
        return linkColor;
      }
    }
    exports.getLinkColor = getLinkColor;
    function getLinkRandomColor(optColor, blink, consent) {
      const color = typeof optColor === "string" ? optColor : optColor.value;
      if (color === Constants_1.Constants.randomColorValue) {
        if (consent) {
          return colorToRgb({
            value: color
          });
        } else if (blink) {
          return Constants_1.Constants.randomColorValue;
        } else {
          return Constants_1.Constants.midColorValue;
        }
      } else {
        return colorToRgb({
          value: color
        });
      }
    }
    exports.getLinkRandomColor = getLinkRandomColor;
    function getHslFromAnimation(animation) {
      return animation !== void 0 ? {
        h: animation.h.value,
        s: animation.s.value,
        l: animation.l.value
      } : void 0;
    }
    exports.getHslFromAnimation = getHslFromAnimation;
    function getHslAnimationFromHsl(hsl, animationOptions, reduceFactor) {
      const resColor = {
        h: {
          enable: false,
          value: hsl.h
        },
        s: {
          enable: false,
          value: hsl.s
        },
        l: {
          enable: false,
          value: hsl.l
        }
      };
      if (animationOptions) {
        setColorAnimation(resColor.h, animationOptions.h, reduceFactor);
        setColorAnimation(resColor.s, animationOptions.s, reduceFactor);
        setColorAnimation(resColor.l, animationOptions.l, reduceFactor);
      }
      return resColor;
    }
    exports.getHslAnimationFromHsl = getHslAnimationFromHsl;
    function setColorAnimation(colorValue, colorAnimation, reduceFactor) {
      colorValue.enable = colorAnimation.enable;
      if (colorValue.enable) {
        colorValue.velocity = colorAnimation.speed / 100 * reduceFactor;
        if (colorAnimation.sync) {
          return;
        }
        colorValue.status = Enums_1.AnimationStatus.increasing;
        colorValue.velocity *= Math.random();
        if (colorValue.value) {
          colorValue.value *= Math.random();
        }
      } else {
        colorValue.velocity = 0;
      }
    }
  }
});

// node_modules/tsparticles/Utils/CanvasUtils.js
var require_CanvasUtils = __commonJS({
  "node_modules/tsparticles/Utils/CanvasUtils.js"(exports) {
    init_shims();
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.alterHsl = exports.drawEllipse = exports.drawParticlePlugin = exports.drawPlugin = exports.drawShapeAfterEffect = exports.drawShape = exports.drawParticle = exports.drawGrabLine = exports.gradient = exports.drawConnectLine = exports.drawLinkTriangle = exports.drawLinkLine = exports.clear = exports.paintBase = void 0;
    var NumberUtils_1 = require_NumberUtils();
    var ColorUtils_1 = require_ColorUtils();
    var Enums_1 = require_Enums();
    function drawLine(context, begin, end) {
      context.beginPath();
      context.moveTo(begin.x, begin.y);
      context.lineTo(end.x, end.y);
      context.closePath();
    }
    function drawTriangle(context, p1, p2, p3) {
      context.beginPath();
      context.moveTo(p1.x, p1.y);
      context.lineTo(p2.x, p2.y);
      context.lineTo(p3.x, p3.y);
      context.closePath();
    }
    function paintBase(context, dimension, baseColor) {
      context.save();
      context.fillStyle = baseColor !== null && baseColor !== void 0 ? baseColor : "rgba(0,0,0,0)";
      context.fillRect(0, 0, dimension.width, dimension.height);
      context.restore();
    }
    exports.paintBase = paintBase;
    function clear(context, dimension) {
      context.clearRect(0, 0, dimension.width, dimension.height);
    }
    exports.clear = clear;
    function drawLinkLine(context, width, begin, end, maxDistance, canvasSize, warp, backgroundMask, composite, colorLine, opacity, shadow) {
      let drawn = false;
      if ((0, NumberUtils_1.getDistance)(begin, end) <= maxDistance) {
        drawLine(context, begin, end);
        drawn = true;
      } else if (warp) {
        let pi1;
        let pi2;
        const endNE = {
          x: end.x - canvasSize.width,
          y: end.y
        };
        const d1 = (0, NumberUtils_1.getDistances)(begin, endNE);
        if (d1.distance <= maxDistance) {
          const yi = begin.y - d1.dy / d1.dx * begin.x;
          pi1 = { x: 0, y: yi };
          pi2 = { x: canvasSize.width, y: yi };
        } else {
          const endSW = {
            x: end.x,
            y: end.y - canvasSize.height
          };
          const d2 = (0, NumberUtils_1.getDistances)(begin, endSW);
          if (d2.distance <= maxDistance) {
            const yi = begin.y - d2.dy / d2.dx * begin.x;
            const xi = -yi / (d2.dy / d2.dx);
            pi1 = { x: xi, y: 0 };
            pi2 = { x: xi, y: canvasSize.height };
          } else {
            const endSE = {
              x: end.x - canvasSize.width,
              y: end.y - canvasSize.height
            };
            const d3 = (0, NumberUtils_1.getDistances)(begin, endSE);
            if (d3.distance <= maxDistance) {
              const yi = begin.y - d3.dy / d3.dx * begin.x;
              const xi = -yi / (d3.dy / d3.dx);
              pi1 = { x: xi, y: yi };
              pi2 = { x: pi1.x + canvasSize.width, y: pi1.y + canvasSize.height };
            }
          }
        }
        if (pi1 && pi2) {
          drawLine(context, begin, pi1);
          drawLine(context, end, pi2);
          drawn = true;
        }
      }
      if (!drawn) {
        return;
      }
      context.lineWidth = width;
      if (backgroundMask) {
        context.globalCompositeOperation = composite;
      }
      context.strokeStyle = (0, ColorUtils_1.getStyleFromRgb)(colorLine, opacity);
      if (shadow.enable) {
        const shadowColor = (0, ColorUtils_1.colorToRgb)(shadow.color);
        if (shadowColor) {
          context.shadowBlur = shadow.blur;
          context.shadowColor = (0, ColorUtils_1.getStyleFromRgb)(shadowColor);
        }
      }
      context.stroke();
    }
    exports.drawLinkLine = drawLinkLine;
    function drawLinkTriangle(context, pos1, pos2, pos3, backgroundMask, composite, colorTriangle, opacityTriangle) {
      drawTriangle(context, pos1, pos2, pos3);
      if (backgroundMask) {
        context.globalCompositeOperation = composite;
      }
      context.fillStyle = (0, ColorUtils_1.getStyleFromRgb)(colorTriangle, opacityTriangle);
      context.fill();
    }
    exports.drawLinkTriangle = drawLinkTriangle;
    function drawConnectLine(context, width, lineStyle, begin, end) {
      context.save();
      drawLine(context, begin, end);
      context.lineWidth = width;
      context.strokeStyle = lineStyle;
      context.stroke();
      context.restore();
    }
    exports.drawConnectLine = drawConnectLine;
    function gradient(context, p1, p2, opacity) {
      const gradStop = Math.floor(p2.getRadius() / p1.getRadius());
      const color1 = p1.getFillColor();
      const color2 = p2.getFillColor();
      if (!color1 || !color2) {
        return;
      }
      const sourcePos = p1.getPosition();
      const destPos = p2.getPosition();
      const midRgb = (0, ColorUtils_1.colorMix)(color1, color2, p1.getRadius(), p2.getRadius());
      const grad = context.createLinearGradient(sourcePos.x, sourcePos.y, destPos.x, destPos.y);
      grad.addColorStop(0, (0, ColorUtils_1.getStyleFromHsl)(color1, opacity));
      grad.addColorStop(gradStop > 1 ? 1 : gradStop, (0, ColorUtils_1.getStyleFromRgb)(midRgb, opacity));
      grad.addColorStop(1, (0, ColorUtils_1.getStyleFromHsl)(color2, opacity));
      return grad;
    }
    exports.gradient = gradient;
    function drawGrabLine(context, width, begin, end, colorLine, opacity) {
      context.save();
      drawLine(context, begin, end);
      context.strokeStyle = (0, ColorUtils_1.getStyleFromRgb)(colorLine, opacity);
      context.lineWidth = width;
      context.stroke();
      context.restore();
    }
    exports.drawGrabLine = drawGrabLine;
    function drawParticle(container, context, particle, delta, fillColorValue, strokeColorValue, backgroundMask, composite, radius, opacity, shadow, gradient2) {
      var _a, _b, _c, _d, _e, _f;
      const pos = particle.getPosition();
      const tiltOptions = particle.options.tilt;
      const rollOptions = particle.options.roll;
      context.save();
      if (tiltOptions.enable || rollOptions.enable) {
        const roll = rollOptions.enable && particle.roll;
        const tilt = tiltOptions.enable && particle.tilt;
        const rollHorizontal = roll && (rollOptions.mode === Enums_1.RollMode.horizontal || rollOptions.mode === Enums_1.RollMode.both);
        const rollVertical = roll && (rollOptions.mode === Enums_1.RollMode.vertical || rollOptions.mode === Enums_1.RollMode.both);
        context.setTransform(rollHorizontal ? Math.cos(particle.roll.angle) : 1, tilt ? Math.cos(particle.tilt.value) * particle.tilt.cosDirection : 0, tilt ? Math.sin(particle.tilt.value) * particle.tilt.sinDirection : 0, rollVertical ? Math.sin(particle.roll.angle) : 1, pos.x, pos.y);
      } else {
        context.translate(pos.x, pos.y);
      }
      context.beginPath();
      const angle = ((_b = (_a = particle.rotate) === null || _a === void 0 ? void 0 : _a.value) !== null && _b !== void 0 ? _b : 0) + (particle.options.rotate.path ? particle.velocity.angle : 0);
      if (angle !== 0) {
        context.rotate(angle);
      }
      if (backgroundMask) {
        context.globalCompositeOperation = composite;
      }
      const shadowColor = particle.shadowColor;
      if (shadow.enable && shadowColor) {
        context.shadowBlur = shadow.blur;
        context.shadowColor = (0, ColorUtils_1.getStyleFromRgb)(shadowColor);
        context.shadowOffsetX = shadow.offset.x;
        context.shadowOffsetY = shadow.offset.y;
      }
      if (gradient2) {
        const gradientAngle = gradient2.angle.value;
        const fillGradient = gradient2.type === Enums_1.GradientType.radial ? context.createRadialGradient(0, 0, 0, 0, 0, radius) : context.createLinearGradient(Math.cos(gradientAngle) * -radius, Math.sin(gradientAngle) * -radius, Math.cos(gradientAngle) * radius, Math.sin(gradientAngle) * radius);
        for (const color of gradient2.colors) {
          fillGradient.addColorStop(color.stop, (0, ColorUtils_1.getStyleFromHsl)({
            h: color.value.h.value,
            s: color.value.s.value,
            l: color.value.l.value
          }, (_d = (_c = color.opacity) === null || _c === void 0 ? void 0 : _c.value) !== null && _d !== void 0 ? _d : opacity));
        }
        context.fillStyle = fillGradient;
      } else {
        if (fillColorValue) {
          context.fillStyle = fillColorValue;
        }
      }
      const stroke = particle.stroke;
      context.lineWidth = (_e = particle.strokeWidth) !== null && _e !== void 0 ? _e : 0;
      if (strokeColorValue) {
        context.strokeStyle = strokeColorValue;
      }
      drawShape(container, context, particle, radius, opacity, delta);
      if (((_f = stroke === null || stroke === void 0 ? void 0 : stroke.width) !== null && _f !== void 0 ? _f : 0) > 0) {
        context.stroke();
      }
      if (particle.close) {
        context.closePath();
      }
      if (particle.fill) {
        context.fill();
      }
      context.restore();
      context.save();
      if (tiltOptions.enable && particle.tilt) {
        context.setTransform(1, Math.cos(particle.tilt.value) * particle.tilt.cosDirection, Math.sin(particle.tilt.value) * particle.tilt.sinDirection, 1, pos.x, pos.y);
      } else {
        context.translate(pos.x, pos.y);
      }
      if (angle !== 0) {
        context.rotate(angle);
      }
      if (backgroundMask) {
        context.globalCompositeOperation = composite;
      }
      drawShapeAfterEffect(container, context, particle, radius, opacity, delta);
      context.restore();
    }
    exports.drawParticle = drawParticle;
    function drawShape(container, context, particle, radius, opacity, delta) {
      if (!particle.shape) {
        return;
      }
      const drawer = container.drawers.get(particle.shape);
      if (!drawer) {
        return;
      }
      drawer.draw(context, particle, radius, opacity, delta, container.retina.pixelRatio);
    }
    exports.drawShape = drawShape;
    function drawShapeAfterEffect(container, context, particle, radius, opacity, delta) {
      if (!particle.shape) {
        return;
      }
      const drawer = container.drawers.get(particle.shape);
      if (!(drawer === null || drawer === void 0 ? void 0 : drawer.afterEffect)) {
        return;
      }
      drawer.afterEffect(context, particle, radius, opacity, delta, container.retina.pixelRatio);
    }
    exports.drawShapeAfterEffect = drawShapeAfterEffect;
    function drawPlugin(context, plugin, delta) {
      if (!plugin.draw) {
        return;
      }
      context.save();
      plugin.draw(context, delta);
      context.restore();
    }
    exports.drawPlugin = drawPlugin;
    function drawParticlePlugin(context, plugin, particle, delta) {
      if (plugin.drawParticle !== void 0) {
        context.save();
        plugin.drawParticle(context, particle, delta);
        context.restore();
      }
    }
    exports.drawParticlePlugin = drawParticlePlugin;
    function drawEllipse(context, particle, fillColorValue, radius, opacity, width, rotation, start, end) {
      const pos = particle.getPosition();
      if (fillColorValue) {
        context.strokeStyle = (0, ColorUtils_1.getStyleFromHsl)(fillColorValue, opacity);
      }
      if (width === 0) {
        return;
      }
      context.lineWidth = width;
      const rotationRadian = rotation * Math.PI / 180;
      context.beginPath();
      context.ellipse(pos.x, pos.y, radius / 2, radius * 2, rotationRadian, start, end);
      context.stroke();
    }
    exports.drawEllipse = drawEllipse;
    function alterHsl(color, type, value) {
      return {
        h: color.h,
        s: color.s,
        l: color.l + (type === Enums_1.AlterType.darken ? -1 : 1) * value
      };
    }
    exports.alterHsl = alterHsl;
  }
});

// node_modules/tsparticles/Utils/Range.js
var require_Range = __commonJS({
  "node_modules/tsparticles/Utils/Range.js"(exports) {
    init_shims();
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.Range = void 0;
    var Range = class {
      constructor(x, y) {
        this.position = {
          x,
          y
        };
      }
    };
    exports.Range = Range;
  }
});

// node_modules/tsparticles/Utils/Circle.js
var require_Circle = __commonJS({
  "node_modules/tsparticles/Utils/Circle.js"(exports) {
    init_shims();
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.Circle = void 0;
    var Range_1 = require_Range();
    var NumberUtils_1 = require_NumberUtils();
    var Circle = class extends Range_1.Range {
      constructor(x, y, radius) {
        super(x, y);
        this.radius = radius;
      }
      contains(point) {
        return (0, NumberUtils_1.getDistance)(point, this.position) <= this.radius;
      }
      intersects(range) {
        const rect = range;
        const circle = range;
        const pos1 = this.position;
        const pos2 = range.position;
        const xDist = Math.abs(pos2.x - pos1.x);
        const yDist = Math.abs(pos2.y - pos1.y);
        const r = this.radius;
        if (circle.radius !== void 0) {
          const rSum = r + circle.radius;
          const dist = Math.sqrt(xDist * xDist + yDist + yDist);
          return rSum > dist;
        } else if (rect.size !== void 0) {
          const w = rect.size.width;
          const h = rect.size.height;
          const edges = Math.pow(xDist - w, 2) + Math.pow(yDist - h, 2);
          if (xDist > r + w || yDist > r + h) {
            return false;
          }
          if (xDist <= w || yDist <= h) {
            return true;
          }
          return edges <= r * r;
        }
        return false;
      }
    };
    exports.Circle = Circle;
  }
});

// node_modules/tsparticles/Utils/Rectangle.js
var require_Rectangle = __commonJS({
  "node_modules/tsparticles/Utils/Rectangle.js"(exports) {
    init_shims();
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.Rectangle = void 0;
    var Range_1 = require_Range();
    var Rectangle = class extends Range_1.Range {
      constructor(x, y, width, height) {
        super(x, y);
        this.size = {
          height,
          width
        };
      }
      contains(point) {
        const w = this.size.width;
        const h = this.size.height;
        const pos = this.position;
        return point.x >= pos.x && point.x <= pos.x + w && point.y >= pos.y && point.y <= pos.y + h;
      }
      intersects(range) {
        const rect = range;
        const circle = range;
        const w = this.size.width;
        const h = this.size.height;
        const pos1 = this.position;
        const pos2 = range.position;
        if (circle.radius !== void 0) {
          return circle.intersects(this);
        } else if (rect.size !== void 0) {
          const size2 = rect.size;
          const w2 = size2.width;
          const h2 = size2.height;
          return pos2.x < pos1.x + w && pos2.x + w2 > pos1.x && pos2.y < pos1.y + h && pos2.y + h2 > pos1.y;
        }
        return false;
      }
    };
    exports.Rectangle = Rectangle;
  }
});

// node_modules/tsparticles/Utils/CircleWarp.js
var require_CircleWarp = __commonJS({
  "node_modules/tsparticles/Utils/CircleWarp.js"(exports) {
    init_shims();
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.CircleWarp = void 0;
    var Rectangle_1 = require_Rectangle();
    var Circle_1 = require_Circle();
    var CircleWarp = class extends Circle_1.Circle {
      constructor(x, y, radius, canvasSize) {
        super(x, y, radius);
        this.canvasSize = canvasSize;
        this.canvasSize = {
          height: canvasSize.height,
          width: canvasSize.width
        };
      }
      contains(point) {
        if (super.contains(point)) {
          return true;
        }
        const posNE = {
          x: point.x - this.canvasSize.width,
          y: point.y
        };
        if (super.contains(posNE)) {
          return true;
        }
        const posSE = {
          x: point.x - this.canvasSize.width,
          y: point.y - this.canvasSize.height
        };
        if (super.contains(posSE)) {
          return true;
        }
        const posSW = {
          x: point.x,
          y: point.y - this.canvasSize.height
        };
        return super.contains(posSW);
      }
      intersects(range) {
        if (super.intersects(range)) {
          return true;
        }
        const rect = range;
        const circle = range;
        const newPos = {
          x: range.position.x - this.canvasSize.width,
          y: range.position.y - this.canvasSize.height
        };
        if (circle.radius !== void 0) {
          const biggerCircle = new Circle_1.Circle(newPos.x, newPos.y, circle.radius * 2);
          return super.intersects(biggerCircle);
        } else if (rect.size !== void 0) {
          const rectSW = new Rectangle_1.Rectangle(newPos.x, newPos.y, rect.size.width * 2, rect.size.height * 2);
          return super.intersects(rectSW);
        }
        return false;
      }
    };
    exports.CircleWarp = CircleWarp;
  }
});

// node_modules/tsparticles/Utils/EventListeners.js
var require_EventListeners = __commonJS({
  "node_modules/tsparticles/Utils/EventListeners.js"(exports) {
    init_shims();
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.EventListeners = void 0;
    var Enums_1 = require_Enums();
    var Constants_1 = require_Constants();
    var Utils_1 = require_Utils();
    function manageListener(element, event, handler, add, options2) {
      if (add) {
        let addOptions = { passive: true };
        if (typeof options2 === "boolean") {
          addOptions.capture = options2;
        } else if (options2 !== void 0) {
          addOptions = options2;
        }
        element.addEventListener(event, handler, addOptions);
      } else {
        const removeOptions = options2;
        element.removeEventListener(event, handler, removeOptions);
      }
    }
    var EventListeners = class {
      constructor(container) {
        this.container = container;
        this.canPush = true;
        this.mouseMoveHandler = (e) => this.mouseTouchMove(e);
        this.touchStartHandler = (e) => this.mouseTouchMove(e);
        this.touchMoveHandler = (e) => this.mouseTouchMove(e);
        this.touchEndHandler = () => this.mouseTouchFinish();
        this.mouseLeaveHandler = () => this.mouseTouchFinish();
        this.touchCancelHandler = () => this.mouseTouchFinish();
        this.touchEndClickHandler = (e) => this.mouseTouchClick(e);
        this.mouseUpHandler = (e) => this.mouseTouchClick(e);
        this.mouseDownHandler = () => this.mouseDown();
        this.visibilityChangeHandler = () => this.handleVisibilityChange();
        this.themeChangeHandler = (e) => this.handleThemeChange(e);
        this.oldThemeChangeHandler = (e) => this.handleThemeChange(e);
        this.resizeHandler = () => this.handleWindowResize();
      }
      addListeners() {
        this.manageListeners(true);
      }
      removeListeners() {
        this.manageListeners(false);
      }
      manageListeners(add) {
        var _a;
        const container = this.container;
        const options2 = container.actualOptions;
        const detectType = options2.interactivity.detectsOn;
        let mouseLeaveEvent = Constants_1.Constants.mouseLeaveEvent;
        if (detectType === Enums_1.InteractivityDetect.window) {
          container.interactivity.element = window;
          mouseLeaveEvent = Constants_1.Constants.mouseOutEvent;
        } else if (detectType === Enums_1.InteractivityDetect.parent && container.canvas.element) {
          const canvasEl = container.canvas.element;
          container.interactivity.element = (_a = canvasEl.parentElement) !== null && _a !== void 0 ? _a : canvasEl.parentNode;
        } else {
          container.interactivity.element = container.canvas.element;
        }
        const mediaMatch = !(0, Utils_1.isSsr)() && typeof matchMedia !== "undefined" && matchMedia("(prefers-color-scheme: dark)");
        if (mediaMatch) {
          if (mediaMatch.addEventListener !== void 0) {
            manageListener(mediaMatch, "change", this.themeChangeHandler, add);
          } else if (mediaMatch.addListener !== void 0) {
            if (add) {
              mediaMatch.addListener(this.oldThemeChangeHandler);
            } else {
              mediaMatch.removeListener(this.oldThemeChangeHandler);
            }
          }
        }
        const interactivityEl = container.interactivity.element;
        if (!interactivityEl) {
          return;
        }
        const html = interactivityEl;
        if (options2.interactivity.events.onHover.enable || options2.interactivity.events.onClick.enable) {
          manageListener(interactivityEl, Constants_1.Constants.mouseMoveEvent, this.mouseMoveHandler, add);
          manageListener(interactivityEl, Constants_1.Constants.touchStartEvent, this.touchStartHandler, add);
          manageListener(interactivityEl, Constants_1.Constants.touchMoveEvent, this.touchMoveHandler, add);
          if (!options2.interactivity.events.onClick.enable) {
            manageListener(interactivityEl, Constants_1.Constants.touchEndEvent, this.touchEndHandler, add);
          } else {
            manageListener(interactivityEl, Constants_1.Constants.touchEndEvent, this.touchEndClickHandler, add);
            manageListener(interactivityEl, Constants_1.Constants.mouseUpEvent, this.mouseUpHandler, add);
            manageListener(interactivityEl, Constants_1.Constants.mouseDownEvent, this.mouseDownHandler, add);
          }
          manageListener(interactivityEl, mouseLeaveEvent, this.mouseLeaveHandler, add);
          manageListener(interactivityEl, Constants_1.Constants.touchCancelEvent, this.touchCancelHandler, add);
        }
        if (container.canvas.element) {
          container.canvas.element.style.pointerEvents = html === container.canvas.element ? "initial" : "none";
        }
        if (options2.interactivity.events.resize) {
          if (typeof ResizeObserver !== "undefined") {
            if (this.resizeObserver && !add) {
              if (container.canvas.element) {
                this.resizeObserver.unobserve(container.canvas.element);
              }
              this.resizeObserver.disconnect();
              delete this.resizeObserver;
            } else if (!this.resizeObserver && add && container.canvas.element) {
              this.resizeObserver = new ResizeObserver((entries) => {
                const entry = entries.find((e) => e.target === container.canvas.element);
                if (!entry) {
                  return;
                }
                this.handleWindowResize();
              });
              this.resizeObserver.observe(container.canvas.element);
            }
          } else {
            manageListener(window, Constants_1.Constants.resizeEvent, this.resizeHandler, add);
          }
        }
        if (document) {
          manageListener(document, Constants_1.Constants.visibilityChangeEvent, this.visibilityChangeHandler, add, false);
        }
      }
      handleWindowResize() {
        if (this.resizeTimeout) {
          clearTimeout(this.resizeTimeout);
          delete this.resizeTimeout;
        }
        this.resizeTimeout = setTimeout(() => {
          var _a;
          return (_a = this.container.canvas) === null || _a === void 0 ? void 0 : _a.windowResize();
        }, 500);
      }
      handleVisibilityChange() {
        const container = this.container;
        const options2 = container.actualOptions;
        this.mouseTouchFinish();
        if (!options2.pauseOnBlur) {
          return;
        }
        if (document === null || document === void 0 ? void 0 : document.hidden) {
          container.pageHidden = true;
          container.pause();
        } else {
          container.pageHidden = false;
          if (container.getAnimationStatus()) {
            container.play(true);
          } else {
            container.draw(true);
          }
        }
      }
      mouseDown() {
        const interactivity = this.container.interactivity;
        if (interactivity) {
          const mouse = interactivity.mouse;
          mouse.clicking = true;
          mouse.downPosition = mouse.position;
        }
      }
      mouseTouchMove(e) {
        var _a, _b, _c, _d, _e, _f, _g;
        const container = this.container;
        const options2 = container.actualOptions;
        if (((_a = container.interactivity) === null || _a === void 0 ? void 0 : _a.element) === void 0) {
          return;
        }
        container.interactivity.mouse.inside = true;
        let pos;
        const canvas = container.canvas.element;
        if (e.type.startsWith("mouse")) {
          this.canPush = true;
          const mouseEvent = e;
          if (container.interactivity.element === window) {
            if (canvas) {
              const clientRect = canvas.getBoundingClientRect();
              pos = {
                x: mouseEvent.clientX - clientRect.left,
                y: mouseEvent.clientY - clientRect.top
              };
            }
          } else if (options2.interactivity.detectsOn === Enums_1.InteractivityDetect.parent) {
            const source = mouseEvent.target;
            const target = mouseEvent.currentTarget;
            const canvasEl = container.canvas.element;
            if (source && target && canvasEl) {
              const sourceRect = source.getBoundingClientRect();
              const targetRect = target.getBoundingClientRect();
              const canvasRect = canvasEl.getBoundingClientRect();
              pos = {
                x: mouseEvent.offsetX + 2 * sourceRect.left - (targetRect.left + canvasRect.left),
                y: mouseEvent.offsetY + 2 * sourceRect.top - (targetRect.top + canvasRect.top)
              };
            } else {
              pos = {
                x: (_b = mouseEvent.offsetX) !== null && _b !== void 0 ? _b : mouseEvent.clientX,
                y: (_c = mouseEvent.offsetY) !== null && _c !== void 0 ? _c : mouseEvent.clientY
              };
            }
          } else {
            if (mouseEvent.target === container.canvas.element) {
              pos = {
                x: (_d = mouseEvent.offsetX) !== null && _d !== void 0 ? _d : mouseEvent.clientX,
                y: (_e = mouseEvent.offsetY) !== null && _e !== void 0 ? _e : mouseEvent.clientY
              };
            }
          }
        } else {
          this.canPush = e.type !== "touchmove";
          const touchEvent = e;
          const lastTouch = touchEvent.touches[touchEvent.touches.length - 1];
          const canvasRect = canvas === null || canvas === void 0 ? void 0 : canvas.getBoundingClientRect();
          pos = {
            x: lastTouch.clientX - ((_f = canvasRect === null || canvasRect === void 0 ? void 0 : canvasRect.left) !== null && _f !== void 0 ? _f : 0),
            y: lastTouch.clientY - ((_g = canvasRect === null || canvasRect === void 0 ? void 0 : canvasRect.top) !== null && _g !== void 0 ? _g : 0)
          };
        }
        const pxRatio = container.retina.pixelRatio;
        if (pos) {
          pos.x *= pxRatio;
          pos.y *= pxRatio;
        }
        container.interactivity.mouse.position = pos;
        container.interactivity.status = Constants_1.Constants.mouseMoveEvent;
      }
      mouseTouchFinish() {
        const interactivity = this.container.interactivity;
        if (interactivity === void 0) {
          return;
        }
        const mouse = interactivity.mouse;
        delete mouse.position;
        delete mouse.clickPosition;
        delete mouse.downPosition;
        interactivity.status = Constants_1.Constants.mouseLeaveEvent;
        mouse.inside = false;
        mouse.clicking = false;
      }
      mouseTouchClick(e) {
        const container = this.container;
        const options2 = container.actualOptions;
        const mouse = container.interactivity.mouse;
        mouse.inside = true;
        let handled = false;
        const mousePosition = mouse.position;
        if (mousePosition === void 0 || !options2.interactivity.events.onClick.enable) {
          return;
        }
        for (const [, plugin] of container.plugins) {
          if (plugin.clickPositionValid !== void 0) {
            handled = plugin.clickPositionValid(mousePosition);
            if (handled) {
              break;
            }
          }
        }
        if (!handled) {
          this.doMouseTouchClick(e);
        }
        mouse.clicking = false;
      }
      doMouseTouchClick(e) {
        const container = this.container;
        const options2 = container.actualOptions;
        if (this.canPush) {
          const mousePos = container.interactivity.mouse.position;
          if (mousePos) {
            container.interactivity.mouse.clickPosition = {
              x: mousePos.x,
              y: mousePos.y
            };
          } else {
            return;
          }
          container.interactivity.mouse.clickTime = new Date().getTime();
          const onClick = options2.interactivity.events.onClick;
          if (onClick.mode instanceof Array) {
            for (const mode of onClick.mode) {
              this.handleClickMode(mode);
            }
          } else {
            this.handleClickMode(onClick.mode);
          }
        }
        if (e.type === "touchend") {
          setTimeout(() => this.mouseTouchFinish(), 500);
        }
      }
      handleThemeChange(e) {
        const mediaEvent = e;
        const themeName = mediaEvent.matches ? this.container.options.defaultDarkTheme : this.container.options.defaultLightTheme;
        const theme = this.container.options.themes.find((theme2) => theme2.name === themeName);
        if (theme && theme.default.auto) {
          this.container.loadTheme(themeName);
        }
      }
      handleClickMode(mode) {
        const container = this.container;
        const options2 = container.actualOptions;
        const pushNb = options2.interactivity.modes.push.quantity;
        const removeNb = options2.interactivity.modes.remove.quantity;
        switch (mode) {
          case Enums_1.ClickMode.push: {
            if (pushNb > 0) {
              const pushOptions = options2.interactivity.modes.push;
              const group = (0, Utils_1.itemFromArray)([void 0, ...pushOptions.groups]);
              const groupOptions = group !== void 0 ? container.actualOptions.particles.groups[group] : void 0;
              container.particles.push(pushNb, container.interactivity.mouse, groupOptions, group);
            }
            break;
          }
          case Enums_1.ClickMode.remove:
            container.particles.removeQuantity(removeNb);
            break;
          case Enums_1.ClickMode.bubble:
            container.bubble.clicking = true;
            break;
          case Enums_1.ClickMode.repulse:
            container.repulse.clicking = true;
            container.repulse.count = 0;
            for (const particle of container.repulse.particles) {
              particle.velocity.setTo(particle.initialVelocity);
            }
            container.repulse.particles = [];
            container.repulse.finish = false;
            setTimeout(() => {
              if (!container.destroyed) {
                container.repulse.clicking = false;
              }
            }, options2.interactivity.modes.repulse.duration * 1e3);
            break;
          case Enums_1.ClickMode.attract:
            container.attract.clicking = true;
            container.attract.count = 0;
            for (const particle of container.attract.particles) {
              particle.velocity.setTo(particle.initialVelocity);
            }
            container.attract.particles = [];
            container.attract.finish = false;
            setTimeout(() => {
              if (!container.destroyed) {
                container.attract.clicking = false;
              }
            }, options2.interactivity.modes.attract.duration * 1e3);
            break;
          case Enums_1.ClickMode.pause:
            if (container.getAnimationStatus()) {
              container.pause();
            } else {
              container.play();
            }
            break;
        }
        for (const [, plugin] of container.plugins) {
          if (plugin.handleClickMode) {
            plugin.handleClickMode(mode);
          }
        }
      }
    };
    exports.EventListeners = EventListeners;
  }
});

// node_modules/tsparticles/Utils/Plugins.js
var require_Plugins = __commonJS({
  "node_modules/tsparticles/Utils/Plugins.js"(exports) {
    init_shims();
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.Plugins = void 0;
    var plugins = [];
    var interactorsInitializers = new Map();
    var updatersInitializers = new Map();
    var interactors = new Map();
    var updaters = new Map();
    var presets = new Map();
    var drawers = new Map();
    var pathGenerators = new Map();
    var Plugins = class {
      static getPlugin(plugin) {
        return plugins.find((t) => t.id === plugin);
      }
      static addPlugin(plugin) {
        if (!Plugins.getPlugin(plugin.id)) {
          plugins.push(plugin);
        }
      }
      static getAvailablePlugins(container) {
        const res = new Map();
        for (const plugin of plugins) {
          if (!plugin.needsPlugin(container.actualOptions)) {
            continue;
          }
          res.set(plugin.id, plugin.getPlugin(container));
        }
        return res;
      }
      static loadOptions(options2, sourceOptions) {
        for (const plugin of plugins) {
          plugin.loadOptions(options2, sourceOptions);
        }
      }
      static getPreset(preset) {
        return presets.get(preset);
      }
      static addPreset(presetKey, options2, override = false) {
        if (override || !Plugins.getPreset(presetKey)) {
          presets.set(presetKey, options2);
        }
      }
      static addShapeDrawer(type, drawer) {
        if (!Plugins.getShapeDrawer(type)) {
          drawers.set(type, drawer);
        }
      }
      static getShapeDrawer(type) {
        return drawers.get(type);
      }
      static getSupportedShapes() {
        return drawers.keys();
      }
      static getPathGenerator(type) {
        return pathGenerators.get(type);
      }
      static addPathGenerator(type, pathGenerator) {
        if (!Plugins.getPathGenerator(type)) {
          pathGenerators.set(type, pathGenerator);
        }
      }
      static getInteractors(container, force = false) {
        let res = interactors.get(container);
        if (!res || force) {
          res = [...interactorsInitializers.values()].map((t) => t(container));
          interactors.set(container, res);
        }
        return res;
      }
      static addInteractor(name, initInteractor) {
        interactorsInitializers.set(name, initInteractor);
      }
      static getUpdaters(container, force = false) {
        let res = updaters.get(container);
        if (!res || force) {
          res = [...updatersInitializers.values()].map((t) => t(container));
          updaters.set(container, res);
        }
        return res;
      }
      static addParticleUpdater(name, initUpdater) {
        updatersInitializers.set(name, initUpdater);
      }
    };
    exports.Plugins = Plugins;
  }
});

// node_modules/tsparticles/Utils/Point.js
var require_Point = __commonJS({
  "node_modules/tsparticles/Utils/Point.js"(exports) {
    init_shims();
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.Point = void 0;
    var Point = class {
      constructor(position, particle) {
        this.position = position;
        this.particle = particle;
      }
    };
    exports.Point = Point;
  }
});

// node_modules/tsparticles/Utils/QuadTree.js
var require_QuadTree = __commonJS({
  "node_modules/tsparticles/Utils/QuadTree.js"(exports) {
    init_shims();
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.QuadTree = void 0;
    var Rectangle_1 = require_Rectangle();
    var Circle_1 = require_Circle();
    var CircleWarp_1 = require_CircleWarp();
    var NumberUtils_1 = require_NumberUtils();
    var QuadTree = class {
      constructor(rectangle, capacity) {
        this.rectangle = rectangle;
        this.capacity = capacity;
        this.points = [];
        this.divided = false;
      }
      subdivide() {
        const x = this.rectangle.position.x;
        const y = this.rectangle.position.y;
        const w = this.rectangle.size.width;
        const h = this.rectangle.size.height;
        const capacity = this.capacity;
        this.northEast = new QuadTree(new Rectangle_1.Rectangle(x, y, w / 2, h / 2), capacity);
        this.northWest = new QuadTree(new Rectangle_1.Rectangle(x + w / 2, y, w / 2, h / 2), capacity);
        this.southEast = new QuadTree(new Rectangle_1.Rectangle(x, y + h / 2, w / 2, h / 2), capacity);
        this.southWest = new QuadTree(new Rectangle_1.Rectangle(x + w / 2, y + h / 2, w / 2, h / 2), capacity);
        this.divided = true;
      }
      insert(point) {
        var _a, _b, _c, _d, _e;
        if (!this.rectangle.contains(point.position)) {
          return false;
        }
        if (this.points.length < this.capacity) {
          this.points.push(point);
          return true;
        }
        if (!this.divided) {
          this.subdivide();
        }
        return (_e = ((_a = this.northEast) === null || _a === void 0 ? void 0 : _a.insert(point)) || ((_b = this.northWest) === null || _b === void 0 ? void 0 : _b.insert(point)) || ((_c = this.southEast) === null || _c === void 0 ? void 0 : _c.insert(point)) || ((_d = this.southWest) === null || _d === void 0 ? void 0 : _d.insert(point))) !== null && _e !== void 0 ? _e : false;
      }
      queryCircle(position, radius) {
        return this.query(new Circle_1.Circle(position.x, position.y, radius));
      }
      queryCircleWarp(position, radius, containerOrSize) {
        const container = containerOrSize;
        const size = containerOrSize;
        return this.query(new CircleWarp_1.CircleWarp(position.x, position.y, radius, container.canvas !== void 0 ? container.canvas.size : size));
      }
      queryRectangle(position, size) {
        return this.query(new Rectangle_1.Rectangle(position.x, position.y, size.width, size.height));
      }
      query(range, found) {
        var _a, _b, _c, _d;
        const res = found !== null && found !== void 0 ? found : [];
        if (!range.intersects(this.rectangle)) {
          return [];
        } else {
          for (const p of this.points) {
            if (!range.contains(p.position) && (0, NumberUtils_1.getDistance)(range.position, p.position) > p.particle.getRadius()) {
              continue;
            }
            res.push(p.particle);
          }
          if (this.divided) {
            (_a = this.northEast) === null || _a === void 0 ? void 0 : _a.query(range, res);
            (_b = this.northWest) === null || _b === void 0 ? void 0 : _b.query(range, res);
            (_c = this.southEast) === null || _c === void 0 ? void 0 : _c.query(range, res);
            (_d = this.southWest) === null || _d === void 0 ? void 0 : _d.query(range, res);
          }
        }
        return res;
      }
    };
    exports.QuadTree = QuadTree;
  }
});

// node_modules/tsparticles/Utils/index.js
var require_Utils2 = __commonJS({
  "node_modules/tsparticles/Utils/index.js"(exports) {
    init_shims();
    "use strict";
    var __createBinding = exports && exports.__createBinding || (Object.create ? function(o, m, k, k2) {
      if (k2 === void 0)
        k2 = k;
      Object.defineProperty(o, k2, { enumerable: true, get: function() {
        return m[k];
      } });
    } : function(o, m, k, k2) {
      if (k2 === void 0)
        k2 = k;
      o[k2] = m[k];
    });
    var __exportStar = exports && exports.__exportStar || function(m, exports2) {
      for (var p in m)
        if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports2, p))
          __createBinding(exports2, m, p);
    };
    Object.defineProperty(exports, "__esModule", { value: true });
    __exportStar(require_CanvasUtils(), exports);
    __exportStar(require_Circle(), exports);
    __exportStar(require_CircleWarp(), exports);
    __exportStar(require_ColorUtils(), exports);
    __exportStar(require_Constants(), exports);
    __exportStar(require_EventListeners(), exports);
    __exportStar(require_NumberUtils(), exports);
    __exportStar(require_Plugins(), exports);
    __exportStar(require_Point(), exports);
    __exportStar(require_QuadTree(), exports);
    __exportStar(require_Range(), exports);
    __exportStar(require_Rectangle(), exports);
    __exportStar(require_Utils(), exports);
  }
});

// node_modules/tsparticles/Core/Canvas.js
var require_Canvas = __commonJS({
  "node_modules/tsparticles/Core/Canvas.js"(exports) {
    init_shims();
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.Canvas = void 0;
    var Utils_1 = require_Utils2();
    var Utils_2 = require_Utils2();
    var Canvas = class {
      constructor(container) {
        this.container = container;
        this.size = {
          height: 0,
          width: 0
        };
        this.context = null;
        this.generatedCanvas = false;
      }
      init() {
        this.resize();
        this.initStyle();
        this.initCover();
        this.initTrail();
        this.initBackground();
        this.paint();
      }
      loadCanvas(canvas, generatedCanvas) {
        var _a;
        if (!canvas.className) {
          canvas.className = Utils_1.Constants.canvasClass;
        }
        if (this.generatedCanvas) {
          (_a = this.element) === null || _a === void 0 ? void 0 : _a.remove();
        }
        this.generatedCanvas = generatedCanvas !== null && generatedCanvas !== void 0 ? generatedCanvas : this.generatedCanvas;
        this.element = canvas;
        this.originalStyle = (0, Utils_1.deepExtend)({}, this.element.style);
        this.size.height = canvas.offsetHeight;
        this.size.width = canvas.offsetWidth;
        this.context = this.element.getContext("2d");
        this.container.retina.init();
        this.initBackground();
      }
      destroy() {
        var _a;
        if (this.generatedCanvas) {
          (_a = this.element) === null || _a === void 0 ? void 0 : _a.remove();
        }
        this.draw((ctx) => {
          (0, Utils_2.clear)(ctx, this.size);
        });
      }
      paint() {
        const options2 = this.container.actualOptions;
        this.draw((ctx) => {
          if (options2.backgroundMask.enable && options2.backgroundMask.cover && this.coverColor) {
            (0, Utils_2.clear)(ctx, this.size);
            this.paintBase((0, Utils_1.getStyleFromRgb)(this.coverColor, this.coverColor.a));
          } else {
            this.paintBase();
          }
        });
      }
      clear() {
        const options2 = this.container.actualOptions;
        const trail = options2.particles.move.trail;
        if (options2.backgroundMask.enable) {
          this.paint();
        } else if (trail.enable && trail.length > 0 && this.trailFillColor) {
          this.paintBase((0, Utils_1.getStyleFromRgb)(this.trailFillColor, 1 / trail.length));
        } else {
          this.draw((ctx) => {
            (0, Utils_2.clear)(ctx, this.size);
          });
        }
      }
      windowResize() {
        if (!this.element) {
          return;
        }
        const container = this.container;
        this.resize();
        const needsRefresh = container.updateActualOptions();
        container.particles.setDensity();
        for (const [, plugin] of container.plugins) {
          if (plugin.resize !== void 0) {
            plugin.resize();
          }
        }
        if (needsRefresh) {
          container.refresh();
        }
      }
      resize() {
        if (!this.element) {
          return;
        }
        const container = this.container;
        const pxRatio = container.retina.pixelRatio;
        const size = container.canvas.size;
        const oldSize = {
          width: size.width,
          height: size.height
        };
        size.width = this.element.offsetWidth * pxRatio;
        size.height = this.element.offsetHeight * pxRatio;
        this.element.width = size.width;
        this.element.height = size.height;
        if (this.container.started) {
          this.resizeFactor = {
            width: size.width / oldSize.width,
            height: size.height / oldSize.height
          };
        }
      }
      drawConnectLine(p1, p2) {
        this.draw((ctx) => {
          var _a;
          const lineStyle = this.lineStyle(p1, p2);
          if (!lineStyle) {
            return;
          }
          const pos1 = p1.getPosition();
          const pos2 = p2.getPosition();
          (0, Utils_1.drawConnectLine)(ctx, (_a = p1.retina.linksWidth) !== null && _a !== void 0 ? _a : this.container.retina.linksWidth, lineStyle, pos1, pos2);
        });
      }
      drawGrabLine(particle, lineColor, opacity, mousePos) {
        const container = this.container;
        this.draw((ctx) => {
          var _a;
          const beginPos = particle.getPosition();
          (0, Utils_1.drawGrabLine)(ctx, (_a = particle.retina.linksWidth) !== null && _a !== void 0 ? _a : container.retina.linksWidth, beginPos, mousePos, lineColor, opacity);
        });
      }
      drawParticle(particle, delta) {
        var _a, _b, _c, _d, _e, _f;
        if (particle.spawning || particle.destroyed) {
          return;
        }
        const pfColor = particle.getFillColor();
        const psColor = (_a = particle.getStrokeColor()) !== null && _a !== void 0 ? _a : pfColor;
        if (!pfColor && !psColor) {
          return;
        }
        let [fColor, sColor] = this.getPluginParticleColors(particle);
        const pOptions = particle.options;
        const twinkle = pOptions.twinkle.particles;
        const twinkling = twinkle.enable && Math.random() < twinkle.frequency;
        if (!fColor || !sColor) {
          const twinkleRgb = (0, Utils_1.colorToHsl)(twinkle.color);
          if (!fColor) {
            fColor = twinkling && twinkleRgb !== void 0 ? twinkleRgb : pfColor ? pfColor : void 0;
          }
          if (!sColor) {
            sColor = twinkling && twinkleRgb !== void 0 ? twinkleRgb : psColor ? psColor : void 0;
          }
        }
        const options2 = this.container.actualOptions;
        const zIndexOptions = particle.options.zIndex;
        const zOpacityFactor = (1 - particle.zIndexFactor) ** zIndexOptions.opacityRate;
        const radius = particle.getRadius();
        const opacity = twinkling ? twinkle.opacity : (_d = (_b = particle.bubble.opacity) !== null && _b !== void 0 ? _b : (_c = particle.opacity) === null || _c === void 0 ? void 0 : _c.value) !== null && _d !== void 0 ? _d : 1;
        const strokeOpacity = (_f = (_e = particle.stroke) === null || _e === void 0 ? void 0 : _e.opacity) !== null && _f !== void 0 ? _f : opacity;
        const zOpacity = opacity * zOpacityFactor;
        const fillColorValue = fColor ? (0, Utils_1.getStyleFromHsl)(fColor, zOpacity) : void 0;
        if (!fillColorValue && !sColor) {
          return;
        }
        this.draw((ctx) => {
          const zSizeFactor = (1 - particle.zIndexFactor) ** zIndexOptions.sizeRate;
          const zStrokeOpacity = strokeOpacity * zOpacityFactor;
          const strokeColorValue = sColor ? (0, Utils_1.getStyleFromHsl)(sColor, zStrokeOpacity) : fillColorValue;
          if (radius <= 0) {
            return;
          }
          const container = this.container;
          for (const updater of container.particles.updaters) {
            if (updater.beforeDraw) {
              updater.beforeDraw(particle);
            }
          }
          (0, Utils_1.drawParticle)(this.container, ctx, particle, delta, fillColorValue, strokeColorValue, options2.backgroundMask.enable, options2.backgroundMask.composite, radius * zSizeFactor, zOpacity, particle.options.shadow, particle.gradient);
          for (const updater of container.particles.updaters) {
            if (updater.afterDraw) {
              updater.afterDraw(particle);
            }
          }
        });
      }
      drawPlugin(plugin, delta) {
        this.draw((ctx) => {
          (0, Utils_1.drawPlugin)(ctx, plugin, delta);
        });
      }
      drawParticlePlugin(plugin, particle, delta) {
        this.draw((ctx) => {
          (0, Utils_1.drawParticlePlugin)(ctx, plugin, particle, delta);
        });
      }
      initBackground() {
        const options2 = this.container.actualOptions;
        const background = options2.background;
        const element = this.element;
        const elementStyle = element === null || element === void 0 ? void 0 : element.style;
        if (!elementStyle) {
          return;
        }
        if (background.color) {
          const color = (0, Utils_1.colorToRgb)(background.color);
          elementStyle.backgroundColor = color ? (0, Utils_1.getStyleFromRgb)(color, background.opacity) : "";
        } else {
          elementStyle.backgroundColor = "";
        }
        elementStyle.backgroundImage = background.image || "";
        elementStyle.backgroundPosition = background.position || "";
        elementStyle.backgroundRepeat = background.repeat || "";
        elementStyle.backgroundSize = background.size || "";
      }
      draw(cb) {
        if (!this.context) {
          return;
        }
        return cb(this.context);
      }
      initCover() {
        const options2 = this.container.actualOptions;
        const cover = options2.backgroundMask.cover;
        const color = cover.color;
        const coverRgb = (0, Utils_1.colorToRgb)(color);
        if (coverRgb) {
          this.coverColor = {
            r: coverRgb.r,
            g: coverRgb.g,
            b: coverRgb.b,
            a: cover.opacity
          };
        }
      }
      initTrail() {
        const options2 = this.container.actualOptions;
        const trail = options2.particles.move.trail;
        const fillColor = (0, Utils_1.colorToRgb)(trail.fillColor);
        if (fillColor) {
          const trail2 = options2.particles.move.trail;
          this.trailFillColor = {
            r: fillColor.r,
            g: fillColor.g,
            b: fillColor.b,
            a: 1 / trail2.length
          };
        }
      }
      getPluginParticleColors(particle) {
        let fColor;
        let sColor;
        for (const [, plugin] of this.container.plugins) {
          if (!fColor && plugin.particleFillColor) {
            fColor = (0, Utils_1.colorToHsl)(plugin.particleFillColor(particle));
          }
          if (!sColor && plugin.particleStrokeColor) {
            sColor = (0, Utils_1.colorToHsl)(plugin.particleStrokeColor(particle));
          }
          if (fColor && sColor) {
            break;
          }
        }
        return [fColor, sColor];
      }
      initStyle() {
        const element = this.element, options2 = this.container.actualOptions;
        if (!element) {
          return;
        }
        const originalStyle = this.originalStyle;
        if (options2.fullScreen.enable) {
          this.originalStyle = (0, Utils_1.deepExtend)({}, element.style);
          element.style.position = "fixed";
          element.style.zIndex = options2.fullScreen.zIndex.toString(10);
          element.style.top = "0";
          element.style.left = "0";
          element.style.width = "100%";
          element.style.height = "100%";
        } else if (originalStyle) {
          element.style.position = originalStyle.position;
          element.style.zIndex = originalStyle.zIndex;
          element.style.top = originalStyle.top;
          element.style.left = originalStyle.left;
          element.style.width = originalStyle.width;
          element.style.height = originalStyle.height;
        }
      }
      paintBase(baseColor) {
        this.draw((ctx) => {
          (0, Utils_1.paintBase)(ctx, this.size, baseColor);
        });
      }
      lineStyle(p1, p2) {
        return this.draw((ctx) => {
          const options2 = this.container.actualOptions;
          const connectOptions = options2.interactivity.modes.connect;
          return (0, Utils_1.gradient)(ctx, p1, p2, connectOptions.links.opacity);
        });
      }
    };
    exports.Canvas = Canvas;
  }
});

// node_modules/tsparticles/Options/Classes/OptionsColor.js
var require_OptionsColor = __commonJS({
  "node_modules/tsparticles/Options/Classes/OptionsColor.js"(exports) {
    init_shims();
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.OptionsColor = void 0;
    var OptionsColor = class {
      constructor() {
        this.value = "#fff";
      }
      static create(source, data) {
        const color = new OptionsColor();
        color.load(source);
        if (data !== void 0) {
          if (typeof data === "string" || data instanceof Array) {
            color.load({ value: data });
          } else {
            color.load(data);
          }
        }
        return color;
      }
      load(data) {
        if ((data === null || data === void 0 ? void 0 : data.value) === void 0) {
          return;
        }
        this.value = data.value;
      }
    };
    exports.OptionsColor = OptionsColor;
  }
});

// node_modules/tsparticles/Options/Classes/Particles/Links/LinksShadow.js
var require_LinksShadow = __commonJS({
  "node_modules/tsparticles/Options/Classes/Particles/Links/LinksShadow.js"(exports) {
    init_shims();
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.LinksShadow = void 0;
    var OptionsColor_1 = require_OptionsColor();
    var LinksShadow = class {
      constructor() {
        this.blur = 5;
        this.color = new OptionsColor_1.OptionsColor();
        this.enable = false;
        this.color.value = "#00ff00";
      }
      load(data) {
        if (data === void 0) {
          return;
        }
        if (data.blur !== void 0) {
          this.blur = data.blur;
        }
        this.color = OptionsColor_1.OptionsColor.create(this.color, data.color);
        if (data.enable !== void 0) {
          this.enable = data.enable;
        }
      }
    };
    exports.LinksShadow = LinksShadow;
  }
});

// node_modules/tsparticles/Options/Classes/Particles/Links/LinksTriangle.js
var require_LinksTriangle = __commonJS({
  "node_modules/tsparticles/Options/Classes/Particles/Links/LinksTriangle.js"(exports) {
    init_shims();
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.LinksTriangle = void 0;
    var OptionsColor_1 = require_OptionsColor();
    var LinksTriangle = class {
      constructor() {
        this.enable = false;
        this.frequency = 1;
      }
      load(data) {
        if (data === void 0) {
          return;
        }
        if (data.color !== void 0) {
          this.color = OptionsColor_1.OptionsColor.create(this.color, data.color);
        }
        if (data.enable !== void 0) {
          this.enable = data.enable;
        }
        if (data.frequency !== void 0) {
          this.frequency = data.frequency;
        }
        if (data.opacity !== void 0) {
          this.opacity = data.opacity;
        }
      }
    };
    exports.LinksTriangle = LinksTriangle;
  }
});

// node_modules/tsparticles/Options/Classes/Particles/Links/Links.js
var require_Links = __commonJS({
  "node_modules/tsparticles/Options/Classes/Particles/Links/Links.js"(exports) {
    init_shims();
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.Links = void 0;
    var LinksShadow_1 = require_LinksShadow();
    var LinksTriangle_1 = require_LinksTriangle();
    var OptionsColor_1 = require_OptionsColor();
    var Links = class {
      constructor() {
        this.blink = false;
        this.color = new OptionsColor_1.OptionsColor();
        this.consent = false;
        this.distance = 100;
        this.enable = false;
        this.frequency = 1;
        this.opacity = 1;
        this.shadow = new LinksShadow_1.LinksShadow();
        this.triangles = new LinksTriangle_1.LinksTriangle();
        this.width = 1;
        this.warp = false;
      }
      load(data) {
        if (data === void 0) {
          return;
        }
        if (data.id !== void 0) {
          this.id = data.id;
        }
        if (data.blink !== void 0) {
          this.blink = data.blink;
        }
        this.color = OptionsColor_1.OptionsColor.create(this.color, data.color);
        if (data.consent !== void 0) {
          this.consent = data.consent;
        }
        if (data.distance !== void 0) {
          this.distance = data.distance;
        }
        if (data.enable !== void 0) {
          this.enable = data.enable;
        }
        if (data.frequency !== void 0) {
          this.frequency = data.frequency;
        }
        if (data.opacity !== void 0) {
          this.opacity = data.opacity;
        }
        this.shadow.load(data.shadow);
        this.triangles.load(data.triangles);
        if (data.width !== void 0) {
          this.width = data.width;
        }
        if (data.warp !== void 0) {
          this.warp = data.warp;
        }
      }
    };
    exports.Links = Links;
  }
});

// node_modules/tsparticles/Options/Classes/Particles/Move/Attract.js
var require_Attract = __commonJS({
  "node_modules/tsparticles/Options/Classes/Particles/Move/Attract.js"(exports) {
    init_shims();
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.Attract = void 0;
    var Attract = class {
      constructor() {
        this.distance = 200;
        this.enable = false;
        this.rotate = {
          x: 3e3,
          y: 3e3
        };
      }
      get rotateX() {
        return this.rotate.x;
      }
      set rotateX(value) {
        this.rotate.x = value;
      }
      get rotateY() {
        return this.rotate.y;
      }
      set rotateY(value) {
        this.rotate.y = value;
      }
      load(data) {
        var _a, _b, _c, _d;
        if (!data) {
          return;
        }
        if (data.distance !== void 0) {
          this.distance = data.distance;
        }
        if (data.enable !== void 0) {
          this.enable = data.enable;
        }
        const rotateX = (_b = (_a = data.rotate) === null || _a === void 0 ? void 0 : _a.x) !== null && _b !== void 0 ? _b : data.rotateX;
        if (rotateX !== void 0) {
          this.rotate.x = rotateX;
        }
        const rotateY = (_d = (_c = data.rotate) === null || _c === void 0 ? void 0 : _c.y) !== null && _d !== void 0 ? _d : data.rotateY;
        if (rotateY !== void 0) {
          this.rotate.y = rotateY;
        }
      }
    };
    exports.Attract = Attract;
  }
});

// node_modules/tsparticles/Options/Classes/Particles/Move/Trail.js
var require_Trail = __commonJS({
  "node_modules/tsparticles/Options/Classes/Particles/Move/Trail.js"(exports) {
    init_shims();
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.Trail = void 0;
    var OptionsColor_1 = require_OptionsColor();
    var Trail = class {
      constructor() {
        this.enable = false;
        this.length = 10;
        this.fillColor = new OptionsColor_1.OptionsColor();
        this.fillColor.value = "#000000";
      }
      load(data) {
        if (data === void 0) {
          return;
        }
        if (data.enable !== void 0) {
          this.enable = data.enable;
        }
        this.fillColor = OptionsColor_1.OptionsColor.create(this.fillColor, data.fillColor);
        if (data.length !== void 0) {
          this.length = data.length;
        }
      }
    };
    exports.Trail = Trail;
  }
});

// node_modules/tsparticles/Options/Classes/Random.js
var require_Random = __commonJS({
  "node_modules/tsparticles/Options/Classes/Random.js"(exports) {
    init_shims();
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.Random = void 0;
    var Random = class {
      constructor() {
        this.enable = false;
        this.minimumValue = 0;
      }
      load(data) {
        if (!data) {
          return;
        }
        if (data.enable !== void 0) {
          this.enable = data.enable;
        }
        if (data.minimumValue !== void 0) {
          this.minimumValue = data.minimumValue;
        }
      }
    };
    exports.Random = Random;
  }
});

// node_modules/tsparticles/Options/Classes/ValueWithRandom.js
var require_ValueWithRandom = __commonJS({
  "node_modules/tsparticles/Options/Classes/ValueWithRandom.js"(exports) {
    init_shims();
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.ValueWithRandom = void 0;
    var Random_1 = require_Random();
    var Utils_1 = require_Utils2();
    var ValueWithRandom = class {
      constructor() {
        this.random = new Random_1.Random();
        this.value = 0;
      }
      load(data) {
        if (!data) {
          return;
        }
        if (typeof data.random === "boolean") {
          this.random.enable = data.random;
        } else {
          this.random.load(data.random);
        }
        if (data.value !== void 0) {
          this.value = (0, Utils_1.setRangeValue)(data.value, this.random.enable ? this.random.minimumValue : void 0);
        }
      }
    };
    exports.ValueWithRandom = ValueWithRandom;
  }
});

// node_modules/tsparticles/Options/Classes/Particles/Move/Path/PathDelay.js
var require_PathDelay = __commonJS({
  "node_modules/tsparticles/Options/Classes/Particles/Move/Path/PathDelay.js"(exports) {
    init_shims();
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.PathDelay = void 0;
    var ValueWithRandom_1 = require_ValueWithRandom();
    var PathDelay = class extends ValueWithRandom_1.ValueWithRandom {
      constructor() {
        super();
      }
    };
    exports.PathDelay = PathDelay;
  }
});

// node_modules/tsparticles/Options/Classes/Particles/Move/Path/Path.js
var require_Path = __commonJS({
  "node_modules/tsparticles/Options/Classes/Particles/Move/Path/Path.js"(exports) {
    init_shims();
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.Path = void 0;
    var PathDelay_1 = require_PathDelay();
    var Utils_1 = require_Utils2();
    var Path = class {
      constructor() {
        this.clamp = true;
        this.delay = new PathDelay_1.PathDelay();
        this.enable = false;
        this.options = {};
      }
      load(data) {
        if (data === void 0) {
          return;
        }
        if (data.clamp !== void 0) {
          this.clamp = data.clamp;
        }
        this.delay.load(data.delay);
        if (data.enable !== void 0) {
          this.enable = data.enable;
        }
        this.generator = data.generator;
        if (data.options) {
          this.options = (0, Utils_1.deepExtend)(this.options, data.options);
        }
      }
    };
    exports.Path = Path;
  }
});

// node_modules/tsparticles/Options/Classes/Particles/Move/MoveAngle.js
var require_MoveAngle = __commonJS({
  "node_modules/tsparticles/Options/Classes/Particles/Move/MoveAngle.js"(exports) {
    init_shims();
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.MoveAngle = void 0;
    var MoveAngle = class {
      constructor() {
        this.offset = 0;
        this.value = 90;
      }
      load(data) {
        if (data === void 0) {
          return;
        }
        if (data.offset !== void 0) {
          this.offset = data.offset;
        }
        if (data.value !== void 0) {
          this.value = data.value;
        }
      }
    };
    exports.MoveAngle = MoveAngle;
  }
});

// node_modules/tsparticles/Options/Classes/Particles/Move/MoveGravity.js
var require_MoveGravity = __commonJS({
  "node_modules/tsparticles/Options/Classes/Particles/Move/MoveGravity.js"(exports) {
    init_shims();
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.MoveGravity = void 0;
    var MoveGravity = class {
      constructor() {
        this.acceleration = 9.81;
        this.enable = false;
        this.inverse = false;
        this.maxSpeed = 50;
      }
      load(data) {
        if (!data) {
          return;
        }
        if (data.acceleration !== void 0) {
          this.acceleration = data.acceleration;
        }
        if (data.enable !== void 0) {
          this.enable = data.enable;
        }
        if (data.inverse !== void 0) {
          this.inverse = data.inverse;
        }
        if (data.maxSpeed !== void 0) {
          this.maxSpeed = data.maxSpeed;
        }
      }
    };
    exports.MoveGravity = MoveGravity;
  }
});

// node_modules/tsparticles/Options/Classes/Particles/Move/OutModes.js
var require_OutModes = __commonJS({
  "node_modules/tsparticles/Options/Classes/Particles/Move/OutModes.js"(exports) {
    init_shims();
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.OutModes = void 0;
    var Modes_1 = require_Modes();
    var OutModes = class {
      constructor() {
        this.default = Modes_1.OutMode.out;
      }
      load(data) {
        var _a, _b, _c, _d;
        if (!data) {
          return;
        }
        if (data.default !== void 0) {
          this.default = data.default;
        }
        this.bottom = (_a = data.bottom) !== null && _a !== void 0 ? _a : data.default;
        this.left = (_b = data.left) !== null && _b !== void 0 ? _b : data.default;
        this.right = (_c = data.right) !== null && _c !== void 0 ? _c : data.default;
        this.top = (_d = data.top) !== null && _d !== void 0 ? _d : data.default;
      }
    };
    exports.OutModes = OutModes;
  }
});

// node_modules/tsparticles/Options/Classes/Particles/Move/Spin.js
var require_Spin = __commonJS({
  "node_modules/tsparticles/Options/Classes/Particles/Move/Spin.js"(exports) {
    init_shims();
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.Spin = void 0;
    var Utils_1 = require_Utils2();
    var Spin = class {
      constructor() {
        this.acceleration = 0;
        this.enable = false;
      }
      load(data) {
        if (!data) {
          return;
        }
        if (data.acceleration !== void 0) {
          this.acceleration = (0, Utils_1.setRangeValue)(data.acceleration);
        }
        if (data.enable !== void 0) {
          this.enable = data.enable;
        }
        this.position = data.position ? (0, Utils_1.deepExtend)({}, data.position) : void 0;
      }
    };
    exports.Spin = Spin;
  }
});

// node_modules/tsparticles/Options/Classes/Particles/Move/Move.js
var require_Move = __commonJS({
  "node_modules/tsparticles/Options/Classes/Particles/Move/Move.js"(exports) {
    init_shims();
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.Move = void 0;
    var Attract_1 = require_Attract();
    var Enums_1 = require_Enums();
    var Trail_1 = require_Trail();
    var Path_1 = require_Path();
    var MoveAngle_1 = require_MoveAngle();
    var MoveGravity_1 = require_MoveGravity();
    var OutModes_1 = require_OutModes();
    var Utils_1 = require_Utils2();
    var Spin_1 = require_Spin();
    var Move = class {
      constructor() {
        this.angle = new MoveAngle_1.MoveAngle();
        this.attract = new Attract_1.Attract();
        this.decay = 0;
        this.distance = {};
        this.direction = Enums_1.MoveDirection.none;
        this.drift = 0;
        this.enable = false;
        this.gravity = new MoveGravity_1.MoveGravity();
        this.path = new Path_1.Path();
        this.outModes = new OutModes_1.OutModes();
        this.random = false;
        this.size = false;
        this.speed = 2;
        this.spin = new Spin_1.Spin();
        this.straight = false;
        this.trail = new Trail_1.Trail();
        this.vibrate = false;
        this.warp = false;
      }
      get collisions() {
        return false;
      }
      set collisions(value) {
      }
      get bounce() {
        return this.collisions;
      }
      set bounce(value) {
        this.collisions = value;
      }
      get out_mode() {
        return this.outMode;
      }
      set out_mode(value) {
        this.outMode = value;
      }
      get outMode() {
        return this.outModes.default;
      }
      set outMode(value) {
        this.outModes.default = value;
      }
      get noise() {
        return this.path;
      }
      set noise(value) {
        this.path = value;
      }
      load(data) {
        var _a, _b, _c;
        if (data === void 0) {
          return;
        }
        if (data.angle !== void 0) {
          if (typeof data.angle === "number") {
            this.angle.value = data.angle;
          } else {
            this.angle.load(data.angle);
          }
        }
        this.attract.load(data.attract);
        if (data.decay !== void 0) {
          this.decay = data.decay;
        }
        if (data.direction !== void 0) {
          this.direction = data.direction;
        }
        if (data.distance !== void 0) {
          this.distance = typeof data.distance === "number" ? {
            horizontal: data.distance,
            vertical: data.distance
          } : (0, Utils_1.deepExtend)({}, data.distance);
        }
        if (data.drift !== void 0) {
          this.drift = (0, Utils_1.setRangeValue)(data.drift);
        }
        if (data.enable !== void 0) {
          this.enable = data.enable;
        }
        this.gravity.load(data.gravity);
        const outMode = (_a = data.outMode) !== null && _a !== void 0 ? _a : data.out_mode;
        if (data.outModes !== void 0 || outMode !== void 0) {
          if (typeof data.outModes === "string" || data.outModes === void 0 && outMode !== void 0) {
            this.outModes.load({
              default: (_b = data.outModes) !== null && _b !== void 0 ? _b : outMode
            });
          } else {
            this.outModes.load(data.outModes);
          }
        }
        this.path.load((_c = data.path) !== null && _c !== void 0 ? _c : data.noise);
        if (data.random !== void 0) {
          this.random = data.random;
        }
        if (data.size !== void 0) {
          this.size = data.size;
        }
        if (data.speed !== void 0) {
          this.speed = (0, Utils_1.setRangeValue)(data.speed);
        }
        this.spin.load(data.spin);
        if (data.straight !== void 0) {
          this.straight = data.straight;
        }
        this.trail.load(data.trail);
        if (data.vibrate !== void 0) {
          this.vibrate = data.vibrate;
        }
        if (data.warp !== void 0) {
          this.warp = data.warp;
        }
      }
    };
    exports.Move = Move;
  }
});

// node_modules/tsparticles/Options/Classes/Particles/Number/Density.js
var require_Density = __commonJS({
  "node_modules/tsparticles/Options/Classes/Particles/Number/Density.js"(exports) {
    init_shims();
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.Density = void 0;
    var Density = class {
      constructor() {
        this.enable = false;
        this.area = 800;
        this.factor = 1e3;
      }
      get value_area() {
        return this.area;
      }
      set value_area(value) {
        this.area = value;
      }
      load(data) {
        var _a;
        if (data === void 0) {
          return;
        }
        if (data.enable !== void 0) {
          this.enable = data.enable;
        }
        const area = (_a = data.area) !== null && _a !== void 0 ? _a : data.value_area;
        if (area !== void 0) {
          this.area = area;
        }
        if (data.factor !== void 0) {
          this.factor = data.factor;
        }
      }
    };
    exports.Density = Density;
  }
});

// node_modules/tsparticles/Options/Classes/Particles/Number/ParticlesNumber.js
var require_ParticlesNumber = __commonJS({
  "node_modules/tsparticles/Options/Classes/Particles/Number/ParticlesNumber.js"(exports) {
    init_shims();
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.ParticlesNumber = void 0;
    var Density_1 = require_Density();
    var ParticlesNumber = class {
      constructor() {
        this.density = new Density_1.Density();
        this.limit = 0;
        this.value = 100;
      }
      get max() {
        return this.limit;
      }
      set max(value) {
        this.limit = value;
      }
      load(data) {
        var _a;
        if (data === void 0) {
          return;
        }
        this.density.load(data.density);
        const limit = (_a = data.limit) !== null && _a !== void 0 ? _a : data.max;
        if (limit !== void 0) {
          this.limit = limit;
        }
        if (data.value !== void 0) {
          this.value = data.value;
        }
      }
    };
    exports.ParticlesNumber = ParticlesNumber;
  }
});

// node_modules/tsparticles/Options/Classes/AnimationOptions.js
var require_AnimationOptions = __commonJS({
  "node_modules/tsparticles/Options/Classes/AnimationOptions.js"(exports) {
    init_shims();
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.AnimationOptions = void 0;
    var AnimationOptions = class {
      constructor() {
        this.count = 0;
        this.enable = false;
        this.speed = 1;
        this.sync = false;
      }
      load(data) {
        if (!data) {
          return;
        }
        if (data.count !== void 0) {
          this.count = data.count;
        }
        if (data.enable !== void 0) {
          this.enable = data.enable;
        }
        if (data.speed !== void 0) {
          this.speed = data.speed;
        }
        if (data.sync !== void 0) {
          this.sync = data.sync;
        }
      }
    };
    exports.AnimationOptions = AnimationOptions;
  }
});

// node_modules/tsparticles/Options/Classes/Particles/Opacity/OpacityAnimation.js
var require_OpacityAnimation = __commonJS({
  "node_modules/tsparticles/Options/Classes/Particles/Opacity/OpacityAnimation.js"(exports) {
    init_shims();
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.OpacityAnimation = void 0;
    var Enums_1 = require_Enums();
    var AnimationOptions_1 = require_AnimationOptions();
    var OpacityAnimation = class extends AnimationOptions_1.AnimationOptions {
      constructor() {
        super();
        this.destroy = Enums_1.DestroyType.none;
        this.enable = false;
        this.speed = 2;
        this.startValue = Enums_1.StartValueType.random;
        this.sync = false;
      }
      get opacity_min() {
        return this.minimumValue;
      }
      set opacity_min(value) {
        this.minimumValue = value;
      }
      load(data) {
        var _a;
        if (data === void 0) {
          return;
        }
        super.load(data);
        if (data.destroy !== void 0) {
          this.destroy = data.destroy;
        }
        if (data.enable !== void 0) {
          this.enable = data.enable;
        }
        this.minimumValue = (_a = data.minimumValue) !== null && _a !== void 0 ? _a : data.opacity_min;
        if (data.speed !== void 0) {
          this.speed = data.speed;
        }
        if (data.startValue !== void 0) {
          this.startValue = data.startValue;
        }
        if (data.sync !== void 0) {
          this.sync = data.sync;
        }
      }
    };
    exports.OpacityAnimation = OpacityAnimation;
  }
});

// node_modules/tsparticles/Options/Classes/Particles/Opacity/Opacity.js
var require_Opacity = __commonJS({
  "node_modules/tsparticles/Options/Classes/Particles/Opacity/Opacity.js"(exports) {
    init_shims();
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.Opacity = void 0;
    var OpacityAnimation_1 = require_OpacityAnimation();
    var ValueWithRandom_1 = require_ValueWithRandom();
    var Utils_1 = require_Utils2();
    var Opacity = class extends ValueWithRandom_1.ValueWithRandom {
      constructor() {
        super();
        this.animation = new OpacityAnimation_1.OpacityAnimation();
        this.random.minimumValue = 0.1;
        this.value = 1;
      }
      get anim() {
        return this.animation;
      }
      set anim(value) {
        this.animation = value;
      }
      load(data) {
        var _a;
        if (!data) {
          return;
        }
        super.load(data);
        const animation = (_a = data.animation) !== null && _a !== void 0 ? _a : data.anim;
        if (animation !== void 0) {
          this.animation.load(animation);
          this.value = (0, Utils_1.setRangeValue)(this.value, this.animation.enable ? this.animation.minimumValue : void 0);
        }
      }
    };
    exports.Opacity = Opacity;
  }
});

// node_modules/tsparticles/Options/Classes/Particles/Shape/Shape.js
var require_Shape = __commonJS({
  "node_modules/tsparticles/Options/Classes/Particles/Shape/Shape.js"(exports) {
    init_shims();
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.Shape = void 0;
    var Enums_1 = require_Enums();
    var Utils_1 = require_Utils2();
    var Shape = class {
      constructor() {
        this.options = {};
        this.type = Enums_1.ShapeType.circle;
      }
      get image() {
        var _a;
        return (_a = this.options[Enums_1.ShapeType.image]) !== null && _a !== void 0 ? _a : this.options[Enums_1.ShapeType.images];
      }
      set image(value) {
        this.options[Enums_1.ShapeType.image] = value;
        this.options[Enums_1.ShapeType.images] = value;
      }
      get custom() {
        return this.options;
      }
      set custom(value) {
        this.options = value;
      }
      get images() {
        return this.image;
      }
      set images(value) {
        this.image = value;
      }
      get stroke() {
        return [];
      }
      set stroke(_value) {
      }
      get character() {
        var _a;
        return (_a = this.options[Enums_1.ShapeType.character]) !== null && _a !== void 0 ? _a : this.options[Enums_1.ShapeType.char];
      }
      set character(value) {
        this.options[Enums_1.ShapeType.character] = value;
        this.options[Enums_1.ShapeType.char] = value;
      }
      get polygon() {
        var _a;
        return (_a = this.options[Enums_1.ShapeType.polygon]) !== null && _a !== void 0 ? _a : this.options[Enums_1.ShapeType.star];
      }
      set polygon(value) {
        this.options[Enums_1.ShapeType.polygon] = value;
        this.options[Enums_1.ShapeType.star] = value;
      }
      load(data) {
        var _a, _b, _c;
        if (data === void 0) {
          return;
        }
        const options2 = (_a = data.options) !== null && _a !== void 0 ? _a : data.custom;
        if (options2 !== void 0) {
          for (const shape in options2) {
            const item = options2[shape];
            if (item !== void 0) {
              this.options[shape] = (0, Utils_1.deepExtend)((_b = this.options[shape]) !== null && _b !== void 0 ? _b : {}, item);
            }
          }
        }
        this.loadShape(data.character, Enums_1.ShapeType.character, Enums_1.ShapeType.char, true);
        this.loadShape(data.polygon, Enums_1.ShapeType.polygon, Enums_1.ShapeType.star, false);
        this.loadShape((_c = data.image) !== null && _c !== void 0 ? _c : data.images, Enums_1.ShapeType.image, Enums_1.ShapeType.images, true);
        if (data.type !== void 0) {
          this.type = data.type;
        }
      }
      loadShape(item, mainKey, altKey, altOverride) {
        var _a, _b, _c, _d;
        if (item === void 0) {
          return;
        }
        if (item instanceof Array) {
          if (!(this.options[mainKey] instanceof Array)) {
            this.options[mainKey] = [];
            if (!this.options[altKey] || altOverride) {
              this.options[altKey] = [];
            }
          }
          this.options[mainKey] = (0, Utils_1.deepExtend)((_a = this.options[mainKey]) !== null && _a !== void 0 ? _a : [], item);
          if (!this.options[altKey] || altOverride) {
            this.options[altKey] = (0, Utils_1.deepExtend)((_b = this.options[altKey]) !== null && _b !== void 0 ? _b : [], item);
          }
        } else {
          if (this.options[mainKey] instanceof Array) {
            this.options[mainKey] = {};
            if (!this.options[altKey] || altOverride) {
              this.options[altKey] = {};
            }
          }
          this.options[mainKey] = (0, Utils_1.deepExtend)((_c = this.options[mainKey]) !== null && _c !== void 0 ? _c : {}, item);
          if (!this.options[altKey] || altOverride) {
            this.options[altKey] = (0, Utils_1.deepExtend)((_d = this.options[altKey]) !== null && _d !== void 0 ? _d : {}, item);
          }
        }
      }
    };
    exports.Shape = Shape;
  }
});

// node_modules/tsparticles/Options/Classes/Particles/Size/SizeAnimation.js
var require_SizeAnimation = __commonJS({
  "node_modules/tsparticles/Options/Classes/Particles/Size/SizeAnimation.js"(exports) {
    init_shims();
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.SizeAnimation = void 0;
    var Enums_1 = require_Enums();
    var AnimationOptions_1 = require_AnimationOptions();
    var SizeAnimation = class extends AnimationOptions_1.AnimationOptions {
      constructor() {
        super();
        this.destroy = Enums_1.DestroyType.none;
        this.enable = false;
        this.speed = 5;
        this.startValue = Enums_1.StartValueType.random;
        this.sync = false;
      }
      get size_min() {
        return this.minimumValue;
      }
      set size_min(value) {
        this.minimumValue = value;
      }
      load(data) {
        var _a;
        if (data === void 0) {
          return;
        }
        super.load(data);
        if (data.destroy !== void 0) {
          this.destroy = data.destroy;
        }
        if (data.enable !== void 0) {
          this.enable = data.enable;
        }
        this.minimumValue = (_a = data.minimumValue) !== null && _a !== void 0 ? _a : data.size_min;
        if (data.speed !== void 0) {
          this.speed = data.speed;
        }
        if (data.startValue !== void 0) {
          this.startValue = data.startValue;
        }
        if (data.sync !== void 0) {
          this.sync = data.sync;
        }
      }
    };
    exports.SizeAnimation = SizeAnimation;
  }
});

// node_modules/tsparticles/Options/Classes/Particles/Size/Size.js
var require_Size = __commonJS({
  "node_modules/tsparticles/Options/Classes/Particles/Size/Size.js"(exports) {
    init_shims();
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.Size = void 0;
    var SizeAnimation_1 = require_SizeAnimation();
    var ValueWithRandom_1 = require_ValueWithRandom();
    var Utils_1 = require_Utils2();
    var Size = class extends ValueWithRandom_1.ValueWithRandom {
      constructor() {
        super();
        this.animation = new SizeAnimation_1.SizeAnimation();
        this.random.minimumValue = 1;
        this.value = 3;
      }
      get anim() {
        return this.animation;
      }
      set anim(value) {
        this.animation = value;
      }
      load(data) {
        var _a;
        if (!data) {
          return;
        }
        super.load(data);
        const animation = (_a = data.animation) !== null && _a !== void 0 ? _a : data.anim;
        if (animation !== void 0) {
          this.animation.load(animation);
          this.value = (0, Utils_1.setRangeValue)(this.value, this.animation.enable ? this.animation.minimumValue : void 0);
        }
      }
    };
    exports.Size = Size;
  }
});

// node_modules/tsparticles/Options/Classes/Particles/Rotate/RotateAnimation.js
var require_RotateAnimation = __commonJS({
  "node_modules/tsparticles/Options/Classes/Particles/Rotate/RotateAnimation.js"(exports) {
    init_shims();
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.RotateAnimation = void 0;
    var RotateAnimation = class {
      constructor() {
        this.enable = false;
        this.speed = 0;
        this.sync = false;
      }
      load(data) {
        if (data === void 0) {
          return;
        }
        if (data.enable !== void 0) {
          this.enable = data.enable;
        }
        if (data.speed !== void 0) {
          this.speed = data.speed;
        }
        if (data.sync !== void 0) {
          this.sync = data.sync;
        }
      }
    };
    exports.RotateAnimation = RotateAnimation;
  }
});

// node_modules/tsparticles/Options/Classes/Particles/Rotate/Rotate.js
var require_Rotate = __commonJS({
  "node_modules/tsparticles/Options/Classes/Particles/Rotate/Rotate.js"(exports) {
    init_shims();
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.Rotate = void 0;
    var RotateAnimation_1 = require_RotateAnimation();
    var Enums_1 = require_Enums();
    var ValueWithRandom_1 = require_ValueWithRandom();
    var Rotate = class extends ValueWithRandom_1.ValueWithRandom {
      constructor() {
        super();
        this.animation = new RotateAnimation_1.RotateAnimation();
        this.direction = Enums_1.RotateDirection.clockwise;
        this.path = false;
        this.value = 0;
      }
      load(data) {
        if (!data) {
          return;
        }
        super.load(data);
        if (data.direction !== void 0) {
          this.direction = data.direction;
        }
        this.animation.load(data.animation);
        if (data.path !== void 0) {
          this.path = data.path;
        }
      }
    };
    exports.Rotate = Rotate;
  }
});

// node_modules/tsparticles/Options/Classes/Particles/Shadow.js
var require_Shadow = __commonJS({
  "node_modules/tsparticles/Options/Classes/Particles/Shadow.js"(exports) {
    init_shims();
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.Shadow = void 0;
    var OptionsColor_1 = require_OptionsColor();
    var Shadow = class {
      constructor() {
        this.blur = 0;
        this.color = new OptionsColor_1.OptionsColor();
        this.enable = false;
        this.offset = {
          x: 0,
          y: 0
        };
        this.color.value = "#000000";
      }
      load(data) {
        if (data === void 0) {
          return;
        }
        if (data.blur !== void 0) {
          this.blur = data.blur;
        }
        this.color = OptionsColor_1.OptionsColor.create(this.color, data.color);
        if (data.enable !== void 0) {
          this.enable = data.enable;
        }
        if (data.offset === void 0) {
          return;
        }
        if (data.offset.x !== void 0) {
          this.offset.x = data.offset.x;
        }
        if (data.offset.y !== void 0) {
          this.offset.y = data.offset.y;
        }
      }
    };
    exports.Shadow = Shadow;
  }
});

// node_modules/tsparticles/Options/Classes/ColorAnimation.js
var require_ColorAnimation = __commonJS({
  "node_modules/tsparticles/Options/Classes/ColorAnimation.js"(exports) {
    init_shims();
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.ColorAnimation = void 0;
    var Utils_1 = require_Utils2();
    var ColorAnimation = class {
      constructor() {
        this.count = 0;
        this.enable = false;
        this.offset = 0;
        this.speed = 1;
        this.sync = true;
      }
      load(data) {
        if (data === void 0) {
          return;
        }
        if (data.count !== void 0) {
          this.count = data.count;
        }
        if (data.enable !== void 0) {
          this.enable = data.enable;
        }
        if (data.offset !== void 0) {
          this.offset = (0, Utils_1.setRangeValue)(data.offset);
        }
        if (data.speed !== void 0) {
          this.speed = data.speed;
        }
        if (data.sync !== void 0) {
          this.sync = data.sync;
        }
      }
    };
    exports.ColorAnimation = ColorAnimation;
  }
});

// node_modules/tsparticles/Options/Classes/HslAnimation.js
var require_HslAnimation = __commonJS({
  "node_modules/tsparticles/Options/Classes/HslAnimation.js"(exports) {
    init_shims();
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.HslAnimation = void 0;
    var ColorAnimation_1 = require_ColorAnimation();
    var HslAnimation = class {
      constructor() {
        this.h = new ColorAnimation_1.ColorAnimation();
        this.s = new ColorAnimation_1.ColorAnimation();
        this.l = new ColorAnimation_1.ColorAnimation();
      }
      load(data) {
        if (!data) {
          return;
        }
        this.h.load(data.h);
        this.s.load(data.s);
        this.l.load(data.l);
      }
    };
    exports.HslAnimation = HslAnimation;
  }
});

// node_modules/tsparticles/Options/Classes/AnimatableColor.js
var require_AnimatableColor = __commonJS({
  "node_modules/tsparticles/Options/Classes/AnimatableColor.js"(exports) {
    init_shims();
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.AnimatableColor = void 0;
    var OptionsColor_1 = require_OptionsColor();
    var HslAnimation_1 = require_HslAnimation();
    var AnimatableColor = class extends OptionsColor_1.OptionsColor {
      constructor() {
        super();
        this.animation = new HslAnimation_1.HslAnimation();
      }
      static create(source, data) {
        const color = new AnimatableColor();
        color.load(source);
        if (data !== void 0) {
          if (typeof data === "string" || data instanceof Array) {
            color.load({ value: data });
          } else {
            color.load(data);
          }
        }
        return color;
      }
      load(data) {
        super.load(data);
        if (!data) {
          return;
        }
        const colorAnimation = data.animation;
        if (colorAnimation !== void 0) {
          if (colorAnimation.enable !== void 0) {
            this.animation.h.load(colorAnimation);
          } else {
            this.animation.load(data.animation);
          }
        }
      }
    };
    exports.AnimatableColor = AnimatableColor;
  }
});

// node_modules/tsparticles/Options/Classes/Particles/Stroke.js
var require_Stroke = __commonJS({
  "node_modules/tsparticles/Options/Classes/Particles/Stroke.js"(exports) {
    init_shims();
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.Stroke = void 0;
    var AnimatableColor_1 = require_AnimatableColor();
    var Stroke = class {
      constructor() {
        this.width = 0;
      }
      load(data) {
        if (data === void 0) {
          return;
        }
        if (data.color !== void 0) {
          this.color = AnimatableColor_1.AnimatableColor.create(this.color, data.color);
        }
        if (data.width !== void 0) {
          this.width = data.width;
        }
        if (data.opacity !== void 0) {
          this.opacity = data.opacity;
        }
      }
    };
    exports.Stroke = Stroke;
  }
});

// node_modules/tsparticles/Options/Classes/Particles/Bounce/BounceFactor.js
var require_BounceFactor = __commonJS({
  "node_modules/tsparticles/Options/Classes/Particles/Bounce/BounceFactor.js"(exports) {
    init_shims();
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.BounceFactor = void 0;
    var ValueWithRandom_1 = require_ValueWithRandom();
    var BounceFactor = class extends ValueWithRandom_1.ValueWithRandom {
      constructor() {
        super();
        this.random.minimumValue = 0.1;
        this.value = 1;
      }
    };
    exports.BounceFactor = BounceFactor;
  }
});

// node_modules/tsparticles/Options/Classes/Particles/Bounce/Bounce.js
var require_Bounce = __commonJS({
  "node_modules/tsparticles/Options/Classes/Particles/Bounce/Bounce.js"(exports) {
    init_shims();
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.Bounce = void 0;
    var BounceFactor_1 = require_BounceFactor();
    var Bounce = class {
      constructor() {
        this.horizontal = new BounceFactor_1.BounceFactor();
        this.vertical = new BounceFactor_1.BounceFactor();
      }
      load(data) {
        if (!data) {
          return;
        }
        this.horizontal.load(data.horizontal);
        this.vertical.load(data.vertical);
      }
    };
    exports.Bounce = Bounce;
  }
});

// node_modules/tsparticles/Options/Classes/Particles/Collisions/CollisionsOverlap.js
var require_CollisionsOverlap = __commonJS({
  "node_modules/tsparticles/Options/Classes/Particles/Collisions/CollisionsOverlap.js"(exports) {
    init_shims();
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.CollisionsOverlap = void 0;
    var CollisionsOverlap = class {
      constructor() {
        this.enable = true;
        this.retries = 0;
      }
      load(data) {
        if (!data) {
          return;
        }
        if (data.enable !== void 0) {
          this.enable = data.enable;
        }
        if (data.retries !== void 0) {
          this.retries = data.retries;
        }
      }
    };
    exports.CollisionsOverlap = CollisionsOverlap;
  }
});

// node_modules/tsparticles/Options/Classes/Particles/Collisions/Collisions.js
var require_Collisions = __commonJS({
  "node_modules/tsparticles/Options/Classes/Particles/Collisions/Collisions.js"(exports) {
    init_shims();
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.Collisions = void 0;
    var Enums_1 = require_Enums();
    var Bounce_1 = require_Bounce();
    var CollisionsOverlap_1 = require_CollisionsOverlap();
    var Collisions = class {
      constructor() {
        this.bounce = new Bounce_1.Bounce();
        this.enable = false;
        this.mode = Enums_1.CollisionMode.bounce;
        this.overlap = new CollisionsOverlap_1.CollisionsOverlap();
      }
      load(data) {
        if (data === void 0) {
          return;
        }
        this.bounce.load(data.bounce);
        if (data.enable !== void 0) {
          this.enable = data.enable;
        }
        if (data.mode !== void 0) {
          this.mode = data.mode;
        }
        this.overlap.load(data.overlap);
      }
    };
    exports.Collisions = Collisions;
  }
});

// node_modules/tsparticles/Options/Classes/Particles/Twinkle/TwinkleValues.js
var require_TwinkleValues = __commonJS({
  "node_modules/tsparticles/Options/Classes/Particles/Twinkle/TwinkleValues.js"(exports) {
    init_shims();
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.TwinkleValues = void 0;
    var OptionsColor_1 = require_OptionsColor();
    var TwinkleValues = class {
      constructor() {
        this.enable = false;
        this.frequency = 0.05;
        this.opacity = 1;
      }
      load(data) {
        if (data === void 0) {
          return;
        }
        if (data.color !== void 0) {
          this.color = OptionsColor_1.OptionsColor.create(this.color, data.color);
        }
        if (data.enable !== void 0) {
          this.enable = data.enable;
        }
        if (data.frequency !== void 0) {
          this.frequency = data.frequency;
        }
        if (data.opacity !== void 0) {
          this.opacity = data.opacity;
        }
      }
    };
    exports.TwinkleValues = TwinkleValues;
  }
});

// node_modules/tsparticles/Options/Classes/Particles/Twinkle/Twinkle.js
var require_Twinkle = __commonJS({
  "node_modules/tsparticles/Options/Classes/Particles/Twinkle/Twinkle.js"(exports) {
    init_shims();
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.Twinkle = void 0;
    var TwinkleValues_1 = require_TwinkleValues();
    var Twinkle = class {
      constructor() {
        this.lines = new TwinkleValues_1.TwinkleValues();
        this.particles = new TwinkleValues_1.TwinkleValues();
      }
      load(data) {
        if (data === void 0) {
          return;
        }
        this.lines.load(data.lines);
        this.particles.load(data.particles);
      }
    };
    exports.Twinkle = Twinkle;
  }
});

// node_modules/tsparticles/Options/Classes/Particles/Life/LifeDelay.js
var require_LifeDelay = __commonJS({
  "node_modules/tsparticles/Options/Classes/Particles/Life/LifeDelay.js"(exports) {
    init_shims();
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.LifeDelay = void 0;
    var ValueWithRandom_1 = require_ValueWithRandom();
    var LifeDelay = class extends ValueWithRandom_1.ValueWithRandom {
      constructor() {
        super();
        this.sync = false;
      }
      load(data) {
        if (!data) {
          return;
        }
        super.load(data);
        if (data.sync !== void 0) {
          this.sync = data.sync;
        }
      }
    };
    exports.LifeDelay = LifeDelay;
  }
});

// node_modules/tsparticles/Options/Classes/Particles/Life/LifeDuration.js
var require_LifeDuration = __commonJS({
  "node_modules/tsparticles/Options/Classes/Particles/Life/LifeDuration.js"(exports) {
    init_shims();
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.LifeDuration = void 0;
    var ValueWithRandom_1 = require_ValueWithRandom();
    var LifeDuration = class extends ValueWithRandom_1.ValueWithRandom {
      constructor() {
        super();
        this.random.minimumValue = 1e-4;
        this.sync = false;
      }
      load(data) {
        if (data === void 0) {
          return;
        }
        super.load(data);
        if (data.sync !== void 0) {
          this.sync = data.sync;
        }
      }
    };
    exports.LifeDuration = LifeDuration;
  }
});

// node_modules/tsparticles/Options/Classes/Particles/Life/Life.js
var require_Life = __commonJS({
  "node_modules/tsparticles/Options/Classes/Particles/Life/Life.js"(exports) {
    init_shims();
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.Life = void 0;
    var LifeDelay_1 = require_LifeDelay();
    var LifeDuration_1 = require_LifeDuration();
    var Life = class {
      constructor() {
        this.count = 0;
        this.delay = new LifeDelay_1.LifeDelay();
        this.duration = new LifeDuration_1.LifeDuration();
      }
      load(data) {
        if (data === void 0) {
          return;
        }
        if (data.count !== void 0) {
          this.count = data.count;
        }
        this.delay.load(data.delay);
        this.duration.load(data.duration);
      }
    };
    exports.Life = Life;
  }
});

// node_modules/tsparticles/Options/Classes/Particles/Destroy/SplitFactor.js
var require_SplitFactor = __commonJS({
  "node_modules/tsparticles/Options/Classes/Particles/Destroy/SplitFactor.js"(exports) {
    init_shims();
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.SplitFactor = void 0;
    var ValueWithRandom_1 = require_ValueWithRandom();
    var SplitFactor = class extends ValueWithRandom_1.ValueWithRandom {
      constructor() {
        super();
        this.value = 3;
      }
    };
    exports.SplitFactor = SplitFactor;
  }
});

// node_modules/tsparticles/Options/Classes/Particles/Destroy/SplitRate.js
var require_SplitRate = __commonJS({
  "node_modules/tsparticles/Options/Classes/Particles/Destroy/SplitRate.js"(exports) {
    init_shims();
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.SplitRate = void 0;
    var ValueWithRandom_1 = require_ValueWithRandom();
    var SplitRate = class extends ValueWithRandom_1.ValueWithRandom {
      constructor() {
        super();
        this.value = { min: 4, max: 9 };
      }
    };
    exports.SplitRate = SplitRate;
  }
});

// node_modules/tsparticles/Options/Classes/Particles/Destroy/Split.js
var require_Split = __commonJS({
  "node_modules/tsparticles/Options/Classes/Particles/Destroy/Split.js"(exports) {
    init_shims();
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.Split = void 0;
    var SplitFactor_1 = require_SplitFactor();
    var SplitRate_1 = require_SplitRate();
    var Utils_1 = require_Utils2();
    var Split = class {
      constructor() {
        this.count = 1;
        this.factor = new SplitFactor_1.SplitFactor();
        this.rate = new SplitRate_1.SplitRate();
        this.sizeOffset = true;
      }
      load(data) {
        if (!data) {
          return;
        }
        if (data.count !== void 0) {
          this.count = data.count;
        }
        this.factor.load(data.factor);
        this.rate.load(data.rate);
        if (data.particles !== void 0) {
          this.particles = (0, Utils_1.deepExtend)({}, data.particles);
        }
        if (data.sizeOffset !== void 0) {
          this.sizeOffset = data.sizeOffset;
        }
      }
    };
    exports.Split = Split;
  }
});

// node_modules/tsparticles/Options/Classes/Particles/Destroy/Destroy.js
var require_Destroy = __commonJS({
  "node_modules/tsparticles/Options/Classes/Particles/Destroy/Destroy.js"(exports) {
    init_shims();
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.Destroy = void 0;
    var Enums_1 = require_Enums();
    var Split_1 = require_Split();
    var Destroy = class {
      constructor() {
        this.mode = Enums_1.DestroyMode.none;
        this.split = new Split_1.Split();
      }
      load(data) {
        if (!data) {
          return;
        }
        if (data.mode !== void 0) {
          this.mode = data.mode;
        }
        this.split.load(data.split);
      }
    };
    exports.Destroy = Destroy;
  }
});

// node_modules/tsparticles/Options/Classes/Particles/Wobble/Wobble.js
var require_Wobble = __commonJS({
  "node_modules/tsparticles/Options/Classes/Particles/Wobble/Wobble.js"(exports) {
    init_shims();
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.Wobble = void 0;
    var Utils_1 = require_Utils2();
    var Wobble = class {
      constructor() {
        this.distance = 5;
        this.enable = false;
        this.speed = 50;
      }
      load(data) {
        if (!data) {
          return;
        }
        if (data.distance !== void 0) {
          this.distance = (0, Utils_1.setRangeValue)(data.distance);
        }
        if (data.enable !== void 0) {
          this.enable = data.enable;
        }
        if (data.speed !== void 0) {
          this.speed = (0, Utils_1.setRangeValue)(data.speed);
        }
      }
    };
    exports.Wobble = Wobble;
  }
});

// node_modules/tsparticles/Options/Classes/Particles/Tilt/TiltAnimation.js
var require_TiltAnimation = __commonJS({
  "node_modules/tsparticles/Options/Classes/Particles/Tilt/TiltAnimation.js"(exports) {
    init_shims();
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.TiltAnimation = void 0;
    var TiltAnimation = class {
      constructor() {
        this.enable = false;
        this.speed = 0;
        this.sync = false;
      }
      load(data) {
        if (data === void 0) {
          return;
        }
        if (data.enable !== void 0) {
          this.enable = data.enable;
        }
        if (data.speed !== void 0) {
          this.speed = data.speed;
        }
        if (data.sync !== void 0) {
          this.sync = data.sync;
        }
      }
    };
    exports.TiltAnimation = TiltAnimation;
  }
});

// node_modules/tsparticles/Options/Classes/Particles/Tilt/Tilt.js
var require_Tilt = __commonJS({
  "node_modules/tsparticles/Options/Classes/Particles/Tilt/Tilt.js"(exports) {
    init_shims();
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.Tilt = void 0;
    var TiltAnimation_1 = require_TiltAnimation();
    var Enums_1 = require_Enums();
    var ValueWithRandom_1 = require_ValueWithRandom();
    var Tilt = class extends ValueWithRandom_1.ValueWithRandom {
      constructor() {
        super();
        this.animation = new TiltAnimation_1.TiltAnimation();
        this.direction = Enums_1.TiltDirection.clockwise;
        this.enable = false;
        this.value = 0;
      }
      load(data) {
        if (!data) {
          return;
        }
        super.load(data);
        this.animation.load(data.animation);
        if (data.direction !== void 0) {
          this.direction = data.direction;
        }
        if (data.enable !== void 0) {
          this.enable = data.enable;
        }
      }
    };
    exports.Tilt = Tilt;
  }
});

// node_modules/tsparticles/Options/Classes/Particles/Roll/RollLight.js
var require_RollLight = __commonJS({
  "node_modules/tsparticles/Options/Classes/Particles/Roll/RollLight.js"(exports) {
    init_shims();
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.RollLight = void 0;
    var RollLight = class {
      constructor() {
        this.enable = false;
        this.value = 0;
      }
      load(data) {
        if (!data) {
          return;
        }
        if (data.enable !== void 0) {
          this.enable = data.enable;
        }
        if (data.value !== void 0) {
          this.value = data.value;
        }
      }
    };
    exports.RollLight = RollLight;
  }
});

// node_modules/tsparticles/Options/Classes/Particles/Roll/Roll.js
var require_Roll = __commonJS({
  "node_modules/tsparticles/Options/Classes/Particles/Roll/Roll.js"(exports) {
    init_shims();
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.Roll = void 0;
    var OptionsColor_1 = require_OptionsColor();
    var RollLight_1 = require_RollLight();
    var Utils_1 = require_Utils2();
    var Enums_1 = require_Enums();
    var Roll = class {
      constructor() {
        this.darken = new RollLight_1.RollLight();
        this.enable = false;
        this.enlighten = new RollLight_1.RollLight();
        this.mode = Enums_1.RollMode.vertical;
        this.speed = 25;
      }
      load(data) {
        if (!data) {
          return;
        }
        if (data.backColor !== void 0) {
          this.backColor = OptionsColor_1.OptionsColor.create(this.backColor, data.backColor);
        }
        this.darken.load(data.darken);
        if (data.enable !== void 0) {
          this.enable = data.enable;
        }
        this.enlighten.load(data.enlighten);
        if (data.mode !== void 0) {
          this.mode = data.mode;
        }
        if (data.speed !== void 0) {
          this.speed = (0, Utils_1.setRangeValue)(data.speed);
        }
      }
    };
    exports.Roll = Roll;
  }
});

// node_modules/tsparticles/Options/Classes/Particles/ZIndex/ZIndex.js
var require_ZIndex = __commonJS({
  "node_modules/tsparticles/Options/Classes/Particles/ZIndex/ZIndex.js"(exports) {
    init_shims();
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.ZIndex = void 0;
    var ValueWithRandom_1 = require_ValueWithRandom();
    var ZIndex = class extends ValueWithRandom_1.ValueWithRandom {
      constructor() {
        super();
        this.opacityRate = 1;
        this.sizeRate = 1;
        this.velocityRate = 1;
      }
      load(data) {
        super.load(data);
        if (!data) {
          return;
        }
        if (data.opacityRate !== void 0) {
          this.opacityRate = data.opacityRate;
        }
        if (data.sizeRate !== void 0) {
          this.sizeRate = data.sizeRate;
        }
        if (data.velocityRate !== void 0) {
          this.velocityRate = data.velocityRate;
        }
      }
    };
    exports.ZIndex = ZIndex;
  }
});

// node_modules/tsparticles/Options/Classes/Particles/Orbit/OrbitRotation.js
var require_OrbitRotation = __commonJS({
  "node_modules/tsparticles/Options/Classes/Particles/Orbit/OrbitRotation.js"(exports) {
    init_shims();
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.OrbitRotation = void 0;
    var ValueWithRandom_1 = require_ValueWithRandom();
    var OrbitRotation = class extends ValueWithRandom_1.ValueWithRandom {
      constructor() {
        super();
        this.value = 45;
        this.random.enable = false;
        this.random.minimumValue = 0;
      }
      load(data) {
        if (data === void 0) {
          return;
        }
        super.load(data);
      }
    };
    exports.OrbitRotation = OrbitRotation;
  }
});

// node_modules/tsparticles/Options/Classes/Particles/Orbit/Orbit.js
var require_Orbit = __commonJS({
  "node_modules/tsparticles/Options/Classes/Particles/Orbit/Orbit.js"(exports) {
    init_shims();
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.Orbit = void 0;
    var OrbitRotation_1 = require_OrbitRotation();
    var OptionsColor_1 = require_OptionsColor();
    var AnimationOptions_1 = require_AnimationOptions();
    var Orbit = class {
      constructor() {
        this.animation = new AnimationOptions_1.AnimationOptions();
        this.enable = false;
        this.opacity = 1;
        this.rotation = new OrbitRotation_1.OrbitRotation();
        this.width = 1;
      }
      load(data) {
        if (data === void 0) {
          return;
        }
        this.animation.load(data.animation);
        this.rotation.load(data.rotation);
        if (data.enable !== void 0) {
          this.enable = data.enable;
        }
        if (data.opacity !== void 0) {
          this.opacity = data.opacity;
        }
        if (data.width !== void 0) {
          this.width = data.width;
        }
        if (data.radius !== void 0) {
          this.radius = data.radius;
        }
        if (data.color !== void 0) {
          this.color = OptionsColor_1.OptionsColor.create(this.color, data.color);
        }
      }
    };
    exports.Orbit = Orbit;
  }
});

// node_modules/tsparticles/Options/Classes/Particles/Repulse/Repulse.js
var require_Repulse = __commonJS({
  "node_modules/tsparticles/Options/Classes/Particles/Repulse/Repulse.js"(exports) {
    init_shims();
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.Repulse = void 0;
    var ValueWithRandom_1 = require_ValueWithRandom();
    var Repulse = class extends ValueWithRandom_1.ValueWithRandom {
      constructor() {
        super();
        this.enabled = false;
        this.distance = 1;
        this.duration = 1;
        this.factor = 1;
        this.speed = 1;
      }
      load(data) {
        super.load(data);
        if (!data) {
          return;
        }
        if (data.enabled !== void 0) {
          this.enabled = data.enabled;
        }
        if (data.distance !== void 0) {
          this.distance = data.distance;
        }
        if (data.duration !== void 0) {
          this.duration = data.duration;
        }
        if (data.factor !== void 0) {
          this.factor = data.factor;
        }
        if (data.speed !== void 0) {
          this.speed = data.speed;
        }
      }
    };
    exports.Repulse = Repulse;
  }
});

// node_modules/tsparticles/Options/Classes/AnimatableGradient.js
var require_AnimatableGradient = __commonJS({
  "node_modules/tsparticles/Options/Classes/AnimatableGradient.js"(exports) {
    init_shims();
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.GradientColorOpacityAnimation = exports.GradientAngleAnimation = exports.AnimatableGradientColor = exports.GradientColorOpacity = exports.GradientAngle = exports.AnimatableGradient = void 0;
    var Enums_1 = require_Enums();
    var AnimatableColor_1 = require_AnimatableColor();
    var Utils_1 = require_Utils2();
    var AnimatableGradient = class {
      constructor() {
        this.angle = new GradientAngle();
        this.colors = [];
        this.type = Enums_1.GradientType.random;
      }
      load(data) {
        if (!data) {
          return;
        }
        this.angle.load(data.angle);
        if (data.colors !== void 0) {
          this.colors = data.colors.map((s2) => {
            const tmp = new AnimatableGradientColor();
            tmp.load(s2);
            return tmp;
          });
        }
        if (data.type !== void 0) {
          this.type = data.type;
        }
      }
    };
    exports.AnimatableGradient = AnimatableGradient;
    var GradientAngle = class {
      constructor() {
        this.value = 0;
        this.animation = new GradientAngleAnimation();
        this.direction = Enums_1.RotateDirection.clockwise;
      }
      load(data) {
        if (!data) {
          return;
        }
        this.animation.load(data.animation);
        if (data.value !== void 0) {
          this.value = data.value;
        }
        if (data.direction !== void 0) {
          this.direction = data.direction;
        }
      }
    };
    exports.GradientAngle = GradientAngle;
    var GradientColorOpacity = class {
      constructor() {
        this.value = 0;
        this.animation = new GradientColorOpacityAnimation();
      }
      load(data) {
        if (!data) {
          return;
        }
        this.animation.load(data.animation);
        if (data.value !== void 0) {
          this.value = (0, Utils_1.setRangeValue)(data.value);
        }
      }
    };
    exports.GradientColorOpacity = GradientColorOpacity;
    var AnimatableGradientColor = class {
      constructor() {
        this.stop = 0;
        this.value = new AnimatableColor_1.AnimatableColor();
      }
      load(data) {
        if (!data) {
          return;
        }
        if (data.stop !== void 0) {
          this.stop = data.stop;
        }
        this.value = AnimatableColor_1.AnimatableColor.create(this.value, data.value);
        if (data.opacity !== void 0) {
          this.opacity = new GradientColorOpacity();
          if (typeof data.opacity === "number") {
            this.opacity.value = data.opacity;
          } else {
            this.opacity.load(data.opacity);
          }
        }
      }
    };
    exports.AnimatableGradientColor = AnimatableGradientColor;
    var GradientAngleAnimation = class {
      constructor() {
        this.count = 0;
        this.enable = false;
        this.speed = 0;
        this.sync = false;
      }
      load(data) {
        if (!data) {
          return;
        }
        if (data.count !== void 0) {
          this.count = data.count;
        }
        if (data.enable !== void 0) {
          this.enable = data.enable;
        }
        if (data.speed !== void 0) {
          this.speed = data.speed;
        }
        if (data.sync !== void 0) {
          this.sync = data.sync;
        }
      }
    };
    exports.GradientAngleAnimation = GradientAngleAnimation;
    var GradientColorOpacityAnimation = class {
      constructor() {
        this.count = 0;
        this.enable = false;
        this.speed = 0;
        this.sync = false;
        this.startValue = Enums_1.StartValueType.random;
      }
      load(data) {
        if (!data) {
          return;
        }
        if (data.count !== void 0) {
          this.count = data.count;
        }
        if (data.enable !== void 0) {
          this.enable = data.enable;
        }
        if (data.speed !== void 0) {
          this.speed = data.speed;
        }
        if (data.sync !== void 0) {
          this.sync = data.sync;
        }
        if (data.startValue !== void 0) {
          this.startValue = data.startValue;
        }
      }
    };
    exports.GradientColorOpacityAnimation = GradientColorOpacityAnimation;
  }
});

// node_modules/tsparticles/Options/Classes/Particles/ParticlesOptions.js
var require_ParticlesOptions = __commonJS({
  "node_modules/tsparticles/Options/Classes/Particles/ParticlesOptions.js"(exports) {
    init_shims();
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.ParticlesOptions = void 0;
    var Links_1 = require_Links();
    var Move_1 = require_Move();
    var ParticlesNumber_1 = require_ParticlesNumber();
    var Opacity_1 = require_Opacity();
    var Shape_1 = require_Shape();
    var Size_1 = require_Size();
    var Rotate_1 = require_Rotate();
    var Shadow_1 = require_Shadow();
    var Stroke_1 = require_Stroke();
    var Collisions_1 = require_Collisions();
    var Twinkle_1 = require_Twinkle();
    var AnimatableColor_1 = require_AnimatableColor();
    var Life_1 = require_Life();
    var Bounce_1 = require_Bounce();
    var Destroy_1 = require_Destroy();
    var Wobble_1 = require_Wobble();
    var Tilt_1 = require_Tilt();
    var Roll_1 = require_Roll();
    var ZIndex_1 = require_ZIndex();
    var Utils_1 = require_Utils2();
    var Orbit_1 = require_Orbit();
    var Repulse_1 = require_Repulse();
    var AnimatableGradient_1 = require_AnimatableGradient();
    var ParticlesOptions = class {
      constructor() {
        this.bounce = new Bounce_1.Bounce();
        this.collisions = new Collisions_1.Collisions();
        this.color = new AnimatableColor_1.AnimatableColor();
        this.destroy = new Destroy_1.Destroy();
        this.gradient = [];
        this.groups = {};
        this.life = new Life_1.Life();
        this.links = new Links_1.Links();
        this.move = new Move_1.Move();
        this.number = new ParticlesNumber_1.ParticlesNumber();
        this.opacity = new Opacity_1.Opacity();
        this.orbit = new Orbit_1.Orbit();
        this.reduceDuplicates = false;
        this.repulse = new Repulse_1.Repulse();
        this.roll = new Roll_1.Roll();
        this.rotate = new Rotate_1.Rotate();
        this.shadow = new Shadow_1.Shadow();
        this.shape = new Shape_1.Shape();
        this.size = new Size_1.Size();
        this.stroke = new Stroke_1.Stroke();
        this.tilt = new Tilt_1.Tilt();
        this.twinkle = new Twinkle_1.Twinkle();
        this.wobble = new Wobble_1.Wobble();
        this.zIndex = new ZIndex_1.ZIndex();
      }
      get line_linked() {
        return this.links;
      }
      set line_linked(value) {
        this.links = value;
      }
      get lineLinked() {
        return this.links;
      }
      set lineLinked(value) {
        this.links = value;
      }
      load(data) {
        var _a, _b, _c, _d, _e, _f, _g, _h;
        if (data === void 0) {
          return;
        }
        this.bounce.load(data.bounce);
        this.color.load(AnimatableColor_1.AnimatableColor.create(this.color, data.color));
        this.destroy.load(data.destroy);
        this.life.load(data.life);
        const links = (_b = (_a = data.links) !== null && _a !== void 0 ? _a : data.lineLinked) !== null && _b !== void 0 ? _b : data.line_linked;
        if (links !== void 0) {
          this.links.load(links);
        }
        if (data.groups !== void 0) {
          for (const group in data.groups) {
            const item = data.groups[group];
            if (item !== void 0) {
              this.groups[group] = (0, Utils_1.deepExtend)((_c = this.groups[group]) !== null && _c !== void 0 ? _c : {}, item);
            }
          }
        }
        this.move.load(data.move);
        this.number.load(data.number);
        this.opacity.load(data.opacity);
        this.orbit.load(data.orbit);
        if (data.reduceDuplicates !== void 0) {
          this.reduceDuplicates = data.reduceDuplicates;
        }
        this.repulse.load(data.repulse);
        this.roll.load(data.roll);
        this.rotate.load(data.rotate);
        this.shape.load(data.shape);
        this.size.load(data.size);
        this.shadow.load(data.shadow);
        this.tilt.load(data.tilt);
        this.twinkle.load(data.twinkle);
        this.wobble.load(data.wobble);
        this.zIndex.load(data.zIndex);
        const collisions = (_e = (_d = data.move) === null || _d === void 0 ? void 0 : _d.collisions) !== null && _e !== void 0 ? _e : (_f = data.move) === null || _f === void 0 ? void 0 : _f.bounce;
        if (collisions !== void 0) {
          this.collisions.enable = collisions;
        }
        this.collisions.load(data.collisions);
        const strokeToLoad = (_g = data.stroke) !== null && _g !== void 0 ? _g : (_h = data.shape) === null || _h === void 0 ? void 0 : _h.stroke;
        if (strokeToLoad) {
          if (strokeToLoad instanceof Array) {
            this.stroke = strokeToLoad.map((s2) => {
              const tmp = new Stroke_1.Stroke();
              tmp.load(s2);
              return tmp;
            });
          } else {
            if (this.stroke instanceof Array) {
              this.stroke = new Stroke_1.Stroke();
            }
            this.stroke.load(strokeToLoad);
          }
        }
        const gradientToLoad = data.gradient;
        if (gradientToLoad) {
          if (gradientToLoad instanceof Array) {
            this.gradient = gradientToLoad.map((s2) => {
              const tmp = new AnimatableGradient_1.AnimatableGradient();
              tmp.load(s2);
              return tmp;
            });
          } else {
            if (this.gradient instanceof Array) {
              this.gradient = new AnimatableGradient_1.AnimatableGradient();
            }
            this.gradient.load(gradientToLoad);
          }
        }
      }
    };
    exports.ParticlesOptions = ParticlesOptions;
  }
});

// node_modules/tsparticles/Core/Particle/Vector3d.js
var require_Vector3d = __commonJS({
  "node_modules/tsparticles/Core/Particle/Vector3d.js"(exports) {
    init_shims();
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.Vector3d = void 0;
    var Vector_1 = require_Vector();
    var Vector3d = class extends Vector_1.Vector {
      constructor(x, y, z) {
        super(x, y);
        this.z = z === void 0 ? x.z : z;
      }
      static clone(source) {
        return Vector3d.create(source.x, source.y, source.z);
      }
      static create(x, y, z) {
        return new Vector3d(x, y, z);
      }
      add(v) {
        return v instanceof Vector3d ? Vector3d.create(this.x + v.x, this.y + v.y, this.z + v.z) : super.add(v);
      }
      addTo(v) {
        super.addTo(v);
        if (v instanceof Vector3d) {
          this.z += v.z;
        }
      }
      sub(v) {
        return v instanceof Vector3d ? Vector3d.create(this.x - v.x, this.y - v.y, this.z - v.z) : super.sub(v);
      }
      subFrom(v) {
        super.subFrom(v);
        if (v instanceof Vector3d) {
          this.z -= v.z;
        }
      }
      mult(n) {
        return Vector3d.create(this.x * n, this.y * n, this.z * n);
      }
      multTo(n) {
        super.multTo(n);
        this.z *= n;
      }
      div(n) {
        return Vector3d.create(this.x / n, this.y / n, this.z / n);
      }
      divTo(n) {
        super.divTo(n);
        this.z /= n;
      }
      copy() {
        return Vector3d.clone(this);
      }
      setTo(v) {
        super.setTo(v);
        if (v instanceof Vector3d) {
          this.z = v.z;
        }
      }
    };
    exports.Vector3d = Vector3d;
  }
});

// node_modules/tsparticles/Core/Particle.js
var require_Particle = __commonJS({
  "node_modules/tsparticles/Core/Particle.js"(exports) {
    init_shims();
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.Particle = void 0;
    var ParticlesOptions_1 = require_ParticlesOptions();
    var Shape_1 = require_Shape();
    var Enums_1 = require_Enums();
    var Utils_1 = require_Utils2();
    var Vector_1 = require_Vector();
    var Vector3d_1 = require_Vector3d();
    var fixOutMode = (data) => {
      if ((0, Utils_1.isInArray)(data.outMode, data.checkModes) || (0, Utils_1.isInArray)(data.outMode, data.checkModes)) {
        if (data.coord > data.maxCoord - data.radius * 2) {
          data.setCb(-data.radius);
        } else if (data.coord < data.radius * 2) {
          data.setCb(data.radius);
        }
      }
    };
    var Particle = class {
      constructor(id, container, position, overrideOptions, group) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j;
        this.id = id;
        this.container = container;
        this.group = group;
        this.fill = true;
        this.close = true;
        this.lastPathTime = 0;
        this.destroyed = false;
        this.unbreakable = false;
        this.splitCount = 0;
        this.misplaced = false;
        this.retina = {
          maxDistance: {}
        };
        const pxRatio = container.retina.pixelRatio;
        const mainOptions = container.actualOptions;
        const particlesOptions = new ParticlesOptions_1.ParticlesOptions();
        particlesOptions.load(mainOptions.particles);
        const shapeType = particlesOptions.shape.type;
        const reduceDuplicates = particlesOptions.reduceDuplicates;
        this.shape = shapeType instanceof Array ? (0, Utils_1.itemFromArray)(shapeType, this.id, reduceDuplicates) : shapeType;
        if (overrideOptions === null || overrideOptions === void 0 ? void 0 : overrideOptions.shape) {
          if (overrideOptions.shape.type) {
            const overrideShapeType = overrideOptions.shape.type;
            this.shape = overrideShapeType instanceof Array ? (0, Utils_1.itemFromArray)(overrideShapeType, this.id, reduceDuplicates) : overrideShapeType;
          }
          const shapeOptions = new Shape_1.Shape();
          shapeOptions.load(overrideOptions.shape);
          if (this.shape) {
            this.shapeData = this.loadShapeData(shapeOptions, reduceDuplicates);
          }
        } else {
          this.shapeData = this.loadShapeData(particlesOptions.shape, reduceDuplicates);
        }
        if (overrideOptions !== void 0) {
          particlesOptions.load(overrideOptions);
        }
        if (((_a = this.shapeData) === null || _a === void 0 ? void 0 : _a.particles) !== void 0) {
          particlesOptions.load((_b = this.shapeData) === null || _b === void 0 ? void 0 : _b.particles);
        }
        this.fill = (_d = (_c = this.shapeData) === null || _c === void 0 ? void 0 : _c.fill) !== null && _d !== void 0 ? _d : this.fill;
        this.close = (_f = (_e = this.shapeData) === null || _e === void 0 ? void 0 : _e.close) !== null && _f !== void 0 ? _f : this.close;
        this.options = particlesOptions;
        this.pathDelay = (0, Utils_1.getValue)(this.options.move.path.delay) * 1e3;
        const zIndexValue = (0, Utils_1.getRangeValue)(this.options.zIndex.value);
        container.retina.initParticle(this);
        const sizeOptions = this.options.size, sizeRange = sizeOptions.value;
        this.size = {
          enable: sizeOptions.animation.enable,
          value: (0, Utils_1.getValue)(sizeOptions) * container.retina.pixelRatio,
          max: (0, Utils_1.getRangeMax)(sizeRange) * pxRatio,
          min: (0, Utils_1.getRangeMin)(sizeRange) * pxRatio,
          loops: 0,
          maxLoops: sizeOptions.animation.count
        };
        const sizeAnimation = sizeOptions.animation;
        if (sizeAnimation.enable) {
          this.size.status = Enums_1.AnimationStatus.increasing;
          switch (sizeAnimation.startValue) {
            case Enums_1.StartValueType.min:
              this.size.value = this.size.min;
              this.size.status = Enums_1.AnimationStatus.increasing;
              break;
            case Enums_1.StartValueType.random:
              this.size.value = (0, Utils_1.randomInRange)(this.size) * pxRatio;
              this.size.status = Math.random() >= 0.5 ? Enums_1.AnimationStatus.increasing : Enums_1.AnimationStatus.decreasing;
              break;
            case Enums_1.StartValueType.max:
            default:
              this.size.value = this.size.max;
              this.size.status = Enums_1.AnimationStatus.decreasing;
              break;
          }
          this.size.velocity = ((_g = this.retina.sizeAnimationSpeed) !== null && _g !== void 0 ? _g : container.retina.sizeAnimationSpeed) / 100 * container.retina.reduceFactor;
          if (!sizeAnimation.sync) {
            this.size.velocity *= Math.random();
          }
        }
        this.direction = (0, Utils_1.getParticleDirectionAngle)(this.options.move.direction);
        this.bubble = {
          inRange: false
        };
        this.initialVelocity = this.calculateVelocity();
        this.velocity = this.initialVelocity.copy();
        this.moveDecay = 1 - (0, Utils_1.getRangeValue)(this.options.move.decay);
        this.position = this.calcPosition(container, position, (0, Utils_1.clamp)(zIndexValue, 0, container.zLayers));
        this.initialPosition = this.position.copy();
        this.offset = Vector_1.Vector.origin;
        const particles = container.particles;
        particles.needsSort = particles.needsSort || particles.lastZIndex < this.position.z;
        particles.lastZIndex = this.position.z;
        this.zIndexFactor = this.position.z / container.zLayers;
        this.sides = 24;
        let drawer = container.drawers.get(this.shape);
        if (!drawer) {
          drawer = Utils_1.Plugins.getShapeDrawer(this.shape);
          if (drawer) {
            container.drawers.set(this.shape, drawer);
          }
        }
        if (drawer === null || drawer === void 0 ? void 0 : drawer.loadShape) {
          drawer === null || drawer === void 0 ? void 0 : drawer.loadShape(this);
        }
        const sideCountFunc = drawer === null || drawer === void 0 ? void 0 : drawer.getSidesCount;
        if (sideCountFunc) {
          this.sides = sideCountFunc(this);
        }
        this.life = this.loadLife();
        this.spawning = this.life.delay > 0;
        if (this.options.move.spin.enable) {
          const spinPos = (_h = this.options.move.spin.position) !== null && _h !== void 0 ? _h : { x: 50, y: 50 };
          const spinCenter = {
            x: spinPos.x / 100 * container.canvas.size.width,
            y: spinPos.y / 100 * container.canvas.size.height
          };
          const pos = this.getPosition();
          const distance = (0, Utils_1.getDistance)(pos, spinCenter);
          this.spin = {
            center: spinCenter,
            direction: this.velocity.x >= 0 ? Enums_1.RotateDirection.clockwise : Enums_1.RotateDirection.counterClockwise,
            angle: this.velocity.angle,
            radius: distance,
            acceleration: (_j = this.retina.spinAcceleration) !== null && _j !== void 0 ? _j : (0, Utils_1.getRangeValue)(this.options.move.spin.acceleration)
          };
        }
        this.shadowColor = (0, Utils_1.colorToRgb)(this.options.shadow.color);
        for (const updater of container.particles.updaters) {
          if (updater.init) {
            updater.init(this);
          }
        }
        if (drawer && drawer.particleInit) {
          drawer.particleInit(container, this);
        }
        for (const [, plugin] of container.plugins) {
          if (plugin.particleCreated) {
            plugin.particleCreated(this);
          }
        }
      }
      isVisible() {
        return !this.destroyed && !this.spawning && this.isInsideCanvas();
      }
      isInsideCanvas() {
        const radius = this.getRadius();
        const canvasSize = this.container.canvas.size;
        return this.position.x >= -radius && this.position.y >= -radius && this.position.y <= canvasSize.height + radius && this.position.x <= canvasSize.width + radius;
      }
      draw(delta) {
        const container = this.container;
        for (const [, plugin] of container.plugins) {
          container.canvas.drawParticlePlugin(plugin, this, delta);
        }
        container.canvas.drawParticle(this, delta);
      }
      getPosition() {
        return {
          x: this.position.x + this.offset.x,
          y: this.position.y + this.offset.y,
          z: this.position.z
        };
      }
      getRadius() {
        var _a;
        return (_a = this.bubble.radius) !== null && _a !== void 0 ? _a : this.size.value;
      }
      getMass() {
        return this.getRadius() ** 2 * Math.PI / 2;
      }
      getFillColor() {
        var _a, _b, _c;
        const color = (_a = this.bubble.color) !== null && _a !== void 0 ? _a : (0, Utils_1.getHslFromAnimation)(this.color);
        if (color && this.roll && (this.backColor || this.roll.alter)) {
          const rolled = Math.floor(((_c = (_b = this.roll) === null || _b === void 0 ? void 0 : _b.angle) !== null && _c !== void 0 ? _c : 0) / (Math.PI / 2)) % 2;
          if (rolled) {
            if (this.backColor) {
              return this.backColor;
            }
            if (this.roll.alter) {
              return (0, Utils_1.alterHsl)(color, this.roll.alter.type, this.roll.alter.value);
            }
          }
        }
        return color;
      }
      getStrokeColor() {
        var _a, _b;
        return (_b = (_a = this.bubble.color) !== null && _a !== void 0 ? _a : (0, Utils_1.getHslFromAnimation)(this.strokeColor)) !== null && _b !== void 0 ? _b : this.getFillColor();
      }
      destroy(override) {
        this.destroyed = true;
        this.bubble.inRange = false;
        if (this.unbreakable) {
          return;
        }
        this.destroyed = true;
        this.bubble.inRange = false;
        for (const [, plugin] of this.container.plugins) {
          if (plugin.particleDestroyed) {
            plugin.particleDestroyed(this, override);
          }
        }
        if (override) {
          return;
        }
        const destroyOptions = this.options.destroy;
        if (destroyOptions.mode === Enums_1.DestroyMode.split) {
          this.split();
        }
      }
      reset() {
        if (this.opacity) {
          this.opacity.loops = 0;
        }
        this.size.loops = 0;
      }
      split() {
        const splitOptions = this.options.destroy.split;
        if (splitOptions.count >= 0 && this.splitCount++ > splitOptions.count) {
          return;
        }
        const rate = (0, Utils_1.getRangeValue)(splitOptions.rate.value);
        for (let i = 0; i < rate; i++) {
          this.container.particles.addSplitParticle(this);
        }
      }
      calcPosition(container, position, zIndex, tryCount = 0) {
        var _a, _b, _c, _d, _e, _f;
        for (const [, plugin] of container.plugins) {
          const pluginPos = plugin.particlePosition !== void 0 ? plugin.particlePosition(position, this) : void 0;
          if (pluginPos !== void 0) {
            return Vector3d_1.Vector3d.create(pluginPos.x, pluginPos.y, zIndex);
          }
        }
        const canvasSize = container.canvas.size;
        const pos = Vector3d_1.Vector3d.create((_a = position === null || position === void 0 ? void 0 : position.x) !== null && _a !== void 0 ? _a : Math.random() * canvasSize.width, (_b = position === null || position === void 0 ? void 0 : position.y) !== null && _b !== void 0 ? _b : Math.random() * canvasSize.height, zIndex);
        const radius = this.getRadius();
        const outModes = this.options.move.outModes, fixHorizontal = (outMode) => {
          fixOutMode({
            outMode,
            checkModes: [Enums_1.OutMode.bounce, Enums_1.OutMode.bounceHorizontal],
            coord: pos.x,
            maxCoord: container.canvas.size.width,
            setCb: (value) => pos.x += value,
            radius
          });
        }, fixVertical = (outMode) => {
          fixOutMode({
            outMode,
            checkModes: [Enums_1.OutMode.bounce, Enums_1.OutMode.bounceVertical],
            coord: pos.y,
            maxCoord: container.canvas.size.height,
            setCb: (value) => pos.y += value,
            radius
          });
        };
        fixHorizontal((_c = outModes.left) !== null && _c !== void 0 ? _c : outModes.default);
        fixHorizontal((_d = outModes.right) !== null && _d !== void 0 ? _d : outModes.default);
        fixVertical((_e = outModes.top) !== null && _e !== void 0 ? _e : outModes.default);
        fixVertical((_f = outModes.bottom) !== null && _f !== void 0 ? _f : outModes.default);
        if (this.checkOverlap(pos, tryCount)) {
          return this.calcPosition(container, void 0, zIndex, tryCount + 1);
        }
        return pos;
      }
      checkOverlap(pos, tryCount = 0) {
        const collisionsOptions = this.options.collisions;
        const radius = this.getRadius();
        if (!collisionsOptions.enable) {
          return false;
        }
        const overlapOptions = collisionsOptions.overlap;
        if (overlapOptions.enable) {
          return false;
        }
        const retries = overlapOptions.retries;
        if (retries >= 0 && tryCount > retries) {
          throw new Error("Particle is overlapping and can't be placed");
        }
        let overlaps = false;
        for (const particle of this.container.particles.array) {
          if ((0, Utils_1.getDistance)(pos, particle.position) < radius + particle.getRadius()) {
            overlaps = true;
            break;
          }
        }
        return overlaps;
      }
      calculateVelocity() {
        const baseVelocity = (0, Utils_1.getParticleBaseVelocity)(this.direction);
        const res = baseVelocity.copy();
        const moveOptions = this.options.move;
        const rad = Math.PI / 180 * moveOptions.angle.value;
        const radOffset = Math.PI / 180 * moveOptions.angle.offset;
        const range = {
          left: radOffset - rad / 2,
          right: radOffset + rad / 2
        };
        if (!moveOptions.straight) {
          res.angle += (0, Utils_1.randomInRange)((0, Utils_1.setRangeValue)(range.left, range.right));
        }
        if (moveOptions.random && typeof moveOptions.speed === "number") {
          res.length *= Math.random();
        }
        return res;
      }
      loadShapeData(shapeOptions, reduceDuplicates) {
        const shapeData = shapeOptions.options[this.shape];
        if (shapeData) {
          return (0, Utils_1.deepExtend)({}, shapeData instanceof Array ? (0, Utils_1.itemFromArray)(shapeData, this.id, reduceDuplicates) : shapeData);
        }
      }
      loadLife() {
        const container = this.container;
        const particlesOptions = this.options;
        const lifeOptions = particlesOptions.life;
        const life = {
          delay: container.retina.reduceFactor ? (0, Utils_1.getRangeValue)(lifeOptions.delay.value) * (lifeOptions.delay.sync ? 1 : Math.random()) / container.retina.reduceFactor * 1e3 : 0,
          delayTime: 0,
          duration: container.retina.reduceFactor ? (0, Utils_1.getRangeValue)(lifeOptions.duration.value) * (lifeOptions.duration.sync ? 1 : Math.random()) / container.retina.reduceFactor * 1e3 : 0,
          time: 0,
          count: particlesOptions.life.count
        };
        if (life.duration <= 0) {
          life.duration = -1;
        }
        if (life.count <= 0) {
          life.count = -1;
        }
        return life;
      }
    };
    exports.Particle = Particle;
  }
});

// node_modules/tsparticles/Core/InteractionManager.js
var require_InteractionManager = __commonJS({
  "node_modules/tsparticles/Core/InteractionManager.js"(exports) {
    init_shims();
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.InteractionManager = void 0;
    var Utils_1 = require_Utils2();
    var Enums_1 = require_Enums();
    var InteractionManager = class {
      constructor(container) {
        this.container = container;
        this.externalInteractors = [];
        this.particleInteractors = [];
        this.init();
      }
      init() {
        const interactors = Utils_1.Plugins.getInteractors(this.container, true);
        for (const interactor of interactors) {
          switch (interactor.type) {
            case Enums_1.InteractorType.External:
              this.externalInteractors.push(interactor);
              break;
            case Enums_1.InteractorType.Particles:
              this.particleInteractors.push(interactor);
              break;
          }
        }
      }
      externalInteract(delta) {
        for (const interactor of this.externalInteractors) {
          if (interactor.isEnabled()) {
            interactor.interact(delta);
          }
        }
      }
      particlesInteract(particle, delta) {
        for (const interactor of this.externalInteractors) {
          interactor.reset(particle);
        }
        for (const interactor of this.particleInteractors) {
          if (interactor.isEnabled(particle)) {
            interactor.interact(particle, delta);
          }
        }
      }
    };
    exports.InteractionManager = InteractionManager;
  }
});

// node_modules/tsparticles/Core/Particle/Mover.js
var require_Mover = __commonJS({
  "node_modules/tsparticles/Core/Particle/Mover.js"(exports) {
    init_shims();
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.Mover = void 0;
    var Utils_1 = require_Utils2();
    var Enums_1 = require_Enums();
    function applyDistance(particle) {
      const initialPosition = particle.initialPosition;
      const { dx, dy } = (0, Utils_1.getDistances)(initialPosition, particle.position);
      const dxFixed = Math.abs(dx), dyFixed = Math.abs(dy);
      const hDistance = particle.retina.maxDistance.horizontal;
      const vDistance = particle.retina.maxDistance.vertical;
      if (!hDistance && !vDistance) {
        return;
      }
      if ((hDistance && dxFixed >= hDistance || vDistance && dyFixed >= vDistance) && !particle.misplaced) {
        particle.misplaced = !!hDistance && dxFixed > hDistance || !!vDistance && dyFixed > vDistance;
        if (hDistance) {
          particle.velocity.x = particle.velocity.y / 2 - particle.velocity.x;
        }
        if (vDistance) {
          particle.velocity.y = particle.velocity.x / 2 - particle.velocity.y;
        }
      } else if ((!hDistance || dxFixed < hDistance) && (!vDistance || dyFixed < vDistance) && particle.misplaced) {
        particle.misplaced = false;
      } else if (particle.misplaced) {
        const pos = particle.position, vel = particle.velocity;
        if (hDistance && (pos.x < initialPosition.x && vel.x < 0 || pos.x > initialPosition.x && vel.x > 0)) {
          vel.x *= -Math.random();
        }
        if (vDistance && (pos.y < initialPosition.y && vel.y < 0 || pos.y > initialPosition.y && vel.y > 0)) {
          vel.y *= -Math.random();
        }
      }
    }
    var Mover = class {
      constructor(container) {
        this.container = container;
      }
      move(particle, delta) {
        if (particle.destroyed) {
          return;
        }
        this.moveParticle(particle, delta);
        this.moveParallax(particle);
      }
      moveParticle(particle, delta) {
        var _a, _b, _c;
        var _d, _e;
        const particleOptions = particle.options;
        const moveOptions = particleOptions.move;
        if (!moveOptions.enable) {
          return;
        }
        const container = this.container, slowFactor = this.getProximitySpeedFactor(particle), baseSpeed = ((_a = (_d = particle.retina).moveSpeed) !== null && _a !== void 0 ? _a : _d.moveSpeed = (0, Utils_1.getRangeValue)(moveOptions.speed) * container.retina.pixelRatio) * container.retina.reduceFactor, moveDrift = (_b = (_e = particle.retina).moveDrift) !== null && _b !== void 0 ? _b : _e.moveDrift = (0, Utils_1.getRangeValue)(particle.options.move.drift) * container.retina.pixelRatio, maxSize = (0, Utils_1.getRangeMax)(particleOptions.size.value) * container.retina.pixelRatio, sizeFactor = moveOptions.size ? particle.getRadius() / maxSize : 1, diffFactor = 2, speedFactor = sizeFactor * slowFactor * (delta.factor || 1) / diffFactor, moveSpeed = baseSpeed * speedFactor;
        this.applyPath(particle, delta);
        const gravityOptions = moveOptions.gravity;
        const gravityFactor = gravityOptions.enable && gravityOptions.inverse ? -1 : 1;
        if (gravityOptions.enable && moveSpeed) {
          particle.velocity.y += gravityFactor * (gravityOptions.acceleration * delta.factor) / (60 * moveSpeed);
        }
        if (moveDrift && moveSpeed) {
          particle.velocity.x += moveDrift * delta.factor / (60 * moveSpeed);
        }
        const decay = particle.moveDecay;
        if (decay != 1) {
          particle.velocity.multTo(decay);
        }
        const velocity = particle.velocity.mult(moveSpeed);
        const maxSpeed = (_c = particle.retina.maxSpeed) !== null && _c !== void 0 ? _c : container.retina.maxSpeed;
        if (gravityOptions.enable && gravityOptions.maxSpeed > 0 && (!gravityOptions.inverse && velocity.y >= 0 && velocity.y >= maxSpeed || gravityOptions.inverse && velocity.y <= 0 && velocity.y <= -maxSpeed)) {
          velocity.y = gravityFactor * maxSpeed;
          if (moveSpeed) {
            particle.velocity.y = velocity.y / moveSpeed;
          }
        }
        const zIndexOptions = particle.options.zIndex, zVelocityFactor = (1 - particle.zIndexFactor) ** zIndexOptions.velocityRate;
        if (moveOptions.spin.enable) {
          this.spin(particle, moveSpeed);
        } else {
          if (zVelocityFactor != 1) {
            velocity.multTo(zVelocityFactor);
          }
          particle.position.addTo(velocity);
          if (moveOptions.vibrate) {
            particle.position.x += Math.sin(particle.position.x * Math.cos(particle.position.y));
            particle.position.y += Math.cos(particle.position.y * Math.sin(particle.position.x));
          }
        }
        applyDistance(particle);
      }
      spin(particle, moveSpeed) {
        const container = this.container;
        if (!particle.spin) {
          return;
        }
        const updateFunc = {
          x: particle.spin.direction === Enums_1.RotateDirection.clockwise ? Math.cos : Math.sin,
          y: particle.spin.direction === Enums_1.RotateDirection.clockwise ? Math.sin : Math.cos
        };
        particle.position.x = particle.spin.center.x + particle.spin.radius * updateFunc.x(particle.spin.angle);
        particle.position.y = particle.spin.center.y + particle.spin.radius * updateFunc.y(particle.spin.angle);
        particle.spin.radius += particle.spin.acceleration;
        const maxCanvasSize = Math.max(container.canvas.size.width, container.canvas.size.height);
        if (particle.spin.radius > maxCanvasSize / 2) {
          particle.spin.radius = maxCanvasSize / 2;
          particle.spin.acceleration *= -1;
        } else if (particle.spin.radius < 0) {
          particle.spin.radius = 0;
          particle.spin.acceleration *= -1;
        }
        particle.spin.angle += moveSpeed / 100 * (1 - particle.spin.radius / maxCanvasSize);
      }
      applyPath(particle, delta) {
        const particlesOptions = particle.options;
        const pathOptions = particlesOptions.move.path;
        const pathEnabled = pathOptions.enable;
        if (!pathEnabled) {
          return;
        }
        const container = this.container;
        if (particle.lastPathTime <= particle.pathDelay) {
          particle.lastPathTime += delta.value;
          return;
        }
        const path = container.pathGenerator.generate(particle);
        particle.velocity.addTo(path);
        if (pathOptions.clamp) {
          particle.velocity.x = (0, Utils_1.clamp)(particle.velocity.x, -1, 1);
          particle.velocity.y = (0, Utils_1.clamp)(particle.velocity.y, -1, 1);
        }
        particle.lastPathTime -= particle.pathDelay;
      }
      moveParallax(particle) {
        const container = this.container;
        const options2 = container.actualOptions;
        if ((0, Utils_1.isSsr)() || !options2.interactivity.events.onHover.parallax.enable) {
          return;
        }
        const parallaxForce = options2.interactivity.events.onHover.parallax.force;
        const mousePos = container.interactivity.mouse.position;
        if (!mousePos) {
          return;
        }
        const canvasCenter = {
          x: container.canvas.size.width / 2,
          y: container.canvas.size.height / 2
        };
        const parallaxSmooth = options2.interactivity.events.onHover.parallax.smooth;
        const factor = particle.getRadius() / parallaxForce;
        const tmp = {
          x: (mousePos.x - canvasCenter.x) * factor,
          y: (mousePos.y - canvasCenter.y) * factor
        };
        particle.offset.x += (tmp.x - particle.offset.x) / parallaxSmooth;
        particle.offset.y += (tmp.y - particle.offset.y) / parallaxSmooth;
      }
      getProximitySpeedFactor(particle) {
        const container = this.container;
        const options2 = container.actualOptions;
        const active = (0, Utils_1.isInArray)(Enums_1.HoverMode.slow, options2.interactivity.events.onHover.mode);
        if (!active) {
          return 1;
        }
        const mousePos = this.container.interactivity.mouse.position;
        if (!mousePos) {
          return 1;
        }
        const particlePos = particle.getPosition();
        const dist = (0, Utils_1.getDistance)(mousePos, particlePos);
        const radius = container.retina.slowModeRadius;
        if (dist > radius) {
          return 1;
        }
        const proximityFactor = dist / radius || 0;
        const slowFactor = options2.interactivity.modes.slow.factor;
        return proximityFactor / slowFactor;
      }
    };
    exports.Mover = Mover;
  }
});

// node_modules/tsparticles/Core/Particles.js
var require_Particles = __commonJS({
  "node_modules/tsparticles/Core/Particles.js"(exports) {
    init_shims();
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.Particles = void 0;
    var Particle_1 = require_Particle();
    var Utils_1 = require_Utils2();
    var InteractionManager_1 = require_InteractionManager();
    var ParticlesOptions_1 = require_ParticlesOptions();
    var Mover_1 = require_Mover();
    var Particles2 = class {
      constructor(container) {
        this.container = container;
        this.nextId = 0;
        this.array = [];
        this.zArray = [];
        this.mover = new Mover_1.Mover(container);
        this.limit = 0;
        this.needsSort = false;
        this.lastZIndex = 0;
        this.freqs = {
          links: new Map(),
          triangles: new Map()
        };
        this.interactionManager = new InteractionManager_1.InteractionManager(container);
        const canvasSize = this.container.canvas.size;
        this.linksColors = new Map();
        this.quadTree = new Utils_1.QuadTree(new Utils_1.Rectangle(-canvasSize.width / 4, -canvasSize.height / 4, canvasSize.width * 3 / 2, canvasSize.height * 3 / 2), 4);
        this.updaters = Utils_1.Plugins.getUpdaters(container, true);
      }
      get count() {
        return this.array.length;
      }
      init() {
        var _a;
        const container = this.container;
        const options2 = container.actualOptions;
        this.lastZIndex = 0;
        this.needsSort = false;
        this.freqs.links = new Map();
        this.freqs.triangles = new Map();
        let handled = false;
        this.updaters = Utils_1.Plugins.getUpdaters(container, true);
        this.interactionManager.init();
        for (const [, plugin] of container.plugins) {
          if (plugin.particlesInitialization !== void 0) {
            handled = plugin.particlesInitialization();
          }
          if (handled) {
            break;
          }
        }
        this.addManualParticles();
        if (!handled) {
          for (const group in options2.particles.groups) {
            const groupOptions = options2.particles.groups[group];
            for (let i = this.count, j = 0; j < ((_a = groupOptions.number) === null || _a === void 0 ? void 0 : _a.value) && i < options2.particles.number.value; i++, j++) {
              this.addParticle(void 0, groupOptions, group);
            }
          }
          for (let i = this.count; i < options2.particles.number.value; i++) {
            this.addParticle();
          }
        }
        container.pathGenerator.init(container);
      }
      redraw() {
        this.clear();
        this.init();
        this.draw({ value: 0, factor: 0 });
      }
      removeAt(index, quantity = 1, group, override) {
        if (!(index >= 0 && index <= this.count)) {
          return;
        }
        let deleted = 0;
        for (let i = index; deleted < quantity && i < this.count; i++) {
          const particle = this.array[i];
          if (!particle || particle.group !== group) {
            continue;
          }
          particle.destroy(override);
          this.array.splice(i--, 1);
          const zIdx = this.zArray.indexOf(particle);
          this.zArray.splice(zIdx, 1);
          deleted++;
        }
      }
      remove(particle, group, override) {
        this.removeAt(this.array.indexOf(particle), void 0, group, override);
      }
      update(delta) {
        const container = this.container;
        const particlesToDelete = [];
        container.pathGenerator.update();
        for (const [, plugin] of container.plugins) {
          if (plugin.update !== void 0) {
            plugin.update(delta);
          }
        }
        for (const particle of this.array) {
          const resizeFactor = container.canvas.resizeFactor;
          if (resizeFactor) {
            particle.position.x *= resizeFactor.width;
            particle.position.y *= resizeFactor.height;
          }
          particle.bubble.inRange = false;
          for (const [, plugin] of this.container.plugins) {
            if (particle.destroyed) {
              break;
            }
            if (plugin.particleUpdate) {
              plugin.particleUpdate(particle, delta);
            }
          }
          this.mover.move(particle, delta);
          if (particle.destroyed) {
            particlesToDelete.push(particle);
            continue;
          }
          this.quadTree.insert(new Utils_1.Point(particle.getPosition(), particle));
        }
        for (const particle of particlesToDelete) {
          this.remove(particle);
        }
        this.interactionManager.externalInteract(delta);
        for (const particle of container.particles.array) {
          for (const updater of this.updaters) {
            updater.update(particle, delta);
          }
          if (!particle.destroyed && !particle.spawning) {
            this.interactionManager.particlesInteract(particle, delta);
          }
        }
        delete container.canvas.resizeFactor;
      }
      draw(delta) {
        const container = this.container;
        container.canvas.clear();
        const canvasSize = this.container.canvas.size;
        this.quadTree = new Utils_1.QuadTree(new Utils_1.Rectangle(-canvasSize.width / 4, -canvasSize.height / 4, canvasSize.width * 3 / 2, canvasSize.height * 3 / 2), 4);
        this.update(delta);
        if (this.needsSort) {
          this.zArray.sort((a, b) => b.position.z - a.position.z || a.id - b.id);
          this.lastZIndex = this.zArray[this.zArray.length - 1].position.z;
          this.needsSort = false;
        }
        for (const [, plugin] of container.plugins) {
          container.canvas.drawPlugin(plugin, delta);
        }
        for (const p of this.zArray) {
          p.draw(delta);
        }
      }
      clear() {
        this.array = [];
        this.zArray = [];
      }
      push(nb, mouse, overrideOptions, group) {
        this.pushing = true;
        for (let i = 0; i < nb; i++) {
          this.addParticle(mouse === null || mouse === void 0 ? void 0 : mouse.position, overrideOptions, group);
        }
        this.pushing = false;
      }
      addParticle(position, overrideOptions, group) {
        const container = this.container;
        const options2 = container.actualOptions;
        const limit = options2.particles.number.limit * container.density;
        if (limit > 0) {
          const countToRemove = this.count + 1 - limit;
          if (countToRemove > 0) {
            this.removeQuantity(countToRemove);
          }
        }
        return this.pushParticle(position, overrideOptions, group);
      }
      addSplitParticle(parent) {
        const splitOptions = parent.options.destroy.split;
        const options2 = new ParticlesOptions_1.ParticlesOptions();
        options2.load(parent.options);
        const factor = (0, Utils_1.getRangeValue)(splitOptions.factor.value);
        options2.color.load({
          value: {
            hsl: parent.getFillColor()
          }
        });
        if (typeof options2.size.value === "number") {
          options2.size.value /= factor;
        } else {
          options2.size.value.min /= factor;
          options2.size.value.max /= factor;
        }
        options2.load(splitOptions.particles);
        const offset = splitOptions.sizeOffset ? (0, Utils_1.setRangeValue)(-parent.size.value, parent.size.value) : 0;
        const position = {
          x: parent.position.x + (0, Utils_1.randomInRange)(offset),
          y: parent.position.y + (0, Utils_1.randomInRange)(offset)
        };
        return this.pushParticle(position, options2, parent.group, (particle) => {
          if (particle.size.value < 0.5) {
            return false;
          }
          particle.velocity.length = (0, Utils_1.randomInRange)((0, Utils_1.setRangeValue)(parent.velocity.length, particle.velocity.length));
          particle.splitCount = parent.splitCount + 1;
          particle.unbreakable = true;
          setTimeout(() => {
            particle.unbreakable = false;
          }, 500);
          return true;
        });
      }
      removeQuantity(quantity, group) {
        this.removeAt(0, quantity, group);
      }
      getLinkFrequency(p1, p2) {
        const key = `${Math.min(p1.id, p2.id)}_${Math.max(p1.id, p2.id)}`;
        let res = this.freqs.links.get(key);
        if (res === void 0) {
          res = Math.random();
          this.freqs.links.set(key, res);
        }
        return res;
      }
      getTriangleFrequency(p1, p2, p3) {
        let [id1, id2, id3] = [p1.id, p2.id, p3.id];
        if (id1 > id2) {
          [id2, id1] = [id1, id2];
        }
        if (id2 > id3) {
          [id3, id2] = [id2, id3];
        }
        if (id1 > id3) {
          [id3, id1] = [id1, id3];
        }
        const key = `${id1}_${id2}_${id3}`;
        let res = this.freqs.triangles.get(key);
        if (res === void 0) {
          res = Math.random();
          this.freqs.triangles.set(key, res);
        }
        return res;
      }
      addManualParticles() {
        const container = this.container;
        const options2 = container.actualOptions;
        for (const particle of options2.manualParticles) {
          const pos = particle.position ? {
            x: particle.position.x * container.canvas.size.width / 100,
            y: particle.position.y * container.canvas.size.height / 100
          } : void 0;
          this.addParticle(pos, particle.options);
        }
      }
      setDensity() {
        const options2 = this.container.actualOptions;
        for (const group in options2.particles.groups) {
          this.applyDensity(options2.particles.groups[group], 0, group);
        }
        this.applyDensity(options2.particles, options2.manualParticles.length);
      }
      applyDensity(options2, manualCount, group) {
        var _a;
        if (!((_a = options2.number.density) === null || _a === void 0 ? void 0 : _a.enable)) {
          return;
        }
        const numberOptions = options2.number;
        const densityFactor = this.initDensityFactor(numberOptions.density);
        const optParticlesNumber = numberOptions.value;
        const optParticlesLimit = numberOptions.limit > 0 ? numberOptions.limit : optParticlesNumber;
        const particlesNumber = Math.min(optParticlesNumber, optParticlesLimit) * densityFactor + manualCount;
        const particlesCount = Math.min(this.count, this.array.filter((t) => t.group === group).length);
        this.limit = numberOptions.limit * densityFactor;
        if (particlesCount < particlesNumber) {
          this.push(Math.abs(particlesNumber - particlesCount), void 0, options2, group);
        } else if (particlesCount > particlesNumber) {
          this.removeQuantity(particlesCount - particlesNumber, group);
        }
      }
      initDensityFactor(densityOptions) {
        const container = this.container;
        if (!container.canvas.element || !densityOptions.enable) {
          return 1;
        }
        const canvas = container.canvas.element;
        const pxRatio = container.retina.pixelRatio;
        return canvas.width * canvas.height / (densityOptions.factor * pxRatio ** 2 * densityOptions.area);
      }
      pushParticle(position, overrideOptions, group, initializer) {
        try {
          const particle = new Particle_1.Particle(this.nextId, this.container, position, overrideOptions, group);
          let canAdd = true;
          if (initializer) {
            canAdd = initializer(particle);
          }
          if (!canAdd) {
            return;
          }
          this.array.push(particle);
          this.zArray.push(particle);
          this.nextId++;
          return particle;
        } catch (e) {
          console.warn(`error adding particle: ${e}`);
          return;
        }
      }
    };
    exports.Particles = Particles2;
  }
});

// node_modules/tsparticles/Core/Retina.js
var require_Retina = __commonJS({
  "node_modules/tsparticles/Core/Retina.js"(exports) {
    init_shims();
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.Retina = void 0;
    var Utils_1 = require_Utils2();
    var Retina = class {
      constructor(container) {
        this.container = container;
      }
      init() {
        const container = this.container;
        const options2 = container.actualOptions;
        this.pixelRatio = !options2.detectRetina || (0, Utils_1.isSsr)() ? 1 : window.devicePixelRatio;
        const motionOptions = this.container.actualOptions.motion;
        if (motionOptions && (motionOptions.disable || motionOptions.reduce.value)) {
          if ((0, Utils_1.isSsr)() || typeof matchMedia === "undefined" || !matchMedia) {
            this.reduceFactor = 1;
          } else {
            const mediaQuery = matchMedia("(prefers-reduced-motion: reduce)");
            if (mediaQuery) {
              this.handleMotionChange(mediaQuery);
              const handleChange = () => {
                this.handleMotionChange(mediaQuery);
                container.refresh().catch(() => {
                });
              };
              if (mediaQuery.addEventListener !== void 0) {
                mediaQuery.addEventListener("change", handleChange);
              } else if (mediaQuery.addListener !== void 0) {
                mediaQuery.addListener(handleChange);
              }
            }
          }
        } else {
          this.reduceFactor = 1;
        }
        const ratio = this.pixelRatio;
        if (container.canvas.element) {
          const element = container.canvas.element;
          container.canvas.size.width = element.offsetWidth * ratio;
          container.canvas.size.height = element.offsetHeight * ratio;
        }
        const particles = options2.particles;
        this.attractDistance = particles.move.attract.distance * ratio;
        this.linksDistance = particles.links.distance * ratio;
        this.linksWidth = particles.links.width * ratio;
        this.sizeAnimationSpeed = particles.size.animation.speed * ratio;
        this.maxSpeed = particles.move.gravity.maxSpeed * ratio;
        if (particles.orbit.radius !== void 0) {
          this.orbitRadius = particles.orbit.radius * this.container.retina.pixelRatio;
        }
        const modes = options2.interactivity.modes;
        this.connectModeDistance = modes.connect.distance * ratio;
        this.connectModeRadius = modes.connect.radius * ratio;
        this.grabModeDistance = modes.grab.distance * ratio;
        this.repulseModeDistance = modes.repulse.distance * ratio;
        this.bounceModeDistance = modes.bounce.distance * ratio;
        this.attractModeDistance = modes.attract.distance * ratio;
        this.slowModeRadius = modes.slow.radius * ratio;
        this.bubbleModeDistance = modes.bubble.distance * ratio;
        if (modes.bubble.size) {
          this.bubbleModeSize = modes.bubble.size * ratio;
        }
      }
      initParticle(particle) {
        const options2 = particle.options;
        const ratio = this.pixelRatio;
        const moveDistance = options2.move.distance;
        const props = particle.retina;
        props.attractDistance = options2.move.attract.distance * ratio;
        props.linksDistance = options2.links.distance * ratio;
        props.linksWidth = options2.links.width * ratio;
        props.moveDrift = (0, Utils_1.getRangeValue)(options2.move.drift) * ratio;
        props.moveSpeed = (0, Utils_1.getRangeValue)(options2.move.speed) * ratio;
        props.sizeAnimationSpeed = options2.size.animation.speed * ratio;
        if (particle.spin) {
          props.spinAcceleration = (0, Utils_1.getRangeValue)(options2.move.spin.acceleration) * ratio;
        }
        const maxDistance = props.maxDistance;
        maxDistance.horizontal = moveDistance.horizontal !== void 0 ? moveDistance.horizontal * ratio : void 0;
        maxDistance.vertical = moveDistance.vertical !== void 0 ? moveDistance.vertical * ratio : void 0;
        props.maxSpeed = options2.move.gravity.maxSpeed * ratio;
      }
      handleMotionChange(mediaQuery) {
        const options2 = this.container.actualOptions;
        if (mediaQuery.matches) {
          const motion = options2.motion;
          this.reduceFactor = motion.disable ? 0 : motion.reduce.value ? 1 / motion.reduce.factor : 1;
        } else {
          this.reduceFactor = 1;
        }
      }
    };
    exports.Retina = Retina;
  }
});

// node_modules/tsparticles/Core/FrameManager.js
var require_FrameManager = __commonJS({
  "node_modules/tsparticles/Core/FrameManager.js"(exports) {
    init_shims();
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.FrameManager = void 0;
    var FrameManager = class {
      constructor(container) {
        this.container = container;
      }
      nextFrame(timestamp) {
        var _a;
        try {
          const container = this.container;
          if (container.lastFrameTime !== void 0 && timestamp < container.lastFrameTime + 1e3 / container.fpsLimit) {
            container.draw(false);
            return;
          }
          (_a = container.lastFrameTime) !== null && _a !== void 0 ? _a : container.lastFrameTime = timestamp;
          const deltaValue = timestamp - container.lastFrameTime;
          const delta = {
            value: deltaValue,
            factor: 60 * deltaValue / 1e3
          };
          container.lifeTime += delta.value;
          container.lastFrameTime = timestamp;
          if (deltaValue > 1e3) {
            container.draw(false);
            return;
          }
          container.particles.draw(delta);
          if (container.duration > 0 && container.lifeTime > container.duration) {
            container.destroy();
            return;
          }
          if (container.getAnimationStatus()) {
            container.draw(false);
          }
        } catch (e) {
          console.error("tsParticles error in animation loop", e);
        }
      }
    };
    exports.FrameManager = FrameManager;
  }
});

// node_modules/tsparticles/Options/Classes/Interactivity/Events/ClickEvent.js
var require_ClickEvent = __commonJS({
  "node_modules/tsparticles/Options/Classes/Interactivity/Events/ClickEvent.js"(exports) {
    init_shims();
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.ClickEvent = void 0;
    var ClickEvent = class {
      constructor() {
        this.enable = false;
        this.mode = [];
      }
      load(data) {
        if (data === void 0) {
          return;
        }
        if (data.enable !== void 0) {
          this.enable = data.enable;
        }
        if (data.mode !== void 0) {
          this.mode = data.mode;
        }
      }
    };
    exports.ClickEvent = ClickEvent;
  }
});

// node_modules/tsparticles/Options/Classes/Interactivity/Events/DivEvent.js
var require_DivEvent = __commonJS({
  "node_modules/tsparticles/Options/Classes/Interactivity/Events/DivEvent.js"(exports) {
    init_shims();
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.DivEvent = void 0;
    var Enums_1 = require_Enums();
    var DivEvent = class {
      constructor() {
        this.selectors = [];
        this.enable = false;
        this.mode = [];
        this.type = Enums_1.DivType.circle;
      }
      get elementId() {
        return this.ids;
      }
      set elementId(value) {
        this.ids = value;
      }
      get el() {
        return this.elementId;
      }
      set el(value) {
        this.elementId = value;
      }
      get ids() {
        return this.selectors instanceof Array ? this.selectors.map((t) => t.replace("#", "")) : this.selectors.replace("#", "");
      }
      set ids(value) {
        this.selectors = value instanceof Array ? value.map((t) => `#${t}`) : `#${value}`;
      }
      load(data) {
        var _a, _b;
        if (data === void 0) {
          return;
        }
        const ids = (_b = (_a = data.ids) !== null && _a !== void 0 ? _a : data.elementId) !== null && _b !== void 0 ? _b : data.el;
        if (ids !== void 0) {
          this.ids = ids;
        }
        if (data.selectors !== void 0) {
          this.selectors = data.selectors;
        }
        if (data.enable !== void 0) {
          this.enable = data.enable;
        }
        if (data.mode !== void 0) {
          this.mode = data.mode;
        }
        if (data.type !== void 0) {
          this.type = data.type;
        }
      }
    };
    exports.DivEvent = DivEvent;
  }
});

// node_modules/tsparticles/Options/Classes/Interactivity/Events/Parallax.js
var require_Parallax = __commonJS({
  "node_modules/tsparticles/Options/Classes/Interactivity/Events/Parallax.js"(exports) {
    init_shims();
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.Parallax = void 0;
    var Parallax = class {
      constructor() {
        this.enable = false;
        this.force = 2;
        this.smooth = 10;
      }
      load(data) {
        if (data === void 0) {
          return;
        }
        if (data.enable !== void 0) {
          this.enable = data.enable;
        }
        if (data.force !== void 0) {
          this.force = data.force;
        }
        if (data.smooth !== void 0) {
          this.smooth = data.smooth;
        }
      }
    };
    exports.Parallax = Parallax;
  }
});

// node_modules/tsparticles/Options/Classes/Interactivity/Events/HoverEvent.js
var require_HoverEvent = __commonJS({
  "node_modules/tsparticles/Options/Classes/Interactivity/Events/HoverEvent.js"(exports) {
    init_shims();
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.HoverEvent = void 0;
    var Parallax_1 = require_Parallax();
    var HoverEvent = class {
      constructor() {
        this.enable = false;
        this.mode = [];
        this.parallax = new Parallax_1.Parallax();
      }
      load(data) {
        if (data === void 0) {
          return;
        }
        if (data.enable !== void 0) {
          this.enable = data.enable;
        }
        if (data.mode !== void 0) {
          this.mode = data.mode;
        }
        this.parallax.load(data.parallax);
      }
    };
    exports.HoverEvent = HoverEvent;
  }
});

// node_modules/tsparticles/Options/Classes/Interactivity/Events/Events.js
var require_Events = __commonJS({
  "node_modules/tsparticles/Options/Classes/Interactivity/Events/Events.js"(exports) {
    init_shims();
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.Events = void 0;
    var ClickEvent_1 = require_ClickEvent();
    var DivEvent_1 = require_DivEvent();
    var HoverEvent_1 = require_HoverEvent();
    var Events = class {
      constructor() {
        this.onClick = new ClickEvent_1.ClickEvent();
        this.onDiv = new DivEvent_1.DivEvent();
        this.onHover = new HoverEvent_1.HoverEvent();
        this.resize = true;
      }
      get onclick() {
        return this.onClick;
      }
      set onclick(value) {
        this.onClick = value;
      }
      get ondiv() {
        return this.onDiv;
      }
      set ondiv(value) {
        this.onDiv = value;
      }
      get onhover() {
        return this.onHover;
      }
      set onhover(value) {
        this.onHover = value;
      }
      load(data) {
        var _a, _b, _c;
        if (data === void 0) {
          return;
        }
        this.onClick.load((_a = data.onClick) !== null && _a !== void 0 ? _a : data.onclick);
        const onDiv = (_b = data.onDiv) !== null && _b !== void 0 ? _b : data.ondiv;
        if (onDiv !== void 0) {
          if (onDiv instanceof Array) {
            this.onDiv = onDiv.map((div) => {
              const tmp = new DivEvent_1.DivEvent();
              tmp.load(div);
              return tmp;
            });
          } else {
            this.onDiv = new DivEvent_1.DivEvent();
            this.onDiv.load(onDiv);
          }
        }
        this.onHover.load((_c = data.onHover) !== null && _c !== void 0 ? _c : data.onhover);
        if (data.resize !== void 0) {
          this.resize = data.resize;
        }
      }
    };
    exports.Events = Events;
  }
});

// node_modules/tsparticles/Options/Classes/Interactivity/Modes/BubbleBase.js
var require_BubbleBase = __commonJS({
  "node_modules/tsparticles/Options/Classes/Interactivity/Modes/BubbleBase.js"(exports) {
    init_shims();
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.BubbleBase = void 0;
    var OptionsColor_1 = require_OptionsColor();
    var BubbleBase = class {
      constructor() {
        this.distance = 200;
        this.duration = 0.4;
        this.mix = false;
      }
      load(data) {
        if (data === void 0) {
          return;
        }
        if (data.distance !== void 0) {
          this.distance = data.distance;
        }
        if (data.duration !== void 0) {
          this.duration = data.duration;
        }
        if (data.mix !== void 0) {
          this.mix = data.mix;
        }
        if (data.opacity !== void 0) {
          this.opacity = data.opacity;
        }
        if (data.color !== void 0) {
          if (data.color instanceof Array) {
            this.color = data.color.map((s2) => OptionsColor_1.OptionsColor.create(void 0, s2));
          } else {
            if (this.color instanceof Array) {
              this.color = new OptionsColor_1.OptionsColor();
            }
            this.color = OptionsColor_1.OptionsColor.create(this.color, data.color);
          }
        }
        if (data.size !== void 0) {
          this.size = data.size;
        }
      }
    };
    exports.BubbleBase = BubbleBase;
  }
});

// node_modules/tsparticles/Options/Classes/Interactivity/Modes/BubbleDiv.js
var require_BubbleDiv = __commonJS({
  "node_modules/tsparticles/Options/Classes/Interactivity/Modes/BubbleDiv.js"(exports) {
    init_shims();
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.BubbleDiv = void 0;
    var BubbleBase_1 = require_BubbleBase();
    var BubbleDiv = class extends BubbleBase_1.BubbleBase {
      constructor() {
        super();
        this.selectors = [];
      }
      get ids() {
        return this.selectors instanceof Array ? this.selectors.map((t) => t.replace("#", "")) : this.selectors.replace("#", "");
      }
      set ids(value) {
        this.selectors = value instanceof Array ? value.map((t) => `#${t}`) : `#${value}`;
      }
      load(data) {
        super.load(data);
        if (data === void 0) {
          return;
        }
        if (data.ids !== void 0) {
          this.ids = data.ids;
        }
        if (data.selectors !== void 0) {
          this.selectors = data.selectors;
        }
      }
    };
    exports.BubbleDiv = BubbleDiv;
  }
});

// node_modules/tsparticles/Options/Classes/Interactivity/Modes/Bubble.js
var require_Bubble = __commonJS({
  "node_modules/tsparticles/Options/Classes/Interactivity/Modes/Bubble.js"(exports) {
    init_shims();
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.Bubble = void 0;
    var BubbleDiv_1 = require_BubbleDiv();
    var BubbleBase_1 = require_BubbleBase();
    var Bubble = class extends BubbleBase_1.BubbleBase {
      load(data) {
        super.load(data);
        if (!(data !== void 0 && data.divs !== void 0)) {
          return;
        }
        if (data.divs instanceof Array) {
          this.divs = data.divs.map((s2) => {
            const tmp = new BubbleDiv_1.BubbleDiv();
            tmp.load(s2);
            return tmp;
          });
        } else {
          if (this.divs instanceof Array || !this.divs) {
            this.divs = new BubbleDiv_1.BubbleDiv();
          }
          this.divs.load(data.divs);
        }
      }
    };
    exports.Bubble = Bubble;
  }
});

// node_modules/tsparticles/Options/Classes/Interactivity/Modes/ConnectLinks.js
var require_ConnectLinks = __commonJS({
  "node_modules/tsparticles/Options/Classes/Interactivity/Modes/ConnectLinks.js"(exports) {
    init_shims();
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.ConnectLinks = void 0;
    var ConnectLinks = class {
      constructor() {
        this.opacity = 0.5;
      }
      load(data) {
        if (!(data !== void 0 && data.opacity !== void 0)) {
          return;
        }
        this.opacity = data.opacity;
      }
    };
    exports.ConnectLinks = ConnectLinks;
  }
});

// node_modules/tsparticles/Options/Classes/Interactivity/Modes/Connect.js
var require_Connect = __commonJS({
  "node_modules/tsparticles/Options/Classes/Interactivity/Modes/Connect.js"(exports) {
    init_shims();
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.Connect = void 0;
    var ConnectLinks_1 = require_ConnectLinks();
    var Connect = class {
      constructor() {
        this.distance = 80;
        this.links = new ConnectLinks_1.ConnectLinks();
        this.radius = 60;
      }
      get line_linked() {
        return this.links;
      }
      set line_linked(value) {
        this.links = value;
      }
      get lineLinked() {
        return this.links;
      }
      set lineLinked(value) {
        this.links = value;
      }
      load(data) {
        var _a, _b;
        if (data === void 0) {
          return;
        }
        if (data.distance !== void 0) {
          this.distance = data.distance;
        }
        this.links.load((_b = (_a = data.links) !== null && _a !== void 0 ? _a : data.lineLinked) !== null && _b !== void 0 ? _b : data.line_linked);
        if (data.radius !== void 0) {
          this.radius = data.radius;
        }
      }
    };
    exports.Connect = Connect;
  }
});

// node_modules/tsparticles/Options/Classes/Interactivity/Modes/GrabLinks.js
var require_GrabLinks = __commonJS({
  "node_modules/tsparticles/Options/Classes/Interactivity/Modes/GrabLinks.js"(exports) {
    init_shims();
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.GrabLinks = void 0;
    var OptionsColor_1 = require_OptionsColor();
    var GrabLinks = class {
      constructor() {
        this.blink = false;
        this.consent = false;
        this.opacity = 1;
      }
      load(data) {
        if (data === void 0) {
          return;
        }
        if (data.blink !== void 0) {
          this.blink = data.blink;
        }
        if (data.color !== void 0) {
          this.color = OptionsColor_1.OptionsColor.create(this.color, data.color);
        }
        if (data.consent !== void 0) {
          this.consent = data.consent;
        }
        if (data.opacity !== void 0) {
          this.opacity = data.opacity;
        }
      }
    };
    exports.GrabLinks = GrabLinks;
  }
});

// node_modules/tsparticles/Options/Classes/Interactivity/Modes/Grab.js
var require_Grab = __commonJS({
  "node_modules/tsparticles/Options/Classes/Interactivity/Modes/Grab.js"(exports) {
    init_shims();
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.Grab = void 0;
    var GrabLinks_1 = require_GrabLinks();
    var Grab = class {
      constructor() {
        this.distance = 100;
        this.links = new GrabLinks_1.GrabLinks();
      }
      get line_linked() {
        return this.links;
      }
      set line_linked(value) {
        this.links = value;
      }
      get lineLinked() {
        return this.links;
      }
      set lineLinked(value) {
        this.links = value;
      }
      load(data) {
        var _a, _b;
        if (data === void 0) {
          return;
        }
        if (data.distance !== void 0) {
          this.distance = data.distance;
        }
        this.links.load((_b = (_a = data.links) !== null && _a !== void 0 ? _a : data.lineLinked) !== null && _b !== void 0 ? _b : data.line_linked);
      }
    };
    exports.Grab = Grab;
  }
});

// node_modules/tsparticles/Options/Classes/Interactivity/Modes/Remove.js
var require_Remove = __commonJS({
  "node_modules/tsparticles/Options/Classes/Interactivity/Modes/Remove.js"(exports) {
    init_shims();
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.Remove = void 0;
    var Remove = class {
      constructor() {
        this.quantity = 2;
      }
      get particles_nb() {
        return this.quantity;
      }
      set particles_nb(value) {
        this.quantity = value;
      }
      load(data) {
        var _a;
        if (data === void 0) {
          return;
        }
        const quantity = (_a = data.quantity) !== null && _a !== void 0 ? _a : data.particles_nb;
        if (quantity !== void 0) {
          this.quantity = quantity;
        }
      }
    };
    exports.Remove = Remove;
  }
});

// node_modules/tsparticles/Options/Classes/Interactivity/Modes/Push.js
var require_Push = __commonJS({
  "node_modules/tsparticles/Options/Classes/Interactivity/Modes/Push.js"(exports) {
    init_shims();
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.Push = void 0;
    var Push = class {
      constructor() {
        this.default = true;
        this.groups = [];
        this.quantity = 4;
      }
      get particles_nb() {
        return this.quantity;
      }
      set particles_nb(value) {
        this.quantity = value;
      }
      load(data) {
        var _a;
        if (data === void 0) {
          return;
        }
        if (data.default !== void 0) {
          this.default = data.default;
        }
        if (data.groups !== void 0) {
          this.groups = data.groups.map((t) => t);
        }
        if (!this.groups.length) {
          this.default = true;
        }
        const quantity = (_a = data.quantity) !== null && _a !== void 0 ? _a : data.particles_nb;
        if (quantity !== void 0) {
          this.quantity = quantity;
        }
      }
    };
    exports.Push = Push;
  }
});

// node_modules/tsparticles/Options/Classes/Interactivity/Modes/RepulseBase.js
var require_RepulseBase = __commonJS({
  "node_modules/tsparticles/Options/Classes/Interactivity/Modes/RepulseBase.js"(exports) {
    init_shims();
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.RepulseBase = void 0;
    var Enums_1 = require_Enums();
    var RepulseBase = class {
      constructor() {
        this.distance = 200;
        this.duration = 0.4;
        this.factor = 100;
        this.speed = 1;
        this.maxSpeed = 50;
        this.easing = Enums_1.EasingType.easeOutQuad;
      }
      load(data) {
        if (!data) {
          return;
        }
        if (data.distance !== void 0) {
          this.distance = data.distance;
        }
        if (data.duration !== void 0) {
          this.duration = data.duration;
        }
        if (data.easing !== void 0) {
          this.easing = data.easing;
        }
        if (data.factor !== void 0) {
          this.factor = data.factor;
        }
        if (data.speed !== void 0) {
          this.speed = data.speed;
        }
        if (data.maxSpeed !== void 0) {
          this.maxSpeed = data.maxSpeed;
        }
      }
    };
    exports.RepulseBase = RepulseBase;
  }
});

// node_modules/tsparticles/Options/Classes/Interactivity/Modes/RepulseDiv.js
var require_RepulseDiv = __commonJS({
  "node_modules/tsparticles/Options/Classes/Interactivity/Modes/RepulseDiv.js"(exports) {
    init_shims();
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.RepulseDiv = void 0;
    var RepulseBase_1 = require_RepulseBase();
    var RepulseDiv = class extends RepulseBase_1.RepulseBase {
      constructor() {
        super();
        this.selectors = [];
      }
      get ids() {
        if (this.selectors instanceof Array) {
          return this.selectors.map((t) => t.replace("#", ""));
        } else {
          return this.selectors.replace("#", "");
        }
      }
      set ids(value) {
        if (value instanceof Array) {
          this.selectors = value.map(() => `#${value}`);
        } else {
          this.selectors = `#${value}`;
        }
      }
      load(data) {
        super.load(data);
        if (data === void 0) {
          return;
        }
        if (data.ids !== void 0) {
          this.ids = data.ids;
        }
        if (data.selectors !== void 0) {
          this.selectors = data.selectors;
        }
      }
    };
    exports.RepulseDiv = RepulseDiv;
  }
});

// node_modules/tsparticles/Options/Classes/Interactivity/Modes/Repulse.js
var require_Repulse2 = __commonJS({
  "node_modules/tsparticles/Options/Classes/Interactivity/Modes/Repulse.js"(exports) {
    init_shims();
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.Repulse = void 0;
    var RepulseDiv_1 = require_RepulseDiv();
    var RepulseBase_1 = require_RepulseBase();
    var Repulse = class extends RepulseBase_1.RepulseBase {
      load(data) {
        super.load(data);
        if ((data === null || data === void 0 ? void 0 : data.divs) === void 0) {
          return;
        }
        if (data.divs instanceof Array) {
          this.divs = data.divs.map((s2) => {
            const tmp = new RepulseDiv_1.RepulseDiv();
            tmp.load(s2);
            return tmp;
          });
        } else {
          if (this.divs instanceof Array || !this.divs) {
            this.divs = new RepulseDiv_1.RepulseDiv();
          }
          this.divs.load(data.divs);
        }
      }
    };
    exports.Repulse = Repulse;
  }
});

// node_modules/tsparticles/Options/Classes/Interactivity/Modes/Slow.js
var require_Slow = __commonJS({
  "node_modules/tsparticles/Options/Classes/Interactivity/Modes/Slow.js"(exports) {
    init_shims();
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.Slow = void 0;
    var Slow = class {
      constructor() {
        this.factor = 3;
        this.radius = 200;
      }
      get active() {
        return false;
      }
      set active(_value) {
      }
      load(data) {
        if (data === void 0) {
          return;
        }
        if (data.factor !== void 0) {
          this.factor = data.factor;
        }
        if (data.radius !== void 0) {
          this.radius = data.radius;
        }
      }
    };
    exports.Slow = Slow;
  }
});

// node_modules/tsparticles/Options/Classes/Interactivity/Modes/Trail.js
var require_Trail2 = __commonJS({
  "node_modules/tsparticles/Options/Classes/Interactivity/Modes/Trail.js"(exports) {
    init_shims();
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.Trail = void 0;
    var Utils_1 = require_Utils2();
    var Trail = class {
      constructor() {
        this.delay = 1;
        this.pauseOnStop = false;
        this.quantity = 1;
      }
      load(data) {
        if (data === void 0) {
          return;
        }
        if (data.delay !== void 0) {
          this.delay = data.delay;
        }
        if (data.quantity !== void 0) {
          this.quantity = data.quantity;
        }
        if (data.particles !== void 0) {
          this.particles = (0, Utils_1.deepExtend)({}, data.particles);
        }
        if (data.pauseOnStop !== void 0) {
          this.pauseOnStop = data.pauseOnStop;
        }
      }
    };
    exports.Trail = Trail;
  }
});

// node_modules/tsparticles/Options/Classes/Interactivity/Modes/Attract.js
var require_Attract2 = __commonJS({
  "node_modules/tsparticles/Options/Classes/Interactivity/Modes/Attract.js"(exports) {
    init_shims();
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.Attract = void 0;
    var Enums_1 = require_Enums();
    var Attract = class {
      constructor() {
        this.distance = 200;
        this.duration = 0.4;
        this.easing = Enums_1.EasingType.easeOutQuad;
        this.factor = 1;
        this.maxSpeed = 50;
        this.speed = 1;
      }
      load(data) {
        if (!data) {
          return;
        }
        if (data.distance !== void 0) {
          this.distance = data.distance;
        }
        if (data.duration !== void 0) {
          this.duration = data.duration;
        }
        if (data.easing !== void 0) {
          this.easing = data.easing;
        }
        if (data.factor !== void 0) {
          this.factor = data.factor;
        }
        if (data.maxSpeed !== void 0) {
          this.maxSpeed = data.maxSpeed;
        }
        if (data.speed !== void 0) {
          this.speed = data.speed;
        }
      }
    };
    exports.Attract = Attract;
  }
});

// node_modules/tsparticles/Options/Classes/Interactivity/Modes/LightGradient.js
var require_LightGradient = __commonJS({
  "node_modules/tsparticles/Options/Classes/Interactivity/Modes/LightGradient.js"(exports) {
    init_shims();
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.LightGradient = void 0;
    var OptionsColor_1 = require_OptionsColor();
    var LightGradient = class {
      constructor() {
        this.start = new OptionsColor_1.OptionsColor();
        this.stop = new OptionsColor_1.OptionsColor();
        this.start.value = "#ffffff";
        this.stop.value = "#000000";
      }
      load(data) {
        if (data === void 0) {
          return;
        }
        this.start = OptionsColor_1.OptionsColor.create(this.start, data.start);
        this.stop = OptionsColor_1.OptionsColor.create(this.stop, data.stop);
      }
    };
    exports.LightGradient = LightGradient;
  }
});

// node_modules/tsparticles/Options/Classes/Interactivity/Modes/LightArea.js
var require_LightArea = __commonJS({
  "node_modules/tsparticles/Options/Classes/Interactivity/Modes/LightArea.js"(exports) {
    init_shims();
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.LightArea = void 0;
    var LightGradient_1 = require_LightGradient();
    var LightArea = class {
      constructor() {
        this.gradient = new LightGradient_1.LightGradient();
        this.radius = 1e3;
      }
      load(data) {
        if (data === void 0) {
          return;
        }
        this.gradient.load(data.gradient);
        if (data.radius !== void 0) {
          this.radius = data.radius;
        }
      }
    };
    exports.LightArea = LightArea;
  }
});

// node_modules/tsparticles/Options/Classes/Interactivity/Modes/LightShadow.js
var require_LightShadow = __commonJS({
  "node_modules/tsparticles/Options/Classes/Interactivity/Modes/LightShadow.js"(exports) {
    init_shims();
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.LightShadow = void 0;
    var OptionsColor_1 = require_OptionsColor();
    var LightShadow = class {
      constructor() {
        this.color = new OptionsColor_1.OptionsColor();
        this.color.value = "#000000";
        this.length = 2e3;
      }
      load(data) {
        if (data === void 0) {
          return;
        }
        this.color = OptionsColor_1.OptionsColor.create(this.color, data.color);
        if (data.length !== void 0) {
          this.length = data.length;
        }
      }
    };
    exports.LightShadow = LightShadow;
  }
});

// node_modules/tsparticles/Options/Classes/Interactivity/Modes/Light.js
var require_Light = __commonJS({
  "node_modules/tsparticles/Options/Classes/Interactivity/Modes/Light.js"(exports) {
    init_shims();
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.Light = void 0;
    var LightArea_1 = require_LightArea();
    var LightShadow_1 = require_LightShadow();
    var Light = class {
      constructor() {
        this.area = new LightArea_1.LightArea();
        this.shadow = new LightShadow_1.LightShadow();
      }
      load(data) {
        if (data === void 0) {
          return;
        }
        this.area.load(data.area);
        this.shadow.load(data.shadow);
      }
    };
    exports.Light = Light;
  }
});

// node_modules/tsparticles/Options/Classes/Interactivity/Modes/Bounce.js
var require_Bounce2 = __commonJS({
  "node_modules/tsparticles/Options/Classes/Interactivity/Modes/Bounce.js"(exports) {
    init_shims();
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.Bounce = void 0;
    var Bounce = class {
      constructor() {
        this.distance = 200;
      }
      load(data) {
        if (!data) {
          return;
        }
        if (data.distance !== void 0) {
          this.distance = data.distance;
        }
      }
    };
    exports.Bounce = Bounce;
  }
});

// node_modules/tsparticles/Options/Classes/Interactivity/Modes/Modes.js
var require_Modes2 = __commonJS({
  "node_modules/tsparticles/Options/Classes/Interactivity/Modes/Modes.js"(exports) {
    init_shims();
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.Modes = void 0;
    var Bubble_1 = require_Bubble();
    var Connect_1 = require_Connect();
    var Grab_1 = require_Grab();
    var Remove_1 = require_Remove();
    var Push_1 = require_Push();
    var Repulse_1 = require_Repulse2();
    var Slow_1 = require_Slow();
    var Trail_1 = require_Trail2();
    var Attract_1 = require_Attract2();
    var Light_1 = require_Light();
    var Bounce_1 = require_Bounce2();
    var Modes = class {
      constructor() {
        this.attract = new Attract_1.Attract();
        this.bounce = new Bounce_1.Bounce();
        this.bubble = new Bubble_1.Bubble();
        this.connect = new Connect_1.Connect();
        this.grab = new Grab_1.Grab();
        this.light = new Light_1.Light();
        this.push = new Push_1.Push();
        this.remove = new Remove_1.Remove();
        this.repulse = new Repulse_1.Repulse();
        this.slow = new Slow_1.Slow();
        this.trail = new Trail_1.Trail();
      }
      load(data) {
        if (data === void 0) {
          return;
        }
        this.attract.load(data.attract);
        this.bubble.load(data.bubble);
        this.connect.load(data.connect);
        this.grab.load(data.grab);
        this.light.load(data.light);
        this.push.load(data.push);
        this.remove.load(data.remove);
        this.repulse.load(data.repulse);
        this.slow.load(data.slow);
        this.trail.load(data.trail);
      }
    };
    exports.Modes = Modes;
  }
});

// node_modules/tsparticles/Options/Classes/Interactivity/Interactivity.js
var require_Interactivity = __commonJS({
  "node_modules/tsparticles/Options/Classes/Interactivity/Interactivity.js"(exports) {
    init_shims();
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.Interactivity = void 0;
    var Enums_1 = require_Enums();
    var Events_1 = require_Events();
    var Modes_1 = require_Modes2();
    var Interactivity = class {
      constructor() {
        this.detectsOn = Enums_1.InteractivityDetect.window;
        this.events = new Events_1.Events();
        this.modes = new Modes_1.Modes();
      }
      get detect_on() {
        return this.detectsOn;
      }
      set detect_on(value) {
        this.detectsOn = value;
      }
      load(data) {
        var _a, _b, _c;
        if (data === void 0) {
          return;
        }
        const detectsOn = (_a = data.detectsOn) !== null && _a !== void 0 ? _a : data.detect_on;
        if (detectsOn !== void 0) {
          this.detectsOn = detectsOn;
        }
        this.events.load(data.events);
        this.modes.load(data.modes);
        if (((_c = (_b = data.modes) === null || _b === void 0 ? void 0 : _b.slow) === null || _c === void 0 ? void 0 : _c.active) === true) {
          if (this.events.onHover.mode instanceof Array) {
            if (this.events.onHover.mode.indexOf(Enums_1.HoverMode.slow) < 0) {
              this.events.onHover.mode.push(Enums_1.HoverMode.slow);
            }
          } else if (this.events.onHover.mode !== Enums_1.HoverMode.slow) {
            this.events.onHover.mode = [this.events.onHover.mode, Enums_1.HoverMode.slow];
          }
        }
      }
    };
    exports.Interactivity = Interactivity;
  }
});

// node_modules/tsparticles/Options/Classes/BackgroundMask/BackgroundMaskCover.js
var require_BackgroundMaskCover = __commonJS({
  "node_modules/tsparticles/Options/Classes/BackgroundMask/BackgroundMaskCover.js"(exports) {
    init_shims();
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.BackgroundMaskCover = void 0;
    var OptionsColor_1 = require_OptionsColor();
    var BackgroundMaskCover = class {
      constructor() {
        this.color = new OptionsColor_1.OptionsColor();
        this.opacity = 1;
      }
      load(data) {
        if (data === void 0) {
          return;
        }
        if (data.color !== void 0) {
          this.color = OptionsColor_1.OptionsColor.create(this.color, data.color);
        }
        if (data.opacity !== void 0) {
          this.opacity = data.opacity;
        }
      }
    };
    exports.BackgroundMaskCover = BackgroundMaskCover;
  }
});

// node_modules/tsparticles/Options/Classes/BackgroundMask/BackgroundMask.js
var require_BackgroundMask = __commonJS({
  "node_modules/tsparticles/Options/Classes/BackgroundMask/BackgroundMask.js"(exports) {
    init_shims();
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.BackgroundMask = void 0;
    var BackgroundMaskCover_1 = require_BackgroundMaskCover();
    var BackgroundMask = class {
      constructor() {
        this.composite = "destination-out";
        this.cover = new BackgroundMaskCover_1.BackgroundMaskCover();
        this.enable = false;
      }
      load(data) {
        if (data === void 0) {
          return;
        }
        if (data.composite !== void 0) {
          this.composite = data.composite;
        }
        if (data.cover !== void 0) {
          const cover = data.cover;
          const color = typeof data.cover === "string" ? { color: data.cover } : data.cover;
          this.cover.load(cover.color !== void 0 ? cover : { color });
        }
        if (data.enable !== void 0) {
          this.enable = data.enable;
        }
      }
    };
    exports.BackgroundMask = BackgroundMask;
  }
});

// node_modules/tsparticles/Options/Classes/Background/Background.js
var require_Background = __commonJS({
  "node_modules/tsparticles/Options/Classes/Background/Background.js"(exports) {
    init_shims();
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.Background = void 0;
    var OptionsColor_1 = require_OptionsColor();
    var Background = class {
      constructor() {
        this.color = new OptionsColor_1.OptionsColor();
        this.color.value = "";
        this.image = "";
        this.position = "";
        this.repeat = "";
        this.size = "";
        this.opacity = 1;
      }
      load(data) {
        if (data === void 0) {
          return;
        }
        if (data.color !== void 0) {
          this.color = OptionsColor_1.OptionsColor.create(this.color, data.color);
        }
        if (data.image !== void 0) {
          this.image = data.image;
        }
        if (data.position !== void 0) {
          this.position = data.position;
        }
        if (data.repeat !== void 0) {
          this.repeat = data.repeat;
        }
        if (data.size !== void 0) {
          this.size = data.size;
        }
        if (data.opacity !== void 0) {
          this.opacity = data.opacity;
        }
      }
    };
    exports.Background = Background;
  }
});

// node_modules/tsparticles/Options/Classes/Theme/ThemeDefault.js
var require_ThemeDefault = __commonJS({
  "node_modules/tsparticles/Options/Classes/Theme/ThemeDefault.js"(exports) {
    init_shims();
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.ThemeDefault = void 0;
    var Enums_1 = require_Enums();
    var ThemeDefault = class {
      constructor() {
        this.auto = false;
        this.mode = Enums_1.ThemeMode.any;
        this.value = false;
      }
      load(data) {
        if (!data) {
          return;
        }
        if (data.auto !== void 0) {
          this.auto = data.auto;
        }
        if (data.mode !== void 0) {
          this.mode = data.mode;
        }
        if (data.value !== void 0) {
          this.value = data.value;
        }
      }
    };
    exports.ThemeDefault = ThemeDefault;
  }
});

// node_modules/tsparticles/Options/Classes/Theme/Theme.js
var require_Theme = __commonJS({
  "node_modules/tsparticles/Options/Classes/Theme/Theme.js"(exports) {
    init_shims();
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.Theme = void 0;
    var Utils_1 = require_Utils2();
    var ThemeDefault_1 = require_ThemeDefault();
    var Theme = class {
      constructor() {
        this.name = "";
        this.default = new ThemeDefault_1.ThemeDefault();
      }
      load(data) {
        if (data === void 0) {
          return;
        }
        if (data.name !== void 0) {
          this.name = data.name;
        }
        this.default.load(data.default);
        if (data.options !== void 0) {
          this.options = (0, Utils_1.deepExtend)({}, data.options);
        }
      }
    };
    exports.Theme = Theme;
  }
});

// node_modules/tsparticles/Options/Classes/FullScreen/FullScreen.js
var require_FullScreen = __commonJS({
  "node_modules/tsparticles/Options/Classes/FullScreen/FullScreen.js"(exports) {
    init_shims();
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.FullScreen = void 0;
    var FullScreen = class {
      constructor() {
        this.enable = true;
        this.zIndex = 0;
      }
      load(data) {
        if (!data) {
          return;
        }
        if (data.enable !== void 0) {
          this.enable = data.enable;
        }
        if (data.zIndex !== void 0) {
          this.zIndex = data.zIndex;
        }
      }
    };
    exports.FullScreen = FullScreen;
  }
});

// node_modules/tsparticles/Options/Classes/Motion/MotionReduce.js
var require_MotionReduce = __commonJS({
  "node_modules/tsparticles/Options/Classes/Motion/MotionReduce.js"(exports) {
    init_shims();
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.MotionReduce = void 0;
    var MotionReduce = class {
      constructor() {
        this.factor = 4;
        this.value = true;
      }
      load(data) {
        if (!data) {
          return;
        }
        if (data.factor !== void 0) {
          this.factor = data.factor;
        }
        if (data.value !== void 0) {
          this.value = data.value;
        }
      }
    };
    exports.MotionReduce = MotionReduce;
  }
});

// node_modules/tsparticles/Options/Classes/Motion/Motion.js
var require_Motion = __commonJS({
  "node_modules/tsparticles/Options/Classes/Motion/Motion.js"(exports) {
    init_shims();
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.Motion = void 0;
    var MotionReduce_1 = require_MotionReduce();
    var Motion = class {
      constructor() {
        this.disable = false;
        this.reduce = new MotionReduce_1.MotionReduce();
      }
      load(data) {
        if (!data) {
          return;
        }
        if (data.disable !== void 0) {
          this.disable = data.disable;
        }
        this.reduce.load(data.reduce);
      }
    };
    exports.Motion = Motion;
  }
});

// node_modules/tsparticles/Options/Classes/ManualParticle.js
var require_ManualParticle = __commonJS({
  "node_modules/tsparticles/Options/Classes/ManualParticle.js"(exports) {
    init_shims();
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.ManualParticle = void 0;
    var Utils_1 = require_Utils2();
    var ManualParticle = class {
      load(data) {
        var _a, _b;
        if (!data) {
          return;
        }
        if (data.position !== void 0) {
          this.position = {
            x: (_a = data.position.x) !== null && _a !== void 0 ? _a : 50,
            y: (_b = data.position.y) !== null && _b !== void 0 ? _b : 50
          };
        }
        if (data.options !== void 0) {
          this.options = (0, Utils_1.deepExtend)({}, data.options);
        }
      }
    };
    exports.ManualParticle = ManualParticle;
  }
});

// node_modules/tsparticles/Options/Classes/Responsive.js
var require_Responsive = __commonJS({
  "node_modules/tsparticles/Options/Classes/Responsive.js"(exports) {
    init_shims();
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.Responsive = void 0;
    var Utils_1 = require_Utils2();
    var Enums_1 = require_Enums();
    var Responsive = class {
      constructor() {
        this.maxWidth = Infinity;
        this.options = {};
        this.mode = Enums_1.ResponsiveMode.canvas;
      }
      load(data) {
        if (!data) {
          return;
        }
        if (data.maxWidth !== void 0) {
          this.maxWidth = data.maxWidth;
        }
        if (data.mode !== void 0) {
          if (data.mode === Enums_1.ResponsiveMode.screen) {
            this.mode = Enums_1.ResponsiveMode.screen;
          } else {
            this.mode = Enums_1.ResponsiveMode.canvas;
          }
        }
        if (data.options !== void 0) {
          this.options = (0, Utils_1.deepExtend)({}, data.options);
        }
      }
    };
    exports.Responsive = Responsive;
  }
});

// node_modules/tsparticles/Options/Classes/Options.js
var require_Options = __commonJS({
  "node_modules/tsparticles/Options/Classes/Options.js"(exports) {
    init_shims();
    "use strict";
    var __classPrivateFieldGet = exports && exports.__classPrivateFieldGet || function(receiver, state, kind, f) {
      if (kind === "a" && !f)
        throw new TypeError("Private accessor was defined without a getter");
      if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver))
        throw new TypeError("Cannot read private member from an object whose class did not declare it");
      return kind === "m" ? f : kind === "a" ? f.call(receiver) : f ? f.value : state.get(receiver);
    };
    var _Options_instances;
    var _Options_findDefaultTheme;
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.Options = void 0;
    var Interactivity_1 = require_Interactivity();
    var ParticlesOptions_1 = require_ParticlesOptions();
    var BackgroundMask_1 = require_BackgroundMask();
    var Background_1 = require_Background();
    var Utils_1 = require_Utils2();
    var Theme_1 = require_Theme();
    var Enums_1 = require_Enums();
    var FullScreen_1 = require_FullScreen();
    var Motion_1 = require_Motion();
    var ManualParticle_1 = require_ManualParticle();
    var Responsive_1 = require_Responsive();
    var Options = class {
      constructor() {
        _Options_instances.add(this);
        this.autoPlay = true;
        this.background = new Background_1.Background();
        this.backgroundMask = new BackgroundMask_1.BackgroundMask();
        this.fullScreen = new FullScreen_1.FullScreen();
        this.detectRetina = true;
        this.duration = 0;
        this.fpsLimit = 60;
        this.interactivity = new Interactivity_1.Interactivity();
        this.manualParticles = [];
        this.motion = new Motion_1.Motion();
        this.particles = new ParticlesOptions_1.ParticlesOptions();
        this.pauseOnBlur = true;
        this.pauseOnOutsideViewport = true;
        this.responsive = [];
        this.themes = [];
        this.zLayers = 100;
      }
      get fps_limit() {
        return this.fpsLimit;
      }
      set fps_limit(value) {
        this.fpsLimit = value;
      }
      get retina_detect() {
        return this.detectRetina;
      }
      set retina_detect(value) {
        this.detectRetina = value;
      }
      get backgroundMode() {
        return this.fullScreen;
      }
      set backgroundMode(value) {
        this.fullScreen.load(value);
      }
      load(data) {
        var _a, _b, _c, _d, _e;
        if (data === void 0) {
          return;
        }
        if (data.preset !== void 0) {
          if (data.preset instanceof Array) {
            for (const preset of data.preset) {
              this.importPreset(preset);
            }
          } else {
            this.importPreset(data.preset);
          }
        }
        if (data.autoPlay !== void 0) {
          this.autoPlay = data.autoPlay;
        }
        const detectRetina = (_a = data.detectRetina) !== null && _a !== void 0 ? _a : data.retina_detect;
        if (detectRetina !== void 0) {
          this.detectRetina = detectRetina;
        }
        if (data.duration !== void 0) {
          this.duration = data.duration;
        }
        const fpsLimit = (_b = data.fpsLimit) !== null && _b !== void 0 ? _b : data.fps_limit;
        if (fpsLimit !== void 0) {
          this.fpsLimit = fpsLimit;
        }
        if (data.pauseOnBlur !== void 0) {
          this.pauseOnBlur = data.pauseOnBlur;
        }
        if (data.pauseOnOutsideViewport !== void 0) {
          this.pauseOnOutsideViewport = data.pauseOnOutsideViewport;
        }
        if (data.zLayers !== void 0) {
          this.zLayers = data.zLayers;
        }
        this.background.load(data.background);
        const fullScreen = (_c = data.fullScreen) !== null && _c !== void 0 ? _c : data.backgroundMode;
        if (typeof fullScreen === "boolean") {
          this.fullScreen.enable = fullScreen;
        } else {
          this.fullScreen.load(fullScreen);
        }
        this.backgroundMask.load(data.backgroundMask);
        this.interactivity.load(data.interactivity);
        if (data.manualParticles !== void 0) {
          this.manualParticles = data.manualParticles.map((t) => {
            const tmp = new ManualParticle_1.ManualParticle();
            tmp.load(t);
            return tmp;
          });
        }
        this.motion.load(data.motion);
        this.particles.load(data.particles);
        Utils_1.Plugins.loadOptions(this, data);
        if (data.responsive !== void 0) {
          for (const responsive of data.responsive) {
            const optResponsive = new Responsive_1.Responsive();
            optResponsive.load(responsive);
            this.responsive.push(optResponsive);
          }
        }
        this.responsive.sort((a, b) => a.maxWidth - b.maxWidth);
        if (data.themes !== void 0) {
          for (const theme of data.themes) {
            const optTheme = new Theme_1.Theme();
            optTheme.load(theme);
            this.themes.push(optTheme);
          }
        }
        this.defaultDarkTheme = (_d = __classPrivateFieldGet(this, _Options_instances, "m", _Options_findDefaultTheme).call(this, Enums_1.ThemeMode.dark)) === null || _d === void 0 ? void 0 : _d.name;
        this.defaultLightTheme = (_e = __classPrivateFieldGet(this, _Options_instances, "m", _Options_findDefaultTheme).call(this, Enums_1.ThemeMode.light)) === null || _e === void 0 ? void 0 : _e.name;
      }
      setTheme(name) {
        if (name) {
          const chosenTheme = this.themes.find((theme) => theme.name === name);
          if (chosenTheme) {
            this.load(chosenTheme.options);
          }
        } else {
          const mediaMatch = typeof matchMedia !== "undefined" && matchMedia("(prefers-color-scheme: dark)"), clientDarkMode = mediaMatch && mediaMatch.matches, defaultTheme = __classPrivateFieldGet(this, _Options_instances, "m", _Options_findDefaultTheme).call(this, clientDarkMode ? Enums_1.ThemeMode.dark : Enums_1.ThemeMode.light);
          if (defaultTheme) {
            this.load(defaultTheme.options);
          }
        }
      }
      setResponsive(width, pxRatio, defaultOptions) {
        this.load(defaultOptions);
        const responsiveOptions = this.responsive.find((t) => t.mode === Enums_1.ResponsiveMode.screen && screen ? t.maxWidth * pxRatio > screen.availWidth : t.maxWidth * pxRatio > width);
        this.load(responsiveOptions === null || responsiveOptions === void 0 ? void 0 : responsiveOptions.options);
        return responsiveOptions === null || responsiveOptions === void 0 ? void 0 : responsiveOptions.maxWidth;
      }
      importPreset(preset) {
        this.load(Utils_1.Plugins.getPreset(preset));
      }
    };
    exports.Options = Options;
    _Options_instances = new WeakSet(), _Options_findDefaultTheme = function _Options_findDefaultTheme2(mode) {
      var _a;
      return (_a = this.themes.find((theme) => theme.default.value && theme.default.mode === mode)) !== null && _a !== void 0 ? _a : this.themes.find((theme) => theme.default.value && theme.default.mode === Enums_1.ThemeMode.any);
    };
  }
});

// node_modules/tsparticles/Core/Container.js
var require_Container = __commonJS({
  "node_modules/tsparticles/Core/Container.js"(exports) {
    init_shims();
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.Container = void 0;
    var Canvas_1 = require_Canvas();
    var Particles_1 = require_Particles();
    var Retina_1 = require_Retina();
    var FrameManager_1 = require_FrameManager();
    var Options_1 = require_Options();
    var Utils_1 = require_Utils2();
    var Vector_1 = require_Vector();
    var Container = class {
      constructor(id, sourceOptions, ...presets) {
        this.id = id;
        this.fpsLimit = 60;
        this.duration = 0;
        this.lifeTime = 0;
        this.firstStart = true;
        this.started = false;
        this.destroyed = false;
        this.paused = true;
        this.lastFrameTime = 0;
        this.zLayers = 100;
        this.pageHidden = false;
        this._sourceOptions = sourceOptions;
        this._initialSourceOptions = sourceOptions;
        this.retina = new Retina_1.Retina(this);
        this.canvas = new Canvas_1.Canvas(this);
        this.particles = new Particles_1.Particles(this);
        this.drawer = new FrameManager_1.FrameManager(this);
        this.presets = presets;
        this.pathGenerator = {
          generate: () => {
            const v = Vector_1.Vector.create(0, 0);
            v.length = Math.random();
            v.angle = Math.random() * Math.PI * 2;
            return v;
          },
          init: () => {
          },
          update: () => {
          }
        };
        this.interactivity = {
          mouse: {
            clicking: false,
            inside: false
          }
        };
        this.bubble = {};
        this.repulse = { particles: [] };
        this.attract = { particles: [] };
        this.plugins = new Map();
        this.drawers = new Map();
        this.density = 1;
        this._options = new Options_1.Options();
        this.actualOptions = new Options_1.Options();
        this.eventListeners = new Utils_1.EventListeners(this);
        if (typeof IntersectionObserver !== "undefined" && IntersectionObserver) {
          this.intersectionObserver = new IntersectionObserver((entries) => this.intersectionManager(entries));
        }
      }
      get options() {
        return this._options;
      }
      get sourceOptions() {
        return this._sourceOptions;
      }
      play(force) {
        const needsUpdate = this.paused || force;
        if (this.firstStart && !this.actualOptions.autoPlay) {
          this.firstStart = false;
          return;
        }
        if (this.paused) {
          this.paused = false;
        }
        if (needsUpdate) {
          for (const [, plugin] of this.plugins) {
            if (plugin.play) {
              plugin.play();
            }
          }
        }
        this.draw(needsUpdate || false);
      }
      pause() {
        if (this.drawAnimationFrame !== void 0) {
          (0, Utils_1.cancelAnimation)()(this.drawAnimationFrame);
          delete this.drawAnimationFrame;
        }
        if (this.paused) {
          return;
        }
        for (const [, plugin] of this.plugins) {
          if (plugin.pause) {
            plugin.pause();
          }
        }
        if (!this.pageHidden) {
          this.paused = true;
        }
      }
      draw(force) {
        let refreshTime = force;
        this.drawAnimationFrame = (0, Utils_1.animate)()((timestamp) => {
          if (refreshTime) {
            this.lastFrameTime = void 0;
            refreshTime = false;
          }
          this.drawer.nextFrame(timestamp);
        });
      }
      getAnimationStatus() {
        return !this.paused && !this.pageHidden;
      }
      setNoise(noiseOrGenerator, init2, update) {
        this.setPath(noiseOrGenerator, init2, update);
      }
      setPath(pathOrGenerator, init2, update) {
        if (!pathOrGenerator) {
          return;
        }
        if (typeof pathOrGenerator === "function") {
          this.pathGenerator.generate = pathOrGenerator;
          if (init2) {
            this.pathGenerator.init = init2;
          }
          if (update) {
            this.pathGenerator.update = update;
          }
        } else {
          if (pathOrGenerator.generate) {
            this.pathGenerator.generate = pathOrGenerator.generate;
          }
          if (pathOrGenerator.init) {
            this.pathGenerator.init = pathOrGenerator.init;
          }
          if (pathOrGenerator.update) {
            this.pathGenerator.update = pathOrGenerator.update;
          }
        }
      }
      destroy() {
        this.stop();
        this.canvas.destroy();
        for (const [, drawer] of this.drawers) {
          if (drawer.destroy) {
            drawer.destroy(this);
          }
        }
        for (const key of this.drawers.keys()) {
          this.drawers.delete(key);
        }
        this.destroyed = true;
      }
      exportImg(callback) {
        this.exportImage(callback);
      }
      exportImage(callback, type, quality) {
        var _a;
        return (_a = this.canvas.element) === null || _a === void 0 ? void 0 : _a.toBlob(callback, type !== null && type !== void 0 ? type : "image/png", quality);
      }
      exportConfiguration() {
        return JSON.stringify(this.actualOptions, void 0, 2);
      }
      refresh() {
        this.stop();
        return this.start();
      }
      reset() {
        this._options = new Options_1.Options();
        return this.refresh();
      }
      stop() {
        if (!this.started) {
          return;
        }
        this.firstStart = true;
        this.started = false;
        this.eventListeners.removeListeners();
        this.pause();
        this.particles.clear();
        this.canvas.clear();
        if (this.interactivity.element instanceof HTMLElement && this.intersectionObserver) {
          this.intersectionObserver.observe(this.interactivity.element);
        }
        for (const [, plugin] of this.plugins) {
          if (plugin.stop) {
            plugin.stop();
          }
        }
        for (const key of this.plugins.keys()) {
          this.plugins.delete(key);
        }
        this.particles.linksColors = new Map();
        delete this.particles.grabLineColor;
        delete this.particles.linksColor;
        this._sourceOptions = this._options;
      }
      async loadTheme(name) {
        this.currentTheme = name;
        await this.refresh();
      }
      async start() {
        if (this.started) {
          return;
        }
        await this.init();
        this.started = true;
        this.eventListeners.addListeners();
        if (this.interactivity.element instanceof HTMLElement && this.intersectionObserver) {
          this.intersectionObserver.observe(this.interactivity.element);
        }
        for (const [, plugin] of this.plugins) {
          if (plugin.startAsync !== void 0) {
            await plugin.startAsync();
          } else if (plugin.start !== void 0) {
            plugin.start();
          }
        }
        this.play();
      }
      addClickHandler(callback) {
        const el = this.interactivity.element;
        if (!el) {
          return;
        }
        const clickOrTouchHandler = (e, pos, radius) => {
          if (this.destroyed) {
            return;
          }
          const pxRatio = this.retina.pixelRatio, posRetina = {
            x: pos.x * pxRatio,
            y: pos.y * pxRatio
          }, particles = this.particles.quadTree.queryCircle(posRetina, radius * pxRatio);
          callback(e, particles);
        };
        const clickHandler = (e) => {
          if (this.destroyed) {
            return;
          }
          const mouseEvent = e;
          const pos = {
            x: mouseEvent.offsetX || mouseEvent.clientX,
            y: mouseEvent.offsetY || mouseEvent.clientY
          };
          clickOrTouchHandler(e, pos, 1);
        };
        const touchStartHandler = () => {
          if (this.destroyed) {
            return;
          }
          touched = true;
          touchMoved = false;
        };
        const touchMoveHandler = () => {
          if (this.destroyed) {
            return;
          }
          touchMoved = true;
        };
        const touchEndHandler = (e) => {
          var _a, _b, _c;
          if (this.destroyed) {
            return;
          }
          if (touched && !touchMoved) {
            const touchEvent = e;
            let lastTouch = touchEvent.touches[touchEvent.touches.length - 1];
            if (!lastTouch) {
              lastTouch = touchEvent.changedTouches[touchEvent.changedTouches.length - 1];
              if (!lastTouch) {
                return;
              }
            }
            const canvasRect = (_a = this.canvas.element) === null || _a === void 0 ? void 0 : _a.getBoundingClientRect();
            const pos = {
              x: lastTouch.clientX - ((_b = canvasRect === null || canvasRect === void 0 ? void 0 : canvasRect.left) !== null && _b !== void 0 ? _b : 0),
              y: lastTouch.clientY - ((_c = canvasRect === null || canvasRect === void 0 ? void 0 : canvasRect.top) !== null && _c !== void 0 ? _c : 0)
            };
            clickOrTouchHandler(e, pos, Math.max(lastTouch.radiusX, lastTouch.radiusY));
          }
          touched = false;
          touchMoved = false;
        };
        const touchCancelHandler = () => {
          if (this.destroyed) {
            return;
          }
          touched = false;
          touchMoved = false;
        };
        let touched = false;
        let touchMoved = false;
        el.addEventListener("click", clickHandler);
        el.addEventListener("touchstart", touchStartHandler);
        el.addEventListener("touchmove", touchMoveHandler);
        el.addEventListener("touchend", touchEndHandler);
        el.addEventListener("touchcancel", touchCancelHandler);
      }
      updateActualOptions() {
        this.actualOptions.responsive = [];
        const newMaxWidth = this.actualOptions.setResponsive(this.canvas.size.width, this.retina.pixelRatio, this._options);
        this.actualOptions.setTheme(this.currentTheme);
        if (this.responsiveMaxWidth != newMaxWidth) {
          this.responsiveMaxWidth = newMaxWidth;
          return true;
        }
        return false;
      }
      async init() {
        this._options = new Options_1.Options();
        for (const preset of this.presets) {
          this._options.load(Utils_1.Plugins.getPreset(preset));
        }
        const shapes = Utils_1.Plugins.getSupportedShapes();
        for (const type of shapes) {
          const drawer = Utils_1.Plugins.getShapeDrawer(type);
          if (drawer) {
            this.drawers.set(type, drawer);
          }
        }
        this._options.load(this._initialSourceOptions);
        this._options.load(this._sourceOptions);
        this.actualOptions = new Options_1.Options();
        this.actualOptions.load(this._options);
        this.retina.init();
        this.canvas.init();
        this.updateActualOptions();
        this.canvas.initBackground();
        this.canvas.resize();
        this.zLayers = this.actualOptions.zLayers;
        this.duration = (0, Utils_1.getRangeValue)(this.actualOptions.duration);
        this.lifeTime = 0;
        this.fpsLimit = this.actualOptions.fpsLimit > 0 ? this.actualOptions.fpsLimit : 60;
        const availablePlugins = Utils_1.Plugins.getAvailablePlugins(this);
        for (const [id, plugin] of availablePlugins) {
          this.plugins.set(id, plugin);
        }
        for (const [, drawer] of this.drawers) {
          if (drawer.init) {
            await drawer.init(this);
          }
        }
        for (const [, plugin] of this.plugins) {
          if (plugin.init) {
            plugin.init(this.actualOptions);
          } else if (plugin.initAsync !== void 0) {
            await plugin.initAsync(this.actualOptions);
          }
        }
        const pathOptions = this.actualOptions.particles.move.path;
        if (pathOptions.generator) {
          const customGenerator = Utils_1.Plugins.getPathGenerator(pathOptions.generator);
          if (customGenerator) {
            if (customGenerator.init) {
              this.pathGenerator.init = customGenerator.init;
            }
            if (customGenerator.generate) {
              this.pathGenerator.generate = customGenerator.generate;
            }
            if (customGenerator.update) {
              this.pathGenerator.update = customGenerator.update;
            }
          }
        }
        this.particles.init();
        this.particles.setDensity();
        for (const [, plugin] of this.plugins) {
          if (plugin.particlesSetup !== void 0) {
            plugin.particlesSetup();
          }
        }
      }
      intersectionManager(entries) {
        if (!this.actualOptions.pauseOnOutsideViewport) {
          return;
        }
        for (const entry of entries) {
          if (entry.target !== this.interactivity.element) {
            continue;
          }
          if (entry.isIntersecting) {
            this.play();
          } else {
            this.pause();
          }
        }
      }
    };
    exports.Container = Container;
  }
});

// node_modules/tsparticles/Core/Loader.js
var require_Loader = __commonJS({
  "node_modules/tsparticles/Core/Loader.js"(exports) {
    init_shims();
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.Loader = void 0;
    var Container_1 = require_Container();
    var Utils_1 = require_Utils2();
    var tsParticlesDom = [];
    function fetchError(statusCode) {
      console.error(`Error tsParticles - fetch status: ${statusCode}`);
      console.error("Error tsParticles - File config not found");
    }
    var Loader = class {
      static dom() {
        return tsParticlesDom;
      }
      static domItem(index) {
        const dom = Loader.dom();
        const item = dom[index];
        if (item && !item.destroyed) {
          return item;
        }
        dom.splice(index, 1);
      }
      static async loadOptions(params) {
        var _a, _b, _c;
        const tagId = (_a = params.tagId) !== null && _a !== void 0 ? _a : `tsparticles${Math.floor(Math.random() * 1e4)}`;
        const { options: options2, index } = params;
        let domContainer = (_b = params.element) !== null && _b !== void 0 ? _b : document.getElementById(tagId);
        if (!domContainer) {
          domContainer = document.createElement("div");
          domContainer.id = tagId;
          (_c = document.querySelector("body")) === null || _c === void 0 ? void 0 : _c.append(domContainer);
        }
        const currentOptions = options2 instanceof Array ? (0, Utils_1.itemFromArray)(options2, index) : options2;
        const dom = Loader.dom();
        const oldIndex = dom.findIndex((v) => v.id === tagId);
        if (oldIndex >= 0) {
          const old = Loader.domItem(oldIndex);
          if (old && !old.destroyed) {
            old.destroy();
            dom.splice(oldIndex, 1);
          }
        }
        let canvasEl;
        let generatedCanvas;
        if (domContainer.tagName.toLowerCase() === "canvas") {
          canvasEl = domContainer;
          generatedCanvas = false;
        } else {
          const existingCanvases = domContainer.getElementsByTagName("canvas");
          if (existingCanvases.length) {
            canvasEl = existingCanvases[0];
            if (!canvasEl.className) {
              canvasEl.className = Utils_1.Constants.canvasClass;
            }
            generatedCanvas = false;
          } else {
            generatedCanvas = true;
            canvasEl = document.createElement("canvas");
            canvasEl.className = Utils_1.Constants.canvasClass;
            canvasEl.style.width = "100%";
            canvasEl.style.height = "100%";
            domContainer.appendChild(canvasEl);
          }
        }
        const newItem = new Container_1.Container(tagId, currentOptions);
        if (oldIndex >= 0) {
          dom.splice(oldIndex, 0, newItem);
        } else {
          dom.push(newItem);
        }
        newItem.canvas.loadCanvas(canvasEl, generatedCanvas);
        await newItem.start();
        return newItem;
      }
      static async loadRemoteOptions(params) {
        const { url: jsonUrl, index } = params;
        const url = jsonUrl instanceof Array ? (0, Utils_1.itemFromArray)(jsonUrl, index) : jsonUrl;
        if (!url) {
          return;
        }
        const response = await fetch(url);
        if (!response.ok) {
          fetchError(response.status);
          return;
        }
        const data = await response.json();
        return await Loader.loadOptions({
          tagId: params.tagId,
          element: params.element,
          index,
          options: data
        });
      }
      static load(tagId, options2, index) {
        const params = { index };
        if (typeof tagId === "string") {
          params.tagId = tagId;
        } else {
          params.options = tagId;
        }
        if (typeof options2 === "number") {
          params.index = options2 !== null && options2 !== void 0 ? options2 : params.index;
        } else {
          params.options = options2 !== null && options2 !== void 0 ? options2 : params.options;
        }
        return this.loadOptions(params);
      }
      static async set(id, domContainer, options2, index) {
        const params = { index };
        if (typeof id === "string") {
          params.tagId = id;
        } else {
          params.element = id;
        }
        if (domContainer instanceof HTMLElement) {
          params.element = domContainer;
        } else {
          params.options = domContainer;
        }
        if (typeof options2 === "number") {
          params.index = options2;
        } else {
          params.options = options2 !== null && options2 !== void 0 ? options2 : params.options;
        }
        return this.loadOptions(params);
      }
      static async loadJSON(tagId, jsonUrl, index) {
        let url, id;
        if (typeof jsonUrl === "number" || jsonUrl === void 0) {
          url = tagId;
        } else {
          id = tagId;
          url = jsonUrl;
        }
        return await Loader.loadRemoteOptions({ tagId: id, url, index });
      }
      static async setJSON(id, domContainer, jsonUrl, index) {
        let url, newId, newIndex, element;
        if (id instanceof HTMLElement) {
          element = id;
          url = domContainer;
          newIndex = jsonUrl;
        } else {
          newId = id;
          element = domContainer;
          url = jsonUrl;
          newIndex = index;
        }
        return await Loader.loadRemoteOptions({ tagId: newId, url, index: newIndex, element });
      }
      static setOnClickHandler(callback) {
        const dom = Loader.dom();
        if (dom.length === 0) {
          throw new Error("Can only set click handlers after calling tsParticles.load() or tsParticles.loadJSON()");
        }
        for (const domItem of dom) {
          domItem.addClickHandler(callback);
        }
      }
    };
    exports.Loader = Loader;
  }
});

// node_modules/tsparticles/main.js
var require_main = __commonJS({
  "node_modules/tsparticles/main.js"(exports) {
    init_shims();
    "use strict";
    var __classPrivateFieldSet = exports && exports.__classPrivateFieldSet || function(receiver, state, value, kind, f) {
      if (kind === "m")
        throw new TypeError("Private method is not writable");
      if (kind === "a" && !f)
        throw new TypeError("Private accessor was defined without a setter");
      if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver))
        throw new TypeError("Cannot write private member to an object whose class did not declare it");
      return kind === "a" ? f.call(receiver, value) : f ? f.value = value : state.set(receiver, value), value;
    };
    var __classPrivateFieldGet = exports && exports.__classPrivateFieldGet || function(receiver, state, kind, f) {
      if (kind === "a" && !f)
        throw new TypeError("Private accessor was defined without a getter");
      if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver))
        throw new TypeError("Cannot read private member from an object whose class did not declare it");
      return kind === "m" ? f : kind === "a" ? f.call(receiver) : f ? f.value : state.get(receiver);
    };
    var _Main_initialized;
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.Main = void 0;
    var Utils_1 = require_Utils2();
    var Loader_1 = require_Loader();
    var Main = class {
      constructor() {
        _Main_initialized.set(this, void 0);
        __classPrivateFieldSet(this, _Main_initialized, false, "f");
      }
      init() {
        if (!__classPrivateFieldGet(this, _Main_initialized, "f")) {
          __classPrivateFieldSet(this, _Main_initialized, true, "f");
        }
      }
      async loadFromArray(tagId, options2, index) {
        return Loader_1.Loader.load(tagId, options2, index);
      }
      async load(tagId, options2) {
        return Loader_1.Loader.load(tagId, options2);
      }
      async set(id, element, options2) {
        return Loader_1.Loader.set(id, element, options2);
      }
      async loadJSON(tagId, pathConfigJson, index) {
        return Loader_1.Loader.loadJSON(tagId, pathConfigJson, index);
      }
      async setJSON(id, element, pathConfigJson, index) {
        return Loader_1.Loader.setJSON(id, element, pathConfigJson, index);
      }
      setOnClickHandler(callback) {
        Loader_1.Loader.setOnClickHandler(callback);
      }
      dom() {
        return Loader_1.Loader.dom();
      }
      domItem(index) {
        return Loader_1.Loader.domItem(index);
      }
      async refresh() {
        for (const instance of this.dom()) {
          await instance.refresh();
        }
      }
      async addShape(shape, drawer, init2, afterEffect, destroy) {
        let customDrawer;
        if (typeof drawer === "function") {
          customDrawer = {
            afterEffect,
            destroy,
            draw: drawer,
            init: init2
          };
        } else {
          customDrawer = drawer;
        }
        Utils_1.Plugins.addShapeDrawer(shape, customDrawer);
        await this.refresh();
      }
      async addPreset(preset, options2, override = false) {
        Utils_1.Plugins.addPreset(preset, options2, override);
        await this.refresh();
      }
      async addPlugin(plugin) {
        Utils_1.Plugins.addPlugin(plugin);
        await this.refresh();
      }
      async addPathGenerator(name, generator) {
        Utils_1.Plugins.addPathGenerator(name, generator);
        await this.refresh();
      }
      async addInteractor(name, interactorInitializer) {
        Utils_1.Plugins.addInteractor(name, interactorInitializer);
        await this.refresh();
      }
      async addParticleUpdater(name, updaterInitializer) {
        Utils_1.Plugins.addParticleUpdater(name, updaterInitializer);
        await this.refresh();
      }
    };
    exports.Main = Main;
    _Main_initialized = new WeakMap();
  }
});

// node_modules/tsparticles/Shapes/Circle/CircleDrawer.js
var require_CircleDrawer = __commonJS({
  "node_modules/tsparticles/Shapes/Circle/CircleDrawer.js"(exports) {
    init_shims();
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.CircleDrawer = void 0;
    var CircleDrawer = class {
      getSidesCount() {
        return 12;
      }
      draw(context, particle, radius) {
        context.arc(0, 0, radius, 0, Math.PI * 2, false);
      }
    };
    exports.CircleDrawer = CircleDrawer;
  }
});

// node_modules/tsparticles/Shapes/Circle/index.js
var require_Circle2 = __commonJS({
  "node_modules/tsparticles/Shapes/Circle/index.js"(exports) {
    init_shims();
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.loadCircleShape = void 0;
    var CircleDrawer_1 = require_CircleDrawer();
    async function loadCircleShape(tsParticles) {
      await tsParticles.addShape("circle", new CircleDrawer_1.CircleDrawer());
    }
    exports.loadCircleShape = loadCircleShape;
  }
});

// node_modules/tsparticles/Updaters/Life/LifeUpdater.js
var require_LifeUpdater = __commonJS({
  "node_modules/tsparticles/Updaters/Life/LifeUpdater.js"(exports) {
    init_shims();
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.LifeUpdater = void 0;
    var Utils_1 = require_Utils2();
    var LifeUpdater = class {
      constructor(container) {
        this.container = container;
      }
      init() {
      }
      isEnabled(particle) {
        return !particle.destroyed;
      }
      update(particle, delta) {
        if (!this.isEnabled(particle)) {
          return;
        }
        const life = particle.life;
        let justSpawned = false;
        if (particle.spawning) {
          life.delayTime += delta.value;
          if (life.delayTime >= particle.life.delay) {
            justSpawned = true;
            particle.spawning = false;
            life.delayTime = 0;
            life.time = 0;
          } else {
            return;
          }
        }
        if (life.duration === -1) {
          return;
        }
        if (particle.spawning) {
          return;
        }
        if (justSpawned) {
          life.time = 0;
        } else {
          life.time += delta.value;
        }
        if (life.time < life.duration) {
          return;
        }
        life.time = 0;
        if (particle.life.count > 0) {
          particle.life.count--;
        }
        if (particle.life.count === 0) {
          particle.destroy();
          return;
        }
        const canvasSize = this.container.canvas.size, widthRange = (0, Utils_1.setRangeValue)(0, canvasSize.width), heightRange = (0, Utils_1.setRangeValue)(0, canvasSize.width);
        particle.position.x = (0, Utils_1.randomInRange)(widthRange);
        particle.position.y = (0, Utils_1.randomInRange)(heightRange);
        particle.spawning = true;
        life.delayTime = 0;
        life.time = 0;
        particle.reset();
        const lifeOptions = particle.options.life;
        life.delay = (0, Utils_1.getRangeValue)(lifeOptions.delay.value) * 1e3;
        life.duration = (0, Utils_1.getRangeValue)(lifeOptions.duration.value) * 1e3;
      }
    };
    exports.LifeUpdater = LifeUpdater;
  }
});

// node_modules/tsparticles/Updaters/Life/index.js
var require_Life2 = __commonJS({
  "node_modules/tsparticles/Updaters/Life/index.js"(exports) {
    init_shims();
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.loadLifeUpdater = void 0;
    var LifeUpdater_1 = require_LifeUpdater();
    async function loadLifeUpdater(tsParticles) {
      await tsParticles.addParticleUpdater("life", (container) => new LifeUpdater_1.LifeUpdater(container));
    }
    exports.loadLifeUpdater = loadLifeUpdater;
  }
});

// node_modules/tsparticles/Core/ExternalInteractorBase.js
var require_ExternalInteractorBase = __commonJS({
  "node_modules/tsparticles/Core/ExternalInteractorBase.js"(exports) {
    init_shims();
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.ExternalInteractorBase = void 0;
    var Enums_1 = require_Enums();
    var ExternalInteractorBase = class {
      constructor(container) {
        this.container = container;
        this.type = Enums_1.InteractorType.External;
      }
    };
    exports.ExternalInteractorBase = ExternalInteractorBase;
  }
});

// node_modules/tsparticles/Interactions/External/Connect/Connector.js
var require_Connector = __commonJS({
  "node_modules/tsparticles/Interactions/External/Connect/Connector.js"(exports) {
    init_shims();
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.Connector = void 0;
    var Utils_1 = require_Utils2();
    var Enums_1 = require_Enums();
    var ExternalInteractorBase_1 = require_ExternalInteractorBase();
    var Connector = class extends ExternalInteractorBase_1.ExternalInteractorBase {
      constructor(container) {
        super(container);
      }
      isEnabled() {
        const container = this.container, mouse = container.interactivity.mouse, events = container.actualOptions.interactivity.events;
        if (!(events.onHover.enable && mouse.position)) {
          return false;
        }
        return (0, Utils_1.isInArray)(Enums_1.HoverMode.connect, events.onHover.mode);
      }
      reset() {
      }
      interact() {
        const container = this.container, options2 = container.actualOptions;
        if (options2.interactivity.events.onHover.enable && container.interactivity.status === "mousemove") {
          const mousePos = container.interactivity.mouse.position;
          if (!mousePos) {
            return;
          }
          const distance = Math.abs(container.retina.connectModeRadius), query = container.particles.quadTree.queryCircle(mousePos, distance);
          let i = 0;
          for (const p1 of query) {
            const pos1 = p1.getPosition();
            for (const p2 of query.slice(i + 1)) {
              const pos2 = p2.getPosition(), distMax = Math.abs(container.retina.connectModeDistance), xDiff = Math.abs(pos1.x - pos2.x), yDiff = Math.abs(pos1.y - pos2.y);
              if (xDiff < distMax && yDiff < distMax) {
                container.canvas.drawConnectLine(p1, p2);
              }
            }
            ++i;
          }
        }
      }
    };
    exports.Connector = Connector;
  }
});

// node_modules/tsparticles/Interactions/External/Connect/index.js
var require_Connect2 = __commonJS({
  "node_modules/tsparticles/Interactions/External/Connect/index.js"(exports) {
    init_shims();
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.loadExternalConnectInteraction = void 0;
    var Connector_1 = require_Connector();
    async function loadExternalConnectInteraction(tsParticles) {
      await tsParticles.addInteractor("externalConnect", (container) => new Connector_1.Connector(container));
    }
    exports.loadExternalConnectInteraction = loadExternalConnectInteraction;
  }
});

// node_modules/tsparticles/Updaters/Opacity/OpacityUpdater.js
var require_OpacityUpdater = __commonJS({
  "node_modules/tsparticles/Updaters/Opacity/OpacityUpdater.js"(exports) {
    init_shims();
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.OpacityUpdater = void 0;
    var Enums_1 = require_Enums();
    var Utils_1 = require_Utils2();
    function checkDestroy(particle, value, minValue, maxValue) {
      switch (particle.options.opacity.animation.destroy) {
        case Enums_1.DestroyType.max:
          if (value >= maxValue) {
            particle.destroy();
          }
          break;
        case Enums_1.DestroyType.min:
          if (value <= minValue) {
            particle.destroy();
          }
          break;
      }
    }
    function updateOpacity(particle, delta) {
      var _a, _b, _c, _d, _e;
      if (!particle.opacity) {
        return;
      }
      const minValue = particle.opacity.min;
      const maxValue = particle.opacity.max;
      if (!(!particle.destroyed && particle.opacity.enable && (((_a = particle.opacity.maxLoops) !== null && _a !== void 0 ? _a : 0) <= 0 || ((_b = particle.opacity.loops) !== null && _b !== void 0 ? _b : 0) < ((_c = particle.opacity.maxLoops) !== null && _c !== void 0 ? _c : 0)))) {
        return;
      }
      switch (particle.opacity.status) {
        case Enums_1.AnimationStatus.increasing:
          if (particle.opacity.value >= maxValue) {
            particle.opacity.status = Enums_1.AnimationStatus.decreasing;
            if (!particle.opacity.loops) {
              particle.opacity.loops = 0;
            }
            particle.opacity.loops++;
          } else {
            particle.opacity.value += ((_d = particle.opacity.velocity) !== null && _d !== void 0 ? _d : 0) * delta.factor;
          }
          break;
        case Enums_1.AnimationStatus.decreasing:
          if (particle.opacity.value <= minValue) {
            particle.opacity.status = Enums_1.AnimationStatus.increasing;
            if (!particle.opacity.loops) {
              particle.opacity.loops = 0;
            }
            particle.opacity.loops++;
          } else {
            particle.opacity.value -= ((_e = particle.opacity.velocity) !== null && _e !== void 0 ? _e : 0) * delta.factor;
          }
          break;
      }
      checkDestroy(particle, particle.opacity.value, minValue, maxValue);
      if (!particle.destroyed) {
        particle.opacity.value = (0, Utils_1.clamp)(particle.opacity.value, minValue, maxValue);
      }
    }
    var OpacityUpdater = class {
      constructor(container) {
        this.container = container;
      }
      init(particle) {
        const opacityOptions = particle.options.opacity;
        particle.opacity = {
          enable: opacityOptions.animation.enable,
          max: (0, Utils_1.getRangeMax)(opacityOptions.value),
          min: (0, Utils_1.getRangeMin)(opacityOptions.value),
          value: (0, Utils_1.getRangeValue)(opacityOptions.value),
          loops: 0,
          maxLoops: opacityOptions.animation.count
        };
        const opacityAnimation = opacityOptions.animation;
        if (opacityAnimation.enable) {
          particle.opacity.status = Enums_1.AnimationStatus.increasing;
          const opacityRange = opacityOptions.value;
          particle.opacity.min = (0, Utils_1.getRangeMin)(opacityRange);
          particle.opacity.max = (0, Utils_1.getRangeMax)(opacityRange);
          switch (opacityAnimation.startValue) {
            case Enums_1.StartValueType.min:
              particle.opacity.value = particle.opacity.min;
              particle.opacity.status = Enums_1.AnimationStatus.increasing;
              break;
            case Enums_1.StartValueType.random:
              particle.opacity.value = (0, Utils_1.randomInRange)(particle.opacity);
              particle.opacity.status = Math.random() >= 0.5 ? Enums_1.AnimationStatus.increasing : Enums_1.AnimationStatus.decreasing;
              break;
            case Enums_1.StartValueType.max:
            default:
              particle.opacity.value = particle.opacity.max;
              particle.opacity.status = Enums_1.AnimationStatus.decreasing;
              break;
          }
          particle.opacity.velocity = opacityAnimation.speed / 100 * this.container.retina.reduceFactor;
          if (!opacityAnimation.sync) {
            particle.opacity.velocity *= Math.random();
          }
        }
      }
      isEnabled(particle) {
        var _a, _b, _c;
        return !particle.destroyed && !particle.spawning && !!particle.opacity && particle.opacity.enable && (((_a = particle.opacity.maxLoops) !== null && _a !== void 0 ? _a : 0) <= 0 || ((_b = particle.opacity.loops) !== null && _b !== void 0 ? _b : 0) < ((_c = particle.opacity.maxLoops) !== null && _c !== void 0 ? _c : 0));
      }
      update(particle, delta) {
        if (!this.isEnabled(particle)) {
          return;
        }
        updateOpacity(particle, delta);
      }
    };
    exports.OpacityUpdater = OpacityUpdater;
  }
});

// node_modules/tsparticles/Updaters/Opacity/index.js
var require_Opacity2 = __commonJS({
  "node_modules/tsparticles/Updaters/Opacity/index.js"(exports) {
    init_shims();
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.loadOpacityUpdater = void 0;
    var OpacityUpdater_1 = require_OpacityUpdater();
    async function loadOpacityUpdater(tsParticles) {
      await tsParticles.addParticleUpdater("opacity", (container) => new OpacityUpdater_1.OpacityUpdater(container));
    }
    exports.loadOpacityUpdater = loadOpacityUpdater;
  }
});

// node_modules/tsparticles/Shapes/Image/Utils.js
var require_Utils3 = __commonJS({
  "node_modules/tsparticles/Shapes/Image/Utils.js"(exports) {
    init_shims();
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.replaceColorSvg = exports.downloadSvgImage = exports.loadImage = void 0;
    var Utils_1 = require_Utils2();
    function loadImage(source) {
      return new Promise((resolve2, reject) => {
        if (!source) {
          reject("Error tsParticles - No image.src");
          return;
        }
        const image = {
          source,
          type: source.substr(source.length - 3)
        };
        const img = new Image();
        img.addEventListener("load", () => {
          image.element = img;
          resolve2(image);
        });
        img.addEventListener("error", () => {
          reject(`Error tsParticles - loading image: ${source}`);
        });
        img.src = source;
      });
    }
    exports.loadImage = loadImage;
    async function downloadSvgImage(source) {
      if (!source) {
        throw new Error("Error tsParticles - No image.src");
      }
      const image = {
        source,
        type: source.substr(source.length - 3)
      };
      if (image.type !== "svg") {
        return loadImage(source);
      }
      const response = await fetch(image.source);
      if (!response.ok) {
        throw new Error("Error tsParticles - Image not found");
      }
      image.svgData = await response.text();
      return image;
    }
    exports.downloadSvgImage = downloadSvgImage;
    function replaceColorSvg(imageShape, color, opacity) {
      const { svgData } = imageShape;
      if (!svgData) {
        return "";
      }
      if (svgData.includes("fill")) {
        const currentColor = /(#(?:[0-9a-f]{2}){2,4}|(#[0-9a-f]{3})|(rgb|hsl)a?\((-?\d+%?[,\s]+){2,3}\s*[\d.]+%?\))|currentcolor/gi;
        return svgData.replace(currentColor, () => (0, Utils_1.getStyleFromHsl)(color, opacity));
      }
      const preFillIndex = svgData.indexOf(">");
      return `${svgData.substring(0, preFillIndex)} fill="${(0, Utils_1.getStyleFromHsl)(color, opacity)}"${svgData.substring(preFillIndex)}`;
    }
    exports.replaceColorSvg = replaceColorSvg;
  }
});

// node_modules/tsparticles/Shapes/Image/ImageDrawer.js
var require_ImageDrawer = __commonJS({
  "node_modules/tsparticles/Shapes/Image/ImageDrawer.js"(exports) {
    init_shims();
    "use strict";
    var __classPrivateFieldSet = exports && exports.__classPrivateFieldSet || function(receiver, state, value, kind, f) {
      if (kind === "m")
        throw new TypeError("Private method is not writable");
      if (kind === "a" && !f)
        throw new TypeError("Private accessor was defined without a setter");
      if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver))
        throw new TypeError("Cannot write private member to an object whose class did not declare it");
      return kind === "a" ? f.call(receiver, value) : f ? f.value = value : state.set(receiver, value), value;
    };
    var __classPrivateFieldGet = exports && exports.__classPrivateFieldGet || function(receiver, state, kind, f) {
      if (kind === "a" && !f)
        throw new TypeError("Private accessor was defined without a getter");
      if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver))
        throw new TypeError("Cannot read private member from an object whose class did not declare it");
      return kind === "m" ? f : kind === "a" ? f.call(receiver) : f ? f.value : state.get(receiver);
    };
    var _ImageDrawer_images;
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.ImageDrawer = void 0;
    var Utils_1 = require_Utils2();
    var Enums_1 = require_Enums();
    var Utils_2 = require_Utils3();
    var ImageDrawer = class {
      constructor() {
        _ImageDrawer_images.set(this, void 0);
        __classPrivateFieldSet(this, _ImageDrawer_images, [], "f");
      }
      getSidesCount() {
        return 12;
      }
      getImages(container) {
        const containerImages = __classPrivateFieldGet(this, _ImageDrawer_images, "f").find((t) => t.id === container.id);
        if (!containerImages) {
          __classPrivateFieldGet(this, _ImageDrawer_images, "f").push({
            id: container.id,
            images: []
          });
          return this.getImages(container);
        } else {
          return containerImages;
        }
      }
      addImage(container, image) {
        const containerImages = this.getImages(container);
        containerImages === null || containerImages === void 0 ? void 0 : containerImages.images.push(image);
      }
      async init(container) {
        await this.loadImagesFromParticlesOptions(container, container.actualOptions.particles);
        await this.loadImagesFromParticlesOptions(container, container.actualOptions.interactivity.modes.trail.particles);
        for (const manualParticle of container.actualOptions.manualParticles) {
          await this.loadImagesFromParticlesOptions(container, manualParticle.options);
        }
        const emitterOptions = container.actualOptions;
        if (emitterOptions.emitters) {
          if (emitterOptions.emitters instanceof Array) {
            for (const emitter of emitterOptions.emitters) {
              await this.loadImagesFromParticlesOptions(container, emitter.particles);
            }
          } else {
            await this.loadImagesFromParticlesOptions(container, emitterOptions.emitters.particles);
          }
        }
        const interactiveEmitters = emitterOptions.interactivity.modes.emitters;
        if (interactiveEmitters) {
          if (interactiveEmitters instanceof Array) {
            for (const emitter of interactiveEmitters) {
              await this.loadImagesFromParticlesOptions(container, emitter.particles);
            }
          } else {
            await this.loadImagesFromParticlesOptions(container, interactiveEmitters.particles);
          }
        }
      }
      destroy() {
        __classPrivateFieldSet(this, _ImageDrawer_images, [], "f");
      }
      async loadImagesFromParticlesOptions(container, options2) {
        var _a, _b, _c;
        const shapeOptions = options2 === null || options2 === void 0 ? void 0 : options2.shape;
        if (!(shapeOptions === null || shapeOptions === void 0 ? void 0 : shapeOptions.type) || !shapeOptions.options || !(0, Utils_1.isInArray)(Enums_1.ShapeType.image, shapeOptions.type) && !(0, Utils_1.isInArray)(Enums_1.ShapeType.images, shapeOptions.type)) {
          return;
        }
        const idx = __classPrivateFieldGet(this, _ImageDrawer_images, "f").findIndex((t) => t.id === container.id);
        if (idx >= 0) {
          __classPrivateFieldGet(this, _ImageDrawer_images, "f").splice(idx, 1);
        }
        const imageOptions = (_a = shapeOptions.options[Enums_1.ShapeType.images]) !== null && _a !== void 0 ? _a : shapeOptions.options[Enums_1.ShapeType.image];
        if (imageOptions instanceof Array) {
          for (const optionsImage of imageOptions) {
            await this.loadImageShape(container, optionsImage);
          }
        } else {
          await this.loadImageShape(container, imageOptions);
        }
        if (options2 === null || options2 === void 0 ? void 0 : options2.groups) {
          for (const groupName in options2.groups) {
            const group = options2.groups[groupName];
            await this.loadImagesFromParticlesOptions(container, group);
          }
        }
        if ((_c = (_b = options2 === null || options2 === void 0 ? void 0 : options2.destroy) === null || _b === void 0 ? void 0 : _b.split) === null || _c === void 0 ? void 0 : _c.particles) {
          await this.loadImagesFromParticlesOptions(container, options2 === null || options2 === void 0 ? void 0 : options2.destroy.split.particles);
        }
      }
      async loadImageShape(container, imageShape) {
        try {
          const imageFunc = imageShape.replaceColor ? Utils_2.downloadSvgImage : Utils_2.loadImage;
          const image = await imageFunc(imageShape.src);
          if (image) {
            this.addImage(container, image);
          }
        } catch (_a) {
          console.warn(`tsParticles error - ${imageShape.src} not found`);
        }
      }
      draw(context, particle, radius, opacity) {
        var _a, _b;
        if (!context) {
          return;
        }
        const image = particle.image;
        const element = (_a = image === null || image === void 0 ? void 0 : image.data) === null || _a === void 0 ? void 0 : _a.element;
        if (!element) {
          return;
        }
        const ratio = (_b = image === null || image === void 0 ? void 0 : image.ratio) !== null && _b !== void 0 ? _b : 1;
        const pos = {
          x: -radius,
          y: -radius
        };
        if (!(image === null || image === void 0 ? void 0 : image.data.svgData) || !(image === null || image === void 0 ? void 0 : image.replaceColor)) {
          context.globalAlpha = opacity;
        }
        context.drawImage(element, pos.x, pos.y, radius * 2, radius * 2 / ratio);
        if (!(image === null || image === void 0 ? void 0 : image.data.svgData) || !(image === null || image === void 0 ? void 0 : image.replaceColor)) {
          context.globalAlpha = 1;
        }
      }
      loadShape(particle) {
        var _a, _b, _c, _d, _e, _f, _g;
        if (particle.shape !== "image" && particle.shape !== "images") {
          return;
        }
        const images = this.getImages(particle.container).images;
        const imageData = particle.shapeData;
        const image = (_a = images.find((t) => t.source === imageData.src)) !== null && _a !== void 0 ? _a : images[0];
        const color = particle.getFillColor();
        let imageRes;
        if (!image) {
          return;
        }
        if (image.svgData !== void 0 && imageData.replaceColor && color) {
          const svgColoredData = (0, Utils_2.replaceColorSvg)(image, color, (_c = (_b = particle.opacity) === null || _b === void 0 ? void 0 : _b.value) !== null && _c !== void 0 ? _c : 1);
          const svg = new Blob([svgColoredData], { type: "image/svg+xml" });
          const domUrl = URL || window.URL || window.webkitURL || window;
          const url = domUrl.createObjectURL(svg);
          const img = new Image();
          imageRes = {
            data: Object.assign(Object.assign({}, image), { svgData: svgColoredData }),
            ratio: imageData.width / imageData.height,
            replaceColor: (_d = imageData.replaceColor) !== null && _d !== void 0 ? _d : imageData.replace_color,
            source: imageData.src
          };
          img.addEventListener("load", () => {
            const pImage = particle.image;
            if (pImage) {
              pImage.loaded = true;
              image.element = img;
            }
            domUrl.revokeObjectURL(url);
          });
          img.addEventListener("error", () => {
            domUrl.revokeObjectURL(url);
            (0, Utils_2.loadImage)(imageData.src).then((img2) => {
              const pImage = particle.image;
              if (pImage) {
                image.element = img2 === null || img2 === void 0 ? void 0 : img2.element;
                pImage.loaded = true;
              }
            });
          });
          img.src = url;
        } else {
          imageRes = {
            data: image,
            loaded: true,
            ratio: imageData.width / imageData.height,
            replaceColor: (_e = imageData.replaceColor) !== null && _e !== void 0 ? _e : imageData.replace_color,
            source: imageData.src
          };
        }
        if (!imageRes.ratio) {
          imageRes.ratio = 1;
        }
        const fill = (_f = imageData.fill) !== null && _f !== void 0 ? _f : particle.fill;
        const close = (_g = imageData.close) !== null && _g !== void 0 ? _g : particle.close;
        const imageShape = {
          image: imageRes,
          fill,
          close
        };
        particle.image = imageShape.image;
        particle.fill = imageShape.fill;
        particle.close = imageShape.close;
      }
    };
    exports.ImageDrawer = ImageDrawer;
    _ImageDrawer_images = new WeakMap();
  }
});

// node_modules/tsparticles/Shapes/Image/index.js
var require_Image = __commonJS({
  "node_modules/tsparticles/Shapes/Image/index.js"(exports) {
    init_shims();
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.loadImageShape = void 0;
    var ImageDrawer_1 = require_ImageDrawer();
    async function loadImageShape(tsParticles) {
      const imageDrawer = new ImageDrawer_1.ImageDrawer();
      await tsParticles.addShape("image", imageDrawer);
      await tsParticles.addShape("images", imageDrawer);
    }
    exports.loadImageShape = loadImageShape;
  }
});

// node_modules/tsparticles/Shapes/Polygon/PolygonDrawerBase.js
var require_PolygonDrawerBase = __commonJS({
  "node_modules/tsparticles/Shapes/Polygon/PolygonDrawerBase.js"(exports) {
    init_shims();
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.PolygonDrawerBase = void 0;
    var PolygonDrawerBase = class {
      getSidesCount(particle) {
        var _a, _b;
        const polygon = particle.shapeData;
        return (_b = (_a = polygon === null || polygon === void 0 ? void 0 : polygon.sides) !== null && _a !== void 0 ? _a : polygon === null || polygon === void 0 ? void 0 : polygon.nb_sides) !== null && _b !== void 0 ? _b : 5;
      }
      draw(context, particle, radius) {
        const start = this.getCenter(particle, radius);
        const side = this.getSidesData(particle, radius);
        const sideCount = side.count.numerator * side.count.denominator;
        const decimalSides = side.count.numerator / side.count.denominator;
        const interiorAngleDegrees = 180 * (decimalSides - 2) / decimalSides;
        const interiorAngle = Math.PI - Math.PI * interiorAngleDegrees / 180;
        if (!context) {
          return;
        }
        context.beginPath();
        context.translate(start.x, start.y);
        context.moveTo(0, 0);
        for (let i = 0; i < sideCount; i++) {
          context.lineTo(side.length, 0);
          context.translate(side.length, 0);
          context.rotate(interiorAngle);
        }
      }
    };
    exports.PolygonDrawerBase = PolygonDrawerBase;
  }
});

// node_modules/tsparticles/Shapes/Polygon/PolygonDrawer.js
var require_PolygonDrawer = __commonJS({
  "node_modules/tsparticles/Shapes/Polygon/PolygonDrawer.js"(exports) {
    init_shims();
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.PolygonDrawer = void 0;
    var PolygonDrawerBase_1 = require_PolygonDrawerBase();
    var PolygonDrawer = class extends PolygonDrawerBase_1.PolygonDrawerBase {
      getSidesData(particle, radius) {
        var _a, _b;
        const polygon = particle.shapeData;
        const sides = (_b = (_a = polygon === null || polygon === void 0 ? void 0 : polygon.sides) !== null && _a !== void 0 ? _a : polygon === null || polygon === void 0 ? void 0 : polygon.nb_sides) !== null && _b !== void 0 ? _b : 5;
        return {
          count: {
            denominator: 1,
            numerator: sides
          },
          length: radius * 2.66 / (sides / 3)
        };
      }
      getCenter(particle, radius) {
        const sides = this.getSidesCount(particle);
        return {
          x: -radius / (sides / 3.5),
          y: -radius / (2.66 / 3.5)
        };
      }
    };
    exports.PolygonDrawer = PolygonDrawer;
  }
});

// node_modules/tsparticles/Shapes/Polygon/TriangleDrawer.js
var require_TriangleDrawer = __commonJS({
  "node_modules/tsparticles/Shapes/Polygon/TriangleDrawer.js"(exports) {
    init_shims();
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.TriangleDrawer = void 0;
    var PolygonDrawerBase_1 = require_PolygonDrawerBase();
    var TriangleDrawer = class extends PolygonDrawerBase_1.PolygonDrawerBase {
      getSidesCount() {
        return 3;
      }
      getSidesData(particle, radius) {
        return {
          count: {
            denominator: 2,
            numerator: 3
          },
          length: radius * 2
        };
      }
      getCenter(particle, radius) {
        return {
          x: -radius,
          y: radius / 1.66
        };
      }
    };
    exports.TriangleDrawer = TriangleDrawer;
  }
});

// node_modules/tsparticles/Shapes/Polygon/index.js
var require_Polygon = __commonJS({
  "node_modules/tsparticles/Shapes/Polygon/index.js"(exports) {
    init_shims();
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.loadPolygonShape = exports.loadTriangleShape = exports.loadGenericPolygonShape = void 0;
    var PolygonDrawer_1 = require_PolygonDrawer();
    var TriangleDrawer_1 = require_TriangleDrawer();
    async function loadGenericPolygonShape(tsParticles) {
      await tsParticles.addShape("polygon", new PolygonDrawer_1.PolygonDrawer());
    }
    exports.loadGenericPolygonShape = loadGenericPolygonShape;
    async function loadTriangleShape(tsParticles) {
      await tsParticles.addShape("triangle", new TriangleDrawer_1.TriangleDrawer());
    }
    exports.loadTriangleShape = loadTriangleShape;
    async function loadPolygonShape(tsParticles) {
      await loadGenericPolygonShape(tsParticles);
      await loadTriangleShape(tsParticles);
    }
    exports.loadPolygonShape = loadPolygonShape;
  }
});

// node_modules/tsparticles/Interactions/External/Bubble/ProcessBubbleType.js
var require_ProcessBubbleType = __commonJS({
  "node_modules/tsparticles/Interactions/External/Bubble/ProcessBubbleType.js"(exports) {
    init_shims();
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.ProcessBubbleType = void 0;
    var ProcessBubbleType;
    (function(ProcessBubbleType2) {
      ProcessBubbleType2["color"] = "color";
      ProcessBubbleType2["opacity"] = "opacity";
      ProcessBubbleType2["size"] = "size";
    })(ProcessBubbleType = exports.ProcessBubbleType || (exports.ProcessBubbleType = {}));
  }
});

// node_modules/tsparticles/Interactions/External/Bubble/Bubbler.js
var require_Bubbler = __commonJS({
  "node_modules/tsparticles/Interactions/External/Bubble/Bubbler.js"(exports) {
    init_shims();
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.Bubbler = void 0;
    var Utils_1 = require_Utils2();
    var Enums_1 = require_Enums();
    var ExternalInteractorBase_1 = require_ExternalInteractorBase();
    var ProcessBubbleType_1 = require_ProcessBubbleType();
    function calculateBubbleValue(particleValue, modeValue, optionsValue, ratio) {
      if (modeValue >= optionsValue) {
        const value = particleValue + (modeValue - optionsValue) * ratio;
        return (0, Utils_1.clamp)(value, particleValue, modeValue);
      } else if (modeValue < optionsValue) {
        const value = particleValue - (optionsValue - modeValue) * ratio;
        return (0, Utils_1.clamp)(value, modeValue, particleValue);
      }
    }
    var Bubbler = class extends ExternalInteractorBase_1.ExternalInteractorBase {
      constructor(container) {
        super(container);
      }
      isEnabled() {
        const container = this.container, options2 = container.actualOptions, mouse = container.interactivity.mouse, events = options2.interactivity.events, divs = events.onDiv, divBubble = (0, Utils_1.isDivModeEnabled)(Enums_1.DivMode.bubble, divs);
        if (!(divBubble || events.onHover.enable && mouse.position || events.onClick.enable && mouse.clickPosition)) {
          return false;
        }
        const hoverMode = events.onHover.mode;
        const clickMode = events.onClick.mode;
        return (0, Utils_1.isInArray)(Enums_1.HoverMode.bubble, hoverMode) || (0, Utils_1.isInArray)(Enums_1.ClickMode.bubble, clickMode) || divBubble;
      }
      reset(particle, force) {
        if (!(!particle.bubble.inRange || force)) {
          return;
        }
        delete particle.bubble.div;
        delete particle.bubble.opacity;
        delete particle.bubble.radius;
        delete particle.bubble.color;
      }
      interact() {
        const options2 = this.container.actualOptions, events = options2.interactivity.events, onHover = events.onHover, onClick = events.onClick, hoverEnabled = onHover.enable, hoverMode = onHover.mode, clickEnabled = onClick.enable, clickMode = onClick.mode, divs = events.onDiv;
        if (hoverEnabled && (0, Utils_1.isInArray)(Enums_1.HoverMode.bubble, hoverMode)) {
          this.hoverBubble();
        } else if (clickEnabled && (0, Utils_1.isInArray)(Enums_1.ClickMode.bubble, clickMode)) {
          this.clickBubble();
        } else {
          (0, Utils_1.divModeExecute)(Enums_1.DivMode.bubble, divs, (selector, div) => this.singleSelectorHover(selector, div));
        }
      }
      singleSelectorHover(selector, div) {
        const container = this.container, selectors = document.querySelectorAll(selector);
        if (!selectors.length) {
          return;
        }
        selectors.forEach((item) => {
          const elem = item, pxRatio = container.retina.pixelRatio, pos = {
            x: (elem.offsetLeft + elem.offsetWidth / 2) * pxRatio,
            y: (elem.offsetTop + elem.offsetHeight / 2) * pxRatio
          }, repulseRadius = elem.offsetWidth / 2 * pxRatio, area = div.type === Enums_1.DivType.circle ? new Utils_1.Circle(pos.x, pos.y, repulseRadius) : new Utils_1.Rectangle(elem.offsetLeft * pxRatio, elem.offsetTop * pxRatio, elem.offsetWidth * pxRatio, elem.offsetHeight * pxRatio), query = container.particles.quadTree.query(area);
          for (const particle of query) {
            if (!area.contains(particle.getPosition())) {
              continue;
            }
            particle.bubble.inRange = true;
            const divs = container.actualOptions.interactivity.modes.bubble.divs;
            const divBubble = (0, Utils_1.divMode)(divs, elem);
            if (!particle.bubble.div || particle.bubble.div !== elem) {
              this.reset(particle, true);
              particle.bubble.div = elem;
            }
            this.hoverBubbleSize(particle, 1, divBubble);
            this.hoverBubbleOpacity(particle, 1, divBubble);
            this.hoverBubbleColor(particle, 1, divBubble);
          }
        });
      }
      process(particle, distMouse, timeSpent, data) {
        const container = this.container, bubbleParam = data.bubbleObj.optValue;
        if (bubbleParam === void 0) {
          return;
        }
        const options2 = container.actualOptions, bubbleDuration = options2.interactivity.modes.bubble.duration, bubbleDistance = container.retina.bubbleModeDistance, particlesParam = data.particlesObj.optValue, pObjBubble = data.bubbleObj.value, pObj = data.particlesObj.value || 0, type = data.type;
        if (bubbleParam === particlesParam) {
          return;
        }
        if (!container.bubble.durationEnd) {
          if (distMouse <= bubbleDistance) {
            const obj = pObjBubble !== null && pObjBubble !== void 0 ? pObjBubble : pObj;
            if (obj !== bubbleParam) {
              const value = pObj - timeSpent * (pObj - bubbleParam) / bubbleDuration;
              if (type === ProcessBubbleType_1.ProcessBubbleType.size) {
                particle.bubble.radius = value;
              }
              if (type === ProcessBubbleType_1.ProcessBubbleType.opacity) {
                particle.bubble.opacity = value;
              }
            }
          } else {
            if (type === ProcessBubbleType_1.ProcessBubbleType.size) {
              delete particle.bubble.radius;
            }
            if (type === ProcessBubbleType_1.ProcessBubbleType.opacity) {
              delete particle.bubble.opacity;
            }
          }
        } else if (pObjBubble) {
          if (type === ProcessBubbleType_1.ProcessBubbleType.size) {
            delete particle.bubble.radius;
          }
          if (type === ProcessBubbleType_1.ProcessBubbleType.opacity) {
            delete particle.bubble.opacity;
          }
        }
      }
      clickBubble() {
        var _a, _b;
        const container = this.container, options2 = container.actualOptions, mouseClickPos = container.interactivity.mouse.clickPosition;
        if (!mouseClickPos) {
          return;
        }
        const distance = container.retina.bubbleModeDistance, query = container.particles.quadTree.queryCircle(mouseClickPos, distance);
        for (const particle of query) {
          if (!container.bubble.clicking) {
            continue;
          }
          particle.bubble.inRange = !container.bubble.durationEnd;
          const pos = particle.getPosition(), distMouse = (0, Utils_1.getDistance)(pos, mouseClickPos), timeSpent = (new Date().getTime() - (container.interactivity.mouse.clickTime || 0)) / 1e3;
          if (timeSpent > options2.interactivity.modes.bubble.duration) {
            container.bubble.durationEnd = true;
          }
          if (timeSpent > options2.interactivity.modes.bubble.duration * 2) {
            container.bubble.clicking = false;
            container.bubble.durationEnd = false;
          }
          const sizeData = {
            bubbleObj: {
              optValue: container.retina.bubbleModeSize,
              value: particle.bubble.radius
            },
            particlesObj: {
              optValue: (0, Utils_1.getRangeMax)(particle.options.size.value) * container.retina.pixelRatio,
              value: particle.size.value
            },
            type: ProcessBubbleType_1.ProcessBubbleType.size
          };
          this.process(particle, distMouse, timeSpent, sizeData);
          const opacityData = {
            bubbleObj: {
              optValue: options2.interactivity.modes.bubble.opacity,
              value: particle.bubble.opacity
            },
            particlesObj: {
              optValue: (0, Utils_1.getRangeMax)(particle.options.opacity.value),
              value: (_b = (_a = particle.opacity) === null || _a === void 0 ? void 0 : _a.value) !== null && _b !== void 0 ? _b : 1
            },
            type: ProcessBubbleType_1.ProcessBubbleType.opacity
          };
          this.process(particle, distMouse, timeSpent, opacityData);
          if (!container.bubble.durationEnd) {
            if (distMouse <= container.retina.bubbleModeDistance) {
              this.hoverBubbleColor(particle, distMouse);
            } else {
              delete particle.bubble.color;
            }
          } else {
            delete particle.bubble.color;
          }
        }
      }
      hoverBubble() {
        const container = this.container, mousePos = container.interactivity.mouse.position;
        if (mousePos === void 0) {
          return;
        }
        const distance = container.retina.bubbleModeDistance, query = container.particles.quadTree.queryCircle(mousePos, distance);
        for (const particle of query) {
          particle.bubble.inRange = true;
          const pos = particle.getPosition(), pointDistance = (0, Utils_1.getDistance)(pos, mousePos), ratio = 1 - pointDistance / distance;
          if (pointDistance <= distance) {
            if (ratio >= 0 && container.interactivity.status === Utils_1.Constants.mouseMoveEvent) {
              this.hoverBubbleSize(particle, ratio);
              this.hoverBubbleOpacity(particle, ratio);
              this.hoverBubbleColor(particle, ratio);
            }
          } else {
            this.reset(particle);
          }
          if (container.interactivity.status === Utils_1.Constants.mouseLeaveEvent) {
            this.reset(particle);
          }
        }
      }
      hoverBubbleSize(particle, ratio, divBubble) {
        const container = this.container, modeSize = (divBubble === null || divBubble === void 0 ? void 0 : divBubble.size) ? divBubble.size * container.retina.pixelRatio : container.retina.bubbleModeSize;
        if (modeSize === void 0) {
          return;
        }
        const optSize = (0, Utils_1.getRangeMax)(particle.options.size.value) * container.retina.pixelRatio;
        const pSize = particle.size.value;
        const size = calculateBubbleValue(pSize, modeSize, optSize, ratio);
        if (size !== void 0) {
          particle.bubble.radius = size;
        }
      }
      hoverBubbleOpacity(particle, ratio, divBubble) {
        var _a, _b, _c;
        const container = this.container, options2 = container.actualOptions, modeOpacity = (_a = divBubble === null || divBubble === void 0 ? void 0 : divBubble.opacity) !== null && _a !== void 0 ? _a : options2.interactivity.modes.bubble.opacity;
        if (!modeOpacity) {
          return;
        }
        const optOpacity = particle.options.opacity.value;
        const pOpacity = (_c = (_b = particle.opacity) === null || _b === void 0 ? void 0 : _b.value) !== null && _c !== void 0 ? _c : 1;
        const opacity = calculateBubbleValue(pOpacity, modeOpacity, (0, Utils_1.getRangeMax)(optOpacity), ratio);
        if (opacity !== void 0) {
          particle.bubble.opacity = opacity;
        }
      }
      hoverBubbleColor(particle, ratio, divBubble) {
        const options2 = this.container.actualOptions;
        const bubbleOptions = divBubble !== null && divBubble !== void 0 ? divBubble : options2.interactivity.modes.bubble;
        if (!particle.bubble.finalColor) {
          const modeColor = bubbleOptions.color;
          if (!modeColor) {
            return;
          }
          const bubbleColor = modeColor instanceof Array ? (0, Utils_1.itemFromArray)(modeColor) : modeColor;
          particle.bubble.finalColor = (0, Utils_1.colorToHsl)(bubbleColor);
        }
        if (!particle.bubble.finalColor) {
          return;
        }
        if (bubbleOptions.mix) {
          particle.bubble.color = void 0;
          const pColor = particle.getFillColor();
          particle.bubble.color = pColor ? (0, Utils_1.rgbToHsl)((0, Utils_1.colorMix)(pColor, particle.bubble.finalColor, 1 - ratio, ratio)) : particle.bubble.finalColor;
        } else {
          particle.bubble.color = particle.bubble.finalColor;
        }
      }
    };
    exports.Bubbler = Bubbler;
  }
});

// node_modules/tsparticles/Interactions/External/Bubble/index.js
var require_Bubble2 = __commonJS({
  "node_modules/tsparticles/Interactions/External/Bubble/index.js"(exports) {
    init_shims();
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.loadExternalBubbleInteraction = void 0;
    var Bubbler_1 = require_Bubbler();
    async function loadExternalBubbleInteraction(tsParticles) {
      await tsParticles.addInteractor("externalBubble", (container) => new Bubbler_1.Bubbler(container));
    }
    exports.loadExternalBubbleInteraction = loadExternalBubbleInteraction;
  }
});

// node_modules/tsparticles/Interactions/External/Attract/Attractor.js
var require_Attractor = __commonJS({
  "node_modules/tsparticles/Interactions/External/Attract/Attractor.js"(exports) {
    init_shims();
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.Attractor = void 0;
    var Enums_1 = require_Enums();
    var Utils_1 = require_Utils2();
    var ExternalInteractorBase_1 = require_ExternalInteractorBase();
    var Vector_1 = require_Vector();
    var Attractor = class extends ExternalInteractorBase_1.ExternalInteractorBase {
      constructor(container) {
        super(container);
      }
      isEnabled() {
        const container = this.container, options2 = container.actualOptions, mouse = container.interactivity.mouse, events = options2.interactivity.events;
        if ((!mouse.position || !events.onHover.enable) && (!mouse.clickPosition || !events.onClick.enable)) {
          return false;
        }
        const hoverMode = events.onHover.mode, clickMode = events.onClick.mode;
        return (0, Utils_1.isInArray)(Enums_1.HoverMode.attract, hoverMode) || (0, Utils_1.isInArray)(Enums_1.ClickMode.attract, clickMode);
      }
      reset() {
      }
      interact() {
        const container = this.container, options2 = container.actualOptions, mouseMoveStatus = container.interactivity.status === Utils_1.Constants.mouseMoveEvent, events = options2.interactivity.events, hoverEnabled = events.onHover.enable, hoverMode = events.onHover.mode, clickEnabled = events.onClick.enable, clickMode = events.onClick.mode;
        if (mouseMoveStatus && hoverEnabled && (0, Utils_1.isInArray)(Enums_1.HoverMode.attract, hoverMode)) {
          this.hoverAttract();
        } else if (clickEnabled && (0, Utils_1.isInArray)(Enums_1.ClickMode.attract, clickMode)) {
          this.clickAttract();
        }
      }
      hoverAttract() {
        const container = this.container;
        const mousePos = container.interactivity.mouse.position;
        if (!mousePos) {
          return;
        }
        const attractRadius = container.retina.attractModeDistance;
        this.processAttract(mousePos, attractRadius, new Utils_1.Circle(mousePos.x, mousePos.y, attractRadius));
      }
      processAttract(position, attractRadius, area) {
        const container = this.container;
        const attractOptions = container.actualOptions.interactivity.modes.attract;
        const query = container.particles.quadTree.query(area);
        for (const particle of query) {
          const { dx, dy, distance } = (0, Utils_1.getDistances)(particle.position, position);
          const velocity = attractOptions.speed * attractOptions.factor;
          const attractFactor = (0, Utils_1.clamp)((0, Utils_1.calcEasing)(1 - distance / attractRadius, attractOptions.easing) * velocity, 0, attractOptions.maxSpeed);
          const normVec = Vector_1.Vector.create(distance === 0 ? velocity : dx / distance * attractFactor, distance === 0 ? velocity : dy / distance * attractFactor);
          particle.position.subFrom(normVec);
        }
      }
      clickAttract() {
        const container = this.container;
        if (!container.attract.finish) {
          if (!container.attract.count) {
            container.attract.count = 0;
          }
          container.attract.count++;
          if (container.attract.count === container.particles.count) {
            container.attract.finish = true;
          }
        }
        if (container.attract.clicking) {
          const mousePos = container.interactivity.mouse.clickPosition;
          if (!mousePos) {
            return;
          }
          const attractRadius = container.retina.attractModeDistance;
          this.processAttract(mousePos, attractRadius, new Utils_1.Circle(mousePos.x, mousePos.y, attractRadius));
        } else if (container.attract.clicking === false) {
          container.attract.particles = [];
        }
        return;
      }
    };
    exports.Attractor = Attractor;
  }
});

// node_modules/tsparticles/Interactions/External/Attract/index.js
var require_Attract3 = __commonJS({
  "node_modules/tsparticles/Interactions/External/Attract/index.js"(exports) {
    init_shims();
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.loadExternalAttractInteraction = void 0;
    var Attractor_1 = require_Attractor();
    async function loadExternalAttractInteraction(tsParticles) {
      await tsParticles.addInteractor("externalAttract", (container) => new Attractor_1.Attractor(container));
    }
    exports.loadExternalAttractInteraction = loadExternalAttractInteraction;
  }
});

// node_modules/tsparticles/Interactions/External/Grab/Grabber.js
var require_Grabber = __commonJS({
  "node_modules/tsparticles/Interactions/External/Grab/Grabber.js"(exports) {
    init_shims();
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.Grabber = void 0;
    var Utils_1 = require_Utils2();
    var Enums_1 = require_Enums();
    var ExternalInteractorBase_1 = require_ExternalInteractorBase();
    var Grabber = class extends ExternalInteractorBase_1.ExternalInteractorBase {
      constructor(container) {
        super(container);
      }
      isEnabled() {
        const container = this.container, mouse = container.interactivity.mouse, events = container.actualOptions.interactivity.events;
        return events.onHover.enable && !!mouse.position && (0, Utils_1.isInArray)(Enums_1.HoverMode.grab, events.onHover.mode);
      }
      reset() {
      }
      interact() {
        var _a;
        const container = this.container, options2 = container.actualOptions, interactivity = options2.interactivity;
        if (interactivity.events.onHover.enable && container.interactivity.status === Utils_1.Constants.mouseMoveEvent) {
          const mousePos = container.interactivity.mouse.position;
          if (!mousePos) {
            return;
          }
          const distance = container.retina.grabModeDistance, query = container.particles.quadTree.queryCircle(mousePos, distance);
          for (const particle of query) {
            const pos = particle.getPosition(), pointDistance = (0, Utils_1.getDistance)(pos, mousePos);
            if (pointDistance <= distance) {
              const grabLineOptions = interactivity.modes.grab.links, lineOpacity = grabLineOptions.opacity, opacityLine = lineOpacity - pointDistance * lineOpacity / distance;
              if (opacityLine <= 0) {
                continue;
              }
              const optColor = (_a = grabLineOptions.color) !== null && _a !== void 0 ? _a : particle.options.links.color;
              if (!container.particles.grabLineColor) {
                const linksOptions = options2.interactivity.modes.grab.links;
                container.particles.grabLineColor = (0, Utils_1.getLinkRandomColor)(optColor, linksOptions.blink, linksOptions.consent);
              }
              const colorLine = (0, Utils_1.getLinkColor)(particle, void 0, container.particles.grabLineColor);
              if (!colorLine) {
                return;
              }
              container.canvas.drawGrabLine(particle, colorLine, opacityLine, mousePos);
            }
          }
        }
      }
    };
    exports.Grabber = Grabber;
  }
});

// node_modules/tsparticles/Interactions/External/Grab/index.js
var require_Grab2 = __commonJS({
  "node_modules/tsparticles/Interactions/External/Grab/index.js"(exports) {
    init_shims();
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.loadExternalGrabInteraction = void 0;
    var Grabber_1 = require_Grabber();
    async function loadExternalGrabInteraction(tsParticles) {
      await tsParticles.addInteractor("externalGrab", (container) => new Grabber_1.Grabber(container));
    }
    exports.loadExternalGrabInteraction = loadExternalGrabInteraction;
  }
});

// node_modules/tsparticles/Shapes/Star/StarDrawer.js
var require_StarDrawer = __commonJS({
  "node_modules/tsparticles/Shapes/Star/StarDrawer.js"(exports) {
    init_shims();
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.StarDrawer = void 0;
    var StarDrawer = class {
      getSidesCount(particle) {
        var _a, _b;
        const star = particle.shapeData;
        return (_b = (_a = star === null || star === void 0 ? void 0 : star.sides) !== null && _a !== void 0 ? _a : star === null || star === void 0 ? void 0 : star.nb_sides) !== null && _b !== void 0 ? _b : 5;
      }
      draw(context, particle, radius) {
        var _a;
        const star = particle.shapeData;
        const sides = this.getSidesCount(particle);
        const inset = (_a = star === null || star === void 0 ? void 0 : star.inset) !== null && _a !== void 0 ? _a : 2;
        context.moveTo(0, 0 - radius);
        for (let i = 0; i < sides; i++) {
          context.rotate(Math.PI / sides);
          context.lineTo(0, 0 - radius * inset);
          context.rotate(Math.PI / sides);
          context.lineTo(0, 0 - radius);
        }
      }
    };
    exports.StarDrawer = StarDrawer;
  }
});

// node_modules/tsparticles/Shapes/Star/index.js
var require_Star = __commonJS({
  "node_modules/tsparticles/Shapes/Star/index.js"(exports) {
    init_shims();
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.loadStarShape = void 0;
    var StarDrawer_1 = require_StarDrawer();
    async function loadStarShape(tsParticles) {
      await tsParticles.addShape("star", new StarDrawer_1.StarDrawer());
    }
    exports.loadStarShape = loadStarShape;
  }
});

// node_modules/tsparticles/Core/ParticlesInteractorBase.js
var require_ParticlesInteractorBase = __commonJS({
  "node_modules/tsparticles/Core/ParticlesInteractorBase.js"(exports) {
    init_shims();
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.ParticlesInteractorBase = void 0;
    var Enums_1 = require_Enums();
    var ParticlesInteractorBase = class {
      constructor(container) {
        this.container = container;
        this.type = Enums_1.InteractorType.Particles;
      }
    };
    exports.ParticlesInteractorBase = ParticlesInteractorBase;
  }
});

// node_modules/tsparticles/Interactions/Particles/Attract/Attractor.js
var require_Attractor2 = __commonJS({
  "node_modules/tsparticles/Interactions/Particles/Attract/Attractor.js"(exports) {
    init_shims();
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.Attractor = void 0;
    var Utils_1 = require_Utils2();
    var ParticlesInteractorBase_1 = require_ParticlesInteractorBase();
    var Attractor = class extends ParticlesInteractorBase_1.ParticlesInteractorBase {
      constructor(container) {
        super(container);
      }
      interact(p1) {
        var _a;
        const container = this.container, distance = (_a = p1.retina.attractDistance) !== null && _a !== void 0 ? _a : container.retina.attractDistance, pos1 = p1.getPosition(), query = container.particles.quadTree.queryCircle(pos1, distance);
        for (const p2 of query) {
          if (p1 === p2 || !p2.options.move.attract.enable || p2.destroyed || p2.spawning) {
            continue;
          }
          const pos2 = p2.getPosition(), { dx, dy } = (0, Utils_1.getDistances)(pos1, pos2), rotate = p1.options.move.attract.rotate, ax = dx / (rotate.x * 1e3), ay = dy / (rotate.y * 1e3), p1Factor = p2.size.value / p1.size.value, p2Factor = 1 / p1Factor;
          p1.velocity.x -= ax * p1Factor;
          p1.velocity.y -= ay * p1Factor;
          p2.velocity.x += ax * p2Factor;
          p2.velocity.y += ay * p2Factor;
        }
      }
      isEnabled(particle) {
        return particle.options.move.attract.enable;
      }
      reset() {
      }
    };
    exports.Attractor = Attractor;
  }
});

// node_modules/tsparticles/Interactions/Particles/Attract/index.js
var require_Attract4 = __commonJS({
  "node_modules/tsparticles/Interactions/Particles/Attract/index.js"(exports) {
    init_shims();
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.loadParticlesAttractInteraction = void 0;
    var Attractor_1 = require_Attractor2();
    async function loadParticlesAttractInteraction(tsParticles) {
      await tsParticles.addInteractor("particlesAttract", (container) => new Attractor_1.Attractor(container));
    }
    exports.loadParticlesAttractInteraction = loadParticlesAttractInteraction;
  }
});

// node_modules/tsparticles/Shapes/Square/SquareDrawer.js
var require_SquareDrawer = __commonJS({
  "node_modules/tsparticles/Shapes/Square/SquareDrawer.js"(exports) {
    init_shims();
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.SquareDrawer = void 0;
    var fixFactor = Math.sqrt(2);
    var SquareDrawer = class {
      getSidesCount() {
        return 4;
      }
      draw(context, particle, radius) {
        context.rect(-radius / fixFactor, -radius / fixFactor, radius * 2 / fixFactor, radius * 2 / fixFactor);
      }
    };
    exports.SquareDrawer = SquareDrawer;
  }
});

// node_modules/tsparticles/Shapes/Square/index.js
var require_Square = __commonJS({
  "node_modules/tsparticles/Shapes/Square/index.js"(exports) {
    init_shims();
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.loadSquareShape = void 0;
    var SquareDrawer_1 = require_SquareDrawer();
    async function loadSquareShape(tsParticles) {
      const drawer = new SquareDrawer_1.SquareDrawer();
      await tsParticles.addShape("edge", drawer);
      await tsParticles.addShape("square", drawer);
    }
    exports.loadSquareShape = loadSquareShape;
  }
});

// node_modules/tsparticles/Updaters/StrokeColor/StrokeColorUpdater.js
var require_StrokeColorUpdater = __commonJS({
  "node_modules/tsparticles/Updaters/StrokeColor/StrokeColorUpdater.js"(exports) {
    init_shims();
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.StrokeColorUpdater = void 0;
    var Utils_1 = require_Utils2();
    var Enums_1 = require_Enums();
    function updateColorValue(delta, value, valueAnimation, max, decrease) {
      var _a;
      const colorValue = value;
      if (!colorValue || !colorValue.enable) {
        return;
      }
      const offset = (0, Utils_1.randomInRange)(valueAnimation.offset);
      const velocity = ((_a = value.velocity) !== null && _a !== void 0 ? _a : 0) * delta.factor + offset * 3.6;
      if (!decrease || colorValue.status === Enums_1.AnimationStatus.increasing) {
        colorValue.value += velocity;
        if (decrease && colorValue.value > max) {
          colorValue.status = Enums_1.AnimationStatus.decreasing;
          colorValue.value -= colorValue.value % max;
        }
      } else {
        colorValue.value -= velocity;
        if (colorValue.value < 0) {
          colorValue.status = Enums_1.AnimationStatus.increasing;
          colorValue.value += colorValue.value;
        }
      }
      if (colorValue.value > max) {
        colorValue.value %= max;
      }
    }
    function updateStrokeColor(particle, delta) {
      var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k;
      if (!((_a = particle.stroke) === null || _a === void 0 ? void 0 : _a.color)) {
        return;
      }
      const animationOptions = particle.stroke.color.animation;
      const h = (_c = (_b = particle.strokeColor) === null || _b === void 0 ? void 0 : _b.h) !== null && _c !== void 0 ? _c : (_d = particle.color) === null || _d === void 0 ? void 0 : _d.h;
      if (h) {
        updateColorValue(delta, h, animationOptions.h, 360, false);
      }
      const s2 = (_f = (_e = particle.strokeColor) === null || _e === void 0 ? void 0 : _e.s) !== null && _f !== void 0 ? _f : (_g = particle.color) === null || _g === void 0 ? void 0 : _g.s;
      if (s2) {
        updateColorValue(delta, s2, animationOptions.s, 100, true);
      }
      const l = (_j = (_h = particle.strokeColor) === null || _h === void 0 ? void 0 : _h.l) !== null && _j !== void 0 ? _j : (_k = particle.color) === null || _k === void 0 ? void 0 : _k.l;
      if (l) {
        updateColorValue(delta, l, animationOptions.l, 100, true);
      }
    }
    var StrokeColorUpdater = class {
      constructor(container) {
        this.container = container;
      }
      init(particle) {
        var _a, _b;
        const container = this.container;
        particle.stroke = particle.options.stroke instanceof Array ? (0, Utils_1.itemFromArray)(particle.options.stroke, particle.id, particle.options.reduceDuplicates) : particle.options.stroke;
        particle.strokeWidth = particle.stroke.width * container.retina.pixelRatio;
        const strokeHslColor = (_a = (0, Utils_1.colorToHsl)(particle.stroke.color)) !== null && _a !== void 0 ? _a : particle.getFillColor();
        if (strokeHslColor) {
          particle.strokeColor = (0, Utils_1.getHslAnimationFromHsl)(strokeHslColor, (_b = particle.stroke.color) === null || _b === void 0 ? void 0 : _b.animation, container.retina.reduceFactor);
        }
      }
      isEnabled(particle) {
        var _a, _b, _c, _d;
        const color = (_a = particle.stroke) === null || _a === void 0 ? void 0 : _a.color;
        return !particle.destroyed && !particle.spawning && !!color && (((_b = particle.strokeColor) === null || _b === void 0 ? void 0 : _b.h.value) !== void 0 && color.animation.h.enable || ((_c = particle.strokeColor) === null || _c === void 0 ? void 0 : _c.s.value) !== void 0 && color.animation.s.enable || ((_d = particle.strokeColor) === null || _d === void 0 ? void 0 : _d.l.value) !== void 0 && color.animation.l.enable);
      }
      update(particle, delta) {
        if (!this.isEnabled(particle)) {
          return;
        }
        updateStrokeColor(particle, delta);
      }
    };
    exports.StrokeColorUpdater = StrokeColorUpdater;
  }
});

// node_modules/tsparticles/Updaters/StrokeColor/index.js
var require_StrokeColor = __commonJS({
  "node_modules/tsparticles/Updaters/StrokeColor/index.js"(exports) {
    init_shims();
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.loadStrokeColorUpdater = void 0;
    var StrokeColorUpdater_1 = require_StrokeColorUpdater();
    async function loadStrokeColorUpdater(tsParticles) {
      await tsParticles.addParticleUpdater("strokeColor", (container) => new StrokeColorUpdater_1.StrokeColorUpdater(container));
    }
    exports.loadStrokeColorUpdater = loadStrokeColorUpdater;
  }
});

// node_modules/tsparticles/Updaters/Color/ColorUpdater.js
var require_ColorUpdater = __commonJS({
  "node_modules/tsparticles/Updaters/Color/ColorUpdater.js"(exports) {
    init_shims();
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.ColorUpdater = void 0;
    var Enums_1 = require_Enums();
    var Utils_1 = require_Utils2();
    function updateColorValue(delta, value, valueAnimation, max, decrease) {
      var _a;
      const colorValue = value;
      if (!colorValue || !valueAnimation.enable) {
        return;
      }
      const offset = (0, Utils_1.randomInRange)(valueAnimation.offset);
      const velocity = ((_a = value.velocity) !== null && _a !== void 0 ? _a : 0) * delta.factor + offset * 3.6;
      if (!decrease || colorValue.status === Enums_1.AnimationStatus.increasing) {
        colorValue.value += velocity;
        if (decrease && colorValue.value > max) {
          colorValue.status = Enums_1.AnimationStatus.decreasing;
          colorValue.value -= colorValue.value % max;
        }
      } else {
        colorValue.value -= velocity;
        if (colorValue.value < 0) {
          colorValue.status = Enums_1.AnimationStatus.increasing;
          colorValue.value += colorValue.value;
        }
      }
      if (colorValue.value > max) {
        colorValue.value %= max;
      }
    }
    function updateColor(particle, delta) {
      var _a, _b, _c;
      const animationOptions = particle.options.color.animation;
      if (((_a = particle.color) === null || _a === void 0 ? void 0 : _a.h) !== void 0) {
        updateColorValue(delta, particle.color.h, animationOptions.h, 360, false);
      }
      if (((_b = particle.color) === null || _b === void 0 ? void 0 : _b.s) !== void 0) {
        updateColorValue(delta, particle.color.s, animationOptions.s, 100, true);
      }
      if (((_c = particle.color) === null || _c === void 0 ? void 0 : _c.l) !== void 0) {
        updateColorValue(delta, particle.color.l, animationOptions.l, 100, true);
      }
    }
    var ColorUpdater = class {
      constructor(container) {
        this.container = container;
      }
      init(particle) {
        const hslColor = (0, Utils_1.colorToHsl)(particle.options.color, particle.id, particle.options.reduceDuplicates);
        if (hslColor) {
          particle.color = (0, Utils_1.getHslAnimationFromHsl)(hslColor, particle.options.color.animation, this.container.retina.reduceFactor);
        }
      }
      isEnabled(particle) {
        var _a, _b, _c;
        const animationOptions = particle.options.color.animation;
        return !particle.destroyed && !particle.spawning && (((_a = particle.color) === null || _a === void 0 ? void 0 : _a.h.value) !== void 0 && animationOptions.h.enable || ((_b = particle.color) === null || _b === void 0 ? void 0 : _b.s.value) !== void 0 && animationOptions.s.enable || ((_c = particle.color) === null || _c === void 0 ? void 0 : _c.l.value) !== void 0 && animationOptions.l.enable);
      }
      update(particle, delta) {
        updateColor(particle, delta);
      }
    };
    exports.ColorUpdater = ColorUpdater;
  }
});

// node_modules/tsparticles/Updaters/Color/index.js
var require_Color = __commonJS({
  "node_modules/tsparticles/Updaters/Color/index.js"(exports) {
    init_shims();
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.loadColorUpdater = void 0;
    var ColorUpdater_1 = require_ColorUpdater();
    async function loadColorUpdater(tsParticles) {
      await tsParticles.addParticleUpdater("color", (container) => new ColorUpdater_1.ColorUpdater(container));
    }
    exports.loadColorUpdater = loadColorUpdater;
  }
});

// node_modules/tsparticles/Interactions/Particles/Collisions/Collider.js
var require_Collider = __commonJS({
  "node_modules/tsparticles/Interactions/Particles/Collisions/Collider.js"(exports) {
    init_shims();
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.Collider = void 0;
    var Enums_1 = require_Enums();
    var Utils_1 = require_Utils2();
    var ParticlesInteractorBase_1 = require_ParticlesInteractorBase();
    function bounce(p1, p2) {
      (0, Utils_1.circleBounce)((0, Utils_1.circleBounceDataFromParticle)(p1), (0, Utils_1.circleBounceDataFromParticle)(p2));
    }
    function destroy(p1, p2) {
      if (!p1.unbreakable && !p2.unbreakable) {
        bounce(p1, p2);
      }
      if (p1.getRadius() === void 0 && p2.getRadius() !== void 0) {
        p1.destroy();
      } else if (p1.getRadius() !== void 0 && p2.getRadius() === void 0) {
        p2.destroy();
      } else if (p1.getRadius() !== void 0 && p2.getRadius() !== void 0) {
        if (p1.getRadius() >= p2.getRadius()) {
          p2.destroy();
        } else {
          p1.destroy();
        }
      }
    }
    var Collider = class extends ParticlesInteractorBase_1.ParticlesInteractorBase {
      constructor(container) {
        super(container);
      }
      isEnabled(particle) {
        return particle.options.collisions.enable;
      }
      reset() {
      }
      interact(p1) {
        const container = this.container;
        const pos1 = p1.getPosition();
        const radius1 = p1.getRadius();
        const query = container.particles.quadTree.queryCircle(pos1, radius1 * 2);
        for (const p2 of query) {
          if (p1 === p2 || !p2.options.collisions.enable || p1.options.collisions.mode !== p2.options.collisions.mode || p2.destroyed || p2.spawning) {
            continue;
          }
          const pos2 = p2.getPosition();
          if (Math.round(pos1.z) !== Math.round(pos2.z)) {
            continue;
          }
          const dist = (0, Utils_1.getDistance)(pos1, pos2);
          const radius2 = p2.getRadius();
          const distP = radius1 + radius2;
          if (dist <= distP) {
            this.resolveCollision(p1, p2);
          }
        }
      }
      resolveCollision(p1, p2) {
        switch (p1.options.collisions.mode) {
          case Enums_1.CollisionMode.absorb: {
            this.absorb(p1, p2);
            break;
          }
          case Enums_1.CollisionMode.bounce: {
            bounce(p1, p2);
            break;
          }
          case Enums_1.CollisionMode.destroy: {
            destroy(p1, p2);
            break;
          }
        }
      }
      absorb(p1, p2) {
        const container = this.container;
        const fps = container.fpsLimit / 1e3;
        if (p1.getRadius() === void 0 && p2.getRadius() !== void 0) {
          p1.destroy();
        } else if (p1.getRadius() !== void 0 && p2.getRadius() === void 0) {
          p2.destroy();
        } else if (p1.getRadius() !== void 0 && p2.getRadius() !== void 0) {
          if (p1.getRadius() >= p2.getRadius()) {
            const factor = (0, Utils_1.clamp)(p1.getRadius() / p2.getRadius(), 0, p2.getRadius()) * fps;
            p1.size.value += factor;
            p2.size.value -= factor;
            if (p2.getRadius() <= container.retina.pixelRatio) {
              p2.size.value = 0;
              p2.destroy();
            }
          } else {
            const factor = (0, Utils_1.clamp)(p2.getRadius() / p1.getRadius(), 0, p1.getRadius()) * fps;
            p1.size.value -= factor;
            p2.size.value += factor;
            if (p1.getRadius() <= container.retina.pixelRatio) {
              p1.size.value = 0;
              p1.destroy();
            }
          }
        }
      }
    };
    exports.Collider = Collider;
  }
});

// node_modules/tsparticles/Interactions/Particles/Collisions/index.js
var require_Collisions2 = __commonJS({
  "node_modules/tsparticles/Interactions/Particles/Collisions/index.js"(exports) {
    init_shims();
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.loadParticlesCollisionsInteraction = void 0;
    var Collider_1 = require_Collider();
    async function loadParticlesCollisionsInteraction(tsParticles) {
      await tsParticles.addInteractor("particlesCollisions", (container) => new Collider_1.Collider(container));
    }
    exports.loadParticlesCollisionsInteraction = loadParticlesCollisionsInteraction;
  }
});

// node_modules/tsparticles/Updaters/Angle/AngleUpdater.js
var require_AngleUpdater = __commonJS({
  "node_modules/tsparticles/Updaters/Angle/AngleUpdater.js"(exports) {
    init_shims();
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.AngleUpdater = void 0;
    var Enums_1 = require_Enums();
    var Utils_1 = require_Utils2();
    function updateAngle(particle, delta) {
      var _a;
      const rotate = particle.rotate;
      if (!rotate) {
        return;
      }
      const rotateOptions = particle.options.rotate;
      const rotateAnimation = rotateOptions.animation;
      const speed = ((_a = rotate.velocity) !== null && _a !== void 0 ? _a : 0) * delta.factor;
      const max = 2 * Math.PI;
      if (!rotateAnimation.enable) {
        return;
      }
      switch (rotate.status) {
        case Enums_1.AnimationStatus.increasing:
          rotate.value += speed;
          if (rotate.value > max) {
            rotate.value -= max;
          }
          break;
        case Enums_1.AnimationStatus.decreasing:
        default:
          rotate.value -= speed;
          if (rotate.value < 0) {
            rotate.value += max;
          }
          break;
      }
    }
    var AngleUpdater = class {
      constructor(container) {
        this.container = container;
      }
      init(particle) {
        const rotateOptions = particle.options.rotate;
        particle.rotate = {
          enable: rotateOptions.animation.enable,
          value: (0, Utils_1.getRangeValue)(rotateOptions.value) * Math.PI / 180
        };
        let rotateDirection = rotateOptions.direction;
        if (rotateDirection === Enums_1.RotateDirection.random) {
          const index = Math.floor(Math.random() * 2);
          rotateDirection = index > 0 ? Enums_1.RotateDirection.counterClockwise : Enums_1.RotateDirection.clockwise;
        }
        switch (rotateDirection) {
          case Enums_1.RotateDirection.counterClockwise:
          case "counterClockwise":
            particle.rotate.status = Enums_1.AnimationStatus.decreasing;
            break;
          case Enums_1.RotateDirection.clockwise:
            particle.rotate.status = Enums_1.AnimationStatus.increasing;
            break;
        }
        const rotateAnimation = particle.options.rotate.animation;
        if (rotateAnimation.enable) {
          particle.rotate.velocity = rotateAnimation.speed / 360 * this.container.retina.reduceFactor;
          if (!rotateAnimation.sync) {
            particle.rotate.velocity *= Math.random();
          }
        }
      }
      isEnabled(particle) {
        const rotate = particle.options.rotate;
        const rotateAnimation = rotate.animation;
        return !particle.destroyed && !particle.spawning && !rotate.path && rotateAnimation.enable;
      }
      update(particle, delta) {
        if (!this.isEnabled(particle)) {
          return;
        }
        updateAngle(particle, delta);
      }
    };
    exports.AngleUpdater = AngleUpdater;
  }
});

// node_modules/tsparticles/Updaters/Angle/index.js
var require_Angle = __commonJS({
  "node_modules/tsparticles/Updaters/Angle/index.js"(exports) {
    init_shims();
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.loadAngleUpdater = void 0;
    var AngleUpdater_1 = require_AngleUpdater();
    async function loadAngleUpdater(tsParticles) {
      await tsParticles.addParticleUpdater("angle", (container) => new AngleUpdater_1.AngleUpdater(container));
    }
    exports.loadAngleUpdater = loadAngleUpdater;
  }
});

// node_modules/tsparticles/Updaters/OutModes/Utils.js
var require_Utils4 = __commonJS({
  "node_modules/tsparticles/Updaters/OutModes/Utils.js"(exports) {
    init_shims();
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.bounceVertical = exports.bounceHorizontal = void 0;
    var Enums_1 = require_Enums();
    var Utils_1 = require_Utils2();
    function bounceHorizontal(data) {
      if (!(data.outMode === Enums_1.OutMode.bounce || data.outMode === Enums_1.OutMode.bounceHorizontal || data.outMode === "bounceHorizontal" || data.outMode === Enums_1.OutMode.split)) {
        return;
      }
      const velocity = data.particle.velocity.x;
      let bounced = false;
      if (data.direction === Enums_1.OutModeDirection.right && data.bounds.right >= data.canvasSize.width && velocity > 0 || data.direction === Enums_1.OutModeDirection.left && data.bounds.left <= 0 && velocity < 0) {
        const newVelocity = (0, Utils_1.getRangeValue)(data.particle.options.bounce.horizontal.value);
        data.particle.velocity.x *= -newVelocity;
        bounced = true;
      }
      if (!bounced) {
        return;
      }
      const minPos = data.offset.x + data.size;
      if (data.bounds.right >= data.canvasSize.width) {
        data.particle.position.x = data.canvasSize.width - minPos;
      } else if (data.bounds.left <= 0) {
        data.particle.position.x = minPos;
      }
      if (data.outMode === Enums_1.OutMode.split) {
        data.particle.destroy();
      }
    }
    exports.bounceHorizontal = bounceHorizontal;
    function bounceVertical(data) {
      if (data.outMode === Enums_1.OutMode.bounce || data.outMode === Enums_1.OutMode.bounceVertical || data.outMode === "bounceVertical" || data.outMode === Enums_1.OutMode.split) {
        const velocity = data.particle.velocity.y;
        let bounced = false;
        if (data.direction === Enums_1.OutModeDirection.bottom && data.bounds.bottom >= data.canvasSize.height && velocity > 0 || data.direction === Enums_1.OutModeDirection.top && data.bounds.top <= 0 && velocity < 0) {
          const newVelocity = (0, Utils_1.getRangeValue)(data.particle.options.bounce.vertical.value);
          data.particle.velocity.y *= -newVelocity;
          bounced = true;
        }
        if (!bounced) {
          return;
        }
        const minPos = data.offset.y + data.size;
        if (data.bounds.bottom >= data.canvasSize.height) {
          data.particle.position.y = data.canvasSize.height - minPos;
        } else if (data.bounds.top <= 0) {
          data.particle.position.y = minPos;
        }
        if (data.outMode === Enums_1.OutMode.split) {
          data.particle.destroy();
        }
      }
    }
    exports.bounceVertical = bounceVertical;
  }
});

// node_modules/tsparticles/Updaters/OutModes/OutOfCanvasUpdater.js
var require_OutOfCanvasUpdater = __commonJS({
  "node_modules/tsparticles/Updaters/OutModes/OutOfCanvasUpdater.js"(exports) {
    init_shims();
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.OutOfCanvasUpdater = void 0;
    var Utils_1 = require_Utils2();
    var Enums_1 = require_Enums();
    var Utils_2 = require_Utils4();
    var OutOfCanvasUpdater = class {
      constructor(container) {
        this.container = container;
      }
      init() {
      }
      isEnabled(particle) {
        return !particle.destroyed && !particle.spawning;
      }
      update(particle, delta) {
        var _a, _b, _c, _d;
        const outModes = particle.options.move.outModes;
        this.updateOutMode(particle, delta, (_a = outModes.bottom) !== null && _a !== void 0 ? _a : outModes.default, Enums_1.OutModeDirection.bottom);
        this.updateOutMode(particle, delta, (_b = outModes.left) !== null && _b !== void 0 ? _b : outModes.default, Enums_1.OutModeDirection.left);
        this.updateOutMode(particle, delta, (_c = outModes.right) !== null && _c !== void 0 ? _c : outModes.default, Enums_1.OutModeDirection.right);
        this.updateOutMode(particle, delta, (_d = outModes.top) !== null && _d !== void 0 ? _d : outModes.default, Enums_1.OutModeDirection.top);
      }
      updateOutMode(particle, delta, outMode, direction) {
        switch (outMode) {
          case Enums_1.OutMode.bounce:
          case Enums_1.OutMode.bounceVertical:
          case Enums_1.OutMode.bounceHorizontal:
          case "bounceVertical":
          case "bounceHorizontal":
          case Enums_1.OutMode.split:
            this.bounce(particle, delta, direction, outMode);
            break;
          case Enums_1.OutMode.destroy:
            this.destroy(particle, direction);
            break;
          case Enums_1.OutMode.out:
            this.out(particle, direction);
            break;
          case Enums_1.OutMode.none:
          default:
            this.none(particle, direction);
            break;
        }
      }
      destroy(particle, direction) {
        const container = this.container;
        if ((0, Utils_1.isPointInside)(particle.position, container.canvas.size, particle.getRadius(), direction)) {
          return;
        }
        container.particles.remove(particle, void 0, true);
      }
      out(particle, direction) {
        const container = this.container;
        if ((0, Utils_1.isPointInside)(particle.position, container.canvas.size, particle.getRadius(), direction)) {
          return;
        }
        const wrap = particle.options.move.warp, canvasSize = container.canvas.size, newPos = {
          bottom: canvasSize.height + particle.getRadius() + particle.offset.y,
          left: -particle.getRadius() - particle.offset.x,
          right: canvasSize.width + particle.getRadius() + particle.offset.x,
          top: -particle.getRadius() - particle.offset.y
        }, sizeValue = particle.getRadius(), nextBounds = (0, Utils_1.calculateBounds)(particle.position, sizeValue);
        if (direction === Enums_1.OutModeDirection.right && nextBounds.left > canvasSize.width + particle.offset.x) {
          particle.position.x = newPos.left;
          particle.initialPosition.x = particle.position.x;
          if (!wrap) {
            particle.position.y = Math.random() * canvasSize.height;
            particle.initialPosition.y = particle.position.y;
          }
        } else if (direction === Enums_1.OutModeDirection.left && nextBounds.right < -particle.offset.x) {
          particle.position.x = newPos.right;
          particle.initialPosition.x = particle.position.x;
          if (!wrap) {
            particle.position.y = Math.random() * canvasSize.height;
            particle.initialPosition.y = particle.position.y;
          }
        }
        if (direction === Enums_1.OutModeDirection.bottom && nextBounds.top > canvasSize.height + particle.offset.y) {
          if (!wrap) {
            particle.position.x = Math.random() * canvasSize.width;
            particle.initialPosition.x = particle.position.x;
          }
          particle.position.y = newPos.top;
          particle.initialPosition.y = particle.position.y;
        } else if (direction === Enums_1.OutModeDirection.top && nextBounds.bottom < -particle.offset.y) {
          if (!wrap) {
            particle.position.x = Math.random() * canvasSize.width;
            particle.initialPosition.x = particle.position.x;
          }
          particle.position.y = newPos.bottom;
          particle.initialPosition.y = particle.position.y;
        }
      }
      bounce(particle, delta, direction, outMode) {
        const container = this.container;
        let handled = false;
        for (const [, plugin] of container.plugins) {
          if (plugin.particleBounce !== void 0) {
            handled = plugin.particleBounce(particle, delta, direction);
          }
          if (handled) {
            break;
          }
        }
        if (handled) {
          return;
        }
        const pos = particle.getPosition(), offset = particle.offset, size = particle.getRadius(), bounds = (0, Utils_1.calculateBounds)(pos, size), canvasSize = container.canvas.size;
        (0, Utils_2.bounceHorizontal)({ particle, outMode, direction, bounds, canvasSize, offset, size });
        (0, Utils_2.bounceVertical)({ particle, outMode, direction, bounds, canvasSize, offset, size });
      }
      none(particle, direction) {
        if (particle.options.move.distance.horizontal && (direction === Enums_1.OutModeDirection.left || direction === Enums_1.OutModeDirection.right) || particle.options.move.distance.vertical && (direction === Enums_1.OutModeDirection.top || direction === Enums_1.OutModeDirection.bottom)) {
          return;
        }
        const gravityOptions = particle.options.move.gravity, container = this.container;
        const canvasSize = container.canvas.size;
        const pRadius = particle.getRadius();
        if (!gravityOptions.enable) {
          if (particle.velocity.y > 0 && particle.position.y <= canvasSize.height + pRadius || particle.velocity.y < 0 && particle.position.y >= -pRadius || particle.velocity.x > 0 && particle.position.x <= canvasSize.width + pRadius || particle.velocity.x < 0 && particle.position.x >= -pRadius) {
            return;
          }
          if (!(0, Utils_1.isPointInside)(particle.position, container.canvas.size, pRadius, direction)) {
            container.particles.remove(particle);
          }
        } else {
          const position = particle.position;
          if (!gravityOptions.inverse && position.y > canvasSize.height + pRadius && direction === Enums_1.OutModeDirection.bottom || gravityOptions.inverse && position.y < -pRadius && direction === Enums_1.OutModeDirection.top) {
            container.particles.remove(particle);
          }
        }
      }
    };
    exports.OutOfCanvasUpdater = OutOfCanvasUpdater;
  }
});

// node_modules/tsparticles/Updaters/OutModes/index.js
var require_OutModes2 = __commonJS({
  "node_modules/tsparticles/Updaters/OutModes/index.js"(exports) {
    init_shims();
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.loadOutModesUpdater = void 0;
    var OutOfCanvasUpdater_1 = require_OutOfCanvasUpdater();
    async function loadOutModesUpdater(tsParticles) {
      await tsParticles.addParticleUpdater("outModes", (container) => new OutOfCanvasUpdater_1.OutOfCanvasUpdater(container));
    }
    exports.loadOutModesUpdater = loadOutModesUpdater;
  }
});

// node_modules/tsparticles/Interactions/External/Repulse/Repulser.js
var require_Repulser = __commonJS({
  "node_modules/tsparticles/Interactions/External/Repulse/Repulser.js"(exports) {
    init_shims();
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.Repulser = void 0;
    var Enums_1 = require_Enums();
    var Utils_1 = require_Utils2();
    var Vector_1 = require_Vector();
    var ExternalInteractorBase_1 = require_ExternalInteractorBase();
    var Repulser = class extends ExternalInteractorBase_1.ExternalInteractorBase {
      constructor(container) {
        super(container);
      }
      isEnabled() {
        const container = this.container, options2 = container.actualOptions, mouse = container.interactivity.mouse, events = options2.interactivity.events, divs = events.onDiv, divRepulse = (0, Utils_1.isDivModeEnabled)(Enums_1.DivMode.repulse, divs);
        if (!(divRepulse || events.onHover.enable && mouse.position || events.onClick.enable && mouse.clickPosition)) {
          return false;
        }
        const hoverMode = events.onHover.mode, clickMode = events.onClick.mode;
        return (0, Utils_1.isInArray)(Enums_1.HoverMode.repulse, hoverMode) || (0, Utils_1.isInArray)(Enums_1.ClickMode.repulse, clickMode) || divRepulse;
      }
      reset() {
      }
      interact() {
        const container = this.container, options2 = container.actualOptions, mouseMoveStatus = container.interactivity.status === Utils_1.Constants.mouseMoveEvent, events = options2.interactivity.events, hoverEnabled = events.onHover.enable, hoverMode = events.onHover.mode, clickEnabled = events.onClick.enable, clickMode = events.onClick.mode, divs = events.onDiv;
        if (mouseMoveStatus && hoverEnabled && (0, Utils_1.isInArray)(Enums_1.HoverMode.repulse, hoverMode)) {
          this.hoverRepulse();
        } else if (clickEnabled && (0, Utils_1.isInArray)(Enums_1.ClickMode.repulse, clickMode)) {
          this.clickRepulse();
        } else {
          (0, Utils_1.divModeExecute)(Enums_1.DivMode.repulse, divs, (selector, div) => this.singleSelectorRepulse(selector, div));
        }
      }
      singleSelectorRepulse(selector, div) {
        const container = this.container, query = document.querySelectorAll(selector);
        if (!query.length) {
          return;
        }
        query.forEach((item) => {
          const elem = item, pxRatio = container.retina.pixelRatio, pos = {
            x: (elem.offsetLeft + elem.offsetWidth / 2) * pxRatio,
            y: (elem.offsetTop + elem.offsetHeight / 2) * pxRatio
          }, repulseRadius = elem.offsetWidth / 2 * pxRatio, area = div.type === Enums_1.DivType.circle ? new Utils_1.Circle(pos.x, pos.y, repulseRadius) : new Utils_1.Rectangle(elem.offsetLeft * pxRatio, elem.offsetTop * pxRatio, elem.offsetWidth * pxRatio, elem.offsetHeight * pxRatio), divs = container.actualOptions.interactivity.modes.repulse.divs, divRepulse = (0, Utils_1.divMode)(divs, elem);
          this.processRepulse(pos, repulseRadius, area, divRepulse);
        });
      }
      hoverRepulse() {
        const container = this.container, mousePos = container.interactivity.mouse.position;
        if (!mousePos) {
          return;
        }
        const repulseRadius = container.retina.repulseModeDistance;
        this.processRepulse(mousePos, repulseRadius, new Utils_1.Circle(mousePos.x, mousePos.y, repulseRadius));
      }
      processRepulse(position, repulseRadius, area, divRepulse) {
        var _a;
        const container = this.container, query = container.particles.quadTree.query(area), repulseOptions = container.actualOptions.interactivity.modes.repulse;
        for (const particle of query) {
          const { dx, dy, distance } = (0, Utils_1.getDistances)(particle.position, position), velocity = ((_a = divRepulse === null || divRepulse === void 0 ? void 0 : divRepulse.speed) !== null && _a !== void 0 ? _a : repulseOptions.speed) * repulseOptions.factor, repulseFactor = (0, Utils_1.clamp)((0, Utils_1.calcEasing)(1 - distance / repulseRadius, repulseOptions.easing) * velocity, 0, repulseOptions.maxSpeed), normVec = Vector_1.Vector.create(distance === 0 ? velocity : dx / distance * repulseFactor, distance === 0 ? velocity : dy / distance * repulseFactor);
          particle.position.addTo(normVec);
        }
      }
      clickRepulse() {
        const container = this.container;
        if (!container.repulse.finish) {
          if (!container.repulse.count) {
            container.repulse.count = 0;
          }
          container.repulse.count++;
          if (container.repulse.count === container.particles.count) {
            container.repulse.finish = true;
          }
        }
        if (container.repulse.clicking) {
          const repulseDistance = container.retina.repulseModeDistance, repulseRadius = Math.pow(repulseDistance / 6, 3), mouseClickPos = container.interactivity.mouse.clickPosition;
          if (mouseClickPos === void 0) {
            return;
          }
          const range = new Utils_1.Circle(mouseClickPos.x, mouseClickPos.y, repulseRadius), query = container.particles.quadTree.query(range);
          for (const particle of query) {
            const { dx, dy, distance } = (0, Utils_1.getDistances)(mouseClickPos, particle.position), d = distance ** 2, velocity = container.actualOptions.interactivity.modes.repulse.speed, force = -repulseRadius * velocity / d;
            if (d <= repulseRadius) {
              container.repulse.particles.push(particle);
              const vect = Vector_1.Vector.create(dx, dy);
              vect.length = force;
              particle.velocity.setTo(vect);
            }
          }
        } else if (container.repulse.clicking === false) {
          for (const particle of container.repulse.particles) {
            particle.velocity.setTo(particle.initialVelocity);
          }
          container.repulse.particles = [];
        }
      }
    };
    exports.Repulser = Repulser;
  }
});

// node_modules/tsparticles/Interactions/External/Repulse/index.js
var require_Repulse3 = __commonJS({
  "node_modules/tsparticles/Interactions/External/Repulse/index.js"(exports) {
    init_shims();
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.loadExternalRepulseInteraction = void 0;
    var Repulser_1 = require_Repulser();
    async function loadExternalRepulseInteraction(tsParticles) {
      await tsParticles.addInteractor("externalRepulse", (container) => new Repulser_1.Repulser(container));
    }
    exports.loadExternalRepulseInteraction = loadExternalRepulseInteraction;
  }
});

// node_modules/tsparticles/Shapes/Line/LineDrawer.js
var require_LineDrawer = __commonJS({
  "node_modules/tsparticles/Shapes/Line/LineDrawer.js"(exports) {
    init_shims();
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.LineDrawer = void 0;
    var LineDrawer = class {
      getSidesCount() {
        return 1;
      }
      draw(context, particle, radius) {
        context.moveTo(-radius / 2, 0);
        context.lineTo(radius / 2, 0);
      }
    };
    exports.LineDrawer = LineDrawer;
  }
});

// node_modules/tsparticles/Shapes/Line/index.js
var require_Line = __commonJS({
  "node_modules/tsparticles/Shapes/Line/index.js"(exports) {
    init_shims();
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.loadLineShape = void 0;
    var LineDrawer_1 = require_LineDrawer();
    async function loadLineShape(tsParticles) {
      await tsParticles.addShape("line", new LineDrawer_1.LineDrawer());
    }
    exports.loadLineShape = loadLineShape;
  }
});

// node_modules/tsparticles/Interactions/External/Bounce/Bouncer.js
var require_Bouncer = __commonJS({
  "node_modules/tsparticles/Interactions/External/Bounce/Bouncer.js"(exports) {
    init_shims();
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.Bouncer = void 0;
    var Utils_1 = require_Utils2();
    var Enums_1 = require_Enums();
    var Vector_1 = require_Vector();
    var ExternalInteractorBase_1 = require_ExternalInteractorBase();
    var Bouncer = class extends ExternalInteractorBase_1.ExternalInteractorBase {
      constructor(container) {
        super(container);
      }
      isEnabled() {
        const container = this.container, options2 = container.actualOptions, mouse = container.interactivity.mouse, events = options2.interactivity.events, divs = events.onDiv;
        return mouse.position && events.onHover.enable && (0, Utils_1.isInArray)(Enums_1.HoverMode.bounce, events.onHover.mode) || (0, Utils_1.isDivModeEnabled)(Enums_1.DivMode.bounce, divs);
      }
      interact() {
        const container = this.container, options2 = container.actualOptions, events = options2.interactivity.events, mouseMoveStatus = container.interactivity.status === Utils_1.Constants.mouseMoveEvent, hoverEnabled = events.onHover.enable, hoverMode = events.onHover.mode, divs = events.onDiv;
        if (mouseMoveStatus && hoverEnabled && (0, Utils_1.isInArray)(Enums_1.HoverMode.bounce, hoverMode)) {
          this.processMouseBounce();
        } else {
          (0, Utils_1.divModeExecute)(Enums_1.DivMode.bounce, divs, (selector, div) => this.singleSelectorBounce(selector, div));
        }
      }
      reset() {
      }
      processMouseBounce() {
        const container = this.container, pxRatio = container.retina.pixelRatio, tolerance = 10 * pxRatio, mousePos = container.interactivity.mouse.position, radius = container.retina.bounceModeDistance;
        if (mousePos) {
          this.processBounce(mousePos, radius, new Utils_1.Circle(mousePos.x, mousePos.y, radius + tolerance));
        }
      }
      singleSelectorBounce(selector, div) {
        const container = this.container;
        const query = document.querySelectorAll(selector);
        if (!query.length) {
          return;
        }
        query.forEach((item) => {
          const elem = item, pxRatio = container.retina.pixelRatio, pos = {
            x: (elem.offsetLeft + elem.offsetWidth / 2) * pxRatio,
            y: (elem.offsetTop + elem.offsetHeight / 2) * pxRatio
          }, radius = elem.offsetWidth / 2 * pxRatio, tolerance = 10 * pxRatio;
          const area = div.type === Enums_1.DivType.circle ? new Utils_1.Circle(pos.x, pos.y, radius + tolerance) : new Utils_1.Rectangle(elem.offsetLeft * pxRatio - tolerance, elem.offsetTop * pxRatio - tolerance, elem.offsetWidth * pxRatio + tolerance * 2, elem.offsetHeight * pxRatio + tolerance * 2);
          this.processBounce(pos, radius, area);
        });
      }
      processBounce(position, radius, area) {
        const query = this.container.particles.quadTree.query(area);
        for (const particle of query) {
          if (area instanceof Utils_1.Circle) {
            (0, Utils_1.circleBounce)((0, Utils_1.circleBounceDataFromParticle)(particle), {
              position,
              radius,
              mass: radius ** 2 * Math.PI / 2,
              velocity: Vector_1.Vector.origin,
              factor: Vector_1.Vector.origin
            });
          } else if (area instanceof Utils_1.Rectangle) {
            (0, Utils_1.rectBounce)(particle, (0, Utils_1.calculateBounds)(position, radius));
          }
        }
      }
    };
    exports.Bouncer = Bouncer;
  }
});

// node_modules/tsparticles/Interactions/External/Bounce/index.js
var require_Bounce3 = __commonJS({
  "node_modules/tsparticles/Interactions/External/Bounce/index.js"(exports) {
    init_shims();
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.loadExternalBounceInteraction = void 0;
    var Bouncer_1 = require_Bouncer();
    async function loadExternalBounceInteraction(tsParticles) {
      await tsParticles.addInteractor("externalBounce", (container) => new Bouncer_1.Bouncer(container));
    }
    exports.loadExternalBounceInteraction = loadExternalBounceInteraction;
  }
});

// node_modules/tsparticles/Shapes/Text/TextDrawer.js
var require_TextDrawer = __commonJS({
  "node_modules/tsparticles/Shapes/Text/TextDrawer.js"(exports) {
    init_shims();
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.TextDrawer = exports.validTypes = void 0;
    var Utils_1 = require_Utils2();
    exports.validTypes = ["text", "character", "char"];
    var TextDrawer = class {
      getSidesCount() {
        return 12;
      }
      async init(container) {
        const options2 = container.actualOptions;
        if (exports.validTypes.find((t) => (0, Utils_1.isInArray)(t, options2.particles.shape.type))) {
          const shapeOptions = exports.validTypes.map((t) => options2.particles.shape.options[t]).find((t) => !!t);
          if (shapeOptions instanceof Array) {
            const promises = [];
            for (const character of shapeOptions) {
              promises.push((0, Utils_1.loadFont)(character));
            }
            await Promise.allSettled(promises);
          } else {
            if (shapeOptions !== void 0) {
              await (0, Utils_1.loadFont)(shapeOptions);
            }
          }
        }
      }
      draw(context, particle, radius, opacity) {
        var _a, _b, _c;
        const character = particle.shapeData;
        if (character === void 0) {
          return;
        }
        const textData = character.value;
        if (textData === void 0) {
          return;
        }
        const textParticle = particle;
        if (textParticle.text === void 0) {
          textParticle.text = textData instanceof Array ? (0, Utils_1.itemFromArray)(textData, particle.randomIndexData) : textData;
        }
        const text = textParticle.text;
        const style = (_a = character.style) !== null && _a !== void 0 ? _a : "";
        const weight = (_b = character.weight) !== null && _b !== void 0 ? _b : "400";
        const size = Math.round(radius) * 2;
        const font = (_c = character.font) !== null && _c !== void 0 ? _c : "Verdana";
        const fill = particle.fill;
        const offsetX = text.length * radius / 2;
        context.font = `${style} ${weight} ${size}px "${font}"`;
        const pos = {
          x: -offsetX,
          y: radius / 2
        };
        context.globalAlpha = opacity;
        if (fill) {
          context.fillText(text, pos.x, pos.y);
        } else {
          context.strokeText(text, pos.x, pos.y);
        }
        context.globalAlpha = 1;
      }
    };
    exports.TextDrawer = TextDrawer;
  }
});

// node_modules/tsparticles/Shapes/Text/index.js
var require_Text = __commonJS({
  "node_modules/tsparticles/Shapes/Text/index.js"(exports) {
    init_shims();
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.loadTextShape = void 0;
    var TextDrawer_1 = require_TextDrawer();
    async function loadTextShape(tsParticles) {
      const drawer = new TextDrawer_1.TextDrawer();
      for (const type of TextDrawer_1.validTypes) {
        await tsParticles.addShape(type, drawer);
      }
    }
    exports.loadTextShape = loadTextShape;
  }
});

// node_modules/tsparticles/Interactions/Particles/Links/Linker.js
var require_Linker = __commonJS({
  "node_modules/tsparticles/Interactions/Particles/Links/Linker.js"(exports) {
    init_shims();
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.Linker = void 0;
    var Utils_1 = require_Utils2();
    var ParticlesInteractorBase_1 = require_ParticlesInteractorBase();
    function getLinkDistance(pos1, pos2, optDistance, canvasSize, warp) {
      let distance = (0, Utils_1.getDistance)(pos1, pos2);
      if (!warp || distance <= optDistance) {
        return distance;
      }
      const pos2NE = {
        x: pos2.x - canvasSize.width,
        y: pos2.y
      };
      distance = (0, Utils_1.getDistance)(pos1, pos2NE);
      if (distance <= optDistance) {
        return distance;
      }
      const pos2SE = {
        x: pos2.x - canvasSize.width,
        y: pos2.y - canvasSize.height
      };
      distance = (0, Utils_1.getDistance)(pos1, pos2SE);
      if (distance <= optDistance) {
        return distance;
      }
      const pos2SW = {
        x: pos2.x,
        y: pos2.y - canvasSize.height
      };
      distance = (0, Utils_1.getDistance)(pos1, pos2SW);
      return distance;
    }
    var Linker = class extends ParticlesInteractorBase_1.ParticlesInteractorBase {
      constructor(container) {
        super(container);
      }
      isEnabled(particle) {
        return particle.options.links.enable;
      }
      reset() {
      }
      interact(p1) {
        var _a;
        p1.links = [];
        const pos1 = p1.getPosition();
        const container = this.container;
        const canvasSize = container.canvas.size;
        if (pos1.x < 0 || pos1.y < 0 || pos1.x > canvasSize.width || pos1.y > canvasSize.height) {
          return;
        }
        const linkOpt1 = p1.options.links;
        const optOpacity = linkOpt1.opacity;
        const optDistance = (_a = p1.retina.linksDistance) !== null && _a !== void 0 ? _a : container.retina.linksDistance;
        const warp = linkOpt1.warp;
        const range = warp ? new Utils_1.CircleWarp(pos1.x, pos1.y, optDistance, canvasSize) : new Utils_1.Circle(pos1.x, pos1.y, optDistance);
        const query = container.particles.quadTree.query(range);
        for (const p2 of query) {
          const linkOpt2 = p2.options.links;
          if (p1 === p2 || !linkOpt2.enable || linkOpt1.id !== linkOpt2.id || p2.spawning || p2.destroyed || p1.links.map((t) => t.destination).indexOf(p2) !== -1 || p2.links.map((t) => t.destination).indexOf(p1) !== -1) {
            continue;
          }
          const pos2 = p2.getPosition();
          if (pos2.x < 0 || pos2.y < 0 || pos2.x > canvasSize.width || pos2.y > canvasSize.height) {
            continue;
          }
          const distance = getLinkDistance(pos1, pos2, optDistance, canvasSize, warp && linkOpt2.warp);
          if (distance > optDistance) {
            return;
          }
          const opacityLine = (1 - distance / optDistance) * optOpacity;
          this.setColor(p1);
          p1.links.push({
            destination: p2,
            opacity: opacityLine
          });
        }
      }
      setColor(p1) {
        const container = this.container;
        const linksOptions = p1.options.links;
        let linkColor = linksOptions.id === void 0 ? container.particles.linksColor : container.particles.linksColors.get(linksOptions.id);
        if (!linkColor) {
          const optColor = linksOptions.color;
          linkColor = (0, Utils_1.getLinkRandomColor)(optColor, linksOptions.blink, linksOptions.consent);
          if (linksOptions.id === void 0) {
            container.particles.linksColor = linkColor;
          } else {
            container.particles.linksColors.set(linksOptions.id, linkColor);
          }
        }
      }
    };
    exports.Linker = Linker;
  }
});

// node_modules/tsparticles/Interactions/Particles/Links/LinkInstance.js
var require_LinkInstance = __commonJS({
  "node_modules/tsparticles/Interactions/Particles/Links/LinkInstance.js"(exports) {
    init_shims();
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.LinkInstance = void 0;
    var Utils_1 = require_Utils2();
    var LinkInstance = class {
      constructor(container) {
        this.container = container;
      }
      particleCreated(particle) {
        const linkParticle = particle;
        linkParticle.links = [];
      }
      particleDestroyed(particle) {
        const linkParticle = particle;
        linkParticle.links = [];
      }
      drawParticle(context, particle) {
        const linkParticle = particle;
        const container = this.container;
        const particles = container.particles;
        const pOptions = particle.options;
        if (linkParticle.links.length > 0) {
          context.save();
          const p1Links = linkParticle.links.filter((l) => {
            const linkFreq = container.particles.getLinkFrequency(linkParticle, l.destination);
            return linkFreq <= pOptions.links.frequency;
          });
          for (const link of p1Links) {
            const p2 = link.destination;
            if (pOptions.links.triangles.enable) {
              const links = p1Links.map((l) => l.destination);
              const vertices = p2.links.filter((t) => {
                const linkFreq = container.particles.getLinkFrequency(p2, t.destination);
                return linkFreq <= p2.options.links.frequency && links.indexOf(t.destination) >= 0;
              });
              if (vertices.length) {
                for (const vertex of vertices) {
                  const p3 = vertex.destination;
                  const triangleFreq = particles.getTriangleFrequency(linkParticle, p2, p3);
                  if (triangleFreq > pOptions.links.triangles.frequency) {
                    continue;
                  }
                  this.drawLinkTriangle(linkParticle, link, vertex);
                }
              }
            }
            if (link.opacity > 0 && container.retina.linksWidth > 0) {
              this.drawLinkLine(linkParticle, link);
            }
          }
          context.restore();
        }
      }
      drawLinkTriangle(p1, link1, link2) {
        var _a;
        const container = this.container;
        const options2 = container.actualOptions;
        const p2 = link1.destination;
        const p3 = link2.destination;
        const triangleOptions = p1.options.links.triangles;
        const opacityTriangle = (_a = triangleOptions.opacity) !== null && _a !== void 0 ? _a : (link1.opacity + link2.opacity) / 2;
        if (opacityTriangle <= 0) {
          return;
        }
        const pos1 = p1.getPosition();
        const pos2 = p2.getPosition();
        const pos3 = p3.getPosition();
        container.canvas.draw((ctx) => {
          if ((0, Utils_1.getDistance)(pos1, pos2) > container.retina.linksDistance || (0, Utils_1.getDistance)(pos3, pos2) > container.retina.linksDistance || (0, Utils_1.getDistance)(pos3, pos1) > container.retina.linksDistance) {
            return;
          }
          let colorTriangle = (0, Utils_1.colorToRgb)(triangleOptions.color);
          if (!colorTriangle) {
            const linksOptions = p1.options.links;
            const linkColor = linksOptions.id !== void 0 ? container.particles.linksColors.get(linksOptions.id) : container.particles.linksColor;
            colorTriangle = (0, Utils_1.getLinkColor)(p1, p2, linkColor);
          }
          if (!colorTriangle) {
            return;
          }
          (0, Utils_1.drawLinkTriangle)(ctx, pos1, pos2, pos3, options2.backgroundMask.enable, options2.backgroundMask.composite, colorTriangle, opacityTriangle);
        });
      }
      drawLinkLine(p1, link) {
        const container = this.container;
        const options2 = container.actualOptions;
        const p2 = link.destination;
        let opacity = link.opacity;
        const pos1 = p1.getPosition();
        const pos2 = p2.getPosition();
        container.canvas.draw((ctx) => {
          var _a, _b;
          let colorLine;
          const twinkle = p1.options.twinkle.lines;
          if (twinkle.enable) {
            const twinkleFreq = twinkle.frequency;
            const twinkleRgb = (0, Utils_1.colorToRgb)(twinkle.color);
            const twinkling = Math.random() < twinkleFreq;
            if (twinkling && twinkleRgb !== void 0) {
              colorLine = twinkleRgb;
              opacity = twinkle.opacity;
            }
          }
          if (!colorLine) {
            const linksOptions = p1.options.links;
            const linkColor = linksOptions.id !== void 0 ? container.particles.linksColors.get(linksOptions.id) : container.particles.linksColor;
            colorLine = (0, Utils_1.getLinkColor)(p1, p2, linkColor);
          }
          if (!colorLine) {
            return;
          }
          const width = (_a = p1.retina.linksWidth) !== null && _a !== void 0 ? _a : container.retina.linksWidth;
          const maxDistance = (_b = p1.retina.linksDistance) !== null && _b !== void 0 ? _b : container.retina.linksDistance;
          (0, Utils_1.drawLinkLine)(ctx, width, pos1, pos2, maxDistance, container.canvas.size, p1.options.links.warp, options2.backgroundMask.enable, options2.backgroundMask.composite, colorLine, opacity, p1.options.links.shadow);
        });
      }
    };
    exports.LinkInstance = LinkInstance;
  }
});

// node_modules/tsparticles/Interactions/Particles/Links/plugin.js
var require_plugin = __commonJS({
  "node_modules/tsparticles/Interactions/Particles/Links/plugin.js"(exports) {
    init_shims();
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.loadPlugin = void 0;
    var LinkInstance_1 = require_LinkInstance();
    var Plugin = class {
      constructor() {
        this.id = "links";
      }
      getPlugin(container) {
        return new LinkInstance_1.LinkInstance(container);
      }
      needsPlugin() {
        return true;
      }
      loadOptions() {
      }
    };
    async function loadPlugin(tsParticles) {
      const plugin = new Plugin();
      await tsParticles.addPlugin(plugin);
    }
    exports.loadPlugin = loadPlugin;
  }
});

// node_modules/tsparticles/Interactions/Particles/Links/index.js
var require_Links2 = __commonJS({
  "node_modules/tsparticles/Interactions/Particles/Links/index.js"(exports) {
    init_shims();
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.loadParticlesLinksInteraction = exports.loadInteraction = void 0;
    var Linker_1 = require_Linker();
    var plugin_1 = require_plugin();
    async function loadInteraction(tsParticles) {
      await tsParticles.addInteractor("particlesLinks", (container) => new Linker_1.Linker(container));
    }
    exports.loadInteraction = loadInteraction;
    async function loadParticlesLinksInteraction(tsParticles) {
      await loadInteraction(tsParticles);
      await (0, plugin_1.loadPlugin)(tsParticles);
    }
    exports.loadParticlesLinksInteraction = loadParticlesLinksInteraction;
  }
});

// node_modules/tsparticles/Updaters/Size/SizeUpdater.js
var require_SizeUpdater = __commonJS({
  "node_modules/tsparticles/Updaters/Size/SizeUpdater.js"(exports) {
    init_shims();
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.SizeUpdater = void 0;
    var Enums_1 = require_Enums();
    var Utils_1 = require_Utils2();
    function checkDestroy(particle, value, minValue, maxValue) {
      switch (particle.options.size.animation.destroy) {
        case Enums_1.DestroyType.max:
          if (value >= maxValue) {
            particle.destroy();
          }
          break;
        case Enums_1.DestroyType.min:
          if (value <= minValue) {
            particle.destroy();
          }
          break;
      }
    }
    function updateSize(particle, delta) {
      var _a, _b, _c, _d;
      const sizeVelocity = ((_a = particle.size.velocity) !== null && _a !== void 0 ? _a : 0) * delta.factor;
      const minValue = particle.size.min;
      const maxValue = particle.size.max;
      if (!(!particle.destroyed && particle.size.enable && (((_b = particle.size.loops) !== null && _b !== void 0 ? _b : 0) <= 0 || ((_c = particle.size.loops) !== null && _c !== void 0 ? _c : 0) < ((_d = particle.size.maxLoops) !== null && _d !== void 0 ? _d : 0)))) {
        return;
      }
      switch (particle.size.status) {
        case Enums_1.AnimationStatus.increasing:
          if (particle.size.value >= maxValue) {
            particle.size.status = Enums_1.AnimationStatus.decreasing;
            if (!particle.size.loops) {
              particle.size.loops = 0;
            }
            particle.size.loops++;
          } else {
            particle.size.value += sizeVelocity;
          }
          break;
        case Enums_1.AnimationStatus.decreasing:
          if (particle.size.value <= minValue) {
            particle.size.status = Enums_1.AnimationStatus.increasing;
            if (!particle.size.loops) {
              particle.size.loops = 0;
            }
            particle.size.loops++;
          } else {
            particle.size.value -= sizeVelocity;
          }
      }
      checkDestroy(particle, particle.size.value, minValue, maxValue);
      if (!particle.destroyed) {
        particle.size.value = (0, Utils_1.clamp)(particle.size.value, minValue, maxValue);
      }
    }
    var SizeUpdater = class {
      init() {
      }
      isEnabled(particle) {
        var _a, _b, _c;
        return !particle.destroyed && !particle.spawning && particle.size.enable && (((_a = particle.size.loops) !== null && _a !== void 0 ? _a : 0) <= 0 || ((_b = particle.size.loops) !== null && _b !== void 0 ? _b : 0) < ((_c = particle.size.maxLoops) !== null && _c !== void 0 ? _c : 0));
      }
      update(particle, delta) {
        if (!this.isEnabled(particle)) {
          return;
        }
        updateSize(particle, delta);
      }
    };
    exports.SizeUpdater = SizeUpdater;
  }
});

// node_modules/tsparticles/Updaters/Size/index.js
var require_Size2 = __commonJS({
  "node_modules/tsparticles/Updaters/Size/index.js"(exports) {
    init_shims();
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.loadSizeUpdater = void 0;
    var SizeUpdater_1 = require_SizeUpdater();
    async function loadSizeUpdater(tsParticles) {
      await tsParticles.addParticleUpdater("size", () => new SizeUpdater_1.SizeUpdater());
    }
    exports.loadSizeUpdater = loadSizeUpdater;
  }
});

// node_modules/tsparticles/slim.js
var require_slim = __commonJS({
  "node_modules/tsparticles/slim.js"(exports) {
    init_shims();
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.loadSlim = void 0;
    var Circle_1 = require_Circle2();
    var Life_1 = require_Life2();
    var Connect_1 = require_Connect2();
    var Opacity_1 = require_Opacity2();
    var Image_1 = require_Image();
    var Polygon_1 = require_Polygon();
    var Bubble_1 = require_Bubble2();
    var Attract_1 = require_Attract3();
    var Grab_1 = require_Grab2();
    var Star_1 = require_Star();
    var Attract_2 = require_Attract4();
    var Square_1 = require_Square();
    var StrokeColor_1 = require_StrokeColor();
    var Color_1 = require_Color();
    var Collisions_1 = require_Collisions2();
    var Angle_1 = require_Angle();
    var OutModes_1 = require_OutModes2();
    var Repulse_1 = require_Repulse3();
    var Line_1 = require_Line();
    var Bounce_1 = require_Bounce3();
    var Text_1 = require_Text();
    var Links_1 = require_Links2();
    var Size_1 = require_Size2();
    async function loadSlim(tsParticles) {
      await (0, Attract_1.loadExternalAttractInteraction)(tsParticles);
      await (0, Bounce_1.loadExternalBounceInteraction)(tsParticles);
      await (0, Bubble_1.loadExternalBubbleInteraction)(tsParticles);
      await (0, Connect_1.loadExternalConnectInteraction)(tsParticles);
      await (0, Grab_1.loadExternalGrabInteraction)(tsParticles);
      await (0, Repulse_1.loadExternalRepulseInteraction)(tsParticles);
      await (0, Attract_2.loadParticlesAttractInteraction)(tsParticles);
      await (0, Collisions_1.loadParticlesCollisionsInteraction)(tsParticles);
      await (0, Links_1.loadParticlesLinksInteraction)(tsParticles);
      await (0, Circle_1.loadCircleShape)(tsParticles);
      await (0, Image_1.loadImageShape)(tsParticles);
      await (0, Line_1.loadLineShape)(tsParticles);
      await (0, Polygon_1.loadPolygonShape)(tsParticles);
      await (0, Square_1.loadSquareShape)(tsParticles);
      await (0, Star_1.loadStarShape)(tsParticles);
      await (0, Text_1.loadTextShape)(tsParticles);
      await (0, Life_1.loadLifeUpdater)(tsParticles);
      await (0, Opacity_1.loadOpacityUpdater)(tsParticles);
      await (0, Size_1.loadSizeUpdater)(tsParticles);
      await (0, Angle_1.loadAngleUpdater)(tsParticles);
      await (0, Color_1.loadColorUpdater)(tsParticles);
      await (0, StrokeColor_1.loadStrokeColorUpdater)(tsParticles);
      await (0, OutModes_1.loadOutModesUpdater)(tsParticles);
    }
    exports.loadSlim = loadSlim;
  }
});

// node_modules/tsparticles/Interactions/External/Trail/TrailMaker.js
var require_TrailMaker = __commonJS({
  "node_modules/tsparticles/Interactions/External/Trail/TrailMaker.js"(exports) {
    init_shims();
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.TrailMaker = void 0;
    var Utils_1 = require_Utils2();
    var Enums_1 = require_Enums();
    var ExternalInteractorBase_1 = require_ExternalInteractorBase();
    var TrailMaker = class extends ExternalInteractorBase_1.ExternalInteractorBase {
      constructor(container) {
        super(container);
        this.delay = 0;
      }
      interact(delta) {
        var _a, _b, _c, _d;
        if (!this.container.retina.reduceFactor) {
          return;
        }
        const container = this.container, options2 = container.actualOptions, trailOptions = options2.interactivity.modes.trail, optDelay = trailOptions.delay * 1e3 / this.container.retina.reduceFactor;
        if (this.delay < optDelay) {
          this.delay += delta.value;
        }
        if (this.delay < optDelay) {
          return;
        }
        let canEmit = true;
        if (trailOptions.pauseOnStop) {
          if (container.interactivity.mouse.position === this.lastPosition || ((_a = container.interactivity.mouse.position) === null || _a === void 0 ? void 0 : _a.x) === ((_b = this.lastPosition) === null || _b === void 0 ? void 0 : _b.x) && ((_c = container.interactivity.mouse.position) === null || _c === void 0 ? void 0 : _c.y) === ((_d = this.lastPosition) === null || _d === void 0 ? void 0 : _d.y)) {
            canEmit = false;
          }
        }
        if (container.interactivity.mouse.position) {
          this.lastPosition = {
            x: container.interactivity.mouse.position.x,
            y: container.interactivity.mouse.position.y
          };
        } else {
          delete this.lastPosition;
        }
        if (canEmit) {
          container.particles.push(trailOptions.quantity, container.interactivity.mouse, trailOptions.particles);
        }
        this.delay -= optDelay;
      }
      isEnabled() {
        const container = this.container, options2 = container.actualOptions, mouse = container.interactivity.mouse, events = options2.interactivity.events;
        return mouse.clicking && mouse.inside && !!mouse.position && (0, Utils_1.isInArray)(Enums_1.ClickMode.trail, events.onClick.mode) || mouse.inside && !!mouse.position && (0, Utils_1.isInArray)(Enums_1.HoverMode.trail, events.onHover.mode);
      }
      reset() {
      }
    };
    exports.TrailMaker = TrailMaker;
  }
});

// node_modules/tsparticles/Interactions/External/Trail/index.js
var require_Trail3 = __commonJS({
  "node_modules/tsparticles/Interactions/External/Trail/index.js"(exports) {
    init_shims();
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.loadExternalTrailInteraction = void 0;
    var TrailMaker_1 = require_TrailMaker();
    async function loadExternalTrailInteraction(tsParticles) {
      await tsParticles.addInteractor("externalTrail", (container) => new TrailMaker_1.TrailMaker(container));
    }
    exports.loadExternalTrailInteraction = loadExternalTrailInteraction;
  }
});

// node_modules/tsparticles/Updaters/Tilt/TiltUpdater.js
var require_TiltUpdater = __commonJS({
  "node_modules/tsparticles/Updaters/Tilt/TiltUpdater.js"(exports) {
    init_shims();
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.TiltUpdater = void 0;
    var Enums_1 = require_Enums();
    var Utils_1 = require_Utils2();
    function updateTilt(particle, delta) {
      var _a;
      if (!particle.tilt) {
        return;
      }
      const tilt = particle.options.tilt;
      const tiltAnimation = tilt.animation;
      const speed = ((_a = particle.tilt.velocity) !== null && _a !== void 0 ? _a : 0) * delta.factor;
      const max = 2 * Math.PI;
      if (!tiltAnimation.enable) {
        return;
      }
      switch (particle.tilt.status) {
        case Enums_1.AnimationStatus.increasing:
          particle.tilt.value += speed;
          if (particle.tilt.value > max) {
            particle.tilt.value -= max;
          }
          break;
        case Enums_1.AnimationStatus.decreasing:
        default:
          particle.tilt.value -= speed;
          if (particle.tilt.value < 0) {
            particle.tilt.value += max;
          }
          break;
      }
    }
    var TiltUpdater = class {
      constructor(container) {
        this.container = container;
      }
      init(particle) {
        const tiltOptions = particle.options.tilt;
        particle.tilt = {
          enable: tiltOptions.enable,
          value: (0, Utils_1.getRangeValue)(tiltOptions.value) * Math.PI / 180,
          sinDirection: Math.random() >= 0.5 ? 1 : -1,
          cosDirection: Math.random() >= 0.5 ? 1 : -1
        };
        let tiltDirection = tiltOptions.direction;
        if (tiltDirection === Enums_1.TiltDirection.random) {
          const index = Math.floor(Math.random() * 2);
          tiltDirection = index > 0 ? Enums_1.TiltDirection.counterClockwise : Enums_1.TiltDirection.clockwise;
        }
        switch (tiltDirection) {
          case Enums_1.TiltDirection.counterClockwise:
          case "counterClockwise":
            particle.tilt.status = Enums_1.AnimationStatus.decreasing;
            break;
          case Enums_1.TiltDirection.clockwise:
            particle.tilt.status = Enums_1.AnimationStatus.increasing;
            break;
        }
        const tiltAnimation = particle.options.tilt.animation;
        if (tiltAnimation.enable) {
          particle.tilt.velocity = tiltAnimation.speed / 360 * this.container.retina.reduceFactor;
          if (!tiltAnimation.sync) {
            particle.tilt.velocity *= Math.random();
          }
        }
      }
      isEnabled(particle) {
        const tilt = particle.options.tilt;
        const tiltAnimation = tilt.animation;
        return !particle.destroyed && !particle.spawning && tiltAnimation.enable;
      }
      update(particle, delta) {
        if (!this.isEnabled(particle)) {
          return;
        }
        updateTilt(particle, delta);
      }
    };
    exports.TiltUpdater = TiltUpdater;
  }
});

// node_modules/tsparticles/Updaters/Tilt/index.js
var require_Tilt2 = __commonJS({
  "node_modules/tsparticles/Updaters/Tilt/index.js"(exports) {
    init_shims();
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.loadTiltUpdater = void 0;
    var TiltUpdater_1 = require_TiltUpdater();
    async function loadTiltUpdater(tsParticles) {
      await tsParticles.addParticleUpdater("tilt", (container) => new TiltUpdater_1.TiltUpdater(container));
    }
    exports.loadTiltUpdater = loadTiltUpdater;
  }
});

// node_modules/tsparticles/Updaters/Wobble/WobbleUpdater.js
var require_WobbleUpdater = __commonJS({
  "node_modules/tsparticles/Updaters/Wobble/WobbleUpdater.js"(exports) {
    init_shims();
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.WobbleUpdater = void 0;
    var Utils_1 = require_Utils2();
    function updateWobble(particle, delta) {
      var _a;
      const wobble = particle.options.wobble;
      if (!wobble.enable || !particle.wobble) {
        return;
      }
      const speed = particle.wobble.speed * delta.factor;
      const distance = ((_a = particle.retina.wobbleDistance) !== null && _a !== void 0 ? _a : 0) * delta.factor / (1e3 / 60);
      const max = 2 * Math.PI;
      particle.wobble.angle += speed;
      if (particle.wobble.angle > max) {
        particle.wobble.angle -= max;
      }
      particle.position.x += distance * Math.cos(particle.wobble.angle);
      particle.position.y += distance * Math.abs(Math.sin(particle.wobble.angle));
    }
    var WobbleUpdater = class {
      constructor(container) {
        this.container = container;
      }
      init(particle) {
        const wobbleOpt = particle.options.wobble;
        if (wobbleOpt.enable) {
          particle.wobble = {
            angle: Math.random() * Math.PI * 2,
            speed: (0, Utils_1.getRangeValue)(wobbleOpt.speed) / 360
          };
        } else {
          particle.wobble = {
            angle: 0,
            speed: 0
          };
        }
        particle.retina.wobbleDistance = (0, Utils_1.getRangeValue)(wobbleOpt.distance) * this.container.retina.pixelRatio;
      }
      isEnabled(particle) {
        return !particle.destroyed && !particle.spawning && particle.options.wobble.enable;
      }
      update(particle, delta) {
        if (!this.isEnabled(particle)) {
          return;
        }
        updateWobble(particle, delta);
      }
    };
    exports.WobbleUpdater = WobbleUpdater;
  }
});

// node_modules/tsparticles/Updaters/Wobble/index.js
var require_Wobble2 = __commonJS({
  "node_modules/tsparticles/Updaters/Wobble/index.js"(exports) {
    init_shims();
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.loadWobbleUpdater = void 0;
    var WobbleUpdater_1 = require_WobbleUpdater();
    async function loadWobbleUpdater(tsParticles) {
      await tsParticles.addParticleUpdater("wobble", (container) => new WobbleUpdater_1.WobbleUpdater(container));
    }
    exports.loadWobbleUpdater = loadWobbleUpdater;
  }
});

// node_modules/tsparticles/Plugins/Absorbers/AbsorberInstance.js
var require_AbsorberInstance = __commonJS({
  "node_modules/tsparticles/Plugins/Absorbers/AbsorberInstance.js"(exports) {
    init_shims();
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.AbsorberInstance = void 0;
    var Utils_1 = require_Utils2();
    var Vector_1 = require_Vector();
    var Enums_1 = require_Enums();
    var AbsorberInstance = class {
      constructor(absorbers, container, options2, position) {
        var _a, _b, _c, _d, _e;
        this.absorbers = absorbers;
        this.container = container;
        this.initialPosition = position ? Vector_1.Vector.create(position.x, position.y) : void 0;
        this.options = options2;
        this.dragging = false;
        this.name = this.options.name;
        this.opacity = this.options.opacity;
        this.size = (0, Utils_1.getRangeValue)(options2.size.value) * container.retina.pixelRatio;
        this.mass = this.size * options2.size.density * container.retina.reduceFactor;
        const limit = options2.size.limit;
        this.limit = typeof limit === "number" ? {
          radius: limit * container.retina.pixelRatio * container.retina.reduceFactor,
          mass: 0
        } : {
          radius: ((_a = limit === null || limit === void 0 ? void 0 : limit.radius) !== null && _a !== void 0 ? _a : 0) * container.retina.pixelRatio * container.retina.reduceFactor,
          mass: (_b = limit === null || limit === void 0 ? void 0 : limit.mass) !== null && _b !== void 0 ? _b : 0
        };
        const color = typeof options2.color === "string" ? { value: options2.color } : options2.color;
        this.color = (_c = (0, Utils_1.colorToRgb)(color)) !== null && _c !== void 0 ? _c : {
          b: 0,
          g: 0,
          r: 0
        };
        this.position = (_e = (_d = this.initialPosition) === null || _d === void 0 ? void 0 : _d.copy()) !== null && _e !== void 0 ? _e : this.calcPosition();
      }
      attract(particle) {
        const container = this.container;
        const options2 = this.options;
        if (options2.draggable) {
          const mouse = container.interactivity.mouse;
          if (mouse.clicking && mouse.downPosition) {
            const mouseDist = (0, Utils_1.getDistance)(this.position, mouse.downPosition);
            if (mouseDist <= this.size) {
              this.dragging = true;
            }
          } else {
            this.dragging = false;
          }
          if (this.dragging && mouse.position) {
            this.position.x = mouse.position.x;
            this.position.y = mouse.position.y;
          }
        }
        const pos = particle.getPosition();
        const { dx, dy, distance } = (0, Utils_1.getDistances)(this.position, pos);
        const v = Vector_1.Vector.create(dx, dy);
        v.length = this.mass / Math.pow(distance, 2) * container.retina.reduceFactor;
        if (distance < this.size + particle.getRadius()) {
          const sizeFactor = particle.getRadius() * 0.033 * container.retina.pixelRatio;
          if (this.size > particle.getRadius() && distance < this.size - particle.getRadius() || particle.absorberOrbit !== void 0 && particle.absorberOrbit.length < 0) {
            if (options2.destroy) {
              particle.destroy();
            } else {
              particle.needsNewPosition = true;
              this.updateParticlePosition(particle, v);
            }
          } else {
            if (options2.destroy) {
              particle.size.value -= sizeFactor;
            }
            this.updateParticlePosition(particle, v);
          }
          if (this.limit.radius <= 0 || this.size < this.limit.radius) {
            this.size += sizeFactor;
          }
          if (this.limit.mass <= 0 || this.mass < this.limit.mass) {
            this.mass += sizeFactor * this.options.size.density * container.retina.reduceFactor;
          }
        } else {
          this.updateParticlePosition(particle, v);
        }
      }
      resize() {
        const initialPosition = this.initialPosition;
        this.position = initialPosition && (0, Utils_1.isPointInside)(initialPosition, this.container.canvas.size) ? initialPosition : this.calcPosition();
      }
      draw(context) {
        context.translate(this.position.x, this.position.y);
        context.beginPath();
        context.arc(0, 0, this.size, 0, Math.PI * 2, false);
        context.closePath();
        context.fillStyle = (0, Utils_1.getStyleFromRgb)(this.color, this.opacity);
        context.fill();
      }
      calcPosition() {
        var _a, _b;
        const container = this.container;
        const percentPosition = this.options.position;
        return Vector_1.Vector.create(((_a = percentPosition === null || percentPosition === void 0 ? void 0 : percentPosition.x) !== null && _a !== void 0 ? _a : Math.random() * 100) / 100 * container.canvas.size.width, ((_b = percentPosition === null || percentPosition === void 0 ? void 0 : percentPosition.y) !== null && _b !== void 0 ? _b : Math.random() * 100) / 100 * container.canvas.size.height);
      }
      updateParticlePosition(particle, v) {
        var _a;
        if (particle.destroyed) {
          return;
        }
        const container = this.container;
        const canvasSize = container.canvas.size;
        if (particle.needsNewPosition) {
          particle.position.x = Math.floor(Math.random() * canvasSize.width);
          particle.position.y = Math.floor(Math.random() * canvasSize.height);
          particle.velocity.setTo(particle.initialVelocity);
          particle.absorberOrbit = void 0;
          particle.needsNewPosition = false;
        }
        if (this.options.orbits) {
          if (particle.absorberOrbit === void 0) {
            particle.absorberOrbit = Vector_1.Vector.create(0, 0);
            particle.absorberOrbit.length = (0, Utils_1.getDistance)(particle.getPosition(), this.position);
            particle.absorberOrbit.angle = Math.random() * Math.PI * 2;
          }
          if (particle.absorberOrbit.length <= this.size && !this.options.destroy) {
            const minSize = Math.min(canvasSize.width, canvasSize.height);
            particle.absorberOrbit.length = minSize * (1 + (Math.random() * 0.2 - 0.1));
          }
          if (particle.absorberOrbitDirection === void 0) {
            particle.absorberOrbitDirection = particle.velocity.x >= 0 ? Enums_1.RotateDirection.clockwise : Enums_1.RotateDirection.counterClockwise;
          }
          const orbitRadius = particle.absorberOrbit.length;
          const orbitAngle = particle.absorberOrbit.angle;
          const orbitDirection = particle.absorberOrbitDirection;
          particle.velocity.x = 0;
          particle.velocity.y = 0;
          const updateFunc = {
            x: orbitDirection === Enums_1.RotateDirection.clockwise ? Math.cos : Math.sin,
            y: orbitDirection === Enums_1.RotateDirection.clockwise ? Math.sin : Math.cos
          };
          particle.position.x = this.position.x + orbitRadius * updateFunc.x(orbitAngle);
          particle.position.y = this.position.y + orbitRadius * updateFunc.y(orbitAngle);
          particle.absorberOrbit.length -= v.length;
          particle.absorberOrbit.angle += ((_a = particle.retina.moveSpeed) !== null && _a !== void 0 ? _a : 0) * container.retina.pixelRatio / 100 * container.retina.reduceFactor;
        } else {
          const addV = Vector_1.Vector.origin;
          addV.length = v.length;
          addV.angle = v.angle;
          particle.velocity.addTo(addV);
        }
      }
    };
    exports.AbsorberInstance = AbsorberInstance;
  }
});

// node_modules/tsparticles/Plugins/Absorbers/Options/Classes/AbsorberSizeLimit.js
var require_AbsorberSizeLimit = __commonJS({
  "node_modules/tsparticles/Plugins/Absorbers/Options/Classes/AbsorberSizeLimit.js"(exports) {
    init_shims();
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.AbsorberSizeLimit = void 0;
    var AbsorberSizeLimit = class {
      constructor() {
        this.radius = 0;
        this.mass = 0;
      }
      load(data) {
        if (!data) {
          return;
        }
        if (data.mass !== void 0) {
          this.mass = data.mass;
        }
        if (data.radius !== void 0) {
          this.radius = data.radius;
        }
      }
    };
    exports.AbsorberSizeLimit = AbsorberSizeLimit;
  }
});

// node_modules/tsparticles/Plugins/Absorbers/Options/Classes/AbsorberSize.js
var require_AbsorberSize = __commonJS({
  "node_modules/tsparticles/Plugins/Absorbers/Options/Classes/AbsorberSize.js"(exports) {
    init_shims();
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.AbsorberSize = void 0;
    var ValueWithRandom_1 = require_ValueWithRandom();
    var AbsorberSizeLimit_1 = require_AbsorberSizeLimit();
    var AbsorberSize = class extends ValueWithRandom_1.ValueWithRandom {
      constructor() {
        super();
        this.density = 5;
        this.random.minimumValue = 1;
        this.value = 50;
        this.limit = new AbsorberSizeLimit_1.AbsorberSizeLimit();
      }
      load(data) {
        if (!data) {
          return;
        }
        super.load(data);
        if (data.density !== void 0) {
          this.density = data.density;
        }
        if (typeof data.limit === "number") {
          this.limit.radius = data.limit;
        } else {
          this.limit.load(data.limit);
        }
      }
    };
    exports.AbsorberSize = AbsorberSize;
  }
});

// node_modules/tsparticles/Plugins/Absorbers/Options/Classes/Absorber.js
var require_Absorber = __commonJS({
  "node_modules/tsparticles/Plugins/Absorbers/Options/Classes/Absorber.js"(exports) {
    init_shims();
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.Absorber = void 0;
    var AbsorberSize_1 = require_AbsorberSize();
    var OptionsColor_1 = require_OptionsColor();
    var Absorber = class {
      constructor() {
        this.color = new OptionsColor_1.OptionsColor();
        this.color.value = "#000000";
        this.draggable = false;
        this.opacity = 1;
        this.destroy = true;
        this.orbits = false;
        this.size = new AbsorberSize_1.AbsorberSize();
      }
      load(data) {
        if (data === void 0) {
          return;
        }
        if (data.color !== void 0) {
          this.color = OptionsColor_1.OptionsColor.create(this.color, data.color);
        }
        if (data.draggable !== void 0) {
          this.draggable = data.draggable;
        }
        this.name = data.name;
        if (data.opacity !== void 0) {
          this.opacity = data.opacity;
        }
        if (data.position !== void 0) {
          this.position = {
            x: data.position.x,
            y: data.position.y
          };
        }
        if (data.size !== void 0) {
          this.size.load(data.size);
        }
        if (data.destroy !== void 0) {
          this.destroy = data.destroy;
        }
        if (data.orbits !== void 0) {
          this.orbits = data.orbits;
        }
      }
    };
    exports.Absorber = Absorber;
  }
});

// node_modules/tsparticles/Plugins/Absorbers/Enums/AbsorberClickMode.js
var require_AbsorberClickMode = __commonJS({
  "node_modules/tsparticles/Plugins/Absorbers/Enums/AbsorberClickMode.js"(exports) {
    init_shims();
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.AbsorberClickMode = void 0;
    var AbsorberClickMode;
    (function(AbsorberClickMode2) {
      AbsorberClickMode2["absorber"] = "absorber";
    })(AbsorberClickMode = exports.AbsorberClickMode || (exports.AbsorberClickMode = {}));
  }
});

// node_modules/tsparticles/Plugins/Absorbers/Enums/index.js
var require_Enums2 = __commonJS({
  "node_modules/tsparticles/Plugins/Absorbers/Enums/index.js"(exports) {
    init_shims();
    "use strict";
    var __createBinding = exports && exports.__createBinding || (Object.create ? function(o, m, k, k2) {
      if (k2 === void 0)
        k2 = k;
      Object.defineProperty(o, k2, { enumerable: true, get: function() {
        return m[k];
      } });
    } : function(o, m, k, k2) {
      if (k2 === void 0)
        k2 = k;
      o[k2] = m[k];
    });
    var __exportStar = exports && exports.__exportStar || function(m, exports2) {
      for (var p in m)
        if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports2, p))
          __createBinding(exports2, m, p);
    };
    Object.defineProperty(exports, "__esModule", { value: true });
    __exportStar(require_AbsorberClickMode(), exports);
  }
});

// node_modules/tsparticles/Plugins/Absorbers/Absorbers.js
var require_Absorbers = __commonJS({
  "node_modules/tsparticles/Plugins/Absorbers/Absorbers.js"(exports) {
    init_shims();
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.Absorbers = void 0;
    var AbsorberInstance_1 = require_AbsorberInstance();
    var Absorber_1 = require_Absorber();
    var Enums_1 = require_Enums2();
    var Utils_1 = require_Utils2();
    var Absorbers = class {
      constructor(container) {
        this.container = container;
        this.array = [];
        this.absorbers = [];
        this.interactivityAbsorbers = [];
        const overridableContainer = container;
        overridableContainer.getAbsorber = (idxOrName) => idxOrName === void 0 || typeof idxOrName === "number" ? this.array[idxOrName || 0] : this.array.find((t) => t.name === idxOrName);
        overridableContainer.addAbsorber = (options2, position) => this.addAbsorber(options2, position);
      }
      init(options2) {
        var _a, _b;
        if (!options2) {
          return;
        }
        if (options2.absorbers) {
          if (options2.absorbers instanceof Array) {
            this.absorbers = options2.absorbers.map((s2) => {
              const tmp = new Absorber_1.Absorber();
              tmp.load(s2);
              return tmp;
            });
          } else {
            if (this.absorbers instanceof Array) {
              this.absorbers = new Absorber_1.Absorber();
            }
            this.absorbers.load(options2.absorbers);
          }
        }
        const interactivityAbsorbers = (_b = (_a = options2.interactivity) === null || _a === void 0 ? void 0 : _a.modes) === null || _b === void 0 ? void 0 : _b.absorbers;
        if (interactivityAbsorbers) {
          if (interactivityAbsorbers instanceof Array) {
            this.interactivityAbsorbers = interactivityAbsorbers.map((s2) => {
              const tmp = new Absorber_1.Absorber();
              tmp.load(s2);
              return tmp;
            });
          } else {
            if (this.interactivityAbsorbers instanceof Array) {
              this.interactivityAbsorbers = new Absorber_1.Absorber();
            }
            this.interactivityAbsorbers.load(interactivityAbsorbers);
          }
        }
        if (this.absorbers instanceof Array) {
          for (const absorberOptions of this.absorbers) {
            this.addAbsorber(absorberOptions);
          }
        } else {
          this.addAbsorber(this.absorbers);
        }
      }
      particleUpdate(particle) {
        for (const absorber of this.array) {
          absorber.attract(particle);
          if (particle.destroyed) {
            break;
          }
        }
      }
      draw(context) {
        for (const absorber of this.array) {
          context.save();
          absorber.draw(context);
          context.restore();
        }
      }
      stop() {
        this.array = [];
      }
      resize() {
        for (const absorber of this.array) {
          absorber.resize();
        }
      }
      handleClickMode(mode) {
        const container = this.container;
        const absorberOptions = this.absorbers;
        const modeAbsorbers = this.interactivityAbsorbers;
        if (mode === Enums_1.AbsorberClickMode.absorber) {
          let absorbersModeOptions;
          if (modeAbsorbers instanceof Array) {
            if (modeAbsorbers.length > 0) {
              absorbersModeOptions = (0, Utils_1.itemFromArray)(modeAbsorbers);
            }
          } else {
            absorbersModeOptions = modeAbsorbers;
          }
          const absorbersOptions = absorbersModeOptions !== null && absorbersModeOptions !== void 0 ? absorbersModeOptions : absorberOptions instanceof Array ? (0, Utils_1.itemFromArray)(absorberOptions) : absorberOptions;
          const aPosition = container.interactivity.mouse.clickPosition;
          this.addAbsorber(absorbersOptions, aPosition);
        }
      }
      addAbsorber(options2, position) {
        const absorber = new AbsorberInstance_1.AbsorberInstance(this, this.container, options2, position);
        this.array.push(absorber);
        return absorber;
      }
      removeAbsorber(absorber) {
        const index = this.array.indexOf(absorber);
        if (index >= 0) {
          this.array.splice(index, 1);
        }
      }
    };
    exports.Absorbers = Absorbers;
  }
});

// node_modules/tsparticles/Plugins/Absorbers/plugin.js
var require_plugin2 = __commonJS({
  "node_modules/tsparticles/Plugins/Absorbers/plugin.js"(exports) {
    init_shims();
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.loadAbsorbersPlugin = void 0;
    var Absorbers_1 = require_Absorbers();
    var Enums_1 = require_Enums2();
    var Absorber_1 = require_Absorber();
    var Utils_1 = require_Utils2();
    var Plugin = class {
      constructor() {
        this.id = "absorbers";
      }
      getPlugin(container) {
        return new Absorbers_1.Absorbers(container);
      }
      needsPlugin(options2) {
        var _a, _b, _c;
        if (options2 === void 0) {
          return false;
        }
        const absorbers = options2.absorbers;
        let loadAbsorbers = false;
        if (absorbers instanceof Array) {
          if (absorbers.length) {
            loadAbsorbers = true;
          }
        } else if (absorbers !== void 0) {
          loadAbsorbers = true;
        } else if (((_c = (_b = (_a = options2.interactivity) === null || _a === void 0 ? void 0 : _a.events) === null || _b === void 0 ? void 0 : _b.onClick) === null || _c === void 0 ? void 0 : _c.mode) && (0, Utils_1.isInArray)(Enums_1.AbsorberClickMode.absorber, options2.interactivity.events.onClick.mode)) {
          loadAbsorbers = true;
        }
        return loadAbsorbers;
      }
      loadOptions(options2, source) {
        var _a, _b;
        if (!this.needsPlugin(options2) && !this.needsPlugin(source)) {
          return;
        }
        const optionsCast = options2;
        if (source === null || source === void 0 ? void 0 : source.absorbers) {
          if ((source === null || source === void 0 ? void 0 : source.absorbers) instanceof Array) {
            optionsCast.absorbers = source === null || source === void 0 ? void 0 : source.absorbers.map((s2) => {
              const tmp = new Absorber_1.Absorber();
              tmp.load(s2);
              return tmp;
            });
          } else {
            let absorberOptions = optionsCast.absorbers;
            if ((absorberOptions === null || absorberOptions === void 0 ? void 0 : absorberOptions.load) === void 0) {
              optionsCast.absorbers = absorberOptions = new Absorber_1.Absorber();
            }
            absorberOptions.load(source === null || source === void 0 ? void 0 : source.absorbers);
          }
        }
        const interactivityAbsorbers = (_b = (_a = source === null || source === void 0 ? void 0 : source.interactivity) === null || _a === void 0 ? void 0 : _a.modes) === null || _b === void 0 ? void 0 : _b.absorbers;
        if (interactivityAbsorbers) {
          if (interactivityAbsorbers instanceof Array) {
            optionsCast.interactivity.modes.absorbers = interactivityAbsorbers.map((s2) => {
              const tmp = new Absorber_1.Absorber();
              tmp.load(s2);
              return tmp;
            });
          } else {
            let absorberOptions = optionsCast.interactivity.modes.absorbers;
            if ((absorberOptions === null || absorberOptions === void 0 ? void 0 : absorberOptions.load) === void 0) {
              optionsCast.interactivity.modes.absorbers = absorberOptions = new Absorber_1.Absorber();
            }
            absorberOptions.load(interactivityAbsorbers);
          }
        }
      }
    };
    async function loadAbsorbersPlugin(tsParticles) {
      const plugin = new Plugin();
      await tsParticles.addPlugin(plugin);
    }
    exports.loadAbsorbersPlugin = loadAbsorbersPlugin;
  }
});

// node_modules/tsparticles/Plugins/Emitters/Options/Classes/EmitterSize.js
var require_EmitterSize = __commonJS({
  "node_modules/tsparticles/Plugins/Emitters/Options/Classes/EmitterSize.js"(exports) {
    init_shims();
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.EmitterSize = void 0;
    var Enums_1 = require_Enums();
    var EmitterSize = class {
      constructor() {
        this.mode = Enums_1.SizeMode.percent;
        this.height = 0;
        this.width = 0;
      }
      load(data) {
        if (data === void 0) {
          return;
        }
        if (data.mode !== void 0) {
          this.mode = data.mode;
        }
        if (data.height !== void 0) {
          this.height = data.height;
        }
        if (data.width !== void 0) {
          this.width = data.width;
        }
      }
    };
    exports.EmitterSize = EmitterSize;
  }
});

// node_modules/tsparticles/Plugins/Emitters/ShapeManager.js
var require_ShapeManager = __commonJS({
  "node_modules/tsparticles/Plugins/Emitters/ShapeManager.js"(exports) {
    init_shims();
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.ShapeManager = void 0;
    var shapes = new Map();
    var ShapeManager = class {
      static addShape(name, drawer) {
        if (!ShapeManager.getShape(name)) {
          shapes.set(name, drawer);
        }
      }
      static getShape(name) {
        return shapes.get(name);
      }
      static getSupportedShapes() {
        return shapes.keys();
      }
    };
    exports.ShapeManager = ShapeManager;
  }
});

// node_modules/tsparticles/Plugins/Emitters/EmitterInstance.js
var require_EmitterInstance = __commonJS({
  "node_modules/tsparticles/Plugins/Emitters/EmitterInstance.js"(exports) {
    init_shims();
    "use strict";
    var __classPrivateFieldSet = exports && exports.__classPrivateFieldSet || function(receiver, state, value, kind, f) {
      if (kind === "m")
        throw new TypeError("Private method is not writable");
      if (kind === "a" && !f)
        throw new TypeError("Private accessor was defined without a setter");
      if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver))
        throw new TypeError("Cannot write private member to an object whose class did not declare it");
      return kind === "a" ? f.call(receiver, value) : f ? f.value = value : state.set(receiver, value), value;
    };
    var __classPrivateFieldGet = exports && exports.__classPrivateFieldGet || function(receiver, state, kind, f) {
      if (kind === "a" && !f)
        throw new TypeError("Private accessor was defined without a getter");
      if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver))
        throw new TypeError("Cannot read private member from an object whose class did not declare it");
      return kind === "m" ? f : kind === "a" ? f.call(receiver) : f ? f.value : state.get(receiver);
    };
    var _EmitterInstance_firstSpawn;
    var _EmitterInstance_startParticlesAdded;
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.EmitterInstance = void 0;
    var Utils_1 = require_Utils2();
    var Enums_1 = require_Enums();
    var EmitterSize_1 = require_EmitterSize();
    var ShapeManager_1 = require_ShapeManager();
    var EmitterInstance = class {
      constructor(emitters, container, emitterOptions, position) {
        var _a, _b, _c, _d, _e, _f;
        var _g;
        this.emitters = emitters;
        this.container = container;
        _EmitterInstance_firstSpawn.set(this, void 0);
        _EmitterInstance_startParticlesAdded.set(this, void 0);
        this.currentDuration = 0;
        this.currentEmitDelay = 0;
        this.currentSpawnDelay = 0;
        this.initialPosition = position;
        this.emitterOptions = (0, Utils_1.deepExtend)({}, emitterOptions);
        this.spawnDelay = ((_a = this.emitterOptions.life.delay) !== null && _a !== void 0 ? _a : 0) * 1e3 / this.container.retina.reduceFactor;
        this.position = (_b = this.initialPosition) !== null && _b !== void 0 ? _b : this.calcPosition();
        this.name = emitterOptions.name;
        this.shape = ShapeManager_1.ShapeManager.getShape(emitterOptions.shape);
        this.fill = emitterOptions.fill;
        __classPrivateFieldSet(this, _EmitterInstance_firstSpawn, !this.emitterOptions.life.wait, "f");
        __classPrivateFieldSet(this, _EmitterInstance_startParticlesAdded, false, "f");
        let particlesOptions = (0, Utils_1.deepExtend)({}, this.emitterOptions.particles);
        particlesOptions !== null && particlesOptions !== void 0 ? particlesOptions : particlesOptions = {};
        (_c = particlesOptions.move) !== null && _c !== void 0 ? _c : particlesOptions.move = {};
        (_d = (_g = particlesOptions.move).direction) !== null && _d !== void 0 ? _d : _g.direction = this.emitterOptions.direction;
        if (this.emitterOptions.spawnColor !== void 0) {
          this.spawnColor = (0, Utils_1.colorToHsl)(this.emitterOptions.spawnColor);
        }
        this.paused = !this.emitterOptions.autoPlay;
        this.particlesOptions = particlesOptions;
        this.size = (_e = this.emitterOptions.size) !== null && _e !== void 0 ? _e : (() => {
          const size = new EmitterSize_1.EmitterSize();
          size.load({
            height: 0,
            mode: Enums_1.SizeMode.percent,
            width: 0
          });
          return size;
        })();
        this.lifeCount = (_f = this.emitterOptions.life.count) !== null && _f !== void 0 ? _f : -1;
        this.immortal = this.lifeCount <= 0;
        this.play();
      }
      externalPlay() {
        this.paused = false;
        this.play();
      }
      externalPause() {
        this.paused = true;
        this.pause();
      }
      play() {
        var _a;
        if (this.paused) {
          return;
        }
        if (this.container.retina.reduceFactor && (this.lifeCount > 0 || this.immortal || !this.emitterOptions.life.count) && (__classPrivateFieldGet(this, _EmitterInstance_firstSpawn, "f") || this.currentSpawnDelay >= ((_a = this.spawnDelay) !== null && _a !== void 0 ? _a : 0))) {
          if (this.emitDelay === void 0) {
            const delay = (0, Utils_1.getRangeValue)(this.emitterOptions.rate.delay);
            this.emitDelay = 1e3 * delay / this.container.retina.reduceFactor;
          }
          if (this.lifeCount > 0 || this.immortal) {
            this.prepareToDie();
          }
        }
      }
      pause() {
        if (this.paused) {
          return;
        }
        delete this.emitDelay;
      }
      resize() {
        const initialPosition = this.initialPosition;
        this.position = initialPosition && (0, Utils_1.isPointInside)(initialPosition, this.container.canvas.size) ? initialPosition : this.calcPosition();
      }
      update(delta) {
        var _a, _b, _c;
        if (this.paused) {
          return;
        }
        if (__classPrivateFieldGet(this, _EmitterInstance_firstSpawn, "f")) {
          __classPrivateFieldSet(this, _EmitterInstance_firstSpawn, false, "f");
          this.currentSpawnDelay = (_a = this.spawnDelay) !== null && _a !== void 0 ? _a : 0;
          this.currentEmitDelay = (_b = this.emitDelay) !== null && _b !== void 0 ? _b : 0;
        }
        if (!__classPrivateFieldGet(this, _EmitterInstance_startParticlesAdded, "f")) {
          __classPrivateFieldSet(this, _EmitterInstance_startParticlesAdded, true, "f");
          this.emitParticles(this.emitterOptions.startCount);
        }
        if (this.duration !== void 0) {
          this.currentDuration += delta.value;
          if (this.currentDuration >= this.duration) {
            this.pause();
            if (this.spawnDelay !== void 0) {
              delete this.spawnDelay;
            }
            if (!this.immortal) {
              this.lifeCount--;
            }
            if (this.lifeCount > 0 || this.immortal) {
              this.position = this.calcPosition();
              this.spawnDelay = ((_c = this.emitterOptions.life.delay) !== null && _c !== void 0 ? _c : 0) * 1e3 / this.container.retina.reduceFactor;
            } else {
              this.destroy();
            }
            this.currentDuration -= this.duration;
            delete this.duration;
          }
        }
        if (this.spawnDelay !== void 0) {
          this.currentSpawnDelay += delta.value;
          if (this.currentSpawnDelay >= this.spawnDelay) {
            this.play();
            this.currentSpawnDelay -= this.currentSpawnDelay;
            delete this.spawnDelay;
          }
        }
        if (this.emitDelay !== void 0) {
          this.currentEmitDelay += delta.value;
          if (this.currentEmitDelay >= this.emitDelay) {
            this.emit();
            this.currentEmitDelay -= this.emitDelay;
          }
        }
      }
      prepareToDie() {
        var _a;
        if (this.paused) {
          return;
        }
        const duration = (_a = this.emitterOptions.life) === null || _a === void 0 ? void 0 : _a.duration;
        if (this.container.retina.reduceFactor && (this.lifeCount > 0 || this.immortal) && duration !== void 0 && duration > 0) {
          this.duration = duration * 1e3;
        }
      }
      destroy() {
        this.emitters.removeEmitter(this);
      }
      calcPosition() {
        var _a, _b;
        const container = this.container;
        const percentPosition = this.emitterOptions.position;
        return {
          x: ((_a = percentPosition === null || percentPosition === void 0 ? void 0 : percentPosition.x) !== null && _a !== void 0 ? _a : Math.random() * 100) / 100 * container.canvas.size.width,
          y: ((_b = percentPosition === null || percentPosition === void 0 ? void 0 : percentPosition.y) !== null && _b !== void 0 ? _b : Math.random() * 100) / 100 * container.canvas.size.height
        };
      }
      emit() {
        if (this.paused) {
          return;
        }
        const quantity = (0, Utils_1.getRangeValue)(this.emitterOptions.rate.quantity);
        this.emitParticles(quantity);
      }
      emitParticles(quantity) {
        var _a, _b, _c;
        const container = this.container;
        const position = this.position;
        const offset = {
          x: this.size.mode === Enums_1.SizeMode.percent ? container.canvas.size.width * this.size.width / 100 : this.size.width,
          y: this.size.mode === Enums_1.SizeMode.percent ? container.canvas.size.height * this.size.height / 100 : this.size.height
        };
        for (let i = 0; i < quantity; i++) {
          const particlesOptions = (0, Utils_1.deepExtend)({}, this.particlesOptions);
          if (this.spawnColor) {
            const colorAnimation = (_a = this.emitterOptions.spawnColor) === null || _a === void 0 ? void 0 : _a.animation;
            if (colorAnimation) {
              const hueAnimation = colorAnimation;
              if (hueAnimation.enable) {
                this.spawnColor.h = this.setColorAnimation(hueAnimation, this.spawnColor.h, 360);
              } else {
                const hslAnimation = colorAnimation;
                this.spawnColor.h = this.setColorAnimation(hslAnimation.h, this.spawnColor.h, 360);
                this.spawnColor.s = this.setColorAnimation(hslAnimation.s, this.spawnColor.s, 100);
                this.spawnColor.l = this.setColorAnimation(hslAnimation.l, this.spawnColor.l, 100);
              }
            }
            if (!particlesOptions.color) {
              particlesOptions.color = {
                value: this.spawnColor
              };
            } else {
              particlesOptions.color.value = this.spawnColor;
            }
          }
          const pPosition = (_c = (_b = this.shape) === null || _b === void 0 ? void 0 : _b.randomPosition(position, offset, this.fill)) !== null && _c !== void 0 ? _c : position;
          container.particles.addParticle(pPosition, particlesOptions);
        }
      }
      setColorAnimation(animation, initValue, maxValue) {
        var _a;
        const container = this.container;
        if (!animation.enable) {
          return initValue;
        }
        const colorOffset = (0, Utils_1.randomInRange)(animation.offset);
        const delay = (0, Utils_1.getRangeValue)(this.emitterOptions.rate.delay);
        const emitFactor = 1e3 * delay / container.retina.reduceFactor;
        const colorSpeed = (_a = animation.speed) !== null && _a !== void 0 ? _a : 0;
        return (initValue + colorSpeed * container.fpsLimit / emitFactor + colorOffset * 3.6) % maxValue;
      }
    };
    exports.EmitterInstance = EmitterInstance;
    _EmitterInstance_firstSpawn = new WeakMap(), _EmitterInstance_startParticlesAdded = new WeakMap();
  }
});

// node_modules/tsparticles/Plugins/Emitters/Options/Classes/EmitterRate.js
var require_EmitterRate = __commonJS({
  "node_modules/tsparticles/Plugins/Emitters/Options/Classes/EmitterRate.js"(exports) {
    init_shims();
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.EmitterRate = void 0;
    var Utils_1 = require_Utils2();
    var EmitterRate = class {
      constructor() {
        this.quantity = 1;
        this.delay = 0.1;
      }
      load(data) {
        if (data === void 0) {
          return;
        }
        if (data.quantity !== void 0) {
          this.quantity = (0, Utils_1.setRangeValue)(data.quantity);
        }
        if (data.delay !== void 0) {
          this.delay = (0, Utils_1.setRangeValue)(data.delay);
        }
      }
    };
    exports.EmitterRate = EmitterRate;
  }
});

// node_modules/tsparticles/Plugins/Emitters/Options/Classes/EmitterLife.js
var require_EmitterLife = __commonJS({
  "node_modules/tsparticles/Plugins/Emitters/Options/Classes/EmitterLife.js"(exports) {
    init_shims();
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.EmitterLife = void 0;
    var EmitterLife = class {
      constructor() {
        this.wait = false;
      }
      load(data) {
        if (data === void 0) {
          return;
        }
        if (data.count !== void 0) {
          this.count = data.count;
        }
        if (data.delay !== void 0) {
          this.delay = data.delay;
        }
        if (data.duration !== void 0) {
          this.duration = data.duration;
        }
        if (data.wait !== void 0) {
          this.wait = data.wait;
        }
      }
    };
    exports.EmitterLife = EmitterLife;
  }
});

// node_modules/tsparticles/Plugins/Emitters/Enums/EmitterClickMode.js
var require_EmitterClickMode = __commonJS({
  "node_modules/tsparticles/Plugins/Emitters/Enums/EmitterClickMode.js"(exports) {
    init_shims();
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.EmitterClickMode = void 0;
    var EmitterClickMode;
    (function(EmitterClickMode2) {
      EmitterClickMode2["emitter"] = "emitter";
    })(EmitterClickMode = exports.EmitterClickMode || (exports.EmitterClickMode = {}));
  }
});

// node_modules/tsparticles/Plugins/Emitters/Enums/EmitterShapeType.js
var require_EmitterShapeType = __commonJS({
  "node_modules/tsparticles/Plugins/Emitters/Enums/EmitterShapeType.js"(exports) {
    init_shims();
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.EmitterShapeType = void 0;
    var EmitterShapeType;
    (function(EmitterShapeType2) {
      EmitterShapeType2["circle"] = "circle";
      EmitterShapeType2["square"] = "square";
    })(EmitterShapeType = exports.EmitterShapeType || (exports.EmitterShapeType = {}));
  }
});

// node_modules/tsparticles/Plugins/Emitters/Enums/index.js
var require_Enums3 = __commonJS({
  "node_modules/tsparticles/Plugins/Emitters/Enums/index.js"(exports) {
    init_shims();
    "use strict";
    var __createBinding = exports && exports.__createBinding || (Object.create ? function(o, m, k, k2) {
      if (k2 === void 0)
        k2 = k;
      Object.defineProperty(o, k2, { enumerable: true, get: function() {
        return m[k];
      } });
    } : function(o, m, k, k2) {
      if (k2 === void 0)
        k2 = k;
      o[k2] = m[k];
    });
    var __exportStar = exports && exports.__exportStar || function(m, exports2) {
      for (var p in m)
        if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports2, p))
          __createBinding(exports2, m, p);
    };
    Object.defineProperty(exports, "__esModule", { value: true });
    __exportStar(require_EmitterClickMode(), exports);
    __exportStar(require_EmitterShapeType(), exports);
  }
});

// node_modules/tsparticles/Plugins/Emitters/Options/Classes/Emitter.js
var require_Emitter = __commonJS({
  "node_modules/tsparticles/Plugins/Emitters/Options/Classes/Emitter.js"(exports) {
    init_shims();
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.Emitter = void 0;
    var EmitterRate_1 = require_EmitterRate();
    var EmitterLife_1 = require_EmitterLife();
    var Utils_1 = require_Utils2();
    var EmitterSize_1 = require_EmitterSize();
    var AnimatableColor_1 = require_AnimatableColor();
    var Enums_1 = require_Enums3();
    var Emitter = class {
      constructor() {
        this.autoPlay = true;
        this.fill = true;
        this.life = new EmitterLife_1.EmitterLife();
        this.rate = new EmitterRate_1.EmitterRate();
        this.shape = Enums_1.EmitterShapeType.square;
        this.startCount = 0;
      }
      load(data) {
        if (data === void 0) {
          return;
        }
        if (data.autoPlay !== void 0) {
          this.autoPlay = data.autoPlay;
        }
        if (data.size !== void 0) {
          if (this.size === void 0) {
            this.size = new EmitterSize_1.EmitterSize();
          }
          this.size.load(data.size);
        }
        if (data.direction !== void 0) {
          this.direction = data.direction;
        }
        if (data.fill !== void 0) {
          this.fill = data.fill;
        }
        this.life.load(data.life);
        this.name = data.name;
        if (data.particles !== void 0) {
          this.particles = (0, Utils_1.deepExtend)({}, data.particles);
        }
        this.rate.load(data.rate);
        if (data.shape !== void 0) {
          this.shape = data.shape;
        }
        if (data.position !== void 0) {
          this.position = {
            x: data.position.x,
            y: data.position.y
          };
        }
        if (data.spawnColor !== void 0) {
          if (this.spawnColor === void 0) {
            this.spawnColor = new AnimatableColor_1.AnimatableColor();
          }
          this.spawnColor.load(data.spawnColor);
        }
        if (data.startCount !== void 0) {
          this.startCount = data.startCount;
        }
      }
    };
    exports.Emitter = Emitter;
  }
});

// node_modules/tsparticles/Plugins/Emitters/Emitters.js
var require_Emitters = __commonJS({
  "node_modules/tsparticles/Plugins/Emitters/Emitters.js"(exports) {
    init_shims();
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.Emitters = void 0;
    var EmitterInstance_1 = require_EmitterInstance();
    var Emitter_1 = require_Emitter();
    var Enums_1 = require_Enums3();
    var Utils_1 = require_Utils2();
    var Emitters = class {
      constructor(container) {
        this.container = container;
        this.array = [];
        this.emitters = [];
        this.interactivityEmitters = [];
        const overridableContainer = container;
        overridableContainer.getEmitter = (idxOrName) => idxOrName === void 0 || typeof idxOrName === "number" ? this.array[idxOrName || 0] : this.array.find((t) => t.name === idxOrName);
        overridableContainer.addEmitter = (options2, position) => this.addEmitter(options2, position);
        overridableContainer.playEmitter = (idxOrName) => {
          const emitter = overridableContainer.getEmitter(idxOrName);
          if (emitter) {
            emitter.externalPlay();
          }
        };
        overridableContainer.pauseEmitter = (idxOrName) => {
          const emitter = overridableContainer.getEmitter(idxOrName);
          if (emitter) {
            emitter.externalPause();
          }
        };
      }
      init(options2) {
        var _a, _b;
        if (!options2) {
          return;
        }
        if (options2.emitters) {
          if (options2.emitters instanceof Array) {
            this.emitters = options2.emitters.map((s2) => {
              const tmp = new Emitter_1.Emitter();
              tmp.load(s2);
              return tmp;
            });
          } else {
            if (this.emitters instanceof Array) {
              this.emitters = new Emitter_1.Emitter();
            }
            this.emitters.load(options2.emitters);
          }
        }
        const interactivityEmitters = (_b = (_a = options2.interactivity) === null || _a === void 0 ? void 0 : _a.modes) === null || _b === void 0 ? void 0 : _b.emitters;
        if (interactivityEmitters) {
          if (interactivityEmitters instanceof Array) {
            this.interactivityEmitters = interactivityEmitters.map((s2) => {
              const tmp = new Emitter_1.Emitter();
              tmp.load(s2);
              return tmp;
            });
          } else {
            if (this.interactivityEmitters instanceof Array) {
              this.interactivityEmitters = new Emitter_1.Emitter();
            }
            this.interactivityEmitters.load(interactivityEmitters);
          }
        }
        if (this.emitters instanceof Array) {
          for (const emitterOptions of this.emitters) {
            this.addEmitter(emitterOptions);
          }
        } else {
          this.addEmitter(this.emitters);
        }
      }
      play() {
        for (const emitter of this.array) {
          emitter.play();
        }
      }
      pause() {
        for (const emitter of this.array) {
          emitter.pause();
        }
      }
      stop() {
        this.array = [];
      }
      update(delta) {
        for (const emitter of this.array) {
          emitter.update(delta);
        }
      }
      handleClickMode(mode) {
        const container = this.container;
        const emitterOptions = this.emitters;
        const modeEmitters = this.interactivityEmitters;
        if (mode === Enums_1.EmitterClickMode.emitter) {
          let emitterModeOptions;
          if (modeEmitters instanceof Array) {
            if (modeEmitters.length > 0) {
              emitterModeOptions = (0, Utils_1.itemFromArray)(modeEmitters);
            }
          } else {
            emitterModeOptions = modeEmitters;
          }
          const emittersOptions = emitterModeOptions !== null && emitterModeOptions !== void 0 ? emitterModeOptions : emitterOptions instanceof Array ? (0, Utils_1.itemFromArray)(emitterOptions) : emitterOptions;
          const ePosition = container.interactivity.mouse.clickPosition;
          this.addEmitter((0, Utils_1.deepExtend)({}, emittersOptions), ePosition);
        }
      }
      resize() {
        for (const emitter of this.array) {
          emitter.resize();
        }
      }
      addEmitter(options2, position) {
        const emitter = new EmitterInstance_1.EmitterInstance(this, this.container, options2, position);
        this.array.push(emitter);
        return emitter;
      }
      removeEmitter(emitter) {
        const index = this.array.indexOf(emitter);
        if (index >= 0) {
          this.array.splice(index, 1);
        }
      }
    };
    exports.Emitters = Emitters;
  }
});

// node_modules/tsparticles/Plugins/Emitters/Shapes/Circle/CircleShape.js
var require_CircleShape = __commonJS({
  "node_modules/tsparticles/Plugins/Emitters/Shapes/Circle/CircleShape.js"(exports) {
    init_shims();
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.CircleShape = void 0;
    var CircleShape = class {
      randomPosition(position, offset, fill) {
        const generateTheta = (x, y) => {
          const u = Math.random() / 4;
          const theta = Math.atan(y / x * Math.tan(2 * Math.PI * u));
          const v = Math.random();
          if (v < 0.25) {
            return theta;
          } else if (v < 0.5) {
            return Math.PI - theta;
          } else if (v < 0.75) {
            return Math.PI + theta;
          } else {
            return -theta;
          }
        };
        const radius = (x, y, theta) => x * y / Math.sqrt((y * Math.cos(theta)) ** 2 + (x * Math.sin(theta)) ** 2);
        const [a, b] = [offset.x / 2, offset.y / 2];
        const randomTheta = generateTheta(a, b), maxRadius = radius(a, b, randomTheta), randomRadius = fill ? maxRadius * Math.sqrt(Math.random()) : maxRadius;
        return {
          x: position.x + randomRadius * Math.cos(randomTheta),
          y: position.y + randomRadius * Math.sin(randomTheta)
        };
      }
    };
    exports.CircleShape = CircleShape;
  }
});

// node_modules/tsparticles/Plugins/Emitters/Shapes/Square/SquareShape.js
var require_SquareShape = __commonJS({
  "node_modules/tsparticles/Plugins/Emitters/Shapes/Square/SquareShape.js"(exports) {
    init_shims();
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.SquareShape = void 0;
    function randomSquareCoordinate(position, offset) {
      return position + offset * (Math.random() - 0.5);
    }
    var SquareShape = class {
      randomPosition(position, offset, fill) {
        if (fill) {
          return {
            x: randomSquareCoordinate(position.x, offset.x),
            y: randomSquareCoordinate(position.y, offset.y)
          };
        } else {
          const halfW = offset.x / 2, halfH = offset.y / 2, side = Math.floor(Math.random() * 4), v = (Math.random() - 0.5) * 2;
          switch (side) {
            case 0:
              return {
                x: position.x + v * halfW,
                y: position.y - halfH
              };
            case 1:
              return {
                x: position.x - halfW,
                y: position.y + v * halfH
              };
            case 2:
              return {
                x: position.x + v * halfW,
                y: position.y + halfH
              };
            case 3:
            default:
              return {
                x: position.x + halfW,
                y: position.y + v * halfH
              };
          }
        }
      }
    };
    exports.SquareShape = SquareShape;
  }
});

// node_modules/tsparticles/Plugins/Emitters/EmittersMain.js
var require_EmittersMain = __commonJS({
  "node_modules/tsparticles/Plugins/Emitters/EmittersMain.js"(exports) {
    init_shims();
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
  }
});

// node_modules/tsparticles/Plugins/Emitters/plugin.js
var require_plugin3 = __commonJS({
  "node_modules/tsparticles/Plugins/Emitters/plugin.js"(exports) {
    init_shims();
    "use strict";
    var __createBinding = exports && exports.__createBinding || (Object.create ? function(o, m, k, k2) {
      if (k2 === void 0)
        k2 = k;
      Object.defineProperty(o, k2, { enumerable: true, get: function() {
        return m[k];
      } });
    } : function(o, m, k, k2) {
      if (k2 === void 0)
        k2 = k;
      o[k2] = m[k];
    });
    var __exportStar = exports && exports.__exportStar || function(m, exports2) {
      for (var p in m)
        if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports2, p))
          __createBinding(exports2, m, p);
    };
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.loadEmittersPlugin = void 0;
    var Utils_1 = require_Utils2();
    var Emitters_1 = require_Emitters();
    var Enums_1 = require_Enums3();
    var Emitter_1 = require_Emitter();
    var ShapeManager_1 = require_ShapeManager();
    var CircleShape_1 = require_CircleShape();
    var SquareShape_1 = require_SquareShape();
    var EmittersPlugin = class {
      constructor() {
        this.id = "emitters";
      }
      getPlugin(container) {
        return new Emitters_1.Emitters(container);
      }
      needsPlugin(options2) {
        var _a, _b, _c;
        if (options2 === void 0) {
          return false;
        }
        const emitters = options2.emitters;
        return emitters instanceof Array && !!emitters.length || emitters !== void 0 || !!((_c = (_b = (_a = options2.interactivity) === null || _a === void 0 ? void 0 : _a.events) === null || _b === void 0 ? void 0 : _b.onClick) === null || _c === void 0 ? void 0 : _c.mode) && (0, Utils_1.isInArray)(Enums_1.EmitterClickMode.emitter, options2.interactivity.events.onClick.mode);
      }
      loadOptions(options2, source) {
        var _a, _b;
        if (!this.needsPlugin(options2) && !this.needsPlugin(source)) {
          return;
        }
        const optionsCast = options2;
        if (source === null || source === void 0 ? void 0 : source.emitters) {
          if ((source === null || source === void 0 ? void 0 : source.emitters) instanceof Array) {
            optionsCast.emitters = source === null || source === void 0 ? void 0 : source.emitters.map((s2) => {
              const tmp = new Emitter_1.Emitter();
              tmp.load(s2);
              return tmp;
            });
          } else {
            let emitterOptions = optionsCast.emitters;
            if ((emitterOptions === null || emitterOptions === void 0 ? void 0 : emitterOptions.load) === void 0) {
              optionsCast.emitters = emitterOptions = new Emitter_1.Emitter();
            }
            emitterOptions.load(source === null || source === void 0 ? void 0 : source.emitters);
          }
        }
        const interactivityEmitters = (_b = (_a = source === null || source === void 0 ? void 0 : source.interactivity) === null || _a === void 0 ? void 0 : _a.modes) === null || _b === void 0 ? void 0 : _b.emitters;
        if (interactivityEmitters) {
          if (interactivityEmitters instanceof Array) {
            optionsCast.interactivity.modes.emitters = interactivityEmitters.map((s2) => {
              const tmp = new Emitter_1.Emitter();
              tmp.load(s2);
              return tmp;
            });
          } else {
            let emitterOptions = optionsCast.interactivity.modes.emitters;
            if ((emitterOptions === null || emitterOptions === void 0 ? void 0 : emitterOptions.load) === void 0) {
              optionsCast.interactivity.modes.emitters = emitterOptions = new Emitter_1.Emitter();
            }
            emitterOptions.load(interactivityEmitters);
          }
        }
      }
    };
    async function loadEmittersPlugin(tsParticles) {
      const plugin = new EmittersPlugin();
      await tsParticles.addPlugin(plugin);
      if (!tsParticles.addEmitterShape) {
        tsParticles.addEmitterShape = (name, shape) => {
          ShapeManager_1.ShapeManager.addShape(name, shape);
        };
      }
      tsParticles.addEmitterShape(Enums_1.EmitterShapeType.circle, new CircleShape_1.CircleShape());
      tsParticles.addEmitterShape(Enums_1.EmitterShapeType.square, new SquareShape_1.SquareShape());
    }
    exports.loadEmittersPlugin = loadEmittersPlugin;
    __exportStar(require_EmittersMain(), exports);
  }
});

// node_modules/tsparticles/Plugins/PolygonMask/Enums/InlineArrangement.js
var require_InlineArrangement = __commonJS({
  "node_modules/tsparticles/Plugins/PolygonMask/Enums/InlineArrangement.js"(exports) {
    init_shims();
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.InlineArrangement = void 0;
    var InlineArrangement;
    (function(InlineArrangement2) {
      InlineArrangement2["equidistant"] = "equidistant";
      InlineArrangement2["onePerPoint"] = "one-per-point";
      InlineArrangement2["perPoint"] = "per-point";
      InlineArrangement2["randomLength"] = "random-length";
      InlineArrangement2["randomPoint"] = "random-point";
    })(InlineArrangement = exports.InlineArrangement || (exports.InlineArrangement = {}));
  }
});

// node_modules/tsparticles/Plugins/PolygonMask/Enums/MoveType.js
var require_MoveType = __commonJS({
  "node_modules/tsparticles/Plugins/PolygonMask/Enums/MoveType.js"(exports) {
    init_shims();
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.MoveType = void 0;
    var MoveType;
    (function(MoveType2) {
      MoveType2["path"] = "path";
      MoveType2["radius"] = "radius";
    })(MoveType = exports.MoveType || (exports.MoveType = {}));
  }
});

// node_modules/tsparticles/Plugins/PolygonMask/Enums/Type.js
var require_Type = __commonJS({
  "node_modules/tsparticles/Plugins/PolygonMask/Enums/Type.js"(exports) {
    init_shims();
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.Type = void 0;
    var Type;
    (function(Type2) {
      Type2["inline"] = "inline";
      Type2["inside"] = "inside";
      Type2["outside"] = "outside";
      Type2["none"] = "none";
    })(Type = exports.Type || (exports.Type = {}));
  }
});

// node_modules/tsparticles/Plugins/PolygonMask/Enums/index.js
var require_Enums4 = __commonJS({
  "node_modules/tsparticles/Plugins/PolygonMask/Enums/index.js"(exports) {
    init_shims();
    "use strict";
    var __createBinding = exports && exports.__createBinding || (Object.create ? function(o, m, k, k2) {
      if (k2 === void 0)
        k2 = k;
      Object.defineProperty(o, k2, { enumerable: true, get: function() {
        return m[k];
      } });
    } : function(o, m, k, k2) {
      if (k2 === void 0)
        k2 = k;
      o[k2] = m[k];
    });
    var __exportStar = exports && exports.__exportStar || function(m, exports2) {
      for (var p in m)
        if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports2, p))
          __createBinding(exports2, m, p);
    };
    Object.defineProperty(exports, "__esModule", { value: true });
    __exportStar(require_InlineArrangement(), exports);
    __exportStar(require_MoveType(), exports);
    __exportStar(require_Type(), exports);
  }
});

// node_modules/tsparticles/Plugins/PolygonMask/Options/Classes/DrawStroke.js
var require_DrawStroke = __commonJS({
  "node_modules/tsparticles/Plugins/PolygonMask/Options/Classes/DrawStroke.js"(exports) {
    init_shims();
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.DrawStroke = void 0;
    var OptionsColor_1 = require_OptionsColor();
    var Utils_1 = require_Utils2();
    var DrawStroke = class {
      constructor() {
        this.color = new OptionsColor_1.OptionsColor();
        this.width = 0.5;
        this.opacity = 1;
      }
      load(data) {
        var _a;
        if (data !== void 0) {
          this.color = OptionsColor_1.OptionsColor.create(this.color, data.color);
          if (typeof this.color.value === "string") {
            this.opacity = (_a = (0, Utils_1.stringToAlpha)(this.color.value)) !== null && _a !== void 0 ? _a : this.opacity;
          }
          if (data.opacity !== void 0) {
            this.opacity = data.opacity;
          }
          if (data.width !== void 0) {
            this.width = data.width;
          }
        }
      }
    };
    exports.DrawStroke = DrawStroke;
  }
});

// node_modules/tsparticles/Plugins/PolygonMask/Options/Classes/Draw.js
var require_Draw = __commonJS({
  "node_modules/tsparticles/Plugins/PolygonMask/Options/Classes/Draw.js"(exports) {
    init_shims();
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.Draw = void 0;
    var DrawStroke_1 = require_DrawStroke();
    var OptionsColor_1 = require_OptionsColor();
    var Draw = class {
      constructor() {
        this.enable = false;
        this.stroke = new DrawStroke_1.DrawStroke();
      }
      get lineWidth() {
        return this.stroke.width;
      }
      set lineWidth(value) {
        this.stroke.width = value;
      }
      get lineColor() {
        return this.stroke.color;
      }
      set lineColor(value) {
        this.stroke.color = OptionsColor_1.OptionsColor.create(this.stroke.color, value);
      }
      load(data) {
        var _a;
        if (data !== void 0) {
          if (data.enable !== void 0) {
            this.enable = data.enable;
          }
          const stroke = (_a = data.stroke) !== null && _a !== void 0 ? _a : {
            color: data.lineColor,
            width: data.lineWidth
          };
          this.stroke.load(stroke);
        }
      }
    };
    exports.Draw = Draw;
  }
});

// node_modules/tsparticles/Plugins/PolygonMask/Options/Classes/Move.js
var require_Move2 = __commonJS({
  "node_modules/tsparticles/Plugins/PolygonMask/Options/Classes/Move.js"(exports) {
    init_shims();
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.Move = void 0;
    var Enums_1 = require_Enums4();
    var Move = class {
      constructor() {
        this.radius = 10;
        this.type = Enums_1.MoveType.path;
      }
      load(data) {
        if (data !== void 0) {
          if (data.radius !== void 0) {
            this.radius = data.radius;
          }
          if (data.type !== void 0) {
            this.type = data.type;
          }
        }
      }
    };
    exports.Move = Move;
  }
});

// node_modules/tsparticles/Plugins/PolygonMask/Options/Classes/Inline.js
var require_Inline = __commonJS({
  "node_modules/tsparticles/Plugins/PolygonMask/Options/Classes/Inline.js"(exports) {
    init_shims();
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.Inline = void 0;
    var Enums_1 = require_Enums4();
    var Inline = class {
      constructor() {
        this.arrangement = Enums_1.InlineArrangement.onePerPoint;
      }
      load(data) {
        if (data !== void 0) {
          if (data.arrangement !== void 0) {
            this.arrangement = data.arrangement;
          }
        }
      }
    };
    exports.Inline = Inline;
  }
});

// node_modules/tsparticles/Plugins/PolygonMask/Options/Classes/LocalSvg.js
var require_LocalSvg = __commonJS({
  "node_modules/tsparticles/Plugins/PolygonMask/Options/Classes/LocalSvg.js"(exports) {
    init_shims();
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.LocalSvg = void 0;
    var LocalSvg = class {
      constructor() {
        this.path = [];
        this.size = {
          height: 0,
          width: 0
        };
      }
      load(data) {
        if (data !== void 0) {
          if (data.path !== void 0) {
            this.path = data.path;
          }
          if (data.size !== void 0) {
            if (data.size.width !== void 0) {
              this.size.width = data.size.width;
            }
            if (data.size.height !== void 0) {
              this.size.height = data.size.height;
            }
          }
        }
      }
    };
    exports.LocalSvg = LocalSvg;
  }
});

// node_modules/tsparticles/Plugins/PolygonMask/Options/Classes/PolygonMask.js
var require_PolygonMask = __commonJS({
  "node_modules/tsparticles/Plugins/PolygonMask/Options/Classes/PolygonMask.js"(exports) {
    init_shims();
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.PolygonMask = void 0;
    var Enums_1 = require_Enums4();
    var Draw_1 = require_Draw();
    var Move_1 = require_Move2();
    var Inline_1 = require_Inline();
    var LocalSvg_1 = require_LocalSvg();
    var Utils_1 = require_Utils2();
    var PolygonMask = class {
      constructor() {
        this.draw = new Draw_1.Draw();
        this.enable = false;
        this.inline = new Inline_1.Inline();
        this.move = new Move_1.Move();
        this.scale = 1;
        this.type = Enums_1.Type.none;
      }
      get inlineArrangement() {
        return this.inline.arrangement;
      }
      set inlineArrangement(value) {
        this.inline.arrangement = value;
      }
      load(data) {
        var _a;
        if (data !== void 0) {
          this.draw.load(data.draw);
          const inline = (_a = data.inline) !== null && _a !== void 0 ? _a : {
            arrangement: data.inlineArrangement
          };
          if (inline !== void 0) {
            this.inline.load(inline);
          }
          this.move.load(data.move);
          if (data.scale !== void 0) {
            this.scale = data.scale;
          }
          if (data.type !== void 0) {
            this.type = data.type;
          }
          if (data.enable !== void 0) {
            this.enable = data.enable;
          } else {
            this.enable = this.type !== Enums_1.Type.none;
          }
          if (data.url !== void 0) {
            this.url = data.url;
          }
          if (data.data !== void 0) {
            if (typeof data.data === "string") {
              this.data = data.data;
            } else {
              this.data = new LocalSvg_1.LocalSvg();
              this.data.load(data.data);
            }
          }
          if (data.position !== void 0) {
            this.position = (0, Utils_1.deepExtend)({}, data.position);
          }
        }
      }
    };
    exports.PolygonMask = PolygonMask;
  }
});

// node_modules/tsparticles/Plugins/PolygonMask/utils.js
var require_utils = __commonJS({
  "node_modules/tsparticles/Plugins/PolygonMask/utils.js"(exports) {
    init_shims();
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.segmentBounce = exports.calcClosestPtOnSegment = exports.parsePaths = exports.drawPolygonMaskPath = exports.drawPolygonMask = void 0;
    var Utils_1 = require_Utils2();
    function drawPolygonMask(context, rawData, stroke) {
      const color = (0, Utils_1.colorToRgb)(stroke.color);
      if (!color) {
        return;
      }
      context.beginPath();
      context.moveTo(rawData[0].x, rawData[0].y);
      for (const item of rawData) {
        context.lineTo(item.x, item.y);
      }
      context.closePath();
      context.strokeStyle = (0, Utils_1.getStyleFromRgb)(color);
      context.lineWidth = stroke.width;
      context.stroke();
    }
    exports.drawPolygonMask = drawPolygonMask;
    function drawPolygonMaskPath(context, path, stroke, position) {
      context.translate(position.x, position.y);
      const color = (0, Utils_1.colorToRgb)(stroke.color);
      if (!color) {
        return;
      }
      context.strokeStyle = (0, Utils_1.getStyleFromRgb)(color, stroke.opacity);
      context.lineWidth = stroke.width;
      context.stroke(path);
    }
    exports.drawPolygonMaskPath = drawPolygonMaskPath;
    function parsePaths(paths, scale, offset) {
      var _a;
      const res = [];
      for (const path of paths) {
        const segments = path.element.pathSegList;
        const len = (_a = segments === null || segments === void 0 ? void 0 : segments.numberOfItems) !== null && _a !== void 0 ? _a : 0;
        const p = {
          x: 0,
          y: 0
        };
        for (let i = 0; i < len; i++) {
          const segment = segments === null || segments === void 0 ? void 0 : segments.getItem(i);
          const svgPathSeg = window.SVGPathSeg;
          switch (segment === null || segment === void 0 ? void 0 : segment.pathSegType) {
            case svgPathSeg.PATHSEG_MOVETO_ABS:
            case svgPathSeg.PATHSEG_LINETO_ABS:
            case svgPathSeg.PATHSEG_CURVETO_CUBIC_ABS:
            case svgPathSeg.PATHSEG_CURVETO_QUADRATIC_ABS:
            case svgPathSeg.PATHSEG_ARC_ABS:
            case svgPathSeg.PATHSEG_CURVETO_CUBIC_SMOOTH_ABS:
            case svgPathSeg.PATHSEG_CURVETO_QUADRATIC_SMOOTH_ABS: {
              const absSeg = segment;
              p.x = absSeg.x;
              p.y = absSeg.y;
              break;
            }
            case svgPathSeg.PATHSEG_LINETO_HORIZONTAL_ABS:
              p.x = segment.x;
              break;
            case svgPathSeg.PATHSEG_LINETO_VERTICAL_ABS:
              p.y = segment.y;
              break;
            case svgPathSeg.PATHSEG_LINETO_REL:
            case svgPathSeg.PATHSEG_MOVETO_REL:
            case svgPathSeg.PATHSEG_CURVETO_CUBIC_REL:
            case svgPathSeg.PATHSEG_CURVETO_QUADRATIC_REL:
            case svgPathSeg.PATHSEG_ARC_REL:
            case svgPathSeg.PATHSEG_CURVETO_CUBIC_SMOOTH_REL:
            case svgPathSeg.PATHSEG_CURVETO_QUADRATIC_SMOOTH_REL: {
              const relSeg = segment;
              p.x += relSeg.x;
              p.y += relSeg.y;
              break;
            }
            case svgPathSeg.PATHSEG_LINETO_HORIZONTAL_REL:
              p.x += segment.x;
              break;
            case svgPathSeg.PATHSEG_LINETO_VERTICAL_REL:
              p.y += segment.y;
              break;
            case svgPathSeg.PATHSEG_UNKNOWN:
            case svgPathSeg.PATHSEG_CLOSEPATH:
              continue;
          }
          res.push({
            x: p.x * scale + offset.x,
            y: p.y * scale + offset.y
          });
        }
      }
      return res;
    }
    exports.parsePaths = parsePaths;
    function calcClosestPtOnSegment(s1, s2, pos) {
      const { dx, dy } = (0, Utils_1.getDistances)(pos, s1);
      const { dx: dxx, dy: dyy } = (0, Utils_1.getDistances)(s2, s1);
      const t = (dx * dxx + dy * dyy) / (dxx ** 2 + dyy ** 2);
      let x = s1.x + dxx * t;
      let y = s1.y + dyy * t;
      if (t < 0) {
        x = s1.x;
        y = s1.y;
      } else if (t > 1) {
        x = s2.x;
        y = s2.y;
      }
      return { x, y, isOnSegment: t >= 0 && t <= 1 };
    }
    exports.calcClosestPtOnSegment = calcClosestPtOnSegment;
    function segmentBounce(start, stop, velocity) {
      const { dx, dy } = (0, Utils_1.getDistances)(start, stop);
      const wallAngle = Math.atan2(dy, dx);
      const wallNormalX = Math.sin(wallAngle);
      const wallNormalY = -Math.cos(wallAngle);
      const d = 2 * (velocity.x * wallNormalX + velocity.y * wallNormalY);
      velocity.x -= d * wallNormalX;
      velocity.y -= d * wallNormalY;
    }
    exports.segmentBounce = segmentBounce;
  }
});

// node_modules/tsparticles/Plugins/PolygonMask/PolygonMaskInstance.js
var require_PolygonMaskInstance = __commonJS({
  "node_modules/tsparticles/Plugins/PolygonMask/PolygonMaskInstance.js"(exports) {
    init_shims();
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.PolygonMaskInstance = void 0;
    var Enums_1 = require_Enums4();
    var Utils_1 = require_Utils2();
    var PolygonMask_1 = require_PolygonMask();
    var Enums_2 = require_Enums();
    var utils_1 = require_utils();
    var PolygonMaskInstance = class {
      constructor(container) {
        this.container = container;
        this.dimension = {
          height: 0,
          width: 0
        };
        this.path2DSupported = !!window.Path2D;
        this.options = new PolygonMask_1.PolygonMask();
        this.polygonMaskMoveRadius = this.options.move.radius * container.retina.pixelRatio;
      }
      async initAsync(options2) {
        this.options.load(options2 === null || options2 === void 0 ? void 0 : options2.polygon);
        const polygonMaskOptions = this.options;
        this.polygonMaskMoveRadius = polygonMaskOptions.move.radius * this.container.retina.pixelRatio;
        if (polygonMaskOptions.enable) {
          await this.initRawData();
        }
      }
      resize() {
        const container = this.container;
        const options2 = this.options;
        if (!(options2.enable && options2.type !== Enums_1.Type.none)) {
          return;
        }
        if (this.redrawTimeout) {
          clearTimeout(this.redrawTimeout);
        }
        this.redrawTimeout = window.setTimeout(async () => {
          await this.initRawData(true);
          container.particles.redraw();
        }, 250);
      }
      stop() {
        delete this.raw;
        delete this.paths;
      }
      particlesInitialization() {
        const options2 = this.options;
        if (options2.enable && options2.type === Enums_1.Type.inline && (options2.inline.arrangement === Enums_1.InlineArrangement.onePerPoint || options2.inline.arrangement === Enums_1.InlineArrangement.perPoint)) {
          this.drawPoints();
          return true;
        }
        return false;
      }
      particlePosition(position) {
        var _a, _b;
        const options2 = this.options;
        if (!(options2.enable && ((_b = (_a = this.raw) === null || _a === void 0 ? void 0 : _a.length) !== null && _b !== void 0 ? _b : 0) > 0)) {
          return;
        }
        return (0, Utils_1.deepExtend)({}, position ? position : this.randomPoint());
      }
      particleBounce(particle, delta, direction) {
        return this.polygonBounce(particle, delta, direction);
      }
      clickPositionValid(position) {
        const options2 = this.options;
        return options2.enable && options2.type !== Enums_1.Type.none && options2.type !== Enums_1.Type.inline && this.checkInsidePolygon(position);
      }
      draw(context) {
        var _a;
        if (!((_a = this.paths) === null || _a === void 0 ? void 0 : _a.length)) {
          return;
        }
        const options2 = this.options;
        const polygonDraw = options2.draw;
        if (!(options2.enable && polygonDraw.enable)) {
          return;
        }
        const rawData = this.raw;
        for (const path of this.paths) {
          const path2d = path.path2d;
          const path2dSupported = this.path2DSupported;
          if (!context) {
            continue;
          }
          if (path2dSupported && path2d && this.offset) {
            (0, utils_1.drawPolygonMaskPath)(context, path2d, polygonDraw.stroke, this.offset);
          } else if (rawData) {
            (0, utils_1.drawPolygonMask)(context, rawData, polygonDraw.stroke);
          }
        }
      }
      polygonBounce(particle, _delta, direction) {
        const options2 = this.options;
        if (!this.raw || !options2.enable || direction !== Enums_2.OutModeDirection.top) {
          return false;
        }
        if (options2.type === Enums_1.Type.inside || options2.type === Enums_1.Type.outside) {
          let closest, dx, dy;
          const pos = particle.getPosition(), radius = particle.getRadius();
          for (let i = 0, j = this.raw.length - 1; i < this.raw.length; j = i++) {
            const pi = this.raw[i], pj = this.raw[j];
            closest = (0, utils_1.calcClosestPtOnSegment)(pi, pj, pos);
            const dist = (0, Utils_1.getDistances)(pos, closest);
            [dx, dy] = [dist.dx, dist.dy];
            if (dist.distance < radius) {
              (0, utils_1.segmentBounce)(pi, pj, particle.velocity);
              return true;
            }
          }
          if (closest && dx !== void 0 && dy !== void 0 && !this.checkInsidePolygon(pos)) {
            const factor = { x: 1, y: 1 };
            if (particle.position.x >= closest.x) {
              factor.x = -1;
            }
            if (particle.position.y >= closest.y) {
              factor.y = -1;
            }
            particle.position.x = closest.x + radius * 2 * factor.x;
            particle.position.y = closest.y + radius * 2 * factor.y;
            particle.velocity.mult(-1);
            return true;
          }
        } else if (options2.type === Enums_1.Type.inline && particle.initialPosition) {
          const dist = (0, Utils_1.getDistance)(particle.initialPosition, particle.getPosition());
          if (dist > this.polygonMaskMoveRadius) {
            particle.velocity.x = particle.velocity.y / 2 - particle.velocity.x;
            particle.velocity.y = particle.velocity.x / 2 - particle.velocity.y;
            return true;
          }
        }
        return false;
      }
      checkInsidePolygon(position) {
        var _a, _b;
        const container = this.container;
        const options2 = this.options;
        if (!options2.enable || options2.type === Enums_1.Type.none || options2.type === Enums_1.Type.inline) {
          return true;
        }
        if (!this.raw) {
          throw new Error(Utils_1.Constants.noPolygonFound);
        }
        const canvasSize = container.canvas.size;
        const x = (_a = position === null || position === void 0 ? void 0 : position.x) !== null && _a !== void 0 ? _a : Math.random() * canvasSize.width;
        const y = (_b = position === null || position === void 0 ? void 0 : position.y) !== null && _b !== void 0 ? _b : Math.random() * canvasSize.height;
        let inside = false;
        for (let i = 0, j = this.raw.length - 1; i < this.raw.length; j = i++) {
          const pi = this.raw[i];
          const pj = this.raw[j];
          const intersect = pi.y > y !== pj.y > y && x < (pj.x - pi.x) * (y - pi.y) / (pj.y - pi.y) + pi.x;
          if (intersect) {
            inside = !inside;
          }
        }
        return options2.type === Enums_1.Type.inside ? inside : options2.type === Enums_1.Type.outside ? !inside : false;
      }
      parseSvgPath(xml, force) {
        var _a, _b, _c;
        const forceDownload = force !== null && force !== void 0 ? force : false;
        if (this.paths !== void 0 && !forceDownload) {
          return this.raw;
        }
        const container = this.container;
        const options2 = this.options;
        const parser = new DOMParser();
        const doc = parser.parseFromString(xml, "image/svg+xml");
        const svg = doc.getElementsByTagName("svg")[0];
        let svgPaths = svg.getElementsByTagName("path");
        if (!svgPaths.length) {
          svgPaths = doc.getElementsByTagName("path");
        }
        this.paths = [];
        for (let i = 0; i < svgPaths.length; i++) {
          const path = svgPaths.item(i);
          if (path) {
            this.paths.push({
              element: path,
              length: path.getTotalLength()
            });
          }
        }
        const pxRatio = container.retina.pixelRatio;
        const scale = options2.scale / pxRatio;
        this.dimension.width = parseFloat((_a = svg.getAttribute("width")) !== null && _a !== void 0 ? _a : "0") * scale;
        this.dimension.height = parseFloat((_b = svg.getAttribute("height")) !== null && _b !== void 0 ? _b : "0") * scale;
        const position = (_c = options2.position) !== null && _c !== void 0 ? _c : {
          x: 50,
          y: 50
        };
        this.offset = {
          x: container.canvas.size.width * position.x / (100 * pxRatio) - this.dimension.width / 2,
          y: container.canvas.size.height * position.y / (100 * pxRatio) - this.dimension.height / 2
        };
        return (0, utils_1.parsePaths)(this.paths, scale, this.offset);
      }
      async downloadSvgPath(svgUrl, force) {
        const options2 = this.options;
        const url = svgUrl || options2.url;
        const forceDownload = force !== null && force !== void 0 ? force : false;
        if (!url || this.paths !== void 0 && !forceDownload) {
          return this.raw;
        }
        const req = await fetch(url);
        if (!req.ok) {
          throw new Error("tsParticles Error - Error occurred during polygon mask download");
        }
        return this.parseSvgPath(await req.text(), force);
      }
      drawPoints() {
        if (!this.raw) {
          return;
        }
        for (const item of this.raw) {
          this.container.particles.addParticle({
            x: item.x,
            y: item.y
          });
        }
      }
      randomPoint() {
        const container = this.container;
        const options2 = this.options;
        let position;
        if (options2.type === Enums_1.Type.inline) {
          switch (options2.inline.arrangement) {
            case Enums_1.InlineArrangement.randomPoint:
              position = this.getRandomPoint();
              break;
            case Enums_1.InlineArrangement.randomLength:
              position = this.getRandomPointByLength();
              break;
            case Enums_1.InlineArrangement.equidistant:
              position = this.getEquidistantPointByIndex(container.particles.count);
              break;
            case Enums_1.InlineArrangement.onePerPoint:
            case Enums_1.InlineArrangement.perPoint:
            default:
              position = this.getPointByIndex(container.particles.count);
          }
        } else {
          position = {
            x: Math.random() * container.canvas.size.width,
            y: Math.random() * container.canvas.size.height
          };
        }
        if (this.checkInsidePolygon(position)) {
          return position;
        } else {
          return this.randomPoint();
        }
      }
      getRandomPoint() {
        if (!this.raw || !this.raw.length) {
          throw new Error(Utils_1.Constants.noPolygonDataLoaded);
        }
        const coords = (0, Utils_1.itemFromArray)(this.raw);
        return {
          x: coords.x,
          y: coords.y
        };
      }
      getRandomPointByLength() {
        var _a, _b, _c;
        const options2 = this.options;
        if (!this.raw || !this.raw.length || !((_a = this.paths) === null || _a === void 0 ? void 0 : _a.length)) {
          throw new Error(Utils_1.Constants.noPolygonDataLoaded);
        }
        const path = (0, Utils_1.itemFromArray)(this.paths);
        const distance = Math.floor(Math.random() * path.length) + 1;
        const point = path.element.getPointAtLength(distance);
        return {
          x: point.x * options2.scale + (((_b = this.offset) === null || _b === void 0 ? void 0 : _b.x) || 0),
          y: point.y * options2.scale + (((_c = this.offset) === null || _c === void 0 ? void 0 : _c.y) || 0)
        };
      }
      getEquidistantPointByIndex(index) {
        var _a, _b, _c, _d, _e, _f, _g;
        const options2 = this.container.actualOptions;
        const polygonMaskOptions = this.options;
        if (!this.raw || !this.raw.length || !((_a = this.paths) === null || _a === void 0 ? void 0 : _a.length))
          throw new Error(Utils_1.Constants.noPolygonDataLoaded);
        let offset = 0;
        let point;
        const totalLength = this.paths.reduce((tot, path) => tot + path.length, 0);
        const distance = totalLength / options2.particles.number.value;
        for (const path of this.paths) {
          const pathDistance = distance * index - offset;
          if (pathDistance <= path.length) {
            point = path.element.getPointAtLength(pathDistance);
            break;
          } else {
            offset += path.length;
          }
        }
        return {
          x: ((_b = point === null || point === void 0 ? void 0 : point.x) !== null && _b !== void 0 ? _b : 0) * polygonMaskOptions.scale + ((_d = (_c = this.offset) === null || _c === void 0 ? void 0 : _c.x) !== null && _d !== void 0 ? _d : 0),
          y: ((_e = point === null || point === void 0 ? void 0 : point.y) !== null && _e !== void 0 ? _e : 0) * polygonMaskOptions.scale + ((_g = (_f = this.offset) === null || _f === void 0 ? void 0 : _f.y) !== null && _g !== void 0 ? _g : 0)
        };
      }
      getPointByIndex(index) {
        if (!this.raw || !this.raw.length) {
          throw new Error(Utils_1.Constants.noPolygonDataLoaded);
        }
        const coords = this.raw[index % this.raw.length];
        return {
          x: coords.x,
          y: coords.y
        };
      }
      createPath2D() {
        var _a, _b;
        const options2 = this.options;
        if (!this.path2DSupported || !((_a = this.paths) === null || _a === void 0 ? void 0 : _a.length)) {
          return;
        }
        for (const path of this.paths) {
          const pathData = (_b = path.element) === null || _b === void 0 ? void 0 : _b.getAttribute("d");
          if (pathData) {
            const path2d = new Path2D(pathData);
            const matrix = document.createElementNS("http://www.w3.org/2000/svg", "svg").createSVGMatrix();
            const finalPath = new Path2D();
            const transform = matrix.scale(options2.scale);
            if (finalPath.addPath) {
              finalPath.addPath(path2d, transform);
              path.path2d = finalPath;
            } else {
              delete path.path2d;
            }
          } else {
            delete path.path2d;
          }
          if (path.path2d || !this.raw) {
            continue;
          }
          path.path2d = new Path2D();
          path.path2d.moveTo(this.raw[0].x, this.raw[0].y);
          this.raw.forEach((pos, i) => {
            var _a2;
            if (i > 0) {
              (_a2 = path.path2d) === null || _a2 === void 0 ? void 0 : _a2.lineTo(pos.x, pos.y);
            }
          });
          path.path2d.closePath();
        }
      }
      async initRawData(force) {
        const options2 = this.options;
        if (options2.url) {
          this.raw = await this.downloadSvgPath(options2.url, force);
        } else if (options2.data) {
          const data = options2.data;
          let svg;
          if (typeof data !== "string") {
            const path = data.path instanceof Array ? data.path.map((t) => `<path d="${t}" />`).join("") : `<path d="${data.path}" />`;
            const namespaces = 'xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"';
            svg = `<svg ${namespaces} width="${data.size.width}" height="${data.size.height}">${path}</svg>`;
          } else {
            svg = data;
          }
          this.raw = this.parseSvgPath(svg, force);
        }
        this.createPath2D();
      }
    };
    exports.PolygonMaskInstance = PolygonMaskInstance;
  }
});

// node_modules/tsparticles/Plugins/PolygonMask/pathseg.js
var require_pathseg = __commonJS({
  "node_modules/tsparticles/Plugins/PolygonMask/pathseg.js"() {
    init_shims();
    "use strict";
    (function() {
      "use strict";
      try {
        if (typeof window === "undefined")
          return;
        if (!("SVGPathSeg" in window)) {
          window.SVGPathSeg = function(type, typeAsLetter, owningPathSegList) {
            this.pathSegType = type;
            this.pathSegTypeAsLetter = typeAsLetter;
            this._owningPathSegList = owningPathSegList;
          };
          window.SVGPathSeg.prototype.classname = "SVGPathSeg";
          window.SVGPathSeg.PATHSEG_UNKNOWN = 0;
          window.SVGPathSeg.PATHSEG_CLOSEPATH = 1;
          window.SVGPathSeg.PATHSEG_MOVETO_ABS = 2;
          window.SVGPathSeg.PATHSEG_MOVETO_REL = 3;
          window.SVGPathSeg.PATHSEG_LINETO_ABS = 4;
          window.SVGPathSeg.PATHSEG_LINETO_REL = 5;
          window.SVGPathSeg.PATHSEG_CURVETO_CUBIC_ABS = 6;
          window.SVGPathSeg.PATHSEG_CURVETO_CUBIC_REL = 7;
          window.SVGPathSeg.PATHSEG_CURVETO_QUADRATIC_ABS = 8;
          window.SVGPathSeg.PATHSEG_CURVETO_QUADRATIC_REL = 9;
          window.SVGPathSeg.PATHSEG_ARC_ABS = 10;
          window.SVGPathSeg.PATHSEG_ARC_REL = 11;
          window.SVGPathSeg.PATHSEG_LINETO_HORIZONTAL_ABS = 12;
          window.SVGPathSeg.PATHSEG_LINETO_HORIZONTAL_REL = 13;
          window.SVGPathSeg.PATHSEG_LINETO_VERTICAL_ABS = 14;
          window.SVGPathSeg.PATHSEG_LINETO_VERTICAL_REL = 15;
          window.SVGPathSeg.PATHSEG_CURVETO_CUBIC_SMOOTH_ABS = 16;
          window.SVGPathSeg.PATHSEG_CURVETO_CUBIC_SMOOTH_REL = 17;
          window.SVGPathSeg.PATHSEG_CURVETO_QUADRATIC_SMOOTH_ABS = 18;
          window.SVGPathSeg.PATHSEG_CURVETO_QUADRATIC_SMOOTH_REL = 19;
          window.SVGPathSeg.prototype._segmentChanged = function() {
            if (this._owningPathSegList)
              this._owningPathSegList.segmentChanged(this);
          };
          window.SVGPathSegClosePath = function(owningPathSegList) {
            window.SVGPathSeg.call(this, window.SVGPathSeg.PATHSEG_CLOSEPATH, "z", owningPathSegList);
          };
          window.SVGPathSegClosePath.prototype = Object.create(window.SVGPathSeg.prototype);
          window.SVGPathSegClosePath.prototype.toString = function() {
            return "[object SVGPathSegClosePath]";
          };
          window.SVGPathSegClosePath.prototype._asPathString = function() {
            return this.pathSegTypeAsLetter;
          };
          window.SVGPathSegClosePath.prototype.clone = function() {
            return new window.SVGPathSegClosePath(void 0);
          };
          window.SVGPathSegMovetoAbs = function(owningPathSegList, x, y) {
            window.SVGPathSeg.call(this, window.SVGPathSeg.PATHSEG_MOVETO_ABS, "M", owningPathSegList);
            this._x = x;
            this._y = y;
          };
          window.SVGPathSegMovetoAbs.prototype = Object.create(window.SVGPathSeg.prototype);
          window.SVGPathSegMovetoAbs.prototype.toString = function() {
            return "[object SVGPathSegMovetoAbs]";
          };
          window.SVGPathSegMovetoAbs.prototype._asPathString = function() {
            return this.pathSegTypeAsLetter + " " + this._x + " " + this._y;
          };
          window.SVGPathSegMovetoAbs.prototype.clone = function() {
            return new window.SVGPathSegMovetoAbs(void 0, this._x, this._y);
          };
          Object.defineProperty(window.SVGPathSegMovetoAbs.prototype, "x", {
            get: function() {
              return this._x;
            },
            set: function(x) {
              this._x = x;
              this._segmentChanged();
            },
            enumerable: true
          });
          Object.defineProperty(window.SVGPathSegMovetoAbs.prototype, "y", {
            get: function() {
              return this._y;
            },
            set: function(y) {
              this._y = y;
              this._segmentChanged();
            },
            enumerable: true
          });
          window.SVGPathSegMovetoRel = function(owningPathSegList, x, y) {
            window.SVGPathSeg.call(this, window.SVGPathSeg.PATHSEG_MOVETO_REL, "m", owningPathSegList);
            this._x = x;
            this._y = y;
          };
          window.SVGPathSegMovetoRel.prototype = Object.create(window.SVGPathSeg.prototype);
          window.SVGPathSegMovetoRel.prototype.toString = function() {
            return "[object SVGPathSegMovetoRel]";
          };
          window.SVGPathSegMovetoRel.prototype._asPathString = function() {
            return this.pathSegTypeAsLetter + " " + this._x + " " + this._y;
          };
          window.SVGPathSegMovetoRel.prototype.clone = function() {
            return new window.SVGPathSegMovetoRel(void 0, this._x, this._y);
          };
          Object.defineProperty(window.SVGPathSegMovetoRel.prototype, "x", {
            get: function() {
              return this._x;
            },
            set: function(x) {
              this._x = x;
              this._segmentChanged();
            },
            enumerable: true
          });
          Object.defineProperty(window.SVGPathSegMovetoRel.prototype, "y", {
            get: function() {
              return this._y;
            },
            set: function(y) {
              this._y = y;
              this._segmentChanged();
            },
            enumerable: true
          });
          window.SVGPathSegLinetoAbs = function(owningPathSegList, x, y) {
            window.SVGPathSeg.call(this, window.SVGPathSeg.PATHSEG_LINETO_ABS, "L", owningPathSegList);
            this._x = x;
            this._y = y;
          };
          window.SVGPathSegLinetoAbs.prototype = Object.create(window.SVGPathSeg.prototype);
          window.SVGPathSegLinetoAbs.prototype.toString = function() {
            return "[object SVGPathSegLinetoAbs]";
          };
          window.SVGPathSegLinetoAbs.prototype._asPathString = function() {
            return this.pathSegTypeAsLetter + " " + this._x + " " + this._y;
          };
          window.SVGPathSegLinetoAbs.prototype.clone = function() {
            return new window.SVGPathSegLinetoAbs(void 0, this._x, this._y);
          };
          Object.defineProperty(window.SVGPathSegLinetoAbs.prototype, "x", {
            get: function() {
              return this._x;
            },
            set: function(x) {
              this._x = x;
              this._segmentChanged();
            },
            enumerable: true
          });
          Object.defineProperty(window.SVGPathSegLinetoAbs.prototype, "y", {
            get: function() {
              return this._y;
            },
            set: function(y) {
              this._y = y;
              this._segmentChanged();
            },
            enumerable: true
          });
          window.SVGPathSegLinetoRel = function(owningPathSegList, x, y) {
            window.SVGPathSeg.call(this, window.SVGPathSeg.PATHSEG_LINETO_REL, "l", owningPathSegList);
            this._x = x;
            this._y = y;
          };
          window.SVGPathSegLinetoRel.prototype = Object.create(window.SVGPathSeg.prototype);
          window.SVGPathSegLinetoRel.prototype.toString = function() {
            return "[object SVGPathSegLinetoRel]";
          };
          window.SVGPathSegLinetoRel.prototype._asPathString = function() {
            return this.pathSegTypeAsLetter + " " + this._x + " " + this._y;
          };
          window.SVGPathSegLinetoRel.prototype.clone = function() {
            return new window.SVGPathSegLinetoRel(void 0, this._x, this._y);
          };
          Object.defineProperty(window.SVGPathSegLinetoRel.prototype, "x", {
            get: function() {
              return this._x;
            },
            set: function(x) {
              this._x = x;
              this._segmentChanged();
            },
            enumerable: true
          });
          Object.defineProperty(window.SVGPathSegLinetoRel.prototype, "y", {
            get: function() {
              return this._y;
            },
            set: function(y) {
              this._y = y;
              this._segmentChanged();
            },
            enumerable: true
          });
          window.SVGPathSegCurvetoCubicAbs = function(owningPathSegList, x, y, x1, y1, x2, y2) {
            window.SVGPathSeg.call(this, window.SVGPathSeg.PATHSEG_CURVETO_CUBIC_ABS, "C", owningPathSegList);
            this._x = x;
            this._y = y;
            this._x1 = x1;
            this._y1 = y1;
            this._x2 = x2;
            this._y2 = y2;
          };
          window.SVGPathSegCurvetoCubicAbs.prototype = Object.create(window.SVGPathSeg.prototype);
          window.SVGPathSegCurvetoCubicAbs.prototype.toString = function() {
            return "[object SVGPathSegCurvetoCubicAbs]";
          };
          window.SVGPathSegCurvetoCubicAbs.prototype._asPathString = function() {
            return this.pathSegTypeAsLetter + " " + this._x1 + " " + this._y1 + " " + this._x2 + " " + this._y2 + " " + this._x + " " + this._y;
          };
          window.SVGPathSegCurvetoCubicAbs.prototype.clone = function() {
            return new window.SVGPathSegCurvetoCubicAbs(void 0, this._x, this._y, this._x1, this._y1, this._x2, this._y2);
          };
          Object.defineProperty(window.SVGPathSegCurvetoCubicAbs.prototype, "x", {
            get: function() {
              return this._x;
            },
            set: function(x) {
              this._x = x;
              this._segmentChanged();
            },
            enumerable: true
          });
          Object.defineProperty(window.SVGPathSegCurvetoCubicAbs.prototype, "y", {
            get: function() {
              return this._y;
            },
            set: function(y) {
              this._y = y;
              this._segmentChanged();
            },
            enumerable: true
          });
          Object.defineProperty(window.SVGPathSegCurvetoCubicAbs.prototype, "x1", {
            get: function() {
              return this._x1;
            },
            set: function(x1) {
              this._x1 = x1;
              this._segmentChanged();
            },
            enumerable: true
          });
          Object.defineProperty(window.SVGPathSegCurvetoCubicAbs.prototype, "y1", {
            get: function() {
              return this._y1;
            },
            set: function(y1) {
              this._y1 = y1;
              this._segmentChanged();
            },
            enumerable: true
          });
          Object.defineProperty(window.SVGPathSegCurvetoCubicAbs.prototype, "x2", {
            get: function() {
              return this._x2;
            },
            set: function(x2) {
              this._x2 = x2;
              this._segmentChanged();
            },
            enumerable: true
          });
          Object.defineProperty(window.SVGPathSegCurvetoCubicAbs.prototype, "y2", {
            get: function() {
              return this._y2;
            },
            set: function(y2) {
              this._y2 = y2;
              this._segmentChanged();
            },
            enumerable: true
          });
          window.SVGPathSegCurvetoCubicRel = function(owningPathSegList, x, y, x1, y1, x2, y2) {
            window.SVGPathSeg.call(this, window.SVGPathSeg.PATHSEG_CURVETO_CUBIC_REL, "c", owningPathSegList);
            this._x = x;
            this._y = y;
            this._x1 = x1;
            this._y1 = y1;
            this._x2 = x2;
            this._y2 = y2;
          };
          window.SVGPathSegCurvetoCubicRel.prototype = Object.create(window.SVGPathSeg.prototype);
          window.SVGPathSegCurvetoCubicRel.prototype.toString = function() {
            return "[object SVGPathSegCurvetoCubicRel]";
          };
          window.SVGPathSegCurvetoCubicRel.prototype._asPathString = function() {
            return this.pathSegTypeAsLetter + " " + this._x1 + " " + this._y1 + " " + this._x2 + " " + this._y2 + " " + this._x + " " + this._y;
          };
          window.SVGPathSegCurvetoCubicRel.prototype.clone = function() {
            return new window.SVGPathSegCurvetoCubicRel(void 0, this._x, this._y, this._x1, this._y1, this._x2, this._y2);
          };
          Object.defineProperty(window.SVGPathSegCurvetoCubicRel.prototype, "x", {
            get: function() {
              return this._x;
            },
            set: function(x) {
              this._x = x;
              this._segmentChanged();
            },
            enumerable: true
          });
          Object.defineProperty(window.SVGPathSegCurvetoCubicRel.prototype, "y", {
            get: function() {
              return this._y;
            },
            set: function(y) {
              this._y = y;
              this._segmentChanged();
            },
            enumerable: true
          });
          Object.defineProperty(window.SVGPathSegCurvetoCubicRel.prototype, "x1", {
            get: function() {
              return this._x1;
            },
            set: function(x1) {
              this._x1 = x1;
              this._segmentChanged();
            },
            enumerable: true
          });
          Object.defineProperty(window.SVGPathSegCurvetoCubicRel.prototype, "y1", {
            get: function() {
              return this._y1;
            },
            set: function(y1) {
              this._y1 = y1;
              this._segmentChanged();
            },
            enumerable: true
          });
          Object.defineProperty(window.SVGPathSegCurvetoCubicRel.prototype, "x2", {
            get: function() {
              return this._x2;
            },
            set: function(x2) {
              this._x2 = x2;
              this._segmentChanged();
            },
            enumerable: true
          });
          Object.defineProperty(window.SVGPathSegCurvetoCubicRel.prototype, "y2", {
            get: function() {
              return this._y2;
            },
            set: function(y2) {
              this._y2 = y2;
              this._segmentChanged();
            },
            enumerable: true
          });
          window.SVGPathSegCurvetoQuadraticAbs = function(owningPathSegList, x, y, x1, y1) {
            window.SVGPathSeg.call(this, window.SVGPathSeg.PATHSEG_CURVETO_QUADRATIC_ABS, "Q", owningPathSegList);
            this._x = x;
            this._y = y;
            this._x1 = x1;
            this._y1 = y1;
          };
          window.SVGPathSegCurvetoQuadraticAbs.prototype = Object.create(window.SVGPathSeg.prototype);
          window.SVGPathSegCurvetoQuadraticAbs.prototype.toString = function() {
            return "[object SVGPathSegCurvetoQuadraticAbs]";
          };
          window.SVGPathSegCurvetoQuadraticAbs.prototype._asPathString = function() {
            return this.pathSegTypeAsLetter + " " + this._x1 + " " + this._y1 + " " + this._x + " " + this._y;
          };
          window.SVGPathSegCurvetoQuadraticAbs.prototype.clone = function() {
            return new window.SVGPathSegCurvetoQuadraticAbs(void 0, this._x, this._y, this._x1, this._y1);
          };
          Object.defineProperty(window.SVGPathSegCurvetoQuadraticAbs.prototype, "x", {
            get: function() {
              return this._x;
            },
            set: function(x) {
              this._x = x;
              this._segmentChanged();
            },
            enumerable: true
          });
          Object.defineProperty(window.SVGPathSegCurvetoQuadraticAbs.prototype, "y", {
            get: function() {
              return this._y;
            },
            set: function(y) {
              this._y = y;
              this._segmentChanged();
            },
            enumerable: true
          });
          Object.defineProperty(window.SVGPathSegCurvetoQuadraticAbs.prototype, "x1", {
            get: function() {
              return this._x1;
            },
            set: function(x1) {
              this._x1 = x1;
              this._segmentChanged();
            },
            enumerable: true
          });
          Object.defineProperty(window.SVGPathSegCurvetoQuadraticAbs.prototype, "y1", {
            get: function() {
              return this._y1;
            },
            set: function(y1) {
              this._y1 = y1;
              this._segmentChanged();
            },
            enumerable: true
          });
          window.SVGPathSegCurvetoQuadraticRel = function(owningPathSegList, x, y, x1, y1) {
            window.SVGPathSeg.call(this, window.SVGPathSeg.PATHSEG_CURVETO_QUADRATIC_REL, "q", owningPathSegList);
            this._x = x;
            this._y = y;
            this._x1 = x1;
            this._y1 = y1;
          };
          window.SVGPathSegCurvetoQuadraticRel.prototype = Object.create(window.SVGPathSeg.prototype);
          window.SVGPathSegCurvetoQuadraticRel.prototype.toString = function() {
            return "[object SVGPathSegCurvetoQuadraticRel]";
          };
          window.SVGPathSegCurvetoQuadraticRel.prototype._asPathString = function() {
            return this.pathSegTypeAsLetter + " " + this._x1 + " " + this._y1 + " " + this._x + " " + this._y;
          };
          window.SVGPathSegCurvetoQuadraticRel.prototype.clone = function() {
            return new window.SVGPathSegCurvetoQuadraticRel(void 0, this._x, this._y, this._x1, this._y1);
          };
          Object.defineProperty(window.SVGPathSegCurvetoQuadraticRel.prototype, "x", {
            get: function() {
              return this._x;
            },
            set: function(x) {
              this._x = x;
              this._segmentChanged();
            },
            enumerable: true
          });
          Object.defineProperty(window.SVGPathSegCurvetoQuadraticRel.prototype, "y", {
            get: function() {
              return this._y;
            },
            set: function(y) {
              this._y = y;
              this._segmentChanged();
            },
            enumerable: true
          });
          Object.defineProperty(window.SVGPathSegCurvetoQuadraticRel.prototype, "x1", {
            get: function() {
              return this._x1;
            },
            set: function(x1) {
              this._x1 = x1;
              this._segmentChanged();
            },
            enumerable: true
          });
          Object.defineProperty(window.SVGPathSegCurvetoQuadraticRel.prototype, "y1", {
            get: function() {
              return this._y1;
            },
            set: function(y1) {
              this._y1 = y1;
              this._segmentChanged();
            },
            enumerable: true
          });
          window.SVGPathSegArcAbs = function(owningPathSegList, x, y, r1, r2, angle, largeArcFlag, sweepFlag) {
            window.SVGPathSeg.call(this, window.SVGPathSeg.PATHSEG_ARC_ABS, "A", owningPathSegList);
            this._x = x;
            this._y = y;
            this._r1 = r1;
            this._r2 = r2;
            this._angle = angle;
            this._largeArcFlag = largeArcFlag;
            this._sweepFlag = sweepFlag;
          };
          window.SVGPathSegArcAbs.prototype = Object.create(window.SVGPathSeg.prototype);
          window.SVGPathSegArcAbs.prototype.toString = function() {
            return "[object SVGPathSegArcAbs]";
          };
          window.SVGPathSegArcAbs.prototype._asPathString = function() {
            return this.pathSegTypeAsLetter + " " + this._r1 + " " + this._r2 + " " + this._angle + " " + (this._largeArcFlag ? "1" : "0") + " " + (this._sweepFlag ? "1" : "0") + " " + this._x + " " + this._y;
          };
          window.SVGPathSegArcAbs.prototype.clone = function() {
            return new window.SVGPathSegArcAbs(void 0, this._x, this._y, this._r1, this._r2, this._angle, this._largeArcFlag, this._sweepFlag);
          };
          Object.defineProperty(window.SVGPathSegArcAbs.prototype, "x", {
            get: function() {
              return this._x;
            },
            set: function(x) {
              this._x = x;
              this._segmentChanged();
            },
            enumerable: true
          });
          Object.defineProperty(window.SVGPathSegArcAbs.prototype, "y", {
            get: function() {
              return this._y;
            },
            set: function(y) {
              this._y = y;
              this._segmentChanged();
            },
            enumerable: true
          });
          Object.defineProperty(window.SVGPathSegArcAbs.prototype, "r1", {
            get: function() {
              return this._r1;
            },
            set: function(r1) {
              this._r1 = r1;
              this._segmentChanged();
            },
            enumerable: true
          });
          Object.defineProperty(window.SVGPathSegArcAbs.prototype, "r2", {
            get: function() {
              return this._r2;
            },
            set: function(r2) {
              this._r2 = r2;
              this._segmentChanged();
            },
            enumerable: true
          });
          Object.defineProperty(window.SVGPathSegArcAbs.prototype, "angle", {
            get: function() {
              return this._angle;
            },
            set: function(angle) {
              this._angle = angle;
              this._segmentChanged();
            },
            enumerable: true
          });
          Object.defineProperty(window.SVGPathSegArcAbs.prototype, "largeArcFlag", {
            get: function() {
              return this._largeArcFlag;
            },
            set: function(largeArcFlag) {
              this._largeArcFlag = largeArcFlag;
              this._segmentChanged();
            },
            enumerable: true
          });
          Object.defineProperty(window.SVGPathSegArcAbs.prototype, "sweepFlag", {
            get: function() {
              return this._sweepFlag;
            },
            set: function(sweepFlag) {
              this._sweepFlag = sweepFlag;
              this._segmentChanged();
            },
            enumerable: true
          });
          window.SVGPathSegArcRel = function(owningPathSegList, x, y, r1, r2, angle, largeArcFlag, sweepFlag) {
            window.SVGPathSeg.call(this, window.SVGPathSeg.PATHSEG_ARC_REL, "a", owningPathSegList);
            this._x = x;
            this._y = y;
            this._r1 = r1;
            this._r2 = r2;
            this._angle = angle;
            this._largeArcFlag = largeArcFlag;
            this._sweepFlag = sweepFlag;
          };
          window.SVGPathSegArcRel.prototype = Object.create(window.SVGPathSeg.prototype);
          window.SVGPathSegArcRel.prototype.toString = function() {
            return "[object SVGPathSegArcRel]";
          };
          window.SVGPathSegArcRel.prototype._asPathString = function() {
            return this.pathSegTypeAsLetter + " " + this._r1 + " " + this._r2 + " " + this._angle + " " + (this._largeArcFlag ? "1" : "0") + " " + (this._sweepFlag ? "1" : "0") + " " + this._x + " " + this._y;
          };
          window.SVGPathSegArcRel.prototype.clone = function() {
            return new window.SVGPathSegArcRel(void 0, this._x, this._y, this._r1, this._r2, this._angle, this._largeArcFlag, this._sweepFlag);
          };
          Object.defineProperty(window.SVGPathSegArcRel.prototype, "x", {
            get: function() {
              return this._x;
            },
            set: function(x) {
              this._x = x;
              this._segmentChanged();
            },
            enumerable: true
          });
          Object.defineProperty(window.SVGPathSegArcRel.prototype, "y", {
            get: function() {
              return this._y;
            },
            set: function(y) {
              this._y = y;
              this._segmentChanged();
            },
            enumerable: true
          });
          Object.defineProperty(window.SVGPathSegArcRel.prototype, "r1", {
            get: function() {
              return this._r1;
            },
            set: function(r1) {
              this._r1 = r1;
              this._segmentChanged();
            },
            enumerable: true
          });
          Object.defineProperty(window.SVGPathSegArcRel.prototype, "r2", {
            get: function() {
              return this._r2;
            },
            set: function(r2) {
              this._r2 = r2;
              this._segmentChanged();
            },
            enumerable: true
          });
          Object.defineProperty(window.SVGPathSegArcRel.prototype, "angle", {
            get: function() {
              return this._angle;
            },
            set: function(angle) {
              this._angle = angle;
              this._segmentChanged();
            },
            enumerable: true
          });
          Object.defineProperty(window.SVGPathSegArcRel.prototype, "largeArcFlag", {
            get: function() {
              return this._largeArcFlag;
            },
            set: function(largeArcFlag) {
              this._largeArcFlag = largeArcFlag;
              this._segmentChanged();
            },
            enumerable: true
          });
          Object.defineProperty(window.SVGPathSegArcRel.prototype, "sweepFlag", {
            get: function() {
              return this._sweepFlag;
            },
            set: function(sweepFlag) {
              this._sweepFlag = sweepFlag;
              this._segmentChanged();
            },
            enumerable: true
          });
          window.SVGPathSegLinetoHorizontalAbs = function(owningPathSegList, x) {
            window.SVGPathSeg.call(this, window.SVGPathSeg.PATHSEG_LINETO_HORIZONTAL_ABS, "H", owningPathSegList);
            this._x = x;
          };
          window.SVGPathSegLinetoHorizontalAbs.prototype = Object.create(window.SVGPathSeg.prototype);
          window.SVGPathSegLinetoHorizontalAbs.prototype.toString = function() {
            return "[object SVGPathSegLinetoHorizontalAbs]";
          };
          window.SVGPathSegLinetoHorizontalAbs.prototype._asPathString = function() {
            return this.pathSegTypeAsLetter + " " + this._x;
          };
          window.SVGPathSegLinetoHorizontalAbs.prototype.clone = function() {
            return new window.SVGPathSegLinetoHorizontalAbs(void 0, this._x);
          };
          Object.defineProperty(window.SVGPathSegLinetoHorizontalAbs.prototype, "x", {
            get: function() {
              return this._x;
            },
            set: function(x) {
              this._x = x;
              this._segmentChanged();
            },
            enumerable: true
          });
          window.SVGPathSegLinetoHorizontalRel = function(owningPathSegList, x) {
            window.SVGPathSeg.call(this, window.SVGPathSeg.PATHSEG_LINETO_HORIZONTAL_REL, "h", owningPathSegList);
            this._x = x;
          };
          window.SVGPathSegLinetoHorizontalRel.prototype = Object.create(window.SVGPathSeg.prototype);
          window.SVGPathSegLinetoHorizontalRel.prototype.toString = function() {
            return "[object SVGPathSegLinetoHorizontalRel]";
          };
          window.SVGPathSegLinetoHorizontalRel.prototype._asPathString = function() {
            return this.pathSegTypeAsLetter + " " + this._x;
          };
          window.SVGPathSegLinetoHorizontalRel.prototype.clone = function() {
            return new window.SVGPathSegLinetoHorizontalRel(void 0, this._x);
          };
          Object.defineProperty(window.SVGPathSegLinetoHorizontalRel.prototype, "x", {
            get: function() {
              return this._x;
            },
            set: function(x) {
              this._x = x;
              this._segmentChanged();
            },
            enumerable: true
          });
          window.SVGPathSegLinetoVerticalAbs = function(owningPathSegList, y) {
            window.SVGPathSeg.call(this, window.SVGPathSeg.PATHSEG_LINETO_VERTICAL_ABS, "V", owningPathSegList);
            this._y = y;
          };
          window.SVGPathSegLinetoVerticalAbs.prototype = Object.create(window.SVGPathSeg.prototype);
          window.SVGPathSegLinetoVerticalAbs.prototype.toString = function() {
            return "[object SVGPathSegLinetoVerticalAbs]";
          };
          window.SVGPathSegLinetoVerticalAbs.prototype._asPathString = function() {
            return this.pathSegTypeAsLetter + " " + this._y;
          };
          window.SVGPathSegLinetoVerticalAbs.prototype.clone = function() {
            return new window.SVGPathSegLinetoVerticalAbs(void 0, this._y);
          };
          Object.defineProperty(window.SVGPathSegLinetoVerticalAbs.prototype, "y", {
            get: function() {
              return this._y;
            },
            set: function(y) {
              this._y = y;
              this._segmentChanged();
            },
            enumerable: true
          });
          window.SVGPathSegLinetoVerticalRel = function(owningPathSegList, y) {
            window.SVGPathSeg.call(this, window.SVGPathSeg.PATHSEG_LINETO_VERTICAL_REL, "v", owningPathSegList);
            this._y = y;
          };
          window.SVGPathSegLinetoVerticalRel.prototype = Object.create(window.SVGPathSeg.prototype);
          window.SVGPathSegLinetoVerticalRel.prototype.toString = function() {
            return "[object SVGPathSegLinetoVerticalRel]";
          };
          window.SVGPathSegLinetoVerticalRel.prototype._asPathString = function() {
            return this.pathSegTypeAsLetter + " " + this._y;
          };
          window.SVGPathSegLinetoVerticalRel.prototype.clone = function() {
            return new window.SVGPathSegLinetoVerticalRel(void 0, this._y);
          };
          Object.defineProperty(window.SVGPathSegLinetoVerticalRel.prototype, "y", {
            get: function() {
              return this._y;
            },
            set: function(y) {
              this._y = y;
              this._segmentChanged();
            },
            enumerable: true
          });
          window.SVGPathSegCurvetoCubicSmoothAbs = function(owningPathSegList, x, y, x2, y2) {
            window.SVGPathSeg.call(this, window.SVGPathSeg.PATHSEG_CURVETO_CUBIC_SMOOTH_ABS, "S", owningPathSegList);
            this._x = x;
            this._y = y;
            this._x2 = x2;
            this._y2 = y2;
          };
          window.SVGPathSegCurvetoCubicSmoothAbs.prototype = Object.create(window.SVGPathSeg.prototype);
          window.SVGPathSegCurvetoCubicSmoothAbs.prototype.toString = function() {
            return "[object SVGPathSegCurvetoCubicSmoothAbs]";
          };
          window.SVGPathSegCurvetoCubicSmoothAbs.prototype._asPathString = function() {
            return this.pathSegTypeAsLetter + " " + this._x2 + " " + this._y2 + " " + this._x + " " + this._y;
          };
          window.SVGPathSegCurvetoCubicSmoothAbs.prototype.clone = function() {
            return new window.SVGPathSegCurvetoCubicSmoothAbs(void 0, this._x, this._y, this._x2, this._y2);
          };
          Object.defineProperty(window.SVGPathSegCurvetoCubicSmoothAbs.prototype, "x", {
            get: function() {
              return this._x;
            },
            set: function(x) {
              this._x = x;
              this._segmentChanged();
            },
            enumerable: true
          });
          Object.defineProperty(window.SVGPathSegCurvetoCubicSmoothAbs.prototype, "y", {
            get: function() {
              return this._y;
            },
            set: function(y) {
              this._y = y;
              this._segmentChanged();
            },
            enumerable: true
          });
          Object.defineProperty(window.SVGPathSegCurvetoCubicSmoothAbs.prototype, "x2", {
            get: function() {
              return this._x2;
            },
            set: function(x2) {
              this._x2 = x2;
              this._segmentChanged();
            },
            enumerable: true
          });
          Object.defineProperty(window.SVGPathSegCurvetoCubicSmoothAbs.prototype, "y2", {
            get: function() {
              return this._y2;
            },
            set: function(y2) {
              this._y2 = y2;
              this._segmentChanged();
            },
            enumerable: true
          });
          window.SVGPathSegCurvetoCubicSmoothRel = function(owningPathSegList, x, y, x2, y2) {
            window.SVGPathSeg.call(this, window.SVGPathSeg.PATHSEG_CURVETO_CUBIC_SMOOTH_REL, "s", owningPathSegList);
            this._x = x;
            this._y = y;
            this._x2 = x2;
            this._y2 = y2;
          };
          window.SVGPathSegCurvetoCubicSmoothRel.prototype = Object.create(window.SVGPathSeg.prototype);
          window.SVGPathSegCurvetoCubicSmoothRel.prototype.toString = function() {
            return "[object SVGPathSegCurvetoCubicSmoothRel]";
          };
          window.SVGPathSegCurvetoCubicSmoothRel.prototype._asPathString = function() {
            return this.pathSegTypeAsLetter + " " + this._x2 + " " + this._y2 + " " + this._x + " " + this._y;
          };
          window.SVGPathSegCurvetoCubicSmoothRel.prototype.clone = function() {
            return new window.SVGPathSegCurvetoCubicSmoothRel(void 0, this._x, this._y, this._x2, this._y2);
          };
          Object.defineProperty(window.SVGPathSegCurvetoCubicSmoothRel.prototype, "x", {
            get: function() {
              return this._x;
            },
            set: function(x) {
              this._x = x;
              this._segmentChanged();
            },
            enumerable: true
          });
          Object.defineProperty(window.SVGPathSegCurvetoCubicSmoothRel.prototype, "y", {
            get: function() {
              return this._y;
            },
            set: function(y) {
              this._y = y;
              this._segmentChanged();
            },
            enumerable: true
          });
          Object.defineProperty(window.SVGPathSegCurvetoCubicSmoothRel.prototype, "x2", {
            get: function() {
              return this._x2;
            },
            set: function(x2) {
              this._x2 = x2;
              this._segmentChanged();
            },
            enumerable: true
          });
          Object.defineProperty(window.SVGPathSegCurvetoCubicSmoothRel.prototype, "y2", {
            get: function() {
              return this._y2;
            },
            set: function(y2) {
              this._y2 = y2;
              this._segmentChanged();
            },
            enumerable: true
          });
          window.SVGPathSegCurvetoQuadraticSmoothAbs = function(owningPathSegList, x, y) {
            window.SVGPathSeg.call(this, window.SVGPathSeg.PATHSEG_CURVETO_QUADRATIC_SMOOTH_ABS, "T", owningPathSegList);
            this._x = x;
            this._y = y;
          };
          window.SVGPathSegCurvetoQuadraticSmoothAbs.prototype = Object.create(window.SVGPathSeg.prototype);
          window.SVGPathSegCurvetoQuadraticSmoothAbs.prototype.toString = function() {
            return "[object SVGPathSegCurvetoQuadraticSmoothAbs]";
          };
          window.SVGPathSegCurvetoQuadraticSmoothAbs.prototype._asPathString = function() {
            return this.pathSegTypeAsLetter + " " + this._x + " " + this._y;
          };
          window.SVGPathSegCurvetoQuadraticSmoothAbs.prototype.clone = function() {
            return new window.SVGPathSegCurvetoQuadraticSmoothAbs(void 0, this._x, this._y);
          };
          Object.defineProperty(window.SVGPathSegCurvetoQuadraticSmoothAbs.prototype, "x", {
            get: function() {
              return this._x;
            },
            set: function(x) {
              this._x = x;
              this._segmentChanged();
            },
            enumerable: true
          });
          Object.defineProperty(window.SVGPathSegCurvetoQuadraticSmoothAbs.prototype, "y", {
            get: function() {
              return this._y;
            },
            set: function(y) {
              this._y = y;
              this._segmentChanged();
            },
            enumerable: true
          });
          window.SVGPathSegCurvetoQuadraticSmoothRel = function(owningPathSegList, x, y) {
            window.SVGPathSeg.call(this, window.SVGPathSeg.PATHSEG_CURVETO_QUADRATIC_SMOOTH_REL, "t", owningPathSegList);
            this._x = x;
            this._y = y;
          };
          window.SVGPathSegCurvetoQuadraticSmoothRel.prototype = Object.create(window.SVGPathSeg.prototype);
          window.SVGPathSegCurvetoQuadraticSmoothRel.prototype.toString = function() {
            return "[object SVGPathSegCurvetoQuadraticSmoothRel]";
          };
          window.SVGPathSegCurvetoQuadraticSmoothRel.prototype._asPathString = function() {
            return this.pathSegTypeAsLetter + " " + this._x + " " + this._y;
          };
          window.SVGPathSegCurvetoQuadraticSmoothRel.prototype.clone = function() {
            return new window.SVGPathSegCurvetoQuadraticSmoothRel(void 0, this._x, this._y);
          };
          Object.defineProperty(window.SVGPathSegCurvetoQuadraticSmoothRel.prototype, "x", {
            get: function() {
              return this._x;
            },
            set: function(x) {
              this._x = x;
              this._segmentChanged();
            },
            enumerable: true
          });
          Object.defineProperty(window.SVGPathSegCurvetoQuadraticSmoothRel.prototype, "y", {
            get: function() {
              return this._y;
            },
            set: function(y) {
              this._y = y;
              this._segmentChanged();
            },
            enumerable: true
          });
          window.SVGPathElement.prototype.createSVGPathSegClosePath = function() {
            return new window.SVGPathSegClosePath(void 0);
          };
          window.SVGPathElement.prototype.createSVGPathSegMovetoAbs = function(x, y) {
            return new window.SVGPathSegMovetoAbs(void 0, x, y);
          };
          window.SVGPathElement.prototype.createSVGPathSegMovetoRel = function(x, y) {
            return new window.SVGPathSegMovetoRel(void 0, x, y);
          };
          window.SVGPathElement.prototype.createSVGPathSegLinetoAbs = function(x, y) {
            return new window.SVGPathSegLinetoAbs(void 0, x, y);
          };
          window.SVGPathElement.prototype.createSVGPathSegLinetoRel = function(x, y) {
            return new window.SVGPathSegLinetoRel(void 0, x, y);
          };
          window.SVGPathElement.prototype.createSVGPathSegCurvetoCubicAbs = function(x, y, x1, y1, x2, y2) {
            return new window.SVGPathSegCurvetoCubicAbs(void 0, x, y, x1, y1, x2, y2);
          };
          window.SVGPathElement.prototype.createSVGPathSegCurvetoCubicRel = function(x, y, x1, y1, x2, y2) {
            return new window.SVGPathSegCurvetoCubicRel(void 0, x, y, x1, y1, x2, y2);
          };
          window.SVGPathElement.prototype.createSVGPathSegCurvetoQuadraticAbs = function(x, y, x1, y1) {
            return new window.SVGPathSegCurvetoQuadraticAbs(void 0, x, y, x1, y1);
          };
          window.SVGPathElement.prototype.createSVGPathSegCurvetoQuadraticRel = function(x, y, x1, y1) {
            return new window.SVGPathSegCurvetoQuadraticRel(void 0, x, y, x1, y1);
          };
          window.SVGPathElement.prototype.createSVGPathSegArcAbs = function(x, y, r1, r2, angle, largeArcFlag, sweepFlag) {
            return new window.SVGPathSegArcAbs(void 0, x, y, r1, r2, angle, largeArcFlag, sweepFlag);
          };
          window.SVGPathElement.prototype.createSVGPathSegArcRel = function(x, y, r1, r2, angle, largeArcFlag, sweepFlag) {
            return new window.SVGPathSegArcRel(void 0, x, y, r1, r2, angle, largeArcFlag, sweepFlag);
          };
          window.SVGPathElement.prototype.createSVGPathSegLinetoHorizontalAbs = function(x) {
            return new window.SVGPathSegLinetoHorizontalAbs(void 0, x);
          };
          window.SVGPathElement.prototype.createSVGPathSegLinetoHorizontalRel = function(x) {
            return new window.SVGPathSegLinetoHorizontalRel(void 0, x);
          };
          window.SVGPathElement.prototype.createSVGPathSegLinetoVerticalAbs = function(y) {
            return new window.SVGPathSegLinetoVerticalAbs(void 0, y);
          };
          window.SVGPathElement.prototype.createSVGPathSegLinetoVerticalRel = function(y) {
            return new window.SVGPathSegLinetoVerticalRel(void 0, y);
          };
          window.SVGPathElement.prototype.createSVGPathSegCurvetoCubicSmoothAbs = function(x, y, x2, y2) {
            return new window.SVGPathSegCurvetoCubicSmoothAbs(void 0, x, y, x2, y2);
          };
          window.SVGPathElement.prototype.createSVGPathSegCurvetoCubicSmoothRel = function(x, y, x2, y2) {
            return new window.SVGPathSegCurvetoCubicSmoothRel(void 0, x, y, x2, y2);
          };
          window.SVGPathElement.prototype.createSVGPathSegCurvetoQuadraticSmoothAbs = function(x, y) {
            return new window.SVGPathSegCurvetoQuadraticSmoothAbs(void 0, x, y);
          };
          window.SVGPathElement.prototype.createSVGPathSegCurvetoQuadraticSmoothRel = function(x, y) {
            return new window.SVGPathSegCurvetoQuadraticSmoothRel(void 0, x, y);
          };
          if (!("getPathSegAtLength" in window.SVGPathElement.prototype)) {
            window.SVGPathElement.prototype.getPathSegAtLength = function(distance) {
              if (distance === void 0 || !isFinite(distance))
                throw "Invalid arguments.";
              var measurementElement = document.createElementNS("http://www.w3.org/2000/svg", "path");
              measurementElement.setAttribute("d", this.getAttribute("d"));
              var lastPathSegment = measurementElement.pathSegList.numberOfItems - 1;
              if (lastPathSegment <= 0)
                return 0;
              do {
                measurementElement.pathSegList.removeItem(lastPathSegment);
                if (distance > measurementElement.getTotalLength())
                  break;
                lastPathSegment--;
              } while (lastPathSegment > 0);
              return lastPathSegment;
            };
          }
        }
        if (!("SVGPathSegList" in window) || !("appendItem" in window.SVGPathSegList.prototype)) {
          window.SVGPathSegList = function(pathElement) {
            this._pathElement = pathElement;
            this._list = this._parsePath(this._pathElement.getAttribute("d"));
            this._mutationObserverConfig = { attributes: true, attributeFilter: ["d"] };
            this._pathElementMutationObserver = new MutationObserver(this._updateListFromPathMutations.bind(this));
            this._pathElementMutationObserver.observe(this._pathElement, this._mutationObserverConfig);
          };
          window.SVGPathSegList.prototype.classname = "SVGPathSegList";
          Object.defineProperty(window.SVGPathSegList.prototype, "numberOfItems", {
            get: function() {
              this._checkPathSynchronizedToList();
              return this._list.length;
            },
            enumerable: true
          });
          Object.defineProperty(window.SVGPathSegList.prototype, "length", {
            get: function() {
              this._checkPathSynchronizedToList();
              return this._list.length;
            },
            enumerable: true
          });
          Object.defineProperty(window.SVGPathElement.prototype, "pathSegList", {
            get: function() {
              if (!this._pathSegList)
                this._pathSegList = new window.SVGPathSegList(this);
              return this._pathSegList;
            },
            enumerable: true
          });
          Object.defineProperty(window.SVGPathElement.prototype, "normalizedPathSegList", {
            get: function() {
              return this.pathSegList;
            },
            enumerable: true
          });
          Object.defineProperty(window.SVGPathElement.prototype, "animatedPathSegList", {
            get: function() {
              return this.pathSegList;
            },
            enumerable: true
          });
          Object.defineProperty(window.SVGPathElement.prototype, "animatedNormalizedPathSegList", {
            get: function() {
              return this.pathSegList;
            },
            enumerable: true
          });
          window.SVGPathSegList.prototype._checkPathSynchronizedToList = function() {
            this._updateListFromPathMutations(this._pathElementMutationObserver.takeRecords());
          };
          window.SVGPathSegList.prototype._updateListFromPathMutations = function(mutationRecords) {
            if (!this._pathElement)
              return;
            var hasPathMutations = false;
            mutationRecords.forEach(function(record) {
              if (record.attributeName == "d")
                hasPathMutations = true;
            });
            if (hasPathMutations)
              this._list = this._parsePath(this._pathElement.getAttribute("d"));
          };
          window.SVGPathSegList.prototype._writeListToPath = function() {
            this._pathElementMutationObserver.disconnect();
            this._pathElement.setAttribute("d", window.SVGPathSegList._pathSegArrayAsString(this._list));
            this._pathElementMutationObserver.observe(this._pathElement, this._mutationObserverConfig);
          };
          window.SVGPathSegList.prototype.segmentChanged = function(pathSeg) {
            this._writeListToPath();
          };
          window.SVGPathSegList.prototype.clear = function() {
            this._checkPathSynchronizedToList();
            this._list.forEach(function(pathSeg) {
              pathSeg._owningPathSegList = null;
            });
            this._list = [];
            this._writeListToPath();
          };
          window.SVGPathSegList.prototype.initialize = function(newItem) {
            this._checkPathSynchronizedToList();
            this._list = [newItem];
            newItem._owningPathSegList = this;
            this._writeListToPath();
            return newItem;
          };
          window.SVGPathSegList.prototype._checkValidIndex = function(index) {
            if (isNaN(index) || index < 0 || index >= this.numberOfItems)
              throw "INDEX_SIZE_ERR";
          };
          window.SVGPathSegList.prototype.getItem = function(index) {
            this._checkPathSynchronizedToList();
            this._checkValidIndex(index);
            return this._list[index];
          };
          window.SVGPathSegList.prototype.insertItemBefore = function(newItem, index) {
            this._checkPathSynchronizedToList();
            if (index > this.numberOfItems)
              index = this.numberOfItems;
            if (newItem._owningPathSegList) {
              newItem = newItem.clone();
            }
            this._list.splice(index, 0, newItem);
            newItem._owningPathSegList = this;
            this._writeListToPath();
            return newItem;
          };
          window.SVGPathSegList.prototype.replaceItem = function(newItem, index) {
            this._checkPathSynchronizedToList();
            if (newItem._owningPathSegList) {
              newItem = newItem.clone();
            }
            this._checkValidIndex(index);
            this._list[index] = newItem;
            newItem._owningPathSegList = this;
            this._writeListToPath();
            return newItem;
          };
          window.SVGPathSegList.prototype.removeItem = function(index) {
            this._checkPathSynchronizedToList();
            this._checkValidIndex(index);
            var item = this._list[index];
            this._list.splice(index, 1);
            this._writeListToPath();
            return item;
          };
          window.SVGPathSegList.prototype.appendItem = function(newItem) {
            this._checkPathSynchronizedToList();
            if (newItem._owningPathSegList) {
              newItem = newItem.clone();
            }
            this._list.push(newItem);
            newItem._owningPathSegList = this;
            this._writeListToPath();
            return newItem;
          };
          window.SVGPathSegList._pathSegArrayAsString = function(pathSegArray) {
            var string = "";
            var first = true;
            pathSegArray.forEach(function(pathSeg) {
              if (first) {
                first = false;
                string += pathSeg._asPathString();
              } else {
                string += " " + pathSeg._asPathString();
              }
            });
            return string;
          };
          window.SVGPathSegList.prototype._parsePath = function(string) {
            if (!string || string.length == 0)
              return [];
            var owningPathSegList = this;
            var Builder = function() {
              this.pathSegList = [];
            };
            Builder.prototype.appendSegment = function(pathSeg2) {
              this.pathSegList.push(pathSeg2);
            };
            var Source = function(string2) {
              this._string = string2;
              this._currentIndex = 0;
              this._endIndex = this._string.length;
              this._previousCommand = window.SVGPathSeg.PATHSEG_UNKNOWN;
              this._skipOptionalSpaces();
            };
            Source.prototype._isCurrentSpace = function() {
              var character = this._string[this._currentIndex];
              return character <= " " && (character == " " || character == "\n" || character == "	" || character == "\r" || character == "\f");
            };
            Source.prototype._skipOptionalSpaces = function() {
              while (this._currentIndex < this._endIndex && this._isCurrentSpace())
                this._currentIndex++;
              return this._currentIndex < this._endIndex;
            };
            Source.prototype._skipOptionalSpacesOrDelimiter = function() {
              if (this._currentIndex < this._endIndex && !this._isCurrentSpace() && this._string.charAt(this._currentIndex) != ",")
                return false;
              if (this._skipOptionalSpaces()) {
                if (this._currentIndex < this._endIndex && this._string.charAt(this._currentIndex) == ",") {
                  this._currentIndex++;
                  this._skipOptionalSpaces();
                }
              }
              return this._currentIndex < this._endIndex;
            };
            Source.prototype.hasMoreData = function() {
              return this._currentIndex < this._endIndex;
            };
            Source.prototype.peekSegmentType = function() {
              var lookahead = this._string[this._currentIndex];
              return this._pathSegTypeFromChar(lookahead);
            };
            Source.prototype._pathSegTypeFromChar = function(lookahead) {
              switch (lookahead) {
                case "Z":
                case "z":
                  return window.SVGPathSeg.PATHSEG_CLOSEPATH;
                case "M":
                  return window.SVGPathSeg.PATHSEG_MOVETO_ABS;
                case "m":
                  return window.SVGPathSeg.PATHSEG_MOVETO_REL;
                case "L":
                  return window.SVGPathSeg.PATHSEG_LINETO_ABS;
                case "l":
                  return window.SVGPathSeg.PATHSEG_LINETO_REL;
                case "C":
                  return window.SVGPathSeg.PATHSEG_CURVETO_CUBIC_ABS;
                case "c":
                  return window.SVGPathSeg.PATHSEG_CURVETO_CUBIC_REL;
                case "Q":
                  return window.SVGPathSeg.PATHSEG_CURVETO_QUADRATIC_ABS;
                case "q":
                  return window.SVGPathSeg.PATHSEG_CURVETO_QUADRATIC_REL;
                case "A":
                  return window.SVGPathSeg.PATHSEG_ARC_ABS;
                case "a":
                  return window.SVGPathSeg.PATHSEG_ARC_REL;
                case "H":
                  return window.SVGPathSeg.PATHSEG_LINETO_HORIZONTAL_ABS;
                case "h":
                  return window.SVGPathSeg.PATHSEG_LINETO_HORIZONTAL_REL;
                case "V":
                  return window.SVGPathSeg.PATHSEG_LINETO_VERTICAL_ABS;
                case "v":
                  return window.SVGPathSeg.PATHSEG_LINETO_VERTICAL_REL;
                case "S":
                  return window.SVGPathSeg.PATHSEG_CURVETO_CUBIC_SMOOTH_ABS;
                case "s":
                  return window.SVGPathSeg.PATHSEG_CURVETO_CUBIC_SMOOTH_REL;
                case "T":
                  return window.SVGPathSeg.PATHSEG_CURVETO_QUADRATIC_SMOOTH_ABS;
                case "t":
                  return window.SVGPathSeg.PATHSEG_CURVETO_QUADRATIC_SMOOTH_REL;
                default:
                  return window.SVGPathSeg.PATHSEG_UNKNOWN;
              }
            };
            Source.prototype._nextCommandHelper = function(lookahead, previousCommand) {
              if ((lookahead == "+" || lookahead == "-" || lookahead == "." || lookahead >= "0" && lookahead <= "9") && previousCommand != window.SVGPathSeg.PATHSEG_CLOSEPATH) {
                if (previousCommand == window.SVGPathSeg.PATHSEG_MOVETO_ABS)
                  return window.SVGPathSeg.PATHSEG_LINETO_ABS;
                if (previousCommand == window.SVGPathSeg.PATHSEG_MOVETO_REL)
                  return window.SVGPathSeg.PATHSEG_LINETO_REL;
                return previousCommand;
              }
              return window.SVGPathSeg.PATHSEG_UNKNOWN;
            };
            Source.prototype.initialCommandIsMoveTo = function() {
              if (!this.hasMoreData())
                return true;
              var command = this.peekSegmentType();
              return command == window.SVGPathSeg.PATHSEG_MOVETO_ABS || command == window.SVGPathSeg.PATHSEG_MOVETO_REL;
            };
            Source.prototype._parseNumber = function() {
              var exponent = 0;
              var integer = 0;
              var frac = 1;
              var decimal = 0;
              var sign = 1;
              var expsign = 1;
              var startIndex = this._currentIndex;
              this._skipOptionalSpaces();
              if (this._currentIndex < this._endIndex && this._string.charAt(this._currentIndex) == "+")
                this._currentIndex++;
              else if (this._currentIndex < this._endIndex && this._string.charAt(this._currentIndex) == "-") {
                this._currentIndex++;
                sign = -1;
              }
              if (this._currentIndex == this._endIndex || (this._string.charAt(this._currentIndex) < "0" || this._string.charAt(this._currentIndex) > "9") && this._string.charAt(this._currentIndex) != ".")
                return void 0;
              var startIntPartIndex = this._currentIndex;
              while (this._currentIndex < this._endIndex && this._string.charAt(this._currentIndex) >= "0" && this._string.charAt(this._currentIndex) <= "9")
                this._currentIndex++;
              if (this._currentIndex != startIntPartIndex) {
                var scanIntPartIndex = this._currentIndex - 1;
                var multiplier = 1;
                while (scanIntPartIndex >= startIntPartIndex) {
                  integer += multiplier * (this._string.charAt(scanIntPartIndex--) - "0");
                  multiplier *= 10;
                }
              }
              if (this._currentIndex < this._endIndex && this._string.charAt(this._currentIndex) == ".") {
                this._currentIndex++;
                if (this._currentIndex >= this._endIndex || this._string.charAt(this._currentIndex) < "0" || this._string.charAt(this._currentIndex) > "9")
                  return void 0;
                while (this._currentIndex < this._endIndex && this._string.charAt(this._currentIndex) >= "0" && this._string.charAt(this._currentIndex) <= "9") {
                  frac *= 10;
                  decimal += (this._string.charAt(this._currentIndex) - "0") / frac;
                  this._currentIndex += 1;
                }
              }
              if (this._currentIndex != startIndex && this._currentIndex + 1 < this._endIndex && (this._string.charAt(this._currentIndex) == "e" || this._string.charAt(this._currentIndex) == "E") && this._string.charAt(this._currentIndex + 1) != "x" && this._string.charAt(this._currentIndex + 1) != "m") {
                this._currentIndex++;
                if (this._string.charAt(this._currentIndex) == "+") {
                  this._currentIndex++;
                } else if (this._string.charAt(this._currentIndex) == "-") {
                  this._currentIndex++;
                  expsign = -1;
                }
                if (this._currentIndex >= this._endIndex || this._string.charAt(this._currentIndex) < "0" || this._string.charAt(this._currentIndex) > "9")
                  return void 0;
                while (this._currentIndex < this._endIndex && this._string.charAt(this._currentIndex) >= "0" && this._string.charAt(this._currentIndex) <= "9") {
                  exponent *= 10;
                  exponent += this._string.charAt(this._currentIndex) - "0";
                  this._currentIndex++;
                }
              }
              var number = integer + decimal;
              number *= sign;
              if (exponent)
                number *= Math.pow(10, expsign * exponent);
              if (startIndex == this._currentIndex)
                return void 0;
              this._skipOptionalSpacesOrDelimiter();
              return number;
            };
            Source.prototype._parseArcFlag = function() {
              if (this._currentIndex >= this._endIndex)
                return void 0;
              var flag = false;
              var flagChar = this._string.charAt(this._currentIndex++);
              if (flagChar == "0")
                flag = false;
              else if (flagChar == "1")
                flag = true;
              else
                return void 0;
              this._skipOptionalSpacesOrDelimiter();
              return flag;
            };
            Source.prototype.parseSegment = function() {
              var lookahead = this._string[this._currentIndex];
              var command = this._pathSegTypeFromChar(lookahead);
              if (command == window.SVGPathSeg.PATHSEG_UNKNOWN) {
                if (this._previousCommand == window.SVGPathSeg.PATHSEG_UNKNOWN)
                  return null;
                command = this._nextCommandHelper(lookahead, this._previousCommand);
                if (command == window.SVGPathSeg.PATHSEG_UNKNOWN)
                  return null;
              } else {
                this._currentIndex++;
              }
              this._previousCommand = command;
              switch (command) {
                case window.SVGPathSeg.PATHSEG_MOVETO_REL:
                  return new window.SVGPathSegMovetoRel(owningPathSegList, this._parseNumber(), this._parseNumber());
                case window.SVGPathSeg.PATHSEG_MOVETO_ABS:
                  return new window.SVGPathSegMovetoAbs(owningPathSegList, this._parseNumber(), this._parseNumber());
                case window.SVGPathSeg.PATHSEG_LINETO_REL:
                  return new window.SVGPathSegLinetoRel(owningPathSegList, this._parseNumber(), this._parseNumber());
                case window.SVGPathSeg.PATHSEG_LINETO_ABS:
                  return new window.SVGPathSegLinetoAbs(owningPathSegList, this._parseNumber(), this._parseNumber());
                case window.SVGPathSeg.PATHSEG_LINETO_HORIZONTAL_REL:
                  return new window.SVGPathSegLinetoHorizontalRel(owningPathSegList, this._parseNumber());
                case window.SVGPathSeg.PATHSEG_LINETO_HORIZONTAL_ABS:
                  return new window.SVGPathSegLinetoHorizontalAbs(owningPathSegList, this._parseNumber());
                case window.SVGPathSeg.PATHSEG_LINETO_VERTICAL_REL:
                  return new window.SVGPathSegLinetoVerticalRel(owningPathSegList, this._parseNumber());
                case window.SVGPathSeg.PATHSEG_LINETO_VERTICAL_ABS:
                  return new window.SVGPathSegLinetoVerticalAbs(owningPathSegList, this._parseNumber());
                case window.SVGPathSeg.PATHSEG_CLOSEPATH:
                  this._skipOptionalSpaces();
                  return new window.SVGPathSegClosePath(owningPathSegList);
                case window.SVGPathSeg.PATHSEG_CURVETO_CUBIC_REL:
                  var points = {
                    x1: this._parseNumber(),
                    y1: this._parseNumber(),
                    x2: this._parseNumber(),
                    y2: this._parseNumber(),
                    x: this._parseNumber(),
                    y: this._parseNumber()
                  };
                  return new window.SVGPathSegCurvetoCubicRel(owningPathSegList, points.x, points.y, points.x1, points.y1, points.x2, points.y2);
                case window.SVGPathSeg.PATHSEG_CURVETO_CUBIC_ABS:
                  var points = {
                    x1: this._parseNumber(),
                    y1: this._parseNumber(),
                    x2: this._parseNumber(),
                    y2: this._parseNumber(),
                    x: this._parseNumber(),
                    y: this._parseNumber()
                  };
                  return new window.SVGPathSegCurvetoCubicAbs(owningPathSegList, points.x, points.y, points.x1, points.y1, points.x2, points.y2);
                case window.SVGPathSeg.PATHSEG_CURVETO_CUBIC_SMOOTH_REL:
                  var points = {
                    x2: this._parseNumber(),
                    y2: this._parseNumber(),
                    x: this._parseNumber(),
                    y: this._parseNumber()
                  };
                  return new window.SVGPathSegCurvetoCubicSmoothRel(owningPathSegList, points.x, points.y, points.x2, points.y2);
                case window.SVGPathSeg.PATHSEG_CURVETO_CUBIC_SMOOTH_ABS:
                  var points = {
                    x2: this._parseNumber(),
                    y2: this._parseNumber(),
                    x: this._parseNumber(),
                    y: this._parseNumber()
                  };
                  return new window.SVGPathSegCurvetoCubicSmoothAbs(owningPathSegList, points.x, points.y, points.x2, points.y2);
                case window.SVGPathSeg.PATHSEG_CURVETO_QUADRATIC_REL:
                  var points = {
                    x1: this._parseNumber(),
                    y1: this._parseNumber(),
                    x: this._parseNumber(),
                    y: this._parseNumber()
                  };
                  return new window.SVGPathSegCurvetoQuadraticRel(owningPathSegList, points.x, points.y, points.x1, points.y1);
                case window.SVGPathSeg.PATHSEG_CURVETO_QUADRATIC_ABS:
                  var points = {
                    x1: this._parseNumber(),
                    y1: this._parseNumber(),
                    x: this._parseNumber(),
                    y: this._parseNumber()
                  };
                  return new window.SVGPathSegCurvetoQuadraticAbs(owningPathSegList, points.x, points.y, points.x1, points.y1);
                case window.SVGPathSeg.PATHSEG_CURVETO_QUADRATIC_SMOOTH_REL:
                  return new window.SVGPathSegCurvetoQuadraticSmoothRel(owningPathSegList, this._parseNumber(), this._parseNumber());
                case window.SVGPathSeg.PATHSEG_CURVETO_QUADRATIC_SMOOTH_ABS:
                  return new window.SVGPathSegCurvetoQuadraticSmoothAbs(owningPathSegList, this._parseNumber(), this._parseNumber());
                case window.SVGPathSeg.PATHSEG_ARC_REL:
                  var points = {
                    x1: this._parseNumber(),
                    y1: this._parseNumber(),
                    arcAngle: this._parseNumber(),
                    arcLarge: this._parseArcFlag(),
                    arcSweep: this._parseArcFlag(),
                    x: this._parseNumber(),
                    y: this._parseNumber()
                  };
                  return new window.SVGPathSegArcRel(owningPathSegList, points.x, points.y, points.x1, points.y1, points.arcAngle, points.arcLarge, points.arcSweep);
                case window.SVGPathSeg.PATHSEG_ARC_ABS:
                  var points = {
                    x1: this._parseNumber(),
                    y1: this._parseNumber(),
                    arcAngle: this._parseNumber(),
                    arcLarge: this._parseArcFlag(),
                    arcSweep: this._parseArcFlag(),
                    x: this._parseNumber(),
                    y: this._parseNumber()
                  };
                  return new window.SVGPathSegArcAbs(owningPathSegList, points.x, points.y, points.x1, points.y1, points.arcAngle, points.arcLarge, points.arcSweep);
                default:
                  throw "Unknown path seg type.";
              }
            };
            var builder = new Builder();
            var source = new Source(string);
            if (!source.initialCommandIsMoveTo())
              return [];
            while (source.hasMoreData()) {
              var pathSeg = source.parseSegment();
              if (!pathSeg)
                return [];
              builder.appendSegment(pathSeg);
            }
            return builder.pathSegList;
          };
        }
      } catch (e) {
        console.warn("An error occurred in tsParticles pathseg polyfill. If the Polygon Mask is not working, please open an issue here: https://github.com/matteobruni/tsparticles", e);
      }
    })();
  }
});

// node_modules/tsparticles/Plugins/PolygonMask/plugin.js
var require_plugin4 = __commonJS({
  "node_modules/tsparticles/Plugins/PolygonMask/plugin.js"(exports) {
    init_shims();
    "use strict";
    var __createBinding = exports && exports.__createBinding || (Object.create ? function(o, m, k, k2) {
      if (k2 === void 0)
        k2 = k;
      Object.defineProperty(o, k2, { enumerable: true, get: function() {
        return m[k];
      } });
    } : function(o, m, k, k2) {
      if (k2 === void 0)
        k2 = k;
      o[k2] = m[k];
    });
    var __setModuleDefault = exports && exports.__setModuleDefault || (Object.create ? function(o, v) {
      Object.defineProperty(o, "default", { enumerable: true, value: v });
    } : function(o, v) {
      o["default"] = v;
    });
    var __importStar = exports && exports.__importStar || function(mod) {
      if (mod && mod.__esModule)
        return mod;
      var result = {};
      if (mod != null) {
        for (var k in mod)
          if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k))
            __createBinding(result, mod, k);
      }
      __setModuleDefault(result, mod);
      return result;
    };
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.loadPolygonMaskPlugin = void 0;
    var PolygonMaskInstance_1 = require_PolygonMaskInstance();
    var PolygonMask_1 = require_PolygonMask();
    var Enums_1 = require_Enums4();
    var Utils_1 = require_Utils2();
    var Plugin = class {
      constructor() {
        this.id = "polygonMask";
      }
      getPlugin(container) {
        return new PolygonMaskInstance_1.PolygonMaskInstance(container);
      }
      needsPlugin(options2) {
        var _a, _b, _c;
        return (_b = (_a = options2 === null || options2 === void 0 ? void 0 : options2.polygon) === null || _a === void 0 ? void 0 : _a.enable) !== null && _b !== void 0 ? _b : ((_c = options2 === null || options2 === void 0 ? void 0 : options2.polygon) === null || _c === void 0 ? void 0 : _c.type) !== void 0 && options2.polygon.type !== Enums_1.Type.none;
      }
      loadOptions(options2, source) {
        if (!this.needsPlugin(source)) {
          return;
        }
        const optionsCast = options2;
        let polygonOptions = optionsCast.polygon;
        if ((polygonOptions === null || polygonOptions === void 0 ? void 0 : polygonOptions.load) === void 0) {
          optionsCast.polygon = polygonOptions = new PolygonMask_1.PolygonMask();
        }
        polygonOptions.load(source === null || source === void 0 ? void 0 : source.polygon);
      }
    };
    async function loadPolygonMaskPlugin(tsParticles) {
      if (!(0, Utils_1.isSsr)() && !window.SVGPathSeg) {
        await Promise.resolve().then(() => __importStar(require_pathseg()));
      }
      const plugin = new Plugin();
      await tsParticles.addPlugin(plugin);
    }
    exports.loadPolygonMaskPlugin = loadPolygonMaskPlugin;
  }
});

// node_modules/tsparticles/Updaters/Roll/RollUpdater.js
var require_RollUpdater = __commonJS({
  "node_modules/tsparticles/Updaters/Roll/RollUpdater.js"(exports) {
    init_shims();
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.RollUpdater = void 0;
    var Utils_1 = require_Utils2();
    var Enums_1 = require_Enums();
    function updateRoll(particle, delta) {
      const roll = particle.options.roll;
      if (!particle.roll || !roll.enable) {
        return;
      }
      const speed = particle.roll.speed * delta.factor;
      const max = 2 * Math.PI;
      particle.roll.angle += speed;
      if (particle.roll.angle > max) {
        particle.roll.angle -= max;
      }
    }
    var RollUpdater = class {
      init(particle) {
        const rollOpt = particle.options.roll;
        if (rollOpt.enable) {
          particle.roll = {
            angle: Math.random() * Math.PI * 2,
            speed: (0, Utils_1.getRangeValue)(rollOpt.speed) / 360
          };
          if (rollOpt.backColor) {
            particle.backColor = (0, Utils_1.colorToHsl)(rollOpt.backColor);
          } else if (rollOpt.darken.enable && rollOpt.enlighten.enable) {
            const alterType = Math.random() >= 0.5 ? Enums_1.AlterType.darken : Enums_1.AlterType.enlighten;
            particle.roll.alter = {
              type: alterType,
              value: alterType === Enums_1.AlterType.darken ? rollOpt.darken.value : rollOpt.enlighten.value
            };
          } else if (rollOpt.darken.enable) {
            particle.roll.alter = {
              type: Enums_1.AlterType.darken,
              value: rollOpt.darken.value
            };
          } else if (rollOpt.enlighten.enable) {
            particle.roll.alter = {
              type: Enums_1.AlterType.enlighten,
              value: rollOpt.enlighten.value
            };
          }
        } else {
          particle.roll = { angle: 0, speed: 0 };
        }
      }
      isEnabled(particle) {
        const roll = particle.options.roll;
        return !particle.destroyed && !particle.spawning && roll.enable;
      }
      update(particle, delta) {
        if (!this.isEnabled(particle)) {
          return;
        }
        updateRoll(particle, delta);
      }
    };
    exports.RollUpdater = RollUpdater;
  }
});

// node_modules/tsparticles/Updaters/Roll/index.js
var require_Roll2 = __commonJS({
  "node_modules/tsparticles/Updaters/Roll/index.js"(exports) {
    init_shims();
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.loadRollUpdater = void 0;
    var RollUpdater_1 = require_RollUpdater();
    async function loadRollUpdater(tsParticles) {
      await tsParticles.addParticleUpdater("roll", () => new RollUpdater_1.RollUpdater());
    }
    exports.loadRollUpdater = loadRollUpdater;
  }
});

// node_modules/tsparticles/full.js
var require_full = __commonJS({
  "node_modules/tsparticles/full.js"(exports) {
    init_shims();
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.loadFull = void 0;
    var slim_1 = require_slim();
    var Trail_1 = require_Trail3();
    var Tilt_1 = require_Tilt2();
    var Wobble_1 = require_Wobble2();
    var plugin_1 = require_plugin2();
    var plugin_2 = require_plugin3();
    var plugin_3 = require_plugin4();
    var Roll_1 = require_Roll2();
    async function loadFull(tsParticles) {
      await (0, slim_1.loadSlim)(tsParticles);
      await (0, Trail_1.loadExternalTrailInteraction)(tsParticles);
      await (0, Roll_1.loadRollUpdater)(tsParticles);
      await (0, Tilt_1.loadTiltUpdater)(tsParticles);
      await (0, Wobble_1.loadWobbleUpdater)(tsParticles);
      await (0, plugin_1.loadAbsorbersPlugin)(tsParticles);
      await (0, plugin_2.loadEmittersPlugin)(tsParticles);
      await (0, plugin_3.loadPolygonMaskPlugin)(tsParticles);
    }
    exports.loadFull = loadFull;
  }
});

// node_modules/tsparticles/Types/RangeValue.js
var require_RangeValue = __commonJS({
  "node_modules/tsparticles/Types/RangeValue.js"(exports) {
    init_shims();
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
  }
});

// node_modules/tsparticles/Types/RecursivePartial.js
var require_RecursivePartial = __commonJS({
  "node_modules/tsparticles/Types/RecursivePartial.js"(exports) {
    init_shims();
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
  }
});

// node_modules/tsparticles/Types/ShapeData.js
var require_ShapeData = __commonJS({
  "node_modules/tsparticles/Types/ShapeData.js"(exports) {
    init_shims();
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
  }
});

// node_modules/tsparticles/Types/ShapeDrawerFunctions.js
var require_ShapeDrawerFunctions = __commonJS({
  "node_modules/tsparticles/Types/ShapeDrawerFunctions.js"(exports) {
    init_shims();
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
  }
});

// node_modules/tsparticles/Types/SingleOrMultiple.js
var require_SingleOrMultiple = __commonJS({
  "node_modules/tsparticles/Types/SingleOrMultiple.js"(exports) {
    init_shims();
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
  }
});

// node_modules/tsparticles/Types/PathOptions.js
var require_PathOptions = __commonJS({
  "node_modules/tsparticles/Types/PathOptions.js"(exports) {
    init_shims();
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
  }
});

// node_modules/tsparticles/Types/index.js
var require_Types2 = __commonJS({
  "node_modules/tsparticles/Types/index.js"(exports) {
    init_shims();
    "use strict";
    var __createBinding = exports && exports.__createBinding || (Object.create ? function(o, m, k, k2) {
      if (k2 === void 0)
        k2 = k;
      Object.defineProperty(o, k2, { enumerable: true, get: function() {
        return m[k];
      } });
    } : function(o, m, k, k2) {
      if (k2 === void 0)
        k2 = k;
      o[k2] = m[k];
    });
    var __exportStar = exports && exports.__exportStar || function(m, exports2) {
      for (var p in m)
        if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports2, p))
          __createBinding(exports2, m, p);
    };
    Object.defineProperty(exports, "__esModule", { value: true });
    __exportStar(require_RangeValue(), exports);
    __exportStar(require_RecursivePartial(), exports);
    __exportStar(require_ShapeData(), exports);
    __exportStar(require_ShapeDrawerFunctions(), exports);
    __exportStar(require_SingleOrMultiple(), exports);
    __exportStar(require_PathOptions(), exports);
  }
});

// node_modules/tsparticles/Core/Interfaces/Colors.js
var require_Colors = __commonJS({
  "node_modules/tsparticles/Core/Interfaces/Colors.js"(exports) {
    init_shims();
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
  }
});

// node_modules/tsparticles/Core/Interfaces/Gradients.js
var require_Gradients = __commonJS({
  "node_modules/tsparticles/Core/Interfaces/Gradients.js"(exports) {
    init_shims();
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
  }
});

// node_modules/tsparticles/Core/Interfaces/IAttract.js
var require_IAttract = __commonJS({
  "node_modules/tsparticles/Core/Interfaces/IAttract.js"(exports) {
    init_shims();
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
  }
});

// node_modules/tsparticles/Core/Interfaces/IBounds.js
var require_IBounds = __commonJS({
  "node_modules/tsparticles/Core/Interfaces/IBounds.js"(exports) {
    init_shims();
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
  }
});

// node_modules/tsparticles/Core/Interfaces/IBubble.js
var require_IBubble = __commonJS({
  "node_modules/tsparticles/Core/Interfaces/IBubble.js"(exports) {
    init_shims();
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
  }
});

// node_modules/tsparticles/Core/Interfaces/IBubbleParticleData.js
var require_IBubbleParticleData = __commonJS({
  "node_modules/tsparticles/Core/Interfaces/IBubbleParticleData.js"(exports) {
    init_shims();
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
  }
});

// node_modules/tsparticles/Core/Interfaces/ICircleBouncer.js
var require_ICircleBouncer = __commonJS({
  "node_modules/tsparticles/Core/Interfaces/ICircleBouncer.js"(exports) {
    init_shims();
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
  }
});

// node_modules/tsparticles/Core/Interfaces/IContainerInteractivity.js
var require_IContainerInteractivity = __commonJS({
  "node_modules/tsparticles/Core/Interfaces/IContainerInteractivity.js"(exports) {
    init_shims();
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
  }
});

// node_modules/tsparticles/Core/Interfaces/IContainerPlugin.js
var require_IContainerPlugin = __commonJS({
  "node_modules/tsparticles/Core/Interfaces/IContainerPlugin.js"(exports) {
    init_shims();
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
  }
});

// node_modules/tsparticles/Core/Interfaces/ICoordinates.js
var require_ICoordinates = __commonJS({
  "node_modules/tsparticles/Core/Interfaces/ICoordinates.js"(exports) {
    init_shims();
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
  }
});

// node_modules/tsparticles/Core/Interfaces/IDelta.js
var require_IDelta = __commonJS({
  "node_modules/tsparticles/Core/Interfaces/IDelta.js"(exports) {
    init_shims();
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
  }
});

// node_modules/tsparticles/Core/Interfaces/IDimension.js
var require_IDimension = __commonJS({
  "node_modules/tsparticles/Core/Interfaces/IDimension.js"(exports) {
    init_shims();
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
  }
});

// node_modules/tsparticles/Core/Interfaces/IDistance.js
var require_IDistance = __commonJS({
  "node_modules/tsparticles/Core/Interfaces/IDistance.js"(exports) {
    init_shims();
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
  }
});

// node_modules/tsparticles/Core/Interfaces/IExternalInteractor.js
var require_IExternalInteractor = __commonJS({
  "node_modules/tsparticles/Core/Interfaces/IExternalInteractor.js"(exports) {
    init_shims();
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
  }
});

// node_modules/tsparticles/Core/Interfaces/IInteractor.js
var require_IInteractor = __commonJS({
  "node_modules/tsparticles/Core/Interfaces/IInteractor.js"(exports) {
    init_shims();
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
  }
});

// node_modules/tsparticles/Core/Interfaces/IMouseData.js
var require_IMouseData = __commonJS({
  "node_modules/tsparticles/Core/Interfaces/IMouseData.js"(exports) {
    init_shims();
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
  }
});

// node_modules/tsparticles/Core/Interfaces/IMovePathGenerator.js
var require_IMovePathGenerator = __commonJS({
  "node_modules/tsparticles/Core/Interfaces/IMovePathGenerator.js"(exports) {
    init_shims();
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
  }
});

// node_modules/tsparticles/Core/Interfaces/IParticle.js
var require_IParticle = __commonJS({
  "node_modules/tsparticles/Core/Interfaces/IParticle.js"(exports) {
    init_shims();
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
  }
});

// node_modules/tsparticles/Core/Interfaces/IParticleGradientAnimation.js
var require_IParticleGradientAnimation = __commonJS({
  "node_modules/tsparticles/Core/Interfaces/IParticleGradientAnimation.js"(exports) {
    init_shims();
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
  }
});

// node_modules/tsparticles/Core/Interfaces/IParticleGradientColorAnimation.js
var require_IParticleGradientColorAnimation = __commonJS({
  "node_modules/tsparticles/Core/Interfaces/IParticleGradientColorAnimation.js"(exports) {
    init_shims();
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
  }
});

// node_modules/tsparticles/Core/Interfaces/IParticleHslAnimation.js
var require_IParticleHslAnimation = __commonJS({
  "node_modules/tsparticles/Core/Interfaces/IParticleHslAnimation.js"(exports) {
    init_shims();
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
  }
});

// node_modules/tsparticles/Core/Interfaces/IParticleLife.js
var require_IParticleLife = __commonJS({
  "node_modules/tsparticles/Core/Interfaces/IParticleLife.js"(exports) {
    init_shims();
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
  }
});

// node_modules/tsparticles/Core/Interfaces/IParticleLoops.js
var require_IParticleLoops = __commonJS({
  "node_modules/tsparticles/Core/Interfaces/IParticleLoops.js"(exports) {
    init_shims();
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
  }
});

// node_modules/tsparticles/Core/Interfaces/IParticleRetinaProps.js
var require_IParticleRetinaProps = __commonJS({
  "node_modules/tsparticles/Core/Interfaces/IParticleRetinaProps.js"(exports) {
    init_shims();
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
  }
});

// node_modules/tsparticles/Core/Interfaces/IParticleSpin.js
var require_IParticleSpin = __commonJS({
  "node_modules/tsparticles/Core/Interfaces/IParticleSpin.js"(exports) {
    init_shims();
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
  }
});

// node_modules/tsparticles/Core/Interfaces/IParticleUpdater.js
var require_IParticleUpdater = __commonJS({
  "node_modules/tsparticles/Core/Interfaces/IParticleUpdater.js"(exports) {
    init_shims();
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
  }
});

// node_modules/tsparticles/Core/Interfaces/IParticleValueAnimation.js
var require_IParticleValueAnimation = __commonJS({
  "node_modules/tsparticles/Core/Interfaces/IParticleValueAnimation.js"(exports) {
    init_shims();
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
  }
});

// node_modules/tsparticles/Core/Interfaces/IParticlesInteractor.js
var require_IParticlesInteractor = __commonJS({
  "node_modules/tsparticles/Core/Interfaces/IParticlesInteractor.js"(exports) {
    init_shims();
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
  }
});

// node_modules/tsparticles/Core/Interfaces/IPlugin.js
var require_IPlugin = __commonJS({
  "node_modules/tsparticles/Core/Interfaces/IPlugin.js"(exports) {
    init_shims();
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
  }
});

// node_modules/tsparticles/Core/Interfaces/IRangeValue.js
var require_IRangeValue = __commonJS({
  "node_modules/tsparticles/Core/Interfaces/IRangeValue.js"(exports) {
    init_shims();
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
  }
});

// node_modules/tsparticles/Core/Interfaces/IRectSideResult.js
var require_IRectSideResult = __commonJS({
  "node_modules/tsparticles/Core/Interfaces/IRectSideResult.js"(exports) {
    init_shims();
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
  }
});

// node_modules/tsparticles/Core/Interfaces/IRepulse.js
var require_IRepulse = __commonJS({
  "node_modules/tsparticles/Core/Interfaces/IRepulse.js"(exports) {
    init_shims();
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
  }
});

// node_modules/tsparticles/Core/Interfaces/IShapeDrawer.js
var require_IShapeDrawer = __commonJS({
  "node_modules/tsparticles/Core/Interfaces/IShapeDrawer.js"(exports) {
    init_shims();
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
  }
});

// node_modules/tsparticles/Core/Interfaces/IShapeValues.js
var require_IShapeValues = __commonJS({
  "node_modules/tsparticles/Core/Interfaces/IShapeValues.js"(exports) {
    init_shims();
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
  }
});

// node_modules/tsparticles/Core/Interfaces/index.js
var require_Interfaces = __commonJS({
  "node_modules/tsparticles/Core/Interfaces/index.js"(exports) {
    init_shims();
    "use strict";
    var __createBinding = exports && exports.__createBinding || (Object.create ? function(o, m, k, k2) {
      if (k2 === void 0)
        k2 = k;
      Object.defineProperty(o, k2, { enumerable: true, get: function() {
        return m[k];
      } });
    } : function(o, m, k, k2) {
      if (k2 === void 0)
        k2 = k;
      o[k2] = m[k];
    });
    var __exportStar = exports && exports.__exportStar || function(m, exports2) {
      for (var p in m)
        if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports2, p))
          __createBinding(exports2, m, p);
    };
    Object.defineProperty(exports, "__esModule", { value: true });
    __exportStar(require_Colors(), exports);
    __exportStar(require_Gradients(), exports);
    __exportStar(require_IAttract(), exports);
    __exportStar(require_IBounds(), exports);
    __exportStar(require_IBubble(), exports);
    __exportStar(require_IBubbleParticleData(), exports);
    __exportStar(require_ICircleBouncer(), exports);
    __exportStar(require_IContainerInteractivity(), exports);
    __exportStar(require_IContainerPlugin(), exports);
    __exportStar(require_ICoordinates(), exports);
    __exportStar(require_IDelta(), exports);
    __exportStar(require_IDimension(), exports);
    __exportStar(require_IDistance(), exports);
    __exportStar(require_IExternalInteractor(), exports);
    __exportStar(require_IInteractor(), exports);
    __exportStar(require_IMouseData(), exports);
    __exportStar(require_IMovePathGenerator(), exports);
    __exportStar(require_IParticle(), exports);
    __exportStar(require_IParticleGradientAnimation(), exports);
    __exportStar(require_IParticleGradientColorAnimation(), exports);
    __exportStar(require_IParticleHslAnimation(), exports);
    __exportStar(require_IParticleLife(), exports);
    __exportStar(require_IParticleLoops(), exports);
    __exportStar(require_IParticleRetinaProps(), exports);
    __exportStar(require_IParticleSpin(), exports);
    __exportStar(require_IParticleUpdater(), exports);
    __exportStar(require_IParticleValueAnimation(), exports);
    __exportStar(require_IParticlesInteractor(), exports);
    __exportStar(require_IPlugin(), exports);
    __exportStar(require_IRangeValue(), exports);
    __exportStar(require_IRectSideResult(), exports);
    __exportStar(require_IRepulse(), exports);
    __exportStar(require_IShapeDrawer(), exports);
    __exportStar(require_IShapeValues(), exports);
  }
});

// node_modules/tsparticles/index.js
var require_tsparticles = __commonJS({
  "node_modules/tsparticles/index.js"(exports) {
    init_shims();
    "use strict";
    var __createBinding = exports && exports.__createBinding || (Object.create ? function(o, m, k, k2) {
      if (k2 === void 0)
        k2 = k;
      Object.defineProperty(o, k2, { enumerable: true, get: function() {
        return m[k];
      } });
    } : function(o, m, k, k2) {
      if (k2 === void 0)
        k2 = k;
      o[k2] = m[k];
    });
    var __exportStar = exports && exports.__exportStar || function(m, exports2) {
      for (var p in m)
        if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports2, p))
          __createBinding(exports2, m, p);
    };
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.tsParticles = exports.pJSDom = exports.particlesJS = exports.Main = exports.Rectangle = exports.Point = exports.Constants = exports.CircleWarp = exports.Circle = void 0;
    var pjs_1 = require_pjs();
    var main_1 = require_main();
    Object.defineProperty(exports, "Main", { enumerable: true, get: function() {
      return main_1.Main;
    } });
    var Utils_1 = require_Utils2();
    Object.defineProperty(exports, "Circle", { enumerable: true, get: function() {
      return Utils_1.Circle;
    } });
    Object.defineProperty(exports, "CircleWarp", { enumerable: true, get: function() {
      return Utils_1.CircleWarp;
    } });
    Object.defineProperty(exports, "Constants", { enumerable: true, get: function() {
      return Utils_1.Constants;
    } });
    Object.defineProperty(exports, "Point", { enumerable: true, get: function() {
      return Utils_1.Point;
    } });
    Object.defineProperty(exports, "Rectangle", { enumerable: true, get: function() {
      return Utils_1.Rectangle;
    } });
    var full_1 = require_full();
    var tsParticles = new main_1.Main();
    exports.tsParticles = tsParticles;
    tsParticles.init();
    var { particlesJS, pJSDom } = (0, pjs_1.initPjs)(tsParticles);
    exports.particlesJS = particlesJS;
    exports.pJSDom = pJSDom;
    (0, full_1.loadFull)(tsParticles);
    __exportStar(require_Vector(), exports);
    __exportStar(require_Container(), exports);
    __exportStar(require_Enums(), exports);
    __exportStar(require_Enums2(), exports);
    __exportStar(require_Enums3(), exports);
    __exportStar(require_Enums4(), exports);
    __exportStar(require_CanvasUtils(), exports);
    __exportStar(require_ColorUtils(), exports);
    __exportStar(require_NumberUtils(), exports);
    __exportStar(require_Utils(), exports);
    __exportStar(require_Types2(), exports);
    __exportStar(require_Interfaces(), exports);
    __exportStar(require_Particle(), exports);
    __exportStar(require_ExternalInteractorBase(), exports);
    __exportStar(require_ParticlesInteractorBase(), exports);
  }
});

// .svelte-kit/output/server/chunks/__layout-187693d0.js
var layout_187693d0_exports = {};
__export(layout_187693d0_exports, {
  default: () => _layout
});
var import_tsparticles, Particles, _layout;
var init_layout_187693d0 = __esm({
  ".svelte-kit/output/server/chunks/__layout-187693d0.js"() {
    init_shims();
    init_app_613f20d5();
    import_tsparticles = __toModule(require_tsparticles());
    Particles = create_ssr_component(($$result, $$props, $$bindings, slots) => {
      let { options: options2 = {} } = $$props;
      let { url = "" } = $$props;
      let { id = "tsparticles" } = $$props;
      createEventDispatcher();
      if ($$props.options === void 0 && $$bindings.options && options2 !== void 0)
        $$bindings.options(options2);
      if ($$props.url === void 0 && $$bindings.url && url !== void 0)
        $$bindings.url(url);
      if ($$props.id === void 0 && $$bindings.id && id !== void 0)
        $$bindings.id(id);
      return `

<div${add_attribute("id", id, 0)}></div>`;
    });
    _layout = create_ssr_component(($$result, $$props, $$bindings, slots) => {
      let particlesConfig = {
        fpsLimit: 60,
        particles: {
          number: {
            value: 0,
            density: { enable: true, value_area: 800 }
          },
          color: {
            value: "#110000",
            animation: { enable: true, speed: -1e-4, sync: true }
          },
          shape: { type: "circle" },
          opacity: {
            value: 1,
            random: false,
            animation: {
              enable: true,
              speed: 0.5,
              minimumValue: 0,
              sync: false
            }
          },
          size: {
            value: 10,
            random: { enable: true, minimumValue: 2 },
            animation: {
              enable: false,
              speed: 20,
              minimumValue: 4,
              sync: false
            }
          },
          life: { duration: { value: 20 }, count: 1 },
          move: {
            angle: { value: 45, offset: 0 },
            enable: true,
            gravity: { enable: true, acceleration: -0.5 },
            speed: 0.5,
            direction: "y",
            random: false,
            straight: false,
            size: true,
            outModes: { default: "destroy", bottom: "none" },
            attract: {
              enable: false,
              distance: 300,
              rotate: { x: 600, y: 1200 }
            }
          }
        },
        interactivity: {
          detectsOn: "canvas",
          events: { resize: true }
        },
        detectRetina: true,
        emitters: {
          direction: "top",
          rate: { quantity: 0.2, delay: 0.01 },
          size: { width: 100, height: 10 },
          position: { x: 50, y: 100 }
        }
      };
      return `<body class="${"bg-gray-100 h-screen w-screen z-50"}">${validate_component(Particles, "Particles").$$render($$result, {
        id: "tsparticles",
        options: particlesConfig,
        class: "z-0"
      }, {}, {})}

	${slots.default ? slots.default({}) : ``}</body>`;
    });
  }
});

// .svelte-kit/output/server/chunks/error-5de2f330.js
var error_5de2f330_exports = {};
__export(error_5de2f330_exports, {
  default: () => Error2,
  load: () => load
});
function load({ error: error2, status }) {
  return { props: { error: error2, status } };
}
var Error2;
var init_error_5de2f330 = __esm({
  ".svelte-kit/output/server/chunks/error-5de2f330.js"() {
    init_shims();
    init_app_613f20d5();
    Error2 = create_ssr_component(($$result, $$props, $$bindings, slots) => {
      let { status } = $$props;
      let { error: error2 } = $$props;
      if ($$props.status === void 0 && $$bindings.status && status !== void 0)
        $$bindings.status(status);
      if ($$props.error === void 0 && $$bindings.error && error2 !== void 0)
        $$bindings.error(error2);
      return `<h1>${escape(status)}</h1>

<pre>${escape(error2.message)}</pre>



${error2.frame ? `<pre>${escape(error2.frame)}</pre>` : ``}
${error2.stack ? `<pre>${escape(error2.stack)}</pre>` : ``}`;
    });
  }
});

// .svelte-kit/output/server/chunks/index-8398370e.js
var index_8398370e_exports = {};
__export(index_8398370e_exports, {
  default: () => Routes
});
var css, Routes;
var init_index_8398370e = __esm({
  ".svelte-kit/output/server/chunks/index-8398370e.js"() {
    init_shims();
    init_app_613f20d5();
    css = {
      code: ".font-worksans.svelte-16v3419{font-family:'Work Sans', sans-serif}",
      map: null
    };
    Routes = create_ssr_component(($$result, $$props, $$bindings, slots) => {
      $$result.css.add(css);
      return `<div class="${"hero my-auto z-10"}"><div class="${"hero-content text-center"}"><div><h1 class="${"font-bold text-5xl mt-5 mx-auto font-worksans mx-10 xl:text-7xl xl:mt-20 svelte-16v3419"}">Hi There!
			</h1>
			<h2 class="${"font-bold text-5xl mb-5 font-worksans mx-2 xl:text-7xl svelte-16v3419"}">I am Shriram</h2>
			<p class="${"font-semibold text-xl font-worksans mx-5 md:mx-16 md:mt-14 xl:text-3xl xl:mx-44 svelte-16v3419"}">I am a frontend developer and am currently exploring backend and devops at my own pace to
				learn how to build a complete application. I&#39;m very curious and hold an interest in various
				topics!
			</p>
			<p class="${"text-2xl my-5 mt-12 font-semibold font-worksans svelte-16v3419"}">Do check my work out :)</p>
			<div><a class="${"btn font-worksans mr-4 bg-gray-900 xl:text-xl svelte-16v3419"}" href="${"https://hashnode.com/@windsmith"}" target="${"_blank"}" rel="${"noopener noreferrer"}">My Blog
				</a>
				<a class="${"btn font-worksans bg-gray-900 xl:text-xl svelte-16v3419"}" href="${"https://github.com/Windsmith"}" target="${"_blank"}" rel="${"noopener noreferrer"}">My Github
				</a></div></div></div>
</div>`;
    });
  }
});

// .svelte-kit/output/server/chunks/app-613f20d5.js
function get_single_valued_header(headers, key) {
  const value = headers[key];
  if (Array.isArray(value)) {
    if (value.length === 0) {
      return void 0;
    }
    if (value.length > 1) {
      throw new Error(`Multiple headers provided for ${key}. Multiple may be provided only for set-cookie`);
    }
    return value[0];
  }
  return value;
}
function coalesce_to_error(err) {
  return err instanceof Error || err && err.name && err.message ? err : new Error(JSON.stringify(err));
}
function lowercase_keys(obj) {
  const clone2 = {};
  for (const key in obj) {
    clone2[key.toLowerCase()] = obj[key];
  }
  return clone2;
}
function error(body) {
  return {
    status: 500,
    body,
    headers: {}
  };
}
function is_string(s2) {
  return typeof s2 === "string" || s2 instanceof String;
}
function is_content_type_textual(content_type) {
  if (!content_type)
    return true;
  const [type] = content_type.split(";");
  return type === "text/plain" || type === "application/json" || type === "application/x-www-form-urlencoded" || type === "multipart/form-data";
}
async function render_endpoint(request, route, match) {
  const mod = await route.load();
  const handler = mod[request.method.toLowerCase().replace("delete", "del")];
  if (!handler) {
    return;
  }
  const params = route.params(match);
  const response = await handler({ ...request, params });
  const preface = `Invalid response from route ${request.path}`;
  if (!response) {
    return;
  }
  if (typeof response !== "object") {
    return error(`${preface}: expected an object, got ${typeof response}`);
  }
  let { status = 200, body, headers = {} } = response;
  headers = lowercase_keys(headers);
  const type = get_single_valued_header(headers, "content-type");
  const is_type_textual = is_content_type_textual(type);
  if (!is_type_textual && !(body instanceof Uint8Array || is_string(body))) {
    return error(`${preface}: body must be an instance of string or Uint8Array if content-type is not a supported textual content-type`);
  }
  let normalized_body;
  if ((typeof body === "object" || typeof body === "undefined") && !(body instanceof Uint8Array) && (!type || type.startsWith("application/json"))) {
    headers = { ...headers, "content-type": "application/json; charset=utf-8" };
    normalized_body = JSON.stringify(typeof body === "undefined" ? {} : body);
  } else {
    normalized_body = body;
  }
  return { status, body: normalized_body, headers };
}
function devalue(value) {
  var counts = new Map();
  function walk(thing) {
    if (typeof thing === "function") {
      throw new Error("Cannot stringify a function");
    }
    if (counts.has(thing)) {
      counts.set(thing, counts.get(thing) + 1);
      return;
    }
    counts.set(thing, 1);
    if (!isPrimitive(thing)) {
      var type = getType(thing);
      switch (type) {
        case "Number":
        case "String":
        case "Boolean":
        case "Date":
        case "RegExp":
          return;
        case "Array":
          thing.forEach(walk);
          break;
        case "Set":
        case "Map":
          Array.from(thing).forEach(walk);
          break;
        default:
          var proto = Object.getPrototypeOf(thing);
          if (proto !== Object.prototype && proto !== null && Object.getOwnPropertyNames(proto).sort().join("\0") !== objectProtoOwnPropertyNames) {
            throw new Error("Cannot stringify arbitrary non-POJOs");
          }
          if (Object.getOwnPropertySymbols(thing).length > 0) {
            throw new Error("Cannot stringify POJOs with symbolic keys");
          }
          Object.keys(thing).forEach(function(key) {
            return walk(thing[key]);
          });
      }
    }
  }
  walk(value);
  var names = new Map();
  Array.from(counts).filter(function(entry) {
    return entry[1] > 1;
  }).sort(function(a, b) {
    return b[1] - a[1];
  }).forEach(function(entry, i) {
    names.set(entry[0], getName(i));
  });
  function stringify(thing) {
    if (names.has(thing)) {
      return names.get(thing);
    }
    if (isPrimitive(thing)) {
      return stringifyPrimitive(thing);
    }
    var type = getType(thing);
    switch (type) {
      case "Number":
      case "String":
      case "Boolean":
        return "Object(" + stringify(thing.valueOf()) + ")";
      case "RegExp":
        return "new RegExp(" + stringifyString(thing.source) + ', "' + thing.flags + '")';
      case "Date":
        return "new Date(" + thing.getTime() + ")";
      case "Array":
        var members = thing.map(function(v, i) {
          return i in thing ? stringify(v) : "";
        });
        var tail = thing.length === 0 || thing.length - 1 in thing ? "" : ",";
        return "[" + members.join(",") + tail + "]";
      case "Set":
      case "Map":
        return "new " + type + "([" + Array.from(thing).map(stringify).join(",") + "])";
      default:
        var obj = "{" + Object.keys(thing).map(function(key) {
          return safeKey(key) + ":" + stringify(thing[key]);
        }).join(",") + "}";
        var proto = Object.getPrototypeOf(thing);
        if (proto === null) {
          return Object.keys(thing).length > 0 ? "Object.assign(Object.create(null)," + obj + ")" : "Object.create(null)";
        }
        return obj;
    }
  }
  var str = stringify(value);
  if (names.size) {
    var params_1 = [];
    var statements_1 = [];
    var values_1 = [];
    names.forEach(function(name, thing) {
      params_1.push(name);
      if (isPrimitive(thing)) {
        values_1.push(stringifyPrimitive(thing));
        return;
      }
      var type = getType(thing);
      switch (type) {
        case "Number":
        case "String":
        case "Boolean":
          values_1.push("Object(" + stringify(thing.valueOf()) + ")");
          break;
        case "RegExp":
          values_1.push(thing.toString());
          break;
        case "Date":
          values_1.push("new Date(" + thing.getTime() + ")");
          break;
        case "Array":
          values_1.push("Array(" + thing.length + ")");
          thing.forEach(function(v, i) {
            statements_1.push(name + "[" + i + "]=" + stringify(v));
          });
          break;
        case "Set":
          values_1.push("new Set");
          statements_1.push(name + "." + Array.from(thing).map(function(v) {
            return "add(" + stringify(v) + ")";
          }).join("."));
          break;
        case "Map":
          values_1.push("new Map");
          statements_1.push(name + "." + Array.from(thing).map(function(_a) {
            var k = _a[0], v = _a[1];
            return "set(" + stringify(k) + ", " + stringify(v) + ")";
          }).join("."));
          break;
        default:
          values_1.push(Object.getPrototypeOf(thing) === null ? "Object.create(null)" : "{}");
          Object.keys(thing).forEach(function(key) {
            statements_1.push("" + name + safeProp(key) + "=" + stringify(thing[key]));
          });
      }
    });
    statements_1.push("return " + str);
    return "(function(" + params_1.join(",") + "){" + statements_1.join(";") + "}(" + values_1.join(",") + "))";
  } else {
    return str;
  }
}
function getName(num) {
  var name = "";
  do {
    name = chars[num % chars.length] + name;
    num = ~~(num / chars.length) - 1;
  } while (num >= 0);
  return reserved.test(name) ? name + "_" : name;
}
function isPrimitive(thing) {
  return Object(thing) !== thing;
}
function stringifyPrimitive(thing) {
  if (typeof thing === "string")
    return stringifyString(thing);
  if (thing === void 0)
    return "void 0";
  if (thing === 0 && 1 / thing < 0)
    return "-0";
  var str = String(thing);
  if (typeof thing === "number")
    return str.replace(/^(-)?0\./, "$1.");
  return str;
}
function getType(thing) {
  return Object.prototype.toString.call(thing).slice(8, -1);
}
function escapeUnsafeChar(c) {
  return escaped$1[c] || c;
}
function escapeUnsafeChars(str) {
  return str.replace(unsafeChars, escapeUnsafeChar);
}
function safeKey(key) {
  return /^[_$a-zA-Z][_$a-zA-Z0-9]*$/.test(key) ? key : escapeUnsafeChars(JSON.stringify(key));
}
function safeProp(key) {
  return /^[_$a-zA-Z][_$a-zA-Z0-9]*$/.test(key) ? "." + key : "[" + escapeUnsafeChars(JSON.stringify(key)) + "]";
}
function stringifyString(str) {
  var result = '"';
  for (var i = 0; i < str.length; i += 1) {
    var char = str.charAt(i);
    var code = char.charCodeAt(0);
    if (char === '"') {
      result += '\\"';
    } else if (char in escaped$1) {
      result += escaped$1[char];
    } else if (code >= 55296 && code <= 57343) {
      var next = str.charCodeAt(i + 1);
      if (code <= 56319 && (next >= 56320 && next <= 57343)) {
        result += char + str[++i];
      } else {
        result += "\\u" + code.toString(16).toUpperCase();
      }
    } else {
      result += char;
    }
  }
  result += '"';
  return result;
}
function noop() {
}
function safe_not_equal(a, b) {
  return a != a ? b == b : a !== b || (a && typeof a === "object" || typeof a === "function");
}
function writable(value, start = noop) {
  let stop;
  const subscribers = new Set();
  function set(new_value) {
    if (safe_not_equal(value, new_value)) {
      value = new_value;
      if (stop) {
        const run_queue = !subscriber_queue.length;
        for (const subscriber of subscribers) {
          subscriber[1]();
          subscriber_queue.push(subscriber, value);
        }
        if (run_queue) {
          for (let i = 0; i < subscriber_queue.length; i += 2) {
            subscriber_queue[i][0](subscriber_queue[i + 1]);
          }
          subscriber_queue.length = 0;
        }
      }
    }
  }
  function update(fn) {
    set(fn(value));
  }
  function subscribe(run2, invalidate = noop) {
    const subscriber = [run2, invalidate];
    subscribers.add(subscriber);
    if (subscribers.size === 1) {
      stop = start(set) || noop;
    }
    run2(value);
    return () => {
      subscribers.delete(subscriber);
      if (subscribers.size === 0) {
        stop();
        stop = null;
      }
    };
  }
  return { set, update, subscribe };
}
function hash(value) {
  let hash2 = 5381;
  let i = value.length;
  if (typeof value === "string") {
    while (i)
      hash2 = hash2 * 33 ^ value.charCodeAt(--i);
  } else {
    while (i)
      hash2 = hash2 * 33 ^ value[--i];
  }
  return (hash2 >>> 0).toString(36);
}
function escape_json_string_in_html(str) {
  return escape$1(str, escape_json_string_in_html_dict, (code) => `\\u${code.toString(16).toUpperCase()}`);
}
function escape_html_attr(str) {
  return '"' + escape$1(str, escape_html_attr_dict, (code) => `&#${code};`) + '"';
}
function escape$1(str, dict, unicode_encoder) {
  let result = "";
  for (let i = 0; i < str.length; i += 1) {
    const char = str.charAt(i);
    const code = char.charCodeAt(0);
    if (char in dict) {
      result += dict[char];
    } else if (code >= 55296 && code <= 57343) {
      const next = str.charCodeAt(i + 1);
      if (code <= 56319 && next >= 56320 && next <= 57343) {
        result += char + str[++i];
      } else {
        result += unicode_encoder(code);
      }
    } else {
      result += char;
    }
  }
  return result;
}
async function render_response({
  branch,
  options: options2,
  $session,
  page_config,
  status,
  error: error2,
  page
}) {
  const css22 = new Set(options2.entry.css);
  const js = new Set(options2.entry.js);
  const styles = new Set();
  const serialized_data = [];
  let rendered;
  let is_private = false;
  let maxage;
  if (error2) {
    error2.stack = options2.get_stack(error2);
  }
  if (page_config.ssr) {
    branch.forEach(({ node, loaded, fetched, uses_credentials }) => {
      if (node.css)
        node.css.forEach((url) => css22.add(url));
      if (node.js)
        node.js.forEach((url) => js.add(url));
      if (node.styles)
        node.styles.forEach((content) => styles.add(content));
      if (fetched && page_config.hydrate)
        serialized_data.push(...fetched);
      if (uses_credentials)
        is_private = true;
      maxage = loaded.maxage;
    });
    const session = writable($session);
    const props = {
      stores: {
        page: writable(null),
        navigating: writable(null),
        session
      },
      page,
      components: branch.map(({ node }) => node.module.default)
    };
    for (let i = 0; i < branch.length; i += 1) {
      props[`props_${i}`] = await branch[i].loaded.props;
    }
    let session_tracking_active = false;
    const unsubscribe = session.subscribe(() => {
      if (session_tracking_active)
        is_private = true;
    });
    session_tracking_active = true;
    try {
      rendered = options2.root.render(props);
    } finally {
      unsubscribe();
    }
  } else {
    rendered = { head: "", html: "", css: { code: "", map: null } };
  }
  const include_js = page_config.router || page_config.hydrate;
  if (!include_js)
    js.clear();
  const links = options2.amp ? styles.size > 0 || rendered.css.code.length > 0 ? `<style amp-custom>${Array.from(styles).concat(rendered.css.code).join("\n")}</style>` : "" : [
    ...Array.from(js).map((dep) => `<link rel="modulepreload" href="${dep}">`),
    ...Array.from(css22).map((dep) => `<link rel="stylesheet" href="${dep}">`)
  ].join("\n		");
  let init2 = "";
  if (options2.amp) {
    init2 = `
		<style amp-boilerplate>body{-webkit-animation:-amp-start 8s steps(1,end) 0s 1 normal both;-moz-animation:-amp-start 8s steps(1,end) 0s 1 normal both;-ms-animation:-amp-start 8s steps(1,end) 0s 1 normal both;animation:-amp-start 8s steps(1,end) 0s 1 normal both}@-webkit-keyframes -amp-start{from{visibility:hidden}to{visibility:visible}}@-moz-keyframes -amp-start{from{visibility:hidden}to{visibility:visible}}@-ms-keyframes -amp-start{from{visibility:hidden}to{visibility:visible}}@-o-keyframes -amp-start{from{visibility:hidden}to{visibility:visible}}@keyframes -amp-start{from{visibility:hidden}to{visibility:visible}}</style>
		<noscript><style amp-boilerplate>body{-webkit-animation:none;-moz-animation:none;-ms-animation:none;animation:none}</style></noscript>
		<script async src="https://cdn.ampproject.org/v0.js"><\/script>`;
  } else if (include_js) {
    init2 = `<script type="module">
			import { start } from ${s$1(options2.entry.file)};
			start({
				target: ${options2.target ? `document.querySelector(${s$1(options2.target)})` : "document.body"},
				paths: ${s$1(options2.paths)},
				session: ${try_serialize($session, (error3) => {
      throw new Error(`Failed to serialize session data: ${error3.message}`);
    })},
				host: ${page && page.host ? s$1(page.host) : "location.host"},
				route: ${!!page_config.router},
				spa: ${!page_config.ssr},
				trailing_slash: ${s$1(options2.trailing_slash)},
				hydrate: ${page_config.ssr && page_config.hydrate ? `{
					status: ${status},
					error: ${serialize_error(error2)},
					nodes: [
						${(branch || []).map(({ node }) => `import(${s$1(node.entry)})`).join(",\n						")}
					],
					page: {
						host: ${page && page.host ? s$1(page.host) : "location.host"}, // TODO this is redundant
						path: ${page && page.path ? try_serialize(page.path, (error3) => {
      throw new Error(`Failed to serialize page.path: ${error3.message}`);
    }) : null},
						query: new URLSearchParams(${page && page.query ? s$1(page.query.toString()) : ""}),
						params: ${page && page.params ? try_serialize(page.params, (error3) => {
      throw new Error(`Failed to serialize page.params: ${error3.message}`);
    }) : null}
					}
				}` : "null"}
			});
		<\/script>`;
  }
  if (options2.service_worker) {
    init2 += `<script>
			if ('serviceWorker' in navigator) {
				navigator.serviceWorker.register('${options2.service_worker}');
			}
		<\/script>`;
  }
  const head = [
    rendered.head,
    styles.size && !options2.amp ? `<style data-svelte>${Array.from(styles).join("\n")}</style>` : "",
    links,
    init2
  ].join("\n\n		");
  const body = options2.amp ? rendered.html : `${rendered.html}

			${serialized_data.map(({ url, body: body2, json }) => {
    let attributes = `type="application/json" data-type="svelte-data" data-url=${escape_html_attr(url)}`;
    if (body2)
      attributes += ` data-body="${hash(body2)}"`;
    return `<script ${attributes}>${json}<\/script>`;
  }).join("\n\n	")}
		`;
  const headers = {
    "content-type": "text/html"
  };
  if (maxage) {
    headers["cache-control"] = `${is_private ? "private" : "public"}, max-age=${maxage}`;
  }
  if (!options2.floc) {
    headers["permissions-policy"] = "interest-cohort=()";
  }
  return {
    status,
    headers,
    body: options2.template({ head, body })
  };
}
function try_serialize(data, fail) {
  try {
    return devalue(data);
  } catch (err) {
    if (fail)
      fail(coalesce_to_error(err));
    return null;
  }
}
function serialize_error(error2) {
  if (!error2)
    return null;
  let serialized = try_serialize(error2);
  if (!serialized) {
    const { name, message, stack } = error2;
    serialized = try_serialize({ ...error2, name, message, stack });
  }
  if (!serialized) {
    serialized = "{}";
  }
  return serialized;
}
function normalize(loaded) {
  const has_error_status = loaded.status && loaded.status >= 400 && loaded.status <= 599 && !loaded.redirect;
  if (loaded.error || has_error_status) {
    const status = loaded.status;
    if (!loaded.error && has_error_status) {
      return {
        status: status || 500,
        error: new Error()
      };
    }
    const error2 = typeof loaded.error === "string" ? new Error(loaded.error) : loaded.error;
    if (!(error2 instanceof Error)) {
      return {
        status: 500,
        error: new Error(`"error" property returned from load() must be a string or instance of Error, received type "${typeof error2}"`)
      };
    }
    if (!status || status < 400 || status > 599) {
      console.warn('"error" returned from load() without a valid status code \u2014 defaulting to 500');
      return { status: 500, error: error2 };
    }
    return { status, error: error2 };
  }
  if (loaded.redirect) {
    if (!loaded.status || Math.floor(loaded.status / 100) !== 3) {
      return {
        status: 500,
        error: new Error('"redirect" property returned from load() must be accompanied by a 3xx status code')
      };
    }
    if (typeof loaded.redirect !== "string") {
      return {
        status: 500,
        error: new Error('"redirect" property returned from load() must be a string')
      };
    }
  }
  if (loaded.context) {
    throw new Error('You are returning "context" from a load function. "context" was renamed to "stuff", please adjust your code accordingly.');
  }
  return loaded;
}
async function load_node({
  request,
  options: options2,
  state,
  route,
  page,
  node,
  $session,
  stuff,
  prerender_enabled,
  is_leaf,
  is_error,
  status,
  error: error2
}) {
  const { module: module2 } = node;
  let uses_credentials = false;
  const fetched = [];
  let set_cookie_headers = [];
  let loaded;
  const page_proxy = new Proxy(page, {
    get: (target, prop, receiver) => {
      if (prop === "query" && prerender_enabled) {
        throw new Error("Cannot access query on a page with prerendering enabled");
      }
      return Reflect.get(target, prop, receiver);
    }
  });
  if (module2.load) {
    const load_input = {
      page: page_proxy,
      get session() {
        uses_credentials = true;
        return $session;
      },
      fetch: async (resource, opts = {}) => {
        let url;
        if (typeof resource === "string") {
          url = resource;
        } else {
          url = resource.url;
          opts = {
            method: resource.method,
            headers: resource.headers,
            body: resource.body,
            mode: resource.mode,
            credentials: resource.credentials,
            cache: resource.cache,
            redirect: resource.redirect,
            referrer: resource.referrer,
            integrity: resource.integrity,
            ...opts
          };
        }
        const resolved = resolve(request.path, url.split("?")[0]);
        let response;
        const prefix = options2.paths.assets || options2.paths.base;
        const filename = (resolved.startsWith(prefix) ? resolved.slice(prefix.length) : resolved).slice(1);
        const filename_html = `${filename}/index.html`;
        const asset = options2.manifest.assets.find((d) => d.file === filename || d.file === filename_html);
        if (asset) {
          response = options2.read ? new Response(options2.read(asset.file), {
            headers: asset.type ? { "content-type": asset.type } : {}
          }) : await fetch(`http://${page.host}/${asset.file}`, opts);
        } else if (resolved.startsWith("/") && !resolved.startsWith("//")) {
          const relative = resolved;
          const headers = {
            ...opts.headers
          };
          if (opts.credentials !== "omit") {
            uses_credentials = true;
            headers.cookie = request.headers.cookie;
            if (!headers.authorization) {
              headers.authorization = request.headers.authorization;
            }
          }
          if (opts.body && typeof opts.body !== "string") {
            throw new Error("Request body must be a string");
          }
          const search = url.includes("?") ? url.slice(url.indexOf("?") + 1) : "";
          const rendered = await respond({
            host: request.host,
            method: opts.method || "GET",
            headers,
            path: relative,
            rawBody: opts.body == null ? null : new TextEncoder().encode(opts.body),
            query: new URLSearchParams(search)
          }, options2, {
            fetched: url,
            initiator: route
          });
          if (rendered) {
            if (state.prerender) {
              state.prerender.dependencies.set(relative, rendered);
            }
            response = new Response(rendered.body, {
              status: rendered.status,
              headers: rendered.headers
            });
          }
        } else {
          if (resolved.startsWith("//")) {
            throw new Error(`Cannot request protocol-relative URL (${url}) in server-side fetch`);
          }
          if (typeof request.host !== "undefined") {
            const { hostname: fetch_hostname } = new URL(url);
            const [server_hostname] = request.host.split(":");
            if (`.${fetch_hostname}`.endsWith(`.${server_hostname}`) && opts.credentials !== "omit") {
              uses_credentials = true;
              opts.headers = {
                ...opts.headers,
                cookie: request.headers.cookie
              };
            }
          }
          const external_request = new Request(url, opts);
          response = await options2.hooks.externalFetch.call(null, external_request);
        }
        if (response) {
          const proxy = new Proxy(response, {
            get(response2, key, _receiver) {
              async function text() {
                const body = await response2.text();
                const headers = {};
                for (const [key2, value] of response2.headers) {
                  if (key2 === "set-cookie") {
                    set_cookie_headers = set_cookie_headers.concat(value);
                  } else if (key2 !== "etag") {
                    headers[key2] = value;
                  }
                }
                if (!opts.body || typeof opts.body === "string") {
                  fetched.push({
                    url,
                    body: opts.body,
                    json: `{"status":${response2.status},"statusText":${s(response2.statusText)},"headers":${s(headers)},"body":"${escape_json_string_in_html(body)}"}`
                  });
                }
                return body;
              }
              if (key === "text") {
                return text;
              }
              if (key === "json") {
                return async () => {
                  return JSON.parse(await text());
                };
              }
              return Reflect.get(response2, key, response2);
            }
          });
          return proxy;
        }
        return response || new Response("Not found", {
          status: 404
        });
      },
      stuff: { ...stuff }
    };
    if (is_error) {
      load_input.status = status;
      load_input.error = error2;
    }
    loaded = await module2.load.call(null, load_input);
  } else {
    loaded = {};
  }
  if (!loaded && is_leaf && !is_error)
    return;
  if (!loaded) {
    throw new Error(`${node.entry} - load must return a value except for page fall through`);
  }
  return {
    node,
    loaded: normalize(loaded),
    stuff: loaded.stuff || stuff,
    fetched,
    set_cookie_headers,
    uses_credentials
  };
}
function resolve(base2, path) {
  const base_match = absolute.exec(base2);
  const path_match = absolute.exec(path);
  if (!base_match) {
    throw new Error(`bad base path: "${base2}"`);
  }
  const baseparts = path_match ? [] : base2.slice(base_match[0].length).split("/");
  const pathparts = path_match ? path.slice(path_match[0].length).split("/") : path.split("/");
  baseparts.pop();
  for (let i = 0; i < pathparts.length; i += 1) {
    const part = pathparts[i];
    if (part === ".")
      continue;
    else if (part === "..")
      baseparts.pop();
    else
      baseparts.push(part);
  }
  const prefix = path_match && path_match[0] || base_match && base_match[0] || "";
  return `${prefix}${baseparts.join("/")}`;
}
async function respond_with_error({ request, options: options2, state, $session, status, error: error2 }) {
  const default_layout = await options2.load_component(options2.manifest.layout);
  const default_error = await options2.load_component(options2.manifest.error);
  const page = {
    host: request.host,
    path: request.path,
    query: request.query,
    params: {}
  };
  const loaded = await load_node({
    request,
    options: options2,
    state,
    route: null,
    page,
    node: default_layout,
    $session,
    stuff: {},
    prerender_enabled: is_prerender_enabled(options2, default_error, state),
    is_leaf: false,
    is_error: false
  });
  const branch = [
    loaded,
    await load_node({
      request,
      options: options2,
      state,
      route: null,
      page,
      node: default_error,
      $session,
      stuff: loaded ? loaded.stuff : {},
      prerender_enabled: is_prerender_enabled(options2, default_error, state),
      is_leaf: false,
      is_error: true,
      status,
      error: error2
    })
  ];
  try {
    return await render_response({
      options: options2,
      $session,
      page_config: {
        hydrate: options2.hydrate,
        router: options2.router,
        ssr: options2.ssr
      },
      status,
      error: error2,
      branch,
      page
    });
  } catch (err) {
    const error3 = coalesce_to_error(err);
    options2.handle_error(error3, request);
    return {
      status: 500,
      headers: {},
      body: error3.stack
    };
  }
}
function is_prerender_enabled(options2, node, state) {
  return options2.prerender && (!!node.module.prerender || !!state.prerender && state.prerender.all);
}
async function respond$1(opts) {
  const { request, options: options2, state, $session, route } = opts;
  let nodes;
  try {
    nodes = await Promise.all(route.a.map((id) => id ? options2.load_component(id) : void 0));
  } catch (err) {
    const error3 = coalesce_to_error(err);
    options2.handle_error(error3, request);
    return await respond_with_error({
      request,
      options: options2,
      state,
      $session,
      status: 500,
      error: error3
    });
  }
  const leaf = nodes[nodes.length - 1].module;
  let page_config = get_page_config(leaf, options2);
  if (!leaf.prerender && state.prerender && !state.prerender.all) {
    return {
      status: 204,
      headers: {}
    };
  }
  let branch = [];
  let status = 200;
  let error2;
  let set_cookie_headers = [];
  ssr:
    if (page_config.ssr) {
      let stuff = {};
      for (let i = 0; i < nodes.length; i += 1) {
        const node = nodes[i];
        let loaded;
        if (node) {
          try {
            loaded = await load_node({
              ...opts,
              node,
              stuff,
              prerender_enabled: is_prerender_enabled(options2, node, state),
              is_leaf: i === nodes.length - 1,
              is_error: false
            });
            if (!loaded)
              return;
            set_cookie_headers = set_cookie_headers.concat(loaded.set_cookie_headers);
            if (loaded.loaded.redirect) {
              return with_cookies({
                status: loaded.loaded.status,
                headers: {
                  location: encodeURI(loaded.loaded.redirect)
                }
              }, set_cookie_headers);
            }
            if (loaded.loaded.error) {
              ({ status, error: error2 } = loaded.loaded);
            }
          } catch (err) {
            const e = coalesce_to_error(err);
            options2.handle_error(e, request);
            status = 500;
            error2 = e;
          }
          if (loaded && !error2) {
            branch.push(loaded);
          }
          if (error2) {
            while (i--) {
              if (route.b[i]) {
                const error_node = await options2.load_component(route.b[i]);
                let node_loaded;
                let j = i;
                while (!(node_loaded = branch[j])) {
                  j -= 1;
                }
                try {
                  const error_loaded = await load_node({
                    ...opts,
                    node: error_node,
                    stuff: node_loaded.stuff,
                    prerender_enabled: is_prerender_enabled(options2, error_node, state),
                    is_leaf: false,
                    is_error: true,
                    status,
                    error: error2
                  });
                  if (error_loaded.loaded.error) {
                    continue;
                  }
                  page_config = get_page_config(error_node.module, options2);
                  branch = branch.slice(0, j + 1).concat(error_loaded);
                  break ssr;
                } catch (err) {
                  const e = coalesce_to_error(err);
                  options2.handle_error(e, request);
                  continue;
                }
              }
            }
            return with_cookies(await respond_with_error({
              request,
              options: options2,
              state,
              $session,
              status,
              error: error2
            }), set_cookie_headers);
          }
        }
        if (loaded && loaded.loaded.stuff) {
          stuff = {
            ...stuff,
            ...loaded.loaded.stuff
          };
        }
      }
    }
  try {
    return with_cookies(await render_response({
      ...opts,
      page_config,
      status,
      error: error2,
      branch: branch.filter(Boolean)
    }), set_cookie_headers);
  } catch (err) {
    const error3 = coalesce_to_error(err);
    options2.handle_error(error3, request);
    return with_cookies(await respond_with_error({
      ...opts,
      status: 500,
      error: error3
    }), set_cookie_headers);
  }
}
function get_page_config(leaf, options2) {
  return {
    ssr: "ssr" in leaf ? !!leaf.ssr : options2.ssr,
    router: "router" in leaf ? !!leaf.router : options2.router,
    hydrate: "hydrate" in leaf ? !!leaf.hydrate : options2.hydrate
  };
}
function with_cookies(response, set_cookie_headers) {
  if (set_cookie_headers.length) {
    response.headers["set-cookie"] = set_cookie_headers;
  }
  return response;
}
async function render_page(request, route, match, options2, state) {
  if (state.initiator === route) {
    return {
      status: 404,
      headers: {},
      body: `Not found: ${request.path}`
    };
  }
  const params = route.params(match);
  const page = {
    host: request.host,
    path: request.path,
    query: request.query,
    params
  };
  const $session = await options2.hooks.getSession(request);
  const response = await respond$1({
    request,
    options: options2,
    state,
    $session,
    route,
    page
  });
  if (response) {
    return response;
  }
  if (state.fetched) {
    return {
      status: 500,
      headers: {},
      body: `Bad request in load function: failed to fetch ${state.fetched}`
    };
  }
}
function read_only_form_data() {
  const map = new Map();
  return {
    append(key, value) {
      if (map.has(key)) {
        (map.get(key) || []).push(value);
      } else {
        map.set(key, [value]);
      }
    },
    data: new ReadOnlyFormData(map)
  };
}
function parse_body(raw, headers) {
  if (!raw)
    return raw;
  const content_type = headers["content-type"];
  const [type, ...directives] = content_type ? content_type.split(/;\s*/) : [];
  const text = () => new TextDecoder(headers["content-encoding"] || "utf-8").decode(raw);
  switch (type) {
    case "text/plain":
      return text();
    case "application/json":
      return JSON.parse(text());
    case "application/x-www-form-urlencoded":
      return get_urlencoded(text());
    case "multipart/form-data": {
      const boundary = directives.find((directive) => directive.startsWith("boundary="));
      if (!boundary)
        throw new Error("Missing boundary");
      return get_multipart(text(), boundary.slice("boundary=".length));
    }
    default:
      return raw;
  }
}
function get_urlencoded(text) {
  const { data, append } = read_only_form_data();
  text.replace(/\+/g, " ").split("&").forEach((str) => {
    const [key, value] = str.split("=");
    append(decodeURIComponent(key), decodeURIComponent(value));
  });
  return data;
}
function get_multipart(text, boundary) {
  const parts = text.split(`--${boundary}`);
  if (parts[0] !== "" || parts[parts.length - 1].trim() !== "--") {
    throw new Error("Malformed form data");
  }
  const { data, append } = read_only_form_data();
  parts.slice(1, -1).forEach((part) => {
    const match = /\s*([\s\S]+?)\r\n\r\n([\s\S]*)\s*/.exec(part);
    if (!match) {
      throw new Error("Malformed form data");
    }
    const raw_headers = match[1];
    const body = match[2].trim();
    let key;
    const headers = {};
    raw_headers.split("\r\n").forEach((str) => {
      const [raw_header, ...raw_directives] = str.split("; ");
      let [name, value] = raw_header.split(": ");
      name = name.toLowerCase();
      headers[name] = value;
      const directives = {};
      raw_directives.forEach((raw_directive) => {
        const [name2, value2] = raw_directive.split("=");
        directives[name2] = JSON.parse(value2);
      });
      if (name === "content-disposition") {
        if (value !== "form-data")
          throw new Error("Malformed form data");
        if (directives.filename) {
          throw new Error("File upload is not yet implemented");
        }
        if (directives.name) {
          key = directives.name;
        }
      }
    });
    if (!key)
      throw new Error("Malformed form data");
    append(key, body);
  });
  return data;
}
async function respond(incoming, options2, state = {}) {
  if (incoming.path !== "/" && options2.trailing_slash !== "ignore") {
    const has_trailing_slash = incoming.path.endsWith("/");
    if (has_trailing_slash && options2.trailing_slash === "never" || !has_trailing_slash && options2.trailing_slash === "always" && !(incoming.path.split("/").pop() || "").includes(".")) {
      const path = has_trailing_slash ? incoming.path.slice(0, -1) : incoming.path + "/";
      const q = incoming.query.toString();
      return {
        status: 301,
        headers: {
          location: options2.paths.base + path + (q ? `?${q}` : "")
        }
      };
    }
  }
  const headers = lowercase_keys(incoming.headers);
  const request = {
    ...incoming,
    headers,
    body: parse_body(incoming.rawBody, headers),
    params: {},
    locals: {}
  };
  try {
    return await options2.hooks.handle({
      request,
      resolve: async (request2) => {
        if (state.prerender && state.prerender.fallback) {
          return await render_response({
            options: options2,
            $session: await options2.hooks.getSession(request2),
            page_config: { ssr: false, router: true, hydrate: true },
            status: 200,
            branch: []
          });
        }
        const decoded = decodeURI(request2.path);
        for (const route of options2.manifest.routes) {
          const match = route.pattern.exec(decoded);
          if (!match)
            continue;
          const response = route.type === "endpoint" ? await render_endpoint(request2, route, match) : await render_page(request2, route, match, options2, state);
          if (response) {
            if (response.status === 200) {
              const cache_control = get_single_valued_header(response.headers, "cache-control");
              if (!cache_control || !/(no-store|immutable)/.test(cache_control)) {
                const etag = `"${hash(response.body || "")}"`;
                if (request2.headers["if-none-match"] === etag) {
                  return {
                    status: 304,
                    headers: {}
                  };
                }
                response.headers["etag"] = etag;
              }
            }
            return response;
          }
        }
        const $session = await options2.hooks.getSession(request2);
        return await respond_with_error({
          request: request2,
          options: options2,
          state,
          $session,
          status: 404,
          error: new Error(`Not found: ${request2.path}`)
        });
      }
    });
  } catch (err) {
    const e = coalesce_to_error(err);
    options2.handle_error(e, request);
    return {
      status: 500,
      headers: {},
      body: options2.dev ? e.stack : e.message
    };
  }
}
function run(fn) {
  return fn();
}
function blank_object() {
  return Object.create(null);
}
function run_all(fns) {
  fns.forEach(run);
}
function custom_event(type, detail, bubbles = false) {
  const e = document.createEvent("CustomEvent");
  e.initCustomEvent(type, bubbles, false, detail);
  return e;
}
function set_current_component(component) {
  current_component = component;
}
function get_current_component() {
  if (!current_component)
    throw new Error("Function called outside component initialization");
  return current_component;
}
function createEventDispatcher() {
  const component = get_current_component();
  return (type, detail) => {
    const callbacks = component.$$.callbacks[type];
    if (callbacks) {
      const event = custom_event(type, detail);
      callbacks.slice().forEach((fn) => {
        fn.call(component, event);
      });
    }
  };
}
function setContext(key, context) {
  get_current_component().$$.context.set(key, context);
}
function escape(html) {
  return String(html).replace(/["'&<>]/g, (match) => escaped[match]);
}
function validate_component(component, name) {
  if (!component || !component.$$render) {
    if (name === "svelte:component")
      name += " this={...}";
    throw new Error(`<${name}> is not a valid SSR component. You may need to review your build config to ensure that dependencies are compiled, rather than imported as pre-compiled modules`);
  }
  return component;
}
function create_ssr_component(fn) {
  function $$render(result, props, bindings, slots, context) {
    const parent_component = current_component;
    const $$ = {
      on_destroy,
      context: new Map(context || (parent_component ? parent_component.$$.context : [])),
      on_mount: [],
      before_update: [],
      after_update: [],
      callbacks: blank_object()
    };
    set_current_component({ $$ });
    const html = fn(result, props, bindings, slots);
    set_current_component(parent_component);
    return html;
  }
  return {
    render: (props = {}, { $$slots = {}, context = new Map() } = {}) => {
      on_destroy = [];
      const result = { title: "", head: "", css: new Set() };
      const html = $$render(result, props, {}, $$slots, context);
      run_all(on_destroy);
      return {
        html,
        css: {
          code: Array.from(result.css).map((css22) => css22.code).join("\n"),
          map: null
        },
        head: result.title + result.head
      };
    },
    $$render
  };
}
function add_attribute(name, value, boolean) {
  if (value == null || boolean && !value)
    return "";
  return ` ${name}${value === true ? "" : `=${typeof value === "string" ? JSON.stringify(escape(value)) : `"${value}"`}`}`;
}
function afterUpdate() {
}
function set_paths(paths) {
  base = paths.base;
  assets = paths.assets || base;
}
function set_prerendering(value) {
}
function init(settings = default_settings) {
  set_paths(settings.paths);
  set_prerendering(settings.prerendering || false);
  const hooks = get_hooks(user_hooks);
  options = {
    amp: false,
    dev: false,
    entry: {
      file: assets + "/_app/start-4b538730.js",
      css: [assets + "/_app/assets/start-d5b4de3e.css"],
      js: [assets + "/_app/start-4b538730.js", assets + "/_app/chunks/vendor-c3215d3b.js"]
    },
    fetched: void 0,
    floc: false,
    get_component_path: (id) => assets + "/_app/" + entry_lookup[id],
    get_stack: (error2) => String(error2),
    handle_error: (error2, request) => {
      hooks.handleError({ error: error2, request });
      error2.stack = options.get_stack(error2);
    },
    hooks,
    hydrate: true,
    initiator: void 0,
    load_component,
    manifest,
    paths: settings.paths,
    prerender: true,
    read: settings.read,
    root: Root,
    service_worker: null,
    router: true,
    ssr: true,
    target: "#svelte",
    template,
    trailing_slash: "never"
  };
}
async function load_component(file) {
  const { entry, css: css22, js, styles } = metadata_lookup[file];
  return {
    module: await module_lookup[file](),
    entry: assets + "/_app/" + entry,
    css: css22.map((dep) => assets + "/_app/" + dep),
    js: js.map((dep) => assets + "/_app/" + dep),
    styles
  };
}
function render(request, {
  prerender
} = {}) {
  const host = request.headers["host"];
  return respond({ ...request, host }, options, { prerender });
}
var __accessCheck, __privateGet, __privateAdd, __privateSet, _map, chars, unsafeChars, reserved, escaped$1, objectProtoOwnPropertyNames, subscriber_queue, escape_json_string_in_html_dict, escape_html_attr_dict, s$1, s, absolute, ReadOnlyFormData, current_component, escaped, missing_component, on_destroy, css2, Root, base, assets, user_hooks, template, options, default_settings, empty, manifest, get_hooks, module_lookup, metadata_lookup;
var init_app_613f20d5 = __esm({
  ".svelte-kit/output/server/chunks/app-613f20d5.js"() {
    init_shims();
    __accessCheck = (obj, member, msg) => {
      if (!member.has(obj))
        throw TypeError("Cannot " + msg);
    };
    __privateGet = (obj, member, getter) => {
      __accessCheck(obj, member, "read from private field");
      return getter ? getter.call(obj) : member.get(obj);
    };
    __privateAdd = (obj, member, value) => {
      if (member.has(obj))
        throw TypeError("Cannot add the same private member more than once");
      member instanceof WeakSet ? member.add(obj) : member.set(obj, value);
    };
    __privateSet = (obj, member, value, setter) => {
      __accessCheck(obj, member, "write to private field");
      setter ? setter.call(obj, value) : member.set(obj, value);
      return value;
    };
    chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ_$";
    unsafeChars = /[<>\b\f\n\r\t\0\u2028\u2029]/g;
    reserved = /^(?:do|if|in|for|int|let|new|try|var|byte|case|char|else|enum|goto|long|this|void|with|await|break|catch|class|const|final|float|short|super|throw|while|yield|delete|double|export|import|native|return|switch|throws|typeof|boolean|default|extends|finally|package|private|abstract|continue|debugger|function|volatile|interface|protected|transient|implements|instanceof|synchronized)$/;
    escaped$1 = {
      "<": "\\u003C",
      ">": "\\u003E",
      "/": "\\u002F",
      "\\": "\\\\",
      "\b": "\\b",
      "\f": "\\f",
      "\n": "\\n",
      "\r": "\\r",
      "	": "\\t",
      "\0": "\\0",
      "\u2028": "\\u2028",
      "\u2029": "\\u2029"
    };
    objectProtoOwnPropertyNames = Object.getOwnPropertyNames(Object.prototype).sort().join("\0");
    Promise.resolve();
    subscriber_queue = [];
    escape_json_string_in_html_dict = {
      '"': '\\"',
      "<": "\\u003C",
      ">": "\\u003E",
      "/": "\\u002F",
      "\\": "\\\\",
      "\b": "\\b",
      "\f": "\\f",
      "\n": "\\n",
      "\r": "\\r",
      "	": "\\t",
      "\0": "\\0",
      "\u2028": "\\u2028",
      "\u2029": "\\u2029"
    };
    escape_html_attr_dict = {
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;"
    };
    s$1 = JSON.stringify;
    s = JSON.stringify;
    absolute = /^([a-z]+:)?\/?\//;
    ReadOnlyFormData = class {
      constructor(map) {
        __privateAdd(this, _map, void 0);
        __privateSet(this, _map, map);
      }
      get(key) {
        const value = __privateGet(this, _map).get(key);
        return value && value[0];
      }
      getAll(key) {
        return __privateGet(this, _map).get(key);
      }
      has(key) {
        return __privateGet(this, _map).has(key);
      }
      *[Symbol.iterator]() {
        for (const [key, value] of __privateGet(this, _map)) {
          for (let i = 0; i < value.length; i += 1) {
            yield [key, value[i]];
          }
        }
      }
      *entries() {
        for (const [key, value] of __privateGet(this, _map)) {
          for (let i = 0; i < value.length; i += 1) {
            yield [key, value[i]];
          }
        }
      }
      *keys() {
        for (const [key] of __privateGet(this, _map))
          yield key;
      }
      *values() {
        for (const [, value] of __privateGet(this, _map)) {
          for (let i = 0; i < value.length; i += 1) {
            yield value[i];
          }
        }
      }
    };
    _map = new WeakMap();
    Promise.resolve();
    escaped = {
      '"': "&quot;",
      "'": "&#39;",
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;"
    };
    missing_component = {
      $$render: () => ""
    };
    css2 = {
      code: "#svelte-announcer.svelte-1j55zn5{position:absolute;left:0;top:0;clip:rect(0 0 0 0);clip-path:inset(50%);overflow:hidden;white-space:nowrap;width:1px;height:1px}",
      map: null
    };
    Root = create_ssr_component(($$result, $$props, $$bindings, slots) => {
      let { stores } = $$props;
      let { page } = $$props;
      let { components } = $$props;
      let { props_0 = null } = $$props;
      let { props_1 = null } = $$props;
      let { props_2 = null } = $$props;
      setContext("__svelte__", stores);
      afterUpdate(stores.page.notify);
      if ($$props.stores === void 0 && $$bindings.stores && stores !== void 0)
        $$bindings.stores(stores);
      if ($$props.page === void 0 && $$bindings.page && page !== void 0)
        $$bindings.page(page);
      if ($$props.components === void 0 && $$bindings.components && components !== void 0)
        $$bindings.components(components);
      if ($$props.props_0 === void 0 && $$bindings.props_0 && props_0 !== void 0)
        $$bindings.props_0(props_0);
      if ($$props.props_1 === void 0 && $$bindings.props_1 && props_1 !== void 0)
        $$bindings.props_1(props_1);
      if ($$props.props_2 === void 0 && $$bindings.props_2 && props_2 !== void 0)
        $$bindings.props_2(props_2);
      $$result.css.add(css2);
      {
        stores.page.set(page);
      }
      return `


${validate_component(components[0] || missing_component, "svelte:component").$$render($$result, Object.assign(props_0 || {}), {}, {
        default: () => `${components[1] ? `${validate_component(components[1] || missing_component, "svelte:component").$$render($$result, Object.assign(props_1 || {}), {}, {
          default: () => `${components[2] ? `${validate_component(components[2] || missing_component, "svelte:component").$$render($$result, Object.assign(props_2 || {}), {}, {})}` : ``}`
        })}` : ``}`
      })}

${``}`;
    });
    base = "";
    assets = "";
    user_hooks = /* @__PURE__ */ Object.freeze({
      __proto__: null,
      [Symbol.toStringTag]: "Module"
    });
    template = ({ head, body }) => '<!DOCTYPE html>\n<html lang="en">\n\n<head>\n	<meta charset="utf-8" />\n	<link rel="icon" href="/favicon.png" />\n	<meta name="viewport" content="width=device-width, initial-scale=1" />\n	<link rel="preconnect" href="https://fonts.googleapis.com">\n	<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n	<link\n		href="https://fonts.googleapis.com/css2?family=Work+Sans:ital,wght@0,100;0,200;0,300;0,400;0,500;0,600;0,700;0,800;0,900;1,100;1,200;1,300;1,400;1,500;1,600;1,700;1,800;1,900&display=swap"\n		rel="stylesheet">\n	' + head + '\n</head>\n\n<body>\n	<div id="svelte">' + body + "</div>\n</body>\n\n</html>";
    options = null;
    default_settings = { paths: { "base": "", "assets": "" } };
    empty = () => ({});
    manifest = {
      assets: [{ "file": ".nojekyll", "size": 0, "type": null }, { "file": "CNAME", "size": 17, "type": null }, { "file": "favicon.png", "size": 1571, "type": "image/png" }],
      layout: "src/routes/__layout.svelte",
      error: ".svelte-kit/build/components/error.svelte",
      routes: [
        {
          type: "page",
          pattern: /^\/$/,
          params: empty,
          a: ["src/routes/__layout.svelte", "src/routes/index.svelte"],
          b: [".svelte-kit/build/components/error.svelte"]
        }
      ]
    };
    get_hooks = (hooks) => ({
      getSession: hooks.getSession || (() => ({})),
      handle: hooks.handle || (({ request, resolve: resolve2 }) => resolve2(request)),
      handleError: hooks.handleError || (({ error: error2 }) => console.error(error2.stack)),
      externalFetch: hooks.externalFetch || fetch
    });
    module_lookup = {
      "src/routes/__layout.svelte": () => Promise.resolve().then(() => (init_layout_187693d0(), layout_187693d0_exports)),
      ".svelte-kit/build/components/error.svelte": () => Promise.resolve().then(() => (init_error_5de2f330(), error_5de2f330_exports)),
      "src/routes/index.svelte": () => Promise.resolve().then(() => (init_index_8398370e(), index_8398370e_exports))
    };
    metadata_lookup = { "src/routes/__layout.svelte": { "entry": "pages/__layout.svelte-25b68306.js", "css": ["assets/pages/__layout.svelte-118673bd.css"], "js": ["pages/__layout.svelte-25b68306.js", "chunks/vendor-c3215d3b.js"], "styles": [] }, ".svelte-kit/build/components/error.svelte": { "entry": "error.svelte-39282d44.js", "css": [], "js": ["error.svelte-39282d44.js", "chunks/vendor-c3215d3b.js"], "styles": [] }, "src/routes/index.svelte": { "entry": "pages/index.svelte-73bd31ca.js", "css": ["assets/pages/index.svelte-79432d82.css"], "js": ["pages/index.svelte-73bd31ca.js", "chunks/vendor-c3215d3b.js"], "styles": [] } };
  }
});

// .svelte-kit/vercel/entry.js
__export(exports, {
  default: () => entry_default
});
init_shims();

// node_modules/@sveltejs/kit/dist/node.js
init_shims();
function getRawBody(req) {
  return new Promise((fulfil, reject) => {
    const h = req.headers;
    if (!h["content-type"]) {
      return fulfil(null);
    }
    req.on("error", reject);
    const length = Number(h["content-length"]);
    if (isNaN(length) && h["transfer-encoding"] == null) {
      return fulfil(null);
    }
    let data = new Uint8Array(length || 0);
    if (length > 0) {
      let offset = 0;
      req.on("data", (chunk) => {
        const new_len = offset + Buffer.byteLength(chunk);
        if (new_len > length) {
          return reject({
            status: 413,
            reason: 'Exceeded "Content-Length" limit'
          });
        }
        data.set(chunk, offset);
        offset = new_len;
      });
    } else {
      req.on("data", (chunk) => {
        const new_data = new Uint8Array(data.length + chunk.length);
        new_data.set(data, 0);
        new_data.set(chunk, data.length);
        data = new_data;
      });
    }
    req.on("end", () => {
      fulfil(data);
    });
  });
}

// .svelte-kit/output/server/app.js
init_shims();
init_app_613f20d5();

// .svelte-kit/vercel/entry.js
init();
var entry_default = async (req, res) => {
  const { pathname, searchParams } = new URL(req.url || "", "http://localhost");
  let body;
  try {
    body = await getRawBody(req);
  } catch (err) {
    res.statusCode = err.status || 400;
    return res.end(err.reason || "Invalid request body");
  }
  const rendered = await render({
    method: req.method,
    headers: req.headers,
    path: pathname,
    query: searchParams,
    rawBody: body
  });
  if (rendered) {
    const { status, headers, body: body2 } = rendered;
    return res.writeHead(status, headers).end(body2);
  }
  return res.writeHead(404).end();
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {});
/*! fetch-blob. MIT License. Jimmy Wärting <https://jimmy.warting.se/opensource> */
