import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ApiError } from '../../api/client';
import { StatusManagerPage, readableTextColor } from './StatusManagerPage';

const mocks = vi.hoisted(() => ({
  deleteMock: vi.fn(),
  createMock: vi.fn(),
  updateMock: vi.fn(),
}));

vi.mock('../../api/statuses', () => ({
  useStatuses: () => ({
    data: [
      { id: 's1', name: '进行中', color: '#1976d2', order: 0 },
      { id: 's2', name: '已完成', color: '#388e3c', order: 1 },
    ],
    isLoading: false,
  }),
  useCreateStatus: () => ({ mutate: mocks.createMock, isPending: false }),
  useUpdateStatus: () => ({ mutate: mocks.updateMock, isPending: false }),
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
});

describe('readableTextColor', () => {
  it('浅色背景使用深色文字，深色背景使用浅色文字', () => {
    expect(readableTextColor('#ffffff')).toBe('#000000');
    expect(readableTextColor('#000000')).toBe('#ffffff');
  });
});