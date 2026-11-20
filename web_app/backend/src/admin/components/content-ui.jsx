import React, { useRef, useState } from "react";
import { ApiClient } from "adminjs";

export const api = new ApiClient();

export const MESSAGES = {
  forbidden: "You are not allowed to do that.",
  name_required: "Enter a name in Arabic.",
  name_required_too_long: "Names can be at most 160 characters.",
  description_too_long: "Descriptions can be at most 500 characters.",
  section_required: "Choose a section.",
  prompt_required: "Enter the Arabic question text.",
  answer_required: "Enter the Arabic answer.",
  prompt_required_too_long: "Question text can be at most 4000 characters.",
  answer_required_too_long: "Answer text can be at most 4000 characters.",
  invalid_config: "A format setting is not valid (a colour must look like #aabbcc).",
  invalid_config_too_long: "A format setting is too long.",
  invalid_media: "One of the files cannot be used in that place. Upload it again.",
  points_required: "Enter suggested points between 1 and 600 for every hint stage.",
  original_required: "Upload the original file first: the other files are prepared from it.",
  not_found: "That item no longer exists.",
  no_change: "Nothing to change.",
  slot_occupied: "This slot already has a question. Reload the pack.",
  question_changed: "This question was changed by someone else. Reload the pack and try again.",
  format_change_needs_replacement: "A correction cannot change the format. Replace the question instead.",
  public_edit_confirmation_required: "Confirm that you are editing a public pack.",
  pack_public: "A public pack must stay complete. Replace the question instead of retiring it.",
  pack_archived: "Restore the pack before publishing it.",
  pack_incomplete: "The pack is not ready. Fix the problems listed below.",
  media_not_configured: "File storage is not set up on this service, so files cannot be uploaded.",
  storage_unavailable: "The file could not be stored. Nothing was saved; try again.",
  file_required: "Choose a file.",
  file_too_large: "That file is too large.",
  empty_file: "That file is empty.",
  unsupported_image: "Use a PNG, JPEG or WebP picture.",
  unsupported_audio: "Use an MP3 audio file.",
  corrupt_image: "That picture could not be read.",
  corrupt_audio: "That audio file could not be read.",
  image_dimensions: "The picture is too small or too large (32 to 8192 pixels per side).",
  cover_dimensions: "A cover must be a portrait picture about 4:5, between 400 and 2400 pixels wide.",
  audio_too_long: "Audio can be at most 10 minutes.",
  invalid_filter: "That filter is not valid.",
  invalid_cursor: "That page link is not valid. Reload the list.",
  reason_required: "Enter a reason: it is kept in the audit log.",
  reason_too_long: "Reasons can be at most 500 characters.",
  invalid_quantity: "Enter a whole number of tokens from 1 to 1000.",
  invalid_search: "Search with a phone number or at least the last 4 digits of one.",
  account_not_active: "Complimentary credit can only go to an active account.",
  account_deleted: "That account was deleted.",
  already_banned: "That account is already banned. Reload the page.",
  not_banned: "That account is not banned. Reload the page.",
  note_required: "Write the note.",
  note_too_long: "Notes can be at most 1000 characters.",
  already_resolved: "That flag was already resolved. Reload the page.",
  invalid_target: "Choose who receives the credit.",
  no_numbers: "Paste at least one valid phone number.",
  too_many_numbers: "A pasted list can have at most 5000 numbers.",
};
export const messageFor = (code) => MESSAGES[code] ?? "That did not work. Check the page before trying again.";

export const FORMAT_LABELS = {
  STANDARD: "Standard (text, optional pictures)",
  IMAGE_BLUR: "Blurred picture (3 hint stages)",
  IMAGE_ZOOM: "Zoomed picture (3 hint stages)",
  AUDIO_GUESS: "Audio guess",
  AUDIO_REVERSE: "Reversed audio",
  IMAGE_PERSON: "Person picture",
  IMAGE_COLOR: "Colour picture",
  IMAGE_RIDDLE: "Riddle (illustration)",
  AUDIO_VOICE: "Voice clip",
  IMAGE_MEMORY: "Memory (scene picture)",
  IMAGE_CLUES: "Clue image (up to 4 clue cards)",
  CHARADES: "Charades card",
};

