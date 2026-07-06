# Bridge whitelabel para SaaS de clientes

Este documento registra a proposta v1 para reduzir atrito na integracao da extensao por SaaS de clientes, mantendo a extensao generica e sem abrir permissoes amplas no `manifest.json`.

## Objetivo

Permitir que um SaaS de cliente consiga:

- verificar se a extensao esta instalada;
- abrir o WhatsApp Web com a extensao ja pre-configurada;
- manter a experiencia visual whitelabel dentro do SaaS do cliente;
- evitar `*://*/*` no manifest;
- manter o fluxo atual com `client` e `token`, sem exigir `importKey` nesta fase.

## Ideia principal

Usar um SDK JavaScript + iframe bridge central.

```text
SaaS do cliente
  -> carrega SDK JS
  -> SDK cria iframe invisivel em um dominio central permitido
  -> iframe conversa com a extensao
  -> extensao abre/reusa WhatsApp Web
  -> painel da extensao aparece preenchido
  -> usuario confirma a migracao
```

Exemplo de integracao no SaaS do cliente:

```html
<script src="https://connector.uazapi.com/sdk.js"></script>

<div id="whatsapp-migration"></div>

<script>
  UazapiConnector.mount("#whatsapp-migration", {
    brandName: "Migrar WhatsApp",
    client: "minha-loja",
    token: "TOKEN",
    includeHistory: true,
    panelLayout: "center",
    showClientField: false,
    canEditClient: false,
    showTokenField: false,
    canEditToken: false
  });
</script>
```

O usuario final continua vendo apenas:

```text
app.cliente.com
web.whatsapp.com
```

O dominio central do bridge fica escondido dentro de um iframe, suficiente para whitelabel visual. Ele ainda pode aparecer em DevTools/network, mas nao na barra de endereco.

## Por que nao falar direto com qualquer site?

Sites externos nao podem descobrir extensoes instaladas livremente. Isso e uma protecao do navegador contra fingerprinting.

Para uma pagina web detectar a extensao, a extensao precisa cooperar por um canal permitido no manifest.

Em vez de permitir todos os sites, a extensao permite apenas o dominio central do bridge:

```json
{
  "matches": ["https://connector.uazapi.com/*"],
  "js": ["app-bridge.js"],
  "run_at": "document_start",
  "all_frames": true
}
```

O SaaS do cliente conversa com esse iframe via `postMessage`. O iframe conversa com a extensao.

## Fluxo v1 recomendado

```text
1. SaaS do cliente renderiza botao "Migrar WhatsApp".
2. Usuario clica.
3. SDK cria ou reutiliza iframe bridge invisivel.
4. SDK envia PING ao iframe.
5. Iframe repassa PING para a extensao.
6. Extensao responde CONNECTOR_READY.
7. SDK envia START_IMPORT com client/token/opcoes.
8. Extensao salva as opcoes em chrome.storage.local.
9. Extensao abre ou foca https://web.whatsapp.com.
10. Content script do WhatsApp Web le as opcoes salvas.
11. Painel abre preenchido.
12. Usuario confirma a migracao.
```

## Melhoria sobre URL com hash

Hoje o fallback simples e:

```text
https://web.whatsapp.com/#client=CLIENTE&token=TOKEN
```

Esse fallback deve continuar existindo porque e util para suporte e fluxo manual.

Mas, quando o comando vier pela bridge, a extensao pode evitar expor token na URL:

```text
Bridge -> background da extensao
  -> salva client/token/opcoes no storage
  -> abre https://web.whatsapp.com limpo
```

Depois o content script no WhatsApp Web abre o painel ja preenchido.

## Payload inicial do START_IMPORT

Para v1, manter simples:

```json
{
  "type": "START_IMPORT",
  "client": "minha-loja",
  "token": "TOKEN",
  "includeHistory": true,
  "hideHistoryOption": false,
  "lockHistoryOption": true,
  "showClientField": false,
  "canEditClient": false,
  "showTokenField": false,
  "canEditToken": false,
  "panelLayout": "center"
}
```

Campos:

- `client`: nome curto, host ou URL da instancia.
- `token`: token da instancia.
- `includeHistory`: define se o historico fica marcado.
- `hideHistoryOption`: esconde a opcao de historico no painel da extensao.
- `lockHistoryOption`: trava a opcao de historico no painel da extensao.
- `showClientField`: mostra ou esconde o campo de assinatura no painel.
- `canEditClient`: permite ou bloqueia edicao do campo de assinatura.
- `showTokenField`: mostra ou esconde o campo de token no painel.
- `canEditToken`: permite ou bloqueia edicao do campo de token.
- `panelLayout`: `corner` ou `center`.

## Responsabilidades do SDK

O SDK deve:

