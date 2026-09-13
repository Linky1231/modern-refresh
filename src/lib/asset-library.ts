// ============================================================
// BIBLIOTECA DE ASSETS DEL EDITOR DE NIVELES (Asternal)
// ------------------------------------------------------------
// · Biblioteca del motor: sprites vectoriales incluidos, sin conexión.
// · Fuentes externas: Google Imágenes (Programmable Search o SerpAPI) y
//   Google Drive (carpeta propia). Se listan, se cachean y se colocan
//   directamente sobre la escena del editor.
// Todo se guarda en el dispositivo (localStorage), igual que el resto
// del proyecto.
// ============================================================

import type { MapGenre } from "@/lib/db";

/** De dónde viene un asset. */
export type AssetSource = "engine" | "google" | "drive";

/** Asset listo para pintar en el navegador de assets. */
export interface LibraryAsset {
  id: string;
  name: string;
  /** Categoría dentro de la biblioteca. */
  category: string;
  /** Palabras clave para el buscador local. */
  tags: string[];
  /** Imagen que se coloca en la escena (lista para `src`). */
  url: string;
  /** Miniatura para la cuadrícula (si difiere de `url`). */
  thumb?: string;
  source: AssetSource;
  /** Tamaño con el que se coloca en la escena, en casillas. */
  span: number;
  /** Enlace a la fuente original (solo assets externos). */
  originUrl?: string;
  /** Géneros donde tiene sentido (vacío = todos). */
  genres?: MapGenre[];
}

/** Categorías del navegador de assets. */
export const ASSET_CATEGORIES: Array<{ id: string; label: string }> = [
  { id: "terreno", label: "Terreno" },
  { id: "naturaleza", label: "Naturaleza" },
  { id: "estructuras", label: "Estructuras" },
  { id: "personajes", label: "Personajes" },
  { id: "enemigos", label: "Enemigos" },
  { id: "objetos", label: "Objetos" },
  { id: "peligros", label: "Peligros" },
  { id: "marcadores", label: "Marcadores" },
  { id: "efectos", label: "Efectos" },
];

// ── Sprites del motor (SVG inline → data URL) ───────────────
interface SpriteDef {
  id: string;
  name: string;
  category: string;
  tags: string;
  /** Casillas que ocupa al colocarlo. */
  span?: number;
  genres?: MapGenre[];
  draw: string;
}

