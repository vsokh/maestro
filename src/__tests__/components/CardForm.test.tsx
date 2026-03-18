import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { CardForm } from '../../components/CardForm.tsx';
import type { Task } from '../../types';

afterEach(cleanup);

function makeTask(id: number, overrides: Partial<Task> = {}): Task {
  return { id, name: `Task ${id}`, status: 'pending', ...overrides };
}

const defaultProps = () => ({
  card: null as Partial<Task> | null,
  onSave: vi.fn(),
});

describe('CardForm', () => {
  it('renders with title input placeholder "Task title..."', () => {
    render(<CardForm {...defaultProps()} />);
    expect(screen.getByPlaceholderText('Task title...')).toBeDefined();
  });

  it('renders "Add task" submit button for new task (card=null)', () => {
    render(<CardForm {...defaultProps()} />);
    const btn = screen.getByRole('button', { name: 'Add task' });
    expect(btn).toBeDefined();
  });

  it('renders "Save" submit button when editing (card provided)', () => {
    const card = makeTask(1, { name: 'Existing task' });
    render(<CardForm {...defaultProps()} card={card} />);
    const btn = screen.getByRole('button', { name: 'Save' });
    expect(btn).toBeDefined();
  });

  it('renders Cancel button when onCancel provided', () => {
    render(<CardForm {...defaultProps()} onCancel={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDefined();
  });

  it('does NOT render Cancel button when onCancel omitted', () => {
    render(<CardForm {...defaultProps()} />);
    expect(screen.queryByRole('button', { name: 'Cancel' })).toBeNull();
  });

  it('renders manual task checkbox', () => {
    render(<CardForm {...defaultProps()} />);
    expect(screen.getByText(/Manual task/)).toBeDefined();
  });

  it('renders Skills section', () => {
    render(<CardForm {...defaultProps()} />);
    expect(screen.getByText('Skills')).toBeDefined();
  });

  it('renders Epic input with placeholder', () => {
    render(<CardForm {...defaultProps()} />);
    expect(screen.getByPlaceholderText(/Epic/)).toBeDefined();
  });

  describe('interactions', () => {
    it('form submission with valid title calls onSave with correct task object', () => {
      const props = defaultProps();
      render(<CardForm {...props} />);
      const titleInput = screen.getByPlaceholderText('Task title...');
      fireEvent.input(titleInput, { target: { value: 'My new task' } });
      const submitBtn = screen.getByRole('button', { name: 'Add task' });
      fireEvent.click(submitBtn);
      expect(props.onSave).toHaveBeenCalledTimes(1);
      const savedTask = props.onSave.mock.calls[0][0];
      expect(savedTask.name).toBe('My new task');
      expect(savedTask.fullName).toBe('My new task');
      expect(savedTask.status).toBe('pending');
    });

    it('form submission with empty title does NOT call onSave', () => {
      const props = defaultProps();
      render(<CardForm {...props} />);
      const submitBtn = screen.getByRole('button', { name: 'Add task' });
      fireEvent.click(submitBtn);
      expect(props.onSave).not.toHaveBeenCalled();
    });

    it('cancel button click calls onCancel', () => {
      const onCancel = vi.fn();
      render(<CardForm {...defaultProps()} onCancel={onCancel} />);
      const cancelBtn = screen.getByRole('button', { name: 'Cancel' });
      fireEvent.click(cancelBtn);
      expect(onCancel).toHaveBeenCalledTimes(1);
    });

    it('toggling "Manual task" checkbox hides skills section', () => {
      render(<CardForm {...defaultProps()} />);
      expect(screen.getByText('Skills')).toBeDefined();
      const checkbox = screen.getByRole('checkbox');
      fireEvent.click(checkbox);
      expect(screen.queryByText('Skills')).toBeNull();
    });

    it('filling in description is included in onSave payload', () => {
      const props = defaultProps();
      render(<CardForm {...props} />);
      const titleInput = screen.getByPlaceholderText('Task title...');
      fireEvent.input(titleInput, { target: { value: 'Task with desc' } });
      const descTextarea = screen.getByPlaceholderText('Description (what needs to be done)...');
      fireEvent.input(descTextarea, { target: { value: 'A detailed description' } });
      const submitBtn = screen.getByRole('button', { name: 'Add task' });
      fireEvent.click(submitBtn);
      expect(props.onSave).toHaveBeenCalledTimes(1);
      const savedTask = props.onSave.mock.calls[0][0];
      expect(savedTask.description).toBe('A detailed description');
    });

    it('editing existing task pre-fills title from card prop', () => {
      const card = makeTask(1, { name: 'Existing task', fullName: 'Existing task' });
      render(<CardForm {...defaultProps()} card={card} />);
      const titleInput = screen.getByDisplayValue('Existing task');
      expect(titleInput).toBeDefined();
    });

    it('epic/group input value is included in onSave payload', () => {
      const props = defaultProps();
      render(<CardForm {...props} />);
      const titleInput = screen.getByPlaceholderText('Task title...');
      fireEvent.input(titleInput, { target: { value: 'Some task' } });
      // Epic placeholder is 'Epic (e.g. Auth, DevToolbar)...'
      const epicInput = screen.getByPlaceholderText(/Epic/);
      fireEvent.input(epicInput, { target: { value: 'Auth' } });
      fireEvent.click(screen.getByRole('button', { name: 'Add task' }));
      expect(props.onSave).toHaveBeenCalledTimes(1);
      expect(props.onSave.mock.calls[0][0].group).toBe('Auth');
    });

    it('editing existing task shows "Save" button instead of "Add task"', () => {
      const card = makeTask(1, { name: 'Edit me' });
      render(<CardForm {...defaultProps()} card={card} />);
      expect(screen.getByRole('button', { name: 'Save' })).toBeDefined();
      expect(screen.queryByRole('button', { name: 'Add task' })).toBeNull();
    });

    it('manual task submission sets skills to empty array', () => {
      const props = defaultProps();
      render(<CardForm {...props} />);
      fireEvent.input(screen.getByPlaceholderText('Task title...'), { target: { value: 'Manual work' } });
      fireEvent.click(screen.getByRole('checkbox')); // toggle manual
      fireEvent.click(screen.getByRole('button', { name: 'Add task' }));
      expect(props.onSave.mock.calls[0][0].skills).toEqual([]);
      expect(props.onSave.mock.calls[0][0].manual).toBe(true);
    });
  });
});
