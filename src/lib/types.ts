export interface Note {
  id: number;
  start: number;
  duration: number;
  pitch: number | string; // index in PIANO_KEYS or note name string
  velocity: number;
  slide: boolean;
}

export interface GhostNote {
  start: number;
  duration: number;
  pitch: number; // index in PIANO_KEYS
}
