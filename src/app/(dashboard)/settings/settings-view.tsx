"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import { SETTINGS_TABS } from "./tabs";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChevronDown, Eye, EyeOff, Loader2, Pencil, Plus, Power, Trash2, Star, X } from "lucide-react";
import { toast } from "sonner";

// --- Types ---

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  createdAt: string;
}

interface SesConfig {
  id?: string;
  name: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  configSetName: string;
  defaultFromEmail: string;
  isActive?: boolean;
}

interface SesIdentity {
  identity: string;
  type: string;
  verified: boolean;
}

interface SwipeOneConfig {
  id?: string;
  name: string;
  apiKey: string;
  baseUrl: string;
  workspaceId: string;
  isActive?: boolean;
}

interface AiConfigType {
  id?: string;
  name: string;
  provider: string;
  apiKey: string;
  model: string;
  baseUrl: string;
  isActive?: boolean;
}

interface R2ConfigType {
  id?: string;
  name: string;
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucketName: string;
  publicUrl: string;
  isActive?: boolean;
}

interface FreemiusConfigType {
  id?: string;
  name: string;
  developerId: string;
  publicKey: string;
  secretKey: string;
  isActive?: boolean;
}

interface ProductType {
  id?: string;
  name: string;
  logoUrl: string;
  wpOrgSlug: string;
  landingPageUrl: string;
  pricingPageUrl: string;
}

const emptyProduct: ProductType = {
  name: "",
  logoUrl: "",
  wpOrgSlug: "",
  landingPageUrl: "",
  pricingPageUrl: "",
};

interface CampaignCategoryType {
  id?: string;
  name: string;
  slug: string;
  description: string;
  swipeOneTagOverride: string;
  autoCheckOnUnsubscribe: boolean;
}

const emptyCategory: CampaignCategoryType = {
  name: "",
  slug: "",
  description: "",
  swipeOneTagOverride: "",
  autoCheckOnUnsubscribe: false,
};

