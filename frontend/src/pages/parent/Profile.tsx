import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { AppShell } from "@/components/layout/AppShell";
import { getMyProfile } from "@/data/api/profiles";
import { getAuthSession, getSupabaseAccessToken } from "@/lib/authSession";
import { LOGIN_PATH, PARENT_PROFILE_SETTINGS_PATH, PROFILE_PATH, TEACHER_PROFILE_SETTINGS_PATH } from "@/routes/paths";

export default function Profile() {
  const navigate = useNavigate();

  useEffect(() => {
    const accessToken = getSupabaseAccessToken();
    const fallbackRole = getAuthSession().role;

    if (!accessToken) {
      navigate(`${LOGIN_PATH}?returnTo=${encodeURIComponent(PROFILE_PATH)}`);
      return;
    }

    getMyProfile(accessToken)
      .then((payload) => {
        if (payload.profile.role === "teacher") {
          navigate(TEACHER_PROFILE_SETTINGS_PATH, { replace: true });
          return;
        }
        navigate(PARENT_PROFILE_SETTINGS_PATH, { replace: true });
      })
      .catch(() => {
        if (fallbackRole === "teacher") {
          navigate(TEACHER_PROFILE_SETTINGS_PATH, { replace: true });
          return;
        }
        navigate(PARENT_PROFILE_SETTINGS_PATH, { replace: true });
      });
  }, [navigate]);

  return (
    <AppShell>
      <div className="px-4 pt-6">
        <p className="text-muted-foreground">Carregando perfil...</p>
      </div>
    </AppShell>
  );
}
