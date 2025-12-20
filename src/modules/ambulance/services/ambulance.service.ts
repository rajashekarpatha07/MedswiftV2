import redis from "../../../config/redis.js";
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
      console.log(`🚑 Redis: Removed ${ambulanceId} from active pool`);
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

export { syncAmbulancetoRedis, removeAmbulanceFromRedis };
