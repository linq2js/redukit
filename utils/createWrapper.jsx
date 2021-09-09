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
exports.__esModule = true;
var React = require("react");
var react_redux_1 = require("react-redux");
var lib_1 = require("../lib");
function createWrapper() {
    var args = [];
    for (var _i = 0; _i < arguments.length; _i++) {
        args[_i] = arguments[_i];
    }
    var store = lib_1.createStore.apply(void 0, args);
    return [
        function (props) { return React.createElement(react_redux_1.Provider, __assign(__assign({}, props), { store: store })); },
        store,
    ];
}
exports["default"] = createWrapper;
