// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'node:events';
import { writeFile, mkdtemp, rm, mkdir, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { handleSkills } from '../../routes/skills.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mockRes() {
  return { writeHead: vi.fn(), end: vi.fn() };
}

function mockReq(chunks = []) {
  const emitter = new EventEmitter();
  process.nextTick(() => {
    for (const chunk of chunks) emitter.emit('data', Buffer.from(chunk));
    emitter.emit('end');
  });
  return emitter;
}

function mockUrl(path) {
  return new URL(path, 'http://localhost');
}

function mockCtx(projectPath) {
  return {
    projectPath,
    getProjects: vi.fn(() => []),
    switchProject: vi.fn(),
  };
}

let tmpDir;

beforeEach(async () => {
  tmpDir = await mkdtemp(join(tmpdir(), 'skills-test-'));
});

afterEach(async () => {
  if (tmpDir) await rm(tmpDir, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('handleSkills', () => {
  it('returns false for non-matching routes', async () => {
    const res = mockRes();
    const result = await handleSkills('GET', '/api/state', mockReq(), res, mockUrl('/api/state'), mockCtx(tmpDir));
    expect(result).toBe(false);
    expect(res.writeHead).not.toHaveBeenCalled();
  });

  describe('GET /api/skills', () => {
    it('returns empty list when no skills or agents exist', async () => {
      const res = mockRes();
      const result = await handleSkills('GET', '/api/skills', mockReq(), res, mockUrl('/api/skills'), mockCtx(tmpDir));
      expect(result).toBe(true);
      const body = JSON.parse(res.end.mock.calls[0][0]);
      expect(body).toEqual([]);
    });

    it('discovers skills from .claude/skills/', async () => {
      const skillDir = join(tmpDir, '.claude', 'skills', 'my-skill');
      await mkdir(skillDir, { recursive: true });
      await writeFile(join(skillDir, 'SKILL.md'), '---\ndescription: "A test skill"\n---\n# My Skill');

      const res = mockRes();
      await handleSkills('GET', '/api/skills', mockReq(), res, mockUrl('/api/skills'), mockCtx(tmpDir));
      const body = JSON.parse(res.end.mock.calls[0][0]);
      expect(body.length).toBe(1);
      expect(body[0].name).toBe('my-skill');
      expect(body[0].type).toBe('skill');
      expect(body[0].description).toBe('A test skill');
    });

    it('skips the orchestrator skill directory', async () => {
      const orchDir = join(tmpDir, '.claude', 'skills', 'orchestrator');
      await mkdir(orchDir, { recursive: true });
      await writeFile(join(orchDir, 'SKILL.md'), '---\ndescription: "Orchestrator"\n---');

      const res = mockRes();
      await handleSkills('GET', '/api/skills', mockReq(), res, mockUrl('/api/skills'), mockCtx(tmpDir));
      const body = JSON.parse(res.end.mock.calls[0][0]);
      expect(body).toEqual([]);
    });

    it('discovers agents from .claude/agents/', async () => {
      const agentsDir = join(tmpDir, '.claude', 'agents');
      await mkdir(agentsDir, { recursive: true });
      await writeFile(join(agentsDir, 'my-agent.md'), '---\ndescription: "Test agent"\n---');

      const res = mockRes();
      await handleSkills('GET', '/api/skills', mockReq(), res, mockUrl('/api/skills'), mockCtx(tmpDir));
      const body = JSON.parse(res.end.mock.calls[0][0]);
      expect(body.length).toBe(1);
      expect(body[0].name).toBe('my-agent');
      expect(body[0].type).toBe('agent');
    });
  });

  describe('POST /api/skills/deploy', () => {
    it('deploys a skill and writes hash file', async () => {
      const res = mockRes();
      const body = { skillName: 'test-skill', filename: 'SKILL.md', content: '# Hello' };
      const req = mockReq([JSON.stringify(body)]);
      const result = await handleSkills('POST', '/api/skills/deploy', req, res, mockUrl('/api/skills/deploy'), mockCtx(tmpDir));
      expect(result).toBe(true);
      const respBody = JSON.parse(res.end.mock.calls[0][0]);
      expect(respBody.ok).toBe(true);
      expect(respBody.deployed).toBe(true);

      // Verify files were written
      const written = await readFile(join(tmpDir, '.claude', 'skills', 'test-skill', 'SKILL.md'), 'utf-8');
      expect(written).toBe('# Hello');
    });

    it('skips deploy when content hash matches', async () => {
      const skillDir = join(tmpDir, '.claude', 'skills', 'test-skill');
      await mkdir(skillDir, { recursive: true });
      const content = '# Hello';
      // Compute the same hash the code uses
      let hash = 0;
      for (let i = 0; i < content.length; i++) {
        hash = ((hash << 5) - hash) + content.charCodeAt(i);
        hash |= 0;
      }
      await writeFile(join(skillDir, '.hash'), hash.toString(36), 'utf-8');
      await writeFile(join(skillDir, 'SKILL.md'), content, 'utf-8');

      const res = mockRes();
      const req = mockReq([JSON.stringify({ skillName: 'test-skill', filename: 'SKILL.md', content })]);
      await handleSkills('POST', '/api/skills/deploy', req, res, mockUrl('/api/skills/deploy'), mockCtx(tmpDir));
      const respBody = JSON.parse(res.end.mock.calls[0][0]);
      expect(respBody.deployed).toBe(false);
    });

    it('returns 400 when required fields are missing', async () => {
      const res = mockRes();
      const req = mockReq([JSON.stringify({ skillName: 'test' })]);
      await handleSkills('POST', '/api/skills/deploy', req, res, mockUrl('/api/skills/deploy'), mockCtx(tmpDir));
      expect(res.writeHead).toHaveBeenCalledWith(400, expect.any(Object));
    });

    it('rejects path traversal in skillName', async () => {
      const res = mockRes();
      // Need enough ../ to escape projectPath: .claude/skills/../../../../x
      const body = { skillName: '../../../../etc', filename: 'SKILL.md', content: 'bad' };
      const req = mockReq([JSON.stringify(body)]);
      await handleSkills('POST', '/api/skills/deploy', req, res, mockUrl('/api/skills/deploy'), mockCtx(tmpDir));
      expect(res.writeHead).toHaveBeenCalledWith(400, expect.any(Object));
      const respBody = JSON.parse(res.end.mock.calls[0][0]);
      expect(respBody.error).toBe('Invalid skill name');
    });

    it('rejects path traversal in filename', async () => {
      const res = mockRes();
      const body = { skillName: 'legit-skill', filename: '../../etc/passwd', content: 'bad' };
      const req = mockReq([JSON.stringify(body)]);
      await handleSkills('POST', '/api/skills/deploy', req, res, mockUrl('/api/skills/deploy'), mockCtx(tmpDir));
      expect(res.writeHead).toHaveBeenCalledWith(400, expect.any(Object));
      const respBody = JSON.parse(res.end.mock.calls[0][0]);
      expect(respBody.error).toBe('Invalid filename');
    });
  });

  describe('POST /api/agents/deploy', () => {
    it('deploys an agent', async () => {
      const res = mockRes();
      const body = { agentName: 'test-agent', filename: 'SKILL.md', content: '# Agent' };
      const req = mockReq([JSON.stringify(body)]);
      const result = await handleSkills('POST', '/api/agents/deploy', req, res, mockUrl('/api/agents/deploy'), mockCtx(tmpDir));
      expect(result).toBe(true);
      const respBody = JSON.parse(res.end.mock.calls[0][0]);
      expect(respBody.ok).toBe(true);
      expect(respBody.deployed).toBe(true);
    });

    it('returns 400 when required fields are missing', async () => {
      const res = mockRes();
      const req = mockReq([JSON.stringify({ agentName: 'test' })]);
      await handleSkills('POST', '/api/agents/deploy', req, res, mockUrl('/api/agents/deploy'), mockCtx(tmpDir));
      expect(res.writeHead).toHaveBeenCalledWith(400, expect.any(Object));
    });

    it('rejects path traversal in agentName', async () => {
      const res = mockRes();
      // Need enough ../ to escape projectPath: .claude/agents/<name>/../../../../x
      const body = { agentName: '../../../../etc', filename: 'SKILL.md', content: 'bad' };
      const req = mockReq([JSON.stringify(body)]);
      await handleSkills('POST', '/api/agents/deploy', req, res, mockUrl('/api/agents/deploy'), mockCtx(tmpDir));
      expect(res.writeHead).toHaveBeenCalledWith(400, expect.any(Object));
      const respBody = JSON.parse(res.end.mock.calls[0][0]);
      expect(respBody.error).toBe('Invalid agent name');
    });

    it('rejects path traversal in agent filename', async () => {
      const res = mockRes();
      const body = { agentName: 'legit-agent', filename: '../../etc/passwd', content: 'bad' };
      const req = mockReq([JSON.stringify(body)]);
      await handleSkills('POST', '/api/agents/deploy', req, res, mockUrl('/api/agents/deploy'), mockCtx(tmpDir));
      expect(res.writeHead).toHaveBeenCalledWith(400, expect.any(Object));
      const respBody = JSON.parse(res.end.mock.calls[0][0]);
      expect(respBody.error).toBe('Invalid filename');
    });
  });

  describe('GET /api/skills-config', () => {
    it('returns skills config when it exists', async () => {
      const devDir = join(tmpDir, '.maestro');
      await mkdir(devDir, { recursive: true });
      const config = { skills: ['a', 'b'] };
      await writeFile(join(devDir, 'skills.json'), JSON.stringify(config));

      const res = mockRes();
      const result = await handleSkills('GET', '/api/skills-config', mockReq(), res, mockUrl('/api/skills-config'), mockCtx(tmpDir));
      expect(result).toBe(true);
      const body = JSON.parse(res.end.mock.calls[0][0]);
      expect(body).toEqual(config);
    });

    it('returns empty object when config does not exist', async () => {
      const res = mockRes();
      await handleSkills('GET', '/api/skills-config', mockReq(), res, mockUrl('/api/skills-config'), mockCtx(tmpDir));
      expect(res.writeHead).toHaveBeenCalledWith(200, expect.any(Object));
      const body = JSON.parse(res.end.mock.calls[0][0]);
      expect(body).toEqual({});
    });
  });

  describe('PUT /api/skills-config', () => {
    it('writes skills config', async () => {
      const res = mockRes();
      const config = { skills: ['x'] };
      const req = mockReq([JSON.stringify(config)]);
      const result = await handleSkills('PUT', '/api/skills-config', req, res, mockUrl('/api/skills-config'), mockCtx(tmpDir));
      expect(result).toBe(true);
      const body = JSON.parse(res.end.mock.calls[0][0]);
      expect(body.ok).toBe(true);

      // Verify file
      const written = JSON.parse(await readFile(join(tmpDir, '.maestro', 'skills.json'), 'utf-8'));
      expect(written).toEqual(config);
    });
  });
});
