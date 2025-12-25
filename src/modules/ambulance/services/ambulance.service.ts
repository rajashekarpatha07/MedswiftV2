import redis from "../../../config/redis.js";
import { Ambulance } from "../model/ambulance.model.js";
import type { IAmbulance } from "../model/ambulance.model.js";
import type { Types } from "mongoose";
const AMBULANCE_GEO_KEY = "ambulance_locations";

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
 * Syncs the ambulance state with Redis.
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
      if (typeof lng === "number" && typeof lat === "number") {
        // GEOADD key longitude latitude member
        await redis.geoAdd(AMBULANCE_GEO_KEY, {
          member: ambulanceId,
          longitude: lng,
          latitude: lat,
        });
        console.log(`Redis: Added ${ambulanceId} to active pool`);
      } else {
        console.warn(`Redis: Invalid coordinates for ${ambulanceId}`);
      }
    } else {
      // ZREM key member
      // We remove them if they are 'offline' OR 'on-trip' (busy)
      await redis.zRem(AMBULANCE_GEO_KEY, ambulanceId);
      console.log(
        `Redis: Removed ${ambulanceId} from active pool (Status: ${status})`
      );
    }
  } catch (error) {
    console.error("Redis Sync Error:", error);
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
  // Define search radii in kilometers: 5 → 10 → 17 → 30
  const searchRadii = [5, 10, 17, 30];

  console.log(`🔍 Searching for ambulances near (${longitude}, ${latitude})`);

  for (const radius of searchRadii) {
    console.log(`🎯 Searching within ${radius}km radius...`);

    try {
      // use geoSearchWith to get objects { member, distance }
      const results = await redis.geoSearchWith(
        AMBULANCE_GEO_KEY,
        { longitude, latitude },
        { radius, unit: "km" },
        ["WITHDIST", "WITHCOORD"], // what info you want back
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
            distance: result.distance ? Math.round(parseFloat(result.distance) * 1000) : 0, // Convert km string to meters
            ambulanceData: ambulanceMap.get(result.member) || null,
          }))
          .filter((result) => result.ambulanceData !== null);

        if (nearbyAmbulances.length > 0) {
          console.log(
            `✅ Found ${nearbyAmbulances.length} ambulance(s) at ${radius}km`
          );
          return nearbyAmbulances;
        }
      }

      console.log(`⚠️ No ambulances at ${radius}km, expanding search...`);
    } catch (error) {
      console.error(`❌ Error searching at ${radius}km:`, error);
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

export {
  syncAmbulancetoRedis,
  removeAmbulanceFromRedis,
  findNearbyAmbulances,
  getActiveAmbulanceCount,
  getAllActiveAmbulanceIds,
};
