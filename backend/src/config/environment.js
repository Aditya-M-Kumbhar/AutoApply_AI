import dotenv from "dotenv";
import { fileURLToPath } from "node:url";

// Resolve against this module, so starting node from the repository root also works.
dotenv.config({ path: fileURLToPath(new URL("../../.env", import.meta.url)) });
