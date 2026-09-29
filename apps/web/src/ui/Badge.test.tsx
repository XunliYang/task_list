import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Badge } from './Badge';

describe('Badge', () => {
  it('渲染子内容且默认 neutral', () => {
    render(<Badge>前端</Badge>);
    const badge = screen.getByText('前端');
    expect(badge).toBeInTheDocument();
    expect(badge.className).toContain('ui-badge--neutral');
  });

  it('语义变体输出对应类名', () => {
    const variants = ['primary', 'success', 'warning', 'error'] as const;
    for (const variant of variants) {
      const { unmount } = render(<Badge variant={variant}>x</Badge>);
      expect(screen.getByText('x').className).toContain(`ui-badge--${variant}`);
      unmount();
    }
  });
});
