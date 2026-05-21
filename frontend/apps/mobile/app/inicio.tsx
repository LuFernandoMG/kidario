import { FrontendShellScreen } from "@/components/webview/FrontendShellScreen";
import { TEACHER_CONTROL_CENTER_PATH } from "@/routes/frontend";

export default function TeacherControlCenterScreen() {
  return <FrontendShellScreen path={TEACHER_CONTROL_CENTER_PATH} />;
}
