export default function handler(req, res) {
  const code = req.method === "POST" ? req.body?.code : req.query?.code;

  if (!process.env.ACCESS_CODE) {
    return res.status(500).json({ ok: false, message: "ACCESS_CODE not set" });
  }

  if (!code) {
    return res.status(400).json({ ok: false, message: "Missing code" });
  }

  const ok = code === process.env.ACCESS_CODE;
  return res.status(ok ? 200 : 401).json({
    ok,
    message: ok ? "Access granted" : "Invalid code"
  });
}
