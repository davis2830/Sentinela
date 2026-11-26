/**
 * Shared host, URL, port, CIDR, batch-line, and Public Suffix List helpers
 * used across the SSL, DNS, and Domains add/edit modals.
 */

// Common multi-label public suffixes (subset of PSL covering LATAM, Europe, APAC, and major ccTLDs)
const MULTI_LABEL_PUBLIC_SUFFIXES = new Set([
  // Central & South America
  "com.gt",
  "gob.gt",
  "edu.gt",
  "org.gt",
  "net.gt",
  "mil.gt",
  "ind.gt",
  "com.mx",
  "gob.mx",
  "edu.mx",
  "org.mx",
  "net.mx",
  "com.sv",
  "gob.sv",
  "edu.sv",
  "org.sv",
  "com.hn",
  "gob.hn",
  "edu.hn",
  "org.hn",
  "com.ni",
  "gob.ni",
  "edu.ni",
  "org.ni",
  "co.cr",
  "go.cr",
  "ed.cr",
  "or.cr",
  "com.pa",
  "gob.pa",
  "edu.pa",
  "org.pa",
  "com.co",
  "gov.co",
  "edu.co",
  "org.co",
  "net.co",
  "com.br",
  "gov.br",
  "edu.br",
  "org.br",
  "net.br",
  "com.ar",
  "gob.ar",
  "edu.ar",
  "org.ar",
  "com.pe",
  "gob.pe",
  "edu.pe",
  "org.pe",
  "com.ec",
  "gob.ec",
  "edu.ec",
  "org.ec",
  "com.do",
  "gob.do",
  "edu.do",
  "org.do",
  "com.uy",
  "gub.uy",
  "edu.uy",
  "org.uy",
  "com.py",
  "gov.py",
  "edu.py",
  "org.py",
  "com.bo",
  "gob.bo",
  "edu.bo",
  "org.bo",
  "com.ve",
  "gob.ve",
  "edu.ve",
  "org.ve",
  // Europe, UK, APAC & global
  "co.uk",
  "org.uk",
  "gov.uk",
  "ac.uk",
  "me.uk",
  "com.es",
  "nom.es",
  "org.es",
  "gob.es",
  "edu.es",
  "com.pt",
  "org.pt",
  "com.au",
  "net.au",
  "org.au",
  "gov.au",
  "edu.au",
  "co.nz",
  "org.nz",
  "net.nz",
  "co.jp",
  "or.jp",
  "ne.jp",
  "ac.jp",
  "go.jp",
  "co.kr",
  "or.kr",
  "com.cn",
  "net.cn",
  "org.cn",
  "com.hk",
  "com.sg",
  "com.tw",
  "co.in",
  "org.in",
  "net.in",
  "co.za",
  "org.za",
  "com.tr",
  "org.tr",
  "co.il",
  "org.il",
]);

export interface ParsedHostPort {
  host: string;
  port: number | null;
  hadUrlParts: boolean;
}

/**
 * Extracts clean hostname and optional port from a raw input or pasted URL
 * such as "https://api.empresa.com:8443/login?next=1".
 */
