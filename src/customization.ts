/**
 * Fork-friendly customization surface.
 *
 * For most APIs, start here:
 * - Change `api.clientBaseDomain` if the subscription name should resolve to another domain.
 * - Change `api.paths` if your backend uses different routes.
 * - Change `api.authHeaderName` if you use Authorization/Bearer instead of token.
 * - Change `panelText` to rebrand the floating panel without touching logic.
 */
export const EXTENSION_CUSTOMIZATION = {
  whatsappWebOrigin: "https://web.whatsapp.com",
  api: {
    clientBaseDomain: "uazapi.com",
    authHeaderName: "token",
    paths: {
      instanceStatus: "/instance/status",
      importWebSessionStart: "/instance/import-web-session/start",
      importWebSessionChunk: "/instance/import-web-session/chunk",
      importWebSessionFinish: "/instance/import-web-session/finish",
      importWebSessionHistory: "/instance/import-web-session/history"
    }
  },
  importLimits: {
    chunkItems: 1000,
    historyChatLimit: 5000
  },
  importDefaults: {
    // History is useful for continuity, but it depends on WhatsApp Web cache.
    // The service worker imports the session first and treats history failures
    // as warnings so this default cannot break the credential migration.
    includeHistory: true
  },
  appBridge: {
    source: "whatsapp-session-connector",
    matches: [
      "http://localhost/*",
      "http://127.0.0.1/*",
      "https://*.uazapi.com/*"
    ]
  },
  panelText: {
    title: "Migrar sessão",
    defaultStatus: "WhatsApp Web conectado",
    loggedOutStatus: "Entre no WhatsApp Web para importar",
    clientLabel: "Nome da assinatura",
    clientPlaceholder: "ex: minha-loja",
    tokenLabel: "Token",
    tokenPlaceholder: "token",
    importButton: "Migrar sessão",
    diagnoseButton: "Baixar diagnóstico",
    dumpHistoryButton: "Baixar histórico",
    historyOnlyButton: "Repassar histórico",
    dumpSessionButton: "Baixar sessão",
    exitDevModeButton: "Sair do modo técnico",
    modeDefault: "Modo padrão",
    modeTechnical: "Modo técnico",
    showToken: "Mostrar token",
    hideToken: "Ocultar token",
    clearToken: "Apagar token",
    closePanel: "Fechar painel",
    openSettings: "Configurações",
    closeSettings: "Fechar configurações",
    settingsTitle: "Configurações",
    autoOpenSetting: "Abrir painel automaticamente",
    autoOpenSettingHint: "Mesmo desativado, links com assinatura/token na URL sempre abrem o painel.",
    themeSetting: "Tema do painel",
    themeFollowWhatsApp: "Seguir WhatsApp",
    themeLight: "Claro",
    themeDark: "Escuro",
    includeHistory: "Incluir histórico de mensagens (beta)",
    disconnectLocal: "Apagar a sessão local após importar",
    cleanupNoticeHTML: "<strong>Atenção:</strong> esta sessão será migrada para a assinatura informada e desconectada deste navegador.",
    keepLocalSessionWarningHTML: "<strong>Risco:</strong> manter a sessão neste navegador e na instância ao mesmo tempo roda a mesma conta em dois lugares, o que pode causar desconexões, perda de mensagens e outros bugs. Use apenas para depuração.",
    extensionInvalidated: "A extensão foi atualizada ou recarregada. Recarregue esta aba do WhatsApp Web e tente novamente."
  }
} as const;
