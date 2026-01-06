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
import { useToast } from "@/hooks/use-toast";
import { Trash2, Plus, Edit2, Upload, X } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

const AdminAnnouncements = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({ title: "", content: "", image: null as File | null });
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const { data: announcements, isLoading } = useQuery({
    queryKey: ["admin-announcements"],
    queryFn: async () => {
      const response = await fetch("/api/admin/announcements");
      if (!response.ok) throw new Error("Failed to fetch announcements");
      return await response.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not authenticated");
      if (!formData.title.trim() || !formData.content.trim()) {
        throw new Error("Title and content are required");
      }

      setUploading(true);
      let imageUrl = imagePreview; // Use existing preview if any (e.g. from previous edit)
      
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

      const response = await fetch("/api/admin/announcements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: formData.title,
          content: formData.content,
          image_url: imageUrl,
          created_by: user.id,
        }),
      });

      setUploading(false);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to create announcement");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-announcements"] });
      toast({ title: "Success", description: "Announcement created" });
      setFormData({ title: "", content: "", image: null });
      setImagePreview(null);
      setIsDialogOpen(false);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!editingId) throw new Error("No announcement selected");
      if (!formData.title.trim() || !formData.content.trim()) {
        throw new Error("Title and content are required");
      }

      setUploading(true);
      let imageUrl = imagePreview;
      
      if (formData.image) {
        const fileName = `${Date.now()}-${formData.image.name}`;
        const { error: uploadError } = await supabase.storage
          .from("announcements")
          .upload(`${user?.id}/${fileName}`, formData.image);
        
        if (uploadError) {
          setUploading(false);
          throw uploadError;
        }
        
        const { data } = supabase.storage
          .from("announcements")
          .getPublicUrl(`${user?.id}/${fileName}`);
        imageUrl = data.publicUrl;
      }

      const response = await fetch("/api/admin/announcements", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingId,
          title: formData.title,
          content: formData.content,
          image_url: imageUrl,
        }),
      });

      setUploading(false);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to update announcement");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-announcements"] });
      toast({ title: "Success", description: "Announcement updated" });
      setFormData({ title: "", content: "", image: null });
      setImagePreview(null);
      setEditingId(null);
      setIsDialogOpen(false);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch("/api/admin/announcements", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to delete announcement");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-announcements"] });
      toast({ title: "Success", description: "Announcement deleted" });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleOpenDialog = (announcement?: any) => {
    if (announcement) {
      setEditingId(announcement.id);
      setFormData({ title: announcement.title, content: announcement.content, image: null });
      setImagePreview(announcement.image_url);
    } else {
      setEditingId(null);
      setFormData({ title: "", content: "", image: null });
      setImagePreview(null);
    }
    setIsDialogOpen(true);
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast({ title: "Error", description: "Image must be less than 5MB", variant: "destructive" });
        return;
      }
      setFormData({ ...formData, image: file });
      const reader = new FileReader();
      reader.onload = (e) => setImagePreview(e.target?.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = () => {
    if (editingId) {
      updateMutation.mutate();
    } else {
      createMutation.mutate();
    }
  };

  if (isLoading) {
    return (
      <AdminLayout>
        <div>Loading...</div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Announcements</h1>
          <Button onClick={() => handleOpenDialog()}>
            <Plus className="h-4 w-4 mr-2" />
            Create Announcement
          </Button>
        </div>

        <div className="space-y-4">
          {announcements?.length === 0 ? (
            <Card>
              <CardContent className="pt-6">
                <p className="text-center text-muted-foreground">No announcements yet</p>
              </CardContent>
            </Card>
          ) : (
            announcements?.map((announcement: any) => (
              <Card key={announcement.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle>{announcement.title}</CardTitle>
                      <CardDescription>
                        Created {formatDistanceToNow(new Date(announcement.created_at), { addSuffix: true })}
                      </CardDescription>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleOpenDialog(announcement)}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => deleteMutation.mutate(announcement.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {announcement.image_url && (
                    <img src={announcement.image_url} alt={announcement.title} className="w-full h-48 object-cover rounded-lg mb-4" />
                  )}
                  <p className="text-sm whitespace-pre-wrap">{announcement.content}</p>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Announcement" : "Create Announcement"}</DialogTitle>
            <DialogDescription>
              {editingId ? "Update the announcement details" : "Create a new announcement for all users"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                placeholder="Announcement title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="image">Image (Optional)</Label>
              <div className="flex items-center gap-2">
                <input
                  id="image"
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  className="hidden"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => document.getElementById("image")?.click()}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Choose Image
                </Button>
                {imagePreview && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setFormData({ ...formData, image: null });
                      setImagePreview(null);
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
              {imagePreview && (
                <img src={imagePreview} alt="Preview" className="w-full h-32 object-cover rounded-lg" />
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="content">Content</Label>
              <Textarea
                id="content"
                placeholder="Announcement content"
                value={formData.content}
                onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                rows={6}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={createMutation.isPending || updateMutation.isPending || uploading}
              >
                {editingId ? "Update" : "Create"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
};

export default AdminAnnouncements;
