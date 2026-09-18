import { register } from "node:module";

register(new URL("./web-alias-hook.mjs", import.meta.url), import.meta.url);
