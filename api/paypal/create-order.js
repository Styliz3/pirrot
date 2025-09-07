// api/paypal/create-order.js
const LIVE = true; // set to false if you want SANDBOX quickly
const PAYPAL_API = LIVE ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com';

function catalog() {
  return {
    'tralalita-100kps': { name: 'Tralalita tralala（100K/s）', EUR: 3, USD: 3 },
    'los-hotspotsitos-20mps': { name: 'Los Hotspotsitos（20M/s）', EUR: 6, USD: 6 },
    'los-tralaleritos-500kps': { name: 'Los Tralaleritos（500K/s）', EUR: 3, USD: 3 },
  };
}

function applyCoupon(lines, currency, coupon) {
  const code = (coupon || '').trim().toLowerCase();
  if (code === 'secret000') {
    for (const l of lines) {
      if (l.sku === 'los-tralaleritos-500kps') l.unit = 0;
    }
  }
  return lines;
}

async function getAccessToken() {
  const id = process.env.PAYPAL_CLIENT_ID;
  const secret = process.env.PAYPAL_SECRET;
  const auth = Buffer.from(`${id}:${secret}`).toString('base64');
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
    if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });
    const { currency, items, coupon, meta } = req.body || {};
    if (!currency || !Array.isArray(items) || !items.length) return res.status(400).json({ error: 'bad_request' });

    const cat = catalog();
    let lines = items.map(it => {
      const row = cat[it.sku]; if (!row) throw new Error(`unknown_sku:${it.sku}`);
      const qty = Math.max(1, Number(it.qty || 1));
      const unit = Number(row[currency]);
      return { sku: it.sku, name: row.name, qty, unit };
    });

    lines = applyCoupon(lines, currency, coupon);

    const total = lines.reduce((s, l) => s + l.unit * l.qty, 0);

    // If total is zero (promo), no PayPal order is needed.
    if (total <= 0) {
      return res.status(200).json({ free: true, orderId: `FREE-${Date.now()}` });
    }

    const purchase_units = [{
      amount: {
        currency_code: currency,
        value: total.toFixed(2),
        breakdown: {
          item_total: { currency_code: currency, value: total.toFixed(2) }
        }
      },
      items: lines.map(l => ({
        name: l.name,
        sku: l.sku,
        quantity: String(l.qty),
        unit_amount: { currency_code: currency, value: l.unit.toFixed(2) }
      })),
      custom_id: `username=${meta?.username||''};email=${meta?.email||''}`.slice(0,127)
    }];

    const access = await getAccessToken();
    const r = await fetch(`${PAYPAL_API}/v2/checkout/orders`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${access}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ intent: 'CAPTURE', purchase_units })
    });
    const j = await r.json();
    if (!r.ok) return res.status(500).json({ error: 'create_order_failed', details: j });
    res.status(200).json({ id: j.id });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'server_error' });
  }
}
