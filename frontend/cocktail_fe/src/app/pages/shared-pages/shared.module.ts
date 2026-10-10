import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PaginatorComponent } from '../full-pages/cocktail-list/components/paginator/paginator.component';
import { CocktailTransitionComponent } from './cocktail-transition/cocktail-transition/cocktail-transition.component';

import { SpinnerComponent } from './spinner/spinner.component';

@NgModule({
  declarations: [
    PaginatorComponent
  ],
  imports: [
    CommonModule,
    SpinnerComponent,
    FormsModule
  ],
  exports: [PaginatorComponent, SpinnerComponent]
})
export class SharedModule { }
