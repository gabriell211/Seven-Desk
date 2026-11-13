import { createAuthClient } from '@neon/auth';

const status = document.getElementById('payment-return-status');

async function reconcileRedirect() {
  const params = new URLSearchParams(window.location.search);
  const order_nsu = params.get('order_nsu');
  const transaction_nsu = params.get('transaction_nsu');
  const slug = params.get('slug') || params.get('invoice_slug');
  // Do not keep payment identifiers in the address bar or browser history.
  window.history.replaceState({}, '', '/pagamento-retorno');
  if (!order_nsu || !transaction_nsu || !slug) {
    status.textContent = 'Aguardando confirmação pela InfinitePay. Confira o status em sua conta.';
    return;
  }
  if ([order_nsu, transaction_nsu, slug].some(value => value.length > 255)) {
    status.textContent = 'Dados de retorno inválidos. Confira o pagamento em sua conta.';
    return;
  }

  try {
    const authResponse = await fetch('/api/auth-config', { cache: 'no-store' });
    if (!authResponse.ok) throw new Error('Account unavailable');
    const { authUrl } = await authResponse.json();
    const auth = createAuthClient(authUrl);
    const { data, error } = await auth.getSession();
    const token = data?.session?.token;
    if (error || typeof token !== 'string' || token.split('.').length !== 3) {
      status.textContent = 'Entre na sua conta para consultar este pagamento. A notificação da InfinitePay também será verificada pelo servidor.';
      return;
    }
    const response = await fetch('/api/confirm-payment', {
      method: 'POST', cache: 'no-store',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ order_nsu, transaction_nsu, slug }),
    });
    if (response.ok) {
      const confirmation = await response.json();
      if (confirmation.confirmed === true) {
        status.textContent = 'Pagamento confirmado com segurança. Consulte sua conta para verificar o período de acesso.';
        return;
      }
    }
    status.textContent = response.status === 409
      ? 'Pagamento ainda não confirmado. Aguarde a atualização da InfinitePay e consulte sua conta.'
      : 'Não foi possível verificar o pagamento agora. Consulte sua conta para acompanhar o status.';
  } catch {
    status.textContent = 'Não foi possível consultar o pagamento agora. O servidor poderá confirmar a notificação da InfinitePay.';
  }
}

reconcileRedirect();
