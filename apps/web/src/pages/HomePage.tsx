import { STAGE_STATUSES } from '@task-list/shared';

export function HomePage() {
  return (
    <section>
      <h1>任务进展跟踪</h1>
      <p>工程脚手架已就绪，这里是占位首页。</p>
      <h2>阶段状态（来自 @task-list/shared）</h2>
      <ul>
        {STAGE_STATUSES.map((status) => (
          <li key={status}>{status}</li>
        ))}
      </ul>
    </section>
  );
}