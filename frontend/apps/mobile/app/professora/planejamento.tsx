import { FrontendShellScreen } from "@/components/webview/FrontendShellScreen";
import { TEACHER_PLANNING_LEGACY_PATH } from "@/routes/frontend";

export default function TeacherPlanningLegacyScreen() {
  return <FrontendShellScreen path={TEACHER_PLANNING_LEGACY_PATH} />;
}
