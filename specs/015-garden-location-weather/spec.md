# Feature Specification: Garden Location and Weather

**Feature Branch**: `015-garden-location-weather`

**Created**: 2026-10-03

**Status**: Draft

**Input**: User description: "When a user creates a garden, they will need to input the address of the garden. Then I want to fill in the growing zone, first and last frost date for the user. I also want to have a google maps integration that shows where the garden is. I would also like to use this address information for weather details to be used with tasks like watering, if it is going to rain then that task does not need to be completed."

## Clarifications

### Session 2026-10-03

- Q: When rain is expected on the day a watering task is due, what should happen to that task? → A: Show it as not needed because rain is expected. Leave it visible, do not mark it done, and make it required again if the forecast dries out.
- Q: How much rain, and on which day, should make a watering task not needed? → A: At least a light rain (about a tenth of an inch) expected on the due day. Less than that, or rain on another day, does not count.
- Q: Where should members see the garden map? → A: On garden configuration only, with the address and season facts. Not on the bed layout. The map itself is OpenStreetMap, decided in the clarification below.
- Q: When the garden address changes, what should happen to zone and frost dates the gardener edited by hand? → A: Replace zone and frost from the new address and say they were updated. Keep hand edits only when the address stays the same.
- Q: Can a gardener save a new garden when the address cannot be confirmed yet? → A: New gardens require a confirmed address. Blank or unrecognized addresses are rejected. Older gardens with no address keep working until one is added.
- Q: Must a household buy a Google Maps key to look up an address and see the garden on a map? → A: No. Use OpenStreetMap. Address lookup and the garden map work with no paid API key and no billing account. This replaces the earlier choice of a Google map. The map still appears only on garden configuration, with the address and season facts, and not on the bed layout.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Record the Garden Address and See It on a Map (Priority: P1)

When a gardener creates a garden, they enter the garden’s address as well as its name. The product recognizes that address as one place and shows it on an OpenStreetMap map so they can confirm it is the right garden before they rely on it. No paid map key is required. Later, an owner or collaborator can correct the address from garden configuration. Every member can see the saved address and map. A garden that already exists can keep working with no address until someone adds one.

**Why this priority**: Zone, frost dates, and weather all depend on knowing where the garden is. A confirmed place is the smallest slice that makes the rest trustworthy.

**Independent Test**: Create a garden with a real street address and no paid map key configured, confirm the pin matches that address on the OpenStreetMap map, reopen configuration and see the same place. Create is rejected when the address is blank or cannot be recognized. An older garden with no address still opens.

**Acceptance Scenarios**:

1. **Given** a signed-in gardener creating a garden, and no paid map key configured, **When** they enter a name and a recognizable street address, **Then** they see that place on an OpenStreetMap map and can save the garden only after the map shows the place they mean.
2. **Given** a saved garden address, **When** any member opens garden configuration, **Then** they see the address and an OpenStreetMap map of that place. The bed map is unchanged; this place map is not drawn on the beds.
3. **Given** an owner or collaborator, **When** they change the address to a different recognizable place and save, **Then** members next see the new address and the map centered on that new place.
4. **Given** a typed address that matches more than one place, **When** the gardener is asked to continue, **Then** they must choose one match. The product does not pick for them.
5. **Given** a blank address, or an address that cannot be recognized as a place, **When** they try to save it, **Then** the save is rejected, nothing is invented on the map, and any previously saved place remains.
6. **Given** a viewer, **When** they open configuration, **Then** they can see the address and map but cannot change the address.
7. **Given** a garden created before addresses existed, and no address has been added, **When** a member opens it, **Then** the garden still works, configuration shows that no address is set, and no map pin is invented.
8. **Given** a person who is not a member, **When** they are signed in, **Then** they cannot see that garden’s address or map (same not-found outcome as a missing garden).

---

### User Story 2 - Fill Growing Zone and Frost Dates from the Address (Priority: P2)

After the garden’s place is known, the product fills in the growing zone and the usual last frost (spring) and first frost (fall) so the gardener does not look them up. The gardener can still correct those values. If the place is known but the season facts cannot be determined, the garden still saves and those fields stay unset for the gardener to enter, rather than showing guessed dates.

**Why this priority**: The address is how the household stops typing zone and frost by hand. It is useful even before weather changes any task.

