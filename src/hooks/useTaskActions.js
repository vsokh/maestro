import { saveAttachment, deleteAttachment } from '../fs.js';
import { STATUS } from '../constants/statuses.js';

export function useTaskActions({ data, save, dirHandle, snapshotBeforeAction, onError }) {
  const tasks = data?.tasks || [];
  const epics = data?.epics || [];
  const queue = data?.queue || [];
  const taskNotes = data?.taskNotes || {};

  const updateData = (partial) => {
    save({ ...data, ...partial });
  };

  const addActivity = (label, taskId) => {
    const entry = { id: 'act_' + Date.now(), time: Date.now(), label };
    if (taskId != null) entry.taskId = taskId;
    return [entry, ...(data?.activity || [])].slice(0, 20);
  };

  const handleUpdateTask = (id, updates) => {
    const existing = tasks.find(t => t.id === id);
    const enriched = { ...updates };
    // Record every state change in history stack
    if (updates.status && updates.status !== existing?.status) {
      const history = [...(existing?.history || [])];
      // Auto-add initial "created" entry if history is empty
      if (history.length === 0 && existing?.createdAt) {
        history.push({ status: STATUS.CREATED, at: existing.createdAt });
      }
      history.push({ status: updates.status, at: new Date().toISOString() });
      enriched.history = history;
    }
    const newTasks = tasks.map(t => t.id === id ? { ...t, ...enriched } : t);
    const newActivity = addActivity((existing?.name || 'Task') + (updates.status ? ' marked ' + updates.status : ' updated'), id);
    updateData({ tasks: newTasks, activity: newActivity });
  };

  const handleUpdateNotes = (id, note) => {
    updateData({ taskNotes: { ...taskNotes, [id]: note } });
  };

  const handleAddTask = (taskData) => {
    const maxId = tasks.reduce((max, t) => Math.max(max, typeof t.id === 'number' ? t.id : 0), 0);
    const newTask = { ...taskData, id: maxId + 1, createdAt: new Date().toISOString() };
    const newTasks = [...tasks, newTask];
    const newActivity = addActivity('"' + newTask.name + '" added', newTask.id);
    updateData({ tasks: newTasks, activity: newActivity });
  };

  const handleRenameGroup = (oldName, newName) => {
    const newTasks = tasks.map(t => t.group === oldName ? { ...t, group: newName } : t);
    const newEpics = epics.map(e => e.name === oldName ? { ...e, name: newName } : e);
    updateData({ tasks: newTasks, epics: newEpics });
  };

  const handleUpdateEpics = (newEpics) => {
    updateData({ epics: newEpics });
  };

  const handleDeleteTask = (id) => {
    const task = tasks.find(t => t.id === id);
    snapshotBeforeAction((task?.name || 'Task') + ' deleted');
    // Remove the task and clean up dependsOn references in other tasks
    const newTasks = tasks.filter(t => t.id !== id).map(t =>
      t.dependsOn ? { ...t, dependsOn: t.dependsOn.filter(d => d !== id) } : t
    );
    const newQueue = queue.filter(q => q.task !== id);
    const { [id]: _, ...newTaskNotes } = taskNotes;
    const newActivity = addActivity((task?.name || 'Task') + ' deleted', id);
    updateData({ tasks: newTasks, queue: newQueue, taskNotes: newTaskNotes, activity: newActivity });
  };

  const handleAddAttachment = async (taskId, file) => {
    if (!dirHandle) return;
    try {
      const filename = file.name;
      const path = await saveAttachment(dirHandle, taskId, filename, file);
      const attachment = { id: 'att_' + Date.now(), filename, path };
      const task = tasks.find(t => t.id === taskId);
      const attachments = [...(task?.attachments || []), attachment];
      handleUpdateTask(taskId, { attachments });
    } catch (err) {
      console.error('Failed to save attachment:', err);
      if (onError) onError('Failed to save screenshot');
    }
  };

  const handleDeleteAttachment = async (taskId, attachmentId) => {
    if (!dirHandle) return;
    snapshotBeforeAction('Attachment deleted');
    try {
      const task = tasks.find(t => t.id === taskId);
      const att = (task?.attachments || []).find(a => a.id === attachmentId);
      if (att) await deleteAttachment(dirHandle, taskId, att.filename);
      const attachments = (task?.attachments || []).filter(a => a.id !== attachmentId);
      handleUpdateTask(taskId, { attachments });
    } catch (err) {
      console.error('Failed to delete attachment:', err);
      if (onError) onError('Failed to delete screenshot');
    }
  };

  return {
    handleUpdateTask,
    handleUpdateNotes,
    handleAddTask,
    handleRenameGroup,
    handleUpdateEpics,
    handleDeleteTask,
    handleAddAttachment,
    handleDeleteAttachment,
  };
}
