import { useState } from "react";
import { useForm } from "react-hook-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface AddUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddUserDialog({ open, onOpenChange }: AddUserDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { register, handleSubmit, setValue, watch, reset } = useForm({
    defaultValues: {
      name: "",
      email: "",
      password: "",
      phone: "",
      balance: 0,
      account_status: "active",
      country: "",
      state: "",
      lga: "",
    },
  });

  const generateUserCode = (name: string) => {
    const initials = name
      .split(" ")
      .map((n) => n.charAt(0).toUpperCase())
      .join("")
      .substring(0, 2);
    const date = new Date().toLocaleDateString("en-GB").replace(/\//g, "");
    const timestamp = Date.now().toString().slice(-4);
    return `${initials}${date}${timestamp}`;
  };

  const createUserMutation = useMutation({
    mutationFn: async (data: any) => {
      // Step 1: Create auth account with Supabase
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
          emailRedirectTo: `${window.location.origin}/`,
          data: {
            name: data.name,
          },
        },
      });

      if (authError) throw authError;
      if (!authData.user) throw new Error("Failed to create user account");

      // Step 3: Update the profile with additional fields - with retry logic
      const userCode = generateUserCode(data.name);
      let profileSynced = false;
      for (let i = 0; i < 5; i++) {
        const { data: profileResult, error: updateError } = await supabase
          .from("profiles")
          .upsert({
            id: authData.user.id,
            name: data.name,
            email: data.email,
            phone: data.phone,
            balance: Number(data.balance) || 0,
            account_status: data.account_status || "active",
            country: data.country,
            state: data.state,
            lga: data.lga,
            user_code: userCode,
            weekly_roi_percentage: 10.0,
          })
          .select();

        if (!updateError && profileResult && profileResult.length > 0) {
          profileSynced = true;
          break;
        }
        
        console.warn(`AddUser profile sync attempt ${i + 1} failed, retrying...`, updateError);
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }

      if (!profileSynced) {
        throw new Error("Failed to create user profile after multiple attempts.");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      toast({
        title: "Success",
        description: "User created successfully. Confirmation email sent.",
      });
      reset();
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create user",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: any) => {
    if (!data.email || !data.password || !data.name) {
      toast({
        title: "Validation Error",
        description: "Email, password, and name are required",
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
    createUserMutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New User</DialogTitle>
          <DialogDescription>Add a new user to the platform manually</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Full Name *</Label>
              <Input id="name" {...register("name", { required: true })} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email *</Label>
              <Input id="email" type="email" {...register("email", { required: true })} required />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="password">Password *</Label>
              <Input 
                id="password" 
                type="password" 
                placeholder="Min 6 characters"
                {...register("password", { required: true })} 
                required 
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input id="phone" {...register("phone")} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="balance">Initial Balance ($)</Label>
              <Input id="balance" type="number" step="0.01" {...register("balance", { valueAsNumber: true })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="account_status">Account Status</Label>
              <Select
                value={watch("account_status")}
                onValueChange={(value) => setValue("account_status", value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                  <SelectItem value="suspended">Suspended</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="country">Country</Label>
              <Input id="country" {...register("country")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="state">State</Label>
              <Input id="state" {...register("state")} />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="lga">LGA/City</Label>
            <Input id="lga" {...register("lga")} />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={createUserMutation.isPending}>
              {createUserMutation.isPending ? "Creating..." : "Create User"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
