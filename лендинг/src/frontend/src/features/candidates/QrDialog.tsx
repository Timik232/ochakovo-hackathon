import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Button, Dialog } from "../../shared/ui";

const APP_ORIGIN = (import.meta.env.VITE_APP_ORIGIN as string | undefined) ?? document.location.origin;

export const APPLY_URL = `${APP_ORIGIN.replace(/\/$/, "")}/apply`;

export function QrDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    let cancelled = false;
    void QRCode.toDataURL(APPLY_URL, { width: 240, margin: 2, color: { dark: "#2B2B2E" } }).then(
      (url) => {
        if (!cancelled) {
          setDataUrl(url);
        }
      },
      () => {
        if (!cancelled) {
          setDataUrl(null);
        }
      },
    );
    return () => {
      cancelled = true;
    };
  }, [open]);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="QR-код анкеты"
      footer={
        <Button size="sm" variant="secondary" onClick={onClose}>
          Закрыть
        </Button>
      }
    >
      <p className="qrHint">Покажи кандидату — пусть наведёт камеру телефона и заполнит анкету сам.</p>
      {dataUrl === null ? (
        <p>Не удалось построить QR-код.</p>
      ) : (
        <img className="qrImage" src={dataUrl} alt={`QR-код со ссылкой на анкету ${APPLY_URL}`} width={240} height={240} />
      )}
      <p className="qrUrl">{APPLY_URL}</p>
    </Dialog>
  );
}
