import { View, Text, Pressable } from "react-native";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Colors } from "@/constants/Colors";
import type { Address } from "@/stores/userStore";

interface AddressCardProps {
  address: Address;
  onPress?: () => void;
}

export default function AddressCard({ address, onPress }: AddressCardProps) {
  return (
    <Pressable
      onPress={onPress}
      className="bg-surface-container-low rounded-xl p-4 flex-row items-center gap-3 active:opacity-80"
    >
      <MaterialIcons name="location-on" size={24} color={Colors.primaryContainer} />
      <View className="flex-1 gap-1">
        <View className="flex-row items-center gap-2">
          <Text className="font-headline text-on-surface text-base font-medium">
            {address.name}
          </Text>
          <Text className="text-outline text-sm">{address.phone}</Text>
          {address.isDefault && (
            <View className="bg-primary-container/20 px-2 py-0.5 rounded">
              <Text className="text-primary text-[10px]">默认</Text>
            </View>
          )}
        </View>
        <Text className="text-on-surface-variant text-sm" numberOfLines={2}>
          {address.address}
        </Text>
      </View>
      <MaterialIcons name="chevron-right" size={20} color={Colors.outline} />
    </Pressable>
  );
}
