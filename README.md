# Importador de Sessão do WhatsApp Web

Extensão para migrar uma sessão já conectada no WhatsApp Web para a API da Uazapi.

Esta extensão funciona apenas para instâncias Uazapi. Use somente em um computador confiável e não compartilhe o token da instância com outras pessoas.

## Antes de começar

Você precisa ter:

1. O arquivo `whatsapp-web-session-importer.zip`.
2. O nome da assinatura da instância.
3. O token da instância.
4. Acesso ao WhatsApp que será conectado na instância.

Se você recebeu um link pronto da equipe de suporte ou do painel da Uazapi, use esse link. Ele já deve vir com `client` e `token` preenchidos.

## 1. Instalar a extensão

1. Descompacte o arquivo `whatsapp-web-session-importer.zip`.
2. Abra o Chrome ou Edge.
3. Abra a página de extensões.

No Chrome:

```text
chrome://extensions
```

No Edge:

```text
edge://extensions
```

4. Ative o **Modo do desenvolvedor**.
5. Clique em **Carregar sem compactação**.
6. Selecione a pasta descompactada da extensão.

A pasta correta é a pasta que contém o arquivo `manifest.json`.

Se você abrir a pasta e enxergar outra pasta dentro dela, provavelmente precisa entrar nessa pasta de dentro e selecionar a que contém o `manifest.json`.

## 2. Abrir o WhatsApp Web

Abra o WhatsApp Web normalmente:

```text
https://web.whatsapp.com
```

Se aparecer um QR Code, escaneie com o celular e aguarde o WhatsApp Web terminar de carregar.

Espere as conversas aparecerem antes de clicar em **Migrar sessão**.

## 3. Usar com nome da assinatura e token na URL

A extensão aceita os dados da instância diretamente na URL do WhatsApp Web.

Use este formato:

```text
https://web.whatsapp.com/#client=SERVER_URL&token=TOKEN
```

Troque:

- `SERVER_URL` pelo endereço da assinatura/instância.
- `TOKEN` pelo token da instância.

O parâmetro da URL continua se chamando `client`, mas o valor dele é o `server_url`.

O `server_url` pode ser abreviado ou completo.

Forma abreviada:

Exemplo:

```text
https://web.whatsapp.com/#client=minhaempresa&token=550e8400-e29b-41d4-a716-446655440000
```

Forma completa:

```text
https://web.whatsapp.com/#client=https://minhaempresa.uazapi.com&token=550e8400-e29b-41d4-a716-446655440000
```

Nesse exemplo, `minhaempresa` vira:

```text
https://minhaempresa.uazapi.com
```

Não altere letras, números ou símbolos do token.

Depois que a extensão lê os dados, ela remove `client` e `token` da barra de endereço automaticamente. Isso é esperado.

## 4. Migrar a sessão

Ao abrir o WhatsApp Web com `client` e `token` na URL, o painel da extensão abre automaticamente.

Antes de continuar:

1. Confira se o campo **Nome da assinatura** mostra o valor correto.
2. Confira se o campo **Token** está correto.
3. Clique em **Migrar sessão**.

A extensão vai:

1. Verificar a instância na API da Uazapi.
2. Capturar a sessão conectada no WhatsApp Web.
3. Esperar a sessão estar completa antes de enviar.
4. Enviar a sessão para a API.
5. Repassar o histórico recente como âncora para a API.
6. Limpar a sessão local deste navegador.
7. Iniciar a conexão da instância automaticamente.

Durante esse processo, a aba do WhatsApp Web pode recarregar ou sair da sessão. Isso é normal.

O histórico fica ligado por padrão. Se essa etapa falhar, a extensão mostra um aviso, mas não desfaz a sessão que já foi importada.

## 5. Depois da migração

Depois que a migração terminar, acompanhe a instância na Uazapi.

Se tudo estiver correto, a instância deve ficar conectada pela API.

O WhatsApp Web usado para importar a sessão pode ficar desconectado, porque a sessão foi movida para a instância.

## Se o painel não abrir

Faça estas verificações:

1. Confirme que a extensão está instalada e ativa em `chrome://extensions` ou `edge://extensions`.
2. Confirme que você selecionou a pasta que contém `manifest.json`.
3. Confirme que você abriu `https://web.whatsapp.com`.
4. Confirme que o WhatsApp Web está conectado.
5. Abra novamente o link com `client` e `token`.
6. Clique no ícone da extensão no navegador para abrir o painel manualmente.

Se ainda não abrir, recarregue a página do WhatsApp Web e tente novamente.

## Se a migração falhar

Verifique:

1. Se o nome da assinatura está correto.
2. Se o token da instância está correto.
3. Se a instância existe na Uazapi.
4. Se o WhatsApp Web terminou de carregar as conversas.
5. Se a internet está funcionando.

Não tente editar o token manualmente se você não tiver certeza. Copie novamente o token original ou peça outro link para a equipe de suporte.

## Configurações do painel

O botão de engrenagem abre as configurações do painel.

Você pode configurar:

- abrir o painel automaticamente;
- usar tema claro, escuro ou seguir o tema do WhatsApp;
- incluir ou não incluir histórico de mensagens.

Mesmo com a opção **Abrir painel automaticamente** desligada, o painel sempre abre quando a URL tiver `client` e `token`.

O modo técnico continua escondido. Para abrir o modo técnico, clique 5 vezes no cabeçalho do painel.

## O que a extensão não faz

Esta extensão não cria uma nova conta de WhatsApp.

Ela também não conecta uma instância sozinha se o WhatsApp Web ainda não estiver autenticado. Primeiro é necessário escanear o QR Code no WhatsApp Web.

Ela não deve ser usada em computadores públicos ou compartilhados.

## Para desenvolvedores

O guia técnico completo fica em [DEVELOPERS.md](DEVELOPERS.md).

Ele explica como a extensão funciona, como adaptar para forks, como integrar com SaaS usando `PING`/`START_IMPORT`, quais endpoints são usados e por que algumas decisões foram tomadas.
