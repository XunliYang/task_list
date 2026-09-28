import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MonthGrid } from './MonthGrid';
import type { CalendarEvent } from './useCalendarEvents';

const NO_EVENTS = new Map<string, CalendarEvent[]>();

describe('MonthGrid 月视图渲染', () => {
  const baseProps = {
    year: 2026,
    month: 8, // 9 月
    today: new Date(2026, 8, 8),
    eventsByDate: NO_EVENTS,
    selectedDate: null as string | null,
    onSelectDate: vi.fn(),
  };

  it('2026-09 第一格是 8/31，最后一格是 10/11', () => {
    const { container } = render(<MonthGrid {...baseProps} />);
    const buttons = container.querySelectorAll<HTMLButtonElement>('.day-cell');
    expect(buttons).toHaveLength(42);

    // 每个单元格以 aria-label 携带其日期键。
    expect(buttons[0].getAttribute('aria-label')).toBe('2026-08-31');
    expect(buttons[41].getAttribute('aria-label')).toBe('2026-10-11');
  });

  it('跨月日期灰化类名存在，且数量 = 42 - 本月天数', () => {
    const { container } = render(<MonthGrid {...baseProps} />);
    const outside = container.querySelectorAll('.day-cell--outside');
    expect(outside.length).toBe(12); // 8/31 一格 + 10/1..10/11 十一格
  });

  it('今天单元格高亮，点击单元格回调正确日期键', () => {
    const onSelectDate = vi.fn();
    render(<MonthGrid {...baseProps} onSelectDate={onSelectDate} />);

    const todayCell = document.querySelector('.day-cell--today');
    expect(todayCell).not.toBeNull();
    expect(todayCell?.getAttribute('aria-label')).toBe('2026-09-08');

    fireEvent.click(screen.getByRole('button', { name: '2026-08-31' }));
    expect(onSelectDate).toHaveBeenCalledWith('2026-08-31');
  });
});