import { useState } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { Eye, EyeOff, Lock, Mail, Pill, ShieldCheck, BarChart3, PackageCheck } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { useToast } from "../contexts/ToastContext";
import { email, required, minLen, validate } from "../utils/validators";
import FloatingShapes from "../components/three/FloatingShapes";
import ParticleBackground from "../components/three/ParticleBackground";
import GlassOrb from "../components/three/GlassOrb";

export default function Login() {
  const { login, isAuthenticated } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const [form, setForm] = useState({ email: "", password: "" });
  const [errors, setErrors] = useState({});
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);

  if (isAuthenticated) return <Navigate to="/dashboard" replace />;

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    const errs = validate(
      {
        email: [required, email],
        password: [required, minLen(8)],
      },
      form
    );
    setErrors(errs);
    if (Object.keys(errs).length) return;

    setLoading(true);
    try {
      await login(form.email, form.password);
      toast.success("Welcome back", "Signed in successfully.");
      navigate("/dashboard");
    } catch (err) {
      setErrors({ form: err.message || "Unable to sign in." });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-shell">
      {/* Left: 3D pharmaceutical visual */}
      <div className="login-3d">
        <FloatingShapes count={8} />
        <ParticleBackground density={46} />
        <GlassOrb size={360} top="22%" left="28%" />
        <GlassOrb size={260} top="76%" left="74%" color="rgba(34,211,238,0.08)" />

        <div style={{ position: "relative", zIndex: 2 }}>
          <div className="flex gap-12" style={{ marginBottom: 40 }}>
            <div className="brand-logo"><Pill size={24} /></div>
            <div>
              <div className="brand-name" style={{ fontSize: 22 }}>PharmaStock</div>
              <div className="brand-sub">Medicine Stock Management &amp; Analytics Portal</div>
            </div>
          </div>

          <div className="scene">
            <div className="pill-3d" />
            <span className="molecule" style={{ width: 18, height: 18, top: "18%", left: "20%" }} />
            <span className="molecule" style={{ width: 12, height: 12, top: "30%", left: "72%" }} />
            <span className="molecule" style={{ width: 8, height: 8, top: "62%", left: "30%" }} />
            <span className="molecule" style={{ width: 22, height: 22, top: "70%", left: "66%" }} />
          </div>

          <div style={{ marginTop: 34, display: "flex", gap: 28, flexWrap: "wrap" }}>
            <Benefit icon={PackageCheck} title="Batch-wise tracking" sub="Full expiry & lot visibility" />
            <Benefit icon={BarChart3} title="Inventory analytics" sub="Data-driven stock decisions" />
            <Benefit icon={ShieldCheck} title="Role-based access" sub="Secure by design" />
          </div>
        </div>
      </div>

      {/* Right: Login form */}
      <div className="login-form-side">
        <div className="login-form-wrap">
          <div className="login-brand-row" style={{ display: "none" }} />
          <h1 className="login-title">Welcome back</h1>
          <p className="login-sub">Sign in to manage your pharmaceutical inventory dashboard.</p>

          {errors.form && (
            <div className="toast error" style={{ marginBottom: 16 }}>
              <span className="toast-error-icon"><Lock size={16} /></span>
              <span className="text-sm">{errors.form}</span>
            </div>
          )}

          <form onSubmit={submit} noValidate>
            <div className="field-group">
              <label className="field-label" htmlFor="email">Email address</label>
              <div className="search-input-wrap">
                <span className="search-icon"><Mail size={16} /></span>
                <input
                  id="email"
                  data-testid="login-email"
                  className={`form-input ${errors.email ? "error" : ""}`}
                  style={{ paddingLeft: 38 }}
                  type="email"
                  placeholder="admin@pharmastock.in"
                  value={form.email}
                  onChange={set("email")}
                  autoComplete="email"
                />
              </div>
              {errors.email && <span className="field-error">{errors.email}</span>}
            </div>

            <div className="field-group">
              <label className="field-label" htmlFor="password">Password</label>
              <div style={{ position: "relative" }}>
                <input
                  id="password"
                  data-testid="login-password"
                  className={`form-input ${errors.password ? "error" : ""}`}
                  type={showPass ? "text" : "password"}
                  placeholder="••••••••"
                  value={form.password}
                  onChange={set("password")}
                  autoComplete="current-password"
                  style={{ paddingRight: 42 }}
                />
                <button
                  type="button"
                  className="icon-btn"
                  style={{ position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)" }}
                  onClick={() => setShowPass((v) => !v)}
                  aria-label={showPass ? "Hide password" : "Show password"}
                >
                  {showPass ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
              {errors.password && <span className="field-error">{errors.password}</span>}
            </div>

            {/* No "Remember me" checkbox: the session token is held in localStorage for this
                academic build, so there is no separate persistence choice to make
                and offering one would imply a control that does not exist. */}
            <div className="flex-between" style={{ marginBottom: 22 }}>
              <a href="mailto:admin@pharmastock.in">Contact administrator</a>
            </div>

            <button data-testid="login-submit" className="btn btn-primary btn-lg btn-block" type="submit" disabled={loading}>
              {loading ? "Signing in..." : "Sign In"}
            </button>
          </form>

          <div className="divider" />

          <p className="muted text-sm" style={{ textAlign: "center", marginTop: 22 }}>
            Contact your administrator if you need access.
          </p>
          <p className="muted text-sm" style={{ textAlign: "center", marginTop: 8 }}>
            KL UNIVERSITY · Database Systems &amp; Distributed Backend Development
          </p>
          {/* Security posture is stated plainly rather than implied. A
              cookie-based session would be the production choice; see the
              authentication section of the README for the known exposure. */}
          <p className="muted text-sm" style={{ textAlign: "center", marginTop: 8, maxWidth: 380 }}>
            Academic build. The session token is stored in this browser's localStorage, which means it is readable by any
            script that runs on this page. Do not reuse this deployment with real credentials.
          </p>
        </div>
      </div>
    </div>
  );
}

function Benefit({ icon: Icon, title, sub }) {
  return (
    <div style={{ display: "flex", gap: 12, maxWidth: 210 }}>
      <div className="stat-icon" style={{ width: 38, height: 38, flexShrink: 0 }}>
        <Icon size={18} />
      </div>
      <div>
        <div style={{ fontWeight: 600, fontSize: 14 }}>{title}</div>
        <div className="muted text-sm">{sub}</div>
      </div>
    </div>
  );
}
