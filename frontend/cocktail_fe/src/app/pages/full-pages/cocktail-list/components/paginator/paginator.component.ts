import { Component, EventEmitter, Input, OnChanges, Output } from '@angular/core';

@Component({
  selector: 'app-paginator',
  templateUrl: './paginator.component.html',
  styleUrls: ['./paginator.component.css']
})
export class PaginatorComponent implements OnChanges {

  @Input() currentPage: number=1
  @Input() totalPages:number = 1
  @Input() totalItems:number = 0
  @Input() pageSize:number = 20

  @Output() pageChange = new EventEmitter<number>()

  inputPage:number = 1

  ngOnChanges() {
    this.inputPage = this.currentPage;
  }

  submitPage(){
    if(this.inputPage < 1) this.inputPage = 1

    if(this.inputPage > this.totalPages) this.inputPage = this.totalPages

    this.pageChange.emit(this.inputPage)
  }

  next(){
    this.pageChange.emit(Number(this.currentPage) + 1)
  }

  prev(){
    this.pageChange.emit(Number(this.currentPage) - 1)
  }

  // ======================================================
  // NUMERI DI PAGINA (con puntini per liste lunghe)
  // ======================================================
  get pageList(): (number | '…')[] {

    const total = this.totalPages;
    const current = this.currentPage;

    if (total <= 7) {
      return Array.from({ length: total }, (_, i) => i + 1);
    }

    const pages: (number | '…')[] = [1];

    if (current > 3) pages.push('…');

    const start = Math.max(2, current - 1);
    const end = Math.min(total - 1, current + 1);

    for (let p = start; p <= end; p++) pages.push(p);

    if (current < total - 2) pages.push('…');

    pages.push(total);

    return pages;
  }

  goTo(page: number | '…') {
    if (page === '…' || page === this.currentPage) return;
    this.pageChange.emit(page);
  }

  // ======================================================
  // RANGE ELEMENTI VISUALIZZATI
  // ======================================================
  get rangeStart(): number {
    return this.totalItems === 0 ? 0 : (this.currentPage - 1) * this.pageSize + 1;
  }

  get rangeEnd(): number {
    return Math.min(this.currentPage * this.pageSize, this.totalItems);
  }

}