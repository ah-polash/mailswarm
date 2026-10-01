"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { CheckCircle, AlertCircle, Loader2 } from "lucide-react";

interface CategoryItem {
  id: string;
  name: string;
  description?: string | null;
  autoCheckOnUnsubscribe?: boolean;
}

interface InfoResponse {
  email: string;
  campaign: { id: string; name: string; categoryId: string | null } | null;
  categories: CategoryItem[];
  optedOutCategoryIds: string[];
  isGloballyUnsubscribed: boolean;
  /** Old unsigned link: only "unsubscribe from all" is allowed. */
  legacy?: boolean;
}

function UnsubscribeContent() {
  const searchParams = useSearchParams();
  const email = searchParams.get("email");
  const campaignId = searchParams.get("campaignId");
  const token = searchParams.get("t");

  const [loading, setLoading] = useState(true);
  const [info, setInfo] = useState<InfoResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [unsubscribeAll, setUnsubscribeAll] = useState(false);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<{ message: string } | null>(null);

  useEffect(() => {
    async function fetchInfo() {
      if (!email) {
        setError("Invalid unsubscribe link.");
        setLoading(false);
        return;
      }
      try {
        const params = new URLSearchParams({ email });
        if (campaignId) params.set("campaignId", campaignId);
        if (token) params.set("t", token);
        const res = await fetch(`/api/unsubscribe?${params.toString()}`);
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          setError(data.error || "Failed to load preferences.");
          return;
        }
        const data: InfoResponse = await res.json();
        setInfo(data);
        setUnsubscribeAll(data.isGloballyUnsubscribed);
        const initial = new Set<string>(data.optedOutCategoryIds);

        // First-visit defaults: only seed pre-checks when the user has no
        // prior preferences saved. Pre-check ONLY the categories that admins
        // explicitly marked "Auto Check This Category In Unsubscribe
        // Preference Page" — nothing else is checked by default.
        if (!data.isGloballyUnsubscribed && data.optedOutCategoryIds.length === 0) {
          for (const c of data.categories) {
            if (c.autoCheckOnUnsubscribe) initial.add(c.id);
          }
        }
        setSelectedCategoryIds(initial);

        // If the seeded set already covers every category, reflect that in
        // the master "Unsubscribe from all" toggle.
        if (
          data.categories.length > 0 &&
          data.categories.every((c) => initial.has(c.id))
        ) {
          setUnsubscribeAll(true);
        }
      } catch {
        setError("Something went wrong. Please try again later.");
      } finally {
        setLoading(false);
      }
    }
    fetchInfo();
  }, [email, campaignId, token]);

  const toggleCategory = (id: string, checked: boolean) => {
    setSelectedCategoryIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);

      // Keep "Unsubscribe from all" in sync with whether every category is selected.
      const cats = info?.categories ?? [];
      const allSelected = cats.length > 0 && cats.every((c) => next.has(c.id));
      setUnsubscribeAll(allSelected);

      return next;
    });
  };

  const onUnsubscribeAllChange = (checked: boolean) => {
    setUnsubscribeAll(checked);
    const cats = info?.categories ?? [];
    if (checked) {
      // Reflect the choice visually by checking every category too.
      setSelectedCategoryIds(new Set(cats.map((c) => c.id)));
    } else {
      // Toggling off "all" clears the selection so the user can pick specifics.
      setSelectedCategoryIds(new Set());
    }
  };

  const submitDisabled = useMemo(() => {
    if (submitting) return true;
    if (unsubscribeAll) return false;
    return selectedCategoryIds.size === 0;
  }, [submitting, unsubscribeAll, selectedCategoryIds]);

  const handleSubmit = async () => {
    if (!email) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/unsubscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          campaignId,
          t: token,
          scope: unsubscribeAll ? "all" : "categories",
          categoryIds: unsubscribeAll ? [] : Array.from(selectedCategoryIds),
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Failed to update preferences.");
        return;
      }
      const data = await res.json();
      setDone({ message: data.message || "Your preferences have been saved." });
    } catch {
      setError("Something went wrong. Please try again later.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center gap-3 py-4">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <p className="text-muted-foreground">Loading your preferences...</p>
      </div>
    );
  }

  if (done) {
    return (
      <div className="flex flex-col items-center gap-3 py-4 text-center">
        <CheckCircle className="h-12 w-12 text-green-500" />
        <p className="text-lg font-medium">{done.message}</p>
        <p className="text-sm text-muted-foreground">
          You can close this page. We&apos;ll respect your choices on future emails.
        </p>
      </div>
    );
  }

  if (error || !info) {
    return (
      <div className="flex flex-col items-center gap-3 py-4 text-center">
        <AlertCircle className="h-12 w-12 text-destructive" />
        <p className="text-lg font-medium">Oops!</p>
        <p className="text-sm text-muted-foreground">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-5 text-left">
      <div className="space-y-1">
        <p className="text-sm">
          Manage email preferences for{" "}
          <span className="font-medium">{info.email}</span>
        </p>
        {info.campaign && (
          <p className="text-xs text-muted-foreground">
            From campaign: {info.campaign.name}
          </p>
        )}
      </div>

      {info.legacy ? (
        <p className="text-sm text-muted-foreground">
          This is an older link, so it can only unsubscribe you from all emails. To choose
          specific categories instead, use the unsubscribe link in a recent email.
        </p>
      ) : info.categories.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No category preferences are configured. You can still unsubscribe from
          all emails below.
        </p>
      ) : (
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Email Categories
          </p>
          <div className="space-y-2 rounded-md border p-3">
            {info.categories.map((c) => {
              const checked = selectedCategoryIds.has(c.id);
              return (
                <label
                  key={c.id}
                  className="flex items-start gap-3 cursor-pointer"
                >
                  <Checkbox
                    checked={checked}
                    onCheckedChange={(v) => toggleCategory(c.id, !!v)}
                    className="mt-0.5"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">
                      Unsubscribe from <span className="text-foreground">{c.name}</span>
                    </p>
                    {c.description && (
                      <p className="text-xs text-muted-foreground">{c.description}</p>
                    )}
                  </div>
                </label>
              );
            })}
          </div>
        </div>
      )}

      <Separator />

      <label className="flex items-start gap-3 cursor-pointer">
        <Checkbox
          checked={unsubscribeAll}
          onCheckedChange={(v) => onUnsubscribeAllChange(!!v)}
          className="mt-0.5"
        />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium">Unsubscribe from all emails</p>
          <p className="text-xs text-muted-foreground">
            We&apos;ll stop sending you marketing emails from every category.
          </p>
        </div>
      </label>

      <Button
        className="w-full"
        onClick={handleSubmit}
        disabled={submitDisabled}
      >
        {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
        {unsubscribeAll ? "Unsubscribe from all" : "Save preferences"}
      </Button>
    </div>
  );
}

export default function UnsubscribePage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-10">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold tracking-tight">
            bPlugins
          </CardTitle>
          <CardDescription>Email Preferences</CardDescription>
        </CardHeader>
        <CardContent>
          <Suspense
            fallback={
              <div className="flex flex-col items-center gap-3 py-4">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                <p className="text-muted-foreground">Loading...</p>
              </div>
            }
          >
            <UnsubscribeContent />
          </Suspense>
        </CardContent>
      </Card>
    </div>
  );
}
