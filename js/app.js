import {
  createProject,
  deleteProject,
  duplicateProject,
  exportProject,
  importProject,
  listProjects,
  renameProject,
  saveProject
} from "./storage.js?v=2";

const shell = document.querySelector(".app-shell");
let searchTerm = "";
let currentUser = null;

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Agora";

  const difference = Date.now() - date.getTime();
  const minutes = Math.floor(difference / 60000);
  if (minutes < 1) return "Agora";
  if (minutes < 60) return `Há ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Há ${hours} h`;

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    year: date.getFullYear() !== new Date().getFullYear() ? "numeric" : undefined
  }).format(date);
}

function projectStats(project) {
  const floors = project.floors?.length || 0;
  const walls = project.floors?.reduce((total, floor) => total + (floor.walls?.length || 0), 0) || 0;
  return { floors, walls };
}

function download(filename, content, type = "application/json") {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function slugify(value) {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "projeto";
}

function toast(message) {
  const stack = document.querySelector(".toast-stack");
  const element = document.createElement("div");
  element.className = "toast";
  element.textContent = message;
  stack.append(element);
  setTimeout(() => element.remove(), 3200);
}

function renderProject(project) {
  const stats = projectStats(project);
  return `
    <article class="project-card" data-project-id="${escapeHtml(project.id)}">
      <button class="project-preview" type="button" data-action="open" aria-label="Abrir ${escapeHtml(project.name)}">
        <span class="preview-plan" aria-hidden="true"></span>
      </button>
      <div class="project-card-body">
        <div class="project-card-heading">
          <h2 title="${escapeHtml(project.name)}">${escapeHtml(project.name)}</h2>
          <div class="project-menu">
            <button class="icon-button" type="button" data-action="menu" aria-label="Mais opções" title="Mais opções">•••</button>
            <div class="project-menu-panel">
              <button type="button" data-action="rename">Renomear</button>
              <button type="button" data-action="duplicate">Duplicar</button>
              <button type="button" data-action="export">Exportar arquivo</button>
              <button class="danger" type="button" data-action="delete">Excluir</button>
            </div>
          </div>
        </div>
        <div class="project-meta">
          <span>${stats.floors} ${stats.floors === 1 ? "pavimento" : "pavimentos"}</span>
          <span>·</span>
          <span>${stats.walls} ${stats.walls === 1 ? "parede" : "paredes"}</span>
          <span>·</span>
          <span>${formatDate(project.updatedAt)}</span>
        </div>
        <button class="project-open" type="button" data-action="open">
          <span>Abrir projeto</span>
          <span aria-hidden="true">→</span>
        </button>
      </div>
    </article>
  `;
}

function renderProjects() {
  const projects = listProjects();
  const filtered = projects.filter(project => project.name.toLowerCase().includes(searchTerm.toLowerCase()));
  const grid = document.querySelector("#projects-grid");
  const count = document.querySelector("#project-count");
  const floorCount = document.querySelector("#floor-count");

  count.textContent = String(projects.length);
  floorCount.textContent = String(projects.reduce((total, project) => total + (project.floors?.length || 0), 0));

  if (!filtered.length) {
    grid.innerHTML = `
      <section class="empty-state">
        <div>
          <div class="empty-state-mark" aria-hidden="true">⌂</div>
          <h2>${projects.length ? "Nenhum projeto encontrado" : "Sua prancheta está livre"}</h2>
          <p>${projects.length ? "Tente outro nome na busca." : "Comece por uma planta vazia ou use uma estrutura pronta para explorar o editor."}</p>
          ${projects.length ? "" : '<button class="primary-button" type="button" data-action="new">Criar primeiro projeto</button>'}
        </div>
      </section>
    `;
    return;
  }

  grid.innerHTML = filtered.map(renderProject).join("");
}

function openDialog() {
  const dialog = document.querySelector("#new-project-dialog");
  dialog.hidden = false;
  document.querySelector("#project-name").focus();
}

function closeDialog() {
  const dialog = document.querySelector("#new-project-dialog");
  dialog.hidden = true;
  document.querySelector("#new-project-form").reset();
}

function renderDashboard() {
  const email = currentUser?.email || currentUser?.user_metadata?.full_name || "Conta Atero";

  shell.innerHTML = `
    <div class="dashboard">
      <header class="dashboard-header">
        <a class="brand" href="index.html" aria-label="Atero Floor — projetos">
          <span class="brand-mark">F</span>
          <span class="brand-copy">
            <strong>Atero Floor</strong>
            <span>Planejamento de espaços</span>
          </span>
        </a>
        <div class="header-actions">
          <span class="account-chip" title="${escapeHtml(email)}">${escapeHtml(email)}</span>
          <button class="primary-button" type="button" data-action="new">Novo projeto</button>
        </div>
      </header>

      <main class="dashboard-main">
        <section class="hero">
          <div>
            <p class="eyebrow">Seus projetos</p>
            <h1>Do primeiro traço ao espaço inteiro.</h1>
            <p>Crie plantas precisas, organize pavimentos e experimente distribuições sem lutar contra a ferramenta.</p>
          </div>
          <div class="hero-summary" aria-label="Resumo dos projetos">
            <div class="summary-item"><strong id="project-count">0</strong><span>projetos</span></div>
            <div class="summary-item"><strong id="floor-count">0</strong><span>pavimentos</span></div>
          </div>
        </section>

        <section aria-labelledby="projects-title">
          <div class="workspace-toolbar">
            <div class="search-field">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="11" cy="11" r="7"></circle><path d="m20 20-3.5-3.5"></path></svg>
              <input id="project-search" type="search" placeholder="Buscar projetos" autocomplete="off" aria-label="Buscar projetos">
            </div>
            <div class="toolbar-buttons">
              <button class="secondary-button" type="button" data-action="import">Importar</button>
              <button class="primary-button" type="button" data-action="new">Novo projeto</button>
            </div>
          </div>
          <h2 id="projects-title" hidden>Projetos</h2>
          <div class="projects-grid" id="projects-grid"></div>
        </section>
      </main>
    </div>

    <input id="import-file" type="file" accept=".atero-floor,.json,application/json" hidden>

    <div class="dialog-backdrop" id="new-project-dialog" hidden>
      <section class="dialog" role="dialog" aria-modal="true" aria-labelledby="new-project-title">
        <div class="dialog-header">
          <div>
            <h2 id="new-project-title">Novo projeto</h2>
            <p>Você poderá mudar tudo depois.</p>
          </div>
          <button class="icon-button" type="button" data-action="close-dialog" aria-label="Fechar">×</button>
        </div>
        <form id="new-project-form">
          <div class="field">
            <label for="project-name">Nome do projeto</label>
            <input id="project-name" name="name" maxlength="80" placeholder="Casa, apartamento, escritório..." required>
          </div>

          <div class="field">
            <label>Começar com</label>
            <div class="templates">
              <label class="template-option">
                <input type="radio" name="template" value="blank" checked>
                <span class="template-card">
                  <span class="template-thumbnail">＋</span>
                  <span><strong>Em branco</strong><span>Uma prancheta limpa para desenhar livremente.</span></span>
                </span>
              </label>
              <label class="template-option">
                <input type="radio" name="template" value="studio">
                <span class="template-card">
                  <span class="template-thumbnail">▦</span>
                  <span><strong>Studio</strong><span>Base compacta de 48 m² com mobiliário.</span></span>
                </span>
              </label>
              <label class="template-option">
                <input type="radio" name="template" value="house">
                <span class="template-card">
                  <span class="template-thumbnail">⌂</span>
                  <span><strong>Casa térrea</strong><span>Estrutura inicial com cinco ambientes.</span></span>
                </span>
              </label>
            </div>
          </div>

          <div class="dialog-actions">
            <button class="secondary-button" type="button" data-action="close-dialog">Cancelar</button>
            <button class="primary-button" type="submit">Criar e abrir</button>
          </div>
        </form>
      </section>
    </div>

    <div class="toast-stack" aria-live="polite"></div>
  `;

  renderProjects();
}

function projectFromTarget(target) {
  const card = target.closest("[data-project-id]");
  if (!card) return null;
  return listProjects().find(project => project.id === card.dataset.projectId) || null;
}

function handleProjectAction(action, project, target) {
  if (!project) return;

  if (action === "open") {
    location.href = `floor.html?project=${encodeURIComponent(project.id)}`;
  }

  if (action === "menu") {
    document.querySelectorAll(".project-menu.open").forEach(menu => {
      if (menu !== target.closest(".project-menu")) menu.classList.remove("open");
    });
    target.closest(".project-menu").classList.toggle("open");
  }

  if (action === "rename") {
    const nextName = prompt("Novo nome do projeto:", project.name);
    if (nextName?.trim()) {
      renameProject(project.id, nextName);
      renderProjects();
      toast("Projeto renomeado.");
    }
  }

  if (action === "duplicate") {
    duplicateProject(project.id);
    renderProjects();
    toast("Cópia criada.");
  }

  if (action === "export") {
    download(`${slugify(project.name)}.atero-floor.json`, exportProject(project));
    toast("Arquivo do projeto exportado.");
  }

  if (action === "delete") {
    if (confirm(`Excluir “${project.name}”? Esta ação não pode ser desfeita.`)) {
      deleteProject(project.id);
      renderProjects();
      toast("Projeto excluído.");
    }
  }
}

function bindEvents() {
  shell.addEventListener("click", event => {
    const target = event.target.closest("[data-action]");
    if (!target) {
      document.querySelectorAll(".project-menu.open").forEach(menu => menu.classList.remove("open"));
      return;
    }

    const action = target.dataset.action;
    if (action === "new") openDialog();
    if (action === "close-dialog") closeDialog();
    if (action === "import") document.querySelector("#import-file").click();

    handleProjectAction(action, projectFromTarget(target), target);
  });

  shell.addEventListener("input", event => {
    if (event.target.id === "project-search") {
      searchTerm = event.target.value;
      renderProjects();
    }
  });

  shell.addEventListener("submit", event => {
    if (event.target.id !== "new-project-form") return;
    event.preventDefault();
    const data = new FormData(event.target);
    const project = createProject({
      name: data.get("name"),
      template: data.get("template")
    });
    saveProject(project);
    location.href = `floor.html?project=${encodeURIComponent(project.id)}`;
  });

  shell.addEventListener("change", async event => {
    if (event.target.id !== "import-file") return;
    const [file] = event.target.files;
    if (!file) return;

    try {
      const project = importProject(await file.text());
      renderProjects();
      toast(`“${project.name}” foi importado.`);
    } catch (error) {
      alert(error.message || "Não foi possível importar o projeto.");
    } finally {
      event.target.value = "";
    }
  });

  shell.addEventListener("keydown", event => {
    if (event.key === "Escape") closeDialog();
  });
}

export async function startDashboard({ user }) {
  currentUser = user;
  renderDashboard();
  bindEvents();
}
