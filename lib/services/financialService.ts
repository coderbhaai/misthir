import SellerIncome from "lib/models/seller/SellerIncome";
import TaxCollected from "lib/models/tax/TaxCollected";
import TaxCollectedSummary from "lib/models/tax/TaxCollectedSummary";
import { Types } from "mongoose";
import { logError } from "pages/api/utils";

export interface FinancialItemInput {
  item_id?: Types.ObjectId | string;
  product_id: any;
  sku_id: any;
  seller_id?: Types.ObjectId | string;
  quantity: number;
  price: number;
  effectivePrice: number;
  admin_discount?: number;
  seller_discount?: number;
}

interface ProcessFinancialsInput {
  module: string;
  module_id: Types.ObjectId | string;
  items: FinancialItemInput[];
  billingState?: string;
}

export type LineItemTaxResult = NonNullable<Awaited<ReturnType<typeof calculateLineItemTax>>>;

export async function processModuleFinancials({ module, module_id, items, billingState = "" }: ProcessFinancialsInput) {
    try {
        const isHaryana = billingState.toLowerCase().trim() === "haryana";

        let grandTotalTax = 0;
        let grandCgst = 0;
        let grandSgst = 0;
        let grandIgst = 0;

        const taxCollectedDocs: any[] = [];
        const taxCalculationResults: Array<{ taxableAmount: number; lineItemTax: number }> = [];

        for (const item of items) {
            const taxCalc = await calculateLineItemTax(item, isHaryana);
            if (!taxCalc) { throw new Error("taxCalc came as null"); }
            
            grandTotalTax += taxCalc.lineItemTax;
            grandCgst += taxCalc.cgst;
            grandSgst += taxCalc.sgst;
            grandIgst += taxCalc.igst;

            taxCollectedDocs.push(buildTaxCollectedDoc(module, module_id, item, taxCalc));
            taxCalculationResults.push({ taxableAmount: taxCalc.taxableAmount, lineItemTax: taxCalc.lineItemTax });
        }

        const summaryData = {
            cgst: Number(grandCgst.toFixed(2)),
            sgst: Number(grandSgst.toFixed(2)),
            igst: Number(grandIgst.toFixed(2)),
            total: Number(grandTotalTax.toFixed(2)),
        };
        
        const sellerIncomeMap = await aggregateSellerIncomes(items, taxCalculationResults);
        if (!sellerIncomeMap) { throw new Error("aggregateSellerIncomes failed"); }

        await Promise.all([
            persistTaxData(module, module_id, taxCollectedDocs, summaryData),
            persistSellerIncomes(module, module_id, sellerIncomeMap),
        ]);

        return {
            totalTax: summaryData.total,
            cgst: summaryData.cgst,
            sgst: summaryData.sgst,
            igst: summaryData.igst,
        };

    } catch (error) { return await logError(error, { function: "processModuleFinancials", payload: { module, module_id, items, billingState } }); }
}

export async function calculateLineItemTax(item: FinancialItemInput, isHaryana: boolean) {
    try {
        const quantity = item.quantity || 0;
        const effectivePrice = item.effectivePrice || 0;
        const taxRate = item.product_id?.tax_id?.rate || 0;
    
        const taxableAmount = effectivePrice * quantity;
        const lineItemTax = Number(((taxableAmount * taxRate) / 100).toFixed(2));
    
        let cgst = 0;
        let sgst = 0;
        let igst = 0;
    
        if (isHaryana) {
        cgst = Number((lineItemTax / 2).toFixed(2));
        sgst = Number((lineItemTax / 2).toFixed(2));
        } else {
        igst = lineItemTax;
        }
    
        return {
        quantity,
        effectivePrice,
        taxRate,
        taxableAmount,
        lineItemTax,
        cgst,
        sgst,
        igst,
        };
    } catch (error) { await logError(error, { function: "calculateLineItemTax", payload: { item, isHaryana } }); return null; }
}

export function buildTaxCollectedDoc(module: string, module_id: any, item: FinancialItemInput, taxCalc: LineItemTaxResult) {
    return {
        module,
        module_id,
        tax_id: item.product_id?.tax_id?._id || item.product_id?.tax_id,
        tax_rate: taxCalc.taxRate,
        price: taxCalc.effectivePrice,
        quantity: taxCalc.quantity,
        admin_discount: item.admin_discount || 0,
        seller_discount: item.seller_discount || 0,
        cgst: taxCalc.cgst,
        sgst: taxCalc.sgst,
        igst: taxCalc.igst,
        total: taxCalc.lineItemTax,
    };
}

async function persistSellerIncomes(module: string, module_id: any, sellerIncomeMap: Map<string, { payable: number; margin: number }>) {
    try {
        const sellerIncomeDocs = Array.from(sellerIncomeMap.entries()).map(([seller_id, data]) => ({
        module,
        module_id,
        seller_id: new Types.ObjectId(seller_id),
        margin: data.margin,
        payable: data.payable,
        paid: 0,
        due: data.payable,
        status: "Pending",
        }));
    
        if (sellerIncomeDocs.length > 0) {
            await SellerIncome.insertMany(sellerIncomeDocs);
        }
    } catch (error) { return await logError(error, { function: "persistSellerIncomes", payload: { module, module_id, sellerIncomeMap } }); }
}

export async function aggregateSellerIncomes(items: FinancialItemInput[], calculatedTaxes: Array<{ taxableAmount: number; lineItemTax: number }>) {
    try {
        const sellerIncomeMap: Map<string, { payable: number; margin: number }> = new Map();
    
        items.forEach((item, index) => {
            if (!item.seller_id) return;
        
            const sellerKey = item.seller_id.toString();
            const { taxableAmount, lineItemTax } = calculatedTaxes[index];
            const netPayableForLine = Number((taxableAmount - lineItemTax).toFixed(2));
        
            const existing = sellerIncomeMap.get(sellerKey) || { payable: 0, margin: 0 };
            sellerIncomeMap.set(sellerKey, {
                payable: Number((existing.payable + netPayableForLine).toFixed(2)),
                margin: existing.margin,
            });
        });
    
        return sellerIncomeMap;
    } catch (error) { await logError(error, { function: "aggregateSellerIncomes", payload: { items, calculatedTaxes } }); return null; }
}

async function persistTaxData(module: string, module_id: any, taxDocs: any[], summaryData: { cgst: number; sgst: number; igst: number; total: number }) {
    try {
        if (taxDocs.length > 0) {
            await TaxCollected.insertMany(taxDocs);
        }
    
        await TaxCollectedSummary.create({
            module,
            module_id,
            cgst: summaryData.cgst,
            sgst: summaryData.sgst,
            igst: summaryData.igst,
            total: summaryData.total,
        });
    } catch (error) { return await logError(error, { function: "persistTaxData", payload: { module, module_id, taxDocs, summaryData } }); }
}