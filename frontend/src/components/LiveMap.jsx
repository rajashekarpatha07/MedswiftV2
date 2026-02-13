import { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix for default marker icons in react-leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

// Custom ambulance icon
const ambulanceIcon = new L.Icon({
    iconUrl: 'https://cdn-icons-png.flaticon.com/512/2382/2382461.png',
    iconSize: [40, 40],
    iconAnchor: [20, 40],
    popupAnchor: [0, -40],
});

// Custom pickup icon
const pickupIcon = new L.Icon({
    iconUrl: 'https://cdn-icons-png.flaticon.com/512/684/684908.png',
    iconSize: [35, 35],
    iconAnchor: [17, 35],
    popupAnchor: [0, -35],
});

// Custom hospital icon
const hospitalIcon = new L.Icon({
    iconUrl: 'https://cdn-icons-png.flaticon.com/512/2913/2913456.png',
    iconSize: [35, 35],
    iconAnchor: [17, 35],
    popupAnchor: [0, -35],
});

// Component to fit map to show all markers
function FitBounds({ positions }) {
    const map = useMap();

    useEffect(() => {
        if (positions.length > 0) {
            const bounds = L.latLngBounds(positions);
            map.fitBounds(bounds, { padding: [50, 50] });
        }
    }, [map, positions]);

    return null;
}

// Component to update map view when ambulance moves
function UpdateView({ center }) {
    const map = useMap();

    useEffect(() => {
        if (center) {
            map.setView(center, map.getZoom());
        }
    }, [map, center]);

    return null;
}

/**
 * LiveMap component for displaying ambulance, pickup, and hospital locations
 * @param {Object} props
 * @param {[number, number]} props.ambulanceLocation - [lat, lng] of ambulance
 * @param {[number, number]} props.pickupLocation - [lat, lng] of pickup point
 * @param {[number, number]} props.hospitalLocation - [lat, lng] of hospital
 * @param {string} props.height - CSS height value
 */
function LiveMap({
    ambulanceLocation,
    pickupLocation,
    hospitalLocation,
    height = '300px',
    showAmbulance = true,
    showPickup = true,
    showHospital = true
}) {
    // Convert coordinates if they come as [lng, lat] (MongoDB format)
    const toLatLng = (coords) => {
        if (!coords || coords.length < 2) return null;
        // If it looks like [lng, lat], swap it
        if (Math.abs(coords[0]) > 90) {
            return [coords[1], coords[0]];
        }
        return coords;
    };

    const ambulancePos = toLatLng(ambulanceLocation);
    const pickupPos = toLatLng(pickupLocation);
    const hospitalPos = toLatLng(hospitalLocation);

    // Collect all valid positions for bounds calculation
    const positions = [
        showAmbulance && ambulancePos,
        showPickup && pickupPos,
        showHospital && hospitalPos
    ].filter(Boolean);

    // Default center (India) if no positions available
    const defaultCenter = [20.5937, 78.9629];
    const center = positions[0] || defaultCenter;

    return (
        <div style={{ height, width: '100%', borderRadius: '12px', overflow: 'hidden', border: '2px solid rgba(255,255,255,0.1)' }}>
            <MapContainer
                center={center}
                zoom={14}
                style={{ height: '100%', width: '100%' }}
                scrollWheelZoom={true}
            >
                <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />

                {positions.length > 1 && <FitBounds positions={positions} />}
                {ambulancePos && <UpdateView center={ambulancePos} />}

                {showAmbulance && ambulancePos && (
                    <Marker position={ambulancePos} icon={ambulanceIcon}>
                        <Popup>
                            <strong>🚑 Ambulance</strong><br />
                            Current location
                        </Popup>
                    </Marker>
                )}

                {showPickup && pickupPos && (
                    <Marker position={pickupPos} icon={pickupIcon}>
                        <Popup>
                            <strong>📍 Pickup Point</strong><br />
                            Patient location
                        </Popup>
                    </Marker>
                )}

                {showHospital && hospitalPos && (
                    <Marker position={hospitalPos} icon={hospitalIcon}>
                        <Popup>
                            <strong>🏥 Hospital</strong><br />
                            Destination
                        </Popup>
                    </Marker>
                )}
            </MapContainer>
        </div>
    );
}

/**
 * Opens native maps app with navigation route
 * Works on mobile and desktop without API keys
 * INSTANT - Google Maps will get current location itself
 */
export function openNavigation(destLat, destLng) {
    // Google Maps will automatically use user's current location as origin
    const url = `https://www.google.com/maps/dir/?api=1&destination=${destLat},${destLng}&travelmode=driving`;
    window.open(url, '_blank');
}

/**
 * Opens navigation from current location to destination
 * NOW INSTANT - no GPS wait, Google Maps handles it
 */
export function navigateFromCurrent(destLat, destLng) {
    // Don't wait for GPS - Google Maps will get current location automatically
    openNavigation(destLat, destLng);
}

export default LiveMap;
