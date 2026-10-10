import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

/*
 * Dice quando il rito d'apertura è finito (o saltato, o non previsto):
 * le pagine con una loro entrata animata aspettano questo segnale.
 */
@Injectable({
  providedIn: 'root'
})
export class IntroService {

  private doneSubject = new BehaviorSubject<boolean>(false)
  done$ = this.doneSubject.asObservable()

  markDone(): void {
    this.doneSubject.next(true)
  }
}
