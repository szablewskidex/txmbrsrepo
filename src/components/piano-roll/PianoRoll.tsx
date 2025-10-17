'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import MidiWriter from 'midi-writer-js';
import type { Note, GhostNote } from '@/lib/types';
import { DEFAULT_BEATS, DEFAULT_CELL_PX, ROW_HEIGHT, PIANO_KEYS } from '@/lib/constants';
import { indexToNote, indexToMidiNote, noteToIndex } from '@/lib/music';
import { useToast } from "@/hooks/use-toast";
import { generateMelodyAction } from '@/app/actions';

import { Toolbar } from './Toolbar';
import { PianoKeys } from './PianoKeys';
import { Grid } from './Grid';
import { ControlsPanel } from './ControlsPanel';
import { EventEditor } from './EventEditor';

export function PianoRoll() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [ghostNotes, setGhostNotes] = useState<GhostNote[]>([]);
  const [beats, setBeats] = useState(DEFAULT_BEATS);
  const [cellPx, setCellPx] = useState(DEFAULT_CELL_PX);
  const [verticalZoom, setVerticalZoom] = useState(1);
  const [selectedNoteId, setSelectedNoteId] = useState<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playPosition, setPlayPosition] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);

  const nextId = useRef(1);
  const { toast } = useToast();

  useEffect(() => {
    let animationFrameId: number;
    if (isPlaying) {
      const loop = () => {
        setPlayPosition(p => (p + 0.05) % beats);
        animationFrameId = requestAnimationFrame(loop);
      };
      animationFrameId = requestAnimationFrame(loop);
    }
    return () => cancelAnimationFrame(animationFrameId);
  }, [isPlaying, beats]);

  const addNote = useCallback((start: number, pitch: number) => {
    const id = nextId.current++;
    const newNote: Note = {
      id,
      start: Math.floor(start),
      pitch,
      duration: 1,
      velocity: 100,
      slide: false,
    };
    setNotes(ns => [...ns, newNote]);
    setSelectedNoteId(id);
  }, []);

  const removeNote = useCallback((id: number) => {
    setNotes(ns => ns.filter(n => n.id !== id));
    if (selectedNoteId === id) {
      setSelectedNoteId(null);
    }
  }, [selectedNoteId]);

  const updateNote = useCallback((id: number, patch: Partial<Note>) => {
    setNotes(ns => ns.map(n => (n.id === id ? { ...n, ...patch } : n)));
  }, []);
  
  const getNote = (id: number) => notes.find(n => n.id === id);

  const exportMidi = () => {
    const track = new MidiWriter.Track();
    track.addEvent(new MidiWriter.ProgramChangeEvent({ instrument: 1 }));
    
    notes.forEach(note => {
      track.addEvent(new MidiWriter.NoteEvent({
        pitch: [indexToMidiNote(note.pitch)],
        duration: `T${Math.round(note.duration * 96)}`, // Assuming 96 ticks per beat (quarter note)
        startTick: note.start * 96,
        velocity: Math.round(note.velocity / 127 * 100),
      }));
    });

    const write = new MidiWriter.Writer([track]);
    const dataUri = write.dataUri();
    const a = document.createElement('a');
    a.href = dataUri;
    a.download = 'pianoroll-export.mid';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    toast({ title: "MIDI Exported", description: "Your composition has been downloaded." });
  };
  
  const toggleGhostExample = () => {
    if (ghostNotes.length > 0) {
      setGhostNotes([]);
    } else {
      setGhostNotes([
        { start: 2, pitch: noteToIndex('E4'), duration: 1 },
        { start: 6, pitch: noteToIndex('G4'), duration: 1 },
      ]);
    }
  };

  const handleGenerateMelody = async (prompt: string) => {
    setIsGenerating(true);
    const result = await generateMelodyAction(prompt);
    
    if (result.error) {
      toast({ variant: "destructive", title: "AI Error", description: result.error });
    } else if (result.data) {
      const aiNotes: Note[] = result.data.map(aiNote => {
        const pitch = noteToIndex(aiNote.note);
        if (pitch === -1) {
          console.warn(`AI generated an unmappable note: ${aiNote.note}`);
          return null;
        }
        return {
          id: nextId.current++,
          start: aiNote.start,
          duration: aiNote.duration,
          pitch,
          velocity: aiNote.velocity,
          slide: aiNote.slide,
        };
      }).filter((n): n is Note => n !== null);
      
      setNotes(prev => [...prev, ...aiNotes]);
      toast({ title: "Melody Generated", description: "AI has added new notes to your composition." });
    }
    
    setIsGenerating(false);
  };

  const selectedNote = notes.find(n => n.id === selectedNoteId);

  return (
    <div className="flex flex-col h-full w-full font-body bg-background text-foreground">
      <Toolbar
        isPlaying={isPlaying}
        onPlayToggle={() => setIsPlaying(p => !p)}
        onExportMidi={exportMidi}
        onToggleGhost={toggleGhostExample}
      />
      <div className="flex flex-1 overflow-hidden">
        <PianoKeys rowHeight={ROW_HEIGHT} verticalZoom={verticalZoom} />
        <div className="flex-1 flex flex-col overflow-hidden">
          <Grid
            notes={notes}
            ghostNotes={ghostNotes}
            beats={beats}
            cellPx={cellPx}
            verticalZoom={verticalZoom}
            playPosition={playPosition}
            onAddNote={addNote}
            onUpdateNote={updateNote}
            getNote={getNote}
            selectedNoteId={selectedNoteId}
            onSelectNote={setSelectedNoteId}
          />
          <EventEditor
            notes={notes}
            selectedNoteId={selectedNoteId}
            onUpdateNote={updateNote}
            cellPx={cellPx}
          />
        </div>
        <ControlsPanel
          beats={beats}
          setBeats={setBeats}
          cellPx={cellPx}
          setCellPx={setCellPx}
          verticalZoom={verticalZoom}
          setVerticalZoom={setVerticalZoom}
          selectedNote={selectedNote}
          onRemoveNote={removeNote}
          onUpdateNote={updateNote}
          onGenerateMelody={handleGenerateMelody}
          isGenerating={isGenerating}
        />
      </div>
    </div>
  );
}
