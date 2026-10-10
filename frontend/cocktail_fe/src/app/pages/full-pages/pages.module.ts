import { CommonModule } from "@angular/common";
import { NgModule } from "@angular/core";
import { FullPagesRoutingModule } from "./pages-routing";
import { FormsModule } from "@angular/forms";
import { CocktailListComponent } from './cocktail-list/cocktail-list.component';
import { SharedModule } from "../shared-pages/shared.module";
import { CocktailRowComponent } from './cocktail-list/components/cocktail-row/cocktail-row.component';
import { CocktailDetailComponent } from './cocktail-detail/cocktail-detail.component';
import { GlassComponent } from './cocktail-detail/components/glass/glass.component';
import { BackBarComponent } from './cocktail-list/components/back-bar/back-bar.component';

@NgModule({
    imports: [
        CommonModule,
        FullPagesRoutingModule,
        FormsModule,
        SharedModule
    ],
    declarations: [
      CocktailListComponent,
      CocktailRowComponent,
      CocktailDetailComponent,
      GlassComponent,
      BackBarComponent,
  ],
})
export class FullPagesModule { }