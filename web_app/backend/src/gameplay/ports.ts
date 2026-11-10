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
  provider: string;
  namespace: string;
  key: string;
}
export interface SignedMedia {
  url: string;
  expiresAt: string;
}
export interface PreviewOptions {
  passcode: string;
  secret: string;
}
export interface GameplayOptions {
  /** Passcode-gated hosts before login exists; never with real accounts. */
  preview?: PreviewOptions;
  enabled?: boolean;
  verifyAccount?: (token: string) => Promise<VerifiedAccount | undefined>;
  pressure?: () => Promise<PressureSample>;
  signMedia?: (object: MediaObject) => Promise<SignedMedia>;
  capacity?: { rooms: number; members: number; games: number };
  /** Origin and path prefix of public category artwork, without a trailing slash. */
  publicMediaBaseUrl?: string;
}
export type Data = Record<string, unknown>;
