import { Capacitor, registerPlugin, type PluginListenerHandle } from '@capacitor/core';

export type BankSmsStatus = { enabled: boolean; supported: boolean; granted: boolean; requested: boolean; requestable: boolean; count: number };
type BankSmsRow = { id: string; text: string };

export const bankSms = registerPlugin<{
  addListener(event: 'queueChanged', callback: () => void): Promise<PluginListenerHandle>;
  status(): Promise<BankSmsStatus>;
  enable(): Promise<BankSmsStatus>;
  disable(): Promise<BankSmsStatus>;
  list(): Promise<{ rows: BankSmsRow[] }>;
  remove(options: { id: string }): Promise<BankSmsStatus>;
  clear(): Promise<BankSmsStatus>;
  openSettings(): Promise<void>;
}>('BankSms');

export const hasBankSms = () => Capacitor.getPlatform() === 'android' && Capacitor.isPluginAvailable('BankSms');
