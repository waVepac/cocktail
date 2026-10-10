import { Routes, RouterModule } from '@angular/router';
import { NgModule } from '@angular/core';

const routes: Routes = [
    {
        path:'',
        children:[
            { path:'login', redirectTo: '/cocktails', pathMatch: 'full' },
        ]
    }
]

@NgModule({
    imports: [RouterModule.forChild(routes)],
    exports: [RouterModule]
})
export class ContentPagesRoutingModule { }