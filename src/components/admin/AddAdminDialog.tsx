import { useForm } from "react-hook-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface AddAdminDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddAdminDialog({ open, onOpenChange }: AddAdminDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { register, handleSubmit, reset } = useForm({
    defaultValues: {
      name: "",
      email: "",
      password: "",
    },
  });

  const createAdminMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await fetch("/api/admin/create-admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to create admin");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-management"] });
      toast({
        title: "Success",
        description: "New admin created successfully",
      });
      reset();
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create admin",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: any) => {
    if (!data.name.trim() || !data.email.trim() || !data.password) {
      toast({
        title: "Validation Error",
        description: "Name, email, and password are required",
        variant: "destructive",
      });
      return;
    }

    if (data.password.length < 6) {
      toast({
        title: "Validation Error",
        description: "Password must be at least 6 characters",
        variant: "destructive",
      });
      return;
    }

    createAdminMutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create New Admin</DialogTitle>
          <DialogDescription>Add a new administrator to the platform</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Full Name *</Label>
            <Input
              id="name"
              placeholder="Admin Name"
              {...register("name", { required: true })}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email *</Label>
            <Input
              id="email"
              type="email"
              placeholder="admin@example.com"
              {...register("email", { required: true })}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password *</Label>
            <Input
              id="password"
              type="password"
              placeholder="Min 6 characters"
              {...register("password", { required: true })}
              minLength={6}
              required
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={createAdminMutation.isPending}
            >
              {createAdminMutation.isPending ? (
                <>
                  <span className="inline-block animate-spin mr-2">⏳</span>
                  Creating...
                </>
              ) : (
                "Create Admin"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
