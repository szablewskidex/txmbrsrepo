const MAX_CONCURRENT_MELODY_REQUESTS = 2;
const USAGE_WINDOW_MS = 1000 * 60 * 60 * 24; // 24 hours
const SOFT_USAGE_LIMIT_PER_WINDOW = 20000;

export let activeMelodyRequests = 0;
export const melodyRequestQueue: Array<() => void> = [];

let usageWindowStart = Date.now();
let usageTokensInWindow = 0;
export let totalEstimatedTokensUsed = 0;

let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL_MS = 2000; // Minimum 2s między requestami

export async function acquireMelodySlot(): Promise<void> {
  return new Promise(resolve => {
    const tryAcquire = async () => {
      // Sprawdź czy minęło wystarczająco czasu od ostatniego requestu
      const now = Date.now();
      const timeSinceLastRequest = now - lastRequestTime;
      
      if (timeSinceLastRequest < MIN_REQUEST_INTERVAL_MS) {
        const waitTime = MIN_REQUEST_INTERVAL_MS - timeSinceLastRequest;
        console.log(`[RATE_LIMIT] Waiting ${waitTime}ms to avoid rate limit...`);
        await sleep(waitTime);
      }
      
      if (activeMelodyRequests < MAX_CONCURRENT_MELODY_REQUESTS) {
        activeMelodyRequests++;
        lastRequestTime = Date.now();
        resolve();
        return;
      }
      
      melodyRequestQueue.push(() => {
        activeMelodyRequests++;
        lastRequestTime = Date.now();
        resolve();
      });
    };
    
    tryAcquire();
  });
}

export function releaseMelodySlot(): void {
  activeMelodyRequests = Math.max(0, activeMelodyRequests - 1);
  const next = melodyRequestQueue.shift();
  if (next) {
    next();
  }
}

export function trackUsage(): boolean {
  const now = Date.now();
  if (now - usageWindowStart >= USAGE_WINDOW_MS) {
    usageWindowStart = now;
    usageTokensInWindow = 0;
  }

  if (usageTokensInWindow >= SOFT_USAGE_LIMIT_PER_WINDOW) {
    console.warn('[MELODY_GEN] Soft token limit reached for today. Rejecting new requests.');
    return false;
  }

  const remaining = SOFT_USAGE_LIMIT_PER_WINDOW - usageTokensInWindow;
  console.log(`[MELODY_GEN] Tokens used today: ${usageTokensInWindow}. Remaining: ${remaining}`);
  return true;
}

export function addTokenUsage(tokens: number): void {
  totalEstimatedTokensUsed += tokens;
  usageTokensInWindow += tokens;
}

export async function getTotalEstimatedTokensUsed(): Promise<number> {
  return totalEstimatedTokensUsed;
}

export const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
