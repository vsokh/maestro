import { ORCHESTRATOR_SKILL_TEMPLATE } from './orchestrator.ts';
import { CODEHEALTH_SKILL_TEMPLATE } from './codehealth.ts';
import { AUTOFIX_SKILL_TEMPLATE } from './autofix.ts';
import { validateState, validateProgress } from './validate.ts';
import type { StateData, ProgressEntry, FileSystemDirectoryHandleExt } from './types';

const FS_DB_NAME = 'devmanager_fs';
const FS_STORE = 'handles';
const STATE_DIR = '.devmanager';
const STATE_FILENAME = 'state.json';

export function openFsDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(FS_DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(FS_STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveDirHandle(handle: FileSystemDirectoryHandle, projectName: string): Promise<void> {
  const db = await openFsDb();
  const tx = db.transaction(FS_STORE, 'readwrite');
  const store = tx.objectStore(FS_STORE);
  store.put(handle, 'project_' + (projectName || handle.name));
  store.put(projectName || handle.name, 'lastProject');
  return new Promise(r => { tx.oncomplete = () => r(); });
}

export async function loadDirHandle(projectName: string | null): Promise<FileSystemDirectoryHandle | null> {
  const db = await openFsDb();
  const tx = db.transaction(FS_STORE, 'readonly');
  const store = tx.objectStore(FS_STORE);
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

export async function clearDirHandle(projectName: string | null): Promise<void> {
  const db = await openFsDb();
  const tx = db.transaction(FS_STORE, 'readwrite');
  const store = tx.objectStore(FS_STORE);
  if (projectName) {
    store.delete('project_' + projectName);
  }
  store.delete('lastProject');
}

export async function verifyHandle(handle: FileSystemDirectoryHandle | null, onError?: (msg: string) => void): Promise<boolean> {
  if (!handle) return false;
  try {
    const perm = await (handle as FileSystemDirectoryHandleExt).queryPermission({ mode: 'readwrite' });
    return perm === 'granted';
  } catch (err) { console.error('verifyHandle failed:', err); onError?.('Permission check failed'); return false; }
}

export async function requestAccess(handle: FileSystemDirectoryHandle | null, onError?: (msg: string) => void): Promise<boolean> {
  if (!handle) return false;
  try {
    const perm = await (handle as FileSystemDirectoryHandleExt).requestPermission({ mode: 'readwrite' });
    return perm === 'granted';
  } catch (err) { console.error('requestAccess failed:', err); onError?.('Could not get folder access'); return false; }
}

export async function ensureDevManagerDir(projectHandle: FileSystemDirectoryHandle): Promise<FileSystemDirectoryHandle> {
  return await projectHandle.getDirectoryHandle(STATE_DIR, { create: true });
}

function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return hash.toString(36);
}

async function deploySkill(projectHandle: FileSystemDirectoryHandle, skillName: string, filename: string, template: string, onError?: (msg: string) => void): Promise<boolean> {
  try {
    const claude = await projectHandle.getDirectoryHandle('.claude', { create: true });
    const skills = await claude.getDirectoryHandle('skills', { create: true });
    const dir = await skills.getDirectoryHandle(skillName, { create: true });

    const hash = simpleHash(template);

    try {
      const hashFile = await dir.getFileHandle('.hash');
      const file = await hashFile.getFile();
      if ((await file.text()).trim() === hash) return false;
    } catch { /* expected: no hash file yet */ }

    const fileHandle = await dir.getFileHandle(filename, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(template);
    await writable.close();

    const hashHandle = await dir.getFileHandle('.hash', { create: true });
    const hw = await hashHandle.createWritable();
    await hw.write(hash);
    await hw.close();

    return true;
  } catch (err) { console.error('deploySkill failed:', err); onError?.('Failed to deploy skill files'); return false; }
}

export async function ensureOrchestratorSkill(projectHandle: FileSystemDirectoryHandle, onError?: (msg: string) => void): Promise<boolean> {
  return deploySkill(projectHandle, 'orchestrator', 'SKILL.md', ORCHESTRATOR_SKILL_TEMPLATE, onError);
}

export async function ensureCodehealthSkill(projectHandle: FileSystemDirectoryHandle, onError?: (msg: string) => void): Promise<boolean> {
  return deploySkill(projectHandle, 'codehealth', 'skill.md', CODEHEALTH_SKILL_TEMPLATE, onError);
}

export async function ensureAutofixSkill(projectHandle: FileSystemDirectoryHandle, onError?: (msg: string) => void): Promise<boolean> {
  return deploySkill(projectHandle, 'autofix', 'SKILL.md', AUTOFIX_SKILL_TEMPLATE, onError);
}

export async function syncSkills(projectHandle: FileSystemDirectoryHandle, onError?: (msg: string) => void): Promise<void> {
  await ensureOrchestratorSkill(projectHandle, onError);
  await ensureCodehealthSkill(projectHandle, onError);
  await ensureAutofixSkill(projectHandle, onError);
}

export async function writeState(projectHandle: FileSystemDirectoryHandle, data: StateData, onError?: (msg: string) => void): Promise<boolean> {
  try {
    const dir = await ensureDevManagerDir(projectHandle);
    const fileHandle = await dir.getFileHandle(STATE_FILENAME, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(JSON.stringify(data, null, 2));
    await writable.close();
    return true;
  } catch (err) { console.error('writeState failed:', err); onError?.('Failed to save — your changes may not be persisted'); return false; }
}

export async function readState(projectHandle: FileSystemDirectoryHandle, onError?: (msg: string) => void): Promise<{ data: StateData; lastModified: number } | null> {
  try {
    const dir = await projectHandle.getDirectoryHandle(STATE_DIR);
    const fileHandle = await dir.getFileHandle(STATE_FILENAME);
    const file = await fileHandle.getFile();
    const text = await file.text();
    const parsed = JSON.parse(text);
    const data = validateState(parsed);
    if (!data) return null;
    return { data, lastModified: file.lastModified };
  } catch (err) {
    console.error('readState failed:', err);
    onError?.('Failed to read project data');
    return null;
  }
}

export async function saveAttachment(projectHandle: FileSystemDirectoryHandle, taskId: number, filename: string, blob: Blob): Promise<string> {
  const dmDir = await ensureDevManagerDir(projectHandle);
  const attachDir = await dmDir.getDirectoryHandle('attachments', { create: true });
  const taskDir = await attachDir.getDirectoryHandle(String(taskId), { create: true });
  const fileHandle = await taskDir.getFileHandle(filename, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(blob);
  await writable.close();
  return `.devmanager/attachments/${taskId}/${filename}`;
}

export async function deleteAttachment(projectHandle: FileSystemDirectoryHandle, taskId: number, filename: string, onError?: (msg: string) => void): Promise<void> {
  try {
    const dmDir = await projectHandle.getDirectoryHandle('.devmanager');
    const attachDir = await dmDir.getDirectoryHandle('attachments');
    const taskDir = await attachDir.getDirectoryHandle(String(taskId));
    await taskDir.removeEntry(filename);
  } catch (err) { console.error('deleteAttachment failed:', err); onError?.('Failed to delete attachment'); }
}

export async function readAttachmentUrl(projectHandle: FileSystemDirectoryHandle, taskId: number, filename: string): Promise<string | null> {
  try {
    const dmDir = await projectHandle.getDirectoryHandle('.devmanager');
    const attachDir = await dmDir.getDirectoryHandle('attachments');
    const taskDir = await attachDir.getDirectoryHandle(String(taskId));
    const fileHandle = await taskDir.getFileHandle(filename);
    const file = await fileHandle.getFile();
    return URL.createObjectURL(file);
  } catch (err) { console.error('readAttachmentUrl failed:', err); return null; }
}

export async function readProgressFiles(projectHandle: FileSystemDirectoryHandle, onError?: (msg: string) => void): Promise<Record<string, ProgressEntry>> {
  try {
    const dmDir = await projectHandle.getDirectoryHandle('.devmanager');
    const progDir = await dmDir.getDirectoryHandle('progress');
    const entries: Record<string, ProgressEntry> = {};
    for await (const [name, handle] of (progDir as FileSystemDirectoryHandleExt).entries()) {
      if (name.endsWith('.json') && handle.kind === 'file') {
        try {
          const file = await (handle as FileSystemFileHandle).getFile();
          const text = await file.text();
          const key = name.replace('.json', '');
          const taskId = parseInt(key, 10);
          if (!isNaN(taskId)) {
            const parsed = JSON.parse(text);
            const validated = validateProgress(parsed);
            if (validated) {
              entries[taskId] = validated;
            }
          } else {
            entries[key] = JSON.parse(text);
          }
        } catch (err) { console.error('Failed to parse progress file:', name, err); onError?.('Failed to read progress file: ' + name); }
      }
    }
    return entries;
  } catch (err) {
    console.error('readProgressFiles failed:', err);
    onError?.('Failed to read progress files');
    return {};
  }
}

export async function deleteProgressFile(projectHandle: FileSystemDirectoryHandle, taskId: string | number): Promise<void> {
  try {
    const dmDir = await projectHandle.getDirectoryHandle('.devmanager');
    const progDir = await dmDir.getDirectoryHandle('progress');
    await progDir.removeEntry(taskId + '.json');
  } catch (err) { console.error('deleteProgressFile failed:', err); }
}

export function createDefaultState(projectName: string): StateData {
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

export async function snapshotState(projectHandle: FileSystemDirectoryHandle, onError?: (msg: string) => void): Promise<string | null> {
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

    await pruneBackups(projectHandle, 10, onError);
    return filename;
  } catch (err) { console.error('snapshotState failed:', err); onError?.('Failed to create backup'); return null; }
}

interface BackupFile {
  name: string;
  lastModified: number;
}

export async function listBackups(projectHandle: FileSystemDirectoryHandle): Promise<BackupFile[]> {
  try {
    const dir = await projectHandle.getDirectoryHandle('.devmanager');
    const backupDir = await dir.getDirectoryHandle('backups');
    const files: BackupFile[] = [];
    for await (const [name, handle] of (backupDir as FileSystemDirectoryHandleExt).entries()) {
      if (name.startsWith('state-') && name.endsWith('.json') && handle.kind === 'file') {
        const file = await (handle as FileSystemFileHandle).getFile();
        files.push({ name, lastModified: file.lastModified });
      }
    }
    return files.sort((a, b) => b.lastModified - a.lastModified);
  } catch (err) { console.error('listBackups failed:', err); return []; }
}

export async function pruneBackups(projectHandle: FileSystemDirectoryHandle, keep: number = 10, onError?: (msg: string) => void): Promise<void> {
  try {
    const files = await listBackups(projectHandle);
    if (files.length <= keep) return;
    const dir = await projectHandle.getDirectoryHandle('.devmanager');
    const backupDir = await dir.getDirectoryHandle('backups');
    for (const file of files.slice(keep)) {
      await backupDir.removeEntry(file.name);
    }
  } catch (err) { console.error('pruneBackups failed:', err); onError?.('Failed to clean up old backups'); }
}
