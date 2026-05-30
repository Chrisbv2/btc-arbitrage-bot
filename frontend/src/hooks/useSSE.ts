import { useEffect, useState } from 'react';
import { API_BASE } from '../lib/config';

/**
 * Low-level SSE primitive.
 *
 * Returns `es` as React state (not a ref) so that dependent effects
 * can declare `[es]` as a dependency and be re-run reactively when the
 * EventSource becomes available — eliminating the Strict-Mode race where
 * the ref is nulled between cleanup and remount.
 *
 * Connects directly to the backend URL (not through the Vite proxy)
 * because Vite's http-proxy buffers streaming responses, silently
 * preventing SSE frames from flushing to the browser.
 */
export function useSSE(url = `${API_BASE}/api/stream`) {
  const [es, setEs] = useState<EventSource | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const eventSource = new EventSource(url);

    const onOpen  = () => setConnected(true);
    const onError = () => setConnected(false);

    eventSource.addEventListener('open',  onOpen);
    eventSource.addEventListener('error', onError);

    // Make the instance available to dependents immediately —
    // state update is batched, so the effect runs during the same commit.
    setEs(eventSource);

    return () => {
      eventSource.removeEventListener('open',  onOpen);
      eventSource.removeEventListener('error', onError);
      eventSource.close();
      setEs(null);
      setConnected(false);
    };
  }, [url]);

  return { es, connected };
}
