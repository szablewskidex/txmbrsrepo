'use client';

import React from 'react';
import { PIANO_KEYS } from '@/lib/constants';
import { cn } from '@/lib/utils';

interface PianoKeysProps {
  verticalZoom: number;
  rowHeight: number;
}

export function PianoKeys({ verticalZoom, rowHeight }: PianoKeysProps) {
  const reversedKeys = React.useMemo(() => [...PIANO_KEYS].reverse(), []);

  return (
    <div className="w-20 bg-card select-none shrink-0">
      {reversedKeys.map(key => {
        const isBlackKey = key.includes('#');
        return (
          <div
            key={key}
            className={cn(
              'flex items-center justify-end pr-2 text-xs border-b border-border',
              isBlackKey 
                ? 'bg-[#2a2a2a] text-gray-300 shadow-sm' 
                : 'bg-white text-gray-900 shadow-sm',
            )}
            style={{
              height: rowHeight * verticalZoom,
              borderLeft: isBlackKey ? '4px solid #3a3a3a' : '4px solid #d0d0d0',
            }}
          >
            {key}
          </div>
        );
      })}
    </div>
  );
}
