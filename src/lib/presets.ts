// Preset System for Quick Generation

export interface Preset {
  id: string;
  name: string;
  key: string;
  chordProgression?: string;
  tempo: number;
  measures: number;
  intensifyDarkness: boolean;
  gridResolution: number;
  prompt: string;
  category: 'trap' | 'hip-hop' | 'house' | 'ambient' | 'custom';
}

export const DEFAULT_PRESETS: Preset[] = [
  // Trap
  {
    id: 'dark-trap-140',
    name: 'Dark Trap 140 BPM',
    key: 'A minor',
    chordProgression: 'Am-Dm',
    tempo: 140,
    measures: 8,
    intensifyDarkness: true,
    gridResolution: 0.125,
    prompt: 'dark trap melody with 808s, minor bassline, hard drums',
    category: 'trap',
  },
  {
    id: 'melodic-trap-150',
    name: 'Melodic Trap 150 BPM',
    key: 'F# minor',
    chordProgression: 'F#m-C#m',
    tempo: 150,
    measures: 8,
    intensifyDarkness: false,
    gridResolution: 0.125,
    prompt: 'melodic trap with piano, emotional melody, minor key',
    category: 'trap',
  },

  // Hip-Hop
  {
    id: 'lofi-hiphop-85',
    name: 'Lo-fi Hip-Hop 85 BPM',
    key: 'C major',
    chordProgression: 'C-Am-F-G',
    tempo: 85,
    measures: 8,
    intensifyDarkness: false,
    gridResolution: 0.25,
    prompt: 'lo-fi hip-hop with jazz chords, chill melody, vinyl warmth',
    category: 'hip-hop',
  },
  {
    id: 'boom-bap-90',
    name: 'Boom Bap 90 BPM',
    key: 'E minor',
    chordProgression: 'Em-Am',
    tempo: 90,
    measures: 8,
    intensifyDarkness: false,
    gridResolution: 0.25,
    prompt: 'boom bap hip-hop, classic drums, simple melody',
    category: 'hip-hop',
  },

  // House
  {
    id: 'tech-house-128',
    name: 'Tech House 128 BPM',
    key: 'G minor',
    chordProgression: 'Gm-Dm-Bb-F',
    tempo: 128,
    measures: 8,
    intensifyDarkness: false,
    gridResolution: 0.25,
    prompt: 'tech house with driving bassline, minimal melody, four-on-floor',
    category: 'house',
  },
  {
    id: 'deep-house-122',
    name: 'Deep House 122 BPM',
    key: 'D minor',
    chordProgression: 'Dm-Gm-C-F',
    tempo: 122,
    measures: 8,
    intensifyDarkness: false,
    gridResolution: 0.25,
    prompt: 'deep house with warm pads, smooth bassline, soulful melody',
    category: 'house',
  },

  // Ambient
  {
    id: 'dark-ambient-70',
    name: 'Dark Ambient 70 BPM',
    key: 'B minor',
    chordProgression: 'Bm-Em-F#m-Bm',
    tempo: 70,
    measures: 8,
    intensifyDarkness: true,
    gridResolution: 0.5,
    prompt: 'dark ambient with reverb, atmospheric pads, minimal melody',
    category: 'ambient',
  },
];

class PresetManager {
  private customPresets: Preset[] = [];

  constructor() {
    this.loadCustomPresets();
  }

  getAllPresets(): Preset[] {
    return [...DEFAULT_PRESETS, ...this.customPresets];
  }

  getPresetsByCategory(category: Preset['category']): Preset[] {
    return this.getAllPresets().filter(p => p.category === category);
  }

  getPreset(id: string): Preset | undefined {
    return this.getAllPresets().find(p => p.id === id);
  }

  saveCustomPreset(preset: Omit<Preset, 'id'>): Preset {
    const newPreset: Preset = {
      ...preset,
      id: `custom-${Date.now()}`,
      category: 'custom',
    };

    this.customPresets.push(newPreset);
    this.saveCustomPresets();
    return newPreset;
  }

  deleteCustomPreset(id: string): boolean {
    const index = this.customPresets.findIndex(p => p.id === id);
    if (index === -1) return false;

    this.customPresets.splice(index, 1);
    this.saveCustomPresets();
    return true;
  }

  private loadCustomPresets() {
    try {
      const stored = localStorage.getItem('pianoroll-custom-presets');
      if (stored) {
        this.customPresets = JSON.parse(stored);
      }
    } catch (e) {
      console.warn('[PRESETS] Failed to load custom presets:', e);
      this.customPresets = [];
    }
  }

  private saveCustomPresets() {
    try {
      localStorage.setItem('pianoroll-custom-presets', JSON.stringify(this.customPresets));
    } catch (e) {
      console.warn('[PRESETS] Failed to save custom presets:', e);
    }
  }
}

export const presetManager = new PresetManager();

// Helper function to apply preset to form
export function applyPreset(preset: Preset) {
  return {
    prompt: preset.prompt,
    key: preset.key,
    chordProgression: preset.chordProgression,
    tempo: preset.tempo,
    measures: preset.measures,
    intensifyDarkness: preset.intensifyDarkness,
    gridResolution: preset.gridResolution,
  };
}