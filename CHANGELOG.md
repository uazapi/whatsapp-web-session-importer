# Changelog

## 0.2.1 - 03/07/2026

### Changed

- Removida a configuracao desnecessaria de salvar token no navegador; a extensao agora mantem o fluxo simples e usa a lixeira para limpar o token salvo.
- `DEVELOPERS.md` atualizado com as formas recomendadas para um SaaS incorporar a extensao usando o backend Uazapi, incluindo link direto, bridge e o fluxo opcional com `importKey`.

## 0.2.0 - 02/07/2026

### Changed

- Migracao da extensao para TypeScript modular em `src/`, com build final em `dist/`.
- Fluxo de sessao ficou independente do historico: a sessao e importada primeiro, e o historico roda depois como etapa separada.
- Historico voltou a aparecer fora do modo tecnico e fica ligado por padrao.
- Modo de historico agora envia somente uma mensagem recente por chat como ancora.
- `messageSecrets` nao fazem mais parte do contrato da extensao; o history sync usa `chatJID`, `messageID`, `fromMe`, `timestamp` e `count`.
- Painel ganhou configuracoes separadas do modo tecnico, mantendo o modo tecnico escondido por 5 cliques.
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
- Migracao de sessao conectada no WhatsApp Web para instancia Uazapi.
- Abertura automatica do painel por URL com `client` e `token`.
- Pacote zip inicial da extensao.
