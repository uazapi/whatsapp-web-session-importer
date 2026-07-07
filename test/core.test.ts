import { afterEach, describe, expect, it } from "vitest";
import {
  appStateCollectionVersionKey,
  buildImportChunks,
  countExpectedRows,
  pushArrayChunks
} from "../src/background/chunks";
import { normalizeContactForWhatsmeow, normalizeHistoryJIDsWithContactLIDMap } from "../src/background/conversion";
import { importPayloadForOptions } from "../src/background/payload";
import { isWhatsAppLoggedIn } from "../src/content/page/whatsapp-page";
import {
  normalizeBaseUrl,
  normalizeClientHost,
  parseAutofillHash,
  removeAutofillHashParams
} from "../src/shared/url";

const originalDocument = globalThis.document;
const originalWindow = globalThis.window;

afterEach(() => {
  Object.defineProperty(globalThis, "document", { value: originalDocument, configurable: true });
  Object.defineProperty(globalThis, "window", { value: originalWindow, configurable: true });
});

function installWhatsAppPageStub({ loggedInShell = false, qrElement = false, text = "" } = {}) {
  const shellElement = {
    getBoundingClientRect: () => ({ width: 320, height: 640 })
  };
  const qrLikeElement = {
    getAttribute: (name: string) => name === "data-testid" ? "qr-code" : ""
  };
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: {
      body: { innerText: text },
      querySelector: () => loggedInShell ? shellElement : null,
      querySelectorAll: () => qrElement ? [qrLikeElement] : []
    }
  });
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      getComputedStyle: () => ({ display: "block", visibility: "visible" })
    }
  });
}

describe("URL helpers", () => {
  it("normalizes subscription slugs, hosts, and full HTTPS URLs", () => {
    expect(normalizeBaseUrl("minha-loja")).toBe("https://minha-loja.uazapi.com");
    expect(normalizeBaseUrl("api.example.com")).toBe("https://api.example.com");
    expect(normalizeBaseUrl("https://api.example.com/")).toBe("https://api.example.com");
  });

  it("rejects invalid subscription hosts", () => {
    expect(() => normalizeClientHost("bad host")).toThrow("Nome da assinatura invalido");
  });

  it("rejects local or non-HTTPS instance URLs in the production build", () => {
    expect(() => normalizeBaseUrl("localhost:3000/")).toThrow("Use um backend autorizado publico com HTTPS");
    expect(() => normalizeBaseUrl("http://api.example.com")).toThrow("Use uma URL HTTPS do backend autorizado");
    expect(() => normalizeBaseUrl("https://127.0.0.1:3000")).toThrow("Use um backend autorizado publico com HTTPS");
  });

});

describe("autofill hash helpers", () => {
  it("parses WhatsApp Web client and token hashes", () => {
    expect(parseAutofillHash("https://web.whatsapp.com/#client=acme&token=abc")).toEqual({
      client: "acme",
      token: "abc",
      hasClient: true,
      hasToken: true
    });
    expect(parseAutofillHash("https://example.com/#client=acme&token=abc")).toBeNull();
  });

  it("parses WhatsApp Web import options from hash params", () => {
    expect(parseAutofillHash(
      "https://web.whatsapp.com/#client=acme&token=abc&includeHistory=false&hideHistoryOption=true&lockHistoryOption=true&showClientField=false&canEditClient=false&showTokenField=true&canEditToken=true&panelLayout=center"
    )).toEqual({
      client: "acme",
      token: "abc",
      hasClient: true,
      hasToken: true,
      includeHistory: false,
      hideHistoryOption: true,
      lockHistoryOption: true,
      hideClientField: true,
      lockClientField: true,
      hideTokenField: false,
      lockTokenField: false,
      panelLayout: "center"
    });
  });

  it("parses aliases and query params for direct WhatsApp links", () => {
    expect(parseAutofillHash("https://web.whatsapp.com/?client=acme&token=abc&history=0&hideClientField=1&lockTokenField=false&layout=corner")).toEqual({
      client: "acme",
      token: "abc",
      hasClient: true,
      hasToken: true,
      includeHistory: false,
      hideClientField: true,
      lockTokenField: false,
      panelLayout: "corner"
    });
  });

  it("removes only extension autofill params", () => {
    expect(removeAutofillHashParams("https://web.whatsapp.com/#client=acme&token=abc&keep=1")).toBe(
      "https://web.whatsapp.com/#keep=1"
    );
    expect(removeAutofillHashParams("https://web.whatsapp.com/?client=acme&showClientField=false&keep=1#token=abc&history=false&panelLayout=center&hashKeep=1")).toBe(
      "https://web.whatsapp.com/?keep=1#hashKeep=1"
    );
  });
});

