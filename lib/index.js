"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
exports.__esModule = true;
exports.createActionContext = exports.delay = exports.reduce = exports.createStore = void 0;
var redux_1 = require("redux");
var forever = new Promise(function () { });
var defaultReducer = function (state) {
    if (state === void 0) { state = {}; }
    return state;
};
function createStore(reducer) {
    if (reducer === void 0) { reducer = defaultReducer; }
    var args = [];
    for (var _i = 1; _i < arguments.length; _i++) {
        args[_i - 1] = arguments[_i];
    }
    var dynamicReducers = new Set();
    var store = redux_1.createStore.apply(void 0, __spreadArray([function (state, action) {
            if (dynamicReducers.size) {
                dynamicReducers.forEach(function (dynamicReducer) {
                    state = reduce(state, dynamicReducer, action);
                });
            }
            return reducer ? reducer(state, action) : state;
        }], args, false));
    var originalDispatch = store.dispatch;
    var actionContexts = new Map();
    var actionHandlers = new Set();
    var dispatch = function (action) {
        if (typeof action === "string") {
            action = { type: action };
        }
        else if (typeof action === "function") {
            action = { action: action };
        }
        if (typeof action.action !== "function") {
            actionHandlers.forEach(function (handler) { return handler(action); });
            return originalDispatch(action);
        }
        return processAction(action, { dispatch: dispatch, getState: store.getState }, actionContexts, actionHandlers, dynamicReducers);
    };
    store.dispatch = dispatch;
    return store;
}
exports.createStore = createStore;
function processAction(_a, _b, contexts, globalHandlers, globalReducers) {
    var data = _a.data, once = _a.once, payload = _a.payload, latest = _a.latest, debounce = _a.debounce, action = _a.action, _c = _a.type, type = _c === void 0 ? action.name || "action_" + Math.random().toString(36).substr(2) : _c, _d = _a.key, key = _d === void 0 ? type : _d, reducer = _a.reducer;
    var getState = _b.getState, dispatch = _b.dispatch;
    var wrappedHandler;
    var disposed = false;
    var handlers = new Set();
    var context = createActionContext({
        data: data,
        on: function (handler) {
            handlers.add(handler);
            if (!wrappedHandler) {
                wrappedHandler = function (action) {
                    handlers.forEach(function (handler) { return handler(action); });
                };
                globalHandlers.add(wrappedHandler);
            }
            return function () {
                handlers["delete"](handler);
            };
        },
        onCancel: function () {
            dispose(function () {
                dispatchAll(dispatch, type, ":cancelled");
            });
        }
    });
    var isAsync = false;
    if (reducer) {
        globalReducers.add(reducer);
    }
    context.prev = contexts.get(key);
    if (context.prev && once) {
        return context.__wrapedPromise || context.result;
    }
    contexts.set(key, context);
    var dispose = function (callback) {
        if (disposed)
            return;
        disposed = true;
        try {
            if (typeof callback === "function")
                callback();
        }
        finally {
            wrappedHandler && globalHandlers["delete"](wrappedHandler);
            reducer && globalReducers["delete"](reducer);
            if (!once && contexts.get(key) === context) {
                contexts["delete"](key);
            }
        }
    };
    try {
        if (latest || debounce) {
            context.cancelPrevious();
        }
        dispatchAll(dispatch, type, "", { payload: payload });
        var actionWrapper = debounce
            ? createDebouncedAction(action, debounce)
            : action;
        var result_1 = actionWrapper({
            getState: getState,
            dispatch: (function (action) {
                if (context.cancelled()) {
                    throw new Error("context:cancelled");
                }
                return dispatch(action);
            })
        }, context);
        isAsync = result_1 && typeof result_1.then === "function";
        // async action
        if (isAsync) {
            context.status = "loading";
            dispatchAll(dispatch, type, ":loading");
            var promise = Object.assign(new Promise(function (resolve, reject) {
                result_1
                    .then(function (result) {
                    if (context.cancelled())
                        return;
                    context.result = result;
                    context.status = "success";
                    dispatchAll(dispatch, type, ":success", { result: result });
                    resolve(result);
                })["catch"](function (error) {
                    if (context.cancelled())
                        return;
                    context.error = error;
                    context.status = "error";
                    dispatchAll(dispatch, type, ":fail", { error: error });
                    reject(error);
                })["finally"](dispose);
            }), {
                cancel: function () {
                    if (typeof result_1.cancel === "function") {
                        result_1.cancel();
                    }
                    context.cancel();
                }
            });
            context.__wrapedPromise = promise;
            context.__promise = result_1;
            return promise;
        }
        context.result = result_1;
        dispatchAll(dispatch, type, ":success", { result: result_1 });
        return result_1;
    }
    catch (error) {
        dispose(function () {
            context.error = error;
            dispatchAll(dispatch, type, ":error", { error: error });
        });
    }
    finally {
        !isAsync && dispose();
    }
}
function dispatchAll(dispatch, types, postfix, props) {
    if (!Array.isArray(types)) {
        types = [types];
    }
    return types.reduce(function (prev, type) {
        return type ? dispatch(__assign(__assign({}, props), { type: type + postfix })) : prev;
    }, undefined);
}
function reduce(state, reducer, action) {
    if (!reducer)
        return state;
    if (typeof reducer === "function") {
        return reducer(state, action);
    }
    var nextState = state;
    Object.entries(reducer).forEach(function (_a) {
        var prop = _a[0], propReducer = _a[1];
        var prevSubState = nextState[prop];
        var nextSubState = propReducer(prevSubState, action);
        if (nextSubState !== prevSubState) {
            if (nextState === state) {
                nextState = __assign({}, nextState);
            }
            nextState[prop] = nextSubState;
        }
    });
    return nextState;
}
exports.reduce = reduce;
function delay(ms) {
    return new Promise(function (resolve) { return setTimeout(resolve, ms); });
}
exports.delay = delay;
function createActionContext(_a) {
    var _b = _a === void 0 ? {} : _a, _c = _b.data, data = _c === void 0 ? {} : _c, on = _b.on, onCancel = _b.onCancel;
    var cancelled = false;
    var context = {
        data: data,
        cancelled: function () {
            return cancelled;
        },
        on: on,
        chain: function (funcs) {
            var _this = this;
            funcs = [].slice.call(funcs);
            var chainCancelled = false;
            return Object.assign(new Promise(function (resolve, reject) { return __awaiter(_this, void 0, void 0, function () {
                var result, e_1;
                var _a;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0:
                            _b.trys.push([0, 4, , 5]);
                            result = void 0;
                            _b.label = 1;
                        case 1:
                            if (!funcs.length) return [3 /*break*/, 3];
                            if (cancelled || chainCancelled)
                                return [2 /*return*/];
                            return [4 /*yield*/, ((_a = funcs.shift()) === null || _a === void 0 ? void 0 : _a(result))];
                        case 2:
                            result = _b.sent();
                            return [3 /*break*/, 1];
                        case 3:
                            resolve(result);
                            return [3 /*break*/, 5];
                        case 4:
                            e_1 = _b.sent();
                            if (cancelled)
                                return [2 /*return*/];
                            reject(e_1);
                            return [3 /*break*/, 5];
                        case 5: return [2 /*return*/];
                    }
                });
            }); }), {
                cancel: function () {
                    chainCancelled = true;
                }
            });
        },
        cancelPrevious: function () {
            var _a;
            (_a = context.prev) === null || _a === void 0 ? void 0 : _a.cancel();
        },
        cancel: function () {
            var _a;
            if (cancelled)
                return;
            (_a = context.__promise) === null || _a === void 0 ? void 0 : _a.cancel();
            cancelled = true;
            context.status = "cancelled";
            onCancel && onCancel();
        },
        status: null,
        forever: forever
    };
    return context;
}
exports.createActionContext = createActionContext;
function createDebouncedAction(action, ms) {
    var _this = this;
    return function (storeContext, actionContext) { return __awaiter(_this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, delay(ms)];
                case 1:
                    _a.sent();
                    if (actionContext.cancelled())
                        return [2 /*return*/];
                    return [2 /*return*/, action(storeContext, actionContext)];
            }
        });
    }); };
}
