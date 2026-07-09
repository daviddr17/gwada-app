"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ContactTagChip } from "@/components/contacts/contact-tag-chip";
import {
  createContactTag,
  fetchContactTagsForRestaurant,
  setContactTagAssigned,
  type ContactTagRow,
} from "@/lib/supabase/contact-tags-db";
import { cn } from "@/lib/utils";

export function ContactTagsEditor({
  restaurantId,
  contactId,
  assignedTagIds,
  disabled = false,
  onTagsChanged,
}: {
  restaurantId: string;
  contactId: string;
  assignedTagIds: string[];
  disabled?: boolean;
  onTagsChanged?: (tagIds: string[]) => void;
}) {
  const [tags, setTags] = useState<ContactTagRow[]>([]);
  const [assigned, setAssigned] = useState<Set<string>>(() => new Set(assignedTagIds));
  const [loading, setLoading] = useState(true);
  const [savingTagId, setSavingTagId] = useState<string | null>(null);
  const [newTagName, setNewTagName] = useState("");
  const [creating, setCreating] = useState(false);

  const loadTags = useCallback(async () => {
    setLoading(true);
    const { data, error } = await fetchContactTagsForRestaurant(restaurantId);
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setTags(data);
  }, [restaurantId]);

  useEffect(() => {
    void loadTags();
  }, [loadTags]);

  useEffect(() => {
    setAssigned(new Set(assignedTagIds));
  }, [assignedTagIds]);

  const toggleTag = async (tagId: string) => {
    if (disabled || savingTagId) return;
    const nextAssigned = !assigned.has(tagId);
    setSavingTagId(tagId);
    const { error } = await setContactTagAssigned({
      restaurantId,
      contactId,
      tagId,
      assigned: nextAssigned,
    });
    setSavingTagId(null);
    if (error) {
      toast.error(error.message);
      return;
    }
    setAssigned((prev) => {
      const next = new Set(prev);
      if (nextAssigned) next.add(tagId);
      else next.delete(tagId);
      onTagsChanged?.([...next]);
      return next;
    });
  };

  const handleCreateTag = async () => {
    const name = newTagName.trim();
    if (!name || creating) return;
    setCreating(true);
    const { data, error } = await createContactTag({ restaurantId, name });
    if (error) {
      setCreating(false);
      toast.error(error.message);
      return;
    }
    if (!data) {
      setCreating(false);
      return;
    }
    setTags((list) => [...list, data].sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name, "de")));
    setNewTagName("");
    setCreating(false);
    await toggleTag(data.id);
  };

  if (loading) {
    return (
      <p className="text-xs text-muted-foreground" aria-busy>
        Tags werden geladen …
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5">
        {tags.map((tag) => (
          <ContactTagChip
            key={tag.id}
            tag={tag}
            selected={assigned.has(tag.id)}
            onClick={() => void toggleTag(tag.id)}
            className={cn(
              (disabled || savingTagId === tag.id) && "opacity-60 pointer-events-none",
            )}
          />
        ))}
        {tags.length === 0 ? (
          <span className="text-xs text-muted-foreground">Noch keine Tags.</span>
        ) : null}
      </div>
      <div className="flex gap-2">
        <Input
          value={newTagName}
          disabled={disabled || creating}
          onChange={(e) => setNewTagName(e.target.value)}
          placeholder="Neuer Tag …"
          className="h-9 rounded-xl text-sm"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void handleCreateTag();
            }
          }}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-9 shrink-0 gap-1 rounded-xl"
          disabled={disabled || creating || !newTagName.trim()}
          onClick={() => void handleCreateTag()}
        >
          <Plus className="size-3.5" />
          Tag
        </Button>
      </div>
    </div>
  );
}
