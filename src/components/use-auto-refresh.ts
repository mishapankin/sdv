"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

const AUTO_REFRESH_STORAGE_KEY = "sdv-auto-refresh";
let inMemoryAutoRefreshSetting = true;

type ConnectionStatus = "connecting" | "connected" | "disconnected";

function subscribeToAutoRefreshSetting(listener: () => void) {
  window.addEventListener("storage", listener);
  window.addEventListener("sdv-auto-refresh-change", listener);
  return () => {
    window.removeEventListener("storage", listener);
    window.removeEventListener("sdv-auto-refresh-change", listener);
  };
}

function getAutoRefreshSetting() {
  try {
    const storedValue = localStorage.getItem(AUTO_REFRESH_STORAGE_KEY);
    return storedValue === null
      ? inMemoryAutoRefreshSetting
      : storedValue !== "off";
  } catch {
    return inMemoryAutoRefreshSetting;
  }
}

function getServerAutoRefreshSetting() {
  return true;
}

export function useAutoRefresh({
  repoId,
  refresh,
}: {
  repoId?: string;
  refresh: () => Promise<boolean>;
}) {
  const enabled = useSyncExternalStore(
    subscribeToAutoRefreshSetting,
    getAutoRefreshSetting,
    getServerAutoRefreshSetting,
  );
  const [detectedState, setDetectedState] = useState({
    repoId: undefined as string | undefined,
    detected: false,
  });
  const [connectionState, setConnectionState] = useState({
    repoId: undefined as string | undefined,
    status: "connecting" as ConnectionStatus,
  });
  const enabledRef = useRef(enabled);
  const repoIdRef = useRef(repoId);
  const refreshRef = useRef(refresh);
  const refreshingRef = useRef(false);
  const refreshQueuedRef = useRef(false);
  const openedOnceRef = useRef(false);

  const changeDetected =
    detectedState.repoId === repoId && detectedState.detected;
  const connectionStatus: ConnectionStatus = !repoId
    ? "disconnected"
    : connectionState.repoId === repoId
      ? connectionState.status
      : "connecting";

  useEffect(() => {
    refreshRef.current = refresh;
  });

  useEffect(() => {
    enabledRef.current = enabled;
    repoIdRef.current = repoId;
  }, [enabled, repoId]);

  const requestRefresh = useCallback(async () => {
    if (refreshingRef.current) {
      refreshQueuedRef.current = true;
      return;
    }

    refreshingRef.current = true;

    try {
      do {
        refreshQueuedRef.current = false;
        const refreshed = await refreshRef.current();
        if (refreshed) {
          setDetectedState({
            repoId: repoIdRef.current,
            detected: false,
          });
        }
      } while (refreshQueuedRef.current);
    } finally {
      refreshingRef.current = false;
    }
  }, []);

  const setEnabled = useCallback(
    (nextEnabled: boolean) => {
      enabledRef.current = nextEnabled;
      inMemoryAutoRefreshSetting = nextEnabled;

      try {
        localStorage.setItem(
          AUTO_REFRESH_STORAGE_KEY,
          nextEnabled ? "on" : "off",
        );
      } catch {
        // The setting remains valid for the current session.
      }
      window.dispatchEvent(new Event("sdv-auto-refresh-change"));

      if (nextEnabled && changeDetected) {
        void requestRefresh();
      }
    },
    [changeDetected, requestRefresh],
  );

  useEffect(() => {
    openedOnceRef.current = false;

    if (!repoId) {
      return;
    }

    const params = new URLSearchParams({ repoId });
    const events = new EventSource(`/api/repository-events?${params}`);

    events.addEventListener("open", () => {
      setConnectionState({ repoId, status: "connected" });

      if (openedOnceRef.current && enabledRef.current) {
        void requestRefresh();
      }

      openedOnceRef.current = true;
    });
    events.addEventListener("message", () => {
      setConnectionState({ repoId, status: "connected" });
      setDetectedState({ repoId, detected: true });
      if (enabledRef.current) void requestRefresh();
    });
    events.addEventListener("watcher-error", () => {
      setConnectionState({ repoId, status: "disconnected" });
    });
    events.addEventListener("error", () => {
      setConnectionState({ repoId, status: "disconnected" });
    });

    return () => events.close();
  }, [repoId, requestRefresh]);

  useEffect(() => {
    function handleVisibilityChange() {
      if (
        document.visibilityState === "visible" &&
        enabledRef.current &&
        changeDetected
      ) {
        void requestRefresh();
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () =>
      document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [changeDetected, requestRefresh]);

  return {
    enabled,
    setEnabled,
    changeDetected,
    connectionStatus,
    refreshNow: requestRefresh,
  };
}
