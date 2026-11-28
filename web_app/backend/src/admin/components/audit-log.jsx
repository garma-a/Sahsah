import React, { useCallback, useEffect, useState } from "react";
import { Box, Button, H3, Table, TableBody, TableCell, TableHead, TableRow, Text } from "@adminjs/design-system";
import { ApiClient } from "adminjs";

const api = new ApiClient();
// Postgres text: "2026-11-20 10:00:00.123456+00".
const when = (value) => new Date(value.replace(" ", "T").replace(/\+00$/, "Z")).toLocaleString();

const AuditLog = () => {
  const [filters, setFilters] = useState({ staff: "", action: "" });
  const [state, setState] = useState({ rows: [], nextCursor: null, staff: [], actions: [] });
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (next, cursor) => {
    setLoading(true);
    setError(null);
    try {
      const params = { staff: next.staff || undefined, action: next.action || undefined, cursor };
      const { data } = await api.getPage({ pageName: "audit-log", params });
      setState((previous) => ({ ...data, rows: cursor ? [...previous.rows, ...data.rows] : data.rows }));
    } catch {
      setError("The audit log could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(filters);
  }, [filters, load]);

  const select = { padding: "8px", borderRadius: 4, border: "1px solid #c9c2ae", background: "#fff", minWidth: 0 };
  const short = { width: "1%", whiteSpace: "nowrap", wordBreak: "normal" };
  const wrap = { overflowWrap: "anywhere", wordBreak: "normal" };
  return (
    <Box variant="white">
      <H3>Audit log</H3>
      <Text mb="lg">Every staff change is recorded here with who made it. Newest first; this list is read-only.</Text>
      <Box flex flexDirection="row" style={{ gap: 12 }} mb="lg">
        <select style={{ ...select, flex: 1 }} value={filters.staff} onChange={(event) => setFilters({ ...filters, staff: event.target.value })} aria-label="Staff member">
          <option value="">All staff</option>
          {state.staff.map((member) => (
            <option key={member.id} value={member.id}>{member.email}</option>
          ))}
        </select>
        <select style={{ ...select, width: 220 }} value={filters.action} onChange={(event) => setFilters({ ...filters, action: event.target.value })} aria-label="Action">
          <option value="">All actions</option>
          {state.actions.map((action) => (
            <option key={action} value={action}>{action}</option>
          ))}
        </select>
      </Box>
      {error && <Text color="error" mb="lg">{error}</Text>}
      <Table>
        <TableHead>
          <TableRow>
            <TableCell style={short}>When</TableCell>
            <TableCell>Staff</TableCell>
            <TableCell style={short}>Action</TableCell>
            <TableCell style={{ width: "24%" }}>Target</TableCell>
            <TableCell style={{ width: "26%" }}>Reason</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {state.rows.map((row) => (
            <TableRow key={row.id}>
              <TableCell style={short}>{when(row.createdAt)}</TableCell>
              <TableCell style={wrap}>{row.staffEmail}</TableCell>
              <TableCell style={short}>{row.action}</TableCell>
              <TableCell style={wrap}><span style={{ whiteSpace: "nowrap" }}>{row.targetKind}:</span> {row.targetKey}</TableCell>
              <TableCell style={wrap}>{row.reason ?? ""}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {!loading && !error && state.rows.length === 0 && <Text mt="lg">No events match.</Text>}
      {state.nextCursor && (
        <Box mt="lg">
          <Button disabled={loading} onClick={() => load(filters, state.nextCursor)}>Load more</Button>
        </Box>
      )}
    </Box>
  );
};

export default AuditLog;
