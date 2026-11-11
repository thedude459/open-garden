-- Move every plant to the open-garden-data catalog (ADR 0020) without losing
-- a planting, calendar entry, favorite, or companion pair.
--
-- plant_key_map: old species|cultivar variety keys (the fixture and Perenual
-- sources) to dataset ids, generated from dataset v0.1.0. A crop's own key is
-- left out when two crops share a species (bush and pole bean; pumpkin and
-- summer squash).
CREATE TEMP TABLE plant_key_map (old_key text PRIMARY KEY, new_key text NOT NULL);

INSERT INTO plant_key_map (old_key, new_key) VALUES
  ('malus domestica|', 'dataset:apple'),
  ('malus domestica|honeycrisp', 'dataset:apple-honeycrisp'),
  ('asparagus officinalis|', 'dataset:asparagus'),
  ('asparagus officinalis|mary washington', 'dataset:asparagus-mary-washington'),
  ('ocimum basilicum|', 'dataset:basil'),
  ('ocimum basilicum|genovese', 'dataset:basil-genovese'),
  ('beta vulgaris|', 'dataset:beet'),
  ('beta vulgaris|detroit dark red', 'dataset:beet-detroit-dark-red'),
  ('rubus fruticosus|', 'dataset:blackberry'),
  ('rubus fruticosus|triple crown', 'dataset:blackberry-triple-crown'),
  ('vaccinium corymbosum|', 'dataset:blueberry'),
  ('vaccinium corymbosum|bluecrop', 'dataset:blueberry-bluecrop'),
  ('brassica oleracea var. italica|', 'dataset:broccoli'),
  ('brassica oleracea var. italica|waltham 29', 'dataset:broccoli-waltham-29'),
  ('brassica oleracea var. gemmifera|', 'dataset:brussels-sprouts'),
  ('brassica oleracea var. gemmifera|long island improved', 'dataset:brussels-sprouts-long-island-improved'),
  ('phaseolus vulgaris|provider', 'dataset:bush-bean-provider'),
  ('brassica oleracea var. capitata|', 'dataset:cabbage'),
  ('brassica oleracea var. capitata|golden acre', 'dataset:cabbage-golden-acre'),
  ('daucus carota subsp. sativus|', 'dataset:carrot'),
  ('daucus carota subsp. sativus|danvers', 'dataset:carrot-danvers'),
  ('brassica oleracea var. botrytis|', 'dataset:cauliflower'),
  ('brassica oleracea var. botrytis|snowball', 'dataset:cauliflower-snowball'),
  ('apium graveolens var. dulce|', 'dataset:celery'),
  ('apium graveolens var. dulce|tall utah', 'dataset:celery-tall-utah'),
  ('allium schoenoprasum|', 'dataset:chives'),
  ('coriandrum sativum|', 'dataset:cilantro'),
  ('coriandrum sativum|santo', 'dataset:cilantro-santo'),
  ('cucumis sativus|', 'dataset:cucumber'),
  ('cucumis sativus|marketmore 76', 'dataset:cucumber-marketmore-76'),
  ('anethum graveolens|', 'dataset:dill'),
  ('anethum graveolens|bouquet', 'dataset:dill-bouquet'),
  ('solanum melongena|', 'dataset:eggplant'),
  ('solanum melongena|black beauty', 'dataset:eggplant-black-beauty'),
  ('allium sativum|', 'dataset:garlic'),
  ('allium sativum|music', 'dataset:garlic-music'),
  ('brassica oleracea var. sabellica|', 'dataset:kale'),
  ('brassica oleracea var. sabellica|lacinato', 'dataset:kale-lacinato'),
  ('allium ampeloprasum|', 'dataset:leek'),
  ('allium ampeloprasum|american flag', 'dataset:leek-american-flag'),
  ('lactuca sativa|', 'dataset:lettuce'),
  ('lactuca sativa|buttercrunch', 'dataset:lettuce-buttercrunch'),
  ('cucumis melo|', 'dataset:melon'),
  ('cucumis melo|hale''s best jumbo', 'dataset:melon-hales-best-jumbo'),
  ('mentha spicata|', 'dataset:mint'),
  ('mentha spicata|spearmint', 'dataset:mint-spearmint'),
  ('abelmoschus esculentus|', 'dataset:okra'),
  ('abelmoschus esculentus|clemson spineless', 'dataset:okra-clemson-spineless'),
  ('allium cepa|', 'dataset:onion'),
  ('origanum vulgare|', 'dataset:oregano'),
  ('origanum vulgare|greek', 'dataset:oregano-greek'),
  ('petroselinum crispum|', 'dataset:parsley'),
  ('petroselinum crispum|giant of italy', 'dataset:parsley-giant-of-italy'),
  ('pastinaca sativa|', 'dataset:parsnip'),
  ('pastinaca sativa|hollow crown', 'dataset:parsnip-hollow-crown'),
  ('pisum sativum|', 'dataset:pea'),
  ('pisum sativum|sugar snap', 'dataset:pea-sugar-snap'),
  ('prunus persica|', 'dataset:peach'),
  ('prunus persica|redhaven', 'dataset:peach-redhaven'),
  ('pyrus communis|', 'dataset:pear'),
  ('pyrus communis|bartlett', 'dataset:pear-bartlett'),
  ('phaseolus vulgaris|kentucky wonder', 'dataset:pole-bean-kentucky-wonder'),
  ('solanum tuberosum|', 'dataset:potato'),
  ('solanum tuberosum|yukon gold', 'dataset:potato-yukon-gold'),
  ('cucurbita pepo|connecticut field', 'dataset:pumpkin-connecticut-field'),
  ('raphanus sativus|', 'dataset:radish'),
  ('raphanus sativus|cherry belle', 'dataset:radish-cherry-belle'),
  ('rubus idaeus|', 'dataset:raspberry'),
  ('rubus idaeus|heritage', 'dataset:raspberry-heritage'),
  ('rheum rhabarbarum|', 'dataset:rhubarb'),
  ('rheum rhabarbarum|victoria', 'dataset:rhubarb-victoria'),
  ('spinacia oleracea|', 'dataset:spinach'),
  ('spinacia oleracea|bloomsdale', 'dataset:spinach-bloomsdale'),
  ('fragaria × ananassa|', 'dataset:strawberry'),
  ('fragaria × ananassa|albion', 'dataset:strawberry-albion'),
  ('cucurbita pepo|black beauty', 'dataset:summer-squash-black-beauty'),
  ('prunus avium|', 'dataset:sweet-cherry'),
  ('prunus avium|stella', 'dataset:sweet-cherry-stella'),
  ('zea mays|', 'dataset:sweet-corn'),
  ('zea mays|golden bantam', 'dataset:sweet-corn-golden-bantam'),
  ('capsicum annuum|', 'dataset:sweet-pepper'),
  ('capsicum annuum|california wonder', 'dataset:sweet-pepper-california-wonder'),
  ('ipomoea batatas|', 'dataset:sweet-potato'),
  ('ipomoea batatas|beauregard', 'dataset:sweet-potato-beauregard'),
  ('beta vulgaris subsp. vulgaris|', 'dataset:swiss-chard'),
  ('beta vulgaris subsp. vulgaris|bright lights', 'dataset:swiss-chard-bright-lights'),
  ('thymus vulgaris|', 'dataset:thyme'),
  ('solanum lycopersicum|', 'dataset:tomato'),
  ('solanum lycopersicum|cherry', 'dataset:tomato-cherry'),
  ('citrullus lanatus|', 'dataset:watermelon'),
  ('citrullus lanatus|sugar baby', 'dataset:watermelon-sugar-baby'),
  ('cucurbita moschata|', 'dataset:winter-squash'),
  ('cucurbita moschata|waltham butternut', 'dataset:winter-squash-waltham-butternut');

