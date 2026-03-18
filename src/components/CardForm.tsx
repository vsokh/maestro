import type { Task } from '../types';
import React, { useState, useMemo } from 'react';
import { suggestSkills } from '../skills.ts';

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
      id: card?.id as any,
      name: title.trim(),
      fullName: title.trim(),
      description: description.trim(),
      group: group.trim() || undefined as any,
      skills: manual ? [] : finalSkills,
      manual,
      status: (card?.status || 'pending') as any,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="card-form" style={{ padding: '16px', marginBottom: '16px' }}>
      <input
        value={title} onInput={(e: React.FormEvent<HTMLInputElement>) => setTitle((e.target as HTMLInputElement).value)}
        placeholder="Task title..." autoFocus
        className="input-card"
        style={{ width: '100%', padding: '6px 8px', fontSize: '13px', fontWeight: 600, marginBottom: '8px' }}
      />
      <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
        <input
          value={group} onInput={(e: React.FormEvent<HTMLInputElement>) => setGroup((e.target as HTMLInputElement).value)}
          placeholder="Epic (e.g. Auth, DevToolbar)..."
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
        placeholder="Description (what needs to be done)..."
        rows={2}
        className="input-card"
        style={{ width: '100%', padding: '6px 8px', fontSize: '13px', marginBottom: '8px', resize: 'vertical' }}
      />
      <label style={{
        display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px',
        fontSize: '12px', color: 'var(--dm-text-muted)', cursor: 'pointer', userSelect: 'none',
      }}>
        <input type="checkbox" checked={manual} onChange={e => setManual(e.target.checked)} />
        Manual task <span style={{ fontSize: '10px', opacity: 0.7 }}>(done by you, not Claude)</span>
      </label>
      {!manual ? <div style={{ marginBottom: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
          <span className="text-muted" style={{ fontSize: '11px', fontWeight: 500 }}>Skills</span>
          {!userEditedSkills && suggested.length > 0 ? (
            <span className="text-accent" style={{ fontSize: '10px', fontStyle: 'italic' }}>auto-detected</span>
          ) : null}
        </div>
        <input
          value={displaySkills}
          onInput={(e: React.FormEvent<HTMLInputElement>) => { setManualSkills((e.target as HTMLInputElement).value); setUserEditedSkills(true); }}
          onFocus={() => { if (!userEditedSkills) { setManualSkills(suggested.join(', ')); setUserEditedSkills(true); } }}
          placeholder="Auto-detected from title, or type manually..."
          className="input-card"
          style={{ width: '100%', padding: '6px 8px', fontSize: '12px', color: userEditedSkills ? 'var(--dm-text)' : 'var(--dm-accent)' }}
        />
        {suggested.length > 0 && !userEditedSkills ? (
          <div style={{ marginTop: '6px' }}>
            <div className="text-light" style={{ fontSize: '10px', lineHeight: 1.5 }}>
              matched: {matches.map(m => (
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
          }}>Cancel</button>
        ) : null}
        <button type="submit" className="btn btn-primary btn-sm" style={{
          flex: 1, padding: '6px 12px',
        }}>{card ? 'Save' : 'Add task'}</button>
      </div>
    </form>
  );
}
