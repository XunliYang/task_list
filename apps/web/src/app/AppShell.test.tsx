import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { AppShell } from './AppShell';

// 直接读取唯一令牌来源，做「浅断言」：令牌变量存在即可，不绑定具体色值。
// vitest 以 web 工作区（apps/web）为 cwd 运行，故用 cwd 定位。
const themeCss = readFileSync(resolve(process.cwd(), 'src/styles/theme.css'), 'utf8');

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

describe('AppShell 主题化壳层（设计令牌）', () => {
  it('壳层使用令牌化结构类名', () => {
    renderShell('/');
    const shell = document.querySelector('.app-shell');
    expect(shell).toBeInTheDocument();
    expect(shell?.querySelector('.app-shell-header')).toBeInTheDocument();
    expect(shell?.querySelector('.app-shell-nav')).toBeInTheDocument();
    expect(shell?.querySelector('.app-shell-main')).toBeInTheDocument();
    expect(shell?.querySelector('.app-shell-container')).toBeInTheDocument();
  });

  it('主题令牌变量已声明（唯一令牌来源 theme.css）', () => {
    const tokens = [
      '--bg-base',
      '--bg-surface',
      '--bg-surface-2',
      '--bg-elevated',
      '--border-subtle',
      '--border-strong',
      '--text-primary',
      '--text-secondary',
      '--text-muted',
      '--accent',
      '--accent-soft',
      '--accent-glow',
      '--danger',
      '--success',
      '--warning',
      '--radius-sm',
      '--radius-md',
      '--radius-lg',
      '--shadow-card',
      '--shadow-glow',
      '--space-1',
      '--space-6',
      '--font-sans',
      '--font-mono',
      '--duration-fast',
      '--duration-base',
    ];
    for (const token of tokens) {
      expect(themeCss, `缺少令牌 ${token}`).toContain(`${token}:`);
    }
  });
});

describe('AppShell 暖色令牌化壳层（LEOY-118）', () => {
  it('壳层样式消费新品牌令牌（--canvas / --hairline / --font-display / --primary）', () => {
    const shellCss = readFileSync(resolve(process.cwd(), 'src/app/AppShell.css'), 'utf8');
    for (const token of ['--canvas', '--hairline', '--font-display', '--primary']) {
      expect(shellCss, `壳层缺少 ${token}`).toContain(token);
    }
  });

  it('主题令牌表声明 --canvas 与 --font-display', () => {
    expect(themeCss).toContain('--canvas:');
    expect(themeCss).toContain('--font-display:');
  });

  it('壳层渲染衬线品牌名', () => {
    renderShell('/');
    expect(screen.getByText('任务进展')).toBeInTheDocument();
    expect(document.querySelector('.app-shell-brand')).toBeInTheDocument();
  });
});
