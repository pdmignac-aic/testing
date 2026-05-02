"use client";
import {
  MapContainer,
  TileLayer,
  CircleMarker,
  Marker,
  Tooltip,
  Circle,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useEffect, useMemo, useRef } from "react";
import type { Camera } from "@/app/lib/types";

const NYC_CENTER: [number, number] = [40.7549, -73.984];
const PROX_M = 75;

const userIcon = L.divIcon({
  className: "user-dot-icon",
  html: '<div class="user-dot"><div class="user-dot__ring"></div><div class="user-dot__core"></div></div>',
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

type Props = {
  cameras: Camera[];
  position: { lat: number; lng: number; accuracy?: number } | null;
  nearbyIds: Set<string>;
  burstingIds: Set<string>;
};

function Recenter({
  position,
}: {
  position: { lat: number; lng: number } | null;
}) {
  const map = useMap();
  const lastRef = useRef<string | null>(null);
  useEffect(() => {
    if (!position) return;
    const key = `${position.lat.toFixed(5)},${position.lng.toFixed(5)}`;
    if (lastRef.current === key) return;
    if (lastRef.current === null) {
      map.setView([position.lat, position.lng], 16, { animate: true });
    } else {
      map.panTo([position.lat, position.lng], { animate: true });
    }
    lastRef.current = key;
  }, [map, position]);
  return null;
}

export default function MapInner({
  cameras,
  position,
  nearbyIds,
  burstingIds,
}: Props) {
  const center: [number, number] = position
    ? [position.lat, position.lng]
    : NYC_CENTER;

  const dots = useMemo(() => cameras, [cameras]);

  return (
    <MapContainer
      center={center}
      zoom={position ? 16 : 13}
      preferCanvas
      zoomControl={false}
      scrollWheelZoom
      style={{ height: "100%", width: "100%" }}
      attributionControl={true}
    >
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
        subdomains={["a", "b", "c", "d"]}
        maxZoom={19}
      />

      {/* 75m proximity ring around the user */}
      {position && (
        <Circle
          center={[position.lat, position.lng]}
          radius={PROX_M}
          pathOptions={{
            color: "#1d3fb3",
            weight: 1.25,
            opacity: 0.5,
            fillColor: "#1d3fb3",
            fillOpacity: 0.07,
            interactive: false,
          }}
        />
      )}

      {dots.map((cam) => {
        const hot = nearbyIds.has(cam.id);
        const burst = burstingIds.has(cam.id);
        const fill = burst ? "#ff4d4d" : hot ? "#3458d4" : "#1d3fb3";
        const radius = burst ? 10 : hot ? 8 : 5;
        return (
          <CircleMarker
            key={cam.id}
            center={[cam.latitude, cam.longitude]}
            radius={radius}
            pathOptions={{
              color: "#0c1f6b",
              fillColor: fill,
              fillOpacity: hot || burst ? 0.95 : 0.85,
              weight: burst ? 2.5 : hot ? 2 : 1,
              opacity: 1,
            }}
          >
            <Tooltip
              direction="top"
              offset={[0, -6]}
              opacity={1}
              sticky
              className="caught-tooltip"
            >
              <span style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 11 }}>
                {cam.name}
              </span>
            </Tooltip>
          </CircleMarker>
        );
      })}

      {position && (
        <Marker
          position={[position.lat, position.lng]}
          icon={userIcon}
          interactive={false}
        />
      )}

      <Recenter position={position} />
    </MapContainer>
  );
}
