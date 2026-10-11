import { createServer } from "node:http";

/*
 * Soxta Telegram Bot API (faqat e2e). Panel yuborgan xabarlarni xotirada saqlaydi;
 * testlar 2FA kodini GET /messages?chat_id=... orqali o'qiydi.
 */

const port = Number(process.env.TELEGRAM_PORT ?? 3199);
/** @type {{ id: number; chat_id: string; text: string }[]} */
const messages = [];

const json = (res, status, body) => {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
};

createServer((req, res) => {
  const url = new URL(req.url ?? "/", `http://localhost:${port}`);

  if (req.method === "GET" && url.pathname === "/messages") {
    const chat = url.searchParams.get("chat_id");
    return json(res, 200, chat ? messages.filter((m) => m.chat_id === chat) : messages);
  }
  if (req.method === "GET" && url.pathname === "/health") return json(res, 200, { ok: true });

  const method = /^\/bot[^/]+\/(\w+)$/.exec(url.pathname)?.[1];
  if (req.method !== "POST" || !method) return json(res, 404, { ok: false, description: "Not Found" });

  let raw = "";
  req.on("data", (chunk) => (raw += chunk));
  req.on("end", () => {
    const body = raw ? JSON.parse(raw) : {};
    if (method === "sendMessage") {
      const id = messages.length + 1;
      messages.push({ id, chat_id: String(body.chat_id), text: String(body.text) });
      return json(res, 200, { ok: true, result: { message_id: id } });
    }
    if (method === "getMe") {
      return json(res, 200, { ok: true, result: { id: 1, first_name: "E2E", username: "ventura_e2e_bot" } });
    }
    if (method === "getWebhookInfo") return json(res, 200, { ok: true, result: { url: "", pending_update_count: 0 } });
    if (method === "getUpdates") return json(res, 200, { ok: true, result: [] });
    return json(res, 404, { ok: false, description: "Not Found" });
  });
}).listen(port, () => console.log(`Soxta Telegram: http://localhost:${port}`));
