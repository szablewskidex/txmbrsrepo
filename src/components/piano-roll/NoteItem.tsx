'use client';

import React from 'react';
import type { Note } from '@/lib/types';
import { ROW_HEIGHT, PIANO_KEYS } from '@/lib/constants';
import { cn } from '@/lib/utils';
import { ArrowRightLeft } from 'lucide-react';

interface NoteItemProps {
  note: Note;
  cellPx: number;
  verticalZoom: number;
  isSelected: boolean;
  onMouseDown: (e: React.MouseEvent, noteId: number, type: 'move' | 'resize') => void;
}

export function NoteItem({ note, cellPx, verticalZoom, isSelected, onMouseDown }: NoteItemProps) {
  const noteHeight = ROW_HEIGHT * verticalZoom;
  const noteWidth = note.duration * cellPx;
  const boxShadow = isSelected
    ? '0 0 0 2px rgba(56,189,248,0.55), 0 0 22px rgba(56,189,248,0.45)'
    : '0 2px 4px rgba(0,0,0,0.4)';

  return (
    <div
      className={cn(
        "absolute flex items-center rounded-sm transition-all duration-100 ease-out cursor-grab active:cursor-grabbing bg-primary",
        isSelected && "bg-sky-400/90 text-sky-950"
      )}
      style={{
        left: note.start * cellPx,
        top: (PIANO_KEYS.length - 1 - note.pitch) * ROW_HEIGHT * verticalZoom,
        width: noteWidth,
        height: noteHeight,
        boxShadow,
      }}
      onMouseDown={(e) => onMouseDown(e, note.id, 'move')}
      onClick={(e) => e.stopPropagation()}
    >
        {note.slide && <ArrowRightLeft className="w-3 h-3 text-primary-foreground/70 absolute left-1 top-1/2 -translate-y-1/2" />}
        <div
            className="absolute top-0 right-0 h-full w-2 cursor-ew-resize"
            onMouseDown={(e) => onMouseDown(e, note.id, 'resize')}
        />
    </div>
  );
}
