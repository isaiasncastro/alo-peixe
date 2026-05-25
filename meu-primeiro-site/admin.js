const FALLBACK_IMAGE = "assets/alo-peixe-logo.jpeg";

const elements = {
  loginCard: document.querySelector("#loginCard"),
  loginForm: document.querySelector("#loginForm"),
  loginMessage: document.querySelector("#loginMessage"),
  localLoginHint: document.querySelector("#localLoginHint"),
  passwordInput: document.querySelector("#passwordInput"),
  workspace: document.querySelector("#adminWorkspace"),
  tabButtons: document.querySelectorAll(".tab-button"),
  panels: document.querySelectorAll(".admin-panel"),
  settingsForm: document.querySelector("#settingsForm"),
  settingsMessage: document.querySelector("#settingsMessage"),
  siteNameInput: document.querySelector("#siteNameInput"),
  taglineInput: document.querySelector("#taglineInput"),
  heroEyebrowInput: document.querySelector("#heroEyebrowInput"),
  heroTitleInput: document.querySelector("#heroTitleInput"),
  heroDescriptionInput: document.querySelector("#heroDescriptionInput"),
  tickerLabelInput: document.querySelector("#tickerLabelInput"),
  publicSourceUrlInput: document.querySelector("#publicSourceUrlInput"),
  logoInput: document.querySelector("#logoInput"),
  footerTextInput: document.querySelector("#footerTextInput"),
  automaticFeedInput: document.querySelector("#automaticFeedInput"),
  storyForm: document.querySelector("#storyForm"),
  storyId: document.querySelector("#storyId"),
  titleInput: document.querySelector("#titleInput"),
  descriptionInput: document.querySelector("#descriptionInput"),
  contentInput: document.querySelector("#contentInput"),
  imageInput: document.querySelector("#imageInput"),
  videoUrlInput: document.querySelector("#videoUrlInput"),
  linkInput: document.querySelector("#linkInput"),
  mediaTypeInput: document.querySelector("#mediaTypeInput"),
  publishedInput: document.querySelector("#publishedInput"),
  formTitle: document.querySelector("#formTitle"),
  formMessage: document.querySelector("#formMessage"),
  resetButton: document.querySelector("#resetButton"),
  reloadButton: document.querySelector("#reloadButton"),
  exclusiveList: document.querySelector("#exclusiveList"),
  template: document.querySelector("#exclusiveTemplate"),
  directoryTemplate: document.querySelector("#directoryTemplate"),
  newsModal: document.querySelector("#modal-noticia"),
  newsContent: document.querySelector("#conteudo-noticia"),
  serviceForm: document.querySelector("#serviceForm"),
  serviceList: document.querySelector("#serviceList"),
  serviceMessage: document.querySelector("#serviceMessage"),
  serviceResetButton: document.querySelector("#serviceResetButton"),
  serviceReloadButton: document.querySelector("#serviceReloadButton"),
  authorityForm: document.querySelector("#authorityForm"),
  authorityList: document.querySelector("#authorityList"),
  authorityMessage: document.querySelector("#authorityMessage"),
  authorityResetButton: document.querySelector("#authorityResetButton"),
  authorityReloadButton: document.querySelector("#authorityReloadButton"),
};

let adminPassword = sessionStorage.getItem("aloPeixeAdminPassword") || "";
let exclusives = [];
let services = [];
let authorities = [];
let settings = {};

function authHeaders() {
  return {
    "Content-Type": "application/json",
    "X-Admin-Password": adminPassword,
  };
}

function showMessage(element, text, isError = false) {
  element.textContent = text;
  element.classList.toggle("is-error", isError);
}

async function requestJson(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      ...(options.headers || {}),
    },
  });
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || "Não foi possível concluir a ação.");
  }

  return data;
}

function escapeHtml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

async function visualizarNoticia(url) {
  if (!url || url === "#") {
    return;
  }

  elements.newsModal.classList.add("is-open");
  elements.newsModal.setAttribute("aria-hidden", "false");
  elements.newsContent.innerHTML = "<p>Carregando conteudo...</p>";

  try {
    const data = await requestJson(`/api/ler-noticia?url=${encodeURIComponent(url)}`, {
      headers: authHeaders(),
    });
    elements.newsContent.innerHTML = `
      <h2 id="titulo-noticia-modal">${escapeHtml(data.titulo || "Noticia")}</h2>
      <hr>
      <div class="texto-artigo">${data.conteudo || "<p>Conteudo nao encontrado.</p>"}</div>
    `;
  } catch (error) {
    elements.newsContent.innerHTML = `<p class="reader-error">${escapeHtml(error.message || "Erro ao extrair noticia.")}</p>`;
  }
}

