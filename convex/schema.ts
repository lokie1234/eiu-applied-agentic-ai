import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

const schema = defineSchema({
  signals: defineTable({ sectionId: v.string(), topic: v.string(), revision: v.number() }).index("scope", ["sectionId", "topic"]),
  presence: defineTable({ sectionId: v.string(), subject: v.string(), clientId: v.string(), expiresAt: v.number(), expiryJob: v.optional(v.id("_scheduled_functions")) })
    .index("room", ["sectionId"]).index("person", ["subject", "sectionId", "clientId"]),
  counts: defineTable({ sectionId: v.string(), online: v.number(), subjects: v.array(v.string()) }).index("room", ["sectionId"]),
  limits: defineTable({ subject: v.string(), start: v.number(), count: v.number(), blockedUntil: v.number() }).index("person", ["subject"]),
  classroom: defineTable({ sectionId: v.string(), version: v.number(), epoch: v.string(),
    members: v.array(v.object({ subject: v.string(), username: v.string() })),
    draw: v.optional(v.object({ requestId: v.string(), names: v.array(v.string()), subjects: v.optional(v.array(v.string())), createdAt: v.number() })),
    demoDraw: v.optional(v.object({ requestId: v.string(), names: v.array(v.string()), subjects: v.optional(v.array(v.string())), createdAt: v.number() })),
  }).index("room", ["sectionId"]),
  practiceAnswers: defineTable({ sectionId: v.string(), recordId: v.string(), subject: v.string(), username: v.string(),
    partId: v.string(), values: v.record(v.string(), v.string()), submittedAt: v.string(),
  }).index("room", ["sectionId"]).index("record", ["sectionId", "recordId"]),
});

export default schema;