export function parseHostAndPort(raw: string): ParsedHostPort {
  const trimmed = raw.trim();
  if (!trimmed) return { host: "", port: null, hadUrlParts: false };

  const hadUrlParts =
    /^https?:\/\//i.test(trimmed) ||
    trimmed.includes("/") ||
    trimmed.includes("?") ||
    trimmed.includes("#");

  let candidate = trimmed;
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(candidate)) {
    try {
      const u = new URL(candidate);
      const parsedPort = u.port ? parseInt(u.port, 10) : null;
      return {
        host: u.hostname.toLowerCase().replace(/\.$/, ""),
        port:
          parsedPort && !Number.isNaN(parsedPort)
            ? parsedPort
            : u.protocol === "https:"
              ? null
              : null,
        hadUrlParts: true,
      };
    } catch {
      // Fallback to string parsing below
    }
  }

  candidate = candidate
    .replace(/^[a-z][a-z0-9+.-]*:\/\//i, "")
    .split(/[/?#]/)[0]
    .trim();

  // Handle host:port (excluding bare IPv6 without brackets)
  const colonIdx = candidate.lastIndexOf(":");
  if (colonIdx > 0 && candidate.indexOf(":") === colonIdx) {
    const maybeHost = candidate.slice(0, colonIdx).trim();
    const maybePortStr = candidate.slice(colonIdx + 1).trim();
    if (/^\d+$/.test(maybePortStr)) {
      const p = parseInt(maybePortStr, 10);
      return {
        host: maybeHost.toLowerCase().replace(/\.$/, ""),
        port: p >= 1 && p <= 65535 ? p : null,
        hadUrlParts: hadUrlParts || true,
      };
    }
  }

  return {
    host: candidate.toLowerCase().replace(/\.$/, ""),
    port: null,
    hadUrlParts,
  };
}

/** Validates standard hostnames (including DNS underscore labels like _dmarc.empresa.com) or IPv4. */
export function isValidHost(
  host: string,
  options?: { allowUnderscore?: boolean; allowSingleLabel?: boolean },
): boolean {
  const clean = host.trim().toLowerCase().replace(/\.$/, "");
  if (!clean || clean.length > 253) return false;
  if (/\s/.test(clean)) return false;

  // IPv4
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(clean)) {
    return clean.split(".").every((oct) => {
      const n = Number(oct);
      return n >= 0 && n <= 255;
    });
  }

  const labels = clean.split(".");
  if (!options?.allowSingleLabel && labels.length < 2) {
    return false;
  }

  const labelRe = options?.allowUnderscore
    ? /^[a-z0-9_]([a-z0-9_-]{0,61}[a-z0-9_])?$/
    : /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/;

  if (!labels.every((l) => l.length >= 1 && l.length <= 63 && labelRe.test(l))) {
    return false;
  }

  // Last label (TLD) should not be purely numeric when multi-label
  if (labels.length >= 2 && /^\d+$/.test(labels[labels.length - 1])) {
    return false;
  }

  return true;
}

export function isValidPort(port: number | string): boolean {
  const n = typeof port === "string" ? Number(port) : port;
  return Number.isInteger(n) && n >= 1 && n <= 65535;
}

/** Detects private IPs, localhost, single-label hosts, and internal corporate suffixes. */
export function isInternalOrPrivateHost(host: string): boolean {
  const clean = host.trim().toLowerCase().replace(/\.$/, "");
  if (!clean) return false;

  if (clean === "localhost" || clean.endsWith(".localhost")) return true;
  if (!clean.includes(".")) return true;
  if (
    /\.(local|internal|lan|corp|home|arpa|intranet|private|docker)$/.test(clean)
  ) {
    return true;
  }

  // RFC1918 & loopback IPv4
  if (/^127\./.test(clean)) return true;
  if (/^10\./.test(clean)) return true;
  if (/^192\.168\./.test(clean)) return true;
  if (/^169\.254\./.test(clean)) return true;
  if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(clean)) return true;

  return false;
}

/**
 * Extracts the registrable (apex) domain using the Public Suffix List subset.
 * Examples:
 * - "servixcloud.gctechops.com" -> "gctechops.com"
 * - "api.empresa.com.gt" -> "empresa.com.gt"
 * - "empresa.com.gt" -> "empresa.com.gt"
 */
