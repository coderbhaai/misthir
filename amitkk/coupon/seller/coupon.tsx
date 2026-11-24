"use client";

import { AdminTableLayout } from "@amitkk/basic/utils/layouts/AdminTableLayout";
import { useAdminPage } from "hooks/useAdminPage";
import { AdminDataTable } from "@amitkk/coupon/seller/admin/seller-coupon-table";
import { CouponProps } from "../types";

export function SellerCoupons() {
    const admin = useAdminPage<CouponProps>({ listEndpoint: "ecom/coupon", listFunction: "get_filtered_coupon", addRoute: "/seller/add-update-coupon" });

    const FILTER_CONFIG = [
        { name: "SearchFilter", grid: "col-span-9", },
        { name: "StatusFilter", grid: "col-span-3", },
    ] as const;

    const head: { id: string; label: string }[] = [
                    { id: "coupon", label: "Coupon" },
                    { id: "validity", label: "Validity" },
                    { id: "media", label: "Media" },
                    { id: "discount", label: "Discount" },
                    { id: "", label: "" },
                ];

    return (
        <AdminTableLayout admin={admin} title="Coupons" addButtonLabel="New Coupon" filters={FILTER_CONFIG} head={head} 
            rows={admin.data.map((i: CouponProps) => ( <AdminDataTable key={String(i._id)} row={i} onEdit={(row) => admin.handleEdit(row?._id?.toString())}/> ))}>
        </AdminTableLayout>
    );
}

export default SellerCoupons;