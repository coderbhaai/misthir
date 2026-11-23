"use client"

import React from "react";
import { useState, useEffect, useCallback } from "react";
import { apiRequest, clo, hitToastr } from "@amitkk/basic/utils/my-utils/admin-utils";
import StatusSelect from "@amitkk/components/admin/status-input";
import { useUserAccess } from "hooks/useUserSpatie";
import { CouponProps } from "@amitkk/coupon/types";
import { useRouter } from "next/router";
import { MediaProps } from "@amitkk/basic/types/media";
import MediaImage from "@amitkk/components/admin/table-image";
import ImageUpload from "@amitkk/components/admin/file-input";
import { useFormHandler } from "hooks/useFormHandler";
import { TextField } from "@amitkk/components/basic/TextField";
import { Button } from "@amitkk/components/button/button";
import { Textarea } from "@amitkk/components/basic/textarea";
import OpenSelect from "@amitkk/components/basic/OpenSelect";
import SingleUserDropdown from "@amitkk/basic/admin/spatie/SingleUserDropdown";
import MultiSelectDropdown from "@amitkk/components/admin/multiselect-dropdown";
import { SimpleTargetRow } from "../static/SimpleTargetRow";

interface DataFormProps {
    dataId?: string;
    seller_id?: string;
    coupon_by?: string;
}

interface TargetSelection {
    id: string;
    quantity: number;
}

