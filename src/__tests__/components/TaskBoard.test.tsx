import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { TaskBoard } from '../../components/TaskBoard.tsx';
import { ActionProvider, type ActionContextValue } from '../../contexts/ActionContext.tsx';
import type { Task, QueueItem, Epic } from '../../types';

afterEach(cleanup);

function makeTask(id: number, overrides: Partial<Task> = {}): Task {
  return { id, name: `Task ${id}`, status: 'pending', ...overrides };
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
  handleLaunchTerminal: vi.fn(),
  handleArrange: vi.fn(),
  launchedIds: new Set<number>(),
  arranging: false,
  setArranging: vi.fn(),
  pauseTask: vi.fn(),
  cancelTask: vi.fn(),
  selectedTask: null,
  handleSelectTask: vi.fn(),
  handleNavigateToTask: vi.fn(),
  handleRetryFailed: vi.fn(),
  launchMode: 'background' as const,
  setLaunchMode: vi.fn(),
  glowTaskId: null,
  handleRemoveActivity: vi.fn(),
  defaultEngine: undefined,
});

function renderWithActions(ui: React.ReactElement, actionsOverride?: Partial<ActionContextValue>) {
  const actions = { ...mockActions(), ...actionsOverride };
  return { ...render(<ActionProvider value={actions}>{ui}</ActionProvider>), actions };
}

