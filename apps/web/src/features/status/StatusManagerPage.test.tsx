import { describe, expect, it, vi, beforeEach } from 'vitest';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { StatusCategory, Task } from '@task-list/shared';
import { ApiError } from '../../api/client';
import { statusKeys, taskKeys } from '../../api/query-keys';
import { StatusManagerPage } from './StatusManagerPage';
import { STATUS_DRAG_TYPE } from './status-order';
import { readableTextColor } from '../task/task-utils';

const { updateAsyncMock, deleteMock } = vi.hoisted(() => ({
  updateAsyncMock: vi.fn(),
  deleteMock: vi.fn(),
}));

// 保留真实 useStatuses / useCreateStatus（走 query cache，不发网络），
// 仅替换 useUpdateStatus / useDeleteStatus 以便捕获 mutation 调用。
vi.mock('../../api/statuses', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../api/statuses')>();
  return {
    ...actual,
    useUpdateStatus: () => ({
      mutate: updateAsyncMock,
      mutateAsync: updateAsyncMock,
      isPending: false,
    }),
    useDeleteStatus: () => ({ mutate: deleteMock, isPending: false }),
  };
});

const STATUSES: StatusCategory[] = [
  { id: 's1', name: '进行中', color: '#1976d2', order: 0 },
  { id: 's2', name: '已完成', color: '#388e3c', order: 1 },
  { id: 's3', name: '已挂', color: '#f57c00', order: 2 },
];

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 't1',
    title: '任务',
    company: null,
    statusId: 's1',
    tags: [],
    stages: [],
    currentStageId: null,
    notes: '',
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
    ...overrides,
  };
}

const TASKS: Task[] = [
  makeTask({ id: 't1', statusId: 's1' }),
  makeTask({ id: 't2', statusId: 's1' }),
  makeTask({ id: 't3', statusId: 's1' }),
];

function renderPage() {
  const client = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        refetchOnMount: false,
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
        staleTime: Infinity,
      },
    },
  });
  client.setQueryData(statusKeys.lists(), STATUSES);
  client.setQueryData(taskKeys.list({}), TASKS);
  return render(
    <QueryClientProvider client={client}>
      <StatusManagerPage />
    </QueryClientProvider>,
  );
}

function makeStatusDragTransfer(id: string, types: string[] = [STATUS_DRAG_TYPE, 'text/plain']) {
  return {
    types,
    effectAllowed: 'move',
    dropEffect: 'move',
    setData: vi.fn(),
    getData: (type: string) =>
      type === STATUS_DRAG_TYPE || type === 'text/plain' ? id : '',
  };
}

function rowOrder(): string[] {
  return screen
    .getAllByTestId('status-row')
    .map((r) => r.getAttribute('data-status-id') ?? '');
}

beforeEach(() => {
  updateAsyncMock.mockReset();
  deleteMock.mockReset();
  updateAsyncMock.mockResolvedValue(undefined);
});

describe('StatusManagerPage', () => {
  it('删除被引用分类返回 409 时展示「还有 N 个任务」提示', async () => {
    deleteMock.mockImplementation(
      (_id: unknown, opts?: { onError?: (err: unknown) => void }) => {
        opts?.onError?.(
          new ApiError(409, {
            code: 'status_in_use',
            message: '该分类下还有 3 个任务，请先移动',
          }),
        );
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

    expect(updateAsyncMock).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: '保存' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '保存' }));
    await waitFor(() =>
      expect(updateAsyncMock).toHaveBeenCalledWith({ id: 's1', input: { name: '新名字' } }),
    );
  });

  it('Esc 取消改名回退到原值且不发请求', async () => {
    renderPage();
    const user = userEvent.setup();
    const nameInput = screen.getByLabelText('重命名 1');
    await user.clear(nameInput);
    await user.type(nameInput, '新名字');
    await user.keyboard('{Escape}');

    expect(updateAsyncMock).not.toHaveBeenCalled();
    expect(screen.getByLabelText('重命名 1')).toHaveValue('进行中');
    expect(screen.queryByRole('button', { name: '保存' })).not.toBeInTheDocument();
  });

  it('连续点击 ↑ 时第二次点击被禁用（防连点断言）', async () => {
    let resolveMove!: (v: unknown) => void;
    const pending = new Promise((resolve) => {
      resolveMove = resolve;
    });
    updateAsyncMock.mockReturnValue(pending);

    renderPage();
    const user = userEvent.setup();
    const upButton = screen.getAllByRole('button', { name: /^上移/ })[1];

    await user.click(upButton);
    expect(upButton).toBeDisabled();

    resolveMove(undefined);
    await act(async () => {});
    expect(screen.getAllByRole('button', { name: /^上移/ })[1]).toBeEnabled();
  });
});

