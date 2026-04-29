import React from "react";
import ReactDOM from "react-dom/client";
import { toast } from "sonner";
import App from "./app/App";
import "./styles/index.css";

if (typeof window !== "undefined") {
  window.alert = (message?: unknown) => {
    const text =
      typeof message === "string"
        ? message
        : message == null
          ? "Notification"
          : String(message);
    toast(text);
  };
}

ReactDOM.createRoot(document.getElementById("app") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

