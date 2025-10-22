import fs from 'fs';
import path from 'path';
import type { InstrumentFocus, Mood } from './prompt-detection';
import { normalizeKeyLabel, parseKeyInfo, detectInstrumentFromPrompt, getMoodFromPrompt } from './prompt-detection';

export interface TrainingExample {
  input?: {
    prompt?: string;
    key?: string;
    tempo?: number;
    measures?: number;
    chordProgression?: string;
  };
  output?: {
    melody?: Array<{ note?: string; start?: number; duration?: number; velocity?: number; slide?: boolean }>;
  };
  metadata?: {
    source?: string;
    instrument?: string;
    tempo?: number;
    style?: string;
    metrics?: Record<string, unknown>;
    [key: string]: unknown;
  };
}

export interface FewShotContext {
  instrument?: InstrumentFocus;
  key?: string;
  mood?: Mood;
  prompt?: string;
  tempo?: number;
  keywords?: string[];
}

const MAX_FEW_SHOT_EXAMPLES = 0; // TYMCZASOWO WYŁĄCZONE - training dataset ma złe przykłady
let cachedFewShotDataset: TrainingExample[] | null = null;
let fewShotDatasetMtime: number | null = null;
const fewShotPromptCache = new Map<string, string | null>();

function getDatasetPath(): string {
  return path.join(process.cwd(), 'training-data', 'melody-training-dataset.json');
}

export function loadFewShotDataset(): TrainingExample[] | null {
  try {
    const datasetPath = getDatasetPath();
    if (!fs.existsSync(datasetPath)) {
      cachedFewShotDataset = null;
      fewShotDatasetMtime = null;
      return null;
    }

    const stats = fs.statSync(datasetPath);
    if (cachedFewShotDataset && fewShotDatasetMtime === stats.mtimeMs) {
      return cachedFewShotDataset;
    }

    const fileContents = fs.readFileSync(datasetPath, 'utf-8');
    const data: unknown = JSON.parse(fileContents);

    if (!Array.isArray(data) || data.length === 0) {
      cachedFewShotDataset = null;
      fewShotDatasetMtime = stats.mtimeMs;
      return null;
    }

    cachedFewShotDataset = data as TrainingExample[];
    fewShotDatasetMtime = stats.mtimeMs;
    fewShotPromptCache.clear();
    return cachedFewShotDataset;
  } catch (error) {
    console.warn('[MELODY_GEN] Failed to load few-shot dataset:', error);
    cachedFewShotDataset = null;
    fewShotDatasetMtime = null;
    fewShotPromptCache.clear();
    return null;
  }
}

export async function resetFewShotCache(): Promise<void> {
  cachedFewShotDataset = null;
  fewShotDatasetMtime = null;
  fewShotPromptCache.clear();
}

function buildFewShotPrompt(examples: TrainingExample[]): string | null {
  if (!examples.length) return null;

  const serialized = examples
    .map(example => {
      const prompt = example.input?.prompt ?? example.metadata?.source ?? 'Unknown prompt';
      const melodySnippet = Array.isArray(example.output?.melody)
        ? example.output!.melody.slice(0, 4)
        : [];
      return `Prompt: ${prompt}\nMelody snippet: ${JSON.stringify(melodySnippet)}`;
    })
    .join('\n\n');

  if (!serialized) return null;
  return `Here are examples of high-quality melodies:\n\n${serialized}`;
}

function getExampleTempo(example: TrainingExample): number | undefined {
  return (
    example.metadata?.tempo ??
    example.input?.tempo ??
    (typeof example.metadata?.metrics === 'object' && example.metadata?.metrics !== null
      ? Number((example.metadata?.metrics as Record<string, unknown>).tempo)
      : undefined)
  );
}

function exampleMatchesInstrument(example: TrainingExample, instrument?: InstrumentFocus): boolean {
  if (!instrument) return true;
  
  const promptInstrument = detectInstrumentFromPrompt(example.input?.prompt ?? '');
  if (promptInstrument === instrument) return true;
  
  const metadataInstrument = typeof example.metadata?.instrument === 'string' 
    ? example.metadata.instrument.toLowerCase() 
    : '';
  if (metadataInstrument.includes(instrument)) return true;
  
  const source = typeof example.metadata?.source === 'string' 
    ? example.metadata.source.toLowerCase() 
    : '';
  return source.includes(instrument);
}

function detectExampleMood(example: TrainingExample): Mood {
  return getMoodFromPrompt(example.input?.prompt ?? '', false);
}

