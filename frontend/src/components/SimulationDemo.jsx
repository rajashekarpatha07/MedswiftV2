import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, Circle, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

/* ────────────────────── SIMULATION DATA ────────────────────── */
const TRIP_SEED = {
    tripId: 'TRIP-20260318-0042',
    patient: { name: 'Rahul Sharma', blood: 'O+', phone: '+91 98765 43210' },
    ambulance: { vehicle: 'KA05MF3821', driver: 'Arjun Kumar', phone: '+91 87654 32109' },
    pickup: { label: 'MG Road, Bangalore', latLng: [12.9756, 77.6051] },
    hospital: {
        name: 'City General Hospital',
        label: 'Indiranagar, Bangalore',
        latLng: [12.9712, 77.5946],
        beds: { total: 120, available: 34 },
        bloodStock: { 'O+': 8 },
        distance: '1.8 km',
    },
    ambulanceStart: [12.9656, 77.5941], // 1.1 km south
};

/* ────────────────────── MAP HELPERS ────────────────────── */
function lerp(a, b, t) { return a + (b - a) * t; }
function lerpLL(from, to, t) { return [lerp(from[0], to[0], t), lerp(from[1], to[1], t)]; }
function clamp01(n) { return Math.max(0, Math.min(1, n)); }
function easeInOutCubic(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }

function interpolateRoute(from, to, n = 50) {
    const pts = [];
    for (let i = 0; i <= n; i++) pts.push(lerpLL(from, to, i / n));
    return pts;
}

/* ── Emoji-based Leaflet divIcons ── */
function emojiIcon(emoji, size = 34, pulseColor) {
    const pulse = pulseColor
        ? `<span style="position:absolute;top:50%;left:50%;width:${size * 2.2}px;height:${size * 2.2}px;
            transform:translate(-50%,-50%);border-radius:50%;
            background:${pulseColor};opacity:.22;animation:simRadarPing 2s ease-out infinite;pointer-events:none;"></span>`
        : '';
    return L.divIcon({
        html: `<div style="position:relative;display:flex;align-items:center;justify-content:center;
            width:${size}px;height:${size}px;font-size:${size * 0.65}px;line-height:1;">
            ${pulse}<span style="position:relative;z-index:2;filter:drop-shadow(0 2px 6px rgba(0,0,0,.45));">${emoji}</span></div>`,
        className: '',
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
    });
}
const patientIcon  = emojiIcon('🆘', 38, 'rgba(239,68,68,.55)');
const ambIconPulse = emojiIcon('🚑', 40, 'rgba(16,185,129,.5)');
const ambIconStill = emojiIcon('🚑', 40);
const hospIcon     = emojiIcon('🏥', 36);

/* ── Fit map bounds ── */
function FitAll({ positions }) {
    const map = useMap();
    useEffect(() => {
        if (positions.length >= 2) map.fitBounds(L.latLngBounds(positions), { padding: [40, 40], maxZoom: 15 });
        else if (positions.length === 1) map.setView(positions[0], 14);
    }, [map, JSON.stringify(positions)]);
    return null;
}

/* ────────────────────── STATUS DEFINITIONS ────────────────────── */
const STATUSES = [
    { key: 'IDLE',              badge: 'Ready',         color: 'bg-white/6 border-white/12 text-white/60',      icon: '🚑' },
    { key: 'SEARCHING',         badge: 'Searching',     color: 'bg-amber-500/10 border-amber-500/25 text-amber-300', icon: '🔍' },
    { key: 'ASSIGNED',          badge: 'Assigned',      color: 'bg-sky-500/10 border-sky-500/25 text-sky-300',   icon: '✅' },
    { key: 'EN_ROUTE_PICKUP',   badge: 'En route',      color: 'bg-indigo-500/10 border-indigo-500/25 text-indigo-300', icon: '🗺️' },
    { key: 'ARRIVED_PICKUP',    badge: 'At patient',    color: 'bg-violet-500/10 border-violet-500/25 text-violet-300', icon: '📍' },
    { key: 'EN_ROUTE_HOSPITAL', badge: 'Transport',     color: 'bg-emerald-500/10 border-emerald-500/25 text-emerald-300', icon: '🏥' },
    { key: 'ARRIVED_HOSPITAL',  badge: 'At hospital',   color: 'bg-teal-500/10 border-teal-500/25 text-teal-300', icon: '🏥' },
    { key: 'COMPLETED',         badge: 'Completed',     color: 'bg-emerald-500/12 border-emerald-500/30 text-emerald-200', icon: '🎉' },
];

