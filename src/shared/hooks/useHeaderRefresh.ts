/**
 * useHeaderRefresh Hook
 * Global refresh event bus for coordinating data reloads
 */

import { useEffect } from 'react';

const REFRESH_EVENT = 'app://header-refresh';

export function useHeaderRefresh(callback: () => void): void {
  useEffect(() => {
    const handler = () => callback();
    window.addEventListener(REFRESH_EVENT, handler);
    return () => window.removeEventListener(REFRESH_EVENT, handler);
  }, [callback]);
}

export function triggerHeaderRefresh(): void {
  window.dispatchEvent(new Event(REFRESH_EVENT));
}
