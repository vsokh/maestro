import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
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
  onBatchUpdateTasks: vi.fn(),
  launchedId: null,
  projectPath: '',
  onSetPath: vi.fn(),
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

  describe('interactions', () => {
    it('clicking "Unqueue all" button calls onClear', () => {
      const props = defaultProps();
      const tasks = [makeTask(1)];
      const queue = [makeQueueItem(1)];
      render(<CommandQueue {...props} queue={queue} tasks={tasks} projectPath="/my/project" />);
      const unqueueBtn = screen.getByText('Unqueue all');
      fireEvent.click(unqueueBtn);
      expect(props.onClear).toHaveBeenCalledTimes(1);
    });

    it('clicking a "Launch task" button calls onLaunch', () => {
      const props = defaultProps();
      const tasks = [makeTask(1)];
      const queue = [makeQueueItem(1, 'My task')];
      render(<CommandQueue {...props} queue={queue} tasks={tasks} projectPath="/my/project" />);
      const launchBtn = screen.getByRole('button', { name: 'Launch task' });
      fireEvent.click(launchBtn);
      expect(props.onLaunch).toHaveBeenCalledTimes(1);
    });

    it('clicking remove button on a queue item calls onRemove', () => {
      const props = defaultProps();
      const tasks = [makeTask(1)];
      const queue = [makeQueueItem(1, 'My task')];
      render(<CommandQueue {...props} queue={queue} tasks={tasks} projectPath="/my/project" />);
      const removeBtn = screen.getByRole('button', { name: 'Remove from queue' });
      fireEvent.click(removeBtn);
      expect(props.onRemove).toHaveBeenCalledTimes(1);
    });

    it('clicking auto-approve toggle on a queue item calls onUpdateTask', () => {
      const props = defaultProps();
      const tasks = [makeTask(1, { autoApprove: false })];
      const queue = [makeQueueItem(1, 'My task')];
      render(<CommandQueue {...props} queue={queue} tasks={tasks} projectPath="/my/project" />);
      // The auto-approve button shows ✓ character
      const approveBtn = screen.getByTitle('Click to auto-approve');
      fireEvent.click(approveBtn);
      expect(props.onUpdateTask).toHaveBeenCalledWith(1, { autoApprove: true });
    });

    it('clicking "Auto-approve all" calls onBatchUpdateTasks for non-manual tasks', () => {
      const props = defaultProps();
      const tasks = [makeTask(1), makeTask(2)];
      const queue = [makeQueueItem(1, 'Task 1'), makeQueueItem(2, 'Task 2')];
      render(<CommandQueue {...props} queue={queue} tasks={tasks} projectPath="/my/project" />);
      // The button text is "✓ Auto-approve all" (QUEUE_APPROVE_ALL)
      const approveAllBtn = screen.getByText(/Auto-approve all/);
      fireEvent.click(approveAllBtn);
      expect(props.onBatchUpdateTasks).toHaveBeenCalledTimes(1);
      const updates = props.onBatchUpdateTasks.mock.calls[0][0];
      expect(updates.length).toBe(2);
      expect(updates[0]).toEqual({ id: 1, updates: { autoApprove: true } });
      expect(updates[1]).toEqual({ id: 2, updates: { autoApprove: true } });
    });

    it('clicking "Unqueue all" when auto-approved shows "Unapprove all"', () => {
      const props = defaultProps();
      const tasks = [makeTask(1, { autoApprove: true })];
      const queue = [makeQueueItem(1, 'Task 1')];
      render(<CommandQueue {...props} queue={queue} tasks={tasks} projectPath="/my/project" />);
      expect(screen.getByText('Unapprove all')).toBeDefined();
    });
  });
});
