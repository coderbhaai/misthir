import { apiRequest, clo, hitToastr } from "@amitkk/basic/utils/my-utils/admin-utils";
import { OrderProps } from "@amitkk/ecom/types";
import router from "next/router";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { fullAddress } from "@amitkk/address/utils/addressUtils";
import { UserProps } from "@amitkk/basic/types/user";

export type PaymentData = {
  amount: number;
  currency?: string;
  description: string;
  name: string;
  email: string;
  phone: string;
  callbackUrl: string;
};

export type PaymentGatewayName = 'razorpay' | 'phonepe' | 'mpesa';

export const makePayment = async ({ module, module_id }: { module: string; module_id: string }) => {
  try{
    const res = await apiRequest("GET", `payment/payment?function=get_all_settings`);
    if( !res?.data ){ hitToastr('errors', "Site Setting not found"); return; }

    const modeSetting = res.data.find((item: { module: string; }) => item.module === "Mode");
    const mode = modeSetting?.module_value;
    if (!mode){ hitToastr('errors', "Site Mode not found"); return; }

    const paymentGatewaySetting = res.data.find((item: { module: string; }) => item.module === "Payment Gateway");
    const paymentGateway = paymentGatewaySetting?.module_value;
    if (!paymentGateway){ hitToastr('errors', "Payment Gateway not found"); return; }

    switch (paymentGateway) {
      case "Razorpay":
        await hitRazorpay(module, module_id);
        break;
      case "PhonePe":
    //     await payWithPhonePe(module, module_id);
        break;
      default:
        throw new Error("Selected payment gateway is not supported");
    }
  }catch (err) { clo(err); }
};

declare global {
  interface Window {
    Razorpay: any;
  }
}

export const hitRazorpay = async (module: string, module_id: string) => {
  try {
    const res = await apiRequest("POST", "payment/payment", { module, module_id, payment_gateway: "Razorpay", function: "get_payment_data" });
    if( !res?.data ){ hitToastr('errors', "Module Data not found"); return; }

    const { key_id, } = getPaymentConfig();

    await loadRazorpayScript();
    let options = {};

    if( module == "Cart"){
      options = {
        key: key_id,
        amount: res.data.payable_amount * 100,
        currency: 'INR',
        name: res.data.billing_address_id?.name,
        description: "Order on Misthir",
        order_id: res?.data?.response?.order_id,
        prefill: {
          name: res.data.billing_address_id?.name,
          email: res.data.billing_address_id?.email,
          contact: res.data.billing_address_id?.phone,
        },
        theme: { color: '#f19f40' },
        handler: async (response: any) => {
          const res = await apiRequest("POST", "payment/payment", { 
            function: "payment_response",
            options,
            response, 
            module, 
            module_id, 
            payment_gateway: "Razorpay", 
            source: "Website", 
          });
          
          if( res?.data?.order_id ){
            router.push(`/order/${res?.data?.order_id}`);
          }
        },
      };
    }

    const rzp = new window.Razorpay(options);
    rzp.open();
  } catch (err) { clo(err); }
};

const loadRazorpayScript = () => {
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => reject(false);
    document.body.appendChild(script);
  });
};

export function getPaymentConfig() {
  const isProd = process.env.MODE === "Prod";
  const key_id = isProd ? process.env.NEXT_PUBLIC_RAZORPAY_KEY_PROD_ID : process.env.NEXT_PUBLIC_RAZORPAY_KEY_TEST_ID;
  return { isProd, key_id };
}

// Invoice
export interface InvoiceOptions {
  seller_id?: string;
}

function resolveId(value: unknown): string {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (typeof value === "object") {
    const obj = value as { _id?: unknown; id?: unknown; toString?: () => string };
    if (obj._id) return resolveId(obj._id);
    if (obj.id) return resolveId(obj.id);
    if (
      typeof obj.toString === "function" &&
      obj.toString !== Object.prototype.toString
    ) {
      return String(obj.toString());
    }
  }
  return String(value);
}

