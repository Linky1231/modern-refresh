// ============================================================
// CONECTOR DE ASSETS DE GOOGLE (Asternal)
// ------------------------------------------------------------
// Permite traer una lista de assets desde Google y colocarlos en la
// escena del editor de niveles:
//   · Google Imágenes  -> Programmable Search JSON API (clave + cx)
//   · Google Imágenes  -> SerpAPI (una sola clave, engine=google_images)
//   · Google Drive     -> carpetas públicas de imágenes (clave de API)
// Las llamadas salen del navegador del jugador con SU propia clave y se
// cachean en el dispositivo para que sigan disponibles sin conexión.
// ============================================================

import { cacheAssets, type AssetsConfig, type LibraryAsset } from "@/lib/asset-library";

/** Página de resultados de una búsqueda remota. */
export interface RemoteAssetPage {
  assets: LibraryAsset[];
  /** Índice siguiente para pedir más resultados (null = no hay más). */
  nextStart: number | null;
}

// ── Utilidades de JSON ──────────────────────────────────────
type JsonRecord = Record<string, unknown>;

function asRecord(value: unknown): JsonRecord | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : null;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function messageFrom(data: unknown): string | undefined {
  const record = asRecord(data);
  if (!record) return undefined;
  const error = record.error;
  return (
    asString(error) ??
    asString(asRecord(error)?.message) ??
    asString(record.message) ??
    asString(record.error_description)
  );
}

function shortHash(value: string) {
  let h = 0;
  for (let i = 0; i < value.length; i += 1) {
    h = (h * 31 + value.charCodeAt(i)) | 0;
  }
  return Math.abs(h).toString(36);
}

function cleanName(title: string | undefined, url: string) {
  const raw = (title ?? "").trim();
  if (raw) return raw.length > 48 ? `${raw.slice(0, 45)}…` : raw;
  const file = url.split("?")[0].split("/").pop() ?? "asset";
  try {
    return decodeURIComponent(file).slice(0, 48);
  } catch {
    return file.slice(0, 48);
  }
}

function describeHttpError(status: number, data: unknown) {
  const apiMessage = messageFrom(data);
  if (status === 400) {
    return apiMessage
      ? `Google rechazó la petición: ${apiMessage}`
      : "Petición inválida: revisa la clave de API y el id del buscador (cx).";
  }
  if (status === 401 || status === 403) {
    return apiMessage
      ? `Sin permiso: ${apiMessage}`
      : "La clave no tiene permiso o la API no está habilitada en tu proyecto de Google Cloud.";
  }
  if (status === 429) {
    return "Se agotó la cuota de peticiones. Espera un momento y vuelve a intentarlo.";
  }
  return apiMessage
    ? `Error ${status}: ${apiMessage}`
    : `Error ${status} al consultar Google.`;
}

async function getJSON(url: string): Promise<unknown> {
  let res: Response;
  try {
    res = await fetch(url, { method: "GET", headers: { Accept: "application/json" } });
  } catch {
    throw new Error(
      "No se pudo conectar con el servicio. Revisa tu conexión y que el proveedor permita llamadas desde el navegador.",
    );
  }
  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  if (!res.ok) throw new Error(describeHttpError(res.status, data));
  const apiError = messageFrom(data);
  if (apiError) throw new Error(apiError);
  return data;
}

function cacheAndReturn(assets: LibraryAsset[], nextStart: number | null): RemoteAssetPage {
  cacheAssets(assets);
  return { assets, nextStart };
}

// ── Google Imágenes · Programmable Search ───────────────────
async function searchWithGoogleApi(
  query: string,
  config: AssetsConfig,
  start: number,
): Promise<RemoteAssetPage> {
  const params = new URLSearchParams({
    key: config.googleApiKey.trim(),
    cx: config.googleCx.trim(),
    q: query,
    searchType: "image",
    num: "10",
    start: String(Math.min(91, Math.max(1, start))),
    safe: "active",
    imgSize: "medium",
  });
  const data = asRecord(await getJSON(`https://www.googleapis.com/customsearch/v1?${params}`));
  const items = asArray(data?.items).map(asRecord).filter((i): i is JsonRecord => i !== null);
  const assets: LibraryAsset[] = [];
  for (const item of items) {
    const link = asString(item.link);
    if (!link) continue;
    const image = asRecord(item.image);
    assets.push({
      id: `google:${shortHash(link)}`,
      name: cleanName(asString(item.title), link),
      category: "google",
      tags: ["google", "imagen"],
      url: link,
      thumb: asString(image?.thumbnailLink) ?? link,
      originUrl: asString(image?.contextLink),
      source: "google",
      span: 1,
    });
  }
  const next = assets.length === 0 ? null : start + assets.length;
  return cacheAndReturn(assets, next);
}

