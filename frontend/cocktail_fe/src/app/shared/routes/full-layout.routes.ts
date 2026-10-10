import { Routes } from '@angular/router';

export const FULL_ROUTES: Routes = [
  {
    path: '', loadChildren: () => import('../../pages/full-pages/pages.module').then(m => m.FullPagesModule)
  }
  
];
 