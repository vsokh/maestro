import { ORCHESTRATOR_SKILL_TEMPLATE } from './orchestrator.js';
import { CODEHEALTH_SKILL_TEMPLATE } from './codehealth.js';

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

export async function saveDirHandle(handle, projectName) {
  const db = await openFsDb();
  const tx = db.transaction(FS_STORE, 'readwrite');
  const store = tx.objectStore(FS_STORE);
  store.put(handle, 'project_' + (projectName || handle.name));
  store.put(projectName || handle.name, 'lastProject');
  return new Promise(r => { tx.oncomplete = r; });
}

export async function loadDirHandle(projectName) {
  const db = await openFsDb();
  const tx = db.transaction(FS_STORE, 'readonly');
  const store = tx.objectStore(FS_STORE);
  // If projectName given, load that specific handle; otherwise load last used
  if (projectName) {
    const req = store.get('project_' + projectName);
    return new Promise(r => { req.onsuccess = () => r(req.result || null); });
  }
  const lastReq = store.get('lastProject');
  return new Promise(resolve => {
    lastReq.onsuccess = () => {
      const last = lastReq.result;
      if (!last) return resolve(null);
      const handleReq = store.get('project_' + last);
      handleReq.onsuccess = () => resolve(handleReq.result || null);
    };
  });
}

export async function clearDirHandle(projectName) {
  const db = await openFsDb();
  const tx = db.transaction(FS_STORE, 'readwrite');
  const store = tx.objectStore(FS_STORE);
  if (projectName) {
    store.delete('project_' + projectName);
  }
  store.delete('lastProject');
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

export async function ensureCodehealthSkill(projectHandle) {
  try {
    const claude = await projectHandle.getDirectoryHandle('.claude', { create: true });
    const skills = await claude.getDirectoryHandle('skills', { create: true });
    const ch = await skills.getDirectoryHandle('codehealth', { create: true });
    const fileHandle = await ch.getFileHandle('skill.md', { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(CODEHEALTH_SKILL_TEMPLATE);
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

// Snapshot state.json to .devmanager/backups/state-{timestamp}.json
export async function snapshotState(projectHandle) {
  try {
    const dir = await projectHandle.getDirectoryHandle('.devmanager');
    const fileHandle = await dir.getFileHandle('state.json');
    const file = await fileHandle.getFile();
    const text = await file.text();

    const backupDir = await dir.getDirectoryHandle('backups', { create: true });
    const filename = 'state-' + Date.now() + '.json';
    const backupHandle = await backupDir.getFileHandle(filename, { create: true });
    const writable = await backupHandle.createWritable();
    await writable.write(text);
    await writable.close();

    // Auto-prune: keep only last 10 backups
    await pruneBackups(projectHandle, 10);
    return filename;
  } catch { return null; }
}

// List backup files (newest first)
export async function listBackups(projectHandle) {
  try {
    const dir = await projectHandle.getDirectoryHandle('.devmanager');
    const backupDir = await dir.getDirectoryHandle('backups');
    const files = [];
    for await (const [name, handle] of backupDir.entries()) {
      if (name.startsWith('state-') && name.endsWith('.json') && handle.kind === 'file') {
        const file = await handle.getFile();
        files.push({ name, lastModified: file.lastModified });
      }
    }
    return files.sort((a, b) => b.lastModified - a.lastModified);
  } catch { return []; }
}

// Delete oldest backups beyond the keep limit
export async function pruneBackups(projectHandle, keep = 10) {
  try {
    const files = await listBackups(projectHandle);
    if (files.length <= keep) return;
    const dir = await projectHandle.getDirectoryHandle('.devmanager');
    const backupDir = await dir.getDirectoryHandle('backups');
    for (const file of files.slice(keep)) {
      await backupDir.removeEntry(file.name);
    }
  } catch {}
}
