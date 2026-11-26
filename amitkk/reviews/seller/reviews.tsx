"use client"

import { AdminTableLayout } from "@amitkk/basic/utils/layouts/AdminTableLayout";
import { useAdminPage } from "hooks/useAdminPage";
import { AdminDataTable, DataProps } from "@amitkk/reviews/seller/admin/admin-review-table";

export  function sellerReviews(){
    const admin =   useAdminPage<DataProps>({ listEndpoint: "basic/review", listFunction: "get_filtered_reviews", singleFunction: "get_single_review" });

    const FILTER_CONFIG = [
        { name: "SearchFilter", grid: "col-span-9", },
        { name: "StatusFilter", grid: "col-span-3", },
    ] as const;

    const head: { id: string; label: string }[] = [
                    { id: "module", label: "Module" },
                    { id: "review", label: "Review" },
                    { id: "Media", label: "Media" },
                ];
    
    return(
        <AdminTableLayout admin={admin} title="Reviews" addButtonLabel="New Review" filters={FILTER_CONFIG} head={head} 
            rows={admin.data.map((i: DataProps) => ( <AdminDataTable key={String(i._id)} row={i}/> ))}>
        </AdminTableLayout>
    )
}

export default sellerReviews;