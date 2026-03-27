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
    <form onSubmit={handleSubmit} className="card-form p-16 mb-16">
      <input
        value={title} onInput={(e: React.FormEvent<HTMLInputElement>) => setTitle((e.target as HTMLInputElement).value)}
        placeholder={FORM_TITLE_PLACEHOLDER} autoFocus
        className="input-card w-full py-6 px-8 text-13 font-600 mb-8"
      />
      <div className="flex gap-8 mb-8">
        <input
          value={group} onInput={(e: React.FormEvent<HTMLInputElement>) => setGroup((e.target as HTMLInputElement).value)}
          placeholder={FORM_EPIC_PLACEHOLDER}
          list="group-list"
          className="input-card flex-1 py-6 px-8 text-12"
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
        className="input-card w-full py-6 px-8 text-13 mb-8"
        style={{ resize: 'vertical' }}
      />
      <label className="flex-center gap-6 text-12 cursor-pointer" style={{
        marginBottom: '10px',
        color: 'var(--dm-text-muted)', userSelect: 'none',
      }}>
        <input type="checkbox" checked={manual} onChange={e => setManual(e.target.checked)} />
        {FORM_MANUAL_LABEL} <span className="text-10" style={{ opacity: 0.7 }}>{FORM_MANUAL_HELP}</span>
      </label>
      {!manual ? <div className="mb-12">
        <div className="flex-center gap-6 mb-4">
          <span className="text-muted text-11 font-500">{FORM_SKILLS_LABEL}</span>
          {!userEditedSkills && suggested.length > 0 ? (
            <span className="text-accent text-10" style={{ fontStyle: 'italic' }}>{FORM_SKILLS_AUTO}</span>
          ) : null}
        </div>
        <input
          value={displaySkills}
          onInput={(e: React.FormEvent<HTMLInputElement>) => { setManualSkills((e.target as HTMLInputElement).value); setUserEditedSkills(true); }}
          onFocus={() => { if (!userEditedSkills) { setManualSkills(suggested.join(', ')); setUserEditedSkills(true); } }}
          placeholder={FORM_SKILLS_PLACEHOLDER}
          className="input-card w-full py-6 px-8 text-12"
          style={{ color: userEditedSkills ? 'var(--dm-text)' : 'var(--dm-accent)' }}
        />
        {suggested.length > 0 && !userEditedSkills ? (
          <div className="mt-6">
            <div className="text-light text-10 leading-normal">
              {FORM_SKILLS_MATCHED} {matches.map(m => (
                <code key={m.word} className="commit-ref text-10 mr-4" style={{
                  padding: '0 4px',
                }}>"{m.word}"</code>
              ))}
            </div>
          </div>
        ) : null}
      </div> : null}
      <div className="flex gap-8">
        {onCancel ? (
          <button type="button" onClick={onCancel} className="btn btn-secondary btn-sm py-6 px-12">{FORM_CANCEL}</button>
        ) : null}
        <button type="submit" className="btn btn-primary btn-sm flex-1 py-6 px-12">{card ? FORM_SAVE : FORM_ADD_TASK}</button>
      </div>
    </form>
  );
}
