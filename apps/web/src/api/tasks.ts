import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  AddStageInput,
  AdvanceStageResult,
  CreateProgressInput,
  CreateTaskInput,
  ProgressEntry,
  Stage,
  Task,
  UpdateStageInput,
  UpdateTaskInput,
} from '@task-list/shared';
import { http } from './client';
import { taskKeys } from './query-keys';

export interface TaskListFilters {
  statusIds?: string[];
  q?: string;
  stageStatus?: 'done' | 'pending';
}

function taskListPath(filters: TaskListFilters = {}): string {
  const params = new URLSearchParams();
  for (const id of filters.statusIds ?? []) {
    params.append('statusId', id);
  }
  if (filters.q) {
    params.set('q', filters.q);
  }
  if (filters.stageStatus) {
    params.set('stageStatus', filters.stageStatus);
  }
  const qs = params.toString();
  return qs ? `/tasks?${qs}` : '/tasks';
}

export function useTasks(filters: TaskListFilters = {}) {
  return useQuery({
    queryKey: taskKeys.list(filters),
    queryFn: () => http.get<Task[]>(taskListPath(filters)),
  });
}

export function useTask(id: string | undefined) {
  return useQuery({
    queryKey: taskKeys.detail(id ?? ''),
    queryFn: () => http.get<Task>(`/tasks/${id}`),
    enabled: Boolean(id),
  });
}

export function useTaskProgress(id: string | undefined) {
  return useQuery({
    queryKey: taskKeys.progress(id ?? ''),
    queryFn: () => http.get<ProgressEntry[]>(`/tasks/${id}/progress`),
    enabled: Boolean(id),
  });
}

export function useCreateTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateTaskInput) => http.post<Task>('/tasks', input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: taskKeys.lists() }),
  });
}

export function useUpdateTask(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateTaskInput) => http.patch<Task>(`/tasks/${id}`, input),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: taskKeys.lists() }),
        queryClient.invalidateQueries({ queryKey: taskKeys.details() }),
      ]),
  });
}

export function useDeleteTask(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => http.delete(`/tasks/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: taskKeys.lists() }),
  });
}

export function useAddProgress(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateProgressInput) =>
      http.post<ProgressEntry>(`/tasks/${id}/progress`, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: taskKeys.progress(id) }),
  });
}

export function useAdvanceStage(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => http.post<AdvanceStageResult>(`/tasks/${id}/advance`),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: taskKeys.details() }),
        queryClient.invalidateQueries({ queryKey: taskKeys.progress(id) }),
      ]),
  });
}

export function useSetCurrentStage(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (stageId: string) =>
      http.patch<Task>(`/tasks/${id}/current-stage`, { stageId }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: taskKeys.details() }),
  });
}

export function useAddStage(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: AddStageInput) => http.post<Task>(`/tasks/${id}/stages`, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: taskKeys.details() }),
  });
}

export function useReorderStages(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (stageIds: string[]) =>
      http.patch<Task>(`/tasks/${id}/stages/order`, { stageIds }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: taskKeys.details() }),
  });
}

export function useUpdateStage(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (args: { stageId: string; input: UpdateStageInput }) =>
      http.patch<Task>(`/tasks/${id}/stages/${args.stageId}`, args.input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: taskKeys.details() }),
  });
}

export function useDeleteStage(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (stageId: string) => http.delete<Task>(`/tasks/${id}/stages/${stageId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: taskKeys.details() }),
  });
}

// 供其它 feature 复用的类型导出（避免重复定义请求体形状）。
export type { Stage };