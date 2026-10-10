import { ParamMap, Params } from '@angular/router';

export type CatalogSort = 'category-asc' | 'category-desc' | 'alphabet-asc' | 'alphabet-desc';

export interface CatalogState {
  sortBy: CatalogSort;
  categoryId?: string;
  letter?: string;
  search: string;
  onlyFavorites: boolean;
  glass?: string;
  alcoholic?: string;
  page: number;
  pageSize: number;
}

function positiveInteger(value: string | null, fallback: number): number {
  const number = Number(value);
  return Number.isSafeInteger(number) && number > 0 ? number : fallback;
}

export function readCatalogState(params: ParamMap): CatalogState {
  const allowed: CatalogSort[] = ['category-asc', 'category-desc', 'alphabet-asc', 'alphabet-desc'];
  const requested = params.get('sortBy') as CatalogSort;
  const letter = params.get('letter')?.toUpperCase();
  return {
    sortBy: allowed.includes(requested) ? requested : 'category-asc',
    categoryId: params.get('categoryId') || undefined,
    letter: letter && /^[A-Z]$/.test(letter) ? letter : undefined,
    search: params.get('search')?.trim() || '',
    glass: params.get('glass')?.trim() || undefined,
    alcoholic: ['Alcoholic', 'Non alcoholic', 'Optional alcohol'].includes(params.get('alcoholic') || '') ? params.get('alcoholic')! : undefined,
    onlyFavorites: params.get('onlyFavorites') === 'true',
    page: positiveInteger(params.get('page'), 1),
    pageSize: Math.min(100, positiveInteger(params.get('pageSize'), 10))
  };
}

export function catalogQueryParams(state: CatalogState): Params {
  const alphabetical = state.sortBy === 'alphabet-asc' || state.sortBy === 'alphabet-desc';
  const hasFilters = !!(state.glass || state.alcoholic || state.onlyFavorites);
  return {
    sortBy: state.sortBy,
    categoryId: alphabetical ? null : state.categoryId || null,
    letter: alphabetical ? state.letter || (hasFilters ? null : state.sortBy === 'alphabet-desc' ? 'Z' : 'A') : null,
    search: state.search.trim() || null,
    glass: state.glass || null,
    alcoholic: state.alcoholic || null,
    onlyFavorites: state.onlyFavorites ? 'true' : null,
    page: state.page > 1 ? state.page : null,
    pageSize: state.pageSize !== 10 ? state.pageSize : null
  };
}
