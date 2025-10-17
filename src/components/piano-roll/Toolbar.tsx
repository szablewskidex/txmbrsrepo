'use client';

import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Play, Pause, Download, Ghost, FileJson, Upload } from 'lucide-react';
import React from 'react';
import { Input } from '../ui/input';
import { Label } from '../ui/label';

interface ToolbarProps {
  isPlaying: boolean;
  onPlayToggle: () => void;
  onExportMidi: () => void;
  onExportJson: () => void;
  onImportMidiClick: () => void;
  onToggleGhost: () => void;
  bpm: number;
  onBpmChange: (bpm: number) => void;
}

export function Toolbar({ 
  isPlaying, onPlayToggle, onExportMidi, onExportJson, onImportMidiClick, onToggleGhost,
  bpm, onBpmChange
}: ToolbarProps) {
  return (
    <header className="flex items-center h-14 px-4 bg-card border-b shrink-0">
      <h1 className="text-xl font-bold tracking-tight text-foreground">PianoRoll<span className="text-primary">AI</span></h1>
      <Separator orientation="vertical" className="h-6 mx-4" />
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={onPlayToggle}>
          {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
          <span className="sr-only">{isPlaying ? 'Pauza' : 'Odtwarzaj'}</span>
        </Button>
         <div className="flex items-center gap-2">
            <Label htmlFor="bpm" className="text-sm font-medium">BPM</Label>
            <Input 
                id="bpm"
                type="number"
                value={bpm}
                onChange={(e) => onBpmChange(parseInt(e.target.value, 10))}
                className="w-20 h-8"
                min={40}
                max={240}
            />
        </div>
        <Separator orientation="vertical" className="h-6 mx-2" />
        <Button variant="ghost" size="icon" onClick={onImportMidiClick} title="Importuj MIDI">
            <Upload className="h-5 w-5" />
            <span className="sr-only">Importuj MIDI</span>
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
