import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

// Import AppKit wallet button styles
import "@reown/appkit-wallet-button/react";

import { Buffer } from "buffer";
window.Buffer = Buffer;

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
