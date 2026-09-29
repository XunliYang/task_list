import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { Stage, StatusCategory, Task } from '@task-list/shared';
import { statusKeys, taskKeys } from '../../api/query-keys';
import { boardCopy } from './board-copy';
import { BoardPage } from './BoardPage';
import { StatusColumn } from './StatusColumn';

const { mutateMock } = vi.hoisted(() => ({ mutateMock: vi.fn() }));

vi.mock('../../api/tasks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../api/tasks')>();
  return {
    ...actual,
    useUpdateTask: vi.fn(() => ({ mutate: mutateMock })),
  };
});

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
  makeTask({ id: 't1', title: '投递阿里', statusId: 'status-a' }),
  makeTask({ id: 't2', title: '已录用字节', statusId: 'status-b' }),
];

function makeDataTransfer(taskId: string) {
  return {
    types: ['application/x-task-id', 'text/plain'],
    effectAllowed: 'move',
    dropEffect: 'move',
    setData: vi.fn(),
    getData: (type: string) =>
      type === 'application/x-task-id' || type === 'text/plain' ? taskId : '',
  };
}

function renderBoard() {
  const queryClient = new QueryClient({
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
  queryClient.setQueryData(statusKeys.lists(), categories);
  queryClient.setQueryData(taskKeys.list({}), tasks);

  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/board']}>
        <Routes>
          <Route path="/board" element={<BoardPage now={new Date(2026, 8, 28)} />} />
          <Route path="/tasks/:id" element={<div>DETAIL_PAGE</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  mutateMock.mockReset();
  mutateMock.mockImplementation(() => {});
});

describe('StatusColumn 拖放', () => {
  it('收到 drop 后以正确的 taskId + statusId 调用回调', () => {
    const onTaskDrop = vi.fn();
    render(
      <StatusColumn
        category={categories[1]}
        tasks={[]}
        categories={categories}
        onTaskDrop={onTaskDrop}
      />,
    );

    const column = screen.getByTestId('status-column');
    const dt = makeDataTransfer('t1');
    fireEvent.dragOver(column, { dataTransfer: dt });
    fireEvent.drop(column, { dataTransfer: dt });

    expect(onTaskDrop).toHaveBeenCalledWith('t1', 'status-b');
  });

  it('drop 到内部任务卡所在列时通过 dragenter 维护高亮态', () => {
    render(
      <StatusColumn
        category={categories[1]}
        tasks={[]}
        categories={categories}
        onTaskDrop={vi.fn()}
      />,
    );

    const column = screen.getByTestId('status-column');
    const dt = makeDataTransfer('t1');
    fireEvent.dragEnter(column, { dataTransfer: dt });
    expect(column).toHaveAttribute('data-drop-target', 'true');
    fireEvent.dragLeave(column, { dataTransfer: dt });
    expect(column).not.toHaveAttribute('data-drop-target');
  });
});

describe('BoardPage 拖拽改状态', () => {
  it('跨列 drop 后以目标列 statusId 触发 mutation', async () => {
    renderBoard();

    const columns = screen.getAllByTestId('status-column');
    fireEvent.drop(columns[1], { dataTransfer: makeDataTransfer('t1') });

    await waitFor(() => {
      expect(mutateMock).toHaveBeenCalledTimes(1);
    });
    expect(mutateMock).toHaveBeenCalledWith(
      { statusId: 'status-b' },
      expect.objectContaining({ onError: expect.any(Function), onSettled: expect.any(Function) }),
    );
  });

  it('拖到自己所在列不触发 mutation（同列忽略）', async () => {
    renderBoard();

    const columns = screen.getAllByTestId('status-column');
    fireEvent.drop(columns[0], { dataTransfer: makeDataTransfer('t1') });

    // t1 已在 status-a，drop 到 status-a 不应发请求。
    await waitFor(() => {
      expect(screen.getAllByTestId('status-column')).toHaveLength(2);
    });
    expect(mutateMock).not.toHaveBeenCalled();
  });

  it('mutation 失败时卡片回到原列并显示错误提示（乐观回滚）', async () => {
    mutateMock.mockImplementation((_input, opts: { onError?: (e: Error) => void }) => {
      opts?.onError?.(new Error('boom'));
    });
    renderBoard();

    const columns = screen.getAllByTestId('status-column');
    fireEvent.drop(columns[1], { dataTransfer: makeDataTransfer('t1') });

    await waitFor(() => {
      expect(mutateMock).toHaveBeenCalledTimes(1);
    });

    const statusACol = screen.getAllByTestId('status-column')[0];
    const statusBCol = screen.getAllByTestId('status-column')[1];
    expect(within(statusACol).getByText('投递阿里')).toBeInTheDocument();
    expect(within(statusBCol).queryByText('投递阿里')).not.toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent(boardCopy.moveError);
  });

  it('拖拽后紧跟的 click 不触发路由跳转（防误触）', () => {
    renderBoard();

    const title = screen.getByText('投递阿里');
    const card = title.closest('[data-testid="row"]') as HTMLElement;
    const link = within(card).getByRole('link', { name: '查看任务详情：投递阿里' });

    const dt = makeDataTransfer('t1');
    fireEvent.dragStart(card, { dataTransfer: dt });
    fireEvent.dragEnd(card, { dataTransfer: dt });
    fireEvent.click(link);

    expect(screen.queryByText('DETAIL_PAGE')).not.toBeInTheDocument();
  });

  it('未拖拽时整卡点击正常进入详情（回归）', () => {
    renderBoard();

    const title = screen.getByText('投递阿里');
    const card = title.closest('[data-testid="row"]') as HTMLElement;
    const link = within(card).getByRole('link', { name: '查看任务详情：投递阿里' });

    fireEvent.click(link);

    expect(screen.getByText('DETAIL_PAGE')).toBeInTheDocument();
  });
});