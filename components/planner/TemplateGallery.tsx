"use client";

import { useEffect, useState } from "react";
import type { GardenZoneType } from "@/lib/garden/enums";
import type { TemplateSummary } from "@/lib/planner/templates";
import { zoneTypeLabel } from "@/lib/planner/zone-plants";

interface TemplateGalleryProps {
  zoneType?: GardenZoneType;
  selectedTemplateId?: string | null;
  onSelectTemplate: (template: TemplateSummary | null) => void;
}

export function TemplateGallery({
  zoneType,
  selectedTemplateId,
  onSelectTemplate,
}: TemplateGalleryProps) {
  const [templates, setTemplates] = useState<TemplateSummary[]>([]);

  useEffect(() => {
    async function loadTemplates() {
      const query = zoneType ? `?zone_type=${encodeURIComponent(zoneType)}` : "";
      const response = await fetch(`/api/planner/templates${query}`);
      if (!response.ok) {
        return;
      }
      const body = await response.json();
      setTemplates(body.templates ?? []);
    }
    void loadTemplates();
  }, [zoneType]);

  return (
    <div className="stack">
      <h2>Starter templates</h2>
      <p className="field-label">Optional — pick a layout to pre-fill beds and structures.</p>
      <div className="template-gallery-grid">
        <button
          type="button"
          className={`template-card${selectedTemplateId == null ? " selected" : ""}`}
          onClick={() => onSelectTemplate(null)}
        >
          <span>Blank canvas</span>
        </button>
        {templates.map((template) => (
          <button
            key={template.id}
            type="button"
            className={`template-card${selectedTemplateId === template.id ? " selected" : ""}`}
            onClick={() => onSelectTemplate(template)}
          >
            <img
              src={template.preview_image_url}
              alt=""
              width={120}
              height={80}
              onError={(event) => {
                event.currentTarget.src = "/planner/categories/default.svg";
              }}
            />
            <strong>{template.name}</strong>
            <span className="field-label">{zoneTypeLabel(template.zone_type)}</span>
            <span className="field-label">{template.description}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
