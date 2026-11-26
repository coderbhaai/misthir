import { TableCell, TableRow } from '@amitkk/components/basic/table';
import { ActionCell } from '@amitkk/components/basic/ActionCell';
import { SellerSiteSettingProps } from "@amitkk/payment/types";
import UserRow from '@amitkk/basic/static/UserRow';
import { UserRowProps } from '@amitkk/basic/types/user';

type Props = {
  row: SellerSiteSettingProps;
  onEdit: (row: SellerSiteSettingProps) => void;
};

export function AdminDataTable({ row, onEdit }: Props) {
  return (
    <>
      <TableRow>
        <TableCell><UserRow row={row.seller_id as unknown as UserRowProps}/></TableCell>
        <TableCell>{row.module}</TableCell>
        <TableCell>{row.module_value}</TableCell>
        <ActionCell row={row} modelName="SiteSetting" onEdit={onEdit}/>
      </TableRow>
    </>
  );
}
