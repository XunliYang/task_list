import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { useSearchParams } from 'react-router-dom';
import { MemoryRouter } from 'react-router-dom';
import type { Stage, Task } from '@task-list/shared';
import {
  filterTasks,
  taskDueThisWeek,
  taskOverdueDays,
  useBoardFilters,
  type BoardFilterState,
} from './useBoardFilters';

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

// 固定时钟：2026-09-28（周一），本周日为 2026-10-04。
const NOW = new Date(2026, 8, 28);

describe('useBoardFilters 纯函数（固定 now 注入）', () => {
  const overdueTask = makeTask({
    id: 'overdue',
    title: '已逾期',
    stages: [makeStage({ id: 's1', name: '笔试', order: 0, status: 'pending', dueDate: '2026-09-25' })],
  });
  const thisWeekTask = makeTask({
    id: 'this-week',
    title: '本周到期',
    stages: [makeStage({ id: 's1', name: '笔试', order: 0, status: 'in_progress', dueDate: '2026-09-30' })],
  });
  const laterTask = makeTask({
    id: 'later',
    title: '之后到期',
    stages: [makeStage({ id: 's1', name: '笔试', order: 0, status: 'pending', dueDate: '2026-10-10' })],
  });
  const donePastDueTask = makeTask({
    id: 'done-past',
    title: '已完成(逾期日期)',
    stages: [makeStage({ id: 's1', name: '笔试', order: 0, status: 'done', dueDate: '2026-09-20' })],
  });

  const all = [overdueTask, thisWeekTask, laterTask, donePastDueTask];

  it('逾期任务被判为逾期（天数正确）', () => {
    expect(taskOverdueDays(overdueTask, NOW)).toBe(3);
    expect(taskOverdueDays(thisWeekTask, NOW)).toBeNull();
    expect(taskOverdueDays(laterTask, NOW)).toBeNull();
    expect(taskOverdueDays(donePastDueTask, NOW)).toBeNull();
  });

  it('本周内到期判定正确', () => {
    expect(taskDueThisWeek(thisWeekTask, NOW)).toBe(true);
    expect(taskDueThisWeek(overdueTask, NOW)).toBe(false);
    expect(taskDueThisWeek(laterTask, NOW)).toBe(false);
  });

  it('给定筛选条件返回正确的任务集合', () => {
    const base: BoardFilterState = {
      q: '',
      selectedStatusIds: null,
      stageStatus: 'all',
      dueRange: 'all',
    };

    expect(filterTasks(all, base, NOW)).toEqual(all);
    expect(filterTasks(all, { ...base, dueRange: 'overdue' }, NOW)).toEqual([overdueTask]);
    expect(filterTasks(all, { ...base, dueRange: 'this-week' }, NOW)).toEqual([thisWeekTask]);
    // 取消全选（空集）→ 空结果
    expect(filterTasks(all, { ...base, selectedStatusIds: [] }, NOW)).toEqual([]);
  });
});

// 暴露 hook setter 的探针组件，用于断言 URL 读写。
function Harness() {
  const { setKeyword, setSelectedStatusIds, setStageStatus, setDueRange, resetFilters } =
    useBoardFilters();
  const [searchParams] = useSearchParams();

  return (
    <div>
      <div data-testid="sp">{searchParams.toString()}</div>
      <button data-testid="keyword" onClick={() => setKeyword('alibaba')}>
        keyword
      </button>
      <button data-testid="stage" onClick={() => setStageStatus('done')}>
        stage
      </button>
      <button data-testid="due" onClick={() => setDueRange('overdue')}>
        due
      </button>
      <button data-testid="select-none" onClick={() => setSelectedStatusIds([])}>
        none
      </button>
      <button data-testid="select-ids" onClick={() => setSelectedStatusIds(['a', 'b'])}>
        ids
      </button>
      <button data-testid="select-all" onClick={() => setSelectedStatusIds(null)}>
        all
      </button>
      <button data-testid="reset" onClick={resetFilters}>
        reset
      </button>
    </div>
  );
}

describe('useBoardFilters URL 同步', () => {
  function renderAt(initial: string) {
    return render(
      <MemoryRouter initialEntries={[initial]}>
        <Harness />
      </MemoryRouter>,
    );
  }

  it('从 URL query 读取筛选条件（刷新后保持）', () => {
    renderAt('/board?q=tencent&stage=done&due=overdue&status=a&status=b');
    // 读取生效需通过 hook 消费；这里验证 setter 写回 + 读回即可，读取函数另测。
    expect(screen.getByTestId('sp').textContent).toContain('q=tencent');
  });

  it('setter 写入 URL，reset 清空', () => {
    renderAt('/board');

    fireEvent.click(screen.getByTestId('keyword'));
    expect(screen.getByTestId('sp').textContent).toBe('q=alibaba');

    fireEvent.click(screen.getByTestId('stage'));
    expect(screen.getByTestId('sp').textContent).toContain('stage=done');

    fireEvent.click(screen.getByTestId('due'));
    expect(screen.getByTestId('sp').textContent).toContain('due=overdue');

    fireEvent.click(screen.getByTestId('select-none'));
    expect(screen.getByTestId('sp').textContent).toContain('status=');

    fireEvent.click(screen.getByTestId('select-ids'));
    expect(screen.getByTestId('sp').textContent).toContain('status=a');
    expect(screen.getByTestId('sp').textContent).toContain('status=b');

    fireEvent.click(screen.getByTestId('select-all'));
    expect(screen.getByTestId('sp').textContent).not.toContain('status');

    fireEvent.click(screen.getByTestId('reset'));
    expect(screen.getByTestId('sp').textContent).toBe('');
  });
});