import { HttpErrorResponse } from '@angular/common/http';
import { Component, HostListener, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import type { PlantSummaryDto, ReminderItemDto, TransplantListDto } from '@open-garden/shared-types';
import { LayoutApiService } from './layout-api.service';
import { PlantingsApiService } from './plantings-api.service';
import { PlantPicker } from '../plants/plant-picker';
import { RemindersApiService } from './reminders-api.service';
import { OnlineRequiredError, GardensApiService } from './gardens-api.service';
import { NoticeService } from '../ui/notice.service';
import { PlaceMarker } from '../ui/place-marker';
@Component({
  standalone: true,
  imports: [FormsModule, PlaceMarker, PlantPicker],
  template: `
    <og-place-marker [gardenId]="gardenId" [gardenName]="gardenName()" current="Transplants" />
    <h2>Transplant View</h2>
    @if (error()) {
      <p class="error">{{ error() }}</p>
    }
    @if (loading()) {
      <p class="muted">Loading…</p>
    } @else if (!list()) {
      <p class="muted">Garden unavailable or not found.</p>
    } @else {
      @if (canEdit()) {
        <og-plant-picker
          inputName="transplantSearch"
          searchLabel="Search catalog"
          placeholder="Search catalog"
          submitLabel="Search catalog"
          [requireQuery]="true"
          [beforeSearch]="allowCatalogSearch"
          (results)="onCatalog($event)"
          (failed)="onCatalogFail($event)"
        />
        <ul class="card-list">
          @for (p of catalogHits(); track p.id) {
            <li class="stack">
              <span>{{ p.commonName }}</span>
              <form class="filters" (ngSubmit)="addTransplant(p)">
                <input
                  type="date"
                  name="indoor-{{ p.id }}"
                  [(ngModel)]="indoorDate[p.id]"
                  required
                />
                <button
                  type="submit"
                  class="btn btn-primary"
                  [attr.aria-label]="'Add transplant ' + p.commonName"
                  [attr.aria-busy]="notices.busyMap().has('add-transplant') || null"
                  [disabled]="notices.busyMap().has('add-transplant')"
                >
                  Add
                </button>
              </form>
            </li>
          }
        </ul>
      }
      @if (!list()!.plantings.length) {
        <p class="muted">No unplaced transplants. Add one here, then place it in Bed View.</p>
      } @else {
        <ul class="card-list">
          @for (p of list()!.plantings; track p.id) {
            <li class="row">
              <span>{{ plantingLabel(p) }} · started {{ p.indoorStartedOn }}</span>
              @if (canEdit()) {
                @if (confirmDeleteId() !== p.id) {
                  <button
                    type="button"
                    class="btn btn-secondary"
                    [attr.aria-label]="'Delete transplant ' + p.commonName"
                    (click)="confirmDeleteId.set(p.id)"
                  >
                    Delete
                  </button>
                } @else {
                  <button
                    type="button"
                    class="btn btn-destructive"
                    [attr.aria-label]="'Confirm delete ' + p.commonName"
                    (click)="deleteTransplant(p.id)"
                    [attr.aria-busy]="notices.busyMap().has('delete-transplant') || null"
                    [disabled]="notices.busyMap().has('delete-transplant')"
                  >
                    Confirm delete
                  </button>
                  <button type="button" class="btn btn-secondary" (click)="confirmDeleteId.set(null)">
                    Cancel
                  </button>
                }
              }
            </li>
          }
        </ul>
      }
      @if (list()!.indoorReminders.length) {
        <h3>Indoor care</h3>
        <ul class="card-list">
          @for (item of list()!.indoorReminders; track item.plantingId + item.kind + item.dueOn) {
            <li class="row">
              <span>{{ item.commonName }} · {{ item.kind }} · {{ item.dueOn }}</span>
              @if (canEdit()) {
                <button type="button" class="btn btn-secondary" (click)="complete(item)">Complete</button>
                <button type="button" class="btn btn-secondary" (click)="dismiss(item)">Dismiss</button>
              }
            </li>
          }
        </ul>
      }
    }
  `,
})
export class GardenTransplantsPage implements OnInit {
  private readonly layoutApi = inject(LayoutApiService);
  private readonly plantingsApi = inject(PlantingsApiService);
  private readonly remindersApi = inject(RemindersApiService);
  private readonly gardensApi = inject(GardensApiService);
  readonly notices = inject(NoticeService);
  private readonly route = inject(ActivatedRoute);

  gardenId = '';
  gardenName = signal('Garden');
  list = signal<TransplantListDto | null>(null);
  loading = signal(true);
  error = signal('');
  catalogHits = signal<PlantSummaryDto[]>([]);
  indoorDate: Record<string, string> = {};
  confirmDeleteId = signal<string | null>(null);
  online = signal(typeof navigator === 'undefined' || navigator.onLine);

  ngOnInit() {
    this.gardenId = this.route.snapshot.paramMap.get('id') ?? '';
    if (this.gardenId) void this.load();
  }

  @HostListener('window:online')
  onWindowOnline() {
    this.online.set(true);
  }

  @HostListener('window:offline')
  onWindowOffline() {
    this.online.set(false);
  }

  canEdit() {
    const role = this.list()?.myRole;
    return role === 'owner' || role === 'collaborator';
  }

  plantingLabel(p: TransplantListDto['plantings'][0]) {
    return p.status === 'active' ? p.commonName : `${p.commonName} (removed from catalog)`;
  }

  async load() {
    this.loading.set(true);
    try {
      const [list, detail] = await Promise.all([
        this.layoutApi.getTransplants(this.gardenId),
        this.gardensApi.detail(this.gardenId),
      ]);
      this.list.set(list);
      if (detail) this.gardenName.set(detail.name);
    } catch (err) {
      this.list.set(null);
      this.fail(err);
    } finally {
      this.loading.set(false);
    }
  }

  allowCatalogSearch = () => {
    if (this.online()) return true;
    this.fail(new OnlineRequiredError());
    return false;
  };

  onCatalog(items: PlantSummaryDto[]) {
    this.catalogHits.set(items);
    this.error.set(items.length ? '' : 'No plants match that search.');
  }

  onCatalogFail(err: unknown) {
    this.catalogHits.set([]);
    this.fail(err);
  }

  async addTransplant(plant: PlantSummaryDto) {
    this.error.set('');
    await this.notices.run('add-transplant', async () => {
      if (!this.online()) {
        this.fail(new OnlineRequiredError());
        return;
      }
      const indoorStartedOn = this.indoorDate[plant.id];
      if (!indoorStartedOn) return;
      try {
        await this.plantingsApi.create(this.gardenId, {
          plantId: plant.id,
          startMethod: 'transplant',
          indoorStartedOn,
        });
        this.catalogHits.set([]);
        await this.load();
        this.notices.success('Transplant added');
      } catch (err) {
        this.fail(err);
      }
    });
  }

  async deleteTransplant(id: string) {
    this.error.set('');
    await this.notices.run('delete-transplant', async () => {
      if (!this.online()) {
        this.fail(new OnlineRequiredError());
        return;
      }
      try {
        await this.plantingsApi.remove(this.gardenId, id);
        this.confirmDeleteId.set(null);
        await this.load();
      } catch (err) {
        this.fail(err);
      }
    });
  }

  async complete(item: ReminderItemDto) {
    await this.notices.run('indoor-complete', async () => {
      try {
        await this.remindersApi.complete(
          this.gardenId,
          {
            plantingId: item.plantingId,
            kind: item.kind,
            dueOn: item.dueOn,
          },
          item.intervalDays,
        );
        await this.load();
        this.notices.success('Indoor care recorded');
      } catch (err) {
        this.fail(err);
      }
    });
  }

  async dismiss(item: ReminderItemDto) {
    await this.notices.run('indoor-dismiss', async () => {
      try {
        await this.remindersApi.dismiss(
          this.gardenId,
          {
            plantingId: item.plantingId,
            kind: item.kind,
            dueOn: item.dueOn,
          },
          item.intervalDays,
        );
        await this.load();
        this.notices.success('Reminder dismissed');
      } catch (err) {
        this.fail(err);
      }
    });
  }

  private fail(err: unknown) {
    this.notices.error(messageFrom(err));
  }
}

function messageFrom(err: unknown): string {
  if (err instanceof OnlineRequiredError) return err.message;
  if (err instanceof HttpErrorResponse) {
    const body = err.error as { error?: { message?: string } } | undefined;
    return body?.error?.message ?? err.message;
  }
  return 'Something went wrong';
}
