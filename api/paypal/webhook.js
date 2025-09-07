// api/paypal/webhook.js
const PAYPAL_API = 'https://api-m.paypal.com';
const WEBHOOK_ID = process.env.PAYPAL_WEBHOOK_ID; // from PayPal when you create the webhook

// Verify the webhook signature with PayPal
async function verifySignature(req, body) {
  const v = await fetch(`${PAYPAL_API}/v1/notifications/verify-webhook-signature`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Basic ' + Buffer.from(`${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_SECRET}`).toString('base64')
    },
    body: JSON.stringify({
      auth_algo: req.headers['paypal-auth-algo'],
      cert_url: req.headers['paypal-cert-url'],
      transmission_id: req.headers['paypal-transmission-id'],
      transmission_sig: req.headers['paypal-transmission-sig'],
      transmission_time: req.headers['paypal-transmission-time'],
      webhook_id: WEBHOOK_ID,
      webhook_event: body
    })
  });
  const j = await v.json();
  return j.verification_status === 'SUCCESS';
}

function catalog() {
  return {
    'tralalita-100kps': { EUR: 3, USD: 3 },
    // add more SKUs here…
  };
}

async function refundCapture(captureId, amount, currency, access) {
  const r = await fetch(`${PAYPAL_API}/v2/payments/captures/${captureId}/refund`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${access}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ amount: { value: amount, currency_code: currency } })
  });
  return r.ok;
}

async function getAccessToken() {
  const auth = Buffer.from(`${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_SECRET}`).toString('base64');
  const r = await fetch(`${PAYPAL_API}/v1/oauth2/token`, {
    method: 'POST',
    headers: { 'Authorization': `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=client_credentials'
  });
  const j = await r.json();
  return j.access_token;
}

export const config = { api: { bodyParser: { sizeLimit: '1mb' } } };

export default async function handler(req, res) {
  try {
    if(req.method !== 'POST') return res.status(405).end();

    const body = req.body;
    const ok = await verifySignature(req, body);
    if(!ok) return res.status(400).end('bad_signature');

    if(body.event_type === 'PAYMENT.CAPTURE.COMPLETED') {
      const cap = body.resource;
      const captureId = cap.id;
      const currency = cap.amount.currency_code;
      const value = parseFloat(cap.amount.value);

      // reconstruct the expected total from order items
      // NOTE: In production you’d look up your own order record by cap.supplementary_data.related_ids.order_id
      // For demo: we trust the amount because we created the order server-side.
      // The logic below shows how you *could* refund if mismatch detected.

      const expected = value; // normally re-calc from your DB
      const mismatch = Math.abs(value - expected) > 0.001;

      if(mismatch){
        const access = await getAccessToken();
        await refundCapture(captureId, value.toFixed(2), currency, access);
      }
    }

    res.status(200).end('ok');
  } catch (e) {
    console.error(e);
    res.status(500).end('server_error');
  }
}
