export type Mood = 'dark' | 'bright' | 'neutral';
export type InstrumentFocus = 'piano' | 'guitar' | 'strings' | 'synth' | 'bass';
export type Layer = 'melody' | 'chords' | 'bassline';

const DARK_KEYWORDS = ['dark', 'mrocz', 'ominous', 'gloom', 'brood', 'haunt', 'evil', 'sinister', 'melanch', 'noir'];
const BRIGHT_KEYWORDS = ['happy', 'bright', 'joy', 'uplift', 'sunny', 'energetic', 'funky'];
const KEYWORD_STOP_WORDS = new Set([
  'the', 'and', 'with', 'that', 'this', 'into', 'from', 'your', 'feel', 'like', 'make',
  'melody', 'music', 'song', 'track', 'riff', 'beat', 'style', 'vibe', 'sound', 'tempo',
  'bpm', 'minor', 'major', 'slow', 'fast', 'dark', 'bright', 'guitar', 'piano', 'bass', 'strings', 'synth',
  'in', 'at', 'for', 'on', 'by', 'of', 'to', 'a', 'an', 'is', 'are', 'be', 'it', 'as', 'up', 'down', 'soft', 'hard',
]);

export function normalizeKeyLabel(key?: string): string | undefined {
  if (!key) return undefined;
  const match = key.match(/([a-g][b#]?)[\s-]*(major|minor)/i);
  if (!match) return undefined;
  const tonic = match[1].toUpperCase();
  const mode = match[2].toLowerCase();
  return `${tonic}-${mode}`;
}

export function parseKeyInfo(key?: string): { tonic: string; mode: 'major' | 'minor' } | undefined {
  const normalized = normalizeKeyLabel(key);
  if (!normalized) return undefined;
  const [tonic, mode] = normalized.split('-');
  if (!tonic || !mode) return undefined;
  return { tonic, mode: mode === 'major' ? 'major' : 'minor' };
}

export function extractTempoFromPromptText(prompt?: string): number | undefined {
  if (!prompt) return undefined;
  const match = prompt.match(/(\d{2,3})\s*(?:bpm|beats?\s*per\s*minute)/i);
  if (match) {
    const tempo = Number(match[1]);
    if (!Number.isNaN(tempo)) {
      return tempo;
    }
  }
  return undefined;
}

export function extractKeywordsFromPrompt(prompt?: string): string[] {
  if (!prompt) return [];

  const tokens = prompt
    .toLowerCase()
    .split(/[^a-z0-9#+]+/)
    .map(token => token.trim())
    .filter(Boolean)
    .filter(token => token.length >= 2 || /\d/.test(token))
    .filter(token => !KEYWORD_STOP_WORDS.has(token));

  return Array.from(new Set(tokens));
}

function promptContainsKeyword(prompt: string, keywords: string[]): boolean {
  const lower = prompt.toLowerCase();
  return keywords.some(keyword => lower.includes(keyword));
}

export function getMoodFromPrompt(prompt: string, intensifyDarkness?: boolean): Mood {
  if (intensifyDarkness || promptContainsKeyword(prompt, DARK_KEYWORDS)) {
    return 'dark';
  }
  if (promptContainsKeyword(prompt, BRIGHT_KEYWORDS)) {
    return 'bright';
  }
  return 'neutral';
}

export function detectInstrumentFromPrompt(prompt: string): InstrumentFocus | undefined {
  const lower = prompt.toLowerCase();
  if (/(grand|upright|felt)?\s?piano|keys|keyboard|rhodes|keyscape/.test(lower)) {
    return 'piano';
  }
  if (/guitar|strum|acoustic|electric|nylon|six-string|strat|les paul/.test(lower)) {
    return 'guitar';
  }
  if (/string ensemble|strings|violin|cello|orchestral/.test(lower)) {
    return 'strings';
  }
  if (/synth|pad|plucks|lead synth|analog/.test(lower)) {
    return 'synth';
  }
  if (/bass guitar|slap bass|808|sub bass/.test(lower)) {
    return 'bass';
  }
  return undefined;
}

export function detectLayersFromPrompt(prompt: string): Layer[] | undefined {
  const lower = prompt.toLowerCase();

  const layerSelectionPatterns = [
    /\b(just|only|solely)\s+(the\s+)?(melody|melodic|lead|top\s*line)\b/i,
    /\b(just|only|solely)\s+(the\s+)?(bass|bassline|bass\s*line)\b/i,
    /\b(just|only|solely)\s+(the\s+)?(chord|chords|harmony|harmonic)\b/i,
    /\bmelody\s+only\b/i,
    /\bbassline\s+only\b/i,
    /\bchords\s+only\b/i,
  ];

  const excludePatterns = [
    /\bonly\s+\d+/i,
    /\bjust\s+\d+/i,
    /\bonly\s+a\s+few/i,
    /\bonly\s+some/i,
  ];

  const hasBassline = /\b(bass|bassline|bass\s*line)\b/i.test(lower);
  const hasChords = /\b(chord|chords|harmony|harmonic)\b/i.test(lower);
  const hasMelody = /\b(melody|melodic|lead|top\s*line)\b/i.test(lower);

  const hasLayerSelection = layerSelectionPatterns.some(pattern => pattern.test(lower));

  const withoutPatterns = [
    /\b(without|no|skip)\s+(the\s+)?(melody|melodic|lead|top\s*line)\b/i,
    /\b(without|no|skip)\s+(the\s+)?(chord|chords|harmony|harmonic)\b/i,
    /\b(without|no|skip)\s+(the\s+)?(bass|bassline|bass\s*line)\b/i,
    /\b(melody|melodic|lead|top\s*line)\s+(excluded|removed)\b/i,
    /\b(chord|chords|harmony|harmonic)\s+(excluded|removed)\b/i,
    /\b(bass|bassline|bass\s*line)\s+(excluded|removed)\b/i,
  ];

  const hasWithout = withoutPatterns.some(pattern => pattern.test(lower));

  const isFalsePositive = excludePatterns.some(pattern => pattern.test(lower));
  if (isFalsePositive && !hasLayerSelection && !hasWithout) {
    console.log('[LAYER_DETECT] Ignoring "only/just" - refers to quantity, not layers');
    return undefined;
  }

  if (hasLayerSelection) {
    const layers: Layer[] = [];
    if (hasBassline) layers.push('bassline');
    if (hasChords) layers.push('chords');
    if (hasMelody) layers.push('melody');

    if (layers.length > 0) {
      console.log('[LAYER_DETECT] Detected specific layers from prompt:', layers);
      return layers;
    }
  }

  if (hasWithout) {
    const allLayers: Layer[] = ['melody', 'chords', 'bassline'];
    const excluded: Layer[] = [];

    if (/\b(without|no|skip)\s+(the\s+)?(bass|bassline|bass\s*line)\b/i.test(lower) || /\b(bass|bassline|bass\s*line)\s+(excluded|removed)\b/i.test(lower)) {
      excluded.push('bassline');
    }
    if (/\b(without|no|skip)\s+(the\s+)?(chord|chords|harmony|harmonic)\b/i.test(lower) || /\b(chord|chords|harmony|harmonic)\s+(excluded|removed)\b/i.test(lower)) {
      excluded.push('chords');
    }
    if (/\b(without|no|skip)\s+(the\s+)?(melody|melodic|lead|top\s*line)\b/i.test(lower) || /\b(melody|melodic|lead|top\s*line)\s+(excluded|removed)\b/i.test(lower)) {
      excluded.push('melody');
    }

    if (excluded.length > 0) {
      const result = allLayers.filter(l => !excluded.includes(l));
      console.log('[LAYER_DETECT] Excluding layers:', excluded, 'Result:', result);
      return result;
    }
  }

  console.log('[LAYER_DETECT] No layer keywords found, generating all layers');
  return undefined;
}

export function shouldSkipStrum(prompt: string): boolean {
  const lower = prompt.toLowerCase();
  return lower.includes('no strum') || lower.includes('bez strum');
}
