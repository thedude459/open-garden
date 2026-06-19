"use client";

interface LinkOffer {
  id: string;
  commonName: string;
}

interface ProvisionalLinkOfferProps {
  offers: LinkOffer[];
  onConfirm: (provisionalId: string, canonicalPlantId: string) => Promise<void>;
  canonicalPlantId: string;
}

export function ProvisionalLinkOffer({
  offers,
  onConfirm,
  canonicalPlantId,
}: ProvisionalLinkOfferProps) {
  if (offers.length === 0) return null;

  return (
    <div className="card stack">
      <h2>Link offers</h2>
      {offers.map((offer) => (
        <div className="row" key={offer.id}>
          <span>
            Match found for <strong>{offer.commonName}</strong>
          </span>
          <button
            className="btn secondary"
            type="button"
            onClick={() => onConfirm(offer.id, canonicalPlantId)}
          >
            Link to catalog entry
          </button>
        </div>
      ))}
    </div>
  );
}
