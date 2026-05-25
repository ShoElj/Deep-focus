import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "../styles.css";
import { Dashboard } from "./Dashboard";

createRoot(document.getElementById("dashboard-root")!).render(
  <StrictMode>
    <Dashboard />
  </StrictMode>
);

