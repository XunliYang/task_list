import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { Stage, StatusCategory, Task } from '@task-list/shared';
import { buildOverview } from '../features/home/overview';
import { HomePage } from './HomePage';

// ---------------------------------------------------------------------------
// 纯函数聚合层 buildOverview
// ---------------------------------------------------------------------------

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

describe('buildOverview', () => {
  // 2026-09-28 为周一。
  const now = new Date(2026, 8, 28);
  const categories: StatusCategory[] = [
    { id: 'status-a', name: '进行中', color: '#1976d2', order: 0 },
    { id: 'status-b', name: '已完成', color: '#388e3c', order: 1 },
  ];

  it('给定 3 任务 / 2 分类正确聚合 total / byStatus / 阶段口径 / 逾期', () => {
    const tasks: Task[] = [
      // 全部阶段完成 → completed
      makeTask({
        id: 't1',
        statusId: 'status-a',
        stages: [
          makeStage({ id: 's1', name: '笔试', order: 0, status: 'done' }),
          makeStage({ id: 's2', name: '一面', order: 1, status: 'done' }),
        ],
      }),
      // 有逾期未完成阶段 + 一个本周到期阶段 → inProgress；逾期 1、本周到期 1
      makeTask({
        id: 't2',
        statusId: 'status-a',
        stages: [
          makeStage({ id: 's3', name: '二面', order: 0, status: 'in_progress', dueDate: '2026-09-20' }),
          makeStage({ id: 's4', name: '三面', order: 1, status: 'pending', dueDate: '2026-10-02' }),
        ],
      }),
      // 无阶段 → 既非进行中也非已完成
      makeTask({ id: 't3', statusId: 'status-b' }),
    ];

    const overview = buildOverview(tasks, categories, now);

    expect(overview.total).toBe(3);

    expect(overview.byStatus).toEqual([
      { statusId: 'status-a', name: '进行中', color: '#1976d2', count: 2 },
      { statusId: 'status-b', name: '已完成', color: '#388e3c', count: 1 },
    ]);

    expect(overview.stageStats).toEqual({ inProgress: 1, completed: 1 });
    // t2 的 s3（09-20 < 09-28）逾期，s4（10-02 在本周内）本周到期。
    expect(overview.overdue).toBe(1);
    expect(overview.dueThisWeek).toBe(1);
  });

  it('固定 now 注入：同一数据在不同 now 下 overdue 结果不同，不依赖真实时钟', () => {
    const tasks = [
      makeTask({
        id: 't1',
        statusId: 'status-a',
        stages: [makeStage({ id: 's1', status: 'pending', dueDate: '2026-09-20' })],
      }),
    ];

    const before = buildOverview(tasks, categories, new Date(2026, 8, 19)).overdue;
    const after = buildOverview(tasks, categories, new Date(2026, 8, 21)).overdue;

    // dueDate=09-20：now=09-19 未逾期，now=09-21 已逾期。
    expect(before).toBe(0);
    expect(after).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// HomePage 组件
// ---------------------------------------------------------------------------

const mocks = vi.hoisted(() => ({
  tasks: [] as Task[],
  statuses: [] as StatusCategory[],
  isLoading: false,
  isError: false,
}));

vi.mock('../api/tasks', () => ({
  useTasks: () => ({
    data: mocks.tasks,
    isLoading: mocks.isLoading,
    isError: mocks.isError,
    refetch: vi.fn(),
  }),
}));

vi.mock('../api/statuses', () => ({
  useStatuses: () => ({
    data: mocks.statuses,
    isLoading: mocks.isLoading,
    isError: mocks.isError,
    refetch: vi.fn(),
  }),
}));

const categories: StatusCategory[] = [
  { id: 'status-a', name: '进行中', color: '#1976d2', order: 0 },
  { id: 'status-b', name: '已完成', color: '#388e3c', order: 1 },
];

const renderHome = (now = new Date(2026, 8, 28)) => {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="/" element={<HomePage now={now} />} />
        <Route path="/board" element={<div>board</div>} />
        <Route path="/calendar" element={<div>calendar</div>} />
        <Route path="/exams" element={<div>exams</div>} />
        <Route path="/statuses" element={<div>statuses</div>} />
      </Routes>
    </MemoryRouter>,
  );
};

/** 定位指标卡片并返回其可作用域，便于断言卡内数值。 */
function metricValue(label: string): HTMLElement {
  const heading = screen.getByRole('heading', { name: label });
  const card = heading.closest('article');
  if (!card) {
    throw new Error(`指标「${label}」未渲染为卡片`);
  }
  return within(card as HTMLElement).getByText(/^\d+$/);
}

beforeEach(() => {
  mocks.tasks = [];
  mocks.statuses = [];
  mocks.isLoading = false;
  mocks.isError = false;
});

describe('HomePage', () => {
  it('mock 数据渲染出各指标数值与 4 个入口链接，`?new=1` href 正确', () => {
    mocks.tasks = [
      makeTask({
        id: 't1',
        title: '投递阿里',
        statusId: 'status-a',
        stages: [
          makeStage({ id: 's1', name: '笔试', order: 0, status: 'done' }),
          makeStage({ id: 's2', name: '一面', order: 1, status: 'done' }),
        ],
      }),
      makeTask({
        id: 't2',
        title: '投递腾讯',
        statusId: 'status-a',
        stages: [
          makeStage({ id: 's3', name: '二面', order: 0, status: 'in_progress', dueDate: '2026-09-20' }),
          makeStage({ id: 's4', name: '三面', order: 1, status: 'pending', dueDate: '2026-10-02' }),
        ],
      }),
      makeTask({ id: 't3', title: '已录用字节', statusId: 'status-b' }),
    ];
    mocks.statuses = categories;

    renderHome();

    expect(metricValue('任务总数')).toHaveTextContent('3');
    expect(metricValue('进行中')).toHaveTextContent('1');
    expect(metricValue('已完成')).toHaveTextContent('1');
    expect(metricValue('本周到期')).toHaveTextContent('1');
    expect(metricValue('已逾期')).toHaveTextContent('1');

    // 4 个入口链接（标题都锚定在卡片首位，避免与其它卡片脚注文案撞名）。
    expect(screen.getByRole('link', { name: /^看板/ })).toHaveAttribute('href', '/board');
    expect(screen.getByRole('link', { name: /^日历/ })).toHaveAttribute('href', '/calendar');
    expect(screen.getByRole('link', { name: /^考试信息/ })).toHaveAttribute('href', '/exams');
    expect(screen.getByRole('link', { name: /^状态管理/ })).toHaveAttribute('href', '/statuses');

    // 「＋ 新建任务」入口指向 /board?new=1。
    expect(screen.getByRole('link', { name: /新建任务/ })).toHaveAttribute(
      'href',
      '/board?new=1',
    );
  });

  it('无任务时渲染空态引导与新建入口', () => {
    mocks.tasks = [];
    mocks.statuses = categories;

    renderHome();

    expect(screen.getByTestId('home-empty')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '还没有任务' })).toBeInTheDocument();
    // 空态里的新建入口同样指向 /board?new=1。
    const empty = screen.getByTestId('home-empty');
    expect(within(empty).getByRole('link', { name: /新建任务/ })).toHaveAttribute(
      'href',
      '/board?new=1',
    );
    // 快捷入口区仍然保留，导航不丢失。
    expect(screen.getByRole('link', { name: /^看板/ })).toHaveAttribute('href', '/board');
  });

  it('接口失败时渲染 role=alert 与重试按钮', () => {
    mocks.isError = true;

    renderHome();

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '重试' })).toBeInTheDocument();
  });

  it('加载中渲染 role=status', () => {
    mocks.isLoading = true;

    renderHome();

    expect(screen.getByRole('status')).toBeInTheDocument();
  });
});