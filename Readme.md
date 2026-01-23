# MedSwift 🚑

**Real-Time Emergency Dispatch & Medical Coordination System**

MedSwift is a high-performance backend infrastructure designed to solve the critical "last-mile" problem in emergency medical services. In a medical emergency, every second saved translates directly to lives preserved. MedSwift replaces manual, fragmented coordination with an automated, location-aware system that connects patients, ambulances, and hospitals in real-time.

---

## 🛑 The Problem: Fragmentation in the "Golden Hour"

The "Golden Hour" is the first hour after a traumatic injury or medical emergency where prompt treatment is most likely to prevent death. Current systems fail this window due to:

- **Discovery Latency**: Patients don't know which ambulance is closest.
- **Operational Blindness**: Drivers can't see the patient's real-time movement or medical history until arrival.
- **Hospital Mismatch**: Ambulances often arrive at hospitals that lack specific resources (e.g., O-negative blood or available ICU beds), forcing dangerous secondary transfers.

---

## 💡 The Inevitable Architecture

MedSwift is built on a "System-First" philosophy. For an emergency dispatch system, traditional REST/Relational patterns are insufficient. Our architecture is driven by three inevitable requirements:

1. **High-Frequency Geospatial Updates**: We use Redis Geospatial (2dsphere) indexing. Standard databases are too slow for tracking dozens of moving ambulances. Redis allows us to perform $O(\log N)$ proximity searches, expanding radii from 5km to 30km in milliseconds.

2. **State Synchronization**: We use WebSockets (Socket.io) for trip lifecycles. Polling is too slow. When an ambulance accepts a trip, the patient's UI must reflect that state change instantly.

3. **Data Integrity vs. Availability**: We use MongoDB for persistence (patient history, trip audits) but rely on Redis for transient state (active driver pools), ensuring the system remains responsive even under heavy load.

---

## ✨ Key Features

### 1. Smart Dispatching

- **Automatic Failover**: The system searches for ambulances in concentric circles: 5km → 10km → 17km → 30km.
- **Resource-Aware Routing**: Patients can request specific hospital requirements (e.g., "Require Beds" or "Blood Type AB+") and the system filters the nearest hospitals with matching inventory.

### 2. Real-Time Trip Lifecycle

- **Live Tracking**: Full-duplex location sharing between Patient and Driver once a trip is ACCEPTED.
- **Audit Trail**: Every status change (SEARCHING → EN_ROUTE → ARRIVED) is timestamped and geo-tagged in a persistent timeline.

### 3. SOS & Emergency Signaling

- **One-Tap SOS**: Immediate broadcast to all participants (User, Driver, and Admin) if a situation escalates.
- **Inventory Management**: Hospitals can update bed and blood stock in real-time, which immediately updates the dispatch algorithm's filtering logic.

---

## 🛠️ Technical Stack

- **Runtime**: Node.js (ESM)
- **Language**: TypeScript (Strict Type Checking)
- **Real-time**: Socket.io (with Redis Adapter)
- **Storage**: 
  - **MongoDB**: Permanent records, Patient snapshots, Audit trails
  - **Redis**: Geospatial driver pools, Socket-to-User mapping, Location caching
- **Validation**: Zod (Contract-first validation for all DTOs)

---

## 📂 Project Structure

```
src/
├── modules/
│   ├── user/        # Patient registration, profile, and auth
│   ├── ambulance/   # Driver pool, status management, geo-sync
│   ├── hospital/    # Inventory tracking (beds/blood), resource discovery
│   ├── trip/        # State machine for the dispatch lifecycle
│   └── admin/       # System monitoring and Redis debugging
├── shared/
│   ├── infra/       # Socket.io handlers and middleware
│   ├── middlewares/ # JWT Auth (Role-based), Zod Validation
│   └── utils/       # Standardized ApiError/ApiResponse wrappers
└── config/          # Database and Queue configurations
```

---

## 🚀 Getting Started

### Prerequisites

- Node.js v18+
- MongoDB Instance
- Redis Instance

### Installation

1. Clone the repository

2. Install dependencies
   ```bash
   pnpm install
   ```

### Environment Setup

Create a `.env` file:

```env
PORT=5000
MONGO_URI=your_mongodb_uri
REDIS_URL=redis://localhost:6379
ACCESS_TOKEN_SECRET=your_secret
REFRESH_TOKEN_SECRET=your_secret
ADMIN_CREATION_SECRET=your_admin_key
BASE_URL=http://localhost:5173
```

### Run in Development

```bash
npm run dev
```

---

## 🧪 Testing the Real-Time System

A dedicated test suite is located in `src/tests/index.html`.

1. Open the file in a browser.
2. Paste a User JWT and an Ambulance JWT.
3. Initialize a trip via the API.
4. Observe the real-time location exchange and SOS broadcasts between the two simulated clients.

---
