"use client"

import { AdminTableLayout } from "@amitkk/basic/utils/layouts/AdminTableLayout";
import { useAdminPage } from "hooks/useAdminPage";
import DataModal from "@amitkk/basic/admin/spatie/user-modal";
import { AdminDataTable } from "@amitkk/ecom/admin/product/admin-seller-table";
import { UserProps } from "@amitkk/basic/types/user";

export  function AdminSeller(){
    const admin =   useAdminPage<UserProps>({ listEndpoint: "basic/spatie", listFunction: "get_filtered_user_by_role", listPayload: { role: ["Seller", "Seller Staff"] }, singleFunction: "get_single_seller" });

    const FILTER_CONFIG = [
        { name: "SearchFilter", grid: "col-span-9", },
        { name: "StatusFilter", grid: "col-span-3", },
    ] as const;

    const head: { id: string; label: string }[] = [
                    { id: "Seller", label: "Seller" },
                    { id: "role", label: "Role" },
                    { id: "permission", label: "Permissions" },
                    { id: "", label: "" },
                ];
    
    return(
        <AdminTableLayout admin={admin} title="Sellers" addButtonLabel="New Seller" filters={FILTER_CONFIG} head={head} 
            rows={admin.data.map((i: UserProps) => ( <AdminDataTable key={String(i._id)} row={i} onEdit={(row) => admin.handleEdit(row?._id?.toString())}/> ))}>
            <DataModal {...admin.modal} />
        </AdminTableLayout>
    )
}

export default AdminSeller;