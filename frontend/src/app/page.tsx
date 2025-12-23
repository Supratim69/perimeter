"use client";
import { useEffect, useState, useRef, useMemo } from "react";
import dynamic from "next/dynamic";

const World = dynamic(() => import("@/components/ui/globe").then((m) => m.World), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full">
      <div className="text-white">Loading Globe...</div>
    </div>
  ),
});

// Move globeConfig outside component to prevent recreation
const globeConfig = {
  pointSize: 4,
  globeColor: "#062056",
  showAtmosphere: true,
  atmosphereColor: "#FFFFFF",
  atmosphereAltitude: 0.1,
  emissive: "#062056",
  emissiveIntensity: 0.1,
  shininess: 0.9,
  polygonColor: "rgba(255,255,255,0.7)",
  ambientLight: "#38bdf8",
  directionalLeftLight: "#ffffff",
  directionalTopLight: "#ffffff",
  pointLight: "#ffffff",
  arcTime: 1000,
  arcLength: 0.9,
  rings: 1,
  maxRings: 3,
  initialPosition: { lat: 22.3193, lng: 114.1694 },
  autoRotate: true,
  autoRotateSpeed: 0.5,
};

// Backend API URL
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// Mode type
type ViewMode = "live" | "historical";

// Map severity (1-5) to colors
const getSeverityColor = (severity: number): string => {
  const colors = {
    1: "#06b6d4", // cyan - low severity
    2: "#3b82f6", // blue
    3: "#8b5cf6", // purple
    4: "#f97316", // orange
    5: "#ef4444", // red - high severity
  };
  return colors[severity as keyof typeof colors] || "#06b6d4";
};

// Calculate arc altitude based on distance
const calculateArcAlt = (startLat: number, startLng: number, endLat: number, endLng: number): number => {
  const latDiff = Math.abs(startLat - endLat);
  const lngDiff = Math.abs(startLng - endLng);
  const distance = Math.sqrt(latDiff * latDiff + lngDiff * lngDiff);
  return Math.min(0.5, distance / 100);
};

interface AttackEvent {
  id: string;
  source: { country: string; lat: number; lng: number };
  target: { country: string; lat: number; lng: number };
  type: string;
  severity: number;
  confidence: number;
  timestamp: number;
}

interface Arc {
  order: number;
  startLat: number;
  startLng: number;
  endLat: number;
  endLng: number;
  arcAlt: number;
  color: string;
  timestamp: number;
}

