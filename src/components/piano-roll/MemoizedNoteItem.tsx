import React, { memo } from 'react';
import { NoteItem } from './NoteItem';
import type { Note } from '@/lib/types';

interface MemoizedNoteItemProps {
  note: Note;
  cellPx: number;
  verticalZoom: number;
  isSelected: boolean;
  onMouseDown: (e: React.MouseEvent, noteId: number, type: 'move' | 'resize') => void;
}

export const MemoizedNoteItem = memo(function MemoizedNoteItem({
  note,
  cellPx,
  verticalZoom,
  isSelected,
  onMouseDown,
}: MemoizedNoteItemProps) {
  return (
    <NoteItem
      note={note}
      cellPx={cellPx}
      verticalZoom={verticalZoom}
      isSelected={isSelected}
      onMouseDown={onMouseDown}
    />
  );
}, (prevProps, nextProps) => {
  // Custom comparison for better performance
  return (
    prevProps.note.id === nextProps.note.id &&
    prevProps.note.start === nextProps.note.start &&
    prevProps.note.duration === nextProps.note.duration &&
    prevProps.note.pitch === nextProps.note.pitch &&
    prevProps.note.velocity === nextProps.note.velocity &&
    prevProps.note.slide === nextProps.note.slide &&
    prevProps.cellPx === nextProps.cellPx &&
    prevProps.verticalZoom === nextProps.verticalZoom &&
    prevProps.isSelected === nextProps.isSelected
  );
});
