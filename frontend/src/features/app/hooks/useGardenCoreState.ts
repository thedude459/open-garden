import { useEffect, useRef, useState } from "react";
import { Bed, CropTemplate, Garden, Placement, Planting } from "../../types";
import { CacheEntry } from "../utils/cacheUtils";

type WeatherResponse = {
  [key: string]: unknown;
};

export function useGardenCoreState() {
  const [gardens, setGardens] = useState<Garden[]>([]);
  const [publicGardens, setPublicGardens] = useState<Garden[]>([]);
  const [selectedGarden, setSelectedGarden] = useState<number | null>(null);
  const [beds, setBeds] = useState<Bed[]>([]);
  const [plantings, setPlantings] = useState<Planting[]>([]);
  const [cropTemplates, setCropTemplates] = useState<CropTemplate[]>([]);
  const [placements, setPlacements] = useState<Placement[]>([]);
  const [weather, setWeather] = useState<WeatherResponse | null>(null);
  const [isLoadingGardenData, setIsLoadingGardenData] = useState(false);
  const [isLoadingWeather, setIsLoadingWeather] = useState(false);
  const [selectedCropName, setSelectedCropName] = useState("");

  const gardensRef = useRef<Garden[]>([]);
  const selectedGardenRef = useRef<number | null>(null);
  const weatherCacheRef = useRef<Map<number, CacheEntry<WeatherResponse>>>(new Map());

  useEffect(() => {
    gardensRef.current = gardens;
  }, [gardens]);

  useEffect(() => {
    selectedGardenRef.current = selectedGarden;
  }, [selectedGarden]);

  return {
    gardens,
    setGardens,
    publicGardens,
    setPublicGardens,
    selectedGarden,
    setSelectedGarden,
    beds,
    setBeds,
    plantings,
    setPlantings,
    cropTemplates,
    setCropTemplates,
    placements,
    setPlacements,
    weather,
    setWeather,
    isLoadingGardenData,
    setIsLoadingGardenData,
    isLoadingWeather,
    setIsLoadingWeather,
    selectedCropName,
    setSelectedCropName,
    gardensRef,
    selectedGardenRef,
    weatherCacheRef,
  };
}
