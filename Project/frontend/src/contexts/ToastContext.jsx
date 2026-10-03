import { createContext, useContext, useState, useCallback } from "react";

const ToastContext = createContext(null);

let counter = 0;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const remove = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = useCallback((type = "info", title = "", message = "", timeout = 3500) => {
    const id = ++counter;
    setToasts((prev) => [...prev, { id, type, title, message }]);
    if (timeout) {
      setTimeout(() => remove(id), timeout);
    }
    return id;
  }, [remove]);

  const success = useCallback((title, message) => push("success", title, message), [push]);
  const error = useCallback((title, message) => push("error", title, message, 5000), [push]);
  const warning = useCallback((title, message) => push("warning", title, message), [push]);
  const info = useCallback((title, message) => push("info", title, message), [push]);

  const value = { toasts, push, success, error, warning, info, remove };
  return <ToastContext.Provider value={value}>{children}</ToastContext.Provider>;
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
