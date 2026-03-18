import type { Task, TaskStatus } from '../types';
import React, { useState, useMemo } from 'react';
import { suggestSkills } from '../skills.ts';
import {
  FORM_TITLE_PLACEHOLDER, FORM_EPIC_PLACEHOLDER, FORM_DESC_PLACEHOLDER,
  FORM_MANUAL_LABEL, FORM_MANUAL_HELP, FORM_SKILLS_LABEL, FORM_SKILLS_AUTO,
  FORM_SKILLS_PLACEHOLDER, FORM_SKILLS_MATCHED, FORM_CANCEL, FORM_SAVE, FORM_ADD_TASK,
} from '../constants/strings.ts';

interface CardFormProps {
  card: Partial<Task> | null;
  onSave: (task: Partial<Task>) => void;
  onCancel?: () => void;
  groups?: string[];
}

export function CardForm({ card, onSave, onCancel, groups }: CardFormProps) {
  const [title, setTitle] = useState(card?.name || '');
  const [description, setDescription] = useState(card?.description || '');
  const [group, setGroup] = useState(card?.group || '');
  const [manual, setManual] = useState(card?.manual || false);
  const [manualSkills, setManualSkills] = useState(card?.skills?.join(', ') || '');
  const [userEditedSkills, setUserEditedSkills] = useState(!!card?.skills?.length);

  const { skills: suggested, matches } = useMemo(() => suggestSkills(title + ' ' + description), [title, description]);
  const displaySkills = userEditedSkills ? manualSkills : suggested.join(', ');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    const finalSkills = userEditedSkills
      ? manualSkills.split(',').map(s => s.trim()).filter(Boolean)
      : suggested;
    onSave({
      id: card?.id,
      name: title.trim(),
      fullName: title.trim(),
      description: description.trim(),
      group: group.trim() || undefined,
      skills: manual ? [] : finalSkills,
      manual,
      status: (card?.status || 'pending') as TaskStatus,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="card-form" style={{ padding: '16px', marginBottom: '16px' }}>
      <input
        value={title} onInput={(e: React.FormEvent<HTMLInputElement>) => setTitle((e.target as HTMLInputElement).value)}
        placeholder={FORM_TITLE_PLACEHOLDER} autoFocus
        className="input-card"
        style={{ width: '100%', padding: '6px 8px', fontSize: '13px', fontWeight: 600, marginBottom: '8px' }}
      />
      <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
        <input
          value={group} onInput={(e: React.FormEvent<HTMLInputElement>) => setGroup((e.target as HTMLInputElement).value)}
          placeholder={FORM_EPIC_PLACEHOLDER}
          list="group-list"
          className="input-card"
          style={{ flex: 1, padding: '6px 8px', fontSize: '12px' }}
        />
        {groups && groups.length > 0 ? (
          <datalist id="group-list">
            {groups.map(g => <option key={g} value={g} />)}
          </datalist>
        ) : null}
      </div>
      <textarea
        value={description} onInput={(e: React.FormEvent<HTMLTextAreaElement>) => setDescription((e.target as HTMLTextAreaElement).value)}
        placeholder={FORM_DESC_PLACEHOLDER}
        rows={2}
        className="input-card"
        style={{ width: '100%', padding: '6px 8px', fontSize: '13px', marginBottom: '8px', resize: 'vertical' }}
      />
      <label style={{
        display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px',
        fontSize: '12px', color: 'var(--dm-text-muted)', cursor: 'pointer', userSelect: 'none',
      }}>
        <input type="checkbox" checked={manual} onChange={e => setManual(e.target.checked)} />
        {FORM_MANUAL_LABEL} <span style={{ fontSize: '10px', opacity: 0.7 }}>{FORM_MANUAL_HELP}</span>
      </label>
      {!manual ? <div style={{ marginBottom: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
          <span className="text-muted" style={{ fontSize: '11px', fontWeight: 500 }}>{FORM_SKILLS_LABEL}</span>
          {!userEditedSkills && suggested.length > 0 ? (
            <span className="text-accent" style={{ fontSize: '10px', fontStyle: 'italic' }}>{FORM_SKILLS_AUTO}</span>
          ) : null}
        </div>
        <input
          value={displaySkills}
          onInput={(e: React.FormEvent<HTMLInputElement>) => { setManualSkills((e.target as HTMLInputElement).value); setUserEditedSkills(true); }}
          onFocus={() => { if (!userEditedSkills) { setManualSkills(suggested.join(', ')); setUserEditedSkills(true); } }}
          placeholder={FORM_SKILLS_PLACEHOLDER}
          className="input-card"
          style={{ width: '100%', padding: '6px 8px', fontSize: '12px', color: userEditedSkills ? 'var(--dm-text)' : 'var(--dm-accent)' }}
        />
        {suggested.length > 0 && !userEditedSkills ? (
          <div style={{ marginTop: '6px' }}>
            <div className="text-light" style={{ fontSize: '10px', lineHeight: 1.5 }}>
              {FORM_SKILLS_MATCHED} {matches.map(m => (
                <code key={m.word} className="commit-ref" style={{
                  padding: '0 4px', marginRight: '3px', fontSize: '10px',
                }}>"{m.word}"</code>
              ))}
            </div>
          </div>
        ) : null}
      </div> : null}
      <div style={{ display: 'flex', gap: '8px' }}>
        {onCancel ? (
          <button type="button" onClick={onCancel} className="btn btn-secondary btn-sm" style={{
            padding: '6px 12px',
          }}>{FORM_CANCEL}</button>
        ) : null}
        <button type="submit" className="btn btn-primary btn-sm" style={{
          flex: 1, padding: '6px 12px',
        }}>{card ? FORM_SAVE : FORM_ADD_TASK}</button>
      </div>
    </form>
  );
}
