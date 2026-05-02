"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import HeaderBar from "./components/HeaderBar";
import Controls from "./components/Controls";
import MapView from "./components/MapView";
import RollGrid from "./components/RollGrid";
import MontageView from "./components/MontageView";
import type { Camera, Capture } from "./lib/types";
import { loadCameras } from "./lib/cameras";
import { nearbyCameras, nearestCamera } from "./lib/geo";
import { captureFromCam } from "./lib/capture";
import { loadRoll } from "./lib/store";

type Mode = "map" | "roll" | "montage";

const PROXIMITY_M = 75;
const PER_CAM_COOLDOWN_MS = 90_000;
const POLL_MS = 30_000;
const MIDTOWN_BBOX = {
  minLat: 40.74,
  maxLat: 40.78,
  minLng: -74.005,
  maxLng: -73.965,
};

type Toast = { id: number; text: string; sub?: string };

export default function Page() {
  const [cams, setCams] = useState<Camera[]>([]);
  const [camsError, setCamsError] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>("map");
  const [catching, setCatching] = useState(false);
  const [position, setPosition] =
    useState<{ lat: number; lng: number; accuracy?: number } | null>(null);
  const [roll, setRoll] = useState<Capture[]>([]);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [busy, setBusy] = useState(false);
  const lastCamCaptureRef = useRef<Map<string, number>>(new Map());
  const watchIdRef = useRef<number | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load roll from storage on mount
  useEffect(() => {
    setRoll(loadRoll());
  }, []);

  // Load cameras
  useEffect(() => {
    let alive = true;
    loadCameras()
      .then((data) => {
        if (alive) setCams(data);
      })
      .catch((e) => {
        if (alive) setCamsError(String(e?.message ?? e));
      });
    return () => {
      alive = false;
    };
  }, []);

  const pushToast = useCallback((text: string, sub?: string) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, text, sub }]);
    setTimeout(() => {
      setToasts((t) => t.filter((x) => x.id !== id));
    }, 3000);
  }, []);

  const handleCapture = useCallback(
    async (cam: Camera, source: Capture["source"]) => {
      try {
        const cap = await captureFromCam(cam, source);
        lastCamCaptureRef.current.set(cam.id, Date.now());
        setRoll((r) => {
          const next = [...r, cap].sort(
            (a, b) => a.capturedAt - b.capturedAt
          );
          return next;
        });
        pushToast("CAUGHT", cam.name);
      } catch (e: any) {
        pushToast("MISS", e?.message ?? "fetch failed");
      }
    },
    [pushToast]
  );

  // Geolocation: track position when catching
  useEffect(() => {
    if (!catching) {
      if (watchIdRef.current != null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }
    if (!("geolocation" in navigator)) {
      pushToast("NO GEO", "geolocation unavailable");
      setCatching(false);
      return;
    }
    const onPos = (p: GeolocationPosition) => {
      setPosition({
        lat: p.coords.latitude,
        lng: p.coords.longitude,
        accuracy: p.coords.accuracy,
      });
    };
    const onErr = (err: GeolocationPositionError) => {
      pushToast("GEO ERR", err.message);
    };
    watchIdRef.current = navigator.geolocation.watchPosition(onPos, onErr, {
      enableHighAccuracy: true,
      maximumAge: 5000,
      timeout: 20000,
    });
    intervalRef.current = setInterval(() => {
      navigator.geolocation.getCurrentPosition(onPos, onErr, {
        enableHighAccuracy: true,
        maximumAge: 5000,
        timeout: 20000,
      });
    }, POLL_MS);
    return () => {
      if (watchIdRef.current != null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [catching, pushToast]);

  // Capture loop: react to position + cams
  const nearby = useMemo(() => {
    if (!position || cams.length === 0) return [];
    return nearbyCameras(cams, position.lat, position.lng, PROXIMITY_M);
  }, [cams, position]);

  const nearbyIds = useMemo(
    () => new Set(nearby.map((n) => n.cam.id)),
    [nearby]
  );

  useEffect(() => {
    if (!catching || nearby.length === 0) return;
    const now = Date.now();
    for (const { cam } of nearby) {
      const last = lastCamCaptureRef.current.get(cam.id) ?? 0;
      if (now - last < PER_CAM_COOLDOWN_MS) continue;
      lastCamCaptureRef.current.set(cam.id, now); // optimistic
      handleCapture(cam, "auto");
    }
  }, [catching, nearby, handleCapture]);

  const onToggle = useCallback(() => {
    setCatching((c) => {
      const next = !c;
      if (next) pushToast("STARTED", "keep this tab visible");
      else pushToast("STOPPED");
      return next;
    });
  }, [pushToast]);

  const onCatchNow = useCallback(async () => {
    if (cams.length === 0) {
      pushToast("NO CAMS", "still loading");
      return;
    }
    setBusy(true);
    try {
      let target: Camera | null = null;
      if (position) {
        const n = nearestCamera(cams, position.lat, position.lng);
        if (n) target = n.cam;
      }
      if (!target) {
        // fallback: random midtown cam
        const pool = cams.filter(
          (c) =>
            c.latitude >= MIDTOWN_BBOX.minLat &&
            c.latitude <= MIDTOWN_BBOX.maxLat &&
            c.longitude >= MIDTOWN_BBOX.minLng &&
            c.longitude <= MIDTOWN_BBOX.maxLng
        );
        const fromPool = pool.length ? pool : cams;
        target = fromPool[Math.floor(Math.random() * fromPool.length)];
      }
      await handleCapture(target, "manual");
    } finally {
      setBusy(false);
    }
  }, [cams, position, handleCapture, pushToast]);

  const loadDemoRoll = useCallback(async () => {
    if (cams.length === 0) {
      pushToast("NO CAMS", "still loading");
      return;
    }
    pushToast("DEMO", "seeding 12 frames");
    const pool = cams.filter(
      (c) =>
        c.latitude >= MIDTOWN_BBOX.minLat &&
        c.latitude <= MIDTOWN_BBOX.maxLat &&
        c.longitude >= MIDTOWN_BBOX.minLng &&
        c.longitude <= MIDTOWN_BBOX.maxLng
    );
    const source = pool.length >= 12 ? pool : cams;
    const shuffled = source.slice().sort(() => Math.random() - 0.5);
    const picks = shuffled.slice(0, 12);
    for (const cam of picks) {
      try {
        await captureFromCam(cam, "demo");
        // stagger the captured timestamps so they look like a walk
        // (capturedAt is set to Date.now in the lib; that's fine for demo)
        await new Promise((r) => setTimeout(r, 250));
      } catch {
        /* swallow per-cam */
      }
    }
    setRoll(loadRoll());
    pushToast("DEMO READY", "open Montage");
  }, [cams, pushToast]);

  const catchNowLabel = busy ? "CATCHING…" : "CATCH NOW";

  return (
    <main className="fixed inset-0 bg-ink overflow-hidden">
      <HeaderBar
        mode={mode}
        setMode={setMode}
        catching={catching}
        nearbyCount={nearby.length}
        rollCount={roll.length}
        onLogoLongPress={loadDemoRoll}
      />

      <div className="absolute inset-0 pt-[88px]">
        {mode === "map" && (
          <div className="h-full w-full">
            {camsError ? (
              <div className="h-full grid place-items-center text-center px-8">
                <div>
                  <p className="text-blood text-xs uppercase mb-2">
                    Cam list failed
                  </p>
                  <p className="text-smoke text-[11px]">{camsError}</p>
                </div>
              </div>
            ) : (
              <MapView
                cameras={cams}
                position={position}
                nearbyIds={nearbyIds}
              />
            )}
          </div>
        )}
        {mode === "roll" && (
          <RollGrid roll={roll} onChange={setRoll} />
        )}
        {mode === "montage" && <MontageView roll={roll} />}
      </div>

      <Controls
        catching={catching}
        onToggle={onToggle}
        onCatchNow={onCatchNow}
        catchNowDisabled={busy || cams.length === 0}
        catchNowLabel={catchNowLabel}
      />

      <div className="fixed bottom-24 left-0 right-0 z-50 flex flex-col items-center gap-1 px-4 pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className="bg-black/90 border border-neutral-800 px-3 py-2 text-[10px] uppercase tracking-widest text-bone"
          >
            <span className="text-blood mr-2">●</span>
            {t.text}
            {t.sub ? <span className="text-smoke ml-2">— {t.sub}</span> : null}
          </div>
        ))}
      </div>
    </main>
  );
}
