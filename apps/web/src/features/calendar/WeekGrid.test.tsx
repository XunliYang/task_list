import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { WeekGrid } from './WeekGrid';
import type { CalendarEvent } from './useCalendarEvents';

const NO_EVENTS = new Map<string, CalendarEvent[]>();

describe('WeekGrid 周视图', () => {
  const baseProps = {
    anchor: new Date(2026, 8, 8), // 2026-09-08 周二
    today: new Date(2026, 8, 8),
    eventsByDate: NO_EVENTS,
    selectedDate: null as string | null,
    onSelectDate: vi.fn(),
  };

  it('渲染 7 列，周一起始，首列日期正确', () => {
    const { container } = render(<WeekGrid {...baseProps} />);
    const cols = container.querySelectorAll('.week-grid__col');
    expect(cols).toHaveLength(7);
    expect(cols[0].querySelector('.week-grid__date')?.textContent).toBe('9月7日');
    expect(cols[6].querySelector('.week-grid__date')?.textContent).toBe('9月13日');
  });

  it('点击某天头部触发 onSelectDate 并回传日期键', () => {
    const onSelectDate = vi.fn();
    render(<WeekGrid {...baseProps} onSelectDate={onSelectDate} />);

    fireEvent.click(screen.getByRole('button', { name: '2026-09-10' }));
    expect(onSelectDate).toHaveBeenCalledWith('2026-09-10');
  });
});