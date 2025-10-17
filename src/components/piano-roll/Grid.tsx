'use client';

import React, { useRef, useCallback } from 'react';
import type { Note, GhostNote } from '@/lib/types';
import { PIANO_KEYS, ROW_HEIGHT } from '@/lib/constants';
import { NoteItem } from './NoteItem';

interface GridProps {
  notes: Note[];
  ghostNotes: GhostNote[];
  beats: number;
  cellPx: number;
  verticalZoom: number;
  playPosition: number;
  selectedNoteId: number | null;
  onAddNote: (start: number, pitch: number) => void;
  onUpdateNote: (id: number, patch: Partial<Note>) => void;
  getNote: (id: number) => Note | undefined;
  onSelectNote: (id: number | null) => void;
}

type DragState = {
  type: 'move' | 'resize';
  id: number;
  startX: number;
  startY: number;
  originalNote: Note;
};

export function Grid({
  notes,
  ghostNotes,
  beats,
  cellPx,
  verticalZoom,
  playPosition,
  selectedNoteId,
  onAddNote,
  onUpdateNote,
  getNote,
  onSelectNote,
}: GridProps) {
  const gridRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | null>(null);

  const handleMouseUp = useCallback(() => {
    if (dragRef.current) {
      dragRef.current = null;
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    }
  }, []);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!dragRef.current || !gridRef.current) return;

    const { type, id, startX, startY, originalNote } = dragRef.current;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    const gridCellHeight = ROW_HEIGHT * verticalZoom;

    if (type === 'move') {
      const deltaBeats = Math.round(dx / cellPx);
      const deltaPitch = -Math.round(dy / gridCellHeight);

      const newStart = Math.max(0, originalNote.start + deltaBeats);
      const newPitch = Math.max(0, Math.min(PIANO_KEYS.length - 1, originalNote.pitch + deltaPitch));

      onUpdateNote(id, { start: newStart, pitch: newPitch });
    } else if (type === 'resize') {
      const deltaBeats = dx / cellPx;
      const newDuration = Math.max(0.25, Math.round((originalNote.duration + deltaBeats) * 4) / 4);
      onUpdateNote(id, { duration: newDuration });
    }
  }, [cellPx, verticalZoom, onUpdateNote]);
  
  const handleNoteMouseDown = useCallback((e: React.MouseEvent, noteId: number, type: 'move' | 'resize') => {
    e.stopPropagation();
    const originalNote = getNote(noteId);
    if (!originalNote) return;

    onSelectNote(noteId);
    dragRef.current = { type, id: noteId, startX: e.clientX, startY: e.clientY, originalNote };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  }, [getNote, onSelectNote, handleMouseMove, handleMouseUp]);


  const handleGridClick = (e: React.MouseEvent) => {
    if (e.target !== gridRef.current) return; // Only trigger on grid background
    if (!gridRef.current) return;
    
    const rect = gridRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const start = x / cellPx;
    const pitch = PIANO_KEYS.length - 1 - Math.floor(y / (ROW_HEIGHT * verticalZoom));

    if (pitch >= 0 && pitch < PIANO_KEYS.length) {
      onAddNote(start, pitch);
    }
  };

  const gridWidth = beats * cellPx;
  const gridHeight = PIANO_KEYS.length * ROW_HEIGHT * verticalZoom;

  return (
    <div className="flex-1 relative overflow-auto bg-background" onClick={() => onSelectNote(null)}>
      <div
        ref={gridRef}
        className="relative"
        style={{
          width: gridWidth,
          height: gridHeight,
          backgroundSize: `${cellPx}px ${ROW_HEIGHT * verticalZoom}px`,
          backgroundImage: `
            linear-gradient(to right, hsl(var(--border)) 1px, transparent 1px),
            linear-gradient(to bottom, hsl(var(--border)) 1px, transparent 1px)
          `,
        }}
        onClick={handleGridClick}
      >
        <div
          className="absolute top-0 w-0.5 bg-accent/70 z-20"
          style={{ left: playPosition * cellPx, height: gridHeight }}
        />

        {ghostNotes.map((note, i) => (
          <div
            key={`g-${i}`}
            className="absolute bg-primary/20 rounded-sm"
            style={{
              left: note.start * cellPx,
              top: (PIANO_KEYS.length - 1 - note.pitch) * ROW_HEIGHT * verticalZoom,
              width: note.duration * cellPx,
              height: ROW_HEIGHT * verticalZoom,
            }}
          />
        ))}

        {notes.map(note => (
          <NoteItem
            key={note.id}
            note={note}
            cellPx={cellPx}
            verticalZoom={verticalZoom}
            isSelected={note.id === selectedNoteId}
            onMouseDown={handleNoteMouseDown}
          />
        ))}
      </div>
    </div>
  );
}
