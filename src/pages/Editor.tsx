// Ruta /editor — apartado principal: Editor de Escenas (Asternal)
import { useNavigate } from "@/lib/router-compat";
import SceneEditorPage from "./SceneEditorPage";

export default function EditorPage() {
  const navigate = useNavigate();

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden bg-slate-100 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-4 dark:bg-slate-950">
      <SceneEditorPage onBack={() => navigate("/dashboard")} />
    </div>
  );
}
