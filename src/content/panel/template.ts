import { EXTENSION_CUSTOMIZATION } from "../../customization";
import { iconClose, iconEye, iconImport, iconSettings, iconTrash } from "./icons";

export const PANEL_TEXT = EXTENSION_CUSTOMIZATION.panelText;
export const PANEL_HOST_ID = "session-connector-panel";

export function panelTemplate(version: string): string {
  return `
    <style>
      :host {
        all: initial;
        color-scheme: light;
        /* WhatsApp Web (WDS) - tema claro (valores exatos dos tokens) */
        --connector-panel: #ffffff;
        --connector-topbar: #f7f5f3;
        --connector-input: #f0f2f5;
        --connector-text: #0a0a0a;
        --connector-muted: rgba(0, 0, 0, 0.6);
        --connector-line: rgba(0, 0, 0, 0.1);
        --connector-panel-border: rgba(0, 0, 0, 0.1);
        --connector-accent: #1daa61;
        --connector-accent-hover: #1b8755;
        --connector-accent-text: #ffffff;
        --connector-hover: rgba(194, 189, 184, 0.15);
        --connector-notice: #f7f5f3;
        --connector-focus: rgba(29, 170, 97, 0.3);
        --connector-danger: #ea0038;
        --connector-danger-soft: #fde8eb;
        --connector-ok: #1b8755;
        --connector-ok-soft: #e7fce3;
        --connector-warn: #a5691b;
        --connector-warn-soft: #fff7e5;
        --connector-warn-border: rgba(197, 135, 48, 0.35);
        --connector-shadow: 0 16px 44px rgba(11, 20, 26, 0.22), 0 0 22px rgba(29, 170, 97, 0.18);
        --connector-primary-shadow: rgba(29, 170, 97, 0.2);
        --connector-font: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
        display: block;
        font-family: var(--connector-font);
        pointer-events: auto;
        position: fixed;
        right: 20px;
        top: 20px;
        z-index: 2147483647;
      }

      :host([data-layout="center"]) {
        align-items: center;
        -webkit-backdrop-filter: blur(2px);
        backdrop-filter: blur(2px);
        background: rgba(5, 10, 13, 0.72);
        bottom: 0;
        display: flex;
        justify-content: center;
        left: 0;
        padding: 16px;
        right: 0;
        top: 0;
      }

      :host([data-theme="dark"]) {
        color-scheme: dark;
        /* WhatsApp Web (WDS) - tema escuro (valores exatos dos tokens) */
        --connector-panel: #1d1f1f;
        --connector-topbar: #1d1f1f;
        --connector-input: #242626;
        --connector-text: #fafafa;
        --connector-muted: rgba(255, 255, 255, 0.6);
        --connector-line: rgba(255, 255, 255, 0.1);
        --connector-accent: #21c063;
        --connector-accent-hover: #1daa61;
        --connector-accent-text: #0a0a0a;
        --connector-hover: rgba(255, 255, 255, 0.1);
        --connector-notice: #161717;
        --connector-focus: rgba(33, 192, 99, 0.3);
        --connector-danger: #fb5061;
        --connector-danger-soft: #321622;
        --connector-ok: #71eb85;
        --connector-ok-soft: #103529;
        --connector-warn: #ffd279;
        --connector-warn-soft: #362c1f;
        --connector-warn-border: rgba(255, 210, 121, 0.32);
        --connector-panel-border: rgba(33, 192, 99, 0.28);
        --connector-shadow: 0 18px 46px rgba(0, 0, 0, 0.6), 0 0 30px rgba(33, 192, 99, 0.28);
        --connector-primary-shadow: rgba(33, 192, 99, 0.24);
      }

      * {
        box-sizing: border-box;
      }

      .panel,
      .panel button,
      .panel input {
        font-family: var(--connector-font);
      }

      [hidden] {
        display: none !important;
      }

      .panel {
        background: var(--connector-panel);
        border: 1px solid var(--connector-panel-border);
        border-radius: 8px;
        box-shadow: var(--connector-shadow);
        color: var(--connector-text);
        display: grid;
        max-height: calc(100vh - 32px);
        overflow: hidden;
        pointer-events: auto;
        width: min(368px, calc(100vw - 32px));
      }

      :host([data-layout="center"]) .panel {
        max-height: calc(100vh - 32px);
        width: min(420px, calc(100vw - 32px));
      }

      .topbar {
        align-items: center;
        background: var(--connector-topbar);
        border-bottom: 1px solid var(--connector-line);
        display: flex;
        gap: 12px;
        justify-content: space-between;
        min-height: 68px;
        padding: 14px 16px;
      }

      .brand {
        align-items: center;
        cursor: pointer;
        display: grid;
        gap: 10px;
        grid-template-columns: 36px minmax(0, 1fr);
        min-width: 0;
      }

      .mark {
        align-items: center;
        background: var(--connector-accent);
        border-radius: 8px;
        color: var(--connector-accent-text);
        display: flex;
        font-family: var(--connector-font);
        font-size: 18px;
        font-weight: 700;
        line-height: 1;
        height: 36px;
        justify-content: center;
        width: 36px;
      }

      .mark svg {
        fill: none;
        height: 21px;
        stroke: currentColor;
        stroke-linecap: round;
        stroke-linejoin: round;
        stroke-width: 2.2;
        width: 21px;
      }

      .title {
        color: var(--connector-text);
        display: block;
        font-size: 16px;
        font-weight: 700;
        letter-spacing: 0;
        line-height: 1.2;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .subtitle {
        color: var(--connector-muted);
        display: block;
        font-size: 12px;
        letter-spacing: 0;
        line-height: 1.3;
        margin-top: 2px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .status-account {
        color: var(--connector-text);
        font-weight: 600;
      }

      .icon-button {
        align-items: center;
        background: transparent;
        border: 0;
        border-radius: 6px;
        color: var(--connector-muted);
        cursor: pointer;
        display: inline-flex;
        flex: 0 0 auto;
        height: 34px;
        justify-content: center;
        margin: 0;
        padding: 0;
        width: 34px;
      }

      .header-actions {
        align-items: center;
        display: flex;
        gap: 4px;
      }

      :host([data-layout="center"]) #settingsButton {
        display: none;
      }

      .icon-button:hover,
      .icon-button:focus-visible {
        background: var(--connector-hover);
        color: var(--connector-text);
        outline: none;
      }

      .icon-button svg,
      .token-action svg {
        fill: none;
        height: 18px;
        stroke: currentColor;
        stroke-linecap: round;
        stroke-linejoin: round;
        stroke-width: 2;
        width: 18px;
      }

      form {
        display: grid;
        gap: 14px;
        max-height: calc(100vh - 180px);
        overflow-y: auto;
        padding: 16px 18px 18px;
      }

      label {
        color: var(--connector-text);
        display: grid;
        font-size: 12px;
        font-weight: 700;
        gap: 6px;
        letter-spacing: 0;
      }

      input {
        background: var(--connector-input);
        border: 1px solid transparent;
        border-radius: 8px;
        color: var(--connector-text);
        font-family: var(--connector-font);
        font-size: 14px;
        line-height: 1.45;
        height: 40px;
        letter-spacing: 0;
        outline: none;
        padding: 0 11px;
        transition: border-color 120ms ease, box-shadow 120ms ease, background 120ms ease;
        width: 100%;
      }

      input:focus {
        background: var(--connector-input);
        border-color: var(--connector-accent);
        box-shadow: 0 0 0 3px var(--connector-focus);
      }

      input:disabled {
        background: var(--connector-input);
        color: var(--connector-muted);
        cursor: not-allowed;
      }

      .token-field {
        display: block;
        position: relative;
      }

      .token-field input {
        padding-right: 78px;
      }

      .token-action {
        align-items: center;
        background: transparent;
        border: 0;
        border-radius: 4px;
        color: var(--connector-muted);
        cursor: pointer;
        display: inline-flex;
        height: 34px;
        justify-content: center;
        margin: 0;
        padding: 0;
        position: absolute;
        top: 3px;
        width: 34px;
      }

      .token-action:hover,
      .token-action:focus-visible {
        background: var(--connector-hover);
        box-shadow: 0 0 0 2px var(--connector-focus);
        color: var(--connector-text);
        outline: none;
      }

      .token-clear {
        right: 39px;
      }

      .token-clear:hover,
      .token-clear:focus-visible {
        color: var(--connector-danger);
      }

      .token-toggle {
        right: 3px;
      }

      .token-toggle .eye-off {
        display: none;
      }

      .token-toggle.is-visible .eye-off {
        display: block;
      }

      .check {
        align-items: center;
        cursor: pointer;
        display: grid;
        font-size: 13px;
        font-weight: 700;
        gap: 9px;
        grid-template-columns: 16px minmax(0, 1fr);
        line-height: 1.35;
        min-height: 20px;
      }

      .check input[type="checkbox"] {
        appearance: none;
        background: transparent;
        border: 1px solid var(--connector-muted);
        border-radius: 3px;
        cursor: pointer;
        display: grid;
        height: 16px;
        margin: 0;
        min-height: 16px;
        min-width: 16px;
        padding: 0;
        place-content: center;
        width: 16px;
      }

      .check input[type="checkbox"]::before {
        border-bottom: 2px solid var(--connector-accent-text);
        border-right: 2px solid var(--connector-accent-text);
        content: "";
        height: 8px;
        margin-bottom: 3px;
        transform: rotate(45deg) scale(0);
        width: 5px;
      }

      .check input[type="checkbox"]:checked {
        background: var(--connector-accent);
        border-color: var(--connector-accent);
      }

      .check input[type="checkbox"]:checked::before {
        transform: rotate(45deg) scale(1);
      }

      .check:has(input[type="checkbox"]:disabled) {
        color: var(--connector-muted);
        cursor: not-allowed;
        opacity: 0.68;
      }

      .check input[type="checkbox"]:disabled {
        border-color: var(--connector-line);
        cursor: not-allowed;
      }

      .check input[type="checkbox"]:disabled:checked {
        background: var(--connector-muted);
        border-color: var(--connector-muted);
      }

      .check input[type="checkbox"]:focus-visible {
        box-shadow: 0 0 0 3px var(--connector-focus);
        outline: none;
      }

      .actions {
        display: grid;
        gap: 9px;
      }

      .primary,
      .secondary {
        align-items: center;
        background: var(--connector-accent);
        border: 0;
        border-radius: 6px;
        color: var(--connector-accent-text);
        cursor: pointer;
        display: inline-flex;
        font-family: var(--connector-font);
        font-size: 14px;
        font-weight: 700;
        line-height: 1;
        height: 42px;
        justify-content: center;
        letter-spacing: 0;
        margin: 0;
        padding: 0 14px;
        transition: background 120ms ease, box-shadow 120ms ease, transform 120ms ease;
        width: 100%;
      }

      .primary:hover,
      .primary:focus-visible {
        background: var(--connector-accent-hover);
        box-shadow: 0 8px 18px var(--connector-primary-shadow);
        outline: none;
      }

      .secondary {
        background: transparent;
        border: 1px solid var(--connector-line);
        color: var(--connector-text);
      }

      .secondary:hover,
      .secondary:focus-visible {
        background: var(--connector-hover);
        box-shadow: none;
        outline: none;
      }

      .primary:active,
      .secondary:active {
        transform: translateY(1px);
      }

      .primary:disabled,
      .secondary:disabled {
        background: var(--connector-input);
        color: var(--connector-muted);
        box-shadow: none;
        cursor: not-allowed;
        transform: none;
      }

      .notice {
        background: var(--connector-notice);
        border: 1px solid var(--connector-line);
        border-radius: 8px;
        color: var(--connector-muted);
        font-family: var(--connector-font);
        font-size: 12px;
        line-height: 1.45;
        letter-spacing: 0;
        margin: 0;
        padding: 9px 11px;
      }

      .notice strong {
        color: var(--connector-text);
      }

      .notice.warn {
        background: var(--connector-warn-soft);
        border-color: var(--connector-warn-border);
        color: var(--connector-warn);
      }

      .notice.warn strong {
        color: var(--connector-warn);
      }

      .settings-panel {
        border-top: 1px solid var(--connector-line);
        display: grid;
        gap: 12px;
        padding: 14px 18px 16px;
      }

      .settings-title {
        color: var(--connector-text);
        font-size: 13px;
        font-weight: 700;
        line-height: 1.25;
        margin: 0;
      }

      .settings-panel select {
        background: var(--connector-input);
        border: 1px solid transparent;
        border-radius: 8px;
        color: var(--connector-text);
        font-family: var(--connector-font);
        font-size: 14px;
        height: 38px;
        padding: 0 10px;
        width: 100%;
      }

      .setting-hint {
        color: var(--connector-muted);
        display: block;
        font-size: 11px;
        font-weight: 500;
        line-height: 1.35;
        margin-top: 2px;
      }

      .result {
        background: var(--connector-notice);
        border-top: 1px solid var(--connector-line);
        color: var(--connector-muted);
        font-family: var(--connector-font);
        font-size: 12px;
        line-height: 1.45;
        letter-spacing: 0;
        margin: 0;
        overflow-wrap: anywhere;
        padding: 12px 18px;
      }

      .result:empty {
        display: none;
      }

      .result.ok {
        background: var(--connector-ok-soft);
        color: var(--connector-ok);
      }

      .result.warn {
        background: var(--connector-warn-soft);
        color: var(--connector-warn);
      }

      .result.error {
        background: var(--connector-danger-soft);
        color: var(--connector-danger);
      }

      .meta {
        align-items: center;
        border-top: 1px solid var(--connector-line);
        color: var(--connector-muted);
        display: flex;
        font-family: var(--connector-font);
        font-size: 12px;
        line-height: 1.35;
        justify-content: space-between;
        letter-spacing: 0;
        min-height: 38px;
        padding: 9px 18px 10px;
      }

      @media (max-width: 480px) {
        :host {
          top: 12px;
          left: 12px;
          right: 12px;
        }

        :host([data-layout="center"]) {
          bottom: 0;
          left: 0;
          right: 0;
          top: 0;
        }

        .panel {
          width: auto;
        }
      }
    </style>

    <section class="panel" role="dialog" aria-label="${PANEL_TEXT.title}">
      <header class="topbar">
        <div id="devModeToggleArea" class="brand" title="Modo técnico">
          <span class="mark" aria-hidden="true">${iconImport()}</span>
          <span>
            <span class="title">${PANEL_TEXT.title}</span>
            <span id="statusLabel" class="subtitle">${PANEL_TEXT.defaultStatus}</span>
          </span>
        </div>
        <div class="header-actions">
          <button id="settingsButton" class="icon-button" type="button" aria-label="${PANEL_TEXT.openSettings}" title="${PANEL_TEXT.openSettings}" aria-pressed="false">
            ${iconSettings()}
          </button>
          <button id="closeButton" class="icon-button" type="button" aria-label="${PANEL_TEXT.closePanel}" title="${PANEL_TEXT.closePanel}">
            ${iconClose()}
          </button>
        </div>
      </header>

      <form id="importForm">
        <label id="serverUrlOption">
          ${PANEL_TEXT.clientLabel}
          <input id="serverUrlInput" type="text" autocomplete="off" spellcheck="false" placeholder="${PANEL_TEXT.clientPlaceholder}" />
        </label>
        <label id="instanceTokenOption">
          ${PANEL_TEXT.tokenLabel}
          <span class="token-field">
            <input id="instanceTokenInput" type="password" autocomplete="off" placeholder="${PANEL_TEXT.tokenPlaceholder}" />
            <button
              id="tokenClearButton"
              class="token-action token-clear"
              type="button"
              aria-label="${PANEL_TEXT.clearToken}"
              title="${PANEL_TEXT.clearToken}"
            >
              ${iconTrash()}
            </button>
            <button
              id="tokenVisibilityButton"
              class="token-action token-toggle"
              type="button"
              aria-label="${PANEL_TEXT.showToken}"
              aria-pressed="false"
              title="${PANEL_TEXT.showToken}"
            >
              ${iconEye()}
            </button>
          </span>
        </label>
        <label id="includeHistoryOption" class="check">
          <input id="includeHistoryCheckbox" type="checkbox" checked />
          <span>${PANEL_TEXT.includeHistory}</span>
        </label>
        <label id="disconnectLocalOption" class="check dev-only" hidden>
          <input id="disconnectLocalCheckbox" type="checkbox" checked />
          <span>${PANEL_TEXT.disconnectLocal}</span>
        </label>
        <div class="actions">
          <button id="importButton" class="primary" type="submit">${PANEL_TEXT.importButton}</button>
          <button id="diagnoseButton" class="secondary dev-only" type="button" hidden>${PANEL_TEXT.diagnoseButton}</button>
          <button id="dumpButton" class="secondary dev-only" type="button" hidden>${PANEL_TEXT.dumpHistoryButton}</button>
          <button id="historyOnlyButton" class="secondary dev-only" type="button" hidden>${PANEL_TEXT.historyOnlyButton}</button>
          <button id="mainDumpButton" class="secondary dev-only" type="button" hidden>${PANEL_TEXT.dumpSessionButton}</button>
          <button id="exitDevModeButton" class="secondary dev-only" type="button" hidden>${PANEL_TEXT.exitDevModeButton}</button>
        </div>
        <p id="cleanupNotice" class="notice">${PANEL_TEXT.cleanupNoticeHTML}</p>
      </form>

      <section id="settingsPanel" class="settings-panel" aria-label="${PANEL_TEXT.settingsTitle}" hidden>
        <p class="settings-title">${PANEL_TEXT.settingsTitle}</p>
        <label id="autoOpenOption" class="check">
          <input id="autoOpenCheckbox" type="checkbox" />
          <span>
            ${PANEL_TEXT.autoOpenSetting}
            <span class="setting-hint">${PANEL_TEXT.autoOpenSettingHint}</span>
          </span>
        </label>
        <label>
          ${PANEL_TEXT.themeSetting}
          <select id="themeModeSelect">
            <option value="auto">${PANEL_TEXT.themeFollowWhatsApp}</option>
            <option value="light">${PANEL_TEXT.themeLight}</option>
            <option value="dark">${PANEL_TEXT.themeDark}</option>
          </select>
        </label>
      </section>

      <p id="result" class="result" aria-live="polite"></p>
      <footer class="meta">
        <span id="modeLabel">${PANEL_TEXT.modeDefault}</span>
        <span>Versão <span id="extensionVersion">${version ? `v${version}` : "--"}</span></span>
      </footer>
    </section>
  `;
}
