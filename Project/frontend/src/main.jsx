import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { SettingsProvider } from "./contexts/SettingsContext";
import { ToastProvider } from "./contexts/ToastContext";
import { AuthProvider } from "./contexts/AuthContext";

import "./styles/variables.css";
import "./styles/globals.css";
import "./styles/layout.css";
import "./styles/components.css";
import "./styles/tables.css";
import "./styles/forms.css";
import "./styles/responsive.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <SettingsProvider>
        <ToastProvider>
          <AuthProvider>
            <App />
          </AuthProvider>
        </ToastProvider>
      </SettingsProvider>
    </BrowserRouter>
  </React.StrictMode>
);
