import AdminJS from "adminjs";
import { componentLoader } from "./components.js";

// Build step: bundles the custom React screens into .adminjs/bundle.js (run with NODE_ENV=production).
const admin = new AdminJS({ rootPath: "/admin", componentLoader });
await admin.initialize();
