'use strict';
const { isCheckoutReady } = require('../lib/billing-readiness');

module.exports = (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') return res.status(405).json({ error: 'Método não permitido' });
  return res.status(200).json({ checkoutAvailable: isCheckoutReady() });
};
