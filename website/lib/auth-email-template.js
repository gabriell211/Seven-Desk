'use strict';

const TYPES = Object.freeze({
  'email-verification': {
    subject: 'Confirme seu e-mail | Seven Desk',
    heading: 'Confirme seu endereço de e-mail',
    description: 'Para concluir seu cadastro no Seven Desk, informe este código na página de verificação.',
  },
  'forget-password': {
    subject: 'Recuperação de senha | Seven Desk',
    heading: 'Redefina sua senha com segurança',
    description: 'Recebemos uma solicitação para redefinir sua senha. Informe este código somente no site oficial.',
  },
  'sign-in': {
    subject: 'Seu código de acesso | Seven Desk',
    heading: 'Seu código de acesso',
    description: 'Use este código para confirmar sua identidade e acessar o Seven Desk.',
  },
});

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, c => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[c]));
}

function renderOtpEmail({ type, code, name }) {
  if (!Object.hasOwn(TYPES, type)) throw new Error('Unsupported email type');
  if (typeof code !== 'string' || !/^[0-9]{6}$/.test(code)) throw new Error('Invalid verification code');
  const content = TYPES[type];
  const firstName = typeof name === 'string' && name.trim().length <= 100
    ? name.trim().split(/\s+/)[0] : '';
  const greeting = firstName ? 'Olá, ' + firstName + '!' : 'Olá!';
  const note = 'Se você não solicitou este código, ignore esta mensagem. Nunca compartilhe o código com terceiros.';
  const text = [
    'SEVEN DESK', '', greeting, '', content.heading, '', content.description,
    '', 'Seu código: ' + code, '', 'O código tem validade limitada.', '', note,
    '', 'Site oficial: https://www.sevendesk.tech',
    '', 'Seven Desk — Acesso remoto com segurança.',
  ].join('\n');
  const html = [
    '<!doctype html><html lang="pt-BR"><head><meta charset="UTF-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1.0">',
    '<meta http-equiv="X-UA-Compatible" content="IE=edge"></head>',
    '<body style="margin:0;padding:0;background-color:#f0f2f8;font-family:Arial,Helvetica,sans-serif;">',
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f0f2f8" style="background-color:#f0f2f8;">',
    '<tr><td align="center" style="padding-top:36px;padding-bottom:36px;padding-left:16px;padding-right:16px;">',
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:560px;border-collapse:separate;">',
    '<tr><td bgcolor="#19122f" style="background-color:#19122f;padding-top:28px;padding-bottom:28px;padding-left:32px;padding-right:32px;border-radius:16px 16px 0 0;">',
    '<p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:26px;line-height:32px;font-weight:700;color:#ffffff;letter-spacing:-0.7px;">seven<span style="color:#b5a5ff;">desk</span></p>',
    '<p style="margin-top:7px;margin-bottom:0;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:18px;color:#d9d1f1;">Acesso remoto com segurança</p>',
    '</td></tr>',
    '<tr><td bgcolor="#ffffff" style="background-color:#ffffff;padding-top:36px;padding-bottom:36px;padding-left:32px;padding-right:32px;">',
    '<p style="margin-top:0;margin-bottom:18px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:24px;color:#48546b;">',escapeHtml(greeting),'</p>',
    '<h1 style="margin-top:0;margin-bottom:14px;font-family:Arial,Helvetica,sans-serif;font-size:25px;line-height:33px;color:#19122f;font-weight:700;">',escapeHtml(content.heading),'</h1>',
    '<p style="margin-top:0;margin-bottom:26px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:24px;color:#48546b;">',escapeHtml(content.description),'</p>',
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate;">',
    '<tr><td align="center" bgcolor="#f0ebff" style="background-color:#f0ebff;border:1px solid #d7ccff;border-radius:12px;padding-top:22px;padding-bottom:22px;padding-left:12px;padding-right:12px;">',
    '<p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:36px;line-height:44px;letter-spacing:10px;font-weight:700;color:#5b36c8;">',code,'</p>',
    '</td></tr></table>',
    '<p style="margin-top:17px;margin-bottom:24px;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:21px;color:#657187;">O código tem validade limitada.</p>',
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td bgcolor="#f6f7fa" style="background-color:#f6f7fa;padding-top:16px;padding-bottom:16px;padding-left:18px;padding-right:18px;border-radius:8px;">',
    '<p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:21px;color:#48546b;">',escapeHtml(note),'</p>',
    '</td></tr></table>',
    '</td></tr>',
    '<tr><td bgcolor="#f8f9fc" style="background-color:#f8f9fc;padding-top:24px;padding-bottom:24px;padding-left:32px;padding-right:32px;border-radius:0 0 16px 16px;">',
    '<p style="margin-top:0;margin-bottom:8px;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:21px;color:#48546b;">Mensagem automática de segurança do Seven Desk.</p>',
    '<p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:21px;"><a href="https://www.sevendesk.tech" style="color:#5b36c8;text-decoration:underline;">www.sevendesk.tech</a></p>',
    '</td></tr></table>',
    '</td></tr></table></body></html>',
  ].join('');
  return { subject: content.subject, text, html };
}

module.exports = { renderOtpEmail };
