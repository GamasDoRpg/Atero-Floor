import { requireAteroApp } from "./access-guard.js?v=2";

async function start() {
  const access = await requireAteroApp({ appId: "floor", fallbackName: "Atero Floor" });
  if (!access) return;

  const module = await import("./floor.js?v=3");
  await module.startEditor({ user: access.user, app: access.app });
}

start().catch(error => {
  console.error("Falha ao iniciar o editor do Atero Floor:", error);
  document.querySelector(".app-shell").innerHTML = `
    <main class="fatal-error">
      <h1>O editor encontrou um problema</h1>
      <p>Seu projeto continua salvo neste navegador.</p>
      <a href="index.html">Voltar aos projetos</a>
    </main>
  `;
});
