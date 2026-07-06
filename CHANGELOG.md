# Changelog

## 0.2.3 - 06/07/2026

### Added

- Bridge whitelabel estatico em `docs/` com `sdk.js`, `frame.html` e pagina demo para GitHub Pages.
- SDK agora expoe `UazapiConnector.mount(...)`, um componente pronto para o SaaS renderizar botao/status/fallback de instalacao.
- SDK agora expoe `UazapiConnector.create(...)` como camada headless para clientes renderizarem UI propria com estados padronizados.
- Suporte a bridge em iframe com `all_frames` e build local opcional para teste em `localhost`.
- Fluxo de bridge agora salva `client`, `token` e opcoes no storage antes de abrir/reusar o WhatsApp Web, evitando expor token no hash quando chamado pelo SDK.
- Bridge aceita `hideHistoryOption` e `lockHistoryOption` para controlar a opcao de historico no painel da extensao.
- SDK pode configurar `panelLayout`, `hideClientField` e `hideTokenField` para transformar o painel da extensao em uma confirmacao central.
- SDK adiciona aliases `showClientField`, `canEditClient`, `showTokenField` e `canEditToken` para controlar campos tecnicos de forma mais clara.
- Conta detectada agora aparece sempre no subtitulo do painel como telefone formatado, usando LID apenas quando nao houver JID.
- Pagina demo agora mostra um preview visual do painel da extensao sincronizado com as configuracoes.
- Documento `WHITELABEL_BRIDGE.md` com plano, ambiente de teste e estrategia de hospedagem estatica.

### Changed

- `disconnectLocal` deixou de ser uma opcao publica do SDK/bridge; a sessao local e sempre limpa no modo padrao e so pode ser mantida pelo modo tecnico da extensao.
- Painel deixou de abrir automaticamente ao acessar o WhatsApp Web por padrao; chamadas pelo SDK/bridge continuam abrindo o painel.
- `confirmationMode` foi removido do SDK/bridge; o mesmo comportamento deve ser configurado explicitamente com `panelLayout`, `showClientField`, `showTokenField` e demais opcoes granulares.
- Clique no icone da extensao agora foca uma aba existente do WhatsApp Web, ou abre uma nova se nenhuma existir, antes de abrir o painel.

### Fixed

- `PING` da bridge agora valida o runtime da extensao antes de responder, evitando falso positivo e erro de contexto invalidado quando a extensao e desativada com a pagina aberta.
- Painel agora atualiza o status da sessao quando o WhatsApp Web termina de carregar em uma aba nova.
- Painel solicitado no centro agora fica no canto e com acao desabilitada enquanto o WhatsApp Web ainda esta carregando a sessao.
- Painel central nao alterna mais entre centro e canto quando os sinais de login do WhatsApp Web oscilam durante atualizacoes da pagina.

## 0.2.2 - 06/07/2026

### Fixed

- Deteccao de sessao conectada agora usa sinais visiveis de login, evitando falso negativo causado por textos ou elementos de QR que permanecem no DOM.
- Pacote da extensao recriado para a versao 0.2.2.

## 0.2.1 - 03/07/2026

### Changed

- Removida a configuracao desnecessaria de salvar token no navegador; a extensao agora mantem o fluxo simples e usa a lixeira para limpar o token salvo.
- `DEVELOPERS.md` atualizado com as formas recomendadas para um SaaS incorporar a extensao usando backend autorizado, incluindo link direto, bridge e o fluxo opcional com `importKey`.
- Nome publico ajustado para `Session Migration Connector`, removendo marca de backend do pacote publico.
- Manifesto de producao manteve o dominio tecnico necessario para link abreviado e bridge, enquanto a marca publica da extensao ficou neutra.

## 0.2.0 - 02/07/2026

### Changed

- Migracao da extensao para TypeScript modular em `src/`, com build final em `dist/`.
- Fluxo de sessao ficou independente do historico: a sessao e importada primeiro, e o historico roda depois como etapa separada.
- Historico voltou a aparecer fora do modo tecnico e fica ligado por padrao.
- Modo de historico agora envia somente uma mensagem recente por chat como ancora.
- `messageSecrets` nao fazem mais parte do contrato da extensao; o history sync usa `chatJID`, `messageID`, `fromMe`, `timestamp` e `count`.
- Painel ganhou configuracoes separadas do modo tecnico opcional, ativado por gesto reservado de diagnostico.
- Documentacao separada para uso final e desenvolvimento.

### Fixed

- Normalizacao de nomes de contatos/chats no repasse de historico.
- Mapeamento LID -> PN em anchors de historico quando a relacao existe nos contatos capturados.
- Falha ao capturar ou repassar historico agora vira aviso e nao cancela a migracao da sessao.
- Pacote zip agora e gerado a partir de `dist/`, pronto para carregar sem escolher subpasta.

## 0.1.2 - 02/07/2026

### Changed

- Historico de mensagens saiu do fluxo padrao e passou a ficar atras do modo tecnico.
- Importacao padrao voltou a focar somente na migracao da sessao, sem solicitar historico automaticamente.
- Pacote da extensao foi recriado para a versao 0.1.2.

### Fixed

- Reparos de JID no historico para evitar tratar o JID da propria conta como chat importado.
- Matching de mensagens passou a considerar origem e destino ao montar anchors de historico.

## 0.1.1 - 01/07/2026

### Changed

- Captura de historico e midia do WhatsApp Web ficou mais robusta.
- Painel passou a exibir a versao da extensao.
- Opcao de historico passou a ser identificada como beta.
- Pacote da extensao foi recriado para a versao 0.1.1.

### Fixed

- Tratamento de contexto invalidado quando a extensao e atualizada ou recarregada enquanto o WhatsApp Web esta aberto.
- Leitura e escrita de storage passaram a falhar com mensagem orientando recarregar a aba quando o contexto da extensao fica invalido.
- Extracao de mensagens passou a considerar modelos carregados no store, campos serializados e aliases usados pelo WhatsApp Web.

## 0.1.0 - 01/07/2026

### Added

- Versao inicial da extensao.
- Instalacao manual pelo Chrome ou Edge.
- Migracao de sessao conectada no WhatsApp Web para instancia autorizada.
- Abertura automatica do painel por URL com `client` e `token`.
- Pacote zip inicial da extensao.
