const BUNDLE_VERSION = "3";

const SCRIPT_PARTS = [
  "./floor-v3/bundle-1.txt",
  "./floor-v3/bundle-2.txt",
  "./floor-v3/bundle-3.txt",
  "./floor-v3/bundle-4.txt"
];

let editorModulePromise = null;
let stylesReadyPromise = null;

async function fetchText(relativePath) {
  const url = new URL(relativePath, import.meta.url);
  url.searchParams.set("v", BUNDLE_VERSION);

  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Não foi possível carregar ${relativePath} (${response.status}).`);
  }

  return response.text();
}

async function decodeGzipBase64(encoded) {
  if (!("DecompressionStream" in globalThis)) {
    throw new Error("Este navegador não oferece o recurso de descompressão necessário para o editor.");
  }

  const normalized = encoded.replace(/\s+/g, "");
  const binary = atob(normalized);
  const bytes = Uint8Array.from(binary, character => character.charCodeAt(0));
  const stream = new Blob([bytes])
    .stream()
    .pipeThrough(new DecompressionStream("gzip"));

  return new Response(stream).text();
}

async function loadStyles() {
  if (stylesReadyPromise) return stylesReadyPromise;

  stylesReadyPromise = (async () => {
    const encoded = await fetchText("./floor-v3/styles.txt");
    const css = await decodeGzipBase64(encoded);

    document.querySelector('style[data-atero-floor-v3]')?.remove();

    const style = document.createElement("style");
    style.dataset.ateroFloorV3 = "";
    style.textContent = css;
    document.head.append(style);
  })();

  return stylesReadyPromise;
}

async function loadEditorModule() {
  if (editorModulePromise) return editorModulePromise;

  editorModulePromise = (async () => {
    const [parts] = await Promise.all([
      Promise.all(SCRIPT_PARTS.map(fetchText)),
      loadStyles()
    ]);

    const source = await decodeGzipBase64(parts.join(""));
    const storageUrl = new URL("./storage.js?v=2", import.meta.url).href;
    const preparedSource = source.replace(
      'from "./storage.js?v=2";',
      `from ${JSON.stringify(storageUrl)};`
    );

    if (preparedSource === source) {
      throw new Error("O pacote do editor está incompatível com o carregador atual.");
    }

    const moduleUrl = URL.createObjectURL(
      new Blob([preparedSource], { type: "text/javascript;charset=utf-8" })
    );

    try {
      return await import(moduleUrl);
    } finally {
      setTimeout(() => URL.revokeObjectURL(moduleUrl), 0);
    }
  })();

  return editorModulePromise;
}

export async function startEditor(context) {
  const editor = await loadEditorModule();
  return editor.startEditor(context);
}
