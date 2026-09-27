import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CreateStatusInput, StatusCategory, UpdateStatusInput } from '@task-list/shared';
import { http } from './client';
import { statusKeys } from './query-keys';

export function useStatuses() {
  return useQuery({
    queryKey: statusKeys.lists(),
    queryFn: () => http.get<StatusCategory[]>('/statuses'),
  });
}

export function useCreateStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateStatusInput) => http.post<StatusCategory>('/statuses', input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: statusKeys.lists() }),
  });
}

export function useUpdateStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (args: { id: string; input: UpdateStatusInput }) =>
      http.patch<StatusCategory>(`/statuses/${args.id}`, args.input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: statusKeys.lists() }),
  });
}

export function useDeleteStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => http.delete(`/statuses/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: statusKeys.lists() }),
  });
}