const FALLBACK_IMAGE = "assets/alo-peixe-logo.jpeg";

const elements = {
  loginCard: document.querySelector("#loginCard"),
  loginForm: document.querySelector("#loginForm"),
  passwordInput: document.querySelector("#passwordInput"),
  workspace: document.querySelector("#adminWorkspace"),
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

function headers() {
  return {
    "Content-Type": "application/json",
    "X-Admin-Password": adminPassword,
  };
}

function showMessage(text, isError = false) {
  elements.formMessage.textContent = text;
  elements.formMessage.style.color = isError ? "#c73737" : "#18a06f";
}

function resetForm() {
  elements.storyForm.reset();
  elements.storyId.value = "";
  elements.publishedInput.checked = true;
  elements.formTitle.textContent = "Nova matéria";
  showMessage("");
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
  elements.imageInput.value = item.image === FALLBACK_IMAGE ? "" : item.image;
  elements.linkInput.value = item.link === "#" ? "" : item.link;
  elements.mediaTypeInput.value = item.mediaType || "imagem";
  elements.publishedInput.checked = item.published !== false;
  elements.formTitle.textContent = "Editar matéria";
  window.scrollTo({ top: 0, behavior: "smooth" });
}

async function requestJson(url, options = {}) {
  const response = await fetch(url, options);
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || "Não foi possível concluir a ação.");
  }

  return data;
}
async function loadExclusives() {
  const data = await requestJson("/api/exclusivas", {
    headers: headers(),
  });
  exclusives = data.items || [];
  renderExclusives();
}
nderExclusives();
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
          headers: headers(),
        });
        await loadExclusives();
        showMessage("Matéria excluída.");
      });

      return card;
    })
  );
}

async function saveStory(event) {
  event.preventDefault();
  const id = elements.storyId.value;
  const url = id ? `/api/exclusivas/${id}` : "/api/exclusivas";
  const method = id ? "PUT" : "POST";

  try {
    await requestJson(url, {
      method,
      headers: headers(),
      body: JSON.stringify(formPayload()),
    });
    resetForm();
    await loadExclusives();
    showMessage("Matéria salva e site atualizado.");
  } catch (error) {
    showMessage(error.message, true);
  }
}

async function enterAdmin(event) {
  event.preventDefault();
  adminPassword = elements.passwordInput.value;
  sessionStorage.setItem("aloPeixeAdminPassword", adminPassword);

  try {
    await loadExclusives();
    elements.loginCard.hidden = true;
    elements.workspace.hidden = false;
  } catch (error) {
    showMessage(error.message, true);
    alert("Não foi possível abrir o painel. Confira se o servidor está rodando.");
  }
}

elements.loginForm.addEventListener("submit", enterAdmin);
elements.storyForm.addEventListener("submit", saveStory);
elements.resetButton.addEventListener("click", resetForm);
elements.reloadButton.addEventListener("click", loadExclusives);

if (adminPassword) {
  elements.passwordInput.value = adminPassword;
}
