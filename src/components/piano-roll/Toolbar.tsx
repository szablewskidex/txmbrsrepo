'use client';

import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Play, Pause, Download, Ghost } from 'lucide-react';
import React from 'react';

interface ToolbarProps {
  isPlaying: boolean;
  onPlayToggle: () => void;
  onExportMidi: () => void;
  onToggleGhost: () => void;
}

export function Toolbar({ isPlaying, onPlayToggle, onExportMidi, onToggleGhost }: ToolbarProps) {
  return (
    <header className="flex items-center h-14 px-4 bg-card border-b shrink-0">
      <h1 className="text-xl font-bold tracking-tight text-foreground">PianoRoll<span className="text-primary">AI</span></h1>
      <Separator orientation="vertical" className="h-6 mx-4" />
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={onPlayToggle}>
          {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
          <span className="sr-only">{isPlaying ? 'Pause' : 'Play'}</span>
        </Button>
        <Button variant="ghost" size="icon" onClick={onExportMidi}>
          <Download className="h-5 w-5" />
          <span className="sr-only">Export MIDI</span>
        </Button>
        <Button variant="ghost" size="icon" onClick={onToggleGhost}>
          <Ghost className="h-5 w-5" />
          <span className="sr-only">Toggle Ghost Notes</span>
        </Button>
      </div>
    </header>
  );
}
