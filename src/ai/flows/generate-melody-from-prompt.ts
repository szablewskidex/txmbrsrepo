
'use server';
/**
 * @fileOverview AI melody generation flow with improved prompt engineering.
 *
 * - generateMelodyFromPrompt - A function that generates a melody based on a text prompt.
 */

import {ai} from '@/ai/genkit';
import {z} from 'zod';
import { suggestChordProgressions } from './suggest-chord-progressions';
import { 
  GenerateMelodyInputSchema,
  GenerateFullCompositionOutputSchema,
  type GenerateMelodyInput, 
  type GenerateFullCompositionOutput,
  MelodyNote
} from '@/lib/schemas';
import { validateAndCorrectMelody, analyzeMelody } from '@/lib/melody-validator';

// ============================================================================
// ENHANCED SCHEMA WITH MORE CONTEXT
// ============================================================================

const InternalPromptInputSchema = z.object({
  prompt: z.string(),
  chordProgression: z.string(),
  key: z.string(), // Dodane: przekazuj key bezpośrednio
  exampleMelodyJSON: z.string().optional(),
  feedback: z.string().optional(),
  attemptNumber: z.number().optional(), // Dodane: informuj AI o próbie
});

// ============================================================================
// ULEPSZONA STRUKTURA PROMPTA
// ============================================================================

