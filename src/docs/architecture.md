# MedSwift System Architecture

**Last Updated:** February 13, 2026  
**Version:** 2.0

---

## Table of Contents

1. [High-Level Architecture](#high-level-architecture)
2. [Module Structure](#module-structure)
3. [Authentication System](#authentication-system)
4. [Redis Infrastructure](#redis-infrastructure)
5. [Trip Lifecycle](#trip-lifecycle)
6. [Auto-Dispatch Algorithm](#auto-dispatch-algorithm)
7. [Socket.IO Architecture](#socketio-architecture)
8. [Data Models](#data-models)
9. [Middleware Pipeline](#middleware-pipeline)
10. [Deployment Architecture](#deployment-architecture)

---

## High-Level Architecture

```mermaid
graph TB
    subgraph Clients
        PA[Patient App]
        AM[Ambulance App]
        HO[Hospital Dashboard]
        AD[Admin Dashboard]
    end

    subgraph "API Gateway"
        RL[Rate Limiter<br>Redis Store]
        HM[Helmet<br>Security Headers]
        CORS[CORS]
    end

    subgraph "Express.js Server"
        direction TB
        UR[User Routes]
        AR[Ambulance Routes]
        HR[Hospital Routes]
        TR[Trip Routes]
        ADR[Admin Routes]
    end

    subgraph "Shared Infrastructure"
        AUTH[JWT Auth Middleware]
        VAL[Zod Validation]
        SIO[Socket.IO Server]
    end

    subgraph "Data Layer"
        MONGO[(MongoDB<br>Primary Store)]
        REDIS[(Redis<br>Cache + Geo)]
    end

    PA & AM & HO & AD --> RL --> HM --> CORS
    CORS --> UR & AR & HR & TR & ADR
    UR & AR & HR & TR & ADR --> AUTH --> VAL
    PA & AM & AD -.->|WebSocket| SIO

    AUTH --> MONGO
    TR --> REDIS
    AR --> REDIS
    HR --> REDIS
    SIO --> REDIS
```

MedSwift is a **monolithic TypeScript backend** built with Express.js v5 and Socket.IO. It uses MongoDB as the primary data store and Redis for real-time geospatial operations, socket session management, and location caching.

---

## Module Structure

The codebase follows a **modular monolith** pattern with a layered architecture per module:

```
src/modules/{module}/
├── model/          → Mongoose schema + instance methods
├── controllers/    → Request handlers (thin, delegates to services)
├── services/       → Business logic, Redis operations
├── routes/         → Express router + middleware chain
└── {module}.dto/   → Zod schemas for validation + TypeScript types
```

### Module Dependency Map

```mermaid
graph LR
    TRIP[Trip Module] --> AMB[Ambulance Module]
    TRIP --> USER[User Module]
    TRIP --> HOSP[Hospital Module]
    TRIP --> SOCKET[Socket Infrastructure]
    
    AMB --> REDIS[Redis Service]
    HOSP --> REDIS
    SOCKET --> REDIS
    
    ADMIN[Admin Module] --> REDIS
    
    USER -.->|no deps| USER
    ADMIN -.->|no deps| ADMIN
```

The **Trip module** is the central orchestrator — it depends on Ambulance (dispatch), User (patient), Hospital (destination), and Socket.IO (real-time events).

---

## Authentication System

### JWT Token Architecture

```mermaid
sequenceDiagram
    participant C as Client
    participant S as Server
    participant DB as MongoDB

    C->>S: POST /login (credentials)
    S->>DB: Find user, verify password
    DB-->>S: User document
    S->>S: Generate access token (15 min)
    S->>S: Generate refresh token (7 days)
    S->>DB: Save refresh token
    S-->>C: Set HTTP-only cookies + JSON response

    C->>S: Subsequent request (cookie auto-sent)
    S->>S: Verify access token
    S->>DB: Fetch user by ID
    S-->>C: Response
```

### Token Generation

| Token | TTL | Secret | Payload |
|-------|-----|--------|---------|
| Access Token | 15 minutes | `ACCESS_TOKEN_SECRET` | `{ id, role }` |
| Refresh Token | 7 days | `REFRESH_TOKEN_SECRET` | `{ id, role }` |

**Roles:** `user`, `ambulance`, `hospital`, `admin`

### Password Hashing

Uses **argon2** (via `auth.util.ts`):
- `hashPassword()` → argon2 hash
- `verifyPassword()` → argon2 verify

### Cookie Configuration

```typescript
{
  httpOnly: true,                    // Not accessible via JS
  secure: NODE_ENV === "production", // HTTPS only in prod
  sameSite: "strict"                 // CSRF protection
}
```

---

## Redis Infrastructure

Redis serves three critical roles:

### 1. Geospatial Indexes

Ambulance and hospital locations are stored as Redis geo sets for O(log N) proximity searches.

| Key | Type | Purpose |
|-----|------|---------|
| `ambulance_locations` | GEO SET | Available ambulances for dispatch |
| `hospital_locations` | GEO SET | Registered hospitals for proximity search |

**Operations:**
- `GEOADD` — Add/update member location
- `GEOSEARCH` — Find members within radius (with distance + coordinates)
- `ZREM` — Remove member (logout/offline)
- `ZCARD` — Count active members

### 2. Socket Session Management

| Key Pattern | Type | TTL | Purpose |
|-------------|------|-----|---------|
| `socket:mapping` | HASH | — | `socketId → { userId, userRole, connectedAt }` |
| `socket:{role}:{userId}` | STRING | 1 hour | Reverse lookup: userId → socketId |
| `trip_participants:{tripId}` | SET | — | Set of socket IDs in a trip room |

### 3. Location Cache

| Key Pattern | Type | TTL | Purpose |
|-------------|------|-----|---------|
| `location:{role}:{tripId}` | STRING (JSON) | 5 min | Latest location data during active trip |

### Data Flow: Redis in Auto-Dispatch

```mermaid
sequenceDiagram
    participant A as Ambulance
    participant API as Trip API
    participant R as Redis
    participant M as MongoDB

    Note over A: Login & sync_initial_location
    A->>R: GEOADD ambulance_locations (lng, lat, id)

    Note over API: Trip creation
    API->>R: GEOSEARCH ambulance_locations (5km)
    R-->>API: Nearest ambulance ID + distance
    API->>M: Update trip (assign ambulance)
    API->>R: ZREM ambulance_locations (assigned ambulance)
    API->>M: Set ambulance status = "on-trip"
```

---

## Trip Lifecycle

### State Machine

```mermaid
stateDiagram-v2
    [*] --> SEARCHING: Trip Created
    SEARCHING --> ACCEPTED: Ambulance Assigned
    SEARCHING --> CANCELLED: User Cancels

    ACCEPTED --> ARRIVED_PICKUP: Driver Arrives
    ACCEPTED --> CANCELLED: User Cancels

    ARRIVED_PICKUP --> EN_ROUTE_HOSPITAL: Patient Loaded
    ARRIVED_PICKUP --> CANCELLED: User Cancels

    EN_ROUTE_HOSPITAL --> ARRIVED_HOSPITAL: Reached Hospital
    EN_ROUTE_HOSPITAL --> CANCELLED: User Cancels

    ARRIVED_HOSPITAL --> COMPLETED: Handoff Done
    ARRIVED_HOSPITAL --> CANCELLED: User Cancels

    COMPLETED --> [*]
    CANCELLED --> [*]
```

### Status & Transitions

| Status | Set By | Next Allowed | Description |
|--------|--------|-------------|-------------|
| `SEARCHING` | System | `ACCEPTED`, `CANCELLED` | Trip created, searching for ambulance |
| `ACCEPTED` | System | `ARRIVED_PICKUP`, `CANCELLED` | Ambulance assigned, en route to patient |
| `ARRIVED_PICKUP` | Ambulance | `EN_ROUTE_HOSPITAL`, `CANCELLED` | Ambulance at pickup location |
| `EN_ROUTE_HOSPITAL` | Ambulance | `ARRIVED_HOSPITAL`, `CANCELLED` | Patient aboard, heading to hospital |
| `ARRIVED_HOSPITAL` | Ambulance | `COMPLETED`, `CANCELLED` | Arrived at hospital |
| `COMPLETED` | Ambulance | — | Trip finished, ambulance released |
| `CANCELLED` | User | — | Trip aborted at any stage |

### Events Emitted Per Transition

| Transition | Socket Event | Target |
|-----------|-------------|--------|
| → `ACCEPTED` (auto) | `ambulance_assigned` | `user:{userId}` room |
| → `ACCEPTED` (auto) | `new_trip_assigned` | `ambulance:{ambulanceId}` room |
| → `ACCEPTED` (auto) | `trip_auto_assigned` | `admin-room` |
| `SEARCHING` (no ambulance) | `new_trip_request` | `ambulance-room` |
| Any status change | `trip_status_updated` | `trip:{tripId}` room |
| → `CANCELLED` | `trip_cancelled` | `trip:{tripId}` room |
| → `COMPLETED` | Ambulance status → `"ready"` | Redis geo index |

---

## Auto-Dispatch Algorithm

The dispatch system finds the nearest available ambulance using Redis geospatial queries with automatic radius failover.

### Algorithm

```mermaid
flowchart TD
    START[Trip Created] --> R1{Search 5km}
    R1 -->|Found| ASSIGN[Assign Nearest]
    R1 -->|Empty| R2{Search 10km}
    R2 -->|Found| ASSIGN
    R2 -->|Empty| R3{Search 17km}
    R3 -->|Found| ASSIGN
    R3 -->|Empty| R4{Search 30km}
    R4 -->|Found| ASSIGN
    R4 -->|Empty| NONE[No Ambulance<br>Status: SEARCHING]

    ASSIGN --> UPDATE[Set ambulance on-trip<br>Remove from pool<br>Emit socket events]
```

### Search Parameters

- **Radii:** 5km → 10km → 17km → 30km
- **Sort:** `ASC` (nearest first)
- **Pool:** Only ambulances with status `"ready"` in `ambulance_locations` geo set
- **Atomicity:** On assignment, ambulance is immediately removed from the geo set to prevent double-dispatch

### Race Condition Prevention

The system handles concurrent requests by:
1. Using MongoDB's `findOneAndUpdate` with `status: "ready"` filter
2. Immediately removing the ambulance from Redis geo index after assignment
3. If the MongoDB update returns `null` (ambulance already taken), the system moves to the next candidate

---

## Socket.IO Architecture

### Connection Flow

```mermaid
sequenceDiagram
    participant C as Client
    participant MW as Auth Middleware
    participant CH as Connection Handler
    participant R as Redis

    C->>MW: Connect (JWT in auth.token)
    MW->>MW: Verify JWT
    MW->>MW: Fetch user from MongoDB
    MW-->>CH: Authenticated socket

    CH->>R: HSET socket:mapping
    CH->>R: SET socket:{role}:{id}
    CH->>CH: Auto-join role rooms
    CH->>CH: Register event handlers
    CH-->>C: emit "connected"
```

### Room Architecture

| Room | Members | Events Received |
|------|---------|----------------|
| `admin-room` | All connected admins | `new_trip_request`, `emergency_sos` |
| `ambulance-room` | All connected ambulances | Broadcast notifications |
| `ambulance:{id}` | Specific ambulance | `ambulance_assigned` |
| `user:{id}` | Specific user | Direct messages |
| `trip:{tripId}` | Trip participants | `location_updated`, `trip_status_updated`, `participant_joined/left` |

### Server-Side Emitter Functions

```typescript
// From socket.config.ts
emitToTrip(tripId, event, data)   // → trip:{tripId} room
emitToAdmins(event, data)         // → admin-room
```

> Full event reference: [sockethandling.md](./sockethandling.md)

---

## Data Models

### Entity Relationship

```mermaid
erDiagram
    USER {
        ObjectId _id
        string name
        string phone
        string password
        GeoJSON location
        string refreshToken
    }

    AMBULANCE {
        ObjectId _id
        string driverName
        string driverPhone
        string password
        string vehicleNumber
        enum status
        GeoJSON location
        string refreshToken
    }

    HOSPITAL {
        ObjectId _id
        string name
        string email
        string password
        string phone
        string address
        GeoJSON location
        object inventory
        string refreshToken
    }

    TRIP {
        ObjectId _id
        ObjectId userId
        ObjectId ambulanceId
        ObjectId destinationHospitalId
        enum status
        object pickup
        object dropoff
        object patientSnapshot
        array timeline
    }

    ADMIN {
        ObjectId _id
        string name
        string email
        string password
        string refreshToken
    }

    USER ||--o{ TRIP : creates
    AMBULANCE ||--o{ TRIP : assigned_to
    HOSPITAL ||--o{ TRIP : destination
```

### Geospatial Indexes

All location fields use **GeoJSON Point** format with **2dsphere** indexes:

```typescript
location: {
  type: "Point",                    // Always "Point"
  coordinates: [longitude, latitude] // [lng, lat] — GeoJSON order
}
```

> [!IMPORTANT]
> GeoJSON uses `[longitude, latitude]` order, NOT `[latitude, longitude]`. This is a common source of bugs.

---

## Middleware Pipeline

### HTTP Request Pipeline

```
Request → Rate Limiter → Helmet → CORS → Cookie Parser → JSON Parser
       → Route Matching → Auth Middleware → Zod Validation → Controller
       → Error Handler
```

### Rate Limiting

```typescript
{
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 100,                    // 100 requests per window
  store: RedisStore            // Distributed via Redis
}
```

### Validation Middleware

Uses the `validate()` middleware with Zod schemas:

```typescript
router.post(
  "/register",
  validate(z.object({ body: createUserSchema })),
  registerUser
);
```

The middleware validates `req.body`, `req.query`, and `req.params` against the schema. On failure, returns a `400` error with field-level error messages.

---

## Deployment Architecture

### Docker Compose Stack

```mermaid
graph LR
    subgraph "Docker Network: medswift_network"
        FE[Frontend<br>Port 80<br>Nginx] 
        BE[Backend<br>Port 5000<br>Node.js]
        TN[Cloudflare Tunnel<br>cloudflared]
    end

    subgraph "External Services"
        MDB[(MongoDB Atlas)]
        RDS[(Redis Cloud)]
    end

    INTERNET[Internet] --> TN --> FE --> BE
    BE --> MDB
    BE --> RDS
```

| Container | Image | Port | Purpose |
|-----------|-------|------|---------|
| `medswift_backend` | Custom (Dockerfile) | 5000 | API + Socket.IO server |
| `medswift_frontend` | Custom (frontend/Dockerfile) | 80 | React dashboard via Nginx |
| `medswift_tunnel` | `cloudflare/cloudflared` | — | Public URL tunneling |

### Build Process

```
TypeScript → tsc → dist/index.js → node dist/index.js
```

The `Dockerfile` uses `pnpm` with frozen lockfile for reproducible builds.
