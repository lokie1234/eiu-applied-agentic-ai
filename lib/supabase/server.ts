import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseFetch } from "./fetch";

let adminClient: SupabaseClient | null = null;
const boundedFetch = createSupabaseFetch();
const scopedClients = new WeakMap<AbortSignal, SupabaseClient>();

export function getSupabaseAdmin(signal?: AbortSignal): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const secretKey = (
    process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY
  )?.trim();

  if (!url || !secretKey) {
    throw new Error(
      "Supabase chưa được cấu hình. Hãy thêm NEXT_PUBLIC_SUPABASE_URL và SUPABASE_SECRET_KEY.",
    );
  }

  if (signal) {
    let client = scopedClients.get(signal);
    if (!client) {
      client = createClient(url, secretKey, {
        auth: { autoRefreshToken: false, persistSession: false },
        global: { fetch: (input, init) => boundedFetch(input, { ...init, signal: init?.signal ? AbortSignal.any([init.signal, signal]) : signal }) },
      });
      scopedClients.set(signal, client);
    }
    return client;
  }
  if (!adminClient) {
    adminClient = createClient(url, secretKey, {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { fetch: boundedFetch },
    });
  }

  return adminClient;
}
