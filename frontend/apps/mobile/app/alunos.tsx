import { FrontendShellScreen } from "@/components/webview/FrontendShellScreen";
import { TEACHER_STUDENTS_PATH } from "@/routes/frontend";

export default function TeacherStudentsScreen() {
  return <FrontendShellScreen path={TEACHER_STUDENTS_PATH} />;
}
