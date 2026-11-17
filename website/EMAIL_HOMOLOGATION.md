# E-mails de autenticação Seven Desk — SMTP Hostinger

O envio personalizado utiliza o SMTP corporativo existente (Hostinger, porta 465/TLS), sem serviços alternativos.

## Por que existe um webhook?

O Neon Managed Auth oferece personalização de e-mail via webhook send.otp, e não por editor de templates. **Ao ativar send.otp, o Neon não envia mais o e-mail original e passa a depender integralmente do webhook**. Portanto, habilite somente depois de homologar o novo serviço.

## Configuração segura do preview

Adicione no ambiente **Preview** da Vercel, restrito à branch de homologação, sem versionar segredos:

- **NEON_AUTH_BASE_URL**: URL do Neon Auth da mesma branch de testes (já existente).
- **SEVEN_AUTH_MAIL_WEBHOOK_ENABLED=0**: manter desativado até os testes de SMTP concluírem.
- **SEVEN_SMTP_HOST=smtp.hostinger.com**
- **SEVEN_SMTP_USER=sevendesk@sevendesk.tech**
- **SEVEN_SMTP_FROM=Seven Desk <sevendesk@sevendesk.tech>**
- **SEVEN_SMTP_PASSWORD**: segredo da caixa Hostinger, adicionado no painel da Vercel.

Não confundir as credenciais já cadastradas no Neon com variáveis da Vercel: o Neon guarda a senha do próprio SMTP, mas não a disponibiliza para outro aplicativo. O webhook exige autorização SMTP **separada**, sempre como segredo protegido.

## Ordem para homologar e ativar

1. Execute npm ci, npm test, npm run build na pasta website.
2. Valide o preview e o SMTP com envio real para um e-mail autorizado. O teste de e-mail do Neon valida somente o SMTP configurado **no Neon**, não o SMTP do webhook Vercel.
3. Habilite **SEVEN_AUTH_MAIL_WEBHOOK_ENABLED=1** apenas no Preview e faça novo deploy.
4. Configure o webhook send.otp do Neon **da branch isolada** para o caminho /api/auth-email-webhook do preview. Nunca configure o webhook no Neon de produção antecipadamente.
5. Realize registro de teste, recebimento do OTP, confirmação de e-mail, login, redefinição de senha, código inválido, expiração e reenvio. Confirme a mensagem em clientes móveis e desktop.
6. Se falhar, desative imediatamente o webhook send.otp no Neon da branch de testes. Com o webhook desabilitado, o Neon volta ao envio padrão.
7. Produção continua com cadastro e serviços de conta bloqueados, até autorização explícita e homologação de licenças e dispositivos.

## Proteções técnicas

A rota /api/auth-email-webhook exige assinatura Ed25519 válida do Neon, considera somente eventos recentes (máximo de 5 minutos), processa até 16 KiB, permite apenas três tipos de OTP de seis dígitos e usa exclusivamente o remetente corporativo. Nunca registra códigos, mensagens completas nem credenciais nos logs.

Os testes unitários simulam envio SMTP. Eles **não** comprovam a entrega real, autenticação SMTP Vercel/Hostinger, SPF/DKIM, verificação pelo usuário ou licenças do aplicativo.

Referência: https://neon.com/docs/auth/guides/customize-emails
