import * as Location from 'expo-location';
import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import {
  watchPositionFix,
  type LocateFailure,
  type PositionFix,
} from '@/features/buyer-discovery/geolocation';

export type LivePositionStatus = 'IDLE' | 'LOCATING' | 'OK' | LocateFailure;

/** True while the app is in front. GPS is the costliest thing a phone does. */
function usePageVisible(): boolean {
  const [visible, setVisible] = useState(AppState.currentState === 'active');
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => setVisible(s === 'active'));
    return () => sub.remove();
  }, []);
  return visible;
}

/**
 * The customer's position, followed while `enabled` and the page is visible, kept in memory only
 * (like discovery, nothing about where someone is goes to storage). A brief GPS timeout after a
 * good fix keeps that fix rather than blanking the screen; only a denied permission clears it.
 */
export function useLivePosition(enabled: boolean) {
  const visible = usePageVisible();
  const [fix, setFix] = useState<PositionFix | null>(null);
  const [status, setStatus] = useState<LivePositionStatus>('IDLE');
  const [attempt, setAttempt] = useState(0);
  const hasFix = useRef(false);

  useEffect(() => {
    if (!enabled || !visible) return;
    if (!hasFix.current) setStatus('LOCATING');
    return watchPositionFix(
      (next) => {
        hasFix.current = true;
        setFix(next);
        setStatus('OK');
      },
      (reason) => {
        if (reason === 'DENIED') {
          hasFix.current = false;
          setFix(null);
          setStatus('DENIED');
        } else if (!hasFix.current) {
          setStatus(reason);
        }
      },
    );
  }, [enabled, visible, attempt]);

  return {
    fix: enabled ? fix : null,
    status: enabled ? status : ('IDLE' as const),
    retry: () => setAttempt((n) => n + 1),
  };
}

export type GeolocationPermission = 'granted' | 'prompt' | 'denied' | 'unknown';

/**
 * Whether the browser already allows location, without asking. Order tracking only follows the
 * customer when they have said yes before; it offers a button instead of a surprise prompt.
 */
export function useGeolocationPermission(): GeolocationPermission {
  const [state, setState] = useState<GeolocationPermission>('unknown');
  useEffect(() => {
    let disposed = false;
    Location.getForegroundPermissionsAsync()
      .then((p) => {
        if (disposed) return;
        setState(p.granted ? 'granted' : p.canAskAgain ? 'prompt' : 'denied');
      })
      .catch(() => undefined);
    return () => {
      disposed = true;
    };
  }, []);
  return state;
}
