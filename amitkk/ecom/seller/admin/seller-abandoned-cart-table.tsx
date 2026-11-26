import { TableCell, TableRow } from '@amitkk/components/basic/table';
import { UserRowProps } from '@amitkk/basic/types/user';
import { CartProps } from '@amitkk/ecom/types';
import UserName from '@amitkk/basic/static/UserName';
import CartChargesDetails from '@amitkk/ecom/admin/CartChargesDetails';
import CartSkuDetails from '@amitkk/ecom/admin/CartSkuDetails';
import { ActionCell } from '@amitkk/components/basic/ActionCell';
import AdminRowActions from '@amitkk/components/admin/AdminRowActions';

type Props = {
  row: CartProps;
};

export function AdminDataTable({ row }: Props) {
  return (
    <>
      <TableRow>
        <TableCell><UserName row={row.user_id as unknown as UserRowProps}/></TableCell>
        <TableCell>
          Total : {row.total}<br/>
          Payable : {row.payable_amount}<br/>
        </TableCell>
        <TableCell><CartSkuDetails skus={row.cartSkus}/></TableCell>
        <TableCell><CartChargesDetails charges={row.cartCharges}/></TableCell>
        <ActionCell row={row} show_status={false} usePopover/>
      </TableRow>

      <AdminRowActions id={row._id.toString()} actions={[
        { label: "Edit", href: `/seller/abandoned-cart/${row._id}` },
      ]}/>
    </>
  );
}
