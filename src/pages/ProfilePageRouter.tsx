// Profile routes handled by the Dashboard shell; redirect anything else
// that might hit `/profile/*` to the dashboard.
import { Navigate } from "react-router";

export default function ProfilePageRouter() {
  return <Navigate to="/dashboard" replace />;
}
