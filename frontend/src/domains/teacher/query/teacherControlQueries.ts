import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { getSupabaseAccessToken } from "@/lib/authSession";
import {
  decideTeacherBooking,
  getTeacherChatThreads,
  getTeacherControlCenterOverview,
  getTeacherStudentTimeline,
  rescheduleTeacherBooking,
  type BookingStatus,
  type TeacherBookingDecisionPayload,
  type TeacherBookingReschedulePayload,
} from "@/domains/teacher/api/backendTeacherControl";

export const teacherQueryKeys = {
  root: ["teacher"] as const,
  controlCenter: () => [...teacherQueryKeys.root, "control-center"] as const,
  controlCenterWithLimits: (params: {
    limitAgenda?: number;
    limitChats?: number;
    limitStudents?: number;
    includeHistory?: boolean;
  }) =>
    [...teacherQueryKeys.controlCenter(), params] as const,
  chatThreads: (params: { status?: BookingStatus; limit?: number }) =>
    [...teacherQueryKeys.root, "chat-threads", params] as const,
  studentTimeline: (params: { childId: string; limit?: number }) =>
    [...teacherQueryKeys.root, "student-timeline", params] as const,
};

function requireAccessToken() {
  const accessToken = getSupabaseAccessToken();
  if (!accessToken) {
    throw new Error("Sessão inválida. Faça login novamente.");
  }
  return accessToken;
}

export function useTeacherControlCenterOverview(params: {
  limitAgenda?: number;
  limitChats?: number;
  limitStudents?: number;
  includeHistory?: boolean;
}) {
  return useQuery({
    queryKey: teacherQueryKeys.controlCenterWithLimits(params),
    queryFn: () => getTeacherControlCenterOverview(requireAccessToken(), params),
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    refetchInterval: 45_000,
  });
}

export function useTeacherChatThreads(params: { status?: BookingStatus; limit?: number }) {
  return useQuery({
    queryKey: teacherQueryKeys.chatThreads(params),
    queryFn: () => getTeacherChatThreads(requireAccessToken(), params),
    staleTime: 20_000,
    gcTime: 5 * 60_000,
    refetchInterval: 30_000,
  });
}

export function useTeacherStudentTimeline(params: { childId?: string; limit?: number }) {
  const childId = params.childId?.trim() || "";
  return useQuery({
    queryKey: teacherQueryKeys.studentTimeline({ childId, limit: params.limit }),
    queryFn: () => getTeacherStudentTimeline(requireAccessToken(), childId, { limit: params.limit }),
    enabled: Boolean(childId),
    staleTime: 20_000,
    gcTime: 5 * 60_000,
    refetchInterval: 30_000,
  });
}

export function useTeacherBookingDecisionMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ bookingId, payload }: { bookingId: string; payload: TeacherBookingDecisionPayload }) =>
      decideTeacherBooking(requireAccessToken(), bookingId, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: teacherQueryKeys.controlCenter() });
      await queryClient.invalidateQueries({ queryKey: teacherQueryKeys.root });
    },
  });
}

export function useTeacherBookingRescheduleMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ bookingId, payload }: { bookingId: string; payload: TeacherBookingReschedulePayload }) =>
      rescheduleTeacherBooking(requireAccessToken(), bookingId, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: teacherQueryKeys.controlCenter() });
      await queryClient.invalidateQueries({ queryKey: teacherQueryKeys.root });
    },
  });
}
