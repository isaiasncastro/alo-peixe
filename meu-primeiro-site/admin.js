const FALLBACK_IMAGE = "assets/alo-peixe-logo.jpeg";

const elements = {
  loginCard: document.querySelector("#loginCard"),
  loginForm: document.querySelector("#loginForm"),
  loginMessage: document.querySelector("#loginMessage"),
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
  linkInput: document.querySelector("#linkInput"),
  mediaTypeInput: document.querySelector("#mediaTypeInput"),
  publishedInput: document.querySelector("#publishedInput"),
  formTitle: document.querySelector("#formTitle"),
  formMessage: document.querySelector("#formMessage"),
  resetButton: document.querySelector("#resetButton"),
  reloadButton: document.querySelector("#reloadButton"),
  exclusiveList: document.querySelector("#exclusiveList"),
  template: document.querySelector("#exclusiveTemplate"),
};

let adminPassword = sessionStorage.getItem("aloPeixeAdminPassword") || "";
let exclusives = [];
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
  elements.linkInput.value = item.link || "#";
  elements.mediaTypeInput.value = item.mediaType || "imagem";
  elements.publishedInput.checked = item.published !== false;
  elements.formTitle.textContent = "Editar matéria";
  openTab("storyPanel");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

async function loadAdmin() {
  const data = await requestJson("/api/admin", {
    headers: authHeaders(),
  });

  fillSettingsForm(data.settings);
  exclusives = data.items || [];
  renderExclusives();
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
elements.resetButton.addEventListener("click", resetForm);
elements.reloadButton.addEventListener("click", loadAdmin);
elements.tabButtons.forEach((button) => {
  button.addEventListener("click", () => openTab(button.dataset.tab));
});

if (adminPassword) {
  elements.passwordInput.value = adminPassword;
}
