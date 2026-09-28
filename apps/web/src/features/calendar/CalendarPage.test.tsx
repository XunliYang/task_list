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

/** 以指定 URL 挂载页面（如 /calendar?ym=2026-09），并返回 container 供网格列头取证。 */
function renderPageAt(initialEntries = ['/calendar?ym=2026-09'], now = new Date(2026, 8, 28)) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <CalendarPage now={now} />
    </MemoryRouter>,
  );
}

/** 取周网格第一列「M月D日」文本，用于与标题比对是否同周。 */
function firstWeekColDate(container: HTMLElement): string | undefined {
  return container.querySelector('.week-grid__col .week-grid__date')?.textContent ?? undefined;
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

  it('周视图导航按钮的无障碍文案为「上一周/下一周」', () => {
    renderPage();

    fireEvent.click(screen.getByRole('button', { name: '周' }));
    expect(screen.getByRole('button', { name: '上一周' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '下一周' })).toBeInTheDocument();
  });
});

describe('CalendarPage 月→周切换与「今天」同步（LEOY-96 精确复现）', () => {
  it('月视图点选 9/13 后切周：标题与网格同周，不再锚定选中日', () => {
    const { container } = renderPageAt();

    // 月视图点选 9/13（selectedDate 被置值，详情面板打开）
    fireEvent.click(screen.getByRole('button', { name: /2026-09-13/ }));
    expect(screen.getByText('当日无到期项')).toBeInTheDocument();

    // 切到周视图：标题与网格首列必须是同一周（cursor 9/1 → 8月31日–9月6日），
    // 而不是选中日 9/13 所在的 9月7日–9月13日。
    fireEvent.click(screen.getByRole('button', { name: '周' }));

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('8月31日 – 9月6日');
    expect(firstWeekColDate(container)).toBe('8月31日');
  });

  it('周视图点「今天」回到包含今天的周，标题与网格同步', () => {
    const { container } = renderPageAt();

    // 先制造「选中日 ≠ cursor 周」的旧失效路径：月视图点选 9/13 再切周。
    fireEvent.click(screen.getByRole('button', { name: /2026-09-13/ }));
    fireEvent.click(screen.getByRole('button', { name: '周' }));

    // 点「今天」：cursor=today(9/28)，标题与网格必须同步到 9月28日–10月4日。
    fireEvent.click(screen.getByRole('button', { name: '今天' }));

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('9月28日 – 10月4日');
    expect(firstWeekColDate(container)).toBe('9月28日');
  });

  it('周视图点「上一周」后标题与网格同步回退', () => {
    const { container } = renderPageAt();

    // 月视图点选 9/13 后切周（标题 8月31日–9月6日），再点「上一周」。
    fireEvent.click(screen.getByRole('button', { name: /2026-09-13/ }));
    fireEvent.click(screen.getByRole('button', { name: '周' }));
    fireEvent.click(screen.getByRole('button', { name: '上一周' }));

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('8月24日 – 30日');
    expect(firstWeekColDate(container)).toBe('8月24日');
  });
});