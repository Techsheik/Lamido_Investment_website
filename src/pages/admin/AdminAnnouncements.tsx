import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { AdminLayout } from "@/components/AdminLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Trash2, Plus, Edit2, Pin, BellRing, AlertTriangle, Wrench, Info, Calendar, Megaphone, CheckCircle2, XCircle } from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { parseAnnouncement, isAnnouncementExpired, Announcement } from "@/lib/announcement-utils";

export default function AdminAnnouncements() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [filterTab, setFilterTab] = useState<string>("all");

  const [formData, setFormData] = useState({
    title: "",
    content: "",
    priority: "normal" as "normal" | "important" | "urgent" | "maintenance",
    is_active: true,
    is_pinned: false,
    show_popup: false,
    expires_at: "",
    image: null as File | null,
  });

  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const { data: announcements, isLoading } = useQuery({
    queryKey: ["admin-announcements"],
    queryFn: async () => {
      try {
        const response = await fetch("/api/admin/announcements");
        if (response.ok) {
          const data = await response.json();
          return (data || []).map((item: any) => parseAnnouncement(item));
        }
      } catch (e) {
        console.warn("API route fetch warning, using direct Supabase query:", e);
      }

      const { data, error } = await supabase
        .from("announcements")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data || []).map((item: any) => parseAnnouncement(item));
    },
    refetchInterval: 10000,
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not authenticated");
      if (!formData.title.trim() || !formData.content.trim()) {
        throw new Error("Title and content are required");
      }

      setUploading(true);
      let imageUrl = imagePreview;

      if (formData.image) {
        const fileName = `${Date.now()}-${formData.image.name}`;
        const { error: uploadError } = await supabase.storage
          .from("announcements")
          .upload(`${user.id}/${fileName}`, formData.image);

        if (uploadError) {
          setUploading(false);
          throw uploadError;
        }

        const { data } = supabase.storage
          .from("announcements")
          .getPublicUrl(`${user.id}/${fileName}`);
        imageUrl = data.publicUrl;
      }

      const payload = {
        title: formData.title,
        content: formData.content,
        priority: formData.priority,
        is_active: formData.is_active,
        is_pinned: formData.is_pinned,
        show_popup: formData.show_popup,
        expires_at: formData.expires_at ? new Date(formData.expires_at).toISOString() : null,
        image_url: imageUrl,
        created_by: user.id,
      };

      const endpoint = "/api/admin/announcements";
      const method = editingId ? "PUT" : "POST";
      const bodyPayload = editingId ? { id: editingId, ...payload } : payload;

      const response = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bodyPayload),
      });

      setUploading(false);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to save announcement");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-announcements"] });
      queryClient.invalidateQueries({ queryKey: ["announcements"] });
      queryClient.invalidateQueries({ queryKey: ["latest-announcement"] });
      
      toast({
        title: "Success! 📢",
        description: editingId ? "Announcement updated successfully." : "New announcement created and published.",
      });

      handleCloseDialog();
    },
    onError: (error: any) => {
      toast({
        title: "Error saving announcement",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const response = await fetch("/api/admin/announcements", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, is_active }),
      });
      if (!response.ok) throw new Error("Failed to update status");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-announcements"] });
      queryClient.invalidateQueries({ queryKey: ["announcements"] });
      toast({ title: "Updated", description: "Announcement visibility updated." });
    },
  });

  const togglePinnedMutation = useMutation({
    mutationFn: async (announcement: Announcement) => {
      const response = await fetch("/api/admin/announcements", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: announcement.id,
          content: announcement.content,
          is_pinned: !announcement.is_pinned,
          priority: announcement.priority,
          show_popup: announcement.show_popup,
          expires_at: announcement.expires_at,
        }),
      });
      if (!response.ok) throw new Error("Failed to update pin state");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-announcements"] });
      queryClient.invalidateQueries({ queryKey: ["announcements"] });
      toast({ title: "Updated", description: "Announcement pinned state updated." });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch("/api/admin/announcements", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (!response.ok) throw new Error("Failed to delete");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-announcements"] });
      queryClient.invalidateQueries({ queryKey: ["announcements"] });
      toast({ title: "Deleted", description: "Announcement deleted." });
    },
  });

  const handleOpenDialog = (item?: Announcement) => {
    if (item) {
      setEditingId(item.id);
      setFormData({
        title: item.title,
        content: item.content,
        priority: item.priority || "normal",
        is_active: item.is_active,
        is_pinned: Boolean(item.is_pinned),
        show_popup: Boolean(item.show_popup),
        expires_at: item.expires_at ? new Date(item.expires_at).toISOString().slice(0, 16) : "",
        image: null,
      });
      setImagePreview(item.image_url || null);
    } else {
      setEditingId(null);
      setFormData({
        title: "",
        content: "",
        priority: "normal",
        is_active: true,
        is_pinned: false,
        show_popup: false,
        expires_at: "",
        image: null,
      });
      setImagePreview(null);
    }
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingId(null);
    setImagePreview(null);
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast({ title: "Error", description: "Image must be less than 5MB", variant: "destructive" });
        return;
      }
      setFormData((prev) => ({ ...prev, image: file }));
      const reader = new FileReader();
      reader.onload = (ev) => setImagePreview(ev.target?.result as string);
      reader.readAsDataURL(file);
    }
  };

  const filteredAnnouncements = (announcements || []).filter((item: Announcement) => {
    if (filterTab === "active") return item.is_active && !isAnnouncementExpired(item);
    if (filterTab === "draft") return !item.is_active;
    if (filterTab === "pinned") return item.is_pinned;
    if (filterTab === "expired") return isAnnouncementExpired(item);
    return true;
  });

  const getPriorityBadge = (priority?: string) => {
    switch (priority) {
      case "urgent":
        return (
          <Badge className="bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30 gap-1 font-semibold">
            <AlertTriangle className="w-3 h-3" /> URGENT
          </Badge>
        );
      case "important":
        return (
          <Badge className="bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30 gap-1 font-semibold">
            <BellRing className="w-3 h-3" /> IMPORTANT
          </Badge>
        );
      case "maintenance":
        return (
          <Badge className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30 gap-1 font-semibold">
            <Wrench className="w-3 h-3" /> MAINTENANCE
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="text-blue-500 border-blue-500/30 gap-1 font-semibold">
            <Info className="w-3 h-3" /> NORMAL
          </Badge>
        );
    }
  };

  if (isLoading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center min-h-[50vh]">
          <p className="text-muted-foreground">Loading announcement manager...</p>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Megaphone className="w-7 h-7 text-amber-500" />
              Announcement Management
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Create broadcasts, pin critical notices, set priority alerts & popup login notifications
            </p>
          </div>

          <Button onClick={() => handleOpenDialog()} className="bg-primary text-primary-foreground font-semibold gap-2">
            <Plus className="h-4 w-4" />
            Create Announcement
          </Button>
        </div>

        {/* Filter Controls */}
        <div className="flex items-center gap-2 border-b pb-3">
          <span className="text-xs font-semibold text-muted-foreground mr-2">Filter:</span>
          {[
            { id: "all", label: `All (${announcements?.length || 0})` },
            { id: "active", label: `Published (${announcements?.filter((a: any) => a.is_active && !isAnnouncementExpired(a)).length || 0})` },
            { id: "pinned", label: `Pinned 📌 (${announcements?.filter((a: any) => a.is_pinned).length || 0})` },
            { id: "draft", label: `Drafts (${announcements?.filter((a: any) => !a.is_active).length || 0})` },
            { id: "expired", label: `Expired (${announcements?.filter((a: any) => isAnnouncementExpired(a)).length || 0})` },
          ].map((tab) => (
            <Button
              key={tab.id}
              variant={filterTab === tab.id ? "default" : "ghost"}
              size="sm"
              className="text-xs h-8"
              onClick={() => setFilterTab(tab.id)}
            >
              {tab.label}
            </Button>
          ))}
        </div>

        {/* Announcement Cards */}
        <div className="space-y-4">
          {filteredAnnouncements.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <p>No announcements found in this filter.</p>
              </CardContent>
            </Card>
          ) : (
            filteredAnnouncements.map((item: Announcement) => {
              const expired = isAnnouncementExpired(item);
              return (
                <Card
                  key={item.id}
                  className={`transition-all border ${
                    item.is_pinned
                      ? "border-amber-500/50 bg-amber-500/5 shadow-sm"
                      : !item.is_active || expired
                      ? "opacity-60 bg-muted/30"
                      : "bg-card"
                  }`}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          {item.is_pinned && (
                            <Badge className="bg-amber-500 text-white font-bold text-xs gap-1">
                              <Pin className="w-3 h-3 fill-current" /> PINNED HERO
                            </Badge>
                          )}

                          {getPriorityBadge(item.priority)}

                          {item.show_popup && (
                            <Badge variant="outline" className="border-purple-500/40 text-purple-400 text-[11px]">
                              💬 Popup Alert
                            </Badge>
                          )}

                          {!item.is_active ? (
                            <Badge variant="secondary" className="text-xs">
                              <XCircle className="w-3 h-3 mr-1 text-muted-foreground" /> DRAFT / HIDDEN
                            </Badge>
                          ) : expired ? (
                            <Badge variant="destructive" className="text-xs">
                              EXPIRED
                            </Badge>
                          ) : (
                            <Badge className="bg-emerald-600 text-white text-xs">
                              <CheckCircle2 className="w-3 h-3 mr-1" /> LIVE
                            </Badge>
                          )}
                        </div>

                        <CardTitle className="text-xl font-bold text-foreground">
                          {item.title}
                        </CardTitle>

                        <CardDescription className="text-xs flex items-center gap-3 text-muted-foreground">
                          <span>
                            Created {formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}
                          </span>
                          {item.expires_at && (
                            <span className="flex items-center gap-1 font-mono text-amber-500">
                              <Calendar className="w-3 h-3" />
                              Expires: {format(new Date(item.expires_at), "MMM dd, yyyy HH:mm")}
                            </span>
                          )}
                        </CardDescription>
                      </div>

                      {/* Management Quick Switches & Actions */}
                      <div className="flex items-center gap-2 shrink-0">
                        {/* Pin Quick Toggle */}
                        <Button
                          size="sm"
                          variant={item.is_pinned ? "default" : "outline"}
                          onClick={() => togglePinnedMutation.mutate(item)}
                          className={item.is_pinned ? "bg-amber-600 hover:bg-amber-700 text-white" : "border-muted-foreground/30"}
                          title={item.is_pinned ? "Unpin from top" : "Pin to top"}
                        >
                          <Pin className="w-3.5 h-3.5" />
                        </Button>

                        {/* Publish/Draft Quick Switch */}
                        <div className="flex items-center gap-1.5 px-2 py-1 bg-muted/60 rounded-lg border text-xs font-semibold">
                          <span className="text-[11px] text-muted-foreground">Live:</span>
                          <Switch
                            checked={item.is_active}
                            onCheckedChange={(checked) =>
                              toggleActiveMutation.mutate({ id: item.id, is_active: checked })
                            }
                          />
                        </div>

                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpenDialog(item)}
                          title="Edit"
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>

                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => deleteMutation.mutate(item.id)}
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-3">
                    {item.image_url && (
                      <div className="max-h-48 overflow-hidden rounded-lg border bg-muted">
                        <img src={item.image_url} alt={item.title} className="w-full h-48 object-cover" />
                      </div>
                    )}
                    <p className="text-sm whitespace-pre-wrap leading-relaxed text-foreground/90">
                      {item.content}
                    </p>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      </div>

      {/* Create & Edit Modal Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-primary flex items-center gap-2">
              <Megaphone className="w-5 h-5 text-amber-500" />
              {editingId ? "Edit Announcement" : "Create New Announcement"}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Configure broadcast message, priority level, dashboard pinning, and popup alerts.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div>
              <Label htmlFor="title" className="font-semibold text-sm">Announcement Title</Label>
              <Input
                id="title"
                placeholder="e.g., Community Profit Distribution Complete!"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="mt-1"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="priority" className="font-semibold text-sm">Priority Level</Label>
                <Select
                  value={formData.priority}
                  onValueChange={(val: any) => setFormData({ ...formData, priority: val })}
                >
                  <SelectTrigger id="priority" className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="normal">Normal (Info Banner)</SelectItem>
                    <SelectItem value="important">Important 🔔 (Highlight Banner)</SelectItem>
                    <SelectItem value="urgent">Urgent ⚠️ (Red Alert Banner)</SelectItem>
                    <SelectItem value="maintenance">System Maintenance 🛠️ (Amber Alert)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="expires_at" className="font-semibold text-sm">Expiry Date & Time (Optional)</Label>
                <Input
                  id="expires_at"
                  type="datetime-local"
                  value={formData.expires_at}
                  onChange={(e) => setFormData({ ...formData, expires_at: e.target.value })}
                  className="mt-1 text-xs"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="content" className="font-semibold text-sm">Announcement Content</Label>
              <Textarea
                id="content"
                rows={5}
                placeholder="Write announcement details here..."
                value={formData.content}
                onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                className="mt-1 leading-relaxed"
              />
            </div>

            {/* Feature Controls Switches */}
            <div className="p-4 rounded-xl bg-muted/40 border space-y-3">
              <span className="text-xs font-bold text-foreground block">Display & Notification Settings</span>
              
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="flex items-center justify-between p-2.5 rounded-lg border bg-card">
                  <span className="text-xs font-semibold">Publish (Active)</span>
                  <Switch
                    checked={formData.is_active}
                    onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                  />
                </div>

                <div className="flex items-center justify-between p-2.5 rounded-lg border bg-card">
                  <span className="text-xs font-semibold">Pin to Top 📌</span>
                  <Switch
                    checked={formData.is_pinned}
                    onCheckedChange={(checked) => setFormData({ ...formData, is_pinned: checked })}
                  />
                </div>

                <div className="flex items-center justify-between p-2.5 rounded-lg border bg-card">
                  <span className="text-xs font-semibold">Popup Banner 💬</span>
                  <Switch
                    checked={formData.show_popup}
                    onCheckedChange={(checked) => setFormData({ ...formData, show_popup: checked })}
                  />
                </div>
              </div>
            </div>

            {/* Optional Image Attachment */}
            <div className="space-y-2">
              <Label className="font-semibold text-sm">Optional Image Banner</Label>
              {imagePreview ? (
                <div className="relative rounded-lg overflow-hidden border max-h-40 bg-muted">
                  <img src={imagePreview} alt="Preview" className="w-full h-40 object-cover" />
                  <Button
                    size="icon"
                    variant="destructive"
                    className="absolute top-2 right-2 h-7 w-7"
                    onClick={() => {
                      setImagePreview(null);
                      setFormData({ ...formData, image: null });
                    }}
                  >
                    <XCircle className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <Input type="file" accept="image/*" onChange={handleImageChange} className="text-xs" />
              )}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button variant="outline" onClick={handleCloseDialog}>
              Cancel
            </Button>
            <Button
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending || uploading}
              className="bg-primary text-primary-foreground font-semibold"
            >
              {saveMutation.isPending ? "Saving..." : editingId ? "Update Announcement" : "Publish Announcement"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
