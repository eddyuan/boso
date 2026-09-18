"use client";

import { useState } from "react";
import { Clock, Loader2, MapPin, Pencil, Plus, Sparkles, Trash2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState, Loading, Notice, PageHeader, Pagination, SearchField } from "../_components/ui";
import { useAdminData } from "../_components/use-admin-data";
import { useDebounced } from "../_components/use-debounced";

const PAGE_SIZE = 30;

type MockProfile = {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  userImage: string | null;
  gender: "male" | "female" | "other" | "prefer_not_to_say" | null;
  age: number | null;
  location: string | null;
  latitude: number | null;
  longitude: number | null;
  background: string | null;
  personalityTraits: string[];
  tone: string | null;
  postingSchedule: {
    frequency: "daily" | "weekly" | "custom";
    times: string[];
    timezone: string;
  } | null;
  interests: string[];
  createdAt: string;
  updatedAt: string;
};

type MockUser = {
  id: string;
  name: string;
  email: string;
  isMock: boolean;
};

export default function MockProfilesPage() {
  const [search, setSearch] = useState("");
  const query = useDebounced(search);
  const [page, setPage] = useState(1);

  const params = new URLSearchParams({ page: String(page) });
  if (query) params.set("search", query);
  const {
    data,
    loading,
    reload: fetchProfiles,
  } = useAdminData<{ profiles: MockProfile[]; total: number }>(`/api/admin/mock-profiles?${params}`);
  const profiles = data?.profiles ?? [];
  const total = data?.total ?? 0;
  const strays = useAdminData<{ users: MockUser[] }>("/api/admin/users?mock=only&pageSize=1000");
  const mockUsers = strays.data?.users ?? [];

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProfile, setEditingProfile] = useState<MockProfile | null>(null);
  const [formData, setFormData] = useState({
    userId: "",
    gender: "" as "" | "male" | "female" | "other" | "prefer_not_to_say",
    age: "",
    location: "",
    latitude: "",
    longitude: "",
    background: "",
    personalityTraits: "",
    tone: "",
    interests: "",
    scheduleFrequency: "daily" as "daily" | "weekly" | "custom",
    scheduleTimes: "09:00,14:00,20:00",
    scheduleTimezone: "America/Vancouver",
  });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<MockProfile | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const openCreateDialog = () => {
    setEditingProfile(null);
    setFormData({
      userId: "",
      gender: "",
      age: "",
      location: "",
      latitude: "",
      longitude: "",
      background: "",
      personalityTraits: "",
      tone: "",
      interests: "",
      scheduleFrequency: "daily",
      scheduleTimes: "09:00,14:00,20:00",
      scheduleTimezone: "America/Vancouver",
    });
    setFormError(null);
    setDialogOpen(true);
  };

  const openEditDialog = (profile: MockProfile) => {
    setEditingProfile(profile);
    setFormData({
      userId: profile.userId,
      gender: profile.gender ?? "",
      age: profile.age?.toString() ?? "",
      location: profile.location ?? "",
      latitude: profile.latitude?.toString() ?? "",
      longitude: profile.longitude?.toString() ?? "",
      background: profile.background ?? "",
      personalityTraits: profile.personalityTraits.join(", "),
      tone: profile.tone ?? "",
      interests: profile.interests.join(", "),
      scheduleFrequency: profile.postingSchedule?.frequency ?? "daily",
      scheduleTimes: profile.postingSchedule?.times.join(",") ?? "09:00,14:00,20:00",
      scheduleTimezone: profile.postingSchedule?.timezone ?? "America/Vancouver",
    });
    setFormError(null);
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    setSaving(true);
    setFormError(null);
    const payload = {
      ...(editingProfile && { id: editingProfile.id }),
      userId: formData.userId,
      ...(formData.gender && { gender: formData.gender }),
      ...(formData.age && { age: parseInt(formData.age) }),
      ...(formData.location && { location: formData.location }),
      ...(formData.latitude && { latitude: parseFloat(formData.latitude) }),
      ...(formData.longitude && { longitude: parseFloat(formData.longitude) }),
      ...(formData.background && { background: formData.background }),
      ...(formData.personalityTraits && {
        personalityTraits: formData.personalityTraits.split(",").map((t) => t.trim()).filter(Boolean),
      }),
      ...(formData.tone && { tone: formData.tone }),
      ...(formData.interests && {
        interests: formData.interests.split(",").map((i) => i.trim()).filter(Boolean),
      }),
      postingSchedule: {
        frequency: formData.scheduleFrequency,
        times: formData.scheduleTimes.split(",").map((t) => t.trim()).filter(Boolean),
        timezone: formData.scheduleTimezone,
      },
    };

    const res = await fetch("/api/admin/mock-profiles", {
      method: editingProfile ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    setSaving(false);
    if (res.ok) {
      setDialogOpen(false);
      fetchProfiles();
    } else {
      const data = await res.json().catch(() => ({}));
      setFormError(
        data.error === "profile_exists"
          ? "That stray already has a persona — edit it instead."
          : data.error === "invalid_body"
            ? "Some fields aren't valid. Check the numbers and times."
            : `Couldn't save (${data.error ?? res.status}).`,
      );
    }
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    setDeleteBusy(true);
    const res = await fetch(`/api/admin/mock-profiles?id=${deleting.id}`, { method: "DELETE" });
    setDeleteBusy(false);
    if (res.ok) {
      setDeleting(null);
      fetchProfiles();
    }
  };

  const set = <K extends keyof typeof formData>(key: K, value: (typeof formData)[K]) =>
    setFormData((f) => ({ ...f, [key]: value }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Personas"
        description="Who each stray is when it writes: background, voice, interests and when it posts."
        actions={
          <Button onClick={openCreateDialog}>
            <Plus />
            New persona
          </Button>
        }
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <SearchField
          value={search}
          onChange={(v) => {
            setSearch(v);
            setPage(1);
          }}
          placeholder="Search name, email, location"
        />
        <p className="text-[13px] font-semibold text-muted-foreground">
          {total} {total === 1 ? "persona" : "personas"}
        </p>
      </div>

      {loading && !data ? (
        <Loading label="Loading personas…" />
      ) : profiles.length === 0 ? (
        <div className="rounded-2xl bg-card shadow-card">
          <EmptyState
            icon={Sparkles}
            title={query ? "No personas match" : "No personas yet"}
            hint={query ? undefined : "Give a stray a background and a voice so its posts sound like someone."}
            action={
              !query && (
                <Button onClick={openCreateDialog}>
                  <Plus />
                  New persona
                </Button>
              )
            }
          />
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {profiles.map((profile) => (
            <article key={profile.id} className="flex flex-col gap-4 rounded-2xl bg-card p-5 shadow-card">
              <div className="flex items-start gap-3">
                <Avatar className="h-11 w-11">
                  <AvatarImage src={profile.userImage ?? undefined} alt="" />
                  <AvatarFallback>{profile.userName[0]?.toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-display text-lg font-semibold leading-tight">{profile.userName}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {[profile.age && `${profile.age}`, profile.gender && profile.gender.replaceAll("_", " ")]
                      .filter(Boolean)
                      .join(" · ") || profile.userEmail}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button variant="ghost" size="icon-sm" onClick={() => openEditDialog(profile)} aria-label="Edit persona">
                    <Pencil />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => setDeleting(profile)}
                    aria-label="Delete persona"
                    className="hover:bg-destructive-soft hover:text-destructive"
                  >
                    <Trash2 />
                  </Button>
                </div>
              </div>

              {profile.background && (
                <p className="line-clamp-3 text-sm leading-relaxed text-muted-foreground">{profile.background}</p>
              )}

              {(profile.tone || profile.personalityTraits.length > 0) && (
                <div className="flex flex-wrap gap-1.5">
                  {profile.tone && (
                    <Badge className="min-w-0 max-w-full" title={profile.tone}>
                      <span className="min-w-0 truncate">{profile.tone}</span>
                    </Badge>
                  )}
                  {profile.personalityTraits.map((t) => (
                    <Badge key={t} variant="secondary">
                      {t}
                    </Badge>
                  ))}
                </div>
              )}

              {profile.interests.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {profile.interests.slice(0, 5).map((i) => (
                    <Badge key={i} variant="outline">
                      {i}
                    </Badge>
                  ))}
                  {profile.interests.length > 5 && <Badge variant="outline">+{profile.interests.length - 5}</Badge>}
                </div>
              )}

              <div className="mt-auto flex flex-wrap gap-x-4 gap-y-1 rounded-xl bg-background px-3 py-2.5 text-xs font-semibold text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5" />
                  {profile.location ?? "No location"}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5" />
                  {profile.postingSchedule
                    ? `${profile.postingSchedule.frequency}, ${profile.postingSchedule.times.join(" · ")}`
                    : "No schedule"}
                </span>
              </div>
            </article>
          ))}
        </div>
      )}

      <div className="rounded-2xl bg-card px-2 shadow-card empty:hidden">
        <Pagination page={page} pageSize={PAGE_SIZE} total={total} onPage={setPage} />
      </div>

      {/* Create / edit */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingProfile ? `Edit ${editingProfile.userName}` : "New persona"}</DialogTitle>
            <DialogDescription>Shapes what this stray writes about and how it sounds.</DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            <Field label="Stray" htmlFor="userId">
              <Select value={formData.userId} onValueChange={(v) => set("userId", v)} disabled={!!editingProfile}>
                <SelectTrigger id="userId">
                  <SelectValue placeholder="Choose a stray account" />
                </SelectTrigger>
                <SelectContent>
                  {mockUsers.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Section title="Who they are">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Gender" htmlFor="gender">
                  <Select value={formData.gender} onValueChange={(v) => set("gender", v as typeof formData.gender)}>
                    <SelectTrigger id="gender">
                      <SelectValue placeholder="Not set" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="male">Male</SelectItem>
                      <SelectItem value="female">Female</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                      <SelectItem value="prefer_not_to_say">Prefer not to say</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Age" htmlFor="age">
                  <Input
                    id="age"
                    type="number"
                    min={13}
                    max={120}
                    value={formData.age}
                    onChange={(e) => set("age", e.target.value)}
                    placeholder="25"
                  />
                </Field>
              </div>
              <Field label="Background" htmlFor="background">
                <Textarea
                  id="background"
                  value={formData.background}
                  onChange={(e) => set("background", e.target.value)}
                  placeholder="Software developer who loves coffee and weekend hikes…"
                  rows={3}
                />
              </Field>
            </Section>

            <Section title="Voice">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Traits" htmlFor="traits" hint="Comma-separated">
                  <Input
                    id="traits"
                    value={formData.personalityTraits}
                    onChange={(e) => set("personalityTraits", e.target.value)}
                    placeholder="curious, friendly"
                  />
                </Field>
                <Field label="Tone" htmlFor="tone">
                  <Input id="tone" value={formData.tone} onChange={(e) => set("tone", e.target.value)} placeholder="casual" />
                </Field>
              </div>
              <Field label="Interests" htmlFor="interests" hint="Comma-separated">
                <Input
                  id="interests"
                  value={formData.interests}
                  onChange={(e) => set("interests", e.target.value)}
                  placeholder="coffee, art, cats, hiking"
                />
              </Field>
            </Section>

            <Section title="Where">
              <Field label="Place name" htmlFor="location">
                <Input
                  id="location"
                  value={formData.location}
                  onChange={(e) => set("location", e.target.value)}
                  placeholder="Richmond, BC"
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Latitude" htmlFor="latitude">
                  <Input
                    id="latitude"
                    type="number"
                    step="0.0001"
                    value={formData.latitude}
                    onChange={(e) => set("latitude", e.target.value)}
                    placeholder="49.1861"
                    className="font-mono"
                  />
                </Field>
                <Field label="Longitude" htmlFor="longitude">
                  <Input
                    id="longitude"
                    type="number"
                    step="0.0001"
                    value={formData.longitude}
                    onChange={(e) => set("longitude", e.target.value)}
                    placeholder="-123.1057"
                    className="font-mono"
                  />
                </Field>
              </div>
            </Section>

            <Section title="When they post">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Frequency" htmlFor="scheduleFrequency">
                  <Select
                    value={formData.scheduleFrequency}
                    onValueChange={(v) => set("scheduleFrequency", v as typeof formData.scheduleFrequency)}
                  >
                    <SelectTrigger id="scheduleFrequency">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">Daily</SelectItem>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="custom">Custom</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Timezone" htmlFor="scheduleTimezone">
                  <Input
                    id="scheduleTimezone"
                    value={formData.scheduleTimezone}
                    onChange={(e) => set("scheduleTimezone", e.target.value)}
                    placeholder="America/Vancouver"
                  />
                </Field>
              </div>
              <Field label="Times" htmlFor="scheduleTimes" hint="HH:MM, comma-separated">
                <Input
                  id="scheduleTimes"
                  value={formData.scheduleTimes}
                  onChange={(e) => set("scheduleTimes", e.target.value)}
                  placeholder="09:00, 14:00, 20:00"
                  className="font-mono"
                />
              </Field>
            </Section>

            {formError && <Notice tone="red">{formError}</Notice>}
          </div>

          <DialogFooter>
            <Button variant="secondary" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={saving || !formData.userId}>
              {saving && <Loader2 className="animate-spin" />}
              {saving ? "Saving…" : editingProfile ? "Save changes" : "Create persona"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete */}
      <Dialog open={deleting !== null} onOpenChange={(open) => !open && setDeleting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this persona?</DialogTitle>
            <DialogDescription>
              {deleting?.userName} keeps its account and posts, but goes back to writing without a background or voice.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setDeleting(null)} disabled={deleteBusy}>
              Keep it
            </Button>
            <Button
              className="bg-destructive text-destructive-foreground shadow-none hover:brightness-110"
              onClick={confirmDelete}
              disabled={deleteBusy}
            >
              {deleteBusy ? <Loader2 className="animate-spin" /> : <Trash2 />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="space-y-3 rounded-2xl bg-background p-4">
      <legend className="float-left mb-1 font-display text-base font-semibold">{title}</legend>
      <div className="clear-both space-y-3">{children}</div>
    </fieldset>
  );
}

function Field({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor} className="flex items-baseline justify-between gap-2">
        {label}
        {hint && <span className="text-[11px] font-semibold text-muted-foreground/80">{hint}</span>}
      </Label>
      {children}
    </div>
  );
}
