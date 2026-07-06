// @ts-nocheck
import {
  DEFAULT_INCLUDE_HISTORY,
  STORAGE_KEYS,
  WHATSAPP_WEB_URL_PREFIX
} from "../shared/config";
import {
  APP_BRIDGE_MESSAGE_TYPES,
  BACKGROUND_COMMANDS,
  CONTENT_MESSAGE_TYPES,
  PORT_MESSAGE_TYPES,
  PORT_NAMES,
  type ImportOptions,
  type RuntimeCommandMessage,
  type StatusPayload
} from "../shared/messages";
import { normalizeBaseUrl } from "../shared/url";
import {
  uploadHistoryOnlyPayload,
  uploadWhatsmeowPayload,
  verifyInstanceForImport
} from "./api";
import { buildWhatsmeowPayload, normalizeContactForWhatsmeow, normalizeHistoryJIDsWithContactLIDMap } from "./conversion";
import { importPayloadForOptions } from "./payload";
import {
  clearWhatsAppWebLocalSessionFromTab,
  extractInventoryFromTab,
  extractMainDumpFromTab,
  extractSidecarFromTab,
  isWhatsAppWebLoggedInTab
} from "./tab";

// The vendor migrator is built as a separate MV3-safe global bundle.
importScripts("vendor/wa-store-migrate.bundle.js");

const runningImports = new Set();
const SESSION_STABILITY_POLLS = 2;
const SESSION_STABILITY_MAX_ATTEMPTS = 8;
const SESSION_STABILITY_INTERVAL_MS = 1200;