function fecharModal() {
  elements.newsModal.classList.remove("is-open");
  elements.newsModal.setAttribute("aria-hidden", "true");
}

function openTab(panelId) {
  elements.tabButtons.forEach((button) => {
    button.classList.toggle("is-active", button.dataset.tab === panelId);
  });
  elements.panels.forEach((panel) => {
    panel.classList.toggle("is-active", panel.id === panelId);
  });
}

function fillSettingsForm(value) {
  settings = value || {};
  elements.siteNameInput.value = settings.siteName || "Alô Peixe";
  elements.taglineInput.value = settings.tagline || "Plantão Tocantins";
  elements.heroEyebrowInput.value = settings.heroEyebrow || "Notícias em tempo real";
  elements.heroTitleInput.value = settings.heroTitle || "";
  elements.heroDescriptionInput.value = settings.heroDescription || "";
  elements.tickerLabelInput.value = settings.tickerLabel || "Ao vivo";
  elements.publicSourceUrlInput.value = settings.publicSourceUrl || "https://g1.globo.com/to/tocantins/";
  elements.logoInput.value = settings.logo || FALLBACK_IMAGE;
  elements.footerTextInput.value = settings.footerText || "";
  elements.automaticFeedInput.checked = settings.automaticFeedEnabled !== false;
}

function settingsPayload() {
  return {
    siteName: elements.siteNameInput.value,
    tagline: elements.taglineInput.value,
    heroEyebrow: elements.heroEyebrowInput.value,
    heroTitle: elements.heroTitleInput.value,
    heroDescription: elements.heroDescriptionInput.value,
    tickerLabel: elements.tickerLabelInput.value,
    publicSourceUrl: elements.publicSourceUrlInput.value,
    logo: elements.logoInput.value || FALLBACK_IMAGE,
    footerText: elements.footerTextInput.value,
    automaticFeedEnabled: elements.automaticFeedInput.checked,
  };
}

function resetForm() {
  elements.storyForm.reset();
  elements.storyId.value = "";
  elements.imageInput.value = FALLBACK_IMAGE;
  elements.videoUrlInput.value = "";
  elements.linkInput.value = "#";
  elements.publishedInput.checked = true;
  elements.formTitle.textContent = "Nova matéria";
  showMessage(elements.formMessage, "");
}

function formPayload() {
  return {
    title: elements.titleInput.value,
    description: elements.descriptionInput.value,
    content: elements.contentInput.value,
    image: elements.imageInput.value || FALLBACK_IMAGE,
    videoUrl: elements.videoUrlInput.value,
    link: elements.linkInput.value || "#",
    mediaType: elements.mediaTypeInput.value,
    published: elements.publishedInput.checked,
  };
}

