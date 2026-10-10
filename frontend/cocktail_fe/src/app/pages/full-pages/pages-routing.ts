import { Routes, RouterModule } from '@angular/router';
import { NgModule } from '@angular/core';
import { CocktailListComponent } from './cocktail-list/cocktail-list.component';
import { CocktailDetailComponent } from './cocktail-detail/cocktail-detail.component';

const routes: Routes = [
    {
        path:'',
        children:[
            { path:'', redirectTo: 'cocktails', pathMatch:"full" },
            { path: 'cocktails', component: CocktailListComponent },
            { path: 'cocktail/:id/:categoryId', component:CocktailDetailComponent },
            { path: 'cocktail/:id', component:CocktailDetailComponent }
        ]
    }
]

@NgModule({
    imports: [RouterModule.forChild(routes)],
    exports: [RouterModule]
})
export class FullPagesRoutingModule { }