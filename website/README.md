# Seven Desk — site oficial

Website e área de conta do **Seven Desk**, com identidade escura/roxa e páginas em português do Brasil.

- **Produção:** https://www.sevendesk.tech/
- **Repositório:** https://github.com/gabriell211/Seven-Desk
- **Documentação principal:** [README do Seven Desk](../README.md)
- **Instaladores:** [downloads do Seven Desk](https://downloads.sevendesk.tech/)

## Executar testes e compilar

Requer Node.js 22 ou superior e npm, com as versões de dependências registradas em `package-lock.json`.

```bash
cd website
npm ci
npm test
npm run build
```

O build usa esbuild e publica os arquivos estáticos permitidos em `website/public/`. As APIs sob `api/`, o código servidor sob `lib/`, arquivos de banco e valores secretos **não podem ser copiados** para o diretório público.

## Estrutura

| Arquivo ou diretório | Função |
| --- | --- |
| `index.html`, `styles.css`, `script.js` | Página inicial e layout responsivo |
| `assets/seven-desk-logo.svg`, `favicon.svg` | Identidade visual roxa oficial |
| `conta.html`, `conta.js`, `conta.css` | Login, cadastro, verificação e recuperação de senha |
| `api/` | Rotas de backend (disponibilidade de conta e autenticação) |
| `lib/` | Módulos privados de backend quando presentes |
| `tests/` | Testes Node de rotas, segurança, conteúdo e ícones |
| `server.js` | Servidor HTTP local da VPS; Caddy fornece HTTPS |
| `licencas.html`, `privacidade.html` | Termos, atribuições e privacidade |

## Rotas

- `/`: apresentação, planos e downloads.
- `/entrar`: autenticação.
- `/cadastro`: criação de conta, quando liberada.
- `/recuperar-senha` e `/redefinir-senha`: recuperação por código OTP, quando habilitada.
- `/favicon.svg`: favicon original; `/favicon.ico` redireciona para o SVG, evitando requisições 404 de navegadores.

## Publicação e DNS

O site será publicado na VPS Hostinger, no subdomínio `www.sevendesk.tech`. `scripts/deploy_vps_site.sh` prepara uma versão isolada, roda testes e compila os arquivos antes de iniciar o serviço local. O Caddy encaminha apenas esse subdomínio ao serviço; `downloads.sevendesk.tech` conserva sua configuração atual.

O domínio raiz `sevendesk.tech` atende à infraestrutura de conexões remotas e não deve ser repontado. O código do cliente utiliza seu próprio endpoint de servidor.

O arquivo `/etc/sevendesk/site.env` guarda apenas as configurações do serviço e deve ser protegido como segredo. A implantação inicial mantém cadastro, cobrança e licenciamento desativados até a homologação completa. Só mude o DNS de `www` após verificar o serviço local e preparar as credenciais de produção.

## Autenticação, dados e pagamentos

O site contém fluxos de autenticação conectados ao Neon Auth e pode utilizar PostgreSQL em APIs de assinaturas. A presença de páginas e variáveis configuradas **não significa** que o cadastro ou a cobrança estejam liberados.

As flags `SEVEN_ACCOUNT_STATUS_ENABLED`, `SEVEN_REGISTRATION_ENABLED`, `SEVEN_PASSWORD_RECOVERY_ENABLED` e as flags de cobrança devem permanecer desativadas até que autenticação, entrega de OTP, licenciamento no servidor, conciliação de pagamentos e estornos estejam homologados. Nunca armazene chaves de pagamento, senha SMTP ou string de conexão diretamente no JavaScript público.

O fluxo de cobrança em `lib/infinitepay.js` cria um link individual para cada pedido (R$ 19,90 mensal ou R$ 199,90 anual (Professional)). `api/infinitepay-webhook.js` e `api/confirm-payment.js` só registram acesso após consultar a InfinitePay; `db/001_billing.sql` define as tabelas de pedidos e assinaturas. A migração já está aplicada no projeto Neon Seven Desk. As rotas permanecem fechadas por `SEVEN_BILLING_ENABLED=0`, `SEVEN_WEBHOOK_ENABLED=0`, `SEVEN_LICENSE_API_ENABLED=0` e `SEVEN_SALES_LAUNCH_APPROVED=0` na produção. O aplicativo e o servidor de conexões ainda não consultam a assinatura do usuário, e estornos exigem conciliação operacional; portanto a cobrança não deve ser ativada antes da homologação real desses fluxos.

`db/002_app_tokens.sql` e `db/003_technician_slots.sql` definem cinco vagas para computadores de técnicos por conta verificada. Cada vaga possui um código que fica vinculado ao ID do primeiro aplicativo que iniciar suporte. O banco guarda apenas o hash do código e do ID. O aplicativo o envia ao servidor de sinalização, que consulta `/api/license` e o prazo do plano. Os computadores de clientes continuam sem cadastro. O servidor com essa verificação ainda precisa ser implantado e testado com dois clientes antes de habilitar as flags de produção.

## Identidade e licenças

O visual do website acompanha o aplicativo Seven Desk. Componentes de terceiros continuam sujeitos aos avisos e licenças do repositório, inclusive à [GNU AGPL-3.0](../LICENCE) onde aplicável.

## Diagnóstico rápido

- **`/favicon.ico` retorna 404:** confirme se o serviço `sevendesk-site` está rodando na VPS e se o Caddy encaminha `www` a ele.
- **Aviso `XSLTProcessor` de `xslt-extension.js`:** quando o arquivo é carregado por uma extensão do navegador, a mensagem não é emitida pelo site Seven Desk. Atualize ou desative a extensão responsável para testar.

### Catálogo comercial aprovado

Professional: R$ 19,90/mês ou R$ 199,90/ano. A migração `010_professional_pricing.sql` deve ser aplicada antes da disponibilização do novo checkout; pedidos anteriores mantêm os valores originais. Personal gratuito, Business (até 3 técnicos, R$ 49,90/mês) e Enterprise (até 10 técnicos, R$ 149,90/mês) são planos anunciados como em preparação: permanecem indisponíveis comercialmente até a homologação dos direitos de uso pessoal e das equipes. As flags existentes permanecem inalteradas.

### Equipes (camada privada, não comercial)

A migração 011 cria espaços de equipe isolados por proprietário, sem reutilizar as cinco ativações individuais. Business permite três assentos e Enterprise dez; o administrador não consome assento até ser convidado como técnico. O módulo privado `lib/team-workspaces.js` reserva vagas com convite de uso único, exige identidade verificada e e-mail correspondente na aceitação, e revoga o vínculo por proprietário. O portal e a rota autenticada /api/team-workspaces permitem consultar, convidar, aceitar e revogar técnicos somente quando SEVEN_TEAM_WORKSPACES_ENABLED=1 e SEVEN_ACCOUNT_STATUS_ENABLED=1. Por padrão permanecem indisponíveis. Não existe rota para provisionar equipe, conceder acesso remoto ou cobrar por ela nesta etapa. A criação de equipes depende de futura conciliação de pedidos Business/Enterprise; nenhum pagamento ou direito de produção é simulado.

### Cobrança de equipes

A migração 012 permite os valores Business (4990 centavos) e Enterprise (14990 centavos), preserva pedidos históricos e relaciona cada pagamento de equipe ao workspace provisionado. Um proprietário possui no máximo uma equipe por plano; compras repetidas do mesmo plano acrescentam um mês à validade existente (ou a partir da confirmação se expirada). Planos distintos são independentes, sem migração automática, e não herdam o mês de teste individual. O pagamento confirmado e o crédito de validade ocorrem na mesma transação. O checkout de equipe exige todas as flags individuais mais SEVEN_TEAM_WORKSPACES_ENABLED, SEVEN_TEAM_REMOTE_ACCESS_HOMOLOGATED e SEVEN_TEAM_SALES_APPROVED. Nenhuma foi habilitada neste PR. Falta integrar e homologar credenciais de equipe no servidor remoto, confirmar estornos e testar a infraestrutura real antes de qualquer venda.

### Ativação empresarial

As migrações 013 e 014 vinculam uma chave única de ativação e um dispositivo por vaga aceita. A chave identifica o técnico automaticamente e segue o formato dos instaladores existentes. Apenas o técnico autenticado da vaga pode emiti-los; o administrador não recebe seus códigos. A rotação invalida o dispositivo anterior, a revogação da vaga apaga suas credenciais por FK e a verificação de licença exige equipe vigente, identidade verificada e dispositivo vinculado. O servidor usa o endpoint /api/license existente; o código da integração ainda exige homologação real em dois clientes. SEVEN_TEAM_LICENSE_ENABLED deve ser habilitada somente em ambiente de teste até a validação operacional e é requisito adicional para liberar vendas. Nenhuma flag de produção foi alterada.

### Chave única

A emissão individual exige um perfil de técnico na vaga. Novas chaves são emitidas já vinculadas a esse perfil; não existe segundo código a copiar. Chaves antigas já vinculadas continuam válidas conforme a geração configurada; pares antigos ainda não vinculados podem ser concluídos pelo cliente legado ou substituídos por uma nova chave. A rota legada de emissão de código secundário responde 410. O aplicativo atualizado utiliza apenas a chave; o servidor continua vinculando o primeiro dispositivo e rejeitando outros. A publicação requer migração 014, deploy do backend antes dos instaladores e homologação real.
