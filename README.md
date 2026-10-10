# task_list

任务进展跟踪网站（Task Progress Tracker）。

本仓库为 npm workspaces 组织的 monorepo：

```
task_list/
├── apps/
│   ├── web/      # React 18 + TypeScript + Vite（前端）
│   └── api/      # Node 20 + TypeScript + Express 5（后端）
├── packages/
│   └── shared/   # zod schema + DTO 类型（全项目唯一契约来源）
├── data/         # 运行时 JSON 数据目录（持久化）
├── tsconfig.base.json
└── package.json
```

## 环境要求

- Node.js >= 20
- npm >= 10

## 安装

在仓库根目录执行一次即可装好所有 workspace 依赖：

```bash
npm install
```

## 常用命令

以下命令均在仓库根目录执行，脚本与根 `package.json` 一一对应：

| 命令 | 作用 |
|---|---|
| `npm run dev` | 同时启动前端（Vite）与后端（Express） |
| `npm run dev:web` | 仅启动前端 |
| `npm run dev:api` | 仅启动后端 |
| `npm run build` | 依次构建 shared → api → web |
| `npm run typecheck` | 全仓 `tsc --noEmit` 类型检查 |
| `npm run test` | 运行 shared 与 api 的单元测试（vitest） |

也可以进入具体 workspace 单独运行（以 web 为例）：

```bash
npm run dev -w @task-list/web
npm run build -w @task-list/web
npm run typecheck -w @task-list/web
```

后端构建产物运行：

```bash
npm run build -w @task-list/api
node apps/api/dist/server.js
```

## 环境变量

各目录的 `.env.example` 仅列出变量名，不包含任何值或密钥：

| 变量 | 作用 | 所在 |
|---|---|---|
| `PORT` | 后端监听端口（默认 3000） | 根 / `apps/api` |
| `DATA_DIR` | 数据目录（默认 `data`） | 根 / `apps/api` |
| `VITE_API_BASE_URL` | 前端访问后端的基地址 | `apps/web` |

复制 `.env.example` 为 `.env` 后按需填写。

## 健康检查

后端启动后：

```bash
curl http://localhost:3000/api/health
# => {"status":"ok"}
```

## Netlify 静态部署（无后端降级）

前端支持在**纯静态托管**（如 Netlify）下独立运行：当 `/api/*` 请求返回 404
（没有 Express 后端）时，会自动降级到浏览器 `localStorage` 本地数据源，
复用 `DataSnapshot` 结构与三条默认状态分类，写操作持久化到用户浏览器。
显式强制本地模式可设置环境变量 `VITE_DATA_SOURCE=local`。

| 配置项 | 值 |
|---|---|
| 构建命令 | `npm run build -w @task-list/web` |
| 发布目录 | `apps/web/dist` |
| 环境变量 | `VITE_DATA_SOURCE=local`（可选；留空则由前端自动检测 404 降级） |

> 注意：自动降级依赖 `/api/*` 返回 404。若为 Netlify 配置了 SPA 回退重定向
> （`/* → /index.html`），请把 `/api/*` 从该重定向中排除，否则 `/api/*` 会返回
> 200 HTML 而非 404，此时需显式设置 `VITE_DATA_SOURCE=local`。

本地模式下，首页提供**数据备份**入口：可把当前数据导出为 JSON 文件、或从备份
文件恢复，用于换设备/清理站点数据前的数据迁移。

本地验证静态产物：

```bash
npm run build -w @task-list/web
npx serve apps/web/dist
```

## 共享契约

`packages/shared` 是全项目唯一契约来源，其它子任务一律从这里导入领域模型与 DTO 类型，不得各自另立一套：

```ts
import {
  type Task, type Stage, type DataSnapshot,
  taskSchema, dataSnapshotSchema, createTaskInputSchema,
} from '@task-list/shared';
```
