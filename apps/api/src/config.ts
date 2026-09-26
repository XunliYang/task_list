/**
 * 端口 / 数据目录配置：仅从环境变量读取（PORT、DATA_DIR），不在此硬编码具体值。
 */
export interface AppConfig {
  port: number;
  dataDir: string;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const rawPort = env.PORT;
  const port = rawPort ? Number(rawPort) : 3000;
  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    throw new Error(`Invalid PORT: ${rawPort}`);
  }

  const dataDir = env.DATA_DIR || 'data';

  return { port, dataDir };
}
