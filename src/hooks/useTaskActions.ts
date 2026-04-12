import { saveAttachment, deleteAttachment as deleteAttachmentFile } from '../fs.ts';
import {
  addTask as engineAddTask,
  updateTask as engineUpdateTask,
  batchUpdateTasks as engineBatchUpdateTasks,
  updateNotes as engineUpdateNotes,
  deleteTask as engineDeleteTask,
  bulkDeleteTasks as engineBulkDeleteTasks,
  renameGroup as engineRenameGroup,
  deleteGroup as engineDeleteGroup,
} from 'taskgraph';
import type { StateData, Task, Epic, Attachment } from '../types';

interface UseTaskActionsParams {
  data: StateData | null;
  save: (data: StateData) => void;
  snapshotBeforeAction: (label: string) => void;
  onError: (msg: string) => void;
}

export function useTaskActions({ data, save, snapshotBeforeAction, onError }: UseTaskActionsParams) {
  const handleUpdateTask = (id: number, updates: Partial<Task>) => {
    if (!data) return;
    save(engineUpdateTask(data, id, updates));
  };

  const handleBatchUpdateTasks = (updates: Array<{ id: number; updates: Partial<Task> }>) => {
    if (!data) return;
    save(engineBatchUpdateTasks(data, updates));
  };

  const handleUpdateNotes = (id: number, note: string) => {
    if (!data) return;
    save(engineUpdateNotes(data, id, note));
  };

  const handleAddTask = (taskData: Partial<Task>) => {
    if (!data) return;
    save(engineAddTask(data, taskData));
  };

  const handleRenameGroup = (oldName: string, newName: string) => {
    if (!data) return;
    save(engineRenameGroup(data, oldName, newName));
  };

  const handleDeleteGroup = (groupName: string) => {
    if (!data) return;
    const groupTasks = (data.tasks || []).filter(t => t.group === groupName);
    snapshotBeforeAction(`Epic '${groupName}' and ${groupTasks.length} tasks deleted`);
    save(engineDeleteGroup(data, groupName));
  };

  const handleUpdateEpics = (newEpics: Epic[]) => {
    if (!data) return;
    save({ ...data, epics: newEpics });
  };

  const handleDeleteTask = (id: number) => {
    if (!data) return;
    const task = (data.tasks || []).find(t => t.id === id);
    snapshotBeforeAction((task?.name || 'Task') + ' deleted');
    save(engineDeleteTask(data, id));
  };

  const handleBulkDeleteTasks = (ids: number[]) => {
    if (!data) return;
    snapshotBeforeAction(ids.length + ' tasks deleted');
    save(engineBulkDeleteTasks(data, ids));
  };

  const handleAddAttachment = async (taskId: number, file: File) => {
    try {
      const filename = file.name;
      const path = await saveAttachment(taskId, filename, file);
      const attachment: Attachment = { id: 'att_' + Date.now(), filename, path };
      const task = (data?.tasks || []).find(t => t.id === taskId);
      const attachments = [...(task?.attachments || []), attachment];
      handleUpdateTask(taskId, { attachments });
    } catch (err) {
      console.error('Failed to save attachment:', err);
      if (onError) onError(`Failed to save screenshot: ${err instanceof Error ? err.message : err}`);
    }
  };

  const handleDeleteAttachment = async (taskId: number, attachmentId: string) => {
    snapshotBeforeAction('Attachment deleted');
    try {
      const task = (data?.tasks || []).find(t => t.id === taskId);
      const att = (task?.attachments || []).find(a => a.id === attachmentId);
      if (att) await deleteAttachmentFile(taskId, att.filename);
      const attachments = (task?.attachments || []).filter(a => a.id !== attachmentId);
      handleUpdateTask(taskId, { attachments });
    } catch (err) {
      console.error('Failed to delete attachment:', err);
      if (onError) onError(`Failed to delete screenshot: ${err instanceof Error ? err.message : err}`);
    }
  };

  return {
    handleUpdateTask,
    handleBatchUpdateTasks,
    handleUpdateNotes,
    handleAddTask,
    handleRenameGroup,
    handleDeleteGroup,
    handleUpdateEpics,
    handleDeleteTask,
    handleBulkDeleteTasks,
    handleAddAttachment,
    handleDeleteAttachment,
  };
}
