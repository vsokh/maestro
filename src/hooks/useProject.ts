import { useState, useCallback, useRef, useEffect } from 'react';
import type { StateData, SkillsConfig, SkillInfo, WebSocketMessage } from '../types';
import { api } from '../api.ts';
import {
  readState,
  syncSkills,
  discoverSkillsAndAgents,
  readSkillsConfig,
  writeSkillsConfig,
} from '../fs.ts';
import { useConnection } from './useConnection.ts';
import { useSync } from './useSync.ts';
import { useTemplate } from './useTemplate.ts';
import type { ProjectInfo } from './useTemplate.ts';
export type { ConnectionStatus } from './useConnection.ts';
export type { MergeResult } from './useSync.ts';
export { mergeProgressIntoState } from './useSync.ts';

export function useProject(opts?: { onError?: (msg: string) => void }) {
  const onError = opts?.onError;
  const [skillsConfig, setSkillsConfig] = useState<SkillsConfig | null>(null);
  const [availableSkills, setAvailableSkills] = useState<SkillInfo[]>([]);
  const [projects, setProjects] = useState<ProjectInfo[]>([]);

  const connectToServerRef = useRef<(() => Promise<void>) | undefined>(undefined);

  // useConnection uses a ref for onMessage, so the handler can safely
  // close over setStatus even though it's returned by the same hook call.
  const handleWsMessageRef = useRef<(msg: WebSocketMessage) => void>(() => {});

  const { connected, setConnected, status, setStatus, closeWebSocket } = useConnection({
    onMessage: (msg: WebSocketMessage) => handleWsMessageRef.current(msg),
  });

  const { data, setData, projectName, setProjectName, save, handleSyncMessage, pauseTask, cancelTask, flushPendingSave, lastWriteTime } = useSync({ setStatus });

  const { showTemplatePicker, triggerTemplatePicker, connectWithTemplate, cancelTemplatePicker } = useTemplate({
    setStatus,
    setConnected,
    setData,
    setProjectName,
    lastWriteTime,
    setAvailableSkills,
    setSkillsConfig,
    setProjects,
  });

  // Now that setStatus is available, define the real handler
  handleWsMessageRef.current = (msg: WebSocketMessage) => {
    if (handleSyncMessage(msg)) return;
    if (msg.type === 'quality') {
      // Quality updates are handled by useQuality hook
    }
    if (msg.type === 'project-switched') {
      // Server switched to a different project — reconnect
      connectToServerRef.current?.();
    }
  };

  const connectToServer = useCallback(async () => {
    setStatus('connecting');
    try {
      // Get project info from server
      const info = await api.getInfo();
      setProjectName(info.projectName);

      // Read initial state
      const existing = await readState();
      let stateData: StateData;
      if (existing) {
        stateData = existing.data;
        lastWriteTime.current = existing.lastModified;
      } else {
        // New project — show template picker
        triggerTemplatePicker();
        return;
      }

      const resolvedName = stateData.project || info.projectName;
      setProjectName(resolvedName);

      // Sync skills
      await syncSkills();

      // Discover skills
      const discovered = await discoverSkillsAndAgents();
      setAvailableSkills(discovered);
      const sc = await readSkillsConfig();
      setSkillsConfig(sc);

      // Fetch projects list
      try {
        const proj = await api.listProjects();
        setProjects(proj);
      } catch { /* server might not support multi-project yet */ }

      setData(stateData);
      setConnected(true);
      setStatus('connected');
    } catch (err) {
      console.error('Connection failed:', err);
      setStatus('error');
    }
  }, [setConnected, setStatus, setProjectName, setData, lastWriteTime, triggerTemplatePicker]);

  useEffect(() => { connectToServerRef.current = connectToServer; }, [connectToServer]);

  // Auto-connect on mount, retry once on failure
  useEffect(() => {
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    connectToServer().catch(() => {
      retryTimer = setTimeout(connectToServer, 2000);
    });
    return () => { if (retryTimer) clearTimeout(retryTimer); };
  }, [connectToServer]);

  const connect = useCallback(async () => {
    await connectToServer();
  }, [connectToServer]);

  const disconnect = useCallback(async () => {
    await flushPendingSave();
    closeWebSocket();
    setConnected(false);
    setData(null);
    setProjectName('');
    setStatus('disconnected');
  }, [flushPendingSave, closeWebSocket, setConnected, setStatus, setData, setProjectName]);

  const saveSkills = useCallback(async (config: SkillsConfig) => {
    setSkillsConfig(config);
    await writeSkillsConfig(config);
  }, []);

  const switchProject = useCallback(async (path: string) => {
    setConnected(false);
    setData(null);
    setStatus('connecting');
    try {
      await api.switchProject(path);
      await connectToServer();
    } catch (err: unknown) {
      console.error('Switch project failed:', err);
      onError?.(`Failed to open project: ${err instanceof Error ? err.message : 'unknown error'}`);
      // Try reconnecting to the previous project
      try { await connectToServer(); } catch { setStatus('error'); }
    }
  }, [connectToServer, onError, setConnected, setStatus, setData]);

  return { connected, status, projectName, data, save, connect, disconnect, pauseTask, cancelTask, skillsConfig, saveSkills, availableSkills, projects, switchProject, showTemplatePicker, connectWithTemplate, cancelTemplatePicker };
}
