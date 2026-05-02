export type Camera = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  area?: string;
  isOnline?: boolean;
};

export type Capture = {
  id: string;
  capturedAt: number;
  camId: string;
  camName: string;
  lat: number;
  lng: number;
  width?: number;
  height?: number;
  source: "auto" | "manual" | "demo";
};
