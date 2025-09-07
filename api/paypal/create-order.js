// api/paypal/create-order.js
const PAYPAL_API = 'https://api-m.paypal.com'; // use api-m.sandbox.paypal.com for sandbox

function catalog() {
  return {
    'tralalita-100kps': { name: 'Tralalita tralala（100K/s）', EUR: 3, USD: 3 },
    // add more SKUs here…
  };
}

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
    if(req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });
    const { currency, items, meta } = req.body || {};
    if(!currency || !Array.isArray(items) || !items.length) return res.status(400).json({ error: 'bad_request' });

    const cat = catalog();
    let total = 0;
    const purchase_units = [{
      amount: { currency_code: currency, value: '0.00', breakdown: { item_total: { currency_code: currency, value: '0.00' } } },
      items: [],
      custom_id: `username=${meta?.username || ''};email=${meta?.email || ''}`.slice(0,127)
    }];

    for(const it of items){
      const row = cat[it.sku];
      if(!row) return res.status(400).json({ error: `unknown_sku:${it.sku}` });
      const unit = Number(row[currency]);
      const qty = Math.max(1, Number(it.qty||1));
      const line = unit * qty;
      total += line;
      purchase_units[0].items.push({
        name: row.name,
        sku: it.sku,
        quantity: String(qty),
        unit_amount: { currency_code: currency, value: unit.toFixed(2) }
      });
    }

    purchase_units[0].amount.value = total.toFixed(2);
    purchase_units[0].amount.breakdown.item_total.value = total.toFixed(2);

    const access = await getAccessToken();
    const r = await fetch(`${PAYPAL_API}/v2/checkout/orders`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${access}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ intent: 'CAPTURE', purchase_units })
    });

    const j = await r.json();
    if(!r.ok) return res.status(500).json({ error: 'create_order_failed', details: j });
    return res.status(200).json({ id: j.id });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'server_error' });
  }
}
