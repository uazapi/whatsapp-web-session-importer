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
  const DEFAULT_USER_SETTINGS = {
    autoOpenPanel: true,
    themeMode: "auto"
  };

  const state = {
    host: null,
    root: null,
    importRunning: false,
    importPort: null,
    themeObserver: null,
    cleanupStarted: false,
    extensionContextInvalidated: false,
    devMode: false,
    settingsOpen: false,
    userSettings: { ...DEFAULT_USER_SETTINGS },
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
      autoOpenPanel: raw.autoOpenPanel !== false,
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

  function setStatus(message) {
    const label = panelEl("statusLabel");
    if (label) {
      label.textContent = message || PANEL_TEXT.defaultStatus;
    }
  }

  function refreshLoginStatus() {
    const loggedIn = isWhatsAppLoggedIn();
    setStatus(loggedIn ? PANEL_TEXT.defaultStatus : PANEL_TEXT.loggedOutStatus);
    return loggedIn;
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
        element.disabled = state.importRunning || (devOnly && !state.devMode);
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
    bindPanelEvents();
    renderExtensionVersion();
    await loadSettings();
    await saveUserSettings(state.userSettings);
    setTokenVisible(false);
  }

  async function openPanel() {
    await ensurePanel();
    if (!state.importRunning) {
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
        openPanel()
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
