'use client';

import React from 'react';
import { PIANO_KEYS, ROW_HEIGHT } from '@/lib/constants';
import { cn } from '@/lib/utils';

interface PianoKeysProps {
  verticalZoom: number;
  rowHeight: number;
}

export function PianoKeys({ verticalZoom, rowHeight }: PianoKeysProps) {
  const reversedKeys = React.useMemo(() => [...PIANO_KEYS].reverse(), []);

  return (
    <div className="w-20 bg-card select-none shrink-0 overflow-y-auto">
      <div style={{ height: PIANO_KEYS.length * rowHeight * verticalZoom }}>
        {reversedKeys.map(key => {
          const isBlackKey = key.includes('#');
          return (
            <div
              key={key}
              className={cn(
                "flex items-center justify-end pr-2 text-xs",
                isBlackKey ? 'bg-gray-800 text-white' : 'bg-gray-200 text-black',
              )}
              style={{
                height: rowHeight * verticalZoom,
                borderBottom: '1px solid hsl(var(--border))',
              }}
            >
              {key}
            </div>
          );
        })}
      </div>
    </div>
  );
}
