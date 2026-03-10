"use client";

import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { GoogleMap, useJsApiLoader, Marker, InfoWindow, DirectionsRenderer } from "@react-google-maps/api";
import { wsService } from "../lib/websocket-service";

// â”€â”€â”€ Types â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ //
interface DriverState {
  id: string;
  name: string;
  taskId?: string | null;
  lat: number;        // current interpolated position
  lng: number;
  prevLat: number;    // animation start
  prevLng: number;
  targetLat: number;  // animation end
  targetLng: number;
  animStart: number;  // performance.now() when animation began
  heading: number;    // 0-359Â°, clockwise from north
  speed: number;
  lastSeen: string;
}

interface MapProps {
    tasks: any[];
    volunteers: any[];
    ngos: any[];
    donors: any[];
}

// â”€â”€â”€ Constants â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ //
const ANIM_DURATION_MS = 5000; // matches GPS ping interval
const DEFAULT_CENTER = { lat: 12.9716, lng: 77.5946 };

// Must be defined outside component so useJsApiLoader doesn't reload on re-render
const LIBRARIES: ("places" | "geometry")[] = ["places", "geometry"];

const containerStyle = {
    width: "100%",
    height: "100%",
};

// â”€â”€â”€ Utility: compute compass bearing between two points â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ //
function computeBearing(from: { lat: number; lng: number }, to: { lat: number; lng: number }): number {
    const R = Math.PI / 180;
    const lat1 = from.lat * R;
    const lat2 = to.lat * R;
    const dLng = (to.lng - from.lng) * R;
    const y = Math.sin(dLng) * Math.cos(lat2);
    const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
    return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

// â”€â”€â”€ SVG marker factories â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€  //
function makeTruckIcon(heading: number, active: boolean): google.maps.Icon {
    const fill = active ? "#4ade80" : "#fb923c";
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="52" height="52" viewBox="0 0 52 52">
      <circle cx="26" cy="26" r="23" fill="${fill}" stroke="#0f172a" stroke-width="2.5"/>
      <g transform="translate(26,26) rotate(${heading}) translate(-26,-26)">
        <text x="26" y="34" text-anchor="middle" font-size="24" font-family="serif">🚚</text>
      </g>
    </svg>`;
    return {
        url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
        scaledSize: new google.maps.Size(52, 52),
        anchor: new google.maps.Point(26, 26),
    };
}

function makePinIcon(emoji: string, fill: string): google.maps.Icon {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40">
      <circle cx="20" cy="20" r="18" fill="${fill}" stroke="#0f172a" stroke-width="2"/>
      <text x="20" y="27" text-anchor="middle" font-size="18" font-family="serif">${emoji}</text>
    </svg>`;
    return {
        url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
        scaledSize: new google.maps.Size(40, 40),
        anchor: new google.maps.Point(20, 20),
    };
}

// â”€â”€â”€ Dark map styles (kept from original) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ //
const DARK_STYLES: google.maps.MapTypeStyle[] = [
    { elementType: "geometry", stylers: [{ color: "#242f3e" }] },
    { elementType: "labels.text.stroke", stylers: [{ color: "#242f3e" }] },
    { elementType: "labels.text.fill", stylers: [{ color: "#746855" }] },
    { featureType: "administrative.locality", elementType: "labels.text.fill", stylers: [{ color: "#d59563" }] },
    { featureType: "poi", elementType: "labels.text.fill", stylers: [{ color: "#d59563" }] },
    { featureType: "poi.park", elementType: "geometry", stylers: [{ color: "#263c3f" }] },
    { featureType: "poi.park", elementType: "labels.text.fill", stylers: [{ color: "#6b9a76" }] },
    { featureType: "road", elementType: "geometry", stylers: [{ color: "#38414e" }] },
    { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#212a37" }] },
    { featureType: "road", elementType: "labels.text.fill", stylers: [{ color: "#9ca5b3" }] },
    { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#746855" }] },
    { featureType: "road.highway", elementType: "geometry.stroke", stylers: [{ color: "#1f2835" }] },
    { featureType: "road.highway", elementType: "labels.text.fill", stylers: [{ color: "#f3d19c" }] },
    { featureType: "transit", elementType: "geometry", stylers: [{ color: "#2f3948" }] },
    { featureType: "transit.station", elementType: "labels.text.fill", stylers: [{ color: "#d59563" }] },
    { featureType: "water", elementType: "geometry", stylers: [{ color: "#17263c" }] },
    { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#515c6d" }] },
    { featureType: "water", elementType: "labels.text.stroke", stylers: [{ color: "#17263c" }] },
];

export default function DispatcherMap({ tasks, volunteers, ngos, donors }: MapProps) {
    const { isLoaded, loadError } = useJsApiLoader({
        id: "google-map-script",
        googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "",
        libraries: LIBRARIES,
    });

    // â”€â”€ Map instance â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ //
    const [map, setMap] = useState<google.maps.Map | null>(null);
    const onLoad = useCallback((m: google.maps.Map) => setMap(m), []);
    const onUnmount = useCallback(() => setMap(null), []);

    // â”€â”€ Static marker selection â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ //
    const [selectedMarker, setSelectedMarker] = useState<{ type: string; data: any } | null>(null);

    // â”€â”€ Driver tracking â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ //
    const driversRef = useRef<Map<string, DriverState>>(new Map());
    const [driverList, setDriverList] = useState<DriverState[]>([]);
    const rafIdRef = useRef<number>(0);
    // Imperative google.maps.Marker instances for drivers (avoids React rerender per frame)
    const driverMarkersRef = useRef<Map<string, google.maps.Marker>>(new Map());

    // â”€â”€ Route state â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ //
    const [trackTask, setTrackTask] = useState<any | null>(null);
    const [directions, setDirections] = useState<google.maps.DirectionsResult | null>(null);
    const [routeInfo, setRouteInfo] = useState<{ distance: string; duration: string } | null>(null);
    const lastFetchedRef = useRef<string>("");

    // â”€â”€ Active tasks â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ //
    const activeTasks = useMemo(
        () => tasks.filter((t) => ["PENDING", "ASSIGNED", "IN_TRANSIT", "PICKED_UP"].includes(t.status)),
        [tasks],
    );

    // â”€â”€ Subscribe to volunteer_location Socket.IO events â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ //
    useEffect(() => {
        const token = typeof window !== "undefined" ? localStorage.getItem("auth_token") : null;
        if (token) wsService.connect(token);

        const unsub = wsService.subscribe("volunteer_location", (msg) => {
            const { volunteer_id, task_id, location } = msg.payload as {
                volunteer_id: string;
                task_id?: string;
                location: { lat: number; lng: number; heading?: number; speed?: number };
            };
            if (!volunteer_id || !location?.lat) return;

            const prev = driversRef.current.get(volunteer_id);
            const volMeta = volunteers.find((v: any) => v.id === volunteer_id);
            const now = performance.now();

            const bearing = prev
                ? computeBearing({ lat: prev.targetLat, lng: prev.targetLng }, location)
                : 0;

            const driver: DriverState = {
                id: volunteer_id,
                name: volMeta?.name ?? `Driver ${volunteer_id.slice(0, 6)}`,
                taskId: task_id ?? null,
                lat: prev?.lat ?? location.lat,
                lng: prev?.lng ?? location.lng,
                prevLat: prev?.lat ?? location.lat,
                prevLng: prev?.lng ?? location.lng,
                targetLat: location.lat,
                targetLng: location.lng,
                animStart: now,
                heading: location.heading ?? bearing,
                speed: location.speed ?? 0,
                lastSeen: msg.payload.timestamp ?? new Date().toISOString(),
            };
            driversRef.current.set(volunteer_id, driver);
        });

        return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [volunteers]);

    // â”€â”€ requestAnimationFrame smooth interpolation loop â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ //
    useEffect(() => {
        const tick = (now: number) => {
            // Skip when no drivers active (saves CPU/battery on mobile)
            if (driversRef.current.size === 0) {
                rafIdRef.current = requestAnimationFrame(tick);
                return;
            }
            let dirty = false;
            driversRef.current.forEach((d) => {
                const t = Math.min((now - d.animStart) / ANIM_DURATION_MS, 1);
                const newLat = d.prevLat + (d.targetLat - d.prevLat) * t;
                const newLng = d.prevLng + (d.targetLng - d.prevLng) * t;
                if (Math.abs(newLat - d.lat) > 1e-9 || Math.abs(newLng - d.lng) > 1e-9) {
                    d.lat = newLat;
                    d.lng = newLng;
                    dirty = true;
                }
            });
            if (dirty) setDriverList([...driversRef.current.values()]);
            rafIdRef.current = requestAnimationFrame(tick);
        };
        rafIdRef.current = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(rafIdRef.current);
    }, []);

    // â”€â”€ Imperative driver markers (one google.maps.Marker per driver) â”€â”€â”€â”€â”€â”€â”€ //
    useEffect(() => {
        if (!map || !isLoaded) return;

        const activeVolIds = new Set(activeTasks.map((t: any) => t.volunteer_id).filter(Boolean));

        driverList.forEach((driver) => {
            const pos = { lat: driver.lat, lng: driver.lng };
            let marker = driverMarkersRef.current.get(driver.id);

            if (!marker) {
                marker = new google.maps.Marker({
                    map,
                    position: pos,
                    icon: makeTruckIcon(driver.heading, activeVolIds.has(driver.id)),
                    title: driver.name,
                    zIndex: 200,
                });
                const captured = driver;
                marker.addListener("click", () =>
                    setSelectedMarker({ type: "Driver", data: captured })
                );
                driverMarkersRef.current.set(driver.id, marker);
            } else {
                marker.setPosition(pos);
                marker.setIcon(makeTruckIcon(driver.heading, activeVolIds.has(driver.id)));
            }
        });

        // Remove stale markers
        driverMarkersRef.current.forEach((m, id) => {
            if (!driversRef.current.has(id)) {
                m.setMap(null);
                driverMarkersRef.current.delete(id);
            }
        });
    }, [map, isLoaded, driverList, activeTasks]);

    // Cleanup imperative markers on unmount
    useEffect(() => {
        return () => {
            driverMarkersRef.current.forEach((m) => m.setMap(null));
            driverMarkersRef.current.clear();
            cancelAnimationFrame(rafIdRef.current);
        };
    }, []);

    // â”€â”€ Google Directions API route for tracked task â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ //
    useEffect(() => {
        if (!trackTask || !isLoaded || !map) {
            setDirections(null);
            setRouteInfo(null);
            return;
        }
        if (lastFetchedRef.current === trackTask.id) return;
        lastFetchedRef.current = trackTask.id;

        const pickupLat = Number(trackTask.pickup_lat);
        const pickupLng = Number(trackTask.pickup_lng);
        if (!pickupLat || !pickupLng) return;

        const ngo = ngos.find((n: any) => n.id === trackTask.ngo_id);
        const deliveryLat = ngo ? Number(ngo.latitude) : 0;
        const deliveryLng = ngo ? Number(ngo.longitude) : 0;
        if (!deliveryLat || !deliveryLng) return;

        const svc = new window.google.maps.DirectionsService();
        svc.route(
            {
                origin: { lat: pickupLat, lng: pickupLng },
                destination: { lat: deliveryLat, lng: deliveryLng },
                travelMode: window.google.maps.TravelMode.DRIVING,
            },
            (result, st) => {
                if (st === window.google.maps.DirectionsStatus.OK && result) {
                    setDirections(result);
                    const leg = result.routes[0]?.legs[0];
                    if (leg) setRouteInfo({ distance: leg.distance?.text ?? "", duration: leg.duration?.text ?? "" });
                }
            },
        );

        map.panTo({ lat: pickupLat, lng: pickupLng });
    }, [trackTask, isLoaded, map, ngos]);

    // â”€â”€â”€ Guard renders â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ //
    if (loadError) return (
        <div className="w-full h-full flex items-center justify-center bg-red-900/20 text-red-400 rounded-xl">
            Map Error: {loadError.message}
        </div>
    );

    if (!isLoaded) return (
        <div className="w-full h-full flex gap-3">
            <div className="w-[220px] shrink-0 flex flex-col gap-2">
                {[1,2,3,4].map(i => (
                    <div key={i} className="h-16 rounded-xl bg-slate-800/50 animate-pulse" />
                ))}
            </div>
            <div className="flex-1 rounded-xl bg-slate-800/30 animate-pulse flex items-center justify-center">
                <div className="flex flex-col items-center gap-3 text-slate-600">
                    <span className="material-symbols-outlined text-4xl">map</span>
                    <span className="text-sm">Loading map…</span>
                </div>
            </div>
        </div>
    );

    // â”€â”€â”€ Render â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ //
    return (
        <div className="flex gap-3 w-full h-full">
            {/* Task tracking panel */}
            <div className="w-[220px] shrink-0 flex flex-col gap-2 overflow-y-auto">
                <p className="text-[10px] uppercase tracking-wider text-slate-500 px-1">
                    Active tasks — click to route
                </p>

                {activeTasks.length === 0 && (
                    <p className="text-slate-500 text-xs px-2 py-4 text-center">No active tasks</p>
                )}

                {activeTasks.map((task: any) => {
                    const liveDriver = [...driversRef.current.values()].find(
                        (d) => d.taskId === task.id || volunteers.find((v: any) => v.id === d.id)?.current_task_id === task.id,
                    );
                    const isTracking = trackTask?.id === task.id;
                    return (
                        <button
                            key={task.id}
                            onClick={() => {
                                if (isTracking) { setTrackTask(null); }
                                else { setTrackTask(task); lastFetchedRef.current = ""; }
                            }}
                            className={`text-left p-3 rounded-xl border text-sm transition-all ${isTracking
                                ? "border-[#fb923c] bg-[#fb923c]/10"
                                : "border-white/10 bg-slate-800/30 hover:border-[#fb923c]/40"
                            }`}
                        >
                            <p className="font-semibold text-white truncate">{task.food_type}</p>
                            <p className="text-[11px] text-slate-400 mt-0.5 truncate">{task.pickup_address}</p>
                            <div className="flex items-center justify-between mt-1.5">
                                <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                                    task.status === "PENDING" ? "bg-yellow-500/20 text-yellow-400" :
                                    task.status === "IN_TRANSIT" ? "bg-purple-500/20 text-purple-400" :
                                    "bg-blue-500/20 text-blue-400"
                                }`}>{task.status}</span>
                                <span className="text-[#fb923c] text-[11px] font-bold">{task.quantity_kg} kg</span>
                            </div>
                            {liveDriver && (
                                <div className="mt-1.5 flex items-center gap-1 text-[10px] text-green-400">
                                    <span>🚚</span>
                                    <span className="truncate">{liveDriver.name}</span>
                                    <span className="text-slate-500 mx-0.5">·</span>
                                    <span>{liveDriver.speed.toFixed(0)} km/h</span>
                                </div>
                            )}
                        </button>
                    );
                })}

                {/* Route info */}
                {trackTask && routeInfo && (
                    <div className="p-3 bg-slate-800/60 border border-[#fb923c]/30 rounded-xl">
                        <p className="text-[10px] font-semibold text-[#fb923c] uppercase mb-2">Route</p>
                        <div className="space-y-1 text-xs">
                            <div className="flex justify-between">
                                <span className="text-slate-400">Distance</span>
                                <span className="font-medium">{routeInfo.distance}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-slate-400">ETA</span>
                                <span className="font-medium text-green-400">{routeInfo.duration}</span>
                            </div>
                        </div>
                    </div>
                )}

                {/* Live drivers */}
                {driverList.length > 0 && (
                    <div className="mt-1">
                        <p className="text-[10px] uppercase tracking-wider text-slate-500 px-1 mb-1">
                            Live — {driverList.length} driver{driverList.length > 1 ? "s" : ""}
                        </p>
                        {driverList.map((d) => (
                            <div
                                key={d.id}
                                className="flex items-center gap-2 p-2 rounded-lg bg-slate-800/30 border border-white/5 mb-1 cursor-pointer hover:border-green-500/30"
                                onClick={() => setSelectedMarker({ type: "Driver", data: d })}
                            >
                                <span className="text-base">🚚</span>
                                <div className="min-w-0 flex-1">
                                    <p className="text-[11px] font-medium text-white truncate">{d.name}</p>
                                    <p className="text-[10px] text-green-400">{d.speed.toFixed(0)} km/h · {d.heading.toFixed(0)}°</p>
                                </div>
                                <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse shrink-0" />
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Map */}
            <div className="flex-1 relative rounded-xl overflow-hidden">
                <GoogleMap
                    mapContainerStyle={containerStyle}
                    center={DEFAULT_CENTER}
                    zoom={12}
                    onLoad={onLoad}
                    onUnmount={onUnmount}
                    options={{
                        styles: DARK_STYLES,
                        disableDefaultUI: false,
                        zoomControl: true,
                        streetViewControl: false,
                        mapTypeControl: false,
                        fullscreenControl: true,
                    }}
                >
                    {/* Route polyline for tracked task */}
                    {directions && (
                        <DirectionsRenderer
                            directions={directions}
                            options={{
                                suppressMarkers: true,
                                polylineOptions: {
                                    strokeColor: "#fb923c",
                                    strokeWeight: 5,
                                    strokeOpacity: 0.85,
                                },
                            }}
                        />
                    )}

                    {/* NGO markers (green house) */}
                    {ngos.map((ngo: any) =>
                        Number(ngo.latitude) && Number(ngo.longitude) ? (
                            <Marker
                                key={`ngo-${ngo.id}`}
                                position={{ lat: Number(ngo.latitude), lng: Number(ngo.longitude) }}
                                icon={makePinIcon("🏥", "#4ade80")}
                                onClick={() => setSelectedMarker({ type: "NGO", data: ngo })}
                            />
                        ) : null,
                    )}

                    {/* Donor markers (red gift) */}
                    {donors.map((donor: any) =>
                        Number(donor.latitude) && Number(donor.longitude) ? (
                            <Marker
                                key={`donor-${donor.id}`}
                                position={{ lat: Number(donor.latitude), lng: Number(donor.longitude) }}
                                icon={makePinIcon("🏠", "#f87171")}
                                onClick={() => setSelectedMarker({ type: "Donor", data: donor })}
                            />
                        ) : null,
                    )}

                    {/* Task pickup markers (yellow box) */}
                    {activeTasks.map((task: any) =>
                        Number(task.pickup_lat) && Number(task.pickup_lng) ? (
                            <Marker
                                key={`task-${task.id}`}
                                position={{ lat: Number(task.pickup_lat), lng: Number(task.pickup_lng) }}
                                icon={makePinIcon("📦", "#facc15")}
                                onClick={() => setSelectedMarker({ type: "Task", data: task })}
                            />
                        ) : null,
                    )}

                    {/* InfoWindow for static markers */}
                    {selectedMarker && (
                        <InfoWindow
                            position={{
                                lat: Number(
                                    selectedMarker.data.latitude ??
                                    selectedMarker.data.pickup_lat ??
                                    selectedMarker.data.lat
                                ) || DEFAULT_CENTER.lat,
                                lng: Number(
                                    selectedMarker.data.longitude ??
                                    selectedMarker.data.pickup_lng ??
                                    selectedMarker.data.lng
                                ) || DEFAULT_CENTER.lng,
                            }}
                            onCloseClick={() => setSelectedMarker(null)}
                        >
                            <div className="text-black p-2 min-w-[180px] text-sm">
                                <h3 className="font-bold border-b pb-1 mb-2">
                                    {selectedMarker.type === "Driver" ? "🚚" :
                                     selectedMarker.type === "NGO" ? "🏥" :
                                     selectedMarker.type === "Donor" ? "🏠" : "📦"}{" "}
                                    {selectedMarker.data.name ??
                                     selectedMarker.data.organization_name ??
                                     selectedMarker.data.food_type ?? "Unknown"}
                                </h3>
                                {selectedMarker.type === "Driver" && (
                                    <div className="space-y-0.5">
                                        <p>Speed: {(selectedMarker.data.speed ?? 0).toFixed(0)} km/h</p>
                                        <p>Heading: {(selectedMarker.data.heading ?? 0).toFixed(0)}°</p>
                                        <p className="text-xs text-gray-500 mt-1">
                                            {new Date(selectedMarker.data.lastSeen).toLocaleTimeString()}
                                        </p>
                                    </div>
                                )}
                                {selectedMarker.type === "Task" && (
                                    <div className="space-y-0.5">
                                        <p>Qty: {selectedMarker.data.quantity_kg} kg</p>
                                        <p>Status: {selectedMarker.data.status}</p>
                                        <p className="text-xs text-gray-500 mt-1">{selectedMarker.data.pickup_address}</p>
                                    </div>
                                )}
                                {selectedMarker.type === "NGO" && (
                                    <p>Status: {selectedMarker.data.verification_status}</p>
                                )}
                                {selectedMarker.type === "Donor" && (
                                    <p>Email: {selectedMarker.data.email}</p>
                                )}
                            </div>
                        </InfoWindow>
                    )}

                    {/* Legend */}
                    <div className="absolute top-3 right-3 bg-slate-900/95 border border-slate-700 rounded-xl p-3 shadow-xl backdrop-blur-sm pointer-events-none">
                        <p className="text-white font-semibold text-[10px] uppercase tracking-wider mb-2">Legend</p>
                        <div className="space-y-1.5 text-[11px]">
                            {[
                                { e: "🚚", label: "Driver (live)", c: "text-green-400" },
                                { e: "🏥", label: "NGO / Drop-off", c: "text-green-300" },
                                { e: "🏠", label: "Donor / Pickup", c: "text-red-300" },
                                { e: "📦", label: "Active Task", c: "text-yellow-300" },
                                { e: "🟠", label: "Route", c: "text-orange-400" },
                            ].map((item) => (
                                <div key={item.label} className="flex items-center gap-1.5">
                                    <span>{item.e}</span>
                                    <span className={item.c}>{item.label}</span>
                                </div>
                            ))}
                        </div>
                        {driverList.length > 0 && (
                            <div className="mt-2 pt-2 border-t border-slate-700">
                                <p className="text-green-400 text-[10px] flex items-center gap-1">
                                    <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse inline-block" />
                                    {driverList.length} live
                                </p>
                            </div>
                        )}
                    </div>
                </GoogleMap>
            </div>
        </div>
    );
}
