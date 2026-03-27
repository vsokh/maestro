import React, { useState, useEffect, useMemo } from 'react';
import ReactDOM from 'react-dom';
import type { SkillsConfig, SkillInfo, EpicMapping } from '../types';
import {
  SKILLS_TITLE, SKILLS_REMOVE_TITLE, SKILLS_CLOSE,
  SKILLS_LIST_PLACEHOLDER,
} from '../constants/strings.ts';

interface SkillsConfigPanelProps {
  config: SkillsConfig | null;
  availableSkills: SkillInfo[];
  epicNames: string[];
  onSave: (config: SkillsConfig) => void;
  onClose: () => void;
}

interface EpicRow {
  epic: string;
  skills: string;
  agents: string;
}

function configToRows(config: SkillsConfig | null): EpicRow[] {
  if (!config) return [];
  return Object.entries(config.epics).map(([epic, m]) => ({
    epic,
    skills: m.skills.join(', '),
    agents: m.agents.join(', '),
  }));
}

function rowsToConfig(rows: EpicRow[]): SkillsConfig {
  const epics: Record<string, EpicMapping> = {};
  for (const row of rows) {
    if (!row.epic) continue;
    epics[row.epic] = {
      skills: row.skills.split(',').map(s => s.trim()).filter(Boolean),
      agents: row.agents.split(',').map(s => s.trim()).filter(Boolean),
    };
  }
  return { epics };
}

function InfoBadge({ info, active, onClick }: { info: SkillInfo; active: boolean; onClick?: () => void }) {
  const [hovered, setHovered] = useState(false);
  const badgeRef = React.useRef<HTMLSpanElement>(null);
  const isAgent = info.type === 'agent';

  // Compute tooltip position relative to viewport
  const getTooltipStyle = (): React.CSSProperties => {
    if (!badgeRef.current) return { display: 'none' };
    const rect = badgeRef.current.getBoundingClientRect();
    return {
      position: 'fixed',
      left: Math.min(rect.left, window.innerWidth - 530),
      top: rect.bottom + 6,
      zIndex: 200, minWidth: '350px', maxWidth: '520px',
      padding: '6px 10px', fontSize: '11px', lineHeight: 1.4,
      background: 'var(--dm-surface)', color: 'var(--dm-text)',
      border: '1px solid var(--dm-border)', borderRadius: '6px',
      boxShadow: 'var(--dm-shadow-lg)',
      pointerEvents: 'none' as const,
    };
  };

  return (
    <span
      ref={badgeRef}
      style={{ display: 'inline-block', cursor: onClick ? 'pointer' : 'default' }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onClick}
    >
      <span
        className={`badge ${isAgent ? 'badge-amber' : 'badge-accent'} text-10`}
        style={{
          cursor: onClick ? 'pointer' : 'default',
          opacity: active ? 1 : 0.45,
          outline: active ? `2px solid ${isAgent ? 'var(--dm-amber)' : 'var(--dm-accent)'}` : 'none',
          outlineOffset: '1px',
        }}
      >{info.name}</span>
      {hovered && info.description ? ReactDOM.createPortal(
        <div style={getTooltipStyle()}>{info.description}</div>,
        document.body,
      ) : null}
    </span>
  );
}

