import redis from "../../../config/redis.js";
import { Hospital, type IHospital } from "../model/hospital.model.js";
import type { Types } from "mongoose";

const HOSPITAL_GEO_KEY = "hospital_locations";

export interface IHospitalLocation {
  type: "Point";
  coordinates: [number, number]; // [longitude, latitude]
  address?: string;
}

export interface IHospitalSyncPayload {
  _id: Types.ObjectId | string;
  location: IHospitalLocation;
}

/**
 * Syncs the hospital location and state with Redis.
 */
const SyncHospitalToRedis = async (
  hospital: IHospitalSyncPayload | IHospital
): Promise<void> => {
  const { _id, location } = hospital;
  const hospital_id = _id.toString();

  try {
    // Check if location and coordinates exist
    if (!location || !location.coordinates) {
      console.warn(`Redis: No location data for hospital ${hospital_id}`);
      return;
    }

    const [lng, lat] = location.coordinates;

    // Validate coordinates before sending to Redis
    if (typeof lng === "number" && typeof lat === "number") {
      // GEOADD key longitude latitude member
      await redis.geoAdd(HOSPITAL_GEO_KEY, {
        member: hospital_id,
        longitude: lng,
        latitude: lat,
      });
      console.log(`Redis: Added hospital ${hospital_id} to location index`);
    } else {
      console.warn(`Redis: Invalid coordinates for hospital ${hospital_id}`);
    }
  } catch (error) {
    console.error(`Redis Sync Error for hospital ${hospital_id}:`, error);
  }
};

/**
 * Explicitly remove hospital from Redis (used on deletion/deactivation)
 */
const removeHospitalFromRedis = async (hospitalId: string): Promise<void> => {
  try {
    await redis.zRem(HOSPITAL_GEO_KEY, hospitalId);
    console.log(`Redis: Removed hospital ${hospitalId} from location index`);
  } catch (error) {
    console.error(`Redis Removal Error for hospital ${hospitalId}:`, error);
  }
};

interface NearbyHospitalResult {
  hospitalId: string;
  distance: number; // in meters
  hospitalData: IHospital | null;
}

/**
 * Find nearby hospitals with automatic radius failover
 * Searches at: 5km → 10km → 17km → 30km
 * @param longitude - User's longitude
 * @param latitude - User's latitude
 * @param limit - Maximum number of results (default: 10)
 * @param filters - Optional filters for blood type and beds
 * @returns Array of hospitals or empty array
 */
const findNearbyHospitals = async (
  longitude: number,
  latitude: number,
  limit: number = 10,
  filters?: {
    bloodType?: string;
    requireBeds?: boolean;
  }
): Promise<NearbyHospitalResult[]> => {
  // Define search radii in kilometers: 5 → 10 → 17 → 30
  const searchRadii = [5, 10, 17, 30];
  
  console.log(`🔍 Searching for hospitals near (${longitude}, ${latitude})`);

  for (const radius of searchRadii) {
    console.log(`🎯 Searching within ${radius}km radius...`);

    try {
      // Use geoSearchWith to get objects { member, distance }
      const results = await redis.geoSearchWith(
        HOSPITAL_GEO_KEY,
        { longitude, latitude },
        { radius, unit: "km" },
        ["WITHDIST", "WITHCOORD"], // what info you want back
        {
          SORT: "ASC", // nearest first
          COUNT: limit * 2, // Get more to account for filtering
        }
      );

      if (results && results.length > 0) {
        // Extract hospital IDs from Redis results
        const hospitalIds = results.map((result) => result.member);

        // Build MongoDB query
        const query: any = { 
          _id: { $in: hospitalIds } 
        };

        // Apply filters if provided
        if (filters?.bloodType) {
          const bloodKey = filters.bloodType
            .replace("+", "_positive")
            .replace("-", "_negative");
          query[`inventory.bloodStock.${bloodKey}`] = { $gt: 0 };
        }

        if (filters?.requireBeds) {
          query["inventory.beds.available"] = { $gt: 0 };
        }

        // Fetch full hospital data from MongoDB
        const hospitals = await Hospital.find(query).select(
          "-password -refreshToken"
        );

        // Create map for quick lookup
        const hospitalMap = new Map(
          hospitals.map((hospital) => [hospital._id.toString(), hospital])
        );

        // Combine Redis distance with MongoDB data
        const nearbyHospitals: NearbyHospitalResult[] = results
          .map((result) => ({
            hospitalId: result.member,
            distance: result.distance
              ? Math.round(parseFloat(result.distance) * 1000) // Convert km string to meters
              : 0,
            hospitalData: hospitalMap.get(result.member) || null,
          }))
          .filter((result) => result.hospitalData !== null)
          .slice(0, limit); // Apply limit after filtering

        if (nearbyHospitals.length > 0) {
          console.log(
            `✅ Found ${nearbyHospitals.length} hospital(s) at ${radius}km`
          );
          return nearbyHospitals;
        }
      }

      console.log(`⚠️ No hospitals found at ${radius}km, expanding search...`);
    } catch (error) {
      console.error(`❌ Error searching at ${radius}km:`, error);
    }
  }

  console.log(`❌ No hospitals found within 30km`);
  return [];
};

/**
 * Get hospital count in Redis (for monitoring)
 */
const getActiveHospitalCount = async (): Promise<number> => {
  try {
    const count = await redis.zCard(HOSPITAL_GEO_KEY);
    return count;
  } catch (error) {
    console.error("Error getting hospital count:", error);
    return 0;
  }
};

/**
 * Get all hospital IDs in Redis (for debugging)
 */
const getAllActiveHospitalIds = async (): Promise<string[]> => {
  try {
    const members = await redis.zRange(HOSPITAL_GEO_KEY, 0, -1);
    return members;
  } catch (error) {
    console.error("Error getting all hospital IDs:", error);
    return [];
  }
};

export {
  SyncHospitalToRedis,
  removeHospitalFromRedis,
  findNearbyHospitals,
  getActiveHospitalCount,
  getAllActiveHospitalIds,
};