const SPRITES: SpriteDef[] = [
  // Terreno
  { id: "grass", name: "Pasto", category: "terreno", tags: "hierba verde suelo", draw: '<rect y="8" width="64" height="56" rx="4" fill="#4ade80"/><path d="M8 22l4-9 4 9z" fill="#22c55e"/><path d="M26 20l4-10 4 10z" fill="#16a34a"/><path d="M44 24l4-9 4 9z" fill="#22c55e"/>' },
  { id: "dirt", name: "Tierra", category: "terreno", tags: "tierra camino arena suelo", draw: '<rect y="8" width="64" height="56" rx="4" fill="#c8a165"/><circle cx="18" cy="26" r="3" fill="#a97f45"/><circle cx="42" cy="42" r="4" fill="#a97f45"/><circle cx="30" cy="20" r="2" fill="#e0c08c"/>' },
  { id: "stone_floor", name: "Losas", category: "terreno", tags: "piedra losas mazmorra suelo", draw: '<rect y="8" width="64" height="56" rx="4" fill="#94a3b8"/><path d="M4 30h56M4 44h56M22 8v56M42 8v56" stroke="#64748b" stroke-width="2"/>' },
  { id: "water", name: "Agua", category: "terreno", tags: "agua rio lago mar", draw: '<rect y="8" width="64" height="56" rx="4" fill="#38bdf8"/><path d="M4 26q8-6 16 0t16 0 16 0" stroke="#bae6fd" stroke-width="3" fill="none"/><path d="M4 42q8-6 16 0t16 0 16 0" stroke="#0284c7" stroke-width="3" fill="none"/>' },
  { id: "lava", name: "Lava", category: "terreno", tags: "lava fuego volcan peligro", draw: '<rect y="8" width="64" height="56" rx="4" fill="#f97316"/><circle cx="20" cy="30" r="5" fill="#facc15"/><path d="M8 46q10-8 20 0t20 0" stroke="#b91c1c" stroke-width="4" fill="none"/><circle cx="46" cy="22" r="3" fill="#fde047"/>' },
  { id: "sand", name: "Arena", category: "terreno", tags: "arena desierto playa", draw: '<rect y="8" width="64" height="56" rx="4" fill="#fcd34d"/><circle cx="16" cy="24" r="2" fill="#f59e0b"/><circle cx="44" cy="40" r="2" fill="#f59e0b"/><path d="M4 50q10-5 20 0t20 0" stroke="#fbbf24" stroke-width="3" fill="none"/>' },
  { id: "snow", name: "Nieve", category: "terreno", tags: "nieve hielo frio invierno", draw: '<rect y="8" width="64" height="56" rx="4" fill="#e2e8f0"/><path d="M4 34q10-6 20 0t20 0 16 0" stroke="#ffffff" stroke-width="4" fill="none"/><circle cx="22" cy="20" r="2" fill="#cbd5e1"/>' },
  // Naturaleza
  { id: "tree", name: "Árbol", category: "naturaleza", tags: "arbol bosque madera", span: 2, draw: '<rect x="28" y="34" width="8" height="20" rx="2" fill="#8b5e34"/><circle cx="32" cy="26" r="16" fill="#22c55e"/><circle cx="22" cy="30" r="10" fill="#16a34a"/><circle cx="42" cy="30" r="10" fill="#16a34a"/>' },
  { id: "pine", name: "Pino", category: "naturaleza", tags: "pino arbol conifera bosque", span: 2, draw: '<rect x="29" y="44" width="6" height="14" fill="#8b5e34"/><path d="M32 6l14 20H18z" fill="#15803d"/><path d="M32 22l16 22H16z" fill="#16a34a"/>' },
  { id: "bush", name: "Arbusto", category: "naturaleza", tags: "arbusto mata hoja", draw: '<circle cx="24" cy="40" r="12" fill="#22c55e"/><circle cx="40" cy="40" r="12" fill="#16a34a"/><circle cx="32" cy="32" r="13" fill="#4ade80"/>' },
  { id: "flower", name: "Flor", category: "naturaleza", tags: "flor planta decoracion", draw: '<path d="M32 34v22" stroke="#16a34a" stroke-width="4"/><circle cx="32" cy="26" r="6" fill="#f472b6"/><circle cx="22" cy="32" r="5" fill="#f9a8d4"/><circle cx="42" cy="32" r="5" fill="#f9a8d4"/><circle cx="32" cy="16" r="5" fill="#f9a8d4"/><circle cx="32" cy="26" r="3" fill="#facc15"/>' },
  { id: "rock", name: "Piedra", category: "naturaleza", tags: "roca piedra mineral", draw: '<path d="M12 52l6-20 14-12 16 10 4 22z" fill="#94a3b8"/><path d="M26 32l6-12 12 8z" fill="#cbd5e1"/>' },
  { id: "cactus", name: "Cacto", category: "naturaleza", tags: "cacto desierto planta", draw: '<rect x="28" y="16" width="10" height="40" rx="5" fill="#16a34a"/><rect x="14" y="30" width="12" height="8" rx="4" fill="#15803d"/><rect x="14" y="22" width="8" height="16" rx="4" fill="#15803d"/><rect x="40" y="26" width="8" height="16" rx="4" fill="#15803d"/>' },
  { id: "mushroom", name: "Hongo", category: "naturaleza", tags: "hongo seta bosque", draw: '<rect x="28" y="34" width="8" height="18" rx="3" fill="#fef3c7"/><path d="M10 34a22 16 0 0 1 44 0z" fill="#ef4444"/><circle cx="24" cy="26" r="3" fill="#fef3c7"/><circle cx="40" cy="24" r="3" fill="#fef3c7"/>' },
  // Estructuras
  { id: "house", name: "Casa", category: "estructuras", tags: "casa pueblo edificio aldea", span: 2, draw: '<rect x="14" y="30" width="36" height="26" fill="#fcd9b6"/><path d="M8 32L32 10l24 22z" fill="#dc2626"/><rect x="27" y="40" width="10" height="16" fill="#92400e"/><rect x="18" y="36" width="7" height="7" fill="#7dd3fc"/><rect x="39" y="36" width="7" height="7" fill="#7dd3fc"/>' },
  { id: "castle", name: "Castillo", category: "estructuras", tags: "castillo torre reino fortaleza", span: 3, draw: '<rect x="14" y="24" width="36" height="34" fill="#cbd5e1"/><rect x="10" y="18" width="10" height="40" fill="#94a3b8"/><rect x="44" y="18" width="10" height="40" fill="#94a3b8"/><rect x="10" y="10" width="6" height="8" fill="#64748b"/><rect x="48" y="10" width="6" height="8" fill="#64748b"/><path d="M28 58V46a4 4 0 0 1 8 0v12z" fill="#7c3f13"/><path d="M32 12V2" stroke="#475569" stroke-width="2"/><path d="M32 2h10l-3 4 3 4H32z" fill="#ef4444"/>' },
  { id: "door", name: "Puerta", category: "estructuras", tags: "puerta entrada madera", draw: '<rect x="16" y="10" width="32" height="46" rx="3" fill="#92400e"/><rect x="22" y="16" width="20" height="34" fill="#b45309"/><circle cx="40" cy="34" r="2.5" fill="#facc15"/>' },
  { id: "fence", name: "Cerca", category: "estructuras", tags: "cerca valla madera", draw: '<rect x="10" y="18" width="6" height="38" fill="#b45309"/><rect x="48" y="18" width="6" height="38" fill="#b45309"/><rect x="8" y="24" width="48" height="5" fill="#d97706"/><rect x="8" y="40" width="48" height="5" fill="#d97706"/>' },
  { id: "bridge", name: "Puente", category: "estructuras", tags: "puente madera paso rio", span: 2, draw: '<rect x="4" y="26" width="56" height="12" rx="2" fill="#b45309"/><path d="M8 26v20M20 26v20M32 26v20M44 26v20M56 26v20" stroke="#92400e" stroke-width="3"/>' },
  { id: "chest", name: "Cofre", category: "estructuras", tags: "cofre tesoro botin", draw: '<rect x="10" y="28" width="44" height="26" rx="3" fill="#b45309"/><path d="M10 28a22 12 0 0 1 44 0z" fill="#d97706"/><rect x="28" y="34" width="8" height="12" rx="2" fill="#facc15"/>' },
  { id: "barrel", name: "Barril", category: "estructuras", tags: "barril madera contenedor", draw: '<rect x="18" y="10" width="28" height="44" rx="6" fill="#b45309"/><path d="M18 20h28M18 44h28" stroke="#92400e" stroke-width="4"/><path d="M32 10v44" stroke="#d97706" stroke-width="2"/>' },
  { id: "crate", name: "Caja", category: "estructuras", tags: "caja madera cajon", draw: '<rect x="12" y="12" width="40" height="40" rx="3" fill="#d97706"/><path d="M12 12l40 40M52 12L12 52" stroke="#92400e" stroke-width="4"/>' },
  { id: "sign", name: "Cartel", category: "estructuras", tags: "cartel letrero aviso", draw: '<rect x="30" y="34" width="5" height="24" fill="#8b5e34"/><rect x="8" y="14" width="48" height="22" rx="4" fill="#b45309"/><path d="M14 25h36" stroke="#fde68a" stroke-width="3"/>' },
  { id: "torch", name: "Antorcha", category: "estructuras", tags: "antorcha fuego luz", draw: '<rect x="30" y="30" width="5" height="28" fill="#8b5e34"/><path d="M32 6c6 8 8 10 8 16a8 8 0 0 1-16 0c0-6 2-8 8-16z" fill="#f97316"/><path d="M32 16c3 4 4 5 4 8a4 4 0 0 1-8 0c0-3 1-4 4-8z" fill="#facc15"/>' },
  { id: "campfire", name: "Hoguera", category: "estructuras", tags: "hoguera fuego campamento", draw: '<path d="M14 50l36-12M50 50L14 38" stroke="#92400e" stroke-width="6"/><path d="M32 12c7 9 9 12 9 19a9 9 0 0 1-18 0c0-7 2-10 9-19z" fill="#f97316"/><path d="M32 24c3.5 5 4.5 6 4.5 9.5a4.5 4.5 0 0 1-9 0c0-3.5 1-4.5 4.5-9.5z" fill="#fde047"/>' },
  { id: "well", name: "Pozo", category: "estructuras", tags: "pozo agua aldea", draw: '<rect x="14" y="34" width="36" height="20" rx="3" fill="#94a3b8"/><rect x="18" y="30" width="28" height="8" rx="2" fill="#64748b"/><path d="M18 10h28l4 20H14z" fill="#dc2626"/><rect x="16" y="10" width="4" height="22" fill="#8b5e34"/><rect x="44" y="10" width="4" height="22" fill="#8b5e34"/>' },
  { id: "stairs", name: "Escaleras", category: "estructuras", tags: "escaleras subida piedra", draw: '<path d="M10 54h12V42h12V30h12V18h12V6" stroke="#94a3b8" stroke-width="8" fill="none"/>' },
  { id: "ladder", name: "Escalera", category: "estructuras", tags: "escalera mano madera subir", draw: '<rect x="16" y="6" width="6" height="52" fill="#b45309"/><rect x="42" y="6" width="6" height="52" fill="#b45309"/><path d="M22 18h20M22 32h20M22 46h20" stroke="#d97706" stroke-width="5"/>' },
  { id: "platform", name: "Plataforma", category: "estructuras", tags: "plataforma madera salto", span: 2, draw: '<rect x="4" y="24" width="56" height="16" rx="4" fill="#b45309"/><rect x="4" y="24" width="56" height="6" rx="2" fill="#d97706"/>' },
  { id: "brick", name: "Ladrillo", category: "estructuras", tags: "ladrillo bloque muro", draw: '<rect x="4" y="12" width="56" height="40" rx="3" fill="#ea580c"/><path d="M4 26h56M4 40h56M22 12v14M42 12v14M14 26v14M34 26v14" stroke="#9a3412" stroke-width="3"/>' },
  // Personajes
  { id: "hero", name: "Héroe", category: "personajes", tags: "heroe caballero jugador personaje", draw: '<circle cx="32" cy="20" r="9" fill="#fcd9b6"/><path d="M23 18a9 9 0 0 1 18 0z" fill="#64748b"/><rect x="22" y="30" width="20" height="22" rx="4" fill="#3b82f6"/><rect x="22" y="52" width="8" height="8" fill="#1e293b"/><rect x="34" y="52" width="8" height="8" fill="#1e293b"/><rect x="44" y="32" width="5" height="18" rx="2" fill="#cbd5e1"/>' },
  { id: "mage", name: "Mago", category: "personajes", tags: "mago hechicero personaje magia", draw: '<circle cx="32" cy="22" r="8" fill="#fcd9b6"/><path d="M18 24L32 4l14 20z" fill="#7c3aed"/><rect x="16" y="20" width="32" height="4" rx="2" fill="#6d28d9"/><rect x="22" y="32" width="20" height="22" rx="4" fill="#a855f7"/><circle cx="46" cy="30" r="5" fill="#38bdf8"/>' },
  { id: "villager", name: "Aldeano", category: "personajes", tags: "aldeano npc personaje gente", draw: '<circle cx="32" cy="20" r="9" fill="#f5d0a9"/><path d="M22 18a10 6 0 0 1 20 0z" fill="#a16207"/><rect x="22" y="30" width="20" height="22" rx="4" fill="#a16207"/>' },
  { id: "archer", name: "Arquera", category: "personajes", tags: "arquero arco personaje", draw: '<circle cx="32" cy="20" r="8" fill="#f5d0a9"/><rect x="24" y="12" width="16" height="6" rx="3" fill="#15803d"/><rect x="22" y="30" width="20" height="22" rx="4" fill="#16a34a"/><path d="M50 16a20 20 0 0 0 0 28" stroke="#8b5e34" stroke-width="4" fill="none"/>' },
  // Enemigos
  { id: "slime", name: "Limo", category: "enemigos", tags: "limo slime enemigo verde", draw: '<path d="M12 48a20 20 0 0 1 40 0z" fill="#4ade80"/><circle cx="24" cy="38" r="3.5" fill="#0f172a"/><circle cx="40" cy="38" r="3.5" fill="#0f172a"/><path d="M26 46q6 4 12 0" stroke="#15803d" stroke-width="3" fill="none"/>' },
  { id: "goblin", name: "Goblin", category: "enemigos", tags: "goblin enemigo verde", draw: '<path d="M20 20l-8-6 10 2zM44 20l8-6-10 2z" fill="#4d7c0f"/><circle cx="32" cy="24" r="11" fill="#65a30d"/><circle cx="27" cy="24" r="2.5" fill="#1e293b"/><circle cx="37" cy="24" r="2.5" fill="#1e293b"/><rect x="22" y="36" width="20" height="20" rx="4" fill="#b45309"/>' },
  { id: "skeleton", name: "Esqueleto", category: "enemigos", tags: "esqueleto hueso enemigo", draw: '<circle cx="32" cy="20" r="10" fill="#f1f5f9"/><circle cx="28" cy="19" r="3" fill="#1e293b"/><circle cx="36" cy="19" r="3" fill="#1e293b"/><rect x="24" y="30" width="16" height="6" fill="#e2e8f0"/><rect x="30" y="36" width="4" height="18" fill="#e2e8f0"/><rect x="18" y="38" width="14" height="4" fill="#e2e8f0"/><rect x="32" y="38" width="14" height="4" fill="#e2e8f0"/>' },
  { id: "bat", name: "Murciélago", category: "enemigos", tags: "murcielago enemigo cueva", draw: '<path d="M24 28L6 18l6 16-6 12 24-8z" fill="#5b21b6"/><path d="M40 28l18-10-6 16 6 12-24-8z" fill="#5b21b6"/><circle cx="32" cy="32" r="8" fill="#4c1d95"/><circle cx="29" cy="31" r="2" fill="#fca5a5"/><circle cx="35" cy="31" r="2" fill="#fca5a5"/>' },
  { id: "ghost", name: "Fantasma", category: "enemigos", tags: "fantasma espiritu enemigo", draw: '<path d="M14 52V30a18 18 0 0 1 36 0v22l-6-6-6 6-6-6-6 6-6-6z" fill="#e2e8f0"/><circle cx="26" cy="30" r="3" fill="#1e293b"/><circle cx="38" cy="30" r="3" fill="#1e293b"/>' },
  { id: "spider", name: "Araña", category: "enemigos", tags: "araña enemigo bosque", draw: '<path d="M20 30L4 20M20 38L2 40M44 30l16-10M44 38l18 2" stroke="#1f2937" stroke-width="4"/><circle cx="32" cy="34" r="12" fill="#1f2937"/><circle cx="32" cy="24" r="7" fill="#374151"/><circle cx="29" cy="23" r="2" fill="#ef4444"/><circle cx="35" cy="23" r="2" fill="#ef4444"/>' },
  { id: "wolf", name: "Lobo", category: "enemigos", tags: "lobo animal enemigo", draw: '<path d="M8 44l6-18 10-10 8 6 8-6 10 10 6 18z" fill="#64748b"/><path d="M22 22l-4-10 8 4zM42 22l4-10-8 4z" fill="#475569"/><circle cx="26" cy="34" r="2.5" fill="#fde047"/><circle cx="38" cy="34" r="2.5" fill="#fde047"/><path d="M28 42h8l-4 5z" fill="#1e293b"/>' },
  { id: "dragon", name: "Dragón", category: "enemigos", tags: "dragon jefe boss enemigo", span: 2, draw: '<path d="M10 40q0-22 24-22t24 22q-10 12-24 12T10 40z" fill="#16a34a"/><path d="M18 18l-6-12 12 6zM46 18l6-12-12 6z" fill="#065f46"/><circle cx="24" cy="34" r="3" fill="#fde047"/><circle cx="40" cy="34" r="3" fill="#fde047"/><path d="M22 46q10 8 20 0" stroke="#065f46" stroke-width="3" fill="none"/>' },
  // Objetos
  { id: "coin", name: "Moneda", category: "objetos", tags: "moneda oro coleccionable", draw: '<circle cx="32" cy="32" r="20" fill="#facc15"/><circle cx="32" cy="32" r="14" fill="#fbbf24"/><path d="M32 20v24M24 32h16" stroke="#b45309" stroke-width="4"/>' },
  { id: "gem", name: "Gema", category: "objetos", tags: "gema diamante tesoro", draw: '<path d="M32 6l20 16-20 36L12 22z" fill="#38bdf8"/><path d="M32 6l20 16H12z" fill="#7dd3fc"/>' },
  { id: "key", name: "Llave", category: "objetos", tags: "llave puerta tesoro", draw: '<circle cx="20" cy="20" r="11" fill="none" stroke="#facc15" stroke-width="7"/><path d="M28 28l24 24M44 44l-6 6M36 36l-6 6" stroke="#facc15" stroke-width="7" stroke-linecap="round"/>' },
  { id: "potion_red", name: "Poción roja", category: "objetos", tags: "pocion vida cura objeto", draw: '<rect x="26" y="8" width="12" height="10" rx="2" fill="#94a3b8"/><path d="M22 22h20l6 18a16 16 0 0 1-32 0z" fill="#ef4444"/><path d="M14 36h36" stroke="#b91c1c" stroke-width="3"/>' },
  { id: "potion_blue", name: "Poción azul", category: "objetos", tags: "pocion mana magia objeto", draw: '<rect x="26" y="8" width="12" height="10" rx="2" fill="#94a3b8"/><path d="M22 22h20l6 18a16 16 0 0 1-32 0z" fill="#3b82f6"/><path d="M14 36h36" stroke="#1d4ed8" stroke-width="3"/>' },
  { id: "sword", name: "Espada", category: "objetos", tags: "espada arma filo", draw: '<path d="M32 4l6 8v28h-12V12z" fill="#cbd5e1"/><rect x="20" y="40" width="24" height="6" rx="3" fill="#b45309"/><rect x="29" y="46" width="6" height="14" rx="2" fill="#92400e"/>' },
  { id: "shield", name: "Escudo", category: "objetos", tags: "escudo defensa armadura", draw: '<path d="M32 6l22 8v18c0 14-10 22-22 26-12-4-22-12-22-26V14z" fill="#3b82f6"/><path d="M32 16l10 4v10c0 8-5 12-10 15-5-3-10-7-10-15V20z" fill="#93c5fd"/>' },
  { id: "heart", name: "Corazón", category: "objetos", tags: "corazon vida salud", draw: '<path d="M32 54S8 40 8 24a12 12 0 0 1 24-4 12 12 0 0 1 24 4c0 16-24 30-24 30z" fill="#ef4444"/>' },
  { id: "star", name: "Estrella", category: "objetos", tags: "estrella premio puntaje", draw: '<path d="M32 6l8 18 20 2-15 13 4 19-17-10-17 10 4-19L4 26l20-2z" fill="#facc15"/>' },
  // Peligros
  { id: "spike", name: "Pinchos", category: "peligros", tags: "pinchos trampa peligro", genres: ["platformer"], draw: '<path d="M8 56l8-24 8 24zM24 56l8-24 8 24zM40 56l8-24 8 24z" fill="#cbd5e1"/>' },
  { id: "bomb", name: "Bomba", category: "peligros", tags: "bomba explosion peligro", draw: '<circle cx="30" cy="38" r="18" fill="#1f2937"/><path d="M42 22l8-8M50 14l4 4" stroke="#b45309" stroke-width="4"/><circle cx="48" cy="10" r="4" fill="#f97316"/>' },
  { id: "danger", name: "Aviso", category: "peligros", tags: "aviso alerta peligro", draw: '<path d="M32 8l26 46H6z" fill="#facc15"/><rect x="29" y="24" width="6" height="14" rx="3" fill="#1f2937"/><circle cx="32" cy="45" r="3.5" fill="#1f2937"/>' },
  // Marcadores
  { id: "flag", name: "Meta", category: "marcadores", tags: "meta bandera final nivel", draw: '<rect x="16" y="8" width="5" height="48" rx="2" fill="#94a3b8"/><path d="M21 12h30l-8 10 8 10H21z" fill="#22c55e"/>' },
  { id: "checkpoint", name: "Punto de control", category: "marcadores", tags: "checkpoint control bandera", draw: '<rect x="30" y="26" width="5" height="30" fill="#94a3b8"/><circle cx="32" cy="16" r="10" fill="#38bdf8"/><circle cx="32" cy="16" r="5" fill="#e0f2fe"/>' },
  { id: "spawn", name: "Inicio", category: "marcadores", tags: "inicio spawn salida jugador", draw: '<circle cx="32" cy="32" r="20" fill="none" stroke="#2563eb" stroke-width="4" stroke-dasharray="6 6"/><path d="M32 20v24M20 32h24" stroke="#2563eb" stroke-width="5"/>' },
  { id: "arrow", name: "Flecha", category: "marcadores", tags: "flecha direccion guia", draw: '<path d="M12 24h24V8l20 24-20 24V40H12z" fill="#f59e0b"/>' },
  // Efectos
  { id: "cloud", name: "Nube", category: "efectos", tags: "nube cielo clima", span: 2, draw: '<ellipse cx="24" cy="34" rx="16" ry="12" fill="#f8fafc"/><ellipse cx="42" cy="34" rx="14" ry="10" fill="#f1f5f9"/><ellipse cx="33" cy="26" rx="14" ry="11" fill="#ffffff"/>' },
  { id: "smoke", name: "Humo", category: "efectos", tags: "humo vapor efecto", draw: '<circle cx="22" cy="42" r="12" fill="#cbd5e1" opacity="0.9"/><circle cx="40" cy="36" r="14" fill="#e2e8f0" opacity="0.9"/><circle cx="32" cy="24" r="10" fill="#f1f5f9" opacity="0.9"/>' },
  { id: "sparkle", name: "Destello", category: "efectos", tags: "destello brillo magia", draw: '<path d="M32 6l5 16 16 5-16 5-5 16-5-16-16-5 16-5z" fill="#fde047"/>' },
];

