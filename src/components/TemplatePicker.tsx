import React, { useState } from 'react';
import { PROJECT_TEMPLATES } from '../templates.ts';
import type { ProjectTemplate } from '../templates.ts';
import {
  TEMPLATE_PICKER_TITLE, TEMPLATE_PICKER_SUBTITLE, TEMPLATE_PICKER_BLANK,
  TEMPLATE_PICKER_BLANK_DESC, TEMPLATE_PICKER_BACK, TEMPLATE_PICKER_DETAILS,
  TEMPLATE_PICKER_LESS, TEMPLATE_PICKER_EPICS_LABEL, TEMPLATE_PICKER_AGENTS_LABEL,
  TEMPLATE_PICKER_TASKS_LABEL, TEMPLATE_PICKER_SCAFFOLD_LABEL,
} from '../constants/strings.ts';

interface TemplatePickerProps {
  onSelect: (template: ProjectTemplate | null) => void;
  onBack: () => void;
}

export function TemplatePicker({ onSelect, onBack }: TemplatePickerProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [showDetails, setShowDetails] = useState<string | null>(null);

  return (
    <div className="min-h-screen flex-col items-center justify-center p-32">
      <div className="text-center mb-32">
        <h1 className="font-700 text-28 mb-8" style={{ color: 'var(--dm-text)' }}>
          {TEMPLATE_PICKER_TITLE}
        </h1>
        <p className="text-light text-14" style={{ maxWidth: '440px' }}>
          {TEMPLATE_PICKER_SUBTITLE}
        </p>
      </div>

      <div className="w-full mb-24" style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: '16px',
        maxWidth: '960px',
      }}>
        {PROJECT_TEMPLATES.map(template => {
          const isHovered = hoveredId === template.id;
          const isShowingDetails = showDetails === template.id;

          return (
            <div
              key={template.id}
              onMouseEnter={() => setHoveredId(template.id)}
              onMouseLeave={() => setHoveredId(null)}
              onClick={() => onSelect(template)}
              role="button"
              tabIndex={0}
              onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(template); } }}
              className="flex-col gap-12 cursor-pointer p-20"
              style={{
                background: 'var(--dm-surface)',
                border: isHovered
                  ? `2px solid ${template.color}`
                  : '2px solid var(--dm-border)',
                borderRadius: 'var(--dm-radius)',
                transition: 'all 0.2s',
                boxShadow: isHovered
                  ? 'var(--dm-shadow-md)'
                  : 'var(--dm-shadow-sm)',
              }}
            >
              {/* Icon + name */}
              <div className="flex-center gap-10">
                <span className="text-28" style={{ lineHeight: 1 }}>{template.icon}</span>
                <div className="font-700 text-16" style={{ color: 'var(--dm-text)' }}>
                  {template.name}
                </div>
              </div>

              {/* Description */}
              <p className="text-12" style={{
                color: 'var(--dm-text-muted)', lineHeight: 1.5,
                margin: 0,
              }}>
                {template.description}
              </p>

              {/* Skills summary */}
              <div className="flex-wrap gap-4">
                {template.skills.map(skill => (
                  <span
                    key={skill.name}
                    className="badge badge-accent text-10"
                  >
                    {skill.name}
                  </span>
                ))}
              </div>

              {/* Epics preview */}
              <div className="pt-8" style={{ borderTop: '1px solid var(--dm-border)', marginTop: 'auto' }}>
                <div className="label-sm mb-4">{TEMPLATE_PICKER_EPICS_LABEL}</div>
                <div className="flex-wrap gap-4">
                  {template.epics.map(epic => (
                    <span key={epic.name} className="text-10 font-500" style={{
                      padding: '1px 6px', borderRadius: '4px',
                      background: 'var(--dm-bg)', color: 'var(--dm-text-muted)',
                    }}>
                      {epic.name}
                    </span>
                  ))}
                </div>
              </div>

              {/* Details toggle */}
              <button
                onClick={e => { e.stopPropagation(); setShowDetails(isShowingDetails ? null : template.id); }}
                className="btn-ghost btn-xs self-start text-11"
                style={{ padding: '2px 8px' }}
              >
                {isShowingDetails ? TEMPLATE_PICKER_LESS : TEMPLATE_PICKER_DETAILS}
              </button>

              {/* Expanded details */}
              {isShowingDetails && (
                <div className="flex-col gap-8 pt-8 text-11" style={{
                  borderTop: '1px solid var(--dm-border)',
                  color: 'var(--dm-text-muted)',
                }}>
                  <div>
                    <div className="label-sm mb-2">{TEMPLATE_PICKER_AGENTS_LABEL}</div>
                    <div className="flex-wrap gap-4">
                      {template.agents.map(agent => (
                        <span
                          key={agent.name}
                          className="badge badge-pending text-10"
                        >
                          {agent.name}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div className="label-sm mb-2">{TEMPLATE_PICKER_TASKS_LABEL}</div>
                    <ul className="leading-relaxed" style={{ margin: 0, paddingLeft: '16px' }}>
                      {template.epics.flatMap(e => (e.defaultTasks || []).map(t => (
                        <li key={`${e.name}-${t}`} className="text-11">{t}</li>
                      )))}
                    </ul>
                  </div>
                  {template.scaffoldCommand && (
                    <div>
                      <div className="label-sm mb-2">{TEMPLATE_PICKER_SCAFFOLD_LABEL}</div>
                      <code className="text-11" style={{
                        fontFamily: 'monospace',
                        background: 'var(--dm-bg)', padding: '2px 6px', borderRadius: '3px',
                      }}>
                        {template.scaffoldCommand}
                      </code>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {/* Blank project card */}
        <div
          onMouseEnter={() => setHoveredId('blank')}
          onMouseLeave={() => setHoveredId(null)}
          onClick={() => onSelect(null)}
          role="button"
          tabIndex={0}
          onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(null); } }}
          className="flex-col gap-12 justify-center items-center cursor-pointer p-20"
          style={{
            background: 'var(--dm-surface)',
            border: hoveredId === 'blank'
              ? '2px solid var(--dm-text-light)'
              : '2px dashed var(--dm-border)',
            borderRadius: 'var(--dm-radius)',
            transition: 'all 0.2s',
            boxShadow: hoveredId === 'blank'
              ? 'var(--dm-shadow-md)'
              : 'var(--dm-shadow-sm)',
            minHeight: '200px',
          }}
        >
          <div className="text-28" style={{ lineHeight: 1, opacity: 0.5 }}>+</div>
          <div className="font-700 text-16" style={{ color: 'var(--dm-text)' }}>{TEMPLATE_PICKER_BLANK}</div>
          <p className="text-12 text-center" style={{
            color: 'var(--dm-text-muted)',
            margin: 0, lineHeight: 1.5,
          }}>
            {TEMPLATE_PICKER_BLANK_DESC}
          </p>
        </div>
      </div>

      {/* Back button */}
      <button
        onClick={onBack}
        className="btn-ghost text-13"
        style={{ padding: '8px 16px' }}
      >
        {TEMPLATE_PICKER_BACK}
      </button>
    </div>
  );
}
