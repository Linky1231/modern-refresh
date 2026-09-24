// Ruta /editor — apartado principal: Editor de Escenas (Asternal)
import { useNavigate } from "@/lib/router-compat";
import SceneEditorPage from "./SceneEditorPage";

export default function EditorPage() {
  const navigate = useNavigate();

  return (
    <div className="editor-surface flex h-[100dvh] flex-col overflow-hidden bg-muted px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-4">
      <SceneEditorPage onBack={() => navigate("/dashboard")} />
    </div>
  );
}