const AddUpdateCouponForm: React.FC<DataFormProps> = ({ dataId = "", seller_id = "", coupon_by= "" }) => {
    const [loading, setLoading] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const today = new Date();
    const plus30 = new Date();
    plus30.setDate(today.getDate() + 30);
    const formatDate = (d: string | Date) => { if (!d) return ""; const date = new Date(d); return date.toISOString().split("T")[0]; };

    const [formData, setFormData] = React.useState<CouponProps>({
        _id: '',
        seller_id: seller_id,
        coupon_by: coupon_by,
        usage_type: '',
        discount_type: '',
        discount : 0,
        name: '',
        coupon_code: '',
        sales: '',
        status: true,
        valid_from: formatDate(today),
        valid_to: formatDate(plus30),
        buy_one: '',
        description: '',
        media: '',
        media_id: '',
        createdAt: new Date(),
        updatedAt: new Date(),
    });

    const usage_type_options = [ "Single Usage", "Multi Usage", "Specific Users", "Buy One Get One"];
    const [image, setImage] = useState<File | null>(null);
    const [imageError, setImageError] = useState<string | null>(null);
    const { hasAnyRole, hasPermission } = useUserAccess();
    const router = useRouter();

    const handleChange = useFormHandler(setFormData);
    const [searchTerm, setSearchTerm] = useState("");
    const [applicableOn, setApplicableOn] = React.useState<string[]>([]);    
    const [selectedTargets, setSelectedTargets] = useState<TargetSelection[]>([]);
    
    const [productsData, setProductsData] = useState<any[]>([]);
    const [productBrandsData, setProductBrandsData] = useState<any[]>([]);
    const [productTypesData, setProductTypesData] = useState<any[]>([]);

    useEffect(() => {
        const fetchTargetOptions = async () => {
            if (!applicableOn.length) { 
                setProductsData([]);
                setProductBrandsData([]);
                setProductTypesData([]);
                return; 
            }

            try {
                const res = await apiRequest("POST", `ecom/coupon`, {
                    function: "get_target_options",
                    module: applicableOn,
                    seller_id: formData.seller_id,
                    search: searchTerm,
                    selected_ids: selectedTargets.map(t => t.id)
                });

                const { products = [], productBrands = [], productTypes = [] } = res?.data || {};
                setProductsData(products);
                setProductBrandsData(productBrands);
                setProductTypesData(productTypes);
            } catch (error) { clo(error); }
        };

        fetchTargetOptions();
    }, [applicableOn, formData.seller_id]);

    const fetchSingleEntry = useCallback(async () => {
        if (!dataId) return;

        try {            
            const res = await apiRequest("GET", `ecom/coupon?function=get_single_coupon&id=${dataId}`);
            
            if (res?.data) {
                setFormData({
                    _id: res?.data?.entry?.id,
                    seller_id: res?.data?.entry?.seller_id?._id || '',
                    coupon_by: res?.data?.entry?.coupon_by || "",
                    usage_type: res?.data?.entry?.usage_type || "",
                    discount_type: res?.data?.entry?.discount_type || '',
                    discount: res?.data?.entry?.discount || 0,
                    name: res?.data?.entry?.name || "",
                    coupon_code: res?.data?.entry?.coupon_code || "",
                    sales: res?.data?.entry?.sales || "",
                    status: res?.data?.entry?.status || true,
                    valid_from: formatDate(res?.data?.entry?.valid_from),
                    valid_to: formatDate(res?.data?.entry?.valid_to),
                    buy_one: res?.data?.entry?.buy_one?._id || "",
                    media_id: res?.data?.entry?.media_id?._id || "",
                    media: res?.data?.entry?.media_id,
                    description: res?.data?.entry?.description || '',
                    createdAt: res?.data?.entry?.createdAt,
                    updatedAt: res?.data?.entry?.updatedAt,
                });

                if (res?.data?.targets && Array.isArray(res?.data?.targets)) {
                    const normalizedModules = res.data.targets.map((t: any) => t.module === "Sku" ? "Product" : t.module);                    
                    const uniqueModules = Array.from(new Set(normalizedModules));
                    setApplicableOn(uniqueModules as string[]);
                    setSelectedTargets( res.data.targets.map((t: any) => ({ id: t.module_id, quantity: t.quantity ?? 1 })) );
                }
            }
        } catch (error) { clo( error ); }
    }, [dataId, seller_id]);

    useEffect(() => { fetchSingleEntry(); }, [dataId, seller_id, fetchSingleEntry]);

    const handleTargetToggle = (id: string, subIds: string[] = []) => {
        setSelectedTargets(prev => {
            const allIdsToCheck = [id, ...subIds];
            const isCurrentlySelected = prev.some(item => item.id === id);

            if (isCurrentlySelected) {
                return prev.filter(item => !allIdsToCheck.includes(item.id));
            } else {
                const existingIds = new Set(prev.map(item => item.id));
                const additions: TargetSelection[] = allIdsToCheck.filter(targetId => !existingIds.has(targetId)).map(targetId => ({ id: targetId, quantity: 1 }));
                return [...prev, ...additions];
            }
        });
    };

    const handleQuantityChange = (id: string, qty: number) => { setSelectedTargets(prev => prev.map(item => item.id === id ? { ...item, quantity: Math.max(1, qty) } : item) ); };

    const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setIsSubmitting(true);

        try {
            const formDataToSend = new FormData();
            formDataToSend.append("function", "create_update_coupon");
            formDataToSend.append("seller_id", formData.seller_id as string);
            formDataToSend.append("path", "coupon");
            formDataToSend.append("_id", formData._id as string);
            formDataToSend.append("coupon_by", formData.coupon_by);
            formDataToSend.append("usage_type", formData.usage_type);
            formDataToSend.append("discount_type", formData.discount_type);
            formDataToSend.append("discount", String( formData.discount ));
            formDataToSend.append("name", formData.name);
            formDataToSend.append("coupon_code", formData.coupon_code);
            formDataToSend.append("sales", String(formData.sales));
            formDataToSend.append("status", String(formData.status));
            formDataToSend.append("valid_from", formatDate(formData.valid_from) );
            formDataToSend.append("valid_to", formatDate(formData.valid_to) );
            formDataToSend.append("buy_one", formData.buy_one as string);
            formDataToSend.append("description", String(formData.description));

            const formattedTargets = selectedTargets.map((target) => {
                let moduleType = "Product"; 
                if (productBrandsData.some(b => (b._id || b.id) === target.id)) {
                    moduleType = "ProductBrand"; 
                } else if (productTypesData.some(t => (t._id || t.id) === target.id)) {
                    moduleType = "ProductType";
                } else {
                    const isSku = productsData.some(product => (product.sku || product.skus || []).some((s: any) => (s._id || s.id) === target.id));
                    moduleType = isSku ? "Sku" : "Product";
                }

                return { 
                    module_id: target.id, 
                    module: moduleType, 
                    quantity: target.quantity 
                };
            });

            formDataToSend.append("selected_targets", JSON.stringify(formattedTargets));

            const mediaIdToSend = formData.media_id && typeof formData.media_id === "object" && "_id" in formData.media_id ? String((formData.media_id as MediaProps)._id) : typeof formData.media_id === "string" && formData.media_id !== "null" ? formData.media_id : "";
            formDataToSend.append("media_id", mediaIdToSend);
            if (image) { formDataToSend.append("image", image); }

            const res = await apiRequest("POST", `ecom/coupon`, formDataToSend);

            hitToastr('success', res?.message);
            
            if (hasAnyRole(["Seller", "Seller Staff"])) {
                router.replace(`/seller/add-update-coupon/${res.data._id}`);
            } else {
                router.replace(`/admin/add-update-coupon/${res.data._id}`);
            }
        } catch (error) { clo( error ); } finally { setIsSubmitting(false); }
    };

    const title = !dataId ? 'Add Coupon' : 'Update Coupon';

    return(
        <>
            <p>{title}</p>
            
            <form onSubmit={handleSubmit} style={{ padding: "10px" }} className="space-y-4">
                <div className="grid grid-cols-1 gap-5 lg:grid-cols-4">
                    <OpenSelect name={String(formData.coupon_by)} label="Coupon By" value={formData.coupon_by} onChange={(value) => setFormData((prev) => ({...prev, coupon_by: value}))} options={["Seller", "Admin"].map((mod) => ({ label: mod, value: mod }))}/>
                    <SingleUserDropdown value={String(formData.seller_id)} onChange={(val) => handleChange("seller_id", val)} filters={{ role: ["Seller"] }}/>
                    <TextField type="text" label="Name" name="name" value={formData.name} onChange={handleChange} required/>
                    <TextField type="text" label="Code" name="coupon_code" value={formData.coupon_code} onChange={handleChange} required/>
                    <StatusSelect value={formData.status} onChange={(value) => handleChange("status", value)}/>
                    <OpenSelect name={String(formData.usage_type)} label="Usage Type" value={formData.usage_type} onChange={(value) => setFormData((prev) => ({...prev, usage_type: value}))} options={usage_type_options.map((mod) => ({ label: mod, value: mod }))}/>
                    <TextField type="date" label="Valid From" name="valid_from" value={String(formData.valid_from)} onChange={handleChange} required/>
                    <TextField type="date" label="Valid To" name="valid_to" value={String(formData.valid_to)} onChange={handleChange} required/>
                    <MultiSelectDropdown label="Applicable On" selected={applicableOn} onChange={(selectedIds) => setApplicableOn(selectedIds)} options={[ { _id: "Product", name: "Product" }, { _id: "ProductBrand", name: "ProductBrand" }, { _id: "ProductType", name: "ProductType" } ]}/>
                    <TextField type="Number" label="Sales" name="sales" value={formData.sales} onChange={handleChange} required/>
                    <OpenSelect name={String(formData.discount_type)} label="Discount Type" value={formData.discount_type} onChange={(value) => setFormData((prev) => ({...prev, discount_type: value}))} options={["Amount Based", "Percent Based"].map((mod) => ({ label: mod, value: mod }))}/>
                    <TextField type="number" label={`Discount (${formData.discount_type === "Amount Based" ? "₹" : "%"})`} name="discount" value={formData.discount} onChange={handleChange} required/>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px", gridColumn: "span 1" }}>
                        <MediaImage media={formData.media as MediaProps}/>
                        <ImageUpload name="image" required={!formData.media_id} error={imageError} onChange={(_, file) => { setImage(file); }}/>
                    </div>
                </div>
                <Textarea label="Description" value={formData.description} name="description" onChange={handleChange} rows={2}/>

                {applicableOn.length > 0 && (productBrandsData.length > 0 || productTypesData.length > 0 || productsData.length > 0) && (
                    <div className="mt-6 border rounded-xl p-4 bg-gray-50/50 space-y-4">
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                            <h3 className="text-sm font-medium text-gray-700">Select Target Options & SKUs</h3>
                            
                            <div className="flex items-center gap-2 w-full sm:w-auto">
                                <input type="text" placeholder="Search targets..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="px-3 py-1.5 text-xs rounded-lg border bg-white shadow-sm focus:outline-none focus:ring-1 focus:ring-primary w-full sm:w-64"/>

                                <button type="button" className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-white shadow-sm transition hover:opacity-90 whitespace-nowrap"
                                    onClick={() => {
                                        const allIds: string[] = [];
                                        productBrandsData.forEach((item: any) => allIds.push(item._id || item.id));
                                        productTypesData.forEach((item: any) => allIds.push(item._id || item.id));
                                        productsData.forEach((item: any) => {
                                            allIds.push(item._id || item.id);
                                            if (item.sku && Array.isArray(item.sku)) { item.sku.forEach((s: any) => allIds.push(s._id || s.id)); }
                                            if (item.skus && Array.isArray(item.skus)) { item.skus.forEach((s: any) => allIds.push(s._id || s.id)); }
                                        });

                                        setSelectedTargets(prev => {
                                            const existingIds = new Set(prev.map(t => t.id));
                                            const newAdditions = allIds.filter(id => !existingIds.has(id)).map(id => ({ id, quantity: 1 }));
                                            return [...prev, ...newAdditions];
                                        });
                                    }}>
                                    Select All Visible
                                </button>
                            </div>
                        </div>

                        <div className="max-h-96 overflow-y-auto rounded-lg border bg-white shadow-sm">
                            <table className="w-full text-left text-sm text-gray-600">
                                <thead className="bg-gray-100 text-xs uppercase text-gray-700 sticky top-0">
                                    <tr>
                                        <th className="p-3">Select</th>
                                        <th className="p-3">Target Name</th>
                                        <th className="p-3">Quantity</th>
                                        <th className="p-3">Details / SKUs</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200">
                                    {productBrandsData.map((item: any) => (
                                        <SimpleTargetRow key={item._id || item.id} item={item} typeLabel="Brand" selectedTargets={selectedTargets} onToggle={handleTargetToggle}onQuantityChange={handleQuantityChange}/>
                                    ))}
                                    {productTypesData.map((item: any) => (
                                        <SimpleTargetRow key={item._id || item.id} item={item} typeLabel="Type" selectedTargets={selectedTargets} onToggle={handleTargetToggle}onQuantityChange={handleQuantityChange}/>
                                    ))}

                                    {productsData.map((item: any) => {
                                        const productId = item._id || item.id;
                                        const productTarget = selectedTargets.find(t => t.id === productId);
                                        const isProductSelected = !!productTarget;
                                        const skuList = item.sku || item.skus || [];
                                        const skuIds = skuList.map((s: any) => s._id || s.id);
                                        
                                        return (
                                            <React.Fragment key={productId}>
                                                <tr className="hover:bg-gray-50 font-medium">
                                                    <td className="p-3">
                                                        <input className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary" type="checkbox" checked={isProductSelected} onChange={() => handleTargetToggle(productId, skuIds)}/>
                                                    </td>
                                                    <td className="p-3 text-gray-900">{item.name} <span className="text-xs text-gray-400 font-normal">(Product)</span></td>
                                                    <td className="p-3">
                                                        {isProductSelected && (
                                                            <input type="number" min="1" value={productTarget?.quantity ?? 1} onChange={(e) => handleQuantityChange(productId, parseInt(e.target.value) || 1)} className="w-16 px-2 py-1 text-xs border rounded focus:ring-1 focus:ring-primary"/>
                                                        )}
                                                    </td>
                                                    <td className="p-3 text-xs text-gray-500">{skuList.length ? `${skuList.length} SKU(s) available` : 'N/A'}</td>
                                                </tr>
                                                
                                                {skuList.map((skuItem: any) => {
                                                    const skuId = skuItem._id || skuItem.id;
                                                    const skuTarget = selectedTargets.find(t => t.id === skuId);
                                                    const isSkuSelected = !!skuTarget;

                                                    return (
                                                        <tr key={skuId} className="bg-gray-50/50 hover:bg-gray-100/50 text-xs">
                                                            <td className="p-3 pl-8">
                                                                <input type="checkbox" className="h-3.5 w-3.5 rounded border-gray-300 text-primary focus:ring-primary" checked={isSkuSelected} onChange={() => handleTargetToggle(skuId)}/>
                                                            </td>
                                                            <td className="p-3 text-gray-600 pl-6">└─ SKU: {skuItem.name || skuItem.sku || skuId}</td>
                                                            <td className="p-3">
                                                                {isSkuSelected && (
                                                                    <input type="number" min="1" value={skuTarget?.quantity ?? 1} onChange={(e) => handleQuantityChange(skuId, parseInt(e.target.value) || 1)} className="w-16 px-2 py-1 text-xs border rounded focus:ring-1 focus:ring-primary"/>
                                                                )}
                                                            </td>
                                                            <td className="p-3 text-gray-500">Price: ₹{skuItem.price || 0}</td>
                                                        </tr>
                                                    );
                                                })}
                                            </React.Fragment>
                                        );
                                    })}

                                    {productBrandsData.length === 0 && productTypesData.length === 0 && productsData.length === 0 && (
                                        <tr><td colSpan={4} className="p-6 text-center text-gray-400 text-xs">No matching targets found.</td></tr>
                                    )}

                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                <Button type="submit" color="primary" disabled={isSubmitting}>{title}</Button>
            </form>
        </>
    )
}

export default AddUpdateCouponForm;