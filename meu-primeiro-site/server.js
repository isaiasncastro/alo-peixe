const crypto = require("node:crypto");
const fs = require("node:fs/promises");
const http = require("node:http");
const path = require("node:path");

const PORT = Number(process.env.PORT || 5600);
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "alopeixe2026";
const ROOT = __dirname;
const DATA_FILE = path.join(ROOT, "data", "exclusivas.json");
const RSS_URL = "https://g1.globo.com/dynamo/to/tocantins/rss2.xml";
const JSON_FEED_URL = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(RSS_URL)}`;
const FALLBACK_IMAGE = "assets/alo-peixe-logo.jpeg";

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
};

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  response.end(JSON.stringify(payload));
}

function decodeEntity(value = "") {
  return value
    .replace(/<!\[CDATA\[|\]\]>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function stripHtml(value = "") {
  return decodeEntity(value)
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function limitText(value = "", size = 220) {
  const text = stripHtml(value);
  return text.length > size ? `${text.slice(0, size - 3).trim()}...` : text;
}

function getTag(block, tagName) {
  const match = block.match(new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, "i"));
  return match ? decodeEntity(match[1]).trim() : "";
}

function getMedia(block) {
  const mediaMatch = block.match(/<media:content[^>]+url=["']([^"']+)["'][^>]*medium=["']image["'][^>]*>/i);
  const imageMatch = block.match(/<img[^>]+src=["']([^"']+)["']/i);
  const image = decodeEntity(mediaMatch?.[1] || imageMatch?.[1] || FALLBACK_IMAGE);
  const title = stripHtml(getTag(block, "title"));
  const link = stripHtml(getTag(block, "link"));
  const isVideo = /video|vídeo|videos|vídeos/i.test(`${title} ${link}`);

  return {
    image,
    mediaType: isVideo ? "vídeo" : image === FALLBACK_IMAGE ? "sem foto" : "imagem",
  };
}

function parseRss(xml) {
  const blocks = xml.match(/<item>[\s\S]*?<\/item>/gi) || [];

  return blocks.map((block) => {
    const subtitle = getTag(block, "atom:subtitle");
    const description = subtitle || getTag(block, "description");

    return {
      id: crypto.createHash("sha1").update(getTag(block, "guid") || getTag(block, "link")).digest("hex"),
      source: "G1 Tocantins",
      type: "g1",
      title: stripHtml(getTag(block, "title")),
      description: limitText(description),
      link: stripHtml(getTag(block, "link")) || "https://g1.globo.com/to/tocantins/",
      pubDate: getTag(block, "pubDate") || new Date().toISOString(),
      ...getMedia(block),
    };
  });
}

function parseJsonFeed(data) {
  if (!Array.isArray(data.items)) {
    return [];
  }

  return data.items.map((item) => {
    const imageMatch = String(`${item.description || ""} ${item.content || ""}`).match(/<img[^>]+src=["']([^"']+)["']/i);
    const image = item.thumbnail || imageMatch?.[1] || FALLBACK_IMAGE;
    const isVideo = /video|vídeo|videos|vídeos/i.test(`${item.title || ""} ${item.link || ""}`);

    return {
      id: crypto.createHash("sha1").update(item.guid || item.link || item.title).digest("hex"),
      source: "G1 Tocantins",
      type: "g1",
      title: stripHtml(item.title || ""),
      description: limitText(item.description || item.content || ""),
      link: item.link || "https://g1.globo.com/to/tocantins/",
      pubDate: item.pubDate || new Date().toISOString(),
      image,
      mediaType: isVideo ? "vídeo" : image === FALLBACK_IMAGE ? "sem foto" : "imagem",
    };
  });
}

async function readExclusives() {
  try {
    const content = await fs.readFile(DATA_FILE, "utf8");
    return JSON.parse(content);
  } catch {
    return [];
  }
}

async function writeExclusives(items) {
  await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });
  await fs.writeFile(DATA_FILE, `${JSON.stringify(items, null, 2)}\n`, "utf8");
}

async function readBody(request) {
  const chunks = [];
  let size = 0;

  for await (const chunk of request) {
    size += chunk.length;
    if (size > 1_000_000) {
      throw new Error("Payload muito grande.");
    }
    chunks.push(chunk);
  }

  return chunks.length ? JSON.parse(Buffer.concat(chunks).toString("utf8")) : {};
}

function isAuthorized(request) {
  return request.headers["x-admin-password"] === ADMIN_PASSWORD;
}

function normalizeExclusive(payload, existing = {}) {
  const now = new Date().toISOString();
  const title = String(payload.title || "").trim();

  if (!title) {
    throw new Error("O título é obrigatório.");
  }

  return {
    id: existing.id || crypto.randomUUID(),
    source: "Alô Peixe",
    type: "exclusive",
    title,
    description: String(payload.description || "").trim(),
    content: String(payload.content || "").trim(),
    image: String(payload.image || FALLBACK_IMAGE).trim(),
    mediaType: payload.mediaType === "vídeo" ? "vídeo" : "imagem",
    link: String(payload.link || "#").trim(),
    pubDate: existing.pubDate || now,
    updatedAt: now,
    published: payload.published !== false,
  };
}

async function getAutomaticNews() {
  try {
    const response = await fetch(RSS_URL, {
      headers: {
        "User-Agent": "AloPeixePortal/1.0",
      },
    });

    if (!response.ok) {
      throw new Error(`RSS respondeu ${response.status}`);
    }

    return parseRss(await response.text());
  } catch (rssError) {
    const response = await fetch(JSON_FEED_URL);

    if (!response.ok) {
      throw new Error(`RSS falhou: ${rssError.message}; JSON respondeu ${response.status}`);
    }

    return parseJsonFeed(await response.json());
  }
}

async function handleApi(request, response, url) {
  if (url.pathname === "/api/news" && request.method === "GET") {
    const exclusives = (await readExclusives()).filter((item) => item.published);
    let automatic = [];
    let feedStatus = "online";

    try {
      automatic = await getAutomaticNews();
    } catch (error) {
      feedStatus = `erro: ${error.message}`;
    }

    const items = [...exclusives, ...automatic].sort(
      (a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime()
    );

    sendJson(response, 200, {
      items,
      feedStatus,
      updatedAt: new Date().toISOString(),
    });
    return true;
  }

  if (url.pathname === "/api/exclusivas" && request.method === "GET") {
    if (!isAuthorized(request)) {
      sendJson(response, 401, { error: "Senha administrativa inválida." });
      return true;
    }

    sendJson(response, 200, { items: await readExclusives() });
    return true;
  }

  if (url.pathname === "/api/exclusivas" && request.method === "POST") {
    if (!isAuthorized(request)) {
      sendJson(response, 401, { error: "Senha administrativa inválida." });
      return true;
    }

    try {
      const items = await readExclusives();
      const item = normalizeExclusive(await readBody(request));
      items.unshift(item);
      await writeExclusives(items);
      sendJson(response, 201, { item });
    } catch (error) {
      sendJson(response, 400, { error: error.message });
    }
    return true;
  }

  const exclusiveMatch = url.pathname.match(/^\/api\/exclusivas\/([^/]+)$/);
  if (exclusiveMatch && ["PUT", "DELETE"].includes(request.method)) {
    if (!isAuthorized(request)) {
      sendJson(response, 401, { error: "Senha administrativa inválida." });
      return true;
    }

    const id = exclusiveMatch[1];
    const items = await readExclusives();
    const index = items.findIndex((item) => item.id === id);

    if (index === -1) {
      sendJson(response, 404, { error: "Matéria não encontrada." });
      return true;
    }

    if (request.method === "DELETE") {
      const [removed] = items.splice(index, 1);
      await writeExclusives(items);
      sendJson(response, 200, { item: removed });
      return true;
    }

    try {
      items[index] = normalizeExclusive(await readBody(request), items[index]);
      await writeExclusives(items);
      sendJson(response, 200, { item: items[index] });
    } catch (error) {
      sendJson(response, 400, { error: error.message });
    }
    return true;
  }

  return false;
}

async function serveStatic(response, url) {
  const requested = url.pathname === "/" ? "/index.html" : decodeURIComponent(url.pathname);
  const filePath = path.normalize(path.join(ROOT, requested));

  if (!filePath.startsWith(ROOT)) {
    response.writeHead(403);
    response.end("Acesso negado.");
    return;
  }

  try {
    const file = await fs.readFile(filePath);
    response.writeHead(200, {
      "Content-Type": MIME_TYPES[path.extname(filePath)] || "application/octet-stream",
    });
    response.end(file);
  } catch {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Arquivo não encontrado.");
  }
}

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url, `http://${request.headers.host}`);

  try {
    if (url.pathname.startsWith("/api/") && (await handleApi(request, response, url))) {
      return;
    }

    await serveStatic(response, url);
  } catch (error) {
    sendJson(response, 500, { error: error.message });
  }
});

server.listen(PORT, () => {
  console.log(`Alô Peixe público: http://localhost:${PORT}`);
  console.log(`Painel administrativo: http://localhost:${PORT}/admin.html`);
  console.log(`Senha inicial do painel: ${ADMIN_PASSWORD}`);
});