function toAmount(value: unknown): number {
  const num = Number(value ?? 0);
  return Number.isFinite(num) ? Number(num.toFixed(2)) : 0;
}

function formatMoney(value: unknown): string {
  return `Rs. ${toAmount(value).toFixed(2)}`;
}

function getSkuSellerId(sku: any): string {
  return (
    resolveId(sku?.seller_id) ||
    resolveId(sku?.product_id?.seller_id) ||
    resolveId(sku?.product?.seller_id)
  );
}

function getSkuUnitPrice(sku: any): number {
  const savedPrice = Number(sku?.price ?? 0);
  if (savedPrice > 0) return savedPrice;
  return Number(
    sku?.sku_id?.price ?? sku?.sku?.price ?? sku?.product_id?.price ?? 0
  );
}

function getSkuSellerDiscountPerUnit(sku: any, baseUnit: number): number {
  const discDoc = sku?.orderSkuDiscount ?? sku?.discount ?? null;
  const rate = Number(
    discDoc?.seller_discount ??
      (typeof sku?.seller_discount === "number" ? sku.seller_discount : 0)
  );
  if (!rate || rate <= 0 || baseUnit <= 0) return 0;

  const discountType =
    discDoc?.discount_type === "percent" || sku?.discount_type === "percent"
      ? "percent"
      : "flat";

  const rawPerUnit =
    discountType === "percent" ? (baseUnit * Math.min(rate, 100)) / 100 : rate;

  return toAmount(Math.min(baseUnit, Math.max(0, rawPerUnit)));
}

function getSkuDetailsText(sku: any): string {
  const rawDetails =
    sku?.details ?? sku?.orderSkuDetails ?? sku?.orderSkuDetail ?? [];
  if (Array.isArray(rawDetails) && rawDetails.length > 0) {
    const parts = rawDetails
      .map((d: any) => {
        const label = d?.label ?? d?.name ?? d?.key ?? "";
        const val = d?.value ?? d?.val ?? "";
        if (label && val) return `${label}: ${val}`;
        return String(val || label || "").trim();
      })
      .filter(Boolean);
    if (parts.length > 0) return parts.join(" | ");
  }
  return "";
}

function getOrderConsents(order: any): any[] {
  const list =
    order?.orderConsents ??
    order?.orderOrderConsents ??
    order?.orderConsent ??
    order?.orderOrderConsent ??
    [];
  return Array.isArray(list) ? list : list ? [list] : [];
}

function formatConsentLabel(consentItem: any): string {
  const consentObj =
    typeof consentItem?.consent_id === "object" &&
    consentItem?.consent_id !== null
      ? consentItem.consent_id
      : consentItem;

  const title =
    consentObj?.title ??
    consentObj?.name ??
    consentObj?.label ??
    consentItem?.title ??
    consentItem?.name ??
    "Consent";

  const accepted =
    consentItem?.accepted ??
    consentItem?.is_accepted ??
    consentItem?.agreed ??
    consentItem?.status;

  const statusText =
    typeof accepted === "boolean"
      ? accepted
        ? "Accepted"
        : "Not Accepted"
      : accepted
      ? String(accepted)
      : "Recorded";

  return `${title} (${statusText})`;
}

async function imageUrlToBase64(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { mode: "cors" });
    if (!res.ok) return null;

    const blob = await res.blob();
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    clo(error);
    return null;
  }
}

export interface InvoiceOptions {
  seller_id?: string;
}

