export type TaxProps = {
  _id: string;
  name: string;
  rate: string;
  status: boolean;
  displayOrder: number | null;
  createdAt: Date;
  updatedAt: Date;
}

export type TaxCollectedProps = {
  _id: string;
  module: string;
  module_id: string;
  tax_id: string | TaxProps;
  tax_rate: string;
  price: number;
  quantity: number;
  admin_discount?: number;
  seller_discount?: number;
  cgst?: number;
  sgst?: number;
  igst?: number;
  total?: number;
  createdAt: Date;
  updatedAt: Date;
}

export type SiteSettingProps = {
  _id: string;
  module: string;
  module_value: string;
  status: boolean;
  createdAt: Date;
  updatedAt: Date;
}