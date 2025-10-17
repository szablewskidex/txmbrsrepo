
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

    if (currentStageIndex === -1) {
      // Process finished or something went wrong
      setProgress(100);
      setStatus('Gotowe!');
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      setIsRunning(false);
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
    startTimeRef.current = Date.now();
    intervalRef.current = setInterval(updateProgress, 100);
  }, [isRunning, updateProgress]);

  const stop = useCallback(() => {
    if (!isRunning) return;
    setIsRunning(false);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    setProgress(100);
    setStatus('Gotowe!');
  }, [isRunning]);

  const reset = useCallback(() => {
    stop();
    setProgress(0);
    setStatus('');
  }, [stop]);

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
