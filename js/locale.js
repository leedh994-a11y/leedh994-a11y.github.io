/** Sitp GPT locale — English default at /, Chinese at /zh/ */
export function getLocale() {
  if (typeof location !== "undefined") {
    if (location.pathname.startsWith("/zh")) return "zh";
    const lang = document.documentElement.lang || "";
    if (lang.startsWith("zh")) return "zh";
  }
  return "en";
}

export function localePath(path = "/") {
  const locale = getLocale();
  const p = path.startsWith("/") ? path : `/${path}`;
  if (locale === "zh") return p === "/" ? "/zh/" : `/zh${p}`;
  return p;
}

export const UI = {
  en: {
    allTools: "All Tools",
    useTool: "Use tool",
    run: "Run",
    convert: "Convert",
    send: "Send",
    generate: "Generate",
    analyze: "Analyze",
    reset: "Reset",
    copyResult: "Copy result",
    downloadResult: "Download",
    clearOutput: "Clear",
    output: "Output",
    inputSettings: "Input",
    emptyOutput: "Results will appear here after you run the tool.",
    emptyOutputHint: "Fill in the fields on the left, then click Run or press Ctrl+Enter.",
    paste: "Paste",
    clear: "Clear",
    chars: "chars",
    allToolsLink: "← All tools",
    moreTools: "More free tools",
    tryOthers: "Try our other tools!",
    toolNotFound: "Tool not found",
    backHome: "Back to tools",
    aiEnabled: "✓ AI features enabled",
    aiDisabled: "AI disabled — set OPENAI_API_KEY on the server",
    signIn: "Sign In",
    freeTrial: "Start free trial",
    langSwitch: "中文",
    langSwitchHref: "/zh/",
  },
  zh: {
    allTools: "全部工具",
    useTool: "使用工具",
    run: "执行",
    convert: "转换",
    send: "发送",
    generate: "生成",
    analyze: "分析",
    reset: "重置",
    copyResult: "复制结果",
    downloadResult: "下载",
    clearOutput: "清空",
    output: "输出结果",
    inputSettings: "输入",
    emptyOutput: "运行工具后，结果将显示在这里。",
    emptyOutputHint: "在左侧填写内容，然后点击执行或按 Ctrl+Enter。",
    paste: "粘贴",
    clear: "清空",
    chars: "字符",
    allToolsLink: "← 全部工具",
    moreTools: "更多免费工具",
    tryOthers: "试试我们的其他工具！",
    toolNotFound: "工具未找到",
    backHome: "返回工具列表",
    aiEnabled: "✓ AI 功能已启用",
    aiDisabled: "AI 功能未启用 — 设置 OPENAI_API_KEY 后重启",
    signIn: "登入",
    freeTrial: "免费试用",
    langSwitch: "English",
    langSwitchHref: "/",
  },
};

export function t(key) {
  const locale = getLocale();
  return UI[locale]?.[key] ?? UI.en[key] ?? key;
}
