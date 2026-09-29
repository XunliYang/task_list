import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { Stage, StatusCategory, Task } from '@task-list/shared';
import { TASK_DRAG_TYPE } from './column-drop';
import { TaskRow } from './TaskRow';

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

function renderRow(task: Task, onTaskDrop: (id: string, statusId: string) => void = () => {}) {
  return render(
    <MemoryRouter>
      <ul>
        <TaskRow
          task={task}
          category={categories[0]}
          categories={categories}
          onTaskDrop={onTaskDrop}
          now={new Date(2026, 8, 28)}
        />
      </ul>
    </MemoryRouter>,
  );
}

describe('TaskRow（行式渲染）', () => {
  it('渲染为行（ui/Row）而非卡片：状态点 + 标题/公司/标签 + 进度 n/m + 截止 + ⋯ 菜单', () => {
    const task = makeTask({
      id: 't1',
      title: '投递阿里',
      company: '阿里',
      tags: ['前端', '远程'],
      statusId: 'status-a',
      stages: [
        makeStage({ id: 's1', name: '笔试', order: 0, status: 'done', dueDate: '2026-09-25' }),
        makeStage({ id: 's2', name: '一面', order: 1, status: 'in_progress', dueDate: '2026-10-01' }),
      ],
    });
    renderRow(task);

    // 行而非卡：根是 li（ui-row），不再有卡片外壳结构
    const row = screen.getByTestId('row');
    expect(row.tagName).toBe('LI');
    expect(row).toHaveClass('ui-row');
    expect(screen.queryByTestId('task-card')).not.toBeInTheDocument();
    expect(screen.queryByTestId('overdue-badge')).not.toBeInTheDocument();

    expect(screen.getByRole('img', { name: '进行中' })).toBeInTheDocument();
    expect(screen.getByText('投递阿里')).toBeInTheDocument();
    expect(screen.getByText('阿里')).toBeInTheDocument();
    expect(screen.getByText('前端')).toBeInTheDocument();
    expect(screen.getByText('远程')).toBeInTheDocument();
    expect(screen.getByText('1/2')).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '1');

    // 整行可点进入详情页（Link 到 /tasks/:id）
    expect(screen.getByRole('link', { name: '查看任务详情：投递阿里' })).toHaveAttribute(
      'href',
      '/tasks/t1',
    );

    // 行尾 ⋯「移动到…」菜单（键盘可达替代路径）
    expect(screen.getByRole('button', { name: '移动到…' })).toHaveAttribute(
      'aria-haspopup',
      'menu',
    );
  });

  it('行可拖拽，dragStart 写入私有 MIME 与 text/plain（拖拽源）', () => {
    const task = makeTask({ id: 't1', title: '投递阿里', statusId: 'status-a' });
    renderRow(task);

    const row = screen.getByTestId('row');
    expect(row).toHaveAttribute('draggable', 'true');

    const setData = vi.fn();
    fireEvent.dragStart(row, { dataTransfer: { setData } });
    expect(setData).toHaveBeenCalledWith('text/plain', 't1');
    expect(setData).toHaveBeenCalledWith(TASK_DRAG_TYPE, 't1');
  });

  it('⋯ 菜单选择目标分类触发 onTaskDrop（键盘可达的状态变更）', () => {
    const onTaskDrop = vi.fn();
    const task = makeTask({ id: 't1', title: '投递阿里', statusId: 'status-a' });
    renderRow(task, onTaskDrop);

    fireEvent.click(screen.getByRole('button', { name: '移动到…' }));
    fireEvent.click(screen.getByRole('menuitem', { name: '已完成' }));

    expect(onTaskDrop).toHaveBeenCalledWith('t1', 'status-b');
  });
});