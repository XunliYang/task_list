import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button } from '../../ui';
import { useCalendarEvents } from './useCalendarEvents';
import { MonthGrid } from './MonthGrid';
import { WeekGrid } from './WeekGrid';
import { DayDetailPanel } from './DayDetailPanel';
import { addDays, addMonths, formatWeekRange, toYearMonth } from './calendar-date';
import { CALENDAR_COPY } from './calendar-copy';
import './calendar.css';

type ViewMode = 'month' | 'week';

const YM_RE = /^(\d{4})-(0[1-9]|1[0-2])$/;

export interface CalendarPageProps {
  /** 注入的「今天」（测试用），缺省真实当前时间。 */
  now?: Date;
}

export function CalendarPage({ now }: CalendarPageProps = {}) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [view, setView] = useState<ViewMode>('month');
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const today = useMemo(() => now ?? new Date(), [now]);

  // 初始光标注：?ym=YYYY-MM 存在则定位到该月，否则定位到今天。
  const [cursor, setCursor] = useState<Date>(() => {
    const ym = searchParams.get('ym');
    const m = ym ? YM_RE.exec(ym) : null;
    if (m) return new Date(Number(m[1]), Number(m[2]) - 1, 1);
    return now ?? new Date();
  });

  const { eventsByDate, isLoading, isError } = useCalendarEvents({ now: today });

  const moveCursor = (next: Date) => {
    setCursor(next);
    setSelectedDate(null);
    setSearchParams({ ym: toYearMonth(next) }, { replace: true });
  };

  const handlePrev = () =>
    moveCursor(view === 'month' ? addMonths(cursor, -1) : addDays(cursor, -7));
  const handleNext = () =>
    moveCursor(view === 'month' ? addMonths(cursor, 1) : addDays(cursor, 7));
  const handleToday = () => moveCursor(today);

  const title =
    view === 'month'
      ? CALENDAR_COPY.monthTitle(cursor.getFullYear(), cursor.getMonth())
      : formatWeekRange(cursor);

  const grid =
    view === 'month' ? (
      <MonthGrid
        year={cursor.getFullYear()}
        month={cursor.getMonth()}
        today={today}
        eventsByDate={eventsByDate}
        selectedDate={selectedDate}
        onSelectDate={setSelectedDate}
      />
    ) : (
      <WeekGrid
        anchor={cursor}
        today={today}
        eventsByDate={eventsByDate}
        selectedDate={selectedDate}
        onSelectDate={setSelectedDate}
      />
    );

  return (
    <div className="calendar-page">
      <header className="calendar-page__header">
        <div className="calendar-page__title-group">
          <Button
            variant="ghost"
            onClick={handlePrev}
            aria-label={view === 'month' ? CALENDAR_COPY.prev : CALENDAR_COPY.prevWeek}
          >
            《
          </Button>
          <h1 className="calendar-page__title">{title}</h1>
          <Button
            variant="ghost"
            onClick={handleNext}
            aria-label={view === 'month' ? CALENDAR_COPY.next : CALENDAR_COPY.nextWeek}
          >
            》
          </Button>
        </div>

        <div className="calendar-page__actions">
          <Button variant="secondary" onClick={handleToday}>
            {CALENDAR_COPY.today}
          </Button>
          <div
            className="calendar-page__view-toggle"
            role="group"
            aria-label={CALENDAR_COPY.viewToggle}
          >
            <Button
              variant={view === 'month' ? 'primary' : 'secondary'}
              aria-pressed={view === 'month'}
              onClick={() => setView('month')}
            >
              {CALENDAR_COPY.monthView}
            </Button>
            <Button
              variant={view === 'week' ? 'primary' : 'secondary'}
              aria-pressed={view === 'week'}
              onClick={() => setView('week')}
            >
              {CALENDAR_COPY.weekView}
            </Button>
          </div>
        </div>
      </header>

      {isLoading && <p className="calendar-page__status">{CALENDAR_COPY.loading}</p>}
      {isError && <p className="calendar-page__status">{CALENDAR_COPY.error}</p>}

      <div className="calendar-page__body">
        <div className="calendar-page__grid">{grid}</div>
        {selectedDate && (
          <DayDetailPanel
            dateKey={selectedDate}
            events={eventsByDate.get(selectedDate) ?? []}
            onClose={() => setSelectedDate(null)}
            now={today}
          />
        )}
      </div>
    </div>
  );
}