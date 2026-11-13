'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');

const root = join(__dirname, '..');
const source = readFileSync(join(root, 'conta.js'), 'utf8');
const html = readFileSync(join(root, 'conta.html'), 'utf8');

test('password recovery uses Neon Auth OTP methods, not unsupported email-link methods', () => {
  assert.match(source, /auth\.forgetPassword\.emailOtp\(\{email\}\)/);
  assert.match(source, /auth\.emailOtp\.resetPassword\(\{email,otp,password\}\)/);
  assert.doesNotMatch(source, /auth\.requestPasswordReset\(/);
  assert.doesNotMatch(source, /auth\.resetPassword\(\{/);
  assert.doesNotMatch(source, /window\.location\.search|resetToken/);
});

test('recovery page requires email, six-digit OTP and confirmed password', () => {
  for (const id of ['recovery-email', 'reset-email', 'reset-code', 'reset-password', 'reset-confirm']) {
    assert.match(html, new RegExp('id="' + id + '"'));
  }
  assert.match(html, /id="reset-code"[^>]*pattern="\[0-9\]\{6\}"/);
  assert.match(source, /password !== confirm/);
  assert.match(source, /\^\[0-9\]\{6\}\$/);
});

test('unverified account sessions cannot unlock subscription or payment actions', () => {
  assert.match(source, /session\?\.user\?\.emailVerified === true/);
  assert.match(source, /data\?\.user\?\.emailVerified === true/);
  assert.match(html, /name="otp"/);
});

test('email verification resend uses Neon OTP API and handles an unverified login', () => {
  assert.match(source, /auth\\.emailOtp\\.sendVerificationOtp\\(\\{email:verificationEmail, type:'email-verification'\\}\\)/);
  assert.doesNotMatch(source, /auth\\.sendVerificationEmail\\(/);
  assert.match(source, /code === 'EMAIL_NOT_VERIFIED'/);
  assert.match(source, /setVerificationMode\\(email\\)/);
});
