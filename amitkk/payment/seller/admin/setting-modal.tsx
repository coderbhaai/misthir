import * as React from 'react';
import CustomModal from '@amitkk/basic/static/CustomModal';
import { useFormHandler } from 'hooks/useFormHandler';
import { Button } from '@amitkk/components/button/button';
import OpenSelect from '@amitkk/components/basic/OpenSelect';
import { apiRequest, clo, hitToastr, TableDataFormProps } from '@amitkk/basic/utils/my-utils/admin-utils';
import StatusSelect from '@amitkk/components/admin/status-input';
import { TextField } from '@amitkk/components/basic/TextField';
import { SellerSiteSettingProps } from '@amitkk/payment/types';
import { getSellerId } from '@amitkk/basic/utils/my-utils/ecom-utils';

type DataFormProps = TableDataFormProps & {
  handleUpdate: () => Promise<void>;
};

const module_options = [
  'Shipping',
  'Shipping Charges',
  'Order Replacement Days',
  'Free Shipping Above',
  'Allow Cod',
  'Cod Charges'
];

const moduleValueOptions: Record<string, (string[] | Record<string, string>)> = {
  'Allow Cod': { 1: 'Yes', 0: 'No' },
  Shipping: ['Ship Rocket'],
};

export default function DataModal({ open, handleClose, selectedDataId, handleUpdate }: DataFormProps) {
  const initialFormData: SellerSiteSettingProps = {
    _id: '',
    seller_id: '',
    module: '',
    module_value: '',
    status: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  const [formData, setFormData] = React.useState<SellerSiteSettingProps>(initialFormData);
  const [sellerId, setSellerId] = React.useState<string>('');

  const handleCloseModal = () => {
    setFormData(initialFormData);
    handleClose();
  };

  React.useEffect(() => {
    if (!open) return;

    const loadModalData = async () => {
      try {
        const sellerRes = await getSellerId();
        const resolvedSellerId = String(sellerRes.seller_id) ?? '';
        if (sellerRes.error) { hitToastr('error', sellerRes.error.message); }
        setSellerId(resolvedSellerId);

        if (selectedDataId) {
          const res = await apiRequest("GET", `ecom/seller?function=get_single_seller_setting&id=${selectedDataId}`);

          setFormData({
            _id: res?.data._id || '',
            module: res?.data.module || '',
            module_value: res?.data.module_value || '',
            seller_id: res?.data.seller_id || resolvedSellerId,
            status: res?.data.status ?? true,
            createdAt: res?.data.createdAt || new Date(),
            updatedAt: new Date(),
          });
        } else {
          setFormData({ ...initialFormData, seller_id: resolvedSellerId });
        }
      } catch (error) { clo(error); }
    };

    loadModalData();
  }, [open, selectedDataId]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      let currentSellerId = formData.seller_id || sellerId;
      if (!currentSellerId) { hitToastr('error', 'Unable to determine seller ID.'); return; }

      const formDataToSend = new FormData();
      formDataToSend.append("function", "create_update_seller_setting");
      formDataToSend.append("_id", (selectedDataId as string) || '');
      formDataToSend.append("seller_id", (currentSellerId as string) ?? "");
      formDataToSend.append("module", formData.module);
      formDataToSend.append("module_value", formData.module_value);
      formDataToSend.append("status", String(formData.status));

      const res = await apiRequest("POST", `ecom/seller`, formDataToSend);

      if (res?.data) {
        setFormData(initialFormData);
        await handleUpdate();
        hitToastr('success', res?.message);
        handleClose();
      }
    } catch (error) { clo(error); }
  };

  const title = !selectedDataId ? 'Add Setting' : 'Update Setting';
  const handleChange = useFormHandler(setFormData);

  return (
    <CustomModal open={open} handleClose={handleCloseModal} title={title}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <OpenSelect name={String(formData.module)} label="Module" value={formData.module} onChange={(value) => setFormData((prev) => ({...prev, module: value}))} options={module_options.map((mod) => ({ label: mod, value: mod }))}/>
          
          {formData.module && (
            <>
              {['Order Replacement Days', 'Free Shipping Above', 'Cod Charges', 'Shipping Charges'].includes(formData.module) && (
                <TextField label="Setting Value" name="module_value" value={formData.module_value} onChange={handleChange} required/>
              )}

              {['Shipping'].includes(formData.module) && (
                <OpenSelect name="module_value" label="Value *" value={formData.module_value} onChange={(value) => setFormData((prev) => ({ ...prev, module_value: value }))}
                  options={[ { label: "Select Value", value: "" }, ...(Array.isArray(moduleValueOptions[formData.module]) ? (moduleValueOptions[formData.module] as string[]).map((v) => ({ label: v, value: v })) : []) ]}/>
              )}

              {formData.module === 'Allow Cod' && (
                <OpenSelect name="module_value" label="Value *" value={formData.module_value}  onChange={(value) => setFormData((prev) => ({ ...prev, module_value: value }))} options={[ { label: "Select Value", value: "" }, { label: "Yes", value: "1" }, { label: "No", value: "0" } ]}/>
              )}
            </>
          )}

          <StatusSelect value={formData.status} onChange={(value) => handleChange("status", value)}/>
          <Button type='submit' color='primary'>{title}</Button>
      </form>
    </CustomModal>
  );
}