const STATUS_IDX = Object.fromEntries(STATUSES.map((s, i) => [s.key, i]));

function nowTS() { return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }); }

/* ────────────────────── COMPONENT ────────────────────── */
export default function SimulationDemo() {
    const [status, setStatus] = useState('IDLE');
    const [autoplay, setAutoplay] = useState(false);
    const [sosActive, setSosActive] = useState(false);
    const [ambPos, setAmbPos]   = useState(TRIP_SEED.ambulanceStart);
    const [trail, setTrail]     = useState([]);
    const [elapsed, setElapsed] = useState(0);
    const [searchRadius, setSearchRadius] = useState(0);

    const [feed, setFeed] = useState(() => [
        { id: 'boot', ts: nowTS(), text: '⚙️ Demo engine initialised. Click "Start Demo" to begin.' },
    ]);

    const travelRAF = useRef(null);
    const timerRef  = useRef(null);
    const startRef  = useRef(null);

    const statusMeta = STATUSES[STATUS_IDX[status]] || STATUSES[0];

    /* ── Helpers ── */
    const addFeed = useCallback((text) => {
        setFeed(prev => [{ id: `${Date.now()}_${Math.random()}`, ts: nowTS(), text }, ...prev].slice(0, 16));
    }, []);

    const clearTravel = useCallback(() => {
        if (travelRAF.current) cancelAnimationFrame(travelRAF.current);
        travelRAF.current = null;
    }, []);

    /* ── Elapsed timer ── */
    useEffect(() => {
        if (status === 'SEARCHING' && !startRef.current) {
            startRef.current = Date.now();
            timerRef.current = setInterval(() => setElapsed(Math.floor((Date.now() - startRef.current) / 1000)), 250);
        }
        if (status === 'IDLE') {
            startRef.current = null;
            setElapsed(0);
            if (timerRef.current) clearInterval(timerRef.current);
        }
        if (status === 'COMPLETED' && timerRef.current) clearInterval(timerRef.current);
        return () => {};
    }, [status]);

    /* ── Animated search radius ── */
    useEffect(() => {
        if (status !== 'SEARCHING') { setSearchRadius(0); return; }
        let frame;
        const start = performance.now();
        const tick = (now) => {
            const t = ((now - start) % 3000) / 3000; // loops every 3s
            setSearchRadius(500 + t * 2000); // 500m → 2500m
            frame = requestAnimationFrame(tick);
        };
        frame = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(frame);
    }, [status]);

    /* ── Travel animation ── */
    const runTravel = useCallback((from, to, durationMs, onDone) => {
        clearTravel();
        const route = interpolateRoute(from, to, 80);
        const startTime = performance.now();
        setTrail([from]);

        const tick = (now) => {
            const t = clamp01((now - startTime) / durationMs);
            const eased = easeInOutCubic(t);
            const idx = Math.min(Math.floor(eased * (route.length - 1)), route.length - 1);
            setAmbPos(route[idx]);
            setTrail(route.slice(0, idx + 1));
            if (t < 1) travelRAF.current = requestAnimationFrame(tick);
            else { clearTravel(); onDone?.(); }
        };
        travelRAF.current = requestAnimationFrame(tick);
    }, [clearTravel]);

    /* ── Step functions ── */
    const startRequest = useCallback(() => {
        addFeed('🆘 Patient triggered emergency request');
        addFeed('📡 GPS coordinates: 12.9756° N, 77.6051° E');
        setStatus('SEARCHING');
        addFeed('🔍 Redis GEOSEARCH: scanning 5 km radius…');
    }, [addFeed]);

    const assignAmbulance = useCallback(() => {
        addFeed(`✅ Match found: ${TRIP_SEED.ambulance.vehicle} — 1.1 km away`);
        addFeed(`🚑 Auto-assigned to driver ${TRIP_SEED.ambulance.driver}`);
        addFeed('📲 Socket.IO: new_trip_assigned → ambulance notified');
        setStatus('ASSIGNED');
    }, [addFeed]);

    const goPickup = useCallback(() => {
        addFeed('📍 Status → EN_ROUTE_PICKUP');
        addFeed('🗺️ Live GPS tracking started via Socket.IO');
        setStatus('EN_ROUTE_PICKUP');
        runTravel(TRIP_SEED.ambulanceStart, TRIP_SEED.pickup.latLng, 5500, () => {
            addFeed('📍 Status → ARRIVED_PICKUP');
            setStatus('ARRIVED_PICKUP');
        });
    }, [addFeed, runTravel]);

    const goHospital = useCallback(() => {
        addFeed(`🏥 Hospital matched: ${TRIP_SEED.hospital.name}`);
        addFeed(`🛏️ Beds: ${TRIP_SEED.hospital.beds.available}/${TRIP_SEED.hospital.beds.total} • 🩸 O+: ${TRIP_SEED.hospital.bloodStock['O+']} units`);
        addFeed('📍 Status → EN_ROUTE_HOSPITAL');
        setStatus('EN_ROUTE_HOSPITAL');
        runTravel(TRIP_SEED.pickup.latLng, TRIP_SEED.hospital.latLng, 6000, () => {
            addFeed('🏥 Status → ARRIVED_HOSPITAL');
            setStatus('ARRIVED_HOSPITAL');
        });
    }, [addFeed, runTravel]);

    const completeTrip = useCallback(() => {
        addFeed('✅ Status → COMPLETED');
        addFeed('🧾 Trip summary saved. Patient admitted to ER.');
        setStatus('COMPLETED');
        clearTravel();
    }, [addFeed, clearTravel]);

    const resetDemo = useCallback(() => {
        clearTravel();
        if (timerRef.current) clearInterval(timerRef.current);
        setStatus('IDLE');
        setAmbPos(TRIP_SEED.ambulanceStart);
        setTrail([]);
        setElapsed(0);
        setSosActive(false);
        setAutoplay(false);
        startRef.current = null;
        setFeed([{ id: `${Date.now()}_reset`, ts: nowTS(), text: '⚙️ Demo reset. Ready for a new simulation.' }]);
    }, [clearTravel]);

    const triggerSos = useCallback(() => {
        if (status === 'IDLE' || status === 'COMPLETED') return;
        setSosActive(true);
        addFeed('🚨 emergency_sos → broadcast to trip room + admin-room');
        setTimeout(() => setSosActive(false), 2500);
    }, [status, addFeed]);

    const simulateCancel = useCallback(() => {
        if (status === 'IDLE' || status === 'COMPLETED') return;
        addFeed('✕ Trip cancelled by user');
        clearTravel();
        setSosActive(false);
        setAutoplay(false);
        setStatus('IDLE');
    }, [status, addFeed, clearTravel]);

    const nextStep = useCallback(() => {
        switch (status) {
            case 'IDLE':             return startRequest();
            case 'SEARCHING':        return assignAmbulance();
            case 'ASSIGNED':         return goPickup();
            case 'ARRIVED_PICKUP':   return goHospital();
            case 'ARRIVED_HOSPITAL': return completeTrip();
            case 'COMPLETED':        return resetDemo();
            default: break;
        }
    }, [status, startRequest, assignAmbulance, goPickup, goHospital, completeTrip, resetDemo]);

    /* ── Autoplay ── */
    useEffect(() => {
        if (!autoplay) return;
        if (status === 'EN_ROUTE_PICKUP' || status === 'EN_ROUTE_HOSPITAL') return;
        if (status === 'COMPLETED') return;
        const id = setTimeout(() => nextStep(), 1200);
        return () => clearTimeout(id);
    }, [autoplay, status, nextStep]);

    /* ── Cleanup ── */
    useEffect(() => () => { clearTravel(); if (timerRef.current) clearInterval(timerRef.current); }, [clearTravel]);

    /* ── Derived state ── */
    const stIdx = STATUS_IDX[status];
    const showPatient   = stIdx >= 1;
    const showAmbulance = stIdx >= 2;
    const showHospital  = stIdx >= 5;
    const isMoving = status === 'EN_ROUTE_PICKUP' || status === 'EN_ROUTE_HOSPITAL';

    const mapPositions = [
        showPatient && TRIP_SEED.pickup.latLng,
        showAmbulance && ambPos,
        showHospital && TRIP_SEED.hospital.latLng,
    ].filter(Boolean);

    const pLabel = useMemo(() => {
        const map = {
            IDLE: '▶ Start Demo Request', SEARCHING: '⚡ Auto-Assign Ambulance',
            ASSIGNED: '🗺️ Navigate to Pickup', ARRIVED_PICKUP: '🏥 Transport to Hospital',
            ARRIVED_HOSPITAL: '✅ Complete Trip', COMPLETED: '↺ Restart Demo',
        };
        return map[status] || 'Next Step';
    }, [status]);

    const statusLine = useMemo(() => {
        const map = {
            IDLE: 'Click the button below to trigger a simulated SOS emergency.',
            SEARCHING: 'Redis GEOSEARCH scanning for nearest ambulance — radius expanding…',
            ASSIGNED: `${TRIP_SEED.ambulance.vehicle} matched. Driver preparing to navigate.`,
            EN_ROUTE_PICKUP: 'Ambulance en route to patient. Live GPS streaming via Socket.IO.',
            ARRIVED_PICKUP: 'Ambulance arrived. Patient being loaded.',
            EN_ROUTE_HOSPITAL: `Transporting to ${TRIP_SEED.hospital.name} (${TRIP_SEED.hospital.distance}).`,
            ARRIVED_HOSPITAL: 'At hospital. Patient handoff in progress.',
            COMPLETED: 'Trip completed. Emergency resolved.',
        };
        return map[status] || '';
    }, [status]);

    const fmtTime = (s) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;

    /* ── Progress ── */
    const progressPct = Math.round((stIdx / (STATUSES.length - 1)) * 100);

    return (
        <div className="space-y-4">

            {/* ── Header bar ── */}
            <div className="rounded-2xl border border-red-500/20 bg-gradient-to-r from-red-500/8 via-pink-500/6 to-transparent px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <span className="inline-flex items-center gap-2 text-[11px] font-black tracking-[0.2em] text-red-300">
                            <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse" />
                            SIMULATION
                        </span>
                        <span className={`text-[11px] px-2.5 py-1 rounded-full border font-bold ${statusMeta.color}`}>
                            {statusMeta.icon} {statusMeta.badge}
                        </span>
                    </div>
                    <div className="flex items-center gap-3">
                        {stIdx > 0 && status !== 'COMPLETED' && (
                            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/5 border border-white/10">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                <span className="text-emerald-400 text-[11px] font-bold font-mono">{fmtTime(elapsed)}</span>
                            </span>
                        )}
                        <span className="text-[10px] text-white/30">No real data</span>
                    </div>
                </div>

                {/* SOS visual */}
                {sosActive && (
                    <div className="mt-3 rounded-xl border border-red-500/30 bg-red-500/12 px-3 py-2 text-xs text-red-200 animate-pulse font-bold">
                        🚨 SOS ACTIVE — alert broadcast to trip room & admin dashboard
                    </div>
                )}

                {/* Progress bar */}
                <div className="mt-3 flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
                        <div
                            className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-700 ease-out"
                            style={{ width: `${progressPct}%` }}
                        />
                    </div>
                    <span className="text-[10px] text-white/30 font-mono w-8 text-right">{progressPct}%</span>
                </div>
            </div>

            {/* ── Main layout ── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

                {/* Left: controls + map */}
                <div className="lg:col-span-2 space-y-4">

                    {/* Status + description */}
                    <div className="rounded-2xl border border-white/8 bg-white/3 p-4">
                        <p className="text-sm font-black text-white mb-1">{statusMeta.icon} {statusMeta.badge}</p>
                        <p className="text-xs text-white/45 leading-relaxed">{statusLine}</p>

                        {/* Buttons */}
                        <div className="flex flex-wrap gap-2 mt-4">
                            <button
                                type="button"
                                onClick={nextStep}
                                disabled={isMoving}
                                className={`flex-1 min-w-[160px] py-3.5 rounded-xl text-white font-black text-sm
                                    transition-all duration-200 border-0 cursor-pointer font-[inherit]
                                    active:scale-[0.97] disabled:opacity-50 disabled:cursor-wait
                                    ${status === 'COMPLETED'
                                        ? 'bg-gradient-to-r from-indigo-500 to-cyan-500 shadow-[0_8px_28px_rgba(99,102,241,0.3)] hover:shadow-[0_12px_36px_rgba(99,102,241,0.4)]'
                                        : 'bg-gradient-to-r from-red-500 to-pink-500 shadow-[0_8px_28px_rgba(239,68,68,0.25)] hover:shadow-[0_12px_36px_rgba(239,68,68,0.4)]'
                                    }
                                    hover:-translate-y-0.5`}
                            >
                                {isMoving ? '⏳ Ambulance moving…' : pLabel}
                            </button>

                            <button type="button" onClick={() => setAutoplay(v => !v)}
                                className={`px-4 py-3 rounded-xl text-xs font-bold border transition-all cursor-pointer font-[inherit]
                                    ${autoplay ? 'bg-emerald-500/15 border-emerald-500/25 text-emerald-300' : 'bg-white/4 border-white/10 text-white/60 hover:bg-white/6'}`}>
                                {autoplay ? '⏸ Auto: ON' : '▶ Auto: OFF'}
                            </button>

                            <button type="button" onClick={triggerSos}
                                disabled={status === 'IDLE' || status === 'COMPLETED'}
                                className="px-4 py-3 rounded-xl text-xs font-bold border bg-red-500/8 border-red-500/20 text-red-300
                                    hover:bg-red-500/15 transition-all disabled:opacity-40 cursor-pointer font-[inherit]">
                                🚨 SOS
                            </button>

                            <button type="button" onClick={simulateCancel}
                                disabled={status === 'IDLE' || status === 'COMPLETED'}
                                className="px-4 py-3 rounded-xl text-xs font-bold border bg-white/4 border-white/10 text-white/50
                                    hover:bg-white/6 transition-all disabled:opacity-40 cursor-pointer font-[inherit]">
                                ✕ Cancel
                            </button>

                            <button type="button" onClick={resetDemo}
                                className="px-4 py-3 rounded-xl text-xs font-bold border bg-white/4 border-white/10 text-white/50
                                    hover:bg-white/6 transition-all cursor-pointer font-[inherit]">
                                ↺ Reset
                            </button>
                        </div>
                    </div>

                    {/* Dark Leaflet Map */}
                    <div className="rounded-2xl overflow-hidden border-2 border-white/8 shadow-[0_0_50px_rgba(16,185,129,0.06)]"
                        style={{ height: '300px' }}>
                        <MapContainer center={TRIP_SEED.pickup.latLng} zoom={14}
                            style={{ height: '100%', width: '100%' }}
                            scrollWheelZoom={false} zoomControl={false} attributionControl={false}>

                            <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" />
                            {mapPositions.length > 0 && <FitAll positions={mapPositions} />}

                            {/* Animated search radius */}
                            {status === 'SEARCHING' && (
                                <Circle center={TRIP_SEED.pickup.latLng} radius={searchRadius}
                                    pathOptions={{ color: '#10b981', fillColor: '#10b981', fillOpacity: 0.06, weight: 1.5, dashArray: '8 6' }} />
                            )}

                            {/* Trail polyline */}
                            {trail.length > 1 && (
                                <Polyline positions={trail}
                                    pathOptions={{ color: '#10b981', weight: 3, opacity: 0.6, dashArray: '6 4' }} />
                            )}

                            {/* Route preview (hospital) */}
                            {(status === 'ARRIVED_PICKUP') && (
                                <Polyline positions={interpolateRoute(TRIP_SEED.pickup.latLng, TRIP_SEED.hospital.latLng, 20)}
                                    pathOptions={{ color: '#8b5cf6', weight: 2, opacity: 0.3, dashArray: '6 4' }} />
                            )}

                            {/* Patient Marker */}
                            {showPatient && (
                                <Marker position={TRIP_SEED.pickup.latLng} icon={patientIcon}>
                                    <Popup><strong>🆘 {TRIP_SEED.patient.name}</strong><br />🩸 {TRIP_SEED.patient.blood} • 📍 {TRIP_SEED.pickup.label}</Popup>
                                </Marker>
                            )}

                            {/* Ambulance Marker */}
                            {showAmbulance && (
                                <Marker position={ambPos} icon={isMoving ? ambIconPulse : ambIconStill}>
                                    <Popup><strong>🚑 {TRIP_SEED.ambulance.vehicle}</strong><br />Driver: {TRIP_SEED.ambulance.driver}</Popup>
                                </Marker>
                            )}

                            {/* Hospital Marker */}
                            {showHospital && (
                                <Marker position={TRIP_SEED.hospital.latLng} icon={hospIcon}>
                                    <Popup><strong>🏥 {TRIP_SEED.hospital.name}</strong><br />🛏️ {TRIP_SEED.hospital.beds.available} beds • 📍 {TRIP_SEED.hospital.label}</Popup>
                                </Marker>
                            )}
                        </MapContainer>
                    </div>

                    {/* Completion stats */}
                    {status === 'COMPLETED' && (
                        <div className="grid grid-cols-3 gap-3 animate-slide-up">
                            {[
                                { label: 'Response Time', value: fmtTime(elapsed), icon: '⚡', accent: 'emerald' },
                                { label: 'Total Distance', value: '2.9 km', icon: '📏', accent: 'indigo' },
                                { label: 'Outcome', value: 'Delivered ✓', icon: '💚', accent: 'teal' },
                            ].map(stat => (
                                <div key={stat.label}
                                    className={`bg-${stat.accent}-500/8 border border-${stat.accent}-500/15 rounded-xl p-3 text-center`}>
                                    <p className="text-lg mb-0.5">{stat.icon}</p>
                                    <p className="text-sm font-black text-white/90">{stat.value}</p>
                                    <p className="text-[10px] text-white/35 mt-0.5">{stat.label}</p>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Right rail */}
                <div className="space-y-4">

                    {/* Trip details card */}
                    <div className="rounded-2xl border border-white/8 bg-white/3 p-4">
                        <p className="text-[10px] font-black uppercase tracking-[2px] text-white/30 mb-3">Trip Snapshot</p>
                        <div className="space-y-3">
                            {[
                                ['Trip ID', TRIP_SEED.tripId],
                                ['Patient', `${TRIP_SEED.patient.name} • 🩸 ${TRIP_SEED.patient.blood}`],
                                ['Pickup', TRIP_SEED.pickup.label],
                                ['Hospital', TRIP_SEED.hospital.name],
                                ['Ambulance', TRIP_SEED.ambulance.vehicle],
                                ['Driver', TRIP_SEED.ambulance.driver],
                            ].map(([k, v]) => (
                                <div key={k}>
                                    <p className="text-[9px] uppercase tracking-[1.5px] text-white/25">{k}</p>
                                    <p className="text-[13px] font-semibold text-white/70">{v}</p>
                                </div>
                            ))}
                        </div>

                        {/* Hospital details when visible */}
                        {showHospital && (
                            <div className="mt-4 pt-3 border-t border-white/6 space-y-2 animate-slide-up">
                                <p className="text-[9px] uppercase tracking-[1.5px] text-white/25">Hospital Resources</p>
                                <div className="flex gap-2">
                                    <span className="text-[10px] bg-emerald-500/12 text-emerald-400 font-bold px-2 py-0.5 rounded-full">
                                        🛏️ {TRIP_SEED.hospital.beds.available} beds
                                    </span>
                                    <span className="text-[10px] bg-red-500/12 text-red-400 font-bold px-2 py-0.5 rounded-full">
                                        🩸 O+: {TRIP_SEED.hospital.bloodStock['O+']} units
                                    </span>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Live event feed */}
                    <div className="rounded-2xl border border-white/8 bg-white/3 p-4">
                        <div className="flex items-center justify-between mb-3">
                            <p className="text-[10px] font-black uppercase tracking-[2px] text-white/30 flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                Live Events
                            </p>
                            <span className="text-[9px] text-white/20">latest first</span>
                        </div>
                        <div className="space-y-1.5 max-h-[280px] overflow-auto pr-1">
                            {feed.map((e, i) => (
                                <div key={e.id}
                                    className={`rounded-lg px-2.5 py-1.5 border transition-all duration-500
                                        ${i === 0 ? 'bg-white/6 border-white/12' : 'bg-white/2 border-transparent'}`}>
                                    <div className="flex items-start justify-between gap-2">
                                        <p className="text-[11px] text-white/60 leading-snug">{e.text}</p>
                                        <span className="text-[9px] text-white/25 flex-shrink-0 font-mono mt-0.5">{e.ts}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* ── Tip ── */}
            <p className="text-[10px] text-white/20 text-center leading-relaxed">
                ⚠️ Interactive simulation only — mirrors real concepts (trip statuses, geo-search, Socket.IO events) but calls no APIs.
            </p>
        </div>
    );
}
