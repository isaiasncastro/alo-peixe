const RSS_URL = "https://g1.globo.com/dynamo/to/tocantins/rss2.xml";
const LOCAL_API_URL = "/api/news";
const PROXY_URL = `https://api.allorigins.win/raw?url=${encodeURIComponent(RSS_URL)}`;
const JSON_FEED_URL = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(RSS_URL)}`;
const REFRESH_INTERVAL = 120000;
const FALLBACK_IMAGE = "assets/alo-peixe-logo.jpeg";
const FEED_ENDPOINTS = [
  { type: "json", url: LOCAL_API_URL },
  { type: "xml", url: RSS_URL },
  { type: "xml", url: PROXY_URL },
  { type: "json", url: JSON_FEED_URL },
];

const state = {
  allNews: [],
  lastSuccessfulUpdate: null,
};

const elements = {
  body: document.body,
  refreshButton: document.querySelector("#refreshButton"),
  searchInput: document.querySelector("#searchInput"),
  statusTitle: document.querySelector("#statusTitle"),
  statusText: document.querySelector("#statusText"),
  lastUpdate: document.querySelector("#lastUpdate"),
  newsCount: document.querySelector("#newsCount"),
  tickerText: document.querySelector("#tickerText"),
  lead: document.querySelector("#destaques"),
  topStories: document.querySelector("#topStories"),
  videoList: document.querySelector("#videoList"),
  newsList: document.querySelector("#newsList"),
  template: document.querySelector("#storyTemplate"),
};

const fallbackNews = [
  {
    title: "Feed do G1 Tocantins temporariamente indisponível",
    description:
      "A estrutura do portal está pronta. Assim que a fonte responder, as manchetes reais substituem este aviso automaticamente.",
    link: "https://g1.globo.com/to/tocantins/",
    pubDate: new Date().toISOString(),
    image: FALLBACK_IMAGE,
    mediaType: "imagem",
  },
];

function setStatus(type, title, text) {
  elements.body.classList.toggle("is-loading", type === "loading");
  elements.body.classList.toggle("is-error", type === "error");
  elements.statusTitle.textContent = title;
  elements.statusText.textContent = text;
}

function formatDate(value) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Data não informada";
  }

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

function sanitizeText(value) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(value || "", "text/html");
  return doc.body.textContent.trim();
}

function cleanDescription(value) {
  const text = sanitizeText(value).replace(/\s+/g, " ");

  if (text.length <= 220) {
    return text;
  }

  return `${text.slice(0, 217).trim()}...`;
}

function getHtmlFragment(item) {
  return [
    item.querySelector("description")?.textContent,
    item.getElementsByTagName("content:encoded")[0]?.textContent,
  ]
    .filter(Boolean)
    .join(" ");
}

function getMediaFromHtml(html) {
  const doc = new DOMParser().parseFromString(html || "", "text/html");
  const image = doc.querySelector("img")?.getAttribute("src") || "";
  const iframe = doc.querySelector("iframe")?.getAttribute("src") || "";
  const video = doc.querySelector("video source, video")?.getAttribute("src") || "";

  return {
    image,
    video: video || iframe,
  };
}

function getMediaFromXml(item) {
  const mediaContent = [...item.getElementsByTagName("media:content")];
  const mediaThumbnail = item.getElementsByTagName("media:thumbnail")[0];
  const enclosure = item.querySelector("enclosure");
  const imageMedia = mediaContent.find((media) => media.getAttribute("medium") === "image");
  const videoMedia = mediaContent.find((media) => {
    const type = media.getAttribute("type") || "";
    const medium = media.getAttribute("medium") || "";
    return medium === "video" || type.startsWith("video/");
  });

  return {
    image:
      imageMedia?.getAttribute("url") ||
      mediaThumbnail?.getAttribute("url") ||
      (enclosure?.getAttribute("type")?.startsWith("image/") ? enclosure.getAttribute("url") : ""),
    video:
      videoMedia?.getAttribute("url") ||
      (enclosure?.getAttribute("type")?.startsWith("video/") ? enclosure.getAttribute("url") : ""),
  };
}

function getMedia(item) {
  const htmlMedia = getMediaFromHtml(getHtmlFragment(item));
  const xmlMedia = getMediaFromXml(item);
  const image = xmlMedia.image || htmlMedia.image || FALLBACK_IMAGE;
  const video = xmlMedia.video || htmlMedia.video;
  const link = item.querySelector("link")?.textContent?.trim() || "";
  const looksLikeVideo = Boolean(video) || /video|vídeo|videos|vídeos/i.test(`${link} ${sanitizeText(item.querySelector("title")?.textContent)}`);

  return {
    image,
    video,
    mediaType: looksLikeVideo ? "vídeo" : image === FALLBACK_IMAGE ? "sem foto" : "imagem",
  };
}

function parseFeed(xmlText) {
  const xml = new DOMParser().parseFromString(xmlText, "application/xml");
  const error = xml.querySelector("parsererror");

  if (error) {
    throw new Error("Não foi possível ler o XML do feed.");
  }

  return [...xml.querySelectorAll("item")].map((item) => {
    const media = getMedia(item);
    const subtitle = item.getElementsByTagName("atom:subtitle")[0]?.textContent;
    const description = subtitle || item.querySelector("description")?.textContent;

    return {
      title: sanitizeText(item.querySelector("title")?.textContent),
      description: cleanDescription(description),
      link: item.querySelector("link")?.textContent?.trim() || "https://g1.globo.com/to/tocantins/",
      pubDate: item.querySelector("pubDate")?.textContent || new Date().toISOString(),
      ...media,
    };
  });
}

function parseJsonFeed(data) {
  if (!Array.isArray(data.items)) {
    throw new Error("A resposta JSON não contém notícias.");
  }

  return data.items.map((item) => {
    const htmlMedia = getMediaFromHtml(`${item.description || ""} ${item.content || ""}`);
    const enclosure = item.enclosure || {};
    const image =
      item.image ||
      item.thumbnail ||
      htmlMedia.image ||
      (enclosure.type?.startsWith("image/") ? enclosure.link : "") ||
      FALLBACK_IMAGE;
    const video = htmlMedia.video || (enclosure.type?.startsWith("video/") ? enclosure.link : "");
    const looksLikeVideo =
      item.mediaType === "vídeo" ||
      Boolean(video) ||
      /video|vídeo|videos|vídeos/i.test(`${item.link} ${item.title}`);

    return {
      id: item.id,
      source: item.source || "G1 Tocantins",
      type: item.type || "g1",
      title: sanitizeText(item.title),
      description: cleanDescription(item.description || item.content),
      link: item.link || "https://g1.globo.com/to/tocantins/",
      pubDate: item.pubDate || new Date().toISOString(),
      image,
      video,
      mediaType: looksLikeVideo ? "vídeo" : image === FALLBACK_IMAGE ? "sem foto" : "imagem",
    };
  });
}

async function fetchNewsFromEndpoints() {
  const errors = [];
  let localNews = [];

  for (const endpoint of FEED_ENDPOINTS) {
    try {
      const response = await fetch(endpoint.url, { cache: "no-store" });

      if (!response.ok) {
        throw new Error(`Resposta inesperada: ${response.status}`);
      }

      if (endpoint.type === "json") {
        const data = await response.json();
        const news = parseJsonFeed(data);

        if (endpoint.url === LOCAL_API_URL && data.feedStatus?.startsWith("erro")) {
          localNews = news;
          throw new Error(data.feedStatus);
        }

        if (news.length) {
          return [...localNews, ...news].sort(
            (a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime()
          );
        }

        throw new Error("Endpoint respondeu sem notícias.");
      }

      const news = parseFeed(await response.text());

      if (news.length) {
        return [...localNews, ...news].sort(
          (a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime()
        );
      }

      throw new Error("Endpoint respondeu sem notícias.");
    } catch (error) {
      errors.push(`${endpoint.url}: ${error.message}`);
    }
  }

  if (localNews.length) {
    return localNews;
  }

  throw new Error(errors.join(" | "));
}

function applyImageFallback(image) {
  image.addEventListener(
    "error",
    () => {
      image.src = FALLBACK_IMAGE;
    },
    { once: true }
  );
}

function setMediaBadge(element, type) {
  element.textContent = type === "vídeo" ? "Vídeo" : type === "sem foto" ? "Alô Peixe" : "Foto";
}

function buildStoryCard(item, variant = "default") {
  const card = elements.template.content.firstElementChild.cloneNode(true);
  const link = card.querySelector(".story-link");
  const image = card.querySelector("img");
  const badge = card.querySelector(".media-badge");
  const tag = card.querySelector(".tag");
  const title = card.querySelector("h3");
  const description = card.querySelector("p");
  const time = card.querySelector("time");

  card.classList.toggle("news-card", variant === "list");
  link.href = item.link;
  tag.textContent = item.source || "G1 Tocantins";
  image.src = item.image;
  image.alt = item.title;
  title.textContent = item.title;
  description.textContent = item.description || "Leia a matéria completa no G1 Tocantins.";
  time.dateTime = item.pubDate;
  time.textContent = formatDate(item.pubDate);
  setMediaBadge(badge, item.mediaType);
  applyImageFallback(image);

  return card;
}

function renderLead(news) {
  const lead = news[0] || fallbackNews[0];
  const article = document.createElement("article");
  const link = document.createElement("a");
  const media = document.createElement("div");
  const image = document.createElement("img");
  const badge = document.createElement("span");
  const content = document.createElement("div");
  const tag = document.createElement("span");
  const title = document.createElement("h2");
  const description = document.createElement("p");
  const time = document.createElement("time");

  article.className = "lead-card";
  link.href = lead.link;
  link.target = "_blank";
  link.rel = "noreferrer";
  media.className = "lead-media";
  content.className = "lead-content";
  badge.className = "media-badge";
  tag.className = "tag";

  image.src = lead.image;
  image.alt = lead.title;
  tag.textContent =
    lead.type === "exclusive"
      ? "Exclusivo Alô Peixe"
      : lead.mediaType === "vídeo"
        ? "Vídeo em destaque"
        : "Manchete principal";
  title.textContent = lead.title;
  description.textContent = lead.description || "Clique para ler a notícia completa na fonte original.";
  time.dateTime = lead.pubDate;
  time.textContent = formatDate(lead.pubDate);
  setMediaBadge(badge, lead.mediaType);
  applyImageFallback(image);

  media.append(image, badge);
  content.append(tag, title, description, time);
  link.append(media, content);
  article.append(link);
  elements.lead.replaceChildren(article);
}

function renderTopStories(news) {
  const stories = news.slice(1, 4);
  elements.topStories.replaceChildren(...stories.map((item) => buildStoryCard(item)));
}

function renderVideos(news) {
  const mediaStories = news
    .filter((item) => item.mediaType === "vídeo" || item.image !== FALLBACK_IMAGE)
    .slice(0, 4);

  if (!mediaStories.length) {
    elements.videoList.innerHTML = `
      <div class="empty-state">
        Nenhuma matéria multimídia encontrada no feed neste momento.
      </div>
    `;
    return;
  }

  elements.videoList.replaceChildren(...mediaStories.map((item) => buildStoryCard(item)));
}

function renderList(news) {
  const latest = news.slice(4, 16);

  if (!latest.length) {
    elements.newsList.innerHTML = `
      <div class="empty-state">
        Nenhuma notícia encontrada para essa busca.
      </div>
    `;
    return;
  }

  elements.newsList.replaceChildren(...latest.map((item) => buildStoryCard(item, "list")));
}

function render(news) {
  const term = elements.searchInput.value.trim().toLowerCase();
  const filtered = term
    ? news.filter((item) => `${item.title} ${item.description}`.toLowerCase().includes(term))
    : news;

  renderLead(filtered);
  renderTopStories(filtered);
  renderVideos(filtered);
  renderList(filtered);

  elements.newsCount.textContent = `${filtered.length} ${
    filtered.length === 1 ? "notícia carregada" : "notícias carregadas"
  }`;
  elements.tickerText.textContent = filtered[0]?.title || "Nenhuma notícia encontrada para essa busca.";
}

async function loadNews() {
  setStatus("loading", "Atualizando notícias", "Conectando ao feed do G1 Tocantins...");
  elements.refreshButton.disabled = true;

  try {
    const news = await fetchNewsFromEndpoints();

    if (!news.length) {
      throw new Error("O feed respondeu sem notícias.");
    }

    state.allNews = news;
    state.lastSuccessfulUpdate = new Date();
    render(state.allNews);
    setStatus("online", "Feed conectado", "Fotos, vídeos e manchetes atualizados a partir do G1 Tocantins.");
    elements.lastUpdate.textContent = `Última atualização: ${formatDate(state.lastSuccessfulUpdate)}`;
  } catch (error) {
    console.error(error);
    state.allNews = state.allNews.length ? state.allNews : fallbackNews;
    render(state.allNews);
    setStatus(
      "error",
      "Fonte indisponível agora",
      "Mantive o portal no ar e tentarei buscar novas notícias automaticamente."
    );
    elements.lastUpdate.textContent = state.lastSuccessfulUpdate
      ? `Última atualização válida: ${formatDate(state.lastSuccessfulUpdate)}`
      : "Aguardando primeira atualização válida";
  } finally {
    elements.refreshButton.disabled = false;
  }
}

elements.refreshButton.addEventListener("click", loadNews);
elements.searchInput.addEventListener("input", () => render(state.allNews));

loadNews();
setInterval(loadNews, REFRESH_INTERVAL);
