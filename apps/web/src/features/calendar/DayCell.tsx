import type { CalendarEvent } from './useCalendarEvents';
import { isSameDay, toDateKey } from './calendar-date';
import { CALENDAR_COPY } from './calendar-copy';

/** 单元格内最多展示的阶段级事件条数，超出显示「+N」。 */
export const MAX_VISIBLE_EVENTS = 3;

export interface DayCellProps {
  date: Date;
  /** 是否属于当前显示月（跨月日期灰化） */
  inCurrentMonth: boolean;
  today: Date;
  /** 已排序的事件 */
  events: CalendarEvent[];
  selected: boolean;
  onSelect: (dateKey: string) => void;
}

export function DayCell({
  date,
  inCurrentMonth,
  today,
  events,
  selected,
  onSelect,
}: DayCellProps) {
  const dateKey = toDateKey(date);
  const stageEvents = events.filter((e) => e.kind === 'stage-due');
  const updatedEvents = events.filter((e) => e.kind === 'task-updated');
  const overdueCount = stageEvents.filter((e) => e.overdue).length;
  const visible = stageEvents.slice(0, MAX_VISIBLE_EVENTS);
  const hiddenCount = stageEvents.length - visible.length;
  const isToday = isSameDay(date, today);

  const className = [
    'day-cell',
    !inCurrentMonth ? 'day-cell--outside' : '',
    isToday ? 'day-cell--today' : '',
    selected ? 'day-cell--selected' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button
      type="button"
      className={className}
      onClick={() => onSelect(dateKey)}
      aria-label={dateKey}
    >
      <div className="day-cell__header">
        <span className="day-cell__num">{date.getDate()}</span>
        {overdueCount > 0 && (
          <span
            className="day-cell__overdue"
            title={CALENDAR_COPY.overdueBadge(overdueCount)}
            aria-label={CALENDAR_COPY.overdueBadge(overdueCount)}
          >
            {overdueCount}
          </span>
        )}
      </div>

      <ul className="day-cell__events">
        {visible.map((e) => (
          <li
            key={e.key}
            className={`day-cell__event${e.done ? ' day-cell__event--done' : ''}${
              e.overdue ? ' day-cell__event--overdue' : ''
            }`}
          >
            <span className="day-cell__dot-mark" style={{ backgroundColor: e.color }} aria-hidden />
            <span className="day-cell__event-text">
              {e.taskTitle}·{e.stageName}
            </span>
          </li>
        ))}
      </ul>

      {hiddenCount > 0 && <div className="day-cell__more">{CALENDAR_COPY.more(hiddenCount)}</div>}

      {updatedEvents.length > 0 && (
        <div className="day-cell__updated" title={CALENDAR_COPY.taskUpdatedLegend}>
          {updatedEvents.map((e) => (
            <span
              key={e.key}
              className="day-cell__dot"
              style={{ backgroundColor: e.color }}
              aria-label={CALENDAR_COPY.taskUpdatedLegend}
            />
          ))}
        </div>
      )}
    </button>
  );
}