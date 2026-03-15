from .models import CropTemplate

# Data curated from garden.plantatlas.ai — covers common edible crops with
# spacing, timing, starting method, frost tolerance and care notes.
STARTER_CROPS = [
    # ── Solanaceae (warm-season; start indoors; NOT frost hardy) ──────────────
    {
        "name": "Tomato", "variety": "Roma", "family": "Solanaceae",
        "spacing_in": 24, "days_to_harvest": 75,
        "planting_window": "After last frost — soil must be >60 °F (zones 3-6: late May/June; zones 7-9: Apr-May)",
        "direct_sow": False, "frost_hardy": False, "weeks_to_transplant": 8,
        "notes": "Stake or cage plants. Water deeply 1–1.5 in/week at the base; mulch to reduce blight splash. "
                 "Pinch suckers for indeterminate varieties. Watch for hornworms and early blight.",
    },
    {
        "name": "Bell Pepper", "variety": "California Wonder", "family": "Solanaceae",
        "spacing_in": 18, "days_to_harvest": 85,
        "planting_window": "After last frost — soil >65 °F (zones 3-6: early June; zones 7-9: late Apr-May)",
        "direct_sow": False, "frost_hardy": False, "weeks_to_transplant": 10,
        "notes": "Slow to establish; requires warm nights. Stake in windy spots. Feed with low-nitrogen "
                 "fertiliser once flowering begins. Aphids and pepper maggots are common pests.",
    },
    {
        "name": "Eggplant", "variety": "Black Beauty", "family": "Solanaceae",
        "spacing_in": 18, "days_to_harvest": 80,
        "planting_window": "After last frost — needs warmth (best zones 6-10)",
        "direct_sow": False, "frost_hardy": False, "weeks_to_transplant": 10,
        "notes": "Loves heat; use black plastic mulch in cooler zones. Harvest when skin is glossy. "
                 "Susceptible to flea beetles — row cover early on.",
    },
    # ── Cucurbitaceae (warm-season; direct sow; NOT frost hardy) ─────────────
    {
        "name": "Zucchini", "variety": "Black Beauty", "family": "Cucurbitaceae",
        "spacing_in": 36, "days_to_harvest": 55,
        "planting_window": "After last frost — soil >60 °F (zones 3-6: late May/June; zones 7+: May)",
        "direct_sow": True, "frost_hardy": False, "weeks_to_transplant": 4,
        "notes": "Very productive — harvest small (6–8 in) for best flavour. Water 1–2 in/week; avoid wetting "
                 "foliage to prevent powdery mildew. Watch for squash vine borers in midsummer.",
    },
    {
        "name": "Cucumber", "variety": "Marketmore", "family": "Cucurbitaceae",
        "spacing_in": 12, "days_to_harvest": 60,
        "planting_window": "After last frost — soil >60 °F; trellis to save space",
        "direct_sow": True, "frost_hardy": False, "weeks_to_transplant": 3,
        "notes": "Train up a trellis for straighter fruit and better airflow. Keep soil consistently moist; "
                 "irregular watering causes bitter fruit. Check for cucumber beetles.",
    },
    {
        "name": "Pumpkin", "variety": "Connecticut Field", "family": "Cucurbitaceae",
        "spacing_in": 48, "days_to_harvest": 105,
        "planting_window": "After last frost; count back from first fall frost for harvest date",
        "direct_sow": True, "frost_hardy": False, "weeks_to_transplant": 3,
        "notes": "Give plenty of space — vines can reach 15 ft. Plant on a slight mound for drainage. "
                 "Hand-pollinate in poor bee years. Cure harvested pumpkins 10 days at 80 °F.",
    },
    # ── Brassicaceae (cool-season; frost hardy; transplants or direct) ────────
    {
        "name": "Broccoli", "variety": "Calabrese", "family": "Brassicaceae",
        "spacing_in": 18, "days_to_harvest": 80,
        "planting_window": "Start indoors 6 wks before last frost for spring; OR direct sow mid-summer for fall crop",
        "direct_sow": False, "frost_hardy": True, "weeks_to_transplant": 6,
        "notes": "Tolerates light frost (to 26 °F). Cut main head before flowers open; side shoots follow. "
                 "Watch for cabbage worms and aphids. Stagger plantings every 2–3 weeks for longer harvest.",
    },
    {
        "name": "Cabbage", "variety": "Golden Acre", "family": "Brassicaceae",
        "spacing_in": 18, "days_to_harvest": 70,
        "planting_window": "Spring: transplant 4 wks before last frost; Fall: transplant 8 wks before first frost",
        "direct_sow": False, "frost_hardy": True, "weeks_to_transplant": 6,
        "notes": "Consistent moisture prevents head cracking. Add lime if pH < 6.5 to reduce clubroot. "
                 "Row covers deter moths early in the season.",
    },
    {
        "name": "Kale", "variety": "Lacinato", "family": "Brassicaceae",
        "spacing_in": 15, "days_to_harvest": 55,
        "planting_window": "Early spring (6 wks before last frost) or late summer for fall/winter harvest",
        "direct_sow": True, "frost_hardy": True, "weeks_to_transplant": 4,
        "notes": "Flavour improves after light frost. Harvest outer leaves regularly. Very cold hardy (to 10 °F "
                 "in zones 7+). Aphids can cluster on undersides — knock off with water spray.",
    },
    {
        "name": "Radish", "variety": "Cherry Belle", "family": "Brassicaceae",
        "spacing_in": 3, "days_to_harvest": 25,
        "planting_window": "Direct sow as soon as soil is workable (spring and fall); avoid summer heat",
        "direct_sow": True, "frost_hardy": True, "weeks_to_transplant": 0,
        "notes": "Fastest crop in the garden — great for interplanting. Bolt quickly in heat; sow every "
                 "2 weeks for continuous supply. Thin promptly for good root development.",
    },
    # ── Apiaceae (cool-season; frost tolerant; direct sow mostly) ─────────────
    {
        "name": "Carrot", "variety": "Nantes", "family": "Apiaceae",
        "spacing_in": 3, "days_to_harvest": 70,
        "planting_window": "Direct sow 4–6 wks before last frost; soil 45–85 °F for germination",
        "direct_sow": True, "frost_hardy": True, "weeks_to_transplant": 0,
        "notes": "Needs deep (12 in), loose, stone-free soil. Slow to germinate (14–21 days) — keep soil moist. "
                 "Thin to 3 in apart. Sweetens after light frost. Mulch in fall to extend harvest.",
    },
    {
        "name": "Celery", "variety": "Tall Utah", "family": "Apiaceae",
        "spacing_in": 12, "days_to_harvest": 100,
        "planting_window": "Start indoors 10–12 wks before last frost; needs long cool season",
        "direct_sow": False, "frost_hardy": True, "weeks_to_transplant": 10,
        "notes": "Moisture-hungry — needs 1–2 in/week. Mound soil around stalks to blanch and sweeten. "
                 "Best in zones 5-7; challenging in zones 3-4 (short season) and zones 8+ (too hot).",
    },
    # ── Fabaceae (warm/cool depending on type; direct sow) ────────────────────
    {
        "name": "Green Bean", "variety": "Provider", "family": "Fabaceae",
        "spacing_in": 6, "days_to_harvest": 55,
        "planting_window": "After last frost — soil >60 °F; direct sow every 2 weeks for continuous harvest",
        "direct_sow": True, "frost_hardy": False, "weeks_to_transplant": 0,
        "notes": "Bush variety — no support needed. Improves soil via nitrogen fixation. Pick pods when pencil-thin. "
                 "Avoid working around plants when wet to prevent disease spread.",
    },
    {
        "name": "Pea", "variety": "Sugar Snap", "family": "Fabaceae",
        "spacing_in": 6, "days_to_harvest": 65,
        "planting_window": "Direct sow 4–6 wks before last frost; tolerates light frost once sprouted",
        "direct_sow": True, "frost_hardy": True, "weeks_to_transplant": 0,
        "notes": "Provide trellis or netting (4–6 ft). Yields drop sharply in heat — time for harvest before "
                 "summer arrives. Inoculate seeds with rhizobium for best nitrogen fixation.",
    },
    # ── Amaranthaceae (cool-season; frost hardy; direct sow) ─────────────────
    {
        "name": "Beet", "variety": "Detroit Dark Red", "family": "Amaranthaceae",
        "spacing_in": 4, "days_to_harvest": 60,
        "planting_window": "Direct sow 4 wks before last frost; also sow mid-summer for fall harvest",
        "direct_sow": True, "frost_hardy": True, "weeks_to_transplant": 0,
        "notes": "Each 'seed' is actually a cluster — thin to 4 in for best roots. Both roots and greens are edible. "
                 "Tolerates light frost; mulch for extended fall harvest. Add boron if leaves curl.",
    },
    {
        "name": "Spinach", "variety": "Bloomsdale", "family": "Amaranthaceae",
        "spacing_in": 6, "days_to_harvest": 40,
        "planting_window": "Direct sow early spring or late summer; bolts quickly in heat (>75 °F)",
        "direct_sow": True, "frost_hardy": True, "weeks_to_transplant": 0,
        "notes": "Short harvest window — harvest outer leaves or cut whole plant. Very cold hardy (to 15 °F with "
                 "mulch). Needs fertile soil high in nitrogen. Downy mildew is the main disease risk.",
    },
    {
        "name": "Swiss Chard", "variety": "Rainbow", "family": "Amaranthaceae",
        "spacing_in": 12, "days_to_harvest": 60,
        "planting_window": "Direct sow after last frost or 4 wks before; tolerates heat and light frost",
        "direct_sow": True, "frost_hardy": True, "weeks_to_transplant": 0,
        "notes": "Cut-and-come-again crop. Tolerates heat better than spinach. Harvest outer stalks continuously. "
                 "Watch for leaf miners — remove affected leaves immediately.",
    },
    # ── Alliaceae (long season; frost hardy) ─────────────────────────────────
    {
        "name": "Onion", "variety": "Walla Walla", "family": "Alliaceae",
        "spacing_in": 4, "days_to_harvest": 100,
        "planting_window": "Start indoors 10–12 wks before last frost; choose variety for your day-length (long/short-day)",
        "direct_sow": False, "frost_hardy": True, "weeks_to_transplant": 10,
        "notes": "Day-length drives bulbing — long-day for zones 6+, short-day for zones 7 and south. "
                 "Cease watering when tops fall over. Cure in warm dry air 2–4 weeks before storage.",
    },
    {
        "name": "Garlic", "variety": "Hardneck", "family": "Alliaceae",
        "spacing_in": 6, "days_to_harvest": 240,
        "planting_window": "Plant cloves in fall (Oct-Nov) for summer harvest; zones 3-6: before ground freezes",
        "direct_sow": True, "frost_hardy": True, "weeks_to_transplant": 0,
        "notes": "Plant pointy side up, 2 in deep. Mulch heavily over winter. Remove scapes in early summer to "
                 "boost bulb size. Harvest when bottom 1/3 of leaves are brown. Cure 4–6 weeks.",
    },
    # ── Asteraceae / Compositae ───────────────────────────────────────────────
    {
        "name": "Lettuce", "variety": "Butterhead", "family": "Asteraceae",
        "spacing_in": 10, "days_to_harvest": 45,
        "planting_window": "Direct sow from 4 wks before last frost; sow every 2 weeks; shade in summer",
        "direct_sow": True, "frost_hardy": True, "weeks_to_transplant": 0,
        "notes": "Bolts in temperatures above 80 °F — choose heat-tolerant varieties for summer. "
                 "Cut whole head or harvest outer leaves. Keep soil consistently moist for tender leaves.",
    },
    # ── Lamiaceae (herbs) ────────────────────────────────────────────────────
    {
        "name": "Basil", "variety": "Genovese", "family": "Lamiaceae",
        "spacing_in": 12, "days_to_harvest": 60,
        "planting_window": "After last frost; soil and air must be reliably warm (>55 °F nights)",
        "direct_sow": False, "frost_hardy": False, "weeks_to_transplant": 6,
        "notes": "Frost-sensitive — protect at even a whisper of frost. Pinch flower buds to extend leaf harvest. "
                 "Grows well alongside tomatoes. Water at base; wet leaves invite disease.",
    },
    {
        "name": "Mint", "variety": "Spearmint", "family": "Lamiaceae",
        "spacing_in": 18, "days_to_harvest": 90,
        "planting_window": "Transplant after last frost; contains in pots to prevent aggressive spreading",
        "direct_sow": False, "frost_hardy": True, "weeks_to_transplant": 6,
        "notes": "Highly invasive — grow in a buried pot or container to contain runners. "
                 "Cut back hard mid-season for fresh bushy growth. Perennial in zones 5+.",
    },
    # ── Poaceae ──────────────────────────────────────────────────────────────
    {
        "name": "Sweet Corn", "variety": "Honey Select", "family": "Poaceae",
        "spacing_in": 12, "days_to_harvest": 80,
        "planting_window": "Direct sow after last frost; soil >60 °F; plant in blocks (4+ rows) for pollination",
        "direct_sow": True, "frost_hardy": False, "weeks_to_transplant": 0,
        "notes": "Wind-pollinated — must plant in blocks, not single rows. Side-dress with nitrogen when knee-high. "
                 "Harvest when silks are dry and brown; kernels should squirt milky liquid when pierced.",
    },
    # ── Rosaceae (fruits) ────────────────────────────────────────────────────
    {
        "name": "Strawberry", "variety": "Honeoye", "family": "Rosaceae",
        "spacing_in": 12, "days_to_harvest": 60,
        "planting_window": "Transplant in early spring; June-bearers fruit in year 2; ever-bearers in year 1",
        "direct_sow": False, "frost_hardy": True, "weeks_to_transplant": 0,
        "notes": "Remove blossoms first year (June-bearers) to strengthen plants. Mulch with straw over winter. "
                 "Renovate bed after harvest — mow foliage, thin runners. Watch for slugs and gray mold.",
    },
]


def seed_crop_templates(db):
    def normalized_identity(name: str, variety: str = "") -> tuple[str, str]:
        clean_name = name.strip()
        clean_variety = variety.strip()
        if not clean_variety and clean_name.endswith(")") and " (" in clean_name:
            base, suffix = clean_name.rsplit(" (", 1)
            clean_name = base.strip()
            clean_variety = suffix[:-1].strip()
        return clean_name.lower(), clean_variety.lower()

    for crop_data in STARTER_CROPS:
        target = normalized_identity(crop_data["name"], crop_data.get("variety", ""))
        existing = next(
            (
                candidate
                for candidate in db.query(CropTemplate).all()
                if normalized_identity(candidate.name, candidate.variety) == target
            ),
            None,
        )
        if existing is None:
            db.add(CropTemplate(**crop_data))
        else:
            # Update all enriched fields so existing installs get the new data
            for key, value in crop_data.items():
                setattr(existing, key, value)
    db.commit()
