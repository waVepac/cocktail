import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { HTTP_INTERCEPTORS, HttpClientModule } from '@angular/common/http';
import { AppHttpClient } from './shared/service/app-http-client.service';
import { FullLayaoutComponent } from './layout/full/full-layaout/full-layaout.component';
import { ContentLayoutComponent } from './layout/content/content-layout/content-layout.component';
import { ApiInterceptionService } from './shared/service/api-interception.service';
import { LoginComponent } from './pages/content-pages/login/login.component';
import { LogoutComponent } from './pages/content-pages/logout/logout.component';
import { ErrorComponent } from './pages/content-pages/error/error.component';
import { ApiService } from './shared/service/api.service';
import { ToastComponent } from './pages/shared-pages/toast/toast.component';
import { CocktailTransitionComponent } from './pages/shared-pages/cocktail-transition/cocktail-transition/cocktail-transition.component';
import { IntroLoaderComponent } from './pages/shared-pages/intro-loader/intro-loader.component';

import { GuestFavoriteDialogComponent } from './pages/shared-pages/guest-favorite-dialog/guest-favorite-dialog.component';

import { SpinnerComponent } from './pages/shared-pages/spinner/spinner.component';

@NgModule({
  declarations: [
    AppComponent,
    LoginComponent,
    FullLayaoutComponent,
    ContentLayoutComponent,
    LogoutComponent,
    ErrorComponent,
    ToastComponent,
    CocktailTransitionComponent,
    IntroLoaderComponent,
    GuestFavoriteDialogComponent
  ],
  imports: [
    BrowserModule,
    SpinnerComponent,
    AppRoutingModule,
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    HttpClientModule,
  ],
  providers: [AppHttpClient,
    {provide: HTTP_INTERCEPTORS, useClass: ApiInterceptionService, multi:true}, 
    ApiService],
  bootstrap: [AppComponent]
})
export class AppModule { }