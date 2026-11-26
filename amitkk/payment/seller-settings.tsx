"use client"

import { AdminTableLayout } from "@amitkk/basic/utils/layouts/AdminTableLayout";
import { useAdminPage } from "hooks/useAdminPage";
import { AdminDataTable } from "@amitkk/payment/admin/admin-seller-setting-table";
import { SellerSiteSettingProps } from "@amitkk/payment/types";

export  function AdminSetting(){
    const admin =   useAdminPage<SellerSiteSettingProps>({ listEndpoint: "ecom/seller", listFunction: "get_filtered_seller_settings" });

    const FILTER_CONFIG = [
        { name: "SellerFilter", grid: "col-span-3" },
        { name: "SearchFilter", grid: "col-span-6", },
        { name: "StatusFilter", grid: "col-span-3", },
    ] as const;

    const head: { id: string; label: string }[] = [
                    { id: "Seller", label: "Seller" },
                    { id: "module", label: "Module" },
                    { id: "module_value", label: "Value" },
                    { id: "", label: "" },
                ];
    
    return(
        <AdminTableLayout admin={admin} title="Seller Settings" filters={FILTER_CONFIG} head={head} 
            rows={admin.data.map((i: SellerSiteSettingProps) => ( <AdminDataTable key={String(i._id)} row={i} onEdit={(row) => admin.handleEdit(row?._id?.toString())}/> ))}>
        </AdminTableLayout>
    )
}

export default AdminSetting;