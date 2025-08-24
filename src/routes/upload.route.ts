import { Hono, Context } from "hono";
import { supabaseMiddleware } from "../middlewares/supabase.middleware";

const app = new Hono();

app.post("/", supabaseMiddleware, async (c: Context) => {
  const supabase = c.get("supabase") as any;
  const formData = await c.req.parseBody();
  const file = formData["file"] as File | undefined;
  const bucket = formData["bucket"];
  if (!bucket) {
    return c.json({ error: "Missing required field: bucket" }, 400);
  }
  const path =
    formData["path"] || (file && (file as any).name) || "uploaded-file";

  if (!file) {
    return c.json({ error: "No file uploaded" }, 400);
  }

  // file is a Blob, but supabase-js expects a File or Buffer
  const { data, error } = await supabase.storage
    .from(bucket)
    .upload(path, file, { upsert: true });
  if (error) {
    return c.json({ error: error.message }, 400);
  }
  const { data: publicUrl } = supabase.storage.from(bucket).getPublicUrl(path);
  return c.json({ url: publicUrl.publicUrl });
});

export default app;
