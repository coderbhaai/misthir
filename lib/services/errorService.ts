import fs from "fs";
import path from "path";
import ErrorLog from "lib/models/basic/ErrorLog";

type ErrorContext = {
  api?: string;
  function?: string;
  module?: string;
  payload?: any;
  user_id?: string;
};

function normalizePayload(payload: any) {
  if (payload === undefined) return undefined;

  // If it's already a plain object, stringify values safely
  if (typeof payload === "object") {
    return Object.fromEntries(
      Object.entries(payload).map(([key, value]) => [
        key,
        Array.isArray(value) || typeof value === "object"
          ? JSON.stringify(value)
          : value,
      ])
    );
  }

  // Fallback for primitives
  return JSON.stringify(payload);
}

export async function logError(error: any, context?: ErrorContext) {
  try {
    console.log("ERROR", error)

    console.log("logError", {
      message: error?.message || "Unknown error",
      stack: error?.stack,
      api: context?.api,
      function: context?.function,
      module: context?.module,
      payload: normalizePayload(context?.payload),
      user_id: context?.user_id,
      level: "ERROR",
    });

    await ErrorLog.create({
      message: error?.message || "Unknown error",
      stack: error?.stack,
      api: context?.api,
      function: context?.function,
      module: context?.module,
      payload: normalizePayload(context?.payload),
      user_id: context?.user_id,
      level: "ERROR",
    });
  } catch (loggingError) { console.error("❌ Failed to log error:", loggingError); }
}

export function getDuplicateKeyErrorMessage(error: any): string | null {
  if (error && error.code === 11000 && error.keyValue) {
    const fields = Object.keys(error.keyValue);
    // Capitalize the field name for the toast message
    const fieldName = fields[0] ? fields[0].charAt(0).toUpperCase() + fields[0].slice(1) : "Field";
    const duplicateValue = error.keyValue[fields[0]];
    
    return `❌ ${fieldName} '${duplicateValue}' is already registered. Please use another one.`;
  }
  return null;
}

const DEBUG_FILE = path.join( process.cwd(), "logs", "debug.log" );

export function clearDebugFile() {
  try {
    fs.mkdirSync(path.dirname(DEBUG_FILE), { recursive: true });

    fs.writeFileSync( DEBUG_FILE, `\n========== resolve_route START ${new Date().toISOString()} ==========\n\n`, "utf8" );
  } catch (error) {
    console.error("❌ Failed to clear resolve_route debug file:", error);
  }
}

export function debug(label: string, data?: any) {
  try {
    const output = data === undefined
      ? label
      : `${label}\n${JSON.stringify(
          data,
          (key, value) => {
            if (key === "buffer") return "[Buffer]";

            if (
              value &&
              typeof value === "object" &&
              typeof value.toString === "function"
            ) {
              if (
                value._bsontype === "ObjectID" ||
                value._bsontype === "ObjectId"
              ) {
                return value.toString();
              }
            }

            return value;
          },
          2
        )}`;

    fs.appendFileSync( DEBUG_FILE, `${output}\n\n`, "utf8" );
  } catch (error) {
    console.error("❌ Failed to write resolve_route debug:", error);
  }
}