export function extractRegistrableDomain(rawHost: string): string {
  const { host } = parseHostAndPort(rawHost);
  if (!host || /^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return host;

  const labels = host.split(".").filter(Boolean);
  if (labels.length <= 2) return host;

  const lastTwo = labels.slice(-2).join(".");
  if (MULTI_LABEL_PUBLIC_SUFFIXES.has(lastTwo)) {
    return labels.length >= 3 ? labels.slice(-3).join(".") : host;
  }
  return lastTwo;
}

/** Converts IPv4/IPv6 values to deduplicated CIDR prefixes (/24 for IPv4, /48 for IPv6). */
export function valuesToCidrPrefixes(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of values) {
    const clean = v.trim();
    if (/^\d{1,3}(\.\d{1,3}){3}$/.test(clean)) {
      const parts = clean.split(".");
      const cidr = `${parts[0]}.${parts[1]}.${parts[2]}.0/24`;
      if (!seen.has(cidr)) {
        seen.add(cidr);
        out.push(cidr);
      }
    } else if (clean.includes(":")) {
      const prefix = clean.split(":").slice(0, 3).join(":") + "::/48";
      if (!seen.has(prefix)) {
        seen.add(prefix);
        out.push(prefix);
      }
    } else if (clean && !seen.has(clean)) {
      seen.add(clean);
      out.push(clean);
    }
  }
  return out;
}

export interface BatchEntry {
  raw: string;
  host: string;
  port: number | null;
  valid: boolean;
  reason?: string;
}

export function parseBatchHostLines(
  text: string,
  options?: { allowUnderscore?: boolean; normalizeApex?: boolean },
): BatchEntry[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const seen = new Set<string>();
  return lines.map((raw) => {
    const parsed = parseHostAndPort(raw);
    const host = options?.normalizeApex
      ? extractRegistrableDomain(parsed.host)
      : parsed.host;

    if (!isValidHost(host, { allowUnderscore: options?.allowUnderscore })) {
      return {
        raw,
        host,
        port: parsed.port,
        valid: false,
        reason: "Host inválido",
      };
    }

    const key = parsed.port ? `${host}:${parsed.port}` : host;
    if (seen.has(key)) {
      return {
        raw,
        host,
        port: parsed.port,
        valid: false,
        reason: "Repetido en la lista",
      };
    }
    seen.add(key);

    return { raw, host, port: parsed.port, valid: true };
  });
}

/** True when a host belongs to a domain tree (exact or subdomain). */
export function matchesDomainTree(host: string, apex: string): boolean {
  const h = host.trim().toLowerCase().replace(/\.$/, "");
  const a = apex.trim().toLowerCase().replace(/\.$/, "");
  if (!h || !a) return false;
  return h === a || h.endsWith(`.${a}`);
}

const VALID_DNS_RECORD_TYPES = new Set([
  "A",
  "AAAA",
  "CNAME",
  "MX",
  "TXT",
  "NS",
  "SOA",
  "SRV",
  "CAA",
  "PTR",
]);

export interface DnsBatchEntry {
  raw: string;
  host: string;
  explicitType: string | null;
  valid: boolean;
  reason?: string;
}

/**
 * Parses batch DNS lines in either "host" (uses selected chips)
 * or "host TYPE" format (e.g. "api.empresa.com A", "empresa.com MX").
 */
export function parseDnsBatchLines(text: string): DnsBatchEntry[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const seen = new Set<string>();
  return lines.map((raw) => {
    const parts = raw.split(/\s+/).filter(Boolean);
    const parsedHost = parseHostAndPort(parts[0] || "");
    const host = parsedHost.host;

    let explicitType: string | null = null;
    if (parts.length >= 2) {
      const candidateType = parts[1].toUpperCase();
      if (!VALID_DNS_RECORD_TYPES.has(candidateType)) {
        return {
          raw,
          host,
          explicitType: null,
          valid: false,
          reason: `Tipo DNS inválido (${parts[1]})`,
        };
      }
      explicitType = candidateType;
    }

    if (!isValidHost(host, { allowUnderscore: true, allowSingleLabel: true })) {
      return {
        raw,
        host,
        explicitType,
        valid: false,
        reason: "Host inválido",
      };
    }

    const dedupKey = `${host}::${explicitType || "*"}`;
    if (seen.has(dedupKey)) {
      return {
        raw,
        host,
        explicitType,
        valid: false,
        reason: "Repetido en la lista",
      };
    }
    seen.add(dedupKey);

    return { raw, host, explicitType, valid: true };
  });
}

