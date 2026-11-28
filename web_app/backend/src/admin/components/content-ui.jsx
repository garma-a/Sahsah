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
  logo_dimensions: "The logo is too small or too large.",
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
  already_resolved: "That was already resolved. Reload the page.",
  invalid_target: "Choose who receives the credit.",
  no_numbers: "Paste at least one valid phone number.",
  stale_pricing: "Prices were changed by someone else. Reload this tab and make your change again.",
  price_invalid: "Enter a base price above 0 and up to 100,000 EGP (at most 2 decimals).",
  gift_discount_invalid: "The gift discount must be between 0% and 100%.",
  tiers_invalid: "A quantity discount is not valid.",
  tiers_too_many: "At most 20 quantity discounts.",
  tier_quantity_invalid: "A quantity discount needs a whole quantity from 1 to 20.",
  tier_discount_invalid: "A discount must be between 0% and 100%.",
  tiers_not_ascending: "Quantities must go up from one discount to the next, with none repeated.",
  bundles_invalid: "The 1, 2 and 5 token bundles must each appear once.",
  bundle_order_invalid: "Give the three bundles the display positions 1, 2 and 3, each once.",
  kind_invalid: "Choose a promo code or a free campaign.",
  code_invalid: "A code is 3 to 32 letters, digits, dashes or underscores.",
  code_taken: "That code already exists.",
  discount_invalid: "The discount must be between 1% and 100%.",
  bundle_invalid: "Choose the 1, 2 or 5 token bundle.",
  dates_invalid: "Enter valid start and end dates.",
  window_invalid: "The end must be after the start.",
  ends_in_past: "The end date has already passed.",
  limit_invalid: "Limits are whole numbers of at least 1.",
  promo_in_use: "This promotion was already used, so its code, discount and bundle can no longer change. Dates and limits still can.",
  promo_used: "This promotion was used or is on an order, so it cannot be deleted. Deactivate it instead.",
  campaign_closed: "This campaign has already closed for good and cannot be reopened. Create a new one.",
  invalid_request: "That request was not valid.",
  email_not_configured: "Email sending is not set up on this service, so nothing can be sent from here. Use your own email app instead.",
  reply_not_allowed: "Experience feedback cannot be replied to. You can close it.",
  no_email: "This message has no usable email address, so it cannot be answered by email.",
  body_required: "Write the reply.",
  body_too_long: "A reply can be at most 5000 characters.",
  already_closed: "That message is already closed. Reload the page.",
  already_open: "That message is already open. Reload the page.",
  provider_denied: "The email service refused the request. Check the Resend API key and that the sender domain is verified. The reply is saved as failed; nothing was sent.",
  provider_rejected: "The email service rejected this email (for example because the address is not valid). The reply is saved as failed; nothing was sent.",
  provider_busy: "The email service is limiting requests. The reply is saved as failed; wait a moment and try again.",
  provider_unavailable: "The email service could not be reached. The reply is saved as failed; nothing was sent. Try again.",
  provider_timeout: "The email service did not answer in time, so the email may or may not have been delivered. The reply is saved as failed; check the Resend log before sending it again.",
  title_required: "Enter the Arabic title.",
  title_too_long: "Titles can be at most 120 characters.",
  title_franco_too_long: "The Franco title can be at most 120 characters.",
  announcement_body_required: "Enter the Arabic message.",
  announcement_body_too_long: "A message can be at most 500 characters.",
  announcement_body_franco_too_long: "The Franco message can be at most 500 characters.",
  page_title_required: "Enter the Arabic page title.",
  page_title_too_long: "Page titles can be at most 120 characters.",
  page_title_franco_too_long: "The Franco title can be at most 120 characters.",
  page_body_required: "Enter the Arabic text of the page.",
  page_body_too_long: "A page can be at most 20,000 characters.",
  page_body_franco_too_long: "The Franco text can be at most 20,000 characters.",
  question_too_long: "A question can be at most 200 characters.",
  answer_too_long: "An answer can be at most 2000 characters.",
  link_incomplete: "A link needs both a label and an address, or neither.",
  link_label_too_long: "A link label can be at most 60 characters.",
  invalid_link: "A link must be an https address or a path on this site such as /about.",
  invalid_starts_at: "Enter a valid start.",
  starts_at_required: "Enter when the announcement starts.",
  invalid_ends_at: "Enter a valid end.",
  announcement_was_live: "This announcement was shown to players, so it cannot be deleted. Deactivate it instead.",
  page_not_saved: "Save the page first, then publish it.",
  faq_items_required: "Add at least one question.",
  faq_items_too_many: "A FAQ can have at most 50 questions.",
  question_required: "Every question needs Arabic text.",
  answer_required: "Every question needs an Arabic answer.",
  invalid_supportPhone: "Enter a phone number with digits, spaces, dashes or a leading +.",
  invalid_whatsapp: "Enter a WhatsApp number with digits, spaces, dashes or a leading +.",
  invalid_support_email: "Enter a valid support email address.",
  invalid_facebookUrl: "The Facebook address must start with https://.",
  invalid_instagramUrl: "The Instagram address must start with https://.",
  invalid_tiktokUrl: "The TikTok address must start with https://.",
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
