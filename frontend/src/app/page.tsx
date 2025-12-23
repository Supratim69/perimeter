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
  // Extended info for display
  sourceCountry?: string;
  targetCountry?: string;
  attackType?: string;
  severity?: number;
  confidence?: number;
}

export default function Home() {
  const [mode, setMode] = useState<ViewMode>("live");
  const [arcs, setArcs] = useState<Arc[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<"connecting" | "connected" | "disconnected">("connecting");
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [availableDates, setAvailableDates] = useState<string[]>([]);
  const [isLoadingHistorical, setIsLoadingHistorical] = useState(false);
  const [showInfoModal, setShowInfoModal] = useState(false);
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
          sourceCountry: event.source.country,
          targetCountry: event.target.country,
          attackType: event.type,
          severity: event.severity,
          confidence: event.confidence,
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
          sourceCountry: attackEvent.source.country,
          targetCountry: attackEvent.target.country,
          attackType: attackEvent.type,
          severity: attackEvent.severity,
          confidence: attackEvent.confidence,
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
    <div className="flex flex-col lg:flex-row min-h-screen bg-black">
      {/* Info Button - Fixed Position */}
      <button
        onClick={() => setShowInfoModal(true)}
        className="fixed top-6 left-6 z-[60] w-8 h-8 text-neutral-500 hover:text-white transition-colors cursor-pointer"
        aria-label="Information"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
          className="w-6 h-6"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z"
          />
        </svg>
      </button>

      {/* Info Modal */}
      {showInfoModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black bg-opacity-75">
          <div className="bg-neutral-900 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-neutral-700">
            <div className="sticky top-0 bg-neutral-900 border-b border-neutral-700 p-6 flex items-center justify-between">
              <h2 className="text-2xl font-bold text-white">About This Project</h2>
              <button
                onClick={() => setShowInfoModal(false)}
                className="text-neutral-400 hover:text-white transition-colors"
                aria-label="Close"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={2}
                  stroke="currentColor"
                  className="w-6 h-6"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="p-6 space-y-6">
              {/* Overview */}
              <div>
                <h3 className="text-lg font-bold text-white mb-2">🌍 Overview</h3>
                <p className="text-neutral-300 text-sm leading-relaxed">
                  This is an interactive visualization platform for exploring global cyber attack patterns. 
                  The project combines real-time simulation with historical threat intelligence to provide 
                  insights into malicious activity worldwide.
                </p>
              </div>

              {/* Two Modes */}
              <div>
                <h3 className="text-lg font-bold text-white mb-3">🎯 Two Modes</h3>
                <div className="space-y-3">
                  <div className="bg-neutral-800 rounded-lg p-4 border border-cyan-500/30">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-3 h-3 rounded-full bg-cyan-500"></div>
                      <h4 className="font-bold text-white">Live Mode</h4>
                    </div>
                    <p className="text-neutral-300 text-sm">
                      A simulated visualization demonstrating what a live DDoS attack map could look like. 
                      Attacks stream in real-time with random patterns for demonstration purposes.
                    </p>
                  </div>
                  
                  <div className="bg-neutral-800 rounded-lg p-4 border border-purple-500/30">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-3 h-3 rounded-full bg-purple-500"></div>
                      <h4 className="font-bold text-white">Historical Mode</h4>
                    </div>
                    <p className="text-neutral-300 text-sm">
                      Explore past malicious activity using threat intelligence from AlienVault Open Threat Exchange (OTX). 
                      Select any date to view reported attacks from that period.
                    </p>
                  </div>
                </div>
              </div>

              {/* Data Source */}
              <div>
                <h3 className="text-lg font-bold text-white mb-2">📊 Data Source</h3>
                <p className="text-neutral-300 text-sm leading-relaxed mb-2">
                  Historical data is sourced from <strong className="text-white">AlienVault OTX</strong>, 
                  a community-driven threat intelligence platform. OTX provides aggregated reports of 
                  malicious IPs, attack patterns, and threat indicators from security researchers worldwide.
                </p>
                <p className="text-neutral-400 text-xs">
                  No raw IP addresses are exposed. All data is aggregated and anonymized for privacy.
                </p>
              </div>

              {/* What This Is NOT */}
              <div>
                <h3 className="text-lg font-bold text-red-400 mb-2">⚠️ Important Disclaimers</h3>
                <ul className="space-y-1 text-sm text-neutral-300">
                  <li className="flex items-start gap-2">
                    <span className="text-red-400">❌</span>
                    <span>Not a real-time packet capture or intrusion detection system</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-red-400">❌</span>
                    <span>Not monitoring actual live attacks on networks</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-red-400">❌</span>
                    <span>Not exposing individual IP addresses or private data</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-red-400">❌</span>
                    <span>Not claiming to show current real-time threats</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-red-400">❌</span>
                    <span>Not a replacement for professional security tools</span>
                  </li>
                </ul>
              </div>

              {/* Purpose */}
              <div>
                <h3 className="text-lg font-bold text-white mb-2">🎓 Purpose</h3>
                <p className="text-neutral-300 text-sm leading-relaxed">
                  This project is designed for educational and research purposes. It helps visualize 
                  the global nature of cyber threats and demonstrates how threat intelligence data 
                  can be aggregated and presented in an intuitive, visual format.
                </p>
              </div>

              {/* Tech Stack */}
              <div>
                <h3 className="text-lg font-bold text-white mb-2">🛠️ Technology</h3>
                <div className="flex flex-wrap gap-2">
                  {["Next.js", "FastAPI", "Three.js", "AlienVault OTX", "TypeScript", "Python"].map((tech) => (
                    <span key={tech} className="px-3 py-1 bg-neutral-800 text-neutral-300 text-xs rounded-full border border-neutral-700">
                      {tech}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Globe View */}
      <div className="flex-1 flex flex-col items-center justify-center py-20 px-4">
        <div className="max-w-7xl mx-auto w-full relative overflow-hidden h-full md:h-[40rem]">
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

      {/* Attack Info Panel */}
      <div className="w-full lg:w-96 bg-neutral-900 border-l border-neutral-800 overflow-y-auto max-h-screen">
        <div className="p-6">
          <h3 className="text-xl font-bold text-white mb-4">
            Recent Attacks
          </h3>
          
          {arcs.length === 0 ? (
            <div className="text-neutral-400 text-sm text-center py-8">
              No attacks to display
            </div>
          ) : (
            <div className="space-y-3">
              {arcs.slice().reverse().slice(0, 20).map((arc, index) => (
                <div
                  key={arc.order}
                  className="bg-neutral-800 rounded-lg p-4 border border-neutral-700 hover:border-neutral-600 transition-colors"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: arc.color }}
                      />
                      <span className="text-white font-medium uppercase text-sm">
                        {arc.attackType || "Unknown"}
                      </span>
                    </div>
                    <span className="text-xs text-neutral-400">
                      {new Date(arc.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-neutral-400">Source:</span>
                      <span className="text-white font-mono">{arc.sourceCountry || "??"}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-neutral-400">Target:</span>
                      <span className="text-white font-mono">{arc.targetCountry || "??"}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-neutral-400">Severity:</span>
                      <div className="flex items-center gap-1">
                        {[1, 2, 3, 4, 5].map((level) => (
                          <div
                            key={level}
                            className={`w-2 h-4 rounded-sm ${
                              level <= (arc.severity || 1)
                                ? level === 5 ? "bg-red-500" :
                                  level === 4 ? "bg-orange-500" :
                                  level === 3 ? "bg-purple-500" :
                                  level === 2 ? "bg-blue-500" :
                                  "bg-cyan-500"
                                : "bg-neutral-700"
                            }`}
                          />
                        ))}
                        <span className="text-white ml-1">{arc.severity || 1}/5</span>
                      </div>
                    </div>
                    {arc.confidence !== undefined && (
                      <div className="flex items-center justify-between">
                        <span className="text-neutral-400">Confidence:</span>
                        <span className="text-white">{Math.round((arc.confidence || 0) * 100)}%</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