const generateMelodyPrompt = ai.definePrompt({
  name: 'generateFullCompositionPrompt',
  input: {schema: InternalPromptInputSchema},
  output: {schema: GenerateFullCompositionOutputSchema},
  prompt: `You are an expert music composer and theorist specializing in modern production. Your task is to generate a complete, musically coherent polyphonic composition with three distinct layers: bassline, chords, and melody.

**CRITICAL RULES (DO NOT VIOLATE):**
1. The composition MUST be EXACTLY 8 bars long (beats 0.0 to 32.0)
2. All note start times MUST be between 0.0 and 31.9
3. No note should extend beyond beat 32.0 (start + duration ≤ 32)
4. No gaps longer than 2 beats in any layer
5. All notes must be in the key of {{{key}}}
6. Follow the chord progression strictly: {{{chordProgression}}}

**LAYER SPECIFICATIONS:**

**1. BASSLINE (Foundation)**
   - Range: C2 to C3 (MIDI 36-48)
   - Rhythm: Use half notes (2 beats) or whole notes (4 beats) primarily
   - Timing: Place notes on strong beats (0, 4, 8, 12, 16, 20, 24, 28)
   - Velocity: 60-80 (consistent, solid)
   - Notes: Use ROOT notes of each chord, occasionally the 5th
   - Duration: Typically 2-4 beats per note
   - Slide: Use sparingly (max 2-3 times) for smooth transitions
   
   Example pattern for Am-G-C-F (8 bars):
   [
     {note: "A2", start: 0, duration: 4, velocity: 70, slide: false},
     {note: "A2", start: 4, duration: 4, velocity: 70, slide: false},
     {note: "G2", start: 8, duration: 4, velocity: 70, slide: false},
     {note: "G2", start: 12, duration: 4, velocity: 70, slide: false},
     {note: "C3", start: 16, duration: 4, velocity: 70, slide: false},
     {note: "C3", start: 20, duration: 4, velocity: 70, slide: false},
     {note: "F2", start: 24, duration: 4, velocity: 70, slide: false},
     {note: "F2", start: 28, duration: 4, velocity: 70, slide: false}
   ]

**2. CHORDS (Harmony)**
   - Range: C3 to C5 (MIDI 48-72)
   - Rhythm: Use whole notes (4 beats) or half notes (2 beats)
   - Timing: Align with bassline changes, start on beats 0, 4, 8, 12, 16, 20, 24, 28
   - Velocity: 70-90 (softer than melody)
   - Notes: Create triads using root, 3rd, and 5th of each chord
   - Duration: 2-4 beats, ensure smooth voice leading
   - Slide: false (no portamento on chords)
   
   For each chord, create 3 notes simultaneously:
   - Am = A3, C4, E4
   - G = G3, B3, D4
   - C = C4, E4, G4
   - F = F3, A3, C4
   
   Example for first Am chord:
   [
     {note: "A3", start: 0, duration: 4, velocity: 75, slide: false},
     {note: "C4", start: 0, duration: 4, velocity: 80, slide: false},
     {note: "E4", start: 0, duration: 4, velocity: 85, slide: false}
   ]

**3. MELODY (Top Line)**
   - Range: C4 to C6 (MIDI 60-84)
   - Rhythm: VARIED - use quarter notes (1 beat), eighth notes (0.5 beats), occasional sixteenth notes (0.25 beats)
   - Timing: Can start on any beat or subdivision
   - Velocity: 90-110 (dynamic, louder than other layers)
   - Notes: Use scale notes, passing tones, chord tones
   - Duration: 0.25 to 2 beats (varied for interest)
   - Slide: Use for expressive slides (2-4 times per 8 bars)
   
   MELODIC PRINCIPLES:
   - Start phrases on chord tones
   - Use stepwise motion (1-2 semitones) 70% of the time
   - Occasional leaps (3-7 semitones) for interest
   - Avoid leaps larger than an octave (12 semitones)
   - Create call-and-response patterns (bar 1-2 = call, bar 3-4 = response)
   - Rest occasionally (gaps of 0.5-1 beat) for breathing room
   - Peak around bar 5-6, resolve in bar 7-8

**STYLISTIC INTERPRETATION:**
User Prompt: "{{{prompt}}}"

Interpret this prompt as follows:
- "dark" / "sad" / "melancholic" → Use minor key, lower velocities (60-90), longer note durations, descending melodic lines
- "trap" / "hip-hop" → Use syncopation, off-beat placements, shorter chords (2 beats), stuttering melody rhythms
- "aggressive" / "intense" → Higher velocities (90-120), larger intervals, more dissonance, shorter durations
- "chill" / "lo-fi" / "smooth" → Lower velocities (50-80), stepwise motion, longer durations, minimal syncopation
- "upbeat" / "happy" / "energetic" → Major-sounding melody (even in minor key), faster note density, higher velocities
- "emotional" / "cinematic" → Wide dynamic range, expressive slides, build from soft to loud
- "minimal" / "simple" → Fewer notes, longer durations, repetitive patterns
- "complex" / "jazz" → More notes, chromaticism, unexpected intervals, varied rhythms

{{#if exampleMelodyJSON}}
**STYLE REFERENCE (Do NOT copy):**
The following melody is provided ONLY to understand:
- The rhythmic density (how many notes per bar)
- The general mood and energy level
- The phrase structure

DO NOT copy the specific notes, intervals, or exact rhythm. Create something new that captures the same FEEL.

Reference: {{{exampleMelodyJSON}}}
{{/if}}

{{#if feedback}}
**CRITICAL FEEDBACK - Fix These Issues:**
{{{feedback}}}

{{#if attemptNumber}}
This is attempt #{{{attemptNumber}}}. The previous attempts failed validation. Focus on:
- Ensuring all notes are within the specified ranges
- Creating proper voice leading between chords
- Making the melody more singable and memorable
{{/if}}
{{/if}}

**OUTPUT FORMAT:**
Return a valid JSON object with three keys: "bassline", "chords", and "melody".
Each contains an array of note objects with:
- note: string (e.g., "C4") - must be a valid note name
- start: number (0.0 to 31.9) - when the note begins
- duration: number (0.25 to 4.0) - how long it lasts
- velocity: number (0 to 127) - how loud it is
- slide: boolean - true for portamento effect

ENSURE:
- Every layer has at least 8 notes
- No overlapping notes within the same layer
- All start times + durations ≤ 32.0
- Notes form a coherent musical composition`,
});

// ============================================================================
// QUALITY THRESHOLDS AND RETRY LOGIC
// ============================================================================

