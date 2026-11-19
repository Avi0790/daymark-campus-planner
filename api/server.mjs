import { createServer } from "node:http";
import { DatabaseSync } from "node:sqlite";

const rooms = ["Studio A", "Studio B", "Quiet Room"];
// Slots are one hour long. Send UTC instants so phones can render local times.
function schedule(now) {
  const slots = [];
  const start = new Date(now);
  start.setUTCMinutes(0, 0, 0);
  for (let hour = 1; hour <= 72; hour++) {
    const at = new Date(start.getTime() + hour * 3600000);
    if (at.getUTCHours() >= 14 && at.getUTCHours() < 23)
      slots.push(at.toISOString());
  }
  return slots;
}
class ClientError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
async function body(req) {
  const parts = [];
  let bytes = 0;
  for await (const part of req) {
    bytes += part.length;
    if (bytes > 4096) throw new ClientError(413, "Request too large.");
    parts.push(part);
  }
  try {
    const value = JSON.parse(Buffer.concat(parts).toString());
    if (value && typeof value === "object" && !Array.isArray(value))
      return value;
  } catch {}
  throw new ClientError(400, "Expected a JSON object.");
}
export function makeApi(filename, clock = Date.now) {
  const db = new DatabaseSync(filename);
  db.exec(`CREATE TABLE IF NOT EXISTS tasks (id INTEGER PRIMARY KEY, title TEXT NOT NULL, done INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE IF NOT EXISTS bookings (id INTEGER PRIMARY KEY, room TEXT NOT NULL, at TEXT NOT NULL, UNIQUE(room, at));`);
  const server = createServer(async (req, res) => {
    const origin = req.headers.origin;
    if (origin && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Vary", "Origin");
      res.setHeader(
        "Access-Control-Allow-Methods",
        "GET, POST, PATCH, DELETE, OPTIONS",
      );
      res.setHeader("Access-Control-Allow-Headers", "Content-Type");
      if (req.method === "OPTIONS") {
        res.writeHead(204);
        return res.end();
      }
    } else if (origin) {
      res.writeHead(403);
      return res.end();
    }
    const route = req.url;
    const method = req.method;
    function send(status, data) {
      res.writeHead(status, {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      });
      res.end(JSON.stringify(data));
    }
    try {
      if (method === "GET" && route === "/api/agenda") {
        const now = clock();
        return send(200, {
          rooms,
          slots: schedule(now),
          tasks: db
            .prepare("SELECT * FROM tasks ORDER BY done, id DESC")
            .all()
            .map((t) => ({ ...t, done: Boolean(t.done) })),
          bookings: db
            .prepare("SELECT * FROM bookings WHERE at > ? ORDER BY at, room")
            .all(new Date(now).toISOString()),
        });
      }
      if (method === "POST" && route === "/api/tasks") {
        const { title } = await body(req);
        if (
          typeof title !== "string" ||
          !title.trim() ||
          title.trim().length > 120
        )
          throw new ClientError(
            400,
            "Enter a task between 1 and 120 characters.",
          );
        const result = db
          .prepare("INSERT INTO tasks(title) VALUES (?)")
          .run(title.trim());
        return send(201, { id: Number(result.lastInsertRowid) });
      }
      if (method === "POST" && route === "/api/bookings") {
        const { room, at } = await body(req);
        if (!rooms.includes(room) || !schedule(clock()).includes(at))
          throw new ClientError(400, "Select an available future time.");
        const result = db
          .prepare(
            "INSERT INTO bookings(room, at) VALUES (?, ?) ON CONFLICT(room, at) DO NOTHING",
          )
          .run(room, at);
        if (!result.changes)
          throw new ClientError(
            409,
            "That time was just booked. Choose another.",
          );
        return send(201, { id: Number(result.lastInsertRowid) });
      }
      const match = /^\/api\/(tasks|bookings)\/(\d+)$/.exec(route);
      if (match) {
        const [, kind, id] = match;
        let result;
        if (method === "PATCH" && kind === "tasks") {
          const { done } = await body(req);
          if (typeof done !== "boolean")
            throw new ClientError(400, "Expected a completion status.");
          result = db
            .prepare("UPDATE tasks SET done=? WHERE id=?")
            .run(Number(done), id);
        } else if (method === "DELETE") {
          result = db
            .prepare(
              kind === "tasks"
                ? "DELETE FROM tasks WHERE id=?"
                : "DELETE FROM bookings WHERE id=?",
            )
            .run(id);
        }
        if (result?.changes) return send(200, { ok: true });
      }
      throw new ClientError(404, "Item or endpoint not found.");
    } catch (e) {
      if (!(e instanceof ClientError)) console.error(e);
      send(
        e.status ?? 500,
        e instanceof ClientError
          ? { error: e.message }
          : { error: "Server error." },
      );
    }
  });
  server.on("close", () => db.close());
  return server;
}
