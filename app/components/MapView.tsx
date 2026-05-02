"use client";
import dynamic from "next/dynamic";
import type { Camera } from "@/app/lib/types";

const MapInner = dynamic(() => import("./MapInner"), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full grid place-items-center text-smoke text-xs">
      LOADING MAP…
    </div>
  ),
});

type Props = {
  cameras: Camera[];
  position: { lat: number; lng: number; accuracy?: number } | null;
  nearbyIds: Set<string>;
};

export default function MapView(props: Props) {
  return <MapInner {...props} />;
}
