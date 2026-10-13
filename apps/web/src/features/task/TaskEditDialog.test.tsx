import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { JobApplication, Task } from '@task-list/shared';
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

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 't1',
    title: '投递 ACME',
    company: 'ACME',
    statusId: 's1',
    tags: ['go'],
    stages: [],
    currentStageId: null,
    notes: '',
    jobApplication: null,
    createdAt: '',
    updatedAt: '',
    ...overrides,
  };
}

function renderDialog(task: Task, onClose: () => void = () => {}) {
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
    renderDialog(makeTask());
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
    renderDialog(makeTask(), onClose);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: '保存' }));

    await waitFor(() => expect(mutateMock).toHaveBeenCalledTimes(1));
    expect(mutateMock).toHaveBeenCalledWith({
      title: '投递 ACME',
      company: 'ACME',
      tags: ['go'],
      statusId: 's1',
      notes: '',
      jobApplication: null,
    });
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it('提交失败时按钮进入 error 态并展示错误提示', async () => {
    mutateMock.mockRejectedValue(new Error('保存失败：服务器繁忙'));
    renderDialog(makeTask());
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: '保存' }));
    await waitFor(() => expect(screen.getByText('保存失败：服务器繁忙')).toBeInTheDocument());
    expect(screen.getByRole('button', { name: '失败，重试' })).toBeInTheDocument();
  });

  it('既有求职信息时默认展开并回填各字段', () => {
    const jobApplication: JobApplication = {
      position: '后端工程师',
      announcementUrl: 'https://a.example.com/announce',
      resumeUrl: null,
      applyUrl: 'https://app.example.com/apply',
      requirements: '熟悉 Go',
    };
    renderDialog(makeTask({ jobApplication }));

    expect(screen.getByLabelText('投递岗位')).toHaveValue('后端工程师');
    expect(screen.getByLabelText('公告链接')).toHaveValue('https://a.example.com/announce');
    expect(screen.getByLabelText('简历链接')).toHaveValue('');
    expect(screen.getByLabelText('投递链接')).toHaveValue('https://app.example.com/apply');
    expect(screen.getByLabelText('投递要求')).toHaveValue('熟悉 Go');
  });

  it('编辑清空求职信息后提交，jobApplication 归为 null', async () => {
    mutateMock.mockResolvedValue(undefined);
    const jobApplication: JobApplication = {
      position: '后端工程师',
      announcementUrl: 'https://a.example.com/announce',
      resumeUrl: 'https://r.example.com/resume.pdf',
      applyUrl: 'https://app.example.com/apply',
      requirements: '熟悉 Go',
    };
    renderDialog(makeTask({ jobApplication }));
    const user = userEvent.setup();

    await user.clear(screen.getByLabelText('投递岗位'));
    await user.clear(screen.getByLabelText('公告链接'));
    await user.clear(screen.getByLabelText('简历链接'));
    await user.clear(screen.getByLabelText('投递链接'));
    await user.clear(screen.getByLabelText('投递要求'));

    await user.click(screen.getByRole('button', { name: '保存' }));
    await waitFor(() => expect(mutateMock).toHaveBeenCalledTimes(1));
    expect(mutateMock.mock.calls[0][0].jobApplication).toBeNull();
  });

  it('编辑时填入非法 URL 阻止提交并给出提示', async () => {
    renderDialog(makeTask());
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: '求职信息' }));
    await user.type(screen.getByLabelText('公告链接'), 'bad url');
    expect(screen.getByText('公告链接不是有效链接')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '保存' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: '保存' }));
    expect(mutateMock).not.toHaveBeenCalled();
  });
});