"use client";

import { useSyncExternalStore, type ReactNode } from "react";
import { SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type VisibleFields = "all" | "status" | "team" | "none";
const storageKey = "sprint.dashboard.schedule.fields";
const defaultFields: VisibleFields = "all";
const subscribers = new Set<() => void>();
let sessionFields: VisibleFields | undefined;

function getFields(): VisibleFields {
  if (sessionFields !== undefined) return sessionFields;
  try {
    const saved = window.sessionStorage.getItem(storageKey);
    if (saved === "all" || saved === "status" || saved === "team" || saved === "none") return saved;
  } catch {
    // The controls still work if the browser restricts storage.
  }
  return defaultFields;
}

function subscribe(listener: () => void) {
  subscribers.add(listener);
  return () => { subscribers.delete(listener); };
}

function setFields(showStatus: boolean, showTeam: boolean) {
  if (showStatus) sessionFields = showTeam ? "all" : "status";
  else sessionFields = showTeam ? "team" : "none";
  try {
    window.sessionStorage.setItem(storageKey, sessionFields);
  } catch {
    // Keep the selection in memory for the current page.
  }
  subscribers.forEach((listener) => listener());
}

export function ScheduleDisplay({ views, children }: { views: ReactNode; children: ReactNode }) {
  const fields = useSyncExternalStore(subscribe, getFields, () => defaultFields);
  const showStatus = fields === "all" || fields === "status";
  const showTeam = fields === "all" || fields === "team";

  return (
    <div
      data-hide-status={showStatus ? undefined : ""}
      data-hide-team={showTeam ? undefined : ""}
      className="[&[data-hide-status]_[data-schedule-status]]:hidden [&[data-hide-team]_[data-schedule-team]]:hidden"
    >
      <div className="flex items-center justify-between gap-1 border-b">
        {views}
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="ghost" size="sm" />}>
            <SlidersHorizontal aria-hidden />
            표시
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuCheckboxItem checked={showStatus} closeOnClick={false} onCheckedChange={(checked) => setFields(checked, showTeam)}>
              상태
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem checked={showTeam} closeOnClick={false} onCheckedChange={(checked) => setFields(showStatus, checked)}>
              팀
            </DropdownMenuCheckboxItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {children}
    </div>
  );
}
