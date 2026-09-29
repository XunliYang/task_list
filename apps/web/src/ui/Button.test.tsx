import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Button } from './Button';

describe('Button', () => {
  it('渲染子内容且默认 type=button、secondary 变体', () => {
    render(<Button>筛选</Button>);
    const btn = screen.getByRole('button', { name: '筛选' });
    expect(btn).toBeInTheDocument();
    expect(btn).toHaveAttribute('type', 'button');
    expect(btn.className).toContain('ui-button--secondary');
  });

  it('primary / ghost 变体输出对应类名', () => {
    const { rerender } = render(<Button variant="primary">主</Button>);
    expect(screen.getByRole('button', { name: '主' }).className).toContain('ui-button--primary');
    rerender(<Button variant="ghost">幻</Button>);
    expect(screen.getByRole('button', { name: '幻' }).className).toContain('ui-button--ghost');
  });

  it('透传 disabled 与 onClick', () => {
    const onClick = vi.fn();
    render(
      <Button disabled onClick={onClick}>
        禁用
      </Button>,
    );
    const btn = screen.getByRole('button', { name: '禁用' });
    expect(btn).toBeDisabled();
    btn.click();
    expect(onClick).not.toHaveBeenCalled();
  });
});
