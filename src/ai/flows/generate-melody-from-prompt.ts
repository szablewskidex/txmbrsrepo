"use server";

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { suggestChordProgressions } from './suggest-chord-progressions';
import {
  GenerateMelodyInputSchema,
  GenerateFullCompositionOutputSchema,
  type GenerateMelodyInput,
  type GenerateFullCompositionOutput,
  type MelodyNote,
} from '@/lib/schemas';
import { validateAndCorrectMelody } from '@/lib/melody-validator';

// Import utilities
import {
  getMoodFromPrompt,
  detectInstrumentFromPrompt,
  extractTempoFromPromptText,
  extractKeywordsFromPrompt,
  detectLayersFromPrompt,
  shouldSkipStrum,
  type Mood,
  type InstrumentFocus,
  type Layer,
} from '../utils/prompt-detection';

import { selectChordProgressionForPrompt } from '../utils/chord-selection';
import { enhancedAnalyzeMelody } from '../utils/melody-analysis';
import {
  getFewShotPromptForInstrument,
  resetFewShotCache,
  type FewShotContext,
} from '../utils/few-shot-learning';
import { applyGuitarStrum } from '../utils/guitar-effects';
import { loadNegativeFeedbackSignatures, createCompositionSignature } from '../utils/negative-feedback';
import {
  buildCacheKey,
  getCachedMelody,
  setCachedMelody,
  compositionFitsWithinBeats,
  pendingMelodyRequests,
} from '../utils/cache-manager';
import {
  acquireMelodySlot,
  releaseMelodySlot,
  trackUsage,
  addTokenUsage,
  getTotalEstimatedTokensUsed,
  sleep,
} from '../utils/rate-limit-manager';

// Constants
const MAX_RETRIES = 3;
const QUALITY_THRESHOLD = 70;
const RETRY_BASE_DELAY_MS = 1000;
const PER_GENERATION_REQUEST_CAP = 5;

// Helper function
function safeValidateLayer(
  enabled: boolean,
  notes: MelodyNote[],
  key: string,
  options: Parameters<typeof validateAndCorrectMelody>[2]
): MelodyNote[] {
  if (!enabled) {
    console.log('[VALIDATE] Layer disabled, returning empty array');
    return [];
  }

  if (!Array.isArray(notes)) {
    console.warn('[VALIDATE] Notes is not an array:', typeof notes);
    return [];
  }

  if (notes.length === 0) {
    console.warn('[VALIDATE] No notes provided for enabled layer');
    return [];
  }

  try {
    const validated = validateAndCorrectMelody(notes, key, options);
    console.log(`[VALIDATE] Validated ${notes.length} notes -> ${validated.length} notes`);
    return validated;
  } catch (error) {
    console.error('[VALIDATE] Error during validation:', error);
    return [];
  }
}

// Prompt Schema
const InternalPromptInputSchema = z.object({
  prompt: z.string(),
  chordProgression: z.string(),
  sectionProgressions: z.array(z.string()).optional(),
  key: z.string(),
  exampleMelodyJSON: z.string().optional(),
  feedback: z.string().optional(),
  attemptNumber: z.number().int().positive(),
  measures: z.number().int().positive().max(128).default(8),
  totalBeats: z.number(),
  maxStartBeat: z.number(),
  fewShotExamples: z.string().optional(),
  mood: z.enum(['dark', 'bright', 'neutral']),
  intensifyDarkness: z.boolean().optional(),
  includeMelody: z.boolean(),
  includeChords: z.boolean(),
  includeBassline: z.boolean(),
  instrument: z.string().optional(),
  tempo: z.number().int().min(20).max(400).optional(),
});

// Fast mode prompt - drastycznie krótszy
const generateMelodyFastPrompt = ai.definePrompt({
  name: 'generateFastCompositionPrompt',
  input: { schema: InternalPromptInputSchema },
  output: { schema: GenerateFullCompositionOutputSchema },
  prompt: `Generate music for: {{{prompt}}}

Key: {{{key}}} | Chords: {{{chordProgression}}} | {{{measures}}} bars

{{#if includeMelody}}Melody: C4-C6, 12-24 notes{{/if}}
{{#if includeChords}}Chords: C3-C5, 8-16 notes{{/if}}
{{#if includeBassline}}Bass: C2-C3, 4-8 notes{{/if}}

Return JSON only.`,
});