function computeExampleScore(
  example: TrainingExample,
  context: FewShotContext,
  fallbackIndex: number
): { score: number; tempoDelta: number; example: TrainingExample } {
  const targetKey = parseKeyInfo(context.key);
  const exampleKey = parseKeyInfo(example.input?.key ?? (example.metadata?.source as string | undefined));
  const providedTempo = context.tempo;
  const exampleTempo = getExampleTempo(example);
  const targetMood = context.mood;
  const exampleMood = detectExampleMood(example);

  let score = 0;

  if (context.instrument && exampleMatchesInstrument(example, context.instrument)) {
    score += 5;
  }

  if (targetKey && exampleKey) {
    if (targetKey.tonic === exampleKey.tonic && targetKey.mode === exampleKey.mode) {
      score += 4;
    } else if (targetKey.tonic === exampleKey.tonic) {
      score += 3;
    } else if (targetKey.mode === exampleKey.mode) {
      score += 1;
    }
  }

  if (targetMood && exampleMood === targetMood) {
    score += 2;
  }

  const tempoDelta =
    exampleTempo && providedTempo ? Math.abs(exampleTempo - providedTempo) : Number.MAX_SAFE_INTEGER;

  if (exampleTempo && providedTempo) {
    const tempoScore = Math.max(0, 3 - Math.abs(exampleTempo - providedTempo) / 20);
    score += tempoScore;
  }

  if (context.prompt) {
    const promptLower = context.prompt.toLowerCase();
    if (promptLower.includes('arpeggio') || promptLower.includes('arp')) {
      const examplePrompt = example.input?.prompt?.toLowerCase() ?? '';
      if (examplePrompt.includes('arpeggio') || examplePrompt.includes('arp')) {
        score += 1.5;
      }
    }
  }

  score -= fallbackIndex * 0.0001;

  return { score, tempoDelta, example };
}

function selectFewShotExamples(dataset: TrainingExample[], context: FewShotContext): TrainingExample[] {
  if (dataset.length === 0) return dataset;

  const instrumentFiltered = dataset.filter(example => exampleMatchesInstrument(example, context.instrument));
  let pool = instrumentFiltered.length > 0 ? instrumentFiltered : dataset;

  if (context.keywords && context.keywords.length > 0) {
    const keywordFiltered = pool.filter(example => {
      const haystacks = [
        example.metadata?.source,
        example.input?.prompt,
        example.metadata?.instrument,
        example.metadata?.style,
      ]
        .filter(Boolean)
        .map(value => value!.toString().toLowerCase());
      if (haystacks.length === 0) return false;
      return context.keywords!.some(keyword => haystacks.some(h => h.includes(keyword)));
    });
    if (keywordFiltered.length > 0) pool = keywordFiltered;
  }

  const scored = pool.map((example, index) => computeExampleScore(example, context, index));
  const anyPositive = scored.some(item => item.score > 0);
  const sorted = scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.tempoDelta - b.tempoDelta;
  });

  const selected = (anyPositive ? sorted : scored).map(item => item.example).slice(0, MAX_FEW_SHOT_EXAMPLES);

  return selected.length > 0 ? selected : pool.slice(0, MAX_FEW_SHOT_EXAMPLES);
}

function buildFewShotCacheKey(context: FewShotContext): string {
  return JSON.stringify({
    instrument: context.instrument ?? 'any',
    key: normalizeKeyLabel(context.key) ?? 'any',
    mood: context.mood ?? 'any',
    hasArp: context.prompt ? /(arpeggio|\barp\b)/i.test(context.prompt) : false,
    tempo: context.tempo ?? null,
    keywords: context.keywords ? [...context.keywords].sort() : [],
  });
}

export function getFewShotPromptForInstrument(context: FewShotContext): {
  prompt: string | null;
  total: number;
  filtered: number;
  examples: TrainingExample[];
} {
  const cacheKey = buildFewShotCacheKey(context);
  const dataset = loadFewShotDataset();
  
  if (!dataset || dataset.length === 0) {
    fewShotPromptCache.set(cacheKey, null);
    return { prompt: null, total: 0, filtered: 0, examples: [] };
  }

  const selectedExamples = selectFewShotExamples(dataset, context);
  const prompt = fewShotPromptCache.has(cacheKey)
    ? fewShotPromptCache.get(cacheKey) ?? null
    : buildFewShotPrompt(selectedExamples);

  if (!fewShotPromptCache.has(cacheKey)) {
    fewShotPromptCache.set(cacheKey, prompt ?? null);
  }

  return {
    prompt,
    total: dataset.length,
    filtered: selectedExamples.length,
    examples: selectedExamples,
  };
}
