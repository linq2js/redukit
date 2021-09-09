import createWrapper from "../utils/createWrapper";
import { renderHook } from "@testing-library/react-hooks";
import { useStore } from "react-redux";

test("should work with redux's Provider properly", () => {
  const [wrapper, store] = createWrapper();
  const { result } = renderHook(() => useStore(), { wrapper });
  expect(store).toBe(result.current);
});
