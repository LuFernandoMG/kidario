import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { AppShell } from "@/components/layout/AppShell";
import { getAuthSession, getSupabaseAccessToken } from "@/lib/authSession";
import { getMyProfile } from "@/lib/backendProfiles";

export default function Profile() {
  const navigate = useNavigate();

  useEffect(() => {
    const accessToken = getSupabaseAccessToken();
    const fallbackRole = getAuthSession().role;

    if (!accessToken) {
      navigate("/login?returnTo=%2Fperfil");
      return;
    }

    getMyProfile(accessToken)
      .then((payload) => {
        if (payload.profile.role === "teacher") {
          navigate("/perfil/professora", { replace: true });
          return;
        }
        navigate("/perfil/responsavel", { replace: true });
      })
      .catch(() => {
        if (fallbackRole === "teacher") {
          navigate("/perfil/professora", { replace: true });
          return;
        }
        navigate("/perfil/responsavel", { replace: true });
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
