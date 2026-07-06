import { EXTENSION_CUSTOMIZATION } from "../customization";

export const CLIENT_BASE_DOMAIN = EXTENSION_CUSTOMIZATION.api.clientBaseDomain;
export const WHATSAPP_WEB_ORIGIN = EXTENSION_CUSTOMIZATION.whatsappWebOrigin;
export const WHATSAPP_WEB_URL_PREFIX = `${WHATSAPP_WEB_ORIGIN}/`;

// Keep these limits conservative. WhatsApp Web storage is large, varies by account,
// and runs inside the user's tab. Large reads can freeze the page or exceed MV3 limits.
export const IMPORT_CHUNK_ITEMS = EXTENSION_CUSTOMIZATION.importLimits.chunkItems;
export const IMPORT_HISTORY_CHAT_LIMIT = EXTENSION_CUSTOMIZATION.importLimits.historyChatLimit;
export const DEFAULT_INCLUDE_HISTORY = EXTENSION_CUSTOMIZATION.importDefaults.includeHistory;
export const API_AUTH_HEADER_NAME = EXTENSION_CUSTOMIZATION.api.authHeaderName;
export const APP_BRIDGE_SOURCE = EXTENSION_CUSTOMIZATION.appBridge.source;
export const APP_BRIDGE_MATCHES = [...EXTENSION_CUSTOMIZATION.appBridge.matches];

export const AUTOFILL_PARAMS = {
  client: "client",
  token: "token"
} as const;

export const STORAGE_KEYS = {
  serverUrl: "serverUrl",
  instanceToken: "instanceToken",
  includeHistory: "includeHistory",
  disconnectLocal: "disconnectLocal",
  bridgeImportRequest: "bridgeImportRequest",
  devMode: "devMode",
  userSettings: "userSettings"
} as const;

// Runtime protocol between the floating panel content script and the MV3 service worker.
// Forks can rename values, but both sides must remain in sync.
export const PORT_NAMES = {
  sessionImport: "session-import"
} as const;

export const BACKGROUND_COMMANDS = {
  startImport: "START_IMPORT",
  importHistoryOnly: "IMPORT_HISTORY_ONLY",
  diagnose: "DIAGNOSE",
  dumpHistory: "DUMP_HISTORY",
  dumpSession: "DUMP_SESSION"
} as const;

export const PORT_MESSAGE_TYPES = {
  status: "STATUS",
  done: "DONE",
  error: "ERROR"
} as const;

export const CONTENT_MESSAGE_TYPES = {
  openPanel: "SESSION_CONNECTOR_OPEN_PANEL"
} as const;

export const APP_BRIDGE_MESSAGE_TYPES = {
  ready: "CONNECTOR_READY",
  ping: "PING",
  startImport: "START_IMPORT",
  openWhatsApp: "OPEN_WHATSAPP",
  started: "IMPORT_TAB_OPENED",
  error: "IMPORT_TAB_ERROR"
} as const;

// API contract expected by this extension. To adapt this project to another API,
// this is the first place to change paths, then adjust src/background/api.ts payloads.
export const API_PATHS = {
  instanceStatus: EXTENSION_CUSTOMIZATION.api.paths.instanceStatus,
  importWebSessionStart: EXTENSION_CUSTOMIZATION.api.paths.importWebSessionStart,
  importWebSessionChunk: EXTENSION_CUSTOMIZATION.api.paths.importWebSessionChunk,
  importWebSessionFinish: EXTENSION_CUSTOMIZATION.api.paths.importWebSessionFinish,
  importWebSessionHistory: EXTENSION_CUSTOMIZATION.api.paths.importWebSessionHistory
} as const;

export const WHATSAPP_LOGGED_IN_SELECTORS = [
  "#side",
  "#pane-side",
  '[data-testid="chat-list"]',
  '[data-testid="conversation-panel-wrapper"]',
  '[aria-label="Chat list"]',
  '[aria-label="Lista de conversas"]',
  '[aria-label="Chats"]',
  '[aria-label="Conversas"]'
];
