import type { Task } from '../../types';
import {
  ATTACHMENTS_TITLE, ATTACHMENTS_PLACEHOLDER, ATTACHMENTS_LOADING,
  ATTACHMENTS_DELETE_ARIA, ATTACHMENTS_DELETE_TITLE,
} from '../../constants/strings.ts';

/**
 * Display component for the attachments/screenshots list.
 */
interface AttachmentsListProps {
  task: Task;
  thumbUrls: Record<string, string>;
  onDeleteAttachment: (taskId: number, attachmentId: string) => void;
}

export function AttachmentsList({ task, thumbUrls, onDeleteAttachment }: AttachmentsListProps) {
  const attachments = task.attachments || [];

  return (
    <div style={{ marginBottom: '16px' }}>
      <div className="label" style={{ marginBottom: '6px' }}>
        {ATTACHMENTS_TITLE}
      </div>
      {attachments.length === 0 ? (
        <div className="attachment-placeholder" style={{ padding: '12px' }}>
          {ATTACHMENTS_PLACEHOLDER}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {attachments.map(att => (
            <div
              key={att.id}
              style={{ position: 'relative', borderRadius: '6px', overflow: 'hidden', border: '1px solid var(--dm-border)' }}
              className="attachment-thumb"
            >
              {thumbUrls[att.id] ? (
                <img
                  src={thumbUrls[att.id]}
                  alt={att.filename}
                  style={{ display: 'block', maxWidth: '100%', maxHeight: '120px', objectFit: 'contain', background: 'var(--dm-bg)' }}
                />
              ) : (
                <div style={{ height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--dm-bg)', fontSize: '11px', color: 'var(--dm-text-light)' }}>
                  {ATTACHMENTS_LOADING}
                </div>
              )}
              <div style={{
                fontSize: '10px', color: 'var(--dm-text-muted)', padding: '3px 6px',
                background: 'var(--dm-bg)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {att.filename}
              </div>
              <button
                onClick={() => onDeleteAttachment(task.id, att.id)}
                aria-label={ATTACHMENTS_DELETE_ARIA}
                className="attachment-delete-btn attachment-delete"
                style={{
                  position: 'absolute', top: '4px', right: '4px',
                  width: '20px', height: '20px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  opacity: 0, fontSize: '12px', lineHeight: 1, padding: 0,
                }}
                title={ATTACHMENTS_DELETE_TITLE}
              >
                &#215;
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
