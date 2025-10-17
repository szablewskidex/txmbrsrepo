
export const STYLE_PRESETS = {
  'dark-trap': {
    tempo: 140,
    quantizeGrid: 0.125,
    preferredScales: ['minor', 'phrygian', 'harmonicMinor'],
    bassPattern: 'sparse', // rzadkie, mocne uderzenia
    chordVoicing: 'low', // niższe akordy
  },
  'upbeat-pop': {
    tempo: 120,
    quantizeGrid: 0.25,
    preferredScales: ['major', 'dorian'],
    bassPattern: 'walking', // więcej ruchu
    chordVoicing: 'bright',
  },
  // ... więcej presetów
};
