import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { Stage, Task } from '@task-list/shared';
import { StageFlowPanel } from './StageFlowPanel';

function stage(id: string, name: string, order: number, status: Stage['status']): Stage {
  return { id, name, order, status, dueDate: null, completedAt: null };
}

function task(stages: Stage[], currentStageId: string | null): Task {
  return {
    id: 't1',
    title: 'T',
    company: null,
    statusId: 's1',
    tags: [],
    stages,
    currentStageId,
    notes: '',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

function renderPanel(value: Task) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <StageFlowPanel task={value} />
    </QueryClientProvider>,
  );
}

describe('StageFlowPanel', () => {
  it('当前阶段为中间阶段时主按钮文案为「完成<阶段名>并进入下一阶段」', () => {
    renderPanel(
      task(
        [stage('a', '笔试', 0, 'done'), stage('b', '一面', 1, 'in_progress'), stage('c', '二面', 2, 'pending')],
        'b',
      ),
    );
    expect(
      screen.getByRole('button', { name: '完成「一面」并进入下一阶段' }),
    ).toBeInTheDocument();
  });

  it('当前阶段为末阶段时文案为「完成最后一个阶段」', () => {
    renderPanel(
      task([stage('a', '笔试', 0, 'done'), stage('b', '一面', 1, 'in_progress')], 'b'),
    );
    expect(screen.getByRole('button', { name: '完成最后一个阶段' })).toBeInTheDocument();
  });

  it('全部阶段完成时按钮禁用并显示「全部阶段已完成」', () => {
    renderPanel(
      task([stage('a', '笔试', 0, 'done'), stage('b', '一面', 1, 'done')], 'b'),
    );
    const button = screen.getByRole('button', { name: '全部阶段已完成' });
    expect(button).toBeInTheDocument();
    expect(button).toBeDisabled();
  });
});