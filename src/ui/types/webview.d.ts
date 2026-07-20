import type { HTMLAttributes, Ref } from "react";

declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      webview: HTMLAttributes<HTMLElement> & {
        ref?: Ref<Electron.WebviewTag>;
        src?: string;
        partition?: string;
        webpreferences?: string;
        allowpopups?: string;
      };
    }
  }
}
