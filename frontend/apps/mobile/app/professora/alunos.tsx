import { FrontendShellScreen } from "@/components/webview/FrontendShellScreen";
import { TEACHER_STUDENTS_LEGACY_PATH } from "@/routes/frontend";

export default function TeacherStudentsLegacyScreen() {
  return <FrontendShellScreen path={TEACHER_STUDENTS_LEGACY_PATH} />;
}
