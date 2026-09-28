import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { DataSnapshot } from '@task-list/shared';
import { JsonStore } from './json-store';
import { createSeedSnapshot } from './seed';

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(path.join(os.tmpdir(), 'task-list-store-'));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

function snapshotStore(file: string): JsonStore<DataSnapshot> {
  return new JsonStore<DataSnapshot>(file, createSeedSnapshot);
}

describe('JsonStore', () => {
  it('文件不存在时用 seed 初始化并落盘', async () => {
    const file = path.join(dir, 'store.json');
    const snap = await snapshotStore(file).read();
    expect(snap.statusCategories).toHaveLength(3);

    const onDisk = JSON.parse(await readFile(file, 'utf8')) as DataSnapshot;
    expect(onDisk.statusCategories).toHaveLength(3);
  });

  it('write 持久化；新实例读回同一数据（模拟重启）', async () => {
    const file = path.join(dir, 'store.json');
    const first = snapshotStore(file);
    await first.write((snap) => ({
      ...snap,
      statusCategories: [
        ...snap.statusCategories,
        { id: 'x', name: '新增', color: '#000000', order: 99 },
      ],
    }));

    const second = snapshotStore(file); // 全新实例，内存缓存为空
    const snap = await second.read();
    expect(snap.statusCategories).toHaveLength(4);
  });

  it('并发写入串行执行，不丢更新', async () => {
    const counter = new JsonStore<{ count: number }>(
      path.join(dir, 'counter.json'),
      () => ({ count: 0 }),
    );
    await Promise.all(
      Array.from({ length: 20 }, () => counter.write((c) => ({ count: c.count + 1 }))),
    );
    expect((await counter.read()).count).toBe(20);
  });

  it('写入后无 .tmp 残留（原子 rename）', async () => {
    const file = path.join(dir, 'store.json');
    const store = snapshotStore(file);
    await store.write((snap) => snap);
    const entries = await readdir(dir);
    expect(entries).toEqual(['store.json']);
  });
});