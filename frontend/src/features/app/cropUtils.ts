import { CropTemplate } from "../types";
import { palette } from "./constants";

export function cropBaseName(crop: CropTemplate) {
  if (crop.variety && crop.name.endsWith(`(${crop.variety})`)) {
    return crop.name.slice(0, -(crop.variety.length + 3)).trim();
  }
  return crop.name;
}

export function cropDisplayName(crop: CropTemplate) {
  const baseName = cropBaseName(crop);
  if (!crop.variety) {
    return baseName;
  }
  return `${baseName} • ${crop.variety}`;
}

export function colorForCrop(name: string) {
  if (!name.trim()) {
    return palette[0];
  }
  const sum = name
    .trim()
    .toLowerCase()
    .split("")
    .reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return palette[sum % palette.length];
}
