package com.lijitea.alioneclick

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

/**
 * 阿里云一键登录 React Package
 *
 * 职责：注册 AliOneClickModule，使其可在 React Native 侧被访问
 * 遵循 SOLID-Single：一个 Package 只注册同一功能域的模块
 */
class AliOneClickPackage : ReactPackage {

    /**
     * 创建并返回该 Package 包含的所有原生模块
     *
     * @param reactContext React Native 应用上下文
     * @return 模块列表
     */
    override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> {
        return listOf(AliOneClickModule(reactContext))
    }

    /**
     * 创建并返回该 Package 包含的所有视图管理器
     *
     * @param reactContext React Native 应用上下文
     * @return 视图管理器列表（一键登录无需视图，此处返回空列表）
     */
    override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> {
        return emptyList()
    }
}
