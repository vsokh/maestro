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
    <div className="mb-16">
      <div className="label mb-6">
        {ATTACHMENTS_TITLE}
      </div>
      {attachments.length === 0 ? (
        <div className="attachment-placeholder" style={{ padding: '12px' }}>
          {ATTACHMENTS_PLACEHOLDER}
        </div>
      ) : (
        <div className="flex-col gap-8">
          {attachments.map(att => (
            <div
              key={att.id}
              className="attachment-thumb relative overflow-hidden"
              style={{ borderRadius: '6px', border: '1px solid var(--dm-border)' }}
            >
              {thumbUrls[att.id] ? (
                <img
                  src={thumbUrls[att.id]}
                  alt={att.filename}
                  className="block"
                  style={{ maxWidth: '100%', maxHeight: '120px', objectFit: 'contain', background: 'var(--dm-bg)' }}
                />
              ) : (
                <div className="flex-center justify-center text-11" style={{ height: '40px', background: 'var(--dm-bg)', color: 'var(--dm-text-light)' }}>
                  {ATTACHMENTS_LOADING}
                </div>
              )}
              <div className="text-10 truncate" style={{
                color: 'var(--dm-text-muted)', padding: '3px 6px',
                background: 'var(--dm-bg)',
              }}>
                {att.filename}
              </div>
              <button
                onClick={() => onDeleteAttachment(task.id, att.id)}
                aria-label={ATTACHMENTS_DELETE_ARIA}
                className="attachment-delete-btn attachment-delete absolute flex-center justify-center text-12"
                style={{
                  top: '4px', right: '4px',
                  width: '20px', height: '20px',
                  opacity: 0, lineHeight: 1, padding: 0,
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
