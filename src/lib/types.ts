export interface Note {
  id: number;
  start: number;
  duration: number;
  pitch: number;
  velocity: number;
  slide: boolean;
}

export interface GhostNote {
  start: number;
  duration: number;
  pitch: number; // index in PIANO_KEYS
}
