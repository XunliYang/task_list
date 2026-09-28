import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import type { DataSnapshot, StatusCategory } from '@task-list/shared';
import { createStatusInputSchema, updateStatusInputSchema } from '@task-list/shared';
import { JsonStore } from '../../store/json-store';
import { run } from '../../store/run';
import { notFound } from '../../http-error';

export function createStatusesRouter(store: JsonStore<DataSnapshot>): Router {
  const router = Router();

  router.get('/', async (_req, res) => {
    const snapshot = await store.read();
    const sorted = [...snapshot.statusCategories].sort((a, b) => a.order - b.order);
    res.json(sorted);
  });

  router.post('/', async (req, res) => {
    const input = createStatusInputSchema.parse(req.body);
    const out = await run(store, (s) => {
      const order =
        input.order ??
        s.statusCategories.reduce((max, c) => Math.max(max, c.order), -1) + 1;
      const category: StatusCategory = {
        id: randomUUID(),
        name: input.name,
        color: input.color,
        order,
      };
      return {
        snapshot: { ...s, statusCategories: [...s.statusCategories, category] },
        category,
      };
    });
    res.status(201).json(out.category);
  });

  router.patch('/:id', async (req, res) => {
    const input = updateStatusInputSchema.parse(req.body);
    const out = await run(store, (s) => {
      const existing = s.statusCategories.find((c) => c.id === req.params.id);
      if (!existing) {
        throw notFound(`状态分类不存在：${req.params.id}`);
      }
      const updated: StatusCategory = {
        ...existing,
        name: input.name ?? existing.name,
        color: input.color ?? existing.color,
        order: input.order ?? existing.order,
      };
      return {
        snapshot: {
          ...s,
          statusCategories: s.statusCategories.map((c) => (c.id === updated.id ? updated : c)),
        },
        category: updated,
      };
    });
    res.json(out.category);
  });

  router.delete('/:id', async (req, res) => {
    const out = await run(store, (s) => {
      const category = s.statusCategories.find((c) => c.id === req.params.id);
      if (!category) {
        throw notFound(`状态分类不存在：${req.params.id}`);
      }
      const taskIds = s.tasks.filter((t) => t.statusId === req.params.id).map((t) => t.id);
      if (taskIds.length > 0) {
        return { snapshot: s, conflictTaskIds: taskIds };
      }
      return {
        snapshot: {
          ...s,
          statusCategories: s.statusCategories.filter((c) => c.id !== req.params.id),
        },
        conflictTaskIds: [] as string[],
      };
    });

    if (out.conflictTaskIds.length > 0) {
      res.status(409).json({
        code: 'status_in_use',
        message: `该分类下还有 ${out.conflictTaskIds.length} 个任务，请先移动`,
        taskIds: out.conflictTaskIds,
        details: { taskIds: out.conflictTaskIds },
      });
      return;
    }
    res.status(204).end();
  });

  return router;
}