export {};

declare global {
  interface Window {
    __CS_LEGACY_BOOTED__?: boolean;
    __CS_ACTIVE_TAB__?: string;
  }
}
