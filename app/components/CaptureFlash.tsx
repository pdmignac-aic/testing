"use client";
import { useEffect, useRef } from "react";

export const FLASH_EVENT = "caught:flash";

export function triggerFlash() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(FLASH_EVENT));
}

export default function CaptureFlash() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const handler = () => {
      el.classList.remove("flash-on");
      // force reflow to restart animation
      void el.offsetWidth;
      el.classList.add("flash-on");
    };
    window.addEventListener(FLASH_EVENT, handler);
    return () => window.removeEventListener(FLASH_EVENT, handler);
  }, []);
  return <div ref={ref} className="flash-overlay" aria-hidden />;
}
