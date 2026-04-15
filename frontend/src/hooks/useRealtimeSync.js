import { useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';

const API_URL = `${process.env.REACT_APP_BACKEND_URL}/api`;

/**
 * Subscribes to SSE events from the server.
 * Calls `onUpdate` whenever one of the `eventTypes` is received.
 * Auto-reconnects on error with exponential backoff.
 */
export const useRealtimeSync = (eventTypes, onUpdate) => {
  const { token } = useAuth();
  const callbackRef = useRef(null);

  // Keep ref updated after every render (never causes TDZ issues)
  useEffect(() => {
    callbackRef.current = onUpdate;
  });

  useEffect(() => {
    if (!token) return;

    let es = null;
    let retryTimeout = null;
    let retryDelay = 2000;

    const connect = () => {
      es = new EventSource(`${API_URL}/events?token=${encodeURIComponent(token)}`);
      const handler = () => callbackRef.current?.();
      eventTypes.forEach((type) => es.addEventListener(type, handler));
      es.onerror = () => {
        es.close();
        retryTimeout = setTimeout(() => {
          retryDelay = Math.min(retryDelay * 2, 30000);
          connect();
        }, retryDelay);
      };
      es.onopen = () => { retryDelay = 2000; };
    };

    connect();

    return () => {
      clearTimeout(retryTimeout);
      if (es) es.close();
    };
    // eslint-disable-next-line
  }, [token]);
};
