import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { Task } from '@task-list/shared';
import { TaskEditDialog } from './TaskEditDialog';

const { mutateMock } = vi.hoisted(() => ({ mutateMock: vi.fn() }));

vi.mock('../../api/tasks', () => ({
  useUpdateTask: () => ({ mutateAsync: mutateMock, isPending: false }),
}));

vi.mock('../../api/statuses', () => ({
  useStatuses: () => ({
    data: [{ id: 's1', name: '进行中', color: '#1976d2', order: 0 }],
    isLoading: false,
  }),
}));

const task: Task = {
  id: 't1',
  title: '投递 ACME',
  company: 'ACME',
  statusId: 's1',
  tags: ['go'],
  stages: [],
  currentStageId: null,
  notes: '',
  createdAt: '',
  updatedAt: '',
};

function renderDialog(onClose = () => {}) {
  const client = new QueryClient();
  return render(
    <QueryClientProvider client={client}>
      <TaskEditDialog task={task} open onClose={onClose} />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  mutateMock.mockReset();
});

describe('TaskEditDialog', () => {
  it('title 置空后保存按钮禁用且不触发请求', async () => {
    renderDialog();
    const user = userEvent.setup();
    const titleInput = screen.getByLabelText('标题');
    await user.clear(titleInput);
    const submit = screen.getByRole('button', { name: '保存' });
    expect(submit).toBeDisabled();
    await user.click(submit);
    expect(mutateMock).not.toHaveBeenCalled();
  });

  it('填写合法后提交调用 mutateAsync 并关闭弹窗', async () => {
    mutateMock.mockResolvedValue(undefined);
    const onClose = vi.fn();
    renderDialog(onClose);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: '保存' }));

    await waitFor(() => expect(mutateMock).toHaveBeenCalledTimes(1));
    expect(mutateMock).toHaveBeenCalledWith({
      title: '投递 ACME',
      company: 'ACME',
      tags: ['go'],
      statusId: 's1',
      notes: '',
    });
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it('提交失败时按钮进入 error 态并展示错误提示', async () => {
    mutateMock.mockRejectedValue(new Error('保存失败：服务器繁忙'));
    renderDialog();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: '保存' }));
    await waitFor(() => expect(screen.getByText('保存失败：服务器繁忙')).toBeInTheDocument());
    expect(screen.getByRole('button', { name: '失败，重试' })).toBeInTheDocument();
  });
});