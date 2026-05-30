import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { getTeacherPayoutProfileOrNull, type TeacherPayoutProfile } from "@/data/api/payments";
import { getAuthSession, getSupabaseAccessToken } from "@/lib/authSession";
import { LOGIN_PATH } from "@/routes/paths";
import { TeacherPayoutProfileDialog } from "./TeacherPayoutProfileDialog";

export function TeacherPayoutProfileGate() {
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const [profile, setProfile] = useState<TeacherPayoutProfile | null>(null);
  const checkedPathRef = useRef("");

  useEffect(() => {
    const session = getAuthSession();
    const accessToken = getSupabaseAccessToken();
    const shouldCheck =
      session.isAuthenticated
      && session.role === "teacher"
      && Boolean(accessToken)
      && location.pathname !== LOGIN_PATH;

    if (!shouldCheck || checkedPathRef.current === location.pathname) return;

    let cancelled = false;
    checkedPathRef.current = location.pathname;

    void getTeacherPayoutProfileOrNull(accessToken as string)
      .then((nextProfile) => {
        if (cancelled) return;
        setProfile(nextProfile);
        setIsOpen(!nextProfile);
      })
      .catch(() => {
        if (!cancelled) setIsOpen(false);
      });

    return () => {
      cancelled = true;
    };
  }, [location.pathname]);

  if (!isOpen) return null;

  return (
    <TeacherPayoutProfileDialog
      open={isOpen}
      required
      initialProfile={profile}
      onOpenChange={setIsOpen}
      onSaved={(savedProfile) => {
        setProfile(savedProfile);
        setIsOpen(false);
      }}
    />
  );
}
