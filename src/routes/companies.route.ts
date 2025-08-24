import { Context, Hono } from "hono";
import { supabaseMiddleware } from "../middlewares/supabase.middleware";

const app = new Hono();

app.post("/", supabaseMiddleware, async (c: Context) => {
  const supabase = c.get("supabase") as any;
  const formData = await c.req.parseBody();
  const name = formData["name"];
  const domain = formData["domain"];
  const subdomain = formData["subdomain"];
  const profileImage = formData["profile_image"] as File | undefined;
  const favicon = formData["favicon"] as File | undefined;

  // Basic validation
  if (!name || !domain || !subdomain) {
    return c.json({ error: "Missing required fields" }, 400);
  }

  let profile_image_url = undefined;
  let favicon_url = undefined;
  const bucket = "company_assets";

  // Upload images if present
  if (profileImage) {
    // Upload profile image to Supabase Storage
    const profilePath = `profile_images/${Date.now()}_${
      (profileImage as any).name || "profile"
    }`;
    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(profilePath, profileImage, { upsert: true });
    if (!uploadError) {
      const { data: publicUrl } = supabase.storage
        .from(bucket)
        .getPublicUrl(profilePath);
      profile_image_url = publicUrl.publicUrl;
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

  // Unique domain validation
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
    .insert([{ name, domain, subdomain, profile_image_url, favicon_url }])
    .select();

  if (error) {
    return c.json({ error: error.message }, 400);
  }

  return c.json({ company: data[0] }, 201);
});

export default app;
