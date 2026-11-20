import { ComponentLoader } from "adminjs";
import path from "node:path";

// The JSX files are copied next to the compiled code (nest-cli assets) and bundled by AdminJS.
const directory = path.join(import.meta.dirname, "components");

export const componentLoader = new ComponentLoader();
export const components = {
  Home: componentLoader.add("Home", path.join(directory, "home")),
  Placeholder: componentLoader.add("Placeholder", path.join(directory, "placeholder")),
  StaffPage: componentLoader.add("StaffPage", path.join(directory, "staff-page")),
  AuditLog: componentLoader.add("AuditLog", path.join(directory, "audit-log")),
};
// Replaces AdminJS's flat "Pages" list with the grouped navigation.
componentLoader.override("SidebarPages", path.join(directory, "sidebar-pages"));
