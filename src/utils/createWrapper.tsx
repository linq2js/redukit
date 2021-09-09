import * as React from "react";
import { Provider } from "react-redux";
import { Store } from "redux";
import { createStore } from "../lib";

export default function createWrapper<TState = any>(
  ...args: any[]
): [React.FC, Store<TState>] {
  const store = createStore<TState>(...args);
  return [
    (props: any) => React.createElement(Provider, { ...props, store }),
    store,
  ];
}
