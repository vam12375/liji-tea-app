/** 单进程测试工具，避免 Node test runner 在沙箱里起子进程失败。 */
export async function runCase(name: string, test: () => void | Promise<void>) {
  try {
    await test();
    console.log(`  [PASS] ${name}`);
  } catch (error) {
    console.error(`  [FAIL] ${name}`);
    throw error;
  }
}
