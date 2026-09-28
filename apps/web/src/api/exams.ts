import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  ConvertExamToTaskInput,
  CreateExamInfoInput,
  ExamInfo,
  ExamsImportResult,
  Task,
  UpdateExamInfoInput,
} from '@task-list/shared';
import { http } from './client';
import { examKeys, taskKeys } from './query-keys';

export interface ExamListFilters {
  type?: 'exam' | 'interview';
  q?: string;
  status?: string;
}

function examListPath(filters: ExamListFilters = {}): string {
  const params = new URLSearchParams();
  if (filters.type) {
    params.set('type', filters.type);
  }
  if (filters.q) {
    params.set('q', filters.q);
  }
  if (filters.status !== undefined) {
    params.set('status', filters.status);
  }
  const qs = params.toString();
  return qs ? `/exams?${qs}` : '/exams';
}

export function useExams(filters: ExamListFilters = {}) {
  return useQuery({
    queryKey: examKeys.list(filters),
    queryFn: () => http.get<ExamInfo[]>(examListPath(filters)),
  });
}

export function useCreateExam() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateExamInfoInput) => http.post<ExamInfo>('/exams', input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: examKeys.lists() }),
  });
}

export function useUpdateExam(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateExamInfoInput) => http.patch<ExamInfo>(`/exams/${id}`, input),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: examKeys.lists() }),
        queryClient.invalidateQueries({ queryKey: examKeys.detail(id) }),
      ]),
  });
}

export function useDeleteExam(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => http.delete(`/exams/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: examKeys.lists() }),
  });
}

export function useImportExams() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { format: 'csv' | 'json'; content: string }) =>
      http.post<ExamsImportResult>('/exams/import', input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: examKeys.lists() }),
  });
}

export function useConvertExamToTask(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ConvertExamToTaskInput) =>
      http.post<{ task: Task; exam: ExamInfo }>(`/exams/${id}/to-task`, input),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: examKeys.lists() }),
        queryClient.invalidateQueries({ queryKey: taskKeys.lists() }),
      ]),
  });
}