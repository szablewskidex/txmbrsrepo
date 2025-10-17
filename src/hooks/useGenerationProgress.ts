'use client';

import { useState, useRef, useCallback, useEffect } from 'react';

const STAGES = [
  { name: 'Rozgrzewka AI...', duration: 2000, progressShare: 5 },
  { name: 'Sugerowanie progresji akordów...', duration: 4000, progressShare: 10 },
  { name: 'Komponowanie melodii...', duration: 25000, progressShare: 50 },
  { name: 'Aranżacja akordów...', duration: 15000, progressShare: 20 },
  { name: 'Tworzenie linii basowej...', duration: 10000, progressShare: 10 },
  { name: 'Finalny mastering i kwantyzacja...', duration: 4000, progressShare: 5 },
];

const TOTAL_DURATION = STAGES.reduce((acc, stage) => acc + stage.duration, 0); // ~60 seconds

export function useGenerationProgress() {
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(0);

  const updateProgress = useCallback(() => {
    const elapsedTime = Date.now() - startTimeRef.current;
    
    if (elapsedTime >= TOTAL_DURATION) {
      setProgress(99);
      setStatus('Finalizowanie...');
      // Don't clear the interval, let it sit at 99% until stop() is called.
      return;
    }

    let cumulativeDuration = 0;
    let currentStageIndex = -1;
    for (let i = 0; i < STAGES.length; i++) {
        cumulativeDuration += STAGES[i].duration;
        if (elapsedTime < cumulativeDuration) {
            currentStageIndex = i;
            break;
        }
    }
    
    if (currentStageIndex === -1) {
        // Should not happen with the check above, but as a fallback
        setProgress(99);
        setStatus('Prawie gotowe...');
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

    setProgress(Math.min(99, overallProgress));
    setStatus(currentStage.name);

  }, []);

  const start = useCallback(() => {
    if (isRunning) return;
    setIsRunning(true);
    setProgress(0);
    setStatus('Inicjalizacja...');
    startTimeRef.current = Date.now();
    intervalRef.current = setInterval(updateProgress, 100);
  }, [isRunning, updateProgress]);

  const stop = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setIsRunning(false);
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
