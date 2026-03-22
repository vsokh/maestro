import { useState, useEffect, useCallback } from 'react';
import { api } from '../api.ts';
import { validateQualityReport, validateQualityHistory } from '../validate.ts';
import type { QualityReport, QualityHistoryEntry } from '../types';

export function useQuality() {
  const [latest, setLatest] = useState<QualityReport | null>(null);
  const [history, setHistory] = useState<QualityHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const readQuality = useCallback(async () => {
    try {
      setError(false);
      const latestData = await api.readQualityLatest();
      setLatest(latestData ? validateQualityReport(latestData) : null);
      const histData = await api.readQualityHistory();
      setHistory(validateQualityHistory(histData));
    } catch (err) {
      console.error('Failed to read quality:', err);
      setLatest(null);
      setHistory([]);
      setError(true);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    readQuality();
    // Still poll every 5 seconds as fallback (server also pushes via WS)
    const timer = setInterval(readQuality, 5000);
    return () => clearInterval(timer);
  }, [readQuality]);

  return { latest, history, loading, error, retry: readQuality };
}
