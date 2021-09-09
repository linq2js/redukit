import { createStore } from ".";

test("createStore with default reducer", () => {
  const store = createStore();
  expect(store).not.toBeUndefined();
});
