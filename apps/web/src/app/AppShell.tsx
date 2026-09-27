import { Link, Outlet } from 'react-router-dom';

export function AppShell() {
  return (
    <div>
      <header>
        <nav>
          <Link to="/">首页</Link>
          <Link to="/board">看板</Link>
          <Link to="/calendar">日历</Link>
          <Link to="/statuses">状态管理</Link>
          <Link to="/exams">考试信息</Link>
        </nav>
      </header>
      <main>
        <Outlet />
      </main>
    </div>
  );
}