function postToPort(port, payload) {
  try {
    port.postMessage(payload);
  } catch (error) {
    console.warn("Failed to post import status", error);
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function scheduleWhatsAppTabReload(tabId) {
  if (!tabId) {
    return;
  }
  setTimeout(() => {
    chrome.tabs.reload(tabId, { bypassCache: true }).catch((error) => {
      console.warn("Failed to reload WhatsApp Web after local cleanup", error);
    });
  }, 1000);
}

function historyImportSummary(result, payload) {
  return `histórico repassado: contatos=${result.contacts || payload.contacts.length}, perfis=${result.contactProfiles || 0}, store=${result.storeContacts || 0}, chats=${result.historyChats || payload.history.chats?.length || 0}, mensagens=${result.historyMsgs || payload.history.messages?.length || 0}, mappings=${result.lidMappings || 0}`;
}

function importSummaryText(result, importPayload, includeHistory, cleanup, connectResult, historyImport) {
  const imported = result.imported || {};
  const cleanupWarning = cleanup && cleanup.error ? "; limpeza local falhou: " + cleanup.error : "";
  const connectNote = connectResult?.queued ? "; conexão em andamento" : "";
  const historyNote = !includeHistory
    ? "; histórico ignorado"
    : historyImport?.error
      ? "; histórico não repassado: " + historyImport.error
      : historyImport?.message
        ? "; " + historyImport.message
        : "; histórico não repassado";
  return "Importação concluída" + historyNote + cleanupWarning + connectNote + ". jid=" + (result.jid || importPayload.device?.meJid || "n/a") + ", contatos=" + (imported.contacts || 0) + ", chunks=" + (result.chunks || 0);
}

function sessionDumpCompleteness(dump) {
  const device = dump?.device || {};
  return {
    meJid: String(device.meJid || ""),
    hasNoiseKey: Boolean(device.noiseKey),
    hasIdentityKey: Boolean(device.identityKey),
    hasAccount: Boolean(device.account),
    complete: Boolean(device.meJid && device.noiseKey && device.identityKey && device.account)
  };
}

function incompleteSessionReason(state) {
  const missing = [];
  if (!state.meJid) missing.push("jid");
  if (!state.hasNoiseKey) missing.push("noiseKey");
  if (!state.hasIdentityKey) missing.push("identityKey");
  if (!state.hasAccount) missing.push("account");
  return missing.length ? `Sessão incompleta: ${missing.join(", ")}` : "Sessão ainda não estabilizou";
}

function userFacingErrorMessage(error) {
  const message = String(error?.message || error || "");
  if (message.includes("noiseKey")) {
    return "A sessão ainda não liberou a noiseKey. Aguarde o WhatsApp Web terminar de carregar e tente novamente.";
  }
  if (message.includes("identityKey") || message.includes("account") || message.includes("Sessão incompleta")) {
    return message;
  }
  if (message.includes("A instância precisa estar desconectada")) {
    return message;
  }
  if (message.includes("Failed to fetch") || message.includes("NetworkError")) {
    return "Falha de rede ao conectar. Confira o nome da assinatura, a conexão e as permissões da extensão.";
  }
  if (message.includes("Falha ao enviar chunk")) {
    return `${message}. A importação foi interrompida antes da finalização.`;
  }
  if (message.includes("API não retornou jobId")) {
    return "A API iniciou a importação sem retornar jobId. Verifique o contrato do endpoint /start.";
  }
  if (message.includes("Não foi possível capturar a sessão")) {
    return "Não foi possível capturar a sessão. Recarregue o WhatsApp Web, aguarde conectar e tente novamente.";
  }
  if (message.includes("Não foi possível capturar o histórico")) {
    return "Não foi possível capturar dados auxiliares/histórico do WhatsApp Web.";
  }
  return message || "Falha ao executar comando";
}

async function waitForStableMainDump(tabId, onStatus) {
  let stableJid = "";
  let stableCount = 0;
  let lastState = null;
  for (let attempt = 1; attempt <= SESSION_STABILITY_MAX_ATTEMPTS; attempt += 1) {
    const dump = await extractMainDumpFromTab(tabId, { download: false, includeDump: true, includeContacts: false });
    const state = sessionDumpCompleteness(dump);
    lastState = state;
    if (state.complete && state.meJid === stableJid) {
      stableCount += 1;
    } else {
      stableJid = state.meJid;
      stableCount = state.complete ? 1 : 0;
    }
    if (state.complete && stableCount >= SESSION_STABILITY_POLLS) {
      return dump;
    }
    onStatus?.({
      message: `${incompleteSessionReason(state)}. Tentando novamente ${attempt}/${SESSION_STABILITY_MAX_ATTEMPTS}...`
    });
    await sleep(SESSION_STABILITY_INTERVAL_MS);
  }
  throw new Error(`${incompleteSessionReason(lastState || {})}. Aguarde o WhatsApp Web terminar de carregar e tente novamente.`);
}

function buildHistoryOnlyPayloadFromDump(dump) {
  const contacts = Array.isArray(dump.contacts)
    ? dump.contacts.map(normalizeContactForWhatsmeow).filter(Boolean)
    : [];
  return {
    contacts,
    history: normalizeHistoryJIDsWithContactLIDMap(dump.history || { chats: [], messages: [] }, contacts)
  };
}

async function captureAndUploadHistory(tabId, serverUrl, token, onStatus) {
  onStatus({ message: "Capturando histórico..." });
  const dump = await extractSidecarFromTab(tabId);
  const payload = buildHistoryOnlyPayloadFromDump(dump);
  onStatus({ message: "Repassando histórico..." });
  const result = await uploadHistoryOnlyPayload(serverUrl, token, payload);
  const message = historyImportSummary(result, payload);
  onStatus({ message: "Sessão importada; " + message + ".", kind: "ok" });
  return { result, payload, message };
}

async function runFloatingImport(tab, options, onStatus) {
  if (!tab || !tab.id || !String(tab.url || "").startsWith(WHATSAPP_WEB_URL_PREFIX)) {
    throw new Error("Abra uma aba do WhatsApp Web conectado");
  }
  if (runningImports.has(tab.id)) {
    throw new Error("Já existe uma importação em andamento nesta aba");
  }
  if (!(await isWhatsAppWebLoggedInTab(tab.id))) {
    throw new Error("Entre no WhatsApp Web antes de importar a sessão");
  }

  runningImports.add(tab.id);
  try {
    const client = String(options?.client || "").trim();
    const token = String(options?.token || "").trim();
    const includeHistory = options?.includeHistory === undefined ? DEFAULT_INCLUDE_HISTORY : options?.includeHistory === true;
    const disconnectLocal = options?.disconnectLocal !== false;
    if (!client || !token) {
      throw new Error("Informe o nome da assinatura e o token");
    }

    const serverUrl = normalizeBaseUrl(client);
    await chrome.storage.local.set({
      [STORAGE_KEYS.serverUrl]: client,
      [STORAGE_KEYS.instanceToken]: token,
      [STORAGE_KEYS.includeHistory]: includeHistory,
      [STORAGE_KEYS.disconnectLocal]: disconnectLocal
    });

    onStatus({ message: "Validando instância..." });
    await verifyInstanceForImport(serverUrl, token);

    onStatus({ message: "Capturando e validando sessão..." });
    const mainDump = await waitForStableMainDump(tab.id, onStatus);
    if (!mainDump || !mainDump.device) {
      throw new Error("Captura da sessão não retornou dados");
    }

    onStatus({ message: "Convertendo para whatsmeow..." });
    const converted = buildWhatsmeowPayload(mainDump, null);
    // Session import must stay independent from WhatsApp Web history. History is
    // useful, but it is cache-derived and may fail for account-specific reasons.
    const importPayload = importPayloadForOptions(converted.payload, { includeHistory: false });

    onStatus({ message: "Enviando chunks..." });
    const result = await uploadWhatsmeowPayload(serverUrl, token, importPayload, {
      onProgress: (done, total, section) => {
        onStatus({ message: "Enviando chunks " + done + "/" + total + " (" + section + ")..." });
      }
    });

    let historyImport = null;
    if (includeHistory) {
      try {
        historyImport = await captureAndUploadHistory(tab.id, serverUrl, token, onStatus);
      } catch (historyError) {
        const message = userFacingErrorMessage(historyError);
        historyImport = { error: message };
        console.warn("Optional WhatsApp history import failed after successful session import", historyError);
        onStatus({ message: "Sessão importada. Histórico não foi repassado: " + message, kind: "warn" });
      }
    }

    let cleanup = null;
    if (disconnectLocal) {
      onStatus({ message: "Importação concluída. Desconectando WhatsApp Web local...", kind: "ok" });
      try {
        cleanup = await clearWhatsAppWebLocalSessionFromTab(tab);
        onStatus({ message: "Aguardando limpeza local..." });
        await sleep(1200);
      } catch (cleanupError) {
        cleanup = { error: cleanupError.message || "Falha ao limpar dados locais do WhatsApp Web" };
        console.warn("WhatsApp Web local cleanup failed after successful import", cleanupError);
      }
    }

    let connectResult = null;
    if (disconnectLocal && !(cleanup && cleanup.error)) {
      if (result.connect_queued === true) {
        connectResult = { queued: true };
        onStatus({ message: "Conexão da instância em andamento.", kind: "ok" });
      }
    }
    const kind = historyImport?.error ? "warn" : "ok";

    return {
      message: importSummaryText(result, importPayload, includeHistory, cleanup, connectResult, historyImport),
      result,
      cleanup,
      connect: connectResult,
      history: historyImport,
      includeHistory,
      kind,
      reloadWhatsAppTab: disconnectLocal && !(cleanup && cleanup.error),
      losses: converted.losses
    };
  } finally {
    runningImports.delete(tab.id);
  }
}

async function runHistoryOnlyImport(tab, options, onStatus) {
  if (!tab || !tab.id || !String(tab.url || "").startsWith(WHATSAPP_WEB_URL_PREFIX)) {
    throw new Error("Abra uma aba do WhatsApp Web conectado");
  }
  if (!(await isWhatsAppWebLoggedInTab(tab.id))) {
    throw new Error("Entre no WhatsApp Web antes de repassar o histórico");
  }

  const client = String(options?.client || "").trim();
  const token = String(options?.token || "").trim();
  if (!client || !token) {
    throw new Error("Informe o nome da assinatura e o token");
  }
  const serverUrl = normalizeBaseUrl(client);
  await chrome.storage.local.set({
    [STORAGE_KEYS.serverUrl]: client,
    [STORAGE_KEYS.instanceToken]: token
  });

  onStatus({ message: "Capturando histórico..." });
  const dump = await extractSidecarFromTab(tab.id);
  const payload = buildHistoryOnlyPayloadFromDump(dump);

  onStatus({ message: "Repassando histórico..." });
  const result = await uploadHistoryOnlyPayload(serverUrl, token, payload);
  return {
    message: "Histórico repassado. " + historyImportSummary(result, payload).replace("histórico repassado: ", ""),
    result,
    includeHistory: true
  };
}

function ensureWhatsAppTab(tab) {
  if (!tab || !tab.id || !String(tab.url || "").startsWith(WHATSAPP_WEB_URL_PREFIX)) {
    throw new Error("Abra uma aba do WhatsApp Web conectado");
  }
}

function timestampForFilename() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

async function runTechnicalCommand(tab, type, onStatus) {
  ensureWhatsAppTab(tab);
  if (type === BACKGROUND_COMMANDS.diagnose) {
    onStatus({ message: "Diagnosticando armazenamento..." });
    const inventory = await extractInventoryFromTab(tab.id);
    const dbCount = inventory.indexedDB ? inventory.indexedDB.length : 0;
    const storeCount = (inventory.indexedDB || []).reduce((sum, db) => sum + (db.stores ? db.stores.length : 0), 0);
    return {
      message: `Diagnóstico gerado. bancos=${dbCount}, áreas=${storeCount}`,
      download: {
        filename: `whatsapp-web-storage-inventory-${timestampForFilename()}.json`,
        data: inventory
      }
    };
  }

  if (type === BACKGROUND_COMMANDS.dumpHistory) {
    onStatus({ message: "Capturando histórico..." });
    const dump = await extractSidecarFromTab(tab.id);
    const messagesWithText = dump.counts?.historyMessagesWithText || 0;
    return {
      message: `Dump gerado. contatos=${dump.contacts.length}, chats=${dump.history.chats.length}, mensagens=${dump.history.messages.length}, com texto=${messagesWithText}, tokens=${dump.privacyTokens.length}`,
      download: {
        filename: `whatsapp-web-sidecar-${timestampForFilename()}.json`,
        data: dump
      }
    };
  }

  if (type === BACKGROUND_COMMANDS.dumpSession) {
    onStatus({ message: "Capturando sessão..." });
    const dump = await extractMainDumpFromTab(tab.id);
    return {
      message: `Sessão gerada. arquivo=${dump.filename}, jid=${dump.meJid || "n/a"}, sessões=${dump.sessions}, preKeys=${dump.preKeys}`
    };
  }

  throw new Error("Comando técnico desconhecido");
}

chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== PORT_NAMES.sessionImport) {
    return;
  }
  const tab = port.sender?.tab;
  port.onMessage.addListener((message) => {
    if (!message || !message.type) {
      return;
    }
    const statusCallback = (status) => {
      postToPort(port, { type: PORT_MESSAGE_TYPES.status, ...status });
    };
    const runner =
      message.type === BACKGROUND_COMMANDS.startImport
        ? runFloatingImport(tab, message.options || {}, statusCallback)
        : message.type === BACKGROUND_COMMANDS.importHistoryOnly
          ? runHistoryOnlyImport(tab, message.options || {}, statusCallback)
          : runTechnicalCommand(tab, message.type, statusCallback);
    runner
      .then((payload) => {
        postToPort(port, { type: PORT_MESSAGE_TYPES.done, kind: payload.kind || "ok", message: payload.message, payload });
        if (payload.reloadWhatsAppTab) {
          scheduleWhatsAppTabReload(tab?.id);
        }
      })
      .catch((error) => {
        console.warn("Session connector command failed", error);
        postToPort(port, { type: PORT_MESSAGE_TYPES.error, kind: "error", message: userFacingErrorMessage(error) });
      });
  });
});