const MAX_RETRIES = 3;
const QUALITY_THRESHOLD = 70;

// Ulepszona analiza z bardziej szczegółowymi metrykami
interface EnhancedMelodyAnalysis {
  score: number;
  issues: string[];
  avgInterval: number;
  range: number;
  maxInterval: number;
  noteCount: number;
  rhythmicVariety: number;
  coverageRatio: number; // Ile z 32 beatów jest pokrytych
}

function enhancedAnalyzeMelody(melody: MelodyNote[], key: string): EnhancedMelodyAnalysis {
  const baseAnalysis = analyzeMelody(melody);
  
  // Oblicz pokrycie czasowe
  let coveredBeats = 0;
  melody.forEach(note => {
    coveredBeats += note.duration;
  });
  const coverageRatio = coveredBeats / 32;
  
  // Oceń różnorodność rytmiczną
  const durations = melody.map(n => n.duration);
  const uniqueDurations = new Set(durations).size;
  const rhythmicVariety = durations.length > 0 ? uniqueDurations / durations.length : 0;
  
  // Zbierz problemy
  const issues: string[] = [];
  
  if (baseAnalysis.avgInterval < 2 && baseAnalysis.avgInterval > 0) {
    issues.push("Melody is too monotonic - use intervals of 2-5 semitones more often");
  }
  if (baseAnalysis.avgInterval > 5) {
    issues.push("Melody jumps too much - use more stepwise motion (1-2 semitones)");
  }
  if (baseAnalysis.range < 12 && baseAnalysis.range > 0) {
    issues.push("Melodic range is too narrow - expand to at least one octave (12 semitones)");
  }
  if (baseAnalysis.maxInterval > 12) {
    issues.push("Contains intervals larger than an octave - keep leaps under 12 semitones");
  }
  if (melody.length < 8) {
    issues.push("Too few notes - add more to create a fuller melody");
  }
  if (coverageRatio < 0.6) {
    issues.push("Melody has too many gaps - fill in more of the 32 beats");
  }
  if (rhythmicVariety < 0.3) {
    issues.push("Rhythm is too repetitive - vary note durations more");
  }
  
  // Penalizuj za każdy problem
  let score = baseAnalysis.score;
  score -= issues.length * 5;
  
  return {
    score: Math.max(0, Math.min(100, score)),
    issues,
    avgInterval: baseAnalysis.avgInterval,
    range: baseAnalysis.range,
    maxInterval: baseAnalysis.maxInterval,
    noteCount: melody.length,
    rhythmicVariety,
    coverageRatio,
  };
}

// ============================================================================
// MAIN FLOW
// ============================================================================

