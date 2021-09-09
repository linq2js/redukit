import * as React from "react";
import { AsyncStore } from "../lib";
export default function createWrapper<TState = any>(...args: any[]): [React.FC, AsyncStore<TState>];
