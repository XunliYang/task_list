import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { RecentProgressEntry } from '@task-list/shared';
import { CalendarSidebar, formatRelativeTime } from './CalendarSidebar';
import type { CalendarEvent } from './useCalendarEvents';

vi.mock('../../api/progress', () => ({
  useRecentProgress: vi.fn(),
}));

import { useRecentProgress } from '../../api/progress';

function stageDue(partial: Partial<CalendarEvent>): CalendarEvent {
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

function progress(partial: Partial<RecentProgressEntry>): RecentProgressEntry {
  return {
    id: 'p1',
    taskId: 'b1',
    taskTitle: '任务B',
    at: '2026-09-06T00:00:00Z',
    summary: '完成一面',
    stageId: null,
    ...partial,
  };
}

const mockUseRecentProgress = vi.mocked(useRecentProgress);

function renderSidebar(
  props: Partial<Parameters<typeof CalendarSidebar>[0]> = {},
) {
  const events: CalendarEvent[] = props.events ?? [];
  const now = new Date('2026-09-08T12:00:00');
  return render(
    <MemoryRouter>
      <CalendarSidebar
        events={events}
        eventsByDate={props.eventsByDate ?? new Map()}
        selectedDate={props.selectedDate ?? null}
        onCloseDate={props.onCloseDate ?? vi.fn()}
        now={props.now ?? now}
      />
    </MemoryRouter>,
  );
}

describe('CalendarSidebar 结构', () => {
  it('常显「日程」与「动态」两个区块', () => {
    mockUseRecentProgress.mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
    } as never);
    renderSidebar();

    expect(screen.getByRole('heading', { name: '日程' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '动态' })).toBeInTheDocument();
  });

  it('无迟到与无进展时分别显示空态', () => {
    mockUseRecentProgress.mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
    } as never);
    renderSidebar();

    expect(screen.getByText('近期无到期项')).toBeInTheDocument();
    expect(screen.getByText('暂无进展')).toBeInTheDocument();
  });
});

describe('CalendarSidebar 日程', () => {
  it('逾期置顶在前并带逾期标记，其后为近 7 天待办', () => {
    mockUseRecentProgress.mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
    } as never);
    const overdue = stageDue({
      key: 'ov',
      taskId: 't-ov',
      taskTitle: '逾期任务',
      stageName: '网申',
      date: '2026-08-30',
      overdue: true,
    });
    const upcoming = stageDue({
      key: 'up',
      taskId: 't-up',
      taskTitle: '未来任务',
      stageName: '一面',
      date: '2026-09-10',
    });
    const { container } = renderSidebar({ events: [upcoming, overdue] });

    const items = container.querySelectorAll('.calendar-sidebar__item');
    expect(items).toHaveLength(2);
    // 逾期置顶
    expect(items[0].classList.contains('calendar-sidebar__item--overdue')).toBe(true);
    expect(items[0]).toHaveTextContent('逾期任务');
    expect(items[1]).toHaveTextContent('未来任务');

    // 行内标题/副标题保留文本（LEOY-128）
    expect(items[0].querySelector('.calendar-sidebar__item-title')).toHaveTextContent('逾期任务');
    expect(items[0].querySelector('.calendar-sidebar__item-sub')).toHaveTextContent('逾期');
  });

  it('日程项链接到任务详情', () => {
    mockUseRecentProgress.mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
    } as never);
    renderSidebar({ events: [stageDue({ taskId: 't1', taskTitle: '投递简历' })] });

    const link = screen.getByRole('link', { name: /投递简历/ });
    expect(link).toHaveAttribute('href', '/tasks/t1');
  });

  it('选中日期时聚焦该日（渲染 DayDetailPanel）', () => {
    mockUseRecentProgress.mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
    } as never);
    const ev = stageDue({ taskId: 't1', taskTitle: '投递简历' });
    renderSidebar({
      selectedDate: '2026-09-10',
      eventsByDate: new Map([['2026-09-10', [ev]]]),
    });

    // DayDetailPanel 以日期为标题并含关闭按钮
    expect(screen.getByRole('heading', { name: '2026-09-10' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '关闭' })).toBeInTheDocument();
  });
});

describe('CalendarSidebar 动态', () => {
  it('展示任务名、摘要与相对时间并链接详情', () => {
    mockUseRecentProgress.mockReturnValue({
      data: [progress({})],
      isLoading: false,
      isError: false,
    } as never);
    renderSidebar();

    const link = screen.getByRole('link', { name: /任务B/ });
    expect(link).toHaveAttribute('href', '/tasks/b1');
    expect(screen.getByText(/完成一面/)).toBeInTheDocument();
    expect(screen.getByText(/2 天前/)).toBeInTheDocument();
  });
});

describe('formatRelativeTime', () => {
  const now = new Date('2026-09-10T12:00:00Z');

  it('不足一分钟 → 刚刚', () => {
    expect(formatRelativeTime('2026-09-10T11:59:30Z', now)).toBe('刚刚');
  });

  it('分钟 / 小时 / 天分级', () => {
    expect(formatRelativeTime('2026-09-10T11:55:00Z', now)).toBe('5 分钟前');
    expect(formatRelativeTime('2026-09-10T09:00:00Z', now)).toBe('3 小时前');
    expect(formatRelativeTime('2026-09-08T12:00:00Z', now)).toBe('2 天前');
  });

  it('超 7 天回退为日期', () => {
    expect(formatRelativeTime('2026-08-01T00:00:00Z', now)).toBe('2026-08-01');
  });

  it('非法时间输入回退为日期前缀', () => {
    expect(formatRelativeTime('not-a-date', now)).toBe('not-a-date');
  });
});