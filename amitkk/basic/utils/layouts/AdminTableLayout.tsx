"use client";

import { ReactNode } from "react";
import { Plus } from "lucide-react";
import { FILTER_COMPONENTS } from "../filters";
import { useFilterContext } from "contexts/FilterContext";
import { Button } from "@amitkk/components/button/button";
import { Table, TableBody, TableHead, TableHeader, TableRow } from "@amitkk/components/basic/table";
import { cn } from "@amitkk/lib/utils";
import { ViewMode, ViewToggleButtons } from "@amitkk/components/button/ViewToggleButtons";

interface FilterConfig {
  name: keyof typeof FILTER_COMPONENTS;
  grid?: string;
  props?: Record<string, any>;
}

interface PaginationProps {
  total: number;
  page: number;
  limit: number;
}

interface AdminObject<T> {
  data: T[];
  pagination?: PaginationProps;
  handleAddNew?: () => void;
}

type AdminTableLayoutProps<T> = {
  admin: AdminObject<T>;
  title: ReactNode;
  head: {id: string; label: string;}[];
  rows: ReactNode;
  addButtonLabel?: string;
  filters?: readonly FilterConfig[];
  actionsAboveFilters?: ReactNode;
  children?: ReactNode;
  emptyMessage?: ReactNode;
  showPagination?: boolean;
  tableContainerClassName?: string;
  showViewToggle?: boolean;
  viewMode?: ViewMode;
  onViewModeChange?: (mode: ViewMode) => void;
};

export function AdminTableLayout<T>({
  admin,
  title,
  head,
  rows,
  addButtonLabel,
  filters = [],
  actionsAboveFilters,
  children,
  emptyMessage,
  showPagination = true,
  tableContainerClassName,
  showViewToggle = false,
  viewMode = "table",
  onViewModeChange,
}: AdminTableLayoutProps<T>) {
  const { onPageChange, onRowsPerPageChange, clearFilters } = useFilterContext();
  const { data, pagination, handleAddNew } = admin;
  
  return (
    <div className="relative pb-24">
      <div className="px-1">
        <div className="flex flex-wrap items-center justify-between gap-4 overflow-x-hidden">
          <h1 className="text-xl font-bold">{title}</h1>
          <div className="flex items-center gap-2">
            {showViewToggle && onViewModeChange && (
              <ViewToggleButtons viewMode={viewMode} onViewModeChange={onViewModeChange} />
            )}

            {handleAddNew && addButtonLabel && (
              <Button onClick={handleAddNew} className="shrink-0 w-fit"><Plus className="mr-2 h-4 w-4"/>{addButtonLabel}</Button>
            )}
          </div>
        </div>

        {actionsAboveFilters && ( <div className="mb-2 flex justify-end gap-2">{actionsAboveFilters}</div> )}

        <div className="my-3 row">
          <div className="col-span-10">
            {filters.length > 0 && (
              <div className="row">
                {filters.map((filter) => {
                  const {name, grid, props} = filter;
                  const FilterComponent = FILTER_COMPONENTS[name];
                  if (!FilterComponent) return null;

                  return (
                    <div key={String(name)} className={cn(grid || "col-span-3")}>
                      <FilterComponent {...(props || {})}/>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="col-span-2 flex items-center justify-end">
            <Button variant="outline" onClick={clearFilters} className="border-red-500 text-red-500 hover:bg-red-50 hover:text-red-600 h-14 w-full">
              <Plus className="mr-2 h-4 w-4"/>Clear All</Button>
          </div>
        </div>
      </div>

      {viewMode === "table" ? (
        <div className={cn("relative w-full overflow-auto rounded-2xl bg-white shadow-sm", tableContainerClassName)}>
          <Table>
            <TableHeader>
              <TableRow>
                {head.map((item) => ( <TableHead key={item.id}>{item.label}</TableHead> ))}
              </TableRow>
            </TableHeader>

            <TableBody>
              {rows}

              {/* {!data?.length &&
                (emptyMessage || (
                  <TableRow>
                    <td colSpan={head.length} className="h-24 text-center text-sm text-muted-foreground">No data found</td>
                  </TableRow>
                ))} */}
            </TableBody>
          </Table>
        </div>
      ) : (
        <>{rows}</>
      )}

      
      {showPagination && (
        <div className="fixed bottom-0 left-0 right-0 z-40 border-t bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80">
          <div className="mx-auto flex max-w-full flex-col items-center justify-between gap-4 px-4 py-2 sm:flex-row">
            <div>
              {handleAddNew && addButtonLabel && (
                <Button onClick={handleAddNew} className="shrink-0"><Plus className="mr-2 h-4 w-4"/>{addButtonLabel}</Button>
              )}
            </div>

            <div className="flex items-center justify-center gap-2">
              <select value={pagination?.limit ?? 25} onChange={(e) => onRowsPerPageChange(e as any)} className="h-9 rounded-md border px-3 text-sm">
                {[5, 10, 25, 50, 100].map((size) => ( <option key={size} value={size}>{size}</option> ))}
              </select>

              <div className="text-sm text-muted-foreground">Total:{" "} {pagination?.total ?? data?.length ?? 0}</div>

              <Button variant="outline" disabled={(pagination?.page ?? 0) <= 0} onClick={(e) => onPageChange(e as any, (pagination?.page ?? 0) - 1)} style={{ padding: 0 }}>
                <img src="/images/icons/static/arrow-left.svg" className="w-5 h-5 cursor-pointer"/>
              </Button>

              <div className="text-center text-sm">Page {(pagination?.page ?? 0) + 1}</div>

              <Button variant="outline" disabled={((pagination?.page ?? 0) + 1) * (pagination?.limit ?? 25) >= (pagination?.total ?? 0)} onClick={(e) => onPageChange(e as any, (pagination?.page ?? 0) + 1)} style={{ padding: 0 }}>
                  <img src="/images/icons/static/arrow-right.svg" className="w-5 h-5 cursor-pointer"/>
                </Button>
            </div>
          </div>
        </div>
      )}
      
      {children}
    </div>
  );
}