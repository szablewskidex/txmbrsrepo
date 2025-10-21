'use client';

import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Play, Pause, Download, Ghost, FileJson, Upload, Move } from 'lucide-react';
import React from 'react';
import { Input } from '../ui/input';
import { Label } from '../ui/label';

interface ToolbarProps {
  isPlaying: boolean;
  onPlayToggle: () => void;
  onExportMidi: () => void;
  onDragMidiStart?: (event: React.DragEvent<HTMLButtonElement>) => void;
  onDragMidiEnd?: () => void;
  onExportJson: () => void;
  onImportMidiClick: () => void;
  onToggleGhost: () => void;
  bpm: number;
  onBpmChange: (bpm: number) => void;
}

export function Toolbar({ 
  isPlaying, onPlayToggle, onExportMidi, onDragMidiStart, onDragMidiEnd, onExportJson, onImportMidiClick, onToggleGhost,
  bpm, onBpmChange
}: ToolbarProps) {
  const [bpmInput, setBpmInput] = React.useState<string>(() => (Number.isFinite(bpm) ? String(bpm) : ''));

  React.useEffect(() => {
    const nextValue = Number.isFinite(bpm) ? String(bpm) : '';
    setBpmInput(nextValue);
  }, [bpm]);

  const handleBpmChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = event.target.value;
    setBpmInput(rawValue);

    const parsed = Number.parseInt(rawValue, 10);
    if (!Number.isNaN(parsed)) {
      const clamped = Math.min(240, Math.max(40, parsed));
      if (clamped !== bpm) {
        onBpmChange(clamped);
      }
    }
  };

  return (
    <header className="flex items-center h-12 px-3 bg-card border-b shrink-0 sm:h-14 sm:px-4">
      <h1 className="text-lg font-bold tracking-tight text-foreground sm:text-xl">PianoRoll<span className="text-primary">AI</span></h1>
      <Separator orientation="vertical" className="h-6 mx-3 sm:mx-4" />
      <div className="flex items-center gap-1.5 sm:gap-2">
        <Button variant="ghost" size="icon" onClick={onPlayToggle}>
          {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
          <span className="sr-only">{isPlaying ? 'Pauza' : 'Odtwarzaj'}</span>
        </Button>
         <div className="flex items-center gap-1.5 sm:gap-2">
            <Label htmlFor="bpm" className="text-sm font-medium">BPM</Label>
            <Input
                id="bpm"
                type="number"
                value={bpmInput}
                onChange={handleBpmChange}
                className="w-16 h-8 sm:w-20"
                min={40}
                max={240}
                inputMode="numeric"
            />
        </div>
        <Separator orientation="vertical" className="h-6 mx-2" />
        <Button variant="ghost" size="icon" onClick={onImportMidiClick} title="Importuj MIDI">
            <Upload className="h-5 w-5" />
            <span className="sr-only">Importuj MIDI</span>
        </Button>
        <Button
          variant="ghost"
          size="icon"
          title="Przeciągnij MIDI"
          draggable
          onDragStart={onDragMidiStart}
          onDragEnd={onDragMidiEnd}
        >
          <Move className="h-5 w-5" />
          <span className="sr-only">Przeciągnij MIDI</span>
        </Button>
        <Button variant="ghost" size="icon" onClick={onExportMidi} title="Eksportuj MIDI">
          <Download className="h-5 w-5" />
          <span className="sr-only">Eksportuj MIDI</span>
        </Button>
        <Button variant="ghost" size="icon" onClick={onExportJson} title="Eksportuj JSON">
          <FileJson className="h-5 w-5" />
          <span className="sr-only">Eksportuj JSON</span>
        </Button>
        <Button variant="ghost" size="icon" onClick={onToggleGhost}>
          <Ghost className="h-5 w-5" />
          <span className="sr-only">Przełącz nuty-duchy</span>
        </Button>
      </div>
    </header>
  );
}
