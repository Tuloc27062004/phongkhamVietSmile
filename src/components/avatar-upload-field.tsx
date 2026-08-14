import { useState } from "react";
import Cropper, { type Area } from "react-easy-crop";
import { Check, Link as LinkIcon, Loader2, Upload, UserRound } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { getCroppedImageBlob } from "@/lib/image-crop";

/** Avatar picker: upload + crop to a circle, or paste a direct image URL (e.g. a public Google Drive link). */
export function AvatarUploadField({
  value,
  organizationId,
  ownerId,
  disabled,
  onUploaded,
}: {
  value: string;
  organizationId: string;
  ownerId: string;
  disabled: boolean;
  onUploaded: (url: string) => void;
}) {
  const [pendingImage, setPendingImage] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [uploading, setUploading] = useState(false);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [urlInput, setUrlInput] = useState("");

  const closeCropDialog = () => {
    if (pendingImage) URL.revokeObjectURL(pendingImage);
    setPendingImage(null);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCroppedAreaPixels(null);
  };

  const handleFileSelect = (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Chỉ chấp nhận file ảnh");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      toast.error("Dung lượng ảnh tối đa 8MB");
      return;
    }
    setPendingImage(URL.createObjectURL(file));
  };

  const handleConfirmCrop = async () => {
    if (!pendingImage || !croppedAreaPixels) return;
    setUploading(true);
    try {
      const blob = await getCroppedImageBlob(pendingImage, croppedAreaPixels);
      const path = `${organizationId}/avatars/${ownerId}-${Date.now()}.jpg`;
      const { error } = await supabase.storage
        .from("clinic-assets")
        .upload(path, blob, { upsert: true, contentType: "image/jpeg", cacheControl: "3600" });
      if (error) throw error;
      const { data } = supabase.storage.from("clinic-assets").getPublicUrl(path);
      onUploaded(data.publicUrl);
      toast.success("Đã cập nhật ảnh đại diện");
      closeCropDialog();
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setUploading(false);
    }
  };

  const handleUrlSubmit = () => {
    const trimmed = urlInput.trim();
    if (!trimmed) return;
    try {
      new URL(trimmed);
    } catch {
      toast.error("URL không hợp lệ");
      return;
    }
    onUploaded(trimmed);
    toast.success("Đã cập nhật ảnh đại diện");
    setUrlInput("");
    setShowUrlInput(false);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-muted">
          {value ? (
            <img src={value} alt="" className="size-full object-cover" />
          ) : (
            <UserRound className="size-6 text-muted-foreground" />
          )}
        </div>
        <div className="min-w-0 space-y-1.5">
          <div className="flex flex-wrap gap-2">
            <label
              className={`inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-input px-2.5 py-1.5 text-xs font-medium transition-colors hover:bg-accent ${
                disabled ? "pointer-events-none opacity-50" : ""
              }`}
            >
              <Upload className="size-3.5" />
              Tải & cắt ảnh
              <input
                type="file"
                accept="image/*"
                className="hidden"
                disabled={disabled}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) handleFileSelect(file);
                  event.target.value = "";
                }}
              />
            </label>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-auto px-2.5 py-1.5 text-xs"
              disabled={disabled}
              onClick={() => setShowUrlInput((prev) => !prev)}
            >
              <LinkIcon className="mr-1.5 size-3.5" />
              Dán URL
            </Button>
          </div>
          {showUrlInput && (
            <div className="flex gap-2">
              <Input
                placeholder="https://drive.google.com/uc?id=..."
                value={urlInput}
                onChange={(event) => setUrlInput(event.target.value)}
                className="h-8 text-xs"
              />
              <Button type="button" size="sm" className="h-8" onClick={handleUrlSubmit}>
                Lưu
              </Button>
            </div>
          )}
          <p className="text-xs text-muted-foreground">Ảnh vuông sẽ đẹp nhất — có thể cắt ngay sau khi tải lên.</p>
        </div>
      </div>

      <Dialog open={Boolean(pendingImage)} onOpenChange={(open) => !open && closeCropDialog()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Cắt ảnh đại diện</DialogTitle>
          </DialogHeader>
          <div className="relative h-72 w-full overflow-hidden rounded-lg bg-black">
            {pendingImage && (
              <Cropper
                image={pendingImage}
                crop={crop}
                zoom={zoom}
                aspect={1}
                cropShape="round"
                showGrid={false}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={(_area, pixels) => setCroppedAreaPixels(pixels)}
              />
            )}
          </div>
          <div className="flex items-center gap-3 pt-1">
            <span className="text-xs text-muted-foreground">Zoom</span>
            <input
              type="range"
              min={1}
              max={3}
              step={0.05}
              value={zoom}
              onChange={(event) => setZoom(Number(event.target.value))}
              className="flex-1"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={closeCropDialog}>
              Hủy
            </Button>
            <Button type="button" onClick={handleConfirmCrop} disabled={uploading}>
              {uploading ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Check className="mr-2 size-4" />}
              Cắt & Lưu
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
