"use client";

import { useEffect, useRef, useState } from "react";
import {
  Check,
  Eye,
  ImageIcon,
  Loader2,
  Pipette,
  RotateCcw,
  Sparkles,
  Trash2,
  Upload,
  Wand2,
} from "lucide-react";
import { Button } from "@ventura/ui/button";
import { Input } from "@ventura/ui/input";
import { Label } from "@ventura/ui/label";
import { Modal } from "@ventura/ui/modal";
import {
  applySmartMatting,
  type ColorRGB,
  detectCornerBackgroundColor,
  loadImageSafely,
  type MattingResult,
} from "@/lib/image-processing";

interface ImageUploadWithBgRemovalProps {
  value: string;
  onChange: (url: string) => void;
  label?: string;
  placeholder?: string;
}

export function ImageUploadWithBgRemoval({
  value,
  onChange,
  label = "Asosiy rasm",
  placeholder = "https://... yoki fayl yuklang",
}: ImageUploadWithBgRemovalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  // Modal ichidagi holat
  const [loadingImage, setLoadingImage] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [previewBg, setPreviewBg] = useState<"checker" | "white" | "dark">("checker");
  const [showOriginal, setShowOriginal] = useState(false);
  const [eyedropperActive, setEyedropperActive] = useState(false);

  // Matting parametrlari
  const [tolerance, setTolerance] = useState(35);
  const [feather, setFeather] = useState(2);
  const [mode, setMode] = useState<"flood-fill" | "global">("flood-fill");
  const [targetColor, setTargetColor] = useState<ColorRGB>({ r: 255, g: 255, b: 255 });
  const [mattingResult, setMattingResult] = useState<MattingResult | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);

  // Canvaslar
  const originalCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const processedCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const displayCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Fayl yuklash (oddiy yuklash)
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploading(true);
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/uploads", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (data.ok && data.file?.url) {
        onChange(data.file.url);
      } else {
        alert(data.error || "Rasm yuklashda xatolik yuz berdi");
      }
    } catch (err) {
      alert("Yuklashda xatolik yuz berdi");
      console.error(err);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // Modal ochilganda rasmni canvasga chizish
  useEffect(() => {
    if (!modalOpen || !value) return;

    let isMounted = true;
    setLoadingImage(true);
    setAiError(null);

    loadImageSafely(value)
      .then((img) => {
        if (!isMounted) return;

        // Asl canvas
        const origCanvas = document.createElement("canvas");
        origCanvas.width = img.naturalWidth || img.width;
        origCanvas.height = img.naturalHeight || img.height;
        const origCtx = origCanvas.getContext("2d", { willReadFrequently: true });
        if (origCtx) {
          origCtx.drawImage(img, 0, 0);
          originalCanvasRef.current = origCanvas;

          // Dastlabki burchak rangini aniqlash
          const imgData = origCtx.getImageData(0, 0, origCanvas.width, origCanvas.height);
          const detected = detectCornerBackgroundColor(imgData);
          setTargetColor(detected);

          // Natija canvasini tayyorlash
          const procCanvas = document.createElement("canvas");
          procCanvas.width = origCanvas.width;
          procCanvas.height = origCanvas.height;
          processedCanvasRef.current = procCanvas;

          // Dastlabki aqlli qirqishni bajarish
          const res = applySmartMatting(origCanvas, procCanvas, {
            targetColor: detected,
            tolerance,
            feather,
            mode,
          });
          setMattingResult(res);

          renderToDisplay(procCanvas);
        }
      })
      .catch((err) => {
        console.error("Rasm ochishda xatolik:", err);
        setAiError("Rasmni tahlil qilish uchun yuklab bo'lmadi. Havolani tekshiring.");
      })
      .finally(() => {
        if (isMounted) setLoadingImage(false);
      });

    return () => {
      isMounted = false;
    };
  }, [modalOpen, value]);

  // Display canvasga chizish
  const renderToDisplay = (sourceCanvas: HTMLCanvasElement) => {
    const disp = displayCanvasRef.current;
    if (!disp) return;

    disp.width = sourceCanvas.width;
    disp.height = sourceCanvas.height;
    const ctx = disp.getContext("2d");
    if (ctx) {
      ctx.clearRect(0, 0, disp.width, disp.height);
      ctx.drawImage(sourceCanvas, 0, 0);
    }
  };

  // Parametrlar o'zgarganda real vaqtda qayta hisoblash
  useEffect(() => {
    if (!originalCanvasRef.current || !processedCanvasRef.current || !modalOpen || showOriginal) return;

    try {
      const res = applySmartMatting(originalCanvasRef.current, processedCanvasRef.current, {
        targetColor,
        tolerance,
        feather,
        mode,
      });
      setMattingResult(res);
      renderToDisplay(processedCanvasRef.current);
    } catch (e) {
      console.error("Matting xatoligi:", e);
    }
  }, [tolerance, feather, mode, targetColor, modalOpen, showOriginal]);

  // "Asl rasm" va "Fonsiz" orasida ko'rinishni almashtirish
  useEffect(() => {
    if (showOriginal && originalCanvasRef.current) {
      renderToDisplay(originalCanvasRef.current);
    } else if (!showOriginal && processedCanvasRef.current) {
      renderToDisplay(processedCanvasRef.current);
    }
  }, [showOriginal]);

  // Pipette (Tomizg'ich) orqali bosilgan joy rangini fon deb olish
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!eyedropperActive || !originalCanvasRef.current || !displayCanvasRef.current) return;

    const rect = displayCanvasRef.current.getBoundingClientRect();
    const scaleX = originalCanvasRef.current.width / rect.width;
    const scaleY = originalCanvasRef.current.height / rect.height;

    const x = Math.floor((e.clientX - rect.left) * scaleX);
    const y = Math.floor((e.clientY - rect.top) * scaleY);

    const ctx = originalCanvasRef.current.getContext("2d", { willReadFrequently: true });
    if (ctx) {
      const pixel = ctx.getImageData(x, y, 1, 1).data;
      setTargetColor({ r: pixel[0]!, g: pixel[1]!, b: pixel[2]! });
      setEyedropperActive(false);
    }
  };

  // Cloud AI bilan tozalash
  const handleAiRemove = async () => {
    try {
      setProcessing(true);
      setAiError(null);

      const res = await fetch("/api/uploads/remove-bg", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrl: value }),
      });

      const data = await res.json();
      if (data.ok && data.file?.url) {
        onChange(data.file.url);
        setModalOpen(false);
      } else {
        setAiError(
          data.error ||
            "AI API topilmadi. O'rnatilgan aqlli brauzer qirqish mexanizmidan foydalaning."
        );
      }
    } catch {
      setAiError("AI servisi bilan ulanishda xatolik yuz berdi.");
    } finally {
      setProcessing(false);
    }
  };

  // Qabul qilish va saqlash
  const handleSaveProcessed = async () => {
    if (!processedCanvasRef.current) return;

    try {
      setProcessing(true);
      const dataUrl = processedCanvasRef.current.toDataURL("image/webp", 0.92);

      const res = await fetch("/api/uploads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dataUrl,
          filename: "product-transparent.webp",
        }),
      });

      const data = await res.json();
      if (data.ok && data.file?.url) {
        onChange(data.file.url);
        setModalOpen(false);
      } else {
        alert(data.error || "Fonsiz rasmni saqlashda xatolik yuz berdi");
      }
    } catch (err) {
      console.error(err);
      alert("Saqlashda xatolik");
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-xs font-semibold">{label}</Label>
        {value && (
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="flex items-center gap-1.5 text-2xs font-bold text-primary hover:underline cursor-pointer"
          >
            <Wand2 size={13} />
            <span>Orqa fonni tozalash (Gibrid)</span>
          </button>
        )}
      </div>

      <div className="flex gap-2 items-center">
        {/* Rasm ko'rinishi (kichik thumbnail) */}
        <div
          className="relative h-10 w-10 shrink-0 overflow-hidden rounded-control border border-border bg-[repeating-conic-gradient(#f1f5f9_0%_25%,transparent_0%_50%)] bg-[length:10px_10px] dark:bg-[repeating-conic-gradient(#1e293b_0%_25%,transparent_0%_50%)] flex items-center justify-center cursor-pointer hover:border-primary/50 transition-colors"
          onClick={() => value && setModalOpen(true)}
          title={value ? "Fonni tozalash uchun bosing" : "Rasm yo'q"}
        >
          {value ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={value} alt="Preview" className="h-full w-full object-contain" />
          ) : (
            <ImageIcon size={18} className="text-muted-foreground/50" />
          )}
        </div>

        {/* URL Input */}
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="flex-1 text-xs"
        />

        {/* Fayl yuklash tugmasi */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/svg+xml"
          className="hidden"
          onChange={handleFileSelect}
        />

        <Button
          type="button"
          variant="subtle"
          size="sm"
          disabled={uploading}
          onClick={() => fileInputRef.current?.click()}
          className="gap-1.5 text-xs shrink-0 border border-border"
          title="Fayl tanlash (PNG, JPG, WEBP)"
        >
          {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
          <span className="hidden sm:inline">Yuklash</span>
        </Button>

        {/* Orqa fonni tozalash tugmasi (tezkor) */}
        {value && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setModalOpen(true)}
            className="gap-1.5 text-xs font-semibold text-primary shrink-0 border border-primary/30 bg-primary/5 hover:bg-primary/10"
            title="Orqa fonni olib tashlash (AI & Smart Matting)"
          >
            <Sparkles size={14} />
            <span className="hidden sm:inline">Fonni tozalash</span>
          </Button>
        )}

        {/* O'chirish tugmasi */}
        {value && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onChange("")}
            className="text-muted-foreground hover:text-destructive px-2 shrink-0"
            title="Rasmni o'chirish"
          >
            <Trash2 size={14} />
          </Button>
        )}
      </div>

      {/* Gibrid Fon Tozalash Modali */}
      <Modal
        open={modalOpen}
        onOpenChange={setModalOpen}
        title="Orqa fonni tozalash"
        wide
        footer={
          <div className="flex w-full items-center justify-between gap-3">
            <div className="text-xs text-muted-foreground">
              {mattingResult ? (
                <span className="inline-flex items-center gap-1.5">
                  <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
                  <strong>{mattingResult.percentRemoved}%</strong> fon toʻliq olib tashlandi
                </span>
              ) : null}
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setModalOpen(false)}
                disabled={processing}
              >
                Bekor qilish
              </Button>

              <Button
                variant="primary"
                size="sm"
                onClick={handleSaveProcessed}
                disabled={loadingImage || processing}
                className="gap-1.5"
              >
                {processing ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                Qabul qilish va saqlash
              </Button>
            </div>
          </div>
        }
      >
        <div className="space-y-4 text-xs">
          {aiError && (
            <div className="rounded-control border border-amber-500/30 bg-amber-500/10 p-3 text-amber-600 dark:text-amber-400">
              <p className="font-semibold text-2xs">{aiError}</p>
            </div>
          )}

          {/* Rasm ko'rsatish viewporti */}
          <div className="relative flex flex-col items-center justify-center rounded-control border border-border overflow-hidden">
            {/* Viewport Toolbar */}
            <div className="flex w-full items-center justify-between border-b border-border bg-muted/40 px-3 py-2 text-2xs">
              <div className="flex items-center gap-1.5 font-semibold text-muted-foreground">
                <span>Koʻrinish foni:</span>
                <div className="inline-flex rounded-btn border border-border bg-card p-0.5">
                  <button
                    type="button"
                    onClick={() => setPreviewBg("checker")}
                    className={`rounded-badge px-2 py-0.5 ${
                      previewBg === "checker"
                        ? "bg-primary text-primary-foreground font-bold"
                        : "hover:bg-secondary text-foreground"
                    }`}
                  >
                    🏁 Shaffof
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewBg("white")}
                    className={`rounded-badge px-2 py-0.5 ${
                      previewBg === "white"
                        ? "bg-primary text-primary-foreground font-bold"
                        : "hover:bg-secondary text-foreground"
                    }`}
                  >
                    ⚪ Oq
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewBg("dark")}
                    className={`rounded-badge px-2 py-0.5 ${
                      previewBg === "dark"
                        ? "bg-primary text-primary-foreground font-bold"
                        : "hover:bg-secondary text-foreground"
                    }`}
                  >
                    ⚫ Toʻq
                  </button>
                </div>
              </div>

              {/* Solishtirish (Oldin / Keyin) */}
              <button
                type="button"
                onMouseDown={() => setShowOriginal(true)}
                onMouseUp={() => setShowOriginal(false)}
                onTouchStart={() => setShowOriginal(true)}
                onTouchEnd={() => setShowOriginal(false)}
                className={`inline-flex items-center gap-1 rounded-control border px-2.5 py-1 font-bold select-none cursor-pointer transition-colors ${
                  showOriginal
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-card text-foreground hover:bg-secondary"
                }`}
                title="Asl holatini solishtirish uchun bosib turing"
              >
                <Eye size={12} />
                <span>{showOriginal ? "Asl rasm (Koʻrsatilyapti)" : "Asl rasmni solishtirish (Bosib turing)"}</span>
              </button>
            </div>

            {/* Asosiy Canvas maydoni */}
            <div
              className={`relative flex min-h-[300px] max-h-[460px] w-full items-center justify-center p-4 overflow-auto ${
                previewBg === "checker"
                  ? "bg-[repeating-conic-gradient(#f1f5f9_0%_25%,transparent_0%_50%)] bg-[length:16px_16px] dark:bg-[repeating-conic-gradient(#1e293b_0%_25%,transparent_0%_50%)]"
                  : previewBg === "white"
                  ? "bg-white"
                  : "bg-[#030712]"
              }`}
            >
              {loadingImage ? (
                <div className="flex flex-col items-center gap-2 text-muted-foreground">
                  <Loader2 size={24} className="animate-spin text-primary" />
                  <p>Rasm yuklanmoqda va tahlil qilinmoqda...</p>
                </div>
              ) : (
                <canvas
                  ref={displayCanvasRef}
                  onClick={handleCanvasClick}
                  className={`max-h-[420px] max-w-full object-contain rounded-control transition-all ${
                    eyedropperActive ? "cursor-crosshair ring-2 ring-primary ring-offset-2" : ""
                  }`}
                />
              )}

              {eyedropperActive && (
                <div className="absolute top-3 left-3 rounded-card border border-primary/40 bg-card/95 px-3 py-1.5 text-2xs font-bold text-primary shadow-control backdrop-blur-md">
                  Rasm ustidagi fon rangini tanlash uchun bir marta bosing
                </div>
              )}
            </div>
          </div>

          {/* Boshqaruv vositalari (Controls) */}
          <div className="rounded-control border border-border bg-muted/20 p-4 space-y-3.5">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
              <div className="flex items-center gap-3">
                <span className="font-bold text-foreground">Fon rangi:</span>
                <div className="flex items-center gap-2">
                  <span
                    className="h-5 w-5 rounded-circle border border-border shadow-xs"
                    style={{
                      backgroundColor: `rgb(${targetColor.r}, ${targetColor.g}, ${targetColor.b})`,
                    }}
                  />
                  <code className="text-2xs text-muted-foreground">
                    rgb({targetColor.r}, {targetColor.g}, {targetColor.b})
                  </code>
                </div>

                <Button
                  type="button"
                  variant={eyedropperActive ? "primary" : "subtle"}
                  size="sm"
                  onClick={() => setEyedropperActive(!eyedropperActive)}
                  className="gap-1.5 text-2xs h-7 border border-border"
                >
                  <Pipette size={12} />
                  <span>{eyedropperActive ? "Tanlanmoqda..." : "Tomizgʻich (Pipette)"}</span>
                </Button>

                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    if (originalCanvasRef.current) {
                      const ctx = originalCanvasRef.current.getContext("2d");
                      if (ctx) {
                        const imgData = ctx.getImageData(
                          0,
                          0,
                          originalCanvasRef.current.width,
                          originalCanvasRef.current.height
                        );
                        setTargetColor(detectCornerBackgroundColor(imgData));
                      }
                    }
                  }}
                  className="gap-1 text-2xs h-7 text-muted-foreground"
                  title="Burchaklardan avtomatik aniqlash"
                >
                  <RotateCcw size={12} />
                  <span>Avto-rang</span>
                </Button>
              </div>

              {/* Cloud AI Action */}
              <Button
                type="button"
                variant="subtle"
                size="sm"
                onClick={handleAiRemove}
                disabled={processing}
                className="gap-1.5 text-2xs h-7 border border-primary/30 text-primary hover:bg-primary/10"
              >
                <Sparkles size={12} />
                <span>Cloud AI bilan sinab koʻrish</span>
              </Button>
            </div>

            {/* Slayderlar (Tolerance, Feather, Mode) */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              {/* Sezuvchanlik */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-2xs">
                  <span className="font-semibold text-foreground">Sezuvchanlik (Tolerance):</span>
                  <span className="font-mono font-bold text-primary">{tolerance}</span>
                </div>
                <input
                  type="range"
                  min="5"
                  max="85"
                  value={tolerance}
                  onChange={(e) => setTolerance(Number(e.target.value))}
                  className="w-full accent-primary h-1.5 cursor-pointer"
                />
                <p className="text-3xs text-muted-foreground">
                  Oshirilsa, fonga yaqinroq tuslar ham tozalanadi
                </p>
              </div>

              {/* Qirralarni yumshatish */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-2xs">
                  <span className="font-semibold text-foreground">Qirralarni yumshatish:</span>
                  <span className="font-mono font-bold text-primary">{feather}px</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="6"
                  value={feather}
                  onChange={(e) => setFeather(Number(e.target.value))}
                  className="w-full accent-primary h-1.5 cursor-pointer"
                />
                <p className="text-3xs text-muted-foreground">
                  Qirralar arra boʻlmasligi uchun yarim-shaffoflik
                </p>
              </div>

              {/* Qirqish usuli */}
              <div className="space-y-1.5">
                <span className="block font-semibold text-foreground text-2xs">Qirqish usuli:</span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setMode("flood-fill")}
                    className={`flex-1 rounded-control border px-2 py-1 text-2xs font-bold transition-all ${
                      mode === "flood-fill"
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-card text-foreground hover:bg-secondary"
                    }`}
                  >
                    Tashqi fon (Flood-fill)
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode("global")}
                    className={`flex-1 rounded-control border px-2 py-1 text-2xs font-bold transition-all ${
                      mode === "global"
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-card text-foreground hover:bg-secondary"
                    }`}
                  >
                    Global
                  </button>
                </div>
                <p className="text-3xs text-muted-foreground">
                  Flood-fill mahsulot ichidagi oq qismlarni oʻchirib yubormaydi
                </p>
              </div>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
