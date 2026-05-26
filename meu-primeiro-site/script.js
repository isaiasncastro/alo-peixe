const REFRESH_INTERVAL = 120000;
const FALLBACK_IMAGE = "assets/alo-peixe-logo.jpeg";

const state = {
  allNews: [],
  settings: {},
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
  sidebarList: document.querySelector("#sidebarList"),
  template: document.querySelector("#storyTemplate"),
  serviceDirectory: document.querySelector("#serviceDirectory"),
  authorityDirectory: document.querySelector("#authorityDirectory"),
  directoryTemplate: document.querySelector("#directoryCardTemplate"),
};

function setText(selector, value) {
  const element = document.querySelector(selector);

  if (element && value) {
    element.textContent = value;
  }
}

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

function cleanDescription(value = "") {
  const text = String(value).replace(/\s+/g, " ").trim();
  return text.length > 220 ? `${text.slice(0, 217).trim()}...` : text;
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

function isVideoType(type) {
  return type === "video" || type === "v\u00eddeo";
}

function getVideoEmbedUrl(url = "") {
  if (!url) {
    return "";
  }

  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, "");

    if (host === "youtu.be") {
      return `https://www.youtube.com/embed/${parsed.pathname.slice(1)}`;
    }

    if (host.includes("youtube.com")) {
      const id = parsed.searchParams.get("v") || parsed.pathname.split("/").filter(Boolean).pop();
      return id ? `https://www.youtube.com/embed/${id}` : "";
    }

    if (host.includes("vimeo.com")) {
      const id = parsed.pathname.split("/").filter(Boolean).pop();
      return id ? `https://player.vimeo.com/video/${id}` : "";
    }

    return url;
  } catch {
    return "";
  }
}

function createLeadMedia(item) {
  const videoUrl = getVideoEmbedUrl(item.videoUrl);

  if (isVideoType(item.mediaType) && videoUrl) {
    const isDirectVideo = /\.(mp4|webm|ogg)(\?.*)?$/i.test(videoUrl);
    const media = document.createElement(isDirectVideo ? "video" : "iframe");

    media.title = item.title;

    if (isDirectVideo) {
      media.src = videoUrl;
      media.controls = true;
      media.poster = item.image || FALLBACK_IMAGE;
    } else {
      media.src = videoUrl;
      media.loading = "lazy";
      media.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share";
      media.allowFullscreen = true;
    }

    return media;
  }

  const image = document.createElement("img");
  image.src = item.image || FALLBACK_IMAGE;
  image.alt = item.title;
  applyImageFallback(image);
  return image;
}

function normalizeItem(item) {
  return {
    id: item.id || crypto.randomUUID(),
    source: item.source || "Alô Peixe",
    type: item.type || "exclusive",
    title: item.title || "Sem título",
    description: cleanDescription(item.description || item.content || ""),
    content: item.content || "",
    link: item.link || "#",
    pubDate: item.pubDate || new Date().toISOString(),
    image: item.image || FALLBACK_IMAGE,
    videoUrl: item.videoUrl || "",
    mediaType: item.videoUrl ? "v?deo" : item.mediaType || "imagem",
  };
}

function applySettings(settings) {
  state.settings = settings || {};

  setText(".brand strong", state.settings.siteName);
  setText(".brand small", state.settings.tagline);
  setText(".hero-copy .eyebrow", state.settings.heroEyebrow);
  setText(".hero h1", state.settings.heroTitle);
  setText(".hero-copy > p:not(.eyebrow)", state.settings.heroDescription);
  setText(".ticker span", state.settings.tickerLabel);
  setText("footer span:first-child", state.settings.siteName);
  setText("footer span:last-child", state.settings.footerText);

  document.title = `${state.settings.siteName || "Alô Peixe"} | Notícias`;

  document.querySelectorAll(".brand img").forEach((image) => {
    image.src = state.settings.logo || FALLBACK_IMAGE;
  });
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
  link.target = item.link === "#" ? "_self" : "_blank";
  tag.textContent = item.source || "Alô Peixe";
  image.src = item.image;
  image.alt = item.title;
  title.textContent = item.title;
  description.textContent = item.description || "Leia a matéria completa.";
  time.dateTime = item.pubDate;
  time.textContent = formatDate(item.pubDate);
  setMediaBadge(badge, item.mediaType);
  applyImageFallback(image);

  return card;
}