export default function Home() {
  const [mode, setMode] = useState<ViewMode>("live");
  const [arcs, setArcs] = useState<Arc[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<"connecting" | "connected" | "disconnected">("connecting");
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [availableDates, setAvailableDates] = useState<string[]>([]);
  const [isLoadingHistorical, setIsLoadingHistorical] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);
  const orderCounter = useRef(1);
  const arcsRef = useRef<Arc[]>([]);

  // Keep arcsRef in sync with state for use in interval
  useEffect(() => {
    arcsRef.current = arcs;
  }, [arcs]);

  // Fetch available dates on mount
  useEffect(() => {
    const fetchDates = async () => {
      try {
        const response = await fetch(`${API_URL}/history/dates`);
        if (response.ok) {
          const dates = await response.json();
          setAvailableDates(dates);
          if (dates.length > 0) {
            setSelectedDate(dates[0]); // Default to most recent date
          }
        }
      } catch (error) {
        console.error("Error fetching available dates:", error);
      }
    };
    fetchDates();
  }, []);

  // Load historical data when date changes
  useEffect(() => {
    if (mode === "historical" && selectedDate) {
      loadHistoricalData(selectedDate);
    }
  }, [mode, selectedDate]);

  const loadHistoricalData = async (date: string) => {
    setIsLoadingHistorical(true);
    try {
      const response = await fetch(`${API_URL}/history/events?date=${date}`);
      if (response.ok) {
        const events = await response.json();
        
        // Transform historical events to arcs
        const historicalArcs = events.map((event: any, index: number) => ({
          order: index + 1,
          startLat: event.source.lat,
          startLng: event.source.lng,
          endLat: event.target.lat,
          endLng: event.target.lng,
          arcAlt: calculateArcAlt(
            event.source.lat,
            event.source.lng,
            event.target.lat,
            event.target.lng
          ),
          color: getSeverityColor(event.severity),
          timestamp: event.timestamp,
        }));
        
        setArcs(historicalArcs);
      }
    } catch (error) {
      console.error("Error loading historical data:", error);
    } finally {
      setIsLoadingHistorical(false);
    }
  };

  // Live mode SSE connection
  useEffect(() => {
    if (mode !== "live") {
      // Cleanup SSE if switching away from live mode
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
        setConnectionStatus("disconnected");
      }
      return;
    }

    // Connect to SSE endpoint
    const eventSource = new EventSource(`${API_URL}/events/stream`);
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      console.log("SSE connection established");
      setConnectionStatus("connected");
    };

    eventSource.addEventListener("attack", (event) => {
      try {
        const attackEvent: AttackEvent = JSON.parse(event.data);
        
        // Transform attack event to arc format
        const newArc: Arc = {
          order: orderCounter.current++,
          startLat: attackEvent.source.lat,
          startLng: attackEvent.source.lng,
          endLat: attackEvent.target.lat,
          endLng: attackEvent.target.lng,
          arcAlt: calculateArcAlt(
            attackEvent.source.lat,
            attackEvent.source.lng,
            attackEvent.target.lat,
            attackEvent.target.lng
          ),
          color: getSeverityColor(attackEvent.severity),
          timestamp: Date.now(),
        };

        setArcs((prevArcs) => {
          // Add new arc and keep only the last 30 events
          const updatedArcs = [...prevArcs, newArc];
          return updatedArcs.slice(-30);
        });
      } catch (error) {
        console.error("Error parsing attack event:", error);
      }
    });

    eventSource.onerror = (error) => {
      console.error("SSE error:", error);
      setConnectionStatus("disconnected");
    };

    // Cleanup old events every 5 seconds in live mode
    const cleanupInterval = setInterval(() => {
      const now = Date.now();
      setArcs((prevArcs) => {
        const filtered = prevArcs.filter((arc) => now - arc.timestamp < 30000);
        // Only update if something was filtered out
        if (filtered.length === prevArcs.length) return prevArcs;
        return filtered;
      });
    }, 5000);

    // Cleanup on unmount
    return () => {
      eventSource.close();
      clearInterval(cleanupInterval);
    };
  }, [mode]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-black py-20 w-full">
      <div className="max-w-7xl mx-auto w-full relative overflow-hidden h-full md:h-[40rem] px-4">
        <div className="flex flex-col items-center justify-center relative z-50">
          <h2 className="text-center text-xl md:text-4xl font-bold text-white">
            DDoS Attack {mode === "live" ? "Live" : "Historical"} Map
          </h2>
          <p className="text-center text-base md:text-lg font-normal text-neutral-200 max-w-md mt-2 mb-4">
            {mode === "live" 
              ? "Real-time visualization of DDoS attacks happening around the world."
              : "Explore historical malicious activity from past dates."}
          </p>
          
          {/* Mode Switcher */}
          <div className="flex items-center gap-2 mb-4">
            <button
              onClick={() => setMode("live")}
              className={`px-4 py-2 rounded-lg font-medium transition-colors cursor-pointer ${
                mode === "live"
                  ? "bg-cyan-500 text-white"
                  : "bg-neutral-800 text-neutral-400 hover:bg-neutral-700"
              }`}
            >
              Live Mode
            </button>
            <button
              onClick={() => setMode("historical")}
              className={`px-4 py-2 rounded-lg font-medium transition-colors cursor-pointer ${
                mode === "historical"
                  ? "bg-purple-500 text-white"
                  : "bg-neutral-800 text-neutral-400 hover:bg-neutral-700"
              }`}
            >
              Historical Mode
            </button>
          </div>

          {/* Date Picker for Historical Mode */}
          {mode === "historical" && (
            <div className="mb-4">
              <select
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="px-4 py-2 bg-neutral-800 text-white rounded-lg border border-neutral-700 focus:outline-none focus:border-purple-500 cursor-pointer"
              >
                {availableDates.map((date) => (
                  <option key={date} value={date}>
                    {date}
                  </option>
                ))}
              </select>
              {isLoadingHistorical && (
                <span className="ml-3 text-sm text-neutral-400">Loading...</span>
              )}
            </div>
          )}

          {/* Status Indicator */}
          <div className="flex items-center gap-2 mb-4">
            {mode === "live" && (
              <>
                <div className={`w-2 h-2 rounded-full ${
                  connectionStatus === "connected" ? "bg-green-500" : 
                  connectionStatus === "connecting" ? "bg-yellow-500 animate-pulse" : 
                  "bg-red-500"
                }`} />
                <span className="text-sm text-neutral-400">
                  {connectionStatus === "connected" ? "Live" : 
                   connectionStatus === "connecting" ? "Connecting..." : 
                   "Disconnected"}
                </span>
                <span className="text-sm text-neutral-500">|</span>
              </>
            )}
            {mode === "historical" && (
              <>
                <div className="w-2 h-2 rounded-full bg-purple-500" />
                <span className="text-sm text-neutral-400">
                  Viewing {selectedDate}
                </span>
                <span className="text-sm text-neutral-500">|</span>
              </>
            )}
            <span className="text-sm text-neutral-400">
              {arcs.length} {mode === "live" ? "active" : "total"} {arcs.length === 1 ? "attack" : "attacks"}
            </span>
          </div>
        </div>
        <div className="absolute w-full bottom-0 inset-x-0 h-40 bg-gradient-to-b pointer-events-none select-none from-transparent to-black z-40" />
        <div className="absolute w-full -bottom-20 h-72 md:h-full z-10">
          <World globeConfig={globeConfig} data={arcs} />
        </div>
      </div>
    </div>
  );
}
