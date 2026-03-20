import { Tabs } from "expo-router";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Colors } from "@/constants/Colors";

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: Colors.primaryContainer,
        tabBarInactiveTintColor: Colors.outline,
        tabBarStyle: {
          backgroundColor: "rgba(254, 249, 241, 0.85)",
          borderTopWidth: 0,
          elevation: 0,
          height: 64,
          paddingBottom: 8,
          paddingTop: 4,
        },
        tabBarLabelStyle: {
          fontFamily: "Manrope_500Medium",
          fontSize: 10,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "首页",
          tabBarIcon: ({ color, focused }) => (
            <MaterialIcons
              name="home"
              size={24}
              color={color}
              style={{ opacity: focused ? 1 : 0.6 }}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="shop"
        options={{
          title: "商城",
          tabBarIcon: ({ color, focused }) => (
            <MaterialIcons
              name="shopping-bag"
              size={24}
              color={color}
              style={{ opacity: focused ? 1 : 0.6 }}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="culture"
        options={{
          title: "茶道",
          tabBarIcon: ({ color, focused }) => (
            <MaterialIcons
              name="menu-book"
              size={24}
              color={color}
              style={{ opacity: focused ? 1 : 0.6 }}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="community"
        options={{
          title: "茶友",
          tabBarIcon: ({ color, focused }) => (
            <MaterialIcons
              name="group"
              size={24}
              color={color}
              style={{ opacity: focused ? 1 : 0.6 }}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "我的",
          tabBarIcon: ({ color, focused }) => (
            <MaterialIcons
              name="person"
              size={24}
              color={color}
              style={{ opacity: focused ? 1 : 0.6 }}
            />
          ),
        }}
      />
    </Tabs>
  );
}
