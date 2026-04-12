import type { StateData, Task, Epic } from '../types.js';
import { STATUS } from '../constants.js';
import { createActivityList } from './activity.js';

export function addTask(state: StateData, taskData: Partial<Task>): StateData {
  const tasks = state.tasks || [];
  const maxId = tasks.reduce((max, t) => Math.max(max, typeof t.id === 'number' ? t.id : 0), 0);
  const newTask = { ...taskData, id: maxId + 1, createdAt: new Date().toISOString() } as Task;
  const newTasks = [...tasks, newTask];
  const activity = createActivityList('"' + newTask.name + '" added', state.activity || [], newTask.id);
  return { ...state, tasks: newTasks, activity };
}

export function updateTask(state: StateData, id: number, updates: Partial<Task>): StateData {
  const tasks = state.tasks || [];
  const existing = tasks.find(t => t.id === id);
  const enriched: Partial<Task> = { ...updates };
  if (updates.status && updates.status !== existing?.status) {
    const history = [...(existing?.history || [])];
    if (history.length === 0 && existing?.createdAt) {
      history.push({ status: STATUS.CREATED, at: existing.createdAt });
    }
    history.push({ status: updates.status, at: new Date().toISOString() });
    enriched.history = history;
  }
  const newTasks = tasks.map(t => t.id === id ? { ...t, ...enriched } : t);
  const activity = createActivityList(
    (existing?.name || 'Task') + (updates.status ? ' marked ' + updates.status : ' updated'),
    state.activity || [],
    id,
  );
  return { ...state, tasks: newTasks, activity };
}

export function batchUpdateTasks(state: StateData, updates: Array<{ id: number; updates: Partial<Task> }>): StateData {
  const tasks = (state.tasks || []).map(t => {
    const entry = updates.find(u => u.id === t.id);
    return entry ? { ...t, ...entry.updates } : t;
  });
  return { ...state, tasks };
}

export function updateNotes(state: StateData, id: number, note: string): StateData {
  return { ...state, taskNotes: { ...state.taskNotes, [id]: note } };
}

export function deleteTask(state: StateData, id: number): StateData {
  const tasks = state.tasks || [];
  const queue = state.queue || [];
  const taskNotes = { ...state.taskNotes };
  const task = tasks.find(t => t.id === id);

  const newTasks = tasks.filter(t => t.id !== id).map(t =>
    t.dependsOn ? { ...t, dependsOn: t.dependsOn.filter(d => d !== id) } : t
  );
  const newQueue = queue.filter(q => q.task !== id);
  delete taskNotes[id];
  const activity = createActivityList((task?.name || 'Task') + ' deleted', state.activity || [], id);
  return { ...state, tasks: newTasks, queue: newQueue, taskNotes, activity };
}

export function bulkDeleteTasks(state: StateData, ids: number[]): StateData {
  const tasks = state.tasks || [];
  const queue = state.queue || [];
  const taskNotes = { ...state.taskNotes };
  const idSet = new Set(ids);

  const newTasks = tasks.filter(t => !idSet.has(t.id)).map(t =>
    t.dependsOn ? { ...t, dependsOn: t.dependsOn.filter(d => !idSet.has(d)) } : t
  );
  const newQueue = queue.filter(q => !idSet.has(q.task));
  ids.forEach(id => delete taskNotes[id]);
  const activity = createActivityList(ids.length + ' tasks deleted', state.activity || []);
  return { ...state, tasks: newTasks, queue: newQueue, taskNotes, activity };
}

export function renameGroup(state: StateData, oldName: string, newName: string): StateData {
  const tasks = (state.tasks || []).map(t => t.group === oldName ? { ...t, group: newName } : t);
  const epics = (state.epics || []).map(e => e.name === oldName ? { ...e, name: newName } : e);
  return { ...state, tasks, epics };
}

export function deleteGroup(state: StateData, groupName: string): StateData {
  const tasks = state.tasks || [];
  const queue = state.queue || [];
  const taskNotes = { ...state.taskNotes };
  const epics = state.epics || [];

  const groupTasks = tasks.filter(t => t.group === groupName);
  const deletedIds = new Set(groupTasks.map(t => t.id));

  const newTasks = tasks.filter(t => t.group !== groupName).map(t =>
    t.dependsOn ? { ...t, dependsOn: t.dependsOn.filter(d => !deletedIds.has(d)) } : t
  );
  const newQueue = queue.filter(q => !deletedIds.has(q.task));
  deletedIds.forEach(id => { delete taskNotes[id]; });
  const newEpics = epics.filter(e => e.name !== groupName);
  const activity = createActivityList(
    `Epic '${groupName}' deleted with ${groupTasks.length} tasks`,
    state.activity || [],
  );
  return { ...state, tasks: newTasks, queue: newQueue, taskNotes, epics: newEpics, activity };
}
