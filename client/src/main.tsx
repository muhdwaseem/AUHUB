import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "./index.css";
import "./theme";
import App from "./App";
import { AuthProvider } from "./auth";
import { CurrencyProvider } from "./currency";
import { TeamProvider } from "./team";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <CurrencyProvider>
          <TeamProvider>
            <App />
          </TeamProvider>
        </CurrencyProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
