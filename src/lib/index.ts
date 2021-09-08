import {
  AnyAction,
  createStore as reduxCreateStore,
  Reducer,
  Store,
} from "redux";

const forever = new Promise(() => {});
const defaultReducer = (state = {}) => state;

export interface ActionContext<TResult = any, TState = any, TData = any> {
  prev?: ActionContext;
  cancel(): void;
  cancelPrevious(): void;
  data: TData;
  on: RegisterActionListener;
  status: "loading" | "error" | "success" | "cancelled" | null;
  cancelled(): boolean;
  result?: TResult;
  error?: Error;
  chain<T = any>(funcs: Function[]): CancellablePromise<T>;
  forever: Promise<any>;
  dispatch: Dispatcher<TState>;
  getState(): TState;
}

export interface AsyncAction<TResult = any, TState = any> {
  debounce?: number;
  delay?: number;
  data?: any;
  once?: boolean;
  payload?: any;
  latest?: boolean;
  type?: string | string[];
  key?: any;
  reducer?: ActionReducer<TState>;
  action: (actionContext: ActionContext<TResult, TState>) => TResult;
}

export type SupportedAction<TState> =
  | AnyAction
  | string
  | AsyncAction<any, TState>
  | ((context: ActionContext<TState>) => any);

export type Dispatcher<TState> = (action: SupportedAction<TState>) => TState;

export type CancellablePromise<T = any> = Promise<T> & { cancel(): void };

export type ActionReducer<T = any> = Reducer<T> | { [key: string]: Reducer };

export type ActionHandler = (action: AnyAction) => void;

export type RegisterActionListener = (handler: ActionHandler) => Function;

export interface ActionContextOptions<TData, TState = any> {
  on: RegisterActionListener;
  data?: TData;
  getState(): TState;
  dispatch: Dispatcher<TState>;
  onCancel?: () => void;
}

export interface AsyncStore<TState> {
  dispatch: Dispatcher<TState>;
}

export function createStore<TState = any>(
  reducer: Reducer<TState, AnyAction> = defaultReducer as any,
  ...args: any[]
): AsyncStore<TState> & Store<TState> {
  const dynamicReducers = new Set<ActionReducer>();
  const store: Store<TState> = reduxCreateStore((state, action) => {
    if (dynamicReducers.size) {
      dynamicReducers.forEach((dynamicReducer) => {
        state = reduce(state, dynamicReducer, action);
      });
    }

    return reducer ? reducer(state as any, action as any) : state;
  }, ...args);
  const originalDispatch = store.dispatch;
  const contextDictionary = new Map<any, ActionContext>();
  const actionHandlers = new Set<ActionHandler>();

  const dispatch = (action: SupportedAction<TState>): any => {
    if (typeof action === "string") {
      action = { type: action };
    } else if (typeof action === "function") {
      action = { action };
    }

    if (typeof action.action !== "function") {
      actionHandlers.forEach((handler) => handler(action as AnyAction));
      return originalDispatch(action as AnyAction);
    }

    return dispatchAsyncAction(
      action as AsyncAction<TState>,
      store.getState,
      dispatch,
      contextDictionary,
      actionHandlers,
      dynamicReducers
    );
  };

  return Object.assign(store, { dispatch });
}

