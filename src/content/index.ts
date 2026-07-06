import { DEFAULT_INCLUDE_HISTORY, STORAGE_KEYS } from "../shared/config";
import {
  BACKGROUND_COMMANDS,
  CONTENT_MESSAGE_TYPES,
  PORT_MESSAGE_TYPES,
  PORT_NAMES
} from "../shared/messages";
import { parseAutofillHash, removeAutofillHashParams } from "../shared/url";
import { applyWhatsAppTheme, isWhatsAppLoggedIn, startWhatsAppThemeWatch } from "./page/whatsapp-page";
import { PANEL_HOST_ID, PANEL_TEXT, panelTemplate } from "./panel/template";

(() => {
  const existingLoader = window.__sessionConnectorLoaded;
  const loaderRuntimeId = (() => {
    try {
      return chrome.runtime?.id || "";
    } catch {
      return "";
    }
  })();
  if (
    existingLoader &&
    typeof existingLoader === "object" &&
    existingLoader.active === true &&
    existingLoader.runtimeId === loaderRuntimeId
  ) {
    return;
  }
  window.__sessionConnectorLoaded = {
    active: true,
    runtimeId: loaderRuntimeId,
    loadedAt: Date.now()
  };

  const DEV_MODE_TOGGLE_CLICKS = 5;
  const DEV_MODE_TOGGLE_WINDOW_MS = 2500;
  const LOGIN_STATUS_REFRESH_MS = 1000;
  const LOGIN_STATUS_DEBOUNCE_MS = 150;
  const DEFAULT_USER_SETTINGS = {
    autoOpenPanel: false,
    themeMode: "auto"
  };
  const DEFAULT_BRIDGE_UI_OPTIONS = {
    hideHistoryOption: false,
    lockHistoryOption: false,
    hideClientField: false,
    hideTokenField: false,
    lockClientField: false,
    lockTokenField: false,
    panelLayout: "corner"
  };

  const state = {
    host: null,
    root: null,
    importRunning: false,
    importPort: null,
    themeObserver: null,
    loginObserver: null,
    loginRefreshTimer: null,
    loginRefreshInterval: null,
    cleanupStarted: false,
    extensionContextInvalidated: false,
    loginReady: false,
    devMode: false,
    settingsOpen: false,
    userSettings: { ...DEFAULT_USER_SETTINGS },
    bridgeUiOptions: { ...DEFAULT_BRIDGE_UI_OPTIONS },
    centerLayoutReady: false,
    devModeClickCount: 0,
    devModeClickTimer: null
  };

  function extensionContextError(error) {
    const message = String(error?.message || error || "");
    return message.includes("Extension context invalidated") ||
      message.includes("context invalidated") ||
      message.includes("Cannot read properties of undefined (reading 'local')") ||
      message.includes("Cannot read properties of undefined (reading 'connect')") ||
      message.includes("Cannot read properties of undefined (reading 'getManifest')");
  }

  function hasExtensionContext() {
    try {
      return typeof chrome !== "undefined" &&
        Boolean(chrome.runtime?.id) &&
        Boolean(chrome.storage?.local);
    } catch {
      return false;
    }
  }

  function markExtensionContextInvalidated() {
    const wasInvalidated = state.extensionContextInvalidated;
    state.extensionContextInvalidated = true;
    if (!wasInvalidated) {
      if (window.__sessionConnectorLoaded && typeof window.__sessionConnectorLoaded === "object") {
        window.__sessionConnectorLoaded.active = false;
      }
      closeImportPort();
      setBusy(false);
    }
    setResult(PANEL_TEXT.extensionInvalidated, "error");
  }

  function handleExtensionContextFailure(error) {
    if (!extensionContextError(error) && hasExtensionContext()) {
      return false;
    }
    markExtensionContextInvalidated();
    return true;
  }

  function warnIfActiveContext(label, error) {
    if (!handleExtensionContextFailure(error)) {
      console.warn(label, error);
    }
  }

  async function storageGet(keys, fallback = {}) {
    if (!hasExtensionContext()) {
      markExtensionContextInvalidated();
      return fallback;
    }
    try {
      return await chrome.storage.local.get(keys);
    } catch (error) {
      if (handleExtensionContextFailure(error)) {
        return fallback;
      }
      throw error;
    }
  }

  async function storageSet(values) {
    if (!hasExtensionContext()) {
      markExtensionContextInvalidated();
      return false;
    }
    try {
      await chrome.storage.local.set(values);
      return true;
    } catch (error) {
      if (handleExtensionContextFailure(error)) {
        return false;
      }
      throw error;
    }
  }

  async function storageRemove(keys) {
    if (!hasExtensionContext()) {
      markExtensionContextInvalidated();
      return false;
    }
    try {
      await chrome.storage.local.remove(keys);
      return true;
    } catch (error) {
      if (handleExtensionContextFailure(error)) {
        return false;
      }
      throw error;
    }
  }

  function extensionVersion() {
    try {
      return chrome.runtime?.getManifest?.().version || "";
    } catch (error) {
      handleExtensionContextFailure(error);
      return "";
    }
  }

  function normalizeUserSettings(value) {
    const raw = value && typeof value === "object" ? value : {};
    const themeMode = ["auto", "light", "dark"].includes(String(raw.themeMode)) ? String(raw.themeMode) : DEFAULT_USER_SETTINGS.themeMode;
    return {
      autoOpenPanel: raw.autoOpenPanel === true,
      themeMode
    };
  }

  function cleanAutofillHash() {
    const nextUrl = removeAutofillHashParams(location.href);
    if (nextUrl) {
      history.replaceState(history.state, document.title || "", nextUrl);
    }
  }

  async function applyAutofillFromUrl() {
    // SaaS/backend pages can open WhatsApp Web with:
    // https://web.whatsapp.com/#client=<client-or-host>&token=<instance-token>
    // The hash is removed immediately after storing values so it is not left in
    // the address bar, screenshots, or browser history.
    const autofill = parseAutofillHash(location.href);
    if (!autofill) {
      return false;
    }

    cleanAutofillHash();
    if (!autofill.client) {
      return false;
    }

    await storageSet({
      [STORAGE_KEYS.serverUrl]: autofill.client,
      [STORAGE_KEYS.instanceToken]: autofill.token || ""
    });
    return true;
  }

  function applyBridgeUiOptions(request) {
    const panelLayout = request?.panelLayout === "center" ? "center" : "corner";
    state.bridgeUiOptions = {
      hideHistoryOption: request?.hideHistoryOption === true,
      lockHistoryOption: request?.lockHistoryOption === true,
      hideClientField: request?.hideClientField === true,
      hideTokenField: request?.hideTokenField === true,
      lockClientField: request?.lockClientField === true,
      lockTokenField: request?.lockTokenField === true,
      panelLayout
    };
    state.centerLayoutReady = panelLayout === "center" && (state.loginReady || isWhatsAppLoggedIn());
  }

  function resetBridgeUiOptions() {
    state.bridgeUiOptions = { ...DEFAULT_BRIDGE_UI_OPTIONS };
    state.centerLayoutReady = false;
  }

  async function applyBridgeImportRequest() {
    const values = await storageGet([STORAGE_KEYS.bridgeImportRequest]);
    const request = values[STORAGE_KEYS.bridgeImportRequest];
    if (!request || typeof request !== "object") {
      return false;
    }

    await storageRemove([STORAGE_KEYS.bridgeImportRequest]);
    const createdAt = Number(request.createdAt || 0);
    if (createdAt && Date.now() - createdAt > 10 * 60 * 1000) {
      return false;
    }

    applyBridgeUiOptions(request);
    const next: Record<string, unknown> = {
      [STORAGE_KEYS.serverUrl]: String(request.client || "").trim(),
      [STORAGE_KEYS.instanceToken]: String(request.token || "").trim()
    };
    if (typeof request.includeHistory === "boolean") {
      next[STORAGE_KEYS.includeHistory] = request.includeHistory;
    }
    await storageSet(next);
    return true;
  }

  function applyThemeClass() {
    if (!state.host) {
      return;
    }
    if (state.userSettings.themeMode === "light" || state.userSettings.themeMode === "dark") {
      state.host.dataset.theme = state.userSettings.themeMode;
      return;
    }
    applyWhatsAppTheme(state.host);
  }

  function startThemeWatch() {
    state.themeObserver = startWhatsAppThemeWatch(state.host, state.themeObserver, applyThemeClass);
  }





  function panelEl(id) {
    return state.root?.getElementById(id) || null;
  }

  function setResult(message, kind = "") {
    const result = panelEl("result");
    if (!result) {
      return;
    }
    result.textContent = message || "";
    result.className = kind ? `result ${kind}` : "result";
  }

  function refreshLoginStatus() {
    const loggedIn = isWhatsAppLoggedIn();
    state.loginReady = loggedIn;
    renderEffectivePanelLayout(loggedIn);
    renderHeaderStatus(loggedIn);
    setBusy(state.importRunning);
    return loggedIn;
  }

  function renderEffectivePanelLayout(loggedIn = state.loginReady) {
    if (!state.host) {
      return;
    }
    const requestedLayout = state.bridgeUiOptions.panelLayout;
    if (requestedLayout !== "center") {
      state.centerLayoutReady = false;
      state.host.dataset.layout = "corner";
      return;
    }
    if (loggedIn) {
      state.centerLayoutReady = true;
    }
    state.host.dataset.layout = state.centerLayoutReady ? "center" : "corner";
  }

  function isPanelVisible() {
    return Boolean(state.host?.isConnected && state.host.style.display !== "none");
  }

  function updateVisibleLoginStatus() {
    if (!state.root || !isPanelVisible()) {
      return;
    }
    refreshLoginStatus();
  }

  function scheduleLoginStatusRefresh() {
    if (state.loginRefreshTimer) {
      return;
    }
    state.loginRefreshTimer = window.setTimeout(() => {
      state.loginRefreshTimer = null;
      updateVisibleLoginStatus();
    }, LOGIN_STATUS_DEBOUNCE_MS);
  }

  function startLoginStatusWatch() {
    if (!state.loginObserver && typeof MutationObserver === "function") {
      const target = document.body || document.documentElement;
      if (target) {
        state.loginObserver = new MutationObserver(scheduleLoginStatusRefresh);
        state.loginObserver.observe(target, { childList: true, subtree: true });
      }
    }
    if (!state.loginRefreshInterval) {
      state.loginRefreshInterval = window.setInterval(updateVisibleLoginStatus, LOGIN_STATUS_REFRESH_MS);
    }
    scheduleLoginStatusRefresh();
  }

  function setBusy(busy) {
    state.importRunning = Boolean(busy);
    for (const id of [
      "serverUrlInput",
      "instanceTokenInput",
      "includeHistoryCheckbox",
      "disconnectLocalCheckbox",
      "importButton",
      "diagnoseButton",
      "dumpButton",
      "historyOnlyButton",
      "mainDumpButton",
      "exitDevModeButton",
      "tokenClearButton",
      "tokenVisibilityButton",
      "settingsButton",
      "autoOpenCheckbox",
      "themeModeSelect"
    ]) {
      const element = panelEl(id);
      if (element) {
        const devOnly = element.classList.contains("dev-only") || Boolean(element.closest?.(".dev-only"));
        const historyLocked = id === "includeHistoryCheckbox" && state.bridgeUiOptions.lockHistoryOption;
        const clientLocked = id === "serverUrlInput" && state.bridgeUiOptions.lockClientField;
        const tokenLocked = (
          (id === "instanceTokenInput" || id === "tokenClearButton") &&
          state.bridgeUiOptions.lockTokenField
        );
        const requiresLogin = id === "importButton" || id === "historyOnlyButton";
        element.disabled = state.importRunning ||
          (requiresLogin && !state.loginReady) ||
          historyLocked ||
          clientLocked ||
          tokenLocked ||
          (devOnly && !state.devMode);
      }
    }
  }

  function renderExtensionVersion() {
    const versionEl = panelEl("extensionVersion");
    const version = extensionVersion();
    if (versionEl) {
      versionEl.textContent = version ? `v${version}` : "--";
    }
  }

  function shouldDisconnectLocalAfterImport() {
    const checkbox = panelEl("disconnectLocalCheckbox");
    return !state.devMode || checkbox?.checked !== false;
  }

  function shouldIncludeHistoryAfterImport() {
    const checkbox = panelEl("includeHistoryCheckbox");
    return checkbox ? checkbox.checked === true : DEFAULT_INCLUDE_HISTORY;
  }

  function readJSONLocalStorage(key) {
    try {
      return JSON.parse(localStorage.getItem(key) || "null");
    } catch {
      return null;
    }
  }

  function widToJid(wid) {
    if (!wid || typeof wid !== "string") {
      return "";
    }
    const at = wid.lastIndexOf("@");
    const head = at >= 0 ? wid.slice(0, at) : wid;
    const server = at >= 0 ? wid.slice(at + 1) : "s.whatsapp.net";
    const colon = head.indexOf(":");
    const userAndAgent = colon >= 0 ? head.slice(0, colon) : head;
    const device = colon >= 0 ? Number(head.slice(colon + 1)) : 0;
    const dot = userAndAgent.indexOf(".");
    const user = dot >= 0 ? userAndAgent.slice(0, dot) : userAndAgent;
    return `${user}:${Number.isFinite(device) ? device : 0}@${server}`;
  }

  function detectWhatsAppAccount() {
    return {
      jid: widToJid(readJSONLocalStorage("last-wid-md")),
      lid: widToJid(readJSONLocalStorage("WALid"))
    };
  }

  function formatWhatsAppJid(value) {
    const raw = String(value || "");
    const user = raw.split("@")[0].split(":")[0].replace(/\D/g, "");
    if (!user) {
      return raw;
    }
    if (user.length === 13 && user.startsWith("55")) {
      return `+${user.slice(0, 2)} ${user.slice(2, 4)} ${user.slice(4, 9)}-${user.slice(9)}`;
    }
    if (user.length === 12 && user.startsWith("55")) {
      return `+${user.slice(0, 2)} ${user.slice(2, 4)} ${user.slice(4, 8)}-${user.slice(8)}`;
    }
    if (user.length > 4) {
      return `+${user}`;
    }
    return raw;
  }

  function formatWhatsAppLid(value) {
    const raw = String(value || "");
    const user = raw.split("@")[0].split(":")[0];
    return user || raw;
  }

  function setHeaderAccountStatus(value) {
    const label = panelEl("statusLabel");
    if (!label) {
      return;
    }
    label.textContent = "Conta: ";
    const account = document.createElement("span");
    account.className = "status-account";
    account.textContent = value;
    label.append(account);
  }

  function renderHeaderStatus(loggedIn = isWhatsAppLoggedIn()) {
    const label = panelEl("statusLabel");
    if (!label) {
      return;
    }
    const account = detectWhatsAppAccount();
    if (!loggedIn) {
      label.textContent = "Aguardando WhatsApp Web carregar";
      return;
    }
    if (account.jid) {
      setHeaderAccountStatus(formatWhatsAppJid(account.jid));
      return;
    }
    if (account.lid) {
      setHeaderAccountStatus(formatWhatsAppLid(account.lid));
      return;
    }
    label.textContent = "WhatsApp Web conectado";
  }

  function renderBridgeUiOptions() {
    renderEffectivePanelLayout();
    const serverUrlOption = panelEl("serverUrlOption");
    const instanceTokenOption = panelEl("instanceTokenOption");
    const serverUrlInput = panelEl("serverUrlInput");
    const instanceTokenInput = panelEl("instanceTokenInput");
    const tokenClearButton = panelEl("tokenClearButton");
    const includeHistoryOption = panelEl("includeHistoryOption");
    const includeHistoryCheckbox = panelEl("includeHistoryCheckbox");
    if (serverUrlOption) {
      serverUrlOption.hidden = state.bridgeUiOptions.hideClientField;
    }
    if (instanceTokenOption) {
      instanceTokenOption.hidden = state.bridgeUiOptions.hideTokenField;
    }
    if (serverUrlInput) {
      serverUrlInput.disabled = state.importRunning || state.bridgeUiOptions.lockClientField;
    }
    if (instanceTokenInput) {
      instanceTokenInput.disabled = state.importRunning || state.bridgeUiOptions.lockTokenField;
    }
    if (tokenClearButton) {
      tokenClearButton.disabled = state.importRunning || state.bridgeUiOptions.lockTokenField;
    }
    if (includeHistoryOption) {
      includeHistoryOption.hidden = state.bridgeUiOptions.hideHistoryOption;
    }
    if (includeHistoryCheckbox) {
      includeHistoryCheckbox.disabled = state.importRunning || state.bridgeUiOptions.lockHistoryOption;
    }
    renderHeaderStatus();
  }

  function renderCleanupNotice() {
    const notice = panelEl("cleanupNotice");
    if (!notice) {
      return;
    }
    if (shouldDisconnectLocalAfterImport()) {
      notice.className = "notice";
      notice.innerHTML = PANEL_TEXT.cleanupNoticeHTML;
      return;
    }
    notice.className = "notice warn";
    notice.innerHTML = PANEL_TEXT.keepLocalSessionWarningHTML;
  }

  function renderSettingsPanel() {
    const settingsPanel = panelEl("settingsPanel");
    const settingsButton = panelEl("settingsButton");
    const autoOpenCheckbox = panelEl("autoOpenCheckbox");
    const themeModeSelect = panelEl("themeModeSelect");
    if (settingsPanel) {
      settingsPanel.hidden = !state.settingsOpen;
    }
    if (settingsButton) {
      settingsButton.setAttribute("aria-pressed", state.settingsOpen ? "true" : "false");
      settingsButton.setAttribute("aria-label", state.settingsOpen ? PANEL_TEXT.closeSettings : PANEL_TEXT.openSettings);
      settingsButton.title = state.settingsOpen ? PANEL_TEXT.closeSettings : PANEL_TEXT.openSettings;
    }
    if (autoOpenCheckbox) {
      autoOpenCheckbox.checked = state.userSettings.autoOpenPanel;
    }
    if (themeModeSelect) {
      themeModeSelect.value = state.userSettings.themeMode;
    }
  }

  async function saveUserSettings(next = {}) {
    state.userSettings = normalizeUserSettings({ ...state.userSettings, ...next });
    await storageSet({ [STORAGE_KEYS.userSettings]: state.userSettings });
    renderSettingsPanel();
    applyThemeClass();
  }

  function setDevMode(enabled) {
    state.devMode = Boolean(enabled);
    for (const element of Array.from(state.root?.querySelectorAll(".dev-only") || []) as Array<HTMLElement & { disabled?: boolean }>) {
      element.hidden = !state.devMode;
      element.disabled = state.importRunning || !state.devMode;
    }
    const disconnectLocalCheckbox = panelEl("disconnectLocalCheckbox");
    if (!state.devMode && disconnectLocalCheckbox) {
      disconnectLocalCheckbox.checked = true;
    }
    const modeLabel = panelEl("modeLabel");
    if (modeLabel) {
      modeLabel.textContent = state.devMode ? PANEL_TEXT.modeTechnical : PANEL_TEXT.modeDefault;
    }
    renderCleanupNotice();
    setBusy(state.importRunning);
  }

  async function setDevModePreference(enabled) {
    setDevMode(enabled);
    await storageSet({ [STORAGE_KEYS.devMode]: state.devMode });
    setResult(state.devMode ? `${PANEL_TEXT.modeTechnical} ativado.` : `${PANEL_TEXT.modeTechnical} desativado.`, "ok");
  }

  function handleDevModeGesture() {
    state.devModeClickCount += 1;
    if (state.devModeClickTimer) {
      clearTimeout(state.devModeClickTimer);
    }
    if (state.devModeClickCount >= DEV_MODE_TOGGLE_CLICKS) {
      state.devModeClickCount = 0;
      state.devModeClickTimer = null;
      setDevModePreference(!state.devMode).catch((error) => {
        warnIfActiveContext("Failed to toggle technical mode", error);
      });
      return;
    }
    state.devModeClickTimer = setTimeout(() => {
      state.devModeClickCount = 0;
      state.devModeClickTimer = null;
    }, DEV_MODE_TOGGLE_WINDOW_MS);
  }

  function setTokenVisible(visible) {
    const input = panelEl("instanceTokenInput");
    const button = panelEl("tokenVisibilityButton");
    if (!input || !button) {
      return;
    }
    input.type = visible ? "text" : "password";
    button.classList.toggle("is-visible", visible);
    button.setAttribute("aria-pressed", visible ? "true" : "false");
    button.setAttribute("aria-label", visible ? PANEL_TEXT.hideToken : PANEL_TEXT.showToken);
    button.title = visible ? PANEL_TEXT.hideToken : PANEL_TEXT.showToken;
  }

  async function loadSettings() {
    const values = await storageGet([
      STORAGE_KEYS.serverUrl,
      STORAGE_KEYS.instanceToken,
      STORAGE_KEYS.includeHistory,
      STORAGE_KEYS.disconnectLocal,
      STORAGE_KEYS.devMode,
      STORAGE_KEYS.userSettings
    ]);
    state.userSettings = normalizeUserSettings(values[STORAGE_KEYS.userSettings]);
    const serverUrlInput = panelEl("serverUrlInput");
    const instanceTokenInput = panelEl("instanceTokenInput");
    const includeHistoryCheckbox = panelEl("includeHistoryCheckbox");
    const disconnectLocalCheckbox = panelEl("disconnectLocalCheckbox");
    if (serverUrlInput) {
      serverUrlInput.value = values[STORAGE_KEYS.serverUrl] || "";
    }
    if (instanceTokenInput) {
      instanceTokenInput.value = values[STORAGE_KEYS.instanceToken] || "";
    }
    if (includeHistoryCheckbox) {
      includeHistoryCheckbox.checked = values[STORAGE_KEYS.includeHistory] === undefined
        ? DEFAULT_INCLUDE_HISTORY
        : values[STORAGE_KEYS.includeHistory] === true;
    }
    if (disconnectLocalCheckbox) {
      disconnectLocalCheckbox.checked = values[STORAGE_KEYS.devMode] === true ? values[STORAGE_KEYS.disconnectLocal] !== false : true;
    }
    setDevMode(values[STORAGE_KEYS.devMode] === true);
    renderBridgeUiOptions();
    renderSettingsPanel();
    applyThemeClass();
  }

  async function saveSettings() {
    const serverUrlInput = panelEl("serverUrlInput");
    const instanceTokenInput = panelEl("instanceTokenInput");
    const includeHistoryCheckbox = panelEl("includeHistoryCheckbox");
    const disconnectLocalCheckbox = panelEl("disconnectLocalCheckbox");
    await storageSet({
      [STORAGE_KEYS.serverUrl]: String(serverUrlInput?.value || "").trim(),
      [STORAGE_KEYS.instanceToken]: String(instanceTokenInput?.value || "").trim(),
      [STORAGE_KEYS.includeHistory]: shouldIncludeHistoryAfterImport(),
      [STORAGE_KEYS.disconnectLocal]: state.devMode ? disconnectLocalCheckbox?.checked !== false : true
    });
    renderCleanupNotice();
  }

  async function clearToken() {
    const input = panelEl("instanceTokenInput");
    if (input) {
      input.value = "";
    }
    setTokenVisible(false);
    await storageSet({ [STORAGE_KEYS.instanceToken]: "" });
    input?.focus();
  }

  function closeImportPort() {
    if (!state.importPort) {
      return;
    }
    try {
      state.importPort.disconnect();
    } catch {}
    state.importPort = null;
  }

  function downloadJSON(filename, data) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function handlePortMessage(message, fallbackMessage) {
    if (!message) {
      return;
    }
    if (message.type === PORT_MESSAGE_TYPES.status) {
      if (String(message.message || "").includes("Desconectando WhatsApp Web local")) {
        state.cleanupStarted = true;
      }
      setResult(message.message || "", message.kind || "");
      return;
    }
    if (message.type === PORT_MESSAGE_TYPES.done) {
      const download = message.payload?.download;
      if (download?.filename && download.data !== undefined) {
        downloadJSON(download.filename, download.data);
      }
      setResult(message.message || fallbackMessage, message.kind || "ok");
      setBusy(false);
      closeImportPort();
      return;
    }
    if (message.type === PORT_MESSAGE_TYPES.error) {
      setResult(message.message || "Falha ao executar comando.", "error");
      setBusy(false);
      closeImportPort();
    }
  }

  function runBackgroundCommand(type, options = {}, fallbackMessage = "Comando concluído.") {
    if (state.importRunning) {
      return;
    }
    if (!hasExtensionContext()) {
      markExtensionContextInvalidated();
      return;
    }
    closeImportPort();
    state.cleanupStarted = false;
    setBusy(true);
    let port;
    try {
      // Long-lived port keeps progress events flowing while the service worker
      // captures WhatsApp data and uploads chunks.
      port = chrome.runtime.connect({ name: PORT_NAMES.sessionImport });
    } catch (error) {
      if (handleExtensionContextFailure(error)) {
        return;
      }
      throw error;
    }
    state.importPort = port;
    port.onMessage.addListener((message) => handlePortMessage(message, fallbackMessage));
    port.onDisconnect.addListener(() => {
      state.importPort = null;
      if (state.importRunning && !state.cleanupStarted) {
        setResult("A conexão com a extensão foi encerrada.", "error");
        setBusy(false);
      }
    });
    port.postMessage({ type, options });
  }

  async function startImport(event) {
    event.preventDefault();
    if (state.importRunning) {
      return;
    }

    const client = String(panelEl("serverUrlInput")?.value || "").trim();
    const token = String(panelEl("instanceTokenInput")?.value || "").trim();
    const includeHistory = shouldIncludeHistoryAfterImport();
    const disconnectLocal = shouldDisconnectLocalAfterImport();
    if (!refreshLoginStatus()) {
      setResult("Entre no WhatsApp Web antes de migrar a sessão.", "error");
      return;
    }
    if (!client || !token) {
      setResult("Informe o nome da assinatura e o token.", "error");
      return;
    }

    setResult("Preparando importação...");
    await saveSettings();
    // The panel only sends user choices. The service worker owns validation,
    // extraction, conversion, upload, cleanup, and API connect.
    runBackgroundCommand(BACKGROUND_COMMANDS.startImport, { client, token, includeHistory, disconnectLocal }, "Importação concluída.");
  }

  async function startHistoryOnlyImport() {
    if (state.importRunning) {
      return;
    }

    const client = String(panelEl("serverUrlInput")?.value || "").trim();
    const token = String(panelEl("instanceTokenInput")?.value || "").trim();
    if (!refreshLoginStatus()) {
      setResult("Entre no WhatsApp Web antes de repassar o histórico.", "error");
      return;
    }
    if (!client || !token) {
      setResult("Informe o nome da assinatura e o token.", "error");
      return;
    }

    setResult("Preparando repasse de histórico...");
    await saveSettings();
    runBackgroundCommand(BACKGROUND_COMMANDS.importHistoryOnly, { client, token }, "Histórico repassado.");
  }

  function bindPanelEvents() {
    panelEl("closeButton")?.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (state.host) {
        state.host.style.display = "none";
      }
    });
    panelEl("devModeToggleArea")?.addEventListener("click", handleDevModeGesture);
    panelEl("settingsButton")?.addEventListener("click", () => {
      state.settingsOpen = !state.settingsOpen;
      renderSettingsPanel();
    });
    panelEl("autoOpenCheckbox")?.addEventListener("change", () => {
      saveUserSettings({ autoOpenPanel: panelEl("autoOpenCheckbox")?.checked !== false }).catch((error) => {
        warnIfActiveContext("Failed to save auto-open option", error);
      });
    });
    panelEl("themeModeSelect")?.addEventListener("change", () => {
      saveUserSettings({ themeMode: panelEl("themeModeSelect")?.value || "auto" }).catch((error) => {
        warnIfActiveContext("Failed to save theme option", error);
      });
    });
    panelEl("importForm")?.addEventListener("submit", startImport);
    panelEl("serverUrlInput")?.addEventListener("blur", () => {
      saveSettings().catch((error) => warnIfActiveContext("Failed to save client", error));
    });
    panelEl("instanceTokenInput")?.addEventListener("blur", () => {
      saveSettings().catch((error) => warnIfActiveContext("Failed to save token", error));
    });
    panelEl("includeHistoryCheckbox")?.addEventListener("change", () => {
      saveSettings().catch((error) => warnIfActiveContext("Failed to save history option", error));
    });
    panelEl("disconnectLocalCheckbox")?.addEventListener("change", () => {
      saveSettings().catch((error) => warnIfActiveContext("Failed to save local cleanup option", error));
    });
    panelEl("tokenVisibilityButton")?.addEventListener("click", () => {
      const input = panelEl("instanceTokenInput");
      setTokenVisible(input?.type === "password");
      input?.focus();
    });
    panelEl("tokenClearButton")?.addEventListener("click", () => {
      clearToken().catch((error) => warnIfActiveContext("Failed to clear token", error));
    });
    panelEl("diagnoseButton")?.addEventListener("click", () => {
      runBackgroundCommand(BACKGROUND_COMMANDS.diagnose, {}, "Diagnóstico gerado.");
    });
    panelEl("dumpButton")?.addEventListener("click", () => {
      runBackgroundCommand(BACKGROUND_COMMANDS.dumpHistory, {}, "Histórico gerado.");
    });
    panelEl("historyOnlyButton")?.addEventListener("click", () => {
      startHistoryOnlyImport().catch((error) => {
        setResult(error.message || "Falha ao repassar histórico.", "error");
        setBusy(false);
      });
    });
    panelEl("mainDumpButton")?.addEventListener("click", () => {
      runBackgroundCommand(BACKGROUND_COMMANDS.dumpSession, {}, "Sessão gerada.");
    });
    panelEl("exitDevModeButton")?.addEventListener("click", () => {
      setDevModePreference(false).catch((error) => {
        warnIfActiveContext("Failed to disable technical mode", error);
      });
    });
  }

  async function ensurePanel() {
    if (state.host && state.root) {
      return;
    }

    const host = document.getElementById(PANEL_HOST_ID) || document.createElement("div");
    host.id = PANEL_HOST_ID;
    if (!host.isConnected) {
      (document.body || document.documentElement).append(host);
    }
    const root = host.shadowRoot || host.attachShadow({ mode: "open" });
    root.innerHTML = panelTemplate(extensionVersion());
    state.host = host;
    state.root = root;
    startThemeWatch();
    startLoginStatusWatch();
    bindPanelEvents();
    renderExtensionVersion();
    await loadSettings();
    await saveUserSettings(state.userSettings);
    setTokenVisible(false);
  }

  async function openPanel(options: { source?: "action" | "bridge" } = {}) {
    await ensurePanel();
    if (!state.importRunning) {
      const bridgeChanged = await applyBridgeImportRequest();
      if (!bridgeChanged && options.source === "action") {
        resetBridgeUiOptions();
      }
      await loadSettings();
    }
    state.host.style.display = "";
    refreshLoginStatus();
    return true;
  }

  if (hasExtensionContext()) {
    try {
      chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (!message || message.type !== CONTENT_MESSAGE_TYPES.openPanel) {
          return false;
        }
        openPanel({ source: message.source })
          .then((opened) => sendResponse({ ok: opened, loggedIn: isWhatsAppLoggedIn() }))
          .catch((error) => sendResponse({ ok: false, error: error.message || "Falha ao abrir painel" }));
        return true;
      });
    } catch (error) {
      handleExtensionContextFailure(error);
    }
  }

  window.addEventListener("hashchange", () => {
    applyAutofillFromUrl()
      .then((changed) => {
        if (changed) {
          return openPanel();
        }
        return false;
      })
      .catch((error) => warnIfActiveContext("Failed to apply URL autofill", error));
  });

  applyAutofillFromUrl()
    .then(async (changed) => {
      if (changed) {
        return openPanel();
      }
      const bridgeChanged = await applyBridgeImportRequest();
      if (bridgeChanged) {
        return openPanel();
      }
      const values = await storageGet([STORAGE_KEYS.userSettings]);
      const userSettings = normalizeUserSettings(values[STORAGE_KEYS.userSettings]);
      state.userSettings = userSettings;
      if (userSettings.autoOpenPanel) {
        return openPanel();
      }
      return false;
    })
    .catch((error) => warnIfActiveContext("Failed to open session connector panel", error));
})();
