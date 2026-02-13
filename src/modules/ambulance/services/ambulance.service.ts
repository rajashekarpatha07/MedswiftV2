import redis from "../../../config/redis.js";
import { Ambulance } from "../model/ambulance.model.js";
import type { IAmbulance } from "../model/ambulance.model.js";
import type { Types } from "mongoose";
import { NODE_ENV } from "../../../config/env.js";

const AMBULANCE_GEO_KEY = "ambulance_locations";
const isDebug = NODE_ENV !== "production";

// In-memory deduplication cache to prevent redundant Redis calls
const lastSyncState = new Map<string, { status: string; lng: number; lat: number; timestamp: number }>();
const DEDUP_THRESHOLD_MS = 2000; // Don't re-sync within 2 seconds if state unchanged

export interface IAmbulanceLocation {
  type: "Point";
  coordinates: [number, number]; // [longitude, latitude]
}
export interface IAmbulanceSyncPayload {
  _id: Types.ObjectId | string;
  status: string; // "ready" | "on-trip" | "offline"
  location: IAmbulanceLocation;
}

/**
 * Validate coordinates are within valid ranges
 */
const isValidCoordinates = (lng: number, lat: number): boolean => {
  return (
    typeof lng === "number" &&
    typeof lat === "number" &&
    lat >= -90 && lat <= 90 &&
    lng >= -180 && lng <= 180 &&
    !isNaN(lng) && !isNaN(lat)
  );
};

/**
 * Syncs the ambulance state with Redis with deduplication.
 * - If status is 'ready': Adds to Redis GEO index.
 * - If status is 'busy'/'offline': Removes from Redis GEO index.
 */
const syncAmbulancetoRedis = async (
  ambulance: IAmbulanceSyncPayload | IAmbulance
): Promise<void> => {
  const { _id, status, location } = ambulance;
  const ambulanceId = _id.toString();

  try {
    // Only 'ready' ambulances should be in the search pool
    if (status === "ready" && location?.coordinates) {
      const [lng, lat] = location.coordinates;

      // Validate coordinates before sending to Redis
      if (!isValidCoordinates(lng, lat)) {
        console.warn(`Redis: Invalid coordinates for ${ambulanceId}: lng=${lng}, lat=${lat}`);
        return;
      }

      // Deduplication: Skip if same state was synced recently
      const lastState = lastSyncState.get(ambulanceId);
      const now = Date.now();
      if (
        lastState &&
        lastState.status === status &&
        Math.abs(lastState.lng - lng) < 0.0001 && // ~11 meters tolerance
        Math.abs(lastState.lat - lat) < 0.0001 &&
        now - lastState.timestamp < DEDUP_THRESHOLD_MS
      ) {
        if (isDebug) {
          console.log(`Redis: Skipped duplicate sync for ${ambulanceId} (within ${DEDUP_THRESHOLD_MS}ms)`);
        }
        return;
      }

      // GEOADD key longitude latitude member
      if (isDebug) {
        console.log(`🔧 syncAmbulancetoRedis: id=${ambulanceId}, status=${status}, coords=(${lng}, ${lat})`);
      }

      const result = await redis.geoAdd(AMBULANCE_GEO_KEY, {
        member: ambulanceId,
        longitude: lng,
        latitude: lat,
      });

      // Update deduplication cache
      lastSyncState.set(ambulanceId, { status, lng, lat, timestamp: now });

      if (isDebug) {
        console.log(`Redis: Added ${ambulanceId} to pool. Result: ${result}`);
      }
    } else {
      // ZREM key member - remove if 'offline' OR 'on-trip' (busy)
      await redis.zRem(AMBULANCE_GEO_KEY, ambulanceId);

      // Update deduplication cache
      lastSyncState.set(ambulanceId, { status, lng: 0, lat: 0, timestamp: Date.now() });

      if (isDebug) {
        console.log(`Redis: Removed ${ambulanceId} from pool (Status: ${status})`);
      }
    }
  } catch (error) {
    console.error("Redis Sync Error:", error);
    // Don't throw - sync failure shouldn't break the calling operation
  }
};

/**
 * Explicitly remove ambulance from Redis (used on Logout)
 */
const removeAmbulanceFromRedis = async (ambulanceId: string) => {
  try {
    await redis.zRem(AMBULANCE_GEO_KEY, ambulanceId);
    console.log("Removed ambulance from redis");
  } catch (error) {
    console.error("Redis Removal Error:", error);
  }
};

/**
 * Find nearby ambulances with automatic radius failover
 * Searches at: 5km → 10km → 17km → 30km
 * @param longitude - User's longitude
 * @param latitude - User's latitude
 * @param limit - Maximum number of results (default: 10)
 * @returns Array of ambulances or empty array with message
 */
