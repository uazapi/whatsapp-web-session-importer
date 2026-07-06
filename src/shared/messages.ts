import {
  BACKGROUND_COMMANDS,
  APP_BRIDGE_MESSAGE_TYPES,
  CONTENT_MESSAGE_TYPES,
  PORT_MESSAGE_TYPES,
  PORT_NAMES
} from "./config";

export type BackgroundCommandType = (typeof BACKGROUND_COMMANDS)[keyof typeof BACKGROUND_COMMANDS];
export type PortMessageType = (typeof PORT_MESSAGE_TYPES)[keyof typeof PORT_MESSAGE_TYPES];
export type ContentMessageType = (typeof CONTENT_MESSAGE_TYPES)[keyof typeof CONTENT_MESSAGE_TYPES];
export type AppBridgeMessageType = (typeof APP_BRIDGE_MESSAGE_TYPES)[keyof typeof APP_BRIDGE_MESSAGE_TYPES];

// Options collected by the floating panel and sent to the service worker. Keep
// this object small: secrets stay only in chrome.storage + runtime messages.
export interface ImportOptions {
  client?: string;
  token?: string;
  includeHistory?: boolean;
  disconnectLocal?: boolean;
  hideHistoryOption?: boolean;
  lockHistoryOption?: boolean;
  hideClientField?: boolean;
  hideTokenField?: boolean;
  lockClientField?: boolean;
  lockTokenField?: boolean;
  panelLayout?: "corner" | "center";
}

export interface BridgeImportRequest extends ImportOptions {
  id?: string;
  createdAt?: number;
}

export interface StatusPayload {
  message?: string;
  kind?: "ok" | "warn" | "error" | "";
}

export interface RuntimeCommandMessage {
  type: BackgroundCommandType;
  options?: ImportOptions;
}

// Messages sent back through the long-lived port so the panel can stream status
// while the MV3 service worker performs extraction/upload work.
export type RuntimePortMessage =
  | ({ type: typeof PORT_MESSAGE_TYPES.status } & StatusPayload)
  | { type: typeof PORT_MESSAGE_TYPES.done; kind: "ok" | "warn"; message: string; payload?: any }
  | { type: typeof PORT_MESSAGE_TYPES.error; kind: "error"; message: string };

export interface OpenPanelMessage {
  type: typeof CONTENT_MESSAGE_TYPES.openPanel;
  source?: "action" | "bridge";
}

export { APP_BRIDGE_MESSAGE_TYPES, BACKGROUND_COMMANDS, CONTENT_MESSAGE_TYPES, PORT_MESSAGE_TYPES, PORT_NAMES };
