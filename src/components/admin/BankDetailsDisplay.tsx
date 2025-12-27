import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CreditCard } from "lucide-react";

interface BankDetailsDisplayProps {
  accountHolderName?: string;
  bankName?: string;
  bankAccountNumber?: string;
  routingNumber?: string;
}

export function BankDetailsDisplay({
  accountHolderName,
  bankName,
  bankAccountNumber,
  routingNumber,
}: BankDetailsDisplayProps) {
  const hasBankDetails =
    accountHolderName && bankName && bankAccountNumber && routingNumber;

  if (!hasBankDetails) {
    return (
      <Card className="bg-yellow-50 dark:bg-yellow-950/20 border-yellow-200 dark:border-yellow-800">
        <CardContent className="pt-6">
          <p className="text-sm text-yellow-800 dark:text-yellow-400">
            ⚠️ No bank details provided by user yet
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <CreditCard className="h-5 w-5 text-primary" />
          <div>
            <CardTitle className="text-base">Bank Details</CardTitle>
            <CardDescription>For payment processing</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <p className="text-sm text-muted-foreground">Account Holder</p>
          <p className="font-semibold">{accountHolderName}</p>
        </div>
        <div>
          <p className="text-sm text-muted-foreground">Bank Name</p>
          <p className="font-semibold">{bankName}</p>
        </div>
        <div>
          <p className="text-sm text-muted-foreground">Account Number</p>
          <p className="font-mono font-semibold">
            {bankAccountNumber?.slice(-4).padStart(bankAccountNumber?.length, '*')}
          </p>
        </div>
        <div>
          <p className="text-sm text-muted-foreground">Routing Number</p>
          <p className="font-mono font-semibold">{routingNumber}</p>
        </div>
      </CardContent>
    </Card>
  );
}
