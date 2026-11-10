import { apiFailure } from "../../services/errors";
import React, { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../services/api";
import { useAuthStore } from "../../store/authStore";
import type { APITokenItem } from "../../types";

type ProfileTab =
  "personal" | "security" | "preferences" | "tokens" | "activity";

/** Data, mutations and transient workflow state; rendering stays in the page. */
export function useProfileWorkspace() {
  const location = useLocation();
  const queryClient = useQueryClient();
  const updateUser = useAuthStore((state) => state.updateUser);
  const logout = useAuthStore((state) => state.logout);
  const [activeTab, setActiveTab] = useState<ProfileTab>(
    new URLSearchParams(location.search).get("tab") === "security"
      ? "security"
      : (location.state?.tab as ProfileTab) || "personal",
  );

  useEffect(() => {
    if (location.state?.tab) {
      setActiveTab(location.state.tab as ProfileTab);
    }
  }, [location.state?.tab]);

  // Personal Info form
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [profileMsg, setProfileMsg] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Security / Password form
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showOldPassword, setShowOldPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [securityMsg, setSecurityMsg] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [revokeSessionsMsg, setRevokeSessionsMsg] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Preferences form
  const [soundAlerts, setSoundAlerts] = useState(true);
  const [userTimezone, setUserTimezone] = useState("America/Guatemala");
  const [preferencesMsg, setPreferencesMsg] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Live time ticker for timezone preview
  const [liveTime, setLiveTime] = useState("");

  // Tokens state
  const [showTokenModal, setShowTokenModal] = useState(false);
  const [deleteTokenTarget, setDeleteTokenTarget] =
    useState<APITokenItem | null>(null);

  // 2FA state
  const [show2FAModal, setShow2FAModal] = useState(false);
  const [showDisable2FAModal, setShowDisable2FAModal] = useState(false);
  const [totpSetupData, setTotpSetupData] = useState<{
    secret: string;
    qr_code: string;
    provisioning_uri: string;
  } | null>(null);
  const [isSettingUp2FA, setIsSettingUp2FA] = useState(false);
  const [enrollmentPassword, setEnrollmentPassword] = useState("");

  // 1. Fetch current user data from /api/v1/auth/me/
  const {
    data: meData,
    isLoading: isLoadingMe,
    refetch: refetchMe,
  } = useQuery<import("../../types").User>({
    queryKey: ["auth-me-profile"],
    queryFn: async () => {
      const res = await api.get("auth/me/");
      return res.data?.data;
    },
  });

  // Populate form states when meData arrives
  useEffect(() => {
    if (meData) {
      setFirstName(meData.first_name || "");
      setLastName(meData.last_name || "");
      setEmail(meData.email || "");
      setPhoneNumber(meData.phone_number || "");
      setUserTimezone(meData.timezone || "America/Guatemala");

      const prefs = meData.notification_preferences || {};
      setSoundAlerts(prefs.sound_alerts !== false);
    }
  }, [meData]);

  // Live clock ticker
  useEffect(() => {
    const updateTime = () => {
      try {
        const now = new Date();
        const formatted = new Intl.DateTimeFormat("es-ES", {
          timeZone: userTimezone || "UTC",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          timeZoneName: "short",
        }).format(now);
        setLiveTime(formatted);
      } catch {
        setLiveTime(new Date().toLocaleTimeString());
      }
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, [userTimezone]);

  // 2. Fetch API tokens
  const { data: apiTokens = [], isLoading: isLoadingTokens } = useQuery({
    queryKey: ["user-api-tokens"],
    queryFn: async () => {
      const res = await api.get("auth/api-tokens/");
      return (res.data?.data || []) as APITokenItem[];
    },
  });

  // Dual-tone Web Audio API synthesized chime
  const playNOCChime = () => {
    try {
      const AudioCtxClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      if (!AudioCtxClass) return;
      const ctx = new AudioCtxClass();
      const now = ctx.currentTime;

      // Note 1: 587.33 Hz (D5)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = "sine";
      osc1.frequency.setValueAtTime(587.33, now);
      gain1.gain.setValueAtTime(0.15, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.25);

      // Note 2: 880 Hz (A5)
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = "sine";
      osc2.frequency.setValueAtTime(880, now + 0.1);
      gain2.gain.setValueAtTime(0.18, now + 0.1);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.1);
      osc2.stop(now + 0.45);
    } catch (e) {
      console.warn("Web Audio API not permitted or supported:", e);
    }
  };

  // Mutation: Update Personal Info
  const updateProfileMutation = useMutation({
    mutationFn: async () => {
      const res = await api.patch("auth/me/", {
        first_name: firstName,
        last_name: lastName,
        phone_number: phoneNumber,
      });
      return res.data?.data;
    },
    onSuccess: (updatedUser) => {
      if (updatedUser) {
        updateUser(updatedUser);
      }
      queryClient.invalidateQueries({ queryKey: ["auth-me-profile"] });
      setProfileMsg({
        type: "success",
        text: "Datos personales y contacto de guardia actualizados correctamente.",
      });
      setTimeout(() => setProfileMsg(null), 4500);
    },
    onError: (caughtError: unknown) => {
      const err = apiFailure(caughtError);
      setProfileMsg({
        type: "error",
        text: err.response?.data?.message || "Error al actualizar el perfil.",
      });
    },
  });

  // Mutation: Change Password
  const changePasswordMutation = useMutation({
    mutationFn: async () => {
      await api.post("auth/password/change/", {
        old_password: oldPassword,
        new_password: newPassword,
      });
    },
    onSuccess: () => {
      setOldPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setSecurityMsg({
        type: "success",
        text: "Contraseña actualizada correctamente.",
      });
      setTimeout(() => setSecurityMsg(null), 4500);
    },
    onError: (caughtError: unknown) => {
      const err = apiFailure(caughtError);
      setSecurityMsg({
        type: "error",
        text:
          err.response?.data?.message ||
          "Error al cambiar contraseña. Verifica tu contraseña actual.",
      });
    },
  });

  // Mutation: Revoke Other Active Sessions
  const revokeSessionsMutation = useMutation({
    mutationFn: async () => {
      const currentRefreshToken = localStorage.getItem("refresh_token");
      if (!currentRefreshToken)
        throw new Error("No se encontró la sesión actual.");
      await api.post("auth/revoke-sessions/", {
        current_refresh_token: currentRefreshToken,
      });
    },
    onSuccess: () => {
      setRevokeSessionsMsg({
        type: "success",
        text: "Se han revocado exitosamente las sesiones remotas y tokens activos en otros dispositivos.",
      });
      setTimeout(() => setRevokeSessionsMsg(null), 5000);
    },
    onError: (caughtError: unknown) => {
      const err = apiFailure(caughtError);
      setRevokeSessionsMsg({
        type: "error",
        text:
          err.response?.data?.message || "Error al revocar sesiones remotas.",
      });
    },
  });

  // 2FA Handlers
  const handleInitiate2FA = async (reset = false) => {
    setIsSettingUp2FA(true);
    try {
      const res = await api.post("auth/2fa/setup/", {
        reset,
        password: meData?.is_superuser ? enrollmentPassword : undefined,
      });
      setTotpSetupData(res.data?.data);
      setShow2FAModal(true);
    } catch (caughtError: unknown) {
      const err = apiFailure(caughtError);
      alert(
        err.response?.data?.message ||
          "Error al iniciar la configuración de 2FA.",
      );
    } finally {
      setIsSettingUp2FA(false);
    }
  };

  const verify2FAMutation = useMutation({
    mutationFn: async (code: string) => {
      const res = await api.post("auth/2fa/verify/", {
        code,
        password: meData?.is_superuser ? enrollmentPassword : undefined,
      });
      return res.data?.data?.backup_codes as string[];
    },
    onSuccess: () => {
      setEnrollmentPassword("");
      setTotpSetupData(null);
      queryClient.invalidateQueries({ queryKey: ["auth-me-profile"] });
    },
  });

  const disable2FAMutation = useMutation({
    mutationFn: async (password: string) => {
      await api.post("auth/2fa/disable/", { password });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["auth-me-profile"] });
    },
  });

  // Mutation: Update Operational Preferences
  const updatePreferencesMutation = useMutation({
    mutationFn: async () => {
      const res = await api.patch("auth/me/", {
        timezone: userTimezone,
        notification_preferences: {
          sound_alerts: soundAlerts,
        },
      });
      return res.data?.data;
    },
    onSuccess: (updatedUser) => {
      if (updatedUser) {
        updateUser(updatedUser);
      }
      queryClient.invalidateQueries({ queryKey: ["auth-me-profile"] });
      setPreferencesMsg({
        type: "success",
        text: "Preferencias operativas y huso horario guardados exitosamente.",
      });
      setTimeout(() => setPreferencesMsg(null), 4500);
    },
    onError: (caughtError: unknown) => {
      const err = apiFailure(caughtError);
      setPreferencesMsg({
        type: "error",
        text:
          err.response?.data?.message || "Error al guardar las preferencias.",
      });
    },
  });

  // Mutation: Create API Token
  const createTokenMutation = useMutation({
    mutationFn: async (payload: {
      name: string;
      scope: "read" | "full";
      expires_in_days: number | null;
    }) => {
      const response = await api.post("auth/api-tokens/", payload);
      return response.data?.data?.raw_token as string;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-api-tokens"] });
    },
  });

  // Mutation: Delete API Token
  const deleteTokenMutation = useMutation({
    mutationFn: async (tokenId: string) => {
      await api.delete(`auth/api-tokens/${tokenId}/`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-api-tokens"] });
      setDeleteTokenTarget(null);
    },
  });

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setSecurityMsg({
        type: "error",
        text: "Las nuevas contraseñas no coinciden.",
      });
      return;
    }
    if (newPassword.length < 8) {
      setSecurityMsg({
        type: "error",
        text: "La contraseña debe tener al menos 8 caracteres.",
      });
      return;
    }
    changePasswordMutation.mutate();
  };

  const userInitials = `${(firstName?.[0] || "U").toUpperCase()}${(lastName?.[0] || "").toUpperCase()}`;
  const isAdmin = meData?.role === "admin" || meData?.is_staff;
  const isTeamLeadInAny = meData?.teams?.some((t) => t.is_lead);
  return {
    logout,
    activeTab,
    setActiveTab,
    firstName,
    setFirstName,
    lastName,
    setLastName,
    email,
    phoneNumber,
    setPhoneNumber,
    profileMsg,
    oldPassword,
    setOldPassword,
    newPassword,
    setNewPassword,
    confirmPassword,
    setConfirmPassword,
    showOldPassword,
    setShowOldPassword,
    showNewPassword,
    setShowNewPassword,
    showConfirmPassword,
    setShowConfirmPassword,
    securityMsg,
    revokeSessionsMsg,
    soundAlerts,
    setSoundAlerts,
    userTimezone,
    setUserTimezone,
    preferencesMsg,
    liveTime,
    showTokenModal,
    setShowTokenModal,
    deleteTokenTarget,
    setDeleteTokenTarget,
    show2FAModal,
    setShow2FAModal,
    showDisable2FAModal,
    setShowDisable2FAModal,
    totpSetupData,
    setTotpSetupData,
    isSettingUp2FA,
    enrollmentPassword,
    setEnrollmentPassword,
    meData,
    isLoadingMe,
    refetchMe,
    apiTokens,
    isLoadingTokens,
    playNOCChime,
    updateProfileMutation,
    changePasswordMutation,
    revokeSessionsMutation,
    handleInitiate2FA,
    verify2FAMutation,
    disable2FAMutation,
    updatePreferencesMutation,
    createTokenMutation,
    deleteTokenMutation,
    handlePasswordSubmit,
    userInitials,
    isAdmin,
    isTeamLeadInAny,
  };
}
