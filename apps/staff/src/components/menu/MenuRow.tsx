import { ListRow, type ListRowVariant } from "@/src/components/ui/ListRow";

type MenuRowProps = {
  label: string;
  value?: string;
  variant?: ListRowVariant;
  onPress?: () => void;
  showSeparator?: boolean;
  children?: React.ReactNode;
};

export function MenuRow({
  label,
  value,
  variant,
  onPress,
  children,
}: MenuRowProps) {
  return (
    <ListRow
      label={label}
      value={value}
      variant={variant}
      onPress={onPress}
    >
      {children}
    </ListRow>
  );
}
