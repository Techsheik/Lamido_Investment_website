import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle2, Copy } from "lucide-react";

interface SignupSuccessDialogProps {
  open: boolean;
  onClose: () => void;
  userCode: string;
}

export const SignupSuccessDialog = ({ open, onClose, userCode }: SignupSuccessDialogProps) => {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(userCode);
      setCopied(true);
      toast({
        title: "Copied!",
        description: "User code copied to clipboard",
      });
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast({
        title: "Failed to copy",
        description: "Please copy the code manually",
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center justify-center mb-4">
            <CheckCircle2 className="h-12 w-12 text-green-500" />
          </div>
          <DialogTitle className="text-center text-2xl">
            ✅ Thank you for signing up!
          </DialogTitle>
          <DialogDescription className="text-center pt-4">
            Welcome aboard! Here is your unique user code:
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col items-center space-y-4 py-4">
          <div className="bg-muted px-6 py-4 rounded-lg border-2 border-primary">
            <p className="text-2xl font-bold text-primary text-center tracking-wider">
              {userCode}
            </p>
          </div>
          <p className="text-sm text-muted-foreground text-center px-4">
            Please don't share it with anyone for security reasons.
          </p>
          <div className="flex gap-2 w-full pt-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={handleCopyCode}
            >
              <Copy className="h-4 w-4 mr-2" />
              {copied ? "Copied!" : "Copy Code"}
            </Button>
            <Button
              className="flex-1"
              onClick={onClose}
            >
              OK
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
