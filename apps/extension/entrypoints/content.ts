import { defineContentScript } from "wxt/utils/define-content-script";

export default defineContentScript({
  matches: ["*://*.google.com/*", "http://localhost/*"],
  main() {
    console.log("Hello content.");
  },
});
