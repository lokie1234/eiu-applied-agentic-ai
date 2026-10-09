export type IdentityField = { id: string; label: string; type: "text" | "email" | "number"; min?: number; max?: number };
export type LearningIdentityPolicy = { enabled: boolean; fields: IdentityField[] };
export type LearnerIdentity = { sessionId: string; name: string; email: string; information: Record<string, string>; fields?: IdentityField[] };
export const DEFAULT_IDENTITY_POLICY: LearningIdentityPolicy = { enabled: false, fields: [{ id: "name", label: "Name", type: "text" }, { id: "email", label: "Email", type: "email" }] };

export function validNumberLimits(field: IdentityField) {
  return (field.min === undefined || (typeof field.min === "number" && Number.isFinite(field.min))) && (field.max === undefined || (typeof field.max === "number" && Number.isFinite(field.max))) && (field.min === undefined || field.max === undefined || field.min <= field.max);
}

export function parseIdentityPolicy(value: unknown): LearningIdentityPolicy {
  if (!value || typeof value !== "object") return DEFAULT_IDENTITY_POLICY;
  const row = value as LearningIdentityPolicy;
  const fields = Array.isArray(row.fields) ? row.fields.filter(field => field && typeof field.id === "string" && /^[a-z][a-z0-9_-]{0,39}$/.test(field.id) && typeof field.label === "string" && field.label.trim() && field.label.length <= 60 && ["text", "email", "number"].includes(field.type) && (field.type !== "number" || validNumberLimits(field))).slice(0, 6).map(field => ({ id: field.id, label: field.label.trim(), type: field.type, ...(field.type === "number" ? { min: field.min, max: field.max } : {}) })) : DEFAULT_IDENTITY_POLICY.fields;
  return { enabled: row.enabled === true, fields: fields.filter((field, index) => fields.findIndex(other => other.id === field.id) === index) };
}

export function validateIdentityInformation(policy: LearningIdentityPolicy, input: unknown) {
  const source = input && typeof input === "object" ? input as Record<string, unknown> : {};
  const values: Record<string, string> = {};
  for (const field of policy.fields) {
    const raw = source[field.id];
    const value = typeof raw === "string" ? raw.trim() : "";
    if (!value || value.length > 200) return { error: `Please enter ${field.label} (up to 200 characters).` };
    if (field.type === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return { error: `Please enter a valid ${field.label}.` };
    if (field.type === "number") {
      const number = Number(value);
      if (!/^[-+]?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?$/i.test(value) || !Number.isFinite(number)) return { error: `Please enter a valid number for ${field.label}.` };
      if (field.min !== undefined && number < field.min) return { error: `${field.label} must be at least ${field.min}.` };
      if (field.max !== undefined && number > field.max) return { error: `${field.label} must be at most ${field.max}.` };
    }
    values[field.id] = field.type === "email" ? value.toLowerCase() : value;
  }
  return { values };
}
