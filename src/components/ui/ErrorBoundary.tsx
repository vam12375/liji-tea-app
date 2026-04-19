import { Component, type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Colors } from "@/constants/Colors";
import { captureError } from "@/lib/logger";

interface ErrorBoundaryProps {
  children: ReactNode;
  /** 自定义 fallback UI；未传则用内置极简兜底页。 */
  fallback?: (error: Error, reset: () => void) => ReactNode;
  /** 错误上报作用域，便于 captureError 归类。 */
  scope?: string;
}

interface ErrorBoundaryState {
  error: Error | null;
}

/**
 * 顶层 React 错误边界：拦截渲染期异常并统一走 captureError → 远端上报。
 * 不处理事件回调 / 异步错误，那些路径仍需调用方显式 captureError。
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack?: string | null }) {
    captureError(error, {
      scope: this.props.scope ?? "error_boundary",
      message: error.message,
      componentStack: info.componentStack ?? undefined,
    });
  }

  reset = () => {
    this.setState({ error: null });
  };

  render() {
    const { error } = this.state;
    if (!error) {
      return this.props.children;
    }

    if (this.props.fallback) {
      return this.props.fallback(error, this.reset);
    }

    return (
      <View style={styles.container}>
        <Text style={styles.title}>页面出了点意外</Text>
        <Text style={styles.message} numberOfLines={3}>
          {error.message || "未知错误"}
        </Text>
        <Pressable
          accessibilityRole="button"
          style={styles.button}
          onPress={this.reset}
        >
          <Text style={styles.buttonText}>重试</Text>
        </Pressable>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    backgroundColor: Colors.background,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: Colors.onBackground,
    marginBottom: 8,
  },
  message: {
    fontSize: 13,
    color: Colors.outline,
    textAlign: "center",
    marginBottom: 20,
  },
  button: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 999,
    backgroundColor: Colors.primary,
  },
  buttonText: {
    color: Colors.onPrimary,
    fontSize: 14,
    fontWeight: "600",
  },
});
