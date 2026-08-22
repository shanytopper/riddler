import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { listRecentVenues, rememberVenue } from "../db/prefsRepo.ts";
import type { VenueSummary } from "../delivery/types.ts";

interface RecentVenuesValue {
  venues: VenueSummary[];
  remember: (venue: VenueSummary) => void;
}

const RecentVenuesContext = createContext<RecentVenuesValue | null>(null);

/** Venues the visitor has opened, persisted on the device (design.md §8). */
export function RecentVenuesProvider({ children }: { children: ReactNode }) {
  const [venues, setVenues] = useState<VenueSummary[]>(() => listRecentVenues());
  const remember = useCallback((venue: VenueSummary) => {
    rememberVenue(venue, new Date().toISOString());
    setVenues(listRecentVenues());
  }, []);
  const value = useMemo(() => ({ venues, remember }), [venues, remember]);
  return <RecentVenuesContext.Provider value={value}>{children}</RecentVenuesContext.Provider>;
}

export function useRecentVenues(): RecentVenuesValue {
  const value = useContext(RecentVenuesContext);
  if (!value) throw new Error("useRecentVenues must be used inside RecentVenuesProvider");
  return value;
}
