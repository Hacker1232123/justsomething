/// <reference types="vite/client" />

declare module "*.wav" {
  const src: string;
  export default src;
}

declare global {
  interface Window {
    electronMeta?: {
      platform: string;
      versions: Record<string, string>;
    };
  }
}
