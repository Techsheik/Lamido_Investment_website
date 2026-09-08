export interface AnnouncementMeta {
  is_pinned?: boolean;
  priority?: "normal" | "important" | "urgent" | "maintenance";
  show_popup?: boolean;
  expires_at?: string | null;
}

export interface Announcement {
  id: string;
  title: string;
  content: string;
  image_url?: string | null;
  created_at: string;
  updated_at?: string;
  created_by?: string;
  is_active: boolean;
  is_pinned?: boolean;
  priority?: "normal" | "important" | "urgent" | "maintenance";
  show_popup?: boolean;
  expires_at?: string | null;
  raw_content?: string;
}

const META_PREFIX = "<!--meta:";
const META_SUFFIX = "-->";

/**
 * Parses embedded JSON metadata from announcement content
 */
export function parseAnnouncement(item: any): Announcement {
  let content = item.content || "";
  let meta: AnnouncementMeta = {
    is_pinned: Boolean(item.is_pinned),
    priority: item.priority || "normal",
    show_popup: Boolean(item.show_popup),
    expires_at: item.expires_at || null,
  };

  while (content.startsWith(META_PREFIX)) {
    const endIndex = content.indexOf(META_SUFFIX);
    if (endIndex > -1) {
      try {
        const jsonStr = content.substring(META_PREFIX.length, endIndex);
        const parsedMeta = JSON.parse(jsonStr);
        meta = { ...meta, ...parsedMeta };
        content = content.substring(endIndex + META_SUFFIX.length).trim();
      } catch (err) {
        console.error("Failed to parse announcement metadata:", err);
        break;
      }
    } else {
      break;
    }
  }

  return {
    ...item,
    content,
    raw_content: item.content,
    is_active: item.is_active !== false,
    is_pinned: meta.is_pinned || false,
    priority: meta.priority || "normal",
    show_popup: meta.show_popup || false,
    expires_at: meta.expires_at || null,
  };
}

/**
 * Encodes metadata into announcement content
 */
export function encodeAnnouncementContent(
  cleanContent: string,
  meta: AnnouncementMeta
): string {
  const metaObj = {
    is_pinned: Boolean(meta.is_pinned),
    priority: meta.priority || "normal",
    show_popup: Boolean(meta.show_popup),
    expires_at: meta.expires_at || null,
  };
  return `${META_PREFIX}${JSON.stringify(metaObj)}${META_SUFFIX}\n${cleanContent.trim()}`;
}

/**
 * Checks if an announcement is currently expired
 */
export function isAnnouncementExpired(announcement: Announcement): boolean {
  if (!announcement.expires_at) return false;
  const expiry = new Date(announcement.expires_at).getTime();
  return !isNaN(expiry) && expiry <= Date.now();
}