const generateMelodyPrompt = ai.definePrompt({
  name: 'generateFullCompositionPrompt',
  input: { schema: InternalPromptInputSchema },
  output: { schema: GenerateFullCompositionOutputSchema },
  prompt: `You are an expert music composer and theorist specializing in modern production.

**LAYERS:** Generate only the layers marked ✓ below, return empty arrays for ✗.
{{#if includeMelody}}✓ Melody{{else}}✗ Melody{{/if}}
{{#if includeChords}} ✓ Chords{{else}} ✗ Chords{{/if}}
{{#if includeBassline}} ✓ Bassline{{else}} ✗ Bassline{{/if}}

{{#if instrument}}Primary instrument focus: {{{instrument}}} (keep range/playability idiomatic).{{/if}}

**CORE RULES**
- Length: exactly {{{measures}}} bars (beats 0 → {{{maxStartBeat}}})
- No note past beat {{{totalBeats}}}; no gaps >2 beats in requested layers
- Stay strictly in key {{{key}}}
- Follow chord progression: {{{chordProgression}}}

{{#if tempo}}
Tempo: {{{tempo}}} BPM. Groove must feel natural at this speed (slow = longer notes, fast = denser syncopation).
{{else}}
Assume medium 120 BPM feel.
{{/if}}

{{#if includeBassline}}
**Bassline STRICT RULES:**
- Range: C2-C3 (MIDI 36-48) ONLY
- Count: 8-16 notes for {{{measures}}} bars (1-2 per bar)
- Duration: mostly 2-4 beats on strong beats
- Velocity: ~65 (consistent)
- Focus: roots and fifths
{{/if}}

{{#if includeChords}}
**Chords STRICT RULES:**
- Range: C3-C5 (MIDI 48-72) ONLY
- Count: 16-32 notes for {{{measures}}} bars (2-4 per bar)
- Duration: sustained 2-4 beats
- Velocity: 60-80 (softer than melody)
- Voicing: triads or 7ths, align with bass
{{/if}}

{{#if includeMelody}}
**Melody STRICT RULES:**
- Range: C4-C6 (MIDI 60-84) ONLY
- Count: 24-48 notes for {{{measures}}} bars (3-6 per bar)
- Duration: mix quarter/eighth/16th notes
- Motion: stepwise (1-2 semitones), occasional leaps ≤ octave
- Phrasing: add short rests
- Velocity: 80-110 (expressive)
{{/if}}

Primary progression: {{{chordProgression}}}
{{#if sectionProgressions}}
Section variants:
{{#each sectionProgressions}}- {{this}}{{/each}}
{{/if}}

Mood hints (detected: {{{mood}}}): adjust dynamics and density accordingly.

{{#if exampleMelodyJSON}}
Style reference (do NOT copy notes):
{{{exampleMelodyJSON}}}
{{/if}}

{{#if fewShotExamples}}
**REFERENCE EXAMPLES (Few-Shot Guidance):**
{{{fewShotExamples}}}
{{/if}}

{{#if intensifyDarkness}}
**DARKNESS BOOST:**
- Embrace tension: diminished, altered and chromatic passing tones are encouraged.
- Allow dissonant extensions (b9, #9, #11, b13) that resolve within 1-2 beats.
- Use dynamic contrasts and dramatic register shifts.
{{/if}}

{{#if feedback}}
**CRITICAL FEEDBACK - Fix These Issues:**
{{{feedback}}}

{{#if attemptNumber}}
This is attempt #{{{attemptNumber}}}. The previous attempts failed validation. Focus on:
- Ensuring all notes are within the specified ranges
- Creating proper voice leading between chords
- Making the melody more singable and memorable
- Respecting the {{{measures}}} bar limit
{{/if}}
{{/if}}

**OUTPUT FORMAT:**
Return a valid JSON object with three keys: "bassline", "chords", and "melody".
Each contains an array of note objects with:
- note: string (e.g., "C4") - must be a valid note name
- start: number (0.0 to {{{maxStartBeat}}}) - when the note begins
- duration: number (0.25 to 4.0) - how long it lasts
- velocity: number (0 to 127) - how loud it is
- slide: boolean - true for portamento effect

ENSURE:
- Every requested layer has at least 8 notes
- No overlapping notes within the same layer
- All start times + durations ≤ {{{totalBeats}}}
- Notes from layers that were not requested must return []
- Notes form a coherent musical composition`,
});

