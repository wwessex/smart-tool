/**
 * JSON schema validation for SMARTAction output.
 *
 * Enforces structural correctness of model outputs before SMART
 * criteria validation. Includes JSON extraction from raw model
 * output that may contain surrounding tokens or formatting.
 */

import type { SMARTAction } from "../types.js";

/** Schema field definition. */
interface FieldDef {
  name: string;
  type: "string";
  required: boolean;
  minLength?: number;
}

/** Simple JSON schema validator for SMARTAction objects. */
export class SmartActionSchema {
  private fields: FieldDef[];

  constructor() {
    this.fields = [
      { name: "action", type: "string", required: true, minLength: 10 },
      { name: "metric", type: "string", required: true, minLength: 5 },
      { name: "baseline", type: "string", required: true, minLength: 1 },
      { name: "target", type: "string", required: true, minLength: 1 },
      { name: "deadline", type: "string", required: true, minLength: 4 },
      { name: "rationale", type: "string", required: true, minLength: 5 },
      { name: "effort_estimate", type: "string", required: true, minLength: 3 },
      { name: "first_step", type: "string", required: true, minLength: 5 },
      { name: "template_id", type: "string", required: false },
    ];
  }

  /** Validate that an object has all required fields with correct types. */
  validate(obj: unknown): obj is SMARTAction {
    if (!obj || typeof obj !== "object") return false;

    const record = obj as Record<string, unknown>;

    for (const field of this.fields) {
      const value = record[field.name];

      if (field.required) {
        if (value === undefined || value === null) return false;
        if (typeof value !== field.type) return false;
        if (
          field.minLength &&
          typeof value === "string" &&
          value.trim().length < field.minLength
        ) {
          return false;
        }
      } else if (value !== undefined && value !== null) {
        if (typeof value !== field.type) return false;
      }
    }

    return true;
  }

  /** Get validation errors for an object (for detailed error reporting). */
  getErrors(obj: unknown): string[] {
    const errors: string[] = [];

    if (!obj || typeof obj !== "object") {
      errors.push("Input is not an object");
      return errors;
    }

    const record = obj as Record<string, unknown>;

    for (const field of this.fields) {
      const value = record[field.name];

      if (field.required) {
        if (value === undefined || value === null) {
          errors.push(`Missing required field: ${field.name}`);
          continue;
        }
        if (typeof value !== field.type) {
          errors.push(`Field '${field.name}' must be type '${field.type}', got '${typeof value}'`);
          continue;
        }
        if (
          field.minLength &&
          typeof value === "string" &&
          value.trim().length < field.minLength
        ) {
          errors.push(
            `Field '${field.name}' is too short (min ${field.minLength} chars)`
          );
        }
      }
    }

    return errors;
  }

  /** Get list of required field names. */
  getRequiredFields(): string[] {
    return this.fields.filter((f) => f.required).map((f) => f.name);
  }
}

/** Singleton schema instance. */
export const SMART_ACTION_SCHEMA = new SmartActionSchema();

/**
 * Extract and parse JSON from raw model output.
 *
 * Handles common model output patterns:
 * - JSON wrapped in <|json|>...<|/json|> tags
 * - JSON wrapped in ```json...``` blocks
 * - Bare JSON array
 * - JSON with leading/trailing prose
 */
export function parseJsonOutput(rawOutput: string): unknown[] | null {
  const text = rawOutput.trim();

  // Try extracting from <|json|>...<|/json|> tags
  const jsonTagMatch = text.match(/<\|json\|>([\s\S]*?)(?:<\|\/json\|>|$)/);
  if (jsonTagMatch) {
    return tryParseArray(jsonTagMatch[1].trim());
  }

  // Try extracting from ```json...``` blocks
  const codeBlockMatch = text.match(/```json\s*([\s\S]*?)```/);
  if (codeBlockMatch) {
    return tryParseArray(codeBlockMatch[1].trim());
  }

  // Try extracting from ``` blocks (without json tag)
  const genericBlockMatch = text.match(/```\s*([\s\S]*?)```/);
  if (genericBlockMatch) {
    return tryParseArray(genericBlockMatch[1].trim());
  }

  // Try finding a JSON array directly
  const arrayStart = text.indexOf("[");
  const arrayEnd = text.lastIndexOf("]");
  if (arrayStart !== -1 && arrayEnd > arrayStart) {
    return tryParseArray(text.slice(arrayStart, arrayEnd + 1));
  }

  // Try finding a single JSON object and wrapping it
  const objStart = text.indexOf("{");
  const objEnd = text.lastIndexOf("}");
  if (objStart !== -1 && objEnd > objStart) {
    const objStr = text.slice(objStart, objEnd + 1);
    try {
      const obj = JSON.parse(objStr);
      if (typeof obj === "object" && !Array.isArray(obj)) {
        return [obj];
      }
    } catch {
      // Not valid JSON
    }
  }

  return null;
}

function tryParseArray(text: string): unknown[] | null {
  try {
    // Fix common JSON issues from model output
    const cleaned = cleanJsonString(text);
    const parsed = JSON.parse(cleaned);

    if (Array.isArray(parsed)) {
      return parsed;
    }

    // Single object → wrap in array
    if (typeof parsed === "object" && parsed !== null) {
      return [parsed];
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Clean common JSON formatting issues from model output.
 */
function cleanJsonString(text: string): string {
  let cleaned = text;

  // Remove trailing commas before ] or }
  cleaned = cleaned.replace(/,\s*([}\]])/g, "$1");

  // Fix unescaped newlines in strings (common model error)
  // This is a heuristic and won't catch all cases
  cleaned = cleaned.replace(/(?<=:\s*"[^"]*)\n(?=[^"]*")/g, "\\n");

  // Remove any trailing incomplete JSON (model ran out of tokens)
  // Find the last complete object in the array
  const lastBrace = cleaned.lastIndexOf("}");
  const lastBracket = cleaned.lastIndexOf("]");

  if (lastBrace > lastBracket && lastBracket !== -1) {
    // Array was not closed; close it after the last complete object
    cleaned = cleaned.slice(0, lastBrace + 1) + "]";
  }

  return cleaned;
}
