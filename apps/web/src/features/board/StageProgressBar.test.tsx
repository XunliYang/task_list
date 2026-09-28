import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { Stage } from '@task-list/shared';
import { boardCopy } from './board-copy';
import { StageProgressBar } from './StageProgressBar';

function makeStage(overrides: Partial<Stage> = {}): Stage {
  return {
    id: 's1',
    name: '笔试',
    order: 0,
    status: 'pending',
    dueDate: null,
    completedAt: null,
    ...overrides,
  };
}

const ACCENT = '#1976d2';

describe('StageProgressBar', () => {
  it('3 阶段（1 done / 1 in_progress / 1 pending）渲染 3 段且 aria-valuenow 为 1', () => {
    const stages = [
      makeStage({ id: 's1', name: '笔试', order: 0, status: 'done' }),
      makeStage({ id: 's2', name: '一面', order: 1, status: 'in_progress' }),
      makeStage({ id: 's3', name: '二面', order: 2, status: 'pending' }),
    ];

    render(<StageProgressBar stages={stages} accentColor={ACCENT} />);

    const segments = screen.getAllByTestId('stage-segment');
    expect(segments).toHaveLength(3);

    const bar = screen.getByRole('progressbar');
    expect(bar).toHaveAttribute('aria-valuemin', '0');
    expect(bar).toHaveAttribute('aria-valuemax', '3');
    expect(bar).toHaveAttribute('aria-valuenow', '1');

    // 每段 aria-label 含阶段名与状态
    expect(screen.getByLabelText('笔试：已完成')).toBeInTheDocument();
    expect(screen.getByLabelText('一面：进行中')).toBeInTheDocument();
    expect(screen.getByLabelText('二面：未开始')).toBeInTheDocument();
  });

  it('右下角显示已完成数/总数', () => {
    const stages = [
      makeStage({ id: 's1', name: '笔试', order: 0, status: 'done' }),
      makeStage({ id: 's2', name: '一面', order: 1, status: 'in_progress' }),
    ];

    render(<StageProgressBar stages={stages} accentColor={ACCENT} />);
    expect(screen.getByText('1/2')).toBeInTheDocument();
  });

  it('0 阶段渲染空态文案且不渲染进度条', () => {
    render(<StageProgressBar stages={[]} accentColor={ACCENT} />);

    expect(screen.getByTestId('stage-progress-empty')).toHaveTextContent(boardCopy.noStages);
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    expect(screen.queryByTestId('stage-segment')).not.toBeInTheDocument();
  });
});