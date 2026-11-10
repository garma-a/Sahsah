import { readFileSync } from "node:fs";
import { Ajv2020 } from "ajv/dist/2020.js";
import addFormats = require("ajv-formats");
import type { Data } from "./ports.js";
import { requireState } from "./problem.js";
const schema = JSON.parse(
  readFileSync(
    new URL("./contracts/realtime.schema.json", import.meta.url),
    "utf8",
  ),
);
const ajv = new Ajv2020({ strict: false, validateFormats: true });
addFormats.default(ajv);
ajv.addSchema(schema);
const names: Record<string, string> = {
  authenticate: "ClientAuthenticateFrame",
  reauthenticate: "ClientReauthenticateFrame",
  resync: "ClientResyncFrame",
  set_language: "ClientSetLanguageFrame",
  playback_status: "ClientPlaybackStatusFrame",
  authenticated: "ServerAuthenticatedFrame",
  state: "ServerStateFrame",
  presence: "ServerPresenceFrame",
  credential_expiring: "ServerCredentialExpiringFrame",
  control_revoked: "ServerControlRevokedFrame",
  membership_revoked: "ServerMembershipRevokedFrame",
  room_closed: "ServerRoomClosedFrame",
  resync_required: "ServerResyncRequiredFrame",
  protocol_error: "ServerProtocolErrorFrame",
};
const checks = Object.fromEntries(
  Object.entries(names).map(([event, name]) => [
    event,
    ajv.compile({ $ref: `${schema.$id}#/$defs/${name}` }),
  ]),
);
export function frame(
  value: unknown,
  client = true,
): { event: string; data: Data } {
  const candidate = value as { event: string; data: Data };
  requireState(
    candidate &&
      typeof candidate.event === "string" &&
      (client
        ? [
            "authenticate",
            "reauthenticate",
            "resync",
            "set_language",
            "playback_status",
          ].includes(candidate.event)
        : true) &&
      checks[candidate.event]?.(value),
    "INVALID_FRAME",
    400,
  );
  return candidate;
}
