# MedSwift REST API Reference

**Base URL:** `/api/v2`  
**Interactive Docs:** Available at `/api-docs` (Swagger UI)  
**Last Updated:** February 13, 2026

---

## Table of Contents

1. [Authentication](#authentication)
2. [Response Format](#response-format)
3. [User Endpoints](#user-endpoints)
4. [Ambulance Endpoints](#ambulance-endpoints)
5. [Hospital Endpoints](#hospital-endpoints)
6. [Trip Endpoints](#trip-endpoints)
7. [Admin Endpoints](#admin-endpoints)

---

## Authentication

MedSwift uses **JWT access/refresh token** authentication with **HTTP-only cookies**.

### Token Flow

1. **Login** → Receive `accessToken` (15 min) and `refreshToken` (7 days) as cookies
2. **Requests** → Token read from `accessToken` cookie or `Authorization: Bearer <token>` header
3. **Logout** → Tokens cleared from cookies and refresh token nullified in DB

### Role-Based Middleware

| Middleware | Validates Role | Attaches to `req.` |
|-----------|---------------|-------------------|
| `verifyUserJWT` | `user` | `req.user` |
| `verifyAmbulanceJWT` | `ambulance` | `req.ambulance` |
| `verifyHospitalJWT` | `hospital` | `req.hospital` |
| `verifyAdminJWT` | `admin` | `req.admin` |
| `verifyJWT` | Any role | Role-specific property |

---

## Response Format

### Success Response

```json
{
  "statusCode": 200,
  "data": { ... },
  "message": "Operation successful",
  "success": true
}
```

### Error Response

```json
{
  "statusCode": 400,
  "data": null,
  "message": "Validation failed",
  "success": false,
  "errors": [
    { "field": "body.email", "message": "Invalid email format" }
  ]
}
```

---

## User Endpoints

Users are patients who request emergency ambulance services.

---

### `POST /user/register`

Register a new user account.

**Auth:** Public  
**Validation:** `createUserSchema` (Zod)

**Request Body:**

```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "phone": "9876543210",
  "password": "securepassword",
  "bloodGroup": "O+",
  "medicalHistory": "Diabetic, allergic to penicillin",
  "location": {
    "type": "Point",
    "coordinates": [77.5946, 12.9716]
  }
}
```

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `name` | string | Yes | Trimmed, lowercased, min 1 char |
| `email` | string | Yes | Valid email, lowercased, unique |
| `phone` | string | Yes | Min 10 digits, regex validated, unique |
| `password` | string | Yes | Min 6 characters |
| `bloodGroup` | enum | Yes | `"A+"`, `"A-"`, `"B+"`, `"B-"`, `"O+"`, `"O-"`, `"AB+"`, `"AB-"` |
| `medicalHistory` | string | No | Free text |
| `location` | GeoJSON Point | Yes | `[longitude, latitude]` |

**Response (201):**

```json
{
  "statusCode": 201,
  "data": {
    "user": {
      "_id": "...",
      "name": "john doe",
      "email": "john@example.com",
      "phone": "9876543210",
      "bloodGroup": "O+",
      "location": { "type": "Point", "coordinates": [77.5946, 12.9716] }
    },
    "accessToken": "eyJhbG...",
    "refreshToken": "eyJhbG..."
  },
  "message": "User registered successfully"
}
```

**Error Codes:** `400` (validation), `409` (email or phone already registered)

---

### `POST /user/login`

Login with **email or phone** and password.

**Auth:** Public  
**Validation:** `userEmailPhoneLoginSchema`

**Request Body (email):**

```json
{
  "email": "john@example.com",
  "password": "securepassword"
}
```

**Request Body (phone):**

```json
{
  "phone": "9876543210",
  "password": "securepassword"
}
```

> [!NOTE]
> Either `email` or `phone` must be provided (at least one). Both are optional individually.

**Response (200):** User object + tokens. Sets `accessToken` and `refreshToken` cookies.

**Error Codes:** `400` (validation, must provide email or phone), `401` (invalid credentials)

---

### `POST /user/logout`

Logout and clear all tokens.

**Auth:** `verifyUserJWT`

**Response (200):**

```json
{
  "statusCode": 200,
  "data": {},
  "message": "User logged out successfully"
}
```

---

### `GET /user/me`

Get the authenticated user's profile.

**Auth:** `verifyUserJWT`

**Response (200):**

```json
{
  "statusCode": 200,
  "data": {
    "_id": "...",
    "name": "john doe",
    "email": "john@example.com",
    "phone": "9876543210",
    "bloodGroup": "O+",
    "medicalHistory": "Diabetic",
    "location": { "type": "Point", "coordinates": [77.5946, 12.9716] },
    "createdAt": "...",
    "updatedAt": "..."
  },
  "message": "User profile fetched successfully"
}
```

---

## Ambulance Endpoints

Ambulances are emergency vehicles with drivers that respond to trip requests.

---

### `POST /ambulance/register`

Register a new ambulance.

**Auth:** Public  
**Validation:** `createAmbulanceSchema`

**Request Body:**

```json
{
  "driverName": "Rajesh Kumar",
  "driverPhone": "9876543210",
  "password": "securepass",
  "vehicleNumber": "KA01AB1234",
  "location": {
    "type": "Point",
    "coordinates": [77.5946, 12.9716]
  },
  "status": "offline"
}
```

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `driverName` | string | Yes | Trimmed, min 1 char |
| `driverPhone` | string | Yes | Min 10 digits, regex validated |
| `password` | string | Yes | Min 6 characters |
| `vehicleNumber` | string | Yes | Auto-uppercased |
| `location` | GeoJSON Point | Yes | `[longitude, latitude]` |
| `status` | enum | No | `"ready"` \| `"on-trip"` \| `"offline"` (default: `"offline"`) |

**Response (201):** Ambulance object + tokens.

**Error Codes:** `400` (validation), `409` (phone or vehicle number exists)

---

### `POST /ambulance/login`

Login with driver phone and password.

**Auth:** Public  
**Validation:** `ambulanceLoginSchema`

**Request Body:**

```json
{
  "driverPhone": "9876543210",
  "password": "securepass"
}
```

**Response (200):** Ambulance object + tokens.

**Side effects:** Sets cookies, syncs ambulance location to Redis geo index.

---

### `POST /ambulance/logout`

**Auth:** `verifyAmbulanceJWT`

**Side effects:** Clears cookies, removes ambulance from Redis geo index.

---

### `GET /ambulance/me`

Get ambulance profile.

**Auth:** `verifyAmbulanceJWT`

---

### `PATCH /ambulance/status`

Update ambulance operational status.

**Auth:** `verifyAmbulanceJWT`  
**Validation:** `updateStatusSchema`

**Request Body:**

```json
{
  "status": "ready"
}
```

| Value | Meaning | Redis Effect |
|-------|---------|-------------|
| `"ready"` | Available for dispatch | `GEOADD` to `ambulance_locations` |
| `"on-trip"` | Currently on a trip | `ZREM` from `ambulance_locations` |
| `"offline"` | Not available | `ZREM` from `ambulance_locations` |

---

### `PATCH /ambulance/location`

Update ambulance GPS location.

**Auth:** `verifyAmbulanceJWT`  
**Validation:** `updateLocationSchema`

**Request Body:**

```json
{
  "location": {
    "type": "Point",
    "coordinates": [77.5946, 12.9716]
  }
}
```

**Side effects:** Updates MongoDB and syncs to Redis geo index.

---

### `GET /ambulance/nearby`

Find nearby available ambulances using Redis geospatial search with automatic radius failover (5km → 10km → 17km → 30km).

**Auth:** Public

**Query Parameters:**

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `longitude` | number | Yes | — | Search center longitude |
| `latitude` | number | Yes | — | Search center latitude |
| `limit` | number | No | 10 | Max results |

**Response (200):**

```json
{
  "statusCode": 200,
  "data": {
    "count": 3,
    "ambulances": [
      {
        "ambulanceId": "...",
        "distance": 1200,
        "ambulanceData": { ... }
      }
    ]
  }
}
```

---

### `GET /ambulance/stats`

Get active ambulance statistics (count of ambulances in Redis geo index).

**Auth:** Public

**Response (200):**

```json
{
  "statusCode": 200,
  "data": {
    "activeAmbulances": 5,
    "ambulanceIds": ["id1", "id2", ...]
  }
}
```

---

## Hospital Endpoints

Hospitals register their location, bed availability, and blood stock.

---

### `POST /hospital/register`

Register a new hospital.

**Auth:** Public  
**Validation:** `createHospitalSchema`

**Request Body:**

```json
{
  "name": "City General Hospital",
  "email": "admin@citygeneral.com",
  "password": "securepass",
  "phone": "08012345678",
  "address": "123 Medical Drive, Bangalore",
  "location": {
    "type": "Point",
    "coordinates": [77.5946, 12.9716]
  },
  "inventory": {
    "beds": { "total": 100, "available": 42 },
    "bloodStock": {
      "A_positive": 10, "A_negative": 5,
      "B_positive": 8,  "B_negative": 3,
      "O_positive": 15, "O_negative": 7,
      "AB_positive": 4, "AB_negative": 2
    }
  }
}
```

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `name` | string | Yes | Hospital name |
| `email` | string | Yes | Unique, lowercased |
| `password` | string | Yes | Min 6 chars |
| `phone` | string | Yes | Min 10 digits |
| `address` | string | Yes | Full address |
| `location` | GeoJSON Point | Yes | `[longitude, latitude]` |
| `inventory` | object | No | Auto-defaults to zeros |

**Response (201):** Hospital object + tokens.

---

### `POST /hospital/login`

Login with email and password. **Side effects:** Syncs to Redis geo index.

**Auth:** Public

---

### `POST /hospital/logout`

**Auth:** `verifyHospitalJWT`. **Side effects:** Removes from Redis geo index.

---

### `GET /hospital/me`

**Auth:** `verifyHospitalJWT`

---

### `PATCH /hospital/inventory`

Update bed count and/or blood stock.

**Auth:** `verifyHospitalJWT`  
**Validation:** `updateInventorySchema`

**Request Body:**

```json
{
  "beds": { "total": 100, "available": 38 },
  "bloodStock": { "O_positive": 12, "A_negative": 3 }
}
```

> [!NOTE]
> Both `beds` and `bloodStock` are optional. You can update individual blood types without sending all 8. Available beds cannot exceed total.

---

### `PATCH /hospital/location`

**Auth:** `verifyHospitalJWT`  
**Side effects:** Updates MongoDB + Redis geo index.

---

### `GET /hospital/nearby`

Find nearby hospitals with optional filtering using Redis geo search with failover (5km → 10km → 17km → 30km).

**Auth:** Public

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `longitude` | number | Yes | — | Search center longitude |
| `latitude` | number | Yes | — | Search center latitude |
| `limit` | number | No | 10 | Max results (1-50) |
| `bloodType` | string | No | — | `A+`, `A-`, `B+`, `B-`, `O+`, `O-`, `AB+`, `AB-` |
| `requireBeds` | boolean | No | false | Only hospitals with available beds |

---

## Trip Endpoints

Trips represent the full emergency dispatch lifecycle.

### Trip Status Lifecycle

```
SEARCHING → ACCEPTED → ARRIVED_PICKUP → EN_ROUTE_HOSPITAL → ARRIVED_HOSPITAL → COMPLETED
     ↓                                                                            
  CANCELLED  ←←←←←←←← (cancelable from any active status)
```

### Trip Data Model

The trip uses `pickup` / `dropoff` (not `pickupLocation` / `hospitalLocation`):

```typescript
{
  userId: ObjectId,
  ambulanceId?: ObjectId,
  destinationHospitalId?: ObjectId,
  status: TripStatus,
  pickup: { address?: string, coordinates: [lng, lat] },
  dropoff?: { address?: string, coordinates?: [lng, lat] },
  patientSnapshot: { userId, name, phone, bloodGroup, medicalHistory },
  timeline: [{ status, timestamp, location?, updatedBy? }],
  acceptedAt?, arrivedAtPickup?, arrivedAtHospital?, completedAt?
}
```

---

### `POST /trip/request`

Request an ambulance. Automatically searches for and assigns the nearest available ambulance via Redis geo search.

**Auth:** `verifyUserJWT`  
**Validation:** `createTripSchema`

**Request Body:**

```json
{
  "pickupCoordinates": [77.5946, 12.9716],
  "pickupAddress": "123 Main Street, Bangalore",
  "destinationHospitalId": "optional-hospital-mongo-id",
  "bloodType": "O+",
  "requireBeds": false
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `pickupCoordinates` | `[lng, lat]` | Yes | Pickup location as `[longitude, latitude]` tuple |
| `pickupAddress` | string | No | Human-readable address |
| `destinationHospitalId` | string | No | Specific hospital ObjectId |
| `bloodType` | enum | No | Used for hospital filtering: `A+`, `A-`, `B+`, etc. |
| `requireBeds` | boolean | No | Require hospital to have available beds (default: false) |

**Auto-dispatch algorithm:**
1. Search Redis geo index `ambulance_locations` near pickup coordinates
2. Failover radii: 5km → 10km → 17km → 30km
3. If found: assign nearest ambulance → status becomes `ACCEPTED`
4. If not found: create trip with status `SEARCHING`, broadcast `new_trip_request` to ambulance-room

**Response (201):**

```json
{
  "statusCode": 201,
  "data": { ... trip object ... },
  "message": "Ambulance request created successfully. Searching for available ambulances..."
}
```

---

### `GET /trip/active`

Get the currently active trip for the authenticated user.

**Auth:** `verifyUserJWT`

Returns `null` if no active trip.

---

### `GET /trip/history`

Get the user's past trip history.

**Auth:** `verifyUserJWT`

**Query Parameters:**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `limit` | number | 10 | Max trips to return |

---

### `POST /trip/:tripId/cancel`

Cancel an active trip. Can be called by either the user or the assigned ambulance.

**Auth:** `verifyJWT` (any role — user or ambulance)

**What happens:**
1. Trip status set to `CANCELLED`
2. If ambulance was assigned: status reset to `"ready"`, added back to Redis dispatch pool
3. `trip_cancelled` emitted to trip room

---

### `GET /trip/ambulance/active`

Get the currently active trip for the authenticated ambulance driver.

**Auth:** `verifyAmbulanceJWT`

Returns `null` if no active trip.

---

### `POST /trip/:tripId/accept`

Ambulance manually accepts a `SEARCHING` trip (used when auto-dispatch didn't find anyone and the trip was broadcast to all ambulances).

**Auth:** `verifyAmbulanceJWT`

**Response (200):** Updated trip object with ambulance assigned.

---

### `PATCH /trip/:tripId/status`

Update trip status to the next stage. Called by the ambulance driver.

**Auth:** `verifyAmbulanceJWT`  
**Validation:** `updateTripStatusSchema`

**Request Body:**

```json
{
  "status": "ARRIVED_PICKUP",
  "location": [77.5946, 12.9716]
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `status` | enum | Yes | Next status value |
| `location` | `[lng, lat]` | No | Coordinates where status change occurred |

**Allowed transitions:**

| Current Status | Allowed Next Status |
|---------------|-------------------|
| `ACCEPTED` | `ARRIVED_PICKUP` |
| `ARRIVED_PICKUP` | `EN_ROUTE_HOSPITAL` |
| `EN_ROUTE_HOSPITAL` | `ARRIVED_HOSPITAL` |
| `ARRIVED_HOSPITAL` | `COMPLETED` |

**On `COMPLETED`:** Ambulance status reset to `"ready"`, added back to Redis dispatch pool.

**Side effects:** `trip_status_updated` emitted to trip room. Timeline entry added.

---

### `GET /trip/:tripId`

Get full trip details by ID. Accessible by the trip's user, assigned ambulance, or admin.

**Auth:** `verifyJWT` (checks authorization — must be a participant or admin)

---

### `GET /trip/admin/all`

List all trips with pagination and optional status filter.

**Auth:** `verifyAdminJWT`

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `status` | string | — | Filter by trip status |
| `limit` | number | 50 | Items per page |
| `page` | number | 1 | Page number |

**Response (200):**

```json
{
  "statusCode": 200,
  "data": {
    "trips": [ ... ],
    "pagination": { "total": 150, "page": 1, "limit": 50, "pages": 3 }
  }
}
```

---

## Admin Endpoints

Admins have system-wide access for monitoring and debugging.

---

### `POST /admin/register`

Register a new admin. Protected by a secret key.

**Auth:** Public (but requires `secretKey`)

**Request Body:**

```json
{
  "name": "Admin User",
  "email": "admin@medswift.com",
  "password": "strongpassword",
  "secretKey": "your-admin-creation-secret"
}
```

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `name` | string | Yes | Min 1 char |
| `email` | string | Yes | Valid email, lowercased |
| `password` | string | Yes | Min 8 characters |
| `secretKey` | string | Yes | Must match `ADMIN_CREATION_SECRET` env var |

> [!WARNING]
> In production, consider disabling or further protecting this endpoint.

---

### `POST /admin/login`

**Auth:** Public. Accepts `email` + `password`.

---

### `POST /admin/logout`

**Auth:** `verifyAdminJWT`

---

### `GET /admin/me`

**Auth:** `verifyAdminJWT`

---

### `GET /admin/debug/redis`

Debug endpoint to inspect Redis state.

**Auth:** `verifyAdminJWT`

Returns: socket mappings, location cache, trip participant sets, ambulance geo index members.

> [!NOTE]
> For development/debugging only. Consider removing in production.
