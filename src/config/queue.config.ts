import { Queue, Worker } from "bullmq";
import type { QueueOptions, WorkerOptions, ConnectionOptions } from "bullmq";
import { REDIS_URL } from "./env.js";

const queueConnection: ConnectionOptions = {
  url: REDIS_URL, 
  // BullMQ options for robustness
  retryStrategy: function (times) {
    return Math.max(Math.min(Math.exp(times), 20000), 1000);
  },
};
