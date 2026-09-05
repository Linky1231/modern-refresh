import { useState, useCallback, useRef } from "react";
import { motion } from "framer-motion";
import { Upload, Image as ImageIcon, Film, File, X, Check, FolderOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

// Keep asset types aligned with the rest of the app media handling.
const ACCEPTED_IMAGES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/bmp",
  "image/svg+xml",
];
const ACCEPTED_VIDEO = [
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "video/x-msvideo",
  "video/x-matroska",
  "video/x-flv",
  "video/3gpp",
  "video/mpeg",
  "video/ogg",
];
const ACCEPTED_DOCS = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain",
  "text/csv",
  "application/zip",
  "application/x-rar-compressed",
  "application/json",
];
const ACCEPTED_ALL = [...ACCEPTED_IMAGES, ...ACCEPTED_VIDEO, ...ACCEPTED_DOCS];

const MAX_IMAGE_MB = 10;
const MAX_VIDEO_MB = 50;

export interface EditorAsset {
  id: string;
  name: string;
  type: "image" | "video" | "doc";
  preview: string;
  size: number;
  url: string;
}

function mimeCategory(mime: string): "image" | "video" | "doc" {
  if (ACCEPTED_IMAGES.includes(mime)) return "image";
  if (ACCEPTED_VIDEO.includes(mime)) return "video";
  return "doc";
}

