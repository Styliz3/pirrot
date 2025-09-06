// api/api.js
// EasyRun! Professional backend with templates
// In-memory only (reset on restart). Replace with DB for persistence.

let servers = {};
let logs = [];

// Utility: Generate API keys
function createApiKey() {
  return Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
}

// Pre-made templates
const templates = {
  chatbot: {
    name: "Chatbot API",
    routes: {
      "/chat": `
        const { message } = req.query;
        res.status(200).json({ reply: "🤖 Bot says: " + (message || "Hello!") });
      `
    }
  },
  json: {
    name: "JSON Store API",
    routes: {
      "/data": `
        res.status(200).json({ items: [1, 2, 3, 4, 5] });
      `
    }
  },
  webhook: {
    name: "Webhook Receiver",
    routes: {
      "/hook": `
        res.status(200).json({ received: true, body: req.body });
      `
    }
  },
  blank: {
    name: "Blank Server",
    routes: {
      "/hello": `res.status(200).json({ msg: "Hello from EasyRun!" });`
    }
  }
};

export default async function handler(req, res) {
  const { method } = req;
  const { id, route, action } = req.query;

  // ---- CREATE SERVER ----
  if (method === "POST") {
    const body = req.body || {};
    const serverId = Date.now().toString(36);
    const template = templates[body.template] || templates.blank;

    servers[serverId] = {
      id: serverId,
      name: body.name || template.name,
      created: Date.now(),
      running: true,
      apiKey: createApiKey(),
      routes: { ...template.routes },
      settings: { requireKey: true, analytics: true }
    };

    return res.status(200).json({ success: true, server: servers[serverId] });
  }

  // ---- LIST SERVERS ----
  if (method === "GET" && !id) {
    return res.status(200).json(Object.values(servers));
  }

  // ---- GET SPECIFIC SERVER ----
  if (method === "GET" && id && !route) {
    const server = servers[id];
    if (!server) return res.status(404).json({ error: "Server not found" });

    // Get logs
    const serverLogs = logs.filter(l => l.serverId === id);
    return res.status(200).json({ ...server, logs: serverLogs });
  }

  // ---- DELETE SERVER ----
  if (method === "DELETE" && id) {
    if (!servers[id]) return res.status(404).json({ error: "Server not found" });
    delete servers[id];
    logs = logs.filter(l => l.serverId !== id);
    return res.status(200).json({ success: true });
  }

  // ---- RUN ROUTE ----
  if (method === "GET" && id && route) {
    const server = servers[id];
    if (!server) return res.status(404).json({ error: "Server not found" });

    // API key check
    const apiKey = req.headers["x-api-key"];
    if (server.settings.requireKey && apiKey !== server.apiKey) {
      return res.status(403).json({ error: "Invalid API key" });
    }

    const path = "/" + route;
    const code = server.routes[path];
    if (!code) return res.status(404).json({ error: "Route not found" });

    // Log request
    logs.push({
      serverId: id,
      method: req.method,
      path,
      ip: req.headers["x-forwarded-for"] || req.socket.remoteAddress,
      time: Date.now()
    });

    try {
      const fn = new Function("req", "res", code);
      return fn(req, res);
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  // ---- ADD ROUTE ----
  if (method === "PUT" && id && action === "addRoute") {
    const { path, code } = req.body;
    if (!servers[id]) return res.status(404).json({ error: "Server not found" });
    servers[id].routes[path] = code;
    return res.status(200).json({ success: true, routes: servers[id].routes });
  }

  // ---- UPDATE SETTINGS ----
  if (method === "PUT" && id && action === "settings") {
    const { settings } = req.body;
    if (!servers[id]) return res.status(404).json({ error: "Server not found" });
    servers[id].settings = { ...servers[id].settings, ...settings };
    return res.status(200).json({ success: true, settings: servers[id].settings });
  }

  // ---- LIST TEMPLATES ----
  if (method === "GET" && action === "templates") {
    return res.status(200).json(Object.keys(templates));
  }

  return res.status(405).json({ error: "Method not allowed" });
}
