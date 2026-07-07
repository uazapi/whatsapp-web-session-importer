# Proximo passo: connect.sessiontransfer.com real

Plano operacional para transformar o bridge estatico atual em uma pagina real de producao para parceiros, mantendo a extensao generica e sem adicionar permissoes amplas no manifest.

## Objetivo da v1.1

Publicar `connect.sessiontransfer.com` como bridge oficial entre o SaaS do cliente e a extensao.

A v1.1 deve entregar:

- SDK publico em `https://connect.sessiontransfer.com/sdk.js`;
- iframe bridge em `https://connect.sessiontransfer.com/frame.html`;
- demo funcional em `https://connect.sessiontransfer.com/demo.html`;
- pagina de importacao simples em `https://connect.sessiontransfer.com/import/?client=...&token=...`;
- home tecnica com diagnostico, instalacao e exemplo rapido;
- documentacao para parceiros em `CONNECTOR_INTEGRATION.md`;
- fluxo testado com HTTPS real;
- pacote final da extensao `0.2.3` pronto para publicacao.

Fica fora da v1.1:

- backend dinamico;
- allowlist dinamica;
- logs/auditoria centralizados;
- mascaramento de `client/token` no frontend do SaaS.

## Decisao de hospedagem

Usar GitHub Pages publicando a pasta `docs/` com dominio customizado:

```text
connect.sessiontransfer.com
```

Arquivos publicados:

```text
docs/index.html
docs/frame.html
docs/sdk.js
docs/demo.html
docs/import/index.html
docs/CNAME
docs/.nojekyll
```

GitHub Pages e suficiente para a v1.1 porque o bridge e estatico e nao precisa executar codigo no servidor.

## Pagina inicial real

Transformar `docs/index.html` em uma pagina tecnica simples, nao uma landing page comercial.

Conteudo recomendado:

- status da extensao: instalada, nao instalada, verificando;
- versao detectada;
- botao para instalar a extensao na Chrome Web Store;
- botao para abrir a demo;
- snippet rapido de integracao;
- explicacao curta: o dominio existe para permitir que SaaS de parceiros converse com a extensao via iframe bridge sem ampliar o manifest.
- link de teste para `/import/`, que e o metodo simples recomendado.

Exemplo de snippet na home:

```html
<script src="https://connect.sessiontransfer.com/sdk.js"></script>
<script>
  async function conectarWhatsApp() {
    const status = await SessionTransfer.ping();
    if (!status.installed) {
      window.location.href = "https://chromewebstore.google.com/detail/cdjfbjfolpeenlmanmkoglhhcjfgcbpp";
      return;
    }

    await SessionTransfer.open({
      client: "minha-loja",
      token: "TOKEN_DA_INSTANCIA"
    });
  }
</script>
```

## Pagina `/import/` para link unico

Criar uma pagina estatica em `docs/import/index.html` para o menor atrito possivel.

O SaaS do cliente pode enviar o usuario para:

```text
https://connect.sessiontransfer.com/import/?client=minha-loja&token=TOKEN_DA_INSTANCIA
```

Fluxo esperado:

1. Ler `client` e `token` da URL.
2. Guardar o payload em `sessionStorage` para permitir voltar da Chrome Web Store sem perder a configuracao.
3. Limpar a query string visivel com `history.replaceState`.
4. Verificar se a extensao esta instalada via `SessionTransfer.ping()`.
5. Se nao estiver instalada, enviar para a Chrome Web Store mantendo a pagina no historico do navegador.
6. Se estiver instalada, abrir ou focar o WhatsApp Web via `SessionTransfer.open()`.
7. Abrir o painel da extensao com configuracao simples: campos ocultos, historico incluido por padrao e painel central.

Parametros opcionais suportados:

- `includeHistory` ou `history`, padrao `true`;
- `hideHistoryOption`, padrao `true`;
- `lockHistoryOption`, padrao `true`;
- `showClientField`, padrao `false`;
- `canEditClient`, padrao `false`;
- `showTokenField`, padrao `false`;
- `canEditToken`, padrao `false`;
- `panelLayout`, padrao `center`.

Esse fluxo e util como metodo simples porque o mesmo link resolve os dois casos principais: instalar a extensao ou continuar a migracao no WhatsApp Web.

Os mesmos parametros comuns tambem devem funcionar no link direto para WhatsApp Web:

```text
https://web.whatsapp.com/#client=minha-loja&token=TOKEN
```

Nesse caso, nao existe deteccao/instalacao da extensao. O link direto deve ser usado apenas quando o SaaS ja sabe que a extensao esta instalada.

## SDK publico

Manter apenas a camada core. O SaaS do cliente renderiza a propria UI e usa o SDK para falar com a extensao:

```js
const status = await SessionTransfer.ping();

await SessionTransfer.open({
  client: "minha-loja",
  token: "TOKEN"
});
```

Metodos publicos:

- `SessionTransfer.ping()`;
- `SessionTransfer.open(payload)`;
- `SessionTransfer.fallbackUrl(payload)`;
- `SessionTransfer.buildWhatsAppUrl(payload)`;
- `SessionTransfer.on(event, handler)`;
- `SessionTransfer.off(event, handler)`;
- `SessionTransfer.configure(options)`.

## Versionamento do SDK

