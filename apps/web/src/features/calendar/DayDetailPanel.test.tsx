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
});
