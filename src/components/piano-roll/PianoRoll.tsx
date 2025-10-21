  "use client";

import React, { useState, useRef, useEffect, useCallback, useMemo, useTransition } from 'react';
import MidiWriter from 'midi-writer-js';
import { Midi } from '@tonejs/midi';
import * as Tone from 'tone';
import type { Note, GhostNote } from '@/lib/types';
import { DEFAULT_MEASURES, DEFAULT_CELL_PX, ROW_HEIGHT, DEFAULT_GRID_RESOLUTION, PIANO_KEYS, MAX_COMPOSITION_MEASURES } from '@/lib/constants';
import { indexToNote, indexToMidiNote, noteToIndex, midiToNoteName } from '@/lib/music';
import { useToast } from '@/hooks/use-toast';
import { getMidiExamplesAction, loadMidiFileAction } from '../../app/midi-actions';
import { suggestChordProgressionsAction } from '../../app/ai-actions';
import type { GenerateFullCompositionOutput, MelodyNote } from '@/lib/schemas';
import { Disc3, Loader2, ThumbsDown, ThumbsUp, Settings2, X } from 'lucide-react';

import { Toolbar } from './Toolbar';
import { PianoKeys } from './PianoKeys';
import { Grid } from './Grid';
import { ControlsPanel } from './ControlsPanel';
import { EventEditor } from './EventEditor';
import { Timeline } from './Timeline';
import { ScrollArea } from '../ui/scroll-area';
import { Progress } from '../ui/progress';
import { Button } from '../ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { Label } from '../ui/label';
import { RadioGroup, RadioGroupItem } from '../ui/radio-group';
import { Textarea } from '../ui/textarea';
import { submitFeedbackAction } from '@/app/feedback-actions';

const slugify = (input: string | undefined, maxWords: number = 3, fallback: string = 'melody') => {
  if (!input) return fallback;
  const normalized = input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .trim();

  if (!normalized) return fallback;

  const words = normalized.split(/\s+/).filter(Boolean).slice(0, maxWords);
  return words.length > 0 ? words.join('-') : fallback;
};

interface PianoRollProps {
  melody: GenerateFullCompositionOutput | null;
  onGenerateMelody: (
    prompt: string,
    key: string,
    useExample: boolean,
    chordProgression?: string,
    youtubeUrl?: string,
    exampleMelody?: MelodyNote[],
    measures?: number,
    tempo?: number,
    intensifyDarkness?: boolean,
    gridResolution?: number,
  ) => Promise<void>;
  isGenerating: boolean;
  setMelody: (melody: GenerateFullCompositionOutput | null) => void;
  generationProgress?: number;
  generationStep?: string;
}

