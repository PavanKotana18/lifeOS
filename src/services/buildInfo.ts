export interface LifeOSBuildInfo {
  appVersion: string;
  commit: string;
  buildNumber: string;
  capacitor: { core: string; cli: string; android: string; localNotifications: string; app: string };
}

const fallback: LifeOSBuildInfo = {
  appVersion: '1.0.0', commit: 'local', buildNumber: 'local',
  capacitor: { core: '6.2.3', cli: '6.2.3', android: '6.2.3', localNotifications: '6.1.3', app: '6.0.3' },
};

export const LIFEOS_BUILD_INFO: LifeOSBuildInfo =
  typeof __LIFEOS_BUILD_INFO__ === 'undefined' ? fallback : __LIFEOS_BUILD_INFO__;
