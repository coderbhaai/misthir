import mongoose from "mongoose";
import Blog from "lib/models/blog/Blog";
import Author from "lib/models/blog/Author";
import Blogmeta from "lib/models/blog/Blogmeta";
import BlogBlogmeta from "lib/models/blog/BlogBlogmeta";

import GenericBlock from "./block/GenericBlock";
import TabBlock from "./block/TabBlock";
import BlockQuote from "./block/BlockQuote";
import BlockDetail from "./block/BlockDetail";

import ExcelUpload from "./excel/ExcelUpload";
import MetaTemp from "./excel/MetaTemp";

import Achievement from "lib/models/basic/Achievement";
import Action from "lib/models/basic/Action";
import AuditLog from "lib/models/basic/AuditLog";
import Client from "lib/models/basic/Client";
import CommentModel from "lib/models/basic/Comment";
import Contact from "lib/models/basic/Contact";
import Faq from "lib/models/basic/Faq";
import Media from "lib/models/basic/Media";
import MediaHub from "lib/models/basic/MediaHub";
import Meta from "lib/models/basic/Meta";
import Page from "lib/models/basic/Page";
import PageDetail from "lib/models/basic/PageDetail";
import Review from "lib/models/basic/Review";
import Testimonial from "lib/models/basic/Testimonial";
import { Search, SearchResult } from "lib/models/basic/Search";
import UserBrowsingHistory from "lib/models/basic/UserBrowsingHistory";
import ShortCode from "./basic/ShortCode";
import ShortCodeDetail from "./basic/ShortCodeDetail";
import Cta from "./basic/Cta";
import CtaCounter from "./basic/CtaCounter";
import UrlRegistry from "./basic/UrlRegistry";
import Keyword from "./basic/Keyword";

import User from "lib/models/spatie/User";
import Otp from "lib/models/spatie/Otp";
import RolePermission from "lib/models/spatie/RolePermission";
import Menu from "lib/models/spatie/Menu";
import SpatiePermission from "lib/models/spatie/SpatiePermission";
import SpatieRole from "lib/models/spatie/SpatieRole";
import UserPermission from "lib/models/spatie/UserPermission";
import UserRole from "lib/models/spatie/UserRole";

import BankDetail from "./product/BankDetail";
import Commission from "./product/Commission";
import Documentation from "./product/Documentation";
import Ingridient from "./product/Ingridient";
import Product from "./product/Product";
import ProductFilter from "./product/ProductFilter";
import ProductBrand from "./product/ProductBrand";
import ProductFeature from "./product/ProductFeature";
import ProductIngridient from "./product/ProductIngridient";
import Productmeta from "./product/Productmeta";
import ProductSpecification from "./product/ProductSpecification";
import ProductProductBrand from "./product/ProductProductBrand";
import ProductProductFeature from "./product/ProductProductFeature";
import ProductProductmeta from "./product/ProductProductmeta";
import ProductProductSpecification from "./product/ProductProductSpecification";
import Sku from "./product/Sku";
import SkuDetail from "./product/SkuDetail";
import SkuProductFeature from "./product/SkuProductFeature";
import Seller from "./product/Seller";

import Address from "./address/Address";
import City from "./address/City";
import Country from "./address/Country";
import State from "./address/State";

import BulkOrder from "./ecom/BulkOrder";
import BuyOneGetOne from "./ecom/BuyOneGetOne";
import Cart from "./ecom/Cart";
import CartConsent from "./ecom/CartConsent";
import CartSku from "./ecom/CartSku";
import CartCharges from "./ecom/CartCharges";
import CartSkuDetail from "./ecom/CartSkuDetail";
import CartSkuDiscount from "./ecom/CartSkuDiscount";
import Order from "./ecom/Order";
import OrderCharges from "./ecom/OrderCharges";
import OrderConsent from "./ecom/OrderConsent";
import OrderOrderConsent from "./ecom/OrderOrderConsent";
import OrderSku from "./ecom/OrderSku";
import OrderSkuDetail from "./ecom/OrderSkuDetail";
import OrderSkuDiscount from "./ecom/OrderSkuDiscount";
import SellerServiceArea from "./seller/SellerServiceArea";

import SiteSetting from "./payment/SiteSetting";
import RazorpayPayment from "./payment/RazorpayPayment";

