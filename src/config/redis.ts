import { createClient } from "redis";
import type { RedisClientType } from 'redis'
import { REDIS_URL } from "./env.js";

const redis: RedisClientType= createClient({
  url: REDIS_URL,
});

redis.on("connect", () => {
  console.log("connected to redis");
});

redis.on("err", () => {
  console.log("Error in connecting to redis");
});

export default redis;
