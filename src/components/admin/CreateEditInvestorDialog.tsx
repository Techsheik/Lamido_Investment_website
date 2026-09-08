import { useState, useEffect } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

interface CreateEditInvestorDialogProps {
  investor?: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateEditInvestorDialog({
  investor,
  open,
  onOpenChange,
}: CreateEditInvestorDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const UNIT_PRICE = 70; // $70 per unit

  const [formData, setFormData] = useState({
    userId: "",
    name: "",
    email: "",
    units: "1",
    status: "active",
    start_date: new Date().toISOString().split("T")[0],
  });

  // Fetch available registered users
  const { data: users, isLoading: usersLoading } = useQuery({
    queryKey: ["admin-users-list"],
    queryFn: async () => {
      const response = await fetch("/api/admin/get-users");
      if (!response.ok) return [];
      return await response.json();
    },
    enabled: open,
  });

  useEffect(() => {
    if (investor) {
      const profile = investor.profile || investor.profiles;
      const initialUnits = investor.units || Math.max(1, Math.round(Number(investor.amount || 70) / UNIT_PRICE));
      setFormData({
        userId: investor.user_id || profile?.id || "",
        name: profile?.name || "",
        email: profile?.email || "",
        units: String(initialUnits),
        status: investor.status || "active",
        start_date: investor.start_date?.split("T")[0] || new Date().toISOString().split("T")[0],
      });
    } else {
      setFormData({
        userId: "",
        name: "",
        email: "",
        units: "1",
        status: "active",
        start_date: new Date().toISOString().split("T")[0],
      });
    }
  }, [investor, open]);

  const handleUserSelect = (selectedUserId: string) => {
    const selectedUser = users?.find((u: any) => u.id === selectedUserId);
    if (selectedUser) {
      setFormData((prev) => ({
        ...prev,
        userId: selectedUserId,
        name: selectedUser.name || "",
        email: selectedUser.email || "",
      }));
    }
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const unitsNum = Math.max(1, parseInt(formData.units) || 1);
      const calculatedAmount = unitsNum * UNIT_PRICE;

      if (investor) {
        // Update existing investor record
        const response = await fetch("/api/admin/edit-investor", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            investmentId: investor.id,
            name: formData.name,
            email: formData.email,
            units: unitsNum,
            amount: calculatedAmount,
            status: formData.status,
            start_date: formData.start_date,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || "Failed to update investor");
        }
      } else {
        // Create investment for selected user
        if (!formData.userId) {
          throw new Error("Please select an existing user");
        }

        const response = await fetch("/api/admin/create-investor", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: formData.userId,
            name: formData.name,
            email: formData.email,
            units: unitsNum,
            amount: calculatedAmount,
            status: formData.status,
            start_date: formData.start_date,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || "Failed to create investment");
        }

        const result = await response.json();
        if (!result.ok) {
          throw new Error("Failed to create investment");
        }
      }
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin-investors"] }),
        queryClient.invalidateQueries({ queryKey: ["admin-investments"] }),
        queryClient.invalidateQueries({ queryKey: ["admin-users"] }),
        queryClient.invalidateQueries({ queryKey: ["user-profile"] }),
        queryClient.invalidateQueries({ queryKey: ["investments"] })
      ]);
      
      toast({
        title: "Success",
        description: investor
          ? "Investment updated successfully"
          : "Investment created successfully for user",
      });
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to save investment",
        variant: "destructive",
      });
    },
  });

  const parsedUnits = Math.max(1, parseInt(formData.units) || 1);
  const totalAmount = parsedUnits * UNIT_PRICE;
  const isValid = Boolean(formData.userId || investor) && parsedUnits >= 1 && formData.start_date;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {investor ? "Edit User Investment" : "Create Investment for User"}
          </DialogTitle>
          <DialogDescription>
            {investor
              ? "Modify the investment setup for this user"
              : "Select a registered user and set up their investment ($70 per share unit)"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* User Selection Dropdown (Only when creating new investment) */}
          {!investor ? (
            <div className="space-y-2">
              <Label htmlFor="user-select" className="font-semibold">Select Registered User *</Label>
              <Select value={formData.userId} onValueChange={handleUserSelect}>
                <SelectTrigger id="user-select">
                  <SelectValue placeholder={usersLoading ? "Loading users..." : "Choose user from registered profiles"} />
                </SelectTrigger>
                <SelectContent className="max-h-60">
                  {users?.map((u: any) => (
                    <SelectItem key={u.id} value={u.id}>
                      <div className="flex flex-col text-left">
                        <span className="font-medium">{u.name} ({u.user_code || u.id.slice(0, 6)})</span>
                        <span className="text-xs text-muted-foreground">{u.email}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div className="p-3 bg-muted rounded-md space-y-1 border">
              <div className="text-xs text-muted-foreground">Investor Account</div>
              <div className="font-bold text-sm">{formData.name || "User"}</div>
              <div className="text-xs font-mono">{formData.email}</div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="units">Share Units (Min 1 unit)</Label>
              <Input
                id="units"
                type="number"
                min="1"
                step="1"
                value={formData.units}
                onChange={(e) => setFormData({ ...formData, units: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                1 Unit = ${UNIT_PRICE}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="calculated-amount">Total Investment Amount</Label>
              <div className="h-10 px-3 py-2 border rounded-md bg-muted/50 font-bold text-lg text-primary flex items-center">
                ${totalAmount.toLocaleString()} USD
              </div>
              <p className="text-xs text-muted-foreground">
                Automatically synchronized
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="status">Investment Status</Label>
              <Select
                value={formData.status}
                onValueChange={(val) => setFormData({ ...formData, status: val })}
              >
                <SelectTrigger id="status">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active (Eligible for PPSU)</SelectItem>
                  <SelectItem value="pending">Pending Payment Approval</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="startDate">Start Date</Label>
              <Input
                id="startDate"
                type="date"
                value={formData.start_date}
                onChange={(e) =>
                  setFormData({ ...formData, start_date: e.target.value })
                }
              />
            </div>
          </div>

          <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-md text-xs text-blue-400 space-y-1">
            <div className="font-semibold text-blue-300">7-Day Community Profit Share Model</div>
            <div>This investment is automatically attached to the current open entry window / active cycle and participates in weekly profit distribution based on total active share units.</div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => saveMutation.mutate()}
            disabled={!isValid || saveMutation.isPending}
          >
            {saveMutation.isPending ? "Saving..." : investor ? "Update Investment" : "Create Investment"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
