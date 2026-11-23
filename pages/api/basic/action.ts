import mongoose, { Types } from 'mongoose';
import type { NextApiRequest, NextApiResponse } from 'next';
import { createApiHandler, ExtendedRequest } from '../apiHandler';
import Action from 'lib/models/basic/Action';
import { APIHandlers } from '../../../lib/server/middleware';
import SpatieRole from 'lib/models/spatie/SpatieRole';
import SpatiePermission from 'lib/models/spatie/SpatiePermission';
import Menu from 'lib/models/spatie/Menu';
import { extractSegment, resolvePath } from './menu';
import UrlRegistry from 'lib/models/basic/UrlRegistry';
import { slugify, syncUrlRegistry, upsertMeta } from 'pages/api/basic/meta';
import Page from 'lib/models/basic/Page';
import CartSku from 'lib/models/ecom/CartSku';
import CartSkuDetail from 'lib/models/ecom/CartSkuDetail';
import Cart from 'lib/models/ecom/Cart';
import OrderCharges from 'lib/models/ecom/OrderCharges';
import Order from 'lib/models/ecom/Order';
import OrderConsent from 'lib/models/ecom/OrderConsent';
import Payment from 'lib/models/seller/Payment';
import SellerIncome from 'lib/models/seller/SellerIncome';
import SellerPayoutRequest from 'lib/models/seller/SellerPayoutRequest';
import SellerIncomeSellerPayoutRequest from 'lib/models/seller/SellerIncomeSellerPayoutRequest';
import TaxCollected from 'lib/models/tax/TaxCollected';
import TaxCollectedSummary from 'lib/models/tax/TaxCollectedSummary';
import { logError } from 'lib/services/errorService';
import { insertIndiaStates } from 'lib/services/addressService';

export async function test(req: ExtendedRequest, res: NextApiResponse) {
  try {
    await insertIndiaStates();
    
    // if( !response ){ return res.status(400).json({ message: 'Test Went Successfully' }); }
    return res.status(200).json({ message: '✅ Test Ran successfully' });

  } catch (error) { await logError(error, { function: "test", payload: req.body }); }
}

async function clear_cart() {
  // await Cart.deleteMany({});
  // await CartSku.deleteMany({});
  // await CartSkuDetail.deleteMany({});
  await Order.deleteMany({});
  await OrderCharges.deleteMany({});
  await OrderConsent.deleteMany({});
  await CartSkuDetail.deleteMany({});
  await Payment.deleteMany({});
  await SellerIncome.deleteMany({});
  await SellerPayoutRequest.deleteMany({});
  await SellerIncomeSellerPayoutRequest.deleteMany({});
  await TaxCollectedSummary.deleteMany({});
  await TaxCollected.deleteMany({});
}

export const functions: APIHandlers = {
  test : { middlewares: [] },	
}

export const actionHandlers = {
  test,
};

export const config = { api: { bodyParser: false } };
export default createApiHandler(functions, actionHandlers);