function dispatchAsyncAction<TState>(
  {
    data,
    once,
    payload,
    latest,
    debounce,
    delay,
    action,
    type = action.name || "action_" + Math.random().toString(36).substr(2),
    key = type,
    reducer,
  }: AsyncAction<any, TState>,
  getState: () => TState,
  dispatch: Dispatcher<TState>,
  contextDictionary: Map<any, ActionContext>,
  globalHandlers: Set<(action: AnyAction) => void>,
  globalReducers: Set<ActionReducer>
) {
  let wrappedHandler: (action: AnyAction) => void;
  let disposed = false;
  const handlers = new Set<Function>();
  const context = createActionContext({
    data,
    getState,
    dispatch: ((action: AsyncAction) => {
      if (context.cancelled()) {
        throw new Error("context:cancelled");
      }
      return dispatch(action);
    }) as any,
    on(handler) {
      handlers.add(handler);
      if (!wrappedHandler) {
        wrappedHandler = (action: AnyAction) => {
          handlers.forEach((handler) => handler(action));
        };
        globalHandlers.add(wrappedHandler);
      }
      return () => {
        handlers.delete(handler);
      };
    },
    onCancel() {
      dispose(() => {
        dispatchAll(dispatch, type, ":cancelled");
      });
    },
  });

  let isAsync = false;

  if (reducer) {
    globalReducers.add(reducer);
  }

  context.prev = contextDictionary.get(key);

  if (context.prev && once) {
    return (context as any).__wrapedPromise || context.result;
  }

  contextDictionary.set(key, context);

  const dispose = (callback?: Function) => {
    if (disposed) return;
    disposed = true;
    try {
      if (typeof callback === "function") callback();
    } finally {
      wrappedHandler && globalHandlers.delete(wrappedHandler);
      reducer && globalReducers.delete(reducer);
      if (!once && contextDictionary.get(key) === context) {
        contextDictionary.delete(key);
      }
    }
  };

  try {
    if (latest || debounce) {
      context.cancelPrevious();
    }
    dispatchAll(dispatch, type, "", { payload });
    const ms = debounce || delay || 0;
    const actionWrapper = ms ? createDebouncedAction(action, ms) : action;
    const result = actionWrapper(context);
    isAsync = result && typeof result.then === "function";
    // async action
    if (isAsync) {
      context.status = "loading";
      dispatchAll(dispatch, type, ":loading");
      const promise: CancellablePromise = Object.assign(
        new Promise((resolve, reject) => {
          result
            .then((result: any) => {
              if (context.cancelled()) return;
              context.result = result;
              context.status = "success";
              dispatchAll(dispatch, type, ":success", { result });
              resolve(result);
            })
            .catch((error: Error) => {
              if (context.cancelled()) return;
              context.error = error;
              context.status = "error";
              dispatchAll(dispatch, type, ":fail", { error });
              reject(error);
            })
            .finally(dispose);
        }),
        {
          cancel() {
            if (typeof result.cancel === "function") {
              result.cancel();
            }
            context.cancel();
          },
        }
      );
      (context as any).__wrapedPromise = promise;
      (context as any).__promise = result;
      return promise;
    }
    context.result = result;
    dispatchAll(dispatch, type, ":success", { result });
    return result;
  } catch (error) {
    dispose(() => {
      context.error = error as Error;
      dispatchAll(dispatch, type, ":error", { error });
    });
  } finally {
    !isAsync && dispose();
  }
}

function dispatchAll(
  dispatch: Function,
  types: string | string[],
  postfix: string,
  props?: {}
) {
  if (!Array.isArray(types)) {
    types = [types];
  }
  return types.reduce(
    (prev, type) =>
      type ? dispatch({ ...props, type: type + postfix }) : prev,
    undefined
  );
}

export function reduce<TState>(
  state: TState,
  reducer: ActionReducer,
  action: AnyAction
) {
  if (!reducer) return state;
  if (typeof reducer === "function") {
    return reducer(state, action);
  }
  let nextState: any = state;
  Object.entries(reducer).forEach(([prop, propReducer]) => {
    const prevSubState = nextState[prop];
    const nextSubState = propReducer(prevSubState, action);

    if (nextSubState !== prevSubState) {
      if (nextState === state) {
        nextState = { ...nextState };
      }
      nextState[prop] = nextSubState;
    }
  });
  return nextState;
}

export function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function createActionContext<TResult = any, TState = any, TData = any>(
  {
    data = {} as TData,
    on,
    onCancel,
    getState,
    dispatch,
  }: ActionContextOptions<TData> = {} as any
) {
  let cancelled = false;
  const context: ActionContext<TResult, TState, TData> = {
    data,
    getState,
    dispatch,
    cancelled() {
      return cancelled;
    },
    on,
    chain(funcs) {
      funcs = [].slice.call(funcs);
      let chainCancelled = false;

      return Object.assign(
        new Promise<any>(async (resolve, reject) => {
          try {
            let result: any;
            while (funcs.length) {
              if (cancelled || chainCancelled) return;
              result = await funcs.shift()?.(result);
            }
            resolve(result);
          } catch (e) {
            if (cancelled) return;
            reject(e);
          }
        }),
        {
          cancel() {
            chainCancelled = true;
          },
        }
      ) as CancellablePromise;
    },
    cancelPrevious() {
      context.prev?.cancel();
    },
    cancel() {
      if (cancelled) return;
      (context as any).__promise?.cancel();
      cancelled = true;
      context.status = "cancelled";
      onCancel && onCancel();
    },
    status: null,
    forever,
  };
  return context;
}

function createDebouncedAction<TState>(
  action: AsyncAction["action"],
  ms: number
) {
  return async (actionContext: ActionContext<any, TState>) => {
    await delay(ms);
    if (actionContext.cancelled()) return;
    return action(actionContext);
  };
}
