import { ORCHESTRATOR_SKILL_TEMPLATE } from './orchestrator.js';

const FS_DB_NAME = 'devmanager_fs';
const FS_STORE = 'handles';
const STATE_DIR = '.devmanager';
const STATE_FILENAME = 'state.json';

export function openFsDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(FS_DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(FS_STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveDirHandle(handle) {
  const db = await openFsDb();
  const tx = db.transaction(FS_STORE, 'readwrite');
  tx.objectStore(FS_STORE).put(handle, 'projectDir');
  return new Promise(r => { tx.oncomplete = r; });
}

export async function loadDirHandle() {
  const db = await openFsDb();
  const tx = db.transaction(FS_STORE, 'readonly');
  const req = tx.objectStore(FS_STORE).get('projectDir');
  return new Promise(r => { req.onsuccess = () => r(req.result || null); });
}

export async function clearDirHandle() {
  const db = await openFsDb();
  const tx = db.transaction(FS_STORE, 'readwrite');
  tx.objectStore(FS_STORE).delete('projectDir');
}

export async function verifyHandle(handle) {
  if (!handle) return false;
  try {
    const perm = await handle.queryPermission({ mode: 'readwrite' });
    return perm === 'granted';
  } catch { return false; }
}

export async function requestAccess(handle) {
  if (!handle) return false;
  try {
    const perm = await handle.requestPermission({ mode: 'readwrite' });
    return perm === 'granted';
  } catch { return false; }
}

export async function ensureDevManagerDir(projectHandle) {
  return await projectHandle.getDirectoryHandle(STATE_DIR, { create: true });
}

export async function ensureOrchestratorSkill(projectHandle) {
  try {
    const claude = await projectHandle.getDirectoryHandle('.claude', { create: true });
    const skills = await claude.getDirectoryHandle('skills', { create: true });
    const orch = await skills.getDirectoryHandle('orchestrator', { create: true });
    // Always write latest template — single source of truth is the app
    const fileHandle = await orch.getFileHandle('SKILL.md', { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(ORCHESTRATOR_SKILL_TEMPLATE);
    await writable.close();
  } catch { /* permission issues, skip silently */ }
}

export async function writeState(projectHandle, data) {
  try {
    const dir = await ensureDevManagerDir(projectHandle);
    const fileHandle = await dir.getFileHandle(STATE_FILENAME, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(JSON.stringify(data, null, 2));
    await writable.close();
    return true;
  } catch { return false; }
}

export async function readState(projectHandle) {
  try {
    const dir = await projectHandle.getDirectoryHandle(STATE_DIR);
    const fileHandle = await dir.getFileHandle(STATE_FILENAME);
    const file = await fileHandle.getFile();
    const text = await file.text();
    return { data: JSON.parse(text), lastModified: file.lastModified };
  } catch {
    return null;
  }
}

// Save an attachment file to .devmanager/attachments/{taskId}/{filename}
export async function saveAttachment(projectHandle, taskId, filename, blob) {
  const dmDir = await ensureDevManagerDir(projectHandle);
  const attachDir = await dmDir.getDirectoryHandle('attachments', { create: true });
  const taskDir = await attachDir.getDirectoryHandle(String(taskId), { create: true });
  const fileHandle = await taskDir.getFileHandle(filename, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(blob);
  await writable.close();
  return `.devmanager/attachments/${taskId}/${filename}`;
}

// Delete an attachment
export async function deleteAttachment(projectHandle, taskId, filename) {
  try {
    const dmDir = await projectHandle.getDirectoryHandle('.devmanager');
    const attachDir = await dmDir.getDirectoryHandle('attachments');
    const taskDir = await attachDir.getDirectoryHandle(String(taskId));
    await taskDir.removeEntry(filename);
  } catch {}
}

// Read an attachment as object URL (for displaying)
export async function readAttachmentUrl(projectHandle, taskId, filename) {
  try {
    const dmDir = await projectHandle.getDirectoryHandle('.devmanager');
    const attachDir = await dmDir.getDirectoryHandle('attachments');
    const taskDir = await attachDir.getDirectoryHandle(String(taskId));
    const fileHandle = await taskDir.getFileHandle(filename);
    const file = await fileHandle.getFile();
    return URL.createObjectURL(file);
  } catch { return null; }
}

// Read all progress files from .devmanager/progress/
export async function readProgressFiles(projectHandle) {
  try {
    const dmDir = await projectHandle.getDirectoryHandle('.devmanager');
    const progDir = await dmDir.getDirectoryHandle('progress');
    const entries = {};
    for await (const [name, handle] of progDir.entries()) {
      if (name.endsWith('.json') && handle.kind === 'file') {
        try {
          const file = await handle.getFile();
          const text = await file.text();
          const taskId = parseInt(name.replace('.json', ''), 10);
          if (!isNaN(taskId)) {
            entries[taskId] = JSON.parse(text);
          }
        } catch {}
      }
    }
    return entries;
  } catch {
    return {};
  }
}

// Delete a progress file after merging
export async function deleteProgressFile(projectHandle, taskId) {
  try {
    const dmDir = await projectHandle.getDirectoryHandle('.devmanager');
    const progDir = await dmDir.getDirectoryHandle('progress');
    await progDir.removeEntry(taskId + '.json');
  } catch {}
}

export function createDefaultState(projectName) {
  return {
    savedAt: new Date().toISOString(),
    project: projectName,
    tasks: [],
    features: [],
    queue: [],
    taskNotes: {},
    activity: [{ id: 'act_init', time: Date.now(), label: 'Project initialized' }],
  };
}
