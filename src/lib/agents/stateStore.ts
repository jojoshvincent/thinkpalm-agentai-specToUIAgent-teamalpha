import { createClient, type RedisClientType } from "redis";
import { pipelineStateSchema, type PipelineState } from "./schemas";

let redisClient: RedisClientType | null = null;
const FALLBACK = new Map<string, string>();
const STATE_TTL_SECONDS = 60 * 60;

async function getRedisClient(): Promise<RedisClientType | null> {
  const url = process.env.REDIS_URL;
  if (!url) return null;
  if (!redisClient) {
    redisClient = createClient({ url });
    redisClient.on("error", () => {
      // Fall back to in-process state when Redis is temporarily unavailable.
    });
    await redisClient.connect();
  }
  return redisClient;
}

function keyFor(jobId: string): string {
  return `ai-ui-generator:pipeline:${jobId}`;
}

export async function writePipelineState(state: PipelineState): Promise<void> {
  const parsed = pipelineStateSchema.parse(state);
  const serialized = JSON.stringify(parsed);
  const client = await getRedisClient();
  if (client) {
    await client.set(keyFor(parsed.jobId), serialized, { EX: STATE_TTL_SECONDS });
    return;
  }
  FALLBACK.set(parsed.jobId, serialized);
}

export async function readPipelineState(
  jobId: string,
): Promise<PipelineState | null> {
  const client = await getRedisClient();
  const raw = client ? await client.get(keyFor(jobId)) : FALLBACK.get(jobId);
  if (!raw) return null;
  return pipelineStateSchema.parse(JSON.parse(raw));
}
