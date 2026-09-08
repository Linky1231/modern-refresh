// ▶ [MIGRACIÓN LOVABLE CLOUD] Wrapper fino — toda la UI pulida vive en ProfileLayout (reutilizable)
import { useAuth } from "@/hooks/use-auth";
import ProfileLayout from "@/components/ProfileLayout";

interface ProfilePageProps {
  onBack: () => void;
}

export default function ProfilePage({ onBack }: ProfilePageProps) {
  const { user } = useAuth();
  if (!user?._id) return null;
  // isOwnProfile = true siempre aquí (ruta /profile / Mi perfil)
  // ProfileLayout contiene: Banner azul suave, Avatar -mt-10, Bio condicional,
  // Tarjeta seguidores/siguiendo en T rounded-2xl, Publicaciones y menú Editar
  return (
    <ProfileLayout
      profileUserId={user._id}
      currentUserId={user._id}
      isOwnProfile={true}
      onBack={onBack}
      headerTitle="Mi perfil"
    />
  );
}
