import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useCropFormState } from "./useCropFormState";

const crops = [
  {
    id: 1,
    name: "Tomato",
    variety: "Roma",
    source: "manual",
    source_url: "",
    image_url: "",
    external_product_id: "",
    family: "Nightshade",
    spacing_in: 12,
    row_spacing_in: 18,
    in_row_spacing_in: 12,
    days_to_harvest: 70,
    planting_window: "Spring",
    direct_sow: false,
    frost_hardy: false,
    weeks_to_transplant: 6,
    notes: "",
  },
] as const;

describe("useCropFormState", () => {
  it("filters/selects crops and submits new template", async () => {
    const fetchAuthed = vi.fn(async () => ({ ...crops[0] })) as unknown as <T = unknown>(
      path: string,
      options?: RequestInit,
    ) => Promise<T>;
    const setSelectedCropName = vi.fn();
    const loadCropTemplates = vi.fn(async () => undefined);
    const loadGardenData = vi.fn(async () => undefined);
    const refreshTasks = vi.fn(async () => undefined);
    const pushNotice = vi.fn();

    const { result } = renderHook(() =>
      useCropFormState({
        fetchAuthed,
        pushNotice,
        selectedCropName: "Tomato",
        setSelectedCropName,
        loadCropTemplates,
        selectedGarden: 1,
        loadGardenData,
        cropTemplates: [...crops],
        refreshTasks,
      }),
    );

    act(() => {
      result.current.setCropSearchQuery("roma");
    });
    expect(result.current.filteredCropTemplates.length).toBe(1);

    act(() => {
      result.current.selectCrop(crops[0]);
      result.current.populateCropForm(crops[0]);
      result.current.setNewCropName("Pepper");
    });

    const form = document.createElement("form");
    await act(async () => {
      await result.current.upsertCropTemplate({ preventDefault: vi.fn(), currentTarget: form } as unknown as React.FormEvent<HTMLFormElement>);
    });

    expect(loadCropTemplates).toHaveBeenCalled();
    expect(loadGardenData).toHaveBeenCalled();
    expect(refreshTasks).toHaveBeenCalled();
    expect(pushNotice).toHaveBeenCalledWith("Vegetable updated.", "success");

    act(() => {
      result.current.resetCropForm();
    });
    expect(result.current.newCropName).toBe("");
    expect(setSelectedCropName).toHaveBeenCalledWith("Tomato");
  });

  it("shows error notice when upsert fails", async () => {
    const fetchAuthed = vi.fn(async () => {
      throw new Error("Crop save failed");
    }) as unknown as <T = unknown>(
      path: string,
      options?: RequestInit,
    ) => Promise<T>;
    const pushNotice = vi.fn();

    const { result } = renderHook(() =>
      useCropFormState({
        fetchAuthed,
        pushNotice,
        selectedCropName: "Tomato",
        setSelectedCropName: vi.fn(),
        loadCropTemplates: vi.fn(async () => undefined),
        selectedGarden: 1,
        loadGardenData: vi.fn(async () => undefined),
        cropTemplates: [...crops],
        refreshTasks: vi.fn(async () => undefined),
      }),
    );

    act(() => {
      result.current.setNewCropName("Pepper");
    });

    const form = document.createElement("form");
    await act(async () => {
      await result.current.upsertCropTemplate({
        preventDefault: vi.fn(),
        currentTarget: form,
      } as unknown as React.FormEvent<HTMLFormElement>);
    });

    expect(pushNotice).toHaveBeenCalledWith("Crop save failed", "error");
  });
});
