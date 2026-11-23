"use client"

import { AdminTableLayout } from "@amitkk/basic/utils/layouts/AdminTableLayout";
import { useAdminPage } from "hooks/useAdminPage";
import { SingleProductItemProps } from "../types/product";
import { useState } from "react";
import { SellerDataTable } from "./admin/seller-product-table";
import { SingleSellerProductItem } from "./admin/SingleSellerProductItem";

export function SellerProducts(){
    const admin =   useAdminPage<SingleProductItemProps>({ listEndpoint: "ecom/product", listFunction: "get_filtered_products", addRoute: "/seller/add-update-product" });
    const [viewMode, setViewMode] = useState<"table" | "card">("table");

    const FILTER_CONFIG = [
        { name: "SearchFilter", grid: "col-span-3", },
        { name: "ProductTypeFilter", grid: "col-span-3", },
        { name: "ProductBrandFilter", grid: "col-span-3", },
        { name: "StatusFilter", grid: "col-span-3", },
    ] as const;

    return (
        <AdminTableLayout admin={admin} title="Products" filters={FILTER_CONFIG} head={[]} showViewToggle={true} viewMode={viewMode} onViewModeChange={setViewMode}
            rows={admin.data?.map((i) => {

            if (viewMode === "table") { return ( <SellerDataTable key={String(i._id)} row={i}/> ); }
            return ( <SingleSellerProductItem row={i}/> );
        })}>
        </AdminTableLayout>
  );
}

export default SellerProducts;