describe('TaskBoard', () => {
  it('renders empty state when tasks=[]', () => {
    renderWithActions(<TaskBoard tasks={[]} epics={[]} queue={[]} />);
    expect(screen.getByText('No tasks yet')).toBeDefined();
  });

  it('renders "Up next" label', () => {
    renderWithActions(<TaskBoard tasks={[]} epics={[]} queue={[]} />);
    expect(screen.getByText('Up next')).toBeDefined();
  });

  it('renders "+ Add task" button', () => {
    renderWithActions(<TaskBoard tasks={[]} epics={[]} queue={[]} />);
    expect(screen.getByText('+ Add task')).toBeDefined();
  });

  it('renders tasks grouped by epic with task names visible', () => {
    const tasks = [
      makeTask(1, { name: 'Auth login', group: 'Auth' }),
      makeTask(2, { name: 'Auth signup', group: 'Auth' }),
      makeTask(3, { name: 'Dashboard chart', group: 'Dashboard' }),
    ];
    const epics: Epic[] = [
      { name: 'Auth', color: 0 },
      { name: 'Dashboard', color: 1 },
    ];
    renderWithActions(<TaskBoard tasks={tasks} epics={epics} queue={[]} />);
    expect(screen.getByText('Auth login')).toBeDefined();
    expect(screen.getByText('Auth signup')).toBeDefined();
    expect(screen.getByText('Dashboard chart')).toBeDefined();
  });

  it('renders "Arrange tasks" button when tasks exist', () => {
    const tasks = [makeTask(1)];
    renderWithActions(<TaskBoard tasks={tasks} epics={[]} queue={[]} />);
    expect(screen.getByText('Arrange tasks')).toBeDefined();
  });

  it('renders "Queue all" button when there are unqueued pending tasks', () => {
    const tasks = [makeTask(1), makeTask(2)];
    renderWithActions(<TaskBoard tasks={tasks} epics={[]} queue={[]} />);
    expect(screen.getByText(/Queue all/)).toBeDefined();
  });

  it('does NOT show status filter when fewer than 2 pending tasks', () => {
    const tasks = [makeTask(1)];
    renderWithActions(<TaskBoard tasks={tasks} epics={[]} queue={[]} />);
    expect(screen.queryByPlaceholderText('Search tasks...')).toBeNull();
  });

  describe('interactions', () => {
    it('clicking "+ Add task" shows the CardForm', () => {
      renderWithActions(<TaskBoard tasks={[]} epics={[]} queue={[]} />);
      const addBtn = screen.getByText('+ Add task');
      fireEvent.click(addBtn);
      // CardForm renders a title input with placeholder "Task title..."
      expect(screen.getByPlaceholderText('Task title...')).toBeDefined();
    });

    it('clicking "Arrange tasks" button calls handleArrange', () => {
      const tasks = [makeTask(1)];
      const { actions } = renderWithActions(<TaskBoard tasks={tasks} epics={[]} queue={[]} />);
      const arrangeBtn = screen.getByText('Arrange tasks');
      fireEvent.click(arrangeBtn);
      expect(actions.handleArrange).toHaveBeenCalledTimes(1);
    });

    it('clicking "Queue all" button calls handleQueueAll', () => {
      const tasks = [makeTask(1), makeTask(2)];
      const { actions } = renderWithActions(<TaskBoard tasks={tasks} epics={[]} queue={[]} />);
      const queueAllBtn = screen.getByText(/Queue all/);
      fireEvent.click(queueAllBtn);
      expect(actions.handleQueueAll).toHaveBeenCalledTimes(1);
    });

    it('clicking a task card calls handleSelectTask with task id', () => {
      const tasks = [makeTask(1, { name: 'Login feature', group: 'Auth' })];
      const epics: Epic[] = [{ name: 'Auth', color: 0 }];
      const { actions } = renderWithActions(<TaskBoard tasks={tasks} epics={epics} queue={[]} />);
      const taskName = screen.getByText('Login feature');
      fireEvent.click(taskName);
      expect(actions.handleSelectTask).toHaveBeenCalledWith(1);
    });

    it('clicking empty board space deselects task', () => {
      const tasks = [makeTask(1, { name: 'Login feature', group: 'Auth' })];
      const epics: Epic[] = [{ name: 'Auth', color: 0 }];
      const { container, actions } = renderWithActions(
        <TaskBoard tasks={tasks} epics={epics} queue={[]} />,
        { selectedTask: 1 },
      );
      // Click the outer div (not a card, button, or input)
      fireEvent.click(container.firstChild!.firstChild!);
      expect(actions.handleSelectTask).toHaveBeenCalledWith(null);
    });

    it('search input filters tasks by name', () => {
      const tasks = [
        makeTask(1, { name: 'Login page' }),
        makeTask(2, { name: 'Signup form' }),
        makeTask(3, { name: 'Login API' }),
      ];
      renderWithActions(<TaskBoard tasks={tasks} epics={[]} queue={[]} />);
      const searchInput = screen.getByPlaceholderText('Search tasks...');
      fireEvent.input(searchInput, { target: { value: 'Login' } });
      expect(screen.getByText('Login page')).toBeDefined();
      expect(screen.getByText('Login API')).toBeDefined();
      expect(screen.queryByText('Signup form')).toBeNull();
    });

    it('status filter shows only matching tasks', () => {
      const tasks = [
        makeTask(1, { name: 'Task A', status: 'pending' }),
        makeTask(2, { name: 'Task B', status: 'blocked', blockedReason: 'Waiting' }),
        makeTask(3, { name: 'Task C', status: 'pending' }),
      ];
      renderWithActions(<TaskBoard tasks={tasks} epics={[]} queue={[]} />);
      const blockedFilter = screen.getByRole('button', { name: /^Blocked/ });
      fireEvent.click(blockedFilter);
      expect(screen.getByText('Task B')).toBeDefined();
    });

    it('status filter hides non-matching tasks', () => {
      const tasks = [
        makeTask(1, { name: 'Task A', status: 'pending' }),
        makeTask(2, { name: 'Task B', status: 'blocked', blockedReason: 'Waiting' }),
        makeTask(3, { name: 'Task C', status: 'pending' }),
      ];
      renderWithActions(<TaskBoard tasks={tasks} epics={[]} queue={[]} />);
      const blockedFilter = screen.getByRole('button', { name: /^Blocked/ });
      fireEvent.click(blockedFilter);
      expect(screen.queryByText('Task A')).toBeNull();
      expect(screen.queryByText('Task C')).toBeNull();
    });

    it('submitting add task form calls handleAddTask with task data', () => {
      const { actions } = renderWithActions(<TaskBoard tasks={[]} epics={[]} queue={[]} />);
      fireEvent.click(screen.getByText('+ Add task'));
      const titleInput = screen.getByPlaceholderText('Task title...');
      fireEvent.input(titleInput, { target: { value: 'New feature' } });
      fireEvent.click(screen.getByRole('button', { name: 'Add task' }));
      expect(actions.handleAddTask).toHaveBeenCalledTimes(1);
      expect((actions.handleAddTask as ReturnType<typeof vi.fn>).mock.calls[0][0].name).toBe('New feature');
    });

    it('add task form hides after submission', () => {
      renderWithActions(<TaskBoard tasks={[]} epics={[]} queue={[]} />);
      fireEvent.click(screen.getByText('+ Add task'));
      fireEvent.input(screen.getByPlaceholderText('Task title...'), { target: { value: 'New feature' } });
      fireEvent.click(screen.getByRole('button', { name: 'Add task' }));
      expect(screen.queryByPlaceholderText('Task title...')).toBeNull();
    });

    it('cancelling the add task form hides it', () => {
      renderWithActions(<TaskBoard tasks={[]} epics={[]} queue={[]} />);
      fireEvent.click(screen.getByText('+ Add task'));
      expect(screen.getByPlaceholderText('Task title...')).toBeDefined();
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
      expect(screen.queryByPlaceholderText('Task title...')).toBeNull();
    });
  });
});