const SVG_HEAD = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">';

function svgUrl(draw: string) {
  return `data:image/svg+xml,${encodeURIComponent(`${SVG_HEAD}${draw}</svg>`)}`;
}

/** Biblioteca incluida en el motor: siempre disponible, sin conexión. */
export const ENGINE_ASSETS: LibraryAsset[] = SPRITES.map((s) => ({
  id: `engine:${s.id}`,
  name: s.name,
  category: s.category,
  tags: s.tags.split(" "),
  url: svgUrl(s.draw),
  source: "engine",
  span: s.span ?? 1,
  genres: s.genres,
}));

/** Filtra la biblioteca del motor por género, categoría y texto. */
export function filterEngineAssets(
  genre: MapGenre,
  category: string,
  query: string,
): LibraryAsset[] {
  const q = query.trim().toLowerCase();
  return ENGINE_ASSETS.filter((a) => {
    if (a.genres && !a.genres.includes(genre)) return false;
    if (category !== "todas" && a.category !== category) return false;
    if (!q) return true;
    return (
      a.name.toLowerCase().includes(q) ||
      a.category.includes(q) ||
      a.tags.some((t) => t.includes(q))
    );
  });
}

// ============================================================
// CONEXIÓN CON GOOGLE (claves guardadas en el dispositivo)
// ============================================================
const CONFIG_KEY = "asternal_assets_config";
const CACHE_KEY = "asternal_assets_cache";
const CACHE_LIMIT = 240;

