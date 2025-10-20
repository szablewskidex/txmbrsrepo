export const PIANO_KEYS = [
  'C1','C#1','D1','D#1','E1','F1','F#1','G1','G#1','A1','A#1','B1',
  'C2','C#2','D2','D#2','E2','F2','F#2','G2','G#2','A2','A#2','B2',
  'C3','C#3','D3','D#3','E3','F3','F#3','G3','G#3','A3','A#3','B3',
  'C4','C#4','D4','D#4','E4','F4','F#4','G4','G#4','A4','A#4','B4',
  'C5','C#5','D5','D#5','E5','F5','F#5','G5','G#5','A5','A#5','B5',
  'C6','C#6','D6','D#6','E6','F6','F#6','G6','G#6','A6','A#6','B6',
  'C7','C#7','D7','D#7','E7','F7','F#7','G7','G#7','A7','A#7','B7'
];

export const ALL_KEYS = [
    'A major', 'A minor',
    'A# major', 'A# minor',
    'B major', 'B minor',
    'C major', 'C minor',
    'C# major', 'C# minor',
    'D major', 'D minor',
    'D# major', 'D# minor',
    'E major', 'E minor',
    'F major', 'F minor',
    'F# major', 'F# minor',
    'G major', 'G minor',
    'G# major', 'G# minor',
];

export const DEFAULT_MEASURES = 8;
export const DEFAULT_CELL_PX = 40;
export const ROW_HEIGHT = 22;

export const GRID_OPTIONS = [
  { label: '1/2 beat (8th)', value: 0.5, subdivision: 2 },
  { label: '1/4 beat (16th)', value: 0.25, subdivision: 4 },
  { label: '1/6 beat (16th triplet)', value: 0.16666666666666666, subdivision: 6 },
  { label: '1/8 beat (32nd)', value: 0.125, subdivision: 8 },
  { label: '1/12 beat (32nd triplet)', value: 0.08333333333333333, subdivision: 12 },
  { label: '1/16 beat (64th)', value: 0.0625, subdivision: 16 },
] as const;

export const DEFAULT_GRID_RESOLUTION = 0.25;
export const DEFAULT_GRID_LABEL = '1/4 beat (16th)';

export function getGridLabel(value: number): string {
  const option = GRID_OPTIONS.find(opt => Math.abs(opt.value - value) < 0.0001);
  return option?.label ?? DEFAULT_GRID_LABEL;
}

export function getGridSubdivision(value: number): number {
  const option = GRID_OPTIONS.find(opt => Math.abs(opt.value - value) < 0.0001);
  return option?.subdivision ?? 4;
}

export type GridResolution = typeof GRID_OPTIONS[number]['value'];
export type GridOption = typeof GRID_OPTIONS[number];
