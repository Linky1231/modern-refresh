import { useNavigate } from "@/lib/router-compat";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export default function EditorPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background px-4 py-10">
      <Button
        variant="outline"
        size="sm"
        className="mb-6"
        onClick={() => navigate(-1)}
      >
        <ArrowLeft className="h-4 w-4 mr-2" />
        Volver
      </Button>

      <div className="mx-auto max-w-2xl text-center">
        <h1 className="text-2xl font-bold">Editor de juegos</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Este editor está en construcción. Cuando esté listo, podrás crearlo
          desde aquí.
        </p>
      </div>
    </div>
  );
}
