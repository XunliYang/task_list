import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StatusDot } from './StatusDot';

describe('StatusDot', () => {
  it('渲染圆点并暴露 aria-label 与 title', () => {
    render(<StatusDot color="#1976d2" label="进行中" />);
    const dot = screen.getByRole('img', { name: '进行中' });
    expect(dot).toBeInTheDocument();
    expect(dot).toHaveAttribute('title', '进行中');
    expect(dot).toHaveAttribute('data-status', 'pending');
  });

  it('进行中状态输出 in_progress 类名', () => {
    render(<StatusDot color="#1976d2" label="进行中" status="in_progress" />);
    expect(screen.getByRole('img', { name: '进行中' })).toHaveAttribute(
      'data-status',
      'in_progress',
    );
  });
});
