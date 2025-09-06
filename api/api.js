// Simple Vercel serverless endpoint for sanity/health checks.
// Deploy this along with index.html. Hitting /api/api returns JSON.

export default function handler(req, res) {
  res.status(200).json({ ok: true, name: 'Auto Subtitles', time: new Date().toISOString() });
}
