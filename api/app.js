// api/app.js
let urlDatabase = {}; // In-memory (reset on redeploy). Replace with real DB for persistence.

export default function handler(req, res) {
  if (req.method === "POST") {
    const { longUrl, customAlias } = req.body;

    if (!longUrl) {
      return res.status(400).json({ error: "Missing URL" });
    }

    const alias = customAlias || Math.random().toString(36).substring(2, 7);
    const shortUrl = `${req.headers.host}/${alias}`;

    urlDatabase[alias] = longUrl;
    return res.status(200).json({ shortUrl });
  }

  if (req.method === "GET") {
    const { alias } = req.query;
    const longUrl = urlDatabase[alias];

    if (longUrl) {
      return res.redirect(longUrl);
    } else {
      return res.status(404).json({ error: "Not found" });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
}
