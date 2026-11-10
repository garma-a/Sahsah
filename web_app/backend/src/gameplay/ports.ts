export interface VerifiedAccount {
  accountId: string;
  expiresAt: number;
}
export interface PressureSample {
  api: number;
  database: number;
  sampledAt: number;
  databaseSampledAt?: number;
  application?: number;
}
export interface MediaObject {
  namespace: string;
  key: string;
}
export interface SignedMedia {
  url: string;
  expiresAt: string;
}
export interface GameplayOptions {
  enabled?: boolean;
  verifyAccount?: (token: string) => Promise<VerifiedAccount | undefined>;
  pressure?: () => Promise<PressureSample>;
  signMedia?: (object: MediaObject) => Promise<SignedMedia>;
  capacity?: { rooms: number; members: number; games: number };
}
export type Data = Record<string, unknown>;
