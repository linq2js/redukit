import loadableReducer from "./loadableReducer";

test("state should not be changed for other actions", () => {
  const reducer = loadableReducer("search");
  const state = {};
  const nextState = reducer(state, { type: "other" });
  expect(state).toBe(nextState);
});
