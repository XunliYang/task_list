import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AppShell } from './AppShell';

function renderShell(initialPath: string) {
  render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/" element={<AppShell />}>
          <Route index element={<div>home</div>} />
          <Route path="board" element={<div>board</div>} />
          <Route path="tasks/:id" element={<div>detail</div>} />
          <Route path="calendar" element={<div>calendar</div>} />
          <Route path="statuses" element={<div>statuses</div>} />
          <Route path="exams" element={<div>exams</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

function activeLabel(): string | null {
  const link = screen.queryByRole('link', { current: 'page' });
  return link ? link.textContent : null;
}

describe('AppShell 导航', () => {
  it('渲染出 5 个导航链接', () => {
    renderShell('/');
    expect(screen.getAllByRole('link')).toHaveLength(5);
    for (const label of ['首页', '看板', '日历', '状态管理', '考试信息']) {
      expect(screen.getByRole('link', { name: label })).toBeInTheDocument();
    }
  });

  it('根路径高亮「首页」', () => {
    renderShell('/');
    expect(activeLabel()).toBe('首页');
  });

  it('看板路径高亮「看板」', () => {
    renderShell('/board');
    expect(activeLabel()).toBe('看板');
  });

  it('任务详情路径同样高亮「看板」', () => {
    renderShell('/tasks/t1');
    expect(activeLabel()).toBe('看板');
  });

  it('其余页面各自高亮对应入口', () => {
    const cases: Array<[string, string]> = [
      ['/calendar', '日历'],
      ['/statuses', '状态管理'],
      ['/exams', '考试信息'],
    ];
    for (const [path, label] of cases) {
      const { unmount } = render(
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route path="/" element={<AppShell />}>
              <Route index element={<div>home</div>} />
              <Route path="board" element={<div>board</div>} />
              <Route path="tasks/:id" element={<div>detail</div>} />
              <Route path="calendar" element={<div>calendar</div>} />
              <Route path="statuses" element={<div>statuses</div>} />
              <Route path="exams" element={<div>exams</div>} />
            </Route>
          </Routes>
        </MemoryRouter>,
      );
      expect(activeLabel()).toBe(label);
      unmount();
    }
  });

  it('同一时刻只有一个高亮链接', () => {
    renderShell('/board');
    const active = screen.getAllByRole('link', { current: 'page' });
    expect(active).toHaveLength(1);
  });
});