const generateMelodyFromPromptFlow = ai.defineFlow(
  {
    name: 'generateMelodyFromPromptFlow',
    inputSchema: GenerateMelodyInputSchema,
    outputSchema: GenerateFullCompositionOutputSchema,
  },
  async ({ prompt, exampleMelody, chordProgression: providedChordProgression }) => {
    // Extract key from prompt
    let chordProgression = providedChordProgression;
    const keyMatch = prompt.match(/([A-G][b#]?\s+(major|minor))/i);
    const key = keyMatch ? keyMatch[0] : 'A minor';

    console.log(`[MELODY_GEN] Starting generation for key: ${key}`);

    // Get chord progression if not provided
    if (!chordProgression) {
      console.log('[MELODY_GEN] No chord progression provided, generating...');
      const chordSuggestions = await suggestChordProgressions({ key });
      if (chordSuggestions.chordProgressions.length > 0) {
        chordProgression = chordSuggestions.chordProgressions[0];
        console.log(`[MELODY_GEN] Using chord progression: ${chordProgression}`);
      } else {
        console.warn('[MELODY_GEN] Failed to get AI chord suggestions, using fallback');
        chordProgression = key.toLowerCase().includes('minor') ? 'Am-G-C-F' : 'C-G-Am-F';
      }
    }
    
    let bestOutput: GenerateFullCompositionOutput | null = null;
    let bestScore = 0;
    let feedback: string | undefined = undefined;

    // Retry loop z ulepszoną logiką
    for (let i = 0; i < MAX_RETRIES; i++) {
        console.log(`[MELODY_GEN] Attempt ${i + 1}/${MAX_RETRIES}`);
        
        const promptInput: z.infer<typeof InternalPromptInputSchema> = {
            prompt,
            chordProgression,
            key,
            exampleMelodyJSON: exampleMelody ? JSON.stringify(exampleMelody) : undefined,
            feedback,
            attemptNumber: i + 1,
        };

        try {
          const { output } = await generateMelodyPrompt(promptInput);
          
          if (!output || !output.melody || output.melody.length === 0) {
              console.warn(`[MELODY_GEN] Attempt ${i + 1}: AI returned empty output`);
              continue;
          }
          
          // Ulepszona analiza
          const melodyAnalysis = enhancedAnalyzeMelody(output.melody, key);
          
          console.log(`[MELODY_GEN] Attempt ${i + 1} score: ${melodyAnalysis.score}`, {
            noteCount: melodyAnalysis.noteCount,
            avgInterval: melodyAnalysis.avgInterval.toFixed(2),
            range: melodyAnalysis.range,
            rhythmicVariety: (melodyAnalysis.rhythmicVariety * 100).toFixed(0) + '%',
            coverage: (melodyAnalysis.coverageRatio * 100).toFixed(0) + '%',
          });
          
          // Zachowaj najlepszy wynik
          if (melodyAnalysis.score > bestScore) {
            bestScore = melodyAnalysis.score;
            bestOutput = output;
          }
          
          // Jeśli spełnia próg, zakończ
          if (melodyAnalysis.score >= QUALITY_THRESHOLD) {
              console.log(`[MELODY_GEN] ✓ Quality threshold met on attempt ${i + 1}`);
              break;
          }

          // Przygotuj bardziej szczegółowy feedback
          feedback = melodyAnalysis.issues.length > 0 
            ? melodyAnalysis.issues.join('. ') + '.'
            : 'The melody needs more musical interest and variety.';
          
          if (i === MAX_RETRIES - 1) {
              console.warn(`[MELODY_GEN] Max retries reached. Best score: ${bestScore}`);
          }
          
        } catch (error) {
          console.error(`[MELODY_GEN] Error on attempt ${i + 1}:`, error);
          if (i === MAX_RETRIES - 1) throw error;
        }
    }

    if (!bestOutput) {
        throw new Error("AI failed to generate any valid composition after multiple retries.");
    }
    
    console.log('[MELODY_GEN] Validating and correcting output...');
    
    // Final validation z ulepszonymi opcjami
    const validatedOutput: GenerateFullCompositionOutput = {
      melody: validateAndCorrectMelody(bestOutput.melody, key, { 
        maxDuration: 32, 
        quantizeGrid: 1/32, 
        correctToScale: true, 
        maxInterval: 12,
        ensureMinNotes: 12, // Dodaj minimum 12 nut w melodii
      }),
      chords: validateAndCorrectMelody(bestOutput.chords, key, { 
        maxDuration: 32, 
        quantizeGrid: 1/16, 
        correctToScale: true,
        ensureMinNotes: 8, // Minimum 8 akordów
      }),
      bassline: validateAndCorrectMelody(bestOutput.bassline, key, { 
        maxDuration: 32, 
        quantizeGrid: 1/8, 
        correctToScale: true,
        ensureMinNotes: 8, // Minimum 8 nut w basie
      }),
    };
    
    console.log('[MELODY_GEN] ✓ Generation complete');
    
    return validatedOutput;
  }
);

export async function generateMelodyFromPrompt(input: GenerateMelodyInput): Promise<GenerateFullCompositionOutput> {
  return generateMelodyFromPromptFlow(input);
}