**Independent Test**: Save a recognizable address whose season facts are known, reopen configuration, and see the zone and both frost dates filled. Save a place whose season facts are unknown and see zone and frost left unset with a clear explanation, not invented dates.

**Acceptance Scenarios**:

1. **Given** a new or updated address that resolves to a place with known season facts, **When** the address is saved, **Then** the garden’s growing zone and both frost dates are filled in and shown on configuration.
2. **Given** filled zone and frost dates, **When** an owner or collaborator edits them and saves without changing the address, **Then** the edited values are kept.
3. **Given** a gardener has corrected zone or frost by hand, **When** they later save a different address, **Then** zone and frost are filled again from the new place, and the product tells them the growing season was updated from the new address.
4. **Given** a recognized place whose zone or frost dates cannot be determined, or whose frost dates would not be a valid spring-then-fall pair, **When** the address is saved, **Then** the place and map are kept, the undetermined season fields stay unset, and the gardener sees that those fields need to be entered by hand. No invalid or invented season facts are shown.
5. **Given** a garden with no address, **When** a member views configuration, **Then** zone and frost behave as they do today (shown if someone entered them, otherwise not set). They are not auto-filled from a missing address.
6. **Given** a viewer, **When** season facts are filled or later edited by someone who can edit, **Then** the viewer can read them and cannot change them.

---

### User Story 3 - Watering Is Not Needed When Rain Is Expected (Priority: P3)

The garden’s address is used for weather. When a watering task is open and at least a light rain (about a tenth of an inch) is expected on the day it is due, that watering is shown as not needed. It stays on the list, it is not marked done, and it is not dismissed. If a later outlook no longer expects enough rain, it is required again. If rain is not expected, or weather cannot be checked, watering still needs to be done. Fertilizing, harvest, and any other task are unchanged.

**Why this priority**: This is the payoff of storing an address, and it depends on a confirmed place. Watering stays correct without weather until the outlook is known.

**Independent Test**: With a watering task due on a day whose outlook expects enough rain, open care tasks and see that watering is not required, with a plain reason. With a dry outlook, the same watering stays required. With no address, watering stays required.

**Acceptance Scenarios**:

1. **Given** a garden with a saved address and an open watering task, **When** the outlook for that place expects at least a light rain (about a tenth of an inch) on the day the watering is due, **Then** that watering is shown as not needed because rain is expected, and it does not count as overdue work the household must finish.
2. **Given** that same watering task, **When** the outlook expects less rain than that, or no rain, **Then** the watering stays required, the same way it does today.
3. **Given** a watering task that rain has covered, **When** an owner or collaborator still marks it done, **Then** they can. The product does not mark it done by itself.
4. **Given** a newer outlook that no longer expects enough rain on the due day, **When** a member views the task, **Then** the watering is required again (and overdue if that day has passed and nobody completed or dismissed it).
5. **Given** a garden with no address, or weather that cannot be checked and no current outlook is already loaded, **When** a member views watering tasks, **Then** those tasks stay required. The product does not treat unknown weather as rain.
6. **Given** fertilizing or harvest tasks for the same garden, **When** rain is expected, **Then** those tasks are unchanged.
7. **Given** two gardens with different addresses, **When** one place expects rain and the other does not, **Then** only the rainy garden’s watering is not required.
8. **Given** a viewer, **When** they open care tasks, **Then** they see the same rain outcome as other members and still cannot complete or dismiss tasks.

---

### Edge Cases

