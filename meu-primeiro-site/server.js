const crypto = require("node:crypto");
const fs = require("node:fs/promises");
const https = require("node:https");
const http = require("node:http");
const path = require("node:path");
let axios;
let cheerio;

try {
  axios = require("axios");
  cheerio = require("cheerio");
} catch {
  axios = null;
  cheerio = null;
}

const PORT = Number(process.env.PORT || 5600);
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "alopeixe2026";
const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, "data");
const EXCLUSIVES_FILE = path.join(DATA_DIR, "exclusivas.json");
const SERVICES_FILE = path.join(DATA_DIR, "prestadores.json");
const AUTHORITIES_FILE = path.join(DATA_DIR, "autoridades.json");
const SETTINGS_FILE = path.join(DATA_DIR, "settings.json");
const RSS_URL = "https://g1.globo.com/dynamo/to/tocantins/rss2.xml";
const JSON_FEED_URL = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(RSS_URL)}`;
const FALLBACK_IMAGE = "assets/alo-peixe-logo.jpeg";

const DEFAULT_SETTINGS = {
  siteName: "Alô Peixe",
  tagline: "Plantão Tocantins",
  heroEyebrow: "Jornalismo local",
  heroTitle: "Notícias de Peixe e Tocantins com foto, vídeo e atualização rápida.",
  heroDescription:
    "Acompanhe os principais acontecimentos da cidade, veja galerias, vídeos e matérias publicadas pela redação.",
  tickerLabel: "Ao vivo",
  automaticFeedEnabled: true,
  publicSourceUrl: "https://g1.globo.com/to/tocantins/",
  logo: FALLBACK_IMAGE,
  footerText: "Portal de notícias com cobertura local, fotos, vídeos e destaques do Tocantins.",
};

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

function fetchTextAllowingLocalTls(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const request = https.get(
      url,
      {
        headers,
        rejectUnauthorized: false,
      },
      (response) => {
        const chunks = [];

        response.on("data", (chunk) => chunks.push(chunk));
        response.on("end", () => {
          const body = Buffer.concat(chunks).toString("utf8");

          if (response.statusCode < 200 || response.statusCode >= 300) {
            reject(new Error(`HTTP respondeu ${response.statusCode}`));
            return;
          }

          resolve(body);
        });
      }
    );

    request.setTimeout(15000, () => {
      request.destroy(new Error("Tempo limite ao buscar feed."));
    });
    request.on("error", reject);
  });
}

async function fetchText(url, headers = {}) {
  try {
    const response = await fetch(url, { headers });

    if (!response.ok) {
      throw new Error(`HTTP respondeu ${response.status}`);
    }

    return response.text();
  } catch (error) {
    if (url.startsWith("https://")) {
      return fetchTextAllowingLocalTls(url, headers);
    }

    throw error;
  }
}

function sanitizeArticleHtml($, root) {
  root.find("script, style, iframe, object, embed, form, input, button, noscript").remove();

  root.find("*").each((_, element) => {
    const attributes = element.attribs || {};

    Object.keys(attributes).forEach((name) => {
      const value = attributes[name] || "";
      const lowerName = name.toLowerCase();
      const lowerValue = String(value).trim().toLowerCase();

      if (lowerName.startsWith("on") || lowerName === "style") {
        $(element).removeAttr(name);
      }

      if (["href", "src"].includes(lowerName) && lowerValue.startsWith("javascript:")) {
        $(element).removeAttr(name);
      }
    });
  });

  return root.html() || "";
}

function sanitizeBasicHtml(value = "") {
  return value
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, "")
    .replace(/<object[\s\S]*?<\/object>/gi, "")
    .replace(/<embed[\s\S]*?>/gi, "")
    .replace(/\son[a-z]+=["'][\s\S]*?["']/gi, "")
    .replace(/\sstyle=["'][\s\S]*?["']/gi, "")
    .replace(/(href|src)=["']javascript:[\s\S]*?["']/gi, "");
}

function extractFirstBlock(html, tagName) {
  const match = html.match(new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, "i"));
  return match ? match[1] : "";
}

async function getArticleHtml(url) {
  if (axios && cheerio) {
    const { data } = await axios.get(url, {
      timeout: 12000,
      maxRedirects: 4,
      headers: {
        "User-Agent": "AloPeixePortal/1.0",
        Accept: "text/html,application/xhtml+xml",
      },
    });
    return data;
  }

  const response = await fetch(url, {
    headers: {
      "User-Agent": "AloPeixePortal/1.0",
      Accept: "text/html,application/xhtml+xml",
    },
  });

  if (!response.ok) {
    throw new Error(`Site respondeu ${response.status}`);
  }

  return response.text();
}

async function scrapeArticle(targetUrl) {
  let parsedUrl;

  try {
    parsedUrl = new URL(targetUrl);
  } catch {
    throw new Error("URL da noticia invalida.");
  }

  if (!["http:", "https:"].includes(parsedUrl.protocol)) {
    throw new Error("Use uma URL http ou https.");
  }

  const data = await getArticleHtml(parsedUrl.href);

  if (!cheerio) {
    const title = stripHtml(extractFirstBlock(data, "h1") || extractFirstBlock(data, "title"));
    const article = extractFirstBlock(data, "article") || extractFirstBlock(data, "main") || extractFirstBlock(data, "body");

    return {
      titulo: title || "Noticia",
      conteudo: sanitizeBasicHtml(article),
      url: parsedUrl.href,
    };
  }

  const $ = cheerio.load(data);
  const title = stripHtml($("h1").first().text() || $("title").first().text());
  const article = $("article").first().length
    ? $("article").first()
    : $("main").first().length
      ? $("main").first()
      : $("body").first();

  return {
    titulo: title || "Noticia",
    conteudo: sanitizeArticleHtml($, article),
    url: parsedUrl.href,
  };
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
    const link = stripHtml(getTag(block, "link")) || "https://g1.globo.com/to/tocantins/";

    return {
      id: crypto.createHash("sha1").update(getTag(block, "guid") || link).digest("hex"),
      source: "G1 Tocantins",
      type: "g1",
      title: stripHtml(getTag(block, "title")),
      description: limitText(description),
      content: "",
      link,
      pubDate: getTag(block, "pubDate") || new Date().toISOString(),
      published: true,
      ...getMedia(block),
    };
  });
}

function parseJsonFeed(data) {
  if (!Array.isArray(data.items)) {
    return [];
  }

  return data.items.map((item) => {
    const rawDescription = `${item.description || ""} ${item.content || ""}`;
    const imageMatch = rawDescription.match(/<img[^>]+src=["']([^"']+)["']/i);
    const image = item.thumbnail || imageMatch?.[1] || FALLBACK_IMAGE;
    const isVideo = /video|vídeo|videos|vídeos/i.test(`${item.title || ""} ${item.link || ""}`);
    const link = item.link || "https://g1.globo.com/to/tocantins/";

    return {
      id: crypto.createHash("sha1").update(item.guid || link || item.title).digest("hex"),
      source: "G1 Tocantins",
      type: "g1",
      title: stripHtml(item.title || ""),
      description: limitText(item.description || item.content || ""),
      content: "",
      link,
      pubDate: item.pubDate || new Date().toISOString(),
      image,
      mediaType: isVideo ? "vídeo" : image === FALLBACK_IMAGE ? "sem foto" : "imagem",
      published: true,
    };
  });
}

async function readJson(file, fallback) {
  try {
    return JSON.parse(await fs.readFile(file, "utf8"));
  } catch {
    return fallback;
  }
}

async function writeJson(file, value) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function readExclusives() {
  return readJson(EXCLUSIVES_FILE, []);
}

async function writeExclusives(items) {
  await writeJson(EXCLUSIVES_FILE, items);
}

async function readServices() {
  return readJson(SERVICES_FILE, []);
}

async function writeServices(items) {
  await writeJson(SERVICES_FILE, items);
}

async function readAuthorities() {
  return readJson(AUTHORITIES_FILE, []);
}

async function writeAuthorities(items) {
  await writeJson(AUTHORITIES_FILE, items);
}

async function readSettings() {
  return {
    ...DEFAULT_SETTINGS,
    ...(await readJson(SETTINGS_FILE, {})),
  };
}

async function writeSettings(payload) {
  const settings = {
    ...DEFAULT_SETTINGS,
    siteName: String(payload.siteName || DEFAULT_SETTINGS.siteName).trim(),
    tagline: String(payload.tagline || DEFAULT_SETTINGS.tagline).trim(),
    heroEyebrow: String(payload.heroEyebrow || DEFAULT_SETTINGS.heroEyebrow).trim(),
    heroTitle: String(payload.heroTitle || DEFAULT_SETTINGS.heroTitle).trim(),
    heroDescription: String(payload.heroDescription || DEFAULT_SETTINGS.heroDescription).trim(),
    tickerLabel: String(payload.tickerLabel || DEFAULT_SETTINGS.tickerLabel).trim(),
    automaticFeedEnabled: payload.automaticFeedEnabled !== false,
    publicSourceUrl: String(payload.publicSourceUrl || DEFAULT_SETTINGS.publicSourceUrl).trim(),
    logo: String(payload.logo || DEFAULT_SETTINGS.logo).trim(),
    footerText: String(payload.footerText || DEFAULT_SETTINGS.footerText).trim(),
  };

  await writeJson(SETTINGS_FILE, settings);
  return settings;
}

async function readBody(request) {
  const chunks = [];
  let size = 0;

  for await (const chunk of request) {
    size += chunk.length;
    if (size > 1_500_000) {
      throw new Error("Payload muito grande.");
    }
    chunks.push(chunk);
  }

  return chunks.length ? JSON.parse(Buffer.concat(chunks).toString("utf8")) : {};
}

function isAuthorized(request) {
  return request.headers["x-admin-password"] === ADMIN_PASSWORD;
}

function requireAdmin(request, response) {
  if (isAuthorized(request)) {
    return true;
  }

  sendJson(response, 401, { error: "Senha administrativa inválida." });
  return false;
}

function normalizeExclusive(payload, existing = {}) {
  const now = new Date().toISOString();
  const title = String(payload.title || "").trim();
  const videoUrl = String(payload.videoUrl || "").trim();

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
    videoUrl,
    mediaType: videoUrl || payload.mediaType === "vídeo" ? "vídeo" : "imagem",
    link: String(payload.link || "#").trim(),
    pubDate: existing.pubDate || payload.pubDate || now,
    updatedAt: now,
    published: payload.published !== false,
  };
}

function normalizeDirectoryItem(payload, existing = {}) {
  const now = new Date().toISOString();
  const name = String(payload.name || "").trim();

  if (!name) {
    throw new Error("O nome é obrigatório.");
  }

  return {
    id: existing.id || crypto.randomUUID(),
    name,
    role: String(payload.role || "").trim(),
    description: String(payload.description || "").trim(),
    phone: String(payload.phone || "").trim(),
    instagram: String(payload.instagram || "").trim(),
    image: String(payload.image || FALLBACK_IMAGE).trim(),
    link: String(payload.link || "").trim(),
    published: payload.published !== false,
    createdAt: existing.createdAt || now,
    updatedAt: now,
  };
}

async function getAutomaticNews(settings) {
  if (!settings.automaticFeedEnabled) {
    return [];
  }

  try {
    return parseRss(
      await fetchText(RSS_URL, {
        "User-Agent": "Mozilla/5.0 AloPeixePortal/1.0",
        Accept: "application/rss+xml,text/xml,application/xml",
      })
    );
  } catch (rssError) {
    try {
      return parseJsonFeed(JSON.parse(await fetchText(JSON_FEED_URL, { "User-Agent": "Mozilla/5.0 AloPeixePortal/1.0" })));
    } catch (jsonError) {
      throw new Error(`RSS falhou: ${rssError.message}; JSON falhou: ${jsonError.message}`);
    }
  }
}

async function publicPayload() {
  const settings = await readSettings();
  const exclusives = (await readExclusives()).filter((item) => item.published);
  const services = (await readServices()).filter((item) => item.published);
  const authorities = (await readAuthorities()).filter((item) => item.published);
  let automatic = [];
  let feedStatus = settings.automaticFeedEnabled ? "online" : "desativado";

  try {
    automatic = await getAutomaticNews(settings);
  } catch (error) {
    feedStatus = `erro: ${error.message}`;
  }

  const items = [...exclusives, ...automatic].sort(
    (a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime()
  );

  return {
    settings,
    items,
    services,
    authorities,
    feedStatus,
    updatedAt: new Date().toISOString(),
  };
}

async function handleDirectoryApi(request, response, url, basePath, readItems, writeItems) {
  if (url.pathname === basePath && request.method === "GET") {
    if (!requireAdmin(request, response)) {
      return true;
    }

    sendJson(response, 200, { items: await readItems() });
    return true;
  }

  if (url.pathname === basePath && request.method === "POST") {
    if (!requireAdmin(request, response)) {
      return true;
    }

    try {
      const items = await readItems();
      const item = normalizeDirectoryItem(await readBody(request));
      items.unshift(item);
      await writeItems(items);
      sendJson(response, 201, { item });
    } catch (error) {
      sendJson(response, 400, { error: error.message });
    }
    return true;
  }

  const match = url.pathname.match(new RegExp(`^${basePath}/([^/]+)$`));
  if (match && ["PUT", "DELETE"].includes(request.method)) {
    if (!requireAdmin(request, response)) {
      return true;
    }

    const id = match[1];
    const items = await readItems();
    const index = items.findIndex((item) => item.id === id);

    if (index === -1) {
      sendJson(response, 404, { error: "Cadastro não encontrado." });
      return true;
    }

    if (request.method === "DELETE") {
      const [removed] = items.splice(index, 1);
      await writeItems(items);
      sendJson(response, 200, { item: removed });
      return true;
    }

    try {
      items[index] = normalizeDirectoryItem(await readBody(request), items[index]);
      await writeItems(items);
      sendJson(response, 200, { item: items[index] });
    } catch (error) {
      sendJson(response, 400, { error: error.message });
    }
    return true;
  }

  return false;
}

async function handleApi(request, response, url) {
  if (url.pathname === "/api/site" && request.method === "GET") {
    sendJson(response, 200, await publicPayload());
    return true;
  }

  if (url.pathname === "/api/ler-noticia" && request.method === "GET") {
    if (!requireAdmin(request, response)) {
      return true;
    }

    const targetUrl = url.searchParams.get("url") || "";

    try {
      sendJson(response, 200, await scrapeArticle(targetUrl));
    } catch (error) {
      sendJson(response, 500, { error: error.message || "Nao foi possivel carregar o conteudo." });
    }
    return true;
  }

  if (url.pathname === "/api/news" && request.method === "GET") {
    const payload = await publicPayload();
    sendJson(response, 200, {
      items: payload.items,
      feedStatus: payload.feedStatus,
      updatedAt: payload.updatedAt,
    });
    return true;
  }

  if (url.pathname === "/api/admin" && request.method === "GET") {
    if (!requireAdmin(request, response)) {
      return true;
    }

    sendJson(response, 200, {
      settings: await readSettings(),
      items: await readExclusives(),
      services: await readServices(),
      authorities: await readAuthorities(),
    });
    return true;
  }

  if (await handleDirectoryApi(request, response, url, "/api/prestadores", readServices, writeServices)) {
    return true;
  }

  if (await handleDirectoryApi(request, response, url, "/api/autoridades", readAuthorities, writeAuthorities)) {
    return true;
  }

  if (url.pathname === "/api/settings" && request.method === "PUT") {
    if (!requireAdmin(request, response)) {
      return true;
    }

    try {
      sendJson(response, 200, { settings: await writeSettings(await readBody(request)) });
    } catch (error) {
      sendJson(response, 400, { error: error.message });
    }
    return true;
  }

  if (url.pathname === "/api/exclusivas" && request.method === "GET") {
    if (!requireAdmin(request, response)) {
      return true;
    }

    sendJson(response, 200, { items: await readExclusives() });
    return true;
  }

  if (url.pathname === "/api/exclusivas" && request.method === "POST") {
    if (!requireAdmin(request, response)) {
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
    if (!requireAdmin(request, response)) {
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
    response.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Acesso negado.");
    return;
  }

  try {
    const file = await fs.readFile(filePath);
    response.writeHead(200, {
      "Content-Type": MIME_TYPES[path.extname(filePath)] || "application/octet-stream",
      "Cache-Control": path.extname(filePath) === ".html" ? "no-store" : "public, max-age=60",
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
});