function renderLead(news) {
  const lead = news[0];

  if (!lead) {
    elements.lead.innerHTML = `
      <article class="lead-card">
        <div class="lead-media"><img src="${FALLBACK_IMAGE}" alt="Alô Peixe" /></div>
        <div class="lead-content">
          <span class="tag">Sem notícias</span>
          <h2>Nenhuma matéria publicada no momento.</h2>
          <p>Use o painel administrativo para publicar informações da cidade de Peixe.</p>
        </div>
      </article>
    `;
    return;
  }

  const article = document.createElement("article");
  const link = document.createElement("a");
  const media = document.createElement("div");
  const badge = document.createElement("span");
  const content = document.createElement("div");
  const tag = document.createElement("span");
  const title = document.createElement("h2");
  const description = document.createElement("p");
  const time = document.createElement("time");

  article.className = "lead-card";
  link.href = lead.link;
  link.target = lead.link === "#" ? "_self" : "_blank";
  link.rel = "noreferrer";
  media.className = "lead-media";
  content.className = "lead-content";
  badge.className = "media-badge";
  tag.className = "tag";

  tag.textContent =
    lead.type === "exclusive"
      ? "Exclusivo Alô Peixe"
      : isVideoType(lead.mediaType)
        ? "Vídeo em destaque"
        : "Manchete principal";
  title.textContent = lead.title;
  description.textContent = lead.description || "Clique para ler a notícia completa.";
  time.dateTime = lead.pubDate;
  time.textContent = formatDate(lead.pubDate);
  setMediaBadge(badge, lead.mediaType);
  media.append(createLeadMedia(lead), badge);
  content.append(tag, title, description, time);
  link.append(media, content);
  article.append(link);
  elements.lead.replaceChildren(article);
}

function renderTopStories(news) {
  elements.topStories.replaceChildren(...news.slice(1, 4).map((item) => buildStoryCard(item)));
}

