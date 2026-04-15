import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { TaskDetail } from '../../components/TaskDetail.tsx';
import { ActionProvider, type ActionContextValue } from '../../contexts/ActionContext.tsx';
import type { Task, Epic } from '../../types';

vi.mock('../../fs.ts', () => ({
  readAttachmentUrl: vi.fn().mockResolvedValue(null),
}));

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

describe('TaskDetail', () => {
  it('renders empty state when task is null', () => {
    renderWithActions(<TaskDetail task={null} tasks={[]} epics={[]} notes="" />);
    expect(screen.getByText('Click a task to see details')).toBeDefined();
  });

  it('renders task name when task is provided', () => {
    const task = makeTask(1, { name: 'Login page', fullName: 'Login page' });
    renderWithActions(<TaskDetail task={task} tasks={[]} epics={[]} notes="" />);
    expect(screen.getByText('Login page')).toBeDefined();
  });

  it('shows status dropdown with current status', () => {
    const task = makeTask(1, { status: 'pending' });
    renderWithActions(<TaskDetail task={task} tasks={[]} epics={[]} notes="" />);
    const select = screen.getByLabelText('Task status') as HTMLSelectElement;
    expect(select).toBeDefined();
    expect(select.value).toBe('pending');
  });

  it('shows "Queue" button for pending non-manual tasks', () => {
    const task = makeTask(1, { status: 'pending', manual: false });
    renderWithActions(<TaskDetail task={task} tasks={[]} epics={[]} notes="" />);
    const queueBtn = screen.getByRole('button', { name: /Queue/ });
    expect(queueBtn).toBeDefined();
  });

  it('shows "Mark done" button for pending manual tasks', () => {
    const task = makeTask(1, { status: 'pending', manual: true });
    renderWithActions(<TaskDetail task={task} tasks={[]} epics={[]} notes="" />);
    expect(screen.getByText(/Mark done/)).toBeDefined();
  });

  it('shows "Activate" button for backlog tasks', () => {
    const task = makeTask(1, { status: 'backlog' });
    renderWithActions(<TaskDetail task={task} tasks={[]} epics={[]} notes="" />);
    expect(screen.getByText(/Activate/)).toBeDefined();
  });

  it('shows blocked reason input when status is blocked', () => {
    const task = makeTask(1, { status: 'blocked' });
    renderWithActions(<TaskDetail task={task} tasks={[]} epics={[]} notes="" />);
    expect(screen.getByPlaceholderText('Why is this blocked?')).toBeDefined();
  });

  it('shows "Needs review" checkbox', () => {
    const task = makeTask(1);
    renderWithActions(<TaskDetail task={task} tasks={[]} epics={[]} notes="" />);
    expect(screen.getByText('Needs review')).toBeDefined();
  });

  it('shows "Auto-approve" checkbox', () => {
    const task = makeTask(1);
    renderWithActions(<TaskDetail task={task} tasks={[]} epics={[]} notes="" />);
    expect(screen.getByText('Auto-approve')).toBeDefined();
  });

  it('shows "Delete task" button', () => {
    const task = makeTask(1);
    renderWithActions(<TaskDetail task={task} tasks={[]} epics={[]} notes="" />);
    expect(screen.getByText('Delete task')).toBeDefined();
  });

  it('shows notes textarea', () => {
    const task = makeTask(1);
    renderWithActions(<TaskDetail task={task} tasks={[]} epics={[]} notes="Some notes" />);
    const textarea = screen.getByPlaceholderText('Instructions for Claude...');
    expect(textarea).toBeDefined();
  });

  describe('interactions', () => {
    it('changing status dropdown calls handleUpdateTask with new status', () => {
      const task = makeTask(1, { status: 'pending' });
      const { actions } = renderWithActions(<TaskDetail task={task} tasks={[]} epics={[]} notes="" />);
      const select = screen.getByLabelText('Task status');
      fireEvent.change(select, { target: { value: 'done' } });
      expect(actions.handleUpdateTask).toHaveBeenCalledWith(1, expect.objectContaining({ status: 'done' }));
    });

    it('clicking "Queue" button calls handleQueue with the task', () => {
      const task = makeTask(1, { status: 'pending', manual: false });
      const { actions } = renderWithActions(<TaskDetail task={task} tasks={[]} epics={[]} notes="" />);
      const queueBtn = screen.getByRole('button', { name: /Queue/ });
      fireEvent.click(queueBtn);
      expect(actions.handleQueue).toHaveBeenCalledWith(task);
    });

    it('first delete click shows confirmation prompt', () => {
      const task = makeTask(1);
      const { actions } = renderWithActions(<TaskDetail task={task} tasks={[]} epics={[]} notes="" />);
      const deleteBtn = screen.getByText('Delete task');
      fireEvent.click(deleteBtn);
      expect(screen.getByText('Confirm delete?')).toBeDefined();
      expect(actions.handleDeleteTask).not.toHaveBeenCalled();
    });

    it('confirming delete calls handleDeleteTask', () => {
      const task = makeTask(1);
      const { actions } = renderWithActions(<TaskDetail task={task} tasks={[]} epics={[]} notes="" />);
      fireEvent.click(screen.getByText('Delete task'));
      fireEvent.click(screen.getByText('Confirm delete?'));
      expect(actions.handleDeleteTask).toHaveBeenCalledWith(1);
    });

    it('toggling "Needs review" checkbox calls handleUpdateTask with supervision field', () => {
      const task = makeTask(1, { supervision: false });
      const { actions } = renderWithActions(<TaskDetail task={task} tasks={[]} epics={[]} notes="" />);
      const checkboxes = screen.getAllByRole('checkbox');
      // "Needs review" is the first checkbox
      const needsReviewCheckbox = checkboxes[0];
      fireEvent.click(needsReviewCheckbox);
      expect(actions.handleUpdateTask).toHaveBeenCalledWith(1, expect.objectContaining({ supervision: true }));
    });

    it('toggling "Auto-approve" checkbox calls handleUpdateTask with autoApprove field', () => {
      const task = makeTask(1, { autoApprove: false });
      const { actions } = renderWithActions(<TaskDetail task={task} tasks={[]} epics={[]} notes="" />);
      const checkboxes = screen.getAllByRole('checkbox');
      // "Auto-approve" is the second checkbox
      const autoApproveCheckbox = checkboxes[1];
      fireEvent.click(autoApproveCheckbox);
      expect(actions.handleUpdateTask).toHaveBeenCalledWith(1, expect.objectContaining({ autoApprove: true }));
    });

    it('notes textarea blur calls handleUpdateNotes', () => {
      const task = makeTask(1);
      const { actions } = renderWithActions(<TaskDetail task={task} tasks={[]} epics={[]} notes="" />);
      const textarea = screen.getByPlaceholderText('Instructions for Claude...');
      fireEvent.input(textarea, { target: { value: 'New notes content' } });
      fireEvent.blur(textarea);
      expect(actions.handleUpdateNotes).toHaveBeenCalledWith(1, 'New notes content');
    });

    it('clicking task name enters edit mode (shows input)', () => {
      const task = makeTask(1, { name: 'My Task', fullName: 'My Task' });
      renderWithActions(<TaskDetail task={task} tasks={[]} epics={[]} notes="" />);
      const taskName = screen.getByText('My Task');
      fireEvent.click(taskName);
      // After clicking, an input should appear with the task name value
      const editInput = screen.getByDisplayValue('My Task');
      expect(editInput).toBeDefined();
      expect(editInput.tagName).toBe('INPUT');
    });

    it('clicking "Mark done" on manual task calls handleUpdateTask with status done', () => {
      const task = makeTask(1, { status: 'pending', manual: true });
      const { actions } = renderWithActions(<TaskDetail task={task} tasks={[]} epics={[]} notes="" />);
      const markDoneBtn = screen.getByText(/Mark done/);
      fireEvent.click(markDoneBtn);
      expect(actions.handleUpdateTask).toHaveBeenCalledWith(1, expect.objectContaining({ status: 'done' }));
    });

    it('clicking "Activate" on backlog task calls handleUpdateTask with status pending', () => {
      const task = makeTask(1, { status: 'backlog' });
      const { actions } = renderWithActions(<TaskDetail task={task} tasks={[]} epics={[]} notes="" />);
      const activateBtn = screen.getByText(/Activate/);
      fireEvent.click(activateBtn);
      expect(actions.handleUpdateTask).toHaveBeenCalledWith(1, expect.objectContaining({ status: 'pending' }));
    });

    it('clicking "Backlog" button on pending task calls handleUpdateTask with status backlog', () => {
      const task = makeTask(1, { status: 'pending', manual: true });
      const { actions } = renderWithActions(<TaskDetail task={task} tasks={[]} epics={[]} notes="" />);
      const backlogBtn = screen.getByText('Backlog');
      fireEvent.click(backlogBtn);
      expect(actions.handleUpdateTask).toHaveBeenCalledWith(1, expect.objectContaining({ status: 'backlog' }));
    });

    it('blocked reason input blur saves the reason via handleUpdateTask', () => {
      const task = makeTask(1, { status: 'blocked' });
      const { actions } = renderWithActions(<TaskDetail task={task} tasks={[]} epics={[]} notes="" />);
      const blockedInput = screen.getByPlaceholderText('Why is this blocked?');
      fireEvent.input(blockedInput, { target: { value: 'Waiting for API' } });
      fireEvent.blur(blockedInput);
      expect(actions.handleUpdateTask).toHaveBeenCalledWith(1, expect.objectContaining({ blockedReason: 'Waiting for API' }));
    });

    it('name edit: pressing Enter saves and exits edit mode', () => {
      const task = makeTask(1, { name: 'Old Name', fullName: 'Old Name' });
      const { actions } = renderWithActions(<TaskDetail task={task} tasks={[]} epics={[]} notes="" />);
      fireEvent.click(screen.getByText('Old Name'));
      const editInput = screen.getByDisplayValue('Old Name');
      fireEvent.input(editInput, { target: { value: 'New Name' } });
      fireEvent.keyDown(editInput, { key: 'Enter' });
      expect(actions.handleUpdateTask).toHaveBeenCalledWith(1, expect.objectContaining({ fullName: 'New Name' }));
    });

    it('name edit: pressing Escape cancels without saving', () => {
      const task = makeTask(1, { name: 'Original', fullName: 'Original' });
      renderWithActions(<TaskDetail task={task} tasks={[]} epics={[]} notes="" />);
      fireEvent.click(screen.getByText('Original'));
      const editInput = screen.getByDisplayValue('Original');
      fireEvent.input(editInput, { target: { value: 'Changed' } });
      fireEvent.keyDown(editInput, { key: 'Escape' });
      // Should exit edit mode without calling handleUpdateTask
      // The h3 with 'Original' should be back
      expect(screen.getByText('Original')).toBeDefined();
    });

    it('delete button resets to non-confirm state on blur', () => {
      const task = makeTask(1);
      renderWithActions(<TaskDetail task={task} tasks={[]} epics={[]} notes="" />);
      const deleteBtn = screen.getByText('Delete task');
      fireEvent.click(deleteBtn);
      expect(screen.getByText('Confirm delete?')).toBeDefined();
      fireEvent.blur(screen.getByText('Confirm delete?'));
      expect(screen.getByText('Delete task')).toBeDefined();
    });

    it('changing from blocked to another status clears blocked reason', () => {
      const task = makeTask(1, { status: 'blocked', blockedReason: 'Some issue' });
      const { actions } = renderWithActions(<TaskDetail task={task} tasks={[]} epics={[]} notes="" />);
      const select = screen.getByLabelText('Task status');
      fireEvent.change(select, { target: { value: 'pending' } });
      expect(actions.handleUpdateTask).toHaveBeenCalledWith(1, expect.objectContaining({
        status: 'pending',
        blockedReason: ''
      }));
    });
  });
});
