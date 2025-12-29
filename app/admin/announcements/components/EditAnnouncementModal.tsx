"use client";

import React, { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Edit, Loader2 } from "lucide-react";
import { showSuccessToast, showErrorToast } from "@/lib/toastify";

interface AnnouncementFormData {
  titleEn: string;
  bodyEn: string;
  ctaLabelEn: string;
  titleEs: string;
  bodyEs: string;
  ctaLabelEs: string;
  ctaUrl: string;
  audience: "ALL" | "AUTH" | "GUEST";
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  screens: string;
  startAt: string;
  endAt: string;
  priority: number;
  version: number;
  showOnce: boolean;
}

export interface Announcement {
  id: number;
  titleEn: string;
  bodyEn: string;
  ctaLabelEn?: string | null;
  titleEs?: string | null;
  bodyEs?: string | null;
  ctaLabelEs?: string | null;
  ctaUrl?: string | null;
  audience: "ALL" | "AUTH" | "GUEST";
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  screens?: string[] | null;
  startAt?: string | null;
  endAt?: string | null;
  priority: number;
  version: number;
  showOnce: boolean;
}

interface EditAnnouncementModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingAnnouncement: Announcement | null;
  onSaved: (announcement: Announcement) => void;
}

const formatDateTimeLocal = (value?: string | null) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate()
  )}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const EditAnnouncementModal: React.FC<EditAnnouncementModalProps> = ({
  isOpen,
  onClose,
  editingAnnouncement,
  onSaved,
}) => {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<AnnouncementFormData>({
    titleEn: "",
    bodyEn: "",
    ctaLabelEn: "",
    titleEs: "",
    bodyEs: "",
    ctaLabelEs: "",
    ctaUrl: "",
    audience: "ALL",
    status: "DRAFT",
    screens: "",
    startAt: "",
    endAt: "",
    priority: 0,
    version: 1,
    showOnce: true,
  });

  const isEditing = Boolean(editingAnnouncement);

  useEffect(() => {
    if (!isOpen) return;
    if (editingAnnouncement) {
      setFormData({
        titleEn: editingAnnouncement.titleEn,
        bodyEn: editingAnnouncement.bodyEn,
        ctaLabelEn: editingAnnouncement.ctaLabelEn || "",
        titleEs: editingAnnouncement.titleEs || "",
        bodyEs: editingAnnouncement.bodyEs || "",
        ctaLabelEs: editingAnnouncement.ctaLabelEs || "",
        ctaUrl: editingAnnouncement.ctaUrl || "",
        audience: editingAnnouncement.audience,
        status: editingAnnouncement.status,
        screens: editingAnnouncement.screens?.join(", ") || "",
        startAt: formatDateTimeLocal(editingAnnouncement.startAt),
        endAt: formatDateTimeLocal(editingAnnouncement.endAt),
        priority: editingAnnouncement.priority,
        version: editingAnnouncement.version,
        showOnce: editingAnnouncement.showOnce,
      });
    } else {
      setFormData({
        titleEn: "",
        bodyEn: "",
        ctaLabelEn: "",
        titleEs: "",
        bodyEs: "",
        ctaLabelEs: "",
        ctaUrl: "",
        audience: "ALL",
        status: "DRAFT",
        screens: "",
        startAt: "",
        endAt: "",
        priority: 0,
        version: 1,
        showOnce: true,
      });
    }
  }, [isOpen, editingAnnouncement]);

  const handleChange = (
    field: keyof AnnouncementFormData,
    value: string | number | boolean
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!formData.titleEn || !formData.bodyEn) {
      showErrorToast("Title and body (EN) are required.");
      return;
    }

    setLoading(true);
    try {
      const url = isEditing
        ? `/api/admin/announcements/${editingAnnouncement!.id}`
        : "/api/admin/announcements";
      const method = isEditing ? "PATCH" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          priority: Number(formData.priority),
          version: Number(formData.version),
          startAt: formData.startAt || null,
          endAt: formData.endAt || null,
          screens: formData.screens,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to save announcement.");
      }

      const saved = await response.json();
      onSaved(saved);
      onClose();
      showSuccessToast(
        isEditing ? "Announcement updated." : "Announcement created."
      );
    } catch (error) {
      console.error("Error saving announcement:", error);
      showErrorToast("Could not save the announcement.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isEditing ? (
              <>
                <Edit className="h-5 w-5 text-blue-600" />
                <span className="text-blue-600">Edit Announcement</span>
              </>
            ) : (
              <>
                <Plus className="h-5 w-5 text-emerald-600" />
                <span className="text-emerald-600">New Announcement</span>
              </>
            )}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSave} className="space-y-5">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Title (EN)</Label>
              <Input
                value={formData.titleEn}
                onChange={(event) => handleChange("titleEn", event.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>CTA Label (EN)</Label>
              <Input
                value={formData.ctaLabelEn}
                onChange={(event) =>
                  handleChange("ctaLabelEn", event.target.value)
                }
                placeholder="Optional"
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Body (EN)</Label>
              <Textarea
                value={formData.bodyEn}
                onChange={(event) => handleChange("bodyEn", event.target.value)}
                rows={3}
                required
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Title (ES)</Label>
              <Input
                value={formData.titleEs}
                onChange={(event) => handleChange("titleEs", event.target.value)}
                placeholder="Opcional"
              />
            </div>
            <div className="space-y-2">
              <Label>CTA Label (ES)</Label>
              <Input
                value={formData.ctaLabelEs}
                onChange={(event) =>
                  handleChange("ctaLabelEs", event.target.value)
                }
                placeholder="Opcional"
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Body (ES)</Label>
              <Textarea
                value={formData.bodyEs}
                onChange={(event) => handleChange("bodyEs", event.target.value)}
                rows={3}
                placeholder="Opcional"
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>CTA URL</Label>
              <Input
                value={formData.ctaUrl}
                onChange={(event) => handleChange("ctaUrl", event.target.value)}
                placeholder="https://..."
              />
            </div>
            <div className="space-y-2">
              <Label>Screens (comma-separated)</Label>
              <Input
                value={formData.screens}
                onChange={(event) => handleChange("screens", event.target.value)}
                placeholder="/card-list, /lists"
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Audience</Label>
              <Select
                value={formData.audience}
                onValueChange={(value) =>
                  handleChange("audience", value as AnnouncementFormData["audience"])
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All users</SelectItem>
                  <SelectItem value="AUTH">Logged-in</SelectItem>
                  <SelectItem value="GUEST">Guests</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={formData.status}
                onValueChange={(value) =>
                  handleChange("status", value as AnnouncementFormData["status"])
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="DRAFT">Draft</SelectItem>
                  <SelectItem value="PUBLISHED">Published</SelectItem>
                  <SelectItem value="ARCHIVED">Archived</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Start at</Label>
              <Input
                type="datetime-local"
                value={formData.startAt}
                onChange={(event) =>
                  handleChange("startAt", event.target.value)
                }
              />
            </div>
            <div className="space-y-2">
              <Label>End at</Label>
              <Input
                type="datetime-local"
                value={formData.endAt}
                onChange={(event) =>
                  handleChange("endAt", event.target.value)
                }
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label>Priority</Label>
              <Input
                type="number"
                value={formData.priority}
                onChange={(event) =>
                  handleChange("priority", Number(event.target.value))
                }
                min={0}
              />
            </div>
            <div className="space-y-2">
              <Label>Version</Label>
              <Input
                type="number"
                value={formData.version}
                onChange={(event) =>
                  handleChange("version", Number(event.target.value))
                }
                min={1}
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2">
              <div>
                <Label className="text-sm">Show once</Label>
                <p className="text-xs text-slate-500">
                  Hide after dismiss/click
                </p>
              </div>
              <Switch
                checked={formData.showOnce}
                onCheckedChange={(value) => handleChange("showOnce", value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEditing ? "Save changes" : "Create announcement"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default EditAnnouncementModal;
