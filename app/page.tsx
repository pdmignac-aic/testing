"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import HeaderBar from "./components/HeaderBar";
import Controls from "./components/Controls";
import MapView from "./components/MapView";
import RollGrid from "./components/RollGrid";
import MontageView from "./components/MontageView";
import CaptureBanner, { type BurstState } from "./components/CaptureBanner";
import CaptureFlash, { triggerFlash } from "./components/CaptureFlash";
import type { Camera, Capture } from "./lib/types";
import { loadCameras } from "./lib/cameras";
import { nearbyCameras, nearestCamera } from "./lib/geo";
import { captureFromCam } from "./lib/capture";
import { loadRoll } from "./lib/store";
import { armAudio, playShutter } from "./lib/sound";

type Mode = "map" | "roll" | "montage";

const PROXIMITY_M = 75;
const POLL_MS = 30_000;
const BURST_COUNT = 5;
const BURST_INTERVAL_MS = 1100;
const WARMUP_MS = 1500;
const PER_CAM_COOLDOWN_MS = 180_000;
const MIDTOWN_BBOX = {
  minLat: 40.74,
  maxLat: 40.78,
  minLng: -74.005,
  maxLng: -73.965,
};

type Toast = { id: number; text: string; sub?: string };

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

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
  const [burst, setBurst] = useState<BurstState | null>(null);

  const lastBurstAtRef = useRef<Map<string, number>>(new Map());
  const burstingRef = useRef<Set<string>>(new Set());
  const watchIdRef = useRef<number | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load roll on mount
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
    }, 2600);
  }, []);

  const runBurst = useCallback(
    async (cam: Camera, source: Capture["source"] = "auto") => {
      if (burstingRef.current.has(cam.id)) return;
      const now = Date.now();
      const last = lastBurstAtRef.current.get(cam.id) ?? 0;
      if (now - last < PER_CAM_COOLDOWN_MS) return;
      burstingRef.current.add(cam.id);
      lastBurstAtRef.current.set(cam.id, now);

      try {
        // Warmup banner — heads-up before first shot
        setBurst({
          camId: cam.id,
          camName: cam.name,
          total: BURST_COUNT,
          shotsTaken: 0,
          phase: "warmup",
        });
        await sleep(WARMUP_MS);

        setBurst((b) =>
          b && b.camId === cam.id ? { ...b, phase: "shooting" } : b
        );

        for (let i = 0; i < BURST_COUNT; i++) {
          try {
            const cap = await captureFromCam(cam, source);
            playShutter();
            triggerFlash();
            setRoll((r) =>
              [...r, cap].sort((a, b) => a.capturedAt - b.capturedAt)
            );
            setBurst((b) =>
              b && b.camId === cam.id ? { ...b, shotsTaken: i + 1 } : b
            );
          } catch (e: any) {
            pushToast("MISS", e?.message ?? "fetch failed");
          }
          if (i < BURST_COUNT - 1) await sleep(BURST_INTERVAL_MS);
        }

        setBurst((b) =>
          b && b.camId === cam.id ? { ...b, phase: "done" } : b
        );
        await sleep(900);
        setBurst((b) => (b && b.camId === cam.id ? null : b));
      } finally {
        burstingRef.current.delete(cam.id);
      }
    },
    [pushToast]
  );

  // Geolocation watcher
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
      pushToast("GEO", err.message);
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

  const nearby = useMemo(() => {
    if (!position || cams.length === 0) return [];
    return nearbyCameras(cams, position.lat, position.lng, PROXIMITY_M);
  }, [cams, position]);

  const nearbyIds = useMemo(
    () => new Set(nearby.map((n) => n.cam.id)),
    [nearby]
  );

  const burstingIds = useMemo(() => {
    return new Set(burst ? [burst.camId] : []);
  }, [burst]);

  // Trigger bursts for cams in range
  useEffect(() => {
    if (!catching || nearby.length === 0) return;
    for (const { cam } of nearby) {
      if (burstingRef.current.has(cam.id)) continue;
      const last = lastBurstAtRef.current.get(cam.id) ?? 0;
      if (Date.now() - last < PER_CAM_COOLDOWN_MS) continue;
      runBurst(cam, "auto");
    }
  }, [catching, nearby, runBurst]);

  const onToggle = useCallback(() => {
    setCatching((c) => {
      const next = !c;
      if (next) {
        armAudio(); // unlock iOS audio inside the user gesture
        pushToast("CATCHING", "keep this tab visible");
      } else {
        pushToast("STOPPED");
      }
      return next;
    });
  }, [pushToast]);

  const onCatchNow = useCallback(async () => {
    if (cams.length === 0) {
      pushToast("NO CAMS", "still loading");
      return;
    }
    armAudio();
    setBusy(true);
    try {
      let target: Camera | null = null;
      if (position) {
        const n = nearestCamera(cams, position.lat, position.lng);
        if (n) target = n.cam;
      }
      if (!target) {
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
      // Reset cooldown so manual taps always work
      lastBurstAtRef.current.delete(target.id);
      await runBurst(target, "manual");
    } finally {
      setBusy(false);
    }
  }, [cams, position, runBurst, pushToast]);

  const loadDemoRoll = useCallback(async () => {
    if (cams.length === 0) {
      pushToast("NO CAMS", "still loading");
      return;
    }
    armAudio();
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
        const cap = await captureFromCam(cam, "demo");
        setRoll((r) =>
          [...r, cap].sort((a, b) => a.capturedAt - b.capturedAt)
        );
        playShutter();
        triggerFlash();
        await sleep(220);
      } catch {
        /* swallow */
      }
    }
    pushToast("DEMO READY", "open Montage");
  }, [cams, pushToast]);

  const catchNowLabel = busy ? "CATCHING…" : "CATCH NOW";

  return (
    <main className="fixed inset-0 bg-cream overflow-hidden">
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
                  <p className="text-coral text-xs uppercase tracking-widest mb-2">
                    Cam list failed
                  </p>
                  <p className="text-ash text-[11px]">{camsError}</p>
                </div>
              </div>
            ) : (
              <MapView
                cameras={cams}
                position={position}
                nearbyIds={nearbyIds}
                burstingIds={burstingIds}
              />
            )}
          </div>
        )}
        {mode === "roll" && <RollGrid roll={roll} onChange={setRoll} />}
        {mode === "montage" && <MontageView roll={roll} />}
      </div>

      <CaptureBanner burst={burst} />

      <Controls
        catching={catching}
        onToggle={onToggle}
        onCatchNow={onCatchNow}
        catchNowDisabled={busy || cams.length === 0}
        catchNowLabel={catchNowLabel}
        accuracyM={position?.accuracy ?? null}
        nearbyCount={nearby.length}
        rollCount={roll.length}
        hasPosition={!!position}
      />

      <div className="fixed bottom-32 left-0 right-0 z-50 flex flex-col items-center gap-1 px-4 pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className="toast-enter bg-ink/90 text-chalk border border-cobalt/40 px-3 py-2 text-[10px] uppercase tracking-widest rounded-md backdrop-blur"
          >
            <span className="text-coral mr-2">●</span>
            {t.text}
            {t.sub ? (
              <span className="text-chalk/70 ml-2">— {t.sub}</span>
            ) : null}
          </div>
        ))}
      </div>

      <CaptureFlash />
    </main>
  );
}