describe('StatusManagerPage 拖拽调序', () => {
  it('拖第 3 行到第 1 行：UI 顺序变化且按新顺序批量 PATCH', async () => {
    renderPage();
    expect(rowOrder()).toEqual(['s1', 's2', 's3']);

    const rows = screen.getAllByTestId('status-row');
    const dt = () => makeStatusDragTransfer('s3');
    fireEvent.dragStart(rows[2], { dataTransfer: dt() });
    fireEvent.dragEnter(rows[0], { dataTransfer: dt() });
    fireEvent.dragOver(rows[0], { dataTransfer: dt() });
    fireEvent.drop(rows[0], { dataTransfer: dt(), clientY: 0 });

    await waitFor(() => expect(rowOrder()).toEqual(['s3', 's1', 's2']));

    expect(updateAsyncMock).toHaveBeenCalledTimes(3);
    expect(updateAsyncMock).toHaveBeenCalledWith({ id: 's3', input: { order: 0 } });
    expect(updateAsyncMock).toHaveBeenCalledWith({ id: 's1', input: { order: 1 } });
    expect(updateAsyncMock).toHaveBeenCalledWith({ id: 's2', input: { order: 2 } });
  });

  it('拖拽过程中悬停目标行有高亮（data-drop-target）', () => {
    renderPage();
    const rows = screen.getAllByTestId('status-row');
    const dt = () => makeStatusDragTransfer('s3');
    fireEvent.dragStart(rows[2], { dataTransfer: dt() });
    fireEvent.dragEnter(rows[0], { dataTransfer: dt() });

    expect(rows[0]).toHaveAttribute('data-drop-target', 'true');
    fireEvent.dragLeave(rows[0], { dataTransfer: dt() });
    expect(rows[0]).not.toHaveAttribute('data-drop-target');
  });

  it('外部文件拖入（无私有 MIME）不触发重排', () => {
    renderPage();
    const rows = screen.getAllByTestId('status-row');
    const dt = makeStatusDragTransfer('s3', ['Files']);
    fireEvent.dragEnter(rows[0], { dataTransfer: dt });
    fireEvent.dragOver(rows[0], { dataTransfer: dt });
    fireEvent.drop(rows[0], { dataTransfer: dt });

    expect(updateAsyncMock).not.toHaveBeenCalled();
  });

  it('拖拽结束后紧随的 click 不误触发删除', () => {
    renderPage();
    const rows = screen.getAllByTestId('status-row');
    const deleteBtn = within(rows[0]).getByRole('button', { name: /^删除/ });

    const dt = makeStatusDragTransfer('s1');
    fireEvent.dragStart(rows[0], { dataTransfer: dt });
    fireEvent.dragEnd(rows[0], { dataTransfer: dt });
    fireEvent.click(deleteBtn);

    expect(deleteMock).not.toHaveBeenCalled();
  });
});

describe('readableTextColor', () => {
  it('浅色背景使用深色文字，深色背景使用浅色文字', () => {
    expect(readableTextColor('#ffffff')).toBe('#000000');
    expect(readableTextColor('#000000')).toBe('#ffffff');
  });
});