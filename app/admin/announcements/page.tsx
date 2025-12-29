"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  Plus,
  Search,
  Edit,
  Trash2,
  Megaphone,
  Eye,
  MousePointerClick,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { showSuccessToast, showErrorToast } from "@/lib/toastify";
import EditAnnouncementModal, {
  Announcement,
} from "@/app/admin/announcements/components/EditAnnouncementModal";
import DeleteAnnouncementModal from "@/app/admin/announcements/components/DeleteAnnouncementModal";

interface AnnouncementMetrics {
  impressions: number;
  dismisses: number;
  clicks: number;
}

type AnnouncementWithMetrics = Announcement & {
  metrics?: AnnouncementMetrics;
  createdAt: string;
};

const AnnouncementsAdmin = () => {
  const [loading, setLoading] = useState(true);
  const [announcements, setAnnouncements] = useState<
    AnnouncementWithMetrics[]
  >([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [editingAnnouncement, setEditingAnnouncement] =
    useState<Announcement | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletingAnnouncement, setDeletingAnnouncement] =
    useState<Announcement | null>(null);

  const fetchAnnouncements = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/admin/announcements");
      if (!response.ok) {
        throw new Error("Failed to load announcements.");
      }
      const data = await response.json();
      setAnnouncements(data);
    } catch (error) {
      console.error("Error fetching announcements:", error);
      showErrorToast("Error loading announcements.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnnouncements();
  }, []);

  const filtered = useMemo(() => {
    if (!searchTerm) return announcements;
    const lower = searchTerm.toLowerCase();
    return announcements.filter((item) =>
      item.titleEn.toLowerCase().includes(lower)
    );
  }, [announcements, searchTerm]);

  const handleCreate = () => {
    setEditingAnnouncement(null);
    setShowEditModal(true);
  };

  const handleEdit = (announcement: Announcement) => {
    setEditingAnnouncement(announcement);
    setShowEditModal(true);
  };

  const handleDelete = (announcement: Announcement) => {
    setDeletingAnnouncement(announcement);
    setShowDeleteModal(true);
  };

  const handleDeleteConfirm = async () => {
    if (!deletingAnnouncement) return;
    try {
      const response = await fetch(
        `/api/admin/announcements/${deletingAnnouncement.id}`,
        { method: "DELETE" }
      );
      if (!response.ok) {
        throw new Error("Failed to delete announcement.");
      }
      showSuccessToast("Announcement deleted.");
      setShowDeleteModal(false);
      setDeletingAnnouncement(null);
      fetchAnnouncements();
    } catch (error) {
      console.error("Error deleting announcement:", error);
      showErrorToast("Could not delete announcement.");
    }
  };

  const handleSaved = (announcement: Announcement) => {
    setAnnouncements((prev) => {
      const exists = prev.find((item) => item.id === announcement.id);
      if (exists) {
        return prev.map((item) =>
          item.id === announcement.id
            ? { ...item, ...announcement, createdAt: item.createdAt }
            : item
        );
      }
      return [
        {
          ...announcement,
          createdAt: new Date().toISOString(),
        },
        ...prev,
      ];
    });
  };

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-slate-900">
              <Megaphone className="h-6 w-6" />
              <h1 className="text-xl font-semibold">Announcements</h1>
            </div>
            <p className="text-sm text-slate-500">
              Control modal updates, audiences, and visibility.
            </p>
          </div>
          <Button onClick={handleCreate} className="bg-slate-900 text-white">
            <Plus className="mr-2 h-4 w-4" />
            New announcement
          </Button>
        </div>

        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="relative w-full sm:max-w-sm">
                <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <Input
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Search announcements..."
                  className="pl-9"
                />
              </div>
              <Badge variant="secondary">{filtered.length} total</Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Audience</TableHead>
                  <TableHead>Screens</TableHead>
                  <TableHead>Schedule</TableHead>
                  <TableHead>Metrics</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-sm">
                      Loading announcements...
                    </TableCell>
                  </TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-sm">
                      No announcements found.
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((announcement) => (
                    <TableRow key={announcement.id}>
                      <TableCell>
                        <div className="font-medium text-slate-900">
                          {announcement.titleEn}
                        </div>
                        <div className="text-xs text-slate-500">
                          v{announcement.version} · Priority {announcement.priority}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={
                            announcement.status === "PUBLISHED"
                              ? "border-emerald-200 text-emerald-700"
                              : announcement.status === "DRAFT"
                              ? "border-amber-200 text-amber-700"
                              : "border-slate-200 text-slate-600"
                          }
                        >
                          {announcement.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{announcement.audience}</Badge>
                      </TableCell>
                      <TableCell className="text-xs text-slate-600">
                        {announcement.screens?.length
                          ? announcement.screens.join(", ")
                          : "All"}
                      </TableCell>
                      <TableCell className="text-xs text-slate-600">
                        <div>
                          {announcement.startAt
                            ? new Date(announcement.startAt).toLocaleString()
                            : "Start: -"}
                        </div>
                        <div>
                          {announcement.endAt
                            ? new Date(announcement.endAt).toLocaleString()
                            : "End: -"}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1 text-xs text-slate-600">
                          <span className="flex items-center gap-1">
                            <Eye className="h-3 w-3" />
                            {announcement.metrics?.impressions || 0}
                          </span>
                          <span className="flex items-center gap-1">
                            <MousePointerClick className="h-3 w-3" />
                            {announcement.metrics?.clicks || 0}
                          </span>
                          <span className="flex items-center gap-1">
                            <XCircle className="h-3 w-3" />
                            {announcement.metrics?.dismisses || 0}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEdit(announcement)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleDelete(announcement)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <EditAnnouncementModal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        editingAnnouncement={editingAnnouncement}
        onSaved={handleSaved}
      />

      <DeleteAnnouncementModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={handleDeleteConfirm}
        title={deletingAnnouncement?.titleEn}
      />
    </div>
  );
};

export default AnnouncementsAdmin;