// Main Flow
const generateMelodyFromPromptFlow = ai.defineFlow(
  {
    name: 'generateMelodyFromPromptFlow',
    inputSchema: GenerateMelodyInputSchema,
    outputSchema: GenerateFullCompositionOutputSchema,
  },
  async ({
    prompt,
    exampleMelody,
    chordProgression: providedChordProgression,
    measures: requestedMeasures,
    tempo: requestedTempo,
    intensifyDarkness,
    gridResolution: requestedGridResolution,
    fastMode,
  }) => {
    console.log('[MELODY_GEN] === NEW REQUEST ===');

    const measures = requestedMeasures ?? 8;
    const totalBeats = measures * 4;
    const maxStartBeat = Math.max(0, totalBeats - 0.1);
    const gridResolution = requestedGridResolution ?? 0.25;

    const detectedLayers = detectLayersFromPrompt(prompt);
    const layers = detectedLayers ?? ['melody', 'chords', 'bassline'];
    const includeMelody = layers.includes('melody');
    const includeChords = layers.includes('chords');
    const includeBassline = layers.includes('bassline');

    console.log('[MELODY_GEN] Input:', JSON.stringify({
      prompt: prompt.substring(0, 50) + '...',
      measures,
      tempo: requestedTempo,
      layers: { melody: includeMelody, chords: includeChords, bassline: includeBassline },
    }, null, 2));

    const cacheKey = buildCacheKey({
      prompt,
      chordProgression: providedChordProgression,
      exampleMelody: exampleMelody || undefined,
      measures,
      layers,
      gridResolution,
      tempo: requestedTempo ?? undefined,
    });

    // Check cache
    const cached = getCachedMelody(cacheKey, totalBeats);
    if (cached) {
      console.log('[MELODY_GEN] Returning cached melody');
      return cached;
    }

    // Check pending requests
    const pending = pendingMelodyRequests.get(cacheKey);
    if (pending) {
      console.log('[MELODY_GEN] Joining in-flight generation for identical request.');
      return pending;
    }

    const generationPromise = (async () => {
      await acquireMelodySlot();
      try {
        return await generateComposition({
          prompt,
          exampleMelody: exampleMelody || undefined,
          providedChordProgression,
          measures,
          totalBeats,
          maxStartBeat,
          gridResolution,
          requestedTempo,
          intensifyDarkness,
          includeMelody,
          includeChords,
          includeBassline,
          fastMode,
        });
      } finally {
        releaseMelodySlot();
      }
    })();

    pendingMelodyRequests.set(cacheKey, generationPromise);

    try {
      let result = await generationPromise;

      if (!compositionFitsWithinBeats(result, totalBeats)) {
        console.warn('[MELODY_GEN] Composition exceeds beat limit, trimming to fit...');
        const { trimCompositionToBeats } = await import('../utils/cache-manager');
        result = trimCompositionToBeats(result, totalBeats);
        console.log('[MELODY_GEN] Composition trimmed successfully');
      }

      setCachedMelody(cacheKey, result);
      return result;
    } finally {
      pendingMelodyRequests.delete(cacheKey);
    }
  }
);

