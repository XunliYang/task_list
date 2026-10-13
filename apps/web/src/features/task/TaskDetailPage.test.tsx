import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { JobApplication, Task } from '@task-list/shared';
import { TaskDetailPage } from './TaskDetailPage';

const { currentTask, deleteMock } = vi.hoisted(() => ({
  currentTask: { value: null as Task | null },
  deleteMock: vi.fn(),
}));

vi.mock('react-router-dom', () => ({
  Link: ({ to, children }: { to: string; children: React.ReactNode }) => <a href={to}>{children}</a>,
  useNavigate: () => vi.fn(),
  useParams: () => ({ id: 't1' }),
}));

vi.mock('../../api/tasks', () => ({
  useTask: () => ({ data: currentTask.value, isLoading: false, isError: false }),
  useTaskProgress: () => ({ data: [], isLoading: false, isError: false }),
  useDeleteTask: () => ({ mutate: deleteMock, isPending: false }),
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

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 't1',
    title: '投递 ACME',
    company: 'ACME',
    statusId: 's1',
    tags: [],
    stages: [],
    currentStageId: null,
    notes: '',
    jobApplication: null,
    createdAt: '',
    updatedAt: '',
    ...overrides,
  };
}

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <TaskDetailPage />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  currentTask.value = makeTask();
  deleteMock.mockReset();
});

describe('TaskDetailPage 状态分类 pill 对比度', () => {
  it('浅色分类（#fff176）文字色为深色', () => {
    renderPage();
    const pill = screen.getByText('准备中');
    expect(pill).toHaveStyle({ color: '#000000' });
  });
});

describe('TaskDetailPage 求职信息卡片', () => {
  it('jobApplication 为 null 时不渲染求职信息卡片', () => {
    currentTask.value = makeTask({ jobApplication: null });
    renderPage();
    expect(screen.queryByText('求职信息')).not.toBeInTheDocument();
  });

  it('渲染岗位、三条可点击链接（target=_blank rel=noreferrer）与整块要求', () => {
    const jobApplication: JobApplication = {
      position: '后端工程师',
      announcementUrl: 'https://a.example.com/announce',
      resumeUrl: 'https://r.example.com/resume.pdf',
      applyUrl: 'https://app.example.com/apply',
      requirements: '熟悉 Go\n加分：实习经历',
    };
    currentTask.value = makeTask({ jobApplication });
    renderPage();

    expect(screen.getByText('求职信息')).toBeInTheDocument();
    expect(screen.getByText('后端工程师')).toBeInTheDocument();

    const announce = screen.getByRole('link', { name: 'https://a.example.com/announce' });
    expect(announce).toHaveAttribute('href', 'https://a.example.com/announce');
    expect(announce).toHaveAttribute('target', '_blank');
    expect(announce).toHaveAttribute('rel', 'noreferrer');

    expect(screen.getByRole('link', { name: 'https://r.example.com/resume.pdf' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'https://app.example.com/apply' })).toBeInTheDocument();

    expect(screen.getByText(/熟悉 Go/)).toBeInTheDocument();
    expect(screen.getByText(/加分：实习经历/)).toBeInTheDocument();
  });

  it('position / 某链接 / requirements 为空时显示「—」', () => {
    currentTask.value = makeTask({
      jobApplication: {
        position: null,
        announcementUrl: null,
        resumeUrl: 'https://r.example.com/resume.pdf',
        applyUrl: null,
        requirements: null,
      },
    });
    renderPage();

    const section = screen.getByText('求职信息').closest('section') as HTMLElement;
    // position、公告链接、投递链接、投递要求 共 4 处「—」；简历链接可点击。
    expect(within(section).getAllByText('—')).toHaveLength(4);
    expect(
      within(section).getByRole('link', { name: 'https://r.example.com/resume.pdf' }),
    ).toBeInTheDocument();
  });
});