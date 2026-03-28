// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'node:events';
import { writeFile, mkdtemp, rm, mkdir, readFile, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// ---------------------------------------------------------------------------
// Mocks — must be declared before importing the module under test
// ---------------------------------------------------------------------------

const mockGetActiveProject = vi.fn();
const mockGetProjects = vi.fn();
const mockSwitchProject = vi.fn();
const mockBroadcast = vi.fn();

vi.mock('../index.js', () => ({
  getActiveProject: (...args) => mockGetActiveProject(...args),
  getProjects: (...args) => mockGetProjects(...args),
  switchProject: (...args) => mockSwitchProject(...args),
  broadcast: (...args) => mockBroadcast(...args),
}));

const mockLaunchProcess = vi.fn();
const mockListProcesses = vi.fn();
const mockGetAllOutput = vi.fn();
const mockKillProcess = vi.fn();

vi.mock('../process.js', () => ({
  getProcessManager: () => ({
    launchProcess: mockLaunchProcess,
    listProcesses: mockListProcesses,
    getAllOutput: mockGetAllOutput,
    killProcess: mockKillProcess,
  }),
}));

const mockOpenNativeFolderDialog = vi.fn();

vi.mock('../dialogs.js', () => ({
  openNativeFolderDialog: (...args) => mockOpenNativeFolderDialog(...args),
}));

const mockExecFile = vi.fn();
const mockSpawn = vi.fn();

vi.mock('node:child_process', () => ({
  execFile: (...args) => mockExecFile(...args),
  spawn: (...args) => mockSpawn(...args),
}));

vi.mock('node:os', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    homedir: vi.fn(() => actual.homedir()),
    platform: vi.fn(() => 'win32'),
  };
});

// Import after mocks
const { handleApi } = await import('../api.js');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mockReq(method, pathname, body = null, query = '') {
  const emitter = new EventEmitter();
  emitter.method = method;
  emitter.url = `http://localhost${pathname}${query}`;
  emitter.headers = { host: 'localhost' };
  process.nextTick(() => {
    if (body !== null) {
      emitter.emit('data', Buffer.from(JSON.stringify(body)));
    }
    emitter.emit('end');
  });
  return emitter;
}

function mockRawReq(method, pathname, rawBuffer, query = '') {
  const emitter = new EventEmitter();
  emitter.method = method;
  emitter.url = `http://localhost${pathname}${query}`;
  emitter.headers = { host: 'localhost' };
  // Use setTimeout to delay data emission, giving async route matching time
  // to reach the handler that calls parseBody before data arrives
  setTimeout(() => {
    if (rawBuffer) {
      emitter.emit('data', rawBuffer);
    }
    emitter.emit('end');
  }, 50);
  return emitter;
}

function mockRes() {
  return {
    writeHead: vi.fn(),
    end: vi.fn(),
  };
}

function getJsonResponse(res) {
  return JSON.parse(res.end.mock.calls[0][0]);
}

// ---------------------------------------------------------------------------
// Test setup
// ---------------------------------------------------------------------------

let tmpDir;
let devmanagerDir;

beforeEach(async () => {
  tmpDir = await mkdtemp(join(tmpdir(), 'api-test-'));
  devmanagerDir = join(tmpDir, '.devmanager');
  await mkdir(devmanagerDir, { recursive: true });

  mockGetActiveProject.mockReturnValue(tmpDir);
  mockGetProjects.mockReturnValue([]);
  mockSwitchProject.mockImplementation(() => {});
  mockBroadcast.mockImplementation(() => {});
  mockLaunchProcess.mockReturnValue({ pid: 12345 });
  mockListProcesses.mockReturnValue([]);
  mockGetAllOutput.mockReturnValue({});
  mockKillProcess.mockReturnValue(true);
  mockOpenNativeFolderDialog.mockResolvedValue(null);
  mockExecFile.mockReset();
  mockSpawn.mockReset();
});

