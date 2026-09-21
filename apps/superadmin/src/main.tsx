import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@/app/globals.css";
import "../../web/app/app-calendar.css";
import "../../web/app/app-mobile-chrome.css";
import { SuperadminStandaloneRoot } from "./standalone-root";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <SuperadminStandaloneRoot />
  </StrictMode>,
);