- criar o iframe bridge invisivel;
- enviar `PING` para detectar a extensao;
- mostrar fallback de instalacao se a extensao nao responder;
- enviar `START_IMPORT` quando a extensao estiver disponivel;
- manter a UI whitelabel no SaaS do cliente;
- expor uma API pronta para o parceiro.

API sugerida:

```js
UazapiConnector.mount("#whatsapp-migration", {
  brandName: "Migrar sessao",
  subtitle: "Conecte a sessao ativa do WhatsApp Web.",
  buttonLabel: "Abrir WhatsApp",
  markLabel: "WA",
  primaryColor: "#25c46a",
  client: "minha-loja",
  token: "TOKEN",
  includeHistory: true,
  lockHistoryOption: true,
  panelLayout: "center",
  showClientField: false,
  canEditClient: false,
  showTokenField: false,
  canEditToken: false
});
```

Para SaaS que ja tem UI propria, manter a API de baixo nivel:

```js
const connector = UazapiConnector.create({
  client: "minha-loja",
  token: "TOKEN",
  onStateChange(state) {
    // Renderize sua propria UI com: checking, missing, ready, opening, opened, error.
  }
});

connector.check();
connector.open();
```

Para controle totalmente manual, usar a camada core:

```js
UazapiConnector.open({
  client: "minha-loja",
  token: "TOKEN",
  includeHistory: true
});
```

## Responsabilidades do iframe bridge

O iframe bridge deve:

- rodar em dominio permitido pela extensao;
- receber mensagens do SDK via `postMessage`;
- validar `event.origin` contra uma allowlist ou configuracao de parceiros;
- repassar comandos para a extensao;
- devolver respostas ao SDK.

O manifest da extensao nao precisa conhecer todos os dominios dos clientes. Essa validacao fica no backend/pagina do bridge.

## Responsabilidades da extensao

A extensao deve:

- injetar `app-bridge.js` no dominio central do bridge;
- aceitar `PING`;
- aceitar `START_IMPORT` com `client/token/opcoes`;
- salvar configuracoes pendentes no `chrome.storage.local`;
- abrir ou focar `https://web.whatsapp.com`;
- fazer o painel do WhatsApp Web consumir as configuracoes pendentes;
- manter o hash `#client=&token=` como fallback manual.

## Fallbacks importantes

Se a extensao nao responder:

- mostrar botao de instalacao;
- oferecer link manual para WhatsApp Web com hash;
- orientar o usuario a recarregar a pagina depois de instalar.

Se o WhatsApp Web nao estiver logado:

- abrir WhatsApp Web;
- mostrar painel explicando que o usuario precisa entrar primeiro;
- manter dados preenchidos para continuar depois do login.

## Parametros futuros

Configuracoes ja suportadas pelo SDK:

```js
UazapiConnector.mount("#whatsapp-migration", {
  client: "minha-loja",
  token: "TOKEN",
  includeHistory: true,
  hideHistoryOption: true,
  lockHistoryOption: true,
  showClientField: false,
  canEditClient: false,
  showTokenField: false,
  canEditToken: false,
  panelLayout: "center",
  brandName: "Cliente",
  markLabel: "WA",
  primaryColor: "#22c55e"
});
```

Configuracoes futuras:

- `autoStart`;
- `theme`;
- `logoUrl`.

## ImportKey como fase futura

`importKey` nao e necessario para a v1.

Ele pode entrar depois quando quisermos:

- nao expor token no navegador;
- gerar links de uso unico;
- controlar expiracao;
- auditar por parceiro/usuario;
- resolver `importKey -> client/token` no backend.

Fluxo futuro:

```text
SaaS do cliente -> importKey
Extensao -> gateway com importKey + payload
Gateway -> resolve instancia/token e encaminha para API
```

## Roadmap sugerido

1. Ajustar `manifest.json` para permitir o dominio central do bridge com `all_frames`.
2. Ajustar `app-bridge.ts` para funcionar dentro de iframe.
3. Criar comando `PING`/`START_IMPORT` via iframe bridge.
4. Fazer background salvar configuracoes pendentes antes de abrir WhatsApp Web.
5. Fazer content script consumir configuracoes pendentes e abrir painel.
6. Criar SDK JS em camadas: `mount()` para UI pronta, `create()` headless para UI propria e `open()`/`ping()` como core.
7. Criar pagina bridge/frame no dominio central.
8. Manter fallback por hash para suporte e link manual.

## Decisao v1

Para a primeira versao whitelabel, seguir com:

```text
bridge estatico + SDK + iframe + client/token + opcoes simples
```

Nao precisamos de backend dinamico para a v1.

O bridge inicial pode ser composto apenas por arquivos estaticos:

```text
frame.html
sdk.js
demo.html
```

