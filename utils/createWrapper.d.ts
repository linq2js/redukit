import * as React from "react";
import { Store } from "redux";
export default function createWrapper<TState = any>(...args: any[]): [React.FC, Store<TState>];
