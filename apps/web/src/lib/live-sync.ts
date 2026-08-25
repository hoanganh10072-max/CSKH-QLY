"use client";

import { useEffect, useMemo, useRef } from "react";

export type DataSyncArea = "all" | "customers" | "imports" | "interactions" | "users" | "tasks" | "dashboard";

type DataSyncPayload = {
  area?: DataSyncArea;
  source?: string;
  at: number;
};

type LiveRefreshOptions = {
  enabled?: boolean;
  intervalMs?: number;
  areas?: DataSyncArea[];
  refreshOnFocus?: boolean;
};

const DATA_SYNC_EVENT = "mscilabs-data-sync";
const DATA_SYNC_STORAGE_KEY = "mscilabs:data-sync";
const DATA_SYNC_CHANNEL = "mscilabs-data-sync";

const shouldHandleArea = (payload: DataSyncPayload | null, areas: DataSyncArea[]) => {
  if (!areas.length || areas.includes("all")) return true;
  if (!payload?.area || payload.area === "all") return true;
  return areas.includes(payload.area);
};

const notifyChannel = (payload: DataSyncPayload) => {
  if (typeof BroadcastChannel === "undefined") return;
  const channel = new BroadcastChannel(DATA_SYNC_CHANNEL);
  channel.postMessage(payload);
  channel.close();
};

export const notifyDataChanged = (payload: Omit<DataSyncPayload, "at"> = {}) => {
  if (typeof window === "undefined") return;

  const nextPayload: DataSyncPayload = {
    area: payload.area || "all",
    source: payload.source,
    at: Date.now()
  };

  window.dispatchEvent(new CustomEvent<DataSyncPayload>(DATA_SYNC_EVENT, { detail: nextPayload }));
  notifyChannel(nextPayload);

  try {
    window.localStorage.setItem(DATA_SYNC_STORAGE_KEY, JSON.stringify(nextPayload));
  } catch {
    // Không chặn luồng thao tác nếu trình duyệt không cho ghi localStorage.
  }
};

export const useLiveRefresh = (refresh: () => void | Promise<void>, options: LiveRefreshOptions = {}) => {
  const {
    enabled = true,
    intervalMs = 0,
    areas = [],
    refreshOnFocus = false
  } = options;
  const refreshRef = useRef(refresh);
  const inFlightRef = useRef(false);
  const areasKey = useMemo(() => areas.join("|"), [areas]);

  refreshRef.current = refresh;

  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;

    const activeAreas = areasKey ? (areasKey.split("|") as DataSyncArea[]) : [];

    const run = () => {
      if (inFlightRef.current) return;
      inFlightRef.current = true;
      Promise.resolve(refreshRef.current()).finally(() => {
        inFlightRef.current = false;
      });
    };

    const handlePayload = (payload: DataSyncPayload | null) => {
      if (shouldHandleArea(payload, activeAreas)) run();
    };

    const handleCustomEvent = (event: Event) => {
      handlePayload((event as CustomEvent<DataSyncPayload>).detail || null);
    };

    const handleStorage = (event: StorageEvent) => {
      if (event.key !== DATA_SYNC_STORAGE_KEY || !event.newValue) return;
      try {
        handlePayload(JSON.parse(event.newValue) as DataSyncPayload);
      } catch {
        handlePayload(null);
      }
    };

    const handleFocus = () => {
      if (refreshOnFocus) run();
    };

    window.addEventListener(DATA_SYNC_EVENT, handleCustomEvent);
    window.addEventListener("storage", handleStorage);
    window.addEventListener("focus", handleFocus);

    let channel: BroadcastChannel | null = null;
    if (typeof BroadcastChannel !== "undefined") {
      channel = new BroadcastChannel(DATA_SYNC_CHANNEL);
      channel.onmessage = (event) => handlePayload(event.data as DataSyncPayload);
    }

    return () => {
      window.removeEventListener(DATA_SYNC_EVENT, handleCustomEvent);
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("focus", handleFocus);
      channel?.close();
    };
  }, [enabled, intervalMs, areasKey, refreshOnFocus]);
};