import Tax from "./tax/Tax";
import TaxCollected from "./tax/TaxCollected";
import TaxCollectedSummary from "./tax/TaxCollectedSummary";

import Coupon from "./coupon/Coupon";
import CouponTarget from "./coupon/CouponTarget";
import CartCoupon from "./coupon/CartCoupon";
import OrderCoupon from "./coupon/OrderCoupon";
import CouponUsageLog from "./coupon/CouponUsageLog";

import Sale from "./sales/Sale";
import SaleTarget from "./sales/SaleTarget";
import SaleUpsell from "./sales/SaleUpsell";

import Wishlist from "./wishlist/Wishlist";
import WishlistCart from "./wishlist/WishlistCart";
import OrderGuide from "./wishlist/OrderGuide";
import OrderGuideProducts from "./wishlist/OrderGuideProducts";

import { auditLoggerPlugin } from "lib/server/plugins/auditLogger";

import CartSellerCharges from "./seller/CartSellerCharges";
import OrderSellerCharges from "./seller/OrderSellerCharges";
import Payment from "./seller/Payment";
import SellerIncome from "./seller/SellerIncome";
import SellerIncomeSellerPayoutRequest from "./seller/SellerIncomeSellerPayoutRequest";
import SellerPayoutRequest from "./seller/SellerPayoutRequest";
import SellerSiteSetting from "./seller/SellerSiteSetting";

const rawModels: Record<string, any> = {
 // Refrences
  User, Media, MediaHub,

  Review,
  // Blog
  Blog, Author, Blogmeta, BlogBlogmeta,

  // Excel
  ExcelUpload, MetaTemp,

  // Basic
  Action, Achievement, AuditLog, Client, CommentModel, Contact, Faq, Meta, Page, PageDetail, ...Search, ...SearchResult, Testimonial, UserBrowsingHistory, Keyword, ShortCode, ShortCodeDetail, Cta, CtaCounter, UrlRegistry, 

  // Spatie
   Otp, SpatieRole, SpatiePermission, RolePermission, UserRole, UserPermission, Menu, 

  // Address
  Address, City, Country, State,

  // Ecom
  BulkOrder, BuyOneGetOne, Cart, CartConsent, CartSku, CartCharges, CartSkuDetail, CartSkuDiscount, Order, OrderCharges, OrderConsent, OrderOrderConsent, OrderSku, OrderSkuDetail, OrderSkuDiscount, SellerServiceArea,

  // Product
  BankDetail, Commission, Documentation, Ingridient, Product, ProductBrand, ProductFeature, ProductIngridient, Productmeta, ProductSpecification, ProductProductBrand, ProductProductFeature, ProductProductmeta, ProductProductSpecification, Sku, SkuDetail, SkuProductFeature, Seller, ProductFilter, 

  // Payment
  SiteSetting, RazorpayPayment,

  // Tax
  Tax, TaxCollected, TaxCollectedSummary, 

  // Block
  GenericBlock, TabBlock, BlockQuote, BlockDetail, 

  // Coupon
  Coupon, CartCoupon, OrderCoupon, CouponTarget, CouponUsageLog, 

  // Sales
  Sale, SaleTarget, SaleUpsell, 

  // Wishlist
  WishlistCart, Wishlist, OrderGuideProducts, OrderGuide, 

  // Seller
  CartSellerCharges, OrderSellerCharges, Payment, SellerIncome, SellerIncomeSellerPayoutRequest, SellerPayoutRequest, SellerSiteSetting, 
};

export type AnyModel = mongoose.Model<any, any, any, any, any, any>;

const models: Record<string, AnyModel> = {};

function isModel(obj: any): obj is AnyModel {
  return !!(obj?.schema && typeof obj.init === "function");
}

Object.entries(rawModels).forEach(([name, model]) => {
  if (!isModel(model)) return;
  if (!model.schema.statics.auditLog) auditLoggerPlugin(model.schema);

  const compiledModel = mongoose.models[name] || mongoose.model(name, model.schema);  
  models[name] = compiledModel;
});

const finalCheck: Record<string, { auditLog: boolean }> = {};
Object.entries(models).forEach(([name, model]) => {
  finalCheck[name] = {
    auditLog: typeof (model.schema.statics as any).auditLog === "function",
  };
});

export default models;