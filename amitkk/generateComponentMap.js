const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname);
const outputPath = path.join(root, "componentMaps.ts");

const SKIP_TRAVERSE_FOLDERS = new Set(["node_modules", ".next", ".git", "components", "lib"]);
const ADMIN_EXCLUDE_FOLDERS = new Set(["components", "lib", "seller", "user"]);
const INTERNAL_MODULES = ["ecom", "blog", "basic"];
const INTERNAL_SUBDIRS = ["pages", "regional"];

function normalize(p) {
  return p.replace(/\\/g, "/");
}

function validateMap(map, mapName) {
  Object.entries(map).forEach(([key, value]) => {
    if (!key) console.error(`❌ Empty key in ${mapName}`);
    if (!value || typeof value.path !== "string" || !value.path.startsWith("./")) {
      console.error(`❌ Invalid import path for key: ${key} in ${mapName}`, value);
    }
  });
}

function collectImmediateFiles(folderPath, baseRoot, extraProps = {}) {
  const result = {};
  if (!fs.existsSync(folderPath)) return result;

  const entries = fs.readdirSync(folderPath, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.isFile() && /\.(ts|tsx)$/.test(entry.name)) {
      const key = path.basename(entry.name, path.extname(entry.name));
      const rel = normalize(
        path.relative(baseRoot, path.join(folderPath, entry.name)).replace(/\.(ts|tsx)$/, "")
      );
      result[key] = { path: `./${rel}`, translate: true, ...extraProps };
    }
  }
  return result;
}

function getAdminFiles() {
  const result = {};
  const entries = fs.readdirSync(root, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.isDirectory() && !ADMIN_EXCLUDE_FOLDERS.has(entry.name)) {
      const folderPath = path.join(root, entry.name);
      Object.assign(result, collectImmediateFiles(folderPath, root));
    }
  }
  return result;
}

function collectNestedRoleMap(roleFolderName, routePrefix) {
  const result = {};

  function walk(currentDir) {
    if (!fs.existsSync(currentDir)) return;
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isDirectory() || SKIP_TRAVERSE_FOLDERS.has(entry.name)) continue;

      const fullPath = path.join(currentDir, entry.name);
      if (entry.name === roleFolderName) {
        Object.assign(result, collectImmediateFiles(fullPath, root, { route: routePrefix }));
      }

      walk(fullPath);
    }
  }

  walk(root);
  return result;
}

function collectInternalMap() {
  const componentMap = {};

  for (const moduleName of INTERNAL_MODULES) {
    for (const sub of INTERNAL_SUBDIRS) {
      const dir = path.join(root, moduleName, sub);
      if (!fs.existsSync(dir)) continue;

      const files = fs.readdirSync(dir);

      for (const file of files) {
        if (!file.endsWith(".ts") && !file.endsWith(".tsx")) continue;

        const slug = file.replace(/\.(ts|tsx)$/, "");
        const rel = normalize(
          path.relative(root, path.join(dir, file)).replace(/\.(ts|tsx)$/, "")
        );

        componentMap[slug] = { path: `./${rel}`, translate: true };
      }
    }
  }

  return componentMap;
}

function formatLoaderMap(name, map, includeRoute = false) {
  const entries = Object.entries(map)
    .map(([k, v]) => {
      const routePart = includeRoute && v.route ? `, route: "${v.route}"` : "";
      return `  "${k}": { loader: () => import("${v.path}"), translate: ${v.translate}${routePart} },`;
    })
    .join("\n");

  const entryType = includeRoute
    ? "{ loader: () => Promise<any>; translate: boolean; route: string }"
    : "{ loader: () => Promise<any>; translate: boolean }";

  return `export const ${name}: Record<string, ${entryType}> = {
${entries}
};`;
}

try {
  const admin = getAdminFiles();
  const seller = collectNestedRoleMap("seller", "/seller");
  const user = collectNestedRoleMap("user", "/user");
  const internal = collectInternalMap();

  validateMap(admin, "adminComponentMap");
  validateMap(seller, "sellerComponentMap");
  validateMap(user, "userComponentMap");
  validateMap(internal, "internalComponentMap");

  const output = `// 🚨 AUTO-GENERATED FILE. DO NOT EDIT.

${formatLoaderMap("adminComponentMap", admin)}

${formatLoaderMap("sellerComponentMap", seller, true)}

${formatLoaderMap("userComponentMap", user, true)}

${formatLoaderMap("internalComponentMap", internal)}

export default {
  adminComponentMap,
  sellerComponentMap,
  userComponentMap,
  internalComponentMap,
};
`;

  fs.writeFileSync(outputPath, output, "utf-8");
  console.log("✅ componentMaps.ts successfully regenerated with seller/user routes and validation.");
} catch (err) {
  console.error("❌ Generator failed:", err);
}