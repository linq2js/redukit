import { Action, createStore as reduxCreateStore, Reducer } from "redux";

const forever = new Promise(() => {});
const defaultReducer = (state = {}) => state;

export interface ActionContext<TResult = any, TData = any> {
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
}

export interface StoreContext<TState> {
  getState(): TState;
  dispatch: Dispatcher<TState>;
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
  action: (
    storeContext: StoreContext<TState>,
    actionContext: ActionContext
  ) => TResult;
}

export type Dispatcher<TState> = (
  action: Action | string | AsyncAction<any, TState>
) => TState;

export type CancellablePromise<T = any> = Promise<T> & { cancel(): void };

export type ActionReducer<T = any> = Reducer<T> | { [key: string]: Reducer };

export type ActionHandler = (action: Action) => void;

export type RegisterActionListener = (handler: ActionHandler) => Function;

export interface ActionContextOptions<TData> {
  on: RegisterActionListener;
  data?: TData;
  onCancel?: () => void;
}

export function createStore<TState = any, TAction extends Action = Action>(
  reducer: Reducer<TState, TAction> = defaultReducer as any,
  ...args: any[]
) {
  const dynamicReducers = new Set<ActionReducer>();
  const store = reduxCreateStore((state, action) => {
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

  const dispatch = (action: any): any => {
    if (typeof action === "string") {
      action = { type: action };
    } else if (typeof action === "function") {
      action = { action };
    }

    if (typeof action.action !== "function") {
      actionHandlers.forEach((handler) => handler(action));
      return originalDispatch(action);
    }

    return dispatchAsyncAction(
      action,
      { dispatch, getState: store.getState },
      contextDictionary,
      actionHandlers,
      dynamicReducers
    );
  };

  store.dispatch = dispatch;

  return store;
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
  { getState, dispatch }: StoreContext<TState>,
  contextDictionary: Map<any, ActionContext>,
  globalHandlers: Set<(action: Action) => void>,
  globalReducers: Set<ActionReducer>
) {
  let wrappedHandler: (action: Action) => void;
  let disposed = false;
  const handlers = new Set<Function>();
  const context = createActionContext({
    data,
    on(handler) {
      handlers.add(handler);
      if (!wrappedHandler) {
        wrappedHandler = (action: Action) => {
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
    const result = actionWrapper(
      {
        getState,
        dispatch: ((action: AsyncAction) => {
          if (context.cancelled()) {
            throw new Error("context:cancelled");
          }
          return dispatch(action);
        }) as any,
      },
      context
    );
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
  action: Action
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

export function createActionContext<TResult = any, TData = any>(
  { data = {} as TData, on, onCancel }: ActionContextOptions<TData> = {} as any
) {
  let cancelled = false;
  const context: ActionContext<TResult, TData> = {
    data,
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
  return async (
    storeContext: StoreContext<TState>,
    actionContext: ActionContext
  ) => {
    await delay(ms);
    if (actionContext.cancelled()) return;
    return action(storeContext, actionContext);
  };
}
