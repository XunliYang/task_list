import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { Task } from '@task-list/shared';
import { TaskEditDialog } from './TaskEditDialog';

const { mutateMock } = vi.hoisted(() => ({ mutateMock: vi.fn() }));

vi.mock('../../api/tasks', () => ({
  useUpdateTask: () => ({ mutate: mutateMock, isPending: false }),
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

function renderDialog() {
  const client = new QueryClient();
  return render(
    <QueryClientProvider client={client}>
      <TaskEditDialog task={task} open onClose={() => {}} />
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
});