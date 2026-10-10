import { AfterViewInit, Component, ElementRef, HostListener, OnDestroy, ViewChild } from '@angular/core';
import { FavoritesService } from '../../../shared/service/favorites/favorites.service';

@Component({
  selector: 'app-guest-favorite-dialog',
  templateUrl: './guest-favorite-dialog.component.html',
  styleUrls: ['./guest-favorite-dialog.component.css']
})
export class GuestFavoriteDialogComponent implements AfterViewInit, OnDestroy {
  @ViewChild('dialog') dialog!: ElementRef<HTMLElement>;
  private readonly previousFocus = document.activeElement as HTMLElement | null;
  private readonly previousOverflow = document.body.style.overflow;

  constructor(public favorites: FavoritesService) { }

  ngAfterViewInit(): void {
    document.body.style.overflow = 'hidden';
    this.dialog.nativeElement.querySelector('button')?.focus();
  }

  onBackdrop(event: MouseEvent): void {
    if (event.target === event.currentTarget) this.favorites.chooseGuest('local');
  }

  @HostListener('document:keydown', ['$event'])
  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.stopPropagation();
      this.favorites.chooseGuest('local');
    }
    if (event.key !== 'Tab') return;
    const buttons = this.dialog.nativeElement.querySelectorAll<HTMLButtonElement>('button');
    const first = buttons[0];
    const last = buttons[buttons.length - 1];
    if (!this.dialog.nativeElement.contains(document.activeElement) || (!event.shiftKey && document.activeElement === last)) {
      event.preventDefault();
      first.focus();
    } else if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    }
  }

  ngOnDestroy(): void {
    document.body.style.overflow = this.previousOverflow;
    if (this.previousFocus?.isConnected) this.previousFocus.focus();
  }
}
