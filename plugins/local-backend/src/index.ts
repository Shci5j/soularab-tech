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
  runTermuxCommand(options: { command: string }): Promise<{ accepted: boolean }>;
  controlNode(options: { id: string; action: 'start' | 'stop' }): Promise<LocalBackendStatus>;
  biometricAvailability(): Promise<{ available: boolean; status: number }>;
  authenticateBiometric(options: { title?: string; subtitle?: string }): Promise<{ authenticated: boolean }>; 
  checkRootAccess(): Promise<{ available: boolean; uid?: string; message?: string }>;
  roohEngineStatus(): Promise<{ engine: string; version: string; loaded: boolean; modelPresent: boolean; modelBytes: number; modelPath: string; runtime: string }>;
  downloadRoohModel(): Promise<{ downloaded: boolean; bytes: number }>;
  loadRoohModel(): Promise<{ loaded: boolean; version: string }>;
  generateRooh(options: { prompt: string; maxTokens?: number }): Promise<{ content: string; model: string; provider: string }>;
  addListener(eventName: 'roohModelDownloadProgress', listenerFunc: (progress: { receivedBytes: number; totalBytes: number; percent: number }) => void): Promise<{ remove: () => void }>; 
}

const LocalBackend = registerPlugin<LocalBackendPlugin>('LocalBackend');

export { LocalBackend };
