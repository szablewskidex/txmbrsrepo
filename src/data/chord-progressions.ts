export type LocalChordProgressions = Record<string, string[]>;

const BASE_PROGRESSIONS: LocalChordProgressions = {
  'c major': ['C-G-Am-F', 'C-Am-F-G', 'F-C-Dm-Bb'],
  'a minor': ['Am-G-F-E', 'Am-F-C-G', 'Am-Dm-E-Am'],
  'g major': ['G-D-Em-C', 'G-Em-C-D', 'G-Bm-Em-C'],
  'e minor': ['Em-C-G-D', 'Em-D-C-G', 'Em-Bm-C-Am'],
  'd major': ['D-A-Bm-G', 'D-G-A-D', 'D-Bm-G-A'],
  'b minor': ['Bm-G-D-A', 'Bm-A-G-F#', 'Bm-Em-F#m-Bm'],
  'a major': ['A-D-E-A', 'A-F#m-D-E', 'A-Bm-F#m-D'],
  'f# minor': ['F#m-D-A-E', 'F#m-E-D-C#m', 'F#m-Bm-C#m-F#m'],
  'e major': ['E-B-C#m-A', 'E-A-E-B', 'E-G#m-C#m-A'],
  'c# minor': ['C#m-A-E-B', 'C#m-B-A-E', 'C#m-G#m-A-B'],
  'f major': ['F-C-Dm-Bb', 'F-Bb-C-F', 'F-Am-Bb-C'],
  'd minor': ['Dm-Bb-F-C', 'Dm-C-Bb-A', 'Dm-Gm-C-A'],
  'bb major': ['Bb-F-Gm-Eb', 'Bb-Eb-Gm-F', 'Bb-Dm-Gm-Eb'],
  'g minor': ['Gm-Eb-F-D', 'Gm-Dm-Eb-F', 'Gm-Bb-Dm-F'],
  'eb major': ['Eb-Bb-Cm-Ab', 'Eb-Ab-Bb-Eb', 'Eb-Cm-Ab-Bb'],
  'c minor': ['Cm-Ab-Bb-G', 'Cm-Gm-Ab-Eb', 'Cm-Fm-G-Ab'],
  'ab major': ['Ab-Eb-Fm-Db', 'Ab-Db-Eb-Ab', 'Ab-Fm-Db-Eb'],
  'f minor': ['Fm-Db-Eb-C', 'Fm-Cm-Db-Eb', 'Fm-Ab-Db-Eb'],
  'db major': ['Db-Ab-Bbm-Gb', 'Db-Gb-Ab-Db', 'Db-Fm-Gb-Ab'],
  'bb minor': ['Bbm-Gb-Ab-Eb', 'Bbm-Ebm-F-Eb', 'Bbm-Db-Ebm-F'],
  'gb major': ['Gb-Db-Ebm-Cb', 'Gb-Cb-Db-Gb', 'Gb-Ebm-Db-Cb'],
  'eb minor': ['Ebm-Cb-Db-Bb', 'Ebm-Bbm-Cb-Db', 'Ebm-Abm-Bbm-Db'],
};

const KEY_SYNONYMS: Record<string, string[]> = {
  'c major': ['c major', 'cmaj', 'c ionian'],
  'a minor': ['a minor', 'am', 'a aeolian'],
  'g major': ['g major', 'gmaj'],
  'e minor': ['e minor', 'em'],
  'd major': ['d major', 'dmaj'],
  'b minor': ['b minor', 'bm'],
  'a major': ['a major', 'amaj'],
  'f# minor': ['f# minor', 'f#m'],
  'e major': ['e major', 'emaj'],
  'c# minor': ['c# minor', 'c#m'],
  'f major': ['f major', 'fmaj'],
  'd minor': ['d minor', 'dm'],
  'bb major': ['bb major', 'bbmaj'],
  'g minor': ['g minor', 'gm'],
  'eb major': ['eb major', 'ebmaj'],
  'c minor': ['c minor', 'cm'],
  'ab major': ['ab major', 'abmaj'],
  'f minor': ['f minor', 'fm'],
  'db major': ['db major', 'dbmaj'],
  'bb minor': ['bb minor', 'bbm'],
  'gb major': ['gb major', 'gbmaj'],
  'eb minor': ['eb minor', 'ebm'],
};