- Address is only a city, region, or country: those matches are dropped. If nothing street-level remains, lookup is rejected with `Type a street address. A city, region, or country is not a garden site.` and nothing is saved. A country-sized pin is not saved.
- Two gardens may share the same address (front and back, or a shared community plot). Addresses are not unique.
- The place is recognized but the map picture cannot be loaded: the address, zone, and frost dates still show, and the map area says the map is unavailable rather than showing a wrong pin.
- Changing the address while offline, or creating a garden while offline: the gardener is told they need to be online. No guessed pin, zone, frost dates, or rain outcome is saved.
- Previously opened configuration and care tasks remain readable offline. A rain outcome from a previous calendar day is ignored; watering stays required until a current outlook is loaded.
- Weather was loaded for garden A: it must not change watering on garden B.
- Very light moisture below about a tenth of an inch still means watering is required.
- Rain expected tomorrow does not cancel watering that is due today.
- The open watering task follows today’s care rules (at most one open watering per planting). This feature only changes whether that open watering is required.
- A non-member or signed-out visitor never sees the address, map, season facts filled from it, or the rain outcome.
- Last successful save wins if two editors change the address at the same time. After save or refresh, members see the stored place and the season facts that belong to it.
- A viewer or collaborator who leaves, or a removed member, no longer sees the address or weather.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Creating a garden MUST require a confirmed address in addition to the existing required name. A confirmed address is one recognizable place the gardener has seen on the map. A blank or unrecognized address MUST be rejected, and no garden place, map pin, or season facts may be invented for it.
- **FR-002**: An owner or collaborator MUST be able to add or change a garden’s address later from garden configuration. A viewer MUST be able to read the address and MUST NOT change it. Gardens that already exist without an address MUST remain usable until an address is added.
- **FR-003**: Before an address is saved, the gardener MUST see the recognized place on an OpenStreetMap map and MUST be able to tell that the pin is the place they mean. If several street-level places match the typed address, the gardener MUST choose one. The product MUST NOT choose among matches by itself. A match that is only a country, a state or region, or a city MUST NOT be offered and MUST NOT be saved. If every match is that broad, lookup MUST be rejected with `Type a street address. A city, region, or country is not a garden site.` and no place is stored.
- **FR-004**: After save, every member MUST be able to see the address and an OpenStreetMap map of that place on garden configuration. The place map MUST NOT be drawn on the bed layout.
- **FR-015**: Address lookup and the garden map MUST work without a paid API key and without a billing account. The product MUST NOT require a Google Maps key, or any other paid map key, for a household to create a garden, confirm its place, or view that place on configuration.
- **FR-005**: When an address is saved and season facts are known for that place, the product MUST fill the garden’s growing zone and both frost dates (last frost in spring, first frost in fall). The zone MUST use the same single-zone range the garden already uses (1–13). A finer label such as “6b” MUST be filled as zone 6. Frost dates MUST be annual month-and-day values and MUST keep the existing rule that last frost falls earlier in the calendar year than first frost.
- **FR-006**: Owners and collaborators MUST still be able to correct zone and frost dates after they are filled. Saving a new address MUST fill zone and frost again from the new place and MUST tell the gardener that the growing season was updated from that address. A correction made without changing the address MUST be kept.
- **FR-007**: If the place is recognized but the zone, either frost date, or a valid frost pair cannot be determined, the product MUST save the place and MUST leave the undetermined season fields unset, with a clear notice that the gardener needs to enter them. It MUST NOT invent season facts.
- **FR-008**: For a garden with a saved address, when the current outlook expects at least a light rain (about a tenth of an inch, or 2.5 mm) on the calendar day an open watering task is due, that watering MUST be shown as not needed because rain is expected, and MUST NOT count as overdue work. The reason MUST be visible in plain language on that task.
- **FR-009**: The product MUST NOT mark a rain-covered watering as completed by itself. An owner or collaborator MUST still be able to mark it done. If a newer current outlook no longer expects enough rain on that due day, the watering MUST be required again.
- **FR-010**: Watering MUST stay required when the garden has no address, when the expected rain is below a light rain, when rain is only expected on a different day, or when no current outlook is available. Unknown weather MUST NOT be treated as rain.
- **FR-011**: Fertilizing, harvest, and any task that is not watering MUST be unchanged by the outlook. This feature MUST NOT add new task kinds.
- **FR-012**: Weather for one garden MUST NOT change tasks in another garden. All members of a garden MUST see the same address, map, season facts, and rain outcome.
- **FR-013**: A person who is not a member, and anyone who is not signed in, MUST NOT see a garden’s address, map, filled season facts, or weather outcome (same not-found outcome as a missing garden).
- **FR-014**: The feature MUST NOT include a general weather dashboard, hourly or multi-day forecast browsing, severe-weather alerts, watering schedules invented from weather, automatic irrigation, or changes to fertilizing or harvest rules.

### Key Entities *(include if feature involves data)*

- **Garden place**: The address the household entered, resolved to one confirmed place that can be shown on a map. Belongs to one garden. Not required to be unique across gardens.
- **Growing season facts**: The garden’s existing growing zone and last/first frost dates. May be filled from the garden place, then corrected by an owner or collaborator. Unset means not known, never a guess.
- **Rain outlook**: Whether the garden place is expected to get at least a light rain on a given calendar day. Used only to decide whether an open watering task is required. Shared by the garden’s members.

