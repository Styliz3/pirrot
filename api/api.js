// api/api.js
// EasyRun prototype API

let servers = {}; // store servers in memory

export default async function handler(req, res) {
  const { method } = req;
  const { id, action, route } = req.query;

  if (method === "POST") {
    // Create a new server
    const body = req.body || {};
    const serverId = Date.now().toString();

    servers[serverId] = {
      id: serverId,
      name: body.name || "My Server",
      created: Date.now(),
      running: true,
      routes: {
        "/hello": (req, res) => res.json({ msg: "Hello from EasyRun server!" }),
      },
    };

    return res.status(200).json({ success: true, server: servers[serverId] });
  }

  if (method === "GET") {
    if (!id) {
      // List all servers
      return res.status(200).json(Object.values(servers));
    }

    const server = servers[id];
    if (!server) return res.status(404).json({ error: "Server not found" });

    // Check if requesting a specific route
    if (route && server.routes[`/${route}`]) {
      return server.routes[`/${route}`](req, res);
    }

    return res.status(200).json(server);
  }

  if (method === "DELETE") {
    if (!id || !servers[id]) {
      return res.status(404).json({ error: "Server not found" });
    }
    delete servers[id];
    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
