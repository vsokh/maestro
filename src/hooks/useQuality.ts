import { useState, useEffect, useCallback } from 'react';
import { validateQualityReport, validateQualityHistory } from '../validate.ts';
import type { QualityReport, QualityHistoryEntry } from '../types';

export function useQuality(dirHandle: FileSystemDirectoryHandle | null) {
  const [latest, setLatest] = useState<QualityReport | null>(null);
  const [history, setHistory] = useState<QualityHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const readQuality = useCallback(async () => {
    if (!dirHandle) return;
    try {
      const dmDir = await dirHandle.getDirectoryHandle('.devmanager');
      setError(false);
      const qualDir = await dmDir.getDirectoryHandle('quality');

      try {
        const latestHandle = await qualDir.getFileHandle('latest.json');
        const latestFile = await latestHandle.getFile();
        const latestText = await latestFile.text();
        const parsed = JSON.parse(latestText);
        setLatest(validateQualityReport(parsed));
      } catch (err) { console.error('Failed to read quality latest.json:', err); setLatest(null); }

      try {
        const histHandle = await qualDir.getFileHandle('history.json');
        const histFile = await histHandle.getFile();
        const histText = await histFile.text();
        const parsed = JSON.parse(histText);
        setHistory(validateQualityHistory(parsed));
      } catch (err) { console.error('Failed to read quality history.json:', err); setHistory([]); }

    } catch (err) {
      console.error('Failed to read quality directory:', err);
      setLatest(null);
      setHistory([]);
      setError(true);
    }
    setLoading(false);
  }, [dirHandle]);

  useEffect(() => {
    if (!dirHandle) return;
    const timer = setInterval(readQuality, 5000);
    // Schedule initial read asynchronously to avoid synchronous setState in effect
    const initialTimer = setTimeout(readQuality, 0);
    return () => { clearInterval(timer); clearTimeout(initialTimer); };
  }, [dirHandle, readQuality]);

  return { latest, history, loading, error, retry: readQuality };
}
