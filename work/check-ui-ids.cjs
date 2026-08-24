"use strict";

const fs = require("fs");
const ui = fs.readFileSync("ui.js", "utf8");
const html = fs.readFileSync("index.html", "utf8");
const ids = new Set([...html.matchAll(/\bid=["']([^"']+)["']/g)].map(([, id]) => id));
const calls = new Set([...ui.matchAll(/\$\(\s*["']#([A-Za-z][\w-]*)["']\s*\)/g)].map(([, id]) => id));
const missing = [...calls].filter(id => !ids.has(id)).sort();

console.log(`id calls: ${calls.size}`);
console.log(`missing: ${missing.length}`);
if (missing.length) console.log(missing.join("\n"));
process.exitCode = missing.length ? 1 : 0;
