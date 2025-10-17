
'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import MidiWriter from 'midi-writer-js';
import { Midi } from '@tonejs/midi';
import * as Tone from 'tone';
import type { Note, GhostNote } from '@/lib/types';
import { DEFAULT_BEATS, DEFAULT_CELL_PX, ROW_HEIGHT } from '@/lib/constants';
import { indexToNote, indexToMidiNote, noteToIndex, midiToNoteName } from '@/lib/music';
import { useToast } from "@/hooks/use-toast";
import { generateMelodyAction, suggestChordProgressionsAction, analyzeAndGenerateAction } from '@/app/actions';
import type { GenerateMelodyOutput } from '@/lib/schemas';

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
  const [chordProgressions, setChordProgressions] = useState<string[]>([]);
  const [currentKey, setCurrentKey] = useState('A minor');

  const nextId = useRef(1);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const synthRef = useRef<Tone.PolySynth | null>(null);
  const scheduledEventsRef = useRef<number[]>([]);
  const { toast } = useToast();
  
  // Initialize Tone.js
  useEffect(() => {
    synthRef.current = new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: 'fmsquare' },
        envelope: { attack: 0.02, decay: 0.1, sustain: 0.3, release: 1 }
    }).toDestination();
    // Clean up on unmount
    return () => {
        synthRef.current?.dispose();
        Tone.Transport.cancel();
    }
  }, []);
  
  // Playback logic with Tone.js
  useEffect(() => {
    let animationFrameId: number;

    const loop = (time: number) => {
        setPlayPosition(Tone.Transport.seconds / Tone.Time('1m').toSeconds() * (Tone.Transport.bpm.value || 120));
        animationFrameId = requestAnimationFrame(loop);
    };

    if (isPlaying) {
        animationFrameId = requestAnimationFrame(loop);
    } else {
        cancelAnimationFrame(animationFrameId!);
    }

    return () => cancelAnimationFrame(animationFrameId);
  }, [isPlaying]);

   // Fetch chord progressions when the key changes
   useEffect(() => {
    const fetchChords = async () => {
      const result = await suggestChordProgressionsAction({ key: currentKey });
      if (result.data) {
        setChordProgressions(result.data.chordProgressions);
      } else {
        toast({
          variant: "destructive",
          title: "Błąd przy pobieraniu akordów",
          description: result.error || "Nieznany błąd",
        });
      }
    };
    fetchChords();
  }, [currentKey, toast]);


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
    // Play sound on add
    const synth = synthRef.current;
    if (synth) {
      const noteName = indexToNote(pitch);
      synth.triggerAttackRelease(noteName, "8n", Tone.now(), newNote.velocity / 127);
    }
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

  const scheduleNotes = useCallback(() => {
    // Clear previously scheduled events
    scheduledEventsRef.current.forEach(id => Tone.Transport.clear(id));
    scheduledEventsRef.current = [];

    const synth = synthRef.current;
    if (!synth) return;
    
    // Schedule new events
    notes.forEach(note => {
        const noteName = indexToNote(note.pitch as number);
        const eventId = Tone.Transport.schedule(time => {
            synth.triggerAttackRelease(noteName, note.duration, time, note.velocity / 127);
        }, note.start);
        scheduledEventsRef.current.push(eventId);
    });
  }, [notes]);
  
  const handlePlayToggle = async () => {
    if (Tone.context.state !== 'running') {
        await Tone.start();
    }
    
    if (isPlaying) {
        Tone.Transport.stop();
        setPlayPosition(0);
    } else {
        scheduleNotes();
        Tone.Transport.loop = true;
        Tone.Transport.loopEnd = beats;
        Tone.Transport.start();
    }
    setIsPlaying(p => !p);
  };


  const exportMidi = () => {
    const track = new MidiWriter.Track();
    track.addEvent(new MidiWriter.ProgramChangeEvent({ instrument: 1 }));
    
    notes.forEach(note => {
      track.addEvent(new MidiWriter.NoteEvent({
        pitch: [indexToMidiNote(note.pitch as number)],
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
    toast({ title: "MIDI Eksportowane", description: "Twoja kompozycja została pobrana." });
  };

  const exportJson = () => {
    const exportData = notes.map(n => ({
        note: indexToNote(n.pitch as number),
        start: n.start,
        duration: n.duration,
        velocity: n.velocity,
        slide: n.slide,
    }));
    const jsonString = JSON.stringify(exportData, null, 2);
    navigator.clipboard.writeText(jsonString).then(() => {
        toast({ title: "JSON Skopiowany", description: "Dane nut zostały skopiowane do schowka." });
    }, () => {
        toast({ variant: "destructive", title: "Błąd", description: "Nie udało się skopiować danych JSON." });
    });
  };

  const handleImportMidiClick = () => {
    fileInputRef.current?.click();
  };

  const handleMidiFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const arrayBuffer = await file.arrayBuffer();
      const midi = new Midi(arrayBuffer);
      
      const newNotes: Note[] = [];
      let maxTime = 0;

      midi.tracks.forEach(track => {
        track.notes.forEach(note => {
            const pitchName = midiToNoteName(note.midi);
            const pitchIndex = noteToIndex(pitchName);

            if (pitchIndex !== -1) {
                newNotes.push({
                    id: nextId.current++,
                    start: note.time, // time is in seconds, convert to beats
                    duration: note.duration,
                    pitch: pitchIndex,
                    velocity: Math.round(note.velocity * 127),
                    slide: false,
                });
                maxTime = Math.max(maxTime, note.time + note.duration);
            }
        });
      });

      // Assuming default tempo of 120 bpm, 1 beat = 0.5s
      // We will need a more robust time-to-beat conversion if we add tempo controls.
      const bpm = midi.header.tempos[0]?.bpm || 120;
      Tone.Transport.bpm.value = bpm;
      const secondsPerBeat = 60 / bpm;
      
      const importedNotes = newNotes.map(n => ({
        ...n,
        start: n.start / secondsPerBeat,
        duration: n.duration / secondsPerBeat,
      }));

      const newBeats = Math.ceil(maxTime / secondsPerBeat / 4) * 4;
      setBeats(Math.max(DEFAULT_BEATS, newBeats));
      setNotes(importedNotes);
      toast({ title: "MIDI Zaimportowane", description: "Twoja kompozycja została załadowana." });

    } catch (error) {
      console.error("Error parsing MIDI file:", error);
      toast({ variant: "destructive", title: "Błąd Importu", description: "Nie udało się przetworzyć pliku MIDI." });
    } finally {
        // Reset file input
        if(event.target) {
            event.target.value = '';
        }
    }
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

  const handleGenerateMelody = async (prompt: string, useExample: boolean, chordProgression?: string, youtubeUrl?: string) => {
    setIsGenerating(true);
  
    const processAndSetNotes = (data: GenerateMelodyOutput | null) => {
        if (!data) return;
        const aiNotes: Note[] = data.map(aiNote => {
            const pitch = noteToIndex(aiNote.note);
            if (pitch === -1) {
              console.warn(`AI wygenerowało nieprawidłową nutę: ${aiNote.note}`);
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
          
          if (useExample || youtubeUrl) {
            setNotes(aiNotes);
          } else {
            setNotes(prev => [...prev, ...aiNotes]);
          }
          toast({ title: "Melodia Wygenerowana", description: "AI stworzyło nową kompozycję." });
    }


    if (youtubeUrl) {
        const result = await analyzeAndGenerateAction({ youtubeUrl, targetPrompt: prompt });
        if (result.error) {
            toast({ variant: "destructive", title: "Błąd Analizy YouTube", description: result.error });
        } else {
            processAndSetNotes(result.data);
        }
    } else {
         // Extract key from prompt to suggest chords if needed, or to inform the AI
        const keyMatch = prompt.match(/([A-G][b#]?\s+(major|minor))/i);
        const key = keyMatch ? keyMatch[0] : currentKey;
        if (key !== currentKey) {
          setCurrentKey(key);
        }
      
        const exampleMelody = useExample ? notes.map(n => ({
            note: indexToNote(n.pitch as number),
            start: n.start,
            duration: n.duration,
            velocity: n.velocity,
            slide: n.slide,
        })) : undefined;
      
        const result = await generateMelodyAction({ prompt, exampleMelody, chordProgression });
        
        if (result.error) {
          toast({ variant: "destructive", title: "Błąd AI", description: result.error });
        } else {
            processAndSetNotes(result.data);
        }
    }
    
    setIsGenerating(false);
  };

  const selectedNote = notes.find(n => n.id === selectedNoteId);

  return (
    <div className="flex flex-col h-full w-full font-body bg-background text-foreground">
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleMidiFileChange}
        accept=".mid,.midi"
        className="hidden"
      />
      <Toolbar
        isPlaying={isPlaying}
        onPlayToggle={handlePlayToggle}
        onImportMidiClick={handleImportMidiClick}
        onExportMidi={exportMidi}
        onExportJson={exportJson}
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
          chordProgressions={chordProgressions}
        />
      </div>
    </div>
  );
}