function slugifyName(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const emptySes: SesConfig = {
  name: "",
  region: "",
  accessKeyId: "",
  secretAccessKey: "",
  configSetName: "",
  defaultFromEmail: "",
};

const emptySwipeone: SwipeOneConfig = {
  name: "",
  apiKey: "",
  baseUrl: "https://api.swipeone.com",
  workspaceId: "",
};

const emptyAi: AiConfigType = {
  name: "",
  provider: "openrouter",
  apiKey: "",
  model: "google/gemini-2.0-flash-001",
  baseUrl: "https://openrouter.ai/api/v1",
};

const emptyR2: R2ConfigType = {
  name: "",
  accountId: "",
  accessKeyId: "",
  secretAccessKey: "",
  bucketName: "",
  publicUrl: "",
};

const emptyFreemius: FreemiusConfigType = {
  name: "",
  developerId: "",
  publicKey: "",
  secretKey: "",
};

export function SettingsView() {
  // Tabs are addressable: /settings is the App tab, /settings/<tab> selects one.
  const pathname = usePathname();
  const segment = pathname.split("/")[2] || "";
  const activeTab = (SETTINGS_TABS as readonly string[]).includes(segment) ? segment : "app";

  const router = useRouter();
  const [loading, setLoading] = useState(true);

  // SES
  const [sesConfigs, setSesConfigs] = useState<SesConfig[]>([]);
  const [sesForm, setSesForm] = useState<SesConfig>(emptySes);
  const [sesDialogOpen, setSesDialogOpen] = useState(false);
  const [sesEditing, setSesEditing] = useState(false);
  const [savingSes, setSavingSes] = useState(false);
  const [testingSes, setTestingSes] = useState(false);
  const [showSesAccessKey, setShowSesAccessKey] = useState(false);
  const [showSesSecretKey, setShowSesSecretKey] = useState(false);
  const [sesDialogIdentities, setSesDialogIdentities] = useState<SesIdentity[]>([]);
  const [sesDialogIdentitiesLoading, setSesDialogIdentitiesLoading] = useState(false);
  const [sesDialogIdentitiesError, setSesDialogIdentitiesError] = useState<string | null>(null);

  // SwipeOne
  const [swipeoneConfigs, setSwipeoneConfigs] = useState<SwipeOneConfig[]>([]);
  const [swipeoneForm, setSwipeoneForm] = useState<SwipeOneConfig>(emptySwipeone);
  const [swipeoneDialogOpen, setSwipeoneDialogOpen] = useState(false);
  const [swipeoneEditing, setSwipeoneEditing] = useState(false);
  const [savingSwipeone, setSavingSwipeone] = useState(false);
  const [testingSwipeone, setTestingSwipeone] = useState(false);
  const [showSwipeoneApiKey, setShowSwipeoneApiKey] = useState(false);

  // Popular Variables
  type PopularVariable = { id: string; name: string; label?: string | null };
  const [popularVariables, setPopularVariables] = useState<PopularVariable[]>([]);
  const [newPopularName, setNewPopularName] = useState("");
  const [newPopularLabel, setNewPopularLabel] = useState("");
  const [savingPopular, setSavingPopular] = useState(false);
  const [swipeOneFieldList, setSwipeOneFieldList] = useState<{ name: string; label: string }[]>([]);

  // AI Config
  const [aiConfigs, setAiConfigs] = useState<AiConfigType[]>([]);
  const [aiForm, setAiForm] = useState<AiConfigType>(emptyAi);
  const [aiDialogOpen, setAiDialogOpen] = useState(false);
  const [aiEditing, setAiEditing] = useState(false);
  const [savingAi, setSavingAi] = useState(false);
  const [testingAi, setTestingAi] = useState(false);
  const [showAiApiKey, setShowAiApiKey] = useState(false);

  // R2 Config
  const [r2Configs, setR2Configs] = useState<R2ConfigType[]>([]);
  const [r2Form, setR2Form] = useState<R2ConfigType>(emptyR2);
  const [r2DialogOpen, setR2DialogOpen] = useState(false);
  const [r2Editing, setR2Editing] = useState(false);
  const [savingR2, setSavingR2] = useState(false);
  const [testingR2, setTestingR2] = useState(false);
  const [showR2AccessKey, setShowR2AccessKey] = useState(false);
  const [showR2SecretKey, setShowR2SecretKey] = useState(false);

  // Freemius Config
  const [freemiusConfigs, setFreemiusConfigs] = useState<FreemiusConfigType[]>([]);
  const [freemiusForm, setFreemiusForm] = useState<FreemiusConfigType>(emptyFreemius);
  const [freemiusDialogOpen, setFreemiusDialogOpen] = useState(false);
  const [freemiusEditing, setFreemiusEditing] = useState(false);
  const [savingFreemius, setSavingFreemius] = useState(false);
  const [testingFreemius, setTestingFreemius] = useState(false);
  const [showFreemiusSecret, setShowFreemiusSecret] = useState(false);

  // Brand Settings (App Settings)
  const [brandName, setBrandName] = useState("");
  const [brandSlogan, setBrandSlogan] = useState("");
  const [brandLogoUrl, setBrandLogoUrl] = useState("");
  const [brandWebsite, setBrandWebsite] = useState("");
  const [savingBrand, setSavingBrand] = useState(false);
  const [brandOpen, setBrandOpen] = useState(false);

  // Products (App Settings)
  const [products, setProducts] = useState<ProductType[]>([]);
  const [productRows, setProductRows] = useState<ProductType[]>([]);
  const [savingProducts, setSavingProducts] = useState(false);
  const [productsOpen, setProductsOpen] = useState(false);

  // Campaign Categories (App Settings)
  const [categories, setCategories] = useState<CampaignCategoryType[]>([]);
  const [categoryRows, setCategoryRows] = useState<CampaignCategoryType[]>([]);
  const [savingCategories, setSavingCategories] = useState(false);
  const [categoriesOpen, setCategoriesOpen] = useState(false);

  // Prompt configuration (AI Settings)
  const [predefinedInstruction, setPredefinedInstruction] = useState("");
  const [predefinedInstructionLoaded, setPredefinedInstructionLoaded] = useState("");
  const [savingPredefinedInstruction, setSavingPredefinedInstruction] = useState(false);

  // Users
  const [users, setUsers] = useState<User[]>([]);
  const [userDialogOpen, setUserDialogOpen] = useState(false);

  // Bulk user creation
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);
  const [bulkEmails, setBulkEmails] = useState("");
  const [bulkRole, setBulkRole] = useState("general_user");
  const [bulkRunning, setBulkRunning] = useState(false);
  const [bulkResults, setBulkResults] = useState<
    | {
        summary: { created: number; emailed: number; skipped: number; invalid: number };
        results: {
          email: string;
          status: string;
          emailSent: boolean;
          tempPassword?: string;
          emailError?: string;
        }[];
      }
    | null
  >(null);
  const [newUser, setNewUser] = useState({
    name: "",
    email: "",
    password: "",
    role: "general_user",
  });
  const [creatingUser, setCreatingUser] = useState(false);

  // --- Data Loading ---

  const loadSesConfigs = useCallback(async () => {
    try {
      const res = await fetch("/api/ses");
      if (res.ok) {
        const data = await res.json();
        setSesConfigs(data.configs || []);
      }
    } catch { /* ignore */ }
  }, []);

  const loadSwipeoneConfigs = useCallback(async () => {
    try {
      const res = await fetch("/api/swipeone");
      if (res.ok) {
        const data = await res.json();
        setSwipeoneConfigs(data.configs || []);
      }
    } catch { /* ignore */ }
  }, []);

  const loadPopularVariables = useCallback(async () => {
    try {
      const res = await fetch("/api/swipeone/popular-variables");
      if (res.ok) {
        const data = await res.json();
        setPopularVariables(data.variables || []);
      }
    } catch { /* ignore */ }
  }, []);

  const loadSwipeOneFieldList = useCallback(async () => {
    try {
      const res = await fetch("/api/swipeone/fields");
      if (res.ok) {
        const data = await res.json();
        setSwipeOneFieldList(data.fields || []);
      }
    } catch { /* ignore — picker will fall back to free input */ }
  }, []);

  const loadAiConfigs = useCallback(async () => {
    try {
      const res = await fetch("/api/ai-config");
      if (res.ok) {
        const data = await res.json();
        setAiConfigs(data.configs || []);
      }
    } catch { /* ignore */ }
  }, []);

  const loadR2Configs = useCallback(async () => {
    try {
      const res = await fetch("/api/r2-config");
      if (res.ok) {
        const data = await res.json();
        setR2Configs(data.configs || []);
      }
    } catch { /* ignore */ }
  }, []);

  const loadFreemiusConfigs = useCallback(async () => {
    try {
      const res = await fetch("/api/freemius-config");
      if (res.ok) {
        const data = await res.json();
        setFreemiusConfigs(data.configs || []);
      }
    } catch { /* ignore */ }
  }, []);

  const loadBrand = useCallback(async () => {
    try {
      const res = await fetch("/api/app-settings");
      if (res.ok) {
        const data = await res.json();
        const s = (data.settings || {}) as Record<string, string>;
        setBrandName(s["brand.name"] || "");
        setBrandSlogan(s["brand.slogan"] || "");
        setBrandLogoUrl(s["brand.logoUrl"] || "");
        setBrandWebsite(s["brand.website"] || "");
      }
    } catch { /* ignore */ }
  }, []);

  const handleSaveBrand = async () => {
    setSavingBrand(true);
    try {
      const entries: Array<[string, string]> = [
        ["brand.name", brandName.trim()],
        ["brand.slogan", brandSlogan.trim()],
        ["brand.logoUrl", brandLogoUrl.trim()],
        ["brand.website", brandWebsite.trim()],
      ];
      for (const [key, value] of entries) {
        const res = await fetch("/api/app-settings", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ key, value }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || `Failed to save ${key}`);
        }
      }
      toast.success("Brand settings saved");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save brand settings");
    } finally {
      setSavingBrand(false);
    }
  };

  const loadPredefinedInstruction = useCallback(async () => {
    try {
      const res = await fetch("/api/app-settings?key=predefinedInstruction");
      if (res.ok) {
        const data = await res.json();
        const v = typeof data?.value === "string" ? data.value : "";
        setPredefinedInstruction(v);
        setPredefinedInstructionLoaded(v);
      }
    } catch { /* ignore */ }
  }, []);

  const loadCategories = useCallback(async () => {
    try {
      const res = await fetch("/api/campaign-categories");
      if (res.ok) {
        const data = await res.json();
        type ApiCategory = {
          id?: string;
          name?: string;
          slug?: string;
          description?: string | null;
          swipeOneTagOverride?: string | null;
          autoCheckOnUnsubscribe?: boolean;
        };
        const list: CampaignCategoryType[] = (data.categories || []).map((c: ApiCategory) => ({
          id: c.id,
          name: c.name || "",
          slug: c.slug || "",
          description: c.description || "",
          swipeOneTagOverride: c.swipeOneTagOverride || "",
          autoCheckOnUnsubscribe: !!c.autoCheckOnUnsubscribe,
        }));
        setCategories(list);
        setCategoryRows(list);
      }
    } catch { /* ignore */ }
  }, []);

  const loadProducts = useCallback(async () => {
    try {
      const res = await fetch("/api/products");
      if (res.ok) {
        const data = await res.json();
        const list: ProductType[] = (data.products || []).map((p: Partial<ProductType>) => ({
          id: p.id,
          name: p.name || "",
          logoUrl: p.logoUrl || "",
          wpOrgSlug: p.wpOrgSlug || "",
          landingPageUrl: p.landingPageUrl || "",
          pricingPageUrl: p.pricingPageUrl || "",
        }));
        setProducts(list);
        setProductRows(list);
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    async function checkAccess() {
      try {
        const res = await fetch("/api/auth/me");
        if (!res.ok) { router.push("/login"); return; }
        const data = await res.json();
        if (data.user?.role !== "super_admin") {
          toast.error("Access denied");
          router.push("/dashboard");
          return;
        }
      } catch { router.push("/login"); return; }
      setLoading(false);
    }
    checkAccess();
  }, [router]);

  useEffect(() => {
    if (loading) return;
    loadSesConfigs();
    loadSwipeoneConfigs();
    loadPopularVariables();
    loadSwipeOneFieldList();
    loadAiConfigs();
    loadR2Configs();
    loadFreemiusConfigs();
    loadProducts();
    loadCategories();
    loadBrand();
    loadPredefinedInstruction();
    fetch("/api/users")
      .then((r) => r.json())
      .then((d) => setUsers(d.users || []))
      .catch(() => {});
  }, [
    loading,
    loadSesConfigs,
    loadSwipeoneConfigs,
    loadPopularVariables,
    loadSwipeOneFieldList,
    loadAiConfigs,
    loadR2Configs,
    loadFreemiusConfigs,
    loadProducts,
    loadCategories,
    loadBrand,
    loadPredefinedInstruction,
  ]);

  // --- SES Handlers ---

  const loadSesDialogIdentities = useCallback(async (configId: string) => {
    setSesDialogIdentitiesLoading(true);
    setSesDialogIdentitiesError(null);
    try {
      const res = await fetch(`/api/ses/${configId}/identities`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSesDialogIdentities([]);
        setSesDialogIdentitiesError(data.error || `HTTP ${res.status}`);
        return;
      }
      const emailOnly = ((data.identities || []) as SesIdentity[]).filter(
        (i) => i.verified && i.type === "EMAIL_ADDRESS"
      );
      setSesDialogIdentities(emailOnly);
    } catch (err) {
      setSesDialogIdentities([]);
      setSesDialogIdentitiesError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setSesDialogIdentitiesLoading(false);
    }
  }, []);

  const openSesCreate = () => {
    setSesForm(emptySes);
    setSesEditing(false);
    setShowSesAccessKey(false);
    setShowSesSecretKey(false);
    setSesDialogIdentities([]);
    setSesDialogIdentitiesError(null);
    setSesDialogOpen(true);
  };

  const openSesEdit = (config: SesConfig) => {
    setSesForm(config);
    setSesEditing(true);
    setShowSesAccessKey(false);
    setShowSesSecretKey(false);
    setSesDialogIdentities([]);
    setSesDialogIdentitiesError(null);
    setSesDialogOpen(true);
    if (config.id) loadSesDialogIdentities(config.id);
  };

  const handleSaveSes = async () => {
    if (!sesForm.region || !sesForm.accessKeyId || !sesForm.secretAccessKey) {
      toast.error("Region, Access Key, and Secret Key are required");
      return;
    }

    setSavingSes(true);
    try {
      const isEdit = sesEditing && sesForm.id;
      const url = isEdit ? `/api/ses/${sesForm.id}` : "/api/ses";
      const method = isEdit ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sesForm),
      });

      if (res.ok) {
        toast.success(isEdit ? "SES configuration updated" : "SES configuration created");
        setSesDialogOpen(false);
        loadSesConfigs();
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || "Failed to save SES configuration");
      }
    } catch {
      toast.error("Failed to save SES configuration");
    } finally {
      setSavingSes(false);
    }
  };

  const handleDeleteSes = async (id: string) => {
    try {
      const res = await fetch(`/api/ses/${id}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("SES configuration deleted");
        loadSesConfigs();
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || "Failed to delete");
      }
    } catch {
      toast.error("Failed to delete configuration");
    }
  };

  const handleSetActiveSes = async (id: string) => {
    try {
      const res = await fetch(`/api/ses/${id}`, { method: "PATCH" });
      if (res.ok) {
        toast.success("Active SES configuration updated");
        loadSesConfigs();
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || "Failed to set active");
      }
    } catch {
      toast.error("Failed to set active configuration");
    }
  };

  const handleTestSes = async () => {
    setTestingSes(true);
    try {
      const res = await fetch("/api/ses", { method: "PUT" });
      if (res.ok) {
        toast.success("SES connection successful!");
      } else {
        const data = await res.json();
        toast.error(data.error || "SES connection failed");
      }
    } catch {
      toast.error("SES connection test failed");
    } finally {
      setTestingSes(false);
    }
  };

  // --- SwipeOne Handlers ---

  const openSwipeoneCreate = () => {
    setSwipeoneForm(emptySwipeone);
    setSwipeoneEditing(false);
    setShowSwipeoneApiKey(false);
    setSwipeoneDialogOpen(true);
  };

  const openSwipeoneEdit = (config: SwipeOneConfig) => {
    setSwipeoneForm(config);
    setSwipeoneEditing(true);
    setShowSwipeoneApiKey(false);
    setSwipeoneDialogOpen(true);
  };

  const handleSaveSwipeone = async () => {
    if (!swipeoneForm.apiKey) {
      toast.error("API key is required");
      return;
    }

    setSavingSwipeone(true);
    try {
      const isEdit = swipeoneEditing && swipeoneForm.id;
      const url = isEdit ? `/api/swipeone/${swipeoneForm.id}` : "/api/swipeone";
      const method = isEdit ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(swipeoneForm),
      });

      if (res.ok) {
        toast.success(isEdit ? "SwipeOne configuration updated" : "SwipeOne configuration created");
        setSwipeoneDialogOpen(false);
        loadSwipeoneConfigs();
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || "Failed to save SwipeOne configuration");
      }
    } catch {
      toast.error("Failed to save SwipeOne configuration");
    } finally {
      setSavingSwipeone(false);
    }
  };

  const handleDeleteSwipeone = async (id: string) => {
    try {
      const res = await fetch(`/api/swipeone/${id}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("SwipeOne configuration deleted");
        loadSwipeoneConfigs();
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || "Failed to delete");
      }
    } catch {
      toast.error("Failed to delete configuration");
    }
  };

  const handleSetActiveSwipeone = async (id: string) => {
    try {
      const res = await fetch(`/api/swipeone/${id}`, { method: "PATCH" });
      if (res.ok) {
        toast.success("Active SwipeOne configuration updated");
        loadSwipeoneConfigs();
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || "Failed to set active");
      }
    } catch {
      toast.error("Failed to set active configuration");
    }
  };

  const handleTestSwipeone = async () => {
    setTestingSwipeone(true);
    try {
      const res = await fetch("/api/swipeone", { method: "PUT" });
      if (res.ok) {
        toast.success("SwipeOne connection successful!");
      } else {
        const data = await res.json();
        toast.error(data.error || "SwipeOne connection failed");
      }
    } catch {
      toast.error("SwipeOne connection test failed");
    } finally {
      setTestingSwipeone(false);
    }
  };

  // --- Popular Variables Handlers ---

  const handleAddPopular = async () => {
    const name = newPopularName.trim().replace(/^\{\{\s*/, "").replace(/\s*\}\}$/, "");
    if (!name) {
      toast.error("Variable name is required");
      return;
    }
    if (!/^[\w.]+$/.test(name)) {
      toast.error("Variable name can only contain letters, numbers, _ or .");
      return;
    }
    setSavingPopular(true);
    try {
      const res = await fetch("/api/swipeone/popular-variables", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, label: newPopularLabel.trim() || undefined }),
      });
      if (res.ok) {
        setNewPopularName("");
        setNewPopularLabel("");
        loadPopularVariables();
        toast.success(`Added {{${name}}} to popular variables`);
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || "Failed to add popular variable");
      }
    } catch {
      toast.error("Failed to add popular variable");
    } finally {
      setSavingPopular(false);
    }
  };

  const handleQuickAddPopular = async (field: { name: string; label?: string }) => {
    if (popularVariables.some((v) => v.name === field.name)) {
      toast.error(`{{${field.name}}} is already popular`);
      return;
    }
    setSavingPopular(true);
    try {
      const res = await fetch("/api/swipeone/popular-variables", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: field.name, label: field.label || undefined }),
      });
      if (res.ok) {
        loadPopularVariables();
        toast.success(`Added {{${field.name}}}`);
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || "Failed to add");
      }
    } catch {
      toast.error("Failed to add");
    } finally {
      setSavingPopular(false);
    }
  };

  const handleRemovePopular = async (id: string, name: string) => {
    try {
      const res = await fetch(`/api/swipeone/popular-variables/${id}`, { method: "DELETE" });
      if (res.ok) {
        setPopularVariables((prev) => prev.filter((v) => v.id !== id));
        toast.success(`Removed {{${name}}}`);
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || "Failed to remove");
      }
    } catch {
      toast.error("Failed to remove");
    }
  };

  // --- AI Config Handlers ---

  const openAiCreate = () => {
    setAiForm(emptyAi);
    setAiEditing(false);
    setShowAiApiKey(false);
    setAiDialogOpen(true);
  };

  const openAiEdit = (config: AiConfigType) => {
    setAiForm(config);
    setAiEditing(true);
    setShowAiApiKey(false);
    setAiDialogOpen(true);
  };

  const handleSaveAi = async () => {
    // The local CLI authenticates itself, so it is the one provider with no key.
    if (!aiForm.apiKey && aiForm.provider !== "claude-cli") {
      toast.error("API key is required");
      return;
    }

    setSavingAi(true);
    try {
      const isEdit = aiEditing && aiForm.id;
      const url = isEdit ? `/api/ai-config/${aiForm.id}` : "/api/ai-config";
      const method = isEdit ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(aiForm),
      });

      if (res.ok) {
        toast.success(isEdit ? "AI configuration updated" : "AI configuration created");
        setAiDialogOpen(false);
        loadAiConfigs();
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || "Failed to save AI configuration");
      }
    } catch {
      toast.error("Failed to save AI configuration");
    } finally {
      setSavingAi(false);
    }
  };

  const handleDeleteAi = async (id: string) => {
    try {
      const res = await fetch(`/api/ai-config/${id}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("AI configuration deleted");
        loadAiConfigs();
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || "Failed to delete");
      }
    } catch {
      toast.error("Failed to delete configuration");
    }
  };

  const handleSetActiveAi = async (id: string) => {
    try {
      const res = await fetch(`/api/ai-config/${id}`, { method: "PATCH" });
      if (res.ok) {
        toast.success("Active AI configuration updated");
        loadAiConfigs();
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || "Failed to set active");
      }
    } catch {
      toast.error("Failed to set active configuration");
    }
  };

  const handleTestAi = async () => {
    setTestingAi(true);
    try {
      const res = await fetch("/api/ai-config", { method: "PUT" });
      if (res.ok) {
        toast.success("AI connection successful!");
      } else {
        const data = await res.json();
        toast.error(data.error || "AI connection failed");
      }
    } catch {
      toast.error("AI connection test failed");
    } finally {
      setTestingAi(false);
    }
  };

  // --- R2 Config Handlers ---

  const openR2Create = () => {
    setR2Form(emptyR2);
    setR2Editing(false);
    setShowR2AccessKey(false);
    setShowR2SecretKey(false);
    setR2DialogOpen(true);
  };

  const openR2Edit = (config: R2ConfigType) => {
    setR2Form(config);
    setR2Editing(true);
    setShowR2AccessKey(false);
    setShowR2SecretKey(false);
    setR2DialogOpen(true);
  };

  const handleSaveR2 = async () => {
    if (!r2Form.accountId || !r2Form.accessKeyId || !r2Form.secretAccessKey || !r2Form.bucketName || !r2Form.publicUrl) {
      toast.error("All fields are required");
      return;
    }

    setSavingR2(true);
    try {
      const isEdit = r2Editing && r2Form.id;
      const url = isEdit ? `/api/r2-config/${r2Form.id}` : "/api/r2-config";
      const method = isEdit ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(r2Form),
      });

      if (res.ok) {
        toast.success(isEdit ? "R2 configuration updated" : "R2 configuration created");
        setR2DialogOpen(false);
        loadR2Configs();
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || "Failed to save R2 configuration");
      }
    } catch {
      toast.error("Failed to save R2 configuration");
    } finally {
      setSavingR2(false);
    }
  };

  const handleDeleteR2 = async (id: string) => {
    try {
      const res = await fetch(`/api/r2-config/${id}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("R2 configuration deleted");
        loadR2Configs();
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || "Failed to delete");
      }
    } catch {
      toast.error("Failed to delete configuration");
    }
  };

  const handleSetActiveR2 = async (id: string) => {
    try {
      const res = await fetch(`/api/r2-config/${id}`, { method: "PATCH" });
      if (res.ok) {
        toast.success("Active R2 configuration updated");
        loadR2Configs();
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || "Failed to set active");
      }
    } catch {
      toast.error("Failed to set active configuration");
    }
  };

  const handleTestR2 = async () => {
    setTestingR2(true);
    try {
      const res = await fetch("/api/r2-config", { method: "PUT" });
      if (res.ok) {
        toast.success("R2 connection successful!");
      } else {
        const data = await res.json();
        toast.error(data.error || "R2 connection failed");
      }
    } catch {
      toast.error("R2 connection test failed");
    } finally {
      setTestingR2(false);
    }
  };

  // --- Freemius Config Handlers ---

  const openFreemiusCreate = () => {
    setFreemiusForm(emptyFreemius);
    setFreemiusEditing(false);
    setShowFreemiusSecret(false);
    setFreemiusDialogOpen(true);
  };

  const openFreemiusEdit = (config: FreemiusConfigType) => {
    setFreemiusForm(config);
    setFreemiusEditing(true);
    setShowFreemiusSecret(false);
    setFreemiusDialogOpen(true);
  };

  const handleSaveFreemius = async () => {
    if (!freemiusForm.developerId || !freemiusForm.publicKey || !freemiusForm.secretKey) {
      toast.error("Developer ID, Public Key, and Secret Key are required");
      return;
    }

    setSavingFreemius(true);
    try {
      const isEdit = freemiusEditing && freemiusForm.id;
      const url = isEdit ? `/api/freemius-config/${freemiusForm.id}` : "/api/freemius-config";
      const method = isEdit ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(freemiusForm),
      });

      if (res.ok) {
        toast.success(isEdit ? "Freemius account updated" : "Freemius account created");
        setFreemiusDialogOpen(false);
        loadFreemiusConfigs();
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || "Failed to save Freemius account");
      }
    } catch {
      toast.error("Failed to save Freemius account");
    } finally {
      setSavingFreemius(false);
    }
  };

  const handleDeleteFreemius = async (id: string) => {
    try {
      const res = await fetch(`/api/freemius-config/${id}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("Freemius account deleted");
        loadFreemiusConfigs();
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || "Failed to delete");
      }
    } catch {
      toast.error("Failed to delete account");
    }
  };

  const handleSetActiveFreemius = async (id: string) => {
    try {
      const res = await fetch(`/api/freemius-config/${id}`, { method: "PATCH" });
      if (res.ok) {
        toast.success("Active Freemius account updated");
        loadFreemiusConfigs();
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || "Failed to set active");
      }
    } catch {
      toast.error("Failed to set active account");
    }
  };

  const handleTestFreemius = async () => {
    setTestingFreemius(true);
    try {
      const res = await fetch("/api/freemius-config", { method: "PUT" });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        toast.success(data.message || "Freemius connection successful!");
      } else {
        toast.error(data.error || "Freemius connection failed");
      }
    } catch {
      toast.error("Freemius connection test failed");
    } finally {
      setTestingFreemius(false);
    }
  };

  // --- Prompt Configuration Handlers ---

  const handleSavePredefinedInstruction = async () => {
    setSavingPredefinedInstruction(true);
    try {
      const res = await fetch("/api/app-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "predefinedInstruction", value: predefinedInstruction }),
      });
      if (res.ok) {
        setPredefinedInstructionLoaded(predefinedInstruction);
        toast.success("Predefined instruction saved");
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || "Failed to save");
      }
    } catch {
      toast.error("Failed to save predefined instruction");
    } finally {
      setSavingPredefinedInstruction(false);
    }
  };

  // --- Campaign Category Handlers ---

  const addCategoryRow = () => {
    setCategoryRows((prev) => [...prev, { ...emptyCategory }]);
  };

  const removeCategoryRow = (index: number) => {
    setCategoryRows((prev) => prev.filter((_, i) => i !== index));
  };

  const updateCategoryRow = <K extends keyof CampaignCategoryType>(
    index: number,
    field: K,
    value: CampaignCategoryType[K]
  ) => {
    setCategoryRows((prev) =>
      prev.map((row, i) => {
        if (i !== index) return row;
        const next = { ...row, [field]: value };
        // Auto-fill the slug while the row is still new (no id yet).
        // Once saved the slug is read-only, so this only runs for fresh rows.
        if (field === "name" && !row.id) {
          next.slug = slugifyName(String(value));
        }
        return next;
      })
    );
  };

  const handleSaveCategories = async () => {
    for (const row of categoryRows) {
      if (!row.name.trim()) {
        toast.error("Category name is required for all rows");
        return;
      }
    }
    const seen = new Set<string>();
    for (const row of categoryRows) {
      const k = row.name.trim().toLowerCase();
      if (seen.has(k)) {
        toast.error(`Duplicate category name: "${row.name.trim()}"`);
        return;
      }
      seen.add(k);
    }

    setSavingCategories(true);
    try {
      const originalById = new Map(
        categories.filter((c) => c.id).map((c) => [c.id!, c])
      );
      const currentIds = new Set(categoryRows.filter((c) => c.id).map((c) => c.id!));

      const toDelete = [...originalById.keys()].filter((id) => !currentIds.has(id));
      const toCreate = categoryRows.filter((c) => !c.id);
      const toUpdate = categoryRows.filter((c) => {
        if (!c.id) return false;
        const orig = originalById.get(c.id);
        if (!orig) return false;
        return (
          orig.name !== c.name ||
          orig.description !== c.description ||
          orig.swipeOneTagOverride !== c.swipeOneTagOverride ||
          orig.autoCheckOnUnsubscribe !== c.autoCheckOnUnsubscribe
        );
      });

      const ops: Promise<Response>[] = [];
      for (const id of toDelete) {
        ops.push(fetch(`/api/campaign-categories/${id}`, { method: "DELETE" }));
      }
      for (const c of toCreate) {
        ops.push(
          fetch("/api/campaign-categories", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(c),
          })
        );
      }
      for (const c of toUpdate) {
        ops.push(
          fetch(`/api/campaign-categories/${c.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(c),
          })
        );
      }

      const results = await Promise.all(ops);
      const failed = results.find((r) => !r.ok);
      if (failed) {
        const data = await failed.json().catch(() => ({}));
        toast.error(data.error || "Failed to save some categories");
      } else {
        toast.success("Campaign categories saved");
      }
      await loadCategories();
    } catch {
      toast.error("Failed to save campaign categories");
    } finally {
      setSavingCategories(false);
    }
  };

  // --- Product Handlers ---

  const addProductRow = () => {
    setProductRows((prev) => [...prev, { ...emptyProduct }]);
  };

  const removeProductRow = (index: number) => {
    setProductRows((prev) => prev.filter((_, i) => i !== index));
  };

  const updateProductRow = (index: number, field: keyof ProductType, value: string) => {
    setProductRows((prev) =>
      prev.map((row, i) => {
        if (i !== index) return row;
        const next = { ...row, [field]: value };
        if (field === "wpOrgSlug") {
          const slug = value.trim();
          const prevSlug = row.wpOrgSlug.trim();
          const prevLanding = prevSlug ? `https://bplugins.com/products/${prevSlug}` : "";
          const prevPricing = prevSlug ? `https://bplugins.com/products/${prevSlug}/pricing` : "";
          const prevLogo = prevSlug ? `https://ps.w.org/${prevSlug}/assets/icon-128x128.png` : "";
          const newLanding = slug ? `https://bplugins.com/products/${slug}` : "";
          const newPricing = slug ? `https://bplugins.com/products/${slug}/pricing` : "";
          const newLogo = slug ? `https://ps.w.org/${slug}/assets/icon-128x128.png` : "";

          if (!row.landingPageUrl.trim() || row.landingPageUrl === prevLanding) {
            next.landingPageUrl = newLanding;
          }
          if (!row.pricingPageUrl.trim() || row.pricingPageUrl === prevPricing) {
            next.pricingPageUrl = newPricing;
          }
          if (!row.logoUrl.trim() || row.logoUrl === prevLogo) {
            next.logoUrl = newLogo;
          }
        }
        return next;
      })
    );
  };

  const handleSaveProducts = async () => {
    for (const row of productRows) {
      if (!row.name.trim()) {
        toast.error("Product Name is required for all products");
        return;
      }
    }

    setSavingProducts(true);
    try {
      const originalById = new Map(products.filter((p) => p.id).map((p) => [p.id!, p]));
      const currentIds = new Set(productRows.filter((p) => p.id).map((p) => p.id!));

      const toDelete = [...originalById.keys()].filter((id) => !currentIds.has(id));
      const toCreate = productRows.filter((p) => !p.id);
      const toUpdate = productRows.filter((p) => {
        if (!p.id) return false;
        const orig = originalById.get(p.id);
        if (!orig) return false;
        return (
          orig.name !== p.name ||
          orig.logoUrl !== p.logoUrl ||
          orig.wpOrgSlug !== p.wpOrgSlug ||
          orig.landingPageUrl !== p.landingPageUrl ||
          orig.pricingPageUrl !== p.pricingPageUrl
        );
      });

      const ops: Promise<Response>[] = [];
      for (const id of toDelete) {
        ops.push(fetch(`/api/products/${id}`, { method: "DELETE" }));
      }
      for (const p of toCreate) {
        ops.push(
          fetch("/api/products", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(p),
          })
        );
      }
      for (const p of toUpdate) {
        ops.push(
          fetch(`/api/products/${p.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(p),
          })
        );
      }

      const results = await Promise.all(ops);
      const failed = results.find((r) => !r.ok);
      if (failed) {
        const data = await failed.json().catch(() => ({}));
        toast.error(data.error || "Failed to save some products");
      } else {
        toast.success("Product settings saved");
      }
      await loadProducts();
    } catch {
      toast.error("Failed to save product settings");
    } finally {
      setSavingProducts(false);
    }
  };

  // --- User Handlers ---

  const handleBulkCreate = async () => {
    if (!bulkEmails.trim()) {
      toast.error("Paste at least one email address");
      return;
    }
    setBulkRunning(true);
    setBulkResults(null);
    try {
      const res = await fetch("/api/users/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emails: bulkEmails, role: bulkRole }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Bulk create failed");
      setBulkResults(data);
      const { created, emailed, skipped, invalid } = data.summary;
      toast.success(
        `Created ${created} user${created === 1 ? "" : "s"} (${emailed} emailed` +
          (skipped ? `, ${skipped} already existed` : "") +
          (invalid ? `, ${invalid} invalid` : "") +
          ")"
      );
      // refresh users table
      fetch("/api/users")
        .then((r) => r.json())
        .then((d) => setUsers(d.users || []))
        .catch(() => {});
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Bulk create failed");
    } finally {
      setBulkRunning(false);
    }
  };

  const handleCreateUser = async () => {
    if (!newUser.name || !newUser.email || !newUser.password) {
      toast.error("All fields are required");
      return;
    }
    if (newUser.password.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }

    setCreatingUser(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newUser),
      });

      if (res.ok) {
        const data = await res.json();
        toast.success("User created");
        setUsers((prev) => [...prev, data.user]);
        setUserDialogOpen(false);
        setNewUser({ name: "", email: "", password: "", role: "general_user" });
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to create user");
      }
    } catch {
      toast.error("Failed to create user");
    } finally {
      setCreatingUser(false);
    }
  };

  const handleDeleteUser = async (id: string) => {
    try {
      const res = await fetch(`/api/users/${id}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("User deleted");
        setUsers((prev) => prev.filter((u) => u.id !== id));
      } else {
        toast.error("Failed to delete user");
      }
    } catch {
      toast.error("Failed to delete user");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground">Loading settings...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Settings</h2>
        <p className="text-muted-foreground">
          Manage your platform configuration
        </p>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={(v) => {
          if (!v) return;
          router.push(v === "app" ? "/settings" : `/settings/${v}`);
        }}
      >
        <TabsList>
          <TabsTrigger value="app">App Settings</TabsTrigger>
          <TabsTrigger value="ses">SES Connections</TabsTrigger>
          <TabsTrigger value="swipeone">SwipeOne Connections</TabsTrigger>
          <TabsTrigger value="ai">AI Configuration</TabsTrigger>
          <TabsTrigger value="r2">Cloudflare R2</TabsTrigger>
          <TabsTrigger value="freemius">Freemius</TabsTrigger>
          <TabsTrigger value="users">User Management</TabsTrigger>
        </TabsList>

        {/* ===== APP SETTINGS TAB ===== */}
        <TabsContent value="app" className="mt-6 space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-4">
                <button
                  type="button"
                  onClick={() => setBrandOpen((v) => !v)}
                  className="flex items-start gap-2 text-left flex-1 min-w-0 group"
                  aria-expanded={brandOpen}
                >
                  <ChevronDown
                    className={`h-5 w-5 mt-0.5 shrink-0 text-muted-foreground transition-transform ${
                      brandOpen ? "" : "-rotate-90"
                    }`}
                  />
                  <div className="min-w-0">
                    <CardTitle className="group-hover:underline">Brand Settings</CardTitle>
                    <CardDescription>
                      Configure your brand identity. The Brand Name and Logo are shown in the
                      sidebar header. Brand Name is also used as the default &quot;From Name&quot;
                      when creating a new campaign.
                    </CardDescription>
                  </div>
                </button>
                <div className="flex gap-2 shrink-0">
                  <Button onClick={handleSaveBrand} disabled={savingBrand}>
                    {savingBrand ? "Saving..." : "Save Changes"}
                  </Button>
                </div>
              </div>
            </CardHeader>
            {brandOpen && (
            <CardContent>
              <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="brand-name">Brand Name</Label>
                  <Input
                    id="brand-name"
                    placeholder="e.g. bPlugins"
                    value={brandName}
                    onChange={(e) => setBrandName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="brand-slogan">Brand Slogan</Label>
                  <Input
                    id="brand-slogan"
                    placeholder="e.g. Email Marketing Platform"
                    value={brandSlogan}
                    onChange={(e) => setBrandSlogan(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="brand-logo">Logo URL</Label>
                  <Input
                    id="brand-logo"
                    placeholder="https://example.com/logo.png"
                    value={brandLogoUrl}
                    onChange={(e) => setBrandLogoUrl(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="brand-website">Website</Label>
                  <Input
                    id="brand-website"
                    placeholder="https://example.com"
                    value={brandWebsite}
                    onChange={(e) => setBrandWebsite(e.target.value)}
                  />
                </div>
              </div>
            </CardContent>
            )}
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-4">
                <button
                  type="button"
                  onClick={() => setCategoriesOpen((v) => !v)}
                  className="flex items-start gap-2 text-left flex-1 min-w-0 group"
                  aria-expanded={categoriesOpen}
                >
                  <ChevronDown
                    className={`h-5 w-5 mt-0.5 shrink-0 text-muted-foreground transition-transform ${
                      categoriesOpen ? "" : "-rotate-90"
                    }`}
                  />
                  <div className="min-w-0">
                    <CardTitle className="group-hover:underline">Campaign Category</CardTitle>
                    <CardDescription>
                      Define campaign categories so recipients can unsubscribe from a specific
                      category instead of every email. These categories appear on the
                      unsubscribe page.
                    </CardDescription>
                  </div>
                </button>
                <div className="flex gap-2 shrink-0">
                  <Button variant="outline" onClick={addCategoryRow}>
                    <Plus className="mr-2 h-4 w-4" />
                    Add Category
                  </Button>
                  <Button onClick={handleSaveCategories} disabled={savingCategories}>
                    {savingCategories ? "Saving..." : "Save Changes"}
                  </Button>
                </div>
              </div>
            </CardHeader>
            {categoriesOpen && (
            <CardContent>
              {categoryRows.length === 0 ? (
                <p className="text-muted-foreground text-sm text-center py-8">
                  No campaign categories yet. Click &quot;Add Category&quot; to get started.
                </p>
              ) : (
                <div className="space-y-4">
                  {categoryRows.map((row, index) => (
                    <div
                      key={row.id ?? `new-${index}`}
                      className="border rounded-md p-4 space-y-3 bg-muted/20"
                    >
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium">
                          Category #{index + 1}
                          {row.name ? ` — ${row.name}` : ""}
                        </p>
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Remove category"
                          onClick={() => removeCategoryRow(index)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                      <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
                        <div className="space-y-2">
                          <Label htmlFor={`category-name-${index}`}>
                            Category Name <span className="text-destructive">*</span>
                          </Label>
                          <Input
                            id={`category-name-${index}`}
                            placeholder="e.g. Product Updates"
                            value={row.name}
                            onChange={(e) => updateCategoryRow(index, "name", e.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor={`category-slug-${index}`}>
                            Unchangeable unique readable id
                          </Label>
                          <Input
                            id={`category-slug-${index}`}
                            placeholder="auto-filled from name"
                            value={row.slug}
                            readOnly
                            disabled
                            className="font-mono text-xs"
                          />
                          <p className="text-xs text-muted-foreground">
                            {row.id
                              ? "Locked — readable id cannot be changed after the category is created."
                              : "Auto-generated from the name. Saved with the category and cannot be changed later."}
                          </p>
                        </div>
                        <div className="space-y-2 md:col-span-2">
                          <Label htmlFor={`category-swipeone-tag-${index}`}>
                            Overwrite SwipeOne Tag
                          </Label>
                          <Input
                            id={`category-swipeone-tag-${index}`}
                            placeholder="leave blank to use the readable id"
                            value={row.swipeOneTagOverride}
                            onChange={(e) =>
                              updateCategoryRow(index, "swipeOneTagOverride", e.target.value)
                            }
                            className="font-mono text-xs"
                          />
                          <p className="text-xs text-muted-foreground">
                            When set, this exact text is used as the tag pushed to SwipeOne
                            instead of the readable id (
                            <span className="font-mono">{row.slug || "auto-filled-from-name"}</span>
                            ).
                          </p>
                        </div>
                        <div className="space-y-2 md:col-span-2">
                          <Label htmlFor={`category-description-${index}`}>
                            Description
                          </Label>
                          <Input
                            id={`category-description-${index}`}
                            placeholder="What kind of emails belong here?"
                            value={row.description}
                            onChange={(e) =>
                              updateCategoryRow(index, "description", e.target.value)
                            }
                          />
                        </div>
                      </div>
                      <label className="flex items-start gap-2 cursor-pointer text-sm">
                        <Checkbox
                          checked={row.autoCheckOnUnsubscribe}
                          onCheckedChange={(v) =>
                            updateCategoryRow(index, "autoCheckOnUnsubscribe", !!v)
                          }
                          className="mt-0.5"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium leading-tight">
                            Auto Check This Category In Unsubscribe Preference Page
                          </p>
                          <p className="text-xs text-muted-foreground">
                            When a recipient lands on the unsubscribe page, this category
                            will be checked by default.
                          </p>
                        </div>
                      </label>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
            )}
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-4">
                <button
                  type="button"
                  onClick={() => setProductsOpen((v) => !v)}
                  className="flex items-start gap-2 text-left flex-1 min-w-0 group"
                  aria-expanded={productsOpen}
                >
                  <ChevronDown
                    className={`h-5 w-5 mt-0.5 shrink-0 text-muted-foreground transition-transform ${
                      productsOpen ? "" : "-rotate-90"
                    }`}
                  />
                  <div className="min-w-0">
                    <CardTitle className="group-hover:underline">Product Settings</CardTitle>
                    <CardDescription>
                      Configure product data for future use. Add one row per product.
                    </CardDescription>
                  </div>
                </button>
                <div className="flex gap-2 shrink-0">
                  <Button variant="outline" onClick={addProductRow}>
                    <Plus className="mr-2 h-4 w-4" />
                    Add Product
                  </Button>
                  <Button onClick={handleSaveProducts} disabled={savingProducts}>
                    {savingProducts ? "Saving..." : "Save Changes"}
                  </Button>
                </div>
              </div>
            </CardHeader>
            {productsOpen && (
            <CardContent>
              {productRows.length === 0 ? (
                <p className="text-muted-foreground text-sm text-center py-8">
                  No products configured. Click &quot;Add Product&quot; to get started.
                </p>
              ) : (
                <div className="space-y-4">
                  {productRows.map((row, index) => (
                    <div
                      key={row.id ?? `new-${index}`}
                      className="border rounded-md p-4 space-y-3 bg-muted/20"
                    >
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium">
                          Product #{index + 1}
                          {row.name ? ` — ${row.name}` : ""}
                        </p>
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Remove product"
                          onClick={() => removeProductRow(index)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                      <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
                        <div className="space-y-2">
                          <Label htmlFor={`product-name-${index}`}>
                            Product Name <span className="text-destructive">*</span>
                          </Label>
                          <Input
                            id={`product-name-${index}`}
                            placeholder="e.g. WP Mail SMTP"
                            value={row.name}
                            onChange={(e) => updateProductRow(index, "name", e.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor={`product-slug-${index}`}>Wp.org Slug</Label>
                          <Input
                            id={`product-slug-${index}`}
                            placeholder="e.g. wp-mail-smtp"
                            value={row.wpOrgSlug}
                            onChange={(e) => updateProductRow(index, "wpOrgSlug", e.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor={`product-logo-${index}`}>Product Logo URL</Label>
                          <Input
                            id={`product-logo-${index}`}
                            placeholder="https://ps.w.org/{slug}/assets/icon-128x128.png"
                            value={row.logoUrl}
                            onChange={(e) => updateProductRow(index, "logoUrl", e.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor={`product-landing-${index}`}>Landing Page URL</Label>
                          <Input
                            id={`product-landing-${index}`}
                            placeholder="https://example.com"
                            value={row.landingPageUrl}
                            onChange={(e) =>
                              updateProductRow(index, "landingPageUrl", e.target.value)
                            }
                          />
                        </div>
                        <div className="space-y-2 md:col-span-2">
                          <Label htmlFor={`product-pricing-${index}`}>Pricing Page URL</Label>
                          <Input
                            id={`product-pricing-${index}`}
                            placeholder="https://example.com/pricing"
                            value={row.pricingPageUrl}
                            onChange={(e) =>
                              updateProductRow(index, "pricingPageUrl", e.target.value)
                            }
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
            )}
          </Card>
        </TabsContent>

        {/* ===== SES TAB ===== */}
        <TabsContent value="ses" className="mt-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Amazon SES Connections</CardTitle>
                  <CardDescription>
                    Manage your SES configurations. The active connection is used for sending emails.
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={handleTestSes}
                    disabled={testingSes || sesConfigs.every((c) => !c.isActive)}
                  >
                    {testingSes ? "Testing..." : "Test Active"}
                  </Button>
                  <Button onClick={openSesCreate}>
                    <Plus className="mr-2 h-4 w-4" />
                    Add Connection
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {sesConfigs.length === 0 ? (
                <p className="text-muted-foreground text-sm text-center py-8">
                  No SES connections configured. Add one to get started.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Region</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sesConfigs.map((config) => (
                      <TableRow key={config.id}>
                        <TableCell className="font-medium">{config.name}</TableCell>
                        <TableCell>{config.region}</TableCell>
                        <TableCell>
                          {config.isActive ? (
                            <Badge>Active</Badge>
                          ) : (
                            <Badge variant="secondary">Inactive</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            {!config.isActive && (
                              <Button
                                variant="ghost"
                                size="icon"
                                title="Set as active"
                                onClick={() => handleSetActiveSes(config.id!)}
                              >
                                <Power className="h-4 w-4" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              title="Edit"
                              onClick={() => openSesEdit(config)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            {!config.isActive && (
                              <Button
                                variant="ghost"
                                size="icon"
                                title="Delete"
                                onClick={() => handleDeleteSes(config.id!)}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* SES Dialog */}
          <Dialog open={sesDialogOpen} onOpenChange={setSesDialogOpen}>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>{sesEditing ? "Edit SES Connection" : "New SES Connection"}</DialogTitle>
                <DialogDescription>
                  Configure your Amazon SES credentials for sending emails
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 mt-2">
                <div className="space-y-2">
                  <Label htmlFor="ses-name">Connection Name</Label>
                  <Input
                    id="ses-name"
                    placeholder="e.g. Production, Staging"
                    value={sesForm.name}
                    onChange={(e) => setSesForm({ ...sesForm, name: e.target.value })}
                  />
                </div>
                <div className="grid gap-4 grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="ses-region">AWS Region</Label>
                    <Input
                      id="ses-region"
                      placeholder="us-east-1"
                      value={sesForm.region}
                      onChange={(e) => setSesForm({ ...sesForm, region: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="ses-config-set">Config Set Name</Label>
                    <Input
                      id="ses-config-set"
                      placeholder="Optional"
                      value={sesForm.configSetName}
                      onChange={(e) => setSesForm({ ...sesForm, configSetName: e.target.value })}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ses-access-key">Access Key ID</Label>
                  <div className="relative">
                    <Input
                      id="ses-access-key"
                      type={showSesAccessKey ? "text" : "password"}
                      placeholder="AKIA..."
                      value={sesForm.accessKeyId}
                      onChange={(e) => setSesForm({ ...sesForm, accessKeyId: e.target.value })}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                      onClick={() => setShowSesAccessKey(!showSesAccessKey)}
                    >
                      {showSesAccessKey ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
                    </Button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ses-secret-key">Secret Access Key</Label>
                  <div className="relative">
                    <Input
                      id="ses-secret-key"
                      type={showSesSecretKey ? "text" : "password"}
                      placeholder="Secret key"
                      value={sesForm.secretAccessKey}
                      onChange={(e) => setSesForm({ ...sesForm, secretAccessKey: e.target.value })}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                      onClick={() => setShowSesSecretKey(!showSesSecretKey)}
                    >
                      {showSesSecretKey ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
                    </Button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ses-default-from">
                    Default Mail From{" "}
                    <span className="text-xs text-muted-foreground font-normal">(optional)</span>
                  </Label>
                  {!sesEditing ? (
                    <p className="text-xs text-muted-foreground">
                      Save the connection first, then edit it to pick a default from the verified
                      identities of this SES account.
                    </p>
                  ) : sesDialogIdentitiesLoading ? (
                    <div className="flex items-center text-xs text-muted-foreground h-9">
                      <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
                      Loading identities...
                    </div>
                  ) : sesDialogIdentitiesError ? (
                    <div className="space-y-1">
                      <p className="text-xs text-destructive">
                        Failed to load identities: {sesDialogIdentitiesError}
                      </p>
                      <Input
                        id="ses-default-from"
                        placeholder="do-not-reply@example.com"
                        value={sesForm.defaultFromEmail}
                        onChange={(e) =>
                          setSesForm({ ...sesForm, defaultFromEmail: e.target.value })
                        }
                      />
                    </div>
                  ) : sesDialogIdentities.length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      No verified email identities on this SES account.
                    </p>
                  ) : (
                    <Select
                      value={sesForm.defaultFromEmail || "__none__"}
                      onValueChange={(v) =>
                        setSesForm({
                          ...sesForm,
                          defaultFromEmail: !v || v === "__none__" ? "" : v,
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="None — no default" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">None — no default</SelectItem>
                        {sesDialogIdentities.map((i) => (
                          <SelectItem key={i.identity} value={i.identity}>
                            {i.identity}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  <p className="text-xs text-muted-foreground">
                    When this connection is active, the &quot;From Email&quot; field on the New
                    Campaign page will preselect this address (if it&apos;s still a verified
                    identity).
                  </p>
                </div>
                <Button onClick={handleSaveSes} disabled={savingSes} className="w-full">
                  {savingSes ? "Saving..." : sesEditing ? "Update Connection" : "Create Connection"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </TabsContent>

        {/* ===== SWIPEONE TAB ===== */}
        <TabsContent value="swipeone" className="mt-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>SwipeOne Connections</CardTitle>
                  <CardDescription>
                    Manage your SwipeOne integrations. The active connection is used for contact segments.
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={handleTestSwipeone}
                    disabled={testingSwipeone || swipeoneConfigs.every((c) => !c.isActive)}
                  >
                    {testingSwipeone ? "Testing..." : "Test Active"}
                  </Button>
                  <Button onClick={openSwipeoneCreate}>
                    <Plus className="mr-2 h-4 w-4" />
                    Add Connection
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {swipeoneConfigs.length === 0 ? (
                <p className="text-muted-foreground text-sm text-center py-8">
                  No SwipeOne connections configured. Add one to get started.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Base URL</TableHead>
                      <TableHead>Workspace ID</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {swipeoneConfigs.map((config) => (
                      <TableRow key={config.id}>
                        <TableCell className="font-medium">{config.name}</TableCell>
                        <TableCell className="text-muted-foreground text-sm">{config.baseUrl}</TableCell>
                        <TableCell className="text-muted-foreground text-sm font-mono">
                          {config.workspaceId ? config.workspaceId.slice(0, 12) + "..." : "—"}
                        </TableCell>
                        <TableCell>
                          {config.isActive ? (
                            <Badge>Active</Badge>
                          ) : (
                            <Badge variant="secondary">Inactive</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            {!config.isActive && (
                              <Button
                                variant="ghost"
                                size="icon"
                                title="Set as active"
                                onClick={() => handleSetActiveSwipeone(config.id!)}
                              >
                                <Power className="h-4 w-4" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              title="Edit"
                              onClick={() => openSwipeoneEdit(config)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            {!config.isActive && (
                              <Button
                                variant="ghost"
                                size="icon"
                                title="Delete"
                                onClick={() => handleDeleteSwipeone(config.id!)}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Popular Variables Settings */}
          <Card className="mt-6">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Star className="h-4 w-4 text-amber-500 fill-amber-500" />
                    Popular Variables Settings
                  </CardTitle>
                  <CardDescription>
                    Pin the SwipeOne variables you use most. They&apos;ll appear first in the
                    Map Variables modal and be highlighted in the code editor for quicker
                    insertion.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Add via free input */}
              <div className="space-y-2">
                <Label className="text-xs">Add a variable</Label>
                <div className="flex flex-wrap items-center gap-2">
                  <Input
                    placeholder="Variable name (e.g. firstName)"
                    value={newPopularName}
                    onChange={(e) => setNewPopularName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAddPopular();
                      }
                    }}
                    className="h-9 max-w-[260px]"
                  />
                  <Input
                    placeholder="Optional label"
                    value={newPopularLabel}
                    onChange={(e) => setNewPopularLabel(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAddPopular();
                      }
                    }}
                    className="h-9 max-w-[260px]"
                  />
                  <Button onClick={handleAddPopular} disabled={savingPopular || !newPopularName.trim()}>
                    <Plus className="mr-1.5 h-4 w-4" />
                    Add
                  </Button>
                </div>
              </div>

              {/* Quick-add from SwipeOne */}
              {swipeOneFieldList.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">
                    Or quick-add from SwipeOne fields
                  </Label>
                  <div className="flex flex-wrap gap-1 max-h-[120px] overflow-auto p-2 border bg-muted/20">
                    {swipeOneFieldList
                      .filter((f) => !popularVariables.some((v) => v.name === f.name))
                      .map((f) => (
                        <button
                          key={f.name}
                          type="button"
                          onClick={() => handleQuickAddPopular(f)}
                          disabled={savingPopular}
                          title={f.label !== f.name ? f.label : undefined}
                          className="inline-flex items-center font-mono text-[10px] h-6 px-2 rounded border border-border bg-background text-muted-foreground hover:bg-accent hover:text-foreground transition-colors cursor-pointer disabled:opacity-50"
                        >
                          + {`{{${f.name}}}`}
                        </button>
                      ))}
                  </div>
                </div>
              )}

              {/* Pinned list */}
              <div className="space-y-2">
                <Label className="text-xs">
                  Pinned ({popularVariables.length})
                </Label>
                {popularVariables.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-3">
                    No popular variables yet — add some above.
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {popularVariables.map((v) => (
                      <span
                        key={v.id}
                        className="inline-flex items-center gap-1 font-mono text-xs h-7 pl-2 pr-1 rounded border border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-700 dark:bg-amber-950/50 dark:text-amber-200"
                        title={v.label || undefined}
                      >
                        <Star className="h-3 w-3 fill-amber-500 text-amber-500" />
                        {`{{${v.name}}}`}
                        <button
                          type="button"
                          onClick={() => handleRemovePopular(v.id, v.name)}
                          className="ml-1 h-5 w-5 inline-flex items-center justify-center rounded hover:bg-amber-200 dark:hover:bg-amber-900 transition-colors"
                          title="Remove"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* SwipeOne Dialog */}
          <Dialog open={swipeoneDialogOpen} onOpenChange={setSwipeoneDialogOpen}>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>{swipeoneEditing ? "Edit SwipeOne Connection" : "New SwipeOne Connection"}</DialogTitle>
                <DialogDescription>
                  Configure your SwipeOne API credentials
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 mt-2">
                <div className="space-y-2">
                  <Label htmlFor="so-name">Connection Name</Label>
                  <Input
                    id="so-name"
                    placeholder="e.g. Production, Staging"
                    value={swipeoneForm.name}
                    onChange={(e) => setSwipeoneForm({ ...swipeoneForm, name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="so-api-key">API Key</Label>
                  <div className="relative">
                    <Input
                      id="so-api-key"
                      type={showSwipeoneApiKey ? "text" : "password"}
                      placeholder="Your SwipeOne API key"
                      value={swipeoneForm.apiKey}
                      onChange={(e) => setSwipeoneForm({ ...swipeoneForm, apiKey: e.target.value })}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                      onClick={() => setShowSwipeoneApiKey(!showSwipeoneApiKey)}
                    >
                      {showSwipeoneApiKey ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
                    </Button>
                  </div>
                </div>
                <div className="grid gap-4 grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="so-base-url">Base URL</Label>
                    <Input
                      id="so-base-url"
                      placeholder="https://api.swipeone.com"
                      value={swipeoneForm.baseUrl}
                      onChange={(e) => setSwipeoneForm({ ...swipeoneForm, baseUrl: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="so-workspace-id">Workspace ID</Label>
                    <Input
                      id="so-workspace-id"
                      placeholder="e.g. 6660175570fbd8a9c22bedfb"
                      value={swipeoneForm.workspaceId}
                      onChange={(e) => setSwipeoneForm({ ...swipeoneForm, workspaceId: e.target.value })}
                    />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Find your Workspace ID in your SwipeOne app URL: app.swipeone.com/workspaces/<strong>your-workspace-id</strong>
                </p>
                <Button onClick={handleSaveSwipeone} disabled={savingSwipeone} className="w-full">
                  {savingSwipeone ? "Saving..." : swipeoneEditing ? "Update Connection" : "Create Connection"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </TabsContent>

        {/* ===== AI TAB ===== */}
        <TabsContent value="ai" className="mt-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>AI Configuration</CardTitle>
                  <CardDescription>
                    Configure your AI provider for email template generation. Supports OpenRouter (100+ models), OpenAI, and Anthropic (Claude).
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={handleTestAi}
                    disabled={testingAi || aiConfigs.every((c) => !c.isActive)}
                  >
                    {testingAi ? "Testing..." : "Test Active"}
                  </Button>
                  <Button onClick={openAiCreate}>
                    <Plus className="mr-2 h-4 w-4" />
                    Add Connection
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {aiConfigs.length === 0 ? (
                <p className="text-muted-foreground text-sm text-center py-8">
                  No AI connections configured. Add one to enable AI-powered email generation.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Provider</TableHead>
                      <TableHead>Model</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {aiConfigs.map((config) => (
                      <TableRow key={config.id}>
                        <TableCell className="font-medium">{config.name}</TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="capitalize">{config.provider}</Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm font-mono">{config.model}</TableCell>
                        <TableCell>
                          {config.isActive ? (
                            <Badge>Active</Badge>
                          ) : (
                            <Badge variant="secondary">Inactive</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            {!config.isActive && (
                              <Button
                                variant="ghost"
                                size="icon"
                                title="Set as active"
                                onClick={() => handleSetActiveAi(config.id!)}
                              >
                                <Power className="h-4 w-4" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              title="Edit"
                              onClick={() => openAiEdit(config)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            {!config.isActive && (
                              <Button
                                variant="ghost"
                                size="icon"
                                title="Delete"
                                onClick={() => handleDeleteAi(config.id!)}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* AI Config Dialog */}
          <Dialog open={aiDialogOpen} onOpenChange={setAiDialogOpen}>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>{aiEditing ? "Edit AI Connection" : "New AI Connection"}</DialogTitle>
                <DialogDescription>
                  Configure your AI provider credentials for email generation
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 mt-2">
                <div className="grid gap-4 grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="ai-name">Connection Name</Label>
                    <Input
                      id="ai-name"
                      placeholder="e.g. OpenRouter Production"
                      value={aiForm.name}
                      onChange={(e) => setAiForm({ ...aiForm, name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="ai-provider">Provider</Label>
                    <Select
                      value={aiForm.provider}
                      onValueChange={(v) => {
                        const provider = v || "openrouter";
                        const baseUrl =
                          provider === "anthropic"
                            ? "https://api.anthropic.com/v1"
                            : provider === "openai"
                              ? "https://api.openai.com/v1"
                              : "https://openrouter.ai/api/v1";
                        const model =
                          provider === "anthropic"
                            ? "claude-sonnet-4-6"
                            : provider === "openai"
                              ? "gpt-4o-mini"
                              : "google/gemini-2.0-flash-001";
                        setAiForm({ ...aiForm, provider, baseUrl, model });
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="openrouter">OpenRouter</SelectItem>
                        <SelectItem value="openai">OpenAI</SelectItem>
                        <SelectItem value="anthropic">Anthropic (Claude)</SelectItem>
                        <SelectItem value="claude-cli">Local Claude CLI (no API key)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                {aiForm.provider === "claude-cli" ? (
                  <div className="space-y-2">
                    <Label htmlFor="ai-cli-path">Claude CLI path (optional)</Label>
                    <Input
                      id="ai-cli-path"
                      placeholder="Leave empty to auto-detect (~/.local/bin/claude)"
                      value={aiForm.baseUrl}
                      onChange={(e) => setAiForm({ ...aiForm, baseUrl: e.target.value })}
                    />
                    <div className="rounded-md border border-amber-500/40 bg-amber-500/5 p-3 text-xs text-amber-700 dark:text-amber-400">
                      <p className="font-medium">Runs on the machine hosting this app</p>
                      <p className="mt-1 text-muted-foreground">
                        It uses your Claude Code subscription instead of API credits, so no API key
                        is needed. It only works where the Claude CLI is installed — the production
                        server doesn&apos;t have it, so generation there will fail with a clear error.
                        Keep an API-based connection for production.
                      </p>
                    </div>
                  </div>
                ) : (
                <div className="space-y-2">
                  <Label htmlFor="ai-api-key">API Key</Label>
                  <div className="relative">
                    <Input
                      id="ai-api-key"
                      type={showAiApiKey ? "text" : "password"}
                      placeholder={
                        aiForm.provider === "anthropic"
                          ? "sk-ant-..."
                          : aiForm.provider === "openai"
                            ? "sk-..."
                            : "sk-or-v1-..."
                      }
                      value={aiForm.apiKey}
                      onChange={(e) => setAiForm({ ...aiForm, apiKey: e.target.value })}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                      onClick={() => setShowAiApiKey(!showAiApiKey)}
                    >
                      {showAiApiKey ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
                    </Button>
                  </div>
                  {aiForm.provider === "openrouter" && (
                    <p className="text-xs text-muted-foreground">
                      Get your API key from{" "}
                      <a href="https://openrouter.ai/keys" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                        openrouter.ai/keys
                      </a>
                    </p>
                  )}
                  {aiForm.provider === "anthropic" && (
                    <p className="text-xs text-muted-foreground">
                      Get your API key from{" "}
                      <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                        console.anthropic.com
                      </a>
                    </p>
                  )}
                </div>
                )}
                <div className="grid gap-4 grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="ai-model">Model</Label>
                    {aiForm.provider === "claude-cli" ? (
                      <Select
                        value={aiForm.model || "__default__"}
                        onValueChange={(v) => setAiForm({ ...aiForm, model: v === "__default__" ? "" : v || "" })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__default__">Use the CLI&apos;s default model</SelectItem>
                          <SelectItem value="claude-opus-4-7">Claude Opus 4.7 — most capable</SelectItem>
                          <SelectItem value="claude-sonnet-4-6">Claude Sonnet 4.6 — recommended</SelectItem>
                          <SelectItem value="claude-haiku-4-5-20251001">Claude Haiku 4.5 — fastest</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : aiForm.provider === "anthropic" ? (
                      <Select
                        value={aiForm.model}
                        onValueChange={(v) => setAiForm({ ...aiForm, model: v || "claude-sonnet-4-6" })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select a Claude model" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="claude-opus-4-7">Claude Opus 4.7 — most capable</SelectItem>
                          <SelectItem value="claude-sonnet-4-6">Claude Sonnet 4.6 — recommended</SelectItem>
                          <SelectItem value="claude-haiku-4-5-20251001">Claude Haiku 4.5 — fastest</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <Input
                        id="ai-model"
                        placeholder={aiForm.provider === "openai" ? "gpt-4o-mini" : "google/gemini-2.0-flash-001"}
                        value={aiForm.model}
                        onChange={(e) => setAiForm({ ...aiForm, model: e.target.value })}
                      />
                    )}
                    {aiForm.provider === "openrouter" && (
                      <p className="text-xs text-muted-foreground">
                        Browse models at{" "}
                        <a href="https://openrouter.ai/models" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                          openrouter.ai/models
                        </a>
                      </p>
                    )}
                    {aiForm.provider === "anthropic" && (
                      <p className="text-xs text-muted-foreground">
                        Browse all Claude models at{" "}
                        <a href="https://docs.anthropic.com/en/docs/about-claude/models" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                          docs.anthropic.com
                        </a>
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="ai-base-url">Base URL</Label>
                    <Input
                      id="ai-base-url"
                      placeholder={
                        aiForm.provider === "anthropic"
                          ? "https://api.anthropic.com/v1"
                          : aiForm.provider === "openai"
                            ? "https://api.openai.com/v1"
                            : "https://openrouter.ai/api/v1"
                      }
                      value={aiForm.baseUrl}
                      onChange={(e) => setAiForm({ ...aiForm, baseUrl: e.target.value })}
                    />
                  </div>
                </div>
                <Button onClick={handleSaveAi} disabled={savingAi} className="w-full">
                  {savingAi ? "Saving..." : aiEditing ? "Update Connection" : "Create Connection"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          {/* Prompt Configuration */}
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Prompt Configuration</CardTitle>
              <CardDescription>
                Settings that influence AI prompts across every email type.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="predefined-instruction">Predefined Instruction</Label>
                <Textarea
                  id="predefined-instruction"
                  placeholder="e.g. Always address the reader by first name. Maintain a friendly, professional tone. Include brand colors #1a73e8 and #fbbc04."
                  value={predefinedInstruction}
                  onChange={(e) => setPredefinedInstruction(e.target.value)}
                  rows={5}
                />
                <p className="text-xs text-muted-foreground">
                  This text will prefill the &quot;Additional Instructions (optional)&quot; field
                  for every AI email type (Regular, Product Feature Update, Product Security Update,
                  Product Marketing Email).
                </p>
              </div>
              <div className="flex justify-end">
                <Button
                  onClick={handleSavePredefinedInstruction}
                  disabled={savingPredefinedInstruction || predefinedInstruction === predefinedInstructionLoaded}
                >
                  {savingPredefinedInstruction ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ===== R2 TAB ===== */}
        <TabsContent value="r2" className="mt-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Cloudflare R2 Storage</CardTitle>
                  <CardDescription>
                    Configure Cloudflare R2 for image uploads (screenshot references for AI email generation).
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={handleTestR2}
                    disabled={testingR2 || r2Configs.every((c) => !c.isActive)}
                  >
                    {testingR2 ? "Testing..." : "Test Active"}
                  </Button>
                  <Button onClick={openR2Create}>
                    <Plus className="mr-2 h-4 w-4" />
                    Add Connection
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {r2Configs.length === 0 ? (
                <p className="text-muted-foreground text-sm text-center py-8">
                  No R2 connections configured. Add one to enable image uploads.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Bucket</TableHead>
                      <TableHead>Public URL</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {r2Configs.map((config) => (
                      <TableRow key={config.id}>
                        <TableCell className="font-medium">{config.name}</TableCell>
                        <TableCell className="text-muted-foreground text-sm font-mono">{config.bucketName}</TableCell>
                        <TableCell className="text-muted-foreground text-sm truncate max-w-[200px]">{config.publicUrl}</TableCell>
                        <TableCell>
                          {config.isActive ? (
                            <Badge>Active</Badge>
                          ) : (
                            <Badge variant="secondary">Inactive</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            {!config.isActive && (
                              <Button variant="ghost" size="icon" title="Set as active" onClick={() => handleSetActiveR2(config.id!)}>
                                <Power className="h-4 w-4" />
                              </Button>
                            )}
                            <Button variant="ghost" size="icon" title="Edit" onClick={() => openR2Edit(config)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            {!config.isActive && (
                              <Button variant="ghost" size="icon" title="Delete" onClick={() => handleDeleteR2(config.id!)}>
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* R2 Config Dialog */}
          <Dialog open={r2DialogOpen} onOpenChange={setR2DialogOpen}>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>{r2Editing ? "Edit R2 Connection" : "New R2 Connection"}</DialogTitle>
                <DialogDescription>
                  Configure your Cloudflare R2 storage credentials
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 mt-2">
                <div className="grid gap-4 grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="r2-name">Connection Name</Label>
                    <Input
                      id="r2-name"
                      placeholder="e.g. Production"
                      value={r2Form.name}
                      onChange={(e) => setR2Form({ ...r2Form, name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="r2-account-id">Account ID</Label>
                    <Input
                      id="r2-account-id"
                      placeholder="Your Cloudflare Account ID"
                      value={r2Form.accountId}
                      onChange={(e) => setR2Form({ ...r2Form, accountId: e.target.value })}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="r2-access-key">Access Key ID</Label>
                  <div className="relative">
                    <Input
                      id="r2-access-key"
                      type={showR2AccessKey ? "text" : "password"}
                      placeholder="R2 Access Key ID"
                      value={r2Form.accessKeyId}
                      onChange={(e) => setR2Form({ ...r2Form, accessKeyId: e.target.value })}
                    />
                    <Button type="button" variant="ghost" size="icon" className="absolute right-0 top-0 h-full px-3 hover:bg-transparent" onClick={() => setShowR2AccessKey(!showR2AccessKey)}>
                      {showR2AccessKey ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
                    </Button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="r2-secret-key">Secret Access Key</Label>
                  <div className="relative">
                    <Input
                      id="r2-secret-key"
                      type={showR2SecretKey ? "text" : "password"}
                      placeholder="R2 Secret Access Key"
                      value={r2Form.secretAccessKey}
                      onChange={(e) => setR2Form({ ...r2Form, secretAccessKey: e.target.value })}
                    />
                    <Button type="button" variant="ghost" size="icon" className="absolute right-0 top-0 h-full px-3 hover:bg-transparent" onClick={() => setShowR2SecretKey(!showR2SecretKey)}>
                      {showR2SecretKey ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
                    </Button>
                  </div>
                </div>
                <div className="grid gap-4 grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="r2-bucket">Bucket Name</Label>
                    <Input
                      id="r2-bucket"
                      placeholder="my-bucket"
                      value={r2Form.bucketName}
                      onChange={(e) => setR2Form({ ...r2Form, bucketName: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="r2-public-url">Public URL</Label>
                    <Input
                      id="r2-public-url"
                      placeholder="https://pub-xxx.r2.dev"
                      value={r2Form.publicUrl}
                      onChange={(e) => setR2Form({ ...r2Form, publicUrl: e.target.value })}
                    />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Find your credentials in Cloudflare Dashboard &rarr; R2 &rarr; Manage R2 API Tokens. The Public URL is your bucket&apos;s public access domain (enable it in bucket settings).
                </p>
                <Button onClick={handleSaveR2} disabled={savingR2} className="w-full">
                  {savingR2 ? "Saving..." : r2Editing ? "Update Connection" : "Create Connection"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </TabsContent>

        {/* ===== FREEMIUS TAB ===== */}
        <TabsContent value="freemius" className="mt-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Freemius Accounts</CardTitle>
                  <CardDescription>
                    Connect Freemius developer accounts to pull your products (plugins) into the Email
                    Sequence editor. Add multiple accounts and mark one active.
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={handleTestFreemius}
                    disabled={testingFreemius || freemiusConfigs.every((c) => !c.isActive)}
                  >
                    {testingFreemius ? "Testing..." : "Test Active"}
                  </Button>
                  <Button onClick={openFreemiusCreate}>
                    <Plus className="mr-2 h-4 w-4" />
                    Add Account
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {freemiusConfigs.length === 0 ? (
                <p className="text-muted-foreground text-sm text-center py-8">
                  No Freemius accounts configured. Add one to pull your product list.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Developer ID</TableHead>
                      <TableHead>Public Key</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {freemiusConfigs.map((config) => (
                      <TableRow key={config.id}>
                        <TableCell className="font-medium">{config.name}</TableCell>
                        <TableCell className="text-muted-foreground text-sm font-mono">{config.developerId}</TableCell>
                        <TableCell className="text-muted-foreground text-sm font-mono truncate max-w-[200px]">{config.publicKey}</TableCell>
                        <TableCell>
                          {config.isActive ? (
                            <Badge>Active</Badge>
                          ) : (
                            <Badge variant="secondary">Inactive</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            {!config.isActive && (
                              <Button variant="ghost" size="icon" title="Set as active" onClick={() => handleSetActiveFreemius(config.id!)}>
                                <Power className="h-4 w-4" />
                              </Button>
                            )}
                            <Button variant="ghost" size="icon" title="Edit" onClick={() => openFreemiusEdit(config)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            {!config.isActive && (
                              <Button variant="ghost" size="icon" title="Delete" onClick={() => handleDeleteFreemius(config.id!)}>
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Freemius Config Dialog */}
          <Dialog open={freemiusDialogOpen} onOpenChange={setFreemiusDialogOpen}>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>{freemiusEditing ? "Edit Freemius Account" : "New Freemius Account"}</DialogTitle>
                <DialogDescription>
                  Enter your Freemius developer API credentials
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 mt-2">
                <div className="grid gap-4 grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="fs-name">Account Name</Label>
                    <Input
                      id="fs-name"
                      placeholder="e.g. bPlugins"
                      value={freemiusForm.name}
                      onChange={(e) => setFreemiusForm({ ...freemiusForm, name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="fs-dev-id">Developer ID</Label>
                    <Input
                      id="fs-dev-id"
                      placeholder="Your Freemius Developer ID"
                      value={freemiusForm.developerId}
                      onChange={(e) => setFreemiusForm({ ...freemiusForm, developerId: e.target.value })}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="fs-public-key">Public Key</Label>
                  <Input
                    id="fs-public-key"
                    placeholder="pk_..."
                    value={freemiusForm.publicKey}
                    onChange={(e) => setFreemiusForm({ ...freemiusForm, publicKey: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="fs-secret-key">Secret Key</Label>
                  <div className="relative">
                    <Input
                      id="fs-secret-key"
                      type={showFreemiusSecret ? "text" : "password"}
                      placeholder="sk_..."
                      value={freemiusForm.secretKey}
                      onChange={(e) => setFreemiusForm({ ...freemiusForm, secretKey: e.target.value })}
                    />
                    <Button type="button" variant="ghost" size="icon" className="absolute right-0 top-0 h-full px-3 hover:bg-transparent" onClick={() => setShowFreemiusSecret(!showFreemiusSecret)}>
                      {showFreemiusSecret ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
                    </Button>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Find these in your Freemius Developer Dashboard &rarr; Settings &rarr; Keys (Developer ID, Public Key, Secret Key). These grant developer-scope API access to list your products.
                </p>
                <Button onClick={handleSaveFreemius} disabled={savingFreemius} className="w-full">
                  {savingFreemius ? "Saving..." : freemiusEditing ? "Update Account" : "Create Account"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </TabsContent>

        {/* ===== USERS TAB ===== */}
        <TabsContent value="users" className="mt-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>User Management</CardTitle>
                  <CardDescription>
                    Manage platform users and roles
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                <Dialog
                  open={bulkDialogOpen}
                  onOpenChange={(o) => {
                    setBulkDialogOpen(o);
                    if (!o) {
                      setBulkResults(null);
                      setBulkEmails("");
                    }
                  }}
                >
                  <DialogTrigger render={<Button variant="outline" />}>
                    <Plus className="mr-2 h-4 w-4" />
                    Bulk Create Users
                  </DialogTrigger>
                  <DialogContent className="max-w-xl">
                    <DialogHeader>
                      <DialogTitle>Bulk create users</DialogTitle>
                      <DialogDescription>
                        Paste comma-separated email addresses. Each user gets a random temporary
                        password by email and must set their own password on first login.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 mt-2">
                      <div className="space-y-2">
                        <Label htmlFor="bulk-emails">Email addresses</Label>
                        <Textarea
                          id="bulk-emails"
                          rows={5}
                          placeholder="jane@example.com, john@example.com, sam@example.com"
                          value={bulkEmails}
                          onChange={(e) => setBulkEmails(e.target.value)}
                          disabled={bulkRunning}
                        />
                        <p className="text-xs text-muted-foreground">
                          Commas, spaces, or new lines all work as separators. Duplicates and
                          existing accounts are skipped automatically. Max 100 per batch.
                        </p>
                      </div>
                      <div className="space-y-2">
                        <Label>Role for all created users</Label>
                        <Select value={bulkRole} onValueChange={(v) => v && setBulkRole(v)}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="general_user">General User</SelectItem>
                            <SelectItem value="super_admin">Super Admin</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {bulkResults && (
                        <div className="rounded-md border bg-muted/30 p-3 space-y-1.5 max-h-56 overflow-y-auto">
                          <p className="text-xs font-medium">
                            {bulkResults.summary.created} created · {bulkResults.summary.emailed}{" "}
                            emailed · {bulkResults.summary.skipped} skipped ·{" "}
                            {bulkResults.summary.invalid} invalid
                          </p>
                          {bulkResults.results.map((r) => (
                            <div key={r.email} className="flex items-center gap-2 text-xs">
                              <span className="truncate">{r.email}</span>
                              {r.status === "created" && r.emailSent && (
                                <span className="text-green-600 dark:text-green-400 shrink-0">✓ emailed</span>
                              )}
                              {r.status === "created" && !r.emailSent && (
                                <span className="text-amber-600 dark:text-amber-400 shrink-0" title={r.emailError}>
                                  created, email failed — password:{" "}
                                  <code className="font-mono">{r.tempPassword}</code>
                                </span>
                              )}
                              {r.status === "skipped_exists" && (
                                <span className="text-muted-foreground shrink-0">already exists</span>
                              )}
                              {r.status === "invalid" && (
                                <span className="text-destructive shrink-0">invalid email</span>
                              )}
                            </div>
                          ))}
                        </div>
                      )}

                      <Button onClick={handleBulkCreate} disabled={bulkRunning} className="w-full">
                        {bulkRunning
                          ? "Creating & emailing…"
                          : "Bulk create users & email random passwords"}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
                <Dialog open={userDialogOpen} onOpenChange={setUserDialogOpen}>
                  <DialogTrigger render={<Button />}>
                    <Plus className="mr-2 h-4 w-4" />
                    Create User
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Create New User</DialogTitle>
                      <DialogDescription>
                        Add a new user to the platform
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 mt-4">
                      <div className="space-y-2">
                        <Label htmlFor="new-name">Full Name</Label>
                        <Input
                          id="new-name"
                          value={newUser.name}
                          onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="new-email">Email</Label>
                        <Input
                          id="new-email"
                          type="email"
                          value={newUser.email}
                          onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="new-password">Password</Label>
                        <Input
                          id="new-password"
                          type="password"
                          value={newUser.password}
                          onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                          minLength={8}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="new-role">Role</Label>
                        <Select
                          value={newUser.role}
                          onValueChange={(v) => setNewUser({ ...newUser, role: v || "general_user" })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="general_user">General User</SelectItem>
                            <SelectItem value="super_admin">Super Admin</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <Button onClick={handleCreateUser} disabled={creatingUser} className="w-full">
                        {creatingUser ? "Creating..." : "Create User"}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {users.length === 0 ? (
                <p className="text-muted-foreground text-sm text-center py-4">
                  No users found
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell className="font-medium">{user.name}</TableCell>
                        <TableCell>{user.email}</TableCell>
                        <TableCell>
                          <Badge variant={user.role === "super_admin" ? "default" : "secondary"}>
                            {user.role === "super_admin" ? "Admin" : "User"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {new Date(user.createdAt).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteUser(user.id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