export async function designInvoicePDF(
  doc: jsPDF,
  order: OrderProps,
  options: InvoiceOptions = {}
) {
  try {
    const anyOrder = order as any;
    const targetSellerId = options.seller_id ? String(options.seller_id) : "";
    const isScopedToSeller = Boolean(targetSellerId);

    const LIGHT_GREY: [number, number, number] = [235, 240, 250];
    const BORDER_GREY: [number, number, number] = [180, 180, 180];
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const marginX = 15;
    const rightX = pageWidth - marginX;
    const tableWidth = pageWidth - marginX * 2;

    const logoBase64 = await imageUrlToBase64("/images/logo.png");
    let textStartY = 18;
    if (logoBase64) {
      doc.addImage(logoBase64, "PNG", marginX, 12, 26, 16);
      textStartY = 16;
    }

    doc.setFont("NotoSans", "bold");
    doc.setFontSize(11);
    doc.text("Misthir", marginX + 30, textStartY);

    doc.setFont("NotoSans", "normal");
    doc.setFontSize(8.5);
    doc.text(
      ["4938 S Atlanta Rd SE", "Suite 700", "Atlanta, GA 30339-1564"],
      marginX + 30,
      textStartY + 5
    );
    doc.setFontSize(7.5);
    doc.text(
      "404-664-0856 | sales@misthir.com | www.misthir.com",
      marginX + 30,
      textStartY + 20
    );

    doc.setFont("NotoSans", "bold");
    doc.setFontSize(22);
    doc.text(
      isScopedToSeller ? "Seller Order Invoice" : "Order Confirmation",
      rightX,
      22,
      { align: "right" }
    );

    autoTable(doc, {
      startY: 28,
      margin: { left: pageWidth - 90, right: marginX },
      tableWidth: 75,
      theme: "grid",
      body: [
        ["Order No.", String(order._id)],
        ["Order Date", new Date(order.createdAt).toLocaleDateString()],
        ...(isScopedToSeller ? [["Seller ID", targetSellerId]] : []),
      ],
      styles: {
        fontSize: 8.5,
        cellPadding: 3,
        lineColor: BORDER_GREY,
        lineWidth: 0.2,
        textColor: [0, 0, 0],
      },
      columnStyles: {
        0: {
          fontStyle: "bold",
          fillColor: LIGHT_GREY,
          cellWidth: 30,
          halign: "left",
        },
        1: { cellWidth: 45, halign: "center" },
      },
    });

    let cursorY = Math.max(
      textStartY + 26,
      (doc as any).lastAutoTable.finalY + 6
    );

    const billing = order.billing_address_id
      ? fullAddress(order.billing_address_id as any)
      : "-";
    const shipping = order.shipping_address_id
      ? fullAddress(order.shipping_address_id as any)
      : "-";

    autoTable(doc, {
      startY: cursorY,
      margin: { left: marginX, right: marginX },
      tableWidth,
      theme: "grid",
      head: [["Bill To", "Ship To"]],
      body: [[billing, shipping]],
      styles: {
        fontSize: 8.5,
        cellPadding: 4,
        valign: "top",
        lineColor: BORDER_GREY,
        lineWidth: 0.2,
      },
      headStyles: {
        fillColor: LIGHT_GREY,
        textColor: [0, 0, 0],
        fontStyle: "bold",
        halign: "center",
        fontSize: 9,
      },
      columnStyles: {
        0: { cellWidth: tableWidth / 2 },
        1: { cellWidth: tableWidth / 2 },
      },
    });

    cursorY = (doc as any).lastAutoTable.finalY;

    autoTable(doc, {
      startY: cursorY,
      margin: { left: marginX, right: marginX },
      tableWidth,
      theme: "grid",
      head: [["Salesperson", "Ship Via", "Terms"]],
      body: [["Online", "Misthir", order.paymode ?? "-"]],
      styles: {
        fontSize: 8,
        cellPadding: 3,
        halign: "center",
        lineColor: BORDER_GREY,
        lineWidth: 0.2,
      },
      headStyles: {
        fillColor: LIGHT_GREY,
        textColor: [0, 0, 0],
        fontStyle: "bold",
        fontSize: 8,
      },
    });

    cursorY = (doc as any).lastAutoTable.finalY;

    const allOrderSkus: any[] = Array.isArray(anyOrder.orderSkus)
      ? anyOrder.orderSkus
      : [];
    const filteredSkus = isScopedToSeller
      ? allOrderSkus.filter((sku) => getSkuSellerId(sku) === targetSellerId)
      : allOrderSkus;

    const skuFallbackSubtotal = toAmount(
      filteredSkus.reduce(
        (sum: number, sku: any) =>
          sum +
          toAmount(getSkuUnitPrice(sku)) *
            Math.max(1, Number(sku?.quantity ?? 1)),
        0
      )
    );

    const skuFallbackSellerDiscount = toAmount(
      filteredSkus.reduce((sum: number, sku: any) => {
        const qty = Math.max(1, Number(sku?.quantity ?? 1));
        const unitPrice = getSkuUnitPrice(sku);
        const baseLine = toAmount(qty * unitPrice);
        const discPerUnit = getSkuSellerDiscountPerUnit(sku, unitPrice);
        return sum + toAmount(Math.min(baseLine, discPerUnit * qty));
      }, 0)
    );

    const itemRows = filteredSkus.map((sku: any) => {
      const qty = Math.max(1, Number(sku?.quantity ?? 1));
      const unitPrice = getSkuUnitPrice(sku);
      const baseLine = toAmount(qty * unitPrice);
      const discPerUnit = getSkuSellerDiscountPerUnit(sku, unitPrice);
      const lineDiscount = toAmount(Math.min(baseLine, discPerUnit * qty));
      const netLine = toAmount(Math.max(0, baseLine - lineDiscount));

      const productName =
        sku?.product_id?.name ??
        sku?.product?.name ??
        sku?.sku_id?.name ??
        "Product";
      const detailsText = getSkuDetailsText(sku);
      const sellerName =
        sku?.seller_id?.name ??
        sku?.product_id?.seller_id?.name ??
        sku?.seller?.name ??
        "";

      const descriptionLines = [productName];
      if (!isScopedToSeller && sellerName) {
        descriptionLines.push(`Seller: ${sellerName}`);
      }
      if (detailsText) {
        descriptionLines.push(detailsText);
      }

      const amountLines = [formatMoney(netLine)];
      if (lineDiscount > 0) {
        amountLines.push(`Seller Disc: -${formatMoney(lineDiscount)}`);
      }

      return [
        qty.toFixed(0),
        descriptionLines.join("\n"),
        sku?.sku_id?.uom ?? "EA",
        formatMoney(unitPrice),
        amountLines.join("\n"),
      ];
    });

    autoTable(doc, {
      startY: cursorY,
      margin: { left: marginX, right: marginX },
      tableWidth,
      theme: "grid",
      head: [["Qty", "Item Description", "U of M", "Unit Price", "Amount"]],
      body:
        itemRows.length > 0
          ? itemRows
          : [
              [
                "0",
                "No items for selected seller",
                "EA",
                formatMoney(0),
                formatMoney(0),
              ],
            ],
      styles: {
        fontSize: 8,
        cellPadding: 3,
        lineColor: BORDER_GREY,
        lineWidth: 0.2,
        minCellHeight: 8,
      },
      headStyles: {
        fillColor: LIGHT_GREY,
        textColor: [0, 0, 0],
        fontStyle: "bold",
        halign: "center",
        fontSize: 8,
      },
      columnStyles: {
        0: { halign: "center", cellWidth: 16 },
        1: { cellWidth: "auto" },
        2: { halign: "center", cellWidth: 18 },
        3: { halign: "right", cellWidth: 28 },
        4: { halign: "right", cellWidth: 34 },
      },
    });

    cursorY = (doc as any).lastAutoTable.finalY + 6;

    // 1. Charges & Summary calculation (hiding 0-value rows)
    const coupon = anyOrder.orderCoupon;
    const charges = anyOrder.orderCharges || {};
    const sellerChargesList: any[] = Array.isArray(anyOrder.orderSellerCharges)
      ? anyOrder.orderSellerCharges
      : [];
    const sellerChargeRecord = isScopedToSeller
      ? sellerChargesList.find(
          (entry) => resolveId(entry?.seller_id) === targetSellerId
        ) ?? null
      : null;

    const combinedSellerCharges = sellerChargesList.reduce(
      (acc, entry) => {
        acc.shipping = toAmount(acc.shipping + toAmount(entry?.shipping_charges));
        acc.cod = toAmount(acc.cod + toAmount(entry?.cod_charges));
        return acc;
      },
      { shipping: 0, cod: 0 }
    );

    const subtotal = toAmount(
      isScopedToSeller
        ? sellerChargeRecord?.subtotal ?? skuFallbackSubtotal
        : order.total ?? skuFallbackSubtotal
    );

    const shippingCharges = toAmount(
      isScopedToSeller
        ? sellerChargeRecord?.shipping_charges
        : sellerChargesList.length > 0
        ? combinedSellerCharges.shipping
        : charges?.shipping_charges
    );

    const codCharges = toAmount(
      isScopedToSeller
        ? sellerChargeRecord?.cod_charges
        : sellerChargesList.length > 0
        ? combinedSellerCharges.cod
        : charges?.cod_charges
    );

    const salesDiscount = isScopedToSeller
      ? 0
      : toAmount(charges?.sales_discount);

    const couponDiscount = toAmount(
      isScopedToSeller
        ? coupon?.vendor_coupon_discount ?? coupon?.seller_coupon_discount
        : toAmount(coupon?.admin_coupon_discount) +
            toAmount(
              coupon?.vendor_coupon_discount ?? coupon?.seller_coupon_discount
            )
    );

    const skuSellerDiscountSum = toAmount(
      filteredSkus.reduce(
        (sum: number, sku: any) => sum + toAmount(sku?.seller_discount),
        0
      )
    );

    const rawSellerDiscount = isScopedToSeller
      ? toAmount(charges?.seller_discount) ||
        skuSellerDiscountSum ||
        skuFallbackSellerDiscount
      : toAmount(charges?.total_seller_discount) ||
        toAmount(charges?.seller_discount) ||
        skuSellerDiscountSum ||
        skuFallbackSellerDiscount;

    const sellerDiscountTotal = toAmount(rawSellerDiscount);

    const adminDiscountTotal = isScopedToSeller
      ? 0
      : toAmount(charges?.admin_discount ?? charges?.total_admin_discount);

    const paidAmount = toAmount(
      isScopedToSeller
        ? sellerChargeRecord?.payable_amount ??
            sellerChargeRecord?.paid ??
            subtotal
        : anyOrder?.paid ?? anyOrder?.payable_amount ?? subtotal
    );

    const summaryRows: [string, string][] = [["Subtotal", formatMoney(subtotal)]];

    if (shippingCharges > 0) {
      summaryRows.push(["Shipping", formatMoney(shippingCharges)]);
    }
    if (codCharges > 0) {
      summaryRows.push(["COD Charges", formatMoney(codCharges)]);
    }
    if (!isScopedToSeller && salesDiscount > 0) {
      summaryRows.push(["Sales Discount", `-${formatMoney(salesDiscount)}`]);
    }
    if (couponDiscount > 0) {
      summaryRows.push(["Coupon Discount", `-${formatMoney(couponDiscount)}`]);
    }
    if (sellerDiscountTotal > 0) {
      summaryRows.push([
        "Seller Discount",
        `-${formatMoney(sellerDiscountTotal)}`,
      ]);
    }
    if (!isScopedToSeller && adminDiscountTotal > 0) {
      summaryRows.push([
        "Admin Discount",
        `-${formatMoney(adminDiscountTotal)}`,
      ]);
    }

    summaryRows.push(["Paid Total", formatMoney(paidAmount)]);

    // 2. Summary block right below items table
    const summaryWidth = 78;
    autoTable(doc, {
      startY: cursorY,
      margin: { left: pageWidth - marginX - summaryWidth, right: marginX },
      tableWidth: summaryWidth,
      theme: "grid",
      body: summaryRows,
      styles: {
        fontSize: 8,
        cellPadding: 2.5,
        lineColor: BORDER_GREY,
        lineWidth: 0.2,
      },
      columnStyles: {
        0: { fontStyle: "bold", fillColor: LIGHT_GREY, cellWidth: 38 },
        1: { halign: "right", cellWidth: 40 },
      },
      didParseCell: (data) => {
        if (data.row.index === summaryRows.length - 1) {
          data.cell.styles.fontStyle = "bold";
          data.cell.styles.fillColor = LIGHT_GREY;
        }
      },
    });

    // 3. Coupon & Order Note lines AFTER summary block and BEFORE disclaimer text
    let nextY = (doc as any).lastAutoTable.finalY + 7;
    const extraLines: string[] = [];

    if (coupon?.coupon_code) {
      const adminCpn = toAmount(coupon?.admin_coupon_discount);
      const sellerCpn = toAmount(
        coupon?.vendor_coupon_discount ?? coupon?.seller_coupon_discount
      );
      const cpnDisc = isScopedToSeller
        ? sellerCpn
        : toAmount(adminCpn + sellerCpn);
      extraLines.push(
        `Coupon Applied: ${coupon.coupon_code}${
          cpnDisc > 0 ? ` (-${formatMoney(cpnDisc)})` : ""
        }`
      );
    }

    if (order.user_remarks) {
      extraLines.push(`Order Note: ${order.user_remarks}`);
    }

    if (extraLines.length > 0) {
      doc.setFont("NotoSans", "normal");
      doc.setFontSize(8.5);
      doc.setTextColor(30);
      for (const line of extraLines) {
        const wrapped = doc.splitTextToSize(line, tableWidth);
        doc.text(wrapped, marginX, nextY);
        nextY += wrapped.length * 4.4 + 2;
      }
      nextY += 3;
    }

    // 4. Full-width disclaimer text & signature block AFTER coupon / order note
    doc.setFont("NotoSans", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(80);
    const disclaimer =
      "The customer acknowledges receipt of goods in acceptable condition unless otherwise noted at delivery. " +
      "No claims, returns, discrepancies, or adjustments for this order will be accepted beyond five (5) days from " +
      "the delivery date. All products become the responsibility of the customer upon receipt, including proper " +
      "storage and handling. Any returned item must be in its original case and in the same condition in which it " +
      "was delivered.";
    const disclaimerLines = doc.splitTextToSize(disclaimer, tableWidth);
    doc.text(disclaimerLines, marginX, nextY);

    nextY += disclaimerLines.length * 3.8 + 8;
    doc.setTextColor(0);
    doc.setFontSize(9);
    doc.text(
      "Received by: ____________________________________",
      marginX,
      nextY
    );
    nextY += 8;

    const consents = getOrderConsents(anyOrder);
    if (consents.length > 0) {
      doc.setFontSize(7.5);
      doc.setTextColor(70);
      const consentText = `Consents: ${consents
        .map(formatConsentLabel)
        .join("; ")}`;
      const consentLines = doc.splitTextToSize(consentText, tableWidth);
      doc.text(consentLines, marginX, nextY);
      nextY += consentLines.length * 3.8 + 4;
    }

    doc.setFontSize(8);
    doc.setTextColor(0);
    doc.text("Page No.  1", marginX, Math.max(nextY + 4, pageHeight - 10));

    return doc;
  } catch (error) {
    clo(error);
    return null;
  }
}

export async function generateInvoice(
  order_id: string,
  options: InvoiceOptions = {}
) {
  try {
    const res = await apiRequest("POST", "ecom/order", {
      function: "get_single_order",
      order_id,
      ...(options.seller_id ? { seller_id: options.seller_id } : {}),
    });
    if (!res?.data) return;

    const doc = new jsPDF("p", "mm", "a4");
    await designInvoicePDF(doc, res.data, options);

    const suffix = options.seller_id ? `-${options.seller_id}` : "";
    doc.save(`invoice-${order_id}${suffix}.pdf`);
  } catch (error) {
    clo(error);
  }
}

export async function generateInvoiceBuffer(
  order: OrderProps,
  options: InvoiceOptions = {}
) {
  try {
    const doc = new jsPDF("p", "mm", "a4");
    await designInvoicePDF(doc, order, options);
    const pdfBuffer = doc.output("arraybuffer");
    return Buffer.from(pdfBuffer);
  } catch (error) {
    clo(error);
    return null;
  }
}
// Invoice