const RELATIVE_KEY_MAP: Record<string, string> = {
  'c major': 'a minor',
  'a minor': 'c major',
  'g major': 'e minor',
  'e minor': 'g major',
  'd major': 'b minor',
  'b minor': 'd major',
  'a major': 'f# minor',
  'f# minor': 'a major',
  'e major': 'c# minor',
  'c# minor': 'e major',
  'f major': 'd minor',
  'd minor': 'f major',
  'bb major': 'g minor',
  'g minor': 'bb major',
  'eb major': 'c minor',
  'c minor': 'eb major',
  'ab major': 'f minor',
  'f minor': 'ab major',
  'db major': 'bb minor',
  'bb minor': 'db major',
  'gb major': 'eb minor',
  'eb minor': 'gb major',
};

const ROMAN_TO_DEGREE: Record<string, number> = {
  I: 1,
  II: 2,
  III: 3,
  IV: 4,
  V: 5,
  VI: 6,
  VII: 7,
};

const MAJOR_KEY_CHORDS: Record<string, [string, string, string, string, string, string, string]> = {
  'c major': ['C', 'Dm', 'Em', 'F', 'G', 'Am', 'Bdim'],
  'g major': ['G', 'Am', 'Bm', 'C', 'D', 'Em', 'F#dim'],
  'd major': ['D', 'Em', 'F#m', 'G', 'A', 'Bm', 'C#dim'],
  'a major': ['A', 'Bm', 'C#m', 'D', 'E', 'F#m', 'G#dim'],
  'e major': ['E', 'F#m', 'G#m', 'A', 'B', 'C#m', 'D#dim'],
  'f major': ['F', 'Gm', 'Am', 'Bb', 'C', 'Dm', 'Edim'],
  'bb major': ['Bb', 'Cm', 'Dm', 'Eb', 'F', 'Gm', 'Adim'],
  'eb major': ['Eb', 'Fm', 'Gm', 'Ab', 'Bb', 'Cm', 'Ddim'],
  'ab major': ['Ab', 'Bbm', 'Cm', 'Db', 'Eb', 'Fm', 'Gdim'],
  'db major': ['Db', 'Ebm', 'Fm', 'Gb', 'Ab', 'Bbm', 'Cdim'],
  'gb major': ['Gb', 'Abm', 'Bbm', 'Cb', 'Db', 'Ebm', 'Fdim'],
};

const MINOR_KEY_CHORDS: Record<string, [string, string, string, string, string, string, string]> = {
  'a minor': ['Am', 'Bdim', 'C', 'Dm', 'Em', 'F', 'G'],
  'e minor': ['Em', 'F#dim', 'G', 'Am', 'Bm', 'C', 'D'],
  'b minor': ['Bm', 'C#dim', 'D', 'Em', 'F#m', 'G', 'A'],
  'f# minor': ['F#m', 'G#dim', 'A', 'Bm', 'C#m', 'D', 'E'],
  'c# minor': ['C#m', 'D#dim', 'E', 'F#m', 'G#m', 'A', 'B'],
  'd minor': ['Dm', 'Edim', 'F', 'Gm', 'Am', 'Bb', 'C'],
  'g minor': ['Gm', 'Adim', 'Bb', 'Cm', 'Dm', 'Eb', 'F'],
  'c minor': ['Cm', 'Ddim', 'Eb', 'Fm', 'Gm', 'Ab', 'Bb'],
  'f minor': ['Fm', 'Gdim', 'Ab', 'Bbm', 'Cm', 'Db', 'Eb'],
  'bb minor': ['Bbm', 'Cdim', 'Db', 'Ebm', 'Fm', 'Gb', 'Ab'],
  'eb minor': ['Ebm', 'Fdim', 'Gb', 'Abm', 'Bbm', 'Cb', 'Db'],
};

