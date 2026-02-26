export {
  getMyProfile,
  type BackendMeResponse,
  type BackendProfileStatusResponse,
  type BackendProfileView,
  type BackendUserRole,
} from "@/domains/profile/api/backendProfileShared";

export {
  getParentProfile,
  patchParentProfile,
  type BackendParentChildView,
  type BackendParentProfileResponse,
  type ParentChildUpsertPayload,
  type ParentProfilePatchPayload,
} from "@/domains/parent/api/backendParentProfiles";
