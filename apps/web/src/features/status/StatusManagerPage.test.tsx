import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ApiError } from '../../api/client';
import { StatusManagerPage } from './StatusManagerPage';
import { readableTextColor } from '../task/task-utils';

const mocks = vi.hoisted(() => ({
  deleteMock: vi.fn(),
  createMock: vi.fn(),
  updateAsyncMock: vi.fn(),
  refetchMock: vi.fn(),
}));

vi.mock('../../api/statuses', () => ({
  useStatuses: () => ({
    data: [
      { id: 's1', name: '进行中', color: '#1976d2', order: 0 },
      { id: 's2', name: '已完成', color: '#388e3c', order: 1 },
      { id: 's3', name: '已挂', color: '#f57c00', order: 2 },
    ],
    isLoading: false,
    refetch: mocks.refetchMock,
  }),
  useCreateStatus: () => ({ mutate: mocks.createMock, isPending: false }),
  useUpdateStatus: () => ({
    mutate: mocks.updateAsyncMock,
    mutateAsync: mocks.updateAsyncMock,
    isPending: false,
  }),
  useDeleteStatus: () => ({ mutate: mocks.deleteMock, isPending: false }),
}));

vi.mock('../../api/tasks', () => ({
  useTasks: () => ({
    data: [
      { id: 't1', title: 'T1', statusId: 's1' },
      { id: 't2', title: 'T2', statusId: 's1' },
      { id: 't3', title: 'T3', statusId: 's1' },
    ],
    isLoading: false,
  }),
}));

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <StatusManagerPage />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  mocks.deleteMock.mockReset();
  mocks.createMock.mockReset();
  mocks.updateAsyncMock.mockReset();
  mocks.refetchMock.mockReset();
  mocks.updateAsyncMock.mockResolvedValue(undefined);
});

describe('StatusManagerPage', () => {
  it('删除被引用分类返回 409 时展示「还有 N 个任务」提示', async () => {
    mocks.deleteMock.mockImplementation(
      (_id: unknown, opts?: { onError?: (err: unknown) => void }) => {
        opts?.onError?.(new ApiError(409, { code: 'status_in_use', message: '该分类下还有 3 个任务，请先移动' }));
      },
    );
    renderPage();
    const user = userEvent.setup();
    await user.click(screen.getAllByRole('button', { name: /^删除/ })[0]);
    expect(await screen.findByRole('alert')).toHaveTextContent('还有 3 个任务');
  });

  it('引用任务数正确展示', () => {
    renderPage();
    expect(screen.getAllByText('3 个任务').length).toBeGreaterThan(0);
  });

  it('输入改名后未点保存不发请求，点保存才发 PATCH', async () => {
    renderPage();
    const user = userEvent.setup();
    const nameInput = screen.getByLabelText('重命名 1');
    await user.clear(nameInput);
    await user.type(nameInput, '新名字');

    // 未点保存：不发任何请求
    expect(mocks.updateAsyncMock).not.toHaveBeenCalled();
    // 出现显式保存/取消
    expect(screen.getByRole('button', { name: '保存' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '保存' }));
    await waitFor(() =>
      expect(mocks.updateAsyncMock).toHaveBeenCalledWith({ id: 's1', input: { name: '新名字' } }),
    );
  });

  it('Esc 取消改名回退到原值且不发请求', async () => {
    renderPage();
    const user = userEvent.setup();
    const nameInput = screen.getByLabelText('重命名 1');
    await user.clear(nameInput);
    await user.type(nameInput, '新名字');
    await user.keyboard('{Escape}');

    expect(mocks.updateAsyncMock).not.toHaveBeenCalled();
    expect(screen.getByLabelText('重命名 1')).toHaveValue('进行中');
    expect(screen.queryByRole('button', { name: '保存' })).not.toBeInTheDocument();
  });

  it('连续点击 ↑ 时第二次点击被禁用（防连点断言）', async () => {
    let resolveMove!: (v: unknown) => void;
    const pending = new Promise((resolve) => {
      resolveMove = resolve;
    });
    mocks.updateAsyncMock.mockReturnValue(pending);

    renderPage();
    const user = userEvent.setup();
    const upButton = screen.getAllByRole('button', { name: /^上移/ })[1];

    await user.click(upButton);
    // 请求进行中：该行上移按钮被禁用，连点无法发起第二次请求
    expect(upButton).toBeDisabled();

    resolveMove(undefined);
    await act(async () => {});
    expect(screen.getAllByRole('button', { name: /^上移/ })[1]).toBeEnabled();
  });
});

describe('readableTextColor', () => {
  it('浅色背景使用深色文字，深色背景使用浅色文字', () => {
    expect(readableTextColor('#ffffff')).toBe('#000000');
    expect(readableTextColor('#000000')).toBe('#ffffff');
  });
});