function previewFor(type: "image" | "video" | "doc", url: string, name: string, size: number) {
  if (type === "image") return url;
  if (type === "video") return url;
  return "";
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export default function AssetsScreen() {
  const [assets, setAssets] = useState<EditorAsset[]>([]);
  const [dragging, setDragging] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const markSelected = useCallback((id: string, current: Set<string>) => {
    const next = new Set(current);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  }, []);

  const selectMany = useCallback((ids: string[]) => {
    setSelectedIds(new Set(ids));
  }, []);

  const toggleSelectAll = useCallback(() => {
    if (assets.length === 0) return;
    const allSelected = assets.every((a) => selectedIds.has(a.id));
    setSelectedIds(allSelected ? new Set() : new Set(assets.map((a) => a.id)));
  }, [assets, selectedIds]);

  const handleFiles = useCallback(
    async (files: FileList | File[]) => {
      const incoming = Array.from(files);
      if (incoming.length === 0) return;

      const validated: File[] = [];
      for (const file of incoming) {
        if (!ACCEPTED_ALL.includes(file.type)) {
          toast.error(`${file.name} no es un tipo de recurso válido`);
          continue;
        }
        if (file.size > MAX_VIDEO_MB * 1024 * 1024) {
          toast.error(`${file.name} es demasiado grande (límite ${MAX_VIDEO_MB} MB)`);
          continue;
        }
        validated.push(file);
      }

      if (validated.length === 0) return;
      setUploading(true);

      const created: EditorAsset[] = [];
      for (const file of validated) {
        const id = crypto.randomUUID();
        const url = URL.createObjectURL(file);
        const category = mimeCategory(file.type);
        created.push({
          id,
          name: file.name,
          type: category,
          preview: previewFor(category, url, file.name, file.size),
          size: file.size,
          url,
        });
      }

      setAssets((prev) => [...prev, ...created]);
      setSelectedIds(new Set(created.map((a) => a.id)));
      setUploading(false);
      toast.success(`${created.length} recurso(s) listo(s)`);
    },
    [],
  );

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(true);
  }, []);

  const onDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        handleFiles(e.dataTransfer.files);
      }
    },
    [handleFiles],
  );

  const onInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
        handleFiles(e.target.files);
      }
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    },
    [handleFiles],
  );

  const removeAsset = useCallback((id: string) => {
    setAssets((prev) => {
      const asset = prev.find((a) => a.id === id);
      if (asset && asset.url.startsWith("blob:")) {
        URL.revokeObjectURL(asset.url);
      }
      return prev.filter((a) => a.id !== id);
    });
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, []);

  const images = assets.filter((a) => a.type === "image");
  const videos = assets.filter((a) => a.type === "video");
  const docs = assets.filter((a) => a.type === "doc");

  const clearSelections = () => setSelectedIds(new Set());

  return (
    <div className="min-h-screen bg-background">
      <div className="flex min-h-0 flex-1 flex-col">
        <header className="border-b border-border/40 bg-card/50 px-5 py-4">
          <div className="mx-auto flex max-w-5xl items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <FolderOpen className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-base font-semibold tracking-tight text-foreground">
                  Activos
                </h1>
                <p className="text-[11px] text-muted-foreground">
                  Añade imágenes, vídeos y archivos para tu juego
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={toggleSelectAll}>
                {assets.length === 0 ? "Seleccionar todo" : selectedIds.size === assets.length ? "Deseleccionar todo" : "Seleccionar todo"}
              </Button>
              <Button size="sm" onClick={() => fileInputRef.current?.click()}>
                <Upload className="h-4 w-4" />
                Subir
              </Button>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-auto px-5 py-5">
          <div className="mx-auto max-w-5xl">
            {/* Drop zone */}
            <motion.div
              className={cn(
                "group relative flex w-full cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-12 transition-colors",
                dragging
                  ? "border-primary/60 bg-primary/[0.04]"
                  : "border-border/40 bg-muted/30 hover:border-primary/30 hover:bg-muted/50"
              )}
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              onDrop={onDrop}
              onClick={() => fileInputRef.current?.click()}
              whileHover={{ scale: 1.002 }}
              whileTap={{ scale: 0.998 }}
              transition={{ type: "spring", stiffness: 400, damping: 22 }}
            >
              {dragging && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="absolute inset-0 flex items-center justify-center rounded-2xl bg-primary/60 backdrop-blur-sm"
                >
                  <div className="flex flex-col items-center gap-2 text-primary">
                    <Upload className="h-9 w-9" />
                    <p className="text-sm font-semibold">Suelta los archivos aquí</p>
                  </div>
                </motion.div>
              )}
              <div className="relative flex flex-col items-center gap-3 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Upload className="h-7 w-7" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    Arrastra tus archivos aquí o pulsa para subir
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Imágenes, vídeos y documentos compatibles
                  </p>
                </div>
                <div className="flex flex-wrap items-center justify-center gap-2 text-[11px] text-muted-foreground">
                  <span className="flex items-center gap-1 rounded-full bg-muted px-2.5 py-1">
                    <ImageIcon className="h-3.5 w-3.5" /> Imágenes
                  </span>
                  <span className="flex items-center gap-1 rounded-full bg-muted px-2.5 py-1">
                    <Film className="h-3.5 w-3.5" /> Vídeos
                  </span>
                  <span className="flex items-center gap-1 rounded-full bg-muted px-2.5 py-1">
                    <File className="h-3.5 w-3.5" /> Documentos
                  </span>
                </div>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept={ACCEPTED_ALL.join(",")}
                onChange={onInputChange}
                className="absolute inset-0 h-full w-full opacity-0 cursor-pointer"
                aria-label="Subir activos"
              />
            </motion.div>

            {/* Empty state when no assets */}
            {assets.length === 0 && (
              <motion.p
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-6 text-center text-sm text-muted-foreground"
              >
                No hay activos todavía. Empieza subiendo los recursos de tu juego.
              </motion.p>
            )}

            {/* Asset buckets */}
            {assets.length > 0 && (
              <div className="mt-6 space-y-6">
                {/* Selected count */}
                {selectedIds.size > 0 && (
                  <div className="flex items-center gap-2 rounded-xl border border-border/30 bg-muted/40 px-4 py-2.5 text-sm">
                    <Check className="h-4 w-4 text-primary" />
                    <span className="font-medium text-foreground">
                      {selectedIds.size} seleccionado(s)
                    </span>
                    <button
                      type="button"
                      className="ml-auto text-xs text-muted-foreground underline hover:text-primary"
                      onClick={clearSelections}
                    >
                      Limpiar
                    </button>
                  </div>
                )}

                {images.length > 0 && (
                  <AssetsBucket
                    label="Imágenes"
                    icon={<ImageIcon className="h-4 w-4" />}
                    assets={images}
                    selectedIds={selectedIds}
                    onToggle={markSelected}
                    onRemove={removeAsset}
                    renderPreview={(asset) => (
                      <img src={asset.preview} alt={asset.name} className="h-full w-full object-cover" />
                    )}
                  />
                )}

                {videos.length > 0 && (
                  <AssetsBucket
                    label="Vídeos"
                    icon={<Film className="h-4 w-4" />}
                    assets={videos}
                    selectedIds={selectedIds}
                    onToggle={markSelected}
                    onRemove={removeAsset}
                    renderEntry={(asset) => (
                      <div className="flex flex-col gap-1.5">
                        <video
                          src={asset.url}
                          className="rounded-lg overflow-hidden max-h-28 w-full object-cover"
                          muted
                          preload="metadata"
                        />
                        <span className="truncate text-[11px] text-muted-foreground font-medium">{asset.name}</span>
                      </div>
                    )}
                  />
                )}

                {docs.length > 0 && (
                  <AssetsBucket
                    label="Documentos"
                    icon={<File className="h-4 w-4" />}
                    assets={docs}
                    selectedIds={selectedIds}
                    onToggle={markSelected}
                    onRemove={removeAsset}
                    renderEntry={(asset) => (
                      <div className="flex flex-col gap-1.5">
                        <div className="flex h-16 w-full items-center justify-center rounded-lg border border-border/30 bg-muted text-muted-foreground">
                          <File className="h-6 w-6" />
                        </div>
                        <span className="truncate text-[11px] text-muted-foreground font-medium">{asset.name}</span>
                        <span className="text-[10px] text-muted-foreground/70">{formatSize(asset.size)}</span>
                      </div>
                    )}
                  />
                )}
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

function AssetsBucket({
  label,
  icon,
  assets,
  selectedIds,
  onToggle,
  onRemove,
  renderPreview,
  renderEntry,
}: {
  label: string;
  icon: React.ReactNode;
  assets: EditorAsset[];
  selectedIds: Set<string>;
  onToggle: (id: string, current: Set<string>) => void;
  onRemove: (id: string) => void;
  renderPreview?: (asset: EditorAsset) => React.ReactNode;
  renderEntry?: (asset: EditorAsset) => React.ReactNode;
}) {
  const allSelected = assets.every((a) => selectedIds.has(a.id));

  const header = (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        {icon}
        <h2 className="text-sm font-semibold text-foreground">{label}</h2>
        <span className="text-xs text-muted-foreground">({assets.length})</span>
      </div>
      <button
        type="button"
        className={cn(
          "inline-flex h-7 items-center gap-1 rounded-md border px-2.5 text-[11px] font-medium transition-colors",
          allSelected
            ? "border-primary/40 bg-primary/5 text-primary"
            : "border-border/35 text-muted-foreground hover:border-primary/40 hover:text-primary"
        )}
        onClick={() => {
          if (allSelected) {
            selectedIds.forEach((id) => onToggle(id, selectedIds));
          } else {
            assets.forEach((a) => onToggle(a.id, selectedIds));
          }
        }}
      >
        {allSelected ? "Deseleccionar" : "Seleccionar todo"}
      </button>
    </div>
  );

  if (assets.length === 0) return null;

  return (
    <section className="rounded-2xl border border-border/30 bg-card/40 p-4">
      {header}
      <div className="mt-4 grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        {assets.map((asset) => {
          const selected = selectedIds.has(asset.id);
          return (
            <motion.div
              key={asset.id}
              className={cn(
                "group relative flex flex-col rounded-xl border bg-card/30 p-3 transition-colors",
                selected ? "border-primary/40 bg-primary/[0.04]" : "border-border/30 hover:border-primary/30"
              )}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.995 }}
              transition={{ type: "spring", stiffness: 400, damping: 22 }}
            >
              <button
                type="button"
                className="absolute right-2 top-2 rounded-md p-1 text-muted-foreground/60 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-destructive/10 hover:text-destructive"
                onClick={(e) => {
                  e.stopPropagation();
                  onRemove(asset.id);
                }}
                aria-label={`Eliminar ${asset.name}`}
              >
                <X className="h-3.5 w-3.5" />
              </button>
              <label
                className={cn(
                  "flex h-20 w-full cursor-pointer shrink-0 items-center justify-center rounded-lg border-2 border-transparent overflow-hidden transition-colors",
                  selected
                    ? "border-primary bg-primary/10"
                    : "border-border/30 group-hover:border-primary/40 group-hover:bg-muted/40"
                )}
                onClick={(e) => {
                  e.preventDefault();
                  onToggle(asset.id, selectedIds);
                }}
              >
                {renderPreview ? (
                  renderPreview(asset)
                ) : (
                  <div className="flex h-full w-full flex-col items-center justify-center text-muted-foreground">
                    {renderEntry ? renderEntry(asset) : <File className="h-6 w-6" />}
                  </div>
                )}
              </label>
              <div className="mt-2 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                <span className="truncate text-xs font-medium text-foreground">{asset.name}</span>
                <span className="shrink-0 text-[10px] text-muted-foreground/70">{formatSize(asset.size)}</span>
              </div>
              <div
                className={cn(
                  "mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded border border-transparent transition-colors",
                  selected
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border/30 bg-card text-muted-foreground opacity-0 group-hover:opacity-100"
                )}
              >
                <Check className="h-3 w-3" />
              </div>
            </motion.div>
          );
        })}
      </div>
    </section>
  );
}
