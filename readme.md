# REDUKIT

A redux kit that supports async action and many more

## Installation

**with NPM**

```bash
npm i redukit --save
```

**with YARN**

```bash
yarn add redukit
```

## Peerdependencies

- redux

## Usages

### Creating store

```js
import { createStore } from "redukit";

// redukit's createStore has the same signature with redux's
const store = createStore((state, action) => {
  if (action.type === "increase") return state + 1;
  return state;
});

// dispatch action object
store.dispatch({ type: "increase" });
// dispatch with action type
store.dispatch("increase");
```

### Using redukit with React

```jsx
import { createStore } from "redukit";
import { Provider, useStore, useDispatch, useSelector } from "react-redux";

const store = createStore();

function Home() {
  // redukit compatibles with all redux's hooks
  const store = useStore();
  const dispatch = useDispatch();
  const value = useSelector((state) => state.value);
}

function App() {
  return (
    <Provider store={store}>
      <Home />
    </Provider>
  );
}
```

### Creating async action

```jsx
const store = createStore((state = { count: 0, message: "" }) => state);

const IncreaseAsync = () => ({
  type: "increase",
  action: async ({ dispatch, getState }) => {
    // delay in 500ms
    await new Promise((resolve) => setTimeout(resolve, 500));
    // do something
    dispatch({ type: "otherAction" });
    // get store state
    console.log("state", getState());
  },
  reducer: (state, action) => {
    switch (action.type) {
      case "increase":
        return {
          ...state,
          message: "start",
        };
      case "increase:loading":
        return {
          ...state,
          message: "loading",
        };
      case "increase:error":
        return {
          ...state,
          message: "error",
          error: action.error,
        };
      case "increase:success":
        return {
          ...state,
          message: "success",
          // a return value of actionFn
          result: action.result,
          // increase count state
          count: state.count + 1,
        };
      case "otherAction":
        return state;
    }
    return state;
  },
});

store.dispatch(IncreaseAsync());
```

### Deboucing

```js
const Delay = (ms) => () => new Promise((resolve) => setTimeout(resolve, ms));

const Search = () => ({
  type: "search",
  action: async ({ dispatch, getState }, actionContext) => {
    // cancel previous execution if any
    // avoid dispatching search action many times
    actionContext.cancelPrevious();
    actionContext.on((action) => {
      // if user clicks on cancel button
      if (action.type === "cancelSearch") {
        // cancel execution
        actionContext.cancel();
      }
    });
    // delay searching progress in 300ms
    await dispatch(Delay(300));
    // get term from state
    const term = getState().term;
    // dispatch other action
    const result = await dispatch(
      Api({ endpoint: "search", params: { term } })
    );
    return result;
  },
  reducer: (state, action) =>
    action.type === "search:success"
      ? { ...state, searchResults: action.result }
      : state,
});

// using latest option instead actionContext.cancelPrevious()
const Search = () => ({
  // once the store dispatches this action, it cancels previous execution if any automatically
  latest: true,
  action: () => {},
  reducer: () => {},
});

// using debouce option instead of latest + delay
const Search = () => ({
  debounce: 300,
  action: () => {},
  reducer: () => {},
});
```

### Dispatching action once

```js
const Init = () => ({
  once: true,
  action() {
    // do initializing
  },
});

store.dispatch(Init());
// will ignore
store.dispatch(Init());
```

### Simple react-query implementation

```jsx
const store = createStore();

function useQuery(key, endpoint, { lazy } = {}) {
  const dispatch = useDispatch();
  const result = useSelector((state) => state[key]) || {};
  const ref = useRef({
    fetchData,
  });
  const actionType = `${key}.query`;
  const reducer = {
    // using key as state prop
    [key]: (state, action) => {
      switch (action.type) {
        case `${actionType}:loading`:
          return { loading: true };
        case `${actionType}:success`:
          return action.result;
        case `${actionType}:error`:
          return { error: action.error };
        default:
          return state;
      }
    },
  };

  function fetchData(noCache) {
    dispatch({
      // multiple action types
      // other reducer can handle query, query:success, query:loading, query:error actions
      type: [actionType, "query"],
      latest: true,
      async action({ getState }) {
        if (!noCache) {
          const existingResult = getState()[key];
          if (existingResult) {
            console.log("existing");
            return existingResult;
          }
        }
        const res = await fetch(endpoint);

        const json = await res.json();

        return {
          data: json,
        };
      },
      reducer,
    });
  }

  function update(data) {
    if (typeof data === "function") {
      data = data(result.data);
    }
    dispatch({
      type: actionType,
      action: () => ({ data }),
      reducer,
    });
  }

  useEffect(() => {
    if (!lazy) {
      ref.current.fetchData();
    }
  }, [endpoint, lazy]);

  return {
    ...result,
    refetch: () => fetchData(true),
    fetch: fetchData,
    update,
  };
}

function App() {
  const { loading, data, fetch, refetch, update } = useQuery(
    "users",
    "https://jsonplaceholder.typicode.com/users"
  );

  return (
    <div className="App">
      <button onClick={() => fetch()}>Fetch</button>
      <button onClick={() => refetch()}>Refetch</button>
      <button
        onClick={() =>
          update((data) =>
            [
              {
                id: Math.random(),
                name: "New user " + Math.random().toString(36),
              },
            ].concat(data || [])
          )
        }
      >
        Update query data
      </button>
      {loading && <div>Loading...</div>}
      <pre>{JSON.stringify(data, null, 2)}</pre>
    </div>
  );
}
```
