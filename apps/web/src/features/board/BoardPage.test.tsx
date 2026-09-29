import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { Stage, StatusCategory, Task } from '@task-list/shared';
import { statusKeys, taskKeys } from '../../api/query-keys';
import { BoardPage } from './BoardPage';

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

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 't1',
    title: '任务',
    company: null,
    statusId: 'status-a',
    tags: [],
    stages: [],
    currentStageId: null,
    notes: '',
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
    ...overrides,
  };
}

const categories: StatusCategory[] = [
  { id: 'status-a', name: '进行中', color: '#1976d2', order: 0 },
  { id: 'status-b', name: '已完成', color: '#388e3c', order: 1 },
];

const tasks: Task[] = [
  makeTask({
    id: 't1',
    title: '投递阿里',
    statusId: 'status-a',
    stages: [
      makeStage({ id: 's1', name: '笔试', order: 0, status: 'in_progress' }),
    ],
  }),
  makeTask({
    id: 't2',
    title: '投递腾讯',
    statusId: 'status-a',
  }),
  makeTask({
    id: 't3',
    title: '已录用字节',
    statusId: 'status-b',
  }),
];

function renderBoard() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  queryClient.setQueryData(statusKeys.lists(), categories);
  queryClient.setQueryData(taskKeys.list({}), tasks);

  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/board']}>
        <Routes>
          <Route path="/board" element={<BoardPage now={new Date(2026, 8, 28)} />} />
          <Route path="/tasks/:id" element={<div>detail</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('BoardPage', () => {
  it('给定 2 分类 / 3 任务的 mock 数据渲染出 2 列、3 张卡', () => {
    renderBoard();

    expect(screen.getAllByTestId('status-column')).toHaveLength(2);
    expect(screen.getAllByTestId('row')).toHaveLength(3);

    // 列头显示分类名与任务数
    expect(screen.getByRole('heading', { name: '进行中' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '已完成' })).toBeInTheDocument();

    // 卡显示任务标题
    expect(screen.getByText('投递阿里')).toBeInTheDocument();
    expect(screen.getByText('投递腾讯')).toBeInTheDocument();
    expect(screen.getByText('已录用字节')).toBeInTheDocument();
  });
});