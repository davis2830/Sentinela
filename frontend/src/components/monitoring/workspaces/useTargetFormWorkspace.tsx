import { apiFailure } from "../../../services/errors";
import { useConfigurationDiagnostic } from "../../../hooks/useConfigurationDiagnostic";
import { tcpParts, tcpEndpoint } from "../../../utils/networkEndpoint";
import React, { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../../services/api";
import type {
  MonitoringTarget,
  CreateTargetData,
} from "../../../types/monitoring";
import { useAuthStore } from "../../../store/authStore";
import { hasCapability } from "../../../hooks/useCapability";
import type { Team } from "../../../types/users";
import type { AgentProbe } from "../../../types/agent_probe";

interface TargetFormProps {
  target: MonitoringTarget | null;
  onSubmit: (data: CreateTargetData) => Promise<void>;
  onClose: () => void;
}

/** Data, mutations and transient workflow state; rendering stays in the page. */
export function useTargetFormWorkspace({
  target,
  onSubmit,
  onClose,
}: TargetFormProps) {
  const [activeTab, setActiveTab] = useState<"general" | "http" | "diagnostic">(
    "general",
  );
  const [showTemplates, setShowTemplates] = useState(false);
  const templatesRef = useRef<HTMLDivElement>(null);

  const [name, setName] = useState(target?.name || "");
  const [targetType, setTargetType] = useState<MonitoringTarget["target_type"]>(
    target?.target_type || "https",
  );
  const [endpoint, setEndpoint] = useState(target?.endpoint || "");
  const [interval, setInterval] = useState(target?.interval || 300);
  const [enabled, setEnabled] = useState(target?.enabled ?? true);
  const user = useAuthStore((state) => state.user);
  const canAutoProvision = [
    "ssl_monitor.create",
    "dns_monitor.create",
    "security_headers.create",
  ].some((code) => hasCapability(user, code));
  const [autoCoverage, setAutoCoverage] = useState(canAutoProvision);

  const [ownerTeam, setOwnerTeam] = useState<string>(target?.owner_team || "");
  const [runnerType, setRunnerType] = useState<"cloud" | "agent">(
    target?.runner_type || "cloud",
  );
  const [agentProbeId, setAgentProbeId] = useState<string>(
    target?.agent_probe || "",
  );

  // Fetch squads/teams for ownership assignment
  const { data: teams = [] } = useQuery<Team[]>({
    queryKey: ["teams-list-select"],
    queryFn: async () => {
      try {
        const response = await api.get("users/teams/");
        return (response.data?.data || []) as Team[];
      } catch {
        return [];
      }
    },
    staleTime: 60000,
  });

  // Fetch private satellite agents
  const { data: probes = [] } = useQuery<AgentProbe[]>({
    queryKey: ["agent-probes-select"],
    queryFn: async () => {
      try {
        const response = await api.get("agent-probes/");
        return (response.data?.data || []) as AgentProbe[];
      } catch {
        return [];
      }
    },
    staleTime: 30000,
  });

  // Fetch organization subscription for plan quota & min_interval enforcement
  const { data: subData } = useQuery<
    import("../../../types/organization").SubscriptionSummary
  >({
    queryKey: ["org-subscription-targetform"],
    queryFn: async () => {
      try {
        const res = await api.get("organizations/current/subscription/");
        return res.data?.data;
      } catch {
        return null;
      }
    },
    staleTime: 60000,
  });

  const minAllowedInterval = subData?.limits?.min_check_interval_seconds ?? 300;

  useEffect(() => {
    if (!target && subData) setInterval(minAllowedInterval);
  }, [target, minAllowedInterval, subData]);

  useEffect(() => {
    if (minAllowedInterval && interval < minAllowedInterval) {
      setInterval(minAllowedInterval);
    }
  }, [interval, minAllowedInterval]);

  // TCP dedicated helper state
  const [tcpHost, setTcpHost] = useState("");
  const [tcpPort, setTcpPort] = useState("80");

  // Auto-detect private LAN IPs and automatically select Senti9 runner
  useEffect(() => {
    const raw = targetType === "tcp" ? tcpHost : endpoint;
    const clean = tcpParts(raw).host;
    const isPrivate =
      /^(192\.168\.|10\.|172\.(1[6-9]|2[0-9]|3[0-1])\.|localhost|127\.|f[cd][0-9a-f]{2}:)/i.test(
        clean,
      );
    if (isPrivate && runnerType === "cloud" && probes.length > 0 && !target) {
      setRunnerType("agent");
      if (!agentProbeId && probes[0]) {
        setAgentProbeId(probes[0].id);
      }
    }
  }, [endpoint, tcpHost, targetType, probes, runnerType, target, agentProbeId]);

  // Tag chip management
  const [tags, setTags] = useState<string[]>(target?.tags || []);
  const [tagInputText, setTagInputText] = useState("");

  // Advanced fields
  const [httpMethod, setHttpMethod] = useState(target?.http_method || "GET");
  const [expectedStatus, setExpectedStatus] = useState(
    target?.expected_status || 200,
  );
  const [maxLatencyMs, setMaxLatencyMs] = useState(
    target?.max_latency_ms || 2000,
  );
  const [headersJson, setHeadersJson] = useState(
    target?.custom_headers
      ? JSON.stringify(target.custom_headers, null, 2)
      : "",
  );
  const [requestBody, setRequestBody] = useState(target?.request_body || "");

  // Live test diagnostic state
  const diagnostic = useConfigurationDiagnostic();
  const [testingConnection, setTestingConnection] = useState(false);
  const [testResult, setTestResult] = useState<{
    status: string;
    message: string;
    latency_ms?: number;
    status_code?: number;
    headers?: Record<string, string>;
    redirect_location?: string;
  } | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Close templates dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        templatesRef.current &&
        !templatesRef.current.contains(event.target as Node)
      ) {
        setShowTemplates(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Initialize TCP fields from endpoint if editing TCP
  useEffect(() => {
    if (target?.target_type === "tcp") {
      const parts = tcpParts(target.endpoint);
      setTcpHost(parts.host);
      setTcpPort(parts.port);
    }
  }, [target]);

  // Keep endpoint in sync if TCP mode
  const getActualEndpoint = () => {
    if (targetType === "tcp") {
      return tcpEndpoint(tcpHost, tcpPort);
    }
    return endpoint.trim();
  };

  const handleProtocolChange = (type: MonitoringTarget["target_type"]) => {
    setTargetType(type);
    setTestResult(null);
    setError("");

    // If switching to TCP and endpoint has a port, parse it
    if (type === "tcp" && endpoint.trim()) {
      const parts = tcpParts(endpoint);
      setTcpHost(parts.host);
      setTcpPort(parts.port);
    } else if (type === "https" && (!endpoint || endpoint === "http://")) {
      setEndpoint("https://");
    } else if (type === "http" && (!endpoint || endpoint === "https://")) {
      setEndpoint("http://");
    }
  };

  // 1-Click Templates (Strictly NO emojis)
  const applyTemplate = (template: "ad" | "db" | "web" | "api") => {
    if (template === "ad") {
      setName("Active Directory / DNS LDAP");
      setTargetType("tcp");
      setTcpHost("10.138.15.10");
      setTcpPort("389");
      setInterval(30);
      setTags(["infra", "ad", "ldap"]);
    } else if (template === "db") {
      setName("Base de Datos PostgreSQL");
      setTargetType("tcp");
      setTcpHost("10.138.10.5");
      setTcpPort("5432");
      setInterval(30);
      setTags(["db", "postgres", "core"]);
    } else if (template === "web") {
      setName("Portal Web Corporativo");
      setTargetType("https");
      setEndpoint("https://micoope.com.gt");
      setInterval(60);
      setExpectedStatus(200);
      setTags(["web", "publico"]);
    } else if (template === "api") {
      setName("API Gateway Core");
      setTargetType("api");
      setEndpoint("https://micoopeenlinea.com.gt/api/v1/health");
      setHttpMethod("GET");
      setExpectedStatus(200);
      setInterval(30);
      setTags(["api", "core", "produccion"]);
    }
  };

  // Tag chip handlers
  const addTag = (text: string) => {
    const cleaned = text
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9-_]/g, "");
    if (cleaned && !tags.includes(cleaned)) {
      setTags([...tags, cleaned]);
    }
    setTagInputText("");
  };

  const removeTag = (tagToRemove: string) => {
    setTags(tags.filter((t) => t !== tagToRemove));
  };

  // Live Test Connection handler
  const handleTestConnection = async () => {
    const targetEndpoint = getActualEndpoint();
    if (
      !targetEndpoint ||
      targetEndpoint === "https://" ||
      targetEndpoint === "http://"
    ) {
      setError("Por favor ingresa un host, URL o IP válido para probar.");
      return;
    }

    if (targetType === "tcp" && (!tcpHost.trim() || !tcpPort.trim())) {
      setError("En modo TCP debes especificar Host y Puerto.");
      return;
    }

    setTestingConnection(true);
    setTestResult(null);
    setError("");

    try {
      let custom_headers = {};
      if (headersJson.trim()) {
        try {
          custom_headers = JSON.parse(headersJson);
        } catch {
          setError("El formato JSON de los encabezados es inválido.");
          setTestingConnection(false);
          return;
        }
      }

      const res = await diagnostic.run("/monitoring/test-connection/", {
        endpoint: targetEndpoint,
        target_type: targetType,
        http_method: httpMethod,
        expected_status: expectedStatus,
        max_latency_ms: maxLatencyMs,
        custom_headers,
        request_body: requestBody,
      });

      setTestResult(res.data?.data || null);
    } catch (caughtError: unknown) {
      const err = apiFailure(caughtError);
      if (diagnostic.isLimit(err)) return;
      setTestResult({
        status: "down",
        message:
          err.response?.data?.message ||
          "Error al contactar el servidor de diagnóstico.",
      });
    } finally {
      setTestingConnection(false);
    }
  };

  // Submit Handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const targetEndpoint = getActualEndpoint();

    if (!name.trim()) {
      setError("El nombre del objetivo es requerido.");
      setActiveTab("general");
      return;
    }

    if (
      !targetEndpoint ||
      targetEndpoint === "https://" ||
      targetEndpoint === "http://"
    ) {
      setError("El endpoint o dirección de destino es requerido.");
      setActiveTab("general");
      return;
    }

    if (targetType === "tcp" && (!tcpHost.trim() || !tcpPort.trim())) {
      setError(
        "Para conexiones TCP debes especificar Host y Puerto (ej: 10.138.15.10:389).",
      );
      setActiveTab("general");
      return;
    }

    let parsedHeaders = {};
    if (headersJson.trim()) {
      try {
        parsedHeaders = JSON.parse(headersJson);
      } catch {
        setError("El JSON de encabezados no es válido.");
        setActiveTab("http");
        return;
      }
    }

    setLoading(true);
    try {
      await onSubmit({
        ...(!target && !autoCoverage ? { related_modules: [] } : {}),
        ...(!target && user?.authorization_mode === "custom"
          ? { auto_coverage: autoCoverage }
          : {}),
        name: name.trim(),
        target_type: targetType,
        endpoint: targetEndpoint,
        interval: Number(interval),
        enabled,
        http_method: httpMethod,
        expected_status: Number(expectedStatus),
        custom_headers: parsedHeaders,
        request_body: requestBody,
        max_latency_ms: Number(maxLatencyMs),
        tags,
        owner_team: ownerTeam || null,
        runner_type: runnerType,
        agent_probe:
          runnerType === "agent" && agentProbeId ? agentProbeId : null,
      });
      onClose();
    } catch (caughtError: unknown) {
      const err = apiFailure(caughtError);
      setError(
        err.response?.data?.message ||
          err.message ||
          "Error al guardar el target de monitoreo.",
      );
    } finally {
      setLoading(false);
    }
  };

  const isHttpType =
    targetType === "http" || targetType === "https" || targetType === "api";
  return {
    activeTab,
    setActiveTab,
    showTemplates,
    setShowTemplates,
    templatesRef,
    name,
    setName,
    targetType,
    setTargetType,
    endpoint,
    setEndpoint,
    interval,
    setInterval,
    enabled,
    setEnabled,
    autoCoverage,
    canAutoProvision,
    setAutoCoverage,
    ownerTeam,
    setOwnerTeam,
    runnerType,
    setRunnerType,
    agentProbeId,
    setAgentProbeId,
    teams,
    probes,
    subData,
    minAllowedInterval,
    tcpHost,
    setTcpHost,
    tcpPort,
    setTcpPort,
    tags,
    tagInputText,
    setTagInputText,
    httpMethod,
    setHttpMethod,
    expectedStatus,
    setExpectedStatus,
    maxLatencyMs,
    setMaxLatencyMs,
    headersJson,
    setHeadersJson,
    requestBody,
    setRequestBody,
    diagnostic,
    testingConnection,
    testResult,
    setTestResult,
    loading,
    error,
    getActualEndpoint,
    handleProtocolChange,
    applyTemplate,
    addTag,
    removeTag,
    handleTestConnection,
    handleSubmit,
    isHttpType,
  };
}
