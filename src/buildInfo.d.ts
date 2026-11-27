declare const __LIFEOS_BUILD_INFO__: {
  appVersion: string;
  commit: string;
  buildNumber: string;
  capacitor: {
    core: string;
    cli: string;
    android: string;
    localNotifications: string;
    app: string;
  };
};

declare const __BUSYDOO_LEGAL_DRAFT__: boolean;

interface ImportMetaEnv {
  readonly DEV: boolean;
  readonly BASE_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