afterEach(async () => {
  vi.clearAllMocks();
  if (tmpDir) {
    await rm(tmpDir, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// 1. Non-API routes
// ---------------------------------------------------------------------------

describe('Non-API routes', () => {
  it('returns false for non-/api/ paths', async () => {
    const req = mockReq('GET', '/some/other/path');
    const res = mockRes();
    const result = await handleApi(req, res);
    expect(result).toBe(false);
    expect(res.writeHead).not.toHaveBeenCalled();
  });

  it('returns false for root path', async () => {
    const req = mockReq('GET', '/');
    const res = mockRes();
    const result = await handleApi(req, res);
    expect(result).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 2. GET /api/projects
// ---------------------------------------------------------------------------

describe('GET /api/projects', () => {
  it('returns the list from getProjects()', async () => {
    const projects = [
      { path: '/foo', name: 'foo', active: true },
      { path: '/bar', name: 'bar', active: false },
    ];
    mockGetProjects.mockReturnValue(projects);

    const req = mockReq('GET', '/api/projects');
    const res = mockRes();
    const result = await handleApi(req, res);

    expect(result).toBe(true);
    expect(res.writeHead).toHaveBeenCalledWith(200, expect.any(Object));
    expect(getJsonResponse(res)).toEqual(projects);
  });
});

// ---------------------------------------------------------------------------
// 3. PUT /api/project
// ---------------------------------------------------------------------------

describe('PUT /api/project', () => {
  it('switches project when given a valid directory path', async () => {
    const subDir = join(tmpDir, 'myproject');
    await mkdir(subDir);

    const req = mockReq('PUT', '/api/project', { path: subDir });
    const res = mockRes();
    const result = await handleApi(req, res);

    expect(result).toBe(true);
    expect(res.writeHead).toHaveBeenCalledWith(200, expect.any(Object));
    const body = getJsonResponse(res);
    expect(body.ok).toBe(true);
    expect(body.projectPath).toBeTruthy();
    expect(mockSwitchProject).toHaveBeenCalled();
  });

  it('returns 400 when path is missing', async () => {
    const req = mockReq('PUT', '/api/project', {});
    const res = mockRes();
    await handleApi(req, res);

    expect(res.writeHead).toHaveBeenCalledWith(400, expect.any(Object));
    expect(getJsonResponse(res).error).toBe('Missing path');
  });

  it('returns 400 when path is not a directory', async () => {
    const filePath = join(tmpDir, 'afile.txt');
    await writeFile(filePath, 'data');

    const req = mockReq('PUT', '/api/project', { path: filePath });
    const res = mockRes();
    await handleApi(req, res);

    expect(res.writeHead).toHaveBeenCalledWith(400, expect.any(Object));
    expect(getJsonResponse(res).error).toBe('Not a directory');
  });

  it("returns 400 when directory doesn't exist", async () => {
    const req = mockReq('PUT', '/api/project', { path: join(tmpDir, 'nonexistent') });
    const res = mockRes();
    await handleApi(req, res);

    expect(res.writeHead).toHaveBeenCalledWith(400, expect.any(Object));
    expect(getJsonResponse(res).error).toBe('Directory not found');
  });
});

// ---------------------------------------------------------------------------
// 4. GET /api/info
// ---------------------------------------------------------------------------

describe('GET /api/info', () => {
  it('returns projectPath and projectName', async () => {
    const req = mockReq('GET', '/api/info');
    const res = mockRes();
    await handleApi(req, res);

    expect(res.writeHead).toHaveBeenCalledWith(200, expect.any(Object));
    const body = getJsonResponse(res);
    expect(body.projectPath).toBe(tmpDir);
    expect(body.projectName).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// 5. GET /api/state
// ---------------------------------------------------------------------------

describe('GET /api/state', () => {
  it('returns state data + lastModified when state.json exists', async () => {
    const stateData = { project: 'test', tasks: [{ id: 1, name: 'Task 1' }] };
    await writeFile(join(devmanagerDir, 'state.json'), JSON.stringify(stateData));

    const req = mockReq('GET', '/api/state');
    const res = mockRes();
    await handleApi(req, res);

    expect(res.writeHead).toHaveBeenCalledWith(200, expect.any(Object));
    const body = getJsonResponse(res);
    expect(body.data).toEqual(stateData);
    expect(body.lastModified).toBeDefined();
    expect(typeof body.lastModified).toBe('number');
  });

  it("returns 404 when state.json doesn't exist", async () => {
    const req = mockReq('GET', '/api/state');
    const res = mockRes();
    await handleApi(req, res);

    expect(res.writeHead).toHaveBeenCalledWith(404, expect.any(Object));
    expect(getJsonResponse(res).error).toBe('State file not found');
  });
});

// ---------------------------------------------------------------------------
// 6. PUT /api/state
// ---------------------------------------------------------------------------

describe('PUT /api/state', () => {
  it('writes state.json and returns ok + lastModified', async () => {
    const stateData = { project: 'test', tasks: [] };
    const req = mockReq('PUT', '/api/state', stateData);
    const res = mockRes();
    await handleApi(req, res);

    expect(res.writeHead).toHaveBeenCalledWith(200, expect.any(Object));
    const body = getJsonResponse(res);
    expect(body.ok).toBe(true);
    expect(body.lastModified).toBeDefined();

    // Verify file was written
    const content = JSON.parse(await readFile(join(devmanagerDir, 'state.json'), 'utf-8'));
    expect(content.project).toBe('test');
  });

  it('increments _v version counter', async () => {
    const stateData = { project: 'test', _v: 5 };
    const req = mockReq('PUT', '/api/state', stateData);
    const res = mockRes();
    await handleApi(req, res);

    const content = JSON.parse(await readFile(join(devmanagerDir, 'state.json'), 'utf-8'));
    expect(content._v).toBe(6);
  });

  it('sets _v to 1 when not present', async () => {
    const stateData = { project: 'test' };
    const req = mockReq('PUT', '/api/state', stateData);
    const res = mockRes();
    await handleApi(req, res);

    const content = JSON.parse(await readFile(join(devmanagerDir, 'state.json'), 'utf-8'));
    expect(content._v).toBe(1);
  });

  it('strips _lastModified field before writing', async () => {
    const stateData = { project: 'test', _lastModified: 99999 };
    const req = mockReq('PUT', '/api/state', stateData);
    const res = mockRes();
    await handleApi(req, res);

    const content = JSON.parse(await readFile(join(devmanagerDir, 'state.json'), 'utf-8'));
    expect(content._lastModified).toBeUndefined();
  });

  it('returns 409 conflict when file is newer than client _lastModified', async () => {
    // Write a state file first
    const existingData = { project: 'existing' };
    await writeFile(join(devmanagerDir, 'state.json'), JSON.stringify(existingData));

    // Send with a very old _lastModified (but truthy) to trigger conflict
    // Note: _lastModified must be truthy for the concurrency check to activate
    const stateData = { project: 'updated', _lastModified: 1 };
    const req = mockReq('PUT', '/api/state', stateData);
    const res = mockRes();
    await handleApi(req, res);

    expect(res.writeHead).toHaveBeenCalledWith(409, expect.any(Object));
    const body = getJsonResponse(res);
    expect(body.error).toMatch(/Conflict/);
    expect(body.data).toEqual(existingData);
    expect(body.lastModified).toBeDefined();
  });

  it('writes successfully when no concurrency check (_lastModified not sent)', async () => {
    // Write an existing file
    await writeFile(join(devmanagerDir, 'state.json'), JSON.stringify({ old: true }));

    // Send without _lastModified — no concurrency check
    const stateData = { project: 'new' };
    const req = mockReq('PUT', '/api/state', stateData);
    const res = mockRes();
    await handleApi(req, res);

    expect(res.writeHead).toHaveBeenCalledWith(200, expect.any(Object));
    const content = JSON.parse(await readFile(join(devmanagerDir, 'state.json'), 'utf-8'));
    expect(content.project).toBe('new');
  });
});

// ---------------------------------------------------------------------------
// 7. GET /api/progress
// ---------------------------------------------------------------------------

describe('GET /api/progress', () => {
  it('returns all progress JSON files keyed by filename (minus .json)', async () => {
    const progressDir = join(devmanagerDir, 'progress');
    await mkdir(progressDir, { recursive: true });
    await writeFile(join(progressDir, '1.json'), JSON.stringify({ status: 'done' }));
    await writeFile(join(progressDir, '2.json'), JSON.stringify({ status: 'in-progress' }));

    const req = mockReq('GET', '/api/progress');
    const res = mockRes();
    await handleApi(req, res);

    expect(res.writeHead).toHaveBeenCalledWith(200, expect.any(Object));
    const body = getJsonResponse(res);
    expect(body['1']).toEqual({ status: 'done' });
    expect(body['2']).toEqual({ status: 'in-progress' });
  });

  it("returns empty object when progress dir doesn't exist", async () => {
    const req = mockReq('GET', '/api/progress');
    const res = mockRes();
    await handleApi(req, res);

    expect(res.writeHead).toHaveBeenCalledWith(200, expect.any(Object));
    expect(getJsonResponse(res)).toEqual({});
  });

  it('skips non-JSON files', async () => {
    const progressDir = join(devmanagerDir, 'progress');
    await mkdir(progressDir, { recursive: true });
    await writeFile(join(progressDir, '1.json'), JSON.stringify({ status: 'done' }));
    await writeFile(join(progressDir, 'readme.txt'), 'not json');

    const req = mockReq('GET', '/api/progress');
    const res = mockRes();
    await handleApi(req, res);

    const body = getJsonResponse(res);
    expect(Object.keys(body)).toEqual(['1']);
  });
});

// ---------------------------------------------------------------------------
// 8. DELETE /api/progress/:taskId
// ---------------------------------------------------------------------------

describe('DELETE /api/progress/:taskId', () => {
  it('deletes progress file and returns ok', async () => {
    const progressDir = join(devmanagerDir, 'progress');
    await mkdir(progressDir, { recursive: true });
    await writeFile(join(progressDir, '42.json'), JSON.stringify({ status: 'done' }));

    const req = mockReq('DELETE', '/api/progress/42');
    const res = mockRes();
    await handleApi(req, res);

    expect(res.writeHead).toHaveBeenCalledWith(200, expect.any(Object));
    expect(getJsonResponse(res)).toEqual({ ok: true });
  });

  it("returns 404 when file doesn't exist", async () => {
    const req = mockReq('DELETE', '/api/progress/999');
    const res = mockRes();
    await handleApi(req, res);

    expect(res.writeHead).toHaveBeenCalledWith(404, expect.any(Object));
    expect(getJsonResponse(res).error).toBe('Progress file not found');
  });
});

// ---------------------------------------------------------------------------
// 9. GET /api/skills
// ---------------------------------------------------------------------------

describe('GET /api/skills', () => {
  it('discovers skills from .claude/skills/ directories (reads SKILL.md)', async () => {
    const skillDir = join(tmpDir, '.claude', 'skills', 'my-skill');
    await mkdir(skillDir, { recursive: true });
    await writeFile(join(skillDir, 'SKILL.md'), '---\ndescription: "A test skill"\n---\n# My Skill');

    const req = mockReq('GET', '/api/skills');
    const res = mockRes();
    await handleApi(req, res);

    expect(res.writeHead).toHaveBeenCalledWith(200, expect.any(Object));
    const body = getJsonResponse(res);
    const skill = body.find(s => s.name === 'my-skill');
    expect(skill).toBeDefined();
    expect(skill.type).toBe('skill');
    expect(skill.description).toBeTruthy();
  });

  it('discovers agents from .claude/agents/ .md files', async () => {
    const agentsDir = join(tmpDir, '.claude', 'agents');
    await mkdir(agentsDir, { recursive: true });
    await writeFile(join(agentsDir, 'my-agent.md'), '---\ndescription: "A test agent"\n---\n# My Agent');

    const req = mockReq('GET', '/api/skills');
    const res = mockRes();
    await handleApi(req, res);

    const body = getJsonResponse(res);
    const agent = body.find(a => a.name === 'my-agent');
    expect(agent).toBeDefined();
    expect(agent.type).toBe('agent');
  });

  it('skips "orchestrator" skill directory', async () => {
    const orchDir = join(tmpDir, '.claude', 'skills', 'orchestrator');
    await mkdir(orchDir, { recursive: true });
    await writeFile(join(orchDir, 'SKILL.md'), '---\ndescription: "Orchestrator"\n---');

    const otherDir = join(tmpDir, '.claude', 'skills', 'other');
    await mkdir(otherDir, { recursive: true });
    await writeFile(join(otherDir, 'SKILL.md'), '---\ndescription: "Other"\n---');

    const req = mockReq('GET', '/api/skills');
    const res = mockRes();
    await handleApi(req, res);

    const body = getJsonResponse(res);
    const names = body.map(s => s.name);
    expect(names).not.toContain('orchestrator');
    expect(names).toContain('other');
  });

  it("returns empty array when dirs don't exist", async () => {
    const req = mockReq('GET', '/api/skills');
    const res = mockRes();
    await handleApi(req, res);

    expect(res.writeHead).toHaveBeenCalledWith(200, expect.any(Object));
    expect(getJsonResponse(res)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// 10. POST /api/skills/deploy
// ---------------------------------------------------------------------------

describe('POST /api/skills/deploy', () => {
  it('deploys skill file and hash file', async () => {
    const req = mockReq('POST', '/api/skills/deploy', {
      skillName: 'test-skill',
      filename: 'SKILL.md',
      content: '# Test skill content',
    });
    const res = mockRes();
    await handleApi(req, res);

    expect(res.writeHead).toHaveBeenCalledWith(200, expect.any(Object));
    const body = getJsonResponse(res);
    expect(body.ok).toBe(true);
    expect(body.deployed).toBe(true);

    // Verify files exist
    const skillFile = await readFile(join(tmpDir, '.claude', 'skills', 'test-skill', 'SKILL.md'), 'utf-8');
    expect(skillFile).toBe('# Test skill content');
    const hashFile = await readFile(join(tmpDir, '.claude', 'skills', 'test-skill', '.hash'), 'utf-8');
    expect(hashFile).toBeTruthy();
  });

  it('skips deploy when hash matches (returns deployed: false)', async () => {
    // Deploy once
    const content = '# Same content';
    const req1 = mockReq('POST', '/api/skills/deploy', {
      skillName: 'test-skill',
      filename: 'SKILL.md',
      content,
    });
    const res1 = mockRes();
    await handleApi(req1, res1);
    expect(getJsonResponse(res1).deployed).toBe(true);

    // Deploy again with same content
    const req2 = mockReq('POST', '/api/skills/deploy', {
      skillName: 'test-skill',
      filename: 'SKILL.md',
      content,
    });
    const res2 = mockRes();
    await handleApi(req2, res2);

    const body = getJsonResponse(res2);
    expect(body.ok).toBe(true);
    expect(body.deployed).toBe(false);
  });

  it('returns 400 when required fields missing', async () => {
    const req = mockReq('POST', '/api/skills/deploy', { skillName: 'test' });
    const res = mockRes();
    await handleApi(req, res);

    expect(res.writeHead).toHaveBeenCalledWith(400, expect.any(Object));
    expect(getJsonResponse(res).error).toMatch(/Missing/);
  });
});

// ---------------------------------------------------------------------------
// 11. POST /api/agents/deploy
// ---------------------------------------------------------------------------

describe('POST /api/agents/deploy', () => {
  it('deploys agent file to agents directory', async () => {
    const req = mockReq('POST', '/api/agents/deploy', {
      agentName: 'my-agent',
      filename: 'agent.md',
      content: '# My Agent',
    });
    const res = mockRes();
    await handleApi(req, res);

    expect(res.writeHead).toHaveBeenCalledWith(200, expect.any(Object));
    const body = getJsonResponse(res);
    expect(body.ok).toBe(true);
    expect(body.deployed).toBe(true);

    const agentFile = await readFile(join(tmpDir, '.claude', 'agents', 'my-agent', 'agent.md'), 'utf-8');
    expect(agentFile).toBe('# My Agent');
  });

  it('returns 400 when required fields missing', async () => {
    const req = mockReq('POST', '/api/agents/deploy', { agentName: 'test' });
    const res = mockRes();
    await handleApi(req, res);

    expect(res.writeHead).toHaveBeenCalledWith(400, expect.any(Object));
    expect(getJsonResponse(res).error).toMatch(/Missing/);
  });
});

// ---------------------------------------------------------------------------
// 12. GET /api/skills-config & PUT /api/skills-config
// ---------------------------------------------------------------------------

describe('GET /api/skills-config', () => {
  it('returns skills.json contents', async () => {
    const config = { skills: ['a', 'b'] };
    await writeFile(join(devmanagerDir, 'skills.json'), JSON.stringify(config));

    const req = mockReq('GET', '/api/skills-config');
    const res = mockRes();
    await handleApi(req, res);

    expect(res.writeHead).toHaveBeenCalledWith(200, expect.any(Object));
    expect(getJsonResponse(res)).toEqual(config);
  });

  it('returns empty object when skills.json does not exist', async () => {
    const req = mockReq('GET', '/api/skills-config');
    const res = mockRes();
    await handleApi(req, res);

    expect(res.writeHead).toHaveBeenCalledWith(200, expect.any(Object));
    expect(getJsonResponse(res)).toEqual({});
  });
});

describe('PUT /api/skills-config', () => {
  it('writes skills.json', async () => {
    const config = { skills: ['x', 'y'] };
    const req = mockReq('PUT', '/api/skills-config', config);
    const res = mockRes();
    await handleApi(req, res);

    expect(res.writeHead).toHaveBeenCalledWith(200, expect.any(Object));
    expect(getJsonResponse(res)).toEqual({ ok: true });

    const content = JSON.parse(await readFile(join(devmanagerDir, 'skills.json'), 'utf-8'));
    expect(content).toEqual(config);
  });
});

// ---------------------------------------------------------------------------
// 13. GET /api/quality/latest & GET /api/quality/history
// ---------------------------------------------------------------------------

describe('GET /api/quality/latest', () => {
  it('returns data from latest.json', async () => {
    const qualityDir = join(devmanagerDir, 'quality');
    await mkdir(qualityDir, { recursive: true });
    const data = { score: 85, dimensions: {} };
    await writeFile(join(qualityDir, 'latest.json'), JSON.stringify(data));

    const req = mockReq('GET', '/api/quality/latest');
    const res = mockRes();
    await handleApi(req, res);

    expect(res.writeHead).toHaveBeenCalledWith(200, expect.any(Object));
    expect(getJsonResponse(res)).toEqual(data);
  });

  it('returns 404 when file does not exist', async () => {
    const req = mockReq('GET', '/api/quality/latest');
    const res = mockRes();
    await handleApi(req, res);

    expect(res.writeHead).toHaveBeenCalledWith(404, expect.any(Object));
  });
});

describe('GET /api/quality/history', () => {
  it('returns data from history.json', async () => {
    const qualityDir = join(devmanagerDir, 'quality');
    await mkdir(qualityDir, { recursive: true });
    const data = [{ date: '2025-01-01', score: 80 }];
    await writeFile(join(qualityDir, 'history.json'), JSON.stringify(data));

    const req = mockReq('GET', '/api/quality/history');
    const res = mockRes();
    await handleApi(req, res);

    expect(res.writeHead).toHaveBeenCalledWith(200, expect.any(Object));
    expect(getJsonResponse(res)).toEqual(data);
  });

  it('returns 404 when file does not exist', async () => {
    const req = mockReq('GET', '/api/quality/history');
    const res = mockRes();
    await handleApi(req, res);

    expect(res.writeHead).toHaveBeenCalledWith(404, expect.any(Object));
  });
});

// ---------------------------------------------------------------------------
// 14. POST /api/attachments/:taskId
// ---------------------------------------------------------------------------

describe('POST /api/attachments/:taskId', () => {
  it('saves uploaded file', async () => {
    const fileContent = Buffer.from('hello world');
    const req = mockRawReq('POST', '/api/attachments/5', fileContent, '?name=test.png');
    const res = mockRes();
    await handleApi(req, res);

    expect(res.writeHead).toHaveBeenCalledWith(200, expect.any(Object));
    const body = getJsonResponse(res);
    expect(body.ok).toBe(true);
    expect(body.path).toContain('attachments/5/test.png');

    const saved = await readFile(join(devmanagerDir, 'attachments', '5', 'test.png'));
    expect(saved.toString()).toBe('hello world');
  });

  it('returns 400 when ?name= query param missing', async () => {
    const req = mockRawReq('POST', '/api/attachments/5', Buffer.from('data'));
    const res = mockRes();
    await handleApi(req, res);

    expect(res.writeHead).toHaveBeenCalledWith(400, expect.any(Object));
    expect(getJsonResponse(res).error).toMatch(/name/i);
  });
});

// ---------------------------------------------------------------------------
// 15. GET /api/attachments/:taskId/:filename
// ---------------------------------------------------------------------------

describe('GET /api/attachments/:taskId/:filename', () => {
  it('returns file with correct MIME type', async () => {
    const attachDir = join(devmanagerDir, 'attachments', '5');
    await mkdir(attachDir, { recursive: true });
    const content = Buffer.from('PNG data');
    await writeFile(join(attachDir, 'image.png'), content);

    const req = mockReq('GET', '/api/attachments/5/image.png');
    const res = mockRes();
    await handleApi(req, res);

    expect(res.writeHead).toHaveBeenCalledWith(200, expect.objectContaining({
      'Content-Type': 'image/png',
    }));
    // The response is raw Buffer, not JSON
    expect(res.end).toHaveBeenCalledWith(content);
  });

  it("returns 404 when file doesn't exist", async () => {
    const req = mockReq('GET', '/api/attachments/5/nonexistent.png');
    const res = mockRes();
    await handleApi(req, res);

    expect(res.writeHead).toHaveBeenCalledWith(404, expect.any(Object));
    expect(getJsonResponse(res).error).toBe('Attachment not found');
  });
});

// ---------------------------------------------------------------------------
// 16. DELETE /api/attachments/:taskId/:filename
// ---------------------------------------------------------------------------

describe('DELETE /api/attachments/:taskId/:filename', () => {
  it('deletes file and returns ok', async () => {
    const attachDir = join(devmanagerDir, 'attachments', '5');
    await mkdir(attachDir, { recursive: true });
    await writeFile(join(attachDir, 'file.txt'), 'data');

    const req = mockReq('DELETE', '/api/attachments/5/file.txt');
    const res = mockRes();
    await handleApi(req, res);

    expect(res.writeHead).toHaveBeenCalledWith(200, expect.any(Object));
    expect(getJsonResponse(res)).toEqual({ ok: true });
  });

  it("returns 404 when file doesn't exist", async () => {
    const req = mockReq('DELETE', '/api/attachments/5/nonexistent.txt');
    const res = mockRes();
    await handleApi(req, res);

    expect(res.writeHead).toHaveBeenCalledWith(404, expect.any(Object));
    expect(getJsonResponse(res).error).toBe('Attachment not found');
  });
});

// ---------------------------------------------------------------------------
// 17. GET /api/backups
// ---------------------------------------------------------------------------

describe('GET /api/backups', () => {
  it('lists backup files (state-*.json) sorted by newest first', async () => {
    const backupDir = join(devmanagerDir, 'backups');
    await mkdir(backupDir, { recursive: true });
    await writeFile(join(backupDir, 'state-1000.json'), '{}');
    // Small delay to ensure different mtimes
    await new Promise(r => setTimeout(r, 50));
    await writeFile(join(backupDir, 'state-2000.json'), '{}');

    const req = mockReq('GET', '/api/backups');
    const res = mockRes();
    await handleApi(req, res);

    expect(res.writeHead).toHaveBeenCalledWith(200, expect.any(Object));
    const body = getJsonResponse(res);
    expect(body.backups).toHaveLength(2);
    // Newest first
    expect(body.backups[0].name).toBe('state-2000.json');
    expect(body.backups[1].name).toBe('state-1000.json');
    expect(body.backups[0].lastModified).toBeGreaterThanOrEqual(body.backups[1].lastModified);
  });

  it("returns empty array when backup dir doesn't exist", async () => {
    const req = mockReq('GET', '/api/backups');
    const res = mockRes();
    await handleApi(req, res);

    expect(res.writeHead).toHaveBeenCalledWith(200, expect.any(Object));
    expect(getJsonResponse(res).backups).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// 18. POST /api/backups/snapshot
// ---------------------------------------------------------------------------

describe('POST /api/backups/snapshot', () => {
  it('creates backup copy of state.json', async () => {
    const stateData = { project: 'test', tasks: [] };
    await writeFile(join(devmanagerDir, 'state.json'), JSON.stringify(stateData));

    const req = mockReq('POST', '/api/backups/snapshot');
    const res = mockRes();
    await handleApi(req, res);

    expect(res.writeHead).toHaveBeenCalledWith(200, expect.any(Object));
    const body = getJsonResponse(res);
    expect(body.ok).toBe(true);
    expect(body.filename).toMatch(/^state-\d+\.json$/);

    // Verify backup file exists
    const backupDir = join(devmanagerDir, 'backups');
    const files = await readdir(backupDir);
    expect(files).toContain(body.filename);
  });

  it('returns 404 when no state.json exists', async () => {
    const req = mockReq('POST', '/api/backups/snapshot');
    const res = mockRes();
    await handleApi(req, res);

    expect(res.writeHead).toHaveBeenCalledWith(404, expect.any(Object));
    expect(getJsonResponse(res).error).toMatch(/state\.json/);
  });

  it('prunes to keep only 10 most recent backups', async () => {
    // Create state.json
    await writeFile(join(devmanagerDir, 'state.json'), '{"project":"test"}');
    const backupDir = join(devmanagerDir, 'backups');
    await mkdir(backupDir, { recursive: true });

    // Create 11 existing backups
    for (let i = 0; i < 11; i++) {
      await writeFile(join(backupDir, `state-${1000 + i}.json`), '{}');
      await new Promise(r => setTimeout(r, 20)); // ensure different mtimes
    }

    // Take a new snapshot (will be the 12th backup)
    const req = mockReq('POST', '/api/backups/snapshot');
    const res = mockRes();
    await handleApi(req, res);

    expect(res.writeHead).toHaveBeenCalledWith(200, expect.any(Object));

    // Should have at most 10 backup files
    const files = (await readdir(backupDir)).filter(f => f.startsWith('state-') && f.endsWith('.json'));
    expect(files.length).toBeLessThanOrEqual(10);
  });
});

// ---------------------------------------------------------------------------
// 19. POST /api/backups/restore
// ---------------------------------------------------------------------------

describe('POST /api/backups/restore', () => {
  it('restores backup to state.json', async () => {
    const backupDir = join(devmanagerDir, 'backups');
    await mkdir(backupDir, { recursive: true });
    const backupData = { project: 'backup-data', tasks: [1, 2, 3] };
    await writeFile(join(backupDir, 'state-1234.json'), JSON.stringify(backupData));
    await writeFile(join(devmanagerDir, 'state.json'), '{"project":"current"}');

    const req = mockReq('POST', '/api/backups/restore', { filename: 'state-1234.json' });
    const res = mockRes();
    await handleApi(req, res);

    expect(res.writeHead).toHaveBeenCalledWith(200, expect.any(Object));
    expect(getJsonResponse(res)).toEqual({ ok: true });

    // Verify state.json was restored
    const content = JSON.parse(await readFile(join(devmanagerDir, 'state.json'), 'utf-8'));
    expect(content).toEqual(backupData);
  });

  it('returns 400 when filename missing', async () => {
    const req = mockReq('POST', '/api/backups/restore', {});
    const res = mockRes();
    await handleApi(req, res);

    expect(res.writeHead).toHaveBeenCalledWith(400, expect.any(Object));
    expect(getJsonResponse(res).error).toBe('Missing filename');
  });

  it('returns 400 for invalid filenames (path traversal attempts)', async () => {
    const req = mockReq('POST', '/api/backups/restore', { filename: '../../../etc/passwd' });
    const res = mockRes();
    await handleApi(req, res);

    expect(res.writeHead).toHaveBeenCalledWith(400, expect.any(Object));
    expect(getJsonResponse(res).error).toBe('Invalid backup filename');
  });

  it('returns 400 for filenames with backslash path traversal', async () => {
    const req = mockReq('POST', '/api/backups/restore', { filename: '..\\..\\etc\\passwd' });
    const res = mockRes();
    await handleApi(req, res);

    expect(res.writeHead).toHaveBeenCalledWith(400, expect.any(Object));
    expect(getJsonResponse(res).error).toBe('Invalid backup filename');
  });

  it('returns 400 for filenames that do not match state-*.json pattern', async () => {
    const req = mockReq('POST', '/api/backups/restore', { filename: 'malicious.json' });
    const res = mockRes();
    await handleApi(req, res);

    expect(res.writeHead).toHaveBeenCalledWith(400, expect.any(Object));
    expect(getJsonResponse(res).error).toBe('Invalid backup filename');
  });

  it("returns 404 when backup file doesn't exist", async () => {
    const req = mockReq('POST', '/api/backups/restore', { filename: 'state-9999.json' });
    const res = mockRes();
    await handleApi(req, res);

    expect(res.writeHead).toHaveBeenCalledWith(404, expect.any(Object));
    expect(getJsonResponse(res).error).toBe('Backup file not found');
  });
});

// ---------------------------------------------------------------------------
// 20. POST /api/launch
// ---------------------------------------------------------------------------

describe('POST /api/launch', () => {
  it('calls processManager.launchProcess and returns result', async () => {
    mockLaunchProcess.mockReturnValue({ pid: 42 });

    const req = mockReq('POST', '/api/launch', {
      taskId: 1,
      command: '/orchestrator task 1',
      engine: 'claude',
    });
    const res = mockRes();
    await handleApi(req, res);

    expect(res.writeHead).toHaveBeenCalledWith(200, expect.any(Object));
    expect(getJsonResponse(res)).toEqual({ pid: 42 });
    expect(mockLaunchProcess).toHaveBeenCalledWith(
      tmpDir, 1, '/orchestrator task 1', 'claude', expect.any(Function)
    );
  });

  it('defaults engine to claude when not specified', async () => {
    mockLaunchProcess.mockReturnValue({ pid: 99 });

    const req = mockReq('POST', '/api/launch', {
      taskId: 2,
      command: '/orchestrator task 2',
    });
    const res = mockRes();
    await handleApi(req, res);

    expect(mockLaunchProcess).toHaveBeenCalledWith(
      tmpDir, 2, '/orchestrator task 2', 'claude', expect.any(Function)
    );
  });

  it('returns 400 when taskId or command missing', async () => {
    const req = mockReq('POST', '/api/launch', { taskId: 1 });
    const res = mockRes();
    await handleApi(req, res);

    expect(res.writeHead).toHaveBeenCalledWith(400, expect.any(Object));
    expect(getJsonResponse(res).error).toMatch(/Missing/);
  });

  it('returns 400 when taskId is null and command missing', async () => {
    const req = mockReq('POST', '/api/launch', {});
    const res = mockRes();
    await handleApi(req, res);

    expect(res.writeHead).toHaveBeenCalledWith(400, expect.any(Object));
  });
});

// ---------------------------------------------------------------------------
// 21. GET /api/launch
// ---------------------------------------------------------------------------

describe('GET /api/launch', () => {
  it('returns processManager.listProcesses()', async () => {
    const processes = [
      { pid: 1, taskId: 1, engine: 'claude', startedAt: '2025-01-01' },
    ];
    mockListProcesses.mockReturnValue(processes);

    const req = mockReq('GET', '/api/launch');
    const res = mockRes();
    await handleApi(req, res);

    expect(res.writeHead).toHaveBeenCalledWith(200, expect.any(Object));
    expect(getJsonResponse(res)).toEqual(processes);
  });
});

// ---------------------------------------------------------------------------
// 22. GET /api/launch/output
// ---------------------------------------------------------------------------

describe('GET /api/launch/output', () => {
  it('returns processManager.getAllOutput()', async () => {
    const output = { '1': { output: [{ text: 'hello' }], running: true } };
    mockGetAllOutput.mockReturnValue(output);

    const req = mockReq('GET', '/api/launch/output');
    const res = mockRes();
    await handleApi(req, res);

    expect(res.writeHead).toHaveBeenCalledWith(200, expect.any(Object));
    expect(getJsonResponse(res)).toEqual(output);
  });
});

// ---------------------------------------------------------------------------
// 23. DELETE /api/launch/:pid
// ---------------------------------------------------------------------------

describe('DELETE /api/launch/:pid', () => {
  it('calls processManager.killProcess and returns ok', async () => {
    mockKillProcess.mockReturnValue(true);

    const req = mockReq('DELETE', '/api/launch/12345');
    const res = mockRes();
    await handleApi(req, res);

    expect(res.writeHead).toHaveBeenCalledWith(200, expect.any(Object));
    expect(getJsonResponse(res)).toEqual({ ok: true });
    expect(mockKillProcess).toHaveBeenCalledWith(12345);
  });

  it('returns 404 when process not found', async () => {
    mockKillProcess.mockReturnValue(false);

    const req = mockReq('DELETE', '/api/launch/99999');
    const res = mockRes();
    await handleApi(req, res);

    expect(res.writeHead).toHaveBeenCalledWith(404, expect.any(Object));
    expect(getJsonResponse(res).error).toBe('Process not found');
  });

  it('returns 400 for invalid PID', async () => {
    const req = mockReq('DELETE', '/api/launch/notanumber');
    const res = mockRes();
    await handleApi(req, res);

    expect(res.writeHead).toHaveBeenCalledWith(400, expect.any(Object));
    expect(getJsonResponse(res).error).toBe('Invalid PID');
  });
});

// ---------------------------------------------------------------------------
// 24. POST /api/browse/native
// ---------------------------------------------------------------------------

describe('POST /api/browse/native', () => {
  it('calls openNativeFolderDialog, returns path', async () => {
    mockOpenNativeFolderDialog.mockResolvedValue('/selected/path');

    const req = mockReq('POST', '/api/browse/native');
    const res = mockRes();
    await handleApi(req, res);

    expect(res.writeHead).toHaveBeenCalledWith(200, expect.any(Object));
    expect(getJsonResponse(res)).toEqual({ path: '/selected/path' });
  });

  it('returns cancelled when dialog returns null', async () => {
    mockOpenNativeFolderDialog.mockResolvedValue(null);

    const req = mockReq('POST', '/api/browse/native');
    const res = mockRes();
    await handleApi(req, res);

    expect(res.writeHead).toHaveBeenCalledWith(200, expect.any(Object));
    const body = getJsonResponse(res);
    expect(body.path).toBeNull();
    expect(body.cancelled).toBe(true);
  });

  it('returns 500 on dialog error', async () => {
    mockOpenNativeFolderDialog.mockRejectedValue(new Error('dialog failed'));

    const req = mockReq('POST', '/api/browse/native');
    const res = mockRes();
    await handleApi(req, res);

    expect(res.writeHead).toHaveBeenCalledWith(500, expect.any(Object));
    expect(getJsonResponse(res).error).toBe('dialog failed');
  });
});

// ---------------------------------------------------------------------------
// 25. GET /api/browse
// ---------------------------------------------------------------------------

describe('GET /api/browse', () => {
  it('lists directories for the given path', async () => {
    const subDir = join(tmpDir, 'project-a');
    await mkdir(subDir);

    const req = mockReq('GET', '/api/browse', null, `?path=${encodeURIComponent(tmpDir)}`);
    const res = mockRes();
    await handleApi(req, res);

    expect(res.writeHead).toHaveBeenCalledWith(200, expect.any(Object));
    const body = getJsonResponse(res);
    expect(body.current).toBeTruthy();
    expect(body.dirs).toBeInstanceOf(Array);
    const names = body.dirs.map(d => d.name);
    expect(names).toContain('project-a');
  });

  it('detects projects with .git directory', async () => {
    const projectDir = join(tmpDir, 'my-project');
    await mkdir(projectDir);
    await mkdir(join(projectDir, '.git'));

    const req = mockReq('GET', '/api/browse', null, `?path=${encodeURIComponent(tmpDir)}`);
    const res = mockRes();
    await handleApi(req, res);

    const body = getJsonResponse(res);
    const proj = body.dirs.find(d => d.name === 'my-project');
    expect(proj).toBeDefined();
    expect(proj.isProject).toBe(true);
  });

  it('detects projects with package.json', async () => {
    const projectDir = join(tmpDir, 'npm-project');
    await mkdir(projectDir);
    await writeFile(join(projectDir, 'package.json'), '{}');

    const req = mockReq('GET', '/api/browse', null, `?path=${encodeURIComponent(tmpDir)}`);
    const res = mockRes();
    await handleApi(req, res);

    const body = getJsonResponse(res);
    const proj = body.dirs.find(d => d.name === 'npm-project');
    expect(proj).toBeDefined();
    expect(proj.isProject).toBe(true);
  });

  it('returns 400 for invalid path', async () => {
    const fakePath = join(tmpDir, 'definitely-does-not-exist-xyz123');
    const req = mockReq('GET', '/api/browse', null, `?path=${encodeURIComponent(fakePath)}`);
    const res = mockRes();
    await handleApi(req, res);

    expect(res.writeHead).toHaveBeenCalledWith(400, expect.any(Object));
    expect(getJsonResponse(res).error).toMatch(/Cannot read/);
  });

  it('skips hidden directories and node_modules', async () => {
    await mkdir(join(tmpDir, '.hidden'));
    await mkdir(join(tmpDir, 'node_modules'));
    await mkdir(join(tmpDir, 'visible'));

    const req = mockReq('GET', '/api/browse', null, `?path=${encodeURIComponent(tmpDir)}`);
    const res = mockRes();
    await handleApi(req, res);

    const body = getJsonResponse(res);
    const names = body.dirs.map(d => d.name);
    expect(names).not.toContain('.hidden');
    expect(names).not.toContain('node_modules');
    expect(names).toContain('visible');
  });

  it('sorts projects before non-projects', async () => {
    // non-project
    await mkdir(join(tmpDir, 'aaa-plain'));
    // project (has .git)
    const projectDir = join(tmpDir, 'zzz-project');
    await mkdir(projectDir);
    await mkdir(join(projectDir, '.git'));

    const req = mockReq('GET', '/api/browse', null, `?path=${encodeURIComponent(tmpDir)}`);
    const res = mockRes();
    await handleApi(req, res);

    const body = getJsonResponse(res);
    // Filter to just our test dirs
    const testDirs = body.dirs.filter(d => d.name === 'aaa-plain' || d.name === 'zzz-project');
    expect(testDirs.length).toBe(2);
    // Project should come first even though it's alphabetically later
    expect(testDirs[0].name).toBe('zzz-project');
    expect(testDirs[0].isProject).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 26. Unmatched /api/ routes
// ---------------------------------------------------------------------------

describe('Unmatched /api/ routes', () => {
  it('returns 404 for unknown /api/ paths', async () => {
    const req = mockReq('GET', '/api/nonexistent-route');
    const res = mockRes();
    const result = await handleApi(req, res);

    expect(result).toBe(true);
    expect(res.writeHead).toHaveBeenCalledWith(404, expect.any(Object));
    expect(getJsonResponse(res).error).toBe('API route not found');
  });
});

// ---------------------------------------------------------------------------
// 27. Error handling
// ---------------------------------------------------------------------------

describe('Error handling', () => {
  it('returns 500 when a handler throws', async () => {
    // Point to a project path that will cause readFile to throw a non-ENOENT error
    // inside the skills route. We create a file where a directory is expected.
    // Instead, we can use the progress route with a directory that causes readdir to throw.
    // Simplest: make getActiveProject return a path where .devmanager/state.json
    // contains invalid content and use a route that reads JSON (but readJsonOrNull
    // handles ENOENT, not parse errors — parse errors will throw and be caught).
    const badDir = join(tmpDir, 'bad-project');
    await mkdir(join(badDir, '.devmanager'), { recursive: true });
    await writeFile(join(badDir, '.devmanager', 'state.json'), '{invalid json!!!}');
    mockGetActiveProject.mockReturnValue(badDir);

    const req = mockReq('GET', '/api/state');
    const res = mockRes();
    const result = await handleApi(req, res);

    expect(result).toBe(true);
    expect(res.writeHead).toHaveBeenCalledWith(500, expect.any(Object));
    expect(getJsonResponse(res).error).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Additional route tests: GET /api/git/status
// ---------------------------------------------------------------------------

describe('GET /api/git/status', () => {
  it('returns branch name and unpushed commits', async () => {
    // Restore getActiveProject for this test
    mockGetActiveProject.mockReturnValue(tmpDir);

    mockExecFile.mockImplementation((cmd, args, opts, cb) => {
      if (args.includes('--abbrev-ref')) {
        cb(null, 'main\n');
      } else if (args.includes('--oneline')) {
        cb(null, 'abc123 Fix bug\ndef456 Add feature\n');
      }
    });

    const req = mockReq('GET', '/api/git/status');
    const res = mockRes();
    await handleApi(req, res);

    expect(res.writeHead).toHaveBeenCalledWith(200, expect.any(Object));
    const body = getJsonResponse(res);
    expect(body.branch).toBe('main');
    expect(body.unpushed).toBe(2);
    expect(body.commits).toHaveLength(2);
    expect(body.commits[0].hash).toBe('abc123');
    expect(body.commits[0].message).toBe('Fix bug');
  });

  it('returns zero unpushed when no remote tracking branch', async () => {
    mockExecFile.mockImplementation((cmd, args, opts, cb) => {
      if (args.includes('--abbrev-ref')) {
        cb(null, 'feature-branch\n');
      } else if (args.includes('--oneline')) {
        cb(new Error('no upstream'));
      }
    });

    const req = mockReq('GET', '/api/git/status');
    const res = mockRes();
    await handleApi(req, res);

    const body = getJsonResponse(res);
    expect(body.branch).toBe('feature-branch');
    expect(body.unpushed).toBe(0);
    expect(body.commits).toEqual([]);
  });

  it('handles git not available gracefully', async () => {
    mockExecFile.mockImplementation((cmd, args, opts, cb) => {
      cb(new Error('git not found'));
    });

    const req = mockReq('GET', '/api/git/status');
    const res = mockRes();
    await handleApi(req, res);

    expect(res.writeHead).toHaveBeenCalledWith(200, expect.any(Object));
    const body = getJsonResponse(res);
    expect(body.branch).toBeNull();
    expect(body.unpushed).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// POST /api/git/push
// ---------------------------------------------------------------------------

describe('POST /api/git/push', () => {
  it('pushes to origin and returns output', async () => {
    mockExecFile.mockImplementation((cmd, args, opts, cb) => {
      cb(null, 'Everything up-to-date', '');
    });

    const req = mockReq('POST', '/api/git/push');
    const res = mockRes();
    await handleApi(req, res);

    expect(res.writeHead).toHaveBeenCalledWith(200, expect.any(Object));
    const body = getJsonResponse(res);
    expect(body.ok).toBe(true);
    expect(body.output).toBeTruthy();
  });

  it('returns 400 on push error', async () => {
    mockExecFile.mockImplementation((cmd, args, opts, cb) => {
      cb(new Error('rejected'), '', 'push rejected');
    });

    const req = mockReq('POST', '/api/git/push');
    const res = mockRes();
    await handleApi(req, res);

    expect(res.writeHead).toHaveBeenCalledWith(400, expect.any(Object));
    expect(getJsonResponse(res).error).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// POST /api/launch/terminal
// ---------------------------------------------------------------------------

describe('POST /api/launch/terminal', () => {
  it('launches terminal on win32 and returns ok', async () => {
    const { platform } = await import('node:os');
    platform.mockReturnValue('win32');

    const mockProc = { unref: vi.fn() };
    mockSpawn.mockReturnValue(mockProc);

    const req = mockReq('POST', '/api/launch/terminal', {
      taskId: 1,
      command: '/orchestrator task 1',
      engine: 'claude',
      title: 'Task 1',
    });
    const res = mockRes();
    await handleApi(req, res);

    expect(res.writeHead).toHaveBeenCalledWith(200, expect.any(Object));
    expect(getJsonResponse(res)).toEqual({ ok: true });
    expect(mockSpawn).toHaveBeenCalledWith('wt', expect.any(Array), expect.any(Object));
    expect(mockProc.unref).toHaveBeenCalled();
  });

  it('returns 400 when command is missing', async () => {
    const req = mockReq('POST', '/api/launch/terminal', { taskId: 1 });
    const res = mockRes();
    await handleApi(req, res);

    expect(res.writeHead).toHaveBeenCalledWith(400, expect.any(Object));
    expect(getJsonResponse(res).error).toBe('Missing command');
  });
});

// ---------------------------------------------------------------------------
// POST /api/split-tasks
// ---------------------------------------------------------------------------

describe('POST /api/split-tasks', () => {
  it('returns 400 when text is missing', async () => {
    const req = mockReq('POST', '/api/split-tasks', {});
    const res = mockRes();
    await handleApi(req, res);

    expect(res.writeHead).toHaveBeenCalledWith(400, expect.any(Object));
    expect(getJsonResponse(res).error).toBe('Missing text');
  });

  it('returns parsed tasks from claude output', async () => {
    const tasks = [{ name: 'Task 1', fullName: 'Full Task 1', description: 'Desc', group: 'Core' }];
    mockExecFile.mockImplementation((cmd, args, opts, cb) => {
      cb(null, JSON.stringify(tasks), '');
    });

    const req = mockReq('POST', '/api/split-tasks', { text: 'Build a login page' });
    const res = mockRes();
    await handleApi(req, res);

    expect(res.writeHead).toHaveBeenCalledWith(200, expect.any(Object));
    const body = getJsonResponse(res);
    expect(body.tasks).toEqual(tasks);
  });

  it('handles claude output wrapped in markdown fences', async () => {
    const tasks = [{ name: 'Task 1', fullName: 'Full', description: 'D', group: 'G' }];
    mockExecFile.mockImplementation((cmd, args, opts, cb) => {
      cb(null, '```json\n' + JSON.stringify(tasks) + '\n```', '');
    });

    const req = mockReq('POST', '/api/split-tasks', { text: 'Some notes' });
    const res = mockRes();
    await handleApi(req, res);

    expect(res.writeHead).toHaveBeenCalledWith(200, expect.any(Object));
    expect(getJsonResponse(res).tasks).toEqual(tasks);
  });

  it('returns 400 when claude returns unparseable output', async () => {
    mockExecFile.mockImplementation((cmd, args, opts, cb) => {
      cb(null, 'This is not JSON at all', '');
    });

    const req = mockReq('POST', '/api/split-tasks', { text: 'Some notes' });
    const res = mockRes();
    await handleApi(req, res);

    expect(res.writeHead).toHaveBeenCalledWith(400, expect.any(Object));
    expect(getJsonResponse(res).error).toMatch(/parse/i);
  });

  it('returns 500 when claude command fails', async () => {
    mockExecFile.mockImplementation((cmd, args, opts, cb) => {
      cb(new Error('claude not found'), '', 'command not found');
    });

    const req = mockReq('POST', '/api/split-tasks', { text: 'Some notes' });
    const res = mockRes();
    await handleApi(req, res);

    expect(res.writeHead).toHaveBeenCalledWith(500, expect.any(Object));
    expect(getJsonResponse(res).error).toBeTruthy();
  });
});
