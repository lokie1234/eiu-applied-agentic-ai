"use client";
import { useState } from "react";
import { DEFAULT_IDENTITY_POLICY, validNumberLimits, type IdentityField, type LearningIdentityPolicy } from "@/lib/learningIdentity";
import styles from "./PasscodeManager.module.css";

export default function LearnerInformationSettings({ policy = DEFAULT_IDENTITY_POLICY, onSave }: { policy?: LearningIdentityPolicy; onSave: (body: Record<string, unknown>) => Promise<boolean> }) {
  const [draft, setDraft] = useState(policy);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [limits, setLimits] = useState<Record<string, { min: string; max: string }>>(() => Object.fromEntries(policy.fields.map(field => [field.id, { min: field.min?.toString() || "", max: field.max?.toString() || "" }])));
  const fieldsWithLimits = draft.fields.map(field => field.type === "number" ? { ...field, min: limits[field.id]?.min ? Number(limits[field.id].min) : undefined, max: limits[field.id]?.max ? Number(limits[field.id].max) : undefined } : field);
  const invalidLimits = fieldsWithLimits.some(field => field.type === "number" && !validNumberLimits(field));
  async function save() {
    if (busy || invalidLimits) return;
    setBusy(true); setNotice("");
    try { if (await onSave({ action: "set_learning_identity_policy", policy: { ...draft, fields: fieldsWithLimits } })) setNotice("Learner information settings saved."); } finally { setBusy(false); }
  }
  function add() {
    setDraft(current => ({ ...current, fields: [...current.fields, { id: `field_${crypto.randomUUID().slice(0, 8)}`, label: "", type: "text" }] }));
  }
  return <section className={styles.identitySettings} aria-labelledby="learner-information-heading" aria-busy={busy}>
    <div className={styles.sectionHeading}><h3 id="learner-information-heading">Learner information</h3><label className={styles.identityToggle}><input type="checkbox" checked={draft.enabled} disabled={busy} onChange={event => setDraft(current => ({ ...current, enabled: event.target.checked }))} />{draft.enabled ? "Enabled" : "Off"}</label></div>
    <p className={styles.identityNote}>Ask learners to complete these fields in a popup after entering their Learning code.</p>
    <div className={styles.identityRows}>{draft.fields.map((field, index) => <div key={field.id} className={styles.identityRow}><input aria-label={`Field ${index + 1} label`} value={field.label} disabled={busy} maxLength={60} placeholder="Field name" onChange={event => setDraft(current => ({ ...current, fields: current.fields.map((item, i) => i === index ? { ...item, label: event.target.value } : item) }))} /><select aria-label={`${field.label || `Field ${index + 1}`} input type`} value={field.type} disabled={busy || field.id === "email"} onChange={event => setDraft(current => ({ ...current, fields: current.fields.map((item, i) => i === index ? { ...item, type: event.target.value as IdentityField["type"] } : item) }))}><option value="text">Text</option><option value="email">Email</option><option value="number">Number</option></select><button type="button" disabled={busy} aria-label={`Remove ${field.label || "field"}`} onClick={() => setDraft(current => ({ ...current, fields: current.fields.filter((_, i) => i !== index) }))}>×</button>{field.type === "number" && <div className={styles.numberLimits}>{(["min", "max"] as const).map(bound => <label key={bound}>{bound === "min" ? "Minimum" : "Maximum"}<input type="number" step="any" aria-label={`${field.label || `Field ${index + 1}`} ${bound === "min" ? "minimum" : "maximum"}`} disabled={busy} placeholder="No limit" value={limits[field.id]?.[bound] || ""} onChange={event => setLimits(current => ({ ...current, [field.id]: { min: current[field.id]?.min || "", max: current[field.id]?.max || "", [bound]: event.target.value } }))} /></label>)}</div>}</div>)}</div>
    {invalidLimits && <p className={styles.limitError} role="alert">Use valid numbers. Minimum must not exceed maximum.</p>}
    <div className={styles.actions}><button type="button" disabled={busy || invalidLimits || (draft.enabled && !draft.fields.length) || draft.fields.some(field => !field.label.trim())} onClick={() => void save()}>{busy ? "Saving…" : "Save settings"}</button><button type="button" disabled={busy || draft.fields.length >= 6} onClick={add}>Add field</button></div>
    <p className={styles.identityNote}>Up to 6 fields · New sign-ins only · Linked to activity reports</p>{notice && <p className={styles.notice} role="status">{notice}</p>}
  </section>;
}
