import { AfterViewInit, ChangeDetectorRef, Component, ElementRef, HostListener, OnDestroy, ViewChild } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { Subscription, finalize } from 'rxjs';
import { AuthService } from 'src/app/shared/auth/auth.service';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css']
})
export class LoginComponent implements AfterViewInit, OnDestroy {
  @ViewChild('dialog') dialog!: ElementRef<HTMLElement>;
  readonly turnDuration = 980;
  registering = false;
  switching = false;
  private transitionTimer?: ReturnType<typeof setTimeout>;
  submitting = false;
  submitted = false;
  error = '';
  message = '';
  private readonly subscriptions = new Subscription();
  private readonly previousFocus = document.activeElement as HTMLElement | null;
  private readonly previousOverflow = document.body.style.overflow;
  readonly form = new FormGroup({
    username: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.pattern(/.*\S.*/)] }),
    password: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    confirmation: new FormControl('', { nonNullable: true })
  });

  constructor(public auth: AuthService, private changeDetector: ChangeDetectorRef) {
    this.registering = auth.loginMode === 'register';
  }

  ngAfterViewInit(): void {
    document.body.style.overflow = 'hidden';
    this.focusActiveField();
  }

  switchMode(): void {
    if (this.switching || this.submitting || this.auth.isLoadingSubject.value) {
      return;
    }
    this.submitted = false;
    this.error = '';
    this.message = '';
    // Keep the username synchronized on both faces of the page.
    this.form.controls.username.setValue(this.form.controls.username.value);
    this.form.controls.password.reset();
    this.form.controls.confirmation.reset();
    this.changeMode(!this.registering);
  }

  private changeMode(registering: boolean): void {
    clearTimeout(this.transitionTimer);
    this.dialog.nativeElement.querySelector<HTMLButtonElement>('.close-button')?.focus({ preventScroll: true });
    this.registering = registering;
    this.switching = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (this.switching) {
      // Fallback for interrupted transitions (background tab or a changed motion preference).
      this.transitionTimer = setTimeout(() => this.finishTurn(), this.turnDuration + 150);
    } else {
      this.finishTurn();
    }
  }

  onPageTurnEnd(event: TransitionEvent): void {
    if (event.target === event.currentTarget && event.propertyName === 'transform') {
      this.finishTurn();
    }
  }

  private finishTurn(): void {
    clearTimeout(this.transitionTimer);
    this.switching = false;
    this.changeDetector.detectChanges();
    this.focusActiveField();
  }

  private focusActiveField(): void {
    const id = this.registering ? '#register-username' : '#login-username';
    this.dialog.nativeElement.querySelector<HTMLInputElement>(id)?.focus({ preventScroll: true });
  }

  submit(): void {
    if (this.switching || this.submitting || this.auth.isLoadingSubject.value) {
      return;
    }
    this.submitted = true;
    this.error = '';
    this.message = '';
    const { username, password, confirmation } = this.form.getRawValue();
    if (this.form.invalid) {
      this.error = 'Inserisci username e password.';
      return;
    }
    if (this.registering && password !== confirmation) {
      this.error = 'Le password non coincidono.';
      return;
    }
    const registering = this.registering;
    this.submitting = true;
    const request = registering ? this.auth.register(username.trim(), password) : this.auth.login(username.trim(), password);
    this.subscriptions.add(request.pipe(finalize(() => this.submitting = false)).subscribe({
      error: error => {
        this.error = error.status === 0 || error.name === 'TimeoutError' ? 'Backend non raggiungibile. Controlla la connessione e riprova.' : error.error?.message || 'Operazione non riuscita. Riprova.';
      }
    }));
  }

  retrySession(): void {
    this.subscriptions.add(this.auth.getUserByToken().subscribe());
  }

  onBackdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.auth.closeLogin();
    }
  }

  @HostListener('document:keydown.escape', ['$event'])
  closeOnEscape(event: Event): void {
    event.stopPropagation();
    this.auth.closeLogin();
  }

  @HostListener('document:keydown', ['$event'])
  trapFocus(event: KeyboardEvent): void {
    if (event.key !== 'Tab') {
      return;
    }
    const elements = Array.from(this.dialog.nativeElement.querySelectorAll<HTMLElement>('input:enabled, button:enabled'))
      .filter(element => !element.closest('[inert]'));
    const first = elements[0];
    const last = elements[elements.length - 1];
    if (!this.dialog.nativeElement.contains(document.activeElement)) {
      event.preventDefault();
      first?.focus();
    } else if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  }

  ngOnDestroy(): void {
    clearTimeout(this.transitionTimer);
    this.subscriptions.unsubscribe();
    document.body.style.overflow = this.previousOverflow;
    setTimeout(() => {
      const target = this.previousFocus?.isConnected && this.previousFocus !== document.body ? this.previousFocus : document.querySelector<HTMLElement>('.user');
      target?.focus();
    });
  }
}
