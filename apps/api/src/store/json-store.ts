import { promises as fs } from 'node:fs';
import path from 'node:path';

/**
 * 通用 JSON 快照读写：进程内串行队列 + 原子 rename。
 *
 * - read() / write(mutator) 通过一条 Promise 链串行执行，避免并发交叉写。
 * - 首次读取时若文件不存在，则用 seed() 生成初始快照并落盘。
 * - 每次写入先写 `<file>.tmp`，再 rename 覆盖，保证进程中途崩溃时不会留下半个文件。
 */
export class JsonStore<T> {
  private readonly filePath: string;
  private readonly seed: () => T;

  /** 串行队列尾部：所有读写操作按入队顺序依次执行。 */
  private queue: Promise<unknown> = Promise.resolve();

  /** 内存缓存：进程内读多写少时避免反复读盘；写入后同步更新。 */
  private cached: T | null = null;

  constructor(filePath: string, seed?: () => T) {
    this.filePath = filePath;
    this.seed = seed ?? (() => ({} as T));
  }

  private async load(): Promise<T> {
    if (this.cached !== null) {
      return this.cached;
    }

    try {
      const raw = await fs.readFile(this.filePath, 'utf8');
      this.cached = JSON.parse(raw) as T;
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code;
      if (code !== 'ENOENT') {
        throw err;
      }
      this.cached = this.seed();
      await this.persist(this.cached);
    }

    return this.cached;
  }

  private async persist(data: T): Promise<void> {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    const tmpPath = `${this.filePath}.tmp`;
    await fs.writeFile(tmpPath, JSON.stringify(data, null, 2), 'utf8');
    await fs.rename(tmpPath, this.filePath);
  }

  private enqueue<TResult>(task: () => Promise<TResult>): Promise<TResult> {
    const run = this.queue.then(task, task);
    // 让后续操作无论成败都能继续执行，同时把失败原样抛给当前调用方。
    this.queue = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

  read(): Promise<T> {
    return this.enqueue(() => this.load());
  }

  write(mutator: (current: T) => T): Promise<T> {
    return this.enqueue(async () => {
      const current = await this.load();
      const next = mutator(current);
      await this.persist(next);
      this.cached = next;
      return next;
    });
  }

  /** 仅测试用：清空内存缓存，模拟「重启后重新读盘」。 */
  resetCache(): void {
    this.cached = null;
  }
}