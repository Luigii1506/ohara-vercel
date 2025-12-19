"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useUser } from "@/app/context/UserContext";
import {
  Shield,
  Edit,
  Plus,
  Settings,
  BarChart3,
  Users,
  Package,
  FileText,
  Database,
  ArrowRight,
  Upload,
  Calendar,
  ShoppingBag,
  Layers,
  Link as LinkIcon,
  AlertTriangle,
  BellRing,
  Activity,
} from "lucide-react";

export default function AdminDashboard() {
  const router = useRouter();
  const { role, loading } = useUser();
  const [isVisible, setIsVisible] = useState(false);
  const [alertStats, setAlertStats] = useState<{
    activeAlerts: number;
    inactiveAlerts: number;
    alertsTriggered24h: number;
    unreadNotifications: number;
    lastTriggerAt: string | null;
  } | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);

  useEffect(() => {
    if (!loading && role !== "ADMIN") {
      router.push("/unauthorized");
    }
  }, [role, loading, router]);

  useEffect(() => {
    setIsVisible(true);
  }, []);

  useEffect(() => {
    const loadStats = async () => {
      setStatsLoading(true);
      try {
        const res = await fetch("/api/admin/alerts/stats");
        if (!res.ok) {
          throw new Error("Failed to load alert stats");
        }
        const data = await res.json();
        setAlertStats(data);
      } catch (error) {
        console.error(error);
      } finally {
        setStatsLoading(false);
      }
    };
    if (role === "ADMIN") {
      loadStats();
    }
  }, [role]);

  const formatDateTime = (value?: string | null) => {
    if (!value) return "—";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "—";
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(date);
  };

  const adminSections = [
    {
      title: "Card Management",
      description: "Manage cards and their variations",
      icon: Package,
      color: "from-blue-500 to-blue-600",
      items: [
        {
          href: "/admin/edit-card",
          label: "Edit Cards",
          icon: Edit,
          description: "Modify existing card information",
        },
        {
          href: "/admin/add-card",
          label: "Add New Card",
          icon: Plus,
          description: "Create new card entries",
        },
        {
          href: "/admin/tcg-linker",
          label: "TCG Linker",
          icon: LinkIcon,
          description: "Link cards to TCGplayer products",
        },
        {
          href: "/admin/add-rulings",
          label: "Add Rulings",
          icon: FileText,
          description: "Add rules and clarifications for cards",
        },
      ],
    },
    {
      title: "Set Management",
      description: "Manage card sets and collections",
      icon: Database,
      color: "from-purple-500 to-purple-600",
      items: [
        {
          href: "/admin/sets",
          label: "Manage Sets",
          icon: Package,
          description: "Create, edit, and manage card sets",
        },
        {
          href: "/admin/upload-sets",
          label: "Upload Sets",
          icon: Upload,
          description: "Bulk upload card sets from files",
        },
        {
          href: "/admin/set-visualizer",
          label: "Set Visualizer",
          icon: Layers,
          description: "Visualize cards grouped by selected sets",
        },
      ],
    },
    {
      title: "Event Management",
      description: "Manage tournaments and events",
      icon: Calendar,
      color: "from-green-500 to-green-600",
      items: [
        {
          href: "/admin/add-event",
          label: "Add Event",
          icon: Plus,
          description: "Create new tournaments or events",
        },
        {
          href: "/admin/events",
          label: "Manage Events",
          icon: Settings,
          description: "View and edit existing events",
        },
      ],
    },
    {
      title: "Site Administration",
      description: "General site management and analytics",
      icon: BarChart3,
      color: "from-orange-500 to-orange-600",
      items: [
        {
          href: "/admin/analytics",
          label: "Analytics Dashboard",
          icon: BarChart3,
          description: "View site statistics and metrics",
        },
        {
          href: "/admin/users",
          label: "User Management",
          icon: Users,
          description: "Manage user accounts and permissions",
        },
        {
          href: "/admin/create-decks",
          label: "Create Shop Decks",
          icon: ShoppingBag,
          description: "Build and publish decks for the store",
        },
        {
          href: "/admin/shop-decks",
          label: "Manage Shop Decks",
          icon: Layers,
          description: "Edit and manage decks available in the shop",
        },
        {
          href: "/admin/alerts",
          label: "Price Alerts",
          icon: AlertTriangle,
          description: "Configure TCGplayer price alert rules",
        },
      ],
    },
  ];

  if (loading) {
    return (
      <div className="w-full h-full bg-gradient-to-b from-[#f2eede] to-[#e6d5b8] flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-red-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading admin panel...</p>
        </div>
      </div>
    );
  }

  if (role !== "ADMIN") {
    return null;
  }

  return (
    <div className="h-full py-8 px-4 w-full overflow-auto bg-gradient-to-b from-[#f2eede] to-[#e6d5b8]">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-10">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-red-500 rounded-xl shadow-lg">
              <Shield size={28} className="text-white" />
            </div>
            <div>
              <h1 className="text-4xl font-bold text-gray-800">
                Admin Dashboard
              </h1>
              <p className="text-gray-600 mt-1">
                Manage all aspects of OharaTCG
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            <div className="rounded-2xl border border-red-100 bg-white/80 p-4 shadow-sm">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs uppercase text-gray-500">
                    Active alerts
                  </p>
                  <p className="text-3xl font-bold text-gray-900">
                    {alertStats?.activeAlerts ?? (statsLoading ? "…" : 0)}
                  </p>
                </div>
                <AlertTriangle className="h-8 w-8 text-red-400" />
              </div>
              <p className="mt-2 text-xs text-gray-500">
                Last trigger: {formatDateTime(alertStats?.lastTriggerAt)}
              </p>
            </div>
            <div className="rounded-2xl border border-blue-100 bg-white/80 p-4 shadow-sm">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs uppercase text-gray-500">
                    Triggers (24h)
                  </p>
                  <p className="text-3xl font-bold text-gray-900">
                    {alertStats?.alertsTriggered24h ?? (statsLoading ? "…" : 0)}
                  </p>
                </div>
                <Activity className="h-8 w-8 text-blue-500" />
              </div>
              <p className="mt-2 text-xs text-gray-500">
                Inactive alerts: {alertStats?.inactiveAlerts ?? 0}
              </p>
            </div>
            <div className="rounded-2xl border border-yellow-100 bg-white/80 p-4 shadow-sm">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs uppercase text-gray-500">
                    Unread notifications
                  </p>
                  <p className="text-3xl font-bold text-gray-900">
                    {alertStats?.unreadNotifications ?? (statsLoading ? "…" : 0)}
                  </p>
                </div>
                <BellRing className="h-8 w-8 text-yellow-500" />
              </div>
              <p className="mt-2 text-xs text-gray-500">
                Powered by TCGplayer sync
              </p>
            </div>
          </div>
        </div>

        {/* Admin Sections Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {adminSections.map((section) => {
            const Icon = section.icon;
            return (
              <div
                key={section.title}
                className="bg-white rounded-xl shadow-md overflow-hidden transition-shadow duration-200 hover:shadow-lg"
              >
                {/* Section Header */}
                <div className={`p-5 bg-gradient-to-r ${section.color}`}>
                  <div className="flex items-start justify-between">
                    <div>
                      <h2 className="text-xl font-bold text-white mb-1">
                        {section.title}
                      </h2>
                      <p className="text-white/90 text-sm">
                        {section.description}
                      </p>
                    </div>
                    <Icon size={28} className="text-white/70" />
                  </div>
                </div>

                {/* Section Items */}
                <div className="p-3">
                  {section.items.map((item, itemIndex) => {
                    const ItemIcon = item.icon;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className="group flex items-center gap-3 p-3 rounded-md hover:bg-gray-50 transition-colors duration-150"
                      >
                        <div className="p-1.5 bg-gray-100 rounded-md group-hover:bg-gray-150 transition-colors duration-150">
                          <ItemIcon size={16} className="text-gray-600" />
                        </div>
                        <div className="flex-1">
                          <h3 className="font-medium text-gray-800 text-sm">
                            {item.label}
                          </h3>
                          <p className="text-xs text-gray-500">
                            {item.description}
                          </p>
                        </div>
                        <ArrowRight
                          size={14}
                          className="text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity duration-150"
                        />
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Quick Stats */}
        <div className="mt-8 bg-white rounded-xl shadow-md p-6">
          <h3 className="text-lg font-bold text-gray-800 mb-4">Quick Stats</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <p className="text-2xl font-bold text-blue-600">1,234</p>
              <p className="text-xs text-gray-600 mt-1">Total Cards</p>
            </div>
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <p className="text-2xl font-bold text-purple-600">56</p>
              <p className="text-xs text-gray-600 mt-1">Card Sets</p>
            </div>
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <p className="text-2xl font-bold text-green-600">789</p>
              <p className="text-xs text-gray-600 mt-1">Active Users</p>
            </div>
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <p className="text-2xl font-bold text-orange-600">12</p>
              <p className="text-xs text-gray-600 mt-1">Upcoming Events</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
