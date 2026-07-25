import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { MobileApp } from "./mobile/MobileApp";
import "./mobile/mobile.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <MobileApp />
  </StrictMode>
);
