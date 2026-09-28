import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { Task } from '@task-list/shared';
import { TaskDetailPage } from './TaskDetailPage';

vi.mock('react-router-dom', () => ({
  Link: ({ to, children }: { to: string; children: React.ReactNode }) => <a href={to}>{children}</a>,
  useNavigate: () => vi.fn(),
  useParams: () => ({ id: 't1' }),
}));

vi.mock('../../api/tasks', () => ({
  useTask: () => ({ data: task, isLoading: false, isError: false }),
  useTaskProgress: () => ({ data: [], isLoading: false, isError: false }),
  useDeleteTask: () => ({ mutate: vi.fn(), isPending: false }),
  useUpdateTask: () => ({ mutate: vi.fn(), isPending: false }),
  useAddProgress: () => ({ mutate: vi.fn(), isPending: false }),
  useAdvanceStage: () => ({ mutate: vi.fn(), isPending: false }),
  useSetCurrentStage: () => ({ mutate: vi.fn(), isPending: false }),
  useAddStage: () => ({ mutate: vi.fn(), isPending: false }),
  useUpdateStage: () => ({ mutate: vi.fn(), isPending: false }),
  useDeleteStage: () => ({ mutate: vi.fn(), isPending: false }),
  useReorderStages: () => ({ mutate: vi.fn(), isPending: false }),
}));

vi.mock('../../api/statuses', () => ({
  useStatuses: () => ({
    data: [{ id: 's1', name: '准备中', color: '#fff176', order: 0 }],
    isLoading: false,
  }),
}));

const task: Task = {
  id: 't1',
  title: '投递 ACME',
  company: 'ACME',
  statusId: 's1',
  tags: [],
  stages: [],
  currentStageId: null,
  notes: '',
  createdAt: '',
  updatedAt: '',
};

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <TaskDetailPage />
    </QueryClientProvider>,
  );
}

describe('TaskDetailPage 状态分类 pill 对比度', () => {
  it('浅色分类（#fff176）文字色为深色', () => {
    renderPage();
    const pill = screen.getByText('准备中');
    expect(pill).toHaveStyle({ color: '#000000' });
  });
});