-- old_id -> new_id where the dataset row already exists (the dataset was
-- imported before this migration).
CREATE TEMP TABLE plant_id_map AS
SELECT o.id AS old_id, n.id AS new_id
FROM plant_key_map m
JOIN plants o ON o.variety_key = m.old_key
JOIN plants n ON n.variety_key = m.new_key;

UPDATE garden_plantings p SET plant_id = m.new_id
FROM plant_id_map m WHERE p.plant_id = m.old_id;

-- One calendar entry and one favorite per plant: keep the dataset plant's.
DELETE FROM garden_calendar_entries e USING plant_id_map m
WHERE e.plant_id = m.old_id
  AND EXISTS (
    SELECT 1 FROM garden_calendar_entries d
    WHERE d.garden_id = e.garden_id AND d.plant_id = m.new_id
  );
UPDATE garden_calendar_entries e SET plant_id = m.new_id
FROM plant_id_map m WHERE e.plant_id = m.old_id;

DELETE FROM favorites f USING plant_id_map m
WHERE f.plant_id = m.old_id
  AND EXISTS (SELECT 1 FROM favorites d WHERE d.user_id = f.user_id AND d.plant_id = m.new_id);
UPDATE favorites f SET plant_id = m.new_id
FROM plant_id_map m WHERE f.plant_id = m.old_id;

