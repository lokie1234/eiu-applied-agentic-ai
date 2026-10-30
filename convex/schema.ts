import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

const question = v.object({ number: v.number(), title: v.optional(v.string()), prompt: v.string(), starterCode: v.string(), tasks: v.optional(v.array(v.object({ label: v.string(), code: v.string() }))) });
const schema = defineSchema({
  signals: defineTable({ sectionId: v.string(), topic: v.string(), revision: v.number() }).index("scope", ["sectionId", "topic"]),
  presence: defineTable({ sectionId: v.string(), subject: v.string(), clientId: v.string(), expiresAt: v.number(), expiryJob: v.optional(v.id("_scheduled_functions")) })
    .index("room", ["sectionId"]).index("person", ["subject", "sectionId", "clientId"]),
  counts: defineTable({ sectionId: v.string(), online: v.number(), subjects: v.array(v.string()) }).index("room", ["sectionId"]),
  limits: defineTable({ subject: v.string(), start: v.number(), count: v.number(), blockedUntil: v.number() }).index("person", ["subject"]),
  classroom: defineTable({ sectionId: v.string(), version: v.number(), epoch: v.string(),
    questionSetup: v.optional(v.array(question)),
    members: v.array(v.object({ subject: v.string(), username: v.string() })),
    draw: v.optional(v.object({ requestId: v.string(), names: v.array(v.string()), subjects: v.optional(v.array(v.string())), createdAt: v.number(), assignmentVersion: v.optional(v.number()), questions: v.optional(v.array(question)) })),
    demoDraw: v.optional(v.object({ requestId: v.string(), names: v.array(v.string()), subjects: v.optional(v.array(v.string())), createdAt: v.number(), assignmentVersion: v.optional(v.number()), questions: v.optional(v.array(question)) })),
  }).index("room", ["sectionId"]),
  practiceAnswers: defineTable({ sectionId: v.string(), recordId: v.string(), subject: v.string(), username: v.string(),
    assignmentPart: v.optional(v.number()), questionNumber: v.optional(v.number()), drawId: v.optional(v.string()),
    partId: v.string(), values: v.record(v.string(), v.string()), submittedAt: v.string(),
  }).index("room", ["sectionId"]).index("record", ["sectionId", "recordId"]),
});

export default schema;
