import { TableCell, TableRow } from '@amitkk/components/basic/table';
import { ReviewProps } from '@amitkk/basic/types';
import { ActionCell } from "@amitkk/components/basic/ActionCell";
import ModuleLink from '@amitkk/basic/static/ModuleLink';
import { MediaProps } from '@amitkk/basic/types/media';

export interface DataProps extends ReviewProps {
};

type Props = {
  row: DataProps;
};

export function AdminDataTable({ row }: Props) {
  const mediaList = Array.isArray((row as any)?.mediaHub) ? (row as any).mediaHub : [];
  
  return (
    <TableRow>
      <TableCell><ModuleLink module={ row.module } module_url={( row.module_id as any )?.url } module_name={( row.module_id as any )?.name }/></TableCell>
      <TableCell>{row.rating} Star<br/>{row.review}</TableCell>
      <TableCell>
        {mediaList.length > 0 ? (
          <div className="flex items-center gap-1.5">
            {mediaList.map((item: any, idx: number) => {
              const media = item?.media_id as MediaProps;
              if (!media?.path) return null;

              return (
                <img key={String(item?._id ?? media?._id ?? idx)} src={media.path} alt={media.alt || `Review image ${idx + 1}`} className="h-10 w-10 shrink-0 rounded border object-cover"/>
              );
            })}
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </TableCell>
    </TableRow>
  );
}
