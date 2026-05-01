"use client";

/**
 * Client context for totals edited in `EditableLineItems` (shown via `LiveRequestedTotal`).
 */

import { createContext, useContext, useState, type ReactNode } from "react";

const LiveTotalContext = createContext<{
  total: number;
  setTotal: (t: number) => void;
}>({ total: 0, setTotal: () => {} });

export function LiveTotalProvider({ initialTotal, children }: { initialTotal: number; children: ReactNode }) {
  const [total, setTotal] = useState(initialTotal);
  return (
    <LiveTotalContext.Provider value={{ total, setTotal }}>
      {children}
    </LiveTotalContext.Provider>
  );
}

export function useLiveTotal() {
  return useContext(LiveTotalContext);
}

export function LiveRequestedTotal() {
  const { total } = useLiveTotal();
  return <>${total.toFixed(2)}</>;
}
