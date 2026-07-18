import { requireAteroApp } from "./access-guard.js?v=2";

async function start() {
  const access = await requireAteroApp({ appId: "floor", fallbackName: "Atero Floor" });
  if (!access) return;

  const module = await import("./app.js?v=2");
  await module.startDashboard({ user: access.user, app: access.app });
}

start().catch(error => {
  console.error("Falha ao iniciar o Atero Floor:", error);
  document.querySelector(".app-shell").innerHTML = `
    <main class="fatal-error">
      <h1>Não foi possível abrir o Atero Floor</h1>
      <p>Recarregue a página. Se o problema continuar, limpe os dados locais do site.</p>
      <button type="button" onclick="location.reload()">Recarregar</button>
    </main>
  `;
});
