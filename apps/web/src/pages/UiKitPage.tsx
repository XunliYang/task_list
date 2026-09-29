import {
  Badge,
  Button,
  Row,
  StatusDot,
  SuccessMorphButton,
} from '../ui';
import './UiKitPage.css';

const demoStages = [
  { id: 'd1', name: '笔试', status: 'done' as const, dueDate: '2026-10-01' },
  { id: 'd2', name: '一面', status: 'in_progress' as const, dueDate: '2026-10-10' },
  { id: 'd3', name: '二面', status: 'pending' as const, dueDate: '2026-10-18' },
];

const tokenSwatches: Array<[string, string]> = [
  ['--canvas', 'var(--canvas)'],
  ['--surface-soft', 'var(--surface-soft)'],
  ['--surface-card', 'var(--surface-card)'],
  ['--surface-strong', 'var(--surface-strong)'],
  ['--hairline', 'var(--hairline)'],
  ['--surface-dark', 'var(--surface-dark)'],
  ['--ink', 'var(--ink)'],
  ['--primary', 'var(--primary)'],
  ['--primary-active', 'var(--primary-active)'],
  ['--success', 'var(--success)'],
  ['--warning', 'var(--warning)'],
  ['--error', 'var(--error)'],
];

/** 仅 dev 注册的活规范页：展示共享 UI 基元的全部状态，作为 stage 7 的对照规范。 */
export function UiKitPage() {
  return (
    <div className="uikit-page">
      <h1 className="uikit-title">UI 基元规范（/ui-kit）</h1>

      <section className="uikit-section">
        <h2 className="uikit-h2">设计令牌</h2>
        <div className="uikit-swatches">
          {tokenSwatches.map(([name, value]) => (
            <div key={name} className="uikit-swatch">
              <span className="uikit-swatch-block" style={{ background: value }} />
              <code className="uikit-swatch-name">{name}</code>
            </div>
          ))}
        </div>
      </section>

      <section className="uikit-section">
        <h2 className="uikit-h2">Button（导航 / 筛选 / 视图切换）</h2>
        <div className="uikit-demo-row">
          <Button variant="primary">主要操作</Button>
          <Button variant="secondary">次要操作</Button>
          <Button variant="ghost">幽灵按钮</Button>
          <Button disabled>禁用</Button>
        </div>
      </section>

      <section className="uikit-section">
        <h2 className="uikit-h2">Badge / StatusDot</h2>
        <div className="uikit-demo-row">
          <Badge>前端</Badge>
          <Badge variant="primary">进行中</Badge>
          <Badge variant="success">已完成</Badge>
          <Badge variant="warning">本周到期</Badge>
          <Badge variant="error">已逾期</Badge>
        </div>
        <div className="uikit-demo-row">
          <StatusDot color="#5db872" label="待开始" />
          <StatusDot color="#cc785c" label="进行中" status="in_progress" />
          <StatusDot color="#a9583e" label="已完成" status="done" />
        </div>
      </section>

      <section className="uikit-section">
        <h2 className="uikit-h2">Row（任务行结构）</h2>
        <ul className="uikit-row-list">
          <Row
            statusColor="#cc785c"
            statusName="进行中"
            statusActive
            title="某公司前端岗"
            company="Acme"
            tags={['前端', '远程']}
            stages={demoStages}
            href="/tasks/demo"
            moveTargets={[
              { id: 'a', name: '已挂' },
              { id: 'b', name: '进行中' },
            ]}
          />
          <Row
            statusColor="#5db872"
            statusName="已完成"
            title="某公司后端岗"
            company="Beta"
            tags={['后端', 'Go']}
            stages={[
              { id: 'e1', name: '笔试', status: 'done', dueDate: '2026-09-20' },
              { id: 'e2', name: '一面', status: 'done', dueDate: '2026-09-25' },
            ]}
            href="/tasks/demo2"
          />
        </ul>
      </section>

      <section className="uikit-section">
        <h2 className="uikit-h2">SuccessMorphButton（点击 → 成功形变，四态）</h2>
        <div className="uikit-demo-row" id="morph-idle">
          <SuccessMorphButton onAction={async () => {}}>保存</SuccessMorphButton>
          <span className="uikit-hint">idle（未点击）</span>
        </div>
        <div className="uikit-demo-row" id="morph-success">
          <SuccessMorphButton onAction={async () => {}} successDurationMs={8000}>
            保存
          </SuccessMorphButton>
          <span className="uikit-hint">点击后 → success（停留 8s）</span>
        </div>
        <div className="uikit-demo-row" id="morph-pending">
          <SuccessMorphButton
            onAction={() => new Promise<void>((r) => window.setTimeout(r, 8000))}
            pendingLabel="处理中…"
          >
            保存
          </SuccessMorphButton>
          <span className="uikit-hint">点击后 → pending（停留 8s）</span>
        </div>
        <div className="uikit-demo-row" id="morph-error">
          <SuccessMorphButton
            onAction={async () => {
              throw new Error('demo');
            }}
          >
            保存
          </SuccessMorphButton>
          <span className="uikit-hint">点击后 → error（停留直到重试）</span>
        </div>
      </section>
    </div>
  );
}
