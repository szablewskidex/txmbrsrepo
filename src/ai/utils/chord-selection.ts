import { createHash } from 'crypto';

export type Mood = 'dark' | 'bright' | 'neutral';
export type InstrumentFocus = 'piano' | 'guitar' | 'strings' | 'synth' | 'bass';

const DEFAULT_MINOR_PROGRESSIONS = [
  'Am-G-F-E',
  'Am-F-Dm-E',
  'Dm-Bb-Gm-A',
  'Em-C-Am-B7',
  'Am-Em-F-G',
  'Am-C-G-F',
  'Dm-Am-Bb-G',
];

const DARK_MINOR_PROGRESSIONS = [
  'Am-F-E7-Am',
  'Dm-Bb-Gm-A',
  'Cm-Ab-G-Gm',
  'Bm-G-Em-F#',
  'Em-C-Am-B7',
  'Fm-Db-Ebm-C',
  'Gm-Eb-F-D',
  'Cm-G-Ab-Bb',
];

const DEFAULT_MAJOR_PROGRESSIONS = [
  'C-G-Am-F',
  'C-F-Am-G',
  'G-D-Em-C',
  'F-C-Dm-Bb',
  'C-Am-F-G',
  'C-Dm-Am-G',
  'F-G-Em-Am',
];

export function pickProgressionFromList(list: string[], seed: string, key: string): string {
  if (list.length === 0) return 'Am-G-F-E';
  
  const hash = createHash('sha256').update(`${seed}|${key}`).digest('hex');
  const baseIndex = parseInt(hash.slice(0, 8), 16) % list.length;
  const randomOffset = list.length > 1 ? Math.floor(Math.random() * Math.min(list.length, 3)) : 0;
  const index = (baseIndex + randomOffset) % list.length;
  
  return list[index];
}

export function filterSuggestionsByMood(
  suggestions: string[],
  mood: Mood,
  prompt: string,
  instrument?: InstrumentFocus
): string[] {
  if (suggestions.length === 0) return suggestions;
  
  const promptLower = prompt.toLowerCase();
  const TRAP_KEYWORDS = ['trap', 'hip-hop', 'hip hop', 'bass'];
  const MINIMAL_KEYWORDS = ['minimal', 'sparse', 'simple'];
  const COMPLEX_KEYWORDS = ['complex', 'jazz', 'fusion', 'chromatic'];

  // Instrument-specific filtering
  if (instrument === 'guitar') {
    const guitarFriendly = suggestions.filter(prog => prog.split('-').filter(Boolean).length <= 4);
    if (guitarFriendly.length > 0) return guitarFriendly;
  }

  if (instrument === 'piano') {
    const pianoFriendly = suggestions.filter(prog => {
      const chords = prog.split('-').filter(Boolean);
      return chords.length >= 4 || /maj7|sus|dim|add|m7|7/.test(prog.toLowerCase());
    });
    if (pianoFriendly.length > 0) return pianoFriendly;
  }

  // Style-specific filtering
  if (TRAP_KEYWORDS.some(kw => promptLower.includes(kw))) {
    const simple = suggestions.filter(prog => prog.split('-').filter(Boolean).length <= 3);
    if (simple.length > 0) return simple;
  }

  if (MINIMAL_KEYWORDS.some(kw => promptLower.includes(kw))) {
    const repetitive = suggestions.filter(prog => {
      const chords = prog.split('-').map(c => c.trim()).filter(Boolean);
      return new Set(chords).size <= 3;
    });
    if (repetitive.length > 0) return repetitive;
  }

  if (COMPLEX_KEYWORDS.some(kw => promptLower.includes(kw))) {
    const complex = suggestions.filter(prog => prog.split('-').filter(Boolean).length >= 5);
    if (complex.length > 0) return complex;
  }

  // Mood filtering
  const darkFilter = (prog: string) => /m|dim|sus|#|7/i.test(prog);
  if (mood === 'dark') {
    const filtered = suggestions.filter(darkFilter);
    return filtered.length > 0 ? filtered : suggestions;
  }
  if (mood === 'bright') {
    const filtered = suggestions.filter(prog => !darkFilter(prog));
    return filtered.length > 0 ? filtered : suggestions;
  }
  
  return suggestions;
}

export function selectChordProgressionForPrompt(
  prompt: string,
  key: string,
  mood: Mood,
  suggestions?: string[],
  instrument?: InstrumentFocus
): string[] {
  const normalizedKey = key.toLowerCase();
  const isMinorKey = normalizedKey.includes('minor');

  const filteredSuggestions = suggestions?.length 
    ? filterSuggestionsByMood(suggestions, mood, prompt, instrument) 
    : undefined;
    
  const pool = filteredSuggestions && filteredSuggestions.length > 0
    ? filteredSuggestions
    : mood === 'dark' || isMinorKey
      ? (isMinorKey ? DARK_MINOR_PROGRESSIONS : DEFAULT_MINOR_PROGRESSIONS)
      : DEFAULT_MAJOR_PROGRESSIONS;

  if (pool.length <= 2) {
    return [pickProgressionFromList(pool, `${prompt}|sectionA`, key)];
  }

  const first = pickProgressionFromList(pool, `${prompt}|sectionA`, key);
  let remaining = pool.filter(p => p !== first);
  if (remaining.length === 0) remaining = pool;
  
  const second = pickProgressionFromList(remaining, `${prompt}|sectionB`, key);
  remaining = remaining.filter(p => p !== second);
  
  const third = pickProgressionFromList(remaining.length > 0 ? remaining : pool, `${prompt}|sectionC`, key);

  return [first, second, third];
}
