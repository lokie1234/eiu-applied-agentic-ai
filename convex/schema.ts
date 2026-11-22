import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

const question = v.object({ number: v.number(), title: v.optional(v.string()), prompt: v.string(), starterCode: v.string(), tasks: v.optional(v.array(v.object({ label: v.string(), code: v.string() }))) });
const target = v.object({subject:v.string(),username:v.string()});
const schema = defineSchema({
  livePresentations: defineTable({ sectionId: v.string(), owner: v.string(), epoch: v.string(), active: v.boolean(), revision: v.number(), sequence: v.number(), updatedAt: v.number(), patch: v.string(), rateStart: v.number(), rateCount: v.number(), peers:v.optional(v.array(v.object({id:v.string(),offer:v.string(),answer:v.optional(v.string()),updatedAt:v.number()}))) }).index('room', ['sectionId']),
  liveSnapshots: defineTable({ sectionId: v.string(), document: v.string() }).index('room', ['sectionId']),
  signals: defineTable({ sectionId: v.string(), topic: v.string(), revision: v.number() }).index("scope", ["sectionId", "topic"]),
  presence: defineTable({ sectionId: v.string(), subject: v.string(), clientId: v.string(), expiresAt: v.number(), expiryJob: v.optional(v.id("_scheduled_functions")) })
    .index("room", ["sectionId"]).index("person", ["subject", "sectionId", "clientId"]),
  counts: defineTable({ sectionId: v.string(), online: v.number(), subjects: v.array(v.string()) }).index("room", ["sectionId"]).index('active',['online']),
  limits: defineTable({ subject: v.string(), start: v.number(), count: v.number(), blockedUntil: v.number() }).index("person", ["subject"]),
  spotlight: defineTable({ sectionId: v.string(), slide: v.number(), epoch: v.string(), requestId: v.string(), subject: v.string(), username: v.string(), targets:v.optional(v.array(target)), createdAt: v.number(), revealAt: v.number() }).index('room', ['sectionId', 'slide']),
  spotlightRequests: defineTable({ sectionId: v.string(), epoch: v.string(), requestId: v.string(), slide: v.number(), subject: v.string(), username: v.string(), targets:v.optional(v.array(target)), createdAt: v.number(), revealAt: v.number(), expiresAt: v.number() }).index('request', ['sectionId', 'requestId']),
  classroom: defineTable({ sectionId: v.string(), version: v.number(), epoch: v.string(),
    wheelEnabled:v.optional(v.boolean()),wheelCount:v.optional(v.number()),wheelTargets:v.optional(v.array(v.string())),
    wheelResetAt:v.optional(v.number()),wheelResetId:v.optional(v.string()),wheelResetSequence:v.optional(v.string()),
    questionSetup: v.optional(v.array(question)),
    members: v.array(v.object({ subject: v.string(), username: v.string() })),
    draw: v.optional(v.object({ requestId: v.string(), names: v.array(v.string()), parts: v.optional(v.array(v.number())), subjects: v.optional(v.array(v.string())), createdAt: v.number(), assignmentVersion: v.optional(v.number()), questions: v.optional(v.array(question)) })),
    demoDraw: v.optional(v.object({ requestId: v.string(), names: v.array(v.string()), subjects: v.optional(v.array(v.string())), createdAt: v.number(), assignmentVersion: v.optional(v.number()), questions: v.optional(v.array(question)) })),
  }).index("room", ["sectionId"]),
  practiceAnswers: defineTable({ sectionId: v.string(), recordId: v.string(), subject: v.string(), username: v.string(),
    assignmentPart: v.optional(v.number()), questionNumber: v.optional(v.number()), drawId: v.optional(v.string()),
    partId: v.string(), values: v.record(v.string(), v.string()), submittedAt: v.string(),
  }).index("room", ["sectionId"]).index("record", ["sectionId", "recordId"]),
});

export default schema;
