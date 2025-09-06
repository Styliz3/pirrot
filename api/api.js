// api/server/[id].js
import { serversDB, logsDB } from "../../lib/db";

export default async function handler(req, res) {
  const { id } = req.query;
  const server = await serversDB.get(id);
  if (!server) return res.status(404).json({ error: "Server not found" });

  // Auth check
  const apiKey = req.headers["x-api-key"];
  if (server.requireKey && apiKey !== server.apiKey) {
    return res.status(403).json({ error: "Invalid API key" });
  }

  // Log request
  await logsDB.insert({
    serverId: id,
    method: req.method,
    path: req.url,
    ip: req.headers["x-forwarded-for"] || req.socket.remoteAddress,
    time: Date.now()
  });

  // Match route
  const route = server.routes[req.url.split("?")[0]];
  if (!route) return res.status(404).json({ error: "Route not found" });

  try {
    const fn = new Function("req", "res", route.code);
    await fn(req, res);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
