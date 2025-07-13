import React, { useEffect, useRef } from 'react';
import { BrowserMultiFormatReader } from '@zxing/browser';
import { NotFoundException } from '@zxing/library';

interface QrScannerModalProps {
  open: boolean;
  onClose: () => void;
  onScan: (value: string) => void;
}

const QrScannerModal: React.FC<QrScannerModalProps> = ({ open, onClose, onScan }) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const codeReaderRef = useRef<BrowserMultiFormatReader | null>(null);
  const scanActiveRef = useRef(false);

  // Bulletproof stop/cleanup function
  const stopCameraAndDecoder = () => {
    // Stop QR code reader
    if (codeReaderRef.current) {
      // No reset() or stopContinuousDecode() methods; just clear the ref
      codeReaderRef.current = null;
    }
    // Stop camera stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    // Clear video element
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    scanActiveRef.current = false;
  };

  useEffect(() => {
    if (!open) {
      stopCameraAndDecoder();
      return;
    }

    let cancelled = false;
    scanActiveRef.current = true;

    async function startCameraAndScan() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        if (cancelled) {
          stream.getTracks().forEach(track => track.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
        // Always create a new reader
        codeReaderRef.current = new BrowserMultiFormatReader();
        codeReaderRef.current.decodeFromStream(
          stream,
          videoRef.current!,
          (result, err) => {
            if (!scanActiveRef.current) return;
            if (result) {
              scanActiveRef.current = false;
              stopCameraAndDecoder();
              onScan(result.getText());
              onClose();
            }
          }
        );
      } catch (e) {
        // handle error (optional: show error to user)
      }
    }

    startCameraAndScan();

    return () => {
      cancelled = true;
      stopCameraAndDecoder();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="bg-card p-6 rounded-xl shadow-lg relative w-[350px] max-w-full">
        <button
          className="absolute top-2 right-2 text-xl"
          onClick={onClose}
          aria-label="Close QR Modal"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-x"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
        </button>
        <h2 className="text-lg font-bold mb-2">Scan Product QR</h2>
        <div className="mb-4 text-sm text-muted-foreground">
          Please allow camera access to scan QR codes.
        </div>
        <div className="w-full flex flex-col items-center">
          <video
            ref={videoRef}
            id="qr-video"
            className="rounded-lg border border-accent w-full aspect-square bg-black"
            autoPlay
            muted
            playsInline
            style={{ maxWidth: 300, width: '100%', height: 'auto' }}
          />
        </div>
      </div>
    </div>
  );
};

export default QrScannerModal; 