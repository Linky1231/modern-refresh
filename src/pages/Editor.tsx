// Ruta /editor — apartado principal: Editor de Escenas (Asternal)
import { useNavigate } from "@/lib/router-compat";
import SceneEditorPage from "./SceneEditorPage";

export default function EditorPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-slate-100 px-4 pt-4 dark:bg-slate-950">
      <SceneEditorPage onBack={() => navigate("/dashboard")} />
    </div>
  );
}
