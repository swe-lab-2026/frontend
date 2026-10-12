"use client";

import { createContext, useContext } from "react";
import type { Event } from "@/lib/api/types";

type EventContextValue = {
  event: Event;
  setEvent: (event: Event) => void;
  /** Bumped after any change that affects inventory or readiness. */
  version: number;
  invalidate: () => void;
};

export const EventContext = createContext<EventContextValue | null>(null);

export function useEventContext(): EventContextValue {
  const context = useContext(EventContext);
  if (!context) throw new Error("useEventContext must be used inside the event layout");
  return context;
}
