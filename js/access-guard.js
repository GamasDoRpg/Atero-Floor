const API_BASE_URL = "https://api.atero.space";
const ATERO_HUB_URL = "https://atero.space";
const AUTH_BRIDGE_URL = "https://atero.space/auth-bridge.html";
const LOGIN_URL = "https://atero.space/login.html";
const APPS_URL = "https://atero.space/selecionar-apps.html";
const REQUEST_TIMEOUT = 15000;

function accessScreen() {
  let screen = document.querySelector("#atero-access-screen");
  if (screen) return screen;

  screen = document.createElement("section");
  screen.id = "atero-access-screen";
  screen.className = "atero-access-screen";
  screen.setAttribute("role", "status");
  screen.setAttribute("aria-live", "polite");
  document.body.prepend(screen);
  return screen;
}

function setState(state) {
  document.documentElement.dataset.accessState = state;
}

function showLoading(appName) {
  const screen = accessScreen();
  screen.innerHTML = `
    <div class="atero-access-card">
      <div class="atero-access-spinner" aria-hidden="true"></div>
      <h1>Preparando ${appName}</h1>
      <p>Estamos confirmando sua Conta Atero.</p>
    </div>
  `;
  screen.hidden = false;
  setState("checking");
}

function showError({ title, message, primaryUrl, primaryLabel, retry = true }) {
  const screen = accessScreen();
  screen.innerHTML = `
    <div class="atero-access-card">
      <div class="atero-access-error-icon" aria-hidden="true">!</div>
      <h1>${title}</h1>
      <p>${message}</p>
      <div class="atero-access-actions">
        ${primaryUrl && primaryLabel ? `<a class="atero-access-button" href="${primaryUrl}">${primaryLabel}</a>` : ""}
        ${retry ? '<button class="atero-access-button atero-access-button-secondary" id="atero-access-retry" type="button">Tentar novamente</button>' : ""}
        <a class="atero-access-link" href="${ATERO_HUB_URL}">Voltar ao Atero</a>
      </div>
    </div>
  `;
  screen.hidden = false;
  setState("denied");
  screen.querySelector("#atero-access-retry")?.addEventListener("click", () => location.reload());
}

function releaseApp() {
  const screen = document.querySelector("#atero-access-screen");
  if (screen) screen.hidden = true;
  setState("authorized");
}

function sendToBridge(appId) {
  const attemptKey = `atero-auth-bridge-${appId}`;
  const lastAttempt = Number(sessionStorage.getItem(attemptKey) || 0);

  if (lastAttempt && Date.now() - lastAttempt < 15000) {
    showError({
      title: "Não foi possível preparar sua sessão",
      message: "Sua Conta Atero foi reconhecida, mas a API não concluiu a autenticação.",
      primaryUrl: `${LOGIN_URL}?return_to=${encodeURIComponent(location.href)}`,
      primaryLabel: "Entrar novamente"
    });
    return;
  }

  sessionStorage.setItem(attemptKey, String(Date.now()));
  const url = new URL(AUTH_BRIDGE_URL);
  url.searchParams.set("return_to", location.href);
  location.replace(url.href);
}

async function readJson(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

export async function requireAteroApp({ appId, fallbackName = "aplicativo Atero" }) {
  const id = String(appId || "").trim().toLowerCase();
  if (!/^[a-z0-9_-]+$/.test(id)) {
    showError({
      title: "Aplicativo inválido",
      message: "O identificador deste aplicativo não foi configurado corretamente.",
      retry: false
    });
    return null;
  }

  showLoading(fallbackName);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

  try {
    const response = await fetch(`${API_BASE_URL}/access/${encodeURIComponent(id)}`, {
      method: "GET",
      credentials: "include",
      cache: "no-store",
      headers: { Accept: "application/json" },
      signal: controller.signal
    });
    const data = await readJson(response);

    if (response.status === 401) {
      sendToBridge(id);
      return null;
    }

    if (response.status === 403) {
      showError({
        title: "Atero Floor não selecionado",
        message: "Ative o Floor entre os aplicativos da sua Conta Atero para continuar.",
        primaryUrl: APPS_URL,
        primaryLabel: "Gerenciar aplicativos"
      });
      return null;
    }

    if (response.status === 404) {
      showError({
        title: "Atero Floor indisponível",
        message: "O aplicativo ainda não está disponível para esta conta ou foi temporariamente desativado.",
        retry: false
      });
      return null;
    }

    if (!response.ok) {
      throw new Error(data?.detail || data?.message || `Erro HTTP ${response.status}`);
    }

    sessionStorage.removeItem(`atero-auth-bridge-${id}`);
    releaseApp();
    return data;
  } catch (error) {
    console.error(`Erro ao verificar acesso ao app ${id}:`, error);
    showError({
      title: error?.name === "AbortError" ? "A API demorou para responder" : "Não foi possível verificar seu acesso",
      message: error?.name === "AbortError"
        ? "A conexão com a Atero API excedeu o tempo limite."
        : "Verifique sua conexão e tente novamente."
    });
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
