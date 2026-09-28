import type { CalendarEvent } from './useCalendarEvents';
import { buildMonthGrid, isSameMonth, toDateKey } from './calendar-date';
import { DayCell } from './DayCell';
import { CALENDAR_COPY, WEEKDAY_LABELS } from './calendar-copy';

export interface MonthGridProps {
  year: number;
  /** 0-11 */
  month: number;
  today: Date;
  eventsByDate: Map<string, CalendarEvent[]>;
  selectedDate: string | null;
  onSelectDate: (dateKey: string) => void;
}

export function MonthGrid({
  year,
  month,
  today,
  eventsByDate,
  selectedDate,
  onSelectDate,
}: MonthGridProps) {
  const cells = buildMonthGrid(year, month);

  return (
    <div className="calendar-grid" role="grid" aria-label={CALENDAR_COPY.monthTitle(year, month)}>
      <div className="calendar-grid__weekdays" role="row">
        {WEEKDAY_LABELS.map((label) => (
          <div key={label} className="calendar-grid__weekday" role="columnheader">
            {label}
          </div>
        ))}
      </div>
      <div className="calendar-grid__cells">
        {cells.map((date) => {
          const key = toDateKey(date);
          return (
            <DayCell
              key={key}
              date={date}
              inCurrentMonth={isSameMonth(date, year, month)}
              today={today}
              events={eventsByDate.get(key) ?? []}
              selected={selectedDate === key}
              onSelect={onSelectDate}
            />
          );
        })}
      </div>
    </div>
  );
}