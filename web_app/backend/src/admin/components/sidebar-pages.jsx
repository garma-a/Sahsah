import React from "react";
import { Box, Text } from "@adminjs/design-system";
import { useSelector } from "react-redux";
import { useLocation, useNavigate } from "react-router";

const ROOT = "/admin";
const GROUPS = [
  { label: null, items: [{ label: "Home", href: ROOT }] },
  { label: "Content", items: [{ label: "Content", href: `${ROOT}/pages/content` }] },
  { label: "Players", items: [{ label: "Players", href: `${ROOT}/pages/players` }] },
  { label: "Shop", items: [{ label: "Shop", href: `${ROOT}/pages/shop` }] },
  { label: "Messages", items: [{ label: "Messages", href: `${ROOT}/pages/messages` }] },
  { label: "Public site", items: [{ label: "Public site", href: `${ROOT}/pages/public-site` }] },
  {
    label: "Staff & audit",
    items: [
      { label: "Audit log", href: `${ROOT}/pages/audit-log` },
      { label: "Staff", href: `${ROOT}/pages/staff`, superAdminOnly: true },
    ],
  },
];

const SidebarPages = () => {
  const session = useSelector((state) => state.session);
  const location = useLocation();
  const navigate = useNavigate();
  const isSuperAdmin = session?.role === "super_admin";
  const active = (href) =>
    href === ROOT ? location.pathname === ROOT || location.pathname === `${ROOT}/` : location.pathname.startsWith(href);
  return (
    <Box py="lg" px="md" data-css="sidebar-pages">
      {GROUPS.map((group) => {
        const items = group.items.filter((item) => !item.superAdminOnly || isSuperAdmin);
        // A group whose only link shares its name is shown as a plain link.
        const single = items.length === 1 && (group.label === null || items[0].label === group.label);
        return (
          <Box key={group.label ?? "home"} mb="md">
            {!single && (
              <Text fontSize="xs" fontWeight="bold" color="grey60" mb="sm" style={{ textTransform: "uppercase", letterSpacing: "0.08em" }}>
                {group.label}
              </Text>
            )}
            {items.map((item) => (
              <a
                key={item.href}
                href={item.href}
                onClick={(event) => {
                  event.preventDefault();
                  navigate(item.href);
                }}
                style={{
                  display: "block",
                  padding: "8px 12px",
                  borderRadius: 6,
                  textDecoration: "none",
                  fontWeight: active(item.href) ? 700 : 500,
                  color: active(item.href) ? "#0d2e1d" : "#3b4a41",
                  background: active(item.href) ? "#f3dfae" : "transparent",
                }}
              >
                {item.label}
              </a>
            ))}
          </Box>
        );
      })}
    </Box>
  );
};

export default SidebarPages;
