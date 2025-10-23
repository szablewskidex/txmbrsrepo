// Skrypt do czyszczenia cache melodii
// Uruchom: npx tsx clear-cache.ts

import { melodyCache, pendingMelodyRequests } from './src/ai/utils/cache-manager';

console.log('[CLEAR_CACHE] Clearing melody cache...');
console.log(`[CLEAR_CACHE] Current cache size: ${melodyCache.size} entries`);
console.log(`[CLEAR_CACHE] Pending requests: ${pendingMelodyRequests.size}`);

melodyCache.clear();
pendingMelodyRequests.clear();

console.log('[CLEAR_CACHE] ✓ Cache cleared successfully!');
console.log('[CLEAR_CACHE] Next generation will create fresh compositions');
