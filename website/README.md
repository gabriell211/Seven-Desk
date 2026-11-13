# Seven Desk — website oficial

Site institucional estático em português do Brasil para o Seven Desk.

**Produção:** https://seven-desk-site.vercel.app/

## Estrutura

- `index.html`: página inicial, recursos, casos de uso, instruções e downloads.
- `styles.css`: design responsivo, tipografia, acessibilidade e ilustração da interface.
- `script.js`: menu responsivo, perguntas frequentes e ano do rodapé.
- `privacidade.html` e `licencas.html`: transparência, atribuições e privacidade do site.
- `favicon.svg`: identidade do site.
- `vercel.json`: cabeçalhos de segurança e URLs limpas.

## Publicação

O projeto Vercel **seven-desk-site** está conectado ao repositório `gabriell211/Seven-Desk`, com Root Directory `website`. Ele é **independente** do projeto `seven-desk-deploy`, que atende à infraestrutura de conexão remota. Ao alterar o site na branch de produção, o Vercel pode disparar um novo deploy automaticamente.

A página principal é estática. Para compilar a área experimental de contas, execute `npm ci` e `npm run build` na pasta `website`; a Vercel executa o build no deploy.

## Planos em desenvolvimento

A seção de planos apresenta R$ 39,90 por usuário/mês ou R$ 400 por usuário/ano, com computadores ilimitados. A renovação planejada é feita pelo cliente, sem cobrança automática. Os botões ficam desativados até que cadastro, pagamento e autorização do aplicativo estejam integrados e testados.

`lib/infinitepay.js` prepara links e consulta a confirmação junto à InfinitePay; `lib/billing.js` contém a lógica transacional de crédito por usuário. `db/001_billing.sql` define as tabelas para uma branch com Neon Auth. As rotas `api/checkout.js` e `api/infinitepay-webhook.js` estão desabilitadas por padrão, com chaves de ativação separadas (`SEVEN_BILLING_ENABLED` e `SEVEN_WEBHOOK_ENABLED`). A página de retorno não confirma pagamentos por si só. Ainda é necessário implementar a autorização no servidor de acesso remoto, estornos, reprocessamento e monitoramento de falhas antes de habilitar vendas.

`conta.html` é uma área experimental isolada, sem link no site público. Ela usa o serviço configurado em `NEON_AUTH_BASE_URL`, não libera acesso ao aplicativo e não deve ser apontada para contas reais até que validação de e-mail, recuperação de senha, SMTP de produção, autorização e os demais fluxos sejam preparados e testados. Em prévias, use somente uma branch de testes isolada do banco.

Para habilitar o checkout no futuro, configure `INFINITEPAY_HANDLE` e `INFINITEPAY_API_KEY` somente no servidor. A chave é necessária para limitar cada link a um pagamento; ela não deve ser incluída no frontend. A documentação da InfinitePay informa que o webhook não tem assinatura, então cada aviso precisa ser confirmado pela API. A chave de API e as credenciais do banco não fazem parte do repositório. Não coloque em produção até integrar e testar o login e a autorização no Seven Desk.

## Downloads

Os botões apontam para a página de Releases do repositório oficial, não para um binário fixo. Se o repositório permanecer privado, usuários não autorizados precisarão de acesso para baixar os arquivos. Para distribuição pública, publique os instaladores homologados em um canal público sob controle do projeto; não exponha chaves privadas ou tokens no frontend.

## Compatibilidade e segurança

As ilustrações da home são **conceituais**, não capturas de uma sessão real. Recursos podem variar conforme a versão do cliente e a topologia da rede. A identidade visual e os avisos legais não alteram as obrigações de licença das bibliotecas de terceiros.
