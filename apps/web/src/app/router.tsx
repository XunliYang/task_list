import { lazy, Suspense } from 'react';
import type { ReactNode } from 'react';
import { createBrowserRouter } from 'react-router-dom';
import { AppShell } from './AppShell';
import { HomePage } from '../pages/HomePage';

const BoardPage = lazy(() =>
  import('../features/board/BoardPage').then((m) => ({ default: m.BoardPage })),
);
const CalendarPage = lazy(() =>
  import('../features/calendar/CalendarPage').then((m) => ({ default: m.CalendarPage })),
);
const TaskDetailPage = lazy(() =>
  import('../features/task/TaskDetailPage').then((m) => ({ default: m.TaskDetailPage })),
);
const StatusManagerPage = lazy(() =>
  import('../features/status/StatusManagerPage').then((m) => ({ default: m.StatusManagerPage })),
);
const ExamListPage = lazy(() =>
  import('../features/exam/ExamListPage').then((m) => ({ default: m.ExamListPage })),
);

function withSuspense(node: ReactNode) {
  return <Suspense fallback={<div>加载中…</div>}>{node}</Suspense>;
}

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppShell />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'board', element: withSuspense(<BoardPage />) },
      { path: 'calendar', element: withSuspense(<CalendarPage />) },
      { path: 'tasks/:id', element: withSuspense(<TaskDetailPage />) },
      { path: 'exams', element: withSuspense(<ExamListPage />) },
      { path: 'statuses', element: withSuspense(<StatusManagerPage />) },
    ],
  },
]);
