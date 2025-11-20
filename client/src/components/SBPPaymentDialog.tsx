import { useEffect } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { isMobileDevice } from "@/lib/utils";
import { Smartphone, QrCode } from "lucide-react";

interface SBPPaymentDialogProps {
  isOpen: boolean;
  onClose: () => void;
  paymentUrl: string;
}

export default function SBPPaymentDialog({ isOpen, onClose, paymentUrl }: SBPPaymentDialogProps) {
  const isMobile = isMobileDevice();

  useEffect(() => {
    if (isOpen && isMobile && paymentUrl) {
      // On mobile: automatically redirect to SBP deeplink
      // The payment URL from Tinkoff should already be formatted correctly for SBP
      window.location.href = paymentUrl;
    }
  }, [isOpen, isMobile, paymentUrl]);

  if (isMobile) {
    // On mobile: show loading message while redirecting
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-md" data-testid="dialog-sbp-mobile">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Smartphone className="h-5 w-5" />
              Оплата по СБП
            </DialogTitle>
            <DialogDescription>
              Переход в приложение банка...
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex flex-col items-center gap-4 py-6">
            <div className="animate-pulse">
              <Smartphone className="h-16 w-16 text-primary" />
            </div>
            <p className="text-sm text-muted-foreground text-center">
              Если приложение банка не открылось автоматически, нажмите кнопку ниже
            </p>
            <Button
              onClick={() => window.location.href = paymentUrl}
              className="w-full"
              data-testid="button-open-sbp-app"
            >
              Открыть приложение банка
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // On desktop: show QR code
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md" data-testid="dialog-sbp-desktop">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <QrCode className="h-5 w-5" />
            Оплата по СБП
          </DialogTitle>
          <DialogDescription>
            Отсканируйте QR-код камерой телефона для оплаты
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex flex-col items-center gap-6 py-6">
          <div className="p-4 bg-white rounded-lg">
            <QRCodeSVG
              value={paymentUrl}
              size={256}
              level="H"
              data-testid="qr-code-sbp"
            />
          </div>
          
          <div className="space-y-2 text-sm text-muted-foreground text-center">
            <p>1. Откройте приложение вашего банка</p>
            <p>2. Найдите раздел "Оплата по QR"</p>
            <p>3. Отсканируйте код выше</p>
            <p>4. Подтвердите платёж</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
