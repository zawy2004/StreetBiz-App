import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Seconds-remaining countdown used for the OTP resend cooldown. The backend
 * enforces its own 60s cooldown (BR-61); this only keeps the button honest.
 */
export function useCountdown(initialSeconds = 0) {
  const [seconds, setSeconds] = useState(initialSeconds);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clear = useCallback(() => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (seconds <= 0) {
      clear();
      return;
    }
    if (intervalRef.current !== null) return;
    intervalRef.current = setInterval(() => {
      setSeconds((current) => {
        if (current <= 1) {
          clear();
          return 0;
        }
        return current - 1;
      });
    }, 1000);
    return clear;
  }, [seconds, clear]);

  const start = useCallback((next: number) => setSeconds(next), []);

  return { seconds, start, isRunning: seconds > 0 };
}
