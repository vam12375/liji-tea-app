const { getDefaultConfig } = require("expo/metro-config");
const { withNativewind } = require("nativewind/metro");

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// 指定 CSS 入口文件，确保 NativeWind v5 加载自定义 @theme 设计 Token
module.exports = withNativewind(config, { input: "./global.css" });
