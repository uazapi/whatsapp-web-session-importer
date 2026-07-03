import { API_AUTH_HEADER_NAME, API_PATHS } from "../shared/config";
import type { ImportUploadOptions } from "../shared/types";
import { normalizeBaseUrl } from "../shared/url";
import { buildImportChunks, countExpectedRows } from "./chunks";

/**
 * HTTP adapter for the backend import protocol.
 *
 * Authentication is sent in the configured header. A fork can change
 * postJSON/getJSON to use Authorization, query params, signed requests, etc.
 * without touching the UI or WhatsApp extraction logic.
 */

async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function encodeRequestBody(json: string): Promise<{ body: string | ArrayBuffer; encoding: string }> {
  if (!("CompressionStream" in globalThis)) {
    return { body: json, encoding: "" };
  }
  const stream = new Blob([json], { type: "application/json" }).stream().pipeThrough(new CompressionStream("gzip"));
  return { body: await new Response(stream).arrayBuffer(), encoding: "gzip" };
}

function authHeaders(token: string): Record<string, string> {
  return { [API_AUTH_HEADER_NAME]: token };
}

async function postJSON(url: string, token: string, payload: any, failureLabel: string): Promise<any> {
  const json = JSON.stringify(payload);
  const encoded = await encodeRequestBody(json);
  const headers: Record<string, string> = {
    Accept: "application/json",
    "Content-Type": "application/json",
    ...authHeaders(token)
  };
  if (encoded.encoding) {
    headers["Content-Encoding"] = encoded.encoding;
  }
  const response = await fetch(url, { method: "POST", headers, body: encoded.body });
  const text = await response.text();
  let body: any = {};
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = { raw: text };
  }
  if (!response.ok) {
    const reason = body.error || body.message || text || `HTTP ${response.status}`;
    throw new Error(`${failureLabel}: ${reason}`);
  }
  return body;
}

async function postJSONWithRetry(url: string, token: string, payload: any, failureLabel: string): Promise<any> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await postJSON(url, token, payload, failureLabel);
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)));
    }
  }
  throw lastError;
}

async function getJSON(url: string, token: string, failureLabel: string): Promise<any> {
  const response = await fetch(url, {
    method: "GET",
    headers: {
      Accept: "application/json",
      ...authHeaders(token)
    }
  });
  const text = await response.text();
  let body: any = {};
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = { raw: text };
  }
  if (!response.ok) {
    const reason = body.error || body.message || text || `HTTP ${response.status}`;
    throw new Error(`${failureLabel}: ${reason}`);
  }
  return body;
}

export async function verifyInstanceForImport(serverUrl: string, token: string): Promise<any> {
  // Importing over a live instance can create two active clients for the same
  // WhatsApp account. The backend must say the instance is disconnected/importing.
  const payload = await getJSON(`${normalizeBaseUrl(serverUrl)}${API_PATHS.instanceStatus}`, token, "Falha ao validar instância");
  const status = payload.status || {};
  const instanceStatus = String(payload.instance?.status || "").trim().toLowerCase();
  const importableStatuses = new Set(["disconnected", "importing"]);
  if (status.connected || status.loggedIn || (instanceStatus && !importableStatuses.has(instanceStatus))) {
    throw new Error(`A instância precisa estar desconectada antes da importação (status atual: ${instanceStatus || "ativa"})`);
  }
  return payload;
}

async function startImportJob(baseUrl: string, token: string, payload: any): Promise<string> {
  const start = await postJSONWithRetry(
    `${baseUrl}${API_PATHS.importWebSessionStart}`,
    token,
    {
      device: payload.device,
      expected: countExpectedRows(payload)
    },
    "Falha ao iniciar importação"
  );
  const jobId = start.jobId || start.job_id;
  if (!jobId) {
    throw new Error("API não retornou jobId");
  }
  return jobId;
}

async function sendImportChunk(baseUrl: string, token: string, jobId: string, seq: number, total: number, chunk: any): Promise<void> {
  const chunkPayloadJSON = JSON.stringify(chunk.payload);
  await postJSONWithRetry(
    `${baseUrl}${API_PATHS.importWebSessionChunk}`,
    token,
    {
      jobId,
      section: chunk.section,
      seq,
      count: chunk.count,
      sha256: await sha256Hex(chunkPayloadJSON),
      payload: chunk.payload
    },
    `Falha ao enviar chunk ${seq + 1}/${total}`
  );
}

async function finishImportJob(baseUrl: string, token: string, jobId: string): Promise<any> {
  return postJSONWithRetry(
    `${baseUrl}${API_PATHS.importWebSessionFinish}`,
    token,
    { jobId },
    "Falha ao finalizar importação"
  );
}

export async function uploadWhatsmeowPayload(
  serverUrl: string,
  token: string,
  payload: any,
  options: ImportUploadOptions = {}
): Promise<any> {
  const baseUrl = normalizeBaseUrl(serverUrl);
  // 1) start: send device metadata plus expected row counts so the backend can
  // create/import a job, validate totals, and return a jobId.
  const jobId = await startImportJob(baseUrl, token, payload);
  // 2) chunk: send each logical section separately. The payload shape is:
  // { jobId, section, seq, count, sha256, payload }. sha256 is calculated from
  // the JSON chunk payload so another API can reject corrupted/replayed chunks.
  const chunks = buildImportChunks(payload);
  for (let seq = 0; seq < chunks.length; seq += 1) {
    const chunk = chunks[seq];
    await sendImportChunk(baseUrl, token, jobId, seq, chunks.length, chunk);
    options.onProgress?.(seq + 1, chunks.length, chunk.section);
  }
  // 3) finish: asks the backend to validate the received chunks and activate the
  // imported snapshot. Other APIs can map this to a single finalization endpoint.
  return finishImportJob(baseUrl, token, jobId);
}

export async function uploadHistoryOnlyPayload(serverUrl: string, token: string, payload: any): Promise<any> {
  // Technical/dev flow: sends only contacts + history anchors after the main
  // credentials import already exists. Useful for debugging history backfill.
  return postJSONWithRetry(
    `${normalizeBaseUrl(serverUrl)}${API_PATHS.importWebSessionHistory}`,
    token,
    payload,
    "Falha ao repassar histórico"
  );
}
