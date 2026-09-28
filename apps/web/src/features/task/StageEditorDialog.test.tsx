import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { Stage, Task } from '@task-list/shared';
import { StageEditorDialog } from './StageEditorDialog';

const mocks = vi.hoisted(() => ({
  addMock: vi.fn(),
  updateMock: vi.fn(),
  deleteMock: vi.fn(),
  reorderMock: vi.fn(),
}));

vi.mock('../../api/tasks', () => ({
  useAddStage: () => ({ mutate: mocks.addMock, isPending: false }),
  useUpdateStage: () => ({ mutate: mocks.updateMock, isPending: false }),
  useDeleteStage: () => ({ mutate: mocks.deleteMock, isPending: false }),
  useReorderStages: () => ({ mutate: mocks.reorderMock, isPending: false }),
}));

function s(id: string, name: string, order: number): Stage {
  return { id, name, order, status: 'pending', dueDate: null, completedAt: null };
}

const task: Task = {
  id: 't1',
  title: 'T',
  company: null,
  statusId: 's1',
  tags: [],
  stages: [s('a', '笔试', 0), s('b', '一面', 1), s('c', '二面', 2)],
  currentStageId: 'a',
  notes: '',
  createdAt: '',
  updatedAt: '',
};

function renderDialog() {
  const client = new QueryClient();
  return render(
    <QueryClientProvider client={client}>
      <StageEditorDialog task={task} open onClose={() => {}} />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  mocks.addMock.mockReset();
  mocks.updateMock.mockReset();
  mocks.deleteMock.mockReset();
  mocks.reorderMock.mockReset();
});

describe('StageEditorDialog 阶段排序', () => {
  it('首行 ↑ 禁用、末行 ↓ 禁用、中间行可操作', () => {
    renderDialog();
    expect(screen.getByRole('button', { name: '上移阶段 1' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '下移阶段 3' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '下移阶段 1' })).toBeEnabled();
    expect(screen.getByRole('button', { name: '上移阶段 3' })).toBeEnabled();
  });

  it('点击 ↓ 提交交换后的整组顺序', async () => {
    renderDialog();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: '下移阶段 1' }));
    expect(mocks.reorderMock).toHaveBeenCalledWith(['b', 'a', 'c']);
  });

  it('点击 ↑ 提交交换后的整组顺序', async () => {
    renderDialog();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: '上移阶段 2' }));
    expect(mocks.reorderMock).toHaveBeenCalledWith(['b', 'a', 'c']);
  });
});