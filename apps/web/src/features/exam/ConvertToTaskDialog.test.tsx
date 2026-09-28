import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { ApiError } from '../../api/client';
import { ConvertToTaskDialog } from './ConvertToTaskDialog';
import { makeExam, makeTask } from './exam-test-fixtures';

const { mockConvert } = vi.hoisted(() => ({ mockConvert: vi.fn() }));

vi.mock('../../api/exams', () => ({
  useConvertExamToTask: () => ({ mutateAsync: mockConvert, isPending: false }),
}));

vi.mock('../../api/statuses', () => ({
  useStatuses: () => ({
    data: [{ id: 'status-in-progress', name: '进行中', color: '#1976d2', order: 1 }],
    isLoading: false,
  }),
}));

describe('ConvertToTaskDialog', () => {
  it('提交成功后调用 mutation 且展示任务链接', async () => {
    const user = userEvent.setup();
    const exam = makeExam({ id: 'exam-1', title: 'ACME 笔试', company: 'ACME' });
    const task = makeTask({ id: 'task-1', title: 'ACME 笔试' });
    mockConvert.mockResolvedValue({ task, exam: { ...exam, taskId: task.id } });

    render(
      <MemoryRouter>
        <ConvertToTaskDialog exam={exam} open onClose={() => {}} onConverted={() => {}} />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole('button', { name: '确认转任务' }));

    await waitFor(() => expect(mockConvert).toHaveBeenCalledTimes(1));
    expect(mockConvert).toHaveBeenCalledWith({
      statusId: 'status-in-progress',
      stages: [{ name: '准备', dueDate: null }],
    });

    const link = await screen.findByRole('link', { name: '查看任务' });
    expect(link).toHaveAttribute('href', '/tasks/task-1');
  });

  it('已转任务再转 → 显示 409 明确提示', async () => {
    const user = userEvent.setup();
    const exam = makeExam({ id: 'exam-2', title: 'ACME 一面', taskId: 'task-9' });
    mockConvert.mockRejectedValue(
      new ApiError(409, { code: 'already_converted', message: '该考试/面试信息已转为任务' }),
    );

    render(
      <MemoryRouter>
        <ConvertToTaskDialog exam={exam} open onClose={() => {}} onConverted={() => {}} />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole('button', { name: '确认转任务' }));

    await screen.findByText('该考试/面试信息已转为任务，请勿重复操作。');
  });
});