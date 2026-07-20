import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { HashRouter, Routes, Route } from "react-router-dom";
import "./index.css";
import App from "./App.tsx";
import OAuthCallback from "./components/OAuthCallback";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <HashRouter>
      <Routes>
        <Route 
          path="/oauth/callback" 
          element={
            <OAuthCallback 
              serverUrl={localStorage.getItem("oauth_mcp_server_url") || ""} 
            />
          } 
        />
        <Route path="/*" element={<App />} />
      </Routes>
    </HashRouter>
  </StrictMode>
);