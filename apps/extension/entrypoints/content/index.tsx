import ReactDOM from "react-dom/client";
import { createShadowRootUi } from "wxt/utils/content-script-ui/shadow-root";
import { defineContentScript } from "wxt/utils/define-content-script";
import { createTranslationDisplayController } from "@/utils/translation-display";
import { TranslationToggle } from "./TranslationToggle";
import "@/assets/translation-display.css";
import toggleCss from "./translation-toggle.css?inline";

export default defineContentScript({
  matches: ["<all_urls>"],
  async main(ctx) {
    const controller = createTranslationDisplayController(document);
    ctx.onInvalidated(() => controller.destroy());

    // 사이트 CSS가 버튼을 바꾸지 못하도록 shadow root 안에 그린다. 확장이 내려가면 WXT가 제거한다.
    const toggleUi = await createShadowRootUi(ctx, {
      name: "opener-translation-toggle",
      position: "inline",
      anchor: "body",
      css: toggleCss,
      onMount: (container) => {
        const root = ReactDOM.createRoot(container);
        root.render(<TranslationToggle controller={controller} />);
        return root;
      },
      onRemove: (root) => root?.unmount(),
    });
    toggleUi.mount();
  },
});