export function SkillsConfigPanel({ config, availableSkills, epicNames, onSave, onClose }: SkillsConfigPanelProps) {
  const [rows, setRows] = useState<EpicRow[]>(() => configToRows(config));
  const [addingEpic, setAddingEpic] = useState('');
  const [selectedEpicIdx, setSelectedEpicIdx] = useState<number | null>(null);

  // Only sync from external config on mount — local edits drive state
  const initialized = React.useRef(false);
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    const next = configToRows(config);
    setRows(next);
    if (next.length === 1) setSelectedEpicIdx(0);
  }, [config]);

  const mappedEpics = new Set(rows.map(r => r.epic));
  const unmappedEpics = epicNames.filter(e => !mappedEpics.has(e));

  const skills = useMemo(() => availableSkills.filter(s => s.type === 'skill'), [availableSkills]);
  const agents = useMemo(() => availableSkills.filter(s => s.type === 'agent'), [availableSkills]);

  // Parse which skills/agents the selected epic has
  const selectedRow = selectedEpicIdx !== null ? rows[selectedEpicIdx] : null;
  const selectedSkills = useMemo(() => new Set(selectedRow?.skills.split(',').map(s => s.trim()).filter(Boolean) || []), [selectedRow?.skills]);
  const selectedAgents = useMemo(() => new Set(selectedRow?.agents.split(',').map(s => s.trim()).filter(Boolean) || []), [selectedRow?.agents]);

  const handleAddEpic = (epic: string) => {
    if (!epic || mappedEpics.has(epic)) return;
    const next = [...rows, { epic, skills: '', agents: '' }];
    setRows(next);
    setSelectedEpicIdx(next.length - 1);
    setAddingEpic('');
  };

  const handleRemove = (idx: number) => {
    const next = rows.filter((_, i) => i !== idx);
    setRows(next);
    if (selectedEpicIdx === idx) setSelectedEpicIdx(null);
    else if (selectedEpicIdx !== null && selectedEpicIdx > idx) setSelectedEpicIdx(selectedEpicIdx - 1);
    onSave(rowsToConfig(next));
  };

  const handleChange = (idx: number, field: 'skills' | 'agents', value: string) => {
    setRows(rows.map((r, i) => i === idx ? { ...r, [field]: value } : r));
  };

  const handleBlur = () => {
    onSave(rowsToConfig(rows));
  };

  const toggleItem = (name: string, field: 'skills' | 'agents') => {
    if (selectedEpicIdx === null) return;
    const row = rows[selectedEpicIdx];
    const items = row[field].split(',').map(s => s.trim()).filter(Boolean);
    const has = items.includes(name);
    const next = has ? items.filter(s => s !== name) : [...items, name];
    const updated = rows.map((r, i) => i === selectedEpicIdx ? { ...r, [field]: next.join(', ') } : r);
    setRows(updated);
    onSave(rowsToConfig(updated));
  };

  return (
    <>
      <div
        onClick={onClose}
        className="fixed w-full h-full"
        style={{
          top: 0, left: 0,
          background: 'rgba(0,0,0,0.25)', zIndex: 99,
        }}
      />
      <div className="fixed flex-col overflow-hidden" style={{
        top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
        zIndex: 100, width: 'min(560px, 92vw)', maxHeight: '85vh',
        background: 'var(--dm-surface)', borderRadius: 'var(--dm-radius)',
        border: '1px solid var(--dm-border)', boxShadow: 'var(--dm-shadow-lg)',
      }}>
        {/* Header */}
        <div className="flex-between" style={{
          padding: '12px 16px', borderBottom: '1px solid var(--dm-border)',
        }}>
          <span className="text-13 font-600" style={{ color: 'var(--dm-text)' }}>
            {SKILLS_TITLE}
          </span>
          <button onClick={onClose} className="btn-ghost text-14" style={{ padding: '2px 8px' }}>&times;</button>
        </div>

        <div className="p-16 overflow-auto flex-1">
          {/* Epic mappings */}
          {rows.length === 0 ? (
            <div className="empty-state-sm" style={{ padding: '12px 16px' }}>
              Add an epic to map skills and agents to it.
            </div>
          ) : (
            <div className="flex-col gap-8">
              {rows.map((row, idx) => {
                const isSelected = selectedEpicIdx === idx;
                return (
                  <div
                    key={row.epic}
                    onClick={() => setSelectedEpicIdx(isSelected ? null : idx)}
                    className="cursor-pointer"
                    style={{
                      padding: '10px 12px', borderRadius: 'var(--dm-radius-sm)',
                      background: 'var(--dm-bg)',
                      border: isSelected ? '2px solid var(--dm-accent)' : '1px solid var(--dm-border)',
                    }}
                  >
                    <div className="flex-between mb-6">
                      <span className="text-12 font-700" style={{ color: isSelected ? 'var(--dm-accent)' : 'var(--dm-text)' }}>{row.epic}</span>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleRemove(idx); }}
                        title={SKILLS_REMOVE_TITLE}
                        className="btn-ghost text-13"
                        style={{ padding: '2px 6px', color: 'var(--dm-text-light)' }}
                      >&times;</button>
                    </div>
                    <div className="flex-col gap-6">
                      <div onClick={(e) => e.stopPropagation()}>
                        <span className="text-muted text-10 font-600" style={{ textTransform: 'uppercase' }}>Skills</span>
                        <input
                          value={row.skills}
                          onInput={(e: React.FormEvent<HTMLInputElement>) => handleChange(idx, 'skills', (e.target as HTMLInputElement).value)}
                          onBlur={handleBlur}
                          onFocus={() => setSelectedEpicIdx(idx)}
                          placeholder={SKILLS_LIST_PLACEHOLDER}
                          className="w-full text-11"
                          style={{
                            padding: '5px 8px', marginTop: '3px',
                            border: '1px solid var(--dm-border)', borderRadius: '6px',
                            background: 'var(--dm-surface)', color: 'var(--dm-text)',
                          }}
                        />
                      </div>
                      <div onClick={(e) => e.stopPropagation()}>
                        <span className="text-muted text-10 font-600" style={{ textTransform: 'uppercase' }}>Agents</span>
                        <input
                          value={row.agents}
                          onInput={(e: React.FormEvent<HTMLInputElement>) => handleChange(idx, 'agents', (e.target as HTMLInputElement).value)}
                          onBlur={handleBlur}
                          onFocus={() => setSelectedEpicIdx(idx)}
                          placeholder={SKILLS_LIST_PLACEHOLDER}
                          className="w-full text-11"
                          style={{
                            padding: '5px 8px', marginTop: '3px',
                            border: '1px solid var(--dm-border)', borderRadius: '6px',
                            background: 'var(--dm-surface)', color: 'var(--dm-text)',
                          }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Add epic dropdown */}
          {unmappedEpics.length > 0 ? (
            <div className="mt-12 flex-center gap-8">
              <select
                value={addingEpic}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setAddingEpic(e.target.value)}
                className="select-field flex-1 text-12"
                style={{ padding: '5px 8px' }}
              >
                <option value="">Add epic...</option>
                {unmappedEpics.map(e => <option key={e} value={e}>{e}</option>)}
              </select>
              <button
                onClick={() => handleAddEpic(addingEpic)}
                disabled={!addingEpic}
                className="btn btn-primary btn-sm text-12"
                style={{ padding: '5px 12px' }}
              >Add</button>
            </div>
          ) : null}

          {/* Available skills & agents — clickable when an epic is selected */}
          {(skills.length > 0 || agents.length > 0) ? (
            <div className="mt-16 pt-12" style={{ borderTop: '1px solid var(--dm-border)' }}>
              {selectedEpicIdx !== null ? (
                <div className="text-accent text-10 mb-8" style={{ fontStyle: 'italic' }}>
                  Click to toggle for {rows[selectedEpicIdx]?.epic}
                </div>
              ) : null}
              {skills.length > 0 ? (
                <div style={{ marginBottom: agents.length > 0 ? '12px' : 0 }}>
                  <div className="text-muted text-10 font-600 mb-6" style={{ textTransform: 'uppercase' }}>
                    Skills (from .claude/skills/)
                  </div>
                  <div className="flex gap-4 flex-wrap">
                    {skills.map(s => (
                      <InfoBadge
                        key={s.name}
                        info={s}
                        active={selectedEpicIdx === null || selectedSkills.has(s.name)}
                        onClick={selectedEpicIdx !== null ? () => toggleItem(s.name, 'skills') : undefined}
                      />
                    ))}
                  </div>
                </div>
              ) : null}
              {agents.length > 0 ? (
                <div>
                  <div className="text-muted text-10 font-600 mb-6" style={{ textTransform: 'uppercase' }}>
                    Agents (from .claude/agents/)
                  </div>
                  <div className="flex gap-4 flex-wrap">
                    {agents.map(a => (
                      <InfoBadge
                        key={a.name}
                        info={a}
                        active={selectedEpicIdx === null || selectedAgents.has(a.name)}
                        onClick={selectedEpicIdx !== null ? () => toggleItem(a.name, 'agents') : undefined}
                      />
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        {/* Footer */}
        <div className="flex gap-8" style={{
          justifyContent: 'flex-end',
          padding: '12px 16px', borderTop: '1px solid var(--dm-border)',
        }}>
          <button onClick={onClose} className="btn btn-secondary btn-sm" style={{ padding: '6px 14px' }}>{SKILLS_CLOSE}</button>
        </div>
      </div>
    </>
  );
}
