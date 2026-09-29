import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { DayDetailPanel } from './DayDetailPanel';
import type { CalendarEvent } from './useCalendarEvents';

function stageDueEvent(partial: Partial<CalendarEvent>): CalendarEvent {
  return {
    key: 'e1',
    kind: 'stage-due',
    date: '2026-09-10',
    taskId: 't1',
    taskTitle: '投递简历',
    statusId: 'status-in-progress',
    color: '#1976d2',
    statusName: '进行中',
    stageId: 'st1',
    stageName: '笔试',
    stageDueDate: '2026-09-10',
    done: false,
    overdue: false,
    currentStageName: null,
    currentStageDueDate: null,
    ...partial,
  };
}

function taskUpdatedEvent(partial: Partial<CalendarEvent>): CalendarEvent {
  return {
    key: 'e2',
    kind: 'task-updated',
    date: '2026-09-10',
    taskId: 't2',
    taskTitle: '整理笔试面经',
    statusId: 'status-in-progress',
    color: '#1976d2',
    statusName: '进行中',
    stageId: null,
    stageName: null,
    stageDueDate: null,
    done: false,
    overdue: false,
    currentStageName: null,
    currentStageDueDate: null,
    ...partial,
  };
}

function renderPanel(events: CalendarEvent[], now = new Date('2026-09-10T00:00:00')) {
  return render(
    <MemoryRouter>
      <DayDetailPanel dateKey="2026-09-10" events={events} onClose={vi.fn()} now={now} />
    </MemoryRouter>,
  );
}

describe('DayDetailPanel', () => {
  it('无事件时显示空态文案', () => {
    renderPanel([]);
    expect(screen.getByText('当日无到期项')).toBeInTheDocument();
  });

  it('有事件时用 ui/Row 渲染任务链接、阶段说明与截止', () => {
    const { container } = renderPanel([stageDueEvent({})]);

    const link = screen.getByRole('link', { name: '查看任务详情：投递简历' });
    expect(link).toHaveAttribute('href', '/tasks/t1');
    expect(screen.getByText('阶段：笔试')).toBeInTheDocument();
    expect(container.querySelector('.ui-row-due')).toHaveTextContent('2026-09-10');
  });

  it('点击关闭按钮触发 onClose', () => {
    const onClose = vi.fn();
    render(
      <MemoryRouter>
        <DayDetailPanel dateKey="2026-09-10" events={[]} onClose={onClose} />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: '关闭' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('逾期事件在截止列显示逾期后缀', () => {
    renderPanel([stageDueEvent({ overdue: true })], new Date('2026-09-11T00:00:00'));
    expect(screen.getByText(/2026-09-10 · 逾期/)).toBeInTheDocument();
  });

  it('阶段与当前阶段不同时在说明行补充当前阶段', () => {
    renderPanel([stageDueEvent({ currentStageName: '一面', currentStageDueDate: '2026-09-20' })]);
    expect(screen.getByText('阶段：笔试 · 当前阶段：一面')).toBeInTheDocument();
  });

  it('面板内行标题与副标题保留完整文本、图形化阶段进度保留（LEOY-128 标题 0 宽修复契约）', () => {
    const { container } = renderPanel([
      stageDueEvent({
        taskTitle: '验证任务1·前端开发',
        stageName: '网申',
        currentStageName: '一面',
      }),
    ]);

    // 标题完整渲染在 .ui-row-title（面板内不再被 6 列网格挤成 0 宽，文本完整保留可读）
    const title = container.querySelector('.ui-row-title');
    expect(title).toBeInTheDocument();
    expect(title).toHaveTextContent('验证任务1·前端开发');

    // 副标题（阶段 / 当前阶段）同样保留完整文本
    const subtitle = container.querySelector('.ui-row-subtitle');
    expect(subtitle).toBeInTheDocument();
    expect(subtitle).toHaveTextContent('阶段：网申 · 当前阶段：一面');

    // 图形化阶段进度段保留（父需求「任务进展图形化展示」已验收能力）
    expect(container.querySelectorAll('[data-testid="row-stage-segment"]')).toHaveLength(1);

    // 低价值分段在面板内隐藏（截止 == 面板标题日期，冗余；chevron 仅装饰）——
    // 元素仍在 DOM，仅由 calendar.css 面板作用域 display:none 收敛。
    expect(container.querySelector('.ui-row-due')).toHaveTextContent('2026-09-10');
    expect(container.querySelector('.ui-row-chevron')).toBeInTheDocument();
  });

  it('task-updated 事件同样用 ui/Row 渲染且标题可读（无阶段 → 进度空占位，LEOY-128）', () => {
    const { container } = renderPanel([taskUpdatedEvent({})]);

    const link = screen.getByRole('link', { name: '查看任务详情：整理笔试面经' });
    expect(link).toHaveAttribute('href', '/tasks/t2');

    // 标题完整渲染在 .ui-row-title（面板内不塌成 0 宽）
    const title = container.querySelector('.ui-row-title');
    expect(title).toHaveTextContent('整理笔试面经');

    // task-updated 无阶段 → 进度列空占位「—」，无阶段进度段
    expect(container.querySelector('.ui-row-progress-empty')).toBeInTheDocument();
    expect(container.querySelectorAll('[data-testid="row-stage-segment"]')).toHaveLength(0);

    // 副标题走「更新于」文案
    expect(container.querySelector('.ui-row-subtitle')).toHaveTextContent('更新于 2026-09-10');
  });
});
