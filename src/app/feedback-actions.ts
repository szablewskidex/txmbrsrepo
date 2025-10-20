'use server';

import { promises as fs } from 'fs';
import path from 'path';
import { createHash } from 'crypto';

import type { GenerateFullCompositionOutput } from '@/lib/schemas';

const TRAINING_DATA_DIR = path.join(process.cwd(), 'training-data');
const FEW_SHOT_DATASET_PATH = path.join(TRAINING_DATA_DIR, 'melody-training-dataset.json');
const FEEDBACK_LOG_PATH = path.join(TRAINING_DATA_DIR, 'melody-feedback-log.json');

interface SubmitFeedbackInput {
  rating: 'up' | 'down';
  prompt: string;
  key: string;
  measures?: number;
  tempo?: number;
  gridResolution?: number;
  chordProgression?: string;
  intensifyDarkness?: boolean;
  reason?: 'quality' | 'prompt_mismatch' | 'other';
  notes?: string;
  melody: GenerateFullCompositionOutput;
}

async function ensureTrainingDataDir(): Promise<void> {
  try {
    await fs.mkdir(TRAINING_DATA_DIR, { recursive: true });
  } catch (error) {
    console.warn('[FEEDBACK] Failed to ensure training data directory:', error);
  }
}

async function readJsonFile<T>(filePath: string, fallback: T): Promise<T> {
  try {
    const data = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(data) as T;
  } catch (error: any) {
    if (error?.code === 'ENOENT') {
      return fallback;
    }
    console.warn(`[FEEDBACK] Failed to read ${filePath}:`, error);
    return fallback;
  }
}

async function writeJsonFile(filePath: string, data: unknown): Promise<void> {
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

function createMelodySignature(melody: GenerateFullCompositionOutput): string {
  const payload = JSON.stringify(melody);
  return createHash('sha1').update(payload).digest('hex');
}

export async function submitFeedbackAction(input: SubmitFeedbackInput): Promise<{ ok: true } | { ok: false; error: string }> {
  const {
    rating,
    prompt,
    key,
    measures,
    tempo,
    gridResolution,
    chordProgression,
    intensifyDarkness,
    reason,
    notes,
    melody,
  } = input;

  if (!prompt || !key || !melody) {
    return { ok: false, error: 'Brakuje wymaganych danych feedbacku.' };
  }

  await ensureTrainingDataDir();

  const signature = createMelodySignature(melody);
  const timestamp = new Date().toISOString();

  if (rating === 'up') {
    const dataset = await readJsonFile<any[]>(FEW_SHOT_DATASET_PATH, []);

    const alreadyExists = dataset.some(entry => {
      if (entry?.metadata?.signature) {
        return entry.metadata.signature === signature;
      }
      return JSON.stringify(entry?.output) === JSON.stringify(melody);
    });

    if (alreadyExists) {
      return { ok: true };
    }

    const entry = {
      input: {
        prompt,
        key,
        measures: measures ?? 8,
        chordProgression: chordProgression ?? 'Unknown',
        tempo,
        gridResolution,
        intensifyDarkness,
      },
      output: melody,
      metadata: {
        signature,
        rating,
        timestamp,
        source: 'user-feedback',
        aiGenerated: true,
      },
    };

    dataset.unshift(entry);

    if (dataset.length > 200) {
      dataset.splice(200);
    }

    await writeJsonFile(FEW_SHOT_DATASET_PATH, dataset);
    return { ok: true };
  }

  const feedbackLog = await readJsonFile<any[]>(FEEDBACK_LOG_PATH, []);

  feedbackLog.unshift({
    prompt,
    key,
    measures,
    tempo,
    gridResolution,
    chordProgression,
    intensifyDarkness,
    reason: reason ?? 'quality',
    notes: notes?.trim() || undefined,
    signature,
    timestamp,
  });

  if (feedbackLog.length > 500) {
    feedbackLog.splice(500);
  }

  await writeJsonFile(FEEDBACK_LOG_PATH, feedbackLog);
  return { ok: true };
}
