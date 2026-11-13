# Seven Desk — website oficial

Site institucional estático em português do Brasil para o Seven Desk.

**Produção:** https://www.sevendesk.tech/

A identidade do site usa o mesmo símbolo vetorial roxo e os tokens escuros do dashboard Flutter (gradiente #C575FF → #6D2BEC, fundo #0C0A19). O ícone tem fundo transparente, inclusive no favicon.

## Estrutura

- `index.html`: página inicial, recursos, casos de uso, instruções e downloads.
- `styles.css`: design responsivo, tipografia, acessibilidade e ilustração da interface.
- `script.js`: menu responsivo, perguntas frequentes e ano do rodapé.
- `privacidade.html` e `licencas.html`: transparência, atribuições e privacidade do site.
- `favicon.svg`: identidade do site.
- `vercel.json`: cabeçalhos de segurança e URLs limpas.

## Domínio e DNS

A Vercel serve o site em `www.sevendesk.tech` (CNAME `7a02be585b4d78b4.vercel-dns-017.com`). O domínio raiz `sevendesk.tech` permanece apontando para o servidor de acesso remoto em `187.53.111.184`, por isso o painel da Vercel pode informar que o apex está mal configurado. **Não alterar o A/AAAA do apex para resolver o alerta**, pois isso pode interromper conexões remotas. Redirecionamento HTTPS do apex para www exige configuração no servidor que atende o domínio raiz, ou migração de todos os endpoints remotos para um subdomínio próprio.

## Publicação

O projeto Vercel **seven-desk-site** está conectado ao repositório `gabriell211/Seven-Desk`, com Root Directory `website`. Ele é **independente** do projeto `seven-desk-deploy`, que atende à infraestrutura de conexão remota. Ao alterar o site na branch de produção, o Vercel pode disparar um novo deploy automaticamente.

A página principal é estática. Para compilar a área experimental de contas, execute `npm ci` e `npm run build` na pasta `website`; a Vercel executa o build no deploy.

## Planos em desenvolvimento

A seção de planos apresenta um mês grátis a partir do cadastro, seguido por R$ 39,90 por usuário/mês ou R$ 400 por usuário/ano, com computadores ilimitados. A renovação planejada é feita pelo cliente, sem cobrança automática. Os botões públicos ficam desativados até que cadastro, pagamento e autorização do aplicativo estejam integrados e testados. A área autenticada pode preparar o checkout individual por plano, mas só apresenta a compra após confirmar os gates server-side de pagamento e a aprovação operacional explícita `SEVEN_SALES_LAUNCH_APPROVED=1`. Esta variável não representa homologação automática: só deve ser habilitada após a aplicação efetiva das assinaturas no aplicativo e servidor, monitoramento, estornos e teste ponta a ponta. A regra do mês grátis é calculada na cobrança a partir da data da conta, mas ainda precisa ser aplicada pelo servidor de acesso remoto.

`lib/infinitepay.js` prepara links e consulta a confirmação junto à InfinitePay; `lib/billing.js` contém a lógica transacional de crédito por usuário. `db/001_billing.sql` define as tabelas para uma branch com Neon Auth. As rotas `api/checkout.js` e `api/infinitepay-webhook.js` estão desabilitadas por padrão, com chaves de ativação separadas (`SEVEN_BILLING_ENABLED` e `SEVEN_WEBHOOK_ENABLED`). Os links gerados por pedido são de uso único e expiram após 30 minutos. A página de retorno não confirma pagamentos por si só: se o usuário estiver autenticado, ela usa `POST /api/confirm-payment` para conferir os identificadores com a API do provedor, limitados ao pedido pertencente àquele usuário. O webhook segue como canal principal de confirmação. Ainda é necessário implementar a autorização no servidor de acesso remoto, estornos, reprocessamento e monitoramento de falhas antes de habilitar vendas.

`conta.html` possui navegação para `/entrar`, `/cadastro` e recuperação no PR, mas não está publicada em produção e os cadastros permanecem bloqueados. Ela usa o serviço configurado em `NEON_AUTH_BASE_URL`, não libera acesso ao aplicativo e não deve ser apontada para contas reais até que validação de e-mail, recuperação de senha, SMTP de produção, autorização e os demais fluxos sejam preparados e testados. Em prévias, use somente uma branch de testes isolada do banco.

Os links cadastrados pelo responsável da conta InfinitePay `gabriel_1313` foram conferidos diretamente em 13/11/2026:

- **Mensal — R$ 39,90:** https://checkout.infinitepay.io/gabriel_1313/mN840xnjIJ
- **Anual — R$ 400,00:** https://checkout.infinitepay.io/gabriel_1313/DaWfLD8fl9

Esses links fixos **não substituem** o checkout gerado por pedido: para creditar uma assinatura ao usuário correto, a API cria um `order_nsu` individual e configura `redirect_url` e `webhook_url` no novo link. Não publique botões para os links fixos como se liberassem acesso automático. A validação das URLs geradas pela API aceita apenas HTTPS em `checkout.infinitepay.io` ou `checkout.infinitepay.com.br`.

Para habilitar o checkout no futuro, configure `INFINITEPAY_HANDLE=gabriel_1313` e `INFINITEPAY_API_KEY` somente no servidor. A chave é necessária para limitar cada link a um pagamento; ela não deve ser incluída no frontend. A documentação da InfinitePay informa que o webhook não tem assinatura, então cada aviso precisa ser confirmado pela API. A chave de API e as credenciais do banco não fazem parte do repositório. Não coloque em produção até integrar e testar o login e a autorização no Seven Desk.

## Autenticação, licenciamento e operação

A conta precisa ser verificada por código de e-mail antes de emitir um pedido de pagamento ou receber um período de teste pela API. A sessão usa um JWT assinado pelo Neon Auth (EdDSA, expiração de 15 minutos), verificado em cada operação contra JWKS, `iss` e `aud` oficiais do serviço.

A rota `GET /api/license` foi preparada para consulta **pelo servidor de sinalização/retransmissão**, usando `Authorization: Bearer <JWT-da-conta>`. Ela retorna `allowed=true`, `status` e `accessEndsAt` somente se a assinatura estiver válida no Neon. Respostas `401`, `403` ou `503` não são autorização para acesso. O cliente **não pode** determinar por conta própria se a licença é válida.

A rota tem gate `SEVEN_LICENSE_API_ENABLED=0` na Vercel. Ainda é preciso implementar a autenticação do usuário no desktop e a consulta obrigatória do endpoint pelo **servidor real que aceita sessões remotas**, migrar e homologar duas máquinas e só então ativar esse gate. O repositório Seven Desk atual contém o aplicativo, mas não contém o código-fonte do servidor de sinalização/retransmissão implantado na VPS. **Não interrompa conexões existentes com uma checagem parcial implementada apenas no cliente.**

**E-mail de produção (Hostinger):** caixa oficial `sevendesk@sevendesk.tech`. Usar **este endereço como usuário SMTP e remetente**, com nome de exibição `Seven Desk`. Reutilizar o e-mail existente como SMTP do Neon Auth, sem alterar os registros MX nem os DNS do acesso remoto. Para contas **Hostinger Email** (confirmar no hPanel: E-mails → Gerenciar → Configuração manual), o SMTP costuma ser `smtp.hostinger.com`, porta `465` com SSL/TLS; alternativamente `587` com STARTTLS, **usuário = endereço de e-mail completo**, remetente = endereço autorizado e senha exclusivamente nas configurações protegidas do Neon Auth (nunca no GitHub ou Vercel público). Configurar em Neon → Auth → Email Provider → Standard SMTP com `host=smtp.hostinger.com`, `port=465`, `security=SSL/TLS`, `username=sevendesk@sevendesk.tech`, `sender_email=sevendesk@sevendesk.tech`, `sender_name=Seven Desk` e a **senha da caixa informada somente na interface segura do Neon**. Se o hPanel exibir configurações diferentes, preferir as do hPanel. Validar teste real de envio, OTP e recuperação antes de ativar cadastro. O domínio opcional `mail.sevendesk.tech` havia sido criado no Resend, mas **não é necessário** se a caixa Hostinger for usada; mantê-lo sem DNS/uso até decidir o destino. A Neon Auth `main` agora usa **SMTP personalizado da Hostinger**. Em 13/11/2026, um envio de teste realizado pelo Neon para `sevendesk@sevendesk.tech` retornou `success: true` após corrigir o usuário SMTP para o endereço completo. A entrega final na caixa de entrada e os fluxos de OTP e redefinição de senha ainda exigem testes de ponta a ponta. **Cadastro e pagamentos seguem desativados.**

A API da InfinitePay não oferece um endpoint documentado para confirmar **estorno** com a mesma garantia do `/payment_check`. Webhooks não possuem assinatura e não devem, isoladamente, conceder nem revogar acesso. Operações de reembolso precisam ser conferidas no painel da InfinitePay e conciliadas em uma rotina auditável antes do lançamento. Não habilite pagamentos até o procedimento de reversão funcionar em teste.

## Downloads

Os botões apontam para a página de Releases do repositório oficial, não para um binário fixo. Se o repositório permanecer privado, usuários não autorizados precisarão de acesso para baixar os arquivos. Para distribuição pública, publique os instaladores homologados em um canal público sob controle do projeto; não exponha chaves privadas ou tokens no frontend.

## Compatibilidade e segurança

As ilustrações da home são **conceituais**, não capturas de uma sessão real. Recursos podem variar conforme a versão do cliente e a topologia da rede. A identidade visual e os avisos legais não alteram as obrigações de licença das bibliotecas de terceiros.
