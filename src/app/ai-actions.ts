'use server';

import type {
  GenerateMelodyInput,
  GenerateFullCompositionOutput,
  SuggestChordProgressionsInput,
  SuggestChordProgressionsOutput,
  AnalyzeYouTubeInput,
} from '@/lib/schemas';
import { generateMelodyFromPrompt as generateMelodyFromPromptFlow } from '@/ai/flows/generate-melody-from-prompt';
import { suggestChordProgressions as suggestChordProgressionsFlow } from '@/ai/flows/suggest-chord-progressions';
import { analyzeYouTubeAndGenerateMelody as analyzeYouTubeAndGenerateMelodyFlow } from '@/ai/flows/analyze-youtube-flow';

export async function generateMelodyAction(input: GenerateMelodyInput) {
  try {
    const result = await generateMelodyFromPromptFlow(input);
    return { data: result, error: null };
  } catch (error: any) {
    return { data: null, error: error?.message ?? 'Nie udało się wygenerować melodii.' };
  }
}

export async function suggestChordProgressionsAction(input: SuggestChordProgressionsInput) {
  try {
    const result = await suggestChordProgressionsFlow(input);
    return { data: result, error: null };
  } catch (error: any) {
    return { data: null, error: error?.message ?? 'Nie udało się pobrać progresji akordów.' };
  }
}

export async function analyzeAndGenerateAction(input: AnalyzeYouTubeInput) {
  try {
    const result = await analyzeYouTubeAndGenerateMelodyFlow(input);
    return { data: result, error: null };
  } catch (error: any) {
    return { data: null, error: error?.message ?? 'Nie udało się przeanalizować nagrania.' };
  }
}