export function PianoRoll({
  melody,
  onGenerateMelody,
  isGenerating,
  setMelody,
  generationProgress,
  generationStep,
}: PianoRollProps) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [ghostNotes, setGhostNotes] = useState<GhostNote[]>([]);
  const [measures, setMeasures] = useState(DEFAULT_MEASURES);
  const [cellPx, setCellPx] = useState(DEFAULT_CELL_PX);
  const [verticalZoom, setVerticalZoom] = useState(1);
  const [selectedNoteIds, setSelectedNoteIds] = useState<number[]>([]);
  const [activeNoteId, setActiveNoteId] = useState<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playPosition, setPlayPosition] = useState(0);
  const [chordProgressions, setChordProgressions] = useState<string[]>([]);
  const [isFetchingChords, setIsFetchingChords] = useState(false);
  const [selectedChordProgression, setSelectedChordProgression] = useState<string | undefined>(undefined);
  const [currentKey, setCurrentKey] = useState('');
  const [debouncedKey, setDebouncedKey] = useState(currentKey);
  const [bpm, setBpm] = useState(120);
  const [midiExamples, setMidiExamples] = useState<string[]>([]);
  const [selectedMidiExample, setSelectedMidiExample] = useState<string>('');
  const [lastPrompt, setLastPrompt] = useState<string>('melody');
  const [gridResolution, setGridResolution] = useState(DEFAULT_GRID_RESOLUTION);
  const [lastKey, setLastKey] = useState('');
  const [lastChordProgression, setLastChordProgression] = useState<string | undefined>(undefined);
  const [lastIntensifyDarkness, setLastIntensifyDarkness] = useState(false);
  const [feedbackState, setFeedbackState] = useState<'idle' | 'upvoted' | 'downvoted' | 'submitting'>('idle');
  const [negativeReason, setNegativeReason] = useState<'quality' | 'prompt_mismatch' | 'other'>('quality');
  const [negativeNotes, setNegativeNotes] = useState('');
  const [isFeedbackDialogOpen, setIsFeedbackDialogOpen] = useState(false);
  const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false);
  const [isSendPositivePending, startSendPositive] = useTransition();
  const [isSendNegativePending, startSendNegative] = useTransition();
  const [isControlsPanelOpen, setIsControlsPanelOpen] = useState(true);
  const [gridScrollLeft, setGridScrollLeft] = useState(0);
  const [isEventEditorCollapsed, setIsEventEditorCollapsed] = useState(false);

  const floatingPanelClasses = useMemo(() => 'mobile-controls-container', []);

  const nextId = useRef(1);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const synthRef = useRef<Tone.PolySynth | null>(null);
  const scheduledEventsRef = useRef<number[]>([]);
  const gridViewportRef = useRef<HTMLDivElement>(null);
  const pianoViewportRef = useRef<HTMLDivElement>(null);
  const isSyncingScrollRef = useRef(false);
  const lastFetchedKeyRef = useRef<string | null>(null);
  const { toast } = useToast();
  const dragUrlRef = useRef<string | null>(null);

  const compositionMeasures = MAX_COMPOSITION_MEASURES;
  const compositionBeats = compositionMeasures * 4;
  const gridBeats = measures * 4;
  const gridHeightPx = PIANO_KEYS.length * ROW_HEIGHT * verticalZoom;

  const syncPianoScroll = useCallback((scrollTop: number) => {
    const pianoViewport = pianoViewportRef.current;
    if (!pianoViewport) {
      return;
    }
    if (Math.abs(pianoViewport.scrollTop - scrollTop) > 0.5) {
      isSyncingScrollRef.current = true;
      pianoViewport.scrollTop = scrollTop;
      requestAnimationFrame(() => {
        isSyncingScrollRef.current = false;
      });
    }
  }, []);

  const handleGridScroll = useCallback(() => {
    const gridViewport = gridViewportRef.current;
    if (!gridViewport) {
      return;
    }
    setGridScrollLeft(gridViewport.scrollLeft);
    syncPianoScroll(gridViewport.scrollTop);
  }, [syncPianoScroll]);

  const handlePianoScroll = useCallback(() => {
    const pianoViewport = pianoViewportRef.current;
    const gridViewport = gridViewportRef.current;
    if (!pianoViewport || !gridViewport || isSyncingScrollRef.current) {
      return;
    }
    if (Math.abs(gridViewport.scrollTop - pianoViewport.scrollTop) > 0.5) {
      gridViewport.scrollTop = pianoViewport.scrollTop;
    }
  }, []);

  useEffect(() => {
    const gridViewport = gridViewportRef.current;
    const pianoViewport = pianoViewportRef.current;

    if (!gridViewport) {
      return;
    }

    gridViewport.scrollTo({ left: 0, top: 0 });
    if (pianoViewport) {
      pianoViewport.scrollTo({ top: 0 });
    }
    setGridScrollLeft(0);
    isSyncingScrollRef.current = false;
    handleGridScroll();
  }, [handleGridScroll, measures, cellPx, verticalZoom]);

  useEffect(() => {
    if (melody) {
      const convertAiNotes = (aiNotes: MelodyNote[]): Note[] => {
        return aiNotes
          .map(aiNote => {
            const pitchIndex = noteToIndex(aiNote.note);
            if (pitchIndex === -1) {
              console.warn(`AI generated an invalid note: ${aiNote.note}`);
              return null;
            }
            const convertedNote: Note = {
              id: nextId.current++,
              start: aiNote.start,
              duration: aiNote.duration,
              pitch: pitchIndex,
              velocity: aiNote.velocity,
              slide: aiNote.slide,
            };
            return convertedNote;
          })
          .filter((n): n is Note => n !== null);
      };

      const newMelody = convertAiNotes(melody.melody);
      const newChords = convertAiNotes(melody.chords);
      const newBassline = convertAiNotes(melody.bassline);

      const allNotes = [...newMelody, ...newChords, ...newBassline];
      allNotes.sort((a, b) => a.start - b.start);

      const totalBeatsLimit = compositionBeats;

      const clampedNotes = allNotes
        .map(note => {
          if (note.start >= totalBeatsLimit) {
            return null;
          }
          const remaining = Math.max(0, totalBeatsLimit - note.start);
          const clampedDuration = Math.min(note.duration, remaining);
          if (clampedDuration <= 0) {
            return null;
          }
          return {
            ...note,
            duration: clampedDuration,
          };
        })
        .filter((n): n is Note => n !== null);

      if (clampedNotes.length > 0) {
        setNotes(clampedNotes);
        const maxId = Math.max(...clampedNotes.map(n => n.id));
        nextId.current = maxId + 1;
      } else {
        setNotes([]);
      }
    } else {
      setNotes([]);
    }
  }, [melody, measures]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      synthRef.current = new Tone.PolySynth({
        maxPolyphony: 64,
        voice: Tone.Synth,
        options: {
          oscillator: { type: 'triangle8' },
          envelope: { attack: 0.02, decay: 0.1, sustain: 0.3, release: 1 },
        },
      }).toDestination();
      Tone.Transport.bpm.value = bpm;
    }
    return () => {
      if (synthRef.current) {
        synthRef.current.dispose();
      }
      if (Tone.Transport.state !== 'stopped') {
        Tone.Transport.stop();
      }
      Tone.Transport.cancel();
      scheduledEventsRef.current.forEach(id => Tone.Transport.clear(id));
      scheduledEventsRef.current = [];
    };
  }, [bpm]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      Tone.Transport.bpm.value = bpm;
    }
  }, [bpm]);

  useEffect(() => {
    let animationFrameId: number | null = null;

    const loop = () => {
      setPlayPosition(Tone.Transport.progress * compositionBeats);
      animationFrameId = requestAnimationFrame(loop);
    };

    if (isPlaying) {
      animationFrameId = requestAnimationFrame(loop);
    } else if (animationFrameId !== null) {
      cancelAnimationFrame(animationFrameId);
    }

    return () => {
      if (animationFrameId !== null) {
        cancelAnimationFrame(animationFrameId);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying, compositionBeats]);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedKey(currentKey);
    }, 500);

    return () => {
      clearTimeout(handler);
    };
  }, [currentKey]);

  useEffect(() => {
    if (!debouncedKey) {
      return;
    }

    if (lastFetchedKeyRef.current === debouncedKey) {
      return;
    }

    lastFetchedKeyRef.current = debouncedKey;

    const fetchChords = async () => {
      setIsFetchingChords(true);
      setChordProgressions([]);
      setSelectedChordProgression(undefined);
      try {
        const result = await suggestChordProgressionsAction({ key: debouncedKey });
        if (result.data) {
          const progressions = result.data.chordProgressions ?? [];
          setChordProgressions(progressions);
          if (progressions.length > 0) {
            setSelectedChordProgression(progressions[0]);
          }
        } else {
          toast({
            variant: 'destructive',
            title: 'Błąd przy pobieraniu akordów',
            description: result.error || 'Nieznany błąd',
          });
        }
      } catch (err) {
        console.error('Failed to fetch chord progressions:', err);
        toast({
          variant: 'destructive',
          title: 'Błąd przy pobieraniu akordów',
          description: 'Wystąpił nieoczekiwany błąd.',
        });
      } finally {
        setIsFetchingChords(false);
      }
    };
    fetchChords();
  }, [debouncedKey, toast]);

  useEffect(() => {
    const fetchMidiExamples = async () => {
      try {
        const result = await getMidiExamplesAction();
        if (result.data) {
          setMidiExamples(result.data);
        } else if (result.error) {
          console.warn('Could not load MIDI examples:', result.error);
          toast({
            variant: 'default',
            title: 'Nie udało się wczytać przykładów MIDI',
            description: result.error,
          });
        }
      } catch (err) {
        console.error('Error fetching MIDI examples:', err);
      }
    };
    fetchMidiExamples();
  }, [toast]);

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
    setSelectedNoteIds([id]);
    setActiveNoteId(id);
    const synth = synthRef.current;
    if (synth) {
      const noteName = indexToNote(pitch);
      synth.triggerAttackRelease(noteName, '8n', Tone.now(), newNote.velocity / 127);
    }
  }, []);

  const removeNote = useCallback((id: number) => {
    setNotes(ns => ns.filter(n => n.id !== id));
    setSelectedNoteIds(ids => ids.filter(nId => nId !== id));
    setActiveNoteId(current => (current === id ? null : current));
  }, []);

  const updateNote = useCallback((id: number, patch: Partial<Note>) => {
    setNotes(ns => ns.map(n => (n.id === id ? { ...n, ...patch } : n)));
  }, []);

  const getNote = (id: number) => notes.find(n => n.id === id);

  const handleSelectionChange = useCallback((ids: number[], activeId: number | null = ids.at(-1) ?? null) => {
    setSelectedNoteIds(ids);
    setActiveNoteId(activeId);
  }, []);

  const selectedNote = activeNoteId != null ? notes.find(n => n.id === activeNoteId) : undefined;
  const selectedNotes = selectedNoteIds
    .map(id => notes.find(n => n.id === id))
    .filter((n): n is Note => Boolean(n));

  useEffect(() => {
    if (currentKey) {
      setLastKey(currentKey);
    }
  }, [currentKey]);

  useEffect(() => {
    if (selectedChordProgression) {
      setLastChordProgression(selectedChordProgression);
    }
  }, [selectedChordProgression]);

  // ============================================================================
  // BRAKUJĄCE FUNKCJE
  // ============================================================================

  const scheduleNotes = useCallback(() => {
    scheduledEventsRef.current.forEach(id => Tone.Transport.clear(id));
    scheduledEventsRef.current = [];

    const synth = synthRef.current;
    if (!synth) return;

    const secondsPerBeat = 60 / bpm;
    const maxBeats = compositionBeats;

    notes
      .filter(note => note.start < maxBeats)
      .forEach(note => {
        const noteName = indexToNote(note.pitch as number);
        const time = note.start * secondsPerBeat;
        const duration = Math.min(note.duration, maxBeats - note.start) * secondsPerBeat;

        if (duration > 0) {
          const eventId = Tone.Transport.schedule(t => {
            synth.triggerAttackRelease(noteName, duration, t, note.velocity / 127);
          }, time);

          scheduledEventsRef.current.push(eventId);
        }
      });
  }, [notes, bpm, compositionBeats]);

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
      Tone.Transport.loopEnd = `${compositionMeasures}m`;
      Tone.Transport.start();
    }
    setIsPlaying(p => !p);
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

      const newBpm = midi.header.tempos[0]?.bpm || 120;
      setBpm(newBpm);

      const ppq = midi.header.ppq;
      const newNotes: Note[] = [];
      let maxTimeInBeats = 0;

      midi.tracks.forEach(track => {
        track.notes.forEach(note => {
          const pitchName = midiToNoteName(note.midi);
          const pitchIndex = noteToIndex(pitchName);

          if (pitchIndex !== -1) {
            const startInBeats = note.ticks / ppq;
            const durationInBeats = note.durationTicks / ppq;

            newNotes.push({
              id: nextId.current++,
              start: startInBeats,
              duration: durationInBeats,
              pitch: pitchIndex,
              velocity: Math.round(note.velocity * 127),
              slide: false,
            });
            maxTimeInBeats = Math.max(maxTimeInBeats, startInBeats + durationInBeats);
          }
        });
      });

      const newMeasures = Math.ceil(maxTimeInBeats / 4);
      const clampedMeasures = Math.max(4, Math.min(MAX_COMPOSITION_MEASURES, newMeasures));
      setMeasures(clampedMeasures);
      setNotes(newNotes);
      toast({ title: 'MIDI Zaimportowane', description: 'Twoja kompozycja została załadowana.' });
    } catch (error) {
      console.error('Error parsing MIDI file:', error);
      toast({
        variant: 'destructive',
        title: 'Błąd wczytywania MIDI',
        description: 'Nie udało się wczytać pliku MIDI.',
      });
    } finally {
      if (event.target) {
        event.target.value = '';
      }
    }
  };

  const buildMidiFile = () => {
    const TICKS_PER_BEAT = 480;
    const midi = new Midi();
    midi.header.setTempo(bpm);
    const track = midi.addTrack();

    const events = notes
      .filter(note => note.start < compositionBeats)
      .map(note => {
        const remainingBeats = Math.max(0, compositionBeats - note.start);
        const playableBeats = Math.min(note.duration, remainingBeats);

        if (typeof note.pitch !== 'number' || playableBeats <= 0) {
          return null;
        }

        return {
          startTicks: Math.round(note.start * TICKS_PER_BEAT),
          durationTicks: Math.max(1, Math.round(playableBeats * TICKS_PER_BEAT)),
          pitch: indexToMidiNote(note.pitch as number),
          velocity: Math.min(1, Math.max(0, note.velocity / 127)),
        };
      })
      .filter(
        (event): event is {
          startTicks: number;
          durationTicks: number;
          pitch: number;
          velocity: number;
        } => event !== null,
      )
      .sort((a, b) => a.startTicks - b.startTicks);

    if (events.length > 0) {
      const maxTicks = Math.max(...events.map(event => event.startTicks + event.durationTicks));
      console.log('[MIDI_EXPORT] Total measures ~', maxTicks / TICKS_PER_BEAT / 4, {
        notesCount: events.length,
        maxStartBeats: maxTicks / TICKS_PER_BEAT,
      });
    }

    events.forEach(event => {
      track.addNote({
        midi: event.pitch,
        ticks: event.startTicks,
        durationTicks: event.durationTicks,
        velocity: event.velocity,
      });
    });

    if (events.length === 0) {
      return null;
    }

    const midiArray = midi.toArray();
    const blob = new Blob([midiArray], { type: 'audio/midi' });
    const keySlug = slugify(currentKey, 3, 'key');
    const promptSlug = slugify(lastPrompt, 3, 'melody');
    const bpmLabel = `${Math.round(bpm)}bpm`;
    const fileName = `${keySlug}_${bpmLabel}_${promptSlug}.mid`;

    return { blob, fileName };
  };

  const exportMidi = () => {
    const file = buildMidiFile();
    if (!file) {
      toast({ variant: 'destructive', title: 'Brak nut', description: 'Nie ma czego eksportować do MIDI.' });
      return;
    }

    const url = URL.createObjectURL(file.blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast({ title: 'MIDI Eksportowane', description: 'Twoja kompozycja została pobrana.' });
  };

  const exportJson = () => {
    const currentMelody = melody?.melody ?? [];
    const exportData = currentMelody.map(n => ({
      note: n.note,
      start: n.start,
      duration: n.duration,
      velocity: n.velocity,
      slide: n.slide,
    }));
    const jsonString = JSON.stringify(exportData, null, 2);
    navigator.clipboard.writeText(jsonString).then(
      () => {
        toast({ title: 'JSON Skopiowany', description: 'Dane nut zostały skopiowane do schowka.' });
      },
      () => {
        toast({ variant: 'destructive', title: 'Błąd', description: 'Nie udało się skopiować danych JSON.' });
      },
    );
  };

  const handleDragMidiStart = async (event: React.DragEvent<HTMLButtonElement>) => {
    const file = buildMidiFile();
    if (!file) {
      event.preventDefault();
      toast({ variant: 'destructive', title: 'Brak nut', description: 'Nie ma czego przeciągnąć.' });
      return;
    }

    if (event.dataTransfer) {
      try {
        const midiFile = new File([file.blob], file.fileName, {
          type: 'audio/midi',
          lastModified: Date.now(),
        });

        if (event.dataTransfer.items && event.dataTransfer.items.add) {
          event.dataTransfer.items.add(midiFile);
          event.dataTransfer.effectAllowed = 'copy';

          const arrayBuffer = await file.blob.arrayBuffer();
          const uint8Array = new Uint8Array(arrayBuffer);
          const binaryString = uint8Array.reduce((data, byte) => data + String.fromCharCode(byte), '');
          const base64 = btoa(binaryString);

          event.dataTransfer.setData('DownloadURL', `audio/midi:${file.fileName}:data:audio/midi;base64,${base64}`);
        } else {
          const url = URL.createObjectURL(file.blob);
          dragUrlRef.current = url;
          event.dataTransfer.effectAllowed = 'copy';
          event.dataTransfer.setData('DownloadURL', `audio/midi:${file.fileName}:${url}`);
        }
      } catch (error) {
        console.error('[MIDI_DRAG] Error setting up drag data:', error);
        toast({
          variant: 'destructive',
          title: 'Błąd przeciągania',
          description: 'Nie udało się przygotować pliku do przeciągnięcia.',
        });
        event.preventDefault();
      }
    }
  };

  const handleDragMidiEnd = () => {
    dragUrlRef.current = null;
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

  const handleTimelineWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
    setCellPx(prev => Math.max(10, Math.min(100, prev * zoomFactor)));
  };

  const shouldShowFeedbackPrompt = useMemo(() => {
    return melody !== null && feedbackState === 'idle' && !isGenerating;
  }, [melody, feedbackState, isGenerating]);

  const handleSendPositiveFeedback = () => {
    if (!melody) return;
    setIsSubmittingFeedback(true);

    startSendPositive(async () => {
      try {
        const melodyData: GenerateFullCompositionOutput = {
          melody: melody.melody,
          chords: melody.chords,
          bassline: melody.bassline,
        };

        const promptForFeedback = lastPrompt?.trim() || 'melody';
        const keyForFeedback = lastKey?.trim() || currentKey || 'unknown';

        const result = await submitFeedbackAction({
          rating: 'up',
          prompt: promptForFeedback,
          key: keyForFeedback,
          chordProgression: lastChordProgression,
          intensifyDarkness: lastIntensifyDarkness,
          measures,
          tempo: bpm,
          gridResolution,
          melody: melodyData,
        });

        if (result.ok) {
          setFeedbackState('upvoted');
          toast({
            title: 'Dziękujemy!',
            description: 'Twoja pozytywna opinia została zapisana.',
          });
        } else {
          throw new Error(result.error || 'Unknown error');
        }
      } catch (error) {
        console.error('Failed to submit positive feedback:', error);
        toast({
          variant: 'destructive',
          title: 'Błąd',
          description: 'Nie udało się wysłać opinii. Spróbuj ponownie.',
        });
      } finally {
        setIsSubmittingFeedback(false);
      }
    });
  };

  const handleOpenNegativeFeedback = () => {
    setIsFeedbackDialogOpen(true);
  };

  const handleSubmitNegativeFeedback = () => {
    if (!melody) return;
    setIsSubmittingFeedback(true);

    startSendNegative(async () => {
      try {
        const melodyData: GenerateFullCompositionOutput = {
          melody: melody.melody,
          chords: melody.chords,
          bassline: melody.bassline,
        };

        const promptForFeedback = lastPrompt?.trim() || 'melody';
        const keyForFeedback = lastKey?.trim() || currentKey || 'unknown';

        const result = await submitFeedbackAction({
          rating: 'down',
          reason: negativeReason,
          notes: negativeNotes || undefined,
          prompt: promptForFeedback,
          key: keyForFeedback,
          chordProgression: lastChordProgression,
          intensifyDarkness: lastIntensifyDarkness,
          measures,
          tempo: bpm,
          gridResolution,
          melody: melodyData,
        });

        if (result.ok) {
          setFeedbackState('downvoted');
          setIsFeedbackDialogOpen(false);
          setNegativeReason('quality');
          setNegativeNotes('');
          toast({
            title: 'Dziękujemy!',
            description: 'Twoja opinia pomoże nam ulepszyć generator.',
          });
        } else {
          throw new Error(result.error || 'Unknown error');
        }
      } catch (error) {
        console.error('Failed to submit negative feedback:', error);
        toast({
          variant: 'destructive',
          title: 'Błąd',
          description: 'Nie udało się wysłać opinii. Spróbuj ponownie.',
        });
      } finally {
        setIsSubmittingFeedback(false);
      }
    });
  };

  const handleGenerateMelody = useCallback(
    async (
      prompt: string,
      key: string,
      useExample: boolean,
      chordProgression?: string,
      youtubeUrl?: string,
      exampleMelody?: MelodyNote[],
      measuresOverride?: number,
      tempoOverride?: number,
      intensifyDarkness?: boolean,
      gridResolutionOverride?: number,
    ) => {
      const promptToStore = prompt?.trim() || 'melody';
      setLastPrompt(promptToStore);
      const keyToStore = key?.trim() || currentKey || 'unknown';
      setLastKey(keyToStore);
      setLastChordProgression(chordProgression);
      setLastIntensifyDarkness(Boolean(intensifyDarkness));

      await onGenerateMelody(
        prompt,
        key,
        useExample,
        chordProgression,
        youtubeUrl,
        exampleMelody,
        measuresOverride,
        tempoOverride,
        intensifyDarkness,
        gridResolutionOverride,
      );
    },
    [currentKey, onGenerateMelody],
  );

  const controlsPanel = (
    <ControlsPanel
      measures={measures}
      setMeasures={setMeasures}
      cellPx={cellPx}
      setCellPx={setCellPx}
      verticalZoom={verticalZoom}
      setVerticalZoom={setVerticalZoom}
      selectedNote={selectedNote}
      selectedNotes={selectedNotes}
      onRemoveNote={removeNote}
      onUpdateNote={updateNote}
      onGenerateMelody={handleGenerateMelody}
      isGenerating={isGenerating}
      chordProgressions={chordProgressions}
      isFetchingChords={isFetchingChords}
      selectedChordProgression={selectedChordProgression}
      setSelectedChordProgression={setSelectedChordProgression}
      currentKey={currentKey}
      setCurrentKey={setCurrentKey}
      midiExamples={midiExamples}
      selectedMidiExample={selectedMidiExample}
      setSelectedMidiExample={setSelectedMidiExample}
      bpm={bpm}
      gridResolution={gridResolution}
      setGridResolution={setGridResolution}
    />
  );

  return (
    <div className="flex flex-col h-full w-full font-body bg-background text-foreground relative">
      {isGenerating && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="flex flex-col items-center gap-6 w-80">
            <Disc3 className="w-24 h-24 text-primary animate-spin" />
            {generationProgress !== undefined ? (
              <div className="relative w-full">
                <Progress value={generationProgress} className="w-full h-5" />
                <span className="absolute inset-0 flex items-center justify-center text-xs font-medium text-primary-foreground">
                  {generationStep || 'Generowanie melodii...'}
                </span>
              </div>
            ) : (
              <p className="text-xl text-primary-foreground">{generationStep || 'Generowanie melodii...'}</p>
            )}
          </div>
        </div>
      )}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleMidiFileChange}
        accept=".mid,.midi"
        className="hidden"
        title="Wybierz plik MIDI"
      />
      <Toolbar
        isPlaying={isPlaying}
        onPlayToggle={handlePlayToggle}
        onImportMidiClick={handleImportMidiClick}
        onExportMidi={exportMidi}
        onDragMidiStart={handleDragMidiStart}
        onDragMidiEnd={handleDragMidiEnd}
        onExportJson={exportJson}
        onToggleGhost={toggleGhostExample}
        bpm={bpm}
        onBpmChange={setBpm}
      />
      <div className="flex flex-1 flex-col lg:flex-row min-h-0">
        <div className="flex-1 min-h-0 min-w-0 grid grid-rows-[auto,1fr,auto] max-h-[calc(100vh-4.25rem)] sm:max-h-[calc(100vh-6.5rem)] pianoroll-landscape-grid">
          <div className="border-b bg-card pr-2 py-2">
            <div className="flex items-center">
              <div className="w-20 shrink-0" />
              <div className="flex-1 overflow-hidden">
                <Timeline beats={gridBeats} cellPx={cellPx} onWheel={handleTimelineWheel} scrollLeft={gridScrollLeft} />
              </div>
            </div>
          </div>
          <div className="flex min-h-0 overflow-hidden">
            <div className="relative left-0 z-20 w-20 shrink-0 overflow-hidden min-h-0">
              <div
                ref={pianoViewportRef}
                className="h-full w-full overflow-y-auto overflow-x-hidden scrollbar-hide"
                onScroll={handlePianoScroll}
              >
                <PianoKeys rowHeight={ROW_HEIGHT} verticalZoom={verticalZoom} />
              </div>
            </div>
            <div
              ref={gridViewportRef}
              className="flex-1 overflow-auto min-h-0 min-w-0 scrollbar-hide"
              onScroll={handleGridScroll}
            >
              <div
                className="relative"
                style={{ height: gridHeightPx, minWidth: gridBeats * cellPx }}
              >
                <Grid
                  notes={notes}
                  ghostNotes={ghostNotes}
                  beats={gridBeats}
                  cellPx={cellPx}
                  verticalZoom={verticalZoom}
                  playPosition={playPosition}
                  selectedNoteIds={selectedNoteIds}
                  onAddNote={addNote}
                  onUpdateNote={updateNote}
                  onRemoveNote={removeNote}
                  getNote={getNote}
                  onSelectionChange={handleSelectionChange}
                  gridResolution={gridResolution}
                />
              </div>
            </div>
          </div>
          <div className="shrink-0 border-t border-border/70 bg-card/95 backdrop-blur-lg">
            <EventEditor
              notes={notes}
              selectedNoteId={activeNoteId}
              onUpdateNote={updateNote}
              cellPx={cellPx}
              isCollapsed={isEventEditorCollapsed}
              onToggleCollapsed={() => setIsEventEditorCollapsed(value => !value)}
            />
          </div>
        </div>
      </div>

      {isControlsPanelOpen ? (
        <div className={floatingPanelClasses}>
          <div className="mobile-controls-surface">
            <div className="absolute top-2 right-2 z-10">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 rounded-full bg-black/25 hover:bg-black/35"
                onClick={() => setIsControlsPanelOpen(false)}
              >
                <X className="h-3.5 w-3.5" />
                <span className="sr-only">Ukryj panel</span>
              </Button>
            </div>
            <div className="mobile-controls-content px-4 pt-5 pb-5">
              {controlsPanel}
            </div>
          </div>
        </div>
      ) : (
        <div className="fixed bottom-[max(env(safe-area-inset-bottom,0px)+16px,24px)] right-4 z-40 lg:top-24 lg:bottom-auto lg:right-[clamp(1.5rem,4vw,3rem)]">
          <Button
            variant="secondary"
            size="icon"
            onClick={() => setIsControlsPanelOpen(true)}
            className="h-14 w-14 rounded-full shadow-lg shadow-black/40"
          >
            <Settings2 className="h-6 w-6" />
            <span className="sr-only">Pokaż ustawienia</span>
          </Button>
        </div>
      )}

      {shouldShowFeedbackPrompt && !isFeedbackDialogOpen && (
        <div className="fixed left-6 bottom-6 z-30 max-w-[22rem] animate-in fade-in slide-in-from-bottom-2">
          <div className="rounded-2xl border border-white/10 bg-card/95 shadow-xl shadow-black/40 backdrop-blur-md p-4 flex flex-col gap-3">
            <div>
              <h3 className="text-sm font-semibold">Jak oceniasz tę melodię?</h3>
              <p className="text-xs text-muted-foreground">
                Twoja opinia pomoże ulepszyć przyszłe generacje.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={handleSendPositiveFeedback}
                disabled={isSubmittingFeedback || isSendPositivePending}
                className="flex items-center gap-1"
              >
                {isSubmittingFeedback && isSendPositivePending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ThumbsUp className="h-4 w-4" />
                )}
                <span>Kciuk w górę</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleOpenNegativeFeedback}
                disabled={isSubmittingFeedback}
                className="flex items-center gap-1"
              >
                <ThumbsDown className="h-4 w-4" />
                <span>Kciuk w dół</span>
              </Button>
            </div>
          </div>
        </div>
      )}

      <Dialog open={isFeedbackDialogOpen} onOpenChange={setIsFeedbackDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Co było nie tak?</DialogTitle>
            <DialogDescription>
              Wybierz powód i opcjonalnie opisz szczegóły, abyśmy mogli poprawić przyszłe wyniki.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Powód</Label>
              <RadioGroup value={negativeReason} onValueChange={value => setNegativeReason(value as typeof negativeReason)}>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="quality" id="negative-quality" />
                  <Label htmlFor="negative-quality">Słaba jakość / nudna melodia</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="prompt_mismatch" id="negative-mismatch" />
                  <Label htmlFor="negative-mismatch">Nie pasuje do promptu</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="other" id="negative-other" />
                  <Label htmlFor="negative-other">Inny powód</Label>
                </div>
              </RadioGroup>
            </div>
            <div className="space-y-2">
              <Label htmlFor="negative-notes">Dodatkowe informacje (opcjonalnie)</Label>
              <Textarea
                id="negative-notes"
                value={negativeNotes}
                onChange={e => setNegativeNotes(e.target.value)}
                placeholder="np. zbyt jasna tonacja, za mało rytmu, itp."
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setIsFeedbackDialogOpen(false)}
              disabled={isSubmittingFeedback || isSendNegativePending}
            >
              Anuluj
            </Button>
            <Button
              onClick={handleSubmitNegativeFeedback}
              disabled={isSubmittingFeedback || isSendNegativePending}
              className="flex items-center gap-2"
            >
              {isSubmittingFeedback && isSendNegativePending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Wyślij opinię
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
