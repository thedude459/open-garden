export type PlantCategory =
  | "vegetable"
  | "herb"
  | "fruit"
  | "berry"
  | "fruit_tree"
  | "nut_tree"
  | "shrub"
  | "cover_crop"
  | "companion_flower"
  | "guild_plant";

export type SunExposure = "full" | "partial" | "shade";

export type Vigor = "dwarf" | "semi_dwarf" | "standard" | "vigorous";

export const PLANT_CATEGORIES: PlantCategory[] = [
  "vegetable",
  "herb",
  "fruit",
  "berry",
  "fruit_tree",
  "nut_tree",
  "shrub",
  "cover_crop",
  "companion_flower",
  "guild_plant",
];
