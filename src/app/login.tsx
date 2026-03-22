import { useState } from 'react';
import { View, Text, TextInput, Pressable, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter, Stack } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Colors } from '@/constants/Colors';
import { useUserStore } from '@/stores/userStore';

export default function LoginScreen() {
  const router = useRouter();
  const { signIn, signUp } = useUserStore();

  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('提示', '请填写邮箱和密码');
      return;
    }

    setLoading(true);
    let error: string | null;

    if (isSignUp) {
      error = await signUp(email.trim(), password, name.trim() || undefined);
      if (!error) {
        Alert.alert('注册成功', '请查收验证邮件后登录');
        setIsSignUp(false);
        setLoading(false);
        return;
      }
    } else {
      error = await signIn(email.trim(), password);
      if (!error) {
        router.back();
        setLoading(false);
        return;
      }
    }

    if (error) Alert.alert('错误', error);
    setLoading(false);
  };

  return (
    <View className="flex-1 bg-background">
      <Stack.Screen
        options={{
          headerShown: true,
          headerTitle: isSignUp ? '注册' : '登录',
          headerTitleStyle: { fontFamily: 'Manrope_500Medium', fontSize: 16 },
          headerStyle: { backgroundColor: Colors.background },
          headerShadowVisible: false,
          headerLeft: () => (
            <Pressable onPress={() => router.back()} hitSlop={8}>
              <MaterialIcons name="arrow-back" size={24} color={Colors.onSurface} />
            </Pressable>
          ),
        }}
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <View className="flex-1 px-6 justify-center gap-6">
          {/* Logo 区域 */}
          <View className="items-center gap-3 mb-8">
            <Text className="font-headline text-4xl text-primary font-bold">李记茶</Text>
            <Text className="text-outline text-sm">一叶一世界</Text>
          </View>

          {/* 表单 */}
          {isSignUp && (
            <View className="gap-2">
              <Text className="text-on-surface-variant text-sm">昵称</Text>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="您的昵称"
                placeholderTextColor={Colors.outline}
                className="bg-surface-container-low rounded-xl px-4 py-3.5 text-on-surface"
                autoCapitalize="none"
              />
            </View>
          )}

          <View className="gap-2">
            <Text className="text-on-surface-variant text-sm">邮箱</Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="your@email.com"
              placeholderTextColor={Colors.outline}
              className="bg-surface-container-low rounded-xl px-4 py-3.5 text-on-surface"
              autoCapitalize="none"
              keyboardType="email-address"
            />
          </View>

          <View className="gap-2">
            <Text className="text-on-surface-variant text-sm">密码</Text>
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="至少 6 位"
              placeholderTextColor={Colors.outline}
              className="bg-surface-container-low rounded-xl px-4 py-3.5 text-on-surface"
              secureTextEntry
              autoCapitalize="none"
            />
          </View>

          {/* 提交按钮 */}
          <Pressable
            onPress={handleSubmit}
            disabled={loading}
            className="bg-primary-container rounded-full py-4 items-center justify-center mt-4 active:bg-primary"
          >
            <Text className="text-on-primary font-medium text-base">
              {loading ? '请稍候...' : isSignUp ? '注册' : '登录'}
            </Text>
          </Pressable>

          {/* 切换登录/注册 */}
          <Pressable onPress={() => setIsSignUp(!isSignUp)} className="items-center py-2">
            <Text className="text-tertiary text-sm">
              {isSignUp ? '已有账号？去登录' : '没有账号？去注册'}
            </Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}
