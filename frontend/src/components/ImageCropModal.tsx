'use client';

import { useState, useCallback } from 'react';
import Cropper, { Area } from 'react-easy-crop';

interface Props {
  imageSrc: string;
  onConfirm: (file: File) => void;
  onCancel: () => void;
}

async function getCroppedBlob(imageSrc: string, crop: Area): Promise<Blob> {
  const image = new Image();
  image.src = imageSrc;
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = reject;
  });

  const canvas = document.createElement('canvas');
  canvas.width = crop.width;
  canvas.height = crop.height;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(image, crop.x, crop.y, crop.width, crop.height, 0, 0, crop.width, crop.height);

  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Canvas empty'))), 'image/jpeg', 0.92)
  );
}

export default function ImageCropModal({ imageSrc, onConfirm, onCancel }: Props) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedArea, setCroppedArea] = useState<Area | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const onCropComplete = useCallback((_: Area, croppedPixels: Area) => {
    setCroppedArea(croppedPixels);
  }, []);

  async function handleConfirm() {
    if (!croppedArea) return;
    setIsProcessing(true);
    try {
      const blob = await getCroppedBlob(imageSrc, croppedArea);
      const file = new File([blob], `cropped-${Date.now()}.jpg`, { type: 'image/jpeg' });
      onConfirm(file);
    } finally {
      setIsProcessing(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="bg-white rounded-2xl overflow-hidden w-full max-w-lg mx-4 shadow-2xl">
        {/* Nagłówek */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-[#dbdbdb]">
          <button onClick={onCancel} className="text-sm text-[#262626] font-medium hover:text-[#8e8e8e] transition-colors">
            Anuluj
          </button>
          <p className="text-sm font-semibold text-[#262626]">Dopasuj zdjęcie</p>
          <button
            onClick={handleConfirm}
            disabled={isProcessing}
            className="text-sm text-[#0095f6] font-semibold hover:text-[#00376b] disabled:opacity-50 transition-colors"
          >
            {isProcessing ? 'Przetwarzanie...' : 'Dalej'}
          </button>
        </div>

        {/* Obszar croppera */}
        <div className="relative w-full bg-black" style={{ height: 380 }}>
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            aspect={1}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onCropComplete}
            showGrid={false}
            style={{
              containerStyle: { background: '#000' },
              cropAreaStyle: { border: '2px solid rgba(255,255,255,0.8)', borderRadius: 4 },
            }}
          />
        </div>

        {/* Suwak zoomu */}
        <div className="px-5 py-4 flex items-center gap-3 border-t border-[#dbdbdb]">
          <svg className="w-4 h-4 text-[#8e8e8e] shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607zM10.5 7.5v6m-3-3h6" />
          </svg>
          <input
            type="range"
            min={1}
            max={3}
            step={0.01}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="flex-1 accent-[#0095f6] h-1 rounded-full cursor-pointer"
          />
          <svg className="w-5 h-5 text-[#8e8e8e] shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607zM10.5 7.5v6m-3-3h6" />
          </svg>
          <span className="text-xs text-[#8e8e8e] w-8 text-right">{Math.round(zoom * 100)}%</span>
        </div>

        <p className="text-center text-xs text-[#8e8e8e] pb-4">
          Przeciągnij zdjęcie · użyj suwaka lub scrolla do zoomu
        </p>
      </div>
    </div>
  );
}