interface NearbyAmbulanceResult {
  ambulanceId: string;
  distance: number // in meters
  ambulanceData: IAmbulance | null;
}

/**
 * Find nearby ambulances with automatic radius failover
 * 1. Uses `geoSearchWith` to ensure we get distance data.
 * 2. Uses `COUNT: limit` to optimize Redis performance.
 * 3. Uses `SORT: "ASC"` to get nearest drivers first.
 */
const findNearbyAmbulances = async (
  longitude: number,
  latitude: number,
  limit: number = 10
): Promise<NearbyAmbulanceResult[]> => {
  // Validate coordinates first
  if (!isValidCoordinates(longitude, latitude)) {
    console.warn(`findNearbyAmbulances: Invalid coordinates (${longitude}, ${latitude})`);
    return [];
  }

  // Define search radii in kilometers: 5 → 10 → 17 → 30
  const searchRadii = [5, 10, 17, 30];

  if (isDebug) {
    console.log(`🔍 Searching for ambulances near (${longitude}, ${latitude})`);
    const poolSize = await redis.zCard(AMBULANCE_GEO_KEY);
    console.log(`🔧 Redis pool has ${poolSize} ambulance(s)`);
  }

  for (const radius of searchRadii) {
    try {
      // use geoSearchWith to get objects { member, distance }
      const results = await redis.geoSearchWith(
        AMBULANCE_GEO_KEY,
        { longitude, latitude },
        { radius, unit: "km" },
        ["WITHDIST", "WITHCOORD"],
        {
          SORT: "ASC", // nearest first
          COUNT: limit,
        }
      );

      if (results && results.length > 0) {
        // Extract ambulance IDs from Redis results
        const ambulanceIds = results.map((result) => result.member);

        // Fetch full ambulance data from MongoDB
        const ambulances = await Ambulance.find({
          _id: { $in: ambulanceIds },
          status: "ready",
        }).select("-password -refreshToken");

        // Create map for quick lookup
        const ambulanceMap = new Map(
          ambulances.map((amb) => [amb._id.toString(), amb])
        );

        // Combine Redis distance with MongoDB data
        const nearbyAmbulances: NearbyAmbulanceResult[] = results
          .map((result) => ({
            ambulanceId: result.member,
            distance: result.distance ? Math.round(parseFloat(result.distance) * 1000) : 0,
            ambulanceData: ambulanceMap.get(result.member) || null,
          }))
          .filter((result) => result.ambulanceData !== null);

        if (nearbyAmbulances.length > 0) {
          console.log(`✅ Found ${nearbyAmbulances.length} ambulance(s) at ${radius}km`);
          return nearbyAmbulances;
        }
      }

      if (isDebug) {
        console.log(`⚠️ No ambulances at ${radius}km, expanding search...`);
      }
    } catch (error) {
      console.error(`❌ Error searching at ${radius}km:`, error);
      // Continue to next radius instead of failing completely
    }
  }

  console.log(`❌ No ambulances found within 30km`);
  return [];
};

/**
 * Get ambulance count in Redis (for debugging/monitoring)
 */
const getActiveAmbulanceCount = async (): Promise<number> => {
  try {
    const count = await redis.zCard(AMBULANCE_GEO_KEY);
    return count;
  } catch (error) {
    console.error("Error getting ambulance count:", error);
    return 0;
  }
};

/**
 * Get all ambulance IDs in Redis (for debugging)
 */
const getAllActiveAmbulanceIds = async (): Promise<string[]> => {
  try {
    const members = await redis.zRange(AMBULANCE_GEO_KEY, 0, -1);
    return members;
  } catch (error) {
    console.error("Error getting all ambulance IDs:", error);
    return [];
  }
};

/**
 * Get all ambulance positions from Redis (for debugging)
 */
const getAllAmbulancePositions = async (): Promise<Array<{ id: string; position: [number, number] | null }>> => {
  try {
    const members = await redis.zRange(AMBULANCE_GEO_KEY, 0, -1);
    if (members.length === 0) return [];

    const positions = await redis.geoPos(AMBULANCE_GEO_KEY, members);
    return members.map((id, index) => ({
      id,
      position: positions[index] as [number, number] | null,
    }));
  } catch (error) {
    console.error("Error getting ambulance positions:", error);
    return [];
  }
};

export {
  syncAmbulancetoRedis,
  removeAmbulanceFromRedis,
  findNearbyAmbulances,
  getActiveAmbulanceCount,
  getAllActiveAmbulanceIds,
  getAllAmbulancePositions,
};
