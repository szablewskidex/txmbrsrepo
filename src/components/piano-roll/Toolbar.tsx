'use client';

import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Play, Pause, Download, Ghost, FileJson, Upload, Move, Sun, Moon, Monitor, Volume2, VolumeX, Guitar, Menu } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import React from 'react';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { useTheme, ThemeName } from '@/components/theme-provider';
import { Slider } from '@/components/ui/slider';

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
  volume: number;
  onVolumeChange: (value: number) => void;
  isGuitar: boolean;
  onToggleGuitar: () => void;
}

export function Toolbar({ 
  isPlaying, onPlayToggle, onExportMidi, onDragMidiStart, onDragMidiEnd, onExportJson, onImportMidiClick, onToggleGhost,
  bpm, onBpmChange, volume, onVolumeChange, isGuitar, onToggleGuitar
}: ToolbarProps) {
  const [bpmInput, setBpmInput] = React.useState<string>(() => (Number.isFinite(bpm) ? String(bpm) : ''));
  const { theme, cycleTheme } = useTheme();

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

  const nextThemeLabel = React.useMemo(() => {
    const themes: ThemeName[] = ['standard', 'dark', 'light'];
    const index = themes.indexOf(theme);
    const next = themes[(index + 1) % themes.length];
    switch (next) {
      case 'dark':
        return 'Przełącz na tryb ciemny';
      case 'light':
        return 'Przełącz na tryb jasny';
      default:
        return 'Przełącz na tryb standardowy';
    }
  }, [theme]);

  const currentThemeIcon = React.useMemo(() => {
    switch (theme) {
      case 'dark':
        return <Moon className="h-5 w-5" />;
      case 'light':
        return <Sun className="h-5 w-5" />;
      default:
        return <Monitor className="h-5 w-5" />;
    }
  }, [theme]);

  return (
    <header className="flex items-center h-12 px-3 bg-card border-b shrink-0 sm:h-14 sm:px-4 liquid-glass-toolbar">
      <h1 className="text-lg font-bold tracking-tight text-foreground sm:text-xl">PianoRoll<span className="text-primary">AI</span></h1>
      <Separator orientation="vertical" className="h-6 mx-2 sm:mx-4 hidden sm:block" />
      <div className="flex items-center gap-1.5 sm:gap-2 flex-1 justify-end sm:justify-start">
        <Button variant="ghost" size="icon" className="liquid-glass-button" onClick={onPlayToggle}>
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
        <Separator orientation="vertical" className="h-6 mx-2 hidden sm:block" />
        <Button variant="ghost" size="icon" className="liquid-glass-button hidden sm:flex" onClick={cycleTheme} title={nextThemeLabel} aria-label={nextThemeLabel}>
          {currentThemeIcon}
        </Button>
        <Separator orientation="vertical" className="h-6 mx-2 hidden md:block" />
        <div className="hidden md:flex items-center gap-2 w-36 liquid-glass-slider">
          <VolumeX className="h-4 w-4 text-muted-foreground" />
          <Slider
            value={[volume]}
            min={0}
            max={100}
            step={1}
            onValueChange={([val]) => onVolumeChange(val ?? 0)}
            aria-label="Głośność"
          />
          <Volume2 className="h-4 w-4 text-muted-foreground" />
        </div>
        <Separator orientation="vertical" className="h-6 mx-2 hidden lg:block" />
        <Button variant="ghost" size="icon" className="liquid-glass-button hidden lg:flex" onClick={onToggleGuitar} title={isGuitar ? 'Użyj dźwięku pianina' : 'Użyj dźwięku gitary'}>
          <Guitar className={`h-5 w-5 ${isGuitar ? 'text-primary' : ''}`} />
        </Button>
        <Separator orientation="vertical" className="h-6 mx-2" />
        <Button variant="ghost" size="icon" className="liquid-glass-button hidden sm:flex" onClick={onImportMidiClick} title="Importuj MIDI">
            <Upload className="h-5 w-5" />
            <span className="sr-only">Importuj MIDI</span>
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="hidden sm:flex"
          title="Przeciągnij MIDI"
          draggable
          onDragStart={onDragMidiStart}
          onDragEnd={onDragMidiEnd}
        >
          <Move className="h-5 w-5" />
          <span className="sr-only">Przeciągnij MIDI</span>
        </Button>
        <Button variant="ghost" size="icon" className="hidden sm:flex" onClick={onExportMidi} title="Eksportuj MIDI">
          <Download className="h-5 w-5" />
          <span className="sr-only">Eksportuj MIDI</span>
        </Button>
        <Button variant="ghost" size="icon" className="hidden sm:flex" onClick={onExportJson} title="Eksportuj JSON">
          <FileJson className="h-5 w-5" />
          <span className="sr-only">Eksportuj JSON</span>
        </Button>
        <Button variant="ghost" size="icon" className="hidden sm:flex" onClick={onToggleGhost}>
          <Ghost className="h-5 w-5" />
          <span className="sr-only">Przełącz nuty-duchy</span>
        </Button>
        
        {/* Mobile dropdown menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="sm:hidden">
              <Menu className="h-5 w-5" />
              <span className="sr-only">Menu</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onClick={cycleTheme}>
              {currentThemeIcon}
              <span className="ml-2">{nextThemeLabel}</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onToggleGuitar}>
              <Guitar className={`h-4 w-4 ${isGuitar ? 'text-primary' : ''}`} />
              <span className="ml-2">{isGuitar ? 'Pianino' : 'Gitara'}</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onToggleGhost}>
              <Ghost className="h-4 w-4" />
              <span className="ml-2">Nuty-duchy</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onImportMidiClick}>
              <Upload className="h-4 w-4" />
              <span className="ml-2">Importuj MIDI</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onExportMidi}>
              <Download className="h-4 w-4" />
              <span className="ml-2">Eksportuj MIDI</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onExportJson}>
              <FileJson className="h-4 w-4" />
              <span className="ml-2">Eksportuj JSON</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
