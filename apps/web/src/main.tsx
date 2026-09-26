import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { App } from "./App.js";
import { createQueryClient } from "./lib/query-client.js";
import "./styles/tokens.css";
import "./styles/motion.css";

const container = document.getElementById("root");
if (!container) throw new Error("Missing #root element");

const queryClient = createQueryClient();

createRoot(container).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
);
