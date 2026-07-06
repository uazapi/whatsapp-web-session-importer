import { APP_BRIDGE_MESSAGE_TYPES, APP_BRIDGE_SOURCE } from "../shared/config";

type PageCommand = {
  target?: string;
  type?: string;
  client?: string;
  token?: string;
  includeHistory?: boolean | string | number;
  hideHistoryOption?: boolean | string | number;
  lockHistoryOption?: boolean | string | number;
  hideClientField?: boolean | string | number;
  hideTokenField?: boolean | string | number;
  lockClientField?: boolean | string | number;
  lockTokenField?: boolean | string | number;
  panelLayout?: string;
  requestId?: string;
};

const guard = window as Window & { __whatsAppSessionConnectorBridge?: boolean };

if (!guard.__whatsAppSessionConnectorBridge) {
  guard.__whatsAppSessionConnectorBridge = true;

  const buildResponse = (data: PageCommand | undefined, payload: Record<string, unknown>) => ({
    source: APP_BRIDGE_SOURCE,
    requestId: data?.requestId || "",
    ...payload
  });

  const postTo = (target: MessageEventSource | null, origin: string, payload: Record<string, unknown>) => {
    const receiver = target as Window | null;
    if (!receiver || typeof receiver.postMessage !== "function") {
      return;
    }
    receiver.postMessage(payload, origin || "*");
  };

  const runtimeVersion = () => {
    try {
      return chrome.runtime?.getManifest?.().version || "";
    } catch {
      return null;
    }
  };

  const sendRuntimeMessage = (payload: Record<string, unknown>) => {
    try {
      if (!chrome.runtime?.sendMessage) {
        return Promise.reject(new Error("Extension context unavailable"));
      }
      return chrome.runtime.sendMessage(payload);
    } catch (error) {
      return Promise.reject(error);
    }
  };

  const announce = (target: MessageEventSource | null = window, origin = "*", data?: PageCommand, versionOverride?: string) => {
    const version = versionOverride === undefined ? runtimeVersion() : versionOverride;
    if (version === null) {
      return;
    }
    postTo(target, origin, buildResponse(data, {
      source: APP_BRIDGE_SOURCE,
      type: APP_BRIDGE_MESSAGE_TYPES.ready,
      version
    }));
  };

  const announceEverywhere = () => {
    announce(window, "*");
    if (window.parent && window.parent !== window) {
      announce(window.parent, "*");
    }
  };

  const isSupportedSource = (event: MessageEvent) => {
    if (event.source === window) {
      return true;
    }
    return Boolean(window.parent && window.parent !== window && event.source === window.parent);
  };

  window.addEventListener("message", (event) => {
    if (!isSupportedSource(event)) {
      return;
    }
    const data = event.data as PageCommand | undefined;
    if (!data || data.target !== APP_BRIDGE_SOURCE) {
      return;
    }

    if (data.type === APP_BRIDGE_MESSAGE_TYPES.ping) {
      void sendRuntimeMessage({ type: APP_BRIDGE_MESSAGE_TYPES.ping })
        .then((response) => {
          if (response?.ok) {
            announce(event.source, event.origin || "*", data, response.version || "");
          }
        })
        .catch(() => {
          // Stale content scripts can remain after the extension is disabled.
          // In that case, do not answer PING; the SDK will timeout as not installed.
        });
      return;
    }

    if (data.type === APP_BRIDGE_MESSAGE_TYPES.startImport || data.type === APP_BRIDGE_MESSAGE_TYPES.openWhatsApp) {
      void sendRuntimeMessage({
        type: APP_BRIDGE_MESSAGE_TYPES.startImport,
        client: data.client || "",
        token: data.token || "",
        includeHistory: data.includeHistory,
        hideHistoryOption: data.hideHistoryOption,
        lockHistoryOption: data.lockHistoryOption,
        hideClientField: data.hideClientField,
        hideTokenField: data.hideTokenField,
        lockClientField: data.lockClientField,
        lockTokenField: data.lockTokenField,
        panelLayout: data.panelLayout
      })
        .then((response) => {
          postTo(event.source, event.origin || "*", buildResponse(data, {
            type: response?.ok ? APP_BRIDGE_MESSAGE_TYPES.started : APP_BRIDGE_MESSAGE_TYPES.error,
            error: response?.error || "",
            tabId: response?.tabId || null,
            reused: response?.reused === true
          }));
        })
        .catch((error) => {
          postTo(event.source, event.origin || "*", buildResponse(data, {
            type: APP_BRIDGE_MESSAGE_TYPES.error,
            error: error?.message || "Falha ao abrir WhatsApp Web"
          }));
        });
    }
  });

  announceEverywhere();
}
