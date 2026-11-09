import { registerPlugin } from '@capacitor/core';

export interface LocalNodeStatus {
  id: string;
  name: string;
  port: number;
  running: boolean;
}

export interface LocalBackendStatus {
  running: boolean;
  nodes: LocalNodeStatus[];
  database: string;
  accessToken?: string;
}

export interface LocalBackendPlugin {
  start(): Promise<LocalBackendStatus>;
  status(): Promise<LocalBackendStatus>;
  stop(): Promise<{ running: boolean }>;
}

const LocalBackend = registerPlugin<LocalBackendPlugin>('LocalBackend');

export { LocalBackend };
