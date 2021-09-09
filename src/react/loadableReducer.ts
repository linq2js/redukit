import { AnyAction, Reducer } from "redux";
import { Loadable } from "./types";

export interface Options {
  resultAsData?: boolean;
  innerReducer?: Reducer<any>;
  prop?: string;
}

export default function loadableReducer<T = any>(
  actionType: string,
  { resultAsData = true, innerReducer, prop }: Options = {}
) {
  const defaultState = {
    loading: false,
    pending: true,
    data: undefined,
    error: undefined,
  };

  return (state: any, action: AnyAction): Loadable<T> => {
    let prevState = (prop ? state[prop] : state) || defaultState;

    let nextState: any;
    switch (action.type) {
      case `${actionType}:loading`:
        nextState = {
          ...prevState,
          loading: true,
          error: undefined,
          pending: false,
        };
        break;
      case `${actionType}:error`:
        nextState = {
          ...prevState,
          loading: false,
          pending: false,
          error: action.error,
        };
        break;
      case `${actionType}:cancelled`:
        nextState = {
          ...prevState,
          loading: false,
          pending: false,
          error: action.error,
        };
        break;
      case `${actionType}:success`:
        nextState = resultAsData
          ? {
              ...prevState,
              loading: false,
              error: undefined,
              pending: false,
              data: action.result,
            }
          : action.result;
        break;
      default:
        return innerReducer ? innerReducer(state, action) : state;
    }

    if (prevState === nextState) return state;

    if (prop) {
      return { ...state, [prop]: nextState };
    }
    return nextState;
  };
}
