import fs from 'fs';
import path from 'path';
import { createHash } from 'crypto';

const NEGATIVE_FEEDBACK_LOG_PATH = path.join(process.cwd(), 'training-data', 'melody-feedback-log.json');
const fsAsync = fs.promises;

interface CompositionLayers {
  melody: unknown[];
  chords: unknown[];
  bassline: unknown[];
}

export function createCompositionSignature(output: CompositionLayers): string {
  return createHash('sha1').update(JSON.stringify(output)).digest('hex');
}

export async function loadNegativeFeedbackSignatures(): Promise<Set<string>> {
  try {
    const raw = await fsAsync.readFile(NEGATIVE_FEEDBACK_LOG_PATH, 'utf-8');
    const entries = JSON.parse(raw);
    
    if (!Array.isArray(entries)) {
      return new Set();
    }
    
    const signatures = entries
      .map(entry => entry?.signature)
      .filter((signature): signature is string => typeof signature === 'string' && signature.length > 0);
    
    return new Set(signatures);
  } catch (error: unknown) {
    const err = error as NodeJS.ErrnoException;
    if (err?.code !== 'ENOENT') {
      console.warn('[MELODY_GEN] Failed to load negative feedback log:', error);
    }
    return new Set();
  }
}
