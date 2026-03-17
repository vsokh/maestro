import { useState, useEffect, useCallback } from 'react';
import { validateQualityReport, validateQualityHistory } from '../validate.js';

/**
 * Reads quality audit data from .devmanager/quality/ directory.
 * Returns { latest, history, loading } — polls alongside useProject.
 */
export function useQuality(dirHandle) {
  const [latest, setLatest] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  const readQuality = useCallback(async () => {
    if (!dirHandle) return;
    try {
      const dmDir = await dirHandle.getDirectoryHandle('.devmanager');
      const qualDir = await dmDir.getDirectoryHandle('quality');

      // Read latest.json
      try {
        const latestHandle = await qualDir.getFileHandle('latest.json');
        const latestFile = await latestHandle.getFile();
        const latestText = await latestFile.text();
        const parsed = JSON.parse(latestText);
        setLatest(validateQualityReport(parsed));
      } catch (err) { console.error('Failed to read quality latest.json:', err); setLatest(null); }

      // Read history.json
      try {
        const histHandle = await qualDir.getFileHandle('history.json');
        const histFile = await histHandle.getFile();
        const histText = await histFile.text();
        const parsed = JSON.parse(histText);
        setHistory(validateQualityHistory(parsed));
      } catch (err) { console.error('Failed to read quality history.json:', err); setHistory([]); }

    } catch (err) {
      console.error('Failed to read quality directory:', err);
      // quality/ directory doesn't exist yet
      setLatest(null);
      setHistory([]);
    }
    setLoading(false);
  }, [dirHandle]);

  // Initial read
  useEffect(() => {
    readQuality();
  }, [readQuality]);

  // Poll every 5s (quality data changes less frequently than state)
  useEffect(() => {
    if (!dirHandle) return;
    const timer = setInterval(readQuality, 5000);
    return () => clearInterval(timer);
  }, [dirHandle, readQuality]);

  return { latest, history, loading };
}