async function openPanelInTab(tab, source = "action") {
  if (!isWhatsAppWebTab(tab)) {
    return false;
  }
  const message = { type: CONTENT_MESSAGE_TYPES.openPanel, source };
  try {
    await chrome.tabs.sendMessage(tab.id, message);
    return true;
  } catch {}

  try {
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["autofill.js"] });
    await chrome.tabs.sendMessage(tab.id, message);
    return true;
  } catch (error) {
    console.warn("Failed to open floating panel", error);
    return false;
  }
}

function optionalBoolean(value) {
  if (value === true || value === "true" || value === "1" || value === 1) {
    return true;
  }
  if (value === false || value === "false" || value === "0" || value === 0) {
    return false;
  }
  return undefined;
}

function bridgeImportRequestFromMessage(message) {
  const includeHistory = optionalBoolean(message.includeHistory);
  const hideHistoryOption = optionalBoolean(message.hideHistoryOption);
  const lockHistoryOption = optionalBoolean(message.lockHistoryOption);
  const hideClientField = optionalBoolean(message.hideClientField);
  const hideTokenField = optionalBoolean(message.hideTokenField);
  const lockClientField = optionalBoolean(message.lockClientField);
  const lockTokenField = optionalBoolean(message.lockTokenField);
  const request = {
    id: `bridge-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    createdAt: Date.now(),
    client: String(message.client || "").trim(),
    token: String(message.token || "").trim()
  };
  if (includeHistory !== undefined) {
    request.includeHistory = includeHistory;
  }
  if (hideHistoryOption !== undefined) {
    request.hideHistoryOption = hideHistoryOption;
  }
  if (lockHistoryOption !== undefined) {
    request.lockHistoryOption = lockHistoryOption;
  }
  if (hideClientField !== undefined) {
    request.hideClientField = hideClientField;
  }
  if (hideTokenField !== undefined) {
    request.hideTokenField = hideTokenField;
  }
  if (lockClientField !== undefined) {
    request.lockClientField = lockClientField;
  }
  if (lockTokenField !== undefined) {
    request.lockTokenField = lockTokenField;
  }
  if (message.panelLayout === "center" || message.panelLayout === "corner") {
    request.panelLayout = message.panelLayout;
  }
  return request;
}

function isWhatsAppWebTab(tab) {
  return Boolean(tab?.id && String(tab.url || tab.pendingUrl || "").startsWith(WHATSAPP_WEB_URL_PREFIX));
}

function newestTab(tabs) {
  return [...tabs].sort((a, b) => Number(b.lastAccessed || 0) - Number(a.lastAccessed || 0))[0] || null;
}

async function activeWhatsAppTab(preferredWindowId) {
  const tabs = await chrome.tabs.query({ url: `${WHATSAPP_WEB_URL_PREFIX}*` });
  const whatsappTabs = tabs.filter(isWhatsAppWebTab);
  if (typeof preferredWindowId === "number") {
    const sameWindowTab = newestTab(whatsappTabs.filter((tab) => tab.windowId === preferredWindowId));
    if (sameWindowTab) {
      return sameWindowTab;
    }
  }
  return newestTab(whatsappTabs);
}

async function activateTab(tab) {
  const activeTab = await chrome.tabs.update(tab.id, { active: true });
  if (tab.windowId) {
    await chrome.windows.update(tab.windowId, { focused: true }).catch(() => null);
  }
  return activeTab || tab;
}

function waitForWhatsAppTabReady(tab, timeoutMs = 15000) {
  if (!tab?.id) {
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(listener);
      resolve(null);
    }, timeoutMs);
    const listener = (tabId, changeInfo, updatedTab) => {
      if (tabId !== tab.id || !isWhatsAppWebTab(updatedTab)) {
        return;
      }
      if (changeInfo.status === "complete" || updatedTab.status === "complete") {
        clearTimeout(timeout);
        chrome.tabs.onUpdated.removeListener(listener);
        resolve(updatedTab);
      }
    };
    chrome.tabs.onUpdated.addListener(listener);
  });
}

async function openPanelWhenTabReady(tab, source = "action") {
  if (await openPanelInTab(tab, source)) {
    return true;
  }
  const readyTab = await waitForWhatsAppTabReady(tab);
  return readyTab ? openPanelInTab(readyTab, source) : false;
}

async function openFromActionClick(tab) {
  if (isWhatsAppWebTab(tab)) {
    await openPanelWhenTabReady(tab, "action");
    return;
  }
  const existing = await activeWhatsAppTab(tab?.windowId);
  if (existing) {
    await openPanelWhenTabReady(await activateTab(existing), "action");
    return;
  }
  await openPanelWhenTabReady(await chrome.tabs.create({ url: WHATSAPP_WEB_URL_PREFIX, active: true }), "action");
}

async function openWhatsAppWithBridgeOptions(message) {
  const request = bridgeImportRequestFromMessage(message);
  const values = {
    [STORAGE_KEYS.bridgeImportRequest]: request,
    [STORAGE_KEYS.serverUrl]: request.client,
    [STORAGE_KEYS.instanceToken]: request.token
  };
  if (request.includeHistory !== undefined) {
    values[STORAGE_KEYS.includeHistory] = request.includeHistory;
  }
  await chrome.storage.local.set(values);

  const existing = await activeWhatsAppTab();
  const tab = existing
    ? await activateTab(existing)
    : await chrome.tabs.create({ url: WHATSAPP_WEB_URL_PREFIX, active: true });

  if (existing) {
    await openPanelInTab(tab, "bridge");
  }

  return { ok: true, tabId: tab.id, reused: Boolean(existing) };
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message) {
    return false;
  }
  if (message.type === APP_BRIDGE_MESSAGE_TYPES.ping) {
    sendResponse({ ok: true, version: chrome.runtime.getManifest().version });
    return false;
  }
  if (message.type !== APP_BRIDGE_MESSAGE_TYPES.startImport) {
    return false;
  }
  openWhatsAppWithBridgeOptions(message)
    .then(sendResponse)
    .catch((error) => sendResponse({ ok: false, error: error.message || "Falha ao abrir WhatsApp Web" }));
  return true;
});

chrome.action.onClicked.addListener((tab) => {
  openFromActionClick(tab).catch((error) => {
    console.warn("Failed to open WhatsApp Web from action click", error);
  });
});