// Core generation logic
async function generateComposition(params: {
  prompt: string;
  exampleMelody?: MelodyNote[];
  providedChordProgression?: string;
  measures: number;
  totalBeats: number;
  maxStartBeat: number;
  gridResolution: number;
  requestedTempo?: number;
  intensifyDarkness?: boolean;
  includeMelody: boolean;
  includeChords: boolean;
  includeBassline: boolean;
  fastMode?: boolean;
}): Promise<GenerateFullCompositionOutput> {
  const {
    prompt,
    exampleMelody,
    providedChordProgression,
    measures,
    totalBeats,
    maxStartBeat,
    gridResolution,
    requestedTempo,
    intensifyDarkness,
    includeMelody,
    includeChords,
    includeBassline,
    fastMode,
  } = params;

  let chordProgression = providedChordProgression;
  const keyMatch = prompt.match(/([A-G][b#]?\s+(major|minor))/i);
  const key = keyMatch ? keyMatch[0] : 'A minor';
  const mood = getMoodFromPrompt(prompt, intensifyDarkness);
  const instrument = detectInstrumentFromPrompt(prompt);
  const promptTempo = extractTempoFromPromptText(prompt);
  let resolvedTempo = requestedTempo ?? promptTempo ?? undefined;
  const useIntensify = Boolean(intensifyDarkness);

  console.log(`[MELODY_GEN] Starting generation for key: ${key}`);

  let sectionProgressions: string[] | undefined;

  if (!chordProgression) {
    if (fastMode) {
      // Fast mode: użyj prostej progresji bez AI suggestions
      console.log('[MELODY_GEN] Fast mode: using simple chord progression');
      const isMinor = key.toLowerCase().includes('minor');
      chordProgression = isMinor ? 'i-iv-V-i' : 'I-V-vi-IV';  // Najprostsze progresje
      sectionProgressions = [chordProgression];
    } else {
      console.log('[MELODY_GEN] No chord progression provided, generating...');
      const chordSuggestions = await suggestChordProgressions({ key, prompt });
      sectionProgressions = selectChordProgressionForPrompt(
        prompt,
        key,
        mood,
        chordSuggestions.chordProgressions,
        instrument
      );
      chordProgression = sectionProgressions[0];
    }
  }

  if (!sectionProgressions && chordProgression) {
    sectionProgressions = [chordProgression];
  }

  const negativeFeedbackSignatures = await loadNegativeFeedbackSignatures();
  console.log(`[MELODY_GEN] Loaded ${negativeFeedbackSignatures.size} negative feedback signatures`);

  let bestOutput: GenerateFullCompositionOutput | null = null;
  let bestScore = 0;
  let feedback: string | undefined = undefined;

  const attemptsAllowed = fastMode 
    ? 1  // Fast mode: tylko 1 próba
    : Math.min(MAX_RETRIES, PER_GENERATION_REQUEST_CAP);  // Normal mode: 3 próby
  
  const qualityThreshold = fastMode ? 50 : QUALITY_THRESHOLD;  // Fast mode: niższy próg jakości
  
  console.log(`[MELODY_GEN] Mode: ${fastMode ? 'FAST' : 'NORMAL'} | Attempts: ${attemptsAllowed} | Quality threshold: ${qualityThreshold}`);

  for (let i = 0; i < attemptsAllowed; i++) {
    if (!trackUsage()) {
      throw new Error('AI usage limit reached. Please try again later.');
    }

    console.log(`[MELODY_GEN] Attempt ${i + 1}/${attemptsAllowed}`);

    const fewShotContext: FewShotContext = {
      instrument,
      key,
      mood,
      prompt,
      tempo: resolvedTempo ?? requestedTempo ?? promptTempo ?? undefined,
      keywords: extractKeywordsFromPrompt(prompt),
    };

    const { prompt: fewShotExamples, examples: fewShotExampleList } = getFewShotPromptForInstrument(fewShotContext);

    if (!chordProgression && fewShotExampleList.length > 0) {
      const exampleWithProgression = fewShotExampleList.find(
        example => typeof example.input?.chordProgression === 'string' && example.input.chordProgression.trim().length > 0
      );
      const progressionFromExample = exampleWithProgression?.input?.chordProgression?.trim();
      if (progressionFromExample) {
        chordProgression = progressionFromExample;
        sectionProgressions = [progressionFromExample];
        console.log('[FEWSHOT_CHORDS] Using progression from example:', chordProgression);
      }
    }

    const promptInput: z.infer<typeof InternalPromptInputSchema> = {
      prompt,
      chordProgression,
      sectionProgressions,
      key,
      exampleMelodyJSON: exampleMelody ? JSON.stringify(exampleMelody) : undefined,
      feedback,
      attemptNumber: i + 1,
      measures,
      totalBeats,
      maxStartBeat,
      fewShotExamples: fewShotExamples ?? undefined,
      mood,
      intensifyDarkness: useIntensify || undefined,
      includeMelody,
      includeChords,
      includeBassline,
      instrument,
      tempo: resolvedTempo ?? requestedTempo ?? promptTempo ?? undefined,
    };

    // Log request size
    const estimatedRequestSize = JSON.stringify(promptInput).length;
    console.log(`[MELODY_GEN] Request size: ~${Math.ceil(estimatedRequestSize / 4)} tokens`);

    try {
      // Użyj szybkiego promptu w fast mode
      const promptFunction = fastMode ? generateMelodyFastPrompt : generateMelodyPrompt;
      const { output } = await promptFunction(promptInput);

      if (!output || typeof output !== 'object') {
        console.warn(`[MELODY_GEN] Attempt ${i + 1}: AI returned invalid output type`);
        if (i < attemptsAllowed - 1) {
          await sleep(RETRY_BASE_DELAY_MS * 2 ** i + Math.floor(Math.random() * 250));
        }
        continue;
      }

      const candidateTempo = output.tempo ?? resolvedTempo ?? requestedTempo ?? promptTempo;
      const normalizedTempo = candidateTempo !== undefined
        ? Math.max(20, Math.min(400, Math.round(candidateTempo)))
        : undefined;

      if (normalizedTempo !== undefined) {
        resolvedTempo = normalizedTempo;
      }

      const outputWithTempo = normalizedTempo !== undefined ? { ...output, tempo: normalizedTempo } : output;

      const outputMelody = Array.isArray(outputWithTempo.melody) ? outputWithTempo.melody : [];
      const outputChords = Array.isArray(outputWithTempo.chords) ? outputWithTempo.chords : [];
      const outputBassline = Array.isArray(outputWithTempo.bassline) ? outputWithTempo.bassline : [];

      console.log(`[MELODY_GEN] AI generated: melody=${outputMelody.length} notes, chords=${outputChords.length}, bassline=${outputBassline.length}`);

      // Check negative feedback
      const signature = createCompositionSignature({ melody: outputMelody, chords: outputChords, bassline: outputBassline });

      if (negativeFeedbackSignatures.has(signature)) {
        console.warn(`[MELODY_GEN] Attempt ${i + 1}: Rejected due to negative feedback match`);
        feedback = 'This composition was previously rated poorly. Generate something completely different with fresh musical ideas.';
        if (i < attemptsAllowed - 1) {
          await sleep(RETRY_BASE_DELAY_MS * 2 ** i + Math.floor(Math.random() * 250));
        }
        continue;
      }

      // Check missing layers
      const missingLayers: string[] = [];
      if (includeMelody && (!Array.isArray(outputMelody) || outputMelody.length === 0)) missingLayers.push('melody');
      if (includeChords && (!Array.isArray(outputChords) || outputChords.length === 0)) missingLayers.push('chords');
      if (includeBassline && (!Array.isArray(outputBassline) || outputBassline.length === 0)) missingLayers.push('bassline');

      if (missingLayers.length > 0) {
        console.warn(`[MELODY_GEN] Attempt ${i + 1}: Missing required layers:`, missingLayers);
        feedback = `You must generate ALL requested layers. Missing: ${missingLayers.join(', ')}. Each layer needs at least the minimum number of notes.`;
        if (i < attemptsAllowed - 1) {
          await sleep(RETRY_BASE_DELAY_MS * 2 ** i + Math.floor(Math.random() * 250));
        }
        continue;
      }

      // NOWE: Sprawdź zakresy WCZEŚNIE (przed walidacją)
      const noteToMidi = (note: string): number => {
        const match = note.match(/^([A-G][b#]?)(-?\d+)$/);
        if (!match) return 60;
        const noteMap: Record<string, number> = {
          'C': 0, 'C#': 1, 'Db': 1, 'D': 2, 'D#': 3, 'Eb': 3,
          'E': 4, 'F': 5, 'F#': 6, 'Gb': 6, 'G': 7, 'G#': 8,
          'Ab': 8, 'A': 9, 'A#': 10, 'Bb': 10, 'B': 11
        };
        const [, noteName, octave] = match;
        return (parseInt(octave) + 1) * 12 + (noteMap[noteName] ?? 0);
      };

      const checkRangeEarly = (notes: MelodyNote[], minMidi: number, maxMidi: number, layerName: string): boolean => {
        for (const note of notes) {
          const midi = noteToMidi(note.note);
          if (midi < minMidi || midi > maxMidi) {
            console.warn(`[MELODY_GEN] Attempt ${i + 1}: ${layerName} note out of range: ${note.note} (MIDI ${midi}), expected ${minMidi}-${maxMidi}`);
            return false;
          }
        }
        return true;
      };

      // Sprawdź zakresy dla każdej warstwy (pomiń w fast mode dla szybkości)
      if (!fastMode) {
        let rangeIssues: string[] = [];
        if (includeMelody && outputMelody.length > 0 && !checkRangeEarly(outputMelody, 60, 84, 'Melody')) {
          rangeIssues.push('Melody must be C4-C6 (MIDI 60-84)');
        }
        if (includeChords && outputChords.length > 0 && !checkRangeEarly(outputChords, 48, 72, 'Chords')) {
          rangeIssues.push('Chords must be C3-C5 (MIDI 48-72)');
        }
        if (includeBassline && outputBassline.length > 0 && !checkRangeEarly(outputBassline, 36, 48, 'Bassline')) {
          rangeIssues.push('Bassline must be C2-C3 (MIDI 36-48)');
        }

        if (rangeIssues.length > 0) {
          feedback = `CRITICAL RANGE ERRORS: ${rangeIssues.join('. ')}. ALL notes must be within specified ranges. NO EXCEPTIONS.`;
          if (i < attemptsAllowed - 1) {
            await sleep(RETRY_BASE_DELAY_MS * 2 ** i + Math.floor(Math.random() * 250));
          }
          continue;
        }
      }

      // NOWE: Sprawdź liczbę nut (za dużo = chaos) - dostosuj do stylu
      const isMinimalist = /hip.?hop|trap|minimal|simple|easy/i.test(prompt);
      const isComplex = /complex|advanced|intricate|detailed|rich|elaborate/i.test(prompt);
      const isBusy = /busy|dense|fast|rapid|many.notes/i.test(prompt);

      // PRIORYTET: fastMode > busy > complex > minimalist > default
      let maxNotesPerBar;
      if (fastMode) {
        maxNotesPerBar = { melody: 3, chords: 2, bassline: 1 };  // Fast mode: umiarkowanie (więcej tolerancji)
      } else if (isBusy) {
        maxNotesPerBar = { melody: 6, chords: 4, bassline: 3 };  // Busy: dużo nut
      } else if (isComplex) {
        maxNotesPerBar = { melody: 4, chords: 4, bassline: 2 };  // Complex: średnio dużo
      } else if (isMinimalist) {
        maxNotesPerBar = { melody: 2, chords: 2, bassline: 1 };  // Hip-hop/trap: minimalistyczne
      } else {
        maxNotesPerBar = { melody: 3, chords: 3, bassline: 2 };  // Default: umiarkowane
      }
      const maxNotes = {
        melody: maxNotesPerBar.melody * measures,
        chords: maxNotesPerBar.chords * measures,
        bassline: maxNotesPerBar.bassline * measures,
      };

      let countIssues: string[] = [];
      const style = isMinimalist ? 'minimalist' : isBusy ? 'busy' : isComplex ? 'complex' : 'default';
      console.log(`[MELODY_GEN] Style: ${style} | Note counts: melody=${outputMelody.length}/${maxNotes.melody}, chords=${outputChords.length}/${maxNotes.chords}, bassline=${outputBassline.length}/${maxNotes.bassline}`);

      if (includeMelody && outputMelody.length > maxNotes.melody) {
        countIssues.push(`Melody has ${outputMelody.length} notes, max ${maxNotes.melody} (${maxNotesPerBar.melody}/bar)`);
      }
      if (includeChords && outputChords.length > maxNotes.chords) {
        countIssues.push(`Chords has ${outputChords.length} notes, max ${maxNotes.chords} (${maxNotesPerBar.chords}/bar)`);
      }
      if (includeBassline && outputBassline.length > maxNotes.bassline) {
        countIssues.push(`Bassline has ${outputBassline.length} notes, max ${maxNotes.bassline} (${maxNotesPerBar.bassline}/bar)`);
      }

      if (countIssues.length > 0) {
        if (fastMode) {
          // Fast mode: przytnij nuty zamiast retry
          console.log(`[MELODY_GEN] Fast mode: trimming excess notes instead of retry`);
          if (outputMelody.length > maxNotes.melody) {
            outputMelody.splice(maxNotes.melody);
            console.log(`[MELODY_GEN] Trimmed melody to ${outputMelody.length} notes`);
          }
          if (outputChords.length > maxNotes.chords) {
            outputChords.splice(maxNotes.chords);
            console.log(`[MELODY_GEN] Trimmed chords to ${outputChords.length} notes`);
          }
          if (outputBassline.length > maxNotes.bassline) {
            outputBassline.splice(maxNotes.bassline);
            console.log(`[MELODY_GEN] Trimmed bassline to ${outputBassline.length} notes`);
          }
          // Kontynuuj z przyciętymi nutami
        } else {
          // Normal mode: retry jak wcześniej
          console.warn(`[MELODY_GEN] Attempt ${i + 1}: Too many notes:`, countIssues);
          feedback = `TOO MANY NOTES: ${countIssues.join('. ')}. Generate FEWER notes with better spacing.`;
          if (i < attemptsAllowed - 1) {
            await sleep(RETRY_BASE_DELAY_MS * 2 ** i + Math.floor(Math.random() * 250));
          }
          continue;
        }
      }

      const estimatedTokens = Math.ceil(JSON.stringify(outputWithTempo).length / 4);
      const shouldScore = includeMelody;
      const melodyAnalysis = shouldScore && outputMelody.length > 0
        ? enhancedAnalyzeMelody(outputMelody, totalBeats, mood, useIntensify)
        : { score: 100, issues: [], avgInterval: 0, range: 0, maxInterval: 0, noteCount: outputMelody.length, rhythmicVariety: 0, coverageRatio: 0 };

      console.log(`[MELODY_GEN] Attempt ${i + 1} score: ${melodyAnalysis.score}`);

      addTokenUsage(estimatedTokens);

      if (melodyAnalysis.score > bestScore) {
        bestScore = melodyAnalysis.score;
        bestOutput = outputWithTempo;
      }

      if (melodyAnalysis.score >= qualityThreshold || !shouldScore) {
        console.log(`[MELODY_GEN] ✓ Quality threshold met on attempt ${i + 1} (score: ${melodyAnalysis.score}/${qualityThreshold})`);
        break;
      }

      let baseFeedback = melodyAnalysis.issues.length > 0
        ? melodyAnalysis.issues.join('. ') + '.'
        : 'The melody needs more musical interest and variety.';
      if (mood === 'dark' || useIntensify) {
        baseFeedback += ' Lean into tension with chromatic passing tones, minor second clashes, and unresolved suspensions.';
      }

      // Dodaj feedback o zakresach jeśli są problemy
      baseFeedback += ' CRITICAL: Melody must be C4-C6 (MIDI 60-84), Chords C3-C5 (MIDI 48-72), Bassline C2-C3 (MIDI 36-48). NO EXCEPTIONS.';

      feedback = baseFeedback;

      if (i < attemptsAllowed - 1) {
        await sleep(RETRY_BASE_DELAY_MS * 2 ** i + Math.floor(Math.random() * 250));
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`[MELODY_GEN] Error on attempt ${i + 1}:`, errorMessage);

      // Sprawdź czy to błąd 503 (przeciążenie)
      const is503Error = errorMessage.includes('503') || errorMessage.includes('overloaded');

      if (is503Error) {
        console.warn(`[MELODY_GEN] API overloaded, will retry with longer delay`);
        // Dłuższe opóźnienie dla 503
        const delay = RETRY_BASE_DELAY_MS * 3 ** i + Math.floor(Math.random() * 1000);
        console.log(`[MELODY_GEN] Waiting ${Math.round(delay / 1000)}s before retry...`);

        if (i < attemptsAllowed - 1) {
          await sleep(delay);
        } else {
          throw new Error('Gemini API is currently overloaded. Please try again in a few moments.');
        }
      } else {
        // Normalny błąd
        if (i === attemptsAllowed - 1) throw error;
        await sleep(RETRY_BASE_DELAY_MS * 2 ** i + Math.floor(Math.random() * 250));
      }
    }
  }

  if (!bestOutput) {
    throw new Error('AI failed to generate any valid composition after multiple retries.');
  }

  console.log('[MELODY_GEN] Validating and correcting output...');

  const allowChromatic = mood === 'dark' || useIntensify;

  const normalizedBestOutput = {
    melody: Array.isArray(bestOutput?.melody) ? bestOutput.melody : [],
    chords: Array.isArray(bestOutput?.chords) ? bestOutput.chords : [],
    bassline: Array.isArray(bestOutput?.bassline) ? bestOutput.bassline : [],
  };

  // Zakresy już sprawdzone w pętli retry, więc tutaj tylko walidujemy

  let validatedOutput: GenerateFullCompositionOutput;

  try {
    validatedOutput = {
      melody: safeValidateLayer(includeMelody, normalizedBestOutput.melody, key, {
        maxDuration: totalBeats,
        quantizeGrid: gridResolution,
        correctToScale: !allowChromatic,
        maxInterval: allowChromatic ? 18 : 12,
        ensureMinNotes: 12,
        allowChromatic,
      }),
      chords: safeValidateLayer(includeChords, normalizedBestOutput.chords, key, {
        maxDuration: totalBeats,
        quantizeGrid: gridResolution * 2,
        correctToScale: !(mood === 'dark' || useIntensify),
        allowChromatic,
        ensureMinNotes: 8,
      }),
      bassline: safeValidateLayer(includeBassline, normalizedBestOutput.bassline, key, {
        maxDuration: totalBeats,
        quantizeGrid: gridResolution * 4,
        correctToScale: !(mood === 'dark' || useIntensify),
        allowChromatic,
        maxInterval: allowChromatic ? 19 : 12,
        ensureMinNotes: 6,
      }),
    };
  } catch (error) {
    console.error('[MELODY_GEN] Validation error:', error);
    throw new Error('Failed to validate composition: ' + (error instanceof Error ? error.message : String(error)));
  }

  if (instrument === 'guitar' && !shouldSkipStrum(prompt) && validatedOutput.chords.length > 0) {
    const strumStep = Math.max(gridResolution / 6, 0.02);
    const strummedChords = applyGuitarStrum(validatedOutput.chords, 'up', strumStep);
    validatedOutput = { ...validatedOutput, chords: strummedChords };
  }

  const finalTempo = resolvedTempo ?? bestOutput.tempo ?? requestedTempo ?? promptTempo;
  if (finalTempo !== undefined) {
    const normalizedFinalTempo = Math.max(20, Math.min(400, Math.round(finalTempo)));
    validatedOutput = { ...validatedOutput, tempo: normalizedFinalTempo };
  }

  console.log('[MELODY_GEN] ✓ Generation complete');
  return validatedOutput;
}

export async function generateMelodyFromPrompt(input: GenerateMelodyInput): Promise<GenerateFullCompositionOutput> {
  return generateMelodyFromPromptFlow(input);
}

export { resetFewShotCache, getTotalEstimatedTokensUsed };