function renderVideos(news) {
  const mediaStories = news
    .filter((item) => item.mediaType === "vídeo" || item.image !== FALLBACK_IMAGE)
    .slice(0, 4);

  if (!mediaStories.length) {
    elements.videoList.innerHTML = `
      <div class="empty-state">
        Nenhuma matéria multimídia encontrada neste momento.
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

function renderSidebar(news) {
  const items = news.slice(0, 6);

  if (!items.length) {
    elements.sidebarList.innerHTML = `
      <div class="empty-state">
        Nenhuma noticia publicada ainda.
      </div>
    `;
    return;
  }

  elements.sidebarList.replaceChildren(
    ...items.map((item) => {
      const article = document.createElement("article");
      const tag = document.createElement("span");
      const title = document.createElement("h3");
      const time = document.createElement("time");

      article.className = "sidebar-story";
      tag.textContent = item.source || "Alo Peixe";
      title.textContent = item.title;
      time.dateTime = item.pubDate;
      time.textContent = formatDate(item.pubDate);
      article.append(tag, title, time);
      return article;
    })
  );
}

function normalizeDirectoryItem(item) {
  return {
    name: item.name || "Sem nome",
    role: item.role || "",
    description: item.description || "",
    phone: item.phone || "",
    instagram: item.instagram || "",
    image: item.image || FALLBACK_IMAGE,
    link: item.link || "",
  };
}

function instagramUrl(value = "") {
  const clean = value.trim();
  if (!clean) {
    return "";
  }
  if (/^https?:\/\//i.test(clean)) {
    return clean;
  }
  return `https://instagram.com/${clean.replace(/^@/, "")}`;
}

function renderDirectory(listElement, items, emptyText) {
  const normalized = (items || []).map(normalizeDirectoryItem);

  if (!normalized.length) {
    listElement.innerHTML = `<div class="empty-state">${emptyText}</div>`;
    return;
  }

  listElement.replaceChildren(
    ...normalized.map((item) => {
      const card = elements.directoryTemplate.content.firstElementChild.cloneNode(true);
      const image = card.querySelector("img");
      const role = card.querySelector("span");
      const name = card.querySelector("h3");
      const description = card.querySelector("p");
      const actions = card.querySelector(".directory-actions");

      image.src = item.image;
      image.alt = item.name;
      applyImageFallback(image);
      role.textContent = item.role || "Cadastro local";
      name.textContent = item.name;
      description.textContent = item.description || "Informações disponíveis no contato.";

      if (item.phone) {
        const phone = document.createElement("a");
        phone.href = `tel:${item.phone.replace(/\D/g, "")}`;
        phone.textContent = item.phone;
        actions.append(phone);
      }

      if (item.instagram) {
        const instagram = document.createElement("a");
        instagram.href = instagramUrl(item.instagram);
        instagram.target = "_blank";
        instagram.rel = "noreferrer";
        instagram.textContent = item.instagram.startsWith("@") ? item.instagram : `@${item.instagram.replace(/^https?:\/\/(www\.)?instagram\.com\//i, "").replace(/\/$/, "")}`;
        actions.append(instagram);
      }

      if (item.link) {
        const link = document.createElement("a");
        link.href = item.link;
        link.target = "_blank";
        link.rel = "noreferrer";
        link.textContent = "Abrir";
        actions.append(link);
      }

      return card;
    })
  );
}

function render(news) {
  const term = elements.searchInput.value.trim().toLowerCase();
  const filtered = term
    ? news.filter((item) => `${item.title} ${item.description} ${item.source}`.toLowerCase().includes(term))
    : news;

  renderLead(filtered);
  renderTopStories(filtered);
  renderVideos(filtered);
  renderList(filtered);
  renderSidebar(filtered);

  elements.newsCount.textContent = `${filtered.length} ${
    filtered.length === 1 ? "notícia carregada" : "notícias carregadas"
  }`;
  elements.tickerText.textContent = filtered[0]?.title || "Nenhuma notícia encontrada.";
}

async function loadSite() {
  setStatus("loading", "Atualizando portal", "Carregando site, matérias exclusivas e notícias automáticas...");
  elements.refreshButton.disabled = true;

  try {
    const response = await fetch("/api/site", { cache: "no-store" });
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Não foi possível carregar o site.");
    }

    applySettings(data.settings);
    state.allNews = (data.items || []).map(normalizeItem);
    state.lastSuccessfulUpdate = new Date(data.updatedAt || Date.now());
    render(state.allNews);
    renderDirectory(elements.serviceDirectory, data.services || [], "Nenhum prestador cadastrado ainda.");
    renderDirectory(elements.authorityDirectory, data.authorities || [], "Nenhuma autoridade cadastrada ainda.");

    if (data.feedStatus === "online") {
      setStatus("online", "Portal conectado", "Matérias exclusivas e feed automático carregados.");
    } else if (data.feedStatus === "desativado") {
      setStatus("online", "Feed automático desativado", "Mostrando apenas matérias cadastradas no painel.");
    } else {
      setStatus("online", "Portal carregado", "Mostrando as matérias disponíveis no momento.");
    }

    elements.lastUpdate.textContent = `Última atualização: ${formatDate(state.lastSuccessfulUpdate)}`;
  } catch (error) {
    console.error(error);
    setStatus("error", "Erro ao carregar", error.message);
    elements.lastUpdate.textContent = "Tente atualizar a página.";
  } finally {
    elements.refreshButton.disabled = false;
  }
}

elements.refreshButton.addEventListener("click", loadSite);
elements.searchInput.addEventListener("input", () => render(state.allNews));

loadSite();
setInterval(loadSite, REFRESH_INTERVAL);