describe("import chunking", () => {
  it("splits arrays into deterministic chunks", () => {
    const chunks = [];
    pushArrayChunks(chunks, "sessions", "sessions", [{ id: 1 }, { id: 2 }, { id: 3 }], 2);

    expect(chunks).toEqual([
      { section: "sessions", count: 2, payload: { sessions: [{ id: 1 }, { id: 2 }] } },
      { section: "sessions", count: 1, payload: { sessions: [{ id: 3 }] } }
    ]);
  });

  it("keeps app-state mutation MACs grouped by collection version", () => {
    const payload = {
      sessions: Array.from({ length: 1001 }, (_, id) => ({ id })),
      appStateVersions: [{ collection: "critical", version: 2 }],
      appStateMutationMacs: [
        { collection: "critical", version: 2, mac: "match" },
        { collection: "critical", version: 3, mac: "skip" }
      ],
      history: {
        chats: [{ jid: "1@s.whatsapp.net" }],
        messages: [{ id: "m1" }]
      }
    };

    const chunks = buildImportChunks(payload);
    expect(chunks.filter((chunk) => chunk.section === "sessions").map((chunk) => chunk.count)).toEqual([1000, 1]);
    expect(chunks.find((chunk) => chunk.section === "appState")).toMatchObject({
      count: 2,
      payload: {
        appStateVersions: [{ collection: "critical", version: 2 }],
        appStateMutationMacs: [{ collection: "critical", version: 2, mac: "match" }]
      }
    });
    expect(countExpectedRows(payload)).toMatchObject({
      sessions: 1001,
      appStateMutationMACs: 1,
      validatedHistoryChats: 1,
      validatedHistoryMessages: 1
    });
    expect(appStateCollectionVersionKey({ collection: "critical", version: 2.9 })).toBe("critical\u00002");
  });
});

describe("payload policy", () => {
  it("keeps cheap session-adjacent data when history is disabled", () => {
    const payload = {
      device: {},
      sessions: [{ id: 1 }],
      contacts: [{ jid: "1@s.whatsapp.net" }],
      privacyTokens: [{ userJid: "1@s.whatsapp.net" }],
      nctSalt: "salt",
      history: { chats: [], messages: [] }
    };

    expect(importPayloadForOptions({ device: {} })).toEqual({ device: {} });
    expect(importPayloadForOptions(payload)).toEqual({
      device: {},
      sessions: [{ id: 1 }],
      contacts: [{ jid: "1@s.whatsapp.net" }],
      privacyTokens: [{ userJid: "1@s.whatsapp.net" }],
      nctSalt: "salt",
      history: { chats: [], messages: [] }
    });
    expect(importPayloadForOptions(payload, { includeHistory: true })).toEqual({
      device: {},
      sessions: [{ id: 1 }],
      contacts: [{ jid: "1@s.whatsapp.net" }],
      privacyTokens: [{ userJid: "1@s.whatsapp.net" }],
      nctSalt: "salt",
      history: { chats: [], messages: [] }
    });
    expect(importPayloadForOptions(payload, { includeHistory: false })).toEqual({
      device: {},
      sessions: [{ id: 1 }],
      privacyTokens: [{ userJid: "1@s.whatsapp.net" }],
      nctSalt: "salt"
    });
  });
});

describe("WhatsApp login detection", () => {
  it("prioritizes visible logged-in shell markers over lingering QR hints", () => {
    installWhatsAppPageStub({
      loggedInShell: true,
      qrElement: true,
      text: "scan the qr"
    });

    expect(isWhatsAppLoggedIn()).toBe(true);
  });

  it("returns logged out when only QR hints are present", () => {
    installWhatsAppPageStub({
      text: "scan the qr"
    });

    expect(isWhatsAppLoggedIn()).toBe(false);
  });
});

describe("contact normalization", () => {
  it("keeps WhatsApp Web name aliases for history-only import", () => {
    expect(normalizeContactForWhatsmeow({
      id: "5511999999999@c.us",
      shortName: "Maria",
      formattedName: "Maria Silva",
      notifyName: "Maria Push",
      verifiedNameForDisplay: "Maria Loja"
    })).toEqual({
      jid: "5511999999999@s.whatsapp.net",
      firstName: "Maria",
      fullName: "Maria Silva",
      pushName: "Maria Push",
      businessName: "Maria Loja"
    });
  });

  it("maps history LID chats to PN JIDs when contacts include the relation", () => {
    const history = normalizeHistoryJIDsWithContactLIDMap({
      chats: [{
        jid: "13224841887903@lid",
        lid: "13224841887903@lid",
        name: "Cliente Claro"
      }],
      messages: [{
        id: "msg1",
        chatJid: "13224841887903@lid",
        senderJid: "13224841887903@lid"
      }]
    }, [{
      jid: "5511999999999@s.whatsapp.net",
      lid: "13224841887903@lid",
      fullName: "Cliente Claro"
    }]);

    expect(history.chats[0]).toMatchObject({
      jid: "5511999999999@s.whatsapp.net",
      lid: "13224841887903@lid"
    });
    expect(history.messages[0]).toMatchObject({
      chatJid: "5511999999999@s.whatsapp.net",
      senderJid: "5511999999999@s.whatsapp.net"
    });
  });
});
