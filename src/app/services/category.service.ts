import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { Category, CategoryType } from '../models/category.model';
import { DEFAULT_CATEGORIES } from '../core/categories.constants';
import { localChanges$ } from '../core/local-changes';

export const CATEGORIES_KEY = 'finanzai_custom_categories';

const CUSTOM_KEY = CATEGORIES_KEY;

@Injectable({ providedIn: 'root' })
export class CategoryService {
  private categories$ = new BehaviorSubject<Category[]>(this.loadAll());

  get categories()         { return this.categories$.asObservable(); }
  get all(): Category[]    { return this.categories$.value; }
  get custom(): Category[] { return this.all.filter(c => c.isCustom); }

  getCategoriesByType(type: 'income' | 'expense'): Category[] {
    return this.all.filter(c => c.type === type || c.type === 'both');
  }

  getCategoryById(id: string | undefined): Category | undefined {
    return this.all.find(c => c.id === id);
  }

  addCategory(input: { name: string; emoji: string; type: CategoryType; color: string }): Category {
    const category: Category = {
      id:       `custom-${crypto.randomUUID()}`,
      name:     input.name.trim(),
      emoji:    input.emoji,
      type:     input.type,
      color:    input.color,
      keywords: [],
      isCustom: true,
    };
    const custom = [...this.custom, category];
    this.persistCustom(custom);
    this.categories$.next([...DEFAULT_CATEGORIES, ...custom]);
    return category;
  }

  updateCategory(category: Category): void {
    if (!category.isCustom) return;
    const custom = this.custom.map(c => c.id === category.id ? category : c);
    this.persistCustom(custom);
    this.categories$.next([...DEFAULT_CATEGORIES, ...custom]);
  }

  deleteCategory(id: string): void {
    const target = this.getCategoryById(id);
    if (!target?.isCustom) return;
    const custom = this.custom.filter(c => c.id !== id);
    this.persistCustom(custom);
    this.categories$.next([...DEFAULT_CATEGORIES, ...custom]);
  }

  restoreCustom(custom: Category[]): void {
    this.persistCustom(custom);
    this.categories$.next([...DEFAULT_CATEGORIES, ...custom]);
  }

  private loadAll(): Category[] {
    return [...DEFAULT_CATEGORIES, ...this.loadCustom()];
  }

  private loadCustom(): Category[] {
    const raw = localStorage.getItem(CUSTOM_KEY);
    return raw ? JSON.parse(raw) as Category[] : [];
  }

  /** Applica le categorie arrivate dal server senza segnalarle come modifica locale. */
  applyRemote(custom: Category[]): void {
    this.persistCustom(custom, false);
    this.categories$.next([...DEFAULT_CATEGORIES, ...custom]);
  }

  private persistCustom(custom: Category[], notify = true): void {
    localStorage.setItem(CUSTOM_KEY, JSON.stringify(custom));
    if (notify) localChanges$.next(CUSTOM_KEY);
  }
}
