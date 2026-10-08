import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { AuthProvider }    from "./context/AuthContext.js";
import { ProjectProvider } from "./context/ProjectContext.js";
import App from "./App.js";
import ErrorBoundary from "./components/ErrorBoundary.js";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <ErrorBoundary>
    <BrowserRouter basename="/qa-manager">
      <AuthProvider>
        <ProjectProvider>
          <App />
        </ProjectProvider>
      </AuthProvider>
    </BrowserRouter>
    </ErrorBoundary>
  </React.StrictMode>
);