function fillForm(item) {
  elements.storyId.value = item.id;
  elements.titleInput.value = item.title;
  elements.descriptionInput.value = item.description || "";
  elements.contentInput.value = item.content || "";
  elements.imageInput.value = item.image || FALLBACK_IMAGE;
  elements.videoUrlInput.value = item.videoUrl || "";
  elements.linkInput.value = item.link || "#";
  elements.mediaTypeInput.value = item.mediaType || "imagem";
  elements.publishedInput.checked = item.published !== false;
  elements.formTitle.textContent = "Editar matéria";
  openTab("storyPanel");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

const directoryConfigs = {
  services: {
    endpoint: "/api/prestadores",
    collection: () => services,
    setCollection: (items) => {
      services = items;
    },
    prefix: "service",
    panel: "servicesPanel",
    list: () => elements.serviceList,
    message: () => elements.serviceMessage,
    emptyText: "Nenhum prestador cadastrado ainda.",
    savedText: "Prestador salvo e publicado.",
    deletedText: "Prestador excluído.",
    newTitle: "Novo prestador",
    editTitle: "Editar prestador",
  },
  authorities: {
    endpoint: "/api/autoridades",
    collection: () => authorities,
    setCollection: (items) => {
      authorities = items;
    },
    prefix: "authority",
    panel: "authoritiesPanel",
    list: () => elements.authorityList,
    message: () => elements.authorityMessage,
    emptyText: "Nenhuma autoridade cadastrada ainda.",
    savedText: "Autoridade salva e publicada.",
    deletedText: "Autoridade excluída.",
    newTitle: "Nova autoridade",
    editTitle: "Editar autoridade",
  },
};

function directoryElement(config, suffix) {
  return document.querySelector(`#${config.prefix}${suffix}`);
}

function resetDirectoryForm(kind) {
  const config = directoryConfigs[kind];
  directoryElement(config, "Form").reset();
  directoryElement(config, "Id").value = "";
  directoryElement(config, "ImageInput").value = FALLBACK_IMAGE;
  directoryElement(config, "PublishedInput").checked = true;
  directoryElement(config, "FormTitle").textContent = config.newTitle;
  showMessage(config.message(), "");
}

function directoryPayload(kind) {
  const config = directoryConfigs[kind];
  return {
    name: directoryElement(config, "NameInput").value,
    role: directoryElement(config, "RoleInput").value,
    description: directoryElement(config, "DescriptionInput").value,
    phone: directoryElement(config, "PhoneInput").value,
    instagram: directoryElement(config, "InstagramInput").value,
    image: directoryElement(config, "ImageInput").value || FALLBACK_IMAGE,
    link: directoryElement(config, "LinkInput").value,
    published: directoryElement(config, "PublishedInput").checked,
  };
}

function fillDirectoryForm(kind, item) {
  const config = directoryConfigs[kind];
  directoryElement(config, "Id").value = item.id;
  directoryElement(config, "NameInput").value = item.name || "";
  directoryElement(config, "RoleInput").value = item.role || "";
  directoryElement(config, "DescriptionInput").value = item.description || "";
  directoryElement(config, "PhoneInput").value = item.phone || "";
  directoryElement(config, "InstagramInput").value = item.instagram || "";
  directoryElement(config, "ImageInput").value = item.image || FALLBACK_IMAGE;
  directoryElement(config, "LinkInput").value = item.link || "";
  directoryElement(config, "PublishedInput").checked = item.published !== false;
  directoryElement(config, "FormTitle").textContent = config.editTitle;
  openTab(config.panel);
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function renderDirectory(kind) {
  const config = directoryConfigs[kind];
  const items = config.collection();
  const list = config.list();

  if (!items.length) {
    list.innerHTML = `<div class="empty-state">${config.emptyText}</div>`;
    return;
  }

  list.replaceChildren(
    ...items.map((item) => {
      const card = elements.directoryTemplate.content.firstElementChild.cloneNode(true);
      const image = card.querySelector("img");
      const status = card.querySelector("span");
      const title = card.querySelector("h3");
      const description = card.querySelector("p");

      image.src = item.image || FALLBACK_IMAGE;
      image.alt = item.name;
      image.addEventListener("error", () => {
        image.src = FALLBACK_IMAGE;
      });
      status.textContent = item.published === false ? "Rascunho" : item.role || "Publicado";
      title.textContent = item.name;
      description.textContent = item.description || item.instagram || item.phone || "Sem descrição.";

      card.querySelector(".edit-button").addEventListener("click", () => fillDirectoryForm(kind, item));
      card.querySelector(".delete-button").addEventListener("click", async () => {
        if (!confirm(`Excluir "${item.name}"?`)) {
          return;
        }

        await requestJson(`${config.endpoint}/${item.id}`, {
          method: "DELETE",
          headers: authHeaders(),
        });
        await loadAdmin();
        showMessage(config.message(), config.deletedText);
      });

      return card;
    })
  );
}

async function saveDirectory(kind, event) {
  event.preventDefault();
  const config = directoryConfigs[kind];
  const id = directoryElement(config, "Id").value;
  const url = id ? `${config.endpoint}/${id}` : config.endpoint;
  const method = id ? "PUT" : "POST";

  try {
    await requestJson(url, {
      method,
      headers: authHeaders(),
      body: JSON.stringify(directoryPayload(kind)),
    });
    resetDirectoryForm(kind);
    await loadAdmin();
    showMessage(config.message(), config.savedText);
  } catch (error) {
    showMessage(config.message(), error.message, true);
  }
}

async function loadAdmin() {
  const data = await requestJson("/api/admin", {
    headers: authHeaders(),
  });

  fillSettingsForm(data.settings);
  exclusives = data.items || [];
  services = data.services || [];
  authorities = data.authorities || [];
  renderExclusives();
  renderDirectory("services");
  renderDirectory("authorities");
}

function renderExclusives() {
  if (!exclusives.length) {
    elements.exclusiveList.innerHTML = `
      <div class="empty-state">
        Nenhuma matéria exclusiva cadastrada ainda.
      </div>
    `;
    return;
  }

  elements.exclusiveList.replaceChildren(
    ...exclusives.map((item) => {
      const card = elements.template.content.firstElementChild.cloneNode(true);
      const image = card.querySelector("img");
      const status = card.querySelector("span");
      const title = card.querySelector("h3");
      const description = card.querySelector("p");

      image.src = item.image || FALLBACK_IMAGE;
      image.alt = item.title;
      image.addEventListener("error", () => {
        image.src = FALLBACK_IMAGE;
      });
      status.textContent = item.published === false ? "Rascunho" : "Publicado";
      title.textContent = item.title;
      description.textContent = item.description || "Sem resumo cadastrado.";

      const readButton = card.querySelector(".read-button");
      readButton.hidden = !item.link || item.link === "#";
      readButton.addEventListener("click", () => visualizarNoticia(item.link));
      card.querySelector(".edit-button").addEventListener("click", () => fillForm(item));
      card.querySelector(".delete-button").addEventListener("click", async () => {
        if (!confirm(`Excluir "${item.title}"?`)) {
          return;
        }

        await requestJson(`/api/exclusivas/${item.id}`, {
          method: "DELETE",
          headers: authHeaders(),
        });
        await loadAdmin();
        showMessage(elements.formMessage, "Matéria excluída.");
      });

      return card;
    })
  );
}

async function saveSettings(event) {
  event.preventDefault();

  try {
    const data = await requestJson("/api/settings", {
      method: "PUT",
      headers: authHeaders(),
      body: JSON.stringify(settingsPayload()),
    });
    fillSettingsForm(data.settings);
    showMessage(elements.settingsMessage, "Site atualizado com sucesso.");
  } catch (error) {
    showMessage(elements.settingsMessage, error.message, true);
  }
}

async function saveStory(event) {
  event.preventDefault();
  const id = elements.storyId.value;
  const url = id ? `/api/exclusivas/${id}` : "/api/exclusivas";
  const method = id ? "PUT" : "POST";

  try {
    await requestJson(url, {
      method,
      headers: authHeaders(),
      body: JSON.stringify(formPayload()),
    });
    resetForm();
    await loadAdmin();
    showMessage(elements.formMessage, "Matéria salva e site atualizado.");
  } catch (error) {
    showMessage(elements.formMessage, error.message, true);
  }
}

async function enterAdmin(event) {
  event.preventDefault();
  adminPassword = elements.passwordInput.value.trim();
  sessionStorage.setItem("aloPeixeAdminPassword", adminPassword);
  showMessage(elements.loginMessage, "Entrando...");

  try {
    await loadAdmin();
    elements.loginCard.hidden = true;
    elements.workspace.hidden = false;
    resetForm();
    showMessage(elements.loginMessage, "");
  } catch (error) {
    showMessage(elements.loginMessage, error.message, true);
  }
}

elements.loginForm.addEventListener("submit", enterAdmin);
elements.settingsForm.addEventListener("submit", saveSettings);
elements.storyForm.addEventListener("submit", saveStory);
elements.serviceForm.addEventListener("submit", (event) => saveDirectory("services", event));
elements.authorityForm.addEventListener("submit", (event) => saveDirectory("authorities", event));
elements.resetButton.addEventListener("click", resetForm);
elements.reloadButton.addEventListener("click", loadAdmin);
elements.serviceResetButton.addEventListener("click", () => resetDirectoryForm("services"));
elements.authorityResetButton.addEventListener("click", () => resetDirectoryForm("authorities"));
elements.serviceReloadButton.addEventListener("click", loadAdmin);
elements.authorityReloadButton.addEventListener("click", loadAdmin);
elements.newsModal.addEventListener("click", (event) => {
  if (event.target === elements.newsModal) {
    fecharModal();
  }
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    fecharModal();
  }
});
elements.tabButtons.forEach((button) => {
  button.addEventListener("click", () => openTab(button.dataset.tab));
});

if (adminPassword) {
  elements.passwordInput.value = adminPassword;
}

if (["localhost", "127.0.0.1"].includes(window.location.hostname)) {
  elements.localLoginHint.hidden = false;
}

window.App = {
  visualizarNoticia,
  fecharModal,
};
