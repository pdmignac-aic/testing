"use client";
import { MapContainer, TileLayer, CircleMarker, Marker, Tooltip } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useMemo } from "react";
import type { Camera } from "@/app/lib/types";

const NYC_CENTER: [number, number] = [40.7549, -73.984];

const userIcon = L.divIcon({
  className: "user-dot-icon",
  html: '<div class="user-dot"><div class="user-dot__ring"></div><div class="user-dot__core"></div></div>',
  iconSize: [16, 16],
  iconAnchor: [8, 8],
});

type Props = {
  cameras: Camera[];
  position: { lat: number; lng: number; accuracy?: number } | null;
  nearbyIds: Set<string>;
};

export default function MapInner({ cameras, position, nearbyIds }: Props) {
  const center: [number, number] = position
    ? [position.lat, position.lng]
    : NYC_CENTER;

  const dots = useMemo(() => cameras, [cameras]);

  return (
    <MapContainer
      center={center}
      zoom={14}
      preferCanvas
      zoomControl={false}
      scrollWheelZoom
      style={{ height: "100%", width: "100%" }}
      attributionControl={true}
    >
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
        subdomains={["a", "b", "c", "d"]}
        maxZoom={19}
      />
      {dots.map((cam) => {
        const hot = nearbyIds.has(cam.id);
        return (
          <CircleMarker
            key={cam.id}
            center={[cam.latitude, cam.longitude]}
            radius={hot ? 6 : 2.5}
            pathOptions={{
              color: hot ? "#ff2e2e" : "#ededed",
              fillColor: hot ? "#ff2e2e" : "#ededed",
              fillOpacity: hot ? 0.9 : 0.45,
              weight: hot ? 2 : 0,
            }}
          >
            <Tooltip direction="top" offset={[0, -4]} opacity={0.9} sticky>
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
    </MapContainer>
  );
}
