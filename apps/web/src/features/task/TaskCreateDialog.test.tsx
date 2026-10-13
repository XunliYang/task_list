import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
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
      mutateAsync: mutateMock,
      isPending: false,
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
    mutateMock.mockResolvedValue({ id: 't9', title: '投递 ACME' } as Task);
    const { onClose, onCreated } = renderDialog();
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('标题'), '投递 ACME');
    await user.click(screen.getByRole('button', { name: '创建' }));

    await waitFor(() => expect(mutateMock).toHaveBeenCalledTimes(1));
    const [input] = mutateMock.mock.calls[0] as [Task];
    expect(input.title).toBe('投递 ACME');
    expect(input.statusId).toBe('status-a'); // 默认取第一个分类
    // 默认阶段模板「网申投递→…→签约」7 个阶段
    expect(input.stages).toEqual([
      { name: '网申投递', dueDate: null },
      { name: '笔试', dueDate: null },
      { name: '一面', dueDate: null },
      { name: '二面', dueDate: null },
      { name: 'HR 面', dueDate: null },
      { name: 'offer', dueDate: null },
      { name: '签约', dueDate: null },
    ]);
    expect(input.jobApplication).toBeNull();

    await waitFor(() => {
      expect(onCreated).toHaveBeenCalled();
      expect(onClose).toHaveBeenCalled();
    });
  });

  it('删除全部阶段后提交按钮禁用且提示「至少保留一个阶段」', async () => {
    renderDialog();
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('标题'), '投递 ACME');
    expect(screen.getByRole('button', { name: '创建' })).toBeEnabled();

    // 默认 7 个阶段，逐个删除首位直到为空（删除后索引前移，始终点「删除阶段 1」）。
    for (let i = 0; i < 7; i++) {
      await user.click(screen.getByLabelText('删除阶段 1'));
    }

    expect(screen.getByRole('button', { name: '创建' })).toBeDisabled();
    expect(screen.getByText('至少保留一个阶段')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '创建' }));
    expect(mutateMock).not.toHaveBeenCalled();
  });

  it('提交失败时按钮进入 error 态并展示后端 message', async () => {
    mutateMock.mockRejectedValue(new Error('创建失败：服务器繁忙'));
    renderDialog();
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('标题'), '投递 ACME');
    await user.click(screen.getByRole('button', { name: '创建' }));
    await waitFor(() =>
      expect(screen.getByText('创建失败：服务器繁忙')).toBeInTheDocument(),
    );
    expect(screen.getByRole('button', { name: '失败，重试' })).toBeInTheDocument();
  });

  it('默认折叠「求职信息」，点击后展开并出现 5 个字段', async () => {
    renderDialog();
    const user = userEvent.setup();
    expect(screen.queryByLabelText('投递岗位')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '求职信息' }));
    expect(screen.getByLabelText('投递岗位')).toBeInTheDocument();
    expect(screen.getByLabelText('公告链接')).toBeInTheDocument();
    expect(screen.getByLabelText('简历链接')).toBeInTheDocument();
    expect(screen.getByLabelText('投递链接')).toBeInTheDocument();
    expect(screen.getByLabelText('投递要求')).toBeInTheDocument();
  });

  it('填写完整求职信息后提交，payload 携带 jobApplication', async () => {
    mutateMock.mockResolvedValue({ id: 't9', title: '投递 ACME' } as Task);
    renderDialog();
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('标题'), '投递 ACME');
    await user.click(screen.getByRole('button', { name: '求职信息' }));
    await user.type(screen.getByLabelText('投递岗位'), '后端工程师');
    await user.type(screen.getByLabelText('公告链接'), 'https://a.example.com/announce');
    await user.type(screen.getByLabelText('简历链接'), 'https://r.example.com/resume.pdf');
    await user.type(screen.getByLabelText('投递链接'), 'https://app.example.com/apply');
    await user.type(screen.getByLabelText('投递要求'), '熟悉 Go');

    await user.click(screen.getByRole('button', { name: '创建' }));

    await waitFor(() => expect(mutateMock).toHaveBeenCalledTimes(1));
    const [input] = mutateMock.mock.calls[0] as [Task];
    expect(input.jobApplication).toEqual({
      position: '后端工程师',
      announcementUrl: 'https://a.example.com/announce',
      resumeUrl: 'https://r.example.com/resume.pdf',
      applyUrl: 'https://app.example.com/apply',
      requirements: '熟悉 Go',
    });
  });

  it('非法 URL 阻止提交并给出提示', async () => {
    renderDialog();
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('标题'), '投递 ACME');
    await user.click(screen.getByRole('button', { name: '求职信息' }));
    await user.type(screen.getByLabelText('公告链接'), 'not-a-url');

    expect(screen.getByText('公告链接不是有效链接')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '创建' })).toBeDisabled();
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