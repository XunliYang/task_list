import type { CalendarEvent } from './useCalendarEvents';
import { buildWeekGrid, formatShortDate, isSameDay, toDateKey } from './calendar-date';
import { CALENDAR_COPY, WEEKDAY_LABELS } from './calendar-copy';

export interface WeekGridProps {
  /** 所在周的任一天 */
  anchor: Date;
  today: Date;
  eventsByDate: Map<string, CalendarEvent[]>;
  selectedDate: string | null;
  onSelectDate: (dateKey: string) => void;
}

/** 周视图：7 天 × 天无关的列表式布局（一天一列，完整列出当日事件）。 */
export function WeekGrid({ anchor, today, eventsByDate, selectedDate, onSelectDate }: WeekGridProps) {
  const days = buildWeekGrid(anchor);

  return (
    <div className="week-grid" role="grid" aria-label={CALENDAR_COPY.weekView}>
      {days.map((date, index) => {
        const key = toDateKey(date);
        const events = eventsByDate.get(key) ?? [];
        const stageEvents = events.filter((e) => e.kind === 'stage-due');
        const updatedEvents = events.filter((e) => e.kind === 'task-updated');
        const isToday = isSameDay(date, today);
        const isSelected = selectedDate === key;

        return (
          <div
            key={key}
            className={`week-grid__col${isToday ? ' week-grid__col--today' : ''}${
              isSelected ? ' week-grid__col--selected' : ''
            }`}
          >
            <button
              type="button"
              className="week-grid__head"
              onClick={() => onSelectDate(key)}
              aria-label={key}
            >
              <span className="week-grid__weekday">{WEEKDAY_LABELS[index]}</span>
              <span className="week-grid__date">{formatShortDate(date)}</span>
            </button>
            <ul className="week-grid__events">
              {stageEvents.map((e) => (
                <li
                  key={e.key}
                  className={`week-grid__event${e.done ? ' week-grid__event--done' : ''}${
                    e.overdue ? ' week-grid__event--overdue' : ''
                  }`}
                >
                  <span className="week-grid__mark" style={{ backgroundColor: e.color }} aria-hidden />
                  <span className="week-grid__text">
                    {e.taskTitle}·{e.stageName}
                  </span>
                </li>
              ))}
              {updatedEvents.map((e) => (
                <li key={e.key} className="week-grid__event week-grid__event--updated">
                  <span className="week-grid__mark week-grid__mark--dim" style={{ backgroundColor: e.color }} aria-hidden />
                  <span className="week-grid__text">{e.taskTitle}</span>
                </li>
              ))}
              {stageEvents.length + updatedEvents.length === 0 && (
                <li className="week-grid__empty" aria-hidden>
                  —
                </li>
              )}
            </ul>
          </div>
        );
      })}
    </div>
  );
}