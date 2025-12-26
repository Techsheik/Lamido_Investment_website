import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout } from "@/components/AdminLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Download, CheckCircle, XCircle, Eye, X } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";

const AdminTransactionProofs = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [viewingProof, setViewingProof] = useState<any>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const { data: proofs, isLoading } = useQuery({
    queryKey: ["admin-transaction-proofs"],
    queryFn: async () => {
      const { data } = await supabase
        .from("transaction_proofs")
        .select("*")
        .order("upload_date", { ascending: false });

      if (!data || data.length === 0) return data || [];

      const userIds = [...new Set(data.map((p: any) => p.user_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, name, email, user_code")
        .in("id", userIds);

      const profileMap = profiles?.reduce((acc: any, p: any) => {
        acc[p.id] = p;
        return acc;
      }, {}) || {};

      return data.map((p: any) => ({
        ...p,
        profiles: profileMap[p.user_id] || null,
      }));
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

      // Also update the associated transaction status and activate investment
      const proof = proofs?.find((p: any) => p.id === proofId);
      if (proof?.transaction_id) {
        await supabase
          .from("transactions")
          .update({ status: "completed" })
          .eq("id", proof.transaction_id);

        // Get transaction details to find user_id
        const { data: transactionData } = await supabase
          .from("transactions")
          .select("user_id, amount")
          .eq("id", proof.transaction_id)
          .single();

        if (transactionData?.user_id) {
          // Activate pending investment - reset dates so progress starts from 0%
          const now = new Date();
          const endDate = new Date(now.getTime() + (7 * 24 * 60 * 60 * 1000));

          await supabase
            .from("investments")
            .update({
              status: "active",
              start_date: now.toISOString(),
              end_date: endDate.toISOString(),
            })
            .eq("user_id", transactionData.user_id)
            .eq("status", "pending");
        }
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

  const viewFile = async (filePath: string, proof: any) => {
    try {
      const { data, error } = await supabase.storage
        .from("transaction-proofs")
        .createSignedUrl(filePath, 3600);

      if (error) throw error;

      setViewingProof(proof);
      setPreviewUrl(data.signedUrl);
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to load file preview",
        variant: "destructive",
      });
    }
  };

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
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => viewFile(proof.file_path, proof)}
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          View
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => downloadFile(proof.file_path, proof.file_name)}
                        >
                          <Download className="h-4 w-4 mr-1" />
                          Download
                        </Button>
                      </div>
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

      {/* Proof Preview Dialog */}
      <Dialog open={!!viewingProof} onOpenChange={(open) => !open && setViewingProof(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Payment Proof - {viewingProof?.profiles?.name}</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* User Details */}
            <div className="p-4 bg-muted rounded-lg space-y-3">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">User Name</p>
                  <p className="font-semibold">{viewingProof?.profiles?.name}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">User Code</p>
                  <p className="font-semibold font-mono text-primary">{viewingProof?.profiles?.user_code || "N/A"}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Email</p>
                  <p className="font-semibold text-sm">{viewingProof?.profiles?.email}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">File Name</p>
                  <p className="font-semibold text-sm">{viewingProof?.file_name}</p>
                </div>
              </div>
              <div className="pt-2 border-t">
                <p className="text-sm text-muted-foreground">Uploaded</p>
                <p className="font-semibold text-sm">
                  {viewingProof?.upload_date && formatDistanceToNow(new Date(viewingProof.upload_date), { addSuffix: true })}
                </p>
              </div>
            </div>

            {/* File Preview */}
            {previewUrl && (
              <div className="border rounded-lg p-4 bg-muted/30">
                {viewingProof?.file_type?.startsWith("image/") ? (
                  <img 
                    src={previewUrl} 
                    alt="Payment proof" 
                    className="w-full h-auto rounded-lg max-h-96 object-cover"
                  />
                ) : (
                  <div className="flex items-center justify-center h-96 bg-muted rounded-lg">
                    <div className="text-center">
                      <p className="text-muted-foreground mb-2">PDF Preview</p>
                      <a 
                        href={previewUrl} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-primary hover:underline text-sm"
                      >
                        Click to open PDF in new tab
                      </a>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2 justify-end">
              {viewingProof?.status === "pending" && (
                <>
                  <Button
                    variant="default"
                    onClick={() => {
                      setViewingProof(null);
                      setPreviewUrl(null);
                      approveProofMutation.mutate(viewingProof.id);
                    }}
                  >
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Approve
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => {
                      setViewingProof(null);
                      setPreviewUrl(null);
                      rejectProofMutation.mutate(viewingProof.id);
                    }}
                  >
                    <XCircle className="h-4 w-4 mr-2" />
                    Reject
                  </Button>
                </>
              )}
              <Button
                variant="outline"
                onClick={() => downloadFile(viewingProof?.file_path, viewingProof?.file_name)}
              >
                <Download className="h-4 w-4 mr-2" />
                Download
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setViewingProof(null);
                  setPreviewUrl(null);
                }}
              >
                Close
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
};

export default AdminTransactionProofs;
