import { useCallback, useEffect, useState } from "react";

const KEY = "hireflow.sidebar-collapsed";

function read(): boolean {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false; // storage can be unavailable (private mode, blocked cookies)
  }
}

export function useSidebarCollapsed(): [boolean, () => void] {
  const [collapsed, setCollapsed] = useState(read);

  useEffect(() => {
    try {
      localStorage.setItem(KEY, collapsed ? "1" : "0");
    } catch {
      /* preference simply won't persist */
    }
  }, [collapsed]);

  const toggle = useCallback(() => setCollapsed((c) => !c), []);
  return [collapsed, toggle];
}
