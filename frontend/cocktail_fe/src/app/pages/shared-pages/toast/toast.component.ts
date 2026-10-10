import { Component, OnInit } from '@angular/core';
import { ToastService } from 'src/app/shared/service/toast/toast.service';

@Component({
  selector: 'app-toast',
  templateUrl: './toast.component.html',
  styleUrls: ['./toast.component.css']
})
export class ToastComponent implements OnInit {
  message: string = '';
  type: 'success' | 'error' | 'warning' = 'success';
  visible = false;

  private timeoutRef: any;

  // il tipo è dichiarato a parole, non solo dal colore
  get typeLabel(): string {
    switch (this.type) {
      case 'error': return 'Errore'
      case 'warning': return 'Attenzione'
      default: return 'Fatto'
    }
  }

  constructor(private toastService: ToastService) {}

  ngOnInit(): void {
    this.toastService.toast$.subscribe(toast => {
      this.message = toast.message;
      this.type = toast.type;
      this.visible = true;

      if (this.timeoutRef) {
        clearTimeout(this.timeoutRef);
      }

      this.timeoutRef = setTimeout(() => {
        this.visible = false;
      }, 3000);
    });
  }

  close_toast() {
    this.visible = false;

    if (this.timeoutRef) {
      clearTimeout(this.timeoutRef);
    }
  }
}