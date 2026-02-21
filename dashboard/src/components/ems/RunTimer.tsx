'use client';

import { useState, useEffect } from 'react';
import { Clock } from 'lucide-react';

interface RunTimerProps {
  startedAt: string;
  isComplete?: boolean;
}

export function RunTimer({ startedAt, isComplete }: RunTimerProps) {
  const [elapsed, setElapsed] = useState('00:00');

  useEffect(() => {
    if (isComplete) return;
    const start = new Date(startedAt).getTime();

    const update = () => {
      const diff = Math.floor((Date.now() - start) / 1000);
      const hours = Math.floor(diff / 3600);
      const mins = Math.floor((diff % 3600) / 60).toString().padStart(2, '0');
      const secs = (diff % 60).toString().padStart(2, '0');
      setElapsed(hours > 0 ? `${hours}:${mins}:${secs}` : `${mins}:${secs}`);
    };

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [startedAt, isComplete]);

  return (
    <div className="flex items-center gap-1.5 text-sm font-mono tabular-nums text-muted-foreground">
      <Clock className="w-3.5 h-3.5" />
      <span>{elapsed}</span>
    </div>
  );
}
