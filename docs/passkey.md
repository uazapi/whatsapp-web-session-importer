# Problemas de passkey no WhatsApp

Esta página explica o fluxo recomendado quando o cliente encontra problema de passkey, QR Code, pareamento ou confirmação de dispositivo ao conectar uma instância de WhatsApp.

## Resumo

O conector não tenta resolver passkey dentro do backend.

A solução é usar o fluxo oficial do WhatsApp Web: o usuário autentica a conta no navegador, confirma qualquer passkey ou QR Code no próprio WhatsApp, e só depois a extensão migra a sessão já autorizada para o backend configurado.

Isso reduz atrito porque o cliente final faz uma ação que ele já conhece: entrar no WhatsApp Web.

## Qual era o problema

Em fluxos baseados apenas no backend, a conexão pode depender de QR Code, pair code, passkey ou algum challenge temporário. Quando esse desafio aparece fora do navegador do usuário, o suporte fica mais difícil:

- o cliente precisa entender uma etapa técnica;
- o backend pode não ter contexto visual para completar o desafio;
- o challenge pode expirar;
- cada navegador, conta e dispositivo pode se comportar de forma diferente;
- a experiência não fica simples para o cliente final.

## Como resolvemos

A autenticação acontece no WhatsApp Web, onde o usuário já consegue confirmar tudo pelo celular.

Depois que o WhatsApp Web está conectado, a extensão:

1. recebe `client` e `token` pelo link do conector ou pelo SDK;
2. abre ou foca `https://web.whatsapp.com`;
3. espera a sessão do WhatsApp Web terminar de carregar;
4. identifica a conta conectada para o usuário confirmar;
5. captura os dados técnicos da sessão dentro da aba do WhatsApp Web;
6. envia a sessão por HTTPS para o backend autorizado;
7. limpa a sessão local do navegador ao concluir, evitando uso duplicado da mesma conta.

Na prática, o passkey deixa de ser um problema do backend. Ele vira parte normal do login do WhatsApp Web.

## Como o cliente deve fazer

O fluxo recomendado é:

1. Abrir o link único enviado pelo painel ou pelo suporte.
2. Instalar a extensão, se o navegador ainda não tiver.
3. Entrar no WhatsApp Web quando a página abrir.
4. Se aparecer QR Code, escanear pelo celular.
5. Se aparecer confirmação de passkey ou dispositivo, aprovar pelo fluxo normal do WhatsApp.
6. Aguardar as conversas aparecerem no WhatsApp Web.
7. Conferir a conta exibida pela extensão.
8. Clicar em **Migrar sessão**.

O usuário não precisa copiar challenge, token interno, código técnico ou arquivo de sessão.

## Como o SaaS deve abrir o fluxo

Para o método simples, gere um link único com `client` e `token`:

```text
https://connect.sessiontransfer.com/import/?client=minha-loja&token=TOKEN_DA_INSTANCIA
```

O conector faz o resto:

1. verifica se a extensão está instalada;
2. envia para instalação se faltar extensão;
3. abre ou foca o WhatsApp Web se a extensão existir;
4. passa as configurações para a extensão;
5. deixa o usuário confirmar a conta antes da migração.

Se o SaaS tiver UI própria, use o SDK:

```html
<script src="https://connect.sessiontransfer.com/sdk.js"></script>
<script>
  async function migrarSessao() {
    const payload = {
      client: "minha-loja",
      token: "TOKEN_DA_INSTANCIA"
    };

    const status = await SessionTransfer.ping();
    if (!status.installed) {
      window.location.href = "https://chromewebstore.google.com/detail/cdjfbjfolpeenlmanmkoglhhcjfgcbpp";
      return;
    }

    await SessionTransfer.open(payload);
  }
</script>
```

## O que orientar no suporte

Se o cliente disser que está travado em passkey, QR Code ou pareamento:

1. confirme se ele está usando Chrome ou Edge no computador;
2. confirme se a extensão está instalada e ativa;
3. peça para ele abrir o link único novamente;
4. peça para ele concluir o login no WhatsApp Web normalmente;
5. peça para ele aguardar a lista de conversas aparecer;
6. só então peça para confirmar a migração no painel da extensão.

Se a conta já estava conectada no WhatsApp Web, mas o painel ainda pede para entrar:

1. recarregue `https://web.whatsapp.com`;
2. aguarde as conversas aparecerem;
3. clique novamente no botão do SaaS ou no link único;
4. se necessário, clique no ícone da extensão.

## Boas práticas

Para manter o atendimento simples:

- use o link gerado pelo painel ou pela equipe de suporte;
- conclua o login no WhatsApp Web antes de confirmar a migração;
- aguarde as conversas aparecerem antes de clicar em **Migrar sessão**;
- compartilhe o link apenas com a pessoa autorizada a conectar a instância.

## Limites conhecidos

A extensão depende do WhatsApp Web estar autenticado no navegador. Se o WhatsApp mudar a forma como armazena a sessão, pode ser necessário publicar uma nova versão da extensão.

Também é normal que, depois da migração, o WhatsApp Web usado no navegador fique desconectado. A sessão foi movida para a instância autorizada.
