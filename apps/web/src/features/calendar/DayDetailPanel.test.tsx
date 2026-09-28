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

describe('DayDetailPanel', () => {
  it('无事件时显示空态文案', () => {
    render(
      <MemoryRouter>
        <DayDetailPanel dateKey="2026-09-10" events={[]} onClose={vi.fn()} />
      </MemoryRouter>,
    );
    expect(screen.getByText('当日无到期项')).toBeInTheDocument();
  });

  it('有事件时渲染任务链接与阶段/截止信息', () => {
    render(
      <MemoryRouter>
        <DayDetailPanel
          dateKey="2026-09-10"
          events={[stageDueEvent({})]}
          onClose={vi.fn()}
        />
      </MemoryRouter>,
    );

    const link = screen.getByRole('link', { name: '投递简历' });
    expect(link).toHaveAttribute('href', '/tasks/t1');
    expect(screen.getByText('阶段：笔试')).toBeInTheDocument();
    expect(screen.getByText('截止：2026-09-10')).toBeInTheDocument();
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

  it('逾期事件显示「已逾期」标记', () => {
    render(
      <MemoryRouter>
        <DayDetailPanel
          dateKey="2026-09-10"
          events={[stageDueEvent({ overdue: true })]}
          onClose={vi.fn()}
        />
      </MemoryRouter>,
    );
    expect(screen.getByText('已逾期')).toBeInTheDocument();
  });
});