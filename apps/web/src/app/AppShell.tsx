import { Link, Outlet } from 'react-router-dom';

export function AppShell() {
  return (
    <div>
      <header>
        <nav>
          <Link to="/">首页</Link>
        </nav>
      </header>
      <main>
        <Outlet />
      </main>
    </div>
  );
}