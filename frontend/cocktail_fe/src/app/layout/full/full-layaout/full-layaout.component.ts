import { Component, ElementRef, HostListener, ViewChild } from '@angular/core';
import { AuthService } from 'src/app/shared/auth/auth.service';

@Component({
  selector: 'app-full-layaout',
  templateUrl: './full-layaout.component.html',
  styleUrls: ['./full-layaout.component.css']
})
export class FullLayaoutComponent {
  @ViewChild('userMenu') userMenu!: ElementRef<HTMLElement>;
  @ViewChild('userButton') userButton!: ElementRef<HTMLButtonElement>;
  menuOpen = false;

  constructor(public auth: AuthService) { }

  onUserClick(): void {
    if (this.auth.currentUserValue) {
      this.menuOpen = !this.menuOpen;
      return;
    }
    this.menuOpen = false;
    this.auth.openLogin();
  }

  logout(): void {
    this.menuOpen = false;
    this.auth.logout();
    this.userButton.nativeElement.focus();
  }

  @HostListener('document:click', ['$event'])
  onOutsideClick(event: MouseEvent): void {
    if (!this.userMenu.nativeElement.contains(event.target as Node)) {
      this.menuOpen = false;
    }
  }

  /*get userInitial(): string {
    return (this.currentUser?.username || 'O').charAt(0).toUpperCase()
  }*/

  @HostListener('document:keydown.escape')
  closeMenu(): void {
    if (this.menuOpen) {
      this.menuOpen = false;
      this.userButton.nativeElement.focus();
    }
  }
}
