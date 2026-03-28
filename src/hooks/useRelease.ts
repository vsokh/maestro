import { useState, useEffect, useCallback } from 'react';
import { api } from '../api.ts';
import type { ReleaseEntry, StabilityAssessment, ChangelogSection } from '../types';

export function useRelease() {
  const [releases, setReleases] = useState<ReleaseEntry[]>([]);
  const [stability, setStability] = useState<StabilityAssessment | null>(null);
  const [changelog, setChangelog] = useState<ChangelogSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const readRelease = useCallback(async () => {
    try {
      setError(false);
      const [relData, stabData, clData] = await Promise.all([
        api.readReleases().catch(() => []),
        api.readStability().catch(() => null),
        api.readChangelog().catch(() => ({ sections: [] })),
      ]);
      setReleases(Array.isArray(relData) ? relData : []);
      setStability(stabData);
      setChangelog(clData?.sections || []);
    } catch {
      setReleases([]);
      setStability(null);
      setChangelog([]);
      setError(true);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    readRelease();
    const timer = setInterval(readRelease, 5000);
    return () => clearInterval(timer);
  }, [readRelease]);

  return { releases, stability, changelog, loading, error, retry: readRelease };
}