`frame.html` recebe mensagens do SDK por `postMessage`, conversa com a extensao e devolve respostas. `sdk.js` cria o iframe, abstrai `PING`/`START_IMPORT` e oferece uma API simples para o SaaS do cliente. `demo.html` serve apenas para testes e documentacao de integracao.

Deixar `importKey`, allowlist dinamica, branding avancado e auto-start para uma etapa posterior.

## Ambiente de teste recomendado

Para desenvolvimento, usar `localhost` primeiro.

Exemplo:

```text
http://localhost:5173/frame.html   -> iframe bridge
http://localhost:5173/sdk.js       -> SDK
http://localhost:5174/demo.html    -> pagina simulando SaaS do cliente
```

No build de desenvolvimento da extensao, gerar `dist/manifest.json` com hosts locais:

```bash
npm run build:local
```

Esse comando adiciona `http://localhost/*` e `http://127.0.0.1/*` apenas no `dist/manifest.json` local. O `manifest.json` de producao permanece restrito ao dominio HTTPS permitido.

A pagina demo em `localhost:5174` nao precisa estar no manifest, porque ela conversa apenas com o iframe. Quem conversa com a extensao e o iframe em `localhost:5173`.

Fluxo de teste local:

```text
1. Rodar build local da extensao com `npm run build:local`.
2. Carregar `dist` em chrome://extensions.
3. Subir servidor local para o bridge em localhost:5173.
4. Subir pagina demo/SaaS em localhost:5174.
5. Clicar no botao da demo.
6. Confirmar que o SDK recebe CONNECTOR_READY.
7. Confirmar que START_IMPORT abre/reusa WhatsApp Web com dados preenchidos.
```

## Hospedagem do bridge

A v1 pode rodar em GitHub Pages porque o bridge nao precisa executar codigo no servidor. GitHub Pages publica HTML, CSS e JavaScript estaticos direto de um repositorio, suporta dominio customizado e permite HTTPS quando o dominio esta configurado corretamente.

Arquivos publicados:

```text
frame.html
sdk.js
demo.html
```

O bridge pode ficar no mesmo repositorio, publicado diretamente pela pasta `docs/`:

```text
docs/index.html
docs/frame.html
docs/sdk.js
docs/demo.html
docs/CNAME
```

Se o GitHub Pages publicar a pasta `docs/` com dominio customizado, o objetivo e servir:

```text
https://connector.uazapi.com
https://connector.uazapi.com/frame.html
https://connector.uazapi.com/sdk.js
```

O manifest da extensao deve apontar para o dominio final usado pelo iframe:

```json
{
  "matches": ["https://connector.uazapi.com/*"],
  "js": ["app-bridge.js"],
  "run_at": "document_start",
  "all_frames": true
}
```

GitHub Pages serve para a v1 se:

- o bridge for somente estatico;
- nao houver segredos no frontend;
- nao for necessario resolver `importKey` no servidor;
- nao for necessario configurar headers HTTP avancados alem do que Pages oferece;
- a validacao de origem puder ser simples no JS;
- volume de trafego ficar dentro de limites normais de um asset estatico pequeno.

Pontos de atencao:

- GitHub Pages e publico; nao colocar segredos no repositorio nem no JS.
- GitHub Pages nao roda backend/server-side.
- GitHub Pages nao e a melhor opcao se o bridge virar parte central de um produto SaaS com alto volume, regras dinamicas ou transacoes sensiveis.
- Para evitar dependencia do dominio `github.io`, usar dominio customizado desde o inicio.

Configuracao sugerida:

```text
1. Criar arquivos estaticos em docs/.
2. Configurar GitHub Pages para publicar a pasta docs/.
3. Configurar dominio customizado connector.uazapi.com.
4. Habilitar Enforce HTTPS.
5. Atualizar manifest da extensao para https://connector.uazapi.com/*.
6. Manter localhost como host adicional apenas com `npm run build:local`.
```

Para producao mais robusta no futuro, considerar Cloudflare Pages, Vercel, Netlify ou um pequeno backend proprio. Isso facilita:

- allowlist dinamica de parceiros;
- headers de seguranca;
- logs e metricas;
- versionamento de SDK;
- futura resolucao de `importKey`.

## Quando trocar para algo dinamico

Manter estatico enquanto:

- `client` e `token` continuam vindo do SaaS do cliente;
- o bridge so precisa repassar mensagens;
- as opcoes aceitas sao conhecidas no frontend;
- a validacao por origem pode ser feita com configuracao embarcada ou permissiva para MVP controlado.

Trocar para backend/edge function quando precisarmos de:

- `importKey`;
- allowlist de parceiros alteravel sem publicar novo JS;
- auditoria centralizada;
- bloqueio/revogacao em tempo real;
- rate limit por parceiro;
- mascaramento total de `client/token`;
- regras por tenant vindas do servidor.
