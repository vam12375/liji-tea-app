import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";

export interface Address {
  id: string;
  name: string;
  phone: string;
  address: string;
  isDefault: boolean;
}

export interface UserState {
  isLoggedIn: boolean;
  name: string;
  phone: string;
  avatar: string;
  memberTier: string;
  points: number;
  favorites: string[]; // 产品 ID 列表
  addresses: Address[];

  login: (name: string, phone: string) => void;
  logout: () => void;
  toggleFavorite: (productId: string) => void;
  isFavorite: (productId: string) => boolean;
  addAddress: (address: Address) => void;
  removeAddress: (id: string) => void;
  setDefaultAddress: (id: string) => void;
  getDefaultAddress: () => Address | undefined;
}

export const useUserStore = create<UserState>()(
  persist(
    (set, get) => ({
      isLoggedIn: false,
      name: "",
      phone: "",
      avatar: "",
      memberTier: "金叶会员",
      points: 2680,
      favorites: [],
      addresses: [
        {
          id: "1",
          name: "王先生",
          phone: "138****8888",
          address: "上海市静安区南京西路1888号",
          isDefault: true,
        },
      ],

      login: (name, phone) =>
        set({ isLoggedIn: true, name, phone }),

      logout: () =>
        set({ isLoggedIn: false, name: "", phone: "" }),

      toggleFavorite: (productId) =>
        set((state) => ({
          favorites: state.favorites.includes(productId)
            ? state.favorites.filter((id) => id !== productId)
            : [...state.favorites, productId],
        })),

      isFavorite: (productId) => get().favorites.includes(productId),

      addAddress: (address) =>
        set((state) => ({
          addresses: address.isDefault
            ? [
                ...state.addresses.map((a) => ({ ...a, isDefault: false })),
                address,
              ]
            : [...state.addresses, address],
        })),

      removeAddress: (id) =>
        set((state) => ({
          addresses: state.addresses.filter((a) => a.id !== id),
        })),

      setDefaultAddress: (id) =>
        set((state) => ({
          addresses: state.addresses.map((a) => ({
            ...a,
            isDefault: a.id === id,
          })),
        })),

      getDefaultAddress: () => get().addresses.find((a) => a.isDefault),
    }),
    {
      name: "liji-user",
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