const MAJOR_ROMAN_TEMPLATES = ['I-vi', 'I-V-IV', 'I-V-vi-IV', 'ii-V-I', 'I-I-I-I'];
const MINOR_ROMAN_TEMPLATES = ['i-v', 'VI-v-i', 'i-III-VI-VII', 'i-VI-v-i', 'III-i', 'i-VI-VII-v', 'i-i-i-i'];

function normalizeKey(key: string): string {
  return key.trim().toLowerCase();
}

function getChordFromRoman(key: string, mode: 'major' | 'minor', token: string): string | null {
  const romanNormalized = token.replace(/[^ivIV]/g, '').toUpperCase();
  if (!romanNormalized) {
    return null;
  }
  const degree = ROMAN_TO_DEGREE[romanNormalized];
  if (!degree) {
    return null;
  }
  const chords = mode === 'major' ? MAJOR_KEY_CHORDS[key] : MINOR_KEY_CHORDS[key];
  if (!chords) {
    return null;
  }
  return chords[degree - 1] ?? null;
}

function expandTemplate(key: string, template: string, mode: 'major' | 'minor'): string | null {
  const sanitized = template.replace(/→/g, '-');
  const tokens = sanitized.split('-').map(part => part.trim()).filter(Boolean);
  if (tokens.length === 0) {
    return null;
  }
  const chordNames: string[] = [];
  for (const token of tokens) {
    const chord = getChordFromRoman(key, mode, token);
    if (!chord) {
      return null;
    }
    chordNames.push(chord);
  }
  return chordNames.join('-');
}

function buildLocalProgressions(): LocalChordProgressions {
  const result: LocalChordProgressions = {};
  for (const [canonicalKey, baseProgressions] of Object.entries(BASE_PROGRESSIONS)) {
    const normalizedKey = normalizeKey(canonicalKey);
    const mode: 'major' | 'minor' = normalizedKey.includes('minor') ? 'minor' : 'major';
    const templateSet = mode === 'major' ? MAJOR_ROMAN_TEMPLATES : MINOR_ROMAN_TEMPLATES;
    const merged = new Set(baseProgressions.map(progress => progress.trim()).filter(Boolean));

    templateSet.forEach(template => {
      const expanded = expandTemplate(normalizedKey, template, mode);
      if (expanded) {
        merged.add(expanded);
      }
    });

    result[normalizedKey] = Array.from(merged);
  }
  return result;
}

const LOCAL_CHORD_PROGRESSIONS: LocalChordProgressions = buildLocalProgressions();

const SYNONYM_LOOKUP = new Map<string, string>();
for (const [canonical, synonyms] of Object.entries(KEY_SYNONYMS)) {
  SYNONYM_LOOKUP.set(normalizeKey(canonical), canonical);
  for (const synonym of synonyms) {
    SYNONYM_LOOKUP.set(normalizeKey(synonym), canonical);
  }
}

export function findLocalChordProgressions(key: string): string[] | undefined {
  const normalized = normalizeKey(key);
  const canonical = SYNONYM_LOOKUP.get(normalized);

  if (canonical && LOCAL_CHORD_PROGRESSIONS[canonical]) {
    return LOCAL_CHORD_PROGRESSIONS[canonical];
  }

  if (canonical) {
    const relative = RELATIVE_KEY_MAP[canonical];
    if (relative && LOCAL_CHORD_PROGRESSIONS[relative]) {
      return LOCAL_CHORD_PROGRESSIONS[relative];
    }
  }

  return undefined;
}

export function listAvailableProgressionKeys(): string[] {
  return Object.keys(LOCAL_CHORD_PROGRESSIONS);
}
