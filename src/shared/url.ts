import { AUTOFILL_PARAMS, CLIENT_BASE_DOMAIN, WHATSAPP_WEB_ORIGIN } from "./config";

export interface AutofillHash {
  client: string;
  token: string;
  hasClient: boolean;
  hasToken: boolean;
}

export function normalizeClientHost(value: unknown): string {
  const host = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/^@+/, "")
    .replace(/\/.*$/, "")
    .replace(/^\.+|\.+$/g, "");
  if (!host) {
    return "";
  }
  if (!/^[a-z0-9][a-z0-9.-]*(?::[0-9]{1,5})?$/.test(host)) {
    throw new Error("Nome da assinatura invalido. Use exatamente o nome da assinatura ou uma URL completa.");
  }
  return host;
}

export function isLocalHost(host: string): boolean {
  return host === "localhost" || host.startsWith("localhost:") || host.startsWith("127.");
}

export function normalizeBaseUrl(value: unknown): string {
  const raw = String(value || "").trim().replace(/\/+$/, "");
  if (!raw) {
    return "";
  }
  if (/^https?:\/\//i.test(raw)) {
    let url: URL;
    try {
      url = new URL(raw);
    } catch {
      throw new Error("URL da instancia invalida.");
    }
    if (url.protocol !== "https:") {
      throw new Error("Use uma URL HTTPS do backend autorizado.");
    }
    if (isLocalHost(url.host)) {
      throw new Error("Use um backend autorizado publico com HTTPS.");
    }
    return raw;
  }
  const host = normalizeClientHost(raw);
  if (!host) {
    return "";
  }
  if (isLocalHost(host)) {
    throw new Error("Use um backend autorizado publico com HTTPS.");
  }
  if (host.includes(".")) {
    return `https://${host}`;
  }
  if (!CLIENT_BASE_DOMAIN) {
    throw new Error("Informe a URL HTTPS completa do backend autorizado.");
  }
  return `https://${host}.${CLIENT_BASE_DOMAIN}`;
}

export function parseAutofillHash(rawUrl: unknown): AutofillHash | null {
  let url: URL;
  try {
    url = new URL(String(rawUrl || ""));
  } catch {
    return null;
  }

  if (url.origin !== WHATSAPP_WEB_ORIGIN) {
    return null;
  }

  const rawHash = url.hash ? url.hash.slice(1) : "";
  if (!rawHash) {
    return null;
  }

  const params = new URLSearchParams(rawHash.startsWith("?") ? rawHash.slice(1) : rawHash);
  const hasClient = params.has(AUTOFILL_PARAMS.client);
  const hasToken = params.has(AUTOFILL_PARAMS.token);
  if (!hasClient && !hasToken) {
    return null;
  }

  return {
    client: String(params.get(AUTOFILL_PARAMS.client) || "").trim(),
    token: String(params.get(AUTOFILL_PARAMS.token) || "").trim(),
    hasClient,
    hasToken
  };
}

export function removeAutofillHashParams(rawUrl: unknown): string | null {
  let url: URL;
  try {
    url = new URL(String(rawUrl || ""));
  } catch {
    return null;
  }

  const rawHash = url.hash ? url.hash.slice(1) : "";
  if (!rawHash) {
    return null;
  }

  const params = new URLSearchParams(rawHash.startsWith("?") ? rawHash.slice(1) : rawHash);
  let changed = false;
  for (const key of [AUTOFILL_PARAMS.client, AUTOFILL_PARAMS.token]) {
    if (params.has(key)) {
      params.delete(key);
      changed = true;
    }
  }
  if (!changed) {
    return null;
  }

  const nextHash = params.toString();
  url.hash = nextHash ? nextHash : "";
  return url.toString();
}
