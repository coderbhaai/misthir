import { TableCell, TableRow } from '@amitkk/components/basic/table';
import { fullAddress } from '@amitkk/address/utils/addressUtils';
import { ActionCell } from '@amitkk/components/basic/ActionCell';
import { AddressProps } from '@amitkk/address/types';
import UserRow from '@amitkk/basic/static/UserRow';
import { UserRowProps } from '@amitkk/basic/types/user';

type Props = {
  row: AddressProps;
  onEdit: (row: AddressProps) => void;
};

export function AddressTableRow({ row, onEdit }: Props) {
  return (
    <TableRow>
      <TableCell><UserRow row={row.user_id as UserRowProps} /></TableCell>
      <TableCell>{fullAddress(row)}</TableCell>
      <ActionCell row={row} modelName="Address" onEdit={onEdit}/>
    </TableRow>
  );
}