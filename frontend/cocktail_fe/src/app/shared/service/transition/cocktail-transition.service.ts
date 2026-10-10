import { Injectable } from '@angular/core';
import { Params } from '@angular/router';
import { BehaviorSubject, Subject } from 'rxjs';

export interface CocktailTransitionRequest{
  cocktail: any
  imageRect: DOMRect
  imageUrl: string
  sourceElement?: HTMLElement
  categoryId?: string
  queryParams?: Params
}

@Injectable({
  providedIn: 'root'
})
export class CocktailTransitionService {

  private transitionSubject = new Subject<CocktailTransitionRequest>()
  transition$ = this.transitionSubject.asObservable()

  private detailReadySubject = new Subject<string>()
  detailReady$ = this.detailReadySubject.asObservable()

  // vero finché l'overlay del "sorso" è sullo schermo: il dettaglio aspetta prima di animarsi
  private activeSubject = new BehaviorSubject<boolean>(false)
  active$ = this.activeSubject.asObservable()

  constructor() { }

  setActive(active: boolean): void {
    this.activeSubject.next(active)
  }

  startTransition(cocktail:any, imageRect: DOMRect, imageUrl:string, sourceElement?: HTMLElement, categoryId?: string, queryParams?: Params): void {
    console.log('arrivato al servizio')
    this.transitionSubject.next({cocktail, imageRect, imageUrl, sourceElement, categoryId, queryParams})
  }

  notifyDetailReady(cocktailId: string): void{
    this.detailReadySubject.next(cocktailId)
  }
}
