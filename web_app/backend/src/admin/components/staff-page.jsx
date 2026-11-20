import React, { useCallback, useEffect, useRef, useState } from "react";
import { Box, Button, H3, MessageBox, Table, TableBody, TableCell, TableHead, TableRow, Text } from "@adminjs/design-system";
import { ApiClient } from "adminjs";

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

const StaffPage = () => {
  const [staff, setStaff] = useState([]);
  const [me, setMe] = useState(null);
  const [notice, setNotice] = useState(null);
  const [form, setForm] = useState({ email: "", role: "admin" });
  const [busy, setBusy] = useState(false);
  // One key per intent: a retry after a timeout reuses it, so the change is applied once.
  const keys = useRef({});

  const load = useCallback(async () => {
    try {
      const { data } = await api.getPage({ pageName: "staff" });
      setStaff(data.staff);
      setMe(data.me);
    } catch (error) {
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
      setNotice({ kind: "danger", text: MESSAGES[code] ?? "That did not work. Check the list before trying again." });
      return null;
    } finally {
      setBusy(false);
    }
  };

  const report = (data, lead) => {
    if (data?.replayed) setNotice({ kind: "info", text: "That change was already applied." });
    else if (data?.temporaryPassword) {
      setNotice({ kind: "success", text: `${lead} Temporary password for ${data.email} (shown once, share it privately): ${data.temporaryPassword}` });
    }
  };

  const create = async (event) => {
    event.preventDefault();
    const data = await send(`create:${form.email}:${form.role}`, { op: "create", ...form });
    report(data, "Account created.");
    if (data) setForm({ email: "", role: "admin" });
  };

  const field = { padding: "8px", borderRadius: 4, border: "1px solid #c9c2ae", background: "#fff" };
  return (
    <Box variant="white">
      <H3>Staff</H3>
      <Text mb="lg">Only Super Admins see this page. Deactivating an account signs that person out immediately.</Text>
      {notice && <MessageBox mb="lg" variant={notice.kind} message={notice.text} onCloseClick={() => setNotice(null)} />}
      <form onSubmit={create}>
        <Box flex flexDirection="row" style={{ gap: 12, alignItems: "center" }} mb="xl">
          <input style={{ ...field, minWidth: 260 }} type="email" required placeholder="Email address" aria-label="Email address" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
          <select style={field} aria-label="Role" value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value })}>
            <option value="admin">Admin</option>
            <option value="super_admin">Super Admin</option>
          </select>
          <Button type="submit" variant="contained" disabled={busy}>Add staff account</Button>
        </Box>
      </form>
      <Table>
        <TableHead>
          <TableRow>
            <TableCell>Email</TableCell>
            <TableCell>Role</TableCell>
            <TableCell>Status</TableCell>
            <TableCell>Actions</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {staff.map((member) => (
            <TableRow key={member.id}>
              <TableCell>{member.email}{member.id === me ? " (you)" : ""}</TableCell>
              <TableCell>{ROLES[member.role]}</TableCell>
              <TableCell>{member.isActive ? "Active" : "Deactivated"}</TableCell>
              <TableCell>
                <Box flex style={{ gap: 8, flexWrap: "wrap" }}>
                  <Button size="sm" disabled={busy} onClick={async () => report(await send(`reset:${member.id}`, { op: "reset-password", id: member.id }), "Password reset.")}>Reset password</Button>
                  {member.id !== me && (
                    <Button size="sm" disabled={busy} onClick={() => send(`role:${member.id}:${member.role}`, { op: "role", id: member.id, role: member.role === "admin" ? "super_admin" : "admin" })}>
                      Make {member.role === "admin" ? "Super Admin" : "Admin"}
                    </Button>
                  )}
                  {member.id !== me && (
                    <Button size="sm" variant={member.isActive ? "danger" : "contained"} disabled={busy} onClick={() => send(`active:${member.id}:${member.isActive}`, { op: member.isActive ? "deactivate" : "reactivate", id: member.id })}>
                      {member.isActive ? "Deactivate" : "Reactivate"}
                    </Button>
                  )}
                </Box>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Box>
  );
};

export default StaffPage;
