import { Context, Hono } from "hono";
import { supabaseMiddleware } from "../middlewares/supabase.middleware";
import { userMiddleware } from "../middlewares/user.middleware";
import * as jose from "jose";

const app = new Hono();

app.post("/", supabaseMiddleware, userMiddleware, async (c: Context) => {
  const supabase = c.get("supabase") as any;
  const formData = await c.req.parseBody();
  const name = formData["name"];
  const domain = formData["domain"];
  const subdomain = formData["subdomain"];
  const logoFile = formData["logo"] as File | undefined;
  const favicon = formData["favicon"] as File | undefined;

  // Basic validation
  if (!name || !domain || !subdomain) {
    return c.json({ error: "Missing required fields" }, 400);
  }
  // Get user info from middleware
  const user = c.get("user");
  if (!user || !user.idToken) {
    return c.json({ error: "Unauthorized: user not authenticated" }, 401);
  }
  // Resolve internal account id from Auth0 sub
  let accountId: string | null = null;
  try {
    const decoded = jose.decodeJwt(user.idToken) as Record<string, any>;
    const sub = decoded?.sub as string | undefined;
    if (!sub) return c.json({ error: "Invalid user token (no sub)" }, 401);
    const { data: acc, error: accErr } = await supabase
      .from("users")
      .select("id, type")
      .eq("external_id", sub)
      .maybeSingle();
    if (accErr) return c.json({ error: accErr.message }, 400);
    if (!acc) return c.json({ error: "Account not found" }, 404);
    accountId = acc.id;
  } catch (e) {
    return c.json({ error: "Invalid user token" }, 401);
  }

  let logo_url = undefined;
  let favicon_url = undefined;
  const bucket = "company_assets";

  // Upload images if present
  if (logoFile) {
    // Upload logo image to Supabase Storage
    const logoPath = `logos/${Date.now()}_${
      (logoFile as any).name || "logo"
    }`;
    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(logoPath, logoFile, { upsert: true });
    if (!uploadError) {
      const { data: publicUrl } = supabase.storage
        .from(bucket)
        .getPublicUrl(logoPath);
      logo_url = publicUrl.publicUrl;
    }
  }
  if (favicon) {
    // Upload favicon to Supabase Storage
    const faviconPath = `favicons/${Date.now()}_${
      (favicon as any).name || "favicon"
    }`;
    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(faviconPath, favicon, { upsert: true });
    if (!uploadError) {
      const { data: publicUrl } = supabase.storage
        .from(bucket)
        .getPublicUrl(faviconPath);
      favicon_url = publicUrl.publicUrl;
    }
  }

  // Unique domain validation (domain must stay unique; subdomain can repeat)
  const { data: existingDomain } = await supabase
    .from("companies")
    .select("id")
    .eq("domain", domain)
    .maybeSingle();
  if (existingDomain) {
    return c.json({ error: "Domain is already registered." }, 409);
  }

  // Insert new company into companies table
  const { data, error } = await supabase
    .from("companies")
    .insert([{ name, domain, subdomain, logo_url, favicon_url }])
    .select();

  if (error) {
    // Handle race condition unique violations gracefully
    if (error.code === "23505" && error.message?.includes("companies_domain_key")) {
      return c.json({ error: "Domain is already registered." }, 409);
    }
    return c.json({ error: error.message }, 400);
  }

  const company = data[0];
  // Insert association in company_users as owner
  const { error: cuError } = await supabase
    .from("company_users")
    .insert([{ company_id: company.id, user_id: accountId, role: "owner" }]);
  if (cuError) {
    return c.json({ error: cuError.message, company }, 201); // Company creada, pero error en asociación
  }

  return c.json({ company }, 201);
});

export default app;
