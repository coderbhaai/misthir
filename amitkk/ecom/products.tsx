"use client"

import { AdminTableLayout } from "@amitkk/basic/utils/layouts/AdminTableLayout";
import { AdminDataTable } from "@amitkk/ecom/admin/product/admin-product-table";
import { useAdminPage } from "hooks/useAdminPage";
import { SingleProductItemProps } from "./types/product";
import { useState } from "react";
import { SingleAdminProductItem } from "./admin/product/SingleAdminProductItem";

export function AdminProducts(){
    const admin =   useAdminPage<SingleProductItemProps>({ listEndpoint: "ecom/product", listFunction: "get_filtered_products", addRoute: "/admin/add-update-product" });
    const [viewMode, setViewMode] = useState<"table" | "card">("table");

    const FILTER_CONFIG = [
        { name: "SellerFilter", grid: "col-span-3" },
        { name: "SearchFilter", grid: "col-span-3", },
        { name: "ProductTypeFilter", grid: "col-span-2", },
        { name: "ProductBrandFilter", grid: "col-span-2", },
        { name: "StatusFilter", grid: "col-span-2", },
    ] as const;

    const head: { id: string; label: string }[] = [
                    { id: "Product", label: "Product" },
                    { id: "Seller", label: "Seller" },
                    { id: "Tags", label: "Tags" },
                    { id: "SKUs", label: "SKUs" },
                    { id: "status", label: "Status" },
                    { id: "", label: "" },
                ];

    return (
        <AdminTableLayout admin={admin} title="Products" filters={FILTER_CONFIG} head={head} showViewToggle={true} viewMode={viewMode} onViewModeChange={setViewMode}
            rows={admin.data?.map((i) => {

            if (viewMode === "table") { return ( <AdminDataTable key={String(i._id)} row={i}/> ); }
            return ( <SingleAdminProductItem row={i}/> );
        })}>
        </AdminTableLayout>
  );
}

export default AdminProducts;