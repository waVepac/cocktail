import { NgModule } from '@angular/core';
import { PreloadAllModules, RouterModule, Routes } from '@angular/router';
import { FullLayaoutComponent } from './layout/full/full-layaout/full-layaout.component';
import { FULL_ROUTES } from './shared/routes/full-layout.routes';
import { ContentLayoutComponent } from './layout/content/content-layout/content-layout.component';
import { CONTENT_ROUTES } from './shared/routes/content-layout.routes';
import { LogoutComponent } from './pages/content-pages/logout/logout.component';
import { ErrorComponent } from './pages/content-pages/error/error.component';

const routes: Routes = [

  {
    path:'logout', component:LogoutComponent
  },

  {
    path: '', component:FullLayaoutComponent, data:{title:'full View'}, children:FULL_ROUTES,
  },
  {
    path:'',  component:ContentLayoutComponent, data:{title:'content view'}, children:CONTENT_ROUTES
  },
  {
    path:'**', component:ErrorComponent
  }
];

@NgModule({
  imports: [RouterModule.forRoot(routes, { preloadingStrategy: PreloadAllModules })],
  exports: [RouterModule]
})
export class AppRoutingModule { }
