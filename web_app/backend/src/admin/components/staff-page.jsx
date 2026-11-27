import React, { useCallback, useEffect, useRef, useState } from "react";
import { Box, Button, H3, MessageBox, Text } from "@adminjs/design-system";
import { ApiClient } from "adminjs";
import { colors } from "./content-ui";

const api = new ApiClient();
const MESSAGES = {
  forbidden: "Only a Super Admin can manage staff.",
  invalid_email: "Enter a valid email address.",
  invalid_role: "Choose a role.",
  email_taken: "A staff account with this email already exists.",
  last_super_admin: "There must always be at least one active Super Admin.",
  cannot_deactivate_self: "You cannot deactivate your own account.",
  cannot_change_own_role: "You cannot change your own role.",
  no_change: "Nothing to change.",
  not_found: "That staff account no longer exists.",
};
const ROLES = { admin: "Admin", super_admin: "Super Admin" };
const heading = { color: colors.muted, textAlign: "left", padding: "6px 8px" };
const cell = { borderTop: `1px solid ${colors.line}`, padding: "6px 8px" };
const shortCell = { ...cell, whiteSpace: "nowrap" };

const StaffPage = () => {
  const [staff, setStaff] = useState([]);
  const [me, setMe] = useState(null);
  const [maxEmailLength, setMaxEmailLength] = useState(null);
  const [notice, setNotice] = useState(null);
  const [form, setForm] = useState({ email: "", role: "admin" });
  const [busy, setBusy] = useState(false);
  const [forbidden, setForbidden] = useState(false);
  // One key per intent: a retry after a timeout reuses it, so the change is applied once.
  const keys = useRef({});

  const load = useCallback(async () => {
    try {
      const { data } = await api.getPage({ pageName: "staff" });
      setStaff(data.staff);
      setMe(data.me);
      setMaxEmailLength(data.maxEmailLength);
    } catch (error) {
      if (error?.response?.status === 403) setForbidden(true);
      setNotice({ kind: "danger", text: MESSAGES[error?.response?.data?.error] ?? "Staff could not be loaded." });
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const send = async (intent, body) => {
    setBusy(true);
    setNotice(null);
    keys.current[intent] ??= crypto.randomUUID();
    try {
      const { data } = await api.getPage({ pageName: "staff", method: "POST", data: { ...body, requestKey: keys.current[intent] } });
      delete keys.current[intent];
      await load();
      return data;
    } catch (error) {
      const code = error?.response?.data?.error;
      // A refusal is final for this intent; a network failure keeps the key for the retry.
      if (code) delete keys.current[intent];
      const text = code === "email_too_long"
        ? `Email addresses can be at most ${maxEmailLength} characters.`
        : MESSAGES[code] ?? "That did not work. Check the list before trying again.";
      setNotice({ kind: "danger", text });
      return null;
    } finally {
      setBusy(false);
    }
  };

  const report = (data, lead) => {
    if (data?.replayed) setNotice({ kind: "info", text: "That change was already applied." });
    else if (data?.temporaryPassword) {
      setNotice({
        kind: "success",
        text: `${lead} Temporary password for ${data.email} (shown once, share it privately):`,
        password: data.temporaryPassword,
      });
    }
  };

  const copyPassword = async () => {
    let copyStatus;
    try {
      await navigator.clipboard.writeText(notice.password);
      copyStatus = "Copied";
    } catch {
      copyStatus = "Could not copy. Select the password to copy it manually.";
    }
    setNotice((current) => current === notice ? { ...current, copyStatus } : current);
  };

  const create = async (event) => {
    event.preventDefault();
    const data = await send(`create:${form.email}:${form.role}`, { op: "create", ...form });
    report(data, "Account created.");
    if (data) setForm({ email: "", role: "admin" });
  };

  const field = { padding: "8px", borderRadius: 4, border: "1px solid #c9c2ae", background: "#fff" };
  if (forbidden) {
    return (
      <Box variant="white">
        <H3>Staff</H3>
        <Text>{MESSAGES.forbidden}</Text>
      </Box>
    );
  }
  return (
    <Box variant="white">
      <H3>Staff</H3>
      <Text mb="lg">Only Super Admins see this page. Deactivating an account signs that person out immediately.</Text>
      {notice && (
        <MessageBox mb="lg" variant={notice.kind} message={notice.text} style={{ overflowWrap: "anywhere" }} onCloseClick={() => setNotice(null)}>
          {notice.password && (
            <span style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
              <code style={{ minWidth: 0 }}>{notice.password}</code>
              <Button type="button" size="sm" variant="outlined" onClick={copyPassword}>Copy password</Button>
              <span role="status">{notice.copyStatus}</span>
            </span>
          )}
        </MessageBox>
      )}
      <form onSubmit={create}>
        <Box flex flexDirection="row" style={{ gap: 12, alignItems: "center" }} mb="xl">
          <input style={{ ...field, minWidth: 260 }} type="email" required maxLength={maxEmailLength ?? undefined} placeholder="Email address" aria-label="Email address" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
          <select style={field} aria-label="Role" value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value })}>
            <option value="admin">Admin</option>
            <option value="super_admin">Super Admin</option>
          </select>
          <Button type="submit" variant="contained" disabled={busy || maxEmailLength === null}>Add staff account</Button>
        </Box>
      </form>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th style={heading}>Email</th>
            <th style={{ ...heading, width: "1%" }}>Role</th>
            <th style={{ ...heading, width: "1%" }}>Status</th>
            <th style={{ ...heading, width: "1%" }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {staff.map((member) => (
            <tr key={member.id}>
              <td style={{ ...cell, overflowWrap: "anywhere" }}>{member.email}{member.id === me ? " (you)" : ""}</td>
              <td style={shortCell}>{ROLES[member.role]}</td>
              <td style={shortCell}>{member.isActive ? "Active" : "Deactivated"}</td>
              <td style={shortCell}>
                <div style={{ display: "inline-flex", gap: 8 }}>
                  <Button size="sm" variant="outlined" disabled={busy} onClick={async () => {
                    if (!window.confirm(`Reset the password for ${member.email}? Their current password will stop working and a temporary password will be issued.`)) return;
                    report(await send(`reset:${member.id}`, { op: "reset-password", id: member.id }), "Password reset.");
                  }}>Reset password</Button>
                  {member.id !== me && (
                    <Button size="sm" variant="outlined" disabled={busy} onClick={() => send(`role:${member.id}:${member.role}`, { op: "role", id: member.id, role: member.role === "admin" ? "super_admin" : "admin" })}>
                      Make {member.role === "admin" ? "Super Admin" : "Admin"}
                    </Button>
                  )}
                  {member.id !== me && (
                    <Button size="sm" variant={member.isActive ? "danger" : "contained"} disabled={busy} onClick={() => {
                      if (member.isActive && !window.confirm(`Deactivate ${member.email}? They will be signed out immediately and will need to be reactivated before signing in again.`)) return;
                      send(`active:${member.id}:${member.isActive}`, { op: member.isActive ? "deactivate" : "reactivate", id: member.id });
                    }}>
                      {member.isActive ? "Deactivate" : "Reactivate"}
                    </Button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Box>
  );
};

export default StaffPage;
