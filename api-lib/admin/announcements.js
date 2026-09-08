import { createClient } from "@supabase/supabase-js";

const META_PREFIX = "<!--meta:";
const META_SUFFIX = "-->";

function encodeContent(content, meta) {
  const clean = (content || "").replace(/<!--meta:[\s\S]*?-->\n?/g, "").trim();
  const metaObj = {
    is_pinned: Boolean(meta.is_pinned),
    priority: meta.priority || "normal",
    show_popup: Boolean(meta.show_popup),
    expires_at: meta.expires_at || null,
  };
  return `${META_PREFIX}${JSON.stringify(metaObj)}${META_SUFFIX}\n${clean}`;
}

export default async function handler(req, res) {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return res.status(500).json({ error: "Server missing Supabase service configuration" });
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
  const { method } = req;

  try {
    if (method === "GET") {
      const { data, error } = await supabaseAdmin
        .from("announcements")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return res.status(200).json(data || []);
    }

    if (method === "POST") {
      const { title, content, image_url, created_by, is_active, is_pinned, priority, show_popup, expires_at } = req.body;
      const encodedContent = encodeContent(content, { is_pinned, priority, show_popup, expires_at });

      const payload = {
        title,
        content: encodedContent,
        image_url: image_url || null,
        created_by: created_by || null,
        is_active: is_active !== false,
      };

      const { data, error } = await supabaseAdmin
        .from("announcements")
        .insert(payload)
        .select()
        .single();

      if (error) throw error;
      return res.status(200).json({ ok: true, data });
    }

    if (method === "PUT") {
      const { id, title, content, image_url, is_active, is_pinned, priority, show_popup, expires_at } = req.body;

      const updateData = { updated_at: new Date().toISOString() };
      if (typeof is_active === "boolean") updateData.is_active = is_active;
      if (title !== undefined) updateData.title = title;
      if (image_url !== undefined) updateData.image_url = image_url;

      if (content !== undefined) {
        updateData.content = encodeContent(content, { is_pinned, priority, show_popup, expires_at });
      }

      const { data, error } = await supabaseAdmin
        .from("announcements")
        .update(updateData)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return res.status(200).json({ ok: true, data });
    }

    if (method === "DELETE") {
      const { error } = await supabaseAdmin
        .from("announcements")
        .delete()
        .eq("id", req.body.id);

      if (error) throw error;
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (err) {
    console.error("Announcements API Error:", err);
    return res.status(500).json({ error: err.message });
  }
}
