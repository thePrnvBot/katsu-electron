import React from "react";
import ReactDOM from "react-dom/client";

import App from "./App";

import "./index.css";

const rootElement = document.querySelector("#root") as HTMLDivElement;

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
