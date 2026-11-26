"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useFilterContext } from "contexts/FilterContext";
import { apiRequest, clo } from "../my-utils/admin-utils";
import { getFilterFieldMeta } from "../filters";
import OpenSelect from "@amitkk/components/basic/OpenSelect";

const SELLER_LABEL = "Seller";
const SELLER_ROLE = ["Seller"];
const SELLER_FILTER_KEY = "seller_id";

interface SellerOption {
  _id: string;
  name?: string;
  email?: string;
  phone?: string;
}

export interface FetchSellersPayload {
  role?: string | string[];
  search?: string;
  selected_id?: string;
  limit?: number;
}

export const fetchSellerOptions = async (payload: FetchSellersPayload) => {
  const res = await apiRequest("POST", "basic/spatie?function=get_user_options", payload);
  return res?.data ?? [];
};

export default function SellerFilter() {
  const { filters, setFilter } = useFilterContext();
  const filterConfig = {
    name: "SellerFilter",
    props: {
      label: SELLER_LABEL,
      role: SELLER_ROLE,
      filterKey: SELLER_FILTER_KEY,
    },
  };

  const { field } = getFilterFieldMeta(filterConfig);
  const resolvedField = field || SELLER_FILTER_KEY;
  const selectedValue = String(filters[resolvedField] || filters[SELLER_FILTER_KEY] || "");

  const [sellers, setSellers] = useState<SellerOption[]>([]);
  const [selectedSellerDoc, setSelectedSellerDoc] = useState<SellerOption | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  const loadSellers = useCallback(
    async (searchQuery: string) => {
      setLoading(true);
      try {
        const result = await fetchSellerOptions({
          role: SELLER_ROLE,
          search: searchQuery,
          selected_id: selectedValue || undefined,
          limit: 20,
        });
        const fetchedSellers: SellerOption[] = Array.isArray(result) ? result : [];
        setSellers(fetchedSellers);

        if (selectedValue) {
          const match = fetchedSellers.find((s) => String(s._id) === selectedValue);
          if (match) setSelectedSellerDoc(match);
        }
      } catch (error) {
        clo(error);
        setSellers([]);
      } finally {
        setLoading(false);
      }
    },
    [selectedValue]
  );

  useEffect(() => {
    loadSellers("");
  }, [loadSellers]);

  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, []);

  const handleSearchChange = (query: string) => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      loadSellers(query);
    }, 300);
  };

  const combinedSellers = [...sellers];
  if (
    selectedValue &&
    selectedSellerDoc &&
    !combinedSellers.some((s) => String(s._id) === selectedValue)
  ) {
    combinedSellers.unshift(selectedSellerDoc);
  }

  const options = combinedSellers.map((s) => {
    const contactInfo = s.email || s.phone;
    return {
      label: s.name
        ? `${s.name}${contactInfo ? ` (${contactInfo})` : ""}`
        : contactInfo || "Unknown Seller",
      value: s._id,
    };
  });

  return (
    <OpenSelect
      name={resolvedField}
      label={SELLER_LABEL}
      showLabel={false}
      value={selectedValue}
      placeholder={loading && sellers.length === 0 ? "Loading..." : `All ${SELLER_LABEL}s`}
      onChange={(val: any) => {
        setFilter("SellerFilter", val, filterConfig.props);
        if (!val) setSelectedSellerDoc(null);
      }}
      onSearchChange={handleSearchChange}
      options={options}
      disabled={loading && sellers.length === 0}
    />
  );
}