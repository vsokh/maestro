import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { ProjectPicker } from '../../components/ProjectPicker.tsx';

afterEach(cleanup);

const defaultProps = () => ({
  onConnect: vi.fn(),
  status: 'disconnected',
});

describe('ProjectPicker', () => {
  it('renders "Dev Manager" heading when disconnected', () => {
    render(<ProjectPicker {...defaultProps()} />);
    expect(screen.getByText('Dev Manager')).toBeDefined();
  });

  it('renders "Retry connection" button when disconnected', () => {
    render(<ProjectPicker {...defaultProps()} />);
    expect(screen.getByRole('button', { name: 'Retry connection' })).toBeDefined();
  });

  it('renders connect button when disconnected', () => {
    render(<ProjectPicker {...defaultProps()} />);
    expect(screen.getByRole('button', { name: 'Retry connection' })).toBeDefined();
  });

  it('shows error message when status is "error"', () => {
    render(<ProjectPicker {...defaultProps()} status="error" />);
    expect(screen.getByText(/Could not connect/)).toBeDefined();
  });

  it('shows loading skeleton when status is "connecting"', () => {
    const { container } = render(<ProjectPicker {...defaultProps()} status="connecting" />);
    const skeletonBars = container.querySelectorAll('.skeleton-bar');
    expect(skeletonBars.length).toBeGreaterThan(0);
  });

  describe('interactions', () => {
    it('clicking "Retry connection" button calls onConnect', () => {
      const props = defaultProps();
      render(<ProjectPicker {...props} />);
      const openBtn = screen.getByRole('button', { name: 'Retry connection' });
      fireEvent.click(openBtn);
      expect(props.onConnect).toHaveBeenCalledTimes(1);
    });

    it('clicking "Retry connection" calls onConnect', () => {
      const props = defaultProps();
      render(<ProjectPicker {...props} />);
      const connectBtn = screen.getByRole('button', { name: 'Retry connection' });
      fireEvent.click(connectBtn);
      expect(props.onConnect).toHaveBeenCalledTimes(1);
    });
  });
});