/** Proveedor de la búsqueda de imágenes de Google. */
export type GoogleProvider = "google" | "serpapi";

export interface AssetsConfig {
  provider: GoogleProvider;
  /** Clave de API de Google Cloud (Programmable Search + Drive). */
  googleApiKey: string;
  /** Id del motor de búsqueda programable (cx). */
  googleCx: string;
  /** Carpeta pública de Google Drive con los assets del proyecto. */
  driveFolderId: string;
  /** Clave de SerpAPI (alternativa con una sola clave). */
  serpApiKey: string;
}

export const EMPTY_ASSETS_CONFIG: AssetsConfig = {
  provider: "google",
  googleApiKey: "",
  googleCx: "",
  driveFolderId: "",
  serpApiKey: "",
};

function readJSON<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return { ...fallback, ...(JSON.parse(raw) as object) } as T;
  } catch {
    return fallback;
  }
}

export function loadAssetsConfig(): AssetsConfig {
  return readJSON<AssetsConfig>(CONFIG_KEY, EMPTY_ASSETS_CONFIG);
}

export function saveAssetsConfig(config: AssetsConfig) {
  try {
    window.localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
  } catch {
    /* almacenamiento no disponible */
  }
}

/** ¿Hay credenciales para buscar imágenes de Google? */
export function hasGoogleImages(config: AssetsConfig) {
  if (config.provider === "serpapi") return config.serpApiKey.trim().length > 0;
  return config.googleApiKey.trim().length > 0 && config.googleCx.trim().length > 0;
}

/** ¿Hay credenciales para listar una carpeta de Drive? */
export function hasDriveLibrary(config: AssetsConfig) {
  return config.googleApiKey.trim().length > 0 && config.driveFolderId.trim().length > 0;
}

/** Assets externos guardados (para no perder lo que ya trajiste de Google). */
export function getCachedAssets(): LibraryAsset[] {
  try {
    const raw = window.localStorage.getItem(CACHE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as LibraryAsset[]) : [];
  } catch {
    return [];
  }
}

/** Guarda (sin duplicados) los assets externos usados en la biblioteca local. */
export function cacheAssets(incoming: LibraryAsset[]) {
  if (incoming.length === 0) return;
  try {
    const current = getCachedAssets();
    const seen = new Set(current.map((a) => a.id));
    const merged = [...current];
    for (const asset of incoming) {
      if (seen.has(asset.id)) continue;
      seen.add(asset.id);
      merged.push({ ...asset, thumb: asset.thumb ?? asset.url });
    }
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(merged.slice(-CACHE_LIMIT)));
  } catch {
    /* sin espacio: la caché es opcional */
  }
}

export function clearCachedAssets() {
  try {
    window.localStorage.removeItem(CACHE_KEY);
  } catch {
    /* nada que limpiar */
  }
}
