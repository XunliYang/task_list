import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { StatusCategory, Task } from '@task-list/shared';
import { statusKeys, taskKeys } from '../../api/query-keys';
import { TaskCreateDialog } from './TaskCreateDialog';
import { BoardPage } from '../board/BoardPage';

const { mutateMock } = vi.hoisted(() => ({ mutateMock: vi.fn() }));

// 只替换 useCreateTask（提交 mock），useTasks / useStatuses 走真实实现 + query cache。
vi.mock('../../api/tasks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../api/tasks')>();
  return {
    ...actual,
    useCreateTask: () => ({
      mutate: mutateMock,
      isPending: false,
      isError: false,
      error: null,
    }),
  };
});

const categories: StatusCategory[] = [
  { id: 'status-a', name: '进行中', color: '#1976d2', order: 0 },
  { id: 'status-b', name: '已完成', color: '#388e3c', order: 1 },
];

function makeQueryClient() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  client.setQueryData(statusKeys.lists(), categories);
  return client;
}

beforeEach(() => {
  mutateMock.mockReset();
});

// ---------------------------------------------------------------------------
// TaskCreateDialog
// ---------------------------------------------------------------------------

function renderDialog() {
  const onClose = vi.fn();
  const onCreated = vi.fn();
  const client = makeQueryClient();
  render(
    <QueryClientProvider client={client}>
      <TaskCreateDialog open onClose={onClose} onCreated={onCreated} />
    </QueryClientProvider>,
  );
  return { onClose, onCreated };
}

describe('TaskCreateDialog', () => {
  it('标题为空时提交按钮禁用且不触发 mutation', async () => {
    renderDialog();
    const user = userEvent.setup();
    const submit = screen.getByRole('button', { name: '创建' });
    expect(submit).toBeDisabled();
    await user.click(submit);
    expect(mutateMock).not.toHaveBeenCalled();
  });

  it('填标题后提交调用 useCreateTask 并关闭弹窗', async () => {
    const { onClose, onCreated } = renderDialog();
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('标题'), '投递 ACME');
    await user.click(screen.getByRole('button', { name: '创建' }));

    expect(mutateMock).toHaveBeenCalledTimes(1);
    const [input, options] = mutateMock.mock.calls[0] as [Task, { onSuccess: (t: Task) => void }];
    expect(input.title).toBe('投递 ACME');
    expect(input.statusId).toBe('status-a'); // 默认取第一个分类
    expect(input.stages).toEqual([{ name: '准备', dueDate: null }]); // 默认 1 个「准备」阶段

    // 模拟后端成功 → 调用 onCreated 并关闭弹窗
    options.onSuccess({ id: 't9', title: '投递 ACME' } as Task);
    expect(onCreated).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it('删除唯一阶段后提交按钮禁用且提示「至少保留一个阶段」', async () => {
    renderDialog();
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('标题'), '投递 ACME');
    expect(screen.getByRole('button', { name: '创建' })).toBeEnabled();

    await user.click(screen.getByLabelText('删除阶段 1'));

    expect(screen.getByRole('button', { name: '创建' })).toBeDisabled();
    expect(screen.getByText('至少保留一个阶段')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '创建' }));
    expect(mutateMock).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// BoardPage 快捷新建入口（?new=1 / 列头「＋」）
// ---------------------------------------------------------------------------

function renderBoard(initialEntry: string) {
  const client = makeQueryClient();
  client.setQueryData(taskKeys.list({}), []);
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route path="/board" element={<BoardPage now={new Date(2026, 8, 28)} />} />
          <Route path="/tasks/:id" element={<div>detail</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('BoardPage 快捷新建入口', () => {
  it('?new=1 进入时自动打开创建弹窗', async () => {
    renderBoard('/board?new=1');
    expect(await screen.findByRole('dialog', { name: '新建任务' })).toBeInTheDocument();
    expect(screen.getByLabelText('标题')).toBeInTheDocument();
  });

  it('列头「＋」点击时 statusId 预填为该列分类', async () => {
    const user = userEvent.setup();
    renderBoard('/board');
    await user.click(screen.getByRole('button', { name: '在「进行中」下新建任务' }));

    const dialog = screen.getByRole('dialog', { name: '新建任务' });
    const select = within(dialog).getByLabelText('状态分类') as HTMLSelectElement;
    expect(select.value).toBe('status-a');
  });
});