### Access Control *(mandatory when data is user-owned or shared)*

- **Roles / permissions**:
  - **Owner** and **collaborator**: read and update the address; read the map, filled season facts, and rain outcome; correct zone and frost dates; complete or dismiss tasks as they already can.
  - **Viewer**: read the address, map, season facts, and rain outcome. Cannot change the address, zone, or frost dates, and cannot complete or dismiss tasks.
  - **Non-member**: no access (same not-found outcome as a missing garden).
- **Sharing rules**: Address, map, season facts, and rain outcome are shared with members of that garden only. They are not public and are not copied onto another garden.
- **Isolation**: One household MUST NOT see another household’s address, map, or weather. Weather for garden A MUST NOT change garden B.

### Offline / PWA Considerations *(include if feature has client behavior)*

- Creating a garden with an address, changing an address, recognizing a place, loading the map, filling season facts, and loading a new rain outlook require connectivity. The gardener sees that they need to be online; nothing is guessed and the change is not queued.
- Configuration and care tasks that were already opened stay readable offline, including the last saved address, zone, and frost dates.
- A rain outlook from a previous calendar day MUST NOT be used. Without a current outlook, watering stays required.
- Losing connectivity MUST NOT hide a garden that has no address yet, and MUST NOT block reading tasks that were already loaded.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In a usability check, at least 90% of signed-in gardeners can create a garden with a street address and confirm the map shows that place on the first attempt, in under 3 minutes.
- **SC-002**: On a fixed set of known places, every place with known season facts shows the expected zone and both frost dates after the address is saved, and every place without them leaves the unknown fields unset with a notice (100%).
- **SC-003**: On fixtures, a watering task due on a day with at least a light rain expected is not required and states that rain is expected; a dry day, a different day, a missing address, and a missing outlook all leave watering required (100%).
- **SC-004**: On a two-account check, a non-member sees none of the garden’s address, map, or rain outcome (0 leaks). A second garden with a dry outlook does not lose its required watering because the first garden expects rain (100%).
- **SC-005**: On fixtures, an existing garden with no address still opens, and its watering tasks stay required until an address is saved (100%).
- **SC-006**: On the role fixture, a viewer can see the address, map, zone, frost dates, and rain outcome, and cannot change the address or season facts (100%).
- **SC-007**: With no paid map key configured, a gardener can look up a known street address and see that place on an OpenStreetMap map before saving, and again on configuration after saving (100%).

## Assumptions

- “Growing zone” means the garden’s existing hardiness zone (a single zone from 1 to 13). Sub-zones such as 6b are filled as the parent number. This feature does not introduce a second zone system.
- “First and last frost date” means the garden’s existing annual dates: last frost is spring, first frost is fall. When both are filled, last frost is earlier in the calendar year than first frost. Places that do not fit that pattern (including southern-hemisphere reversal) leave frost dates unset for hand entry.
- A recognizable address is a street address or a specific building, not a country, state, region, or city alone. The gardener confirms the pin; they do not drop an unnamed pin with no address.
- New gardens require a confirmed address: one recognizable place shown on the map before save. Blank or unrecognized addresses are rejected. Gardens that already exist do not require one, until an owner or collaborator adds one. Until then, zone and frost stay manual, there is no place map, and watering is never skipped for rain.
- Saving a different address replaces zone and frost with the new place’s facts, including values the gardener had edited. Editing zone or frost without changing the address keeps the edits.
- “Enough rain” means at least about a tenth of an inch (2.5 mm) expected on the watering task’s due day. Less than that, or rain on another day, does not cover watering.
- Rain makes the open watering task not required. The task stays visible with the reason, is not marked done, and is not dismissed. If the forecast dries out, it is required again. It does not change fertilizing or harvest. “Tasks like watering” means watering is the only task this feature changes.
- The map the gardener sees is an OpenStreetMap map. Address lookup uses a free geocoder that does not require an API key. A household does not create a billing account or buy a map key to use either one. How the free map and geocoder are called is left to planning.
- Season facts and rain come from the confirmed place. If those details cannot be determined, the product says so and does not guess. Unknown weather leaves watering required.
- Address, map, and weather stay inside the garden’s existing membership. Viewers read; owners and collaborators edit the address. Care-task complete and dismiss rules are unchanged.
- This feature does not add a standalone weather report, alerts, or new chore types.
