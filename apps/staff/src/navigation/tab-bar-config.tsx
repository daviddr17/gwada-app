import { Ionicons } from "@expo/vector-icons";
import type { ColorValue } from "react-native";

type IoniconName = React.ComponentProps<typeof Ionicons>["name"];

export const staffTabDefinitions = {
  tables: {
    title: "Tische",
    iconOutline: "grid-outline" as IoniconName,
    iconFilled: "grid" as IoniconName,
  },
  orders: {
    title: "Bestellungen",
    iconOutline: "receipt-outline" as IoniconName,
    iconFilled: "receipt" as IoniconName,
  },
  kasse: {
    title: "Kasse",
    iconOutline: "cash-outline" as IoniconName,
    iconFilled: "cash" as IoniconName,
  },
  menu: {
    title: "Menü",
    iconOutline: "ellipsis-horizontal" as IoniconName,
    iconFilled: "ellipsis-horizontal" as IoniconName,
  },
} as const;

export type StaffTabName = keyof typeof staffTabDefinitions;

export function staffTabIconOptions(tab: StaffTabName) {
  const def = staffTabDefinitions[tab];
  return {
    title: def.title,
    tabBarIcon: ({
      color,
      size,
      focused,
    }: {
      color: ColorValue;
      size: number;
      focused: boolean;
    }) => (
      <Ionicons
        name={focused ? def.iconFilled : def.iconOutline}
        size={size}
        color={color as string}
      />
    ),
  };
}
