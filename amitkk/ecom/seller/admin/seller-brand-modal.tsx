"use client";

import * as React from "react";
import type { DataProps } from "@amitkk/ecom/admin/product/admin-product-brand-table";
import { useState } from "react";
import ImageUpload from "@amitkk/components/admin/file-input";
import MediaImage from "@amitkk/components/admin/table-image";
import CustomModal from "@amitkk/basic/static/CustomModal";
import { useFormHandler } from "hooks/useFormHandler";
import { apiRequest, clo, hitToastr, TableDataFormProps } from "@amitkk/basic/utils/my-utils/admin-utils";
import { MediaProps } from "@amitkk/basic/types/media";
import { TextField } from "@amitkk/components/basic/TextField";
import StickyFormFooter from "@amitkk/components/ui/StickyFormFooter";
import StatusSelect from "@amitkk/components/admin/status-input";
import { getSellerId } from "@amitkk/basic/utils/my-utils/ecom-utils";

type DataFormProps = TableDataFormProps & {
  handleUpdate: () => Promise<void>;
};

export default function DataModal({ open, handleClose, selectedDataId, handleUpdate }: DataFormProps) {
  const initialFormData: DataProps = {
    seller_id: "",
    name: "",
    url: "",
    status: true,
    displayOrder: null,
    content: "",
    createdAt: new Date(),
    updatedAt: new Date(),
    media_id: "",
    _id: "",
    meta_id: "",
    title: "",
    description: "",
  };

  const [formData, setFormData] = React.useState<DataProps>(initialFormData);
  const [content, setContent] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);

  const handleChange = useFormHandler(setFormData);

  const handleCloseModal = () => {
    setFormData(initialFormData);
    setContent("");
    setImage(null);
    setImageError(null);
    handleClose();
  };

  React.useEffect(() => {
    if (!open) return;

    let isMounted = true;

    const loadModalData = async () => {
      try {
        const sellerRes = await getSellerId();
        if (!isMounted) return;
        if (sellerRes.error) { hitToastr("error", sellerRes.error.message); }

        const resolvedTokenSellerId = sellerRes.seller_id ?? "";

        if (selectedDataId) {
          const res = await apiRequest("GET", `ecom/basic?function=get_single_product_brand&id=${selectedDataId}`);
          if (!isMounted) return;

          const brandSellerId = typeof res?.data?.seller_id === "object" ? res?.data?.seller_id?._id || "" : res?.data?.seller_id || "";

          setFormData({
            name: res?.data?.name || "",
            url: res?.data?.url || "",
            content: res?.data?.content || "",
            status: res?.data?.status ?? true,
            displayOrder: res?.data?.displayOrder ?? null,
            createdAt: res?.data?.createdAt || new Date(),
            updatedAt: new Date(),
            media_id: res?.data?.media_id || "",
            _id: res?.data?._id || "",
            meta_id: res?.data?.meta_id?._id || "",
            title: res?.data?.meta_id?.title || "",
            description: res?.data?.meta_id?.description || "",
            seller_id: resolvedTokenSellerId || brandSellerId,
          });

          setContent(res?.data?.content || "");
        } else {
          setFormData({ ...initialFormData, seller_id: resolvedTokenSellerId });
          setContent("");
        }
      } catch (error) { clo(error); }
    };

    loadModalData();

    return () => { isMounted = false; };
  }, [open, selectedDataId]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    try {
      const formDataToSend = new FormData();
      formDataToSend.append("function", "create_update_product_brand");

      const sellerIdToSend =
        typeof formData.seller_id === "object" && formData.seller_id && "_id" in formData.seller_id
          ? String((formData.seller_id as { _id?: string })._id ?? "")
          : formData.seller_id && formData.seller_id !== "null" && formData.seller_id !== "undefined"
            ? String(formData.seller_id)
            : "";

      if (sellerIdToSend) {
        formDataToSend.append("seller_id", sellerIdToSend);
      }

      formDataToSend.append("name", formData.name);
      formDataToSend.append("url", formData.url);
      formDataToSend.append("status", String(formData.status));
      formDataToSend.append("content", content);
      formDataToSend.append("path", "product");

      const mediaIdToSend =
        formData.media_id && typeof formData.media_id === "object" && "_id" in formData.media_id
          ? String((formData.media_id as MediaProps)._id)
          : typeof formData.media_id === "string" && formData.media_id !== "null"
            ? formData.media_id
            : "";
      formDataToSend.append("media_id", mediaIdToSend);

      if (selectedDataId) { formDataToSend.append("_id", String(selectedDataId)); }
      if (image) { formDataToSend.append("image", image); }

      formDataToSend.append("title", formData.title?.toString() ?? "");
      formDataToSend.append("description", formData.description?.toString() ?? "");
      formDataToSend.append( "meta_id", typeof formData.meta_id === "string" ? formData.meta_id : (formData.meta_id as { meta_id?: string })?.meta_id?.toString() ?? "");

      const res = await apiRequest("POST", "ecom/basic", formDataToSend);

      if (res?.data) {
        handleCloseModal();
        await handleUpdate();
        hitToastr("success", res?.message);
      }
    } catch (error) {
      clo(error);
    }
  };

  const title = !selectedDataId ? "Add Brand" : "Update Brand";

  return (
    <CustomModal open={open} handleClose={handleCloseModal} title={title}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <TextField label="Brand Name" value={formData.name} name="name" onChange={handleChange} required />
        <StatusSelect value={formData.status} onChange={(value) => handleChange("status", value)} />
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <MediaImage media={formData.media_id as MediaProps} style={{ marginRight: "10px", width: "120px", height: "70px" }}/>
          <ImageUpload name="image" label="Upload Image" required={!selectedDataId} error={imageError} onChange={(_name, file) => { setImage(file); setImageError(null); }}/>
        </div>
        <StickyFormFooter title={title} />
      </form>
    </CustomModal>
  );
}