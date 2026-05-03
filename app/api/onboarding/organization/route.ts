import { NextResponse } from "next/server";
import { createSupabaseRouteHandlerClient } from "@/lib/supabase-route-handler";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { sanitizeString } from "@/lib/api-validation";
import { onboardingOrganizationBodySchema } from "@/lib/api-body-schemas";
import { checkAuthenticatedPostRouteLimit } from "@/lib/rate-limit";

export async function POST(req: Request) {
  try {
    const supabase = await createSupabaseRouteHandlerClient();
    const {
      data: { user },
      error: uErr,
    } = await supabase.auth.getUser();
    if (uErr || !user) {
      return NextResponse.json({ error: "נדרשת התחברות" }, { status: 401 });
    }

    const admin = getSupabaseAdmin();
    const rl = await checkAuthenticatedPostRouteLimit(
      admin,
      user.id,
      "onboarding-organization",
    );
    if (rl.isLimited) {
      return NextResponse.json(
        { error: "יותר מדי בקשות. נסו שוב בעוד דקה." },
        { status: 429 },
      );
    }

    const { data: existing } = await admin
      .from("organization_users")
      .select("organization_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (existing?.organization_id) {
      return NextResponse.json({
        organization_id: existing.organization_id as string,
        already: true,
      });
    }

    let rawBody: unknown = {};
    try {
      rawBody = await req.json();
    } catch {
      rawBody = {};
    }
    const bp = onboardingOrganizationBodySchema.safeParse(rawBody);
    if (!bp.success) {
      return NextResponse.json({ error: bp.error.flatten() }, { status: 400 });
    }
    const name = sanitizeString(bp.data.name);
    if (!name) {
      return NextResponse.json({ error: "שם ארגון נדרש" }, { status: 400 });
    }

    const { data: newClient, error: clientInsErr } = await admin
      .from("clients")
      .insert({ name: name.trim() })
      .select("id")
      .single();

    if (clientInsErr || !newClient) {
      return NextResponse.json(
        { error: clientInsErr?.message || "יצירת לקוח נכשלה" },
        { status: 500 },
      );
    }

    const clientId = (newClient as { id: string }).id;

    const base =
      name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 32) || "org";

    let orgId: string | null = null;
    for (let i = 0; i < 8; i++) {
      const slug = `${base}-${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;
      const { data: org, error } = await admin
        .from("organizations")
        .insert({ name, slug, client_id: clientId })
        .select("id")
        .single();

      if (!error && org && (org as { id: string }).id) {
        orgId = (org as { id: string }).id;
        break;
      }
      const code = (error as { code?: string } | null)?.code;
      if (code && code !== "23505") {
        return NextResponse.json(
          { error: error?.message || "שגיאת שרת" },
          { status: 500 },
        );
      }
    }

    if (!orgId) {
      return NextResponse.json(
        { error: "לא ניתן ליצור ארגון" },
        { status: 500 },
      );
    }

    const { error: ouErr } = await admin.from("organization_users").insert({
      organization_id: orgId,
      user_id: user.id,
      role: "admin",
    });

    if (ouErr) {
      return NextResponse.json({ error: ouErr.message }, { status: 500 });
    }

    return NextResponse.json({ organization_id: orgId });
  } catch (e) {
    console.error("[onboarding/organization]", e);
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
