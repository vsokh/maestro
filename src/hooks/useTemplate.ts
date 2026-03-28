import { useState, useCallback } from 'react';
import type { ConnectionStatus } from './useConnection.ts';
import type { StateData, SkillsConfig, SkillInfo } from '../types';
import type { ProjectTemplate } from '../templates.ts';
import { api } from '../api.ts';
import {
  applyTemplate,
  createDefaultState,
  writeState,
  syncSkills,
  discoverSkillsAndAgents,
  readSkillsConfig,
} from '../fs.ts';

export interface ProjectInfo {
  path: string;
  name: string;
  active: boolean;
}

interface UseTemplateOptions {
  setStatus: (status: ConnectionStatus) => void;
  setConnected: (v: boolean) => void;
  setData: (d: StateData | null) => void;
  setProjectName: (n: string) => void;
  lastWriteTimeRef: React.MutableRefObject<number>;
  setAvailableSkills: (s: SkillInfo[]) => void;
  setSkillsConfig: (c: SkillsConfig | null) => void;
  setProjects: (p: ProjectInfo[]) => void;
}

export function useTemplate({
  setStatus,
  setConnected,
  setData,
  setProjectName,
  lastWriteTimeRef,
  setAvailableSkills,
  setSkillsConfig,
  setProjects,
}: UseTemplateOptions) {
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);

  const triggerTemplatePicker = useCallback(() => {
    setShowTemplatePicker(true);
    setStatus('template-picker');
  }, [setStatus]);

  const connectWithTemplate = useCallback(async (template: ProjectTemplate | null) => {
    setStatus('connecting');
    setShowTemplatePicker(false);
    try {
      const info = await api.getInfo();
      let stateData: StateData;
      if (template) {
        stateData = await applyTemplate(info.projectName, template);
      } else {
        stateData = createDefaultState(info.projectName);
      }
      const writeResult = await writeState(stateData);
      if (writeResult.ok && writeResult.lastModified) lastWriteTimeRef.current = writeResult.lastModified;
      else lastWriteTimeRef.current = Date.now();

      setProjectName(stateData.project || info.projectName);
      await syncSkills();
      const discovered = await discoverSkillsAndAgents();
      setAvailableSkills(discovered);
      const sc = await readSkillsConfig();
      setSkillsConfig(sc);
      try {
        const proj = await api.listProjects();
        setProjects(proj);
      } catch { /* ignore */ }

      setData(stateData);
      setConnected(true);
      setStatus('connected');
    } catch (err) {
      console.error('Template setup failed:', err);
      setStatus('error');
    }
  }, [setConnected, setStatus, setProjectName, setData, lastWriteTimeRef, setAvailableSkills, setSkillsConfig, setProjects]);

  const cancelTemplatePicker = useCallback(() => {
    setShowTemplatePicker(false);
    setStatus('disconnected');
  }, [setStatus]);

  return {
    showTemplatePicker,
    triggerTemplatePicker,
    connectWithTemplate,
    cancelTemplatePicker,
  };
}
