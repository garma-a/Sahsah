export function newOperationId(): string {
  return crypto.randomUUID();
}

/** A 32-byte secret as unpadded base64url, the shape the API requires. */
export function newSecret(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
