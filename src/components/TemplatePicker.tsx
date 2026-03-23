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
    <div style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', padding: '32px',
    }}>
      <div style={{ textAlign: 'center', marginBottom: '32px' }}>
        <h1 style={{ fontWeight: 700, fontSize: '28px', color: 'var(--dm-text)', marginBottom: '8px' }}>
          {TEMPLATE_PICKER_TITLE}
        </h1>
        <p className="text-light" style={{ fontSize: '14px', maxWidth: '440px' }}>
          {TEMPLATE_PICKER_SUBTITLE}
        </p>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: '16px',
        maxWidth: '960px',
        width: '100%',
        marginBottom: '24px',
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
              style={{
                background: 'var(--dm-surface)',
                border: isHovered
                  ? `2px solid ${template.color}`
                  : '2px solid var(--dm-border)',
                borderRadius: 'var(--dm-radius)',
                padding: '20px',
                cursor: 'pointer',
                transition: 'all 0.2s',
                boxShadow: isHovered
                  ? 'var(--dm-shadow-md)'
                  : 'var(--dm-shadow-sm)',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
              }}
            >
              {/* Icon + name */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '28px', lineHeight: 1 }}>{template.icon}</span>
                <div style={{ fontWeight: 700, fontSize: '16px', color: 'var(--dm-text)' }}>
                  {template.name}
                </div>
              </div>

              {/* Description */}
              <p style={{
                fontSize: '12px', color: 'var(--dm-text-muted)', lineHeight: 1.5,
                margin: 0,
              }}>
                {template.description}
              </p>

              {/* Skills summary */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                {template.skills.map(skill => (
                  <span
                    key={skill.name}
                    className="badge badge-accent"
                    style={{ fontSize: '10px' }}
                  >
                    {skill.name}
                  </span>
                ))}
              </div>

              {/* Epics preview */}
              <div style={{ borderTop: '1px solid var(--dm-border)', paddingTop: '8px', marginTop: 'auto' }}>
                <div className="label-sm" style={{ marginBottom: '4px' }}>{TEMPLATE_PICKER_EPICS_LABEL}</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                  {template.epics.map(epic => (
                    <span key={epic.name} style={{
                      fontSize: '10px', fontWeight: 500,
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
                className="btn-ghost btn-xs"
                style={{ padding: '2px 8px', alignSelf: 'flex-start', fontSize: '11px' }}
              >
                {isShowingDetails ? TEMPLATE_PICKER_LESS : TEMPLATE_PICKER_DETAILS}
              </button>

              {/* Expanded details */}
              {isShowingDetails && (
                <div style={{
                  borderTop: '1px solid var(--dm-border)',
                  paddingTop: '8px',
                  fontSize: '11px', color: 'var(--dm-text-muted)',
                  display: 'flex', flexDirection: 'column', gap: '8px',
                }}>
                  <div>
                    <div className="label-sm" style={{ marginBottom: '2px' }}>{TEMPLATE_PICKER_AGENTS_LABEL}</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                      {template.agents.map(agent => (
                        <span
                          key={agent.name}
                          className="badge badge-pending"
                          style={{ fontSize: '10px' }}
                        >
                          {agent.name}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div className="label-sm" style={{ marginBottom: '2px' }}>{TEMPLATE_PICKER_TASKS_LABEL}</div>
                    <ul style={{ margin: 0, paddingLeft: '16px', lineHeight: 1.6 }}>
                      {template.epics.flatMap(e => (e.defaultTasks || []).map(t => (
                        <li key={`${e.name}-${t}`} style={{ fontSize: '11px' }}>{t}</li>
                      )))}
                    </ul>
                  </div>
                  {template.scaffoldCommand && (
                    <div>
                      <div className="label-sm" style={{ marginBottom: '2px' }}>{TEMPLATE_PICKER_SCAFFOLD_LABEL}</div>
                      <code style={{
                        fontSize: '11px', fontFamily: 'monospace',
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
          style={{
            background: 'var(--dm-surface)',
            border: hoveredId === 'blank'
              ? '2px solid var(--dm-text-light)'
              : '2px dashed var(--dm-border)',
            borderRadius: 'var(--dm-radius)',
            padding: '20px',
            cursor: 'pointer',
            transition: 'all 0.2s',
            boxShadow: hoveredId === 'blank'
              ? 'var(--dm-shadow-md)'
              : 'var(--dm-shadow-sm)',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            justifyContent: 'center',
            alignItems: 'center',
            minHeight: '200px',
          }}
        >
          <div style={{ fontSize: '28px', lineHeight: 1, opacity: 0.5 }}>+</div>
          <div style={{ fontWeight: 700, fontSize: '16px', color: 'var(--dm-text)' }}>{TEMPLATE_PICKER_BLANK}</div>
          <p style={{
            fontSize: '12px', color: 'var(--dm-text-muted)', textAlign: 'center',
            margin: 0, lineHeight: 1.5,
          }}>
            {TEMPLATE_PICKER_BLANK_DESC}
          </p>
        </div>
      </div>

      {/* Back button */}
      <button
        onClick={onBack}
        className="btn-ghost"
        style={{ padding: '8px 16px', fontSize: '13px' }}
      >
        {TEMPLATE_PICKER_BACK}
      </button>
    </div>
  );
}
