import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { Stage, Task } from '@task-list/shared';
import { StageFlowPanel } from './StageFlowPanel';

const mocks = vi.hoisted(() => ({
  advanceAsync: vi.fn(),
  advancePending: false,
  setCurrent: vi.fn(),
}));

vi.mock('../../api/tasks', () => ({
  useAdvanceStage: () => ({ mutateAsync: mocks.advanceAsync, isPending: mocks.advancePending }),
  useSetCurrentStage: () => ({ mutate: mocks.setCurrent, isPending: false }),
}));

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

beforeEach(() => {
  mocks.advanceAsync.mockReset();
  mocks.setCurrent.mockReset();
});

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

describe('StageFlowPanel 阶段推进（SuccessMorphButton 真实反映结果）', () => {
  const midTask = () =>
    task(
      [stage('a', '笔试', 0, 'done'), stage('b', '一面', 1, 'in_progress'), stage('c', '二面', 2, 'pending')],
      'b',
    );

  it('推进成功：返回 nextStage 并展示「已进入…」提示', async () => {
    mocks.advanceAsync.mockResolvedValue({ nextStage: { name: '二面' } });
    renderPanel(midTask());
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: '完成「一面」并进入下一阶段' }));

    await waitFor(() => expect(mocks.advanceAsync).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(screen.getByText('已进入「二面」')).toBeInTheDocument(),
    );
  });

  it('推进失败：按钮进入 error 态并展示错误提示（不伪造成功）', async () => {
    mocks.advanceAsync.mockRejectedValue(new Error('服务器错误'));
    renderPanel(midTask());
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: '完成「一面」并进入下一阶段' }));

    await waitFor(() => expect(screen.getByText('推进失败：服务器错误')).toBeInTheDocument());
    expect(screen.getByRole('button', { name: '失败，重试' })).toBeInTheDocument();
  });
});