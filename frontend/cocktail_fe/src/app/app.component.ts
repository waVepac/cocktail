import { Component, OnDestroy, OnInit } from '@angular/core';
import { Subscription } from 'rxjs';
import { FavoritesService } from './shared/service/favorites/favorites.service';
import { AuthService } from './shared/auth/auth.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent implements OnInit, OnDestroy {
  private sessionCheck?: Subscription;

  constructor(public auth: AuthService, public favorites: FavoritesService) { }

  ngOnInit(): void {
    this.sessionCheck = this.auth.getUserByToken().subscribe();
  }

  ngOnDestroy(): void {
    this.sessionCheck?.unsubscribe();
  }
}
