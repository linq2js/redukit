import { AnyAction } from "redux";
import { useEffect, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";
import { AsyncAction, reduce } from "../lib";
import { Loadable } from "./types";
import loadableReducer from "./loadableReducer";

export interface UseActionOptions<TData, TPayload> {
  lazy?: boolean;
  data?: TData;
  payload?: TPayload;
  resultAsData?: boolean;
  autoDispose?: boolean;
}

export type ActionResultInfer<T> = T extends Promise<infer TResolved>
  ? TResolved
  : T;

export type UseActionResult<TData, TPayload> = {
  start(payload?: TPayload): void;
  restart(payload?: TPayload): void;
  update(data: TData): void;
  update(reducer: (data: TData) => TData): void;
} & Loadable<TData>;

export default function useAction<TPayload, TResult>(
  key: string,
  creator: (payload: TPayload) => AsyncAction<TResult>,
  {
    lazy,
    data,
    payload,
    autoDispose,
    resultAsData,
  }: UseActionOptions<ActionResultInfer<TResult>, TPayload> = {}
): UseActionResult<ActionResultInfer<TResult>, TPayload> {
  const ref = useRef<any>();
  const dispatch = useDispatch();
  const loadable: Loadable<TResult> & { __temp: boolean } = useSelector(
    (state: any) => state[key]
  ) || {
    pending: !!lazy,
    loading: !lazy,
    data,
    __temp: true,
  };

  if (!ref.current) {
    const executeAction = (
      creator: (payload: TPayload) => AsyncAction<TResult>,
      payload: TPayload,
      noCache: boolean
    ) => {
      if (!noCache && !ref.current.loadable?.__temp) {
        return;
      }

      const asyncAction = creator(payload);

      let actionType: string | undefined = Array.isArray(asyncAction.type)
        ? asyncAction.type[0]
        : asyncAction.type;

      if (!actionType) {
        actionType = Math.random().toString(36).substr(2);
        asyncAction.type = actionType;
      }

      const reducer = loadableReducer(actionType, {
        prop: ref.current.key,
        resultAsData: ref.current.resultAsData,
      });

      ref.current.dispatch({
        ...asyncAction,
        reducer: (state: any, action: AnyAction) => {
          const nextState = reducer(state, action);
          if (asyncAction.reducer) {
            return reduce(nextState, asyncAction.reducer, action);
          }
          return nextState;
        },
      });
    };

    const update = (key: string, value: undefined) => {
      const disposeActionType = Math.random().toString().substr(2);
      ref.current.dispatch({
        type: disposeActionType,
        action: () => {},
        reducer: (state: any, action: AnyAction) => {
          if (action.type === disposeActionType) {
            const { [key]: removed, ...theRest } = state;
            if (typeof value !== "undefined") {
              theRest[key] = {
                loading: false,
                pending: false,
                error: undefined,
                data: value,
              };
            }
            return theRest;
          }
          return state;
        },
      });
    };

    ref.current = {
      start(payload = ref.current.payload) {
        executeAction(ref.current.creator, payload, false);
      },
      restart(payload = ref.current.payload) {
        executeAction(ref.current.creator, payload, true);
      },
      update(data: ((prev: any) => any) | any) {
        if (typeof data === "function") {
          // not started yet
          if (ref.current.loadable?.pending) return;
          data = data(ref.current.loadable.data);
        }
        update(ref.current.key, data);
      },
      dispose(key: string) {
        return update(key, undefined);
      },
    };
  }

  Object.assign(ref.current, {
    key,
    payload,
    creator,
    dispatch,
    loadable,
    resultAsData,
  });

  useEffect(() => {
    if (autoDispose) {
      const localKey = key;
      return () => {
        ref.current.dispose(localKey);
      };
    }
  }, [key, autoDispose]);

  useEffect(() => {
    if (!lazy) {
      ref.current.start();
    }
  }, [key, lazy]);

  return {
    ...ref.current,
    ...loadable,
  };
}