export const colors = { forest: "#0d2e1d", gold: "#e7a72b", red: "#d9342b", cream: "#f6f1e6", line: "#d8d0bb", muted: "#5b6a60" };
export const input = { padding: "8px", borderRadius: 4, border: `1px solid ${colors.line}`, background: "#fff", font: "inherit", width: "100%", boxSizing: "border-box" };
export const card = { background: "#fff", border: `1px solid ${colors.line}`, borderRadius: 8, padding: 16 };
export const button = (kind = "primary", disabled = false) => ({
  padding: "8px 14px",
  borderRadius: 6,
  font: "inherit",
  fontWeight: 600,
  cursor: disabled ? "not-allowed" : "pointer",
  opacity: disabled ? 0.55 : 1,
  border: kind === "primary" ? "none" : `1px solid ${kind === "danger" ? colors.red : colors.forest}`,
  background: kind === "primary" ? colors.forest : "#fff",
  color: kind === "primary" ? "#fff" : kind === "danger" ? colors.red : colors.forest,
});

export const Field = ({ label, hint, children }) => (
  <label style={{ display: "block", marginBottom: 12 }}>
    <span style={{ display: "block", fontWeight: 600, marginBottom: 4 }}>{label}</span>
    {children}
    {hint && <span style={{ display: "block", color: colors.muted, fontSize: 12, marginTop: 4 }}>{hint}</span>}
  </label>
);

export const Notice = ({ notice }) =>
  notice ? (
    <div role="alert" style={{ padding: "10px 14px", borderRadius: 6, marginBottom: 12, background: notice.kind === "danger" ? "#fbe3e1" : "#e3f1e8", color: notice.kind === "danger" ? "#8a1f18" : "#134b2c" }}>
      {notice.text}
      {notice.issues?.length > 0 && (
        <ul style={{ margin: "8px 0 0", paddingLeft: 18 }}>
          {notice.issues.map((issue, index) => (
            <li key={index}>
              Slot {issue.slot}: {issue.message}
            </li>
          ))}
        </ul>
      )}
    </div>
  ) : null;

/**
 * One request key per intent and payload: a retry after a timeout reuses it, so the change is
 * applied once; an edited form is a different intent and gets a new key.
 */
export function useSend(setNotice, pageName = "content") {
  const keys = useRef({});
  const [busy, setBusy] = useState(false);
  const send = async (body, { success } = {}) => {
    const file = body.file;
    const { file: _file, ...fields } = body;
    const intent = JSON.stringify([fields, file ? [file.name, file.size, file.lastModified] : null]);
    keys.current[intent] ??= crypto.randomUUID();
    setBusy(true);
    setNotice?.(null);
    try {
      let data = { ...fields, requestKey: keys.current[intent] };
      if (file) {
        const form = new FormData();
        for (const [name, value] of Object.entries(data)) if (value !== undefined && value !== null) form.append(name, typeof value === "object" ? JSON.stringify(value) : String(value));
        form.append("file", file);
        data = form;
      }
      const response = await api.getPage({ pageName, method: "POST", data });
      delete keys.current[intent];
      if (success) setNotice?.({ kind: "ok", text: success });
      return response.data;
    } catch (error) {
      const code = error?.response?.data?.error;
      // A refusal is final for this intent; a network failure keeps the key for the retry.
      if (code) delete keys.current[intent];
      setNotice?.({ kind: "danger", text: messageFor(code), issues: error?.response?.data?.issues });
      return null;
    } finally {
      setBusy(false);
    }
  };
  return { send, busy };
}

export const get = async (params, pageName = "content") => (await api.getPage({ pageName, params })).data;
