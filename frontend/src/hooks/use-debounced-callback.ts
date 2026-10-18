import { useCallback, useEffect, useRef } from "react";

/** Debounced function that always calls the latest `fn` (no stale closures). */
export function useDebouncedCallback<A extends unknown[]>(fn: (...args: A) => void, delay = 300) {
  const latest = useRef(fn);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => {
    latest.current = fn;
  });
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const call = useCallback(
    (...args: A) => {
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => latest.current(...args), delay);
    },
    [delay],
  );
  const cancel = useCallback(() => window.clearTimeout(timer.current), []);
  return { call, cancel };
}
