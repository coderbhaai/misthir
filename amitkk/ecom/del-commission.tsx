"use client"

import { AdminTableLayout } from "@amitkk/basic/utils/layouts/AdminTableLayout";
import { useAdminPage } from "hooks/useAdminPage";
import DataModal from "@amitkk/ecom/admin/product/commission-modal";
import { AdminDataTable, DataProps } from "@amitkk/ecom/admin/product/admin-commission-table";

export  function AdminCommission(){
    const admin =   useAdminPage<DataProps>({ listEndpoint: "ecom/commission", listFunction: "get_filtered_commissions", singleFunction: "get_single_commission" });

    const FILTER_CONFIG = [
        { name: "SearchFilter", grid: "col-span-9", },
        { name: "StatusFilter", grid: "col-span-3", },
    ] as const;

    const head: { id: string; label: string }[] = [
                    { id: "type", label: "Type" },
                    { id: "Seller", label: "Seller" },
                    { id: "commission", label: "commission" },
                    { id: "date", label: "Date" },
                    { id: "", label: "" },
                ];
    
    return(
        <AdminTableLayout admin={admin} title="Commissions" addButtonLabel="New Commission" filters={FILTER_CONFIG} head={head} 
            rows={admin.data.map((i: DataProps) => ( <AdminDataTable key={String(i._id)} row={i} onEdit={(row) => admin.handleEdit(row?._id?.toString())}/> ))}>
            <DataModal {...admin.modal}/>
        </AdminTableLayout>
    )
}

export default AdminCommission;