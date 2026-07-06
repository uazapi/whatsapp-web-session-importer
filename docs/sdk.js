(function (global) {
  "use strict";

  var SOURCE = "whatsapp-session-connector";
  var TYPES = {
    ready: "CONNECTOR_READY",
    ping: "PING",
    startImport: "START_IMPORT",
    started: "IMPORT_TAB_OPENED",
    error: "IMPORT_TAB_ERROR"
  };
  var DEFAULT_TIMEOUT_MS = 1800;
  var FRAME_LOAD_TIMEOUT_MS = 5000;
  var DEFAULT_INSTALL_URL = "https://chromewebstore.google.com/detail/cdjfbjfolpeenlmanmkoglhhcjfgcbpp";

  function scriptBaseUrl() {
    var script = document.currentScript;
    if (script && script.src) {
      return new URL(".", script.src).href;
    }
    return "https://connector.uazapi.com/";
  }

  var state = {
    frame: null,
    frameUrl: new URL("frame.html", scriptBaseUrl()).href,
    timeoutMs: DEFAULT_TIMEOUT_MS
  };

  function configure(options) {
    var next = options || {};
    if (next.frameUrl) {
      state.frameUrl = String(next.frameUrl);
      state.frame = null;
    }
    if (next.timeoutMs) {
      state.timeoutMs = Number(next.timeoutMs) || DEFAULT_TIMEOUT_MS;
    }
  }

  function frameOrigin() {
    return new URL(state.frameUrl, window.location.href).origin;
  }

  function ensureFrame() {
    if (state.frame && state.frame.contentWindow) {
      return Promise.resolve(state.frame);
    }

    return new Promise(function (resolve, reject) {
      var frame = document.createElement("iframe");
      var timer = window.setTimeout(function () {
        reject(new Error("Bridge frame load timeout"));
      }, FRAME_LOAD_TIMEOUT_MS);

      frame.src = state.frameUrl;
      frame.title = "Session Connector Bridge";
      frame.setAttribute("aria-hidden", "true");
      frame.tabIndex = -1;
      frame.style.position = "fixed";
      frame.style.width = "1px";
      frame.style.height = "1px";
      frame.style.left = "-9999px";
      frame.style.top = "-9999px";
      frame.style.border = "0";
      frame.style.opacity = "0";
      frame.style.pointerEvents = "none";

      frame.addEventListener("load", function () {
        window.clearTimeout(timer);
        state.frame = frame;
        resolve(frame);
      }, { once: true });

      frame.addEventListener("error", function () {
        window.clearTimeout(timer);
        reject(new Error("Bridge frame failed to load"));
      }, { once: true });

      (document.body || document.documentElement).appendChild(frame);
    });
  }

  function request(type, payload, options) {
    var timeoutMs = Number((options && options.timeoutMs) || state.timeoutMs || DEFAULT_TIMEOUT_MS);
    return ensureFrame().then(function (frame) {
      return new Promise(function (resolve, reject) {
        var requestId = "connector-" + Date.now() + "-" + Math.random().toString(36).slice(2);
        var done = false;

        function cleanup() {
          window.removeEventListener("message", onMessage);
          window.clearTimeout(timer);
        }

        function finish(fn, value) {
          if (done) {
            return;
          }
          done = true;
          cleanup();
          fn(value);
        }

        function onMessage(event) {
          if (event.source !== frame.contentWindow) {
            return;
          }
          var data = event.data || {};
          if (data.source !== SOURCE || data.requestId !== requestId) {
            return;
          }
          finish(resolve, data);
        }

        var timer = window.setTimeout(function () {
          finish(reject, new Error("Extension bridge timeout"));
        }, timeoutMs);

        window.addEventListener("message", onMessage);
        frame.contentWindow.postMessage(Object.assign({}, payload || {}, {
          target: SOURCE,
          type: type,
          requestId: requestId
        }), frameOrigin());
      });
    });
  }

  function ping(options) {
    return request(TYPES.ping, {}, options)
      .then(function (response) {
        return {
          installed: true,
          version: response.version || ""
        };
      })
      .catch(function () {
        return {
          installed: false,
          version: ""
        };
      });
  }

  function open(options) {
    var payload = normalizePresentationOptions(Object.assign({
      includeHistory: true
    }, options || {}));
    return ping({ timeoutMs: payload.timeoutMs })
      .then(function (connector) {
        if (!connector.installed) {
          return {
            ok: false,
            installed: false,
            error: "EXTENSION_NOT_AVAILABLE",
            fallbackUrl: fallbackUrl(payload)
          };
        }
        return request(TYPES.startImport, {
          client: payload.client || "",
          token: payload.token || "",
          includeHistory: payload.includeHistory,
          hideHistoryOption: payload.hideHistoryOption,
          lockHistoryOption: payload.lockHistoryOption,
          hideClientField: payload.hideClientField,
          hideTokenField: payload.hideTokenField,
          lockClientField: payload.lockClientField,
          lockTokenField: payload.lockTokenField,
          panelLayout: payload.panelLayout
        }, { timeoutMs: payload.timeoutMs })
          .then(function (response) {
            if (response.type === TYPES.error) {
              return {
                ok: false,
                installed: true,
                error: response.error || "START_IMPORT_FAILED"
              };
            }
            return {
              ok: true,
              installed: true,
              version: connector.version,
              tabId: response.tabId || null,
              reused: response.reused === true
            };
          });
      });
  }

  function fallbackUrl(options) {
    var params = new URLSearchParams();
    if (options && options.client) {
      params.set("client", String(options.client));
    }
    if (options && options.token) {
      params.set("token", String(options.token));
    }
    var hash = params.toString();
    return "https://web.whatsapp.com/" + (hash ? "#" + hash : "");
  }

  function resolveTarget(target) {
    if (typeof target === "string") {
      var found = document.querySelector(target);
      if (!found) {
        throw new Error("Mount target not found: " + target);
      }
      return found;
    }
    if (target && target.nodeType === 1) {
      return target;
    }
    throw new Error("Invalid mount target");
  }

  function injectMountStyles() {
    if (document.getElementById("uazapi-connector-sdk-style")) {
      return;
    }
    var style = document.createElement("style");
    style.id = "uazapi-connector-sdk-style";
    style.textContent = [
      ".uazapi-connector-card{--uc-bg:#1f2421;--uc-bg-2:#272d29;--uc-line:#364039;--uc-text:#f6f8f7;--uc-muted:#b6c0ba;--uc-primary:#25c46a;--uc-primary-hover:#2fd979;--uc-danger:#ff6b6b;width:100%;max-width:420px;border:1px solid var(--uc-line);border-radius:8px;background:var(--uc-bg);color:var(--uc-text);font:14px/1.4 ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;box-shadow:0 16px 40px rgba(0,0,0,.22);overflow:hidden}",
      ".uazapi-connector-card *{box-sizing:border-box}",
      ".uazapi-connector-head{display:flex;align-items:center;gap:12px;padding:16px;border-bottom:1px solid var(--uc-line)}",
      ".uazapi-connector-mark{width:36px;height:36px;display:grid;place-items:center;border-radius:8px;background:var(--uc-primary);color:#06130b;font-weight:900}",
      ".uazapi-connector-title{min-width:0;font-weight:800;font-size:16px;line-height:1.2;overflow-wrap:anywhere}",
      ".uazapi-connector-subtitle{margin-top:2px;color:var(--uc-muted);font-size:13px;overflow-wrap:anywhere}",
      ".uazapi-connector-body{display:grid;gap:12px;padding:16px}",
      ".uazapi-connector-status{display:flex;align-items:center;gap:8px;min-height:20px;color:var(--uc-muted);font-size:13px}",
      ".uazapi-connector-dot{width:8px;height:8px;border-radius:999px;background:var(--uc-muted);flex:0 0 auto}",
      ".uazapi-connector-card[data-state='ready'] .uazapi-connector-dot{background:var(--uc-primary)}",
      ".uazapi-connector-card[data-state='error'] .uazapi-connector-dot,.uazapi-connector-card[data-state='missing'] .uazapi-connector-dot{background:var(--uc-danger)}",
      ".uazapi-connector-actions{display:flex;flex-wrap:wrap;gap:10px}",
      ".uazapi-connector-button{min-height:42px;border:0;border-radius:6px;padding:0 14px;font:inherit;font-weight:800;cursor:pointer;white-space:nowrap}",
      ".uazapi-connector-button:disabled{opacity:.58;cursor:not-allowed}",
      ".uazapi-connector-primary{flex:1 1 180px;background:var(--uc-primary);color:#06130b}",
      ".uazapi-connector-primary:not(:disabled):hover{background:var(--uc-primary-hover)}",
      ".uazapi-connector-secondary{background:var(--uc-bg-2);color:var(--uc-text);border:1px solid var(--uc-line)}",
      ".uazapi-connector-detail{min-height:20px;color:var(--uc-muted);font-size:12px;overflow-wrap:anywhere}",
      ".uazapi-connector-card[data-installed='true'] [data-install-action]{display:none}",
      ".uazapi-connector-card[data-installed='false'] [data-open-action]{display:none}"
    ].join("");
    document.head.appendChild(style);
  }

  function copyOptions(options) {
    var next = {};
    Object.keys(options || {}).forEach(function (key) {
      if (typeof options[key] !== "function") {
        next[key] = options[key];
      }
    });
    return next;
  }

  function normalizePresentationOptions(options) {
    var next = copyOptions(options || {});
    if (next.showClientField !== undefined) {
      next.hideClientField = next.showClientField === false;
    }
    if (next.showTokenField !== undefined) {
      next.hideTokenField = next.showTokenField === false;
    }
    if (next.canEditClient !== undefined) {
      next.lockClientField = next.canEditClient === false;
    }
    if (next.canEditToken !== undefined) {
      next.lockTokenField = next.canEditToken === false;
    }
    return next;
  }

  function create(options) {
    var config = Object.assign({
      includeHistory: true
    }, options || {});
    var destroyed = false;
    var listeners = [];
    var currentState = {
      state: "idle",
      installed: false,
      version: "",
      opening: false,
      opened: false,
      error: "",
      detail: "",
      fallbackUrl: fallbackUrl(payload())
    };

    function payload() {
      var dynamic = typeof config.getPayload === "function" ? (config.getPayload() || {}) : {};
      return normalizePresentationOptions(Object.assign(copyOptions(config), dynamic));
    }

    function emit(patch) {
      if (destroyed) {
        return currentState;
      }
      currentState = Object.assign({}, currentState, patch || {});
      currentState.fallbackUrl = fallbackUrl(payload());
      listeners.slice().forEach(function (listener) {
        listener(currentState);
      });
      if (typeof config.onStateChange === "function") {
        config.onStateChange(currentState);
      }
      return currentState;
    }

    function check() {
      emit({
        state: "checking",
        opening: false,
        error: "",
        detail: "Verificando conector..."
      });
      return ping({ timeoutMs: config.timeoutMs }).then(function (response) {
        if (response.installed) {
          return emit({
            state: "ready",
            installed: true,
            version: response.version || "",
            detail: response.version ? "Versao " + response.version : "Conector instalado."
          });
        }
        return emit({
          state: "missing",
          installed: false,
          version: "",
          detail: "Instale o conector e verifique novamente."
        });
      });
    }

    function start() {
      emit({
        state: "opening",
        opening: true,
        error: "",
        detail: "Abrindo WhatsApp Web..."
      });
      return open(payload()).then(function (response) {
        if (response.ok) {
          return emit({
            state: "opened",
            installed: true,
            opening: false,
            opened: true,
            error: "",
            detail: response.reused ? "Aba existente reutilizada." : "Nova aba aberta.",
            result: response
          });
        }
        return emit({
          state: response.installed ? "error" : "missing",
          installed: response.installed === true,
          opening: false,
          opened: false,
          error: response.error || "",
          detail: response.error || "Conector nao instalado.",
          result: response
        });
      }).catch(function (error) {
        emit({
          state: "error",
          opening: false,
          opened: false,
          error: error.message || String(error),
          detail: error.message || String(error)
        });
        throw error;
      });
    }

    function subscribe(listener) {
      if (typeof listener !== "function") {
        return function () {};
      }
      listeners.push(listener);
      listener(currentState);
      return function () {
        listeners = listeners.filter(function (item) {
          return item !== listener;
        });
      };
    }

    function update(nextOptions) {
      config = Object.assign({}, config, nextOptions || {});
      return emit({});
    }

    function destroy() {
      destroyed = true;
      listeners = [];
    }

    return {
      check: check,
      open: start,
      refresh: check,
      subscribe: subscribe,
      update: update,
      destroy: destroy,
      getState: function () {
        return currentState;
      },
      getPayload: payload
    };
  }

  function mount(target, options) {
    var host = resolveTarget(target);
    var config = Object.assign({
      brandName: "Migrar WhatsApp",
      subtitle: "Abra o WhatsApp Web para concluir a migracao.",
      buttonLabel: "Migrar WhatsApp",
      installLabel: "Instalar conector",
      retryLabel: "Verificar novamente",
      markLabel: "WA",
      installUrl: DEFAULT_INSTALL_URL,
      includeHistory: true
    }, options || {});

    injectMountStyles();
    host.innerHTML = [
      "<section class='uazapi-connector-card' data-state='checking' data-installed='false'>",
      "  <div class='uazapi-connector-head'>",
      "    <div class='uazapi-connector-mark' aria-hidden='true' data-mark></div>",
      "    <div>",
      "      <div class='uazapi-connector-title' data-brand></div>",
      "      <div class='uazapi-connector-subtitle' data-subtitle></div>",
      "    </div>",
      "  </div>",
      "  <div class='uazapi-connector-body'>",
      "    <div class='uazapi-connector-status'><span class='uazapi-connector-dot' aria-hidden='true'></span><span data-status></span></div>",
      "    <div class='uazapi-connector-actions'>",
      "      <button class='uazapi-connector-button uazapi-connector-primary' type='button' data-open-action></button>",
      "      <button class='uazapi-connector-button uazapi-connector-primary' type='button' data-install-action></button>",
      "      <button class='uazapi-connector-button uazapi-connector-secondary' type='button' data-retry-action></button>",
      "    </div>",
      "    <div class='uazapi-connector-detail' data-detail></div>",
      "  </div>",
      "</section>"
    ].join("");

    var card = host.querySelector(".uazapi-connector-card");
    var brand = host.querySelector("[data-brand]");
    var mark = host.querySelector("[data-mark]");
    var subtitle = host.querySelector("[data-subtitle]");
    var status = host.querySelector("[data-status]");
    var detail = host.querySelector("[data-detail]");
    var openButton = host.querySelector("[data-open-action]");
    var installButton = host.querySelector("[data-install-action]");
    var retryButton = host.querySelector("[data-retry-action]");
    var destroyed = false;
    var connector = create(config);

    if (config.primaryColor) {
      card.style.setProperty("--uc-primary", String(config.primaryColor));
      card.style.setProperty("--uc-primary-hover", String(config.primaryColor));
    }
    mark.textContent = config.markLabel;
    brand.textContent = config.brandName;
    subtitle.textContent = config.subtitle;
    openButton.textContent = config.buttonLabel;
    installButton.textContent = config.installLabel;
    retryButton.textContent = config.retryLabel;

    function render(next) {
      if (destroyed) {
        return;
      }
      var isChecking = next.state === "checking";
      var isOpening = next.state === "opening";
      card.dataset.state = next.state;
      card.dataset.installed = next.installed ? "true" : "false";
      status.textContent =
        next.state === "checking" ? "Verificando conector..." :
          next.state === "missing" ? "Conector nao instalado." :
            next.state === "opening" ? "Abrindo WhatsApp Web..." :
              next.state === "opened" ? "WhatsApp Web aberto." :
                next.state === "error" ? "Nao foi possivel abrir." :
                  next.installed ? "Conector instalado." : "";
      detail.textContent = next.detail || "";
      openButton.disabled = isChecking || isOpening || !next.installed;
      installButton.disabled = isChecking;
      retryButton.disabled = isChecking || isOpening;
    }

    connector.subscribe(render);
    openButton.addEventListener("click", connector.open);
    retryButton.addEventListener("click", connector.check);
    installButton.addEventListener("click", function () {
      window.open(config.installUrl || DEFAULT_INSTALL_URL, "_blank", "noopener,noreferrer");
    });

    connector.check();

    return {
      element: host,
      refresh: connector.check,
      open: connector.open,
      getState: connector.getState,
      getPayload: connector.getPayload,
      update: connector.update,
      destroy: function () {
        destroyed = true;
        connector.destroy();
        host.innerHTML = "";
      }
    };
  }

  global.UazapiConnector = {
    configure: configure,
    ping: ping,
    open: open,
    create: create,
    mount: mount,
    fallbackUrl: fallbackUrl
  };
})(window);
