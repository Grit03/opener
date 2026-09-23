import { defineContentScript } from "wxt/utils/define-content-script";
import { createTranslationDisplayController } from "../utils/translation-display";
import "../assets/translation-display.css";

export default defineContentScript({
  matches: ["<all_urls>"],
  main() {
    const controller = createTranslationDisplayController(document);
    return () => controller.destroy();
  },
});