Para producao, evitar que todos os clientes dependam somente de um arquivo mutavel.

Estrutura recomendada:

```text
/sdk.js            -> versao estavel atual
/v0.2.3/sdk.js     -> versao fixa da extensao 0.2.3
/v1/sdk.js         -> alias futuro para contrato estavel v1
```

Na v1.1, `sdk.js` pode ser suficiente. Antes de muitos parceiros usarem, criar pelo menos uma pasta versionada.

## Manifest da extensao

Manifest atual permite:

```json
"matches": ["https://*.uazapi.com/*"]
```

Isso funciona para testes e subdominios permitidos.

Antes de publicar uma versao mais restrita na Chrome Web Store, considerar trocar para:

```json
"matches": ["https://connect.sessiontransfer.com/*"]
```

Manter `all_frames: true`, porque o bridge roda dentro de iframe.

## Ordem de execucao

1. Melhorar `docs/index.html` para virar a home tecnica real.
2. Criar e testar `docs/import/index.html` como link unico do metodo simples.
3. Ajustar `docs/demo.html` para parecer exemplo oficial de integracao.
4. Criar caminho versionado opcional para o SDK, por exemplo `docs/v0.2.3/sdk.js`.
5. Configurar GitHub Pages para publicar `docs/`.
6. Configurar DNS `connect.sessiontransfer.com`.
7. Habilitar HTTPS no GitHub Pages.
8. Testar `https://connect.sessiontransfer.com/frame.html` carregando em iframe.
9. Testar `https://connect.sessiontransfer.com/sdk.js` em pagina externa.
10. Testar `https://connect.sessiontransfer.com/demo.html`.
11. Testar `https://connect.sessiontransfer.com/import/?client=minha-loja&token=TOKEN`.
12. Gerar build final de producao da extensao.
13. Testar pacote carregando `dist` em Chrome/Edge/Brave.
14. Publicar ou preparar envio da versao `0.2.3` na Chrome Web Store.
15. Atualizar README com instrucao final para parceiros.

## Checklist de QA

Testar com extensao instalada:

- SaaS/demo detecta extensao instalada;
- `PING` retorna versao correta;
- clique em "Abrir WhatsApp" abre ou foca `web.whatsapp.com`;
- token nao aparece na URL do WhatsApp no fluxo via bridge;
- painel abre com client/token preenchidos;
- painel central nao alterna entre centro e canto;
- painel manual pelo icone da extensao abre no canto;
- campos client/token aparecem ou somem conforme configuracao;
- campos client/token ficam editaveis ou travados conforme configuracao;
- historico fica marcado quando `includeHistory: true`;
- opcao de historico some quando `hideHistoryOption: true`;
- opcao de historico fica visualmente travada quando `lockHistoryOption: true`;
- `disconnectLocal` fica sempre ligado no modo padrao;
- botao de configuracoes nao aparece no painel central;
- se WhatsApp Web estiver carregando, painel nao fica piscando;
- se WhatsApp Web nao estiver logado, usuario consegue entrar e continuar.

Testar sem extensao ou com extensao desativada:

- SDK nao retorna falso positivo;
- demo tecnica mostra estado de instalacao;
- link/botao de instalacao abre Chrome Web Store;
- nao aparece erro `Extension context invalidated` na extensao ativa.

Testar ambiente:

- build de producao nao inclui `localhost` no `dist/manifest.json`;
- build local inclui `localhost` e `127.0.0.1` apenas no `dist/manifest.json`;
- `manifest.json` fonte permanece restrito ao dominio HTTPS;
- GitHub Pages serve `sdk.js`, `frame.html` e `demo.html` com HTTPS.
- `/import/` redireciona para instalacao quando a extensao nao esta instalada;
- `/import/` abre ou foca WhatsApp Web quando a extensao esta instalada;
- `/import/` remove `client/token` da barra de endereco depois de carregar.
- link direto `https://web.whatsapp.com/#client=...&token=...` aceita as mesmas opcoes comuns;
- link direto remove parametros da barra de endereco depois de aplicar.

Comandos de validacao:

```bash
npm run typecheck
npm test
node --check docs/sdk.js
git diff --check
npm run build
npm run build:local
```

## Riscos e cuidados

- GitHub Pages e publico: nao colocar segredos em `docs/`.
- O token existe no link inicial; isso e parte do contrato atual e deve ser tratado pelo SaaS como credencial autorizada da instancia.
- O dominio `connect.sessiontransfer.com` fica escondido visualmente dentro do iframe, mas aparece em DevTools/network.
- Se recarregar a extensao unpacked, paginas ja abertas podem precisar de reload para o content script novo responder.
- Se muitos parceiros usarem, criar versionamento de SDK antes de mudar comportamento.

## Criterio de pronto

A v1.1 esta pronta quando:

- `https://connect.sessiontransfer.com` esta publicado com HTTPS;
- `https://connect.sessiontransfer.com/import/` funciona como link unico;
- demo real detecta a extensao e abre o WhatsApp;
- painel central fica estavel;
- token nao aparece na URL do WhatsApp;
- build de producao esta validado;
- README e `WHITELABEL_BRIDGE.md` apontam para o fluxo real.
- `CONNECTOR_INTEGRATION.md` documenta link unico, link direto e SDK.
