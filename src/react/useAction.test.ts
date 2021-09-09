import { act, renderHook } from "@testing-library/react-hooks";
import { delay } from "../lib";
import createWrapper from "../utils/createWrapper";
import useAction from "./useAction";

test("async action", async () => {
  const [wrapper, store] = createWrapper();
  const creator = (data: number) => ({
    delay: 10,
    action: () => data,
  });

  const { result, unmount } = renderHook(
    () => useAction("actionResult", creator, { payload: 1 }),
    { wrapper }
  );

  expect(result.current.loading).toBe(true);
  expect(result.current.pending).toBe(false);

  await act(async () => {
    await delay(15);
  });

  expect(result.current.loading).toBe(false);
  expect(result.current.data).toBe(1);

  result.current.start(2);

  expect(result.current.loading).toBe(false);
  expect(result.current.data).toBe(1);

  await act(async () => {
    await delay(15);
  });

  expect(result.current.loading).toBe(false);
  expect(result.current.data).toBe(1);

  act(() => {
    result.current.restart(2);
  });

  // after execution restarted, keep previous data
  expect(result.current.loading).toBe(true);
  expect(result.current.data).toBe(1);

  await act(async () => {
    await delay(15);
  });

  expect(result.current.loading).toBe(false);
  expect(result.current.data).toBe(2);

  unmount();

  // after unmount, the action result still in store
  expect(store.getState()).toEqual({
    actionResult: {
      loading: false,
      data: 2,
      pending: false,
    },
  });
});
