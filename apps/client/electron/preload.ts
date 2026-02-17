import { contextBridge } from "electron";

contextBridge.exposeInMainWorld("electronMeta", {
  platform: process.platform,
  versions: process.versions
});
