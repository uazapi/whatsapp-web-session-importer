# Politica de Privacidade - WhatsApp Session Connector

Data de vigencia: 3 de julho de 2026

Esta politica descreve como a extensao Chrome **WhatsApp Session Connector**
processa dados ao migrar uma sessao ja conectada no WhatsApp Web para uma
instancia Uazapi autorizada.

## Finalidade unica

A extensao existe para permitir que uma equipe autorizada importe uma sessao
ativa do WhatsApp Web para uma instancia Uazapi configurada pelo usuario ou pelo
SaaS autorizado. Ela nao oferece recursos de publicidade, rastreamento,
analytics de comportamento ou uso para qualquer finalidade fora dessa migracao.

## Dados processados

Durante a importacao, a extensao pode processar:

- URL, subdominio ou identificador da instancia Uazapi informada;
- token, chave de importacao ou credencial tecnica fornecida para autorizar a
  importacao;
- dados tecnicos da sessao local do WhatsApp Web presentes no navegador,
  incluindo dados de autenticacao, chaves, metadados e bancos locais usados pelo
  WhatsApp Web;
- identificadores da conta, contatos, conversas, mensagens recentes e metadados
  necessarios para validar a sessao e preservar ancoras de historico durante a
  importacao;
- configuracoes locais da extensao, como URL/token informados, preferencias de
  interface e modo tecnico.

## Como os dados sao usados

Os dados sao usados apenas para:

- validar se a instancia Uazapi informada esta disponivel e autorizada;
- montar e enviar a carga tecnica de importacao da sessao;
- enviar partes da importacao em chunks com verificacao de integridade;
- enviar historico recente quando necessario para ancorar a sessao importada;
- limpar a sessao local do WhatsApp Web apos a conclusao, evitando uso duplicado
  da mesma conta no navegador e na instancia importada.

## Compartilhamento e transferencia

A extensao envia os dados somente para a instancia Uazapi configurada ou para o
backend/SaaS autorizado pelo usuario quando esse modo de integracao estiver
implementado. Esse backend/SaaS pode entao encaminhar a importacao para a API
Uazapi conforme a autorizacao do cliente.

Os dados nao sao vendidos, alugados ou compartilhados para publicidade,
perfilamento, avaliacao de credito, emprestimos ou finalidades nao relacionadas
ao objetivo da extensao.

## Armazenamento local

A extensao usa `chrome.storage.local` para manter configuracoes e credenciais
tecnicas necessarias ao fluxo de importacao. Esses dados ficam no navegador do
usuario ate serem substituidos, apagados pela propria extensao, removidos pelo
usuario ou eliminados ao desinstalar a extensao.

Apos uma importacao bem-sucedida, a extensao limpa dados locais da sessao do
WhatsApp Web no navegador quando esse comportamento e executado pelo fluxo de
importacao.

## Codigo remoto

A extensao nao carrega nem executa JavaScript ou WebAssembly remoto. O codigo da
extensao e empacotado no item publicado. As conexoes externas sao requisicoes
HTTPS para a API Uazapi, para a instancia configurada ou para o backend/SaaS
autorizado.

## Controle do usuario

O usuario pode:

- revisar a instancia e o token antes de iniciar a importacao;
- remover dados salvos da extensao pelo controle de limpeza disponivel na
  interface;
- interromper o uso removendo a extensao do Chrome;
- solicitar ao responsavel pela instancia Uazapi ou pelo SaaS autorizado a
  exclusao ou revisao dos dados processados no backend.

## Seguranca

A extensao limita seu funcionamento aos hosts declarados no manifesto e envia
dados por conexoes HTTPS quando se comunica com instancias Uazapi ou backends
autorizados. Como a importacao envolve credenciais e dados de sessao, o uso deve
ocorrer apenas em computadores confiaveis e com instancias autorizadas.

## Contato

Para duvidas sobre esta politica ou sobre o funcionamento da extensao, abra uma
issue no repositorio:

https://github.com/uazapi/whatsapp-web-session-importer/issues

## Aviso

WhatsApp Session Connector nao e um produto oficial do WhatsApp. WhatsApp e
marca de seus respectivos proprietarios.
