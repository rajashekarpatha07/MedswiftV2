# MedSwift Socket.IO Documentation

**Version:** 1.0  
**Last Updated:** January 28, 2026  
**Purpose:** Real-time communication for trip tracking, location updates, and emergency notifications

---

## Table of Contents

1. [Overview](#overview)
2. [Connection Setup](#connection-setup)
3. [Authentication](#authentication)
4. [Room Management](#room-management)
5. [Events Reference](#events-reference)
   - [Outgoing Events (Client → Server)](#outgoing-events-client--server)
   - [Incoming Events (Server → Client)](#incoming-events-server--client)
6. [Data Structures](#data-structures)
7. [Error Handling](#error-handling)
8. [Best Practices](#best-practices)
9. [Code Examples](#code-examples)

---

## Overview

The MedSwift Socket.IO system enables real-time bidirectional communication between users, ambulances, and admins during emergency medical trips. It handles:

- Real-time location tracking
- Trip room management
- Emergency SOS alerts
- Participant notifications
- Connection status monitoring

**Server Configuration:**
- **Transports:** WebSocket (preferred), Polling (fallback)
- **Ping Timeout:** 60 seconds
- **Ping Interval:** 25 seconds
- **Max Message Size:** 100 MB

---

## Connection Setup

### Initialize Socket Connection

```javascript
import io from 'socket.io-client';

const SERVER_URL = 'http://your-server-url'; // Replace with actual server URL

const socket = io(SERVER_URL, {
  auth: {
    token: 'YOUR_JWT_ACCESS_TOKEN' // Required for authentication
  },
  transports: ['websocket', 'polling'], // Prefer WebSocket
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionAttempts: 5
});
```

### Connection Event Listeners

```javascript
socket.on('connect', () => {
  console.log('Connected to server:', socket.id);
});

socket.on('disconnect', (reason) => {
  console.log('Disconnected:', reason);
});

socket.on('connect_error', (error) => {
  console.error('Connection error:', error.message);
});
```

---

## Authentication

### JWT Token Requirements

All socket connections **must** include a valid JWT access token during the handshake.

**Token Format:**
```javascript
{
  id: "userId",           // User/Ambulance/Admin ID
  role: "user",          // "user" | "ambulance" | "admin"
  iat: 1768997690,       // Issued at timestamp
  exp: 1768998590        // Expiration timestamp
}
```

**Authentication Methods:**

1. **Via auth object (Recommended):**
```javascript
const socket = io(SERVER_URL, {
  auth: { token: accessToken }
});
```

2. **Via query parameters:**
```javascript
const socket = io(SERVER_URL, {
  query: { token: accessToken }
});
```

### Authentication Errors

If authentication fails, the connection will be rejected with one of these errors:
- `"Authentication error: No token provided"`
- `"Authentication error: Invalid token"`
- `"Authentication error: User not found"`
- `"Authentication error: Invalid role"`

---

## Room Management

### Automatic Room Assignment

Upon successful connection, users are automatically assigned to specific rooms based on their role:

| Role | Rooms Joined |
|------|--------------|
| **User** | `user:{userId}` |
| **Ambulance** | `ambulance:{ambulanceId}`, `ambulance-room` |
| **Admin** | `admin-room` |

### Trip Rooms

Trip-specific rooms follow the format: `trip:{tripId}`

Participants must explicitly join trip rooms using the `join_trip` event.

---

## Events Reference

### Outgoing Events (Client → Server)

These are events your frontend should **emit** to the server.

---

#### 1. `join_trip`

Join a specific trip room to receive real-time updates.

**When to Use:**
- When user starts/views a trip
- When ambulance is assigned to a trip
- When admin monitors a trip

**Payload:**
```typescript
{
  tripId: string  // MongoDB ObjectId of the trip
}
```

**Callback Response:**
```typescript
{
  success: boolean,
  message: string,
  trip?: {
    _id: string,
    userId: {
      _id: string,
      name: string,
      phone: string
    },
    ambulanceId?: {
      _id: string,
      driverName: string,
      vehicleNumber: string
    },
    status: string,
    // ... other trip fields
  }
}
```

**Example:**
```javascript
socket.emit('join_trip', { tripId: '507f1f77bcf86cd799439011' }, (response) => {
  if (response.success) {
    console.log('Joined trip:', response.trip);
  } else {
    console.error('Error:', response.message);
  }
});
```

**Possible Errors:**
- `"Trip ID is required"`
- `"Trip not found"`
- `"Unauthorized: You are not part of this trip"`

---

#### 2. `leave_trip`

Leave a trip room when no longer tracking it.

**When to Use:**
- When user closes trip view
- When trip is completed
- When navigating away from trip screen

**Payload:**
```typescript
{
  tripId: string
}
```

**Callback Response:**
```typescript
{
  success: boolean,
  message: string
}
```

**Example:**
```javascript
socket.emit('leave_trip', { tripId: '507f1f77bcf86cd799439011' }, (response) => {
  if (response.success) {
    console.log('Left trip successfully');
  }
});
```

---

#### 3. `location_update`

Send real-time location updates during a trip.

**When to Use:**
- Continuously during active trip (recommended: every 3-5 seconds)
- When location changes significantly
- **Only** users and ambulances can send location updates

**Payload:**
```typescript
{
  tripId: string,
  location: {
    latitude: number,   // e.g., 17.3850
    longitude: number,  // e.g., 78.4867
    accuracy?: number,  // Optional: accuracy in meters
    altitude?: number,  // Optional: altitude in meters
    speed?: number      // Optional: speed in m/s
  }
}
```

**Callback Response:**
```typescript
{
  success: boolean,
  message: string
}
```

**Example:**
```javascript
// Using browser geolocation API
navigator.geolocation.watchPosition((position) => {
  socket.emit('location_update', {
    tripId: currentTripId,
    location: {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      accuracy: position.coords.accuracy,
      speed: position.coords.speed
    }
  }, (response) => {
    if (!response.success) {
      console.error('Location update failed:', response.message);
    }
  });
}, (error) => {
  console.error('Geolocation error:', error);
}, {
  enableHighAccuracy: true,
  maximumAge: 0,
  timeout: 5000
});
```

**Possible Errors:**
- `"Invalid payload"` - Missing required fields
- `"Trip not found"`
- `"Unauthorized: Only trip participants can send location"`

**Important Notes:**
- Location data is stored in Redis with 5-minute TTL
- Ambulance locations are also indexed in geo-spatial index for distance calculations
- Location updates are broadcast to all trip participants (except sender)

---

#### 4. `get_location`

Request the current location of another participant in the trip.

**When to Use:**
- To get patient location (ambulance requesting user location)
- To get ambulance location (user requesting ambulance location)
- For initial location when joining a trip

**Payload:**
```typescript
{
  tripId: string,
  targetRole: "user" | "ambulance"  // Role of participant whose location you want
}
```

**Callback Response:**
```typescript
{
  success: boolean,
  location?: {
    latitude: number,
    longitude: number,
    userId: string,
    userRole: string,
    timestamp: string,  // ISO 8601 format
    accuracy?: number,
    altitude?: number,
    speed?: number
  },
  message?: string,
  note?: string  // "Using fallback location" if exact key not found
}
```

**Example:**
```javascript
// Ambulance getting patient location
socket.emit('get_location', {
  tripId: '507f1f77bcf86cd799439011',
  targetRole: 'user'
}, (response) => {
  if (response.success) {
    console.log('Patient location:', response.location);
    updateMapMarker(response.location);
  } else {
    console.error('Location not available:', response.message);
  }
});
```

**Possible Errors:**
- `"Invalid payload"`
- `"Trip not found"`
- `"Unauthorized"` - Requester is not part of the trip
- `"Location not available for {role}. Make sure they've sent location first."`

---

#### 5. `emergency_sos`

Trigger an emergency SOS alert to all trip participants and admins.

**When to Use:**
- Medical emergency
- Ambulance breakdown
- Safety concerns
- Any urgent situation requiring immediate attention

**Payload:**
```typescript
{
  tripId: string,
  message?: string  // Optional custom message
}
```

**Callback Response:**
```typescript
{
  success: boolean,
  message: string
}
```

**Example:**
```javascript
// Trigger SOS
socket.emit('emergency_sos', {
  tripId: currentTripId,
  message: 'Patient condition critical!'
}, (response) => {
  if (response.success) {
    console.log('SOS sent successfully');
    showAlert('Emergency alert sent to all participants');
  }
});
```

**Broadcast Behavior:**
- Sent to all participants in the trip room
- Sent to all admins in admin-room
- Includes sender's userId, userRole, and timestamp

---

#### 6. `get_trip_participants`

Get a list of all currently connected participants in a trip.

**When to Use:**
- To check who is actively connected
- To display online status indicators
- For monitoring active connections

**Payload:**
```typescript
{
  tripId: string
}
```

**Callback Response:**
```typescript
{
  success: boolean,
  participants?: Array<{
    userId: string,
    userRole: "user" | "ambulance" | "admin",
    connectedAt: string  // ISO 8601 timestamp
  }>,
  count?: number,
  message?: string
}
```

**Example:**
```javascript
socket.emit('get_trip_participants', {
  tripId: '507f1f77bcf86cd799439011'
}, (response) => {
  if (response.success) {
    console.log(`${response.count} participants online:`, response.participants);
    updateOnlineIndicators(response.participants);
  }
});
```

---

#### 7. `echo_test`

Debug endpoint to test socket connectivity.

**Payload:**
```typescript
any  // Any data you want echoed back
```

**Callback Response:**
```typescript
{
  success: true,
  echo: any,  // Your original data
  serverTime: string,  // ISO 8601 timestamp
  socketId: string
}
```

**Example:**
```javascript
socket.emit('echo_test', { test: 'ping' }, (response) => {
  console.log('Server responded:', response);
  console.log('Latency:', Date.now() - new Date(response.serverTime).getTime());
});
```

---

### Incoming Events (Server → Client)

These are events your frontend should **listen** for from the server.

---

#### 1. `connected`

Emitted immediately after successful authentication and connection.

**When Received:**
- Right after socket connects and authenticates

**Payload:**
```typescript
{
  message: "Successfully connected to MedSwift",
  socketId: string,
  userId: string,
  userRole: "user" | "ambulance" | "admin",
  timestamp: string  // ISO 8601
}
```

**Example:**
```javascript
socket.on('connected', (data) => {
  console.log('Welcome message:', data.message);
  console.log('Your socket ID:', data.socketId);
  console.log('Logged in as:', data.userRole);
  
  // Store socket ID for debugging
  localStorage.setItem('socketId', data.socketId);
});
```

**UI Action:**
- Show "Connected" indicator
- Display user role badge
- Enable real-time features

---

#### 2. `participant_joined`

Emitted when another participant joins the trip room.

**When Received:**
- When user/ambulance/admin joins a trip you're already in

**Payload:**
```typescript
{
  userId: string,
  userRole: "user" | "ambulance" | "admin",
  socketId: string,
  timestamp: string
}
```

**Example:**
```javascript
socket.on('participant_joined', (data) => {
  console.log(`${data.userRole} joined the trip`);
  
  // Update UI
  if (data.userRole === 'ambulance') {
    showNotification('Ambulance has joined the trip!');
    enableTrackingFeatures();
  }
  
  // Add to participants list
  addParticipantToUI(data);
});
```

**UI Actions:**
- Show notification: "Ambulance driver joined"
- Update online participants count
- Enable ambulance tracking if ambulance joined

---

#### 3. `participant_left`

Emitted when a participant leaves the trip room.

**When Received:**
- When someone explicitly calls `leave_trip`

**Payload:**
```typescript
{
  userId: string,
  userRole: "user" | "ambulance" | "admin",
  socketId: string,
  timestamp: string
}
```

**Example:**
```javascript
socket.on('participant_left', (data) => {
  console.log(`${data.userRole} left the trip`);
  
  // Update UI
  removeParticipantFromUI(data.userId);
  
  if (data.userRole === 'ambulance') {
    showWarning('Ambulance driver disconnected from trip');
  }
});
```

---

#### 4. `participant_disconnected`

Emitted when a participant's socket disconnects (network loss, closed app, etc.).

**When Received:**
- When someone's socket disconnects unexpectedly
- Not triggered by explicit `leave_trip`

**Payload:**
```typescript
{
  userId: string,
  userRole: "user" | "ambulance" | "admin",
  timestamp: string
}
```

**Example:**
```javascript
socket.on('participant_disconnected', (data) => {
  console.log(`${data.userRole} disconnected`);
  
  // Update UI
  markParticipantOffline(data.userId);
  
  if (data.userRole === 'ambulance') {
    showWarning('Ambulance connection lost. Trying to reconnect...');
  }
});
```

**UI Actions:**
- Show "offline" indicator
- Display reconnection message
- Maintain last known location

---

#### 5. `location_updated`

Emitted when any participant sends a location update.

**When Received:**
- Every time another participant in your trip sends `location_update`
- You will NOT receive your own location updates

**Payload:**
```typescript
{
  userId: string,
  userRole: "user" | "ambulance" | "admin",
  location: {
    latitude: number,
    longitude: number,
    accuracy?: number,
    altitude?: number,
    speed?: number
  },
  timestamp: string
}
```

**Example:**
```javascript
socket.on('location_updated', (data) => {
  console.log(`Location update from ${data.userRole}:`, data.location);
  
  // Update map marker
  if (data.userRole === 'ambulance') {
    updateAmbulanceMarker(data.location);
    calculateETA(data.location);
  } else if (data.userRole === 'user') {
    updatePatientMarker(data.location);
  }
  
  // Update distance/ETA displays
  updateDistanceDisplay(data.location);
});
```

**UI Actions:**
- Update map marker position
- Recalculate distance/ETA
- Update location timestamp
- Draw route if available

**Important:**
- High frequency event (every 3-5 seconds)
- Optimize UI updates to prevent performance issues
- Consider debouncing UI updates if needed

---

#### 6. `emergency_sos`

Emitted when anyone in the trip triggers an SOS alert.

**When Received:**
- When any participant calls `emergency_sos` event
- Admins receive all SOS alerts from all trips

**Payload:**
```typescript
{
  tripId: string,
  userId: string,
  userRole: "user" | "ambulance" | "admin",
  message: string,  // e.g., "Emergency SOS triggered!" or custom message
  timestamp: string
}
```

**Example:**
```javascript
socket.on('emergency_sos', (data) => {
  console.log('🚨 EMERGENCY SOS!', data);
  
  // Show urgent alert
  showUrgentAlert({
    title: '🚨 EMERGENCY SOS',
    message: data.message,
    from: data.userRole,
    time: data.timestamp
  });
  
  // Play alert sound
  playSOSSound();
  
  // Trigger vibration
  if ('vibrate' in navigator) {
    navigator.vibrate([200, 100, 200, 100, 200]);
  }
  
  // Show in logs
  addSOSToTripLog(data);
});
```

**UI Actions:**
- Show full-screen alert modal
- Play urgent notification sound
- Trigger device vibration
- Send push notification if app in background
- Log SOS event prominently
- For ambulance: Show "Call 911" button
- For user: Show "Patient needs help" indicator

**Critical:**
- This is the highest priority notification
- Must not be missed or dismissed easily
- Should persist until acknowledged

---

## Data Structures

### Location Object

```typescript
interface Location {
  latitude: number;      // Required: -90 to 90
  longitude: number;     // Required: -180 to 180
  accuracy?: number;     // Optional: meters
  altitude?: number;     // Optional: meters above sea level
  speed?: number;        // Optional: meters per second
}
```

### Trip Object (Partial)

```typescript
interface Trip {
  _id: string;
  userId: {
    _id: string;
    name: string;
    phone: string;
  };
  ambulanceId?: {
    _id: string;
    driverName: string;
    vehicleNumber: string;
  };
  hospitalId?: string;
  status: "pending" | "accepted" | "in_progress" | "completed" | "cancelled";
  pickupLocation: {
    type: "Point";
    coordinates: [number, number];  // [longitude, latitude]
    address?: string;
  };
  dropLocation: {
    type: "Point";
    coordinates: [number, number];
    address?: string;
  };
  createdAt: string;
  updatedAt: string;
}
```

### Callback Response

All emitted events with callbacks follow this structure:

```typescript
interface CallbackResponse {
  success: boolean;
  message?: string;
  [key: string]: any;  // Additional response data
}
```

---

## Error Handling

### Connection Errors

```javascript
socket.on('connect_error', (error) => {
  console.error('Connection error:', error.message);
  
  if (error.message.includes('Authentication')) {
    // Token expired or invalid
    showError('Session expired. Please login again.');
    redirectToLogin();
  } else {
    // Network error
    showError('Unable to connect. Check your internet connection.');
  }
});
```

### Event Callback Errors

```javascript
socket.emit('join_trip', { tripId }, (response) => {
  if (!response.success) {
    switch (response.message) {
      case 'Trip not found':
        showError('This trip no longer exists');
        break;
      case 'Unauthorized: You are not part of this trip':
        showError('You do not have access to this trip');
        redirectToHome();
        break;
      default:
        showError(response.message);
    }
  }
});
```

### Reconnection Handling

```javascript
socket.on('reconnect', (attemptNumber) => {
  console.log('Reconnected after', attemptNumber, 'attempts');
  
  // Rejoin trip room
  if (currentTripId) {
    socket.emit('join_trip', { tripId: currentTripId }, (response) => {
      if (response.success) {
        showSuccess('Reconnected to trip');
      }
    });
  }
});

socket.on('reconnect_attempt', (attemptNumber) => {
  console.log('Reconnection attempt', attemptNumber);
  showInfo(`Reconnecting... (Attempt ${attemptNumber})`);
});

socket.on('reconnect_failed', () => {
  showError('Failed to reconnect. Please refresh the page.');
});
```

---

## Best Practices

### 1. Location Updates

```javascript
// ✅ Good: Throttle location updates
let lastLocationUpdate = 0;
const LOCATION_UPDATE_INTERVAL = 3000; // 3 seconds

navigator.geolocation.watchPosition((position) => {
  const now = Date.now();
  if (now - lastLocationUpdate >= LOCATION_UPDATE_INTERVAL) {
    socket.emit('location_update', {
      tripId: currentTripId,
      location: {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude
      }
    });
    lastLocationUpdate = now;
  }
});

// ❌ Bad: No throttling (sends too frequently)
navigator.geolocation.watchPosition((position) => {
  socket.emit('location_update', { ... });
});
```

### 2. Always Use Callbacks

```javascript
// ✅ Good: With callback for error handling
socket.emit('join_trip', { tripId }, (response) => {
  if (response.success) {
    console.log('Joined successfully');
  } else {
    console.error('Failed:', response.message);
  }
});

// ❌ Bad: No callback
socket.emit('join_trip', { tripId });
```

### 3. Clean Up on Unmount

```javascript
// React example
useEffect(() => {
  // Setup listeners
  socket.on('location_updated', handleLocationUpdate);
  socket.on('emergency_sos', handleSOS);
  
  // Cleanup
  return () => {
    socket.off('location_updated', handleLocationUpdate);
    socket.off('emergency_sos', handleSOS);
    
    // Leave trip room
    if (tripId) {
      socket.emit('leave_trip', { tripId });
    }
  };
}, []);
```

### 4. Reconnection Strategy

```javascript
const socket = io(SERVER_URL, {
  auth: { token: getAccessToken() },
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  reconnectionAttempts: 5
});

// Re-authenticate on reconnect
socket.on('reconnect', () => {
  // Re-join rooms
  if (currentTripId) {
    socket.emit('join_trip', { tripId: currentTripId });
  }
});
```

### 5. Token Refresh

```javascript
// Monitor token expiration
socket.on('connect_error', (error) => {
  if (error.message.includes('token')) {
    // Refresh token
    refreshAccessToken().then((newToken) => {
      socket.auth.token = newToken;
      socket.connect();
    });
  }
});
```

---

## Code Examples

### Complete User Implementation

```javascript
import io from 'socket.io-client';

class TripTracker {
  constructor(serverUrl, accessToken) {
    this.socket = io(serverUrl, {
      auth: { token: accessToken },
      transports: ['websocket', 'polling'],
      reconnection: true
    });
    
    this.currentTripId = null;
    this.setupListeners();
  }
  
  setupListeners() {
    // Connection events
    this.socket.on('connect', () => {
      console.log('Connected:', this.socket.id);
      this.onConnect();
    });
    
    this.socket.on('connected', (data) => {
      console.log('Welcome:', data);
    });
    
    // Trip events
    this.socket.on('participant_joined', (data) => {
      console.log('Participant joined:', data);
      if (data.userRole === 'ambulance') {
        this.onAmbulanceJoined(data);
      }
    });
    
    this.socket.on('location_updated', (data) => {
      if (data.userRole === 'ambulance') {
        this.onAmbulanceLocationUpdate(data.location);
      }
    });
    
    this.socket.on('emergency_sos', (data) => {
      this.onEmergencySOS(data);
    });
    
    this.socket.on('participant_disconnected', (data) => {
      console.log('Participant disconnected:', data);
    });
  }
  
  joinTrip(tripId) {
    this.currentTripId = tripId;
    
    this.socket.emit('join_trip', { tripId }, (response) => {
      if (response.success) {
        console.log('Joined trip:', response.trip);
        this.startLocationTracking();
      } else {
        console.error('Failed to join:', response.message);
      }
    });
  }
  
  startLocationTracking() {
    if (!navigator.geolocation) {
      console.error('Geolocation not supported');
      return;
    }
    
    this.watchId = navigator.geolocation.watchPosition(
      (position) => {
        this.sendLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy
        });
      },
      (error) => {
        console.error('Geolocation error:', error);
      },
      {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 5000
      }
    );
  }
  
  sendLocation(location) {
    if (!this.currentTripId) return;
    
    this.socket.emit('location_update', {
      tripId: this.currentTripId,
      location
    }, (response) => {
      if (!response.success) {
        console.error('Location update failed:', response.message);
      }
    });
  }
  
  sendSOS(message) {
    if (!this.currentTripId) return;
    
    this.socket.emit('emergency_sos', {
      tripId: this.currentTripId,
      message: message || 'HELP! Emergency!'
    }, (response) => {
      if (response.success) {
        console.log('SOS sent successfully');
      }
    });
  }
  
  getAmbulanceLocation() {
    if (!this.currentTripId) return;
    
    this.socket.emit('get_location', {
      tripId: this.currentTripId,
      targetRole: 'ambulance'
    }, (response) => {
      if (response.success) {
        this.onAmbulanceLocationUpdate(response.location);
      } else {
        console.log('Ambulance location not available');
      }
    });
  }
  
  leaveTrip() {
    if (!this.currentTripId) return;
    
    // Stop location tracking
    if (this.watchId) {
      navigator.geolocation.clearWatch(this.watchId);
    }
    
    this.socket.emit('leave_trip', {
      tripId: this.currentTripId
    }, (response) => {
      console.log('Left trip:', response);
      this.currentTripId = null;
    });
  }
  
  disconnect() {
    this.leaveTrip();
    this.socket.disconnect();
  }
  
  // Callback methods (override these)
  onConnect() {}
  onAmbulanceJoined(data) {}
  onAmbulanceLocationUpdate(location) {}
  onEmergencySOS(data) {}
}

// Usage
const tracker = new TripTracker('http://localhost:3000', userAccessToken);

tracker.onConnect = () => {
  console.log('Ready to track!');
};

tracker.onAmbulanceJoined = (data) => {
  showNotification('Ambulance has joined your trip');
};

tracker.onAmbulanceLocationUpdate = (location) => {
  updateMapMarker('ambulance', location);
  calculateETA(location);
};

tracker.onEmergencySOS = (data) => {
  showUrgentAlert(`SOS from ${data.userRole}: ${data.message}`);
};

// Start tracking
tracker.joinTrip('507f1f77bcf86cd799439011');

// Send SOS
tracker.sendSOS('Patient condition critical!');

// Cleanup
tracker.disconnect();
```

### Complete Ambulance Implementation

```javascript
class AmbulanceTracker {
  constructor(serverUrl, accessToken) {
    this.socket = io(serverUrl, {
      auth: { token: accessToken },
      transports: ['websocket', 'polling']
    });
    
    this.currentTripId = null;
    this.locationInterval = null;
    this.setupListeners();
  }
  
  setupListeners() {
    this.socket.on('connect', () => {
      console.log('Ambulance connected:', this.socket.id);
    });
    
    this.socket.on('connected', (data) => {
      console.log('Authenticated as:', data.userRole);
    });
    
    this.socket.on('location_updated', (data) => {
      if (data.userRole === 'user') {
        this.onPatientLocationUpdate(data.location);
      }
    });
    
    this.socket.on('emergency_sos', (data) => {
      if (data.userRole === 'user') {
        this.onPatientSOS(data);
      }
    });
  }
  
  acceptTrip(tripId) {
    this.currentTripId = tripId;
    
    this.socket.emit('join_trip', { tripId }, (response) => {
      if (response.success) {
        console.log('Joined trip:', response.trip);
        this.startLocationBroadcast();
        this.getPatientLocation();
      }
    });
  }
  
  startLocationBroadcast() {
    // Send location every 3 seconds
    this.locationInterval = setInterval(() => {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition((position) => {
          this.sendLocation({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            speed: position.coords.speed
          });
        });
      }
    }, 3000);
  }
  
  sendLocation(location) {
    if (!this.currentTripId) return;
    
    this.socket.emit('location_update', {
      tripId: this.currentTripId,
      location
    });
  }
  
  getPatientLocation() {
    if (!this.currentTripId) return;
    
    this.socket.emit('get_location', {
      tripId: this.currentTripId,
      targetRole: 'user'
    }, (response) => {
      if (response.success) {
        this.onPatientLocationUpdate(response.location);
      }
    });
  }
  
  completeTrip() {
    if (this.locationInterval) {
      clearInterval(this.locationInterval);
    }
    
    this.socket.emit('leave_trip', {
      tripId: this.currentTripId
    }, () => {
      console.log('Trip completed');
      this.currentTripId = null;
    });
  }
  
  // Callbacks
  onPatientLocationUpdate(location) {}
  onPatientSOS(data) {}
}

// Usage
const ambulance = new AmbulanceTracker('http://localhost:3000', ambulanceToken);

ambulance.onPatientLocationUpdate = (location) => {
  updateMapRoute(location);
  console.log('Patient at:', location);
};

ambulance.onPatientSOS = (data) => {
  playAlertSound();
  showAlert('PATIENT EMERGENCY: ' + data.message);
};

ambulance.acceptTrip('507f1f77bcf86cd799439011');
```

### React Hook Example

```javascript
import { useEffect, useState } from 'react';
import io from 'socket.io-client';

function useTripTracking(tripId, accessToken) {
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);
  const [ambulanceLocation, setAmbulanceLocation] = useState(null);
  const [participants, setParticipants] = useState([]);
  
  useEffect(() => {
    if (!tripId || !accessToken) return;
    
    // Initialize socket
    const newSocket = io('http://localhost:3000', {
      auth: { token: accessToken },
      transports: ['websocket', 'polling']
    });
    
    // Connection events
    newSocket.on('connect', () => {
      setConnected(true);
      
      // Join trip
      newSocket.emit('join_trip', { tripId }, (response) => {
        if (response.success) {
          console.log('Joined trip successfully');
        }
      });
    });
    
    newSocket.on('disconnect', () => {
      setConnected(false);
    });
    
    // Trip events
    newSocket.on('participant_joined', (data) => {
      setParticipants(prev => [...prev, data]);
    });
    
    newSocket.on('participant_left', (data) => {
      setParticipants(prev => 
        prev.filter(p => p.userId !== data.userId)
      );
    });
    
    newSocket.on('location_updated', (data) => {
      if (data.userRole === 'ambulance') {
        setAmbulanceLocation(data.location);
      }
    });
    
    newSocket.on('emergency_sos', (data) => {
      // Handle SOS
      alert(`EMERGENCY: ${data.message}`);
    });
    
    setSocket(newSocket);
    
    // Cleanup
    return () => {
      if (newSocket) {
        newSocket.emit('leave_trip', { tripId });
        newSocket.disconnect();
      }
    };
  }, [tripId, accessToken]);
  
  // Send location
  const sendLocation = (location) => {
    if (socket && connected) {
      socket.emit('location_update', {
        tripId,
        location
      });
    }
  };
  
  // Send SOS
  const sendSOS = (message) => {
    if (socket && connected) {
      socket.emit('emergency_sos', {
        tripId,
        message
      });
    }
  };
  
  return {
    connected,
    ambulanceLocation,
    participants,
    sendLocation,
    sendSOS
  };
}

// Usage in component
function TripScreen({ tripId, accessToken }) {
  const {
    connected,
    ambulanceLocation,
    participants,
    sendLocation,
    sendSOS
  } = useTripTracking(tripId, accessToken);
  
  useEffect(() => {
    // Start tracking user location
    const watchId = navigator.geolocation.watchPosition((position) => {
      sendLocation({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude
      });
    });
    
    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
  }, [sendLocation]);
  
  return (
    <div>
      <h1>Trip Tracking</h1>
      <p>Status: {connected ? 'Connected' : 'Disconnected'}</p>
      <p>Participants: {participants.length}</p>
      
      {ambulanceLocation && (
        <div>
          <h2>Ambulance Location</h2>
          <p>Lat: {ambulanceLocation.latitude}</p>
          <p>Lng: {ambulanceLocation.longitude}</p>
        </div>
      )}
      
      <button onClick={() => sendSOS('HELP!')}>
        🚨 Send SOS
      </button>
    </div>
  );
}
```

---

## Summary

### Key Points to Remember

1. **Always authenticate** with JWT token in socket connection
2. **Join trip room** before sending/receiving trip-specific events
3. **Throttle location updates** to 3-5 seconds intervals
4. **Use callbacks** for error handling on all emitted events
5. **Clean up** event listeners and leave rooms on unmount
6. **Handle reconnection** by re-joining rooms and resuming tracking
7. **SOS events** are critical - never dismiss without user acknowledgment
8. **Location updates** are frequent - optimize UI rendering

### Event Priority

1. **Critical:** `emergency_sos` - Must never be missed
2. **High:** `location_updated` - Core functionality
3. **Medium:** `participant_joined/left` - User awareness
4. **Low:** `participant_disconnected` - Nice to have

### Testing Checklist

- [ ] Socket connects with valid token
- [ ] Socket rejects invalid/expired tokens
- [ ] Can join trip room successfully
- [ ] Receives location updates from other participants
- [ ] Can send location updates
- [ ] SOS alerts are received and displayed
- [ ] Handles disconnect and reconnect gracefully
- [ ] Cleans up on component unmount
- [ ] Works on poor network conditions
- [ ] Multiple participants can be in same trip

---

## Support


**Testing Server:** Use the provided HTML test client to verify socket functionality before integrating into your app.

---

**Document Version:** 1.0  
**Last Updated:** January 28, 2026  