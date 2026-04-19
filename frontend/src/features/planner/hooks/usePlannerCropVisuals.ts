import { useCallback, useMemo } from "react";
import defaultPlantPhoto from "../../../assets/plants/default-plant-photo.svg";
import { CropTemplate } from "../../types";

function inferCropEmoji(cropName: string, family?: string | null) {
  const label = `${cropName} ${family || ""}`.toLowerCase();

  if (/tomato|pepper|chili|nightshade/.test(label)) return "🍅";
  if (/lettuce|kale|cabbage|brassica|spinach|chard/.test(label)) return "🥬";
  if (/carrot|beet|radish|turnip|root/.test(label)) return "🥕";
  if (/onion|garlic|leek|allium/.test(label)) return "🧅";
  if (/bean|pea|legume/.test(label)) return "🫛";
  if (/corn|maize|grass/.test(label)) return "🌽";
  if (/squash|pumpkin|cucumber|melon|zucchini|gourd/.test(label)) return "🎃";
  if (/strawberry|berry/.test(label)) return "🍓";
  if (/herb|mint|basil|oregano|thyme|parsley|cilantro|dill/.test(label)) return "🌿";
  return "🌱";
}

export function usePlannerCropVisuals(cropTemplates: CropTemplate[]) {
  const cropTemplateByName = useMemo(
    () => new Map(cropTemplates.map((crop) => [crop.name.toLowerCase(), crop])),
    [cropTemplates],
  );

  const cropVisual = useCallback((cropName: string) => {
    const template = cropTemplateByName.get(cropName.trim().toLowerCase());
    return {
      imageUrl: template?.image_url?.trim() || defaultPlantPhoto,
      rowSpacingIn: Math.max(1, template?.row_spacing_in || 18),
      inRowSpacingIn: Math.max(1, template?.in_row_spacing_in || 12),
      emoji: inferCropEmoji(cropName, template?.family),
    };
  }, [cropTemplateByName]);

  return { cropVisual };
}
