import { Link } from "react-router-dom";
import { Compass } from "lucide-react";
import Button from "../components/common/Button";

export default function NotFound() {
  return (
    <div className="empty-state" style={{ minHeight: "60vh" }}>
      <div className="es-icon"><Compass size={30} /></div>
      <div className="es-title" style={{ fontSize: 40 }}>404</div>
      <div className="es-title">Page not found</div>
      <div className="es-sub">The page you're looking for doesn't exist or may have been moved.</div>
      <Link to="/dashboard"><Button>Back to Dashboard</Button></Link>
    </div>
  );
}
