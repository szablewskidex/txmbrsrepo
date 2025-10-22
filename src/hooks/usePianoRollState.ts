import { useState, useRef, useCallback } from 'react';
import type { Note, GhostNote } from '@/lib/types';
import { DEFAULT_MEASURES, DEFAULT_CELL_PX, DEFAULT_GRID_RESOLUTION } from '@/lib/constants';

export interface PianoRollState {
  notes: Note[];
  ghostNotes: GhostNote[];
  measures: number;
  cellPx: number;
  verticalZoom: number;
  selectedNoteIds: number[];
  activeNoteId: number | null;
  isPlaying: boolean;
  playPosition: number;
  bpm: number;
  gridResolution: number;
  volume: number;
  instrument: 'piano' | 'guitar';
}

export function usePianoRollState() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [ghostNotes, setGhostNotes] = useState<GhostNote[]>([]);
  const [measures, setMeasures] = useState(DEFAULT_MEASURES);
  const [cellPx, setCellPx] = useState(DEFAULT_CELL_PX);
  const [verticalZoom, setVerticalZoom] = useState(1);
  const [selectedNoteIds, setSelectedNoteIds] = useState<number[]>([]);
  const [activeNoteId, setActiveNoteId] = useState<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playPosition, setPlayPosition] = useState(0);
  const [bpm, setBpm] = useState(120);
  const [gridResolution, setGridResolution] = useState(DEFAULT_GRID_RESOLUTION);
  const [volume, setVolume] = useState(75);
  const [instrument, setInstrument] = useState<'piano' | 'guitar'>('piano');
  
  const nextId = useRef(1);

  const addNote = useCallback((start: number, pitch: number) => {
    const newNote: Note = {
      id: nextId.current++,
      start,
      pitch,
      duration: 1,
      velocity: 100,
      slide: false,
    };
    setNotes(prev => [...prev, newNote]);
    return newNote.id;
  }, []);

  const updateNote = useCallback((id: number, patch: Partial<Note>) => {
    setNotes(prev => prev.map(note => note.id === id ? { ...note, ...patch } : note));
  }, []);

  const removeNote = useCallback((id: number) => {
    setNotes(prev => prev.filter(note => note.id !== id));
    setSelectedNoteIds(prev => prev.filter(nid => nid !== id));
    if (activeNoteId === id) setActiveNoteId(null);
  }, [activeNoteId]);

  const getNote = useCallback((id: number) => {
    return notes.find(note => note.id === id);
  }, [notes]);

  const clearNotes = useCallback(() => {
    setNotes([]);
    setSelectedNoteIds([]);
    setActiveNoteId(null);
  }, []);

  return {
    // State
    notes,
    ghostNotes,
    measures,
    cellPx,
    verticalZoom,
    selectedNoteIds,
    activeNoteId,
    isPlaying,
    playPosition,
    bpm,
    gridResolution,
    volume,
    instrument,
    nextId,
    
    // Setters
    setNotes,
    setGhostNotes,
    setMeasures,
    setCellPx,
    setVerticalZoom,
    setSelectedNoteIds,
    setActiveNoteId,
    setIsPlaying,
    setPlayPosition,
    setBpm,
    setGridResolution,
    setVolume,
    setInstrument,
    
    // Actions
    addNote,
    updateNote,
    removeNote,
    getNote,
    clearNotes,
  };
}
