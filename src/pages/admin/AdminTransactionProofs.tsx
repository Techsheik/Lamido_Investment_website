import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout } from "@/components/AdminLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Download, CheckCircle, XCircle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

const AdminTransactionProofs = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);

  const { data: proofs, isLoading } = useQuery({
    queryKey: ["admin-transaction-proofs"],
    queryFn: async () => {
      const { data } = await supabase
        .from("transaction_proofs")
        .select(`
          *,
          profiles:user_id (id, name, email)
        `)
        .order("upload_date", { ascending: false });

      return data || [];
    },
  });

  const approveProofMutation = useMutation({
    mutationFn: async (proofId: string) => {
      const { error } = await supabase
        .from("transaction_proofs")
        .update({
          status: "approved",
          approved_at: new Date().toISOString(),
        })
        .eq("id", proofId);

      if (error) throw error;

      // Also update the associated transaction status
      const proof = proofs?.find((p: any) => p.id === proofId);
      if (proof?.transaction_id) {
        await supabase
          .from("transactions")
          .update({ status: "completed" })
          .eq("id", proof.transaction_id);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-transaction-proofs"] });
      toast({ title: "Success", description: "Transaction approved" });
      setApprovingId(null);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
      setApprovingId(null);
    },
  });

  const rejectProofMutation = useMutation({
    mutationFn: async (proofId: string) => {
      const { error } = await supabase
        .from("transaction_proofs")
        .update({
          status: "rejected",
          rejection_reason: "Rejected by admin",
        })
        .eq("id", proofId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-transaction-proofs"] });
      toast({ title: "Success", description: "Transaction rejected" });
      setRejectingId(null);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
      setRejectingId(null);
    },
  });

  const downloadFile = async (filePath: string, fileName: string) => {
    try {
      const { data, error } = await supabase.storage
        .from("transaction-proofs")
        .download(filePath);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to download file",
        variant: "destructive",
      });
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
        <div>
          <h1 className="text-3xl font-bold">Transaction Proofs</h1>
          <p className="text-muted-foreground mt-1">Review and approve payment proofs from users</p>
        </div>

        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>File</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Uploaded</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {proofs?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-6">
                    <p className="text-muted-foreground">No transaction proofs yet</p>
                  </TableCell>
                </TableRow>
              ) : (
                proofs?.map((proof: any) => (
                  <TableRow key={proof.id}>
                    <TableCell className="font-medium">{proof.profiles?.name || "Unknown"}</TableCell>
                    <TableCell className="text-sm">{proof.profiles?.email}</TableCell>
                    <TableCell>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => downloadFile(proof.file_path, proof.file_name)}
                      >
                        <Download className="h-4 w-4 mr-1" />
                        Download
                      </Button>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          proof.status === "approved"
                            ? "default"
                            : proof.status === "rejected"
                              ? "destructive"
                              : "secondary"
                        }
                      >
                        {proof.status.charAt(0).toUpperCase() + proof.status.slice(1)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDistanceToNow(new Date(proof.upload_date), { addSuffix: true })}
                    </TableCell>
                    <TableCell className="text-right">
                      {proof.status === "pending" && (
                        <div className="flex gap-2 justify-end">
                          <Button
                            variant="default"
                            size="sm"
                            disabled={approvingId === proof.id}
                            onClick={() => {
                              setApprovingId(proof.id);
                              approveProofMutation.mutate(proof.id);
                            }}
                          >
                            {approvingId === proof.id ? (
                              <>
                                <span className="inline-block animate-spin mr-1">⏳</span>
                                Approving...
                              </>
                            ) : (
                              <>
                                <CheckCircle className="h-4 w-4 mr-1" />
                                Approve
                              </>
                            )}
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            disabled={rejectingId === proof.id}
                            onClick={() => {
                              setRejectingId(proof.id);
                              rejectProofMutation.mutate(proof.id);
                            }}
                          >
                            {rejectingId === proof.id ? (
                              <>
                                <span className="inline-block animate-spin mr-1">⏳</span>
                                Rejecting...
                              </>
                            ) : (
                              <>
                                <XCircle className="h-4 w-4 mr-1" />
                                Reject
                              </>
                            )}
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        <Card className="bg-muted/50">
          <CardHeader>
            <CardTitle className="text-sm">Transaction Proof Management</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <p>• Users can upload payment receipts (PDF or image files)</p>
            <p>• Review the uploaded files and verify payment details</p>
            <p>• Click "Approve" to confirm the payment and credit user account</p>
            <p>• Click "Reject" if the proof is invalid or incomplete</p>
            <p>• Only pending proofs can be approved or rejected</p>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
};

export default AdminTransactionProofs;
