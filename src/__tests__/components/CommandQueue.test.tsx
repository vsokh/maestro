import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { CommandQueue } from '../../components/CommandQueue.tsx';
import type { Task, QueueItem } from '../../types';

afterEach(cleanup);

function makeTask(id: number, overrides: Partial<Task> = {}): Task {
  return { id, name: `Task ${id}`, status: 'pending', ...overrides };
}

function makeQueueItem(id: number, name?: string): QueueItem {
  return { task: id, taskName: name || `Task ${id}` };
}

const defaultProps = () => ({
  queue: [] as QueueItem[],
  tasks: [] as Task[],
  onLaunch: vi.fn(),
  onLaunchPhase: vi.fn(),
  onRemove: vi.fn(),
  onClear: vi.fn(),
  onQueueAll: vi.fn(),
  onPauseTask: vi.fn(),
  onUpdateTask: vi.fn(),
  launchedId: null,
  projectPath: '',
  onSetPath: vi.fn(),
  onBatchUpdateTasks: vi.fn(),
});

describe('CommandQueue', () => {
  it('renders empty state message when queue is empty', () => {
    render(<CommandQueue {...defaultProps()} />);
    expect(screen.getByText(/Queue tasks from the detail panel/)).toBeDefined();
  });

  it('renders "Set project path to enable launch" when no projectPath', () => {
    render(<CommandQueue {...defaultProps()} />);
    expect(screen.getByText('Set project path to enable launch')).toBeDefined();
  });

  it('renders queue items with task names', () => {
    const tasks = [makeTask(1), makeTask(2)];
    const queue = [makeQueueItem(1, 'Login feature'), makeQueueItem(2, 'Signup flow')];
    render(<CommandQueue {...defaultProps()} queue={queue} tasks={tasks} projectPath="/my/project" />);
    expect(screen.getByText('Login feature')).toBeDefined();
    expect(screen.getByText('Signup flow')).toBeDefined();
  });

  it('renders "Unqueue all" button when queue has items', () => {
    const tasks = [makeTask(1)];
    const queue = [makeQueueItem(1)];
    render(<CommandQueue {...defaultProps()} queue={queue} tasks={tasks} projectPath="/my/project" />);
    expect(screen.getByText('Unqueue all')).toBeDefined();
  });

  it('renders project path when set', () => {
    render(<CommandQueue {...defaultProps()} projectPath="/home/user/project" />);
    expect(screen.getByText('/home/user/project')).toBeDefined();
  });

  it('shows "Launch task" buttons for non-manual tasks', () => {
    const tasks = [makeTask(1), makeTask(2)];
    const queue = [makeQueueItem(1), makeQueueItem(2)];
    render(<CommandQueue {...defaultProps()} queue={queue} tasks={tasks} projectPath="/my/project" />);
    const launchButtons = screen.getAllByRole('button', { name: 'Launch task' });
    expect(launchButtons.length).toBeGreaterThanOrEqual(2);
  });

  it('shows "YOU" badge for manual tasks', () => {
    const tasks = [makeTask(1, { manual: true })];
    const queue = [makeQueueItem(1, 'Manual work')];
    render(<CommandQueue {...defaultProps()} queue={queue} tasks={tasks} projectPath="/my/project" />);
    expect(screen.getByText('YOU')).toBeDefined();
  });
});
