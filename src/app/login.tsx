import { useState } from 'react';
import { View, Text, TextInput, Pressable, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter, Stack } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Colors } from '@/constants/Colors';
import { track } from '@/lib/analytics';
import { goBackOrReplace } from '@/lib/navigation';
import { useUserStore } from '@/stores/userStore';
import { showModal } from '@/stores/modalStore';
import { supabase } from '@/lib/supabase';
// 阿里云一键登录 Hook
import { useOneClickLogin } from '@/hooks/useOneClickLogin';

export default function LoginScreen() {
  const router = useRouter();
  // 登录页只订阅认证动作，避免 userStore 其他字段变化打断表单输入或按钮态。
  const signIn = useUserStore((state) => state.signIn);
  const signUp = useUserStore((state) => state.signUp);
  // 阿里云一键登录
  const { loading: oneClickLoading, isSupported, login: doOneClickLogin } = useOneClickLogin();

  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);

  /**
   * 一键登录处理函数
   *
   * 流程：调用 useOneClickLogin.login()
   * - 成功：显示欢迎提示并返回上一页
   * - 失败：显示错误提示
   * - 取消：静默返回
   */
  const handleOneClickLogin = async () => {
    const result = await doOneClickLogin();
    if (result.success) {
      track('login_success', { method: 'one-click' });
      showModal('欢迎回来', '登录成功，祝您品茶愉快', 'success');
      setTimeout(() => goBackOrReplace(router), 800);
    } else if (result.error) {
      showModal('登录失败', result.error, 'error');
    }
    // 用户取消不显示任何提示
  };

  /**
   * 忘记密码：发送重置邮件
   */
  const handleForgotPassword = async () => {
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      showModal('提示', '请先输入邮箱地址');
      return;
    }
    setResetLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(trimmedEmail);
    setResetLoading(false);
    if (error) {
      showModal('发送失败', error.message, 'error');
    } else {
      showModal('邮件已发送', '请查收邮箱中的密码重置链接。', 'success');
    }
  };

  const handleSubmit = async () => {
    if (!email.trim() || !password.trim()) {
      showModal('提示', '请填写邮箱和密码');
      return;
    }

    setLoading(true);
    let error: string | null;

    if (isSignUp) {
      error = await signUp(email.trim(), password, name.trim() || undefined);
      if (!error) {
        track('register_success', { method: 'email' });
        showModal('注册成功', '请查收验证邮件后登录', 'success');
        setIsSignUp(false);
        setLoading(false);
        return;
      }
    } else {
      error = await signIn(email.trim(), password);
      if (!error) {
        track('login_success', { method: 'email' });
        // 登录成功 — 显示优雅提示后返回
        showModal('欢迎回来', '登录成功，祝您品茶愉快', 'success');
        setTimeout(() => goBackOrReplace(router), 800);
        setLoading(false);
        return;
      }
    }

    if (error) showModal('错误', error, 'error');
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
            <Pressable onPress={() => goBackOrReplace(router)} hitSlop={8}>
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

          {/* 一键登录入口（仅在运营商支持时显示） */}
          {isSupported && (
            <>
              <Pressable
                onPress={handleOneClickLogin}
                disabled={oneClickLoading}
                className="bg-primary rounded-full py-4 items-center justify-center active:bg-primary/90"
              >
                <View className="flex-row items-center gap-2">
                  <MaterialIcons name="phone-android" size={20} color="white" />
                  <Text className="text-white font-medium text-base">
                    {oneClickLoading ? '登录中...' : '本机号码一键登录'}
                  </Text>
                </View>
              </Pressable>

              {/* 分隔线 */}
              <View className="flex-row items-center gap-3">
                <View className="flex-1 h-px bg-outline/30" />
                <Text className="text-outline text-xs">或</Text>
                <View className="flex-1 h-px bg-outline/30" />
              </View>
            </>
          )}

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

          {/* 忘记密码 */}
          {!isSignUp && (
            <Pressable onPress={handleForgotPassword} disabled={resetLoading} className="items-center py-1">
              <Text className="text-outline text-xs">
                {resetLoading ? '发送中...' : '忘记密码？'}
              </Text>
            </Pressable>
          )}

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
