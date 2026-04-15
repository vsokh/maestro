import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { CommandQueue } from '../../components/CommandQueue.tsx';
import { ActionProvider, type ActionContextValue } from '../../contexts/ActionContext.tsx';
import type { Task, QueueItem } from '../../types';

afterEach(cleanup);

function makeTask(id: number, overrides: Partial<Task> = {}): Task {
  return { id, name: `Task ${id}`, status: 'pending', ...overrides };
}

function makeQueueItem(id: number, name?: string): QueueItem {
  return { task: id, taskName: name || `Task ${id}` };
}

const mockActions = (): ActionContextValue => ({
  handleUpdateTask: vi.fn(),
  handleBatchUpdateTasks: vi.fn(),
  handleUpdateNotes: vi.fn(),
  handleAddTask: vi.fn(),
  handleRenameGroup: vi.fn(),
  handleDeleteGroup: vi.fn(),
  handleUpdateEpics: vi.fn(),
  handleDeleteTask: vi.fn(),
  handleAddAttachment: vi.fn(),
  handleDeleteAttachment: vi.fn(),
  handleQueue: vi.fn(),
  handleQueueAll: vi.fn(),
  handleQueueGroup: vi.fn(),
  handleRemoveFromQueue: vi.fn(),
  handleClearQueue: vi.fn(),
  handleLaunchTask: vi.fn(),
  handleLaunchPhase: vi.fn(),
  handleRetryFailed: vi.fn(),
  handleLaunchTerminal: vi.fn(),
  handleArrange: vi.fn(),
  handleLaunchPipeline: vi.fn(),
  cancelPipeline: vi.fn(),
  launchedIds: new Set<number>(),
  launchMode: 'background' as const,
  setLaunchMode: vi.fn(),
  arranging: false,
  setArranging: vi.fn(),
  pipelineRunning: false,
  pipelinePhase: -1,
  pauseTask: vi.fn(),
  cancelTask: vi.fn(),
  selectedTask: null,
  handleSelectTask: vi.fn(),
  handleNavigateToTask: vi.fn(),
  glowTaskId: null,
  selectMode: false,
  selectedTasks: new Set<number>(),
  onToggleSelectMode: vi.fn(),
  onToggleTaskSelection: vi.fn(),
  onBulkDelete: vi.fn(),
  onBulkStatusChange: vi.fn(),
  onExitSelectMode: vi.fn(),
  handleRemoveActivity: vi.fn(),
  defaultEngine: undefined,
});

function renderWithActions(ui: React.ReactElement, actionsOverride?: Partial<ActionContextValue>) {
  const actions = { ...mockActions(), ...actionsOverride };
  return { ...render(<ActionProvider value={actions}>{ui}</ActionProvider>), actions };
}

describe('CommandQueue', () => {
  it('renders empty state message when queue is empty', () => {
    renderWithActions(<CommandQueue queue={[]} tasks={[]} />);
    expect(screen.getByText(/Queue tasks from the detail panel/)).toBeDefined();
  });

  it('renders queue items with task names', () => {
    const tasks = [makeTask(1), makeTask(2)];
    const queue = [makeQueueItem(1, 'Login feature'), makeQueueItem(2, 'Signup flow')];
    renderWithActions(<CommandQueue queue={queue} tasks={tasks} />);
    expect(screen.getByText('Login feature')).toBeDefined();
    expect(screen.getByText('Signup flow')).toBeDefined();
  });

  it('renders "Unqueue all" button when queue has items', () => {
    const tasks = [makeTask(1)];
    const queue = [makeQueueItem(1)];
    renderWithActions(<CommandQueue queue={queue} tasks={tasks} />);
    expect(screen.getByText('Unqueue all')).toBeDefined();
  });

  it('shows "Launch task" buttons for non-manual tasks', () => {
    const tasks = [makeTask(1), makeTask(2)];
    const queue = [makeQueueItem(1), makeQueueItem(2)];
    renderWithActions(<CommandQueue queue={queue} tasks={tasks} />);
    const launchButtons = screen.getAllByRole('button', { name: 'Launch task' });
    expect(launchButtons.length).toBeGreaterThanOrEqual(2);
  });

  it('shows "YOU" badge for manual tasks', () => {
    const tasks = [makeTask(1, { manual: true })];
    const queue = [makeQueueItem(1, 'Manual work')];
    renderWithActions(<CommandQueue queue={queue} tasks={tasks} />);
    expect(screen.getByText('YOU')).toBeDefined();
  });

  describe('interactions', () => {
    it('clicking "Unqueue all" button calls handleClearQueue', () => {
      const tasks = [makeTask(1)];
      const queue = [makeQueueItem(1)];
      const { actions } = renderWithActions(<CommandQueue queue={queue} tasks={tasks} />);
      const unqueueBtn = screen.getByText('Unqueue all');
      fireEvent.click(unqueueBtn);
      expect(actions.handleClearQueue).toHaveBeenCalledTimes(1);
    });

    it('clicking a "Launch task" button calls handleLaunchTask', () => {
      const tasks = [makeTask(1)];
      const queue = [makeQueueItem(1, 'My task')];
      const { actions } = renderWithActions(<CommandQueue queue={queue} tasks={tasks} />);
      const launchBtn = screen.getByRole('button', { name: 'Launch task' });
      fireEvent.click(launchBtn);
      expect(actions.handleLaunchTask).toHaveBeenCalledTimes(1);
    });

    it('clicking remove button on a queue item calls handleRemoveFromQueue', () => {
      const tasks = [makeTask(1)];
      const queue = [makeQueueItem(1, 'My task')];
      const { actions } = renderWithActions(<CommandQueue queue={queue} tasks={tasks} />);
      const removeBtn = screen.getByRole('button', { name: 'Remove from queue' });
      fireEvent.click(removeBtn);
      expect(actions.handleRemoveFromQueue).toHaveBeenCalledTimes(1);
    });

    it('clicking auto-approve toggle on a queue item calls handleUpdateTask', () => {
      const tasks = [makeTask(1, { autoApprove: false })];
      const queue = [makeQueueItem(1, 'My task')];
      const { actions } = renderWithActions(<CommandQueue queue={queue} tasks={tasks} />);
      const approveBtn = screen.getByTitle('Click to auto-approve');
      fireEvent.click(approveBtn);
      expect(actions.handleUpdateTask).toHaveBeenCalledWith(1, { autoApprove: true });
    });

    it('clicking "Auto-approve all" calls handleBatchUpdateTasks for non-manual tasks', () => {
      const tasks = [makeTask(1), makeTask(2)];
      const queue = [makeQueueItem(1, 'Task 1'), makeQueueItem(2, 'Task 2')];
      const { actions } = renderWithActions(<CommandQueue queue={queue} tasks={tasks} />);
      const approveAllBtn = screen.getByText(/Auto-approve all/);
      fireEvent.click(approveAllBtn);
      expect(actions.handleBatchUpdateTasks).toHaveBeenCalledTimes(1);
      const updates = (actions.handleBatchUpdateTasks as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(updates.length).toBe(2);
      expect(updates[0]).toEqual({ id: 1, updates: { autoApprove: true } });
      expect(updates[1]).toEqual({ id: 2, updates: { autoApprove: true } });
    });

    it('clicking "Unqueue all" when auto-approved shows "Unapprove all"', () => {
      const tasks = [makeTask(1, { autoApprove: true })];
      const queue = [makeQueueItem(1, 'Task 1')];
      renderWithActions(<CommandQueue queue={queue} tasks={tasks} />);
      expect(screen.getByText('Unapprove all')).toBeDefined();
    });
  });
});
