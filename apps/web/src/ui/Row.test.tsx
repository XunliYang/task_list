import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { ComponentProps } from 'react';
import { Row, rowCopy, rowDeadline } from './Row';
import type { RowStage } from './Row';

const STATUS_COLOR = '#1976d2';

function makeStage(overrides: Partial<RowStage> = {}): RowStage {
  return { id: 's1', name: '笔试', status: 'pending', dueDate: null, ...overrides };
}

type RowProps = ComponentProps<typeof Row>;

function renderRow(props: Partial<RowProps> = {}) {
  return render(
    <MemoryRouter>
      <Row statusColor={STATUS_COLOR} statusName="进行中" title="某公司前端岗" href="/tasks/t1" {...props} />
    </MemoryRouter>,
  );
}

describe('Row', () => {
  it('渲染状态点、标题、公司、标签 chips、进度 n/m、截止与详情箭头', () => {
    const stages = [
      makeStage({ id: 's1', name: '笔试', status: 'done', dueDate: '2026-10-01' }),
      makeStage({ id: 's2', name: '一面', status: 'in_progress', dueDate: '2026-10-10' }),
    ];
    renderRow({ company: 'Acme', tags: ['前端', '远程'], stages });

    expect(screen.getByRole('img', { name: '进行中' })).toBeInTheDocument();
    expect(screen.getByText('某公司前端岗')).toBeInTheDocument();
    expect(screen.getByText('Acme')).toBeInTheDocument();
    expect(screen.getByText('前端')).toBeInTheDocument();
    expect(screen.getByText('远程')).toBeInTheDocument();
    expect(screen.getByText('1/2')).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '1');
    expect(screen.getByRole('link', { name: `${rowCopy.detailLabel}：某公司前端岗` })).toHaveAttribute(
      'href',
      '/tasks/t1',
    );
    expect(screen.getAllByTestId('row-stage-segment')).toHaveLength(2);
  });

  it('逾期截止列标注错误文案（--error-text 类名 + 逾期后缀）', () => {
    const stages = [
      makeStage({ id: 's1', name: '笔试', status: 'pending', dueDate: '2026-09-01' }),
    ];
    renderRow({ stages, now: new Date('2026-09-29T00:00:00') });
    expect(screen.getByText(/2026-09-01 · 逾期/)).toBeInTheDocument();
  });

  it('无阶段时进度显示 — 与 0/0', () => {
    renderRow({ stages: [] });
    expect(screen.getByText('0/0')).toBeInTheDocument();
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  });

  it('⋯ 菜单键盘可达：打开、选择目标触发 onMoveTo、Escape 关闭', () => {
    const onMoveTo = vi.fn();
    renderRow({
      moveTargets: [
        { id: 'a', name: '已挂' },
        { id: 'b', name: '进行中' },
      ],
      onMoveTo,
    });

    const moveBtn = screen.getByRole('button', { name: rowCopy.moveLabel });
    expect(moveBtn).toHaveAttribute('aria-haspopup', 'menu');
    fireEvent.click(moveBtn);
    expect(moveBtn).toHaveAttribute('aria-expanded', 'true');

    fireEvent.click(screen.getByRole('menuitem', { name: '已挂' }));
    expect(onMoveTo).toHaveBeenCalledWith('a');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();

    // 再次打开，Escape 关闭
    fireEvent.click(moveBtn);
    fireEvent.keyDown(moveBtn.closest('.ui-row-actions')!, { key: 'Escape' });
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('draggable 由消费方注入', () => {
    const { container } = renderRow({ draggable: true });
    expect(container.querySelector('.ui-row')).toHaveAttribute('draggable', 'true');
  });
});

describe('Row compact（看板窄列变体，LEOY-126）', () => {
  it('紧凑态去掉装饰 chevron 与独立截止列，标题/公司/三段进度仍在，计数·截止并入一行', () => {
    const stages = [
      makeStage({ id: 's1', name: '笔试', status: 'done', dueDate: '2026-09-25' }),
      makeStage({ id: 's2', name: '一面', status: 'in_progress', dueDate: '2026-10-01' }),
      makeStage({ id: 's3', name: '二面', status: 'pending', dueDate: '2026-10-08' }),
    ];
    const { container } = renderRow({
      company: 'Acme',
      tags: ['前端', '远程'],
      stages,
      compact: true,
      now: new Date('2026-09-29T00:00:00'),
    });

    const link = screen.getByRole('link', { name: `${rowCopy.detailLabel}：某公司前端岗` });
    expect(link).toHaveClass('ui-row-link--compact');

    // 标题与公司主体保留（可见）
    expect(screen.getByText('某公司前端岗')).toBeInTheDocument();
    expect(screen.getByText('Acme')).toBeInTheDocument();

    // 装饰 chevron 与独立截止列在紧凑态移除（进度行已并入截止）
    expect(container.querySelector('.ui-row-chevron')).not.toBeInTheDocument();
    expect(container.querySelector('.ui-row-due')).not.toBeInTheDocument();

    // 三段图形化进度保留
    expect(screen.getAllByTestId('row-stage-segment')).toHaveLength(3);

    // 计数与截止并入 meta 行
    expect(screen.getByText('1/3 · 2026-10-01')).toBeInTheDocument();
  });

  it('紧凑态逾期截止在 meta 行带上逾期文案与语义类名', () => {
    const stages = [makeStage({ id: 's1', name: '笔试', status: 'pending', dueDate: '2026-09-01' })];
    const { container } = renderRow({
      stages,
      compact: true,
      now: new Date('2026-09-29T00:00:00'),
    });

    const meta = screen.getByText('0/1 · 2026-09-01 · 逾期');
    expect(meta).toHaveClass('ui-row-progress-meta--overdue');
    expect(container.querySelector('.ui-row-progress-meta')).toBe(meta);
  });
});

describe('rowDeadline（纯函数）', () => {
  const now = new Date('2026-09-29T00:00:00');

  it('取未完成阶段最早到期日，且含逾期阶段时 overdue=true', () => {
    const stages = [
      makeStage({ id: 's1', status: 'done', dueDate: '2026-09-01' }),
      makeStage({ id: 's2', status: 'pending', dueDate: '2026-10-05' }),
      makeStage({ id: 's3', status: 'in_progress', dueDate: '2026-09-10' }),
    ];
    expect(rowDeadline(stages, now)).toEqual({ dueDate: '2026-09-10', overdue: true });
  });

  it('全部完成时无截止、无逾期', () => {
    const stages = [makeStage({ id: 's1', status: 'done', dueDate: '2026-09-01' })];
    expect(rowDeadline(stages, now)).toEqual({ dueDate: null, overdue: false });
  });

  it('无阶段时无截止、无逾期', () => {
    expect(rowDeadline([], now)).toEqual({ dueDate: null, overdue: false });
  });
});
