import { FrontendShellScreen } from "@/components/webview/FrontendShellScreen";
import { TEACHER_PLANNING_PATH } from "@/routes/frontend";

export default function TeacherPlanningScreen() {
  return <FrontendShellScreen path={TEACHER_PLANNING_PATH} />;
}
