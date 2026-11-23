"use client";

import { LayoutList, LayoutGrid } from "lucide-react";
import { Button } from "@amitkk/components/button/button";

export type ViewMode = "table" | "card";

interface ViewToggleButtonsProps {
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
}

export function ViewToggleButtons({ viewMode, onViewModeChange }: ViewToggleButtonsProps) {
  return (
    <div className="flex items-center gap-1 border rounded-lg p-1 bg-background">
      <Button
        type="button"
        variant={viewMode === "table" ? "default" : "ghost"}
        size="sm"
        className="h-8 w-8 p-0"
        onClick={() => onViewModeChange("table")}
        title="Table View"
      >
        <LayoutList className="h-4 w-4" />
      </Button>
      <Button
        type="button"
        variant={viewMode === "card" ? "default" : "ghost"}
        size="sm"
        className="h-8 w-8 p-0"
        onClick={() => onViewModeChange("card")}
        title="Card/Grid View"
      >
        <LayoutGrid className="h-4 w-4" />
      </Button>
    </div>
  );
}