// ── Google Imágenes · SerpAPI ───────────────────────────────
async function searchWithSerpApi(
  query: string,
  config: AssetsConfig,
  page: number,
): Promise<RemoteAssetPage> {
  const params = new URLSearchParams({
    engine: "google_images",
    q: query,
    api_key: config.serpApiKey.trim(),
    ijn: String(Math.max(0, page)),
    safe: "active",
  });
  const data = asRecord(await getJSON(`https://serpapi.com/search.json?${params}`));
  const items = asArray(data?.images_results)
    .map(asRecord)
    .filter((i): i is JsonRecord => i !== null);
  const assets: LibraryAsset[] = [];
  for (const item of items) {
    const original = asString(item.original);
    if (!original) continue;
    const source = asString(item.source)?.toLowerCase();
    assets.push({
      id: `google:${shortHash(original)}`,
      name: cleanName(asString(item.title), original),
      category: "google",
      tags: source ? ["google", "imagen", source] : ["google", "imagen"],
      url: original,
      thumb: asString(item.thumbnail) ?? original,
      originUrl: asString(item.link),
      source: "google",
      span: 1,
    });
  }
  const hasNext = Boolean(asRecord(data?.serpapi_pagination)?.next) || assets.length > 0;
  return cacheAndReturn(assets, hasNext ? page + 1 : null);
}

/**
 * Busca assets en la lista de imágenes de Google.
 * @param start Índice de la primera coincidencia (paginación).
 */
export async function searchGoogleImages(
  query: string,
  config: AssetsConfig,
  start = 1,
): Promise<RemoteAssetPage> {
  const q = query.trim();
  if (!q) return { assets: [], nextStart: null };
  if (config.provider === "serpapi") {
    if (!config.serpApiKey.trim()) throw new Error("Falta la clave de SerpAPI.");
    return searchWithSerpApi(q, config, start - 1);
  }
  if (!config.googleApiKey.trim() || !config.googleCx.trim()) {
    throw new Error("Faltan la clave de API de Google y el id del buscador (cx).");
  }
  return searchWithGoogleApi(q, config, start);
}

// ── Google Drive · carpeta pública de assets ────────────────
/** Lista las imágenes de una carpeta pública de Google Drive. */
export async function listDriveImages(
  config: AssetsConfig,
  pageToken?: string,
): Promise<{ assets: LibraryAsset[]; nextPageToken: string | null }> {
  const apiKey = config.googleApiKey.trim();
  const folderId = config.driveFolderId.trim();
  if (!apiKey || !folderId) {
    throw new Error("Faltan la clave de API de Google y el id de la carpeta de Drive.");
  }
  const params = new URLSearchParams({
    key: apiKey,
    q: `'${folderId}' in parents and mimeType contains 'image/' and trashed = false`,
    fields: "nextPageToken,files(id,name)",
    pageSize: "200",
    orderBy: "name_natural",
    includeItemsFromAllDrives: "true",
    supportsAllDrives: "true",
  });
  if (pageToken) params.set("pageToken", pageToken);
  const data = asRecord(await getJSON(`https://www.googleapis.com/drive/v3/files?${params}`));
  const files = asArray(data?.files).map(asRecord).filter((f): f is JsonRecord => f !== null);
  const assets: LibraryAsset[] = [];
  for (const file of files) {
    const id = asString(file.id);
    if (!id) continue;
    const name = asString(file.name) ?? id;
    assets.push({
      id: `drive:${id}`,
      name: cleanName(name, name),
      category: "drive",
      tags: ["drive", "google"],
      url: `https://drive.google.com/thumbnail?id=${id}&sz=w1000`,
      thumb: `https://drive.google.com/thumbnail?id=${id}&sz=w256`,
      source: "drive",
      span: 1,
    });
  }
  cacheAssets(assets);
  return { assets, nextPageToken: asString(data?.nextPageToken) ?? null };
}

/** Comprueba la conexión con lo que el usuario haya configurado. */
export async function testGoogleConnection(config: AssetsConfig): Promise<string> {
  const checks: string[] = [];
  if (config.provider === "serpapi" && config.serpApiKey.trim()) {
    const page = await searchWithSerpApi("sprite", config, 0);
    checks.push(`${page.assets.length} imagen(es) desde SerpAPI`);
  }
  if (config.googleApiKey.trim() && config.googleCx.trim()) {
    const page = await searchWithGoogleApi("sprite", config, 1);
    checks.push(`${page.assets.length} imagen(es) desde Google Imágenes`);
  }
  if (config.googleApiKey.trim() && config.driveFolderId.trim()) {
    const drive = await listDriveImages(config);
    checks.push(`${drive.assets.length} archivo(s) desde Drive`);
  }
  if (checks.length === 0) {
    throw new Error("Completa al menos una fuente (imágenes o carpeta de Drive).");
  }
  return `Conexión correcta · ${checks.join(" · ")}`;
}
