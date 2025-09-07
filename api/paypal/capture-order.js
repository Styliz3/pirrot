// api/paypal/capture-order.js
const PAYPAL_API = 'https://api-m.paypal.com';

async function getAccessToken() {
  const auth = Buffer.from(`${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_SECRET}`).toString('base64');
  const r = await fetch(`${PAYPAL_API}/v1/oauth2/token`, {
    method: 'POST',
    headers: { 'Authorization': `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=client_credentials'
  });
  if(!r.ok) throw new Error('paypal_auth_failed');
  const j = await r.json();
  return j.access_token;
}

export default async function handler(req, res) {
  try {
    if(req.method !== 'POST') return res.status(405).json({ error:'method_not_allowed' });
    const { orderId } = req.body || {};
    if(!orderId) return res.status(400).json({ error:'missing_order_id' });

    const access = await getAccessToken();
    const r = await fetch(`${PAYPAL_API}/v2/checkout/orders/${orderId}/capture`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${access}`, 'Content-Type': 'application/json' },
      body: '{}'
    });
    const j = await r.json();
    if(!r.ok) return res.status(500).json({ error:'capture_failed', details:j });
    res.status(200).json({ ok:true, details:j });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error:'server_error' });
  }
}
