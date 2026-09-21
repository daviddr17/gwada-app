import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@/app/globals.css";
import "../../web/app/app-calendar.css";
import "../../web/app/app-mobile-chrome.css";
import { DashboardStandaloneRoot } from "./standalone-root";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <DashboardStandaloneRoot />
  </StrictMode>,
);
