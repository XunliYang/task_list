import { Link, Outlet, useLocation } from 'react-router-dom';
import './AppShell.css';

const NAV_ITEMS = [
  { to: '/', label: '首页', match: (pathname: string) => pathname === '/' },
  {
    to: '/board',
    label: '看板',
    match: (pathname: string) =>
      pathname === '/board' || pathname.startsWith('/tasks/'),
  },
  { to: '/calendar', label: '日历', match: (pathname: string) => pathname === '/calendar' },
  { to: '/statuses', label: '状态管理', match: (pathname: string) => pathname === '/statuses' },
  { to: '/exams', label: '考试信息', match: (pathname: string) => pathname === '/exams' },
] as const;

export function AppShell() {
  const { pathname } = useLocation();

  return (
    <div className="app-shell">
      <header className="app-shell-header">
        <div className="app-shell-bar">
          <span className="app-shell-brand">任务进展</span>
          <nav className="app-shell-nav" aria-label="主导航">
            {NAV_ITEMS.map((item) => {
              const active = item.match(pathname);
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={
                    active ? 'app-shell-nav-link app-shell-nav-link--active' : 'app-shell-nav-link'
                  }
                  aria-current={active ? 'page' : undefined}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </header>
      <main className="app-shell-main app-shell-container">
        <Outlet />
      </main>
    </div>
  );
}
