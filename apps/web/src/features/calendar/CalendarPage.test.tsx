import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { CalendarPage } from './CalendarPage';

// 隔离数据 hooks：CalendarPage 经 useCalendarEvents 只消费 useTasks/useStatuses。
vi.mock('../../api/tasks', () => ({
  useTasks: () => ({ data: [], isLoading: false, isError: false }),
}));
vi.mock('../../api/statuses', () => ({
  useStatuses: () => ({ data: [], isLoading: false, isError: false }),
}));

function renderPage(now = new Date(2026, 8, 8)) {
  return render(
    <MemoryRouter initialEntries={['/calendar']}>
      <CalendarPage now={now} />
    </MemoryRouter>,
  );
}

describe('CalendarPage 周视图导航', () => {
  it('周视图下点选某天后「下周」标题与网格同步（P1 回归）', () => {
    const { container } = renderPage();

    // 切到周视图
    fireEvent.click(screen.getByRole('button', { name: '周' }));
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('9月7日 – 13日');

    // 点选该周周一，详情面板打开
    fireEvent.click(screen.getByRole('button', { name: '2026-09-07' }));
    expect(screen.getByText('当日无到期项')).toBeInTheDocument();

    // 点「下一周」：标题与网格锚点必须同步前进（旧实现锚定 selectedDate，网格不动）。
    fireEvent.click(screen.getByRole('button', { name: '下一周' }));

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('9月14日 – 20日');
    const firstColDate = container.querySelector('.week-grid__col .week-grid__date')?.textContent;
    expect(firstColDate).toBe('9月14日');
  });

  it('周视图选日后点「下一周」关闭详情面板（P2 回归）', () => {
    const { container } = renderPage();

    fireEvent.click(screen.getByRole('button', { name: '周' }));
    fireEvent.click(screen.getByRole('button', { name: '2026-09-07' }));
    expect(container.querySelector('.day-detail')).not.toBeNull();

    fireEvent.click(screen.getByRole('button', { name: '下一周' }));

    expect(container.querySelector('.day-detail')).toBeNull();
  });

  it('月视图选日后点「下个月」关闭详情面板', () => {
    const { container } = renderPage();

    fireEvent.click(screen.getByRole('button', { name: '2026-09-07' }));
    expect(container.querySelector('.day-detail')).not.toBeNull();

    fireEvent.click(screen.getByRole('button', { name: '下个月' }));

    expect(container.querySelector('.day-detail')).toBeNull();
  });

  it('周视图导航按钮的无障碍文案为「上一周/下一周」', () => {
    renderPage();

    fireEvent.click(screen.getByRole('button', { name: '周' }));
    expect(screen.getByRole('button', { name: '上一周' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '下一周' })).toBeInTheDocument();
  });
});