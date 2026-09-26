import { useState } from "react";
import type { TranslationDisplayController } from "@/utils/translation-display";

interface TranslationToggleProps {
  controller: TranslationDisplayController;
}

/** 번역 표시를 켜고 끄는 버튼. 컨트롤러는 만들 때 켜지므로 켜진 상태에서 시작한다. */
export function TranslationToggle({ controller }: TranslationToggleProps) {
  const [enabled, setEnabled] = useState(true);

  const toggle = () => {
    if (enabled) controller.disable();
    else controller.enable();
    setEnabled(!enabled);
  };

  return (
    <button type="button" aria-pressed={enabled} onClick={toggle}>
      {enabled ? "번역 표시 끄기" : "번역 표시 켜기"}
    </button>
  );
}
