import { Action, Reducer } from "redux";
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
    data?: any;
    once?: boolean;
    payload?: any;
    latest?: boolean;
    type?: string | string[];
    key?: any;
    reducer?: ActionReducer<TState>;
    action: (storeContext: StoreContext<TState>, actionContext: ActionContext) => TResult;
}
export declare type Dispatcher<TState> = (action: Action | string | AsyncAction<any, TState>) => TState;
export declare type CancellablePromise<T = any> = Promise<T> & {
    cancel(): void;
};
export declare type ActionReducer<T = any> = Reducer<T> | {
    [key: string]: Reducer;
};
export declare type ActionHandler = (action: Action) => void;
export declare type RegisterActionListener = (handler: ActionHandler) => Function;
export interface ActionContextOptions<TData> {
    on: RegisterActionListener;
    data?: TData;
    onCancel?: () => void;
}
export declare function createStore<TState = any, TAction extends Action = Action>(reducer?: Reducer<TState, TAction>, ...args: any[]): import("redux").Store<unknown, Action<any>>;
export declare function reduce<TState>(state: TState, reducer: ActionReducer, action: Action): any;
export declare function delay(ms: number): Promise<unknown>;
export declare function createActionContext<TResult = any, TData = any>({ data, on, onCancel }?: ActionContextOptions<TData>): ActionContext<TResult, TData>;
