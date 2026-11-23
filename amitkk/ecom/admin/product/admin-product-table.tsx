"use client";

import Link from "next/link";
import { ProductFilterBadges } from "../../static/ProductFilterBadges";
import { MetaRow } from "@amitkk/components/admin/MetaRow";
import { ProductFilterProps, SingleProductItemProps } from "../../types/product";
import { MediaCards } from "@amitkk/components/admin/MediaCards";
import UserRow from "@amitkk/basic/static/UserRow";
import { UserRowProps } from "@amitkk/basic/types/user";
import SkuCardList from "../../static/SkuCardList";
import MetaTableInput from "@amitkk/components/admin/meta-table-input";
import AdminRowActions from "@amitkk/components/admin/AdminRowActions";
import { ActionCell } from "@amitkk/components/basic/ActionCell";

type Props = {
  row: SingleProductItemProps;
};

export function AdminDataTable({ row }: Props) {
  return (
    <tr className="border-b border-border hover:bg-muted/30 transition-colors align-top text-sm">
      <td className="p-3 min-w-[200px]">
        <Link href={`/${row.url}`} target="_blank" className="font-semibold text-primary hover:underline block">{row.name}</Link>
        <span className="text-xs text-muted-foreground break-all block mt-0.5">{row.url}</span>
        <div className="mt-1.5"><ProductFilterBadges filter={row.filter as ProductFilterProps} /></div>
        <MediaCards items={row.mediaHubs} height={45} width={55} />
      </td>
      <td className="p-3 min-w-[160px]"><UserRow row={row.seller_id as unknown as UserRowProps} /></td>

      <td className="p-3 min-w-[240px]">
        <div className="space-y-1.5">
          {["Type", "Category", "Tag"].map((module) => (
            <MetaRow key={module} label={module} items={row.metas?.filter((m) => m.module === module)} basePath="/products/meta"/>
          ))}
          <MetaRow label="Brands" items={row.brands} basePath="/products/brand" />
          {["Storage"].map((module) => (
            <MetaRow key={module} label={module} items={row.features?.filter((m) => m.module === module)} basePath="/products/feature"/>
          ))}
          <MetaRow label="Ingridients" items={row.ingridients}/>
          <MetaTableInput meta={row.meta_id}/>
        </div>
      </td>

      <td className="p-3 min-w-[180px]">
        <SkuCardList skus={row.sku ?? []} />
      </td>

      <ActionCell row={row} modelName="Product" usePopover/>

      <AdminRowActions id={row._id.toString()} actions={[
        { label: "Edit", href: `/admin/add-update-product/${row._id}` },
        { label: "Preview", href: `/admin-preview/product/${row.url}` },
        { label: "FAQ", href: `/admin/faqs/Product/${row._id}` },
        { label: "Testimonial", href: `/admin/testimonials/Product/${row._id}` },
      ]}/>
    </tr>
  );
}