import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { Task } from '@task-list/shared';
import { ProgressComposer } from './ProgressComposer';

const { mutateMock } = vi.hoisted(() => ({ mutateMock: vi.fn() }));

vi.mock('../../api/tasks', () => ({
  useAddProgress: () => ({ mutateAsync: mutateMock, isPending: false }),
}));

const task: Task = {
  id: 't1',
  title: 'T',
  company: null,
  statusId: 's1',
  tags: [],
  stages: [
    { id: 'st1', name: '笔试', order: 0, status: 'in_progress', dueDate: null, completedAt: null },
  ],
  currentStageId: 'st1',
  notes: '',
  createdAt: '',
  updatedAt: '',
};

function renderComposer() {
  const client = new QueryClient();
  return render(
    <QueryClientProvider client={client}>
      <ProgressComposer task={task} />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  mutateMock.mockReset();
});

describe('ProgressComposer', () => {
  it('内容为空时提交按钮禁用', () => {
    renderComposer();
    expect(screen.getByRole('button', { name: '记录进展' })).toBeDisabled();
  });

  it('输入内容后提交调用 mutation，且成功后输入被清空', async () => {
    mutateMock.mockResolvedValue(undefined);
    renderComposer();
    const user = userEvent.setup();
    const textarea = screen.getByLabelText('进展内容');
    await user.type(textarea, '通过笔试，进入一面');
    const button = screen.getByRole('button', { name: '记录进展' });
    expect(button).toBeEnabled();
    await user.click(button);
    expect(mutateMock).toHaveBeenCalledWith({
      summary: '通过笔试，进入一面',
      stageId: 'st1',
    });
    await waitFor(() => expect(textarea).toHaveValue(''));
  });

  it('提交失败时按钮进入 error 态并展示错误提示', async () => {
    mutateMock.mockRejectedValue(new Error('后端失败'));
    renderComposer();
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('进展内容'), '进展内容');
    await user.click(screen.getByRole('button', { name: '记录进展' }));
    await waitFor(() => expect(screen.getByText('后端失败')).toBeInTheDocument());
    expect(screen.getByRole('button', { name: '失败，重试' })).toBeInTheDocument();
  });
});