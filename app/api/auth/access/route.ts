import { createHash, randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { getCoursesAndSectionsData } from "@/lib/auth/courseAccessStorage";
import { hashPasscode, resolvePasscode, resolveFreeAccess } from "@/lib/auth/passcodes";
import { ACCESS_SESSION_COOKIE, createAccessSession, sessionCookieOptions } from "@/lib/auth/session";
import { parseIdentityPolicy, validateIdentityInformation } from "@/lib/learningIdentity";
import { getAdminCredential, verifyAdminPassword } from "@/lib/auth/adminPassword";
import { FIXED_ADMIN_EMAIL } from "@/lib/auth/types";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    if (body.freeAccess === true) {
      if (!resolveFreeAccess(await getCoursesAndSectionsData())) return NextResponse.json({ success: false, message: "No free courses are available right now." }, { status: 403 });
      const response = NextResponse.json({ success: true, destination: "/learn" });
      response.cookies.set(ACCESS_SESSION_COOKIE, createAccessSession({ role: "guest", sessionId: randomUUID() }), sessionCookieOptions());
      return response;
    }
    const passcode = typeof body.passcode === "string" ? body.passcode.trim() : typeof body.password === "string" ? body.password.trim() : "";
    if (!/^[A-Za-z0-9-]{4,32}$/.test(passcode)) return NextResponse.json({ success: false, message: "Please enter a valid passcode." }, { status: 400 });
    const db = getSupabaseAdmin(request.signal);
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
    const fingerprint = createHash("sha256").update(ip).digest("hex");
    const [{ count, error }, catalog] = await Promise.all([db.from("access_audit_logs").select("id", { count: "exact", head: true })
      .eq("action", "PASSCODE_LOGIN_FAILED").contains("details", { fingerprint })
      .gte("created_at", new Date(Date.now() - 15 * 60 * 1000).toISOString()), getCoursesAndSectionsData(request.signal)]);
    if (error) throw error;
    if ((count ?? 0) >= 10) return NextResponse.json({ success: false, message: "Too many attempts. Please try again in 15 minutes." }, { status: 429 });

    if (verifyAdminPassword(passcode)) {
      const credential = await getAdminCredential(request.signal);
      try {
        await db.from("access_audit_logs").insert({
          actor_email: FIXED_ADMIN_EMAIL,
          action: "ADMIN_PASSWORD_LOGIN",
          details: { fingerprint },
        });
      } catch (logError) {
        console.error("Admin login audit log error:", logError);
      }
      const response = NextResponse.json({ success: true, destination: "/admin/access" });
      response.cookies.set(
        ACCESS_SESSION_COOKIE,
        createAccessSession({
          role: "admin",
          authMethod: "password",
          email: FIXED_ADMIN_EMAIL,
          sessionVersion: credential?.session_version ?? 0,
        }),
        sessionCookieOptions()
      );
      return response;
    }

    const credentialHash = hashPasscode(passcode);
    const access = resolvePasscode(catalog, credentialHash);
    if (!access) {
      const { error: auditError } = await db.from("access_audit_logs").insert({ action: "PASSCODE_LOGIN_FAILED", details: { fingerprint } });
      if (auditError) throw auditError;
      return NextResponse.json({ success: false, message: "Incorrect or inactive passcode. Please contact your instructor." }, { status: 401 });
    }
    const teaching = access.sections.some(section => section.canFacilitate);
    const policy = parseIdentityPolicy(catalog.learningIdentityPolicy);
    let information: Record<string, string> = {};
    if (!teaching && policy.enabled) {
      if (!body.information) return NextResponse.json({ success: false, requiresInformation: true, fields: policy.fields });
      const validated = validateIdentityInformation(policy, body.information);
      if (validated.error) return NextResponse.json({ success: false, requiresInformation: true, fields: policy.fields, message: validated.error }, { status: 400 });
      information = validated.values!;
    }
    const sessionId = randomUUID();
    const identity = { sessionId, name: information.name || (teaching ? "Facilitator" : `Learner ${sessionId.slice(0, 6)}`), email: information.email || Object.entries(information).find(([id]) => policy.fields.some(field => field.id === id && field.type === "email"))?.[1] || `${sessionId}@passcode.eiu`, information };
    const scopes = access.sections.map(section => { const course=access.courses.find(course=>course.id===section.course_id);return { sectionId:section.id,section:section.section_key,sectionTitle:section.title,courseId:section.course_id,courseTitle:course?.title,folderGroupId:course?.folderGroupId,folderGroupName:course?.folderGroupName }; });
    const { data: identityLog, error: identityError } = await db.from("access_audit_logs").insert({ action: "PASSCODE_LOGIN", actor_email: identity.email, details: { ...identity, accessMode: teaching ? "facilitator" : "learner", scopeMode:"access", scopes, sectionKeys: [...new Set(access.sections.map(section => section.section_key))], fields: !teaching && policy.enabled ? policy.fields : [] } }).select("id").single();
    if (identityError || !identityLog) throw identityError || new Error("Unable to save the learner identity.");
    const response = NextResponse.json({ success: true, destination: "/learn" });
    response.cookies.set(ACCESS_SESSION_COOKIE, createAccessSession({ role: "passcode", credentialHash, sessionId, identityLogId: Number(identityLog.id) }), sessionCookieOptions());
    return response;
  } catch {
    return NextResponse.json({ success: false, message: "Unable to sign in right now. Please try again later." }, { status: 500 });
  }
}
