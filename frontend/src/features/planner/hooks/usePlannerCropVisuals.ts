import { useCallback, useMemo } from "react";
import { CropTemplate } from "../../types";

const FALLBACK_ICONS = ["🌱", "🥕", "🍅", "🥬", "🫑", "🥦", "🧅", "🌿", "🍆", "🌶️", "🫘"];

export function usePlannerCropVisuals(cropTemplates: CropTemplate[]) {
  const cropTemplateByName = useMemo(
    () => new Map(cropTemplates.map((crop) => [crop.name.toLowerCase(), crop])),
    [cropTemplates],
  );

  const pickCropIcon = useCallback((cropName: string) => {
    const lowerName = cropName.trim().toLowerCase();
    const crop = cropTemplateByName.get(lowerName);
    const family = crop?.family.trim().toLowerCase() || "";
    const lookup = `${lowerName} ${family}`;

    if (/(tomato)/.test(lookup)) return "🍅";
    if (/(pepper|chile|capsicum)/.test(lookup)) return "🫑";
    if (/(eggplant|aubergine)/.test(lookup)) return "🍆";
    if (/(carrot|parsnip|radish|beet|turnip)/.test(lookup)) return "🥕";
    if (/(onion|garlic|allium|shallot|leek|chive)/.test(lookup)) return "🧅";
    if (/(lettuce|spinach|chard|kale|collard|cabbage|brassica|greens)/.test(lookup)) return "🥬";
    if (/(broccoli|cauliflower|brussels)/.test(lookup)) return "🥦";
    if (/(bean|pea|legume)/.test(lookup)) return "🫘";
    if (/(corn|maize)/.test(lookup)) return "🌽";
    if (/(cucumber|zucchini|squash|pumpkin|melon)/.test(lookup)) return "🥒";
    if (/(herb|basil|cilantro|parsley|dill|oregano|thyme|rosemary|mint)/.test(lookup)) return "🌿";

    const hash = lowerName.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return FALLBACK_ICONS[hash % FALLBACK_ICONS.length] || "🌱";
  }, [cropTemplateByName]);

  const cropVisual = useCallback((cropName: string) => {
    const template = cropTemplateByName.get(cropName.trim().toLowerCase());
    return {
      imageUrl: template?.image_url || "",
      icon: pickCropIcon(cropName),
    };
  }, [cropTemplateByName, pickCropIcon]);

  return { cropVisual };
}