-- Companion pairs: rewrite both sides, then drop pairs that became a plant
-- with itself or a duplicate (of an existing pair, or of another rewritten one).
CREATE TEMP TABLE companion_pairs_mapped AS
SELECT c.id, c.garden_id, c.kind,
  COALESCE(a.new_id, c.plant_id) AS plant_id,
  COALESCE(b.new_id, c.other_plant_id) AS other_plant_id
FROM companion_pairs c
LEFT JOIN plant_id_map a ON a.old_id = c.plant_id
LEFT JOIN plant_id_map b ON b.old_id = c.other_plant_id
WHERE a.old_id IS NOT NULL OR b.old_id IS NOT NULL;

DELETE FROM companion_pairs c USING companion_pairs_mapped m
WHERE c.id = m.id
  AND (
    m.plant_id = m.other_plant_id
    OR EXISTS (
      SELECT 1 FROM companion_pairs d
      WHERE d.id <> c.id AND d.garden_id = m.garden_id AND d.kind = m.kind
        AND d.plant_id = m.plant_id AND d.other_plant_id = m.other_plant_id
        AND d.id NOT IN (SELECT id FROM companion_pairs_mapped)
    )
    OR EXISTS (
      SELECT 1 FROM companion_pairs_mapped o
      WHERE o.id < m.id AND o.garden_id = m.garden_id AND o.kind = m.kind
        AND o.plant_id = m.plant_id AND o.other_plant_id = m.other_plant_id
    )
  );
UPDATE companion_pairs c SET plant_id = m.plant_id, other_plant_id = m.other_plant_id
FROM companion_pairs_mapped m WHERE c.id = m.id;

-- Where no dataset row exists yet, the old row takes the dataset id; the
-- next import fills it with dataset values in place.
UPDATE plants p SET variety_key = m.new_key, updated_at = now()
FROM plant_key_map m
WHERE p.variety_key = m.old_key
  AND NOT EXISTS (SELECT 1 FROM plants n WHERE n.variety_key = m.new_key);

-- Everything not from the dataset (mapped-away rows, and plants with no
-- dataset equivalent such as Red Maple) stays so plantings keep their plant,
-- but leaves the catalog.
UPDATE plants SET status = 'deprecated', updated_at = now()
WHERE variety_key NOT LIKE 'dataset:%' AND status <> 'deprecated';

DROP TABLE companion_pairs_mapped;
DROP TABLE plant_id_map;
DROP TABLE plant_key_map;
