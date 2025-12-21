import redis from "../../../config/redis.js";
import { Ambulance } from "../model/ambulance.model.js";
import type { IAmbulance } from "../model/ambulance.model.js";
import type { Types } from "mongoose";

const AMBULANCE_GEO_KEY = "ambulance_locations";

/**
 * Syncs the ambulance state with Redis.
 * - If status is 'ready': Adds to Redis GEO index.
 * - If status is 'busy'/'offline': Removes from Redis GEO index.
 */

const syncAmbulancetoRedis = async (
  ambulance: IAmbulance | { _id: Types.ObjectId; status: string; location: any }
): Promise<void> => {
  const { _id, status, location } = ambulance;
  const ambulanceId = _id.toString();

  try {
    if (status === "ready" && location?.coordinates) {
      const [lng, lat] = location.coordinates;

      // GEOADD key longitude latitude member
      await redis.geoAdd(AMBULANCE_GEO_KEY, {
        member: ambulanceId,
        longitude: lng,
        latitude: lat,
      });
      console.log(`Redis: Added ${ambulanceId} to active pool`);
    } else {
      // ZREM key member
      await redis.zRem(AMBULANCE_GEO_KEY, ambulanceId);
      console.log(`Redis: Removed ${ambulanceId} from active pool`);
    }
  } catch (error) {
    console.error("Redis Sync Error:", error);
    // Don't throw error here, just log it.
    // We don't want to fail the HTTP request just because Redis hiccuped.
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
  distance: number; // in meters
  ambulanceData: IAmbulance | null;
}

const findNearbyAmbulances = async (
  longitude: number,
  latitude: number,
  limit: number = 10
): Promise<NearbyAmbulanceResult[]> => {
  // Define search radii in kilometers: 5 → 10 → 17 → 30
  const searchRadii = [5, 10, 17, 30];

  console.log(`🔍 Searching for ambulances near (${longitude}, ${latitude})`);

  // Try each radius until we find ambulances
  for (const radius of searchRadii) {
    console.log(`🎯 Searching within ${radius}km radius...`);

    try {
      // GEOSEARCH in Redis
      const results = await redis.geoSearch(
        AMBULANCE_GEO_KEY,
        { longitude, latitude },
        { radius, unit: "km" }
      );

      if (results && results.length > 0) {
        // Extract ambulance IDs from Redis
        const ambulanceIds = results.map((result: any) => result.member);

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
          .map((result: any) => ({
            ambulanceId: result.member,
            distance: Math.round(parseFloat(result.distance) * 1000), // km to meters
            ambulanceData: ambulanceMap.get(result.member) || null,
          }))
          .filter((result) => result.ambulanceData !== null);

        if (nearbyAmbulances.length > 0) {
          console.log(`✅ Found ${nearbyAmbulances.length} ambulance(s) at ${radius}km`);
          return nearbyAmbulances;
        }
      }

      console.log(`⚠️ No ambulances at ${radius}km, expanding search...`);
    } catch (error) {
      console.error(`❌ Error searching at ${radius}km:`, error);
    }
  }

  // No ambulances found after all attempts
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
