import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { TaskDetail } from '../../components/TaskDetail.tsx';
import type { Task, Epic } from '../../types';

vi.mock('../../fs.ts', () => ({
  readAttachmentUrl: vi.fn().mockResolvedValue(null),
}));

afterEach(cleanup);

function makeTask(id: number, overrides: Partial<Task> = {}): Task {
  return { id, name: `Task ${id}`, status: 'pending', ...overrides };
}

const defaultProps = () => ({
  task: null as Task | null,
  tasks: [] as Task[],
  epics: [] as Epic[],
  onQueue: vi.fn(),
  onUpdateTask: vi.fn(),
  onDeleteTask: vi.fn(),
  notes: '',
  onUpdateNotes: vi.fn(),
  dirHandle: null,
  onAddAttachment: vi.fn(),
  onDeleteAttachment: vi.fn(),
});

describe('TaskDetail', () => {
  it('renders empty state when task is null', () => {
    render(<TaskDetail {...defaultProps()} />);
    expect(screen.getByText('Click a task to see details')).toBeDefined();
  });

  it('renders task name when task is provided', () => {
    const task = makeTask(1, { name: 'Login page', fullName: 'Login page' });
    render(<TaskDetail {...defaultProps()} task={task} />);
    expect(screen.getByText('Login page')).toBeDefined();
  });

  it('shows status dropdown with current status', () => {
    const task = makeTask(1, { status: 'pending' });
    render(<TaskDetail {...defaultProps()} task={task} />);
    const select = screen.getByLabelText('Task status') as HTMLSelectElement;
    expect(select).toBeDefined();
    expect(select.value).toBe('pending');
  });

  it('shows "Queue" button for pending non-manual tasks', () => {
    const task = makeTask(1, { status: 'pending', manual: false });
    render(<TaskDetail {...defaultProps()} task={task} />);
    const queueBtn = screen.getByRole('button', { name: /Queue/ });
    expect(queueBtn).toBeDefined();
  });

  it('shows "Mark done" button for pending manual tasks', () => {
    const task = makeTask(1, { status: 'pending', manual: true });
    render(<TaskDetail {...defaultProps()} task={task} />);
    expect(screen.getByText(/Mark done/)).toBeDefined();
  });

  it('shows "Activate" button for backlog tasks', () => {
    const task = makeTask(1, { status: 'backlog' });
    render(<TaskDetail {...defaultProps()} task={task} />);
    expect(screen.getByText(/Activate/)).toBeDefined();
  });

  it('shows blocked reason input when status is blocked', () => {
    const task = makeTask(1, { status: 'blocked' });
    render(<TaskDetail {...defaultProps()} task={task} />);
    expect(screen.getByPlaceholderText('Why is this blocked?')).toBeDefined();
  });

  it('shows "Needs review" checkbox', () => {
    const task = makeTask(1);
    render(<TaskDetail {...defaultProps()} task={task} />);
    expect(screen.getByText('Needs review')).toBeDefined();
  });

  it('shows "Auto-approve" checkbox', () => {
    const task = makeTask(1);
    render(<TaskDetail {...defaultProps()} task={task} />);
    expect(screen.getByText('Auto-approve')).toBeDefined();
  });

  it('shows "Delete task" button', () => {
    const task = makeTask(1);
    render(<TaskDetail {...defaultProps()} task={task} />);
    expect(screen.getByText('Delete task')).toBeDefined();
  });

  it('shows notes textarea', () => {
    const task = makeTask(1);
    render(<TaskDetail {...defaultProps()} task={task} notes="Some notes" />);
    const textarea = screen.getByPlaceholderText('Instructions for Claude...');
    expect(textarea).toBeDefined();
  });

  describe('interactions', () => {
    it('changing status dropdown calls onUpdateTask with new status', () => {
      const props = defaultProps();
      const task = makeTask(1, { status: 'pending' });
      render(<TaskDetail {...props} task={task} />);
      const select = screen.getByLabelText('Task status');
      fireEvent.change(select, { target: { value: 'done' } });
      expect(props.onUpdateTask).toHaveBeenCalledWith(1, expect.objectContaining({ status: 'done' }));
    });

    it('clicking "Queue" button calls onQueue with the task', () => {
      const props = defaultProps();
      const task = makeTask(1, { status: 'pending', manual: false });
      render(<TaskDetail {...props} task={task} />);
      const queueBtn = screen.getByRole('button', { name: /Queue/ });
      fireEvent.click(queueBtn);
      expect(props.onQueue).toHaveBeenCalledWith(task);
    });

    it('two-click delete: first click shows "Confirm delete?", second click calls onDeleteTask', () => {
      const props = defaultProps();
      const task = makeTask(1);
      render(<TaskDetail {...props} task={task} />);
      const deleteBtn = screen.getByText('Delete task');
      fireEvent.click(deleteBtn);
      expect(screen.getByText('Confirm delete?')).toBeDefined();
      expect(props.onDeleteTask).not.toHaveBeenCalled();
      const confirmBtn = screen.getByText('Confirm delete?');
      fireEvent.click(confirmBtn);
      expect(props.onDeleteTask).toHaveBeenCalledWith(1);
    });

    it('toggling "Needs review" checkbox calls onUpdateTask with supervision field', () => {
      const props = defaultProps();
      const task = makeTask(1, { supervision: false });
      render(<TaskDetail {...props} task={task} />);
      const checkboxes = screen.getAllByRole('checkbox');
      // "Needs review" is the first checkbox
      const needsReviewCheckbox = checkboxes[0];
      fireEvent.click(needsReviewCheckbox);
      expect(props.onUpdateTask).toHaveBeenCalledWith(1, expect.objectContaining({ supervision: true }));
    });

    it('toggling "Auto-approve" checkbox calls onUpdateTask with autoApprove field', () => {
      const props = defaultProps();
      const task = makeTask(1, { autoApprove: false });
      render(<TaskDetail {...props} task={task} />);
      const checkboxes = screen.getAllByRole('checkbox');
      // "Auto-approve" is the second checkbox
      const autoApproveCheckbox = checkboxes[1];
      fireEvent.click(autoApproveCheckbox);
      expect(props.onUpdateTask).toHaveBeenCalledWith(1, expect.objectContaining({ autoApprove: true }));
    });

    it('notes textarea blur calls onUpdateNotes', () => {
      const props = defaultProps();
      const task = makeTask(1);
      render(<TaskDetail {...props} task={task} notes="" />);
      const textarea = screen.getByPlaceholderText('Instructions for Claude...');
      fireEvent.input(textarea, { target: { value: 'New notes content' } });
      fireEvent.blur(textarea);
      expect(props.onUpdateNotes).toHaveBeenCalledWith(1, 'New notes content');
    });

    it('clicking task name enters edit mode (shows input)', () => {
      const props = defaultProps();
      const task = makeTask(1, { name: 'My Task', fullName: 'My Task' });
      render(<TaskDetail {...props} task={task} />);
      const taskName = screen.getByText('My Task');
      fireEvent.click(taskName);
      // After clicking, an input should appear with the task name value
      const editInput = screen.getByDisplayValue('My Task');
      expect(editInput).toBeDefined();
      expect(editInput.tagName).toBe('INPUT');
    });

    it('clicking "Mark done" on manual task calls onUpdateTask with status done', () => {
      const props = defaultProps();
      const task = makeTask(1, { status: 'pending', manual: true });
      render(<TaskDetail {...props} task={task} />);
      const markDoneBtn = screen.getByText(/Mark done/);
      fireEvent.click(markDoneBtn);
      expect(props.onUpdateTask).toHaveBeenCalledWith(1, expect.objectContaining({ status: 'done' }));
    });

    it('clicking "Activate" on backlog task calls onUpdateTask with status pending', () => {
      const props = defaultProps();
      const task = makeTask(1, { status: 'backlog' });
      render(<TaskDetail {...props} task={task} />);
      const activateBtn = screen.getByText(/Activate/);
      fireEvent.click(activateBtn);
      expect(props.onUpdateTask).toHaveBeenCalledWith(1, expect.objectContaining({ status: 'pending' }));
    });

    it('clicking "Backlog" button on pending task calls onUpdateTask with status backlog', () => {
      const props = defaultProps();
      const task = makeTask(1, { status: 'pending', manual: true });
      render(<TaskDetail {...props} task={task} />);
      const backlogBtn = screen.getByText('Backlog');
      fireEvent.click(backlogBtn);
      expect(props.onUpdateTask).toHaveBeenCalledWith(1, expect.objectContaining({ status: 'backlog' }));
    });

    it('blocked reason input blur saves the reason via onUpdateTask', () => {
      const props = defaultProps();
      const task = makeTask(1, { status: 'blocked' });
      render(<TaskDetail {...props} task={task} />);
      const blockedInput = screen.getByPlaceholderText('Why is this blocked?');
      fireEvent.input(blockedInput, { target: { value: 'Waiting for API' } });
      fireEvent.blur(blockedInput);
      expect(props.onUpdateTask).toHaveBeenCalledWith(1, expect.objectContaining({ blockedReason: 'Waiting for API' }));
    });

    it('name edit: pressing Enter saves and exits edit mode', () => {
      const props = defaultProps();
      const task = makeTask(1, { name: 'Old Name', fullName: 'Old Name' });
      render(<TaskDetail {...props} task={task} />);
      fireEvent.click(screen.getByText('Old Name'));
      const editInput = screen.getByDisplayValue('Old Name');
      fireEvent.input(editInput, { target: { value: 'New Name' } });
      fireEvent.keyDown(editInput, { key: 'Enter' });
      expect(props.onUpdateTask).toHaveBeenCalledWith(1, expect.objectContaining({ fullName: 'New Name' }));
    });

    it('name edit: pressing Escape cancels without saving', () => {
      const props = defaultProps();
      const task = makeTask(1, { name: 'Original', fullName: 'Original' });
      render(<TaskDetail {...props} task={task} />);
      fireEvent.click(screen.getByText('Original'));
      const editInput = screen.getByDisplayValue('Original');
      fireEvent.input(editInput, { target: { value: 'Changed' } });
      fireEvent.keyDown(editInput, { key: 'Escape' });
      // Should exit edit mode without calling onUpdateTask
      // The h3 with 'Original' should be back
      expect(screen.getByText('Original')).toBeDefined();
    });

    it('delete button resets to non-confirm state on blur', () => {
      const props = defaultProps();
      const task = makeTask(1);
      render(<TaskDetail {...props} task={task} />);
      const deleteBtn = screen.getByText('Delete task');
      fireEvent.click(deleteBtn);
      expect(screen.getByText('Confirm delete?')).toBeDefined();
      fireEvent.blur(screen.getByText('Confirm delete?'));
      expect(screen.getByText('Delete task')).toBeDefined();
    });

    it('changing from blocked to another status clears blocked reason', () => {
      const props = defaultProps();
      const task = makeTask(1, { status: 'blocked', blockedReason: 'Some issue' });
      render(<TaskDetail {...props} task={task} />);
      const select = screen.getByLabelText('Task status');
      fireEvent.change(select, { target: { value: 'pending' } });
      expect(props.onUpdateTask).toHaveBeenCalledWith(1, expect.objectContaining({
        status: 'pending',
        blockedReason: ''
      }));
    });
  });
});
