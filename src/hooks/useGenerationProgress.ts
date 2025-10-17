
'use client';

import { useState, useRef, useCallback, useEffect } from 'react';

const STAGES = [
  { name: 'Rozgrzewka AI...', duration: 2000, progressShare: 10 },
  { name: 'Sugerowanie progresji akordów...', duration: 3000, progressShare: 10 },
  { name: 'Komponowanie melodii...', duration: 8000, progressShare: 40 },
  { name: 'Aranżacja akordów...', duration: 5000, progressShare: 15 },
  { name: 'Tworzenie linii basowej...', duration: 4000, progressShare: 15 },
  { name: 'Finalny mastering i kwantyzacja...', duration: 3000, progressShare: 10 },
];

const TOTAL_DURATION = STAGES.reduce((acc, stage) => acc + stage.duration, 0);

export function useGenerationProgress() {
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(0);

  const updateProgress = useCallback(() => {
    const elapsedTime = Date.now() - startTimeRef.current;
    
    let cumulativeDuration = 0;
    let currentStageIndex = -1;
    for (let i = 0; i < STAGES.length; i++) {
        cumulativeDuration += STAGES[i].duration;
        if (elapsedTime < cumulativeDuration) {
            currentStageIndex = i;
            break;
        }
    }

    if (currentStageIndex === -1 && isRunning) {
        // We've finished the simulation, but the process is still running.
        // Hold at 99%
        setProgress(99);
        setStatus('Finalizowanie...');
        if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null; // No need to run this anymore
        }
        return;
    } else if (currentStageIndex === -1 && !isRunning) {
        // Process is fully stopped
        return;
    }


    const currentStage = STAGES[currentStageIndex];
    const stageStartTime = cumulativeDuration - currentStage.duration;
    const timeInCurrentStage = elapsedTime - stageStartTime;
    const stageProgress = (timeInCurrentStage / currentStage.duration);

    let progressSoFar = 0;
    for (let i = 0; i < currentStageIndex; i++) {
        progressSoFar += STAGES[i].progressShare;
    }
    
    const overallProgress = progressSoFar + stageProgress * currentStage.progressShare;

    // Cap the simulated progress at 99 to wait for the final `stop` call
    setProgress(Math.min(99, overallProgress));
    setStatus(currentStage.name);

  }, [isRunning]);

  const start = useCallback(() => {
    if (isRunning) return;
    setIsRunning(true);
    startTimeRef.current = Date.now();
    intervalRef.current = setInterval(updateProgress, 100);
  }, [isRunning, updateProgress]);

  const stop = useCallback(() => {
    setIsRunning(false);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setProgress(100);
    setStatus('Gotowe!');
  }, []);

  const reset = useCallback(() => {
    if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
    }
    setIsRunning(false);
    setProgress(0);
    setStatus('');
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  return { progress, status, start, stop, reset };
}
